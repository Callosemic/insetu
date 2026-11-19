"""U2.6 regression tests for Yomama Bridge web-chat wrapper resilience in parse_blocks."""

import unittest
from insetu.core.bridge.parser import parse_blocks


CLEAN_FENCED_PATCH = """```text
<<<<<<< FILE: vfs://insetu/insetu/alpha.py
<<<<<<< COMMENT
Update alpha greeting
<<<<<<< SEARCH
def greet():
    return "old_alpha"
=======
def greet():
    return "new_alpha"
>>>>>>> REPLACE
```

```text
<<<<<<< FILE: vfs://insetu/insetu/beta.py
<<<<<<< COMMENT
Update beta counter
<<<<<<< SEARCH
COUNT = 1
=======
COUNT = 2
>>>>>>> REPLACE
```"""


class TestBridgeChatWrappers(unittest.TestCase):
    """Verifies that parse_blocks handles all nine web-chat wrapper forms identically to a clean fenced patch."""

    def _canonical_projection(self, parsed):
        """Extracts a line-number-agnostic structural representation of parsed blocks for exact comparison."""
        proj = {}
        for filepath, blocks in parsed.items():
            proj[filepath] = [
                {
                    "order": b["order"],
                    "type": b["type"],
                    "comment": b["comment"],
                    "search": b["search"],
                    "replace": b["replace"],
                    "malformed": bool(b.get("malformed", False)),
                }
                for b in blocks
            ]
        return proj

    def test_nine_chat_wrapper_variations_parse_identically(self):
        baseline = self._canonical_projection(parse_blocks(CLEAN_FENCED_PATCH))
        self.assertEqual(len(baseline), 2)
        self.assertIn("vfs://insetu/insetu/alpha.py", baseline)
        self.assertIn("vfs://insetu/insetu/beta.py", baseline)

        bare_patch = (
            "<<<<<<< FILE: vfs://insetu/insetu/alpha.py\n"
            "<<<<<<< COMMENT\n"
            "Update alpha greeting\n"
            "<<<<<<< SEARCH\n"
            "def greet():\n"
            '    return "old_alpha"\n'
            "=======\n"
            "def greet():\n"
            '    return "new_alpha"\n'
            ">>>>>>> REPLACE\n"
            "\n"
            "<<<<<<< FILE: vfs://insetu/insetu/beta.py\n"
            "<<<<<<< COMMENT\n"
            "Update beta counter\n"
            "<<<<<<< SEARCH\n"
            "COUNT = 1\n"
            "=======\n"
            "COUNT = 2\n"
            ">>>>>>> REPLACE"
        )

        cases = {
            "1_bare_no_fences": bare_patch,
            "2_gemini_plaintext_label_without_fences": (
                "Plaintext\n"
                + bare_patch.replace(
                    "<<<<<<< FILE: vfs://insetu/insetu/beta.py",
                    "Plaintext\n<<<<<<< FILE: vfs://insetu/insetu/beta.py",
                )
            ),
            "3_plaintext_above_fenced_block": (
                "Plaintext\n" + CLEAN_FENCED_PATCH
            ),
            "4_chatgpt_text_and_copy_code_labels": (
                "text\nCopy code\n"
                "<<<<<<< FILE: vfs://insetu/insetu/alpha.py\n"
                "<<<<<<< COMMENT\n"
                "Update alpha greeting\n"
                "<<<<<<< SEARCH\n"
                "def greet():\n"
                '    return "old_alpha"\n'
                "=======\n"
                "def greet():\n"
                '    return "new_alpha"\n'
                ">>>>>>> REPLACE\n"
                "\n"
                "text\nCopy code\n"
                "<<<<<<< FILE: vfs://insetu/insetu/beta.py\n"
                "<<<<<<< COMMENT\n"
                "Update beta counter\n"
                "<<<<<<< SEARCH\n"
                "COUNT = 1\n"
                "=======\n"
                "COUNT = 2\n"
                ">>>>>>> REPLACE"
            ),
            "5_prose_before_and_after_fence": (
                "Here are the requested changes for both modules:\n\n"
                + CLEAN_FENCED_PATCH
                + "\n\nLet me know if you would like any adjustments!"
            ),
            "6_label_line_between_two_files_blocks": (
                "```text\n"
                "<<<<<<< FILE: vfs://insetu/insetu/alpha.py\n"
                "<<<<<<< COMMENT\n"
                "Update alpha greeting\n"
                "<<<<<<< SEARCH\n"
                "def greet():\n"
                '    return "old_alpha"\n'
                "=======\n"
                "def greet():\n"
                '    return "new_alpha"\n'
                ">>>>>>> REPLACE\n"
                "```\n"
                "Plaintext\n"
                "Copy code\n"
                "```text\n"
                "<<<<<<< FILE: vfs://insetu/insetu/beta.py\n"
                "<<<<<<< COMMENT\n"
                "Update beta counter\n"
                "<<<<<<< SEARCH\n"
                "COUNT = 1\n"
                "=======\n"
                "COUNT = 2\n"
                ">>>>>>> REPLACE\n"
                "```"
            ),
            "7_crlf_line_endings": CLEAN_FENCED_PATCH.replace("\n", "\r\n"),
            "8_nbsp_and_zero_width_spaces_in_prose_and_markers": (
                "Intro\u00a0prose\u200b with\u200c zero-width\ufeff chars.\n"
                "\u200b<<<<<<< FILE: vfs://insetu/insetu/alpha.py\u200d\n"
                "<<<<<<< COMMENT\u200b\n"
                "Update alpha greeting\n"
                "<<<<<<< SEARCH\u200c\n"
                "def greet():\n"
                '    return "old_alpha"\n'
                "=======\ufeff\n"
                "def greet():\n"
                '    return "new_alpha"\n'
                ">>>>>>> REPLACE\u200b\n"
                "Between\u00a0files\u200b prose.\n"
                "<<<<<<< FILE: vfs://insetu/insetu/beta.py\n"
                "<<<<<<< COMMENT\n"
                "Update beta counter\n"
                "<<<<<<< SEARCH\n"
                "COUNT = 1\n"
                "=======\n"
                "COUNT = 2\n"
                ">>>>>>> REPLACE"
            ),
            "9_trailing_spaces_on_marker_lines": (
                "<<<<<<< FILE: vfs://insetu/insetu/alpha.py   \t \n"
                "<<<<<<< COMMENT   \n"
                "Update alpha greeting\n"
                "<<<<<<< SEARCH   \t\n"
                "def greet():\n"
                '    return "old_alpha"\n'
                "=======    \n"
                "def greet():\n"
                '    return "new_alpha"\n'
                ">>>>>>> REPLACE   \t \n"
                "\n"
                "<<<<<<< FILE: vfs://insetu/insetu/beta.py   \n"
                "<<<<<<< COMMENT  \t\n"
                "Update beta counter\n"
                "<<<<<<< SEARCH   \n"
                "COUNT = 1\n"
                "=======  \t \n"
                "COUNT = 2\n"
                ">>>>>>> REPLACE    "
            ),
        }

        for name, wrapped_payload in cases.items():
            with self.subTest(wrapper=name):
                actual = self._canonical_projection(parse_blocks(wrapped_payload))
                self.assertEqual(actual, baseline, f"Wrapper case '{name}' did not parse identically to baseline")

    def test_label_line_inside_replace_body_is_kept_verbatim(self):
        patch_with_inner_labels = (
            "<<<<<<< FILE: vfs://insetu/insetu/alpha.py\n"
            "<<<<<<< COMMENT\n"
            "Preserve inner label lines verbatim\n"
            "<<<<<<< SEARCH\n"
            "LABELS = []\n"
            "=======\n"
            "Plaintext\n"
            "Copy code\n"
            'LABELS = ["Plaintext", "Copy code", "text"]\n'
            ">>>>>>> REPLACE"
        )
        parsed = parse_blocks(patch_with_inner_labels)
        blocks = parsed.get("vfs://insetu/insetu/alpha.py") or []
        self.assertEqual(len(blocks), 1)
        self.assertEqual(
            blocks[0]["replace"],
            'Plaintext\nCopy code\nLABELS = ["Plaintext", "Copy code", "text"]',
        )


if __name__ == "__main__":
    unittest.main()
