import { LitElement, html, css } from 'lit';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { InSetuElement, createExtensionStore } from '/static/extensions/system/insetu_sdk.js';
import { resolveEditorMode, insertLinkToEditor } from '/static/extensions/system/components/ui_editor.js';
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
export function normalizeVfsURI(path, defaultScheme = 'vfs') {
    if (window.inSetu?.utils?.InSetuURI?.canonicalize) {
        return window.inSetu.utils.InSetuURI.canonicalize(path, defaultScheme);
    }
    if (!path || typeof path !== 'string') return '';
    if (path.includes('://')) return path;
    return `${defaultScheme}://${path.replace(/^\/+/, '')}`;
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
export function isBufferReadOnly(buf) {
    if (!buf) return true;
    return !(buf.isFS || buf.forceEdit) || Boolean(buf.isTruncated || buf.previewMode);
}

export function hasMacroSyntax(text) {
    return typeof text === 'string' && /\{\{\s*(?:include_prompt\s*:|macro_[a-zA-Z0-9_]+|[a-zA-Z0-9_]+\s*\|)/.test(text);
}
export function canPreviewFileMacros(filepath, content = '') {
    if (hasMacroSyntax(content)) return true;
    if (!filepath) return false;
    return Boolean(window.inSetu?.events?.emitHook?.('insetu:can-preview-file', filepath));
}

export async function resolveLiveBufferPreview(filepath, rawContent, isDirty = true) {
    const hookPromise = window.inSetu?.events?.emitHook?.('insetu:resolve-buffer-preview', { filepath, content: rawContent, isDirty });
    const resolved = hookPromise ? await hookPromise : null;
    return typeof resolved === 'string' ? resolved : rawContent;
}

function _deriveFrontmatterProjection(text, isMarkdown, forceFrontmatterMode = false) {
    if (typeof text !== 'string' || text === 'Loading...') {
        return { yamlMeta: {}, bodyContent: '', hasFrontmatter: Boolean(forceFrontmatterMode) };
    }
    const hasFence = Boolean(isMarkdown && /^\s*---\s*\n/.test(text));
    if ((forceFrontmatterMode || hasFence) && window.inSetu?.utils?.parseFrontmatter) {
        const { meta, content, rawFrontmatter } = window.inSetu.utils.parseFrontmatter(text);
        if (forceFrontmatterMode || rawFrontmatter) {
            return {
                yamlMeta: meta || {},
                bodyContent: (content || '').replace(/^\s+/, ''),
                hasFrontmatter: Boolean(forceFrontmatterMode || (meta && Object.keys(meta).length > 0) || rawFrontmatter)
            };
        }
    }
    return { yamlMeta: {}, bodyContent: text, hasFrontmatter: false };
}
export const FsStore = createExtensionStore('Fs', {
    searchQuery: '',
    activeBuffers: {}, // Maps canonical filepath -> buffer state for multi-projection editing
    shareTextCache: new Map(),
    reconcilingPaths: new Set(),
    savingPaths: new Set(),
    hydratingPromises: {},
    autoSaveTimers: new Map(),
    clearPayload: () => {
        const st = FsStore.getState();
        st.shareTextCache?.clear();
        st.savingPaths?.clear();
        if (st.autoSaveTimers) {
            st.autoSaveTimers.forEach(autoSaveTimer => clearTimeout(autoSaveTimer));
            st.autoSaveTimers.clear();
        }
    },
    scheduleAutoSave: (filepath, delayMs = 2000) => {
        const key = normalizeVfsURI(filepath) || filepath;
        if (!key) return;
        const timers = FsStore.getState().autoSaveTimers;
        if (timers.has(key)) {
            const prevTimer = timers.get(key);
            clearTimeout(prevTimer);
        }
        const autoSaveTimer = setTimeout(() => {
            timers.delete(key);
            const buf = FsStore.getState().activeBuffers?.[key];
            const isDirty = Boolean(buf && buf.isFS && !buf.isTruncated && buf.content !== buf.originalContent && buf.content !== 'Loading...');
            if (isDirty && window.inSetu?.ui?.saveBufferFile) {
                window.inSetu.ui.saveBufferFile(key, true);
            }
        }, delayMs);
        timers.set(key, autoSaveTimer);
    },
    cancelAutoSave: (filepath) => {
        const key = normalizeVfsURI(filepath) || filepath;
        const timers = FsStore.getState().autoSaveTimers;
        if (timers && timers.has(key)) {
            const activeTimer = timers.get(key);
            clearTimeout(activeTimer);
            timers.delete(key);
        }
    },
    openBuffer: (filepath, data) => {
        const key = normalizeVfsURI(filepath) || filepath;
        FsStore.setState(s => {
            const existing = s.activeBuffers[key] || {};
            const merged = {
                docRevision: 0,
                savedRevision: 0,
                frontmatterMode: false,
                previewMode: false,
                previewContent: null,
                previewLoading: false,
                yamlMeta: {},
                bodyContent: '',
                hasFrontmatter: false,
                ...existing,
                ...data,
                filename: key
            };
            if (data.content !== undefined && data.content !== 'Loading...') {
                Object.assign(merged, _deriveFrontmatterProjection(merged.content, merged.isMarkdown, merged.frontmatterMode));
            }
            return {
                activeBuffers: {
                    ...s.activeBuffers,
                    [key]: merged
                }
            };
        });
    },
    updateBuffer: (filepath, data, options = {}) => {
        const key = normalizeVfsURI(filepath) || filepath;
        FsStore.setState(s => {
            const existing = s.activeBuffers[key] || { filename: key, docRevision: 0, savedRevision: 0 };
            // Store-level invariant: reject user edits to content while buffer is in a read-only state (previewMode, isTruncated, or !isFS)
            if (options.userEdit && isBufferReadOnly(existing) && data.content !== undefined) {
                return s;
            }
            const nextDocRev = options.userEdit ? (existing.docRevision || 0) + 1 : (data.docRevision ?? existing.docRevision ?? 0);
            const nextSavedRev = options.markSaved ? nextDocRev : (data.savedRevision ?? existing.savedRevision ?? 0);
            const nextBuf = {
                ...existing,
                ...data,
                docRevision: nextDocRev,
                savedRevision: nextSavedRev
            };
            if (data.content !== undefined && data.content !== 'Loading...' && !options.skipFrontmatterParse) {
                Object.assign(nextBuf, _deriveFrontmatterProjection(nextBuf.content, nextBuf.isMarkdown, nextBuf.frontmatterMode));
            }
            return {
                activeBuffers: {
                    ...s.activeBuffers,
                    [key]: nextBuf
                }
            };
        });
    },
    enableFrontmatterMode: (filepath, enabled = true) => {
        const key = normalizeVfsURI(filepath) || filepath;
        const buf = FsStore.getState().activeBuffers[key];
        if (!buf) return;
        const derived = _deriveFrontmatterProjection(buf.content, true, enabled);
        FsStore.getState().updateBuffer(key, {
            frontmatterMode: enabled,
            ...derived
        }, { skipFrontmatterParse: true });
    },
    updateBufferFrontmatter: (filepath, { yamlMeta = null, bodyContent = null } = {}, { userEdit = true } = {}) => {
        const key = normalizeVfsURI(filepath) || filepath;
        const buf = FsStore.getState().activeBuffers[key];
        if (!buf || buf.content === 'Loading...') return null;
        const nextYaml = yamlMeta !== null ? { ...yamlMeta } : { ...(buf.yamlMeta || {}) };
        const nextBody = bodyContent !== null ? bodyContent : (buf.bodyContent ?? '');
        const serialized = window.inSetu?.utils?.serializeFrontmatter
            ? window.inSetu.utils.serializeFrontmatter(nextYaml, nextBody)
            : nextBody;
        const patch = {
            frontmatterMode: true,
            hasFrontmatter: true,
            yamlMeta: nextYaml,
            bodyContent: nextBody,
            content: serialized,
            fullText: serialized
        };
        if (!userEdit) {
            patch.originalContent = serialized;
        }
        FsStore.getState().updateBuffer(key, patch, { userEdit, skipFrontmatterParse: true });
        return serialized;
    },
    toggleBufferPreview: async (filepath, forcePreview = null) => {
        const key = normalizeVfsURI(filepath) || filepath;
        const buf = FsStore.getState().activeBuffers[key];
        if (!buf || buf.content === 'Loading...') return;
        const nextPreview = forcePreview !== null ? Boolean(forcePreview) : !buf.previewMode;
        if (!nextPreview) {
            FsStore.getState().updateBuffer(key, { previewMode: false, previewLoading: false }, { skipFrontmatterParse: true });
            return;
        }
        FsStore.getState().updateBuffer(key, { previewMode: true, previewLoading: true }, { skipFrontmatterParse: true });
        try {
            const rawSource = buf.isTruncated ? (buf.fullText ?? buf.content) : buf.content;
            const isDirty = buf.content !== buf.originalContent;
            const resolvedText = await resolveLiveBufferPreview(key, rawSource, isDirty);
            FsStore.getState().updateBuffer(key, {
                previewMode: true,
                previewContent: resolvedText,
                previewLoading: false
            }, { skipFrontmatterParse: true });
        } catch (e) {
            FsStore.getState().updateBuffer(key, {
                previewMode: true,
                previewContent: buf.content,
                previewLoading: false
            }, { skipFrontmatterParse: true });
        }
    },
    closeBuffer: (filepath) => {
        const key = normalizeVfsURI(filepath) || filepath;
        FsStore.getState().cancelAutoSave?.(key);
        FsStore.setState(s => { 
            const newBufs = {...s.activeBuffers}; 
            delete newBufs[key]; 
            delete newBufs[filepath];
            return { activeBuffers: newBufs }; 
        });
    },
    modals: {
        move: { open: false, currentFile: '', destPath: '', initialParts: [] },
        newFile: { open: false, basePath: '', fileName: '', content: '' },
        newFolder: { open: false, basePath: '', folderName: '', repoTitle: '', repoDomain: 'Workspaces', repoDesc: '', repoExts: '.py, .json, .md, .sh, .txt, .html, .css, .js' },
        linkInsert: { open: false, activeTab: 'filename', searchQuery: '', searchResults: [], deepSearchLoading: false },
        browser: { open: false, title: '', manifest: [], searchQuery: '', currentPath: [] }
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
Object.defineProperty(window.inSetu.vfs, 'shareTextCache', {
    get: () => FsStore.getState().shareTextCache,
    configurable: true
});

function injectTextToBuffer(filepath, text, isSupportedEditor, isMarkdown, isFS, forceAllowEdit = false) {
    const TRUNCATE_LIMIT = 200000;
    let content = text;
    let isTruncated = false;

    if (text.length > TRUNCATE_LIMIT) {
        isTruncated = true;
        content = text.substring(0, TRUNCATE_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR PERFORMANCE] ...';
    }
    const curRev = (FsStore.getState().activeBuffers?.[filepath]?.docRevision || 0) + 1;
    FsStore.getState().updateBuffer(filepath, {
        content,
        originalContent: content,
        fullText: text,
        isTruncated,
        forceEdit: forceAllowEdit,
        docRevision: curRev,
        savedRevision: curRev
    });
}
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

            let alreadyInManifest = false;
            Object.entries(newManifest.vfs).forEach(([bKey, obj]) => {
                if (obj && Array.isArray(obj.files) && obj.files.includes(normPath)) {
                    alreadyInManifest = true;
                    newManifest.vfs[bKey] = { ...obj, source_ts: nowSec };
                    changed = true;
                }
            });
            if (!alreadyInManifest && normPath.startsWith('vfs://')) {
                const parsed = new window.inSetu.utils.InSetuURI(normPath);
                const repoDir = parsed.repo || 'global';
                let added = false;
                for (const key of Object.keys(newManifest.vfs)) {
                    if (key.startsWith(repoDir + '::')) {
                        newManifest.vfs[key] = {
                            ...newManifest.vfs[key],
                            source_ts: nowSec,
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
                        source_ts: nowSec,
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
export function prepareBufferSavePayload(buf, filepath) {
    if (!buf || buf.content === 'Loading...' || buf.content === undefined) return null;
    let content = buf.content.replace(/\u00A0/g, ' ');
    const filename = buf.filename || filepath || '';
    if (filename.toLowerCase().endsWith('.json')) {
        try { JSON.parse(content); } catch (e) { throw new Error("Invalid JSON syntax: " + e.message); }
    }
    return {
        filepath: normalizeVfsURI(filepath || buf.filename),
        content,
        base_hash: buf.baseHash || null,
        base_content: buf.originalContent ?? null
    };
}

export function rebaseConcurrentText(baseText, localText, remoteText) {
    if (window.inSetu?.utils?.threeWayMergeText) {
        return window.inSetu.utils.threeWayMergeText(baseText, localText, remoteText);
    }
    if (localText === baseText) return { merged: remoteText, clean: true };
    if (remoteText === baseText || remoteText === localText) return { merged: localText, clean: true };
    return { merged: localText, clean: false };
}
export async function saveBufferFile(filepath, autoSave = false) {
    if (autoSave !== true) autoSave = false;
    const normPath = normalizeVfsURI(filepath) || filepath;
    const state = FsStore.getState().activeBuffers[normPath] || FsStore.getState().activeBuffers[filepath];
    if (!state || !state.isFS || state.isTruncated) return;
    FsStore.getState().cancelAutoSave?.(normPath);
    const saveRev = state.docRevision || 0;
    let payload;
    try {
        payload = prepareBufferSavePayload(state, normPath);
    } catch (e) {
        return alert(e.message);
    }
    if (!payload) return;
    const { content, base_hash: baseHash, base_content: baseContent } = payload;

    const savingSet = FsStore.getState().savingPaths;
    savingSet.add(normPath);
    FsStore.getState().updateBuffer(normPath, {
        saveStatus: 'saving',
        lastSaveStartedAt: Date.now()
    });

    try {
        await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
            filepath: payload.filepath,
            content: payload.content,
            base_hash: baseHash,
            base_content: baseContent
        }, {
            collapseKey: `vfs:save:${normPath}`,
            pendingMutations: [normPath],
            cacheBlobUrl: `/api/${window.inSetu.utils.getActiveWorkspace()}/fs/fetch?file=${encodeURIComponent(normPath)}`,
            cacheBlobContent: content,
            loadingText: 'Saving...',
            silent: autoSave,
            onSuccess: async (resData) => {
                const latestBuf = FsStore.getState().activeBuffers[normPath] || FsStore.getState().activeBuffers[filepath];
                if (!latestBuf) return;

                // PILLAR 2: If queued in offline outbox, do NOT overwrite originalContent or baseHash!
                // Keep them pinned to the last server-confirmed ancestor so outbox compaction preserves V0.
                if (resData && resData.job_id === 'offline_queue') {
                    FsStore.getState().updateBuffer(normPath, {
                        saveStatus: 'queued_offline',
                        lastSavedAt: Date.now()
                    });
                    return;
                }

                const serverMergedText = (resData && resData.status === 'merged' && typeof resData.merged_content === 'string')
                    ? resData.merged_content
                    : null;
                const confirmedText = serverMergedText !== null ? serverMergedText : content;

                let nextHash = resData?.base_hash || null;
                if (!nextHash) {
                    try {
                        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(confirmedText));
                        nextHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                    } catch(e) {}
                }
                const advancedDuringSave = (latestBuf.docRevision || 0) > saveRev;
                let canAdvanceBase = true;
                let mergedContent = null;

                if (serverMergedText !== null) {
                    if (!advancedDuringSave) {
                        mergedContent = serverMergedText;
                    } else {
                        const rebased = rebaseConcurrentText(content, latestBuf.content, serverMergedText);
                        if (rebased.clean) {
                            mergedContent = rebased.merged;
                        } else {
                            canAdvanceBase = false;
                        }
                    }
                }
                const ancestorSet = new Set(latestBuf.ancestorHashes || []);
                if (baseHash) ancestorSet.add(baseHash);
                if (latestBuf.baseHash) ancestorSet.add(latestBuf.baseHash);
                if (nextHash) ancestorSet.add(nextHash);
                const ancestorHashes = Array.from(ancestorSet).slice(-50);

                const patch = {
                    saveStatus: 'idle',
                    lastSavedAt: Date.now(),
                    savedRevision: Math.max(latestBuf.savedRevision || 0, saveRev),
                    ancestorHashes
                };

                if (canAdvanceBase) {
                    patch.originalContent = confirmedText;
                    patch.baseHash = nextHash;
                }

                if (mergedContent !== null) {
                    patch.content = mergedContent;
                    patch.fullText = mergedContent;
                }

                FsStore.getState().updateBuffer(normPath, patch);
            }
        });
    } finally {
        savingSet.delete(normPath);
    }
}
export async function reconcileBufferWithDisk(filepath) {
    const normPath = normalizeVfsURI(filepath);
    const fsState = FsStore.getState();
    const recSet = fsState.reconcilingPaths;
    const savingSet = fsState.savingPaths;
    const autoSaveTimers = fsState.autoSaveTimers;
    if (!normPath || recSet.has(normPath) || savingSet?.has(normPath) || autoSaveTimers?.has(normPath)) return;
    const curBuf = fsState.activeBuffers?.[normPath] || fsState.activeBuffers?.[filepath];
    if (!curBuf || !curBuf.isFS || curBuf.isTruncated || curBuf.content === 'Loading...') return;

    const startDocRev = curBuf.docRevision || 0;
    const startBaseHash = curBuf.baseHash || null;
    recSet.add(normPath);
    try {
        const r = await window.inSetu.api.workspace.get(`fs/fetch?file=${encodeURIComponent(normPath)}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!r.ok) return;
        const newText = await r.text();
        const latestState = FsStore.getState();
        const latestBuf = latestState.activeBuffers?.[normPath] || latestState.activeBuffers?.[filepath];
        if (!latestBuf || newText === null) return;

        // Deterministic Lockout: Abort if user typed, scheduled autosave, or saved while fetch was in flight
        if (
            latestState.savingPaths?.has(normPath) ||
            latestState.autoSaveTimers?.has(normPath) ||
            (latestBuf.docRevision || 0) !== startDocRev ||
            (latestBuf.baseHash || null) !== startBaseHash
        ) {
            return;
        }

        let newHash = null;
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newText));
            newHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (_) {}

        if (newHash && newHash === latestBuf.baseHash && newText === latestBuf.originalContent) {
            return;
        }

        // Causal Monotonicity: Never roll back to a known historical ancestor of this buffer
        if (newHash && Array.isArray(latestBuf.ancestorHashes) && latestBuf.ancestorHashes.includes(newHash)) {
            return;
        }

        const isCurrentlyDirty = latestBuf.content !== latestBuf.originalContent;
        const nextAncestors = newHash
            ? Array.from(new Set([...(latestBuf.ancestorHashes || []), newHash])).slice(-50)
            : (latestBuf.ancestorHashes || []);
        if (!isCurrentlyDirty) {
            const nextRev = (latestBuf.docRevision || 0) + 1;
            FsStore.getState().updateBuffer(normPath, {
                content: newText,
                originalContent: newText,
                fullText: newText,
                baseHash: newHash,
                ancestorHashes: nextAncestors,
                docRevision: nextRev,
                savedRevision: nextRev
            });
        } else {
            const rebased = rebaseConcurrentText(latestBuf.originalContent, latestBuf.content, newText);
            if (rebased.clean) {
                const nextRev = (latestBuf.docRevision || 0) + 1;
                FsStore.getState().updateBuffer(normPath, {
                    content: rebased.merged,
                    originalContent: newText,
                    fullText: rebased.merged,
                    baseHash: newHash,
                    ancestorHashes: nextAncestors,
                    docRevision: nextRev
                });
            }
        }
    } catch (_) {
    } finally {
        FsStore.getState().reconcilingPaths.delete(normPath);
    }
}
export async function flushAllDirtyBuffers(useKeepalive = false) {
    const buffers = FsStore.getState().activeBuffers || {};
    const promises = [];
    for (const [fp, buf] of Object.entries(buffers)) {
        if (buf && buf.isFS && !buf.isTruncated && buf.content !== buf.originalContent && buf.content !== 'Loading...') {
            const normPath = normalizeVfsURI(fp);
            if (useKeepalive && window.inSetu?.api?.keepalivePost) {
                let payload;
                try {
                    payload = prepareBufferSavePayload(buf, normPath);
                } catch (_) {
                    continue; // Skip invalid JSON buffers on emergency unload to prevent corrupting disk
                }
                if (payload) {
                    window.inSetu.api.keepalivePost('fs/save', payload);
                }
            } else {
                promises.push(saveBufferFile(normPath, true).catch(() => {}));
            }
        }
    }
    if (promises.length > 0) {
        await Promise.all(promises);
    }
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
export function renameFileTracking(oldPath, newPath) {
    if (!oldPath || !newPath || oldPath === newPath) return;
    const fsState = window.inSetu.stores.Fs.getState();
    const hadPendingAutoSave = fsState.autoSaveTimers?.has(oldPath);
    const oldBuf = fsState.activeBuffers[oldPath];
    if (oldBuf) {
        fsState.openBuffer(newPath, { ...oldBuf, filename: newPath });
        fsState.closeBuffer(oldPath);
        if (hadPendingAutoSave) {
            fsState.scheduleAutoSave?.(newPath);
        }
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

    const tPaths = AppStore.getState().tabBrowsePaths || {};
    if (tPaths[oldPath]) {
        const nextPaths = { ...tPaths, [newPath]: tPaths[oldPath] };
        delete nextPaths[oldPath];
        AppStore.setState({ tabBrowsePaths: nextPaths });
    }
    const layoutStore = window.Sutram?.stores?.Layout;
    if (layoutStore?.getState()?.rekeyProjection) {
        layoutStore.getState().rekeyProjection(oldPath, newPath, new window.inSetu.utils.InSetuURI(newPath).basename);
    }
}

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

async function executeMove() {
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
                        const uri = new window.inSetu.utils.InSetuURI(e.detail.value);
                        const parts = uri.pathSegments;
                        parts.pop();
                        FsStore.getState().setModal('move', { destPath: uri.toString(), initialParts: parts });
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
                        const filename = m.currentFile ? new window.inSetu.utils.InSetuURI(m.currentFile).basename : '';
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
                browsePath: { type: Array },
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
                        .currentPath=${this.browsePath}
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
            match: (data) => !data.isSkeleton,
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
    const gbPath = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath('fs:files') : [];
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
    const gbPath = AppStore.getState().getBrowsePath ? AppStore.getState().getBrowsePath('fs:files') : [];
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
                const rRes = await window.inSetu.api.workspace.get('system/topology?t=' + Date.now());
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
export async function hydrateVfsBuffer(filepath, { isFS = null, forceReload = false, previewMode = false } = {}) {
    if (!filepath || typeof filepath !== 'string') return null;
    const normPath = normalizeVfsURI(filepath);
    const fsState = FsStore.getState();
    const existing = fsState.activeBuffers?.[normPath] || fsState.activeBuffers?.[filepath];
    if (!forceReload && existing && existing.content !== 'Loading...') {
        return existing;
    }
    if (!forceReload && fsState.hydratingPromises[normPath]) {
        return fsState.hydratingPromises[normPath];
    }
    const parsedUri = new window.inSetu.utils.InSetuURI(normPath);
    const effectiveIsFS = parsedUri.isReadOnly ? false : Boolean(isFS !== null ? isFS : parsedUri.isEditable);
    const { ext, mode: codeMode, isSupported: isSupportedEditor, isMarkdown } = resolveEditorMode(normPath);

    if (forceReload || !existing) {
        fsState.openBuffer(normPath, {
            filename: normPath,
            content: 'Loading...',
            originalContent: 'Loading...',
            fullText: 'Loading...',
            isTruncated: false,
            isFS: effectiveIsFS,
            forceEdit: false,
            isMemoryOnly: false,
            previewMode: Boolean(previewMode),
            previewContent: null,
            previewLoading: Boolean(previewMode),
            isMarkdown,
            isSupportedEditor,
            ext,
            codeMode
        });
    }

    const promise = (async () => {
        try {
            let text = null;
            try {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                const fetchUrl = resolveFileFetchUrl(normPath, effectiveIsFS);
                const res = await window.inSetu.api.request(fetchUrl, {}, activeWs);
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
            FsStore.getState().updateBuffer(normPath, {
                baseHash: initialHash,
                ancestorHashes: initialHash ? [initialHash] : [],
                saveStatus: 'idle',
                docHandle: null
            });
            injectTextToBuffer(normPath, text, isSupportedEditor, isMarkdown, effectiveIsFS);
        } catch (e) {
            injectTextToBuffer(normPath, "Error loading file content.", isSupportedEditor, isMarkdown, effectiveIsFS);
        } finally {
            delete FsStore.getState().hydratingPromises[normPath];
        }
        return FsStore.getState().activeBuffers?.[normPath] || null;
    })();

    fsState.hydratingPromises[normPath] = promise;
    return promise;
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
        frontmatterMode: { type: Boolean },
        defaultExpanded: { type: Boolean },
        _buffer: { type: Object },
        _writingMode: { type: Boolean },
        _editorFocused: { type: Boolean },
        _metadataExpanded: { type: Boolean },
        _yamlData: { type: Object },
        _bodyContent: { type: String },
        _hasTitleSlot: { type: Boolean },
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
        :host { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; width: 100%; background: var(--bg); overflow: hidden; container-type: inline-size; }
        .editor-header {
            display: flex; justify-content: space-between; align-items: center; 
            padding: 6px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
            gap: 10px;
        }
        .action-bar-scroll {
            display: flex; gap: 8px; align-items: center; flex: 1; min-width: 0;
            overflow-x: auto; scrollbar-width: none; flex-wrap: nowrap; white-space: nowrap;
        }
        .action-bar-scroll::-webkit-scrollbar { display: none; }
        .meta-btn {
            background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 4px;
            padding: 4px 8px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center;
            gap: 4px; font-size: 0.82rem; transition: background 0.2s; margin: 0; flex-shrink: 0;
        }
        .meta-btn:hover { background: var(--bg); }
        .meta-btn.active { background: var(--bg); border-color: var(--intent-primary); color: var(--intent-primary); }
        @container (max-width: 480px) {
            .meta-btn-text { display: none; }
            .meta-btn { padding: 4px 6px; }
        }
        .editor-footer {
            padding: 10px 15px; gap: 10px; border-top: 1px solid var(--border); 
            background: var(--input-bg); display: flex; flex-shrink: 0; width: 100%; box-sizing: border-box;
        }
    `];

    constructor() {
        super();
        this.filepath = '';
        this.frontmatterMode = false;
        this.defaultExpanded = false;
        this._buffer = null;
        this._writingMode = false;
        this._editorFocused = false;
        this._metadataExpanded = false;
        this._yamlData = {};
        this._bodyContent = '';
        this._hasTitleSlot = false;
        this.zenMode = false;
        this._transientCursorPos = 0;
        this._transientScrollTop = 0;
        this._autoSaveTimer = null;
        this._lastEmittedYamlJson = null;
        this._wasDirty = false;
    }

    _normPath() {
        const raw = this.filepath || this.dataset.subId || '';
        return raw ? normalizeVfsURI(raw) : '';
    }

    _syncFromBuffer(buffer, isInitialHydration = false) {
        this._buffer = buffer;
        if (!buffer || buffer.content === 'Loading...') return;

        if (this.frontmatterMode && !buffer.frontmatterMode) {
            FsStore.getState().enableFrontmatterMode(this._normPath(), true);
            this._buffer = FsStore.getState().activeBuffers[this._normPath()] || buffer;
        }

        const activeBuf = this._buffer;
        this._yamlData = activeBuf.yamlMeta || {};
        this._bodyContent = activeBuf.bodyContent ?? activeBuf.content;

        const nowDirty = this.isDirty;
        if (this._wasDirty !== nowDirty) {
            this._wasDirty = nowDirty;
            this.dispatchEvent(new CustomEvent('editor-dirty', {
                detail: { isDirty: nowDirty },
                bubbles: true,
                composed: true
            }));
        }

        if (this.frontmatterMode || activeBuf.hasFrontmatter) {
            const yamlJson = JSON.stringify(this._yamlData);
            const yamlChanged = yamlJson !== this._lastEmittedYamlJson;
            this._lastEmittedYamlJson = yamlJson;

            if (isInitialHydration) {
                const docType = (this._yamlData?.doctype || this._yamlData?.doc_type || '').toLowerCase();
                const proseDocTypes = ['prose', 'essay', 'article', 'draft', 'spec', 'story', 'novel'];
                if (proseDocTypes.includes(docType) || this._yamlData?.writing_mode === 'true' || this._yamlData?.writing_mode === true) {
                    this._writingMode = true;
                }
                this._metadataExpanded = !!this.defaultExpanded;
            }

            if (isInitialHydration || yamlChanged) {
                this.dispatchEvent(new CustomEvent('insetu:frontmatter-loaded', {
                    detail: { yaml: this._yamlData, content: this._bodyContent },
                    bubbles: true,
                    composed: true
                }));
            }
            if (isInitialHydration && this.frontmatterMode) {
                queueMicrotask(() => this._syncFrontmatterToBuffer(false));
            }
        }
    }
    syncFrontmatter(yamlPatch = null, userEdit = true) {
        if (yamlPatch && typeof yamlPatch === 'object') {
            this._yamlData = { ...(this._yamlData || {}), ...yamlPatch };
        }
        this._syncFrontmatterToBuffer(userEdit);
    }
    _syncFrontmatterToBuffer(userEdit = true) {
        const normPath = this._normPath();
        if (!normPath || !this._buffer || this._buffer.content === 'Loading...') return;

        this._yamlData = { ...(this._yamlData || {}) };
        this._lastEmittedYamlJson = JSON.stringify(this._yamlData);
        const prevContent = this._buffer.content;
        const serialized = FsStore.getState().updateBufferFrontmatter(
            normPath,
            { yamlMeta: this._yamlData, bodyContent: this._bodyContent },
            { userEdit }
        );
        if (userEdit && serialized !== null && serialized !== prevContent) {
            this._triggerDebouncedAutoSave();
        }
    }

    async save() {
        return this._handleSave();
    }

    async _handleSave() {
        const normPath = this._normPath();
        if (!normPath) return;
        if (this.frontmatterMode) {
            this._syncFrontmatterToBuffer(true);
        }
        if (window.inSetu?.ui?.saveBufferFile) {
            await window.inSetu.ui.saveBufferFile(normPath, true);
        }
    }
    _triggerDebouncedAutoSave() {
        const targetPath = this._normPath();
        if (!targetPath) return;
        FsStore.getState().scheduleAutoSave?.(targetPath, 2000);
    }
    _cleanArtifacts() {
        if (this._buffer?.previewMode) return;
        const cleanFn = window.inSetu?.utils?.cleanCodeArtifacts;
        if (!cleanFn) return;
        const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
        let modified = false;
        if (cmEditor && cmEditor.transformContent) {
            modified = cmEditor.transformContent(cleanFn);
        } else if (this.frontmatterMode) {
            const cleaned = cleanFn(this._bodyContent);
            if (cleaned !== this._bodyContent) {
                this._bodyContent = cleaned;
                this._syncFrontmatterToBuffer(true);
                modified = true;
            }
        } else if (this._buffer) {
            const cleaned = cleanFn(this._buffer.content);
            if (cleaned !== this._buffer.content) {
                FsStore.getState().updateBuffer(this._normPath(), { content: cleaned }, { userEdit: true });
                this._triggerDebouncedAutoSave();
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
        if (this.frontmatterMode) {
            this._yamlData = { ...this._yamlData, writing_mode: this._writingMode };
            this._syncFrontmatterToBuffer(true);
            return;
        }
        if (this._buffer && this._buffer.isFS) {
            try {
                await window.inSetu.api.workspace.post('editor/preference', {
                    filepath: this._normPath(),
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
    onWorkspaceLoad(workspaceId) {
        super.onWorkspaceLoad(workspaceId);
        if (this.filepath) {
            this._lastEmittedYamlJson = null;
            this._ensureBufferLoaded(this.filepath);
            this._loadPreference(this.filepath);
        }
    }

    onProjectionRekeyed(oldId, newId) {
        const normCur = this._normPath();
        if (this.filepath === oldId || normCur === oldId) {
            this.filepath = newId;
            this.dataset.subId = newId;
            this._syncFromBuffer(FsStore.getState().activeBuffers[newId] || null, false);
            this.requestUpdate();
        } else if (this.filepath && this.filepath.startsWith(oldId + '/')) {
            const childNew = newId + this.filepath.slice(oldId.length);
            this.filepath = childNew;
            this.dataset.subId = childNew;
            this._syncFromBuffer(FsStore.getState().activeBuffers[childNew] || null, false);
            this.requestUpdate();
        }
    }
    async _ensureBufferLoaded(filepath) {
        if (!filepath) return;
        if (filepath.startsWith('yomama://') || filepath.startsWith('virtual://')) {
            const normPath = this._normPath();
            const memBuf = FsStore.getState().activeBuffers?.[normPath] || FsStore.getState().activeBuffers?.[filepath] || null;
            if (memBuf) {
                this._syncFromBuffer(memBuf, true);
                this.requestUpdate();
            }
            return;
        }
        const buf = await hydrateVfsBuffer(filepath, { forceReload: false });
        if (buf) {
            this._syncFromBuffer(buf, true);
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.filepath && this.dataset.subId) this.filepath = this.dataset.subId;
        this.subscribe(
            'Fs',
            state => {
                const np = this._normPath();
                return np ? (state.activeBuffers[np] || state.activeBuffers[this.filepath] || null) : null;
            },
            (buffer) => {
                const isFirstHydration = Boolean(buffer && buffer.content !== 'Loading...' && this._lastEmittedYamlJson === null);
                this._syncFromBuffer(buffer, isFirstHydration);
                this.requestUpdate();
            }
        );
        if (this.filepath) {
            this._lastLoadedFilepath = this.filepath;
            this._ensureBufferLoaded(this.filepath);
        }
        this.registerGlobalListener('insetu:editor:clean-artifacts', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (!normTarget || normTarget === this._normPath() || e.detail?.filepath === this.dataset.subId) {
                this._cleanArtifacts();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-prose', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                this._toggleWritingMode();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-zen', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                this._toggleZenMode();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-preview', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                FsStore.getState().toggleBufferPreview(this._normPath());
            }
        });
        // Live 3-Way Rebase & Hot-Swap Listener (Driven by BroadcastChannel or SSE)
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            if (!this.filepath || !this._buffer) return;
            const mutations = e.detail?.mutations || [];
            const normPath = this._normPath();
            const relocMut = mutations.find(m => {
                const mNorm = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath;
                return m.operation === 'delete' && m.relocated_to && (mNorm === normPath || m.filepath === this.filepath);
            });
            if (relocMut) {
                this.onProjectionRekeyed(normPath, normalizeVfsURI(relocMut.relocated_to));
                return;
            }
            const matchingSave = mutations.find(m => {
                if (m.operation === 'delete') return false;
                const mNorm = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath;
                return mNorm === normPath || m.filepath === this.filepath;
            });
            if (matchingSave) {
                const fsState = FsStore.getState();
                const isLockedByLocalEdit = Boolean(
                    this.isDirty ||
                    fsState.savingPaths?.has(normPath) ||
                    fsState.autoSaveTimers?.has(normPath)
                );
                const isKnownHash = Boolean(
                    matchingSave.base_hash && (
                        matchingSave.base_hash === this._buffer?.baseHash ||
                        (Array.isArray(this._buffer?.ancestorHashes) && this._buffer.ancestorHashes.includes(matchingSave.base_hash))
                    )
                );
                if (isLockedByLocalEdit || isKnownHash) {
                    return;
                }
                reconcileBufferWithDisk(normPath);
            }
        });
        this.registerGlobalListener('insetu:editor-insert-text', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail.filepath === this.filepath || e.detail.filepath === this.dataset.subId) {
                const m = this._buffer;
                if (!m || m.previewMode) return;
                const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                if (m.isSupportedEditor && cmEditor) {
                    cmEditor.insertAtCursor(e.detail.text);
                } else if (this.frontmatterMode) {
                    this._bodyContent = this._bodyContent + "\n" + e.detail.text;
                    this._syncFrontmatterToBuffer(true);
                } else {
                    window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: m.content + "\n" + e.detail.text }, { userEdit: true });
                    this._triggerDebouncedAutoSave();
                }
            }
        });

        this._loadPreference(this.filepath);
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') && this.filepath && this.filepath !== this._lastLoadedFilepath) {
            this._lastLoadedFilepath = this.filepath;
            this._lastEmittedYamlJson = null;
            const normPath = this._normPath();
            const existing = window.inSetu.stores.Fs?.getState()?.activeBuffers[normPath] || window.inSetu.stores.Fs?.getState()?.activeBuffers[this.filepath] || null;
            if (existing && existing.content !== 'Loading...') {
                this._syncFromBuffer(existing, true);
            } else {
                this._ensureBufferLoaded(this.filepath);
            }
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
        return Boolean(this._buffer && this._buffer.isFS && this._buffer.content !== this._buffer.originalContent && this._buffer.content !== 'Loading...');
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
        if (!this._buffer || this._buffer.content === 'Loading...') {
            return html`<div style="padding: 20px;"><sutram-spinner text="Loading file..."></sutram-spinner></div>`;
        }
        const m = this._buffer;
        const isPreview = Boolean(m.previewMode);
        const shouldBeReadOnly = isBufferReadOnly(m);
        const kbSize = Math.round((m.fullText?.length || 0) / 1024);
        const hasDetectedFrontmatter = Boolean(!isPreview && m.isMarkdown && (this.frontmatterMode || (this._yamlData && Object.keys(this._yamlData).length > 0)));
        const rawSourceText = this.frontmatterMode ? this._bodyContent : m.content;
        const editorTextValue = isPreview ? (m.previewContent ?? rawSourceText) : rawSourceText;
        const supportsMacroPreview = canPreviewFileMacros(m.filename, m.content || '');
        return html`
            <div style="display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); position: relative;">
                <div style="padding: 8px 15px 6px 15px; background: var(--bg); flex-shrink: 0; display: ${this._hasTitleSlot ? 'block' : 'none'};">
                    <slot name="title-control" @slotchange=${(e) => { this._hasTitleSlot = e.target.assignedNodes({ flatten: true }).length > 0; }}></slot>
                </div>

                <div class="editor-header">
                    <div class="action-bar-scroll">
                        <slot name="action-bar-extra"></slot>
                        <sutram-entity-actions   
                            variant="menu-bar"
                            .entityType=${'file:editor'} 
                            .entityData=${{ 
                                filepath: m.filename, 
                                isFS: m.isFS,
                                isMarkdown: m.isMarkdown,
                                writingMode: this._writingMode,
                                previewMode: isPreview,
                                supportsMacroPreview,
                                isSkeleton: false,
                                isDirty: this.isDirty,
                                transientContent: editorTextValue,
                                suppress: ['file-edit', 'file-preview'],
                                chunks: window.inSetu?.vfs?.getChunks ? window.inSetu.vfs.getChunks(m.filename) : [m.filename]
                            }}>
                        </sutram-entity-actions>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        <insetu-projection-window-controls 
                            .filepath=${m.filename}
                            .beforeAction=${async () => { if (this.isDirty) await this._handleSave(); }}>
                        </insetu-projection-window-controls>
                        ${hasDetectedFrontmatter ? html`
                            <button class="meta-btn ${this._metadataExpanded ? 'active' : ''}"
                                @click=${() => {
                                    const nextExpanded = !this._metadataExpanded;
                                    if (!this._alwaysFrontmatter) {
                                        if (nextExpanded && !this.frontmatterMode) {
                                            this._lastEmittedYamlJson = null;
                                            this.frontmatterMode = true;
                                            FsStore.getState().enableFrontmatterMode(this._normPath(), true);
                                            this._syncFromBuffer(FsStore.getState().activeBuffers[this._normPath()], false);
                                        } else if (!nextExpanded && this.frontmatterMode) {
                                            this._syncFrontmatterToBuffer(false);
                                            this.frontmatterMode = false;
                                            FsStore.getState().enableFrontmatterMode(this._normPath(), false);
                                        }
                                    }
                                    this._metadataExpanded = nextExpanded;
                                }}
                                title="Toggle Frontmatter Metadata">
                                <yv-icon name="settings" style="width: 14px; height: 14px;"></yv-icon>
                                <span class="meta-btn-text"> Metadata</span>
                                <span style="font-size: 0.7rem; margin-left: 2px;">${this._metadataExpanded ? '▲' : '▼'}</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                ${this._metadataExpanded && hasDetectedFrontmatter ? html`
                    <div style="padding: 8px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;">
                        <slot name="metadata-controls">
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${Object.keys(this._yamlData || {}).map(k => html`
                                    <div style="flex: 1; min-width: 150px;">
                                        <sutram-input ?flush=${true} label=${k} .value=${String(this._yamlData[k] ?? '')} @sutram-input-changed=${e => {
                                            this._yamlData = { ...this._yamlData, [k]: e.detail.value };
                                            this._syncFrontmatterToBuffer(true);
                                        }}></sutram-input>
                                    </div>
                                `)}
                            </div>
                        </slot>
                    </div>
                ` : ''}
                ${isPreview ? html`
                    <div style="display: flex; background: color-mix(in srgb, var(--intent-highlight) 18%, var(--input-bg)); color: var(--text); padding: 8px 16px; font-size: 0.85rem; font-weight: bold; justify-content: space-between; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--intent-highlight); gap: 10px;">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <yv-icon name="eye" style="width: 16px; height: 16px; color: var(--intent-highlight); flex-shrink: 0;"></yv-icon>
                            <span>${m.previewLoading ? 'Resolving macro preview...' : 'Macro-Expanded Preview (Read-Only)'}</span>
                        </span>
                        <sutram-btn size="sm" icon="${m.isFS ? 'edit-3' : 'code'}" label="${m.isFS ? 'Edit Raw Source' : 'View Raw Source'}" intent="highlight" @click=${() => FsStore.getState().toggleBufferPreview(this._normPath(), false)} style="margin: 0;"></sutram-btn>
                    </div>
                ` : ''}
                ${m.isTruncated ? html`
                    <div style="display: flex; background: var(--intent-warning); color: var(--bg-deep); padding: 8px 20px; font-weight: bold; justify-content: space-between; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--border);">
                        <span>⚠️ Only showing the first 200kb of <b>${kbSize}kb</b>.</span>
                        <sutram-btn label="Show All" intent="neutral" @click=${() => window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: m.fullText, originalContent: m.fullText, isTruncated: false })} style="margin: 0; --btn-padding: 4px 8px;"></sutram-btn>
                    </div>
                ` : ''}

                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; position: relative;"
                    @focusin=${() => this._editorFocused = true}
                    @focusout=${() => { if (!this.shadowRoot.activeElement) this._editorFocused = false; }}>${m.isSupportedEditor ? html`
                        <insetu-markdown-editor 
                            .value=${editorTextValue} 
                            .language=${m.codeMode} 
                            .readOnly=${shouldBeReadOnly}
                            ?writingMode=${this._writingMode}
                            @editor-selection=${(e) => { this._transientCursorPos = e.detail?.cursor ?? 0; }}
                            @editor-scroll=${(e) => { this._transientScrollTop = e.detail?.top ?? 0; }}
                            @content-changed=${(e) => {
                                if (this._buffer?.previewMode) return;
                                if (this.frontmatterMode) {
                                    this._bodyContent = e.detail.value;
                                    this._syncFrontmatterToBuffer(true);
                                } else {
                                    window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: e.detail.value }, { userEdit: true });
                                    this._triggerDebouncedAutoSave();
                                }
                            }}>
                        </insetu-markdown-editor>
                    ` : html`
                        <sutram-textarea
                            style="flex: 1; margin: 0;"
                            .value=${editorTextValue}
                            .monospace=${true}
                            ?disabled=${shouldBeReadOnly}
                            ?flush=${true}
                            @sutram-input-changed=${(e) => {
                                if (this._buffer?.previewMode) return;
                                window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: e.detail.value }, { userEdit: true });
                                this._triggerDebouncedAutoSave();
                            }}>
                        </sutram-textarea>
                    `}
                </div>
                ${this.isDirty && !this._hasTitleSlot ? html`
                    <div class="editor-footer">
                        <sutram-async-btn label="Save Changes" intent="warning" style="width: 100%; display: block;" .onClick=${() => this._handleSave()}></sutram-async-btn>
                    </div>
                ` : ''}
                <button class="zen-exit-btn" title="Exit Focus Mode (Esc)" 
                    @pointerdown=${(e) => { e.preventDefault(); e.stopPropagation(); this._toggleZenMode(); }}
                    @click=${(e) => { e.preventDefault(); e.stopPropagation(); this._toggleZenMode(); }}>
                    <yv-icon name="minimize-2" style="width: 20px; height: 20px; pointer-events: none;"></yv-icon>
                </button>
            </div>
        `;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._escListener) {
            window.removeEventListener('keydown', this._escListener);
        }
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
        }
        const normPath = this._normPath();
        const activeBuffers = window.inSetu.stores.Fs?.getState()?.activeBuffers || {};
        if (normPath && this._buffer && (activeBuffers[normPath] || activeBuffers[this.filepath])) {
            window.inSetu.stores.Fs.getState().updateBuffer(normPath, { 
                cursorPos: this._transientCursorPos, 
                scrollTop: this._transientScrollTop 
            });
        }
    }
}
customElements.define('insetu-editor-projection', InSetuEditorProjection);
export class InSetuFrontmatterEditor extends InSetuEditorProjection {
    constructor() {
        super();
        this.frontmatterMode = true;
        this._alwaysFrontmatter = true;
    }
}
if (!customElements.get('insetu-frontmatter-editor')) {
    customElements.define('insetu-frontmatter-editor', InSetuFrontmatterEditor);
}
export const extractManifestFiles = (...args) => window.inSetu.utils.extractManifestFiles(...args);
window.inSetu.vfs.normalizeVfsURI = normalizeVfsURI;
export function resolveFileFetchUrl(filepath, isFS = false) {
    if (!filepath) return '';
    if (filepath.startsWith('/download/') || filepath.startsWith('http://') || filepath.startsWith('https://')) {
        return filepath;
    }
    if (!isFS) {
        const overrideUrl = window.inSetu.events.emitHook('insetu:file-fetch-url', filepath);
        if (overrideUrl) return overrideUrl;
    }
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
            title: `Parts: ${new window.inSetu.utils.InSetuURI(filepath).basename}`,
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
window.inSetu.vfs.ensureFreshContext = ensureFreshContext;
window.inSetu.vfs.openPartsModal = openPartsModal;
window.inSetu.vfs.openVirtualFile = openVirtualFile;
window.inSetu.vfs.fetchAndCopy = fetchAndCopy;
window.inSetu.vfs.fetchAndDownloadState = fetchAndDownloadState;
window.inSetu.vfs.downloadFile = downloadFile;
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
                if (data && Array.isArray(data.filepaths)) {
                    updateManifestState(data.filepaths.map(fp => ({ filepath: fp, operation: 'save' })));
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
                    const name = new window.inSetu.utils.InSetuURI(item.path).basename;
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
        browserPath: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        const bModal = FsStore.getState().modals?.browser || {};
        this.browserModal = bModal;
        this.browserConfig = AppStore.getState().browserConfig || {};
        this.browserPath = bModal.currentPath || [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.browser || {},
            (browserModal) => {
                this.browserModal = browserModal;
                this.browserPath = browserModal.currentPath || [];
                this.requestUpdate();
            }
        );
        this.subscribe(
            AppStore,
            state => state.browserConfig || {},
            (browserConfig) => {
                this.browserConfig = browserConfig;
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
                        .currentPath=${this.browserPath || []}
                        .hidePath=${false}
                        .enableSearch=${this.browserConfig?.mode !== 'folder'}
                        searchPlaceholder="Fuzzy find files..."
                        .hideFiles=${this.browserConfig?.mode === 'folder'}
                        @path-changed=${e => FsStore.getState().setModal('browser', { currentPath: e.detail.path || [] })}
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
                                const cleanFirst = new window.inSetu.utils.InSetuURI(firstFile).basename || firstFile;
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
        compareFilepath: { type: String },
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
        this.compareFilepath = '';
        this._loading = false;
        this._error = '';
        this._headContent = '';
        this._workingContent = '';
        this._isUntracked = false;
        this._hasUnsavedBuffer = false;
    }
    onWorkspaceLoad(workspaceId) {
        super.onWorkspaceLoad(workspaceId);
        if (this.filepath) {
            this._fetchDiff();
        }
    }

    onProjectionRekeyed(oldId, newId) {
        let updated = false;
        if (this.filepath === oldId) {
            this.filepath = newId;
            updated = true;
        } else if (this.filepath && this.filepath.startsWith(oldId + '/')) {
            this.filepath = newId + this.filepath.slice(oldId.length);
            updated = true;
        }
        if (this.compareFilepath === oldId) {
            this.compareFilepath = newId;
            updated = true;
        } else if (this.compareFilepath && this.compareFilepath.startsWith(oldId + '/')) {
            this.compareFilepath = newId + this.compareFilepath.slice(oldId.length);
            updated = true;
        }
        if (updated) this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.filepath && this.dataset.subId?.startsWith('vfs:pairdiff:')) {
            const pairStr = this.dataset.subId.replace('vfs:pairdiff:', '');
            const [leftFp, rightFp] = pairStr.split('::');
            this.filepath = leftFp || '';
            this.compareFilepath = rightFp || '';
        } else if (!this.filepath && this.dataset.subId?.startsWith('vfs:diff:')) {
            this.filepath = this.dataset.subId.replace('vfs:diff:', '');
        }
        this.subscribe(
            FsStore,
            state => {
                if (!this.filepath) return null;
                const normLeft = normalizeVfsURI(this.filepath);
                const leftBuf = state.activeBuffers?.[normLeft] || state.activeBuffers?.[this.filepath];
                const leftSnap = (leftBuf && leftBuf.isFS && leftBuf.content !== undefined && leftBuf.content !== 'Loading...')
                    ? leftBuf.content
                    : null;

                const targetFp = this.compareFilepath || this.filepath;
                const normRight = normalizeVfsURI(targetFp);
                const rightBuf = state.activeBuffers?.[normRight] || state.activeBuffers?.[targetFp];
                const rightSnap = (rightBuf && rightBuf.isFS && rightBuf.content !== undefined && rightBuf.content !== 'Loading...')
                    ? rightBuf.content
                    : null;
                const rightDirty = Boolean(rightBuf && rightBuf.isFS && rightBuf.content !== rightBuf.originalContent);

                return {
                    leftContent: this.compareFilepath ? leftSnap : null,
                    rightContent: rightSnap,
                    rightDirty
                };
            },
            (snap) => {
                if (!snap) return;
                let changed = false;
                if (this.compareFilepath && snap.leftContent !== null && snap.leftContent !== this._headContent) {
                    this._headContent = snap.leftContent;
                    changed = true;
                }
                if (snap.rightContent !== null && (snap.rightContent !== this._workingContent || snap.rightDirty !== this._hasUnsavedBuffer)) {
                    this._workingContent = snap.rightContent;
                    this._hasUnsavedBuffer = snap.rightDirty;
                    changed = true;
                }
                if (changed) this.requestUpdate();
            }
        );
        if (this.filepath) {
            this._fetchDiff();
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if ((changedProperties.has('filepath') || changedProperties.has('compareFilepath')) && this.filepath) {
            this._fetchDiff();
        }
    }

    async _readBufferOrFetch(targetFp) {
        const normFp = normalizeVfsURI(targetFp);
        const buf = FsStore.getState().activeBuffers?.[normFp] || FsStore.getState().activeBuffers?.[targetFp];
        if (buf && buf.isFS && buf.content !== undefined && buf.content !== 'Loading...') {
            return { text: buf.content, isDirty: buf.content !== buf.originalContent };
        }
        const res = await window.inSetu.api.workspace.get(`fs/fetch?file=${encodeURIComponent(normFp)}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch '${normFp}' (HTTP ${res.status})`);
        }
        return { text: await res.text(), isDirty: false };
    }

    async _fetchDiff() {
        if (!this.filepath) return;
        this._loading = true;
        this._error = '';
        try {
            if (this.compareFilepath) {
                const [leftRes, rightRes] = await Promise.all([
                    this._readBufferOrFetch(this.filepath),
                    this._readBufferOrFetch(this.compareFilepath)
                ]);
                this._headContent = leftRes.text;
                this._workingContent = rightRes.text;
                this._hasUnsavedBuffer = rightRes.isDirty;
            } else {
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
            }
        } catch (e) {
            this._error = e.message || 'Failed to load diff.';
        } finally {
            this._loading = false;
        }
    }

    render() {
        if (this._loading) {
            return html`<div style="padding: 20px;"><sutram-spinner text="${this.compareFilepath ? 'Comparing selected files...' : 'Comparing against Git HEAD...'}"></sutram-spinner></div>`;
        }
        if (this._error) {
            return html`<div style="padding: 20px; color: var(--intent-danger); font-family: var(--font-mono);">Error: ${this._error}</div>`;
        }
        const isPairMode = Boolean(this.compareFilepath);
        const leftLabel = isPairMode
            ? `Base: ${new window.inSetu.utils.InSetuURI(this.filepath).basename}`
            : (this._isUntracked ? 'Git HEAD (Untracked / New File)' : 'Git HEAD (Committed)');
        const rightLabel = isPairMode
            ? `Compare: ${new window.inSetu.utils.InSetuURI(this.compareFilepath).basename}`
            : (this._hasUnsavedBuffer ? 'Working Buffer (Unsaved Edits)' : 'Working Tree (Disk)');

        return html`
            <div style="padding: 8px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap;">
                <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${isPairMode
                        ? `${normalizeVfsURI(this.filepath)}  ↔${normalizeVfsURI(this.compareFilepath)}`
                        : normalizeVfsURI(this.filepath)}
                </span>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                    <sutram-btn size="sm" intent="neutral" icon="refresh-cw" label="Refresh" @click=${() => this._fetchDiff()}></sutram-btn>
                    <sutram-btn size="sm" intent="primary" icon="edit-3" label="${isPairMode ? 'Edit Left' : 'Open Editor'}" @click=${() => viewSourceFile(this.filepath, true)}></sutram-btn>
                    ${isPairMode ? html`
                        <sutram-btn size="sm" intent="highlight" icon="edit-3" label="Edit Right" @click=${() => viewSourceFile(this.compareFilepath, true)}></sutram-btn>
                    ` : ''}
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
