import {
    compileContexts,
    viewSourceFile,
    setContextManifest,
    getFlattenedBuckets
} from './app.js';
import { AppStore } from './store.js';
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

export const KanbanStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            tasks: [],
            pinnedRepos: _safeParseLocalStorageSet(`insetu_task_pinned_repos_${_getActiveWs()}`),
            pinnedBuckets: _safeParseLocalStorageSet(`insetu_task_pinned_buckets_${_getActiveWs()}`),
            pinnedTags: _safeParseLocalStorageSet(`insetu_task_pinned_tags_${_getActiveWs()}`),
            reposExpanded: false,

            bucketsExpanded: {},
            tagsExpanded: false
        })),
        { name: 'KanbanStore' }
    )
);

if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes('tracker')) {
    if (window.ExtensionRegistry && window.ExtensionRegistry.registerUIHook) {
            window.ExtensionRegistry.registerUIHook('zone:file-edit-override', (filepath) => {
                if (filepath.includes('.tracker/')) {
                    document.getElementById('file-modal').style.display = 'none';
                    if (window.openEditTaskModal) window.openEditTaskModal(filepath);

                    return true;
                }
                return false;
            });
            window.ExtensionRegistry.registerUIHook('zone:post-file-save', (filepath) => {
                if (filepath.includes('.tracker/') && window.loadTrackerBoard) window.loadTrackerBoard();
                return false;
            });
        }

        const tasksScreen = window.ExtensionRegistry.registerTab('tasks', 'Tasks');
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
            <button class="btn-sm" style="background: #8b5cf6; margin: 0; white-space: nowrap; padding: 4px 12px; font-size: 0.9rem;" onclick="openNewTaskModal()">+ New</button>
        `;
        tasksScreen.parentElement.insertBefore(subTabBar, tasksScreen);

        tasksScreen.style.minHeight = '80vh';
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
                        <h3 style="margin-top: 0; color: #10b981;">Closed</h3>
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
                        <h3 style="margin-top: 0; color: #10b981;">Closed</h3>
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
                        <h3 style="margin-top: 0; color: #10b981;">Closed (Resolved)</h3>
                        <div id="queue-closed-list"></div>
                    </div>
                </div>
            </div>
            <div id="sub-log" class="sub-tab-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #888;">Changelog Logs</h3>
                    <button id="btn-generate-changelog" class="btn-sm" style="background: #8b5cf6; margin: 0;" onclick="generateHistoricalChangelog()">📜 Generate Multi-Repo Changelog</button>
                </div>

                <h4 class="category-heading" style="margin-top: 10px; margin-bottom: 10px;">Recently Closed</h4>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0; margin-bottom: 10px; font-style: italic;">(logs not yet archived)</p>
                <div id="todos-recently-closed-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;"></div>

                <h4 class="category-heading" style="margin-top: 20px; margin-bottom: 10px;">Archived Tickets</h4>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0; margin-bottom: 10px;">(Historical context preserved on disk)</p>
                <div id="log-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
        `;
        }
    }

