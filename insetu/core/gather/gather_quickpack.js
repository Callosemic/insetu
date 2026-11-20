import { html } from 'lit';
import { AppStore, SelectionStore } from '/static/extensions/system/store.js';

let _lastPackSelection = null;
let _lastPackItemsHash = '';

export function clearQuickpackSelectionCache() {
    _lastPackSelection = null;
    _lastPackItemsHash = '';
}

window.addEventListener('insetu:vfs-mutated', clearQuickpackSelectionCache);
window.addEventListener('insetu:soft-refresh', clearQuickpackSelectionCache);

export const computePackSelectionPayload = (items) => {
    const payloadItems = items.map(i => {
        const d = i.data || i;
        if (typeof d === 'string' && d.trim()) {
            const isDirStr = d.trim().endsWith('/');
            return { filepath: d.trim(), isDir: isDirStr };
        }
        const rawTarget = String(d?.filepath || d?.folderpath || d?.id || '').trim();
        if (!rawTarget) return null;
        const isDir = Boolean(d?.isDir || d?.folderpath || rawTarget.endsWith('/'));
        if (isDir) {
            const cleanDir = rawTarget.replace(/\/+$/, '');
            return { filepath: `${cleanDir}/`, folderpath: cleanDir, isDir: true };
        }
        return { filepath: rawTarget, isDir: false };
    }).filter(i => i !== null);

    const manifest = window.inSetu?.stores?.App?.getState()?.manifest || { vfs: {}, ctx: {} };
    const statefulItems = payloadItems.map(p => {
        const fp = p.filepath || p.folderpath;
        let ts = 0;
        if (manifest.ctx && manifest.ctx[fp]) ts = manifest.ctx[fp].meta?.timestamp || 0;
        return `${fp}@${ts}`;
    });

    return { payloadItems, itemsHash: JSON.stringify(statefulItems) };
};

const _isSelectionKnownMultiPart = (items) => {
    const list = Array.isArray(items) ? items : [];
    for (const item of list) {
        const d = item?.data || item || {};
        if (window.inSetu?.vfs?.isMultiPartArtifact ? window.inSetu.vfs.isMultiPartArtifact(d) : (Array.isArray(d.chunks) && d.chunks.length > 1)) {
            return true;
        }
    }
    if (list.length > 0) {
        const { itemsHash } = computePackSelectionPayload(list);
        if (_lastPackItemsHash === itemsHash && _lastPackSelection && Array.isArray(_lastPackSelection.chunks) && _lastPackSelection.chunks.length > 1) {
            return true;
        }
    }
    return false;
};

const _notifySelectionTrayMultiPart = () => {
    const selState = SelectionStore.getState();
    if (selState?.selectedItems && selState.selectedItems.size > 0) {
        SelectionStore.setState({ selectedItems: new Map(selState.selectedItems) });
    }
};

export const packSelectionPayload = async (items) => {
    const { payloadItems, itemsHash } = computePackSelectionPayload(items);
    if (payloadItems.length === 0) throw new Error("No valid items to pack.");

    if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
        return _lastPackSelection;
    }
    const res = await window.inSetu.api.post('gather/pack_selection', { items: payloadItems });
    if (!res.ok) throw new Error("Failed to queue compilation.");
    const data = await res.json();
    if (data.job_id === 'offline_queue') {
        throw new Error("Quickpack compilation requires an active network connection.");
    }
    return new Promise((resolve, reject) => {
        window.inSetu.utils.pollJob(data.job_id, {
            onProgress: (msg) => { if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null); },
            onComplete: async (statusData) => {
                const artifact = statusData.artifact || {};
                if (artifact.base_filename && artifact.manifest_entry) {
                    const curManifest = AppStore.getState().manifest || { vfs: {}, ctx: {} };
                    AppStore.setState({
                        manifest: {
                            vfs: curManifest.vfs || {},
                            ctx: { ...(curManifest.ctx || {}), [artifact.base_filename]: artifact.manifest_entry }
                        }
                    });
                } else if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
                const packedFiles = artifact.manifest_entry?.files || [];
                if (packedFiles.length > 0 && packedFiles.every(f => typeof f === 'string')) {
                    _lastPackItemsHash = itemsHash;
                    _lastPackSelection = artifact;
                } else {
                    _lastPackItemsHash = '';
                    _lastPackSelection = null;
                }
                if (artifact.base_filename && window.inSetu?.vfs?.preWarmShareArtifact) {
                    window.inSetu.vfs.preWarmShareArtifact(artifact.base_filename, artifact.chunks, false);
                }
                resolve(artifact);
            },
            onError: (err) => reject(err)
        });
    });
};

