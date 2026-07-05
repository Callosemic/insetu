import {
    compileContexts,
    setContextManifest,
    createFileCard
} from './app.js';
import { AppStore } from './store.js';
export async function openPushModal(diffFilename, repoDir) {
    AppStore.setState({ currentPushDiffFile: diffFilename, currentPushRepo: repoDir });

    const bodyHtml = `
        <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9rem;">Recent Changelogs:</label>
        <select id="push-changelog-select" style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); margin-bottom: 15px; font-weight: bold;" onchange="document.getElementById('push-message').value = this.value;">
            <option value="">-- Type a custom message below --</option>
        </select>
        <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9rem;">Commit Message:</label>
        <textarea id="push-message" placeholder="Enter commit message..." style="margin-bottom: 15px; padding: 10px; font-weight: bold; height: 80px; margin-top: 0; width: 100%; box-sizing: border-box;"></textarea>
        <div id="push-spinner" class="spinner" style="margin-top:0; margin-bottom:15px; display:none;">Pushing to remote... please wait.</div>
    `;

    window.inSetu.ui.Factory.createModal({
        id: 'push-modal',
        title: `🚀 Commit & Push: <span style="color: var(--intent-highlight);">${repoDir || "Unknown Repo"}</span>`,
        body: bodyHtml,
        actions: [
            { label: '🚀 Execute Push', style: 'primary', id: 'execute-push-btn', onClick: async (e, modal) => {
                await executePush(modal.id);
                return true;
            }}
        ]
    });

    try {
        const select = document.getElementById('push-changelog-select');
        const res = await fetch(`/api/git/changelogs?repo=${encodeURIComponent(repoDir || '')}&t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.changelogs && data.changelogs.length > 0) {
                data.changelogs.forEach(cl => {
                    const opt = document.createElement('option');
                    opt.value = cl.title;
                    opt.innerText = cl.title;
                    select.appendChild(opt);
                });
                select.selectedIndex = 1;
                document.getElementById('push-message').value = data.changelogs[0].title;
            }
        }
    } catch (e) {
        console.error("Failed to load changelogs.");
    }
}
export async function executePush(modalId = 'push-modal') {
    const msg = document.getElementById('push-message').value.trim();
    const { currentPushRepo, currentPushDiffFile } = AppStore.getState();

    if (!msg) {
        alert("Please enter a commit message.");
        return;
    }
    if (!currentPushRepo) {
        alert("Repository context missing.");
        return;
    }

    const btn = document.getElementById('execute-push-btn');
    const spinner = document.getElementById('push-spinner');
    if (btn) btn.style.display = 'none';
    if (spinner) spinner.style.display = 'block';
    try {
        const res = await fetch('/api/git/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                repo: currentPushRepo,
                message: msg,
                diff_file: currentPushDiffFile
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Push request failed.");
        }
        
        const data = await res.json();
        window._activePushJobId = data.job_id;
    } catch (e) {
        alert("Network error executing push: " + e.message);
        if (btn) btn.style.display = 'block';
        if (spinner) spinner.style.display = 'none';
    }
}
export async function openSweepModal() {
    const bodyHtml = `
        <div id="sweep-loading" class="spinner" style="display:block; margin-top:0; margin-bottom:15px;">Scanning workspaces...</div>
        <div id="sweep-files-container" style="flex: 1; overflow-y: auto; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-bottom: 15px; min-height: 200px;">
        </div>
        <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9rem;">Commit Message:</label>
        <textarea id="sweep-message" placeholder="e.g. chore: format, lint, and clear orphans" style="margin-bottom: 15px; padding: 10px; font-weight: bold; height: 60px; margin-top: 0; resize: none; width: 100%; box-sizing: border-box;"></textarea>
        <div id="sweep-push-spinner" class="spinner" style="margin-top:0; margin-bottom:15px; display:none;">Committing and pushing...</div>
    `;

    window.inSetu.ui.Factory.createModal({
        id: 'sweep-modal',
        title: '🧹 Selective Sweep',
        body: bodyHtml,
        maxWidth: '700px',
        actions: [
            { label: '🚀 Commit & Push Selected', style: 'primary', id: 'execute-sweep-btn', onClick: async (e, modal) => {
                await executeSweepPush(modal.id);
                return true;
            }}
        ]
    });

    await loadSweepFiles();
}

async function loadSweepFiles() {
    const container = document.getElementById('sweep-files-container');
    const loading = document.getElementById('sweep-loading');
    const btn = document.getElementById('execute-sweep-btn');

    container.innerHTML = '';
    loading.style.display = 'block';
    btn.disabled = true;

    try {
        const res = await fetch('/api/git/sweep/status');
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();

        loading.style.display = 'none';

        if (Object.keys(data.repos).length === 0) {
            container.innerHTML = '<p style="color: var(--intent-success); font-weight: bold; text-align: center; margin-top: 20px;">✨ Working tree clean! Nothing to sweep.</p>';
            return;
        }

        btn.disabled = false;

        for (const [repo, files] of Object.entries(data.repos)) {
            const repoHeader = document.createElement('h4');
            repoHeader.innerText = `📦 ${repo}`;
            repoHeader.style.cssText = "margin: 10px 0 5px 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 3px;";

            // "Select All" toggle for the repo
            const selectAllWrap = document.createElement('div');
            selectAllWrap.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 8px; margin-left: 5px;";
            const selectAllCb = document.createElement('input');
            selectAllCb.type = 'checkbox';
            selectAllCb.className = `sweep-select-all-${repo}`;
            selectAllCb.onchange = (e) => {
                document.querySelectorAll(`.sweep-cb-${repo}`).forEach(cb => cb.checked = e.target.checked);
            };
            const selectAllLbl = document.createElement('label');
            selectAllLbl.innerText = "Select All";
            selectAllLbl.style.cssText = "font-size: 0.8rem; font-weight: bold; color: var(--text-muted); cursor: pointer;";
            selectAllLbl.onclick = () => selectAllCb.click();

            selectAllWrap.appendChild(selectAllCb);
            selectAllWrap.appendChild(selectAllLbl);

            container.appendChild(repoHeader);
            container.appendChild(selectAllWrap);

            files.forEach(f => {
                const row = document.createElement('div');
                row.style.cssText = "display: flex; align-items: center; gap: 10px; margin-bottom: 4px; margin-left: 15px;";

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = `sweep-cb sweep-cb-${repo}`;
                cb.dataset.repo = repo;
                cb.dataset.path = f.path;

                const lbl = document.createElement('label');
                lbl.innerText = `[${f.status}] ${f.path}`;
                lbl.style.cssText = "font-family: monospace; font-size: 0.85rem; word-break: break-all; cursor: pointer;";
                lbl.onclick = () => cb.click();

                row.appendChild(cb);
                row.appendChild(lbl);
                container.appendChild(row);
            });
        }
    } catch (e) {
        loading.style.display = 'none';
        container.innerHTML = `<p style="color: red;">Error scanning workspaces: ${e.message}</p>`;
    }
}

export async function executeSweepPush() {
    const msg = document.getElementById('sweep-message').value.trim();
    if (!msg) {
        alert("Please enter a commit message for this sweep.");
        return;
    }

    const selections = {};
    document.querySelectorAll('.sweep-cb:checked').forEach(cb => {
        const repo = cb.dataset.repo;
        if (!selections[repo]) selections[repo] = [];
        selections[repo].push(cb.dataset.path);
    });

    if (Object.keys(selections).length === 0) {
        alert("No files selected.");
        return;
    }

    const btn = document.getElementById('execute-sweep-btn');
    const spinner = document.getElementById('sweep-push-spinner');
    btn.style.display = 'none';
    spinner.style.display = 'block';
    try {
        const res = await fetch('/api/git/sweep/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selections, message: msg })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Sweep request failed.");
        }
        const data = await res.json();
        window._activeSweepJobId = data.job_id;
    } catch (e) {
        alert("Network error executing sweep: " + e.message);
        btn.style.display = 'block';
        spinner.style.display = 'none';
    }
}
window.openPushModal = openPushModal;
window.executePush = executePush;
window.openSweepModal = openSweepModal;
window.executeSweepPush = executeSweepPush;
window._cachedDiffFiles = null;
window._dirtyDiffRepos = new Set(["ALL"]);

export function renderDiffFiles(files) {
    const loading = document.getElementById('diff-loading');
    const results = document.getElementById('diff-results');
    const sweepBtn = document.getElementById('btn-sweep-remaining');

    if (loading) loading.style.display = 'none';
    if (results) results.innerHTML = '';

    if (files.length > 0) {
        if (sweepBtn) sweepBtn.style.display = 'block';
        const categories = {};
        const { categoryOrder, targetConfigs, hiddenOutputs, virtualContexts } = AppStore.getState();
        files.forEach(fileObj => {
            const file = typeof fileObj === 'string' ? fileObj : fileObj.filename;
            const repoDir = typeof fileObj === 'object' ? fileObj.repo : null;
            if (hiddenOutputs && hiddenOutputs.includes(file)) return;

            const baseFile = file.replace('_diffs.txt', '_context.txt');
            const manifestObj = AppStore.getState().manifest[baseFile] || {};
            const meta = manifestObj.meta || { title: file, domain: "Workspaces", desc: "Pending diff payload." };

            let finalCat = meta.domain;
            let finalDesc = meta.desc;
            let finalTitle = meta.title + " (Diffs)";

            if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                const extMeta = window.ExtensionRegistry.executeUIHook('zone:context-metadata', baseFile);
                if (extMeta) {
                    finalCat = extMeta.cat;
                    finalDesc = extMeta.desc;
                    finalTitle = extMeta.displayName.replace('.txt', '_diffs.txt');
                }
            }

            if (!categories[finalCat]) categories[finalCat] = [];
            categories[finalCat].push({
                filename: file,
                displayName: finalTitle,
                description: finalDesc,
                isFS: false,
                repoDir: repoDir
            });
        });

        const sortedCats = Object.keys(categories).sort((a, b) => {
            if (a === "Quick-Pack Clipboard") return -1;
            if (b === "Quick-Pack Clipboard") return 1;
            let iA = categoryOrder.indexOf(a);
            let iB = categoryOrder.indexOf(b);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });

        for (const catName of sortedCats) {
            const catFiles = categories[catName];
            if (catFiles.length > 0) {
                const heading = document.createElement('div');
                heading.className = 'category-heading';
                heading.innerText = catName;
                results.appendChild(heading);

                import('./app.js').then(module => {
                    catFiles.forEach(f => module.createFileCard(f, results));
                });
            }
        }
    } else {
        if (sweepBtn) sweepBtn.style.display = 'none';
        if (results) results.innerHTML = '<p style="color: var(--text-muted);">No pending changes detected across tracked repositories.</p>';
    }
}
export async function generateDiffs(force = false) {
    const loading = document.getElementById('diff-loading');
    const results = document.getElementById('diff-results');
    if (!loading || !results) return;

    let targetRepos = null;
    if (force || !window._cachedDiffFiles || (window._dirtyDiffRepos && window._dirtyDiffRepos.has("ALL"))) {
        targetRepos = null; 
    } else if (window._dirtyDiffRepos && window._dirtyDiffRepos.size > 0) {
        targetRepos = Array.from(window._dirtyDiffRepos);
    } else {
        renderDiffFiles(window._cachedDiffFiles);
        return;
    }

    loading.style.display = 'block';
    results.innerHTML = '';

    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/diffs/generate`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_repos: targetRepos })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Diff generation request failed.");
        }

        const data = await res.json();
        window._activeDiffJobId = data.job_id;
    } catch (error) {
        loading.style.display = 'none';
        results.innerHTML = `<p style="color: red;">Error requesting diff analysis: ${error.message}</p>`;
    }
}
window.generateDiffs = generateDiffs;

