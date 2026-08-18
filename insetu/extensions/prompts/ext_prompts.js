// ext_prompts.js - Prompt Library Extension
import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const PromptsStore = createExtensionStore('Prompts', {
    prompts: [],
    loading: false,
    searchQuery: '',
    fetchPrompts: async () => {
        if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('prompts')) return;
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
    static get extensionName() { return 'prompts'; }
    get extName() { return 'prompts'; }
    static properties = {
        loading: { type: Boolean },
        prompts: { type: Array },
        searchQuery: { type: String },
        globalBrowsePath: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        this.loading = false;
        this.prompts = [];
        this.searchQuery = '';
        this.globalBrowsePath = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(PromptsStore, state => {
            this.prompts = state.prompts || [];
            this.loading = state.loading || false;
            this.searchQuery = state.searchQuery || '';
            this.requestUpdate();
        });
        this.subscribe(AppStore, state => {
            this.globalBrowsePath = state.globalBrowsePath || [];
            this.requestUpdate();
        });
        this.globalBrowsePath = AppStore.getState().globalBrowsePath || [];
        this.subscribe(AppStore, state => state.promptsForceRefreshTick, (tick) => {
            if (tick) PromptsStore.getState().fetchPrompts();
        });

        this.registerGlobalListener('insetu:context-metadata', window, (e) => {
            if (e.detail === 'prompts_context.txt') {
                e.inSetuResponses.push({
                    cat: "Prompts & State",
                    desc: "The Master Ingestion Prompt and CLI templates.",
                    displayName: 'prompts_context.txt'
                });
            }
        });

        this.registerGlobalListener('sutram-route-changed', window, (e) => {
            if (e.detail.tab === 'context') {
                syncPromptsState();
            }
        });

        this.registerGlobalListener('insetu:file-fetch-url', window, (e) => {
            if (e.detail && isPromptPath(e.detail)) {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                e.inSetuResponses.push(`/api/${activeWs}/prompts/resolve?file=` + encodeURIComponent(e.detail));
            }
        });

        this.registerGlobalListener('insetu:global-manifest-files', window, (e) => {
            const rawPrompts = PromptsStore.getState().prompts || [];
            if (rawPrompts.length === 0) e.inSetuResponses.push(['.insetu/prompts/.gitkeep']);
            else e.inSetuResponses.push(rawPrompts.map(p => p.startsWith('.insetu/prompts/') ? p : `.insetu/prompts/${p.replace(/^prompts\//, '')}`));
        });

        this.registerGlobalListener('insetu:global-manifest-whitelist', window, (e) => {
            e.inSetuResponses.push(['.insetu/prompts/']);
        });

        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const touchedPrompt = payload.mutations.some(m => isPromptPath(m.filepath));
            if (touchedPrompt) setTimeout(() => syncPromptsState(), 300);
        });

        this.registerGlobalListener('insetu:soft-refresh', window, () => {
            syncPromptsState();
        });

        PromptsStore.getState().fetchPrompts();
    }
    onWorkspaceChanged(newWorkspaceId) {
        PromptsStore.getState().fetchPrompts();
    }
    onForceRefresh() {
        PromptsStore.getState().fetchPrompts();
    }
    static openPromptEmbedModal() {
        if (window.inSetu.ui && window.inSetu.ui.openWorkspaceBrowser) {
            const rawPrompts = PromptsStore.getState().prompts || [];
            if (rawPrompts.length === 0) {
                alert("No prompts available to embed. Compile contexts first.");
                return;
            }

            const cleanPrompts = rawPrompts.map(p => {
                if (p.startsWith(".insetu/prompts/")) return p;
                const corePath = p.replace(/^prompts\//, '');
                return ".insetu/prompts/" + corePath;
            });

            window.inSetu.ui.openWorkspaceBrowser({
                mode: 'file',
                title: 'Select Prompt to Embed',
                files: cleanPrompts,
                autoDrilldown: true,
                callback: (val) => {
                    const embedString = `{{include_prompt: ${val}}}`;
                    if (window.inSetu.editor && window.inSetu.editor.insertTextAtCursor) {
                        window.inSetu.editor.insertTextAtCursor(embedString);
                    }
                }
            });
        }
    }
    render() {
        return html`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 0;" @card-clicked=${(e) => { if(e.detail.isSource && window.inSetu.vfs.viewSourceFile) window.inSetu.vfs.viewSourceFile(e.detail.filename, true); }}>
                ${this.loading ? html`<div class="spinner" style="display:block; padding: 20px;">Loading prompts...</div>` : html`
                    <insetu-file-tree    
                        style="flex: 1;"
                        .files=${this.prompts} 
                        stripPrefix=".insetu/prompts/"
                        basePath=".insetu/prompts/"
                        .enableSearch=${true}
                        searchPlaceholder="🔍 Fuzzy search prompts..."
                        .currentPath=${this.globalBrowsePath}
                        entityType="file:prompt"
                        @path-changed=${(e) => AppStore.setState({ globalBrowsePath: e.detail.path })}>
                    </insetu-file-tree>
                `}
            </div>
        `;
    }
}
customElements.define('insetu-ext-prompts', InSetuExtPrompts);
export class InSetuExtPromptsActions extends InSetuElement {
    get extName() { return 'prompts'; }
    static properties = {
        globalBrowsePath: { type: Array }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.globalBrowsePath = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, state => {
            this.globalBrowsePath = state.globalBrowsePath || [];
        });
        this.globalBrowsePath = AppStore.getState().globalBrowsePath || [];
    }

    get _menuItems() {
        return [
            { 
                label: 'New Folder', 
                icon: '📁', 
                onClick: () => { 
                    const cpPath = this.globalBrowsePath || []; 
                    const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/"; 
                    if (this.ui && this.ui.openNewFolderModal) this.ui.openNewFolderModal(prefix); 
                } 
            },
            { 
                label: 'New Prompt', 
                icon: '📄', 
                onClick: () => { 
                    const cpPath = this.globalBrowsePath || []; 
                    const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/"; 
                    if (this.ui && this.ui.openNewFileModal) this.ui.openNewFileModal(prefix); 
                } 
            }
        ];
    }
    render() {
        return html`
            <sutram-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </sutram-dropdown>
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
    entityActions: [],
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
    ]
});
async function syncPromptsState() {
    if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('prompts')) return;
    try {
        const res = await window.inSetu.api.get('prompts/list?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const rawPrompts = data.prompts || [];
            const cleanPrompts = rawPrompts.map(p => {
                const match = p.match(/\.insetu\/prompts\/(.+)$/) || p.match(/prompts\/(.+)$/);
                return match ? match[1] : p.split('/').pop();
            });
            PromptsStore.setState({ prompts: cleanPrompts });
            const gatherStore = window.inSetu?.stores?.Gather;
            if (gatherStore && typeof gatherStore.setState === 'function') {
                gatherStore.setState(state => ({
                    gatherOptions: {
                        ...(state?.gatherOptions || {}),
                        prompts: rawPrompts,
                        profileDir: data.profile_dir || ".insetu/profiles/default"
                    }
                }));
            }
        }
    } catch (e) {
        console.warn("Headless prompt sync failed:", e);
    }
}