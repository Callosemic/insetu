import { createExtensionStore, InSetuElement, bindStoreInput } from '../core/sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const KanbanStore = createExtensionStore('Kanban', {
    tasks: [],
    pinnedTags: new Set(["ALL"]),
    pinnedBuckets: new Set(["ALL"]),
    tagsExpanded: false,
    modals: { new: false, edit: false },
    settingsModalOpen: false,
    settings: {},
    systemSchemas: [],
    customViews: [],
    parentTabs: [],
    activeFocusId: null,
    setFocus: (id) => KanbanStore.setState({ activeFocusId: id }),
    newTaskForm: { repo: '', tier: 3, type: 'task', status: 'open', bucket: 'None', title: '', tags: '', desc: '', deliveryDate: '', parentId: '', dependsOn: [], priority: '', size: '' },
    editTaskForm: { filepath: '', title: '', tagsRaw: '', bucket: 'None', desc: '', origYaml: '', deliveryDate: '', createdAt: '', closedAt: '', parentId: '', dependsOn: [], priority: '', size: '', tier: 3 },
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
            if (data.hydrating && window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus("⏳ Hydrating tracker cache...", 3000);
            }
        }
    },
    fetchSettings: async () => {
        if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('tracker')) return;
        try {
            const [res, sysRes] = await Promise.allSettled([
                window.inSetu.api.workspace('tracker/settings?t=' + Date.now()),
                window.inSetu.api.workspace('tracker/system_schemas?t=' + Date.now())
            ]);

            let newSettings = KanbanStore.getState().settings || {};
            let newSchemas = KanbanStore.getState().systemSchemas || [];

            if (res.status === 'fulfilled' && res.value.ok) {
                newSettings = await res.value.json();
            }
            if (sysRes.status === 'fulfilled' && sysRes.value.ok) {
                const sysData = await sysRes.value.json();
                newSchemas = sysData.system_schemas || [];
            }

            KanbanStore.setState({ settings: newSettings, systemSchemas: newSchemas });

            if (res.status === 'fulfilled' && res.value.ok) {
                const customViews = newSettings.global_views || [];
                const parentTabs = newSettings.parent_tabs || [{ id: 'tasks', label: 'Tasks' }];

                const existingViewsStr = JSON.stringify(KanbanStore.getState().customViews || []);
                const newViewsStr = JSON.stringify(customViews);
                const existingParentsStr = JSON.stringify(KanbanStore.getState().parentTabs || []);
                const newParentsStr = JSON.stringify(parentTabs);

                KanbanStore.setState({ customViews, parentTabs });
                // Only recompile the DOM layout if the user actually modified their tabs in the settings
                if (existingViewsStr !== newViewsStr || existingParentsStr !== newParentsStr) {
                    // Dynamically update the ExtensionRegistry layoutSlots
                    const registry = window.ExtensionRegistry;
                    if (registry) {
                        const manifest = registry.getExtension('tracker');
                        if (manifest) {
                            // Clear old slots owned by tracker, retaining only globals
                            manifest.layoutSlots = manifest.layoutSlots.filter(s => s.slot === 'slots:global');

                            parentTabs.forEach((pt, idx) => {
                                manifest.layoutSlots.push({
                                    slot: "slots:primary-navigation",
                                    id: pt.id,
                                    label: pt.label,
                                    order: 3 + idx
                                });
                            });

                            // Inject new slots with dynamic parent tab support
                            customViews.forEach((view, idx) => {
                                const parentTab = view.target_parent || view.parent_tab || "tasks";
                                manifest.layoutSlots.push({
                                    slot: "slots:sub-navigation",
                                    targetParent: parentTab,
                                    id: view.id,
                                    label: view.label,
                                    order: idx + 1,
                                    component: "insetu-ext-tracker"
                                });
                                manifest.layoutSlots.push({
                                    slot: "slots:sub-navigation-actions",
                                    targetParent: parentTab,
                                    targetSub: view.id,
                                    order: idx + 1,
                                    component: "insetu-ext-tracker-actions"
                                });
                            });
                            registry.compileLayout();
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch tracker settings:", e);
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
                    ...t, status: newStatus, filepath: data.new_filepath, ticket_type: newType || t.ticket_type
                } : t)
            }));
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to transition task.");
        }
    }
}, ['pinnedTags', 'pinnedBuckets']);
window.inSetu.stores.Kanban = KanbanStore;
import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../core/shared_styles.js';
export class InSetuExtTracker extends InSetuElement {
    static get extensionName() { return 'tracker'; }
    get extName() { return 'tracker'; }
    static properties = {
        tasks: { type: Array },
        customViews: { type: Array },
        settings: { type: Object },
        systemSchemas: { type: Array },
        pinnedTags: { type: Object },
        pinnedBuckets: { type: Object },
        activeTab: { type: String },
        searchQuery: { type: String },
        _reposExpanded: { type: Boolean },
        _bucketsExpanded: { type: Boolean },
        _tagsExpanded: { type: Boolean },
        _logExpanded: { type: Object },
        _localPinnedRepos: { type: Object },
        _localPinnedTags: { type: Object },
        _localPinnedBuckets: { type: Object }
    };
static styles = [
    sharedStyles,
    css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
        .tracker-body { flex: 1; overflow-y: auto; padding: 20px; }
    `
];
constructor() {
        super();
        this.tasks = [];
        this.systemSchemas = [];
        this.pinnedTags = new Set(['ALL']);
        this.pinnedBuckets = new Set(['ALL']);
        this.activeTab = 'todos';
        this.searchQuery = '';
        this._reposExpanded = true;
        this._bucketsExpanded = true;
        this._tagsExpanded = true;
        this._logExpanded = { closed: true, logged: true, archived: false };
        this._localPinnedRepos = new Set(['ALL']);
        this._localPinnedTags = new Set(['ALL']);
        this._localPinnedBuckets = new Set(['ALL']);
}
    connectedCallback() {
        super.connectedCallback();
        const parsedTab = this.dataset.subId || this.parentElement?.id?.replace('sub-', '');
        this.activeTab = parsedTab || 'todos';
        if (typeof KanbanStore !== 'undefined' && KanbanStore) {
            this.subscribe(KanbanStore, (state) => {
                this.tasks = state?.tasks || [];
                this.customViews = state?.customViews || [];
                this.settings = state?.settings || {};
                this.systemSchemas = state?.systemSchemas || [];
                this.pinnedTags = state?.pinnedTags || new Set(['ALL']);
                this.pinnedBuckets = state?.pinnedBuckets || new Set(['ALL']);
                this.requestUpdate();
            });
            const kState = KanbanStore.getState ? KanbanStore.getState() : {};
            this.tasks = kState?.tasks || [];
            this.customViews = kState?.customViews || [];
            this.settings = kState?.settings || {};
            this.systemSchemas = kState?.systemSchemas || [];
            this.pinnedTags = kState?.pinnedTags || new Set(['ALL']);
            this.pinnedBuckets = kState?.pinnedBuckets || new Set(['ALL']);
        }
        this.registerGlobalListener('insetu:tracker:generate-changelog', window, (e) => {
            if (this.activeTab === 'log') {
                this._generateHistoricalChangelog(e.detail.allRepos);
            }
        });
        this.registerGlobalListener('insetu:tracker:load-board', window, () => {
            KanbanStore.getState().fetchTasks();
        });
        this.registerGlobalListener('zone:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const touchedTracker = payload.mutations.some(m => m.filepath && m.filepath.includes('.tracker/') && m.filepath.endsWith('.md'));
            if (touchedTracker) KanbanStore.getState().fetchTasks();
        });
        if (KanbanStore?.getState?.()?.fetchTasks) {
            KanbanStore.getState().fetchTasks();
            KanbanStore.getState().fetchSettings();
        }
        this.registerGlobalListener('sutram-route-changed', window, (e) => {
            if (e.detail.tab === 'tasks') {
                KanbanStore.getState().fetchTasks();
                KanbanStore.getState().fetchSettings();
            }
        });
    }
    onWorkspaceChanged(newWorkspaceId) {
        KanbanStore.getState().fetchTasks();
        KanbanStore.getState().fetchSettings();
    }
    onForceRefresh() {
        KanbanStore.setState({ tasks: [] });
        KanbanStore.getState().fetchTasks();
        KanbanStore.getState().fetchSettings();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('tasks')) {
            this._childMapCache = null;
        }
    }

    _getChildTasksMap() {
        if (!this._childMapCache) {
            this._childMapCache = this.tasks.reduce((acc, t) => {
                if (t.parentId) {
                    if (!acc[t.parentId]) acc[t.parentId] = [];
                    acc[t.parentId].push(t);
                }
                return acc;
            }, {});
        }
        return this._childMapCache;
    }

    _getResolvedTierLabel(repo, tierNumber) {
        const globalLabels = this.settings?.hierarchy_labels || {};
        const repoLabels = this.settings?.[repo]?.hierarchy_labels || {};
        const activeLabels = { ...globalLabels, ...repoLabels };
        return activeLabels[`tier_${tierNumber}`] || `Tier ${tierNumber}`;
    }
    _renderTaskCard(t, overrideClick = null) {
        const dateStr = this.utils.formatDate(t.timestamp);
        const bucketStr = (t.subBucket && t.subBucket !== 'None') ? ` | 🗂️ ${t.subBucket}` : '';
        const descText = `${t.repo}${bucketStr} | ${dateStr}`;

        // Child Completion Check for Tier 1 & 2 Parents
        const childTasks = this._getChildTasksMap()[t.id] || [];
        const allKidsDone = childTasks.length > 0 && childTasks.every(c => ['closed', 'archived', 'logged'].includes(c.status));

        // Dynamic intent inference based on vocabulary heuristics
        const typeStr = (t.ticket_type || '').toLowerCase();
        const isDanger = typeStr.includes('bug') || typeStr.includes('error') || typeStr.includes('hotfix');
        const isHighlight = typeStr.includes('queue') || typeStr.includes('review') || typeStr.includes('draft');

        const intentColor = isDanger ? 'var(--intent-danger)' : (isHighlight ? 'var(--intent-highlight)' : 'var(--intent-success)');
        const icon = t.tier === 1 ? '🎯' : (t.tier === 2 ? '📦' : (isDanger ? '🐛' : '✨'));
        const isOverdue = t.deliveryDate && new Date(t.deliveryDate) < new Date() && t.status !== 'closed';
        const displayTitle = t.title ? t.title.replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => def ? def.trim() : key.trim()) : '';

        return html`
            <insetu-card
                data-task-id=${t.id}
                .filename=${t.filepath}
                .titleText=${displayTitle}
                .descriptionText=${descText}
                .intentColor=${intentColor}
                .icon=${icon}
                entityType="file:task"
                .entityData=${{ ...t, isFS: true, repoDir: t.repo, suppressCopy: true, suppressDownload: true }}
                @card-clicked=${overrideClick ? overrideClick : () => this.vfs.viewSourceFile(t.filepath, true)}>
                <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                    ${t.priority ? html`<sutram-tag>${t.priority === 'P0' ? '🔴' : '⚡'} ${t.priority}</sutram-tag>` : ''}
                    ${t.size ? html`<sutram-tag>📏 ${t.size}</sutram-tag>` : ''}

                    ${allKidsDone && t.status !== 'closed' ? html`
                        <sutram-tag intent="success">🔔 All Sub-tasks Complete</sutram-tag>
                    ` : ''}

                    ${t.dependsOn && t.dependsOn.length > 0 ? t.dependsOn.map(dep => html`
                        <sutram-tag intent="warning">🔗 ${dep}</sutram-tag>
                    `) : ''}
                    ${t.deliveryDate ? html`
                        <sutram-tag intent="${isOverdue ? 'danger' : ''}">📅 Due: ${t.deliveryDate}</sutram-tag>
                    ` : ''}
                </div>
            </insetu-card>
        `;
    }
    _renderStackedView(targetTier, filteredTasks, filters) {
        const typeFilter = t => {
            if (!filters) return true;
            let matchType = true;
            if (filters.ticket_types) {
                const allowed = filters.ticket_types.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                matchType = allowed.length === 0 || allowed.includes((t.ticket_type || '').toLowerCase());
            }
            let matchStatus = true;
            if (filters.statuses) {
                const allowed = filters.statuses.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                matchStatus = allowed.length === 0 || allowed.includes((t.status || '').toLowerCase());
            }
            return matchType && matchStatus;
        };
        const parentCards = filteredTasks.filter(t => t.tier === targetTier && typeFilter(t));

        if (parentCards.length === 0) {
            return html`<sutram-empty-state text="No items found for this tier."></sutram-empty-state>`;
        }

        return html`
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${parentCards.map(parent => {
                    const childTasks = this.tasks.filter(t => t.status !== 'template' && (t.parentId === parent.id || (t.dependsOn && t.dependsOn.includes(`${parent.repo}::${parent.id}`))));
                    const closedCount = childTasks.filter(t => ['closed', 'archived', 'logged'].includes(t.status)).length;
                    const tierLabel = this._getResolvedTierLabel(parent.repo, targetTier);
                    return html`
                        <sutram-card-group ?stacked=${true} ?accordion=${true}>
                            <insetu-card
                                .titleText=${parent.title}
                                .descriptionText=${`${closedCount}/${childTasks.length} Completed | Status: ${parent.status}`}
                                .detailPrefix=${`[${parent.repo}] ${tierLabel}: `}
                                .detailText=${parent.filepath}
                                icon=${targetTier === 1 ? '🎯' : '📦'}
                                intentColor="var(--intent-primary)"
                                entityType="file:task"
                                .entityData=${{ ...parent, isFS: true, suppressCopy: true, suppressDownload: true }}
                                @card-clicked=${() => this.vfs.viewSourceFile(parent.filepath, true)}>
                            </insetu-card>
                            ${childTasks.map(child => this._renderTaskCard(child))}
                        </sutram-card-group>
                    `;
                })}
            </div>
        `;
    }
    _renderColumns(filters, filteredTasks) {
        // Deadline Precedence with FIFO Fallback Sorting Engine
        const sortChronological = (a, b) => {
            if (a.deliveryDate && b.deliveryDate) {
                return a.deliveryDate.localeCompare(b.deliveryDate);
            }
            if (a.deliveryDate) return -1; // Deadlines float to the top
            if (b.deliveryDate) return 1;
            return a.timestamp.localeCompare(b.timestamp); // Fallback to Oldest-First FIFO
        };
        const openTasks = filteredTasks.filter(t => t.status === 'open').sort(sortChronological);
        const activeTasks = filteredTasks.filter(t => t.status === 'active').sort(sortChronological);
        const closedTasks = filteredTasks.filter(t => t.status === 'closed').sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));

        return html`
            <sutram-board>
                <sutram-column titleText="Active">
                    ${activeTasks.map(t => this._renderTaskCard(t))}
                </sutram-column>
                <sutram-column titleText="Open">
                    ${openTasks.map(t => this._renderTaskCard(t))}
                </sutram-column>
                <sutram-column titleText="Closed" intentColor="var(--intent-success)">
                    ${closedTasks.map(t => this._renderTaskCard(t))}
                </sutram-column>
            </sutram-board>
        `;
    }
    _renderLog(filteredTasks) {
        const sortDesc = (a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp);
        const closed = filteredTasks.filter(t => t.status === 'closed').sort(sortDesc);
        const logged = filteredTasks.filter(t => t.status === 'logged').sort(sortDesc);
        const archived = filteredTasks.filter(t => t.status === 'archived').sort(sortDesc);

        const toggleLog = (key, open) => {
            this._logExpanded = { ...this._logExpanded, [key]: open };
            this.requestUpdate();
        };
        return html`
            <div style="display: flex; flex-direction: column; gap: 0;">
                <sutram-collapsible 
                    titleText="Closed" 
                    intent="success" 
                    .open=${this._logExpanded?.closed !== false}
                    @sutram-collapsible-toggled=${(e) => toggleLog('closed', e.detail.open)}>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px; font-style: italic;">(Recently resolved tickets in their grace period)</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${closed.length > 0 ? closed.map(t => this._renderTaskCard(t)) : html`<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No closed tickets in grace period.</span>`}
                    </div>
                </sutram-collapsible>

                <sutram-collapsible 
                    titleText="Logged" 
                    intent="warning" 
                    .open=${this._logExpanded?.logged !== false}
                    @sutram-collapsible-toggled=${(e) => toggleLog('logged', e.detail.open)}>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px; font-style: italic;">(Swept to the log directory, awaiting archive)</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${logged.length > 0 ? logged.map(t => this._renderTaskCard(t)) : html`<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No logged tickets.</span>`}
                    </div>
                </sutram-collapsible>

                <sutram-collapsible 
                    titleText="Archived" 
                    intent="neutral" 
                    .open=${this._logExpanded?.archived === true}
                    @sutram-collapsible-toggled=${(e) => toggleLog('archived', e.detail.open)}>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">(Historical context permanently preserved on disk)</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${archived.length > 0 ? archived.map(t => this._renderTaskCard(t)) : html`<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No archived tickets fetched. Ensure "Include Archived in UI Log" is enabled in settings.</span>`}
                    </div>
                </sutram-collapsible>
            </div>
        `;
    }
    render() {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const currentView = (this.customViews || []).find(v => v.id === this.activeTab);
        const repoStrategy = currentView?.repo_strategy || 'global';
        const activeFocusId = KanbanStore.getState().activeFocusId;
        let focusedTaskIds = new Set();
        let focusedTaskTitle = '';
        if (activeFocusId) {
            focusedTaskIds.add(activeFocusId);
            const focusTarget = this.tasks.find(t => t.id === activeFocusId);
            if (focusTarget) {
                focusedTaskTitle = focusTarget.title || focusTarget.id;
                const getDesc = (pid) => {
                    this.tasks.forEach(t => {
                        if (t.parentId === pid) {
                            focusedTaskIds.add(t.id);
                            getDesc(t.id);
                        }
                    });
                };
                getDesc(activeFocusId);
            } else {
                KanbanStore.getState().setFocus(null);
            }
        }

        // 1. Scope to View Rules first
        let viewScopedTasks = this.tasks.filter(t => t.status !== 'template');
        if (currentView) {
            viewScopedTasks = viewScopedTasks.filter(t => {
                if (currentView.target_schema) {
                    const repoSchema = (this.settings.kanban_repo_map || {})[t.repo] || 'agile_basic';
                    if (repoSchema !== currentView.target_schema) return false;
                }

                if (currentView.target_tier && t.tier !== currentView.target_tier) return false;

                if (currentView.layout !== 'log' && currentView.filters) {
                    if (currentView.filters.ticket_types) {
                        const allowed = currentView.filters.ticket_types.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        if (allowed.length > 0 && !allowed.includes((t.ticket_type || '').toLowerCase())) return false;
                    }
                    if (currentView.filters.statuses) {
                        const allowed = currentView.filters.statuses.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        if (allowed.length > 0 && !allowed.includes((t.status || '').toLowerCase())) return false;
                    }
                }
                return true;
            });
        }

        // 2. Determine base allowed repos for custom strategies
        let baseAllowedRepos = this.ecosystem.allRepos;
        if (repoStrategy === 'schema') {
            const targetSchema = currentView.target_schema;
            if (targetSchema) {
                baseAllowedRepos = this.ecosystem.allRepos.filter(r => (this.settings.kanban_repo_map || {})[r] === targetSchema);
            }
        } else if (repoStrategy === 'explicit') {
            baseAllowedRepos = currentView.explicit_repos || [];
        }

        // 3. Apply active filters
        const activeRepoPins = repoStrategy === 'global' ? this.ecosystem.pinnedRepos : this._localPinnedRepos;
        const activeTagPins = repoStrategy === 'global' ? this.pinnedTags : this._localPinnedTags;
        const activeBucketPins = repoStrategy === 'global' ? this.pinnedBuckets : this._localPinnedBuckets;
        let hiddenTasksCount = 0;
        let hiddenTasksByStatus = {};
        let missingRepos = new Set();

        const fullyFilteredTasks = viewScopedTasks.filter(t => {
            if (repoStrategy !== 'global' && !baseAllowedRepos.includes(t.repo)) return false;

            const matchesTag = activeTagPins.has('ALL') || (t.tags && t.tags.some(tag => activeTagPins.has(tag)));

            let matchesBucket = true;
            if (!activeBucketPins.has('ALL')) {
                const repoBucketsPinned = Array.from(activeBucketPins).some(pb => pb.startsWith(t.repo + '::'));
                if (repoBucketsPinned) {
                    matchesBucket = activeBucketPins.has(t.repo + '::' + t.subBucket);
                }
            }

            // Drop tasks that fail non-repo filters before counting them as "hidden"
            if (!matchesTag || !matchesBucket) return false;

            const matchesRepo = activeRepoPins.has('ALL') || activeRepoPins.has(t.repo);
            if (!matchesRepo && repoStrategy === 'global') {
                if (t.status !== 'template') {
                    hiddenTasksCount++;
                    hiddenTasksByStatus[t.status] = (hiddenTasksByStatus[t.status] || 0) + 1;
                    missingRepos.add(t.repo);
                }
                return false;
            }

            if (activeFocusId && !focusedTaskIds.has(t.id)) return false;

            return matchesRepo;
        });

        // Compute all available tags for the active filter set
        const allTags = new Set();
        viewScopedTasks.forEach(t => {
            if (repoStrategy !== 'global' && !baseAllowedRepos.includes(t.repo)) return;
            const matchesRepo = activeRepoPins.has('ALL') || activeRepoPins.has(t.repo);
            if (matchesRepo && t.tags) {
                t.tags.forEach(tag => allTags.add(tag));
            }
        });
        const tagsArray = Array.from(allTags).sort();

        const hasFilters = !activeRepoPins.has('ALL') || !activeTagPins.has('ALL') || !activeBucketPins.has('ALL');

        const textFilteredTasks = this.searchQuery 
            ? window.inSetu.utils.fuzzyFilterObjects(fullyFilteredTasks, this.searchQuery, t => `${t.title} ${t.id} ${t.description} ${(t.tags || []).join(' ')}`) 
            : fullyFilteredTasks;

        const setPinnedRepos = (reposSet) => repoStrategy === 'global' ? AppStore.getState().setPinnedRepos(reposSet) : (this._localPinnedRepos = reposSet, this.requestUpdate());
        const setPinnedBuckets = (bucketsSet) => repoStrategy === 'global' ? KanbanStore.setState({ pinnedBuckets: bucketsSet }) : (this._localPinnedBuckets = bucketsSet, this.requestUpdate());
        const setPinnedTags = (tagsSet) => repoStrategy === 'global' ? KanbanStore.setState({ pinnedTags: tagsSet }) : (this._localPinnedTags = tagsSet, this.requestUpdate());

        return html`
            <sutram-toolbar
                searchPlaceholder="🔍 Fuzzy search tickets..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => this.searchQuery = e.detail.value}
                .enableFilterDropdown=${true}
                .filterText=${"Filters"}
                .hasFiltersOverride=${hasFilters}>
                <div slot="filters" style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
                    ${repoStrategy !== 'global' ? html`
                        <div style="background: var(--intent-highlight); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-align: center; margin-bottom: -5px;">
                            Tab-Specific Filtering Enabled
                        </div>
                    ` : ''}
                    <div style="display: flex; align-items: flex-start; gap: 5px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: var(--text); cursor: pointer; user-select: none; margin-top: 4px; white-space: nowrap;" @click=${() => this._reposExpanded = !this._reposExpanded}>
                            📌 Repos ${this._reposExpanded ? '▼' : '▶'}
                        </span>
                        <insetu-repo-filter
                            label=""
                            .repos=${this._reposExpanded ? baseAllowedRepos : Array.from(activeRepoPins).filter(r => r !== 'ALL')}
                            .activeRepos=${Array.from(activeRepoPins)}
                            @repo-filter-changed=${(e) => {
                                setPinnedRepos(new Set(e.detail.activeRepos));
                                setPinnedBuckets(new Set(['ALL']));
                            }}>
                        </insetu-repo-filter>
                    </div>
                        ${!activeRepoPins.has('ALL') ? html`
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border);">
                                ${Array.from(activeRepoPins).map(repo => {
                                    const buckets = this.sys.getFlattenedBuckets(repo);
                                    if (buckets.length === 0) return '';

                                    const repoBucketsActive = buckets.some(b => activeBucketPins.has(repo + '::' + b.id));
                                    const repoAllActive = activeBucketPins.has('ALL') || !repoBucketsActive;

                                    const visibleBuckets = this._bucketsExpanded 
                                        ? buckets 
                                        : buckets.filter(b => activeBucketPins.has(repo + '::' + b.id));

                                    if (!this._bucketsExpanded && !repoBucketsActive) return '';

                                    return html`
                                        <div style="display: flex; align-items: flex-start; gap: 5px;">
                                            <span style="font-size: 0.85rem; font-weight: bold; color: var(--text); cursor: pointer; user-select: none; margin-top: 4px; white-space: nowrap;" @click=${() => this._bucketsExpanded = !this._bucketsExpanded}>
                                                🗂️ ${repo} ${this._bucketsExpanded ? '▼' : '▶'}
                                            </span>
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" @sutram-pill-toggled=${(e) => {
                                                e.stopPropagation();
                                                const { id, active } = e.detail;
                                                let newSet = new Set(activeBucketPins);

                                                if (id === repo + '::ALL') {
                                                    buckets.forEach(b => newSet.delete(repo + '::' + b.id));
                                                    if (newSet.size === 0) newSet.add('ALL');
                                                } else {
                                                    newSet.delete('ALL');
                                                    if (active) newSet.add(id);
                                                    else newSet.delete(id);
                                                    if (newSet.size === 0) newSet.add('ALL');
                                                }
                                                setPinnedBuckets(newSet);
                                            }}>
                                                <sutram-pill pillId=${repo + '::ALL'} labelText="All" variant="text" ?active=${repoAllActive}></sutram-pill>
                                                ${visibleBuckets.map(b => html`
                                                    <sutram-pill pillId=${repo + '::' + b.id} labelText=${b.title} variant="text" ?active=${activeBucketPins.has(repo + '::' + b.id)}></sutram-pill>
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
                                    .items=${(this._tagsExpanded ? tagsArray : Array.from(activeTagPins).filter(t => t !== 'ALL')).map(t => ({id: t, label: '#' + t}))}
                                    .activeItems=${Array.from(activeTagPins)}
                                    @sutram-filter-changed=${(e) => {
                                        setPinnedTags(new Set(e.detail.activeItems));
                                    }}>
                                </sutram-filter-group>
                            </div>
                        ` : ''}
                </div>
            </sutram-toolbar>
            <div class="tracker-body" style="${currentView?.layout === 'log' ? 'padding: 0;' : ''}">
                ${activeFocusId ? html`
                    <div style="background: var(--intent-highlight); color: #fff; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.2rem;">🎯</span>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: bold; font-size: 0.95rem;">Active Focus</span>
                                <span style="font-size: 0.85rem; opacity: 0.9;">${focusedTaskTitle}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-sm" style="background: rgba(0,0,0,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); margin: 0;" @click=${() => {
                                const task = this.tasks.find(t => t.id === activeFocusId);
                                if (task) window.dispatchEvent(new CustomEvent('insetu:tracker:open-hierarchy', { detail: { task } }));
                            }}>🌳 View Hierarchy</button>
                            <button class="btn-sm" style="background: rgba(0,0,0,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); margin: 0;" @click=${() => KanbanStore.getState().setFocus(null)}>✕ Clear Focus</button>
                        </div>
                    </div>
                ` : ''}
                ${hiddenTasksCount > 0 && repoStrategy === 'global' ? html`
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-bottom: 15px; text-align: center;">
                        Note: ${Object.entries(hiddenTasksByStatus).sort(([a], [b]) => {
                            const order = ['active', 'open', 'closed', 'logged', 'archived'];
                            return (order.indexOf(a) > -1 ? order.indexOf(a) : 99) - (order.indexOf(b) > -1 ? order.indexOf(b) : 99);
                        }).map(([status, count]) => `${count} ${status}`).join(', ')} task${hiddenTasksCount === 1 ? '' : 's'} currently hidden by the Smart Repo Filter.
                    </div>
                ` : ''}
                ${(() => {
                    if (!currentView) return '';
                    if (currentView.layout === 'log') {
                        return this._renderLog(textFilteredTasks);
                    } else if (currentView.layout === 'stacked') {
                        return this._renderStackedView(currentView.target_tier, textFilteredTasks, currentView.filters);
                    } else {
                        return this._renderColumns(currentView.filters, textFilteredTasks);
                    }
                })()}
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

                                const typeStr = (t.ticket_type || '').toLowerCase();
                                const isDanger = typeStr.includes('bug') || typeStr.includes('error') || typeStr.includes('hotfix');
                                const isHighlight = typeStr.includes('queue') || typeStr.includes('review') || typeStr.includes('draft');
                                const typeIcon = t.tier === 1 ? '🎯' : (t.tier === 2 ? '📦' : (isDanger ? '🐛' : (isHighlight ? '🔬' : '✨')));

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

        if (this.ui && this.ui.viewTextBlob) {
            this.ui.viewTextBlob("Historical Changelog", changelog, `Historical_Changelog_${Date.now()}.md`);
        } else {
            alert("Text viewer not available.");
        }
    }
}
customElements.define('insetu-ext-tracker', InSetuExtTracker);
export class InSetuExtTrackerActions extends InSetuElement {
    get extName() { return 'tracker'; }
    static styles = [sharedStyles];
    get _menuItems() {
        const appState = window.inSetu.stores.App.getState();
        const activeSubTab = this.dataset.subId || this.parentElement?.id?.replace('sub-', '') || appState.activeSubTabs[appState.activeTab] || '';
        const items = [];
        if (activeSubTab !== 'log') {
            items.push({ label: 'New Task', icon: '🎫', onClick: () => { 
                this.dispatch('insetu:tracker:open-new-task', { activeTab: activeSubTab });
            } });
            items.push({ label: 'Templates...', icon: '🧬', onClick: () => { 
                this.dispatch('insetu:tracker:open-templates-browser');
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
        _isDownloading: { type: Boolean },
        _pickerOpen: { type: Boolean },
        _pickerMode: { type: String },
        _pickerForm: { type: String },
        _pickerSearchQuery: { type: String },
        _pickerRepoFilter: { type: String },
        _convertOpen: { type: Boolean },
        _convertTask: { type: Object },
        _spawnModalOpen: { type: Boolean },
        _spawnTask: { type: Object },
        _spawnVariables: { type: Array },
        _spawnForm: { type: Object },
        _spawnTargetRepo: { type: String },
        _spawnCompatibleRepos: { type: Array },
        _spawnDisplayName: { type: String },
        _templatesBrowserOpen: { type: Boolean },
        _activeTemplateRoot: { type: String },
        _templateRepoFilter: { type: String },
        _returnToTemplatesBrowser: { type: Boolean },
        _hierarchyModalOpen: { type: Boolean },
        _hierarchyTask: { type: Object }
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
        this._isDirtyTracker = false;
        this._pickerOpen = false;
        this._pickerMode = 'parentId';
        this._pickerForm = 'new';
        this._pickerSearchQuery = '';
        this._pickerRepoFilter = 'ALL';
        this._convertOpen = false;
        this._convertTask = null;
        this._spawnModalOpen = false;
        this._spawnTask = null;
        this._spawnVariables = [];
        this._spawnForm = {};
        this._spawnTargetRepo = '';
        this._spawnCompatibleRepos = [];
        this._spawnDisplayName = '';
        this._templatesBrowserOpen = false;
        this._activeTemplateRoot = null;
        this._templateRepoFilter = null;
        this._returnToTemplatesBrowser = false;
        this._hierarchyModalOpen = false;
        this._hierarchyTask = null;
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
            this._openNewTaskModal(e.detail.activeTab, e.detail.prefill);
        });
        this.registerGlobalListener('insetu:tracker:open-edit-task', window, (e) => {
            this._openEditTaskModal(e.detail.filepath);
        });
        this.registerGlobalListener('zone:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const currentEdit = KanbanStore.getState().editTaskForm?.filepath;
            if (currentEdit && KanbanStore.getState().modals.edit) {
                const deleted = payload.mutations.find(m => m.filepath === currentEdit && m.operation === 'delete');
                if (deleted) KanbanStore.getState().setModal('edit', false);
            }
        });
        this.registerGlobalListener('insetu:tracker:save-new-task', window, () => this._saveNewTask());
        this.registerGlobalListener('insetu:tracker:save-edit-task', window, () => {
            const fm = this.shadowRoot.getElementById('fm-editor-tracker');
            if (fm && typeof fm._handleSave === 'function') fm._handleSave();
        });
        this.registerGlobalListener('insetu:tracker:open-convert', window, (e) => {
            this._convertTask = e.detail.task;
            this._convertOpen = true;
            this.requestUpdate();
        });
        this.registerGlobalListener('insetu:tracker:open-spawn', window, (e) => {
            this._openSpawnModal(e.detail.task);
        });
        this.registerGlobalListener('insetu:tracker:open-templates-browser', window, () => {
            this._templatesBrowserOpen = true;
            this._activeTemplateRoot = null;
            this.requestUpdate();
        });
        this.registerGlobalListener('insetu:tracker:open-hierarchy', window, (e) => {
            this._hierarchyTask = e.detail.task;
            this._hierarchyModalOpen = true;
            this.requestUpdate();
        });
    }

    _openSpawnModal(task) {
        const allTasks = KanbanStore.getState().tasks;
        const descendants = [];
        const findChildren = (parentId) => {
            const children = allTasks.filter(t => t.parentId === parentId);
            descendants.push(...children);
            children.forEach(c => findChildren(c.id));
        };
        findChildren(task.id);

        const tree = [task, ...descendants];

        // Scan the entire tree for variables and defaults using {{key|default}}
        const varMap = new Map();
        const regex = /\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g;

        const processMatch = (match) => {
            const key = match[1].trim();
            const def = match[2] ? match[2].trim() : '';
            // If we haven't seen this key, or if we have but the current one provides a default, store it
            if (!varMap.has(key) || (!varMap.get(key) && def)) {
                varMap.set(key, def);
            }
        };

        tree.forEach(t => {
            let match;
            while ((match = regex.exec(t.title)) !== null) processMatch(match);
            while ((match = regex.exec(t.description)) !== null) processMatch(match);
        });

        // Calculate a clean display name for the modal title
        const evaluateDisplayName = (text) => {
            if (!text) return '';
            return text.replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => def ? def.trim() : key.trim());
        };
        const displayName = evaluateDisplayName(task.title) || task.id;

        // Filter compatible repositories to avoid cross-schema contamination
        const state = KanbanStore.getState();
        const repoMap = state.settings?.kanban_repo_map || {};
        const sourceSchema = repoMap[task.repo] || 'agile_basic';
        const compatibleRepos = this.ecosystem.allRepos.filter(r => (repoMap[r] || 'agile_basic') === sourceSchema);

        this._spawnTask = task;
        this._spawnVariables = Array.from(varMap.keys());
        this._spawnForm = {};
        // Pre-populate the form with discovered default values
        this._spawnVariables.forEach(v => this._spawnForm[v] = varMap.get(v));
        this._spawnTargetRepo = compatibleRepos.length > 0 ? compatibleRepos[0] : task.repo;
        this._spawnCompatibleRepos = compatibleRepos;
        this._spawnDisplayName = displayName;
        this._spawnModalOpen = true;
        this.requestUpdate();
    }
    _getBucketsForRepo(repoDir) {
        const getFn = window.inSetu?.utils?.getFlattenedBuckets || this.sys?.getFlattenedBuckets;
        if (!getFn) return [];
        const repoConfig = this.ecosystem.targetConfigs.find(r => r && r.repo_dir === repoDir);
        if (!repoConfig) return [];
        return getFn([repoConfig]);
    }
    _openNewTaskModal(activeTab, prefill = null) {
        const state = KanbanStore.getState();
        const prePopulatedTags = Array.from(this.pinnedTags || []).filter(t => t !== 'ALL');
        const defaultTagsStr = prePopulatedTags.join(', ');

        let targetRepo = this.ecosystem.allRepos.length > 0 ? this.ecosystem.allRepos[0] : '';
        if (this.ecosystem.pinnedRepos.size === 1 && !this.ecosystem.pinnedRepos.has('ALL')) {
            const pinnedRepo = Array.from(this.ecosystem.pinnedRepos)[0];
            if (this.ecosystem.allRepos.includes(pinnedRepo)) {
                targetRepo = pinnedRepo;
            }
        }
        const settings = state.settings || {};
        const schemaId = (settings.kanban_repo_map || {})[targetRepo] || 'agile_basic';
        const allSchemas = [...(state.systemSchemas || []), ...(settings.kanban_profiles || [])];
        const schema = allSchemas.find(p => p.id === schemaId) || {};
        const getTierTypes = (t) => (schema[`t${t}_types`] || '').split(',').map(s => s.trim()).filter(Boolean);
        const t1Types = getTierTypes(1);
        const t2Types = getTierTypes(2);
        const t3Types = getTierTypes(3);
        let defaultTier = 3;
        let defaultType = t3Types.length > 0 ? t3Types[0] : 'task';

        const customViews = state.customViews || [];
        const activeView = customViews.find(v => v.id === activeTab);

        if (activeView) {
            // 1. Inherit from strict tier targeting
            if (activeView.target_tier) {
                defaultTier = activeView.target_tier;
                const tierTypes = getTierTypes(defaultTier);
                if (tierTypes.length > 0) defaultType = tierTypes[0];
            }

            // 2. Inherit from strict type filtering (overrides tier defaults)
            if (activeView.filters && activeView.filters.ticket_types) {
                const allowedTypes = activeView.filters.ticket_types.split(',').map(s => s.trim()).filter(Boolean);
                if (allowedTypes.length === 1) {
                    defaultType = allowedTypes[0];
                    // Reverse-infer the tier to keep the UI dropdowns in sync
                    if (t1Types.includes(defaultType)) defaultTier = 1;
                    else if (t2Types.includes(defaultType)) defaultTier = 2;
                    else if (t3Types.includes(defaultType)) defaultTier = 3;
                }
            }
        } else {
            // Fallback for hardcoded routing: match active tab ID to a configured schema type
            const matchType = [...t1Types, ...t2Types, ...t3Types].find(t => activeTab.includes(t));
            if (matchType) {
                defaultType = matchType;
                if (t1Types.includes(defaultType)) defaultTier = 1;
                else if (t2Types.includes(defaultType)) defaultTier = 2;
                else if (t3Types.includes(defaultType)) defaultTier = 3;
            }
        }

        state.setNewTaskField('repo', targetRepo);
        state.setNewTaskField('tier', defaultTier);
        state.setNewTaskField('type', defaultType);
        state.setNewTaskField('tags', defaultTagsStr);
        state.setNewTaskField('title', '');
        state.setNewTaskField('desc', '');
        let defaultStatus = 'open';
        if (activeView) {
            if (activeView.filters && activeView.filters.statuses) {
                const statuses = activeView.filters.statuses.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                if (statuses.length === 1 && statuses[0] === 'template') {
                    defaultStatus = 'template';
                }
            }
        }
        state.setNewTaskField('status', defaultStatus);
        state.setNewTaskField('deliveryDate', '');

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

        if (prefill) {
            Object.entries(prefill).forEach(([k, v]) => {
                state.setNewTaskField(k, v);
            });
            // Auto-resolve ticket type if tier was forced via prefill
            if (prefill.tier) {
                const forcedTypes = getTierTypes(prefill.tier);
                if (forcedTypes.length > 0) state.setNewTaskField('type', forcedTypes[0]);
            }
        }

        state.setModal('new', true);
    }
    async _saveNewTask() {
        const { repo, type, status, title, tags, desc, bucket, deliveryDate, parentId, dependsOn, priority, size } = KanbanStore.getState().newTaskForm;
        const sub_bucket = bucket || 'None';

        if (!title) {
            alert("Title is required.");
            throw new Error("Title is required.");
        }
        await this.api.postJson('new', {
            repo, type, status, title, tags, description: desc, sub_bucket, delivery_date: deliveryDate,
            parent_id: parentId, depends_on: (dependsOn || []).join(', '), priority, size
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
        const pathParts = filepath.split('/');
        const trackerIdx = pathParts.indexOf('.tracker');
        let inferredType = 'task';
        if (trackerIdx !== -1 && pathParts.length > trackerIdx + 1) {
            const folder = pathParts[trackerIdx + 1];
            if (folder !== 'log') {
                inferredType = folder.endsWith('s') ? folder.slice(0, -1) : folder;
            }
        }

        const inferredStatus = filepath.includes('/active/') ? 'active' : filepath.includes('/closed/') ? 'closed' : filepath.includes('/archived/') ? 'archived' : filepath.includes('/log/') ? 'logged' : 'open';

        const cleanTags = (() => {
            if (!yaml.tags) return [];
            const rawTags = String(yaml.tags).trim();
            const arr = rawTags.startsWith('[') ? rawTags.replace(/^\[|\]$/g, '').split(',') : rawTags.split(',');
            return arr.map(t => t.trim().replace(/['"]/g, '')).filter(t => t);
        })();
        const parsedDesc = content.startsWith('## Description') ? content.replace(/^## Description\n+/, '') : content;
        const dependsArr = (() => {
            try {
                const parsed = JSON.parse(yaml.depends_on);
                return Array.isArray(parsed) ? parsed : (yaml.depends_on ? yaml.depends_on.split(',').map(s=>s.trim()).filter(Boolean) : []);
            } catch(err) { return yaml.depends_on ? yaml.depends_on.split(',').map(s=>s.trim()).filter(Boolean) : []; }
        })();
        const state = KanbanStore.getState();
        const existingTask = state.tasks.find(t => t.filepath === filepath);
        state.setEditTaskField('tier', existingTask ? existingTask.tier : 3);
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
        state.setEditTaskField('parentId', yaml.parent_id || yaml.parent || '');
        state.setEditTaskField('dependsOn', dependsArr);
        state.setEditTaskField('priority', String(yaml.priority || '').toUpperCase());
        state.setEditTaskField('size', String(yaml.size || '').toUpperCase());
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
        const dependsArr = form.dependsOn || [];
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
            delivery_date: form.deliveryDate || null,
            parent_id: form.parentId || null,
            depends_on: JSON.stringify(dependsArr),
        };
        if (form.priority) updatedYaml.priority = form.priority; else delete updatedYaml.priority;
        if (form.size) updatedYaml.size = form.size; else delete updatedYaml.size;
        respond(updatedYaml);
    }
    _isDirty() {
        return this._isDirtyTracker;
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
                @sutram-modal-closed=${() => {
                    KanbanStore.getState().setModal('new', false);
                    if (this._returnToTemplatesBrowser) {
                        this._returnToTemplatesBrowser = false;
                        this._templatesBrowserOpen = true;
                        this.requestUpdate();
                    }
                }}>
                <div slot="body" style="display: contents;">
                    <div class="meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 15px;">
                        ${(() => {
                            const settings = KanbanStore.getState().settings || {};
                            const schemaId = (settings.kanban_repo_map || {})[selectedRepoNew] || 'agile_basic';
                            const allSchemas = [...(KanbanStore.getState().systemSchemas || []), ...(settings.kanban_profiles || [])];
                            const schema = allSchemas.find(p => p.id === schemaId) || {};

                            const getTierTypes = (t) => (schema[`t${t}_types`] || '').split(',').map(s => s.trim()).filter(Boolean);
                            const t1Types = getTierTypes(1);
                            const t2Types = getTierTypes(2);
                            const t3Types = getTierTypes(3);

                            const tierOptions = [];
                            if (t1Types.length > 0) tierOptions.push({value: 1, label: schema.t1_label || 'Tier 1'});
                            if (t2Types.length > 0) tierOptions.push({value: 2, label: schema.t2_label || 'Tier 2'});
                            if (t3Types.length > 0) tierOptions.push({value: 3, label: schema.t3_label || 'Tier 3'});

                            const currentTierTypes = getTierTypes(newTaskForm.tier || 3);
                            const typeOptions = currentTierTypes.map(t => ({value: t, label: t.charAt(0).toUpperCase() + t.slice(1)}));

                            return html`
                                ${bindStoreInput(KanbanStore, 'newTaskForm.repo', newTaskForm.repo, { label: 'Repository', type: 'select', flush: true, selectOptions: this.ecosystem.allRepos.map(r => ({value: r, label: r})), onUpdate: () => {
                                    // Re-evaluate schema on repo change
                                    const newSchemaId = (KanbanStore.getState().settings?.kanban_repo_map || {})[KanbanStore.getState().newTaskForm.repo] || 'agile_basic';
                                    const newSchema = allSchemas.find(p => p.id === newSchemaId) || {};
                                    const newT3Types = (newSchema.t3_types || '').split(',').map(s => s.trim()).filter(Boolean);
                                    KanbanStore.setState(s => ({ newTaskForm: { ...s.newTaskForm, bucket: 'None', tier: 3, type: newT3Types.length > 0 ? newT3Types[0] : 'task' } }));
                                } })}
                                ${bucketsNew.length > 0 ? bindStoreInput(KanbanStore, 'newTaskForm.bucket', newTaskForm.bucket, { label: 'Sub-Bucket', type: 'select', flush: true, selectOptions: [{value: 'None', label: 'No Bucket'}, ...bucketsNew.map(b => ({value: b.id, label: b.title}))] }) : ''}
                                ${tierOptions.length > 0 ? bindStoreInput(KanbanStore, 'newTaskForm.tier', newTaskForm.tier || 3, { label: 'Tier', type: 'select', flush: true, selectOptions: tierOptions, onUpdate: (val) => {
                                    const types = getTierTypes(val);
                                    KanbanStore.setState(s => ({ newTaskForm: { ...s.newTaskForm, type: types.length > 0 ? types[0] : 'task' } }));
                                }}) : ''}
                                ${typeOptions.length > 1 ? bindStoreInput(KanbanStore, 'newTaskForm.type', newTaskForm.type, { label: 'Ticket Type', type: 'select', flush: true, selectOptions: typeOptions }) : ''}
                            `;
                        })()}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.status', newTaskForm.status, { label: 'Status Zone', type: 'select', flush: true, selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}, {value: 'closed', label: 'Closed (Resolved)'}, {value: 'template', label: 'Template'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.priority', newTaskForm.priority, { label: 'Priority', type: 'select', flush: true, selectOptions: [{value: '', label: 'None'}, {value: 'P0', label: 'P0'}, {value: 'P1', label: 'P1'}, {value: 'P2', label: 'P2'}, {value: 'P3', label: 'P3'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.size', newTaskForm.size, { label: 'Size Estimate', type: 'select', flush: true, selectOptions: [{value: '', label: 'None'}, {value: 'XS', label: 'XS'}, {value: 'S', label: 'S'}, {value: 'M', label: 'M'}, {value: 'L', label: 'L'}, {value: 'XL', label: 'XL'}] })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.tags', newTaskForm.tags, { label: 'Tags (comma-separated)', placeholder: 'Architecture, UI', flush: true })}
                        ${bindStoreInput(KanbanStore, 'newTaskForm.deliveryDate', newTaskForm.deliveryDate, { label: 'Delivery Deadline', type: 'date', flush: true })}
                    </div>
                    <div class="meta-grid" style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px; flex: 1; min-height: 0;">
                        ${bindStoreInput(KanbanStore, 'newTaskForm.title', newTaskForm.title, { label: 'Ticket Title', placeholder: 'e.g., Fix schema registry timeout', style: 'font-weight: bold;', flush: true })}
                        <div style="display: flex; flex-direction: column; gap: 15px; align-items: stretch;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <sutram-label text="Parent ID"></sutram-label>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    ${newTaskForm.parentId ? html`
                                        <sutram-tag intent="primary">
                                            <span>${newTaskForm.parentId}</span>
                                            <span style="cursor: pointer; font-size: 1rem; margin-left: 6px;" @click=${() => KanbanStore.setState(s => ({ newTaskForm: { ...s.newTaskForm, parentId: '' } }))}>×</span>
                                        </sutram-tag>
                                    ` : ''}
                                    <sutram-async-btn label="🔗 Pick Parent" intent="neutral" style="--btn-padding: 6px 10px; --btn-font-size: 0.8rem;" .onClick=${() => this._openPicker('parentId', 'new')}></sutram-async-btn>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <sutram-label text="Dependencies"></sutram-label>
                                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    ${(newTaskForm.dependsOn || []).map(dep => html`
                                        <sutram-tag intent="warning">
                                            <span>${dep}</span>
                                            <span style="cursor: pointer; font-size: 1rem; margin-left: 6px;" @click=${() => this._removeDependency(dep, 'new')}>×</span>
                                        </sutram-tag>
                                    `)}
                                    <sutram-async-btn label="🔗 Add Dep" intent="neutral" style="--btn-padding: 6px 10px; --btn-font-size: 0.8rem;" .onClick=${() => this._openPicker('dependsOn', 'new')}></sutram-async-btn>
                                </div>
                            </div>
                        </div>
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
                @sutram-modal-closed=${() => { 
                    KanbanStore.getState().setModal('edit', false); 
                    this._originalTaskSnapshot = null; 
                    if (this._returnToTemplatesBrowser) {
                        this._returnToTemplatesBrowser = false;
                        this._templatesBrowserOpen = true;
                        this.requestUpdate();
                    }
                }}>

                <div slot="body" style="display: contents;">
                    ${this._modals?.edit && editTaskForm.filepath ? html`
                        <insetu-frontmatter-editor
                            id="fm-editor-tracker"
                            .filepath=${editTaskForm.filepath}
                            .defaultExpanded=${false}
                            @editor-dirty=${e => { this._isDirtyTracker = e.detail.isDirty; this.requestUpdate(); }}
                            @insetu:frontmatter-loaded=${this._onFrontmatterLoaded}
                            @insetu:request-frontmatter=${this._onRequestFrontmatter}>

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
                            <div slot="metadata-controls" style="display: flex; flex-direction: column; gap: 12px; margin: 0; max-height: 40vh; overflow-y: auto; overflow-x: hidden; padding-right: 5px;">
                                <div class="meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 15px;">
                                    ${(() => {
                                        const settings = KanbanStore.getState().settings || {};
                                        const schemaId = (settings.kanban_repo_map || {})[activeRepoEdit] || 'agile_basic';
                                        const allSchemas = [...(KanbanStore.getState().systemSchemas || []), ...(settings.kanban_profiles || [])];
                                        const schema = allSchemas.find(p => p.id === schemaId) || {};

                                        const getTierTypes = (t) => (schema[`t${t}_types`] || '').split(',').map(s => s.trim()).filter(Boolean);
                                        const t1Types = getTierTypes(1);
                                        const t2Types = getTierTypes(2);

                                        const tierOptions = [];
                                        if (t1Types.length > 0) tierOptions.push({value: 1, label: schema.t1_label || 'Tier 1'});
                                        if (t2Types.length > 0) tierOptions.push({value: 2, label: schema.t2_label || 'Tier 2'});
                                        tierOptions.push({value: 3, label: schema.t3_label || 'Tier 3'});

                                        const currentTierTypes = getTierTypes(editTaskForm.tier || 3);
                                        const typeOptions = currentTierTypes.map(t => ({value: t, label: t.charAt(0).toUpperCase() + t.slice(1)}));

                                        return html`
                                            ${bindStoreInput(KanbanStore, 'editTaskForm.repo', editTaskForm.repo, { label: 'Repository', type: 'select', flush: true, selectOptions: this.ecosystem.allRepos.map(r => ({value: r, label: r})), onUpdate: () => {
                                                const newSchemaId = (KanbanStore.getState().settings?.kanban_repo_map || {})[KanbanStore.getState().editTaskForm.repo] || 'agile_basic';
                                                const newSchema = allSchemas.find(p => p.id === newSchemaId) || {};
                                                const newT3Types = (newSchema.t3_types || '').split(',').map(s => s.trim()).filter(Boolean);
                                                KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, bucket: 'None', tier: 3, type: newT3Types.length > 0 ? newT3Types[0] : 'task' } }));
                                            } })}
                                            ${bucketsEdit.length > 0 ? bindStoreInput(KanbanStore, 'editTaskForm.bucket', editTaskForm.bucket, { label: 'Sub-Bucket', type: 'select', flush: true, selectOptions: [{value: 'None', label: 'No Bucket'}, ...bucketsEdit.map(b => ({value: b.id, label: b.title}))] }) : ''}
                                            ${tierOptions.length > 1 ? bindStoreInput(KanbanStore, 'editTaskForm.tier', editTaskForm.tier || 3, { label: 'Tier', type: 'select', flush: true, selectOptions: tierOptions, onUpdate: (val) => {
                                                const types = getTierTypes(val);
                                                KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, type: types.length > 0 ? types[0] : 'task' } }));
                                            }}) : ''}
                                            ${bindStoreInput(KanbanStore, 'editTaskForm.type', editTaskForm.type, { label: 'Ticket Type', type: 'select', flush: true, selectOptions: typeOptions })}
                                        `;
                                    })()}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.status', editTaskForm.status, { label: 'Status Zone', type: 'select', flush: true, selectOptions: [{value: 'open', label: 'Open (Backlog)'}, {value: 'active', label: 'Active (In Progress)'}, {value: 'closed', label: 'Closed (Resolved)'}, {value: 'template', label: 'Template'}] })}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.priority', editTaskForm.priority, { label: 'Priority', type: 'select', flush: true, selectOptions: [{value: '', label: 'None'}, {value: 'P0', label: 'P0'}, {value: 'P1', label: 'P1'}, {value: 'P2', label: 'P2'}, {value: 'P3', label: 'P3'}] })}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.size', editTaskForm.size, { label: 'Size Estimate', type: 'select', flush: true, selectOptions: [{value: '', label: 'None'}, {value: 'XS', label: 'XS'}, {value: 'S', label: 'S'}, {value: 'M', label: 'M'}, {value: 'L', label: 'L'}, {value: 'XL', label: 'XL'}] })}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.tagsRaw', editTaskForm.tagsRaw, { label: 'Tags (comma-separated)', placeholder: 'Architecture, UI', flush: true })}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.deliveryDate', editTaskForm.deliveryDate, { label: 'Delivery Deadline', type: 'date', flush: true })}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.createdAt', editTaskForm.createdAt, { label: 'Created At', type: 'datetime-local', flush: true })}
                                    ${bindStoreInput(KanbanStore, 'editTaskForm.closedAt', editTaskForm.closedAt, { label: 'Closed At', type: 'datetime-local', flush: true })}
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 15px; align-items: stretch; padding-top: 12px; border-top: 1px solid var(--border);">
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <sutram-label text="Parent ID"></sutram-label>
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            ${editTaskForm.parentId ? html`
                                                <sutram-tag intent="primary">
                                                    <span>${editTaskForm.parentId}</span>
                                                    <span style="cursor: pointer; font-size: 1rem; margin-left: 6px;" @click=${() => KanbanStore.setState(s => ({ editTaskForm: { ...s.editTaskForm, parentId: '' } }))}>×</span>
                                                </sutram-tag>
                                            ` : ''}
                                            <sutram-async-btn label="🔗 Pick Parent" intent="neutral" style="--btn-padding: 6px 10px; --btn-font-size: 0.8rem;" .onClick=${() => this._openPicker('parentId', 'edit')}></sutram-async-btn>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <sutram-label text="Dependencies"></sutram-label>
                                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                            ${(editTaskForm.dependsOn || []).map(dep => html`
                                                <sutram-tag intent="warning">
                                                    <span>${dep}</span>
                                                    <span style="cursor: pointer; font-size: 1rem; margin-left: 6px;" @click=${() => this._removeDependency(dep, 'edit')}>×</span>
                                                </sutram-tag>
                                            `)}
                                            <sutram-async-btn label="🔗 Add Dep" intent="neutral" style="--btn-padding: 6px 10px; --btn-font-size: 0.8rem;" .onClick=${() => this._openPicker('dependsOn', 'edit')}></sutram-async-btn>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </insetu-frontmatter-editor>
                    ` : ''}
                </div>
                ${this._modals?.edit && editTaskForm.filepath ? html`
                <div slot="footer" style="display: flex; justify-content: space-between; width: 100%;">
                    <sutram-async-btn style="margin: 0; --btn-padding: 8px 14px;" label="🗑️ Delete" intent="danger" .onClick=${async () => await this._deleteTask()}></sutram-async-btn>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-sm" style="background: var(--intent-warning); color: black; margin: 0;" @click=${() => {
                            KanbanStore.getState().setModal('edit', false);
                            if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(editTaskForm.filepath, true, true);
                        }}>📝 Raw Edit</button>
                        ${this._isDirtyTracker ? html`<sutram-async-btn style="margin: 0;" label="💾 Save" intent="success" .onClick=${() => this.shadowRoot.getElementById('fm-editor-tracker')._handleSave()}></sutram-async-btn>` : ''}
                    </div>
                </div>
                ` : ''}
            </sutram-modal>
            <!-- Quick Convert Modal -->
            <sutram-modal 
                ?open=${this._convertOpen}
                titleText="Convert Type"
                @sutram-modal-closed=${() => { this._convertOpen = false; this._convertTask = null; }}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px;">
                    ${(() => {
                        if (!this._convertTask) return '';
                        const state = KanbanStore.getState();
                        const settings = state.settings || {};
                        const schemaId = (settings.kanban_repo_map || {})[this._convertTask.repo] || 'agile_basic';
                        const allSchemas = [...(state.systemSchemas || []), ...(settings.kanban_profiles || [])];
                        const schema = allSchemas.find(p => p.id === schemaId) || {};
                        const types = (schema[`t${this._convertTask.tier}_types`] || '').split(',').map(s => s.trim()).filter(Boolean);

                        const otherTypes = types.filter(t => t !== this._convertTask.ticket_type);
                        if (otherTypes.length === 0) {
                            return html`<span style="color: var(--text-muted); font-style: italic;">No other types available in this tier for the active schema.</span>`;
                        }

                        return otherTypes.map(t => html`
                            <sutram-async-btn label="Convert to ${t.charAt(0).toUpperCase() + t.slice(1)}" intent="neutral" style="width: 100%; justify-content: flex-start;" .onClick=${async () => {
                                await KanbanStore.getState().transitionTask(this._convertTask, 'open', t);
                                this._convertOpen = false;
                                this._convertTask = null;
                                this.requestUpdate();
                            }}></sutram-async-btn>
                        `);
                    })()}
                </div>
            </sutram-modal>

            <!-- Ticket Selection Modal for Parent / Dependency Pickers -->
            <sutram-modal 
                ?open=${this._pickerOpen}  
                maxWidth="650px"
                titleText=${this._pickerMode === 'parentId' ? '🔗 Select Parent Ticket' : '🔗 Select Dependency Ticket'}
                @sutram-modal-closed=${() => this._pickerOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 10px; max-height: 60vh;">
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <sutram-select 
                            label="Filter Repo Scope"
                            .value=${this._pickerRepoFilter}
                            .options=${[{ value: 'ALL', label: 'ALL Repositories' }, ...this.ecosystem.allRepos.map(r => ({ value: r, label: r }))]}
                            @sutram-input-changed=${e => this._pickerRepoFilter = e.detail.value}
                            ?disabled=${this._pickerMode === 'parentId'}
                            style="flex: 1; margin: 0;">
                        </sutram-select>
                        <sutram-input  
                            label="Fuzzy Search" 
                            placeholder="Type ID, title, tags, or bucket..." 
                            .value=${this._pickerSearchQuery} 
                            @sutram-input-changed=${e => this._pickerSearchQuery = e.detail.value}
                            style="flex: 2; margin: 0;">
                        </sutram-input>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; padding-right: 5px;">
                        ${(() => {
                            const state = KanbanStore.getState();
                            const activeForm = this._pickerForm === 'new' ? state.newTaskForm : state.editTaskForm;
                            const currentRepo = activeForm.repo || this.ecosystem.allRepos[0] || '';
                            const currentFilepath = activeForm.filepath;
                            const currentTier = activeForm.tier || (state.tasks.find(t => t.filepath === currentFilepath)?.tier) || 3;

                            let candidates = state.tasks.filter(t => {
                                if (currentFilepath && t.filepath === currentFilepath) return false;
                                if (this._pickerRepoFilter !== 'ALL' && t.repo !== this._pickerRepoFilter) return false;

                                // Constrain parents strictly to higher tiers (lower integer values)
                                if (this._pickerMode === 'parentId' && t.tier >= currentTier) return false;

                                return true;
                            });

                            if (this._pickerSearchQuery) {
                                candidates = this.utils.fuzzyFilterObjects(candidates, this._pickerSearchQuery, t => `${t.id} ${t.title} ${t.repo} ${t.subBucket || ''} ${(t.tags || []).join(' ')}`);
                            }

                            const displayed = candidates.slice(0, 40);

                            if (displayed.length === 0) {
                                return html`<span style="color: var(--text-muted); font-style: italic; padding: 15px;">No matching candidates found.</span>`;
                            }
                            return displayed.map(t => {
                                const targetString = t.repo === currentRepo ? t.id : `${t.repo}/${t.id}`;
                                const detailStr = `Repo: ${t.repo} | Tier ${t.tier} | Bucket: ${t.subBucket || 'None'} ${(t.tags && t.tags.length > 0) ? `| Tags: #${t.tags.join(' #')}` : ''}`;
                                const displayTitle = t.title ? t.title.replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => def ? def.trim() : key.trim()) : '';
                                return html`
                                    <sutram-card 
                                        ?compact=${true}
                                        .titleText=${targetString + ' - ' + displayTitle}
                                        .detailText=${detailStr}
                                        icon="📄"
                                        intentColor="var(--intent-primary)"
                                        @click=${() => this._selectPickerItem(targetString)}>
                                        <div slot="actions">
                                            <sutram-async-btn label="Select" intent="primary" style="--btn-padding: 6px 12px; --btn-font-size: 0.8rem;" .onClick=${() => this._selectPickerItem(targetString)}></sutram-async-btn>
                                        </div>
                                    </sutram-card>
                                `;
                            });
                        })()}
                    </div>
                </div>
            </sutram-modal>

            <!-- Templates Browser Modal -->
            <sutram-modal 
                ?open=${this._templatesBrowserOpen}  
                ?fullscreen=${true}
                titleText="🧬 Template Library"
                @sutram-modal-closed=${() => { this._templatesBrowserOpen = false; this._activeTemplateRoot = null; }}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 10px;">
                    ${this._renderTemplatesView()}
                </div>
                ${!this._activeTemplateRoot ? html`
                    <div slot="footer" style="width: 100%;">
                        <sutram-async-btn 
                            label="➕ Create New Template" 
                            intent="success" 
                            style="width: 100%; display: block;" 
                            .onClick=${() => {
                                this._templatesBrowserOpen = false;
                                this._returnToTemplatesBrowser = true;
                                const currentRepo = this._templateRepoFilter && this._templateRepoFilter !== 'ALL' ? this._templateRepoFilter : (this.ecosystem.allRepos[0] || '');
                                this.dispatch('insetu:tracker:open-new-task', {
                                    activeTab: 'todos',
                                    prefill: { repo: currentRepo, status: 'template' }
                                });
                            }}>
                        </sutram-async-btn>
                    </div>
                ` : ''}
            </sutram-modal>

            <!-- Hierarchy Modal -->
            <sutram-modal 
                ?open=${this._hierarchyModalOpen}  
                ?fullscreen=${true}
                titleText="🌳 Task Hierarchy"
                @sutram-modal-closed=${() => { this._hierarchyModalOpen = false; this._hierarchyTask = null; }}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 10px;">
                    ${this._renderHierarchyView()}
                </div>
            </sutram-modal>
`;
    }
    _renderTaskCard(t, overrideClick = null, childMap = {}) {
        const dateStr = this.utils.formatDate(t.timestamp);
        const bucketStr = (t.subBucket && t.subBucket !== 'None') ? ` | 🗂️ ${t.subBucket}` : '';
        const descText = `${t.repo}${bucketStr} | ${dateStr}`;

        const childTasks = childMap[t.id] || [];
        const allKidsDone = childTasks.length > 0 && childTasks.every(c => ['closed', 'archived', 'logged'].includes(c.status));

        const typeStr = (t.ticket_type || '').toLowerCase();
        const isDanger = typeStr.includes('bug') || typeStr.includes('error') || typeStr.includes('hotfix');
        const isHighlight = typeStr.includes('queue') || typeStr.includes('review') || typeStr.includes('draft');

        const intentColor = isDanger ? 'var(--intent-danger)' : (isHighlight ? 'var(--intent-highlight)' : 'var(--intent-success)');
        const icon = t.tier === 1 ? '🎯' : (t.tier === 2 ? '📦' : (isDanger ? '🐛' : '✨'));
        const isOverdue = t.deliveryDate && new Date(t.deliveryDate) < new Date() && t.status !== 'closed';
        const displayTitle = t.title ? t.title.replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => def ? def.trim() : key.trim()) : '';

        return html`
            <insetu-card
                data-task-id=${t.id}
                .filename=${t.filepath}
                .titleText=${displayTitle}
                .descriptionText=${descText}
                .intentColor=${intentColor}
                .icon=${icon}
                entityType="file:task"
                .entityData=${{ ...t, isFS: true, repoDir: t.repo, suppressCopy: true, suppressDownload: true }}
                @card-clicked=${overrideClick ? overrideClick : () => {
                    if (this._templatesBrowserOpen) {
                        this._templatesBrowserOpen = false;
                        this._returnToTemplatesBrowser = true;
                        this.dispatch('insetu:tracker:open-edit-task', { filepath: t.filepath });
                    } else {
                        if (this.vfs && this.vfs.viewSourceFile) this.vfs.viewSourceFile(t.filepath, true);
                    }
                }}>
                <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                    ${t.priority ? html`<sutram-tag>${t.priority === 'P0' ? '🔴' : '⚡'} ${t.priority}</sutram-tag>` : ''}
                    ${t.size ? html`<sutram-tag>📏 ${t.size}</sutram-tag>` : ''}
                    ${allKidsDone && t.status !== 'closed' ? html`<sutram-tag intent="success">🔔 All Sub-tasks Complete</sutram-tag>` : ''}
                    ${t.dependsOn && t.dependsOn.length > 0 ? t.dependsOn.map(dep => {
                        let dRepo = t.repo;
                        let dId = dep;
                        if (dep.includes('/')) {
                            const parts = dep.split('/');
                            dRepo = parts[0];
                            dId = parts[1];
                        }
                        const depTask = this.tasks.find(x => x.id === dId && x.repo === dRepo);
                        const isResolved = !depTask || ['closed', 'logged', 'archived'].includes(depTask.status);
                        return html`
                            <sutram-tag intent="${isResolved ? 'success' : 'danger'}" title="${isResolved ? 'Resolved' : 'Blocking'}">
                                ${isResolved ? '✅' : '🔒'} ${dep}
                            </sutram-tag>
                        `;
                    }) : ''}
                    ${t.deliveryDate ? html`<sutram-tag intent="${isOverdue ? 'danger' : ''}">📅 Due: ${t.deliveryDate}</sutram-tag>` : ''}
                </div>
            </insetu-card>
        `;
    }
    _renderHierarchyView() {
        if (!this._hierarchyTask) return '';
        const allTasks = KanbanStore.getState().tasks;
        const childMap = allTasks.reduce((acc, t) => {
            if (t.parentId) {
                if (!acc[t.parentId]) acc[t.parentId] = [];
                acc[t.parentId].push(t);
            }
            return acc;
        }, {});

        const renderNode = (taskId, depth = 0) => {
            const task = allTasks.find(t => t.id === taskId);
            if (!task) return '';
            const children = childMap[taskId] || [];

            return html`
                <div style="margin-left: ${depth === 0 ? 0 : 20}px; border-left: ${depth > 0 ? '2px solid var(--border)' : 'none'}; padding-left: ${depth > 0 ? '15px' : '0'}; margin-bottom: 15px;">
                    ${this._renderTaskCard(task, () => {
                        this._hierarchyModalOpen = false;
                        this.dispatch('insetu:tracker:open-edit-task', { filepath: task.filepath });
                    }, childMap)}
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                        ${children.map(c => renderNode(c.id, depth + 1))}
                    </div>
                </div>
            `;
        };

        const rootDisplayTitle = this._hierarchyTask.title ? this._hierarchyTask.title.replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => def ? def.trim() : key.trim()) : '';

        return html`
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; align-items: center; gap: 15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                    <h3 style="margin: 0; color: var(--text);">Hierarchy: ${rootDisplayTitle}</h3>
                </div>
                <div>
                    ${renderNode(this._hierarchyTask.id, 0)}
                </div>
            </div>
        `;
    }

    _renderTemplatesView() {
        const state = KanbanStore.getState();
        const filteredTasks = state.tasks.filter(t => t.status === 'template');

        const allSchemas = [...(state.systemSchemas || []), ...(state.settings?.kanban_profiles || [])];
        const repoMap = state.settings?.kanban_repo_map || {};

        const childMap = filteredTasks.reduce((acc, t) => {
            if (t.parentId) {
                if (!acc[t.parentId]) acc[t.parentId] = [];
                acc[t.parentId].push(t);
            }
            return acc;
        }, {});
        if (this._activeTemplateRoot) {
            // TREE VIEW
            const rootTask = filteredTasks.find(t => t.id === this._activeTemplateRoot);
            if (!rootTask) {
                this._activeTemplateRoot = null;
                return this.requestUpdate();
            }
            const rootDisplayTitle = rootTask.title ? rootTask.title.replace(/\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => def ? def.trim() : key.trim()) : '';

            const renderNode = (taskId, depth = 0) => {
                const task = filteredTasks.find(t => t.id === taskId);
                if (!task) return '';
                const children = childMap[taskId] || [];
                const schemaId = repoMap[task.repo] || 'agile_basic';
                const schema = allSchemas.find(s => s.id === schemaId) || {};
                const nextTier = task.tier < 3 ? task.tier + 1 : null;
                const nextTierLabel = nextTier ? (schema[`t${nextTier}_label`] || `Tier ${nextTier}`) : null;

                return html`
                    <div style="margin-left: ${depth === 0 ? 0 : 20}px; border-left: ${depth > 0 ? '2px solid var(--border)' : 'none'}; padding-left: ${depth > 0 ? '15px' : '0'}; margin-bottom: 15px;">
                        ${this._renderTaskCard(task, null, childMap)}
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            ${children.map(c => renderNode(c.id, depth + 1))}
                            ${nextTier ? html`
                                <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: 1px dashed var(--border); width: fit-content; margin-top: 5px;"
                                    @click=${() => {
                                        this._templatesBrowserOpen = false;
                                        this._returnToTemplatesBrowser = true;
                                        this.dispatch('insetu:tracker:open-new-task', { 
                                            activeTab: 'todos', 
                                            prefill: { parentId: task.id, tier: nextTier, repo: task.repo, status: 'template' } 
                                        });
                                    }}>
                                    ➕ New ${nextTierLabel}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            };

            return html`
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                        <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._activeTemplateRoot = null}>🔙 Back</button>
                        <h3 style="margin: 0; color: var(--text);">Template Editor: ${rootDisplayTitle}</h3>
                    </div>
                    <div>
                        ${renderNode(rootTask.id, 0)}
                    </div>
                </div>
            `;
        }
        // LIST VIEW
        let repoFiltered = filteredTasks;
        const currentRepo = this._templateRepoFilter || (this.ecosystem.allRepos.length > 0 ? this.ecosystem.allRepos[0] : 'ALL');

        if (currentRepo !== 'ALL') {
            const targetSchema = repoMap[currentRepo] || 'agile_basic';
            repoFiltered = filteredTasks.filter(t => (repoMap[t.repo] || 'agile_basic') === targetSchema);
        }

        const roots = repoFiltered.filter(t => !t.parentId);

        return html`
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; background: var(--input-bg); padding: 10px 15px; border-radius: 6px; border: 1px solid var(--border);">
                    <span style="font-weight: bold; font-size: 0.9rem; color: var(--text-muted);">Repository:</span>
                    <sutram-select 
                        style="margin: 0; min-width: 200px;"
                        .value=${currentRepo}
                        .options=${[{value: 'ALL', label: 'All Repositories'}, ...this.ecosystem.allRepos.map(r => ({value: r, label: r}))]}
                        @sutram-input-changed=${(e) => { this._templateRepoFilter = e.detail.value; this.requestUpdate(); }}>
                    </sutram-select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${roots.length > 0 
                        ? roots.map(t => {
                            const hasChildren = childMap[t.id] && childMap[t.id].length > 0;
                            return this._renderTaskCard(t, hasChildren ? () => { this._activeTemplateRoot = t.id; this.requestUpdate(); } : null, childMap);
                        }) 
                        : html`<sutram-empty-state text="No templates found for this repository's schema."></sutram-empty-state>`
                    }
                </div>
            </div>
        `;
    }
    _openPicker(mode, formType) {
        const state = KanbanStore.getState();
        const activeForm = formType === 'new' ? state.newTaskForm : state.editTaskForm;
        const currentRepo = activeForm.repo || this.ecosystem.allRepos[0] || '';

        this._pickerMode = mode;
        this._pickerForm = formType;
        this._pickerSearchQuery = '';
        this._pickerRepoFilter = mode === 'parentId' ? currentRepo : 'ALL';
        this._pickerOpen = true;
        this.requestUpdate();
    }
    _selectPickerItem(targetString) {
        const state = KanbanStore.getState();
        if (this._pickerForm === 'new') {
            if (this._pickerMode === 'parentId') {
                state.setNewTaskField('parentId', targetString);
            } else {
                const currentArr = state.newTaskForm.dependsOn || [];
                if (!currentArr.includes(targetString)) {
                    state.setNewTaskField('dependsOn', [...currentArr, targetString]);
                }
            }
        } else {
            if (this._pickerMode === 'parentId') {
                state.setEditTaskField('parentId', targetString);
            } else {
                const currentArr = state.editTaskForm.dependsOn || [];
                if (!currentArr.includes(targetString)) {
                    state.setEditTaskField('dependsOn', [...currentArr, targetString]);
                }
            }
        }
        this._pickerOpen = false;
        this.requestUpdate();
    }

    _removeDependency(depId, formType) {
        const state = KanbanStore.getState();
        const currentArr = formType === 'new' ? (state.newTaskForm.dependsOn || []) : (state.editTaskForm.dependsOn || []);
        const updatedArr = currentArr.filter(d => d !== depId);
        if (formType === 'new') {
            state.setNewTaskField('dependsOn', updatedArr);
        } else {
            state.setEditTaskField('dependsOn', updatedArr);
        }
        this.requestUpdate();
    }
}
customElements.define('insetu-ext-tracker-modals', InSetuExtTrackerModals);
// OS Registration Hook
export class InSetuExtTrackerSettings extends InSetuElement {
    static styles = [sharedStyles, css`
        :host { display: contents; }
    `];

