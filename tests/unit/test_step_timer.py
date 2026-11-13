"""Checks the step timer used to report which part of a request was slow."""
import unittest
from unittest.mock import patch

from insetu.core import step_timer
from insetu.core.step_timer import StepTimer


class TestStepTimer(unittest.TestCase):
    """StepTimer attributes the time since the previous mark to the named step and passes the step's value through."""

    def test_each_mark_gets_the_time_since_the_previous_one(self):
        with patch.object(step_timer.time, "perf_counter", side_effect=[10.0, 10.25, 10.3, 11.3]):
            timer = StepTimer()
            self.assertEqual(timer.mark("list", ["a"]), ["a"])
            timer.mark("check")
            timer.mark("list")
        self.assertEqual(timer.ms, {"list": 1250.0, "check": 50.0})

    def test_nested_marks_run_inside_out(self):
        with patch.object(step_timer.time, "perf_counter", side_effect=[0.0, 0.2, 0.5]):
            timer = StepTimer()
            result = timer.mark("outer", len(timer.mark("inner", "abc")))
        self.assertEqual(result, 3)
        self.assertEqual(timer.ms, {"inner": 200.0, "outer": 300.0})


if __name__ == "__main__":
    unittest.main()
