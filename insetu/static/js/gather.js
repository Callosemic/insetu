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
        this.manifestFiles = Object.keys(AppStore.getState().manifest || {});
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
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

        this.manifestFiles.forEach(file => {
            if (typeof HIDDEN_OUTPUTS !== 'undefined' && HIDDEN_OUTPUTS.includes(file)) return;
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

            if (this.searchQuery && !finalTitle.toLowerCase().includes(this.searchQuery)) return;

            if (!categories[finalCat]) categories[finalCat] = [];
            categories[finalCat].push({
                filename: file,
                displayName: finalTitle,
                description: finalDesc,
                sizeStr: sizeStr,
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
            <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
                <span id="refresh-time" style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;"></span>
            </div>
            <div style="margin-bottom: 15px;">
                <input type="text" placeholder="Filter contexts..." @keyup=${(e) => this.searchQuery = e.target.value}>
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

export class InSetuFileActions extends LitElement {
    static properties = { filepath: { type: String }, repoDir: { type: String }, isFS: { type: Boolean } };
    createRenderRoot() { return this; } // Render in light DOM so slots naturally project into the parent asset card
    updated() {
        this.replaceChildren();
        if (window.ExtensionRegistry?.executeUIHook) {
            window.ExtensionRegistry.executeUIHook('zone:file-card-actions', {
                filepath: this.filepath,
                repoDir: this.repoDir,
                isFS: this.isFS,
                actionsContainer: this
            });
        }
    }
}
customElements.define('insetu-file-actions', InSetuFileActions);
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
                    const container = document.getElementById('sub-gather');
                    const litEl = container?.querySelector('insetu-ext-gather');
                    if (litEl && data.forceRefresh) litEl.loadContext();
                }
            }
        }
    });
});