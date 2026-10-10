import { LitElement, html, css } from 'lit';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { InSetuElement, createExtensionStore } from '/static/extensions/system/insetu_sdk.js';
import { resolveEditorMode } from '/static/extensions/system/components/ui_editor.js';
import { AppStore } from '/static/extensions/system/store.js';
import { buildFileTree, downloadFile as sutramDownloadFile, downloadBlob, bindGhostDrag } from '../../vendor/sutram/js/utils.js';
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

    bindGhostDrag(e, safeName, '📄', {
        'DownloadURL': `${mime}:${safeName}:${absoluteUrl}`,
        'text/uri-list': absoluteUrl,
        'text/plain': absoluteUrl
    });
}

document.addEventListener('dragstart', (e) => {
    const dragEl = e.target.closest('.ui-draggable-export');
    if (dragEl) {
        const filename = dragEl.dataset.filename;
        let fetchUrl = dragEl.dataset.fetchUrl;
        // Resolve dynamic extension overrides natively
        const overrideUrl = window.inSetu.events.emitHook('insetu:file-fetch-url', filename);
        if (overrideUrl) fetchUrl = overrideUrl;

        if (filename && fetchUrl) {
            bindDownloadDrag(e, filename, fetchUrl);
        }
    }
});
export function normalizeVfsURI(path) {
    if (!path || typeof path !== 'string') return '';
    if (path.includes('://')) return path;
    return `vfs://${path.replace(/^\/+/, '')}`;
}

export const FsStore = createExtensionStore('Fs', {
    searchQuery: '',
    activeBuffers: {}, // Maps filepath -> buffer state for multi-projection editing
    openBuffer: (filepath, data) => {
        const normPath = normalizeVfsURI(filepath);
        FsStore.setState(s => ({  
            activeBuffers: { ...s.activeBuffers, [normPath]: { ...(s.activeBuffers[normPath] || {}), ...data, filename: normPath } } 
        }));
    },
    updateBuffer: (filepath, data) => {
        const normPath = normalizeVfsURI(filepath);
        FsStore.setState(s => ({ 
            activeBuffers: { ...s.activeBuffers, [normPath]: { ...(s.activeBuffers[normPath] || {}), ...data } } 
        }));
    },
    closeBuffer: (filepath) => {
        const normPath = normalizeVfsURI(filepath);
        FsStore.setState(s => { 
            const newBufs = {...s.activeBuffers}; 
            delete newBufs[normPath]; 
            if (filepath !== normPath) delete newBufs[filepath];
            return { activeBuffers: newBufs }; 
        });
    },
    modals: {
        move: { open: false, currentFile: '', destPath: '', initialParts: [] },
        newFile: { open: false, basePath: '', fileName: '', content: '' },
        newFolder: { open: false, basePath: '', folderName: '', repoTitle: '', repoDomain: 'Workspaces', repoDesc: '', repoExts: '.py, .json, .md, .sh, .txt, .html, .css, .js' },
        linkInsert: { open: false, activeTab: 'filename', searchQuery: '', searchResults: [], deepSearchLoading: false },
        browser: { open: false, title: '', manifest: [], searchQuery: '' }
    },
    fileVerificationCache: {},
    verifyFiles: (files, force = false) => {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        files.forEach(file => {
            if (force || FsStore.getState().fileVerificationCache[file] === undefined) {
                if (window.inSetu?.extensions?.Registry?.utils) {
                    window.inSetu.extensions.Registry.utils.debounceVerifyFile(activeWs, file, (exists) => {
                        FsStore.setState(state => ({
                            fileVerificationCache: { ...state.fileVerificationCache, [file]: exists }
                        }));
                    });
                }
            }
        });
    },
    setSearchQuery: (q) => FsStore.setState({ searchQuery: q }),
    setModal: (modalName, data) => FsStore.setState(state => ({
        modals: { ...state.modals, [modalName]: { ...state.modals[modalName], ...data } }
    }))
}, {
    sessionSync: ['modals']
});
window.inSetu = window.inSetu || {};
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.stores.Fs = FsStore;
window.inSetu.vfs.shareTextCache = new Map();

function injectTextToBuffer(filepath, text, isSupportedEditor, isMarkdown, isFS, forceAllowEdit = false) {
    const TRUNCATE_LIMIT = 200000;
    let content = text;
    let isTruncated = false;

    if (text.length > TRUNCATE_LIMIT) {
        isTruncated = true;
        content = text.substring(0, TRUNCATE_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR PERFORMANCE] ...';
    }
    FsStore.getState().updateBuffer(filepath, {
        content,
        originalContent: content,
        fullText: text,
        isTruncated,
        forceEdit: forceAllowEdit
    });
}

export function routeToSpatialGrid(filepath, label = null) {
    if (!window.Sutram?.stores?.Layout) return;
    const layout = window.Sutram.stores.Layout.getState();
    const safeLabel = label || filepath.split('/').pop();

    let existingCol = null;
    ['left', 'center', 'right'].forEach(col => {
        if (layout.columns[col] && layout.columns[col].pinned.some(p => p.id === filepath)) {
            existingCol = col;
        }
    });
    if (existingCol) {
        layout.setFocusedColumn(existingCol);
        if (typeof layout.setActiveProjection === 'function') {
            layout.setActiveProjection(existingCol, filepath);
        }
        return;
    }

    if (layout.windows && layout.windows.some(w => w.id === filepath)) {
        if (typeof layout.focusWindow === 'function') {
            layout.focusWindow(filepath);
        }
        return;
    }

    const entity = {
        id: filepath,
        component: 'insetu-editor-projection',
        label: safeLabel,
        extName: 'fs',
        targetParent: 'center'
    };

    if (layout.capacity === 1) {
        layout.openWindow(entity, layout.focusedColumn || 'center', 1);
    } else {
        layout.pinToColumn('center', entity);
        layout.setFocusedColumn('center');
        if (typeof layout.setActiveProjection === 'function') {
            layout.setActiveProjection('center', filepath);
        }
    }
}

export async function ensureFreshContext(filePath) {
    if (!filePath) return;
    const appState = AppStore.getState();
    const dirtyRepos = appState.dirtyRepos || new Set();
    const dirtyBuckets = appState.dirtyBuckets || new Set();

    const manifestObj = appState.manifest?.ctx?.[filePath];
    const addr = window.inSetu.utils.BucketAddress ? window.inSetu.utils.BucketAddress.fromFilepath(filePath, manifestObj?.meta) : null;

    const isDirty = (addr && addr.key && dirtyBuckets.has(addr.key)) || 
                    (addr && addr.repo && dirtyRepos.has(addr.repo)) ||
                    dirtyBuckets.has(filePath);

    if (isDirty) {
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus("⏳ Compiling fresh context...", null);
        }
        const targetRepos = (addr && addr.repo && addr.repo !== 'orphan') ? [addr.repo] : null;
        await window.inSetu.stores.Gather.getState().executeCompile(null, false, null, targetRepos);
        if (addr && addr.key) dirtyBuckets.delete(addr.key);
        if (addr && addr.repo) dirtyRepos.delete(addr.repo);
        dirtyBuckets.delete(filePath);
        AppStore.setState({ dirtyBuckets: new Set(dirtyBuckets), dirtyRepos: new Set(dirtyRepos) });
    }
}

