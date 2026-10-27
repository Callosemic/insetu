import { html, css } from 'lit';
import { AppStore, SelectionStore } from '/static/extensions/system/store.js';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
let compilePromise = null;
let compilePromiseWs = null;

export const executeCompile = async (onProgress = null, forceFull = false, startStep = null, targetRepos = null) => {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    if (compilePromise && compilePromiseWs === activeWs) return compilePromise;

    const targetConfigs = AppStore.getState().targetConfigs || [];
    if (!targetConfigs || targetConfigs.length === 0) {
        return Promise.resolve({ status: 'success', message: "No tracked repositories configured.", files: [] });
    }
    compilePromiseWs = activeWs;
    compilePromise = (async () => {
        AppStore.setState({ isPipelineActive: true });
        if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('syncing');
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus('⏳ Initializing pipeline...', null);
        try {
            const payload = { force_full: forceFull };
            if (startStep) payload.start_step = startStep;
            if (targetRepos) payload.target_repos = targetRepos;
            const response = await window.inSetu.api.system.post('pipeline/submit', payload);
            let data = {};
            try {
                data = await response.json();
            } catch (parseErr) {
                throw new Error(`Pipeline request failed (HTTP ${response.status})`);
            }
            if (!response.ok && response.status !== 202) {
                throw new Error(data.error || data.message || `Pipeline error (HTTP ${response.status})`);
            }
            let result = null;
            if (response.status === 202) {
                if (data.job_id === 'offline_queue') {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus('🌩️ Queued for offline sync', 2000);
                    return { status: 'success', message: 'Queued for offline sync.', files: [] };
                }
                result = await new Promise((resolve, reject) => {
                    window.inSetu.utils.pollJob(data.job_id, {
                        onProgress: (msg) => {
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                            if (onProgress) onProgress(msg);
                        },
                        onComplete: (statusData) => {
                            resolve({ status: 'success', message: statusData.message, files: statusData.artifact?.files || [] });
                        },
                        onError: (err) => {
                            reject(err);
                        }
                    });
                });
            } else {
                result = data;
            }
            // OS-Level Hydration: Automatically update global manifest on success
            if (result && result.status !== 'error') {
                const mRes = await window.inSetu.api.workspace.get('system/manifest?t=' + Date.now());
                if (mRes.ok) {
                    const rawManifest = await mRes.json();
                    AppStore.setState({ manifest: { vfs: rawManifest?.vfs || {}, ctx: rawManifest?.ctx || {} } });
                }
                if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('synced');
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus('✅ Sync Complete', 2000);
                // Manifest watermarks (vfs.source_ts vs ctx.meta.timestamp) automatically reconcile dirtyBuckets/dirtyRepos on setState({ manifest }) above.
            } else {
                if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('pending'); // Fallback if error
            }
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                return { status: 'aborted', message: 'Workspace switched.', files: [] };
            }
            if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('pending');
            throw error;
        } finally {
            AppStore.setState({ isPipelineActive: false });
            window.inSetu.events.emitHook('insetu:compile-progress', { status: 'terminated' });
            compilePromise = null;
        }
    })();
    return compilePromise;
};
export const GatherStore = createExtensionStore('Gather', {
    loading: false,
    executeCompile,
    searchQuery: '',
    quickPacks: [],
    activeQuickPack: null,
    gatherOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: "", profileDir: "" },
    domainColors: {},
    fetchSettings: async () => {
        try {
            const res = await window.inSetu.api.workspace.get('gather/settings?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                if (data.domain_colors) GatherStore.setState({ domainColors: data.domain_colors });
            }
        } catch(e) {}
    },
    setSearchQuery: (q) => GatherStore.setState({ searchQuery: q }),
    // Proxy legacy API calls to the App Shell to prevent extension breakage
    setPinnedRepos: (repos) => {
        if (window.inSetu.stores.App) {
            window.inSetu.stores.App.getState().setPinnedRepos(repos);
        }
    }
});
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.stores.Gather = GatherStore;
window.addEventListener('insetu-gather-settings-changed', () => {
    GatherStore.getState().fetchSettings();
});

