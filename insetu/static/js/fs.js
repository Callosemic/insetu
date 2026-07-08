import {
    mdeInstance,
    executeWorkspaceMutation,
    setContextManifest,
    compileContexts,
    fetchAndCopy,
    fetchAndDownloadState,
    normalizeAccentText,
    resolveEditorMode
} from './app.js';
import { AppStore } from './store.js';
let currentModalFile = '';
export let currentModalOriginalText = '';
export let currentModalIsFS = false;
let currentModalFullText = '';
let isModalTruncated = false;
let currentModalForceEdit = false;
export let currentModalIsMemoryOnly = false;
window.loadFullModalText = function() {
    const banner = document.getElementById('modal-truncation-banner');
    if (banner) banner.style.display = 'none';
    isModalTruncated = false;

    const { ext, isSupported, isMarkdown: extIsMd } = resolveEditorMode(currentModalFile);
    const isSupportedEditor = isSupported || currentModalForceEdit;
    const isMarkdown = extIsMd || currentModalForceEdit;
    const shouldBeReadOnly = !(currentModalIsFS || currentModalForceEdit);

    const textArea = document.getElementById('modal-text');

    if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.value(currentModalFullText);
        mdeInstance.codemirror.setOption("readOnly", shouldBeReadOnly ? "nocursor" : false);
    } else {
        textArea.value = currentModalFullText;
        textArea.readOnly = shouldBeReadOnly;
    }
    currentModalOriginalText = currentModalFullText;
};

function injectTextToModal(text, isSupportedEditor, isMarkdown, isFS, forceAllowEdit = false) {
    const TRUNCATE_LIMIT = 200000;
    currentModalFullText = text;
    const banner = document.getElementById('modal-truncation-banner');
    const textArea = document.getElementById('modal-text');
    const shouldBeReadOnly = !(isFS || forceAllowEdit);

    if (text.length > TRUNCATE_LIMIT) {
        isModalTruncated = true;
        const textToRender = text.substring(0, TRUNCATE_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR PERFORMANCE] ...';
        const kbSize = Math.round(text.length / 1024);
        document.getElementById('modal-truncation-msg').innerHTML = `⚠️ Only showing the first 200kb of <b>${kbSize}kb</b>.`;
        if (banner) banner.style.display = 'flex';

        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
            mdeInstance.value(textToRender);
            mdeInstance.codemirror.setOption("readOnly", "nocursor"); // Lock while truncated to prevent accidental overwrites
        } else {
            textArea.value = textToRender;
            textArea.readOnly = true;
        }
        currentModalOriginalText = textToRender;
    } else {
        isModalTruncated = false;
        if (banner) banner.style.display = 'none';
        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
            mdeInstance.value(text);
            mdeInstance.codemirror.setOption("readOnly", shouldBeReadOnly ? "nocursor" : false);
        } else {
            textArea.value = text;
            textArea.readOnly = shouldBeReadOnly;
            }
            currentModalOriginalText = text;
}
}

