// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const AppStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            activeWorkspace: sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default',
            manifest: {},
            allRepos: [],
            targetConfigs: [],
            virtualContexts: [],
            categoryOrder: [],
            tabOrder: [],
            hiddenOutputs: [],
            isConfigOpen: false,

            pinnedRepos: new Set(JSON.parse(localStorage.getItem('insetu_pinned_repos')) || ["ALL"]),
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
                isConfigOpen: false
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
    registerExtension: function(extName, config) {
        this._manifests.set(extName, config);
        if (config.uiHooks) {
            Object.entries(config.uiHooks).forEach(([zone, callback]) => {
                this.registerUIHook(zone, callback);
            });
        }
        if (config.layoutSlots) {
            const sortedSlots = [...config.layoutSlots].sort((a, b) => {
                if (a.slot === 'slots:primary-navigation' && b.slot !== 'slots:primary-navigation') return -1;
                if (a.slot !== 'slots:primary-navigation' && b.slot === 'slots:primary-navigation') return 1;
                return (a.order || 99) - (b.order || 99);
            });
            sortedSlots.forEach(slotDef => {
                if (slotDef.slot === 'slots:primary-navigation') {
                    this.registerTab(slotDef.id, slotDef.label, extName, slotDef.component);
                } else if (slotDef.slot === 'slots:sub-navigation') {
                    this.registerSubTab(slotDef.targetParent, slotDef.id, slotDef.label, extName, slotDef.component, slotDef.order);
                } else if (slotDef.slot === 'slots:sub-navigation-actions') {
                    this.registerSubTabAction(slotDef.targetParent, slotDef.targetSub, extName, slotDef.component, slotDef.order);
                } else if (slotDef.slot === 'slots:global') {
                    let container = document.getElementById('global-extensions-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'global-extensions-container';
                        container.style.display = 'contents';
                        document.body.appendChild(container);
                    }
                    if (!container.querySelector(slotDef.component)) {
                        container.appendChild(document.createElement(slotDef.component));
                    }
                }
            });
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
                const res = cb(data);
                if (res) return res;
            }
        }
        return null;
    },
    _settingsActions: [],
    registerSettingsAction: function(id, label, icon, callback, section = 'Extensions') {
        this._settingsActions = this._settingsActions.filter(a => a.id !== id);
        this._settingsActions.push({ id, label, icon, callback, section });
        this.renderSettingsActions();
    },
    renderSettingsActions: function() {
        const container = document.getElementById('settings-modal-links');
        if (!container) return;
        container.replaceChildren();

        const grouped = this._settingsActions.reduce((acc, act) => {
            const sec = act.section || 'Extensions';
            if (!acc[sec]) acc[sec] = [];
            acc[sec].push(act);
            return acc;
        }, {});

        Object.keys(grouped).forEach(sectionName => {
            const heading = document.createElement('div');
            heading.style.cssText = 'font-weight: bold; font-size: 0.85rem; color: var(--intent-primary); margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;';
            heading.innerText = sectionName + ':';
            container.appendChild(heading);

            grouped[sectionName].forEach(act => {
                const btn = document.createElement('button');
                btn.className = 'btn-sm';
                btn.style.cssText = 'background: var(--input-bg); color: var(--text); border: 1px solid var(--border); text-align: left; padding: 10px 15px; font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 10px; font-weight: bold; transition: background 0.2s; width: 100%;';
                btn.innerHTML = `<span style="font-size: 1.2rem;">${act.icon}</span> <span>${act.label}</span>`;
                btn.onmouseover = () => btn.style.background = 'var(--bg)';
                btn.onmouseout = () => btn.style.background = 'var(--input-bg)';
                btn.onclick = () => {
                    document.getElementById('settings-modal').style.display = 'none';
                    act.callback();
                };
                container.appendChild(btn);
            });
        });
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
            screen.appendChild(subContent);
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