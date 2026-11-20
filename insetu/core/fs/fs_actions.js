import { downloadBlob } from '/static/extensions/system/insetu_sdk.js';
import { AppStore, SelectionStore } from '/static/extensions/system/store.js';
import {
    FsStore, normalizeVfsURI, canPreviewFileMacros, resolveFileFetchUrl, isMultiPartArtifact
} from '/static/extensions/fs/fs_store.js';

export function registerFsExtension({
    openNewFolderModal,
    openNewFileModal,
    uploadFileToWorkspace,
    getGlobalManifest,
    deleteEmptyFolder,
    openFolderBrowser,
    relocateVfsNode,
    archiveVfsNode,
    deleteVfsNode,
    executeBulkMove,
    executeBulkArchive,
    executeBulkDelete,
    executeDownloadZip,
    isFileGitModified,
    viewFileGitDiff,
    resolveConflictOriginalPath,
    viewTwoFileDiff,
    resolveEntityExportTarget,
    resolveExpandedExportText,
    ensureFreshContext,
    copyTextFromPromise,
    fetchArtifactText,
    shareFiles
}) {
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
        variantSets: [
            {
                id: 'send',
                label: 'Send',
                icon: 'send',
                intent: 'primary',
                group: 'share',
                surfaced: 1,
                order: 12,
                sections: ['Raw', 'Expanded'],
                families: {
                    files: ['file', 'file:note', 'file:prompt', 'note', 'prompt'],
                    structured: ['task', 'file:task', 'skill'],
                    packs: ['file:context', 'file:diff', 'context', 'diff', 'bulk'],
                    folders: ['folder', 'repo', 'config-repo'],
                    records: [
                        'hook_rule', 'agent_routine', 'agent_session', 'research_job',
                        'citation', 'patch-receipt', 'yomama', 'yomama-turn',
                        'freshdesk_ticket', 'text_blob'
                    ]
                },
                defaults: {
                    files: ['file-copy', 'file-share', 'file-download', 'bulk-pack-copy', 'bulk-pack-share', 'bulk-pack-download'],
                    structured: ['file-copy', 'file-share', 'file-download', 'bulk-pack-copy', 'bulk-pack-share', 'bulk-pack-download'],
                    packs: ['file-copy', 'file-share', 'file-download', 'bulk-pack-copy', 'bulk-pack-share', 'bulk-pack-download'],
                    folders: ['vfs-download-zip', 'file-download', 'bulk-pack-download'],
                    records: ['file-copy', 'blob-copy', 'yomama-copy', 'patch-receipt-copy', 'bulk-pack-copy', 'bulk-pack-share', 'bulk-pack-download']
                }
            }
        ],
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
                keepSelection: true, // hands off to a dialog; clears on its success
                label: 'Move',
                icon: 'truck',
                group: 'file',
                vfsBound: true,
                intent: 'neutral',
                order: 64,
                bulkable: true,
                match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
                onClick: (data) => {
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
                            await relocateVfsNode(srcUri.toString(), normDest, true, { loadingText: 'Moving folder...' });
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
                bulkAction: (items) => executeBulkMove(items)
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
                asyncAction: async (data) => {
                    const srcUri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                    const currentName = srcUri.basename;
                    const rawNewName = prompt(`Enter new ${data.isDir ? 'folder' : 'file'} name:`, currentName);
                    if (!rawNewName) return;
                    const newName = rawNewName.trim().replace(/^\/+|\/+$/g, '');
                    if (!newName || newName === currentName) return;
                    const destPath = srcUri.withName(newName);
                    await relocateVfsNode(srcUri.toString(), destPath, !!data.isDir, { loadingText: 'Renaming...' });
                }
            },
            {
                targetEntity: 'file',
                targetEntities: ['file', 'folder'],
                id: 'vfs-archive',
                bulkGroupKey: 'archive',
                keepSelection: true, // hands off to a dialog; clears on its success
                label: 'Archive',
                icon: 'archive',
                group: 'file',
                vfsBound: true,
                intent: 'warning',
                order: 66,
                bulkable: true,
                match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
                asyncAction: async (data) => {
                    const targetUri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                    const label = data.isDir ? `folder "${targetUri.basename}"` : `this file`;
                    if (!confirm(`Archive ${label} to an 'archived/' directory?`)) return;
                    await archiveVfsNode(targetUri.toString(), !!data.isDir, { loadingText: 'Archiving...' });
                },
                bulkAction: (items) => executeBulkArchive(items)
            },
            {
                targetEntity: 'file',
                targetEntities: ['file', 'folder'],
                id: 'vfs-delete',
                bulkGroupKey: 'delete',
                keepSelection: true, // hands off to a dialog; clears on its success
                label: 'Delete',
                icon: 'trash-2',
                group: 'file',
                vfsBound: true,
                intent: 'danger',
                order: 67,
                bulkable: true,
                match: (data) => (data.isFS || data.isDir) && !data.isSkeleton,
                asyncAction: async (data) => {
                    const targetUri = new window.inSetu.utils.InSetuURI(data.isDir ? (data.folderpath || data.filepath) : data.filepath);
                    const label = data.isDir ? `folder "${targetUri.basename}" and all its contents` : `this file`;
                    if (!confirm(`Permanently delete ${label}? This cannot be undone!`)) return;
                    await deleteVfsNode(targetUri.toString(), !!data.isDir, { loadingText: 'Deleting...' });
                },
                bulkAction: (items) => executeBulkDelete(items)
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
                onClick: (data) => {
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
                onClick: (data) => {
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
                onClick: (data) => {
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
                onClick: (data) => {
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
                        if (resolveConflictOriginalPath(a)) {
                            viewTwoFileDiff(b, a);
                        } else {
                            viewTwoFileDiff(a, b);
                        }
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
                }
            },
            {
                targetEntity: 'file',
                id: 'file-copy',
                label: 'Copy Raw',
                successLabel: 'Copied',
                set: 'send',
                section: 'Raw',
                surfaced: 1,
                icon: 'clipboard',
                group: 'share',
                vfsBound: false,
                intent: 'success',
                order: 12,
                match: (data) => {
                    if (!data || data.isSkeleton || data.isDir) return false;
                    return !isMultiPartArtifact(data);
                },
                asyncAction: async (data) => {
                    const preTarget = resolveEntityExportTarget(data);
                    if (preTarget.mode === 'memory') {
                        await copyTextFromPromise(() => preTarget.text).then(() => {
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
                        }).catch(() => alert("Clipboard API failed. Please manually select the text and copy it directly."));
                        return;
                    }
                    // fetchArtifactText compiles a stale artifact first (ensureFreshContext) and reads through the share cache.
                    await copyTextFromPromise(() => fetchArtifactText(data.filepath, { isFS: preTarget.isFS }));
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied!", 2000);
                }
            },
            {
                targetEntity: 'file',
                id: 'file-copy-expanded',
                label: 'Copy Expanded',
                successLabel: 'Copied',
                set: 'send',
                section: 'Expanded',
                surfaced: 1,
                icon: 'sparkles',
                group: 'share',
                vfsBound: false,
                intent: 'highlight',
                order: 12.5,
                match: (data) => {
                    if (!data || data.isSkeleton || data.isDir) return false;
                    return Boolean(data.supportsMacroPreview || data.hasMacros || canPreviewFileMacros(data.filepath, data.transientContent || ''));
                },
                asyncAction: async (data) => {
                    await copyTextFromPromise(async () => {
                        const { text } = await resolveExpandedExportText(data);
                        return text;
                    }).then(() => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✅ Copied Expanded!", 2000);
                    }).catch(() => alert("Clipboard API failed. Please manually select the text and copy it directly."));
                }
            },
            {
                targetEntity: 'file',
                id: 'file-browse',
                label: 'Browse',
                surfaced: 2,
                icon: 'folder',
                group: 'tools',
                vfsBound: false,
                intent: 'neutral',
                order: 14,
                match: (data) => {
                    if (data.isSkeleton) return false;
                    return data.filepath && (data.filepath.startsWith('ctx://') || data.filepath.endsWith('_context.txt') || data.filepath.endsWith('_diffs.txt'));
                },
                onClick: (data) => {
                    if (window.inSetu.ui.openBrowseModal) window.inSetu.ui.openBrowseModal(data.filepath);
                }
            },
            {
                targetEntity: 'file',
                id: 'file-share',
                label: 'Share Raw',
                successLabel: 'Shared',
                set: 'send',
                section: 'Raw',
                surfaced: 1,
                icon: 'share',
                group: 'share',
                vfsBound: false,
                keepDrawerOpen: true,
                intent: 'primary',
                order: 15,
                match: (data) => {
                    if (!data || data.isSkeleton) return false;
                    return !!navigator.share && !!navigator.canShare;
                },
                onClick: (data, e) => {
                    if (e) e.stopPropagation();
                    const target = resolveEntityExportTarget(data);
                    if (target.mode === 'memory') {
                        window.inSetu.utils.nativeShareFiles([{ content: target.text || '', filename: target.filename }]).catch(() => {});
                        return;
                    }
                    shareFiles(data.filepath, target.chunks, target.isFS);
                }
            },
            {
                targetEntity: 'file',
                id: 'file-share-expanded',
                label: 'Share Expanded',
                successLabel: 'Shared',
                set: 'send',
                section: 'Expanded',
                surfaced: 1,
                icon: 'sparkles',
                group: 'share',
                vfsBound: false,
                keepDrawerOpen: true,
                intent: 'highlight',
                order: 15.5,
                match: (data) => {
                    if (!data || data.isSkeleton || data.isDir) return false;
                    if (!navigator.share || !navigator.canShare) return false;
                    return Boolean(data.supportsMacroPreview || data.hasMacros || canPreviewFileMacros(data.filepath, data.transientContent || ''));
                },
                onClick: (data, e) => {
                    if (e) e.stopPropagation();
                    resolveExpandedExportText(data).then(({ text, filename }) => {
                        window.inSetu.utils.nativeShareFiles([{ content: text || '', filename }]).catch(() => {});
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
                    if (!data || data.isSkeleton || !data.filepath) return false;
                    return isMultiPartArtifact(data);
                },
                onClick: (data) => {
                    window.dispatchEvent(new CustomEvent('insetu:vfs:view-parts', { detail: { filepath: data.filepath } }));
                }
            },
            {
                targetEntity: 'file',
                id: 'file-download',
                label: 'Download Raw',
                successLabel: 'Downloaded',
                set: 'send',
                section: 'Raw',
                surfaced: 1,
                icon: 'download',
                group: 'share',
                vfsBound: false,
                intent: 'primary',
                order: 18,
                match: (data) => Boolean(data && !data.isSkeleton && !data.isDir),
                asyncAction: async (data) => {
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
                targetEntities: ['folder'],
                id: 'vfs-download-zip',
                label: 'Download Raw',
                successLabel: 'Downloaded',
                set: 'send',
                section: 'Raw',
                surfaced: 1,
                icon: 'download',
                group: 'share',
                vfsBound: false,
                intent: 'primary',
                order: 18.2,
                bulkable: false,
                match: (data) => Boolean(data && !data.isSkeleton && (data.isDir || data.folderpath)),
                asyncAction: async (data) => {
                    await executeDownloadZip([data]);
                }
            },
            {
                targetEntity: 'file',
                targetEntities: ['file', 'folder'],
                id: 'vfs-bulk-download-zip',
                bulkGroupKey: 'download-zip',
                label: 'Download ZIP',
                bulkLabel: 'Download ZIP',
                successLabel: 'Downloaded',
                icon: 'archive',
                group: 'file',
                vfsBound: false,
                intent: 'primary',
                order: 18.3,
                bulkable: true,
                bulkOnly: true,
                match: (data) => Boolean(data && !data.isSkeleton && (data.isDir || data.filepath || data.folderpath)),
                bulkAction: async (items) => {
                    await executeDownloadZip(items);
                }
            },
            {
                targetEntity: 'file',
                id: 'file-download-expanded',
                label: 'Download Expanded',
                successLabel: 'Downloaded',
                set: 'send',
                section: 'Expanded',
                surfaced: 1,
                icon: 'sparkles',
                group: 'share',
                vfsBound: false,
                intent: 'highlight',
                order: 18.5,
                match: (data) => {
                    if (!data || data.isSkeleton || data.isDir) return false;
                    return Boolean(data.supportsMacroPreview || data.hasMacros || canPreviewFileMacros(data.filepath, data.transientContent || ''));
                },
                asyncAction: async (data) => {
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
}
