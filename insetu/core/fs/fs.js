import { LitElement, html, css } from 'lit';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { InSetuElement, createExtensionStore } from '/static/extensions/system/insetu_sdk.js';
import { resolveEditorMode } from '/static/extensions/system/components/ui_editor.js';
import { AppStore, SelectionStore } from '/static/extensions/system/store.js';
import { buildFileTree, resolveDirectoryState, downloadFile as sutramDownloadFile, downloadBlob, bindGhostDrag } from '../../vendor/sutram/js/utils.js';
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
export function isFileGitModified(filepath) {
    if (!filepath || typeof filepath !== 'string') return false;

    // 1. Check if the file has unsaved changes in the active editor buffer
    const activeBuf = FsStore.getState().activeBuffers?.[filepath];
    if (activeBuf && activeBuf.isFS && activeBuf.content !== activeBuf.originalContent) {
        return true;
    }

    // 2. Check the SSOT VFS manifest's git_modified set
    const vfsManifest = AppStore.getState().manifest?.vfs || {};
    for (const bucket of Object.values(vfsManifest)) {
        if (Array.isArray(bucket?.git_modified) && bucket.git_modified.includes(filepath)) {
            return true;
        }
    }
    return false;
}
export async function viewFileGitDiff(filepath) {
    if (!filepath) return;
    const baseName = filepath.split('/').pop();
    const cleanName = window.inSetu?.utils?.truncateFilename 
        ? window.inSetu.utils.truncateFilename(baseName, 22) 
        : baseName;

    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({
            id: `vfs:diff:${filepath}`,
            component: 'insetu-file-diff-projection',
            label: `Diff: ${cleanName}`,
            icon: 'git-compare',
            intent: 'warning',
            extName: 'fs',
            windowOnly: true,
            props: {
                filepath
            }
        }, layout.focusedColumn || 'center', 1);
    }
}

