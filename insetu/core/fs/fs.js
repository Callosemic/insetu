import { LitElement, html } from 'lit';
import {
    InSetuElement,
    createExtensionStore,
    sharedStyles,
    buildFileTree,
    resolveDirectoryState,
    downloadFile as sutramDownloadFile,
    downloadBlob,
    bindGhostDrag
} from '/static/extensions/system/insetu_sdk.js';

import { resolveEditorMode, insertLinkToEditor, openEditorLinkTarget, isMarkdownLinksEnabled } from '/static/extensions/system/components/ui_editor.js';
import { AppStore, SelectionStore } from '/static/extensions/system/store.js';
import {
    FsStore,
    normalizeVfsURI,
    isBufferReadOnly,
    hasMacroSyntax,
    canPreviewFileMacros,
    resolveLiveBufferPreview,
    injectTextToBuffer,
    prepareBufferSavePayload,
    rebaseConcurrentText,
    saveBufferFile,
    reconcileBufferWithDisk,
    flushAllDirtyBuffers,
    renameFileTracking,
    hydrateVfsBuffer,
    extractManifestFiles,
    resolveFileFetchUrl,
    getChunks,
    syncVirtualBuffer,
    preCacheFiles,
} from '/static/extensions/fs/fs_store.js';
import {
    InSetuEditorProjection,
    InSetuFrontmatterEditor,
    InSetuFileDiffProjection,
} from '/static/extensions/fs/fs_editor_projection.js';
import {
    InSetuBrowserProjection,
    InSetuLinkInsertProjection,
    InSetuMoveFileProjection,
    InSetuNewFileProjection,
    InSetuNewFolderProjection,
} from '/static/extensions/fs/fs_modals.js';

export {
    FsStore,
    normalizeVfsURI,
    isBufferReadOnly,
    hasMacroSyntax,
    canPreviewFileMacros,
    resolveLiveBufferPreview,
    injectTextToBuffer,
    prepareBufferSavePayload,
    rebaseConcurrentText,
    saveBufferFile,
    reconcileBufferWithDisk,
    flushAllDirtyBuffers,
    renameFileTracking,
    hydrateVfsBuffer,
    extractManifestFiles,
    resolveFileFetchUrl,
    getChunks,
    syncVirtualBuffer,
    preCacheFiles,
    InSetuEditorProjection,
    InSetuFrontmatterEditor,
    InSetuFileDiffProjection,
    InSetuBrowserProjection,
    InSetuLinkInsertProjection,
    InSetuMoveFileProjection,
    InSetuNewFileProjection,
    InSetuNewFolderProjection,
};
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
export function resolveConflictOriginalPath(filepath) {
    if (!filepath || typeof filepath !== 'string') return null;
    const match = filepath.match(/^(.*)\.conflict(?:ed)?_\d+(\.[^./]+)?$/);
    if (!match) return null;
    return `${match[1]}${match[2] || ''}`;
}

