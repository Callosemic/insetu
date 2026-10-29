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
from insetu.core.bridge.bridge_ast import (
    apply_ast_relocate_in_memory,
    apply_ast_rename_to_content,
    generate_commit_message_from_ledger,
)
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
from insetu.core.utils_core import execute_binary, parse_blocks
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


if __name__ == "__main__":
    unittest.main()