import { AppStore } from './core/store.js';
import '../vendor/sutram/js/app_shell.js';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New update available. Refreshing...');
                        window.location.reload();
                    }
                });
            });
        }).catch(err => console.error('SW reg failed:', err));
    });
}
// Intercept window refreshes only if edits are actively staged or in progress
window.addEventListener('beforeunload', (e) => {
    let isDirty = false;

    const bridgeState = window.inSetu?.stores?.Bridge?.getState();
    if (bridgeState && bridgeState.payloadText && bridgeState.payloadText.trim() !== '') {
        isDirty = true;
    }

    const fm = window.inSetu?.stores?.Fs?.getState()?.fileModal;
    if (fm && fm.open && fm.isFS && fm.content !== fm.originalContent) {
        isDirty = true;
    }

    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});
import { initShortcutRouter } from '../vendor/sutram/js/shortcuts.js';
import '../vendor/sutram/js/primitives.js';
import '../vendor/sutram/js/inputs.js';

// --- CENTRALIZED SHORTCUT ROUTER ---
initShortcutRouter(window.ExtensionRegistry, () => {
    const contexts = ['global'];

    // 1. Active Tab Hierarchy
    const { activeTab, activeSubTabs } = AppStore.getState();
    if (activeTab) {
        contexts.unshift('tab:' + activeTab);
        const activeSub = activeSubTabs[activeTab];
        if (activeSub) contexts.unshift('subtab:' + activeSub);
    }

    // 2. Active Element
    if (document.activeElement && document.activeElement !== document.body) {
        const tag = document.activeElement.tagName.toLowerCase();
        contexts.unshift('element:' + tag);
        if (document.activeElement.id) contexts.unshift('element-id:' + document.activeElement.id);
    }

    // 3. Active Modal (Highest Priority)
    const activeModal = Array.from(document.querySelectorAll('.fullscreen-modal')).find(m => window.getComputedStyle(m).display === 'block');
    if (activeModal) contexts.unshift('modal:' + activeModal.id);

    return contexts;
});
// Default OS Shortcut Registrations
window.ExtensionRegistry.registerShortcut('global', 'escape', () => {
    // Components utilizing <insetu-modal> (which wraps <yenvui-modal>) natively handle Escape key teardowns via the HTML5 <dialog> API.
    // For the global VFS file modal, we ensure its state syncs to closed in the Zustand store.
    const fsStore = window.inSetu?.stores?.Fs;
    if (fsStore && fsStore.getState().fileModal?.open) {
        fsStore.getState().setModal('fileModal', { open: false });
    }
});
window.ExtensionRegistry.registerShortcut('element:textarea', 'tab', (e) => {
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + "    " + el.value.substring(end);
    el.selectionStart = el.selectionEnd = start + 4;
    el.dispatchEvent(new Event('input'));
});
// Auto-resize generic textareas (prompts, descriptions) as the user types, piercing Shadow DOM boundaries
document.addEventListener('input', (e) => {
    const target = e.composedPath()[0];
    if (target && target.tagName.toLowerCase() === 'textarea' && target.id !== 'payload' && !target.closest('.EasyMDEContainer') && !target.classList.contains('cell-textarea')) {
        target.style.height = 'auto';
        target.style.height = Math.min(target.scrollHeight + 2, 500) + 'px';
    }
});
// Map Cmd/Ctrl + S contextually depending on which modal is currently visible
window.ExtensionRegistry.registerShortcut('modal:file-modal', 'ctrl+s', () => window.inSetu.ui.saveModalFile && window.inSetu.ui.saveModalFile(false));
window.ExtensionRegistry.registerShortcut('modal:new-file-modal', 'ctrl+s', () => window.inSetu.ui.saveNewFile && window.inSetu.ui.saveNewFile());
window.ExtensionRegistry.registerShortcut('modal:config-editor-modal', 'ctrl+s', () => document.getElementById('config-editor-save')?.click());
export function autoWireSettingsSchemas() {
    if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
        window.inSetu.settingsSchemas = window.inSetu.settingsSchemas || {};

        const allExts = new Set([
            ...Array.from(window.ExtensionRegistry._manifests.keys()),
            ...Object.keys(window.inSetu.settingsSchemas),
            ...Object.keys(window.inSetu.serverSchemas || {})
        ]);
        allExts.forEach((extName) => {
            const isCore = window.inSetu?.isCore ? window.inSetu.isCore(extName) : ['bridge', 'gather', 'config', 'files', 'editor'].includes(extName);
            if (!isCore && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(extName)) {
                return;
            }

            const manifest = window.ExtensionRegistry._manifests.get(extName) || { name: extName.charAt(0).toUpperCase() + extName.slice(1), settingsActions: [] };
            const schema = manifest.settingsSchema || window.inSetu.settingsSchemas[extName] || window.inSetu.serverSchemas?.[extName];

            if (schema && schema.length > 0) {
                manifest.settingsActions = manifest.settingsActions || [];
                // Prevent duplicate injections during soft-refreshes
                if (!manifest.settingsActions.some(a => a.id === `${extName}_generic_settings`)) {
                    const action = {
                        id: `${extName}_generic_settings`,
                        label: `${manifest.name || extName.charAt(0).toUpperCase() + extName.slice(1)} Settings`,
                        icon: '📋',
                        onClick: async () => {
                            const genericModal = document.getElementById('insetu-generic-settings-root');
                            if (genericModal) {
                                const schema = window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas[extName] || manifest.settingsSchema || [];
                                let formData = {};
                                try {
                                    const res = await window.inSetu.api.workspace(`${extName}/settings?t=${Date.now()}`);
                                    if (res.ok) formData = await res.json();
                                } catch(e) {}
                                genericModal.openModal(extName, schema, formData);
                            }
                        }
                    };
                    manifest.settingsActions.push(action);
                }
                // Push directly to the registry to ensure it renders in the DOM
                if (typeof window.ExtensionRegistry.registerSettingsAction === 'function') {
                    const actionToRegister = manifest.settingsActions.find(a => a.id === `${extName}_generic_settings`);
                    if (actionToRegister) {
                        window.ExtensionRegistry.registerSettingsAction(actionToRegister.id, actionToRegister.label, actionToRegister.icon, actionToRegister.onClick, isCore ? 'System' : 'Extensions');
                    }
                }
            }
        });
    }
}

