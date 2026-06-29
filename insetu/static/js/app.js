import {
    viewSourceFile,
    loadGlobalFS,
    createFileCard,
    downloadFile,
    globalBrowsePath,
    currentModalOriginalText
} from './fs.js';
import {
    loadGatherBatches
} from './gather.js';
import {
    loadTrackerBoard
} from './kanban.js';
import './git.js';
import './bridge.js';

export {
    viewSourceFile,
    createFileCard
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New update available. Refreshing...');
                        window.location.reload();
                    }
                });
            });
        }).catch(err => console.error('SW reg failed:', err));
    });
}
// Intercept window refreshes only if edits are actively staged or in progress
window.addEventListener('beforeunload', (e) => {
    let isDirty = false;

    const copyModal = document.getElementById('copy-modal');
    if (copyModal && copyModal.style.display === 'block' && typeof currentModalOriginalText !== 'undefined') {
        if (document.getElementById('modal-text').value !== currentModalOriginalText) isDirty = true;
    }

    const newFileModal = document.getElementById('new-file-modal');
    if (newFileModal && newFileModal.style.display === 'block' && document.getElementById('new-file-content').value.trim() !== '') isDirty = true;

    const newTaskModal = document.getElementById('new-task-modal');
    if (newTaskModal && newTaskModal.style.display === 'block' && document.getElementById('new-task-title').value.trim() !== '') isDirty = true;

    const payload = document.getElementById('payload');
    if (payload && payload.value.trim() !== '' && document.getElementById('tab-edit').classList.contains('active') && document.getElementById('st-bridge').classList.contains('active')) isDirty = true;

    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});
export let mdeInstance = null;
// --- EXTENSION REGISTRY ---
window.ExtensionRegistry = {
    registerTab: (id, label) => {
        const container = document.getElementById('main-tabs-container');
        if (!container) return null;

        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.onclick = (e) => switchTab(e, id);
        tab.innerText = label;
        // Append before the settings toggle logic if needed, or just append
        container.appendChild(tab);

        const content = document.createElement('div');
        content.id = 'tab-' + id;
        content.className = 'tab-content';
        content.innerHTML = `<div class="screen active" id="screen-${id}"></div>`;
        document.body.insertBefore(content, document.getElementById('copy-modal'));
        return content.querySelector('.screen');
    },
    registerSubTab: (parentId, id, label) => {
        const parentTab = document.getElementById('tab-' + parentId);
        if (!parentTab) return null;

        const subTabContainer = parentTab.querySelector('.sub-tabs');
        if (subTabContainer) {
            const st = document.createElement('div');
            st.className = 'sub-tab';
            st.id = 'st-' + id;
            st.onclick = () => switchSubTab(id);
            st.innerText = label;
            subTabContainer.appendChild(st);
        }

        const screen = parentTab.querySelector('.screen');
        if (!screen) return null;

        const subContent = document.createElement('div');
        subContent.id = 'sub-' + id;
        subContent.className = 'sub-tab-content';
        screen.appendChild(subContent);
        return subContent;
    }
};

async function bootExtensions() {
    if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.length > 0) {
        for (const ext of window.ACTIVE_EXTENSIONS) {
            try {
                // Dynamically load the module native to the browser
                await import(`/static/js/ext_${ext}.js`);
                console.log(`🔌 Loaded UI Extension: ${ext}`);
            } catch (e) {
                console.error(`⚠️ Failed to load UI extension: ${ext}`, e);
            }
        }
    }
}
// Restore UI State on Load
window.addEventListener('DOMContentLoaded', async () => {
    // The JS engine successfully booted. Hide the pure-HTML panic switch.
    const panicBtn = document.getElementById('js-panic-button');
    if (panicBtn) panicBtn.style.display = 'none';

    await bootExtensions();

    const textArea = document.getElementById('modal-text');
    if (textArea && typeof EasyMDE !== 'undefined') {
        // Initialize the No-Nonsense Editor
        mdeInstance = new EasyMDE({
            element: textArea,
            toolbar: false,
            status: false,
            spellChecker: false,
            forceSync: true
        });

        // Bridge global CodeMirror modes (Python, JS, etc.) into EasyMDE's internal engine
        if (window.CodeMirror && window.CodeMirror.modes) {
            Object.assign(mdeInstance.codemirror.constructor.modes, window.CodeMirror.modes);
            Object.assign(mdeInstance.codemirror.constructor.mimeModes, window.CodeMirror.mimeModes);
        }

        // Proxy changes back to the native textarea so legacy logic survives
        mdeInstance.codemirror.on("change", () => {
            textArea.value = mdeInstance.value();
            textArea.dispatchEvent(new Event('input'));
        });
    }
    const savedTab = localStorage.getItem('insetu_tab');
    if (savedTab) {
        switchTab(null, savedTab);
        const savedSub = localStorage.getItem('insetu_subtab_' + savedTab);
        if (savedSub) switchSubTab(savedSub);
    }
});