export async function fetchAndCopy(filePath, explicitUrl = null) {
    try {
        await ensureFreshContext(filePath);
        let res;
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const fetchUrl = explicitUrl || resolveFileFetchUrl(filePath, true);
        res = await window.inSetu.api.request(fetchUrl, {}, activeWs);

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
        const fetchUrl = explicitUrl || resolveFileFetchUrl(filePath);
        await downloadFile(fetchUrl, filePath.split('/').pop());
        window.inSetu.ui.setGlobalStatus("✅ Downloaded!", 2000);
    } catch (e) {
        window.inSetu.ui.setGlobalStatus("❌ Error: " + e.message, 3000, true);
    }
}
export function shareFiles(baseFile, chunks = null, isFS = false) {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const filesToFetch = (chunks && chunks.length > 1) ? chunks : [baseFile];

    // Synchronous Fast-Path
    if (filesToFetch.every(fp => window.inSetu.vfs.shareTextCache.has(fp))) {
        try {
            const fileObjects = filesToFetch.map(filepath => ({
                content: window.inSetu.vfs.shareTextCache.get(filepath),
                filename: filepath.split('/').pop()
            }));

            window.inSetu.utils.nativeShareFiles(fileObjects).catch(err => {
                if (err.name !== 'AbortError' && window.inSetu?.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`❌ Share Error: ${err.message}`, 3000, true);
                }
            });
            return;
        } catch (err) {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ Share Error: ${err.message}`, 3000, true);
            return;
        }
    }
    // Asynchronous Pre-Warm Fallback
    (async () => {
        try {
            const fileObjects = [];

            for (const filepath of filesToFetch) {
                const fileIsFS = (chunks && chunks.length > 1) ? false : isFS;
                const fetchUrl = resolveFileFetchUrl(filepath, fileIsFS);

                const textContent = await window.inSetu.api.fetchImmutableText(fetchUrl, { onlyIfMissing: true }, activeWs);
                window.inSetu.vfs.shareTextCache.set(filepath, textContent);

                fileObjects.push({
                    content: textContent,
                    filename: filepath.split('/').pop()
                });
            }

            try {
                await window.inSetu.utils.nativeShareFiles(fileObjects);
            } catch (err) {
                if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('activation')) {
                    if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚠️ Files ready. Please click Share again.", 4000);
                    return;
                }
                throw err;
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ Share Error: ${err.message}`, 3000, true);
        }
    })();
}
export async function downloadFile(fetchUrl, fallbackFilename, fetchOptions = {}) {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const res = await window.inSetu.api.request(fetchUrl, fetchOptions, activeWs);
    if (!res.ok) throw new Error('Download failed from server.');
    const blob = await res.blob();

    let dlName = fallbackFilename;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) dlName = matches[1].replace(/['"]/g, '');
    }

    downloadBlob(blob, dlName);
}
export async function viewInWindow(filename) {
    await ensureFreshContext(filename);
    const chunks = getChunks(filename);
    const targetFile = (chunks && chunks.length > 0 && !chunks.includes(filename)) ? chunks[0] : filename;

    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(targetFile);
    FsStore.getState().openBuffer(targetFile, {
        filename: targetFile,
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
    });

    routeToSpatialGrid(targetFile);
    closeBrowseModal();

    try {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const res = await window.inSetu.api.request(`/download/${encodeURIComponent(targetFile)}`, {}, activeWs);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToBuffer(targetFile, text, isSupportedEditor, isMarkdown, false);
    } catch (e) {
        injectTextToBuffer(targetFile, "Error loading file content.", isSupportedEditor, isMarkdown, false);
    }
}
export async function viewAndCopy(filename) {
    await ensureFreshContext(filename);
    const chunks = getChunks(filename);
    // If the requested filename is explicitly a known chunk, respect it. Otherwise default to the first chunk of the payload.
    const targetFile = (chunks && chunks.length > 0 && !chunks.includes(filename)) ? chunks[0] : filename;

    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(targetFile);
    const browserState = AppStore.getState().browserConfig;
    const isParts = browserState && browserState.isParts;
    FsStore.getState().openBuffer(targetFile, {
        filename: targetFile,
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
    });

    routeToSpatialGrid(targetFile);

    if (!isParts) {
        closeBrowseModal();
    }
    try {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const res = await window.inSetu.api.request(`/download/${encodeURIComponent(targetFile)}`, {}, activeWs);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToBuffer(targetFile, text, isSupportedEditor, isMarkdown, false);
    } catch (e) {
        injectTextToBuffer(targetFile, "Error loading file content.", isSupportedEditor, isMarkdown, false);
    }
}
function refreshActiveFileViews(oldPath, newPath = null) {
    const mutations = [{ filepath: oldPath, operation: 'delete' }];
    if (newPath) mutations.push({ filepath: newPath, operation: 'save' });

    if (oldPath) AppStore.getState().setResolvingLock(oldPath, newPath ? 'move_source' : 'delete');
    if (newPath) AppStore.getState().setResolvingLock(newPath, oldPath ? 'move_dest' : 'create');

    window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations });
}
export function updateManifestState(mutations) {
    const { manifest } = AppStore.getState();
    let changed = false;
    const newManifest = { vfs: { ...(manifest?.vfs || {}) }, ctx: { ...(manifest?.ctx || {}) } };
    const cleanPath = (p) => p ? p.replace(/^vfs:\/\//, '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/^\.\//, '') : '';

    // Detect move/rename logic directly from the payload
    let moveSource = null;
    let moveDest = null;
    if (mutations.length === 2) {
        const delMut = mutations.find(m => m.operation === 'delete');
        const savMut = mutations.find(m => m.operation === 'save');
        if (delMut && savMut) {
            moveSource = cleanPath(delMut.filepath);
            moveDest = cleanPath(savMut.filepath);
        }
    }
    (mutations || []).forEach(m => {
        const normPath = cleanPath(m.filepath);
        if (!normPath) return;

        // Centralized Cache Invalidation
        if (window.inSetu?.vfs?.shareTextCache?.has(m.filepath)) {
            window.inSetu.vfs.shareTextCache.delete(m.filepath);
        }

        if (m.operation === 'delete') {
            ['vfs', 'ctx'].forEach(manifestKey => {
                Object.keys(newManifest[manifestKey]).forEach(key => {
                    const obj = newManifest[manifestKey][key];
                    if (obj.files) {
                        const origLen = obj.files.length;
                        const newFiles = [];
                        obj.files.forEach(f => {
                            const fClean = cleanPath(f);
                            if (fClean === normPath) {
                                if (moveDest && !newFiles.includes(moveDest)) newFiles.push(moveDest);
                                changed = true;
                            } else if (fClean.startsWith(normPath + '/')) {
                                if (moveDest) {
                                    const newChild = moveDest + fClean.substring(normPath.length);
                                    if (!newFiles.includes(newChild)) newFiles.push(newChild);
                                }
                                changed = true;
                            } else {
                                newFiles.push(f);
                            }
                        });
                        if (newFiles.length !== origLen || changed) {
                            newManifest[manifestKey][key] = { ...obj, files: newFiles };
                        }
                    }
                });
            });
            if (newManifest.ctx[normPath]) {
                if (moveDest) newManifest.ctx[moveDest] = newManifest.ctx[normPath];
                delete newManifest.ctx[normPath];
                changed = true;
            }
        } else if (m.operation === 'save') {
            if (moveSource) return;

            const alreadyInManifest = Object.values(newManifest.vfs).some(obj => obj.files && obj.files.some(f => cleanPath(f) === normPath));
            if (!alreadyInManifest) {
                const repoDir = normPath.split('/')[0] || 'global';
                let added = false;
                for (const key of Object.keys(newManifest.vfs)) {
                    if (key.startsWith(repoDir + '::')) {
                        newManifest.vfs[key] = {
                            ...newManifest.vfs[key],
                            files: [...(newManifest.vfs[key].files || []), normPath]
                        };
                        changed = true;
                        added = true;
                        break;
                    }
                }
                if (!added) {
                    const firstKey = Object.keys(newManifest.vfs)[0] || `${repoDir}::main`;
                    newManifest.vfs[firstKey] = {
                        ...newManifest.vfs[firstKey],
                        meta: newManifest.vfs[firstKey]?.meta || { type: "vfs_bucket", repo: repoDir, bucket_id: "main" },
                        files: [...(newManifest.vfs[firstKey]?.files || []), normPath]
                    };
                    changed = true;
                }
            }
        }
    });

    if (changed) {
        AppStore.setState({ manifest: newManifest });
    }
}
window.addEventListener('insetu:vfs-mutated', (e) => {
    const payload = e.detail;
    if (payload && payload.mutations) {
        updateManifestState(payload.mutations);
    }
});
export async function saveBufferFile(filepath, autoSave = false) {
    if (autoSave !== true) autoSave = false;
    const normPath = normalizeVfsURI(filepath);
    const state = FsStore.getState().activeBuffers[normPath] || FsStore.getState().activeBuffers[filepath];
    if (!state) return;

    let content = state.content.replace(/\u00A0/g, ' ');
    if (state.filename.toLowerCase().endsWith('.json')) {
        try { JSON.parse(content); } catch (e) { return alert("Invalid JSON syntax: " + e.message); }
    }
    await window.inSetu.sys.executeWorkspaceMutation('fs/save', { filepath: normPath, content }, {
        collapseKey: `vfs:save:${normPath}`,
        pendingMutations: [normPath],
        cacheBlobUrl: `/api/${window.inSetu.utils.getActiveWorkspace()}/fs/fetch?file=${encodeURIComponent(normPath)}`,
        cacheBlobContent: content,
        loadingText: 'Saving...',
        silent: autoSave,
        onSuccess: () => {
            FsStore.getState().updateBuffer(normPath, { originalContent: content, content });
            refreshActiveFileViews(null, normPath);
        }
    });
}
export function renameFileTracking(oldPath, newPath) {
    const normOld = normalizeVfsURI(oldPath);
    const normNew = normalizeVfsURI(newPath);

    const fsState = window.inSetu.stores.Fs.getState();
    const oldBuf = fsState.activeBuffers[normOld] || fsState.activeBuffers[oldPath];
    if (oldBuf) {
        fsState.openBuffer(normNew, { ...oldBuf, filename: normNew });
        fsState.closeBuffer(normOld);
        if (oldPath !== normOld) fsState.closeBuffer(oldPath);
    }

    const layoutStore = window.Sutram?.stores?.Layout;
    if (layoutStore) {
        const layout = layoutStore.getState();
        const newCols = JSON.parse(JSON.stringify(layout.columns));
        let changed = false;

        ['left', 'center', 'right'].forEach(col => {
            const colState = newCols[col];
            if (colState && colState.pinned) {
                colState.pinned = colState.pinned.map(p => {
                    const normPId = normalizeVfsURI(p.id);
                    if (p.id === oldPath || normPId === normOld) {
                        changed = true;
                        return { ...p, id: normNew, label: normNew.split('/').pop() };
                    }
                    return p;
                });
                if (colState.active === oldPath || (colState.active && normalizeVfsURI(colState.active) === normOld)) {
                    colState.active = normNew;
                    changed = true;
                }
            }
        });

        const newWindows = (layout.windows || []).map(w => {
            const normWId = normalizeVfsURI(w.id);
            if (w.id === oldPath || normWId === normOld) {
                changed = true;
                return { ...w, id: normNew, label: normNew.split('/').pop(), titleText: normNew.split('/').pop() };
            }
            return w;
        });

        if (changed) {
            layoutStore.setState({ columns: newCols, windows: newWindows });

            const activeWs = window.inSetu.utils.getActiveWorkspace();
            const focused = layout.focusedColumn || 'center';
            if (newCols[focused] && newCols[focused].active === normNew) {
                const deepPath = window.inSetu.stores.App?.getState()?.tabBrowsePaths?.[normOld] || window.inSetu.stores.App?.getState()?.tabBrowsePaths?.[oldPath];
                const deepStr = deepPath && deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
                const hash = `#/${activeWs}/${focused}/${encodeURIComponent(normNew)}${deepStr}`;
                if (window.location.hash !== hash) {
                    window.history.replaceState(null, '', hash);
                }
            }
        }
    }
}

async function executeMove() {
    const { currentFile, destPath } = FsStore.getState().modals.move;
    if (!destPath || destPath === currentFile) return alert("Please enter a valid new destination path.");

    const normCurrent = normalizeVfsURI(currentFile);
    const normDest = normalizeVfsURI(destPath);

    const activeBuffers = FsStore.getState().activeBuffers || {};
    const buffer = activeBuffers[normCurrent] || activeBuffers[currentFile];
    if (buffer && buffer.isFS && buffer.content !== buffer.originalContent) {
        if (confirm(`"${normCurrent.split('/').pop()}" has unsaved changes. Save changes before moving?`)) {
            await window.inSetu.ui.saveBufferFile(buffer.filename);
        } else {
            return;
        }
    }

    await window.inSetu.sys.executeWorkspaceMutation('fs/move', { filepath: normCurrent, dest_path: normDest }, {
        collapseKey: `vfs:move:${normCurrent}`,
        pendingMutations: [normDest],
        deletedMutations: [normCurrent],
        loadingText: 'Moving...',
        onSuccess: () => {
            FsStore.getState().setModal('move', { open: false });
            renameFileTracking(normCurrent, normDest);
            refreshActiveFileViews(normCurrent, normDest);
        }
    });
}
export async function deleteEmptyFolder(dirPath) {
    if (!confirm(`Are you sure you want to delete the empty folder /${dirPath}?`)) return;
    const normPath = normalizeVfsURI(dirPath);
    await window.inSetu.sys.executeWorkspaceMutation('fs/delete', { filepath: normPath }, {
        collapseKey: `vfs:delete:${normPath}`,
        deletedMutations: [normPath],
        onSuccess: () => {
            const parts = dirPath.split('/');
            parts.pop();
            AppStore.setState({ globalBrowsePath: parts });
            refreshActiveFileViews(normPath, null);
        }
    });
}
export function createFileCard(fileInfo, container) {
    const card = document.createElement('sutram-card');
    card.filename = fileInfo.filename;
    card.titleText = fileInfo.displayName || fileInfo.filename;
    card.descriptionText = fileInfo.description || '';
    card.detailText = fileInfo.sizeStr ? `${fileInfo.filename} | ${fileInfo.sizeStr}` : fileInfo.filename;
    card.icon = fileInfo.isSource ? 'file-code-2' : 'package';
    card.intent = fileInfo.isSource ? 'primary' : 'highlight';

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
    const targetConfigs = state.targetConfigs || [];
    const validPrefixes = targetConfigs.map(cfg => cfg.repo_dir ? cfg.repo_dir + '/' : '');

    // Query Stage 1 (vfs) EXCLUSIVELY for physical workspace files
    const vfsManifest = state.manifest?.vfs || {};

    const allFiles = Array.from(new Set([
        ...Object.values(vfsManifest).flatMap(obj => obj.files || [])
    ]));
    // Let extensions inject their own system artifacts (e.g. Prompts)
    const extensionFiles = window.inSetu.events.emitHook('insetu:global-manifest-files') || [];
    extensionFiles.forEach(extFiles => {
        if (Array.isArray(extFiles)) {
            extFiles.forEach(f => allFiles.push(f));
        }
    });

    const whitelists = window.inSetu.events.emitHook('insetu:global-manifest-whitelist') || [];
    const allowedPrefixes = [].concat(...whitelists.filter(w => Array.isArray(w)));

    // Explicitly whitelist extensions via hook to avoid opening the entire OS control plane
    const isAllowed = (f) => {
        if (allowedPrefixes.some(p => f.startsWith(p))) return true;
        if (validPrefixes.length === 0) return true;
        return validPrefixes.some(prefix => f.startsWith(prefix));
    };

    return allFiles.filter(isAllowed);
};
export class InSetuVFSExplorer extends InSetuElement {
        static properties = {
                searchQuery: { type: String },
                manifestFiles: { type: Array },
                globalBrowsePath: { type: Array },
                loading: { type: Boolean }
        };
        static styles = [sharedStyles, css`
                :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
                .vfs-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 0; }
        `];
        constructor() {
                super();
                this.searchQuery = '';
                this.manifestFiles = [];
                this.globalBrowsePath = [];
                this.loading = false;
        }
        _updateState(state) {
                const allFiles = new Set();
                const targetConfigs = state.targetConfigs || [];
                // UDF Guardrail: Only show files that belong to explicitly tracked repository targets
                // This prevents OS artifact directories (contexts/, diffs/) from leaking into the visual root
                const validPrefixes = targetConfigs.map(cfg => cfg.repo_dir ? cfg.repo_dir + '/' : '');

                const vfsManifest = state.manifest?.vfs || {};

                Object.values(vfsManifest).forEach(obj => {
                    if (obj.files) {
                        obj.files.forEach(f => {
                            if (validPrefixes.length === 0 || validPrefixes.some(prefix => f.startsWith(prefix))) {
                                allFiles.add(f);
                            }
                        });
                    }
                });

                if (targetConfigs) {
                        targetConfigs.forEach(cfg => {
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
                this.registerGlobalListener('sutram-sync-complete', window, () => {
                    if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                        window.inSetu.sys.refreshManifest();
                    }
                });

                // Trigger initial read
                this._updateState(AppStore.getState());
                this.searchQuery = FsStore.getState().searchQuery || '';
        }
        disconnectedCallback() {
                super.disconnectedCallback();
        }
        async onForceRefresh() {
                if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                        this.loading = true;
                        await window.inSetu.sys.refreshManifest();
                        this.loading = false;
                }
        }
        async onWorkspaceLoad(workspaceId) {
                if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                        this.loading = true;
                        await window.inSetu.sys.refreshManifest();
                        this.loading = false;
                }
        }

        _handlePathChange(e) {
                AppStore.setState({ globalBrowsePath: e.detail.path });
        }
        render() {
            if (this.manifestFiles.length === 0 && !this.loading) {
                return html`<p style="padding: 15px; color: var(--text-muted);">No repositories configured.</p>`;
            }
            return html`
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative;">
                    ${this.loading ? html`<div style="padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--input-bg); flex-shrink: 0;"><sutram-spinner text="Refreshing file system..."></sutram-spinner></div>` : ''}
                    <insetu-file-tree    
                        style="flex: 1; opacity: ${this.loading ? '0.6' : '1'}; transition: opacity 0.2s ease; pointer-events: ${this.loading ? 'none' : 'auto'};"
                        @card-clicked=${(e) => { if(e.detail.isSource && window.inSetu.vfs.viewSourceFile) window.inSetu.vfs.viewSourceFile(e.detail.filename, true); }}
                        basePath=""
                        .files=${this.manifestFiles}
                        .currentPath=${this.globalBrowsePath}
                        .hidePath=${false}
                        .enableSearch=${true}
                        searchPlaceholder="Fuzzy search files..."
                        entityType="file"
                        @path-changed=${this._handlePathChange}>
                    </insetu-file-tree>
                </div>
            `;
        }
}
customElements.define('insetu-vfs-explorer', InSetuVFSExplorer);
export class InSetuVFSExplorerActions extends InSetuElement {
    static properties = {
        globalBrowsePath: { type: Array },
        _menuItems: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
    `];

    constructor() {
        super();
        this.globalBrowsePath = [];
        this._menuItems = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, state => {
            this.globalBrowsePath = state.globalBrowsePath || [];
            this._rebuildMenu();
        });
        this.globalBrowsePath = AppStore.getState().globalBrowsePath || [];
        this._rebuildMenu();
    }
    _rebuildMenu() {
        const currentPath = this.globalBrowsePath.join('/');
        const items = [];
        if (!currentPath) {
            items.push({ label: 'New Repository', icon: 'package', onClick: () => openNewFolderModal() });
        } else {
            const prefix = currentPath + '/';
            items.push({ label: 'New Folder', icon: 'folder-plus', onClick: () => openNewFolderModal(prefix) });
            items.push({ label: 'New File', icon: 'file-plus', onClick: () => openNewFileModal(prefix) });
            items.push({ label: 'Upload File', icon: 'upload', onClick: () => uploadFileToWorkspace(currentPath) });

            const manifestFiles = getGlobalManifest();
            const prefixWithSlash = currentPath + '/';
            const hasFiles = manifestFiles.some(f => f.startsWith(prefixWithSlash) && !f.endsWith('.gitkeep'));
            if (!hasFiles) {
                items.push({ divider: true });
                items.push({ label: 'Delete Folder', icon: 'trash-2', onClick: () => deleteEmptyFolder(currentPath) });
            }
        }
        window.inSetu.events.emitHook('insetu:fs-dropdown-menu', { currentPath, menuItems: items });
        this._menuItems = items;
    }

    render() {
        return html`
            <sutram-dropdown align="right" .items=${this._menuItems} style="height: 100%; display: flex; align-items: stretch;">
                <button slot="trigger" class="system-action-btn" title="Actions" style="border: none; border-left: 1px solid var(--border); border-radius: 0; height: 100%; width: 44px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                    <yv-icon name="menu" style="width: 14px; height: 14px;"></yv-icon>
                </button>
            </sutram-dropdown>
        `;
    }
}
customElements.define('insetu-vfs-explorer-actions', InSetuVFSExplorerActions);
window.ExtensionRegistry.registerExtension('fs', {
    name: "Virtual File System",
    version: "2.0.0",
    offline_mode: "full",
    shortcuts: [
        {
            id: 'new-file-modal-save',
            context: 'modal:new-file-modal',
            key: 'ctrl+s',
            label: 'Save New File',
            action: () => window.inSetu.ui.saveNewFile && window.inSetu.ui.saveNewFile()
        }
    ],
    entityActions: [
        {
            targetEntity: 'file',
            id: 'file-move',
            label: 'Move',
            icon: 'truck',
            group: 'file',
            vfsBound: true,
            intent: 'neutral',
            order: 64,
            match: (data) => data.isFS && !data.isSkeleton,
            onClick: (data, e) => {
                const parts = data.filepath ? data.filepath.split('/').filter(p => p) : [];
                parts.pop();
                window.inSetu.stores.Fs.getState().setModal('move', { open: true, currentFile: data.filepath, destPath: data.filepath, initialParts: parts });
            }
        },
        {
            targetEntity: 'file',
            id: 'file-rename',
            label: 'Rename',
            icon: 'edit-3',
            group: 'file',
            vfsBound: true,
            intent: 'neutral',
            order: 65,
            match: (data) => data.isFS && !data.isSkeleton,
            asyncAction: async (data, e) => {
                const currentName = data.filepath.split('/').pop();
                const newName = prompt("Enter new filename:", currentName);
                if (!newName || newName === currentName) return;
                const parts = data.filepath.split('/');
                parts.pop();
                const destPath = parts.length > 0 ? parts.join('/') + '/' + newName : newName;
                await window.inSetu.sys.executeWorkspaceMutation('fs/move', { filepath: data.filepath, dest_path: destPath }, {
                    collapseKey: `vfs:move:${data.filepath}`,
                    pendingMutations: [destPath],
                    deletedMutations: [data.filepath],
                    loadingText: 'Renaming...',
                    onSuccess: () => {
                        renameFileTracking(data.filepath, destPath);
                        window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: [{ filepath: data.filepath, operation: 'delete' }, { filepath: destPath, operation: 'save' }] });
                    }
                });
            }
        },
        {
            targetEntity: 'file',
            id: 'file-archive',
            label: 'Archive',
            icon: 'archive',
            group: 'file',
            vfsBound: true,
            intent: 'warning',
            order: 66,
            match: (data) => data.isFS && !data.isSkeleton,
            asyncAction: async (data, e) => {
                if (!confirm("Archive this file to an 'archived/' subdirectory?")) return;
                const normPath = normalizeVfsURI(data.filepath);
                await window.inSetu.sys.executeWorkspaceMutation('fs/archive', { filepath: normPath }, {
                    collapseKey: `vfs:archive:${normPath}`,
                    deletedMutations: [normPath],
                    onSuccess: (resData) => {
                        renameFileTracking(normPath, resData.new_path);
                        window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: [{ filepath: normPath, operation: 'delete' }, { filepath: resData.new_path, operation: 'save' }] });
                    }
                });
            }
        },
        {
            targetEntity: 'file',
            id: 'file-delete',
            label: 'Delete',
            icon: 'trash-2',
            group: 'file',
            vfsBound: true,
            intent: 'danger',
            order: 67,
            match: (data) => data.isFS && !data.isSkeleton,
            asyncAction: async (data, e) => {
                if (!confirm("Permanently delete this file? This cannot be undone!")) return;
                const normPath = normalizeVfsURI(data.filepath);
                await window.inSetu.sys.executeWorkspaceMutation('fs/delete', { filepath: normPath }, {
                    collapseKey: `vfs:delete:${normPath}`,
                    deletedMutations: [normPath],
                    onSuccess: () => {
                        window.inSetu.stores.Fs.getState().closeBuffer(normPath);
                        if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().evictProjection(normPath);
                        window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: [{ filepath: normPath, operation: 'delete' }] });
                    }
                });
            }
        },
        {
            targetEntity: 'file',
            id: 'file-edit',
            label: 'Edit',
            icon: 'edit-3',
            group: 'edit',
            vfsBound: false,
            intent: 'neutral',
            order: 10,
            match: (data) => !data.isSkeleton,
            onClick: (data, e) => {
                if (window.inSetu.vfs.viewSourceFile) {
                    window.inSetu.vfs.viewSourceFile(data.filepath, data.isFS || false);
                }
            }
        },
        {
            targetEntity: 'file',
            id: 'file-copy',
            label: 'Copy',
            icon: 'clipboard',
            group: 'edit',
            vfsBound: false,
            intent: 'success',
            order: 12,
            match: (data) => !data.isSkeleton,
            asyncAction: async (data, e) => {
                if (data.getTransientState) {
                    const text = data.getTransientState();
                    await navigator.clipboard.writeText(text).then(() => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
                    }).catch(err => alert("Clipboard API failed. Please manually select the text and copy it directly."));
                    return;
                }
                const fetchUrl = resolveFileFetchUrl(data.filepath, data.isFS);
                await fetchAndCopy(data.filepath, fetchUrl);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-browse',
            label: 'Browse',
            icon: 'folder',
            group: 'tools',
            vfsBound: false,
            intent: 'neutral',
            order: 14,
            match: (data) => {
                if (data.isSkeleton) return false;
                return data.filepath && (data.filepath.startsWith('ctx://') || data.filepath.endsWith('_context.txt') || data.filepath.endsWith('_diffs.txt'));
            },
            onClick: (data, e) => {
                if (window.inSetu.ui.openBrowseModal) window.inSetu.ui.openBrowseModal(data.filepath);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-share',
            label: 'Share',
            icon: 'share',
            group: 'share',
            vfsBound: false,
            intent: 'primary',
            order: 15,
            match: (data) => {
                if (data.isSkeleton) return false;
                return !!navigator.share && !!navigator.canShare;
            },
            onReveal: (data) => {
                if (data.getTransientState) return;
                window.inSetu.vfs.shareTextCache.clear();
                const chunks = data.chunks && data.chunks.length > 0 ? data.chunks : window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, data.filepath);
                const filesToFetch = (chunks && chunks.length > 1) ? chunks : [data.filepath];
                filesToFetch.forEach(filepath => {
                    const fileIsFS = (chunks && chunks.length > 1) ? false : data.isFS;
                    const fetchUrl = resolveFileFetchUrl(filepath, fileIsFS);
                    const activeWs = window.inSetu.utils.getActiveWorkspace();

                    window.inSetu.api.fetchImmutableText(fetchUrl, { onlyIfMissing: true }, activeWs)
                        .then(textContent => window.inSetu.vfs.shareTextCache.set(filepath, textContent))
                        .catch(() => {});
                });
            },
            onClick: (data, e) => {
                if (e) e.stopPropagation();
                if (data.getTransientState) {
                    const text = data.getTransientState();
                    const filename = data.filepath ? data.filepath.split('/').pop() : 'shared_file.txt';
                    window.inSetu.utils.nativeShareFiles([{ content: text || '', filename }]).catch(()=>{});
                    return;
                }
                const chunks = data.chunks && data.chunks.length > 0 ? data.chunks : window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, data.filepath);
                shareFiles(data.filepath, chunks, data.isFS);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-view-parts',
            label: 'View Parts',
            icon: 'puzzle',
            group: 'tools',
            vfsBound: false,
            intent: 'neutral',
            order: 105,
            match: (data) => {
                if (data.isSkeleton) return false;
                // Fast-path: Utilize the pre-computed chunks array passed by the UI cards
                const chunks = data.chunks && data.chunks.length > 0 ? data.chunks : window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, data.filepath);
                return chunks && chunks.length > 1;
            },
            onClick: (data, e) => {
                window.dispatchEvent(new CustomEvent('insetu:vfs:view-parts', { detail: { filepath: data.filepath } }));
            }
        },
        {
            targetEntity: 'file',
            id: 'file-download',
            label: 'Download',
            icon: 'download',
            group: 'file',
            vfsBound: false,
            intent: 'primary',
            order: 18,
            match: (data) => !data.isSkeleton,
            asyncAction: async (data, e) => {
                if (data.getTransientState && (!data.chunks || data.chunks.length <= 1)) {
                    try {
                        let text = data.getTransientState();
                        const blob = new Blob([text], { type: 'text/plain' });
                        downloadBlob(blob, data.filepath.split('/').pop());
                        return;
                    } catch (e) {
                        alert("Error downloading file: " + e.message);
                        return;
                    }
                }

                const chunks = data.chunks && data.chunks.length > 0 ? data.chunks : window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, data.filepath);
                if (chunks && chunks.length > 1) {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⬇️ Downloading multi-part context...", 2000);
                    for (const f of chunks) {
                        const fetchUrl = `/download/${encodeURIComponent(f)}`;
                        await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                        await new Promise(r => setTimeout(r, 300));
                    }
                } else {
                    const fetchUrl = resolveFileFetchUrl(data.filepath, data.isFS);
                    await window.inSetu.vfs.fetchAndDownloadState(data.filepath, fetchUrl);
                }
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "files",
            label: "Files",
            icon: "folder-tree",
            intent: "neutral",
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
        const targetConfigs = AppStore.getState().targetConfigs || [];
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
    const rawFilepath = basePath + fileName;
    const normPath = normalizeVfsURI(rawFilepath);
    const hookRes = await window.inSetu.events.emitHook('insetu:pre-save-new-file', { fileName, content, filepath: normPath });
    if (Array.isArray(hookRes) && hookRes.length > 0 && typeof hookRes[0] === 'string') {
        content = hookRes[0];
    }
    await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
        filepath: normPath,
        content
    }, {
        collapseKey: `vfs:save:${normPath}`,
        pendingMutations: [normPath],
        cacheBlobUrl: `/api/${window.inSetu.utils.getActiveWorkspace()}/fs/fetch?file=${encodeURIComponent(normPath)}`,
        cacheBlobContent: content,
        loadingText: 'Saving...',
        onSuccess: async () => {
            FsStore.getState().setModal('newFile', { open: false });
            refreshActiveFileViews(null, normPath);
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
            const res = await window.inSetu.api.workspace.get('gather/repos/template');
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
        collapseKey: `vfs:save:${filepath}`,
        pendingMutations: [filepath],
        loadingText: "Creating...",
        onSuccess: async () => {
            if (isNewRepo) {
                const rRes = await window.inSetu.api.system.get('topology?t=' + Date.now());
                if (rRes.ok) {
                    const d = await rRes.json();
                    AppStore.setState({ allRepos: d.repos, targetConfigs: d.target_repos || [] });
                }
            }
            FsStore.getState().setModal('newFolder', { open: false });
            refreshActiveFileViews(null, filepath);
        }
    });
}
export async function viewSourceFile(filepath, isFS = false, bypassHook = false) {
    if (!filepath || typeof filepath !== 'string') return;
    const normPath = normalizeVfsURI(filepath);
    if (!normPath) return;

    if (!bypassHook) {
        // ADR 0041: Declarative Custom Editors Engine
        const registry = window.ExtensionRegistry;
        if (registry && registry._manifests) {
            let intercepted = false;
            for (const manifest of registry._manifests.values()) {
                if (manifest.customEditors) {
                    for (const editor of manifest.customEditors) {
                        if (editor.match && editor.match(normPath)) {
                            if (editor.onOpen) editor.onOpen(normPath);
                            intercepted = true;
                            break;
                        }
                    }
                }
                if (intercepted) break;
            }
            if (intercepted) return;
        }
    }
    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(normPath);
    FsStore.getState().openBuffer(normPath, {
        filename: normPath,
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
    });

    routeToSpatialGrid(normPath);
    closeBrowseModal();
    try {
        let text = null;
        try {
            const res = await window.inSetu.api.workspace.get(`fs/fetch?file=${encodeURIComponent(normPath)}`);
            if (res.ok) text = await res.text();
        } catch (e) {
            // Network or cache miss, proceed to outbox rescue
        }

        // Always check the outbox for pending writes to prevent stale cache reads offline
        const outbox = window.inSetu?.stores?.Offline?.getState()?.outboxItems || [];
        let pendingContent = undefined;
        [...outbox].reverse().find(i => {
            if (i.method === 'POST' && i.path.endsWith('fs/save')) {
                try {
                    const payload = i.bodyString ? JSON.parse(i.bodyString) : (i.payload || {});
                    const normPayloadFp = normalizeVfsURI(payload.filepath || '');
                    if (normPayloadFp === normPath && payload.content !== undefined) {
                        pendingContent = payload.content;
                        return true;
                    }
                } catch(e) {}
            }
            return false;
        });

        if (pendingContent !== undefined) {
            text = pendingContent;
        } else if (text === null) {
            throw new Error("Failed to fetch");
        }

        injectTextToBuffer(normPath, text, isSupportedEditor, isMarkdown, isFS);
    } catch (e) {
        injectTextToBuffer(normPath, "Error loading file content.", isSupportedEditor, isMarkdown, isFS);
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
        autoDrilldown = false,
        isParts = false
    } = options;
    AppStore.setState({ browserConfig: { mode, callback, isParts, title } });

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
    FsStore.getState().setModal('browser', { open: true, title, manifest: targetManifest, searchQuery: '', isParts });
}
function _handleBrowserCardClick(detail) {
    const { browserConfig } = AppStore.getState();
    if (browserConfig && browserConfig.mode === 'file') {
        if (browserConfig.callback) browserConfig.callback(detail.filename);
        closeBrowseModal();
    } else if (browserConfig && browserConfig.mode === 'view') {
        if (detail.isSource && window.inSetu.vfs.viewSourceFile) {
            window.inSetu.vfs.viewSourceFile(detail.filename, true);
        } else if (window.inSetu.vfs.viewAndCopy) {
            window.inSetu.vfs.viewAndCopy(detail.filename);
        }
    }
};

export function openFolderBrowser(callback = null) {
    openWorkspaceBrowser({ mode: 'folder', title: 'Select Destination Folder', callback: callback });
}
function confirmFolderSelection() {
    const { currentBrowsePath, browserConfig } = AppStore.getState();
    const selectedPath = (currentBrowsePath || []).join('/');
    if (browserConfig && browserConfig.callback) {
        const finalPath = selectedPath ? (selectedPath.endsWith('/') ? selectedPath : selectedPath + '/') : '/';
        browserConfig.callback(finalPath);
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
    const manifest = AppStore.getState().manifest || {};
    const ctxManifest = manifest.ctx || {};
    const files = (ctxManifest[contextFilename] && ctxManifest[contextFilename].files) ? ctxManifest[contextFilename].files : [];
    openWorkspaceBrowser({
        mode: 'view',
        title: `Browsing: ${contextFilename}`,
        files: files,
        autoDrilldown: true
    });
}

export function openVirtualFile(filename, content) {
    const virtualUri = `virtual://${filename}`;
    FsStore.getState().openBuffer(virtualUri, {
        filename: virtualUri,
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
    });

    routeToSpatialGrid(virtualUri, filename);
    closeBrowseModal();
    injectTextToBuffer(virtualUri, content, true, true, false, true);
}
export class InSetuEditorProjection extends InSetuElement {
    static properties = {
        filepath: { type: String },
        _buffer: { type: Object },
        _writingMode: { type: Boolean },
        _editorFocused: { type: Boolean },
        zenMode: { type: Boolean, reflect: true, attribute: 'zen-mode' }
    };

    static styles = [sharedStyles, css`
        :host([zen-mode]) {
            position: fixed !important; inset: 0 !important;
            width: 100% !important; height: 100% !important;
            z-index: 99999 !important; background: var(--bg-deep, #05070a) !important;
            margin: 0 !important; max-width: none !important; max-height: none !important;
            border: none !important; padding: 0 !important; box-sizing: border-box !important;
        }
        .zen-exit-btn {
            position: fixed; top: 20px; right: 20px; z-index: 100000;
            background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); border-radius: 50%;
            width: 44px; height: 44px; display: none; align-items: center; justify-content: center;
            cursor: pointer; opacity: 0.1; transition: opacity 0.3s ease, color 0.3s ease;
            pointer-events: auto;
        }
        @media (hover: none) {
            .zen-exit-btn { opacity: 0.6; }
        }
        :host([zen-mode]) .zen-exit-btn { display: flex; }
        :host([zen-mode]) .zen-exit-btn:hover { opacity: 1; color: var(--intent-danger); border-color: var(--intent-danger); }
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; background: var(--bg); overflow: hidden; }
        .editor-header {
            display: flex; justify-content: flex-end; align-items: center; 
            padding: 8px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .editor-footer {
            padding: 10px 15px; gap: 10px; border-top: 1px solid var(--border); 
            background: var(--input-bg); display: flex; flex-shrink: 0; width: 100%; box-sizing: border-box;
        }
        .zen-reveal-btn {
            position: absolute; bottom: 12px; right: 20px; z-index: 101;
            background: var(--intent-primary); color: white; border: none; border-radius: 50%;
            width: 44px; height: 44px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
            cursor: pointer; opacity: 0; visibility: hidden; pointer-events: none;
            transition: opacity 0.3s ease, visibility 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        :host([is-focused]) .zen-reveal-btn { opacity: 0.5; visibility: visible; pointer-events: auto; }
        :host([is-focused]) .zen-reveal-btn:hover { opacity: 1; }
    `];
    constructor() {
        super();
        this.filepath = '';
        this._buffer = null;
        this._writingMode = false;
        this._editorFocused = false;
        this.zenMode = false;
        this._transientCursorPos = 0;
        this._transientScrollTop = 0;
    }

    async _toggleWritingMode() {
        this._writingMode = !this._writingMode;
        if (this._buffer && this._buffer.isFS) {
            try {
                await window.inSetu.api.workspace.post('editor/preference', {
                    filepath: this.filepath,
                    writing_mode: this._writingMode
                });
            } catch(e) {}
        }
    }
    async _toggleZenMode() {
        this.zenMode = !this.zenMode;
        if (this.zenMode) {
            if (typeof this.showPopover === 'function') {
                this.setAttribute('popover', 'manual');
                try { this.showPopover(); } catch(e) {}
            }
            try {
                if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
                else if (document.documentElement.webkitRequestFullscreen) await document.documentElement.webkitRequestFullscreen();
            } catch(e) {}
            this._escListener = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this._toggleZenMode();
                }
            };
            window.addEventListener('keydown', this._escListener);
        } else {
            if (typeof this.hidePopover === 'function') {
                if (this.matches(':popover-open')) {
                    try { this.hidePopover(); } catch(e) {}
                }
                this.removeAttribute('popover');
            }
            try {
                if (document.exitFullscreen && document.fullscreenElement) await document.exitFullscreen();
                else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
            } catch(e) {}
            if (this._escListener) {
                window.removeEventListener('keydown', this._escListener);
                this._escListener = null;
            }
        }
    }
    connectedCallback() {
        super.connectedCallback();
        if (!this.filepath) this.filepath = this.dataset.subId; // Inherit identity from spatial viewport router
        this.subscribe('Fs', state => {
            this._buffer = state.activeBuffers[this.filepath] || null;
        });

        // Pointer Relaunch: Fetch the file from the VFS if the layout mounted this component but memory is empty
        setTimeout(() => {
            if (!this._buffer && this.filepath && !this.filepath.startsWith('yomama://') && !this.filepath.startsWith('virtual://')) {
                if (window.inSetu?.vfs?.viewSourceFile) {
                    const isPhysical = !this.filepath.startsWith('ctx://');
                    window.inSetu.vfs.viewSourceFile(this.filepath, isPhysical, true);
                }
            }
        }, 0);

        this.registerGlobalListener('insetu:editor-insert-text', window, (e) => {
            if (e.detail.filepath === this.filepath || e.detail.filepath === this.dataset.subId) {
                const m = this._buffer;
                if (!m) return;

                const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                const textarea = this.shadowRoot.querySelector('textarea');

                if (m.isSupportedEditor && cmEditor) {
                    cmEditor.insertAtCursor(e.detail.text);
                } else if (textarea) {
                    const insertPos = textarea.selectionStart;
                    const newContent = m.content.substring(0, insertPos) + e.detail.text + m.content.substring(insertPos);
                    const st = textarea.scrollTop;
                    textarea.value = newContent;
                    textarea.selectionStart = textarea.selectionEnd = insertPos + e.detail.text.length;
                    textarea.scrollTop = st;

                    window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: newContent });
                } else {
                    window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: m.content + "\n" + e.detail.text });
                }
            }
        });

        this._loadPreference(this.filepath);
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') && this.filepath) {
            this._buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[this.filepath] || null;
            this._loadPreference(this.filepath);

            if (this._buffer) {
                this._transientCursorPos = this._buffer.cursorPos || 0;
                this._transientScrollTop = this._buffer.scrollTop || 0;

                requestAnimationFrame(() => {
                    const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                    if (cmEditor) {
                        if (this._buffer.cursorPos !== undefined && cmEditor.setCursor) {
                            cmEditor.setCursor(this._buffer.cursorPos);
                        }
                        if (this._buffer.scrollTop !== undefined && cmEditor.setScrollInfo) {
                            cmEditor.setScrollInfo(this._buffer.scrollTop);
                        }
                    }
                });
            }
        }
    }

    get isDirty() {
        return this._buffer && this._buffer.isFS && this._buffer.content !== this._buffer.originalContent;
    }

    async _loadPreference(filename) {
        if (!filename) return;
        try {
            const res = await window.inSetu.api.workspace.get(`editor/preference?file=${encodeURIComponent(filename)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.writing_mode !== undefined && data.writing_mode !== null) {
                    this._writingMode = !!data.writing_mode;
                    return;
                }
            }
        } catch (e) {}
    }

    render() {
        if (!this._buffer) return html`<div class="spinner" style="display:block; padding: 20px;">Initializing buffer...</div>`;
        const m = this._buffer;
        const shouldBeReadOnly = !(m.isFS || m.forceEdit);
        const kbSize = Math.round((m.fullText?.length || 0) / 1024);

        return html`
            <div class="editor-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${m.isMarkdown ? html`
                        <button class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; padding: 4px 8px; font-weight: bold;" title="Toggle Prose Mode" @click=${() => this._toggleWritingMode()}>
                            <yv-icon name="${this._writingMode ? 'pen-tool' : 'code'}" style="width: 14px; height: 14px; pointer-events: none;"></yv-icon>
                        </button>
                    ` : ''}
                    <button class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; padding: 4px 8px; font-weight: bold;" title="Focus Mode" @click=${() => this._toggleZenMode()}>
                        <yv-icon name="maximize-2" style="width: 14px; height: 14px; pointer-events: none;"></yv-icon>
                    </button>
                    <sutram-entity-actions   
                        variant="menu-bar"
                        .entityType=${'file'} 
                        .entityData=${{ 
                            filepath: m.filename, 
                            isFS: m.isFS,
                            isSkeleton: false,
                            isDirty: this.isDirty,
                            getTransientState: () => this._buffer.content,
                            suppress: ['file-edit'],
                            chunks: window.inSetu?.vfs?.getChunks ? window.inSetu.vfs.getChunks(m.filename) : [m.filename]
                        }}>
                    </sutram-entity-actions>
                </div>
            </div>
            ${m.isTruncated ? html`
                <div style="display: flex; background: #f59e0b; color: #000; padding: 8px 20px; font-weight: bold; justify-content: space-between; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--border);">
                    <span>⚠️ Only showing the first 200kb of <b>${kbSize}kb</b>.</span>
                    <sutram-btn label="Show All" @click=${() => window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: m.fullText, originalContent: m.fullText, isTruncated: false })} style="background: #000; color: #f59e0b; margin: 0; border: 1px solid #000; --btn-padding: 4px 8px;"></sutram-btn>
                </div>
            ` : ''}

            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; position: relative;"
                @focusin=${() => this._editorFocused = true}
                @focusout=${(e) => { if (!this.shadowRoot.activeElement) this._editorFocused = false; }}>${m.isSupportedEditor ? html`
                    <insetu-markdown-editor 
                        .value=${m.content} 
                        .language=${m.codeMode} 
                        .readOnly=${shouldBeReadOnly}
                        ?writingMode=${this._writingMode}
                        @content-changed=${(e) => window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: e.detail.value })}
                        @yenvui-editor-selection=${(e) => this._transientCursorPos = e.detail.cursor}
                        @yenvui-editor-scroll=${(e) => this._transientScrollTop = e.detail.top}>
                    </insetu-markdown-editor>
                ` : html`
                    <textarea 
                        style="flex: 1; margin: 0; border: none; border-radius: 0; resize: none; background: var(--bg); color: var(--text); padding: 15px; font-family: monospace;"
                        .value=${m.content}
                        ?readOnly=${shouldBeReadOnly}
                        @input=${(e) => window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: e.target.value })}>
                    </textarea>
                `}
            </div>
            ${this.isDirty ? html`
                <div class="editor-footer">
                    <sutram-async-btn label="Save Changes" intent="warning" style="width: 100%; display: block;" .onClick=${() => window.inSetu.ui.saveBufferFile(this.filepath)}></sutram-async-btn>
                </div>
            ` : ''}
            <button class="zen-exit-btn" title="Exit Focus Mode (Esc)" 
                @pointerdown=${(e) => { e.preventDefault(); e.stopPropagation(); this._toggleZenMode(); }}
                @click=${(e) => { e.preventDefault(); e.stopPropagation(); this._toggleZenMode(); }}>
                <yv-icon name="minimize-2" style="width: 20px; height: 20px; pointer-events: none;"></yv-icon>
            </button>
        `;
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._escListener) {
            window.removeEventListener('keydown', this._escListener);
        }

        // Stateless UX Teardown
        if (this.filepath && this._buffer) {
            window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { 
                cursorPos: this._transientCursorPos, 
                scrollTop: this._transientScrollTop 
            });
        }
    }
}
customElements.define('insetu-editor-projection', InSetuEditorProjection);
export const extractManifestFiles = (...args) => window.inSetu.utils.extractManifestFiles(...args);

