import { LitElement, html, css } from 'lit';
import { sharedStyles } from './shared_styles.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
import {
    executeWorkspaceMutation,
    setContextManifest,
    executeSystemCompile,
    fetchAndCopy,
    fetchAndDownloadState,
    normalizeAccentText,
    resolveEditorMode
} from './app.js';
import { AppStore } from './store.js';

export const FsStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            searchQuery: '',
            modals: {
                move: { open: false, currentFile: '', destPath: '', initialParts: [] },
                newFile: { open: false, basePath: '', fileName: '', content: '' },
                newFolder: { open: false, basePath: '', folderName: '', repoTitle: '', repoDomain: 'Workspaces', repoDesc: '', repoExts: '.py, .json, .md, .sh, .txt, .html, .css, .js' },
                linkInsert: { open: false, activeTab: 'filename', searchQuery: '', searchResults: [], deepSearchLoading: false },
                browser: { open: false, title: '', manifest: [], searchQuery: '' },
                quickPack: { open: false, targetDir: '', files: [], selectedFiles: new Set() }
            },
            setSearchQuery: (q) => set({ searchQuery: q }),
            setModal: (modalName, data) => set(state => ({
                modals: { ...state.modals, [modalName]: { ...state.modals[modalName], ...data } }
            }))
        })),
        { name: 'FsStore' }
    )
);
window.inSetu = window.inSetu || { stores: {} };
window.inSetu.stores.Fs = FsStore;

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
    const shouldBeReadOnly = !(currentModalIsFS || currentModalForceEdit);

    const textArea = document.getElementById('modal-text');
    const litEditor = document.getElementById('global-os-editor');

    if (isSupportedEditor && litEditor) {
        litEditor.value = currentModalFullText;
        litEditor.readOnly = shouldBeReadOnly;
    } else if (textArea) {
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
    const litEditor = document.getElementById('global-os-editor');
    const shouldBeReadOnly = !(isFS || forceAllowEdit);

    if (text.length > TRUNCATE_LIMIT) {
        isModalTruncated = true;
        const textToRender = text.substring(0, TRUNCATE_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR PERFORMANCE] ...';
        const kbSize = Math.round(text.length / 1024);
        document.getElementById('modal-truncation-msg').innerHTML = `⚠️ Only showing the first 200kb of <b>${kbSize}kb</b>.`;
        if (banner) banner.style.display = 'flex';

        if (isSupportedEditor && litEditor) {
            litEditor.value = textToRender;
            litEditor.readOnly = true; // Lock while truncated
        } else if (textArea) {
            textArea.value = textToRender;
            textArea.readOnly = true;
        }
        currentModalOriginalText = textToRender;
    } else {
        isModalTruncated = false;
        if (banner) banner.style.display = 'none';
        if (isSupportedEditor && litEditor) {
            litEditor.value = text;
            litEditor.readOnly = shouldBeReadOnly;
        } else if (textArea) {
            textArea.value = text;
            textArea.readOnly = shouldBeReadOnly;
        }
        currentModalOriginalText = text;
    }
}
export async function downloadFile(fetchUrl, fallbackFilename, fetchOptions = {}) {
    if (!fetchOptions.headers && window.inSetu?.api?._getHeaders) {
        fetchOptions.headers = window.inSetu.api._getHeaders(true);
    }
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
    const litEditor = document.getElementById('global-os-editor');

    if (isSupportedEditor && litEditor) {
        litEditor.value = "Loading...";
        litEditor.language = codeMode;
        litEditor.readOnly = true;
    } else if (textArea) {
        textArea.value = "Loading...";
        textArea.readOnly = true;
    }
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    if (tb) tb.style.display = 'none';
    const cm6Wrap = document.getElementById('modal-cm6-container');

    if (isSupportedEditor && cm6Wrap) {
        cm6Wrap.style.display = 'flex';
        textArea.style.display = 'none';
    } else {
        if (cm6Wrap) cm6Wrap.style.display = 'none';
        textArea.style.display = 'block';
    }

    try {
        const res = await fetch(`/download/${filename}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToModal(text, isSupportedEditor, isMarkdown, false);
    } catch (e) {
        const errText = "Error loading file content.";
        const litEditor = document.getElementById('global-os-editor');
        if (isSupportedEditor && litEditor) litEditor.value = errText;
        else if (textArea) textArea.value = errText;
        currentModalOriginalText = "";
    }
}
document.addEventListener('input', (e) => {
    if (e.target && (e.target.id === 'modal-text' || e.target.id === 'global-os-editor')) {
        if (currentModalIsFS) {
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) {
                if (e.target.value !== currentModalOriginalText) {
                    saveBtn.style.display = 'block';
                } else {
                    saveBtn.style.display = 'none';
                }
            }
        }
    }
});
function refreshActiveFileViews(oldPath, newPath = null) {
    updateManifestState(oldPath, newPath);

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
    let changed = false;
    const newManifest = { ...manifest };

    Object.keys(newManifest).forEach(key => {
        const obj = newManifest[key];
        if (obj.files) {
            const index = obj.files.indexOf(oldPath);
            if (index > -1) {
                changed = true;
                const newFiles = [...obj.files];
                newFiles.splice(index, 1);

                // SSOT Guardrail: We do NOT blindly inject newPath into the manifest.
                // The target configuration might ignore it (e.g., "archived" or ".tracker").
                // We optimistic-delete the old path to make the UI feel instant, 
                // then rely on a silent background fetch to let the Cartographer dictate truth.

                newManifest[key] = { ...obj, files: newFiles };
            }
        }
    });

    if (changed) {
        AppStore.setState({ manifest: newManifest });
    }

    // Silently pull the true Cartographer-validated manifest to heal new path additions
    setTimeout(async () => {
        try {
            const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
            if (mRes.ok) {
                AppStore.setState({ manifest: await mRes.json() });
                if (document.getElementById('st-files') && document.getElementById('st-files').classList.contains('active')) {
                    loadGlobalFS();
                }
            }
        } catch(e) {}
    }, 500); // 500ms delay ensures the async VFS queue has fully drained to disk

    if (FsStore.getState().modals.browser?.open) {
        const mState = FsStore.getState().modals.browser;
        const updatedManifest = [...mState.manifest];
        const index = updatedManifest.indexOf(oldPath);
        if (index > -1) {
            updatedManifest.splice(index, 1);
            // Same Cartographer constraint applies to the active browser modal
            FsStore.getState().setModal('browser', { manifest: updatedManifest });
        }
    }
}
async function saveModalFile(autoSave = false) {
    if (autoSave !== true) autoSave = false; // Event object trap defense

    const litEditor = document.getElementById('global-os-editor');
    const textArea = document.getElementById('modal-text');

    let content = '';
    const cm6Wrap = document.getElementById('modal-cm6-container');
    if (cm6Wrap && cm6Wrap.style.display !== 'none' && litEditor) {
        content = litEditor.value;
    } else if (textArea) {
        content = textArea.value;
    }

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
    await executeWorkspaceMutation('fs/save', {
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
    const parts = currentModalFile ? currentModalFile.split('/').filter(p => p) : [];
    parts.pop();
    // remove filename
    FsStore.getState().setModal('move', { open: true, currentFile: currentModalFile, destPath: currentModalFile, initialParts: parts });
}
async function renameModalFile() {
    const currentName = currentModalFile.split('/').pop();
    const newName = prompt("Enter new filename:", currentName);
    if (!newName || newName === currentName) return;

    const parts = currentModalFile.split('/');
    parts.pop();
    const destPath = parts.length > 0 ? parts.join('/') + '/' + newName : newName;

    await executeWorkspaceMutation('fs/move', {
        filepath: currentModalFile,
        dest_path: destPath
    }, {
        loadingText: 'Renaming...',
        onSuccess: () => {
            const oldPath = currentModalFile;
            document.getElementById('file-modal').style.display = 'none';
            refreshActiveFileViews(oldPath, destPath);
        }
    });
}

async function executeMove() {
    const { currentFile, destPath } = FsStore.getState().modals.move;
    if (!destPath || destPath === currentFile) return alert("Please enter a valid new destination path.");

    await executeWorkspaceMutation('fs/move', {
        filepath: currentFile,
        dest_path: destPath
    }, {
        loadingText: 'Moving...',
        onSuccess: () => {
            FsStore.getState().setModal('move', { open: false });
            document.getElementById('file-modal').style.display = 'none';
            refreshActiveFileViews(currentFile, destPath);
        }
    });
}
async function archiveModalFile() {
    if (!confirm("Are you sure you want to archive this file?\nIt will be moved to an 'archived/' subdirectory.")) return;
    await executeWorkspaceMutation('fs/archive', {
        filepath: currentModalFile
    }, {
        onSuccess: async (res) => {
            const data = await res.json();
            const oldPath = currentModalFile;
            document.getElementById('file-modal').style.display = 'none';
            refreshActiveFileViews(oldPath, data.new_path);
        }
    });
}
async function deleteModalFile() {
    if (!confirm("Are you sure you want to delete this file?\nThis cannot be undone!")) return;
    await executeWorkspaceMutation('fs/delete', {
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

    const { isSupported: isSupportedEditor } = resolveEditorMode(currentModalFile);
    const litEditor = document.getElementById('global-os-editor');
    const textArea = document.getElementById('modal-text');

    let text = (isSupportedEditor && litEditor) 
        ? litEditor.value 
        : (textArea ? textArea.value : '');

    // Clean Citations
    text = text.replace(/\[cite(?:[^\]]*)\]/gi, '');

    // Clean Combined Spans: [span_X](start_span) or [span_X](end_span)
    text = text.replace(/\[span_\d+\]\((?:start_span|end_span)\)/gi, '');
    // Clean Orphaned Spans
    text = text.replace(/\((?:start_span|end_span)\)/gi, '');
    text = text.replace(/\[span_\d+\]/gi, '');

    if (isSupportedEditor && litEditor) {
        litEditor.value = text;
    } else if (textArea) {
        textArea.value = text;
        textArea.dispatchEvent(new Event('input'));
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
    btn.innerText = 'Downloading...';
    try {
        if (currentModalIsMemoryOnly) {
            let text = '';
            const cm6Wrap = document.getElementById('modal-cm6-container');
            const litEditor = document.getElementById('global-os-editor');
            if (cm6Wrap && cm6Wrap.style.display !== 'none' && litEditor) {
                text = litEditor.value;
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
            let fetchUrl = currentModalIsFS ? `bridge/fetch?file=${encodeURIComponent(currentModalFile)}` : `/download/${currentModalFile}`;

            if (window.inSetu?.extensions?.Registry?.executeUIHook) {
                const overrideUrl = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', currentModalFile);
                if (overrideUrl) fetchUrl = overrideUrl;
            }

            if (fetchUrl.startsWith('/') || fetchUrl.startsWith('http')) {
                await downloadFile(fetchUrl, currentModalFile.split('/').pop());
            } else {
                const res = await window.inSetu.api.workspace(fetchUrl);
                if (!res.ok) throw new Error('Download failed from server.');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = currentModalFile.split('/').pop();
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }
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
        browseBtn.style.background = 'var(--intent-neutral)';
        browseBtn.style.margin = '0 5px 0 0';
        browseBtn.style.order = '99';
        browseBtn.innerText = '📁 Browse';
        browseBtn.slot = 'actions';
        browseBtn.onclick = (e) => { e.stopPropagation(); openBrowseModal(fileInfo.filename); };
        card.appendChild(browseBtn);
    }
    const actionsNode = document.createElement('insetu-file-actions');
    actionsNode.slot = 'actions';
    actionsNode.filepath = fileInfo.filename;
    actionsNode.repoDir = fileInfo.repoDir;
    actionsNode.isFS = fileInfo.isFS;
    card.appendChild(actionsNode);
    let dlFetchUrl = fileInfo.isSource ? `bridge/fetch?file=${encodeURIComponent(fileInfo.filename)}` : `/download/${fileInfo.filename}`;
    if (window.inSetu?.extensions?.Registry?.executeUIHook) {
        const overrideUrl = window.inSetu.extensions.Registry.executeUIHook('zone:file-fetch-url', fileInfo.filename);
        if (overrideUrl) dlFetchUrl = overrideUrl;
    }
    const safeName = fileInfo.isSource ? fileInfo.filename.split('/').pop() : fileInfo.filename;
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-sm';
    dlBtn.style.background = 'var(--intent-primary)';
    dlBtn.style.margin = '0';
    dlBtn.style.order = '100';
    dlBtn.innerText = '⬇️ Download';
    dlBtn.slot = 'actions';
    dlBtn.onclick = async (e) => {
        e.stopPropagation();
        const orig = dlBtn.innerText;
        dlBtn.innerText = 'Downloading...';
        try {
            let res;
            if (dlFetchUrl.startsWith('/') || dlFetchUrl.startsWith('http')) {
                res = await fetch(dlFetchUrl, { headers: window.inSetu.api._getHeaders(true) });
            } else {
                res = await window.inSetu.api.workspace(dlFetchUrl);
            }
            if (!res.ok) throw new Error("Failed to fetch");
            const text = await res.text();
            const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = safeName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            alert("Error downloading file: " + err.message);
        } finally {
            dlBtn.innerText = orig;
        }
    };
    card.appendChild(dlBtn);

    container.appendChild(card);
}
export const getGlobalManifest = () => Array.from(new Set(Object.values(AppStore.getState().manifest || {}).flatMap(obj => obj.files || [])));

export class InSetuVFSExplorer extends LitElement {
        static properties = {
                searchQuery: { type: String },
                manifestFiles: { type: Array },
                globalBrowsePath: { type: Array }
        };
        static styles = [sharedStyles, css`
                :host { display: flex; flex-direction: column; flex: 1; }
        `];

        constructor() {
                super();
                this.searchQuery = '';
                this.manifestFiles = [];
                this.globalBrowsePath = [];
        }
        _updateState(state) {
                const allFiles = new Set();
                Object.values(state.manifest || {}).forEach(obj => {
                        if (obj.files) obj.files.forEach(f => allFiles.add(f));
                });
                if (state.targetConfigs) {
                        state.targetConfigs.forEach(cfg => {
                                if (cfg.repo_dir && !Array.from(allFiles).some(f => f.startsWith(cfg.repo_dir + '/'))) {
                                        allFiles.add(cfg.repo_dir + '/.gitkeep');
                                }
                        });
                }
                this.manifestFiles = Array.from(allFiles);
                this.globalBrowsePath = state.globalBrowsePath || [];
        }

        connectedCallback() {
                super.connectedCallback();
                this._unsubApp = AppStore.subscribe((state) => {
                        this._updateState(state);
                });
                this._unsubFs = FsStore.subscribe((state) => {
                        this.searchQuery = state.searchQuery;
                });

                // Trigger initial read
                this._updateState(AppStore.getState());
                this.searchQuery = FsStore.getState().searchQuery || '';
        }

        disconnectedCallback() {
                super.disconnectedCallback();
                if (this._unsubApp) this._unsubApp();
                if (this._unsubFs) this._unsubFs();
        }
        _handlePathChange(e) {
                AppStore.setState({ globalBrowsePath: e.detail.path });
        }
        render() {
            if (this.manifestFiles.length === 0) {
                return html`<p style="padding: 15px; color: var(--text-muted);">No repositories configured.</p>`;
            }
            const q = this.searchQuery.trim();
            const currentPrefix = this.globalBrowsePath.length > 0 ? this.globalBrowsePath.join('/') + '/' : '';
            const availableFiles = currentPrefix ? this.manifestFiles.filter(f => f.startsWith(currentPrefix)) : this.manifestFiles;

            let contentUI;

            if (!q) {
                contentUI = html`
                    <div @card-clicked="${(e) => { if(e.detail.isSource && window.viewSourceFile) window.viewSourceFile(e.detail.filename, true); }}">
                        <insetu-file-tree  
                            basePath=""
                            .files=${this.manifestFiles}
                            .currentPath=${this.globalBrowsePath}
                            .hidePath=${true}
                            .actions=${[{ id: 'download', label: '⬇️ Download', style: 'primary', order: 100 }]}
                            @path-changed="${this._handlePathChange}"
                            @action-download="${(e) => fetchAndDownloadState(e.detail.filepath, e.detail.event.target)}">
                        </insetu-file-tree>
                    </div>
                `;
            } else {
                const matches = window.inSetu.utils.fuzzyFilterObjects(availableFiles, q, f => f.substring(currentPrefix.length));

                if (matches.length === 0) {
                    contentUI = html`<div style="padding: 15px; color: var(--text-muted);">No matching files found.</div>`;
                } else {
                    contentUI = html`
                        <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px;">
                            ${matches.map(filepath => {
                                const filename = filepath.split('/').pop();
                                return html`
                                    <insetu-card
                                        .filename=${filepath}
                                        .titleText=${filename}
                                        .descriptionText=${filepath}
                                        icon="📄"
                                        intentColor="var(--intent-success)"
                                        @card-clicked=${() => { if(window.viewSourceFile) window.viewSourceFile(filepath, true); }}>
                                        <insetu-file-actions slot="actions" .filepath=${filepath}></insetu-file-actions>
                                        <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0; color: white; border: none; cursor: pointer; order: 100;"
                                            @click=${(e) => {
                                                e.stopPropagation();
                                                fetchAndDownloadState(filepath, e.currentTarget);
                                            }}>⬇️ Download</button>
                                    </insetu-card>
                                `;
                            })}
                        </div>
                    `;
                }
            }
            return html`
                <div style="display: flex; flex-direction: column; flex: 1;">
                    <div class="sticky-header" style="flex-shrink: 0; padding: 0; display: flex; flex-direction: column; border-bottom: 1px solid var(--border); background: var(--bg);">
                        <div class="fuzzy-search-wrapper" style="margin: 0; border: none; border-radius: 0; background: transparent; border-bottom: ${this.globalBrowsePath.length > 0 ? '1px solid var(--border)' : 'none'};">
                            <input type="text" placeholder="🔍 Fuzzy search files..." .value=${this.searchQuery}
                                style="border: none; background: transparent; padding: 10px 12px; margin: 0; border-radius: 0; outline: none; box-shadow: none; width: 100%; box-sizing: border-box;"
                                @input=${(e) => {
                                    const val = e.target.value;
                                    window.inSetu.extensions.Registry.utils.debounce('vfsSearch', () => {
                                        window.inSetu.stores.Fs.getState().setSearchQuery(val);
                                    }, 200);
                                }}>
                            ${q ? html`<button class="fuzzy-search-clear" @click=${() => window.inSetu.stores.Fs.getState().setSearchQuery('')}>Clear</button>` : ''}
                        </div>
                        ${this.globalBrowsePath.length > 0 ? html`
                            <div style="display: flex; gap: 10px; padding: 10px 12px; align-items: center; background: var(--input-bg);">
                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => AppStore.setState({ globalBrowsePath: this.globalBrowsePath.slice(0, -1) })}>⬆️ Up</button>
                                <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.globalBrowsePath.join('/')}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="padding-top: 15px;">
                        ${contentUI}
                    </div>
                </div>
            `;
        }
}
customElements.define('insetu-vfs-explorer', InSetuVFSExplorer);
export class InSetuVFSExplorerActions extends LitElement {
    static styles = [sharedStyles];
    _openMenu(e) {
        if (window.openFsDropdown) window.openFsDropdown(e.target);
    }
    render() {
        return html`<button class="system-action-btn" @click=${this._openMenu}>☰</button>`;
    }
}
customElements.define('insetu-vfs-explorer-actions', InSetuVFSExplorerActions);

window.ExtensionRegistry.registerExtension('files', {
    name: "Virtual File System",
    version: "2.0.0",
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "files",
            label: "Files",
            order: 2,
            component: "insetu-vfs-explorer"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "edit",
            targetSub: "files",
            component: "insetu-vfs-explorer-actions",
            order: 2
        }
    ]
});
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
    const prefix = typeof overridePath === 'string' ? overridePath : (gbPath.length > 0 ? gbPath.join('/') + '/' : '');
    FsStore.getState().setModal('newFile', { open: true, basePath: prefix, fileName: '', content: '' });
}
async function saveNewFile() {
    const mState = FsStore.getState().modals.newFile;
    const basePath = mState.basePath;
    let fileName = mState.fileName.trim();
    let content = mState.content;

    if (!fileName) {
        alert("Filename is required.");
        return;
    }
    fileName = fileName.replace(/^\/+/, '');
    const filepath = basePath + fileName;

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        content = await window.inSetu.extensions.Registry.executeUIHook('zone:pre-save-new-file', { fileName, content, filepath }) || content;
    }
    await executeWorkspaceMutation('fs/save', {
        filepath,
        content
    }, {
        loadingText: 'Saving...',
        onSuccess: async () => {
            FsStore.getState().setModal('newFile', { open: false });

            // Surgically inject into the local manifest state using pristine reference copies
            const { manifest } = AppStore.getState();
            const updatedManifest = { ...manifest };
            const repoDir = filepath.split('/')[0];
            const defaultBucket = `${repoDir}_context.txt`;

            if (updatedManifest[defaultBucket]) {
                const bucketCopy = { ...updatedManifest[defaultBucket], files: [...updatedManifest[defaultBucket].files] };
                if (!bucketCopy.files.includes(filepath)) {
                    bucketCopy.files.push(filepath);
                }
                updatedManifest[defaultBucket] = bucketCopy;
            } else {
                updatedManifest[defaultBucket] = {
                    files: [filepath],
                    meta: { title: repoDir, domain: "Workspaces", desc: "Context payload." }
                };
            }
            AppStore.setState({ manifest: updatedManifest });

            if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', filepath);
            }
        }
});
}
function openNewFolderModal(overridePath = null) {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const isRoot = overridePath === null && gbPath.length === 0;
    const prefix = typeof overridePath === 'string' ? overridePath : (isRoot ? '' : gbPath.join('/') + '/');
    FsStore.getState().setModal('newFolder', { open: true, basePath: prefix, folderName: '', repoTitle: '', repoDomain: 'Workspaces', repoDesc: '', repoExts: '.py, .json, .md, .sh, .txt, .html, .css, .js' });
}

