import { html, css } from 'lit';
import { AppStore } from './store.js';
import { fetchAndDownloadState, fetchAndCopy, buildFileTree, getGlobalManifest, viewAndCopy, FsStore } from './fs.js';
import { createExtensionStore, InSetuElement } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};

export const GatherStore = createExtensionStore('Gather', {
    loading: false,
    loadingMessage: "Compiling ecosystem contexts... please wait.",
    searchQuery: '',
    setSearchQuery: (q) => GatherStore.setState({ searchQuery: q })
});

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Gather = GatherStore;
export class InSetuExtGatherActions extends InSetuElement {
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
            this.allRepos = state.allRepos || [];
            this.requestUpdate();
        });

        this.subscribe(AppStore, state => state.gatherForceRefreshTick, (tick) => {
            if (tick) this.loadContext();
        });

        const aState = AppStore.getState();
        this.manifestFiles = Object.keys(aState.manifest || {});
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);
        this.allRepos = aState.allRepos || [];
        const gState = GatherStore.getState();
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
            const result = await window.inSetu.sys.executeSystemCompile((msg) => {
                GatherStore.setState({ loadingMessage: msg });
            });
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
        const { categoryOrder, manifest } = AppStore.getState();
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
            const { targetConfigs } = AppStore.getState();
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
                                    <insetu-async-btn label="🧹 Clear Quickpacks" intent="danger" .onClick=${async () => {
                                        try {
                                            const res = await window.inSetu.api.workspace('gather/clear_quickpacks', { method: 'POST' });
                                            if (res.ok) {
                                                const data = await res.json();
                                                if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(data.message, 2000);
                                                const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
                                                if (mRes.ok) window.inSetu.stores.App.setState({ manifest: await mRes.json() });
                                            }
                                        } catch(e) {
                                            alert("Failed to clear quickpacks: " + e.message);
                                        }
                                    }}></insetu-async-btn>
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
                            .entityData=${{ filepath: `system://contexts/${f.filename}`, repoDir: f.repoDir, isFS: false, isSkeleton: f.isSkeleton }}
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
                    ${(this.activeChunkFile ? (AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunks || []) : []).map((chunk, idx) => html`
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; flex-wrap: wrap; gap: 10px;">
                            <span style="font-weight: bold; font-family: monospace; font-size: 0.85rem; color: var(--text); word-break: break-all;">📄 Part ${idx + 1} ${(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes && AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx]) ? `(${Math.round(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx] / 1024)}kb)` : ''}</span>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <insetu-async-btn label="📋 Copy" intent="neutral" .onClick=${() => this._copyTarget(chunk)}></insetu-async-btn>
                                <insetu-async-btn label="⬇️ Download" intent="primary" .onClick=${() => this._downloadTarget(chunk)}></insetu-async-btn>
                            </div>
                        </div>
                    `)}
                </div>
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
                    const chunks = window.inSetu.stores.App.getState().manifest[basename]?.meta?.chunks;
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