window.inSetu.vfs.normalizeVfsURI = normalizeVfsURI;

export function resolveFileFetchUrl(filepath, isFS = false) {
    if (filepath.startsWith('/download/') || filepath.startsWith('http://') || filepath.startsWith('https://')) {
        return filepath;
    }
    const overrideUrl = window.inSetu.events.emitHook('insetu:file-fetch-url', filepath);
    if (overrideUrl) return overrideUrl;
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const isCtx = !isFS && (filepath.startsWith('ctx://') || filepath.endsWith('_context.txt') || filepath.endsWith('_diffs.txt'));

    return !isFS && !isCtx
        ? `/download/${encodeURIComponent(filepath)}`
        : `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(filepath)}`;
}

export function getChunks(filepath) {
    if (!filepath) return [];
    const manifest = AppStore.getState().manifest || {};
    const isContext = filepath.startsWith('ctx://') || filepath.endsWith('_context.txt') || filepath.endsWith('_diffs.txt');
    return extractManifestFiles(manifest, filepath, isContext ? 'ctx' : 'vfs');
}

window.inSetu.utils = window.inSetu.utils || {};

// Window Bindings
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};
export function openPartsModal(filepath) {
    if (!filepath) return;
    const chunks = getChunks(filepath);
    if (chunks && chunks.length > 0) {
        openWorkspaceBrowser({
            mode: 'parts',
            title: `Parts: ${filepath.split('/').pop()}`,
            files: chunks,
            autoDrilldown: false,
            isParts: true
        });
    }
}
window.inSetu.vfs.resolveFileFetchUrl = resolveFileFetchUrl;
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
window.inSetu.vfs.viewInWindow = viewInWindow;
window.inSetu.vfs.deleteEmptyFolder = deleteEmptyFolder;
window.inSetu.vfs.buildFileTree = buildFileTree;
window.inSetu.vfs.getGlobalManifest = getGlobalManifest;
window.inSetu.ui.openNewFileModal = openNewFileModal;
window.inSetu.ui.openNewFolderModal = openNewFolderModal;
window.inSetu.ui.saveBufferFile = saveBufferFile;
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

