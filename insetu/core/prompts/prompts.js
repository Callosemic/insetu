// prompts.js - Tier 2 Core Prompt Library & Virtual Module Templates
import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
const syncPromptsState = window.inSetu.utils.coalescedAsync(async (forceRewarm = false) => {
    try {
        const st = PromptsStore.getState();
        const warmedSet = forceRewarm ? new Set() : new Set(st.warmedPromptUrls || []);
        const res = await window.inSetu.api.get('prompts/list?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const cleanPrompts = data.prompts || [];
            const currentPrompts = st.prompts;
            if (JSON.stringify(currentPrompts) !== JSON.stringify(cleanPrompts)) {
                PromptsStore.setState({ prompts: cleanPrompts });
            }
            const activeWs = window.inSetu.utils.getActiveWorkspace();
            const urlsToWarm = cleanPrompts
                .filter(p => p && !p.endsWith('/.gitkeep') && !p.endsWith('/.keep'))
                .map(p => `/api/${activeWs}/prompts/resolve?file=${encodeURIComponent(p)}`)
                .filter(u => !warmedSet.has(u));
            if (urlsToWarm.length > 0 && window.inSetu?.stores?.App) {
                urlsToWarm.forEach(u => warmedSet.add(u));
                PromptsStore.setState({ warmedPromptUrls: warmedSet });
                window.inSetu.stores.App.getState().enqueueWarming(urlsToWarm);
            } else if (forceRewarm) {
                PromptsStore.setState({ warmedPromptUrls: warmedSet });
            }
            const gatherStore = window.inSetu?.stores?.Gather;
            if (gatherStore && typeof gatherStore.setState === 'function') {
                const currentOpts = gatherStore.getState().gatherOptions || {};
                if (JSON.stringify(currentOpts.prompts) !== JSON.stringify(cleanPrompts)) {
                    gatherStore.setState(state => ({
                        gatherOptions: {
                            ...(state?.gatherOptions || {}),
                            prompts: cleanPrompts,
                            profileDir: data.profile_dir || ".insetu/data/prompts"
                        }
                    }));
                }
            }
        }
    } catch (e) {
        console.warn("Headless prompt sync failed:", e);
    }
});
export const PromptsStore = createExtensionStore('Prompts', {
    prompts: [],
    warmedPromptUrls: new Set(),
    loading: false,
    searchQuery: '',
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
    static get extensionName() { return 'prompts'; }
    get extName() { return 'prompts'; }
    static properties = {
        loading: { type: Boolean },
        prompts: { type: Array },
        searchQuery: { type: String },
        browsePath: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
    `];
    constructor() {
        super();
        this.loading = false;
        this.prompts = [];
        this.searchQuery = '';
        this.browsePath = [];
    }
    _getSubKey() {
        return this.dataset?.subId || 'prompts:prompts';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            PromptsStore,
            state => ({
                prompts: state.prompts || [],
                loading: state.loading || false,
                searchQuery: state.searchQuery || ''
            }),
            ({ prompts, loading, searchQuery }) => {
                this.prompts = prompts;
                this.loading = loading;
                this.searchQuery = searchQuery;
                this.requestUpdate();
            }
        );
        this.subscribe(
            AppStore,
            state => {
                const subKey = this._getSubKey();
                const tPaths = state.tabBrowsePaths || {};
                return tPaths[subKey] || tPaths['prompts:prompts'] || tPaths['prompts'] || [];
            },
            (browsePath) => {
                this.browsePath = browsePath;
                this.requestUpdate();
            }
        );
        this.browsePath = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath(this._getSubKey()) : [];
        this.subscribe(AppStore, state => state.promptsForceRefreshTick, (tick) => {
            if (tick) PromptsStore.getState().fetchPrompts();
        });
        this.registerGlobalListener('insetu:context-metadata', window, (e) => {
            if (e.detail === 'ctx://contexts/prompts_context.txt') {
                e.inSetuResponses.push({
                    cat: "Prompts & State",
                    desc: "The Master Ingestion Prompt and CLI templates.",
                    displayName: 'prompts_context.txt'
                });
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
            if (rawPrompts.length === 0) e.inSetuResponses.push(['ctx://prompts/.gitkeep']);
            else e.inSetuResponses.push(rawPrompts);
        });
        this.registerGlobalListener('insetu:global-manifest-whitelist', window, (e) => {
            e.inSetuResponses.push(['ctx://prompts/']);
        });
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const touchedPrompt = payload.mutations.some(m => isPromptPath(m.filepath));
            if (touchedPrompt) setTimeout(() => syncPromptsState(true), 300);
        });
        this.registerGlobalListener('insetu:soft-refresh', window, () => {
            syncPromptsState();
        });
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            syncPromptsState();
        });

        PromptsStore.getState().fetchPrompts();
    }
    onWorkspaceLoad(workspaceId) {
        PromptsStore.getState().fetchPrompts();
    }
    onViewActivated() {
        syncPromptsState();
    }
    onForceRefresh() {
        PromptsStore.getState().fetchPrompts();
    }
    static openPromptEmbedModal() {
        if (window.inSetu.ui && window.inSetu.ui.openWorkspaceBrowser) {
            const rawPrompts = PromptsStore.getState().prompts || [];
            if (rawPrompts.length === 0) {
                alert("No prompts available to embed.");
                return;
            }
            window.inSetu.ui.openWorkspaceBrowser({
                mode: 'file',
                title: 'Select Prompt to Embed',
                files: rawPrompts,
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
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 0; position: relative;">
                ${this.loading ? html`<div style="padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--input-bg); flex-shrink: 0;"><sutram-spinner text="Loading prompts..."></sutram-spinner></div>` : ''}
                <insetu-file-tree    
                    style="flex: 1; opacity: ${this.loading ? '0.6' : '1'}; transition: opacity 0.2s ease; pointer-events: ${this.loading ? 'none' : 'auto'};"
                    .files=${this.prompts} 
                    stripPrefix="ctx://prompts/"
                    basePath="ctx://prompts/"
                    .enableSearch=${true}
                    searchPlaceholder="Fuzzy search prompts & .templates..."
                    .currentPath=${this.browsePath}
                    entityType="file:prompt"
                    @card-clicked=${(e) => {
                        if (e.detail.isSource && window.inSetu.vfs.viewSourceFile) {
                            const fn = e.detail.filename || '';
                            const isEditable = !fn.includes('/.templates/') || fn.includes('/.templates/user/');
                            window.inSetu.vfs.viewSourceFile(fn, isEditable);
                        }
                    }}
                    @path-changed=${(e) => AppStore.getState().setBrowsePath(e.detail.path || [], this._getSubKey())}>
                </insetu-file-tree>
            </div>
        `;
    }
}
customElements.define('insetu-ext-prompts', InSetuExtPrompts);
function _buildPromptsMenuActions(slotCfg = {}) {
    const isOffline = window.inSetu?.stores?.App?.getState()?.isOffline;
    if (isOffline) {
        return [{ label: 'Read-Only (Offline)', icon: 'lock', onClick: () => {} }];
    }
    const subKey = slotCfg?.id || 'prompts:prompts';
    const browseParts = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath(subKey) : [];
    const isInsideUserTemplates = browseParts[0] === '.templates' && browseParts[1] === 'user';
    const cpPath = isInsideUserTemplates ? browseParts : browseParts.filter(p => p !== '.templates');
    const prefix = cpPath.length > 0 ? "ctx://prompts/" + cpPath.join('/') + "/" : "ctx://prompts/";
    return [
        {
            label: 'New Folder',
            icon: 'folder-plus',
            onClick: () => {
                if (window.inSetu?.ui?.openNewFolderModal) window.inSetu.ui.openNewFolderModal(prefix);
            }
        },
        {
            label: isInsideUserTemplates ? 'New User Template' : 'New Prompt',
            icon: 'file-plus',
            onClick: () => {
                if (window.inSetu?.ui?.openNewFileModal) window.inSetu.ui.openNewFileModal(prefix);
            }
        },
        ...(!isInsideUserTemplates ? [{
            label: 'New Global User Template',
            icon: 'user-plus',
            onClick: () => {
                if (window.inSetu?.ui?.openNewFileModal) window.inSetu.ui.openNewFileModal('ctx://prompts/.templates/user/');
            }
        }] : [])
    ];
}

function isPromptPath(filepath) {
    if (!filepath) return false;
    const raw = typeof filepath === 'object' ? (filepath.src || filepath.filepath || filepath.oldPath || '') : filepath;
    const str = String(raw).replace(/\\/g, '/');
    return str.includes('prompts') || str.includes('.templates');
}

window.ExtensionRegistry.registerExtension('prompts', {
    name: "Prompt Library",
    version: "2.0.0",
    offline_mode: "read_only",
    entityActions: [
        {
            targetEntity: 'prompt',
            id: 'prompt-fork-template',
            label: (data) => data?.filepath?.startsWith('ws://') ? 'Import to Local Prompts' : 'Fork to Workspace',
            icon: 'git-fork',
            intent: 'highlight',
            group: 'edit',
            vfsBound: false,
            order: 5,
            match: (data) => Boolean(data?.filepath && (data.filepath.includes('/.templates/') || data.filepath.startsWith('ws://'))),
            asyncAction: async (data) => {
                const srcUri = data.filepath;
                const isWs = srcUri.startsWith('ws://');
                const destUri = isWs
                    ? `ctx://prompts/${new window.inSetu.utils.InSetuURI(srcUri).basename}`
                    : srcUri.replace('/.templates/', '/');
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                const res = await window.inSetu.api.request(`/api/${activeWs}/prompts/resolve?file=${encodeURIComponent(srcUri)}`, {}, activeWs);
                if (!res.ok) throw new Error("Failed to read prompt content.");
                const text = await res.text();
                const relDest = window.inSetu.utils.parseURI(destUri).relativePath || destUri;
                await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
                    filepath: destUri,
                    content: text
                }, {
                    successMessage: `Imported prompt to ${relDest}`
                });
                await syncPromptsState();
                if (window.inSetu.vfs?.viewSourceFile) {
                    window.inSetu.vfs.viewSourceFile(destUri, true);
                }
            }
        }
    ],
    customEditors: [
        {
            match: (filepath) => window.inSetu?.stores?.App?.getState()?.isOffline && isPromptPath(filepath),
            onOpen: async (filepath) => {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                const fetchUrl = `/api/${activeWs}/prompts/resolve?file=${encodeURIComponent(filepath)}`;
                try {
                    const res = await window.inSetu.api.request(fetchUrl, {}, activeWs);
                    const text = res.ok ? await res.text() : "Offline cache miss. This prompt was not pre-cached.";
                    if (window.inSetu.ui && window.inSetu.ui.viewTextBlob) {
                        const baseName = new window.inSetu.utils.InSetuURI(filepath).basename;
                        window.inSetu.ui.viewTextBlob(`[Read-Only] ${baseName}`, text, baseName);
                    }
                } catch (e) {
                    alert("Failed to load prompt offline.");
                }
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "prompts",
            label: "Prompts",
            icon: "terminal",
            intent: "neutral",
            order: 3,
            menuStores: ["App"],
            menuActions: _buildPromptsMenuActions,
            component: "insetu-ext-prompts"
        }
    ]
});