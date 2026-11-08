import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const CitationStore = createExtensionStore('Citations', {
    localLibrary: [],
    pinnedRepos: new Set(['ALL']),
    mainLoading: false,
    mainSearchQuery: '',
    exploreSearchQuery: '',
    exploreSource: 'openalex',
    exploreField: 'all',
    exploreCategory: '',
    exploredItems: [],
    currentExplorePage: 1,
    importJsonInput: '',
    importLog: '',
    importStrategy: 'overwrite',
    activeAttachCitation: null,
    activeEditCitation: null,
    currentEditAuthors: [],
    citationModalOpen: false,
    citationSearchQuery: '',
    citationLibraryCache: [],
    attachForm: { repo: '', bucket: 'None' },
    editForm: { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' },
    importingIds: new Set(),
    fetchLibrary: window.inSetu.utils.coalescedAsync(async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('citations')) return;
        CitationStore.setState({ mainLoading: true });
        try {
            const res = await window.inSetu.api.get('citations/list');
            if (res.ok) {
                const data = await res.json();
                CitationStore.setState({ localLibrary: data.citations || [] });
            }
        } catch (e) {
            console.error(e);
        } finally {
            CitationStore.setState({ mainLoading: false });
        }
    })
});

window.inSetu.stores.Citations = CitationStore;
import { html } from 'lit';
export class InSetuExtCitations extends InSetuElement {
    static get extensionName() { return 'citations'; }
    static properties = {
        importingIds: { type: Object },
        localLibrary: { type: Array },
        pinnedRepos: { type: Object },
        mainSearchQuery: { type: String },
        exploreSearchQuery: { type: String },
        exploreSource: { type: String },
        exploreField: { type: String },
        exploreCategory: { type: String },
        exploredItems: { type: Array },
        mainLoading: { type: Boolean },
        currentExplorePage: { type: Number },
        importJsonInput: { type: String },
        importLog: { type: String },
        importStrategy: { type: String },
        allRepos: { type: Array }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.localLibrary = [];
        this.pinnedRepos = new Set(['ALL']);
        this.mainSearchQuery = '';
        this.exploreSearchQuery = '';
        this.exploreSource = 'openalex';
        this.exploreField = 'all';
        this.exploreCategory = '';
        this.exploredItems = [];
        this.mainLoading = false;
        this.currentExplorePage = 1;
        this.importJsonInput = '';
        this.importLog = '';
        this.importStrategy = 'overwrite';
        this.allRepos = [];
        this.importingIds = new Set();
    }
    get currentViewMode() {
        const raw = this.dataset.subId || 'lib-main';
        return raw.includes(':') ? raw.split(':').pop() : raw;
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            CitationStore,
            state => ({
                localLibrary: state.localLibrary || [],
                mainLoading: !!state.mainLoading,
                mainSearchQuery: state.mainSearchQuery || '',
                exploreSearchQuery: state.exploreSearchQuery || '',
                exploreSource: state.exploreSource || 'openalex',
                exploreField: state.exploreField || 'all',
                exploreCategory: state.exploreCategory || '',
                exploredItems: state.exploredItems || [],
                currentExplorePage: state.currentExplorePage || 1,
                importJsonInput: state.importJsonInput || '',
                importLog: state.importLog || '',
                importStrategy: state.importStrategy || 'overwrite',
                importingIds: state.importingIds || new Set(),
                pinnedRepos: state.pinnedRepos || new Set(['ALL'])
            }),
            { autoFetch: 'fetchLibrary' }
        );
        this.subscribe(
            AppStore,
            state => state.allRepos || [],
            (allRepos) => {
                this.allRepos = allRepos;
            }
        );
        this.registerGlobalListener('sutram-sync-complete', window, () => CitationStore.getState().fetchLibrary());
    }
    onViewActivated() {
        CitationStore.getState().fetchLibrary();
    }
    onForceRefresh() {
        super.onForceRefresh();
        CitationStore.getState().fetchLibrary();
    }

    _getExploreSearchAction(loadMore = false) {
        return this.api.bindJobAction('citations/search', () => {
            const st = CitationStore.getState();
            const query = (st.exploreSearchQuery || '').trim();
            const category = (st.exploreCategory || '').trim();
            if (!query && !category) throw new Error("Enter a search query or topic filter.");
            const pageToFetch = loadMore ? (st.currentExplorePage || 1) : 1;
            if (!loadMore) {
                CitationStore.setState({ exploredItems: [], currentExplorePage: 1 });
            }
            return {
                q: query,
                source: st.exploreSource,
                field: st.exploreField,
                category: category,
                page: pageToFetch
            };
        }, {
            onComplete: (statusData) => {
                const st = CitationStore.getState();
                const pageFetched = loadMore ? (st.currentExplorePage || 1) : 1;
                const citations = statusData.artifact?.citations || [];
                CitationStore.setState({
                    exploredItems: loadMore ? [...(st.exploredItems || []), ...citations] : citations,
                    currentExplorePage: citations.length === 20 ? pageFetched + 1 : pageFetched
                });
            },
            onError: (err) => {
                this.setStatus(`❌ Catalog search failed: ${err.message}`, 4000, true);
            }
        });
    }

    async _executeJsonImport() {
        const raw = (CitationStore.getState().importJsonInput || '').trim();
        if (!raw) throw new Error("Paste CSL-JSON or select a workspace JSON file first.");
        CitationStore.setState({ importLog: "Parsing JSON...\n" });
        let jsonPayload;
        try {
            jsonPayload = JSON.parse(raw);
        } catch (err) {
            CitationStore.setState(s => ({ importLog: s.importLog + `❌ JSON Parse Error: ${err.message}\n` }));
            throw err;
        }
        const citations = Array.isArray(jsonPayload?.items) ? jsonPayload.items : jsonPayload;
        if (!Array.isArray(citations)) {
            const msg = "❌ Invalid format: expected an array of CSL-JSON objects.\n";
            CitationStore.setState(s => ({ importLog: s.importLog + msg }));
            throw new Error("Expected an array of CSL-JSON objects.");
        }
        CitationStore.setState(s => ({ importLog: s.importLog + `Uploading ${citations.length} records...\n` }));
        const res = await this.api.post('citations/import', {
            citations,
            strategy: CitationStore.getState().importStrategy
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            CitationStore.setState(s => ({ importLog: s.importLog + `❌ Import failed: ${data.error || 'Unknown error'}\n` }));
            throw new Error(data.error || "Import failed");
        }
        let msg = `✅ ${data.message}\n`;
        if (data.conflicts?.length > 0) msg += `⚠️ ${data.conflicts.length} conflicts flagged.\n`;
        CitationStore.setState(s => ({ importLog: s.importLog + msg, importJsonInput: '' }));
        CitationStore.getState().fetchLibrary();
    }

    _pickWorkspaceJsonFile() {
        if (!this.ui?.openWorkspaceBrowser || !this.vfs?.getGlobalManifest) return;
        const jsonFiles = this.vfs.getGlobalManifest().filter(f => f.toLowerCase().endsWith('.json'));
        this.ui.openWorkspaceBrowser({
            mode: 'file',
            title: 'Select CSL-JSON File',
            files: jsonFiles,
            autoDrilldown: true,
            callback: async (filepath) => {
                try {
                    const fetchUrl = this.vfs.resolveFileFetchUrl ? this.vfs.resolveFileFetchUrl(filepath, true) : filepath;
                    const text = await this.api.fetchImmutableText(fetchUrl);
                    CitationStore.setState({ importJsonInput: text || '', importLog: `Loaded ${filepath}\n` });
                } catch (err) {
                    this.setStatus(`❌ Failed to read ${filepath}: ${err.message}`, 4000, true);
                }
            }
        });
    }
    _renderCard(c, isExplore) {
        const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
        const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';
        const isImporting = this.importingIds && this.importingIds.has(c.id);
        const alreadyExists = isExplore ? this.localLibrary.some(libItem => libItem.id === c.id || (libItem.URL && c.URL && libItem.URL.toLowerCase() === c.URL.toLowerCase())) : false;

        const attTags = !isExplore && c._attachments && c._attachments.length > 0
            ? c._attachments.map(a => html`<sutram-tag text="${a.repo}${a.bucket !== 'None' ? ':'+a.bucket : ''}" intent="neutral"></sutram-tag>`)
            : '';
        return html`
            <sutram-card
                .filename=${c.id}
                .titleText=${c.title || 'Untitled'}
                .descriptionText=${`${authors} (${year})`}
                .detailText=${`[@${c.id}]`}
                icon="file-text"
                intent="highlight"
                entityType=${isExplore ? 'explore_citation' : 'citation'}
                .entityData=${{ ...c, isImporting, isExplore, alreadyExists }}>
                <sutram-stack direction="col" gap="xs">
                    ${c.open_access ? html`
                        <sutram-stack direction="row" align="center" gap="xs">
                            <sutram-icon name="unlock" size="sm" intent="success"></sutram-icon>
                            <sutram-tag text="Open Access" intent="success"></sutram-tag>
                        </sutram-stack>
                    ` : ''}
                    ${c.URL ? html`
                        <sutram-stack direction="row" align="center" gap="xs">
                            <sutram-icon name="globe" size="sm" intent="success"></sutram-icon>
                            <sutram-label intent="success" ?monospace=${true} ?truncate=${true} .text=${c.URL}></sutram-label>
                        </sutram-stack>
                    ` : ''}
                    ${attTags ? html`<sutram-stack direction="row" gap="xs" ?wrap=${true}>${attTags}</sutram-stack>` : ''}
                </sutram-stack>
            </sutram-card>
        `;
    }
    _renderMain() {
        const activePins = Array.from(this.pinnedRepos || []);
        const pinnedSet = this.localLibrary.filter(c => {
            const atts = c._attachments || [];
            if (activePins.includes('ALL')) return true;
            return (activePins.includes('ORPHANS') && atts.length === 0) || atts.some(a => activePins.includes(a.repo));
        });
        const filtered = this.filterItems(pinnedSet, {
            pinnedRepos: new Set(['ALL']),
            searchQuery: this.mainSearchQuery,
            searchFields: c => [c.title || '', c.id || '', c.author ? c.author.map(a => a.family).join(' ') : ''].join(' ')
        });
        return html`
            <sutram-view>
                <sutram-toolbar
                    slot="toolbar"
                    searchPlaceholder="Fuzzy search personal library..."
                    .searchQuery=${this.mainSearchQuery}
                    @search-changed=${(e) => CitationStore.setState({ mainSearchQuery: e.detail.value })}
                    ?flush=${true}>
                    <sutram-surface slot="bottom-row" variant="panel" border="top" padding="xs">
                        <insetu-repo-filter
                            label="Repos:"
                            .repos=${this.allRepos}
                            .activeRepos=${Array.from(this.pinnedRepos)}
                            .extraRepos=${[{id: "ORPHANS", label: "Orphans"}]}
                            @repo-filter-changed=${(e) => CitationStore.setState({ pinnedRepos: new Set(e.detail.activeRepos) })}>
                        </insetu-repo-filter>
                    </sutram-surface>
                </sutram-toolbar>
                ${this.mainLoading ? html`<sutram-spinner text="Loading library..."></sutram-spinner>` : ''}
                <sutram-stack direction="col" gap="sm">
                    ${filtered.length === 0 ? html`<sutram-empty-state text="No results."></sutram-empty-state>` : filtered.map(c => this._renderCard(c, false))}
                </sutram-stack>
            </sutram-view>
        `;
    }

    _renderExplore() {
        return html`
            <sutram-view>
                <sutram-stack direction="col" gap="md">
                    <sutram-surface variant="panel" padding="md" gap="sm">
                        <sutram-select 
                            label="Catalog Source" 
                            .value=${this.exploreSource} 
                            .options=${[
                                { value: 'openalex', label: 'OpenAlex (Recommended)' },
                                { value: 'crossref', label: 'Crossref (DOIs & Exact Titles)' },
                                { value: 'semanticscholar', label: 'Semantic Scholar' }
                            ]}
                            @sutram-input-changed=${e => CitationStore.setState({ exploreSource: e.detail.value })}>
                        </sutram-select>
                        <sutram-input 
                            label="Search Query" 
                            placeholder="${this.exploreSource === 'crossref' ? 'DOIs, precise titles, or authors...' : 'Keywords, titles, or authors...'}" 
                            .value=${this.exploreSearchQuery} 
                            @sutram-input-changed=${e => CitationStore.setState({ exploreSearchQuery: e.detail.value })}>
                        </sutram-input>
                        ${this.exploreSource === 'openalex' ? html`
                            <sutram-stack direction="grid" ?compact=${true}>
                                <sutram-select 
                                    label="Target Field" 
                                    .value=${this.exploreField} 
                                    .options=${[
                                        { value: 'all', label: 'All Fields' },
                                        { value: 'title', label: 'Title Only' }
                                    ]}
                                    @sutram-input-changed=${e => CitationStore.setState({ exploreField: e.detail.value })}>
                                </sutram-select>
                                <sutram-input 
                                    label="Topic Filter" 
                                    placeholder="e.g., Ethnomusicology..." 
                                    .value=${this.exploreCategory} 
                                    @sutram-input-changed=${e => CitationStore.setState({ exploreCategory: e.detail.value })}>
                                </sutram-input>
                            </sutram-stack>
                        ` : ''}
                        ${this.exploreSource === 'crossref' ? html`
                            <sutram-select 
                                label="Target Field" 
                                .value=${this.exploreField} 
                                .options=${[
                                    { value: 'all', label: 'All Fields' },
                                    { value: 'title', label: 'Title Only' }
                                ]}
                                @sutram-input-changed=${e => CitationStore.setState({ exploreField: e.detail.value })}>
                            </sutram-select>
                        ` : ''}
                        <sutram-async-btn intent="highlight" icon="search" label="Search Catalog" loadingLabel="Querying Catalogs..." ?fullWidth=${true} .onClick=${this._getExploreSearchAction(false)}></sutram-async-btn>
                    </sutram-surface>
                    <sutram-stack direction="col" gap="sm">
                        ${this.exploredItems.length === 0 ? html`<sutram-empty-state text="Search the open science index to discover and import citations."></sutram-empty-state>` : ''}
                        ${this.exploredItems.map(c => this._renderCard(c, true))}
                        ${this.exploredItems.length > 0 && this.exploredItems.length % 20 === 0 ? html`
                            <sutram-async-btn ?compact=${true} intent="neutral" icon="download" label="Load More" .onClick=${this._getExploreSearchAction(true)}></sutram-async-btn>
                        ` : ''}
                    </sutram-stack>
                </sutram-stack>
            </sutram-view>
        `;
    }

    _renderImport() {
        return html`
            <sutram-view .titleText=${'Import CSL-JSON'} .descriptionText=${'Paste or load a CSL-JSON export from Zotero or Better BibTeX.'}>
                <sutram-stack direction="col" gap="md">
                    <sutram-surface variant="panel" padding="md" gap="sm">
                        <sutram-select
                            label="Conflict Strategy"
                            .value=${this.importStrategy}
                            .options=${[
                                { value: 'overwrite', label: 'Overwrite Existing' },
                                { value: 'skip', label: 'Skip Existing' },
                                { value: 'manual', label: 'Manual Resolve' }
                            ]}
                            @sutram-input-changed=${e => CitationStore.setState({ importStrategy: e.detail.value })}>
                        </sutram-select>
                        <sutram-textarea
                            label="CSL-JSON Payload"
                            placeholder='[{"id": "smith2024", "type": "article-journal", "title": "..."}]'
                            ?monospace=${true}
                            size="wide"
                            .value=${this.importJsonInput}
                            @sutram-input-changed=${e => CitationStore.setState({ importJsonInput: e.detail.value })}>
                        </sutram-textarea>
                        <sutram-stack direction="row" justify="end" gap="sm" ?wrap=${true}>
                            <sutram-btn ?compact=${true} intent="neutral" icon="folder" label="Load Workspace JSON..." @click=${() => this._pickWorkspaceJsonFile()}></sutram-btn>
                            <sutram-async-btn ?compact=${true} intent="success" icon="download" label="Import Citations" .onClick=${() => this._executeJsonImport()}></sutram-async-btn>
                        </sutram-stack>
                    </sutram-surface>
                    ${this.importLog ? html`<sutram-textarea readonly ?monospace=${true} .value=${this.importLog}></sutram-textarea>` : ''}
                </sutram-stack>
            </sutram-view>
        `;
    }
    render() {
        return html`
            ${this.currentViewMode === 'lib-main' ? this._renderMain() : ''}
            ${this.currentViewMode === 'lib-explore' ? this._renderExplore() : ''}
            ${this.currentViewMode === 'lib-import' ? this._renderImport() : ''}
        `;
    }
}
customElements.define('insetu-ext-citations', InSetuExtCitations);
export class InSetuExtCitationsModals extends InSetuElement {
    static get extensionName() { return 'citations'; }
    static properties = {
        citationModalOpen: { type: Boolean },
        citationSearchQuery: { type: String },
        citationLibraryCache: { type: Array },
        activeAttachCitation: { type: Object },
        activeEditCitation: { type: Object },
        currentEditAuthors: { type: Array },
        attachForm: { type: Object },
        editForm: { type: Object },
        allRepos: { type: Array }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.citationModalOpen = false;
        this.citationSearchQuery = '';
        this.citationLibraryCache = [];
        this.activeAttachCitation = null;
        this.activeEditCitation = null;
        this.currentEditAuthors = [];
        this.attachForm = { repo: '', bucket: 'None' };
        this.editForm = { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' };
        this.allRepos = [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            CitationStore,
            state => ({
                citationModalOpen: !!state.citationModalOpen,
                citationSearchQuery: state.citationSearchQuery || '',
                citationLibraryCache: state.citationLibraryCache || [],
                activeAttachCitation: state.activeAttachCitation,
                activeEditCitation: state.activeEditCitation,
                currentEditAuthors: state.currentEditAuthors || [],
                attachForm: state.attachForm || { repo: '', bucket: 'None' },
                editForm: state.editForm || { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' }
            }),
            (slice) => {
                Object.assign(this, slice);
            }
        );
        this.subscribe(
            AppStore,
            state => state.allRepos || [],
            (allRepos) => {
                this.allRepos = allRepos;
            }
        );
        this.registerGlobalListener('insetu:citations:notes', window, (e) => this._openCitationNotes(e.detail.id));
        this.registerGlobalListener('insetu:citations:edit', window, (e) => this._openEditModal(e.detail.data));
        this.registerGlobalListener('insetu:citations:pin', window, (e) => this._openAttachModal(e.detail.data));
        this.registerGlobalListener('insetu:citations:import', window, (e) => this._importExploreCitation(e.detail.data));
    }
    async _importExploreCitation(payload) {
        CitationStore.setState(state => {
            const newSet = new Set(state.importingIds);
            newSet.add(payload.id);
            return { importingIds: newSet };
        });
        try {
            await this.api.post('citations/import', { citations: [payload], strategy: 'overwrite' }, { collapseKey: `citations:import:${payload.id}` });
            CitationStore.getState().fetchLibrary();
            this.setStatus(`✅ Imported [@${payload.id}]`, 2500);
        } catch (err) {
            this.setStatus(`❌ Error importing citation: ${err.message}`, 4000, true);
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
            const res = await this.api.post('fs/search', { q: cslId });
            if (res.ok) {
                const data = await res.json();
                const results = await new Promise((resolve, reject) => {
                    if (res.status !== 202) return resolve(data.results || []);
                    this.api.pollJob(data.job_id, {
                        onComplete: (statusData) => resolve(statusData.artifact?.results || []),
                        onError: (err) => reject(err)
                    });
                });

                if (results && results.length === 1) {
                    if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(results[0].path, true);
                } else if (results && results.length > 1) {
                    if (this.ui && this.ui.openLinkModal) {
                        this.ui.openLinkModal(cslId, 'deep');
                    }
                } else {
                    this.setStatus("No markdown files found referencing this citation ID.", 3000);
                }
            }
        } catch(e) {
            console.error(e);
            this.setStatus("Error searching for notes.", 3000, true);
        }
    }
    _openAttachModal(citation) {
        CitationStore.setState(state => ({
            activeAttachCitation: citation,
            attachForm: { ...state.attachForm, repo: this.allRepos[0] || '', bucket: 'None' }
        }));
    }
    async _saveAttachmentList(newAtts) {
        if (!this.activeAttachCitation) return;
        const res = await this.api.post(`citations/${encodeURIComponent(this.activeAttachCitation.id)}/attach`, { attachments: newAtts }, { collapseKey: `citations:attach:${this.activeAttachCitation.id}` });
        if (!res.ok) throw new Error('Failed to save attachment.');
        const data = await res.json().catch(() => ({}));
        CitationStore.setState({ activeAttachCitation: { ...this.activeAttachCitation, _attachments: newAtts } });
        if (data.job_id === 'offline_queue') {
            const id = this.activeAttachCitation.id;
            CitationStore.setState(s => ({
                localLibrary: s.localLibrary.map(c => c.id === id ? { ...c, _attachments: newAtts } : c)
            }));
        } else {
            CitationStore.getState().fetchLibrary();
        }
    }
    _openEditModal(citation) {
        const initialDateStr = (citation.issued && citation.issued['date-parts'] && citation.issued['date-parts'][0]) ? citation.issued['date-parts'][0].join('-') : '';
        const cslData = { ...citation };
        delete cslData._attachments; delete cslData.type; delete cslData.title; delete cslData['container-title']; delete cslData.author; delete cslData.issued;

        CitationStore.setState({
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
        });
    }
    async _deleteDynamicCitation() {
        if (!this.activeEditCitation) return;
        if (!confirm(`Are you sure you want to completely delete this citation ([@${this.activeEditCitation.id}]) from your library?`)) return;
        const res = await this.api.delete(`citations/${encodeURIComponent(this.activeEditCitation.id)}`, { collapseKey: `citations:delete:${this.activeEditCitation.id}` });
        if (!res.ok) throw new Error("Failed to delete citation.");
        const data = await res.json().catch(() => ({}));
        const id = this.activeEditCitation.id;
        CitationStore.setState({ activeEditCitation: null });
        if (data.job_id === 'offline_queue') {
            CitationStore.setState(s => ({ localLibrary: s.localLibrary.filter(c => c.id !== id) }));
        } else {
            CitationStore.getState().fetchLibrary();
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
        const res = await this.api.post('citations/import', { citations: [payload], strategy: 'overwrite' }, { collapseKey: `citations:import:${payload.id}` });
        if (!res.ok) throw new Error("Failed to save citation.");
        const data = await res.json().catch(() => ({}));
        CitationStore.setState({ activeEditCitation: null });
        if (data.job_id === 'offline_queue') {
            CitationStore.setState(s => {
                const exists = s.localLibrary.some(c => c.id === payload.id);
                if (exists) return { localLibrary: s.localLibrary.map(c => c.id === payload.id ? payload : c) };
                return { localLibrary: [...s.localLibrary, payload] };
            });
        } else {
            CitationStore.getState().fetchLibrary();
        }
    }
    render() {
        const q = this.citationSearchQuery.trim();
        const results = (this.citationModalOpen && q) ? this.filterItems(this.citationLibraryCache, {
            pinnedRepos: new Set(['ALL']),
            searchQuery: q,
            searchFields: c => [c.title || '', c.id || '', c.author ? c.author.map(a => a.family).join(' ') : ''].join(' ')
        }).slice(0, 30) : [];
        return html`
            ${this.activeAttachCitation ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="Pin to Repo: [@${this.activeAttachCitation?.id}]" @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) CitationStore.setState({ activeAttachCitation: null }); }}>
                <sutram-stack slot="body" direction="col" gap="md">
                    <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                        <sutram-select ?grow=${true} .value=${this.attachForm.repo} .options=${this.allRepos.map(r => ({value: r, label: r}))} @sutram-input-changed=${e => CitationStore.setState(s => ({ attachForm: { ...s.attachForm, repo: e.detail.value, bucket: 'None' } }))}></sutram-select>
                        <sutram-select ?grow=${true} .value=${this.attachForm.bucket} .options=${[{value: 'None', label: 'No Bucket'}, ...(this.attachForm.repo ? this.sys.getFlattenedBuckets(this.attachForm.repo).map(b => ({value: b.id, label: b.title})) : [])]} @sutram-input-changed=${e => CitationStore.setState(s => ({ attachForm: { ...s.attachForm, bucket: e.detail.value } }))}></sutram-select>
                        <sutram-async-btn ?compact=${true} icon="pin" label="Pin" intent="success" .onClick=${() => this._saveAttachmentList([...(this.activeAttachCitation?._attachments || []), { repo: this.attachForm.repo, bucket: this.attachForm.bucket }])}></sutram-async-btn>
                    </sutram-stack>
                    <sutram-label text="Currently Pinned Repositories:"></sutram-label>
                    <sutram-stack direction="col" gap="xs">
                        ${(this.activeAttachCitation?._attachments || []).length === 0 ? html`<sutram-empty-state text="Not pinned to any repository."></sutram-empty-state>` : (this.activeAttachCitation?._attachments || []).map((a, idx) => html`
                            <sutram-surface variant="panel" padding="xs">
                                <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                    <sutram-label ?monospace=${true} .text=${`${a.repo}${a.bucket !== 'None' ? ' : ' + a.bucket : ''}`}></sutram-label>
                                    <sutram-btn ?compact=${true} variant="tinted" intent="danger" icon="x" label="Remove" @click=${() => {
                                        const atts = [...this.activeAttachCitation._attachments];
                                        atts.splice(idx, 1);
                                        this._saveAttachmentList(atts);
                                    }}></sutram-btn>
                                </sutram-stack>
                            </sutram-surface>
                        `)}
                    </sutram-stack>
                </sutram-stack>
            </sutram-modal>
            ` : ''}
            ${this.activeEditCitation ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="Edit: [@${this.activeEditCitation?.id}]" @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) CitationStore.setState({ activeEditCitation: null }); }}>
                <sutram-stack slot="body" direction="col" gap="md">
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
                    <sutram-input label="Item Title" .value=${this.editForm.title} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, title: e.detail.value } }))}></sutram-input>
                    <sutram-input label="Publication Title (e.g., Journal Name)" .value=${this.editForm.pubTitle} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, pubTitle: e.detail.value } }))}></sutram-input>

                    <sutram-label text="Authors:"></sutram-label>
                    <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                        ${this.currentEditAuthors.map((a, idx) => html`
                            <sutram-pill
                                pillId=${String(idx)}
                                labelText=${`${a.given ? `${a.family}, ${a.given}` : a.family || a.literal || 'Unknown'} ×`}
                                ?active=${true}
                                @sutram-pill-toggled=${() => {
                                    const updatedAuthors = [...this.currentEditAuthors];
                                    updatedAuthors.splice(idx, 1);
                                    CitationStore.setState({ currentEditAuthors: updatedAuthors });
                                }}>
                            </sutram-pill>
                        `)}
                    </sutram-stack>
                    <sutram-stack direction="row" align="end" gap="sm">
                        <sutram-input label="Author Input" placeholder="Last, First" ?grow=${true} .value=${this.editForm.authorInput} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, authorInput: e.detail.value } }))}></sutram-input>
                        <sutram-btn id="btn-add-cit-author" ?compact=${true} intent="primary" icon="plus" label="Add" @click=${() => {
                            const val = (this.editForm.authorInput || '').trim();
                            if (!val) return;
                            const parts = val.split(',').map(s => s.trim());
                            const newAuthor = parts.length > 1 ? { family: parts[0], given: parts.slice(1).join(', ') } : { family: parts[0] };
                            CitationStore.setState(s => ({ currentEditAuthors: [...s.currentEditAuthors, newAuthor], editForm: { ...s.editForm, authorInput: '' } }));
                        }}></sutram-btn>
                    </sutram-stack>
                    <sutram-input label="Date (YYYY or YYYY-MM-DD)" .value=${this.editForm.dateStr} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, dateStr: e.detail.value } }))}></sutram-input>
                    <sutram-textarea label="Other Metadata (CSL-JSON)" ?monospace=${true} .value=${this.editForm.jsonStr} @sutram-input-changed=${e => CitationStore.setState(s => ({ editForm: { ...s.editForm, jsonStr: e.detail.value } }))}></sutram-textarea>
                </sutram-stack>
                <sutram-async-btn slot="footer" icon="trash-2" label="Delete" intent="danger" .onClick=${this._deleteDynamicCitation.bind(this)}></sutram-async-btn>
                <sutram-async-btn slot="footer" icon="save" label="Save Changes" intent="primary" .onClick=${this._saveDynamicCitation.bind(this)}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
            ${this.citationModalOpen ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="Insert Citation" @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) CitationStore.setState({ citationModalOpen: false }); }}>
                <sutram-stack slot="body" direction="col" gap="sm">
                    <sutram-input placeholder="Search library by author, title, or ID..." .value=${this.citationSearchQuery} @sutram-input-changed=${(e) => CitationStore.setState({ citationSearchQuery: e.detail.value })}></sutram-input>
                    <sutram-stack direction="col" gap="xs">
                        ${!q ? html`<sutram-label text="Type to search..."></sutram-label>` : results.length === 0 ? html`<sutram-empty-state text="No citations found."></sutram-empty-state>` : results.map(c => {
                            const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
                            const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';
                            return html`
                                <sutram-card
                                    .filename=${c.id}
                                    .titleText=${c.title || 'Untitled'}
                                    .descriptionText=${`${authors} (${year})`}
                                    icon="file-text"
                                    intent="primary"
                                    @card-clicked=${() => this._insertCitationToEditor(c)}>
                                </sutram-card>
                            `;
                        })}
                    </sutram-stack>
                </sutram-stack>
            </sutram-modal>
            ` : ''}
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
    }
}
customElements.define('insetu-ext-citations-modals', InSetuExtCitationsModals);
window.ExtensionRegistry.registerExtension('citations', {
    name: "Reference Manager",
    version: "2.0.0",
    offline_mode: "full",
    entityActions: [
        {
            targetEntities: ['citation', 'explore_citation'],
            id: 'cit-open-url',
            label: 'Open URL',
            icon: 'external-link',
            intent: 'success',
            group: 'file',
            vfsBound: false,
            order: 5,
            match: (data) => Boolean(data && data.URL),
            onClick: (data) => window.open(data.URL, '_blank', 'noopener,noreferrer')
        },
        {
            targetEntity: 'citation',
            id: 'cit-notes',
            label: 'Notes',
            icon: '📝',
            intent: 'highlight',
            group: 'edit',
            vfsBound: false,
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:citations:notes', detail: { id: data.id } })
        },
        {
            targetEntity: 'citation',
            id: 'cit-edit',
            label: 'Edit',
            icon: '✏️',
            intent: 'warning',
            group: 'edit',
            vfsBound: false,
            order: 20,
            emitEvent: (data) => ({ name: 'insetu:citations:edit', detail: { data } })
        },
        {
            targetEntity: 'citation',
            id: 'cit-pin',
            label: 'Pin to Repo',
            icon: '📌',
            intent: 'primary',
            group: 'share',
            vfsBound: false,
            order: 30,
            emitEvent: (data) => ({ name: 'insetu:citations:pin', detail: { data } })
        },
        {
            targetEntity: 'explore_citation',
            id: 'cit-import',
            label: (data) => data.alreadyExists ? 'Force Import' : 'Import',
            icon: (data) => data.alreadyExists ? '⚠️' : '📥',
            intent: (data) => data.alreadyExists ? 'warning' : 'success',
            group: 'file',
            vfsBound: false,
            order: 10,
            match: (data) => !data.isImporting,
            emitEvent: (data) => ({ name: 'insetu:citations:import', detail: { data } })
        }
    ],
    layoutSlots: [
        { slot: "slots:global", component: "insetu-ext-citations-modals" },
        { slot: "slots:primary-navigation", id: "library", label: "Library", icon: "book-open", intent: "highlight", order: 4 },
        { slot: "slots:sub-navigation", targetParent: "library", id: "lib-main", label: "Main", icon: "book", intent: "primary", order: 1, component: "insetu-ext-citations" },
        { slot: "slots:sub-navigation", targetParent: "library", id: "lib-explore", label: "Explore", icon: "compass", intent: "highlight", order: 2, component: "insetu-ext-citations" },
        { slot: "slots:sub-navigation", targetParent: "library", id: "lib-import", label: "Import", icon: "download", intent: "neutral", order: 3, component: "insetu-ext-citations" }
    ]
});