export async function downloadFile(fetchUrl, fallbackFilename, fetchOptions = {}) {
    const res = await fetch(fetchUrl, fetchOptions);
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
export async function viewAndCopy(filename) {
    currentModalFile = filename;
    currentModalIsFS = false;
    currentModalForceEdit = false;
    currentModalIsMemoryOnly = false;
    document.getElementById('modal-title').innerText = filename;
    const textArea = document.getElementById('modal-text');

    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(filename);
if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.value("Loading...");
        mdeInstance.codemirror.setOption("mode", codeMode);
        mdeInstance.codemirror.setOption("readOnly", "nocursor");
    } else {
        textArea.value = "Loading...";
        textArea.readOnly = true;
    }
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    if (tb) tb.style.display = 'none';
    const mdeWrap = document.querySelector('.EasyMDEContainer');

    if (isSupportedEditor && mdeWrap) {
        mdeWrap.style.display = 'flex';
        textArea.style.display = 'none';
        setTimeout(() => mdeInstance.codemirror.refresh(), 10);
    } else {
        if (mdeWrap) mdeWrap.style.display = 'none';
        textArea.style.display = 'block';
    }

    try {
        const res = await fetch(`/download/${filename}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToModal(text, isSupportedEditor, isMarkdown, false);
    } catch (e) {
        const errText = "Error loading file content.";
if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(errText);
        else textArea.value = errText;
        currentModalOriginalText = "";
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
function refreshActiveFileViews(oldPath, newPath = null) {
    updateManifestState(oldPath, newPath);

    if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) {
        loadGlobalFS();
    }
    if (document.getElementById('st-prompts') && document.getElementById('st-prompts').classList.contains('active')) {
        if (window.renderPromptsTab) window.renderPromptsTab();
    }

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        window.inSetu.extensions.Registry.executeUIHook('zone:post-file-delete', oldPath);
        if (newPath) {
            window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', newPath);
        } else {
            window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', oldPath);
        }
    }
}

function updateManifestState(oldPath, newPath = null) {
    const { manifest } = AppStore.getState();
    Object.values(manifest).forEach(obj => {
        if (obj.files) {
            const index = obj.files.indexOf(oldPath);
            if (index > -1) {
                obj.files.splice(index, 1);
                if (newPath) obj.files.push(newPath);
            }
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
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    await executeWorkspaceMutation(`/api/${activeWs}/fs/save`, {
        filepath: currentModalFile,
        content: content
    }, {
        btnId: 'modal-save-btn',
        loadingText: 'Saving...',
        silent: autoSave,
        onSuccess: () => {
            currentModalOriginalText = content;
            document.getElementById('modal-save-btn').style.display = 
'none';
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
            if (autoSave && window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', currentModalFile);
            }
        }
    });
}
async function copyFromModal() {
    let text = document.getElementById('modal-text').value;
    if (window.inSetu?.extensions?.Registry?.executeUIHook) {
        const overrideUrl = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', currentModalFile);
        if (overrideUrl) {
            try {
                const res = await fetch(overrideUrl);
                if (res.ok) text = await res.text();
            } catch (e) {
                console.warn("Failed to resolve extension fetch hook for copy", e);
            }
        }
    }
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('#file-modal button[style*="10b981"]');
        const origText = btn.innerText;
        btn.innerText = "✅ Copied!";
        setTimeout(() => btn.innerText = origText, 2000);
    }).catch(err => {
        alert("Clipboard API failed. Please manually select the text and copy it directly from the text box.");
    });
}
function openMoveModal() {
    const bodyHtml = `
        <div style="flex-shrink: 0; padding-bottom: 15px; margin-bottom: 15px; border-bottom: 1px solid var(--border);">
            <input type="text" id="move-dest-path" value="${currentModalFile}" placeholder="e.g. repo/new_folder/my_file.py" style="width: 100%; padding: 8px; font-family: monospace; box-sizing: border-box; margin: 0;">
        </div>
        <div id="move-browser-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0 10px;">
            <div class="spinner" style="display:block;">Loading folders...</div>
        </div>
    `;
    const modal = document.createElement('insetu-modal');
    modal.id = 'move-modal';
    modal.titleText = 'Move File to...';
    modal.innerHTML = `
        <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden;">${bodyHtml}</div>
        <div slot="footer">
            <button id="execute-move-btn" class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;">🚚 Move File</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.open = true;
    modal.addEventListener('modal-closed', () => modal.remove());

    modal.querySelector('#execute-move-btn').onclick = async () => {
        await executeMove(modal.id);
    };
    let initialPathParts = [];
    if (currentModalFile) {
        const parts = currentModalFile.split('/').filter(p => p);
        parts.pop();
// remove filename
        initialPathParts = parts;
    }

    setTimeout(() => {
        mountFolderBrowser(document.getElementById('move-browser-container'), (selectedPath) => {
            const filename = currentModalFile ? currentModalFile.split('/').pop() : '';
            document.getElementById('move-dest-path').value = selectedPath ? (filename ? `${selectedPath}/${filename}` : selectedPath) : filename;
        }, initialPathParts);
    }, 50);
}
export function mountFolderBrowser(container, onSelect, initialPath = []) {
    container.replaceChildren();
    const allFiles = new Set();
    const { manifest } = AppStore.getState();
    Object.values(manifest).forEach(obj => {
        if (obj.files) obj.files.forEach(f => allFiles.add(f));
    });

    const browser = document.createElement('insetu-folder-browser');
    browser.files = Array.from(allFiles);
    browser.currentPath = initialPath;
    browser.addEventListener('path-changed', (e) => onSelect(e.detail.path));

    container.appendChild(browser);
}
async function executeMove(modalId = 'move-modal') {
    const destPath = document.getElementById('move-dest-path').value.trim();
    if (!destPath || destPath === currentModalFile) return alert("Please enter a valid new destination path.");
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    await executeWorkspaceMutation(`/api/${activeWs}/fs/move`, {
        filepath: currentModalFile,
        dest_path: destPath
    }, {
        btnId: 'execute-move-btn',
        loadingText: 'Moving...',
        onSuccess: () => {
            const m = document.getElementById(modalId);
            if (m && m.close) m.close();
            else if (m) m.remove();

            document.getElementById('file-modal').style.display = 'none';

            refreshActiveFileViews(currentModalFile, destPath);
        }
    });
}
async function archiveModalFile() {
    if (!confirm("Are you sure you want to archive this file?\nIt will be moved to an 'archived/' subdirectory.")) return;

    const activeWs = AppStore.getState().activeWorkspace || 'default';
    await executeWorkspaceMutation(`/api/${activeWs}/fs/archive`, {
        filepath: currentModalFile
    }, {
        onSuccess: () => {
            const oldPath = currentModalFile;
            document.getElementById('file-modal').style.display = 'none';
            refreshActiveFileViews(oldPath);
        }
    });
}
async function deleteModalFile() {
    if (!confirm("Are you sure you want to delete this file?\nThis cannot be undone!")) return;

    const activeWs = AppStore.getState().activeWorkspace || 'default';
    await executeWorkspaceMutation(`/api/${activeWs}/fs/delete`, {
        filepath: currentModalFile
    }, {
        onSuccess: () => {
            const oldPath = currentModalFile;
            document.getElementById('file-modal').style.display = 'none';
            refreshActiveFileViews(oldPath);
        }
    });
}
function cleanModalFile() {
    if (!confirm("Clean LLM cite and span tags from this file?")) return;

    const ext = currentModalFile.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown',
        'py': 'python',
        'js': 'javascript',
        'json': 'javascript',
        'sh': 'shell'
    };
    const isSupportedEditor = !!modeMap[ext];

    let text = (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) 
        ? mdeInstance.value() 
        : document.getElementById('modal-text').value;

    // Clean Citations: [cite], [cite: 1], [cite: 1, 2]
    text = text.replace(/\[cite(?:[^\]]*)\]/gi, '');

    // Clean Combined Spans: [span_X](start_span) or [span_X](end_span)
    text = text.replace(/\[span_\d+\]\((?:start_span|end_span)\)/gi, '');
    // Clean Orphaned Spans
    text = text.replace(/\((?:start_span|end_span)\)/gi, '');
    text = text.replace(/\[span_\d+\]/gi, '');
    if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.value(text);
} else {
        document.getElementById('modal-text').value = text;
        document.getElementById('modal-text').dispatchEvent(new Event('input'));
}

    // Persist changes to disk automatically
    if (currentModalIsFS && window.saveModalFile) {
        window.saveModalFile(true);
    }
}
async function downloadFromModal() {
    const btn = document.getElementById('modal-dl-btn');
    if (!btn) return;
    const origText = btn.innerText;
    btn.innerText = '⏳...';
    try {
        if (currentModalIsMemoryOnly) {
            let text = '';
            const mdeWrap = document.querySelector('.EasyMDEContainer');
            if (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined' && mdeInstance) {
                text = mdeInstance.value();
            } else {
                text = document.getElementById('modal-text').value;
            }

            // If the UI is currently truncating the text for performance, 
            // ensure we download the full underlying string instead.
            if (isModalTruncated) {
                text = currentModalFullText;
            }
            const blob = new Blob([text], { type: 'text/plain' });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = currentModalFile;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            const activeWs = AppStore.getState().activeWorkspace || 'default';
            let fetchUrl = currentModalIsFS ? `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(currentModalFile)}` : `/download/${currentModalFile}`;

            if (window.inSetu?.extensions?.Registry?.executeUIHook) {
                const overrideUrl = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', currentModalFile);
                if (overrideUrl) fetchUrl = overrideUrl;
            }

            await downloadFile(fetchUrl, currentModalFile.split('/').pop());
        }
    } catch (e) {
        alert("Error downloading file: " + e.message);
    } finally {
        btn.innerText = origText;
    }
}
export function createFileCard(fileInfo, container) {
    const card = document.createElement('insetu-card');
    card.filename = fileInfo.filename;
    card.titleText = fileInfo.displayName || fileInfo.filename;
    card.descriptionText = fileInfo.description || '';
    card.detailText = fileInfo.sizeStr ? `${fileInfo.filename} | ${fileInfo.sizeStr}` : fileInfo.filename;
    card.icon = fileInfo.isSource ? '📄' : '📦';
    card.intentColor = fileInfo.isSource ? 'var(--intent-primary)' : 'var(--intent-highlight)';

    card.addEventListener('card-clicked', () => {
        if (fileInfo.isSource) viewSourceFile(fileInfo.filename, fileInfo.isFS);
        else viewAndCopy(fileInfo.filename);
    });

    const { manifest } = AppStore.getState();
    if (!fileInfo.isSource && manifest[fileInfo.filename]) {
        const browseBtn = document.createElement('button');
        browseBtn.className = 'btn-sm';
        browseBtn.style.background = 'var(--intent-highlight)';
        browseBtn.innerText = '📁 Browse';
        browseBtn.slot = 'actions';
        browseBtn.onclick = (e) => { e.stopPropagation(); openBrowseModal(fileInfo.filename); };
        card.appendChild(browseBtn);
    }

    const actionsContainer = document.createElement('div');
    actionsContainer.style.display = 'none';

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        window.inSetu.extensions.Registry.executeUIHook('zone:file-card-actions', {
            filepath: fileInfo.filename,
            repoDir: fileInfo.repoDir,
            isFS: fileInfo.isFS,
            actionsContainer: actionsContainer
        });
        Array.from(actionsContainer.children).forEach(child => {
            child.slot = 'actions';
            card.appendChild(child);
        });
    }

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-sm ui-draggable-export';
    dlBtn.style.background = 'var(--intent-primary)';
    dlBtn.style.color = 'white';
    dlBtn.style.border = 'none';
    dlBtn.style.cursor = 'pointer';
    dlBtn.innerText = '⬇️ DL';
    dlBtn.draggable = true;
    dlBtn.slot = 'actions';
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    let dlFetchUrl = fileInfo.isSource ? `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(fileInfo.filename)}` : `/download/${fileInfo.filename}`;

    if (window.inSetu?.extensions?.Registry?.executeUIHook) {
        const overrideUrl = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', fileInfo.filename);
        if (overrideUrl) dlFetchUrl = overrideUrl;
    }

    dlBtn.dataset.fetchUrl = dlFetchUrl;
    dlBtn.dataset.filename = fileInfo.isSource ? fileInfo.filename.split('/').pop() : fileInfo.filename;

    dlBtn.onclick = async (e) => {
        e.stopPropagation();
        const origText = dlBtn.innerText;
        dlBtn.innerText = '⏳...';
        try {
            const res = await fetch(dlBtn.dataset.fetchUrl);
            if (!res.ok) throw new Error("Failed to fetch");

            const text = await res.text();
            const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = dlBtn.dataset.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            dlBtn.innerText = "✅ Done";
        } catch (err) {
            alert("Error downloading file: " + err.message);
            dlBtn.innerText = origText;
        } finally {
            setTimeout(() => dlBtn.innerText = origText, 2000);
        }
    };
    card.appendChild(dlBtn);

    container.appendChild(card);
}
let globalFileTree = {};
let globalManifest = [];
export function loadGlobalFS() {
        const container = document.getElementById('global-fs-list');
        const allFiles = new Set();
        const { manifest, targetConfigs, globalBrowsePath } = AppStore.getState();

        Object.values(manifest).forEach(obj => {
                if (obj.files) obj.files.forEach(f => allFiles.add(f));
        });
        globalManifest = Array.from(allFiles);

        // Explicitly seed configured root repositories to allow initializing empty environments
        if (targetConfigs) {
                targetConfigs.forEach(cfg => {
                        if (cfg.repo_dir && !globalManifest.some(f => f.startsWith(cfg.repo_dir + '/'))) {
                                globalManifest.push(cfg.repo_dir + '/.gitkeep');
                        }
                });
        }

        if (globalManifest.length === 0) {
                container.innerHTML = '<p style="padding: 15px; color: var(--text-muted);">No repositories configured.</p>';
                return;
        }

        // Hide legacy UI elements since the Web Component handles breadcrumbs natively
        const legacyHeader = document.getElementById('global-fs-header');
        if (legacyHeader) legacyHeader.style.display = 'none';

        container.innerHTML = `
                <div @card-clicked="\${(e) => { if(e.detail.isSource && window.viewSourceFile) window.viewSourceFile(e.detail.filename, true); }}">
                        <insetu-file-tree 
                                id="global-fs-tree"
                                basePath=""
                                @path-changed="\${(e) => window._syncGlobalFSPath(e.detail.path)}">
                        </insetu-file-tree>
                </div>
        `;

        // Property binding must happen after HTML injection for complex arrays
        const treeEl = container.querySelector('insetu-file-tree');
        if (treeEl) {
                treeEl.files = globalManifest;
                treeEl.currentPath = globalBrowsePath || [];
                treeEl.actions = [
                        { id: 'download', label: '⬇️ DL', style: 'primary' }
                ];

                // Re-bind native Lit events since innerHTML loses template literal bindings
                treeEl.addEventListener('card-clicked', (e) => {
                        if(e.detail.isSource && window.viewSourceFile) window.viewSourceFile(e.detail.filename, true);
                });
                treeEl.addEventListener('action-download', (e) => {
                        if(window.fetchAndDownloadState) window.fetchAndDownloadState(e.detail.filepath, e.detail.event.target);
                });
                treeEl.addEventListener('path-changed', (e) => {
                        window._syncGlobalFSPath(e.detail.path);
                });
        }

        window._syncGlobalFSPath(globalBrowsePath || []);
}
window._syncGlobalFSPath = function(path) {
        AppStore.setState({ globalBrowsePath: path });
        const btnFsMore = document.getElementById('btn-fs-more');
        if (btnFsMore) btnFsMore.style.display = 'block';
};

