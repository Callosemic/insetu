import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';
// --- VFS BRIDGE STATE STORE (UDF LAYER) ---
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
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
const BRIDGE_GATE_UI_MAP = {
    DESTRUCTIVE_DELETE: { label: 'Confirm Delete', intent: 'danger', icon: 'trash-2' },
    OVERWRITE_EXISTING: { label: 'Confirm Overwrite', intent: 'warning', icon: 'file-warning' },
    EXPANSION_RISK: { label: 'Confirm Expansion', intent: 'warning', icon: 'maximize-2' },
    SYNTAX_ERROR: { label: 'Ignore Syntax & Commit', intent: 'danger', icon: 'alert-triangle' },
    OUT_OF_SCOPE_TARGET: { label: 'Authorize File Edit', intent: 'warning', icon: 'shield-alert' }
};

export const BridgeStore = createExtensionStore('Bridge', {
    cells: [],
    resolutions: {},
    activeSurface: 'bridge',
    autoHeal: false,
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
            window.ExtensionRegistry.setDynamicLayoutSlots('bridge', [
                {
                    slot: "slots:sub-navigation",
                    targetParent: "edit",
                    id: "bridge",
                    label: "Yomama",
                    icon: nextIcon,
                    intent: nextIntent,
                    order: 1,
                    headerActionComponent: "insetu-ext-bridge-actions",
                    component: "insetu-ext-bridge"
                },
                {
                    slot: "slots:yomama-surface",
                    id: "bridge",
                    label: "Bridge",
                    icon: "bridge",
                    intent: "highlight",
                    order: 10,
                    component: null
                },
                {
                    slot: "slots:yomama-surface",
                    id: "receipts",
                    label: "Receipts",
                    icon: "history",
                    intent: "success",
                    order: 40,
                    component: "insetu-ext-bridge-history"
                }
            ]);
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
        let isInsideChunk = false;
        let chunkLines = [];
        let fileRawLines = [];
        let foundChunksInFile = false;

        const flushFileFallback = () => {
            if (currentFile && !foundChunksInFile && fileRawLines.length > 0) {
                const content = fileRawLines.join('\n').trim();
                if (content) {
                    newCells.push({ id: `cell_${Date.now()}_${cellIdx++}`, file: currentFile, content, active: true });
                }
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (line.startsWith('<<<<<<< FILE:')) {
                flushFileFallback();
                const rawTarget = line.substring(13).trim();
                currentFile = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawTarget) : (rawTarget.includes('://') ? rawTarget : `vfs://${rawTarget.replace(/^\/+/, '')}`);
                isInsideChunk = false;
                chunkLines = [];
                fileRawLines = [];
                foundChunksInFile = false;
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
                        newCells.push({
                            id: `cell_${Date.now()}_${cellIdx++}`,
                            file: resolvedFile,
                            content: chunkText,
                            active: true
                        });
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
            newCells.push({
                id: `cell_${Date.now()}_${cellIdx++}`,
                file: currentFile,
                content: chunkLines.join('\n') + '\n>>>>>>> REPLACE',
                active: true
            });
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

                // Smart Replace-on-Paste: If pasting repaired blocks for a file that currently has
                // failed or inactive cells (or while in console triage view), replace those broken cells in-place!
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
        const activeCellIds = new Set((state.cells || []).filter(c => c.active).map(c => c.id));
        const nextPatches = tel.patches.filter(p => !p.cell_id || activeCellIds.has(p.cell_id));
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
        const telPatches = state.telemetry?.patches || [];
        const failedIds = new Set(
            telPatches
                .filter(p => p.cell_id && p.status !== 'resolved' && p.status !== 'auto_skipped')
                .map(p => p.cell_id)
        );
        if (failedIds.size === 0) return;
        BridgeStore.setState(s => ({
            cells: (s.cells || []).map(c => failedIds.has(c.id) ? { ...c, active: false } : c)
        }));
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
    updateCellContent: (id, content) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.id === id ? { ...c, content } : c) }));
    },
    toggleCellActive: (id) => {
        BridgeStore.setState(state => ({ cells: state.cells.map(c => c.id === id ? { ...c, active: !c.active } : c) }));
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
        // Inject the deterministic cell ID into the raw payload for the backend parser
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
export class InSetuExtBridge extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        cells: { type: Array },
        activeSurface: { type: String },
        autoHeal: { type: Boolean },
        drawerOpen: { type: Boolean },
        drawerCollapsedDesktop: { type: Boolean },
        consoleOutput: { type: String },
        viewMode: { type: String },
        telemetry: { type: Object },
        _fileVerificationCache: { type: Object },
        _autoSwaps: { type: Object }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.cells = [];
        this.activeSurface = 'bridge';
        this.autoHeal = false;
        this.drawerOpen = false;
        this.drawerCollapsedDesktop = false;
        this.consoleOutput = 'Ready...';
        this.viewMode = 'input';
        this._fileVerificationCache = {};
        this._autoSwaps = {};
        this._rejectedAutoSwaps = new Set();
    }

    _getRegisteredSurfaces() {
        const slots = window.ExtensionRegistry?.getLayoutSlots?.() || [];
        return slots
            .filter(s => s.slot === 'slots:yomama-surface')
            .sort((a, b) => (a.order || 99) - (b.order || 99));
    }

    _getRegisteredDrawerWidgets() {
        const slots = window.ExtensionRegistry?.getLayoutSlots?.() || [];
        return slots
            .filter(s => s.slot === 'slots:yomama-drawer')
            .sort((a, b) => (a.order || 99) - (b.order || 99));
    }

    _evaluateAutoSwaps() {
        if (!this.vfs || !this.vfs.getGlobalManifest) return;
        const cells = BridgeStore.getState().cells || [];
        if (cells.length === 0) {
            this._autoSwaps = {};
            this._rejectedAutoSwaps.clear();
            return;
        }

        const mFiles = this.vfs.getGlobalManifest().filter(f => !f.endsWith('.gitkeep'));
        const files = Array.from(new Set(cells.map(c => c.file)));

        files.forEach(file => {
            const fileCells = cells.filter(c => c.file === file);
            const isAllGenesis = fileCells.length > 0 && fileCells.every(c => /<<<<<<< SEARCH\s*=======/.test(c.content));
            if (isAllGenesis) return;
            if (this._fileVerificationCache[file] === false && !this._rejectedAutoSwaps.has(file)) {
                const cleanFile = file.replace(/\s*\(\d+\)(?=\.[^.\/]+$|$)/, '').trim();
                const cleanFileLower = cleanFile.toLowerCase();
                const basename = new window.inSetu.utils.InSetuURI(cleanFile).basename.toLowerCase();

                let cands = mFiles.filter(f => f.toLowerCase().endsWith(cleanFileLower));
                if (cands.length === 0) {
                    cands = mFiles.filter(f => f.toLowerCase().endsWith('/' + basename) || f.toLowerCase() === basename);
                }
                cands = cands.filter(f => f !== file);
                if (cands.length === 1) {
                    const newPath = cands[0];
                    this._autoSwaps = { ...this._autoSwaps, [newPath]: file };
                    setTimeout(() => {
                        BridgeStore.getState().updateGroupFile(file, newPath);
                        window.inSetu.stores.Fs.getState().verifyFiles([newPath], true);
                    }, 0);
                }
            }
        });
    }
    onWorkspaceLoad(workspaceId) {
        BridgeStore.getState().clearPayload();
        BridgeStore.getState().fetchHistory();
        this.requestUpdate();
    }
    onForceRefresh() {
        BridgeStore.getState().fetchHistory();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            BridgeStore,
            state => ({
                cells: state.cells || [],
                activeSurface: state.activeSurface || 'bridge',
                autoHeal: !!state.autoHeal,
                drawerOpen: !!state.drawerOpen,
                drawerCollapsedDesktop: !!state.drawerCollapsedDesktop,
                consoleOutput: state.consoleOutput,
                viewMode: state.viewMode,
                telemetry: state.telemetry
            }),
            ({ cells, activeSurface, autoHeal, drawerOpen, drawerCollapsedDesktop, consoleOutput, viewMode, telemetry }) => {
                const cellsChanged = this.cells !== cells;
                this.cells = cells;
                this.activeSurface = activeSurface;
                this.autoHeal = autoHeal;
                this.drawerOpen = drawerOpen;
                this.drawerCollapsedDesktop = drawerCollapsedDesktop;
                this.consoleOutput = consoleOutput;
                this.viewMode = viewMode;
                this.telemetry = telemetry;
                if (cellsChanged) {
                    window.inSetu.stores.Fs?.getState()?.verifyFiles(this.cells.map(c => c.file));
                    this._evaluateAutoSwaps();
                }
            }
        );
        this.registerGlobalListener('sutram-layout-recompile', window, () => this.requestUpdate());
        this.registerGlobalListener('insetu:yomama:navigate', window, (e) => {
            const targetSurface = e.detail?.surface;
            if (targetSurface) {
                BridgeStore.getState().setActiveSurface(targetSurface);
            }
        });
        this.registerGlobalListener('insetu:yomama:toggle-drawer', window, () => {
            BridgeStore.getState().toggleDrawer();
        });
        this.registerGlobalListener('paste', window, (e) => {
            if (this.activeSurface !== 'bridge' || !this.offsetParent) return;
            const path = this.getEventPath(e);
            if (path.some(el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))) return;
            const text = e.clipboardData?.getData('text') || '';
            if (text && (
                text.includes('<<<<<<< FILE:') ||
                text.includes('<<<<<<< RELOCATE') ||
                text.includes('<<<<<<< RENAME') ||
                text.includes('<<<<<<< MOVE_FILE') ||
                text.includes('<<<<<<< ARCHIVE_FILE') ||
                text.includes('<<<<<<< DELETE_FILE')
            )) {
                e.preventDefault();
                BridgeStore.getState().parseAndAppendCells(text);
            }
        });
        this.subscribe(
            'Fs',
            state => state.fileVerificationCache || {},
            (fileVerificationCache) => {
                this._fileVerificationCache = fileVerificationCache;
                this._evaluateAutoSwaps();
            }
        );
        // Event listeners for Yomama Actions
        this.registerGlobalListener('insetu:bridge:cell-deleted', window, (e) => {
            if (BridgeStore.getState().editCellId === e.detail.id) {
                window.inSetu?.stores?.Fs?.getState()?.closeBuffer(`yomama://${e.detail.id}`);
                BridgeStore.setState({ editCellId: null, editCellOriginalFile: '' });
                if (window.Sutram?.stores?.Layout) {
                    window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                }
            }
        });

        // Listen for saves from the agnostic Editor Projection
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const mutations = e.detail?.mutations || [];
            mutations.forEach(m => {
                if (m.operation === 'save' && m.filepath && m.filepath.startsWith('yomama://')) {
                    const cellId = m.filepath.replace('yomama://', '');
                    const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[m.filepath];
                    if (buffer && buffer.content) {
                        const text = buffer.content;
                        const fileMatch = text.match(/^<<<<<<< FILE:\s*(.+)$/m);
                        const rawNewFile = fileMatch ? fileMatch[1].trim() : BridgeStore.getState().editCellOriginalFile;
                        const newFile = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawNewFile) : rawNewFile;
                        const rawContent = text.replace(/^<<<<<<< FILE:.*\n?/m, '').trim();

                        BridgeStore.getState().updateCellFile(cellId, newFile);
                        BridgeStore.getState().updateCellContent(cellId, rawContent);

                        if (window.inSetu.ui?.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus("✅ Patch chunk updated", 2000);
                        }
                    }
                }
            });
        });
        // Initial sync
        const bState = BridgeStore.getState();
        this.cells = bState.cells || [];
        this.activeSurface = bState.activeSurface || 'bridge';
        this.autoHeal = !!bState.autoHeal;
        this.drawerOpen = !!bState.drawerOpen;
        this.drawerCollapsedDesktop = !!bState.drawerCollapsedDesktop;
        this.consoleOutput = bState.consoleOutput;
        this.viewMode = bState.viewMode;
        this.telemetry = bState.telemetry;
        const fsState = window.inSetu.stores.Fs?.getState() || {};
        this._fileVerificationCache = fsState.fileVerificationCache || {};

        window.inSetu.stores.Fs?.getState()?.verifyFiles(this.cells.map(c => c.file));
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    _openEditorModal(cell) {
        BridgeStore.setState({ editCellId: cell.id, editCellOriginalFile: cell.file });
        const virtualUri = `yomama://${cell.id}`;

        // Push the chunk into the agnostic multi-buffer store
        window.inSetu.stores.Fs?.getState()?.openBuffer(virtualUri, {
            filename: virtualUri,
            content: `<<<<<<< FILE: ${cell.file}\n${cell.content}`,
            originalContent: `<<<<<<< FILE: ${cell.file}\n${cell.content}`,
            fullText: `<<<<<<< FILE: ${cell.file}\n${cell.content}`,
            isFS: false, // Prevents actual disk writes
            forceEdit: true,
            isMemoryOnly: true,
            isSupportedEditor: true,
            ext: 'js',
            codeMode: 'javascript'
        });

        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'bridge:edit-cell',
                component: 'insetu-bridge-edit-projection',
                label: `Edit Patch: ${new window.inSetu.utils.InSetuURI(cell.file).basename}`,
                icon: 'git-commit',
                intent: 'highlight',
                extName: 'bridge',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
    }
    _handleParentToggle(file) {
        const cells = BridgeStore.getState().cells || [];
        const groupCells = cells.filter(c => c.file === file);
        const selectedCount = groupCells.filter(c => c.active).length;
        const targetState = selectedCount === 0;

        const updatedCells = cells.map(c =>  
            c.file === file ? { ...c, active: targetState } : c
        );

        BridgeStore.setState({ cells: updatedCells });
    }
    _deselectAllFilePatches(file, resolvedFile = null) {
        const cells = BridgeStore.getState().cells || [];
        const updatedCells = cells.map(c => {
            const matches = c.file === file || 
                            (resolvedFile && c.file === resolvedFile) ||
                            c.file.endsWith(file) || 
                            file.endsWith(c.file);
            return matches ? { ...c, active: false } : c;
        });
        BridgeStore.setState({ cells: updatedCells });
    }
    _getSyncAction(dryRunActive, bypassSandwich = false, overridePayload = {}) {
        return async (e) => {
            this._lastDryRun = dryRunActive;
            const bState = BridgeStore.getState();
            const textVal = bState.getCompiledPayload();
            BridgeStore.setState({ viewMode: 'console', consoleOutput: "Dispatching transaction to the Bridge...", telemetry: null });
            const activeFiles = bState.getActiveFiles();
            const activeProfileId = window.inSetu?.stores?.Agent?.getState()?.activeProfileId || undefined;
            const action = this.api.bindJobAction('bridge/sync', {
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                auto_heal: Boolean(bState.autoHeal),
                profile_id: activeProfileId,
                pinned_repos: Array.from(this.ecosystem.pinnedRepos),
                resolutions: bState.resolutions || {},
                ignore_syntax: bypassSandwich,
                ...overridePayload
            }, {
                interval: 250,
                onProgress: (msg) => BridgeStore.setState({ consoleOutput: msg }),
                onComplete: (statusData) => {
                    BridgeStore.setState({ activeBridgeJobId: null });
                    if (statusData.artifact && statusData.artifact.transaction_id) {
                        // Phase C: JSON Telemetry Handling
                        const tel = statusData.artifact;
                        BridgeStore.setState({ telemetry: tel, consoleOutput: '' });
                        if (tel.healed_payload && tel.mode === 'dry_run' && tel.can_commit) {
                            BridgeStore.setState({ cells: [] });
                            BridgeStore.getState().parseAndAppendCells(tel.healed_payload);
                            BridgeStore.setState({ viewMode: 'console', telemetry: tel });
                        }

                        // State Parity: Auto-sync frontend paths with backend fuzzy resolutions
                        if (tel.patches) {
                            tel.patches.forEach(p => {
                                if (p.cell_id && p.resolved_file && p.original_file !== p.resolved_file) {
                                    BridgeStore.getState().updateCellFile(p.cell_id, p.resolved_file);
                                }
                            });
                        }
                        if (tel.can_commit && tel.mode === 'live') {
                            const curEditId = BridgeStore.getState().editCellId;
                            if (curEditId) {
                                window.inSetu?.stores?.Fs?.getState()?.closeBuffer(`yomama://${curEditId}`);
                            }
                            // Retain console view and telemetry to show the success receipt, but clear the staging cells
                            BridgeStore.setState({ cells: [], resolutions: {}, editCellId: null, editCellOriginalFile: '' });
                            if (window.Sutram?.stores?.Layout) {
                                const layout = window.Sutram.stores.Layout.getState();
                                layout.closeWindow('bridge:edit-cell');
                                layout.closeWindow('bridge:syntax-diff');
                            }

                            // The backend Event Bus natively handles RAG compilation and diffs via the Topology Slew Limiter.
                            // We only need to refresh the ledger UI history locally.
                            BridgeStore.getState().fetchHistory();
                        }
                    } else {
                        BridgeStore.setState({ consoleOutput: statusData.message || "Unknown error" });
                    }
                },
                onError: (err) => {
                    BridgeStore.setState({ activeBridgeJobId: null, consoleOutput: `[!] ${err.message}` });
                }
            });
            try {
                await action(e);
            } catch (err) {
                BridgeStore.setState({ activeBridgeJobId: null, consoleOutput: `[!] ${err.message}` });
            }
        };
    }
    async _copyWebChatRepairPrompt(targetFileFilter = null) {
        const bState = BridgeStore.getState();
        const tel = bState.telemetry;
        if (!tel || !Array.isArray(tel.patches)) return;
        const failedPatches = tel.patches.filter(p => {
            const isFailed = p.status !== 'resolved' && p.status !== 'auto_skipped';
            if (!isFailed) return false;
            if (!targetFileFilter) return true;
            return (p.resolved_file === targetFileFilter || p.original_file === targetFileFilter);
        });
        if (failedPatches.length === 0) return;

        const cellsById = new Map((bState.cells || []).map(c => [c.id, c]));
        const postBuffers = tel.post_valid_buffers || {};
        const filesNeeded = Array.from(new Set(failedPatches.map(p => p.resolved_file || p.original_file).filter(Boolean)));
        const bufferSections = [];

        for (const fp of filesNeeded) {
            let fileText = postBuffers[fp];
            if (fileText === undefined) {
                try {
                    const res = await this.api.get(`fs/fetch?file=${encodeURIComponent(fp)}`);
                    if (res.ok) fileText = await res.text();
                } catch (_) {}
            }
            if (fileText !== undefined) {
                bufferSections.push(`=== CURRENT FILE STATE (AFTER APPLYING VALID PATCHES): ${fp} ===\n${fileText}`);
            }
        }

        const failedBlocksText = failedPatches.map(p => {
            const cell = cellsById.get(p.cell_id);
            const fp = p.resolved_file || p.original_file || cell?.file || 'vfs://';
            const errNote = p.error_message ? `# Diagnostic: ${p.error_message}` : '';
            const rawChunk = cell ? cell.content : '';
            return `${errNote}\n<<<<<<< FILE: ${fp}\n${rawChunk}`.trim();
        }).join('\n\n');

        const promptText = [
            "All other patches in the batch applied cleanly. The following Yomama patch block(s) failed to anchor or had a syntax error against the updated file buffer(s):",
            "",
            failedBlocksText,
            "",
            ...bufferSections,
            "",
            "Please output ONLY the repaired Yomama patch block(s) (`<<<<<<< FILE:` / `<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE`) matching the exact lines in the file state above."
        ].join('\n');

        await this.utils.copyRawText(promptText, "📋 Copied Web-Chat Repair Prompt!");
    }

    async _commitCleanFilesOnly() {
        const bState = BridgeStore.getState();
        const tel = bState.telemetry;
        if (!tel || !Array.isArray(tel.patches)) return;

        const patchesByFile = {};
        tel.patches.forEach(p => {
            const fp = p.resolved_file || p.original_file;
            if (!fp) return;
            if (!patchesByFile[fp]) patchesByFile[fp] = [];
            patchesByFile[fp].push(p);
        });

        const cleanFiles = new Set(
            Object.entries(patchesByFile)
                .filter(([, list]) => list.some(p => p.status === 'resolved') && list.every(p => p.status === 'resolved' || p.status === 'auto_skipped'))
                .map(([fp]) => fp)
        );
        if (cleanFiles.size === 0) return;

        const cleanCellIds = new Set(
            tel.patches
                .filter(p => cleanFiles.has(p.resolved_file || p.original_file) && p.cell_id)
                .map(p => p.cell_id)
        );
        const cleanCells = (bState.cells || []).filter(c => c.active && (cleanCellIds.has(c.id) || cleanFiles.has(c.file)));
        if (cleanCells.length === 0) return;

        const compiledCleanText = cleanCells.map(c => `<<<<<<< FILE: ${c.file}\n<<<<<<< ID: ${c.id}\n${c.content}`).join('\n\n');
        const activeProfileId = window.inSetu?.stores?.Agent?.getState()?.activeProfileId || undefined;

        const runCleanCommit = this.api.bindJobAction('bridge/sync', {
            text: compiledCleanText,
            active_files: Array.from(cleanFiles),
            dry_run: false,
            auto_heal: false,
            profile_id: activeProfileId,
            pinned_repos: Array.from(this.ecosystem.pinnedRepos),
            resolutions: bState.resolutions || {}
        }, {
            interval: 200,
            onProgress: (msg) => BridgeStore.setState({ consoleOutput: msg }),
            onComplete: (statusData) => {
                const resTel = statusData?.artifact;
                if (resTel && resTel.can_commit && resTel.mode === 'live') {
                    const committedCellIdSet = new Set(cleanCells.map(c => c.id));
                    BridgeStore.setState(s => ({
                        cells: (s.cells || []).filter(c => !committedCellIdSet.has(c.id))
                    }));
                    BridgeStore.getState().recomputeOptimisticTelemetry();
                    BridgeStore.getState().fetchHistory();
                    this.setStatus(`✅ Committed ${cleanFiles.size} clean file(s). Remaining failed patches kept in staging.`, 3000);
                }
            }
        });
        await runCleanCommit();
    }

    _handleConsoleClick(e) {
        const path = this.getEventPath(e);
        const btn = path.find(el => el && el.dataset && el.dataset.action);
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'approve-gate') {
            const cellId = btn.dataset.cellId || btn.dataset.old;
            const gateCode = btn.dataset.gate || '*';
            const targetUri = btn.dataset.target || btn.dataset.old;
            BridgeStore.getState().setResolution(cellId, { approved_gate: gateCode, selected_uri: targetUri });
            if (btn.dataset.old) {
                BridgeStore.getState().setResolution(btn.dataset.old, { approved_gate: gateCode, selected_uri: targetUri });
            }
            // Always verify in dry-run mode on triage clicks so the user never triggers an accidental live commit
            this._getSyncAction(true)();
        } else if (action === 'update-path' || action === 'confirm-candidate') {
            const oldPath = btn.dataset.old;
            const newPath = btn.dataset.new;
            const cellId = btn.dataset.cellId;
            const gateCode = btn.dataset.gate || '*';
            const cells = BridgeStore.getState().cells;

            if (cellId) {
                const targetCell = cells.find(c => c.id === cellId);
                if (targetCell && oldPath !== newPath) {
                    BridgeStore.getState().updateCellFile(targetCell.id, newPath);
                }
                BridgeStore.getState().setResolution(cellId, { selected_uri: newPath, approved_gate: gateCode });
            } else {
                const target = cells.find(c => c.file === oldPath || c.file.endsWith(oldPath) || oldPath.endsWith(c.file));
                if (target && oldPath !== newPath) BridgeStore.getState().updateGroupFile(target.file, newPath);
            }
            if (oldPath) {
                BridgeStore.getState().setResolution(oldPath, { selected_uri: newPath, approved_gate: gateCode });
            }
            this._getSyncAction(true)();
        } else if (action === 'view-syntax-error') {
            const errText = btn.dataset.err || 'Syntax error detected.';
            const fileTarget = btn.dataset.file || 'file';
            if (window.Sutram?.stores?.Layout) {
                const layout = window.Sutram.stores.Layout.getState();
                layout.openWindow({
                    id: 'bridge:syntax-diff',
                    component: 'sutram-report-projection',
                    label: `Syntax Error: ${fileTarget.split('/').pop()}`,
                    icon: 'alert-triangle',
                    intent: 'danger',
                    extName: 'bridge',
                    windowOnly: true,
                    props: {
                        caption: `AST / compiler syntax validation failed for ${fileTarget}.`,
                        content: errText,
                        suggestedFilename: `syntax_error_${Date.now()}.txt`,
                        actions: [
                            { label: 'Close', icon: 'x', intent: 'neutral', onClick: () => layout.closeWindow('bridge:syntax-diff') }
                        ]
                    }
                }, layout.focusedColumn || 'center', 1);
            }
        } else if (action === 'view-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            if (window.Sutram?.stores?.Layout) {
                const layout = window.Sutram.stores.Layout.getState();
                layout.openWindow({
                    id: 'bridge:syntax-diff',
                    component: 'insetu-bridge-diff-projection',
                    label: 'Patch Diff Inspector',
                    icon: 'alert-triangle',
                    intent: 'danger',
                    extName: 'bridge',
                    windowOnly: true,
                    props: {
                        caption: 'Synchronized comparison between existing disk state and proposed patch block.',
                        diffContent: decodedDiff,
                        suggestedFilename: `syntax_error_${Date.now()}.diff`
                    }
                }, layout.focusedColumn || 'center', 1);
            }
        } else if (action === 'copy-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            this.utils.copyRawText(decodedDiff);
        } else if (action === 'copy-state') {
            this.vfs.fetchAndCopy(btn.dataset.file);
        } else if (action === 'download-state') {
            this.vfs.fetchAndDownloadState(btn.dataset.file);
        } else if (action === 'force-sync' || action === 'ignore-syntax') {
            const isDryRun = btn.dataset.dryrun === 'true';
            this._getSyncAction(isDryRun, true)();
        } else if (action === 'heal-anchor') {
            const cellId = btn.dataset.cellId;
            const actualAnchor = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.anchor), c => c.charCodeAt(0)));

            const cells = BridgeStore.getState().cells || [];
            const targetCell = cells.find(c => c.id === cellId);
            if (targetCell) {
                const blockRegex = /^(<<<<<<< SEARCH)[ \t]*\r?\n([\s\S]*?)^(=======)/m;
                const newContent = targetCell.content.replace(blockRegex, "$1\n" + actualAnchor + "\n$3");
                BridgeStore.getState().updateCellContent(targetCell.id, newContent);
                this._getSyncAction(true)();
            }
        } else if (action === 'snap-all-anchors') {
            const count = BridgeStore.getState().snapAllDeterministicAnchors();
            if (count > 0) {
                this._getSyncAction(true)();
            }
        } else if (action === 'deselect-this-patch') {
            const cellId = btn.dataset.cellId;
            // Optimistic 0ms local skip without a network round-trip!
            BridgeStore.getState().skipCellOptimistic(cellId);
        } else if (action === 'skip-all-failed') {
            BridgeStore.getState().skipAllFailedCellsOptimistic();
        } else if (action === 'deselect-all-file-patches' || action === 'deselect-patch') {
            const oldPath = btn.dataset.old;
            const resolvedPath = btn.dataset.resolved;
            this._deselectAllFilePatches(oldPath, resolvedPath);
            BridgeStore.getState().recomputeOptimisticTelemetry();
        } else if (action === 'deep-search') {
            const cellId = btn.dataset.cellId || btn.dataset.old;
            if (cellId) {
                BridgeStore.getState().setResolution(cellId, { allow_deep_search: true });
            }
            this._getSyncAction(true, false, { allow_deep_search: true })();
        } else if (action === 'ai-repair-cell') {
            const cellId = btn.dataset.cellId;
            this._getSyncAction(true, false, { auto_heal: true, target_cell_id: cellId })();
        } else if (action === 'ai-heal-sync' || action === 'ai-repair-all') {
            this._getSyncAction(true, false, { auto_heal: true })();
        } else if (action === 'copy-repair-prompt') {
            const targetFile = btn.dataset.file || null;
            this._copyWebChatRepairPrompt(targetFile);
        } else if (action === 'commit-clean-files') {
            this._commitCleanFilesOnly();
        }
    }
    _renderTelemetry() {
        const t = this.telemetry;
        const isErrorOutput = typeof this.consoleOutput === 'string' && this.consoleOutput.startsWith('[!]');
        if (!t) {
            return html`
                <sutram-label
                    id="status-box"
                    ?monospace=${true}
                    ?multiline=${true}
                    intent=${isErrorOutput ? 'danger' : 'neutral'}
                    .text=${this.consoleOutput}>
                </sutram-label>
            `;
        }

        const safePatches = t.patches || [];
        const groupedPatches = safePatches.reduce((acc, p) => {
            const file = p.resolved_file || p.original_file || 'Unknown File';
            if (!acc[file]) acc[file] = [];
            acc[file].push(p);
            return acc;
        }, {});
        const fileEntries = Object.entries(groupedPatches);
        const batchHasAnyErrors = safePatches.some(p => p.status !== 'resolved' && p.status !== 'auto_skipped');
        const unresolvedCount = safePatches.filter(p => p.status !== 'resolved' && p.status !== 'auto_skipped').length;
        const snapableCount = safePatches.filter(p => p.available_actions?.includes('heal_anchor') && p.actual_anchor).length;
        const aiRepairableCount = safePatches.filter(p => (p.status === 'needs_confirmation' || p.status === 'failed' || p.status === 'syntax_error') && !p.gate).length;
        const cleanFileCount = fileEntries.filter(([, list]) => list.some(p => p.status === 'resolved') && list.every(p => p.status === 'resolved' || p.status === 'auto_skipped')).length;
        const cellsById = new Map((this.cells || []).map(c => [c.id, c]));

        return html`
            <sutram-stack direction="col" gap="md">
                <sutram-stack direction="col" gap="xs">
                    <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                        <sutram-icon name=${t.can_commit ? "check-circle-2" : "alert-triangle"} size="lg" intent=${t.can_commit ? "success" : "warning"}></sutram-icon>
                        <h3>${t.can_commit ? (t.mode === 'live' ? 'Transaction Committed' : 'Verified — Ready to Commit') : 'Action Required'}</h3>
                        ${t.healed_attempts ? html`<sutram-tag text="✨ AI Auto-Repaired (${t.healed_attempts} pass${t.healed_attempts > 1 ? 'es' : ''})" intent="highlight"></sutram-tag>` : ''}
                    </sutram-stack>
                    <sutram-label .text=${`Total: ${t.summary?.total_patches ?? 0} • Resolved: ${t.summary?.resolved ?? 0} • Skipped: ${t.summary?.auto_skipped ?? 0} • Confirm: ${t.summary?.action_required ?? 0} • Failed: ${t.summary?.failed ?? 0}`}></sutram-label>
                    ${t.heal_error ? html`<sutram-label intent="warning" .text=${`⚠️ AI Auto-Repair Error: ${t.heal_error}`}></sutram-label>` : ''}
                    ${(t.pending_protected_changes || []).length > 0 ? html`
                        <sutram-label intent="warning" .text=${`🛡️ Not written yet: ${t.pending_protected_changes.map(c => c.filepath).join(', ')}. Protected files wait for your confirmation (Review Changes in the banner).`}></sutram-label>
                    ` : ''}
                </sutram-stack>

                ${batchHasAnyErrors && t.mode !== 'live' ? html`
                    <sutram-surface variant="tinted" intent="warning" padding="sm" gap="xs">
                        <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                            <strong>Batch Triage (${unresolvedCount} unresolved)</strong>
                            <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                ${snapableCount > 0 ? html`
                                    <sutram-btn ?compact=${true} data-action="snap-all-anchors" icon="check" intent="success" label="Snap All Closest Anchors (${snapableCount})"></sutram-btn>
                                ` : ''}
                                ${aiRepairableCount > 0 ? html`
                                    <sutram-btn ?compact=${true} data-action="ai-repair-all" icon="sparkles" intent="highlight" label="AI Repair All Failed (${aiRepairableCount})"></sutram-btn>
                                ` : ''}
                                <sutram-btn ?compact=${true} data-action="copy-repair-prompt" icon="clipboard" intent="primary" label="Copy Repair Prompt"></sutram-btn>
                                <sutram-btn ?compact=${true} data-action="skip-all-failed" icon="skip-forward" intent="neutral" label="Skip All Failed (${unresolvedCount})"></sutram-btn>
                                ${cleanFileCount > 0 ? html`
                                    <sutram-btn ?compact=${true} data-action="commit-clean-files" icon="zap" intent="success" label="Commit ${cleanFileCount} Clean File${cleanFileCount !== 1 ? 's' : ''} Now"></sutram-btn>
                                ` : ''}
                            </sutram-stack>
                        </sutram-stack>
                    </sutram-surface>
                ` : ''}

                <sutram-stack direction="col" gap="md">
                    ${(() => {
                        if (safePatches.length === 0) {
                            return html`
                                <sutram-surface variant="panel" padding="md">
                                    ${t.message
                                        ? html`<sutram-label intent="danger" ?multiline=${true} .text=${`[Backend Error] ${t.message}`}></sutram-label>`
                                        : html`<sutram-label text="No patch data available for this transaction."></sutram-label>`}
                                </sutram-surface>
                            `;
                        }

                        return fileEntries.map(([file, filePatches]) => {
                            const hasError = filePatches.some(p => p.status === 'failed' || p.status === 'syntax_error');
                            const hasWarning = filePatches.some(p => p.status === 'needs_confirmation' || p.status === 'offer_deep_search');
                            const isSkipped = filePatches.every(p => p.status === 'auto_skipped');
                            const resolvedInFile = filePatches.filter(p => p.status === 'resolved').length;
                            const failedInFile = filePatches.filter(p => p.status !== 'resolved' && p.status !== 'auto_skipped').length;
                            let cardIntent = 'primary';
                            let icon = 'file-code-2';
                            if (hasError || hasWarning) { cardIntent = 'highlight'; icon = 'file-warning'; }
                            else if (isSkipped) { cardIntent = 'neutral'; icon = 'skip-forward'; }

                            const shouldAutoExpand = hasError || hasWarning || !batchHasAnyErrors;
                            const statusSummaryText = failedInFile > 0
                                ? `${resolvedInFile} Resolved • ${failedInFile} Action Required`
                                : `${filePatches.length} Patch${filePatches.length !== 1 ? 'es' : ''} Resolved`;

                            return html`
                                <sutram-card-group ?stacked=${true} ?accordion=${true} .expanded=${shouldAutoExpand}>
                                    <sutram-card 
                                        .titleText=${file} 
                                        .icon=${icon}
                                        .detailText=${statusSummaryText} 
                                        .intent=${cardIntent}
                                        entityType="file"
                                        .entityData=${{ id: file, filepath: file, titleText: file, isFS: true, suppress: ['file-browse'] }}>
                                        ${failedInFile > 0 ? html`
                                            <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                                <sutram-btn ?compact=${true} data-action="copy-repair-prompt" data-file="${file}" icon="clipboard" intent="primary" label="Copy Repair Prompt"></sutram-btn>
                                                <sutram-btn ?compact=${true} data-action="deselect-all-file-patches" data-old="${filePatches[0]?.original_file || file}" data-resolved="${file}" icon="skip-forward" intent="neutral" label="Skip File"></sutram-btn>
                                            </sutram-stack>
                                        ` : ''}
                                    </sutram-card>

                                    ${filePatches.map((p, idxInFile) => {
                                        const cellObj = (p.cell_id && cellsById.get(p.cell_id)) || { id: p.cell_id || `patch_${p.patch_index}`, file, content: '', active: true };
                                        const statusIntent = (p.status === 'failed' || p.status === 'syntax_error')
                                            ? 'danger'
                                            : ((p.status === 'needs_confirmation' || p.status === 'offer_deep_search' || p.status === 'auto_skipped') ? 'warning' : 'success');
                                        const resolveFlagLabel = (flagStr) => {
                                            if (flagStr === 'rebased_overlap') return 'Rebased Overlap';
                                            if (flagStr === 'already_applied') return 'Already Applied';
                                            if (flagStr === 'protected_needs_confirmation') return 'Protected: Waits for Your Confirmation';
                                            return String(flagStr || '').replace(/_/g, ' ');
                                        };
                                        const resolveFlagIntent = (flagStr) => {
                                            const f = String(flagStr || '').toLowerCase();
                                            if (f.includes('syntax') || f.includes('error') || f.includes('delete') || f.includes('destructive')) return 'danger';
                                            if (f.startsWith('protected') || f.includes('removal') || f.includes('warn') || f.includes('expansion') || f.includes('overwrite') || f.includes('skip')) return 'warning';
                                            if (f.includes('heal') || f.includes('rebased') || f.includes('create') || f.includes('genesis')) return 'success';
                                            return 'primary';
                                        };
                                        return html`
                                            <sutram-card
                                                .titleText=${`Patch #${(p.patch_index || 0) + 1} (${idxInFile + 1} of ${filePatches.length}): ${(p.status || 'unknown').replace(/_/g, ' ')}`}
                                                .icon=${statusIntent === 'success' ? 'check' : (statusIntent === 'danger' ? 'alert-octagon' : 'alert-triangle')}
                                                .intent=${statusIntent}
                                                ?disableSelection=${true}
                                                entityType="yomama"
                                                .entityData=${cellObj}
                                                @card-clicked=${(e) => {
                                                    const origEv = e.detail?.originalEvent;
                                                    if (origEv && this.getEventPath(origEv).some(el => el?.dataset?.action)) return;
                                                    if (p.cell_id && cellsById.has(p.cell_id)) {
                                                        this._openEditorModal(cellsById.get(p.cell_id));
                                                    }
                                                }}>
                                                ${p.flags && p.flags.length > 0 ? html`
                                                    <sutram-stack slot="header-actions" direction="row" align="center" gap="xs" ?wrap=${true}>
                                                        ${p.flags.map(flag => html`
                                                            <sutram-tag .text=${resolveFlagLabel(flag)} .intent=${resolveFlagIntent(flag)}></sutram-tag>
                                                        `)}
                                                    </sutram-stack>
                                                ` : ''}

                                                <sutram-stack direction="col" gap="xs">
                                                    ${p.error_message ? html`<sutram-label ?monospace=${true} ?multiline=${true} intent=${p.status === 'auto_skipped' ? 'warning' : 'danger'} .text=${p.error_message}></sutram-label>` : ''}
                                                    ${p.syntax_error && p.status !== 'syntax_error' ? html`
                                                        <sutram-stack direction="row" gap="sm">
                                                            <sutram-btn ?compact=${true} data-action="view-diff" data-b64="${p.syntax_error}" intent="danger" icon="git-compare" label="${p.resolution_type === 'anchor_failed' ? 'Inspect Anchor Mismatch Diff' : 'Inspect Failed Anchor Diff'}"></sutram-btn>
                                                        </sutram-stack>
                                                    ` : (p.status === 'syntax_error' ? html`
                                                        <sutram-stack direction="row" gap="sm">
                                                            <sutram-btn ?compact=${true} data-action="view-syntax-error" data-err="${p.error_message || 'Syntax error'}" data-file="${file}" intent="danger" icon="file-text" label="View Syntax Error"></sutram-btn>
                                                            ${p.syntax_error ? html`
                                                                <sutram-btn ?compact=${true} data-action="view-diff" data-b64="${p.syntax_error}" intent="warning" icon="git-compare" label="Inspect Syntax Diff"></sutram-btn>
                                                            ` : ''}
                                                        </sutram-stack>
                                                    ` : '')}
                                                    ${p.gate ? (() => {
                                                        const gateUi = BRIDGE_GATE_UI_MAP[p.gate.code] || { label: 'Confirm Action', intent: 'warning', icon: 'check' };
                                                        return html`
                                                            <sutram-surface variant="inset" padding="xs">
                                                                <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                                                    <code>${p.gate.target_uri || p.original_file}</code>
                                                                    <sutram-btn
                                                                        ?compact=${true}
                                                                        data-action="approve-gate"
                                                                        data-gate="${p.gate.code}"
                                                                        data-old="${p.original_file}"
                                                                        data-target="${p.gate.target_uri || p.original_file}"
                                                                        data-cell-id="${p.cell_id || ''}"
                                                                        intent="${gateUi.intent}"
                                                                        icon="${gateUi.icon}"
                                                                        label="${gateUi.label}">
                                                                    </sutram-btn>
                                                                </sutram-stack>
                                                            </sutram-surface>
                                                        `;
                                                    })() : ''}
                                                    ${p.candidates && p.candidates.length > 0 && !p.gate ? html`
                                                        <sutram-stack direction="col" gap="xs">
                                                            ${p.candidates.map(c => html`
                                                                <sutram-surface variant="inset" padding="xs">
                                                                    <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                                                        <code>${c.filepath}${c.score ? ` (Score: ${c.score})` : ''}</code>
                                                                        <sutram-btn ?compact=${true} data-action="confirm-candidate" data-old="${p.original_file}" data-new="${c.filepath}" data-cell-id="${p.cell_id || ''}" intent="primary" icon="check" label="Use This File"></sutram-btn>
                                                                    </sutram-stack>
                                                                </sutram-surface>
                                                            `)}
                                                        </sutram-stack>
                                                    ` : ''}
                                                    <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                                                        ${p.available_actions?.includes('offer_deep_search') ? html`
                                                            <sutram-btn ?compact=${true} data-action="deep-search" data-old="${p.original_file}" data-cell-id="${p.cell_id || ''}" intent="highlight" label="Run Deep Search"></sutram-btn>
                                                        ` : ''}
                                                        ${p.available_actions?.includes('heal_anchor') ? html`
                                                            <sutram-btn ?compact=${true} data-action="heal-anchor" data-old="${p.original_file}" data-cell-id="${p.cell_id || ''}" data-anchor="${p.actual_anchor}" intent="success" icon="check" label="Snap Anchor to Disk"></sutram-btn>
                                                        ` : ''}
                                                        ${(p.status === 'needs_confirmation' || p.status === 'failed' || p.status === 'syntax_error') && !p.gate ? html`
                                                            <sutram-btn ?compact=${true} data-action="ai-repair-cell" data-cell-id="${p.cell_id || ''}" icon="sparkles" intent="highlight" label="AI Repair This Patch"></sutram-btn>
                                                        ` : ''}
                                                        ${p.available_actions?.includes('deselect_patch') ? html`
                                                            <sutram-btn ?compact=${true} data-action="deselect-this-patch" data-old="${p.original_file}" data-resolved="${p.resolved_file || ''}" data-cell-id="${p.cell_id}" intent="neutral" icon="skip-forward" label="Skip Patch"></sutram-btn>
                                                        ` : ''}
                                                    </sutram-stack>
                                                </sutram-stack>
                                            </sutram-card>
                                        `;
                                    })}
                                </sutram-card-group>
                            `;
                        });
                    })()}
                </sutram-stack>
            </sutram-stack>
        `;
    }
    _renderBridgeSurface(groupedCells) {
        return html`
            <sutram-view>
                ${this.viewMode === 'input' ? html`
                    ${this.cells.length === 0 ? html`
                        <sutram-surface variant="dropzone" intent="highlight"
                            @dragover=${e => e.preventDefault()}
                            @drop=${async e => {
                                e.preventDefault();
                                const text = e.dataTransfer.getData('text');
                                if (text) BridgeStore.getState().parseAndAppendCells(text);
                            }}>
                            <sutram-stack direction="col" align="center" gap="sm">
                                <sutram-icon name="bridge" size="xl" intent="highlight"></sutram-icon>
                                <h3>Yomama Sync Bridge</h3>
                                <sutram-label text="Paste a patch sandwich (Ctrl+V / Cmd+V) or click Paste below to parse individual file blocks."></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                    ` : html`
                        <sutram-stack direction="col" gap="md">
                        ${Object.entries(groupedCells).map(([file, groupCells]) => {
                            const selectedCount = groupCells.filter(c => c.active).length;
                            const totalCount = groupCells.length;
                            return html`
                                <sutram-surface variant="ghost" border="bottom" padding="sm">
                                    <sutram-card-group ?stacked=${true} ?accordion=${true}>
                                    <!-- Target File Card (Top of Stack) -->
                                    <sutram-card
                                        .titleText=${"Target File:"}
                                        .descriptionText=${this._fileVerificationCache[file] === false ? "⚠️ Target file not found in workspace." : ""}
                                        .detailText=${""}
                                        icon="file-code-2"
                                        intent=${this._fileVerificationCache[file] === false ? 'danger' : 'highlight'}
                                        entityType="file"
                                        .entityData=${{ filepath: file, isFS: true, suppress: ['file-browse'] }}
                                        selectionStoreKey="none"
                                        ?selected=${selectedCount > 0}
                                        @sutram-card-select-toggled=${(e) => { e.stopPropagation(); this._handleParentToggle(file); }}>
                                        <div slot="header-actions">
                                            <sutram-btn ?compact=${true} intent="highlight" label="Remap" @click=${(e) => {
                                                e.stopPropagation();
                                                if (this.ui && this.ui.openWorkspaceBrowser) {
                                                    this.ui.openWorkspaceBrowser({
                                                        mode: 'file',
                                                        title: 'Select File for Patch',
                                                        callback: (filepath) => {
                                                            BridgeStore.getState().updateGroupFile(file, filepath);
                                                            window.inSetu.stores.Fs.getState().verifyFiles([filepath], true);
                                                        }
                                                    });
                                                }
                                            }}></sutram-btn>
                                        </div>

                                        <sutram-stack direction="col" gap="xs">
                                            <sutram-input ?flush=${true} .value=${file} @sutram-input-changed=${(e) => {
                                                BridgeStore.getState().updateGroupFile(file, e.detail.value);
                                                window.inSetu.stores.Fs?.getState()?.verifyFiles([e.detail.value], true);
                                            }}></sutram-input>
                                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                                <sutram-label .text=${`${selectedCount} of ${totalCount} patches selected`}></sutram-label>
                                                ${this._autoSwaps[file] && this._autoSwaps[file] !== file ? html`
                                                    <sutram-stack direction="row" align="center" gap="xs">
                                                        <sutram-tag text="✨ Auto-mapped" intent="success"></sutram-tag>
                                                        <sutram-btn ?compact=${true} intent="neutral" label="Undo" @click=${(e) => {
                                                            e.stopPropagation();
                                                            const original = this._autoSwaps[file];
                                                            this._rejectedAutoSwaps.add(original);
                                                            const newSwaps = { ...this._autoSwaps };
                                                            delete newSwaps[file];
                                                            this._autoSwaps = newSwaps;
                                                            BridgeStore.getState().updateGroupFile(file, original);
                                                            window.inSetu.stores.Fs?.getState()?.verifyFiles([original], true);
                                                        }}></sutram-btn>
                                                    </sutram-stack>
                                                ` : ''}
                                            </sutram-stack>
                                        </sutram-stack>
                                        ${this._fileVerificationCache[file] === false && !this._autoSwaps[file] ? (() => {
                                            let cands = [];
                                            if (this.vfs && this.vfs.getGlobalManifest) {
                                                const mFiles = this.vfs.getGlobalManifest().filter(f => !f.endsWith('.gitkeep'));
                                                const cleanFile = file.replace(/\s*\(\d+\)(?=\.[^.\/]+$|$)/, '').trim();
                                                const cleanFileLower = cleanFile.toLowerCase();
                                                const basename = new window.inSetu.utils.InSetuURI(cleanFile).basename.toLowerCase();

                                                cands = mFiles.filter(f => f.toLowerCase().endsWith(cleanFileLower));
                                                if (cands.length === 0) {
                                                    cands = mFiles.filter(f => f.toLowerCase().endsWith('/' + basename) || f.toLowerCase() === basename);
                                                }
                                                cands = cands.filter(f => f !== file);
                                            }
                                            if (cands.length > 0) {
                                                return html`
                                                    <sutram-surface variant="ghost" border="top" padding="xs" gap="xs">
                                                        <sutram-label text="Suggested Matches:"></sutram-label>
                                                        ${cands.map(c => html`
                                                            <sutram-surface variant="inset" padding="xs">
                                                                <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                                                    <code>${c}</code>
                                                                    <sutram-btn ?compact=${true} intent="success" label="Swap" @click=${(e) => {
                                                                        e.stopPropagation();
                                                                        BridgeStore.getState().updateGroupFile(file, c);
                                                                        window.inSetu.stores.Fs?.getState()?.verifyFiles([c], true);
                                                                    }}></sutram-btn>
                                                                </sutram-stack>
                                                            </sutram-surface>
                                                        `)}
                                                    </sutram-surface>
                                                `;
                                            }
                                            return '';
                                        })() : ''}
                                    </sutram-card>
                                    <!-- Patches (Subsequent Stacked Chunks) -->
                                    ${groupCells.map((c, i) => {
                                        const isRelocate = c.content.includes('<<<<<<< RELOCATE');
                                        const isRename = c.content.includes('<<<<<<< RENAME');
                                        const isTextEdit = c.content.includes('<<<<<<< TEXTEDIT');
                                        const isJsonPatch = c.content.includes('<<<<<<< JSON_PATCH');
                                        const isMoveFile = c.content.includes('<<<<<<< MOVE_FILE');
                                        const isArchiveFile = c.content.includes('<<<<<<< ARCHIVE_FILE');
                                        const isDeleteFile = c.content.includes('<<<<<<< DELETE_FILE');
                                        const isGenesis = !isRelocate && !isRename && !isTextEdit && !isJsonPatch && !isMoveFile && !isArchiveFile && !isDeleteFile && !!c.content.match(/<<<<<<< SEARCH\s*=======/);
                                        const typeStr = isRelocate ? "Type: AST Relocate"
                                            : isRename ? "Type: AST Rename"
                                            : isTextEdit ? "Type: Inline Text Edit"
                                            : isJsonPatch ? "Type: JSON Object Patch"
                                            : isMoveFile ? "Type: Move File"
                                            : isArchiveFile ? "Type: Archive File"
                                            : isDeleteFile ? "Type: Delete File"
                                            : isGenesis ? "Type: Create File"
                                            : "Type: Search & Replace";
                                        let commentText = "";
                                        const commentMatch = c.content.match(/<<<<<<< COMMENT\r?\n([\s\S]*?)\r?\n<<<<<<< SEARCH/);
                                        if (commentMatch && commentMatch[1]) {
                                            commentText = commentMatch[1].trim();
                                        }
                                        const descStr = commentText ? `${i + 1} of ${groupCells.length} • "${commentText}"` : `${i + 1} of ${groupCells.length}`;
                                        return html`
                                        <sutram-card
                                            .titleText=${typeStr}
                                            .descriptionText=${descStr}
                                            icon="git-commit"
                                            ?selected=${c.active}
                                            intent=${c.active ? "success" : "neutral"}
                                            selectionStoreKey="none"
                                            entityType="yomama"
                                            .entityData=${c}
                                            @sutram-card-select-toggled=${(e) => BridgeStore.getState().toggleCellActive(c.id)}
                                            @card-clicked=${() => this._openEditorModal(c)}>
                                        </sutram-card>
                                    `})}
                                </sutram-card-group>
                            </sutram-surface>
                        `;})}
                        </sutram-stack>
                    `}
                ` : html`
                    <div @click=${{ handleEvent: (e) => this._handleConsoleClick(e), capture: true }}>${this._renderTelemetry()}</div>
                `}

                <sutram-surface slot="footer" variant="tinted" intent="highlight" border="top" padding="sm" gap="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-btn
                            intent="highlight"
                            icon="bridge"
                            title="Toggle Yomama Menu (Active: Bridge)"
                            @click=${() => BridgeStore.getState().toggleDrawer()}>
                        </sutram-btn>
                        ${this.cells.length > 0 && this.viewMode === 'input' ? html`
                            <sutram-btn
                                intent=${this.autoHeal ? "highlight" : "neutral"}
                                ?active=${this.autoHeal}
                                icon="sparkles"
                                label=${this.autoHeal ? "AI Auto-Repair: ON" : "AI Auto-Repair: OFF"}
                                title="Automatically repair failed anchors or syntax errors in parallel per-file using the Fast LLM tier"
                                @click=${() => BridgeStore.setState({ autoHeal: !this.autoHeal })}>
                            </sutram-btn>
                        ` : ''}
                        ${this.cells.length === 0 && this.viewMode === 'input' ? html`
                            <sutram-btn intent="highlight" icon="clipboard-paste" label="Paste from Clipboard" ?grow=${true} @click=${async () => {
                                if (!navigator.clipboard || !navigator.clipboard.readText) {
                                    alert("Clipboard API requires a secure context (HTTPS or localhost).\\n\\nPlease press Ctrl+V (or Cmd+V) anywhere on this screen to paste.");
                                    return;
                                }
                                try {
                                    const t = await navigator.clipboard.readText();
                                    BridgeStore.getState().parseAndAppendCells(t);
                                } catch(e) { 
                                    alert('Clipboard access denied.\\n\\nPlease press Ctrl+V (or Cmd+V) anywhere on this screen to paste.'); 
                                }
                            }}></sutram-btn>
                        ` : this.viewMode === 'input' ? html`
                            <sutram-btn intent="danger" icon="trash-2" label="Clear" ?grow=${true} @click=${() => { BridgeStore.getState().clearPayload(); }}></sutram-btn>
                            <sutram-async-btn icon="check-circle" label="Verify (Dry Run)" intent="warning" ?grow=${true} .onClick=${this._getSyncAction(true)}></sutram-async-btn>
                            <sutram-async-btn icon="zap" label="Commit Patches" intent="success" ?grow=${true} .onClick=${this._getSyncAction(false)}></sutram-async-btn>
                        ` : html`
                            <sutram-btn intent="neutral" icon="arrow-left" label="Back to Staging" ?grow=${true} @click=${() => { BridgeStore.setState({ viewMode: 'input' }); }}></sutram-btn>
                            ${this.telemetry && !this.telemetry.can_commit && this.telemetry.mode !== 'live' ? html`
                                <sutram-async-btn icon="refresh-cw" label="Re-Verify" intent="warning" ?grow=${true} .onClick=${this._getSyncAction(true)}></sutram-async-btn>
                            ` : ''}
                            ${this.telemetry && this.telemetry.can_commit && this.telemetry.mode !== 'live' ? html`
                                <sutram-async-btn icon="zap" label="Commit Patches" intent="success" ?grow=${true} .onClick=${this._getSyncAction(false)}></sutram-async-btn>
                            ` : ''}
                        `}
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
        `;
    }

    render() {
        const groupedCells = this.cells.reduce((acc, cell) => {
            if (!acc[cell.file]) acc[cell.file] = [];
            acc[cell.file].push(cell);
            return acc;
        }, {});
        const surfaces = this._getRegisteredSurfaces();
        const drawerWidgets = this._getRegisteredDrawerWidgets();
        const currentSurfaceId = this.activeSurface || 'bridge';
        const activeSurfaceSpec = surfaces.find(s => (s.rawId || s.id.split(':').pop()) === currentSurfaceId || s.id === currentSurfaceId);
        const activeIntent = activeSurfaceSpec?.intent || 'highlight';
        const navItems = surfaces.map(s => {
            const rawId = s.rawId || s.id.split(':').pop();
            return {
                id: rawId,
                rawId,
                label: s.label,
                icon: s.icon || 'component',
                intent: s.intent || 'highlight',
                badge: (rawId === 'bridge' && this.cells.length > 0) ? this.cells.length : null
            };
        });

        return html`
            <sutram-sidebar-layout
                .intent=${activeIntent}
                ?drawerOpen=${this.drawerOpen}
                ?collapsed=${this.drawerCollapsedDesktop}
                navTitle="Yomama Surfaces"
                .navItems=${navItems}
                .activeNavId=${currentSurfaceId}
                @sutram-drawer-closed=${() => BridgeStore.setState({ drawerOpen: false })}
                @sutram-nav-selected=${(e) => BridgeStore.getState().setActiveSurface(e.detail.id)}>
                ${drawerWidgets.map(w => html`<div slot="sidebar" style="display: contents;">${this.mountDynamicSlot(w.component)}</div>`)}
                ${currentSurfaceId === 'bridge'
                    ? this._renderBridgeSurface(groupedCells)
                    : surfaces.map(s => {
                        const rawId = s.rawId || s.id.split(':').pop();
                        if (rawId === 'bridge' || !s.component) return '';
                        const isVisible = currentSurfaceId === rawId || currentSurfaceId === s.id;
                        return html`
                            <div style="display: ${isVisible ? 'flex' : 'none'}; flex: 1; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                                <sutram-view ?flush=${true} ?noScroll=${true}>
                                    ${this.mountDynamicSlot(s.component)}
                                </sutram-view>
                            </div>
                        `;
                    })}
            </sutram-sidebar-layout>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuBridgeDiffProjection extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        caption: { type: String },
        diffContent: { type: String },
        searchStr: { type: String },
        replaceStr: { type: String },
        suggestedFilename: { type: String }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.caption = '';
        this.diffContent = '';
        this.searchStr = '';
        this.replaceStr = '';
        this.suggestedFilename = '';
    }
    render() {
        const filename = this.suggestedFilename || `diff_${Date.now()}.diff`;
        const rawPayload = this.diffContent || `<<<<<<< SEARCH\n${this.searchStr}\n=======\n${this.replaceStr}\n>>>>>>> REPLACE`;
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <sutram-surface slot="header" variant="inset" border="bottom" padding="xs">
                    <sutram-stack direction="row" justify="end" align="center">
                        <sutram-entity-actions
                            .entityType=${'text_blob'}
                            .entityData=${{ textContent: rawPayload, suggestedFilename: filename }}>
                        </sutram-entity-actions>
                    </sutram-stack>
                </sutram-surface>
                <sutram-diff-viewer
                    .diffText=${this.diffContent}
                    .searchStr=${this.searchStr}
                    .replaceStr=${this.replaceStr}
                    leftTitle="Original"
                    rightTitle="Patch">
                </sutram-diff-viewer>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-bridge-diff-projection', InSetuBridgeDiffProjection);

export class InSetuBridgeEditProjection extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        editCellId: { type: String },
        editCellOriginalFile: { type: String },
        cells: { type: Array },
        _previewDiff: { type: Boolean }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        const st = BridgeStore.getState();
        this.editCellId = st.editCellId;
        this.editCellOriginalFile = st.editCellOriginalFile || '';
        this.cells = st.cells || [];
        this._previewDiff = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            BridgeStore,
            state => ({
                editCellId: state.editCellId,
                editCellOriginalFile: state.editCellOriginalFile || '',
                cells: state.cells || []
            }),
            ({ editCellId, editCellOriginalFile, cells }) => {
                this.editCellId = editCellId;
                this.editCellOriginalFile = editCellOriginalFile;
                this.cells = cells;
            }
        );
    }
    _commitCurrentBuffer() {
        if (!this.editCellId) return;
        const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${this.editCellId}`];
        if (buffer) {
            const text = buffer.content;
            const fileMatch = text.match(/^<<<<<<< FILE:\s*(.+)$/m);
            const rawNewFile = fileMatch ? fileMatch[1].trim() : this.editCellOriginalFile;
            const newFile = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawNewFile) : rawNewFile;
            const rawContent = text.replace(/^<<<<<<< FILE:.*\n?/m, '').trim();
            BridgeStore.getState().updateCellFile(this.editCellId, newFile);
            BridgeStore.getState().updateCellContent(this.editCellId, rawContent);
        }
    }
    _navigateChunk(direction) {
        if (!this.editCellId || this.cells.length <= 1) return;
        const prevCellId = this.editCellId;
        this._commitCurrentBuffer();
        const currentIndex = this.cells.findIndex(c => c.id === prevCellId);
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= this.cells.length) return;

        const nextCell = this.cells[newIndex];
        if (prevCellId !== nextCell.id) {
            window.inSetu?.stores?.Fs?.getState()?.closeBuffer(`yomama://${prevCellId}`);
        }
        const virtualUri = `yomama://${nextCell.id}`;
        window.inSetu.stores.Fs?.getState()?.openBuffer(virtualUri, {
            filename: virtualUri,
            content: `<<<<<<< FILE: ${nextCell.file}\n${nextCell.content}`,
            originalContent: `<<<<<<< FILE: ${nextCell.file}\n${nextCell.content}`,
            fullText: `<<<<<<< FILE: ${nextCell.file}\n${nextCell.content}`,
            isFS: false,
            forceEdit: true,
            isMemoryOnly: true,
            isSupportedEditor: true,
            ext: 'js',
            codeMode: 'javascript'
        });
        BridgeStore.setState({ editCellId: nextCell.id, editCellOriginalFile: nextCell.file });
        if (window.Sutram?.stores?.Layout) {
            const layoutStore = window.Sutram.stores.Layout;
            const nextLabel = `Edit Patch: ${new window.inSetu.utils.InSetuURI(nextCell.file).basename}`;
            layoutStore.setState(s => ({
                windows: (s.windows || []).map(w => w.id === 'bridge:edit-cell' ? { ...w, label: nextLabel, titleText: nextLabel } : w)
            }));
        }
    }
    _extractCurrentBlocks() {
        const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${this.editCellId}`];
        const rawText = buffer ? buffer.content : (this.cells.find(c => c.id === this.editCellId)?.content || '');
        const match = rawText.match(/<<<<<<< SEARCH[ \t]*\r?\n([\s\S]*?)^=======[ \t]*\r?\n([\s\S]*?)^>>>>>>> REPLACE/m);
        if (match) {
            return { searchStr: match[1].replace(/\r?\n$/, ''), replaceStr: match[2].replace(/\r?\n$/, '') };
        }
        return { searchStr: '', replaceStr: rawText };
    }
    render() {
        if (!this.editCellId) return html``;
        const currentIndex = this.cells.findIndex(c => c.id === this.editCellId);
        const total = this.cells.length;
        const { searchStr, replaceStr } = this._previewDiff ? this._extractCurrentBlocks() : { searchStr: '', replaceStr: '' };
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                ${this._previewDiff ? html`
                    <sutram-diff-viewer
                        .searchStr=${searchStr}
                        .replaceStr=${replaceStr}
                        leftTitle="SEARCH Block"
                        rightTitle="REPLACE Block">
                    </sutram-diff-viewer>
                ` : html`
                    <insetu-editor-projection 
                        .filepath=${`yomama://${this.editCellId}`} 
                        data-sub-id=${`yomama://${this.editCellId}`}>
                    </insetu-editor-projection>
                `}
                <sutram-surface slot="footer" variant="panel" border="top" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-btn intent="danger" icon="x" label="Cancel" @click=${() => {
                                if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                            }}></sutram-btn>
                            <sutram-btn intent="highlight" icon="${this._previewDiff ? 'edit-3' : 'columns'}" label="${this._previewDiff ? 'Raw Editor' : 'Diff View'}" @click=${() => {
                                this._previewDiff = !this._previewDiff;
                            }}></sutram-btn>
                            <sutram-btn intent="warning" icon="refresh-cw" label="Swap S/R" @click=${() => {
                                this.dispatch('insetu:bridge:cell-swap', { id: this.editCellId });
                            }}></sutram-btn>
                        </sutram-stack>
                        ${total > 1 ? html`
                            <sutram-stack direction="row" align="center" gap="xs">
                                <sutram-btn ?compact=${true} intent="neutral" icon="chevron-left" label="Prev" ?disabled=${currentIndex <= 0} @click=${() => this._navigateChunk(-1)}></sutram-btn>
                                <sutram-tag text="${currentIndex + 1} / ${total}"></sutram-tag>
                                <sutram-btn ?compact=${true} intent="neutral" icon="chevron-right" label="Next" ?disabled=${currentIndex >= total - 1} @click=${() => this._navigateChunk(1)}></sutram-btn>
                            </sutram-stack>
                        ` : ''}
                        <sutram-btn intent="success" icon="check" label="Save Patch" ?grow=${true} @click=${() => {
                            this._commitCurrentBuffer();
                            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                        }}></sutram-btn>
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-bridge-edit-projection', InSetuBridgeEditProjection);
export class InSetuExtBridgeActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        _pinnedRepos: { type: Object }
    };
    static styles = [sharedStyles];
    connectedCallback() {
        super.connectedCallback();
        this._pinnedRepos = window.inSetu.stores.App.getState().pinnedRepos;
        this.subscribe(
            window.inSetu.stores.App,
            state => state.pinnedRepos,
            (pinnedRepos) => {
                this._pinnedRepos = pinnedRepos;
            }
        );
    }

    render() {
        const currentPins = this._pinnedRepos || this.ecosystem.pinnedRepos;
        const active = Array.from(currentPins).filter(r => r !== 'ALL');
        let btnText = 'Filters';
        let hasF = false;
        if (active.length > 0) {
            btnText = `Filters: ${active.slice(0, 2).join(', ')}${active.length > 2 ? '...' : ''}`;
            hasF = true;
        }
        return html`
            <sutram-filter-dropdown .filterText=${btnText} .hasFilters=${hasF}>
                <insetu-repo-filter
                    .repos=${this.ecosystem.allRepos}
                    .activeRepos=${Array.from(currentPins)}
                    @repo-filter-changed=${(e) => window.inSetu.stores.App.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                </insetu-repo-filter>
            </sutram-filter-dropdown>
        `;
    }
}
if (!customElements.get('insetu-ext-bridge-actions')) {
    customElements.define('insetu-ext-bridge-actions', InSetuExtBridgeActions);
}

export class InSetuExtBridgeHistory extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        historyRecords: { type: Array },
        searchQuery: { type: String },
        _viewMode: { type: String },
        _renderLimit: { type: Number }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.historyRecords = [];
        this.searchQuery = '';
        this._viewMode = 'transaction';
        this._renderLimit = 15;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('searchQuery') || changedProperties.has('_viewMode')) {
            this._renderLimit = 15;
        }
    }

    firstUpdated() {
        super.firstUpdated();
        this._observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this._renderLimit += 15;
            }
        }, { rootMargin: '200px' });

        const sentinel = this.shadowRoot.querySelector('#history-sentinel');
        if (sentinel) this._observer.observe(sentinel);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._observer) this._observer.disconnect();
    }
    connectedCallback() {
        super.connectedCallback();
        const init = BridgeStore.getState();
        this.historyRecords = init.historyRecords || [];
        this._viewMode = init.historyViewMode || 'transaction';
        this.subscribe(
            BridgeStore,
            state => ({
                historyRecords: state.historyRecords || [],
                historyViewMode: state.historyViewMode || 'transaction'
            }),
            ({ historyRecords, historyViewMode }) => {
                this.historyRecords = historyRecords;
                this._viewMode = historyViewMode;
            }
        );
        BridgeStore.getState().fetchHistory();
    }
    render() {
        const isTx = this._viewMode === 'transaction';
        const filteredRecords = this.searchQuery
            ? this.utils.fuzzyFilterObjects(this.historyRecords, this.searchQuery, r => `${r.filepath} ${r.transaction_id} ${r.post_patch_hash}`)
            : this.historyRecords;
        const activeRepos = this.ecosystem.pinnedRepos;
        const repoFilteredRecords = filteredRecords.filter(r => {
            if (activeRepos.has('ALL')) return true;
            const parsedRepo = new this.utils.InSetuURI(r.filepath || '').repo;
            return activeRepos.has(r.repo) || activeRepos.has(parsedRepo);
        });

        // 1. Transaction-Centric Grouping
        const groupedTxs = repoFilteredRecords.reduce((acc, r) => {
            const txKey = r.transaction_id || "legacy_" + r.patch_id;
            if (!acc[txKey]) acc[txKey] = { timestamp: r.timestamp, records: [] };
            acc[txKey].records.push(r);
            return acc;
        }, {});
        const sortedTxs = Object.entries(groupedTxs).sort((a, b) => b[1].timestamp - a[1].timestamp);

        // 2. File-Centric Grouping
        const groupedFiles = repoFilteredRecords.reduce((acc, r) => {
            if (!acc[r.filepath]) acc[r.filepath] = { latest_ts: 0, records: [] };
            acc[r.filepath].records.push(r);
            if (r.timestamp > acc[r.filepath].latest_ts) acc[r.filepath].latest_ts = r.timestamp;
            return acc;
        }, {});
        const sortedFiles = Object.entries(groupedFiles).sort((a, b) => b[1].latest_ts - a[1].latest_ts);

        return html`
            <sutram-view>
                <sutram-toolbar
                    slot="toolbar"
                    searchPlaceholder="Fuzzy search receipts..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => this.searchQuery = e.detail.value}
                    .enableFilterDropdown=${true}
                    .activeFilters=${Array.from(this.ecosystem.pinnedRepos)}>
                    <insetu-repo-filter
                        slot="filters"
                        .repos=${this.ecosystem.allRepos}
                        .activeRepos=${Array.from(this.ecosystem.pinnedRepos)}
                        @repo-filter-changed=${(e) => window.inSetu.stores.App.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                    </insetu-repo-filter>
                </sutram-toolbar>
                <sutram-stack direction="col" gap="md">
                    ${this.historyRecords.length === 0 ? html`<sutram-empty-state text="No ledger receipts available."></sutram-empty-state>` : ''}
                    ${repoFilteredRecords.length === 0 && this.historyRecords.length > 0 ? html`<sutram-empty-state text="No ledger receipts match criteria."></sutram-empty-state>` : ''}

                ${this._viewMode === 'transaction' ? sortedTxs.slice(0, this._renderLimit).map(([txId, txData]) => {
                    const repos = Array.from(new Set(txData.records.map(r => r.repo || r.filepath?.split('/')[0]).filter(Boolean)));
                    const repoStr = repos.length > 0 ? ' in ' + repos.join(', ') : '';
                    const countStr = txData.records.length + (txData.records.length !== 1 ? ' files' : ' file') + ' modified' + repoStr;
                    return html`
                        <sutram-card-group ?stacked=${true} ?accordion=${true}>
                            <sutram-card
                                .titleText=${"Tx: " + (txId || 'Unknown')}
                                .descriptionText=${countStr}
                                .detailText=${this.utils.timeAgo(txData.timestamp * 1000)}
                                icon="git-merge"
                                intent="highlight"
                                entityType="yomama-turn"
                                .entityData=${{ transaction_id: txId, records: txData.records }}>
                            </sutram-card>
                            ${txData.records.map((record) => {
                                let chunks = record.chunks || record.patches;
                                if (!chunks && record.chunks_json) {
                                    try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                                }
                                const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                                const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                                let descStr = patchStr + (record.is_snapshot ? ' • Snapshot' : '');

                                if (Array.isArray(chunks) && chunks.length > 0 && chunks[0].comment) {
                                    descStr = chunks[0].comment;
                                }
                                return html`
                                <sutram-card
                                    .titleText=${new window.inSetu.utils.InSetuURI(record.filepath).basename}
                                    .descriptionText=${descStr}
                                    .detailText=${record.filepath}
                                    icon=${record.is_snapshot ? 'save' : 'file-text'}
                                    intent=${record.is_snapshot ? 'highlight' : 'neutral'}
                                    entityType="patch-receipt"
                                    .entityData=${record}
                                    @card-clicked=${() => {
                                        if (window.inSetu.vfs.viewSourceFile) {
                                            window.inSetu.vfs.viewSourceFile(record.filepath, true);
                                        }
                                    }}>
                                </sutram-card>
                                `;
                            })}
                        </sutram-card-group>
                    `;
                }) : sortedFiles.slice(0, this._renderLimit).map(([filepath, fileData]) => {
                    const filename = new window.inSetu.utils.InSetuURI(filepath).basename;
                    const repo = fileData.records[0]?.repo || '';
                    return html`
                        <sutram-card-group ?stacked=${true} ?accordion=${true}>
                            <sutram-card
                                .titleText=${filename}
                                .descriptionText=${repo ? "Repo: " + repo : ""}
                                .detailText=${filepath}
                                icon="file-code-2"
                                intent="highlight"
                                entityType="file"
                                .entityData=${{ filepath: filepath, isFS: true, suppress: ['file-browse'] }}
                                @card-clicked=${() => {
                                    if (window.inSetu.vfs.viewSourceFile) {
                                        window.inSetu.vfs.viewSourceFile(filepath, true);
                                    }
                                }}>
                            </sutram-card>
                            ${fileData.records.map((record, idx) => {
                                let chunks = record.chunks || record.patches;
                                if (!chunks && record.chunks_json) {
                                    try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                                }
                                const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                                const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                                let descStr = patchStr + (record.is_snapshot ? ' • Snapshot' : '');

                                if (Array.isArray(chunks) && chunks.length > 0 && chunks[0].comment) {
                                    descStr = chunks[0].comment;
                                }
                                return html`
                                <sutram-card
                                    .titleText=${"Tx: " + (record.transaction_id || 'Unknown')}
                                    .descriptionText=${descStr}
                                    .detailText=${'Turn ' + (idx + 1) + ' of ' + fileData.records.length + ' • ' + this.utils.timeAgo(record.timestamp * 1000)}
                                    icon=${record.is_snapshot ? 'save' : 'git-commit'}
                                    intent=${record.is_snapshot ? 'highlight' : 'neutral'}
                                    entityType="patch-receipt"
                                    .entityData=${record}
                                    @card-clicked=${() => {
                                        if (window.inSetu.vfs.viewSourceFile) {
                                            window.inSetu.vfs.viewSourceFile(record.filepath, true);
                                        }
                                    }}>
                                </sutram-card>
                                `;
                            })}
                        </sutram-card-group>
                    `;
                })}
                ${((this._viewMode === 'transaction' && sortedTxs.length > this._renderLimit) || (this._viewMode !== 'transaction' && sortedFiles.length > this._renderLimit)) ? html`
                    <div id="history-sentinel" style="height: 20px; width: 100%;"></div>
                ` : ''}
                </sutram-stack>
                <sutram-surface slot="footer" variant="tinted" intent="success" border="top" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-btn
                            intent="success"
                            icon="history"
                            title="Toggle Yomama Menu (Active: Receipts)"
                            @click=${() => BridgeStore.getState().toggleDrawer()}>
                        </sutram-btn>
                        <sutram-btn
                            intent="neutral"
                            icon=${isTx ? 'folder-kanban' : 'file-text'}
                            label=${isTx ? 'Group By File' : 'Group By Turn'}
                            ?grow=${true}
                            @click=${() => BridgeStore.setState({ historyViewMode: isTx ? 'file' : 'transaction' })}>
                        </sutram-btn>
                        <sutram-btn
                            intent="success"
                            icon="refresh-cw"
                            label="Refresh"
                            @click=${() => BridgeStore.getState().fetchHistory()}>
                        </sutram-btn>
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-bridge-history', InSetuExtBridgeHistory);
window.ExtensionRegistry.registerExtension('bridge', {
    name: "Yomama Sync Bridge",
    version: "2.0.0",
    offline_mode: "read_only",
    entityActions: [
        {
            targetEntity: 'yomama-turn',
            id: 'yomama-turn-undo',
            label: 'Undo Turn (Pre-Tx)',
            icon: 'rewind',
            intent: 'danger',
            group: 'edit',
            vfsBound: true,
            order: 10,
            asyncAction: async (data) => {
                if (!confirm(`Undo this entire turn? All ${data.records.length} files will be restored to their pre-turn state.`)) return;
                const res = await window.inSetu.api.post('bridge/revert', { transaction_id: data.transaction_id, target_state: 'initial' });
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    throw new Error(err.error || "Undo turn failed.");
                }
                const resData = await res.json();
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(resData.message, 3000);
                window.inSetu.stores.Bridge.getState().fetchHistory();
            }
        },
        {
            targetEntity: 'yomama-turn',
            id: 'yomama-turn-restore',
            label: 'Restore Turn (Post-Tx)',
            icon: 'target',
            intent: 'warning',
            group: 'edit',
            vfsBound: true,
            order: 20,
            asyncAction: async (data) => {
                if (!confirm(`Restore all ${data.records.length} files to their end state at the completion of this turn?`)) return;
                const res = await window.inSetu.api.post('bridge/revert', { transaction_id: data.transaction_id, target_state: 'final' });
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    throw new Error(err.error || "Turn restore failed.");
                }
                const resData = await res.json();
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(resData.message, 3000);
                window.inSetu.stores.Bridge.getState().fetchHistory();
            }
        },
        {
            targetEntity: 'yomama',
            id: 'yomama-copy',
            label: 'Copy',
            icon: 'clipboard',
            group: 'edit',
            vfsBound: false,
            order: 10,
            onClick: async (data) => {
                const text = `<<<<<<< FILE: ${data.file}\n${data.content}`;
                if (window.inSetu && window.inSetu.utils && window.inSetu.utils.copyRawText) {
                    await window.inSetu.utils.copyRawText(text);
                }
            }
        },
        {
            targetEntity: 'yomama',
            id: 'yomama-delete',
            label: 'Delete',
            icon: 'trash-2',
            intent: 'danger',
            group: 'file',
            vfsBound: false,
            order: 30,
            onClick: (data) => {
                if (confirm("Remove this patch?")) {
                    window.inSetu.stores.Bridge.getState().removeCell(data.id);
                    window.inSetu.events.emit('insetu:bridge:cell-deleted', { id: data.id });
                }
            }
        },
        {
            targetEntity: 'yomama',
            id: 'yomama-swap',
            label: 'Swap',
            icon: 'refresh-cw',
            intent: 'warning',
            group: 'edit',
            vfsBound: false,
            order: 40,
            emitEvent: (data) => ({ name: 'insetu:bridge:cell-swap', detail: { id: data.id } })
        },
        {
            targetEntity: 'patch-receipt',
            id: 'patch-receipt-undo',
            label: 'Revert Pre-Patch',
            icon: 'rewind',
            intent: 'danger',
            group: 'edit',
            vfsBound: true,
            order: 10,
            asyncAction: async (data) => {
                if (!confirm(`Revert ${data.filepath} to its state BEFORE this patch?`)) return;
                const res = await window.inSetu.api.post('bridge/revert', { patch_id: data.patch_id, target_state: 'initial' });
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    throw new Error(err.error || "Revert failed.");
                }
                const resData = await res.json();
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(resData.message, 3000);
                window.inSetu.stores.Bridge.getState().fetchHistory();
            }
        },
        {
            targetEntity: 'patch-receipt',
            id: 'patch-receipt-restore',
            label: 'Revert Post-Patch',
            icon: 'target',
            intent: 'warning',
            group: 'edit',
            vfsBound: true,
            order: 15,
            asyncAction: async (data) => {
                if (!confirm(`Revert ${data.filepath} to its state AFTER this patch?`)) return;
                const res = await window.inSetu.api.post('bridge/revert', { patch_id: data.patch_id, target_state: 'final' });
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    throw new Error(err.error || "Revert failed.");
                }
                const resData = await res.json();
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(resData.message, 3000);
                window.inSetu.stores.Bridge.getState().fetchHistory();
            }
        },
        {
            targetEntity: 'patch-receipt',
            id: 'patch-receipt-copy',
            label: 'Copy Sandwich',
            icon: 'clipboard',
            intent: 'neutral',
            group: 'share',
            vfsBound: false,
            order: 20,
            onClick: async (data) => {
                let sandwich = "<<<<<<< FILE: " + data.filepath + "\n";
                let chunks = data.chunks || data.patches;
                if (!chunks && data.chunks_json) {
                    try { chunks = JSON.parse(data.chunks_json); } catch(e) {}
                }
                if (Array.isArray(chunks) && chunks.length > 0) {
                    sandwich += chunks.map(c => {
                        const commentStr = c.comment ? `<<<<<<< COMMENT\n${c.comment}\n` : '';
                        const s = c.search !== undefined ? c.search : (c.search_block || '');
                        const r = c.replace !== undefined ? c.replace : (c.replace_block || '');
                        return `${commentStr}<<<<<<< SEARCH\n${s}\n=======\n${r}\n>>>>>>> REPLACE`;
                    }).join('\n\n');
                } else {
                    sandwich += "<<<<<<< SEARCH\n" + (data.search_block || '') + "\n=======\n" + (data.replace_block || '') + "\n>>>>>>> REPLACE";
                }

                if (window.inSetu && window.inSetu.utils && window.inSetu.utils.copyRawText) {
                    await window.inSetu.utils.copyRawText(sandwich);
                }
            }
        }
    ],
    layoutSlots: [
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
        {
            slot: "slots:yomama-surface",
            id: "bridge",
            label: "Bridge",
            icon: "bridge",
            intent: "highlight",
            order: 10,
            component: null
        },
        {
            slot: "slots:yomama-surface",
            id: "receipts",
            label: "Receipts",
            icon: "history",
            intent: "success",
            order: 40,
            component: "insetu-ext-bridge-history"
        }
    ]
});
