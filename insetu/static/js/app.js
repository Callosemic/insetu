import { BridgeStore } from './core/bridge.js';
import { AppStore } from './store.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
import './components/ui_dropdowns.js';
import './components/ui_file_tree.js';
import './components/ui_folder_browser.js';
import './components/ui_modal.js';
import './components/ui_system_settings.js';
import './components/ui_filter_pills.js';
import './components/ui_primitives.js';
import './components/ui_editor.js';
import './components/ui_app_shell.js';
import '../vendor/yenvui/js/toast.js';
import '../vendor/yenvui/js/category-section.js';
import '../vendor/yenvui/js/collapsible.js';
import '../vendor/yenvui/js/toolbar.js';
import '../vendor/yenvui/js/editor.js';
import './core/gather.js';
import './config.js';
export function getFlattenedBuckets(repoDir, includeSystem = false) {
    const { targetConfigs } = AppStore.getState();
    const repoCfg = targetConfigs.find(c => c.repo_dir === repoDir);
    if (!repoCfg || !repoCfg.sub_buckets) return [];

    const buckets = [];
    repoCfg.sub_buckets.forEach(b => {
        if (!includeSystem && b.is_system) return;

        if (b.dynamic_split_prefix && b.meta_map) {
            Object.keys(b.meta_map).forEach(module => {
                buckets.push({ id: module, title: b.meta_map[module].title || module, original: b });
            });
        } else if (!b.dynamic_split_prefix) {
            buckets.push({ id: b.id, title: b.title || b.id, original: b });
        }
    });
    return buckets;
}

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

    const bridgeState = BridgeStore.getState();
    if (bridgeState && bridgeState.payloadText && bridgeState.payloadText.trim() !== '') {
        isDirty = true;
    }

    const fm = window.inSetu.stores.Fs?.getState()?.fileModal;
    if (fm && fm.open && fm.isFS && fm.content !== fm.originalContent) {
        isDirty = true;
    }

    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// --- CENTRALIZED SHORTCUT ROUTER ---
window.addEventListener('keydown', (e) => {
    let keyStr = e.key.toLowerCase();
    // Ignore lone modifier presses
    if (['control', 'meta', 'shift', 'alt'].includes(keyStr)) return;

    let prefix = '';
    if (e.ctrlKey || e.metaKey) prefix += 'ctrl+';
    if (e.shiftKey) prefix += 'shift+';
    if (e.altKey) prefix += 'alt+';

    const combo = prefix + (keyStr === ' ' ? 'space' : keyStr);
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

    const { shortcuts } = window.ExtensionRegistry;
    if (!shortcuts) return;

    for (let ctx of contexts) {
        if (shortcuts[ctx] && shortcuts[ctx][combo]) {
            e.preventDefault();
            shortcuts[ctx][combo](e);
            return;
        }
    }
});

