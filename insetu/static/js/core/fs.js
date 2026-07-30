import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../../vendor/sutram/shared_styles.js';
import { InSetuElement, createExtensionStore } from './sdk.js';
import { resolveEditorMode } from './components/ui_editor.js';
import { AppStore } from './store.js';
import { buildFileTree } from '../../vendor/sutram/utils.js';
export function bindDownloadDrag(e, filename, fetchUrl) {
    const absoluteUrl = window.location.origin + fetchUrl;
    const safeName = filename.split('/').pop();
    const ext = safeName.split('.').pop().toLowerCase();

    let mime = 'application/octet-stream';
    if (ext === 'md') mime = 'text/markdown';
    else if (ext === 'txt') mime = 'text/plain';
    else if (ext === 'json') mime = 'application/json';
    else if (ext === 'py') mime = 'text/x-python';
    else if (ext === 'js') mime = 'text/javascript';

    const ghost = document.createElement('div');
    ghost.style.cssText = 'position: absolute; top: -1000px; left: -1000px; background: var(--pane-bg); color: var(--text); border: 1px solid var(--btn); padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; z-index: -1; box-shadow: 0 4px 10px rgba(0,0,0,0.3);';
    ghost.innerText = `📄 ${safeName}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 15, 15);

    setTimeout(() => ghost.remove(), 50);

    e.dataTransfer.setData('DownloadURL', `${mime}:${safeName}:${absoluteUrl}`);
    e.dataTransfer.setData('text/uri-list', absoluteUrl);
    e.dataTransfer.setData('text/plain', absoluteUrl);

    e.dataTransfer.effectAllowed = 'copy';
}

document.addEventListener('dragstart', (e) => {
    const dragEl = e.target.closest('.ui-draggable-export');
    if (dragEl) {
        const filename = dragEl.dataset.filename;
        let fetchUrl = dragEl.dataset.fetchUrl;
        // Resolve dynamic extension overrides natively
        const overrideUrl = window.inSetu.events.emitHook('zone:file-fetch-url', filename);
        if (overrideUrl) fetchUrl = overrideUrl;

        if (filename && fetchUrl) {
            bindDownloadDrag(e, filename, fetchUrl);
        }
    }
});
export const FsStore = createExtensionStore('Fs', {
    searchQuery: '',
    fileModal: {
        open: false,
        filename: '',
        content: '',
        originalContent: '',
        fullText: '',
        isTruncated: false,
        isFS: false,
        forceEdit: false,
        isMemoryOnly: false,
        isMarkdown: false,
        isSupportedEditor: false,
        ext: '',
        codeMode: ''
    },
    modals: {
        move: { open: false, currentFile: '', destPath: '', initialParts: [] },
        newFile: { open: false, basePath: '', fileName: '', content: '' },
        newFolder: { open: false, basePath: '', folderName: '', repoTitle: '', repoDomain: 'Workspaces', repoDesc: '', repoExts: '.py, .json, .md, .sh, .txt, .html, .css, .js' },
        linkInsert: { open: false, activeTab: 'filename', searchQuery: '', searchResults: [], deepSearchLoading: false },
        browser: { open: false, title: '', manifest: [], searchQuery: '' }
    },
    setSearchQuery: (q) => FsStore.setState({ searchQuery: q }),
    setModal: (modalName, data) => FsStore.setState(state => ({
        modals: { ...state.modals, [modalName]: { ...state.modals[modalName], ...data } }
    }))
});
window.inSetu = window.inSetu || {};
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.stores.Fs = FsStore;

function loadFullModalText() {
    const state = FsStore.getState().fileModal;
    FsStore.setState({ fileModal: { ...state, content: state.fullText, originalContent: state.fullText, isTruncated: false } });
};

function injectTextToModal(text, isSupportedEditor, isMarkdown, isFS, forceAllowEdit = false) {
    const TRUNCATE_LIMIT = 200000;
    let content = text;
    let isTruncated = false;

    if (text.length > TRUNCATE_LIMIT) {
        isTruncated = true;
        content = text.substring(0, TRUNCATE_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR PERFORMANCE] ...';
    }

    FsStore.setState({ fileModal: {
        ...FsStore.getState().fileModal,
        content,
        originalContent: content,
        fullText: text,
        isTruncated,
        forceEdit: forceAllowEdit
    }});
}
export async function fetchAndCopy(filePath, explicitUrl = null) {
    try {
        let res;
        if (explicitUrl) {
            res = await fetch(explicitUrl, { headers: window.inSetu.api._getHeaders(true) });
        } else {
            const overrideUrl = window.inSetu.events.emitHook('zone:file-fetch-url', filePath);
            if (overrideUrl) res = await fetch(overrideUrl);

            if (!res) {
                res = await window.inSetu.api.workspace(`fs/fetch?file=${encodeURIComponent(filePath)}`);
            }
        }

        if (!res.ok) throw new Error("File not found on disk.");
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
} catch (e) {
        window.inSetu.ui.setGlobalStatus("❌ Error: " + e.message, 3000, true);
        throw e;
    }
}

export async function fetchAndDownloadState(filePath, explicitUrl = null) {
    try {
        let fetchUrl = explicitUrl;
        if (!fetchUrl) {
            const activeWs = window.inSetu.utils.getActiveWorkspace();
            fetchUrl = `/api/${activeWs}/fs/fetch?file=` + encodeURIComponent(filePath);

            const override = window.inSetu.events.emitHook('zone:file-fetch-url', filePath);
            if (override) fetchUrl = override;
        }
        await downloadFile(fetchUrl, filePath.split('/').pop());
        window.inSetu.ui.setGlobalStatus("✅ Downloaded!", 2000);
} catch (e) {
        window.inSetu.ui.setGlobalStatus("❌ Error: " + e.message, 3000, true);
        throw e;
    }
}

export async function shareFiles(baseFile, chunks = null, isFS = false) {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const filesToFetch = (chunks && chunks.length > 1) ? chunks : [baseFile];
    const shareFilesArray = [];
    try {
        for (const filepath of filesToFetch) {
            let fetchUrl = window.inSetu.events.emitHook('zone:file-fetch-url', filepath);

            if (!fetchUrl) {
                const fileIsFS = (chunks && chunks.length > 1) ? false : isFS;
                fetchUrl = fileIsFS 
                    ? `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(filepath)}`
                    : `/download/${encodeURIComponent(filepath)}`;
            }

            const res = await fetch(fetchUrl, { headers: window.inSetu.api._getHeaders(true) });
            if (!res.ok) throw new Error(`File fetch failed for ${filepath}.`);

            const blob = await res.blob();
            const filename = filepath.split('/').pop();
            const ext = filename.split('.').pop().toLowerCase();

            let mime = blob.type;
            if (ext === 'md') mime = 'text/markdown';
            else if (ext === 'txt') mime = 'text/plain';
            else if (ext === 'json') mime = 'application/json';
            else if (ext === 'py') mime = 'text/x-python';
            else if (ext === 'js') mime = 'text/javascript';
            else if (!mime || mime === 'application/octet-stream') mime = 'text/plain';
            shareFilesArray.push(new File([blob], filename, { type: mime }));
        }

        if (navigator.canShare({ files: shareFilesArray })) {
            await navigator.share({ files: shareFilesArray });
        } else {
            throw new Error("File sharing not supported by this browser.");
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            window.inSetu.ui.setGlobalStatus(`❌ Share Error: ${err.message}`, 3000, true);
        }
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
    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(filename);

    FsStore.setState({ fileModal: {
        open: true,
        filename: filename,
        content: 'Loading...',
        originalContent: 'Loading...',
        fullText: 'Loading...',
        isTruncated: false,
        isFS: false,
        forceEdit: false,
        isMemoryOnly: false,
        isMarkdown,
        isSupportedEditor,
        ext,
        codeMode
    }});

    closeBrowseModal();
    try {
        const res = await fetch(`/download/${filename}`, { headers: window.inSetu.api._getHeaders(true) });
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToModal(text, isSupportedEditor, isMarkdown, false);
    } catch (e) {
        injectTextToModal("Error loading file content.", isSupportedEditor, isMarkdown, false);
    }
}
function refreshActiveFileViews(oldPath, newPath = null) {
    updateManifestState(oldPath, newPath);

    const mutations = [{ filepath: oldPath, operation: 'delete' }];
    if (newPath) mutations.push({ filepath: newPath, operation: 'save' });
    window.inSetu.events.emitHook('zone:vfs-mutated', { mutations });

    // Trigger a proactive compile to let the Cartographer map the renamed/moved/deleted files
    if (window.inSetu.sys.executeSystemCompile) {
        window.inSetu.sys.executeSystemCompile();
    }
}
function updateManifestState(oldPath, newPath = null) {
    const { manifest } = AppStore.getState();
    let changed = false;
    const newManifest = { ...manifest };

    const cleanPath = (p) => p ? p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/^\.\//, '') : '';
    const normOldPath = cleanPath(oldPath);
    const normNewPath = cleanPath(newPath);

    Object.keys(newManifest).forEach(key => {
        const obj = newManifest[key];
        if (obj.files) {
            const index = obj.files.findIndex(f => cleanPath(f) === normOldPath);
            if (index > -1) {
                changed = true;
                const newFiles = [...obj.files];
                newFiles.splice(index, 1);
                if (normNewPath && !newFiles.includes(normNewPath)) {
                    newFiles.push(normNewPath);
                }

                newManifest[key] = { ...obj, files: newFiles };
            }
        }
    });
    if (changed) {
        AppStore.setState({ manifest: newManifest });
    }

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
    if (autoSave !== true) autoSave = false;
    const state = FsStore.getState().fileModal;
    let content = state.content.replace(/\u00A0/g, ' ');

    if (state.filename.toLowerCase().endsWith('.json')) {
        try { JSON.parse(content); } catch (e) { return alert("Invalid JSON syntax: " + e.message); }
    }
    await window.inSetu.sys.executeWorkspaceMutation('fs/save', { filepath: state.filename, content }, {
        loadingText: 'Saving...',
        silent: autoSave,
        onSuccess: () => {
            FsStore.setState({ fileModal: { ...state, originalContent: content, content } });
            if (autoSave) {
                window.inSetu.events.emitHook('zone:vfs-mutated', { mutations: [{ filepath: state.filename, operation: 'save' }] });
            }

            // File modifications can drastically alter chunk boundaries; force a resync
            if (window.inSetu.sys.executeSystemCompile) {
                window.inSetu.sys.executeSystemCompile();
            }
        }
    });
}
async function copyFromModal() {
    const state = FsStore.getState().fileModal;
    let text = state.content;
    const overrideUrl = window.inSetu.events.emitHook('zone:file-fetch-url', state.filename);
    if (overrideUrl) {
        try {
            const res = await fetch(overrideUrl, { headers: window.inSetu.api._getHeaders(true) });
            if (res.ok) text = await res.text();
        } catch (e) { }
    }
    navigator.clipboard.writeText(text).then(() => {
        window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
    }).catch(err => alert("Clipboard API failed. Please manually select the text and copy it directly from the text box."));
}
function openMoveModal() {
    const filename = FsStore.getState().fileModal.filename;
    const parts = filename ? filename.split('/').filter(p => p) : [];
    parts.pop();
    FsStore.getState().setModal('move', { open: true, currentFile: filename, destPath: filename, initialParts: parts });
}
async function renameModalFile() {
    const filename = FsStore.getState().fileModal.filename;
    const currentName = filename.split('/').pop();
    const newName = prompt("Enter new filename:", currentName);
    if (!newName || newName === currentName) return;

    const parts = filename.split('/');
    parts.pop();
    const destPath = parts.length > 0 ? parts.join('/') + '/' + newName : newName;
    await window.inSetu.sys.executeWorkspaceMutation('fs/move', { filepath: filename, dest_path: destPath }, {
        loadingText: 'Renaming...',
        onSuccess: () => {
            closeFileModal(true);
            refreshActiveFileViews(filename, destPath);
        }
    });
}

async function executeMove() {
    const { currentFile, destPath } = FsStore.getState().modals.move;
    if (!destPath || destPath === currentFile) return alert("Please enter a valid new destination path.");
    await window.inSetu.sys.executeWorkspaceMutation('fs/move', { filepath: currentFile, dest_path: destPath }, {
        loadingText: 'Moving...',
        onSuccess: () => {
            FsStore.getState().setModal('move', { open: false });
            closeFileModal(true);
            refreshActiveFileViews(currentFile, destPath);
        }
    });
}
async function archiveModalFile() {
    const filename = FsStore.getState().fileModal.filename;
    if (!confirm("Are you sure you want to archive this file?\nIt will be moved to an 'archived/' subdirectory.")) return;
    await window.inSetu.sys.executeWorkspaceMutation('fs/archive', { filepath: filename }, {
        onSuccess: async (res) => {
            const data = await res.json();
            closeFileModal(true);
            refreshActiveFileViews(filename, data.new_path);
        }
    });
}
export async function deleteEmptyFolder(dirPath) {
    if (!confirm(`Are you sure you want to delete the empty folder /${dirPath}?`)) return;
    await window.inSetu.sys.executeWorkspaceMutation('fs/delete', { filepath: dirPath }, {
        onSuccess: () => {
            const parts = dirPath.split('/');
            parts.pop();
            AppStore.setState({ globalBrowsePath: parts });
            window.inSetu.events.emitHook('zone:vfs-mutated', { mutations: [{ filepath: dirPath, operation: 'delete' }] });

            const manifest = AppStore.getState().manifest;
            let changed = false;
            const newManifest = { ...manifest };
            Object.keys(newManifest).forEach(key => {
                const obj = newManifest[key];
                if (obj.files) {
                    const keepPath = dirPath + '/.gitkeep';
                    const index = obj.files.indexOf(keepPath);
                    if (index > -1) {
                        changed = true;
                        const newFiles = [...obj.files];
                        newFiles.splice(index, 1);
                        newManifest[key] = { ...obj, files: newFiles };
                    }
                }
            });
            if (changed) AppStore.setState({ manifest: newManifest });

            // Ensure the deletion is accurately reflected by the backend Cartographer
            if (window.inSetu.sys.executeSystemCompile) {
                window.inSetu.sys.executeSystemCompile();
            }
}
    });
}

async function deleteModalFile() {
    const filename = FsStore.getState().fileModal.filename;
    if (!confirm("Are you sure you want to delete this file?\nThis cannot be undone!")) return;
    await window.inSetu.sys.executeWorkspaceMutation('fs/delete', { filepath: filename }, {
        onSuccess: () => {
            closeFileModal(true);
            refreshActiveFileViews(filename);
        }
    });
}
function cleanModalFile() {
    if (!confirm("Clean LLM cite and span tags from this file?")) return;

    const state = FsStore.getState().fileModal;
    let text = state.content;

    text = text.replace(/\[cite(?:[^\]]*)\]/gi, '');
    text = text.replace(/\[span_\d+\]\((?:start_span|end_span)\)/gi, '');
    text = text.replace(/\((?:start_span|end_span)\)/gi, '');
    text = text.replace(/\[span_\d+\]/gi, '');
    FsStore.setState({ fileModal: { ...state, content: text } });

    if (state.isFS && window.inSetu.ui.saveModalFile) {
        window.inSetu.ui.saveModalFile(true);
    }
}
async function downloadFromModal() {
    const state = FsStore.getState().fileModal;
    try {
        if (state.isMemoryOnly) {
            let text = state.isTruncated ? state.fullText : state.content;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = state.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            let fetchUrl = state.isFS ? `fs/fetch?file=${encodeURIComponent(state.filename)}` : `/download/${state.filename}`;
            const overrideUrl = window.inSetu.events.emitHook('zone:file-fetch-url', state.filename);
            if (overrideUrl) fetchUrl = overrideUrl;

            if (fetchUrl.startsWith('/') || fetchUrl.startsWith('http')) {
                await downloadFile(fetchUrl, state.filename.split('/').pop());
            } else {
                const res = await window.inSetu.api.workspace(fetchUrl);
                if (!res.ok) throw new Error('Download failed from server.');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = state.filename.split('/').pop();
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }
        }
    } catch (e) {
        alert("Error downloading file: " + e.message);
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

    card.entityType = fileInfo.isSource ? 'file' : 'file:context';
    card.entityData = { filepath: fileInfo.filename, repoDir: fileInfo.repoDir, isFS: fileInfo.isFS };

    card.addEventListener('card-clicked', () => {
        if (fileInfo.isSource) viewSourceFile(fileInfo.filename, fileInfo.isFS);
        else viewAndCopy(fileInfo.filename);
    });

    container.appendChild(card);
}
export const getGlobalManifest = () => {
    const state = AppStore.getState();
    const gatherState = window.inSetu.stores.Gather ? window.inSetu.stores.Gather.getState() : {};
    const validPrefixes = (gatherState.targetConfigs || []).map(cfg => cfg.repo_dir ? cfg.repo_dir + '/' : '');

    const allFiles = Array.from(new Set(Object.values(state.manifest || {}).flatMap(obj => obj.files || [])));

    // Inject active prompts directly into the tree to guarantee navigation in Modals (Move, etc)
    const rawPrompts = gatherState.gatherOptions?.prompts || [];
    if (rawPrompts.length === 0) {
        // Guarantee the prompts folder exists even if completely empty
        allFiles.push('.insetu/prompts/.gitkeep');
    } else {
        rawPrompts.forEach(p => {
            const pPath = p.startsWith('.insetu/prompts/') ? p : `.insetu/prompts/${p.replace(/^prompts\//, '')}`;
            allFiles.push(pPath);
        });
    }

    // Explicitly whitelist prompts to avoid opening the entire OS control plane
    const isAllowed = (f) => {
        if (f.startsWith('.insetu/prompts/')) return true;
        if (validPrefixes.length === 0) return true;
        return validPrefixes.some(prefix => f.startsWith(prefix));
    };

    return allFiles.filter(isAllowed);
};
export class InSetuVFSExplorer extends InSetuElement {
        static properties = {
                searchQuery: { type: String },
                manifestFiles: { type: Array },
                globalBrowsePath: { type: Array }
        };
        static styles = [sharedStyles, css`
                :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
                .vfs-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 0; }
        `];