// Strict UDF Binding: Reactively re-render the file tree when the manifest arrives or changes
AppStore.subscribe(
    (state) => state.manifest,
    () => {
        const stFiles = document.getElementById('st-files');
        if (stFiles && stFiles.classList.contains('active')) {
            loadGlobalFS();
        }
    }
);

function filterGlobalFS(query) {
        window.ExtensionRegistry.utils.debounce('globalFSSearch', () => {
                const q = query.toLowerCase().trim();
                const container = document.getElementById('global-fs-list');
                const clearBtn = document.getElementById('global-fs-clear-btn');

                if (!q) {
                        if (clearBtn) clearBtn.style.display = 'none';
                        loadGlobalFS();
                        return;
                }
                if (clearBtn) clearBtn.style.display = 'block';
                container.replaceChildren();

                const gbPath = AppStore.getState().globalBrowsePath || [];
                const currentPrefix = gbPath.length > 0 ? gbPath.join('/') + '/' : '';

                const terms = q.split(/\\s+/).filter(t => t);
                const matches = globalManifest.filter(f => {
                        if (!f.startsWith(currentPrefix)) return false;
                        const sub = f.substring(currentPrefix.length).toLowerCase();
                        return terms.every(t => sub.includes(t));
                });
                if (matches.length === 0) {
                        container.innerHTML = '<div style="padding: 15px; color: var(--text-muted);">No matching files found.</div>';
                        return;
                }

                const { browserConfig } = AppStore.getState();
                matches.forEach(filepath => {
                        const filename = filepath.split('/').pop();
                        if (browserConfig && browserConfig.mode === 'file') {
                                const card = document.createElement('insetu-card');
                                card.filename = filepath;
                                card.titleText = filename;
                                card.descriptionText = filepath;
                                card.icon = '📄';
                                card.intentColor = 'var(--intent-success)';
                                card.addEventListener('card-clicked', () => {
                                        if (browserConfig && browserConfig.callback) browserConfig.callback(filepath);
                                        closeBrowseModal();
                                });
                                container.appendChild(card);
                        } else if (!browserConfig || browserConfig.mode !== 'folder') {
                                createFileCard({
                                        filename: filepath,
                                        displayName: filename,
                                        description: filepath,
                                        isFS: true,
                                        isSource: true
                                }, container);
                        }
                });
        }, 200);
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
    const gbPath = AppStore.getState().globalBrowsePath || [];
    if (gbPath.length > 0) {
        const repoDir = gbPath[0];
        const { targetConfigs } = AppStore.getState();
        const repoCfg = targetConfigs.find(c => c.repo_dir === repoDir);

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
function openNewFileModal(overridePath = null) {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const prefix = typeof overridePath === 'string' ?
overridePath : (gbPath.length > 0 ? gbPath.join('/') + '/' : '');

    const bodyHtml = `
        <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Path: <span id="new-file-base-path" style="font-family: monospace; color: var(--intent-highlight);">${prefix}</span></label>
        <input type="text" id="new-file-name" placeholder="Filename (e.g. my-prompt.md)..." style="margin-bottom: 5px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;" oninput="if(typeof checkFileExtension === 'function') checkFileExtension(this.value)">
        <div id="new-file-ext-warning" style="display: none; color: var(--intent-warning); font-size: 0.8rem; font-weight: bold; margin-bottom: 15px;"></div>
        <div id="new-file-toolbar" style="display: none; gap: 10px; margin-bottom: 10px; padding: 8px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; align-items: center;">
            <button onclick="if(window.importFromUrl) window.importFromUrl()" class="btn-sm" style="background: var(--intent-primary); margin: 0;">🌐 Import from URL</button>
            <span id="import-url-status" style="font-size: 0.8rem; color: var(--text-muted); display: none;">Fetching...</span>
        </div>

        <div id="zone-new-file-options" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;"></div>

        <textarea id="new-file-content" style="flex: 1; margin-bottom: 0; font-size: 13px; margin-top:0; width: 100%; box-sizing: border-box; min-height: 200px;" placeholder="Enter file content here..."></textarea>
    `;
    const modal = document.createElement('insetu-modal');
    modal.id = 'new-file-modal';
    modal.titleText = 'Create New Workspace File';
    modal.innerHTML = `
        <div slot="body">${bodyHtml}</div>
        <div slot="footer">
            <button id="temp-save-file-btn" class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;">💾 Create & Save File</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.open = true;
    modal.addEventListener('modal-closed', () => modal.remove());

    modal.querySelector('#temp-save-file-btn').onclick = async () => {
        await saveNewFile(modal.id);
    };

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        window.inSetu.extensions.Registry.executeUIHook('zone:new-file-options', null);
    }
}

async function saveNewFile(modalId = 'new-file-modal') {
    const basePath = document.getElementById('new-file-base-path').innerText;
    let fileName = document.getElementById('new-file-name').value.trim();
    let content = document.getElementById('new-file-content').value;
    if (!fileName || !content) {
        alert("Filename and content are required.");
        return;
    }
    fileName = fileName.replace(/^\/+/, '');
    const filepath = basePath + fileName;

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        // Let extensions intercept the payload and inject metadata/headers before writing to disk
        content = await window.inSetu.extensions.Registry.executeUIHook('zone:pre-save-new-file', { fileName, content, filepath }) || content;
    }

    const btn = document.getElementById('temp-save-file-btn');
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    await executeWorkspaceMutation(`/api/${activeWs}/fs/save`, {
        filepath,
        content
    }, {
        btnId: btn ? btn.id : null,
        loadingText: 'Saving...',
        onSuccess: async () => {
            const m = document.getElementById(modalId);
            if (m && m.close) m.close();
            else if (m) m.remove();

            // Surgically inject into the local manifest state to avoid full re-compilation
            const { manifest } = AppStore.getState();
            const repoDir = filepath.split('/')[0];
            const defaultBucket = `${repoDir}_context.txt`;

            if (manifest[defaultBucket]) {
                if (!manifest[defaultBucket].files.includes(filepath)) {
                    manifest[defaultBucket].files.push(filepath);
                }
            } else {
                // Create the bucket if it's a completely new repo
                manifest[defaultBucket] = {
                    files: [filepath],
                    meta: { title: repoDir, domain: "Workspaces", desc: "Context payload." }
                };
            }
            AppStore.setState({ manifest: manifest });

            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) {
                loadGlobalFS();
            }
            if (document.getElementById('st-prompts') && document.getElementById('st-prompts').classList.contains('active')) {
                if (window.renderPromptsTab) window.renderPromptsTab();
            }
        }
    });
}
function openNewFolderModal(overridePath = null) {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const isRoot = overridePath === null && gbPath.length === 0;
    const prefix = typeof overridePath === 'string' ? overridePath : (isRoot ? '' : gbPath.join('/') + '/');
    const modalTitle = isRoot ? 'Create New Repository' : 'Create New Folder';
    const submitLabel = isRoot ? '📦 Initialize Repository' : '📁 Create Folder';

    const bodyHtml = `
        <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Path: <span id="new-folder-base-path" style="font-family: monospace; color: var(--intent-highlight);">${prefix}</span></label>
        <input type="text" id="new-folder-name" placeholder="Directory name..." style="margin-bottom: 15px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;">

        <div id="new-repo-fields" style="display: ${isRoot ? 'flex' : 'none'}; flex-direction: column; gap: 12px; margin-bottom: 15px; background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
            <h4 style="margin: 0; margin-bottom: 5px; color: var(--intent-primary);">Repository Configuration</h4>
            <div>
                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Repository Title</label>
                <input type="text" id="new-repo-title" placeholder="e.g., Core API" style="padding: 8px; margin: 0; width: 100%; box-sizing: border-box;">
            </div>
            <div>
                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Domain Category</label>
                <input type="text" id="new-repo-domain" value="Workspaces" placeholder="e.g., Workspaces" style="padding: 8px; margin: 0; width: 100%; box-sizing: border-box;">
            </div>
            <div>
                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Description</label>
                <input type="text" id="new-repo-desc" placeholder="Short summary..." style="padding: 8px; margin: 0; width: 100%; box-sizing: border-box;">
            </div>
            <div>
                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Tracked Extensions</label>
                <input type="text" id="new-repo-exts" value=".py, .json, .md, .sh, .txt, .html, .css, .js" placeholder="e.g., .py, .json, .md" style="padding: 8px; margin: 0; width: 100%; font-family: monospace; box-sizing: border-box;">
            </div>
        </div>
    `;
    const modal = document.createElement('insetu-modal');
    modal.id = 'new-folder-modal';
    modal.titleText = modalTitle;
    modal.innerHTML = `
        <div slot="body">${bodyHtml}</div>
        <div slot="footer">
            <button id="btn-submit-new-folder" class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-${isRoot ? 'primary' : 'primary'}); color: white; border: none; font-weight: bold; cursor: pointer;">${submitLabel}</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.open = true;
    modal.addEventListener('modal-closed', () => modal.remove());

    modal.querySelector('#btn-submit-new-folder').onclick = async () => {
        await saveNewFolder(modal.id);
    };
}

async function saveNewFolder(modalId = 'new-folder-modal') {
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
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/fs/save`, {
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
            if (isNewRepo) {
                const rRes = await fetch(`/api/${activeWs}/repos?t=` + Date.now());
                if (rRes.ok) {
                    const d = await rRes.json();
                    AppStore.setState({ allRepos: d.repos, targetConfigs: d.targets || [] });
                }
            }

            // Surgically inject into the local manifest state
            const { manifest } = AppStore.getState();
            const repoDir = filepath.split('/')[0];
            const defaultBucket = `${repoDir}_context.txt`;

            if (manifest[defaultBucket]) {
                if (!manifest[defaultBucket].files.includes(filepath)) {
                    manifest[defaultBucket].files.push(filepath);
                }
            } else {
                manifest[defaultBucket] = {
                    files: [filepath],
                    meta: { title: repoDir, domain: "Workspaces", desc: "Context payload." }
                };
            }
            AppStore.setState({ manifest: manifest });
            const m = document.getElementById(modalId);
            if (m && m.close) m.close();
            else if (m) m.remove();

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
export function insertTextAtCursor(textToInsert) {
    const textArea = document.getElementById('modal-text');
    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const isMDE = (mdeWrap && window.getComputedStyle(mdeWrap).display !== 'none' && typeof mdeInstance !== 'undefined' && mdeInstance);

    if (isMDE) {
        const cm = mdeInstance.codemirror;
        cm.replaceSelection(textToInsert);
        cm.focus();
    } else if (textArea) {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        textArea.value = textArea.value.substring(0, start) + textToInsert + textArea.value.substring(end);
        textArea.selectionStart = textArea.selectionEnd = start + textToInsert.length;
        textArea.focus();
        textArea.dispatchEvent(new Event('input'));
    }
}

export async function viewSourceFile(filepath, isFS = false) {
    // UDF/Extension Mandate: Allow extensions to hijack the rendering flow before booting the raw text modal
    if (window.inSetu?.extensions?.Registry?.executeUIHook) {
        if (window.inSetu.extensions.Registry.executeUIHook('zone:file-edit-override', filepath)) {
            return;
        }
    }

    currentModalFile = filepath;
    currentModalIsFS = isFS;
    currentModalForceEdit = false;
    currentModalIsMemoryOnly = false;
    document.getElementById('modal-title').innerText = filepath;
    const textArea = document.getElementById('modal-text');
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
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    const dlBtn = document.getElementById('modal-dl-btn');
    if (dlBtn && !currentModalIsMemoryOnly) {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        dlBtn.dataset.filename = filepath.split('/').pop();

        let dlFetchUrl = isFS ? `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(filepath)}` : `/download/${filepath}`;
        if (window.inSetu?.extensions?.Registry?.executeUIHook) {
            const overrideUrl = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', filepath);
            if (overrideUrl) dlFetchUrl = overrideUrl;
        }
        dlBtn.dataset.fetchUrl = dlFetchUrl;
    }
    if (isFS) {
        tb.style.display = 'flex';

        const btnFile = document.getElementById('btn-menu-file');
        const btnEdit = document.getElementById('btn-menu-edit');
        const btnExt = document.getElementById('btn-menu-ext');

        btnFile.onclick = (e) => {
            window.inSetu.ui.Factory.createDropdown({
                anchor: e.target,
                items: [
                    { label: 'Move', icon: '🚚', onClick: window.openMoveModal },
                    { label: 'Archive', icon: '📦', onClick: window.archiveModalFile },
                    { label: 'Delete', icon: '🗑️', onClick: window.deleteModalFile }
                ]
            });
        };

        btnEdit.onclick = (e) => {
            const items = [
                { label: 'Insert Link', icon: '🔗', onClick: window.openLinkModal }
            ];
            if (isMarkdown || ext === 'txt') {
                items.push({ label: 'Clean AI Tags', icon: '🧹', onClick: window.cleanModalFile });
            }
            window.inSetu.ui.Factory.createDropdown({
                anchor: e.target,
                items: items
            });
        };

        let extMenuItems = [];
        if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
            window.inSetu.extensions.Registry.executeUIHook('zone:modal-ext-menu', { filepath, isMarkdown, ext, menuItems: extMenuItems });
        }

        if (extMenuItems.length > 0) {
            btnExt.style.display = 'block';
            btnExt.onclick = (e) => {
                window.inSetu.ui.Factory.createDropdown({
                    anchor: e.target,
                    items: extMenuItems
                });
            };
        } else {
            btnExt.style.display = 'none';
        }
    } else {
        tb.style.display = 'none';
    }

    const mdeWrap = document.querySelector('.EasyMDEContainer');

    if (isSupportedEditor && mdeWrap) {
        mdeWrap.style.display = 'flex';
        textArea.style.display = 'none';
        setTimeout(() => mdeInstance.codemirror.refresh(), 10);
    } else {
        if (mdeWrap) mdeWrap.style.display = 'none';
        textArea.style.display = 'block';
    }

    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filepath));
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToModal(text, isSupportedEditor, isMarkdown, isFS);
    } catch (e) {
        const errText = "Error loading file content.";
if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(errText);
        else textArea.value = errText;
    }
}
let currentFileTree = {};
let currentBrowseManifest = [];
function closeBrowseModal() {
    const m = document.getElementById('browse-modal');
    if (m && m.close) m.close();
    AppStore.setState({ browserConfig: { mode: 'view', callback: null } });
}
export function openWorkspaceBrowser(options = {}) {
    const {
        mode = 'view', // 'view', 'folder', 'file'
        title = 'Browse Workspace',
        files = null,
        callback = null,
        autoDrilldown = false
    } = options;
    AppStore.setState({ browserConfig: { mode, callback } });

    document.getElementById('browse-select-folder-btn').style.display = mode === 'folder' ? 'block' : 'none';
    document.getElementById('browse-search').style.display = mode === 'folder' ? 'none' : 'block';

    let targetManifest = [];
    if (files) {
        targetManifest = files;
    } else {
        const allFiles = new Set();
        const { manifest } = AppStore.getState();
        Object.values(manifest).forEach(obj => {
            if (obj.files) obj.files.forEach(f => allFiles.add(f));
        });
        targetManifest = Array.from(allFiles);
    }
    currentBrowseManifest = targetManifest;
    currentFileTree = buildFileTree(currentBrowseManifest);

    let cbPath = [];
    document.getElementById('browse-search').value = '';
    const clearBtn = document.getElementById('browse-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';

    if (autoDrilldown) {
        let current = currentFileTree;
        while (true) {
            const keys = Object.keys(current).filter(k => k !== '_isFile');
            if (keys.length === 1) {
                const onlyKey = keys[0];
                if (!current[onlyKey]._isFile) {
                    cbPath.push(onlyKey);
                    current = current[onlyKey];
                    continue;
                }
            }
            break;
        }
    }
    AppStore.setState({ currentBrowsePath: cbPath });

    let modal = document.getElementById('browse-modal');
    if (!modal) {
        modal = document.createElement('insetu-modal');
        modal.id = 'browse-modal';
        modal.innerHTML = `
            <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden; flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                    <input type="text" id="browse-search" placeholder="Fuzzy find files..." style="flex: 1; min-width: 200px; margin: 0; padding: 6px 10px; font-size: 14px;" onkeyup="filterBrowse(this.value)">
                    <button id="browse-clear-btn" onclick="clearBrowseSearch()" class="btn-sm" style="background: #64748b; margin: 0; display: none;">❌ Clear Search</button>
                </div>
                <div id="browse-list" style="display: flex; flex-direction: column; flex: 1; overflow-y: auto;"></div>
            </div>
            <div slot="footer">
                <button id="browse-select-folder-btn" onclick="confirmFolderSelection()" class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-success); color: white; border: none; font-weight: bold; cursor: pointer; display: none;">✅ Select This Folder</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('modal-closed', () => {
            modal.remove();
            AppStore.setState({ browserConfig: { mode: 'view', callback: null } });
        });
    }

    modal.titleText = title;
    modal.open = true;

    document.getElementById('browse-select-folder-btn').style.display = mode === 'folder' ? 'block' : 'none';
    document.getElementById('browse-search').style.display = mode === 'folder' ? 'none' : 'block';

    const container = document.getElementById('browse-list');

    container.innerHTML = `
        <div @card-clicked="\${(e) => window._handleBrowserCardClick(e.detail)}">
            <insetu-file-tree 
                id="browse-fs-tree"
                basePath=""
                @path-changed="\${(e) => window.inSetu.stores.App.setState({ currentBrowsePath: e.detail.path })}">
            </insetu-file-tree>
        </div>
    `;

    const treeEl = container.querySelector('insetu-file-tree');
    if (treeEl) {
        treeEl.files = currentBrowseManifest;
        treeEl.currentPath = cbPath;
        treeEl.hideFiles = (mode === 'folder');

        treeEl.addEventListener('card-clicked', (e) => window._handleBrowserCardClick(e.detail));
        treeEl.addEventListener('path-changed', (e) => {
            AppStore.setState({ currentBrowsePath: e.detail.path });
        });
    }
}

