import {
    ALL_REPOS,
    TARGET_CONFIGS,
    compileContexts,
    viewSourceFile,
    setContextManifest
} from './app.js';
let currentTasks = [];
let taskPinnedRepos = new Set(JSON.parse(localStorage.getItem('insetu_task_pinned_repos')) || ["ALL"]);
function renderTaskRepoPins() {
    const container = document.getElementById('task-repo-pins');
    if (!container) return;
    container.innerHTML = '';

    const lbl = document.createElement('span');
    lbl.innerText = "📌 Repos:";
    lbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap;";
    container.appendChild(lbl);
    const createPill = (id, label) => {
        const btn = document.createElement('button');
        const isActive = taskPinnedRepos.has(id);
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = label;
        btn.style.cssText = `padding: 4px 8px;
border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ?
'#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;
        btn.onclick = () => {
            if (id === "ALL") {

                taskPinnedRepos.clear();
                taskPinnedRepos.add("ALL");
            } else {
                taskPinnedRepos.delete("ALL");
                if (taskPinnedRepos.has(id)) {
                    taskPinnedRepos.delete(id);
                    if (taskPinnedRepos.size === 0) taskPinnedRepos.add("ALL");
                } else {
                    taskPinnedRepos.add(id);
                }
            }
            localStorage.setItem('insetu_task_pinned_repos', JSON.stringify(Array.from(taskPinnedRepos)));
            renderTaskRepoPins();
            if (typeof renderTaskBucketPins === 'function') renderTaskBucketPins();
            if (typeof renderTaskTagPins === 'function') renderTaskTagPins();
            renderTrackerBoard();
        };
        return btn;
    };
    container.appendChild(createPill("ALL", "All"));
    ALL_REPOS.forEach(repo => container.appendChild(createPill(repo, repo)));
}
export async function loadTrackerBoard() {
    // Silently sync the ecosystem to ensure the board is perfectly up-to-date
    await compileContexts();
    // Refresh the context manifest for the Context/Download tabs
    const mRes = await fetch('/api/manifest?t=' + Date.now());
    if (mRes.ok) setContextManifest(await mRes.json());

    if (document.getElementById('task-repo-pins').childElementCount === 0) renderTaskRepoPins();
    // Decouple Kanban board from LLM manifest to ensure closed/changelog tickets aren't hidden
    const tRes = await fetch('/api/tracker/files?t=' + Date.now());
    let trackerFiles = [];
    if (tRes.ok) {
        const data = await tRes.json();
        trackerFiles = data.files || [];
    }

    const scopedTasks = [];
    for (const filepath of trackerFiles) {
        try {
            const res = await fetch('/api/bridge/fetch?file=' + encodeURIComponent(filepath) + '&t=' + Date.now());
            if (!res.ok) continue;
            const content = await res.text();

            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let title = filepath.split('/').pop();
            let id = 'UNKNOWN';
            let timestamp = '0000-00-00T00:00:00';
            let subBucket = 'None';
            let tags = [];
            if (yamlMatch) {
                const lines = yamlMatch[1].split('\n');
                lines.forEach(l => {
                    if (l.startsWith('title:')) title = l.replace('title:', '').replace(/"/g, '').replace(/'/g, '').trim();

                    if (l.startsWith('id:')) id = l.replace('id:', '').trim();

                    if (l.startsWith('created_at:')) timestamp = l.replace('created_at:', '').trim();

                    if (l.startsWith('sub_bucket:')) subBucket = l.replace('sub_bucket:', '').replace(/"/g, '').replace(/'/g, '').trim() || 'None';

                    if (l.startsWith('tags:')) {

                        const rawTags = l.replace('tags:', '').trim();

                        if (rawTags.startsWith('[')) {
                            tags = rawTags.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/['"]/g, '')).filter(t =>
                                t);
                        } else {
                            tags = rawTags.split(',').map(t => t.trim().replace(/['"]/g, '')).filter(t => t);

                        }

                    }

                });
            }


            const repo = filepath.split('/')[0];
            const isBug = filepath.includes('/bugs/');

            const isTodo = filepath.includes('/todos/');
            const isQueue = filepath.includes('/queue/');

            let status = 'unknown';
            if (filepath.includes('/open/')) status = 'open';
            if (filepath.includes('/active/')) status = 'active';
            if (filepath.includes('/closed/')) status = 'closed';
            scopedTasks.push({
                filepath,
                repo,
                title,
                id,
                isBug,
                isTodo,
                isQueue,
                status,
                timestamp,
                tags,
                subBucket
            });
        } catch (e) {
            console.error("Failed to load task:", filepath);
        }
    }
    currentTasks = scopedTasks;
    renderTaskBucketPins();
    renderTaskTagPins();
    renderTrackerBoard();
}
let taskPinnedBuckets = new Set(JSON.parse(localStorage.getItem('insetu_task_pinned_buckets')) || ["ALL"]);

function renderTaskBucketPins() {
    let container = document.getElementById('task-bucket-pins');
    if (!container) {
        const repoContainer = document.getElementById('task-repo-pins');
        container = document.createElement('div');
        container.id = 'task-bucket-pins';
        container.style.marginTop = '10px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'wrap';
        container.style.gap = '6px';
        repoContainer.parentNode.insertBefore(container, repoContainer.nextSibling);
    }
    container.innerHTML = '';
    let reposToShow = taskPinnedRepos.has('ALL') ? ALL_REPOS : Array.from(taskPinnedRepos);
    const showRepoPrefix = reposToShow.length > 1;

    let hasBuckets = false;
    reposToShow.forEach(repoName => {
        const repoCfg = TARGET_CONFIGS.find(c => c.repo_dir === repoName);
        if (repoCfg && repoCfg.sub_buckets && repoCfg.sub_buckets.length > 0) {
            hasBuckets = true;

        }
    });
    if (!hasBuckets) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    const lbl = document.createElement('span');
    lbl.innerText = "🗂️ Buckets:";
    lbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap;";
    container.appendChild(lbl);

    const createPill = (id, label) => {
        const btn = document.createElement('button');
        const isActive = taskPinnedBuckets.has(id);
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = label;
        btn.style.cssText = `padding: 4px 8px;
border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ?
'#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;
        btn.onclick = () => {
            if (id === "ALL") {

                taskPinnedBuckets.clear();
                taskPinnedBuckets.add("ALL");
            } else {
                taskPinnedBuckets.delete("ALL");
                if (taskPinnedBuckets.has(id)) {
                    taskPinnedBuckets.delete(id);
                    if (taskPinnedBuckets.size === 0) taskPinnedBuckets.add("ALL");
                } else {
                    taskPinnedBuckets.add(id);
                }
            }
            localStorage.setItem('insetu_task_pinned_buckets', JSON.stringify(Array.from(taskPinnedBuckets)));
            renderTaskBucketPins();
            if (typeof renderTaskTagPins === 'function') renderTaskTagPins();
            renderTrackerBoard();
        };
        return btn;
    };
    const createSeparator = () => {
        const sep = document.createElement('span');
        sep.innerText = "|";
        sep.style.cssText = "font-size: 0.85rem; color: var(--text); opacity: 0.5; margin: 0 2px;";
        return sep;
    };
    const createRepoLabel = (text) => {
        const rlbl = document.createElement('span');
        rlbl.innerText = text + ":";
        rlbl.style.cssText = "font-size: 0.8rem; font-family: monospace; color: var(--text); opacity: 0.8; margin-right: 2px;";
        return rlbl;
    };
    container.appendChild(createPill("ALL", "All"));
    reposToShow.forEach(repoName => {
        const repoCfg = TARGET_CONFIGS.find(c => c.repo_dir === repoName);
        if (repoCfg && repoCfg.sub_buckets && repoCfg.sub_buckets.length > 0) {
            container.appendChild(createSeparator());

            if (showRepoPrefix) {
                container.appendChild(createRepoLabel(repoName));
            }
            repoCfg.sub_buckets.forEach(b => {

                if (b.dynamic_split_prefix && b.meta_map) {
                    Object.keys(b.meta_map).forEach(brand => {
                        container.appendChild(createPill(brand, b.meta_map[brand].title || brand));

                    });
                } else if (!b.dynamic_split_prefix) {
                    container.appendChild(createPill(b.id, b.id));

                }
            });
        }
    });
}
let taskPinnedTags = new Set(JSON.parse(localStorage.getItem('insetu_task_pinned_tags')) || ["ALL"]);