window.addEventListener('insetu:ensure-fresh-artifact', (e) => {
    const filePath = e.detail?.filepath || '';
    if (!filePath || !filePath.startsWith('ctx://contexts/')) return;
    const baseUri = filePath.replace(/_part\d+\.txt$/, '.txt');
    const appState = AppStore.getState();
    const dirtyRepos = appState.dirtyRepos || new Set();
    const dirtyBuckets = appState.dirtyBuckets || new Set();
    const manifestObj = appState.manifest?.ctx?.[baseUri] || appState.manifest?.ctx?.[filePath];
    const meta = manifestObj?.meta || {};
    const addr = window.inSetu.utils.BucketAddress ? window.inSetu.utils.BucketAddress.fromFilepath(baseUri, meta) : null;
    const itemRepos = Array.isArray(meta.repos) ? meta.repos : (meta.repo ? [meta.repo] : []);

    const isDirty = !manifestObj ||
                    (addr && addr.key && dirtyBuckets.has(addr.key)) ||
                    (addr && addr.repo && dirtyRepos.has(addr.repo)) ||
                    itemRepos.some(r => dirtyRepos.has(r) || Array.from(dirtyBuckets).some(b => b.startsWith(`${r}::`))) ||
                    dirtyBuckets.has(baseUri) ||
                    dirtyBuckets.has(filePath);
    if (isDirty) {
        const run = (async () => {
            if (window.inSetu.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus("⏳ Compiling fresh context...", null);
            }
            const targetRepos = itemRepos.length > 0
                ? itemRepos
                : ((addr && addr.repo && addr.repo !== 'orphan' && addr.repo !== 'global') ? [addr.repo] : null);
            await GatherStore.getState().executeCompile(null, !manifestObj, null, targetRepos);
        })();
        if (Array.isArray(e.inSetuResponses)) e.inSetuResponses.push(run);
    }
});
export function getFlattenedBuckets(repoDirOrConfigs = null, includeSystem = false) {
    const { targetConfigs } = AppStore.getState();
    let configsToProcess = [];

    if (Array.isArray(repoDirOrConfigs)) {
        configsToProcess = repoDirOrConfigs;
    } else if (typeof repoDirOrConfigs === 'string' && repoDirOrConfigs.trim()) {
        const repo = (targetConfigs || []).find(c => c.repo_dir === repoDirOrConfigs.trim());
        if (repo) configsToProcess = [repo];
    } else {
        configsToProcess = targetConfigs || [];
    }

    const flattened = [];
    configsToProcess.forEach(repo => {
        if (!repo || typeof repo !== 'object') return;
        const subBuckets = repo.sub_buckets || [];
        if (!Array.isArray(subBuckets)) return;

        const parentDomain = (repo.domain || '').trim() || 'Workspaces';
        const repoDir = repo.repo_dir || '';
        const repoTitle = repo.title || repoDir;

        subBuckets.forEach(b => {
            if (!b || typeof b !== 'object') return;
            if (b.is_system && !includeSystem) return;

            if (b.dynamic_split_prefix && b.meta_map) {
                Object.entries(b.meta_map).forEach(([module, meta]) => {
                    const modTitle = meta?.title || module.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const modDomain = (meta?.domain || '').trim() || (b.domain || '').trim() || parentDomain;
                    flattened.push({
                        id: module,
                        title: modTitle,
                        domain: modDomain,
                        repo_dir: repoDir,
                        repo_title: repoTitle,
                        is_dynamic: true,
                        dynamic_parent: b.id || b.dynamic_split_prefix,
                        original: b
                    });
                });
            } else if (!b.dynamic_split_prefix) {
                const bTitle = b.title || b.id || 'Untitled Bucket';
                const bDomain = (b.domain || '').trim() || parentDomain;
                flattened.push({
                    ...b,
                    id: b.id || bTitle,
                    title: bTitle,
                    domain: bDomain,
                    repo_dir: repoDir,
                    repo_title: repoTitle,
                    original: b
                });
            }
        });
    });

    return flattened;
}

if (typeof window !== 'undefined') {
    window.inSetu.utils = window.inSetu.utils || {};
    window.inSetu.sys = window.inSetu.sys || {};
    window.inSetu.utils.getFlattenedBuckets = getFlattenedBuckets;
    window.inSetu.sys.getFlattenedBuckets = getFlattenedBuckets;
}
let _lastPackSelection = null;
let _lastPackItemsHash = '';

