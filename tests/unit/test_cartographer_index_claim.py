"""Checks that only one workspace writes a clone's CODE_INDEX.md when several mount it with different index rules (issue #22)."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import insetu.core.cartographer.index_claim as index_claim
from insetu.core.cartographer.index_claim import CLAIM_FILENAME, index_rules_fingerprint, may_write_index


class TestIndexClaim(unittest.TestCase):
    """may_write_index arbitrates CODE_INDEX.md writes through a claim file in the clone's git directory."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.repo = root / "insetu"
        (self.repo / ".git").mkdir(parents=True)
        self.main_ws = root / "main" / ".insetu"
        self.demo_ws = root / "demo" / ".insetu"
        self.main_ws.mkdir(parents=True)
        self.demo_ws.mkdir(parents=True)
        control_dirs = {"main": self.main_ws.as_posix(), "demo": self.demo_ws.as_posix()}
        self._patch = patch.object(index_claim, "get_tenant_control_dir", side_effect=lambda ws: control_dirs[ws])
        self._patch.start()
        self.main_rules = index_rules_fingerprint({"repo_dir": "insetu", "title": "inSetu", "exts": [".py"]}, {}, True)
        self.demo_rules = index_rules_fingerprint({"repo_dir": "insetu", "title": "Demo", "exts": [".py"]}, {}, True)

    def tearDown(self):
        self._patch.stop()
        self._tmp.cleanup()

    def _holder(self):
        return json.loads((self.repo / ".git" / CLAIM_FILENAME).read_text(encoding="utf-8"))["workspace"]

    def test_first_workspace_claims_and_a_workspace_with_other_rules_leaves_the_index_alone(self):
        """The first workspace to map claims the index; a second one with different rules may not write it."""
        self.assertEqual(may_write_index(self.repo, "main", self.main_rules), (True, self.main_ws.resolve().as_posix()))
        allowed, holder = may_write_index(self.repo, "demo", self.demo_rules)
        self.assertFalse(allowed)
        self.assertEqual(holder, self.main_ws.resolve().as_posix())
        self.assertEqual(self._holder(), self.main_ws.resolve().as_posix())

    def test_a_workspace_whose_rules_match_the_holder_may_write(self):
        """Matching rules render the same index, so the second workspace writes without taking the claim."""
        may_write_index(self.repo, "main", self.main_rules)
        self.assertTrue(may_write_index(self.repo, "demo", self.main_rules)[0])
        self.assertEqual(self._holder(), self.main_ws.resolve().as_posix())

    def test_take_over_moves_the_claim(self):
        """A person's claim request makes their workspace the writer, and the former holder then leaves the index alone."""
        may_write_index(self.repo, "main", self.main_rules)
        self.assertTrue(may_write_index(self.repo, "demo", self.demo_rules, take_over=True)[0])
        self.assertEqual(self._holder(), self.demo_ws.resolve().as_posix())
        self.assertFalse(may_write_index(self.repo, "main", self.main_rules)[0])

    def test_a_claim_held_by_a_workspace_that_no_longer_exists_is_taken(self):
        """When the holder's control directory is gone, the next workspace to map claims the index."""
        may_write_index(self.repo, "demo", self.demo_rules)
        self.demo_ws.rmdir()
        self.assertTrue(may_write_index(self.repo, "main", self.main_rules)[0])
        self.assertEqual(self._holder(), self.main_ws.resolve().as_posix())

    def test_holder_changing_its_own_rules_keeps_the_claim(self):
        """The holder may change its settings; the claim records the new rules and stays with it."""
        may_write_index(self.repo, "main", self.main_rules)
        self.assertTrue(may_write_index(self.repo, "main", self.demo_rules)[0])
        self.assertTrue(may_write_index(self.repo, "demo", self.demo_rules)[0])

    def test_linked_worktree_keeps_its_claim_in_its_own_git_directory(self):
        """A worktree's .git file points at its own git directory, which holds its claim."""
        worktree = Path(self._tmp.name) / "wt"
        worktree_git = self.repo / ".git" / "worktrees" / "wt"
        worktree_git.mkdir(parents=True)
        worktree.mkdir()
        (worktree / ".git").write_text(f"gitdir: {worktree_git.as_posix()}\n", encoding="utf-8")
        self.assertTrue(may_write_index(worktree, "main", self.main_rules)[0])
        self.assertTrue((worktree_git / CLAIM_FILENAME).exists())
        self.assertFalse((self.repo / ".git" / CLAIM_FILENAME).exists())

    def test_a_folder_that_is_not_a_git_clone_is_always_writable(self):
        """Without a git directory there is nowhere shared to keep a claim, so writes go ahead as before."""
        plain = Path(self._tmp.name) / "plain"
        plain.mkdir()
        self.assertEqual(may_write_index(plain, "demo", self.demo_rules), (True, None))

    def test_fingerprint_ignores_settings_that_do_not_shape_the_index(self):
        """Settings outside the index rules (a description, sub-buckets) do not make two renders disagree."""
        base = {"repo_dir": "insetu", "exts": [".py"]}
        self.assertEqual(
            index_rules_fingerprint({**base, "description": "a", "sub_buckets": [1]}, {"tab_order": [1]}, True),
            index_rules_fingerprint({**base, "description": "b"}, {}, True),
        )
        self.assertNotEqual(index_rules_fingerprint(base, {}, True), index_rules_fingerprint(base, {}, False))


if __name__ == "__main__":
    unittest.main()
