import { html, css } from 'lit';
import { AppStore } from '/static/extensions/system/store.js';
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
        // Snapshot the dirty state at the exact moment compilation begins
        const snapshotRepos = Array.from(AppStore.getState().dirtyRepos || []);
        const snapshotBuckets = Array.from(AppStore.getState().dirtyBuckets || []);
        AppStore.setState({ isPipelineActive: true });
        if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('syncing');
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus('⏳ Initializing pipeline...', null);
        try {
            const payload = { force_full: forceFull };
            if (startStep) payload.start_step = startStep;
            if (targetRepos) payload.target_repos = targetRepos;
            const response = await window.inSetu.api.system.post('pipeline/submit', payload);
            const data = await response.json();
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
                // Clear dirty trackers upon successful context generation
                AppStore.setState(s => {
                    const newDirtyRepos = new Set(s.dirtyRepos);
                    if (targetRepos && targetRepos.length > 0) {
                        targetRepos.forEach(r => newDirtyRepos.delete(r));
                    } else {
                        snapshotRepos.forEach(r => newDirtyRepos.delete(r));
                    }
                    return { dirtyRepos: newDirtyRepos };
                });
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

export function getFlattenedBuckets(repoDirOrConfigs = [], includeSystem = false) {
    if (Array.isArray(repoDirOrConfigs)) {
        const flattened = [];
        repoDirOrConfigs.forEach(repo => {
            if (!repo || typeof repo !== 'object') return;
            const subBuckets = repo.sub_buckets || [];
            if (Array.isArray(subBuckets)) {
                subBuckets.forEach(b => {
                    if (b && typeof b === 'object' && (!b.is_system || includeSystem)) {
                        flattened.push({
                            ...b,
                            repo_dir: repo.repo_dir || '',
                            repo_title: repo.title || repo.repo_dir || ''
                        });
                    }
                });
            }
        });
        return flattened;
    }

    const repoDir = repoDirOrConfigs;
    const { targetConfigs } = AppStore.getState();
    const repoCfg = (targetConfigs || []).find(c => c.repo_dir === repoDir);
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

const packSelectionPayload = async (items) => {
    const payloadItems = items.map(i => {
        const d = i.data || i;
        if (d?.folderpath) return { folderpath: d.folderpath };
        if (d?.filepath) return { filepath: d.filepath };
        return null;
    }).filter(i => i !== null);
    if (payloadItems.length === 0) throw new Error("No valid items to pack.");

    // Stateful Hash: Incorporate the live VFS/CTX manifest timestamps into the hash.
    // If a file is edited, its timestamp changes, naturally busting this cache statelessly.
    const manifest = window.inSetu?.stores?.App?.getState()?.manifest || { vfs: {}, ctx: {} };
    const statefulItems = payloadItems.map(p => {
        const fp = p.filepath || p.folderpath;
        let ts = 0;
        if (manifest.ctx && manifest.ctx[fp]) ts = manifest.ctx[fp].meta?.timestamp || 0;
        return `${fp}@${ts}`;
    });

    const itemsHash = JSON.stringify(statefulItems);
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
                if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
                _lastPackItemsHash = itemsHash;
                _lastPackSelection = statusData.artifact;
                resolve(statusData.artifact);
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
        const ctxManifest = AppStore.getState().manifest?.ctx || {};
        this.manifestFiles = Object.keys(ctxManifest);
        this.requestUpdate();
    }
    connectedCallback() {
        super.connectedCallback();
        GatherStore.getState().fetchSettings();
        this.subscribe(GatherStore, state => {
            this.loading = state.loading;
            this.searchQuery = state.searchQuery;
            this.requestUpdate();
        });
        this.subscribe(AppStore, state => {
            this.manifestFiles = Object.keys(state.manifest?.ctx || {});
            this.activeModules = state.activeModules || [];
            this.pendingModules = state.pendingModules || [];
            this.isPipelineActive = state.isPipelineActive || false;
            this.categoryOrder = state.categoryOrder || [];
            this.hiddenOutputs = state.hiddenOutputs || [];
            this.requestUpdate();
        });
        this.subscribe(AppStore, state => state.gatherForceRefreshTick, (tick) => {
            if (tick) this.loadContext(false);
        });
        this.registerGlobalListener('sutram-sync-status', window, (e) => {
            this._syncState = e.detail.state;
            this.requestUpdate();
        });
        const handleGatherCompleted = async (artifact = {}) => {
            try {
                const mRes = await window.inSetu.api.workspace.get('system/manifest?t=' + Date.now());
                if (mRes.ok) {
                    const rawManifest = await mRes.json();
                    AppStore.setState(s => ({
                        manifest: { vfs: rawManifest?.vfs || {}, ctx: rawManifest?.ctx || {} }
                    }));
                }
            } catch (err) {
                console.warn("[Gather] Failed to refresh manifest post-compile:", err);
            }
        };
        this.registerGlobalListener('insetu:gather-compile-completed', window, (e) => handleGatherCompleted(e.detail || {}));
        this.registerGlobalListener('insetu:compile-step-complete', window, (e) => {
            if (e.detail && e.detail.ext_name === 'gather') {
                handleGatherCompleted(e.detail.artifact || {});
            }
        });
        const aState = AppStore.getState();
        this.manifestFiles = Object.keys(aState.manifest?.ctx || {});
        const gState = GatherStore.getState();
        this.loading = gState.loading;
        this.searchQuery = gState.searchQuery;
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    onForceRefresh() {
        this.loadContext(false);
    }
    async loadContext(forceFull = false) {
        GatherStore.setState({ loading: true });
        try {
            const result = await GatherStore.getState().executeCompile(null, forceFull);
            if (result && result.status === 'error') {
                alert("❌ " + result.message);
            }
        } catch (error) {
            console.error("Compilation error:", error);
            alert("❌ Network or syntax error compiling files. Check console for details.");
        }
    }
    render() {
        const categories = {};
        const ctxManifest = AppStore.getState().manifest?.ctx || {};
        const categoryOrder = this.categoryOrder || [];
        const hiddenOutputs = this.hiddenOutputs || [];
        // 1. Enrich data with metadata for searching
        const enrichedFiles = this.manifestFiles.map(file => {
                const manifestObj = ctxManifest[file] || {};
                const meta = manifestObj.meta || { title: file, domain: "Workspaces", desc: "Context payload." };
                if (meta.type && meta.type !== 'gather') return null;
                let finalCat = (file.startsWith && file.startsWith('quickpack_')) || file.includes('quickpack_') || file.includes('selection_') ? 'Quickpacks' : meta.domain;
                let finalDesc = meta.desc;
                let finalTitle = meta.title;
                let sizeStr = window.inSetu.utils.formatArtifactSize(meta);
                let repoDir = meta.repo || null;
                const extMeta = window.inSetu.events.emitHook('insetu:context-metadata', file);
                if (extMeta) {
                        finalCat = extMeta.cat;
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
        const repoFilteredFiles = enrichedFiles.filter(f => {
            if (f.finalCat === 'Quickpacks') return true;
            if (this.ecosystem.pinnedRepos.has('ALL')) return true;
            if (f.repoDir && this.ecosystem.pinnedRepos.has(f.repoDir)) return true;
            return Array.from(this.ecosystem.pinnedRepos).some(repo => f.filename.startsWith(repo + '_') || f.filename.includes('_' + repo + '_') || (f.finalTitle && f.finalTitle.toLowerCase().includes(repo.toLowerCase())));
        });

        // 2. Apply Fuzzy Search
        const filteredFiles = this.searchQuery  
                ? window.inSetu.utils.fuzzyFilterObjects(repoFilteredFiles, this.searchQuery, f => `${f.repoDir || ''} ${f.finalTitle} ${f.finalCat} ${f.finalDesc}`)
                : repoFilteredFiles;
        return html`
            <sutram-toolbar
                searchPlaceholder="Fuzzy search contexts..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => GatherStore.getState().setSearchQuery(e.detail.value)}
                .enableFilterDropdown=${true}
                .activeFilters=${Array.from(this.ecosystem.pinnedRepos)}>
                <insetu-repo-filter
                    slot="filters"
                    label="📌 Repos:"
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
                                                        return (AppStore.getState().dirtyBuckets || new Set()).has(addr.key);
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
                                                        (isDirty ? "alert-triangle" : "package"));
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
                                                                suppress: ['file-browse', 'file-edit'],
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
    batchActions: [
        {
            id: 'batch-download',
            label: 'Download',
            icon: '⬇️',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 20,
            match: (items) => items.length > 0 && items.every(i => {
                const d = i.data || i;
                return d?.filepath || d?.folderpath;
            }),
            asyncAction: async (items) => {
                try {
                    const artifact = await packSelectionPayload(items);
                    window.inSetu.stores.Selection.getState().clearSelection();
                    if (artifact.chunks && artifact.chunks.length > 1) {
                        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading Parts...", 2000);
                        for (const f of artifact.chunks) {
                            const fetchUrl = `/download/${encodeURIComponent(f)}`;
                            if (window.inSetu.vfs.fetchAndDownloadState) {
                                await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                                await new Promise(r => setTimeout(r, 300));
                            }
                        }
                    } else {
                        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading...", 2000);
                        if (window.inSetu.vfs.fetchAndDownloadState) {
                            await window.inSetu.vfs.fetchAndDownloadState(artifact.base_filename, `/download/${encodeURIComponent(artifact.base_filename)}`);
                        }
                    }
                } catch (err) {
                    alert("Packing failed: " + err.message);
                }
            }
        },
        {
            id: 'batch-share',
            label: 'Compile Pack',
            icon: '✨',
            intent: 'warning',
            emphasis: true,
            group: 'share',
            vfsBound: true,
            order: 30,
            match: (items) => !!navigator.share && !!navigator.canShare && items.length > 0 && items.every(i => {
                const d = i.data || i;
                return d?.filepath || d?.folderpath;
            }),
            onClick: (items, e) => {
                if (e) e.stopPropagation();

                const payloadItems = items.map(i => {
                    const d = i.data || i;
                    if (d?.folderpath) return { folderpath: d.folderpath };
                    if (d?.filepath) return { filepath: d.filepath };
                    return null;
                }).filter(i => i !== null);

                const itemsHash = JSON.stringify(payloadItems);

                // Synchronous Fast-Path if Quickpack already exists
                if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
                    window.inSetu.stores.Selection.getState().clearSelection();
                    window.inSetu.vfs.shareFiles(_lastPackSelection.base_filename, _lastPackSelection.chunks);
                    return;
                }

                // First Tap: Execute background compilation and cache warm
                if (window.inSetu.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus("⏳ Compiling Quickpack...", null);
                }
                packSelectionPayload(items).then(artifact => {
                    _lastPackItemsHash = itemsHash;
                    _lastPackSelection = artifact;
                    window.inSetu.stores.Selection.getState().clearSelection();
                    window.inSetu.vfs.shareFiles(artifact.base_filename, artifact.chunks);
                }).catch(err => {
                    alert("Packing failed: " + err.message);
                });
            }
        }
    ]
});