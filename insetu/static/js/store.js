// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createExtensionStore } from './sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.getActiveWorkspace = function() {
    try {
        if (window.inSetu?.stores?.App) return window.inSetu.stores.App.getState().activeWorkspace || 'default';
        return sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
    } catch(e) { return 'default'; }
};

export const StatusStore = createExtensionStore('Status', {
    message: '',
    isError: false,
    timeoutId: null,
    setStatus: (msg, timeout = 3000, isError = false) => {
        const currentTimeout = StatusStore.getState().timeoutId;
        if (currentTimeout) clearTimeout(currentTimeout); // utils.debounce whitelist

        let newTimeoutId = null;
        if (timeout) {
            newTimeoutId = setTimeout(() => {
                StatusStore.setState({ message: '', isError: false, timeoutId: null });
            }, timeout);
        }
        StatusStore.setState({ message: msg, isError, timeoutId: newTimeoutId });
    }
});
window.inSetu.stores.Status = StatusStore;

export const ToastStore = createExtensionStore('Toast', {
    toasts: [],
    addToast: (message, intent = 'danger', duration = 6000) => {
        const id = `toast_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const state = ToastStore.getState();
        if (state.toasts.some(t => t.message === message)) return;
        ToastStore.setState({ toasts: [...state.toasts, { id, message, intent }] });
        setTimeout(() => {
            ToastStore.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
        }, duration);
    },
    removeToast: (id) => ToastStore.setState(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
});
window.inSetu.stores.Toast = ToastStore;

export const SelectionStore = createExtensionStore('Selection', {
    selectedItems: new Map(),
    toggleSelection: (id, entityType, data) => {
        const newMap = new Map(SelectionStore.getState().selectedItems);
        if (newMap.has(id)) newMap.delete(id);
        else newMap.set(id, { entityType, data });
        SelectionStore.setState({ selectedItems: newMap });
    },
    clearSelection: () => SelectionStore.setState({ selectedItems: new Map() })
});
window.inSetu.stores.Selection = SelectionStore;

export const AppStore = createExtensionStore('App', {
    activeWorkspace: window.inSetu.utils.getActiveWorkspace(),
    authToken: sessionStorage.getItem('insetu_boot_token') || '',
    manifest: {},
    allRepos: [],
    targetConfigs: [],
    virtualContexts: [],
    categoryOrder: [],
    tabOrder: [],
    hiddenOutputs: [],
    isConfigOpen: false,
    isWorkspaceEditorOpen: false,
    configMissing: false,

    pinnedRepos: new Set(JSON.parse(localStorage.getItem(`insetu_pinned_repos_${window.inSetu.utils.getActiveWorkspace()}`)) || ["ALL"]),
    setPinnedRepos: (repos) => {
        const ws = AppStore.getState().activeWorkspace || 'default';
        localStorage.setItem(`insetu_pinned_repos_${ws}`, JSON.stringify(Array.from(repos)));
        AppStore.setState({ pinnedRepos: repos });
    },
    gatherOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: "", profileDir: "" },
    activeTab: 'context',
    activeSubTabs: {},
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
    setActiveRoute: (tab, subTab, deepPath = null) => {
        const state = AppStore.getState();
        const updates = { activeTab: tab };
        if (subTab) {
            updates.activeSubTabs = { ...state.activeSubTabs, [tab]: subTab };
        }
        if (deepPath !== null) {
            updates.globalBrowsePath = deepPath;
        } else {
            updates.globalBrowsePath = [];
        }
        AppStore.setState(updates);
    }
    // resetState is injected by the factory automatically
});
window.inSetu.stores.App = AppStore;

