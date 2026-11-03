import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

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
    openNoteEditor: (filepath, title = null) => {
        if (!filepath) return;
        if (window.inSetu?.ui?.focusActivePopout && window.inSetu.ui.focusActivePopout(filepath)) {
            return;
        }
        NotesStore.setState({ editNoteFilepath: filepath });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            const existingCol = ['left', 'center', 'right'].find(col =>
                layout.columns[col]?.pinned?.some(p => p.id === filepath)
            );
            if (existingCol) {
                layout.setFocusedColumn(existingCol);
                layout.setActiveProjection(existingCol, filepath);
                return;
            }
            layout.openWindow({
                id: filepath,
                component: 'insetu-ext-notes-editor',
                label: title || new window.inSetu.utils.InSetuURI(filepath).basename,
                icon: 'file-text',
                intent: 'highlight',
                extName: 'notes',
                allow_popout: true
            }, layout.focusedColumn || 'center', 1);
        }
    },
    fetchNotes: window.inSetu.utils.coalescedAsync(async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('notes')) return;
        NotesStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.get('notes/list');
            if (res.ok) {
                const data = await res.json();
                const notesList = data.notes || [];
                NotesStore.setState({ notes: notesList });
                // Offline Cache Warming: Pre-fetch note blobs silently so they survive disconnects
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                const urlsToWarm = notesList.filter(n => n.filepath).map(n => `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(n.filepath)}`);
                if (urlsToWarm.length > 0 && window.inSetu?.stores?.App) {
                    window.inSetu.stores.App.getState().enqueueWarming(urlsToWarm);
                }
            }
        } catch (e) {
            console.error("Failed to fetch notes:", e);
        } finally {
            NotesStore.setState({ loading: false });
        }
    }),
    saveNewNote: async () => {
        const { title, repo, bucket, tags } = NotesStore.getState().noteForm;
        if (!title) return alert("Title is required.");
        const noteId = `note-${Math.random().toString(36).substr(2, 8)}`;
        const slug = window.inSetu.utils.slugify(title);
        const filename = `${slug}-${noteId}.md`;
        const targetRepo = repo || 'global';
        const filepath = targetRepo !== 'global'
            ? `vfs://${targetRepo}/.insetu-data/notes/${filename}`
            : `ctx://notes/${filename}`;

        const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(t=>t) : [];
        const now = new Date().toISOString().split('.')[0];

        const yamlObj = {
            id: noteId,
            title: title.replace(/"/g, "'"),
            repo: repo || 'global',
            sub_bucket: bucket || 'None',
            tags: tagsArr,
            created_at: now,
            updated_at: now
        };

        const rawContent = `## ${title}\n\n`;
        const content = window.inSetu.utils.serializeFrontmatter(yamlObj, rawContent);
        try {
            // Issuing a standard fs/save mutation ensures the backend Event Ledger syncs perfectly
            await window.inSetu.sys.executeWorkspaceMutation('fs/save', { filepath, content }, { 
                silent: true, 
                collapseKey: `vfs:save:${filepath}`,
                pendingMutations: [filepath],
                cacheBlobUrl: `/api/${window.inSetu.utils.getActiveWorkspace()}/fs/fetch?file=${encodeURIComponent(filepath)}`,
                cacheBlobContent: content
            });

            NotesStore.setState(s => ({  
                notes: [{ filepath, title, repo, sub_bucket: bucket, tags: tagsArr, updated_at: now }, ...s.notes],
                newNoteModalOpen: false, 
                editNoteFilepath: filepath,
                noteForm: { title: '', repo: 'global', bucket: 'None', tags: '' } 
            }));

            NotesStore.getState().openNoteEditor(filepath, title);

            if (!window.inSetu.stores.App.getState().isOffline) {
                NotesStore.getState().fetchNotes();
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
}, {
    onEvict: {
        'notes:editor': { editNoteFilepath: null }
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
    static styles = [sharedStyles];
    constructor() {
        super();
        this.newNoteModalOpen = false;
        this.noteForm = {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            NotesStore,
            state => ({ newNoteModalOpen: !!state.newNoteModalOpen, noteForm: state.noteForm || {} }),
            ({ newNoteModalOpen, noteForm }) => {
                this.newNoteModalOpen = newNoteModalOpen;
                this.noteForm = noteForm;
            }
        );
    }
    render() {
        if (!this.newNoteModalOpen) return html``;
        return html`
            <sutram-modal 
                ?open=${true} 
                titleText="Create New Note"
                @sutram-modal-closed=${() => NotesStore.setState({ newNoteModalOpen: false })}>
                <sutram-stack slot="body" direction="col" gap="md">
                    <sutram-input label="Note Title" ?flush=${true} .value=${this.noteForm?.title || ''} placeholder="e.g., API Architectural Decision" @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, title: e.detail.value }}))}></sutram-input>
                    <sutram-stack direction="grid" ?compact=${true}>
                        <sutram-select label="Repository Mapping" ?flush=${true} .value=${this.noteForm?.repo || 'global'} .options=${[{value: 'global', label: 'Global OS Level'}, ...this.ecosystem.allRepos.map(r => ({value: r, label: r}))]} @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, repo: e.detail.value }}))}></sutram-select>
                        ${(this.noteForm?.repo || 'global') !== 'global' ? (() => {
                            const buckets = this.sys.getFlattenedBuckets ? this.sys.getFlattenedBuckets(this.noteForm.repo) : [];
                            if (buckets.length > 0) {
                                return html`
                                    <sutram-select label="Sub-Bucket (Optional)" ?flush=${true} .value=${this.noteForm.bucket} .options=${[{value: 'None', label: 'None'}, ...buckets.map(b => ({value: b.id, label: b.title}))]} @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, bucket: e.detail.value }}))}></sutram-select>
                                `;
                            }
                            return '';
                        })() : ''}
                    </sutram-stack>
                    <sutram-input label="Tags (comma separated)" ?flush=${true} .value=${this.noteForm?.tags || ''} placeholder="e.g., architecture, frontend, bug" @sutram-input-changed=${(e) => NotesStore.setState(state => ({ noteForm: { ...state.noteForm, tags: e.detail.value }}))}></sutram-input>
                </sutram-stack>
                <sutram-btn slot="footer" intent="neutral" icon="x" label="Cancel" @click=${() => NotesStore.setState({ newNoteModalOpen: false })}></sutram-btn>
                <sutram-async-btn slot="footer" intent="primary" icon="save" label="Create & Open Note" .onClick=${() => NotesStore.getState().saveNewNote()}></sutram-async-btn>
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
        editForm: { type: Object },
        _isDirty: { type: Boolean, state: true }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.filepath = null;
        this.editForm = { title: '', repo: 'global', bucket: 'None', tags: '' };
        this._isDirty = false;
    }
    connectedCallback() {
        super.connectedCallback();
        const subId = this.dataset?.subId;
        const isNoteSub = subId && (subId.startsWith('ctx://notes/') || subId.includes('.insetu-data/notes/'));
        this.filepath = isNoteSub ? subId : NotesStore.getState().editNoteFilepath;
        this.subscribe(
            NotesStore,
            state => state.editNoteFilepath,
            (editNoteFilepath) => {
                const currentSubId = this.dataset?.subId;
                if (currentSubId && (currentSubId.startsWith('ctx://notes/') || currentSubId.includes('.insetu-data/notes/'))) {
                    this.filepath = currentSubId;
                } else if (editNoteFilepath) {
                    this.filepath = editNoteFilepath;
                }
            }
        );
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const mutations = e.detail?.mutations || [];
            if (this.filepath && mutations.some(m => m.filepath === this.filepath && m.operation === 'delete')) {
                const deletedFp = this.filepath;
                const delMut = mutations.find(m => m.filepath === this.filepath && m.operation === 'delete');
                const baseName = new this.utils.InSetuURI(deletedFp).basename;
                const movedSave = mutations.find(m => m.operation === 'save' && m.filepath !== deletedFp && m.filepath.endsWith('/' + baseName));
                const relocatedTarget = delMut?.relocated_to || movedSave?.filepath;
                if (relocatedTarget) {
                    const newFp = relocatedTarget;
                    this.filepath = newFp;
                    this.dataset.subId = newFp;
                    if (NotesStore.getState().editNoteFilepath === deletedFp) {
                        NotesStore.setState({ editNoteFilepath: newFp });
                    }
                    if (window.inSetu?.vfs?.renameFileTracking) {
                        window.inSetu.vfs.renameFileTracking(deletedFp, newFp);
                    }
                    return;
                }
                if (NotesStore.getState().editNoteFilepath === deletedFp) {
                    NotesStore.setState({ editNoteFilepath: null });
                }
                if (window.Sutram?.stores?.Layout) {
                    const layout = window.Sutram.stores.Layout.getState();
                    layout.closeWindow(deletedFp);
                    layout.closeWindow('notes:editor');
                    ['left', 'center', 'right'].forEach(col => layout.unpinFromColumn(col, deletedFp));
                }
            }
        });
    }
    _onFrontmatterLoaded(e) {
        const yaml = e.detail.yaml;
        const tagsStr = (() => {
            if (Array.isArray(yaml.tags)) return yaml.tags.join(', ');
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
    }
    _pushFrontmatter() {
        const tagsArr = this.editForm.tags ? this.editForm.tags.split(',').map(t => t.trim()).filter(t => t) : [];
        const yamlPatch = {
            id: this.editForm.id,
            title: this.editForm.title,
            repo: this.editForm.repo,
            sub_bucket: this.editForm.bucket,
            tags: tagsArr,
            created_at: this.editForm.created_at,
            updated_at: new Date().toISOString().split('.')[0]
        };
        this.shadowRoot?.getElementById('fm-editor')?.syncFrontmatter(yamlPatch, true);
    }
    async _deleteNote() {
        if (!this.filepath) return;
        if (!confirm("Are you sure you want to permanently delete this note? This cannot be undone.")) return;
        const targetFp = this.filepath;
        await this.sys.executeWorkspaceMutation('fs/delete', { filepath: targetFp }, {
            collapseKey: `vfs:delete:${targetFp}`,
            deletedMutations: [targetFp],
            onSuccess: (data) => {
                if (NotesStore.getState().editNoteFilepath === targetFp) {
                    NotesStore.setState({ editNoteFilepath: null });
                }
                if (window.Sutram?.stores?.Layout) {
                    const layout = window.Sutram.stores.Layout.getState();
                    layout.closeWindow(targetFp);
                    layout.closeWindow('notes:editor');
                    ['left', 'center', 'right'].forEach(col => layout.unpinFromColumn(col, targetFp));
                }
                if (data && data.job_id === 'offline_queue') {
                    NotesStore.setState(s => ({ notes: s.notes.filter(n => n.filepath !== targetFp) }));
                } else {
                    NotesStore.getState().fetchNotes();
                }
            }
        });
    }
    render() {
        if (!this.filepath) return html``;
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <insetu-frontmatter-editor
                    id="fm-editor"
                    .filepath=${this.filepath}
                    .defaultExpanded=${false}
                    @editor-dirty=${e => { this._isDirty = e.detail.isDirty; }}
                    @insetu:frontmatter-loaded=${this._onFrontmatterLoaded}>
                    <div slot="title-control">
                        <sutram-textarea 
                            .value=${this.editForm.title} 
                            placeholder="Note Title..." 
                            variant="ghost"
                            ?compact=${true}
                            ?flush=${true}
                            @sutram-input-changed=${e => { 
                                const val = e.detail.value.replace(/[\r\n]+/g, ' '); 
                                this.editForm = { ...this.editForm, title: val }; 
                                this._pushFrontmatter();
                            }}>
                        </sutram-textarea>
                    </div>
                    <sutram-stack slot="metadata-controls" direction="col" gap="sm">
                        <sutram-stack direction="grid" ?compact=${true}>
                            <sutram-select ?flush=${true} label="Repository" .value=${this.editForm.repo} .options=${[{value: 'global', label: 'Global OS Level'}, ...(this.ecosystem.allRepos || []).map(r => ({value: r, label: r}))]} @sutram-input-changed=${e => { this.editForm = { ...this.editForm, repo: e.detail.value, bucket: 'None' }; this._pushFrontmatter(); }}></sutram-select>
                            ${this.editForm.repo !== 'global' ? (() => {
                                const buckets = this.sys.getFlattenedBuckets ? this.sys.getFlattenedBuckets(this.editForm.repo) : [];
                                if (buckets.length > 0) {
                                    return html`<sutram-select ?flush=${true} label="Sub-Bucket" .value=${this.editForm.bucket} .options=${[{value: 'None', label: 'None'}, ...buckets.map(b => ({value: b.id, label: b.title}))]} @sutram-input-changed=${e => { this.editForm = { ...this.editForm, bucket: e.detail.value }; this._pushFrontmatter(); }}></sutram-select>`;
                                }
                                return '';
                            })() : ''}
                        </sutram-stack>
                        <sutram-input ?flush=${true} label="Tags" .value=${this.editForm.tags} placeholder="e.g., architecture, bug" @sutram-input-changed=${e => { this.editForm = { ...this.editForm, tags: e.detail.value }; this._pushFrontmatter(); }}></sutram-input>
                    </sutram-stack>
                </insetu-frontmatter-editor>
                <sutram-surface slot="footer" variant="panel" border="top" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-btn ?compact=${true} intent="danger" icon="trash-2" label="Delete" @click=${this._deleteNote}></sutram-btn>
                        <sutram-stack direction="row" gap="sm">
                            <sutram-btn ?compact=${true} intent="warning" icon="code" label="Raw Edit" @click=${() => {
                                const fp = this.filepath;
                                if (NotesStore.getState().editNoteFilepath === fp) {
                                    NotesStore.setState({ editNoteFilepath: null });
                                }
                                if (window.Sutram?.stores?.Layout) {
                                    const layout = window.Sutram.stores.Layout.getState();
                                    layout.closeWindow(fp);
                                    layout.closeWindow('notes:editor');
                                    ['left', 'center', 'right'].forEach(col => layout.unpinFromColumn(col, fp));
                                }
                                if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(fp, true, true);
                            }}></sutram-btn>
                            ${this._isDirty ? html`<sutram-async-btn icon="save" label="Save" intent="success" .onClick=${() => this.shadowRoot.getElementById('fm-editor').save()}></sutram-async-btn>` : ''}
                        </sutram-stack>
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
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
    static styles = [sharedStyles];

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
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const touchedNote = payload.mutations.some(m => m.filepath && (
                m.filepath.startsWith('ctx://notes/') || 
                m.filepath.includes('.insetu-data/notes/') ||
                (m.filepath.startsWith('ws://') && m.filepath.includes('/notes/'))
            ));
            if (touchedNote) NotesStore.getState().fetchNotes();
        });
        this.bindStore(
            NotesStore,
            state => ({
                notes: state.notes || [],
                loading: state.loading,
                searchQuery: state.searchQuery,
                pinnedRepos: state.pinnedRepos || new Set(['ALL'])
            }),
            { autoFetch: 'fetchNotes' }
        );
        this.subscribe(
            AppStore,
            state => state.allRepos || [],
            (allRepos) => {
                this.allRepos = allRepos;
            }
        );
        this.registerGlobalListener('insetu:notes:new', window, () => {
            NotesStore.setState({ newNoteModalOpen: true });
        });
        this.registerGlobalListener('sutram-sync-complete', window, () => NotesStore.getState().fetchNotes());
        // Expose the isolated notes directory to the global VFS manifest and file explorers
        this.registerGlobalListener('insetu:global-manifest-files', window, (e) => {
            const rawNotes = NotesStore.getState().notes || [];
            if (rawNotes.length === 0) e.inSetuResponses.push(['ctx://notes/.gitkeep']);
            else e.inSetuResponses.push(rawNotes.map(n => n.filepath));
        });

        this.registerGlobalListener('insetu:global-manifest-whitelist', window, (e) => {
            e.inSetuResponses.push(['ctx://notes/']);
        });
    }
    onViewActivated() {
        NotesStore.getState().fetchNotes();
    }

    render() {
        const filteredNotes = this.filterItems(this.notes, {
            repoField: 'repo',
            pinnedRepos: this.pinnedRepos,
            searchFields: n => `${n.title} ${n.repo} ${(n.tags || []).join(' ')}`
        });
        return html`
            <sutram-view>
                <sutram-toolbar
                    slot="toolbar"
                    searchPlaceholder="Fuzzy search notes..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => NotesStore.setState({ searchQuery: e.detail.value })}
                    .enableFilterDropdown=${true}
                    .activeFilters=${Array.from(this.pinnedRepos)}>
                    <insetu-repo-filter
                        slot="filters"
                        .repos=${this.allRepos}
                        .activeRepos=${Array.from(this.pinnedRepos)}
                        @repo-filter-changed=${(e) => NotesStore.setState({ pinnedRepos: new Set(e.detail.activeRepos) })}>
                    </insetu-repo-filter>
                </sutram-toolbar>
                ${this.loading ? html`<sutram-spinner text="Loading notes..."></sutram-spinner>` : ''}
                <sutram-stack direction="col" gap="sm">
                    ${filteredNotes.length === 0 && !this.loading ? html`<sutram-empty-state text="No notes found. Open the menu in the top-right to create one."></sutram-empty-state>` : ''}
                    ${filteredNotes.map(n => html`
                        <sutram-card
                            .filename=${n.filepath}
                            .titleText=${n.title}
                            .descriptionText=${`Repo: ${n.repo}${n.sub_bucket !== 'None' ? ` | Bucket: ${n.sub_bucket}` : ''}`}
                            .detailText=${this.utils.formatDate(n.updated_at)}
                            .detailSuffix=${n.filepath?.startsWith('ws://') ? n.repo : ''}
                            icon=${n.filepath?.startsWith('ws://') ? 'globe' : 'file-edit'}
                            intent="highlight"
                            entityType="file:note"
                            .entityData=${{ filepath: n.filepath, isFS: !n.filepath?.startsWith('ws://'), repoDir: n.repo }}
                            @card-clicked=${() => {
                                if (n.filepath?.startsWith('ws://')) {
                                    if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(n.filepath, false, true);
                                } else {
                                    NotesStore.getState().openNoteEditor(n.filepath, n.title);
                                }
                            }}>
                            ${n.tags && n.tags.length > 0 ? html`
                                <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                                    ${n.tags.map(tag => html`<sutram-tag text="#${tag}" intent="neutral"></sutram-tag>`)}
                                </sutram-stack>
                            ` : ''}
                        </sutram-card>
                    `)}
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-notes', InSetuExtNotes);
// 5. Toolbar Menu Helper & Declarative Registration
async function _preCacheAllNotes() {
    const notes = NotesStore.getState().notes || [];
    if (notes.length === 0) {
        alert("No notes available to cache.");
        return;
    }
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    window.inSetu?.offlineLog?.(`Starting pre-cache for Notes Library (${notes.length} files)...`, 'info');
    if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`Caching ${notes.length} notes...`, null);

    let cachedCount = 0;
    try {
        for (const n of notes) {
            if (!n.filepath) continue;
            const res = await window.inSetu.api.request(`/api/${activeWs}/fs/fetch?file=${encodeURIComponent(n.filepath)}`, {}, activeWs).catch(() => {});
            if (res && res.ok) {
                await res.blob().catch(() => {});
                cachedCount++;
            }
        }
        window.inSetu?.offlineLog?.(`Pre-cache complete for Notes: ${cachedCount}/${notes.length} cached.`, 'success');
        if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`Successfully cached ${cachedCount} notes.`, 3000);
        setTimeout(() => {
            window.inSetu?.events?.emit('insetu:force-refresh', { parentId: 'offline', subId: 'ledger' });
        }, 500);
    } catch (e) {
        window.inSetu?.offlineLog?.(`Pre-cache failed for Notes: ${e.message}`, 'error');
        alert(`Failed to cache notes: ${e.message}`);
    }
}

window.ExtensionRegistry.registerExtension('notes', {
    name: "Notes Library",
    version: "1.0.0",
    offline_mode: "full",
    entityActions: [],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-notes-modals"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "notes",
            label: "Notes",
            icon: "file-text",
            intent: "highlight",
            order: 4,
            allow_popout: true,
            menuActions: [
                { label: 'New Note', icon: 'file-plus', emitEvent: 'insetu:notes:new' },
                { label: 'Pre-Cache Notes', icon: 'download', onClick: () => _preCacheAllNotes() }
            ],
            component: "insetu-ext-notes"
        }
    ],
    customEditors: [
        {
            component: 'insetu-ext-notes-editor',
            match: (filepath) => filepath && (filepath.startsWith('ctx://notes/') || filepath.includes('.insetu-data/notes/')),
            onOpen: (filepath) => {
                const existingNote = (NotesStore.getState().notes || []).find(n => n.filepath === filepath);
                NotesStore.getState().openNoteEditor(filepath, existingNote?.title);
            }
        }
    ]
});