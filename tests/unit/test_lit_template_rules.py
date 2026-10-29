import re
import unittest

from tests.fitness.rules_javascript import strip_lit_expressions


BUTTON_LABEL_PATTERN = re.compile(r'<sutram-btn\b(?!.*label=)[^>]*>[^<]+\S')


class TestLitTemplateRuleHelpers(unittest.TestCase):
    """The sutram-btn label rule must not mistake '=>' inside a Lit binding for the end of the tag."""

    def test_icon_only_button_with_arrow_handler_is_not_a_text_child(self):
        line = ('<sutram-btn size="sm" icon="chevron-down" ?disabled=${idx === list.length - 1} '
                '@click=${e => { e.stopPropagation(); this._moveItem(idx, 1); }}></sutram-btn>')
        self.assertIsNotNone(BUTTON_LABEL_PATTERN.search(line), "Unstripped, the regex misfires (the original bug)")
        self.assertIsNone(BUTTON_LABEL_PATTERN.search(strip_lit_expressions(line)))

    def test_raw_text_child_is_still_detected(self):
        line = '<sutram-btn intent="primary" @click=${() => this.save()}>Save</sutram-btn>'
        self.assertIsNotNone(BUTTON_LABEL_PATTERN.search(strip_lit_expressions(line)))

    def test_nested_braces_and_unterminated_bindings(self):
        self.assertEqual(strip_lit_expressions('x=${ {a: {b: 1}} } y'), 'x=${} y')
        self.assertEqual(strip_lit_expressions('x=${ open'), 'x=${}')


if __name__ == "__main__":
    unittest.main()
