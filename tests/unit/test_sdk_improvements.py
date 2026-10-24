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
from insetu.core.sdk import InSetuExtension, ExtensionContext, resolve_external_dependency_spec
from insetu.core.system.engine_system import (
    _get_whitelisted_extension_packages,
    _background_install_extension_deps,
    system_bp,
)
from insetu.core.system.legacy import move_tree_contents
from insetu.core.utils_core import parse_frontmatter, get_domain_cache_path, get_domain_data_path
from insetu.core.gather.engine_gather import gather_bp, VFS_INDEX_SCHEMA
from insetu.extensions.flow.engine_flow import flow_bp, _background_compile_workflows
from akasa.db import apply_declarative_schema
from akasa.vfs import sync_vfs_barrier
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
        target_dir = Path(flow_bp._resolve_volume_dir(self.workspace_id, "workflows", flow_bp.volumes["workflows"]))
        target_dir.mkdir(parents=True, exist_ok=True)
        sentinel = target_dir / "workflow_morning_briefing_context.txt"
        sentinel.write_text("Morning briefing payload", encoding="utf-8")

        # 1. Direct self-move call must be a safe no-op
        move_tree_contents(target_dir, target_dir)
        self.assertTrue(sentinel.exists(), "move_tree_contents must never delete files when src_dir == dst_dir")

        # 2. Repeated mount_volumes and get_context calls must preserve files in .insetu/cache/flow
        flow_bp.mount_volumes(self.workspace_id, force=True)
        flow_bp.mount_volumes(self.workspace_id)
        _ = flow_bp.get_context(self.workspace_id)
        self.assertTrue(sentinel.exists(), "flow_bp.mount_volumes must preserve compiled workflow cache files")

        # 3. Verify no extension declares a legacy_dir that resolves to its own target cache/data directory
        for ext_bp in (gather_bp, flow_bp):
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
        """_background_compile_workflows short-circuits untouched batches on disk before calling ctx.vfs.read."""
        apply_declarative_schema("vfs_index", VFS_INDEX_SCHEMA, self.workspace_id)
        repo_dir = self.root_path / "alpha"
        repo_dir.mkdir(parents=True, exist_ok=True)
        (repo_dir / "note.md").write_text("# Briefing Note", encoding="utf-8")

        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config", "flow"],
                "target_repos": [{"repo_dir": "alpha", "title": "Alpha", "exts": [".md"]}],
            }),
            encoding="utf-8",
        )
        akasa_utils.load_config.clear_all()
        from insetu.core.topology.engine_topology import mount_topology_volumes_dynamically as _mount_top
        _mount_top(load_config(self.workspace_id), workspace_id=self.workspace_id)

        ctx = flow_bp.get_context(self.workspace_id)
        ctx.store.set("workflows.json", "context_batches", [{
            "id": "morning_briefing",
            "title": "Morning Briefing",
            "domain": "Workflows",
            "includes": ["vfs://alpha/note.md"],
        }])
        sync_vfs_barrier(self.workspace_id)

        # 1. Initial compile writes workflow_morning_briefing_context.txt to disk and manifest
        res1 = _background_compile_workflows(ctx, force_full=True)
        sync_vfs_barrier(self.workspace_id)
        base_uri = "ctx://workflows/workflow_morning_briefing_context.txt"
        self.assertIn(base_uri, res1["artifact"]["files"])
        self.assertTrue(ctx.is_context_on_disk(base_uri))

        # 2. Second incremental run with empty touched_buckets / touched_diffs must perform ZERO vfs.read calls on chunks
        fresh_ctx = flow_bp.get_context(self.workspace_id)
        with patch.object(fresh_ctx.vfs, "read", wraps=fresh_ctx.vfs.read) as spy_read:
            _background_compile_workflows(
                fresh_ctx,
                force_full=False,
                chain_state={"touched_buckets": [], "touched_diffs": []},
                ledger_events=[],
            )
            chunk_reads = [c for c in spy_read.call_args_list if c.args and c.args[0] == "vfs://alpha/note.md"]
            self.assertEqual(len(chunk_reads), 0, "Untouched workflow batch on disk must skip VFS file reads")

        # 3. If physical workflow file is wiped from cache, has_missing_domain_artifacts self-heals it
        phys_wf = Path(fresh_ctx.resolve_path(base_uri))
        phys_wf.unlink()
        self.assertFalse(fresh_ctx.is_context_on_disk(base_uri))
        _background_compile_workflows(
            flow_bp.get_context(self.workspace_id),
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
            bad_code = (
                "from insetu.core.sdk import InSetuExtension\n"
                "demo_bp = InSetuExtension('demo', __name__)\n"
                "__depends__ = []\n"
                "def bad_init():\n"
                "    demo_bp.mount_volumes(workspace_id='default')\n"
                "@demo_bp.on('compile_contexts')\n"
                "def dead_hook(manifest, **kwargs):\n"
                "    pass\n"
                "@demo_bp.worker('bad_worker')\n"
                "def untyped_worker(ctx, force_full=False):\n"
                "    if isinstance(force_full, list):\n"
                "        pass\n"
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
        finally:
            FitnessState.violations_found = prev

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