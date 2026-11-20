import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import tests.fitness.core as fitness_core
import tests.fitness.rules_javascript as rules_js


class TestColumnBandFitnessRule(unittest.TestCase):
    """Verifies RAW_BAND_WIDTH_BAN enforces docs/models/column_bands.md without comment false positives."""

    def _run_js_rule_on_source(self, js_source: str) -> list:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            sample_file = tmp_path / "sample_component.js"
            sample_file.write_text(js_source, encoding="utf-8")

            recorded = []

            def _capture(rule_name, filepath, line_num, message):
                recorded.append((rule_name, Path(filepath), line_num, message))

            with patch.object(rules_js, "FRONTEND_DIR", tmp_path), \
                 patch.object(rules_js, "BACKEND_DIR", tmp_path / "missing_backend"), \
                 patch.object(rules_js, "report_violation", side_effect=_capture), \
                 patch.object(fitness_core, "report_violation", side_effect=_capture):
                rules_js.check_javascript_files()

            return [v for v in recorded if v[0] == "RAW_BAND_WIDTH_BAN"]

    def test_flags_raw_breakpoints_and_width_comparisons(self):
        bad_js = (
            "const q1 = '@container (min-width: 720px) { .row { display: flex; } }';\n"
            "const q2 = window.matchMedia('(max-width: 520px)');\n"
            "const isWide = el.clientWidth >= 720;\n"
            "const isCompact = 384 > colW;\n"
        )
        violations = self._run_js_rule_on_source(bad_js)
        lines = sorted(v[2] for v in violations)
        self.assertEqual(lines, [1, 2, 3, 4], f"Expected violations on lines 1..4, got {violations}")

    def test_allows_column_band_helpers_and_comments(self):
        good_js = (
            "// Mentions @media (max-width: 720px) and innerWidth < 540 only in a comment.\n"
            "/* Block comment: clientWidth >= 1080 */\n"
            "const band = columnBandOf(measuredWidth);\n"
            "observeColumnBand(this, (info) => { this.isCompact = info.compact; });\n"
        )
        violations = self._run_js_rule_on_source(good_js)
        self.assertEqual(violations, [], f"Expected zero RAW_BAND_WIDTH_BAN violations, got {violations}")


if __name__ == "__main__":
    unittest.main()