window._handleBrowserCardClick = function(detail) {
    const { browserConfig } = AppStore.getState();
    if (browserConfig && browserConfig.mode === 'file') {
        if (browserConfig.callback) browserConfig.callback(detail.filename);
        closeBrowseModal();
    } else if (browserConfig && browserConfig.mode === 'view') {
        if (detail.isSource && window.viewSourceFile) window.viewSourceFile(detail.filename, true);
    }
};

export function openFolderBrowser(callback = null) {
    openWorkspaceBrowser({ mode: 'folder', title: 'Select Destination Folder', callback: callback });
}

function confirmFolderSelection() {
    const { currentBrowsePath, browserConfig } = AppStore.getState();
    const selectedPath = (currentBrowsePath || []).join('/');
    if (browserConfig && browserConfig.callback) {
        browserConfig.callback(selectedPath);
        closeBrowseModal();
        return;
    }

    const filename = currentModalFile ? currentModalFile.split('/').pop() : '';
    const finalPath = selectedPath ? (filename ? `${selectedPath}/${filename}` : selectedPath) : filename;

    const moveInput = document.getElementById('move-dest-path');
    if (moveInput) moveInput.value = finalPath;
    closeBrowseModal();
}

function clearBrowseSearch() {
    document.getElementById('browse-search').value = '';
    document.getElementById('browse-clear-btn').style.display = 'none';
    filterBrowse('');
}

