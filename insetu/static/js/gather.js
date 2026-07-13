import { html, css } from 'lit';
import { AppStore } from './store.js';
import { setGlobalStatus, executeSystemCompile, fetchAndDownloadState } from './app.js';
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
        activeChunkFile: { type: String }
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

        this.subscribe(AppStore, state => state.manifest, (m) => {
            this.manifestFiles = Object.keys(m || {});
        });

        this.subscribe(AppStore, state => state.gatherForceRefreshTick, (tick) => {
            if (tick) this.loadContext();
        });

        this.manifestFiles = Object.keys(AppStore.getState().manifest || {});

        const gState = GatherStore.getState();
        this.loading = gState.loading;
        this.loadingMessage = gState.loadingMessage;
        this.searchQuery = gState.searchQuery;
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

    async _downloadTarget(targetFile, btnComponent = null) {
        if (btnComponent && btnComponent.tagName === 'INSETU-ASYNC-BTN') btnComponent._status = 'loading';
        try {
            const res = await fetch(`/download/${targetFile}`);
            if (!res.ok) throw new Error("Download failed from server.");
            const text = await res.text();
            const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = targetFile.split('/').pop();
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            if (btnComponent && btnComponent.tagName === 'INSETU-ASYNC-BTN') btnComponent._status = 'success';
        } catch (err) {
            alert("Error downloading file: " + err.message);
            if (btnComponent && btnComponent.tagName === 'INSETU-ASYNC-BTN') btnComponent._status = 'error';
        } finally {
            if (btnComponent && btnComponent.tagName === 'INSETU-ASYNC-BTN') {
                setTimeout(() => { if (btnComponent._status !== 'loading') btnComponent._status = 'idle'; }, 2000);
            }
        }
    }

    async _copyTarget(targetFile, btnElement) {
        const orig = btnElement.innerText;
        btnElement.innerText = "⏳...";
        try {
            const res = await fetch(`/download/${targetFile}`);
            if (!res.ok) throw new Error();
            const text = await res.text();
            await navigator.clipboard.writeText(text);
            btnElement.innerText = "✅ Copied";
        } catch(err) {
            btnElement.innerText = "❌ Error";
        }
        setTimeout(() => { btnElement.innerText = orig; }, 2000);
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

                if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                        const extMeta = window.ExtensionRegistry.executeUIHook('zone:context-metadata', file);
                        if (extMeta) {
                                finalCat = extMeta.cat;
                                finalDesc = extMeta.desc;
                                finalTitle = extMeta.displayName;
                        }
                }
                return { filename: file, finalCat, finalDesc, finalTitle, sizeStr };
        }).filter(f => f !== null);
        // 2. Apply Fuzzy Search
        const filteredFiles = this.searchQuery 
                ? window.inSetu.utils.fuzzyFilterObjects(enrichedFiles, this.searchQuery, f => `${f.finalTitle} ${f.finalCat} ${f.finalDesc}`)
                : enrichedFiles;

        filteredFiles.forEach(f => {
                if (!categories[f.finalCat]) categories[f.finalCat] = [];
                categories[f.finalCat].push({
                        filename: f.filename,
                        displayName: f.finalTitle,
                        description: f.finalDesc,
                        sizeStr: f.sizeStr,
                        isFS: false
                });
        });

        const sortedCats = Object.keys(categories).sort((a, b) => {
            let iA = categoryOrder.indexOf(a);
            let iB = categoryOrder.indexOf(b);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });
        return html`
            <div class="sticky-header" style="padding: 0; border-bottom: 1px solid var(--border); background: var(--bg);">
                <div class="fuzzy-search-wrapper" style="margin: 0; border: none; border-radius: 0; background: transparent;">
                    <input type="text" placeholder="🔍 Fuzzy search contexts..." .value=${this.searchQuery} 
                        style="border: none; background: transparent; padding: 10px 12px; margin: 0; border-radius: 0; outline: none; box-shadow: none; width: 100%; box-sizing: border-box;"
                        @input=${(e) => GatherStore.getState().setSearchQuery(e.target.value)}>
                    ${this.searchQuery ? html`<button class="fuzzy-search-clear" @click=${() => GatherStore.getState().setSearchQuery('')}>Clear</button>` : ''}
                </div>
            </div>
            ${this.loading ? html`<div class="spinner" style="display:block; padding: 15px;">${this.loadingMessage}</div>` : ''}

            <div style="display: ${this.loading ? 'none' : 'block'};">
                ${sortedCats.map(catName => html`
                    <insetu-category-section titleText=${catName}>
                        ${catName === "Quick-Pack Clipboard" ? html`
                            <insetu-async-btn slot="header-actions" label="🗑️ Clear" intent="danger" .onClick=${async () => { if(window.clearQuickPacks) await window.clearQuickPacks(); }}></insetu-async-btn>
                        ` : ''}
                        ${categories[catName].map(f => html`
                            <insetu-card
                                .filename=${f.filename}
                                .titleText=${f.displayName || f.filename}
                                .descriptionText=${f.description || ''}
                                .detailText=${f.sizeStr ? `${f.filename} | ${f.sizeStr}` : f.filename}
                                icon="📦"
                                intentColor="var(--intent-highlight)"
                                @card-clicked=${() => { if(window.viewAndCopy) window.viewAndCopy(f.filename); }}>
                                <insetu-file-actions slot="actions" .filepath=${f.filename} .repoDir=${f.repoDir} .isFS=${f.isFS}></insetu-file-actions>
                                <button slot="actions" class="btn-sm" style="background: var(--intent-neutral); margin: 0 5px 0 0;"
                                        @click=${(e) => { e.stopPropagation(); if (window.openBrowseModal) window.openBrowseModal(f.filename); }}>📁 Browse</button>
${(() => {
    const chunks = AppStore.getState().manifest[f.filename]?.meta?.chunks;
    const hasChunks = chunks && chunks.length > 1;

    if (hasChunks) {
        return html`
            <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0; color: white; border: none; cursor: pointer;"
                @click=${(e) => {
                    e.stopPropagation();
                    this.activeChunkFile = f.filename;
                    this.chunkModalOpen = true;
                }}>
                📦 View Parts
            </button>
        `;
    } else {
        return html`
            <insetu-async-btn slot="actions" label="⬇️ Download" intent="primary" .onClick=${async (e) => {
                e.stopPropagation();
                await this._downloadTarget(f.filename, e.target);
            }}></insetu-async-btn>
        `;
    }
})()}
                                </insetu-card>
                        `)}
                    </insetu-category-section>
                `)}
            </div>

            <insetu-modal ?open=${this.chunkModalOpen} titleText="📦 Context Parts" maxWidth="500px" @modal-closed=${() => this.chunkModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px;">
                    ${(this.activeChunkFile ? (AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunks || []) : []).map((chunk, idx) => html`
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                            <span style="font-weight: bold; font-family: monospace; font-size: 0.85rem; color: var(--text);">📄 Part ${idx + 1} ${(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes && AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx]) ? `(${Math.round(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx] / 1024)}kb)` : ''}</span>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${(e) => this._copyTarget(chunk, e.target)}>📋 Copy</button>
                                <button class="btn-sm" style="background: var(--intent-primary); margin: 0;" @click=${() => this._downloadTarget(chunk)}>⬇️ Download</button>
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