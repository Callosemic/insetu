import { LitElement, html, css } from 'lit';
import { AppStore } from './store.js';
import { setGlobalStatus } from './app.js';
import { sharedStyles } from './shared_styles.js';

let compilePromise = null;
let compilePromiseWs = null;

export const compileContexts = (onProgress = null) => {
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    if (compilePromise && compilePromiseWs === activeWs) return compilePromise;

    compilePromiseWs = activeWs;
    compilePromise = (async () => {
        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let result = null;
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); 
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);
                    if (data.status === 'progress') {
                        setGlobalStatus(`⏳ ${data.message}`, null);
                        if (onProgress) onProgress(data.message);
                    } else {
                        result = data;
                    }
                }
            }
            setGlobalStatus("✅ Sync Complete", 2000);
            return result;
        } catch (error) {
            throw error;
        } finally {
            compilePromise = null;
        }
    })();
    return compilePromise;
};
window.compileContexts = compileContexts;

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
            const result = await compileContexts((msg) => {
                this.loadingMessage = msg;
            });
            if (result && result.status === 'error') {
                alert("❌ " + result.message);
            } else {
                const activeWs = AppStore.getState().activeWorkspace || 'default';
                const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
                if (mRes.ok) AppStore.setState({ manifest: await mRes.json() });
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h2 style="margin: 0;">System Context</h2>
                </div>
                <span id="refresh-time" style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;"></span>
            </div>
            <div style="margin-bottom: 15px;">
                <input type="text" placeholder="Filter contexts..." style="width: 100%; padding: 8px 10px; font-size: 14px; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" @keyup=${(e) => this.searchQuery = e.target.value}>
            </div>
            ${this.loading ? html`<div class="spinner" style="display:block;">${this.loadingMessage}</div>` : ''}
            
            <div style="display: ${this.loading ? 'none' : 'block'};">
                ${sortedCats.map(catName => html`
                    <insetu-category-section titleText=${catName}>
                        ${catName === "Quick-Pack Clipboard" ? html`
                            <button slot="header-actions" class="btn-sm" style="background: var(--intent-danger); margin: 0; padding: 4px 10px; font-size: 0.8rem;" @click=${() => { if(window.clearQuickPacks) window.clearQuickPacks(); }}>🗑️ Clear</button>
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
                                
                                ${(window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) ? 
                                    (() => {
                                        const container = document.createElement('div');
                                        window.ExtensionRegistry.executeUIHook('zone:file-card-actions', { filepath: f.filename, repoDir: f.repoDir, isFS: f.isFS, actionsContainer: container });
                                        return Array.from(container.children).map(child => {
                                            child.slot = 'actions';
                                            return html`${child}`;
                                        });
                                    })() : ''
                                }
                                
                                ${(AppStore.getState().manifest[f.filename]) ? html`
                                    <button slot="actions" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px; font-size: 0.85rem; font-weight: bold; border: none; cursor: pointer; color: white;" @click=${(e) => { e.stopPropagation(); if(window.openBrowseModal) window.openBrowseModal(f.filename); }}>📁 Browse</button>
                                ` : ''}
                                <button slot="actions" class="btn-sm ui-draggable-export" style="background: var(--intent-primary); margin: 0; padding: 6px 12px; font-size: 0.85rem; font-weight: bold; border: none; cursor: pointer; color: white;" draggable="true" data-filename=${f.filename} data-fetch-url=${f.filename.includes('/prompts/') ? `/api/${AppStore.getState().activeWorkspace || 'default'}/prompts/resolve?file=${encodeURIComponent(f.filename)}` : `/download/${f.filename}`} @click=${async (e) => {
                                    e.stopPropagation();
                                    const btn = e.target;
                                    const orig = btn.innerText;
                                    btn.innerText = '⏳...';
                                    try {
                                        const res = await fetch(btn.dataset.fetchUrl);
                                        if (!res.ok) throw new Error("Failed to fetch");
                                        const text = await res.text();
                                        const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.style.display = 'none';
                                        a.href = url;
                                        a.download = btn.dataset.filename;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        a.remove();
                                        btn.innerText = "✅ Done";
                                    } catch (err) {
                                        alert("Error downloading file.");
                                        btn.innerText = orig;
                                    } finally {
                                        setTimeout(() => btn.innerText = orig, 2000);
                                    }
                                }}>⬇️ DL</button>
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
                    const container = document.getElementById('sub-gather');
                    if (container && !container.querySelector('insetu-ext-gather')) {
                        container.innerHTML = '<insetu-ext-gather></insetu-ext-gather>';
                    }
                    const litEl = container?.querySelector('insetu-ext-gather');
                    if (litEl && data.forceRefresh) litEl.loadContext();
                }
            }
        }
    });
});