export const GATHER_EXTENSION_MANIFEST = {
    name: "Context Gatherer",
    version: "2.0.0",
    icon: "hexagon",
    offline_mode: "read_only",
    repoConfigOptions: [
        {
            id: 'gather-repo-exclude',
            order: 10,
            component: ({ repo, updateCallback }) => html`
                <sutram-toggle 
                    label="Exclude from Context Compilation" 
                    .checked=${!!repo.exclude_from_context} 
                    ?flush=${true}
                    @sutram-input-changed=${(e) => { 
                        repo.exclude_from_context = e.detail.value; 
                        updateCallback(); 
                    }}>
                </sutram-toggle>
            `
        }
    ],
    bucketConfigOptions: [
        {
            id: 'gather-exclude',
            order: 10,
            component: ({ bucket, updateCallback }) => html`
                <sutram-toggle 
                    label="Exclude from Context Compilation" 
                    .checked=${!!bucket.exclude_from_context} 
                    ?flush=${true}
                    @sutram-input-changed=${(e) => { 
                        bucket.exclude_from_context = e.detail.value; 
                        updateCallback(); 
                    }}>
                </sutram-toggle>
            `
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "gather",
            label: "Gather",
            icon: "hexagon",
            intent: "primary",
            order: 1,
            component: "insetu-ext-gather"
        }
    ],
    entityActions: [
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-copy',
            bulkGroupKey: 'pack-copy',
            label: 'Copy Raw',
            bulkLabel: 'Copy Raw',
            successLabel: 'Copied',
            set: 'send',
            section: 'Raw',
            surfaced: 1,
            icon: 'clipboard',
            intent: 'success',
            group: 'share',
            vfsBound: true,
            order: 15,
            bulkable: true,
            bulkOnly: true,
            match: (data) => {
                if (!(data?.filepath || data?.folderpath)) return false;
                if (window.inSetu?.vfs?.isMultiPartArtifact ? window.inSetu.vfs.isMultiPartArtifact(data) : (Array.isArray(data?.chunks) && data.chunks.length > 1)) {
                    return false;
                }
                const selMap = SelectionStore.getState()?.selectedItems;
                if (selMap && selMap.size > 0 && _isSelectionKnownMultiPart(Array.from(selMap.values()))) {
                    return false;
                }
                return true;
            },
            bulkAction: async (items) => {
                if (window.inSetu.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus("⏳ Compiling Quickpack for Copy...", null);
                }
                const compileAndRead = async () => {
                    const artifact = await packSelectionPayload(items);
                    if (Array.isArray(artifact?.chunks) && artifact.chunks.length > 1) {
                        _notifySelectionTrayMultiPart();
                        throw new Error("Quickpack has multiple parts; use Share Raw or Download Raw.");
                    }
                    const targetUri = (Array.isArray(artifact?.chunks) && artifact.chunks[0]) || artifact?.base_filename;
                    if (!targetUri) throw new Error("Compiled quickpack is empty.");
                    return await window.inSetu.vfs.fetchArtifactText(targetUri, { isFS: false, requireSinglePart: true });
                };

                try {
                    if (window.inSetu?.vfs?.copyTextFromPromise) {
                        await window.inSetu.vfs.copyTextFromPromise(compileAndRead);
                    } else {
                        const text = await compileAndRead();
                        await navigator.clipboard.writeText(text);
                    }
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("✅ Copied Quickpack!", 2000);
                    }
                } catch (err) {
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus(`❌ Copy Error: ${err.message}`, 3500, true);
                    }
                    throw err;
                }
            }
        },
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-download',
            bulkGroupKey: 'pack-download',
            label: 'Download Raw',
            bulkLabel: 'Download Raw',
            successLabel: 'Downloaded',
            set: 'send',
            section: 'Raw',
            surfaced: 1,
            icon: 'download',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 20,
            bulkable: true,
            bulkOnly: true,
            match: (data) => !!(data?.filepath || data?.folderpath),
            bulkAction: async (items) => {
                try {
                    const artifact = await packSelectionPayload(items);
                    if (artifact.chunks && artifact.chunks.length > 1) {
                        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading Parts...", 2000);
                        for (const f of artifact.chunks) {
                            const fetchUrl = `${window.inSetu.vfs.resolveFileFetchUrl(f, false)}&download=1`;
                            if (window.inSetu.vfs.fetchAndDownloadState) {
                                await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl);
                                await new Promise(r => setTimeout(r, 300));
                            }
                        }
                    } else {
                        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⚡ Quickpack Ready. Downloading...", 2000);
                        if (window.inSetu.vfs.fetchAndDownloadState) {
                            const fetchUrl = `${window.inSetu.vfs.resolveFileFetchUrl(artifact.base_filename, false)}&download=1`;
                            await window.inSetu.vfs.fetchAndDownloadState(artifact.base_filename, fetchUrl);
                        }
                    }
                } catch (err) {
                    alert("Packing failed: " + err.message);
                }
            }
        },
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-share',
            bulkGroupKey: 'pack-share',
            label: 'Share Raw',
            bulkLabel: 'Share Raw',
            successLabel: 'Shared',
            set: 'send',
            section: 'Raw',
            surfaced: 1,
            icon: 'share',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 25,
            bulkable: true,
            bulkOnly: true,
            match: (data) => !!(data?.filepath || data?.folderpath) && !!navigator.share && !!navigator.canShare,
            bulkOnClick: (items, e) => {
                if (e) e.stopPropagation();

                const { itemsHash } = computePackSelectionPayload(items);
                if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
                    window.inSetu.vfs.shareFiles(_lastPackSelection.base_filename, _lastPackSelection.chunks);
                    return;
                }

                if (window.inSetu.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus("⏳ Compiling Quickpack for Share...", null);
                }
                packSelectionPayload(items).then(artifact => {
                    window.inSetu.vfs.shareFiles(artifact.base_filename, artifact.chunks);
                }).catch(err => {
                    alert("Packing failed: " + err.message);
                });
            }
        },
        {
            targetEntity: '*',
            targetEntities: ['*'],
            id: 'gather-pack-compile',
            bulkGroupKey: 'pack-compile',
            label: 'Compile Only',
            bulkLabel: 'Compile Only',
            surfaced: 2,
            icon: 'zap',
            intent: 'warning',
            emphasis: true,
            group: 'share',
            vfsBound: true,
            order: 30,
            bulkable: true,
            bulkOnly: true,
            match: (data) => !!(data?.filepath || data?.folderpath),
            bulkAction: async (items) => {
                try {
                    const { itemsHash } = computePackSelectionPayload(items);
                    if (_lastPackItemsHash === itemsHash && _lastPackSelection) {
                        if (window.inSetu.ui?.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus("⚡ Quickpack already in Gather!", 2000);
                        }
                        return;
                    }
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⏳ Compiling Quickpack...", null);
                    }
                    await packSelectionPayload(items);
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⚡ Quickpack compiled to Gather!", 3000);
                    }
                } catch (err) {
                    alert("Packing failed: " + err.message);
                }
            }
        }
    ]
};