function filterBrowse(query) {
    window.ExtensionRegistry.utils.debounce('browseSearch', () => {
        const q = query.toLowerCase().trim();
        const container = document.getElementById('browse-list');
        const clearBtn = document.getElementById('browse-clear-btn');
        if (!q) {
            if (clearBtn) clearBtn.style.display = 'none';
            const { browserConfig } = AppStore.getState();
            const modal = document.getElementById('browse-modal');
            openWorkspaceBrowser({ mode: browserConfig.mode, title: modal ? modal.titleText : 'Browse', files: currentBrowseManifest });
            return;
        }

        if (clearBtn) clearBtn.style.display = 'block';
        container.replaceChildren();

        const terms = q.split(/\\s+/).filter(t => t);
        const matches = currentBrowseManifest.filter(f => {
            const lowerF = f.toLowerCase();
            return terms.every(t => lowerF.includes(t));
        });

        if (matches.length === 0) {
            container.innerHTML = '<div style="padding: 15px; color: var(--text-muted);">No matching files found.</div>';
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
    }, 200);
}

export function buildFileTree(files) {
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
export function openBrowseModal(contextFilename) {
    const { manifest } = AppStore.getState();
    const files = (manifest[contextFilename] && manifest[contextFilename].files) ? manifest[contextFilename].files : [];
    openWorkspaceBrowser({
        mode: 'view',
        title: `Browsing: ${contextFilename}`,
        files: files,
        autoDrilldown: true
    });
}
export function closeFileModal() {
    const textArea = document.getElementById('modal-text');
    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const isMDE = (mdeWrap && window.getComputedStyle(mdeWrap).display !== 'none' && typeof mdeInstance !== 'undefined');
    const currentVal = isMDE ? mdeInstance.codemirror.getValue() : (textArea ? textArea.value : '');

    if (currentModalIsFS && currentVal !== currentModalOriginalText) {
        if (!confirm("You have unsaved changes. Are you sure you want to close this file?")) {
            return;
        }
    }

    document.getElementById('file-modal').style.display = 'none';

    // Reset state
    currentModalOriginalText = '';
    if (textArea) textArea.value = '';
    if (isMDE) mdeInstance.value('');
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
}

window.closeFileModal = closeFileModal;

export function openVirtualFile(filename, content) {
    currentModalFile = filename;
    currentModalIsFS = false;
    currentModalIsMemoryOnly = true;
    document.getElementById('modal-title').innerText = filename;
const textArea = document.getElementById('modal-text');
if (typeof mdeInstance !== 'undefined' && mdeInstance) {
        mdeInstance.codemirror.setOption("mode", "markdown");
    }

    currentModalForceEdit = true;
    injectTextToModal(content, (typeof mdeInstance !== 'undefined' && !!mdeInstance), true, false, true);
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    if (tb) tb.style.display = 'none';

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    if (mdeWrap) {
        mdeWrap.style.display = 'flex';
        textArea.style.display = 'none';
        setTimeout(() => mdeInstance.codemirror.refresh(), 10);
    } else {
        textArea.style.display = 'block';
    }
}
// Window Bindings
window.openVirtualFile = openVirtualFile;
window.openNewFileModal = openNewFileModal;
window.saveNewFile = saveNewFile;
window.openNewFolderModal = openNewFolderModal;
window.saveNewFolder = saveNewFolder;
window.checkFileExtension = checkFileExtension;
window.saveModalFile = saveModalFile;
window.copyFromModal = copyFromModal;
window.openMoveModal = openMoveModal;
window.executeMove = executeMove;
window.archiveModalFile = archiveModalFile;
window.deleteModalFile = deleteModalFile;
window.cleanModalFile = cleanModalFile;
window.downloadFromModal = downloadFromModal;
window.clearGlobalFSSearch = clearGlobalFSSearch;
window.filterGlobalFS = filterGlobalFS;
window.openFsDropdown = openFsDropdown;

window.closeBrowseModal = closeBrowseModal;
window.openFolderBrowser = openFolderBrowser;
window.confirmFolderSelection = confirmFolderSelection;
window.clearBrowseSearch = clearBrowseSearch;
window.filterBrowse = filterBrowse;
window.openWorkspaceBrowser = openWorkspaceBrowser;
window.viewAndCopy = viewAndCopy;
export async function executeQuickPack(targetDir, recursive = false, specificFiles = null) {
    setGlobalStatus("⏳ Generating Ad-Hoc Context...", null);
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/gather/quick-pack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_dir: targetDir,
                recursive: recursive,
                specific_files: specificFiles
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate context.");

        // Open the physical file that was just written to disk natively
        viewAndCopy(data.filename);

        // Silently re-hydrate the manifest state to reactively update the UI without hitting the heavy `/submit` compiler
        const mRes = await fetch(`/api/${activeWs}/manifest?t=${Date.now()}`);
        if (mRes.ok) {
            AppStore.setState({ manifest: await mRes.json() });
        }

        setGlobalStatus("✅ Ad-Hoc Context added to Clipboard!", 3000);
    } catch (e) {
        alert("Error creating quick-pack: " + e.message);
        setGlobalStatus("❌ Quick-Pack failed", 3000, true);
    }
}
export async function openQuickPackModal(targetDir) {
    let current = globalFileTree;
    const gbPath = AppStore.getState().globalBrowsePath || [];
    for (const p of gbPath) {
        if (current[p]) current = current[p];
        else break;
    }

    const fileKeys = Object.keys(current).filter(k => k !== '_isFile' && current[k]._isFile).sort();

    if (fileKeys.length === 0) {
        alert("No files available in this directory to pack.");
        return;
    }

    // State Tracking (Zero DOM Reading)
    const selectedFiles = new Set();

    let checkboxesHtml = '';
    fileKeys.forEach((key, index) => {
        const fullPath = current[key].fullPath;
        selectedFiles.add(fullPath); // Default all to checked

        checkboxesHtml += `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <input type="checkbox" id="qp-cb-${index}" value="${fullPath}" style="cursor: pointer; transform: scale(1.2);" checked 
                    onchange="if(this.checked) { window._qpSet.add(this.value); } else { window._qpSet.delete(this.value); }">
                <label for="qp-cb-${index}" style="cursor: pointer; word-break: break-all; flex: 1; font-family: monospace; font-size: 0.9rem; color: var(--text);">${key}</label>
            </div>
        `;
    });

    // Expose transient state to the DOM string handlers
    window._qpSet = selectedFiles;
    const modal = document.createElement('insetu-modal');
    modal.id = 'quick-pack-modal-' + Date.now();
    modal.titleText = `Quick-Pack Select: ${targetDir}`;
    modal.innerHTML = `
        <div slot="body" style="display: flex; flex-direction: column; gap: 5px; max-height: 50vh; overflow-y: auto; padding-right: 10px;">${checkboxesHtml}</div>
        <div slot="footer">
            <button id="btn-pack-selected" class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;">📦 Pack Selected</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.open = true;
    modal.addEventListener('modal-closed', () => modal.remove());

    modal.querySelector('#btn-pack-selected').onclick = () => {
        const selectedArray = Array.from(window._qpSet);
        if (selectedArray.length === 0) {
            alert("Please select at least one file.");
            return;
        }
        executeQuickPack(targetDir, false, selectedArray);
        delete window._qpSet; // Clean up transient state
        modal.close();
    };
}
export function openFsDropdown(anchorElement) {
    if (!window.inSetu.ui.Factory || !window.inSetu.ui.Factory.createDropdown) return;

    const gbPath = AppStore.getState().globalBrowsePath || [];
    const currentPath = gbPath.join('/');

    const items = [];

    if (gbPath.length === 0) {
        items.push({ label: 'New Repository', icon: '📦', onClick: () => window.openNewFolderModal() });
    } else {
        items.push({ label: 'New Folder', icon: '📁', onClick: () => window.openNewFolderModal(currentPath + '/') });
        items.push({ label: 'New File', icon: '📄', onClick: () => window.openNewFileModal(currentPath + '/') });
        items.push({ divider: true });
        items.push({ label: `Quick-Pack: Folder`, icon: '📦', onClick: () => executeQuickPack(currentPath, false) });
        items.push({ label: `Quick-Pack: Recursive`, icon: '🗂️', onClick: () => executeQuickPack(currentPath, true) });
        items.push({ divider: true });
        items.push({ label: `Quick-Pack: Select Files...`, icon: '☑️', onClick: () => openQuickPackModal(currentPath) });
    }

    window.inSetu.ui.Factory.createDropdown({
        anchor: anchorElement,
        items: items
    });
}

window.openFsDropdown = openFsDropdown;
export async function clearQuickPacks() {
    if (!confirm("Clear all Quick-Pack clipboard items?")) return;
    setGlobalStatus("⏳ Clearing Clipboard...", null);
    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/gather/quick-pack/clear`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error("Failed to clear quick-packs.");

        const mRes = await fetch(`/api/${activeWs}/manifest?t=${Date.now()}`);
        if (mRes.ok) {
            AppStore.setState({ manifest: await mRes.json() });
        }

        setGlobalStatus("✅ Clipboard cleared!", 2000);
    } catch (e) {
        alert("Error clearing clipboard: " + e.message);
        setGlobalStatus("❌ Clear failed", 3000, true);
    }
}

