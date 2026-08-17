import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { sharedStyles } from '../core/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
const AppStore = window.inSetu.stores.App;
export const FlowStore = createExtensionStore('Flow', {
    batches: [],
    loading: false,
    searchQuery: '',
    fetchBatches: async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('flow')) return;
        FlowStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace('flow/batches');
            if (res.ok) {
                const data = await res.json();
                const gatherStore = window.inSetu?.stores?.Gather;
                if (gatherStore && typeof gatherStore.setState === 'function') {
                    gatherStore.setState(state => ({
                        gatherOptions: {
                            ...(state?.gatherOptions || {}),
                            contexts: data.available_contexts || [],
                            diffs: data.available_diffs || [],
                            prompts: data.available_prompts || [],
                            artifactsDir: data.artifacts_dir || ".insetu/data",
                            profileDir: data.profile_dir || ".insetu"
                        }
                    }));
                }
                FlowStore.setState({ batches: data.batches || [] });
            }
        } catch (e) {
            console.error("Error loading batches:", e);
        } finally {
            FlowStore.setState({ loading: false });
        }
    }
});
window.inSetu.stores.Flow = FlowStore;
export class InSetuExtFlow extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        batches: { type: Array },
        loading: { type: Boolean },
        searchQuery: { type: String },
        _editingBatch: { type: Object },
        _viewingBatch: { type: Object },
        _editModalOpen: { type: Boolean },
        _viewModalOpen: { type: Boolean },
        _showSelectContexts: { type: Boolean },
        _tempContexts: { type: Array },
        _selectingFor: { type: String },
        _editForm: { type: Object },
        _contextSearchQuery: { type: String },
        _viewingBatchPromptText: { type: String },
        _responseContent: { type: String },
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
        this._editingBatch = null;
        this._viewingBatch = null;
        this._editModalOpen = false;
        this._viewModalOpen = false;
        this._showSelectContexts = false;
        this._tempContexts = [];
        this._selectingFor = 'includes';
        this._editForm = {};
        this._contextSearchQuery = '';
        this._viewingBatchPromptText = '';
        this.pinnedRepos = new Set(['ALL']);
        this.allRepos = [];
        this._applyVisibilityFilter = true;
    }
    onWorkspaceChanged(newWorkspaceId) {
        FlowStore.getState().fetchBatches();
    }
    onForceRefresh() {
        FlowStore.setState({ batches: [] });
        if (this.sys && this.sys.refreshManifest) this.sys.refreshManifest();
        FlowStore.getState().fetchBatches();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(FlowStore, state => {
            this.batches = state.batches;
            this.loading = state.loading;
            this.searchQuery = state.searchQuery;
        });
        this.registerGlobalListener('insetu:flow:edit-batch', window, (e) => this.openEditBatchModal(e.detail));
        this.registerGlobalListener('insetu:flow:refresh-prompt', window, () => {
            if (this._viewModalOpen && this._viewingBatch) this.openBatchModal(this._viewingBatch);
        });
        this.subscribe(AppStore, state => state.manifest, () => FlowStore.getState().fetchBatches());
        this.registerGlobalListener('git-diffs-refreshed', window, async () => {
            if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                await window.inSetu.sys.refreshManifest();
            }
            FlowStore.getState().fetchBatches();
        });
        this.subscribe(AppStore, state => {
            this.allRepos = state.allRepos || [];
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
            this.requestUpdate();
        });

        this.registerGlobalListener('sutram-route-changed', window, (e) => {
            if (e.detail.tab === 'context' && e.detail.subTabs['context'] === 'flow') {
                FlowStore.getState().fetchBatches();
            }
        });

        this.registerGlobalListener('zone:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const promptTouched = payload.mutations.some(m => m.filepath && (m.filepath.includes('prompts/') || m.filepath.endsWith('.md') || m.filepath.endsWith('.txt')));
            if (promptTouched) {
                window.dispatchEvent(new CustomEvent('insetu:flow:refresh-prompt'));
            }
            const contextOrDiffTouched = payload.mutations.some(m => m.filepath && (
                m.filepath.includes('diffs/') || 
                m.filepath.includes('contexts/') || 
                m.filepath.includes('workflows/') ||
                m.filepath.endsWith('_diffs.txt') ||
                m.filepath.endsWith('_context.txt')
            ));
            if (contextOrDiffTouched) {
                if (window.inSetu.sys && window.inSetu.sys.refreshManifest) window.inSetu.sys.refreshManifest();
                FlowStore.getState().fetchBatches();
            }
        });

        const as = AppStore.getState ? AppStore.getState() : {};
        this.pinnedRepos = as.pinnedRepos || new Set(['ALL']);
        this.allRepos = as.allRepos || [];

        FlowStore.getState().fetchBatches();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    openEditBatchModal(batch = null) {
        this._editingBatch = batch;
        const savedPrompt = batch && batch.include_prompt ? batch.include_prompt : '';
        const gatherOptions = window.inSetu.stores.Gather.getState().gatherOptions || {};

        const cleanSavedPrompt = savedPrompt.replace(/^\.insetu\/prompts\//, '').replace(/^prompts\//, '');
        const availablePrompts = (gatherOptions.prompts || []).map(p => p.replace(/^\.insetu\/prompts\//, '').replace(/^prompts\//, ''));

        let matchedPrompt = cleanSavedPrompt;
        if (cleanSavedPrompt && !availablePrompts.includes(cleanSavedPrompt)) {
            matchedPrompt = availablePrompts.find(p => p.endsWith(cleanSavedPrompt)) || cleanSavedPrompt;
        }

        this._editForm = {
            id: batch ? batch.id : '',
            title: batch ? batch.title : '',
            domain: batch && batch.domain ? batch.domain : 'Workflows',
            includes: batch && batch.includes ? [...batch.includes] : [],
            showIfExists: batch && batch.show_if_exists ? [...batch.show_if_exists] : [],
            showIfMissing: batch && batch.show_if_missing ? [...batch.show_if_missing] : [],
            hasPrompt: batch ? !!batch.include_prompt : false,
            prompt: matchedPrompt,
            hasResponse: batch ? !!batch.response_path : false,
            responsePath: batch && batch.response_path ? batch.response_path : '',
            archivePath: batch && batch.archive_path ? batch.archive_path : ''
        };
        this._editModalOpen = true;
        this.requestUpdate();
    }
    openBatchModal(batch) {
        this._viewingBatch = batch;
        this._viewingBatchPromptText = 'Loading prompt...';
        this._responseContent = '';
        this._viewModalOpen = true;
        this.requestUpdate();
        const { gatherOptions } = window.inSetu.stores.Gather.getState();
        if (batch.include_prompt) {
            let promptPath = batch.include_prompt;
            const prompts = gatherOptions.prompts || [];
            if (!prompts.includes(promptPath)) {
                promptPath = prompts.find(p => p.endsWith(promptPath)) || promptPath;
            }
            window.inSetu.api.workspace(`prompts/resolve?file=${encodeURIComponent(promptPath)}`)
                .then(res => res.ok ? res.text() : Promise.reject(new Error("Prompt resolution failed")))
                .then(text => { this._viewingBatchPromptText = text; })
                .catch(err => { this._viewingBatchPromptText = `[Error: ${err.message}]`; });
        }
    }
    async deleteEditBatch() {
        if (!confirm("Delete this workflow batch?")) return;
        try {
            const res = await this.api.post('batches/delete', { id: this._editingBatch.id });
            if (res.ok) {
                FlowStore.setState(s => ({ batches: s.batches.filter(b => b.id !== this._editingBatch.id) }));
                this._editingBatch = null;
                this._editModalOpen = false;
                this.requestUpdate();

                const responseData = await res.json();
                if (responseData.manifest) {
                    AppStore.setState({ manifest: responseData.manifest });
                }

                if (this.compileSystem) {
                    this.compileSystem(null, false, 'flow_workflows');
                }
            } else alert("Failed to delete batch.");
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    async saveEditBatch() {
        const originalId = (this._editForm.id || '').trim();
        const title = (this._editForm.title || '').trim();
        const domain = (this._editForm.domain || '').trim() || "Workflows";

        if (!title) return alert("Title is required.");

        let newId = this.utils.slugify(title);
        let counter = 1;
        const currentBatches = FlowStore.getState().batches;
        while (currentBatches.some(b => b.id === newId && b.id !== originalId)) {
            newId = `${this.utils.slugify(title)}_${counter}`;
            counter++;
        }

        const payload = { id: newId, original_id: originalId, title, domain, includes: this._editForm.includes };

        if (this._editForm.showIfExists && this._editForm.showIfExists.length > 0) payload.show_if_exists = this._editForm.showIfExists;
        if (this._editForm.showIfMissing && this._editForm.showIfMissing.length > 0) payload.show_if_missing = this._editForm.showIfMissing;

        if (this._editForm.hasPrompt && this._editForm.prompt) payload.include_prompt = this._editForm.prompt;

        if (this._editForm.hasResponse && this._editForm.responsePath) {
            payload.response_path = this._editForm.responsePath.trim();
            if (this._editForm.archivePath) payload.archive_path = this._editForm.archivePath.trim();
        }
        try {
            const res = await this.api.post('batches/save', payload);
            if (res.ok) {
                const currentBatches = FlowStore.getState().batches;
                const isExisting = currentBatches.some(b => b.id === originalId);
                if (isExisting) {
                    FlowStore.setState({ batches: currentBatches.map(b => b.id === originalId ? payload : b) });
                } else {
                    FlowStore.setState({ batches: [...currentBatches, payload] });
                }
                this._editingBatch = null;
                this._editModalOpen = false;
                this.requestUpdate();

                const responseData = await res.json();
                if (responseData.manifest) {
                    AppStore.setState({ manifest: responseData.manifest });
                }

                if (this.compileSystem) {
                    this.compileSystem(null, false, 'flow_workflows');
                }
            } else alert("Failed to save batch.");
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    async saveBatchResponse() {
        const content = this._responseContent || '';
        if (!content.trim()) return alert('Please paste a response.');
        const { gatherOptions } = window.inSetu.stores.Gather.getState();
        const artifactsDir = gatherOptions.artifactsDir || ".insetu/data";

        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
        const dStr = localISOTime.replace(/-/g, '').replace(/:/g, '').replace('T', '_').split('.')[0];
        const finalPath = this._viewingBatch.response_path.replace('{date}', dStr);
        const allRepos = window.inSetu.stores.Gather.getState().allRepos || [];
        const isRepoTarget = allRepos.includes(finalPath.split('/')[0]);

        const payload = {
            filepath: isRepoTarget ? finalPath : `${artifactsDir}/${finalPath}`,
            content: content,
            original_response_path: this._viewingBatch.response_path
        };
        if (this._viewingBatch.archive_path) {
            const isArchiveRepoTarget = allRepos.includes(this._viewingBatch.archive_path.split('/')[0]);
            payload.archive_path = isArchiveRepoTarget ? this._viewingBatch.archive_path : `${artifactsDir}/${this._viewingBatch.archive_path}`;
        }

        try {
            await this.sys.executeWorkspaceMutation('fs/save', payload);
            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Success!", 2000);
            this._viewingBatch = null;
            this._viewModalOpen = false;
            this.requestUpdate();
        } catch (e) {
            // Error handling is gracefully caught by the mutation wrapper's alert
            console.error("Batch save failed", e);
        }
    }
    render() {
            const appStore = window.inSetu?.stores?.App || (typeof AppStore !== 'undefined' ? AppStore : null);
            const appState = appStore?.getState ? appStore.getState() : {};
            const categoryOrder = appState?.categoryOrder || [];
            const manifest = appState?.manifest?.ctx || {};
            const gatherStore = window.inSetu?.stores?.Gather;
            const gatherState = gatherStore?.getState ? gatherStore.getState() : {};
            const gatherOptions = gatherState?.gatherOptions || {};
            // allFiles represents valid configuration targets for the UI builder (potentials + actuals)
            const allFiles = [
                ...(gatherOptions?.diffs || []), 
                ...(gatherOptions?.contexts || []),
                ...(gatherOptions?.prompts || [])
            ];
            const repoFilteredBatches = this.batches.map(b => {
                const actualFilename = `workflow_${b.id}_context.txt`;
                const manifestObj = manifest[actualFilename] || {};
                const repos = manifestObj.meta?.repos || [];
                return { ...b, _repos: repos, _filename: actualFilename };
            }).filter(b => {
                if (this._applyVisibilityFilter) {
                    // Literal existence check: Must be physically present in the active manifest or prompt list
                    const checkLiteralExists = (f) => {
                        const filename = f.split('/').pop();
                        if (manifest[filename]) return true;

                        const checkName = f.startsWith('ctx://') ? f.replace('ctx://', '') : f;
                        return (gatherOptions?.prompts || []).includes(checkName);
                    };

                    if (b.show_if_exists && b.show_if_exists.length > 0) {
                        if (!b.show_if_exists.every(checkLiteralExists)) return false;
                    }
                    if (b.show_if_missing && b.show_if_missing.length > 0) {
                        if (b.show_if_missing.some(checkLiteralExists)) return false;
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
            const artifactsDir = gatherOptions?.artifactsDir || ".insetu/profiles/default/data";
            return html`
                <sutram-toolbar
                    searchPlaceholder="🔍 Fuzzy search workflows..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => FlowStore.setState({ searchQuery: e.detail.value })}
                    .enableFilterDropdown=${true}
                    .activeFilters=${[...Array.from(this.pinnedRepos), ...(this._applyVisibilityFilter ? ['Visibility: ON'] : [])]}>
                    <div slot="filters" style="display: flex; flex-direction: column;">
                        <insetu-repo-filter
                            label="📌 Repos:"
                            .repos=${this.allRepos}
                            .activeRepos=${Array.from(this.pinnedRepos)}
                            @repo-filter-changed=${(e) => window.inSetu.stores.Gather.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                        </insetu-repo-filter>
                        <div style="padding: 10px 15px; display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--border);">
                            <input type="checkbox" id="vis-toggle" .checked=${this._applyVisibilityFilter} style="transform: scale(1.1); cursor: pointer;"
                                @change=${(e) => { this._applyVisibilityFilter = e.target.checked; this.requestUpdate(); }}>
                            <label for="vis-toggle" style="font-size: 0.9rem; color: var(--text); cursor: pointer;">Apply Visibility Requirements</label>
                        </div>
                    </div>
                </sutram-toolbar>
            <div style="flex: 1; overflow-y: auto; padding: 0;">
        ${this.loading ? html`<insetu-spinner text="Loading batches..."></insetu-spinner>` : ''}
                    <div style="display: ${this.loading ? 'none' : 'flex'}; flex-direction: column;">
                        ${this.batches.length === 0 ? html`<div style="padding: 20px;"><insetu-empty-state text="No workflow batches defined."></insetu-empty-state></div>` : ''}
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
                                    ?open=${true}
                                    ?flush=${true}
                                    style="--title-weight: bold; --title-size: 1.05rem; color: var(--text); background: transparent; border-left: none; border-right: none; border-radius: 0; box-shadow: none;">

                                    <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 20px 20px 20px;">
                                        ${groups[cat].map(b => {
                                            const filename = b._filename;
                                            const manifestObj = AppStore.getState().manifest?.ctx?.[filename] || {};
                                            const meta = manifestObj.meta || {};
                                            let sizeStr = "";
                                            if (meta.chunk_sizes && meta.chunk_sizes.length > 1) {
                                                const sizes = meta.chunk_sizes.map(s => Math.round(s / 1024));
                                                sizeStr = sizes.join(' + ') + " kb";
                                            } else if (meta.size_bytes !== undefined) {
                                                const kb = Math.round(meta.size_bytes / 1024);
                                                sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " mb" : kb + " kb";
                                            }
                                            const repoStr = b._repos && b._repos.length > 0 ? `[${b._repos.join(', ')}] ` : '';
                                            return html`
                                                <insetu-card
                                                        .filename=${b.id}
                                                        .titleText=${`📦 ${b.title || b.id}`}
                                                        .descriptionText=${`${b.includes.length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}`}
                                                        .detailPrefix=${repoStr}
                                                        .detailText=${filename}
                                                        .detailSuffix=${sizeStr ? ` | ${sizeStr}` : ''}
                                                        icon=""
                                                        intentColor="var(--intent-primary)"
                                                        .entityType=${'file:workflow_batch'}
                                                        .entityData=${{  
                                                            ...b, 
                                                            filepath: filename, 
                                                            suppress: ['file-browse', 'file-edit'], 
                                                            chunks: window.inSetu?.utils?.extractManifestFiles ? window.inSetu.utils.extractManifestFiles(AppStore.getState().manifest || {}, filename, 'ctx') : [filename]  
                                                        }}
                                                        @card-clicked=${() => this.openBatchModal(b)}>
                                                </insetu-card>
                                            `;
                                        })}
                                    </div>
                                </sutram-collapsible>
                            `);
                        })()}
                    </div>
            </div>
                    <sutram-modal  
                            .open=${this._editModalOpen} 
                            ?fullscreen=${true}
                            titleText=${this._editForm?.id ? `Edit Batch: ${this._editForm.title}` : 'Create New Batch'}
                            @sutram-modal-closed=${() => { this._editModalOpen = false; this._editingBatch = null; this.requestUpdate(); }}>
                            <div slot="body" style="display: flex; flex-direction: column; gap: 20px; flex: 1; min-height: 0; overflow-y: auto;">
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                            <div style="flex: 1; min-width: 150px;">
                                                    <sutram-input label="Batch Title" .value=${this._editForm?.title || ''} placeholder="e.g. API Wrap-Up" 
                                                            @sutram-input-changed=${(e) => { this._editForm.title = e.detail.value; if(!this._editingBatch?.id){ this._editForm.id = e.detail.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'); } this.requestUpdate(); }}></sutram-input>
                                            </div>
                                            <div style="flex: 1; min-width: 150px; display: none;">
                                                    <sutram-input .value=${this._editForm?.id || ''} @sutram-input-changed=${(e) => { this._editForm.id = e.detail.value; this.requestUpdate(); }}></sutram-input>
                                            </div>
                                            <div style="flex: 1; min-width: 150px;">
                                                    <sutram-input label="Domain" .value=${this._editForm?.domain || 'Workflows'} placeholder="e.g. Workflows"
                                                            @sutram-input-changed=${(e) => { this._editForm.domain = e.detail.value; this.requestUpdate(); }}></sutram-input>
                                            </div>
                                    </div>
                                    <div>
                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Includes (Contexts & Diffs)</h4>
                                            <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                                    ${this._editForm?.includes?.length === 0 ? html`<insetu-empty-state text="No files selected."></insetu-empty-state>` : 
                                                        this._editForm?.includes?.map((inc, idx) => {
                                                            const isSystem = inc.startsWith('ctx://');
                                                            const isContextOrDiff = isSystem || inc.includes('contexts/') || inc.includes('diffs/') || inc.endsWith('_context.txt') || inc.endsWith('_diffs.txt');
                                                            const checkName = isSystem ? inc.replace('ctx://', '') : inc;
                                                            const isMissing = isContextOrDiff && !allFiles.includes(checkName);

                                                            let icon = "📄";
                                                            if (inc.includes('diffs/')) icon = "🔄";
                                                            else if (inc.includes('contexts/')) icon = "📦";
                                                            else if (inc.endsWith('/')) icon = "📁";
                                                            else if (!isSystem && !inc.includes('.')) icon = "📁"; // rough heuristic for path directories without trailing slash

                                                            return html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <div style="display: flex; align-items: center; flex: 1; min-width: 0; gap: 8px;">
                                                                    <span style="font-size: 1.1rem; opacity: 0.8;">${icon}</span>
                                                                    <span style="font-family: monospace; font-size: 0.85rem; color: ${isMissing ? 'var(--intent-danger)' : (isSystem ? 'var(--intent-primary)' : 'var(--text)')}; word-break: break-all; text-decoration: ${isMissing ? 'line-through' : 'none'}; opacity: ${isMissing ? '0.8' : '1'}; font-weight: ${isSystem ? 'bold' : 'normal'};">${inc}</span>
                                                                    ${isMissing ? html`<span style="margin-left: 8px; font-size: 0.7rem; background: transparent; color: var(--intent-danger); border: 1px solid var(--intent-danger); padding: 1px 6px; border-radius: 10px; font-weight: bold; white-space: nowrap;">⚠️ Missing</span>` : ''}
                                                                </div>
                                                                <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 0 5px; flex-shrink: 0;" @click=${() => {
                                                                    this._editForm.includes.splice(idx, 1);
                                                                    this.requestUpdate();
                                                                }}>×</button>
                                                            </div>
                                                        `})}
                                            </div>
                                            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                                <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 14px;" @click=${() => { this._selectingFor = 'includes'; this._tempContexts = [...this._editForm.includes]; this._showSelectContexts = true; }}>📦 Select Contexts</button>
                                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0; padding: 8px 14px;" @click=${() => {
                                                    if (this.ui && this.ui.openWorkspaceBrowser) {
                                                        this.ui.openWorkspaceBrowser({
                                                            mode: 'file',
                                                            title: 'Select File',
                                                            callback: (filepath) => {
                                                                if (!this._editForm.includes.includes(filepath)) {
                                                                    this._editForm.includes = [...this._editForm.includes, filepath];
                                                                    this.requestUpdate();
                                                                }
                                                            }
                                                        });
                                                    }
                                                }}>📄 + File</button>
                                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0; padding: 8px 14px;" @click=${() => {
                                                    if (this.ui && this.ui.openWorkspaceBrowser) {
                                                        this.ui.openWorkspaceBrowser({
                                                            mode: 'folder',
                                                            title: 'Select Folder',
                                                            callback: (folderpath) => {
                                                                if (folderpath && !this._editForm.includes.includes(folderpath)) {
                                                                    this._editForm.includes = [...this._editForm.includes, folderpath];
                                                                    this.requestUpdate();
                                                                }
                                                            }
                                                        });
                                                    }
                                                }}>📁 + Folder</button>
                                            </div>
                                    </div>
                                    <div>
                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Visibility Prerequisites (Optional)</h4>
                                            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Show ONLY if these exist:</label>
                                            <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                                    ${!this._editForm?.showIfExists || this._editForm?.showIfExists?.length === 0 ? html`<insetu-empty-state text="No requirements."></insetu-empty-state>` : 
                                                        this._editForm?.showIfExists?.map((inc, idx) => {
                                                            const isSystem = inc.startsWith('ctx://');
                                                            const isContextOrDiff = isSystem || inc.includes('contexts/') || inc.includes('diffs/') || inc.endsWith('_context.txt') || inc.endsWith('_diffs.txt');
                                                            const checkName = isSystem ? inc.replace('ctx://', '') : inc;
                                                            const isMissing = isContextOrDiff && !allFiles.includes(checkName);

                                                            let icon = "📄";
                                                            if (inc.includes('diffs/')) icon = "🔄";
                                                            else if (inc.includes('contexts/')) icon = "📦";
                                                            else if (inc.endsWith('/')) icon = "📁";
                                                            else if (!isSystem && !inc.includes('.')) icon = "📁";

                                                            return html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <div style="display: flex; align-items: center; flex: 1; min-width: 0; gap: 8px;">
                                                                    <span style="font-size: 1.1rem; opacity: 0.8;">${icon}</span>
                                                                    <span style="font-family: monospace; font-size: 0.85rem; color: ${isMissing ? 'var(--intent-danger)' : (isSystem ? 'var(--intent-primary)' : 'var(--text)')}; word-break: break-all; text-decoration: ${isMissing ? 'line-through' : 'none'}; opacity: ${isMissing ? '0.8' : '1'}; font-weight: ${isSystem ? 'bold' : 'normal'};">${inc}</span>
                                                                    ${isMissing ? html`<span style="margin-left: 8px; font-size: 0.7rem; background: transparent; color: var(--intent-danger); border: 1px solid var(--intent-danger); padding: 1px 6px; border-radius: 10px; font-weight: bold; white-space: nowrap;">⚠️ Missing</span>` : ''}
                                                                </div>
                                                                <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 0 5px; flex-shrink: 0;" @click=${() => {
                                                                    this._editForm.showIfExists.splice(idx, 1);
                                                                    this.requestUpdate();
                                                                }}>×</button>
                                                            </div>
                                                        `})}
                                            </div>
                                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0 0 15px 0; padding: 6px 12px;" @click=${() => { this._selectingFor = 'exists'; this._tempContexts = [...(this._editForm.showIfExists || [])]; this._showSelectContexts = true; }}>➕ Add Required Contexts</button>
                                            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Show ONLY if these are missing:</label>
                                            <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                                    ${!this._editForm?.showIfMissing || this._editForm?.showIfMissing?.length === 0 ? html`<insetu-empty-state text="No requirements."></insetu-empty-state>` : 
                                                        this._editForm?.showIfMissing?.map((inc, idx) => {
                                                            const isSystem = inc.startsWith('ctx://');
                                                            const isContextOrDiff = isSystem || inc.includes('contexts/') || inc.includes('diffs/') || inc.endsWith('_context.txt') || inc.endsWith('_diffs.txt');
                                                            const checkName = isSystem ? inc.replace('ctx://', '') : inc;
                                                            const isMissing = isContextOrDiff && !allFiles.includes(checkName);

                                                            let icon = "📄";
                                                            if (inc.includes('diffs/')) icon = "🔄";
                                                            else if (inc.includes('contexts/')) icon = "📦";
                                                            else if (inc.endsWith('/')) icon = "📁";
                                                            else if (!isSystem && !inc.includes('.')) icon = "📁";

                                                            return html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <div style="display: flex; align-items: center; flex: 1; min-width: 0; gap: 8px;">
                                                                    <span style="font-size: 1.1rem; opacity: 0.8;">${icon}</span>
                                                                    <span style="font-family: monospace; font-size: 0.85rem; color: ${isMissing ? 'var(--intent-danger)' : (isSystem ? 'var(--intent-primary)' : 'var(--text)')}; word-break: break-all; text-decoration: ${isMissing ? 'line-through' : 'none'}; opacity: ${isMissing ? '0.8' : '1'}; font-weight: ${isSystem ? 'bold' : 'normal'};">${inc}</span>
                                                                    ${isMissing ? html`<span style="margin-left: 8px; font-size: 0.7rem; background: transparent; color: var(--intent-danger); border: 1px solid var(--intent-danger); padding: 1px 6px; border-radius: 10px; font-weight: bold; white-space: nowrap;">⚠️ Missing</span>` : ''}
                                                                </div>
                                                                <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 0 5px; flex-shrink: 0;" @click=${() => {
                                                                    this._editForm.showIfMissing.splice(idx, 1);
                                                                    this.requestUpdate();
                                                                }}>×</button>
                                                            </div>
                                                        `})}
                                            </div>
                                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0 0 15px 0; padding: 6px 12px;" @click=${() => { this._selectingFor = 'missing'; this._tempContexts = [...(this._editForm.showIfMissing || [])]; this._showSelectContexts = true; }}>➕ Add Missing Contexts</button>
                                    </div>
                                    <div>
                                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                                    <sutram-toggle .checked=${this._editForm?.hasPrompt} @sutram-input-changed=${(e) => { this._editForm.hasPrompt = e.detail.value; this.requestUpdate(); }}></sutram-toggle>
                                                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">3. Instruction Prompt</h4>
                                            </div>
                                            ${this._editForm?.hasPrompt ? html`
                                                    <div style="display: flex; gap: 8px;">
                                                            <sutram-select style="flex: 1;" .value=${this._editForm.prompt} .options=${[{value: '', label: '-- Select a Prompt --'}, ...(gatherOptions.prompts || []).map(p => { const v = p.replace(/^\.insetu\/prompts\//, '').replace(/^prompts\//, ''); return {value: v, label: v}; })]} @sutram-input-changed=${(e) => { this._editForm.prompt = e.detail.value; this.requestUpdate(); }}></sutram-select>
                                                    </div>
                                            ` : ''}
                                    </div>
                                    <div>
                                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                                    <sutram-toggle .checked=${this._editForm?.hasResponse} @sutram-input-changed=${(e) => { this._editForm.hasResponse = e.detail.value; this.requestUpdate(); }}></sutram-toggle>
                                                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">4. Response Text Box</h4>
                                            </div>
                                            ${this._editForm?.hasResponse ? html`
                                                    <sutram-input label="Response Path" .value=${this._editForm.responsePath} placeholder="e.g. sotu/sotu_{date}.current.md" style="font-family: monospace;" @sutram-input-changed=${(e) => { this._editForm.responsePath = e.detail.value; }}></sutram-input>
                                                    <sutram-input label="Archive Path (Optional)" .value=${this._editForm.archivePath} placeholder="e.g. sotu/archive/" style="font-family: monospace;" @sutram-input-changed=${(e) => { this._editForm.archivePath = e.detail.value; }}></sutram-input>
                                            ` : ''}
                                    </div>
                            </div>
                            ${this._editingBatch?.id ? html`<button slot="footer" style="background: var(--intent-danger); color: white;" @click=${this.deleteEditBatch}>🗑️ Delete Batch</button>` : ''}
                            <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveEditBatch}>💾 Save Batch</button>
                    </sutram-modal>
                    <sutram-modal .open=${this._showSelectContexts} titleText="Select Contexts" @sutram-modal-closed=${() => { this._showSelectContexts = false; this._contextSearchQuery = ''; }}>
                            <div slot="body" style="display: flex; flex-direction: column; gap: 5px; flex: 1; min-height: 0;">
                                    <input type="text" placeholder="🔍 Fuzzy search contexts..." style="padding: 8px; margin-bottom: 10px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this._contextSearchQuery} @input=${(e) => { this._contextSearchQuery = e.target.value; }}>
                                    <div style="display: flex; flex-direction: column; gap: 5px; overflow-y: auto; flex: 1;">
                                            ${(this._contextSearchQuery ? window.inSetu.utils.fuzzyFilterObjects(allFiles, this._contextSearchQuery) : allFiles).map(file => {
                                                const systemUri = `ctx://${file}`;
                                                const isChecked = this._tempContexts.includes(systemUri) || this._tempContexts.includes(file); // Handle legacy untyped files

                                                const isDiff = file.includes('diffs/');
                                                const manifestObj = manifest[file.split('/').pop()] || {};
                                                const meta = manifestObj.meta || {};
                                                let sizeStr = "";
                                                if (meta.chunk_sizes && meta.chunk_sizes.length > 1) {
                                                    const sizes = meta.chunk_sizes.map(s => Math.round(s / 1024));
                                                    sizeStr = sizes.join(' + ') + " KB";
                                                } else if (meta.size_bytes !== undefined) {
                                                    const kb = Math.round(meta.size_bytes / 1024);
                                                    sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
                                                }

                                                return html`
                                                    <div style="display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border); background: var(--bg);">
                                                            <input type="checkbox" .checked=${isChecked} style="cursor: pointer; transform: scale(1.2);"
                                                                    @change=${() => { 
                                                                        const set = new Set(this._tempContexts); 
                                                                        if (set.has(file)) set.delete(file); // Clean up legacy string if modifying
                                                                        set.has(systemUri) ? set.delete(systemUri) : set.add(systemUri); 
                                                                        this._tempContexts = Array.from(set); 
                                                                        this.requestUpdate(); 
                                                                    }}>
                                                            <div style="display: flex; flex-direction: column; flex: 1; cursor: pointer;" @click=${() => {
                                                                const set = new Set(this._tempContexts);
                                                                if (set.has(file)) set.delete(file);
                                                                set.has(systemUri) ? set.delete(systemUri) : set.add(systemUri);
                                                                this._tempContexts = Array.from(set);
                                                                this.requestUpdate();
                                                            }}>
                                                                <div style="display: flex; justify-content: space-between;">
                                                                    <span style="font-family: monospace; font-size: 0.9rem; color: var(--intent-primary); font-weight: bold;">${systemUri}</span>
                                                                    <span style="font-size: 0.75rem; color: var(--text-muted);">${sizeStr}</span>
                                                                </div>
                                                                <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                                                    ${isDiff ? '🔄 Git Working Tree Diffs' : `📦 Context Payload (${meta.repos ? meta.repos.join(', ') : 'Generated'})`}
                                                                </span>
                                                            </div>
                                                    </div>
                                            `})}
                                    </div>
                            </div>
                            <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${() => { 
                                if (this._selectingFor === 'exists') this._editForm.showIfExists = [...this._tempContexts];
                                else if (this._selectingFor === 'missing') this._editForm.showIfMissing = [...this._tempContexts];
                                else this._editForm.includes = [...this._tempContexts]; 
                                this._showSelectContexts = false; 
                                this._contextSearchQuery = '';
                            }}>✅ Confirm Selection</button>
                    </sutram-modal>
                    <sutram-modal .open=${this._viewModalOpen} ?fullscreen=${true} titleText=${this._viewingBatch ? `Batch Workflow: ${this._viewingBatch.title}` : ''} @sutram-modal-closed=${() => { this._viewModalOpen = false; this._viewingBatch = null; this.requestUpdate(); }}>
                            <div slot="body" style="display: flex; flex-direction: column; gap: 20px; flex: 1; min-height: 0; overflow-y: auto;">
                                    ${this._viewingBatch ? html`
                                            <div>
                                                    <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Compiled Context Payload</h4>
                                                    <div style="background: var(--input-bg); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--border); margin-bottom: 10px; max-height: 250px; overflow-y: auto;">
                                                            <ul style="margin: 0; font-family: monospace; font-size: 0.85rem; color: var(--text); opacity: 0.8; padding-left: 20px;">
                                                                    ${this._viewingBatch.includes.length > 0 ? this._viewingBatch.includes.map(inc => html`<li style="padding: 2px 0; word-break: break-all;">${inc}</li>`) : html`<li style="color: var(--intent-danger); list-style: none; margin-left: -20px;">No files mapped to this batch.</li>`}
                                                            </ul>
                                                    </div>
                                                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; width: 100%;">
                                                            ${(() => {
                                                                const baseFile = `workflow_${this._viewingBatch.id}_context.txt`;
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
                                            ${this._viewingBatch.include_prompt ? html`
                                                    <div>
                                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Instruction Prompt</h4>
                                                            <textarea style="width: 100%; box-sizing: border-box; padding: 10px; height: 150px; margin-bottom: 10px; font-family: monospace; font-size: 0.85rem;" readonly>${this._viewingBatchPromptText}</textarea>
                                                            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                                                    ${(() => {
                                                                        let promptPath = this._viewingBatch.include_prompt;
                                                                        const prompts = gatherOptions.prompts || [];
                                                                        if (!prompts.includes(promptPath)) {
                                                                            promptPath = prompts.find(p => p.endsWith(promptPath)) || promptPath;
                                                                        }
                                                                        return html`
                                                                            <sutram-entity-actions 
                                                                                .entityType=${'file:prompt'} 
                                                                                .entityData=${{ 
                                                                                    filepath: promptPath, 
                                                                                    isFS: false,
                                                                                    showOnly: ['file-copy', 'file-edit']
                                                                                }}>
                                                                            </sutram-entity-actions>
                                                                        `;
                                                                    })()}
                                                            </div>
                                                    </div>
                                            ` :  
''}
                                            ${this._viewingBatch.response_path ? html`
                                                    <div>
                                                            <h4 style="margin: 0 0 5px 0; color: var(--text); font-size: 1.05rem;">3. LLM Response Integration</h4>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste response to save to: <code style="word-break: break-all; color: var(--intent-success);">${this._viewingBatch.response_path}</code></p>
                                                            <sutram-textarea id="batch-response-text" placeholder="Paste LLM response here..." .value=${this._responseContent || ''} .monospace=${true} .rows=${10} @sutram-input-changed=${(e) => { this._responseContent = e.detail.value; this.requestUpdate(); }}></sutram-textarea>
                                                            <button class="btn-sm" style="background: var(--intent-success); width: 100%; padding: 15px; font-size: 1.1rem; font-weight: bold;" @click=${this.saveBatchResponse}>💾 Save Response</button>
                                                    </div>
                                            ` : ''}
                                    ` : ''}
                            </div>
                    </sutram-modal>
    `;
}
}
customElements.define('insetu-ext-flow', InSetuExtFlow);
export class InSetuExtFlowActions extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static styles = [sharedStyles];
    get _menuItems() {
        return [
            { label: 'New Batch', icon: '📦', onClick: () => { 
                this.dispatch('insetu:flow:edit-batch', null);
            }}
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
customElements.define('insetu-ext-flow-actions', InSetuExtFlowActions);
window.ExtensionRegistry.registerExtension('flow', {
    name: "Workflows",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'workflow_batch',
            id: 'flow-edit',
            label: 'Edit',
            icon: '✏️',
            intent: 'primary',
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
