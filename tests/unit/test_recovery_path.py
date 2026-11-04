"""S8: the recovery path is smoke-tested before every write, keeps a last-good lifeboat, and can rotate its token."""
import contextlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import insetu.core.protected_changes as protected_changes
import insetu.recovery_check as recovery_check
from insetu.cli import load_recovery_app
from insetu.core.sdk import execute_confirmed_protected_write, execute_vfs_save, execution_frame, sync_vfs_barrier
from insetu.core.system.cli_commands import rotate_session_token_cli
from tests.unit.test_protected_changes import BROKEN, ORIGINAL, _ProtectedCase

PACKAGE_DIR = Path(recovery_check.__file__).resolve().parent
LIFEBOAT_SOURCE = (PACKAGE_DIR / "fallback_bridge.py").read_text(encoding="utf-8")
try:
    import akasa.auth.credentials as _akasa_credentials

    CREDENTIALS_SOURCE = Path(_akasa_credentials.__file__).read_text(encoding="utf-8")
except ImportError:  # pragma: no cover - akasa is a dependency
    CREDENTIALS_SOURCE = ""
LIFEBOAT_URI = "vfs://insetu/insetu/fallback_bridge.py"


def _run_check(kind, source, path="/nowhere/file.py"):
    err = io.StringIO()
    with patch.object(sys, "stdin", io.StringIO(source)), contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
        with tempfile.TemporaryDirectory() as scratch:
            cwd = os.getcwd()
            os.chdir(scratch)
            try:
                code = recovery_check.main([kind, path])
            finally:
                os.chdir(cwd)
    return code, err.getvalue()


class TestRecoveryChecks(unittest.TestCase):
    """insetu/recovery_check.py passes the shipped recovery files and fails broken versions of each."""

    def test_the_shipped_files_pass(self):
        for kind, source in (("cli", (PACKAGE_DIR / "cli.py").read_text(encoding="utf-8")), ("lifeboat", LIFEBOAT_SOURCE), ("credentials", CREDENTIALS_SOURCE)):
            with self.subTest(kind=kind):
                self.assertEqual(_run_check(kind, source), (0, ""))

    def test_broken_versions_fail(self):
        cases = {
            "cli": "def main():\n    pass\n",
            "lifeboat": LIFEBOAT_SOURCE.replace("def run_recovery_app", "def renamed_recovery_app"),
            "credentials": CREDENTIALS_SOURCE.replace("return hmac.compare_digest", "return True or hmac.compare_digest"),
        }
        for kind, source in cases.items():
            with self.subTest(kind=kind):
                code, err = _run_check(kind, source)
                self.assertEqual(code, 1)
                self.assertIn(f"{kind} smoke test failed", err)
        self.assertEqual(_run_check("lifeboat", "import nonexistent_module_for_s8\n")[0], 1)


class TestConfirmingRecoveryFiles(_ProtectedCase):
    """Confirmed changes and editor saves to recovery files run the smoke test; the lifeboat keeps a last-good copy."""

    def setUp(self):
        super().setUp()
        self.lifeboat = self.root / "insetu" / "insetu" / "fallback_bridge.py"
        self.lifeboat.write_text(LIFEBOAT_SOURCE, encoding="utf-8")

    def _lifeboat_text(self):
        sync_vfs_barrier("default")
        return self.lifeboat.read_text(encoding="utf-8")

    def _confirm(self, content):
        with execution_frame(origin="agent"):
            change_id = execute_vfs_save("default", LIFEBOAT_URI, content)["change_id"]
        with execution_frame(transport="HTTP"):
            return protected_changes.confirm(change_id, protected_changes.content_hash(content))

    def test_a_change_that_breaks_the_lifeboat_is_refused_at_confirm(self):
        broken = LIFEBOAT_SOURCE.replace("def run_recovery_app", "def renamed_recovery_app")
        body, status = self._confirm(broken)
        self.assertEqual(status, 422, body)
        self.assertIn("lifeboat smoke test failed", body["error"])
        self.assertEqual(self._lifeboat_text(), LIFEBOAT_SOURCE)
        self.assertEqual(protected_changes.count_pending(), 1, "a refused change stays pending, to discard or fix")
        self.assertIn("smoke_failed", self._audit_events())

    def test_a_good_change_keeps_the_previous_lifeboat_as_last_good(self):
        improved = LIFEBOAT_SOURCE + "\n# S8 test: a harmless change\n"
        body, status = self._confirm(improved)
        self.assertEqual(status, 200, body)
        self.assertEqual(self._lifeboat_text(), improved)
        sync_vfs_barrier("default")
        last_good = protected_changes.last_good_dir() / "fallback_bridge.py"
        self.assertEqual(last_good.read_text(encoding="utf-8"), LIFEBOAT_SOURCE)
        self.assertEqual(self._audit_events()[-2:], ["last_good_saved", "confirmed"])

    def test_a_broken_current_lifeboat_is_not_kept_as_last_good(self):
        execute_confirmed_protected_write("default", LIFEBOAT_URI, "raise RuntimeError('broken')\n")
        body, status = self._confirm(LIFEBOAT_SOURCE)
        self.assertEqual(status, 200, body)
        sync_vfs_barrier("default")
        self.assertFalse((protected_changes.last_good_dir() / "fallback_bridge.py").exists())
        self.assertIn("last_good_kept", self._audit_events())

    def test_an_editor_save_that_breaks_the_cli_is_not_written(self):
        with execution_frame(transport="HTTP"):
            body = execute_vfs_save("default", "vfs://insetu/insetu/cli.py", BROKEN, {protected_changes.SOURCE_KEY: protected_changes.EDITOR_SOURCE})
        self.assertEqual((body["status"], body["status_code"]), ("error", 422))
        self.assertEqual(self._cli_text(), ORIGINAL)