async function bootExtensions() {
    const activeExts = window.ACTIVE_EXTENSIONS || [];
    // Batch 0: Core UI Primitives & Foundational Components
    const coreComponents = [
        '/static/js/core/components/ui_file_tree.js',
        '/static/js/core/components/ui_system_settings.js',
        '/static/js/core/components/ui_filter_pills.js',
        '/static/js/core/components/ui_primitives.js'
    ];

    // Batch 1: Core OS Chassis Modules
    const coreModules = ['bridge', 'gather', 'config'];
    const coreUrls = coreModules.map(m => `/static/js/core/${m}.js`);

    // Batch 2: Feature Extensions
    const extensionUrls = activeExts
        .filter(ext => !(window.inSetu?.isCore ? window.inSetu.isCore(ext) : coreModules.includes(ext)))
        .map(ext => `/static/js/extensions/ext_${ext}.js`);

    if (window.ExtensionRegistry && typeof window.ExtensionRegistry.loadBatches === 'function') {
        await window.ExtensionRegistry.loadBatches([
            coreComponents,
            coreUrls,
            extensionUrls
        ]);
    }

    // Automatically map schemas to the System Settings menu
    autoWireSettingsSchemas();
}

// --- THE CENTRALIZED FRONTEND METRONOME ---
window.ExtensionRegistry.registerTick('core_refresh', 1000, updateRefreshText);

// Delegate execution to the Tier 1 agnostic metronome
window.ExtensionRegistry.startMetronome(
    () => window.ACTIVE_EXTENSIONS || [],
    [...Array.from(window.inSetu?.CORE_MODULES || ['bridge', 'gather', 'config', 'files']), 'core_refresh']
);
import './core/api.js'; // Mount explicit API client and network interceptors
import { createJobPoller } from '../vendor/sutram/js/poller.js';
// Define the Job Polling Subroutine using the abstracted kernel
window.inSetu.utils.pollJob = createJobPoller({
    get: async (path) => window.inSetu.api.system(path)
});
// Restore UI State on Load
let bootCurrentStep = 0;
let bootTotalSteps = 8;
function updateBootProgress(statusMsg) {
    bootCurrentStep++;
    const percent = Math.min(100, Math.round((bootCurrentStep / bootTotalSteps) * 100));

    const fillBar = document.getElementById('retro-bar-fill');
    const statusEl = document.getElementById('retro-status-msg');

    if (statusEl && statusMsg) {
        statusEl.innerHTML = `${statusMsg} (${percent}%) <span class="retro-cursor"></span>`;
    }
    if (fillBar) {
        fillBar.style.width = `${percent}%`;
    }
}

window.addEventListener('sutram:extension-registered', (e) => {
    const extName = e.detail?.extName || 'extension';
    updateBootProgress(`Loaded Extension: ${extName}`);
});

