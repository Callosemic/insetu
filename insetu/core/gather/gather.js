import { html, css } from 'lit';
import { AppStore } from '/static/extensions/system/store.js';
import { fetchAndDownloadState, fetchAndCopy, getGlobalManifest, viewAndCopy, FsStore } from '/static/extensions/fs/fs.js';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/sdk.js';
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
        try {
            const payload = { force_full: forceFull };
            if (startStep) payload.start_step = startStep;
            if (targetRepos) payload.target_repos = targetRepos;

            const response = await window.inSetu.api.workspace.post('gather/submit', payload);
            const data = await response.json();
            let result = null;
            if (response.status === 202) {
                let jobId = data.job_id;
                if (jobId === 'offline_queue') {
                    return { status: 'success', message: 'Queued for offline sync.', files: [] };
                }
                let retries = 0;
                const processedSteps = new Set();
                while (true) {
                    if (AppStore.getState().activeWorkspace !== compilePromiseWs) {
                        result = { status: 'aborted', message: 'Workspace switched.', files: [] };
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 250));
                    if (AppStore.getState().activeWorkspace !== compilePromiseWs) {
                        result = { status: 'aborted', message: 'Workspace switched.', files: [] };
                        break;
                    }

                    const pollRes = await window.inSetu.api.workspace.get(`system/jobs/${jobId}`, {
                        headers: { 'X-Workspace-ID': compilePromiseWs }
                    });

                    if (pollRes.status === 404) {
                        result = { status: 'aborted', message: 'Job not found (context shifted).', files: [] };
                        break;
                    }
                    if (!pollRes.ok) throw new Error("Compilation job failed");
                    const pollData = await pollRes.json();

                    // INVERSION OF CONTROL: Broadcast progress statelessly
                    window.inSetu.events.emitHook('insetu:compile-progress', pollData);
                    if (pollData.artifact && pollData.artifact.chain_history) {
                        pollData.artifact.chain_history.forEach(step => {
                            if (!processedSteps.has(step.job_id)) {
                                processedSteps.add(step.job_id);
                                window.inSetu.events.emitHook('insetu:compile-step-complete', step);
                            }
                        });
                    }

                    if (pollData.status === 'processing' || pollData.status === 'pending') {
                        const msg = pollData.message || "Compiling...";
                        if (AppStore.getState().activeWorkspace === compilePromiseWs) {
                            window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                            if (onProgress) onProgress(msg);
                        }
                        retries++;
                        if (retries > 720) {
                            result = { status: 'error', message: 'Compilation timed out. The background worker may have stalled.', files: [] };
                            break;
                        }
                    } else if (pollData.status === 'completed') {
                        if (pollData.artifact && pollData.artifact.next_job_id) {
                            jobId = pollData.artifact.next_job_id;
                            retries = 0;
                            continue;
                        }
                        result = { status: 'success', message: pollData.message, files: pollData.artifact?.files || [] };
                        break;
                    } else if (pollData.status === 'failed') {
                        result = { status: 'error', message: pollData.message, files: [] };
                        break;
                    }
                }
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
            } else {
                if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) window.inSetu.ui.setSyncStatus('pending'); // Fallback if error
            }
            window.inSetu.ui.setGlobalStatus("✅ Sync Complete", 2000);
            return result;
        } catch (error) {
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
    loadingMessage: "Compiling ecosystem contexts... please wait.",
    executeCompile,
    searchQuery: '',
    allRepos: AppStore.getState().allRepos || [],
    targetConfigs: AppStore.getState().targetConfigs || [],
    quickPacks: [],
    activeQuickPack: null,
    gatherOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: "", profileDir: "" },
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
const packSelectionPayload = async (items) => {
    const payloadItems = items.map(i => {
        const d = i.data || i;
        if (d?.folderpath) return { folderpath: d.folderpath };
        if (d?.filepath) return { filepath: d.filepath };
        return null;
    }).filter(i => i !== null);

    if (payloadItems.length === 0) throw new Error("No valid items to pack.");
    const res = await window.inSetu.api.workspace.post('gather/pack_selection', { items: payloadItems });
    if (!res.ok) throw new Error("Failed to queue compilation.");
    const data = await res.json();
    return new Promise((resolve, reject) => {
        window.inSetu.utils.pollJob(data.job_id, {
            onProgress: (msg) => { if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null); },
            onComplete: async (statusData) => {
                try {
                    const mRes = await window.inSetu.api.system.get('manifest?t=' + Date.now());
                    if (mRes.ok) window.inSetu.stores.App.setState({ manifest: (await mRes.json()) || { vfs: {}, ctx: {} } });
                } catch(e) {}
                resolve(statusData.artifact);
            },
            onError: (err) => reject(err)
        });
    });
};

