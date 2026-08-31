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
    // 2. Active Element (Piercing Shadow DOM)
    let activeEl = document.activeElement;
    while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
        activeEl = activeEl.shadowRoot.activeElement;
    }
    if (activeEl && activeEl !== document.body) {
        const tag = activeEl.tagName.toLowerCase();
        contexts.unshift('element:' + tag);
        if (activeEl.id) contexts.unshift('element-id:' + activeEl.id);
    }
    // 3. Active Modal (Highest Priority)
    const openModals = Array.from(document.querySelectorAll('sutram-modal[open], insetu-file-modal, dialog[open]'));
    openModals.forEach(m => {
        if (m.tagName.toLowerCase() === 'insetu-file-modal') {
            const state = window.inSetu?.stores?.Fs?.getState()?.fileModal;
            if (state && state.open) {
                contexts.unshift('modal:file-modal');
            }
        } else if (m.id) {
            contexts.unshift('modal:' + m.id);
        }
    });

    return contexts;
});
// Default OS Shortcut Registrations

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
                    // Pass the full schema. The generic settings modal will natively 
                    // intercept managedKeys and render custom inline buttons.
                    const action = {
                        id: `${extName}_generic_settings`,
                        label: `${manifest.name || extName.charAt(0).toUpperCase() + extName.slice(1)} Base Settings`,
                        icon: '⚙️',
                        onClick: async () => {
                            const genericModal = document.getElementById('insetu-generic-settings-root');
                            if (genericModal) {
                                let formData = {};
                                try {
                                    const res = await window.inSetu.api.workspace.get(`${extName}/settings?t=${Date.now()}`);
                                    if (res.ok) formData = await res.json();
                                } catch(e) {}
                                genericModal.openModal(extName, schema, formData);
                            }
                        }
                    };
                    manifest.settingsActions.push(action);
                }

                // Push directly to the registry to ensure it renders in the top-right DOM dropdown
                if (typeof window.ExtensionRegistry.registerSettingsAction === 'function') {
                    manifest.settingsActions.forEach(act => {
                        window.ExtensionRegistry.registerSettingsAction(act.id, act.label, act.icon, act.onClick, isCore ? 'System' : 'Extensions');
                    });
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
// --- DECENTRALIZED MANIFEST SYNC & KERNEL HEARTBEAT ---
let lastManifestSyncTs = 0;
let localVfsSignatures = {};
let localCtxSignatures = {};

async function checkManifestVersion() {
    if (!window.BOOT_COMPLETE) return;
    try {
        const deltaRes = await window.inSetu.api.system.get(`deltas?since=${lastManifestSyncTs}`);
        if (!deltaRes.ok) return;

        const deltaData = await deltaRes.json();
        let manifestUpdated = false;

        const stateManifest = AppStore.getState().manifest || { vfs: {}, ctx: {} };
        const currentManifest = { 
            vfs: { ...(stateManifest.vfs || {}) }, 
            ctx: { ...(stateManifest.ctx || {}) } 
        };

        const sigs = deltaData.signatures || {};
        // 1. Evaluate VFS Repo Signatures
        if (sigs.vfs) {
            for (const [repo, sig] of Object.entries(sigs.vfs)) {
                if (sig === null) {
                    // Tombstone: Remove repo buckets
                    Object.keys(currentManifest.vfs).forEach(key => {
                        if (key.startsWith(`${repo}::`)) delete currentManifest.vfs[key];
                    });
                    delete localVfsSignatures[repo];
                    manifestUpdated = true;
                } else if (localVfsSignatures[repo] !== sig) {
                    // Short-circuit N+1 fetches on workspace swap/boot if we already have the data
                    if (lastManifestSyncTs === 0 && currentManifest.vfs && Object.keys(currentManifest.vfs).some(k => k.startsWith(`${repo}::`))) {
                        localVfsSignatures[repo] = sig;
                        continue;
                    }
                    // Surgical Fetch: Fetch repo tree
                    const treeRes = await window.inSetu.api.workspace.get(`topology/vfs?repo=${encodeURIComponent(repo)}`);
                    if (treeRes.ok) {
                        const treeData = await treeRes.json();
                        if (treeData.buckets) {
                            Object.assign(currentManifest.vfs, treeData.buckets);
                            localVfsSignatures[repo] = sig;
                            manifestUpdated = true;
                        }
                    }
                }
            }
        }

        // 2. Evaluate CTX Artifact Signatures
        if (sigs.ctx) {
            for (const [path, ts] of Object.entries(sigs.ctx)) {
                if (ts === null) {
                    delete currentManifest.ctx[path];
                    delete localCtxSignatures[path];
                    manifestUpdated = true;
                } else if (localCtxSignatures[path] !== ts) {
                    // Short-circuit N+1 fetches on workspace swap/boot if we already have the data
                    if (lastManifestSyncTs === 0 && currentManifest.ctx && currentManifest.ctx[path]) {
                        localCtxSignatures[path] = ts;
                        continue;
                    }
                    const entryRes = await window.inSetu.api.workspace.get(`gather/manifest/entry?path=${encodeURIComponent(path)}`);
                    if (entryRes.ok) {
                        const entryData = await entryRes.json();
                        if (entryData.entry) {
                            currentManifest.ctx[path] = entryData.entry;
                        } else {
                            delete currentManifest.ctx[path];
                        }
                        localCtxSignatures[path] = ts;
                        manifestUpdated = true;
                    } else if (entryRes.status === 404) {
                        delete currentManifest.ctx[path];
                        delete localCtxSignatures[path];
                        manifestUpdated = true;
                    }
                }
            }
        }
        if (manifestUpdated) {
            AppStore.setState({ manifest: currentManifest || { vfs: {}, ctx: {} } });
        }
        if (deltaData.timestamp) {
            lastManifestSyncTs = deltaData.timestamp;
        }
        // 3. Dispatch Physical Mutations to Event Bus
        if (deltaData.mutations && deltaData.mutations.length > 0) {
            try {
                window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: deltaData.mutations });
            } catch (e) {
                console.error("VFS Mutation Hook Error:", e);
            }
        }

        // 4. Sync UI Status with Kernel Compilation State
        if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) {
            if (deltaData.is_compiling) {
                window.inSetu.ui.setSyncStatus('syncing');
            } else if (!deltaData.mutations || deltaData.mutations.length === 0) {
                window.inSetu.ui.setSyncStatus('synced');
            }
        }
    } catch (e) {
        console.warn("Heartbeat delta check failed:", e);
    }
}
window.ExtensionRegistry.registerTick('manifest_sync', 3000, checkManifestVersion);
window.ExtensionRegistry.registerTick('core_refresh', 1000, updateRefreshText);
// Delegate execution to the Tier 1 agnostic metronome
window.ExtensionRegistry.startMetronome(
    () => window.ACTIVE_EXTENSIONS || [],
    [...Array.from(window.inSetu?.CORE_MODULES || ['bridge', 'gather', 'config', 'files']), 'core_refresh', 'manifest_sync']
);
import './core/api.js'; // Mount explicit API client and network interceptors
import { createJobPoller } from '../vendor/sutram/js/poller.js';
// Define the Job Polling Subroutine using the abstracted kernel
const _basePoller = createJobPoller({
    get: async (path) => window.inSetu.api.system.get(path)
});

