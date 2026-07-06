import {
    compileContexts,
    viewSourceFile,
    setContextManifest,
    getFlattenedBuckets
} from '../app.js';
import { AppStore } from '../store.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
const _getActiveWs = () => AppStore.getState().activeWorkspace || 'default';

const _safeParseLocalStorageSet = (key) => {
    try {
        const item = localStorage.getItem(key);
        return new Set(item ? JSON.parse(item) : ["ALL"]);
    } catch (e) {
        console.warn(`[Kanban Storage Safeguard] Resetting corrupted key: ${key}`);
        localStorage.setItem(key, JSON.stringify(["ALL"]));
        return new Set(["ALL"]);
    }
};
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export const KanbanStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            tasks: [],
            pinnedRepos: _safeParseLocalStorageSet(`insetu_task_pinned_repos_${_getActiveWs()}`),
            pinnedBuckets: _safeParseLocalStorageSet(`insetu_task_pinned_buckets_${_getActiveWs()}`),
            pinnedTags: _safeParseLocalStorageSet(`insetu_task_pinned_tags_${_getActiveWs()}`),
            reposExpanded: false,
            bucketsExpanded: {},
            tagsExpanded: false,
            newTaskForm: { repo: '', type: 'todo', status: 'open', bucket: 'None', title: '', tags: '', desc: '' },
            editTaskForm: { filepath: '', title: '', tagsRaw: '', bucket: 'None', desc: '', origYaml: '' },
            trackerConfigForm: { domainStrat: 'default', customVal: '' },
            setNewTaskField: (field, value) => set((state) => ({ newTaskForm: { ...state.newTaskForm, [field]: value } })),
            setEditTaskField: (field, value) => set((state) => ({ editTaskForm: { ...state.editTaskForm, [field]: value } })),
            setTrackerConfigField: (field, value) => set((state) => ({ trackerConfigForm: { ...state.trackerConfigForm, [field]: value } })),
            resetState: () => set({ tasks: [] })
        })),
        { name: 'KanbanStore' }
    )
);

window.inSetu.stores.Kanban = KanbanStore;

