"""Checks the fitness rule that reports Python the project's oldest supported version would reject."""
import sys
import unittest

from tests.fitness.rules_python_floor import floor_violations, read_python_floor


class TestPythonVersionFloorRule(unittest.TestCase):
    """PYTHON_VERSION_FLOOR finds newer-only syntax and standard-library names from any Python version."""

    def _reasons(self, source, floor=(3, 10)):
        return [reason for _line, reason in floor_violations(source, floor)]

    def test_backslash_inside_fstring_braces_is_reported(self):
        """The form that broke CI on 3.10 and 3.11: a backslash inside an f-string's braces."""
        source = "y = f\"data: {json.dumps({'e': '\\n'.join(p)})}\"\n"
        self.assertEqual(len(floor_violations(source)), 1)
        self.assertEqual(floor_violations(source)[0][0], 1)

    def test_other_newer_only_fstring_forms_are_reported(self):
        for name, source in {
            "own quote reused": 'x = f"{d["k"]}"\n',
            "comment in braces": 'x = f"""{\n  y  # note\n}"""\n',
            "line break in a single-line f-string": 'x = f"{\n y}"\n',
        }.items():
            with self.subTest(form=name):
                self.assertTrue(floor_violations(source), source)

    def test_fstrings_every_supported_version_accepts_are_not_reported(self):
        for source in (
            "x = f\"{d['k']} {a!r:>{w}} \\n\"\n",          # other quote inside; backslash in the literal part
            'x = f"""{d["k"]}\n{\n  y\n}"""\n',            # triple-quoted: inner quotes and line breaks
            "x = f\"{f'{a}'} {x:{'>'}{10}}\"\n",           # nested f-string with the other quote
            "x = f\"{a:\\n>10}\"\n",                        # backslash in a format spec
            "x = f\"{ {'a': 1}['a'] }\"\n",                 # a dict literal inside the braces
        ):
            with self.subTest(source=source):
                self.assertEqual(floor_violations(source), [])

    def test_newer_only_statements_are_reported(self):
        if sys.version_info < (3, 12):
            self.skipTest("This interpreter cannot parse 3.12 syntax, so it reports it as a parse error instead.")
        self.assertTrue(self._reasons("try:\n    pass\nexcept* ValueError:\n    pass\n"))
        self.assertTrue(self._reasons("type X = int\n"))
        self.assertTrue(self._reasons("def f[T](x: T) -> T:\n    return x\n"))
        self.assertEqual(self._reasons("match x:\n    case 1:\n        pass\n"), [])

    def test_newer_standard_library_names_are_reported_unless_guarded(self):
        self.assertEqual(self._reasons("import tomllib\n"), ["tomllib needs Python 3.11"])
        self.assertEqual(self._reasons("from typing import Self, Optional\n"), ["typing.Self needs Python 3.11"])
        self.assertEqual(self._reasons("import datetime\nx = datetime.UTC\n"), ["datetime.UTC needs Python 3.11"])
        self.assertEqual(self._reasons("try:\n    import tomllib\nexcept ImportError:\n    tomllib = None\n"), [])

    def test_a_higher_floor_allows_what_it_supports(self):
        self.assertEqual(self._reasons("import tomllib\n", floor=(3, 11)), [])
        self.assertEqual(self._reasons("from itertools import batched\n", floor=(3, 11)), ["itertools.batched needs Python 3.12"])

    def test_floor_is_read_from_pyproject(self):
        self.assertEqual(read_python_floor('[project]\nrequires-python = ">=3.10"\n'), (3, 10))
        self.assertEqual(read_python_floor('requires-python = ">=3.11,<4"\n'), (3, 11))
        self.assertEqual(read_python_floor("[project]\nname = 'x'\n"), (3, 10))
        self.assertEqual(read_python_floor(None), (3, 10))


if __name__ == "__main__":
    unittest.main()
