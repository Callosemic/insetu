import contextlib
import importlib.util
import inspect
import io
import os
import re
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

    def test_three_layer_chassis_provider_contract_and_single_file_membrane(self):
        """
        Verifies the 2026-10-28 Three-Layer Frontend Ring & Chassis Provider Blueprint:
        1. vendor.json maps 'sutram' -> 'vendor/sutram/js/index.js' and 'sutram-chassis' -> 'vendor/yenvui/js/index.js'.
        2. yenvui/js/index.js exports CHASSIS_PROVIDER_META, sharedStyles, physics, and all 29 REQUIRED_CHASSIS_PRIMITIVES.
        3. validateChassisContract passes for a compliant provider and throws [Sutram Boot Error] when any required primitive is missing.
        4. insetu_sdk.js is the sole file in inSetu core/extensions importing from 'sutram'.
        """
        import json as _json
        from insetu.core.utils_core import execute_binary as _execute_binary

        vendor_json = _json.loads((BACKEND_DIR / "static" / "vendor.json").read_text(encoding="utf-8"))
        imports_map = vendor_json.get("imports", {})
        self.assertEqual(imports_map.get("sutram", {}).get("path"), "vendor/sutram/js/index.js")
        self.assertEqual(imports_map.get("sutram-chassis", {}).get("path"), "vendor/yenvui/js/index.js")

        yenvui_index = SUTRAM_DIR / "yenvui" / "js" / "index.js"
        sutram_index = SUTRAM_DIR / "sutram" / "js" / "index.js"
        sutram_prim = SUTRAM_DIR / "sutram" / "js" / "primitives.js"
        if yenvui_index.exists() and sutram_index.exists():
            yenvui_src = yenvui_index.read_text(encoding="utf-8")
            self.assertIn("CHASSIS_PROVIDER_META", yenvui_src)
            self.assertIn("sharedStyles", yenvui_src)
            self.assertIn("physics", yenvui_src)

            prim_src = sutram_prim.read_text(encoding="utf-8")
            self.assertIn("export const REQUIRED_CHASSIS_PRIMITIVES", prim_src)
            self.assertIn("export function validateChassisContract", prim_src)
            self.assertNotIn("../../yenvui/", prim_src)
            # Execute validateChassisContract in Node against both a complete DummyChassis and an incomplete provider
            start_idx = prim_src.index("export const REQUIRED_CHASSIS_PRIMITIVES")
            end_idx = prim_src.index("SutramUIAdapter.registerChassis(Chassis);")
            contract_fn_code = prim_src[start_idx:end_idx]

            node_test = f"""
import assert from 'node:assert/strict';
{contract_fn_code}

const DummyChassis = {{ CHASSIS_PROVIDER_META: {{ name: 'dummy-chassis', version: '1.0.0' }} }};
for (const name of REQUIRED_CHASSIS_PRIMITIVES) {{
    DummyChassis[name] = class {{}};
}}
assert.equal(validateChassisContract(DummyChassis), true);

const IncompleteChassis = {{ ...DummyChassis }};
delete IncompleteChassis.Modal;
delete IncompleteChassis.Card;
assert.throws(
    () => validateChassisContract(IncompleteChassis),
    /\\[Sutram Boot Error\\] Chassis 'dummy-chassis' fails contract\\. Missing primitives: Card, Modal/
);
"""
            res = _execute_binary(["node", "--input-type=module", "-e", node_test], timeout=10.0)
            self.assertEqual(res.returncode, 0, f"Chassis contract gatekeeper Node test failed:\n{res.stderr}")

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
        self.assertIn("_resolveScopedPath:", sdk_js)
        start_idx = sdk_js.index("export class InSetuURI {")
        end_idx = sdk_js.index("window.inSetu = window.inSetu || {};", start_idx)
        uri_class_src = sdk_js[start_idx:end_idx]
        self.assertNotIn("derivedVfsFiles", uri_class_src)
        self.assertNotIn("AppStore", uri_class_src)

    def test_canonical_api_route_resolution_contract(self):
        """
        Verifies that InSetuElement.api._resolveScopedPath:
        1. Preserves canonical self-prefixed routes ('flow/batches/save' -> 'flow/batches/save').
        2. Preserves cross-module routes ('prompts/resolve?file=...' -> 'prompts/resolve?file=...').
        3. Gracefully prefixes legacy relative routes ('batches/save' -> 'flow/batches/save').
        """
        sdk_js = (BACKEND_DIR / "core" / "system" / "insetu_sdk.js").read_text(encoding="utf-8")
        self.assertIn("_resolveScopedPath:", sdk_js)
        self.assertIn("this.api._resolveScopedPath(path)", sdk_js)
        api_js = (BACKEND_DIR / "core" / "system" / "api.js").read_text(encoding="utf-8")
        self.assertIn("getJson:", api_js)
        self.assertIn("postJson:", api_js)
        self.assertIn("deleteJson:", api_js)

    def test_workflow_management_suite_canonical_api_routes(self):
        """
        Verifies that all API calls across the Workflow Automation and Task Management
        extension suite (cronic, favorites, flow, hooks, tracker) use explicit canonical
        route prefixes (<module>/<endpoint>) to eliminate runtime path prepending ambiguity.
        """
        ext_dir = BACKEND_DIR / "extensions"
        management_files = {
            "cronic": ext_dir / "cronic" / "ext_cronic.js",
            "favorites": ext_dir / "favorites" / "ext_favorites.js",
            "hooks": ext_dir / "hooks" / "ext_hooks.js",
            "tracker": ext_dir / "tracker" / "ext_tracker.js",
        }

        api_call_pattern = re.compile(
            r'\b(?:this\.api|window\.inSetu\.api(?:\.workspace)?)\.(?:get|post|delete|getJson|postJson|deleteJson|bindJobAction)\(\s*([\'`"])([^?\'"`\s)]+)'
        )
        known_modules = {
            "bridge", "gather", "cartographer", "config", "editor", "fs", "system",
            "workers", "auth", "security", "topology", "offline", "llm", "agent", "prompts", "mcp", "remote",
            "citations", "cronic", "dev", "favorites", "format", "freshdesk",
            "git", "hooks", "ingest", "notes", "preview", "publish", "research", "skills",
            "term", "tracker", "update"
        }
        banned_unprefixed_routes = {
            "toggle", "delete", "list", "status", "logs", "schedule", "run_now", "kill",
            "add", "batches", "save", "execute", "new", "index", "files", "spawn_template",
            "vocab_settings", "restore_metadata", "transition"
        }

        for ext_name, js_file in management_files.items():
            self.assertTrue(js_file.exists(), f"Extension file missing: {js_file}")
            content = js_file.read_text(encoding="utf-8")
            matches = list(api_call_pattern.finditer(content))
            self.assertGreater(
                len(matches),
                0,
                f"Expected API calls in {ext_name} ({js_file.name}), but none were found."
            )

            for match in matches:
                raw_route = match.group(2).strip().lstrip("/")
                segments = [s for s in raw_route.split("/") if s]
                prefix = segments[0] if segments else ""
                self.assertIn(
                    prefix,
                    known_modules,
                    f"Non-canonical API route '{raw_route}' in {ext_name} ({js_file.name}). "
                    f"Prefix '{prefix}' is not in known API modules."
                )
                self.assertNotIn(
                    raw_route,
                    banned_unprefixed_routes,
                    f"Banned unprefixed relative route '{raw_route}' found in {ext_name} ({js_file.name}). "
                    f"Must be prefixed with '{ext_name}/{raw_route}'."
                )

    def test_dual_representation_macro_preview_contract(self):
        """
        Verifies the Dual-Representation Buffer Contract (2026-10-20 RFC):
        1. resolveFileFetchUrl only emits 'insetu:file-fetch-url' when !isFS so editable buffers always fetch raw source from fs/fetch.
        2. FsStore implements toggleBufferPreview posting live content to prompts/resolve.
        3. file-preview and editor-toggle-macro-preview entity actions are registered.
        4. prompts.js routes editable cards to previewMode: false and read-only templates to previewMode: true.
        """
        fs_js = (BACKEND_DIR / "core" / "fs" / "fs.js").read_text(encoding="utf-8")
        ui_editor_js = (BACKEND_DIR / "core" / "system" / "components" / "ui_editor.js").read_text(encoding="utf-8")
        prompts_js = (BACKEND_DIR / "core" / "prompts" / "prompts.js").read_text(encoding="utf-8")
        self.assertIn("if (!isFS)", fs_js)
        self.assertIn("toggleBufferPreview:", fs_js)
        self.assertIn("id: 'file-preview'", fs_js)
        self.assertIn("id: 'file-copy-expanded'", fs_js)
        self.assertIn("id: 'file-share-expanded'", fs_js)
        self.assertIn("id: 'file-download-expanded'", fs_js)
        self.assertIn("resolveExpandedExportText", fs_js)
        self.assertIn("Macro-Expanded Preview (Read-Only)", fs_js)
        self.assertIn("if (this._buffer?.previewMode) return;", fs_js)
        self.assertIn("id: 'editor-toggle-macro-preview'", ui_editor_js)
        self.assertIn("{ previewMode: !isEditable }", prompts_js)
        self.assertNotIn("insetu:file-fetch-url", prompts_js)


if __name__ == "__main__":
    unittest.main()