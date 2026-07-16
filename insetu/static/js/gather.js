import { html, css } from 'lit';
import { AppStore } from './store.js';
import { setGlobalStatus, executeSystemCompile, fetchAndDownloadState, fetchAndCopy } from './app.js';
import { createExtensionStore, InSetuElement } from './sdk.js';
import { sharedStyles } from './shared_styles.js';

export const GatherStore = createExtensionStore('Gather', {
    loading: false,
    loadingMessage: "Compiling ecosystem contexts... please wait.",
    searchQuery: '',
    setSearchQuery: (q) => GatherStore.setState({ searchQuery: q })
});

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Gather = GatherStore;

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
    static styles = [sharedStyles];

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
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }

    async loadContext() {
        GatherStore.setState({ loading: true, loadingMessage: "Compiling ecosystem contexts... please wait." });
        try {
            const result = await executeSystemCompile((msg) => {
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

                if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                        const extMeta = window.ExtensionRegistry.executeUIHook('zone:context-metadata', file);
                        if (extMeta) {
                                finalCat = extMeta.cat;
                                finalDesc = extMeta.desc;
                                finalTitle = extMeta.displayName;
                        }
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

        const activeFilters = [];
        this.pinnedRepos.forEach(r => { if (r !== 'ALL') activeFilters.push(r); });
        const filterBtnText = activeFilters.length > 0 ? `Filters: ${activeFilters.slice(0, 2).join(', ')}${activeFilters.length > 2 ? '...' : ''}` : 'Filters';

        return html`
            <div class="sticky-header" style="padding: 0; display: flex; flex-direction: column; border-bottom: 1px solid var(--border); background: var(--bg);">
                <div style="display: flex; align-items: center; gap: 10px; padding-right: 12px;">
                    <insetu-search-bar 
                        style="flex: 1;"
                        placeholder="🔍 Fuzzy search contexts..." 
                        .value=${this.searchQuery} 
                        @search-changed=${(e) => GatherStore.getState().setSearchQuery(e.detail.value)}>
                    </insetu-search-bar>
                    <insetu-filter-dropdown filterText=${filterBtnText}>
                        <insetu-repo-filter
                            label="📌 Repos:"
                            .repos=${this.allRepos}
                            .activeRepos=${Array.from(this.pinnedRepos)}
                            @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                        </insetu-repo-filter>
                    </insetu-filter-dropdown>
                </div>
            </div>
            ${this.loading ? html`<div class="spinner" style="display:block; padding: 15px;">${this.loadingMessage}</div>` : ''}

            <div style="display: ${this.loading ? 'none' : 'block'};">
                <insetu-categorized-list
                    .items=${filteredFiles}
                    categoryKey="finalCat"
                    .categoryOrder=${categoryOrder}
                    .renderCategoryHeader=${(cat) => cat === "Quick-Pack Clipboard" ? html`<insetu-async-btn slot="header-actions" label="🗑️ Clear" intent="danger" .onClick=${async (e) => { e.stopPropagation(); if(window.clearQuickPacks) await window.clearQuickPacks(); }}></insetu-async-btn>` : ''}
                    .renderItem=${(f) => html`
                        <insetu-card
                            .filename=${f.filename}
                            .titleText=${f.finalTitle || f.filename}
                            .descriptionText=${f.finalDesc || ''}
                            .detailText=${f.sizeStr ? `${f.repoDir ? `[${f.repoDir}] ` : ''}${f.filename} | ${f.sizeStr}` : `${f.repoDir ? `[${f.repoDir}] ` : ''}${f.filename}`}
                            icon="📦"
                            intentColor="var(--intent-highlight)"
                            entityType="file:context"
                            .entityData=${{ filepath: f.filename, repoDir: f.repoDir, isFS: false, isSkeleton: f.isSkeleton }}
                            @card-clicked=${() => { if(!f.isSkeleton && window.viewAndCopy) window.viewAndCopy(f.filename); }}>

                            ${f.isSkeleton ? html`
                                <span slot="actions" style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-right: 10px;">Pending Compilation...</span>
                            ` : ''}
                        </insetu-card>
                    `}>
                </insetu-categorized-list>
            </div>

            <insetu-modal ?open=${this.chunkModalOpen} titleText="📦 Context Parts" maxWidth="500px" @modal-closed=${() => this.chunkModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px;">
                    ${(this.activeChunkFile ? (AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunks || []) : []).map((chunk, idx) => html`
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                            <span style="font-weight: bold; font-family: monospace; font-size: 0.85rem; color: var(--text);">📄 Part ${idx + 1} ${(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes && AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx]) ? `(${Math.round(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx] / 1024)}kb)` : ''}</span>
                            <div style="display: flex; gap: 8px;">
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
                    const chunks = window.inSetu.stores.App.getState().manifest[data.filepath]?.meta?.chunks;
                    return chunks && chunks.length > 1;
                },
                onClick: (data, e) => {
                    const gatherEl = document.querySelector('insetu-ext-gather');
                    if (gatherEl) {
                        gatherEl.activeChunkFile = data.filepath;
                        gatherEl.chunkModalOpen = true;
                        gatherEl.requestUpdate();
                    }
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