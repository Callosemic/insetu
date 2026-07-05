import {
    viewSourceFile,
    loadGlobalFS,
    createFileCard,
    downloadFile,
    currentModalOriginalText,
    buildFileTree
} from './fs.js';
import { BridgeStore } from './bridge.js';
import './ui.js';

function getFlattenedBuckets(repoDir, includeSystem = false) {
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
export {
    viewSourceFile,
    createFileCard,
    getFlattenedBuckets,
    buildFileTree
};

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

    // Pull from the centralized Virtual File System Bridge Store
    const bridgeState = BridgeStore.getState();
    if (bridgeState && bridgeState.payloadText && bridgeState.payloadText.trim() !== '') {
        isDirty = true;
    }

    // Verify modal original content states safely
    if (typeof currentModalOriginalText !== 'undefined' && document.getElementById('modal-text')) {
        if (document.getElementById('modal-text').value !== currentModalOriginalText) isDirty = true;
    }

    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export let mdeInstance = null;
// --- EXTENSION REGISTRY ---
window.inSetu.extensions.Registry = {
    uiHooks: {},
    shortcuts: {},
    utils: {
        _timers: {},
        debounce: function(key, callback, delay = 300) {
            clearTimeout(this._timers[key]);
            this._timers[key] = setTimeout(callback, delay);
        },
        debounceVerifyFile: function(workspaceId, filepath, callback, delay = 300) {
            this.debounce(`verify_${filepath}`, async () => {
                try {
                    const res = await fetch(`/api/${workspaceId}/fs/exists?file=` + encodeURIComponent(filepath));
                    if (res.ok) {
                        const data = await res.json();
                        callback(data.exists, filepath);
                    }
                } catch(e) {
                    console.warn("Silent verify failed", e);
                }
            }, delay);
        }
    },
    registerShortcut: function(context, keyCombo, callback) {
        if (!this.shortcuts[context]) this.shortcuts[context] = {};
        this.shortcuts[context][keyCombo.toLowerCase()] = callback;
    },
    registerUIHook: function(zone, callback) {
        if (!this.uiHooks[zone]) this.uiHooks[zone] = [];
        this.uiHooks[zone].push(callback);
    },
    executeUIHook: function(zone, data) {
        if (this.uiHooks[zone]) {
            for (let cb of this.uiHooks[zone]) {
                const res = cb(data);
                if (res) return res;
            }
        }
        return null;
    },
    registerSettingsAction: (id, label, icon, callback) => {
        const container = document.getElementById('settings-modal-links');
        if (!container) return;
        const btn = document.createElement('button');
        btn.className = 'btn-sm';
        btn.style.cssText = 'background: var(--input-bg); color: var(--text); border: 1px solid var(--border); text-align: left; padding: 10px 15px; font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 10px; font-weight: bold; transition: background 0.2s;';
        btn.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span> <span>${label}</span>`;
        btn.onmouseover = () => btn.style.background = 'var(--bg)';
        btn.onmouseout = () => btn.style.background = 'var(--input-bg)';
        btn.onclick = () => {
            document.getElementById('settings-modal').style.display = 'none';
            callback();
        };
        container.appendChild(btn);
    },
    registerTab: (id, label, extName = null) => {
        const container = document.getElementById('main-tabs-container');
        if (!container) return null;

        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.id = id;
        if (extName) tab.dataset.ext = extName;
        tab.onclick = (e) => switchTab(e, id);
        tab.innerText = label;
        container.appendChild(tab);

        // Dynamically reorder the DOM nodes to respect visual preferences over DAG boot order
        const { tabOrder } = AppStore.getState();
        if (tabOrder && tabOrder.length > 0) {
            const tabs = Array.from(container.children);
            tabs.sort((a, b) => {
                // Safely extract the ID even for hardcoded index.html tabs via their onclick attribute
                const idA = a.dataset.id || (a.getAttribute('onclick') || '').match(/'([^']+)'/)?.[1] || '';
                const idB = b.dataset.id || (b.getAttribute('onclick') || '').match(/'([^']+)'/)?.[1] || '';

                let iA = tabOrder.indexOf(idA);
                let iB = tabOrder.indexOf(idB);
                if (iA === -1) iA = 999;
                if (iB === -1) iB = 999;
                return iA - iB;
            });
            tabs.forEach(t => container.appendChild(t));
        }
        const content = document.createElement('div');
        content.id = 'tab-' + id;
        content.className = 'tab-content';
        content.innerHTML = `<div class="screen active" id="screen-${id}"></div>`;
        document.body.insertBefore(content, document.getElementById('file-modal'));
        return content.querySelector('.screen');
    },
    registerSubTab: (parentId, id, label) => {
        const parentTab = document.getElementById('tab-' + parentId);
        if (!parentTab) return null;

        const subTabContainer = parentTab.querySelector('.sub-tabs');
        if (subTabContainer) {
            const st = document.createElement('div');
            st.className = 'sub-tab';
            st.id = 'st-' + id;
            st.onclick = () => switchSubTab(id);
            st.innerText = label;
            subTabContainer.appendChild(st);
        }

        const screen = parentTab.querySelector('.screen');
        if (!screen) return null;
        const subContent = document.createElement('div');
        subContent.id = 'sub-' + id;
        subContent.className = 'sub-tab-content';
        screen.appendChild(subContent);
        return subContent;
    }
};
window.ExtensionRegistry = window.inSetu.extensions.Registry; // Legacy alias

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
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        contexts.unshift('tab:' + activeTab.id.replace('tab-', ''));
        const activeSub = activeTab.querySelector('.sub-tab-content.active');
        if (activeSub) contexts.unshift('subtab:' + activeSub.id.replace('sub-', ''));
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
// Auto-resize generic textareas (prompts, descriptions) as the user types
document.addEventListener('input', (e) => {
    if (e.target.tagName.toLowerCase() === 'textarea' && e.target.id !== 'payload' && !e.target.closest('.EasyMDEContainer')) {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight + 2, 500) + 'px';
    }
});
// Map Cmd/Ctrl + S contextually depending on which modal is currently visible
window.ExtensionRegistry.registerShortcut('modal:file-modal', 'ctrl+s', () => window.saveModalFile && window.saveModalFile(false));
window.ExtensionRegistry.registerShortcut('modal:new-file-modal', 'ctrl+s', () => window.saveNewFile && window.saveNewFile());
window.ExtensionRegistry.registerShortcut('modal:new-task-modal', 'ctrl+s', () => window.saveNewTask && window.saveNewTask());
window.ExtensionRegistry.registerShortcut('modal:edit-task-modal', 'ctrl+s', () => window.saveEditTask && window.saveEditTask());
window.ExtensionRegistry.registerShortcut('modal:config-editor-modal', 'ctrl+s', () => document.getElementById('config-editor-save')?.click());
async function bootExtensions() {
    if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.length > 0) {
        for (const ext of window.ACTIVE_EXTENSIONS) {
            try {
                // Dynamically load the module native to the browser
                await import(`/static/js/ext_${ext}.js`);
                console.log(`🔌 Loaded UI Extension: ${ext}`);
            } catch (e) {
                console.error(`⚠️ Failed to load UI extension: ${ext}`, e);
            }
        }
    }
}
// --- EXTENSION LIFECYCLE REGISTRY & TEARDOWN ENGINE ---
if (!window.ExtensionRegistry) window.ExtensionRegistry = {};
window.ExtensionRegistry._unloadHooks = new Map();
window.ExtensionRegistry._ticks = new Map();

window.ExtensionRegistry.registerUnloadHook = function(extName, callback) {
    this._unloadHooks.set(extName, callback);
};

window.ExtensionRegistry.registerTick = function(extName, intervalMs, callback) {
    if (!this._ticks.has(extName)) this._ticks.set(extName, []);
    this._ticks.get(extName).push({ interval: intervalMs, lastRun: Date.now(), cb: callback });
};

window.ExtensionRegistry.executeUnload = function(extName) {
    // 1. Execute custom teardown logic
    if (this._unloadHooks.has(extName)) {
        try {
            this._unloadHooks.get(extName)();
        } catch (e) {
            console.error(`Error unloading extension [${extName}]:`, e);
        }
        this._unloadHooks.delete(extName);
    }

    // 2. Instantly garbage collect all polling loops for this extension
    if (this._ticks.has(extName)) {
        this._ticks.delete(extName);
    }
};
// --- THE CENTRALIZED FRONTEND METRONOME ---
window.ExtensionRegistry.registerTick('core_refresh', 1000, updateRefreshText);

setInterval(() => {
    const now = Date.now();
    window.ExtensionRegistry._ticks.forEach((tasks, extName) => {
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
}, 1000);

// --- STATELESS TENANT ROUTING (Fetch Interceptor) ---
const originalFetch = window.fetch;
window.fetch = async (resource, options = {}) => {
    // Only intercept local API requests; leave external URLs (Google/OpenAlex) alone
    const isLocal = typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin));
    if (isLocal) {
        const headers = new Headers(options.headers || {});
        const activeWs = localStorage.getItem('insetu_workspace') || 'default';
        if (!headers.has('X-Workspace-ID')) headers.append('X-Workspace-ID', activeWs);
        options.headers = headers;
    }
    return originalFetch(resource, options);
};
// Global listener to track active tab routing per-tenant
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) {
        let tabId = tab.dataset.id;
        if (!tabId && tab.getAttribute('onclick')) {
            const match = tab.getAttribute('onclick').match(/'([^']+)'/);
            if (match) tabId = match[1];
        }
        if (tabId) {
            const ws = localStorage.getItem('insetu_workspace') || 'default';
            localStorage.setItem(`insetu_tab_${ws}`, tabId);
        }
    }
});
// Restore UI State on Load
window.addEventListener('DOMContentLoaded', async () => {
    // The JS engine successfully booted. Hide the pure-HTML panic switch.
    clearTimeout(window.panicTimeout);
    const panicBtn = document.getElementById('js-panic-button');
    if (panicBtn) panicBtn.style.display = 'none';

    // Fetch tenant-specific configuration to override the server's stateless HTML injection
    try {
        const cRes = await fetch('/api/system/config');
        if (cRes.ok) {
            const config = await cRes.json();
            window.ACTIVE_EXTENSIONS = config.extensions || [];

            // Synchronize branding tokens while we have the config
            const toggleBtn = document.getElementById('settings-toggle');
            if (toggleBtn) toggleBtn.innerText = config.instance_emoji || "⚙️";
            const statusBar = document.getElementById('global-status-bar');
            if (statusBar) statusBar.setAttribute('data-default', config.instance_title || "inSetu Developer OS");
        }
    } catch (e) {
        console.warn("Failed to fetch tenant configuration on boot.", e);
    }

    await bootExtensions();

    setTimeout(() => {
        const ws = localStorage.getItem('insetu_workspace') || 'default';
        const savedTab = localStorage.getItem(`insetu_tab_${ws}`);
        if (savedTab && typeof switchTab === 'function') {
            const targetTabEl = document.querySelector(`.tab[data-id="${savedTab}"]`);
            const requiredExt = targetTabEl ? targetTabEl.dataset.ext : null;
            if (!requiredExt || (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes(requiredExt))) {
                switchTab(null, savedTab);
            }
        }
    }, 50);

    const textArea = document.getElementById('modal-text');
    if (textArea && typeof EasyMDE !== 'undefined') {
        // Initialize the No-Nonsense Editor
        mdeInstance = new EasyMDE({
            element: textArea,
            toolbar: false,
            status: false,
            spellChecker: false,
            forceSync: true
        });

        // Bridge global CodeMirror modes (Python, JS, etc.) into EasyMDE's internal engine
        if (window.CodeMirror && window.CodeMirror.modes) {
            Object.assign(mdeInstance.codemirror.constructor.modes, window.CodeMirror.modes);
            Object.assign(mdeInstance.codemirror.constructor.mimeModes, window.CodeMirror.mimeModes);
        }

        // Proxy changes back to the native textarea so legacy logic survives
        mdeInstance.codemirror.on("change", () => {
            textArea.value = mdeInstance.value();
            textArea.dispatchEvent(new Event('input'));
        });
    }
    const savedTab = localStorage.getItem('insetu_tab');
    if (savedTab) {
        switchTab(null, savedTab);
        const savedSub = localStorage.getItem('insetu_subtab_' + savedTab);
        if (savedSub) switchSubTab(savedSub);
    }
});

const currentTheme = localStorage.getItem('insetu_theme') || 'dark';
document.body.setAttribute('data-theme', currentTheme);

const settingsToggle = document.getElementById('settings-toggle');
const settingsMenu = document.getElementById('settings-menu');

if (settingsToggle && settingsMenu) {
    settingsToggle.onclick = (e) => {
        e.stopPropagation();
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
    };

    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsToggle) {
            settingsMenu.style.display = 'none';
        }
    });
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = () => {
            const newTheme = btn.getAttribute('data-theme-value');
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('insetu_theme', newTheme);
            settingsMenu.style.display = 'none';
            updateThemeSelectionUI(newTheme);
        };
    });
}
async function loadWorkspaces() {
    try {
        const res = await fetch('/api/system/workspaces');
        if (!res.ok) return;
        const data = await res.json();
        if (data.workspaces && Object.keys(data.workspaces).length > 0) {
            // Strictly prioritize the browser's local state for multi-tenant concurrency
            let activeWs = localStorage.getItem('insetu_workspace');
            if (!activeWs || !data.workspaces[activeWs]) {
                activeWs = data.active_workspace || Object.keys(data.workspaces)[0] || 'default';
                localStorage.setItem('insetu_workspace', activeWs);
            }
            AppStore.setState({ activeWorkspace: activeWs });
            document.getElementById('workspaces-header').style.display = 'block';
            const list = document.getElementById('workspaces-list');
            list.style.display = 'flex';
            list.innerHTML = '';

            Object.entries(data.workspaces).forEach(([key, ws]) => {
                const btn = document.createElement('button');
                const isActive = activeWs === key; // Check against frontend local state
                btn.innerText = (isActive ? '🟢 ' : '⚪ ') + (ws.title || key);
                btn.style.cssText = `margin: 0; background: ${isActive ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${isActive ? 'var(--border)' : 'transparent'}; cursor: pointer; border-radius: 4px; font-weight: ${isActive ? 'bold' : 'normal'};`;
                btn.onclick = async () => {
                    btn.innerText = isActive ? '⏳ Refreshing...' : '⏳ Switching...';

                    // Clear aggressive Service Worker caches to prevent ghost states
                    if ('caches' in window) {
                        try {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(k => caches.delete(k)));
                        } catch(e) {}
                    }
                    await fetch('/api/system/workspaces', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ active_workspace: key })
                    });
                    // THE FIX: Immediately bind the new workspace to local storage 
                    // so the fetch interceptor attaches the correct header.
                    localStorage.setItem('insetu_workspace', key);
                    AppStore.setState({ activeWorkspace: key });

                    // The Stateless Soft-Swap
                    setGlobalStatus(`Switched to ${ws.title || key}. Hydrating UI...`, null);
                    await performSoftRefresh();

                    loadWorkspaces(); // Re-render the active green dot on the menu buttons
                    document.getElementById('settings-menu').style.display = 'none';
                };
                list.appendChild(btn);
            });
        }
    } catch(e) {
        console.error("Failed to load workspaces:", e);
    }
}
loadWorkspaces();

function updateThemeSelectionUI(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.getAttribute('data-theme-value') === theme) {
            btn.style.fontWeight = 'bold';
            btn.style.border = '1px solid var(--border)';
            btn.style.borderRadius = '4px';
            btn.style.background = 'var(--input-bg)';
        } else {
            btn.style.fontWeight = 'normal';
            btn.style.border = '1px solid transparent';
            btn.style.background = 'transparent';
        }
    });
}
updateThemeSelectionUI(currentTheme);
function switchTab(event, tabId) {
    if (typeof event === 'string') {
        tabId = event;
        event = null;
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        const targetTab = document.querySelector(`.tab[onclick*="${tabId}"], .tab[data-id="${tabId}"]`);
        if (targetTab) targetTab.classList.add('active');
    }
    const targetContent = document.getElementById('tab-' + tabId);
    if (targetContent) targetContent.classList.add('active');
    localStorage.setItem('insetu_tab', tabId);
    if (tabId === 'context') {
        loadContext();
        const activeSub = document.querySelector('#tab-context .sub-tab.active');
        if (activeSub && activeSub.id !== 'st-bundles') switchSubTab(activeSub.id.replace('st-', ''));
    }
    if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
        window.ExtensionRegistry.executeUIHook('zone:tab-changed', tabId);
    }
    if (tabId === 'edit') {
        const activeSub = document.querySelector('#tab-edit .sub-tab.active');
        if (activeSub) switchSubTab(activeSub.id.replace('st-', ''));
        const stFiles = document.getElementById('st-files');
        if (stFiles && stFiles.classList.contains('active')) loadGlobalFS();
    }
}

function switchSubTab(subId) {
    // Scope sub-tab switching to the active parent tab to prevent clearing all sub-tabs globally
    const activeTabContent = document.querySelector('.tab-content.active');
    if (!activeTabContent) return;

    activeTabContent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    activeTabContent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    const parentTabId = activeTabContent.id.replace('tab-', '');
    localStorage.setItem('insetu_subtab_' + parentTabId, subId);

    if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
        window.ExtensionRegistry.executeUIHook('zone:subtab-changed', { parentId: parentTabId, subId: subId });
    }

    const targetSt = document.getElementById('st-' + subId);
    const targetSub = document.getElementById('sub-' + subId);
    if (targetSt) targetSt.classList.add('active');
    if (targetSub) targetSub.classList.add('active');

    if (subId === 'files') loadGlobalFS();
    const pasteBtn = document.getElementById('btn-paste');
    const newFileBtn = document.getElementById('btn-new-file');
    const newFolderBtn = document.getElementById('btn-new-folder');

    // Bridge UI Hardening: Guarantee Paste button visibility using computed styles
    const consoleArea = document.getElementById('bridge-console-area');
    const isConsoleActive = consoleArea && window.getComputedStyle(consoleArea).display !== 'none';
    if (pasteBtn) {
        pasteBtn.style.display = (subId === 'bridge' && !isConsoleActive) ?
'block' : 'none';
    }
    const gbPath = AppStore.getState().globalBrowsePath || [];
    if (newFileBtn) newFileBtn.style.display = (subId === 'files' && gbPath.length > 0) ?
'block' : 'none';
    const fsMoreBtn = document.getElementById('btn-fs-more');
    if (fsMoreBtn) fsMoreBtn.style.display = (subId === 'files' && gbPath.length > 0) ?
'block' : 'none';
    if (newFolderBtn) newFolderBtn.style.display = (subId === 'files') ? 'block' : 'none';
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
export function resolveEditorMode(filename) {
    if (!filename) return { ext: '', mode: null, isSupported: false, isMarkdown: false };
    const ext = filename.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown', 'py': 'python', 'js': 'javascript',
        'json': 'javascript', 'sh': 'shell', 'ts': 'javascript',
        'rs': 'rust', 'go': 'go'
    };
    return { ext, mode: modeMap[ext], isSupported: !!modeMap[ext], isMarkdown: ext === 'md' };
}

export function normalizeAccentText(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function setGlobalStatus(msg, timeout = 3000, isError = false) {
    const bar = document.getElementById('global-status-bar');
    if (!bar) return;
    bar.innerText = msg;
    bar.style.color = isError ? 'var(--intent-danger)' : 'var(--text)';
    if (timeout) {
        setTimeout(() => {
            if (bar.innerText === msg) {
                bar.innerText = bar.getAttribute('data-default');
                bar.style.color = 'var(--text)';
            }
        }, timeout);
    }
}
window.setGlobalStatus = setGlobalStatus;

// --- NON-BLOCKING TOAST NOTIFICATIONS ---
// Hijack native alerts to prevent thread blocking while preserving stack traces
window.alert = function(msg) {
    const container = document.getElementById('toast-container') || (function() {
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.style.cssText = 'position: fixed; bottom: 40px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(c);
        return c;
    })();

    const toast = document.createElement('div');
    toast.style.cssText = 'background: var(--input-bg); color: var(--text); border-left: 4px solid var(--intent-danger); padding: 12px 15px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); font-family: var(--font-mono); font-size: 0.85rem; max-width: 400px; white-space: pre-wrap; word-break: break-word; pointer-events: auto; transition: opacity 0.3s; cursor: pointer;';
    toast.innerText = msg;
    toast.title = "Click to dismiss";

    toast.onclick = () => toast.remove();
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 6000);
};

export async function executeWorkspaceMutation(url, payload, options = {}) {
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
        setGlobalStatus(loadingText, null);
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
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
            setGlobalStatus(`❌ Error: ${e.message}`, 5000);
        }
        return false;
    } finally {
        if (btn && !silent) {
            btn.innerText = origText;
            setGlobalStatus("✅ Success!", 2000);
        }
    }
}

export function renderContextFiles(files, msg) {
    document.getElementById('result-message').style.display = 'none';
    const downloadContainer = document.getElementById('context-download-links');
    downloadContainer.innerHTML = '';
    if (files && files.length > 0) {
        const categories = {};
        const { categoryOrder, targetConfigs } = AppStore.getState();
        files.forEach(file => {
            if (typeof HIDDEN_OUTPUTS !== 'undefined' && HIDDEN_OUTPUTS.includes(file)) return;

            const manifestObj = AppStore.getState().manifest[file] || {};
            const meta = manifestObj.meta || { title: file, domain: "Workspaces", desc: "Context payload." };

            // Allow extensions to override/claim UI metadata dynamically (e.g., ext_prompts.js)
            let finalCat = meta.domain;
            let finalDesc = meta.desc;
            let finalTitle = meta.title;
            if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                const extMeta = window.ExtensionRegistry.executeUIHook('zone:context-metadata', file);
                if (extMeta) {
                    finalCat = extMeta.cat;
                    finalDesc = extMeta.desc;
                    finalTitle = extMeta.displayName;
                }
            }

            if (!categories[finalCat]) categories[finalCat] = [];
            categories[finalCat].push({
                filename: file,
                displayName: finalTitle,
                description: finalDesc,
                isFS: false
            });
        });
        const sortedCats = Object.keys(categories).sort((a, b) => {
            let iA = categoryOrder.indexOf(a);
            let iB = categoryOrder.indexOf(b);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });
        for (const catName of sortedCats) {
            const catFiles = categories[catName];
            if (catFiles.length > 0) {
                const heading = document.createElement('div');
                heading.className = 'category-heading';

                if (catName === "Quick-Pack Clipboard") {
                    heading.style.display = 'flex';
                    heading.style.justifyContent = 'space-between';
                    heading.style.alignItems = 'center';
                    heading.innerHTML = `<span>${catName}</span> <button class="btn-sm" style="background: var(--intent-danger); margin: 0; padding: 4px 10px; font-size: 0.8rem;" onclick="if(window.clearQuickPacks) window.clearQuickPacks()">🗑️ Clear</button>`;
                } else {
                    heading.innerText = catName;
                }

                downloadContainer.appendChild(heading);
                catFiles.forEach(f => createFileCard(f, downloadContainer));
            }
        }
    }
}
export function setContextManifest(m) {
    AppStore.setState({ manifest: m });
}
export function filterContexts(query) {
    window.inSetu.extensions.Registry.utils.debounce('contextSearch', () => {
        const q = query.toLowerCase().trim();
        const container = document.getElementById('context-download-links');
        const categories = container.querySelectorAll('.category-heading');
        categories.forEach(cat => {
            let hasVisible = false;
            let nextEl = cat.nextElementSibling;
            while (nextEl && nextEl.classList.contains('file-card')) {
                const title = nextEl.querySelector('.file-title').innerText.toLowerCase();
                if (title.includes(q)) {
                    nextEl.style.display = 'block';
                    hasVisible = true;
                } else {
                    nextEl.style.display = 'none';
                }
                nextEl = nextEl.nextElementSibling;
            }
            cat.style.display = hasVisible ? 'block' : 'none';
        });
    }, 200);
}
async function finishContextLoad(result) {
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
        if (mRes.ok) setContextManifest(await mRes.json());
    } catch (e) {
        console.error("Manifest error", e);
    }
    renderContextFiles(result.files, result.message);
    lastRefreshed = new Date();
    updateRefreshText();

    document.getElementById('context-loading').style.display = 'none';
    document.getElementById('context-results').style.display = 'block';
}
let compilePromise = null;
let compilePromiseWs = null;
export function compileContexts() {
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    if (compilePromise && compilePromiseWs === activeWs) return compilePromise;
    compilePromiseWs = activeWs;

    compilePromise = (async () => {
        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                // Cached response returned immediately due to the compilation lock
                return await response.json();
            }

            // Stream processing for NDJSON
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let result = null;
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the incomplete chunk for the next iteration

                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);

                    if (data.status === 'progress') {
                        setGlobalStatus(`⏳ ${data.message}`, null);
                        const loadingEl = document.getElementById('context-loading');
                        if (loadingEl && window.getComputedStyle(loadingEl).display !== 'none') {
                            loadingEl.innerText = data.message;
                        }
                    } else {
                        result = data;
                    }
                }
            }
            setGlobalStatus("✅ Sync Complete", 2000);
            return result;
        } catch (error) {
            throw error;
        } finally {
            compilePromise = null;
        }
    })();

    return compilePromise;
}

async function loadContext() {
    document.getElementById('context-loading').style.display = 'block';
    document.getElementById('context-results').style.display = 'none';
    try {
        const result = await compileContexts();
        if (result.status === 'error') {
            document.getElementById('result-message').innerText = "❌ " + result.message;
            document.getElementById('result-message').style.color = "red";
            document.getElementById('result-message').style.display = 'block';
            document.getElementById('context-loading').style.display = 'none';
            document.getElementById('context-results').style.display = 'block';
        } else {
            finishContextLoad(result);
        }
    } catch (error) {
        document.getElementById('result-message').innerText = "❌ Network or syntax error compiling files.";
        document.getElementById('result-message').style.color = "red";
        document.getElementById('result-message').style.display = 'block';
        document.getElementById('context-loading').style.display = 'none';
        document.getElementById('context-results').style.display = 'block';
    }
}
async function simulatePanic() {
    if (!confirm("This will intentionally crash the server to test the Immutable Recovery Bootloader. The page will reload in 3 seconds. Continue?")) return;
    const btn = document.getElementById('simulate-panic-btn');
    if (btn) btn.innerText = "⏳ Crashing...";
    try {
        await fetch('/api/system/panic', { method: 'POST' });
        setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
        alert("Error triggering panic.");
    }
}
async function performSoftRefresh() {
    const currentWs = AppStore.getState().activeWorkspace || 'default';

    // Dynamically iterate over all mounted global stores to trigger resets
    Object.values(window.inSetu.stores).forEach(store => {
        if (store.getState().clearPayload) store.getState().clearPayload();
        if (store.getState().resetState) store.getState().resetState();
    });

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        window.inSetu.extensions.Registry.executeUIHook('zone:soft-refresh', currentWs);
    }

    try {
        // 1. Update routing topology for the new tenant
        const rRes = await fetch(`/api/${currentWs}/repos?t=` + Date.now());
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
        }
        // 2. JIT Mount any missing JS extension payloads
        const cRes = await fetch('/api/system/config');
        if (cRes.ok) {
            const config = await cRes.json();
            window.ACTIVE_EXTENSIONS = config.extensions || [];
            await bootExtensions(); // ES6 naturally caches imports, preventing duplicate execution

            // Dynamically synchronize workspace branding tokens to prevent ghost state layouts
            const toggleBtn = document.getElementById('settings-toggle');
            if (toggleBtn) {
                toggleBtn.innerText = config.instance_emoji || "⚙️";
            }
            const statusBar = document.getElementById('global-status-bar');
            if (statusBar) {
                statusBar.setAttribute('data-default', config.instance_title || "inSetu Developer OS");
            }
            // Hide extension tabs that are disabled in the new workspace & execute unloads
            document.querySelectorAll('.tab[data-ext]').forEach(tabEl => {
                const extName = tabEl.dataset.ext;
                const tabId = tabEl.dataset.id;
                const isActive = window.ACTIVE_EXTENSIONS.includes(extName);

                tabEl.style.display = isActive ? '' : 'none';

                const subTabEl = document.getElementById(`st-${tabId}`);
                if (subTabEl) subTabEl.style.display = isActive ? '' : 'none';

                // If the extension is active in the environment we are leaving but disabled in the new one, evict it!
                if (!isActive && window.ExtensionRegistry.executeUnload) {
                    window.ExtensionRegistry.executeUnload(extName);
                }
            });
        }

        // 3. Compile context & physical file trees for the new tenant
        await compileContexts();
        const currentWsSafe = AppStore.getState().activeWorkspace || 'default';
        const mRes = await fetch(`/api/${currentWsSafe}/manifest?t=` + Date.now());
        if (mRes.ok) setContextManifest(await mRes.json());

        // 4. Hydrate active DOM views using native routing
let targetTab = localStorage.getItem(`insetu_tab_${currentWsSafe}`) || 'context';
const targetTabEl = document.querySelector(`.tab[data-id="${targetTab}"]`);
const requiredExt = targetTabEl ? targetTabEl.dataset.ext : null;

if (requiredExt && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(requiredExt)) {
    targetTab = 'context';
}

if (typeof switchTab === 'function') switchTab(null, targetTab);

        setGlobalStatus("✅ Workspace Hydrated", 2000);
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
        if (btn) btn.innerText = "🔄 Full Refresh";
    }
}
/* ==========================================================================
   BRIDGE LOGIC (Extracted to bridge.js)
   ========================================================================== */
import { AppStore } from './store.js';
let HIDDEN_OUTPUTS = [];

const initialWs = AppStore.getState().activeWorkspace || 'default';
fetch(`/api/${initialWs}/repos`).then(r => r.json()).then(d => {
HIDDEN_OUTPUTS = d.hidden_outputs || [];
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
    banner.style.cssText = "background: var(--intent-warning); color: #000; padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem;";
    banner.innerHTML = "⚠️ Configuration file missing. Operating in empty fallback state. <span style='cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;' onclick='this.parentElement.style.display=\"none\"'>Dismiss</span>";
    document.body.appendChild(banner);
}
});

export async function fetchAndCopy(filePath, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "Fetching...";
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filePath));
        if (!res.ok) throw new Error("File not found on disk.");
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        btnElement.innerText = "✅ Copied!";
    } catch (e) {
        btnElement.innerText = "❌ Error: " + e.message;
    }
    setTimeout(() => {
        btnElement.innerText = originalText;
    }, 3000);
}
export async function fetchAndDownloadState(filePath, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "Fetching...";
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        await downloadFile(`/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filePath), filePath.split('/').pop());
        btnElement.innerText = "✅ Downloaded!";
    } catch (e) {
        btnElement.innerText = "❌ Error: " + e.message;
    }
    setTimeout(() => {
        btnElement.innerText = originalText;
    }, 3000);
}
/* ==========================================================================
    TRACKER LOGIC (Extracted to kanban.js)
    ========================================================================== */

