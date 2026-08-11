import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;

// 1. Unidirectional Data Flow (UDF) Store
export const NotesStore = createExtensionStore('Notes', {
    notes: [],
    loading: false,
    searchQuery: '',
    newNoteModalOpen: false,
    editNoteFilepath: null,
    noteForm: { title: '', repo: 'global', bucket: 'None', tags: '' },
    pinnedRepos: new Set(['ALL']),
    fetchNotes: async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('notes')) return;
        NotesStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace('notes/list');
            if (res.ok) {
                const data = await res.json();
                NotesStore.setState({ notes: data.notes || [] });
            }
        } catch (e) {
            console.error("Failed to fetch notes:", e);
        } finally {
            NotesStore.setState({ loading: false });
        }
    },

    saveNewNote: async () => {
        const { title, repo, bucket, tags } = NotesStore.getState().noteForm;
        if (!title) return alert("Title is required.");

        try {
            const res = await window.inSetu.api.workspace('notes/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, repo, sub_bucket: bucket, tags })
            });
            if (res.ok) {
                const data = await res.json();
                NotesStore.setState({ 
                    newNoteModalOpen: false, 
                    editNoteFilepath: data.filepath,
                    noteForm: { title: '', repo: 'global', bucket: 'None', tags: '' } 
                });
                NotesStore.getState().fetchNotes();
            } else {
                const err = await res.json();
                alert("Failed to create note: " + err.error);
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
});

window.inSetu.stores.Notes = NotesStore;

// 2. The Global Modal (New Notes)
export class InSetuExtNotesModals extends InSetuElement {
    static get extensionName() { return 'notes'; }
    static properties = {
        newNoteModalOpen: { type: Boolean },
        noteForm: { type: Object }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.newNoteModalOpen = false;
        this.noteForm = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(NotesStore, state => {
            this.newNoteModalOpen = state.newNoteModalOpen;
            this.noteForm = state.noteForm;
        });
    }

