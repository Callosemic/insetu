import {
    mdeInstance,
    executeWorkspaceMutation,
    contextManifest,
    setContextManifest,
    TARGET_CONFIGS,
    setTargetConfigs,
    ALL_REPOS,
    setAllRepos,
    renderRepoPins,
    compileContexts,
    fetchAndCopy,
    fetchAndDownloadState
} from './app.js';
import {
    openPushModal
} from './git.js';
let currentModalFile = '';
export let currentModalOriginalText = '';
let currentModalIsFS = false;
let isPreviewMode = false;

export async function downloadFile(fetchUrl, fallbackFilename) {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('Download failed from server.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;

    let dlName = fallbackFilename;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) dlName = matches[1].replace(/['"]/g, '');
    }

    a.download = dlName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

function renderMarkdownPreview() {
    const preview = document.getElementById('modal-preview');
    let text = document.getElementById('modal-text').value;

    // Intercept YAML frontmatter and wrap it in a custom styled block
    const yamlRegex = /^---\n([\s\S]*?)\n---/;
    text = text.replace(yamlRegex, '<pre class="yaml-frontmatter">$1</pre>');

    preview.innerHTML = marked.parse(text);

    const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb, index) => {
        cb.disabled = false;
        cb.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            let rawText = document.getElementById('modal-text').value;
            const checkboxRegex = /^(\s*[-*+]\s+\[)[ xX](\])/gm;
            let matchCount = 0;

            rawText = rawText.replace(checkboxRegex, (match, p1, p2) => {
                if (matchCount === index) {
                    matchCount++;
                    return p1 + (isChecked ? 'x' : ' ') + p2;
                }
                matchCount++;
                return match;
            });

            document.getElementById('modal-text').value = rawText;
            if (currentModalIsFS) saveModalFile(true);
        });
    });
}

function toggleModalMode() {
    if (isPreviewMode && currentModalFile.includes('.tracker/')) {
        document.getElementById('copy-modal').style.display = 'none';
        openEditTaskModal(currentModalFile);
        return;
    }

    isPreviewMode = !isPreviewMode;
    const toggleBtn = document.getElementById('modal-toggle-btn');
    const textArea = document.getElementById('modal-text');
    const preview = document.getElementById('modal-preview');

    const ext = currentModalFile.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown',
        'py': 'python',
        'js': 'javascript',
        'json': 'javascript',
        'sh': 'shell'
    };
    const isSupportedEditor = !!modeMap[ext];
    const isMarkdown = ext === 'md';

    const mdeWrap = document.querySelector('.EasyMDEContainer');

    if (isPreviewMode) {
        renderMarkdownPreview();
        textArea.style.display = 'none';
        if (mdeWrap) mdeWrap.style.display = 'none';
        preview.style.display = 'block';
        toggleBtn.innerText = '📝 Edit';
    } else {
        if (isSupportedEditor && mdeWrap) {
            mdeWrap.style.display = 'flex';
            textArea.style.display = 'none';
            if (typeof mdeInstance !== 'undefined' && mdeInstance) setTimeout(() => mdeInstance.codemirror.refresh(), 10);
        } else {
            if (mdeWrap) mdeWrap.style.display = 'none';
            textArea.style.display = 'block';
        }
        preview.style.display = 'none';
        toggleBtn.innerText = '👁️ Preview';
    }
}