window.clearQuickPacks = clearQuickPacks;
let activeLinkTab = 'filename';
export function openLinkModal() {
    // Hydrate manifest explicitly if missing to ensure files are available
    if (!globalManifest || globalManifest.length === 0) {
        const allFiles = new Set();
        const { manifest } = AppStore.getState();
        Object.values(manifest).forEach(obj => {
            if (obj.files) obj.files.forEach(f => {
                if (f.toLowerCase().endsWith('.md')) allFiles.add(f);
            });
        });
        globalManifest = Array.from(allFiles);
    }
    const bodyHtml = `
        <div style="height: 40px; flex-shrink: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border);">
            <div class="sub-tabs">
                <div class="sub-tab active" id="lt-filename" onclick="switchLinkTab('filename')">Filename</div>
                <div class="sub-tab" id="lt-deep" onclick="switchLinkTab('deep')">Deep Search</div>
            </div>
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-shrink: 0;">
            <input type="text" id="link-search-input" placeholder="Search files..." style="flex: 1; padding: 8px;  margin: 0;" oninput="if(typeof onLinkSearchInput === 'function') onLinkSearchInput(this.value)">
            <button id="btn-deep-search" onclick="executeDeepLinkSearch()" class="btn-sm" style="background: var(--intent-highlight); margin: 0; display: none;">🔍 Search</button>
        </div>
        <div id="link-results-list" style="display: flex; flex-direction: column; overflow-y: auto; flex: 1; gap: 5px; min-height: 200px;">
            <span style="color:var(--text-muted); font-style:italic;">Type to search...</span>
        </div>
    `;
    const modal = document.createElement('insetu-modal');
    modal.id = 'link-insert-modal';
    modal.titleText = 'Insert Link';
    modal.innerHTML = `<div slot="body" style="display: flex; flex-direction: column; height: 100%;">${bodyHtml}</div>`;
    document.body.appendChild(modal);
    modal.open = true;
    modal.addEventListener('modal-closed', () => modal.remove());

    switchLinkTab('filename');
}

