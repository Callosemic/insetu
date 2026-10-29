import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import insetu.fallback_bridge as lifeboat


class TestLifeboatTargets(unittest.TestCase):
    """The lifeboat resolves vfs:// patch targets like the main bridge and never writes outside the workspace."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name).resolve()
        self.root = base / "workspace"
        self.external = base / "elsewhere" / "beta_checkout"
        (self.root / ".insetu").mkdir(parents=True)
        (self.root / "alpha" / "pkg").mkdir(parents=True)
        self.external.mkdir(parents=True)
        (self.root / "alpha" / "pkg" / "mod.py").write_text("VALUE = 1\n", encoding="utf-8")
        (self.external / "lib.py").write_text("NAME = 'old'\n", encoding="utf-8")
        (self.root / ".insetu" / "workspaces.json").write_text(
            json.dumps({"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}),
            encoding="utf-8",
        )
        (self.root / ".insetu" / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root.as_posix(),
                "target_repos": [
                    {"repo_dir": "alpha"},
                    {"repo_dir": "beta", "physical_path": self.external.as_posix()},
                ],
            }),
            encoding="utf-8",
        )
        self.orig_cwd = os.getcwd()
        os.chdir(self.root)
        self.env_patch = patch.dict(os.environ, {"AKASA_BOOT_TOKEN": "lifeboat-targets-token"})
        self.env_patch.start()
        lifeboat._LIFEBOAT_TOKEN = None
        self.client = lifeboat.app.test_client()

    def tearDown(self):
        lifeboat._LIFEBOAT_TOKEN = None
        self.env_patch.stop()
        os.chdir(self.orig_cwd)
        self.temp_dir.cleanup()

    def _sync(self, header, search, replace):
        text = f"<<<<<<< FILE: {header}\n<<<<<<< SEARCH\n{search}\n=======\n{replace}\n>>>>>>> REPLACE"
        return self.client.post(
            "/api/bridge/sync", json={"text": text}, headers={"X-InSetu-Token": "lifeboat-targets-token"}
        ).get_data(as_text=True)

    def test_vfs_target_resolves_through_repo_dir(self):
        log = self._sync("vfs://alpha/pkg/mod.py", "VALUE = 1", "VALUE = 2")
        self.assertIn("Successfully patched", log)
        self.assertEqual((self.root / "alpha" / "pkg" / "mod.py").read_text(encoding="utf-8"), "VALUE = 2\n")

    def test_vfs_target_honors_physical_path(self):
        log = self._sync("vfs://beta/lib.py", "NAME = 'old'", "NAME = 'new'")
        self.assertIn("Successfully patched", log)
        self.assertEqual((self.external / "lib.py").read_text(encoding="utf-8"), "NAME = 'new'\n")

    def test_plain_relative_path_still_works(self):
        log = self._sync("alpha/pkg/mod.py", "VALUE = 1", "VALUE = 3")
        self.assertIn("Successfully patched", log)

    def test_writes_outside_the_workspace_are_refused(self):
        outside = Path(self.temp_dir.name).resolve() / "evil.py"
        for header in ("vfs://alpha/../../evil.py", "../evil.py", outside.as_posix(), "ctx://routines/x.md"):
            with self.subTest(header=header):
                log = self._sync(header, "", "PWNED = True")
                self.assertNotIn("Successfully patched", log)
                self.assertFalse(outside.exists())


if __name__ == "__main__":
    unittest.main()
