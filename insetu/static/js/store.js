// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.getActiveWorkspace = function() {
    try {
        if (window.inSetu?.stores?.App) return window.inSetu.stores.App.getState().activeWorkspace || 'default';
        return sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
    } catch(e) { return 'default'; }
};

export const AppStore = createStore(
    devtools(
        subscribeWithSelector((set, get) => ({
            activeWorkspace: window.inSetu.utils.getActiveWorkspace(),
            manifest: {},
            allRepos: [],
            targetConfigs: [],
            virtualContexts: [],
            categoryOrder: [],
            tabOrder: [],
            hiddenOutputs: [],
            isConfigOpen: false,
            isWorkspaceEditorOpen: false,

            pinnedRepos: new Set(JSON.parse(localStorage.getItem(`insetu_pinned_repos_${window.inSetu.utils.getActiveWorkspace()}`)) || ["ALL"]),
            setPinnedRepos: (repos) => {
                const ws = get().activeWorkspace || 'default';
                localStorage.setItem(`insetu_pinned_repos_${ws}`, JSON.stringify(Array.from(repos)));
                set({ pinnedRepos: repos });
            },
            gatherOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: "", profileDir: "" },

            globalBrowsePath: [],
            currentBrowsePath: [],
            browserConfig: { mode: 'view', callback: null },
            currentPushRepo: '',
            currentPushDiffFile: '',
            currentFormatTarget: '',
            currentPromptsPath: [],
            activeFormatJobId: null,
            activeSweepJobId: null,
            activePushJobId: null,
            activeDiffJobId: null,
            dirtyDiffRepos: new Set(["ALL"]),
            cachedDiffFiles: null,

            resetState: () => set({
                globalBrowsePath: [],
                currentBrowsePath: [],
                browserConfig: { mode: 'view', callback: null },
                currentPushRepo: '',
                currentPushDiffFile: '',
                currentFormatTarget: '',
                currentPromptsPath: [],
                activeFormatJobId: null,
                activeSweepJobId: null,
                activePushJobId: null,
                activeDiffJobId: null,
                dirtyDiffRepos: new Set(["ALL"]),
                cachedDiffFiles: null,
                isConfigOpen: false,
                isWorkspaceEditorOpen: false
            })
        })),
        { name: 'AppStore' }
    )
);
window.inSetu.stores.App = AppStore;