        constructor() {
                super();
                this.searchQuery = '';
                this.manifestFiles = [];
                this.globalBrowsePath = [];
        }
        _updateState(state) {
                const allFiles = new Set();
                const gatherState = window.inSetu.stores.Gather ? window.inSetu.stores.Gather.getState() : {};
                // UDF Guardrail: Only show files that belong to explicitly tracked repository targets
                // This prevents OS artifact directories (contexts/, diffs/) from leaking into the visual root
                const validPrefixes = (gatherState.targetConfigs || []).map(cfg => cfg.repo_dir ? cfg.repo_dir + '/' : '');

                Object.values(state.manifest || {}).forEach(obj => {
                        if (obj.files) {
                            obj.files.forEach(f => {
                                if (validPrefixes.length === 0 || validPrefixes.some(prefix => f.startsWith(prefix))) {
                                    allFiles.add(f);
                                }
                            });
                        }
                });
                if (gatherState.targetConfigs) {
                        gatherState.targetConfigs.forEach(cfg => {
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
                this.subscribe(AppStore, (state) => {
                        this._updateState(state);
                });
                this.subscribe(FsStore, (state) => {
                        this.searchQuery = state.searchQuery;
                });

                // Trigger initial read
                this._updateState(AppStore.getState());
                this.searchQuery = FsStore.getState().searchQuery || '';
        }

        disconnectedCallback() {
                super.disconnectedCallback();
        }
        _handlePathChange(e) {
                AppStore.setState({ globalBrowsePath: e.detail.path });
        }
        render() {
            if (this.manifestFiles.length === 0) {
                return html`<p style="padding: 15px; color: var(--text-muted);">No repositories configured.</p>`;
            }
            return html`
                <insetu-file-tree  
                    style="flex: 1;"
                    @card-clicked=${(e) => { if(e.detail.isSource && window.inSetu.vfs.viewSourceFile) window.inSetu.vfs.viewSourceFile(e.detail.filename, true); }}
                    basePath=""
                    .files=${this.manifestFiles}
                    .currentPath=${this.globalBrowsePath}
                    .hidePath=${false}
                    .enableSearch=${true}
                    searchPlaceholder="🔍 Fuzzy search files..."
                    entityType="file"
                    @path-changed=${this._handlePathChange}>
                </insetu-file-tree>
            `;
        }
}
customElements.define('insetu-vfs-explorer', InSetuVFSExplorer);
export class InSetuVFSExplorerActions extends InSetuElement {
    static properties = {
        globalBrowsePath: { type: Array }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.globalBrowsePath = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, state => {
            this.globalBrowsePath = state.globalBrowsePath || [];
        });
        this.globalBrowsePath = AppStore.getState().globalBrowsePath || [];
    }

    get _menuItems() {
        const currentPath = this.globalBrowsePath.join('/');
        const items = [];
        if (!currentPath) {
            items.push({ label: 'New Repository', icon: '📦', onClick: () => openNewFolderModal() });
        } else {
            const prefix = currentPath + '/';
            items.push({ label: 'New Folder', icon: '📁', onClick: () => openNewFolderModal(prefix) });
            items.push({ label: 'New File', icon: '📄', onClick: () => openNewFileModal(prefix) });
            items.push({ label: 'Upload File', icon: '📤', onClick: () => uploadFileToWorkspace(currentPath) });

            const manifestFiles = getGlobalManifest();
            const prefixWithSlash = currentPath + '/';
            const hasFiles = manifestFiles.some(f => f.startsWith(prefixWithSlash) && !f.endsWith('.gitkeep'));
            if (!hasFiles) {
                items.push({ divider: true });
                items.push({ label: 'Delete Folder', icon: '🗑️', onClick: () => deleteEmptyFolder(currentPath) });
            }
        }

        window.inSetu.events.emitHook('zone:fs-dropdown-menu', { currentPath, isPrompts: false, menuItems: items });
        return items;
    }

    render() {
        return html`
            <yenvui-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="system-action-btn">☰</button>
            </yenvui-dropdown>
        `;
    }
}
customElements.define('insetu-vfs-explorer-actions', InSetuVFSExplorerActions);
window.ExtensionRegistry.registerExtension('files', {
    name: "Virtual File System",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'file-copy',
            label: 'Copy',
            icon: '📋',
            intent: 'success',
            order: 90,
            match: (data) => {
                if (data.suppressCopy) return false;
                if (data.isSkeleton) return false;
                const basename = data.filepath ? data.filepath.split('/').pop() : data.filepath;
                const chunks = window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, basename);
                return !chunks || chunks.length <= 1;
            },
            asyncAction: async (data, e) => {
                let fetchUrl = window.inSetu.events.emitHook('zone:file-fetch-url', data.filepath);

                // ADR 0016: Explicitly inject the tenant scope to prevent 404 routing failures
                if (!fetchUrl) {
                    const activeWs = window.inSetu.utils.getActiveWorkspace();
                    fetchUrl = data.isFS 
                        ? `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(data.filepath)}`
                        : `/download/${encodeURIComponent(data.filepath)}`;
                }
                await fetchAndCopy(data.filepath, fetchUrl);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-browse',
            label: 'Browse',
            icon: '📁',
            intent: 'neutral',
            order: 80,
            match: (data) => !data.suppressBrowse && !data.isFS && !data.isSkeleton,
            onClick: (data, e) => {
                const basename = data.filepath ? data.filepath.split('/').pop() : data.filepath;
                if (window.inSetu.ui.openBrowseModal) window.inSetu.ui.openBrowseModal(basename);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-share',
            label: 'Share',
            icon: '📤',
            intent: 'primary',
            order: 95,
            match: (data) => {
                if (data.suppressDownload) return false;
                if (data.isSkeleton) return false;
                // Only render if the device natively supports Web Sharing
                return !!navigator.share && !!navigator.canShare;
            },
            asyncAction: async (data, e) => {
                const basename = data.filepath ? data.filepath.split('/').pop() : data.filepath;
                const chunks = window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, basename);
                await shareFiles(data.filepath, chunks, data.isFS);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-download',
            label: 'Download',
            icon: '⬇️',
            intent: 'primary',
            order: 100,
            match: (data) => {
                if (data.suppressDownload) return false;
                if (data.isSkeleton) return false;
                const basename = data.filepath ? data.filepath.split('/').pop() : data.filepath;
                const chunks = window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, basename);
                // If it has multiple chunks, the 'context' subclass takes over download responsibilities
                return !chunks || chunks.length <= 1;
            },
            asyncAction: async (data, e) => {
                let fetchUrl = window.inSetu.events.emitHook('zone:file-fetch-url', data.filepath);

                // ADR 0016: Explicitly inject the tenant scope to prevent 404 routing failures
                if (!fetchUrl) {
                    const activeWs = window.inSetu.utils.getActiveWorkspace();
                    fetchUrl = data.isFS 
                        ? `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(data.filepath)}`
                        : `/download/${encodeURIComponent(data.filepath)}`;
                }
                await fetchAndDownloadState(data.filepath, fetchUrl);
            }
        }
    ],
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
export function checkFileExtension(filename) {
    const warningEl = document.getElementById('new-file-ext-warning');
    if (!warningEl) return;
    warningEl.style.display = 'none';

    if (!filename) return;
    const gbPath = AppStore.getState().globalBrowsePath || [];
    if (gbPath.length > 0) {
        const repoDir = gbPath[0];
        const gatherState = window.inSetu.stores.Gather ? window.inSetu.stores.Gather.getState() : {};
        const targetConfigs = gatherState.targetConfigs || [];
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

    content = await window.inSetu.events.emitHook('zone:pre-save-new-file', { fileName, content, filepath }) || content;

    await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
        filepath,
        content
    }, {
        loadingText: 'Saving...',
        onSuccess: async () => {
            FsStore.getState().setModal('newFile', { open: false });

            window.inSetu.events.emitHook('zone:vfs-mutated', { mutations: [{ filepath: filepath, operation: 'save' }] });

            // Trigger a definitive proactive ledger flush to surgically compile Gather payloads immediately
            if (window.inSetu.sys.executeSystemCompile) {
                window.inSetu.sys.executeSystemCompile();
            }
        }
});
}
async function openNewFolderModal(overridePath = null) {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const isRoot = overridePath === null && gbPath.length === 0;
    const prefix = typeof overridePath === 'string' ? overridePath : (isRoot ? '' : gbPath.join('/') + '/');

    let exts = '.py, .json, .md, .sh, .txt, .html, .css, .js';
    let domain = 'Workspaces';
    if (isRoot) {
        try {
            const res = await window.inSetu.api.workspace('gather/repos/template');
            if (res.ok) {
                const tpl = await res.json();
                exts = tpl.exts.join(', ');
                domain = tpl.domain;
            }
        } catch(e) {}
    }

    FsStore.getState().setModal('newFolder', { open: true, basePath: prefix, folderName: '', repoTitle: '', repoDomain: domain, repoDesc: '', repoExts: exts });
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
    await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
        filepath,
        content: "",
        is_new_repo: isNewRepo,
        repo_dir: folderName,
        ...payloadExt
    }, {
        loadingText: "Creating...",
        onSuccess: async () => {
            if (isNewRepo) {
                const rRes = await window.inSetu.api.workspace('gather/repos?t=' + Date.now());
                if (rRes.ok) {
                    const d = await rRes.json();
                    AppStore.setState({ allRepos: d.repos, targetConfigs: d.targets || [] });
                }
            }
            FsStore.getState().setModal('newFolder', { open: false });

            window.inSetu.events.emitHook('zone:vfs-mutated', { mutations: [{ filepath: filepath, operation: 'save' }] });

            // Trigger a definitive proactive ledger flush to surgically compile Gather payloads immediately
            if (window.inSetu.sys.executeSystemCompile) {
                window.inSetu.sys.executeSystemCompile();
            }
        }
    });
}
export async function viewSourceFile(filepath, isFS = false) {
    if (window.inSetu.events.emitHook('zone:file-edit-override', filepath)) return;

    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(filepath);

    FsStore.setState({ fileModal: {
        open: true,
        filename: filepath,
        content: 'Loading...',
        originalContent: 'Loading...',
        fullText: 'Loading...',
        isTruncated: false,
        isFS,
        forceEdit: false,
        isMemoryOnly: false,
        isMarkdown,
        isSupportedEditor,
        ext,
        codeMode
    }});

    closeBrowseModal();
    try {
        const res = await window.inSetu.api.workspace(`fs/fetch?file=${encodeURIComponent(filepath)}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToModal(text, isSupportedEditor, isMarkdown, isFS);
    } catch (e) {
        injectTextToModal("Error loading file content.", isSupportedEditor, isMarkdown, isFS);
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
function _handleBrowserCardClick(detail) {
    const { browserConfig } = AppStore.getState();
    if (browserConfig && browserConfig.mode === 'file') {
        if (browserConfig.callback) browserConfig.callback(detail.filename);
        closeBrowseModal();
    } else if (browserConfig && browserConfig.mode === 'view') {
        if (detail.isSource && window.inSetu.vfs.viewSourceFile) window.inSetu.vfs.viewSourceFile(detail.filename, true);
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
export function closeFileModal(force = false) {
    const state = FsStore.getState().fileModal;
    if (!force && state.isFS && state.content !== state.originalContent) {
        if (!confirm("You have unsaved changes. Are you sure you want to close this file?")) return;
    }
    FsStore.setState({ fileModal: { ...state, open: false, content: '', originalContent: '', fullText: '' } });
}

export function openVirtualFile(filename, content) {
    FsStore.setState({ fileModal: {
        open: true,
        filename: filename,
        content: 'Loading...',
        originalContent: 'Loading...',
        fullText: 'Loading...',
        isTruncated: false,
        isFS: false,
        forceEdit: true,
        isMemoryOnly: true,
        isMarkdown: true,
        isSupportedEditor: true,
        ext: 'md',
        codeMode: 'markdown'
    }});

    closeBrowseModal();
    injectTextToModal(content, true, true, false, true);
}
export class InSetuFileModal extends InSetuElement {
    static properties = {
        fileModal: { type: Object }
    };
    static styles = [sharedStyles, css`
        .fs-modal-container { position: fixed; top: 0; left: 0; width: 100vw; height: calc(100dvh - 30px); }
        .fullscreen-wrapper { display: flex; flex-direction: column; height: 100%; width: 100%; background: var(--bg); }
        insetu-async-btn { flex: 1; display: block; --btn-padding: 12px; --btn-border-radius: 6px; }
    `];
    constructor() {
        super();
        this.fileModal = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(FsStore, state => {
            this.fileModal = state.fileModal || {};
        });
    }

    get isDirty() {
        return this.fileModal.isFS && this.fileModal.content !== this.fileModal.originalContent;
    }

    render() {
        const m = this.fileModal;
        if (!m || !m.open) return html``;
        const shouldBeReadOnly = !(m.isFS || m.forceEdit);
        const kbSize = Math.round((m.fullText?.length || 0) / 1024);

        let extMenuItems = [];
        if (m.isFS) {
            window.inSetu.events.emitHook('zone:modal-ext-menu', { filepath: m.filename, isMarkdown: m.isMarkdown, ext: m.ext, menuItems: extMenuItems });
        }
        return html`
            <div class="fs-modal-container" style="display: block; z-index: 3000; padding: 0;">
                <div class="fullscreen-wrapper">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px 0 20px; background: var(--input-bg); border-bottom: none; flex-shrink: 0;">
                        <h3 style="margin: 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; direction: rtl; text-align: left; color: var(--text);" title="${m.filename}">${m.filename}</h3>
                        <button @click=${() => closeFileModal()} class="btn-sm" style="background: #64748b; margin: 0;">Back</button>
                    </div>

                    ${m.isFS ? html`
                        <div style="display: flex; gap: 10px; margin: 0; padding: 10px 20px 12px 20px; background: var(--input-bg); border-bottom: 1px solid var(--border); border-radius: 0; align-items: center; flex-shrink: 0;">
                            <yenvui-dropdown align="left" .items=${[
                                { label: 'Rename', icon: '✏️', onClick: renameModalFile },
                                { label: 'Move', icon: '🚚', onClick: openMoveModal },
                                { label: 'Archive', icon: '📦', onClick: archiveModalFile },
                                { label: 'Delete', icon: '🗑️', onClick: deleteModalFile }
                            ]}>
                                <button slot="trigger" class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; font-weight: bold;">📁 File ▾</button>
                            </yenvui-dropdown>

                            <yenvui-dropdown align="left" .items=${[
                                { label: 'Insert Link', icon: '🔗', onClick: openLinkModal },
                                ...(m.isMarkdown || m.ext === 'txt' ? [{ label: 'Clean AI Tags', icon: '🧹', onClick: cleanModalFile }] : [])
                            ]}>
                                <button slot="trigger" class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; font-weight: bold;">📝 Edit ▾</button>
                            </yenvui-dropdown>

                            ${extMenuItems.length > 0 ? html`
                                <yenvui-dropdown align="left" .items=${extMenuItems}>
                                    <button slot="trigger" class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; font-weight: bold;">🧩 Extensions ▾</button>
                                </yenvui-dropdown>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${m.isTruncated ? html`
                        <div style="display: flex; background: #f59e0b; color: #000; padding: 8px 20px; font-weight: bold; justify-content: space-between; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--border);">
                            <span>⚠️ Only showing the first 200kb of <b>${kbSize}kb</b>.</span>
                            <button @click=${() => loadFullModalText()} class="btn-sm" style="background: #000; color: #f59e0b; margin: 0; border: 1px solid #000;">Show All</button>
                        </div>
                    ` : ''}

                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg);">
                        ${m.isSupportedEditor ? html`
                            <insetu-markdown-editor 
                                .value=${m.content} 
                                .language=${m.codeMode} 
                                .readOnly=${shouldBeReadOnly}
                                @content-changed=${(e) => FsStore.setState(s => ({ fileModal: { ...s.fileModal, content: e.detail.value } }))}>
                            </insetu-markdown-editor>
                        ` : html`
                            <textarea 
                                style="flex: 1; margin: 0; border: none; border-radius: 0; resize: none; background: var(--bg); color: var(--text); padding: 15px; font-family: monospace;"
                                .value=${m.content}
                                ?readOnly=${shouldBeReadOnly}
                                @input=${(e) => FsStore.setState(s => ({ fileModal: { ...s.fileModal, content: e.target.value } }))}>
                            </textarea>
                        `}
                    </div>
                    <div class="modal-footer" style="padding: 12px 20px; gap: 12px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                        ${(window.inSetu.stores.App?.getState()?.manifest[m.filename]?.files?.length > 0) ? html`
                            <sutram-async-btn label="📁 Browse" intent="highlight" .onClick=${() => {
                                if (window.inSetu.ui.openBrowseModal) window.inSetu.ui.openBrowseModal(m.filename);
                            }}></sutram-async-btn>
                        ` : ''}
                        ${(() => {
                            const chunks = getChunks(m.filename);
                            if (chunks && chunks.length > 1) {
                                return html`
                                    <sutram-async-btn label="📦 View Parts" intent="highlight" .onClick=${() => openPartsModal(m.filename)}></sutram-async-btn>
                                `;
                            }
                            return html`
                                <sutram-async-btn 
                                    class="ui-draggable-export" 
                                    draggable="true" 
                                    @dragstart=${(e) => {
                                        let fetchUrl = m.isFS ? `fs/fetch?file=${encodeURIComponent(m.filename)}` : `/download/${m.filename}`;
                                        const override = window.inSetu.events.emitHook('zone:file-fetch-url', m.filename);
                                        if (override) fetchUrl = override;
                                        bindDownloadDrag(e, m.filename, fetchUrl);
                                    }}
                                    label="⬇️ Download" 
                                    intent="primary" 
                                    .onClick=${downloadFromModal}>
                                </sutram-async-btn>
                            `;
                        })()}

                        <sutram-async-btn label="📋 Copy" intent="success" .onClick=${copyFromModal}></sutram-async-btn>

                        ${this.isDirty ? html`
                            <sutram-async-btn label="💾 Save" intent="warning" .onClick=${() => saveModalFile(false)}></sutram-async-btn>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-file-modal', InSetuFileModal);

export function extractManifestFiles(manifest, targetKey = null) {
    if (!manifest) return [];
    if (targetKey) {
        const item = manifest[targetKey];
        if (!item) return [targetKey];
        if (Array.isArray(item)) return item;
        return item.chunks || item.files || [targetKey];
    }
    const allFiles = new Set();
    Object.keys(manifest).forEach(k => {
        const item = manifest[k];
        const list = Array.isArray(item) ? item : (item.chunks || item.files || [k]);
        list.forEach(f => allFiles.add(f));
    });
    return Array.from(allFiles);
}

export function getChunks(filepath) {
    if (!filepath) return [];
    const basename = filepath.split('/').pop();
    const manifest = AppStore.getState().manifest || {};
    return extractManifestFiles(manifest, basename);
}

window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.extractManifestFiles = extractManifestFiles;

// Window Bindings
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};

export function openPartsModal(filepath) {
    if (!filepath) return;
    const basename = filepath.split('/').pop();
    const chunks = getChunks(basename);
    if (chunks && chunks.length > 0) {
        openWorkspaceBrowser({
            mode: 'view',
            title: `Parts: ${basename}`,
            files: chunks,
            autoDrilldown: false
        });
    }
}

window.inSetu.vfs.getChunks = getChunks;
window.inSetu.vfs.openPartsModal = openPartsModal;
window.inSetu.vfs.openVirtualFile = openVirtualFile;
window.inSetu.vfs.fetchAndCopy = fetchAndCopy;
window.inSetu.vfs.fetchAndDownloadState = fetchAndDownloadState;
window.inSetu.vfs.downloadFile = downloadFile;
window.inSetu.vfs.shareFiles = shareFiles;
window.inSetu.vfs.uploadFileToWorkspace = uploadFileToWorkspace;
window.inSetu.vfs.viewSourceFile = viewSourceFile;
window.inSetu.vfs.viewAndCopy = viewAndCopy;
window.inSetu.vfs.deleteEmptyFolder = deleteEmptyFolder;
window.inSetu.vfs.buildFileTree = buildFileTree;
window.inSetu.vfs.getGlobalManifest = getGlobalManifest;

window.inSetu.ui.openNewFileModal = openNewFileModal;
window.inSetu.ui.openNewFolderModal = openNewFolderModal;
window.inSetu.ui.openMoveModal = openMoveModal;
window.inSetu.ui.closeFileModal = closeFileModal;
window.inSetu.ui.saveModalFile = saveModalFile;
window.inSetu.ui.openWorkspaceBrowser = openWorkspaceBrowser;
window.inSetu.ui.openFolderBrowser = openFolderBrowser;
window.inSetu.ui.openBrowseModal = openBrowseModal;
window.inSetu.ui.closeBrowseModal = closeBrowseModal;
window.inSetu.ui.openLinkModal = openLinkModal;
window.inSetu.ui.createFileCard = createFileCard;
window.inSetu.ui.saveNewFile = saveNewFile;
window.inSetu.ui.checkFileExtension = checkFileExtension;
window.addEventListener('insetu:vfs:view-parts', (e) => {
    const { filepath } = e.detail;
    openPartsModal(filepath);
});

export async function uploadFileToWorkspace(targetDir) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('file', files[i]);
        }
        formData.append('dest_dir', targetDir || '');
        const loadingMsg = files.length > 1 ? `Uploading ${files.length} files...` : `Uploading ${files[0].name}...`;
        await window.inSetu.sys.executeWorkspaceMutation('fs/upload', formData, {
            loadingText: loadingMsg,
            onSuccess: () => {
                if (window.inSetu.sys.executeSystemCompile) {
                    window.inSetu.sys.executeSystemCompile();
                }
            }
        });
    };
    input.click();
}

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
export class InSetuVFSModals extends InSetuElement {
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
        this.subscribe(FsStore, state => {
            this.modals = state.modals;
            this.requestUpdate();
        });
        this.subscribe(AppStore, state => {
            this.browserConfig = state.browserConfig;
            this.currentBrowsePath = state.currentBrowsePath;
            this.requestUpdate();
        });
        this.modals = FsStore.getState().modals;
        this.browserConfig = AppStore.getState().browserConfig;
        this.currentBrowsePath = AppStore.getState().currentBrowsePath;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    render() {
        const m = this.modals;
        if (!m) return '';
        return html`
            <yenvui-modal ?open=${m.move?.open} ?fullscreen=${true} titleText="Move File to..." @yenvui-modal-closed=${() => FsStore.getState().setModal('move', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden; flex: 1; min-height: 0;">
                    <input type="text" .value=${m.move?.destPath || ''} @input=${e => {
                        const newDest = e.target.value;
                        const parts = newDest.split('/').filter(p => p);
                        parts.pop();
                        FsStore.getState().setModal('move', { destPath: newDest, initialParts: parts });
                    }} style="margin-bottom: 15px; font-family: monospace; min-width: 0; box-sizing: border-box;">
                    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0 10px;">
                        <sutram-folder-browser .files=${getGlobalManifest()} .currentPath=${m.move?.initialParts || []} @path-changed=${e => {
                            const filename = m.move?.currentFile ? m.move.currentFile.split('/').pop() : '';
                            FsStore.getState().setModal('move', { 
                                destPath: e.detail.path ? (e.detail.path + '/' + filename) : filename,
                                initialParts: e.detail.path ? e.detail.path.split('/') : []
                            });
                        }}></sutram-folder-browser>
                    </div>
                </div>
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${executeMove}>🚚 Move File</button>
            </yenvui-modal>
            <yenvui-modal ?open=${m.newFile?.open} ?fullscreen=${true} titleText="Create New Workspace File" @yenvui-modal-closed=${() => FsStore.getState().setModal('newFile', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text); word-break: break-all;">Path: <span style="font-family: monospace; color: var(--intent-highlight);">${m.newFile?.basePath}</span></label>
                    <input type="text" placeholder="Filename (e.g. my-prompt.md)..." .value=${m.newFile?.fileName || ''} @input=${e => { FsStore.getState().setModal('newFile', { fileName: e.target.value }); if(window.inSetu.ui.checkFileExtension) window.inSetu.ui.checkFileExtension(e.target.value); }} style="margin-bottom: 5px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box; min-width: 0;">
                    <div id="new-file-ext-warning" style="display: none; color: var(--intent-warning); font-size: 0.8rem; font-weight: bold; margin-bottom: 15px;"></div>
                    ${window.inSetu.events.emitHook('zone:new-file-options-lit', null) || ''}
                    <textarea style="flex: 1; margin-bottom: 0; font-size: 13px; margin-top: 0; width: 100%; box-sizing: border-box; min-width: 0; min-height: 200px; resize: vertical;" placeholder="Enter file content here..." .value=${m.newFile?.content || ''} @input=${e => FsStore.getState().setModal('newFile', { content: e.target.value })}></textarea>
                </div>
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${saveNewFile}>💾 Create & Save File</button>
            </yenvui-modal>
            <yenvui-modal ?open=${m.newFolder?.open} ?fullscreen=${true} titleText=${m.newFolder?.basePath === '' ? 'Create New Repository' : 'Create New Folder'} @yenvui-modal-closed=${() => FsStore.getState().setModal('newFolder', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
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
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${saveNewFolder}>
                    ${m.newFolder?.basePath === '' ? '📦 Initialize Repository' : '📁 Create Folder'}
                </button>
            </yenvui-modal>
            <yenvui-modal ?open=${m.linkInsert?.open} ?fullscreen=${true} titleText="Insert Link" @yenvui-modal-closed=${() => FsStore.getState().setModal('linkInsert', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <div style="height: 40px; flex-shrink: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border);">
                        <div class="sub-tabs">
                            <div class="sub-tab ${m.linkInsert?.activeTab === 'filename' ? 'active' : ''}" @click=${() => switchLinkTab('filename')}>Filename</div>
                            <div class="sub-tab ${m.linkInsert?.activeTab === 'deep' ? 'active' : ''}" @click=${() => switchLinkTab('deep')}>Deep Search</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-shrink: 0;">
                        <input type="text" placeholder="Search files..." style="flex: 1; min-width: 0; padding: 8px; margin: 0;"
                            .value=${m.linkInsert?.searchQuery || ''}
                            @input=${e => onLinkSearchInput(e.target.value)}>
                        ${m.linkInsert?.activeTab === 'deep' ? html`
                            <button @click=${() => executeDeepLinkSearch()} class="btn-sm" style="background: var(--intent-highlight); margin: 0;" ?disabled=${m.linkInsert?.deepSearchLoading}>
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
                                    @card-clicked=${() => insertLinkToEditor(item.path, name)}>
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
            </yenvui-modal>
<yenvui-modal .open=${m.browser?.open} ?open=${m.browser?.open} titleText=${m.browser?.title || 'Browse'} ?fullscreen=${true} @yenvui-modal-closed=${closeBrowseModal}>
    <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden; flex: 1; padding: 0;">
        <insetu-file-tree 
            basePath=""
            .files=${m.browser?.manifest || []}
            .currentPath=${this.currentBrowsePath || []}
            .hidePath=${false}
            .enableSearch=${this.browserConfig?.mode !== 'folder'}
            searchPlaceholder="Fuzzy find files..."
            .hideFiles=${this.browserConfig?.mode === 'folder'}
            @path-changed=${e => AppStore.setState({ currentBrowsePath: e.detail.path })}
            @card-clicked=${e => _handleBrowserCardClick(e.detail)}>
        </insetu-file-tree>
    </div>
    ${this.browserConfig?.mode === 'folder' ? html`
        <button slot="footer" style="background: var(--intent-success); color: white;" @click=${confirmFolderSelection}>✅ Select This Folder</button>
    ` : ''}
</yenvui-modal>
        `;
    }
}
customElements.define('insetu-vfs-modals', InSetuVFSModals);

document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(document.createElement('insetu-vfs-modals'));
});
