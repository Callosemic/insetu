import {
    executeSystemCompile,
    viewSourceFile,
    setContextManifest,
    getFlattenedBuckets,
    fetchAndCopy,
    fetchAndDownloadState
} from '../app.js';
import { AppStore } from '../store.js';
import { createExtensionStore, InSetuElement, bindStoreInput } from '../sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const KanbanStore = createExtensionStore('Kanban', {
    tasks: [],
    pinnedRepos: new Set(["ALL"]),
    pinnedBuckets: new Set(["ALL"]),
    pinnedTags: new Set(["ALL"]),
    reposExpanded: false,
    bucketsExpanded: {},
    tagsExpanded: false,
    modals: { new: false, edit: false },
    newTaskForm: { repo: '', type: 'todo', status: 'open', bucket: 'None', title: '', tags: '', desc: '', deliveryDate: '' },
    editTaskForm: { filepath: '', title: '', tagsRaw: '', bucket: 'None', desc: '', origYaml: '', deliveryDate: '', createdAt: '', closedAt: '' },
    setNewTaskField: (field, value) => KanbanStore.setState((state) => ({ newTaskForm: { ...state.newTaskForm, [field]: value } })),
    setEditTaskField: (field, value) => KanbanStore.setState((state) => ({ editTaskForm: { ...state.editTaskForm, [field]: value } })),
    setModal: (modalName, isOpen) => KanbanStore.setState((state) => ({ modals: { ...state.modals, [modalName]: isOpen } })),
    resetState: () => KanbanStore.setState({ tasks: [] }),
    fetchTasks: async () => {
        if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('tracker')) return;
        const res = await window.inSetu.api.workspace('tracker/files?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            KanbanStore.setState({ tasks: data.tasks || [] });
        }
    }
}, ['pinnedRepos', 'pinnedBuckets', 'pinnedTags']);
window.inSetu.stores.Kanban = KanbanStore;
// UI Hooks for real-time reactivity
if (window.ExtensionRegistry && window.ExtensionRegistry.registerUIHook) {
    window.ExtensionRegistry.registerUIHook('zone:post-file-save', (filepath) => {
        if (filepath && filepath.includes('.tracker/') && filepath.endsWith('.md')) {
            KanbanStore.getState().fetchTasks();
        }
    });
    window.ExtensionRegistry.registerUIHook('zone:post-file-delete', (filepath) => {
        if (filepath && filepath.includes('.tracker/') && filepath.endsWith('.md')) {
            KanbanStore.getState().fetchTasks();
        }
    });
}

// Alias for legacy external triggers until fully deprecated
window.loadTrackerBoard = () => KanbanStore.getState().fetchTasks();

import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';

export class InSetuExtTracker extends InSetuElement {
    get extName() { return 'tracker'; }
    static properties = {
        tasks: { type: Array },
        pinnedRepos: { type: Object },
        pinnedBuckets: { type: Object },
        pinnedTags: { type: Object },
        allRepos: { type: Array },
        activeTab: { type: String },
        searchQuery: { type: String },
        _modals: { type: Object },
        _yamlExpanded: { type: Boolean },
        _showFilters: { type: Boolean }
    };
static styles = [
sharedStyles,
css`
    .task-tag { background: var(--border); color: var(--text); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; opacity: 0.8; display: inline-block; }
    :host-context([data-theme="e-ink"]) .task-tag { background: #ffffff !important; color: #000000 !important; border: 1px dashed #000000 !important; opacity: 1 !important; }
    :host-context([data-theme="light"]) .task-tag { background: #e2e8f0; color: #0f172a; }
    .board-columns { display: flex; gap: 15px; }
    @media (max-width: 1024px) {
        .board-columns { flex-direction: column; }
    }
    .column { flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px; }
    .column h3 { margin-top: 0; font-size: 1.1rem; }
    .filter-container { display: flex;
    flex-direction: column; gap: 10px; margin-bottom: 15px; }

    insetu-modal {
        position: fixed;
        z-index: 2100 !important;
    }
    .editor-wrapper {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border);
        border-radius: 4px;
        overflow: hidden;
    }
    .editor-wrapper insetu-markdown-editor {
        flex: 1;
        background: var(--bg);
    }

    /* Metadata Input Hardening */
    select, input[type="date"] {
        background: var(--input-bg) !important;
        color: var(--text) !important;
        border: 1px solid var(--border) !important;
        border-radius: 4px !important;
        box-sizing: border-box;
    }
`
];
constructor() {
        super();
        this.tasks = [];
        this.pinnedRepos = new Set(['ALL']);
this.pinnedBuckets = new Set(['ALL']);
        this.pinnedTags = new Set(['ALL']);
        this.allRepos = [];
        this.activeTab = 'todos';
        this.searchQuery = '';
        this._modals = { new: false, edit: false };
        this._yamlExpanded = false;
        this._showFilters = false;
        this._docClickListener = this._handleDocumentClick.bind(this);
}
    connectedCallback() {
        super.connectedCallback();
        const parsedTab = this.parentElement?.id?.replace('sub-', '');
        this.activeTab = ['todos', 'bugs', 'queue', 'log'].includes(parsedTab) ? parsedTab : 'todos';

        this.subscribe(AppStore, (state) => {
            this.allRepos = state.allRepos || [];
        });
        this.allRepos = AppStore.getState().allRepos || [];

        this.subscribe(KanbanStore, (state) => {
            this.tasks = state.tasks || [];
            this.pinnedRepos = state.pinnedRepos;
            this.pinnedBuckets = state.pinnedBuckets;
            this.pinnedTags = state.pinnedTags;
            this._modals = state.modals;
            this.requestUpdate();
        });
        const kState = KanbanStore.getState();
        this.tasks = kState.tasks || [];
        this.pinnedRepos = kState.pinnedRepos;
        this.pinnedBuckets = kState.pinnedBuckets;
        this.pinnedTags = kState.pinnedTags;
        this._modals = kState.modals;
        document.addEventListener('click', this._docClickListener);
        KanbanStore.getState().fetchTasks();
    }