async function executeSecurityHandshake() {
    // Attempt a seamless, zero-config Tailscale or Localhost handshake first
    let res = await fetch('/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });

    if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('insetu_boot_token', data.token);
        AppStore.setState({ authToken: data.token });
        return true;
    }

    // Fallback: Challenge issued, prompt client for static profile access token
    if (res.status === 401) {
        const userToken = prompt("🔑 inSetu Security Gate\nEnter the persistent 'auth_token' defined in your config.json:");
        if (!userToken) return false;

        let retryRes = await fetch('/auth/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: userToken.trim() })
        });

        if (retryRes.ok) {
            const data = await retryRes.json();
            sessionStorage.setItem('insetu_boot_token', data.token);
            AppStore.setState({ authToken: data.token });
            return true;
        }
    }
    return false;
}
async function executeBootSequence() {
    console.log("[BOOT] Starting sequence...");
    if (window.ExtensionRegistry) window.ExtensionRegistry.isBooting = true;
    updateBootProgress("Security Handshake...");

    const authenticated = await executeSecurityHandshake();
    console.log("[BOOT] Security Handshake completed:", authenticated);
    if (!authenticated) {
        document.body.innerHTML = `<div style="font-family:monospace; color:var(--intent-danger); text-align:center; padding-top:20dvh;"><h2>❌ Access Denied</h2><p>Invalid framework credentials configuration.</p></div>`;
        return;
    }
    // Fetch tenant-specific configuration to override the server's stateless HTML injection
    try {
        console.log("[BOOT] Fetching system configuration...");
        updateBootProgress("Fetching system config...");
        const cRes = await window.inSetu.api.workspace('system/config?t=' + Date.now(), { cache: 'no-store' });
        console.log("[BOOT] System configuration fetched. OK:", cRes.ok);
        if (cRes.ok) {
            const data = await cRes.json();
            const config = data.config || {};
            window.ACTIVE_EXTENSIONS = config.extensions || [];
            window.inSetu.serverSchemas = data.meta?.settings_schemas || {};
            // Synchronize branding tokens while we have the config
            AppStore.setState({ instanceEmoji: config.instance_emoji || "⚙️" });
            const statusBar = document.querySelector('sutram-status-bar');
            if (statusBar) {
                statusBar.baseTitle = config.instance_title || "inSetu Developer OS";
            }

            // Recalculate total boot steps dynamically based on discovered extension count
            bootTotalSteps = 5 + window.ACTIVE_EXTENSIONS.length;
        }
    } catch (e) {
        console.warn("Failed to fetch tenant configuration on boot.", e);
    }
    console.log("[BOOT] Loading Workspaces...");
    updateBootProgress("Loading Workspaces...");
    await loadWorkspaces();
    console.log("[BOOT] Workspaces loaded.");
    console.log("[BOOT] Initializing Workspace Topology...");
    updateBootProgress("Initializing Topology...");
    await initializeWorkspaceTopology();
    console.log("[BOOT] Topology initialized.");
    console.log("[BOOT] Booting Extensions...");
    await bootExtensions();

    // Native System Sync Indicator Hook
    if (window.ExtensionRegistry && window.ExtensionRegistry.registerUIHook) {
        window.ExtensionRegistry.registerUIHook('zone:vfs-mutated', (payload) => {
            if (payload && payload.mutations) {
                // If any file was touched that actually matters to the ledger, flip to Pending
                const requiresSync = payload.mutations.some(m => !m.ignore_ledger);
                if (requiresSync && window.inSetu.ui && window.inSetu.ui.setSyncStatus) {
                    window.inSetu.ui.setSyncStatus('pending');
                }
            }
            return false;
        });
    }
    // Declarative Tab Ordering: AppStore syncs tabOrder directly to Sutram
    AppStore.subscribe(
        state => state.tabOrder,
        (tabOrder) => {
            if (window.ExtensionRegistry?.setTabOrder && Array.isArray(tabOrder)) {
                window.ExtensionRegistry.setTabOrder(tabOrder);
            }
        }
    );
    // Initial Sync for Cold Boot
    const initialTabOrder = AppStore.getState().tabOrder;
    if (window.ExtensionRegistry?.setTabOrder && Array.isArray(initialTabOrder) && initialTabOrder.length > 0) {
        window.ExtensionRegistry.setTabOrder(initialTabOrder);
    }
    // Sync pinned repos to the agnostic Sutram Status Bar
    const statusBar = document.querySelector('sutram-status-bar');
    if (statusBar) {
        AppStore.subscribe(state => state.pinnedRepos, (repos) => {
            if (repos && repos.size > 0 && !repos.has('ALL')) {
                statusBar.statusString = `[${Array.from(repos).join(', ')}]`;
            } else {
                statusBar.statusString = '';
            }
        });
        const repos = AppStore.getState().pinnedRepos;
        if (repos && repos.size > 0 && !repos.has('ALL')) {
            statusBar.statusString = `[${Array.from(repos).join(', ')}]`;
        }
    }

    // Initialize Zero-Bundler SPA Router (Native Hash Routing)
    const handleHashChange = () => {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const parts = hash.split('/').map(decodeURIComponent);

        const ws = parts[0] || 'default';
        const tab = parts[1] || 'context';
        const sub = parts[2] || '';
        const deepPath = parts.slice(3);

        if (ws !== window.inSetu.utils.getActiveWorkspace()) {
            if (window.inSetu.sys.executeWorkspaceSwap && ws) {
                window.inSetu.sys.executeWorkspaceSwap(ws);
            }
        }

        AppStore.getState().setActiveRoute(tab, sub, deepPath.length > 0 ? deepPath : null);
    };

    window.addEventListener('hashchange', handleHashChange);

    // Bootstrap initial route from URL or set default
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
        const ws = window.inSetu.utils.getActiveWorkspace();
        window.location.hash = `#/${encodeURIComponent(ws)}/context/`;
    } else {
        handleHashChange();
    }

    // UDF Subscription: State -> URL mapping
    AppStore.subscribe(
        state => [state.activeWorkspace, state.activeTab, state.activeSubTabs, state.globalBrowsePath],
        ([ws, tab, subs, deep]) => {
            if (!ws || !tab) return;
            const currentSub = subs[tab] || '';
            const deepStr = (deep && deep.length > 0) ? '/' + deep.map(encodeURIComponent).join('/') : '';
            const newHash = `#/${encodeURIComponent(ws)}/${encodeURIComponent(tab)}/${encodeURIComponent(currentSub)}${deepStr}`;

            // Silently update URL without triggering a hashchange event reload loop
            if (window.location.hash !== newHash && window.location.hash !== newHash.replace(/\/$/, '')) {
                history.replaceState(null, '', newHash);
            }
            // Sync declarative layout state to the Tier 0 App Shell
            window.dispatchEvent(new CustomEvent('sutram-route-changed', {
                detail: { tab, subTabs: subs }
            }));
        }
    );
    window.addEventListener('shell-tab-changed', (e) => {
        const { tabId, isAlreadyActive } = e.detail;
        const state = AppStore.getState();
        AppStore.getState().setActiveRoute(tabId, null);

        if (isAlreadyActive) {
            const activeSub = state.activeSubTabs[tabId];
            if (activeSub) window.inSetu.events.emitHook('zone:subtab-changed', { parentId: tabId, subId: activeSub, forceRefresh: true });
        } else {
            window.inSetu.events.emitHook('zone:tab-changed', tabId);
        }
    });

    window.addEventListener('shell-subtab-changed', (e) => {
        const { tabId, subId, isAlreadyActive } = e.detail;
        AppStore.getState().setActiveRoute(tabId, subId);
        window.inSetu.events.emitHook('zone:subtab-changed', { parentId: tabId, subId, forceRefresh: isAlreadyActive });
    });
    try {
        // Hydrate the declarative shell with the initial route state
        const state = AppStore.getState();
        window.dispatchEvent(new CustomEvent('sutram-route-changed', {
            detail: { tab: state.activeTab, subTabs: state.activeSubTabs }
        }));

        if (state.activeTab) {
            window.inSetu.events.emitHook('zone:tab-changed', state.activeTab);
            const activeSub = state.activeSubTabs[state.activeTab];
            if (activeSub) {
                window.inSetu.events.emitHook('zone:subtab-changed', { parentId: state.activeTab, subId: activeSub, forceRefresh: true });
            }
        }
    } catch (bootErr) {
        console.error("⚠️ [BOOT] Non-fatal error during layout/topology hydration:", bootErr);
    } finally {
        // Everything is fully booted, topologies mapped, and extensions mounted.
        updateBootProgress("System Ready!");
        window.BOOT_COMPLETE = true;
        if (window.panicTimeout) clearTimeout(window.panicTimeout);
        const _initPanicBtn = document.getElementById('js-panic-button');
        if (_initPanicBtn) {
            _initPanicBtn.style.opacity = '0';
            _initPanicBtn.style.transition = 'opacity 0.3s ease';
            setTimeout(() => { _initPanicBtn.style.display = 'none'; }, 300);
        }
    }
}

