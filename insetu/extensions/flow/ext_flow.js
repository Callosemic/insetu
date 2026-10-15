import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
const AppStore = window.inSetu.stores.App;

export function canonicalizeFlowUri(uri) {
    if (!uri) return '';
    let s = String(uri).replace(/\\/g, '/').trim();
    if (s.startsWith('vfs://') || s.startsWith('ctx://')) return s;
    while (s.includes('://')) {
        s = s.split('://').pop();
    }
    if (uri.includes('diffs/') || s.endsWith('_diffs.txt')) return `ctx://diffs/${s.replace(/^diffs\//, '')}`;
    if (uri.includes('workflows/') || s.endsWith('_workflow_context.txt') || (s.startsWith('workflow_') && s.endsWith('_context.txt'))) {
        return `ctx://workflows/${s.replace(/^workflows\//, '')}`;
    }
    if (uri.includes('prompts/')) return `ctx://prompts/${s.replace(/^prompts\//, '')}`;
    if (s.endsWith('_context.txt')) return `ctx://contexts/${s.replace(/^contexts\//, '')}`;
    return `vfs://${s.replace(/^\/+/, '')}`;
}

export const FlowStore = createExtensionStore('Flow', {
    batches: [],
    availableOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: '.insetu/data', profileDir: '.insetu' },
    loading: false,
    searchQuery: '',
    editingBatch: null,
    editForm: {},
    viewingBatch: null,
    viewingBatchPromptText: '',
    responseContent: '',
    showSelectContexts: false,
    tempContexts: [],
    selectingFor: 'includes',
    contextSearchQuery: '',
    fetchBatches: async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('flow')) return;
        if ((FlowStore.getState().batches || []).length === 0) {
            FlowStore.setState({ loading: true });
        }
        try {
            const res = await window.inSetu.api.get('flow/batches');
            if (res.ok) {
                const data = await res.json();
                const nextOptions = {
                    contexts: data.available_contexts || [],
                    diffs: data.available_diffs || [],
                    prompts: data.available_prompts || [],
                    artifactsDir: data.artifacts_dir || '.insetu/data',
                    profileDir: data.profile_dir || '.insetu'
                };
                FlowStore.setState({
                    batches: data.batches || [],
                    availableOptions: nextOptions
                });
                const gatherStore = window.inSetu?.stores?.Gather;
                if (gatherStore && typeof gatherStore.setState === 'function') {
                    gatherStore.setState(state => ({
                        gatherOptions: { ...(state?.gatherOptions || {}), ...nextOptions }
                    }));
                }
            }
        } catch (e) {
            console.error("Error loading batches:", e);
        } finally {
            FlowStore.setState({ loading: false });
        }
    }
}, {
    onEvict: {
        'flow:view': { viewingBatch: null, viewingBatchPromptText: '', responseContent: '' },
        'flow:edit': { editingBatch: null, editForm: {}, showSelectContexts: false }
    }
});
window.inSetu.stores.Flow = FlowStore;
export class InSetuExtFlow extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        batches: { type: Array },
        loading: { type: Boolean },
        activeModules: { type: Array },
        pendingModules: { type: Array },
        isPipelineActive: { type: Boolean },
        searchQuery: { type: String },
        pinnedRepos: { type: Object },
        allRepos: { type: Array },
        _showFilters: { type: Boolean },
        _applyVisibilityFilter: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
    `];
    constructor() {
        super();
        this.batches = [];
        this.loading = false;
        this.searchQuery = '';
        this.pinnedRepos = new Set(['ALL']);
        this.allRepos = [];
        this._applyVisibilityFilter = true;
    }
    onWorkspaceLoad(workspaceId) {
        FlowStore.getState().fetchBatches();
    }
    onViewActivated() {
        FlowStore.getState().fetchBatches();
    }
    async onForceRefresh() {
        if (this.compileSystem) {
            await this.compileSystem(null, true, 'flow_workflows');
        }
        await FlowStore.getState().fetchBatches();
    }
    getBatchRepos(batch) {
        if (!batch || !batch.includes) return [];
        const manifestCtx = AppStore.getState()?.manifest?.ctx || {};
        const repos = new Set();
        batch.includes.forEach(uri => {
            if (uri.startsWith('ctx://')) {
                const meta = manifestCtx[uri]?.meta || {};
                const itemRepos = meta.repos || (meta.repo ? [meta.repo] : []);
                itemRepos.forEach(r => repos.add(r));
            } else {
                // Ensure pure extraction of the volume mount/repo directory string from the VFS payload
                const cleanUri = uri.replace('vfs://', '').split('/')[0];
                if (cleanUri) repos.add(cleanUri);
            }
        });
        return Array.from(repos);
    }
    connectedCallback() {
        super.connectedCallback();
        this._debouncedManifestRefresh = this._debouncedManifestRefresh || this.utils.debounce(() => {
            if (window.inSetu.sys && window.inSetu.sys.refreshManifest) window.inSetu.sys.refreshManifest();
        }, 1000);
        this._debouncedFetchBatches = this._debouncedFetchBatches || this.utils.debounce(() => {
            FlowStore.getState().fetchBatches();
        }, 500);
        const fState = FlowStore.getState();
        this.batches = fState.batches || [];
        this.loading = fState.loading || false;
        this.searchQuery = fState.searchQuery || '';

        this.subscribe(
            FlowStore,
            state => ({
                batches: state.batches || [],
                loading: state.loading || false,
                searchQuery: state.searchQuery || ''
            }),
            ({ batches, loading, searchQuery }) => {
                this.batches = batches;
                this.loading = loading;
                this.searchQuery = searchQuery;
                this.requestUpdate();
            }
        );
        this.registerGlobalListener('insetu:flow:edit-batch', window, (e) => this.openEditBatchModal(e.detail));
        this.registerGlobalListener('insetu:flow:refresh-prompt', window, () => {
            const vb = FlowStore.getState().viewingBatch;
            if (vb) this.openBatchModal(vb);
        });
        this.registerGlobalListener('insetu:git:diffs-refreshed', window, () => {
            this._debouncedManifestRefresh();
        });
        this.subscribe(
            AppStore,
            state => ({
                allRepos: state.allRepos || [],
                pinnedRepos: state.pinnedRepos || new Set(['ALL']),
                activeModules: state.activeModules || [],
                pendingModules: state.pendingModules || [],
                isPipelineActive: state.isPipelineActive || false,
                manifestCtx: state.manifest?.ctx,
                dirtyBuckets: state.dirtyBuckets
            }),
            (slice) => {
                this.allRepos = slice.allRepos;
                this.pinnedRepos = slice.pinnedRepos;
                this.activeModules = slice.activeModules;
                this.pendingModules = slice.pendingModules;
                this.isPipelineActive = slice.isPipelineActive;
                this.requestUpdate();
            }
        );
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const promptTouched = payload.mutations.some(m => m.filepath && (m.filepath.includes('prompts/') || m.filepath.endsWith('.md') || m.filepath.endsWith('.txt')));
            if (promptTouched) {
                this.dispatch('insetu:flow:refresh-prompt');
            }
        });
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            FlowStore.getState().fetchBatches();
        });
        this.registerGlobalListener('insetu:compile-step-complete', window, (e) => {
            if (e.detail?.ext_name === 'flow') {
                if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                    window.inSetu.sys.refreshManifest().then(() => {
                        FlowStore.getState().fetchBatches();
                    });
                }
            }
        });

        const as = AppStore.getState ? AppStore.getState() : {};
        this.pinnedRepos = as.pinnedRepos || new Set(['ALL']);
        this.allRepos = as.allRepos || [];
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    openEditBatchModal(batch = null) {
        const savedPrompt = batch && batch.include_prompt ? batch.include_prompt : '';
        const gatherOptions = FlowStore.getState().availableOptions || window.inSetu.stores.Gather?.getState()?.gatherOptions || {};
        const cleanSavedPrompt = savedPrompt.replace(/^\.insetu\/prompts\//, '').replace(/^prompts\//, '');
        const availablePrompts = (gatherOptions.prompts || []).map(p => p.replace(/^\.insetu\/prompts\//, '').replace(/^prompts\//, ''));
        const matchedPrompt = (() => {
            if (cleanSavedPrompt && !availablePrompts.includes(cleanSavedPrompt)) {
                return availablePrompts.find(p => p.endsWith(cleanSavedPrompt)) || cleanSavedPrompt;
            }
            return cleanSavedPrompt;
        })();

        const editForm = {
            id: batch ? batch.id : '',
            title: batch ? batch.title : '',
            domain: batch && batch.domain ? batch.domain : 'Workflows',
            includes: batch && batch.includes ? batch.includes.map(canonicalizeFlowUri) : [],
            showIfExists: batch && batch.show_if_exists ? batch.show_if_exists.map(canonicalizeFlowUri) : [],
            showIfMissing: batch && batch.show_if_missing ? batch.show_if_missing.map(canonicalizeFlowUri) : [],
            hasPrompt: batch ? !!batch.include_prompt : false,
            prompt: matchedPrompt,
            hasResponse: batch ? !!batch.response_path : false,
            responsePath: batch && batch.response_path ? batch.response_path : '',
            archivePath: batch && batch.archive_path ? batch.archive_path : ''
        };
        FlowStore.setState({ editingBatch: batch, editForm });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'flow:edit',
                component: 'insetu-flow-edit-projection',
                label: editForm.id ? `Edit Batch: ${editForm.title}` : 'Create New Batch',
                icon: 'edit-3',
                intent: 'primary',
                extName: 'flow',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
    }
    openBatchModal(batch) {
        FlowStore.setState({
            viewingBatch: batch,
            viewingBatchPromptText: 'Loading prompt...',
            responseContent: ''
        });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'flow:view',
                component: 'insetu-flow-view-projection',
                label: `Batch Workflow: ${batch.title || batch.id}`,
                icon: 'workflow',
                intent: 'primary',
                extName: 'flow',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
        const gatherOptions = FlowStore.getState().availableOptions || window.inSetu.stores.Gather?.getState()?.gatherOptions || {};
        if (batch.include_prompt) {
            const prompts = gatherOptions.prompts || [];
            const promptPath = prompts.includes(batch.include_prompt) 
                ? batch.include_prompt 
                : (prompts.find(p => p.endsWith(batch.include_prompt)) || batch.include_prompt);
            this.api.workspace.get(`prompts/resolve?file=${encodeURIComponent(promptPath)}`)
                .then(res => res.ok ? res.text() : Promise.reject(new Error("Prompt resolution failed")))
                .then(text => { FlowStore.setState({ viewingBatchPromptText: text }); })
                .catch(err => { FlowStore.setState({ viewingBatchPromptText: `[Error: ${err.message}]` }); });
        }
    }
    render() {
        const isPipelineRunning = (this.activeModules || []).includes('flow') || (this.pendingModules || []).includes('flow');
        const isFlowLoading = this.loading || isPipelineRunning;

        const appStore = window.inSetu?.stores?.App || (typeof AppStore !== 'undefined' ? AppStore : null);
            const appState = appStore?.getState ? appStore.getState() : {};
            const categoryOrder = appState?.categoryOrder || [];
            const manifest = appState?.manifest?.ctx || {};
            const gatherOptions = FlowStore.getState().availableOptions || window.inSetu?.stores?.Gather?.getState()?.gatherOptions || {};
            const repoFilteredBatches = this.batches.map(b => {
                const actualFilename = `ctx://workflows/workflow_${b.id}_context.txt`;
                const manifestObj = manifest[actualFilename] || {};
                const repos = (manifestObj.meta?.repos && manifestObj.meta.repos.length > 0)
                    ? manifestObj.meta.repos
                    : this.getBatchRepos(b);
                return { ...b, _repos: repos, _filename: actualFilename };
            }).filter(b => {
                if (this._applyVisibilityFilter) {
                    // Literal existence check: Must be physically present in the active manifest or prompt list
                    const checkLiteralExists = (f) => {
                        if (manifest[f]) return true;
                        return (gatherOptions?.prompts || []).includes(f) || (gatherOptions?.prompts || []).some(p => p.endsWith(f));
                    };
                    const existsArr = Array.isArray(b.show_if_exists) ? b.show_if_exists : (b.show_if_exists ? [b.show_if_exists] : []);
                    if (existsArr.length > 0) {
                        if (!existsArr.some(checkLiteralExists)) return false;
                    }
                    const missingArr = Array.isArray(b.show_if_missing) ? b.show_if_missing : (b.show_if_missing ? [b.show_if_missing] : []);
                    if (missingArr.length > 0) {
                        if (!missingArr.every(f => !checkLiteralExists(f))) return false;
                    }
                }

                if (this.pinnedRepos.has('ALL')) return true;
                return Array.from(this.pinnedRepos).some(pr => 
                    (b._repos && b._repos.includes(pr)) || 
                    b.id.includes(pr) || 
                    (b.title && b.title.toLowerCase().includes(pr.toLowerCase()))
                );
            });
            const filteredBatches = this.searchQuery 
                ? window.inSetu.utils.fuzzyFilterObjects(repoFilteredBatches, this.searchQuery, b => `${(b._repos || []).join(' ')} ${b.title} ${b.id} ${b.domain}`) 
                : repoFilteredBatches;
            try {
                return html`
                    <sutram-toolbar
                        searchPlaceholder="Fuzzy search workflows..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => FlowStore.setState({ searchQuery: e.detail.value })}
                    .enableFilterDropdown=${true}
                    .activeFilters=${[...Array.from(this.pinnedRepos), ...(this._applyVisibilityFilter ? ['Visibility: ON'] : [])]}>
                    <div slot="filters" style="display: flex; flex-direction: column;">
                        <insetu-repo-filter
                            label="📌 Repos:"
                            .repos=${this.allRepos}
                            .activeRepos=${Array.from(this.pinnedRepos)}
                            @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                        </insetu-repo-filter>
                        <div style="padding: 10px 15px; display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--border);">
                            <sutram-toggle
                                label="Apply Visibility Requirements"
                                ?flush=${true}
                                .checked=${this._applyVisibilityFilter}
                                @sutram-input-changed=${(e) => { this._applyVisibilityFilter = e.detail.value; this.requestUpdate(); }}>
                            </sutram-toggle>
                        </div>
                    </div>
                </sutram-toolbar>
            <sutram-scroll-view>
                        ${this.batches.length === 0 ? html`<div style="padding: 20px 0;"><sutram-empty-state text="No workflow batches defined."></sutram-empty-state></div>` : ''}
                        ${this.batches.length > 0 && filteredBatches.length === 0 ? html`<div style="padding: 20px 0;"><sutram-empty-state text="All workflows hidden by current filters."></sutram-empty-state></div>` : ''}
                        ${(() => {
                            const groups = {};
                            filteredBatches.forEach(b => {
                                const cat = b.domain || 'Workflows';
                                if (!groups[cat]) groups[cat] = [];
                                groups[cat].push(b);
                            });
                            const sortedCats = Object.keys(groups).sort((a, b) => {
                                const idxA = categoryOrder.indexOf(a);
                                const idxB = categoryOrder.indexOf(b);
                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                if (idxA !== -1) return -1;
                                if (idxB !== -1) return 1;
                                return a.localeCompare(b);
                            });
                            return sortedCats.map(cat => html`
                                <sutram-collapsible 
                                    titleText=${cat} 
                                    intent="neutral" 
                                    ?open=${true}>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        ${groups[cat].map(b => {
                                            const filename = b._filename;
                                            const manifestObj = AppStore.getState().manifest?.ctx?.[filename] || {};
                                            const meta = manifestObj.meta || {};
                                            const sizeStr = this.utils.formatArtifactSize(meta);
                                            const repoStr = b._repos && b._repos.length > 0 ? `[${b._repos.join(', ')}] ` : '';
                                            const isDirty = (() => {
                                                const manifestCtx = AppStore.getState().manifest?.ctx || {};
                                                const addr = window.inSetu.utils.BucketAddress.fromFilepath(filename, manifestCtx[filename]?.meta);
                                                if ((AppStore.getState().dirtyBuckets || new Set()).has(addr.key)) return true;
                                                return (b.includes || []).some(inc => {
                                                    const uri = window.inSetu.utils.parseURI(inc);
                                                    const incAddr = (uri.scheme === 'vfs') 
                                                        ? window.inSetu.utils.BucketAddress.fromVfsPath(inc) 
                                                        : window.inSetu.utils.BucketAddress.fromFilepath(inc, manifestCtx[inc]?.meta);
                                                    return (AppStore.getState().dirtyBuckets || new Set()).has(incAddr.key);
                                                });
                                            })();
                                            const isLocked = isFlowLoading && isDirty;
                                            const statusIcon = isLocked ? 'loader' : (isDirty ? 'construction' : 'package');
                                            return html`
                                                <sutram-card
                                                        style="opacity: ${isLocked ? '0.6' : '1'}; pointer-events: ${isLocked ? 'none' : 'auto'}; transition: opacity 0.2s ease;"
                                                        .filename=${b.id}
                                                        .titleText=${b.title || b.id}
                                                        .descriptionText=${`${(b.includes || []).length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}`}
                                                        .detailPrefix=${repoStr}
                                                        .detailText=${filename}
                                                        .detailSuffix=${sizeStr ? ` | ${sizeStr}` : ''}
                                                        icon=${statusIcon}
                                                        intent=${isDirty ? "warning" : "primary"}
                                                        .entityType=${'file:workflow_batch'}
                                                        .entityData=${{  
                                                            ...b, 
                                                            filepath: filename,
                                                            outdated: isDirty,
                                                            suppress: ['file-edit'], 
                                                            chunks: window.inSetu?.utils?.extractManifestFiles ? window.inSetu.utils.extractManifestFiles(AppStore.getState().manifest || {}, filename, 'ctx') : [filename]  
                                                        }}
                                                        @card-clicked=${() => this.openBatchModal(b)}>
                                                </sutram-card>
                                            `;
                                        })}
                                    </div>
                                </sutram-collapsible>
                            `);
                        })()}
            </sutram-scroll-view>
        `;
    } catch (err) {
            console.error("Flow UI Render Crash:", err);
            return html`
                <div style="padding: 20px; color: var(--intent-danger); background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 6px; margin: 20px;">
                    <h3 style="margin-top: 0;">💥 UI Render Crash</h3>
                    <p>The Flow interface encountered a fatal data corruption error and could not render.</p>
                    <pre style="background: var(--bg); padding: 10px; border-radius: 4px; overflow-x: auto;">${err.stack || err.message}</pre>
                </div>
            `;
        }
    }
}
customElements.define('insetu-ext-flow', InSetuExtFlow);

