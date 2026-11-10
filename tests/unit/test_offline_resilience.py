"""Behavioral and contract unit tests for Sutram Offline Micro-Kernel resilience and host policy inversion."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from insetu.core.utils_core import execute_binary

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SUTRAM_ROOT = REPO_ROOT.parent / "sutram"
LOADER_PATH = (Path(__file__).resolve().parent / "js_loader.mjs").resolve()


class TestOfflineResilienceContracts(unittest.TestCase):
    """Verifies offline boot invariants across system.js, api.js, index.html, and executes Sutram offline kernel in Node.js."""

    def test_boot_import_retry_and_failure_classification_in_node(self):
        """An import failing with a fetch TypeError is retried and classified as 'network' (not quarantined), whereas a SyntaxError or 404 is classified as 'code_or_404' (quarantined)."""
        if not shutil.which("node"):
            self.skipTest("Node.js binary is not installed in PATH")

        node_script = """
import assert from 'node:assert/strict';
import { importModuleWithRetry, classifyBootModuleFailure } from '/static/extensions/system/system.js';

// 1. Transient fetch TypeError retries with backoff and succeeds on 3rd attempt
let attempts = 0;
const recovered = await importModuleWithRetry(
    '/static/extensions/notes/ext_notes.js',
    async () => {
        attempts++;
        if (attempts < 3) throw new TypeError('Failed to fetch dynamically imported module');
        return { ok: true };
    },
    [5, 10]
);
assert.equal(attempts, 3, 'importModuleWithRetry must retry transient fetch TypeErrors');
assert.equal(recovered.ok, true);

// 2. Fetch TypeError when server is unreachable (HEAD throws or returns 502) classifies as 'network' (never quarantined)
let finalFetchErr = null;
try {
    await importModuleWithRetry(
        '/static/extensions/notes/ext_notes.js',
        async () => { throw new TypeError('Failed to fetch dynamically imported module'); },
        [1, 1]
    );
} catch (err) {
    finalFetchErr = err;
}
const netKind = await classifyBootModuleFailure(
    '/static/extensions/notes/ext_notes.js',
    finalFetchErr,
    async () => { throw new TypeError('Network unreachable'); }
);
assert.equal(netKind, 'network', 'Unreachable server during import() must classify as network, not code_or_404');

// 3. SyntaxError classifies immediately as 'code_or_404' without retrying
let syntaxAttempts = 0;
let caughtSyntax = null;
try {
    await importModuleWithRetry(
        '/static/extensions/broken/ext_broken.js',
        async () => {
            syntaxAttempts++;
            throw new SyntaxError('Unexpected token export');
        },
        [5, 5]
    );
} catch (err) {
    caughtSyntax = err;
}
assert.equal(syntaxAttempts, 1, 'SyntaxError must not be retried');
const syntaxKind = await classifyBootModuleFailure('/static/extensions/broken/ext_broken.js', caughtSyntax);
assert.equal(syntaxKind, 'code_or_404', 'SyntaxError must be quarantined');

// 4. Missing file (HEAD returns 404) classifies as 'code_or_404'
const missingKind = await classifyBootModuleFailure(
    '/static/extensions/missing/ext_missing.js',
    new TypeError('Failed to fetch dynamically imported module'),
    async () => new Response(null, { status: 404 })
);
assert.equal(missingKind, 'code_or_404', 'HTTP 404 on HEAD probe must be quarantined');
process.exit(0);
"""
        res = execute_binary(
            ["node", "--import", LOADER_PATH.as_posix(), "--input-type=module", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=10.0,
        )
        self.assertEqual(res.returncode, 0, f"Node boot import classification test failed:\n{res.stderr}")

    def test_workspace_swap_never_purges_service_worker_caches(self):
        """SessionOrchestrator.transitionToWorkspace in Node.js via js_loader.mjs never invokes caches.delete or unregisters the Service Worker."""
        if not shutil.which("node"):
            self.skipTest("Node.js binary is not installed in PATH")

        node_script = """
