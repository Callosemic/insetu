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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                repo: currentPushRepo,
                message: msg,
                diff_file: currentPushDiffFile
            })
        });
        const data = await res.json();
        if (res.ok) {
            if (data.status === 'partial') {
                alert(`⚠️ ${data.message}\n\nDetails:\n${data.error}`);
            } else {
                alert(`✅ Successfully pushed ${currentPushRepo}!\n\n${data.output}`);
            }
            if (window.inSetu.ui.Factory) window.inSetu.ui.Factory.closeModal(modalId);
            else {
                const m = document.getElementById(modalId);
                if (m) m.style.display = 'none';
            }
            // Silently re-hydrate the UI manifest and bundles
            try {
                await compileContexts();
                const activeWs = AppStore.getState().activeWorkspace || 'default';
                const mRes = await fetch(`/api/${activeWs}/manifest?t=${Date.now()}`);
                if (mRes.ok) setContextManifest(await mRes.json());
            } catch (refreshErr) {
                console.warn("Background refresh failed (likely due to auto-reload):", refreshErr);
            } finally {
                generateDiffs();
            }
        } else {
            alert(`❌ Push failed:\n\n${data.error}`);
        }
    } catch (e) {
        alert("Network error executing push. (The server may be reloading)");
    } finally {
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

        const data = await res.json();
        if (res.ok) {
            // Clear message and re-hydrate the modal to show what's left
            document.getElementById('sweep-message').value = '';
            await loadSweepFiles(); 

            // Silently sync the main UI behind the modal
            compileContexts().then(() => generateDiffs());
        } else {
            alert(`❌ Sweep failed:\n\n${data.error || 'Unknown error'}`);
        }
    } catch (e) {
        alert("Network error executing sweep.");
    } finally {
        btn.style.display = 'block';
        spinner.style.display = 'none';
    }
}
window.openPushModal = openPushModal;
window.executePush = executePush;
window.openSweepModal = openSweepModal;
window.executeSweepPush = executeSweepPush;

export async function generateDiffs() {
    const loading = document.getElementById('diff-loading');
    const results = document.getElementById('diff-results');
    if (!loading || !results) return;

    loading.style.display = 'block';
    results.innerHTML = '';
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/diffs/generate`, { method: 'POST' });
        const data = await res.json();
        const sweepBtn = document.getElementById('btn-sweep-remaining');

        loading.style.display = 'none';
        if (data.status === 'success' && data.files.length > 0) {
            if (sweepBtn) sweepBtn.style.display = 'block';
            const categories = {};
            const { categoryOrder, targetConfigs, hiddenOutputs, virtualContexts } = AppStore.getState();

            const resolveMetadata = (fileName) => {
                let cat = "Workspaces";
                let desc = "Pending diff payload.";
                let displayName = fileName;
                const baseFile = fileName.replace('_diffs.txt', '_context.txt');
                if (baseFile === 'prompts_context.txt') return {
                    cat: "Prompts & State",
                    desc: "Uncommitted prompt or state changes.",
                    displayName: 'prompts_diffs.txt'
                };
                if (virtualContexts) {
                    const vMatch = virtualContexts.find(v => v.out_file === fileName);
                    if (vMatch) return {
                        cat: vMatch.domain || "Extensions",
                        desc: vMatch.description || "Virtual context payload.",
                        displayName: vMatch.title || fileName
                    };
                }

                for (const cfg of targetConfigs) {
                    const safeRepoDir = cfg.repo_dir.startsWith('.') ? 'dot_' + cfg.repo_dir.substring(1) : cfg.repo_dir;
                    const safeId = safeRepoDir.replace(/-/g, '_');
                    const expectedOut = cfg.out_file || `${safeId}_context.txt`;
                    if (baseFile === expectedOut) return {
                        cat: cfg.domain || "Workspaces",
                        desc: `Uncommitted changes for ${cfg.title || cfg.repo_dir}.`,
                        displayName: (cfg.title || baseFile) + " (Diffs)"
                    };
                    if (cfg.sub_buckets) {
                        for (const b of cfg.sub_buckets) {
                            if (baseFile === b.out_file) return {
                                cat: b.domain || cfg.domain || "Workspaces",
                                desc: `Uncommitted changes for ${b.title || b.id}.`,
                                displayName: (b.title || baseFile) + " (Diffs)"
                            };
                        }
                    }
                }
                const rawModule = baseFile.replace('_context.txt', '');
                let matchedMeta = null;
                let parentBucket = null;
                for (const cfg of targetConfigs) {
                    if (cfg.sub_buckets) {
                        for (const b of cfg.sub_buckets) {
                            if (b.dynamic_split_prefix) {
                                if (b.meta_map && b.meta_map[rawModule]) {
                                    matchedMeta = b.meta_map[rawModule];
                                    parentBucket = b;
                                    break;
                                }
                                if (!parentBucket) parentBucket = b;
                            }
                        }
                    }
                    if (matchedMeta) break;
                }

                const title = matchedMeta?.title || rawModule.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const domain = matchedMeta?.domain || parentBucket?.domain || "Dynamic Modules";
                desc = matchedMeta?.description ? `Uncommitted changes for ${title} (${matchedMeta.description})` : (parentBucket?.description ? `Uncommitted changes for ${title} (${parentBucket.description})` : `Uncommitted logic changes for ${title}.`);
                return { cat: domain, desc: desc, displayName: title + " (Diffs)" };
            };

            data.files.forEach(fileObj => {
                const file = typeof fileObj === 'string' ? fileObj : fileObj.filename;
                const repoDir = typeof fileObj === 'object' ? fileObj.repo : null;
                if (hiddenOutputs && hiddenOutputs.includes(file)) return;
                const meta = resolveMetadata(file);
                if (!categories[meta.cat]) categories[meta.cat] = [];
                categories[meta.cat].push({
                    filename: file,
                    displayName: meta.displayName,
                    description: meta.desc,
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
                    catFiles.forEach(f => createFileCard(f, results));
                }
            }
        } else {
            if (sweepBtn) sweepBtn.style.display = 'none';
            results.innerHTML = '<p style="color: var(--text-muted);">No pending changes detected across tracked repositories.</p>';
        }
    } catch (error) {
        loading.style.display = 'none';
        results.innerHTML = `<p style="color: red;">Error analyzing diffs: ${error.message}</p>`;
    }
}
window.generateDiffs = generateDiffs;

const diffsScreen = window.inSetu.extensions.Registry.registerSubTab('context', 'diffs', 'Diffs');
if (diffsScreen) {
    diffsScreen.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <h2 style="margin: 0;">Pending Architecture (Diffs)</h2>
            <button id="btn-sweep-remaining" class="btn-sm" style="background: var(--intent-warning); margin: 0; padding: 4px 12px; font-size: 0.9rem; display: none;" onclick="openSweepModal()">🧹 Sweep Remaining</button>
        </div>
        <div id="diff-loading" class="spinner">Analyzing Git trees across sister repositories... please wait.</div>
        <div id="diff-results" style="display: flex; flex-direction: column; margin-top: 15px;">
            <p style="color: var(--text-muted); font-style: italic;">Diffs automatically map when this tab is opened.</p>
        </div>
    `;
}

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
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