export class InSetuFlowViewProjection extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        viewingBatch: { type: Object },
        viewingBatchPromptText: { type: String },
        responseContent: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        const st = FlowStore.getState();
        this.viewingBatch = st.viewingBatch || null;
        this.viewingBatchPromptText = st.viewingBatchPromptText || '';
        this.responseContent = st.responseContent || '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FlowStore,
            state => ({
                viewingBatch: state.viewingBatch,
                viewingBatchPromptText: state.viewingBatchPromptText || '',
                responseContent: state.responseContent || ''
            }),
            ({ viewingBatch, viewingBatchPromptText, responseContent }) => {
                this.viewingBatch = viewingBatch;
                this.viewingBatchPromptText = viewingBatchPromptText;
                this.responseContent = responseContent;
                this.requestUpdate();
            }
        );
    }
    async saveBatchResponse() {
        const content = this.responseContent || '';
        if (!content.trim()) return alert('Please paste a response.');

        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
        const dStr = localISOTime.replace(/-/g, '').replace(/:/g, '').replace('T', '_').split('.')[0];
        const finalPath = this.viewingBatch.response_path.replace('{date}', dStr);
        const normPath = this.vfs?.normalizeVfsURI ? this.vfs.normalizeVfsURI(finalPath) : `vfs://${finalPath.replace(/^\/+/, '')}`;

        const payload = {
            filepath: normPath,
            content: content,
            original_response_path: this.viewingBatch.response_path
        };
        if (this.viewingBatch.archive_path) {
            payload.archive_path = this.vfs?.normalizeVfsURI
                ? this.vfs.normalizeVfsURI(this.viewingBatch.archive_path)
                : `vfs://${this.viewingBatch.archive_path.replace(/^\/+/, '')}`;
        }

        try {
            await this.sys.executeWorkspaceMutation('fs/save', payload);
            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Success!", 2000);
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('flow:view');
            }
        } catch (e) {
            console.error("Batch save failed", e);
        }
    }
    render() {
        if (!this.viewingBatch) return html``;
        const gatherOptions = window.inSetu.stores.Gather?.getState()?.gatherOptions || {};
        return html`
            <sutram-scroll-view padding="15px" style="gap: 18px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Compiled Context Payload</h4>
                    <div style="background: var(--input-bg); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--border); margin-bottom: 10px; max-height: 220px; overflow-y: auto;">
                        <ul style="margin: 0; font-family: monospace; font-size: 0.85rem; color: var(--text); opacity: 0.8; padding-left: 20px;">
                            ${(this.viewingBatch.includes || []).length > 0 ? this.viewingBatch.includes.map(inc => html`<li style="padding: 2px 0; word-break: break-all;">${inc}</li>`) : html`<li style="color: var(--intent-danger); list-style: none; margin-left: -20px;">No files mapped to this batch.</li>`}
                        </ul>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; width: 100%;">
                        ${(() => {
                            const baseFile = `ctx://workflows/workflow_${this.viewingBatch.id}_context.txt`;
                            const manifestCtx = AppStore.getState().manifest?.ctx || {};
                            const manifestObj = manifestCtx[baseFile] || {};
                            return html`
                                <sutram-entity-actions 
                                    ?scrollable=${true}
                                    .entityType=${'file'} 
                                    .entityData=${{ 
                                        filepath: baseFile, 
                                        chunks: manifestObj.chunks || [baseFile],
                                        showOnly: ['file-copy', 'file-download', 'file-share', 'file-view-parts']
                                    }}>
                                </sutram-entity-actions>
                            `;
                        })()}
                    </div>
                </div>
                ${this.viewingBatch.include_prompt ? html`
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Instruction Prompt</h4>
                        <sutram-textarea readonly style="width: 100%; min-height: 150px; margin-bottom: 10px;" .value=${this.viewingBatchPromptText}></sutram-textarea>
                        <div style="display: flex; gap: 10px;">
                            ${(() => {
                                const prompts = gatherOptions.prompts || [];
                                const promptPath = prompts.includes(this.viewingBatch.include_prompt) ? this.viewingBatch.include_prompt : (prompts.find(p => p.endsWith(this.viewingBatch.include_prompt)) || `ctx://prompts/${this.viewingBatch.include_prompt.replace(/^ctx:\/\/prompts\//, '')}`);
                                return html`
                                    <sutram-entity-actions 
                                        ?scrollable=${true}
                                        .entityType=${'file:prompt'} 
                                        .entityData=${{ 
                                            filepath: promptPath, 
                                            isFS: true,
                                            transientContent: this.viewingBatchPromptText,
                                            showOnly: ['file-copy', 'file-edit']
                                        }}>
                                    </sutram-entity-actions>
                                `;
                            })()}
                        </div>
                    </div>
                ` : ''}
                ${this.viewingBatch.response_path ? html`
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: var(--text); font-size: 1.05rem;">3. LLM Response Integration</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste response to save to: <code style="word-break: break-all; color: var(--intent-success);">${this.viewingBatch.response_path}</code></p>
                        <sutram-textarea id="batch-response-text" placeholder="Paste LLM response here..." .value=${this.responseContent || ''} .monospace=${true} .rows=${10} @sutram-input-changed=${(e) => FlowStore.setState({ responseContent: e.detail.value })}></sutram-textarea>
                        <sutram-async-btn intent="success" icon="save" label="Save Response" style="width: 100%; display: block; --btn-padding: 15px; --btn-font-size: 1.1rem;" .onClick=${this.saveBatchResponse.bind(this)}></sutram-async-btn>
                    </div>
                ` : ''}
            </sutram-scroll-view>
        `;
    }
}
customElements.define('insetu-flow-view-projection', InSetuFlowViewProjection);