function renderTaskTagPins() {
    let container = document.getElementById('task-tag-pins');
    if (!container) {
        const bucketContainer = document.getElementById('task-bucket-pins') ||
            document.getElementById('task-repo-pins');
        container = document.createElement('div');
        container.id = 'task-tag-pins';
        container.style.marginTop = '10px';
        bucketContainer.parentNode.insertBefore(container, bucketContainer.nextSibling);
    }
    container.innerHTML = '';
    const allTags = new Set();
    currentTasks.forEach(t => {
        const matchesRepo = taskPinnedRepos.has('ALL') || taskPinnedRepos.has(t.repo);
        const matchesBucket = taskPinnedBuckets.has('ALL') || taskPinnedBuckets.has(t.subBucket);
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
    lbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap;";
    container.appendChild(lbl);
    const createPill = (id, label) => {
        const btn = document.createElement('button');
        const isActive = taskPinnedTags.has(id);
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = label;
        btn.style.cssText = `padding: 4px 8px;
border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ?
'#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;
        btn.onclick = () => {
            if (id === "ALL") {

                taskPinnedTags.clear();
                taskPinnedTags.add("ALL");
            } else {
                taskPinnedTags.delete("ALL");
                if (taskPinnedTags.has(id)) {
                    taskPinnedTags.delete(id);
                    if (taskPinnedTags.size === 0) taskPinnedTags.add("ALL");
                } else {
                    taskPinnedTags.add(id);
                }
            }
            localStorage.setItem('insetu_task_pinned_tags', JSON.stringify(Array.from(taskPinnedTags)));
            renderTaskTagPins();
            renderTrackerBoard();
        };
        return btn;
    };
    container.appendChild(createPill("ALL", "All"));
    Array.from(allTags).sort().forEach(tag => container.appendChild(createPill(tag, `#${tag}`)));
}

function renderTrackerBoard() {
    ['todos-open-list', 'todos-active-list', 'bugs-open-list', 'bugs-active-list', 'queue-open-list', 'log-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const filtered = currentTasks.filter(t => {
        const matchesRepo = taskPinnedRepos.has('ALL') || taskPinnedRepos.has(t.repo);
        const matchesBucket = taskPinnedBuckets.has('ALL') || taskPinnedBuckets.has(t.subBucket);
        const matchesTag = taskPinnedTags.has('ALL') || (t.tags && t.tags.some(tag => taskPinnedTags.has(tag)));
        return matchesRepo && matchesBucket && matchesTag;
    });
    // Sort tasks chronologically, newest at the top
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    filtered.forEach(t => {
        let containerId = null;
        if (t.status === 'closed') containerId = 'log-list';

        else if (t.isTodo && t.status === 'open') containerId = 'todos-open-list';
        else if (t.isTodo && t.status === 'active') containerId = 'todos-active-list';
        else if (t.isBug && t.status === 'open')
            containerId = 'bugs-open-list';
        else if (t.isBug && t.status === 'active') containerId = 'bugs-active-list';
        else if (t.isQueue && t.status === 'open') containerId = 'queue-open-list';


        const container = document.getElementById(containerId);
        if (container) createTaskCard(t, container);
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
    if (task.status !== 'closed') {
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
            archiveBtn.innerText = '📦 Archive';
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
    const select = document.getElementById('new-task-repo');
    select.innerHTML = '';
    ALL_REPOS.forEach(repo => {
        const opt = document.createElement('option');
        opt.value = repo;

        opt.innerText = repo;
        select.appendChild(opt);
    });
    const typeSelect = document.getElementById('new-task-type');
    if (document.getElementById('st-bugs') && document.getElementById('st-bugs').classList.contains('active')) {
        typeSelect.value = 'bug';
    } else if (document.getElementById('st-queue') && document.getElementById('st-queue').classList.contains('active')) {
        typeSelect.value = 'queue';
    } else {
        typeSelect.value = 'todo';
    }

    if (taskPinnedRepos && taskPinnedRepos.size === 1 && !taskPinnedRepos.has('ALL')) {
        const pinnedRepo = Array.from(taskPinnedRepos)[0];
        if (ALL_REPOS.includes(pinnedRepo)) select.value = pinnedRepo;
    }

    let prePopulatedTags = [];
    if (taskPinnedTags) {
        taskPinnedTags.forEach(tag => {
            if (tag !== 'ALL') prePopulatedTags.push(tag);

        });
    }
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-tags').value = prePopulatedTags.join(', ');
    document.getElementById('new-task-desc').value = '';

    populateNewTaskBuckets();
    document.getElementById('new-task-repo').onchange = populateNewTaskBuckets;

    document.getElementById('new-task-modal').style.display = 'block';
}

function populateNewTaskBuckets() {
    const select = document.getElementById('new-task-bucket');
    if (!select) return;
    select.innerHTML = '<option value="None">No Bucket</option>';
    const selectedRepo = document.getElementById('new-task-repo').value;
    const repoConfig = TARGET_CONFIGS.find(c => c.repo_dir === selectedRepo);
    if (repoConfig && repoConfig.sub_buckets) {
        repoConfig.sub_buckets.forEach(b => {
            if (b.dynamic_split_prefix && b.meta_map) {
                Object.keys(b.meta_map).forEach(brand => {
                    const opt = document.createElement('option');

                    opt.value = brand;
                    opt.innerText = b.meta_map[brand].title || brand;
                    select.appendChild(opt);
                });
            } else if (!b.dynamic_split_prefix) {
                const opt = document.createElement('option');

                opt.value = b.id;
                opt.innerText = b.title || b.id;
                select.appendChild(opt);
            }
        });
    }
}

async function saveNewTask() {
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
    btn.innerText = "Creating...";
    try {
        const res = await fetch('/api/tracker/new', {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                repo,
                type,
                status,
                title,
                tags,
                description: desc,
                sub_bucket
            })

        });
        if (res.ok) {
            document.getElementById('new-task-modal').style.display = 'none';
            loadTrackerBoard();
        } else {
            alert("Failed to create task.");
        }
    } catch (e) {
        alert("Network error.");
    } finally {
        btn.innerText = "💾 Create Ticket";
    }
}
async function openEditTaskModal(filepath) {
    try {
        const res = await fetch('/api/bridge/fetch?file=' + encodeURIComponent(filepath));
        if (!res.ok) throw new Error("Failed to load task file.");
        const content = await res.text();

        const repo = filepath.split('/')[0];
        let title = filepath.split('/').pop();
        let tags = [];
        let subBucket = 'None';

        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
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

        document.getElementById('edit-task-filepath').value = filepath;
        document.getElementById('edit-task-title').value = title;
        document.getElementById('edit-task-tags').value = tags.join(', ');
        const select = document.getElementById('edit-task-bucket');
        select.innerHTML = '<option value="None">No Bucket</option>';
        const repoConfig = TARGET_CONFIGS.find(c => c.repo_dir === repo);
        if (repoConfig && repoConfig.sub_buckets) {
            repoConfig.sub_buckets.forEach(b => {
                if (b.dynamic_split_prefix && b.meta_map) {
                    Object.keys(b.meta_map).forEach(brand => {
                        const opt = document.createElement('option');

                        opt.value = brand;
                        opt.innerText = b.meta_map[brand].title || brand;
                        select.appendChild(opt);
                    });

                } else if (!b.dynamic_split_prefix) {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.innerText = b.title || b.id;
                    select.appendChild(opt);

                }
            });
        }
        select.value = subBucket;

        let desc = content;
        if (yamlMatch) {
            desc = content.replace(yamlMatch[0], '').trim();
            if (desc.startsWith('## Description')) {
                desc = desc.replace(/^## Description\n+/, '');
            }
        }
        document.getElementById('edit-task-desc').value = desc.trim();
        document.getElementById('edit-task-original-yaml').value = yamlMatch ? yamlMatch[1] : '';

        document.getElementById('edit-task-modal').style.display = 'block';
    } catch (e) {
        alert(e.message);
    }
}

async function saveEditTask() {
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
    const origBtnText = btn.innerText;
    btn.innerText = "Saving...";

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
        const res = await fetch('/api/fs/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filepath: filepath,
                content: newContent
            })
        });
        if (res.ok) {
            document.getElementById('edit-task-modal').style.display = 'none';
            loadTrackerBoard();
        } else {
            alert("Failed to save changes.");
        }
    } catch (e) {
        alert("Network error.");
    } finally {
        btn.innerText = origBtnText;
    }
}

// Window Bindings
window.openNewTaskModal = openNewTaskModal;
window.saveNewTask = saveNewTask;
window.saveEditTask = saveEditTask;
window.openEditTaskModal = openEditTaskModal;
window.renderTaskRepoPins = renderTaskRepoPins;
