// ext_prompts.js - Prompt Library Extension
import { LitElement, html } from 'lit';
import { AppStore } from '../store.js';
import { mdeInstance } from '../app.js';
import { sharedStyles } from '../shared_styles.js';

export class InSetuExtPrompts extends LitElement {
    static properties = {
        loading: { type: Boolean },
        prompts: { type: Array }
    };
    static styles = [sharedStyles];

constructor() {
        super();
        this.loading = false;
        this.prompts = [];
}

    connectedCallback() {
        super.connectedCallback();
        this.fetchPrompts();
        
        // Strict UDF binding: React seamlessly when the tenant boundaries change
        this._unsub = AppStore.subscribe((state) => state.activeWorkspace, () => {
            this.fetchPrompts();
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
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

    static openNewPromptFolderModal() {
        if (window.openNewFolderModal) {
            const cpPath = AppStore.getState().currentPromptsPath || [];
            const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/";
            window.openNewFolderModal(prefix);
        }
    }

    static openNewPromptModal() {
        if (window.openNewFileModal) {
            const cpPath = AppStore.getState().currentPromptsPath || [];
            const prefix = cpPath.length > 0 ? ".insetu/prompts/" + cpPath.join('/') + "/" : ".insetu/prompts/";
            window.openNewFileModal(prefix);
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
        return html`
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h2 style="margin: 0;">Prompt Library</h2>
                <div style="display: flex; gap: 10px;">

                    <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 4px 12px; font-size: 0.9rem;"
@click=${InSetuExtPrompts.openNewPromptFolderModal}>+ Folder</button>
                    <button class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 4px 12px; font-size: 0.9rem;"
@click=${InSetuExtPrompts.openNewPromptModal}>+ Prompt</button>
                </div>
            </div>
            ${this.loading ? html`<div class="spinner" style="display:block;">Loading prompts...</div>` : html`
                <div @card-clicked=${(e) => { if(e.detail.isSource && window.viewSourceFile) window.viewSourceFile(e.detail.filename, true); }}>
                    <insetu-file-tree 
                        .files=${this.prompts} 
                        stripPrefix="prompts/"
                        basePath=".insetu/prompts/"
                        .currentPath=${AppStore.getState().currentPromptsPath || []}
                        .actions=${[
                            { id: 'copy', label: '📋 Copy', style: 'success' },
                            { id: 'download', label: '⬇️ DL', style: 'primary' }
                        ]}
                        @path-changed=${(e) => AppStore.setState({ currentPromptsPath: e.detail.path })}
                        @action-copy=${(e) => { if(window.fetchAndCopy) window.fetchAndCopy(e.detail.filepath, e.detail.event.target); }}
                        @action-download=${(e) => { if(window.fetchAndDownloadState) window.fetchAndDownloadState(e.detail.filepath, e.detail.event.target); }}>
                    </insetu-file-tree>
                </div>
            `}
        `;
    }
}

customElements.define('insetu-ext-prompts', InSetuExtPrompts);

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
            // Strangler Fig Fallback: Manually mount the Lit tag during the hybrid transition phase if missing
            if (data.parentId === 'context' && data.subId === 'prompts') {
                const container = document.getElementById('sub-prompts');
                if (container && !container.querySelector('insetu-ext-prompts')) {
                    container.innerHTML = '<insetu-ext-prompts></insetu-ext-prompts>';
                }
                const litEl = container?.querySelector('insetu-ext-prompts');
                if (litEl && data.forceRefresh) litEl.fetchPrompts();
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