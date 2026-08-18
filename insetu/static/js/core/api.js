// insetu/static/js/api.js
// ADR 0016: Explicit API Client SDK & Network Gateway

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const originalFetch = window.fetch;
window.inSetu.api = {
    get: function(path, options = {}) {
        return this.workspace(path, { ...options, method: 'GET' });
    },
    system: Object.assign(
        async function(path, options = {}) {
            const cleanPath = path.startsWith('/') ? path.substring(1) : path;
            const fullUrl = `/api/system/${cleanPath}`;
            const headers = window.inSetu.api._getHeaders(true);
            if (options.headers) {
                new Headers(options.headers).forEach((value, key) => headers.set(key, value));
            }

            let res = await originalFetch(fullUrl, { ...options, headers });
            if (res.status === 401) {
                const retryRes = await window.inSetu.api._attemptReAuthAndRetry(fullUrl, options, true);
                if (retryRes) res = retryRes;
            }

            return res;
        },
        {
            get: function(path, options = {}) {
                return window.inSetu.api.system(path, { ...options, method: 'GET' });
            },
            post: function(path, payload = {}, options = {}) {
                return window.inSetu.api.system(path, {
                    ...options,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                    body: JSON.stringify(payload)
                });
            }
        }
    ),
    _getHeaders: function(isWorkspaceScoped = false) {
        const headers = new Headers();
        // Universal Intent Security Token
        let bootToken = '';
        try { bootToken = sessionStorage.getItem('insetu_boot_token'); } catch(e) {}
        const appToken = window.inSetu?.stores?.App?.getState()?.authToken || bootToken;
        if (appToken) headers.append('X-InSetu-Token', appToken);
        // Tenant Isolation
        if (isWorkspaceScoped) {
            headers.append('X-Workspace-ID', window.inSetu.utils.getActiveWorkspace());
        }
        return headers;
    },
    _attemptReAuthAndRetry: async function(fullUrl, options, isWorkspaceScoped) {
        const authRes = await originalFetch('/auth/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        if (authRes.ok) {
            const authData = await authRes.json();
            sessionStorage.setItem('insetu_boot_token', authData.token);
            if (window.inSetu.stores?.App) window.inSetu.stores.App.setState({ authToken: authData.token });

            const newHeaders = this._getHeaders(isWorkspaceScoped);
            if (options.headers) {
                new Headers(options.headers).forEach((value, key) => newHeaders.set(key, value));
            }
            return await originalFetch(fullUrl, { ...options, headers: newHeaders });
        }
        return null;
    },
    workspace: async function(path, options = {}) {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        // Central Choke Point: Validate extension enablement before touching the network
        const extName = cleanPath.split('/')[0];
        const isCore = window.inSetu?.isCore ? window.inSetu.isCore(extName) : ['bridge', 'gather', 'config', 'files', 'editor', 'system', 'fs'].includes(extName);
        if (extName && !isCore && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(extName)) {
            return new Response(JSON.stringify({ error: `Extension '${extName}' is disabled in workspace '${activeWs}'.` }), { status: 403, statusText: "Forbidden" });
        }

        const fullUrl = `/api/${activeWs}/${cleanPath}`;

        const headers = this._getHeaders(true);
        if (options.headers) {
            new Headers(options.headers).forEach((value, key) => headers.set(key, value));
        }

        // Future Architectural Seam: Offline Typewriter IndexedDB queue will intercept POST requests here
        let res = await originalFetch(fullUrl, { ...options, headers });

        if (res.status === 401) {
            const retryRes = await this._attemptReAuthAndRetry(fullUrl, options, true);
            if (retryRes) res = retryRes;
        }
        if (options.method && options.method.toUpperCase() !== 'GET') {
            try {
                const clone = res.clone();
                const data = await clone.json();
                if (data && data.requires_refresh && window.inSetu.sys.performSoftRefresh) {
                    // Offload job polling to the explicit orchestrators (e.g. bindJobAction) to avoid dual-polling loops
                    window.inSetu.sys.performSoftRefresh();
                }
            } catch (e) {}
        }
        return res;
    },
    system: async function(path, options = {}) {
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const fullUrl = `/api/system/${cleanPath}`;
        // System routes like config and jobs are vaulted per-tenant, so they require the scope token
        const headers = this._getHeaders(true);
        if (options.headers) {
            new Headers(options.headers).forEach((value, key) => headers.set(key, value));
        }

        let res = await originalFetch(fullUrl, { ...options, headers });
        if (res.status === 401) {
            const retryRes = await this._attemptReAuthAndRetry(fullUrl, options, true);
            if (retryRes) res = retryRes;
        }

        return res;
    },
    post: function(path, payload, options = {}) {
        // Legacy fallback alias
        return this.workspace.post(path, payload, options);
    }
};

// Semantic Substrate Routing
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
