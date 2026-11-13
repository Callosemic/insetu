"""Checks that parsing a routine is remembered by its text, and that callers get their own copy."""
import unittest

from insetu.core.agent import routine_loader
from insetu.core.agent.routine_loader import parse_routine_content

ROUTINE = """---
id: review
title: Review
nodes:
  - id: read
    type: llm
  - id: write
    type: llm
    parents: [read]
---

## read

Read the change.

## write

Write the review.
"""


class TestRoutineParseCache(unittest.TestCase):
    """parse_routine_content parses each distinct routine text once and never shares a parsed object between callers."""

    def setUp(self):
        routine_loader._parse_routine_text.cache_clear()

    def test_the_same_text_is_parsed_once(self):
        first = parse_routine_content(ROUTINE, fallback_id="review", is_markdown=True)
        second = parse_routine_content(ROUTINE, fallback_id="review", is_markdown=True)
        self.assertEqual(first, second)
        info = routine_loader._parse_routine_text.cache_info()
        self.assertEqual((info.misses, info.hits), (1, 1))

    def test_a_callers_changes_do_not_reach_the_next_caller(self):
        first = parse_routine_content(ROUTINE, fallback_id="review", is_markdown=True)
        first["source"] = "workspace"
        first["nodes"][0]["prompt"] = "changed by a caller"
        first["wavefronts"].append(["extra"])
        second = parse_routine_content(ROUTINE, fallback_id="review", is_markdown=True)
        self.assertNotIn("source", second)
        self.assertEqual(second["nodes"][0]["prompt"], "Read the change.")
        self.assertEqual(second["wavefronts"], [["read"], ["write"]])

    def test_changed_text_or_a_different_fallback_id_is_parsed_again(self):
        parse_routine_content(ROUTINE, fallback_id="review", is_markdown=True)
        edited = parse_routine_content(ROUTINE.replace("title: Review", "title: Review v2"), fallback_id="review", is_markdown=True)
        self.assertEqual(edited["title"], "Review v2")
        no_id = ROUTINE.replace("id: review\n", "")
        self.assertEqual(parse_routine_content(no_id, fallback_id="a")["id"], "a")
        self.assertEqual(parse_routine_content(no_id, fallback_id="b")["id"], "b")

    def test_an_empty_routine_still_raises_each_time(self):
        for _ in range(2):
            with self.assertRaises(ValueError):
                parse_routine_content("", fallback_id="empty")


if __name__ == "__main__":
    unittest.main()