async function saveNewFolder() {
    const mState = FsStore.getState().modals.newFolder;
    const basePath = mState.basePath;
    let folderName = mState.folderName.trim();

    if (!folderName) {
        alert("Name is required.");
        return;
    }

    folderName = folderName.replace(/^\/+|\/+$/g, '');
    let isNewRepo = false;
    let payloadExt = {};

    if (basePath === '') {
        isNewRepo = true;
        payloadExt = {
            repo_title: mState.repoTitle.trim(),
            repo_domain: mState.repoDomain.trim(),
            repo_desc: mState.repoDesc.trim(),
            repo_exts: mState.repoExts.trim()
        };
    }
    const filepath = basePath + folderName + "/.gitkeep";

    await executeWorkspaceMutation('fs/save', {
        filepath,
        content: "",
        is_new_repo: isNewRepo,
        repo_dir: folderName,
        ...payloadExt
    }, {
        loadingText: "Creating...",
        onSuccess: async () => {
            if (isNewRepo) {
                const rRes = await window.inSetu.api.workspace('repos?t=' + Date.now());
                if (rRes.ok) {
                    const d = await rRes.json();
                    AppStore.setState({ allRepos: d.repos, targetConfigs: d.targets || [] });
                }
            }

            const { manifest } = AppStore.getState();
            const updatedManifest = { ...manifest };
            const repoDir = filepath.split('/')[0];
            const defaultBucket = `${repoDir}_context.txt`;

            if (updatedManifest[defaultBucket]) {
                const bucketCopy = { ...updatedManifest[defaultBucket], files: [...updatedManifest[defaultBucket].files] };
                if (!bucketCopy.files.includes(filepath)) {
                    bucketCopy.files.push(filepath);
                }
                updatedManifest[defaultBucket] = bucketCopy;
            } else {
                updatedManifest[defaultBucket] = {
                    files: [filepath],
                    meta: { title: repoDir, domain: "Workspaces", desc: "Context payload." }
                };
            }
            AppStore.setState({ manifest: updatedManifest });
            FsStore.getState().setModal('newFolder', { open: false });

            if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', filepath);
            }
        }
    });
}
export function getEditorContent() {
    const litEditor = document.getElementById('global-os-editor');
    const textArea = document.getElementById('modal-text');
    const cm6Wrap = document.getElementById('modal-cm6-container');
    if (cm6Wrap && window.getComputedStyle(cm6Wrap).display !== 'none' && litEditor) {
        return litEditor.value;
    }
    return textArea ? textArea.value : '';
}

