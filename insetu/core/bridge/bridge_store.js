/**
 * Yomama Sync Bridge state store (BridgeStore) and declarative gate/flag UI metadata maps.
 */
import { createExtensionStore } from '/static/extensions/system/insetu_sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export const BRIDGE_BASE_LAYOUT_SLOTS = [
    {
        slot: "slots:sub-navigation",
        targetParent: "edit",
        id: "bridge",
        label: "Yomama",
        icon: "bridge",
        intent: "highlight",
        order: 1,
        headerActionComponent: "insetu-ext-bridge-actions",
        component: "insetu-ext-bridge"
    },
    { slot: "slots:yomama-surface", id: "bridge", label: "Bridge", icon: "bridge", intent: "highlight", order: 10, component: null },
    { slot: "slots:yomama-surface", id: "receipts", label: "Receipts", icon: "history", intent: "success", order: 40, component: "insetu-ext-bridge-history" }
];

export const BRIDGE_GATE_UI_MAP = {
    DESTRUCTIVE_DELETE: { label: 'Confirm Delete', intent: 'danger', icon: 'trash-2' },
    OVERWRITE_EXISTING: { label: 'Confirm Overwrite', intent: 'warning', icon: 'file-warning' },
    EXPANSION_RISK: { label: 'Confirm Expansion', intent: 'warning', icon: 'maximize-2' },
    SYNTAX_ERROR: { label: 'Ignore Syntax & Commit', intent: 'danger', icon: 'alert-triangle' },
    OUT_OF_SCOPE_TARGET: { label: 'Authorize File Edit', intent: 'warning', icon: 'shield-alert' }
};

export const BRIDGE_FLAG_UI_MAP = {
    ast_relocate: {
        label: (p) => {
            const rawDst = p.target_uri && window.inSetu?.utils?.InSetuURI ? new window.inSetu.utils.InSetuURI(p.target_uri).basename : '';
            const dstName = window.inSetu?.utils?.truncateFilename ? window.inSetu.utils.truncateFilename(rawDst, 18) : rawDst;
            return dstName ? `relocate → ${dstName}` : 'relocate';
        },
        tooltip: (p) => `relocate:${p.symbol || ''}${p.target_uri ? ` → ${p.target_uri}` : ''}`,
        intent: 'highlight'
    },
    ast_rename: {
        label: (p) => `renamed (${p.renamed_count || 0})`,
        tooltip: (p) => `Renamed ${p.symbol || ''} in ${p.renamed_count || 0} file(s)`,
        intent: 'highlight'
    },
    move_file: {
        label: (p) => {
            const rawDst = p.target_uri && window.inSetu?.utils?.InSetuURI ? new window.inSetu.utils.InSetuURI(p.target_uri).basename : (p.target_uri || '');
            const dstName = window.inSetu?.utils?.truncateFilename ? window.inSetu.utils.truncateFilename(rawDst, 18) : rawDst;
            return `move → ${dstName}`;
        },
        tooltip: (p) => `move → ${p.target_uri || ''}`,
        intent: 'highlight'
    },
    archive_file: {
        label: () => 'archived',
        tooltip: (p) => `archive → ${p.target_uri || 'archived'}`,
        intent: 'highlight'
    },
    delete_file: { label: () => 'delete file', intent: 'danger' },
    confirm_delete: { label: () => 'confirm delete', intent: 'danger' },
    json_patch: { label: () => 'json patch', intent: 'primary' },
    already_applied: { label: () => 'Already Applied', intent: 'success' },
    rebased_overlap: { label: () => 'Rebased Overlap', intent: 'success' },
    sandwich_healed: { label: () => '✨ Sandwich Auto-Healed', intent: 'success' },
    code_removal: { label: () => 'Code Removal', intent: 'warning' },
    expansion_risk: { label: () => 'Expansion Risk', intent: 'warning' },
    'confirm-to-overwrite': { label: () => 'Confirm Overwrite', intent: 'warning' },
    ambiguous_anchor: { label: () => 'Ambiguous Anchor', intent: 'warning' },
    protected_needs_confirmation: { label: () => 'Protected: Waits for Your Confirmation', intent: 'warning' },
    read_only_mount: { label: () => 'Read-Only Mount', intent: 'danger' },
    banned_target: { label: () => 'Banned Target', intent: 'danger' },
    execution_locked: { label: () => 'Execution Locked', intent: 'danger' }
};

