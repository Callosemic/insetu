import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from flask import Flask

import akasa
import akasa.db as akasa_db
import akasa.utils as akasa_utils
from akasa.utils import load_config
from akasa.workers import _init_worker_schema
import insetu.core.editor.engine_editor as engine_editor
from insetu.core.fs.engine_fs import fs_bp
from insetu.core.topology.engine_topology import mount_topology_volumes_dynamically
from insetu.extensions.publish.engine_publish import compile_document_payload, publish_bp


class TestPublishExtension(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name).resolve()
        self.control_dir = self.root_path / ".insetu"
        (self.control_dir / "cache" / "db").mkdir(parents=True, exist_ok=True)
        self.repo_dir = self.root_path / "drafts"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        self.orig_cwd = akasa_utils.get_daemon_cwd()
        self.orig_env_ctrl = os.environ.get("AKASA_CONTROL_DIR")
        akasa.reset_state(cwd=self.root_path.as_posix(), control_dir=".insetu")

        (self.control_dir / "system.json").write_text(
            json.dumps({"port": 5005, "workspaces": {"default": {"config_path": "config.json"}}}),
            encoding="utf-8",
        )
        (self.control_dir / "config.json").write_text(
            json.dumps({
                "workspace_root": self.root_path.as_posix(),
                "extensions": ["config", "publish"],
                "target_repos": [{"repo_dir": "drafts", "title": "Drafts", "exts": [".md"]}],
            }),
            encoding="utf-8",
        )
        _init_worker_schema("default")
        mount_topology_volumes_dynamically(load_config("default"), workspace_id="default")

        self.app = Flask(__name__)
        self.app.register_blueprint(fs_bp.bp)
        self.client = self.app.test_client()

    def tearDown(self):
        akasa.reset_state(cwd=self.orig_cwd, control_dir=self.orig_env_ctrl or ".insetu")
        try:
            self.temp_dir.cleanup()
        except OSError:
            pass

    def test_download_route_resolves_publish_ephemeral_artifacts(self):
        """GET /download/<safe_name> resolves ephemeral artifacts registered via vfs_resolve_file hooks."""
        pub_ctx = publish_bp.get_context("default")
        artifacts_dir = Path(pub_ctx.paths["artifacts_base"])
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        safe_name = "pub_test123_essay.html"
        artifact_file = artifacts_dir / safe_name
        artifact_file.write_text("<h2>Substack Heading</h2><p>Body paragraph.</p>", encoding="utf-8")

        dl_res = self.client.get(f"/download/{safe_name}")
        self.assertEqual(dl_res.status_code, 200)
        self.assertIn(b"<h2>Substack Heading</h2>", dl_res.data)

    def test_publish_strips_ephemeral_wordcount_macros_via_hook(self):
        """compile_document_payload strips standalone and inline wordcount macros declared via pre_compile_document."""
        _ = engine_editor  # Ensure pre_compile_document hook is registered
        md_uri = "vfs://drafts/article.md"
        md_source = (
            "---\ntitle: Sample Essay\n---\n\n"
            "{{wordcount_start}}\n"
            "First paragraph with inline {{wordcount_sum}} marker.\n"
            "  {{wordcount_stop}}  \n"
            "Second paragraph.\n"
        )
        (self.repo_dir / "article.md").write_text(md_source, encoding="utf-8")

        captured_input = {}

        def fake_run(cmd, cwd=None, **kwargs):
            in_path = Path(cmd[1])
            out_path = Path(cmd[-1])
            captured_input["markdown"] = in_path.read_text(encoding="utf-8")
            out_path.write_text("<h2 id=\"heading\">Heading</h2><p>Compiled body.</p>", encoding="utf-8")
            res = MagicMock()
            res.returncode = 0
            res.stderr = ""
            return res

        with patch("akasa.process.ProcessManager.run", side_effect=fake_run):
            mem_file, dl_name = compile_document_payload("default", md_uri, "html_snippet")

        self.assertEqual(dl_name, "article.html")
        self.assertNotIn("wordcount_", captured_input["markdown"])
        self.assertEqual(
            captured_input["markdown"],
            "First paragraph with inline marker.\nSecond paragraph.\n",
        )
        self.assertEqual(mem_file.read().decode("utf-8"), "<h2>Heading</h2><p>Compiled body.</p>")


if __name__ == "__main__":
    unittest.main()