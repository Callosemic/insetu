// ext_prompts.js - Prompt Library Extension
import { LitElement, html, css } from 'lit';
import { AppStore } from '../store.js';
import { mdeInstance } from '../app.js';
import { sharedStyles } from '../shared_styles.js';
export class InSetuExtPrompts extends LitElement {
    static properties = {
        loading: { type: Boolean },
        prompts: { type: Array },
        searchQuery: { type: String },
        _isMenuOpen: { type: Boolean }
    };
static styles = [sharedStyles];
constructor() {
    super();
    this.loading = false;
    this.prompts = [];
    this.searchQuery = '';
}
connectedCallback() {
    super.connectedCallback();
    this.fetchPrompts();
    // Strict UDF binding: React seamlessly when the tenant boundaries change
    this._unsub = AppStore.subscribe((state) => state.activeWorkspace, () => {
        this.fetchPrompts();
    });
    this._unsubRefresh = AppStore.subscribe((state) => state.promptsForceRefreshTick, (tick) => {
        if (tick) this.fetchPrompts();
    });
}
disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsub) this._unsub();
    if (this._unsubRefresh) this._unsubRefresh();
}

async fetchPrompts() {
    this.loading = true;
    try {
        await syncPromptsState();
        this.prompts = AppStore.getState().gatherOptions.prompts || [];
    } catch (e) {
        console.error("Failed to fetch prompts:", e);
    } finally {
        this.loading = false;
    }
}
static openPromptEmbedModal() {
    if (window.openWorkspaceBrowser) {
        const { gatherOptions } = AppStore.getState();
        const prompts = gatherOptions.prompts || [];
        if (prompts.length === 0) {
            alert("No prompts available to embed. Compile contexts first.");
            return;
        }
        window.openWorkspaceBrowser({
            mode: 'file',
            title: 'Select Prompt to Embed',
            files: prompts,
            autoDrilldown: true,

            callback: (val) => {
                const embedString = `{{include_prompt: ${val}}}`;
                if (window.insertTextAtCursor) {
                    window.insertTextAtCursor(embedString);
                }

            }
        });
    }
}
render() {
    const filteredPrompts = this.searchQuery ? window.fuzzyFilterObjects(this.prompts, this.searchQuery) : this.prompts;
    return html`
        <div class="sticky-header" style="display: flex; align-items: center; gap: 10px;">
            <div class="fuzzy-search-wrapper" style="margin-bottom: 0; flex: 1;">
                <input type="text" placeholder="🔍 Fuzzy search prompts..." .value=${this.searchQuery} @input=${(e) => this.searchQuery = e.target.value}>
                ${this.searchQuery ? html`<button class="fuzzy-search-clear" @click=${() => this.searchQuery = ''}>Clear</button>` : ''}
            </div>
        </div>
        ${this.loading ?
html`<div class="spinner" style="display:block; margin-top: 0;">Loading prompts...</div>` : html`
                <div @card-clicked=${(e) => { if(e.detail.isSource && window.viewSourceFile) window.viewSourceFile(e.detail.filename, true);
}}>
                    <insetu-file-tree 
                        .files=${filteredPrompts} 
                        stripPrefix="prompts/"
                        basePath=".insetu/prompts/"
                        .currentPath=${AppStore.getState().currentPromptsPath || []}
                        .actions=${[
                            { id: 'copy', label: '📋 Copy', style: 'neutral' },
                            { id: 'download', label: '⬇️ DL', style: 'primary' }
                        ]}
                        @path-changed=${(e) => AppStore.setState({ currentPromptsPath: e.detail.path })}
                        @action-copy=${async (e) => {
                            const { filepath, filename, event } = e.detail;
                            const activeWs = AppStore.getState().activeWorkspace || 'default';
                            const dlUrl = `/api/${activeWs}/prompts/resolve?file=${encodeURIComponent(filepath)}`;
                            const orig = event.target.innerText;
                            event.target.innerText = '⏳';
                            try {
                                const res = await fetch(dlUrl);
                                if (!res.ok) throw new Error("Failed to fetch");
                                const text = await res.text();
                                await navigator.clipboard.writeText(text);
                                event.target.innerText = '✅';
                            } catch(err) {
                                alert("Error copying prompt.");
                                event.target.innerText = '❌';
                            } finally {
                                setTimeout(() => event.target.innerText = orig, 2000);
                            }
                        }}
                        @action-download=${async (e) => {
                            const { filepath, filename, event } = e.detail;
                            const activeWs = AppStore.getState().activeWorkspace || 'default';
                            const dlUrl = `/api/${activeWs}/prompts/resolve?file=${encodeURIComponent(filepath)}`;
                            const orig = event.target.innerText;
                            event.target.innerText = '⏳...';
                            try {
                                const res = await fetch(dlUrl);
                                if (!res.ok) throw new Error("Failed to fetch");
                                const text = await res.text();
                                const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.style.display = 'none';
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                a.remove();
                            } catch (err) {
                                alert("Error downloading file.");
                            } finally {
                                event.target.innerText = orig;
                            }
                        }}>
                    </insetu-file-tree>
                </div>
            `}
        `;
    }
}
customElements.define('insetu-ext-prompts', InSetuExtPrompts);
export class InSetuExtPromptsActions extends LitElement {
    static styles = [sharedStyles];

