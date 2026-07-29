import { createExtensionStore, InSetuElement, bindStoreInput } from '../sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const KanbanStore = createExtensionStore('Kanban', {
    tasks: [],
    pinnedTags: new Set(["ALL"]),
    pinnedBuckets: new Set(["ALL"]),
    tagsExpanded: false,
    modals: { new: false, edit: false },
    newTaskForm: { repo: '', type: 'todo', status: 'open', bucket: 'None', title: '', tags: '', desc: '', deliveryDate: '' },
    editTaskForm: { filepath: '', title: '', tagsRaw: '', bucket: 'None', desc: '', origYaml: '', deliveryDate: '', createdAt: '', closedAt: '' },
    setNewTaskField: (field, value) => KanbanStore.setState((state) => {
        const updatedForm = { ...state.newTaskForm };
        updatedForm[field] = value;
        return { newTaskForm: updatedForm };
    }),
    setEditTaskField: (field, value) => KanbanStore.setState((state) => {
        const updatedForm = { ...state.editTaskForm };
        updatedForm[field] = value;
        return { editTaskForm: updatedForm };
    }),
    setModal: (modalName, isOpen) => KanbanStore.setState((state) => ({ modals: { ...state.modals, [modalName]: isOpen } })),
    resetState: () => KanbanStore.setState({ tasks: [] }),
    fetchTasks: async () => {
        if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('tracker')) return;
        const res = await window.inSetu.api.workspace('tracker/files?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            KanbanStore.setState({ tasks: data.tasks || [] });
        }
    },
    transitionTask: async (task, newStatus, newType = null) => {
        const res = await window.inSetu.api.workspace('tracker/transition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo: task.repo, filepath: task.filepath, new_status: newStatus, new_type: newType })
        });
        if (res.ok) {
            const data = await res.json();
            KanbanStore.setState(state => ({
                tasks: state.tasks.map(t => t.id === task.id ? {
                    ...t, status: newStatus, filepath: data.new_filepath, ticket_type: newType || t.ticket_type,
                    isTodo: newType ? newType === 'todo' : t.isTodo, isBug: newType ? newType === 'bug' : t.isBug, isQueue: newType ? newType === 'queue' : t.isQueue
                } : t)
            }));
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to transition task.");
        }
    }
}, ['pinnedTags', 'pinnedBuckets']);
window.inSetu.stores.Kanban = KanbanStore;
// UI Hooks for real-time reactivity
if (window.ExtensionRegistry && window.ExtensionRegistry.registerUIHook) {
    window.ExtensionRegistry.registerUIHook('zone:vfs-mutated', (payload) => {
        if (!payload || !payload.mutations) return;
        const touchedTracker = payload.mutations.some(m => m.filepath && m.filepath.includes('.tracker/') && m.filepath.endsWith('.md'));
        if (touchedTracker) KanbanStore.getState().fetchTasks();
    });
}

window.addEventListener('insetu:tracker:load-board', () => KanbanStore.getState().fetchTasks());