window.addEventListener('insetu:vfs-mutated', () => {
    _lastPackSelection = null;
    _lastPackItemsHash = '';
});
window.addEventListener('insetu:soft-refresh', () => {
    _lastPackSelection = null;
    _lastPackItemsHash = '';
});
const _computePackSelectionPayload = (items) => {
    const payloadItems = items.map(i => {
        const d = i.data || i;
        if (typeof d === 'string' && d.trim()) {
            const isDirStr = d.trim().endsWith('/');
            return { filepath: d.trim(), isDir: isDirStr };
        }
        const rawTarget = String(d?.filepath || d?.folderpath || d?.id || '').trim();
        if (!rawTarget) return null;
        const isDir = Boolean(d?.isDir || d?.folderpath || rawTarget.endsWith('/'));
        if (isDir) {
            const cleanDir = rawTarget.replace(/\/+$/, '');
            return { filepath: `${cleanDir}/`, folderpath: cleanDir, isDir: true };
        }
        return { filepath: rawTarget, isDir: false };
    }).filter(i => i !== null);

    const manifest = window.inSetu?.stores?.App?.getState()?.manifest || { vfs: {}, ctx: {} };
    const statefulItems = payloadItems.map(p => {
        const fp = p.filepath || p.folderpath;
        let ts = 0;
        if (manifest.ctx && manifest.ctx[fp]) ts = manifest.ctx[fp].meta?.timestamp || 0;
        return `${fp}@${ts}`;
    });

    return { payloadItems, itemsHash: JSON.stringify(statefulItems) };
};