/* ==========================================================================
    AUTO-HYDRATION (RUNS ON PAGE LOAD)
    ========================================================================== */
(async function hydrateEcosystem() {
    try {
        // Silently compile context to ensure the file tree and tracker are fresh
        await compileContexts();
        // Fetch the newly compiled manifest
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
        if (mRes.ok) {
            setContextManifest(await mRes.json());
            // If the user happens to load directly into a tab that needs the manifest, render it
            const tabEdit = document.getElementById('tab-edit');
            const stFiles = document.getElementById('st-files');
            if (tabEdit && tabEdit.classList.contains('active') && stFiles && stFiles.classList.contains('active')) {
                loadGlobalFS();
            }
            // Emit a global hydrate event so extensions can refresh their states
            if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab) {
                    const tabId = activeTab.id.replace('tab-', '');
                    window.ExtensionRegistry.executeUIHook('zone:tab-changed', tabId);
                }
            }
        }
    } catch (e) {
        console.error("Auto-hydration failed:", e);
    }
})();

/* ==========================================================================
            ES6 MODULE PREPARATION (WINDOW BRIDGE)
            Explicitly binding UI-triggered functions to the global scope so they 
            survive the transition to <script type="module">
            ========================================================================== */
window.normalizeAccentText = normalizeAccentText;
window.switchTab = switchTab;
window.switchSubTab = switchSubTab;
window.fullRefresh = fullRefresh;
window.simulatePanic = simulatePanic;
window.resolveEditorMode = resolveEditorMode;
// Context / Gather
window.filterContexts = filterContexts;
window.loadContext = loadContext;
