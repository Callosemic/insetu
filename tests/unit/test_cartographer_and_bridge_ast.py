import ast
import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
from akasa.db import apply_declarative_schema
from akasa.utils import load_config
from akasa.vfs import sync_vfs_barrier
from akasa.workers import _init_worker_schema
import random
from insetu.core.bridge.bridge_ast import (
    apply_ast_relocate_in_memory,
    apply_ast_rename_to_content,
    generate_commit_message_from_ledger,
)
from insetu.core.bridge.bridge_vfs import process_sync_transaction
from insetu.core.bridge.engine_bridge import BRIDGE_SCHEMA, bridge_bp
from insetu.core.cartographer.cartographer import (
    CARTOGRAPHER_SCHEMA,
    cartographer_bp,
    extract_file_symbols,
    extract_symbol_source_slice,
    map_repositories,
)
from insetu.core.system.engine_system import system_bp
from insetu.core.topology.engine_topology import (
    TOPOLOGY_SCHEMA,
    force_topology_scan,
    mount_topology_volumes_dynamically,
)
from insetu.core.bridge.parser import LEDGER_CHUNK_TYPES, parse_blocks
from insetu.core.bridge.bridge_vfs import FileTimeline
from insetu.core.bridge.engine_bridge import _replay_ledger_chunks_in_memory
from insetu.core.utils_core import InSetuURI, execute_binary
from tests.fitness.core import FitnessState
from tests.fitness.rules_python import BackendFitnessVisitor


