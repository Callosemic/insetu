"""Wave 1 A4 fitness ratchets and SDK membrane tests for the System & Core Utils decomposition."""
import ast
import contextlib
import io
from pathlib import Path
import shutil
import unittest

import insetu.core.sdk as sdk
from insetu.core.system import blueprint, ext_manager, memory_profiler, openapi, security_io, watchdog
from insetu.core.system.engine_system import system_bp
import insetu.core.utils_core as utils_core
from insetu.core.utils_core import execute_binary
import tempfile
from tests.fitness.core import FitnessState
from tests.fitness.rules_python import (
    BackendFitnessVisitor,
    check_internal_imports_resolve,
    check_module_size_ratchet,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LOADER_PATH = (Path(__file__).resolve().parent / "js_loader.mjs").resolve()


class TestWave1Ratchets(unittest.TestCase):
    """Enforces Wave 1 A4 fitness ratchets (banned legacy imports, extension membrane ratchet, module size ratchet)."""

    def test_wave1_module_size_ratchet(self):
        self.assertEqual(check_module_size_ratchet(REPO_ROOT), [])

    def test_python_system_submodules_and_no_utils_core_shims(self):
        # 0. Shared blueprint module (Pattern 1): engine_system and ext_manager share the exact same system_bp instance
        self.assertIs(blueprint.system_bp, system_bp)
        self.assertTrue(callable(ext_manager.api_workspace_extension_approve))
        self.assertTrue(callable(ext_manager.api_workspace_extension_revoke))

        # 1. Extracted modules own their symbols
        self.assertTrue(callable(watchdog.start_filesystem_observer))
        self.assertTrue(callable(watchdog.stop_filesystem_observer))
        self.assertTrue(callable(security_io.child_env))
        self.assertTrue(callable(security_io.fetch_url))
        self.assertTrue(callable(security_io.approve_command))
        self.assertTrue(callable(ext_manager.scan_workspace_extensions))
        self.assertTrue(callable(ext_manager.approve_workspace_extension))
        self.assertTrue(callable(ext_manager._background_install_extension_deps))
        self.assertTrue(callable(openapi.build_system_openapi_spec))
        self.assertTrue(callable(memory_profiler.collect_process_memory_telemetry))

        # 2. Repeater secret and VFS/YAML/macro helpers stay in utils_core.py
        self.assertTrue(callable(utils_core.get_repeater_secret))
        self.assertTrue(callable(utils_core.set_repeater_secret))
        self.assertTrue(callable(utils_core.resolve_macro_includes))
        self.assertTrue(callable(utils_core.parse_frontmatter))
        self.assertTrue(callable(utils_core.sanitize_workspace_config))

        # 3. Rule B: utils_core.py has zero legacy shims for moved symbols
        for moved_sym in ("child_env", "fetch_url", "approve_command", "scan_workspace_extensions", "start_filesystem_observer"):
            self.assertFalse(hasattr(utils_core, moved_sym), f"utils_core.py must not retain a shim for moved symbol '{moved_sym}'")

        # 4. Rule A: insetu.core.sdk lazily re-exports extension-facing symbols
        for name in (
            "get_workspace_physics",
            "get_sister_repos",
            "child_env",
            "fetch_url",
            "FetchRefused",
            "FetchHTTPError",
            "approve_command",
            "scan_workspace_extensions",
            "approve_workspace_extension",
            "get_repeater_secret",
            "set_repeater_secret",
        ):
            self.assertIsNotNone(getattr(sdk, name, None), f"insetu.core.sdk missing re-export '{name}'")

    def test_banned_legacy_imports_and_extension_membrane_ratchet(self):
        prev = FitnessState.violations_found
        try:
            # 1. Importing moved symbol from utils_core or engine_system flags BANNED_WAVE1_LEGACY_IMPORT
            bad_legacy = (
                "from insetu.core.utils_core import fetch_url, child_env\n"
                "from insetu.core.system.engine_system import build_system_openapi_spec\n"
            )
            fake_core = REPO_ROOT / "insetu" / "core" / "llm" / "engine_llm.py"
            buf1 = io.StringIO()
            with contextlib.redirect_stdout(buf1):
                BackendFitnessVisitor(fake_core, fake_core.name, is_test=False).visit(ast.parse(bad_legacy))
            self.assertEqual(buf1.getvalue().count("BANNED_WAVE1_LEGACY_IMPORT"), 3, buf1.getvalue())

            # 2. Extension importing from insetu.core.system.* or unratcheted utils_core symbol flags EXTENSION_MEMBRANE_RATCHET
            bad_ext = (
                "from insetu.core.system.security_io import fetch_url\n"
                "from insetu.core.utils_core import get_sister_repos\n"
                "__depends__ = []\n"
            )
            fake_ext = REPO_ROOT / "insetu" / "extensions" / "notes" / "engine_notes.py"
            buf2 = io.StringIO()
            with contextlib.redirect_stdout(buf2):
                BackendFitnessVisitor(fake_ext, fake_ext.name, is_test=False).visit(ast.parse(bad_ext))
            self.assertEqual(buf2.getvalue().count("EXTENSION_MEMBRANE_RATCHET"), 2, buf2.getvalue())

            # 3. Leaf module re-exported by insetu.core.sdk importing a barrel-re-exported symbol from insetu.core.sdk flags BARREL_CYCLE_BAN
            bad_leaf = "from insetu.core.sdk import InSetuURI\n"
            fake_leaf = REPO_ROOT / "insetu" / "core" / "system" / "security_io.py"
            buf3 = io.StringIO()
            with contextlib.redirect_stdout(buf3):
                BackendFitnessVisitor(fake_leaf, fake_leaf.name, is_test=False).visit(ast.parse(bad_leaf))
            self.assertEqual(buf3.getvalue().count("BARREL_CYCLE_BAN"), 1, buf3.getvalue())

            # 4. Calling an unimported/renamed function inside a body flags UNDEFINED_SYMBOL_CALL_BAN
            bad_call = "def run():\n    return _nonexistent_renamed_helper(1)\n"
            buf4 = io.StringIO()
            with contextlib.redirect_stdout(buf4):
                BackendFitnessVisitor(fake_core, fake_core.name, is_test=False).visit(ast.parse(bad_call))
            self.assertEqual(buf4.getvalue().count("UNDEFINED_SYMBOL_CALL_BAN"), 1, buf4.getvalue())

            # 5. Caching self.*_cache on InSetuContext in sdk/__init__.py flags CONTEXT_INSTANCE_CACHE_BAN
            bad_ctx_cache = "class InSetuContext:\n    def m(self):\n        self._manifest_cache = {}\n"
            fake_sdk = REPO_ROOT / "insetu" / "core" / "sdk" / "__init__.py"
            buf5 = io.StringIO()
            with contextlib.redirect_stdout(buf5):
                BackendFitnessVisitor(fake_sdk, fake_sdk.name, is_test=False).visit(ast.parse(bad_ctx_cache))
            self.assertEqual(buf5.getvalue().count("CONTEXT_INSTANCE_CACHE_BAN"), 1, buf5.getvalue())

            # 6. Importing a non-existent symbol from an internal insetu.* module flags BROKEN_INTERNAL_IMPORT_BAN
            self.assertEqual(check_internal_imports_resolve(REPO_ROOT), [])
            with tempfile.TemporaryDirectory() as tmp:
                tmp_root = Path(tmp)
                (tmp_root / "insetu" / "core").mkdir(parents=True)
                (tmp_root / "tests" / "unit").mkdir(parents=True)
                (tmp_root / "insetu" / "core" / "mod_a.py").write_text("def real_fn():\n    return 1\n", encoding="utf-8")
                (tmp_root / "tests" / "unit" / "test_a.py").write_text("from insetu.core.mod_a import missing_fn\n", encoding="utf-8")
                broken = check_internal_imports_resolve(tmp_root)
                self.assertEqual(len(broken), 1)
                self.assertIn("BROKEN_INTERNAL_IMPORT_BAN", broken[0])
        finally:
            FitnessState.violations_found = prev

    def test_frontend_sdk_and_system_reexports_in_node(self):
        if not shutil.which("node"):
            self.skipTest("Node.js binary is not installed in PATH")

        node_script = """
import assert from 'node:assert/strict';
import { InSetuURI as DirectURI, BucketAddress as DirectBucket } from '/static/extensions/system/uri.js';
import { InSetuElement as DirectElement } from '/static/extensions/system/insetu_element.js';
import { InSetuURI, BucketAddress, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { InSetuSchemaRepeater } from '/static/extensions/system/components/ui_schema_repeater.js';
import { checkManifestVersion, refreshManifest } from '/static/extensions/system/manifest_sync.js';

assert.equal(InSetuURI, DirectURI);
assert.equal(BucketAddress, DirectBucket);
assert.equal(InSetuElement, DirectElement);
assert.equal(typeof InSetuSchemaRepeater, 'function');
assert.equal(typeof checkManifestVersion, 'function');
assert.equal(typeof refreshManifest, 'function');
console.log('WAVE1_JS_REEXPORTS_OK');
"""
        res = execute_binary(
            ["node", "--import", LOADER_PATH.as_posix(), "--input-type=module", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=15.0,
        )
        self.assertEqual(res.returncode, 0, f"Node Wave 1 re-export check failed:\n{res.stderr}")
        self.assertIn("WAVE1_JS_REEXPORTS_OK", res.stdout)


if __name__ == "__main__":
    unittest.main()
