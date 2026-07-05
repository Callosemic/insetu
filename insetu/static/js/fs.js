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
let isPreviewMode = false;
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
    if (isMarkdown && isPreviewMode) renderMarkdownPreview();
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

    if (isMarkdown && isPreviewMode) renderMarkdownPreview();
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

function renderMarkdownPreview() {
    const preview = document.getElementById('modal-preview');
    let text = document.getElementById('modal-text').value;
    // Intercept YAML frontmatter and wrap it in a custom styled block
    const yamlRegex = /^---\n([\s\S]*?)\n---/;
    text = text.replace(yamlRegex, (match, p1) => {
        // Auto-link URLs inside the frontmatter
        const linkedP1 = p1.replace(/(https?:\/\/[^\s"']+)/g, '<a href="$1" target="_blank" style="color: var(--intent-primary); text-decoration: underline;">$1</a>');
        return '<pre class="yaml-frontmatter">' + linkedP1 + '</pre>';
});
// Sanitize raw text vectors against script tag injection using DOMPurify
let htmlContent = marked.parse(text);
if (typeof DOMPurify !== 'undefined') {
    htmlContent = DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['target'] });
} else {
    htmlContent = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '⚠️ [Script Blocked]');
}
preview.innerHTML = htmlContent;

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
    // Wiki-link interception
    const links = preview.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showWikiPopup(e, link.getAttribute('href'), link.getAttribute('title'));
        });
    });
}

