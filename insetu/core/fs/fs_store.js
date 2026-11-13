/**
 * Core VFS Buffer State Store (FsStore), OCC 3-way buffer reconciliation, auto-save, and hydration helpers (God-Objects Wave 3.1).
 */
import { createExtensionStore } from '/static/extensions/system/insetu_sdk.js';
import { resolveEditorMode } from '/static/extensions/system/components/ui_editor.js';
import { AppStore } from '/static/extensions/system/store.js';

export function hasMacroSyntax(text) {
    return typeof text === 'string' && /\{\{\s*(?:include_prompt\??\s*:|macro_[a-zA-Z0-9_]+|sys\.[a-zA-Z0-9_]+|[a-zA-Z0-9_.]+\s*\|)/.test(text);
}

export function normalizeVfsURI(path, defaultScheme = 'vfs') {
    if (window.inSetu?.utils?.InSetuURI?.canonicalize) {
        return window.inSetu.utils.InSetuURI.canonicalize(path, defaultScheme);
    }
    if (!path || typeof path !== 'string') return '';
    if (path.includes('://')) return path;
    return `${defaultScheme}://${path.replace(/^\/+/, '')}`;
}


export function isBufferReadOnly(buf) {
    if (!buf) return true;
    return !(buf.isFS || buf.forceEdit) || Boolean(buf.isTruncated || buf.previewMode);
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
    shareCacheTimestamps: new Map(),
    reconcilingPaths: new Set(),
    savingPaths: new Set(),
    hydratingPromises: {},
    autoSaveTimers: new Map(),
    clearPayload: () => {
        const st = FsStore.getState();
        st.shareTextCache?.clear();
        st.shareCacheTimestamps?.clear();
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
            // S8: a protected recovery file is saved only when the person saves it, because every save runs a smoke test.
            if (isDirty && !buf.isProtected && window.inSetu?.ui?.saveBufferFile) {
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


export function injectTextToBuffer(filepath, text, isMarkdown, isFS, forceAllowEdit = false) {
    const TRUNCATE_LIMIT = 200000;
    const isTruncated = text.length > TRUNCATE_LIMIT;
    const content = isTruncated ? text.substring(0, TRUNCATE_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR PERFORMANCE] ...' : text;
    const curRev = (FsStore.getState().activeBuffers?.[filepath]?.docRevision || 0) + 1;
    FsStore.getState().updateBuffer(filepath, {
        content, originalContent: content, fullText: text, isTruncated,
        forceEdit: forceAllowEdit, docRevision: curRev, savedRevision: curRev
    });
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
    if (savingSet.has(normPath)) return;
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
    } catch (saveErr) {
        if (String(saveErr?.message || '').includes('OCC Conflict')) {
            setTimeout(() => reconcileBufferWithDisk(normPath, true), 50);
        }
    } finally {
        savingSet.delete(normPath);
    }
}


export async function reconcileBufferWithDisk(filepath, forceBaselineSync = false) {
    const normPath = normalizeVfsURI(filepath);
    const fsState = FsStore.getState();
    const recSet = fsState.reconcilingPaths;
    const savingSet = fsState.savingPaths;
    if (!normPath || recSet.has(normPath) || savingSet?.has(normPath)) return;
    const curBuf = fsState.activeBuffers?.[normPath] || fsState.activeBuffers?.[filepath];
    if (!curBuf || !curBuf.isFS || curBuf.isTruncated || curBuf.content === 'Loading...') return;

    const startDocRev = curBuf.docRevision || 0;
    const startBaseHash = curBuf.baseHash || null;
    recSet.add(normPath);
    try {
        const r = await window.inSetu.api.get(`fs/fetch?file=${encodeURIComponent(normPath)}&t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!r.ok) return;
        const newText = await r.text();
        const latestState = FsStore.getState();
        const latestBuf = latestState.activeBuffers?.[normPath] || latestState.activeBuffers?.[filepath];
        if (!latestBuf || newText === null) return;

        if (
            !forceBaselineSync && (
                latestState.savingPaths?.has(normPath) ||
                (latestBuf.docRevision || 0) !== startDocRev ||
                (latestBuf.baseHash || null) !== startBaseHash
            )
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

        if (!forceBaselineSync && newHash && Array.isArray(latestBuf.ancestorHashes) && latestBuf.ancestorHashes.includes(newHash) && latestBuf.content !== latestBuf.originalContent) {
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
            const nextRev = (latestBuf.docRevision || 0) + 1;
            if (rebased.clean) {
                FsStore.getState().updateBuffer(normPath, {
                    content: rebased.merged,
                    originalContent: newText,
                    fullText: rebased.merged,
                    baseHash: newHash,
                    ancestorHashes: nextAncestors,
                    docRevision: nextRev
                });
            } else {
                // Advance baseline hash to the new disk state so subsequent saves do not loop on 409 OCC conflicts
                FsStore.getState().updateBuffer(normPath, {
                    originalContent: newText,
                    baseHash: newHash,
                    ancestorHashes: nextAncestors
                }, { skipFrontmatterParse: true });
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
        // Protected recovery files are never flushed in the background (S8): the person saves them explicitly.
        if (buf && buf.isFS && !buf.isTruncated && !buf.isProtected && buf.content !== buf.originalContent && buf.content !== 'Loading...') {
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
    const { ext, mode: codeMode, isMarkdown } = resolveEditorMode(normPath);

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
            ext,
            codeMode
        });
    }

    const promise = (async () => {
        try {
            let text = null;
            // Asked alongside the content fetch, so a protected file opens with its banner and without autosave (S8).
            const protectionCheck = effectiveIsFS
                ? window.inSetu.api.getJson(`fs/protected?file=${encodeURIComponent(normPath)}`).catch(() => null)
                : Promise.resolve(null);
            const activeWs = window.inSetu.utils.getActiveWorkspace();
            const fetchUrl = resolveFileFetchUrl(normPath, effectiveIsFS);
            const res = await window.inSetu.api.request(fetchUrl, {}, activeWs);
            if (res && res.ok) {
                text = await res.text();
            }
            if (text === null) {
                throw new Error("Failed to fetch");
            }
            let initialHash = null;
            try {
                const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
                initialHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch(e) {}
            const protection = await protectionCheck;
            FsStore.getState().updateBuffer(normPath, {
                baseHash: initialHash,
                ancestorHashes: initialHash ? [initialHash] : [],
                saveStatus: 'idle',
                docHandle: null,
                isProtected: Boolean(protection?.protected),
                protectedMessage: protection?.message || ''
            });
            injectTextToBuffer(normPath, text, isMarkdown, effectiveIsFS);
        } catch (e) {
            injectTextToBuffer(normPath, "Error loading file content.", isMarkdown, effectiveIsFS);
        } finally {
            delete FsStore.getState().hydratingPromises[normPath];
        }
        return FsStore.getState().activeBuffers?.[normPath] || null;
    })();

    fsState.hydratingPromises[normPath] = promise;
    return promise;
}


export const extractManifestFiles = (...args) => window.inSetu.utils.extractManifestFiles(...args);


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

const MAX_SHARE_CACHE_ITEMS = 24;
const SHARE_CACHE_TTL_MS = 3600 * 1000;

export function cacheShareText(filepath, text) {
    if (!filepath || typeof text !== 'string') return;
    const { shareTextCache: cache, shareCacheTimestamps: tsMap } = FsStore.getState();
    if (!cache) return;
    if (cache.has(filepath)) cache.delete(filepath);
    cache.set(filepath, text);
    tsMap?.set(filepath, Date.now());
    while (cache.size > MAX_SHARE_CACHE_ITEMS) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) break;
        cache.delete(oldestKey);
        tsMap?.delete(oldestKey);
    }
}

export function getCachedShareText(filepath) {
    if (!filepath) return null;
    const { shareTextCache: cache, shareCacheTimestamps: tsMap } = FsStore.getState();
    if (!cache || !cache.has(filepath)) return null;
    const ts = tsMap?.get(filepath) || 0;
    if (ts > 0 && (Date.now() - ts) > SHARE_CACHE_TTL_MS) {
        cache.delete(filepath);
        tsMap?.delete(filepath);
        return null;
    }
    return cache.get(filepath);
}

export function invalidateShareCache(filepath = null) {
    const { shareTextCache: cache, shareCacheTimestamps: tsMap } = FsStore.getState();
    if (!cache) return;
    if (!filepath) {
        cache.clear();
        tsMap?.clear();
        return;
    }
    cache.delete(filepath);
    tsMap?.delete(filepath);
    if (filepath.startsWith('vfs://')) {
        for (const k of Array.from(cache.keys())) {
            if (k.startsWith('ctx://contexts/') && !k.includes('/quickpack_') && !k.includes('/selection_')) {
                cache.delete(k);
                tsMap?.delete(k);
            }
        }
    }
}

export async function preWarmShareArtifact(baseFile, chunks = null, isFS = false) {
    if (!baseFile) return [];
    try {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const manifestChunks = getChunks(baseFile);
        const targetFiles = (manifestChunks && manifestChunks.length > 0)
            ? manifestChunks
            : ((Array.isArray(chunks) && chunks.length > 0) ? chunks : [baseFile]);
        const warmed = [];
        for (const fp of targetFiles) {
            const existing = getCachedShareText(fp);
            if (existing !== null) {
                warmed.push(fp);
                continue;
            }
            const fileIsFS = (targetFiles.length > 1) ? false : isFS;
            const fetchUrl = resolveFileFetchUrl(fp, fileIsFS);
            const text = await window.inSetu.api.fetchImmutableText(fetchUrl, { onlyIfMissing: true }, activeWs);
            if (typeof text === 'string') {
                cacheShareText(fp, text);
                warmed.push(fp);
            }
        }
        return warmed;
    } catch (_) {
        return [];
    }
}


export function syncVirtualBuffer(virtualUri, fullText = null) {
    const fsStore = window.inSetu?.stores?.Fs?.getState();
    if (!fsStore) return;
    if (fullText === null) {
        fsStore.closeBuffer(virtualUri);
        return;
    }
    const existing = fsStore.activeBuffers?.[virtualUri];
    if (existing) {
        fsStore.openBuffer(virtualUri, { ...existing, content: fullText, originalContent: fullText, fullText });
    }
}


export async function preCacheFiles(filepaths = [], { label = 'selection' } = {}) {
    const validFiles = (filepaths || []).filter(f => f && !f.endsWith('/.gitkeep') && !f.endsWith('/.keep'));
    if (validFiles.length === 0) {
        if (window.inSetu?.ui?.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus(`No indexed files found for '${label}'.`, 3000, true);
        }
        return 0;
    }
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const urls = validFiles.map(fp => resolveFileFetchUrl(fp, true));
    if (window.inSetu?.stores?.App?.getState()?.enqueueWarming) {
        window.inSetu.stores.App.getState().enqueueWarming(urls);
    }
    window.inSetu?.offlineLog?.(`Pre-caching '${label}' (${urls.length} files)...`, 'info', null, 'cache');
    if (window.inSetu?.ui?.setGlobalStatus) {
        window.inSetu.ui.setGlobalStatus(`⏳ Caching ${urls.length} files for ${label}...`, null);
    }
    let cachedCount = 0;
    for (const fetchUrl of urls) {
        try {
            await window.inSetu.api.fetchImmutableText(fetchUrl, {}, activeWs);
            cachedCount++;
        } catch (_) {}
    }
    window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState?.();
    window.inSetu?.offlineLog?.(`Pre-cached ${cachedCount}/${urls.length} files for '${label}'.`, 'success', null, 'cache');
    if (window.inSetu?.ui?.setGlobalStatus) {
        window.inSetu.ui.setGlobalStatus(`✅ Cached ${cachedCount} files for ${label}`, 3000);
    }
    return cachedCount;
}