class TestCartographerAndBridgeAst(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "alpha"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        (self.control_dir / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({
                "workspaces": {"default": {"config_path": "config.json"}},
                "active_workspace": "default",
            }),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config", "cartographer", "bridge"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".py", ".js", ".md"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, "default")
        apply_declarative_schema("cartographer", CARTOGRAPHER_SCHEMA, "default")
        apply_declarative_schema("bridge", BRIDGE_SCHEMA, "default")
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_cartographer_shallow_ast_extraction_and_syntax_resilience(self):
        """extract_file_symbols extracts public Python & JS classes/functions, harvests docstrings/JSDoc, skips _private helpers, and returns None on SyntaxError."""
        py_src = (
            "class OrderProcessor(BaseProcessor):\n"
            "    \"\"\"Processes customer orders.\n\n    Extra detail line.\n    \"\"\"\n"
            "    def run(self):\n"
            "        pass\n\n"
            "def _private_helper(x):\n"
            "    return x + 1\n\n"
            "async def calculate_tax(subtotal: float, rate: float, **kwargs) -> float:\n"
            "    \"\"\"Calculates total tax for an order.\"\"\"\n"
            "    return subtotal * rate\n"
        )
        py_syms = extract_file_symbols("billing.py", py_src)
        self.assertIsNotNone(py_syms)
        self.assertEqual(len(py_syms), 2)
        self.assertEqual(py_syms[0]["signature"], "class OrderProcessor(BaseProcessor)")
        self.assertEqual(py_syms[0]["docstring"], "Processes customer orders.")
        self.assertEqual(py_syms[1]["signature"], "async def calculate_tax(subtotal, rate, **kwargs)")
        self.assertEqual(py_syms[1]["docstring"], "Calculates total tax for an order.")

        # Broken Python syntax returns None (allowing map_repositories to keep cached symbols)
        self.assertIsNone(extract_file_symbols("broken.py", "def broken(:\n    pass\n"))

        js_src = (
            "/**\n"
            " * Formats currency strings for display.\n"
            " * @param {number} amount\n"
            " */\n"
            "export function formatCurrency(amount, currency = 'USD') {\n"
            "    return `${currency} ${amount}`;\n"
            "}\n\n"
            "function _internalUtil() { return 1; }\n\n"
            "export class CartWidget extends LitElement {\n"
            "    render() { return ''; }\n"
            "}\n"
        )
        js_syms = extract_file_symbols("ui.js", js_src)
        self.assertEqual(len(js_syms), 2)
        self.assertEqual(js_syms[0]["signature"], "function formatCurrency(amount, currency = 'USD')")
        self.assertEqual(js_syms[0]["docstring"], "Formats currency strings for display.")
        self.assertEqual(js_syms[1]["signature"], "class CartWidget")
    def test_cartographer_map_repositories_three_tier_waterfall_sentinels(self):
        """map_repositories renders Tier 1 map comments, Tier 2 docstrings, and Tier 3 '# [comment required]' sentinels on undocumented symbols."""
        (self.repo_dir / "service.py").write_text(
            "class AuthGateway:\n"
            "    \"\"\"Handles token authentication.\"\"\"\n"
            "    pass\n\n"
            "def undocumented_fn(x, y):\n"
            "    return x + y\n",
            encoding="utf-8",
        )
        (self.repo_dir / "CODE_INDEX.md").write_text(
            "# Alpha Code Index\n\n```text\nalpha/\n├── CODE_INDEX.md                   # Index file\n└── service.py                      # Core authentication service\n```\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")
        map_repositories("default", silent=True)
        sync_vfs_barrier("default")

        index_content = (self.repo_dir / "CODE_INDEX.md").read_text(encoding="utf-8")
        self.assertIn("class AuthGateway", index_content)
        self.assertIn("# Handles token authentication.", index_content)
        self.assertIn("def undocumented_fn(x, y)", index_content)
        self.assertIn("def undocumented_fn(x, y)   # [comment required]", index_content)

    def test_cartographer_extract_capability_for_py_and_js(self):
        """cartographer.extract slices exact class, method, and function spans including decorators and JSDoc."""
        py_code = (
            "import os\n\n"
            "@logged\n"
            "def compute_metric(val: int) -> int:\n"
            "    \"\"\"Computes metric.\"\"\"\n"
            "    return val * 2\n\n"
            "class DataStore:\n"
            "    @classmethod\n"
            "    def load(cls, key: str):\n"
            "        return key\n"
        )
        js_code = (
            "// Helper comment\n"
            "export function renderHeader(title) {\n"
            "    if (title) {\n"
            "        return `<h1>${title}</h1>`;\n"
            "    }\n"
            "    return '';\n"
            "}\n"
        )
        (self.repo_dir / "metrics.py").write_text(py_code, encoding="utf-8")
        (self.repo_dir / "header.js").write_text(js_code, encoding="utf-8")

        sys_ctx = system_bp.get_context("default")

        # 1. Python decorated function
        res_fn = sys_ctx.call("cartographer.extract", filepath="vfs://alpha/metrics.py", symbol="compute_metric")
        self.assertEqual(res_fn["status"], "success")
        self.assertTrue(res_fn["source"].startswith("@logged\ndef compute_metric"))
        self.assertIn("return val * 2", res_fn["source"])

        # 2. Python class method (Class.method)
        res_method = sys_ctx.call("cartographer.extract", filepath="vfs://alpha/metrics.py", symbol="DataStore.load")
        self.assertEqual(res_method["status"], "success")
        self.assertIn("@classmethod", res_method["source"])
        self.assertIn("def load(cls, key: str):", res_method["source"])

        # 3. JS exported function with preceding comment
        res_js = sys_ctx.call("cartographer.extract", filepath="vfs://alpha/header.js", symbol="renderHeader")
        self.assertEqual(res_js["status"], "success")
        self.assertIn("// Helper comment", res_js["source"])
        self.assertTrue(res_js["source"].rstrip().endswith("}"))

    def test_parse_blocks_relocate_and_rename_backward_compatible_envelope(self):
        """parse_blocks parses RELOCATE and RENAME blocks while preserving 'search' and 'replace' keys on block dicts."""
        payload = (
            "<<<<<<< COMMENT\n"
            "Move helper to utils and rename legacy call\n"
            "<<<<<<< RELOCATE\n"
            "SYMBOL: compute_metric\n"
            "FROM: vfs://alpha/metrics.py\n"
            "TO: vfs://alpha/utils.py\n"
            ">>>>>>> EXECUTE\n\n"
            "<<<<<<< COMMENT\n"
            "Rename old_name across alpha\n"
            "<<<<<<< RENAME\n"
            "TARGET: old_name\n"
            "REPLACE_WITH: new_name\n"
            "SCOPE: vfs://alpha/\n"
            ">>>>>>> EXECUTE\n"
        )
        parsed = parse_blocks(payload)
        self.assertIn("vfs://alpha/metrics.py", parsed)
        self.assertIn("vfs://alpha/", parsed)

        rel_block = parsed["vfs://alpha/metrics.py"][0]
        self.assertEqual(rel_block["type"], "relocate")
        self.assertEqual(rel_block["symbol"], "compute_metric")
        self.assertEqual(rel_block["source_uri"], "vfs://alpha/metrics.py")
        self.assertEqual(rel_block["target_uri"], "vfs://alpha/utils.py")
        self.assertEqual(rel_block["search"], "")
        self.assertEqual(rel_block["replace"], "")

        ren_block = parsed["vfs://alpha/"][0]
        self.assertEqual(ren_block["type"], "rename")
        self.assertEqual(ren_block["target_symbol"], "old_name")
        self.assertEqual(ren_block["new_symbol"], "new_name")
        self.assertEqual(ren_block["scope_prefix"], "vfs://alpha/")
        self.assertEqual(ren_block["search"], "")
        self.assertEqual(ren_block["replace"], "")

    def test_bridge_ast_relocate_and_atomic_revert(self):
        """bridge.ast_relocate moves a symbol byte-for-byte between files, records ledger snapshots, and supports atomic revert."""
        src_file = self.repo_dir / "source_mod.py"
        dst_file = self.repo_dir / "target_mod.py"
        orig_src = (
            "def stay_here():\n"
            "    return 'stay'\n\n"
            "def move_me(x: int) -> int:\n"
            "    \"\"\"Moves cleanly to target_mod.\"\"\"\n"
            "    return x * 10\n"
        )
        orig_dst = "def existing_target():\n    return 'target'\n"
        src_file.write_text(orig_src, encoding="utf-8")
        dst_file.write_text(orig_dst, encoding="utf-8")
        force_topology_scan(workspace_id="default")

        sys_ctx = system_bp.get_context("default")
        rel_res = sys_ctx.call(
            "bridge.ast_relocate",
            symbol="move_me",
            source_uri="vfs://alpha/source_mod.py",
            target_uri="vfs://alpha/target_mod.py",
            comment="Extract move_me into target_mod",
            wait=True,
        )
        self.assertTrue(rel_res.get("can_commit"))
        self.assertEqual(rel_res.get("status"), "committed")
        self.assertEqual(rel_res["patches"][0]["resolved_file"], "vfs://alpha/source_mod.py")
        self.assertEqual(rel_res["patches"][0]["target_uri"], "vfs://alpha/target_mod.py")
        self.assertEqual(rel_res["patches"][0]["symbol"], "move_me")
        self.assertEqual(rel_res["patches"][0]["flags"], ["ast_relocate"])
        self.assertNotIn(" -> ", rel_res["patches"][0]["resolved_file"])
        sync_vfs_barrier("default")

        new_src_disk = src_file.read_text(encoding="utf-8")
        new_dst_disk = dst_file.read_text(encoding="utf-8")
        self.assertNotIn("def move_me", new_src_disk)
        self.assertIn("def stay_here", new_src_disk)
        self.assertIn("def move_me(x: int) -> int:", new_dst_disk)
        self.assertIn("return x * 10", new_dst_disk)

        # Re-running the same relocate is idempotent (auto_skipped)
        idem_res = sys_ctx.call(
            "bridge.ast_relocate",
            symbol="move_me",
            source_uri="vfs://alpha/source_mod.py",
            target_uri="vfs://alpha/target_mod.py",
            wait=True,
        )
        self.assertEqual(idem_res["summary"]["auto_skipped"], 1)

        # Verify commit message synthesis from ledger
        commit_info = sys_ctx.call("bridge.commit_message", repo="alpha")
        self.assertIn("refactor(alpha): Extract move_me into target_mod", commit_info["commit_message"])
        self.assertIn(f"Transaction-ID: {rel_res['transaction_id']}", commit_info["commit_message"])

        # Revert transaction -> restores both source_mod.py and target_mod.py to initial state
        rev_res = sys_ctx.call(
            "bridge.revert",
            transaction_id=rel_res["transaction_id"],
            target_state="initial",
        )
        self.assertEqual(rev_res["status"], "success")
        sync_vfs_barrier("default")
        self.assertEqual(src_file.read_text(encoding="utf-8"), orig_src)
        self.assertEqual(dst_file.read_text(encoding="utf-8"), orig_dst)

    def test_bridge_ast_rename_skips_comments_and_strings(self):
        """bridge.ast_rename renames identifiers in Python and JS files while ignoring string literals and comments."""
        py_file = self.repo_dir / "worker.py"
        js_file = self.repo_dir / "client.js"

        py_file.write_text(
            "# legacy_fn should not change in this comment\n"
            "def legacy_fn(val):\n"
            "    label = 'Call legacy_fn here'\n"
            "    return legacy_fn(val - 1) if val > 0 else label\n",
            encoding="utf-8",
        )
        js_file.write_text(
            "// Do not rename legacy_fn in comments\n"
            "const msg = \"legacy_fn is deprecated\";\n"
            "export function run() {\n"
            "    return legacy_fn(42);\n"
            "}\n",
            encoding="utf-8",
        )
        force_topology_scan(workspace_id="default")

        sys_ctx = system_bp.get_context("default")
        ren_res = sys_ctx.call(
            "bridge.ast_rename",
            target_symbol="legacy_fn",
            new_symbol="modern_fn",
            scope_prefix="vfs://alpha/",
            comment="Rename legacy_fn to modern_fn across alpha",
            wait=True,
        )
        self.assertTrue(ren_res.get("can_commit"))
        sync_vfs_barrier("default")

        py_after = py_file.read_text(encoding="utf-8")
        self.assertIn("def modern_fn(val):", py_after)
        self.assertIn("return modern_fn(val - 1)", py_after)
        self.assertIn("# legacy_fn should not change in this comment", py_after)
        self.assertIn("label = 'Call legacy_fn here'", py_after)

        js_after = js_file.read_text(encoding="utf-8")
        self.assertIn("return modern_fn(42);", js_after)
        self.assertIn("// Do not rename legacy_fn in comments", js_after)
        self.assertIn('const msg = "legacy_fn is deprecated";', js_after)

    def test_agent_fitness_mandates_catch_direct_llm_and_vfs_writes(self):
        """BackendFitnessVisitor flags AGENT_LLM_GATEWAY_MANDATE and YOMAMA_PATCH_GATEWAY_MANDATE in engine_agent.py / orchestrator.py."""
        bad_agent_code = (
            "import urllib.request\n"
            "def bad_agent_turn(ctx):\n"
            "    ctx.vfs.save('vfs://alpha/main.py', 'x = 1')\n"
        )
        fake_path = Path(__file__).resolve().parent.parent.parent / "insetu" / "core" / "agent" / "orchestrator.py"
        tree = ast.parse(bad_agent_code, filename=str(fake_path))
        prev = FitnessState.violations_found
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                BackendFitnessVisitor(fake_path, "orchestrator.py", is_test=False).visit(tree)
            out = buf.getvalue()
            self.assertIn("AGENT_LLM_GATEWAY_MANDATE", out)
            self.assertIn("YOMAMA_PATCH_GATEWAY_MANDATE", out)
        finally:
            FitnessState.violations_found = prev

    def test_relocate_creates_missing_destination_with_module_docstring_and_reverts(self):
        """RELOCATE into a missing destination creates the file, seeds its module docstring from COMMENT, applies same-patch edits, and deletes the created file on initial revert."""
        src_file = self.repo_dir / "monolith.py"
        dst_file = self.repo_dir / "extracted_helpers.py"
        orig_src = (
            "def keep_in_monolith():\n"
            "    return 'kept'\n\n"
            "@decorator_tag\n"
            "def relocated_fn(val: int) -> int:\n"
            "    \"\"\"Doubles the input value.\"\"\"\n"
            "    return val * 2\n"
        )
        src_file.write_text(orig_src, encoding="utf-8")
        self.assertFalse(dst_file.exists())
        force_topology_scan(workspace_id="default")

        marker = "<" * 7
        sep = "=" * 7
        close_rep = ">" * 7 + " REPLACE"
        close_exe = ">" * 7 + " EXECUTE"
        patch_payload = "\n".join([
            f"{marker} FILE: vfs://alpha/monolith.py",
            f"{marker} COMMENT",
            "Extracted arithmetic helpers for Alpha. Created during Wave 1 split.",
            f"{marker} RELOCATE",
            "SYMBOL: relocated_fn",
            "FROM: vfs://alpha/monolith.py",
            "TO: vfs://alpha/extracted_helpers.py",
            close_exe,
            "",
            f"{marker} FILE: vfs://alpha/extracted_helpers.py",
            f"{marker} COMMENT",
            "Tune multiplier in newly created destination file",
            f"{marker} SEARCH",
            "    return val * 2",
            sep,
            "    return val * 10",
            close_rep,
        ])

        sys_ctx = system_bp.get_context("default")
        bridge_ctx = bridge_bp.get_context("default")

        # 1. Dry run and live commit must produce identical buffers
        with bridge_ctx.vfs as vfs:
            dry_tel, dry_buffers, _ = process_sync_transaction(
                vfs,
                "default",
                {"text": patch_payload, "dry_run": True, "pinned_repos": ["ALL"]},
                ["alpha"],
                self.root_path.as_posix(),
                return_buffers=True,
                ctx=bridge_ctx,
            )
        self.assertTrue(dry_tel["can_commit"], dry_tel)
        self.assertFalse(dst_file.exists(), "Dry run must not touch disk")

        live_res = sys_ctx.call(
            "bridge.sync",
            text=patch_payload,
            active_files=["vfs://alpha/monolith.py"],
            dry_run=False,
            wait=True,
        )
        sync_vfs_barrier("default")
        self.assertTrue(live_res.get("can_commit"), live_res)
        self.assertTrue(dst_file.exists())

        live_src_disk = src_file.read_text(encoding="utf-8")
        live_dst_disk = dst_file.read_text(encoding="utf-8")
        self.assertEqual(live_src_disk, dry_buffers["vfs://alpha/monolith.py"])
        self.assertEqual(live_dst_disk, dry_buffers["vfs://alpha/extracted_helpers.py"])
        self.assertTrue(live_dst_disk.startswith('"""Extracted arithmetic helpers for Alpha."""\n'))
        self.assertIn("@decorator_tag\ndef relocated_fn(val: int) -> int:", live_dst_disk)
        self.assertIn("return val * 10", live_dst_disk)

        # 2. Revert to initial state -> deletes extracted_helpers.py and restores monolith.py byte for byte
        rev_res = sys_ctx.call(
            "bridge.revert",
            transaction_id=live_res["transaction_id"],
            target_state="initial",
        )
        sync_vfs_barrier("default")
        self.assertEqual(rev_res["status"], "success")
        self.assertFalse(dst_file.exists(), "Reverting a transaction that created a file must delete that file")
        self.assertEqual(src_file.read_text(encoding="utf-8"), orig_src)

    def test_issue_15_move_file_and_edit_in_same_patch_dry_run_matches_live_and_reverts(self):
        """Regression test for Issue #15: MOVE_FILE followed by SEARCH/REPLACE on the moved file (whether addressed by old or new path, or declared in any file-header order) applies in both dry run and live commit and reverts cleanly."""
        old_path = self.repo_dir / "agent" / "directives.py"
        new_path = self.repo_dir / "directives.py"
        old_path.parent.mkdir(parents=True, exist_ok=True)
        orig_content = '"""Old directives location."""\nLEVEL = 1\nMODE = "legacy"\n'
        old_path.write_text(orig_content, encoding="utf-8")
        force_topology_scan(workspace_id="default")

        marker = "<" * 7
        sep = "=" * 7
        close_rep = ">" * 7 + " REPLACE"
        close_exe = ">" * 7 + " EXECUTE"

        # Case: FILE: new_path appears in the dict alongside FILE: old_path (MOVE_FILE), plus a second edit after MOVE_FILE
        patch_payload = "\n".join([
            f"{marker} FILE: vfs://alpha/agent/directives.py",
            f"{marker} MOVE_FILE",
            "FROM: vfs://alpha/agent/directives.py",
            "TO: vfs://alpha/directives.py",
            close_exe,
            "",
            f"{marker} FILE: vfs://alpha/directives.py",
            f"{marker} SEARCH",
            "LEVEL = 1",
            sep,
            "LEVEL = 2",
            close_rep,
            "",
            f"{marker} FILE: vfs://alpha/agent/directives.py",
            f"{marker} SEARCH",
            'MODE = "legacy"',
            sep,
            'MODE = "modern"',
            close_rep,
        ])

        sys_ctx = system_bp.get_context("default")
        bridge_ctx = bridge_bp.get_context("default")

        with bridge_ctx.vfs as vfs:
            dry_tel, dry_buffers, _ = process_sync_transaction(
                vfs,
                "default",
                {"text": patch_payload, "dry_run": True, "pinned_repos": ["ALL"]},
                ["alpha"],
                self.root_path.as_posix(),
                return_buffers=True,
                ctx=bridge_ctx,
            )
        self.assertTrue(dry_tel["can_commit"], dry_tel)

        live_res = sys_ctx.call("bridge.sync", text=patch_payload, dry_run=False, wait=True)
        sync_vfs_barrier("default")
        self.assertTrue(live_res.get("can_commit"), live_res)
        self.assertFalse(old_path.exists())
        self.assertTrue(new_path.exists())

        expected_final = '"""Old directives location."""\nLEVEL = 2\nMODE = "modern"\n'
        self.assertEqual(dry_buffers["vfs://alpha/directives.py"], expected_final)
        self.assertEqual(new_path.read_text(encoding="utf-8"), expected_final)

        # Revert -> deletes new_path and restores old_path byte for byte
        sys_ctx.call("bridge.revert", transaction_id=live_res["transaction_id"], target_state="initial")
        sync_vfs_barrier("default")
        self.assertTrue(old_path.exists())
        self.assertFalse(new_path.exists())
        self.assertEqual(old_path.read_text(encoding="utf-8"), orig_content)

    def test_property_random_move_relocate_and_edit_transactions_preserve_parity_and_revert(self):
        """Property test (V7): across randomized multi-step transactions mixing MOVE_FILE, RELOCATE, and SEARCH/REPLACE, dry-run buffers equal live-committed disk files and bridge.revert restores every file byte for byte."""
        rng = random.Random(20261104)
        sys_ctx = system_bp.get_context("default")
        bridge_ctx = bridge_bp.get_context("default")
        marker = "<" * 7
        sep = "=" * 7
        close_rep = ">" * 7 + " REPLACE"
        close_exe = ">" * 7 + " EXECUTE"

        for trial in range(12):
            with self.subTest(trial=trial):
                # Clean repo directory for this trial
                for p in list(self.repo_dir.rglob("*.py")):
                    p.unlink()

                initial_a = (
                    "def fn_alpha():\n    return 100\n\n"
                    "def fn_beta():\n    return 200\n\n"
                    "def fn_gamma():\n    return 300\n"
                )
                initial_b = "def fn_existing():\n    return 1\n"
                file_a = self.repo_dir / "mod_a.py"
                file_b = self.repo_dir / "mod_b.py"
                file_a.write_text(initial_a, encoding="utf-8")
                file_b.write_text(initial_b, encoding="utf-8")
                force_topology_scan(workspace_id="default")

                ops = []
                # Randomly build a sequence of 3 to 5 ordered operations
                relocate_target_new = rng.choice([True, False])
                rel_dst_uri = "vfs://alpha/mod_new.py" if relocate_target_new else "vfs://alpha/mod_b.py"
                val_beta_1 = rng.randint(201, 299)
                val_beta_2 = rng.randint(301, 399)
                val_alpha_1 = rng.randint(101, 199)

                if rng.choice([True, False]):
                    # Edit fn_beta in mod_a BEFORE relocating it, then edit it again at its destination
                    ops.append(
                        f"{marker} FILE: vfs://alpha/mod_a.py\n{marker} SEARCH\ndef fn_beta():\n    return 200\n{sep}\ndef fn_beta():\n    return {val_beta_1}\n{close_rep}"
                    )
                    ops.append(
                        f"{marker} FILE: vfs://alpha/mod_a.py\n{marker} COMMENT\nRelocated beta helper.\n{marker} RELOCATE\nSYMBOL: fn_beta\nFROM: vfs://alpha/mod_a.py\nTO: {rel_dst_uri}\n{close_exe}"
                    )
                    ops.append(
                        f"{marker} FILE: {rel_dst_uri}\n{marker} SEARCH\ndef fn_beta():\n    return {val_beta_1}\n{sep}\ndef fn_beta():\n    return {val_beta_2}\n{close_rep}"
                    )
                else:
                    # Relocate fn_beta first, then edit it twice in sequential order at its destination
                    ops.append(
                        f"{marker} FILE: vfs://alpha/mod_a.py\n{marker} COMMENT\nRelocated beta helper.\n{marker} RELOCATE\nSYMBOL: fn_beta\nFROM: vfs://alpha/mod_a.py\nTO: {rel_dst_uri}\n{close_exe}"
                    )
                    ops.append(
                        f"{marker} FILE: {rel_dst_uri}\n{marker} SEARCH\ndef fn_beta():\n    return 200\n{sep}\ndef fn_beta():\n    return {val_beta_1}\n{close_rep}"
                    )
                    ops.append(
                        f"{marker} FILE: {rel_dst_uri}\n{marker} SEARCH\ndef fn_beta():\n    return {val_beta_1}\n{sep}\ndef fn_beta():\n    return {val_beta_2}\n{close_rep}"
                    )

                # Optionally move mod_a.py -> mod_a_moved.py and edit fn_alpha after the move
                move_a = rng.choice([True, False])
                if move_a:
                    ops.append(
                        f"{marker} FILE: vfs://alpha/mod_a.py\n{marker} MOVE_FILE\nFROM: vfs://alpha/mod_a.py\nTO: vfs://alpha/mod_a_moved.py\n{close_exe}"
                    )
                    target_for_alpha_edit = rng.choice(["vfs://alpha/mod_a.py", "vfs://alpha/mod_a_moved.py"])
                    ops.append(
                        f"{marker} FILE: {target_for_alpha_edit}\n{marker} SEARCH\ndef fn_alpha():\n    return 100\n{sep}\ndef fn_alpha():\n    return {val_alpha_1}\n{close_rep}"
                    )
                else:
                    ops.append(
                        f"{marker} FILE: vfs://alpha/mod_a.py\n{marker} SEARCH\ndef fn_alpha():\n    return 100\n{sep}\ndef fn_alpha():\n    return {val_alpha_1}\n{close_rep}"
                    )

                payload_text = "\n\n".join(ops)

                # 1. Dry-run evaluation
                with bridge_ctx.vfs as vfs:
                    dry_tel, dry_buffers, _ = process_sync_transaction(
                        vfs,
                        "default",
                        {"text": payload_text, "dry_run": True, "pinned_repos": ["ALL"]},
                        ["alpha"],
                        self.root_path.as_posix(),
                        return_buffers=True,
                        ctx=bridge_ctx,
                    )
                self.assertTrue(dry_tel["can_commit"], f"Dry run failed on trial {trial}: {dry_tel}")
                for pt in dry_tel.get("patches", []):
                    if pt.get("resolved_file"):
                        self.assertNotIn(" -> ", pt["resolved_file"])
                        self.assertTrue(bool(InSetuURI(pt["resolved_file"]).scheme))

                # 2. Live commit
                live_tel = sys_ctx.call("bridge.sync", text=payload_text, dry_run=False, wait=True)
                sync_vfs_barrier("default")
                self.assertTrue(live_tel.get("can_commit"), f"Live commit failed on trial {trial}: {live_tel}")

                # 3. Verify dry_run buffers == live disk state for every touched URI
                for uri_str, dry_content in dry_buffers.items():
                    rel_p = InSetuURI(uri_str).path
                    phys_p = self.repo_dir / rel_p
                    if dry_content == "":
                        self.assertFalse(phys_p.exists(), f"{uri_str} was deleted in dry run but still exists on disk")
                    else:
                        self.assertTrue(phys_p.exists(), f"{uri_str} was created in dry run but missing on disk")
                        self.assertEqual(phys_p.read_text(encoding="utf-8"), dry_content)

                # Verify final values reflect sequential block order
                final_dst_phys = self.repo_dir / InSetuURI(rel_dst_uri).path
                self.assertIn(f"return {val_beta_2}", final_dst_phys.read_text(encoding="utf-8"))
                final_a_phys = self.repo_dir / ("mod_a_moved.py" if move_a else "mod_a.py")
                self.assertIn(f"return {val_alpha_1}", final_a_phys.read_text(encoding="utf-8"))

                # 4. Revert transaction -> every file on disk returns byte-for-byte to initial state
                rev_res = sys_ctx.call("bridge.revert", transaction_id=live_tel["transaction_id"], target_state="initial")
                sync_vfs_barrier("default")
                self.assertEqual(rev_res["status"], "success")
                self.assertTrue(file_a.exists())
                self.assertTrue(file_b.exists())
                self.assertEqual(file_a.read_text(encoding="utf-8"), initial_a)
                self.assertEqual(file_b.read_text(encoding="utf-8"), initial_b)
                self.assertFalse((self.repo_dir / "mod_new.py").exists())
                self.assertFalse((self.repo_dir / "mod_a_moved.py").exists())

    def test_optional_str_buffer_law_distinguishes_zero_byte_files_from_absent_files(self):
        """FileTimeline & bridge.revert distinguish a 0-byte file ('') from an absent file (None) across create, delete, and revert."""
        empty_init = self.repo_dir / "__init__.py"
        empty_init.write_text("", encoding="utf-8")
        self.assertTrue(empty_init.exists())
        self.assertEqual(empty_init.read_text(encoding="utf-8"), "")
        force_topology_scan(workspace_id="default")

        sys_ctx = system_bp.get_context("default")
        marker = "<" * 7
        sep = "=" * 7
        close_rep = ">" * 7 + " REPLACE"
        close_exe = ">" * 7 + " EXECUTE"

        # 1. A genesis patch targeting an existing 0-byte file must trigger OVERWRITE_EXISTING (because "" is not None!)
        overwrite_empty_patch = "\n".join([
            f"{marker} FILE: vfs://alpha/__init__.py",
            f"{marker} ID: cell_ow_empty",
            f"{marker} SEARCH",
            sep,
            "# Non-empty init",
            close_rep,
        ])
        unconfirmed = sys_ctx.call("bridge.sync", text=overwrite_empty_patch, wait=True)
        self.assertFalse(unconfirmed["can_commit"])
        self.assertEqual(unconfirmed["patches"][0]["gate"]["code"], "OVERWRITE_EXISTING")

        # 2. Deleting an existing 0-byte file ("" -> None) and reverting restores the 0-byte file ("") on disk
        del_empty_patch = "\n".join([
            f"{marker} FILE: vfs://alpha/__init__.py",
            f"{marker} ID: cell_del_empty",
            f"{marker} DELETE_FILE",
            "FILE: vfs://alpha/__init__.py",
            close_exe,
        ])
        del_res = sys_ctx.call(
            "bridge.sync",
            text=del_empty_patch,
            resolutions={"cell_del_empty": {"approved_gate": "DESTRUCTIVE_DELETE"}},
            wait=True,
        )
        sync_vfs_barrier("default")
        self.assertTrue(del_res["can_commit"])
        self.assertFalse(empty_init.exists())

        sys_ctx.call("bridge.revert", transaction_id=del_res["transaction_id"], target_state="initial")
        sync_vfs_barrier("default")
        self.assertTrue(empty_init.exists(), "Reverting deletion of a 0-byte file must restore the 0-byte file")
        self.assertEqual(empty_init.read_text(encoding="utf-8"), "")

    def test_ledger_chunk_types_closed_set_validation_and_roundtrip_replay(self):
        """Pattern 4: FileTimeline.record_step and _replay_ledger_chunks_in_memory enforce LEDGER_CHUNK_TYPES and round-trip every valid chunk type."""
        expected_types = {
            "exact", "regex", "textedit", "json_patch",
            "relocate", "rename", "move_file", "archive_file", "delete_file", "revert",
        }
        self.assertEqual(LEDGER_CHUNK_TYPES, expected_types)

        tl = FileTimeline("vfs://alpha/sample.py", "x = 1\n")
        with self.assertRaises(ValueError):
            tl.record_step("x = 2\n", {"type": "unknown_chunk_kind"}, {"patch_index": 0})

        with self.assertRaises(ValueError):
            _replay_ledger_chunks_in_memory(
                "vfs://alpha/sample.py",
                "x = 1\n",
                [{"chunks_json": json.dumps([{"type": "bogus_kind", "search": "x = 1\n", "replace": "x = 2\n"}]), "search_block": "", "replace_block": ""}],
            )

        # Round-trip property test across valid chunk types in FileTimeline -> _replay_ledger_chunks_in_memory
        from insetu.core.bridge.bridge_fuzzy import (
            apply_block_in_memory as _apply_block,
            apply_json_patch_in_memory as _apply_jp,
            apply_textedit_in_memory as _apply_te,
        )

        base_doc = "---\ntitle: V1\n---\n\nHello world\n"
        tl_rt = FileTimeline("vfs://alpha/doc.md", base_doc)
        jp_block = {"type": "json_patch", "patch_body": '{"title": "V2"}'}
        ok1, step1, _ = _apply_jp("vfs://alpha/doc.md", base_doc, jp_block, silent=True)
        self.assertTrue(ok1)
        tl_rt.record_step(
            step1,
            jp_block,
            {"patch_index": 0},
            ledger_type="json_patch",
            ledger_search=base_doc,
            ledger_replace=step1,
        )
        te_block = {"type": "textedit", "search": "Hello world", "replace": "Hello inSetu"}
        ok2, step2, _ = _apply_te(step1, te_block, silent=True)
        self.assertTrue(ok2)
        tl_rt.record_step(
            step2,
            te_block,
            {"patch_index": 1},
            ledger_type="textedit",
        )
        ex_block = {"type": "exact", "search": "Hello inSetu", "replace": "Hello inSetu!"}
        ok3, step3, _ = _apply_block(step2, ex_block, silent=True)
        self.assertTrue(ok3)
        tl_rt.record_step(
            step3,
            ex_block,
            {"patch_index": 2},
            ledger_type="exact",
        )
        tl_rt.record_step(
            None,
            {"type": "delete_file"},
            {"patch_index": 3},
            ledger_type="delete_file",
            ledger_search=step3,
            ledger_replace="",
        )
        chunks = [tr["ledger_chunk"] for tr in tl_rt.transitions]
        replayed_before_del = _replay_ledger_chunks_in_memory(
            "vfs://alpha/doc.md",
            base_doc,
            [{"chunks_json": json.dumps(chunks[:-1]), "search_block": "", "replace_block": ""}],
        )
        self.assertEqual(replayed_before_del, step3)
        replayed_after_del = _replay_ledger_chunks_in_memory(
            "vfs://alpha/doc.md",
            base_doc,
            [{"chunks_json": json.dumps(chunks), "search_block": "", "replace_block": ""}],
        )
        self.assertIsNone(replayed_after_del)


if __name__ == "__main__":
    unittest.main()