async function viewAndCopy(filename) {
    currentModalFile = filename;
    currentModalIsFS = false;
    document.getElementById('modal-title').innerText = filename;

    const textArea = document.getElementById('modal-text');
    const preview = document.getElementById('modal-preview');
    const toggleBtn = document.getElementById('modal-toggle-btn');

    const ext = filename.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown',
        'py': 'python',
        'js': 'javascript',
        'json': 'javascript',
        'sh': 'shell'
    };
    const codeMode = modeMap[ext];
    const isSupportedEditor = !!codeMode;
    const isMarkdown = ext === 'md';
    if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.value("Loading...");
        mdeInstance.codemirror.setOption("mode", codeMode);
        mdeInstance.codemirror.setOption("readOnly", "nocursor");
    } else {
        textArea.value = "Loading...";
        textArea.readOnly = true;
    }

    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('copy-modal').style.display = 'block';
    closeBrowseModal();
    document.getElementById('modal-edit-toolbar').style.display = 'none';

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    if (isMarkdown) {
        toggleBtn.style.display = 'block';
        isPreviewMode = true;
        textArea.style.display = 'none';
        if (mdeWrap) mdeWrap.style.display = 'none';
        preview.style.display = 'block';
        toggleBtn.innerText = '📝 Edit';
        preview.innerHTML = '<p>Loading...</p>';
    } else {
        toggleBtn.style.display = 'none';
        isPreviewMode = false;
        preview.style.display = 'none';
        if (isSupportedEditor && mdeWrap) {
            mdeWrap.style.display = 'flex';
            textArea.style.display = 'none';
            setTimeout(() => mdeInstance.codemirror.refresh(), 10);
        } else {
            if (mdeWrap) mdeWrap.style.display = 'none';
            textArea.style.display = 'block';
        }
    }

    try {
        const res = await fetch(`/download/${filename}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(text);
        else textArea.value = text;
        currentModalOriginalText = text;
        if (isMarkdown && isPreviewMode) renderMarkdownPreview();
    } catch (e) {
        const errText = "Error loading file content.";
        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(errText);
        else textArea.value = errText;
        currentModalOriginalText = "";
        if (isMarkdown && isPreviewMode) preview.innerHTML = '<p style="color:red;">Error loading file.</p>';
    }
}

document.getElementById('modal-text').addEventListener('input', (e) => {
    if (currentModalIsFS) {
        const saveBtn = document.getElementById('modal-save-btn');
        if (e.target.value !== currentModalOriginalText) {
            saveBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'none';
        }
    }
});

function updateManifestState(oldPath, newPath = null) {
    Object.values(contextManifest).forEach(fileArray => {
        const index = fileArray.indexOf(oldPath);
        if (index > -1) {
            fileArray.splice(index, 1);
            if (newPath) fileArray.push(newPath);
        }
    });
    if (document.getElementById('browse-modal').style.display === 'block') {
        const index = currentBrowseManifest.indexOf(oldPath);
        if (index > -1) {
            currentBrowseManifest.splice(index, 1);
            if (newPath) currentBrowseManifest.push(newPath);
        }
        currentFileTree = buildFileTree(currentBrowseManifest);
        renderBrowseLevel();
    }
}

async function saveModalFile(autoSave = false) {
    if (autoSave !== true) autoSave = false; // Event object trap defense

    let content = document.getElementById('modal-text').value;

    // Auto-sanitize non-breaking spaces that crash JSON and Python parsers
    content = content.replace(/\u00A0/g, ' ');

    // Pre-flight JSON validation
    if (currentModalFile.toLowerCase().endsWith('.json')) {
        try {
            JSON.parse(content);
        } catch (e) {
            alert("Invalid JSON syntax: " + e.message);
            return;
        }
    }

    await executeWorkspaceMutation('/api/fs/save', {
        filepath: currentModalFile,
        content: content
    }, {
        btnId: 'modal-save-btn',
        loadingText: 'Saving...',
        silent: autoSave,
        onSuccess: () => {
            currentModalOriginalText = content;
            document.getElementById('modal-save-btn').style.display = 'none';
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
            if (autoSave && currentModalFile.includes('.tracker/')) loadTrackerBoard();
        }
    });
}

function copyFromModal() {
    const text = document.getElementById('modal-text').value;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('#copy-modal button[style*="10b981"]');
        const origText = btn.innerText;
        btn.innerText = "✅ Copied!";
        setTimeout(() => btn.innerText = origText, 2000);
    }).catch(err => {
        alert("Clipboard API failed. Please manually select the text and copy it directly from the text box.");
    });
}

function openMoveModal() {
    document.getElementById('move-dest-path').value = currentModalFile;
    document.getElementById('move-modal').style.display = 'block';
}

async function executeMove() {
    const destPath = document.getElementById('move-dest-path').value.trim();
    if (!destPath || destPath === currentModalFile) return alert("Please enter a valid new destination path.");

    await executeWorkspaceMutation('/api/fs/move', {
        filepath: currentModalFile,
        dest_path: destPath
    }, {
        btnId: 'execute-move-btn',
        loadingText: 'Moving...',
        onSuccess: () => {
            document.getElementById('move-modal').style.display = 'none';
            document.getElementById('copy-modal').style.display = 'none';
            updateManifestState(currentModalFile, destPath);
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
        }
    });
}

async function archiveModalFile() {
    if (!confirm("Are you sure you want to archive this file?\nIt will be moved to an 'archived/' subdirectory.")) return;

    await executeWorkspaceMutation('/api/fs/archive', {
        filepath: currentModalFile
    }, {
        onSuccess: () => {
            document.getElementById('copy-modal').style.display = 'none';
            updateManifestState(currentModalFile);
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
        }
    });
}

async function deleteModalFile() {
    if (!confirm("Are you sure you want to delete this file?\nThis cannot be undone!")) return;

    await executeWorkspaceMutation('/api/fs/delete', {
        filepath: currentModalFile
    }, {
        onSuccess: () => {
            document.getElementById('copy-modal').style.display = 'none';
            updateManifestState(currentModalFile);
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
        }
    });
}

function cleanModalFile() {
    if (!confirm("Clean LLM cite and span tags from this file?")) return;
    let text = document.getElementById('modal-text').value;
    text = text.replace(/\]+\]/g, '');
    text = text.replace(/\[span_\d+\]\((start_span|end_span)\)/g, '');

    const ext = currentModalFile.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown',
        'py': 'python',
        'js': 'javascript',
        'json': 'javascript',
        'sh': 'shell'
    };
    const isSupportedEditor = !!modeMap[ext];

    if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.value(text);
    } else {
        document.getElementById('modal-text').value = text;
        document.getElementById('modal-text').dispatchEvent(new Event('input'));
    }
}

async function downloadFromModal() {
    const btn = document.getElementById('modal-dl-btn');
    if (!btn) return;
    const origText = btn.innerText;
    btn.innerText = '⏳...';
    try {
        const fetchUrl = currentModalIsFS ? `/api/bridge/fetch?file=${encodeURIComponent(currentModalFile)}` : `/download/${currentModalFile}`;
        await downloadFile(fetchUrl, currentModalFile.split('/').pop());
    } catch (e) {
        alert("Error downloading file: " + e.message);
    } finally {
        btn.innerText = origText;
    }
}

export function createFileCard(fileInfo, container) {
    const card = document.createElement('div');
    card.className = 'file-card';
    const header = document.createElement('div');
    header.className = 'file-card-header';
    const titleSpan = document.createElement('a');
    titleSpan.className = 'file-title';
    titleSpan.innerText = `📄 ${fileInfo.displayName || fileInfo.filename}`;
    titleSpan.style.cursor = 'pointer';
    titleSpan.style.textDecoration = 'none';
    titleSpan.title = fileInfo.isFS ? 'Click to Edit' : 'Click to View';

    if (fileInfo.isSource) {
        titleSpan.onclick = (e) => {
            e.preventDefault();
            viewSourceFile(fileInfo.filename, fileInfo.isFS);
        };
    } else {
        titleSpan.onclick = (e) => {
            e.preventDefault();
            viewAndCopy(fileInfo.filename);
        };
    }

    const actions = document.createElement('div');
    actions.className = 'file-actions';
    if (!fileInfo.isSource && contextManifest[fileInfo.filename]) {
        const browseBtn = document.createElement('button');
        browseBtn.className = 'btn-sm';
        browseBtn.style.background = '#8b5cf6';
        browseBtn.innerText = '📁 Browse';
        browseBtn.onclick = () => openBrowseModal(fileInfo.filename);
        actions.appendChild(browseBtn);
    }

    if (fileInfo.filename.endsWith('_diffs.txt')) {
        const pushBtn = document.createElement('button');
        pushBtn.className = 'btn-sm';
        pushBtn.style.background = '#8b5cf6';
        pushBtn.innerText = '🚀 Push';
        pushBtn.onclick = () => openPushModal(fileInfo.filename);
        actions.appendChild(pushBtn);
    }

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-sm';
    dlBtn.style.background = '#0284c7';
    dlBtn.style.color = 'white';
    dlBtn.style.border = 'none';
    dlBtn.style.cursor = 'pointer';
    dlBtn.innerText = '⬇️ DL';
    dlBtn.onclick = async () => {
        const origText = dlBtn.innerText;
        dlBtn.innerText = '⏳...';
        try {
            const fetchUrl = fileInfo.isSource ? `/api/bridge/fetch?file=${encodeURIComponent(fileInfo.filename)}` : `/download/${fileInfo.filename}`;
            await downloadFile(fetchUrl, fileInfo.isSource ? fileInfo.filename.split('/').pop() : fileInfo.filename);
        } catch (e) {
            alert("Error downloading file: " + e.message);
        } finally {
            dlBtn.innerText = origText;
        }
    };

    actions.appendChild(dlBtn);

    header.appendChild(titleSpan);
    header.appendChild(actions);
    card.appendChild(header);

    if (fileInfo.description) {
        const desc = document.createElement('div');
        desc.className = 'file-desc';
        desc.innerText = fileInfo.description;
        card.appendChild(desc);
    }

    container.appendChild(card);
}
let globalFileTree = {};
export let globalBrowsePath = [];
let globalManifest = [];

export function loadGlobalFS() {
    const container = document.getElementById('global-fs-list');
    const allFiles = new Set();
    Object.values(contextManifest).forEach(fileArray => fileArray.forEach(f => allFiles.add(f)));

    globalManifest = Array.from(allFiles);

    globalFileTree = buildFileTree(globalManifest);

    // Explicitly seed configured root repositories to allow initializing empty environments
    if (typeof TARGET_CONFIGS !== 'undefined') {
        TARGET_CONFIGS.forEach(cfg => {
            if (cfg.repo_dir && !globalFileTree[cfg.repo_dir]) {
                globalFileTree[cfg.repo_dir] = {};
            }
        });
    }

    if (Object.keys(globalFileTree).length === 0) {
        container.innerHTML = '<p style="padding: 15px; color: #888;">No repositories configured.</p>';
        return;
    }

    let current = globalFileTree;
    for (const p of globalBrowsePath) {
        if (current[p] && !current[p]._isFile) {
            current = current[p];
        } else {
            globalBrowsePath = [];
            break;
        }
    }

    renderGlobalFSLevel();
}

function renderGlobalFSLevel() {
    const container = document.getElementById('global-fs-list');
    container.innerHTML = '';
    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
        btnNewFolder.innerText = globalBrowsePath.length === 0 ? '+ Repo' : '+ Folder';
    }

    const btnNewFile = document.getElementById('btn-new-file');
    if (btnNewFile) {
        btnNewFile.style.display = globalBrowsePath.length === 0 ? 'none' : 'block';
    }

    const upBtn = document.getElementById('global-fs-up-btn');
    upBtn.disabled = globalBrowsePath.length === 0;
    if (!upBtn.disabled) {
        upBtn.style.background = '#64748b';
    } else {
        upBtn.style.background = 'transparent';
        upBtn.style.color = 'var(--border)';
        upBtn.style.border = '1px solid var(--border)';
    }

    const pathText = document.getElementById('global-fs-path');
    pathText.innerText = '/' + globalBrowsePath.join('/');

    let current = globalFileTree;
    for (const p of globalBrowsePath) {
        current = current[p];
    }

    const keys = Object.keys(current).filter(k => k !== '_isFile').sort((a, b) => {
        const aIsDir = !current[a]._isFile;
        const bIsDir = !current[b]._isFile;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });
    keys.forEach(key => {
        const item = current[key];
        if (item._isFile) {
            if (isFolderSelectMode) return; // Hide files when strictly selecting folders

            createFileCard({
                filename: item.fullPath,
                displayName: key,
                description: '',
                isFS: true,
                isSource: true
            }, container);
        } else {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.cursor = 'pointer';
            card.style.padding = '12px 15px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.innerHTML = `<span class="folder-label">📁 ${key}</span>`;
            card.onclick = () => {
                globalBrowsePath.push(key);
                renderGlobalFSLevel();
            };
            container.appendChild(card);
        }
    });
}

function globalFSUp() {
    if (globalBrowsePath.length > 0) {
        globalBrowsePath.pop();
        renderGlobalFSLevel();
    }
}

function filterGlobalFS(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('global-fs-list');
    const clearBtn = document.getElementById('global-fs-clear-btn');
    const headerDiv = document.getElementById('global-fs-header');

    if (!q) {
        clearBtn.style.display = 'none';
        headerDiv.style.display = 'flex';
        renderGlobalFSLevel();
        return;
    }

    clearBtn.style.display = 'block';
    // We intentionally keep the header visible so users know what directory they are searching within
    container.innerHTML = '';

    // Scope search to the current active directory level
    const currentPrefix = globalBrowsePath.length > 0 ? globalBrowsePath.join('/') + '/' : '';
    const matches = globalManifest.filter(f => f.startsWith(currentPrefix) && f.substring(currentPrefix.length).toLowerCase().includes(q));

    if (matches.length === 0) {
        container.innerHTML = '<div style="padding: 15px; color: #888;">No matching files found.</div>';
        return;
    }

    matches.forEach(filepath => {
        const filename = filepath.split('/').pop();
        createFileCard({
            filename: filepath,
            displayName: filename,
            description: filepath,
            isFS: true,
            isSource: true
        }, container);
    });
}

function clearGlobalFSSearch() {
    document.getElementById('global-fs-search').value = '';
    filterGlobalFS('');
}

function checkFileExtension(filename) {
    const warningEl = document.getElementById('new-file-ext-warning');
    if (!warningEl) return;
    warningEl.style.display = 'none';

    if (!filename) return;

    if (globalBrowsePath.length > 0) {
        const repoDir = globalBrowsePath[0];
        const repoCfg = TARGET_CONFIGS.find(c => c.repo_dir === repoDir);

        if (repoCfg && repoCfg.exts) {
            // Emulate Python's os.path.splitext() behavior for accurate parity
            let ext = "";
            const lastDotIndex = filename.lastIndexOf('.');
            if (lastDotIndex > 0) {
                ext = filename.substring(lastDotIndex).toLowerCase();
            }

            // Check if the typed extension is missing from the repo's tracked list
            if (!repoCfg.exts.includes(ext) && !repoCfg.exts.includes("")) {
                if (ext === "") {
                    warningEl.innerText = `⚠️ Extensionless files (or hidden dotfiles) are not tracked by ${repoCfg.title || repoDir}. The file will save to disk, but it will not appear in your context tree.`;
                } else {
                    warningEl.innerText = `⚠️ The extension '${ext}' is not tracked by ${repoCfg.title || repoDir}. The file will save to disk, but it will not appear in your context tree.`;
                }
                warningEl.style.display = 'block';
            }
        }
    }
}

function openNewFileModal() {
    // Inherit the spatial context from the active browser path
    const prefix = globalBrowsePath.length > 0 ? globalBrowsePath.join('/') + '/' : '';
    document.getElementById('new-file-base-path').innerText = prefix;
    document.getElementById('new-file-name').value = '';
    if (document.getElementById('new-file-ext-warning')) document.getElementById('new-file-ext-warning').style.display = 'none';
    document.getElementById('new-file-content').value = '';
    document.getElementById('new-file-modal').style.display = 'block';
}

async function saveNewFile() {
    const basePath = document.getElementById('new-file-base-path').innerText;
    let fileName = document.getElementById('new-file-name').value.trim();
    const content = document.getElementById('new-file-content').value;

    if (!fileName || !content) {
        alert("Filename and content are required.");
        return;
    }

    // Prevent double slashes if user types leading slash
    fileName = fileName.replace(/^\/+/, '');
    const filepath = basePath + fileName;

    // Give the button a temporary ID if it lacks one so the mutation helper can track it
    const btn = document.querySelector('#new-file-modal button[style*="10b981"]');
    if (btn && !btn.id) btn.id = 'temp-save-file-btn';

    await executeWorkspaceMutation('/api/fs/save', {
        filepath,
        content
    }, {
        btnId: btn ? btn.id : null,
        loadingText: 'Saving...',
        onSuccess: async () => {
            if (btn) btn.innerText = "Syncing Tree...";
            await compileContexts();
            const mRes = await fetch('/api/manifest?t=' + Date.now());
            if (mRes.ok) setContextManifest(await mRes.json());

            document.getElementById('new-file-modal').style.display = 'none';
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) {
                loadGlobalFS();
            }
        }
    });
}

function openNewFolderModal() {
    const isRoot = globalBrowsePath.length === 0;
    const prefix = isRoot ? '' : globalBrowsePath.join('/') + '/';

    document.getElementById('new-folder-title').innerText = isRoot ? 'Create New Repository' : 'Create New Folder';
    document.getElementById('btn-submit-new-folder').innerText = isRoot ? '📦 Initialize Repository' : '📁 Create Folder';
    document.getElementById('btn-submit-new-folder').style.background = isRoot ? '#8b5cf6' : '#3b82f6';

    const repoFields = document.getElementById('new-repo-fields');
    if (isRoot) {
        repoFields.style.display = 'flex';
        document.getElementById('new-repo-title').value = '';
        document.getElementById('new-repo-domain').value = 'Workspaces';
        document.getElementById('new-repo-desc').value = '';
        document.getElementById('new-repo-exts').value = '.py, .json, .md, .sh, .txt, .html, .css, .js';
    } else {
        repoFields.style.display = 'none';
    }

    document.getElementById('new-folder-base-path').innerText = prefix;
    document.getElementById('new-folder-name').value = '';
    document.getElementById('new-folder-modal').style.display = 'block';
}

async function saveNewFolder() {
    const basePath = document.getElementById('new-folder-base-path').innerText;
    let folderName = document.getElementById('new-folder-name').value.trim();

    if (!folderName) {
        alert("Name is required.");
        return;
    }

    // Clean leading/trailing slashes if user included them to prevent double slashes
    folderName = folderName.replace(/^\/+|\/+$/g, '');
    let isNewRepo = false;
    let payloadExt = {};

    if (basePath === '') {
        isNewRepo = true;
        payloadExt = {
            repo_title: document.getElementById('new-repo-title').value.trim(),
            repo_domain: document.getElementById('new-repo-domain').value.trim(),
            repo_desc: document.getElementById('new-repo-desc').value.trim(),
            repo_exts: document.getElementById('new-repo-exts').value.trim()
        };
    }

    const filepath = basePath + folderName + "/.gitkeep";
    const btn = document.getElementById('btn-submit-new-folder');
    const origText = btn.innerText;
    btn.innerText = "Creating...";

    try {
        const res = await fetch('/api/fs/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filepath,
                content: "",
                is_new_repo: isNewRepo,
                repo_dir: folderName,
                ...payloadExt
            })
        });
        if (res.ok) {
            btn.innerText = "Syncing Tree...";
            await compileContexts();
            const mRes = await fetch('/api/manifest?t=' + Date.now());
            if (mRes.ok) setContextManifest(await mRes.json());

            if (isNewRepo) {
                const rRes = await fetch('/api/repos?t=' + Date.now());
                if (rRes.ok) {
                    const d = await rRes.json();
                    setAllRepos(d.repos);
                    setTargetConfigs(d.targets || []);
                    renderRepoPins();
                    if (typeof window.renderTaskRepoPins === 'function') window.renderTaskRepoPins();
                }
            }

            document.getElementById('new-folder-modal').style.display = 'none';
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) {
                loadGlobalFS();
            }
        } else {
            alert("Failed to create folder.");
        }
    } catch (e) {
        alert("Network error occurred.");
    } finally {
        btn.innerText = origText;
    }
}

export async function viewSourceFile(filepath, isFS = false) {
    currentModalFile = filepath;
    currentModalIsFS = isFS;
    document.getElementById('modal-title').innerText = filepath;
    const textArea = document.getElementById('modal-text');
    const preview = document.getElementById('modal-preview');
    const toggleBtn = document.getElementById('modal-toggle-btn');

    const ext = filepath.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown',
        'py': 'python',
        'js': 'javascript',
        'json': 'javascript',
        'sh': 'shell'
    };
    const codeMode = modeMap[ext];
    const isSupportedEditor = !!codeMode;
    const isMarkdown = ext === 'md';
    if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.value("Loading...");
        mdeInstance.codemirror.setOption("mode", codeMode);
        mdeInstance.codemirror.setOption("readOnly", isFS ? false : "nocursor");
    } else {
        textArea.value = "Loading...";
        textArea.readOnly = !isFS;
    }
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('copy-modal').style.display = 'block';
    closeBrowseModal();

    const tb = document.getElementById('modal-edit-toolbar');
    if (isFS) {
        tb.style.display = 'flex';
        document.getElementById('modal-clean-btn').style.display = (isMarkdown || ext === 'txt') ? 'block' : 'none';
    } else {
        tb.style.display = 'none';
    }

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    if (isMarkdown) {
        toggleBtn.style.display = 'block';
        isPreviewMode = true;
        textArea.style.display = 'none';
        if (mdeWrap) mdeWrap.style.display = 'none';
        preview.style.display = 'block';
        toggleBtn.innerText = '📝 Edit';
        preview.innerHTML = '<p>Loading...</p>';
    } else {
        toggleBtn.style.display = 'none';
        isPreviewMode = false;
        preview.style.display = 'none';
        if (isSupportedEditor && mdeWrap) {
            mdeWrap.style.display = 'flex';
            textArea.style.display = 'none';
            setTimeout(() => mdeInstance.codemirror.refresh(), 10);
        } else {
            if (mdeWrap) mdeWrap.style.display = 'none';
            textArea.style.display = 'block';
        }
    }

    try {
        const res = await fetch('/api/bridge/fetch?file=' + encodeURIComponent(filepath));
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(text);
        else textArea.value = text;
        currentModalOriginalText = text;
        if (isMarkdown && isPreviewMode) renderMarkdownPreview();
    } catch (e) {
        const errText = "Error loading file content.";
        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(errText);
        else textArea.value = errText;
        if (isMarkdown && isPreviewMode) preview.innerHTML = '<p style="color:red;">Error loading file.</p>';
    }
}

let currentFileTree = {};
let currentBrowsePath = [];
let currentBrowseManifest = [];
let isFolderSelectMode = false;

function closeBrowseModal() {
    document.getElementById('browse-modal').style.display = 'none';
    isFolderSelectMode = false;
    document.getElementById('browse-select-folder-btn').style.display = 'none';
    document.getElementById('browse-search').style.display = 'block';
}

function openFolderBrowser() {
    isFolderSelectMode = true;
    document.getElementById('browse-select-folder-btn').style.display = 'block';
    document.getElementById('browse-search').style.display = 'none';

    // Rebuild tree from all contexts to allow global workspace navigation
    const allFiles = new Set();
    Object.values(contextManifest).forEach(fileArray => fileArray.forEach(f => allFiles.add(f)));
    currentBrowseManifest = Array.from(allFiles);
    currentFileTree = buildFileTree(currentBrowseManifest);
    currentBrowsePath = []; // reset to root

    document.getElementById('browse-search').value = '';
    document.getElementById('browse-clear-btn').style.display = 'none';
    document.getElementById('browse-modal-title').innerText = `Select Destination Folder`;

    renderBrowseLevel();
    document.getElementById('browse-modal').style.display = 'block';
}

function confirmFolderSelection() {
    const selectedPath = currentBrowsePath.join('/');
    const filename = currentModalFile.split('/').pop();
    const finalPath = selectedPath ? `${selectedPath}/${filename}` : filename;

    document.getElementById('move-dest-path').value = finalPath;
    closeBrowseModal();
}

function clearBrowseSearch() {
    document.getElementById('browse-search').value = '';
    document.getElementById('browse-clear-btn').style.display = 'none';
    filterBrowse('');
}

function filterBrowse(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('browse-list');
    const clearBtn = document.getElementById('browse-clear-btn');

    if (!q) {
        clearBtn.style.display = 'none';
        renderBrowseLevel();
        return;
    }

    clearBtn.style.display = 'block';
    container.innerHTML = '';
    const matches = currentBrowseManifest.filter(f => f.toLowerCase().includes(q));

    if (matches.length === 0) {
        container.innerHTML = '<div style="padding: 15px; color: #888;">No matching files found.</div>';
        return;
    }
    matches.forEach(filepath => {
        const filename = filepath.split('/').pop();
        createFileCard({
            filename: filepath,
            displayName: filename,
            description: filepath,
            isFS: true,
            isSource: true

        }, container);
    });
}

function buildFileTree(files) {
    const tree = {};
    files.forEach(filepath => {
        const parts = filepath.split('/');
        let current = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = {
                    _isFile: true,
                    fullPath: filepath
                };
            } else {
                if (!current[part]) current[part] = {};
                current = current[part];
            }
        }
    });
    return tree;
}

function renderBrowseLevel() {
    const container = document.getElementById('browse-list');
    container.innerHTML = '';

    // Header & Breadcrumbs
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.gap = '10px';
    headerDiv.style.marginBottom = '15px';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.flexWrap = 'wrap';

    const upBtn = document.createElement('button');
    upBtn.className = 'btn-sm';
    upBtn.innerText = '⬆️ Up';
    upBtn.disabled = currentBrowsePath.length === 0;
    if (!upBtn.disabled) {
        upBtn.style.background = '#64748b';
        upBtn.onclick = () => {
            currentBrowsePath.pop();
            renderBrowseLevel();
        };
    } else {
        upBtn.style.background = 'transparent';
        upBtn.style.color = 'var(--border)';
        upBtn.style.border = '1px solid var(--border)';
    }

    const pathText = document.createElement('span');
    pathText.style.fontFamily = 'monospace';
    pathText.style.color = 'var(--text)';
    pathText.style.opacity = '0.7';
    pathText.innerText = '/' + currentBrowsePath.join('/');

    headerDiv.appendChild(upBtn);
    headerDiv.appendChild(pathText);
    container.appendChild(headerDiv);

    // Traverse to current level
    let current = currentFileTree;
    for (const p of currentBrowsePath) {
        current = current[p];
    }

    // Sort folders first, then files
    const keys = Object.keys(current).filter(k => k !== '_isFile').sort((a, b) => {
        const aIsDir = !current[a]._isFile;
        const bIsDir = !current[b]._isFile;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });

    // Render items
    keys.forEach(key => {
        const item = current[key];
        if (item._isFile) {
            createFileCard({
                filename: item.fullPath,
                displayName: key,
                description: '',

                isFS: true,
                isSource: true
            }, container);
        } else {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.cursor = 'pointer';
            card.style.padding = '12px 15px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.innerHTML = `<span class="folder-label">📁 ${key}</span>`;
            card.onclick = () => {
                currentBrowsePath.push(key);
                renderBrowseLevel();
            };
            container.appendChild(card);
        }
    });
}

export function openBrowseModal(contextFilename) {
    isFolderSelectMode = false;
    document.getElementById('browse-select-folder-btn').style.display = 'none';
    document.getElementById('browse-search').style.display = 'block';

    const files = contextManifest[contextFilename] || [];
    currentBrowseManifest = files;
    currentFileTree = buildFileTree(files);
    currentBrowsePath = []; // reset to root
    document.getElementById('browse-search').value = ''; // Reset search on open
    const clearBtn = document.getElementById('browse-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';

    // Auto-drilldown: skip single-folder levels
    let current = currentFileTree;
    while (true) {
        const keys = Object.keys(current).filter(k => k !== '_isFile');
        if (keys.length === 1) {
            const onlyKey = keys[0];
            if (!current[onlyKey]._isFile) {
                currentBrowsePath.push(onlyKey);
                current = current[onlyKey];
                continue;
            }
        }
        break;
    }

    document.getElementById('browse-modal-title').innerText = `Browsing: ${contextFilename}`;
    renderBrowseLevel();
    document.getElementById('browse-modal').style.display = 'block';
}

// Window Bindings
window.openNewFileModal = openNewFileModal;
window.saveNewFile = saveNewFile;
window.openNewFolderModal = openNewFolderModal;
window.saveNewFolder = saveNewFolder;
window.checkFileExtension = checkFileExtension;
window.toggleModalMode = toggleModalMode;
window.saveModalFile = saveModalFile;
window.copyFromModal = copyFromModal;
window.openMoveModal = openMoveModal;
window.executeMove = executeMove;
window.archiveModalFile = archiveModalFile;
window.deleteModalFile = deleteModalFile;
window.cleanModalFile = cleanModalFile;
window.downloadFromModal = downloadFromModal;
window.globalFSUp = globalFSUp;
window.clearGlobalFSSearch = clearGlobalFSSearch;
window.filterGlobalFS = filterGlobalFS;

window.closeBrowseModal = closeBrowseModal;
window.openFolderBrowser = openFolderBrowser;
window.confirmFolderSelection = confirmFolderSelection;
window.clearBrowseSearch = clearBrowseSearch;
window.filterBrowse = filterBrowse;
