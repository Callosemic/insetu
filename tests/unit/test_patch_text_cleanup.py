"""Tests the two clean-ups around pasted patch text: prose left after patches are lifted out, and the protocol's examples."""
import unittest
from pathlib import Path

from insetu.core.bridge.parser import (
    EXAMPLES_BEGIN_MARKER as BEGIN,
    EXAMPLES_END_MARKER as END,
    blank_example_regions,
    parse_blocks,
    strip_yomama_blocks_keep_prose,
)

PROTOCOL = Path(__file__).resolve().parents[2] / "insetu" / "core" / "bridge" / "prompts" / "yomama_patch_protocol.md"
M7 = "<" * 7
E7 = "=" * 7
G7 = ">" * 7


def _patch(path="vfs://a/b.js"):
    return f"{M7} FILE: {path}\n{M7} SEARCH\nx\n{E7}\ny\n{G7} REPLACE"


class TestStripPatchesKeepProse(unittest.TestCase):
    """A chat message keeps its prose and loses every fence that held only patches, with no stray backticks."""

    def test_fence_with_a_blank_line_before_its_close(self):
        self.assertEqual(strip_yomama_blocks_keep_prose(f"Hi\n\n```text\n{_patch()}\n\n```\n\nBye"), "Hi\n\nBye")

    def test_fence_in_another_language_or_length(self):
        self.assertEqual(strip_yomama_blocks_keep_prose(f"Hi\n```diff\n{_patch()}\n```\nBye"), "Hi\n\nBye")
        self.assertEqual(strip_yomama_blocks_keep_prose(f"Hi\n````text\n{_patch()}\n````\nBye"), "Hi\n\nBye")

    def test_fence_with_trailing_spaces(self):
        self.assertEqual(strip_yomama_blocks_keep_prose(f"Hi\n```text \n{_patch()}\n``` \nBye"), "Hi\n\nBye")

    def test_ordinary_code_fences_are_kept(self):
        text = f"Look:\n```python\nprint(1)\n```\nThen\n```text\n{_patch()}\n```"
        self.assertEqual(strip_yomama_blocks_keep_prose(text), "Look:\n```python\nprint(1)\n```\nThen")

    def test_tilde_fence_is_stripped(self):
        self.assertEqual(strip_yomama_blocks_keep_prose(f"Hi\n~~~text\n{_patch()}\n~~~\nBye"), "Hi\n\nBye")


class TestProtocolExamplesAreNotStaged(unittest.TestCase):
    """Pasting a context pack that carries the patch protocol stages none of the protocol's own examples."""

    def test_the_protocol_alone_parses_to_nothing(self):
        self.assertEqual(parse_blocks(PROTOCOL.read_text(encoding="utf-8")), {})

    def test_a_real_patch_after_the_protocol_still_parses(self):
        pack = PROTOCOL.read_text(encoding="utf-8") + "\n\n```text\n" + _patch("vfs://beats/src/beat.js") + "\n```\n"
        self.assertEqual(list(parse_blocks(pack).keys()), ["vfs://beats/src/beat.js"])

    def test_blanking_keeps_line_numbers(self):
        text = "a\n<!-- yomama:examples -->\nb\nc\n<!-- /yomama:examples -->\nd"
        blanked = blank_example_regions(text)
        self.assertEqual(blanked.count("\n"), text.count("\n"))
        self.assertEqual(blanked.split("\n")[-1], "d")
        self.assertNotIn("b", blanked.split("\n")[2])

    def test_unclosed_examples_marker_blanks_to_eof(self):
        text = f"{_patch('vfs://a/first.js')}\n{BEGIN}\n{_patch('vfs://a/example.js')}"
        blanked = blank_example_regions(text)
        self.assertEqual(blanked.count("\n"), text.count("\n"))
        self.assertEqual(list(parse_blocks(text).keys()), ["vfs://a/first.js"])

    def test_multiple_example_regions_keep_interleaved_patches(self):
        text = (
            f"{BEGIN}\n{_patch('vfs://a/ex1.js')}\n{END}\n"
            f"{_patch('vfs://a/real.js')}\n"
            f"{BEGIN}\n{_patch('vfs://a/ex2.js')}\n{END}"
        )
        self.assertEqual(list(parse_blocks(text).keys()), ["vfs://a/real.js"])

    def test_a_marker_quoted_inside_a_line_is_ordinary_text(self):
        # A patch that edits code holding the marker (a string constant, a test) must still parse.
        text = f"{M7} FILE: vfs://a/m.py\n{M7} SEARCH\nX = 1\n{E7}\nX = '{BEGIN}'\nY = '{END}'\n{G7} REPLACE"
        self.assertEqual(blank_example_regions(text), text)
        self.assertEqual(list(parse_blocks(text).keys()), ["vfs://a/m.py"])


if __name__ == "__main__":
    unittest.main()
