// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createExtensionStore } from '/static/extensions/system/sdk.js';
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
    manifest: { vfs: {}, ctx: {} },
    dirtyRepos: new Set(),
    dirtyBuckets: new Set(),
    instanceEmoji: '⚙️',
    isConfigOpen: false,
    isWorkspaceEditorOpen: false,
    configMissing: false,
    isRebooting: false,
    rebootType: 'reboot',
    isOffline: false,
    isReconciling: false,
    outboxCount: 0,
    pendingMutations: new Set(),
    deletedMutations: new Set(),
    activeModules: [],
    pendingModules: [],
    globalBrowsePath: [],
    currentBrowsePath: [],
    browserConfig: { mode: 'view', callback: null },
    warmingQueue: new Set(),
    enqueueWarming: (urls) => AppStore.setState(s => {
        const q = new Set(s.warmingQueue);
        urls.forEach(u => q.add(u));
        return { warmingQueue: q };
    }),
    resolvingLocks: {},
    setResolvingLock: (path, action) => AppStore.setState(s => ({ resolvingLocks: { ...s.resolvingLocks, [path]: { action, expires: Date.now() + 10000 } } })),
    clearResolvingLock: (path) => AppStore.setState(s => { const newLocks = { ...s.resolvingLocks }; delete newLocks[path]; return { resolvingLocks: newLocks }; }),
    allRepos: [],
    targetConfigs: [],
    virtualContexts: [],
    categoryOrder: [],
    hiddenOutputs: [],
    pinnedRepos: new Set(["ALL"]),
    setPinnedRepos: (repos) => {
        AppStore.setState({ pinnedRepos: repos });
    }
    // resetState is injected by the factory automatically
}, {
    localSync: ['pinnedRepos']
});
window.inSetu.stores.App = AppStore;
// Centralized Invalidation Listener (ADR 0103)
window.addEventListener('insetu:compile-step-complete', (e) => {
    const artifact = e.detail?.artifact || {};
    const cleared = artifact.cleared_buckets || artifact.touched_buckets || [];
    const isFull = artifact.is_full_sweep || false;
    AppStore.setState(state => {
        const newBuckets = new Set(state.dirtyBuckets || []);
        if (isFull) {
            newBuckets.clear();
        } else if (Array.isArray(cleared)) {
            cleared.forEach(bKey => newBuckets.delete(bKey));
        }
        return { dirtyBuckets: newBuckets };
    });
});