export function switchLinkTab(tab) {
    activeLinkTab = tab;
    document.getElementById('lt-filename').classList.toggle('active', tab === 'filename');
    document.getElementById('lt-deep').classList.toggle('active', tab === 'deep');

    if (tab === 'filename') {
        document.getElementById('btn-deep-search').style.display = 'none';
        onLinkSearchInput(document.getElementById('link-search-input').value);
    } else {
        document.getElementById('btn-deep-search').style.display = 'block';
        document.getElementById('link-results-list').innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Hit search to rank by multi-word matching...</span>';
    }
}
export function onLinkSearchInput(val) {
    if (activeLinkTab !== 'filename') return;
    window.ExtensionRegistry.utils.debounce('linkSearch', () => {
        executeLinkSearch(val);
    }, 300);
}
export async function executeDeepLinkSearch() {
    const val = document.getElementById('link-search-input').value;
    const container = document.getElementById('link-results-list');
    const q = val.toLowerCase().trim();

    if (!q) {
        container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Type to search contents...</span>';
        return;
    }
    container.innerHTML = '<div class="spinner" style="display:block; margin-top:0;">Searching file contents across workspace...</div>';
    document.getElementById('btn-deep-search').disabled = true;

    try {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/fs/search?q=` + encodeURIComponent(q));
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();

        container.replaceChildren();
        if (data.results.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No files found matching contents.</span>';
            return;
        }

        data.results.forEach(item => {
            const name = item.path.split('/').pop();
            const card = document.createElement('insetu-card');
            card.filename = item.path;
            card.titleText = name;
            card.detailText = item.path;
            if (item.snippet) {
                card.descriptionText = `"...${item.snippet.replace(/</g, '&lt;')}"`;
            }
            card.icon = '📄';
            card.intentColor = 'var(--intent-primary)';

            const scoreTag = document.createElement('span');
            scoreTag.slot = 'header-tags';
            scoreTag.style.cssText = 'font-size: 0.7rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px;';
            scoreTag.innerText = `Score: ${item.score}`;
            card.appendChild(scoreTag);

            card.addEventListener('card-clicked', () => insertLinkToEditor(item.path, name));
            container.appendChild(card);
        });
    } catch (e) {
        container.innerHTML = `<span style="color:red;">Error: ${e.message}</span>`;
    } finally {
        document.getElementById('btn-deep-search').disabled = false;
    }
}

function executeLinkSearch(query) {
    const container = document.getElementById('link-results-list');
    const q = query.toLowerCase().trim();

    if (!q) {
        container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Type to search...</span>';
        return;
    }
    const results = globalManifest.filter(path => path.toLowerCase().includes(q)).slice(0, 50);

    container.replaceChildren();
    if (results.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No markdown files found.</span>';
        return;
    }
    results.forEach(path => {
        const name = path.split('/').pop();
        const card = document.createElement('insetu-card');
        card.filename = path;
        card.titleText = name;
        card.detailText = path;
        card.icon = '📄';
        card.intentColor = 'var(--intent-primary)';
        card.addEventListener('card-clicked', () => insertLinkToEditor(path, name));
        container.appendChild(card);
    });
}
function insertLinkToEditor(path, name) {
    let finalPath = path;

    // Calculate intelligent relative path based on the file currently open in the modal
    if (currentModalFile) {
        const { targetConfigs } = window.inSetu.stores.App.getState();

        // Rely on the SSOT configuration to prevent 'insetu/insetu' edge case failures
        const getRepo = (p) => {
            const match = targetConfigs.find(c => p.startsWith(c.repo_dir + '/'));
            return match ? match.repo_dir : p.split('/')[0];
        };

        const currentRepo = getRepo(currentModalFile);
        const targetRepo = getRepo(path);

        if (currentRepo !== targetRepo) {
            // Cross-repo boundary! Use the explicit backend-supported syntax
            const targetPathWithinRepo = path.substring(targetRepo.length + 1);
            finalPath = `${targetRepo}::${targetPathWithinRepo}`;
        } else {
            // Same repo: Use standard relative path generation
            const currentParts = currentModalFile.split('/');
            currentParts.pop();
            // Remove filename to anchor at its directory
            const targetParts = path.split('/');
            let commonLength = 0;
        while (commonLength < currentParts.length && commonLength < targetParts.length && currentParts[commonLength] === targetParts[commonLength]) {
            commonLength++;
        }
        const upSteps = currentParts.length - commonLength;
        const upString = upSteps > 0 ? '../'.repeat(upSteps) : './';
        const downString = targetParts.slice(commonLength).join('/');

        finalPath = upString + downString;
        }
    }
    const linkText = `[${name}](${finalPath})`;

    if (window.insertTextAtCursor) {
        window.insertTextAtCursor(linkText);
    }

    window.inSetu.ui.Factory.closeModal('link-insert-modal');
}

// Expose new functions to the window so HTML element handlers can reach them
window.openLinkModal = openLinkModal;
window.switchLinkTab = switchLinkTab;
window.onLinkSearchInput = onLinkSearchInput;
window.executeDeepLinkSearch = executeDeepLinkSearch;
window.viewSourceFile = viewSourceFile;
window.insertTextAtCursor = insertTextAtCursor;