// --- FAIL-SAFE EXTENSION ERROR GATEWAY ---
// Intercepts unhandled extension runtime errors to prevent them from taking down the OS shell.
window.addEventListener('error', (e) => {
    const isExtensionError = e.filename && (e.filename.includes('ext_') || e.filename.includes('extensions/'));
    if (window.BOOT_COMPLETE || isExtensionError) {
        e.preventDefault();
        e.stopPropagation();
        console.error("⚠️ [Isolated Extension Error]:", e.error || e.message);
        const toastStore = window.inSetu?.stores?.Toast;
        if (toastStore && typeof toastStore.getState === 'function') {
            toastStore.getState().addToast(
                `Extension Error (${e.filename ? e.filename.split('/').pop() : 'UI'}): ${e.message}`,
                'danger'
            );
        }
        // Forcefully suppress panic overlay if error originated from an extension
        const panicBtn = document.getElementById('js-panic-button');
        if (panicBtn && (window.BOOT_COMPLETE || isExtensionError)) {
            panicBtn.style.display = 'none';
        }
    }
});

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', executeBootSequence);
} else {
    executeBootSequence();
}

// PWA Isolation: Honor URL-bound workspace parameters before reading cache
const urlParams = new URLSearchParams(window.location.search);
const nodeParam = urlParams.get('node');
if (nodeParam) {
    try {
        sessionStorage.setItem('insetu_workspace', nodeParam);
        localStorage.setItem('insetu_workspace', nodeParam);
    } catch(e) {}
}