function renderTaskRepoPins(state) {
    const container = document.getElementById('task-repo-pins');
    if (!container) return;
    container.innerHTML = '';

    const { allRepos, targetConfigs } = AppStore.getState();

    // -- REPOS --
    const repoWrap = document.createElement('div');
    repoWrap.style.cssText = "display: flex; align-items: center; flex-wrap: wrap; gap: 6px;";

    const rLbl = document.createElement('span');
    rLbl.innerText = "📌 Repos:";
    rLbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap; cursor: pointer;";
    rLbl.onclick = () => KanbanStore.setState({ reposExpanded: !state.reposExpanded });
    repoWrap.appendChild(rLbl);

    const createRepoPill = (id, label) => {
        const isActive = state.pinnedRepos.has(id);
        if (!isActive && !state.reposExpanded) return null; // Hide unselected if collapsed

        const btn = document.createElement('button');
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = label;
        btn.style.cssText = `padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;

        btn.onclick = () => {
            if (isActive) {
                // If clicking an already active pill, toggle expansion
                KanbanStore.setState({ reposExpanded: !state.reposExpanded });
            } else {
                // If clicking a new pill, select it and collapse
                const newPins = new Set(state.pinnedRepos);
                if (id === "ALL") {
                    newPins.clear();
                    newPins.add("ALL");
                } else {
                    newPins.delete("ALL");
                    newPins.add(id);
                }
                localStorage.setItem(`insetu_task_pinned_repos_${_getActiveWs()}`, JSON.stringify(Array.from(newPins)));
                KanbanStore.setState({ pinnedRepos: newPins, reposExpanded: false });
            }
        };
        return btn;
    };

    const allPill = createRepoPill("ALL", "All");
    if (allPill) repoWrap.appendChild(allPill);
    allRepos.forEach(repo => {
        const p = createRepoPill(repo, repo);
        if (p) repoWrap.appendChild(p);

        // If this repo is active, render its buckets right next to it
        if (state.pinnedRepos.has(repo) && repo !== "ALL") {
            const buckets = getFlattenedBuckets(repo);
            if (buckets.length > 0 && buckets.some(b => b.id !== 'tracker' && b.original.id !== 'tracker')) {
                const bWrap = document.createElement('span');
                bWrap.style.cssText = "display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; background: var(--input-bg); padding: 4px; border-radius: 6px; border: 1px solid var(--border); margin-left: 2px;";

                const bLbl = document.createElement('span');
                bLbl.innerText = "🗂️";
                bLbl.style.cssText = "font-size: 0.75rem; margin-right: 2px; cursor: pointer;";
                const isBExpanded = state.bucketsExpanded[repo] || false;
                bLbl.onclick = () => {
                    const newB = { ...state.bucketsExpanded };
                    newB[repo] = !isBExpanded;
                    KanbanStore.setState({ bucketsExpanded: newB });
                };
                bWrap.appendChild(bLbl);

                const createBucketPill = (bId, bLabel) => {
                    const isActive = state.pinnedBuckets.has(bId);
                    if (!isActive && !isBExpanded) return null;

                    const bBtn = document.createElement('button');
                    bBtn.className = isActive ? 'repo-pill active' : 'repo-pill';
                    bBtn.innerText = bLabel;
                    bBtn.style.cssText = `padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;
                    bBtn.onclick = () => {
                        if (isActive) {
                            const newB = { ...state.bucketsExpanded };
                            newB[repo] = !isBExpanded;
                            KanbanStore.setState({ bucketsExpanded: newB });
                        } else {
                            const newPins = new Set(state.pinnedBuckets);
                            if (bId === "ALL") {
                                newPins.clear();
                                newPins.add("ALL");
                            } else {
                                newPins.delete("ALL");
                                newPins.add(bId);
                            }
                            localStorage.setItem(`insetu_task_pinned_buckets_${_getActiveWs()}`, JSON.stringify(Array.from(newPins)));
                            const newB = { ...state.bucketsExpanded };
                            newB[repo] = false;
                            KanbanStore.setState({ pinnedBuckets: newPins, bucketsExpanded: newB });
                        }
                    };
                    return bBtn;
                };

                const bAll = createBucketPill("ALL", "All");
                if (bAll) bWrap.appendChild(bAll);
                buckets.forEach(b => {
                    if (b.id === 'tracker' || b.original.id === 'tracker') return;
                    const bp = createBucketPill(b.id, b.title);
                    if (bp) bWrap.appendChild(bp);
                });
                repoWrap.appendChild(bWrap);
            }
        }
    });

    container.appendChild(repoWrap);

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
function renderTaskBucketPins(state) {
    // Deprecated: Buckets are now nested directly inside the renderTaskRepoPins component layout
    const oldContainer = document.getElementById('task-bucket-pins');
    if (oldContainer) oldContainer.remove();
}

