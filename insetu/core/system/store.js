// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createExtensionStore } from '/static/extensions/system/insetu_sdk.js';
import { StatusStore, ToastStore, SelectionStore } from '../../vendor/sutram/js/sutram_sdk.js';

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
    workspaces: {},
    authToken: sessionStorage.getItem('insetu_boot_token') || '',
    manifest: { vfs: {}, ctx: {} },
    derivedVfsFiles: [],
    derivedGitModifiedSet: new Set(),
    derivedCtxKeys: [],
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
    tabBrowsePaths: {},
    currentBrowsePath: [],
    setBrowsePath: (pathArray = [], subId = 'files') => {
        const cleanPath = Array.isArray(pathArray) ? pathArray : [];
        AppStore.setState(s => ({
            globalBrowsePath: cleanPath,
            tabBrowsePaths: { ...(s.tabBrowsePaths || {}), [subId]: cleanPath }
        }));
        const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        const focusedCol = window.Sutram?.stores?.Layout?.getState()?.focusedColumn || 'center';
        const activeSubInCol = window.Sutram?.stores?.Layout?.getState()?.columns?.[focusedCol]?.active;
        if (!activeSubInCol || activeSubInCol === subId) {
            const deepStr = cleanPath.length > 0 ? '/' + cleanPath.map(encodeURIComponent).join('/') : '';
            const hash = `#/${encodeURIComponent(activeWs)}/${focusedCol}/${encodeURIComponent(subId)}${deepStr}`;
            if (window.location.hash !== hash) {
                window.history.replaceState(null, '', hash);
            }
        }
    },
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
    localSync: ['pinnedRepos', 'tabBrowsePaths']
});
window.inSetu.stores.App = AppStore;
// Memoized VFS & CTX Manifest Derivation (computes once per manifest/targetConfigs change)
AppStore.subscribe(
    state => ({ vfs: state.manifest?.vfs, ctx: state.manifest?.ctx, targetConfigs: state.targetConfigs }),
    ({ vfs, ctx, targetConfigs }) => {
        const vfsManifest = vfs || {};
        const ctxManifest = ctx || {};
        const configs = targetConfigs || [];
        const validPrefixes = configs.map(cfg => cfg.repo_dir ? `vfs://${cfg.repo_dir}/` : '').filter(Boolean);

        const allFiles = new Set();
        const gitMod = new Set();
        Object.values(vfsManifest).forEach(bucket => {
            if (bucket && Array.isArray(bucket.files)) {
                bucket.files.forEach(f => {
                    if (f && typeof f === 'string' && (validPrefixes.length === 0 || validPrefixes.some(prefix => f.startsWith(prefix)))) {
                        allFiles.add(f);
                    }
                });
            }
            if (bucket && Array.isArray(bucket.git_modified)) {
                bucket.git_modified.forEach(f => {
                    if (f && typeof f === 'string') gitMod.add(f);
                });
            }
        });

        configs.forEach(cfg => {
            if (cfg.repo_dir && !Array.from(allFiles).some(f => f.startsWith(`vfs://${cfg.repo_dir}/`))) {
                allFiles.add(`vfs://${cfg.repo_dir}/.gitkeep`);
            }
        });

        const nextFiles = Array.from(allFiles);
        const nextCtxKeys = Object.keys(ctxManifest);
        const curState = AppStore.getState();
        const shallowEqual = window.inSetu?.utils?.shallowEqual;
        const filesUnchanged = shallowEqual ? shallowEqual(curState.derivedVfsFiles, nextFiles) : false;
        const gitModUnchanged = shallowEqual ? shallowEqual(curState.derivedGitModifiedSet, gitMod) : false;
        const ctxKeysUnchanged = shallowEqual ? shallowEqual(curState.derivedCtxKeys, nextCtxKeys) : false;

        if (!filesUnchanged || !gitModUnchanged || !ctxKeysUnchanged) {
            AppStore.setState({
                derivedVfsFiles: filesUnchanged ? curState.derivedVfsFiles : nextFiles,
                derivedGitModifiedSet: gitModUnchanged ? curState.derivedGitModifiedSet : gitMod,
                derivedCtxKeys: ctxKeysUnchanged ? curState.derivedCtxKeys : nextCtxKeys
            });
        }
    }
);

// Centralized Invalidation Listener (ADR 0103)
window.addEventListener('insetu:compile-step-complete', (e) => {
    const artifact = e.detail?.artifact || {};
    const cleared = artifact.cleared_buckets || artifact.touched_buckets || [];
    const isFull = artifact.is_full_sweep || false;
    AppStore.setState(state => {
        const newBuckets = new Set(state.dirtyBuckets || []);
        const newRepos = new Set(state.dirtyRepos || []);
        if (isFull) {
            newBuckets.clear();
            newRepos.clear();
        } else if (Array.isArray(cleared)) {
            cleared.forEach(bKey => {
                newBuckets.delete(bKey);
                if (typeof bKey === 'string' && bKey.includes('::')) {
                    const repo = bKey.split('::')[0];
                    const stillHasDirtyBucket = Array.from(newBuckets).some(k => k.startsWith(`${repo}::`));
                    if (!stillHasDirtyBucket) {
                        newRepos.delete(repo);
                    }
                }
            });
        }
        return { dirtyBuckets: newBuckets, dirtyRepos: newRepos };
    });
});

