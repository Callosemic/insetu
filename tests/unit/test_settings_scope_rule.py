import ast
import contextlib
import io
import unittest
from pathlib import Path

from tests.fitness.core import FitnessState
from tests.fitness.rules_python import BackendFitnessVisitor


SNIPPET = '''
VIEW_ITEM_SCHEMA = [
    {"id": "label", "label": "View Label", "type": "text"},
    {"id": "layout", "label": "Layout", "type": "select", "options": [{"value": "board", "label": "Board"}]},
]
DEMO_SETTINGS_SCHEMA = [
    {
        "id": "endpoints",
        "label": "Endpoints",
        "type": "repeater",
        "scope": "daemon",
        "default": [{"id": "main", "label": "Main", "driver": "anthropic"}],
        "item_schema": [
            {"id": "label", "label": "Endpoint Label", "type": "text"},
            {"id": "tiers", "label": "Tiers", "type": "record", "fields": [
                {"id": "fast", "label": "Fast", "type": "text"},
            ]},
        ],
    },
    {"id": "views", "label": "Views", "type": "repeater", "scope": "workspace", "item_schema": VIEW_ITEM_SCHEMA},
    {"id": "missing_scope", "label": "Top-level field without scope", "type": "text"},
]
'''


class TestSettingsScopeRule(unittest.TestCase):
    """SETTINGS_SCOPE_MANDATE applies to top-level setting fields only; nested sub-fields inherit their parent's scope."""

    def _scan(self):
        fake_path = Path(__file__).resolve().parent.parent.parent / "insetu" / "extensions" / "demo" / "engine_demo.py"
        prev = FitnessState.violations_found
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                BackendFitnessVisitor(fake_path, "engine_demo.py", is_test=False).visit(ast.parse(SNIPPET))
        finally:
            FitnessState.violations_found = prev
        return buf.getvalue()

    def test_only_the_top_level_field_without_scope_is_flagged(self):
        out = self._scan()
        self.assertEqual(out.count("SETTINGS_SCOPE_MANDATE"), 1, out)
        self.assertIn("Setting field 'missing_scope'", out)


if __name__ == "__main__":
    unittest.main()
