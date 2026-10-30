import json
import os
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from typing import List, Optional
from unittest.mock import MagicMock, patch
import akasa
import akasa.db as akasa_db
import akasa.utils as akasa_utils
import ast
import contextlib
import io
from akasa.utils import load_config
from akasa.workers import _init_worker_schema
from insetu.core.sdk import (
    InSetuExtension,
    ExtensionContext,
    get_registered_capabilities,
    resolve_external_dependency_spec,
)
from insetu.core.system.engine_system import (
    _get_whitelisted_extension_packages,
    _background_install_extension_deps,
    system_bp,
)
from insetu.core.system.legacy import move_tree_contents
from insetu.core.utils_core import parse_frontmatter, get_domain_cache_path, get_domain_data_path
from insetu.core.gather.engine_gather import gather_bp, VFS_INDEX_SCHEMA
from akasa.db import apply_declarative_schema
from akasa.vfs import sync_vfs_barrier
from insetu.core.agent.engine_agent import (
    agent_bp,
    AGENT_SCHEMA,
    _execute_agent_turn,
    _background_compile_routine_workflows,
)
from insetu.core.bridge.engine_bridge import bridge_bp, BRIDGE_SCHEMA
from insetu.core.llm.engine_llm import llm_bp
from insetu.core.topology.engine_topology import TOPOLOGY_SCHEMA, mount_topology_volumes_dynamically
from tests.fitness.core import FitnessState
from tests.fitness.rules_python import BackendFitnessVisitor, check_python_files


def _reset_db_connections():
    for attr in dir(akasa_db):
        obj = getattr(akasa_db, attr)
        if hasattr(obj, "connections") and isinstance(obj.connections, dict):
            for c in list(obj.connections.values()):
                try: c.close()
                except Exception: pass
            obj.connections.clear()
        elif isinstance(obj, dict) and "conn" in attr.lower():
            for c in list(obj.values()):
                try: c.close()
                except Exception: pass
            obj.clear()