    render() {
        return html`
            <sutram-modal 
                ?open=${this.newNoteModalOpen} 
                ?fullscreen=${true}
                titleText="Create New Note"
                @sutram-modal-closed=${() => NotesStore.setState({ newNoteModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 5px;">
                    <sutram-input label="Note Title" .value=${this.noteForm.title} placeholder="e.g., API Architectural Decision" @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, title: e.detail.value }}))}></sutram-input>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                            <sutram-select label="Repository Mapping" .value=${this.noteForm.repo} .options=${[{value: 'global', label: 'Global OS Level'}, ...this.ecosystem.allRepos.map(r => ({value: r, label: r}))]} @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, repo: e.detail.value }}))}></sutram-select>
                        </div>
                        ${this.noteForm.repo !== 'global' ? (() => {
                            const buckets = this.sys.getFlattenedBuckets ? this.sys.getFlattenedBuckets(this.noteForm.repo) : [];
                            if (buckets.length > 0) {
                                return html`
                                    <div style="flex: 1; min-width: 150px;">
                                        <sutram-select label="Sub-Bucket (Optional)" .value=${this.noteForm.bucket} .options=${[{value: 'None', label: 'None'}, ...buckets.map(b => ({value: b.id, label: b.title}))]} @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, bucket: e.detail.value }}))}></sutram-select>
                                    </div>
                                `;
                            }
                            return '';
                        })() : ''}
                    </div>

                    <sutram-input label="Tags (comma separated)" .value=${this.noteForm.tags} placeholder="e.g., architecture, frontend, bug" @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, tags: e.detail.value }}))}></sutram-input>
                </div>

                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${() => NotesStore.getState().saveNewNote()}>
                    💾 Create & Open Note
                </button>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-notes-modals', InSetuExtNotesModals);

// 3. The Bespoke Editor Modal (Wraps the Primitive)
export class InSetuExtNotesEditor extends InSetuElement {
    static get extensionName() { return 'notes'; }
    static properties = {
        filepath: { type: String },
        allRepos: { type: Array },
        editForm: { type: Object }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];
    constructor() {
        super();
        this.filepath = null;
        this.allRepos = [];
        this.editForm = { title: '', repo: 'global', bucket: 'None', tags: '' };
        this._isDirty = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(NotesStore, state => {
            this.filepath = state.editNoteFilepath;
        });
        this.subscribe(window.inSetu.stores.Gather, state => {
            this.allRepos = state.allRepos || [];
        });
    }
    _onFrontmatterLoaded(e) {
        const yaml = e.detail.yaml;
        const tagsStr = (() => {
            try {
                const parsed = JSON.parse(yaml.tags);
                if (Array.isArray(parsed)) return parsed.join(', ');
                return yaml.tags || '';
            } catch(err) { return yaml.tags || ''; }
        })();

        this.editForm = {
            id: yaml.id || '',
            title: yaml.title || '',
            repo: yaml.repo || 'global',
            bucket: yaml.sub_bucket || 'None',
            tags: tagsStr,
            created_at: yaml.created_at || '',
            updated_at: yaml.updated_at || ''
        };
        this.requestUpdate();
    }
    _onRequestFrontmatter(e) {
        const { respond, currentYaml } = e.detail;

        const tagsArr = this.editForm.tags ? this.editForm.tags.split(',').map(t => t.trim()).filter(t => t) : [];

        const updatedYaml = {
            ...currentYaml,
            id: this.editForm.id,
            title: this.editForm.title,
            repo: this.editForm.repo,
            sub_bucket: this.editForm.bucket,
            tags: JSON.stringify(tagsArr),
            created_at: this.editForm.created_at,
            updated_at: new Date().toISOString().split('.')[0]
        };
        respond(updatedYaml);
    }
    async _deleteNote() {
        if (!this.filepath) return;
        if (!confirm("Are you sure you want to permanently delete this note? This cannot be undone.")) return;

        await this.sys.executeWorkspaceMutation('fs/delete', { filepath: this.filepath }, {
            onSuccess: () => {
                NotesStore.setState({ editNoteFilepath: null });
                NotesStore.getState().fetchNotes();
            }
        });
    }
    render() {
        return html`
            <sutram-modal 
                ?open=${!!this.filepath} 
                titleText="📝 ${this.filepath || ''}"
                ?fullscreen=${true}
                ?flush=${true}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @sutram-modal-closed=${() => NotesStore.setState({ editNoteFilepath: null })}>

                <div slot="body" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                    ${this.filepath ? html`
                        <insetu-frontmatter-editor
                            id="fm-editor"
                            .filepath=${this.filepath}
                            .defaultExpanded=${false}
                            @editor-dirty=${e => { this._isDirty = e.detail.isDirty; this.requestUpdate(); }}
                            @insetu:frontmatter-loaded=${this._onFrontmatterLoaded}
                            @insetu:request-frontmatter=${this._onRequestFrontmatter}>
                            <div slot="title-control" style="padding: 0;">
                                <sutram-textarea 
                                    .value=${this.editForm.title} 
                                    placeholder="Note Title..." 
                                    ?autoSize=${true}
                                    .minRows=${1}
                                    .maxHeight=${150}
                                    ?borderless=${true}
                                    style="font-weight: bold; font-size: 1.3rem; width: 100%; color: var(--text);"
                                    @sutram-input-changed=${e => { 
                                        const val = e.detail.value.replace(/[\r\n]+/g, ' '); 
                                        this.editForm.title = val; 
                                        this.requestUpdate(); 
                                    }}>
                                </sutram-textarea>
                            </div>
                            <div slot="metadata-controls" style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                    <sutram-select style="flex: 1; min-width: 150px; margin-bottom: 0;" label="Repository" .value=${this.editForm.repo} .options=${[{value: 'global', label: 'Global OS Level'}, ...this.allRepos.map(r => ({value: r, label: r}))]} @sutram-input-changed=${e => { this.editForm.repo = e.detail.value; this.requestUpdate(); }}></sutram-select>
                                    ${this.editForm.repo !== 'global' ? (() => {
                                        const buckets = this.sys.getFlattenedBuckets ? this.sys.getFlattenedBuckets(this.editForm.repo) : [];
                                        if (buckets.length > 0) {
                                            return html`<sutram-select style="flex: 1; min-width: 150px; margin-bottom: 0;" label="Sub-Bucket" .value=${this.editForm.bucket} .options=${[{value: 'None', label: 'None'}, ...buckets.map(b => ({value: b.id, label: b.title}))]} @sutram-input-changed=${e => { this.editForm.bucket = e.detail.value; this.requestUpdate(); }}></sutram-select>`;
                                        }
                                        return '';
                                    })() : ''}
                                </div>
                                <sutram-input style="width: 100%; margin-bottom: 0;" label="Tags" .value=${this.editForm.tags} placeholder="e.g., architecture, bug" @sutram-input-changed=${e => { this.editForm.tags = e.detail.value; this.requestUpdate(); }}></sutram-input>
                            </div>
                        </insetu-frontmatter-editor>
                    ` : ''}
                </div>
                ${this.filepath ? html`
                <div slot="footer" style="display: flex; justify-content: space-between; width: 100%;">
                    <button class="btn-sm" style="background: var(--intent-danger); color: white; margin: 0;" @click=${this._deleteNote}>🗑️ Delete</button>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-sm" style="background: var(--intent-warning); color: black; margin: 0;" @click=${() => {
                            const fp = this.filepath;
                            NotesStore.setState({ editNoteFilepath: null });
                            if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(fp, true, true);
                        }}>📝 Raw Edit</button>
                        ${this._isDirty ? html`<sutram-async-btn style="margin: 0;" label="💾 Save" intent="success" .onClick=${() => this.shadowRoot.getElementById('fm-editor')._handleSave()}></sutram-async-btn>` : ''}
                    </div>
                </div>
                ` : ''}
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-notes-editor', InSetuExtNotesEditor);