const currentTheme = localStorage.getItem('insetu_theme') || 'dark';
document.body.setAttribute('data-theme', currentTheme);

const settingsToggle = document.getElementById('settings-toggle');
const settingsMenu = document.getElementById('settings-menu');

if (settingsToggle && settingsMenu) {
    settingsToggle.onclick = (e) => {
        e.stopPropagation();
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
    };

    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsToggle) {
            settingsMenu.style.display = 'none';
        }
    });
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = () => {
            const newTheme = btn.getAttribute('data-theme-value');
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('insetu_theme', newTheme);
            settingsMenu.style.display = 'none';
            updateThemeSelectionUI(newTheme);
        };
    });
}
async function loadWorkspaces() {
    try {
        const res = await fetch('/api/system/workspaces');
        if (!res.ok) return;
        const data = await res.json();

        if (data.workspaces && Object.keys(data.workspaces).length > 0) {
            document.getElementById('workspaces-header').style.display = 'block';
            const list = document.getElementById('workspaces-list');
            list.style.display = 'flex';
            list.innerHTML = '';

            Object.entries(data.workspaces).forEach(([key, ws]) => {
                const btn = document.createElement('button');
                const isActive = data.active_workspace === key;
                btn.innerText = (isActive ? '🟢 ' : '⚪ ') + (ws.title || key);
                btn.style.cssText = `margin: 0; background: ${isActive ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${isActive ? 'var(--border)' : 'transparent'}; cursor: pointer; border-radius: 4px; font-weight: ${isActive ? 'bold' : 'normal'};`;
                btn.onclick = async () => {
                    if (isActive) return;
                    btn.innerText = '⏳ Switching...';

                    // Clear aggressive Service Worker caches to prevent ghost states
                    if ('caches' in window) {
                        try {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(k => caches.delete(k)));
                        } catch(e) {}
                    }

                    await fetch('/api/system/workspaces', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ active_workspace: key })
                    });

                    // Poll the backend until it comes back online, then hard refresh
                    const pollInterval = setInterval(async () => {
                        try {
                            const ping = await fetch('/api/manifest?t=' + Date.now(), { cache: 'no-store' });
                            if (ping.ok) {
                                clearInterval(pollInterval);
                                window.location.href = window.location.pathname + '?v=' + Date.now();
                            }
                        } catch (e) {
                            // Backend is still rebooting via os.execv
                        }
                    }, 1000);
                };
                list.appendChild(btn);
            });
        }
    } catch(e) {
        console.error("Failed to load workspaces:", e);
    }
}
loadWorkspaces();

function updateThemeSelectionUI(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.getAttribute('data-theme-value') === theme) {
            btn.style.fontWeight = 'bold';
            btn.style.border = '1px solid var(--border)';
            btn.style.borderRadius = '4px';
            btn.style.background = 'var(--input-bg)';
        } else {
            btn.style.fontWeight = 'normal';
            btn.style.border = '1px solid transparent';
            btn.style.background = 'transparent';
        }
    });
}
updateThemeSelectionUI(currentTheme);