    onWorkspaceChanged(newWorkspaceId) {
        KanbanStore.getState().fetchTasks();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._docClickListener);
    }
    _handleDocumentClick(e) {
        if (!this._showFilters) return;
        const path = e.composedPath();
        const isFilterContent = path.some(node => node.classList && (node.classList.contains('filter-container') || node.classList.contains('filter-toggle-btn')));
        if (!isFilterContent) {
            this._showFilters = false;
            this.requestUpdate();
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        // Ensure the title textarea expands dynamically on initial render
        const titleArea = this.shadowRoot.querySelector('textarea[placeholder="Ticket Summary Blueprint..."]');
        if (titleArea) {
            titleArea.style.height = 'auto';
            titleArea.style.height = Math.min(titleArea.scrollHeight, 150) + 'px';
        }
    }
    async _transitionTask(task, newStatus, newType = null) {
        const res = await this.api.post('transition', {
            repo: task.repo,
            filepath: task.filepath,
            new_status: newStatus,
            new_type: newType
        });

        if (res.ok) {
            const data = await res.json();
            const currentTasks = KanbanStore.getState().tasks;
            const updatedTasks = currentTasks.map(t => {
                if (t.id === task.id) {
                    return {
                        ...t,
                        status: newStatus,
                        filepath: data.new_filepath,
                        ticket_type: newType || t.ticket_type,
                        isTodo: newType ? newType === 'todo' : t.isTodo,
                        isBug: newType ? newType === 'bug' : t.isBug,
                        isQueue: newType ? newType === 'queue' : t.isQueue
                    };
                }
                return t;
            });
            KanbanStore.setState({ tasks: updatedTasks });
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to transition task.");
        }
    }

    _renderTaskCard(t) {
        const shortDate = t.timestamp ? t.timestamp.split('T')[0] : 'Unknown Date';
        const bucketStr = (t.subBucket && t.subBucket !== 'None') ? ` | 🗂️ ${t.subBucket}` : '';
        const statusStr = (t.status !== 'closed') ? ` | ${t.status.charAt(0).toUpperCase() + t.status.slice(1)}` : '';
        const descText = `${t.repo}${bucketStr}${statusStr} | ${shortDate}`;

        const intentColor = t.isBug ? 'var(--intent-danger)' : (t.isQueue ? 'var(--intent-highlight)' : 'var(--intent-success)');
        const icon = t.isBug ? '🐛' : (t.isQueue ? '🔬' : '✨');
        const isOverdue = t.deliveryDate && new Date(t.deliveryDate) < new Date() && t.status !== 'closed';

        return html`
            <insetu-card
                data-task-id=${t.id}
                .filename=${t.filepath}
                .titleText=${t.title}
                .descriptionText=${descText}
                .intentColor=${intentColor}
                .icon=${icon}
                ?overlayExcludesTitle=${true}
                @card-clicked=${() => viewSourceFile(t.filepath, true)}>

                <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                    ${t.deliveryDate ? html`
                        <span class="task-tag" style="background: ${isOverdue ? 'var(--intent-danger)' : 'var(--input-bg)'}; color: ${isOverdue ? 'var(--bg)' : 'var(--text)'}; border: 1px solid var(--border);">
                            📅 Due: ${t.deliveryDate}
                        </span>
                    ` : ''}
                    ${t.tags && t.tags.length > 0 ? t.tags.map(tag => html`<span class="task-tag">#${tag}</span>`) : ''}
                </div>

                <insetu-file-actions slot="actions" .filepath=${t.filepath} .repoDir=${t.repo} .isFS=${true}></insetu-file-actions>
                ${(t.status === 'open' && !t.isQueue) ? html`
                    <insetu-async-btn slot="actions" label="▶️ Start" intent="warning" .onClick=${(e) => { e.stopPropagation(); return this._transitionTask(t, 'active'); }}></insetu-async-btn>
                ` : ''}

                ${(t.status === 'closed') ? html`
                    <insetu-async-btn slot="actions" label="🔄 Re-open" intent="highlight" .onClick=${(e) => { e.stopPropagation(); return this._transitionTask(t, 'open'); }}></insetu-async-btn>
                ` : ''}

                ${(t.status !== 'closed' && t.isQueue) ? html`
                    <insetu-async-btn slot="actions" label="✅ Accept" intent="success" .onClick=${(e) => { e.stopPropagation(); return this._transitionTask(t, 'open', 'todo'); }}></insetu-async-btn>
                ` : ''}

                ${(t.status === 'active' && !t.isQueue) ? html`
                    <insetu-async-btn slot="actions" label="⏸️ Pause" intent="neutral" .onClick=${(e) => { e.stopPropagation(); return this._transitionTask(t, 'open'); }}></insetu-async-btn>
                ` : ''}

                ${(t.status !== 'closed' && t.status !== 'archived') ? html`
                    <insetu-async-btn slot="actions" label="${t.isQueue ? '✅ Resolve' : '✅ Close'}" intent="${t.isQueue ? 'neutral' : 'success'}" 
                        .onClick=${(e) => { e.stopPropagation(); return this._transitionTask(t, 'closed'); }}>
                    </insetu-async-btn>
                ` : ''}
            </insetu-card>
        `;
    }
    _renderColumns(type, filteredTasks) {
        const typeFilter = t => type === 'todos' ?
        t.isTodo : type === 'bugs' ? t.isBug : t.isQueue;

        // Deadline Precedence with FIFO Fallback Sorting Engine
        const sortChronological = (a, b) => {
            if (a.deliveryDate && b.deliveryDate) {
                return a.deliveryDate.localeCompare(b.deliveryDate);
            }
            if (a.deliveryDate) return -1; // Deadlines float to the top
            if (b.deliveryDate) return 1;
            return a.timestamp.localeCompare(b.timestamp); // Fallback to Oldest-First FIFO
        };

        const openTasks = filteredTasks.filter(t => typeFilter(t) && t.status === 'open').sort(sortChronological);
        const activeTasks = filteredTasks.filter(t => typeFilter(t) && t.status === 'active').sort(sortChronological);
        const closedTasks = filteredTasks.filter(t => typeFilter(t) && t.status === 'closed').sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));

        if (type === 'queue') {
            return html`
                <div class="board-columns">
                    <div class="column">
                        <h3>Open (Research Queue)</h3>
                        ${openTasks.map(t => this._renderTaskCard(t))}
                    </div>
                    <div class="column">
                        <h3 style="color: var(--intent-success);">Closed (Resolved)</h3>
                        ${closedTasks.map(t => this._renderTaskCard(t))}
                    </div>
                </div>
            `;
        }
        return html`
            <div class="board-columns">
                <div class="column">
                    <h3>Active</h3>
                    ${activeTasks.map(t => this._renderTaskCard(t))}
                </div>
                <div class="column">
                    <h3>Open</h3>
                    ${openTasks.map(t => this._renderTaskCard(t))}
                </div>
                <div class="column">
                    <h3 style="color: var(--intent-success);">Closed</h3>
                    ${closedTasks.map(t => this._renderTaskCard(t))}
                </div>
            </div>
        `;
    }
    _openNewTaskModal() {
        const state = KanbanStore.getState();
        const isBugs = this.activeTab === 'bugs';
        const isQueue = this.activeTab === 'queue';
        const defaultType = isBugs ? 'bug' : (isQueue ? 'queue' : 'todo');
        const prePopulatedTags = Array.from(this.pinnedTags).filter(t => t !== 'ALL');
        const defaultTagsStr = prePopulatedTags.join(', ');
        state.setNewTaskField('type', defaultType);
        state.setNewTaskField('tags', defaultTagsStr);
        state.setNewTaskField('title', '');
        state.setNewTaskField('desc', '');
        state.setNewTaskField('status', 'open');
        state.setNewTaskField('bucket', 'None');
        state.setNewTaskField('deliveryDate', '');
        if (this.allRepos.length > 0) state.setNewTaskField('repo', this.allRepos[0]);
        if (this.pinnedRepos.size === 1 && !this.pinnedRepos.has('ALL')) {
            const pinnedRepo = Array.from(this.pinnedRepos)[0];
if (this.allRepos.includes(pinnedRepo)) {
                state.setNewTaskField('repo', pinnedRepo);
}
        }

        state.setModal('new', true);
}
    async _saveNewTask() {
        const { repo, type, status, title, tags, desc, bucket, deliveryDate } = KanbanStore.getState().newTaskForm;
        const sub_bucket = bucket || 'None';

        if (!title || !desc) {
            throw new Error("Title and Description are required.");
        }

        const res = await this.api.post('new', {
            repo, type, status, title, tags, description: desc, sub_bucket, delivery_date: deliveryDate
        });
        if (res.ok) {
            KanbanStore.getState().setModal('new', false);
            KanbanStore.getState().fetchTasks();
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to create task.");
        }
    }
    _renderNewTaskModal() {
        const globalActiveSub = localStorage.getItem('insetu_subtab_tasks') || 'todos';
        if (this.activeTab !== globalActiveSub) return '';
        const { newTaskForm } = KanbanStore.getState();
        const selectedRepo = newTaskForm.repo || this.allRepos[0];
        const buckets = selectedRepo ? getFlattenedBuckets(selectedRepo) : [];
        return html`
            <insetu-modal 
                ?open=${this._modals?.new} 
                titleText="Create New Ticket"
                @modal-closed=${() => KanbanStore.getState().setModal('new', false)}>

                <div slot="body">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                        ${bindStoreInput(KanbanStore, 'newTaskForm.repo', newTaskForm.repo, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: this.allRepos.map(r => ({value: r, label: r})), onUpdate: () => KanbanStore.setState(s => ({ newTaskForm: { ...s.newTaskForm, bucket: 'None' } })) })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.type', newTaskForm.type, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: [{value: 'todo', label: 'To-Do (Task)'}, {value: 'bug', label: 'Bug'}, {value: 'queue', label: 'Queue (Research)'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.status', newTaskForm.status, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.bucket', newTaskForm.bucket, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: [{value: 'None', label: 'No Bucket'}, ...buckets.map(b => ({value: b.id, label: b.title}))] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.deliveryDate', newTaskForm.deliveryDate, { type: 'date', style: 'flex: 1; min-width: 120px; padding: 10px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono);' })}
                    </div>
                    ${bindStoreInput(KanbanStore, 'newTaskForm.title', newTaskForm.title, { placeholder: 'Ticket Title (e.g., Fix schema registry timeout)', style: 'margin-bottom: 10px; font-weight: bold;' })}
                    ${bindStoreInput(KanbanStore, 'newTaskForm.tags', newTaskForm.tags, { placeholder: 'Tags (comma separated, e.g. frontend, critical)', style: 'margin-bottom: 10px;' })}
                    ${bindStoreInput(KanbanStore, 'newTaskForm.desc', newTaskForm.desc, { type: 'textarea', placeholder: 'Markdown description...', style: 'flex: 1; margin-bottom: 10px; min-height: 150px;' })}
                </div>
                <div slot="footer" style="display: flex; width: 100%;">
                    <insetu-async-btn style="flex: 1; display: block; width: 100%;" label="💾 Create Ticket" intent="primary" .onClick=${this._saveNewTask.bind(this)}></insetu-async-btn>
                </div>
            </insetu-modal>
        `;
    }

    _renderLog(filteredTasks) {
        const recentlyClosed = filteredTasks.filter(t => t.status === 'closed' || t.status === 'logged').sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));
const archived = filteredTasks.filter(t => t.status === 'archived').sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));

        const isMulti = this.pinnedRepos.has('ALL') ||
this.pinnedRepos.size > 1;

        return html`
            <h4 class="category-heading" style="margin-top: 10px; margin-bottom: 10px;">Recently Closed</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px; font-style: italic;">(logs not yet archived)</p>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                ${recentlyClosed.map(t => this._renderTaskCard(t))}
            </div>

            <h4 class="category-heading" style="margin-top: 20px; margin-bottom: 10px;">Archived Tickets</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">(Historical context preserved on disk)</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${archived.map(t => this._renderTaskCard(t))}
            </div>
        `;
    }
    render() {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
// Compute all available tags for the filter
        const allTags = new Set();
        this.tasks.forEach(t => {
            const matchesRepo = this.pinnedRepos.has('ALL') || this.pinnedRepos.has(t.repo);
            const matchesBucket = this.pinnedBuckets.has('ALL') || this.pinnedBuckets.has(t.subBucket);
            if (matchesRepo && matchesBucket && t.tags) {
                t.tags.forEach(tag => allTags.add(tag));
            }
        });
        const tagsArray = Array.from(allTags).sort();

        // Apply filters to tasks
        const filteredTasks = this.tasks.filter(t => {
            const matchesRepo = this.pinnedRepos.has('ALL') || this.pinnedRepos.has(t.repo);
            const matchesBucket = this.pinnedBuckets.has('ALL') || this.pinnedBuckets.has(t.subBucket);
            const matchesTag = this.pinnedTags.has('ALL') || (t.tags && t.tags.some(tag => this.pinnedTags.has(tag)));
            return matchesRepo && matchesBucket && matchesTag;
        });
        const textFilteredTasks = this.searchQuery 
            ? window.inSetu.utils.fuzzyFilterObjects(filteredTasks, this.searchQuery, t => `${t.title} ${t.id} ${t.description} ${(t.tags || []).join(' ')}`) 
            : filteredTasks;

        const activeFilters = [];
        this.pinnedRepos.forEach(r => { if (r !== 'ALL') activeFilters.push(r); });
        this.pinnedBuckets.forEach(b => { if (b !== 'ALL') activeFilters.push(b); });
        this.pinnedTags.forEach(t => { if (t !== 'ALL') activeFilters.push('#' + t); });
        const filterBtnText = activeFilters.length > 0 ? `Filters: ${activeFilters.slice(0, 2).join(', ')}${activeFilters.length > 2 ? '...' : ''}` : 'Filters';

        return html`
            ${this._renderNewTaskModal()}
            <div class="sticky-header" style="padding: 0; display: flex; flex-direction: column; border-bottom: 1px solid var(--border); background: var(--bg);">
                <div style="display: flex; align-items: center; gap: 10px; padding-right: 12px;">
                    <insetu-search-bar 
                        style="flex: 1;"
                        placeholder="🔍 Fuzzy search tickets..." 
                        .value=${this.searchQuery} 
                        @search-changed=${(e) => this.searchQuery = e.detail.value}>
                    </insetu-search-bar>
                    <button class="btn-sm filter-toggle-btn" style="background: ${this._showFilters ? 'var(--input-bg)' : 'transparent'}; border: 1px solid ${this._showFilters ? 'var(--border)' : 'transparent'}; color: var(--text); padding: 4px 8px; margin: 0; font-size: 0.85rem; white-space: nowrap; max-width: 250px; overflow: hidden; text-overflow: ellipsis;" @click=${() => this._showFilters = !this._showFilters} title="${activeFilters.join(', ')}">
                        ${this._showFilters ? '▼ ' + filterBtnText : '▶ ' + filterBtnText}
                    </button>
                </div>

                <div class="filter-container" style="display: ${this._showFilters ? 'flex' : 'none'}; position: absolute; top: calc(100% + 5px); left: 15px; right: 15px; z-index: 100; padding: 15px; background: var(--pane-bg); border: 1px solid var(--border); border-radius: 6px; margin: 0; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
                    <insetu-repo-filter
                    label="📌 Repos:"
                    .repos=${this.allRepos}
                    .activeRepos=${Array.from(this.pinnedRepos)}
                    .enableBuckets=${true}
                    .activeBuckets=${Array.from(this.pinnedBuckets)}
                    .getBucketsFn=${getFlattenedBuckets}
                    @repo-filter-changed=${(e) => {
                        KanbanStore.setState({ pinnedRepos: new Set(e.detail.activeRepos) });
                    }}
                    @bucket-filter-changed=${(e) => {
                        KanbanStore.setState({ pinnedBuckets: new Set(e.detail.activeBuckets) });
                    }}>
                </insetu-repo-filter>

                ${tagsArray.length > 0 ? html`
                    <insetu-filter-group
                        label="🏷️ Tags:"
                        .allowAll=${true}
                        .items=${tagsArray.map(t => ({id: t, label: '#' + t}))}
                        .activeItems=${Array.from(this.pinnedTags)}
                        @filter-changed=${(e) => {
                            KanbanStore.setState({ pinnedTags: new Set(e.detail.activeItems) });
                        }}>
                    </insetu-filter-group>
                ` : ''}
                </div>
            </div>

            ${this.activeTab === 'todos' ? this._renderColumns('todos', textFilteredTasks) : ''}