export const FsStore = createExtensionStore('Fs', {
    searchQuery: '',
    activeBuffers: {}, // Maps filepath -> buffer state for multi-projection editing
    openBuffer: (filepath, data) => {
        FsStore.setState(s => ({  
            activeBuffers: { ...s.activeBuffers, [filepath]: { ...(s.activeBuffers[filepath] || {}), ...data, filename: filepath } } 
        }));
    },
    updateBuffer: (filepath, data) => {
        FsStore.setState(s => ({ 
            activeBuffers: { ...s.activeBuffers, [filepath]: { ...(s.activeBuffers[filepath] || {}), ...data } } 
        }));
    },
    closeBuffer: (filepath) => {
        FsStore.setState(s => { 
            const newBufs = {...s.activeBuffers}; 
            delete newBufs[filepath]; 
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
export function routeToSpatialGrid(filepath, label = null, preferredCol = null) {
    if (!window.Sutram?.stores?.Layout) return;
    if (window.inSetu?.ui?.focusActivePopout && window.inSetu.ui.focusActivePopout(filepath)) {
        return;
    }
    const layout = window.Sutram.stores.Layout.getState();
    const baseName = filepath.split('/').pop();
    const safeLabel = label || (window.inSetu?.utils?.truncateFilename ? window.inSetu.utils.truncateFilename(baseName, 24) : baseName);

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

    const destCol = (preferredCol && ['left', 'center', 'right'].includes(preferredCol)) ? preferredCol : 'center';
    const entity = {
        id: filepath,
        component: 'insetu-editor-projection',
        label: safeLabel,
        extName: 'fs',
        targetParent: destCol
    };

    if (layout.capacity === 1) {
        layout.openWindow(entity, layout.focusedColumn || destCol, 1);
    } else {
        layout.pinToColumn(destCol, entity);
        layout.setFocusedColumn(destCol);
        if (typeof layout.setActiveProjection === 'function') {
            layout.setActiveProjection(destCol, filepath);
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
        const fetchUrl = resolveFileFetchUrl(targetFile, false);
        const res = await window.inSetu.api.request(fetchUrl, {}, activeWs);
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        injectTextToBuffer(targetFile, text, isSupportedEditor, isMarkdown, false);
    } catch (e) {
        injectTextToBuffer(targetFile, "Error loading file content.", isSupportedEditor, isMarkdown, false);
    }
}
export async function viewAndCopy(filename) {
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
        const fetchUrl = resolveFileFetchUrl(targetFile, false);
        const res = await window.inSetu.api.request(fetchUrl, {}, activeWs);
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
    const trimTrailingSlash = (p) => (p && typeof p === 'string') ? p.replace(/\\/g, '/').replace(/\/+$/, '') : '';

    // Detect move/rename logic directly from the payload
    let moveSource = null;
    let moveDest = null;
    if (mutations.length === 2) {
        const delMut = mutations.find(m => m.operation === 'delete');
        const savMut = mutations.find(m => m.operation === 'save');
        if (delMut && savMut) {
            moveSource = trimTrailingSlash(delMut.filepath);
            moveDest = trimTrailingSlash(savMut.filepath);
        }
    }
    (mutations || []).forEach(m => {
        const normPath = trimTrailingSlash(m.filepath);
        if (!normPath) return;

        // Centralized Cache Invalidation
        if (window.inSetu?.vfs?.shareTextCache?.has(normPath)) {
            window.inSetu.vfs.shareTextCache.delete(normPath);
        }

        if (m.operation === 'delete') {
            ['vfs', 'ctx'].forEach(manifestKey => {
                Object.keys(newManifest[manifestKey]).forEach(key => {
                    const obj = newManifest[manifestKey][key];
                    if (obj.files) {
                        const origLen = obj.files.length;
                        const newFiles = [];
                        obj.files.forEach(f => {
                            if (f === normPath) {
                                if (moveDest && !newFiles.includes(moveDest)) newFiles.push(moveDest);
                                changed = true;
                            } else if (f.startsWith(normPath + '/')) {
                                if (moveDest) {
                                    const newChild = moveDest + f.substring(normPath.length);
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

            const alreadyInManifest = Object.values(newManifest.vfs).some(obj => obj.files && obj.files.includes(normPath));
            if (!alreadyInManifest && normPath.startsWith('vfs://')) {
                const parsed = window.inSetu?.utils?.parseURI ? window.inSetu.utils.parseURI(normPath) : { repo: 'global' };
                const repoDir = parsed.repo || 'global';
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
export function resolveEntityExportTarget(data = {}) {
    const rawPath = data.filepath || '';
    const normPath = normalizeVfsURI(rawPath);
    const parsed = window.inSetu?.utils?.parseURI ? window.inSetu.utils.parseURI(normPath) : {};

    const chunks = (data.chunks && data.chunks.length > 0)
        ? data.chunks
        : window.inSetu.utils.extractManifestFiles(window.inSetu.stores.App?.getState()?.manifest, rawPath);

    if (parsed.isCompiledArtifact || (chunks && chunks.length > 1)) {
        return {
            mode: 'chunks',
            chunks: (chunks && chunks.length > 0) ? chunks : [rawPath],
            isFS: false
        };
    }

    if (data.transientContent !== undefined) {
        const hasUnresolvedMacro = typeof data.transientContent === 'string' && /\{\{\s*include_prompt\s*:/.test(data.transientContent);
        if (!hasUnresolvedMacro) {
            return { mode: 'memory', text: data.transientContent, filename: rawPath.split('/').pop() || 'export.txt' };
        }
    }

    const activeBuf = FsStore.getState().activeBuffers?.[normPath] || FsStore.getState().activeBuffers?.[rawPath];
    if (activeBuf && (activeBuf.isFS || activeBuf.forceEdit)) {
        const fullText = activeBuf.isTruncated ? activeBuf.fullText : activeBuf.content;
        const hasUnresolvedMacro = typeof fullText === 'string' && /\{\{\s*include_prompt\s*:/.test(fullText);
        if (!hasUnresolvedMacro && fullText !== undefined && fullText !== 'Loading...') {
            return { mode: 'memory', text: fullText, filename: rawPath.split('/').pop() || 'export.txt' };
        }
    }

    return {
        mode: 'chunks',
        chunks: [rawPath],
        isFS: !!data.isFS
    };
}

export async function saveBufferFile(filepath, autoSave = false) {
    if (autoSave !== true) autoSave = false;
    const state = FsStore.getState().activeBuffers[filepath];
    if (!state || state.isTruncated) return;

    let content = state.content.replace(/\u00A0/g, ' ');
    if (state.filename.toLowerCase().endsWith('.json')) {
        try { JSON.parse(content); } catch (e) { return alert("Invalid JSON syntax: " + e.message); }
    }
    const baseHash = state.baseHash || null;
    await window.inSetu.sys.executeWorkspaceMutation('fs/save', { filepath, content, base_hash: baseHash }, {
        collapseKey: `vfs:save:${filepath}`,
        pendingMutations: [filepath],
        cacheBlobUrl: `/api/${window.inSetu.utils.getActiveWorkspace()}/fs/fetch?file=${encodeURIComponent(filepath)}`,
        cacheBlobContent: content,
        loadingText: 'Saving...',
        silent: autoSave,
        onSuccess: async () => {
            let nextHash = null;
            try {
                const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
                nextHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch(e) {}
            FsStore.getState().updateBuffer(filepath, { originalContent: content, content, baseHash: nextHash, saveStatus: 'idle' });
            refreshActiveFileViews(null, filepath);
        }
    });
}
export function renameFileTracking(oldPath, newPath) {
    const fsState = window.inSetu.stores.Fs.getState();
    const oldBuf = fsState.activeBuffers[oldPath];
    if (oldBuf) {
        fsState.openBuffer(newPath, { ...oldBuf, filename: newPath });
        fsState.closeBuffer(oldPath);
    }

    // Migrate open buffer tracking when parent directories are renamed or moved
    Object.keys(fsState.activeBuffers || {}).forEach(k => {
        if (k.startsWith(oldPath + '/')) {
            const childNew = newPath + k.substring(oldPath.length);
            const buf = fsState.activeBuffers[k];
            fsState.openBuffer(childNew, { ...buf, filename: childNew });
            fsState.closeBuffer(k);
        }
    });

    const layoutStore = window.Sutram?.stores?.Layout;
    if (layoutStore) {
        const layout = layoutStore.getState();
        const newCols = JSON.parse(JSON.stringify(layout.columns));
        let changed = false;

        ['left', 'center', 'right'].forEach(col => {
            const colState = newCols[col];
            if (colState && colState.pinned) {
                colState.pinned = colState.pinned.map(p => {
                    if (p.id === oldPath) {
                        changed = true;
                        return { ...p, id: newPath, label: newPath.split('/').pop() };
                    }
                    return p;
                });
                if (colState.active === oldPath) {
                    colState.active = newPath;
                    changed = true;
                }
                if (Array.isArray(colState.history)) {
                    colState.history = colState.history.map(hId => hId === oldPath ? newPath : hId);
                }
            }
        });

        const newFocusHistory = (layout.focusHistory || []).map(h => {
            if (h.id === oldPath) {
                changed = true;
                return { ...h, id: newPath };
            }
            return h;
        });

        const newWindows = (layout.windows || []).map(w => {
            if (w.id === oldPath) {
                changed = true;
                return { ...w, id: newPath, label: newPath.split('/').pop(), titleText: newPath.split('/').pop() };
            }
            return w;
        });
        if (changed) {
            layoutStore.setState({ columns: newCols, windows: newWindows, focusHistory: newFocusHistory });

            const activeWs = window.inSetu.utils.getActiveWorkspace();
            const focused = layout.focusedColumn || 'center';
            if (newCols[focused] && newCols[focused].active === newPath) {
                const deepPath = window.inSetu.stores.App?.getState()?.tabBrowsePaths?.[oldPath];
                const deepStr = deepPath && deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
                const hash = `#/${activeWs}/${focused}/${encodeURIComponent(newPath)}${deepStr}`;
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
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('vfs:move-file');
            }
            renameFileTracking(normCurrent, normDest);
            refreshActiveFileViews(normCurrent, normDest);
        }
    });
}

export class InSetuMoveFileProjection extends InSetuElement {
    static properties = {
        moveState: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
        }
    `];

    constructor() {
        super();
        this.moveState = FsStore.getState().modals.move || { currentFile: '', destPath: '', initialParts: [] };
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.move || { currentFile: '', destPath: '', initialParts: [] },
            (moveState) => {
                this.moveState = moveState;
                this.requestUpdate();
            }
        );
    }

    render() {
        const m = this.moveState || {};
        return html`
            <div style="padding: 12px 15px; display: flex; flex-direction: column; gap: 8px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;">
                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; word-break: break-all;">
                    <yv-icon name="file-code-2" style="width: 14px; height: 14px; color: var(--intent-primary); flex-shrink: 0;"></yv-icon>
                    <span>Source: <strong style="font-family: var(--font-mono); color: var(--text);">${m.currentFile || ''}</strong></span>
                </div>
                <sutram-input
                    label="Destination Path"
                    ?flush=${true}
                    .value=${m.destPath || ''}
                    placeholder="path/to/destination/file.ext"
                    style="font-family: var(--font-mono); --bg-input: var(--bg);"
                    @sutram-input-changed=${e => {
                        const newDest = normalizeVfsURI(e.detail.value);
                        const parsed = window.inSetu?.utils?.parseURI ? window.inSetu.utils.parseURI(newDest) : { repo: '', relativePath: '' };
                        const relJoined = parsed.repo ? `${parsed.repo}/${parsed.relativePath}` : parsed.relativePath;
                        const parts = relJoined.split('/').filter(Boolean);
                        parts.pop();
                        FsStore.getState().setModal('move', { destPath: newDest, initialParts: parts });
                    }}>
                </sutram-input>
            </div>

            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                <insetu-file-tree
                    basePath=""
                    .files=${getGlobalManifest()}
                    .currentPath=${m.initialParts || []}
                    .hidePath=${false}
                    .hideFiles=${true}
                    .enableSearch=${false}
                    @path-changed=${e => {
                        const pathArr = e.detail.path || [];
                        const folderPrefix = pathArr.join('/');
                        const filename = m.currentFile ? m.currentFile.split('/').pop() : '';
                        const nextDest = folderPrefix ? `vfs://${folderPrefix}/${filename}` : `vfs://${filename}`;
                        FsStore.getState().setModal('move', {
                            destPath: nextDest,
                            initialParts: pathArr
                        });
                    }}>
                </insetu-file-tree>
            </div>

            <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                <sutram-btn
                    intent="neutral"
                    icon="x"
                    label="Cancel"
                    style="flex: 1; margin: 0;"
                    @click=${() => {
                        FsStore.getState().setModal('move', { open: false });
                        if (window.Sutram?.stores?.Layout) {
                            window.Sutram.stores.Layout.getState().closeWindow('vfs:move-file');
                        }
                    }}>
                </sutram-btn>
                <sutram-async-btn
                    intent="primary"
                    icon="truck"
                    label="Move File"
                    style="flex: 2; margin: 0;"
                    .onClick=${executeMove}>
                </sutram-async-btn>
            </div>
        `;
    }
}
customElements.define('insetu-move-file-projection', InSetuMoveFileProjection);
export async function deleteEmptyFolder(dirPath) {
    if (!confirm(`Are you sure you want to delete the empty folder /${dirPath}?`)) return;
    const normPath = normalizeVfsURI(dirPath);
    await window.inSetu.sys.executeWorkspaceMutation('fs/delete', { filepath: normPath }, {
        collapseKey: `vfs:delete:${normPath}`,
        deletedMutations: [normPath],
        onSuccess: () => {
            const parts = dirPath.split('/');
            parts.pop();
            AppStore.getState().setBrowsePath(parts, 'files');
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
    const validPrefixes = targetConfigs.map(cfg => cfg.repo_dir ? `vfs://${cfg.repo_dir}/` : '');

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
        return validPrefixes.some(prefix => prefix && f.startsWith(prefix));
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
        connectedCallback() {
                super.connectedCallback();
                this.subscribe(
                        AppStore,
                        state => ({
                                manifestFiles: state.derivedVfsFiles || [],
                                globalBrowsePath: state.globalBrowsePath || []
                        }),
                        ({ manifestFiles, globalBrowsePath }) => {
                                this.manifestFiles = manifestFiles;
                                this.globalBrowsePath = globalBrowsePath;
                        }
                );
                this.subscribe(
                        FsStore,
                        state => state.searchQuery || '',
                        (searchQuery) => {
                                this.searchQuery = searchQuery;
                        }
                );
                this.registerGlobalListener('sutram-sync-complete', window, () => {
                    if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                        window.inSetu.sys.refreshManifest();
                    }
                });

                const initState = AppStore.getState();
                this.manifestFiles = initState.derivedVfsFiles || [];
                this.globalBrowsePath = initState.globalBrowsePath || [];
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
                AppStore.getState().setBrowsePath(e.detail.path || [], 'files');
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
export function pruneSubsumedTargets(items) {
    const rawTargets = items.map(i => {
        const raw = i.data?.filepath || i.data?.folderpath || i.data?.id || i.filepath || i.folderpath || '';
        return {
            path: String(raw).replace(/\/+$/, ''),
            isDir: !!(i.data?.isDir || i.isDir)
        };
    }).filter(t => t.path);
    if (rawTargets.length === 0) return [];

    const selectedDirs = new Set(rawTargets.filter(t => t.isDir).map(t => t.path));
    return rawTargets.filter(target => {
        for (const dirUri of selectedDirs) {
            if (target.path !== dirUri && target.path.startsWith(dirUri + '/')) {
                return false;
            }
        }
        return true;
    });
}
function _evictDeletedNodeFromState(normPath, rawPath, isDir) {
    const fsState = window.inSetu.stores.Fs?.getState() || {};
    if (isDir) {
        Object.keys(fsState.activeBuffers || {}).forEach(k => {
            if (k === normPath || k.startsWith(normPath + '/')) {
                fsState.closeBuffer?.(k);
            }
        });
    } else {
        fsState.closeBuffer?.(normPath);
    }

    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        ['left', 'center', 'right'].forEach(col => {
            const pinned = layout.columns[col]?.pinned || [];
            pinned.forEach(p => {
                const normP = normalizeVfsURI(p.id);
                if (normP === normPath || p.id === rawPath || (isDir && normP.startsWith(normPath + '/'))) {
                    layout.unpinFromColumn(col, p.id);
                    layout.evictProjection(p.id);
                }
            });
        });
        layout.evictProjection(normPath);
    }

    window.inSetu.events.emitHook('insetu:vfs-mutated', {
        mutations: [{ filepath: normPath + (isDir ? '/' : ''), operation: 'delete' }]
    });
}

async function _relocateVfsNode(rawPath, destPath, isDir, options = {}) {
    const normPath = normalizeVfsURI(rawPath);
    const normDest = normalizeVfsURI(destPath);
    await window.inSetu.sys.executeWorkspaceMutation('fs/move', { filepath: normPath, dest_path: normDest }, {
        collapseKey: `vfs:move:${normPath}`,
        pendingMutations: [normDest],
        deletedMutations: [normPath],
        loadingText: options.loadingText || 'Moving...',
        silent: !!options.silent,
        onSuccess: () => {
            renameFileTracking(normPath, normDest);
            window.inSetu.events.emitHook('insetu:vfs-mutated', {
                mutations: [
                    { filepath: normPath + (isDir ? '/' : ''), operation: 'delete' },
                    { filepath: normDest + (isDir ? '/' : ''), operation: 'save' }
                ]
            });
            if (options.onSuccess) options.onSuccess();
        }
    });
}

async function _archiveVfsNode(rawPath, isDir, options = {}) {
    const normPath = normalizeVfsURI(rawPath);
    await window.inSetu.sys.executeWorkspaceMutation('fs/archive', { filepath: normPath }, {
        collapseKey: `vfs:archive:${normPath}`,
        deletedMutations: [normPath],
        loadingText: options.loadingText || 'Archiving...',
        silent: !!options.silent,
        onSuccess: (resData) => {
            renameFileTracking(normPath, resData.new_path);
            window.inSetu.events.emitHook('insetu:vfs-mutated', {
                mutations: [
                    { filepath: normPath + (isDir ? '/' : ''), operation: 'delete' },
                    { filepath: resData.new_path + (isDir ? '/' : ''), operation: 'save' }
                ]
            });
            if (options.onSuccess) options.onSuccess(resData);
        }
    });
}

async function _deleteVfsNode(rawPath, isDir, options = {}) {
    const normPath = normalizeVfsURI(rawPath);
    await window.inSetu.sys.executeWorkspaceMutation('fs/delete', { filepath: normPath }, {
        collapseKey: `vfs:delete:${normPath}`,
        deletedMutations: [normPath],
        loadingText: options.loadingText || 'Deleting...',
        silent: !!options.silent,
        onSuccess: () => {
            _evictDeletedNodeFromState(normPath, rawPath, isDir);
            if (options.onSuccess) options.onSuccess();
        }
    });
}
export async function executeBulkMove(items) {
    const targets = pruneSubsumedTargets(items);
    if (targets.length === 0) return;

    openFolderBrowser(async (destFolder) => {
        if (destFolder === undefined || destFolder === null) return;
        const cleanDest = destFolder.replace(/\/+$/, '');

        if (!confirm(`Move ${targets.length} item(s) to /${cleanDest || '[root]'}?`)) return;

        const operations = [];
        for (const target of targets) {
            const itemName = target.path.split('/').filter(Boolean).pop();
            const destPath = cleanDest ? `${cleanDest}/${itemName}` : itemName;
            if (destPath === target.path) continue;
            if (target.isDir && (destPath === target.path || destPath.startsWith(target.path + '/'))) {
                console.warn(`Cannot move directory '${target.path}' into itself or its own subfolder.`);
                continue;
            }
            operations.push({
                action: 'move',
                filepath: normalizeVfsURI(target.path),
                dest_path: normalizeVfsURI(destPath),
                is_dir: !!target.isDir
            });
        }
        if (operations.length === 0) return;

        await window.inSetu.sys.executeWorkspaceMutation('fs/bulk', { operations }, {
            collapseKey: `vfs:bulk:move:${Date.now()}`,
            pendingMutations: operations.map(op => op.dest_path),
            deletedMutations: operations.map(op => op.filepath),
            loadingText: `Moving ${operations.length} item(s)...`,
            successMessage: `Moved ${operations.length} item(s) to /${cleanDest || '[root]'}`,
            onSuccess: () => {
                const mutations = [];
                operations.forEach(op => {
                    renameFileTracking(op.filepath, op.dest_path);
                    mutations.push({ filepath: op.filepath + (op.is_dir ? '/' : ''), operation: 'delete' });
                    mutations.push({ filepath: op.dest_path + (op.is_dir ? '/' : ''), operation: 'save' });
                });
                window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations });
                SelectionStore.getState().clearSelection();
                if (window.inSetu.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`Moved ${operations.length} item(s) to /${cleanDest || '[root]'}`, 3000);
                }
            }
        });
    });
}

export async function executeBulkArchive(items) {
    const targets = pruneSubsumedTargets(items);
    if (targets.length === 0) return;

    if (!confirm(`Archive ${targets.length} item(s) to 'archived/' subdirectories?`)) return;

    const operations = targets.map(target => ({
        action: 'archive',
        filepath: normalizeVfsURI(target.path),
        is_dir: !!target.isDir
    }));

    await window.inSetu.sys.executeWorkspaceMutation('fs/bulk', { operations }, {
        collapseKey: `vfs:bulk:archive:${Date.now()}`,
        deletedMutations: operations.map(op => op.filepath),
        loadingText: `Archiving ${operations.length} item(s)...`,
        successMessage: `Archived ${operations.length} item(s)`,
        onSuccess: (resData) => {
            const returnedOps = resData?.operations || [];
            const mutations = [];
            operations.forEach((op, idx) => {
                const dest = returnedOps[idx]?.dest_path;
                if (dest) {
                    renameFileTracking(op.filepath, dest);
                    mutations.push({ filepath: op.filepath + (op.is_dir ? '/' : ''), operation: 'delete' });
                    mutations.push({ filepath: dest + (op.is_dir ? '/' : ''), operation: 'save' });
                }
            });
            if (mutations.length > 0) {
                window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations });
            }
            SelectionStore.getState().clearSelection();
            if (window.inSetu.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(`Archived ${operations.length} item(s)`, 3000);
            }
        }
    });
}

export async function executeBulkDelete(items) {
    const targets = pruneSubsumedTargets(items);
    if (targets.length === 0) return;

    if (!confirm(`Permanently delete ${targets.length} item(s)? This cannot be undone!`)) return;

    const operations = targets.map(target => ({
        action: 'delete',
        filepath: normalizeVfsURI(target.path),
        rawPath: target.path,
        is_dir: !!target.isDir
    }));

    await window.inSetu.sys.executeWorkspaceMutation('fs/bulk', {
        operations: operations.map(({ action, filepath, is_dir }) => ({ action, filepath, is_dir }))
    }, {
        collapseKey: `vfs:bulk:delete:${Date.now()}`,
        deletedMutations: operations.map(op => op.filepath),
        loadingText: `Deleting ${operations.length} item(s)...`,
        successMessage: `Deleted ${operations.length} item(s)`,
        onSuccess: () => {
            operations.forEach(op => {
                _evictDeletedNodeFromState(op.filepath, op.rawPath, op.is_dir);
            });
            SelectionStore.getState().clearSelection();
            if (window.inSetu.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(`Deleted ${operations.length} item(s)`, 3000);
            }
        }
    });
}

export class InSetuVFSExplorerActions extends InSetuElement {
    static properties = {
        globalBrowsePath: { type: Array },
        _menuItems: { type: Array },
        _selectedCount: { type: Number }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
    `];

    constructor() {
        super();
        this.globalBrowsePath = [];
        this._menuItems = [];
        this._selectedCount = 0;
        this._selectedItems = new Map();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            AppStore,
            state => state.globalBrowsePath || [],
            (globalBrowsePath) => {
                this.globalBrowsePath = globalBrowsePath;
                this._rebuildMenu();
            }
        );
        this.subscribe(
            SelectionStore,
            state => state.selectedItems || new Map(),
            (selectedItems) => {
                this._selectedItems = selectedItems;
                this._selectedCount = this._selectedItems.size;
                this._rebuildMenu();
                this.requestUpdate();
            }
        );
        this.globalBrowsePath = AppStore.getState().globalBrowsePath || [];
        this._selectedItems = SelectionStore.getState()?.selectedItems || new Map();
        this._selectedCount = this._selectedItems.size;
        this._rebuildMenu();
    }

    _rebuildMenu() {
        const selectedMap = this._selectedItems || new Map();
        const selectedList = Array.from(selectedMap.values());
        const selectedCount = selectedList.length;

        const currentPath = this.globalBrowsePath.join('/');
        const items = [];
        if (selectedCount > 0) {
            const bulkFileActions = window.ExtensionRegistry?.getAggregatableActions 
                ? window.ExtensionRegistry.getAggregatableActions(selectedList, { group: 'file' }) 
                : [];

            if (bulkFileActions.length > 0) {
                bulkFileActions.forEach(act => items.push(act));
                items.push({ divider: true });
            }

            items.push({
                label: `Clear Selection (${selectedCount})`,
                icon: 'x',
                onClick: () => SelectionStore.getState().clearSelection()
            });
            items.push({ divider: true });
        }
        if (!currentPath) {
            items.push({ label: 'New Repository', icon: 'package', onClick: () => openNewFolderModal() });
        } else {
            const prefix = `vfs://${currentPath}/`;
            items.push({ label: 'New Folder', icon: 'folder-plus', onClick: () => openNewFolderModal(prefix) });
            items.push({ label: 'New File', icon: 'file-plus', onClick: () => openNewFileModal(prefix) });
            items.push({ label: 'Upload File', icon: 'upload', onClick: () => uploadFileToWorkspace(`vfs://${currentPath}`) });

            const manifestFiles = getGlobalManifest();
            const hasFiles = manifestFiles.some(f => f.startsWith(prefix) && !f.endsWith('.gitkeep'));
            if (!hasFiles) {
                items.push({ divider: true });
                items.push({ label: 'Delete Folder', icon: 'trash-2', onClick: () => deleteEmptyFolder(`vfs://${currentPath}`) });
            }
        }
        window.inSetu.events.emitHook('insetu:fs-dropdown-menu', { currentPath, menuItems: items });
        this._menuItems = items;
    }

    render() {
        const count = this._selectedCount || 0;
        return html`
            <sutram-dropdown align="right" .items=${this._menuItems} style="height: 100%; display: flex; align-items: stretch;">
                <button slot="trigger" class="system-action-btn" title="${count > 0 ? `Bulk Actions (${count} selected)` : 'Actions'}" style="border: none; border-left: 1px solid var(--border); border-radius: 0; height: 100%; width: 44px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; position: relative;">
                    ${count > 0 ? html`
                        <yv-icon name="layers" style="width: 15px; height: 15px; color: var(--intent-warning);"></yv-icon>
                        <span style="position: absolute; top: 4px; right: 4px; background: var(--intent-warning); color: var(--bg-deep); border-radius: 50%; width: 14px; height: 14px; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; line-height: 1;">${count > 9 ? '9+' : count}</span>
                    ` : html`
                        <yv-icon name="menu" style="width: 14px; height: 14px;"></yv-icon>
                    `}
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
    uiHooks: {
        'sutram:is-projection-dirty': (subId) => {
            if (!subId) return false;
            const normId = normalizeVfsURI(subId);
            const activeBuffers = FsStore.getState().activeBuffers || {};
            const buf = activeBuffers[subId] || activeBuffers[normId];
            return Boolean(buf && buf.content !== buf.originalContent);
        }
    },
    shortcuts: [
        {
            id: 'new-file-modal-save',
            context: 'global',
            key: 'ctrl+s',
            label: 'Save New File',
            action: () => {
                const isNewFileOpen = window.Sutram?.stores?.Layout?.getState()?.windows?.some(w => w.id === 'vfs:new-file');
                if (isNewFileOpen && window.inSetu.ui.saveNewFile) {
                    window.inSetu.ui.saveNewFile();
                }
            }
        }
    ],
    entityActions: [
        {
            targetEntity: 'file',
            targetEntities: ['file', 'folder'],
            id: 'vfs-move',
            bulkGroupKey: 'move',
            label: 'Move',
            icon: 'truck',
            group: 'file',
            vfsBound: true,
            intent: 'neutral',
            order: 64,
            bulkable: true,
            match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
            onClick: (data, e) => {
                if (data.isDir) {
                    const srcDir = String(data.folderpath || data.filepath || '').replace(/\/+$/, '');
                    const folderName = srcDir.split('/').filter(Boolean).pop();
                    openFolderBrowser(async (destParent) => {
                        if (destParent === undefined || destParent === null) return;
                        const cleanDest = destParent.replace(/\/+$/, '');
                        const destPath = cleanDest ? `${cleanDest}/${folderName}` : folderName;
                        if (destPath === srcDir || destPath.startsWith(srcDir + '/')) {
                            alert("Cannot move a folder into itself or a subfolder.");
                            return;
                        }
                        await _relocateVfsNode(srcDir, destPath, true, { loadingText: 'Moving folder...' });
                    });
                } else {
                    const normFp = normalizeVfsURI(data.filepath || '');
                    const parsed = window.inSetu?.utils?.parseURI ? window.inSetu.utils.parseURI(normFp) : { repo: '', relativePath: '' };
                    const relJoined = parsed.repo ? `${parsed.repo}/${parsed.relativePath}` : parsed.relativePath;
                    const parts = relJoined ? relJoined.split('/').filter(Boolean) : [];
                    parts.pop();
                    window.inSetu.stores.Fs.getState().setModal('move', { open: false, currentFile: normFp, destPath: normFp, initialParts: parts });
                    if (window.Sutram?.stores?.Layout) {
                        const layout = window.Sutram.stores.Layout.getState();
                        layout.openWindow({
                            id: 'vfs:move-file',
                            component: 'insetu-move-file-projection',
                            label: `Move: ${normFp.split('/').pop()}`,
                            icon: 'truck',
                            intent: 'warning',
                            extName: 'fs',
                            windowOnly: true
                        }, layout.focusedColumn || 'center', 1);
                    }
                }
            },
            bulkAction: (items, e) => executeBulkMove(items)
        },
        {
            targetEntity: 'file',
            targetEntities: ['file', 'folder'],
            id: 'vfs-rename',
            label: 'Rename',
            icon: 'edit-3',
            group: 'file',
            vfsBound: true,
            intent: 'neutral',
            order: 65,
            bulkable: false,
            match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
            asyncAction: async (data, e) => {
                const rawPath = String(data.isDir ? (data.folderpath || data.filepath) : data.filepath).replace(/\/+$/, '');
                const parts = rawPath.split('/').filter(Boolean);
                const currentName = parts.pop() || '';
                const newName = prompt(`Enter new ${data.isDir ? 'folder' : 'file'} name:`, currentName);
                if (!newName || newName === currentName) return;
                const destPath = parts.length > 0 ? parts.join('/') + '/' + newName : newName;
                await _relocateVfsNode(rawPath, destPath, !!data.isDir, { loadingText: 'Renaming...' });
            }
        },
        {
            targetEntity: 'file',
            targetEntities: ['file', 'folder'],
            id: 'vfs-archive',
            bulkGroupKey: 'archive',
            label: 'Archive',
            icon: 'archive',
            group: 'file',
            vfsBound: true,
            intent: 'warning',
            order: 66,
            bulkable: true,
            match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
            asyncAction: async (data, e) => {
                const rawPath = String(data.isDir ? (data.folderpath || data.filepath) : data.filepath).replace(/\/+$/, '');
                const label = data.isDir ? `folder "${rawPath.split('/').filter(Boolean).pop()}"` : `this file`;
                if (!confirm(`Archive ${label} to an 'archived/' directory?`)) return;
                await _archiveVfsNode(rawPath, !!data.isDir, { loadingText: 'Archiving...' });
            },
            bulkAction: (items, e) => executeBulkArchive(items)
        },
        {
            targetEntity: 'file',
            targetEntities: ['file', 'folder'],
            id: 'vfs-delete',
            bulkGroupKey: 'delete',
            label: 'Delete',
            icon: 'trash-2',
            group: 'file',
            vfsBound: true,
            intent: 'danger',
            order: 67,
            bulkable: true,
            match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
            asyncAction: async (data, e) => {
                const rawPath = String(data.isDir ? (data.folderpath || data.filepath) : data.filepath).replace(/\/+$/, '');
                const label = data.isDir ? `folder "${rawPath.split('/').filter(Boolean).pop()}" and all its contents` : `this file`;
                if (!confirm(`Permanently delete ${label}? This cannot be undone!`)) return;
                await _deleteVfsNode(rawPath, !!data.isDir, { loadingText: 'Deleting...' });
            },
            bulkAction: (items, e) => executeBulkDelete(items)
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
            id: 'file-git-diff',
            label: 'Diff',
            icon: 'git-compare',
            group: 'edit',
            vfsBound: false,
            intent: 'warning',
            order: 11,
            match: (data) => {
                if (data.isSkeleton || !data.isFS) return false;
                return !!(data.git_modified || data.isDirty || isFileGitModified(data.filepath));
            },
            onClick: (data, e) => {
                viewFileGitDiff(data.filepath);
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
                const target = resolveEntityExportTarget(data);
                if (target.mode === 'memory') {
                    await navigator.clipboard.writeText(target.text).then(() => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
                    }).catch(err => alert("Clipboard API failed. Please manually select the text and copy it directly."));
                    return;
                }
                const primaryFile = target.chunks[0] || data.filepath;
                const fetchUrl = resolveFileFetchUrl(primaryFile, target.isFS);
                await fetchAndCopy(primaryFile, fetchUrl);
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
                const target = resolveEntityExportTarget(data);
                if (target.mode === 'memory') return;
                window.inSetu.vfs.shareTextCache.clear();
                target.chunks.forEach(filepath => {
                    const fetchUrl = resolveFileFetchUrl(filepath, target.isFS);
                    const activeWs = window.inSetu.utils.getActiveWorkspace();

                    window.inSetu.api.fetchImmutableText(fetchUrl, { onlyIfMissing: true }, activeWs)
                        .then(textContent => window.inSetu.vfs.shareTextCache.set(filepath, textContent))
                        .catch(() => {});
                });
            },
            onClick: (data, e) => {
                if (e) e.stopPropagation();
                const target = resolveEntityExportTarget(data);
                if (target.mode === 'memory') {
                    window.inSetu.utils.nativeShareFiles([{ content: target.text || '', filename: target.filename }]).catch(()=>{});
                    return;
                }
                shareFiles(data.filepath, target.chunks, target.isFS);
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
                const target = resolveEntityExportTarget(data);
                if (target.mode === 'memory') {
                    try {
                        const blob = new Blob([target.text], { type: 'text/plain' });
                        downloadBlob(blob, target.filename);
                        return;
                    } catch (err) {
                        alert("Error downloading file: " + err.message);
                        return;
                    }
                }
                const chunks = target.chunks;
                if (chunks && chunks.length > 1) {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⬇️ Downloading multi-part context...", 2000);
                    for (const f of chunks) {
                        const fetchUrl = `${resolveFileFetchUrl(f, false)}&download=1`;
                        await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                        await new Promise(r => setTimeout(r, 300));
                    }
                } else {
                    const baseFetchUrl = resolveFileFetchUrl(data.filepath, data.isFS);
                    const fetchUrl = baseFetchUrl.includes('/fs/fetch?') ? `${baseFetchUrl}&download=1` : baseFetchUrl;
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
            allow_popout: true,
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
export function getFileExtensionWarning(filename, basePath = '') {
    if (!filename) return '';
    const cleanBase = (basePath || '').replace(/^[a-zA-Z0-9_-]+:\/\//, '');
    const pathParts = cleanBase.split('/').filter(Boolean);
    const gbPath = pathParts.length > 0 ? pathParts : (AppStore.getState().globalBrowsePath || []);
    if (gbPath.length > 0) {
        const repoDir = gbPath[0];
        const targetConfigs = AppStore.getState().targetConfigs || [];
        const repoCfg = targetConfigs.find(c => c.repo_dir === repoDir);

        if (repoCfg && repoCfg.exts) {
            let ext = "";
            const lastDotIndex = filename.lastIndexOf('.');
            if (lastDotIndex > 0) {
                ext = filename.substring(lastDotIndex).toLowerCase();
            }
            if (!repoCfg.exts.includes(ext) && !repoCfg.exts.includes("")) {
                if (ext === "") {
                    return `Extensionless files (or hidden dotfiles) are not tracked by ${repoCfg.title || repoDir}. The file will save to disk, but it will not appear in your context tree.`;
                }
                return `The extension '${ext}' is not tracked by ${repoCfg.title || repoDir}. The file will save to disk, but it will not appear in your context tree.`;
            }
        }
    }
    return '';
}
export function checkFileExtension(filename) {
    return getFileExtensionWarning(filename);
}
function openNewFileModal(overridePath = null) {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const rawPrefix = typeof overridePath === 'string' ? overridePath : (gbPath.length > 0 ? `vfs://${gbPath.join('/')}/` : '');
    const prefix = rawPrefix ? normalizeVfsURI(rawPrefix) : '';
    FsStore.getState().setModal('newFile', { open: true, basePath: prefix, fileName: '', content: '' });
    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({
            id: 'vfs:new-file',
            component: 'insetu-new-file-projection',
            label: 'Create New Workspace File',
            icon: 'file-plus',
            intent: 'primary',
            extName: 'fs',
            windowOnly: true
        }, layout.focusedColumn || 'center', 1);
    }
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
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('vfs:new-file');
            }
            refreshActiveFileViews(null, normPath);
        }
    });
}
async function openNewFolderModal(overridePath = null) {
    const gbPath = AppStore.getState().globalBrowsePath || [];
    const isRoot = overridePath === null && gbPath.length === 0;
    const rawPrefix = typeof overridePath === 'string' ? overridePath : (isRoot ? '' : `vfs://${gbPath.join('/')}/`);
    const prefix = rawPrefix ? normalizeVfsURI(rawPrefix) : '';
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
    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({
            id: 'vfs:new-folder',
            component: 'insetu-new-folder-projection',
            label: prefix === '' ? 'Create New Repository' : 'Create New Folder',
            icon: prefix === '' ? 'package' : 'folder-plus',
            intent: 'primary',
            extName: 'fs',
            windowOnly: true
        }, layout.focusedColumn || 'center', 1);
    }
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
    const filepath = normalizeVfsURI(basePath + folderName + "/.gitkeep");
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
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('vfs:new-folder');
            }
            refreshActiveFileViews(null, filepath);
        }
    });
}
export async function viewSourceFile(filepath, isFS = false, bypassHook = false) {
    if (!filepath || typeof filepath !== 'string') return;
    const normPath = filepath;

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
    const parsedUri = window.inSetu?.utils?.parseURI ? window.inSetu.utils.parseURI(normPath) : { isEditable: isFS };
    const effectiveIsFS = parsedUri.isReadOnly ? false : (isFS || parsedUri.isEditable);
    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(normPath);
    FsStore.getState().openBuffer(normPath, {
        filename: normPath,
        content: 'Loading...',
        originalContent: 'Loading...',
        fullText: 'Loading...',
        isTruncated: false,
        isFS: effectiveIsFS,
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
        let initialHash = null;
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            initialHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch(e) {}
        FsStore.getState().updateBuffer(normPath, { baseHash: initialHash, saveStatus: 'idle', docHandle: null });
        injectTextToBuffer(normPath, text, isSupportedEditor, isMarkdown, isFS);
    } catch (e) {
        injectTextToBuffer(normPath, "Error loading file content.", isSupportedEditor, isMarkdown, isFS);
    }
}
function closeBrowseModal() {
    FsStore.getState().setModal('browser', { open: false });
    AppStore.setState({ browserConfig: { mode: 'view', callback: null } });
    if (window.Sutram?.stores?.Layout) {
        window.Sutram.stores.Layout.getState().closeWindow('vfs:browser');
    }
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
        const treeBuilder = window.inSetu?.vfs?.buildUriFileTree || buildFileTree;
        let cursor = treeBuilder(targetManifest, 'vfs://');
        while (cursor && cursor.type === 'directory' && cursor.children) {
            const children = Object.values(cursor.children);
            if (children.length === 1 && children[0].type === 'directory') {
                cbPath.push(children[0].name);
                cursor = children[0];
                continue;
            }
            break;
        }
    }
    AppStore.setState({ currentBrowsePath: cbPath });
    FsStore.getState().setModal('browser', { open: true, title, manifest: targetManifest, searchQuery: '', isParts });
    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({
            id: 'vfs:browser',
            component: 'insetu-browser-projection',
            label: title,
            icon: isParts ? 'puzzle' : 'folder',
            intent: isParts ? 'highlight' : 'primary',
            extName: 'fs',
            windowOnly: true
        }, layout.focusedColumn || 'center', 1);
    }
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
        const finalPath = selectedPath ? `vfs://${selectedPath.replace(/\/+$/, '')}/` : 'vfs://';
        browserConfig.callback(finalPath);
    }
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
            display: flex; justify-content: space-between; align-items: center; 
            padding: 8px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
            gap: 12px;
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
        this._autoSaveTimer = null;
    }

    _triggerDebouncedAutoSave() {
        if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = setTimeout(() => {
            if (this.isDirty && this.filepath && window.inSetu?.ui?.saveBufferFile) {
                window.inSetu.ui.saveBufferFile(this.filepath, true);
            }
        }, 2000);
    }
    _cleanArtifacts() {
        const cleanFn = window.inSetu?.utils?.cleanCodeArtifacts;
        if (!cleanFn) return;
        const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
        let modified = false;
        if (cmEditor && cmEditor.transformContent) {
            modified = cmEditor.transformContent(cleanFn);
        } else if (this._buffer) {
            const cleaned = cleanFn(this._buffer.content);
            if (cleaned !== this._buffer.content) {
                window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: cleaned });
                modified = true;
            }
        }
        if (modified) {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✨ Cleaned citations and span tags", 2000);
        } else {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("No citation or span artifacts found", 2000);
        }
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
        this.subscribe(
            'Fs',
            state => state.activeBuffers[this.filepath] || null,
            (buffer) => {
                this._buffer = buffer;
            }
        );
        // Pointer Relaunch: Fetch the file from the VFS if the layout mounted this component but memory is empty
        setTimeout(() => {
            if (!this._buffer && this.filepath && !this.filepath.startsWith('yomama://') && !this.filepath.startsWith('virtual://')) {
                if (window.inSetu?.vfs?.viewSourceFile) {
                    const parsed = this.utils.parseURI ? this.utils.parseURI(this.filepath) : { isEditable: true };
                    window.inSetu.vfs.viewSourceFile(this.filepath, parsed.isEditable, true);
                }
            }
        }, 0);
        this.registerGlobalListener('insetu:editor:clean-artifacts', window, (e) => {
            if (!e.detail?.filepath || e.detail.filepath === this.filepath || e.detail.filepath === this.dataset.subId) {
                this._cleanArtifacts();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-prose', window, (e) => {
            if (e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                this._toggleWritingMode();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-zen', window, (e) => {
            if (e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                this._toggleZenMode();
            }
        });
        // Emergency Flush on Window Close (Protects in-flight keystrokes during debounce)
        this._beforeUnloadFlush = () => {
            if (this.isDirty && this.filepath) {
                const normPath = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(this.filepath) : this.filepath;
                const state = window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[normPath] || window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[this.filepath];
                if (state && state.content !== state.originalContent && window.inSetu?.api?.keepalivePost) {
                    window.inSetu.api.keepalivePost('fs/save', {
                        filepath: normPath,
                        content: state.content,
                        base_hash: state.baseHash || null
                    });
                }
            }
        };
        window.addEventListener('beforeunload', this._beforeUnloadFlush);

        // Focus-Aware Idle Hot-Swap Listener (Driven by BroadcastChannel or SSE)
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const mutations = e.detail?.mutations || [];
            const normPath = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(this.filepath) : this.filepath;
            const isMatch = mutations.some(m => {
                const mNorm = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath;
                return mNorm === normPath || m.filepath === this.filepath;
            });

            if (isMatch) {
                const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                const hasFocus = cmEditor?.shadowRoot?.activeElement || this.shadowRoot.activeElement;
                if (!this.isDirty && !hasFocus) {
                    window.inSetu.api.workspace.get(`fs/fetch?file=${encodeURIComponent(normPath)}`)
                        .then(r => r.ok ? r.text() : null)
                        .then(async (newText) => {
                            if (newText !== null && newText !== this._buffer?.content) {
                                let newHash = null;
                                try {
                                    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newText));
                                    newHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                                } catch(err) {}
                                const fsStore = window.inSetu?.stores?.Fs;
                                if (fsStore) {
                                    fsStore.getState().updateBuffer(normPath, {
                                        content: newText,
                                        originalContent: newText,
                                        fullText: newText,
                                        baseHash: newHash
                                    });
                                }
                            }
                        })
                        .catch(() => {});
                }
            }
        });

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
        const shouldBeReadOnly = !(m.isFS || m.forceEdit) || !!m.isTruncated;
        const kbSize = Math.round((m.fullText?.length || 0) / 1024);
        return html`
            <div class="editor-header">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <sutram-entity-actions   
                        variant="menu-bar"
                        .entityType=${'file:editor'} 
                        .entityData=${{ 
                            filepath: m.filename, 
                            isFS: m.isFS,
                            isMarkdown: m.isMarkdown,
                            writingMode: this._writingMode,
                            isSkeleton: false,
                            isDirty: this.isDirty,
                            suppress: ['file-edit'],
                            chunks: window.inSetu?.vfs?.getChunks ? window.inSetu.vfs.getChunks(m.filename) : [m.filename]
                        }}>
                    </sutram-entity-actions>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <insetu-projection-window-controls 
                        .filepath=${m.filename}
                        .beforeAction=${async () => { if (this.isDirty) await window.inSetu.ui.saveBufferFile(this.filepath, true); }}>
                    </insetu-projection-window-controls>
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
                        @content-changed=${(e) => {
                            window.inSetu.stores.Fs?.getState()?.updateBuffer(this.filepath, { content: e.detail.value });
                            this._triggerDebouncedAutoSave();
                        }}>
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
        if (this._beforeUnloadFlush) {
            window.removeEventListener('beforeunload', this._beforeUnloadFlush);
        }
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
        }
        // Stateless UX Teardown (only update if buffer has not been explicitly closed)
        const normPath = normalizeVfsURI(this.filepath);
        const activeBuffers = window.inSetu.stores.Fs?.getState()?.activeBuffers || {};
        if (this.filepath && this._buffer && (activeBuffers[normPath] || activeBuffers[this.filepath])) {
            window.inSetu.stores.Fs.getState().updateBuffer(this.filepath, { 
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
    if (!filepath) return '';
    if (filepath.startsWith('/download/') || filepath.startsWith('http://') || filepath.startsWith('https://')) {
        return filepath;
    }
    const overrideUrl = window.inSetu.events.emitHook('insetu:file-fetch-url', filepath);
    if (overrideUrl) return overrideUrl;
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    return `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(filepath)}`;
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
window.inSetu.vfs.resolveEntityExportTarget = resolveEntityExportTarget;
window.inSetu.vfs.resolveFileFetchUrl = resolveFileFetchUrl;
window.inSetu.vfs.renameFileTracking = renameFileTracking;
window.inSetu.vfs.getChunks = getChunks;
window.inSetu.vfs.openPartsModal = openPartsModal;
window.inSetu.vfs.openVirtualFile = openVirtualFile;
window.inSetu.vfs.fetchAndCopy = fetchAndCopy;
window.inSetu.vfs.fetchAndDownloadState = fetchAndDownloadState;
window.inSetu.vfs.downloadFile = downloadFile;
window.inSetu.vfs.shareFiles = shareFiles;
window.inSetu.vfs.uploadFileToWorkspace = uploadFileToWorkspace;
window.inSetu.vfs.viewSourceFile = viewSourceFile;
window.inSetu.vfs.viewFileGitDiff = viewFileGitDiff;
window.inSetu.vfs.isFileGitModified = isFileGitModified;
window.inSetu.vfs.viewAndCopy = viewAndCopy;
window.inSetu.vfs.viewInWindow = viewInWindow;
window.inSetu.vfs.deleteEmptyFolder = deleteEmptyFolder;
window.inSetu.vfs.buildFileTree = buildFileTree;
window.inSetu.vfs.resolveDirectoryState = resolveDirectoryState;
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
// Spatial Eviction Cleanup: Close text buffers and reset transient window modal state when a projection is killed
window.addEventListener('sutram-evict-projection', (e) => {
    const id = e.detail?.id;
    if (!id) return;
    if (FsStore.getState().activeBuffers[id]) {
        FsStore.getState().closeBuffer(id);
    }
    if (id === 'vfs:move-file') FsStore.getState().setModal('move', { open: false });
    else if (id === 'vfs:new-file') FsStore.getState().setModal('newFile', { open: false });
    else if (id === 'vfs:new-folder') FsStore.getState().setModal('newFolder', { open: false });
    else if (id === 'vfs:link-insert') FsStore.getState().setModal('linkInsert', { open: false });
    else if (id === 'vfs:browser') {
        FsStore.getState().setModal('browser', { open: false });
        AppStore.setState({ browserConfig: { mode: 'view', callback: null } });
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

    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({
            id: 'vfs:link-insert',
            component: 'insetu-link-insert-projection',
            label: 'Insert Link',
            icon: 'link',
            intent: 'highlight',
            extName: 'fs',
            windowOnly: true
        }, layout.focusedColumn || 'center', 1);
    }

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
export class InSetuNewFileProjection extends InSetuElement {
    static properties = { newFileState: { type: Object } };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        this.newFileState = FsStore.getState().modals?.newFile || {};
        this._cachedActionNodes = new Map();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.newFile || {},
            (newFileState) => {
                this.newFileState = newFileState;
                this.requestUpdate();
            }
        );
    }
    _getActionNode(componentTag) {
        if (!this._cachedActionNodes.has(componentTag)) {
            this._cachedActionNodes.set(componentTag, document.createElement(componentTag));
        }
        return this._cachedActionNodes.get(componentTag);
    }
    render() {
        const nf = this.newFileState || {};
        const extWarning = getFileExtensionWarning(nf.fileName || '', nf.basePath || '');
        const actions = window.ExtensionRegistry?.getLayoutSlots?.().filter(s => s.slot === 'modal:new-file:actions') || [];
        return html`
            <div style="padding: 12px 15px; display: flex; flex-direction: column; gap: 8px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;">
                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; word-break: break-all;">
                    <yv-icon name="folder" style="width: 14px; height: 14px; color: var(--intent-highlight); flex-shrink: 0;"></yv-icon>
                    <span>Directory: <strong style="font-family: var(--font-mono); color: var(--intent-highlight);">/${nf.basePath || ''}</strong></span>
                </div>
                <sutram-input
                    label="Filename"
                    ?flush=${true}
                    placeholder="Filename (e.g. my-prompt.md)..."
                    .value=${nf.fileName || ''}
                    style="font-family: var(--font-mono); --bg-input: var(--bg);"
                    @sutram-input-changed=${e => {
                        FsStore.getState().setModal('newFile', { fileName: e.detail.value });
                    }}>
                </sutram-input>
                ${extWarning ? html`
                    <div style="color: var(--intent-warning); font-size: 0.8rem; font-weight: bold; margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                        <yv-icon name="alert-triangle" style="width: 14px; height: 14px; flex-shrink: 0;"></yv-icon>
                        <span>${extWarning}</span>
                    </div>
                ` : ''}

                ${actions.map(act => html`<div style="display: contents;" data-ext="${act.extName}">${this._getActionNode(act.component)}</div>`)}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg);">
                <insetu-markdown-editor
                    .value=${nf.content || ''}
                    .language=${resolveEditorMode(nf.fileName || '').mode || 'markdown'}
                    @content-changed=${e => FsStore.getState().setModal('newFile', { content: e.detail.value })}>
                </insetu-markdown-editor>
            </div>
            <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                <sutram-btn intent="neutral" icon="x" label="Cancel" style="flex: 1; margin: 0;" @click=${() => {
                    FsStore.getState().setModal('newFile', { open: false });
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('vfs:new-file');
                }}></sutram-btn>
                <sutram-async-btn intent="primary" icon="save" label="Create & Save File" style="flex: 2; margin: 0;" .onClick=${saveNewFile}></sutram-async-btn>
            </div>
        `;
    }
}
customElements.define('insetu-new-file-projection', InSetuNewFileProjection);

export class InSetuNewFolderProjection extends InSetuElement {
    static properties = { newFolderState: { type: Object } };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        this.newFolderState = FsStore.getState().modals?.newFolder || {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.newFolder || {},
            (newFolderState) => {
                this.newFolderState = newFolderState;
                this.requestUpdate();
            }
        );
    }
    render() {
        const nf = this.newFolderState || {};
        return html`
            <sutram-scroll-view padding="15px" style="gap: 12px;">
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; word-break: break-all;">
                    <yv-icon name="folder" style="width: 14px; height: 14px; color: var(--intent-highlight); flex-shrink: 0;"></yv-icon>
                    <span>Base Path: <strong style="font-family: var(--font-mono); color: var(--intent-highlight);">/${nf.basePath || ''}</strong></span>
                </div>
                <sutram-input
                    label="Directory Name"
                    placeholder="Directory name..."
                    .value=${nf.folderName || ''}
                    @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { folderName: e.detail.value })}>
                </sutram-input>
                ${nf.basePath === '' ? html`
                    <div style="display: flex; flex-direction: column; gap: 12px; background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                        <h4 style="margin: 0; color: var(--intent-primary);">Repository Configuration</h4>
                        <sutram-input label="Repository Title" placeholder="e.g., Core API" .value=${nf.repoTitle || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoTitle: e.detail.value })}></sutram-input>
                        <sutram-input label="Domain Category" placeholder="e.g., Workspaces" .value=${nf.repoDomain || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoDomain: e.detail.value })}></sutram-input>
                        <sutram-input label="Description" placeholder="Short summary..." .value=${nf.repoDesc || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoDesc: e.detail.value })}></sutram-input>
                        <sutram-input label="Tracked Extensions" placeholder="e.g., .py, .json, .md" .value=${nf.repoExts || ''} ?flush=${true} style="font-family: var(--font-mono);" @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoExts: e.detail.value })}></sutram-input>
                    </div>
                ` : ''}
            </sutram-scroll-view>
            <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                <sutram-btn intent="neutral" icon="x" label="Cancel" style="flex: 1; margin: 0;" @click=${() => {
                    FsStore.getState().setModal('newFolder', { open: false });
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('vfs:new-folder');
                }}></sutram-btn>
                <sutram-async-btn intent="primary" icon="${nf.basePath === '' ? 'package' : 'folder-plus'}" label="${nf.basePath === '' ? 'Initialize Repository' : 'Create Folder'}" style="flex: 2; margin: 0;" .onClick=${saveNewFolder}></sutram-async-btn>
            </div>
        `;
    }
}
customElements.define('insetu-new-folder-projection', InSetuNewFolderProjection);

export class InSetuLinkInsertProjection extends InSetuElement {
    static properties = { linkState: { type: Object } };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
        .sub-tabs { display: flex; gap: 2px; margin: 0; padding: 0 15px; overflow-x: auto; align-items: center; height: 40px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .sub-tab { cursor: pointer; padding: 0 6px; margin-right: 12px; font-size: 0.85rem; font-weight: bold; color: var(--text-muted); white-space: nowrap; height: 100%; display: flex; align-items: center; border-bottom: 2px solid transparent; box-sizing: border-box; }
        .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--intent-primary); }
    `];
    constructor() {
        super();
        this.linkState = FsStore.getState().modals?.linkInsert || {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.linkInsert || {},
            (linkState) => {
                this.linkState = linkState;
                this.requestUpdate();
            }
        );
    }
    render() {
        const li = this.linkState || {};
        return html`
            <div class="sub-tabs">
                <div class="sub-tab ${li.activeTab === 'filename' ? 'active' : ''}" @click=${() => switchLinkTab('filename')}>Filename</div>
                <div class="sub-tab ${li.activeTab === 'deep' ? 'active' : ''}" @click=${() => switchLinkTab('deep')}>Deep Search</div>
            </div>
            <div style="padding: 10px 15px; display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0;">
                <sutram-input
                    placeholder="Search files..."
                    ?flush=${true}
                    style="flex: 1; margin: 0;"
                    .value=${li.searchQuery || ''}
                    @sutram-input-changed=${e => onLinkSearchInput(e.detail.value)}>
                </sutram-input>
                ${li.activeTab === 'deep' ? html`
                    <sutram-btn label="${li.deepSearchLoading ? 'Searching...' : 'Search'}" icon="search" @click=${() => executeDeepLinkSearch()} intent="highlight" style="margin: 0;" ?disabled=${li.deepSearchLoading}></sutram-btn>
                ` : ''}
            </div>
            <sutram-scroll-view padding="12px" style="gap: 6px;">
                ${li.deepSearchLoading ? html`<sutram-spinner text="Searching file contents across workspace..."></sutram-spinner>` : ''}
                ${(!li.deepSearchLoading && (!li.searchResults || li.searchResults.length === 0)) ? html`
                    <span style="color:var(--text-muted); font-style:italic; padding: 10px;">
                        ${(!li.searchQuery) ? 'Type to search...' : 'No files found.'}
                    </span>
                ` : ''}
                ${(li.searchResults || []).map(item => {
                    const name = item.path.split('/').pop();
                    return html`
                        <sutram-card
                            .filename=${item.path}
                            .titleText=${name}
                            .detailText=${item.path}
                            .descriptionText=${item.snippet ? '"...' + item.snippet.replace(/</g, '&lt;') + '"' : ''}
                            icon="file-text"
                            intent="primary"
                            ?disableSelection=${true}
                            @card-clicked=${() => {
                                insertLinkToEditor(item.path, name);
                                if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('vfs:link-insert');
                            }}>
                            ${item.score !== undefined ? html`
                                <span slot="header-tags" style="font-size: 0.7rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px;">
                                    Score: ${item.score}
                                </span>
                            ` : ''}
                        </sutram-card>
                    `;
                })}
            </sutram-scroll-view>
        `;
    }
}
customElements.define('insetu-link-insert-projection', InSetuLinkInsertProjection);