    static properties = {
        settingsModalOpen: { type: Boolean },
        isMigrating: { type: Boolean },
        activeSettingsTab: { type: String },
        allRepos: { type: Array },
        repoMap: { type: Object },
        customSchemas: { type: Array },
        selectedSchemaId: { type: String },
        schemaFormData: { type: Object },
        globalViews: { type: Array },
        parentTabs: { type: Array }
    };

    constructor() {
        super();
        this.settingsModalOpen = false;
        this.isMigrating = false;
        this.activeSettingsTab = 'schemas';
        this.allRepos = [];
        this.repoMap = {};
        this.customSchemas = [];
        this.selectedSchemaId = 'agile_basic';
        this.schemaFormData = null;
        this.globalViews = [];
        this.parentTabs = [];
        this._originalSchemas = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, state => {
            this.allRepos = state.allRepos || [];
        });
        this.subscribe(KanbanStore, state => {
            this.isMigrating = state.settings?.tracker_is_migrating === true || state.settings?.tracker_is_migrating === 'true';
            if (state.settingsModalOpen !== this.settingsModalOpen) {
                this.settingsModalOpen = state.settingsModalOpen || false;
                if (this.settingsModalOpen) {
                    this.allRepos = AppStore.getState().allRepos || [];
                    this._loadGlobalData();
                }
            }
        });
        this.allRepos = AppStore.getState().allRepos || [];
    }
    _loadGlobalData() {
        const globalSettings = KanbanStore.getState().settings || {};
        const rawSchemas = globalSettings.kanban_profiles || [];
        // Fetch the dynamic SSOT from the backend
        const SYSTEM_SCHEMAS = KanbanStore.getState().systemSchemas || [];

        // Safely merge System Schemas with the user's Custom Schemas
        const customProfiles = this.utils.clone(rawSchemas).filter(s => !s.isSystem);
        this.customSchemas = [...SYSTEM_SCHEMAS, ...customProfiles];

        this._originalSchemas = this.utils.clone(this.customSchemas);
        const rawViews = globalSettings.global_views || [];
        this.globalViews = this.utils.clone(rawViews).map(v => ({ ...v, _uuid: v._uuid || crypto.randomUUID() }));
        const rawParentTabs = globalSettings.parent_tabs || [{ id: 'tasks', label: 'Tasks' }];
        this.parentTabs = this.utils.clone(rawParentTabs).map(t => ({ ...t, _uuid: t._uuid || crypto.randomUUID() }));

        this.repoMap = this.utils.clone(globalSettings.kanban_repo_map || {});
        this.allRepos.forEach(repo => {
            if (!this.repoMap[repo]) this.repoMap[repo] = 'agile_basic';
        });

        this._onSelectSchema({ detail: { value: 'agile_basic' }});
    }
    _onSelectSchema(e) {
        this.selectedSchemaId = e.detail.value;
        const schema = this.customSchemas.find(s => s.id === this.selectedSchemaId);
        this.schemaFormData = schema ? this.utils.clone(schema) : null;
        this.requestUpdate();
    }

    _createNewSchema() {
        const newId = 'custom_' + Date.now();
        const newSchema = {
            id: newId,
            name: 'New Custom Schema',
            isSystem: false,
            t1_label: 'Epics', t1_types: 'epic',
            t2_label: 'Sprints', t2_types: 'sprint',
            t3_label: 'Tasks', t3_types: 'todo, bug, queue'
        };
        this.customSchemas.push(newSchema);
        this.selectedSchemaId = newId;
        this.schemaFormData = this.utils.clone(newSchema);
        this.requestUpdate();
    }
    _updateSchemaForm(field, value) {
        if (this.schemaFormData.isSystem) return;
        this.schemaFormData = { ...this.schemaFormData, [field]: value };
        const idx = this.customSchemas.findIndex(s => s.id === this.selectedSchemaId);
        if (idx !== -1) {
            const updatedSchemas = [...this.customSchemas];
            updatedSchemas[idx] = { ...updatedSchemas[idx], [field]: value };
            this.customSchemas = updatedSchemas;
        }
        this.requestUpdate();
    }

    _deleteSchema() {
        if (this.schemaFormData.isSystem) return;
        this.customSchemas = this.customSchemas.filter(s => s.id !== this.selectedSchemaId);

        const newRepoMap = { ...this.repoMap };
        Object.keys(newRepoMap).forEach(repo => {
            if (newRepoMap[repo] === this.selectedSchemaId) {
                newRepoMap[repo] = 'agile_basic';
            }
        });
        this.repoMap = newRepoMap;

        this.selectedSchemaId = 'agile_basic';
        this._onSelectSchema({ detail: { value: 'agile_basic' }});
    }
    _addParentTab() {
        this.parentTabs = [...this.parentTabs, {
            _uuid: crypto.randomUUID(),
            id: 'new_tab',
            label: 'New Tab'
        }];
    }

    _removeParentTab(index) {
        const updatedTabs = [...this.parentTabs];
        updatedTabs.splice(index, 1);
        this.parentTabs = updatedTabs;
    }
    _getTypesForScope(schemaId, tier) {
        const types = new Set();
        this.customSchemas.forEach(s => {
            if (schemaId && s.id !== schemaId) return;
            if (!tier || tier === 1) (s.t1_types || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).forEach(t => types.add(t));
            if (!tier || tier === 2) (s.t2_types || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).forEach(t => types.add(t));
            if (!tier || tier === 3) (s.t3_types || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).forEach(t => types.add(t));
        });
        return Array.from(types).sort();
    }
    _updateParentTab(index, field, value) {
        const updatedTabs = [...this.parentTabs];
        const oldId = updatedTabs[index].id;

        updatedTabs[index] = { ...updatedTabs[index], [field]: value };

        if (field === 'label') {
            updatedTabs[index].id = this.utils.slugify(value) || `tab_${Date.now()}`;
        }

        const newId = updatedTabs[index].id;

        // Cascade ID updates to linked global views to prevent orphaning
        if (oldId && newId && oldId !== newId) {
            this.globalViews = this.globalViews.map(v => {
                const currentParent = v.target_parent || 'tasks';
                return currentParent === oldId ? { ...v, target_parent: newId } : v;
            });
        }

        this.parentTabs = updatedTabs;
    }
    _addGlobalView() {
        const defaultParent = this.parentTabs.length > 0 ? this.parentTabs[0].id : 'tasks';
        this.globalViews = [...this.globalViews, {
            _uuid: crypto.randomUUID(),
            id: 'new_view',
            label: '📄 New View',
            target_parent: defaultParent,
            target_schema: '',
            target_tier: 3,
            layout: 'columns',
            filters: { ticket_types: '', statuses: '' }
        }];
    }

    _removeGlobalView(index) {
        const updatedViews = [...this.globalViews];
        updatedViews.splice(index, 1);
        this.globalViews = updatedViews;
    }
    _updateGlobalView(index, field, value) {
        const updatedViews = [...this.globalViews];
        updatedViews[index] = { ...updatedViews[index], [field]: value };
        if (field === 'label') {
            updatedViews[index].id = this.utils.slugify(value) || `view_${Date.now()}`;
        }
        this.globalViews = updatedViews;
    }

    _updateGlobalViewFilter(index, field, value) {
        const updatedViews = [...this.globalViews];
        updatedViews[index] = { 
            ...updatedViews[index], 
            filters: { ...(updatedViews[index].filters || {}), [field]: value }
        };
        this.globalViews = updatedViews;
    }

    async saveSettings() {
        const renames = [];

        this.customSchemas.forEach(schema => {
            const orig = this._originalSchemas.find(s => s.id === schema.id);
            if (orig) {
                const processTier = (oldStr, newStr) => {
                    const oldArr = (oldStr || '').split(',').map(s => s.trim()).filter(Boolean);
                    const newArr = (newStr || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (oldArr.length === newArr.length) {
                        for (let i = 0; i < oldArr.length; i++) {
                            if (oldArr[i] !== newArr[i]) {
                                const affectedRepos = this.allRepos.filter(r => this.repoMap[r] === schema.id);
                                affectedRepos.forEach(repo => {
                                    renames.push({ old: oldArr[i], new: newArr[i], repo: repo });
                                });
                            }
                        }
                    }
                };
                processTier(orig.t1_types, schema.t1_types);
                processTier(orig.t2_types, schema.t2_types);
                processTier(orig.t3_types, schema.t3_types);
            }
        });
        const cleanViews = this.globalViews.map(v => {
            const clean = { ...v };
            delete clean._uuid;
            return clean;
        });
        const cleanParentTabs = this.parentTabs.map(t => {
            const clean = { ...t };
            delete clean._uuid;
            return clean;
        });
        // Strip out system schemas before writing to the physical database
        const profilesToSave = this.customSchemas.filter(s => !s.isSystem);

        const res = await this.api.post(`vocab_settings`, {
            kanban_profiles: profilesToSave,
            kanban_repo_map: this.repoMap,
            global_views: cleanViews,
            parent_tabs: cleanParentTabs,
            renames: renames 
        });

        if (res.status === 202) {
            const data = await res.json();
            window.inSetu.utils.pollJob(data.job_id, {
                onProgress: (msg) => { if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`⏳ ${msg}`, null); },
                onComplete: () => {
                    KanbanStore.getState().fetchSettings();
                    KanbanStore.setState({ settingsModalOpen: false });
                    window.inSetu.stores.Toast.getState().addToast(`Migration complete. Schemas and views applied successfully.`);
                }
            });
        } else {
            KanbanStore.getState().fetchSettings();
            KanbanStore.setState({ settingsModalOpen: false });
            window.inSetu.stores.Toast.getState().addToast(`Tracker schemas and views applied successfully.`);
        }
    }
    render() {
        const allSchemas = this.customSchemas;
        const modalBody = this.isMigrating ? html`
            <div style="display: flex; flex-direction: column; gap: 15px; padding: 30px; margin: 20px; align-items: center; justify-content: center; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px;">
                <sutram-spinner text="Harmonizing semantic vocabulary across workspace..."></sutram-spinner>
                <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 15px;">
                    The system is safely migrating your Markdown files. This panel is locked to prevent race conditions.
                </p>
            </div>
        ` : html`
            <div style="display: flex; flex-direction: column; height: 100%; min-height: 0;">

                <yenvui-tabs 
                    variant="sub"
                    .tabs=${[
                        { id: 'schemas', label: '📋 Repository Schemas' },
                        { id: 'views', label: '👀 Global Tabs & Views' }
                    ]}
                    .activeTab=${this.activeSettingsTab}
                    @yenvui-tab-selected=${(e) => this.activeSettingsTab = e.detail.tabId}>

                    <div slot="schemas" style="display: flex; flex-direction: column; overflow-y: auto;">
                        <sutram-collapsible titleText="Assign Schemas" intent="neutral" ?open=${true}>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">Assign a Kanban template to each repository.</p>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${this.allRepos.map(repo => html`
                                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px;">
                                        <span style="font-weight: bold; color: var(--text);">📁 ${repo}</span>
                                        <sutram-select 
                                            .value=${this.repoMap[repo] || 'agile_basic'} 
                                            .options=${allSchemas.map(s => ({value: s.id, label: s.name}))}
                                            @sutram-input-changed=${e => { this.repoMap = {...this.repoMap, [repo]: e.detail.value}; this.requestUpdate(); }}
                                            ?flush=${true}
                                            style="min-width: 250px;">
                                        </sutram-select>
                                    </div>
                                `)}
                            </div>
                        </sutram-collapsible>

                        <sutram-collapsible titleText="Define Schemas" intent="neutral" ?open=${true}>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                                <sutram-select 
                                    label="Select Schema to View/Edit"
                                    .value=${this.selectedSchemaId}
                                    .options=${allSchemas.map(s => ({value: s.id, label: s.name}))}
                                    @sutram-input-changed=${this._onSelectSchema}
                                    ?flush=${true}
                                    style="flex: 1; max-width: 300px; margin-bottom: 0;">
                                </sutram-select>
                                <sutram-async-btn label="➕ New Custom Schema" intent="success" .onClick=${() => this._createNewSchema()} style="margin: 0;"></sutram-async-btn>
                            </div>

                            ${this.schemaFormData ? html`
                            <div style="display: flex; flex-direction: column; gap: 15px; background: var(--bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-top: 5px;">
                                ${!this.schemaFormData.isSystem ? html`
                                    <sutram-input label="Custom Schema Name" .value=${this.schemaFormData.name} @sutram-input-changed=${e => this._updateSchemaForm('name', e.detail.value)}></sutram-input>
                                ` : html`
                                    <div style="font-size: 0.85rem; color: var(--intent-warning); font-style: italic; font-weight: bold;">⚠️ This is a system default schema. It is read-only. Create a custom schema to modify values.</div>
                                `}

                                <h4 style="margin: 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 5px;">UI Tier Labels</h4>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                                    <sutram-input label="Tier 1 (Top Level)" .value=${this.schemaFormData.t1_label} ?disabled=${this.schemaFormData.isSystem} @sutram-input-changed=${e => this._updateSchemaForm('t1_label', e.detail.value)}></sutram-input>
                                    <sutram-input label="Tier 2 (Middle Level)" .value=${this.schemaFormData.t2_label} ?disabled=${this.schemaFormData.isSystem} @sutram-input-changed=${e => this._updateSchemaForm('t2_label', e.detail.value)}></sutram-input>
                                    <sutram-input label="Tier 3 (Base Tasks)" .value=${this.schemaFormData.t3_label} ?disabled=${this.schemaFormData.isSystem} @sutram-input-changed=${e => this._updateSchemaForm('t3_label', e.detail.value)}></sutram-input>
                                </div>

                                <h4 style="margin: 0; color: var(--intent-primary); border-top: 1px solid var(--border); padding-top: 15px;">Semantic Types</h4>
                                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Comma separated domains mapping tickets to tiers (e.g. "todo, bug").</p>
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <sutram-input label="Tier 1 Types" .value=${this.schemaFormData.t1_types} ?disabled=${this.schemaFormData.isSystem} @sutram-input-changed=${e => this._updateSchemaForm('t1_types', e.detail.value)}></sutram-input>
                                    <sutram-input label="Tier 2 Types" .value=${this.schemaFormData.t2_types} ?disabled=${this.schemaFormData.isSystem} @sutram-input-changed=${e => this._updateSchemaForm('t2_types', e.detail.value)}></sutram-input>
                                    <sutram-input label="Tier 3 Types" .value=${this.schemaFormData.t3_types} ?disabled=${this.schemaFormData.isSystem} @sutram-input-changed=${e => this._updateSchemaForm('t3_types', e.detail.value)}></sutram-input>
                                </div>
                                ${!this.schemaFormData.isSystem ? html`
                                    <div style="display: flex; justify-content: flex-end; margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
                                        <sutram-async-btn label="🗑️ Delete Custom Schema" intent="danger" .onClick=${() => this._deleteSchema()}></sutram-async-btn>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        </sutram-collapsible>
                    </div>
                    <div slot="views" style="display: flex; flex-direction: column; overflow-y: auto;">
                        <sutram-collapsible titleText="Parent Tabs" intent="neutral" ?open=${true}>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">Define the parent tabs to be used by Tracker. If existing, Tracker sub-tabs will be appended. Otherwise, tabs will be built as defined.</p>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${this.parentTabs.map((t, i) => html`
                                    <div style="display: flex; gap: 10px; align-items: center;">
                                        <sutram-input label="Tab Label" .value=${t.label} @sutram-input-changed=${e => this._updateParentTab(i, 'label', e.detail.value)} style="flex: 1;" ?flush=${true}></sutram-input>
                                        <sutram-input label="Tab ID" .value=${t.id} @sutram-input-changed=${e => this._updateParentTab(i, 'id', e.detail.value)} style="flex: 1;" ?flush=${true}></sutram-input>
                                        <button class="btn-sm" style="background: var(--intent-danger); margin: 0; margin-top: 18px;" @click=${() => this._removeParentTab(i)}>✕</button>
                                    </div>
                                `)}
                                <div style="display: flex; justify-content: flex-start; margin-top: 5px;">
                                    <sutram-async-btn label="➕ Add Parent Tab" intent="neutral" .onClick=${() => this._addParentTab()}></sutram-async-btn>
                                </div>
                            </div>
                        </sutram-collapsible>
                        <sutram-collapsible titleText="Sub-Tabs (View filters)" intent="neutral" ?open=${true}>
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Define the sub-navigation tabs that filter the kanban boards across your entire workspace.</p>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${this.globalViews.map((v, i) => html`
                                <div style="display: flex; flex-direction: column; gap: 12px; background: var(--input-bg); padding: 15px; border: 1px solid var(--border); border-radius: 6px;">
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
                                        <sutram-input label="Tab Label" .value=${v.label} @sutram-input-changed=${(e) => this._updateGlobalView(i, 'label', e.detail.value)} ?flush=${true}></sutram-input>
                                        <sutram-input label="Tab ID" .value=${v.id} ?disabled=${true} ?flush=${true}></sutram-input>
                                        <sutram-select 
                                            label="Parent Tab"
                                            style="margin: 0; --bg-input: var(--bg);"
                                            .value=${v.target_parent || 'tasks'} 
                                            .options=${this.parentTabs.map(pt => ({value: pt.id, label: pt.label}))}
                                            @sutram-input-changed=${(e) => this._updateGlobalView(i, 'target_parent', e.detail.value)}>
                                        </sutram-select>
                                        <sutram-select 
                                            label="Layout Type"
                                            style="margin: 0;"
                                            .value=${v.layout} 
                                            .options=${[
                                                {value: 'columns', label: 'Board (Columns)'},
                                                {value: 'stacked', label: 'List (Stacked)'},
                                                {value: 'log', label: 'History (Log)'}
                                            ]}
                                            @sutram-input-changed=${(e) => this._updateGlobalView(i, 'layout', e.detail.value)}>
                                        </sutram-select>
                                        <sutram-select 
                                            label="Scope By Schema"
                                            style="margin: 0;"
                                            .value=${v.target_schema || ''} 
                                            .options=${[
                                                {value: '', label: 'Any Schema'},
                                                ...this.customSchemas.map(s => ({value: s.id, label: s.name}))
                                            ]}
                                            @sutram-input-changed=${(e) => this._updateGlobalView(i, 'target_schema', e.detail.value)}>
                                        </sutram-select>
                                        <sutram-select 
                                            label="Repo Filtering Strategy"
                                            style="margin: 0;"
                                            .value=${v.repo_strategy || 'global'} 
                                            .options=${[
                                                {value: 'global', label: 'Follow Global Repo Filter'},
                                                {value: 'schema', label: 'Ignore Global (Auto-filter to Schema)'},
                                                {value: 'explicit', label: 'Ignore Global (Explicit Repos)'}
                                            ]}
                                            @sutram-input-changed=${(e) => this._updateGlobalView(i, 'repo_strategy', e.detail.value)}>
                                        </sutram-select>
                                        ${(() => {
                                            const activeSchema = this.customSchemas.find(s => s.id === v.target_schema) || this.customSchemas.find(s => s.id === 'agile_basic') || this.customSchemas[0] || {};
                                            return html`
                                                <sutram-select 
                                                    label="Scope By Tier"
                                                    style="margin: 0;"
                                                    .value=${String(v.target_tier || '')} 
                                                    .options=${[
                                                        {value: '', label: 'Any'},
                                                        {value: '1', label: 'Tier 1 (' + (activeSchema.t1_label || 'Top') + ')'},
                                                        {value: '2', label: 'Tier 2 (' + (activeSchema.t2_label || 'Middle') + ')'},
                                                        {value: '3', label: 'Tier 3 (' + (activeSchema.t3_label || 'Base') + ')'}
                                                    ]}
                                                    @sutram-input-changed=${(e) => this._updateGlobalView(i, 'target_tier', e.detail.value ? parseInt(e.detail.value, 10) : null)}>
                                                </sutram-select>
                                            `;
                                        })()}
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 5px; padding-top: 12px; border-top: 1px dashed var(--border);">
                                        ${v.repo_strategy === 'explicit' ? html`
                                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                                <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">Select Explicit Repositories</label>
                                                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                                    ${this.allRepos.map(repo => {
                                                        const currentExplicit = v.explicit_repos || [];
                                                        return html`<sutram-toggle label=${repo} .checked=${currentExplicit.includes(repo)} @sutram-input-changed=${(e) => {
                                                            let newSelected = [...currentExplicit];
                                                            if (e.detail.value) {
                                                                if (!newSelected.includes(repo)) newSelected.push(repo);
                                                            } else {
                                                                newSelected = newSelected.filter(r => r !== repo);
                                                            }
                                                            this._updateGlobalView(i, 'explicit_repos', newSelected);
                                                        }} ?flush=${true}></sutram-toggle>`;
                                                    })}
                                                </div>
                                            </div>
                                        ` : ''}
                                        ${(() => {
                                            if (v.layout === 'log') {
                                                return html`
                                                    <div style="padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px;">
                                                        <span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">
                                                            ℹ️ This is a specialized layout. It inherits your schema and tier scope, but status and type filters are managed automatically by the engine.
                                                        </span>
                                                    </div>
                                                `;
                                            }

                                            const availableTypes = this._getTypesForScope(v.target_schema, v.target_tier);
                                            const currentTypes = v.filters?.ticket_types === 'NONE' ? [] : (v.filters?.ticket_types ? v.filters.ticket_types.split(',').map(s=>s.trim()) : availableTypes);
                                            const allStatuses = ['open', 'active', 'closed', 'logged', 'archived', 'template'];
                                            const currentStatuses = v.filters?.statuses === 'NONE' ? [] : (v.filters?.statuses ? v.filters.statuses.split(',').map(s=>s.trim()) : allStatuses);

                                            return html`
                                                ${availableTypes.length > 1 ? html`
                                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                                        <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">Filter by Type</label>
                                                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                                            ${availableTypes.map(type => {
                                                                const isChecked = currentTypes.includes(type);
                                                                return html`<sutram-toggle label=${type} .checked=${isChecked} @sutram-input-changed=${(e) => {
                                                                    let newSelected = [...currentTypes];
                                                                    if (e.detail.value) {
                                                                        if (!newSelected.includes(type)) newSelected.push(type);
                                                                    } else {
                                                                        newSelected = newSelected.filter(t => t !== type);
                                                                    }
                                                                    if (newSelected.length === availableTypes.length) this._updateGlobalViewFilter(i, 'ticket_types', '');
                                                                    else if (newSelected.length === 0) this._updateGlobalViewFilter(i, 'ticket_types', 'NONE');
                                                                    else this._updateGlobalViewFilter(i, 'ticket_types', newSelected.join(', '));
                                                                }} ?flush=${true}></sutram-toggle>`;
                                                            })}
                                                        </div>
                                                    </div>
                                                ` : ''}
                                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                                    <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">Filter by Status</label>
                                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                                        ${allStatuses.map(status => {
                                                            const isChecked = currentStatuses.includes(status);
                                                            return html`<sutram-toggle label=${status} .checked=${isChecked} @sutram-input-changed=${(e) => {
                                                                let newSelected = [...currentStatuses];
                                                                if (e.detail.value) {
                                                                    if (!newSelected.includes(status)) newSelected.push(status);
                                                                } else {
                                                                    newSelected = newSelected.filter(t => t !== status);
                                                                }
                                                                if (newSelected.length === allStatuses.length) this._updateGlobalViewFilter(i, 'statuses', '');
                                                                else if (newSelected.length === 0) this._updateGlobalViewFilter(i, 'statuses', 'NONE');
                                                                else this._updateGlobalViewFilter(i, 'statuses', newSelected.join(', '));
                                                            }} ?flush=${true}></sutram-toggle>`;
                                                        })}
                                                    </div>
                                                </div>
                                            `;
                                        })()}
                                    </div>
                                    <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
                                        <sutram-async-btn label="🗑️ Remove View" intent="danger" .onClick=${() => this._removeGlobalView(i)}></sutram-async-btn>
                                    </div>
                                </div>
                            `)}
                        </div>
                        <div style="display: flex; justify-content: flex-start; margin-top: 15px;">
                            <sutram-async-btn label="➕ Add Global View" intent="primary" style="margin: 0;" .onClick=${() => this._addGlobalView()}></sutram-async-btn>
                        </div>
                    </sutram-collapsible>
                </div>
                </yenvui-tabs>
        </div>
        `;

        return html`
            <sutram-modal ?open=${this.settingsModalOpen} ?fullscreen=${true} ?flush=${true} titleText="Kanban Configuration" @sutram-modal-closed=${() => KanbanStore.setState({ settingsModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                    ${modalBody}
                </div>
                <sutram-async-btn slot="footer" label="💾 Save Settings" intent="primary" .onClick=${() => this.saveSettings()} ?disabled=${this.isMigrating}></sutram-async-btn>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-tracker-settings', InSetuExtTrackerSettings);
window.ExtensionRegistry.registerExtension('tracker', {
    name: "Issue Tracker",
    version: "2.0.0",
    settingsActions: [
        {
            id: 'tracker_domain_vocab',
            label: 'Kanban Structure Template',
            icon: '🏷️',
            onClick: async () => {
                const state = KanbanStore.getState();
                if (!state.systemSchemas || state.systemSchemas.length === 0) {
                    if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⏳ Loading schemas...", null);
                    await state.fetchSettings();
                    if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("", 10);
                }
                KanbanStore.setState({ settingsModalOpen: true });
            }
        }
    ],
    shortcuts: [
        {
            context: 'modal:new-task-modal',
            key: 'ctrl+s',
            label: 'Save New Task',
            action: () => window.dispatchEvent(new CustomEvent('insetu:tracker:save-new-task'))
        },
        {
            context: 'modal:edit-task-modal',
            key: 'ctrl+s',
            label: 'Save Edited Task',
            action: () => window.dispatchEvent(new CustomEvent('insetu:tracker:save-edit-task'))
        }
    ],
    entityActions: [
        {
            targetEntity: 'task',
            id: 'task-start',
            label: 'Start',
            icon: '▶️',
            intent: 'warning',
            order: 10,
            match: (data) => data.status === 'open' && !(data.ticket_type || '').toLowerCase().includes('queue'),
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'active');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-close',
            label: (data) => (data.ticket_type || '').toLowerCase().includes('queue') ? 'Resolve' : 'Close',
            icon: '✅',
            intent: (data) => (data.ticket_type || '').toLowerCase().includes('queue') ? 'neutral' : 'success',
            order: 20,
            match: (data) => data.status !== 'closed' && data.status !== 'archived' && data.status !== 'template',
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'closed');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-convert',
            label: 'Convert Type',
            icon: '🔄',
            intent: 'highlight',
            order: 30,
            match: (data) => data.status !== 'closed' && data.status !== 'archived',
            onClick: (data, e) => {
                window.dispatchEvent(new CustomEvent('insetu:tracker:open-convert', { detail: { task: data } }));
            }
        },
        {
            targetEntity: 'task',
            id: 'task-hierarchy',
            label: 'Hierarchy',
            icon: '🌳',
            intent: 'neutral',
            order: 35,
            match: (data) => data.tier < 3 && data.status !== 'template',
            onClick: (data, e) => {
                window.dispatchEvent(new CustomEvent('insetu:tracker:open-hierarchy', { detail: { task: data } }));
            }
        },
        {
            targetEntity: 'task',
            id: 'task-focus',
            label: 'Focus',
            icon: '🎯',
            intent: 'highlight',
            order: 36,
            match: (data) => data.tier < 3 && data.status !== 'template',
            onClick: (data, e) => {
                window.inSetu.stores.Kanban.getState().setFocus(data.id);
            }
        },
        {
            targetEntity: 'task',
            id: 'task-new-child',
            label: 'New Child',
            icon: '➕',
            intent: 'primary',
            order: 40,
            match: (data) => data.tier < 3 && data.status !== 'closed' && data.status !== 'archived' && data.status !== 'template',
            onClick: (data, e) => {
                const nextTier = data.tier < 3 ? data.tier + 1 : 3;
                window.dispatchEvent(new CustomEvent('insetu:tracker:open-new-task', {
                    detail: {
                        activeTab: window.inSetu.stores.App.getState().activeTab,
                        prefill: { parentId: data.id, tier: nextTier, repo: data.repo }
                    }
                }));
            }
        },
        {
            targetEntity: 'task',
            id: 'task-reopen',
            label: 'Re-open',
            icon: '🔄',
            intent: 'highlight',
            order: 50,
            match: (data) => data.status === 'closed',
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'open');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-pause',
            label: 'Pause',
            icon: '⏸️',
            intent: 'neutral',
            order: 60,
            match: (data) => data.status === 'active' && !(data.ticket_type || '').toLowerCase().includes('queue'),
            asyncAction: async (data, e) => {
                await KanbanStore.getState().transitionTask(data, 'open');
            }
        },
        {
            targetEntity: 'task',
            id: 'task-spawn',
            label: 'Spawn Instance',
            icon: '🚀',
            intent: 'primary',
            order: 70,
            match: (data) => data.status === 'template',
            onClick: (data, e) => {
                window.dispatchEvent(new CustomEvent('insetu:tracker:open-spawn', { detail: { task: data } }));
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-tracker-modals"
        },
        {
            slot: "slots:global",
            component: "insetu-ext-tracker-settings"
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
    customEditors: [
        {
            match: (filepath) => filepath && filepath.includes('.tracker/'),
            onOpen: (filepath) => {
                if (window.inSetu.ui && window.inSetu.ui.closeFileModal) window.inSetu.ui.closeFileModal(true);

                const appState = AppStore.getState();
                const trackerState = KanbanStore.getState();
                const parentTabs = trackerState.parentTabs && trackerState.parentTabs.length > 0 
                    ? trackerState.parentTabs.map(t => t.id) 
                    : ['tasks'];

                if (!parentTabs.includes(appState.activeTab)) {
                    const targetParent = parentTabs[0];
                    const targetSub = trackerState.customViews && trackerState.customViews.length > 0 
                        ? trackerState.customViews[0].id 
                        : 'todos';
                    AppStore.getState().setActiveRoute(targetParent, targetSub);
                }

                window.inSetu.events.emit('insetu:tracker:open-edit-task', { filepath });
            }
        }
    ]
});

// --- HEADLESS EXTENSION STATE SYNCHRONIZATION ---
// Data fetching is managed defensively via lifecycle hooks (zone:tab-changed, zone:soft-refresh, connectedCallback)
// to prevent boot-time evaluation race conditions.