import assert from 'node:assert/strict';

let cacheDeleteCalls = 0;
globalThis.caches = {
    keys: async () => ['sutram-static-v1'],
    delete: async () => { cacheDeleteCalls++; return true; }
};
globalThis.fetch = async () => new Response(JSON.stringify({ repos: [], extensions: ['config'] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
});

const { SessionOrchestrator } = await import('/static/extensions/system/system.js');
await SessionOrchestrator.transitionToWorkspace('ws_beta', { updateHash: false });
assert.equal(cacheDeleteCalls, 0, 'transitionToWorkspace must never delete Service Worker caches');
process.exit(0);
"""
        res = execute_binary(
            ["node", "--import", LOADER_PATH.as_posix(), "--input-type=module", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=10.0,
        )
        self.assertEqual(res.returncode, 0, f"Node transitionToWorkspace test failed:\n{res.stderr}")

    def test_hard_reset_preserves_boot_token_and_guards_offline_caches(self):
        """The crash/reset actions in index.html must read insetu_boot_token from localStorage/sessionStorage."""
        index_html = (REPO_ROOT / "insetu" / "templates" / "index.html").read_text(encoding="utf-8")
        self.assertTrue(
            "localStorage.getItem('insetu_boot_token')" in index_html,
            "index.html must read insetu_boot_token from localStorage",
        )

    def test_api_wires_ioc_offline_policies_and_gateway_fallback(self):
        """api.js must wire probeUrl, shouldCacheGet (with per-repo offline_capable check), and 502/503/504 handling."""
        api_js = (REPO_ROOT / "insetu" / "core" / "system" / "api.js").read_text(encoding="utf-8")
        self.assertIn("probeUrl: '/auth/bootstrap'", api_js)
        self.assertIn("shouldCacheGet:", api_js)
        self.assertIn("repoCfg.offline_capable", api_js)
        self.assertIn("[502, 503, 504].includes(res.status)", api_js)

    def test_sutram_offline_kernel_has_zero_host_route_leaks(self):
        """sutram/js/offline.js and sw-core.js must remain domain-agnostic without hardcoded inSetu API routes."""
        offline_candidates = [REPO_ROOT / "insetu" / "static" / "vendor" / "sutram" / "js" / "offline.js"]
        sw_candidates = [REPO_ROOT / "insetu" / "static" / "vendor" / "sutram" / "js" / "sw-core.js"]
        if (SUTRAM_ROOT / "sutram" / "js" / "offline.js").is_file():
            offline_candidates.insert(0, SUTRAM_ROOT / "sutram" / "js" / "offline.js")
        if (SUTRAM_ROOT / "sutram" / "js" / "sw-core.js").is_file():
            sw_candidates.insert(0, SUTRAM_ROOT / "sutram" / "js" / "sw-core.js")

        offline_src = offline_candidates[0].read_text(encoding="utf-8")
        for banned_route in ("'/deltas'", "'/jobs/'", "'/search'", "'/auth/bootstrap'", "'/api/'", "'/api/system/'"):
            self.assertNotIn(banned_route, offline_src)
        self.assertIn("emitOfflineTelemetry", offline_src)
        self.assertIn("subscribeTelemetry", offline_src)
        self.assertIn("evictByPrefix", offline_src)

        sw_src = sw_candidates[0].read_text(encoding="utf-8")
        self.assertIn("APP_SHELL_KEY", sw_src)
        self.assertIn("_extractSameOriginAssetsFromHtml", sw_src)
        self.assertIn("502, 503, 504", sw_src)
        self.assertIn("_isCacheableResponse", sw_src)

        # Verify loadBatchResilient retries failed imports and probes with HEAD so network drops never quarantine modules
        sys_src = (REPO_ROOT / "insetu" / "core" / "system" / "system.js").read_text(encoding="utf-8")
        self.assertIn("classifyBootModuleFailure", sys_src)
        self.assertIn("Can't reach the inSetu server. Retrying.", sys_src)

        # Verify api.js reverts vfs_cache when an offline save to a protected file returns pending_confirmation
        api_src = (REPO_ROOT / "insetu" / "core" / "system" / "api.js").read_text(encoding="utf-8")
        self.assertIn("sutram-outbox-item-synced", api_src)
        self.assertIn("pending_confirmation", api_src)

        # Verify index.html stamps insetu-build-id and renders Open offline copy / Try again / Reset app / conditional Lifeboat
        index_src = (REPO_ROOT / "insetu" / "templates" / "index.html").read_text(encoding="utf-8")
        self.assertIn('name="insetu-build-id"', index_src)
        self.assertIn("Open offline copy", index_src)
        self.assertIn("Try again", index_src)
        self.assertIn("Reset app", index_src)
        self.assertIn("boot-lifeboat-link", index_src)

    def test_offline_http_provider_and_sutram_db_behavioral_in_node(self):
        """
        Executes offline.js in Node.js to verify:
        1. Network-First GET pulls fresh content when online (even if isOffline was sticky) and updates SutramDB.
        2. 502/503/504 Bad Gateway responses (e.g. Tailscale Serve when daemon is stopped) fall back to SutramDB and flip isOffline=true.
        3. shouldCacheGet predicate prevents non-offline_capable repos or polling routes from polluting SutramDB.
        4. SutramDB.enqueueMutation atomically updates/deletes vfs_cache (Read-Your-Writes overlay) and preserves base_hash on collapseKey compaction.
        5. SutramDB.evictByPrefix removes only matching repository blobs for the target scope.
        """
        if not shutil.which("node"):
            self.skipTest("Node.js binary is not installed in PATH")

        offline_path = (
            SUTRAM_ROOT / "sutram" / "js" / "offline.js"
            if (SUTRAM_ROOT / "sutram" / "js" / "offline.js").is_file()
            else REPO_ROOT / "insetu" / "static" / "vendor" / "sutram" / "js" / "offline.js"
        )

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "package.json").write_text(json.dumps({"type": "module"}), encoding="utf-8")
            shutil.copy2(offline_path, tmp_path / "offline.mjs")

            node_script = """
import assert from 'node:assert/strict';
import { SutramDB, OfflineHttpProvider, emitOfflineTelemetry } from './offline.mjs';

const et = new EventTarget();
globalThis.window = {
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    Sutram: { stores: {} }
};
globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, opts = {}) { super(type, opts); this.detail = opts.detail ?? null; }
};
globalThis.IDBKeyRange = { only: (val) => val };
Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true
});