// --- EXTENSION REGISTRY (CENTRALIZED TO FIX HOISTING) ---
window.inSetu.extensions.Registry = {
    _manifests: new Map(),
    uiHooks: {},
    shortcuts: {},
    _entityActions: new Map(),

    getEntityActions: function(compoundType, data) {
        if (!compoundType) return [];
        const types = compoundType.split(':');
        const combined = [];
        types.forEach(type => {
            if (this._entityActions.has(type)) {
                combined.push(...this._entityActions.get(type));
            }
        });
        const activeActions = combined.filter(act => {
            if (act.extName && !['bridge', 'gather', 'config', 'files'].includes(act.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(act.extName)) {
                return false;
            }
            if (act.match && !act.match(data)) return false;
            return true;
        });
        return activeActions.sort((a, b) => (a.order || 99) - (b.order || 99));
    },

    utils: {
        _timers: {},
        debounce: function(key, callback, delay = 300) {
            if (this._timers[key]) window.clearTimeout(this._timers[key]); // utils.debounce whitelist
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
    compileLayout: function() {
        // Let the declarative App Shell handle the DOM rendering seamlessly
        window.dispatchEvent(new Event('insetu-layout-recompile'));
        window.dispatchEvent(new Event('insetu-settings-actions-updated'));
    },
    registerExtension: function(extName, config) {
        this._manifests.set(extName, config);
        if (config.entityActions) {
            config.entityActions.forEach(act => {
                act.extName = extName;
                const target = act.targetEntity;
                if (!this._entityActions.has(target)) this._entityActions.set(target, []);
                this._entityActions.get(target).push(act);
            });
        }
        if (config.uiHooks) {
            Object.entries(config.uiHooks).forEach(([zone, callback]) => {
                this.registerUIHook(zone, callback);
            });
        }
        if (config.layoutSlots) {
            const sortedSlots = [...config.layoutSlots].sort((a, b) => {
                const aSlot = a.slot.replace('slots:', '');
                const bSlot = b.slot.replace('slots:', '');
                if (aSlot === 'primary-navigation' && bSlot !== 'primary-navigation') return -1;
                if (aSlot !== 'primary-navigation' && bSlot === 'primary-navigation') return 1;
                return (a.order || 99) - (b.order || 99);
            });
            // Layout is now bound exclusively to AppShell recompilation updates
        }
        if (config.settingsActions) {
            config.settingsActions.forEach(act => {
                let sectionName = 'Extensions';
                if (config.name === 'Workspace Configuration' || act.id === 'config_editor' || act.id === 'workspaces_editor') sectionName = 'Workspace';
                else if (config.name === 'Issue Tracker') sectionName = 'Tracker';
                else if (config.name === 'Skills Tracker') sectionName = 'Practice';
                this.registerSettingsAction(act.id, act.label, act.icon, act.onClick, sectionName);
            });
        }
        console.log(`📦 Registered Declarative Extension: ${extName} v${config.version || '1.0'}`);
    },
    executeUIHook: function(zone, data) {
        if (this.uiHooks[zone]) {
            for (let cb of this.uiHooks[zone]) {
                try {
                    const res = cb(data);
                    if (res) return res;
                } catch (e) {
                    console.error(`[inSetu Event Bus] Error executing UI hook for zone '${zone}':`, e);
                }
            }
        }
        return null;
    },
    _settingsActions: [],
    registerSettingsAction: function(id, label, icon, callback, section = 'Extensions') {
        this._settingsActions = this._settingsActions.filter(a => a.id !== id);
        this._settingsActions.push({ id, label, icon, callback, section });
        window.dispatchEvent(new Event('insetu-settings-actions-updated'));
    },
    registerTab: (id, label, extName = null, componentTag = null) => {
        const container = document.getElementById('main-tabs-container');
        if (!container) return null;

        let tab = document.querySelector(`.tab[data-id="${id}"]`) || document.querySelector(`.tab[onclick*="${id}"]`);
        if (!tab) {
            tab = document.createElement('div');
            tab.className = 'tab';
            tab.dataset.id = id;
            if (extName) tab.dataset.ext = extName;
            tab.onclick = (e) => window.switchTab ? window.switchTab(e, id) : null;
            tab.innerText = label;
            container.appendChild(tab);
            const { tabOrder } = AppStore.getState();
            if (tabOrder && tabOrder.length > 0) {
                const tabs = Array.from(container.children);
                tabs.sort((a, b) => {
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
        }
        let content = document.getElementById('tab-' + id);
        if (!content) {
            content = document.createElement('div');
            content.id = 'tab-' + id;
            content.className = 'tab-content';
            if (extName) content.dataset.ext = extName;
            content.innerHTML = `
                <div class="sub-tabs-bar">
                    <div class="sub-tabs"></div>
                    <div class="sub-tabs-actions" style="display: flex; gap: 8px; align-items: center;"></div>
                </div>
                <div class="screen active" id="screen-${id}"></div>
            `;
            document.body.insertBefore(content, document.getElementById('file-modal'));
        }

        const screen = content.querySelector('.screen');
        if (componentTag && screen && !screen.querySelector(componentTag)) {
            screen.innerHTML = `<${componentTag}></${componentTag}>`;
        }
        return screen;
    },
    registerSubTab: (parentId, id, label, extName = null, componentTag = null, order = 99) => {
        const parentTab = document.getElementById('tab-' + parentId);
        if (!parentTab) return null;

        const subTabContainer = parentTab.querySelector('.sub-tabs');
        if (subTabContainer) {
            let st = document.getElementById('st-' + id);
            if (!st) {
                st = document.createElement('div');
                st.className = 'sub-tab';
                st.id = 'st-' + id;
                if (extName) st.dataset.ext = extName;
                st.dataset.order = order;
                st.onclick = () => window.switchSubTab ?
                window.switchSubTab(id) : null;
                st.innerText = label;
                subTabContainer.appendChild(st);

                // Sort sub-tabs by order dynamically
                const subTabs = Array.from(subTabContainer.children);
                subTabs.sort((a, b) => (parseInt(a.dataset.order) || 99) - (parseInt(b.dataset.order) || 99));
                subTabs.forEach(t => subTabContainer.appendChild(t));
            }
        }

        const screen = parentTab.querySelector('.screen');
        if (!screen) return null;
        let subContent = document.getElementById('sub-' + id);
        if (!subContent) {
            subContent = document.createElement('div');
            subContent.id = 'sub-' + id;
            subContent.className = 'sub-tab-content';
            if (extName) subContent.dataset.ext = extName;
            screen.appendChild(subContent);
        } else if (extName && !subContent.dataset.ext) {
            subContent.dataset.ext = extName;
        }
        if (componentTag && !subContent.querySelector(componentTag)) {
            subContent.innerHTML = `<${componentTag}></${componentTag}>`;
        }
        return subContent;
    },
    registerSubTabAction: (parentId, subId, extName = null, componentTag = null, order = 99) => {
        const parentTab = document.getElementById('tab-' + parentId);
        if (!parentTab) return null;

        const actionsContainer = parentTab.querySelector('.sub-tabs-actions');
        if (actionsContainer) {
            let actEl = actionsContainer.querySelector(`[data-sub-id="${subId}"][data-ext="${extName}"]`);
            if (!actEl && componentTag) {
                actEl = document.createElement(componentTag);
                actEl.dataset.subId = subId;
                if (extName) actEl.dataset.ext = extName;
                actEl.dataset.order = order;
                actEl.style.display = 'none'; 
                actionsContainer.appendChild(actEl);

                // Enforce strict internal order arrays sorting
                const acts = Array.from(actionsContainer.children);
                acts.sort((a, b) => (parseInt(a.dataset.order) || 99) - (parseInt(b.dataset.order) || 99));
                acts.forEach(p => actionsContainer.appendChild(p));
            }
            return actEl;
        }
        return null;
    }
};

window.ExtensionRegistry = window.inSetu.extensions.Registry;

// --- EXTENSION LIFECYCLE REGISTRY ---
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
    if (this._unloadHooks.has(extName)) {
        try { this._unloadHooks.get(extName)(); } catch (e) { console.error(`Error unloading extension [${extName}]:`, e); }
        this._unloadHooks.delete(extName);
    }
    if (this._ticks.has(extName)) this._ticks.delete(extName);
};