export class InSetuExtGatherActions extends InSetuElement {
    static get extensionName() { return 'gather'; }
    static styles = [sharedStyles];
    render() {
        return html``;
    }
}
customElements.define('insetu-ext-gather-actions', InSetuExtGatherActions);

export class InSetuExtGather extends InSetuElement {
    static properties = {
        loading: { type: Boolean },
        loadingMessage: { type: String },
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
        this.loadingMessage = "Compiling ecosystem contexts... please wait.";
        this.manifestFiles = [];
        this.searchQuery = '';
        this.categoryOrder = [];
        this.hiddenOutputs = [];
        this._expandedCats = {};
        this._syncState = 'synced';
    }
    onWorkspaceLoad(workspaceId) {
        // Rely purely on the core OS background heartbeat to hydrate the manifest.
        // Do not force a compilation pipeline trigger just because the view mounted.
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(GatherStore, state => {
            this.loading = state.loading;
            this.loadingMessage = state.loadingMessage;
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
        this.registerGlobalListener('insetu:compile-progress', window, (e) => {
            const pollData = e.detail;
            if (pollData.status === 'terminated') {
                GatherStore.setState({ loading: false });
                return;
            }
            const currentExt = pollData.ext_name || (pollData.id ? pollData.id.split('_')[0] : '');
            GatherStore.setState(state => ({ 
                loading: currentExt === 'gather' || currentExt === 'cmp',
                // Preserve the previous message during the 250ms handoff to prevent visual flickering
                loadingMessage: pollData.status === 'completed' ? state.loadingMessage : (pollData.message || "Compiling ecosystem contexts...")
            }));
        });
        const aState = AppStore.getState();
        this.manifestFiles = Object.keys(aState.manifest?.ctx || {});
        const gState = GatherStore.getState();
        this.loading = gState.loading;
        this.loadingMessage = gState.loadingMessage;
        this.searchQuery = gState.searchQuery;
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    onForceRefresh() {
        this.loadContext(false);
    }
    async loadContext(forceFull = false) {
        GatherStore.setState({ loading: true, loadingMessage: "Compiling ecosystem contexts... please wait." });
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
        const isGatherActive = this.loading || (!this.isPipelineActive && (this.activeModules || []).includes('gather'));
        const isGatherPending = !this.isPipelineActive && (this.pendingModules || []).includes('gather');
        const isGatherLoading = isGatherActive || isGatherPending;
        const displayLoadingMsg = isGatherActive ? this.loadingMessage : "Waiting for prerequisite contexts to compile...";

        if (isGatherLoading) {
            const { targetConfigs } = GatherStore.getState();
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
                searchPlaceholder="🔍 Fuzzy search contexts..."
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
            <div style="flex: 1; overflow-y: auto; padding: 0;">
                ${this._syncState === 'pending' && !isGatherLoading ? html`
                    <div style="background: var(--intent-warning); color: #000; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); font-size: 0.85rem; flex-shrink: 0;">
                        <div><strong>⚠️ Contexts Stale:</strong> Pending changes are waiting for the compilation slew limiter.</div>
                        <button class="btn-sm" style="background: #000; color: var(--intent-warning); margin: 0; border: 1px solid #000; font-weight: bold; padding: 4px 10px;" @click=${() => this.loadContext(false)}>Compile Now</button>
                    </div>
                ` : ''}
                ${isGatherLoading ? html`
                    <div style="padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--input-bg); flex-shrink: 0;">
                        <sutram-spinner text=${displayLoadingMsg}></sutram-spinner>
                    </div>
                ` : ''}
                <div style="display: flex; flex-direction: column; opacity: ${isGatherLoading ? '0.6' : '1'}; transition: opacity 0.2s ease; pointer-events: ${isGatherLoading ? 'none' : 'auto'};">
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
                                    ?flush=${true}
                                    @sutram-collapsible-toggled=${(e) => {
                                        this._expandedCats = { ...this._expandedCats, [cat]: e.detail.open };
                                        this.requestUpdate();
                                    }}
                                    style="--title-weight: bold; --title-size: 1.05rem; color: var(--text); background: transparent; border-left: none; border-right: none; border-radius: 0; box-shadow: none;">

                                    ${cat === 'Quickpacks' ? html`
                                        <sutram-async-btn slot="actions" label="Clear" intent="danger" .onClick=${async () => {
                                            try {
                                                const res = await window.inSetu.api.workspace.post('gather/clear_quickpacks', {});
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(data.message, 2000);
                                                    const mRes = await window.inSetu.api.system.get('manifest?t=' + Date.now());
                                                    if (mRes.ok) AppStore.setState({ manifest: (await mRes.json()) || { vfs: {}, ctx: {} } });
                                                }
                                            } catch(e) {
                                                console.error("Failed to clear quickpacks: " + e.message);
                                            }
                                        }}></sutram-async-btn>
                                    ` : ''}
                                    <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 20px 20px 20px;">
                                        ${groups[cat].map(f => html`
                                            <insetu-card
                                                .filename=${f.filename}
                                                .titleText=${f.finalTitle || (f.filename.includes('/') ? f.filename.split('/').pop() : f.filename)}
                                                .descriptionText=${f.finalDesc || ''}
                                                .detailPrefix=${f.repoDir ? `[${f.repoDir}] ` : ''}
                                                .detailText=${f.filename.includes('/') ? f.filename.split('/').pop() : f.filename}
                                                .detailSuffix=${f.sizeStr ? ` | ${f.sizeStr}` : ''}
                                                icon="📦"
                                                intentColor="var(--intent-highlight)"
                                                entityType="file:context"
                                                .entityData=${{ 
                                                    filepath: f.filename, 
                                                    repoDir: f.repoDir, 
                                                    isFS: false, 
                                                    isSkeleton: f.isSkeleton,  
                                                    suppress: ['file-copy', 'file-browse', 'file-edit'],
                                                    chunks: window.inSetu?.utils?.extractManifestFiles ? window.inSetu.utils.extractManifestFiles(AppStore.getState().manifest || {}, f.filename) : [f.filename]
                                                }}
                                                @card-clicked=${() => {
                                                    if (f.isSkeleton) return;
                                                    if (window.inSetu?.vfs?.viewAndCopy) {
                                                        window.inSetu.vfs.viewAndCopy(f.filename);
                                                    } else if (typeof viewAndCopy === 'function') {
                                                        viewAndCopy(f.filename);
                                                    }
                                                }}>

                                                ${f.isSkeleton ? html`
                                                    <span slot="actions" style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-right: 10px;">Pending Compilation...</span>
                                                ` : ''}
                                            </insetu-card>
                                        `)}
                                    </div>
                                </sutram-collapsible>
                            `;
                        });
                    })()}
                </div>
            </div>
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
            order: 1,
            component: "insetu-ext-gather"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "context",
            targetSub: "gather",
            component: "insetu-ext-gather-actions",
            order: 1
        }
    ],
    batchActions: [
        {
            id: 'batch-download',
            label: 'Download',
            icon: '⬇️',
            intent: 'primary',
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
            label: 'Share',
            icon: '📤',
            intent: 'neutral',
            order: 30,
            match: (items) => !!navigator.share && !!navigator.canShare && items.length > 0 && items.every(i => {
                const d = i.data || i;
                return d?.filepath || d?.folderpath;
            }),
            asyncAction: async (items) => {
                try {
                    const artifact = await packSelectionPayload(items);
                    window.inSetu.stores.Selection.getState().clearSelection();
                    if (window.inSetu.vfs.shareFiles) {
                        await window.inSetu.vfs.shareFiles(artifact.base_filename, artifact.chunks);
                    }
                } catch (err) {
                    alert("Packing failed: " + err.message);
                }
            }
        }
    ]
});