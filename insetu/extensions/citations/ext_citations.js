import { createExtensionStore, InSetuElement } from '../core/sdk.js';
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const CitationStore = createExtensionStore('Citations', {
    localLibrary: [],
            cachedPublications: [],
            cachedAuthors: [],
            activeAttachCitation: null,
            activeEditCitation: null,
            currentEditAuthors: [],
            currentExplorePage: 1,
            citationLibraryCache: null,
            attachForm: { repo: '', bucket: 'None' },
            editForm: { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' },
            importingIds: new Set()
}, ['pinnedRepos']);

window.inSetu.stores.Citations = CitationStore;
import { html, css } from 'lit';
import { sharedStyles } from '../core/shared_styles.js';
export class InSetuExtCitations extends InSetuElement {
    static properties = {
        importingIds: { type: Object },
        localLibrary: { type: Array },
        pinnedRepos: { type: Object },
        cachedPublications: { type: Array },
        cachedAuthors: { type: Array },
        activeAttachCitation: { type: Object },
        activeEditCitation: { type: Object },
        currentEditAuthors: { type: Array },
        attachForm: { type: Object },
        editForm: { type: Object },

        mainSearchQuery: { type: String },
        exploreSearchQuery: { type: String },
        exploreSource: { type: String },
        exploreField: { type: String },
        exploreCategory: { type: String },
        exploredItems: { type: Array },
        exploreLoading: { type: Boolean },
        mainLoading: { type: Boolean },
        currentExplorePage: { type: Number },
        importLog: { type: String },
        importStrategy: { type: String },

        allRepos: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; container-type: inline-size; }
        .task-tag { background: var(--border); color: var(--text); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; opacity: 0.8; }
        :host-context([data-theme="e-ink"]) .task-tag { background: #ffffff !important; color: #000000 !important; border: 1px dashed #000000 !important; opacity: 1 !important; }
    `];
    constructor() {
        super();
        this.localLibrary = [];
        this.pinnedRepos = new Set(['ALL']);
        this.cachedPublications = [];
        this.cachedAuthors = [];
        this.activeAttachCitation = null;
        this.activeEditCitation = null;
        this.currentEditAuthors = [];
        this.attachForm = { repo: '', bucket: 'None' };
        this.editForm = { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' };

        this.mainSearchQuery = '';
        this.exploreSearchQuery = '';
        this.exploreSource = 'openalex';
        this.exploreField = 'all';
        this.exploreCategory = '';
        this.exploredItems = [];
        this.exploreLoading = false;
        this.mainLoading = false;
        this.currentExplorePage = 1;
        this.importLog = '';
        this.importStrategy = 'overwrite';
        this._importingIds = new Set();

        this.allRepos = [];
    }

    get currentViewMode() {
        return this.dataset.subId || 'lib-main';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(CitationStore, state => {
            this.localLibrary = state.localLibrary || [];
            this.cachedPublications = state.cachedPublications || [];
            this.cachedAuthors = state.cachedAuthors || [];
            this.activeAttachCitation = state.activeAttachCitation;
            this.activeEditCitation = state.activeEditCitation;
            this.currentEditAuthors = state.currentEditAuthors || [];
            this.attachForm = state.attachForm || { repo: '', bucket: 'None' };
            this.editForm = state.editForm || { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' };
            this.importingIds = state.importingIds || new Set();
        });
        this.subscribe(AppStore, state => {
            this.allRepos = state.allRepos || [];
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
            this.requestUpdate();
        });

        this.registerGlobalListener('insetu:citations:notes', window, (e) => this._openCitationNotes(e.detail.id));
        this.registerGlobalListener('insetu:citations:edit', window, (e) => this._openEditModal(e.detail.data));
        this.registerGlobalListener('insetu:citations:pin', window, (e) => this._openAttachModal(e.detail.data));
        this.registerGlobalListener('insetu:citations:import', window, (e) => this._importExploreCitation(e.detail.data));
        const cState = CitationStore.getState();
        this.localLibrary = cState.localLibrary || [];
        const aState = AppStore.getState();
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);
        this.allRepos = aState.allRepos || [];
        this.loadMainLibrary();
    }

    onWorkspaceChanged(newWorkspaceId) {
        this.loadMainLibrary();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
    async loadMainLibrary() {
        this.mainLoading = true;
        try {
            const idxRes = await this.api.get('index');
            if (idxRes.ok) {
                const d = await idxRes.json();
                if(d.publications) CitationStore.setState({ cachedPublications: d.publications });
                if(d.authors) CitationStore.setState({ cachedAuthors: d.authors });
            }
            const res = await this.api.get('list');
            if (res.ok) {
                const data = await res.json();
                CitationStore.setState({ localLibrary: data.citations || [] });
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.mainLoading = false;
        }
    }
    async _performExploreSearch(loadMore = false) {
        const query = this.exploreSearchQuery.trim();
        const category = this.exploreCategory.trim();
        if (!query && !category) return;

        this.exploreLoading = true;
        if (!loadMore) {
            this.exploredItems = [];
            this.currentExplorePage = 1;
        }
        try {
            const pageToFetch = loadMore ? this.currentExplorePage : 1;
            const res = await this.api.post('search', { 
                q: query, 
                source: this.exploreSource, 
                field: this.exploreField, 
                category: category, 
                page: pageToFetch 
            });

            if (!res.ok) throw new Error("Search failed to start.");
            const data = await res.json();

            this.api.pollJob(data.job_id, {
                onProgress: () => {},
                onComplete: (statusData) => {
                    const citations = statusData.artifact.citations || [];
                    if (loadMore) {
                        this.exploredItems = [...this.exploredItems, ...citations];
                    } else {
                        this.exploredItems = citations;
                    }
                    if (citations.length === 20) {
                        this.currentExplorePage = pageToFetch + 1;
                    }
                    this.exploreLoading = false;
                },
                onError: (err) => {
                    console.error("Explore Search Failed:", err);
                    this.exploreLoading = false;
                }
            });
        } catch (e) {
            console.error("Explore Search Failed:", e);
            this.exploreLoading = false;
        }
    }

    _handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.importLog = "Parsing JSON...\n";
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const jsonPayload = JSON.parse(ev.target.result);
                const reqBody = { citations: jsonPayload.items || jsonPayload, strategy: this.importStrategy };
                this.importLog += `Uploading ${reqBody.citations.length} records...\n`;
                const res = await this.api.post('import', reqBody);
                const data = await res.json();
                if (res.ok) {
                    this.importLog += `✅ ${data.message}\n`;
                    if (data.conflicts?.length > 0) this.importLog += `⚠️ ${data.conflicts.length} conflicts flagged.\n`;
                    this.loadMainLibrary();
                } else {
                    this.importLog += `❌ Import failed: ${data.error}\n`;
                }
            } catch (err) {
                this.importLog += `❌ JSON Parse Error: ${err.message}\n`;
            }
        };
        reader.readAsText(file);
    }
    async _importExploreCitation(payload) {
        CitationStore.setState(state => {
            const newSet = new Set(state.importingIds);
            newSet.add(payload.id);
            return { importingIds: newSet };
        });
        try {
            await this.api.post('import', { citations: [payload], strategy: 'overwrite' });
            this.loadMainLibrary();
        } catch (err) {
            alert("Error importing citation: " + err.message);
        } finally {
            CitationStore.setState(state => {
                const finalSet = new Set(state.importingIds);
                finalSet.delete(payload.id);
                return { importingIds: finalSet };
            });
        }
    }
    async _openCitationNotes(cslId) {
        try {
            const res = await window.inSetu.api.workspace('fs/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: cslId })
            });
            if (res.ok) {
                const data = await res.json();
                let results = data.results || [];
                if (res.status === 202) {
                    const jobId = data.job_id;
                    while (true) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const pollRes = await window.inSetu.api.system(`jobs/${jobId}`);
                        if (!pollRes.ok) throw new Error("Search job failed");
                        const pollData = await pollRes.json();
                        if (pollData.status === 'completed') {
                            results = pollData.artifact?.results || [];
                            break;
                        } else if (pollData.status === 'failed') {
                            throw new Error(pollData.message);
                        }
                    }
                }
                if (results && results.length === 1) {
                    if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(results[0].path, true);
                } else if (results && results.length > 1) {
                    if (this.ui && this.ui.openLinkModal) {
                        this.ui.openLinkModal(cslId, 'deep');
                    }
                } else {
                    alert("No markdown files found referencing this citation ID.");
                }
            }
        } catch(e) {
            console.error(e);
            alert("Error searching for notes.");
        }
    }

    _openAttachModal(citation) {
        CitationStore.setState({ activeAttachCitation: citation });
        CitationStore.setState(state => ({ attachForm: { ...state.attachForm, repo: this.allRepos[0] || '', bucket: 'None' } }));
    }
    async _saveAttachmentList(newAtts) {
        if (!this.activeAttachCitation) return;
        try {
            const res = await this.api.post(`${encodeURIComponent(this.activeAttachCitation.id)}/attach`, { attachments: newAtts });
            if (res.ok) {
                CitationStore.setState({ activeAttachCitation: { ...this.activeAttachCitation, _attachments: newAtts } });
                this.loadMainLibrary();
            } else {
                throw new Error('Failed to save attachment.');
            }
        } catch(e) {
            throw new Error('Error saving attachment.');
        }
    }

    _openEditModal(citation) {
        const initialDateStr = (citation.issued && citation.issued['date-parts'] && citation.issued['date-parts'][0]) ? citation.issued['date-parts'][0].join('-') : '';
        const cslData = { ...citation };
        delete cslData._attachments; delete cslData.type; delete cslData.title; delete cslData['container-title']; delete cslData.author; delete cslData.issued;

        CitationStore.setState(s => ({
            activeEditCitation: citation,
            currentEditAuthors: citation.author ? JSON.parse(JSON.stringify(citation.author)) : [],
            editForm: {
                type: citation.type || 'document',
                title: citation.title || '',
                pubTitle: citation['container-title'] || '',
                dateStr: initialDateStr,
                jsonStr: JSON.stringify(cslData, null, 4),
                authorInput: ''
            }
        }));
    }
    async _deleteDynamicCitation() {
        if (!this.activeEditCitation) return;
        if (!confirm(`Are you sure you want to completely delete this citation ([@${this.activeEditCitation.id}]) from your library?`)) return Promise.resolve();
        try {
            const res = await this.api.delete(`${encodeURIComponent(this.activeEditCitation.id)}`);
            if (res.ok) {
                CitationStore.setState({ activeEditCitation: null });
                this.loadMainLibrary();
            } else {
                throw new Error("Failed to delete citation.");
            }
        } catch (e) {
            throw new Error('Network error deleting citation.');
        }
    }

    async _saveDynamicCitation() {
        if (!this.activeEditCitation) return;
        const payload = (() => {
            try { return JSON.parse(this.editForm.jsonStr || '{}'); } catch (e) { return null; }
        })();

        if (!payload) throw new Error("Invalid JSON format in the 'Other Metadata' box.");

        payload.type = this.editForm.type || 'document';
        payload.title = (this.editForm.title || '').trim();
        const pubTitle = (this.editForm.pubTitle || '').trim();

        if (pubTitle) payload['container-title'] = pubTitle; else delete payload['container-title'];
        if (this.currentEditAuthors.length > 0) payload.author = this.currentEditAuthors; else delete payload.author;

        const dateStr = (this.editForm.dateStr || '').trim();
        if (dateStr) {
            const parts = dateStr.split('-').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
            if (parts.length > 0) payload.issued = { 'date-parts': [parts] };
        } else {
            delete payload.issued;
        }
        if (payload.id !== this.activeEditCitation.id) payload.id = this.activeEditCitation.id;
        try {
            const res = await this.api.post('import', { citations: [payload], strategy: 'overwrite' });
            if (res.ok) {
                CitationStore.setState({ activeEditCitation: null });
                this.loadMainLibrary();
            } else {
                throw new Error("Failed to save citation.");
            }
        } catch(e) {
            throw new Error('Network error saving citation.');
        }
    }
    _renderCard(c, isExplore) {
        const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
        const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';
        const isImporting = this.importingIds && this.importingIds.has(c.id);
        const alreadyExists = isExplore ? this.localLibrary.some(libItem => libItem.id === c.id || (libItem.URL && c.URL && libItem.URL.toLowerCase() === c.URL.toLowerCase())) : false;

        const attTags = !isExplore && c._attachments && c._attachments.length > 0
            ? c._attachments.map(a => html`<span class="task-tag" style="background: var(--border);">${a.repo}${a.bucket !== 'None' ? ':'+a.bucket : ''}</span>`)
            : '';

        return html`
            <insetu-card
                .filename=${c.id}
                .titleText=${c.title || 'Untitled'}
                .descriptionText=${`${authors} (${year})`}
                icon="📄"
                intentColor="var(--intent-highlight)"
                entityType=${isExplore ? 'explore_citation' : 'citation'}
                .entityData=${{ ...c, isImporting, isExplore, alreadyExists }}>
                <div style="font-size: 0.8rem; margin-top: 4px; color: var(--text-muted);">
                    ID: <span style="font-family: monospace; color: var(--intent-primary);">[@${c.id}]</span> ${c.open_access ? '🔓 OA' : ''}
                </div>
                ${c.URL ? html`<div style="font-size: 0.8rem; margin-top: 4px;">🌐 <a href="${c.URL}" target="_blank" style="color: var(--intent-success); text-decoration: underline; word-break: break-all;">${c.URL}</a></div>` : ''}
                ${attTags ? html`<div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">${attTags}</div>` : ''}
            </insetu-card>
        `;
    }
    _renderMain() {
        const pinnedSet = this.localLibrary.filter(c => {
            const atts = c._attachments || [];
            const matchesRepo = (() => {
                if (this.pinnedRepos.has('ALL')) return true;
                return (this.pinnedRepos.has('ORPHANS') && atts.length === 0) || atts.some(a => this.pinnedRepos.has(a.repo));
            })();
            return matchesRepo;
        });
        const filtered = this.mainSearchQuery 
            ? window.inSetu.utils.fuzzyFilterObjects(pinnedSet, this.mainSearchQuery, c => `${c.title || ''} ${c.id || ''} ${c.author ? c.author.map(a => a.family).join(" ") : ''}`)
            : pinnedSet;
        return html`
            <sutram-toolbar
                searchPlaceholder="🔍 Fuzzy search personal library..."
                .searchQuery=${this.mainSearchQuery}
                @search-changed=${(e) => { this.mainSearchQuery = e.detail.value; }}
                .bottomBorder=${true}>
                <div slot="bottom-row" class="toolbar-row" style="background: var(--input-bg);">
                    <insetu-repo-filter
                        label="📌 Repos:"
                        .repos=${this.allRepos}
                        .activeRepos=${Array.from(this.pinnedRepos)}
                        .extraRepos=${[{id: "ORPHANS", label: "👻 Orphans"}]}
                        @repo-filter-changed=${(e) => window.inSetu.stores.Gather.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                    </insetu-repo-filter>
                </div>
            </sutram-toolbar>
            <div>
                ${this.mainLoading ? html`<div class="spinner" style="display: block;">Loading library...</div>` : ''}
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${filtered.length === 0 ? html`<p style="color: var(--text-muted); font-style: italic;">No results.</p>` : filtered.map(c => this._renderCard(c, false))}
                </div>
            </div>
        `;
    }

    _renderExplore() {
        return html`
            <div>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 15px; background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                    <div>
                        <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Catalog Source</label>
                        <select .value=${this.exploreSource} @change=${e => this.exploreSource = e.target.value} style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border); font-weight: bold;">
                            <option value="openalex">OpenAlex (Recommended)</option>
                            <option value="crossref">Crossref (DOIs & Exact Titles)</option>
                            <option value="semanticscholar">Semantic Scholar</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Search Query</label>
                        <input type="text" placeholder="${this.exploreSource === 'crossref' ? 'DOIs, precise titles, or authors...' : 'Keywords, titles, or authors...'}" .value=${this.exploreSearchQuery} @input=${e => this.exploreSearchQuery = e.target.value} style="width: 100%; padding: 8px 10px; box-sizing: border-box; margin: 0;">
                    </div>
                    ${this.exploreSource === 'openalex' ? html`
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Target Field</label>
                            <select .value=${this.exploreField} @change=${e => this.exploreField = e.target.value} style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border);">
                                <option value="all">All Fields</option>
                                <option value="title">Title Only</option>
                            </select>
                        </div>
                        <div style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:var(--intent-highlight); display:block; margin-bottom:4px;">Topic Filter</label>
                            <input type="text" placeholder="e.g., Ethnomusicology..." .value=${this.exploreCategory} @input=${e => this.exploreCategory = e.target.value} style="width: 100%; padding: 8px 10px; box-sizing: border-box; margin: 0; border-color: var(--intent-highlight);">
                        </div>
                    </div>
                    ` : ''}
                    ${this.exploreSource === 'crossref' ? html`
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Target Field</label>
                            <select .value=${this.exploreField} @change=${e => this.exploreField = e.target.value} style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border);">
                                <option value="all">All Fields</option>
                                <option value="title">Title Only</option>
                            </select>
                        </div>
                    </div>
                    ` : ''}
                    <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 10px; font-size: 1rem;" @click=${() => this._performExploreSearch(false)}>🔍 Search Catalog</button>
                </div>
                ${this.exploreLoading ? html`<div class="spinner" style="display: block;">Querying global catalogs...</div>` : ''}
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${this.exploredItems.length === 0 && !this.exploreLoading ? html`<p style="color: var(--text-muted); font-style: italic;">Search the open science index to discover and import citations.</p>` : ''}
                    ${this.exploredItems.map(c => this._renderCard(c, true))}
                    ${this.exploredItems.length > 0 && this.exploredItems.length % 20 === 0 ? html`
                        <button class="btn-sm" style="background: var(--intent-neutral); margin: 10px auto; display: block;" @click=${() => this._performExploreSearch(true)}>⬇️ Load More</button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    _renderImport() {
        return html`
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: var(--intent-primary);">Import CSL-JSON</h3>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Select a JSON export from Zotero or Better BibTeX.</p>
                    <div style="margin: 15px 0;">
                        <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 5px;">Conflict Strategy:</label>
                        <div style="display: flex; gap: 15px; font-size: 0.9rem;" @change=${e => this.importStrategy = e.target.value}>
                            <label><input type="radio" name="lib-merge-strat" value="overwrite" ?checked=${this.importStrategy === 'overwrite'}> Overwrite Existing</label>
                            <label><input type="radio" name="lib-merge-strat" value="skip" ?checked=${this.importStrategy === 'skip'}> Skip Existing</label>
                            <label><input type="radio" name="lib-merge-strat" value="manual" ?checked=${this.importStrategy === 'manual'}> Manual Resolve</label>
                        </div>
                    </div>
                    <button class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 8px 16px;" @click=${() => this.shadowRoot.getElementById('lib-file-picker').click()}>📁 Choose File</button>
                    <input type="file" id="lib-file-picker" accept=".json,application/json" style="display: none;" @change=${this._handleImportFile}>
                </div>
                <div style="font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; color: var(--text);">${this.importLog}</div>
            </div>
        `;
    }
    _renderModals() {
        return html`
            <!-- Attach Modal -->
            <sutram-modal ?open=${!!this.activeAttachCitation} ?fullscreen=${true} titleText="Pin to Repo: [@${this.activeAttachCitation?.id}]" @sutram-modal-closed=${() => CitationStore.setState({ activeAttachCitation: null })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <select style="flex:1; padding:8px; border-radius:4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" .value=${this.attachForm.repo} @change=${e => { CitationStore.setState(s => ({ attachForm: { ...s.attachForm, repo: e.target.value, bucket: 'None' } })); }}>
                            ${this.allRepos.map(r => html`<option value="${r}">${r}</option>`)}
                        </select>
                        <select style="flex:1; padding:8px; border-radius:4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" .value=${this.attachForm.bucket} @change=${e => CitationStore.setState(s => ({ attachForm: { ...s.attachForm, bucket: e.target.value } }))}>
                            <option value="None">No Bucket</option>
                            ${this.attachForm.repo ? this.sys.getFlattenedBuckets(this.attachForm.repo).map(b => html`<option value="${b.id}">${b.title}</option>`) : ''}
                        </select>
                        <sutram-async-btn class="btn-sm" label="📌 Pin" intent="success" style="margin: 0;" .onClick=${() => this._saveAttachmentList([...(this.activeAttachCitation?._attachments || []), { repo: this.attachForm.repo, bucket: this.attachForm.bucket }])}></sutram-async-btn>
                    </div>
                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:5px;">Currently Pinned Repositories:</label>
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; overflow-y: auto; flex: 1;">
                        ${(this.activeAttachCitation?._attachments || []).length === 0 ? html`<span style="color: var(--text-muted); font-style: italic;">Not pinned to any repository.</span>` : (this.activeAttachCitation?._attachments || []).map((a, idx) => html`
                            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--pane-bg); border: 1px solid var(--border); padding: 6px 10px; border-radius: 4px;">
                                <span style="font-size: 0.85rem; font-family: monospace; color: var(--text);">${a.repo} ${a.bucket !== 'None' ? '🗂️ ' + a.bucket : ''}</span>
                                <button style="background: transparent; border: none; cursor: pointer; padding: 0;" @click=${() => {
                                    const atts = [...this.activeAttachCitation._attachments];
                                    atts.splice(idx, 1);
                                    this._saveAttachmentList(atts);
                                }}>❌</button>
                            </div>
                        `)}
                    </div>
                </div>
            </sutram-modal>
            <!-- Edit Modal -->
            <sutram-modal ?open=${!!this.activeEditCitation} ?fullscreen=${true} titleText="Edit: [@${this.activeEditCitation?.id}]" @sutram-modal-closed=${() => CitationStore.setState({ activeEditCitation: null })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                        <div style="flex: 1;">
                            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Type:</label>
                            <select style="width: 100%; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" .value=${this.editForm.type} @change=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, type: e.target.value } }))}>
                                <option value="article-journal">Journal Article</option>
                                <option value="book">Book</option>
                                <option value="chapter">Book Chapter</option>
                                <option value="paper-conference">Conference Paper</option>
                                <option value="article-magazine">Magazine Article</option>
                                <option value="article-newspaper">Newspaper Article</option>
                                <option value="webpage">Webpage</option>
                                <option value="thesis">Thesis</option>
                                <option value="report">Report</option>
                                <option value="document">Document (Generic)</option>
                            </select>
                        </div>
                    </div>
                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Item Title:</label>
                    <input type="text" style="width: 100%; padding: 8px; margin-bottom: 12px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" .value=${this.editForm.title} @input=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, title: e.target.value } }))}>

                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Publication Title <span style="font-weight:normal;">(e.g., Journal Name)</span>:</label>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="text" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" .value=${this.editForm.pubTitle} @input=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, pubTitle: e.target.value } }))}>
                        <!-- Optional UI component trigger could go here -->
                    </div>

                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Authors:</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                        ${this.currentEditAuthors.map((a, idx) => html`
                            <span class="task-tag" style="background: var(--intent-primary); color: white; border: none; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 4px 8px; border-radius: 12px;">
                                <span>${a.given ? `${a.family}, ${a.given}` : a.family || a.literal || 'Unknown'}</span>
                                <span style="cursor: pointer; font-weight: bold; font-size: 1rem; line-height: 1; margin-left: 2px;" @click=${() => {
                                    const updatedAuthors = [...this.currentEditAuthors];
                                    updatedAuthors.splice(idx, 1);
                                    CitationStore.setState({ currentEditAuthors: updatedAuthors });
                                }}>×</span>
                            </span>
                        `)}
                    </div>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="text" placeholder="Last, First" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" .value=${this.editForm.authorInput} @input=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, authorInput: e.target.value } }))} @keydown=${e => { if(e.key === 'Enter') this.shadowRoot.getElementById('btn-add-cit-author').click(); }}>
                        <button id="btn-add-cit-author" class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 12px;" @click=${() => {
                            const val = (this.editForm.authorInput || '').trim();
                            if (!val) return;
                            const parts = val.split(',').map(s => s.trim());
                            const newAuthor = parts.length > 1 ? { family: parts[0], given: parts.slice(1).join(', ') } : { family: parts[0] };
                            CitationStore.setState(s => ({ currentEditAuthors: [...s.currentEditAuthors, newAuthor], editForm: { ...s.editForm, authorInput: '' } }));
                        }}>➕ Add</button>
                    </div>

                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Date <span style="font-weight:normal;">(YYYY or YYYY-MM-DD)</span>:</label>
                    <input type="text" style="width: 100%; padding: 8px; margin-bottom: 15px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" .value=${this.editForm.dateStr} @input=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, dateStr: e.target.value } }))}>
                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:5px;">Other Metadata (CSL-JSON):</label>
                    <textarea style="flex: 1; min-height: 200px; margin-bottom: 15px; font-family: monospace; font-size: 13px; padding: 10px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; resize: vertical;" .value=${this.editForm.jsonStr} @input=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, jsonStr: e.target.value } }))}></textarea>
                </div>
                <sutram-async-btn slot="footer" label="🗑️ Delete" intent="danger" .onClick=${this._deleteDynamicCitation.bind(this)}></sutram-async-btn>
                <sutram-async-btn slot="footer" label="💾 Save Changes" intent="primary" .onClick=${this._saveDynamicCitation.bind(this)}></sutram-async-btn>
            </sutram-modal>
        `;
    }
    render() {
        return html`
            ${this.currentViewMode === 'lib-main' ? this._renderMain() : ''}
            ${this.currentViewMode === 'lib-explore' ? this._renderExplore() : ''}
            ${this.currentViewMode === 'lib-import' ? this._renderImport() : ''}
            ${this._renderModals()}
            <insetu-ext-citations-modals></insetu-ext-citations-modals>
        `;
    }
}
customElements.define('insetu-ext-citations', InSetuExtCitations);
export class InSetuExtCitationsModals extends InSetuElement {
    static get extensionName() { return 'citations'; }
    static properties = {
        citationModalOpen: { type: Boolean },
        citationSearchQuery: { type: String },
        citationLibraryCache: { type: Array }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.citationModalOpen = false;
        this.citationSearchQuery = '';
        this.citationLibraryCache = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(CitationStore, state => {
            this.citationModalOpen = state.citationModalOpen || false;
            this.citationSearchQuery = state.citationSearchQuery || '';
            this.citationLibraryCache = state.citationLibraryCache || [];
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    render() {
        const q = this.citationSearchQuery.trim();
        const results = q ? window.inSetu.utils.fuzzyFilterObjects(this.citationLibraryCache, q, c => `${c.title || ''} ${c.id || ''} ${c.author ? c.author.map(a => a.family).join(" ") : ''}`).slice(0, 30) : [];
        return html`
            <sutram-modal ?open=${this.citationModalOpen} ?fullscreen=${true} titleText="Insert Citation" @sutram-modal-closed=${() => CitationStore.setState({ citationModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <input type="text" placeholder="Search library by author, title, or ID..." style="padding: 8px; margin-bottom: 10px;" .value=${this.citationSearchQuery} @input=${(e) => CitationStore.setState({ citationSearchQuery: e.target.value })}>
                    <div style="display: flex; flex-direction: column; overflow-y: auto; flex: 1; gap: 5px;">
                        ${!q ? html`<span style="color:var(--text-muted); font-style:italic;">Type to search...</span>` : results.length === 0 ? html`<span style="color:var(--text-muted); font-style:italic;">No citations found.</span>` : results.map(c => {
                            const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
                            const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';
                            return html`
                                <insetu-card
                                    .filename=${c.id}
                                    .titleText=${c.title || 'Untitled'}
                                    .descriptionText=${`${authors} (${year})`}
                                    icon="📄"
                                    intentColor="var(--intent-primary)"
                                    @card-clicked=${() => this._insertCitationToEditor(c)}>
                                </insetu-card>
                            `;
                        })}
                    </div>
                </div>
            </sutram-modal>
        `;
    }
    _insertCitationToEditor(citation) {
        const author = citation.author && citation.author[0] ? citation.author[0].family : 'unknown';
        const year = citation.issued && citation.issued['date-parts'] ? citation.issued['date-parts'][0][0] : 'nd';
        const norm = window.inSetu.utils.normalizeAccentText || (str => str.toLowerCase());
        const normalizedAuthor = norm(author).replace(/[^a-z0-9]/g, '');
        const baseId = `${normalizedAuthor}${year}`;
        // Use OS-level APIs to avoid Shadow DOM contamination
        const text = this.editor && this.editor.getEditorContent ? this.editor.getEditorContent() : '';
        const backmatterRegex = /\n+---\n+citations:\n([\s\S]*?)\n---$/;
        const match = text.match(backmatterRegex);

        const citationsMap = {};
        if (match) {
            const lines = match[1].split('\n');
            lines.forEach(l => {
                const parts = l.split(':');
                if (parts.length >= 2) citationsMap[parts[0].trim()] = parts.slice(1).join(':').replace(/['"]/g, '').trim();
            });
        }
        const finalPrettyId = (() => {
            if (!citationsMap[baseId] || citationsMap[baseId] === citation.id) return baseId;
            const findAvailable = (code) => {
                if (!citationsMap[baseId + String.fromCharCode(code)] || citationsMap[baseId + String.fromCharCode(code)] === citation.id) return code;
                return findAvailable(code + 1);
            };
            return baseId + String.fromCharCode(findAvailable(97));
        })();
        citationsMap[finalPrettyId] = citation.id;
        const newBackmatter = "\n\n---\ncitations:\n" + Object.keys(citationsMap).map(k => `  ${k}: "${citationsMap[k]}"\n`).join('') + "---";
        const updatedText = match ? text.replace(match[0], newBackmatter) : text + newBackmatter;
        const linkText = `[@${finalPrettyId}]`;

        if (this.editor && this.editor.setEditorContent) this.editor.setEditorContent(updatedText);
        if (this.editor && this.editor.insertTextAtCursor) this.editor.insertTextAtCursor(linkText);
        CitationStore.setState({ citationModalOpen: false });
        if (window.inSetu.stores.Fs?.getState()?.fileModal?.isFS && window.inSetu.ui?.saveModalFile) {
            window.inSetu.ui.saveModalFile(true);
        }
    }
}
customElements.define('insetu-ext-citations-modals', InSetuExtCitationsModals);
window.ExtensionRegistry.registerExtension('citations', {
    name: "Reference Manager",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'citation',
            id: 'cit-notes',
            label: 'Notes',
            icon: '📝',
            intent: 'highlight',
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:citations:notes', detail: { id: data.id } })
        },
        {
            targetEntity: 'citation',
            id: 'cit-edit',
            label: 'Edit',
            icon: '✏️',
            intent: 'warning',
            order: 20,
            emitEvent: (data) => ({ name: 'insetu:citations:edit', detail: { data } })
        },
        {
            targetEntity: 'citation',
            id: 'cit-pin',
            label: 'Pin to Repo',
            icon: '📌',
            intent: 'primary',
            order: 30,
            emitEvent: (data) => ({ name: 'insetu:citations:pin', detail: { data } })
        },
        {
            targetEntity: 'explore_citation',
            id: 'cit-import',
            label: (data) => data.alreadyExists ? 'Force Import' : 'Import',
            icon: (data) => data.alreadyExists ? '⚠️' : '📥',
            intent: (data) => data.alreadyExists ? 'warning' : 'success',
            order: 10,
            match: (data) => !data.isImporting,
            emitEvent: (data) => ({ name: 'insetu:citations:import', detail: { data } })
        }
    ],
    layoutSlots: [
        { slot: "slots:primary-navigation", id: "library", label: "Library", order: 4 },
        { slot: "slots:sub-navigation", targetParent: "library", id: "lib-main", label: "Main", order: 1, component: "insetu-ext-citations" },
        { slot: "slots:sub-navigation", targetParent: "library", id: "lib-explore", label: "Explore", order: 2, component: "insetu-ext-citations" },
        { slot: "slots:sub-navigation", targetParent: "library", id: "lib-import", label: "Import", order: 3, component: "insetu-ext-citations" }
    ],
    uiHooks: {
        'zone:modal-ext-menu': (data) => {
            if (data.isMarkdown) {
                data.menuItems.push({ label: 'Cite', icon: '📚', onClick: async () => {
                    CitationStore.setState({ citationModalOpen: true, citationSearchQuery: '' });
                    try {
                        const res = await window.inSetu.api.workspace('citations/list');
                        if (res.ok) {
                            const data = await res.json();
                            CitationStore.setState({ citationLibraryCache: data.citations || [] });
                        }
                    } catch(e) {}
                }});
                data.menuItems.push({ label: 'Sync Refs', icon: '🔄', onClick: () => window.inSetu.events.emit('insetu:citations:sync') });
            }
            return false;
        },
        'zone:tab-changed': (tabId) => {
            if (tabId === 'library') {
                CitationStore.setState({
                    reposExpanded: false,
                    bucketsExpanded: {}
                });
                window.inSetu.events.emit('citations-load-main');
            }
        }
    }
});
