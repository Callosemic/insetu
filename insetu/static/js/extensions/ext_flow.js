import { LitElement, html, css } from 'lit';
import { executeWorkspaceMutation, fetchAndCopy, fetchAndDownloadState, executeSystemCompile } from '../app.js';
import { AppStore } from '../store.js';
import { sharedStyles } from '../shared_styles.js';
export class InSetuExtFlow extends LitElement {
    static properties = {
        batches: { type: Array },
        loading: { type: Boolean },
        searchQuery: { type: String },
        _editingBatch: { type: Object },
        _viewingBatch: { type: Object },
        _showSelectContexts: { type: Boolean },
        _tempContexts: { type: Array },
        _editForm: { type: Object },
        _viewingBatchPromptText: { type: String },
        _responseContent: { type: String }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.batches = [];
        this.loading = false;
        this.searchQuery = '';
        this._editingBatch = null;
        this._viewingBatch = null;
        this._showSelectContexts = false;
        this._tempContexts = [];
        this._editForm = {};
        this._viewingBatchPromptText = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.fetchBatches();
        this._unsub = AppStore.subscribe(state => state.activeWorkspace, () => this.fetchBatches());
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
    }

    async fetchBatches() {
        this.loading = true;
        try {
            const activeWs = AppStore.getState().activeWorkspace || 'default';
            const res = await fetch(`/api/${activeWs}/flow/batches`);
            if (res.ok) {
                const data = await res.json();
                AppStore.setState(state => ({
                    gatherOptions: {
                        ...state.gatherOptions,
                        contexts: data.available_contexts || [],
                        diffs: data.available_diffs || [],
                        prompts: data.available_prompts || [],
                        artifactsDir: data.artifacts_dir || ".insetu/profiles/default/data",
                        profileDir: data.profile_dir || ".insetu/profiles/default"
                    }
                }));
                this.batches = data.batches || [];
            }
        } catch (e) {
            console.error("Error loading batches:", e);
        } finally {
            this.loading = false;
        }
    }
    openEditBatchModal(batch = null) {
        this._editingBatch = batch;
        this._editForm = {
            id: batch ? batch.id : '',
            title: batch ? batch.title : '',
            domain: batch && batch.domain ? batch.domain : 'Workflows',
            includes: batch && batch.includes ? [...batch.includes] : [],
            hasPrompt: batch ? !!batch.include_prompt : false,
            prompt: batch && batch.include_prompt ? batch.include_prompt : '',
            hasResponse: batch ? !!batch.response_path : false,
            responsePath: batch && batch.response_path ? batch.response_path : '',
            archivePath: batch && batch.archive_path ? batch.archive_path : ''
        };
    }
    openBatchModal(batch) {
        this._viewingBatch = batch;
        this._viewingBatchPromptText = 'Loading prompt...';
        this._responseContent = '';
        const { gatherOptions, activeWorkspace } = AppStore.getState();
        if (batch.include_prompt) {
            const profileDir = gatherOptions.profileDir || ".insetu/profiles/default";
            const promptPath = profileDir + '/' + batch.include_prompt;
            fetch(`/api/${activeWorkspace || 'default'}/prompts/resolve?file=${encodeURIComponent(promptPath)}`)
                .then(res => res.ok ? res.text() : Promise.reject(new Error("Prompt resolution failed")))
                .then(text => { this._viewingBatchPromptText = text; })
                .catch(err => { this._viewingBatchPromptText = `[Error: ${err.message}]`; });
        }
    }

