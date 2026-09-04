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
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';
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
        this.registerGlobalListener('sutram-sync-complete', window, () => this.loadMainLibrary());
        const cState = CitationStore.getState();
        this.localLibrary = cState.localLibrary || [];
        const aState = AppStore.getState();
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);
        this.allRepos = aState.allRepos || [];
        this.loadMainLibrary();
    }
    onWorkspaceLoad(workspaceId) {
        this.loadMainLibrary();
    }
    onForceRefresh() {
        CitationStore.setState({
            reposExpanded: false,
            bucketsExpanded: {}
        });
        this.dispatch('insetu:citations:load-main');
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

            window.inSetu.utils.pollJob(data.job_id, {
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
            const res = await window.inSetu.api.post('fs/search', { q: cslId });
            if (res.ok) {
                const data = await res.json();
                const results = await (async () => {
                    if (res.status !== 202) return data.results || [];
                    const jobId = data.job_id;
                    while (true) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const pollRes = await window.inSetu.api.system.get(`jobs/${jobId}`);
                        if (!pollRes.ok) throw new Error("Search job failed");
                        const pollData = await pollRes.json();
                        if (pollData.status === 'completed') return pollData.artifact?.results || [];
                        if (pollData.status === 'failed') throw new Error(pollData.message);
                    }
                })();

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
                const data = await res.json().catch(()=>({}));
                CitationStore.setState({ activeAttachCitation: { ...this.activeAttachCitation, _attachments: newAtts } });
                if (data.job_id === 'offline_queue') {
                    const id = this.activeAttachCitation.id;
                    CitationStore.setState(s => ({
                        localLibrary: s.localLibrary.map(c => c.id === id ? { ...c, _attachments: newAtts } : c)
                    }));
                } else {
                    this.loadMainLibrary();
                }
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
                const data = await res.json().catch(()=>({}));
                const id = this.activeEditCitation.id;
                CitationStore.setState({ activeEditCitation: null });
                if (data.job_id === 'offline_queue') {
                    CitationStore.setState(s => ({ localLibrary: s.localLibrary.filter(c => c.id !== id) }));
                } else {
                    this.loadMainLibrary();
                }
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
                const data = await res.json().catch(()=>({}));
                CitationStore.setState({ activeEditCitation: null });
                if (data.job_id === 'offline_queue') {
                    CitationStore.setState(s => {
                        const exists = s.localLibrary.some(c => c.id === payload.id);
                        if (exists) return { localLibrary: s.localLibrary.map(c => c.id === payload.id ? payload : c) };
                        return { localLibrary: [...s.localLibrary, payload] };
                    });
                } else {
                    this.loadMainLibrary();
                }
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
                ${this.mainLoading ? html`<sutram-spinner text="Loading library..."></sutram-spinner>` : ''}
                <div style="display: flex; flex-direction: column; gap: 10px; opacity: ${this.mainLoading ? '0.6' : '1'}; transition: opacity 0.2s ease; pointer-events: ${this.mainLoading ? 'none' : 'auto'};">
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
                        <sutram-select 
                            label="Catalog Source" 
                            .value=${this.exploreSource} 
                            .options=${[
                                { value: 'openalex', label: 'OpenAlex (Recommended)' },
                                { value: 'crossref', label: 'Crossref (DOIs & Exact Titles)' },
                                { value: 'semanticscholar', label: 'Semantic Scholar' }
                            ]}
                            @sutram-input-changed=${e => this.exploreSource = e.detail.value}>
                        </sutram-select>
                    </div>
                    <div>
                        <sutram-input 
                            label="Search Query" 
                            placeholder="${this.exploreSource === 'crossref' ? 'DOIs, precise titles, or authors...' : 'Keywords, titles, or authors...'}" 
                            .value=${this.exploreSearchQuery} 
                            @sutram-input-changed=${e => this.exploreSearchQuery = e.detail.value}>
                        </sutram-input>
                    </div>
                    ${this.exploreSource === 'openalex' ? html`
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                            <sutram-select 
                                label="Target Field" 
                                .value=${this.exploreField} 
                                .options=${[
                                    { value: 'all', label: 'All Fields' },
                                    { value: 'title', label: 'Title Only' }
                                ]}
                                @sutram-input-changed=${e => this.exploreField = e.detail.value}>
                            </sutram-select>
                        </div>
                        <div style="flex: 1; min-width: 150px;">
                            <sutram-input 
                                label="Topic Filter" 
                                placeholder="e.g., Ethnomusicology..." 
                                .value=${this.exploreCategory} 
                                @sutram-input-changed=${e => this.exploreCategory = e.detail.value}>
                            </sutram-input>
                        </div>
                    </div>
                    ` : ''}
                    ${this.exploreSource === 'crossref' ? html`
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                            <sutram-select 
                                label="Target Field" 
                                .value=${this.exploreField} 
                                .options=${[
                                    { value: 'all', label: 'All Fields' },
                                    { value: 'title', label: 'Title Only' }
                                ]}
                                @sutram-input-changed=${e => this.exploreField = e.detail.value}>
                            </sutram-select>
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
                        <sutram-select style="flex:1; margin:0;" .value=${this.attachForm.repo} .options=${this.allRepos.map(r => ({value: r, label: r}))} @sutram-input-changed=${e => { CitationStore.setState(s => ({ attachForm: { ...s.attachForm, repo: e.detail.value, bucket: 'None' } })); }}></sutram-select>
                        <sutram-select style="flex:1; margin:0;" .value=${this.attachForm.bucket} .options=${[{value: 'None', label: 'No Bucket'}, ...(this.attachForm.repo ? this.sys.getFlattenedBuckets(this.attachForm.repo).map(b => ({value: b.id, label: b.title})) : [])]} @sutram-input-changed=${e => CitationStore.setState(s => ({ attachForm: { ...s.attachForm, bucket: e.detail.value } }))}></sutram-select>
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
                            <sutram-select label="Type" .value=${this.editForm.type} .options=${[
                                {value: 'article-journal', label: 'Journal Article'},
                                {value: 'book', label: 'Book'},
                                {value: 'chapter', label: 'Book Chapter'},
                                {value: 'paper-conference', label: 'Conference Paper'},
                                {value: 'article-magazine', label: 'Magazine Article'},
                                {value: 'article-newspaper', label: 'Newspaper Article'},
                                {value: 'webpage', label: 'Webpage'},
                                {value: 'thesis', label: 'Thesis'},
                                {value: 'report', label: 'Report'},
                                {value: 'document', label: 'Document (Generic)'}
                            ]} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, type: e.detail.value } }))}></sutram-select>
                        </div>
                    </div>
                    <sutram-input label="Item Title" .value=${this.editForm.title} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, title: e.detail.value } }))}></sutram-input>

                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <sutram-input label="Publication Title (e.g., Journal Name)" style="flex: 1;" .value=${this.editForm.pubTitle} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, pubTitle: e.detail.value } }))}></sutram-input>
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
                    <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: flex-end;">
                        <sutram-input label="Author Input" placeholder="Last, First" style="flex: 1; margin: 0;" .value=${this.editForm.authorInput} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, authorInput: e.detail.value } }))}></sutram-input>
                        <button id="btn-add-cit-author" class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 12px;" @click=${() => {
                            const val = (this.editForm.authorInput || '').trim();
                            if (!val) return;
                            const parts = val.split(',').map(s => s.trim());
                            const newAuthor = parts.length > 1 ? { family: parts[0], given: parts.slice(1).join(', ') } : { family: parts[0] };
                            CitationStore.setState(s => ({ currentEditAuthors: [...s.currentEditAuthors, newAuthor], editForm: { ...s.editForm, authorInput: '' } }));
                        }}>➕ Add</button>
                    </div>
                    <sutram-input label="Date (YYYY or YYYY-MM-DD)" .value=${this.editForm.dateStr} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, dateStr: e.detail.value } }))}></sutram-input>
                    <sutram-textarea label="Other Metadata (CSL-JSON)" .value=${this.editForm.jsonStr} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, jsonStr: e.detail.value } }))}></sutram-textarea>
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
                    <sutram-input placeholder="Search library by author, title, or ID..." .value=${this.citationSearchQuery} @sutram-input-changed=${(e) => CitationStore.setState({ citationSearchQuery: e.detail.value })}></sutram-input>
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
    offline_mode: "full",
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
    ]
});