// In-memory IndexedDB mock supporting vfs_cache, manifest_cache, and sutram_outbox
const storesData = {
    vfs_cache: new Map(),
    manifest_cache: new Map(),
    sutram_outbox: []
};
SutramDB._db = {
    transaction: (storeNames, mode) => {
        const tx = {
            oncomplete: null,
            onerror: null,
            objectStore: (name) => {
                if (name === 'vfs_cache' || name === 'manifest_cache') {
                    const map = storesData[name];
                    return {
                        get: (key) => {
                            const req = {};
                            queueMicrotask(() => {
                                req.result = map.get(key);
                                if (req.onsuccess) req.onsuccess({ target: req });
                                if (tx.oncomplete) tx.oncomplete();
                            });
                            return req;
                        },
                        put: (val, key) => {
                            map.set(key, val);
                            queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
                        },
                        delete: (key) => {
                            map.delete(key);
                            queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
                        },
                        openKeyCursor: () => {
                            const req = {};
                            const keys = Array.from(map.keys());
                            let idx = 0;
                            const step = () => {
                                if (idx < keys.length) {
                                    const k = keys[idx++];
                                    req.result = { key: k, continue: step };
                                    if (req.onsuccess) req.onsuccess({ target: req });
                                } else {
                                    req.result = null;
                                    if (req.onsuccess) req.onsuccess({ target: req });
                                    if (tx.oncomplete) tx.oncomplete();
                                }
                            };
                            queueMicrotask(step);
                            return req;
                        }
                    };
                }
                if (name === 'sutram_outbox') {
                    return {
                        add: (rec) => {
                            storesData.sutram_outbox.push(rec);
                            queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
                        },
                        index: () => ({
                            openCursor: (range) => {
                                const req = {};
                                let idx = 0;
                                const step = () => {
                                    while (idx < storesData.sutram_outbox.length) {
                                        const curIdx = idx++;
                                        const item = storesData.sutram_outbox[curIdx];
                                        req.result = {
                                            value: item,
                                            update: (newRec) => { storesData.sutram_outbox[curIdx] = newRec; },
                                            continue: step
                                        };
                                        if (req.onsuccess) req.onsuccess({ target: req });
                                        return;
                                    }
                                    req.result = null;
                                    if (req.onsuccess) req.onsuccess({ target: req });
                                    if (tx.oncomplete) tx.oncomplete();
                                };
                                queueMicrotask(step);
                                return req;
                            },
                            count: () => {
                                const req = {};
                                queueMicrotask(() => {
                                    req.result = storesData.sutram_outbox.length;
                                    if (req.onsuccess) req.onsuccess({ target: req });
                                });
                                return req;
                            }
                        })
                    };
                }
            }
        };
        return tx;
    }
};

