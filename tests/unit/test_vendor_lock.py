import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
VENDOR_ROOT = REPO_ROOT / "insetu" / "static" / "vendor"

_spec = importlib.util.spec_from_file_location("insetu_vendor_lock", REPO_ROOT / "scripts" / "vendor_lock.py")
vendor_lock = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vendor_lock)


def _make_sutram_checkout(root: Path) -> Path:
    """Builds a minimal sutram git checkout with one file per BUILD_MAP source."""
    (root / "sutram" / "js").mkdir(parents=True)
    (root / "yenvui" / "js").mkdir(parents=True)
    (root / "yenvui" / "css").mkdir(parents=True)
    (root / "sutram" / "js" / "boot.js").write_text("export const a = 1;\n", encoding="utf-8")
    (root / "yenvui" / "js" / "card.js").write_text("export const b = 2;\n", encoding="utf-8")
    (root / "yenvui" / "css" / "tokens.css").write_text(":root { --bg: #000; }\n", encoding="utf-8")
    (root / "pyproject.toml").write_text('[project]\nname = "sutram"\nversion = "9.9.9"\n', encoding="utf-8")
    for cmd in (
        ["git", "init", "-q"],
        ["git", "add", "-A"],
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init"],
    ):
        subprocess.run(cmd, cwd=root, check=True, capture_output=True, timeout=30)
    return root


class TestVendorLock(unittest.TestCase):
    """sutram.lock.json records the vendored sutram build and catches drift between the lock and the committed files."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name).resolve()
        self.sutram = _make_sutram_checkout(self.root / "sutram_repo")
        self.vendor = self.root / "vendor"
        self.vendor.mkdir()

    def tearDown(self):
        self.temp_dir.cleanup()

    def _sync(self):
        return vendor_lock.sync(self.sutram, self.vendor)["sutram"]

    def test_sync_records_version_commit_and_clean_state(self):
        entry = self._sync()
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=self.sutram, capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(entry["version"], "9.9.9")
        self.assertEqual(entry["commit"], head)
        self.assertFalse(entry["dirty"])
        self.assertEqual(entry["files"], 3)
        self.assertEqual(vendor_lock.check(self.vendor), [])

    def test_uncommitted_sutram_changes_are_marked_dirty(self):
        (self.sutram / "sutram" / "js" / "boot.js").write_text("export const a = 2;\n", encoding="utf-8")
        self.assertTrue(self._sync()["dirty"])

    def test_stale_vendored_files_are_removed(self):
        stale = self.vendor / "sutram" / "js" / "sdk.js"
        stale.parent.mkdir(parents=True)
        stale.write_text("old", encoding="utf-8")
        self._sync()
        self.assertFalse(stale.exists())

    def test_check_flags_hand_edits_and_extra_files(self):
        self._sync()
        target = self.vendor / "yenvui" / "js" / "card.js"
        target.write_text(target.read_text(encoding="utf-8") + "// hand edit\n", encoding="utf-8")
        self.assertTrue(any("contents" in p for p in vendor_lock.check(self.vendor)))
        self._sync()
        (self.vendor / "sutram" / "js" / "extra.js").write_text("x", encoding="utf-8")
        self.assertTrue(any("file count" in p for p in vendor_lock.check(self.vendor)))

    def test_missing_lock_is_reported(self):
        self.assertTrue(any("missing" in p for p in vendor_lock.check(self.vendor)))

    def test_committed_vendor_tree_matches_its_lock(self):
        """The vendored sutram that this repository commits (and every release ships) must match sutram.lock.json."""
        if not (VENDOR_ROOT / "sutram").is_dir():
            self.skipTest("sutram is not vendored in this checkout")
        problems = vendor_lock.check(VENDOR_ROOT)
        self.assertEqual(problems, [], "Re-run scripts/vendor_sutram.sh and commit the result:\n" + "\n".join(problems))
        if os.environ.get("CI"):
            # Locally a dirty build is normal while iterating on sutram; anything CI tests must be reproducible.
            lock = json.loads((VENDOR_ROOT / vendor_lock.LOCK_FILENAME).read_text(encoding="utf-8"))["sutram"]
            self.assertFalse(lock["dirty"], "The committed vendor build came from a sutram checkout with uncommitted changes.")


if __name__ == "__main__":
    unittest.main()