// 4. The Main View Component
export class InSetuExtNotes extends InSetuElement {
    static get extensionName() { return 'notes'; }
    static properties = {
        notes: { type: Array },
        loading: { type: Boolean },
        searchQuery: { type: String },
        pinnedRepos: { type: Object },
        allRepos: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
        .notes-body { flex: 1; overflow-y: auto; padding: 20px; }
        .task-tag { background: var(--border); color: var(--text); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; opacity: 0.8; }
        :host-context([data-theme="e-ink"]) .task-tag { background: #ffffff !important; color: #000000 !important; border: 1px dashed #000000 !important; opacity: 1 !important; }
    `];

    constructor() {
        super();
        this.notes = [];
        this.loading = false;
        this.searchQuery = '';
        this.pinnedRepos = new Set(['ALL']);
        this.allRepos = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(NotesStore, state => {
            this.notes = state.notes || [];
            this.loading = state.loading;
            this.searchQuery = state.searchQuery;
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        });
        this.subscribe(AppStore, state => {
            this.allRepos = state.allRepos || [];
            this.requestUpdate();
        });

        NotesStore.getState().fetchNotes();

        this.registerGlobalListener('insetu:notes:new', window, () => NotesStore.setState({ newNoteModalOpen: true }));
    }
    onWorkspaceChanged(newWorkspaceId) {
        NotesStore.getState().fetchNotes();
    }
    onForceRefresh() {
        NotesStore.getState().fetchNotes();
    }

    render() {
        const repoFilteredNotes = this.notes.filter(n => this.pinnedRepos.has('ALL') || this.pinnedRepos.has(n.repo));
        const filteredNotes = this.searchQuery 
            ? window.inSetu.utils.fuzzyFilterObjects(repoFilteredNotes, this.searchQuery, n => `${n.title} ${n.repo} ${(n.tags || []).join(' ')}`) 
            : repoFilteredNotes;

        return html`
            <sutram-toolbar
                searchPlaceholder="🔍 Fuzzy search notes..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => NotesStore.setState({ searchQuery: e.detail.value })}
                .enableFilterDropdown=${true}
                .activeFilters=${Array.from(this.pinnedRepos)}>
                <insetu-repo-filter
                    slot="filters"
                    label="📌 Repos:"
                    .repos=${this.allRepos}
                    .activeRepos=${Array.from(this.pinnedRepos)}
                    @repo-filter-changed=${(e) => NotesStore.setState({ pinnedRepos: new Set(e.detail.activeRepos) })}>
                </insetu-repo-filter>
            </sutram-toolbar>
            <div class="notes-body">
                ${this.loading ? html`<insetu-spinner text="Loading notes..."></insetu-spinner>` : ''}

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${filteredNotes.length === 0 && !this.loading ? html`<insetu-empty-state text="No notes found. Click '☰' to create one."></insetu-empty-state>` : ''}

                    ${filteredNotes.map(n => html`
                        <insetu-card
                            .filename=${n.filepath}
                            .titleText=${n.title}
                            .descriptionText=${`Repo: ${n.repo}${n.sub_bucket !== 'None' ? ` | Bucket: ${n.sub_bucket}` : ''}`}
                            .detailText=${this.utils.formatDate(n.updated_at)}
                            icon="📝"
                            intentColor="var(--intent-highlight)"
                            entityType="file:note"
                            .entityData=${{ filepath: n.filepath, isFS: true, repoDir: n.repo }}
                            @card-clicked=${() => NotesStore.setState({ editNoteFilepath: n.filepath })}>

                            <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
                                ${n.tags && n.tags.length > 0 ? n.tags.map(tag => html`<span class="task-tag">#${tag}</span>`) : ''}
                            </div>
                        </insetu-card>
                    `)}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-notes', InSetuExtNotes);

// 5. The Toolbar Actions
export class InSetuExtNotesActions extends InSetuElement {
    static get extensionName() { return 'notes'; }
    static styles = [sharedStyles];
    render() {
        return html`
            <sutram-dropdown align="right" .items=${[{ label: 'New Note', icon: '📝', onClick: () => this.dispatch('insetu:notes:new') }]}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </sutram-dropdown>
        `;
    }
}
customElements.define('insetu-ext-notes-actions', InSetuExtNotesActions);

// 6. Declarative Registration
window.ExtensionRegistry.registerExtension('notes', {
    name: "Notes Library",
    version: "1.0.0",
    entityActions: [],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-notes-modals"
        },
        {
            slot: "slots:global",
            component: "insetu-ext-notes-editor"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "notes",
            label: "Notes",
            order: 4,
            component: "insetu-ext-notes"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "edit",
            targetSub: "notes",
            component: "insetu-ext-notes-actions",
            order: 4
        }
    ],
    uiHooks: {
        'zone:vfs-mutated': (payload) => {
            if (!payload || !payload.mutations) return false;
            const touchedNote = payload.mutations.some(m => m.filepath && m.filepath.includes('.insetu/notes/'));
            if (touchedNote) NotesStore.getState().fetchNotes();

            // If the currently edited note was deleted or moved, close the editor safely
            const currentEdit = NotesStore.getState().editNoteFilepath;
            if (currentEdit) {
                const deleted = payload.mutations.find(m => m.filepath === currentEdit && m.operation === 'delete');
                if (deleted) NotesStore.setState({ editNoteFilepath: null });
            }
            return false;
        },
        'zone:file-edit-override': (filepath) => {
            if (filepath && filepath.includes('.insetu/notes/')) {
                NotesStore.setState({ editNoteFilepath: filepath });
                return true; // Intercepts the raw VFS modal and routes to the bespoke Drawer
            }
            return false;
        }
    }
});