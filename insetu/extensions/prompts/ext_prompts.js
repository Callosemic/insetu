// ext_prompts.js - Prompt Library Extension
import { html, css } from 'lit';
import { AppStore } from '../store.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';
import { sharedStyles } from '../shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export const PromptsStore = createExtensionStore('Prompts', {
    prompts: [],
    loading: false,
    searchQuery: '',
    currentPromptsPath: [],
    fetchPrompts: async () => {
        PromptsStore.setState({ loading: true });
        try {
            await syncPromptsState();
        } catch (e) {
            console.error("Failed to fetch prompts:", e);
        } finally {
            PromptsStore.setState({ loading: false });
        }
    }
});

window.inSetu.stores.Prompts = PromptsStore;

export class InSetuExtPrompts extends InSetuElement {
    get extName() { return 'prompts'; }
    static properties = {
        loading: { type: Boolean },
        prompts: { type: Array },
        searchQuery: { type: String },
        currentPromptsPath: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
        .prompts-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 0; }
    `];

    constructor() {
        super();
        this.loading = false;
        this.prompts = [];
        this.searchQuery = '';
        this.currentPromptsPath = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(PromptsStore, state => {
            this.prompts = state.prompts || [];
            this.loading = state.loading || false;
            this.searchQuery = state.searchQuery || '';
            this.currentPromptsPath = state.currentPromptsPath || [];
            this.requestUpdate();
        });
        this.subscribe(AppStore, state => state.promptsForceRefreshTick, (tick) => {
            if (tick) PromptsStore.getState().fetchPrompts();
        });

        PromptsStore.getState().fetchPrompts();
    }

    onWorkspaceChanged(newWorkspaceId) {
        PromptsStore.getState().fetchPrompts();
    }

    static openPromptEmbedModal() {
        if (window.openWorkspaceBrowser) {
            const gatherOptions = AppStore.getState().gatherOptions || {};
            const rawPrompts = gatherOptions.prompts || [];
            if (rawPrompts.length === 0) {
                alert("No prompts available to embed. Compile contexts first.");
                return;
            }

            const cleanPrompts = rawPrompts.map(p => {
                if (p.startsWith(".insetu/prompts/")) return p;
                const corePath = p.replace(/^prompts\//, '');
                return ".insetu/prompts/" + corePath;
            });

            window.openWorkspaceBrowser({
                mode: 'file',
                title: 'Select Prompt to Embed',
                files: cleanPrompts,
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
        return html`
            <div class="prompts-body" @card-clicked=${(e) => { if(e.detail.isSource && window.viewSourceFile) window.viewSourceFile(e.detail.filename, true); }}>
                ${this.loading ? html`<div class="spinner" style="display:block; padding: 20px;">Loading prompts...</div>` : html`
                    <insetu-file-tree  
                        style="flex: 1;"
                        .files=${this.prompts} 
                        stripPrefix=".insetu/prompts/"
                        basePath=".insetu/prompts/"
                        .enableSearch=${true}
                        searchPlaceholder="🔍 Fuzzy search prompts..."
                        .currentPath=${this.currentPromptsPath}
                        entityType="file:prompt"
                        @path-changed=${(e) => PromptsStore.setState({ currentPromptsPath: e.detail.path })}>
                    </insetu-file-tree>
                `}
            </div>
        `;
    }
}
customElements.define('insetu-ext-prompts', InSetuExtPrompts);

export class InSetuExtPromptsActions extends InSetuElement {
    get extName() { return 'prompts'; }
    static styles = [sharedStyles];

    get _menuItems() {
        return [
            { 
                label: 'New Folder', 
                icon: '📁', 
                onClick: () => { 
                    const cpPath = PromptsStore.getState().currentPromptsPath || []; 
                    const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/"; 
                    if (window.openNewFolderModal) window.openNewFolderModal(prefix); 
                } 
            },
            { 
                label: 'New Prompt', 
                icon: '📄', 
                onClick: () => { 
                    const cpPath = PromptsStore.getState().currentPromptsPath || []; 
                    const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/"; 
                    if (window.openNewFileModal) window.openNewFileModal(prefix); 
                } 
            }
        ];
    }

    render() {
        return html`
            <insetu-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </insetu-dropdown>
        `;
    }
}
customElements.define('insetu-ext-prompts-actions', InSetuExtPromptsActions);

function isPromptPath(filepath) {
    if (!filepath) return false;
    const str = String(typeof filepath === 'object' ? (filepath.src || filepath.filepath || filepath.oldPath || '') : filepath).replace(/\\/g, '/');
    return str.includes('prompts') || str.includes('.insetu');
}

window.ExtensionRegistry.registerExtension('prompts', {
    name: "Prompt Library",
    version: "2.0.0",
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
                syncPromptsState();
                if (data.forceRefresh) {
                    PromptsStore.getState().fetchPrompts();
                }
            }
        },
        'zone:tab-changed': (tabId) => {
            if (tabId === 'context') {
                syncPromptsState();
            }
        },
        'zone:modal-ext-menu': (data) => {
            if (data.isMarkdown && data.filepath && isPromptPath(data.filepath)) {
                data.menuItems.push({ label: 'Embed Prompt', icon: '🧩', onClick: () => InSetuExtPrompts.openPromptEmbedModal() });
            }
        },
        'zone:file-fetch-url': (filepath) => {
            if (filepath && isPromptPath(filepath)) {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                return `/api/${activeWs}/prompts/resolve?file=` + encodeURIComponent(filepath);
            }
            return null;
        },
        'zone:post-file-save': (filepath) => {
            if (isPromptPath(filepath)) syncPromptsState();
            return false;
        },
        'zone:post-file-delete': (filepath) => {
            if (isPromptPath(filepath)) syncPromptsState();
            return false;
        },
        'zone:post-file-move': () => {
            syncPromptsState();
            return false;
        },
        'zone:post-file-rename': () => {
            syncPromptsState();
            return false;
        },
        'zone:post-folder-create': (dirpath) => {
            if (isPromptPath(dirpath)) syncPromptsState();
            return false;
        },
        'zone:post-dir-create': (dirpath) => {
            if (isPromptPath(dirpath)) syncPromptsState();
            return false;
        },
        'zone:soft-refresh': () => {
            syncPromptsState();
            return false;
        }
    }
});

async function syncPromptsState() {
    try {
        const res = await window.inSetu.api.workspace('prompts/list');
        if (res.ok) {
            const data = await res.json();
            const rawPrompts = data.prompts || [];
            const cleanPrompts = rawPrompts.map(p => {
                const match = p.match(/\.insetu\/prompts\/(.+)$/) || p.match(/prompts\/(.+)$/);
                return match ? match[1] : p.split('/').pop();
            });
            PromptsStore.setState({ prompts: cleanPrompts });
            AppStore.setState(state => ({
                gatherOptions: {
                    ...(state.gatherOptions || {}),
                    prompts: rawPrompts,
                    profileDir: data.profile_dir || ".insetu/profiles/default"
                }
            }));
        }
    } catch (e) {
        console.warn("Headless prompt sync failed:", e);
    }
}

syncPromptsState();