"""Workspace extensions in .insetu/extensions/ may be written by anyone, but insetu runs only files a person approved (S8)."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

import akasa
import akasa.utils as akasa_utils
from akasa.extension import _CAPABILITY_REGISTRY
import insetu.app as insetu_app
from insetu.core.system import ext_manager as utils_core
from insetu.core.agent.orchestrator import ROUTINE_BANNED_CAPABILITIES
from insetu.core.bridge.bridge_vfs import _is_banned_bridge_target
from insetu.core.sdk import InSetuURI
from insetu.core.system import ext_manager as engine_system

ENGINE_SRC = '''from insetu.core.sdk import InSetuExtension
__depends__ = []
hello_bp = InSetuExtension('hello', __name__, title="Hello")


@hello_bp.route('ping', methods=['GET'], docstring="[sync] Says pong.")
def ping(ctx):
    return {"pong": True}
'''


class TestWorkspaceExtensionApproval(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")
        (self.control_dir / "host.json").write_text(json.dumps({"port": 5005}), encoding="utf-8")
        (self.control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({"workspace_root": self.root_path.as_posix(), "extensions": ["config"], "target_repos": []}),
            encoding="utf-8",
        )
        self.ext_dir = self.control_dir / "extensions" / "hello"
        self.ext_dir.mkdir(parents=True)
        (self.ext_dir / "engine_hello.py").write_text(ENGINE_SRC, encoding="utf-8")
        (self.ext_dir / "ext_hello.js").write_text("export const hello = 1;\n", encoding="utf-8")
        self.hook_patch = patch.object(insetu_app.hooks, "emit")
        self.hook_patch.start()
        self.orig_app = insetu_app.app

    def tearDown(self):
        insetu_app.app = self.orig_app
        self.hook_patch.stop()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def _boot(self):
        test_app = Flask(f"workspace_ext_{id(self)}")
        insetu_app.app = test_app
        insetu_app.load_workspace_extensions()
        return test_app

    def _approve_current(self):
        utils_core.approve_workspace_extension("hello", utils_core.snapshot_workspace_extension(self.ext_dir))

    def test_unapproved_extension_is_neither_imported_nor_served(self):
        booted = self._boot()
        self.assertNotIn("hello", booted.blueprints)
        self.assertEqual(booted._workspace_extensions["hello"]["status"], "unapproved")
        self.assertFalse(booted._workspace_extensions["hello"]["loaded"])
        self.assertIsNone(insetu_app._resolve_workspace_ext_dir("hello"))

    def test_approved_extension_loads_and_stops_being_served_once_edited(self):
        self._approve_current()
        booted = self._boot()
        self.assertIn("hello", booted.blueprints)
        self.assertTrue(booted._workspace_extensions["hello"]["loaded"])
        self.assertEqual(insetu_app._resolve_workspace_ext_dir("hello"), self.ext_dir.resolve())
        (self.ext_dir / "ext_hello.js").write_text("export const hello = 2;\n", encoding="utf-8")
        self.assertIsNone(insetu_app._resolve_workspace_ext_dir("hello"))
        entry = utils_core.scan_workspace_extensions()["hello"]
        self.assertEqual(entry["status"], "changed")
        self.assertEqual(entry["file_changes"], [{"path": "ext_hello.js", "change": "changed"}])
        self.assertNotIn("hello", self._boot().blueprints)

    def test_added_files_need_approval_too(self):
        self._approve_current()
        (self.ext_dir / "helper.py").write_text("X = 1\n", encoding="utf-8")
        entry = utils_core.scan_workspace_extensions()["hello"]
        self.assertEqual(entry["status"], "changed")
        self.assertEqual(entry["file_changes"], [{"path": "helper.py", "change": "added"}])

    def test_symbolic_links_and_built_in_names_are_never_loaded(self):
        self._approve_current()
        (self.ext_dir / "linked.js").symlink_to(self.control_dir / "host.json")
        self.assertEqual(utils_core.scan_workspace_extensions()["hello"]["status"], "invalid")
        notes_dir = self.control_dir / "extensions" / "notes"
        notes_dir.mkdir()
        (notes_dir / "engine_notes.py").write_text("__depends__ = []\n", encoding="utf-8")
        utils_core.approve_workspace_extension("notes", utils_core.snapshot_workspace_extension(notes_dir))
        entry = utils_core.scan_workspace_extensions()["notes"]
        self.assertEqual(entry["status"], "invalid")
        self.assertIn("built-in", entry["reason"])
        booted = self._boot()
        self.assertNotIn("hello", booted.blueprints)
        self.assertFalse(booted._workspace_extensions["notes"]["loaded"])

    def test_approval_needs_the_fingerprint_the_person_reviewed(self):
        reviewed = utils_core.snapshot_workspace_extension(self.ext_dir)["fingerprint"]
        (self.ext_dir / "engine_hello.py").write_text(ENGINE_SRC + "\nEXTRA = 1\n", encoding="utf-8")
        body, code = engine_system.api_workspace_extension_approve.__wrapped__(SimpleNamespace(payload={"name": "hello", "fingerprint": reviewed}))
        self.assertEqual(code, 409)
        self.assertNotIn("hello", utils_core.get_workspace_extension_approvals())
        current = utils_core.snapshot_workspace_extension(self.ext_dir)["fingerprint"]
        result = engine_system.api_workspace_extension_approve.__wrapped__(SimpleNamespace(payload={"name": "hello", "fingerprint": current}))
        self.assertEqual(result["status"], "approved")
        self.assertTrue(result["requires_reboot"])
        self.assertEqual(utils_core.scan_workspace_extensions()["hello"]["status"], "approved")
        revoked = engine_system.api_workspace_extension_revoke.__wrapped__(SimpleNamespace(payload={"name": "hello"}))
        self.assertEqual(revoked["status"], "revoked")
        self.assertEqual(utils_core.scan_workspace_extensions()["hello"]["status"], "unapproved")

    def test_only_a_person_can_approve(self):
        self.assertIn("system.extensions.workspace.approve", ROUTINE_BANNED_CAPABILITIES)
        self.assertIn("system.extensions.workspace.revoke", ROUTINE_BANNED_CAPABILITIES)
        for cap_id in ("system.extensions.workspace.approve", "system.extensions.workspace.revoke"):
            self.assertIs(_CAPABILITY_REGISTRY[cap_id]["mcp_expose"], False, cap_id)

    def test_bridge_may_write_extension_files(self):
        uri = InSetuURI("vfs://alpha/.insetu/extensions/hello/engine_hello.py")
        self.assertIsNone(_is_banned_bridge_target(uri, f"{uri.repo}/{uri.path}"))


if __name__ == "__main__":
    unittest.main()