if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes('tracker')) {
    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
            window.inSetu.extensions.Registry.registerUIHook('zone:file-edit-override', (filepath) => {
                if (filepath.includes('.tracker/')) {
                    document.getElementById('file-modal').style.display = 'none';
                    if (window.openEditTaskModal) window.openEditTaskModal(filepath);

                    return true;
                }
                return false;
            });
            window.inSetu.extensions.Registry.registerUIHook('zone:post-file-save', (filepath) => {
                if (filepath.includes('.tracker/') && window.loadTrackerBoard) window.loadTrackerBoard();
                return false;
            });
        }
        const tasksScreen = window.inSetu.extensions.Registry.registerTab('tasks', 'Tasks', 'tracker');
        if (tasksScreen) {
        const subTabBar = document.createElement('div');
        subTabBar.className = 'sub-tabs-bar';
        subTabBar.innerHTML = `
            <div class="sub-tabs">
                <div class="sub-tab active" id="st-todos" onclick="switchSubTab('todos')">To-Dos</div>
                <div class="sub-tab" id="st-bugs" onclick="switchSubTab('bugs')">Bugs</div>
                <div class="sub-tab" id="st-queue" onclick="switchSubTab('queue')">Queue</div>
                <div class="sub-tab" id="st-log" onclick="switchSubTab('log')">Log</div>
            </div>
<button class="btn-sm" style="background: var(--intent-highlight); margin: 0; white-space: nowrap; padding: 4px 12px; font-size: 0.9rem;"
onclick="openNewTaskModal()">+ New</button>
`;
tasksScreen.parentElement.insertBefore(subTabBar, tasksScreen);

tasksScreen.style.minHeight = '80dvh';
tasksScreen.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
                <div id="task-repo-pins" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;"></div>
            </div>
            <div id="sub-todos" class="sub-tab-content active">
                <div class="board-columns">
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0;">Open</h3>
                        <div id="todos-open-list"></div>
                    </div>
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0;">Active</h3>
                        <div id="todos-active-list"></div>
                    </div>
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0; color: var(--intent-success);">Closed</h3>
                        <div id="todos-closed-list"></div>
                    </div>
                </div>
            </div>
            <div id="sub-bugs" class="sub-tab-content">
                <div class="board-columns">
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0;">Open</h3>
                        <div id="bugs-open-list"></div>
                    </div>
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0;">Active</h3>
                        <div id="bugs-active-list"></div>
                    </div>
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0; color: var(--intent-success);">Closed</h3>
                        <div id="bugs-closed-list"></div>
                    </div>
                </div>
            </div>
            <div id="sub-queue" class="sub-tab-content">
                <div class="board-columns">
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0;">Open (Research Queue)</h3>
                        <div id="queue-open-list"></div>
                    </div>
                    <div style="flex: 1; min-width: 250px; background: var(--input-bg); padding: 10px; border-radius: 6px;">
                        <h3 style="margin-top: 0; color: var(--intent-success);">Closed (Resolved)</h3>
                        <div id="queue-closed-list"></div>
                    </div>
                </div>
            </div>
            <div id="sub-log" class="sub-tab-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: var(--text-muted);">Changelog Logs</h3>
                    <button id="btn-generate-changelog" class="btn-sm" style="background: var(--intent-highlight); margin: 0;" onclick="generateHistoricalChangelog()">📜 Generate Multi-Repo Changelog</button>
                </div>

                <h4 class="category-heading" style="margin-top: 10px; margin-bottom: 10px;">Recently Closed</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px; font-style: italic;">(logs not yet archived)</p>
                <div id="todos-recently-closed-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;"></div>

                <h4 class="category-heading" style="margin-top: 20px; margin-bottom: 10px;">Archived Tickets</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">(Historical context preserved on disk)</p>
                <div id="log-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
        `;
        }
    }
function renderTaskRepoPins(state) {
    const container = document.getElementById('task-repo-pins');
    if (!container) return;

    const { allRepos } = AppStore.getState();

    window.inSetu.ui.Factory.createNestedRepoFilters({
        container: container,
        repos: allRepos,
        activeRepos: state.pinnedRepos,
        reposExpanded: state.reposExpanded,
        onRepoChange: (newSet) => {
            localStorage.setItem(`insetu_task_pinned_repos_${_getActiveWs()}`, JSON.stringify(Array.from(newSet)));
            KanbanStore.setState({ pinnedRepos: newSet, reposExpanded: false });
        },
        onRepoExpandToggle: () => KanbanStore.setState({ reposExpanded: !state.reposExpanded }),
        enableBuckets: true,
        activeBuckets: state.pinnedBuckets,
        bucketsExpandedMap: state.bucketsExpanded,
        getBucketsFn: getFlattenedBuckets,
        onBucketChange: (newSet, repo) => {
            localStorage.setItem(`insetu_task_pinned_buckets_${_getActiveWs()}`, JSON.stringify(Array.from(newSet)));
            const newB = { ...state.bucketsExpanded };
            newB[repo] = false;
            KanbanStore.setState({ pinnedBuckets: newSet, bucketsExpanded: newB });
        },
        onBucketExpandToggle: (repo, newState) => {
            const newB = { ...state.bucketsExpanded };
            newB[repo] = newState;
            KanbanStore.setState({ bucketsExpanded: newB });
        }
    });

    // Update Changelog Button text
    const logBtn = document.getElementById('btn-generate-changelog');
    if (logBtn) {
        const isMulti = state.pinnedRepos.has('ALL') || state.pinnedRepos.size > 1;
        logBtn.innerText = isMulti ? "📜 Generate Multi-Repo Changelog" : "📜 Generate Repo Changelog";
    }
}
export async function loadTrackerBoard() {
    if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('tracker')) return;
    // Silently sync the ecosystem to ensure the board is perfectly up-to-date
    await compileContexts();
    // Refresh the context manifest for the Context/Download tabs
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
    if (mRes.ok) setContextManifest(await mRes.json());
    // Read directly from the rapid SQLite index instead of opening physical markdown files via regex
    const tRes = await fetch('/api/tracker/files?t=' + Date.now());
    if (tRes.ok) {
        const data = await tRes.json();
        KanbanStore.setState({ tasks: data.tasks || [] });
    }
}
// renderTaskBucketPins is deprecated; logic absorbed by createNestedRepoFilters
function renderTaskTagPins(state) {
    const repoContainer = document.getElementById('task-repo-pins');
    const container = document.getElementById('task-tag-pins') || (function() {
        const c = document.createElement('div');
        c.id = 'task-tag-pins';
        c.style.marginTop = '10px';
        if (repoContainer && repoContainer.parentNode) repoContainer.parentNode.insertBefore(c, repoContainer.nextSibling);
        return c;
    })();

    if (!container) return;
    container.replaceChildren();
    const allTags = new Set();
    state.tasks.forEach(t => {
        const matchesRepo = state.pinnedRepos.has('ALL') || state.pinnedRepos.has(t.repo);
        const matchesBucket = state.pinnedBuckets.has('ALL') || state.pinnedBuckets.has(t.subBucket);
        if (matchesRepo && matchesBucket && t.tags) {
            t.tags.forEach(tag => allTags.add(tag));
        }
    });

    if (allTags.size === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.flexWrap = 'wrap';
    container.style.gap = '6px';

    const lbl = document.createElement('span');
    lbl.innerText = "🏷️ Tags:";
    lbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap; cursor: pointer;";
    lbl.onclick = () => KanbanStore.setState({ tagsExpanded: !state.tagsExpanded });
    container.appendChild(lbl);
    const createPill = (id, label, forceVisible = false) => {
        const isVisible = forceVisible || state.pinnedTags.has(id) || state.tagsExpanded;
        return window.inSetu.ui.Factory.createFilterPill({
            id: id,
            label: label,
            activeSet: state.pinnedTags,
            isVisible: isVisible,
            onChange: (newSet, changedId, wasActive) => {
                if (wasActive && !state.tagsExpanded) {
                    KanbanStore.setState({ tagsExpanded: true });
                } else {
                    localStorage.setItem(`insetu_task_pinned_tags_${_getActiveWs()}`, JSON.stringify(Array.from(newSet)));
                    KanbanStore.setState({ pinnedTags: newSet, tagsExpanded: false });
                }
            }
        });
    };

    const allPill = createPill("ALL", "All", true);
    if (allPill) container.appendChild(allPill);
    Array.from(allTags).sort().forEach(tag => {
        const p = createPill(tag, `#${tag}`);
        if (p) container.appendChild(p);
    });
}
function renderTrackerBoard(state) {
    const targetLists = {
        'log-list': [],                  // Archived Tickets
        'todos-recently-closed-list': [], // Recently Closed
        'todos-open-list': [],
        'todos-active-list': [],
        'todos-closed-list': [],
        'bugs-open-list': [],
        'bugs-active-list': [],
        'bugs-closed-list': [],
        'queue-open-list': [],
        'queue-closed-list': []
    };
    // Flush all container elements cleanly before populating
    Object.keys(targetLists).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.replaceChildren();
    });
    const filtered = state.tasks.filter(t => {
        const matchesRepo = state.pinnedRepos.has('ALL') || state.pinnedRepos.has(t.repo);
        const matchesBucket = state.pinnedBuckets.has('ALL') || state.pinnedBuckets.has(t.subBucket);
        const matchesTag = state.pinnedTags.has('ALL') || (t.tags && t.tags.some(tag => state.pinnedTags.has(tag)));
        return matchesRepo && matchesBucket && matchesTag;
    });

    // Populate target column buckets
    filtered.forEach(t => {
        if (t.status === 'archived') {
            targetLists['log-list'].push(t);
            return;
        }
        if (t.status === 'closed' || t.status === 'logged') {
            targetLists['todos-recently-closed-list'].push(t);
        }
const containerId = (() => {
    if (t.isTodo && t.status === 'open') return 'todos-open-list';
    if (t.isTodo && t.status === 'active') return 'todos-active-list';
    if (t.isTodo && t.status === 'closed') return 'todos-closed-list';
    if (t.isBug && t.status === 'open') return 'bugs-open-list';
    if (t.isBug && t.status === 'active') return 'bugs-active-list';
    if (t.isBug && t.status === 'closed') return 'bugs-closed-list';
    if (t.isQueue && t.status === 'open') return 'queue-open-list';
    if (t.isQueue && t.status === 'closed') return 'queue-closed-list';
    return null;
})();
if (containerId) targetLists[containerId].push(t);
    });

    // Sort active backlogs oldest-first so debt doesn't get buried
    ['todos-open-list', 'todos-active-list', 'bugs-open-list', 'bugs-active-list', 'queue-open-list'].forEach(id => {
        targetLists[id].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    });

    // Sort the completed columns descending by close timestamp
    ['log-list', 'todos-recently-closed-list', 'todos-closed-list', 'bugs-closed-list', 'queue-closed-list'].forEach(id => {
        targetLists[id].sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));
    });

    // Batch render to DOM via document fragments
    Object.entries(targetLists).forEach(([id, tasks]) => {
        const container = document.getElementById(id);
        if (container) {
            const frag = document.createDocumentFragment();
            tasks.forEach(t => createTaskCard(t, frag));
            container.appendChild(frag);
        }
    });
}
function createTaskCard(task, container) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.taskId = task.id;
    card.style.marginBottom = '10px';
    const header = document.createElement('div');
    header.className = 'file-card-header';
    const titleLink = document.createElement('a');
    titleLink.className = `file-title ${task.isBug ? 'task-bug' : task.isQueue ? 'task-queue' : 'task-todo'}`;
    titleLink.innerText = task.title;
    titleLink.style.cursor = 'pointer';
    titleLink.style.textDecoration = 'none';
    titleLink.onclick = (e) => {
        e.preventDefault();
        viewSourceFile(task.filepath, true);
    };
    header.appendChild(titleLink);
    const desc = document.createElement('div');
    desc.className = 'file-desc';
    desc.style.fontSize = '0.75rem';
    const shortDate = task.timestamp ? task.timestamp.split('T')[0] : 'Unknown Date';
    const bucketStr = (task.subBucket && task.subBucket !== 'None') ? ` | 🗂️ ${task.subBucket}` : '';
    const statusStr = (task.status !== 'closed') ? ` | ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}` : '';
    const descText = `${task.repo}${bucketStr}${statusStr} | ${shortDate}`;
    desc.innerText = descText;
    if (task.tags && task.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.marginTop = '6px';
        tagsDiv.style.display = 'flex';
        tagsDiv.style.flexWrap = 'wrap';
        tagsDiv.style.gap = '4px';
        task.tags.forEach(t => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'task-tag';
            tagSpan.innerText = `#${t}`;

            tagsDiv.appendChild(tagSpan);
        });
        desc.appendChild(tagsDiv);
    }
    const actions = document.createElement('div');
    actions.className = 'file-actions';
    actions.style.marginTop = '10px';

    if (task.status === 'open' && !task.isQueue) {
        const startBtn = document.createElement('button');
        startBtn.className = 'btn-sm';
        startBtn.style.background = 'var(--intent-warning)';
        startBtn.innerText = '▶️ Start';
        startBtn.onclick = () => transitionTask(task, 'active');
        actions.appendChild(startBtn);
    }

    if (task.status === 'active') {
        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'btn-sm';
        pauseBtn.style.background = 'var(--intent-neutral)';
        pauseBtn.innerText = '⏸️ Pause';
        pauseBtn.onclick = () => transitionTask(task, 'open');
        actions.appendChild(pauseBtn);
    }
    if (task.status !== 'closed' && task.status !== 'archived') {
        if (task.isQueue) {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'btn-sm';
            acceptBtn.style.background = 'var(--intent-success)';
            acceptBtn.innerText = '✅ Accept';
            acceptBtn.onclick = () => transitionTask(task, 'open', 'todo');
            actions.appendChild(acceptBtn);
            const archiveBtn = document.createElement('button');
            archiveBtn.className = 'btn-sm';
            archiveBtn.style.background = 'var(--intent-neutral)';
            archiveBtn.innerText = '✅ Resolve';
            archiveBtn.onclick = () => transitionTask(task, 'closed');
            actions.appendChild(archiveBtn);
        } else {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-sm';
            closeBtn.style.background = 'var(--intent-success)';
            closeBtn.innerText = '✅ Close';
            closeBtn.onclick = () => transitionTask(task, 'closed');
            actions.appendChild(closeBtn);
        }
    } else if (task.status === 'closed') {
        const reopenBtn = document.createElement('button');
        reopenBtn.className = 'btn-sm';
        reopenBtn.style.background = 'var(--intent-highlight)';
        reopenBtn.innerText = '🔄 Re-open';
        reopenBtn.onclick = () => transitionTask(task, 'open');
        actions.appendChild(reopenBtn);
    }

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(actions);
    container.appendChild(card);
}
async function transitionTask(task, newStatus, newType = null) {
    try {


        const res = await fetch('/api/tracker/transition', {

            method: 'POST',


            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                repo: task.repo,
                filepath: task.filepath,
                new_status: newStatus,
                new_type: newType
            })


        });
        if (res.ok) {
            // Surgical DOM Reconciliation
            const cardNode = document.querySelector(`[data-task-id="${task.id}"]`);
            if (cardNode) cardNode.remove();

            // Mutate state in-place to update truth without triggering Zustand's global re-render check
            const stateTask = KanbanStore.getState().tasks.find(t => t.id === task.id);
            if (stateTask) {
                stateTask.status = newStatus;
                if (newType) {
                    stateTask.ticket_type = newType;
                    stateTask.isTodo = newType === 'todo';
                    stateTask.isBug = newType === 'bug';
                    stateTask.isQueue = newType === 'queue';
                }
                const containerId = (stateTask.status === 'archived') ? 'log-list' :
                                    (stateTask.status === 'logged') ? 'todos-recently-closed-list' :
                                    (stateTask.isTodo && stateTask.status === 'open') ? 'todos-open-list' :
                                    (stateTask.isTodo && stateTask.status === 'active') ? 'todos-active-list' :
                                    (stateTask.isTodo && stateTask.status === 'closed') ? 'todos-closed-list' :
                                    (stateTask.isBug && stateTask.status === 'open') ? 'bugs-open-list' :
                                    (stateTask.isBug && stateTask.status === 'active') ? 'bugs-active-list' :
                                    (stateTask.isBug && stateTask.status === 'closed') ? 'bugs-closed-list' :
                                    (stateTask.isQueue && stateTask.status === 'open') ? 'queue-open-list' :
                                    (stateTask.isQueue && stateTask.status === 'closed') ? 'queue-closed-list' : null;
                const newContainer = document.getElementById(containerId);
                if (newContainer) createTaskCard(stateTask, newContainer);
            }
        } else {
            alert("Failed to transition task.");
        }
    } catch (e) {
        alert("Network error");
    }
}
function openNewTaskModal() {
    const { allRepos } = AppStore.getState();
    const repoOptions = allRepos.map(repo => `<option value="${repo}">${repo}</option>`).join('');

    const isBugs = document.querySelector('#st-bugs.active');
    const isQueue = document.querySelector('#st-queue.active');
    const defaultType = isBugs ? 'bug' : (isQueue ? 'queue' : 'todo');

    const state = KanbanStore.getState();
    const prePopulatedTags = Array.from(state.pinnedTags).filter(t => t !== 'ALL');
    const defaultTagsStr = prePopulatedTags.join(', ');

    state.setNewTaskField('type', defaultType);
    state.setNewTaskField('tags', defaultTagsStr);
    state.setNewTaskField('title', '');
    state.setNewTaskField('desc', '');
    state.setNewTaskField('status', 'open');
    state.setNewTaskField('bucket', 'None');
    if (allRepos.length > 0) state.setNewTaskField('repo', allRepos[0]);

    const bodyHtml = `
    <div style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
        <select id="new-task-repo" style="flex: 1; min-width: 120px; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
onchange="KanbanStore.getState().setNewTaskField('repo', this.value); populateNewTaskBuckets()">
            ${repoOptions}
        </select>
        <select id="new-task-type" style="padding: 8px; flex: 1; min-width: 120px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" onchange="KanbanStore.getState().setNewTaskField('type', this.value)">
            <option value="todo" ${defaultType === 'todo' ? 'selected' : ''}>To-Do (Task)</option>
            <option value="bug" ${defaultType === 'bug' ? 'selected' : ''}>Bug</option>
            <option value="queue" ${defaultType === 'queue' ? 'selected' : ''}>Queue (Research)</option>
        </select>
        <select id="new-task-status" style="padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" onchange="KanbanStore.getState().setNewTaskField('status', this.value)">
            <option value="open">Open (Backlog)</option>
            <option value="active">Active (In Progress)</option>
        </select>
        <select id="new-task-bucket" style="padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" onchange="KanbanStore.getState().setNewTaskField('bucket', this.value)">
            <option value="None">No Bucket</option>
        </select>
    </div>
    <input type="text" id="new-task-title" placeholder="Ticket Title (e.g., Fix schema registry timeout)" style="margin-bottom: 10px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;" oninput="KanbanStore.getState().setNewTaskField('title', this.value)">
    <input type="text" id="new-task-tags" value="${defaultTagsStr}" placeholder="Tags (comma separated, e.g. frontend, critical)" style="margin-bottom: 10px; padding: 10px; width: 100%; box-sizing: border-box;" oninput="KanbanStore.getState().setNewTaskField('tags', this.value)">
    <textarea id="new-task-desc" style="flex: 1; margin-bottom: 10px; font-size: 13px; margin-top:0; min-height: 150px; width: 100%; box-sizing: border-box;" placeholder="Markdown description..." oninput="KanbanStore.getState().setNewTaskField('desc', this.value)"></textarea>
    `;

    window.inSetu.ui.Factory.createModal({
        id: 'new-task-modal',
        title: 'Create New Ticket',
        body: bodyHtml,
        actions: [
            { label: '💾 Create Ticket', style: 'primary', id: 'save-task-btn', onClick: async (e, modal) => {
                await saveNewTask(modal.id);
                return true;
            }}
        ]
    });

    const select = document.getElementById('new-task-repo');
    if (state.pinnedRepos.size === 1 && !state.pinnedRepos.has('ALL')) {
        const pinnedRepo = Array.from(state.pinnedRepos)[0];
        if (allRepos.includes(pinnedRepo) && select) select.value = pinnedRepo;
    }

    populateNewTaskBuckets();
}
function populateNewTaskBuckets() {
    const select = document.getElementById('new-task-bucket');
    if (!select) return;

    select.replaceChildren();
    const defOpt = document.createElement('option');
    defOpt.value = "None";
    defOpt.innerText = "No Bucket";
    select.appendChild(defOpt);

    const selectedRepo = KanbanStore.getState().newTaskForm.repo || document.getElementById('new-task-repo')?.value;
    if (!selectedRepo) return;
    const buckets = getFlattenedBuckets(selectedRepo);
    buckets.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.innerText = b.title;
        select.appendChild(opt);
    });

    KanbanStore.getState().setNewTaskField('bucket', 'None');
}
async function saveNewTask(modalId = 'new-task-modal') {
    const { repo, type, status, title, tags, desc, bucket } = KanbanStore.getState().newTaskForm;
    const sub_bucket = bucket || 'None';

    if (!title || !desc) {
        alert("Title and Description are required.");
        return;
    }

    const btn = document.getElementById('save-task-btn');
    if (btn) btn.innerText = "Creating...";

    try {
        const res = await fetch('/api/tracker/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo, type, status, title, tags, description: desc, sub_bucket })
        });

        if (res.ok) {
            if (window.inSetu.ui.Factory) window.inSetu.ui.Factory.closeModal(modalId);
            else document.getElementById(modalId).style.display = 'none';

            loadTrackerBoard();
        } else {
            alert("Failed to create task.");
        }
    } catch (e) {
        alert("Network error.");
    } finally {
        if (btn) btn.innerText = "💾 Create Ticket";
    }
}
async function openEditTaskModal(filepath) {
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filepath));
        if (!res.ok) throw new Error("Failed to load task file.");
        const content = await res.text();
        const repo = filepath.split('/')[0];
        const defaultTitle = filepath.split('/').pop();
        const yamlMatch = content.match(/^\s*---\n([\s\S]*?)\n\s*---/);
