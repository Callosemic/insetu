"""Git diff buckets follow the topology sieve: a changed file topology ignores never lands in a diff bucket."""
from pathlib import Path
import subprocess
import tempfile
import unittest

from insetu.extensions.git.engine_git import _batch_read_git_head_blobs, diffable_changes


class TestDiffsFollowTheSieve(unittest.TestCase):
    """Anchored ignore patterns, exceptions, force-includes and extensions apply to diffs exactly as to topology."""

    REPO = {
        "repo_dir": "alpha",
        "exts": [".py", ".json", ""],
        "repo_ignore_dirs": [".git", "node_modules"],
        "repo_ignore_patterns": ["/insetu/static/vendor/"],
        "ignore_exceptions": [".insetu-data/"],
        "force_include": ["docs/kept.md"],
    }

    def _kept(self, paths):
        entries = [(p, "M ", p) for p in paths]
        return [e[0] for e in diffable_changes(entries, self.REPO, {})]

    def test_anchored_pattern_applies_to_diffs(self):
        # The old diff filter matched patterns as substrings, so "/insetu/static/vendor/" never matched.
        kept = self._kept(["insetu/static/vendor/codemirror/lang/rust.js", "insetu/static/vendor.json", "insetu/app.py"])
        self.assertEqual(kept, ["insetu/static/vendor.json", "insetu/app.py"])

    def test_name_rules_still_match_at_any_depth(self):
        self.assertEqual(self._kept(["web/node_modules/x/index.json", "scripts/codemirror/build.py"]), ["scripts/codemirror/build.py"])

    def test_extensions_exceptions_and_force_includes_follow_topology(self):
        kept = self._kept(["notes/readme.md", "docs/kept.md", "Dockerfile", ".insetu-data/tracker/a.json"])
        self.assertEqual(kept, ["docs/kept.md", "Dockerfile", ".insetu-data/tracker/a.json"])

    def test_batch_read_git_head_blobs_empty_and_graceful_on_missing(self):
        self.assertEqual(_batch_read_git_head_blobs(Path("nonexistent"), []), {})
        self.assertEqual(_batch_read_git_head_blobs(Path("nonexistent"), ["foo.py"]), {})

    def test_batch_read_git_head_blobs_reads_committed_contents(self):
        with tempfile.TemporaryDirectory() as td:
            repo_root = Path(td).resolve()
            (repo_root / "foo.py").write_text("FOO_VAL = 42\n", encoding="utf-8")
            (repo_root / "bar.py").write_text("BAR_VAL = 99\n", encoding="utf-8")
            subprocess.run(["git", "init", "-q"], cwd=repo_root, check=True)
            subprocess.run(["git", "add", "-A"], cwd=repo_root, check=True)
            subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@e.com", "commit", "-qm", "init"], cwd=repo_root, check=True)

            res = _batch_read_git_head_blobs(repo_root, ["foo.py", "bar.py", "missing.py"])
            self.assertEqual(res.get("foo.py"), "FOO_VAL = 42\n")
            self.assertEqual(res.get("bar.py"), "BAR_VAL = 99\n")
            self.assertNotIn("missing.py", res)


if __name__ == "__main__":
    unittest.main()