let currentTheme = 'dark';
try {
    currentTheme = localStorage.getItem('insetu_theme') || 'dark';
} catch(e) {}
document.body.setAttribute('data-theme', currentTheme);
async function executeWorkspaceSwap(key, title) {
    window.inSetu.ui.setGlobalStatus(`Switched to ${title || key}. Hydrating UI...`, null);
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        } catch(e) {}
    }
    await window.inSetu.api.system('workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_workspace: key })
    });
    sessionStorage.setItem('insetu_workspace', key);
    localStorage.setItem('insetu_workspace', key);
    window.ACTIVE_EXTENSIONS = [];

    Object.values(window.inSetu.stores).forEach(store => {
        if (store && typeof store.getState === 'function') {
            const state = store.getState();
            if (state) {
                if (typeof state.clearPayload === 'function') state.clearPayload();
                if (typeof state.resetState === 'function') state.resetState();
            }
        }
    });
    const newPinned = new Set(JSON.parse(localStorage.getItem(`insetu_pinned_repos_${key}`)) || ["ALL"]);
    AppStore.setState({ activeWorkspace: key, pinnedRepos: newPinned });
    await performSoftRefresh();
    loadWorkspaces();
}
async function loadWorkspaces() {
    try {
        const res = await window.inSetu.api.system('workspaces?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.workspaces && Object.keys(data.workspaces).length > 0) {
            let activeWs = window.inSetu.utils.getActiveWorkspace();
            if (!activeWs || !data.workspaces[activeWs] || activeWs === 'default') {
                activeWs = data.active_workspace || Object.keys(data.workspaces)[0] || 'default';
                sessionStorage.setItem('insetu_workspace', activeWs);
                localStorage.setItem('insetu_workspace', activeWs);
            }
            AppStore.setState({ activeWorkspace: activeWs, workspaces: data.workspaces });
        }
    } catch(e) {
        console.error("Failed to load workspaces:", e);
    }
}