    async deleteEditBatch() {
        if (!confirm("Delete this workflow batch?")) return;
        try {
            const { activeWorkspace } = AppStore.getState();
            const res = await fetch(`/api/${activeWorkspace}/flow/batches/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this._editingBatch.id })
            });
            if (res.ok) {
                this._editingBatch = null;
                this.fetchBatches();
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

        if (this._editForm.hasPrompt && this._editForm.prompt) payload.include_prompt = this._editForm.prompt;

        if (this._editForm.hasResponse && this._editForm.responsePath) {
            payload.response_path = this._editForm.responsePath.trim();
            if (this._editForm.archivePath) payload.archive_path = this._editForm.archivePath.trim();
        }

        try {
            const { activeWorkspace } = AppStore.getState();
            const res = await fetch(`/api/${activeWorkspace}/flow/batches/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                this._editingBatch = null;
                this.fetchBatches();
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
        window.executeWorkspaceMutation(`/api/${activeWorkspace || 'default'}/fs/save`, payload, {
            loadingText: 'Saving...',
            onSuccess: () => {
                this._viewingBatch = null;
                executeSystemCompile().then(res => {
                    if (res && res.status !== 'error') {
                        fetch(`/api/${activeWorkspace || 'default'}/manifest?t=` + Date.now())
                            .then(mRes => mRes.ok ? mRes.json() : {})
                            .then(manifest => AppStore.setState({ manifest }));
                    }
                });
            }
        });
    }
    render() {
            const categories = {};
            const filteredBatches = this.searchQuery 
                ? window.fuzzyFilterObjects(this.batches, this.searchQuery, b => `${b.title} ${b.id} ${b.domain}`) 
                : this.batches;

            filteredBatches.forEach(b => {
                    const domain = b.domain || 'Workflows';
                    if (!categories[domain]) categories[domain] = [];
                    categories[domain].push(b);
            });
            const { categoryOrder, gatherOptions } = AppStore.getState();
            const sortedCats = Object.keys(categories).sort((a, b) => {
                    const iA = categoryOrder.indexOf(a) === -1 ? 999 : categoryOrder.indexOf(a);
                    const iB = categoryOrder.indexOf(b) === -1 ? 999 : categoryOrder.indexOf(b);
                    if (iA !== iB) return iA - iB;
                    return a.localeCompare(b);
            });
            const allFiles = [...(gatherOptions?.diffs || []), ...(gatherOptions?.contexts || [])];
            const artifactsDir = gatherOptions?.artifactsDir || ".insetu/profiles/default/data";
            return html`
                                    <div class="sticky-header" style="display: flex; flex-direction: column;">
                                        <input type="text" class="fuzzy-search-input" placeholder="🔍 Fuzzy search workflows..." .value=${this.searchQuery} @input=${(e) => this.searchQuery = e.target.value}>
                                    </div>

        ${this.loading ? html`<div class="spinner" style="display:block;">Loading batches...</div>` : ''}

                    <div style="display: ${this.loading ? 'none' : 'flex'}; flex-direction: column;">
                                ${this.batches.length === 0 ?
html`<p style="color: var(--text-muted);">No workflow batches defined.</p>` : ''}
                            ${sortedCats.map(cat => html`
                                    <insetu-category-section titleText=${cat}>
                                            ${categories[cat].map(b => html`
                                                    <insetu-card
                                                            .filename=${b.id}
                                                            .titleText=${`📦 ${b.title || b.id}`}
                                                            .descriptionText=${`${b.includes.length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}`}
                                                            icon=""
                                                            intentColor="var(--intent-primary)"
                                                            @card-clicked=${() => this.openBatchModal(b)}>

                                                            <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0; color: white; border: none; cursor: pointer; padding: 6px 12px; font-size: 0.85rem; font-weight: bold;" 
                                                                    @click=${(e) => { e.stopPropagation(); this.openEditBatchModal(b); }}>
                                                                    ✏️ Edit
                                                            </button>
                                                    </insetu-card>
                                            `)}
                                    </insetu-category-section>
                            `)}
                    </div>

                    <insetu-modal 
                            ?open=${this._editingBatch !== undefined && this._editingBatch !== null} 
                            titleText=${this._editForm?.id ? `Edit Batch: ${this._editForm.title}` : 'Create New Batch'}
                            @modal-closed=${() => this._editingBatch = null}>
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
                                                    ${this._editForm?.includes?.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">No contexts selected.</div>` : 
                                                        this._editForm?.includes?.map(inc => html`<div style="font-family: monospace; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px solid var(--border); color: var(--text);">${inc}</div>`)}
                                            </div>
                                            <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 14px;" @click=${() => { this._tempContexts = [...this._editForm.includes]; this._showSelectContexts = true; }}>📁 Select Contexts</button>
                                    </div>
                                    <div>
                                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                                    <input type="checkbox" .checked=${this._editForm?.hasPrompt} style="transform: scale(1.3); cursor: pointer;"
                                                            @change=${() => { this._editForm.hasPrompt = !this._editForm.hasPrompt; this.requestUpdate(); }}>
                                                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">2. Instruction Prompt</h4>
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
                                                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">3. Response Text Box</h4>
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
                                    <button style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${() => { this._editForm.includes = [...this._tempContexts]; this._showSelectContexts = false; }}>✅ Confirm Selection</button>
                            </div>
                    </insetu-modal>

                    <insetu-modal ?open=${this._viewingBatch !== null} titleText=${this._viewingBatch ? `Batch Workflow: ${this._viewingBatch.title}` : ''} @modal-closed=${() => this._viewingBatch = null}>
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
                                                            <button class="btn-sm" style="background: var(--intent-success);" @click=${(e) => fetchAndCopy(`${artifactsDir}/workflows/${this._viewingBatch.id}_context.txt`, e.target)}>📋 Copy Context</button>
                                                            <button class="btn-sm" style="background: var(--intent-primary);" @click=${(e) => fetchAndDownloadState(`${artifactsDir}/workflows/${this._viewingBatch.id}_context.txt`, e.target)}>⬇️ Download .txt</button>
                                                    </div>
                                            </div>
                                            ${this._viewingBatch.include_prompt ? html`
                                                    <div>
                                                            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2. Instruction Prompt</h4>
                                                            <textarea style="height: 150px; margin-bottom: 10px;" readonly>${this._viewingBatchPromptText}</textarea>
                                                            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                                                    <button class="btn-sm" style="background: var(--intent-success);" @click=${(e) => {
                                                                            navigator.clipboard.writeText(this._viewingBatchPromptText);
                                                                            const btn = e.target;
                                                                            const orig = btn.innerText;
                                                                            btn.innerText = "✅ Copied!";
                                                                            setTimeout(() => btn.innerText = orig, 2000);
                                                                    }}>📋 Copy Prompt</button>
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
            `;
    }
}
customElements.define('insetu-ext-flow', InSetuExtFlow);

export class InSetuExtFlowActions extends LitElement {
    static styles = css`
        button { background: transparent; border: 1px solid var(--border); color: var(--text); margin: 0; padding: 4px 12px; font-size: 1.1rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
        button:hover { background: var(--input-bg); }
    `;
    _openMenu(e) {
        if (!window.inSetu?.ui.Factory?.createDropdown) return;
        const flowEl = document.querySelector('insetu-ext-flow');
        window.inSetu.ui.Factory.createDropdown({
            anchor: e.target,
            items: [
                { label: 'New Batch', icon: '📦', onClick: () => { flowEl?.openEditBatchModal(null); } }
            ]
        });
    }
    render() {
        return html`<button @click=${this._openMenu}>☰</button>`;
    }
}
customElements.define('insetu-ext-flow-actions', InSetuExtFlowActions);

window.ExtensionRegistry.registerExtension('flow', {
    name: "Workflows",
    version: "2.0.0",
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
                const container = document.getElementById('sub-flow');
                const litEl = container?.querySelector('insetu-ext-flow');
                if (litEl && data.forceRefresh) litEl.fetchBatches();
            }
        }
    }
});