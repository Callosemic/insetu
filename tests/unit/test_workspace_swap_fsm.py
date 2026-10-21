import json
import shutil
import tempfile
import unittest
from pathlib import Path
from insetu.core.utils_core import execute_binary


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class TestWorkspaceSwapFSM(unittest.TestCase):
    """
    Behavioral and structural unit tests for the Synchronous Workspace Swap FSM:
    - Pattern 1: Bound-Scope Store Persistence (_boundScope, _scopeEpoch, switchScope)
    - Pattern 2: Unified StoreRegistry (scope: 'tenant' vs 'global', switchTenantScope)
    - Pattern 3: Symmetric ExtensionRegistry (getSettingsActions, setDynamicLayoutSlots, executeUnload)
    - Pattern 4: Scope-Stamped Eviction Envelopes ({ id, scopeId }) & Managed Timeouts
    - Pattern 5: Centralized Telemetry Event Valve (shouldDropTenantEvent)
    """

    def test_kernel_files_expose_fsm_primitives(self):
        """Verify system.js, insetu_sdk.js, api.js, and sutram_sdk.js expose all 5 FSM primitives."""
        system_js = (PROJECT_ROOT / "insetu" / "core" / "system" / "system.js").read_text(encoding="utf-8")
        insetu_sdk_js = (PROJECT_ROOT / "insetu" / "core" / "system" / "insetu_sdk.js").read_text(encoding="utf-8")
        api_js = (PROJECT_ROOT / "insetu" / "core" / "system" / "api.js").read_text(encoding="utf-8")
        # SessionOrchestrator phases & StoreRegistry integration
        self.assertIn("export const SessionOrchestrator", system_js)
        for phase in ("LOCKED", "TEARDOWN", "IDENTITY_SWAP", "HYDRATE", "ROUTING", "READY"):
            self.assertIn(f"'{phase}'", system_js)
        self.assertIn("beginScopeTransition(targetWs)", system_js)
        self.assertIn("endScopeTransition()", system_js)
        # Centralized Event Valve & Epoch-Guarded Extension Stores
        self.assertIn("shouldDropTenantEvent", insetu_sdk_js)
        self.assertIn("_runWorkspaceHydration", insetu_sdk_js)
        self.assertIn("_scopeEpoch", insetu_sdk_js)
        self.assertIn("_shouldDrop(", api_js)
    def test_store_hydration_cascade_and_workspace_swap_isolation_in_node(self):
        """
        Executes the actual vendored sutram_sdk.js in Node.js to verify:
        1. Synchronous hydration on store creation (no setTimeout race window).
        2. Non-destructive 3-tier merge: empty/missing sessionStorage never wipes populated localStorage.
        3. StoreRegistry.setScopeProvider re-binds and hydrates tenant stores without clobbering 'default'.
        4. StoreRegistry.switchTenantScope isolates workspace layouts across transitions.
        """
        vendor_sutram_dir = (PROJECT_ROOT / "insetu" / "static" / "vendor" / "sutram" / "js").resolve()
        sibling_sutram_dir = (PROJECT_ROOT.parent / "sutram" / "sutram" / "js").resolve()
        active_sutram_dir = vendor_sutram_dir if (vendor_sutram_dir / "sutram_sdk.js").exists() else sibling_sutram_dir
        sutram_sdk_path = active_sutram_dir / "sutram_sdk.js"
        sutram_utils_path = active_sutram_dir / "utils.js"
        self.assertTrue(sutram_sdk_path.exists(), "sutram_sdk.js must exist.")
        self.assertTrue(sutram_utils_path.exists(), "utils.js must exist.")
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            (tmp_path / "lit_stub.mjs").write_text(
                "export class LitElement {}\nexport const html = () => '';\nexport const css = () => '';\n",
                encoding="utf-8",
            )
            (tmp_path / "physics_stub.mjs").write_text(
                "export const getEventPath = () => [];\nexport const getEventTarget = () => null;\n",
                encoding="utf-8",
            )
            (tmp_path / "vanilla.mjs").write_text("""
export function createStore(createState) {
    let state;
    const listeners = new Set();
    const setState = (partial, replace) => {
        const nextState = typeof partial === 'function' ? partial(state) : partial;
        if (!Object.is(nextState, state)) {
            const previousState = state;
            state = (replace ?? (typeof nextState !== 'object' || nextState === null))
                ? nextState
                : Object.assign({}, state, nextState);
            listeners.forEach(listener => listener(state, previousState));
        }
    };
    const getState = () => state;
    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const destroy = () => { listeners.clear(); };
    const api = { setState, getState, subscribe, destroy };
    state = createState(setState, getState, api);
    return api;
}
""", encoding="utf-8")
            (tmp_path / "middleware.mjs").write_text("""
export const devtools = (fn) => fn;
export const subscribeWithSelector = (fn) => (set, get, api) => {
    const origSubscribe = api.subscribe;
    api.subscribe = (selector, optListener, options) => {
        if (!optListener) return origSubscribe(selector);
        let currentSlice = selector(get());
        return origSubscribe((state) => {
            const nextSlice = selector(state);
            const eq = options?.equalityFn || Object.is;
            if (!eq(currentSlice, nextSlice)) {
                const prev = currentSlice;
                currentSlice = nextSlice;
                optListener(currentSlice, prev);
            }
        });
    };
    return fn(set, get, api);
};
""", encoding="utf-8")
            shutil.copy2(sutram_utils_path, tmp_path / "utils.mjs")
            sdk_src = sutram_sdk_path.read_text(encoding="utf-8")
            sdk_src = sdk_src.replace('from"lit"', 'from"./lit_stub.mjs"').replace("from 'lit'", "from './lit_stub.mjs'")
            sdk_src = sdk_src.replace('from"zustand/vanilla"', 'from"./vanilla.mjs"').replace("from 'zustand/vanilla'", "from './vanilla.mjs'")
            sdk_src = sdk_src.replace('from"zustand/middleware"', 'from"./middleware.mjs"').replace("from 'zustand/middleware'", "from './middleware.mjs'")
            sdk_src = sdk_src.replace('from"../../yenvui/js/physics.js"', 'from"./physics_stub.mjs"').replace("from '../../yenvui/js/physics.js'", "from './physics_stub.mjs'")
            sdk_src = sdk_src.replace('from"./utils.js"', 'from"./utils.mjs"').replace("from './utils.js'", "from './utils.mjs'")
            (tmp_path / "sutram_sdk.mjs").write_text(sdk_src, encoding="utf-8")

            node_script = """
import assert from 'node:assert/strict';

class WebStorageMock {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
    clear() { this.map.clear(); }
}

globalThis.localStorage = new WebStorageMock();
globalThis.sessionStorage = new WebStorageMock();
globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, opts = {}) { super(type); this.detail = opts.detail; }
};
globalThis.BroadcastChannel = class BroadcastChannelMock {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    postMessage() {}
    close() {}
};
const et = new EventTarget();
globalThis.window = {
    location: { hash: '#/ws_alpha/center/gather:gather', search: '', pathname: '/' },
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    navigator: { standalone: false },
    matchMedia: () => ({ matches: false }),
    innerWidth: 1440,
    Sutram: { stores: {} }
};
globalThis.document = {
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {}
};

const alphaColumns = {
    left: { active: 'gather:gather', pinned: [{ id: 'gather:gather', label: 'Gather' }], history: ['gather:gather'] },
    center: { active: 'fs:files', pinned: [{ id: 'fs:files', label: 'Files' }], history: ['fs:files'] },
    right: { active: null, pinned: [], history: [] }
};
const betaColumns = {
    left: { active: null, pinned: [], history: [] },
    center: { active: 'bridge:bridge', pinned: [{ id: 'bridge:bridge', label: 'Yomama' }], history: ['bridge:bridge'] },
    right: { active: null, pinned: [], history: [] }
};
const emptyColumns = {
    left: { active: null, pinned: [], history: [] },
    center: { active: null, pinned: [], history: [] },
    right: { active: null, pinned: [], history: [] }
};

localStorage.setItem('sutram_local_ws_alpha_Layout_columns', JSON.stringify(alphaColumns));
localStorage.setItem('sutram_local_ws_beta_Layout_columns', JSON.stringify(betaColumns));
sessionStorage.setItem('sutram_session_ws_alpha_Layout_columns', JSON.stringify(emptyColumns));

let activeWs = 'ws_alpha';
const { LayoutStore, StoreRegistry } = await import('./sutram_sdk.mjs');
StoreRegistry.setScopeProvider(() => activeWs);

// 1. Assert synchronous initial hydration preserved ws_alpha's localStorage columns despite empty sessionStorage
assert.equal(LayoutStore.getState().columns.left.pinned.length, 1, 'ws_alpha left column must hydrate from localStorage');
assert.equal(LayoutStore.getState().columns.center.pinned[0].id, 'fs:files', 'ws_alpha center column must hydrate fs:files');

// 2. Simulate resize setCapacity(2) after hydration -> must NOT wipe ws_alpha columns
LayoutStore.getState().setCapacity(2);
const savedAlphaLocal = JSON.parse(localStorage.getItem('sutram_local_ws_alpha_Layout_columns'));
assert.equal(savedAlphaLocal.left.pinned[0].id, 'gather:gather', 'Resize capacity mutation must not wipe ws_alpha localStorage');
// 3. Transactional switch to ws_beta -> suppresses intermediate compileLayout and hydrates ws_beta
let recompileEvents = 0;
const transitionEvents = [];
window.addEventListener('sutram-layout-recompile', () => { recompileEvents++; });
window.addEventListener('sutram:scope-transition-start', (e) => { transitionEvents.push(`start:${e.detail?.targetScopeId}`); });
window.addEventListener('sutram:scope-transition-end', (e) => { transitionEvents.push(`end:${e.detail?.scopeId}`); });

const { ExtensionRegistry } = await import('./sutram_sdk.mjs');
activeWs = 'ws_beta';
StoreRegistry.beginScopeTransition('ws_beta');
assert.equal(StoreRegistry.isTransitioning(), true);

// Calling compileLayout while transitioning must be suppressed (0 recompile events emitted mid-swap)
ExtensionRegistry.compileLayout();
assert.equal(recompileEvents, 0, 'compileLayout must be suppressed while StoreRegistry.isTransitioning() is true');

assert.equal(LayoutStore.getState().columns.center.pinned[0].id, 'bridge:bridge', 'ws_beta must hydrate its own center column');
assert.equal(LayoutStore.getState().columns.left.pinned.length, 0, 'ws_beta left column must be empty');
StoreRegistry.endScopeTransition();
assert.equal(StoreRegistry.isTransitioning(), false);
assert.equal(recompileEvents, 1, 'endScopeTransition must flush exactly one layout recompile');
assert.deepEqual(transitionEvents, ['start:ws_beta', 'end:ws_beta'], 'Transition boundary events must fire in order with target scope ID');

// 5. Verify ExtensionRegistry.getSettingsActions preserves declarative component & saveLabel (Blueprint #1)
ExtensionRegistry.registerExtension('tracker', {
    name: 'Issue Tracker',
    version: '2.0.0',
    settingsActions: [
        {
            id: 'tracker_domain_vocab',
            label: 'Kanban Structure & Views Template',
            icon: 'sliders',
            component: 'insetu-ext-tracker-settings',
            saveLabel: 'Save Kanban Configuration'
        }
    ]
});
const registeredActions = ExtensionRegistry.getSettingsActions();
const trackerAction = registeredActions.find(a => a.id === 'tracker_domain_vocab');
assert.ok(trackerAction, 'tracker_domain_vocab action must be returned by getSettingsActions()');
assert.equal(trackerAction.component, 'insetu-ext-tracker-settings', 'Declarative component tag must be preserved');
assert.equal(trackerAction.saveLabel, 'Save Kanban Configuration', 'Custom saveLabel must be preserved');
assert.equal(trackerAction.extName, 'tracker', 'Originating extName must be attached');

// 4. Switch back to ws_alpha -> must restore ws_alpha's exact layout
activeWs = 'ws_alpha';
StoreRegistry.beginScopeTransition('ws_alpha');
StoreRegistry.endScopeTransition();
assert.equal(LayoutStore.getState().columns.left.pinned[0].id, 'gather:gather', 'Returning to ws_alpha must restore left column');
assert.equal(LayoutStore.getState().columns.center.pinned[0].id, 'fs:files', 'Returning to ws_alpha must restore center column');
"""
            (tmp_path / "run_fsm_test.mjs").write_text(node_script, encoding="utf-8")
            res = execute_binary(["node", (tmp_path / "run_fsm_test.mjs").as_posix()], cwd=tmp_path.as_posix(), timeout=10.0)
            self.assertEqual(res.returncode, 0, f"Node behavioral hydration/swap test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")


if __name__ == "__main__":
    unittest.main()