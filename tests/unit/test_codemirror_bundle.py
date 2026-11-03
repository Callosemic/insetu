"""S4 tests for the vendored CodeMirror bundle: manifest accounting, no remote specifiers, and real Node parsing."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CM_DIR = REPO_ROOT / "insetu" / "static" / "vendor" / "codemirror"
MANIFEST_PATH = CM_DIR / "languages.json"

BANNED_SPECIFIERS = ("esm.sh", "unpkg", "jsdelivr", 'import "/@', "import '/@", 'from "/@', "from '/@")


class TestCodeMirrorBundle(unittest.TestCase):
    """Every file in static/vendor/codemirror/ is accounted for, free of CDN shims, and parses samples in Node."""

    @classmethod
    def setUpClass(cls):
        # The bundle is committed, so a missing manifest is a failure, not a reason to skip.
        if not MANIFEST_PATH.is_file():
            raise AssertionError("static/vendor/codemirror/languages.json is missing; run scripts/vendor_codemirror.sh and commit the result")
        cls.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        cls.languages = cls.manifest.get("languages") or {}

    def test_every_manifest_file_exists_and_identifiers_are_unique(self):
        self.assertEqual(self.manifest.get("schema"), 1)
        self.assertGreaterEqual(len(self.languages), 30)
        seen_exts = set()
        seen_filenames = set()
        for lang_id, spec in self.languages.items():
            with self.subTest(language=lang_id):
                self.assertIn(spec.get("kind"), ("builtin", "lezer", "stream"))
                self.assertTrue(spec.get("export"))
                if spec["kind"] != "builtin":
                    rel_file = spec.get("file")
                    self.assertTrue(rel_file, f"{lang_id} is missing 'file'")
                    self.assertTrue((CM_DIR / rel_file).is_file(), f"Missing pack file {rel_file} for {lang_id}")
                for ext in spec.get("extensions") or ():
                    norm_ext = ext.lower()
                    self.assertNotIn(norm_ext, seen_exts, f"Duplicate extension '{ext}' on {lang_id}")
                    seen_exts.add(norm_ext)
                for fname in spec.get("filenames") or ():
                    norm_name = fname.lower()
                    self.assertNotIn(norm_name, seen_filenames, f"Duplicate filename '{fname}' on {lang_id}")
                    seen_filenames.add(norm_name)

    def test_every_file_in_vendor_codemirror_is_accounted_for(self):
        manifest_files = {spec["file"] for spec in self.languages.values() if spec.get("file")}
        allowed_exact = {
            "codemirror-core.js",
            "languages.json",
            "codemirror.lock.json",
            "lezer/common.js",
            "lezer/highlight.js",
            "lezer/lr.js",
            *manifest_files,
        }
        unexpected = []
        for item in sorted(p for p in CM_DIR.rglob("*") if p.is_file()):
            rel = item.relative_to(CM_DIR).as_posix()
            if rel in allowed_exact:
                continue
            if rel.startswith("chunks/") and rel.endswith(".js"):
                continue
            if rel.startswith("licenses/") and rel.endswith(".txt"):
                continue
            unexpected.append(rel)
        self.assertEqual(unexpected, [], f"Stale or unaccounted files in static/vendor/codemirror: {unexpected}")

    def test_no_vendored_file_contains_remote_or_absolute_cdn_specifiers(self):
        for js_file in sorted(CM_DIR.rglob("*.js")):
            text = js_file.read_text(encoding="utf-8")
            rel = js_file.relative_to(CM_DIR).as_posix()
            for banned in BANNED_SPECIFIERS:
                self.assertNotIn(banned, text, f"Banned specifier '{banned}' found in {rel}")

    def test_every_language_pack_parses_sample_and_shares_language_instance_in_node(self):
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("Node.js binary is not installed in PATH")

        node_script = """
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const cmDir = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(cmDir, 'languages.json'), 'utf-8'));
const core = await import(pathToFileURL(path.join(cmDir, 'codemirror-core.js')).href);

assert.equal(typeof core.Language, 'function', 'codemirror-core must export Language');
assert.equal(typeof core.StreamLanguage?.define, 'function', 'codemirror-core must export StreamLanguage.define');

for (const [id, spec] of Object.entries(manifest.languages)) {
    let support;
    if (spec.kind === 'builtin') {
        const fn = core[spec.export];
        assert.equal(typeof fn, 'function', `Missing builtin export ${spec.export} for ${id}`);
        support = spec.options ? fn(spec.options) : fn();
    } else {
        const mod = await import(pathToFileURL(path.join(cmDir, spec.file)).href);
        const target = mod[spec.export];
        assert.ok(target, `Missing export ${spec.export} in ${spec.file} for ${id}`);
        if (spec.kind === 'stream') {
            support = core.StreamLanguage.define(target);
        } else {
            support = spec.options ? target(spec.options) : target();
        }
    }

    const language = support.language || support;
    assert.ok(
        language instanceof core.Language,
        `Language '${id}' (${spec.kind}) is not an instance of core.Language (duplicate @codemirror/language or @lezer/common copy!)`
    );
    const sample = spec.sample || 'x = 1\\n';
    const tree = language.parser.parse(sample);
    assert.ok(tree && tree.length > 0, `Parser for '${id}' produced an empty tree`);
}
console.log('ALL_CODEMIRROR_LANGUAGES_VERIFIED');
"""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_cm = Path(tmp) / "codemirror"
            shutil.copytree(CM_DIR, tmp_cm)
            (tmp_cm / "package.json").write_text('{"type": "module"}\n', encoding="utf-8")
            res = subprocess.run(
                [node_bin, "--input-type=module", "-e", node_script, tmp_cm.as_posix()],
                capture_output=True,
                text=True,
                timeout=30,
            )
        self.assertEqual(res.returncode, 0, f"Node bundle verification failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
        self.assertIn("ALL_CODEMIRROR_LANGUAGES_VERIFIED", res.stdout)


if __name__ == "__main__":
    unittest.main()
