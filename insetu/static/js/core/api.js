// insetu/static/js/api.js
// ADR 0016: Explicit API Client SDK & Network Gateway

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const originalFetch = window.fetch;

window.inSetu.api = {
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
    workspace: async function(path, options = {}) {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const fullUrl = `/api/${activeWs}/${cleanPath}`;

        const headers = this._getHeaders(true);
        if (options.headers) {
            new Headers(options.headers).forEach((value, key) => headers.set(key, value));
        }

        // Future Architectural Seam: Offline Typewriter IndexedDB queue will intercept POST requests here
        const res = await originalFetch(fullUrl, { ...options, headers });
        if (options.method && options.method.toUpperCase() !== 'GET') {
            try {
                const clone = res.clone();
                const data = await clone.json();
                if (data && data.requires_refresh) {
                    if (data.job_id && window.inSetu.utils.pollJob) {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus("⏳ Applying settings...", null);
                        }
                        window.inSetu.utils.pollJob(data.job_id, {
                            onProgress: (msg) => {
                                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                            },
                            onComplete: () => {
                                if (window.inSetu.sys.performSoftRefresh) window.inSetu.sys.performSoftRefresh();
                            },
                            onError: () => {
                                if (window.inSetu.sys.performSoftRefresh) window.inSetu.sys.performSoftRefresh();
                            }
                        });
                    } else if (window.inSetu.sys.performSoftRefresh) {
                        window.inSetu.sys.performSoftRefresh();
                    }
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

        return originalFetch(fullUrl, { ...options, headers });
    }
};