const packSelectionPayload = async (items) => {
    const { payloadItems, itemsHash } = _computePackSelectionPayload(items);
    if (payloadItems.length === 0) throw new Error("No valid items to pack.");

    if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
        return _lastPackSelection;
    }
    const res = await window.inSetu.api.workspace.post('gather/pack_selection', { items: payloadItems });
    if (!res.ok) throw new Error("Failed to queue compilation.");
    const data = await res.json();
    if (data.job_id === 'offline_queue') {
        throw new Error("Quickpack compilation requires an active network connection.");
    }
    return new Promise((resolve, reject) => {
        window.inSetu.utils.pollJob(data.job_id, {
            onProgress: (msg) => { if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null); },
            onComplete: async (statusData) => {
                const artifact = statusData.artifact || {};
                if (artifact.base_filename && artifact.manifest_entry) {
                    const curManifest = AppStore.getState().manifest || { vfs: {}, ctx: {} };
                    AppStore.setState({
                        manifest: {
                            vfs: curManifest.vfs || {},
                            ctx: { ...(curManifest.ctx || {}), [artifact.base_filename]: artifact.manifest_entry }
                        }
                    });
                } else if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
                const packedFiles = artifact.manifest_entry?.files || [];
                if (packedFiles.length > 0 && packedFiles.every(f => typeof f === 'string')) {
                    _lastPackItemsHash = itemsHash;
                    _lastPackSelection = artifact;
                } else {
                    _lastPackItemsHash = '';
                    _lastPackSelection = null;
                }
                resolve(artifact);
            },
            onError: (err) => reject(err)
        });
    });
};
export class InSetuExtGather extends InSetuElement {
    static properties = {
        loading: { type: Boolean },
        manifestFiles: { type: Array },
        searchQuery: { type: String },
        pinnedRepos: { type: Object },
        allRepos: { type: Array },
        activeModules: { type: Array },
        pendingModules: { type: Array },
        isPipelineActive: { type: Boolean },
        categoryOrder: { type: Array },
        hiddenOutputs: { type: Array },
        _showFilters: { type: Boolean },
        _expandedCats: { type: Object },
        _syncState: { type: String }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
        `
    ];
    constructor() {
        super();
        this.loading = false;
        this.manifestFiles = [];
        this.searchQuery = '';
        this.categoryOrder = [];
        this.hiddenOutputs = [];
        this._expandedCats = {};
        this._syncState = 'synced';
    }
    onWorkspaceLoad(workspaceId) {
        GatherStore.getState().fetchSettings();
        const aState = AppStore.getState();
        this.manifestFiles = aState.derivedCtxKeys || Object.keys(aState.manifest?.ctx || {});
        this.requestUpdate();
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            GatherStore,
            state => ({
                loading: state.loading,
                searchQuery: state.searchQuery,
                domainColors: state.domainColors
            }),
            { autoFetch: 'fetchSettings' }
        );

        this.subscribe(
            AppStore,
            state => ({
                manifestFiles: state.derivedCtxKeys || Object.keys(state.manifest?.ctx || {}),
                manifestCtx: state.manifest?.ctx,
                dirtyBuckets: state.dirtyBuckets,
                activeModules: state.activeModules || [],
                pendingModules: state.pendingModules || [],
                isPipelineActive: state.isPipelineActive || false,
                categoryOrder: state.categoryOrder || [],
                hiddenOutputs: state.hiddenOutputs || []
            }),
            (slice) => {
                this.manifestFiles = slice.manifestFiles;
                this.activeModules = slice.activeModules;
                this.pendingModules = slice.pendingModules;
                this.isPipelineActive = slice.isPipelineActive;
                this.categoryOrder = slice.categoryOrder;
                this.hiddenOutputs = slice.hiddenOutputs;
                this.requestUpdate();
            }
        );
        this.subscribe(AppStore, state => state.gatherForceRefreshTick, (tick) => {
            if (tick) this.loadContext(false);
        });
        this.registerGlobalListener('sutram-sync-status', window, (e) => {
            this._syncState = e.detail.state;
            this.requestUpdate();
        });
        const handleGatherCompleted = async () => {
            try {
                if (window.inSetu.sys?.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
            } catch (err) {
                console.warn("[Gather] Failed to refresh manifest post-compile:", err);
            }
        };
        this.registerGlobalListener('insetu:gather-compile-completed', window, () => handleGatherCompleted());
        this.registerGlobalListener('insetu:compile-step-complete', window, (e) => {
            if (e.detail && e.detail.ext_name === 'gather' && e.detail.artifact?.step_id !== 'pack_selection_task') {
                handleGatherCompleted();
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    onForceRefresh() {
        super.onForceRefresh();
        this.loadContext(true);
    }
    async loadContext(forceFull = false) {
        GatherStore.setState({ loading: true });
        try {
            const result = await GatherStore.getState().executeCompile(null, forceFull);
            if (result && result.status === 'error') {
                alert("❌ " + (result.message || result.error || "Compilation failed."));
            }
        } catch (error) {
            console.error("Compilation error:", error);
            alert(`❌ Compilation error: ${error.message || "Check console for details."}`);
        } finally {
            GatherStore.setState({ loading: false });
        }
    }
    render() {
        const categories = {};
        const ctxManifest = AppStore.getState().manifest?.ctx || {};
        const categoryOrder = this.categoryOrder || [];
        const hiddenOutputs = this.hiddenOutputs || [];
        // 1. Enrich data with metadata for searching
        const targetConfigs = this.ecosystem?.targetConfigs || AppStore.getState().targetConfigs || [];
        const enrichedFiles = this.manifestFiles.map(file => {
                const manifestObj = ctxManifest[file] || {};
                const meta = manifestObj.meta || { title: file, domain: "Workspaces", desc: "Context payload." };
                if (meta.type && meta.type !== 'gather') return null;
                const repoDir = meta.repo || null;
                const repoCfg = repoDir ? targetConfigs.find(r => r && r.repo_dir === repoDir) : null;
                const parentDomain = (repoCfg?.domain || '').trim() || 'Workspaces';
                const isQuickpackFile = (file.startsWith && file.startsWith('quickpack_')) || file.includes('quickpack_') || file.includes('selection_');
                let finalCat = isQuickpackFile ? 'Quickpacks' : ((meta.domain || '').trim() || parentDomain);
                let finalDesc = meta.desc;
                let finalTitle = meta.title;
                let sizeStr = window.inSetu.utils.formatArtifactSize(meta);
                const extMeta = window.inSetu.events.emitHook('insetu:context-metadata', file);
                if (extMeta) {
                        finalCat = (extMeta.cat || '').trim() || parentDomain;
                        finalDesc = extMeta.desc;
                        finalTitle = extMeta.displayName;
                }

                return { filename: file, finalCat, finalDesc, finalTitle, sizeStr, repoDir };
        }).filter(f => f !== null);
        const isPipelineRunning = (this.activeModules || []).includes('gather') || (this.pendingModules || []).includes('gather');
        const isGatherLoading = this.loading || isPipelineRunning;
        if (isGatherLoading) {
            const targetConfigs = this.ecosystem.targetConfigs || AppStore.getState().targetConfigs || [];
            if (targetConfigs) {
                targetConfigs.forEach(cfg => {
                    if (cfg.exclude_from_context) return;
                    const hasContext = enrichedFiles.some(f => f.filename.includes(cfg.repo_dir) || (f.finalTitle && f.finalTitle.toLowerCase().includes(cfg.repo_dir.toLowerCase())));
                    if (!hasContext) {
                        enrichedFiles.push({
                            filename: `skeleton_${cfg.repo_dir}`,
                            finalCat: cfg.domain || "Workspaces",
                            finalDesc: "Hydrating context payload... please wait.",
                            finalTitle: cfg.title || cfg.repo_dir,
                            sizeStr: "⏳ pending",
                            isSkeleton: true
                        });
                    }
                });
            }
        }
        const filteredFiles = this.filterItems(enrichedFiles, {
            repoField: 'repoDir',
            alwaysInclude: f => f.finalCat === 'Quickpacks',
            searchFields: f => `${f.repoDir || ''} ${f.finalTitle} ${f.finalCat} ${f.finalDesc}`
        });
        return html`
            <sutram-toolbar
                searchPlaceholder="Fuzzy search contexts..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => GatherStore.getState().setSearchQuery(e.detail.value)}
                .enableFilterDropdown=${true}
                .activeFilters=${Array.from(this.ecosystem.pinnedRepos)}>
                <insetu-repo-filter
                    slot="filters"
                    .repos=${this.ecosystem.allRepos}
                    .activeRepos=${Array.from(this.ecosystem.pinnedRepos)}
                    @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                </insetu-repo-filter>
            </sutram-toolbar>
            <sutram-scroll-view>
                ${(() => {
                    const groups = {};
                        filteredFiles.forEach(f => {
                            if (!groups[f.finalCat]) groups[f.finalCat] = [];
                            groups[f.finalCat].push(f);
                        });

                        const sortedCats = Object.keys(groups).sort((a, b) => {
                            if (a === 'Quickpacks') return -1;
                            if (b === 'Quickpacks') return 1;

                            const isHiddenA = a === 'Hidden Context' || a === 'Tracker Issues' || (hiddenOutputs && hiddenOutputs.includes(a));
                            const isHiddenB = b === 'Hidden Context' || b === 'Tracker Issues' || (hiddenOutputs && hiddenOutputs.includes(b));

                            if (isHiddenA && !isHiddenB) return 1;
                            if (!isHiddenA && isHiddenB) return -1;

                            const idxA = categoryOrder.indexOf(a);
                            const idxB = categoryOrder.indexOf(b);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                            return a.localeCompare(b);
                        });

                        return sortedCats.map(cat => {
                            const isAutoCollapsed = cat === 'Hidden Context' || cat === 'Tracker Issues' || (hiddenOutputs && hiddenOutputs.includes(cat));
                            const isOpen = this._expandedCats[cat] ?? !isAutoCollapsed;
                            return html`
                                <sutram-collapsible 
                                    titleText=${cat} 
                                    intent="neutral" 
                                    .open=${isOpen}
                                    @sutram-collapsible-toggled=${(e) => {
                                        this._expandedCats = { ...this._expandedCats, [cat]: e.detail.open };
                                        this.requestUpdate();
                                    }}>
                                    ${cat === 'Quickpacks' ? html`
                                        <sutram-async-btn slot="actions" label="Clear" intent="danger" size="sm" .onClick=${async () => {
                                            try {
                                                _lastPackSelection = null;
                                                _lastPackItemsHash = '';
                                                const res = await window.inSetu.api.workspace.post('gather/clear_quickpacks', {});
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                                                        await window.inSetu.sys.refreshManifest();
                                                    }
                                                    if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(data.message, 2000);
                                                }
                                            } catch(e) {
                                                console.error("Failed to clear quickpacks: " + e.message);
                                            }
                                        }}></sutram-async-btn>
                                    ` : ''}
                                        <div style="display: flex; flex-direction: column; width: 100%;">
                                            ${isOpen ? groups[cat].map(f => {
                                                    const isDirty = (() => {
                                                        const manifestObj = AppStore.getState().manifest?.ctx?.[f.filename];
                                                        const addr = window.inSetu.utils.BucketAddress.fromFilepath(f.filename, manifestObj?.meta);
                                                        const dirtySet = AppStore.getState().dirtyBuckets || new Set();
                                                        return dirtySet.has(String(addr.key).toLowerCase()) || dirtySet.has(addr.key);
                                                    })();
                                                    const isLocked = f.isSkeleton || (isGatherLoading && isDirty);
                                                    let baseIntent = 'primary';
                                                    const dColors = GatherStore.getState().domainColors || {};
                                                    const testStr = `${f.finalTitle || ''} ${f.finalCat || ''}`.toLowerCase();
                                                    for (const [intent, keywords] of Object.entries(dColors)) {
                                                        if (Array.isArray(keywords)) {
                                                            if (keywords.some(kw => testStr.includes(kw.toLowerCase()))) {
                                                                baseIntent = intent;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    if (f.finalCat === 'Quickpacks') baseIntent = 'warning';
                                                    const isQuickpack = f.finalCat === 'Quickpacks';
                                                    const activeIntent = isDirty ? "warning" : baseIntent;
                                                    let displayIcon = isQuickpack ? "zap" :
                                                        (isLocked ? "loader" : 
                                                        (isDirty ? "construction" : "package"));
                                                    return html`
                                                    <div style="padding-bottom: 12px;">
                                                        <sutram-card
                                                            style="margin-bottom: 0;"
                                                            ?stale=${isLocked}
                                                            .filename=${f.filename}
                                                            .titleText=${f.finalTitle || (f.filename.includes('/') ? f.filename.split('/').pop() : f.filename)}
                                                            .descriptionText=${f.finalDesc || ''}
                                                            .statusText=${f.isSkeleton ? 'Pending Compilation...' : ''}
                                                            .detailPrefix=${f.repoDir ? `[${f.repoDir}] ` : ''}
                                                            .detailText=${f.filename.includes('/') ? f.filename.split('/').pop() : f.filename}
                                                            .detailSuffix=${f.sizeStr ? ` | ${f.sizeStr}` : ''}
                                                            .icon=${displayIcon}
                                                            intent=${activeIntent}
                                                            entityType="file:context"
                                                            .entityData=${{ 
                                                                filepath: f.filename, 
                                                                repoDir: f.repoDir, 
                                                                isFS: false, 
                                                                isSkeleton: f.isSkeleton,
                                                                needs_recompile: isDirty,
                                                                suppress: ['file-edit'],
                                                                chunks: window.inSetu?.utils?.extractManifestFiles ? window.inSetu.utils.extractManifestFiles(AppStore.getState().manifest || {}, f.filename) : [f.filename]
                                                            }}
                                                            @card-clicked=${() => {
                                                                if (f.isSkeleton) return;
                                                                if (window.inSetu?.vfs?.viewInWindow) {
                                                                    window.inSetu.vfs.viewInWindow(f.filename);
                                                                } else if (window.inSetu?.vfs?.viewAndCopy) {
                                                                    window.inSetu.vfs.viewAndCopy(f.filename);
                                                                }
                                                            }}>
                                                        </sutram-card>
                                                    </div>
                                                `;}) : ''}
                                        </div>
                                </sutram-collapsible>
                            `;
                        });
                    })()}
            </sutram-scroll-view>
        `;
    }
}
customElements.define('insetu-ext-gather', InSetuExtGather);
window.ExtensionRegistry.registerExtension('gather', {
    name: "Context Gatherer",
    version: "2.0.0",
    icon: "hexagon",
    offline_mode: "read_only",
    repoConfigOptions: [
        {
            id: 'gather-repo-exclude',
            order: 10,
            component: ({ repo, updateCallback }) => html`
                <sutram-toggle 
                    label="Exclude from Context Compilation" 
                    .checked=${!!repo.exclude_from_context} 
                    ?flush=${true}
                    @sutram-input-changed=${(e) => { 
                        repo.exclude_from_context = e.detail.value; 
                        updateCallback(); 
                    }}>
                </sutram-toggle>
            `
        }
    ],
    bucketConfigOptions: [
        {
            id: 'gather-exclude',
            order: 10,
            component: ({ bucket, updateCallback }) => html`
                <sutram-toggle 
                    label="Exclude from Context Compilation" 
                    .checked=${!!bucket.exclude_from_context} 
                    ?flush=${true}
                    @sutram-input-changed=${(e) => { 
                        bucket.exclude_from_context = e.detail.value; 
                        updateCallback(); 
                    }}>
                </sutram-toggle>
            `
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "gather",
            label: "Gather",
            icon: "hexagon",
            intent: "primary",
            order: 1,
            component: "insetu-ext-gather"
        }
    ],
    entityActions: [
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-download',
            bulkGroupKey: 'pack-download',
            label: 'Download',
            bulkLabel: 'Download',
            icon: 'download',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 20,
            bulkable: true,
            bulkOnly: true,
            match: (data) => !!(data?.filepath || data?.folderpath),
            bulkAction: async (items) => {
                try {
                    const artifact = await packSelectionPayload(items);
                    SelectionStore.getState().clearSelection();
                    if (artifact.chunks && artifact.chunks.length > 1) {
                        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading Parts...", 2000);
                        for (const f of artifact.chunks) {
                            const fetchUrl = `${window.inSetu.vfs.resolveFileFetchUrl(f, false)}&download=1`;
                            if (window.inSetu.vfs.fetchAndDownloadState) {
                                await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                                await new Promise(r => setTimeout(r, 300));
                            }
                        }
                    } else {
                        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading...", 2000);
                        if (window.inSetu.vfs.fetchAndDownloadState) {
                            const fetchUrl = `${window.inSetu.vfs.resolveFileFetchUrl(artifact.base_filename, false)}&download=1`;
                            await window.inSetu.vfs.fetchAndDownloadState(artifact.base_filename, fetchUrl);
                        }
                    }
                } catch (err) {
                    alert("Packing failed: " + err.message);
                }
            }
        },
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-share',
            bulkGroupKey: 'pack-share',
            label: 'Share',
            bulkLabel: 'Share',
            icon: 'share',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 25,
            bulkable: true,
            bulkOnly: true,
            match: (data) => !!(data?.filepath || data?.folderpath) && !!navigator.share && !!navigator.canShare,
            bulkOnClick: (items, e) => {
                if (e) e.stopPropagation();

                const { itemsHash } = _computePackSelectionPayload(items);
                // Synchronous Fast-Path if Quickpack is already compiled (preserves WebKit user gesture)
                if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
                    SelectionStore.getState().clearSelection();
                    window.inSetu.vfs.shareFiles(_lastPackSelection.base_filename, _lastPackSelection.chunks);
                    return;
                }

                if (window.inSetu.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus("⏳ Compiling Quickpack for Share...", null);
                }
                packSelectionPayload(items).then(artifact => {
                    SelectionStore.getState().clearSelection();
                    window.inSetu.vfs.shareFiles(artifact.base_filename, artifact.chunks);
                }).catch(err => {
                    alert("Packing failed: " + err.message);
                });
            }
        },
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-compile',
            bulkGroupKey: 'pack-compile',
            label: 'Compile Only',
            bulkLabel: 'Compile Only',
            icon: 'zap',
            intent: 'warning',
            emphasis: true,
            group: 'share',
            vfsBound: true,
            order: 30,
            bulkable: true,
            bulkOnly: true,
            match: (data) => !!(data?.filepath || data?.folderpath),
            bulkAction: async (items) => {
                try {
                    const { itemsHash } = _computePackSelectionPayload(items);
                    if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
                        SelectionStore.getState().clearSelection();
                        if (window.inSetu.ui?.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus("⚡ Quickpack already in Gather!", 2000);
                        }
                        return;
                    }
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⏳ Compiling Quickpack...", null);
                    }
                    await packSelectionPayload(items);
                    SelectionStore.getState().clearSelection();
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⚡ Quickpack compiled to Gather!", 3000);
                    }
                } catch (err) {
                    alert("Packing failed: " + err.message);
                }
            }
        }
    ]
});