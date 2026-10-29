import os
import sys
import unittest

from insetu.core.utils_core import execute_binary


ENTRY_MODULES = (
    "insetu.core.sdk",
    "insetu.core.utils_core",
    "insetu.core.bridge.bridge_fuzzy",
    "insetu.core.remote.engine_remote",
)


class TestImportOrder(unittest.TestCase):
    """Every core entry point must import cleanly as the FIRST insetu import of a fresh interpreter (sdk <-> utils_core cycle)."""

    def _import_in_fresh_interpreter(self, module_name):
        env = dict(os.environ)
        env["PYTHONPATH"] = os.pathsep.join(p for p in sys.path if p)
        return execute_binary(
            [sys.executable, "-c", f"import {module_name}"],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )

    def test_each_entry_module_imports_first(self):
        for module_name in ENTRY_MODULES:
            with self.subTest(module=module_name):
                res = self._import_in_fresh_interpreter(module_name)
                self.assertEqual(res.returncode, 0, f"'import {module_name}' failed first:\n{res.stderr[-2000:]}")

    def test_sdk_lazily_re_exports_utils_core_names(self):
        import insetu.core.sdk as _sdk
        import insetu.core.utils_core as _utils_core
        from insetu.core.sdk import InSetuURI as _InSetuURI, update_frontmatter as _update_frontmatter
        self.assertIs(_InSetuURI, _utils_core.InSetuURI)
        self.assertIs(_update_frontmatter, _utils_core.update_frontmatter)
        with self.assertRaises(AttributeError):
            getattr(_sdk, "definitely_not_exported")


if __name__ == "__main__":
    unittest.main()
