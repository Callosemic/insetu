import { createExtensionStore, InSetuElement, bindStoreInput } from '../core/sdk.js';

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
import { sharedStyles } from '../core/shared_styles.js';
export class InSetuExtTracker extends InSetuElement {
    static get extensionName() { return 'tracker'; }
    get extName() { return 'tracker'; }
    static properties = {
        tasks: { type: Array },
        pinnedTags: { type: Object },
        pinnedBuckets: { type: Object },
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
        this.pinnedTags = new Set(['ALL']);
        this.pinnedBuckets = new Set(['ALL']);
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

        if (typeof KanbanStore !== 'undefined' && KanbanStore) {
            this.subscribe(KanbanStore, (state) => {
                this.tasks = state?.tasks || [];
                this.pinnedTags = state?.pinnedTags || new Set(['ALL']);
                this.pinnedBuckets = state?.pinnedBuckets || new Set(['ALL']);
                this.requestUpdate();
            });
            const kState = KanbanStore.getState ? KanbanStore.getState() : {};
            this.tasks = kState?.tasks || [];
            this.pinnedTags = kState?.pinnedTags || new Set(['ALL']);
            this.pinnedBuckets = kState?.pinnedBuckets || new Set(['ALL']);
        }

        this.registerGlobalListener('insetu:tracker:generate-changelog', window, (e) => {
            if (this.activeTab === 'log') {
                this._generateHistoricalChangelog(e.detail.allRepos);
            }
        });

        if (KanbanStore?.getState?.()?.fetchTasks) {
            KanbanStore.getState().fetchTasks();
        }
    }
    onWorkspaceChanged(newWorkspaceId) {
        KanbanStore.getState().fetchTasks();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    _renderTaskCard(t) {
        const dateStr = this.utils.formatDate(t.timestamp);
        const bucketStr = (t.subBucket && t.subBucket !== 'None') ? ` | 🗂️ ${t.subBucket}` : '';
        const statusStr = (t.status !== 'closed') ? ` | ${t.status.charAt(0).toUpperCase() + t.status.slice(1)}` : '';
        const descText = `${t.repo}${bucketStr}${statusStr} | ${dateStr}`;

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
            const matchesRepo = this.ecosystem.pinnedRepos.has('ALL') || this.ecosystem.pinnedRepos.has(t.repo);
            if (matchesRepo && t.tags) {
                t.tags.forEach(tag => allTags.add(tag));
            }
        });
        const tagsArray = Array.from(allTags).sort();
        // Apply filters to tasks
        const filteredTasks = this.tasks.filter(t => {
            const matchesRepo = this.ecosystem.pinnedRepos.has('ALL') || this.ecosystem.pinnedRepos.has(t.repo);
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

        const hasFilters = !this.ecosystem.pinnedRepos.has('ALL') || !this.pinnedTags.has('ALL') || !this.pinnedBuckets.has('ALL');
        return html`
            <sutram-toolbar
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
                            .repos=${this._reposExpanded ? this.ecosystem.allRepos : Array.from(this.ecosystem.pinnedRepos).filter(r => r !== 'ALL')}
                            .activeRepos=${Array.from(this.ecosystem.pinnedRepos)}
                            @repo-filter-changed=${(e) => {
                                window.inSetu.stores.Gather.getState().setPinnedRepos(new Set(e.detail.activeRepos));
                                KanbanStore.setState({ pinnedBuckets: new Set(['ALL']) });
                            }}>
                        </insetu-repo-filter>
                    </div>
                        ${!this.ecosystem.pinnedRepos.has('ALL') ? html`
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border);">
                                ${Array.from(this.ecosystem.pinnedRepos).map(repo => {
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
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" @sutram-pill-toggled=${(e) => {
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
                                                <sutram-pill pillId=${repo + '::ALL'} labelText="All" variant="text" ?active=${repoAllActive}></sutram-pill>
                                                ${visibleBuckets.map(b => html`
                                                    <sutram-pill pillId=${repo + '::' + b.id} labelText=${b.title} variant="text" ?active=${this.pinnedBuckets.has(repo + '::' + b.id)}></sutram-pill>
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
                                <sutram-filter-group
                                    label=""
                                    .allowAll=${true}
                                    .items=${(this._tagsExpanded ? tagsArray : Array.from(this.pinnedTags).filter(t => t !== 'ALL')).map(t => ({id: t, label: '#' + t}))}
                                    .activeItems=${Array.from(this.pinnedTags)}
                                    @sutram-filter-changed=${(e) => {
                                        KanbanStore.setState({ pinnedTags: new Set(e.detail.activeItems) });
                                    }}>
                                </sutram-filter-group>
                            </div>
                        ` : ''}
                </div>
            </sutram-toolbar>

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
            const matchesRepo = this.ecosystem.pinnedRepos.has('ALL') || this.ecosystem.pinnedRepos.has(t.repo);
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
            <sutram-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </sutram-dropdown>
        `;
    }
}
customElements.define('insetu-ext-tracker-actions', InSetuExtTrackerActions);

export class InSetuExtTrackerModals extends InSetuElement {
    static get extensionName() { return 'tracker'; }
    get extName() { return 'tracker'; }
    static properties = {
        pinnedTags: { type: Object },
        _modals: { type: Object },
        _yamlExpanded: { type: Boolean },
        _isSaving: { type: Boolean },
        _isCopying: { type: Boolean },
        _isDownloading: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: contents; }
    `];
    constructor() {
        super();
        this.pinnedTags = new Set(['ALL']);
        this._modals = { new: false, edit: false };
        this._yamlExpanded = false;
        this._isSaving = false;
        this._isCopying = false;
        this._isDownloading = false;
    }
    connectedCallback() {
        super.connectedCallback();

        if (typeof KanbanStore !== 'undefined' && KanbanStore) {
            this.subscribe(KanbanStore, (state) => {
                this.pinnedTags = state?.pinnedTags || new Set(['ALL']);
                this._modals = state?.modals || { new: false, edit: false };
                this.requestUpdate();
            });
            const kState = KanbanStore.getState ? KanbanStore.getState() : {};
            this.pinnedTags = kState?.pinnedTags || new Set(['ALL']);
            this._modals = kState?.modals || { new: false, edit: false };
        }

        this.registerGlobalListener('insetu:tracker:open-new-task', window, (e) => {
            this._openNewTaskModal(e.detail.activeTab);
        });
        this.registerGlobalListener('insetu:tracker:open-edit-task', window, (e) => {
            this._openEditTaskModal(e.detail.filepath);
        });
    }
    _getBucketsForRepo(repoDir) {
        const getFn = window.inSetu?.utils?.getFlattenedBuckets || this.sys?.getFlattenedBuckets;
        if (!getFn) return [];
        const repoConfig = this.ecosystem.targetConfigs.find(r => r && r.repo_dir === repoDir);
        if (!repoConfig) return [];
        return getFn([repoConfig]);
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
        state.setNewTaskField('deliveryDate', '');

        let targetRepo = this.ecosystem.allRepos.length > 0 ? this.ecosystem.allRepos[0] : '';
        if (this.ecosystem.pinnedRepos.size === 1 && !this.ecosystem.pinnedRepos.has('ALL')) {
            const pinnedRepo = Array.from(this.ecosystem.pinnedRepos)[0];
            if (this.ecosystem.allRepos.includes(pinnedRepo)) {
                targetRepo = pinnedRepo;
            }
        }
        state.setNewTaskField('repo', targetRepo);

        // Smart Bucket Resolution from active bucket filters
        let targetBucket = 'None';
        const activeBucketPins = Array.from(state.pinnedBuckets || []).filter(b => b !== 'ALL');
        if (activeBucketPins.length > 0) {
            const repoPrefix = targetRepo ? `${targetRepo}::` : '';
            const matchingPins = activeBucketPins.filter(b => !targetRepo || b.startsWith(repoPrefix));
            const bucketIds = Array.from(new Set(matchingPins.map(b => b.includes('::') ? b.split('::')[1] : b)));
            if (bucketIds.length === 1) {
                targetBucket = bucketIds[0];
            } else if (activeBucketPins.length === 1) {
                const singlePin = activeBucketPins[0];
                if (singlePin.includes('::')) {
                    const [pRepo, pBucket] = singlePin.split('::');
                    if (!targetRepo || pRepo === targetRepo) {
                        targetBucket = pBucket;
                        if (!targetRepo) state.setNewTaskField('repo', pRepo);
                    }
                }
            }
        }
        state.setNewTaskField('bucket', targetBucket);

        state.setModal('new', true);
    }

    async _saveNewTask() {
        const { repo, type, status, title, tags, desc, bucket, deliveryDate } = KanbanStore.getState().newTaskForm;
        const sub_bucket = bucket || 'None';

        if (!title || !desc) {
            throw new Error("Title and Description are required.");
        }
        await this.api.postJson('new', {
            repo, type, status, title, tags, description: desc, sub_bucket, delivery_date: deliveryDate
        });
        KanbanStore.getState().setModal('new', false);
        KanbanStore.getState().fetchTasks();
    }
    _openEditTaskModal(filepath) {
        KanbanStore.getState().setEditTaskField('filepath', filepath);
        KanbanStore.getState().setModal('edit', true);
    }

    _onFrontmatterLoaded(e) {
        const yaml = e.detail.yaml;
        const content = e.detail.content;
        const filepath = KanbanStore.getState().editTaskForm.filepath;
        const repo = filepath.split('/')[0];
        const defaultTitle = filepath.split('/').pop();
        const inferredType = filepath.includes('/bugs/') ? 'bug' : filepath.includes('/queue/') ? 'queue' : 'todo';
        const inferredStatus = filepath.includes('/active/') ? 'active' : filepath.includes('/closed/') ? 'closed' : filepath.includes('/archived/') ? 'archived' : filepath.includes('/log/') ? 'logged' : 'open';

        const cleanTags = (() => {
            if (!yaml.tags) return [];
            const rawTags = String(yaml.tags).trim();
            const arr = rawTags.startsWith('[') ? rawTags.replace(/^\[|\]$/g, '').split(',') : rawTags.split(',');
            return arr.map(t => t.trim().replace(/['"]/g, '')).filter(t => t);
        })();

        const parsedDesc = content.startsWith('## Description') ? content.replace(/^## Description\n+/, '') : content;

        const state = KanbanStore.getState();
        state.setEditTaskField('title', yaml.title || defaultTitle);
        state.setEditTaskField('tagsRaw', cleanTags.join(', '));
        state.setEditTaskField('bucket', yaml.sub_bucket || 'None');
        state.setEditTaskField('desc', parsedDesc.trim());
        state.setEditTaskField('deliveryDate', yaml.delivery_date && yaml.delivery_date !== 'null' ? yaml.delivery_date : '');
        state.setEditTaskField('createdAt', yaml.created_at && yaml.created_at !== 'null' ? yaml.created_at : '');
        state.setEditTaskField('closedAt', yaml.closed_at && yaml.closed_at !== 'null' ? yaml.closed_at : '');
        state.setEditTaskField('type', yaml.type || inferredType);
        state.setEditTaskField('status', yaml.status || inferredStatus);
        state.setEditTaskField('repo', yaml.repo || repo);
        state.setEditTaskField('origYaml', JSON.stringify(yaml));
        this._originalTaskSnapshot = {
            title: yaml.title || defaultTitle,
            tagsRaw: cleanTags.join(', '),
            bucket: yaml.sub_bucket || 'None',
            desc: parsedDesc.trim(),
            deliveryDate: yaml.delivery_date && yaml.delivery_date !== 'null' ? yaml.delivery_date : '',
            createdAt: yaml.created_at && yaml.created_at !== 'null' ? yaml.created_at : '',
            closedAt: yaml.closed_at && yaml.closed_at !== 'null' ? yaml.closed_at : '',
            type: yaml.type || inferredType,
            status: yaml.status || inferredStatus,
            repo: yaml.repo || repo
        };
    }

    _onRequestFrontmatter(e) {
        const { respond, currentYaml } = e.detail;
        const form = KanbanStore.getState().editTaskForm;
        const tagsArr = form.tagsRaw.split(',').map(t => t.trim()).filter(t => t);
        const ticketId = form.filepath.split('/').pop().replace('.md', '');

        const updatedYaml = {
            ...currentYaml,
            repo: form.repo,
            type: form.type,
            status: form.status,
            id: ticketId,
            title: form.title.replace(/"/g, "'"),
            created_at: form.createdAt || null,
            closed_at: form.closedAt || null,
            sub_bucket: form.bucket,
            tags: JSON.stringify(tagsArr),
            delivery_date: form.deliveryDate || null
        };
        respond(updatedYaml);
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

        await this.sys.executeWorkspaceMutation('fs/delete', { filepath }, {
            onSuccess: () => {
                KanbanStore.getState().setModal('edit', false);
                this._originalTaskSnapshot = null;
                KanbanStore.getState().fetchTasks();
            }
        });
    }

    render() {
        const { newTaskForm } = (KanbanStore?.getState ? KanbanStore.getState() : { newTaskForm: {} }) || { newTaskForm: {} };
        const selectedRepoNew = newTaskForm?.repo || (this.ecosystem.allRepos && this.ecosystem.allRepos[0]) || '';
        const bucketsNew = selectedRepoNew ? this.sys.getFlattenedBuckets(selectedRepoNew) : [];

        const { editTaskForm } = (KanbanStore?.getState ? KanbanStore.getState() : { editTaskForm: {} }) || { editTaskForm: {} };
        const activeRepoEdit = editTaskForm?.repo || '';
        const bucketsEdit = activeRepoEdit ? this.sys.getFlattenedBuckets(activeRepoEdit) : [];

        return html`
            <!-- New Task Modal -->
            <sutram-modal 
                ?open=${this._modals?.new} 
                ?fullscreen=${true}
                titleText="Create New Ticket"
                @sutram-modal-closed=${() => KanbanStore.getState().setModal('new', false)}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <div class="meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 15px;">
                        ${bindStoreInput(KanbanStore, 'newTaskForm.repo', newTaskForm.repo, { label: 'Repository', type: 'select', flush: true, selectOptions: this.ecosystem.allRepos.map(r => ({value: r, label: r})), onUpdate: () => KanbanStore.setState(s => ({ newTaskForm: { ...s.newTaskForm, bucket: 'None' } })) })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.type', newTaskForm.type, { label: 'Ticket Type', type: 'select', flush: true, selectOptions: [{value: 'todo', label: 'To-Do (Task)'}, {value: 'bug', label: 'Bug'}, {value: 'queue', label: 'Queue (Research)'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.status', newTaskForm.status, { label: 'Status Zone', type: 'select', flush: true, selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.bucket', newTaskForm.bucket, { label: 'Sub-Bucket Mapping', type: 'select', flush: true, selectOptions: [{value: 'None', label: 'No Bucket'}, ...bucketsNew.map(b => ({value: b.id, label: b.title}))] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.deliveryDate', newTaskForm.deliveryDate, { label: 'Delivery Deadline', type: 'date', flush: true })}
                    </div>
                    <div class="meta-grid" style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px; flex: 1; min-height: 0;">
                        ${bindStoreInput(KanbanStore, 'newTaskForm.title', newTaskForm.title, { label: 'Ticket Title', placeholder: 'e.g., Fix schema registry timeout', style: 'font-weight: bold;', flush: true })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.tags', newTaskForm.tags, { label: 'Tags (comma-separated tokens)', placeholder: 'Architecture, Offline, Service-Worker, Epic', flush: true })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.desc', newTaskForm.desc, { label: 'Description', type: 'textarea', placeholder: 'Markdown description...', style: 'flex: 1; min-height: 150px;', flush: true })}
                    </div>
                </div>
                <sutram-async-btn slot="footer" label="💾 Save" intent="primary" .onClick=${async (e) => {
                    await this._saveNewTask();
                }}></sutram-async-btn>
            </sutram-modal>
            <!-- Edit Task Modal -->
            <sutram-modal 
                ?open=${this._modals?.edit} 
                titleText="✏️ ${editTaskForm.filepath || ''}"
                ?fullscreen=${true}
                ?flush=${true}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @sutram-modal-closing=${this._handleModalClosing}
                @sutram-modal-closed=${() => { KanbanStore.getState().setModal('edit', false); this._originalTaskSnapshot = null; }}>

                <div slot="body" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                    ${this._modals?.edit && editTaskForm.filepath ? html`
                        <insetu-frontmatter-editor
                            .filepath=${editTaskForm.filepath}
                            .defaultExpanded=${false}
                            @insetu:frontmatter-loaded=${this._onFrontmatterLoaded}
                            @insetu:request-frontmatter=${this._onRequestFrontmatter}
                            @insetu:editor-delete=${this._deleteTask}
                            @insetu:editor-raw-edit=${() => {
                                KanbanStore.getState().setModal('edit', false);
                                if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(editTaskForm.filepath, true, true);
                            }}>

                            <div slot="title-control" style="padding: 0;">
                                <sutram-textarea
                                    .value=${editTaskForm.title}
                                    placeholder="Ticket Summary Blueprint..."
                                    ?autoSize=${true}
                                    .minRows=${1}
                                    .maxHeight=${150}
                                    ?borderless=${true}
                                    style="font-weight: bold; font-size: 1.25rem; width: 100%; color: var(--text); margin: 0;"
                                    @sutram-input-changed=${(e) => {
                                        const val = e.detail.value.replace(/[\r\n]+/g, ' ');
                                        KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, title: val } }));
                                    }}>
                                </sutram-textarea>
                            </div>
                            <div slot="metadata-controls" class="meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 15px; margin: 0;">
                                ${bindStoreInput(KanbanStore, 'editTaskForm.repo', editTaskForm.repo, { label: 'Repository', type: 'select', flush: true, selectOptions: this.ecosystem.allRepos.map(r => ({value: r, label: r})), onUpdate: () => KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, bucket: 'None' } })) })}
                                ${bindStoreInput(KanbanStore, 'editTaskForm.type', editTaskForm.type, { label: 'Ticket Type', type: 'select', flush: true, selectOptions: [{value: 'todo', label: 'To-Do (Task)'}, {value: 'bug', label: 'Bug'}, {value: 'queue', label: 'Queue (Research)'}] })}
                                ${bindStoreInput(KanbanStore, 'editTaskForm.status', editTaskForm.status, { label: 'Status Zone', type: 'select', flush: true, selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}, {value: 'closed', label: 'Closed (Resolved)'}] })}
                                ${bindStoreInput(KanbanStore, 'editTaskForm.bucket', editTaskForm.bucket, { label: 'Sub-Bucket Mapping', type: 'select', flush: true, selectOptions: [{value: 'None', label: 'No Bucket'}, ...bucketsEdit.map(b => ({value: b.id, label: b.title}))] })}
                                ${bindStoreInput(KanbanStore, 'editTaskForm.deliveryDate', editTaskForm.deliveryDate, { label: 'Delivery Deadline', type: 'date', flush: true })}
                                ${bindStoreInput(KanbanStore, 'editTaskForm.createdAt', editTaskForm.createdAt, { label: 'Created At', type: 'datetime-local', flush: true })}
                                ${bindStoreInput(KanbanStore, 'editTaskForm.closedAt', editTaskForm.closedAt, { label: 'Closed At', type: 'datetime-local', flush: true })}
                                <div style="grid-column: 1 / -1; margin-top: 2px;">
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.tagsRaw', editTaskForm.tagsRaw, { label: 'Tags (comma-separated tokens)', placeholder: 'Architecture, Offline, Service-Worker, Epic', flush: true })}
                                </div>
                            </div>
                        </insetu-frontmatter-editor>
                    ` : ''}
                </div>
            </sutram-modal>
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
                AppStore.getState().setActiveRoute('tasks', 'todos');
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
        'zone:force-refresh': (data) => {
            if (data.parentId === 'tasks') {
                KanbanStore.setState({ tasks: [] });
                KanbanStore.getState().fetchTasks();
            }
            return false;
        },
        'zone:vfs-mutated': (payload) => {
            if (!payload || !payload.mutations) return false;
            const currentEdit = KanbanStore.getState().editTaskForm?.filepath;
            if (currentEdit && KanbanStore.getState().modals.edit) {
                const deleted = payload.mutations.find(m => m.filepath === currentEdit && m.operation === 'delete');
                if (deleted) KanbanStore.getState().setModal('edit', false);
            }
            return false;
        }
    }
});

// --- HEADLESS EXTENSION STATE SYNCHRONIZATION ---
// Data fetching is managed defensively via lifecycle hooks (zone:tab-changed, zone:soft-refresh, connectedCallback)
// to prevent boot-time evaluation race conditions.