const { parsedTitle, parsedSubBucket, parsedTags } = (() => {
            if (!yamlMatch) return { parsedTitle: defaultTitle, parsedSubBucket: 'None', parsedTags: [] };

            return yamlMatch[1].split('\n').reduce((acc, l) => {
                if (l.startsWith('title:')) acc.parsedTitle = l.replace('title:', '').replace(/"/g, '').replace(/'/g, '').trim();
                if (l.startsWith('sub_bucket:')) acc.parsedSubBucket = l.replace('sub_bucket:', '').replace(/"/g, '').replace(/'/g, '').trim() || 'None';
                if (l.startsWith('tags:')) {
                    const rawTags = l.replace('tags:', '').trim();
                    const cleanTags = rawTags.startsWith('[') ? rawTags.replace(/^\[|\]$/g, '').split(',') : rawTags.split(',');
                    acc.parsedTags = cleanTags.map(t => t.trim().replace(/['"]/g, '')).filter(t => t);
                }
                return acc;
            }, { parsedTitle: defaultTitle, parsedSubBucket: 'None', parsedTags: [] });
})();

        const cleanTags = parsedTags.filter(t => t);

        const parsedDesc = (() => {
            if (!yamlMatch) return content;
            const stripped = content.replace(yamlMatch[0], '').trim();
            return stripped.startsWith('## Description') ? stripped.replace(/^## Description\n+/, '') : stripped;
        })();

        const safeTitle = parsedTitle.replace(/"/g, '&quot;');
        const safeTagsStr = cleanTags.join(', ').replace(/"/g, '&quot;');
        const safeYaml = yamlMatch ? yamlMatch[1].replace(/"/g, '&quot;') : '';

        // Hydrate the UDF store
        const state = KanbanStore.getState();
        state.setEditTaskField('filepath', filepath);
        state.setEditTaskField('title', parsedTitle);
        state.setEditTaskField('tagsRaw', cleanTags.join(', '));
        state.setEditTaskField('bucket', parsedSubBucket);
        state.setEditTaskField('desc', parsedDesc);
        state.setEditTaskField('origYaml', yamlMatch ? yamlMatch[1] : '');

        const bodyHtml = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <select id="edit-task-bucket" style="flex: 1; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" onchange="KanbanStore.getState().setEditTaskField('bucket', this.value)">
                <option value="None">No Bucket</option>
            </select>
        </div>
        <input type="text" id="edit-task-title" value="${safeTitle}" placeholder="Ticket Title" style="margin-bottom: 10px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;" oninput="KanbanStore.getState().setEditTaskField('title', this.value)">
        <input type="text" id="edit-task-tags" value="${safeTagsStr}" placeholder="Tags (comma separated)" style="margin-bottom: 10px; padding: 10px; width: 100%; box-sizing: border-box;" oninput="KanbanStore.getState().setEditTaskField('tagsRaw', this.value)">
        <textarea id="edit-task-desc" style="flex: 1; margin-bottom: 10px; font-size: 13px; margin-top:0; min-height: 150px; width: 100%; box-sizing: border-box;" placeholder="Markdown description..." oninput="KanbanStore.getState().setEditTaskField('desc', this.value)"></textarea>
        `;

        window.inSetu.ui.Factory.createModal({
            id: 'edit-task-modal',
            title: 'Edit Ticket Metadata',
            body: bodyHtml,
            actions: [
                { label: '💾 Save Changes', style: 'primary', id: 'save-edit-task-btn', onClick: async (e, modal) => {
                    await saveEditTask(modal.id);
                    return true;
                }}
            ]
        });
        // Re-hydrate the textarea explicitly to avoid any innerHTML quoting/encoding oddities with Markdown content
        const descEl = document.getElementById('edit-task-desc');
        if (descEl) descEl.value = parsedDesc.trim();

        const select = document.getElementById('edit-task-bucket');
        if (select) {
            const buckets = getFlattenedBuckets(repo);
            buckets.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.innerText = b.title;
                select.appendChild(opt);
            });
            select.value = parsedSubBucket;
        }

    } catch (e) {
        alert(e.message);
    }
}
async function saveEditTask(modalId = 'edit-task-modal') {
    const { filepath, title, tagsRaw, bucket, desc, origYaml } = KanbanStore.getState().editTaskForm;
    if (!title || !desc) {
        alert("Title and Description are required.");
        return;
    }

    const btn = document.getElementById('save-edit-task-btn');
    const origBtnText = btn ? btn.innerText : 'Save';
    if (btn) btn.innerText = "Saving...";
    const lines = origYaml.split('\n');

    const analysis = lines.reduce((acc, l) => {
        if (l.startsWith('title:')) {
            acc.newLines.push(`title: "${title.replace(/"/g, "'")}"`);
        } else if (l.startsWith('tags:')) {
            const tagsArr = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
            acc.newLines.push(tagsArr.length > 0 ? `tags: [${tagsArr.join(', ')}]` : `tags: []`);
            acc.hasTags = true;
        } else if (l.startsWith('sub_bucket:')) {
            acc.newLines.push(`sub_bucket: "${bucket}"`);
            acc.hasBucket = true;
        } else {
            acc.newLines.push(l);
        }
        return acc;
    }, { newLines: [], hasTags: false, hasBucket: false });

    if (!analysis.hasTags && tagsRaw.trim()) {
        const tagsArr = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
        analysis.newLines.push(`tags: [${tagsArr.join(', ')}]`);
    }
    if (!analysis.hasBucket) {
        analysis.newLines.push(`sub_bucket: "${bucket}"`);
    }

    const newLines = analysis.newLines;
    const newContent = `---\n${newLines.join('\n')}\n---\n\n## Description\n${desc}\n`;
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/fs/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: filepath, content: newContent })
        });
        if (res.ok) {
            if (window.inSetu.ui.Factory) window.inSetu.ui.Factory.closeModal(modalId);
            else document.getElementById(modalId).style.display = 'none';

            loadTrackerBoard();
        } else {
            alert("Failed to save changes.");
        }
    } catch (e) {
        alert("Network error.");
    } finally {
        if (btn) btn.innerText = origBtnText;
    }
}
export function generateHistoricalChangelog() {
    const state = KanbanStore.getState();
    const closedTasks = state.tasks.filter(t => {
        const isClosed = t.status === 'closed' || t.status === 'archived' || t.status === 'logged';
        const matchesRepo = state.pinnedRepos.has('ALL') || state.pinnedRepos.has(t.repo);
        return isClosed && matchesRepo;
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
// Window Bindings
window.KanbanStore = KanbanStore;
window.generateHistoricalChangelog = generateHistoricalChangelog;
window.openNewTaskModal = openNewTaskModal;
window.saveNewTask = saveNewTask;
window.saveEditTask = saveEditTask;
window.openEditTaskModal = openEditTaskModal;
window.renderTaskRepoPins = () => renderTaskRepoPins(KanbanStore.getState());
window.loadTrackerBoard = loadTrackerBoard;

// Sync explicitly to dynamic multi-tenant topology updates
AppStore.subscribe((state) => state.allRepos, renderAll);
AppStore.subscribe((state) => state.targetConfigs, renderAll);
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
        if (tabId === 'tasks') loadTrackerBoard();
    });

    window.inSetu.extensions.Registry.registerUIHook('zone:soft-refresh', (ws) => {
        KanbanStore.setState({ 
            tasks: [],
            pinnedRepos: _safeParseLocalStorageSet(`insetu_task_pinned_repos_${ws}`),
            pinnedBuckets: _safeParseLocalStorageSet(`insetu_task_pinned_buckets_${ws}`),
            pinnedTags: _safeParseLocalStorageSet(`insetu_task_pinned_tags_${ws}`)
        });
        return false;
    });
}
// Bind UI strictly to state updates via Selectors
function renderAll() {
    if (!document.getElementById('task-repo-pins')) return; // Board not mounted yet
    const state = KanbanStore.getState();
    renderTaskRepoPins(state);
    renderTaskTagPins(state);
    renderTrackerBoard(state);
};
KanbanStore.subscribe((state) => state.pinnedRepos, renderAll);
KanbanStore.subscribe((state) => state.pinnedBuckets, renderAll);
KanbanStore.subscribe((state) => state.pinnedTags, renderAll);
KanbanStore.subscribe((state) => state.tasks, renderAll);
KanbanStore.subscribe((state) => state.reposExpanded, renderAll);
KanbanStore.subscribe((state) => state.bucketsExpanded, renderAll);
KanbanStore.subscribe((state) => state.tagsExpanded, renderAll);
// Zustand doesn't fire an initial blast, trigger manually once
setTimeout(renderAll, 100);