export class InSetuFlowEditProjection extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        editingBatch: { type: Object },
        editForm: { type: Object },
        showSelectContexts: { type: Boolean },
        tempContexts: { type: Array },
        selectingFor: { type: String },
        contextSearchQuery: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        const st = FlowStore.getState();
        this.editingBatch = st.editingBatch || null;
        this.editForm = st.editForm || {};
        this.showSelectContexts = !!st.showSelectContexts;
        this.tempContexts = st.tempContexts || [];
        this.selectingFor = st.selectingFor || 'includes';
        this.contextSearchQuery = st.contextSearchQuery || '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FlowStore,
            state => ({
                editingBatch: state.editingBatch,
                editForm: state.editForm || {},
                showSelectContexts: !!state.showSelectContexts,
                tempContexts: state.tempContexts || [],
                selectingFor: state.selectingFor || 'includes',
                contextSearchQuery: state.contextSearchQuery || ''
            }),
            (slice) => {
                this.editingBatch = slice.editingBatch;
                this.editForm = slice.editForm;
                this.showSelectContexts = slice.showSelectContexts;
                this.tempContexts = slice.tempContexts;
                this.selectingFor = slice.selectingFor;
                this.contextSearchQuery = slice.contextSearchQuery;
                this.requestUpdate();
            }
        );
    }
    _updateForm(patch) {
        FlowStore.setState(s => ({ editForm: { ...(s.editForm || {}), ...patch } }));
    }
    async deleteEditBatch() {
        const targetId = this.editingBatch?.id;
        if (!targetId || !confirm("Delete this workflow batch?")) return;
        try {
            const res = await this.api.post('batches/delete', { id: targetId }, { collapseKey: `flow:batch:delete:${targetId}` });
            if (res.ok) {
                const responseData = await res.json();
                if (Array.isArray(responseData.batches)) {
                    FlowStore.setState({ batches: responseData.batches });
                } else {
                    FlowStore.setState(s => ({ batches: (s.batches || []).filter(b => b.id !== targetId) }));
                }
                if (window.Sutram?.stores?.Layout) {
                    window.Sutram.stores.Layout.getState().closeWindow('flow:edit');
                }
                if (responseData.job_id && this.api.pollJob) {
                    this.api.pollJob(responseData.job_id, {
                        onComplete: async () => {
                            if (window.inSetu.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
                            await FlowStore.getState().fetchBatches();
                        }
                    });
                } else if (window.inSetu.sys?.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert("Failed to delete batch: " + (err.error || res.statusText));
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    async saveEditBatch() {
        const originalId = (this.editingBatch?.id || '').trim();
        const title = (this.editForm.title || '').trim();
        const domain = (this.editForm.domain || '').trim() || "Workflows";

        if (!title) return alert("Title is required.");

        const currentBatches = FlowStore.getState().batches || [];
        const baseId = this.utils.slugify(title) || `batch_${Date.now()}`;
        const newId = (() => {
            const isTaken = (id) => currentBatches.some(b => b.id === id && b.id !== originalId);
            if (!isTaken(baseId)) return baseId;
            return Array.from({length: 100}).map((_, i) => `${baseId}_${i+1}`).find(id => !isTaken(id)) || `${baseId}_${Date.now()}`;
        })();

        const payload = { id: newId, title, domain, includes: [...(this.editForm.includes || [])] };
        if (originalId) payload.original_id = originalId;

        if (this.editForm.showIfExists && this.editForm.showIfExists.length > 0) payload.show_if_exists = [...this.editForm.showIfExists];
        if (this.editForm.showIfMissing && this.editForm.showIfMissing.length > 0) payload.show_if_missing = [...this.editForm.showIfMissing];
        if (this.editForm.hasPrompt && this.editForm.prompt) payload.include_prompt = this.editForm.prompt;
        if (this.editForm.hasResponse && this.editForm.responsePath) {
            payload.response_path = this.editForm.responsePath.trim();
            if (this.editForm.archivePath) payload.archive_path = this.editForm.archivePath.trim();
        }
        try {
            const res = await this.api.post('batches/save', payload, { collapseKey: `flow:batch:save:${newId}` });
            if (res.ok) {
                const responseData = await res.json();
                const savedBatch = { ...payload };
                delete savedBatch.original_id;

                if (Array.isArray(responseData.batches)) {
                    FlowStore.setState({ batches: responseData.batches });
                } else {
                    const isExisting = Boolean(originalId) && currentBatches.some(b => b.id === originalId);
                    if (isExisting) {
                        FlowStore.setState({ batches: currentBatches.map(b => b.id === originalId ? savedBatch : b) });
                    } else {
                        FlowStore.setState({ batches: [...currentBatches, savedBatch] });
                    }
                }
                if (window.Sutram?.stores?.Layout) {
                    window.Sutram.stores.Layout.getState().closeWindow('flow:edit');
                }
                if (responseData.job_id && this.api.pollJob) {
                    this.api.pollJob(responseData.job_id, {
                        onComplete: async () => {
                            if (window.inSetu.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
                            await FlowStore.getState().fetchBatches();
                        }
                    });
                } else if (window.inSetu.sys?.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert("Failed to save batch: " + (err.error || res.statusText));
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    render() {
        const appState = AppStore.getState ? AppStore.getState() : {};
        const manifest = appState?.manifest?.ctx || {};
        const gatherOptions = FlowStore.getState().availableOptions || window.inSetu?.stores?.Gather?.getState()?.gatherOptions || {};
        const allFiles = [
            ...(gatherOptions?.diffs || []), 
            ...(gatherOptions?.contexts || []),
            ...(gatherOptions?.prompts || [])
        ];
        const includes = this.editForm?.includes || [];
        const showIfExists = this.editForm?.showIfExists || [];
        const showIfMissing = this.editForm?.showIfMissing || [];

        const renderIncludeRow = (inc, idx, listKey) => {
            const isSystem = inc.startsWith('ctx://');
            const isContextOrDiff = isSystem || inc.includes('contexts/') || inc.includes('diffs/') || inc.endsWith('_context.txt') || inc.endsWith('_diffs.txt');
            const isMissing = isContextOrDiff && !allFiles.includes(inc);
            const candidate = (listKey === 'includes' && isMissing) ? (() => {
                const base = inc.split('/').pop().replace(/^ctx:\/\//, '');
                return allFiles.find(f => f === `ctx://contexts/${base}` || f === `ctx://diffs/${base}` || f.endsWith(base));
            })() : null;
            const iconName = inc.includes('diffs/') ? "git-pull-request" : (inc.includes('contexts/') ? "package" : (inc.endsWith('/') || (!isSystem && !inc.includes('.')) ? "folder" : "file-text"));

            return html`
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; align-items: center; flex: 1; min-width: 0; gap: 8px; flex-wrap: wrap;">
                        <yv-icon name="${iconName}" style="width: 14px; height: 14px; color: var(--text-muted); flex-shrink: 0;"></yv-icon>
                        <span style="font-family: monospace; font-size: 0.85rem; color: ${isMissing ? 'var(--intent-danger)' : (isSystem ? 'var(--intent-primary)' : 'var(--text)')}; word-break: break-all; text-decoration: ${isMissing ? 'line-through' : 'none'}; opacity: ${isMissing ? '0.8' : '1'}; font-weight: ${isSystem ? 'bold' : 'normal'};">${inc}</span>${isMissing ? html`<span style="font-size: 0.7rem; background: transparent; color: var(--intent-danger); border: 1px solid var(--intent-danger); padding: 1px 6px; border-radius: 10px; font-weight: bold; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;"><yv-icon name="alert-triangle" style="width: 10px; height: 10px;"></yv-icon> Missing</span>` : ''}
                        ${candidate ? html`
                            <sutram-btn size="sm" intent="success" icon="sparkles" label="Fix → ${candidate}" style="margin: 0; padding: 2px 8px; font-size: 0.75rem;" @click=${() => {
                                const nextList = [...(this.editForm[listKey] || [])];
                                nextList[idx] = candidate;
                                this._updateForm({ [listKey]: nextList });
                            }}></sutram-btn>
                        ` : ''}
                    </div>
                    <sutram-btn size="sm" variant="text" intent="danger" label="×" style="padding: 0 5px; flex-shrink: 0;" @click=${() => {
                        const nextList = [...(this.editForm[listKey] || [])];
                        nextList.splice(idx, 1);
                        this._updateForm({ [listKey]: nextList });
                    }}></sutram-btn>
                </div>
            `;
        };

        return html`
            <sutram-scroll-view padding="15px" style="gap: 15px;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 150px;">
                        <sutram-input label="Batch Title" .value=${this.editForm?.title || ''} placeholder="e.g. API Wrap-Up" 
                            @sutram-input-changed=${(e) => {
                                this._updateForm({ title: e.detail.value });
                            }}></sutram-input>
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <sutram-input label="Domain" .value=${this.editForm?.domain || 'Workflows'} placeholder="e.g. Workflows"
                            @sutram-input-changed=${(e) => this._updateForm({ domain: e.detail.value })}></sutram-input>
                    </div>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Includes (Contexts & Diffs)</h4>
                    <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                        ${includes.length === 0 ? html`<sutram-empty-state text="No files selected."></sutram-empty-state>` : includes.map((inc, idx) => renderIncludeRow(inc, idx, 'includes'))}
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <sutram-btn size="sm" intent="primary" icon="package" label="Select Contexts" @click=${() => FlowStore.setState({ selectingFor: 'includes', tempContexts: [...includes], showSelectContexts: true })}></sutram-btn>
                        <sutram-btn size="sm" intent="neutral" icon="file-plus" label="File" @click=${() => {
                            if (this.ui && this.ui.openWorkspaceBrowser) {
                                this.ui.openWorkspaceBrowser({
                                    mode: 'file',
                                    title: 'Select File',
                                    callback: (filepath) => {
                                        if (filepath) {
                                            const uri = (filepath.startsWith('vfs://') || filepath.startsWith('ctx://')) ? filepath : `vfs://${filepath.replace(/^\/+/, '')}`;
                                            if (!includes.includes(uri)) {
                                                this._updateForm({ includes: [...includes, uri] });
                                            }
                                        }
                                    }
                                });
                            }
                        }}></sutram-btn>
                        <sutram-btn size="sm" intent="neutral" icon="folder-plus" label="Folder" @click=${() => {
                            if (this.ui && this.ui.openWorkspaceBrowser) {
                                this.ui.openWorkspaceBrowser({
                                    mode: 'folder',
                                    title: 'Select Folder',
                                    callback: (folderpath) => {
                                        if (folderpath) {
                                            let uri = (folderpath.startsWith('vfs://') || folderpath.startsWith('ctx://')) ? folderpath : `vfs://${folderpath.replace(/^\/+/, '')}`;
                                            if (!uri.endsWith('/')) uri += '/';
                                            if (!includes.includes(uri)) {
                                                this._updateForm({ includes: [...includes, uri] });
                                            }
                                        }
                                    }
                                });
                            }
                        }}></sutram-btn>
                    </div>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Visibility Prerequisites (Optional)</h4>
                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Show ONLY if at least one of these exist:</label>
                    <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                        ${showIfExists.length === 0 ? html`<sutram-empty-state text="No requirements."></sutram-empty-state>` : showIfExists.map((inc, idx) => renderIncludeRow(inc, idx, 'showIfExists'))}
                    </div>
                    <sutram-btn size="sm" intent="neutral" icon="plus" label="Add Required Contexts" style="margin: 0 0 15px 0;" @click=${() => FlowStore.setState({ selectingFor: 'exists', tempContexts: [...showIfExists], showSelectContexts: true })}></sutram-btn>
                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Show ONLY if all of these are missing:</label>
                    <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                        ${showIfMissing.length === 0 ? html`<sutram-empty-state text="No requirements."></sutram-empty-state>` : showIfMissing.map((inc, idx) => renderIncludeRow(inc, idx, 'showIfMissing'))}
                    </div>
                    <sutram-btn size="sm" intent="neutral" icon="plus" label="Add Missing Contexts" style="margin: 0 0 15px 0;" @click=${() => FlowStore.setState({ selectingFor: 'missing', tempContexts: [...showIfMissing], showSelectContexts: true })}></sutram-btn>
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <sutram-toggle .checked=${this.editForm?.hasPrompt} @sutram-input-changed=${(e) => this._updateForm({ hasPrompt: e.detail.value })}></sutram-toggle>
                        <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">3. Instruction Prompt</h4>
                    </div>
                    ${this.editForm?.hasPrompt ? html`
                        <div style="display: flex; gap: 8px;">
                            <sutram-select style="flex: 1;" .value=${this.editForm.prompt} .options=${[{value: '', label: '-- Select a Prompt --'}, ...(gatherOptions.prompts || []).map(p => { const v = p.replace(/^\.insetu\/prompts\//, '').replace(/^prompts\//, ''); return {value: v, label: v}; })]} @sutram-input-changed=${(e) => this._updateForm({ prompt: e.detail.value })}></sutram-select>
                        </div>
                    ` : ''}
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <sutram-toggle .checked=${this.editForm?.hasResponse} @sutram-input-changed=${(e) => this._updateForm({ hasResponse: e.detail.value })}></sutram-toggle>
                        <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">4. Response Text Box</h4>
                    </div>
                    ${this.editForm?.hasResponse ? html`
                        <sutram-input label="Response Path" .value=${this.editForm.responsePath} placeholder="e.g. sotu/sotu_{date}.current.md" style="font-family: monospace;" @sutram-input-changed=${(e) => this._updateForm({ responsePath: e.detail.value })}></sutram-input>
                        <sutram-input label="Archive Path (Optional)" .value=${this.editForm.archivePath} placeholder="e.g. sotu/archive/" style="font-family: monospace;" @sutram-input-changed=${(e) => this._updateForm({ archivePath: e.detail.value })}></sutram-input>
                    ` : ''}
                </div>
            </sutram-scroll-view>
            <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                ${this.editingBatch?.id ? html`<sutram-async-btn intent="danger" icon="trash-2" label="Delete Batch" style="flex: 1; margin: 0;" .onClick=${this.deleteEditBatch.bind(this)}></sutram-async-btn>` : ''}
                <sutram-async-btn intent="primary" icon="save" label="Save Batch" style="flex: 2; margin: 0;" .onClick=${this.saveEditBatch.bind(this)}></sutram-async-btn>
            </div>
            ${this.showSelectContexts ? html`
                <sutram-modal ?open=${true} titleText="Select Contexts" @sutram-modal-closed=${() => FlowStore.setState({ showSelectContexts: false, contextSearchQuery: '' })}>
                    <div slot="body" style="display: contents;">
                        <sutram-input placeholder="Fuzzy search contexts..." .value=${this.contextSearchQuery} @sutram-input-changed=${(e) => FlowStore.setState({ contextSearchQuery: e.detail.value })}></sutram-input>
                        <div style="display: flex; flex-direction: column; gap: 5px; overflow-y: auto; flex: 1;">
                            ${(this.contextSearchQuery ? this.utils.fuzzyFilterObjects(allFiles, this.contextSearchQuery) : allFiles).map(file => {
                                const systemUri = file;
                                const isChecked = this.tempContexts.includes(systemUri);
                                const isDiff = file.includes('diffs/');
                                const manifestObj = manifest[file] || {};
                                const meta = manifestObj.meta || {};
                                const sizeStr = this.utils.formatArtifactSize(meta);

                                return html`
                                    <div style="display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border); background: var(--bg);">
                                        <sutram-toggle
                                            ?flush=${true}
                                            .checked=${isChecked}
                                            @sutram-input-changed=${() => {
                                                const set = new Set(this.tempContexts);
                                                set.has(systemUri) ? set.delete(systemUri) : set.add(systemUri);
                                                FlowStore.setState({ tempContexts: Array.from(set) });
                                            }}>
                                        </sutram-toggle>
                                        <div style="display: flex; flex-direction: column; flex: 1; cursor: pointer;" @click=${() => {
                                            const set = new Set(this.tempContexts);
                                            set.has(systemUri) ? set.delete(systemUri) : set.add(systemUri);
                                            FlowStore.setState({ tempContexts: Array.from(set) });
                                        }}>
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="font-family: monospace; font-size: 0.9rem; color: var(--intent-primary); font-weight: bold;">${systemUri}</span>
                                                <span style="font-size: 0.75rem; color: var(--text-muted);">${sizeStr}</span>
                                            </div>
                                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                                                <yv-icon name="${isDiff ? 'git-pull-request' : 'package'}" style="width: 12px; height: 12px;"></yv-icon>
                                                <span>${isDiff ? 'Git Working Tree Diffs' : `Context Payload (${meta.repos ? meta.repos.join(', ') : 'Generated'})`}</span>
                                            </span>
                                        </div>
                                    </div>
                                `;
                            })}
                        </div>
                    </div>
                    <sutram-btn slot="footer" intent="primary" icon="check" label="Confirm Selection" @click=${() => {
                        if (this.selectingFor === 'exists') this._updateForm({ showIfExists: [...this.tempContexts] });
                        else if (this.selectingFor === 'missing') this._updateForm({ showIfMissing: [...this.tempContexts] });
                        else this._updateForm({ includes: [...this.tempContexts] });
                        FlowStore.setState({ showSelectContexts: false, contextSearchQuery: '' });
                    }}></sutram-btn>
                </sutram-modal>
            ` : ''}
        `;
    }
}
customElements.define('insetu-flow-edit-projection', InSetuFlowEditProjection);

export class InSetuExtFlowActions extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static styles = [sharedStyles, css`:host { display: flex; align-items: stretch; height: 100%; }`];
    get _menuItems() {
        return [
            { label: 'New Batch', icon: 'package', onClick: () => { 
                this.dispatch('insetu:flow:edit-batch', null);
            }}
        ];
    }
    render() {
        return html`
            <sutram-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn" title="Workflow Actions">
                    <yv-icon name="menu" style="width: 14px; height: 14px;"></yv-icon>
                </button>
            </sutram-dropdown>
        `;
    }
}
customElements.define('insetu-ext-flow-actions', InSetuExtFlowActions);
window.ExtensionRegistry.registerExtension('flow', {
    name: "Workflows",
    version: "2.0.0",
    offline_mode: "full",
    entityActions: [
        {
            targetEntity: 'workflow_batch',
            id: 'flow-edit',
            label: 'Edit',
            icon: 'edit-3',
            intent: 'primary',
            group: 'edit',
            vfsBound: false,
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:flow:edit-batch', detail: data })
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "flow",
            label: "Flow",
            icon: "workflow",
            intent: "primary",
            order: 2,
            component: "insetu-ext-flow"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "context",
            targetSub: "flow",
            component: "insetu-ext-flow-actions",
            order: 2
        }
    ],
});