function renderTaskTagPins(state) {
    let container = document.getElementById('task-tag-pins');
    if (!container) {
        const repoContainer = document.getElementById('task-repo-pins');
        container = document.createElement('div');
        container.id = 'task-tag-pins';
        container.style.marginTop = '10px';
        repoContainer.parentNode.insertBefore(container, repoContainer.nextSibling);
    }
    container.innerHTML = '';
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

    const createPill = (id, label) => {
        const isActive = state.pinnedTags.has(id);
        if (!isActive && !state.tagsExpanded) return null;

        const btn = document.createElement('button');
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = label;
        btn.style.cssText = `padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;

        btn.onclick = () => {
            if (isActive) {
                KanbanStore.setState({ tagsExpanded: !state.tagsExpanded });
            } else {
                const newPins = new Set(state.pinnedTags);
                if (id === "ALL") {
                    newPins.clear();
                    newPins.add("ALL");
                } else {
                    newPins.delete("ALL");
                    newPins.add(id);
                }
                localStorage.setItem(`insetu_task_pinned_tags_${_getActiveWs()}`, JSON.stringify(Array.from(newPins)));
                KanbanStore.setState({ pinnedTags: newPins, tagsExpanded: false });
            }
        };
        return btn;
    };

    const allPill = createPill("ALL", "All");
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
        if (el) el.innerHTML = '';
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

        let containerId = null;
        if (t.isTodo && t.status === 'open') containerId = 'todos-open-list';
        else if (t.isTodo && t.status === 'active') containerId = 'todos-active-list';
        else if (t.isTodo && t.status === 'closed') containerId = 'todos-closed-list';
        else if (t.isBug && t.status === 'open') containerId = 'bugs-open-list';
        else if (t.isBug && t.status === 'active') containerId = 'bugs-active-list';
        else if (t.isBug && t.status === 'closed') containerId = 'bugs-closed-list';
        else if (t.isQueue && t.status === 'open') containerId = 'queue-open-list';
        else if (t.isQueue && t.status === 'closed') containerId = 'queue-closed-list';

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
    let descText = task.repo;
    if (task.subBucket && task.subBucket !== 'None') descText += ` | 🗂️ ${task.subBucket}`;
    if (task.status !== 'closed') descText += ` |
${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`;
    descText += ` | ${shortDate}`;
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
        startBtn.style.background = '#f59e0b';
        startBtn.innerText = '▶️ Start';
        startBtn.onclick = () => transitionTask(task, 'active');
        actions.appendChild(startBtn);
    }

    if (task.status === 'active') {
        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'btn-sm';
        pauseBtn.style.background = '#64748b';
        pauseBtn.innerText = '⏸️ Pause';
        pauseBtn.onclick = () => transitionTask(task, 'open');
        actions.appendChild(pauseBtn);
    }
    if (task.status !== 'closed' && task.status !== 'archived') {
        if (task.isQueue) {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'btn-sm';
            acceptBtn.style.background = '#10b981';
            acceptBtn.innerText = '✅ Accept';
            acceptBtn.onclick = () => transitionTask(task, 'open', 'todo');
            actions.appendChild(acceptBtn);
            const archiveBtn = document.createElement('button');
            archiveBtn.className = 'btn-sm';
            archiveBtn.style.background = '#64748b';
            archiveBtn.innerText = '✅ Resolve';
            archiveBtn.onclick = () => transitionTask(task, 'closed');
            actions.appendChild(archiveBtn);
        } else {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-sm';
            closeBtn.style.background = '#10b981';
            closeBtn.innerText = '✅ Close';
            closeBtn.onclick = () => transitionTask(task, 'closed');
            actions.appendChild(closeBtn);
        }
    } else if (task.status === 'closed') {
        const reopenBtn = document.createElement('button');
        reopenBtn.className = 'btn-sm';
        reopenBtn.style.background = '#8b5cf6';
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
            loadTrackerBoard();
        } else {
            alert("Failed to transition task.");
        }
    } catch (e) {
        alert("Network error");
    }
}
function openNewTaskModal() {
    const { allRepos } = AppStore.getState();
    let repoOptions = allRepos.map(repo => `<option value="${repo}">${repo}</option>`).join('');

    let defaultType = 'todo';
    if (document.getElementById('st-bugs') && document.getElementById('st-bugs').classList.contains('active')) {
        defaultType = 'bug';
    } else if (document.getElementById('st-queue') && document.getElementById('st-queue').classList.contains('active')) {
        defaultType = 'queue';
    }

    const state = KanbanStore.getState();
    let prePopulatedTags = [];
    state.pinnedTags.forEach(tag => {
        if (tag !== 'ALL') prePopulatedTags.push(tag);
    });

    const bodyHtml = `
    <div style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
        <select id="new-task-repo" style="flex: 1; min-width: 120px; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" onchange="populateNewTaskBuckets()">
            ${repoOptions}
        </select>
        <select id="new-task-type" style="padding: 8px; flex: 1; min-width: 120px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);">
            <option value="todo" ${defaultType === 'todo' ? 'selected' : ''}>To-Do (Task)</option>
            <option value="bug" ${defaultType === 'bug' ? 'selected' : ''}>Bug</option>
            <option value="queue" ${defaultType === 'queue' ? 'selected' : ''}>Queue (Research)</option>
        </select>
        <select id="new-task-status" style="padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);">
            <option value="open">Open (Backlog)</option>
            <option value="active">Active (In Progress)</option>
        </select>
        <select id="new-task-bucket" style="padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);">
            <option value="None">No Bucket</option>
        </select>
    </div>
    <input type="text" id="new-task-title" placeholder="Ticket Title (e.g., Fix schema registry timeout)" style="margin-bottom: 10px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;">
    <input type="text" id="new-task-tags" value="${prePopulatedTags.join(', ')}" placeholder="Tags (comma separated, e.g. frontend, critical)" style="margin-bottom: 10px; padding: 10px; width: 100%; box-sizing: border-box;">
    <textarea id="new-task-desc" style="flex: 1; margin-bottom: 10px; font-size: 13px; margin-top:0; min-height: 150px; width: 100%; box-sizing: border-box;" placeholder="Markdown description..."></textarea>
    `;

    window.UIFactory.createModal({
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
    select.innerHTML = '<option value="None">No Bucket</option>';
    const selectedRepo = document.getElementById('new-task-repo').value;
    const buckets = getFlattenedBuckets(selectedRepo);
    buckets.forEach(b => {
        if (b.id === 'tracker' || b.original.id === 'tracker') return;
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.innerText = b.title;
        select.appendChild(opt);
    });
}

async function saveNewTask(modalId = 'new-task-modal') {
    const repo = document.getElementById('new-task-repo').value;
    const type = document.getElementById('new-task-type').value;
    const status = document.getElementById('new-task-status').value;
    const title = document.getElementById('new-task-title').value;
    const tags = document.getElementById('new-task-tags').value;
    const desc = document.getElementById('new-task-desc').value;
    const sub_bucket = document.getElementById('new-task-bucket') ? document.getElementById('new-task-bucket').value : 'None';

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
            if (window.UIFactory) window.UIFactory.closeModal(modalId);
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
        let title = filepath.split('/').pop();
        let tags = [];
let subBucket = 'None';

        const yamlMatch = content.match(/^\s*---\n([\s\S]*?)\n\s*---/);
        if (yamlMatch) {
            const lines = yamlMatch[1].split('\n');
            lines.forEach(l => {
                if (l.startsWith('title:')) title = l.replace('title:', '').replace(/"/g, '').replace(/'/g, '').trim();
                if (l.startsWith('sub_bucket:')) subBucket = l.replace('sub_bucket:', '').replace(/"/g, '').replace(/'/g, '').trim() || 'None';
                if (l.startsWith('tags:')) {
                    const rawTags = l.replace('tags:', '').trim();
                    if (rawTags.startsWith('[')) {
                        tags = rawTags.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/['"]/g, '')).filter(t => t);
                    } else {
                        tags = rawTags.split(',').map(t => t.trim().replace(/['"]/g, '')).filter(t => t);
                    }
                }
            });
        }

        let desc = content;
        if (yamlMatch) {
            desc = content.replace(yamlMatch[0], '').trim();
            if (desc.startsWith('## Description')) {
                desc = desc.replace(/^## Description\n+/, '');
            }
        }

        const safeTitle = title.replace(/"/g, '&quot;');
        const safeTags = tags.join(', ').replace(/"/g, '&quot;');
        const safeYaml = yamlMatch ? yamlMatch[1].replace(/"/g, '&quot;') : '';

        const bodyHtml = `
        <input type="hidden" id="edit-task-filepath" value="${filepath}">
        <input type="hidden" id="edit-task-original-yaml" value="${safeYaml}">

        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <select id="edit-task-bucket" style="flex: 1; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);">
                <option value="None">No Bucket</option>
            </select>
        </div>
        <input type="text" id="edit-task-title" value="${safeTitle}" placeholder="Ticket Title" style="margin-bottom: 10px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;">
        <input type="text" id="edit-task-tags" value="${safeTags}" placeholder="Tags (comma separated)" style="margin-bottom: 10px; padding: 10px; width: 100%; box-sizing: border-box;">
        <textarea id="edit-task-desc" style="flex: 1; margin-bottom: 10px; font-size: 13px; margin-top:0; min-height: 150px; width: 100%; box-sizing: border-box;" placeholder="Markdown description..."></textarea>
        `;

        window.UIFactory.createModal({
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
        document.getElementById('edit-task-desc').value = desc.trim();
        const select = document.getElementById('edit-task-bucket');
        const buckets = getFlattenedBuckets(repo);
        buckets.forEach(b => {
            if (b.id === 'tracker' || b.original.id === 'tracker') return;
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = b.title;
            select.appendChild(opt);
        });
        select.value = subBucket;

    } catch (e) {
        alert(e.message);
    }
}

async function saveEditTask(modalId = 'edit-task-modal') {
    const filepath = document.getElementById('edit-task-filepath').value;
    const title = document.getElementById('edit-task-title').value;
    const tagsRaw = document.getElementById('edit-task-tags').value;
    const bucket = document.getElementById('edit-task-bucket').value;
    const desc = document.getElementById('edit-task-desc').value;
    const origYaml = document.getElementById('edit-task-original-yaml').value;
    if (!title || !desc) {
        alert("Title and Description are required.");
        return;
    }

    const btn = document.getElementById('save-edit-task-btn');
    const origBtnText = btn ? btn.innerText : 'Save';
    if (btn) btn.innerText = "Saving...";

    let lines = origYaml.split('\n');
    let newLines = [];
    let hasBucket = false;
    let hasTags = false;

    lines.forEach(l => {
        if (l.startsWith('title:')) {
            newLines.push(`title: "${title.replace(/"/g, "'")}"`);
        } else if (l.startsWith('tags:')) {
            const tagsArr = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
            if (tagsArr.length > 0) {
                newLines.push(`tags: [${tagsArr.join(', ')}]`);
            } else {
                newLines.push(`tags: []`);
            }
            hasTags = true;
        } else if (l.startsWith('sub_bucket:')) {
            newLines.push(`sub_bucket: "${bucket}"`);
            hasBucket = true;
        } else {
            newLines.push(l);
        }
    });

    if (!hasTags && tagsRaw.trim()) {
        const tagsArr = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
        newLines.push(`tags: [${tagsArr.join(', ')}]`);
    }
    if (!hasBucket) {
        newLines.push(`sub_bucket: "${bucket}"`);
    }
    const newContent = `---\n${newLines.join('\n')}\n---\n\n## Description\n${desc}\n`;
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/fs/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: filepath, content: newContent })
        });
        if (res.ok) {
            if (window.UIFactory) window.UIFactory.closeModal(modalId);
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

    const tasksByRepo = {};
    closedTasks.forEach(t => {
        if (!tasksByRepo[t.repo]) tasksByRepo[t.repo] = [];
        tasksByRepo[t.repo].push(t);
    });

    let changelog = "";

    Object.keys(tasksByRepo).sort().forEach(repo => {
        changelog += `# 📜 Historical Changelog for ${repo}\n\n`;
        const repoTasks = tasksByRepo[repo];
        repoTasks.sort((a, b) => (b.closedAt || b.timestamp).localeCompare(a.closedAt || a.timestamp));

        let currentDate = "";

        repoTasks.forEach(t => {
            const activeDate = t.closedAt || t.timestamp;
            const dateStr = activeDate ? activeDate.split('T')[0] : 'Unknown Date';
            if (dateStr !== currentDate)  {
                changelog += `\n## ${dateStr}\n\n`;
                currentDate = dateStr;
            }
            const typeIcon = t.isBug ? '🐛' : t.isQueue ? '🔬' : '✨';
            changelog += `### ${typeIcon} ${t.title}\n\n`;

            if (t.description) {
                // Drop the execution log/notes header to keep the changelog clean
                const cleanDesc = t.description.split('## Notes / Execution Log')[0].trim();
                changelog += `${cleanDesc}\n\n`;
            }
        });
        changelog += `\n---\n\n`;
    });

    // Clean up trailing separators
    changelog = changelog.trim().replace(/---$/, '').trim();

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

if (window.ExtensionRegistry && window.ExtensionRegistry.registerUIHook) {
    window.ExtensionRegistry.registerUIHook('zone:tab-changed', (tabId) => {
        if (tabId === 'tasks') loadTrackerBoard();
    });
}
// Bind UI strictly to state updates via Selectors
function renderAll() {
    if (!document.getElementById('task-repo-pins')) return; // Board not mounted yet
    const state = KanbanStore.getState();
    renderTaskRepoPins(state);
    renderTaskBucketPins(state);
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
