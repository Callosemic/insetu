"""Checks that the routine check's results are remembered between listings and forgotten when a prompt or routine file is saved."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from insetu.core.agent import routine_check


class TestRoutineProblemsCache(unittest.TestCase):
    """attach_routine_problems checks a routine once, then reuses the result until something it depends on changes."""

    def setUp(self):
        routine_check.forget_routine_problems()
        self.ctx = SimpleNamespace(workspace_id="ws_cache")
        self.calls = []
        self.problems = [{"severity": "error", "code": "prompt_not_found", "node": "n1", "uri": "ctx://prompts/x.md", "message": "m"}]
        self._patches = [
            patch.object(routine_check, "load_routine_definition", lambda ctx, ref: {"id": ref}),
            patch.object(routine_check, "check_routine", self._check),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()
        routine_check.forget_routine_problems()

    def _check(self, ctx, routine):
        self.calls.append(routine["id"])
        return [dict(p) for p in self.problems]

    def _listing(self, **changes):
        return [{"id": "plan", "filepath": "ctx://routines/plan.md", "title": "Plan", **changes}]

    def test_a_second_listing_reuses_the_first_check(self):
        first = routine_check.attach_routine_problems(self.ctx, self._listing())
        second = routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(first[0]["problems"], second[0]["problems"])
        second[0]["problems"][0]["message"] = "changed by a caller"
        third = routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(third[0]["problems"][0]["message"], "m", "A caller's edits to a returned list must not reach the cache")

    def test_saving_a_prompt_or_routine_file_forgets_the_workspace(self):
        routine_check.attach_routine_problems(self.ctx, self._listing())
        routine_check.forget_routine_problems("ws_cache", "vfs://insetu/insetu/app.py")
        routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(len(self.calls), 1, "A saved Python file cannot change a prompt")
        routine_check.forget_routine_problems("other_ws", "ctx://prompts/x.md")
        routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(len(self.calls), 1, "Another workspace's save does not touch this one")
        routine_check.forget_routine_problems("ws_cache", "ctx://prompts/X.MD")
        routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(len(self.calls), 2)

    def test_a_changed_routine_summary_is_checked_again(self):
        routine_check.attach_routine_problems(self.ctx, self._listing())
        routine_check.attach_routine_problems(self.ctx, self._listing(title="Plan v2"))
        self.assertEqual(len(self.calls), 2)

    def test_an_old_result_is_checked_again(self):
        with patch.object(routine_check.time, "monotonic", return_value=1000.0):
            routine_check.attach_routine_problems(self.ctx, self._listing())
        with patch.object(routine_check.time, "monotonic", return_value=1000.0 + routine_check.PROBLEMS_CACHE_SECONDS + 1):
            routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(len(self.calls), 2)

    def test_a_routine_that_cannot_be_loaded_is_not_remembered(self):
        with patch.object(routine_check, "load_routine_definition", side_effect=ValueError("bad yaml")):
            first = routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(first[0]["problems"][0]["code"], "routine_unreadable")
        second = routine_check.attach_routine_problems(self.ctx, self._listing())
        self.assertEqual(second[0]["problems"][0]["code"], "prompt_not_found")


if __name__ == "__main__":
    unittest.main()