// Default OS Shortcut Registrations
window.ExtensionRegistry.registerShortcut('global', 'escape', () => {
    // 1. Check for dynamic Factory Modals first
    const dynamicModals = Array.from(document.querySelectorAll('.dynamic-modal'));
    if (dynamicModals.length > 0) {
        const topModal = dynamicModals[dynamicModals.length - 1]; // Get last appended
        window.inSetu.ui.Factory.closeModal(topModal.id);
        return;
    }
    // 2. Fallback for legacy hardcoded modals
    const activeModal = Array.from(document.querySelectorAll('.fullscreen-modal')).find(m => window.getComputedStyle(m).display === 'block');
    if (activeModal) {
        if (activeModal.id === 'file-modal' && window.inSetu.ui.closeFileModal) {
            window.inSetu.ui.closeFileModal();
            return;
        }
        // Trigger specific close/cancel buttons to ensure teardown logic fires natively
        const closeBtn = activeModal.querySelector(`button[style*="dc2626"], button[onclick*="display='none'"]`);
        if (closeBtn) closeBtn.click();
        else activeModal.style.display = 'none';
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
window.ExtensionRegistry.registerShortcut('modal:new-task-modal', 'ctrl+s', () => {
    const shell = document.querySelector('insetu-app-shell');
    const el = shell ? shell.shadowRoot.querySelector('insetu-ext-tracker-modals') : document.querySelector('insetu-ext-tracker-modals');
    if (el) el._saveNewTask();
});
window.ExtensionRegistry.registerShortcut('modal:edit-task-modal', 'ctrl+s', () => {
    const shell = document.querySelector('insetu-app-shell');
    const el = shell ? shell.shadowRoot.querySelector('insetu-ext-tracker-modals') : document.querySelector('insetu-ext-tracker-modals');
    if (el) el._saveEditTask();
});
window.ExtensionRegistry.registerShortcut('modal:config-editor-modal', 'ctrl+s', () => document.getElementById('config-editor-save')?.click());
    const packSelectionPayload = async (items) => {
        const payloadItems = items.map(i => {
            if (i.data?.folderpath) return { folderpath: i.data.folderpath };
            if (i.data?.filepath) return { filepath: i.data.filepath };
            return null;
        }).filter(i => i !== null);

        if (payloadItems.length === 0) throw new Error("No valid items to pack.");

        const res = await window.inSetu.api.workspace('gather/pack_selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payloadItems })
        });
        if (!res.ok) throw new Error("Failed to queue compilation.");
        const data = await res.json();
        return new Promise((resolve, reject) => {
            window.inSetu.utils.pollJob(data.job_id, {
                onProgress: (msg) => { if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null); },
                onComplete: async (statusData) => {
                    // Update global manifest manually so downstream modals can find the chunk metadata
                    try {
                        const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
                        if (mRes.ok) window.inSetu.stores.App.setState({ manifest: await mRes.json() });
                    } catch(e) {}
                    resolve(statusData.artifact);
                },
                onError: (err) => reject(err)
            });
        });
    };

    window.ExtensionRegistry.registerExtension('batch-actions', {
        name: "Batch Actions",
        batchActions: [
            {
                id: 'batch-download',
                label: 'Download',
                icon: '⬇️',
                intent: 'primary',
                order: 20,
                match: (items) => items.length > 0 && items.every(i => i.data?.filepath || i.data?.folderpath),
                asyncAction: async (items) => {
                    try {
                        const artifact = await packSelectionPayload(items);
                        window.inSetu.stores.Selection.getState().clearSelection();
                        if (artifact.chunks && artifact.chunks.length > 1) {
                            if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Opening Parts...", 2000);
                            // Switch to context tab to ensure modal renders
                            if (window.inSetu.sys && window.inSetu.sys.switchTab) window.inSetu.sys.switchTab(null, 'context');
                            window.dispatchEvent(new CustomEvent('insetu:gather:view-parts', { detail: { filepath: artifact.base_filename } }));
                        } else {
                            if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading...", 2000);
                            if (window.inSetu.vfs.fetchAndDownloadState) {
                                await window.inSetu.vfs.fetchAndDownloadState(artifact.base_filename, `/download/${artifact.base_filename}`);
                            }
                        }
                    } catch (err) {
                        alert("Packing failed: " + err.message);
                    }
                }
            },
            {
                id: 'batch-share',
                label: 'Share',
                icon: '📤',
                intent: 'neutral',
                order: 30,
                match: (items) => !!navigator.share && !!navigator.canShare && items.length > 0 && items.every(i => i.data?.filepath || i.data?.folderpath),
                asyncAction: async (items) => {
                    try {
                        const artifact = await packSelectionPayload(items);
                        window.inSetu.stores.Selection.getState().clearSelection();

                        if (window.inSetu.vfs.shareFiles) {
                            await window.inSetu.vfs.shareFiles(artifact.base_filename, artifact.chunks);
                        }
                    } catch (err) {
                        alert("Packing failed: " + err.message);
                    }
                }
            }
        ]
    });
import { LitElement, html, css } from 'lit';
import { InSetuElement } from './sdk.js';

export class InSetuSelectionTray extends InSetuElement {
    static properties = { 
        selectedItems: { type: Object },
        modalOpen: { type: Boolean }
    };

    static styles = css`
        .cart-btn {
            background: var(--intent-highlight);
            color: white;
            border: none;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            transition: transform 0.2s;
            padding: 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .cart-btn:hover {
            transform: scale(1.1);
        }
    `;

    constructor() {
        super();
        this.selectedItems = new Map();
        this.modalOpen = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(window.inSetu.stores.Selection, state => {
            this.selectedItems = state.selectedItems;
            if (this.selectedItems.size === 0) this.modalOpen = false;
            this.requestUpdate();
        });
        this.selectedItems = window.inSetu.stores.Selection.getState().selectedItems;
    }

    render() {
        const count = this.selectedItems.size;
        const itemsArray = Array.from(this.selectedItems.values());

        let batchActions = [];
        if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
            window.ExtensionRegistry._manifests.forEach(config => {
                if (config.batchActions) {
                    config.batchActions.forEach(act => {
                        if (act.match(itemsArray)) batchActions.push(act);
                    });
                }
            });
        }
        batchActions.sort((a, b) => (a.order || 99) - (b.order || 99));
        return html`
            ${count > 0 ? html`
                <button class="cart-btn" title="View Selected Items" @click=${() => this.modalOpen = true}>${count}</button>
            ` : ''}

            <insetu-modal ?open=${this.modalOpen} ?fullscreen=${true} titleText="Selected Items (${count})" @modal-closed=${() => this.modalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow-y: auto;">
                    ${itemsArray.map(item => html`
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 4px;">
                            <span style="font-family: monospace; font-size: 0.85rem; color: var(--text); word-break: break-all;">${item.data?.filepath || item.data?.folderpath || item.data?.id || 'Unknown Item'}</span>
                            <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 4px 8px; font-size: 1rem; cursor: pointer; margin: 0;" @click=${() => {
                                const id = item.data?.filepath || item.data?.folderpath || item.data?.id;
                                if (id) window.inSetu.stores.Selection.getState().toggleSelection(id, item.entityType, item.data);
                            }}>✕</button>
                        </div>
                    `)}
                </div>
                <insetu-async-btn 
                    slot="footer" 
                    label="🗑️ Clear" 
                    intent="danger" 
                    .onClick=${() => window.inSetu.stores.Selection.getState().clearSelection()}>
                </insetu-async-btn>
                ${batchActions.map(act => html`
                    <insetu-async-btn   
                        slot="footer"
                        label="${act.icon} ${act.label}" 
                        intent="${act.intent || 'primary'}" 
                        .onClick=${async (e) => {
                            await act.asyncAction(itemsArray, e);
                        }}>
                    </insetu-async-btn>
                `)}
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-selection-tray', InSetuSelectionTray);

export function autoWireSettingsSchemas() {
    if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
        window.inSetu.settingsSchemas = window.inSetu.settingsSchemas || {};

        const allExts = new Set([
            ...Array.from(window.ExtensionRegistry._manifests.keys()),
            ...Object.keys(window.inSetu.settingsSchemas),
            ...Object.keys(window.inSetu.serverSchemas || {})
        ]);
        allExts.forEach((extName) => {
            const isCore = ['bridge', 'gather', 'config', 'files', 'editor'].includes(extName);
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
                        onClick: () => {
                            const genericModal = document.getElementById('insetu-generic-settings-root');
                            if (genericModal) genericModal.openModal(extName);
                        }
                    };
                    manifest.settingsActions.push(action);
                }
                // Push directly to the registry to ensure it renders in the DOM
                if (typeof window.ExtensionRegistry.registerSettingsAction === 'function') {
                    const actionToRegister = manifest.settingsActions.find(a => a.id === `${extName}_generic_settings`);
                    if (actionToRegister) {
                        const isCoreConfig = ['bridge', 'gather', 'config', 'files', 'editor'].includes(extName);
                        window.ExtensionRegistry.registerSettingsAction(actionToRegister.id, actionToRegister.label, actionToRegister.icon, actionToRegister.onClick, isCoreConfig ? 'System' : 'Extensions');
                    }
                }
            }
        });
    }
}

async function bootExtensions() {
    if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.length > 0) {
        for (const ext of window.ACTIVE_EXTENSIONS) {
            if (ext === 'config') continue; // Core OS module, already hard-imported
            try {
                // Dynamically load the module native to the browser
                await import(`/static/js/extensions/ext_${ext}.js`);
                console.log(`🔌 Loaded UI Extension: ${ext}`);
            } catch (e) {
                console.error(`⚠️ Failed to load UI extension: ${ext}`, e);
            }
        }
    }
    // Automatically map schemas to the System Settings menu
    autoWireSettingsSchemas();
}
// --- THE CENTRALIZED FRONTEND METRONOME ---
window.ExtensionRegistry.registerTick('core_refresh', 1000, updateRefreshText);
// Evaluate ticks every 100ms to allow sub-second, high-resolution polling for critical extensions
setInterval(() => {
    const now = Date.now();
    window.ExtensionRegistry._ticks.forEach((tasks, extName) => {
        // Guardrail: Short-circuit background updates instantly if the extension is disabled or tearing down
        const isCore = ['bridge', 'gather', 'config', 'files', 'core_refresh'].includes(extName);
        if (!isCore && (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes(extName))) {
            return;
        }
        tasks.forEach(task => {
            if (now - task.lastRun >= task.interval) {
                task.lastRun = now;
                try { 
                    task.cb(); 
                } catch (e) { 
                    console.error(`Tick error in extension [${extName}]:`, e); 
                }
            }
        });
    });
}, 100);
import './api.js'; // Mount explicit API client and network interceptors

// Restore UI State on Load
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

window.addEventListener('DOMContentLoaded', async () => {
    const authenticated = await executeSecurityHandshake();
    if (!authenticated) {
        document.body.innerHTML = `<div style="font-family:monospace; color:var(--intent-danger); text-align:center; padding-top:20dvh;"><h2>❌ Access Denied</h2><p>Invalid framework credentials configuration.</p></div>`;
        return;
    }
    // Fetch tenant-specific configuration to override the server's stateless HTML injection
    try {
        const cRes = await window.inSetu.api.workspace('system/config?t=' + Date.now(), { cache: 'no-store' });
        if (cRes.ok) {
            const data = await cRes.json();
            const config = data.config || {};
            window.ACTIVE_EXTENSIONS = config.extensions || [];
            window.inSetu.serverSchemas = data.meta?.settings_schemas || {};
            // Synchronize branding tokens while we have the config
            AppStore.setState({ instanceEmoji: config.instance_emoji || "⚙️" });
            const statusBar = document.querySelector('insetu-status-bar');
            if (statusBar) {
                statusBar.baseTitle = config.instance_title || "inSetu Developer OS";
            }
        }
    } catch (e) {
        console.warn("Failed to fetch tenant configuration on boot.", e);
    }
    await bootExtensions();
    // Load the available multi-tenant workspaces into the UI securely
    await loadWorkspaces();

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
        }
    );

    // Wait for configuration and topology to settle before mounting layout
    await initializeWorkspaceTopology();
    // Compile the primary and settings layouts cleanly from the registry blueprints
    if (window.ExtensionRegistry && typeof window.ExtensionRegistry.compileLayout === 'function') {
        window.ExtensionRegistry.compileLayout();
    }
});
// Evade iOS PWA suspension timeout races by clearing the panic switch immediately upon JS evaluation
if (window.panicTimeout) clearTimeout(window.panicTimeout);
const _initPanicBtn = document.getElementById('js-panic-button');
if (_initPanicBtn) _initPanicBtn.style.display = 'none';

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
        if (store.getState().clearPayload) store.getState().clearPayload();
        if (store.getState().resetState) store.getState().resetState();
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
    const now = new Date();
    const diff = Math.floor((now - lastRefreshed) / 1000);
    let text = "";
    if (diff < 60) text = `${diff} second${diff !== 1 ? 's' : ''} ago`;
    else if (diff < 3600) text = `${Math.floor(diff/60)} minute${Math.floor(diff/60) !== 1 ? 's' : ''} ago`;
    else text = `${Math.floor(diff/3600)} hour${Math.floor(diff/3600) !== 1 ? 's' : ''} ago`;
    const el = document.getElementById('refresh-time');
    if (el) el.innerText = `Refreshed ${text}`;
}
export function setGlobalStatus(msg, timeout = 3000, isError = false) {
    window.dispatchEvent(new CustomEvent('insetu-status-update', { detail: { msg, timeout, isError } }));
}
// --- NON-BLOCKING TOAST NOTIFICATIONS ---
// Hijack native alerts to prevent thread blocking while preserving stack traces
let activeToasts = [];
let toastIdCounter = 0;

window.alert = function(msg, intent = 'danger') {
    let container = document.querySelector('yenvui-toast-container');
    if (!container) {
        container = document.createElement('yenvui-toast-container');
        document.body.appendChild(container);

        // Listen for internal dismissals from the yenVUI component
        container.addEventListener('yenvui-toast-dismissed', (e) => {
            activeToasts = activeToasts.filter(t => t.id !== e.detail.id);
            container.toasts = [...activeToasts];
        });
    }

    // Anti-spam constraint: Prevent stacking identical active toasts
    if (activeToasts.some(t => t.message === msg)) {
        return;
    }

    const id = `toast_${toastIdCounter++}`;
    const newToast = { id, message: msg, intent };
    activeToasts = [...activeToasts, newToast];
    container.toasts = [...activeToasts];

    setTimeout(() => {
        activeToasts = activeToasts.filter(t => t.id !== id);
        if (container) container.toasts = [...activeToasts];
    }, 6000);
};
export async function executeWorkspaceMutation(path, payload, options = {}) {
    const {
        btnId,
        loadingText = "Processing...",
        silent = false,
        onSuccess = () => {}
    } = options;
    const btn = btnId ? document.getElementById(btnId) : null;
    let origText = "";
    if (btn && !silent) {
        origText = btn.innerText;
        btn.innerText = loadingText;
        window.inSetu.ui.setGlobalStatus(loadingText, null);
    }

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
        if (res.ok) {
            await onSuccess(res);
        } else if (!silent) {
            let errMsg = res.statusText;
            try {
                const errData = await res.clone().json();
                errMsg = errData.error || errMsg;
            } catch (parseError) {
                const rawText = await res.text();
                errMsg = `Raw Server Error (${res.status}):\n\n${rawText.substring(0, 500)}`;
            }
            alert(`Operation failed.\nReason: ${errMsg}`);
        }
        return res.ok;
    } catch (e) {
        if (!silent) {
            alert(`Network error: ${e.message}`);
            window.inSetu.ui.setGlobalStatus(`❌ Error: ${e.message}`, 5000);
        }
        return false;
    } finally {
        if (btn && !silent) {
            btn.innerText = origText;
            window.inSetu.ui.setGlobalStatus("✅ Success!", 2000);
        }
    }
}
let compilePromise = null;
let compilePromiseWs = null;
export const executeSystemCompile = (onProgress = null, forceFull = false) => {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    if (compilePromise && compilePromiseWs === activeWs) return compilePromise;

    // Guardrail: Short-circuit the compilation pipeline instantly if the workspace has no repositories tracked
    if (!AppStore.getState().targetConfigs || AppStore.getState().targetConfigs.length === 0) {
        return Promise.resolve({ status: 'success', message: "No tracked repositories configured.", files: [] });
    }

    compilePromiseWs = activeWs;
    compilePromise = (async () => {
        try {
            const headers = window.inSetu.api._getHeaders(true);
            headers.append('Content-Type', 'application/json');

            const response = await fetch('/submit', {
                method: 'POST',
                headers: headers,
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
                        if (retries > 600) { // 10 minute absolute timeout
                            result = { status: 'error', message: 'Compilation timed out.', files: [] };
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
                const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
                if (mRes.ok) AppStore.setState({ manifest: await mRes.json() });
            }

            window.inSetu.ui.setGlobalStatus("✅ Sync Complete", 2000);
            return result;
        } catch (error) {
            throw error;
        } finally {
            compilePromise = null;
        }
    })();
    return compilePromise;
};
async function simulatePanic() {
    if (!confirm("This will intentionally crash the server to test the Immutable Recovery Bootloader. The page will reload in 3 seconds. Continue?")) return;
    const btn = document.getElementById('simulate-panic-btn');
    if (btn) btn.innerText = "⏳ Crashing...";
    try {
        await window.inSetu.api.system('panic', { method: 'POST' });
        setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
        alert("Error triggering panic.");
    }
}
async function performSoftRefresh() {
    const currentWs = window.inSetu.utils.getActiveWorkspace();

    // Dynamically iterate over all mounted global stores to trigger resets
    Object.values(window.inSetu.stores).forEach(store => {
        if (store.getState().clearPayload) store.getState().clearPayload();
        if (store.getState().resetState) store.getState().resetState();
    });

    window.inSetu.events.emitHook('zone:soft-refresh', currentWs);

    try {
        // 1. Update routing topology for the new tenant
        const rRes = await window.inSetu.api.workspace('repos?t=' + Date.now());
        if (rRes.ok) {
            const d = await rRes.json();
            AppStore.setState({
                allRepos: d.repos,
                targetConfigs: d.targets || [],
                virtualContexts: d.virtual_contexts || [],
                categoryOrder: d.category_order || [],
                tabOrder: d.tab_order || [],

                hiddenOutputs: d.hidden_outputs || []
            });

            let banner = document.getElementById('missing-config-banner');
            if (d.config_missing) {
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'missing-config-banner';
                    banner.style.cssText = "background: var(--intent-warning); color: #000; padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem;";
                    banner.innerHTML = "⚠️ Configuration file missing. Operating in empty fallback state. <span style='cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;' onclick='this.parentElement.style.display=\"none\"'>Dismiss</span>";
                    document.body.appendChild(banner);
                } else {
                    banner.style.display = 'block';
                }
            } else if (banner) {
                banner.style.display = 'none';
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
            const statusBar = document.querySelector('insetu-status-bar');
            if (statusBar) {
                statusBar.baseTitle = config.instance_title || "inSetu Developer OS";
            }
            // Flush old memory states only for deactivated extensions to protect core layout definitions
            if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
                window.ExtensionRegistry._manifests.forEach((ext, extName) => {
                    if (!window.ACTIVE_EXTENSIONS.includes(extName) && !['bridge', 'gather', 'config', 'files'].includes(extName)) {
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
                    const isCore = ['bridge', 'gather', 'config', 'files', 'editor'].includes(extName);
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
            const { activeTab } = AppStore.getState();
            if (activeTab) {
                window.inSetu.events.emitHook('zone:tab-changed', activeTab);
            }
        }
        // 3. Hydrate the workspace instantly from cache, falling back to compile only if unbuilt
        const currentWsSafe = window.inSetu.utils.getActiveWorkspace();
        AppStore.setState({ manifest: {} });

        let mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : {};

        const hasActiveRepos = AppStore.getState().targetConfigs.length > 0;
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
        const rRes = await window.inSetu.api.workspace('repos');
        if (rRes.ok) {
            const d = await rRes.json();
            AppStore.setState({
                allRepos: d.repos,
                targetConfigs: d.targets || [],
                virtualContexts: d.virtual_contexts || [],
                categoryOrder: d.category_order || [],
                tabOrder: d.tab_order || [],
                hiddenOutputs: d.hidden_outputs || []
            });
            if (d.config_missing) {
                const banner = document.createElement('div');
                banner.id = 'missing-config-banner';
                banner.style.cssText = "background: var(--intent-warning); color: #000; padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem;";
                banner.innerHTML = "⚠️ Configuration file missing. Operating in empty fallback state. <span style='cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;' onclick='this.parentElement.style.display=\"none\"'>Dismiss</span>";
                document.body.appendChild(banner);
            }
        }
    } catch(e) { console.error("Topology fetch failed:", e); }

    // 2. Auto-Hydrate Manifest
    try {
        let mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : {};
        if (Object.keys(manifestData).length === 0) {
            await executeSystemCompile();
            manifestData = AppStore.getState().manifest;
        }
        if (mRes.ok || manifestData) {
            AppStore.setState({ manifest: manifestData });
            const { activeTab } = AppStore.getState();
            if (activeTab) {
                window.inSetu.events.emitHook('zone:tab-changed', activeTab);
            }
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
window.inSetu.sys.simulatePanic = simulatePanic;
window.inSetu.sys.executeSystemCompile = executeSystemCompile;
window.inSetu.sys.executeWorkspaceMutation = executeWorkspaceMutation;
window.inSetu.sys.getFlattenedBuckets = getFlattenedBuckets;
window.inSetu.sys.loadWorkspaces = loadWorkspaces;
window.inSetu.sys.executeWorkspaceSwap = executeWorkspaceSwap;
window.inSetu.ui.setGlobalStatus = setGlobalStatus;

