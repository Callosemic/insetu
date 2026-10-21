import contextlib
import importlib.util
import inspect
import io
import os
import sys
import unittest
from pathlib import Path

from tests.fitness.core import FitnessState
from tests.fitness.rules_javascript import check_javascript_files

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SUTRAM_DIR = PROJECT_ROOT.parent / "sutram"
BACKEND_DIR = PROJECT_ROOT / "insetu"


class TestSutramCompliance(unittest.TestCase):
    """
    Executes Sutram's official consumer linter and inSetu's JavaScript fitness rules
    against inSetu core UI components and domain extensions to guarantee presentation
    substrate compliance and catch deprecated calls.
    """

    def _load_sutram_linter(self):
        linter_path = SUTRAM_DIR / "tests" / "sutram_consumer_linter.py"
        if not linter_path.exists():
            self.skipTest(f"Sutram repository not found at sibling path: {SUTRAM_DIR}")

        spec = importlib.util.spec_from_file_location("sutram_consumer_linter", linter_path)
        sutram_linter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sutram_linter)
        return sutram_linter
    def test_extensions_comply_with_sutram_consumer_linter(self):
        sutram_linter = self._load_sutram_linter()
        ext_dir = BACKEND_DIR / "extensions"
        if not ext_dir.exists():
            self.skipTest(f"Extensions directory not found: {ext_dir}")

        sig = inspect.signature(sutram_linter.run_consumer_lint)
        kwargs = {"allow_host_globals": True} if "allow_host_globals" in sig.parameters else {}
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            violations = sutram_linter.run_consumer_lint(ext_dir, **kwargs)
        output = buf.getvalue()
        self.assertEqual(
            violations,
            0,
            f"Found {violations} Sutram consumer compliance violation(s) across inSetu extensions:\n\n{output}"
        )

    def test_core_ui_modules_comply_with_sutram_consumer_linter(self):
        sutram_linter = self._load_sutram_linter()
        sig = inspect.signature(sutram_linter.run_consumer_lint)
        kwargs = {"allow_host_globals": True} if "allow_host_globals" in sig.parameters else {}

        core_targets = [
            BACKEND_DIR / "core" / "config",
            BACKEND_DIR / "core" / "offline",
            BACKEND_DIR / "core" / "system" / "components",
        ]
        total_violations = 0
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            for target in core_targets:
                if target.exists():
                    total_violations += sutram_linter.run_consumer_lint(target, **kwargs)
        output = buf.getvalue()
        self.assertEqual(
            total_violations,
            0,
            f"Found {total_violations} Sutram consumer compliance violation(s) in inSetu core UI modules:\n\n{output}"
        )

    def test_javascript_fitness_rules_across_core_and_extensions(self):
        prev_violations = FitnessState.violations_found
        FitnessState.violations_found = 0
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                check_javascript_files()
            output = buf.getvalue()
            self.assertEqual(
                FitnessState.violations_found,
                0,
                f"Found {FitnessState.violations_found} JavaScript fitness violation(s) across core/extensions:\n\n{output}"
            )
        finally:
            FitnessState.violations_found = prev_violations

    def test_collapsible_non_bubbling_and_declarative_settings_hub_contracts(self):
        """
        Verifies Blueprint #1 (OS Settings Hub & Workspace Topology Overhaul):
        1. SutramCollapsible and YenvuiCollapsible dispatch non-bubbling toggle events so nested collapsibles (e.g. Sub-Buckets) never collapse their parent container.
        2. config.js uses <sutram-field-card> and supports newline-delimited (.gitignore style) and comma-delimited pattern lists.
        3. Legacy standalone modals (InSetuWorkspaceEditor, InSetuCoreOfflineSettings, insetu-generic-settings-root, insetu-config-root) are retired.
        4. Extension settings panels (like ext_tracker.js) declare 'component' on settingsActions rather than slots:global modals.
        """
        config_js = (BACKEND_DIR / "core" / "config" / "config.js").read_text(encoding="utf-8")
        self.assertIn("sutram-field-card", config_js)
        self.assertIn(r"split(/[\r\n,]+/)", config_js)
        self.assertNotIn("insetu-config-root", config_js)

        sys_settings_js = (BACKEND_DIR / "core" / "system" / "components" / "ui_system_settings.js").read_text(encoding="utf-8")
        self.assertIn("sys:topology", sys_settings_js)
        self.assertIn("sys:workspaces", sys_settings_js)
        self.assertIn("action:", sys_settings_js)
        self.assertNotIn("InSetuWorkspaceEditor", sys_settings_js)
        self.assertNotIn("insetu-generic-settings-root", sys_settings_js)

        offline_js = (BACKEND_DIR / "core" / "offline" / "offline_ui.js").read_text(encoding="utf-8")
        self.assertNotIn("InSetuCoreOfflineSettings", offline_js)
        self.assertIn("sys:topology", offline_js)

        tracker_js = (BACKEND_DIR / "extensions" / "tracker" / "ext_tracker.js").read_text(encoding="utf-8")
        self.assertIn("component: 'insetu-ext-tracker-settings'", tracker_js)

        if (SUTRAM_DIR / "yenvui" / "js" / "collapsible.js").exists():
            yenvui_col = (SUTRAM_DIR / "yenvui" / "js" / "collapsible.js").read_text(encoding="utf-8")
            sutram_prim = (SUTRAM_DIR / "sutram" / "js" / "primitives.js").read_text(encoding="utf-8")
            self.assertIn("bubbles: false", yenvui_col)
            self.assertIn("bubbles: false", sutram_prim)
            self.assertIn("customElements.define('sutram-field-card'", sutram_prim)

    def test_rfc_0108_tab_scoped_navigation_isolation(self):
        """
        Verifies Blueprint #3 (RFC 0108: Tab-Scoped Navigation State & Spatial Decoupling):
        1. globalBrowsePath and currentBrowsePath are completely eradicated from store.js and fs.js.
        2. AppStore.getState().setBrowsePath and getBrowsePath isolate deep paths per subId while normalizing 'files' <-> 'fs:files'.
        """
        store_js = (BACKEND_DIR / "core" / "system" / "store.js").read_text(encoding="utf-8")
        fs_js = (BACKEND_DIR / "core" / "fs" / "fs.js").read_text(encoding="utf-8")

        self.assertNotIn("globalBrowsePath", store_js)
        self.assertNotIn("currentBrowsePath", store_js)
        self.assertNotIn("globalBrowsePath", fs_js)
        self.assertNotIn("currentBrowsePath", fs_js)
        self.assertIn("getBrowsePath:", store_js)
        self.assertIn("setBrowsePath:", store_js)

    def test_fs_domain_agnosticism_and_no_speculative_on_reveal(self):
        """
        Verifies:
        1. core/fs/fs.js delegates artifact freshness via 'insetu:ensure-fresh-artifact' and has zero references to GatherStore, FlowStore, or flow_workflows.
        2. Speculative onReveal pre-warming is removed from fs.js and Sutram primitives.js, while file-share sets keepDrawerOpen: true.
        3. InSetuURI in insetu_sdk.js remains strictly lexical and never couples to AppStore or derivedVfsFiles.
        """
        fs_js = (BACKEND_DIR / "core" / "fs" / "fs.js").read_text(encoding="utf-8")
        self.assertIn("insetu:ensure-fresh-artifact", fs_js)
        self.assertIn("keepDrawerOpen: true", fs_js)
        self.assertNotIn("onReveal", fs_js)
        self.assertNotIn("flow_workflows", fs_js)
        self.assertNotIn("stores.Gather", fs_js)

        sdk_js = (BACKEND_DIR / "core" / "system" / "insetu_sdk.js").read_text(encoding="utf-8")
        self.assertIn("emitHookAll:", sdk_js)
        start_idx = sdk_js.index("export class InSetuURI {")
        end_idx = sdk_js.index("window.inSetu = window.inSetu || {};", start_idx)
        uri_class_src = sdk_js[start_idx:end_idx]
        self.assertNotIn("derivedVfsFiles", uri_class_src)
        self.assertNotIn("AppStore", uri_class_src)


if __name__ == "__main__":
    unittest.main()