function switchTab(event, tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (event) {
        event.currentTarget.classList.add('active');
    } else {
        const targetTab = document.querySelector(`.tab[onclick*="${tabId}"]`);
        if (targetTab) targetTab.classList.add('active');
    }
    document.getElementById('tab-' + tabId).classList.add('active');
    localStorage.setItem('insetu_tab', tabId);

    if (tabId === 'context') loadContext();
    if (tabId === 'tasks') loadTrackerBoard();
    if (tabId === 'edit' && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
}

function switchSubTab(subId) {
    // Scope sub-tab switching to the active parent tab to prevent clearing all sub-tabs globally
    const activeTabContent = document.querySelector('.tab-content.active');
    if (!activeTabContent) return;

    activeTabContent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    activeTabContent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));

    const parentTabId = activeTabContent.id.replace('tab-', '');
    localStorage.setItem('insetu_subtab_' + parentTabId, subId);
    const targetSt = document.getElementById('st-' + subId);
    const targetSub = document.getElementById('sub-' + subId);
    if (targetSt) targetSt.classList.add('active');
    if (targetSub) targetSub.classList.add('active');
    if (subId === 'files') loadGlobalFS();
    const pasteBtn = document.getElementById('btn-paste');
    const newFileBtn = document.getElementById('btn-new-file');
    const newFolderBtn = document.getElementById('btn-new-folder');
    if (subId === 'diffs') {
        generateDiffs();
    }

    if (subId === 'prompts') {
        renderPromptsTab();
    }

    if (subId === 'gather') {
        loadGatherBatches();
    }
    const consoleArea = document.getElementById('bridge-console-area');
    if (pasteBtn) pasteBtn.style.display = (subId === 'bridge' && consoleArea && consoleArea.style.display !== 'flex') ? 'block' : 'none';
    if (newFileBtn) newFileBtn.style.display = (subId === 'files' && globalBrowsePath.length > 0) ? 'block' : 'none';
    if (newFolderBtn) newFolderBtn.style.display = (subId === 'files') ? 'block' : 'none';
}
async function renderPromptsTab() {
    const container = document.getElementById('prompts-list');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="display:block;">Loading prompts...</div>';
    try {
        const res = await fetch('/api/batches');
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        globalGatherOptions.prompts = data.available_prompts || [];
        globalGatherOptions.artifactsDir = data.artifacts_dir || ".insetu/profiles/default/data";
        globalGatherOptions.profileDir = data.profile_dir || ".insetu/profiles/default";
    } catch (e) {
        console.error("Failed to fetch prompts:", e);
    }

    container.innerHTML = '';

    // Utilize dynamically discovered prompts from the active batches lookup
    const promptFiles = (globalGatherOptions.prompts || []).map(p => `${globalGatherOptions.profileDir}/${p}`);
    if (promptFiles.length === 0) {
        container.innerHTML = '<p style="color: #888; font-style: italic;">No prompts found in workspace.</p>';
        return;
    }

    promptFiles.forEach(filepath => {
        const filename = filepath.split('/').pop();

        const card = document.createElement('div');
        card.className = 'file-card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';

        const titleSpan = document.createElement('a');
        titleSpan.className = 'file-title';
        titleSpan.innerText = `📄 ${filename}`;
        titleSpan.style.cursor = 'pointer';
        titleSpan.style.textDecoration = 'none';
        titleSpan.title = 'Click to View/Edit';
        titleSpan.onclick = (e) => {
            e.preventDefault();
            viewSourceFile(filepath, true);
        };

        const actions = document.createElement('div');
        actions.className = 'file-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-sm';
        copyBtn.style.background = '#10b981';
        copyBtn.style.margin = '0';
        copyBtn.innerText = '📋 Copy';
        copyBtn.onclick = () => fetchAndCopy(filepath, copyBtn);

        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn-sm';
        dlBtn.style.background = '#0284c7';
        dlBtn.style.margin = '0';
        dlBtn.style.color = 'white';
        dlBtn.style.border = 'none';
        dlBtn.innerText = '⬇️ DL';
        dlBtn.onclick = () => fetchAndDownloadState(filepath, dlBtn);

        actions.appendChild(copyBtn);
        actions.appendChild(dlBtn);

        card.appendChild(titleSpan);
        card.appendChild(actions);
        container.appendChild(card);
    });
}
export async function generateDiffs() {
    const loading = document.getElementById('diff-loading');
    const results = document.getElementById('diff-results');
    loading.style.display = 'block';
    results.innerHTML = '';

    try {
        const res = await fetch('/api/diffs/generate', {
            method: 'POST'
        });
        const data = await res.json();

        loading.style.display = 'none';
        if (data.status === 'success' && data.files.length > 0) {
            const categories = {};
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
                if (baseFile.includes('tracker')) {
                    const cleanName = baseFile.replace('_tracker_context.txt', '').replace(/^dot_/, '.').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
                    return {
                        cat: "Issue Trackers",
                        desc: "Uncommitted tracker changes.",
                        displayName: `${cleanName} Tracker (Diffs)`
                    };
                }
                for (const cfg of TARGET_CONFIGS) {
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

                for (const cfg of TARGET_CONFIGS) {
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

                return {
                    cat: domain,
                    desc: desc,
                    displayName: title + " (Diffs)"
                };
            };
            data.files.forEach(file => {
                if (typeof HIDDEN_OUTPUTS !== 'undefined' && HIDDEN_OUTPUTS.includes(file)) return;
                const meta = resolveMetadata(file);
                if (!categories[meta.cat]) categories[meta.cat] = [];
                categories[meta.cat].push({
                    filename: file,
                    displayName: meta.displayName,
                    description: meta.desc,
                    isFS: false
                });
            });
            const sortedCats = Object.keys(categories).sort((a, b) => {
                let iA = CATEGORY_ORDER.indexOf(a);
                let iB = CATEGORY_ORDER.indexOf(b);
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
            results.innerHTML = '<p style="color: #888;">No pending changes detected across tracked repositories.</p>';
        }
    } catch (error) {
        loading.style.display = 'none';
        results.innerHTML = `<p style="color: red;">Error analyzing diffs: ${error.message}</p>`;
    }
}

let lastRefreshed = null;
let refreshInterval = null;

function updateRefreshText() {
    if (!lastRefreshed) return;
    const now = new Date();
    const diff = Math.floor((now - lastRefreshed) / 1000);
    let text = "";
    if (diff < 60) text = `${diff} second${diff !== 1 ? 's' : ''} ago`;
    else if (diff < 3600) text = `${Math.floor(diff/60)} minute${Math.floor(diff/60) !== 1 ? 's' : ''} ago`;
    else text = `${Math.floor(diff/3600)} hour${Math.floor(diff/3600) !== 1 ? 's' : ''} ago`;

    const el = document.getElementById('refresh-time');
    if (el) el.innerText = `Refreshed ${text}`;
}
export function normalizeAccentText(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export let globalGatherOptions = {
    contexts: [],
    diffs: [],
    prompts: []
};

export function setGlobalStatus(msg, timeout = 3000) {
    const bar = document.getElementById('global-status-bar');
    if (!bar) return;
    bar.innerText = msg;
    if (timeout) {
        setTimeout(() => {
            if (bar.innerText === msg) bar.innerText = bar.getAttribute('data-default');
        }, timeout);
    }
}
window.setGlobalStatus = setGlobalStatus;

export async function executeWorkspaceMutation(url, payload, options = {}) {
    const {
        btnId,
        loadingText = "Processing...",
        silent = false,
        onSuccess = () => {}
    } = options;
    const btn = btnId ? document.getElementById(btnId) : null;
    let origText = "";
    if (btn && !silent) {
        origText = btn.innerText;
        btn.innerText = loadingText;
        setGlobalStatus(loadingText, null);
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            await onSuccess(res);
        } else if (!silent) {
            let errMsg = res.statusText;
            try {
                const errData = await res.clone().json();
                errMsg = errData.error || errMsg;
            } catch (parseError) {
                const rawText = await res.text();
                errMsg = `Raw Server Error (${res.status}):\n\n${rawText.substring(0, 500)}`;
            }
            alert(`Operation failed.\nReason: ${errMsg}`);
        }
        return res.ok;
    } catch (e) {
        if (!silent) {
            alert(`Network error: ${e.message}`);
            setGlobalStatus(`❌ Error: ${e.message}`, 5000);
        }
        return false;
    } finally {
        if (btn && !silent) {
            btn.innerText = origText;
            setGlobalStatus("✅ Success!", 2000);
        }
    }
}

export function renderContextFiles(files, msg) {
    document.getElementById('result-message').style.display = 'none';
    const downloadContainer = document.getElementById('context-download-links');
    downloadContainer.innerHTML = '';
    if (files && files.length > 0) {
        const categories = {};
        const resolveMetadata = (fileName) => {
            let cat = "Workspaces";
            let desc = "Repository context payload.";
            let displayName = fileName;
            if (fileName === 'prompts_context.txt') return {
                cat: "Prompts & State",
                desc: "The Master Ingestion Prompt and CLI templates.",
                displayName: 'prompts_context.txt'
            };
            if (fileName.includes('tracker')) {
                const cleanName = fileName.replace('_tracker_context.txt', '').replace(/^dot_/, '.').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
                return {
                    cat: "Issue Trackers",
                    desc: "Active bugs, tasks, and planned units of work.",
                    displayName: `${cleanName} Tracker`
                };
            }
            for (const cfg of TARGET_CONFIGS) {
                const safeRepoDir = cfg.repo_dir.startsWith('.') ? 'dot_' + cfg.repo_dir.substring(1) : cfg.repo_dir;
                const safeId = safeRepoDir.replace(/-/g, '_');
                const expectedOut = cfg.out_file || `${safeId}_context.txt`;
                if (fileName === expectedOut) return {
                    cat: cfg.domain || "Workspaces",
                    desc: cfg.description || `Context payload for ${cfg.title || cfg.repo_dir}.`,
                    displayName: cfg.title || fileName
                };
                if (cfg.sub_buckets) {
                    for (const b of cfg.sub_buckets) {
                        if (fileName === b.out_file) return {
                            cat: b.domain || cfg.domain || "Workspaces",
                            desc: b.description || `Context payload for ${b.title || b.id}.`,
                            displayName: b.title || b.out_file
                        };
                    }
                }
            }
            const rawModule = fileName.replace('_context.txt', '');
            let matchedMeta = null;
            let parentBucket = null;

            for (const cfg of TARGET_CONFIGS) {
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
            desc = matchedMeta?.description || parentBucket?.description || `Dynamically mapped logic and templates for ${title}.`;

            return {
                cat: domain,
                desc: desc,
                displayName: title
            };
        };
        files.forEach(file => {
            if (typeof HIDDEN_OUTPUTS !== 'undefined' && HIDDEN_OUTPUTS.includes(file)) return;
            const meta = resolveMetadata(file);
            if (!categories[meta.cat]) categories[meta.cat] = [];
            categories[meta.cat].push({
                filename: file,
                displayName: meta.displayName,
                description: meta.desc,
                isFS: false
            });
        });
        const sortedCats = Object.keys(categories).sort((a, b) => {
            let iA = CATEGORY_ORDER.indexOf(a);
            let iB = CATEGORY_ORDER.indexOf(b);
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
                downloadContainer.appendChild(heading);
                catFiles.forEach(f => createFileCard(f, downloadContainer));
            }
        }
    }
}

export let contextManifest = {};
export function setContextManifest(m) {
    contextManifest = m;
}
let contextSearchTimeout = null;
export function filterContexts(query) {
    clearTimeout(contextSearchTimeout);
    contextSearchTimeout = setTimeout(() => {
        const q = query.toLowerCase().trim();
        const container = document.getElementById('context-download-links');
        const categories = container.querySelectorAll('.category-heading');
        categories.forEach(cat => {
            let hasVisible = false;
            let nextEl = cat.nextElementSibling;
            while (nextEl && nextEl.classList.contains('file-card')) {
                const title = nextEl.querySelector('.file-title').innerText.toLowerCase();
                if (title.includes(q)) {
                    nextEl.style.display = 'block';
                    hasVisible = true;
                } else {
                    nextEl.style.display = 'none';
                }
                nextEl = nextEl.nextElementSibling;
            }
            cat.style.display = hasVisible ? 'block' : 'none';
        });
    }, 200);
}

async function finishContextLoad(result) {
    try {
        const mRes = await fetch('/api/manifest?t=' + Date.now());
        if (mRes.ok) contextManifest = await mRes.json();
    } catch (e) {
        console.error("Manifest error", e);
    }

    renderContextFiles(result.files, result.message);
    lastRefreshed = new Date();
    updateRefreshText();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(updateRefreshText, 1000);

    document.getElementById('context-loading').style.display = 'none';
    document.getElementById('context-results').style.display = 'block';
}
let compilePromise = null;
export function compileContexts() {
    if (compilePromise) return compilePromise;

    compilePromise = (async () => {
        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            return await response.json();
        } catch (error) {
            throw error;
        } finally {
            compilePromise = null;
        }
    })();

    return compilePromise;
}

async function loadContext() {
    document.getElementById('context-loading').style.display = 'block';
    document.getElementById('context-results').style.display = 'none';
    try {
        const result = await compileContexts();
        if (result.status === 'error') {
            document.getElementById('result-message').innerText = "❌ " + result.message;
            document.getElementById('result-message').style.color = "red";
            document.getElementById('result-message').style.display = 'block';
            document.getElementById('context-loading').style.display = 'none';
            document.getElementById('context-results').style.display = 'block';
        } else {
            finishContextLoad(result);
        }
    } catch (error) {
        document.getElementById('result-message').innerText = "❌ Network or syntax error compiling files.";
        document.getElementById('result-message').style.color = "red";
        document.getElementById('result-message').style.display = 'block';
        document.getElementById('context-loading').style.display = 'none';
        document.getElementById('context-results').style.display = 'block';
    }
}
async function simulatePanic() {
    if (!confirm("This will intentionally crash the server to test the Immutable Recovery Bootloader. The page will reload in 3 seconds. Continue?")) return;
    const btn = document.getElementById('simulate-panic-btn');
    if (btn) btn.innerText = "⏳ Crashing...";
    try {
        await fetch('/api/system/panic', { method: 'POST' });
        setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
        alert("Error triggering panic.");
    }
}

async function fullRefresh() {
    const btn = document.getElementById('full-refresh-btn');
    if (btn) btn.innerText = "⏳ Syncing...";
    try {
        // Purge stale UI state before syncing
        localStorage.removeItem('insetu_pinned_repos');
        localStorage.removeItem('insetu_task_pinned_repos');
        localStorage.removeItem('insetu_task_pinned_buckets');
        localStorage.removeItem('insetu_task_pinned_tags');

        await compileContexts();
        window.location.reload();
    } catch (error) {
        alert("Error during full refresh.");
        if (btn) btn.innerText = "🔄 Full Refresh";
    }
}
/* ==========================================================================
   BRIDGE LOGIC (Extracted to bridge.js)
   ========================================================================== */

export let ALL_REPOS = [];
export let TARGET_CONFIGS = [];
export let CATEGORY_ORDER = [];
export function setAllRepos(r) {
    ALL_REPOS = r;
}
export function setTargetConfigs(c) {
    TARGET_CONFIGS = c;
}
let HIDDEN_OUTPUTS = [];
fetch('/api/repos').then(r => r.json()).then(d => {
ALL_REPOS = d.repos;
TARGET_CONFIGS = d.targets || [];
CATEGORY_ORDER = d.category_order || [];
HIDDEN_OUTPUTS = d.hidden_outputs || [];

if (d.config_missing) {
    const banner = document.createElement('div');
    banner.style.cssText = "background: #f59e0b; color: #000; padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem;";
    banner.innerHTML = "⚠️ Configuration file missing. Operating in empty fallback state. <span style='cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;' onclick='this.parentElement.style.display=\"none\"'>Dismiss</span>";
    document.body.appendChild(banner);
}

renderRepoPins();
if (typeof window.renderTaskRepoPins === 'function') window.renderTaskRepoPins();
});
export let pinnedRepos = new Set(JSON.parse(localStorage.getItem('insetu_pinned_repos')) || ["ALL"]);
export function renderRepoPins() {
    const container = document.getElementById('repo-pins');
    if (!container) return;
    container.innerHTML = '';

    const lbl = document.createElement('span');
    lbl.innerText = "📌 Repos:";
    lbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap;";
    container.appendChild(lbl);
    const createPill = (id, label) => {
        const btn = document.createElement('button');
        const isActive = pinnedRepos.has(id);
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = label;
        btn.style.cssText = `padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;
        btn.onclick = () => {
            if (id === "ALL") {
                pinnedRepos.clear();
                pinnedRepos.add("ALL");
            } else {
                pinnedRepos.delete("ALL");
                if (pinnedRepos.has(id)) {
                    pinnedRepos.delete(id);
                    if (pinnedRepos.size === 0) pinnedRepos.add("ALL");
                } else {
                    pinnedRepos.add(id);
                }
            }
            localStorage.setItem('insetu_pinned_repos', JSON.stringify(Array.from(pinnedRepos)));
            renderRepoPins();
        };
        return btn;
    };
    container.appendChild(createPill("ALL", "All"));
    ALL_REPOS.forEach(repo => container.appendChild(createPill(repo, repo)));
}
// Initialize pins
setTimeout(renderRepoPins, 100);

export async function fetchAndCopy(filePath, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "Fetching...";
    try {
        const res = await fetch('/api/bridge/fetch?file=' + encodeURIComponent(filePath));
        if (!res.ok) throw new Error("File not found on disk.");
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        btnElement.innerText = "✅ Copied!";
    } catch (e) {
        btnElement.innerText = "❌ Error: " + e.message;
    }
    setTimeout(() => {
        btnElement.innerText = originalText;
    }, 3000);
}
export async function fetchAndDownloadState(filePath, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "Fetching...";
    try {
        await downloadFile('/api/bridge/fetch?file=' + encodeURIComponent(filePath), filePath.split('/').pop());
        btnElement.innerText = "✅ Downloaded!";
    } catch (e) {
        btnElement.innerText = "❌ Error: " + e.message;
    }
    setTimeout(() => {
        btnElement.innerText = originalText;
    }, 3000);
}
/* ==========================================================================
    TRACKER LOGIC (Extracted to kanban.js)
    ========================================================================== */

/* ==========================================================================
    AUTO-HYDRATION (RUNS ON PAGE LOAD)
    ========================================================================== */
(async function hydrateEcosystem() {
    try {
        // Silently compile context to ensure the file tree and tracker are fresh
        await compileContexts();
        // Fetch the newly compiled manifest
        const mRes = await fetch('/api/manifest?t=' + Date.now());
        if (mRes.ok) {
            contextManifest = await mRes.json();

            // If the user happens to load directly into a tab that needs the manifest, render it
            if (document.getElementById('tab-edit').classList.contains('active') && document.getElementById('st-files').classList.contains('active')) {
                loadGlobalFS();
            }
            if (document.getElementById('tab-tasks').classList.contains('active')) {
                loadTrackerBoard();
            }
        }
    } catch (e) {
        console.error("Auto-hydration failed:", e);
    }
})();

/* ==========================================================================
            ES6 MODULE PREPARATION (WINDOW BRIDGE)
            Explicitly binding UI-triggered functions to the global scope so they 
            survive the transition to <script type="module">
            ========================================================================== */
window.normalizeAccentText = normalizeAccentText;
window.switchTab = switchTab;
window.switchSubTab = switchSubTab;
window.fullRefresh = fullRefresh;
window.simulatePanic = simulatePanic;
// Context / Gather
window.filterContexts = filterContexts;