class TestPanicFallback(unittest.TestCase):
    """When the current lifeboat will not import, the panic path boots the last-good copy."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name).resolve()

    def tearDown(self):
        self.temp_dir.cleanup()

    def _write_last_good(self):
        path = self.root.joinpath(".insetu", "recovery", "last_good", "fallback_bridge.py")
        path.parent.mkdir(parents=True)
        path.write_text("def run_recovery_app():\n    return 'last-good lifeboat'\n", encoding="utf-8")

    def test_an_emptied_lifeboat_boots_the_last_good_copy(self):
        shadow_pkg = self.root / "shadow" / "insetu"
        shadow_pkg.mkdir(parents=True)
        (shadow_pkg / "fallback_bridge.py").write_text("", encoding="utf-8")  # the current lifeboat, emptied
        self._write_last_good()
        with patch.object(sys, "path", [shadow_pkg.parent.as_posix()] + sys.path), patch.dict(sys.modules):
            sys.modules.pop("insetu.fallback_bridge", None)
            with contextlib.redirect_stdout(io.StringIO()):
                run = load_recovery_app(self.root.as_posix())
        self.assertEqual(run(), "last-good lifeboat")

    def test_without_a_last_good_copy_the_import_error_surfaces(self):
        with patch.dict(sys.modules, {"insetu.fallback_bridge": None}), contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(ImportError):
                load_recovery_app(self.root.as_posix())

    def test_the_lifeboat_falls_back_to_the_last_good_credential_store(self):
        broken = self.root.joinpath("akasa", "akasa", "auth", "credentials.py")
        broken.parent.mkdir(parents=True)
        broken.write_text("raise ImportError('broken credential store')\n", encoding="utf-8")
        last_good = self.root.joinpath(".insetu", "recovery", "last_good", "credentials.py")
        last_good.parent.mkdir(parents=True)
        last_good.write_text(CREDENTIALS_SOURCE, encoding="utf-8")
        cwd = os.getcwd()
        os.chdir(self.root)
        try:
            with patch("importlib.util.find_spec", return_value=None), contextlib.redirect_stdout(io.StringIO()):
                lifeboat = recovery_check.load_source("s8_test_lifeboat", LIFEBOAT_SOURCE, self.root.joinpath("insetu", "insetu", "fallback_bridge.py").as_posix())
                module = lifeboat._credentials_module()
                token = lifeboat.current_token()
        finally:
            os.chdir(cwd)
            sys.modules.pop("s8_test_lifeboat", None)
        self.assertEqual(Path(module.__file__).resolve(), last_good.resolve())
        self.assertTrue(token and lifeboat._token_matches(token))


class TestAuthRotate(unittest.TestCase):
    """insetu auth rotate replaces the token and prints it once."""

    def test_rotate_replaces_the_token_and_prints_it_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            control = Path(tmp) / ".insetu"
            old = _akasa_credentials.load_or_create_token(control)
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                new = rotate_session_token_cli(tmp)
            self.assertNotEqual(new, old)
            self.assertEqual(_akasa_credentials.read_token(control), new)
            self.assertFalse(_akasa_credentials.verify_token(old, _akasa_credentials.read_token(control)))
            self.assertEqual(out.getvalue().count(new), 1)
            self.assertIn("sign in again", out.getvalue())


if __name__ == "__main__":
    unittest.main()