${this.activeTab === 'bugs' ? this._renderColumns('bugs', textFilteredTasks) : ''}
${this.activeTab === 'queue' ? this._renderColumns('queue', textFilteredTasks) : ''}
${this.activeTab === 'log' ? this._renderLog(textFilteredTasks) : ''}
            ${this._renderEditTaskModal()}
        `;
    }
    async _openEditTaskModal(filepath) {
        try {
            const res = await window.inSetu.api.workspace(`bridge/fetch?file=${encodeURIComponent(filepath)}`);
            if (!res.ok) throw new Error("Failed to load task file.");
            const content = await res.text();
            const repo = filepath.split('/')[0];
            const defaultTitle = filepath.split('/').pop();
            const yamlMatch = content.match(/^\s*---\n([\s\S]*?)\n\s*---/);
            const inferredType = filepath.includes('/bugs/') ? 'bug' : filepath.includes('/queue/') ? 'queue' : 'todo';
            const inferredStatus = filepath.includes('/active/') ? 'active' : filepath.includes('/closed/') ? 'closed' : filepath.includes('/archived/') ? 'archived' : filepath.includes('/log/') ? 'logged' : 'open';
            const { parsedTitle, parsedSubBucket, parsedTags, parsedDeliveryDate, parsedType, parsedStatus, parsedRepo, parsedCreatedAt, parsedClosedAt } = (() => {
                if (!yamlMatch) return { parsedTitle: defaultTitle, parsedSubBucket: 'None', parsedTags: [], parsedDeliveryDate: '', parsedType: inferredType, parsedStatus: inferredStatus, parsedRepo: repo, parsedCreatedAt: '', parsedClosedAt: '' };

                return yamlMatch[1].split('\n').reduce((acc, l) => {
                    if (l.startsWith('title:')) acc.parsedTitle = l.replace('title:', '').replace(/"/g, '').replace(/'/g, '').trim();
                    if (l.startsWith('sub_bucket:')) acc.parsedSubBucket = l.replace('sub_bucket:', '').replace(/"/g, '').replace(/'/g, '').trim() || 'None';
                    if (l.startsWith('delivery_date:')) acc.parsedDeliveryDate = l.replace('delivery_date:', '').replace(/"/g, '').replace(/'/g, '').trim() || '';
                    if (l.startsWith('created_at:')) acc.parsedCreatedAt = l.replace('created_at:', '').replace(/"/g, '').replace(/'/g, '').trim() || '';
                    if (l.startsWith('closed_at:')) acc.parsedClosedAt = l.replace('closed_at:', '').replace(/"/g, '').replace(/'/g, '').trim() || '';
                    if (l.startsWith('type:')) acc.parsedType = l.replace('type:', '').replace(/"/g, '').replace(/'/g, '').trim().toLowerCase();
                    if (l.startsWith('status:')) acc.parsedStatus = l.replace('status:', '').replace(/"/g, '').replace(/'/g, '').trim().toLowerCase();
                    if (l.startsWith('repo:')) acc.parsedRepo = l.replace('repo:', '').replace(/"/g, '').replace(/'/g, '').trim();
                    if (l.startsWith('tags:')) {
                        const rawTags = l.replace('tags:', '').trim();
                        const cleanTags = rawTags.startsWith('[') ? rawTags.replace(/^\[|\]$/g, '').split(',') : rawTags.split(',');
                        acc.parsedTags = cleanTags.map(t => t.trim().replace(/['"]/g, '')).filter(t => t);
                    }
                    return acc;
                }, { parsedTitle: defaultTitle, parsedSubBucket: 'None', parsedTags: [], parsedDeliveryDate: '', parsedType: inferredType, parsedStatus: inferredStatus, parsedRepo: repo, parsedCreatedAt: '', parsedClosedAt: '' });
            })();

            const cleanTags = parsedTags.filter(t => t);

            const parsedDesc = (() => {
                if (!yamlMatch) return content;
                const stripped = content.replace(yamlMatch[0], '').trim();
                return stripped.startsWith('## Description') ? stripped.replace(/^## Description\n+/, '') : stripped;
            })();
            const state = KanbanStore.getState();
            state.setEditTaskField('filepath', filepath);
            state.setEditTaskField('title', parsedTitle);
            state.setEditTaskField('tagsRaw', cleanTags.join(', '));
            state.setEditTaskField('bucket', parsedSubBucket);
            state.setEditTaskField('desc', parsedDesc.trim());
            state.setEditTaskField('deliveryDate', parsedDeliveryDate === 'null' ? '' : parsedDeliveryDate);
            state.setEditTaskField('createdAt', parsedCreatedAt === 'null' ? '' : parsedCreatedAt);
            state.setEditTaskField('closedAt', parsedClosedAt === 'null' ? '' : parsedClosedAt);
            state.setEditTaskField('type', parsedType || inferredType);
            state.setEditTaskField('status', parsedStatus || inferredStatus);
            state.setEditTaskField('repo', parsedRepo || repo);
            state.setEditTaskField('origYaml', yamlMatch ? yamlMatch[1] : '');

            this._originalTaskSnapshot = {
                title: parsedTitle,
                tagsRaw: cleanTags.join(', '),
                bucket: parsedSubBucket,
                desc: parsedDesc.trim(),
                deliveryDate: parsedDeliveryDate === 'null' ? '' : parsedDeliveryDate,
                createdAt: parsedCreatedAt === 'null' ? '' : parsedCreatedAt,
                closedAt: parsedClosedAt === 'null' ? '' : parsedClosedAt,
                type: parsedType || inferredType,
                status: parsedStatus || inferredStatus,
                repo: parsedRepo || repo
            };

            state.setModal('edit', true);
        } catch (e) {
            alert(e.message);
        }
    }

    _isDirty() {
        if (!this._originalTaskSnapshot) return false;
        const current = KanbanStore.getState().editTaskForm;
        const orig = this._originalTaskSnapshot;
        return current.title !== orig.title ||
                current.tagsRaw !== orig.tagsRaw ||
                current.bucket !== orig.bucket ||
                current.desc !== orig.desc ||
                current.deliveryDate !== orig.deliveryDate ||
                current.createdAt !== orig.createdAt ||
                current.closedAt !== orig.closedAt ||
                current.type !== orig.type ||
                current.status !== orig.status ||
                current.repo !== orig.repo;
    }
    _handleModalClosing(e) {
        if (this._isDirty() && !confirm("You have unsaved changes. Are you sure you want to go back?")) {
            e.preventDefault();
        }
    }

    async _deleteTask() {
        const { filepath } = KanbanStore.getState().editTaskForm;
        if (!filepath) return;
        if (!confirm("Are you sure you want to permanently delete this ticket? This cannot be undone.")) return;

        try {
            const res = await window.inSetu.api.workspace('fs/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath })
            });
            if (res.ok) {
                KanbanStore.getState().setModal('edit', false);
                this._originalTaskSnapshot = null;
                KanbanStore.getState().fetchTasks();
            } else {
                alert("Failed to delete ticket.");
            }
        } catch (e) {
            alert("Network error.");
        }
    }
    async _saveEditTask() {
        const { filepath, title, tagsRaw, bucket, deliveryDate, createdAt, closedAt, origYaml, type, status, repo, desc } = KanbanStore.getState().editTaskForm;
        if (!title || !desc.trim()) {
            throw new Error("Title and Description are required.");
        }
        const tagsArr = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
        const tagsYaml = tagsArr.length > 0 ? `tags: [${tagsArr.join(', ')}]` : `tags: []`;
        const deliveryYaml = deliveryDate ? `delivery_date: "${deliveryDate}"` : `delivery_date: null`;
        const createdYaml = createdAt ? `created_at: ${createdAt}` : `created_at: null`;
        const closedYaml = closedAt ? `closed_at: ${closedAt}` : `closed_at: null`;

        const ticketId = filepath.split('/').pop().replace('.md', '');
        // Pristine Declarative Frontmatter Generation Blueprint
        const newContent = `---\nrepo: "${repo}"\ntype: "${type}"\nstatus: "${status}"\nid: "${ticketId}"\ntitle: "${title.replace(/"/g, "'")}"\n${createdYaml}\n${closedYaml}\nsub_bucket: "${bucket}"\n${tagsYaml}\n${deliveryYaml}\n---\n\n## Description\n${desc}\n`;

        // Dynamic Path Re-Routing Configuration
        const filename = filepath.split('/').pop();
        const folderType = type === 'queue' ? 'queue' : `${type}s`;
        const intendedRelPath = `${repo}/.tracker/${folderType}/${status}/${filename}`;

        const res = await window.inSetu.api.workspace('fs/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filepath: intendedRelPath,  
                content: newContent,
                delete_source: filepath !== intendedRelPath ? filepath : null
            })
        });

        if (res.ok) {
            KanbanStore.getState().setModal('edit', false);
            this._originalTaskSnapshot = null;
            KanbanStore.getState().fetchTasks();
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to save changes.");
        }
    }
    _renderEditTaskModal() {
        const globalActiveSub = localStorage.getItem('insetu_subtab_tasks') || 'todos';
        if (this.activeTab !== globalActiveSub) return '';
        const { editTaskForm } = KanbanStore.getState();
        const activeRepo = editTaskForm.repo || '';
        const buckets = activeRepo ? getFlattenedBuckets(activeRepo) : [];
        return html`
            <insetu-modal 
                ?open=${this._modals?.edit} 
                titleText="Edit Ticket"
                maxWidth="100vw"
                @modal-closing=${this._handleModalClosing}
                @modal-closed=${() => { KanbanStore.getState().setModal('edit', false); this._originalTaskSnapshot = null; }}>

                <div slot="body" style="margin: -20px; height: calc(100% + 40px); display: flex; flex-direction: column; overflow: hidden; background: var(--bg);">
                    <div style="padding: 6px 20px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg);">
                        <textarea placeholder="Ticket Summary Blueprint..." rows="1" style="font-weight: bold; font-size: 0.9rem; border: none !important; outline: none !important; box-shadow: none !important; padding: 2px 0; background: transparent; width: 100%; color: var(--text); resize: none; overflow: hidden; min-height: 24px; line-height: 1.4;"
                            .value=${editTaskForm.title}
                            @input=${(e) => { e.target.value = e.target.value.replace(/[\r\n]+/g, ' '); KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, title: e.target.value } })); }}></textarea>
                    </div>

                    <div style="border-bottom: 1px solid var(--border); background: var(--input-bg); flex-shrink: 0; width: 100%;">

                        <div @click=${() => { this._yamlExpanded = !this._yamlExpanded;
this.requestUpdate(); }} 
                            style="padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; font-size: 0.75rem; font-weight: bold; color: var(--text-muted); background: var(--input-bg);">
                            <span style="display: flex; align-items: center; gap: 6px;">⚙️ Ticket Metadata</span>

                            <span>${this._yamlExpanded ?
'▲ Hide' : '▼ Show'}</span>
                        </div>
                        ${this._yamlExpanded ? html`
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; padding: 4px 20px 16px 20px; border-top: 1px solid var(--border);">
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Repository</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.repo', editTaskForm.repo, { type: 'select', style: 'width: 100%; padding: 6px 8px;', selectOptions: this.allRepos.map(r => ({value: r, label: r})), onUpdate: () => KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, bucket: 'None' } })) })}
                                </div>
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Ticket Type</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.type', editTaskForm.type, { type: 'select', style: 'width: 100%; padding: 6px 8px;', selectOptions: [{value: 'todo', label: 'To-Do (Task)'}, {value: 'bug', label: 'Bug'}, {value: 'queue', label: 'Queue (Research)'}] })}
                                </div>
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Status Zone</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.status', editTaskForm.status, { type: 'select', style: 'width: 100%; padding: 6px 8px;', selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}, {value: 'closed', label: 'Closed (Resolved)'}] })}
                                </div>
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Sub-Bucket Mapping</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.bucket', editTaskForm.bucket, { type: 'select', style: 'width: 100%; padding: 6px 8px;', selectOptions: [{value: 'None', label: 'No Bucket'}, ...buckets.map(b => ({value: b.id, label: b.title}))] })}
                                </div>
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Delivery Deadline</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.deliveryDate', editTaskForm.deliveryDate, { type: 'date', style: 'width: 100%; padding: 5px 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 13px;' })}
                                </div>
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Created At</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.createdAt', editTaskForm.createdAt, { type: 'datetime-local', style: 'width: 100%; padding: 5px 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 13px;' })}
                                </div>
                                <div>
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Closed At</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.closedAt', editTaskForm.closedAt, { type: 'datetime-local', style: 'width: 100%; padding: 5px 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 13px;' })}
                                </div>
                                <div style="grid-column: 1 / -1; margin-top: 4px;">
                                    <label style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Tags (comma-separated tokens)</label>
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.tagsRaw', editTaskForm.tagsRaw, { placeholder: 'Tags (comma-separated tokens, e.g. architecture, latency)...', style: 'width: 100%; padding: 6px 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;' })}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="editor-wrapper">
                        <insetu-markdown-editor 
                            .value=${editTaskForm.desc || ''}
                            @content-changed=${(e) => KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, desc: e.detail.value } }))}>
                        </insetu-markdown-editor>
                    </div>
                </div>
                <div slot="footer" style="display: flex; width: 100%;">
                    <button class="btn-sm" style="flex: 0 0 auto; padding: 15px 20px; background: var(--intent-danger); color: white; border: none; font-weight: bold; cursor: pointer; border-right: 1px solid var(--border); border-radius: 0;" @click=${this._deleteTask} title="Delete Ticket">🗑️</button>
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-success); color: white; border: none; font-weight: bold; cursor: pointer; border-right: 1px solid var(--border); border-radius: 0;" @click=${(e) => fetchAndCopy(editTaskForm.filepath, e.target)}>📋 Copy</button>
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-neutral); color: white; border: none; font-weight: bold; cursor: pointer; border-right: 1px solid var(--border); border-radius: 0;" @click=${(e) => fetchAndDownloadState(editTaskForm.filepath, e.target)}>⬇️ Download</button>
                    <insetu-async-btn style="flex: 1; display: ${this._isDirty() ? 'block' : 'none'};" label="💾 Save & Sync Ticket" intent="primary" .onClick=${this._saveEditTask.bind(this)}></insetu-async-btn>
                </div>
            </insetu-modal>
