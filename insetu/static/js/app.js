import {
    viewSourceFile,
    loadGlobalFS,
    createFileCard,
    downloadFile,
    currentModalOriginalText,
    buildFileTree
} from './fs.js';
import { BridgeStore } from './bridge.js';
import { AppStore } from './store.js';
import './ui.js';
import './components/ui_file_tree.js';
import './components/ui_folder_browser.js';
import './components/ui_modal.js';
import './components/ui_filter_pills.js';
import './gather.js';

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
export let mdeInstance = null;

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
        if (activeModal.id === 'file-modal' && window.closeFileModal) {
            window.closeFileModal();
            return;
        }
        // Trigger specific close/cancel buttons to ensure teardown logic fires natively
        const closeBtn = activeModal.querySelector(`button[style*="dc2626"], button[onclick*="display='none'"]`);
        if (closeBtn) closeBtn.click();
        else activeModal.style.display = 'none';
    }
});
// Global File Card Swipe/Hover/Click Actions Manager
let cardTouchStartX = 0;
let cardTouchStartY = 0;

document.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.file-card');
    if (card) {
        cardTouchStartX = e.changedTouches[0].screenX;
        cardTouchStartY = e.changedTouches[0].screenY;
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const card = e.target.closest('.file-card');
    if (card) {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = cardTouchStartX - touchEndX;
        const diffY = Math.abs(cardTouchStartY - touchEndY);

        // Swipe Left (Reveal Actions)
        if (diffX > 40 && diffY < 40) {
            document.querySelectorAll('.file-card.show-actions').forEach(c => c.classList.remove('show-actions'));
            card.classList.add('show-actions');
        } 
        // Swipe Right (Hide Actions)
        else if (diffX < -40 && diffY < 40) {
            card.classList.remove('show-actions');
        }
    }
}, { passive: true });

document.addEventListener('click', (e) => {
    const card = e.target.closest('.file-card');

    // 1. Click outside any card: dismiss all active menus
    if (!card) {
        document.querySelectorAll('.file-card.show-actions').forEach(c => c.classList.remove('show-actions'));
        return;
    }

    // 2. Click inside the actions area: let the button process normally
    if (e.target.closest('.file-actions') || e.target.closest('.cit-card-actions')) {
        return;
    }
    const rect = card.getBoundingClientRect();
    // 3. Click on right 25% edge: toggle actions, block card click
    const triggerZone = rect.width * 0.25;
    if (e.clientX > rect.right - triggerZone) {
        e.preventDefault();
        e.stopPropagation();
        const isShowing = card.classList.contains('show-actions');
        document.querySelectorAll('.file-card.show-actions').forEach(c => c.classList.remove('show-actions'));
        if (!isShowing) card.classList.add('show-actions');
        return;
    }

    // 4. Click elsewhere on the card (like the title): dismiss actions and let click pass through
    document.querySelectorAll('.file-card.show-actions').forEach(c => c.classList.remove('show-actions'));
}, { capture: true });

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
                await import(`/static/js/extensions/ext_${ext}.js`);
                console.log(`🔌 Loaded UI Extension: ${ext}`);
            } catch (e) {
                console.error(`⚠️ Failed to load UI extension: ${ext}`, e);
            }
        }
    }
}
// --- THE CENTRALIZED FRONTEND METRONOME ---
window.ExtensionRegistry.registerTick('core_refresh', 1000, updateRefreshText);

