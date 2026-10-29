import unittest

from insetu.core.bridge.bridge_fuzzy import apply_block_in_memory, expand_macros
from insetu.fallback_bridge import expand_macros as lifeboat_expand_macros

# Built from pieces so this source file never contains a raw macro token (patches to it stay unambiguous).
OPEN = "{{" + "ymm:"
CHEVRON_OPEN = OPEN + "<x7}}"
CHEVRON_SEP = OPEN + "=x7}}"
CHEVRON_CLOSE = OPEN + ">x7}}"
FENCE = OPEN + "`x3}}"
BRACES = OPEN + "{x2}}"


class TestMacroEscapes(unittest.TestCase):
    """The namespaced transport macro always expands, even in files that document it, and both bridges agree."""

    def test_macros_expand_even_when_the_target_file_contains_the_raw_token(self):
        doc = (
            "* Literal 7-chevron markers: `" + CHEVRON_OPEN + "`, `" + CHEVRON_SEP + "`\n"
            "<<<<<<< SEARCH\n"
            "[new lines to insert]\n"
            ">>>>>>> REPLACE\n"
        )
        block = {
            "search": CHEVRON_OPEN + " SEARCH\n[new lines to insert]\n" + CHEVRON_CLOSE + " REPLACE",
            "replace": CHEVRON_OPEN + " SEARCH\n" + CHEVRON_SEP + "\n[new lines to insert]\n" + CHEVRON_CLOSE + " REPLACE",
        }
        ok, patched, _status = apply_block_in_memory(doc, block, silent=True)
        self.assertTrue(ok)
        self.assertIn("<<<<<<< SEARCH\n=======\n[new lines to insert]\n>>>>>>> REPLACE", patched)
        self.assertIn(CHEVRON_OPEN, patched, "The documented literal token on the first line must survive untouched")

    def test_brace_macro_writes_a_literal_token(self):
        self.assertEqual(expand_macros(BRACES + "ymm:<x7}}"), CHEVRON_OPEN)
        self.assertEqual(expand_macros(BRACES + "ymm:`x3}} then " + FENCE), FENCE + " then ```")

    def test_lifeboat_expands_the_same_way(self):
        samples = [
            FENCE + "text\n" + CHEVRON_OPEN + " SEARCH\n" + CHEVRON_SEP + "\n" + CHEVRON_CLOSE + " REPLACE\n" + FENCE,
            BRACES + "ymm:<x7}}",
            "padding = " + "{{" + " *4}}",
        ]
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertEqual(lifeboat_expand_macros(sample), expand_macros(sample))


if __name__ == "__main__":
    unittest.main()
