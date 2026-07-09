import { LitElement, html, css } from 'lit';
import { AppStore } from './store.js';
import { setGlobalStatus, executeSystemCompile } from './app.js';
import { sharedStyles } from './shared_styles.js';


export class InSetuExtGather extends LitElement {
    static properties = {
        loading: { type: Boolean },
        loadingMessage: { type: String },
        manifestFiles: { type: Array },
        searchQuery: { type: String }
    };
    static styles = [sharedStyles];

constructor() {
        super();
        this.loading = false;
        this.loadingMessage = "Compiling ecosystem contexts... please wait.";
        this.manifestFiles = [];
        this.searchQuery = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this._unsub = AppStore.subscribe(state => state.manifest, (m) => {
            this.manifestFiles = Object.keys(m || {});
        });
        this._unsubRefresh = AppStore.subscribe(state => state.gatherForceRefreshTick, (tick) => {
            if (tick) this.loadContext();
        });
        this.manifestFiles = Object.keys(AppStore.getState().manifest || {});
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
        if (this._unsubRefresh) this._unsubRefresh();
    }
    async loadContext() {
        this.loading = true;
        this.loadingMessage = "Compiling ecosystem contexts... please wait.";
        try {
            const result = await executeSystemCompile((msg) => {
                this.loadingMessage = msg;
            });
            if (result && result.status === 'error') {
                alert("❌ " + result.message);
            }
        } catch (error) {
            console.error("Compilation error:", error);
            alert("❌ Network or syntax error compiling files. Check console for details.");
        } finally {
            this.loading = false;
            if (window.updateRefreshText) {
                window.lastRefreshed = new Date();
                window.updateRefreshText();
            }
        }
    }

    render() {
        const categories = {};
        const { categoryOrder, manifest } = AppStore.getState();

        // 1. Enrich data with metadata for searching
        const enrichedFiles = this.manifestFiles.map(file => {
                if (typeof HIDDEN_OUTPUTS !== 'undefined' && HIDDEN_OUTPUTS.includes(file)) return null;
                const manifestObj = manifest[file] || {};
                const meta = manifestObj.meta || { title: file, domain: "Workspaces", desc: "Context payload." };

                let finalCat = meta.domain;
                let finalDesc = meta.desc;
                let finalTitle = meta.title;
                let sizeStr = "";
                if (meta.size_bytes !== undefined) {
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
                ? window.fuzzyFilterObjects(enrichedFiles, this.searchQuery, f => `${f.finalTitle} ${f.finalCat} ${f.finalDesc}`)
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
            <div class="sticky-header" style="display: flex; align-items: center; gap: 10px;">
                <div class="fuzzy-search-wrapper" style="margin-bottom: 0; flex: 1;">
                    <input type="text" placeholder="🔍 Fuzzy search contexts..." .value=${this.searchQuery} @input=${(e) => this.searchQuery = e.target.value}>
                    ${this.searchQuery ? html`<button class="fuzzy-search-clear" @click=${() => this.searchQuery = ''}>Clear</button>` : ''}
                </div>
                <span id="refresh-time" style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; white-space: nowrap;"></span>
            </div>
            ${this.loading ? html`<div class="spinner" style="display:block;">${this.loadingMessage}</div>` : ''}

            <div style="display: ${this.loading ? 'none' : 'block'};">
                ${sortedCats.map(catName => html`
                    <insetu-category-section titleText=${catName}>
                        ${catName === "Quick-Pack Clipboard" ? html`
                            <button slot="header-actions" class="btn-sm" style="background: var(--intent-danger);" @click=${() => { if(window.clearQuickPacks) window.clearQuickPacks(); }}>🗑️ Clear</button>
                        ` : ''}
                        ${categories[catName].map(f => html`
                            <insetu-card
                                .filename=${f.filename}
                                .titleText=${f.displayName || f.filename}
                                .descriptionText=${f.description || ''}
                                .detailText=${f.sizeStr ? `${f.filename} | ${f.sizeStr}` : f.filename}
                                icon="📦"
                                intentColor="var(--intent-highlight)"
                                @card-clicked=${() => { if(window.viewAndCopy) window.viewAndCopy(f.filename); else { window.currentModalFile = f.filename; window.currentModalIsFS = false; window.currentModalForceEdit = false; window.currentModalIsMemoryOnly = false; document.getElementById('modal-title').innerText = f.filename; /* fallback */ } }}>
                                <insetu-file-actions slot="actions" .filepath=${f.filename} .repoDir=${f.repoDir} .isFS=${f.isFS}></insetu-file-actions>
${AppStore.getState().manifest[f.filename] ? html`
        <button slot="actions" class="btn-sm" style="background: var(--intent-neutral); margin: 0 5px 0 0;"
                @click=${(e) => { e.stopPropagation(); if (window.openBrowseModal) window.openBrowseModal(f.filename); }}>📁 Browse</button>
` : ''}
<button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0;"
        @click=${async (e) => {
                e.stopPropagation();
                const dlUrl = f.filename.includes('/prompts/') ? `/api/${AppStore.getState().activeWorkspace || 'default'}/prompts/resolve?file=${encodeURIComponent(f.filename)}` : `/download/${f.filename}`;
                const orig = e.target.innerText;
                e.target.innerText = '⏳...';
                try {
                        const res = await fetch(dlUrl);
                        if (!res.ok) throw new Error("Failed to fetch");
                        const text = await res.text();
                        const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = f.filename;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                } catch (err) {
                        alert("Error downloading file.");
                } finally {
                        e.target.innerText = orig;
                }
        }}>⬇️ Download</button>
                                </insetu-card>
                        `)}
                    </insetu-category-section>
                `)}
            </div>
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