export class InSetuBrowserProjection extends InSetuElement {
    static properties = {
        browserModal: { type: Object },
        browserConfig: { type: Object },
        currentBrowsePath: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        this.browserModal = FsStore.getState().modals?.browser || {};
        this.browserConfig = AppStore.getState().browserConfig || {};
        this.currentBrowsePath = AppStore.getState().currentBrowsePath || [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.browser || {},
            (browserModal) => {
                this.browserModal = browserModal;
                this.requestUpdate();
            }
        );
        this.subscribe(
            AppStore,
            state => ({
                browserConfig: state.browserConfig || {},
                currentBrowsePath: state.currentBrowsePath || []
            }),
            ({ browserConfig, currentBrowsePath }) => {
                this.browserConfig = browserConfig;
                this.currentBrowsePath = currentBrowsePath;
                this.requestUpdate();
            }
        );
    }
    render() {
        const b = this.browserModal || {};
        const isParts = b.isParts || b.title?.startsWith('Parts:');
        const manifest = b.manifest || [];

        return html`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                ${isParts ? html`
                    <sutram-scroll-view padding="0">
                        ${manifest.length > 0 ? html`
                            <div style="display: flex; align-items: center; gap: 10px; background: var(--input-bg); border-bottom: 1px solid var(--border); padding: 15px 20px; flex-shrink: 0;">
                                <yv-icon name="package" style="width: 18px; height: 18px; color: var(--intent-highlight); flex-shrink: 0;"></yv-icon>
                                <span style="font-weight: bold; color: var(--intent-highlight); word-break: break-all;">${manifest[0].includes('/') ? manifest[0].split('/').pop() : manifest[0]}</span>
                            </div>
                            ${manifest.map((f, idx) => {
                                const fetchUrl = `${resolveFileFetchUrl(f, false)}&download=1`;
                                const partMatch = f.match(/_part(\d+)/i);
                                const displayTitle = partMatch ? `Part ${partMatch[1]}` : `Part ${idx + 1}`;
                                return html`
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 20px;">
                                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                                            <yv-icon name="puzzle" style="width: 18px; height: 18px; color: var(--text-muted); flex-shrink: 0;"></yv-icon>
                                            <span style="font-weight: bold; color: var(--text);">${displayTitle}</span>
                                        </div>
                                        <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                            <sutram-async-btn label="View" icon="eye" intent="neutral" size="sm" .onClick=${async () => { if (window.inSetu.vfs.viewAndCopy) window.inSetu.vfs.viewAndCopy(f); }}></sutram-async-btn>
                                            <sutram-async-btn label="Download" icon="download" intent="primary" size="sm" .onClick=${async () => { await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl); }}></sutram-async-btn>
                                        </div>
                                    </div>
                                `;
                            })}
                        ` : ''}
                    </sutram-scroll-view>
                ` : html`
                    <insetu-file-tree 
                        basePath=""
                        .files=${manifest}
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
            ${isParts ? html`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                    <sutram-async-btn label="Download All" icon="download" intent="primary" style="flex: 1; margin: 0;" .onClick=${async () => {
                        for (const f of manifest) {
                            await window.inSetu.vfs.fetchAndDownloadState(f, `${resolveFileFetchUrl(f, false)}&download=1`);
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }}></sutram-async-btn>
                    ${!!navigator.share && !!navigator.canShare ? html`
                        <sutram-async-btn label="Share All" icon="share" intent="neutral" style="flex: 1; margin: 0;" .onClick=${async () => {
                            if (manifest.length > 0) {
                                const firstFile = manifest[0];
                                const cleanFirst = firstFile.includes('/') ? firstFile.split('/').pop() : firstFile;
                                await shareFiles(cleanFirst, manifest, false);
                            }
                        }}></sutram-async-btn>
                    ` : ''}
                </div>
            ` : (this.browserConfig?.mode === 'folder' ? html`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                    <sutram-btn intent="neutral" icon="x" label="Cancel" style="flex: 1; margin: 0;" @click=${closeBrowseModal}></sutram-btn>
                    <sutram-async-btn label="Select This Folder" icon="check-circle-2" intent="success" style="flex: 2; margin: 0;" .onClick=${confirmFolderSelection}></sutram-async-btn>
                </div>
            ` : '')}
        `;
    }
}
customElements.define('insetu-browser-projection', InSetuBrowserProjection);
export class InSetuFileDiffProjection extends InSetuElement {
    static properties = {
        filepath: { type: String },
        _loading: { type: Boolean },
        _error: { type: String },
        _headContent: { type: String },
        _workingContent: { type: String },
        _isUntracked: { type: Boolean },
        _hasUnsavedBuffer: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
        }
    `];

    constructor() {
        super();
        this.filepath = '';
        this._loading = false;
        this._error = '';
        this._headContent = '';
        this._workingContent = '';
        this._isUntracked = false;
        this._hasUnsavedBuffer = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.filepath && this.dataset.subId?.startsWith('vfs:diff:')) {
            this.filepath = this.dataset.subId.replace('vfs:diff:', '');
        }
        this.subscribe(
            FsStore,
            state => {
                if (!this.filepath) return null;
                const normFp = normalizeVfsURI(this.filepath);
                const buf = state.activeBuffers?.[normFp] || state.activeBuffers?.[this.filepath];
                return (buf && buf.isFS && buf.content !== undefined && buf.content !== 'Loading...')
                    ? { content: buf.content, originalContent: buf.originalContent }
                    : null;
            },
            (buf) => {
                if (buf) {
                    this._workingContent = buf.content;
                    this._hasUnsavedBuffer = buf.content !== buf.originalContent;
                    this.requestUpdate();
                }
            }
        );
        if (this.filepath) {
            this._fetchDiff();
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') && this.filepath) {
            this._fetchDiff();
        }
    }

    async _fetchDiff() {
        if (!this.filepath) return;
        this._loading = true;
        this._error = '';
        try {
            const normFp = normalizeVfsURI(this.filepath);
            const res = await window.inSetu.api.workspace.get(`fs/git_diff?file=${encodeURIComponent(normFp)}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            this._headContent = data.head_content || '';
            this._isUntracked = !!data.is_untracked;

            const buf = FsStore.getState().activeBuffers?.[normFp] || FsStore.getState().activeBuffers?.[this.filepath];
            if (buf && buf.isFS && buf.content !== undefined && buf.content !== 'Loading...') {
                this._workingContent = buf.content;
                this._hasUnsavedBuffer = buf.content !== buf.originalContent;
            } else {
                this._workingContent = data.working_content || '';
                this._hasUnsavedBuffer = false;
            }
        } catch (e) {
            this._error = e.message || 'Failed to load Git diff.';
        } finally {
            this._loading = false;
        }
    }

    render() {
        if (this._loading) {
            return html`<div style="padding: 20px;"><sutram-spinner text="Comparing against Git HEAD..."></sutram-spinner></div>`;
        }
        if (this._error) {
            return html`<div style="padding: 20px; color: var(--intent-danger); font-family: var(--font-mono);">Error: ${this._error}</div>`;
        }

        const rightLabel = this._hasUnsavedBuffer
            ? 'Working Buffer (Unsaved Edits)'
            : 'Working Tree (Disk)';
        const leftLabel = this._isUntracked
            ? 'Git HEAD (Untracked / New File)'
            : 'Git HEAD (Committed)';
        return html`
            <div style="padding: 8px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-shrink: 0;">
                <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${normalizeVfsURI(this.filepath)}
                </span>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                    <sutram-btn size="sm" intent="neutral" icon="refresh-cw" label="Refresh" @click=${() => this._fetchDiff()}></sutram-btn>
                    <sutram-btn size="sm" intent="primary" icon="edit-3" label="Open Editor" @click=${() => viewSourceFile(this.filepath, true)}></sutram-btn>
                </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0;">
                <sutram-diff-viewer
                    .searchStr=${this._headContent}
                    .replaceStr=${this._workingContent}
                    .leftTitle=${leftLabel}
                    .rightTitle=${rightLabel}>
                </sutram-diff-viewer>
            </div>
        `;
    }
}
customElements.define('insetu-file-diff-projection', InSetuFileDiffProjection);

// Isolate VFS-specific dirty state checks
window.addEventListener('beforeunload', (e) => {
    const buffers = Object.values(FsStore.getState().activeBuffers || {});
    const hasUnsaved = buffers.some(b => b.isFS && b.content !== b.originalContent);
    if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
    }
});