import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
export class InSetuExtTracker extends InSetuElement {
    static get extensionName() { return 'tracker'; }
    get extName() { return 'tracker'; }
    static properties = {
        tasks: { type: Array },
        pinnedRepos: { type: Object },
        pinnedTags: { type: Object },
        pinnedBuckets: { type: Object },
        allRepos: { type: Array },
        activeTab: { type: String },
        searchQuery: { type: String },
        _reposExpanded: { type: Boolean },
        _bucketsExpanded: { type: Boolean },
        _tagsExpanded: { type: Boolean }
    };
static styles = [
sharedStyles,
css`
    :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
    .tracker-body { flex: 1; overflow-y: auto; padding: 20px; }

    .task-tag { background: var(--border); color: var(--text); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; opacity: 0.8; display: inline-block; }
    :host-context([data-theme="e-ink"]) .task-tag { background: #ffffff !important; color: #000000 !important; border: 1px dashed #000000 !important; opacity: 1 !important; }
    :host-context([data-theme="light"]) .task-tag { background: #e2e8f0; color: #0f172a; }
    .board-columns { display: flex; gap: 15px; }
    .column { flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px; }
    .column h3 { margin-top: 0; font-size: 1.1rem; }

    @container (max-width: 800px) {
        .board-columns { flex-direction: column; gap: 25px; }
        .column { background: transparent; padding: 0; }
        .column h3 { 
            font-size: 1.2rem; 
            border-bottom: 1px solid var(--border); 
            padding-bottom: 5px; 
            margin-bottom: 15px; 
        }
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
        this.pinnedTags = new Set(['ALL']);
        this.pinnedBuckets = new Set(['ALL']);
        this.allRepos = [];
        this.activeTab = 'todos';
        this.searchQuery = '';
        this._reposExpanded = true;
        this._bucketsExpanded = true;
        this._tagsExpanded = true;
}
    connectedCallback() {
        super.connectedCallback();
        const parsedTab = this.dataset.subId || this.parentElement?.id?.replace('sub-', '');
        this.activeTab = ['todos', 'bugs', 'queue', 'log'].includes(parsedTab) ? parsedTab : 'todos';
        this.subscribe(AppStore, (state) => {
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        });
        this.subscribe(window.inSetu.stores.Gather, (state) => {
            this.allRepos = state.allRepos || [];
        });
        this.allRepos = window.inSetu.stores.Gather.getState().allRepos || [];
        this.pinnedRepos = AppStore.getState().pinnedRepos || new Set(['ALL']);
        this.subscribe(KanbanStore, (state) => {
            this.tasks = state.tasks || [];
            this.pinnedTags = state.pinnedTags;
            this.pinnedBuckets = state.pinnedBuckets;
            this.requestUpdate();
        });
        const kState = KanbanStore.getState();
        this.tasks = kState.tasks || [];
        this.pinnedTags = kState.pinnedTags;
        this.pinnedBuckets = kState.pinnedBuckets;

        this.registerGlobalListener('insetu:tracker:generate-changelog', window, (e) => {
            if (this.activeTab === 'log') {
                this._generateHistoricalChangelog(e.detail.allRepos);
            }
        });

        KanbanStore.getState().fetchTasks();
    }

    onWorkspaceChanged(newWorkspaceId) {
        KanbanStore.getState().fetchTasks();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
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
                entityType="file:task"
                .entityData=${{ ...t, isFS: true, repoDir: t.repo, suppressCopy: true, suppressDownload: true }}
                @card-clicked=${() => this.vfs.viewSourceFile(t.filepath, true)}>

                <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                    ${t.deliveryDate ? html`
                        <span class="task-tag" style="background: ${isOverdue ? 'var(--intent-danger)' : 'var(--input-bg)'}; color: ${isOverdue ? 'var(--bg)' : 'var(--text)'}; border: 1px solid var(--border);">
                            📅 Due: ${t.deliveryDate}
                        </span>
                    ` : ''}
                    ${t.tags && t.tags.length > 0 ? t.tags.map(tag => html`<span class="task-tag">#${tag}</span>`) : ''}
                </div>
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

    _renderLog(filteredTasks) {
        const recentlyClosed = filteredTasks.filter(t => t.status === 'closed' || t.status === 'logged').sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));
const archived = filteredTasks.filter(t => t.status === 'archived').sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));

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
            if (matchesRepo && t.tags) {
                t.tags.forEach(tag => allTags.add(tag));
            }
        });
        const tagsArray = Array.from(allTags).sort();
        // Apply filters to tasks
        const filteredTasks = this.tasks.filter(t => {
            const matchesRepo = this.pinnedRepos.has('ALL') || this.pinnedRepos.has(t.repo);
            const matchesTag = this.pinnedTags.has('ALL') || (t.tags && t.tags.some(tag => this.pinnedTags.has(tag)));

            let matchesBucket = true;
            if (!this.pinnedBuckets.has('ALL')) {
                const repoBucketsPinned = Array.from(this.pinnedBuckets).some(pb => pb.startsWith(t.repo + '::'));
                if (repoBucketsPinned) {
                    matchesBucket = this.pinnedBuckets.has(t.repo + '::' + t.subBucket);
                }
            }
            return matchesRepo && matchesTag && matchesBucket;
        });
        const textFilteredTasks = this.searchQuery 
            ? window.inSetu.utils.fuzzyFilterObjects(filteredTasks, this.searchQuery, t => `${t.title} ${t.id} ${t.description} ${(t.tags || []).join(' ')}`) 
            : filteredTasks;

        const hasFilters = !this.pinnedRepos.has('ALL') || !this.pinnedTags.has('ALL') || !this.pinnedBuckets.has('ALL');
        return html`
            <yenvui-toolbar
                searchPlaceholder="🔍 Fuzzy search tickets..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => this.searchQuery = e.detail.value}
                .enableFilterDropdown=${true}
                .filterText=${"Filters"}
                .hasFiltersOverride=${hasFilters}>
                <div slot="filters" style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
                    <div style="display: flex; align-items: flex-start; gap: 5px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: var(--text); cursor: pointer; user-select: none; margin-top: 4px; white-space: nowrap;" @click=${() => this._reposExpanded = !this._reposExpanded}>
                            📌 Repos ${this._reposExpanded ? '▼' : '▶'}
                        </span>
                        <insetu-repo-filter
                            label=""
                            .repos=${this._reposExpanded ? this.allRepos : Array.from(this.pinnedRepos).filter(r => r !== 'ALL')}
                            .activeRepos=${Array.from(this.pinnedRepos)}
                            @repo-filter-changed=${(e) => {
                                AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos));
                                KanbanStore.setState({ pinnedBuckets: new Set(['ALL']) });
                            }}>
                        </insetu-repo-filter>
                    </div>
                        ${!this.pinnedRepos.has('ALL') ? html`
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border);">
                                ${Array.from(this.pinnedRepos).map(repo => {
                                    const buckets = this.sys.getFlattenedBuckets(repo);
                                    if (buckets.length === 0) return '';

                                    const repoBucketsActive = buckets.some(b => this.pinnedBuckets.has(repo + '::' + b.id));
                                    const repoAllActive = this.pinnedBuckets.has('ALL') || !repoBucketsActive;

                                    const visibleBuckets = this._bucketsExpanded 
                                        ? buckets 
                                        : buckets.filter(b => this.pinnedBuckets.has(repo + '::' + b.id));

                                    if (!this._bucketsExpanded && !repoBucketsActive) return '';

                                    return html`
                                        <div style="display: flex; align-items: flex-start; gap: 5px;">
                                            <span style="font-size: 0.85rem; font-weight: bold; color: var(--text); cursor: pointer; user-select: none; margin-top: 4px; white-space: nowrap;" @click=${() => this._bucketsExpanded = !this._bucketsExpanded}>
                                                🗂️ ${repo} ${this._bucketsExpanded ? '▼' : '▶'}
                                            </span>
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" @yenvui-pill-toggled=${(e) => {
                                                e.stopPropagation();
                                                const { id, active } = e.detail;
                                                let newSet = new Set(this.pinnedBuckets);

                                                if (id === repo + '::ALL') {
                                                    buckets.forEach(b => newSet.delete(repo + '::' + b.id));
                                                    if (newSet.size === 0) newSet.add('ALL');
                                                } else {
                                                    newSet.delete('ALL');
                                                    if (active) newSet.add(id);
                                                    else newSet.delete(id);
                                                    if (newSet.size === 0) newSet.add('ALL');
                                                }
                                                KanbanStore.setState({ pinnedBuckets: newSet });
                                            }}>
                                                <yenvui-pill pillId=${repo + '::ALL'} labelText="All" variant="text" ?active=${repoAllActive}></yenvui-pill>
                                                ${visibleBuckets.map(b => html`
                                                    <yenvui-pill pillId=${repo + '::' + b.id} labelText=${b.title} variant="text" ?active=${this.pinnedBuckets.has(repo + '::' + b.id)}></yenvui-pill>
                                                `)}
                                            </div>
                                        </div>
                                    `;
                                })}
                            </div>
                        ` : ''}
                        ${tagsArray.length > 0 ? html`
                            <div style="display: flex; align-items: flex-start; gap: 5px; margin-top: 10px;">
                                <span style="font-size: 0.85rem; font-weight: bold; color: var(--text); cursor: pointer; user-select: none; margin-top: 4px; white-space: nowrap;" @click=${() => this._tagsExpanded = !this._tagsExpanded}>
                                    🏷️ Tags ${this._tagsExpanded ? '▼' : '▶'}
                                </span>
                                <yenvui-filter-group
                                    label=""
                                    .allowAll=${true}
                                    .items=${(this._tagsExpanded ? tagsArray : Array.from(this.pinnedTags).filter(t => t !== 'ALL')).map(t => ({id: t, label: '#' + t}))}
                                    .activeItems=${Array.from(this.pinnedTags)}
                                    @yenvui-filter-changed=${(e) => {
                                        KanbanStore.setState({ pinnedTags: new Set(e.detail.activeItems) });
                                    }}>
                                </yenvui-filter-group>
                            </div>
                        ` : ''}
                </div>
            </yenvui-toolbar>

            <div class="tracker-body">
                ${this.activeTab === 'todos' ? this._renderColumns('todos', textFilteredTasks) : ''}
                ${this.activeTab === 'bugs' ? this._renderColumns('bugs', textFilteredTasks) : ''}
                ${this.activeTab === 'queue' ? this._renderColumns('queue', textFilteredTasks) : ''}
                ${this.activeTab === 'log' ? this._renderLog(textFilteredTasks) : ''}
            </div>
        `;
    }
    _generateHistoricalChangelog(allRepos = false) {
        const state = KanbanStore.getState();
        const closedTasks = state.tasks.filter(t => {
            const isClosed = t.status === 'closed' || t.status === 'archived' || t.status === 'logged';
            if (allRepos) return isClosed;
            const matchesRepo = this.pinnedRepos.has('ALL') || this.pinnedRepos.has(t.repo);
            const matchesTag = state.pinnedTags.has('ALL') || (t.tags && t.tags.some(tag => state.pinnedTags.has(tag)));
            return isClosed && matchesRepo && matchesTag;
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

        if (this.vfs && this.vfs.openVirtualFile) {
            this.vfs.openVirtualFile("Historical_Changelog.md", changelog);
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
        const items = [];
        if (['todos', 'bugs', 'queue'].includes(activeSubTab)) {
            items.push({ label: 'New Task', icon: '🎫', onClick: () => { 
                this.dispatch('insetu:tracker:open-new-task', { activeTab: activeSubTab });
            } });
        } else if (activeSubTab === 'log') {
            items.push({ label: 'Generate Changelog (all)', icon: '📜', onClick: () => { 
                this.dispatch('insetu:tracker:generate-changelog', { allRepos: true });
            } });
            items.push({ label: 'Generate Changelog (current filter)', icon: '🔍', onClick: () => { 
                this.dispatch('insetu:tracker:generate-changelog', { allRepos: false });
            } });
        }
        return items;
    }

    render() {
        return html`
            <yenvui-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </yenvui-dropdown>
        `;
    }
}
customElements.define('insetu-ext-tracker-actions', InSetuExtTrackerActions);

export class InSetuExtTrackerModals extends InSetuElement {
    static get extensionName() { return 'tracker'; }
    get extName() { return 'tracker'; }
    static properties = {
        allRepos: { type: Array },
        pinnedRepos: { type: Object },
        pinnedTags: { type: Object },
        _modals: { type: Object },
        _yamlExpanded: { type: Boolean },
        _isSaving: { type: Boolean },
        _isCopying: { type: Boolean },
        _isDownloading: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        select, input[type="date"] {
            background: var(--input-bg) !important;
            color: var(--text) !important;
            border: 1px solid var(--border) !important;
            border-radius: 4px !important;
            box-sizing: border-box;
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
    `];

    constructor() {
        super();
        this.allRepos = [];
        this.pinnedRepos = new Set(['ALL']);
        this.pinnedTags = new Set(['ALL']);
        this._modals = { new: false, edit: false };
        this._yamlExpanded = false;
        this._isSaving = false;
        this._isCopying = false;
        this._isDownloading = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, (state) => {
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        });
        this.subscribe(window.inSetu.stores.Gather, (state) => {
            this.allRepos = state.allRepos || [];
            this.requestUpdate();
        });
        this.subscribe(KanbanStore, (state) => {
            this.pinnedTags = state.pinnedTags;
            this._modals = state.modals;
            this.requestUpdate();
        });
        const aState = AppStore.getState();
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);
        this.allRepos = window.inSetu.stores.Gather.getState().allRepos || [];
        const kState = KanbanStore.getState();
        this.pinnedTags = kState.pinnedTags;
        this._modals = kState.modals;

        this.registerGlobalListener('insetu:tracker:open-new-task', window, (e) => {
            this._openNewTaskModal(e.detail.activeTab);
        });
        this.registerGlobalListener('insetu:tracker:open-edit-task', window, (e) => {
            this._openEditTaskModal(e.detail.filepath);
        });
    }

    _openNewTaskModal(activeTab) {
        const state = KanbanStore.getState();
        const isBugs = activeTab === 'bugs';
        const isQueue = activeTab === 'queue';
        const defaultType = isBugs ? 'bug' : (isQueue ? 'queue' : 'todo');
        const prePopulatedTags = Array.from(this.pinnedTags || []).filter(t => t !== 'ALL');
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

    async _openEditTaskModal(filepath) {
        try {
            const res = await window.inSetu.api.workspace(`fs/fetch?file=${encodeURIComponent(filepath)}`);
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
        const newContent = `---\nrepo: "${repo}"\ntype: "${type}"\nstatus: "${status}"\nid: "${ticketId}"\ntitle: "${title.replace(/"/g, "'")}"\n${createdYaml}\n${closedYaml}\nsub_bucket: "${bucket}"\n${tagsYaml}\n${deliveryYaml}\n---\n\n## Description\n${desc}\n`;

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
    render() {
        const { newTaskForm } = KanbanStore.getState();
        const selectedRepoNew = newTaskForm.repo || this.allRepos[0];
        const bucketsNew = selectedRepoNew ? this.sys.getFlattenedBuckets(selectedRepoNew) : [];

        const { editTaskForm } = KanbanStore.getState();
        const activeRepoEdit = editTaskForm.repo || '';
        const bucketsEdit = activeRepoEdit ? this.sys.getFlattenedBuckets(activeRepoEdit) : [];

        return html`
            <!-- New Task Modal -->
            <yenvui-modal 
                ?open=${this._modals?.new} 
                ?fullscreen=${true}
                titleText="Create New Ticket"
                @yenvui-modal-closed=${() => KanbanStore.getState().setModal('new', false)}>

                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                        ${bindStoreInput(KanbanStore, 'newTaskForm.repo', newTaskForm.repo, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: this.allRepos.map(r => ({value: r, label: r})), onUpdate: () => KanbanStore.setState(s => ({ newTaskForm: { ...s.newTaskForm, bucket: 'None' } })) })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.type', newTaskForm.type, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: [{value: 'todo', label: 'To-Do (Task)'}, {value: 'bug', label: 'Bug'}, {value: 'queue', label: 'Queue (Research)'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.status', newTaskForm.status, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.bucket', newTaskForm.bucket, { type: 'select', style: 'flex: 1; min-width: 120px;', selectOptions: [{value: 'None', label: 'No Bucket'}, ...bucketsNew.map(b => ({value: b.id, label: b.title}))] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.deliveryDate', newTaskForm.deliveryDate, { type: 'date', style: 'flex: 1; min-width: 120px; padding: 10px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono);' })}
                    </div>
                    ${bindStoreInput(KanbanStore, 'newTaskForm.title', newTaskForm.title, { placeholder: 'Ticket Title (e.g., Fix schema registry timeout)', style: 'margin-bottom: 10px; font-weight: bold;' })}
                    ${bindStoreInput(KanbanStore, 'newTaskForm.tags', newTaskForm.tags, { placeholder: 'Tags (comma separated, e.g. frontend, critical)', style: 'margin-bottom: 10px;' })}
                    ${bindStoreInput(KanbanStore, 'newTaskForm.desc', newTaskForm.desc, { type: 'textarea', placeholder: 'Markdown description...', style: 'flex: 1; margin-bottom: 10px; min-height: 150px;' })}
                </div>
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${async (e) => {
                    this._isSaving = true;
                    try { await this._saveNewTask(); } catch(err) {}
                    this._isSaving = false;
                }}>${this._isSaving ? '⏳...' : '💾 Save'}</button>
            </yenvui-modal>
            <!-- Edit Task Modal -->
            <yenvui-modal 
                ?open=${this._modals?.edit} 
                titleText="Edit Ticket"
                ?fullscreen=${true}
                @yenvui-modal-closing=${this._handleModalClosing}
                @yenvui-modal-closed=${() => { KanbanStore.getState().setModal('edit', false); this._originalTaskSnapshot = null; }}>

                <div slot="body" style="margin: -20px; height: calc(100% + 40px); display: flex; flex-direction: column; overflow: hidden; background: var(--bg);">
                    <div style="padding: 6px 20px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg);">
                        <textarea placeholder="Ticket Summary Blueprint..." rows="1" style="font-weight: bold; font-size: 0.9rem; border: none !important; outline: none !important; box-shadow: none !important; padding: 2px 0; background: transparent; width: 100%; color: var(--text); resize: none; overflow: hidden; min-height: 24px; line-height: 1.4;"
                            .value=${editTaskForm.title}
                            @input=${(e) => { e.target.value = e.target.value.replace(/[\r\n]+/g, ' '); KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, title: e.target.value } })); }}></textarea>
                    </div>

                    <div style="border-bottom: 1px solid var(--border); background: var(--input-bg); flex-shrink: 0; width: 100%;">
                        <div @click=${() => { this._yamlExpanded = !this._yamlExpanded; this.requestUpdate(); }} 
                                    style="padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; font-size: 0.75rem; font-weight: bold; color: var(--text-muted); background: var(--input-bg);">
                                    <span style="display: flex; align-items: center; gap: 6px;">⚙️ Ticket Metadata</span>
                                    <span>${this._yamlExpanded ? '▲ Hide' : '▼ Show'}</span>
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
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.bucket', editTaskForm.bucket, { type: 'select', style: 'width: 100%; padding: 6px 8px;', selectOptions: [{value: 'None', label: 'No Bucket'}, ...bucketsEdit.map(b => ({value: b.id, label: b.title}))] })}
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
                <button slot="footer" style="flex: 0 0 auto; background: var(--intent-danger); color: white;" @click=${this._deleteTask} title="Delete Ticket">🗑️</button>
                <button slot="footer" style="background: var(--intent-success); color: white;" @click=${async () => {
                    this._isCopying = true;
                    try { await this.vfs.fetchAndCopy(editTaskForm.filepath); } catch(err) {}
                    setTimeout(() => this._isCopying = false, 2000);
                }}>${this._isCopying ? '✅ Copied!' : '📋 Copy'}</button>
                <button slot="footer" style="background: var(--intent-neutral); color: white;" @click=${async () => {
                    this._isDownloading = true;
                    try { await this.vfs.fetchAndDownloadState(editTaskForm.filepath); } catch(err) {}
                    setTimeout(() => this._isDownloading = false, 2000);
                }}>${this._isDownloading ? '✅ Downloaded' : '⬇️ Download'}</button>
                ${this._isDirty() ? html`
                    <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${async () => {
                        this._isSaving = true;
                        try { await this._saveEditTask(); } catch(err) {}
                        this._isSaving = false;
                    }}>${this._isSaving ? '⏳...' : '💾 Save'}</button>
                ` : ''}
            </yenvui-modal>
`;
    }
}
customElements.define('insetu-ext-tracker-modals', InSetuExtTrackerModals);

window.ExtensionRegistry.registerShortcut('modal:new-task-modal', 'ctrl+s', () => {
    const shell = document.querySelector('insetu-app-shell');
    const el = shell ? shell.shadowRoot.querySelector('insetu-ext-tracker-modals') : document.querySelector('insetu-ext-tracker-modals');
    if (el) el._saveNewTask();
});
window.ExtensionRegistry.registerShortcut('modal:edit-task-modal', 'ctrl+s', () => {
    const shell = document.querySelector('insetu-app-shell');
    const el = shell ? shell.shadowRoot.querySelector('insetu-ext-tracker-modals') : document.querySelector('insetu-ext-tracker-modals');
    if (el) el._saveEditTask();
});

// OS Registration Hook
window.ExtensionRegistry.registerExtension('tracker', {
    name: "Issue Tracker",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'task',
            id: 'task-start',
            label: 'Start',
            icon: '▶️',
            intent: 'warning',
            order: 110,
            match: (data) => data.status === 'open' && !data.isQueue,
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'active');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-reopen',
            label: 'Re-open',
            icon: '🔄',
            intent: 'highlight',
            order: 110,
            match: (data) => data.status === 'closed',
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'open');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-accept',
            label: 'Accept',
            icon: '✅',
            intent: 'success',
            order: 110,
            match: (data) => data.status !== 'closed' && data.isQueue,
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'open', 'todo');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-pause',
            label: 'Pause',
            icon: '⏸️',
            intent: 'neutral',
            order: 120,
            match: (data) => data.status === 'active' && !data.isQueue,
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'open');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-close',
            label: (data) => data.isQueue ? 'Resolve' : 'Close',
            icon: '✅',
            intent: (data) => data.isQueue ? 'neutral' : 'success',
            order: 130,
            match: (data) => data.status !== 'closed' && data.status !== 'archived',
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'closed');
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-tracker-modals"
        },
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
                if (window.inSetu.sys && window.inSetu.sys.switchTab) window.inSetu.sys.switchTab(null, 'tasks');
                window.inSetu.events.emit('insetu:tracker:open-edit-task', { filepath });
                return true;
            }
            return false;
        },
        'zone:tab-changed': (tabId) => {
            if (tabId === 'tasks') {
                KanbanStore.getState().fetchTasks();
            }
        },
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'tasks' && data.forceRefresh) {
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

// --- HEADLESS EXTENSION STATE SYNCHRONIZATION ---
// Executes independently of the UI component to ensure other extensions (like Git Changelogs)  
// always have access to the tracker backlog via the UDF KanbanStore.
KanbanStore.getState().fetchTasks();