// 1. Telemetry event & SutramDB.subscribeTelemetry test
const telemetryLogs = [];
const unsubTel = SutramDB.subscribeTelemetry((detail) => telemetryLogs.push(detail));
emitOfflineTelemetry('Test event', 'success', 'sw', { count: 1 }, 'ws_alpha');
assert.equal(telemetryLogs.length, 1);
assert.equal(telemetryLogs[0].category, 'sw');
unsubTel();

// 2. OfflineHttpProvider: Network-First freshness + 502 Bad Gateway fallback + shouldCacheGet policy
let isOfflineState = false;
let networkMode = 'online_v1';
globalThis.fetch = async (url, opts = {}) => {
    if (url.startsWith('/auth/bootstrap')) {
        if (networkMode === 'gateway_502') return new Response('Bad Gateway', { status: 502 });
        return new Response(JSON.stringify({ status: 'authenticated' }), { status: 200 });
    }
    if (networkMode === 'online_v1') {
        assert.equal(opts.cache, 'no-store', 'Interactive GET must default to cache: no-store');
        return new Response('fresh_content_v1', { status: 200 });
    }
    if (networkMode === 'online_v2') {
        return new Response('fresh_content_v2', { status: 200 });
    }
    if (networkMode === 'gateway_502') {
        return new Response('Tailscale Serve 502', { status: 502 });
    }
    throw new TypeError('Failed to fetch');
};

const provider = new OfflineHttpProvider({
    probeUrl: '/auth/bootstrap',
    probeMethod: 'POST',
    checkOfflineState: () => isOfflineState,
    setOfflineState: (val) => { isOfflineState = val; },
    shouldCacheGet: (url) => !url.includes('online_only_repo')
});

const fileUrl = '/api/ws_alpha/fs/fetch?file=vfs%3A%2F%2Falpha%2Fnotes.md';
const res1 = await provider.get(fileUrl + '&t=111', {}, 'ws_alpha');
assert.equal(await res1.text(), 'fresh_content_v1');

// Online update v2 -> must pull fresh v2 from network even if isOfflineState was transiently true while navigator.onLine is true!
isOfflineState = true;
networkMode = 'online_v2';
const res2 = await provider.get(fileUrl + '&t=222', {}, 'ws_alpha');
assert.equal(await res2.text(), 'fresh_content_v2', 'When navigator.onLine is true, GET must pull fresh v2 from network');
isOfflineState = false;

