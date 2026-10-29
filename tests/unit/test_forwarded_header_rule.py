import ast
import contextlib
import io
import unittest
from pathlib import Path

from tests.fitness.core import FitnessState
from tests.fitness.rules_python import BackendFitnessVisitor


class TestForwardedHeaderMembraneRule(unittest.TestCase):
    """S1: inSetu never reads client-identity forwarding headers; akasa's classify_peer() is the single source of truth."""

    SNIPPET = (
        "def sniff(request, environ):\n"
        "    a = request.headers.get('X-Forwarded-For')\n"
        "    b = request.headers.get('x-real-ip')\n"
        "    c = environ.get('HTTP_FORWARDED')\n"
        "    d = request.headers.get('Tailscale-User-Login')\n"
    )

    def _violations(self, rel_parts, is_test=False):
        fake_path = Path(__file__).resolve().parent.parent.parent.joinpath(*rel_parts)
        prev = FitnessState.violations_found
        FitnessState.violations_found = 0
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                BackendFitnessVisitor(fake_path, fake_path.name, is_test=is_test).visit(ast.parse(self.SNIPPET))
            return buf.getvalue()
        finally:
            FitnessState.violations_found = prev

    def test_core_and_extension_reads_are_flagged(self):
        for rel in (("insetu", "core", "remote", "engine_remote.py"), ("insetu", "extensions", "demo", "engine_demo.py")):
            with self.subTest(path="/".join(rel)):
                out = self._violations(rel)
                self.assertEqual(out.count("FORWARDED_HEADER_MEMBRANE"), 3, out)
                self.assertNotIn("Tailscale-User-Login", out, "Identity headers verified against whois are not forwarding headers")

    def test_tests_are_exempt(self):
        out = self._violations(("tests", "unit", "test_demo.py"), is_test=True)
        self.assertNotIn("FORWARDED_HEADER_MEMBRANE", out)


if __name__ == "__main__":
    unittest.main()