// ADR 0017: Wrap the global poller to statelessly swallow callbacks if the tenant workspace shifts mid-flight
window.inSetu.utils.pollJob = (jobId, options = {}) => {
    const initWs = window.inSetu.utils.getActiveWorkspace();
    const safeOptions = { ...options };
    ['onProgress', 'onComplete', 'onError'].forEach(cbName => {
        if (options[cbName]) {
            safeOptions[cbName] = (...args) => {
                if (window.inSetu.utils.getActiveWorkspace() !== initWs) return;
                return options[cbName](...args);
            };
        }
    });
    return _basePoller(jobId, safeOptions);
};
// Restore UI State on Load
let bootCurrentStep = 0;
let bootTotalSteps = 8;
let bootHighestPercent = 0;
function updateBootProgress(statusMsg) {
    bootCurrentStep++;
    let percent = Math.min(100, Math.round((bootCurrentStep / bootTotalSteps) * 100));
    bootHighestPercent = Math.max(bootHighestPercent, percent);
    percent = bootHighestPercent;

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

    // 1. Establish tenant workspace context FIRST so API calls route to the true active workspace
    console.log("[BOOT] Loading Workspaces...");
    updateBootProgress("Loading Workspaces...");
    await loadWorkspaces();

    // 2. Fetch tenant configuration for the true active workspace
    try {
        console.log("[BOOT] Fetching system configuration...");
        updateBootProgress("Fetching system config...");
        const cRes = await window.inSetu.api.system.get('config?t=' + Date.now(), { cache: 'no-store' });
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
    console.log("[BOOT] Workspaces loaded.");
    console.log("[BOOT] Initializing Workspace Topology...");
    updateBootProgress("Initializing Topology...");
    await initializeWorkspaceTopology();
    console.log("[BOOT] Topology initialized.");
    console.log("[BOOT] Booting Extensions...");
    await bootExtensions();
    // Native System Sync Indicator Hook
    window.inSetu.events.emitHook = window.inSetu.events.emitHook || function(){};
    window.addEventListener('insetu:vfs-mutated', (e) => {
        const payload = e.detail;
        if (payload && payload.mutations) {
            const requiresSync = payload.mutations.some(m => !m.ignore_ledger);
            if (requiresSync && window.inSetu.ui && window.inSetu.ui.setSyncStatus) {
                window.inSetu.ui.setSyncStatus('pending');
            }
        }
    });
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
    let lastRouteHash = window.location.hash;
    const handleHashChange = () => {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const parts = hash.split('/').map(decodeURIComponent);

        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const ws = parts[0] || activeWs;
        const tab = parts[1] || 'context';
        const sub = parts[2] || '';
        const deepPath = parts.slice(3);
        if (ws && ws !== activeWs) {
            if (window.inSetu.sys.executeWorkspaceSwap) {
                window.inSetu.sys.executeWorkspaceSwap(ws);
            }
        }

        const state = AppStore.getState();
        const prevTab = state.activeTab;
        const prevSub = state.activeSubTabs[tab];

        let resolvedSub = sub;
        if (!resolvedSub && window.ExtensionRegistry) {
            const slots = window.ExtensionRegistry.getLayoutSlots().filter(s => s.slot === 'slots:sub-navigation' && s.targetParent === tab);
            if (slots.length > 0) {
                slots.sort((a, b) => (a.order || 50) - (b.order || 50));
                resolvedSub = slots[0].id;
            }
        }

        AppStore.getState().setActiveRoute(tab, resolvedSub, deepPath.length > 0 ? deepPath : null);
        // Emit standard non-refresh events upon actual navigation
        if (tab !== prevTab) {
            window.inSetu.events.emitHook('insetu:tab-changed', tab);
        }
        if (resolvedSub && resolvedSub !== prevSub) {
            window.inSetu.events.emitHook('insetu:subtab-changed', { parentId: tab, subId: resolvedSub, forceRefresh: false });
        }
        lastRouteHash = window.location.hash;
    };

    window.addEventListener('hashchange', handleHashChange);
    // Bootstrap initial route from URL or set default
    const currentWs = window.inSetu.utils.getActiveWorkspace();
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
        window.location.hash = `#/${encodeURIComponent(currentWs)}/context/`;
    }
    // Always trigger handleHashChange on startup to populate activeTab in AppStore
    handleHashChange();
    // UDF Subscription: State -> URL mapping
    AppStore.subscribe(
        state => [state.activeWorkspace, state.activeTab, state.activeSubTabs, state.globalBrowsePath],
        ([ws, tab, subs, deep]) => {
            if (!ws || !tab) return;
            const currentSub = subs[tab] || '';
            const deepStr = (deep && deep.length > 0) ? '/' + deep.map(encodeURIComponent).join('/') : '';
            const newHash = `#/${encodeURIComponent(ws)}/${encodeURIComponent(tab)}/${encodeURIComponent(currentSub)}${deepStr}`;

            // Persist the active tab layout per-workspace so it hydrates correctly on swap
            localStorage.setItem(`insetu_active_tab_${ws}`, tab);
            if (currentSub) localStorage.setItem(`insetu_active_subtab_${ws}_${tab}`, currentSub);

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

        let activeSub = state.activeSubTabs[tabId];
        // If there's no saved subtab state, dynamically resolve the default first subtab from the layout topology
        if (!activeSub && window.ExtensionRegistry) {
            const slots = window.ExtensionRegistry.getLayoutSlots().filter(s => s.slot === 'slots:sub-navigation' && s.targetParent === tabId);
            if (slots.length > 0) {
                slots.sort((a, b) => (a.order || 50) - (b.order || 50));
                activeSub = slots[0].id;
                // Silently patch the AppStore so the URL hash aligns with reality
                AppStore.setState({ activeSubTabs: { ...state.activeSubTabs, [tabId]: activeSub } });
            }
        }

        if (isAlreadyActive) {
            window.inSetu.events.emitHook('insetu:force-refresh', { parentId: tabId, subId: activeSub });
        } else {
            AppStore.getState().setActiveRoute(tabId, activeSub || null);
            window.inSetu.events.emitHook('insetu:tab-changed', tabId);
            if (activeSub) {
                window.inSetu.events.emitHook('insetu:subtab-changed', { parentId: tabId, subId: activeSub });
            }
        }
    });

    window.addEventListener('shell-subtab-changed', (e) => {
        const { tabId, subId, isAlreadyActive } = e.detail;

        if (isAlreadyActive) {
            window.inSetu.events.emitHook('insetu:force-refresh', { parentId: tabId, subId });
        } else {
            AppStore.getState().setActiveRoute(tabId, subId);
            window.inSetu.events.emitHook('insetu:subtab-changed', { parentId: tabId, subId });
        }
    });
    try {
        // Hydrate the declarative shell with the initial route state
        const state = AppStore.getState();
        window.dispatchEvent(new CustomEvent('sutram-route-changed', {
            detail: { tab: state.activeTab, subTabs: state.activeSubTabs }
        }));

        if (state.activeTab) {
            window.inSetu.events.emitHook('insetu:tab-changed', state.activeTab);
            const activeSub = state.activeSubTabs[state.activeTab];
            if (activeSub) {
                window.inSetu.events.emitHook('insetu:subtab-changed', { parentId: state.activeTab, subId: activeSub, forceRefresh: true });
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
        e.stopImmediatePropagation();
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
    localVfsSignatures = {};
    localCtxSignatures = {};
    lastManifestSyncTs = 0;
    window.inSetu.ui.setGlobalStatus(`Switched to ${title || key}. Hydrating UI...`, null);
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        } catch(e) {}
    }
    // 1. Persist local storage first so all network requests inherit the new tenant context
    sessionStorage.setItem('insetu_workspace', key);
    localStorage.setItem('insetu_workspace', key);

    // 2. Temporarily clear active extensions during context transition to prevent 403 race conditions
    window.ACTIVE_EXTENSIONS = [];
    // 3. Set AppStore root state as the Single Source of Truth
    const newPinned = new Set(JSON.parse(localStorage.getItem(`insetu_pinned_repos_${key}`)) || ["ALL"]);
    AppStore.setState({ activeWorkspace: key, pinnedRepos: newPinned });

    // Explicitly update location hash to keep router and location bar synchronized
    const savedTab = localStorage.getItem(`insetu_active_tab_${key}`) || 'context';
    const savedSub = localStorage.getItem(`insetu_active_subtab_${key}_${savedTab}`) || '';
    window.location.hash = `#/${encodeURIComponent(key)}/${encodeURIComponent(savedTab)}/${encodeURIComponent(savedSub)}`;
    // 4. Notify backend of the swap
    await window.inSetu.api.system.post('workspaces', { active_workspace: key });

    // 4. Perform top-down AppStore outward cascade
    await performSoftRefresh();
    loadWorkspaces();
}
async function loadWorkspaces() {
    try {
        const res = await window.inSetu.api.system.get('workspaces?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.workspaces) {
            let activeWs = window.inSetu.utils.getActiveWorkspace();
            if (!activeWs || (!data.workspaces[activeWs] && activeWs !== 'default')) {
                activeWs = Object.keys(data.workspaces)[0] || 'default';
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
    window.dispatchEvent(new CustomEvent('sutram-status-update', { detail: { msg, timeout, isError } }));
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
        const options = isFormData ? { headers: {} } : {};
        const res = await window.inSetu.api.workspace.post(cleanPath, payload, options);

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
export const executeSystemCompile = (onProgress = null, forceFull = false, startStep = null, targetRepos = null) => {
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
            const payload = { force_full: forceFull };
            if (startStep) payload.start_step = startStep;
            if (targetRepos) payload.target_repos = targetRepos;

            const response = await window.inSetu.api.workspace.post('gather/submit', payload);

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

                    const pollRes = await window.inSetu.api.system.get(`jobs/${jobId}`, {
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
                        // Expand timeout to 3 minutes (720 retries @ 250ms) to support massive initial topology builds
                        if (retries > 720) {
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
                const mRes = await window.inSetu.api.system.get('manifest?t=' + Date.now());
                if (mRes.ok) AppStore.setState({ manifest: (await mRes.json()) || { vfs: {}, ctx: {} } });
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
        const res = await window.inSetu.api.system.get('manifest?t=' + Date.now());
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
        await window.inSetu.api.system.post('panic', {});
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
    localVfsSignatures = {};
    localCtxSignatures = {};
    lastManifestSyncTs = 0;
    // 1. Read the active tenant directly from AppStore
    const currentWs = AppStore.getState().activeWorkspace || window.inSetu.utils.getActiveWorkspace();

    // 2. Flush feature domain stores from AppStore outwards (exempting infrastructure)
    Object.entries(window.inSetu.stores).forEach(([storeName, store]) => {
        if (['App', 'Status', 'Toast', 'Selection'].includes(storeName)) return;
        if (store && typeof store.getState === 'function') {
            const state = store.getState();
            if (state) {
                if (typeof state.clearPayload === 'function') state.clearPayload();
                if (typeof state.resetState === 'function') state.resetState();
            }
        }
    });
    try {
        // 1. Update routing topology for the new tenant
        const rRes = await window.inSetu.api.system.get('topology?t=' + Date.now());
        if (rRes.ok) {
            const d = await rRes.json();
            const tabOrder = d.tab_order || [];

            // Layout Guardrail: If the restored tab is no longer valid (e.g. extension disabled), fallback to the first available tab
            if (tabOrder.length > 0 && !tabOrder.includes(AppStore.getState().activeTab)) {
                AppStore.getState().setActiveRoute(tabOrder[0], null);
            }

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
        const cRes = await window.inSetu.api.system.get('config?t=' + Date.now(), { cache: 'no-store' });
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
        AppStore.setState({ manifest: { vfs: {}, ctx: {} } });
        let mRes = await window.inSetu.api.system.get('manifest?t=' + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : { vfs: {}, ctx: {} };
        const gatherState = window.inSetu.stores.Gather ? window.inSetu.stores.Gather.getState() : {};
        const hasActiveRepos = gatherState.targetConfigs && gatherState.targetConfigs.length > 0;
        const isEmptyManifest = Object.keys(manifestData.vfs || {}).length === 0 && Object.keys(manifestData.ctx || {}).length === 0;
        if (isEmptyManifest && hasActiveRepos) {
            // Force a blocking build only if no cached topology exists and there are active repos to map
            await executeSystemCompile();
        } else {
            // Instant soft switch using cached state or a clean empty baseline
            AppStore.setState({ manifest: manifestData || { vfs: {}, ctx: {} } });
            // Trust the background watchdog/metronome to maintain SOTU differential syncs;  
            // no need to thrash the compiler heavily on every UI tab swap.
        }
        // 4. Hydrate active DOM views using native routing
        window.inSetu.events.emitHook('insetu:soft-refresh', currentWs);
        const state = AppStore.getState();
        const activeTab = state.activeTab || 'context';
        const activeSub = state.activeSubTabs[activeTab];
        window.inSetu.events.emitHook('insetu:tab-changed', activeTab);
        if (activeSub) {
            window.inSetu.events.emitHook('insetu:subtab-changed', { parentId: activeTab, subId: activeSub, forceRefresh: true });
        }

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
        const rRes = await window.inSetu.api.system.get('topology');
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
        let mRes = await window.inSetu.api.system.get('manifest?t=' + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : { vfs: {}, ctx: {} };
        const isEmptyManifest = Object.keys(manifestData.vfs || {}).length === 0 && Object.keys(manifestData.ctx || {}).length === 0;
        if (isEmptyManifest) {
            await executeSystemCompile();
            manifestData = AppStore.getState().manifest;
        }
        if (mRes.ok || manifestData) {
            AppStore.setState({ manifest: manifestData || { vfs: {}, ctx: {} } });
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