// Evaluate ticks every 100ms to allow sub-second, high-resolution polling for critical extensions
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
}, 100);
// --- STATELESS TENANT ROUTING (Fetch Interceptor) ---
const originalFetch = window.fetch;
window.fetch = async (resource, options = {}) => {
    // Only intercept local API requests; leave external URLs (Google/OpenAlex) alone
    const isLocal = typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin));
    if (isLocal) {
        const headers = new Headers(options.headers || {});
        // UDF Tab Isolation: Rely on in-memory store or tab-scoped sessionStorage first to prevent cross-tab bleeding
        const activeWs = window.inSetu?.stores?.App?.getState()?.activeWorkspace || sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
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
            const ws = window.inSetu?.stores?.App?.getState()?.activeWorkspace || sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
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
        const cRes = await fetch('/api/system/config?t=' + Date.now(), { cache: 'no-store' });
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
    const textArea = document.getElementById('modal-text');
    if (textArea && typeof EasyMDE !== 'undefined') {
        // Initialize the No-Nonsense Editor
        mdeInstance = new EasyMDE({
            element: textArea,
            toolbar: false,
            status: false,
            spellChecker: false,
            forceSync: true,
            inputStyle: 'textarea',
            nativeSpellcheck: false
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

        // Native Checkbox Toggling
        mdeInstance.codemirror.on("mousedown", (cm, e) => {
            if (cm.getOption("readOnly") && cm.getOption("readOnly") !== false) return;
            const pos = cm.coordsChar({left: e.clientX, top: e.clientY});
            const lineText = cm.getLine(pos.line);
            const match = lineText.match(/^(\s*[-*+]\s+\[)( |x|X)(\])/);

            if (match) {
                const startCh = match[1].length - 1; // Index of '['
                const endCh = match[1].length + 1;   // Index of ']'
                // If user clicks anywhere near the brackets
                if (pos.ch >= startCh && pos.ch <= endCh + 1) {
                    e.preventDefault();
                    const isChecked = match[2] !== ' ';
                    const newLine = match[1] + (isChecked ? ' ' : 'x') + match[3] + lineText.substring(match[0].length);
                    cm.replaceRange(newLine, {line: pos.line, ch: 0}, {line: pos.line, ch: lineText.length});
                }
            }
        });
}
    const ws = sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
    const savedTab = localStorage.getItem(`insetu_tab_${ws}`) || localStorage.getItem('insetu_tab') || 'context';

    const targetTabEl = document.querySelector(`.tab[data-id="${savedTab}"]`) || document.querySelector(`.tab[onclick*="${savedTab}"]`);
    const requiredExt = targetTabEl ? targetTabEl.dataset.ext : null;
    if (!requiredExt || (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes(requiredExt))) {
        switchTab(null, savedTab);
    } else {
        switchTab(null, 'context');
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
        // Prevent aggressive browser caching (e.g., Safari on tablets) from hiding new workspaces
        const res = await fetch('/api/system/workspaces?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.workspaces && Object.keys(data.workspaces).length > 0) {
            // Strictly prioritize tab-scoped state for multi-tenant concurrency
            let activeWs = sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace');
            if (!activeWs || !data.workspaces[activeWs]) {
                activeWs = data.active_workspace ||
                Object.keys(data.workspaces)[0] || 'default';
                sessionStorage.setItem('insetu_workspace', activeWs);
                localStorage.setItem('insetu_workspace', activeWs);
            }
            AppStore.setState({ activeWorkspace: activeWs });
            document.getElementById('workspaces-header').style.display = 'block';
            const list = document.getElementById('workspaces-list');
            list.style.display = 'flex';
            list.replaceChildren();
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
                    // THE FIX: Immediately bind the new workspace to tab-scoped storage and memory
                    // so the fetch interceptor attaches the correct header exclusively for this tab.
                    sessionStorage.setItem('insetu_workspace', key);
                    localStorage.setItem('insetu_workspace', key); // Only for newly opened tabs to inherit
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

    const targetContent = document.getElementById('tab-' + tabId);
    const isAlreadyActive = targetContent && targetContent.classList.contains('active');

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        const targetTab = document.querySelector(`.tab[onclick*="${tabId}"], .tab[data-id="${tabId}"]`);
        if (targetTab) targetTab.classList.add('active');
    }
    if (targetContent) targetContent.classList.add('active');
    localStorage.setItem('insetu_tab', tabId);
    if (isAlreadyActive && event !== null) {
        // User manually tapped an already active tab: trigger a lazy refresh
        const activeSub = targetContent.querySelector('.sub-tab.active');
        if (activeSub) {
            const subId = activeSub.id.replace('st-', '');
            switchSubTab(subId, true); // Pass forceRefresh flag
        } else {
            if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                window.ExtensionRegistry.executeUIHook('zone:force-refresh', tabId);
            }
            if (tabId === 'tasks' && window.loadTrackerBoard) window.loadTrackerBoard();
            if (tabId === 'library' && window.loadMainLibrary) window.loadMainLibrary();
        }
        return; // Break standard initialization to avoid double-firing
    }
    // Restore the last active sub-tab for this view statelessly
    const savedSub = localStorage.getItem('insetu_subtab_' + tabId);
    if (savedSub && document.getElementById('st-' + savedSub)) {
        switchSubTab(savedSub, false, true);
    } else if (targetContent) {
        const firstSub = targetContent.querySelector('.sub-tab');
        if (firstSub) switchSubTab(firstSub.id.replace('st-', ''), false, true);
    }

    if (tabId === 'context') {
        // Trigger LitElement update
        const gatherEl = document.querySelector('insetu-ext-gather');
        if (gatherEl && (!window.inSetu.stores.App.getState().manifest || Object.keys(window.inSetu.stores.App.getState().manifest).length === 0)) {
            gatherEl.loadContext();
        }
    }

    if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
        window.ExtensionRegistry.executeUIHook('zone:tab-changed', tabId);
    }
}
function switchSubTab(subId, forceRefresh = false, isProgrammatic = false) {
    const activeTabContent = document.querySelector('.tab-content.active');
    if (!activeTabContent) return;
    const targetSt = document.getElementById('st-' + subId);
    const isAlreadyActive = targetSt && targetSt.classList.contains('active');

    // Prevent programmatic tab hydration from violently triggering a full system compile
    const actualForceRefresh = forceRefresh || (isAlreadyActive && !forceRefresh && !isProgrammatic);

    activeTabContent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    activeTabContent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    const parentTabId = activeTabContent.id.replace('tab-', '');
    localStorage.setItem('insetu_subtab_' + parentTabId, subId);
    if (targetSt) targetSt.classList.add('active');
    const targetSub = document.getElementById('sub-' + subId);
    if (targetSub) targetSub.classList.add('active');

    // Declarative Layout Slot Management: Update visibility states for registered sub-navigation actions
    const actionsContainer = activeTabContent.querySelector('.sub-tabs-actions');
    if (actionsContainer) {
        Array.from(actionsContainer.children).forEach(act => {
            act.style.display = act.dataset.subId === subId ? '' : 'none';
        });
    }

    if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
        window.ExtensionRegistry.executeUIHook('zone:subtab-changed', { parentId: parentTabId, subId: subId, forceRefresh: actualForceRefresh });
    }
    if (subId === 'files') {
        loadGlobalFS();
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

export function generateSafeSlug(str) {
    if (!str) return '';
    return normalizeAccentText(str).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
    // Anti-spam constraint: Prevent stacking identical active toasts
    if (Array.from(container.children).some(t => t.innerText === msg || t.textContent === msg)) {
        return;
    }

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
let compilePromise = null;
let compilePromiseWs = null;

export const executeSystemCompile = (onProgress = null) => {
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    if (compilePromise && compilePromiseWs === activeWs) return compilePromise;

    compilePromiseWs = activeWs;
    compilePromise = (async () => {
        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let result = null;
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop(); 
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);
                    if (data.status === 'progress') {
                        setGlobalStatus(`⏳ ${data.message}`, null);
                        if (onProgress) onProgress(data.message);
                    } else {
                        result = data;
                    }
                }
            }

            // OS-Level Hydration: Automatically update global manifest on success
            if (result && result.status !== 'error') {
                const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
                if (mRes.ok) AppStore.setState({ manifest: await mRes.json() });
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
};
window.executeSystemCompile = executeSystemCompile;
window.compileContexts = executeSystemCompile; // Legacy bridge alias

export const setContextManifest = (m) => { AppStore.setState({ manifest: m }); };
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
        const cRes = await fetch('/api/system/config?t=' + Date.now(), { cache: 'no-store' });
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
            document.querySelectorAll('.tab[data-ext], .sub-tab[data-ext]').forEach(tabEl => {
                const extName = tabEl.dataset.ext;
                const tabId = tabEl.dataset.id || tabEl.id.replace('st-', '');
                const isActive = ['bridge', 'gather'].includes(extName) || window.ACTIVE_EXTENSIONS.includes(extName);

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
        await executeSystemCompile();
        const currentWsSafe = AppStore.getState().activeWorkspace || 'default';

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
        let fetchUrl = `/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filePath);

        if (window.inSetu?.extensions?.Registry?.executeUIHook) {
            const override = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', filePath);
            if (override) fetchUrl = override;
        }

        const res = await fetch(fetchUrl);
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
        let fetchUrl = `/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filePath);

        if (window.inSetu?.extensions?.Registry?.executeUIHook) {
            const override = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', filePath);
            if (override) fetchUrl = override;
        }

        await downloadFile(fetchUrl, filePath.split('/').pop());
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
        const activeWs = AppStore.getState().activeWorkspace || 'default';

        // Lazy Hydration: Attempt to fetch existing manifest first to prevent N+1 compiler thrashing
        let mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
        let manifestData = mRes.ok ? await mRes.json() : {};
        // Only compile context if the manifest is genuinely empty (e.g., first daemon boot)
        if (Object.keys(manifestData).length === 0) {
            await executeSystemCompile();
            manifestData = AppStore.getState().manifest;
        }

        if (mRes.ok) {
            setContextManifest(manifestData);

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
window.generateSafeSlug = generateSafeSlug;
window.switchTab = switchTab;
window.switchSubTab = switchSubTab;
window.fullRefresh = fullRefresh;
window.simulatePanic = simulatePanic;
window.resolveEditorMode = resolveEditorMode;