export function setEditorContent(text) {
    const litEditor = document.getElementById('global-os-editor');
    const textArea = document.getElementById('modal-text');
    const cm6Wrap = document.getElementById('modal-cm6-container');
    if (cm6Wrap && window.getComputedStyle(cm6Wrap).display !== 'none' && litEditor) {
        const cursor = litEditor.getCursor();
        litEditor.value = text;
        litEditor.setCursor(cursor);
    } else if (textArea) {
        textArea.value = text;
    }
}

export function insertTextAtCursor(textToInsert) {
    const textArea = document.getElementById('modal-text');
    const cm6Wrap = document.getElementById('modal-cm6-container');
    const litEditor = document.getElementById('global-os-editor');
    const isCM6 = (cm6Wrap && window.getComputedStyle(cm6Wrap).display !== 'none' && litEditor && litEditor._view);

    if (isCM6) {
        const view = litEditor._view;
        view.dispatch(view.state.update({
            changes: view.state.selection.ranges.map(r => ({ from: r.from, to: r.to, insert: textToInsert })),
            scrollIntoView: true
        }));
        view.focus();
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
    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(filepath);
    const litEditor = document.getElementById('global-os-editor');

    if (isSupportedEditor && litEditor) {
        litEditor.value = "Loading...";
        litEditor.language = codeMode;
        litEditor.readOnly = !isFS;
    } else if (textArea) {
        textArea.value = "Loading...";
        textArea.readOnly = !isFS;
    }
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    const dlBtn = document.getElementById('modal-dl-btn');
    if (dlBtn && !currentModalIsMemoryOnly) {
        dlBtn.dataset.filename = filepath.split('/').pop();

        let dlFetchUrl = isFS ? `bridge/fetch?file=${encodeURIComponent(filepath)}` : `/download/${filepath}`;
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
                    { label: 'Rename', icon: '✏️', onClick: window.renameModalFile },
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
    const cm6Wrap = document.getElementById('modal-cm6-container');

    if (isSupportedEditor && cm6Wrap) {
        cm6Wrap.style.display = 'flex';
        textArea.style.display = 'none';
    } else {
        if (cm6Wrap) cm6Wrap.style.display = 'none';
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
        const litEditor = document.getElementById('global-os-editor');
        if (isSupportedEditor && litEditor) litEditor.value = errText;
        else if (textArea) textArea.value = errText;
    }
}
function closeBrowseModal() {
    FsStore.getState().setModal('browser', { open: false });
    AppStore.setState({ browserConfig: { mode: 'view', callback: null } });
}
export function openWorkspaceBrowser(options = {}) {
    const {
        mode = 'view',
        title = 'Browse Workspace',
        files = null,
        callback = null,
        autoDrilldown = false
    } = options;
    AppStore.setState({ browserConfig: { mode, callback } });

    let targetManifest = files || getGlobalManifest();

    let cbPath = [];
    if (autoDrilldown) {
        let current = buildFileTree(targetManifest);
        while (true) {
            const keys = Object.keys(current).filter(k => k !== '_isFile');
            if (keys.length === 1 && !current[keys[0]]._isFile) {
                cbPath.push(keys[0]);
                current = current[keys[0]];
                continue;
            }
            break;
        }
    }
    AppStore.setState({ currentBrowsePath: cbPath });
    FsStore.getState().setModal('browser', { open: true, title, manifest: targetManifest, searchQuery: '' });
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
    const cm6Wrap = document.getElementById('modal-cm6-container');
    const litEditor = document.getElementById('global-os-editor');
    const isCM6 = (cm6Wrap && window.getComputedStyle(cm6Wrap).display !== 'none' && litEditor);
    const currentVal = isCM6 ? litEditor.value : (textArea ? textArea.value : '');

    if (currentModalIsFS && currentVal !== currentModalOriginalText) {
        if (!confirm("You have unsaved changes. Are you sure you want to close this file?")) {
            return;
        }
    }

    document.getElementById('file-modal').style.display = 'none';
    // Reset state
    currentModalOriginalText = '';
    if (textArea) textArea.value = '';
    if (isCM6 && litEditor) litEditor.value = '';
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
    const litEditor = document.getElementById('global-os-editor');
    if (litEditor) {
        litEditor.language = "markdown";
    }

    currentModalForceEdit = true;
    injectTextToModal(content, true, true, false, true);
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('file-modal').style.display = 'block';
    closeBrowseModal();
    const tb = document.getElementById('modal-action-toolbar');
    if (tb) tb.style.display = 'none';

    const cm6Wrap = document.getElementById('modal-cm6-container');
    if (cm6Wrap) {
        cm6Wrap.style.display = 'flex';
        textArea.style.display = 'none';
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
window.renameModalFile = renameModalFile;
window.archiveModalFile = archiveModalFile;
window.deleteModalFile = deleteModalFile;
window.cleanModalFile = cleanModalFile;
window.downloadFromModal = downloadFromModal;
window.openFsDropdown = openFsDropdown;
window.closeBrowseModal = closeBrowseModal;
window.openFolderBrowser = openFolderBrowser;
window.confirmFolderSelection = confirmFolderSelection;
window.openWorkspaceBrowser = openWorkspaceBrowser;
window.openBrowseModal = openBrowseModal;
window.viewAndCopy = viewAndCopy;
export async function executeQuickPack(targetDir, recursive = false, specificFiles = null) {
    setGlobalStatus("⏳ Generating Ad-Hoc Context...", null);
    try {
        const res = await window.inSetu.api.workspace('gather/quick-pack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_dir: targetDir,
                recursive: recursive,
                specific_files: specificFiles
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to queue quick-pack.");

        let filename = data.filename;
        if (res.status === 202) {
            const jobId = data.job_id;
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const pollRes = await window.inSetu.api.system(`jobs/${jobId}`);
                if (!pollRes.ok) throw new Error("Quick-Pack job failed");
                const pollData = await pollRes.json();

                if (pollData.status === 'processing' || pollData.status === 'pending') {
                    setGlobalStatus(`⏳ ${pollData.message || "Generating..."}`, null);
                } else if (pollData.status === 'completed') {
                    filename = pollData.artifact?.filename;
                    break;
                } else if (pollData.status === 'failed') {
                    throw new Error(pollData.message);
                }
            }
        }

        // Open the physical file that was just written to disk natively
        viewAndCopy(filename);
        // Silently re-hydrate the manifest state to reactively update the UI without hitting the heavy `/submit` compiler
        const mRes = await window.inSetu.api.workspace(`manifest?t=${Date.now()}`);
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
    const fullTree = buildFileTree(getGlobalManifest());
    let current = fullTree;
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

    const selectedFiles = new Set(fileKeys.map(k => current[k].fullPath));
    FsStore.getState().setModal('quickPack', { open: true, targetDir, files: fileKeys.map(k => ({ key: k, path: current[k].fullPath })), selectedFiles });
}

window.executeQuickPackSelected = function() {
    const { targetDir, selectedFiles } = FsStore.getState().modals.quickPack;
    const selectedArray = Array.from(selectedFiles);
    if (selectedArray.length === 0) {
        alert("Please select at least one file.");
        return;
    }
    executeQuickPack(targetDir, false, selectedArray);
    FsStore.getState().setModal('quickPack', { open: false });
};
export function openFsDropdown(anchorElement, options = {}) {
    if (!window.inSetu.ui.Factory || !window.inSetu.ui.Factory.createDropdown) return;

    const isPrompts = options.isPrompts;
    const activePathList = isPrompts ? (AppStore.getState().currentPromptsPath || []) : (AppStore.getState().globalBrowsePath || []);
    const currentPath = activePathList.join('/');

    const items = [];

    if (!isPrompts && activePathList.length === 0) {
        items.push({ label: 'New Repository', icon: '📦', onClick: () => window.openNewFolderModal() });
    } else {
        const prefix = isPrompts 
            ? (activePathList.length > 0 ? ".insetu/prompts/" + currentPath + "/" : ".insetu/prompts/") 
            : (activePathList.length > 0 ? currentPath + '/' : '');

        items.push({ label: 'New Folder', icon: '📁', onClick: () => window.openNewFolderModal(prefix) });
        items.push({ label: isPrompts ? 'New Prompt' : 'New File', icon: '📄', onClick: () => window.openNewFileModal(prefix) });
        if (!isPrompts) {
            items.push({ divider: true });
            items.push({ label: `Quick-Pack: Folder`, icon: '📦', onClick: () => executeQuickPack(currentPath, false) });
            items.push({ label: `Quick-Pack: Recursive`, icon: '🗂️', onClick: () => executeQuickPack(currentPath, true) });
            items.push({ divider: true });
            items.push({ label: `Quick-Pack: Select Files...`, icon: '☑️', onClick: () => openQuickPackModal(currentPath) });
        }
    }

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
        window.inSetu.extensions.Registry.executeUIHook('zone:fs-dropdown-menu', { currentPath, isPrompts, menuItems: items });
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
        const res = await window.inSetu.api.workspace('gather/quick-pack/clear', { method: 'POST' });
        if (!res.ok) throw new Error("Failed to clear quick-packs.");

        const mRes = await window.inSetu.api.workspace(`manifest?t=${Date.now()}`);
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
export function openLinkModal(initialQuery = '', initialTab = 'filename') {

    FsStore.getState().setModal('linkInsert', { 
        open: true, 
        activeTab: initialTab, 
        searchQuery: initialQuery, 
        searchResults: [],
        deepSearchLoading: false 
    });

    if (initialQuery) {
        if (initialTab === 'deep') executeDeepLinkSearch(initialQuery);
        else executeLinkSearch(initialQuery);
    }
}

export function switchLinkTab(tab) {
    FsStore.getState().setModal('linkInsert', { activeTab: tab, searchResults: [] });
    const { searchQuery } = FsStore.getState().modals.linkInsert;
    if (tab === 'filename' && searchQuery) executeLinkSearch(searchQuery);
}

export function onLinkSearchInput(val) {
    FsStore.getState().setModal('linkInsert', { searchQuery: val });
    const { activeTab } = FsStore.getState().modals.linkInsert;
    if (activeTab !== 'filename') return;

    window.ExtensionRegistry.utils.debounce('linkSearch', () => {
        executeLinkSearch(val);
    }, 300);
}
export async function executeDeepLinkSearch(overrideQuery = null) {
    const query = (overrideQuery || FsStore.getState().modals.linkInsert.searchQuery).toLowerCase().trim();
    if (!query) {
        FsStore.getState().setModal('linkInsert', { searchResults: [] });
        return;
    }

    FsStore.getState().setModal('linkInsert', { deepSearchLoading: true, searchResults: [] });
    try {
        const res = await window.inSetu.api.workspace('fs/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query })
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (res.status === 202) {
            const jobId = data.job_id;
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const pollRes = await window.inSetu.api.system(`jobs/${jobId}`);
                if (!pollRes.ok) throw new Error("Search job failed");
                const pollData = await pollRes.json();
                if (pollData.status === 'completed') {
                    FsStore.getState().setModal('linkInsert', { searchResults: pollData.artifact?.results || [] });
                    break;
                } else if (pollData.status === 'failed') {
                    throw new Error(pollData.message);
                }
            }
        } else {
            FsStore.getState().setModal('linkInsert', { searchResults: data.results || [] });
        }
    } catch (e) {
        console.error("Deep search error:", e);
    } finally {
        FsStore.getState().setModal('linkInsert', { deepSearchLoading: false });
    }
}
function executeLinkSearch(query) {
    const q = query.trim();
    if (!q) {
        FsStore.getState().setModal('linkInsert', { searchResults: [] });
        return;
    }
    const mdFiles = getGlobalManifest().filter(f => f.toLowerCase().endsWith('.md'));
    const results = window.inSetu.utils.fuzzyFilterObjects(mdFiles, q).slice(0, 50).map(path => ({ path }));
    FsStore.getState().setModal('linkInsert', { searchResults: results });
}

export function insertLinkToEditor(path, name) {
    let finalPath = path;
    if (currentModalFile) {
        const { targetConfigs } = window.inSetu.stores.App.getState();
        const getRepo = (p) => {
            const match = targetConfigs.find(c => p.startsWith(c.repo_dir + '/'));
            return match ? match.repo_dir : p.split('/')[0];
        };

        const currentRepo = getRepo(currentModalFile);
        const targetRepo = getRepo(path);

        if (currentRepo !== targetRepo) {
            const targetPathWithinRepo = path.substring(targetRepo.length + 1);
            finalPath = `${targetRepo}::${targetPathWithinRepo}`;
        } else {
            const currentParts = currentModalFile.split('/');
            currentParts.pop();
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

    FsStore.getState().setModal('linkInsert', { open: false });
}

// Expose new functions to the window so HTML element handlers can reach them
window.openLinkModal = openLinkModal;
window.switchLinkTab = switchLinkTab;
window.onLinkSearchInput = onLinkSearchInput;
window.executeDeepLinkSearch = executeDeepLinkSearch;
window.viewSourceFile = viewSourceFile;
window.getEditorContent = getEditorContent;
window.setEditorContent = setEditorContent;
window.insertTextAtCursor = insertTextAtCursor;
export class InSetuVFSModals extends LitElement {
    static properties = {
        modals: { type: Object },
        browserConfig: { type: Object },
        currentBrowsePath: { type: Array }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.modals = {};
        this.browserConfig = {};
        this.currentBrowsePath = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this._unsub = FsStore.subscribe(state => {
            this.modals = state.modals;
        });
        this._unsubApp = AppStore.subscribe(state => {
            this.browserConfig = state.browserConfig;
            this.currentBrowsePath = state.currentBrowsePath;
        });
        this.modals = FsStore.getState().modals;
        this.browserConfig = AppStore.getState().browserConfig;
        this.currentBrowsePath = AppStore.getState().currentBrowsePath;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
        if (this._unsubApp) this._unsubApp();
    }

    render() {
        const m = this.modals;
        if (!m) return '';

        return html`
            <insetu-modal ?open=${m.move?.open} titleText="Move File to..." @modal-closed=${() => FsStore.getState().setModal('move', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden; flex: 1;">
                    <input type="text" .value=${m.move?.destPath || ''} @input=${e => FsStore.getState().setModal('move', { destPath: e.target.value })} style="margin-bottom: 15px; font-family: monospace; min-width: 0; box-sizing: border-box;">
                    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0 10px;">
                        <insetu-folder-browser .files=${getGlobalManifest()} .currentPath=${m.move?.initialParts || []} @path-changed=${e => {
                            const filename = m.move?.currentFile ? m.move.currentFile.split('/').pop() : '';
                            FsStore.getState().setModal('move', { destPath: e.detail.path ? (e.detail.path + '/' + filename) : filename });
                        }}></insetu-folder-browser>
                    </div>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${executeMove}>🚚 Move File</button>
                </div>
            </insetu-modal>

            <insetu-modal ?open=${m.newFile?.open} titleText="Create New Workspace File" @modal-closed=${() => FsStore.getState().setModal('newFile', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1;">
                    <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text); word-break: break-all;">Path: <span style="font-family: monospace; color: var(--intent-highlight);">${m.newFile?.basePath}</span></label>
                    <input type="text" placeholder="Filename (e.g. my-prompt.md)..." .value=${m.newFile?.fileName || ''} @input=${e => { FsStore.getState().setModal('newFile', { fileName: e.target.value }); if(window.checkFileExtension) window.checkFileExtension(e.target.value); }} style="margin-bottom: 5px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box; min-width: 0;">
                    <div id="new-file-ext-warning" style="display: none; color: var(--intent-warning); font-size: 0.8rem; font-weight: bold; margin-bottom: 15px;"></div>
                    ${window.inSetu.extensions.Registry?.executeUIHook('zone:new-file-options-lit', null) || ''}

                    <textarea style="flex: 1; margin-bottom: 0; font-size: 13px; margin-top: 0; width: 100%; box-sizing: border-box; min-width: 0; min-height: 200px; resize: vertical;" placeholder="Enter file content here..." .value=${m.newFile?.content || ''} @input=${e => FsStore.getState().setModal('newFile', { content: e.target.value })}></textarea>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${saveNewFile}>💾 Create & Save File</button>
                </div>
            </insetu-modal>

            <insetu-modal ?open=${m.newFolder?.open} titleText=${m.newFolder?.basePath === '' ? 'Create New Repository' : 'Create New Folder'} @modal-closed=${() => FsStore.getState().setModal('newFolder', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1;">
                    <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text); word-break: break-all;">Path: <span style="font-family: monospace; color: var(--intent-highlight);">${m.newFolder?.basePath}</span></label>
                    <input type="text" placeholder="Directory name..." .value=${m.newFolder?.folderName || ''} @input=${e => FsStore.getState().setModal('newFolder', { folderName: e.target.value })} style="margin-bottom: 15px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box; min-width: 0;">

                    ${m.newFolder?.basePath === '' ? html`
                        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 15px; background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                            <h4 style="margin: 0; margin-bottom: 5px; color: var(--intent-primary);">Repository Configuration</h4>
                            <div>
                                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Repository Title</label>
                                <input type="text" placeholder="e.g., Core API" .value=${m.newFolder.repoTitle} @input=${e => FsStore.getState().setModal('newFolder', { repoTitle: e.target.value })} style="padding: 8px; margin: 0; width: 100%; box-sizing: border-box; min-width: 0;">
                            </div>
                            <div>
                                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Domain Category</label>
                                <input type="text" placeholder="e.g., Workspaces" .value=${m.newFolder.repoDomain} @input=${e => FsStore.getState().setModal('newFolder', { repoDomain: e.target.value })} style="padding: 8px; margin: 0; width: 100%; box-sizing: border-box; min-width: 0;">
                            </div>
                            <div>
                                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Description</label>
                                <input type="text" placeholder="Short summary..." .value=${m.newFolder.repoDesc} @input=${e => FsStore.getState().setModal('newFolder', { repoDesc: e.target.value })} style="padding: 8px; margin: 0; width: 100%; box-sizing: border-box; min-width: 0;">
                            </div>
                            <div>
                                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Tracked Extensions</label>
                                <input type="text" placeholder="e.g., .py, .json, .md" .value=${m.newFolder.repoExts} @input=${e => FsStore.getState().setModal('newFolder', { repoExts: e.target.value })} style="padding: 8px; margin: 0; width: 100%; font-family: monospace; box-sizing: border-box; min-width: 0;">
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${saveNewFolder}>
                        ${m.newFolder?.basePath === '' ? '📦 Initialize Repository' : '📁 Create Folder'}
                    </button>
                </div>
            </insetu-modal>

            <insetu-modal ?open=${m.linkInsert?.open} titleText="Insert Link" @modal-closed=${() => FsStore.getState().setModal('linkInsert', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; height: 100%;">
                    <div style="height: 40px; flex-shrink: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border);">
                        <div class="sub-tabs">
                            <div class="sub-tab ${m.linkInsert?.activeTab === 'filename' ? 'active' : ''}" @click=${() => window.switchLinkTab('filename')}>Filename</div>
                            <div class="sub-tab ${m.linkInsert?.activeTab === 'deep' ? 'active' : ''}" @click=${() => window.switchLinkTab('deep')}>Deep Search</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-shrink: 0;">
                        <input type="text" placeholder="Search files..." style="flex: 1; min-width: 0; padding: 8px; margin: 0;"
                            .value=${m.linkInsert?.searchQuery || ''}
                            @input=${e => window.onLinkSearchInput(e.target.value)}>
                        ${m.linkInsert?.activeTab === 'deep' ? html`
                            <button @click=${() => window.executeDeepLinkSearch()} class="btn-sm" style="background: var(--intent-highlight); margin: 0;" ?disabled=${m.linkInsert?.deepSearchLoading}>
                                ${m.linkInsert?.deepSearchLoading ? '⏳...' : '🔍 Search'}
                            </button>
                        ` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; overflow-y: auto; flex: 1; gap: 5px; min-height: 200px;">
                        ${m.linkInsert?.deepSearchLoading ? html`<div class="spinner" style="display:block; margin-top:0;">Searching file contents across workspace...</div>` : ''}

                        ${(!m.linkInsert?.deepSearchLoading && (!m.linkInsert?.searchResults || m.linkInsert.searchResults.length === 0)) ? html`
                            <span style="color:var(--text-muted); font-style:italic;">
                                ${(!m.linkInsert?.searchQuery) ? 'Type to search...' : 'No files found.'}
                            </span>
                        ` : ''}

                        ${m.linkInsert?.searchResults?.map(item => {
                            const name = item.path.split('/').pop();
                            return html`
                                <insetu-card
                                    .filename=${item.path}
                                    .titleText=${name}
                                    .detailText=${item.path}
                                    .descriptionText=${item.snippet ? '"...' + item.snippet.replace(/</g, '&lt;') + '"' : ''}
                                    icon="📄"
                                    intentColor="var(--intent-primary)"
                                    @card-clicked=${() => window.insertLinkToEditor(item.path, name)}>
                                    ${item.score !== undefined ? html`
                                        <span slot="header-tags" style="font-size: 0.7rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px;">
                                            Score: ${item.score}
                                        </span>
                                    ` : ''}
                                </insetu-card>
                            `;
                        })}
                    </div>
                </div>
            </insetu-modal>
<insetu-modal ?open=${m.browser?.open} titleText=${m.browser?.title || 'Browse'} maxWidth="100vw" @modal-closed=${window.closeBrowseModal}>
                <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden; flex: 1;">
                    <div class="sticky-header" style="padding: 0; display: flex; flex-direction: column; border-bottom: 1px solid var(--border); background: var(--bg);">
                        ${this.browserConfig?.mode !== 'folder' ? html`
                            <div class="fuzzy-search-wrapper" style="margin: 0; border: none; border-radius: 0; background: transparent; border-bottom: ${this.currentBrowsePath?.length > 0 ? '1px solid var(--border)' : 'none'};">
                                <input type="text" placeholder="Fuzzy find files..." style="flex: 1; min-width: 0; border: none; background: transparent; padding: 10px 12px; margin: 0; border-radius: 0; outline: none; box-shadow: none; width: 100%; box-sizing: border-box;"
                                    .value=${m.browser?.searchQuery || ''}
                                    @input=${e => FsStore.getState().setModal('browser', { searchQuery: e.target.value })}>
                                ${m.browser?.searchQuery ? html`<button class="fuzzy-search-clear" @click=${() => FsStore.getState().setModal('browser', { searchQuery: '' })}>Clear</button>` : ''}
                            </div>
                        ` : ''}
                        ${this.currentBrowsePath?.length > 0 ? html`
                            <div style="display: flex; gap: 10px; padding: 10px 12px; align-items: center; background: var(--input-bg);">
                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => AppStore.setState({ currentBrowsePath: this.currentBrowsePath.slice(0, -1) })}>⬆️ Up</button>
                                <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentBrowsePath.join('/')}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; flex: 1; overflow-y: auto; padding-top: 15px;">
                        ${m.browser?.searchQuery ? html`
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${window.inSetu.utils.fuzzyFilterObjects(m.browser.manifest, m.browser.searchQuery).slice(0, 50).map(filepath => {
                                    const filename = filepath.split('/').pop();
                                    return html`
                                        <insetu-card
                                            .filename=${filepath}
                                            .titleText=${filename}
                                            .descriptionText=${filepath}
                                            icon="📄"
                                            intentColor="var(--intent-primary)"
                                            @card-clicked=${() => window._handleBrowserCardClick({ filename: filepath, isSource: true })}>
                                        </insetu-card>
                                    `;
                                })}
                                ${window.inSetu.utils.fuzzyFilterObjects(m.browser.manifest, m.browser.searchQuery).length === 0 ? html`<span style="color:var(--text-muted); font-style:italic;">No files found.</span>` : ''}
                            </div>
                        ` : html`
                            <insetu-file-tree 
                                basePath=""
                                .files=${m.browser?.manifest || []}
                                .currentPath=${this.currentBrowsePath || []}
                                .hidePath=${true}
                                .hideFiles=${this.browserConfig?.mode === 'folder'}
                                @path-changed=${e => AppStore.setState({ currentBrowsePath: e.detail.path })}
                                @card-clicked=${e => window._handleBrowserCardClick(e.detail)}>
                            </insetu-file-tree>
                        `}
                    </div>
                </div>
                ${this.browserConfig?.mode === 'folder' ? html`
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-success); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${window.confirmFolderSelection}>✅ Select This Folder</button>
                </div>
                ` : ''}
            </insetu-modal>

            <insetu-modal ?open=${m.quickPack?.open} titleText="Quick-Pack Select: ${m.quickPack?.targetDir}" @modal-closed=${() => FsStore.getState().setModal('quickPack', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 5px; max-height: 50vh; overflow-y: auto; padding-right: 10px;">
                    ${m.quickPack?.files?.map(f => html`
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border);">
                            <input type="checkbox" .value=${f.path} style="cursor: pointer; transform: scale(1.2);"
                                .checked=${m.quickPack.selectedFiles.has(f.path)}
                                @change=${(e) => {
                                    const newSet = new Set(m.quickPack.selectedFiles);
                                    if (e.target.checked) newSet.add(f.path);
                                    else newSet.delete(f.path);
                                    FsStore.getState().setModal('quickPack', { selectedFiles: newSet });
                                }}>
                            <label style="cursor: pointer; word-break: break-all; flex: 1; font-family: monospace; font-size: 0.9rem; color: var(--text);"
                                @click=${() => {
                                    const newSet = new Set(m.quickPack.selectedFiles);
                                    if (newSet.has(f.path)) newSet.delete(f.path);
                                    else newSet.add(f.path);
                                    FsStore.getState().setModal('quickPack', { selectedFiles: newSet });
                                }}>${f.key}</label>
                        </div>
                    `)}
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${window.executeQuickPackSelected}>📦 Pack Selected</button>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-vfs-modals', InSetuVFSModals);

document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(document.createElement('insetu-vfs-modals'));
});