let activeWikiPopup = null;
function showWikiPopup(e, href, title) {
    if (activeWikiPopup) activeWikiPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'wiki-link-popup';
    popup.style.position = 'fixed';

    // Offset slightly so it doesn't immediately intercept subsequent clicks
    popup.style.left = (e.clientX + 10) + 'px';
    popup.style.top = (e.clientY + 15) + 'px';

    const displayHref = href.length > 40 ? href.substring(0, 40) + '...' : href;
    const titleHtml = title ? `<div style="font-size: 0.85rem; font-weight: bold; color: var(--btn); margin-bottom: 4px;">${title}</div>` : '';

    popup.innerHTML = `
        <div style="display: flex; flex-direction: column;">
            ${titleHtml}
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-size: 0.8rem; color: var(--text); opacity: 0.8;">${displayHref}</span>
                <button class="btn-sm" style="background: var(--btn); margin: 0; padding: 4px 8px; font-weight: bold;">Go</button>
            </div>
        </div>
    `;

    const goBtn = popup.querySelector('button');
    goBtn.onclick = () => {
        popup.remove();
        activeWikiPopup = null;

        let targetPath = href;

        // Handle local relative paths
        if (!href.startsWith('http') && !href.startsWith('/')) {
            const parts = currentModalFile.split('/');
            parts.pop(); // Remove current filename to anchor at its directory

            if (href.startsWith('./')) {
                targetPath = parts.join('/') + '/' + href.substring(2);
            } else if (href.startsWith('../')) {
                let hrefParts = href.split('/');
                while(hrefParts[0] === '..') {
                    hrefParts.shift();
                    parts.pop();
                }
                targetPath = parts.join('/') + '/' + hrefParts.join('/');
            } else {
                targetPath = parts.length > 0 ? parts.join('/') + '/' + href : href;
            }
            // Sanitize redundant slashes
            targetPath = targetPath.replace(/\/+/g, '/').replace(/^\/+/, '');
        }
        if (targetPath.startsWith('http')) {
            window.open(targetPath, '_blank');
        } else {
            const ext = targetPath.split('.').pop().toLowerCase();
            const mediaExts = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mp3', 'wav', 'webm'];

            if (mediaExts.includes(ext)) {
                // Open PDFs and images in a new browser tab using the inline viewer
                window.open('/download/' + encodeURIComponent(targetPath) + '?inline=1', '_blank');
            } else if (['zip', 'docx', 'xlsx', 'pptx', 'tar', 'gz'].includes(ext)) {
                // Force a direct download for heavy binaries
                window.open('/download/' + encodeURIComponent(targetPath), '_blank');
            } else {
                // Assume workspace text/code and open it in the modal
                viewSourceFile(targetPath, true);
            }
        }
    };

    document.body.appendChild(popup);
    activeWikiPopup = popup;

    // Listen for outside clicks to close the pop-up gracefully
    setTimeout(() => {
        const closer = (ev) => {
            if (!popup.contains(ev.target)) {
                popup.remove();
                activeWikiPopup = null;
                document.removeEventListener('click', closer);
            }
        };
        document.addEventListener('click', closer);
    }, 10);
}
function toggleModalMode() {
    if (isPreviewMode && window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        const override = window.inSetu.extensions.Registry.executeUIHook('zone:file-edit-override', currentModalFile);
        if (override) return;
    }

    isPreviewMode = !isPreviewMode;
    const toggleBtn = document.getElementById('modal-toggle-btn');
    const textArea = document.getElementById('modal-text');
    const preview = document.getElementById('modal-preview');
    const editZone = document.getElementById('edit-zone-buttons');
    const editDivider = document.getElementById('edit-zone-divider');

    const { ext, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(currentModalFile);
    const dlBtn = document.getElementById('modal-dl-btn');
    if (dlBtn && !currentModalIsMemoryOnly) {
        dlBtn.dataset.filename = filename.split('/').pop();
        dlBtn.dataset.fetchUrl = `/download/${filename}`;
    }

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    if (isPreviewMode) {
        renderMarkdownPreview();
        textArea.style.display = 'none';
        if (mdeWrap) mdeWrap.style.display = 'none';
        preview.style.display = 'block';
        toggleBtn.innerText = '📝 Edit';
        if (editZone) editZone.style.display = 'none';
        if (editDivider) editDivider.style.display = 'none';
        setTimeout(() => preview.focus(), 50);
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
        if (editZone) editZone.style.display = 'flex';
        if (editDivider) editDivider.style.display = 'block';
    }
}
async function viewAndCopy(filename) {
    currentModalFile = filename;
    currentModalIsFS = false;
    currentModalForceEdit = false;
    currentModalIsMemoryOnly = false;
    document.getElementById('modal-title').innerText = filename;

    const textArea = document.getElementById('modal-text');
    const preview = document.getElementById('modal-preview');
    const toggleBtn = document.getElementById('modal-toggle-btn');

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
    if (isMarkdown) {
        toggleBtn.style.display = 'block';
        isPreviewMode = true;
        textArea.style.display = 'none';
        if (mdeWrap) mdeWrap.style.display = 'none';
        preview.style.display = 'block';
        toggleBtn.innerText = '📝 Edit';
        preview.innerHTML = '<p>Loading...</p>';
        setTimeout(() => preview.focus(), 50);
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
        injectTextToModal(text, isSupportedEditor, isMarkdown, false);
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
function copyFromModal() {
    const text = document.getElementById('modal-text').value;
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
        <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Destination Path (including filename):</label>
        <input type="text" id="move-dest-path" value="${currentModalFile}" placeholder="e.g. repo/new_folder/my_file.py" style="width: 100%; padding: 8px; margin-bottom: 15px; font-family: monospace; box-sizing: border-box;">
        <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Select Target Directory:</label>
        <div id="move-browser-container" style="border: 1px solid var(--border); border-radius: 4px; height: 250px; overflow-y: auto; background: var(--pane-bg); padding: 10px;">
            <div class="spinner" style="display:block;">Loading folders...</div>
        </div>
    `;
    window.inSetu.ui.Factory.createModal({
        id: 'move-modal',
        title: 'Move File',
        body: bodyHtml,
        actions: [
            { label: '🚚 Move File', style: 'primary', id: 'execute-move-btn', onClick: async (e, modal) => {
                await executeMove(modal.id);
                return true;
            }}
        ]
    });

    setTimeout(() => {
        mountFolderBrowser(document.getElementById('move-browser-container'), (selectedPath) => {
            const filename = currentModalFile ? currentModalFile.split('/').pop() : '';
            document.getElementById('move-dest-path').value = selectedPath ? (filename ? `${selectedPath}/${filename}` : selectedPath) : filename;
        });
    }, 50);
}
export function mountFolderBrowser(container, onSelect) {
    container.innerHTML = '';
    const allFiles = new Set();
    const { manifest } = AppStore.getState();
    Object.values(manifest).forEach(obj => {
        if (obj.files) obj.files.forEach(f => allFiles.add(f));
    });
    const fileTree = buildFileTree(Array.from(allFiles));
    let currentPath = [];

    const render = () => {
        container.innerHTML = '';

        // Breadcrumbs & Up Navigation
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 10px;';

        const upBtn = document.createElement('button');
        upBtn.className = 'btn-sm';
        upBtn.innerText = '⬆️ Up';
        upBtn.disabled = currentPath.length === 0;
        upBtn.style.background = upBtn.disabled ? 'transparent' : 'var(--intent-neutral)';
        upBtn.style.color = upBtn.disabled ? 'var(--border)' : '#fff';
        upBtn.style.border = upBtn.disabled ? '1px solid var(--border)' : 'none';
        upBtn.onclick = () => { currentPath.pop(); render(); onSelect(currentPath.join('/')); };

        const pathText = document.createElement('span');
        pathText.style.cssText = 'font-family: monospace; color: var(--text); opacity: 0.7; word-break: break-all; font-size: 0.9rem;';
        pathText.innerText = '/' + currentPath.join('/');

        headerDiv.appendChild(upBtn);
        headerDiv.appendChild(pathText);
        container.appendChild(headerDiv);

        let current = fileTree;
        for (const p of currentPath) { current = current[p]; }

        const keys = Object.keys(current).filter(k => k !== '_isFile' && !current[k]._isFile).sort((a, b) => a.localeCompare(b));

        if (keys.length === 0) {
            container.innerHTML += '<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>';
            return;
        }

        keys.forEach(key => {
            const card = document.createElement('div');
            card.style.cssText = 'padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background 0.2s; margin-bottom: 4px;';
            card.innerHTML = `<span style="font-family: monospace; font-weight: bold; color: var(--intent-warning); margin-right: 8px;">📁</span><span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${key}</span>`;

            card.onmouseover = () => card.style.background = 'var(--input-bg)';
            card.onmouseout = () => card.style.background = 'transparent';

            card.onclick = () => {
                currentPath.push(key);
                render();
                onSelect(currentPath.join('/'));
            };
            container.appendChild(card);
        });
    };
    render();
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
            if (window.inSetu.ui.Factory) window.inSetu.ui.Factory.closeModal(modalId);
            else document.getElementById(modalId).style.display = 'none';

            document.getElementById('file-modal').style.display = 'none';

            updateManifestState(currentModalFile, destPath);
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
            if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', currentModalFile);
            }
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
            updateManifestState(oldPath);
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
            if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', oldPath);
            }
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
            updateManifestState(oldPath);
            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) loadGlobalFS();
            if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', oldPath);
            }
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

    if (ext === 'md' && isPreviewMode) {
        renderMarkdownPreview();
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
            const fetchUrl = currentModalIsFS ? `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(currentModalFile)}` : `/download/${currentModalFile}`;
            await downloadFile(fetchUrl, currentModalFile.split('/').pop());
        }
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
    const { manifest } = AppStore.getState();
if (!fileInfo.isSource && manifest[fileInfo.filename]) {
        const browseBtn = document.createElement('button');
        browseBtn.className = 'btn-sm';
        browseBtn.style.background = 'var(--intent-highlight)';
        browseBtn.innerText = '📁 Browse';
        browseBtn.onclick = () => openBrowseModal(fileInfo.filename);
        actions.appendChild(browseBtn);
}
    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        window.inSetu.extensions.Registry.executeUIHook('zone:file-card-actions', {
            filepath: fileInfo.filename,
            repoDir: fileInfo.repoDir,
            isFS: fileInfo.isFS,
            actionsContainer: actions
        });
    }
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-sm';
    dlBtn.style.background = 'var(--intent-primary)';
    dlBtn.style.color = 'white';
    dlBtn.style.border = 'none';
    dlBtn.style.cursor = 'pointer';
    dlBtn.innerText = '⬇️ DL';
    // Native Desktop Drag-and-Drop (Out of Browser)
    dlBtn.draggable = true;
    dlBtn.classList.add('ui-draggable-export');
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    dlBtn.dataset.fetchUrl = fileInfo.isSource ? `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(fileInfo.filename)}` : `/download/${fileInfo.filename}`;
    dlBtn.dataset.filename = fileInfo.isSource ?
fileInfo.filename.split('/').pop() : fileInfo.filename;

    dlBtn.onclick = async (e) => {
        e.stopPropagation();
        const origText = dlBtn.innerText;
        dlBtn.innerText = '⏳...';
        try {
            const activeWs = AppStore.getState().activeWorkspace || 'default';
            const fetchUrl = fileInfo.isSource ?
                `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(fileInfo.filename)}` : `/download/${fileInfo.filename}`;

            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error("Failed to fetch");

            const text = await res.text();
            const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileInfo.isSource ? fileInfo.filename.split('/').pop() : fileInfo.filename;
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

    // Micro-Interaction: Double-click anywhere on the card to open
    card.addEventListener('dblclick', (e) => {
        // Prevent double-triggering if they specifically double-clicked an action button
        if (e.target.tagName === 'BUTTON') return;

        // Clear text selection that naturally happens on double click
        window.getSelection().removeAllRanges();

        if (fileInfo.isSource) viewSourceFile(fileInfo.filename, fileInfo.isFS);
        else viewAndCopy(fileInfo.filename);
    });

    container.appendChild(card);
}
let globalFileTree = {};
let globalManifest = [];
export function loadGlobalFS() {
    const container = document.getElementById('global-fs-list');
    const allFiles = new Set();
    const { manifest, targetConfigs } = AppStore.getState();
    Object.values(manifest).forEach(obj => {
        if (obj.files) obj.files.forEach(f => allFiles.add(f));
    });

    globalManifest = Array.from(allFiles);

    globalFileTree = buildFileTree(globalManifest);
// Explicitly seed configured root repositories to allow initializing empty environments
    if (targetConfigs) {
        targetConfigs.forEach(cfg => {
            if (cfg.repo_dir && !globalFileTree[cfg.repo_dir]) {
                globalFileTree[cfg.repo_dir] = {};
            }
        });
    }

    if (Object.keys(globalFileTree).length === 0) {
        container.innerHTML = '<p style="padding: 15px; color: var(--text-muted);">No repositories configured.</p>';
        return;
    }
    let current = globalFileTree;
    let gbPath = AppStore.getState().globalBrowsePath || [];
    let resetPath = false;
    for (const p of gbPath) {
        if (current[p] && !current[p]._isFile) {
            current = current[p];
        } else {
            resetPath = true;
            break;
        }
    }

    if (resetPath) {
        AppStore.setState({ globalBrowsePath: [] });
    }

    renderGlobalFSLevel();
}
function renderGlobalFSLevel() {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const container = document.getElementById('global-fs-list');
    container.innerHTML = '';
    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
        btnNewFolder.innerText = gbPath.length === 0 ? '+ Repo' : '+ Folder';
    }
    const btnNewFile = document.getElementById('btn-new-file');
    if (btnNewFile) {
        btnNewFile.style.display = gbPath.length === 0 ? 'none' : 'block';
    }

    const btnFsMore = document.getElementById('btn-fs-more');
    if (btnFsMore) {
        btnFsMore.style.display = gbPath.length === 0 ? 'none' : 'block';
    }

    const upBtn = document.getElementById('global-fs-up-btn');
    upBtn.disabled = gbPath.length === 0;
    if (!upBtn.disabled) {
        upBtn.style.background = 'var(--intent-neutral)';
    } else {
        upBtn.style.background = 'transparent';
        upBtn.style.color = 'var(--border)';
        upBtn.style.border = '1px solid var(--border)';
    }

    const pathText = document.getElementById('global-fs-path');
    pathText.innerText = '/' + gbPath.join('/');
    let current = globalFileTree;
    for (const p of gbPath) {
        current = current[p];
    }
    const keys = Object.keys(current).filter(k => k !== '_isFile').sort((a, b) => {
        const aIsDir = !current[a]._isFile;
        const bIsDir = !current[b]._isFile;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });
    const fragment = document.createDocumentFragment();
        keys.forEach(key => {
            const item = current[key];
            if (item._isFile) {
                createFileCard({
                filename: item.fullPath,
                displayName: key,
                description: '',
                isFS: true,
                isSource: true
            }, fragment);
        } else {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.cursor = 'pointer';
            card.style.padding = '12px 15px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.innerHTML = `<span class="folder-label">📁 ${key}</span>`;
            card.onclick = () => {
                const gbPath = AppStore.getState().globalBrowsePath || [];
                AppStore.setState({ globalBrowsePath: [...gbPath, key] });
                renderGlobalFSLevel();
            };
            fragment.appendChild(card);
        }
    });
    container.appendChild(fragment);
}
function globalFSUp() {
    const gbPath = [...(AppStore.getState().globalBrowsePath || [])];
    if (gbPath.length > 0) {
        gbPath.pop();
        AppStore.setState({ globalBrowsePath: gbPath });
        renderGlobalFSLevel();
    }
}
function filterGlobalFS(query) {
    window.ExtensionRegistry.utils.debounce('globalFSSearch', () => {
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
        const gbPath = AppStore.getState().globalBrowsePath || [];
        const currentPrefix = gbPath.length > 0 ? gbPath.join('/') + '/' : '';

        const terms = q.split(/\s+/).filter(t => t);
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
                const card = document.createElement('div');
                card.className = 'file-card';
                card.style.cursor = 'pointer';
                card.style.padding = '8px 15px';
                card.innerHTML = `<span class="file-title" style="color: var(--intent-success);">📄 ${filename}</span><div class="file-desc">${filepath}</div>`;
                card.onclick = () => {
                    if (browserConfig && browserConfig.callback) browserConfig.callback(filepath);
                    closeBrowseModal();
                };
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
    window.inSetu.ui.Factory.createModal({
        id: 'new-file-modal',
        title: 'Create New Workspace File',
        body: bodyHtml,
        actions: [
            { label: '💾 Create & Save File', style: 'primary', id: 'temp-save-file-btn', onClick: async (e, modal) => {
                await saveNewFile(modal.id);

        return true; // Keep modal open during async operation, saveNewFile handles the close
            }}
        ]
    });

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
            if (btn) btn.innerText = "Syncing Tree...";
            await compileContexts();

            const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
            if (mRes.ok) setContextManifest(await mRes.json());

            if (window.inSetu.ui.Factory) window.inSetu.ui.Factory.closeModal(modalId);
            else document.getElementById(modalId).style.display = 'none';

            if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) {
                loadGlobalFS();
            }
            if (document.getElementById('st-prompts') && document.getElementById('st-prompts').classList.contains('active')) {
                if (window.switchSubTab) window.switchSubTab('prompts');
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

    window.inSetu.ui.Factory.createModal({
        id: 'new-folder-modal',
        title: modalTitle,
        body: bodyHtml,
        actions: [
            { label: submitLabel, style: 'primary', id: 'btn-submit-new-folder', onClick: async (e, modal) => {
                await saveNewFolder(modal.id);
                return true; // Keep open so async operations finish and we close it programmatically
            }}
        ]
    });

    if (!isRoot) {
        setTimeout(() => {
            const btn = document.getElementById('btn-submit-new-folder');
            if (btn) btn.style.background = 'var(--intent-primary)'; // Preserve the legacy blue button for generic folders
        }, 50);
    }
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
            btn.innerText = "Syncing Tree...";
            await compileContexts();
            const mRes = await fetch(`/api/${activeWs}/manifest?t=` + Date.now());
            if (mRes.ok) setContextManifest(await mRes.json());
            if (isNewRepo) {
                const rRes = await fetch(`/api/${activeWs}/repos?t=` + Date.now());
                if (rRes.ok) {
                    const d = await rRes.json();
                    AppStore.setState({ allRepos: d.repos, targetConfigs: d.targets || [] });
                }
            }

            if (window.inSetu.ui.Factory) window.inSetu.ui.Factory.closeModal(modalId);
            else {
                const m = document.getElementById(modalId);
                if (m) m.style.display = 'none';
            }

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
    currentModalForceEdit = false;
    currentModalIsMemoryOnly = false;
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
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    const editZone = document.getElementById('edit-zone-buttons');
    const editDivider = document.getElementById('edit-zone-divider');
    const dlBtn = document.getElementById('modal-dl-btn');
    if (dlBtn && !currentModalIsMemoryOnly) {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        dlBtn.dataset.filename = filepath.split('/').pop();
        dlBtn.dataset.fetchUrl = isFS ? `/api/${activeWs}/bridge/fetch?file=${encodeURIComponent(filepath)}` : `/download/${filepath}`;
    }

    if (isFS) {
        tb.style.display = 'flex';
        document.getElementById('modal-clean-btn').style.display = (isMarkdown || ext === 'txt') ? 'block' : 'none';

        if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
            window.inSetu.extensions.Registry.executeUIHook('zone:modal-file-toolbar', { filepath, isMarkdown, ext });
            window.inSetu.extensions.Registry.executeUIHook('zone:modal-edit-toolbar', { filepath, isMarkdown, ext });
        }
    } else {
        tb.style.display = 'none';
    }

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    if (isMarkdown) {
        toggleBtn.style.display = 'block';
        isPreviewMode = true;
        if (editZone) editZone.style.display = 'none';
        if (editDivider) editDivider.style.display = 'none';
        textArea.style.display = 'none';
        if (mdeWrap) mdeWrap.style.display = 'none';
        preview.style.display = 'block';
        toggleBtn.innerText = '📝 Edit';
        preview.innerHTML = '<p>Loading...</p>';
        setTimeout(() => preview.focus(), 50);
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
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await fetch(`/api/${activeWs}/bridge/fetch?file=` + encodeURIComponent(filepath));
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToModal(text, isSupportedEditor, isMarkdown, isFS);
    } catch (e) {
        const errText = "Error loading file content.";
        if (isSupportedEditor && typeof mdeInstance !== 'undefined' && mdeInstance) mdeInstance.value(errText);
        else textArea.value = errText;
        if (isMarkdown && isPreviewMode) preview.innerHTML = '<p style="color:red;">Error loading file.</p>';
    }
}
let currentFileTree = {};
let currentBrowseManifest = [];

function closeBrowseModal() {
    document.getElementById('browse-modal').style.display = 'none';
    AppStore.setState({ browserConfig: { mode: 'view', callback: null } });
    document.getElementById('browse-select-folder-btn').style.display = 'none';
    document.getElementById('browse-search').style.display = 'block';
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
    if (files) {
        currentBrowseManifest = files;
    } else {
        const allFiles = new Set();
        const { manifest } = AppStore.getState();
        Object.values(manifest).forEach(obj => {
            if (obj.files) obj.files.forEach(f => allFiles.add(f));
        });
        currentBrowseManifest = Array.from(allFiles);
    }
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

    document.getElementById('browse-modal-title').innerText = title;
    renderBrowseLevel();
    document.getElementById('browse-modal').style.display = 'block';
}

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
            clearBtn.style.display = 'none';
            renderBrowseLevel();
            return;
        }
        clearBtn.style.display = 'block';
        container.innerHTML = '';

        const terms = q.split(/\s+/).filter(t => t);
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
function renderBrowseLevel() {
    const { currentBrowsePath, browserConfig } = AppStore.getState();
    const cbPath = currentBrowsePath || [];
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
    upBtn.disabled = cbPath.length === 0;
    if (!upBtn.disabled) {
        upBtn.style.background = 'var(--intent-neutral)';
        upBtn.onclick = () => {
            const p = [...(AppStore.getState().currentBrowsePath || [])];
            p.pop();
            AppStore.setState({ currentBrowsePath: p });
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
    pathText.innerText = '/' + cbPath.join('/');

    headerDiv.appendChild(upBtn);
    headerDiv.appendChild(pathText);
    container.appendChild(headerDiv);
    // Traverse to current level
    let current = currentFileTree;
    for (const p of cbPath) {
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

    const fragment = document.createDocumentFragment();
// Render items
    keys.forEach(key => {
        const item = current[key];
        if (item._isFile) {
            if (browserConfig && browserConfig.mode === 'folder') return;

            if (browserConfig && browserConfig.mode === 'file') {
                const card = document.createElement('div');
                card.className = 'file-card';
                card.style.cursor = 'pointer';
                card.style.padding = '8px 15px';
                card.innerHTML = `<span class="file-title" style="color: var(--intent-success);">📄 ${key}</span>`;
                card.onclick = () => {
                    if (browserConfig && browserConfig.callback) browserConfig.callback(item.fullPath);
                    closeBrowseModal();
                };
                fragment.appendChild(card);
            } else {
                createFileCard({
                    filename: item.fullPath,
                    displayName: key,
                    description: '',
                    isFS: true,
                    isSource: true
                }, fragment);
            }
        } else {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.cursor = 'pointer';

            card.style.padding = '12px 15px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.innerHTML = `<span class="folder-label">📁 ${key}</span>`;
            card.onclick = () => {
                const p = [...(AppStore.getState().currentBrowsePath || [])];
                p.push(key);
                AppStore.setState({ currentBrowsePath: p });
                renderBrowseLevel();
            };
            fragment.appendChild(card);
        }
    });
    container.appendChild(fragment);
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
export function openVirtualFile(filename, content) {
    currentModalFile = filename;
    currentModalIsFS = false;
    currentModalIsMemoryOnly = true;
    document.getElementById('modal-title').innerText = filename;
    const textArea = document.getElementById('modal-text');
    const preview = document.getElementById('modal-preview');
    const toggleBtn = document.getElementById('modal-toggle-btn');

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

    toggleBtn.style.display = 'block';
    isPreviewMode = false;
    preview.style.display = 'none';

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
window.openWorkspaceBrowser = openWorkspaceBrowser;
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

    window.inSetu.ui.Factory.createModal({
        id: 'quick-pack-modal-' + Date.now(),
        title: `Quick-Pack Select: ${targetDir}`,
        body: `<div style="display: flex; flex-direction: column; gap: 5px; max-height: 50vh; overflow-y: auto; padding-right: 10px;">${checkboxesHtml}</div>`,
        actions: [
            { label: '📦 Pack Selected', style: 'primary', onClick: (e, modal) => {
                const selectedArray = Array.from(window._qpSet);
                if (selectedArray.length === 0) {
                    alert("Please select at least one file.");
                    return true;
                }
                executeQuickPack(targetDir, false, selectedArray);
                delete window._qpSet; // Clean up transient state
                return false;
            }}
        ]
    });
}
export function openFsDropdown(anchorElement) {
    if (!window.inSetu.ui.Factory || !window.inSetu.ui.Factory.createDropdown) return;

    const gbPath = AppStore.getState().globalBrowsePath || [];
    const currentPath = gbPath.join('/');

    window.inSetu.ui.Factory.createDropdown({
        anchor: anchorElement,
        items: [
            { label: `Quick-Pack: Folder`, icon: '📦', onClick: () => executeQuickPack(currentPath, false) },
            { label: `Quick-Pack: Recursive`, icon: '🗂️', onClick: () => executeQuickPack(currentPath, true) },
            { divider: true },
            { label: `Quick-Pack: Select Files...`, icon: '☑️', onClick: () => openQuickPackModal(currentPath) }
        ]
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
    window.inSetu.ui.Factory.createModal({
        id: 'link-insert-modal',
        title: 'Insert Link',
        body: bodyHtml
    });
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

        container.innerHTML = '';
        if (data.results.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No files found matching contents.</span>';
            return;
        }

        data.results.forEach(item => {
            const name = item.path.split('/').pop();
            const row = document.createElement('div');
            row.className = 'file-card';
            row.style.cursor = 'pointer';
            row.style.padding = '8px 12px';
            row.style.display = 'flex';
            row.style.flexDirection = 'column';

            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: var(--text);">${name}</span>
                    <span style="font-size: 0.7rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px;">Score: ${item.score}</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${item.path}</span>
                ${item.snippet ? `<span style="font-size: 0.8rem; color: var(--text); margin-top: 4px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i>"...${item.snippet.replace(/</g, '&lt;')}"</i></span>` : ''}
            `;

            row.onclick = () => insertLinkToEditor(item.path, name);
            container.appendChild(row);
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

    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No markdown files found.</span>';
        return;
    }

    results.forEach(path => {
        const name = path.split('/').pop();
        const row = document.createElement('div');
        row.className = 'file-card';
        row.style.cursor = 'pointer';
        row.style.padding = '8px 12px';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';

        row.innerHTML = `
            <span style="font-weight: bold; color: var(--text);">${name}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${path}</span>
        `;

        row.onclick = () => insertLinkToEditor(path, name);
        container.appendChild(row);
    });
}

function insertLinkToEditor(path, name) {
    let finalPath = path;

    // Calculate intelligent relative path based on the file currently open in the modal
    if (currentModalFile) {
        const currentParts = currentModalFile.split('/');
        currentParts.pop(); // Remove filename to anchor at its directory
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

    const linkText = `[${name}](${finalPath})`;

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const textArea = document.getElementById('modal-text');

    // Inject into the active editor instance seamlessly
    if (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined') {
        const cm = mdeInstance.codemirror;
        cm.replaceSelection(linkText);
        cm.focus();
    } else {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const text = textArea.value;
        textArea.value = text.substring(0, start) + linkText + text.substring(end);
        textArea.selectionStart = textArea.selectionEnd = start + linkText.length;
        textArea.focus();
        textArea.dispatchEvent(new Event('input'));
        }

        window.inSetu.ui.Factory.closeModal('link-insert-modal');
}

// Expose new functions to the window so HTML element handlers can reach them
window.openLinkModal = openLinkModal;
window.switchLinkTab = switchLinkTab;
window.onLinkSearchInput = onLinkSearchInput;
window.executeDeepLinkSearch = executeDeepLinkSearch;
window.viewSourceFile = viewSourceFile;