let lastRefreshed = null;
function updateRefreshText() {
    if (!lastRefreshed) return;
    const text = window.inSetu.utils.timeAgo(lastRefreshed);
    const el = document.getElementById('refresh-time');
    if (el) el.innerText = `Refreshed ${text}`;
}
export function setGlobalStatus(msg, timeout = 3000, isError = false) {
    window.dispatchEvent(new CustomEvent('insetu-status-update', { detail: { msg, timeout, isError } }));
}
export function setSyncStatus(state) {
    window.dispatchEvent(new CustomEvent('sutram-sync-status', { detail: { state } }));
}
// --- NON-BLOCKING TOAST NOTIFICATIONS ---
// Hijack native alerts to prevent thread blocking while preserving stack traces
window.alert = function(msg, intent = 'danger') {
    const toastStore = window.inSetu?.stores?.Toast;
    if (toastStore && typeof toastStore.getState === 'function') {
        toastStore.getState().addToast(msg, intent);
    } else {
        console.warn("Alert:", msg); // Graceful fallback
    }
};
export async function executeWorkspaceMutation(path, payload, options = {}) {
    const { silent = false, onSuccess } = options;

    try {
        // Strip legacy prefixes if extensions haven't been updated yet
        let cleanPath = path;
        if (cleanPath.startsWith('/api/')) {
            const parts = cleanPath.split('/');
            cleanPath = parts.slice(3).join('/'); // strips /api/<ws>/
        }

        const isFormData = payload instanceof FormData;
        const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
        const body = isFormData ? payload : JSON.stringify(payload);

        const res = await window.inSetu.api.workspace(cleanPath, {
            method: 'POST',
            headers,
            body
        });

        if (!res.ok) {
            let errMsg = res.statusText;
            try {
                const errData = await res.clone().json();
                errMsg = errData.error || errMsg;
            } catch (parseError) {
                const rawText = await res.text();
                errMsg = `Raw Server Error (${res.status}):\n\n${rawText.substring(0, 500)}`;
            }
            throw new Error(errMsg);
        }

        const data = await res.json();
        if (onSuccess) await onSuccess(data);
        return data;
    } catch (e) {
        if (!silent) {
            alert(`Operation failed.\nReason: ${e.message}`);
            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(`❌ Error: ${e.message}`, 5000, true);
            }
        }
        throw e;
    }
}
let compilePromise = null;
let compilePromiseWs = null;
export const executeSystemCompile = (onProgress = null, forceFull = false) => {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    if (compilePromise && compilePromiseWs === activeWs) return compilePromise;

    // Extract targetConfigs natively from the App Shell store
    const targetConfigs = AppStore.getState().targetConfigs || [];

    if (!targetConfigs || targetConfigs.length === 0) {
        return Promise.resolve({ status: 'success', message: "No tracked repositories configured.", files: [] });
    }
    compilePromiseWs = activeWs;
    compilePromise = (async () => {
        if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('syncing');
        try {
            const response = await window.inSetu.api.workspace('gather/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force_full: forceFull })
            });

            const data = await response.json();
            let result = null;
            if (response.status === 202) {
                const jobId = data.job_id;
                let retries = 0;
                while (true) {
                    if (AppStore.getState().activeWorkspace !== compilePromiseWs) {
                        result = { status: 'aborted', message: 'Workspace switched.', files: [] };
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 250));
                    if (AppStore.getState().activeWorkspace !== compilePromiseWs) {
                        result = { status: 'aborted', message: 'Workspace switched.', files: [] };
                        break;
                    }

                    const pollRes = await window.inSetu.api.system(`jobs/${jobId}`, {
                        headers: { 'X-Workspace-ID': compilePromiseWs }
                    });

                    if (pollRes.status === 404) {
                        result = { status: 'aborted', message: 'Job not found (context shifted).', files: [] };
                        break;
                    }
                    if (!pollRes.ok) throw new Error("Compilation job failed");
                    const pollData = await pollRes.json();
                    if (pollData.status === 'processing' || pollData.status === 'pending') {
                        const msg = pollData.message || "Compiling...";
                        if (AppStore.getState().activeWorkspace === compilePromiseWs) {
                            window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                            if (onProgress) onProgress(msg);
                        }

                        retries++;
                        // Tighten the deadlock timeout to 15 seconds (60 retries @ 250ms) to prevent infinite load screens
                        if (retries > 60) {
                            result = { status: 'error', message: 'Compilation timed out. The background worker may have stalled.', files: [] };
                            break;
                        }
                    } else if (pollData.status === 'completed') {
                        result = { status: 'success', message: pollData.message, files: pollData.artifact?.files || [] };
                        break;
                    } else if (pollData.status === 'failed') {
                        result = { status: 'error', message: pollData.message, files: [] };
                        break;
                    }
                }
            } else {
                result = data;
            }
            // OS-Level Hydration: Automatically update global manifest on success
            if (result && result.status !== 'error') {
                const mRes = await window.inSetu.api.system('manifest?t=' + Date.now());
                if (mRes.ok) AppStore.setState({ manifest: await mRes.json() });
                if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('synced');
            } else {
                if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('pending'); // Fallback if error
            }
            window.inSetu.ui.setGlobalStatus("✅ Sync Complete", 2000);
            return result;
        } catch (error) {
            if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('pending');
            throw error;
        } finally {
            compilePromise = null;
        }
    })();
    return compilePromise;
};

