"""Behavioral unit tests verifying Two-Tier DAG-Aware Fault Quarantine across Tier 2 Core modules and Tier 3 extensions."""

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from flask import Flask
import akasa
import akasa.utils as akasa_utils
import insetu.app as insetu_app
from insetu.core.sdk import get_workspace_physics
from insetu.core.system.ext_manager import approve_workspace_extension, snapshot_workspace_extension


class TestDagFaultQuarantine(unittest.TestCase):
    """Verifies that a fault in a non-foundational Core module or Tier 3 extension quarantines only its DAG dependents."""

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
            json.dumps({"workspace_root": self.root_path.as_posix(), "extensions": ["config", "notes", "git"], "target_repos": []}),
            encoding="utf-8",
        )
        self.hook_patch = patch.object(insetu_app.hooks, "emit")
        self.hook_patch.start()

    def tearDown(self):
        os.environ.pop("INSETU_SIMULATE_QUARANTINE", None)
        insetu_app.load_workspace_extensions()
        self.hook_patch.stop()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_core_gather_fault_pauses_tier3_and_keeps_bridge_and_fs_online(self):
        test_app = Flask("quarantine_core_test")
        orig_app = insetu_app.app
        try:
            insetu_app.app = test_app
            os.environ["INSETU_SIMULATE_QUARANTINE"] = "gather"
            insetu_app.load_workspace_extensions()

            quarantined = getattr(test_app, "_quarantined_modules", {})
            self.assertTrue(getattr(test_app, "_degraded_core", False))
            self.assertIn("gather", quarantined)
            self.assertEqual(quarantined["gather"]["status"], "quarantined")
            # Dependent core modules (agent, mcp) and all Tier 3 extensions (notes, git) are skipped
            self.assertIn("agent", quarantined)
            self.assertEqual(quarantined["agent"]["status"], "skipped")
            self.assertIn("mcp", quarantined)
            self.assertIn("notes", quarantined)
            self.assertEqual(quarantined["notes"]["status"], "skipped")
            self.assertNotIn("notes", test_app.blueprints)
            # Independent core modules (system, topology, fs, editor, bridge, llm) still mount!
            for healthy_core in ("system", "topology", "fs", "editor", "bridge", "llm"):
                self.assertIn(healthy_core, test_app.blueprints)
                self.assertNotIn(healthy_core, quarantined)
        finally:
            insetu_app.app = orig_app
            os.environ.pop("INSETU_SIMULATE_QUARANTINE", None)

    def test_tier3_extension_fault_isolates_only_that_extension(self):
        test_app = Flask("quarantine_ext_test")
        orig_app = insetu_app.app
        try:
            insetu_app.app = test_app
            os.environ["INSETU_SIMULATE_QUARANTINE"] = "notes"
            insetu_app.load_workspace_extensions()

            quarantined = getattr(test_app, "_quarantined_modules", {})
            self.assertFalse(getattr(test_app, "_degraded_core", False))
            self.assertIn("notes", quarantined)
            self.assertEqual(quarantined["notes"]["tier"], "ext")
            self.assertNotIn("notes", test_app.blueprints)
            # Unrelated sibling Tier 3 extension ('git') mounts normally alongside all Tier 2 Core modules
            self.assertIn("git", test_app.blueprints)
            self.assertNotIn("git", quarantined)
            for core_mod in ("system", "topology", "fs", "editor", "gather", "bridge", "llm", "agent", "mcp"):
                self.assertIn(core_mod, test_app.blueprints)
        finally:
            insetu_app.app = orig_app
            os.environ.pop("INSETU_SIMULATE_QUARANTINE", None)

    def test_workspace_extension_ast_fitness_gate_blocks_membrane_violation(self):
        _, ws_root = get_workspace_physics()
        rogue_dir = Path(ws_root) / ".insetu" / "extensions" / "rogue_ext"
        rogue_dir.mkdir(parents=True, exist_ok=True)
        (rogue_dir / "engine_rogue_ext.py").write_text(
            "import akasa.db\n__depends__ = []\n",
            encoding="utf-8",
        )
        # Only approved extensions are parsed at all, so approve it to reach the hygiene check.
        approve_workspace_extension("rogue_ext", snapshot_workspace_extension(rogue_dir))
        test_app = Flask("quarantine_rogue_test")
        orig_app = insetu_app.app
        try:
            insetu_app.app = test_app
            insetu_app.load_workspace_extensions()
            quarantined = getattr(test_app, "_quarantined_modules", {})
            self.assertIn("rogue_ext", quarantined)
            self.assertIn("AKASA_MEMBRANE_ISOLATION", quarantined["rogue_ext"]["reason"])
            self.assertNotIn("rogue_ext", test_app.blueprints)
        finally:
            insetu_app.app = orig_app
            shutil.rmtree(rogue_dir.as_posix(), ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