export async function viewTwoFileDiff(leftFilepath, rightFilepath) {
    if (!leftFilepath || !rightFilepath) return;
    const normLeft = normalizeVfsURI(leftFilepath);
    const normRight = normalizeVfsURI(rightFilepath);
    const rightBase = normRight.split('/').pop();
    const cleanName = window.inSetu?.utils?.truncateFilename
        ? window.inSetu.utils.truncateFilename(rightBase, 22)
        : rightBase;

    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({
            id: `vfs:pairdiff:${normLeft}::${normRight}`,
            component: 'insetu-file-diff-projection',
            label: `Compare: ${cleanName}`,
            icon: 'git-compare',
            intent: 'highlight',
            extName: 'fs',
            windowOnly: true,
            props: {
                filepath: normLeft,
                compareFilepath: normRight
            }
        }, layout.focusedColumn || 'center', 1);
    }
}
export async function viewFileGitDiff(filepath) {
    if (!filepath) return;
    const baseName = new window.inSetu.utils.InSetuURI(filepath).basename;
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

window.inSetu = window.inSetu || {};
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.stores.Fs = FsStore;
Object.defineProperty(window.inSetu.vfs, 'shareTextCache', {
    get: () => FsStore.getState().shareTextCache,
    configurable: true
});

export function routeToSpatialGrid(filepath, label = null, preferredCol = null) {
    if (!window.Sutram?.stores?.Layout) return;
    if (window.inSetu?.ui?.focusActivePopout && window.inSetu.ui.focusActivePopout(filepath)) {
        return;
    }
    const layout = window.Sutram.stores.Layout.getState();
    const baseName = new window.inSetu.utils.InSetuURI(filepath).basename;
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
    const parsedUri = new window.inSetu.utils.InSetuURI(filePath);
    if (!parsedUri.isCompiledArtifact) return;
    const responses = window.inSetu?.events?.emitHookAll
        ? window.inSetu.events.emitHookAll('insetu:ensure-fresh-artifact', { filepath: filePath, uri: parsedUri })
        : [window.inSetu?.events?.emitHook?.('insetu:ensure-fresh-artifact', { filepath: filePath, uri: parsedUri })];
    const validPromises = (responses || []).filter(Boolean);
    if (validPromises.length > 0) {
        await Promise.all(validPromises);
        if (window.inSetu?.sys?.refreshManifest) {
            await window.inSetu.sys.refreshManifest();
        }
    }
}
export async function fetchAndCopy(filePath, explicitUrl = null) {
    try {
        await ensureFreshContext(filePath);
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const resolvedChunks = getChunks(filePath);
        const targetFile = (resolvedChunks && resolvedChunks.length > 0) ? resolvedChunks[0] : filePath;
        const fetchUrl = (targetFile === filePath && explicitUrl) ? explicitUrl : resolveFileFetchUrl(targetFile, false);
        const res = await window.inSetu.api.request(fetchUrl, {}, activeWs);

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
        await ensureFreshContext(filePath);
        const resolvedChunks = getChunks(filePath);
        const targetFile = (resolvedChunks && resolvedChunks.length > 0 && !resolvedChunks.includes(filePath)) ? resolvedChunks[0] : filePath;
        const fetchUrl = (targetFile === filePath && explicitUrl) ? explicitUrl : `${resolveFileFetchUrl(targetFile)}&download=1`;
        await downloadFile(fetchUrl, new window.inSetu.utils.InSetuURI(targetFile).basename);
        window.inSetu.ui.setGlobalStatus("✅ Downloaded!", 2000);
    } catch (e) {
        window.inSetu.ui.setGlobalStatus("❌ Error: " + e.message, 3000, true);
    }
}
export function shareFiles(baseFile, chunks = null, isFS = false) {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const manifestChunks = getChunks(baseFile);
    const filesToFetch = (manifestChunks && manifestChunks.length > 0)
        ? manifestChunks
        : ((chunks && chunks.length > 0) ? chunks : [baseFile]);

    // Synchronous Fast-Path
    if (filesToFetch.length > 0 && filesToFetch.every(fp => window.inSetu.vfs.shareTextCache.has(fp))) {
        try {
            const fileObjects = filesToFetch.map(filepath => ({
                content: window.inSetu.vfs.shareTextCache.get(filepath),
                filename: new window.inSetu.utils.InSetuURI(filepath).basename
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
    // Asynchronous On-Demand Fetch & Share Fallback (leaves drawer open if WebKit requires a second tap)
    (async () => {
        try {
            if (window.inSetu?.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus("⏳ Preparing files for Share...", null);
            }
            await ensureFreshContext(baseFile);
            const refreshedChunks = getChunks(baseFile);
            const effectiveFiles = (refreshedChunks && refreshedChunks.length > 0) ? refreshedChunks : filesToFetch;
            const fileObjects = [];

            for (const filepath of effectiveFiles) {
                const fileIsFS = (effectiveFiles.length > 1) ? false : isFS;
                const fetchUrl = resolveFileFetchUrl(filepath, fileIsFS);

                const textContent = await window.inSetu.api.fetchImmutableText(fetchUrl, { onlyIfMissing: true }, activeWs);
                window.inSetu.vfs.shareTextCache.set(filepath, textContent);
                fileObjects.push({
                    content: textContent,
                    filename: new window.inSetu.utils.InSetuURI(filepath).basename
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
    const hydrationPromise = hydrateVfsBuffer(targetFile, { isFS: false, forceReload: true });
    routeToSpatialGrid(targetFile);
    closeBrowseModal();
    await hydrationPromise;
}
export async function viewAndCopy(filename) {
    await ensureFreshContext(filename);
    const chunks = getChunks(filename);
    const targetFile = (chunks && chunks.length > 0 && !chunks.includes(filename)) ? chunks[0] : filename;
    const browserState = AppStore.getState().browserConfig;
    const isParts = browserState && browserState.isParts;
    const hydrationPromise = hydrateVfsBuffer(targetFile, { isFS: false, forceReload: true });
    routeToSpatialGrid(targetFile);
    if (!isParts) {
        closeBrowseModal();
    }
    await hydrationPromise;
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
    // Support both explicit relocated_to/relocated_from metadata and legacy 2-item move pairs
    let fallbackMoveSource = null;
    let fallbackMoveDest = null;
    if (mutations.length === 2) {
        const delMut = mutations.find(m => m.operation === 'delete' && m.filepath);
        const savMut = mutations.find(m => m.operation === 'save' && m.filepath);
        if (delMut && savMut && (delMut.relocated_to || savMut.relocated_from)) {
            fallbackMoveSource = trimTrailingSlash(delMut.filepath);
            fallbackMoveDest = trimTrailingSlash(savMut.filepath);
        }
    }
    (mutations || []).forEach(m => {
        const normPath = trimTrailingSlash(m.filepath);
        if (!normPath) return;
        const moveDest = m.relocated_to ? trimTrailingSlash(m.relocated_to) : fallbackMoveDest;
        const isRelocatedSave = Boolean(m.relocated_from || fallbackMoveSource);

        // Centralized Cache Invalidation
        if (window.inSetu?.vfs?.shareTextCache?.has(normPath)) {
            window.inSetu.vfs.shareTextCache.delete(normPath);
        }
        const nowSec = Date.now() / 1000;
        if (m.operation === 'delete') {
            ['vfs', 'ctx'].forEach(manifestKey => {
                Object.keys(newManifest[manifestKey]).forEach(key => {
                    const obj = newManifest[manifestKey][key];
                    if (obj.files) {
                        const origLen = obj.files.length;
                        const newFiles = [];
                        let bucketTouched = false;
                        obj.files.forEach(f => {
                            if (f === normPath) {
                                if (moveDest && !newFiles.includes(moveDest)) newFiles.push(moveDest);
                                changed = true;
                                bucketTouched = true;
                            } else if (f.startsWith(normPath + '/')) {
                                if (moveDest) {
                                    const newChild = moveDest + f.substring(normPath.length);
                                    if (!newFiles.includes(newChild)) newFiles.push(newChild);
                                }
                                changed = true;
                                bucketTouched = true;
                            } else {
                                newFiles.push(f);
                            }
                        });
                        if (newFiles.length !== origLen || bucketTouched) {
                            const nextObj = { ...obj, files: newFiles };
                            if (manifestKey === 'vfs') nextObj.source_ts = nowSec;
                            newManifest[manifestKey][key] = nextObj;
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
            if (isRelocatedSave) return;

            Object.entries(newManifest.vfs).forEach(([bKey, obj]) => {
                if (obj && Array.isArray(obj.files) && obj.files.includes(normPath)) {
                    newManifest.vfs[bKey] = { ...obj, source_ts: nowSec };
                    changed = true;
                }
            });
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
    const parsed = new window.inSetu.utils.InSetuURI(normPath);

    const manifestChunks = getChunks(normPath);
    const chunks = (manifestChunks && manifestChunks.length > 0)
        ? manifestChunks
        : ((data.chunks && data.chunks.length > 0) ? data.chunks : []);

    if (parsed.isCompiledArtifact || (chunks && chunks.length > 1)) {
        return {
            mode: 'chunks',
            chunks: (chunks && chunks.length > 0) ? chunks : [normPath],
            isFS: false
        };
    }
    const resolvedBaseName = rawPath ? new window.inSetu.utils.InSetuURI(rawPath).basename : '';
    const activeBuf = FsStore.getState().activeBuffers?.[normPath] || FsStore.getState().activeBuffers?.[rawPath];
    if (activeBuf && (activeBuf.isFS || activeBuf.forceEdit)) {
        const fullText = activeBuf.isTruncated ? activeBuf.fullText : activeBuf.content;
        if (fullText !== undefined && fullText !== 'Loading...') {
            return { mode: 'memory', text: fullText, filename: resolvedBaseName || 'export.txt' };
        }
    }
    if (data.transientContent !== undefined && !activeBuf?.previewMode) {
        return { mode: 'memory', text: data.transientContent, filename: resolvedBaseName || 'export.txt' };
    }
    return {
        mode: 'chunks',
        chunks: [normPath || rawPath],
        isFS: true
    };
}

export async function resolveExpandedExportText(data = {}) {
    const rawPath = data.filepath || '';
    const normPath = normalizeVfsURI(rawPath) || rawPath;
    const resolvedBaseName = normPath ? new window.inSetu.utils.InSetuURI(normPath).basename : 'export.txt';
    const activeBuf = FsStore.getState().activeBuffers?.[normPath] || FsStore.getState().activeBuffers?.[rawPath];

    if (activeBuf?.previewMode && typeof activeBuf.previewContent === 'string' && !activeBuf.previewLoading) {
        return { text: activeBuf.previewContent, filename: resolvedBaseName };
    }
    if (activeBuf && activeBuf.content !== undefined && activeBuf.content !== 'Loading...') {
        const rawSource = activeBuf.isTruncated ? (activeBuf.fullText ?? activeBuf.content) : activeBuf.content;
        const isDirty = activeBuf.content !== activeBuf.originalContent;
        const expanded = await resolveLiveBufferPreview(normPath, rawSource, isDirty);
        return { text: expanded, filename: resolvedBaseName };
    }
    if (data.transientContent !== undefined) {
        const expanded = await resolveLiveBufferPreview(normPath, data.transientContent, true);
        return { text: expanded, filename: resolvedBaseName };
    }
    const expanded = await resolveLiveBufferPreview(normPath, null, false);
    return { text: expanded || '', filename: resolvedBaseName };
}

window.addEventListener('blur', () => {
    flushAllDirtyBuffers(false);
});
window.addEventListener('focus', () => {
    const buffers = FsStore.getState().activeBuffers || {};
    Object.keys(buffers).forEach(fp => {
        const b = buffers[fp];
        if (b && b.isFS && b.content === b.originalContent) {
            reconcileBufferWithDisk(fp);
        }
    });
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        flushAllDirtyBuffers(false);
    } else {
        const buffers = FsStore.getState().activeBuffers || {};
        Object.keys(buffers).forEach(fp => {
            const b = buffers[fp];
            if (b && b.isFS && b.content === b.originalContent) {
                reconcileBufferWithDisk(fp);
            }
        });
    }
});

window.addEventListener('sutram-outbox-item-synced', async (e) => {
    const { path, bodyString, responseData } = e.detail || {};
    if (!path || !path.endsWith('/fs/save') || !bodyString) return;
    try {
        const sentPayload = JSON.parse(bodyString);
        const fp = normalizeVfsURI(sentPayload.filepath || '');
        const buf = FsStore.getState().activeBuffers?.[fp];
        if (!buf) return;

        const serverMergedText = (responseData && responseData.status === 'merged' && typeof responseData.merged_content === 'string')
            ? responseData.merged_content
            : null;
        const confirmedText = serverMergedText !== null ? serverMergedText : sentPayload.content;
        let nextHash = responseData?.base_hash || null;
        if (!nextHash && confirmedText !== undefined) {
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(confirmedText));
            nextHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        let canAdvanceBase = true;
        let mergedContent = null;

        if (serverMergedText !== null) {
            const rebased = rebaseConcurrentText(sentPayload.content, buf.content, serverMergedText);
            if (rebased.clean) {
                mergedContent = rebased.merged;
            } else {
                canAdvanceBase = false;
            }
        }
        const ancestorSet = new Set(buf.ancestorHashes || []);
        if (buf.baseHash) ancestorSet.add(buf.baseHash);
        if (nextHash) ancestorSet.add(nextHash);

        const patch = {
            saveStatus: 'idle',
            lastSavedAt: Date.now(),
            ancestorHashes: Array.from(ancestorSet).slice(-50)
        };

        if (canAdvanceBase) {
            patch.originalContent = confirmedText;
            patch.baseHash = nextHash;
        }

        if (mergedContent !== null) {
            patch.content = mergedContent;
            patch.fullText = mergedContent;
        }

        if (buf.content === confirmedText || (patch.content && patch.content === confirmedText)) {
            patch.savedRevision = buf.docRevision || 0;
        }
        FsStore.getState().updateBuffer(fp, patch);
    } catch (_) {}
});

window.addEventListener('sutram-projections-migrated', (e) => {
    const migrationMap = e.detail?.migrationMap || {};
    const tPaths = AppStore.getState().tabBrowsePaths || {};
    let changed = false;
    const updatedPaths = { ...tPaths };
    for (const [oldKey, newKey] of Object.entries(migrationMap)) {
        if (updatedPaths[oldKey]) {
            updatedPaths[newKey] = updatedPaths[oldKey];
            delete updatedPaths[oldKey];
            changed = true;
        }
    }
    if (changed) {
        AppStore.setState({ tabBrowsePaths: updatedPaths });
    }
});

export async function executeMove() {
    const { currentFile, destPath } = FsStore.getState().modals.move;
    if (!destPath || destPath === currentFile) return alert("Please enter a valid new destination path.");

    const normCurrent = normalizeVfsURI(currentFile);
    const normDest = normalizeVfsURI(destPath);
    const activeBuffers = FsStore.getState().activeBuffers || {};
    const buffer = activeBuffers[normCurrent] || activeBuffers[currentFile];
    if (buffer && buffer.isFS && buffer.content !== buffer.originalContent) {
        const baseName = new window.inSetu.utils.InSetuURI(normCurrent).basename;
        if (confirm(`"${baseName}" has unsaved changes. Save changes and continue moving? (Click Cancel to abort move)`)) {
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
            AppStore.getState().setBrowsePath(parts, 'files');
            refreshActiveFileViews(normPath, null);
        }
    });
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
        static get extensionName() { return 'fs'; }
        static properties = {
                searchQuery: { type: String },
                manifestFiles: { type: Array },
                browsePath: { type: Array },
                loading: { type: Boolean }
        };
        static styles = [sharedStyles];
        constructor() {
                super();
                this.searchQuery = '';
                this.manifestFiles = [];
                this.browsePath = [];
                this.loading = false;
        }
        _getSubKey() {
                return this.dataset?.subId || 'fs:files';
        }
        connectedCallback() {
                super.connectedCallback();
                this.subscribe(
                        AppStore,
                        state => {
                                const subKey = this._getSubKey();
                                const tPaths = state.tabBrowsePaths || {};
                                return {
                                        manifestFiles: state.derivedVfsFiles || [],
                                        browsePath: tPaths[subKey] || tPaths['fs:files'] || tPaths['files'] || []
                                };
                        },
                        ({ manifestFiles, browsePath }) => {
                                this.manifestFiles = manifestFiles;
                                this.browsePath = browsePath;
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
                this.browsePath = initState.getBrowsePath ? initState.getBrowsePath(this._getSubKey()) : [];
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
                AppStore.getState().setBrowsePath(e.detail.path || [], this._getSubKey());
        }
        render() {
            if (this.manifestFiles.length === 0 && !this.loading) {
                return html`<sutram-empty-state text="No repositories configured."></sutram-empty-state>`;
            }
            return html`
                <sutram-view ?flush=${true} ?noScroll=${true}>
                    ${this.loading ? html`
                        <sutram-surface slot="header" variant="panel" border="bottom" padding="sm">
                            <sutram-spinner text="Refreshing file system..."></sutram-spinner>
                        </sutram-surface>
                    ` : ''}
                    <insetu-file-tree    
                        @card-clicked=${(e) => { if(e.detail.isSource && window.inSetu.vfs.viewSourceFile) window.inSetu.vfs.viewSourceFile(e.detail.filename, true); }}
                        basePath=""
                        .files=${this.manifestFiles}
                        .currentPath=${this.browsePath}
                        .hidePath=${false}
                        .enableSearch=${true}
                        searchPlaceholder="Fuzzy search files..."
                        entityType="file"
                        @path-changed=${this._handlePathChange}>
                    </insetu-file-tree>
                </sutram-view>
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
        const destBaseUri = new window.inSetu.utils.InSetuURI(cleanDest || 'vfs://');
        const operations = [];
        for (const target of targets) {
            const srcUri = new window.inSetu.utils.InSetuURI(target.path);
            const destUriStr = destBaseUri.join(srcUri.basename);
            if (destUriStr === srcUri.toString()) continue;
            if (target.isDir && (destUriStr === srcUri.toString() || destUriStr.startsWith(srcUri.toString() + '/'))) {
                console.warn(`Cannot move directory '${target.path}' into itself or its own subfolder.`);
                continue;
            }
            operations.push({
                action: 'move',
                filepath: srcUri.toString(),
                dest_path: destUriStr,
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
        onSuccess: () => {
            SelectionStore.getState().clearSelection();
            if (window.inSetu.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(`Archived ${operations.length} item(s)`, 3000);
            }
        }
    });
}

export async function executeDownloadZip(items, archiveName = null) {
    const targets = pruneSubsumedTargets(items);
    if (targets.length === 0) return;

    await flushAllDirtyBuffers(false);
    const payloadItems = targets.map(t => ({
        filepath: t.isDir ? `${t.path}/` : t.path,
        folderpath: t.isDir ? t.path : undefined,
        isDir: Boolean(t.isDir)
    }));
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const fallbackName = archiveName || (
        targets.length === 1
            ? `${new window.inSetu.utils.InSetuURI(targets[0].path).basename || 'archive'}.zip`
            : 'workspace_selection.zip'
    );
    if (window.inSetu.ui?.setGlobalStatus) {
        window.inSetu.ui.setGlobalStatus("⏳ Packing ZIP archive...", null);
    }
    try {
        await downloadFile(
            `/api/${activeWs}/fs/download_zip`,
            fallbackName,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payloadItems, archive_name: archiveName || undefined })
            }
        );
        SelectionStore.getState().clearSelection();
        if (window.inSetu.ui?.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus("✅ Downloaded ZIP archive!", 2500);
        }
    } catch (err) {
        if (window.inSetu.ui?.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus(`❌ ZIP Error: ${err.message}`, 3000, true);
        } else {
            alert("Failed to download ZIP archive: " + err.message);
        }
    }
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
function _buildVfsExplorerMenuActions(slotCfg = {}) {
    const subKey = slotCfg?.id || 'fs:files';
    const browsePath = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath(subKey) : [];
    const currentPath = browsePath.join('/');
    const items = [];
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
    return items;
}
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
        },
        'sutram:rekey-projection-id': ({ id, mapSegment }) => {
            if (!id || typeof id !== 'string' || typeof mapSegment !== 'function') return null;
            if (id.startsWith('vfs:diff:')) {
                const target = id.slice('vfs:diff:'.length);
                const mapped = mapSegment(target);
                return mapped !== target ? `vfs:diff:${mapped}` : id;
            }
            if (id.startsWith('vfs:pairdiff:')) {
                const pairStr = id.slice('vfs:pairdiff:'.length);
                const [leftFp, rightFp] = pairStr.split('::');
                const nextLeft = mapSegment(leftFp || '');
                const nextRight = mapSegment(rightFp || '');
                if (nextLeft !== (leftFp || '') || nextRight !== (rightFp || '')) {
                    return `vfs:pairdiff:${nextLeft}::${nextRight}`;
                }
            }
            return null;
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
                    const srcUri = new window.inSetu.utils.InSetuURI(data.folderpath || data.filepath);
                    openFolderBrowser(async (destParent) => {
                        if (destParent === undefined || destParent === null) return;
                        const destBaseUri = new window.inSetu.utils.InSetuURI(destParent);
                        const normDest = destBaseUri.join(srcUri.basename);
                        if (normDest === srcUri.toString() || normDest.startsWith(srcUri.toString() + '/')) {
                            alert("Cannot move a folder into itself or a subfolder.");
                            return;
                        }
                        await _relocateVfsNode(srcUri.toString(), normDest, true, { loadingText: 'Moving folder...' });
                    });
                } else {
                    const srcUri = new window.inSetu.utils.InSetuURI(data.filepath);
                    const parts = srcUri.pathSegments;
                    parts.pop();
                    window.inSetu.stores.Fs.getState().setModal('move', { open: false, currentFile: srcUri.toString(), destPath: srcUri.toString(), initialParts: parts });
                    if (window.Sutram?.stores?.Layout) {
                        const layout = window.Sutram.stores.Layout.getState();
                        layout.openWindow({
                            id: 'vfs:move-file',
                            component: 'insetu-move-file-projection',
                            label: `Move: ${srcUri.basename}`,
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
            match: (data) => {
                if (data.isSkeleton || !(data.isFS || data.isDir)) return false;
                const uri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                if (data.isDir && uri.isRootVolume) return false;
                return Boolean(uri.basename);
            },
            asyncAction: async (data, e) => {
                const srcUri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                const currentName = srcUri.basename;
                const rawNewName = prompt(`Enter new ${data.isDir ? 'folder' : 'file'} name:`, currentName);
                if (!rawNewName) return;
                const newName = rawNewName.trim().replace(/^\/+|\/+$/g, '');
                if (!newName || newName === currentName) return;
                const destPath = srcUri.withName(newName);
                await _relocateVfsNode(srcUri.toString(), destPath, !!data.isDir, { loadingText: 'Renaming...' });
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
                const targetUri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                const label = data.isDir ? `folder "${targetUri.basename}"` : `this file`;
                if (!confirm(`Archive ${label} to an 'archived/' directory?`)) return;
                await _archiveVfsNode(targetUri.toString(), !!data.isDir, { loadingText: 'Archiving...' });
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
                const targetUri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                const label = data.isDir ? `folder "${targetUri.basename}" and all its contents` : `this file`;
                if (!confirm(`Permanently delete ${label}? This cannot be undone!`)) return;
                await _deleteVfsNode(targetUri.toString(), !!data.isDir, { loadingText: 'Deleting...' });
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
                    window.inSetu.vfs.viewSourceFile(data.filepath, data.isFS || false, false, { previewMode: false });
                }
            }
        },
        {
            targetEntity: 'file',
            id: 'file-preview',
            label: 'Preview',
            icon: 'eye',
            group: 'edit',
            vfsBound: false,
            intent: 'highlight',
            order: 10.5,
            match: (data) => {
                if (data.isSkeleton || data.isDir) return false;
                return Boolean(data.hasMacros || canPreviewFileMacros(data.filepath));
            },
            onClick: (data, e) => {
                if (window.inSetu.vfs.viewSourceFile) {
                    window.inSetu.vfs.viewSourceFile(data.filepath, data.isFS || false, false, { previewMode: true });
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
            id: 'file-conflict-diff',
            label: 'Diff Original',
            icon: 'git-compare',
            group: 'edit',
            vfsBound: false,
            intent: 'highlight',
            order: 11.5,
            match: (data) => {
                if (data.isSkeleton || data.isDir) return false;
                return Boolean(resolveConflictOriginalPath(data.filepath));
            },
            onClick: (data, e) => {
                const origPath = resolveConflictOriginalPath(data.filepath);
                if (origPath) {
                    viewTwoFileDiff(origPath, data.filepath);
                }
            }
        },
        {
            targetEntity: 'file',
            targetEntities: ['file'],
            id: 'vfs-compare-selected',
            bulkGroupKey: 'compare',
            label: 'Compare Selected (2)',
            icon: 'git-compare',
            group: 'file',
            vfsBound: false,
            intent: 'highlight',
            order: 63,
            bulkable: true,
            match: (data) => {
                if (data.isSkeleton || data.isDir) return false;
                const selMap = SelectionStore.getState()?.selectedItems;
                if (!selMap || selMap.size !== 2) return false;
                const items = Array.from(selMap.values());
                return items.every(i => !(i.data?.isDir || i.isDir));
            },
            onClick: () => {
                const selMap = SelectionStore.getState()?.selectedItems;
                if (!selMap || selMap.size !== 2) return;
                const paths = Array.from(selMap.values()).map(i => i.data?.filepath || i.filepath).filter(Boolean);
                if (paths.length === 2) {
                    const [a, b] = paths;
                    // Always place the base file on the Left and the .conflict_ file on the Right
                    if (resolveConflictOriginalPath(a)) {
                        viewTwoFileDiff(b, a);
                    } else {
                        viewTwoFileDiff(a, b);
                    }
                    SelectionStore.getState().clearSelection();
                }
            },
            bulkAction: (items) => {
                const fileItems = (items || []).filter(i => !(i.data?.isDir || i.isDir));
                if (fileItems.length !== 2) {
                    alert("Please select exactly 2 files to compare side-by-side.");
                    return;
                }
                const a = fileItems[0].data?.filepath || fileItems[0].filepath;
                const b = fileItems[1].data?.filepath || fileItems[1].filepath;
                if (resolveConflictOriginalPath(a)) {
                    viewTwoFileDiff(b, a);
                } else {
                    viewTwoFileDiff(a, b);
                }
                SelectionStore.getState().clearSelection();
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
                const preTarget = resolveEntityExportTarget(data);
                if (preTarget.mode === 'memory') {
                    await navigator.clipboard.writeText(preTarget.text).then(() => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
                    }).catch(err => alert("Clipboard API failed. Please manually select the text and copy it directly."));
                    return;
                }
                await ensureFreshContext(data.filepath);
                const target = resolveEntityExportTarget(data);
                const primaryFile = target.chunks[0] || data.filepath;
                const fetchUrl = resolveFileFetchUrl(primaryFile, target.isFS);
                await fetchAndCopy(primaryFile, fetchUrl);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-copy-expanded',
            label: 'Copy Expanded',
            icon: 'sparkles',
            group: 'edit',
            vfsBound: false,
            intent: 'highlight',
            order: 12.5,
            match: (data) => {
                if (data.isSkeleton || data.isDir) return false;
                return Boolean(data.supportsMacroPreview || data.hasMacros || canPreviewFileMacros(data.filepath, data.transientContent || ''));
            },
            asyncAction: async (data, e) => {
                const { text } = await resolveExpandedExportText(data);
                await navigator.clipboard.writeText(text).then(() => {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied Expanded!", 2000);
                }).catch(err => alert("Clipboard API failed. Please manually select the text and copy it directly."));
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
            keepDrawerOpen: true,
            intent: 'primary',
            order: 15,
            match: (data) => {
                if (data.isSkeleton) return false;
                return !!navigator.share && !!navigator.canShare;
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
            id: 'file-share-expanded',
            label: 'Share Expanded',
            icon: 'sparkles',
            group: 'share',
            vfsBound: false,
            keepDrawerOpen: true,
            intent: 'highlight',
            order: 15.5,
            match: (data) => {
                if (data.isSkeleton || data.isDir) return false;
                if (!navigator.share || !navigator.canShare) return false;
                return Boolean(data.supportsMacroPreview || data.hasMacros || canPreviewFileMacros(data.filepath, data.transientContent || ''));
            },
            onClick: (data, e) => {
                if (e) e.stopPropagation();
                resolveExpandedExportText(data).then(({ text, filename }) => {
                    window.inSetu.utils.nativeShareFiles([{ content: text || '', filename }]).catch(()=>{});
                });
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
                if (data.isSkeleton || !data.filepath) return false;
                const chunks = getChunks(data.filepath);
                return Boolean(chunks && chunks.length > 1);
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
            match: (data) => !data.isSkeleton && !data.isDir,
            asyncAction: async (data, e) => {
                const preTarget = resolveEntityExportTarget(data);
                if (preTarget.mode === 'memory') {
                    try {
                        const blob = new Blob([preTarget.text], { type: 'text/plain' });
                        downloadBlob(blob, preTarget.filename);
                        return;
                    } catch (err) {
                        alert("Error downloading file: " + err.message);
                        return;
                    }
                }
                await ensureFreshContext(data.filepath);
                const target = resolveEntityExportTarget(data);
                const chunks = target.chunks;
                if (chunks && chunks.length > 1) {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⬇️ Downloading multi-part context...", 2000);
                    for (const f of chunks) {
                        const fetchUrl = `${resolveFileFetchUrl(f, false)}&download=1`;
                        await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                        await new Promise(r => setTimeout(r, 300));
                    }
                } else {
                    const baseFetchUrl = resolveFileFetchUrl(data.filepath, true);
                    const fetchUrl = baseFetchUrl.includes('/fs/fetch?') ? `${baseFetchUrl}&download=1` : baseFetchUrl;
                    await window.inSetu.vfs.fetchAndDownloadState(data.filepath, fetchUrl);
                }
            }
        },
        {
            targetEntity: 'folder',
            targetEntities: ['file', 'folder'],
            id: 'vfs-download-zip',
            bulkGroupKey: 'download-zip',
            label: 'Download ZIP',
            bulkLabel: 'Download ZIP',
            icon: 'archive',
            group: 'file',
            vfsBound: false,
            intent: 'primary',
            order: 18.2,
            bulkable: true,
            match: (data) => !data.isSkeleton && Boolean(data.isDir || data.filepath || data.folderpath),
            asyncAction: async (data) => {
                await executeDownloadZip([data]);
            },
            bulkAction: async (items) => {
                await executeDownloadZip(items);
            }
        },
        {
            targetEntity: 'file',
            id: 'file-download-expanded',
            label: 'Download Expanded',
            icon: 'sparkles',
            group: 'file',
            vfsBound: false,
            intent: 'highlight',
            order: 18.5,
            match: (data) => {
                if (data.isSkeleton || data.isDir) return false;
                return Boolean(data.supportsMacroPreview || data.hasMacros || canPreviewFileMacros(data.filepath, data.transientContent || ''));
            },
            asyncAction: async (data, e) => {
                try {
                    const { text, filename } = await resolveExpandedExportText(data);
                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                    downloadBlob(blob, filename);
                    if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Downloaded Expanded!", 2000);
                } catch (err) {
                    alert("Error downloading expanded file: " + err.message);
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
            bulkActionGroup: "file",
            bulkEntityTypes: ["file", "folder"],
            menuStores: ["App"],
            menuActions: _buildVfsExplorerMenuActions,
            component: "insetu-vfs-explorer"
        }
    ]
});
export function getFileExtensionWarning(filename, basePath = '') {
    if (!filename) return '';
    const cleanBase = (basePath || '').replace(/^[a-zA-Z0-9_-]+:\/\//, '');
    const pathParts = cleanBase.split('/').filter(Boolean);
    const gbPath = pathParts.length > 0 ? pathParts : (AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath('fs:files') : []);
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
    const isObj = Boolean(overridePath && typeof overridePath === 'object');
    const gbPath = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath('fs:files') : [];
    const rawPrefix = typeof overridePath === 'string' ? overridePath : (isObj && typeof overridePath.basePath === 'string' ? overridePath.basePath : (gbPath.length > 0 ? `vfs://${gbPath.join('/')}/` : ''));
    const prefix = rawPrefix ? normalizeVfsURI(rawPrefix) : '';
    const fileName = isObj ? (overridePath.fileName || '') : '';
    const content = isObj ? (overridePath.content || '') : '';
    FsStore.getState().setModal('newFile', { open: true, basePath: prefix, fileName, content });
    if (window.Sutram?.stores?.Layout) {
        const layout = window.Sutram.stores.Layout.getState();
        layout.openWindow({ id: 'vfs:new-file', component: 'insetu-new-file-projection', label: 'Create New Workspace File', icon: 'file-plus', intent: 'primary', extName: 'fs', windowOnly: true }, layout.focusedColumn || 'center', 1);
    }
}
export async function saveNewFile() {
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
    const gbPath = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath('fs:files') : [];
    const isRoot = overridePath === null && gbPath.length === 0;
    const rawPrefix = typeof overridePath === 'string' ? overridePath : (isRoot ? '' : `vfs://${gbPath.join('/')}/`);
    const prefix = rawPrefix ? normalizeVfsURI(rawPrefix) : '';
    let exts = '.py, .json, .md, .sh, .txt, .html, .css, .js';
    let domain = 'Workspaces';
    if (isRoot) {
        try {
            const res = await window.inSetu.api.get('gather/repos/template');
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

export async function saveNewFolder() {
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
                const rRes = await window.inSetu.api.get('system/topology?t=' + Date.now());
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
export async function viewSourceFile(filepath, isFS = false, bypassHook = false, options = {}) {
    if (!filepath || typeof filepath !== 'string') return;
    const normPath = normalizeVfsURI(filepath);
    const wantPreview = Boolean(options && options.previewMode);

    if (!bypassHook) {
        // ADR 0041: Declarative Custom Editors Engine
        const registry = window.ExtensionRegistry;
        if (registry && typeof registry.resolveCustomEditor === 'function') {
            const customEd = registry.resolveCustomEditor(normPath);
            if (customEd && typeof customEd.onOpen === 'function') {
                customEd.onOpen(normPath);
                return;
            }
        }
    }
    const hydrationPromise = hydrateVfsBuffer(normPath, { isFS, forceReload: true, previewMode: wantPreview });
    routeToSpatialGrid(normPath);
    closeBrowseModal();
    await hydrationPromise;
    if (wantPreview) {
        await FsStore.getState().toggleBufferPreview(normPath, true);
    }
}
export function closeBrowseModal() {
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
    FsStore.getState().setModal('browser', { open: true, title, manifest: targetManifest, searchQuery: '', isParts, currentPath: cbPath });
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
export function openFolderBrowser(callback = null) {
    openWorkspaceBrowser({ mode: 'folder', title: 'Select Destination Folder', callback: callback });
}
export function confirmFolderSelection() {
    const { browserConfig } = AppStore.getState();
    const browserPath = FsStore.getState().modals?.browser?.currentPath || [];
    const selectedPath = (browserPath || []).join('/');
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
        ext: 'md',
        codeMode: 'markdown'
    });

    routeToSpatialGrid(virtualUri, filename);
    closeBrowseModal();
    injectTextToBuffer(virtualUri, content, true, false, true);
}
window.inSetu.vfs.normalizeVfsURI = normalizeVfsURI;
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
            title: `Parts: ${new window.inSetu.utils.InSetuURI(filepath).basename}`,
            files: chunks,
            autoDrilldown: false,
            isParts: true
        });
    }
}
window.inSetu.vfs.hasMacroSyntax = hasMacroSyntax;
window.inSetu.vfs.resolveEntityExportTarget = resolveEntityExportTarget;
window.inSetu.vfs.resolveFileFetchUrl = resolveFileFetchUrl;
window.inSetu.vfs.renameFileTracking = renameFileTracking;
window.inSetu.vfs.getChunks = getChunks;
window.inSetu.vfs.ensureFreshContext = ensureFreshContext;
window.inSetu.vfs.openPartsModal = openPartsModal;

window.inSetu.vfs.openVirtualFile = openVirtualFile;
window.inSetu.vfs.openNewFileModal = openNewFileModal;
window.inSetu.vfs.syncVirtualBuffer = syncVirtualBuffer;
window.inSetu.vfs.preCacheFiles = preCacheFiles;
window.inSetu.vfs.fetchAndCopy = fetchAndCopy;
window.inSetu.vfs.fetchAndDownloadState = fetchAndDownloadState;
window.inSetu.vfs.downloadFile = downloadFile;
window.inSetu.vfs.executeDownloadZip = executeDownloadZip;
window.inSetu.vfs.shareFiles = shareFiles;
window.inSetu.vfs.uploadFileToWorkspace = uploadFileToWorkspace;
window.inSetu.vfs.viewSourceFile = viewSourceFile;
window.inSetu.vfs.viewFileGitDiff = viewFileGitDiff;
window.inSetu.vfs.viewTwoFileDiff = viewTwoFileDiff;
window.inSetu.vfs.reconcileBufferWithDisk = reconcileBufferWithDisk;
window.inSetu.vfs.flushAllDirtyBuffers = flushAllDirtyBuffers;
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
    window.inSetu.utils.openFilePicker({
        multiple: true,
        onSelect: async (files) => {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('file', files[i]);
            }
            formData.append('dest_dir', targetDir || '');
            const loadingMsg = files.length > 1 ? `Uploading ${files.length} files...` : `Uploading ${files[0].name}...`;
            await window.inSetu.sys.executeWorkspaceMutation('fs/upload', formData, {
                loadingText: loadingMsg,
                onSuccess: (data) => {
                    if (data && Array.isArray(data.filepaths)) {
                        updateManifestState(data.filepaths.map(fp => ({ filepath: fp, operation: 'save' })));
                    }
                }
            });
        }
    });
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
const _debouncedLinkSearch = (window.inSetu?.utils?.debounce || window.ExtensionRegistry.utils.debounce)((val) => {
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
        const res = await window.inSetu.api.post('fs/search', { q: query });
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
// Isolate VFS-specific dirty state checks and keepalive flush on window close
window.addEventListener('beforeunload', (e) => {
    const buffers = Object.values(FsStore.getState().activeBuffers || {});
    const hasUnsaved = buffers.some(b => b.isFS && b.content !== b.originalContent && b.content !== 'Loading...');
    if (hasUnsaved) {
        flushAllDirtyBuffers(true);
        e.preventDefault();
        e.returnValue = '';
    }
});
