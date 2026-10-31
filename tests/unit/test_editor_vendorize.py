"""S4: editor/vendorize resolves language packs locally (bundled, then the workspace vendor folder) and never downloads code."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
from flask import Flask
from insetu.core.editor.engine_editor import editor_bp


class TestEditorVendorize(unittest.TestCase):
    """Bundled and local packs resolve; unknown packs are not downloaded; invalid names are refused."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name).resolve()
        (root / ".insetu").mkdir()
        (root / ".insetu" / "config.json").write_text(json.dumps({"workspace_root": root.as_posix(), "extensions": ["config"]}), encoding="utf-8")
        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.env_patch = patch.dict(os.environ, {"AKASA_CONFIG": (root / ".insetu" / "config.json").as_posix()})
        self.env_patch.start()
        akasa.reset_state(cwd=root.as_posix(), control_dir=".insetu")
        app = Flask(__name__)
        app.register_blueprint(editor_bp.bp)
        self.client = app.test_client()
        self.local_dir = Path(editor_bp.get_context("default").paths["artifacts_base"]).joinpath("vendor", "codemirror")

    def tearDown(self):
        self.env_patch.stop()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=".insetu")
        self.temp_dir.cleanup()

    def _vendorize(self, mode):
        return self.client.post("/api/default/editor/vendorize", json={"mode": mode})

    def test_bundled_pack_is_served_from_static(self):
        res = self._vendorize("css")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["path"], "/static/vendor/codemirror/lang-css.js")

    def test_local_pack_is_served_from_the_workspace(self):
        self.local_dir.mkdir(parents=True, exist_ok=True)
        (self.local_dir / "lang-rust.js").write_text("export function rust() { return []; }\n", encoding="utf-8")
        res = self._vendorize("rust")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["path"], "/api/default/editor/vendor/lang-rust.js")

    def test_unknown_pack_is_not_downloaded(self):
        with patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            res = self._vendorize("cobol")
        self.assertEqual(res.status_code, 404)
        self.assertIn("does not download", res.get_json()["error"])
        self.assertFalse((self.local_dir / "lang-cobol.js").exists())

    def test_invalid_names_are_refused(self):
        for mode in ("../../evil", "a/b", "x" * 60, "UPPER;rm"):
            with self.subTest(mode=mode):
                self.assertEqual(self._vendorize(mode).status_code, 400)


if __name__ == "__main__":
    unittest.main()
