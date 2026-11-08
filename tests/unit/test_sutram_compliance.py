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

    def _declared_sutram_properties(self, sutram_linter):
        if not hasattr(sutram_linter, "load_declared_properties"):
            self.skipTest("Sibling sutram predates the property contract check.")
        for candidate in (BACKEND_DIR / "static" / "vendor", SUTRAM_DIR):
            if candidate.exists():
                declared = sutram_linter.load_declared_properties(candidate)
                if declared:
                    return declared
        try:
            declared = sutram_linter.load_declared_properties()
            if declared:
                return declared
        except TypeError:
            pass
        return {}

    def test_sutram_tag_bindings_match_the_vendored_components(self):
        """
        Every <sutram-*> binding in inSetu (core and extensions) names a property the vendored component declares.
        A binding to an undeclared property, or a ?camelCase binding whose property reflects to a different
        attribute, does nothing at runtime and fails silently.
        """
        sutram_linter = self._load_sutram_linter()
        declared = self._declared_sutram_properties(sutram_linter)
        self.assertIn("sutram-view", declared, "Vendored sutram not found; run scripts/vendor_sutram.sh")
        problems = []
        for js_file in sorted(BACKEND_DIR.rglob("*.js")):
            if "vendor" in js_file.parts:
                continue
            text = js_file.read_text(encoding="utf-8")
            for tag, line, _attrs, names in sutram_linter.iter_sutram_tags(text):
                for binding in sutram_linter.undeclared_bindings(tag, names, declared):
                    problems.append(f"{js_file.relative_to(BACKEND_DIR).as_posix()}:{line} <{tag}> {binding}")
        self.assertEqual(problems, [], "Bindings to properties the sutram components do not declare:\n" + "\n".join(problems))

    def test_documented_sutram_properties_exist(self):
        """Every property docs/08_sutram_contracts.md lists for a <sutram-*> element is declared by the vendored component."""
        sutram_linter = self._load_sutram_linter()
        declared = self._declared_sutram_properties(sutram_linter)
        doc = (PROJECT_ROOT / "docs" / "08_sutram_contracts.md").read_text(encoding="utf-8")
        entry = re.compile(r"^\s*\*\s+\*\*`<(sutram-[a-z0-9-]+)>`(?:\s*&\s*`<(sutram-[a-z0-9-]+)>`)?\*\*:?(.*)$")
        problems = []
        for line in doc.splitlines():
            match = entry.match(line)
            if not match:
                continue
            listed = re.search(r"Properties:\s*(.*?)(?:\.\s+[A-Z][a-z]+:|\.\s*$|$)", match.group(3))
            if not listed:
                continue
            # Allowed values sit in parentheses after a property; only the property names are checked.
            names_part = re.sub(r"\([^)]*\)", "", listed.group(1))
            names = [re.sub(r"^[.?]", "", tok) for tok in re.findall(r"`([.?]?[A-Za-z_]\w*)`", names_part)]
            for tag in filter(None, match.group(1, 2)):
                props = declared.get(tag)
                if props is None:
                    problems.append(f"<{tag}> is documented but not defined")
                    continue
                attrs = {a for a in props.values() if a}
                problems += [f"<{tag}> {n}" for n in names if n not in props and n.lower() not in attrs]
        self.assertEqual(problems, [], "Documented properties the components do not declare:\n" + "\n".join(problems))

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
            BACKEND_DIR / "core" / "agent",
            BACKEND_DIR / "core" / "bridge",
            BACKEND_DIR / "core" / "config",
            BACKEND_DIR / "core" / "fs",
            BACKEND_DIR / "core" / "gather",
            BACKEND_DIR / "core" / "offline",
            BACKEND_DIR / "core" / "prompts",
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
        self.assertIn("sutram-field-card", config_js, "config.js must use <sutram-field-card>")
        self.assertIn(r"split(/[\r\n,]+/)", config_js, "config.js must split newline/comma pattern lists")
        self.assertNotIn("insetu-config-root", config_js, "Legacy insetu-config-root must not be in config.js")

        sys_settings_js = (BACKEND_DIR / "core" / "system" / "components" / "ui_system_settings.js").read_text(encoding="utf-8")
        self.assertIn("sys:topology", sys_settings_js, "ui_system_settings.js must route sys:topology")
        self.assertIn("sys:workspaces", sys_settings_js, "ui_system_settings.js must route sys:workspaces")
        self.assertIn("action:", sys_settings_js, "ui_system_settings.js must route action: views")
        self.assertNotIn("InSetuWorkspaceEditor", sys_settings_js, "Legacy InSetuWorkspaceEditor must be removed")
        self.assertNotIn("insetu-generic-settings-root", sys_settings_js, "Legacy insetu-generic-settings-root must be removed")

        offline_js = (BACKEND_DIR / "core" / "offline" / "offline_ui.js").read_text(encoding="utf-8")
        self.assertNotIn("InSetuCoreOfflineSettings", offline_js, "Legacy InSetuCoreOfflineSettings must be removed")
        self.assertIn("sys:topology", offline_js, "offline_ui.js must route settings to sys:topology")

        tracker_js = (BACKEND_DIR / "extensions" / "tracker" / "ext_tracker.js").read_text(encoding="utf-8")
        self.assertIn("component: 'insetu-ext-tracker-settings'", tracker_js, "ext_tracker.js must declare component: 'insetu-ext-tracker-settings'")
        if (SUTRAM_DIR / "yenvui" / "js" / "collapsible.js").exists():
            yenvui_col = (SUTRAM_DIR / "yenvui" / "js" / "collapsible.js").read_text(encoding="utf-8")
            sutram_prim = (SUTRAM_DIR / "sutram" / "js" / "primitives.js").read_text(encoding="utf-8")
            self.assertIn("bubbles: false", yenvui_col, "YenvuiCollapsible toggle event must set bubbles: false")
            self.assertIn("bubbles: false", sutram_prim, "SutramCollapsible toggle event must set bubbles: false")
            self.assertIn("customElements.define('sutram-field-card'", sutram_prim, "primitives.js must register sutram-field-card")

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
            self.assertIn("CHASSIS_PROVIDER_META", yenvui_src, "yenvui/js/index.js must export CHASSIS_PROVIDER_META")
            self.assertIn("sharedStyles", yenvui_src, "yenvui/js/index.js must export sharedStyles")
            self.assertIn("physics", yenvui_src, "yenvui/js/index.js must export physics")

            prim_src = sutram_prim.read_text(encoding="utf-8")
            self.assertIn("export const REQUIRED_CHASSIS_PRIMITIVES", prim_src, "primitives.js must export REQUIRED_CHASSIS_PRIMITIVES")
            self.assertIn("export function validateChassisContract", prim_src, "primitives.js must export validateChassisContract")
            self.assertNotIn("../../yenvui/", prim_src, "primitives.js must not use relative ../../yenvui/ imports")
            # Execute validateChassisContract in Node by importing directly from 'sutram' via js_loader.mjs
            loader_path = (Path(__file__).resolve().parent / "js_loader.mjs").resolve()
            node_test = """
import assert from 'node:assert/strict';
import { REQUIRED_CHASSIS_PRIMITIVES, validateChassisContract } from 'sutram';

const DummyChassis = { CHASSIS_PROVIDER_META: { name: 'dummy-chassis', version: '1.0.0' } };
for (const name of REQUIRED_CHASSIS_PRIMITIVES) {
    DummyChassis[name] = class {};
}
assert.equal(validateChassisContract(DummyChassis), true);

const IncompleteChassis = { ...DummyChassis };
delete IncompleteChassis.Modal;
delete IncompleteChassis.Card;
assert.throws(
    () => validateChassisContract(IncompleteChassis),
    /\\[Sutram Boot Error\\] Chassis 'dummy-chassis' fails contract\\. Missing primitives: Card, Modal/
);
"""
            res = _execute_binary(
                ["node", "--import", loader_path.as_posix(), "--input-type=module", "-e", node_test],
                timeout=10.0,
            )
            self.assertEqual(res.returncode, 0, f"Chassis contract gatekeeper Node test failed:\n{res.stderr}")

    def test_rfc_0108_tab_scoped_navigation_isolation(self):
        """
        Verifies Blueprint #3 (RFC 0108: Tab-Scoped Navigation State & Spatial Decoupling):
        1. globalBrowsePath and currentBrowsePath are completely eradicated from store.js and fs.js.
        2. AppStore.getState().setBrowsePath and getBrowsePath isolate deep paths per subId while normalizing 'files' <-> 'fs:files'.
        """
        store_js = (BACKEND_DIR / "core" / "system" / "store.js").read_text(encoding="utf-8")
        fs_js = (BACKEND_DIR / "core" / "fs" / "fs.js").read_text(encoding="utf-8")

        self.assertNotIn("globalBrowsePath", store_js, "store.js must not reference globalBrowsePath")
        self.assertNotIn("currentBrowsePath", store_js, "store.js must not reference currentBrowsePath")
        self.assertNotIn("globalBrowsePath", fs_js, "fs.js must not reference globalBrowsePath")
        self.assertNotIn("currentBrowsePath", fs_js, "fs.js must not reference currentBrowsePath")
        self.assertIn("getBrowsePath:", store_js, "store.js must define getBrowsePath")
        self.assertIn("setBrowsePath:", store_js, "store.js must define setBrowsePath")

    def test_fs_domain_agnosticism_and_no_speculative_on_reveal(self):
        """
        Verifies:
        1. core/fs/fs.js delegates artifact freshness via 'insetu:ensure-fresh-artifact' and has zero references to GatherStore, FlowStore, or flow_workflows.
        2. Speculative onReveal pre-warming is removed from fs.js and Sutram primitives.js, while file-share sets keepDrawerOpen: true.
        3. InSetuURI in insetu_sdk.js remains strictly lexical and never couples to AppStore or derivedVfsFiles.
        """
        fs_js = (BACKEND_DIR / "core" / "fs" / "fs.js").read_text(encoding="utf-8")
        self.assertIn("insetu:ensure-fresh-artifact", fs_js, "fs.js must emit insetu:ensure-fresh-artifact")
        self.assertIn("keepDrawerOpen: true", fs_js, "fs.js share actions must set keepDrawerOpen: true")
        self.assertNotIn("onReveal", fs_js, "fs.js must not use speculative onReveal pre-warming")
        self.assertNotIn("flow_workflows", fs_js, "fs.js must not hardcode flow_workflows")
        self.assertNotIn("stores.Gather", fs_js, "fs.js must not couple directly to stores.Gather")
        sdk_js = (BACKEND_DIR / "core" / "system" / "insetu_sdk.js").read_text(encoding="utf-8")
        uri_js = (BACKEND_DIR / "core" / "system" / "uri.js").read_text(encoding="utf-8")
        element_js = (BACKEND_DIR / "core" / "system" / "insetu_element.js").read_text(encoding="utf-8")
        vendor_sutram_js = "\n".join(
            p.read_text(encoding="utf-8")
            for p in sorted((BACKEND_DIR / "static" / "vendor" / "sutram" / "js").glob("*.js"))
        )
        combined_membrane_src = sdk_js + "\n" + uri_js + "\n" + element_js + "\n" + vendor_sutram_js
        for lego_export in ("SutramIcon", "SutramView", "SutramStack", "SutramSurface", "SutramActionBar", "SutramFloatingHud", "SutramComposer", "SutramSpinner", "SutramEmptyState"):
            self.assertIn(lego_export, combined_membrane_src, f"Missing Lego primitive export '{lego_export}' in SDK membrane")
        self.assertIn("emitHookAll:", sdk_js, "insetu_sdk.js must define emitHookAll")
        self.assertIn("_resolveScopedPath:", element_js, "insetu_element.js must define _resolveScopedPath")

    def test_workflow_management_suite_canonical_api_routes(self):
        """
        Verifies that all API calls across the Workflow Automation and Task Management
        extension suite (cronic, favorites, hooks, tracker) use explicit canonical
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
            r'\b(?:this\.api|window\.inSetu\.api)\.(?:get|post|delete|getJson|postJson|deleteJson|bindJobAction)\(\s*([\'`"])([^?\'"`\s)]+)'
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
        self.assertIn("if (!isFS)", fs_js, "fs.js resolveFileFetchUrl must guard insetu:file-fetch-url with if (!isFS)")
        self.assertIn("toggleBufferPreview:", fs_js, "fs.js FsStore must define toggleBufferPreview")
        self.assertIn("id: 'file-preview'", fs_js, "fs.js must register file-preview action")
        self.assertIn("id: 'file-copy-expanded'", fs_js, "fs.js must register file-copy-expanded action")
        self.assertIn("id: 'file-share-expanded'", fs_js, "fs.js must register file-share-expanded action")
        self.assertIn("id: 'file-download-expanded'", fs_js, "fs.js must register file-download-expanded action")
        self.assertIn("resolveExpandedExportText", fs_js, "fs.js must define resolveExpandedExportText")
        self.assertIn("Macro-Expanded Preview (Read-Only)", fs_js, "fs.js must render Macro-Expanded Preview banner")
        self.assertIn("if (this._buffer?.previewMode) return;", fs_js, "fs.js must guard edits when previewMode is active")
        self.assertIn("id: 'editor-toggle-macro-preview'", ui_editor_js, "ui_editor.js must register editor-toggle-macro-preview")
        self.assertIn("{ previewMode: !isEditable }", prompts_js, "prompts.js must pass { previewMode: !isEditable }")
        self.assertNotIn("insetu:file-fetch-url", prompts_js, "prompts.js must not register insetu:file-fetch-url")


if __name__ == "__main__":
    unittest.main()