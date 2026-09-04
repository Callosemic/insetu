// insetu/static/js/api.js
// ADR 0016: Explicit API Client SDK & Network Gateway
import { SutramDB, OfflineHttpProvider } from '../../vendor/sutram/js/offline.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

const offlineProvider = new OfflineHttpProvider({
    checkOfflineState: () => window.inSetu?.stores?.App?.getState()?.isOffline,
    setOfflineState: (val) => window.inSetu.stores.App.setState({ isOffline: val }),
    isOfflineCapable: (url) => {
        const extName = url.split('/api/')[1]?.split('/')[1] || '';
        const offlineMode = window.ExtensionRegistry?.getExtension(extName)?.offline_mode || 'none';
        return offlineMode !== 'read_only' && offlineMode !== 'none';
    },
    onEnqueue: (count, payload, url, method, scopeId) => {
        const pendingSet = new Set(window.inSetu.stores.App.getState().pendingMutations);
        if (payload.filepath) pendingSet.add(payload.filepath);
        if (payload.dest_path) pendingSet.add(payload.dest_path);

        window.inSetu.stores.App.setState({ outboxCount: count, pendingMutations: pendingSet });
        window.inSetu?.offlineLog?.(`Enqueued mutation [${method}] (${count} pending): ${url}`, 'info', payload);
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
        if (isWorkspaceScoped) {
            headers.append('X-Workspace-ID', window.inSetu.utils.getActiveWorkspace());
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
        options.headers = headers;

        let res;
        if (method === 'GET') {
            res = await offlineProvider.get(url, options, scopeId);
        } else {
            const payload = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
            res = await offlineProvider.executeMutation(url, method, payload, options, scopeId);
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
