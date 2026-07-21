import { html, css } from 'lit';
import { executeWorkspaceMutation, fetchAndCopy, fetchAndDownloadState, executeSystemCompile } from '../app.js';
import { AppStore } from '../store.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';
import { sharedStyles } from '../shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
export const FlowStore = createExtensionStore('Flow', {
    batches: [],
    loading: false,
    searchQuery: '',
    fetchBatches: async () => {
        FlowStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace('flow/batches');
            if (res.ok) {
                const data = await res.json();
                window.inSetu.stores.App.setState(state => ({
                    gatherOptions: {
                        ...state.gatherOptions,
                        contexts: data.available_contexts || [],
                        diffs: data.available_diffs || [],
                        prompts: data.available_prompts || [],
                        artifactsDir: data.artifacts_dir || ".insetu/profiles/default/data",
                        profileDir: data.profile_dir || ".insetu/profiles/default"
                    }
                }));
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
        _viewingBatchPromptText: { type: String },
        _responseContent: { type: String },
        chunkModalOpen: { type: Boolean },
        activeChunkFile: { type: String },
        pinnedRepos: { type: Object },
        allRepos: { type: Array },
        _showFilters: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
        .flow-body { flex: 1; overflow-y: auto; padding: 20px; }
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
        this._viewingBatchPromptText = '';
        this.chunkModalOpen = false;
        this.activeChunkFile = null;
        this.pinnedRepos = new Set(['ALL']);
        this.allRepos = [];
    }

    onWorkspaceChanged(newWorkspaceId) {
        FlowStore.getState().fetchBatches();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(FlowStore, state => {
            this.batches = state.batches;
            this.loading = state.loading;
            this.searchQuery = state.searchQuery;
        });
        this.subscribe(AppStore, state => {
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
            this.allRepos = state.allRepos || [];
            this.requestUpdate();
        });
        const aState = AppStore.getState();
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);
        this.allRepos = aState.allRepos || [];

        FlowStore.getState().fetchBatches();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }

    openEditBatchModal(batch = null) {
        this._editingBatch = batch;
        const savedPrompt = batch && batch.include_prompt ? batch.include_prompt : '';
        const gatherOptions = AppStore.getState().gatherOptions || {};
        const availablePrompts = gatherOptions.prompts || [];
        let matchedPrompt = savedPrompt;
        if (savedPrompt && !availablePrompts.includes(savedPrompt)) {
            matchedPrompt = availablePrompts.find(p => p.endsWith(savedPrompt)) || savedPrompt;
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
    async _downloadTarget(targetFile) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndDownloadState(targetFile, explicitUrl);
    }

    async _copyTarget(targetFile) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndCopy(targetFile, explicitUrl);
    }
    // Logic abstracted to window.shareFiles
    openBatchModal(batch) {
        this._viewingBatch = batch;
        this._viewingBatchPromptText = 'Loading prompt...';
        this._responseContent = '';
        this._viewModalOpen = true;
        this.requestUpdate();
        const { gatherOptions, activeWorkspace } = AppStore.getState();
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
            } else alert("Failed to delete batch.");
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }

    async saveEditBatch() {
        const id = (this._editForm.id || '').trim();
        const title = (this._editForm.title || '').trim();
        const domain = (this._editForm.domain || '').trim() || "Workflows";

        if (!id || !title) return alert("Batch ID and Title are required.");
        const payload = { id, title, domain, includes: this._editForm.includes };

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
                const isExisting = currentBatches.some(b => b.id === payload.id);
                if (isExisting) {
                    FlowStore.setState({ batches: currentBatches.map(b => b.id === payload.id ? payload : b) });
                } else {
                    FlowStore.setState({ batches: [...currentBatches, payload] });
                }
                this._editingBatch = null;
                this._editModalOpen = false;
            } else alert("Failed to save batch.");
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    async saveBatchResponse() {
        const content = this._responseContent || '';
        if (!content.trim()) return alert('Please paste a response.');

        const { gatherOptions, activeWorkspace } = AppStore.getState();
        const artifactsDir = gatherOptions.artifactsDir || ".insetu/profiles/default/data";

        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
        const dStr = localISOTime.replace(/-/g, '').replace(/:/g, '').replace('T', '_').split('.')[0];
        const finalPath = this._viewingBatch.response_path.replace('{date}', dStr);

        const payload = {
            filepath: `${artifactsDir}/${finalPath}`,
            content: content,
            original_response_path: this._viewingBatch.response_path
        };
        if (this._viewingBatch.archive_path) payload.archive_path = `${artifactsDir}/${this._viewingBatch.archive_path}`;
        window.executeWorkspaceMutation('fs/save', payload, {
            loadingText: 'Saving...',
            onSuccess: () => {
                this._viewingBatch = null;
                this._viewModalOpen = false;
                this.requestUpdate();
            }
        });
    }
    render() {
            const { categoryOrder, gatherOptions, manifest } = AppStore.getState();
            const repoFilteredBatches = this.batches.map(b => {
                const filename = `workflow_${b.id}_context.txt`;
                const manifestObj = manifest[filename] || {};
                const repos = manifestObj.meta?.repos || [];
                return { ...b, _repos: repos };
            }).filter(b => {
                if (b.show_if_exists && b.show_if_exists.length > 0) {
                    if (!b.show_if_exists.every(f => !!manifest[f.split('/').pop()])) return false;
                }
                if (b.show_if_missing && b.show_if_missing.length > 0) {
                    if (b.show_if_missing.some(f => !!manifest[f.split('/').pop()])) return false;
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
            const allFiles = [...(gatherOptions?.diffs || []), ...(gatherOptions?.contexts || [])];
            const artifactsDir = gatherOptions?.artifactsDir || ".insetu/profiles/default/data";
            return html`
                <insetu-standard-toolbar
                    searchPlaceholder="🔍 Fuzzy search workflows..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => FlowStore.setState({ searchQuery: e.detail.value })}
                    .enableFilterDropdown=${true}
                    .activeFilters=${Array.from(this.pinnedRepos)}>
                    <insetu-repo-filter
                        slot="filters"
                        label="📌 Repos:"
                        .repos=${this.allRepos}
                        .activeRepos=${Array.from(this.pinnedRepos)}
                        @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                    </insetu-repo-filter>
                </insetu-standard-toolbar>

            <div class="flow-body">
        ${this.loading ? html`<div class="spinner" style="display:block;">Loading batches...</div>` : ''}
                    <div style="display: ${this.loading ? 'none' : 'flex'}; flex-direction: column;">
                        ${this.batches.length === 0 ? html`<p style="color: var(--text-muted);">No workflow batches defined.</p>` : ''}
                        <insetu-categorized-list
                            .items=${filteredBatches.map(b => ({...b, _domain: b.domain || 'Workflows'}))}
                            categoryKey="_domain"
                            .categoryOrder=${categoryOrder}
                            .renderItem=${(b) => {
                                const filename = `workflow_${b.id}_context.txt`;
                                const manifestObj = AppStore.getState().manifest[filename] || {};
                                const meta = manifestObj.meta || {};
                                let sizeStr = "";
                                if (meta.chunk_sizes && meta.chunk_sizes.length > 1) {
                                    const sizes = meta.chunk_sizes.map(s => Math.round(s / 1024));
                                    sizeStr = sizes.join(' + ') + " kb";
                                } else if (meta.size_bytes !== undefined) {
                                    const kb = Math.round(meta.size_bytes / 1024);
                                    sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " mb" : kb + " kb";
                                }
                                return html`
                                <insetu-card
                                        .filename=${b.id}
                                        .titleText=${`📦 ${b.title || b.id}`}
                                        .descriptionText=${`${b.includes.length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}`}
                                        .detailText=${sizeStr ? `${b._repos && b._repos.length > 0 ? `[${b._repos.join(', ')}] ` : ''}${filename} | ${sizeStr}` : `${b._repos && b._repos.length > 0 ? `[${b._repos.join(', ')}] ` : ''}${filename}`}
                                        icon=""
                                        intentColor="var(--intent-primary)"
                                        entityType="workflow_batch"
                                        .entityData=${b}
                                        @card-clicked=${() => this.openBatchModal(b)}>
                                </insetu-card>
                                `;
                            }}>
                        </insetu-categorized-list>
                    </div>
            </div>
                    <insetu-modal  
                            ?open=${this._editModalOpen} 
                            fullscreen
                            titleText=${this._editForm?.id ? `Edit Batch: ${this._editForm.title}` : 'Create New Batch'}
                            @modal-closed=${() => { this._editModalOpen = false; this._editingBatch = null; this.requestUpdate(); }}>
                            <div slot="body" style="display: flex; flex-direction: column; gap: 20px;">
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                            <div style="flex: 1; min-width: 150px;">
                                                    <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Batch Title</label>
                                                    <input type="text" .value=${this._editForm?.title || ''} placeholder="e.g. API Wrap-Up" style="font-weight: bold;"
                                                            @input=${(e) => { this._editForm.title = e.target.value; if(!this._editingBatch?.id){ this._editForm.id = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'); } this.requestUpdate(); }}>
                                            </div>
                                            <div style="flex: 1; min-width: 150px; display: none;">
                                                    <input type="text" .value=${this._editForm?.id || ''} @input=${(e) => { this._editForm.id = e.target.value; this.requestUpdate(); }}>
                                            </div>
                                            <div style="flex: 1; min-width: 150px;">
                                                    <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Domain</label>
                                                    <input type="text" .value=${this._editForm?.domain || 'Workflows'} placeholder="e.g. Workflows"
                                                            @input=${(e) => { this._editForm.domain = e.target.value; this.requestUpdate(); }}>
                                            </div>
                                    </div>
                                    <div>
                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Includes (Contexts & Diffs)</h4>
                                            <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                                    ${this._editForm?.includes?.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">No files selected.</div>` : 
                                                        this._editForm?.includes?.map((inc, idx) => html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <span style="font-family: monospace; font-size: 0.85rem; color: var(--text); word-break: break-all;">${inc}</span>
                                                                <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 0 5px;" @click=${() => {
                                                                    this._editForm.includes.splice(idx, 1);
                                                                    this.requestUpdate();
                                                                }}>×</button>
                                                            </div>
                                                        `)}
                                            </div>
                                            <div style="display: flex; gap: 10px;">
                                                <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 14px;" @click=${() => { this._selectingFor = 'includes'; this._tempContexts = [...this._editForm.includes]; this._showSelectContexts = true; }}>📁 Select Contexts</button>
                                                <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 14px;" @click=${() => {
                                                    if (window.openWorkspaceBrowser) {
                                                        window.openWorkspaceBrowser({
                                                            mode: 'file',
                                                            title: 'Select Arbitrary File',
                                                            callback: (filepath) => {
                                                                if (!this._editForm.includes.includes(filepath)) {
                                                                    this._editForm.includes = [...this._editForm.includes, filepath];
                                                                    this.requestUpdate();
                                                                }
                                                            }
                                                        });
                                                    }
                                                }}>📄 Add Arbitrary File</button>
                                            </div>
                                    </div>
                                    <div>
                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Visibility Prerequisites (Optional)</h4>

                                            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Show ONLY if these exist:</label>
                                            <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                                    ${!this._editForm?.showIfExists || this._editForm?.showIfExists?.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">No requirements.</div>` : 
                                                        this._editForm?.showIfExists?.map((inc, idx) => html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <span style="font-family: monospace; font-size: 0.85rem; color: var(--text); word-break: break-all;">${inc}</span>
                                                                <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 0 5px;" @click=${() => {
                                                                    this._editForm.showIfExists.splice(idx, 1);
                                                                    this.requestUpdate();
                                                                }}>×</button>
                                                            </div>
                                                        `)}
                                            </div>
                                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0 0 15px 0; padding: 6px 12px;" @click=${() => { this._selectingFor = 'exists'; this._tempContexts = [...(this._editForm.showIfExists || [])]; this._showSelectContexts = true; }}>➕ Add Required Contexts</button>

                                            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Show ONLY if these are missing:</label>
                                            <div style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                                    ${!this._editForm?.showIfMissing || this._editForm?.showIfMissing?.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">No requirements.</div>` : 
                                                        this._editForm?.showIfMissing?.map((inc, idx) => html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <span style="font-family: monospace; font-size: 0.85rem; color: var(--text); word-break: break-all;">${inc}</span>
                                                                <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; padding: 0 5px;" @click=${() => {
                                                                    this._editForm.showIfMissing.splice(idx, 1);
                                                                    this.requestUpdate();
                                                                }}>×</button>
                                                            </div>
                                                        `)}
                                            </div>
                                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0 0 15px 0; padding: 6px 12px;" @click=${() => { this._selectingFor = 'missing'; this._tempContexts = [...(this._editForm.showIfMissing || [])]; this._showSelectContexts = true; }}>➕ Add Missing Contexts</button>
                                    </div>
                                    <div>
                                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                                    <input type="checkbox" .checked=${this._editForm?.hasPrompt} style="transform: scale(1.3); cursor: pointer;"
                                                            @change=${() => { this._editForm.hasPrompt = !this._editForm.hasPrompt; this.requestUpdate(); }}>
                                                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">3. Instruction Prompt</h4>
                                            </div>
                                            ${this._editForm?.hasPrompt ? html`
                                                    <div style="display: flex; gap: 8px;">
                                                            <select style="flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--border); padding: 8px; border-radius: 4px;" .value=${this._editForm.prompt || ''} @change=${(e) => { this._editForm.prompt = e.target.value; this.requestUpdate(); }}>
                                                                <option value="">-- Select a Prompt --</option>
                                                                ${(gatherOptions.prompts || []).map(p => html`<option value="${p}">${p}</option>`)}
                                                            </select>
                                                    </div>
                                            ` : ''}
                                    </div>
                                    <div>
                                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                                    <input type="checkbox" .checked=${this._editForm?.hasResponse} style="transform: scale(1.3); cursor: pointer;"
                                                            @change=${() => { this._editForm.hasResponse = !this._editForm.hasResponse; this.requestUpdate(); }}>
                                                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">4. Response Text Box</h4>
                                            </div>
                                            ${this._editForm?.hasResponse ? html`
                                                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Response Path</label>
                                                    <input type="text" .value=${this._editForm.responsePath} placeholder="e.g. sotu/sotu_{date}.current.md" style="font-family: monospace; margin-bottom: 15px;" @input=${(e) => { this._editForm.responsePath = e.target.value; }}>
                                                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Archive Path (Optional)</label>
                                                    <input type="text" .value=${this._editForm.archivePath} placeholder="e.g. sotu/archive/" style="font-family: monospace;" @input=${(e) => { this._editForm.archivePath = e.target.value; }}>
                                            ` : ''}
                                    </div>
                            </div>
                            <div slot="footer">
                                    ${this._editingBatch?.id ? html`<button style="flex: 1; padding: 15px; background: var(--intent-danger); color: white; border: none; border-right: 1px solid var(--border); font-weight: bold; cursor: pointer;" @click=${this.deleteEditBatch}>🗑️ Delete Batch</button>` : ''}
                                    <button style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${this.saveEditBatch}>💾 Save Batch</button>
                            </div>
                    </insetu-modal>

                    <insetu-modal ?open=${this._showSelectContexts} titleText="Select Contexts" @modal-closed=${() => this._showSelectContexts = false}>
                            <div slot="body" style="display: flex; flex-direction: column; gap: 5px;">
                                    ${allFiles.map(file => html`
                                            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border);">
                                                    <input type="checkbox" .checked=${this._tempContexts.includes(file)} style="cursor: pointer; transform: scale(1.2);"
                                                            @change=${() => { const set = new Set(this._tempContexts); set.has(file) ? set.delete(file) : set.add(file); this._tempContexts = Array.from(set); this.requestUpdate(); }}>
                                                    <label style="cursor: pointer; word-break: break-all; flex: 1; font-family: monospace; font-size: 0.9rem; color: var(--text);">${file}</label>
                                            </div>
                                    `)}
                            </div>
                            <div slot="footer">
                                    <button style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${() => { 
                                        if (this._selectingFor === 'exists') this._editForm.showIfExists = [...this._tempContexts];
                                        else if (this._selectingFor === 'missing') this._editForm.showIfMissing = [...this._tempContexts];
                                        else this._editForm.includes = [...this._tempContexts]; 
                                        this._showSelectContexts = false; 
                                    }}>✅ Confirm Selection</button>
                            </div>
                    </insetu-modal>
                    <insetu-modal ?open=${this._viewModalOpen} titleText=${this._viewingBatch ? `Batch Workflow: ${this._viewingBatch.title}` : ''} @modal-closed=${() => { this._viewModalOpen = false; this._viewingBatch = null; this.requestUpdate(); }}>
                            <div slot="body" style="display: flex; flex-direction: column; gap: 20px;">
                                    ${this._viewingBatch ? html`
                                            <div>
                                                    <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Compiled Context Payload</h4>
                                                    <div style="background: var(--input-bg); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--border); margin-bottom: 10px;">
                                                            <ul style="margin: 0; font-family: monospace; font-size: 0.85rem; color: var(--text); opacity: 0.8; padding-left: 20px;">
                                                                    ${this._viewingBatch.includes.length > 0 ? this._viewingBatch.includes.map(inc => html`<li style="padding: 2px 0;">${inc}</li>`) : html`<li style="color: var(--intent-danger); list-style: none; margin-left: -20px;">No files mapped to this batch.</li>`}
                                                            </ul>
                                                    </div>
                                                    <div style="display: flex; gap: 10px;">
                                                            ${(() => {
                                                                const baseFile = `workflow_${this._viewingBatch.id}_context.txt`;
                                                                const chunks = AppStore.getState().manifest[baseFile]?.meta?.chunks;
                                                                const hasShare = !!navigator.share && !!navigator.canShare;

                                                                if (chunks && chunks.length > 1) {
                                                                    return html`
                                                                        <button class="btn-sm" style="background: var(--intent-primary);" @click=${(e) => {
                                                                            e.stopPropagation();
                                                                            this.activeChunkFile = baseFile;
                                                                            this.chunkModalOpen = true;
                                                                            this.requestUpdate();
                                                                        }}>📦 View Parts</button>
                                                                        ${hasShare ? html`<insetu-async-btn label="📤 Share All" intent="neutral" .onClick=${() => window.shareFiles(baseFile, chunks)}></insetu-async-btn>` : ''}
                                                                    `;
                                                                } else {
                                                                    return html`
                                                                        <insetu-async-btn label="📋 Copy Context" intent="success" .onClick=${() => this._copyTarget(baseFile)}></insetu-async-btn>
                                                                        <insetu-async-btn label="⬇️ Download" intent="primary" .onClick=${() => this._downloadTarget(baseFile)}></insetu-async-btn>
                                                                        ${hasShare ? html`<insetu-async-btn label="📤 Share" intent="neutral" .onClick=${() => window.shareFiles(baseFile)}></insetu-async-btn>` : ''}
                                                                    `;
                                                                }
                                                            })()}
                                                    </div>
                                            </div>
                                            ${this._viewingBatch.include_prompt ? html`
                                                    <div>
                                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Instruction Prompt</h4>
                                                            <textarea style="height: 150px; margin-bottom: 10px;" readonly>${this._viewingBatchPromptText}</textarea>
                                                            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                                                    <insetu-async-btn label="📋 Copy Prompt" intent="success" .onClick=${() => this.utils.copyRawText(this._viewingBatchPromptText)}></insetu-async-btn>
                                                            </div>
                                                    </div>
                                            ` : 
''}
                                            ${this._viewingBatch.response_path ? html`
                                                    <div>
                                                            <h4 style="margin: 0 0 5px 0; color: var(--text); font-size: 1.05rem;">3. LLM Response Integration</h4>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste response to save to: <code style="word-break: break-all; color: var(--intent-success);">${this._viewingBatch.response_path}</code></p>
                                                            <textarea id="batch-response-text" style="flex: 1; min-height: 250px; margin-bottom: 10px;" placeholder="Paste LLM response here..." .value=${this._responseContent || ''} @input=${(e) => { this._responseContent = e.target.value; this.requestUpdate(); }}></textarea>
                                                            <button class="btn-sm" style="background: var(--intent-success); width: 100%; padding: 15px; font-size: 1.1rem; font-weight: bold;" @click=${this.saveBatchResponse}>💾 Save Response</button>
                                                    </div>
                                            ` : ''}
                                    ` : ''}
                            </div>
                    </insetu-modal>
                    <insetu-modal ?open=${this.chunkModalOpen} titleText="📦 Batch Parts" maxWidth="500px" @modal-closed=${() => { this.chunkModalOpen = false; this.requestUpdate(); }}>
                        <div slot="body" style="display: flex; flex-direction: column; gap: 10px;">
                            ${(this.activeChunkFile ? (AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunks || []) : []).map((chunk, idx) => html`
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                                    <span style="font-weight: bold; font-family: monospace; font-size: 0.85rem; color: var(--text);">📄 Part ${idx + 1} ${(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes && AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx]) ? `(${Math.round(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx] / 1024)}kb)` : ''}</span>
                                    <div style="display: flex; gap: 8px;">
                                        <insetu-async-btn label="📋 Copy" intent="neutral" .onClick=${() => this._copyTarget(chunk)}></insetu-async-btn>
                                        <insetu-async-btn label="⬇️ Download" intent="primary" .onClick=${() => this._downloadTarget(chunk)}></insetu-async-btn>
                                    </div>
                                </div>
                            `)}
                        </div>
                </insetu-modal>
    `;
}
}
customElements.define('insetu-ext-flow', InSetuExtFlow);
export class InSetuExtFlowActions extends InSetuElement {
    static styles = [sharedStyles];
    get _menuItems() {
        return [
            { label: 'New Batch', icon: '📦', onClick: () => { 
                const flowEl = document.querySelector('insetu-ext-flow');
                if (flowEl) flowEl.openEditBatchModal(null); 
            }}
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
            onClick: (data, e) => {
                const el = document.querySelector('insetu-ext-flow');
                if (el) el.openEditBatchModal(data);
            }
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
    uiHooks: {
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'context' && data.subId === 'flow') {
                if (data.forceRefresh) FlowStore.getState().fetchBatches();
            }
        }
    }
});