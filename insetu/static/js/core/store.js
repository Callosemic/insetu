// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createExtensionStore } from './sdk.js';
import { StatusStore, ToastStore, SelectionStore } from '../../vendor/sutram/js/sdk.js';

export { StatusStore, ToastStore, SelectionStore };

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.getActiveWorkspace = function() {
    try {
        if (window.inSetu?.stores?.App) return window.inSetu.stores.App.getState().activeWorkspace || 'default';
        return sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
    } catch(e) { return 'default'; }
};

window.inSetu.stores.Status = StatusStore;
window.inSetu.stores.Toast = ToastStore;
window.inSetu.stores.Selection = SelectionStore;
export const AppStore = createExtensionStore('App', {
    activeWorkspace: window.inSetu.utils.getActiveWorkspace(),
    authToken: sessionStorage.getItem('insetu_boot_token') || '',
    manifest: {},
    isConfigOpen: false,
    isWorkspaceEditorOpen: false,
    configMissing: false,

    pinnedRepos: new Set(JSON.parse(localStorage.getItem(`insetu_pinned_repos_${window.inSetu.utils.getActiveWorkspace()}`)) || ["ALL"]),
    setPinnedRepos: (repos) => {
        const ws = AppStore.getState().activeWorkspace || 'default';
        localStorage.setItem(`insetu_pinned_repos_${ws}`, JSON.stringify(Array.from(repos)));
        AppStore.setState({ pinnedRepos: repos });
    },
    activeTab: 'context',
    activeSubTabs: {},
    globalBrowsePath: [],
    currentBrowsePath: [],
    browserConfig: { mode: 'view', callback: null },
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

