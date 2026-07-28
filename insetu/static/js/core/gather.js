import { html, css } from 'lit';
import { AppStore } from '../store.js';
import { fetchAndDownloadState, fetchAndCopy, buildFileTree, getGlobalManifest, viewAndCopy, FsStore } from '../fs.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';
import { sharedStyles } from '../shared_styles.js';
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};
export const GatherStore = createExtensionStore('Gather', {
    loading: false,
    loadingMessage: "Compiling ecosystem contexts... please wait.",
    searchQuery: '',
    allRepos: [],
    targetConfigs: [],
    virtualContexts: [],
    categoryOrder: [],
    tabOrder: [],
    hiddenOutputs: [],
    gatherOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: "", profileDir: "" },
    setSearchQuery: (q) => GatherStore.setState({ searchQuery: q })
});

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Gather = GatherStore;

export function getFlattenedBuckets(repoDir, includeSystem = false) {
    const { targetConfigs } = AppStore.getState();
    const repoCfg = targetConfigs.find(c => c.repo_dir === repoDir);
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

window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.sys.getFlattenedBuckets = getFlattenedBuckets;

const packSelectionPayload = async (items) => {
    const payloadItems = items.map(i => {
        if (i.data?.folderpath) return { folderpath: i.data.folderpath };
        if (i.data?.filepath) return { filepath: i.data.filepath };
        return null;
    }).filter(i => i !== null);

    if (payloadItems.length === 0) throw new Error("No valid items to pack.");

    const res = await window.inSetu.api.workspace('gather/pack_selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems })
    });
    if (!res.ok) throw new Error("Failed to queue compilation.");
    const data = await res.json();
    return new Promise((resolve, reject) => {
        window.inSetu.utils.pollJob(data.job_id, {
            onProgress: (msg) => { if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null); },
            onComplete: async (statusData) => {
                try {
                    const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
                    if (mRes.ok) window.inSetu.stores.App.setState({ manifest: await mRes.json() });
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
        chunkModalOpen: { type: Boolean },
        activeChunkFile: { type: String },
        pinnedRepos: { type: Object },
        allRepos: { type: Array },
        _showFilters: { type: Boolean }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
            .gather-body { flex: 1; overflow-y: auto; padding: 20px; }
        `
    ];

    constructor() {
        super();
        this.loading = false;
        this.loadingMessage = "Compiling ecosystem contexts... please wait.";
        this.manifestFiles = [];
        this.searchQuery = '';
        this.chunkModalOpen = false;
        this.activeChunkFile = null;
        this.pinnedRepos = new Set(['ALL']);
        this.allRepos = [];
    }

    onWorkspaceChanged(newWorkspaceId) {
        this.loadContext();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(GatherStore, state => {
            this.loading = state.loading;
            this.loadingMessage = state.loadingMessage;
            this.searchQuery = state.searchQuery;
        });
        this.subscribe(AppStore, state => {
            this.manifestFiles = Object.keys(state.manifest || {});
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
            this.requestUpdate();
        });
        this.subscribe(GatherStore, state => {
            this.allRepos = state.allRepos || [];
            this.requestUpdate();
        });

        this.subscribe(AppStore, state => state.gatherForceRefreshTick, (tick) => {
            if (tick) this.loadContext();
        });
        const aState = AppStore.getState();
        this.manifestFiles = Object.keys(aState.manifest || {});
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);
        const gState = GatherStore.getState();
        this.allRepos = gState.allRepos || [];
        this.loading = gState.loading;
        this.loadingMessage = gState.loadingMessage;
        this.searchQuery = gState.searchQuery;

        this.registerGlobalListener('insetu:gather:view-parts', window, (e) => {
            this.activeChunkFile = e.detail.filepath;
            this.chunkModalOpen = true;
            this.requestUpdate();
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    async loadContext() {
        GatherStore.setState({ loading: true, loadingMessage: "Compiling ecosystem contexts... please wait." });
        try {
            // Pass `true` as the second argument to forcefully bypass the differential 
            // ledger and execute a full Cartography and Manifest rebuild.
            const result = await window.inSetu.sys.executeSystemCompile((msg) => {
                GatherStore.setState({ loadingMessage: msg });
            }, true);
            if (result && result.status === 'error') {
                alert("❌ " + result.message);
            }
        } catch (error) {
            console.error("Compilation error:", error);
            alert("❌ Network or syntax error compiling files. Check console for details.");
        } finally {
            GatherStore.setState({ loading: false });
        }
    }
    async _downloadTarget(targetFile) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndDownloadState(targetFile, explicitUrl);
    }

    async _copyTarget(targetFile) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndCopy(targetFile, explicitUrl);
    }

    render() {
        const categories = {};
        const manifest = AppStore.getState().manifest;
        const { categoryOrder } = GatherStore.getState();
        // 1. Enrich data with metadata for searching
        const enrichedFiles = this.manifestFiles.map(file => {
                const manifestObj = manifest[file] || {};
                const meta = manifestObj.meta || { title: file, domain: "Workspaces", desc: "Context payload." };
                if (meta.type && meta.type !== 'gather') return null;

                let finalCat = meta.domain;
                let finalDesc = meta.desc;
                let finalTitle = meta.title;
                let sizeStr = "";
                if (meta.chunk_sizes && meta.chunk_sizes.length > 1) {
                    const sizes = meta.chunk_sizes.map(s => Math.round(s / 1024));
                    sizeStr = sizes.join(' + ') + " kb";
                } else if (meta.size_bytes !== undefined) {
                        const kb = Math.round(meta.size_bytes / 1024);
                        sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " mb" : kb + " kb";
                }
                let repoDir = meta.repo || null;
                const extMeta = window.inSetu.events.emitHook('zone:context-metadata', file);
                if (extMeta) {
                        finalCat = extMeta.cat;
                        finalDesc = extMeta.desc;
                        finalTitle = extMeta.displayName;
                }
                return { filename: file, finalCat, finalDesc, finalTitle, sizeStr, repoDir };
        }).filter(f => f !== null);
        if (this.loading) {
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
            if (this.pinnedRepos.has('ALL')) return true;
            if (f.repoDir && this.pinnedRepos.has(f.repoDir)) return true;
            return Array.from(this.pinnedRepos).some(repo => f.filename.startsWith(repo + '_') || f.filename.includes('_' + repo + '_') || (f.finalTitle && f.finalTitle.toLowerCase().includes(repo.toLowerCase())));
        });

        // 2. Apply Fuzzy Search
        const filteredFiles = this.searchQuery  
                ? window.inSetu.utils.fuzzyFilterObjects(repoFilteredFiles, this.searchQuery, f => `${f.repoDir || ''} ${f.finalTitle} ${f.finalCat} ${f.finalDesc}`)
                : repoFilteredFiles;
        return html`
            <yenvui-toolbar
                searchPlaceholder="🔍 Fuzzy search contexts..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => GatherStore.getState().setSearchQuery(e.detail.value)}
                .enableFilterDropdown=${true}
                .activeFilters=${Array.from(this.pinnedRepos)}>
                <insetu-repo-filter
                    slot="filters"
                    label="📌 Repos:"
                    .repos=${this.allRepos}
                    .activeRepos=${Array.from(this.pinnedRepos)}
                    @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                </insetu-repo-filter>
            </yenvui-toolbar>

            <div class="gather-body">
                ${this.loading ? html`<div class="spinner" style="display:block; padding: 15px; margin-top: 0;">${this.loadingMessage}</div>` : ''}
                <div style="display: ${this.loading ? 'none' : 'block'};">
                    <insetu-categorized-list
                    .items=${filteredFiles}
                    categoryKey="finalCat"
                    .categoryOrder=${categoryOrder}
                    .renderCategoryHeader=${(cat) => {
                        if (cat === 'Quickpacks') {
                            return html`
                                <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
                                    <yenvui-async-btn label="🧹 Clear Quickpacks" intent="danger" .onClick=${async () => {
                                        try {
                                            const res = await window.inSetu.api.workspace('gather/clear_quickpacks', { method: 'POST' });
                                            if (res.ok) {
                                                const data = await res.json();
                                                if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(data.message, 2000);
                                                const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
                                                if (mRes.ok) window.inSetu.stores.App.setState({ manifest: await mRes.json() });
                                            }
                                        } catch(e) {
                                            // yenVUI prefers toast containers over window.alert
                                            console.error("Failed to clear quickpacks: " + e.message);
                                        }
                                    }}></yenvui-async-btn>
                                </div>
                            `;
                        }
                        return '';
                    }}
                    .renderItem=${(f) => html`
                        <insetu-card
                            .filename=${f.filename}
                            .titleText=${f.finalTitle || f.filename}
                            .descriptionText=${f.finalDesc || ''}
                            .detailText=${f.sizeStr ? `${f.repoDir ? `[${f.repoDir}] ` : ''}${f.filename} | ${f.sizeStr}` : `${f.repoDir ? `[${f.repoDir}] ` : ''}${f.filename}`}
                            icon="📦"
                            intentColor="var(--intent-highlight)"
                            entityType="file:context"
                            .entityData=${{ filepath: `system://contexts/${f.filename}`, repoDir: f.repoDir, isFS: false, isSkeleton: f.isSkeleton, suppressCopy: true, suppressBrowse: true }}
                            @card-clicked=${() => { if(!f.isSkeleton && window.inSetu.vfs.viewAndCopy) window.inSetu.vfs.viewAndCopy(f.filename); }}>

                            ${f.isSkeleton ? html`
                                <span slot="actions" style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-right: 10px;">Pending Compilation...</span>
                            ` : ''}
                        </insetu-card>
                    `}>
                </insetu-categorized-list>
                </div>
            </div>
            <insetu-modal ?open=${this.chunkModalOpen} titleText="📦 Context Parts" maxWidth="500px" @modal-closed=${() => this.chunkModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow-y: auto;">
                    ${(this.activeChunkFile ? window.inSetu.utils.extractManifestFiles(AppStore.getState().manifest, this.activeChunkFile) : []).map((chunk, idx) => {
                        const sizeKb = (AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes && AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx]) 
                            ? `${Math.round(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx] / 1024)}kb` 
                            : '';
                        return html`
                            <yenvui-card 
                                titleText="Part ${idx + 1}"
                                detailText=${sizeKb}
                                icon="📄"
                                disableSelection=${true}>
                                <div style="display: flex; gap: 8px; margin-top: 10px; padding-bottom: 10px;">
                                    <yenvui-async-btn label="📋 Copy" intent="neutral" .onClick=${() => this._copyTarget(chunk)}></yenvui-async-btn>
                                    <yenvui-async-btn label="⬇️ Download" intent="primary" .onClick=${() => this._downloadTarget(chunk)}></yenvui-async-btn>
                                </div>
                            </yenvui-card>
                        `;
                    })}
                </div>
                ${(this.activeChunkFile && window.inSetu.stores.App?.getState()?.manifest[this.activeChunkFile]?.files?.length > 0) ? html`
                    <button slot="footer" style="background: var(--intent-highlight); color: white;" @click=${() => {
                        if (window.inSetu.ui.openBrowseModal) window.inSetu.ui.openBrowseModal(this.activeChunkFile);
                    }}>📁 Browse Context Files</button>
                ` : ''}
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-gather', InSetuExtGather);
document.addEventListener('DOMContentLoaded', () => {
    window.ExtensionRegistry.registerExtension('gather', {
        name: "Context Gatherer",
        version: "2.0.0",
        entityActions: [
            {
                targetEntity: 'context',
                id: 'context-view-parts',
                label: 'View Parts',
                icon: '📦',
                intent: 'primary',
                order: 100,
                match: (data) => {
                    if (data.isSkeleton) return false;
                    const basename = data.filepath ? data.filepath.split('/').pop() : data.filepath;
                    const chunks = window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App.getState().manifest, basename);
                    return chunks && chunks.length > 1;
                },
                emitEvent: (data) => {
                    const basename = data.filepath ? data.filepath.split('/').pop() : data.filepath;
                    return { name: 'insetu:gather:view-parts', detail: { filepath: basename } };
                }
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
                match: (items) => items.length > 0 && items.every(i => i.data?.filepath || i.data?.folderpath),
                asyncAction: async (items) => {
                    try {
                        const artifact = await packSelectionPayload(items);
                        window.inSetu.stores.Selection.getState().clearSelection();
                        if (artifact.chunks && artifact.chunks.length > 1) {
                            if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Opening Parts...", 2000);
                            if (window.inSetu.sys && window.inSetu.sys.switchTab) window.inSetu.sys.switchTab(null, 'context');
                            window.dispatchEvent(new CustomEvent('insetu:gather:view-parts', { detail: { filepath: artifact.base_filename } }));
                        } else {
                            if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading...", 2000);
                            if (window.inSetu.vfs.fetchAndDownloadState) {
                                await window.inSetu.vfs.fetchAndDownloadState(artifact.base_filename, `/download/${artifact.base_filename}`);
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
                match: (items) => !!navigator.share && !!navigator.canShare && items.length > 0 && items.every(i => i.data?.filepath || i.data?.folderpath),
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
        ],
        uiHooks: {
            'zone:subtab-changed': (data) => {
                if (data.parentId === 'context' && data.subId === 'gather') {
                    if (data.forceRefresh) {
                        window.inSetu.stores.App.setState({ gatherForceRefreshTick: Date.now() });
                    }
                }
            }
        }
    });
});