"""Checks the performance check's own logic: medians, budget comparison, warm-up, and how it finds the app."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.performance import perf_check
from tests.performance.perf_check import find_port, find_workspace, over_budget, run_check, summarize


class TestPerfCheck(unittest.TestCase):
    """perf_check compares the median of each reported part to its budget."""

    def test_summarize_takes_the_median_of_each_part(self):
        samples = [
            (300.0, {"timings_ms": {"list": 200.0, "check": 1.0}}),
            (900.0, {"timings_ms": {"list": 700.0, "check": 2.0}}),
            (320.0, {"timings_ms": {"list": 210.0, "check": 1.5}}),
        ]
        self.assertEqual(summarize(samples), {"total": 320.0, "check": 1.5, "list": 210.0})

    def test_a_part_over_its_budget_is_reported_and_one_within_is_not(self):
        problems = over_budget({"total": 500.0, "list": 450.0}, {"total": 800, "list": 400})
        self.assertEqual(len(problems), 1)
        self.assertTrue(problems[0].startswith("list:"))

    def test_a_budgeted_part_the_app_stopped_reporting_is_a_failure(self):
        problems = over_budget({"total": 100.0}, {"total": 800, "list": 400})
        self.assertEqual(len(problems), 1)
        self.assertIn("did not report", problems[0])

    def test_warmups_are_not_counted(self):
        replies = iter([(5000.0, {"timings_ms": {"list": 4000.0}})] + [(100.0, {"timings_ms": {"list": 50.0}})] * 3)
        requested = []

        def fetch_path(path):
            requested.append(path)
            return next(replies)

        check = {"path": "agent/routines", "warmups": 1, "samples": 3, "budget_ms": {"total": 800, "list": 400}}
        measured, problems = run_check(check, fetch_path)
        self.assertEqual(requested, ["agent/routines"] * 4)
        self.assertEqual(measured, {"total": 100.0, "list": 50.0})
        self.assertEqual(problems, [])

    def test_port_and_workspace_come_from_the_control_directory_unless_given(self):
        with tempfile.TemporaryDirectory() as tmp:
            control_dir = Path(tmp)
            self.assertEqual(find_workspace(control_dir), "default")
            (control_dir / "host.json").write_text(json.dumps({"port": 5123}), encoding="utf-8")
            (control_dir / "workspaces.json").write_text(json.dumps({"active_workspace": "demo"}), encoding="utf-8")
            with patch.dict(perf_check.os.environ, {}, clear=True):
                self.assertEqual(find_port(control_dir), 5123)
                self.assertEqual(find_port(control_dir, 6000), 6000)
            with patch.dict(perf_check.os.environ, {"INSETU_PORT": "5999"}, clear=True):
                self.assertEqual(find_port(control_dir), 5999)
            self.assertEqual(find_workspace(control_dir), "demo")
            self.assertEqual(find_workspace(control_dir, "main"), "main")

    def test_the_shipped_budgets_file_is_well_formed(self):
        checks = json.loads(perf_check.BUDGETS_PATH.read_text(encoding="utf-8"))["checks"]
        self.assertTrue(checks)
        for check in checks:
            self.assertTrue(check["name"] and check["path"] and check["why"])
            self.assertIn("total", check["budget_ms"])
            self.assertTrue(all(isinstance(v, (int, float)) and v > 0 for v in check["budget_ms"].values()))


if __name__ == "__main__":
    unittest.main()