const diffsScreen = window.inSetu.extensions.Registry.registerSubTab('context', 'diffs', 'Diffs');
if (diffsScreen) {
    diffsScreen.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <h2 style="margin: 0;">Pending Architecture (Diffs)</h2>
            <div style="display: flex; gap: 10px;">
                <button id="btn-refresh-diffs" class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 4px 12px; font-size: 0.9rem;" onclick="generateDiffs(true)">🔄 Refresh</button>
                <button id="btn-sweep-remaining" class="btn-sm" style="background: var(--intent-warning); margin: 0; padding: 4px 12px; font-size: 0.9rem; display: none;" onclick="openSweepModal()">🧹 Sweep Remaining</button>
            </div>
        </div>
        <div id="diff-loading" class="spinner">Analyzing Git trees across sister repositories... please wait.</div>
        <div id="diff-results" style="display: flex; flex-direction: column; margin-top: 15px;">
            <p style="color: var(--text-muted); font-style: italic;">Diffs automatically map when this tab is opened.</p>
        </div>
    `;
}
window._activeSweepJobId = null;
window._activePushJobId = null;
window._activeDiffJobId = null;

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerTick) {
    window.inSetu.extensions.Registry.registerTick('git', 1000, async () => {
        // Sweep Job Polling
        if (window._activeSweepJobId) {
            try {
                const statusRes = await fetch(`/api/system/jobs/${window._activeSweepJobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    const spinner = document.getElementById('sweep-push-spinner');
                    const btn = document.getElementById('execute-sweep-btn');

                    if (spinner) spinner.innerText = statusData.message || "Committing and pushing...";

                    if (statusData.status === 'completed') {
                        window._activeSweepJobId = null;
                        document.getElementById('sweep-message').value = '';
                        await loadSweepFiles(); 
                        compileContexts().then(() => generateDiffs());
                        alert(`✅ Sweep successful:\n\n${statusData.message}`);
                        if (btn) btn.style.display = 'block';
                        if (spinner) {
                            spinner.style.display = 'none';
                            spinner.innerText = "Committing and pushing...";
                        }
                    } else if (statusData.status === 'failed') {
                        window._activeSweepJobId = null;
                        alert(`❌ Sweep failed:\n\n${statusData.message}`);
                        if (btn) btn.style.display = 'block';
                        if (spinner) {
                            spinner.style.display = 'none';
                            spinner.innerText = "Committing and pushing...";
                        }
                    }
                }
            } catch (e) {
                console.error("Sweep polling error:", e);
            }
        }

        // Push Job Polling
        if (window._activePushJobId) {
            try {
                const statusRes = await fetch(`/api/system/jobs/${window._activePushJobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    const spinner = document.getElementById('push-spinner');
                    const btn = document.getElementById('execute-push-btn');

                    if (spinner) spinner.innerText = statusData.message || "Pushing to remote... please wait.";

                    if (statusData.status === 'completed') {
                        window._activePushJobId = null;
                        const { currentPushRepo } = AppStore.getState();
                        alert(`✅ Successfully pushed ${currentPushRepo}!\n\n${statusData.message}`);
                        window.inSetu.ui.Factory.closeModal('push-modal');
                        try {
                            await compileContexts();
                            const activeWs = AppStore.getState().activeWorkspace || 'default';
                            const mRes = await fetch(`/api/${activeWs}/manifest?t=${Date.now()}`);
                            if (mRes.ok) window.inSetu.stores.App.setState({ manifest: await mRes.json() });
                        } catch (refreshErr) {
                            console.warn("Background refresh failed:", refreshErr);
                        } finally {
                            generateDiffs();
                        }
                    } else if (statusData.status === 'failed') {
                        window._activePushJobId = null;
                        alert(`❌ Push failed:\n\n${statusData.message}`);
                        if (btn) btn.style.display = 'block';
                        if (spinner) spinner.style.display = 'none';
                    }
                }
            } catch (e) {
                console.error("Push polling error:", e);
            }
        }
        // Diff Generation Polling
        if (window._activeDiffJobId) {
            try {
                const statusRes = await fetch(`/api/system/jobs/${window._activeDiffJobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    const loading = document.getElementById('diff-loading');
                    const results = document.getElementById('diff-results');
                    const sweepBtn = document.getElementById('btn-sweep-remaining');

                    if (loading) loading.innerText = statusData.message || "Analyzing Git trees...";

                    if (statusData.status === 'completed') {
                        window._activeDiffJobId = null;
                        const newFiles = statusData.artifact.files || [];
                        const targetRepos = statusData.artifact.target_repos;

                        if (!targetRepos) {
                            window._cachedDiffFiles = newFiles;
                            if (window._dirtyDiffRepos) window._dirtyDiffRepos.clear();
                        } else {
                            let mergedFiles = (window._cachedDiffFiles || []).filter(f => {
                                const repo = typeof f === 'object' ? f.repo : null;
                                return !repo || !targetRepos.includes(repo);
                            });
                            mergedFiles = mergedFiles.concat(newFiles);
                            window._cachedDiffFiles = mergedFiles;
                            if (window._dirtyDiffRepos) targetRepos.forEach(r => window._dirtyDiffRepos.delete(r));
                        }

                        renderDiffFiles(window._cachedDiffFiles);
                    } else if (statusData.status === 'failed') {
                        window._activeDiffJobId = null;
                        if (loading) loading.style.display = 'none';
                        if (results) results.innerHTML = `<p style="color: red;">Error analyzing diffs: ${statusData.message}</p>`;
                    }
                }
            } catch (e) {
                console.error("Diff polling error:", e);
            }
        }
    });
}
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    const markRepoDirty = (filepath) => {
        if (!filepath) return false;
        const repo = filepath.split('/')[0];
        if (repo) {
            if (!window._dirtyDiffRepos) window._dirtyDiffRepos = new Set();
            window._dirtyDiffRepos.add(repo);
        }
        return false;
    };

    window.inSetu.extensions.Registry.registerUIHook('zone:post-file-save', markRepoDirty);
    window.inSetu.extensions.Registry.registerUIHook('zone:post-file-delete', markRepoDirty);

    window.inSetu.extensions.Registry.registerUIHook('zone:subtab-changed', (data) => {
        if (data.parentId === 'context' && data.subId === 'diffs') {
            generateDiffs();
        }
        return false;
    });
    window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
        if (tabId === 'context' && localStorage.getItem('insetu_subtab_context') === 'diffs') {
            generateDiffs();
        }
        return false;
    });
}

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    window.inSetu.extensions.Registry.registerUIHook('zone:file-card-actions', (data) => {
        if (data.filepath && data.filepath.endsWith('_diffs.txt')) {
            const pushBtn = document.createElement('button');
            pushBtn.className = 'btn-sm';
            pushBtn.style.background = 'var(--intent-highlight)';
            pushBtn.innerText = '🚀 Push';
            pushBtn.onclick = () => openPushModal(data.filepath, data.repoDir);
            data.actionsContainer.appendChild(pushBtn);
        }
        return false; // Return false so we don't block other extensions from injecting buttons
    });
}
