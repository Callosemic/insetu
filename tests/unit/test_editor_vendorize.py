"""S4: editor/vendorize resolves language packs locally (bundled, then the workspace vendor folder) and never downloads code."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import akasa
import akasa.utils as akasa_utils
from flask import Flask
from insetu.core.editor.engine_editor import editor_bp


class TestEditorVendorize(unittest.TestCase):
    """Bundled and local descriptors resolve; local entries cannot shadow bundled ids; unknown packs are not downloaded; invalid names are refused."""

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
        # Person-placed packs live beside the workspace configuration (.insetu/vendor/codemirror/), not in a cache.
        self.local_dir = Path(editor_bp.get_context("default").paths["control_dir"]).joinpath("vendor", "codemirror")

    def tearDown(self):
        self.env_patch.stop()
        akasa.reset_state(cwd=self.orig_cwd, control_dir=".insetu")
        self.temp_dir.cleanup()

    def _vendorize(self, mode):
        return self.client.post("/api/default/editor/vendorize", json={"mode": mode})

    def test_bundled_pack_returns_descriptor_from_static(self):
        res = self._vendorize("rust")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["path"], "/static/vendor/codemirror/lang/rust.js")
        self.assertEqual(data["url"], "/static/vendor/codemirror/lang/rust.js")
        self.assertEqual(data["kind"], "lezer")
        self.assertEqual(data["export"], "rust")

        stream_res = self._vendorize("toml")
        self.assertEqual(stream_res.status_code, 200)
        stream_data = stream_res.get_json()
        self.assertEqual(stream_data["path"], "/static/vendor/codemirror/legacy/toml.js")
        self.assertEqual(stream_data["kind"], "stream")
        self.assertEqual(stream_data["export"], "toml")

    def test_local_manifest_and_bare_pack_resolve_without_shadowing_bundled(self):
        self.local_dir.mkdir(parents=True, exist_ok=True)
        # 1. Bare legacy pack lang-cobol.js with no local manifest entry
        (self.local_dir / "lang-cobol.js").write_text("export function cobol() { return []; }\n", encoding="utf-8")
        # 2. Local manifest entry for 'zig' and an attempted shadow of bundled 'rust'
        (self.local_dir / "zig-pack.js").write_text("export function zigLang() { return []; }\n", encoding="utf-8")
        (self.local_dir / "fake-rust.js").write_text("export function fakeRust() { return []; }\n", encoding="utf-8")
        (self.local_dir / "languages.json").write_text(json.dumps({
            "schema": 1,
            "languages": {
                "zig": {
                    "label": "Zig",
                    "kind": "lezer",
                    "file": "zig-pack.js",
                    "export": "zigLang",
                    "extensions": ["zig"],
                },
                "rust": {
                    "label": "Shadowed Rust",
                    "kind": "lezer",
                    "file": "fake-rust.js",
                    "export": "fakeRust",
                    "extensions": ["rs"],
                },
            },
        }), encoding="utf-8")

        # Bare pack resolves
        cobol_res = self._vendorize("cobol")
        self.assertEqual(cobol_res.status_code, 200)
        self.assertEqual(cobol_res.get_json()["path"], "/api/default/editor/vendor/lang-cobol.js")
        self.assertEqual(cobol_res.get_json()["kind"], "lezer")
        self.assertEqual(cobol_res.get_json()["export"], "cobol")

        # Local manifest entry resolves and is served by editor/vendor/<filename>
        zig_res = self._vendorize("zig")
        self.assertEqual(zig_res.status_code, 200)
        self.assertEqual(zig_res.get_json()["path"], "/api/default/editor/vendor/zig-pack.js")
        self.assertEqual(zig_res.get_json()["export"], "zigLang")
        served_zig = self.client.get("/api/default/editor/vendor/zig-pack.js")
        self.assertEqual(served_zig.status_code, 200)
        self.assertIn(b"zigLang", served_zig.data)

        # Bundled 'rust' cannot be shadowed by local languages.json
        rust_res = self._vendorize("rust")
        self.assertEqual(rust_res.status_code, 200)
        self.assertEqual(rust_res.get_json()["path"], "/static/vendor/codemirror/lang/rust.js")
        self.assertEqual(rust_res.get_json()["export"], "rust")

        # GET editor/languages includes bundled rust + local zig + local cobol
        langs_res = self.client.get("/api/default/editor/languages")
        self.assertEqual(langs_res.status_code, 200)
        langs = langs_res.get_json()["languages"]
        self.assertIn("zig", langs)
        self.assertIn("cobol", langs)
        self.assertEqual(langs["rust"]["file"], "lang/rust.js")

    def test_unknown_pack_is_not_downloaded(self):
        with patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            res = self._vendorize("brainfuck")
        self.assertEqual(res.status_code, 404)
        self.assertIn("does not download", res.get_json()["error"])
        self.assertFalse((self.local_dir / "lang-brainfuck.js").exists())

    def test_invalid_names_are_refused(self):
        for mode in ("../../evil", "a/b", "x" * 60, "UPPER;rm"):
            with self.subTest(mode=mode):
                self.assertEqual(self._vendorize(mode).status_code, 400)

    def test_resolve_editor_mode_reads_manifest_and_prioritizes_filenames_in_node(self):
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary is not installed in PATH")

        repo_root = Path(__file__).resolve().parent.parent.parent
        loader_path = (Path(__file__).resolve().parent / "js_loader.mjs").resolve()
        manifest_path = repo_root / "insetu" / "static" / "vendor" / "codemirror" / "languages.json"
        self.assertTrue(manifest_path.is_file(), "languages.json is missing; run scripts/vendor_codemirror.sh and commit the result")

        node_script = f"""
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {{ resolveEditorMode, setEditorLanguageManifest }} from '/static/extensions/system/components/ui_editor.js';

// 1. Before manifest fetch settles, every built-in language in languages.json resolves from the first-paint fallback table
const manifest = JSON.parse(fs.readFileSync({json.dumps(manifest_path.as_posix())}, 'utf-8'));
for (const [id, spec] of Object.entries(manifest.languages)) {{
    if (spec.kind !== 'builtin') continue;
    for (const ext of (spec.extensions || [])) {{
        const resolved = resolveEditorMode(`vfs://repo/sample.${{ext}}`);
        assert.equal(resolved.mode, id, `First-paint fallback for .${{ext}} must resolve to '${{id}}'`);
        assert.equal(resolved.isMarkdown, id === 'markdown');
    }}
}}

// 2. Load bundled languages.json manifest -> Layer 1, Layer 2, and exact filenames resolve
setEditorLanguageManifest(manifest.languages);
console.log('RESOLVE_EDITOR_MODE_PASSED');
"""
        res = subprocess.run(
            [node_bin, "--import", loader_path.as_posix(), "--input-type=module", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(res.returncode, 0, f"Node resolveEditorMode test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
        self.assertIn("RESOLVE_EDITOR_MODE_PASSED", res.stdout)


if __name__ == "__main__":
    unittest.main()