export async function refreshManifest() {
    try {
        const res = await window.inSetu.api.system('manifest?t=' + Date.now());
        if (res.ok) {
            const manifest = await res.json();
            AppStore.setState({ manifest });
            return manifest;
        }
    } catch (e) {
        console.error("Failed to refresh manifest:", e);
    }
    return null;
}
async function simulatePanic() {
    if (!confirm("This will intentionally crash the server to test the Immutable Recovery Bootloader. The page will reload automatically. Continue?")) return;
    const btn = document.getElementById('simulate-panic-btn');
    if (btn) btn.innerText = "⏳ Crashing...";

    // Declarative UI State Transition
    AppStore.setState({ isRebooting: true, rebootType: 'panic' });

    try {
        await window.inSetu.api.system('panic', { method: 'POST' });
        setInterval(async () => {
            try {
                // The lifeboat OS does not serve a manifest, so we ping the root HTML
                const res = await fetch('/?t=' + Date.now(), { cache: 'no-store' });
                if (res.ok) window.location.reload();
            } catch(err) {}
        }, 1000);
    } catch (e) {
        alert("Error triggering panic.");
    }
}
async function performSoftRefresh() {
    const currentWs = window.inSetu.utils.getActiveWorkspace();

    // Dynamically iterate over all mounted global stores to trigger resets
    Object.values(window.inSetu.stores).forEach(store => {
        if (store && typeof store.getState === 'function') {
            const state = store.getState();
            if (state) {
                if (typeof state.clearPayload === 'function') state.clearPayload();
                if (typeof state.resetState === 'function') state.resetState();
            }
        }
    });

    window.inSetu.events.emitHook('zone:soft-refresh', currentWs);
    try {
        // 1. Update routing topology for the new tenant
        const rRes = await window.inSetu.api.system('topology?t=' + Date.now());
        if (rRes.ok) {
            const d = await rRes.json();
            const tabOrder = d.tab_order || [];
            AppStore.setState({ 
                allRepos: d.repos,
                targetConfigs: d.targets || [],
                configMissing: !!d.config_missing,
                tabOrder: tabOrder
            });
            if (window.ExtensionRegistry?.setTabOrder && tabOrder.length > 0) {
                window.ExtensionRegistry.setTabOrder(tabOrder);
            }
            if (window.inSetu.stores.Gather) {
                window.inSetu.stores.Gather.setState({
                    allRepos: d.repos,
                    targetConfigs: d.targets || [],
                    virtualContexts: d.virtual_contexts || [],
                    categoryOrder: d.category_order || [],
                    hiddenOutputs: d.hidden_outputs || []
                });
            }
        }
        // 2. JIT Mount any missing JS extension payloads using explicit tenant routing
        const cRes = await window.inSetu.api.workspace('system/config?t=' + Date.now(), { cache: 'no-store' });
        if (cRes.ok) {
            const data = await cRes.json();
            const config = data.config || {};
            window.ACTIVE_EXTENSIONS = config.extensions || [];
            window.inSetu.serverSchemas = data.meta?.settings_schemas || {};
            await bootExtensions(); // ES6 naturally caches imports, preventing duplicate execution
            // Dynamically synchronize workspace branding tokens to prevent ghost state layouts
            AppStore.setState({ instanceEmoji: config.instance_emoji || "⚙️" });
            const statusBar = document.querySelector('sutram-status-bar');
            if (statusBar) {
                statusBar.baseTitle = config.instance_title || "inSetu Developer OS";
            }
            // Flush old memory states only for deactivated extensions to protect core layout definitions
            if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
                window.ExtensionRegistry._manifests.forEach((ext, extName) => {
                    const isCoreModule = window.inSetu?.isCore ? window.inSetu.isCore(extName) : ['bridge', 'gather', 'config', 'files'].includes(extName);
                    if (!window.ACTIVE_EXTENSIONS.includes(extName) && !isCoreModule) {
                        if (window.ExtensionRegistry.executeUnload) {
                            window.ExtensionRegistry.executeUnload(extName);
                        }
                    }
                });
            }
            // Rebuild Settings Actions based strictly on active extensions
            if (window.ExtensionRegistry) {
                window.ExtensionRegistry._settingsActions = [];
                window.ExtensionRegistry._manifests.forEach((manifest, extName) => {
                    const isCore = window.inSetu?.isCore ? window.inSetu.isCore(extName) : ['bridge', 'gather', 'config', 'files', 'editor'].includes(extName);
                    if (isCore || window.ACTIVE_EXTENSIONS.includes(extName)) {
                        if (manifest.settingsActions) {
                            manifest.settingsActions.forEach(act => {
                                // Skip generic settings, autoWireSettingsSchemas handles them below
                                if (act.id === `${extName}_generic_settings`) return;
                                let sectionName = 'Extensions';
                                if (isCore || manifest.name === 'Workspace Configuration' || act.id === 'config_editor' || act.id === 'workspaces_editor') sectionName = 'System';
                                else if (manifest.name === 'Issue Tracker') sectionName = 'Tracker';
                                else if (manifest.name === 'Skills Tracker') sectionName = 'Practice';
                                window.ExtensionRegistry.registerSettingsAction(act.id, act.label, act.icon, act.onClick, sectionName);
                            });
                        }
                    }
                });
            }

            autoWireSettingsSchemas();
            // Recompile the primary and sub-tab layouts cleanly from the registry blueprints
            if (window.ExtensionRegistry && typeof window.ExtensionRegistry.compileLayout === 'function') {
                window.ExtensionRegistry.compileLayout();
            }
            // Re-render subtab navigation lists natively from scratch using the fresh registry state
            const state = AppStore.getState();
            if (state.activeTab) {
                window.dispatchEvent(new CustomEvent('sutram-route-changed', {
                    detail: { tab: state.activeTab, subTabs: state.activeSubTabs }
                }));
            }
        }
        // 3. Hydrate the workspace instantly from cache, falling back to compile only if unbuilt
        const currentWsSafe = window.inSetu.utils.getActiveWorkspace();
        AppStore.setState({ manifest: {} });
        let mRes = await window.inSetu.api.system('manifest?t=' + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : {};
        const gatherState = window.inSetu.stores.Gather ? window.inSetu.stores.Gather.getState() : {};
        const hasActiveRepos = gatherState.targetConfigs && gatherState.targetConfigs.length > 0;
        if (Object.keys(manifestData).length === 0 && hasActiveRepos) {
            // Force a blocking build only if no cached topology exists and there are active repos to map
            await executeSystemCompile();
        } else {
            // Instant soft switch using cached state or a clean empty baseline
            AppStore.setState({ manifest: manifestData });
            // Trust the background watchdog/metronome to maintain SOTU differential syncs; 
            // no need to thrash the compiler heavily on every UI tab swap.
        }
        // 4. Hydrate active DOM views using native routing
        const { activeTab } = AppStore.getState();
        if (window.inSetu.sys && window.inSetu.sys.switchTab) window.inSetu.sys.switchTab(null, activeTab || 'context');

        window.inSetu.ui.setGlobalStatus("✅ Workspace Hydrated", 2000);
    } catch (e) {
        console.error(e);
        alert("Soft refresh failed. Falling back to hard reload.");
        window.location.reload();
    }
}
async function fullRefresh() {
    const btn = document.getElementById('full-refresh-btn');
    if (btn) btn.innerText = "⏳ Syncing...";
    try {
        // Purge stale UI state before syncing
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
            if (k.startsWith('insetu_pinned_') || k.startsWith('insetu_task_') || k.startsWith('insetu_lib_')) {
                localStorage.removeItem(k);
            }
        });
        // We skip performSoftRefresh here because the hard reload will natively  
        // fetch the correct tenant configuration on boot via the interceptor.
        window.location.reload();
    } catch (error) {
        alert("Error during full refresh.");
        if (btn) btn.innerText = "🔄 Full UI Refresh";
    }
}
async function initializeWorkspaceTopology() {
    // 1. Fetch Repository Configurations
    try {
        const rRes = await window.inSetu.api.system('topology');
        if (rRes.ok) {
            const d = await rRes.json();
            const tabOrder = d.tab_order || [];
            AppStore.setState({ 
                allRepos: d.repos,
                targetConfigs: d.targets || [],
                configMissing: !!d.config_missing,
                tabOrder: tabOrder
            });
            if (window.ExtensionRegistry?.setTabOrder && tabOrder.length > 0) {
                window.ExtensionRegistry.setTabOrder(tabOrder);
            }
            if (window.inSetu.stores.Gather) {
                window.inSetu.stores.Gather.setState({
                    allRepos: d.repos,
                    targetConfigs: d.targets || [],
                    virtualContexts: d.virtual_contexts || [],
                    categoryOrder: d.category_order || [],
                    hiddenOutputs: d.hidden_outputs || []
                });
            }
        }
} catch(e) { console.error("Topology fetch failed:", e); }
    // 2. Auto-Hydrate Manifest
    try {
        let mRes = await window.inSetu.api.system('manifest?t=' + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : {};
        if (Object.keys(manifestData).length === 0) {
            await executeSystemCompile();
            manifestData = AppStore.getState().manifest;
        }
        if (mRes.ok || manifestData) {
            AppStore.setState({ manifest: manifestData });
        }
    } catch (e) {
        console.error("Auto-hydration failed:", e);
    }
}

/* ==========================================================================
            ES6 MODULE PREPARATION (WINDOW BRIDGE)
            Explicitly binding UI-triggered functions to the global scope so they 
            survive the transition to <script type="module">
            ========================================================================== */
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.sys.fullRefresh = fullRefresh;
window.inSetu.sys.performSoftRefresh = performSoftRefresh;
window.inSetu.sys.refreshManifest = refreshManifest;
window.inSetu.sys.simulatePanic = simulatePanic;
window.inSetu.sys.executeSystemCompile = executeSystemCompile;
window.inSetu.sys.executeWorkspaceMutation = executeWorkspaceMutation;
window.inSetu.sys.loadWorkspaces = loadWorkspaces;
window.inSetu.sys.executeWorkspaceSwap = executeWorkspaceSwap;
window.inSetu.ui.setGlobalStatus = setGlobalStatus;
window.inSetu.ui.setSyncStatus = setSyncStatus;