class TestSdkImprovements(unittest.TestCase):
    def setUp(self):
        _reset_db_connections()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        self.workspace_id = f"ws_{uuid.uuid4().hex[:8]}"
        (self.control_dir / "host.json").write_text(
            json.dumps({"port": 5005}),
            encoding="utf-8",
        )
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({
                "workspaces": {
                    "default": {"config_path": "config.json"},
                    self.workspace_id: {"config_path": (self.control_dir / "config.json").as_posix()},
                },
                "active_workspace": "default",
            }),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({"workspace_root": self.root_path.as_posix(), "target_repos": []}),
            encoding="utf-8",
        )

        _init_worker_schema(self.workspace_id)

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_create_entity_file_contract(self):
        """ctx.create_entity_file formats YAML frontmatter, slugifies, and saves to VFS."""
        ctx = ExtensionContext("notes", self.workspace_id)
        mock_vfs_save = MagicMock()
        ctx.vfs.save = mock_vfs_save
        logical_path, meta = ctx.create_entity_file(
            folder="ctx://notes",
            title="Sprint Architecture Review!",
            yaml_data={"status": "draft", "tags": ["arch", "core"]},
            body_content="## Description\nInitial architectural review notes.",
            prefix="not"
        )

        # 1. Path & Slug Verification
        self.assertTrue(logical_path.startswith("ctx://notes/sprint_architecture_review-not-"))
        self.assertTrue(logical_path.endswith(".md"))

        # 2. Metadata Verification
        self.assertEqual(meta["title"], "Sprint Architecture Review!")
        self.assertEqual(meta["status"], "draft")
        self.assertEqual(meta["tags"], ["arch", "core"])
        self.assertIn("created_at", meta)
        self.assertIn("updated_at", meta)

        # 3. VFS Write Payload Verification
        mock_vfs_save.assert_called_once()
        saved_path, saved_content = mock_vfs_save.call_args[0]
        self.assertEqual(saved_path, logical_path)
        parsed_yaml, body, _ = parse_frontmatter(saved_content)
        self.assertEqual(parsed_yaml["title"], "Sprint Architecture Review!")
        self.assertEqual(parsed_yaml["status"], "draft")
        self.assertTrue(body.startswith("## Description"))
        self.assertIn("Initial architectural review notes.", body)
    def test_move_tree_contents_self_move_immunity_and_volume_disjointness(self):
        """move_tree_contents never deletes files when src_dir == dst_dir, and mount_volumes is idempotent."""
        target_dir = Path(agent_bp._resolve_volume_dir(self.workspace_id, "workflows", agent_bp.volumes["workflows"]))
        target_dir.mkdir(parents=True, exist_ok=True)
        sentinel = target_dir / "workflow_morning_briefing_context.txt"
        sentinel.write_text("Morning briefing payload", encoding="utf-8")

        # 1. Direct self-move call must be a safe no-op
        move_tree_contents(target_dir, target_dir)
        self.assertTrue(sentinel.exists(), "move_tree_contents must never delete files when src_dir == dst_dir")

        # 2. Repeated mount_volumes and get_context calls must preserve files in .insetu/cache/agent
        agent_bp.mount_volumes(self.workspace_id, force=True)
        agent_bp.mount_volumes(self.workspace_id)
        _ = agent_bp.get_context(self.workspace_id)
        self.assertTrue(sentinel.exists(), "agent_bp.mount_volumes must preserve compiled workflow cache files")

        # 3. Verify no extension declares a legacy_dir that resolves to its own target cache/data directory
        for ext_bp in (gather_bp, agent_bp):
            for vol_name, vol_spec in (ext_bp.volumes or {}).items():
                t_dir = Path(ext_bp._resolve_volume_dir(self.workspace_id, vol_name, vol_spec)).resolve()
                for rel_legacy in (vol_spec.get("legacy_dirs") or []):
                    l_dir = self.control_dir.joinpath(*Path(rel_legacy).parts).resolve()
                    self.assertNotEqual(
                        l_dir,
                        t_dir,
                        f"Extension '{ext_bp.name}' volume '{vol_name}' declares legacy_dir '{rel_legacy}' equal to target_dir!",
                    )

    def test_flow_two_phase_incremental_skip_zero_vfs_reads(self):
        """_background_compile_routine_workflows short-circuits untouched routine batches on disk before calling ctx.vfs.read."""
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, self.workspace_id)
        repo_dir = self.root_path / "alpha"
        repo_dir.mkdir(parents=True, exist_ok=True)
        (repo_dir / "note.md").write_text("# Briefing Note", encoding="utf-8")

        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".md"]}],
            }),
            encoding="utf-8",
        )
        akasa_utils.load_config.clear_all()
        mount_topology_volumes_dynamically(load_config(self.workspace_id), workspace_id=self.workspace_id)

        ctx = agent_bp.get_context(self.workspace_id)
        ctx.vfs.save(
            "ctx://routines/morning_briefing.md",
            "---\nid: morning_briefing\ntitle: Morning Briefing\ndomain: Workflows\nincludes:\n  - vfs://alpha/note.md\n---\n",
        )
        sync_vfs_barrier(self.workspace_id)

        # 1. Initial compile writes workflow_morning_briefing_context.txt to disk and manifest
        res1 = _background_compile_routine_workflows(ctx, force_full=True)
        sync_vfs_barrier(self.workspace_id)
        base_uri = "ctx://workflows/workflow_morning_briefing_context.txt"
        self.assertIn(base_uri, res1["artifact"]["files"])
        self.assertTrue(ctx.is_context_on_disk(base_uri))

        # 2. Second incremental run with empty touched_buckets / touched_diffs must perform ZERO vfs.read calls on chunks
        fresh_ctx = agent_bp.get_context(self.workspace_id)
        with patch.object(fresh_ctx.vfs, "read", wraps=fresh_ctx.vfs.read) as spy_read:
            _background_compile_routine_workflows(
                fresh_ctx,
                force_full=False,
                chain_state={"touched_buckets": [], "touched_diffs": []},
                ledger_events=[],
            )
            chunk_reads = [c for c in spy_read.call_args_list if c.args and c.args[0] == "vfs://alpha/note.md"]
            self.assertEqual(len(chunk_reads), 0, "Untouched routine workflow batch on disk must skip VFS file reads")

        # 3. If physical workflow file is wiped from cache, has_missing_domain_artifacts self-heals it
        phys_wf = Path(fresh_ctx.resolve_path(base_uri))
        phys_wf.unlink()
        self.assertFalse(fresh_ctx.is_context_on_disk(base_uri))
        _background_compile_routine_workflows(
            agent_bp.get_context(self.workspace_id),
            force_full=False,
            chain_state={"touched_buckets": [], "touched_diffs": []},
            ledger_events=[],
        )
        sync_vfs_barrier(self.workspace_id)
        self.assertTrue(phys_wf.exists(), "Missing workflow artifact on disk must auto-heal on next compile")

    def test_python_fitness_linter_catches_redundant_mounts_and_dead_hooks(self):
        """BackendFitnessVisitor flags manual .mount_volumes() calls, manual move_tree_contents(), and dead @on('compile_contexts') hooks."""
        prev = FitnessState.violations_found
        FitnessState.violations_found = 0
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                check_python_files()
            self.assertEqual(
                FitnessState.violations_found,
                0,
                f"Existing Python codebase had fitness violations:\n{buf.getvalue()}",
            )
            # Note: Includes legacy patterns (insetu.core.gather.languages shim imports, duplicate AST helpers,
            # and unused private helpers) specifically to ensure our fitness suite finds and forces their removal.
            bad_code = (
                "from flask import jsonify\n"
                "from insetu.core.sdk import InSetuExtension\n"
                "from insetu.core.gather.engine_gather import _pack_selection_worker\n"
                "from insetu.core.gather.languages import get_language_provider\n"
                "demo_bp = InSetuExtension('demo', __name__)\n"
                "__depends__ = []\n"
                "def bad_init():\n"
                "    demo_bp.mount_volumes(workspace_id='default')\n"
                "@demo_bp.route('list', methods=['GET'])\n"
                "def bad_route(ctx):\n"
                "    _ = ctx.req.args.get('q')\n"
                "    return jsonify({'ok': True})\n"
                "@demo_bp.route('caller', methods=['POST'])\n"
                "def caller_route(ctx):\n"
                "    return bad_route(ctx)\n"
                "@demo_bp.on('compile_contexts')\n"
                "def dead_hook(manifest, **kwargs):\n"
                "    pass\n"
                "@demo_bp.worker('bad_worker')\n"
                "def untyped_worker(ctx, force_full=False):\n"
                "    if isinstance(force_full, list):\n"
                "        pass\n"
                "def bad_selection_loop(ctx, items):\n"
                "    for entry in items:\n"
                "        _ = entry.get('filepath')\n"
                "def good_internal_dict_loop(working_set):\n"
                "    return {item['filepath']: item for item in working_set if item.get('filepath')}\n"
                "def _unused_private_helper(x):\n"
                "    return x + 1\n"
                "def _find_brace_balanced_end(lines, start_idx):\n"
                "    return _unused_private_helper(start_idx)\n"
            )
            fake_path = Path(__file__).resolve().parent.parent.parent / "insetu" / "extensions" / "demo" / "engine_demo.py"
            tree = ast.parse(bad_code, filename=str(fake_path))
            buf_bad = io.StringIO()
            with contextlib.redirect_stdout(buf_bad):
                visitor = BackendFitnessVisitor(fake_path, "engine_demo.py", is_test=False)
                visitor.visit(tree)
            out_bad = buf_bad.getvalue()
            self.assertIn("REDUNDANT_VOLUME_MOUNT_BAN", out_bad)
            self.assertIn("DEAD_COMPILE_CONTEXTS_HOOK_BAN", out_bad)
            self.assertIn("WORKER_TYPED_SIGNATURE_MANDATE", out_bad)
            self.assertIn("WORKER_PARAMETER_OVERLOAD_BAN", out_bad)
            self.assertIn("FLASK_TRANSPORT_LEAK_BAN", out_bad)
            self.assertIn("CROSS_MODULE_PRIVATE_IMPORT_BAN", out_bad)
            self.assertIn("DIRECT_ROUTE_FUNCTION_CALL_BAN", out_bad)
            self.assertIn("DEAD_PRIVATE_HELPER_BAN", out_bad)
            self.assertIn("LEGACY_GATHER_LANGUAGES_IMPORT_BAN", out_bad)
            self.assertIn("DUPLICATE_LANGUAGE_AST_HELPER_BAN", out_bad)
            self.assertEqual(out_bad.count("SELECTION_EXPANSION_MANDATE"), 1, out_bad)
        finally:
            FitnessState.violations_found = prev
    def test_capability_registry_and_in_process_ctx_call(self):
        """get_registered_capabilities indexes @route capabilities and ctx.call() executes them in-process returning native dicts."""
        caps = get_registered_capabilities()
        self.assertIn("system.topology", caps)
        self.assertIn("gather.repos.template", caps)

        sys_ctx = system_bp.get_context(self.workspace_id)
        tpl = sys_ctx.call("gather.repos.template")
        self.assertIsInstance(tpl, dict)
        self.assertIn("sub_buckets", tpl)
        self.assertIn("apply_ignore", tpl)

    def test_llm_and_bridge_capability_dispatch(self):
        """ctx.call('llm.complete') aggregates inference and ctx.call('bridge.sync') executes VFS patches in-process."""
        apply_declarative_schema("bridge", BRIDGE_SCHEMA, self.workspace_id)
        apply_declarative_schema("topology", TOPOLOGY_SCHEMA, self.workspace_id)

        repo_dir = self.root_path / "alpha"
        repo_dir.mkdir(parents=True, exist_ok=True)
        target_file = repo_dir / "service.py"
        target_file.write_text("port = 5000\n", encoding="utf-8")

        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config", "llm", "bridge"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".py"]}],
            }),
            encoding="utf-8",
        )
        akasa_utils.load_config.clear_all()
        mount_topology_volumes_dynamically(load_config(self.workspace_id), workspace_id=self.workspace_id)

        sys_ctx = system_bp.get_context(self.workspace_id)
        llm_ctx = llm_bp.get_context(self.workspace_id)
        llm_ctx.settings.set("api_key", "mock-test-key")

        # 1. Test ctx.call("llm.complete")
        mock_chunks = [
            'data: {"text": "Here is the patch:\\n"}\n\n',
            'data: {"text": "<<<<<<< FILE: vfs://alpha/service.py\\n<<<<<<< SEARCH\\nport = 5000\\n=======\\nport = 8080\\n>>>>>>> REPLACE"}\n\n',
            'data: [DONE]\n\n',
        ]
        with patch("insetu.core.llm.engine_llm._stream_anthropic", return_value=iter(mock_chunks)):
            res = sys_ctx.call("llm.complete", messages=[{"role": "user", "content": "Update port to 8080"}])
            self.assertIsInstance(res, dict)
            self.assertIn("port = 8080", res.get("text", ""))
            self.assertEqual(res.get("provider"), "anthropic")

        # 2. Test ctx.call("bridge.sync")
        patch_text = (
            "<<<<<<< FILE: vfs://alpha/service.py\n"
            "<<<<<<< SEARCH\n"
            "port = 5000\n"
            "=======\n"
            "port = 8080\n"
            ">>>>>>> REPLACE"
        )
        bridge_res = sys_ctx.call(
            "bridge.sync",
            text=patch_text,
            active_files=["vfs://alpha/service.py"],
            dry_run=False,
            wait=True,
        )
        self.assertIsInstance(bridge_res, dict)
        self.assertTrue(bridge_res.get("can_commit"))
        self.assertEqual(bridge_res.get("summary", {}).get("resolved"), 1)
        sync_vfs_barrier(self.workspace_id)
        self.assertEqual(target_file.read_text(encoding="utf-8"), "port = 8080\n")

    def test_agent_turn_react_worker_chain(self):
        """_execute_agent_turn orchestrates context packing, LLM inference, and Yomama patch verification via capability calls."""
        apply_declarative_schema("agent", AGENT_SCHEMA, self.workspace_id)
        apply_declarative_schema("bridge", BRIDGE_SCHEMA, self.workspace_id)
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, self.workspace_id)

        repo_dir = self.root_path / "alpha"
        repo_dir.mkdir(parents=True, exist_ok=True)
        file_path = repo_dir / "calc.py"
        file_path.write_text("def add(a, b):\n    return a - b\n", encoding="utf-8")

        agent_ctx = agent_bp.get_context(self.workspace_id)
        agent_ctx.db.insert_or_replace("chat_sessions", {
            "session_id": "ses_test",
            "title": "Fix Math",
            "updated_at": time.time(),
        })

        mock_patch_reply = (
            "I will fix the subtraction operator.\n\n"
            "<<<<<<< FILE: vfs://alpha/calc.py\n"
            "<<<<<<< SEARCH\n"
            "def add(a, b):\n"
            "    return a - b\n"
            "=======\n"
            "def add(a, b):\n"
            "    return a + b\n"
            ">>>>>>> REPLACE"
        )
        def fake_call(cap_name, **kwargs):
            if cap_name == "gather.pack_selection":
                return {"base_filename": "ctx://contexts/test_ctx.txt"}
            elif cap_name == "llm.complete":
                return {"text": mock_patch_reply}
            elif cap_name == "bridge.sync":
                return {"can_commit": True, "patches": []}
            return {}

        with patch.object(agent_ctx, "call", side_effect=fake_call), \
            patch.object(agent_ctx, "read_compiled_context", return_value="def add(a, b): ..."):
            result = _execute_agent_turn(
                agent_ctx,
                session_id="ses_test",
                user_prompt="Fix add function in vfs://alpha/calc.py",
                attached_files=["vfs://alpha/calc.py"],
            )

        self.assertEqual(result["message"], "Turn complete.")
        self.assertEqual(result["artifact"]["committed_files"], ["vfs://alpha/calc.py"])
        cursor = agent_ctx.db.execute("SELECT * FROM chat_messages WHERE session_id=?", ("ses_test",))
        messages = [dict(r) for r in cursor.fetchall()]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["role"], "assistant")
        self.assertIn("I will fix the subtraction operator.", messages[0]["content"])
        self.assertIn("Applied patches to 1 file(s).", messages[0]["content"])
        self.assertIn("def add(a, b):", messages[0]["raw_content"])

    def test_extension_dependency_resolution_and_whitelist_installer(self):
        """resolve_external_dependency_spec maps import names to PyPI names and _background_install_extension_deps enforces the extension whitelist."""
        # 1. Specifier normalization (import_spec vs pypi_package)
        self.assertEqual(resolve_external_dependency_spec("flask-sock"), ("flask_sock", "flask-sock"))
        self.assertEqual(resolve_external_dependency_spec("bs4"), ("bs4", "beautifulsoup4"))
        self.assertEqual(resolve_external_dependency_spec("beautifulsoup4"), ("bs4", "beautifulsoup4"))
        self.assertEqual(resolve_external_dependency_spec("semantic_release"), ("semantic_release", "python-semantic-release"))

        # 2. Whitelist extraction across bundled extensions
        self.assertEqual(_get_whitelisted_extension_packages("ingest"), ["beautifulsoup4", "markdownify"])
        self.assertEqual(_get_whitelisted_extension_packages("research"), ["beautifulsoup4", "playwright"])
        self.assertEqual(_get_whitelisted_extension_packages("format"), ["jsbeautifier", "autopep8"])
        self.assertEqual(_get_whitelisted_extension_packages("term"), ["flask-sock"])
        self.assertEqual(_get_whitelisted_extension_packages("nonexistent_ext"), [])

        # 3. Rejects un-whitelisted extensions
        sys_ctx = system_bp.get_context(self.workspace_id)
        with self.assertRaises(ValueError):
            _background_install_extension_deps(sys_ctx, ext_name="notes")
        # 4. Executes pip install for whitelisted extension packages via ctx.exec.run
        fake_res = MagicMock(returncode=0, stdout="Successfully installed mistune", stderr="")
        with patch("importlib.util.find_spec", return_value=None), patch.object(sys_ctx.exec, "run", return_value=fake_res) as mock_run:
            result = _background_install_extension_deps(sys_ctx, ext_name="freshdesk")
            self.assertEqual(result["artifact"]["installed"], ["mistune"])
            self.assertFalse(result["artifact"]["requires_reboot"])
            mock_run.assert_called_once()
            called_cmd = mock_run.call_args[0][0]
            self.assertIn("pip", called_cmd)
            self.assertIn("install", called_cmd)
            self.assertIn("mistune", called_cmd)

        # 5. Executes declarative post_install_commands (e.g., playwright install chromium for research)
        with patch("importlib.util.find_spec", return_value=None), patch.object(sys_ctx.exec, "run", return_value=fake_res) as mock_run_research:
            res_research = _background_install_extension_deps(sys_ctx, ext_name="research")
            self.assertEqual(res_research["artifact"]["installed"], ["beautifulsoup4", "playwright"])
            self.assertEqual(mock_run_research.call_count, 2)
            post_cmd = mock_run_research.call_args_list[1][0][0]
            self.assertIn("playwright", post_cmd)
            self.assertIn("chromium", post_cmd)


if __name__ == "__main__":
    unittest.main()