export const BridgeStore = createExtensionStore('Bridge', {
    cells: [],
    resolutions: {},
    activeSurface: 'bridge',
    repairMode: 'algorithmic',
    autoHeal: false,
    fastTierStatus: {
        canAutoHeal: false,
        reason: 'Checking Fast LLM tier configuration...',
        model: '',
        endpointId: '',
        isWebChat: false
    },
    drawerOpen: false,
    drawerCollapsedDesktop: false,
    activeBridgeJobId: null,
    viewMode: 'input',
    consoleOutput: 'Ready...',
    telemetry: null,
    historyRecords: [],
    historyViewMode: 'transaction',
    editCellId: null,
    editCellOriginalFile: '',
    setRepairMode: (mode) => {
        const clean = ['off', 'algorithmic', 'ai_assisted'].includes(mode) ? mode : 'algorithmic';
        const canAi = Boolean(BridgeStore.getState().fastTierStatus?.canAutoHeal);
        const finalMode = (clean === 'ai_assisted' && !canAi) ? 'algorithmic' : clean;
        BridgeStore.setState({
            repairMode: finalMode,
            autoHeal: finalMode === 'ai_assisted'
        });
    },
    cycleRepairMode: () => {
        const st = BridgeStore.getState();
        const cur = st.repairMode || 'algorithmic';
        const canAi = Boolean(st.fastTierStatus?.canAutoHeal);
        const order = canAi ? ['off', 'algorithmic', 'ai_assisted'] : ['off', 'algorithmic'];
        const nextIdx = (order.indexOf(cur) + 1) % order.length;
        BridgeStore.getState().setRepairMode(order[nextIdx]);
    },
    setResolution: (key, patch) => {
        if (!key) return;
        BridgeStore.setState(state => ({
            resolutions: {
                ...(state.resolutions || {}),
                [key]: { ...((state.resolutions || {})[key] || {}), ...patch }
            }
        }));
    },
    setActiveSurface: (surface) => {
        const target = surface || 'bridge';
        BridgeStore.setState({ activeSurface: target, drawerOpen: false });
        const slots = window.ExtensionRegistry?.getLayoutSlots?.() || [];
        const matched = slots.find(s => s.slot === 'slots:yomama-surface' && ((s.rawId || s.id.split(':').pop()) === target || s.id === target));
        const nextIntent = matched?.intent || (target === 'receipts' ? 'success' : 'highlight');
        const nextIcon = matched?.icon || 'bridge';
        if (window.ExtensionRegistry?.setDynamicLayoutSlots) {
            window.ExtensionRegistry.setDynamicLayoutSlots(
                'bridge',
                BRIDGE_BASE_LAYOUT_SLOTS.map((slot, idx) => idx === 0 ? { ...slot, icon: nextIcon, intent: nextIntent } : { ...slot })
            );
        }
    },
    toggleDrawer: () => {
        BridgeStore.setState(s => ({
            drawerOpen: !s.drawerOpen,
            drawerCollapsedDesktop: !s.drawerCollapsedDesktop
        }));
    },
    parseAndAppendCells: (text) => {
        const val = (text || '').replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
        const lines = val.split('\n');
        const newCells = [];
        let cellIdx = 0;

        let currentFile = null;
        let pendingCellId = null;
        let isInsideChunk = false;
        let chunkLines = [];
        let fileRawLines = [];
        let foundChunksInFile = false;

        const flushFileFallback = () => {
            if (currentFile && !foundChunksInFile && fileRawLines.length > 0) {
                const content = fileRawLines.join('\n').trim();
                if (content) newCells.push({ id: pendingCellId || `cell_${Date.now()}_${cellIdx++}`, file: currentFile, content, active: true });
                pendingCellId = null;
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (line.startsWith('<<<<<<< FILE:')) {
                flushFileFallback();
                const rawTarget = line.substring(13).trim();
                currentFile = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawTarget) : (rawTarget.includes('://') ? rawTarget : `vfs://${rawTarget.replace(/^\/+/, '')}`);
                pendingCellId = null;
                isInsideChunk = false;
                chunkLines = [];
                fileRawLines = [];
                foundChunksInFile = false;
                continue;
            }
            if (trimmed.startsWith('<<<<<<< ID:') && !isInsideChunk) {
                pendingCellId = trimmed.substring(11).trim() || null;
                continue;
            }
            if (currentFile && !isInsideChunk) {
                fileRawLines.push(line);
            }
            if (
                trimmed === '<<<<<<< COMMENT' ||
                trimmed === '<<<<<<< SEARCH' ||
                trimmed === '<<<<<<< SEARCH REGEX' ||
                trimmed === '<<<<<<< TEXTEDIT' ||
                trimmed === '<<<<<<< JSON_PATCH' ||
                trimmed === '<<<<<<< RELOCATE' ||
                trimmed === '<<<<<<< RENAME' ||
                trimmed === '<<<<<<< MOVE_FILE' ||
                trimmed === '<<<<<<< ARCHIVE_FILE' ||
                trimmed === '<<<<<<< DELETE_FILE'
            ) {
                if (!isInsideChunk) {
                    isInsideChunk = true;
                    chunkLines = [line];
                } else {
                    chunkLines.push(line);
                }
                continue;
            }

            if (isInsideChunk) {
                let isReplace = false;
                let isExecute = false;
                if (trimmed === '>>>>>>> REPLACE') {
                    isReplace = true;
                } else if (trimmed === '>>>>>>> EXECUTE') {
                    isExecute = true;
                } else if (trimmed.endsWith('REPLACE')) {
                    const prefix = trimmed.slice(0, -7).replace(/\s+/g, '');
                    if (prefix.length > 0 && prefix.split('').every(c => c === '>')) {
                        isReplace = true;
                    }
                } else if (trimmed.endsWith('EXECUTE')) {
                    const prefix = trimmed.slice(0, -7).replace(/\s+/g, '');
                    if (prefix.length > 0 && prefix.split('').every(c => c === '>')) {
                        isExecute = true;
                    }
                }

                if (isReplace || isExecute) {
                    chunkLines.push(isExecute ? '>>>>>>> EXECUTE' : '>>>>>>> REPLACE');
                    const chunkText = chunkLines.join('\n');
                    let resolvedFile = currentFile;
                    if (isExecute && !resolvedFile) {
                        const fromMatch = chunkText.match(/^\s*FROM:\s*(.+)$/im);
                        const fileMatch = chunkText.match(/^\s*FILE:\s*(.+)$/im);
                        const scopeMatch = chunkText.match(/^\s*SCOPE:\s*(.+)$/im);
                        const rawTarget = (fromMatch ? fromMatch[1] : (fileMatch ? fileMatch[1] : (scopeMatch ? scopeMatch[1] : 'vfs://'))).trim();
                        resolvedFile = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawTarget) : rawTarget;
                    }
                    if (resolvedFile) {
                        newCells.push({ id: pendingCellId || `cell_${Date.now()}_${cellIdx++}`, file: resolvedFile, content: chunkText, active: true });
                        pendingCellId = null;
                        foundChunksInFile = true;
                    }
                    isInsideChunk = false;
                    chunkLines = [];
                } else {
                    chunkLines.push(line);
                }
            }
        }

        if (isInsideChunk && currentFile) {
            newCells.push({ id: pendingCellId || `cell_${Date.now()}_${cellIdx++}`, file: currentFile, content: chunkLines.join('\n') + '\n>>>>>>> REPLACE', active: true });
            pendingCellId = null;
            foundChunksInFile = true;
        }
        flushFileFallback();
        if (newCells.length > 0) {
            BridgeStore.setState(state => {
                const existingCells = state.cells || [];
                const telPatches = state.telemetry?.patches || [];
                const failedCellIds = new Set(
                    telPatches
                        .filter(p => p.cell_id && p.status !== 'resolved' && p.status !== 'auto_skipped')
                        .map(p => p.cell_id)
                );
                const incomingFiles = new Set(newCells.map(c => c.file));

                const hasFailedInIncomingFiles = existingCells.some(
                    c => incomingFiles.has(c.file) && (!c.active || failedCellIds.has(c.id))
                );
                let mergedCells;
                if (hasFailedInIncomingFiles) {
                    const surviving = existingCells.filter(
                        c => !(incomingFiles.has(c.file) && (!c.active || failedCellIds.has(c.id)))
                    );
                    mergedCells = [...surviving, ...newCells];
                } else {
                    mergedCells = [...existingCells, ...newCells];
                }
                return {
                    cells: mergedCells,
                    viewMode: 'input',
                    activeSurface: 'bridge',
                    drawerOpen: false
                };
            });
            BridgeStore.getState().setActiveSurface('bridge');
        }
    },
    recomputeOptimisticTelemetry: () => {
        const state = BridgeStore.getState();
        const tel = state.telemetry;
        if (!tel || !Array.isArray(tel.patches)) return false;
        const sourcePatches = Array.isArray(tel.all_patches) ? tel.all_patches : tel.patches;
        const activeCellIds = new Set((state.cells || []).filter(c => c.active).map(c => c.id));
        const nextPatches = sourcePatches.filter(p => !p.cell_id || activeCellIds.has(p.cell_id));
        let resolved = 0;
        let autoSkipped = 0;
        let actionRequired = 0;
        let failed = 0;
        nextPatches.forEach(p => {
            if (p.status === 'resolved') resolved++;
            else if (p.status === 'auto_skipped') autoSkipped++;
            else if (p.status === 'needs_confirmation' || p.status === 'offer_deep_search' || p.status === 'syntax_error') actionRequired++;
            else failed++;
        });
        const totalPatches = nextPatches.length;
        const canCommit = totalPatches > 0 && actionRequired === 0 && failed === 0 && (resolved > 0 || autoSkipped > 0);
        BridgeStore.setState({
            viewMode: totalPatches === 0 ? 'input' : state.viewMode,
            telemetry: {
                ...tel,
                can_commit: canCommit,
                status: canCommit ? 'dry_run_evaluated' : (actionRequired > 0 ? 'action_required' : 'failed'),
                summary: {
                    total_patches: totalPatches,
                    resolved,
                    auto_skipped: autoSkipped,
                    action_required: actionRequired,
                    failed
                },
                all_patches: sourcePatches,
                patches: nextPatches
            }
        });
        return canCommit;
    },
    skipCellOptimistic: (cellId) => {
        if (!cellId) return;
        BridgeStore.setState(state => ({
            cells: (state.cells || []).map(c => c.id === cellId ? { ...c, active: false } : c)
        }));
        BridgeStore.getState().recomputeOptimisticTelemetry();
    },
    skipAllFailedCellsOptimistic: () => {
        const state = BridgeStore.getState();
        const tel = state.telemetry;
        if (!tel || !Array.isArray(tel.patches)) return;
        const failedIds = new Set(tel.patches.filter(p => p.status !== 'resolved' && p.status !== 'auto_skipped' && p.cell_id).map(p => p.cell_id));
        if (failedIds.size === 0) return;
        const nextCells = (state.cells || []).map(c => failedIds.has(c.id) ? { ...c, active: false } : c);
        BridgeStore.setState({ cells: nextCells });
        BridgeStore.getState().recomputeOptimisticTelemetry();
    },
    snapAllDeterministicAnchors: () => {
        const state = BridgeStore.getState();
        const telPatches = state.telemetry?.patches || [];
        const anchorMap = new Map();
        telPatches.forEach(p => {
            if (p.cell_id && p.actual_anchor && p.available_actions?.includes('heal_anchor')) {
                try {
                    const decoded = new TextDecoder().decode(Uint8Array.from(atob(p.actual_anchor), c => c.charCodeAt(0)));
                    anchorMap.set(p.cell_id, decoded);
                } catch (_) {}
            }
        });
        if (anchorMap.size === 0) return 0;
        const blockRegex = /^(<<<<<<< SEARCH)[ \t]*\r?\n([\s\S]*?)^(=======)/m;
        BridgeStore.setState(s => ({
            cells: (s.cells || []).map(c => {
                if (!anchorMap.has(c.id)) return c;
                return {
                    ...c,
                    content: c.content.replace(blockRegex, `$1\n${anchorMap.get(c.id)}\n$3`)
                };
            })
        }));
        return anchorMap.size;
    },
    updateCellFile: (id, file) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.id === id ? { ...c, file } : c) }));
    },
    updateGroupFile: (oldFile, newFile) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.file === oldFile ? { ...c, file: newFile } : c) }));
    },
    toggleGroupActive: (file, isActive) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.file === file ? { ...c, active: isActive } : c) }));
    },
    removeGroup: (file) => {
        BridgeStore.setState(state => ({ cells: state.cells.filter(c => c.file !== file) }));
    },
    applyHealedCells: (healedCellsMap) => {
        if (!healedCellsMap || typeof healedCellsMap !== 'object') return 0;
        let updatedCount = 0;
        const syncVirtual = (id, file, content) => {
            const bufUri = `yomama://${id}`;
            const fullText = `<<<<<<< FILE: ${file}\n${content}`;
            if (window.inSetu?.vfs?.syncVirtualBuffer) {
                window.inSetu.vfs.syncVirtualBuffer(bufUri, fullText);
                return;
            }
            const activeBuffers = window.inSetu?.stores?.Fs?.getState()?.activeBuffers;
            if (activeBuffers && activeBuffers[bufUri]) {
                window.inSetu.stores.Fs.getState().openBuffer(bufUri, { ...activeBuffers[bufUri], content: fullText, originalContent: fullText, fullText });
            }
        };
        BridgeStore.setState(state => ({
            cells: (state.cells || []).flatMap(c => {
                const h = healedCellsMap[c.id];
                if (!h) return [c];
                updatedCount++;
                const entries = Array.isArray(h) ? h : [h];
                return entries.map((entry, idx) => {
                    const nextId = entry.id || (idx === 0 ? c.id : `${c.id}__part_${idx + 1}`);
                    const nextFile = entry.file || c.file;
                    const nextContent = entry.content ?? c.content;
                    syncVirtual(nextId, nextFile, nextContent);
                    return { ...c, id: nextId, file: nextFile, content: nextContent };
                });
            })
        }));
        return updatedCount;
    },
    updateCellContent: (id, content) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.id === id ? { ...c, content } : c) }));
    },
    toggleCellActive: (id) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.id === id ? { ...c, active: !c.active } : c) }));
        BridgeStore.getState().recomputeOptimisticTelemetry();
    },
    removeCell: (id) => {
        BridgeStore.setState(state => ({ cells: state.cells.filter(c => c.id !== id) }));
    },
    swapCell: (id) => {
        const state = BridgeStore.getState();
        const isEditingThis = state.editCellId === id;
        let textToSwap = state.cells.find(c => c.id === id)?.content;
        if (isEditingThis) {
            const buffer = window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[`yomama://${id}`];
            if (buffer) textToSwap = buffer.content;
        }
        if (!textToSwap) return;

        const blockRegex = /^(<<<<<<< SEARCH)[ \t]*\r?\n([\s\S]*?)^(=======)[ \t]*\r?\n([\s\S]*?)^(>>>>>>> REPLACE)/m;
        const match = textToSwap.match(blockRegex);

        if (match) {
            const before = textToSwap.substring(0, match.index);
            const searchBlock = match[2];
            const replaceBlock = match[4];
            const after = textToSwap.substring(match.index + match[0].length);
            const swappedChunk = `${before}<<<<<<< SEARCH\n${replaceBlock}=======\n${searchBlock}>>>>>>> REPLACE${after}`;

            if (isEditingThis) {
                window.inSetu?.stores?.Fs?.getState()?.updateBuffer(`yomama://${id}`, { content: swappedChunk });
            } else {
                BridgeStore.getState().updateCellContent(id, swappedChunk.trim());
            }
        } else {
            alert("Could not cleanly parse SEARCH/REPLACE blocks to swap. Ensure '=======' is on its own line.");
        }
    },
    clearPayload: () => {
        const curEditId = BridgeStore.getState().editCellId;
        if (curEditId) {
            window.inSetu?.stores?.Fs?.getState()?.closeBuffer(`yomama://${curEditId}`);
        }
        BridgeStore.setState({ 
            cells: [], 
            resolutions: {},
            activeBridgeJobId: null,
            viewMode: 'input',
            consoleOutput: 'Ready...',
            telemetry: null,
            editCellId: null,
            editCellOriginalFile: ''
        });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.closeWindow('bridge:edit-cell');
            layout.closeWindow('bridge:syntax-diff');
        }
    },
    setViewMode: (mode) => BridgeStore.setState({ viewMode: mode }),
    setConsoleOutput: (out) => BridgeStore.setState({ consoleOutput: out }),
    setTelemetry: (tel) => BridgeStore.setState({ telemetry: tel }),
    fetchFastTierStatus: async () => {
        try {
            const activeProfileId = window.inSetu?.stores?.Agent?.getState()?.activeProfileId || '';
            const qs = activeProfileId ? `&profile_id=${encodeURIComponent(activeProfileId)}` : '';
            const res = await window.inSetu.api.get(`llm/resolve_target?tier=fast${qs}`);
            if (res.ok) {
                const data = await res.json();
                const canAutoHeal = Boolean(data.can_auto_heal);
                BridgeStore.setState(state => {
                    const nextRepairMode = (!canAutoHeal && state.repairMode === 'ai_assisted')
                        ? 'algorithmic'
                        : (state.repairMode || 'algorithmic');
                    return {
                        repairMode: nextRepairMode,
                        autoHeal: nextRepairMode === 'ai_assisted' && canAutoHeal,
                        fastTierStatus: {
                            canAutoHeal,
                            reason: data.auto_heal_reason || (canAutoHeal ? `AI Auto-Repair ready (${data.model})` : 'Fast LLM tier is not configured for programmatic repair.'),
                            model: data.model || '',
                            endpointId: data.endpoint_id || '',
                            isWebChat: Boolean(data.is_web_chat)
                        }
                    };
                });
            }
        } catch (e) {
            console.warn("Failed to resolve fast LLM tier status", e);
        }
    },
    fetchHistory: async () => {
        try {
            const res = await window.inSetu.api.get('bridge/history');
            if (res.ok) {
                const data = await res.json();
                BridgeStore.setState({ historyRecords: data.history || [] });
            }
        } catch (e) {
            console.warn("Failed to fetch bridge history", e);
        }
    },
    getCompiledPayload: () => {
        const state = BridgeStore.getState();
        const activeCells = state.cells.filter(c => c.active);
        return activeCells.map(c => `<<<<<<< FILE: ${c.file}\n<<<<<<< ID: ${c.id}\n${c.content}`).join('\n\n');
    },
    getActiveFiles: () => {
        return Array.from(new Set(BridgeStore.getState().cells.filter(c => c.active).map(c => c.file)));
    }
}, {
    onEvict: {
        'bridge': () => {
            BridgeStore.getState().clearPayload();
            return {};
        },
        'bridge:edit-cell': (state) => {
            if (state.editCellId) {
                window.inSetu?.stores?.Fs?.getState()?.closeBuffer(`yomama://${state.editCellId}`);
            }
            return { editCellId: null, editCellOriginalFile: '' };
        }
    }
});

window.inSetu.stores.Bridge = BridgeStore;

window.addEventListener('beforeunload', (e) => {
    const state = BridgeStore.getState();
    if (state && state.cells && state.cells.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

window.addEventListener('insetu:bridge:cell-swap', (e) => {
    if (e.detail?.id) {
        BridgeStore.getState().swapCell(e.detail.id);
    }
});