// Now simulate Tailscale Serve returning 502 Bad Gateway while daemon is stopped -> falls back to cached v2 and sets isOfflineState=true!
networkMode = 'gateway_502';
const res502 = await provider.get(fileUrl + '&t=333', {}, 'ws_alpha');
assert.equal(await res502.text(), 'fresh_content_v2', '502 Bad Gateway must fall back to cached SutramDB blob');
assert.equal(isOfflineState, true, '502 Bad Gateway when probe fails must flip isOfflineState to true');

// 3. Atomic Read-Your-Writes Overlay in SutramDB.enqueueMutation + base_hash preservation on collapseKey compaction
await SutramDB.enqueueMutation(
    'ws_alpha',
    '/api/ws_alpha/fs/save',
    'POST',
    {},
    JSON.stringify({ filepath: 'vfs://alpha/notes.md', content: 'offline_edit_v3', base_hash: 'hash_v2', base_content: 'fresh_content_v2' }),
    'vfs:save:vfs://alpha/notes.md',
    { cacheBlobUrl: fileUrl, cacheBlobContent: 'offline_edit_v3' }
);
await SutramDB.enqueueMutation(
    'ws_alpha',
    '/api/ws_alpha/fs/save',
    'POST',
    {},
    JSON.stringify({ filepath: 'vfs://alpha/notes.md', content: 'offline_edit_v4', base_hash: 'hash_v3_local', base_content: 'offline_edit_v3' }),
    'vfs:save:vfs://alpha/notes.md',
    { cacheBlobUrl: fileUrl, cacheBlobContent: 'offline_edit_v4' }
);

assert.equal(storesData.sutram_outbox.length, 1, 'Matching collapseKey must compact in-place');
const compactedPayload = JSON.parse(storesData.sutram_outbox[0].bodyString);
assert.equal(compactedPayload.content, 'offline_edit_v4');
assert.equal(compactedPayload.base_hash, 'hash_v2', 'Outbox compaction must preserve original server base_hash');
assert.equal(compactedPayload.base_content, 'fresh_content_v2', 'Outbox compaction must preserve original server base_content');
assert.ok(Array.isArray(storesData.sutram_outbox[0].pendingMutations), 'Outbox record must persist pendingMutations array');
assert.ok(Array.isArray(storesData.sutram_outbox[0].deletedMutations), 'Outbox record must persist deletedMutations array');

// Reading the file while offline must immediately return 'offline_edit_v4' from the atomic vfs_cache overlay!
navigator.onLine = false;
const resAfterOfflineEdit = await provider.get(fileUrl, {}, 'ws_alpha');
assert.equal(await resAfterOfflineEdit.text(), 'offline_edit_v4', 'Read-Your-Writes overlay must return latest offline edit');

// 4. SutramDB.evictByPrefix evicts only matching repository blobs
await SutramDB.cacheVFSBlob('ws_alpha', '/api/ws_alpha/fs/fetch?file=vfs%3A%2F%2Fbeta%2Fother.md', new Blob(['beta']));
const evicted = await SutramDB.evictByPrefix('ws_alpha', encodeURIComponent('vfs://alpha/'));
assert.equal(evicted, 1);
assert.equal(await SutramDB.getVFSBlob('ws_alpha', fileUrl), null);
assert.notEqual(await SutramDB.getVFSBlob('ws_alpha', '/api/ws_alpha/fs/fetch?file=vfs%3A%2F%2Fbeta%2Fother.md'), null);

console.log('OFFLINE_RESILIENCE_NODE_OK');
"""
            (tmp_path / "run_offline_test.mjs").write_text(node_script, encoding="utf-8")
            res = execute_binary(["node", (tmp_path / "run_offline_test.mjs").as_posix()], cwd=tmp_path.as_posix(), timeout=10.0)
            self.assertEqual(res.returncode, 0, f"Offline resilience Node test failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("OFFLINE_RESILIENCE_NODE_OK", res.stdout)


if __name__ == "__main__":
    unittest.main()
