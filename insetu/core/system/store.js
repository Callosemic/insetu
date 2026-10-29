// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createExtensionStore, StatusStore, ToastStore, SelectionStore } from '/static/extensions/system/insetu_sdk.js';

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
    isSwappingWorkspace: false,
    swapPhase: 'READY',
    isOffline: false,
    isReconciling: false,
    outboxCount: 0,
    pendingMutations: new Set(),
    deletedMutations: new Set(),
    activeModules: [],
    pendingModules: [],
    extensionDependencyMeta: {},
    syncWatermarks: {
        lastManifestSyncTs: 0,
        lastPolledTs: 0,
        localVfsSignatures: {},
        localCtxSignatures: {},
        warmedVfsSignatures: {}
    },
    getSyncWatermarks: () => {
        let wm = AppStore.getState().syncWatermarks;
        if (!wm || typeof wm !== 'object') {
            wm = {
                lastManifestSyncTs: 0,
                lastPolledTs: 0,
                localVfsSignatures: {},
                localCtxSignatures: {},
                warmedVfsSignatures: {}
            };
            AppStore.setState({ syncWatermarks: wm });
        }
        return wm;
    },
    resetSyncWatermarks: () => AppStore.setState({
        syncWatermarks: {
            lastManifestSyncTs: 0,
            lastPolledTs: 0,
            localVfsSignatures: {},
            localCtxSignatures: {},
            warmedVfsSignatures: {}
        }
    }),
    tabBrowsePaths: {},
    getBrowsePath: (subId = 'fs:files') => {
        const paths = AppStore.getState().tabBrowsePaths || {};
        if (paths[subId]) return paths[subId];
        const rawKey = subId.includes(':') ? subId.split(':').pop() : subId;
        const scopedKey = subId === 'files' ? 'fs:files' : subId;
        return paths[scopedKey] || paths[rawKey] || [];
    },
    setBrowsePath: (pathArray = [], subId = 'fs:files') => {
        const cleanPath = Array.isArray(pathArray) ? pathArray : [];
        const rawKey = subId.includes(':') ? subId.split(':').pop() : subId;
        const scopedKey = subId === 'files' ? 'fs:files' : subId;
        AppStore.setState(s => ({
            tabBrowsePaths: {
                ...(s.tabBrowsePaths || {}),
                [subId]: cleanPath,
                [rawKey]: cleanPath,
                [scopedKey]: cleanPath
            }
        }));
        const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        const focusedCol = window.Sutram?.stores?.Layout?.getState()?.focusedColumn || 'center';
        const activeSubInCol = window.Sutram?.stores?.Layout?.getState()?.columns?.[focusedCol]?.active;
        if (!activeSubInCol || activeSubInCol === subId || activeSubInCol === scopedKey || activeSubInCol === rawKey) {
            const routeSub = activeSubInCol || scopedKey;
            const deepStr = cleanPath.length > 0 ? '/' + cleanPath.map(encodeURIComponent).join('/') : '';
            const hash = `#/${encodeURIComponent(activeWs)}/${focusedCol}/${encodeURIComponent(routeSub)}${deepStr}`;
            if (window.location.hash !== hash) {
                window.history.replaceState(null, '', hash);
            }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sutram-subtab-menu-refresh', { detail: { subId: scopedKey, path: cleanPath } }));
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
        // Relational Watermark Derivation: Compare VFS bucket source_ts against compiled CTX artifact timestamp
        const compiledGatherTs = {};
        const AddrCls = window.inSetu?.utils?.BucketAddress;
        Object.entries(ctxManifest).forEach(([uri, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            const meta = entry.meta || {};
            if (meta.type && meta.type !== 'gather') return;
            if (uri.includes('quickpack_') || uri.includes('selection_')) return;
            const ts = Number(meta.timestamp || 0);
            if (AddrCls) {
                const addr = AddrCls.fromFilepath(uri, meta);
                if (addr && addr.key) {
                    const normAddrKey = String(addr.key).toLowerCase();
                    compiledGatherTs[normAddrKey] = Math.max(compiledGatherTs[normAddrKey] || 0, ts);
                }
            } else if (meta.repo && meta.bucket_id) {
                const k = `${String(meta.repo).toLowerCase()}::${String(meta.bucket_id).toLowerCase()}`;
                compiledGatherTs[k] = Math.max(compiledGatherTs[k] || 0, ts);
            }
        });

        const derivedDirtyBuckets = new Set();
        const derivedDirtyRepos = new Set();
        const bucketSourceTsMap = {};
        const repoMaxSourceTs = {};
        Object.entries(vfsManifest).forEach(([bucketKey, bucketObj]) => {
            if (!bucketObj || !Array.isArray(bucketObj.files) || bucketObj.files.length === 0) return;
            const nonKeepFiles = bucketObj.files.filter(f => f && !f.endsWith('/.gitkeep') && !f.endsWith('/.keep'));
            if (nonKeepFiles.length === 0) return;

            const normKey = String(bucketKey).toLowerCase();
            const [repoName] = normKey.split('::');
            const bucketId = normKey.slice(repoName.length + 2);
            // Files matched by drop_patterns are kept out of every context and diff, so they never make anything stale.
            if (bucketId === '_dropped') return;
            const sourceTs = Number(bucketObj.source_ts || 0);
            bucketSourceTsMap[normKey] = sourceTs;
            if (repoName) {
                repoMaxSourceTs[repoName] = Math.max(repoMaxSourceTs[repoName] || 0, sourceTs);
            }

            const repoCfg = configs.find(c => c && String(c.repo_dir || '').toLowerCase() === repoName);
            if (repoCfg && repoCfg.exclude_from_context) return;
            // Sub-buckets excluded from context have no gather artifact to compare against, so counting
            // them would keep the whole repo dirty forever.
            if (repoCfg && (repoCfg.sub_buckets || []).some(b => b && b.exclude_from_context && String(b.id || '').toLowerCase() === bucketId)) return;

            const compiledTs = Number(compiledGatherTs[normKey] || 0);
            if (sourceTs > 0 && (compiledTs === 0 || sourceTs > compiledTs + 0.5)) {
                derivedDirtyBuckets.add(normKey);
                if (repoName) derivedDirtyRepos.add(repoName);
            }
        });

        // Evaluate all compiled CTX artifacts (including diffs and composite multi-repo artifacts) against their VFS source watermarks
        Object.entries(ctxManifest).forEach(([uri, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            if (uri.includes('quickpack_') || uri.includes('selection_')) return;
            const meta = entry.meta || {};
            const artTs = Number(meta.timestamp || 0);
            const addr = AddrCls ? AddrCls.fromFilepath(uri, meta) : null;
            const normAddrKey = addr && addr.key ? String(addr.key).toLowerCase() : '';
            let refSourceTs = normAddrKey && bucketSourceTsMap[normAddrKey] !== undefined
                ? bucketSourceTsMap[normAddrKey]
                : 0;
            if (refSourceTs === 0) {
                const itemRepos = Array.isArray(meta.repos) ? meta.repos : (meta.repo ? [meta.repo] : []);
                refSourceTs = itemRepos.reduce((acc, r) => Math.max(acc, repoMaxSourceTs[String(r).toLowerCase()] || 0), 0);
            }
            if (refSourceTs > 0 && (artTs === 0 || refSourceTs > artTs + 0.5)) {
                derivedDirtyBuckets.add(uri);
            }
        });

        const nextFiles = Array.from(allFiles);
        const nextCtxKeys = Object.keys(ctxManifest);
        const curState = AppStore.getState();
        const shallowEqual = window.inSetu?.utils?.shallowEqual;
        const filesUnchanged = shallowEqual ? shallowEqual(curState.derivedVfsFiles, nextFiles) : false;
        const gitModUnchanged = shallowEqual ? shallowEqual(curState.derivedGitModifiedSet, gitMod) : false;
        const ctxKeysUnchanged = shallowEqual ? shallowEqual(curState.derivedCtxKeys, nextCtxKeys) : false;
        const dirtyBucketsUnchanged = shallowEqual ? shallowEqual(curState.dirtyBuckets, derivedDirtyBuckets) : false;
        const dirtyReposUnchanged = shallowEqual ? shallowEqual(curState.dirtyRepos, derivedDirtyRepos) : false;

        if (!filesUnchanged || !gitModUnchanged || !ctxKeysUnchanged || !dirtyBucketsUnchanged || !dirtyReposUnchanged) {
            AppStore.setState({
                derivedVfsFiles: filesUnchanged ? curState.derivedVfsFiles : nextFiles,
                derivedGitModifiedSet: gitModUnchanged ? curState.derivedGitModifiedSet : gitMod,
                derivedCtxKeys: ctxKeysUnchanged ? curState.derivedCtxKeys : nextCtxKeys,
                dirtyBuckets: dirtyBucketsUnchanged ? curState.dirtyBuckets : derivedDirtyBuckets,
                dirtyRepos: dirtyReposUnchanged ? curState.dirtyRepos : derivedDirtyRepos
            });
        }
    }
);