`;
}
    _generateHistoricalChangelog(allRepos = false) {
        const state = KanbanStore.getState();
        const closedTasks = state.tasks.filter(t => {
            const isClosed = t.status === 'closed' || t.status === 'archived' || t.status === 'logged';
            if (allRepos) return isClosed;
            const matchesRepo = state.pinnedRepos.has('ALL') || state.pinnedRepos.has(t.repo);
            const matchesBucket = state.pinnedBuckets.has('ALL') || state.pinnedBuckets.has(t.subBucket);
            const matchesTag = state.pinnedTags.has('ALL') || (t.tags && t.tags.some(tag => state.pinnedTags.has(tag)));
            return isClosed && matchesRepo && matchesBucket && matchesTag;
        });
        const tasksByRepo = closedTasks.reduce((acc, t) => {
                if (!acc[t.repo]) acc[t.repo] = [];
                acc[t.repo].push(t);
                return acc;
        }, {});

        const changelogParts = [];

        Object.keys(tasksByRepo).sort().forEach(repo => {
                changelogParts.push(`# 📜 Historical Changelog for ${repo}\n\n`);
                const repoTasks = tasksByRepo[repo];
                repoTasks.sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));
                const processed = repoTasks.reduce((acc, t) => {
                                const activeDate = t.closedAt || t.timestamp;
                                const dateStr = activeDate ? activeDate.split('T')[0] : 'Unknown Date';
                                const newParts = [...acc.parts];
                                if (dateStr !== acc.currentDate) {
                                                newParts.push(`\n## ${dateStr}\n\n`);
                                }
                                const typeIcon = t.isBug ? '🐛' : t.isQueue ? '🔬' : '✨';
                                newParts.push(`### ${typeIcon} ${t.title}\n\n`);

                                if (t.description) {
                                                const cleanDesc = t.description.split('## Notes / Execution Log')[0].trim();
                                                newParts.push(`${cleanDesc}\n\n`);
                                }
                                return { parts: newParts, currentDate: dateStr };
                }, { parts: [], currentDate: "" });

                changelogParts.push(...processed.parts);
                changelogParts.push(`\n---\n\n`);
        });

        // Clean up trailing separators
        const changelog = changelogParts.join('').trim().replace(/---$/, '').trim();

        if (window.openVirtualFile) {
            window.openVirtualFile("Historical_Changelog.md", changelog);
        } else {
            alert("Virtual file viewer is not available.");
        }
    }
}
customElements.define('insetu-ext-tracker', InSetuExtTracker);
export class InSetuExtTrackerActions extends InSetuElement {
    get extName() { return 'tracker'; }
    static styles = [sharedStyles];

