"""Repeater secrets are read only from their own scope, so one workspace never reads another's."""
import json
import os
import tempfile
import unittest
from pathlib import Path

import akasa
import akasa.utils as akasa_utils

from insetu.core import utils_core


class TestRepeaterSecretScopes(unittest.TestCase):
    """A secret is read only from where its scope writes it, so one workspace never sees another's."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name).resolve()
        control_dir = root / ".insetu"
        workspaces = {"default": {"config_path": "config.json"}}
        for wid in ("alpha", "beta"):
            (control_dir / "tenants" / wid).mkdir(parents=True)
            workspaces[wid] = {"config_path": f"tenants/{wid}/config.json"}
        (control_dir / "workspaces.json").write_text(
            json.dumps({"workspaces": workspaces, "active_workspace": "default"}), encoding="utf-8"
        )
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=root.as_posix(), control_dir=".insetu")

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_workspace_secret_stays_in_its_workspace(self):
        utils_core.set_repeater_secret("search", "alpha", "providers", "web", "api_key", "alpha-key", scope="workspace")
        self.assertEqual(utils_core.get_repeater_secret("search", "alpha", "providers", "web", "api_key", scope="workspace"), "alpha-key")
        self.assertEqual(utils_core.get_repeater_secret("search", "beta", "providers", "web", "api_key", scope="workspace"), "")

    def test_daemon_secret_is_not_a_fallback_for_workspace_reads(self):
        utils_core.set_repeater_secret("search", "alpha", "providers", "web", "api_key", "daemon-key", scope="daemon")
        self.assertEqual(utils_core.get_repeater_secret("search", "beta", "providers", "web", "api_key", scope="daemon"), "daemon-key")
        self.assertEqual(utils_core.get_repeater_secret("search", "beta", "providers", "web", "api_key", scope="workspace"), "")

    def test_scope_must_be_stated(self):
        with self.assertRaises(TypeError):
            utils_core.get_repeater_secret("search", "alpha", "providers", "web", "api_key")
        with self.assertRaises(TypeError):
            utils_core.set_repeater_secret("search", "alpha", "providers", "web", "api_key", "x")


if __name__ == "__main__":
    unittest.main()
