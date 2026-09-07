// insetu/static/js/api.js
// ADR 0016: Explicit API Client SDK & Network Gateway
import { SutramDB, OfflineHttpProvider, NetworkHysteresisManager, OutboxReconciler } from '../../vendor/sutram/js/offline.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

const offlineProvider = new OfflineHttpProvider({
    checkOfflineState: () => window.inSetu?.stores?.App?.getState()?.isOffline,
    setOfflineState: (val) => {
        window.inSetu.stores.App.setState({ isOffline: val });
        // Synchronize the chassis EnvironmentStore so offline buttons natively heal
        if (window.Sutram?.stores?.Environment) window.Sutram.stores.Environment.setState({ isOffline: val });
    },
    isOfflineCapable: (url) => {
        const extName = url.split('/api/')[1]?.split('/')[1] || '';
        const offlineMode = window.ExtensionRegistry?.getExtension(extName)?.offline_mode || 'none';
        return offlineMode !== 'read_only' && offlineMode !== 'none';
    },
    onEnqueue: (count, bodyString, headers, url, method, scopeId, options = {}) => {
        // Pure IoC: Execute explicit cache directives passed from domain extensions
        if (options.cacheBlobUrl && options.cacheBlobContent !== undefined) {
            SutramDB.cacheVFSBlob(scopeId, options.cacheBlobUrl, new Blob([options.cacheBlobContent], { type: 'text/plain;charset=utf-8' })).catch(()=>{});
        }

        const pendingSet = new Set(window.inSetu.stores.App.getState().pendingMutations);
        const deletedSet = new Set(window.inSetu.stores.App.getState().deletedMutations);

        // Pure IoC: Extensions explicitly declare which VFS paths are pending mutation
        const pendingItems = options.pendingMutations || [];
        pendingItems.forEach(p => pendingSet.add(p));

        const deletedItems = options.deletedMutations || [];
        deletedItems.forEach(p => deletedSet.add(p));

        window.inSetu.stores.App.setState({ outboxCount: count, pendingMutations: pendingSet, deletedMutations: deletedSet });
        window.inSetu?.offlineLog?.(`Enqueued mutation [${method}] (${count} pending): ${url}`, 'info', bodyString);
        if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`🌩️ Queued for sync (${count})`, 3000);
    },
    onOfflineError: (msg, url) => {
        window.inSetu?.offlineLog?.(`Offline Error: ${msg} (${url})`, 'error');
        if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ ${msg}`, 4000, true);
    },
    onCacheWrite: (cacheKeyUrl, size) => {
        window.inSetu?.offlineLog?.(`Cached VFS blob: ${cacheKeyUrl} (${size} bytes)`, 'info');
        if (window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState) {
            window.inSetu.stores.Offline.getState().fetchOfflineState();
        }
    }
});

window.inSetu.api = {
    _getHeaders: function(isWorkspaceScoped = false) {
        const headers = new Headers();
        let bootToken = '';
        try { bootToken = sessionStorage.getItem('insetu_boot_token'); } catch(e) {}
        const appToken = window.inSetu?.stores?.App?.getState()?.authToken || bootToken;
        if (appToken) headers.append('X-InSetu-Token', appToken);
        const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        if (activeWs) {
            headers.append('X-Workspace-ID', activeWs);
        }
        return headers;
    },

    _attemptReAuthAndRetry: async function(fullUrl, options, isWorkspaceScoped) {
        const authRes = await fetch('/auth/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        if (authRes.ok) {
            const authData = await authRes.json();
            sessionStorage.setItem('insetu_boot_token', authData.token);
            if (window.inSetu.stores?.App) window.inSetu.stores.App.setState({ authToken: authData.token });

            const newHeaders = this._getHeaders(isWorkspaceScoped);
            if (options.headers) {
                new Headers(options.headers).forEach((value, key) => newHeaders.set(key, value));
            }
            options.headers = newHeaders;
            return await fetch(fullUrl, options);
        }
        return null;
    },
    request: async function(url, options = {}, scopeId = 'default') {
        const method = options.method ? options.method.toUpperCase() : 'GET';
        // 1. Auth Injection
        const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers || {});
        const baseHeaders = this._getHeaders(scopeId !== 'default');
        baseHeaders.forEach((value, key) => {
            if (!headers.has(key)) headers.set(key, value);
        });
        // Ensure Content-Type is set for JSON payloads
        if (method !== 'GET' && options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        options.headers = headers;
        let res;
        if (method === 'GET') {
            res = await offlineProvider.get(url, options, scopeId);
        } else {
            const rawPayload = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
            const isFormData = options.body instanceof FormData;
            const bodyString = isFormData ? options.body : (options.body ? JSON.stringify(rawPayload) : null);

            // Pass headers cleanly to the offline provider wrapper
            const plainHeaders = {};
            headers.forEach((val, key) => plainHeaders[key] = val);
            options.plainHeaders = plainHeaders;

            res = await offlineProvider.executeMutation(url, method, bodyString, options, scopeId);
        }

        // 2. Auth Retry Intercept
        if (res.status === 401) {
            const retryRes = await this._attemptReAuthAndRetry(url, options, scopeId !== 'default');
            if (retryRes) res = retryRes;
        }

        // 3. Soft Refresh Evaluation
        if (method !== 'GET') {
            try {
                const clone = res.clone();
                const data = await clone.json();
                if (data && data.requires_refresh && window.inSetu.sys.performSoftRefresh) {
                    window.inSetu.sys.performSoftRefresh();
                }
            } catch (e) {}
        }

        return res;
    },
    workspace: async function(path, options = {}) {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        const extName = cleanPath.split('/')[0];
        const isCore = window.inSetu?.isCore ? window.inSetu.isCore(extName) : ['bridge', 'gather', 'config', 'files', 'editor', 'system', 'fs', 'offline'].includes(extName);
        if (extName && !isCore && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(extName)) {
            return new Response(JSON.stringify({ error: `Extension '${extName}' is disabled in workspace '${activeWs}'.` }), { status: 403, statusText: "Forbidden" });
        }

        const fullUrl = `/api/${activeWs}/${cleanPath}`;
        return this.request(fullUrl, options, activeWs);
    },

    system: async function(path, options = {}) {
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const fullUrl = `/api/system/${cleanPath}`;
        return this.request(fullUrl, options, 'default');
    },

    get: function(path, options = {}) {
        return this.workspace(path, { ...options, method: 'GET' });
    },
    post: function(path, payload, options = {}) {
        const isFD = payload instanceof FormData;
        const headers = isFD ? { ...(options.headers || {}) } : { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const body = isFD ? payload : JSON.stringify(payload);
        return this.workspace(path, { ...options, method: 'POST', headers, body });
    }
};

window.inSetu.api.workspace.get = function(path, options = {}) {
    return window.inSetu.api.workspace(path, { ...options, method: 'GET' });
};
window.inSetu.api.workspace.post = function(path, payload, options = {}) {
    const isFD = payload instanceof FormData;
    const headers = isFD ? { ...(options.headers || {}) } : { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const body = isFD ? payload : JSON.stringify(payload);
    return window.inSetu.api.workspace(path, { ...options, method: 'POST', headers, body });
};
window.inSetu.api.system.get = function(path, options = {}) {
    return window.inSetu.api.system(path, { ...options, method: 'GET' });
};
window.inSetu.api.system.post = function(path, payload, options = {}) {
    return window.inSetu.api.system(path, {
        ...options,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: JSON.stringify(payload)
    });
};
window.inSetu.api.workspace.delete = function(path, options = {}) {
    return window.inSetu.api.workspace(path, { ...options, method: 'DELETE' });
};
window.inSetu.api.system.delete = function(path, options = {}) {
    return window.inSetu.api.system(path, { ...options, method: 'DELETE' });
};
// Phase E: Network Hysteresis & Outbox Reconciliation Loop
const networkManager = new NetworkHysteresisManager('/?t={t}', 3);
let lastCacheCheck = 0;

setInterval(async () => {
    const appState = window.inSetu?.stores?.App?.getState();

    // LRU Cache Eviction Sweep
    if (Date.now() - lastCacheCheck > 60000) {
        lastCacheCheck = Date.now();
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const est = await navigator.storage.estimate();
                // Enforce the 250MB baseline limit defined in the core OS schema
                const limitMB = 250; 
                const limitBytes = limitMB * 1024 * 1024;

                // If usage exceeds explicit limit or 80% of hard browser quota
                if (est.usage > limitBytes || (est.quota && est.usage > est.quota * 0.8)) {
                    // Free down to 80% of our limit to give breathing room
                    const targetFree = Math.max(est.usage - (limitBytes * 0.8), est.usage * 0.2); 
                    window.inSetu?.offlineLog?.(`Storage threshold reached. Evicting ${Math.round(targetFree/1024/1024)}MB of old cache...`, 'warning');
                    await SutramDB.pruneCache(targetFree);
                    if (window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState) {
                        window.inSetu.stores.Offline.getState().fetchOfflineState();
                    }
                }
            } catch(e) {}
        }
    }

    if (appState && appState.isOffline && !appState.isReconciling) {
        await networkManager.check(async () => {
            window.inSetu.stores.App.setState({ isOffline: false, isReconciling: true });
            if (window.Sutram?.stores?.Environment) window.Sutram.stores.Environment.setState({ isOffline: false });
            window.inSetu?.offlineLog?.('Network stability verified. Beginning outbox reconciliation...', 'info');

            try {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                await OutboxReconciler.drain(activeWs, async (path, fetchOptions, scopeId) => {
                    // Re-inject fresh authentication headers
                    const headers = window.inSetu.api._getHeaders(scopeId !== 'default');
                    if (fetchOptions.headers) {
                        new Headers(fetchOptions.headers).forEach((v, k) => headers.set(k, v));
                    }
                    fetchOptions.headers = headers;

                    // Use native fetch to bypass OfflineHttpProvider re-queuing.
                    // This allows genuine network drops to throw, halting the reconciler queue chronologically.
                    let res = await fetch(path, fetchOptions);

                    // Handle 401 Session Expiration mid-reconciliation
                    if (res.status === 401) {
                        const retryRes = await window.inSetu.api._attemptReAuthAndRetry(path, fetchOptions, scopeId !== 'default');
                        if (retryRes) res = retryRes;
                    }

                    // Trigger soft refreshes if the backend demands it
                    if (res.ok && fetchOptions.method !== 'GET') {
                        try {
                            const clone = res.clone();
                            const data = await clone.json();
                            if (data?.requires_refresh && window.inSetu.sys.performSoftRefresh) {
                                window.inSetu.sys.performSoftRefresh();
                            }
                        } catch (e) {}
                    }

                    return res;
                });
            } catch (e) {
                window.inSetu.stores.App.setState({ isOffline: true });
                if (window.Sutram?.stores?.Environment) window.Sutram.stores.Environment.setState({ isOffline: true });
            } finally {
                window.inSetu.stores.App.setState({ isReconciling: false });
                const remaining = await SutramDB.getOutboxCount(window.inSetu.utils.getActiveWorkspace());
                window.inSetu.stores.App.setState({ outboxCount: remaining });

                if (remaining === 0) {
                    window.inSetu?.offlineLog?.('Outbox fully reconciled.', 'success');
                    if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus('✅ System Synced', 3000);
                    // Clear the ephemeral tracking sets once the queue is fully drained
                    window.inSetu.stores.App.setState({ pendingMutations: new Set(), deletedMutations: new Set() });
                }
            }
        });
    } else if (appState && !appState.isOffline) {
        networkManager.reset();
    }
}, 5000);