    get _menuItems() {
        const activeSubTab = this.dataset.subId || 'todos';
        const trackerEl = document.querySelector(`#sub-${activeSubTab} insetu-ext-tracker`);
        const items = [];
        if (['todos', 'bugs', 'queue'].includes(activeSubTab)) {
            items.push({ label: 'New Task', icon: '🎫', onClick: () => { trackerEl?._openNewTaskModal(); } });
        } else if (activeSubTab === 'log') {
            items.push({ label: 'Generate Changelog (all)', icon: '📜', onClick: () => { trackerEl?._generateHistoricalChangelog(true); } });
            items.push({ label: 'Generate Changelog (current filter)', icon: '🔍', onClick: () => { trackerEl?._generateHistoricalChangelog(false); } });
        }
        return items;
    }

    render() {
        return html`
            <insetu-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </insetu-dropdown>
        `;
    }
}
customElements.define('insetu-ext-tracker-actions', InSetuExtTrackerActions);
// OS Registration Hook
window.ExtensionRegistry.registerExtension('tracker', {
    name: "Issue Tracker",
    version: "2.0.0",
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "tasks",
            label: "Tasks",
            order: 3
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "tasks",
            id: "todos",
            label: "To-Dos",
            order: 1,
            component: "insetu-ext-tracker"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "tasks",
            id: "bugs",
            label: "Bugs",
            order: 2,
            component: "insetu-ext-tracker"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "tasks",
            id: "queue",
            label: "Queue",
            order: 3,
            component: "insetu-ext-tracker"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "tasks",
            id: "log",
            label: "Log",
            order: 4,
            component: "insetu-ext-tracker"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "tasks",
            targetSub: "todos",
            component: "insetu-ext-tracker-actions",
            order: 1
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "tasks",
            targetSub: "bugs",
            component: "insetu-ext-tracker-actions",
            order: 2
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "tasks",
            targetSub: "queue",
            component: "insetu-ext-tracker-actions",
            order: 3
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "tasks",
            targetSub: "log",
            component: "insetu-ext-tracker-actions",
            order: 4
        }
    ],
    uiHooks: {
        'zone:file-edit-override': (filepath) => {
            if (filepath.includes('.tracker/')) {
                window.inSetu.stores.Fs.setState(s => ({ fileModal: { ...s.fileModal, open: false } }));
                if (window.switchTab) window.switchTab(null, 'tasks');
                const activeSub = localStorage.getItem('insetu_subtab_tasks') || 'todos';
                const trackerEl = document.querySelector(`#sub-${activeSub} insetu-ext-tracker`);
                if (trackerEl) {
                    trackerEl._openEditTaskModal(filepath);
                }
                return true;
            }
            return false;
        },
        'zone:post-file-save': (filepath) => {
            if (filepath.includes('.tracker/')) KanbanStore.getState().fetchTasks();
            return false;
        },
        'zone:tab-changed': (tabId) => {
            if (tabId === 'tasks') {
                KanbanStore.getState().fetchTasks();
            }
        },
        'zone:soft-refresh': (ws) => {
            KanbanStore.setState({ tasks: [] });
            KanbanStore.getState().fetchTasks();
            return false;
        }
    }
});
window.KanbanStore = KanbanStore;

// --- HEADLESS EXTENSION STATE SYNCHRONIZATION ---
// Executes independently of the UI component to ensure other extensions (like Git Changelogs) 
// always have access to the tracker backlog via the UDF KanbanStore.
KanbanStore.getState().fetchTasks();