// --- TRACKER SETTINGS CONFIGURATION ---
async function openTrackerConfigModal() {
    try {
        const res = await fetch('/api/system/config');
        if (!res.ok) throw new Error("Failed to fetch config");
        const config = await res.json();
const trackerCfg = (config.extension_config && config.extension_config.tracker) ? config.extension_config.tracker : {};

KanbanStore.getState().setTrackerConfigField('domainStrat', trackerCfg.domain_strategy || 'default');
KanbanStore.getState().setTrackerConfigField('customVal', trackerCfg.domain_custom_value || '');

const state = KanbanStore.getState().trackerConfigForm;

const bodyHtml = `
        <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                <label style="font-weight: bold; margin-bottom: 5px; display: block; color: var(--text);">Tracker Context Domain Strategy</label>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">How should issue tracker context files be grouped in the Gather UI?</p>

                <select id="tracker-domain-strat" style="width: 100%; padding: 8px; margin-bottom: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
                onchange="document.getElementById('tracker-custom-wrap').style.display = this.value === 'custom' ? 'block' : 'none'; KanbanStore.getState().setTrackerConfigField('domainStrat', this.value);">
                        <option value="default" ${state.domainStrat === 'default' ? 'selected' : ''}>Default (Bundle all trackers together)</option>
                        <option value="repo" ${state.domainStrat === 'repo' ? 'selected' : ''}>Repo-based (Use parent repo's domain)</option>
                        <option value="custom" ${state.domainStrat === 'custom' ? 'selected' : ''}>Custom Domain...</option>
                </select>
                <div id="tracker-custom-wrap" style="display: ${state.domainStrat === 'custom' ? 'block' : 'none'};">
                        <input type="text" id="tracker-custom-val" value="${state.customVal}" placeholder="e.g. Project Management" style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; box-sizing: border-box;" oninput="KanbanStore.getState().setTrackerConfigField('customVal', this.value)">

                </div>
        </div>
`;
window.inSetu.ui.Factory.createModal({
        id: 'tracker-config-modal',
        title: 'Tracker Settings',
        body: bodyHtml,
        actions: [
                { label: '💾 Save Settings', style: 'primary', onClick: async (e, modal) => {
                        const { domainStrat, customVal } = KanbanStore.getState().trackerConfigForm;
                        const newStrat = domainStrat;
                        const newVal = customVal.trim();
                    if (!config.extension_config) config.extension_config = {};
                    if (!config.extension_config.tracker) config.extension_config.tracker = {};
                    config.extension_config.tracker.domain_strategy = newStrat;
                    config.extension_config.tracker.domain_custom_value = newVal;

                    const btn = e.target;
                    const origText = btn.innerText;
                    btn.innerText = "⏳ Saving...";
                    try {
                        const saveRes = await fetch('/api/system/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(config)
                        });
                        if (saveRes.ok) {
                            window.inSetu.ui.Factory.closeModal(modal.id);
                            if (window.compileContexts) window.compileContexts();
                        } else {
                            alert("Failed to save.");
                        }
                    } catch (err) {
                        alert("Network error.");
                    } finally {
                        btn.innerText = origText;
                    }
                    return true;
                }}
            ]
        });
    } catch (e) {
        alert("Failed to load configuration.");
    }
}

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerSettingsAction) {
    window.inSetu.extensions.Registry.registerSettingsAction('tracker_config', 'Tracker Settings', '📋', openTrackerConfigModal);
}
