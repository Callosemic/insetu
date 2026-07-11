// insetu/static/js/api.js
// ADR 0016: Explicit API Client SDK & Network Gateway

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const originalFetch = window.fetch;

window.inSetu.api = {
    _getHeaders: function(isWorkspaceScoped = false) {
        const headers = new Headers();
        
        // Universal Intent Security Token
        const appToken = window.inSetu?.stores?.App?.getState()?.authToken || sessionStorage.getItem('insetu_boot_token');
        if (appToken) headers.append('X-InSetu-Token', appToken);

        // Tenant Isolation
        if (isWorkspaceScoped) {
            const activeWs = window.inSetu?.stores?.App?.getState()?.activeWorkspace || sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
            headers.append('X-Workspace-ID', activeWs);
        }
        return headers;
    },

    workspace: async function(path, options = {}) {
        const activeWs = window.inSetu?.stores?.App?.getState()?.activeWorkspace || sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const fullUrl = `/api/${activeWs}/${cleanPath}`;

        const headers = this._getHeaders(true);
        if (options.headers) {
            new Headers(options.headers).forEach((value, key) => headers.append(key, value));
        }

        // Future Architectural Seam: Offline Typewriter IndexedDB queue will intercept POST requests here
        return originalFetch(fullUrl, { ...options, headers });
    },
    system: async function(path, options = {}) {
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const fullUrl = `/api/system/${cleanPath}`;
        // System routes like config and jobs are vaulted per-tenant, so they require the scope token
        const headers = this._getHeaders(true);
        if (options.headers) {
            new Headers(options.headers).forEach((value, key) => headers.append(key, value));
        }

        return originalFetch(fullUrl, { ...options, headers });
    }
};