// Spatial Eviction Cleanup: Close text buffers to free memory when a projection is killed
window.addEventListener('sutram-evict-projection', (e) => {
    const id = e.detail.id;
    if (FsStore.getState().activeBuffers[id]) {
        FsStore.getState().closeBuffer(id);
    }
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
            onSuccess: (data) => {
                if (data && data.filepaths) {
                    data.filepaths.forEach(fp => updateManifestState(null, fp));
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
const _debouncedLinkSearch = window.ExtensionRegistry.utils.debounce((val) => {
    executeLinkSearch(val);
}, 300);

export function onLinkSearchInput(val) {
    FsStore.getState().setModal('linkInsert', { searchQuery: val });
    const { activeTab } = FsStore.getState().modals.linkInsert;
    if (activeTab !== 'filename') return;

    _debouncedLinkSearch(val);
}
export async function executeDeepLinkSearch(overrideQuery = null) {
    const query = (overrideQuery || FsStore.getState().modals.linkInsert.searchQuery).toLowerCase().trim();
    if (!query) {
        FsStore.getState().setModal('linkInsert', { searchResults: [] });
        return;
    }
    FsStore.getState().setModal('linkInsert', { deepSearchLoading: true, searchResults: [] });
    try {
        const res = await window.inSetu.api.workspace.post('fs/search', { q: query });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (res.status === 202) {
            window.inSetu.utils.pollJob(data.job_id, {
                onComplete: (pollData) => {
                    FsStore.getState().setModal('linkInsert', { searchResults: pollData.artifact?.results || [], deepSearchLoading: false });
                },
                onError: (err) => {
                    console.error("Deep search error:", err);
                    FsStore.getState().setModal('linkInsert', { deepSearchLoading: false });
                }
            });
        } else {
            FsStore.getState().setModal('linkInsert', { searchResults: data.results || [], deepSearchLoading: false });
        }
    } catch (e) {
        console.error("Deep search error:", e);
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
    static styles = [sharedStyles, css`
        :host { display: contents; }
        sutram-async-btn { flex: 1; display: block; --btn-padding: 12px; --btn-border-radius: 6px; margin: 0; }

        .sub-tabs { display: flex; gap: 2px; margin: 0; padding: 0; overflow-x: auto; align-items: center; height: 100%; scrollbar-width: none; }
        .sub-tab { cursor: pointer; padding: 0 3px; margin-right: 12px; font-size: 0.9rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; display: flex; align-items: center; border-bottom: 2px solid transparent; box-sizing: border-box; outline: none; }
        .sub-tab:last-child { margin-right: 0; }
        .sub-tab:hover { color: var(--text); }
        .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--intent-primary); }

        :host([data-theme="e-ink"]) .sub-tab { transition: none !important; }
        :host([data-theme="e-ink"]) .sub-tab:hover { color: var(--text-muted); }
        :host([data-theme="e-ink"]) .sub-tab.active { color: var(--text) !important; }
    `];

    constructor() {
        super();
        this.modals = {};
        this.browserConfig = {};
        this.currentBrowsePath = [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.dataset.ext = 'fs';
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
            ${m.move?.open ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="Move File to..." @sutram-modal-closed=${() => FsStore.getState().setModal('move', { open: false })}>
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
                <sutram-async-btn slot="footer" label="Move File" intent="primary" .onClick=${executeMove}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
            ${m.newFile?.open ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} ?flush=${true} titleText="Create New Workspace File" @sutram-modal-closed=${() => FsStore.getState().setModal('newFile', { open: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%;">
                    <div style="padding: 10px 20px; display: flex; flex-direction: column; gap: 6px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;">
                        <div style="font-size: 0.85rem; color: var(--text-muted); word-break: break-all;">
                            Path: <span style="font-family: var(--font-mono); color: var(--intent-highlight); font-weight: bold;">/${m.newFile?.basePath || ''}</span>
                        </div>
                        <input type="text" placeholder="Filename (e.g. my-prompt.md)..." .value=${m.newFile?.fileName || ''} @input=${e => { FsStore.getState().setModal('newFile', { fileName: e.target.value }); if(window.inSetu.ui.checkFileExtension) window.inSetu.ui.checkFileExtension(e.target.value); }} style="font-weight: bold; font-size: 0.95rem; border: 1px solid var(--border); padding: 8px 10px; background: var(--bg); color: var(--text); border-radius: 4px;">
                        <div id="new-file-ext-warning" style="display: none; color: var(--intent-warning); font-size: 0.8rem; font-weight: bold; margin-top: 2px;"></div>

                        ${(() => {
                            const actions = window.ExtensionRegistry?.getLayoutSlots?.().filter(s => s.slot === 'modal:new-file:actions') || [];
                            return actions.map(act => html`<div style="display: contents;" data-ext="${act.extName}">${document.createElement(act.component)}</div>`);
                        })()}
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg);">
                        <insetu-markdown-editor 
                            .value=${m.newFile?.content || ''}
                            .language=${resolveEditorMode(m.newFile?.fileName || '').mode || 'markdown'}
                            @content-changed=${e => FsStore.getState().setModal('newFile', { content: e.detail.value })}>
                        </insetu-markdown-editor>
                    </div>
                </div>
                <sutram-async-btn slot="footer" label="Create & Save File" intent="primary" .onClick=${saveNewFile}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
            ${m.newFolder?.open ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText=${m.newFolder?.basePath === '' ? 'Create New Repository' : 'Create New Folder'} @sutram-modal-closed=${() => FsStore.getState().setModal('newFolder', { open: false })}>
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
                <sutram-async-btn slot="footer" label="${m.newFolder?.basePath === '' ? 'Initialize Repository' : 'Create Folder'}" intent="primary" .onClick=${saveNewFolder}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
            ${m.linkInsert?.open ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="Insert Link" @sutram-modal-closed=${() => FsStore.getState().setModal('linkInsert', { open: false })}>
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
                            @input=${e => onLinkSearchInput(e.target.value)}>${m.linkInsert?.activeTab === 'deep' ? html`
                            <sutram-btn label="${m.linkInsert?.deepSearchLoading ? '⏳...' : 'Search'}" icon="${m.linkInsert?.deepSearchLoading ? '' : 'search'}" @click=${() => executeDeepLinkSearch()} intent="highlight" style="margin: 0;" ?disabled=${m.linkInsert?.deepSearchLoading}></sutram-btn>
                        ` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; overflow-y: auto; flex: 1; gap: 5px; min-height: 200px;">
                        ${m.linkInsert?.deepSearchLoading ? html`<yenvui-spinner text="Searching file contents across workspace..."></yenvui-spinner>` : ''}

                        ${(!m.linkInsert?.deepSearchLoading && (!m.linkInsert?.searchResults || m.linkInsert.searchResults.length === 0)) ? html`
                            <span style="color:var(--text-muted); font-style:italic;">
                                ${(!m.linkInsert?.searchQuery) ? 'Type to search...' : 'No files found.'}
                            </span>
                        ` : ''}
                        ${m.linkInsert?.searchResults?.map(item => {
                            const name = item.path.split('/').pop();
                            return html`
                                <sutram-card
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
                                </sutram-card>
                            `;
                        })}
                    </div>
                </div>
            </sutram-modal>
            ` : ''}
${m.browser?.open ? html`
<sutram-modal ?open=${true} titleText=${m.browser?.title || 'Browse'} ?fullscreen=${true} ?flush=${true} @sutram-modal-closed=${closeBrowseModal}>
    <div slot="body" style="display: flex; flex-direction: column; overflow-y: hidden; flex: 1; padding: 0;">
        ${(m.browser?.isParts || m.browser?.title?.startsWith('Parts:')) ? html`
            <div style="display: flex; flex-direction: column; overflow-y: auto; flex: 1;">
                ${(() => {
                    const manifest = m.browser?.manifest || [];
                    if (manifest.length === 0) return '';
                    const baseFile = manifest[0];
                    const baseCleanName = baseFile.includes('/') ? baseFile.split('/').pop() : baseFile;
                    return html`
                        <div style="display: flex; align-items: center; gap: 10px; background: var(--input-bg); border-bottom: 1px solid var(--border); padding: 15px 20px; flex-shrink: 0;">
                            <yv-icon name="package" style="width: 18px; height: 18px; color: var(--intent-highlight); flex-shrink: 0;"></yv-icon>
                            <span style="font-weight: bold; color: var(--intent-highlight); word-break: break-all;">${baseCleanName}</span>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            ${manifest.map((f, idx) => {
                                const fetchUrl = `/download/${encodeURIComponent(f)}`;
                                const partMatch = f.match(/_part(\d+)/i);
                                const displayTitle = partMatch ? `Part ${partMatch[1]}` : `Part ${idx + 1}`;
                                return html`
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 20px;">
                                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                                            <yv-icon name="puzzle" style="width: 18px; height: 18px; color: var(--text-muted); flex-shrink: 0;"></yv-icon>
                                            <span style="font-weight: bold; color: var(--text);">${displayTitle}</span>
                                        </div>
                                        <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                            <sutram-async-btn
                                                label="View"
                                                intent="neutral"
                                                style="margin: 0; padding: 6px 12px; font-size: 0.85rem;"
                                                .onClick=${async () => {
                                                    if (window.inSetu.vfs.viewAndCopy) {
                                                        window.inSetu.vfs.viewAndCopy(f);
                                                    }
                                                }}>
                                            </sutram-async-btn>
                                            <sutram-async-btn
                                                label="Download"
                                                intent="primary"
                                                style="margin: 0; padding: 6px 12px; font-size: 0.85rem;"
                                                .onClick=${async () => {
                                                    await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                                                }}>
                                            </sutram-async-btn>
                                        </div>
                                    </div>
                                `;
                            })}
                        </div>
                    `;
                })()}
            </div>
        ` : html`
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
        `}
    </div>
    ${(m.browser?.isParts || m.browser?.title?.startsWith('Parts:')) ? html`
        <sutram-async-btn
            slot="footer"
            label="Download All"
            intent="primary"
            .onClick=${async () => {
                const manifestFiles = m.browser?.manifest || [];
                for (const f of manifestFiles) {
                    const fetchUrl = `/download/${encodeURIComponent(f)}`;
                    await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                    await new Promise(r => setTimeout(r, 300));
                }
            }}>
        </sutram-async-btn>
        ${!!navigator.share && !!navigator.canShare ? html`
            <sutram-async-btn
                slot="footer"
                label="Share All"
                intent="neutral"
                .onClick=${async () => {
                    const manifestFiles = m.browser?.manifest || [];
                    if (manifestFiles.length > 0) {
                        const firstFile = manifestFiles[0];
                        const cleanFirst = firstFile.includes('/') ? firstFile.split('/').pop() : firstFile;
                        await shareFiles(cleanFirst, manifestFiles, false);
                    }
                }}>
            </sutram-async-btn>
        ` : ''}
    ` : (this.browserConfig?.mode === 'folder' ? html`
        <sutram-async-btn slot="footer" label="Select This Folder" intent="success" .onClick=${confirmFolderSelection}></sutram-async-btn>
    ` : '')}
    </sutram-modal>
    ` : ''}
        `;
    }
    }
customElements.define('insetu-vfs-modals', InSetuVFSModals);
function mountVFSModals() {
    if (!document.querySelector('insetu-vfs-modals')) {
        document.body.appendChild(document.createElement('insetu-vfs-modals'));
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountVFSModals);
} else {
    mountVFSModals();
}
// Isolate VFS-specific dirty state checks
window.addEventListener('beforeunload', (e) => {
    const buffers = Object.values(FsStore.getState().activeBuffers || {});
    const hasUnsaved = buffers.some(b => b.isFS && b.content !== b.originalContent);
    if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
    }
});