    _openMenu(e) {
        if (!window.inSetu?.ui.Factory?.createDropdown) return;
        window.inSetu.ui.Factory.createDropdown({
            anchor: e.target,
            items: [
                { 
                    label: 'New Folder', 
                    icon: '📁', 
                    onClick: () => { 
                        const cpPath = AppStore.getState().currentPromptsPath || []; 
                        const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/"; 
                        if (window.openNewFolderModal) window.openNewFolderModal(prefix); 
                    } 
                },
                { 
                    label: 'New Prompt', 
                    icon: '📄', 
                    onClick: () => { 
                        const cpPath = AppStore.getState().currentPromptsPath || []; 
                        const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/"; 
                        if (window.openNewFileModal) window.openNewFileModal(prefix); 
                    } 
                }
            ]
        });
    }
    render() {
        return html`<button class="system-action-btn" @click=${this._openMenu}>☰</button>`;
    }
}
customElements.define('insetu-ext-prompts-actions', InSetuExtPromptsActions);

// --- DECLARATIVE SCHEMA PAYLOAD ---
window.ExtensionRegistry.registerExtension('prompts', {
    name: "Prompt Library",
    version: "2.0.0",

    // The OS Bootloader now orchestrates our DOM injection statelessly
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "prompts",
            label: "Prompts",
            order: 3,
            component: "insetu-ext-prompts"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "context",
            targetSub: "prompts",
            component: "insetu-ext-prompts-actions",
            order: 3
        }
    ],

    // Scoped request interceptors explicitly mapped to the centralized Event Bus
    uiHooks: {
        'zone:context-metadata': (fileName) => {
            if (fileName === 'prompts_context.txt') return {
                cat: "Prompts & State",
                desc: "The Master Ingestion Prompt and CLI templates.",
                displayName: 'prompts_context.txt'
            };
            return null;
        },
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'context' && data.subId === 'prompts') {
                if (data.forceRefresh) {
                    window.inSetu.stores.App.setState({ promptsForceRefreshTick: Date.now() });
                }
            }
        },
        'zone:modal-ext-menu': (data) => {
            if (data.isMarkdown && data.filepath && data.filepath.includes('/prompts/')) {
                data.menuItems.push({ label: 'Embed Prompt', icon: '🧩', onClick: InSetuExtPrompts.openPromptEmbedModal });
            }
        },
        'zone:file-fetch-url': (filepath) => {
            if (filepath && filepath.includes('/prompts/')) {
                const activeWs = window.inSetu.stores.App.getState().activeWorkspace || 'default';
                return `/api/${activeWs}/prompts/resolve?file=` + encodeURIComponent(filepath);
            }
            return null;
        },
        'zone:post-file-save': (filepath) => {
            if (filepath && filepath.includes('/prompts/')) syncPromptsState();
            return false;
        },
        'zone:post-file-delete': (filepath) => {
            if (filepath && filepath.includes('/prompts/')) syncPromptsState();
            return false;
        }
    }
});

// --- HEADLESS EXTENSION STATE SYNCHRONIZATION ---
// Executes independently of the UI component to ensure other extensions (like Workflows) 
// always have access to the prompt list via the UDF AppStore.
async function syncPromptsState() {
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    try {
        const res = await fetch(`/api/${activeWs}/prompts/list`);
        if (res.ok) {
            const data = await res.json();
            AppStore.setState(state => ({
                gatherOptions: {
                    ...state.gatherOptions,
                    prompts: data.prompts || [],
                    profileDir: data.profile_dir || ".insetu/profiles/default"
                }
            }));
        }
    } catch (e) {
        console.warn("Headless prompt sync failed:", e);
    }
}

// Initial boot sync
syncPromptsState();