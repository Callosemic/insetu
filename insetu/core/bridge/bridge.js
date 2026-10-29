import { html, css } from 'lit';
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
            BridgeStore.setState(state => ({
                cells: [...state.cells, ...newCells],
                viewMode: 'input',
                activeSurface: 'bridge',
                drawerOpen: false
            }));
            BridgeStore.getState().setActiveSurface('bridge');
        }
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
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; container-type: inline-size; background: var(--bg); }
            .yomama-shell {
                display: flex;
                flex: 1;
                min-height: 0;
                width: 100%;
                position: relative;
                overflow: hidden;
            }
            .yomama-drawer {
                width: 240px;
                border-right: 1px solid var(--border);
                background: var(--input-bg);
                display: flex;
                flex-direction: column;
                padding: 10px;
                gap: 6px;
                flex-shrink: 0;
                box-sizing: border-box;
                overflow-y: auto;
                z-index: 40;
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .yomama-drawer.collapsed-desktop {
                display: none;
            }
            .yomama-drawer-backdrop {
                display: none;
            }
            @container (max-width: 45rem) {
                .yomama-drawer,
                .yomama-drawer.collapsed-desktop {
                    display: flex;
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    width: 260px;
                    max-width: 82%;
                    background: color-mix(in srgb, var(--pane-bg) 96%, transparent);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    box-shadow: var(--overlay-shadow, 0 12px 32px rgba(0,0,0,0.45));
                    transform: translateX(-105%);
                }
                .yomama-drawer.open-mobile {
                    transform: translateX(0);
                }
                .yomama-drawer-backdrop.open-mobile {
                    display: block;
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.45);
                    z-index: 35;
                }
            }
            .yomama-stage {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
                min-width: 0;
                overflow: hidden;
                background: var(--bg);
            }
            .drawer-nav-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 700;
                color: var(--text-muted);
                border: 1px solid transparent;
                border-left: 3px solid transparent;
                user-select: none;
                transition: all 0.15s ease;
            }
            .drawer-nav-item:hover {
                background: color-mix(in srgb, var(--item-accent, var(--intent-highlight)) 8%, var(--bg-hover));
                color: var(--text);
            }
            .drawer-nav-item.active {
                background: color-mix(in srgb, var(--item-accent, var(--intent-highlight)) 16%, var(--bg));
                color: var(--text);
                border-color: color-mix(in srgb, var(--item-accent, var(--intent-highlight)) 40%, var(--border));
                border-left: 3px solid var(--item-accent, var(--intent-highlight));
            }
            .drawer-badge {
                background: var(--item-accent, var(--intent-highlight));
                color: #ffffff;
                font-size: 0.7rem;
                font-family: var(--font-mono);
                padding: 1px 6px;
                border-radius: 10px;
            }
            .bridge-group-container {
                padding: 15px 20px;
                display: flex;
                flex-direction: column;
                border-bottom: 1px solid var(--border);
            }
            .console-header-text { padding: 0 var(--mobile-edge-padding); padding-top: var(--mobile-edge-padding); }
            @container (max-width: 480px) {
                .bridge-group-container { padding: 0; }
            }
            .bridge-footer {
                padding: 12px 16px;
                gap: 10px;
                border-top: 2px solid color-mix(in srgb, var(--intent-highlight) 55%, var(--border));
                background: color-mix(in srgb, var(--intent-highlight) 6%, var(--input-bg));
                display: flex;
                flex-direction: column;
                align-items: stretch;
                flex-shrink: 0;
                width: 100%;
                box-sizing: border-box;
            }
            .bridge-footer-heal-row {
                display: flex;
                align-items: stretch;
                width: 100%;
            }
            .bridge-footer-main-row {
                display: flex;
                align-items: stretch;
                gap: 10px;
                width: 100%;
            }
            @container (min-width: 720px) {
                .bridge-footer {
                    flex-direction: row;
                    align-items: stretch;
                }
                .bridge-footer-heal-row {
                    width: auto;
                    flex-shrink: 0;
                }
                .bridge-footer-main-row {
                    flex: 1;
                    min-width: 0;
                }
            }
            .btn-sm { margin: 0; padding: 8px 14px; font-size: 14px; }
        `
    ];
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
        this._surfaceNodes = new Map();
        this._drawerNodes = new Map();
    }

    _getOrMountNode(cacheMap, tag) {
        if (!tag) return '';
        if (!cacheMap.has(tag)) {
            cacheMap.set(tag, document.createElement(tag));
        }
        return cacheMap.get(tag);
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

        let swapped = false;
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
                    swapped = true;
                    // Run statelessly on the next tick to avoid render loop collisions
                    setTimeout(() => {
                        BridgeStore.getState().updateGroupFile(file, newPath);
                        window.inSetu.stores.Fs.getState().verifyFiles([newPath], true);
                    }, 0);
                }
            }
        });
        if (swapped) this.requestUpdate();
    }
    onWorkspaceLoad(workspaceId) {
        BridgeStore.getState().clearPayload();
        window.inSetu.stores.Fs?.setState({ fileVerificationCache: {} });
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
        const totalCount = groupCells.length;

        // Mathematical toggle: If the parent is fully unselected, turn all ON. Otherwise, turn all OFF.
        const targetState = selectedCount === 0;

        const updatedCells = cells.map(c =>  
            c.file === file ? { ...c, active: targetState } : c
        );

        BridgeStore.setState({ cells: updatedCells });
        this.requestUpdate();
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
        this.requestUpdate();
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
    _handleConsoleClick(e) {
        const path = this.getEventPath(e);
        const btn = path.find(el => el && el.dataset && el.dataset.action);
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'approve-gate') {
            const cellId = btn.dataset.cellId || btn.dataset.old;
            const gateCode = btn.dataset.gate || '*';
            const targetUri = btn.dataset.target || btn.dataset.old;
            BridgeStore.getState().setResolution(cellId, { approved_gate: gateCode, selected_uri: targetUri });
            if (btn.dataset.old) {
                BridgeStore.getState().setResolution(btn.dataset.old, { approved_gate: gateCode, selected_uri: targetUri });
            }
            this._getSyncAction(this._lastDryRun || false)();
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
            this._getSyncAction(this._lastDryRun || false)();
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
            const oldPath = btn.dataset.old;
            const cellId = btn.dataset.cellId;
            const actualAnchor = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.anchor), c => c.charCodeAt(0)));

            const cells = BridgeStore.getState().cells || [];
            const targetCell = cells.find(c => c.id === cellId);
            if (targetCell) {
                const blockRegex = /^(<<<<<<< SEARCH)[ \t]*\r?\n([\s\S]*?)^(=======)/m;
                const newContent = targetCell.content.replace(blockRegex, "$1\n" + actualAnchor + "\n$3");
                BridgeStore.getState().updateCellContent(targetCell.id, newContent);
                this._getSyncAction(this._lastDryRun || false)();
            }
        } else if (action === 'deselect-this-patch') {
            const cellId = btn.dataset.cellId;
            BridgeStore.getState().toggleCellActive(cellId);
            this._getSyncAction(this._lastDryRun || false)();
        } else if (action === 'deselect-all-file-patches' || action === 'deselect-patch') {
            const oldPath = btn.dataset.old;
            const resolvedPath = btn.dataset.resolved;
            this._deselectAllFilePatches(oldPath, resolvedPath);
            this._getSyncAction(this._lastDryRun || false)();
        } else if (action === 'deep-search') {
            const cellId = btn.dataset.cellId || btn.dataset.old;
            if (cellId) {
                BridgeStore.getState().setResolution(cellId, { allow_deep_search: true });
            }
            this._getSyncAction(this._lastDryRun || false, false, { allow_deep_search: true })();
        } else if (action === 'ai-heal-sync') {
            this._getSyncAction(this._lastDryRun || false, false, { auto_heal: true })();
        }
    }
    _renderTelemetry() {
        const t = this.telemetry;
        const isErrorOutput = typeof this.consoleOutput === 'string' && this.consoleOutput.startsWith('[!]');
        if (!t) return html`<div id="status-box" class="console-header-text" style=${`width: 100%; font-family: var(--font-mono); font-size: 0.9rem; white-space: pre-wrap; color: ${isErrorOutput ? 'var(--intent-danger)' : 'var(--text)'}; font-weight: ${isErrorOutput ? 'bold' : 'normal'};`}>${this.consoleOutput}</div>`;

        return html`
            <div style="width: 100%; display: flex; flex-direction: column;">
                <div class="console-header-text">
                    <h3 style=${`color: ${t.can_commit ? 'var(--intent-success)' : 'var(--intent-warning)'}; margin-top: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;`}>
                        <yv-icon name=${t.can_commit ? "check-circle-2" : "alert-triangle"} style="width: 20px; height: 20px;"></yv-icon>
                        ${t.can_commit ? (t.mode === 'live' ? 'Transaction Committed' : 'Dry Run Verified') : 'Action Required'}
                        ${t.healed_attempts ? html`<span style="font-size: 0.75rem; background: color-mix(in srgb, var(--intent-highlight) 20%, transparent); color: var(--intent-highlight); border: 1px solid var(--intent-highlight); padding: 2px 8px; border-radius: 12px;">✨ Fast-Healed (${t.healed_attempts} pass${t.healed_attempts > 1 ? 'es' : ''})</span>` : ''}
                    </h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">
                    Total: ${t.summary?.total_patches ?? 0} &bull; Resolved: ${t.summary?.resolved ?? 0} &bull; Skipped: ${t.summary?.auto_skipped ?? 0} &bull; Confirm: ${t.summary?.action_required ?? 0} &bull; Failed: ${t.summary?.failed ?? 0}
                </p>
                ${t.heal_error ? html`<p style="color: var(--intent-danger); font-size: 0.8rem; font-family: var(--font-mono);">⚠️ AI Healer Error: ${t.heal_error}</p>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                    ${(() => {
                        const safePatches = t.patches || [];
                        if (safePatches.length === 0) {
                            return html`
                                <div style="padding: 15px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text-muted); font-style: italic;">
                                    ${t.message ? html`<span style="color: var(--intent-danger); font-weight: bold; white-space: pre-wrap;">[Backend Error] ${t.message}</span>` : 'No patch data available for this transaction.'}
                                </div>
                            `;
                        }
                        const groupedPatches = safePatches.reduce((acc, p) => {
                            const file = p.resolved_file || p.original_file || 'Unknown File';
                            if (!acc[file]) acc[file] = [];
                            acc[file].push(p);
                            return acc;
                        }, {});

                        const origFileCounters = {};

                        return Object.entries(groupedPatches).map(([file, filePatches]) => {
                            const hasError = filePatches.some(p => p.status === 'failed' || p.status === 'syntax_error');
                            const hasWarning = filePatches.some(p => p.status === 'needs_confirmation' || p.status === 'offer_deep_search');
                            const isSkipped = filePatches.every(p => p.status === 'auto_skipped');
                            let cardIntent = 'success';
                            let icon = 'check-circle-2';
                            if (hasError) { cardIntent = 'danger'; icon = 'x-circle'; }
                            else if (hasWarning) { cardIntent = 'warning'; icon = 'alert-triangle'; }
                            else if (isSkipped) { cardIntent = 'neutral'; icon = 'skip-forward'; }

                            const targetEntityFile = file;
                            return html`
                                <sutram-card 
                                    .titleText=${file} 
                                    .icon=${icon}
                                    .detailText=${`${filePatches.length} Patch${filePatches.length !== 1 ? 'es' : ''}`} 
                                    .intent=${cardIntent}
                                    entityType="file"
                                    .entityData=${{ filepath: targetEntityFile, isFS: true, suppress: ['file-browse'] }}>

                                    <div style="padding: 2px 0; font-size: 0.85rem; line-height: 1.5; color: var(--text);">
                                        ${filePatches.map((p) => {
                                            const origFile = p.original_file;
                                            const origFileIdx = origFileCounters[origFile] || 0;
                                            origFileCounters[origFile] = origFileIdx + 1;

                                            return html`
                                            <div style="border-bottom: ${origFileIdx < filePatches.length - 1 ? '1px solid var(--border)' : 'none'}; padding-bottom: ${origFileIdx < filePatches.length - 1 ? '12px' : '0'}; margin-bottom: ${origFileIdx < filePatches.length - 1 ? '12px' : '0'};">
                                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                                    <p style="margin: 0; font-weight: bold; color: var(--text-muted);">Patch #${(p.patch_index || 0) + 1}: <span style="color: var(--text);">${(p.status || 'unknown').replace('_', ' ')}</span></p>
                                                    ${p.flags && p.flags.length > 0 ? html`
                                                        <span style="font-size: 0.75rem; color: var(--intent-highlight); border: 1px solid var(--intent-highlight); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${p.flags.join(', ')}</span>
                                                    ` : ''}
                                                </div>
                                                ${p.error_message ? html`<div style="color: ${p.status === 'auto_skipped' ? 'var(--intent-warning)' : 'var(--intent-danger)'}; margin: 6px 0 0 0; font-family: var(--font-mono); font-size: 0.8rem; white-space: pre-wrap; word-break: break-word;">${p.error_message}</div>` : ''}
                                                ${p.syntax_error && p.status !== 'syntax_error' ? html`
                                                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                                                        <sutram-btn data-action="view-diff" data-b64="${p.syntax_error}" intent="danger" icon="git-compare" label="${p.resolution_type === 'anchor_failed' ? 'Inspect Anchor Mismatch Diff' : 'Inspect Failed Anchor Diff'}" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                    </div>
                                                ` : (p.status === 'syntax_error' ? html`
                                                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                                                        <sutram-btn data-action="view-syntax-error" data-err="${p.error_message || 'Syntax error'}" data-file="${file}" intent="danger" icon="file-text" label="View Syntax Error" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                    </div>
                                                ` : '')}
                                                ${p.gate ? (() => {
                                                    const gateUi = BRIDGE_GATE_UI_MAP[p.gate.code] || { label: 'Confirm Action', intent: 'warning', icon: 'check' };
                                                    return html`
                                                        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px;">
                                                            <span style="font-family: var(--font-mono); font-size: 0.8rem;">${p.gate.target_uri || p.original_file}</span>
                                                            <sutram-btn
                                                                data-action="approve-gate"
                                                                data-gate="${p.gate.code}"
                                                                data-old="${p.original_file}"
                                                                data-target="${p.gate.target_uri || p.original_file}"
                                                                data-cell-id="${p.cell_id || ''}"
                                                                intent="${gateUi.intent}"
                                                                icon="${gateUi.icon}"
                                                                label="${gateUi.label}"
                                                                style="--btn-padding: 4px 10px;">
                                                            </sutram-btn>
                                                        </div>
                                                    `;
                                                })() : ''}
                                                ${p.candidates && p.candidates.length > 0 && !p.gate ? html`
                                                    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                                                        ${p.candidates.map(c => html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                                                                <span style="font-family: monospace;">${c.filepath}${c.score ? ` (Score: ${c.score})` : ''}</span>
                                                                <sutram-btn data-action="confirm-candidate" data-old="${p.original_file}" data-new="${c.filepath}" data-cell-id="${p.cell_id || ''}" intent="primary" icon="check" label="Confirm Match" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                            </div>
                                                        `)}
                                                    </div>
                                                ` : ''}
                                                <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; align-items: center;">
                                                    ${p.available_actions?.includes('offer_deep_search') ? html`
                                                        <sutram-btn data-action="deep-search" data-old="${p.original_file}" data-cell-id="${p.cell_id || ''}" intent="highlight" label="Run Deep Search" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('heal_anchor') ? html`
                                                        <sutram-btn data-action="heal-anchor" data-old="${p.original_file}" data-cell-id="${p.cell_id || ''}" data-anchor="${p.actual_anchor}" intent="success" label="Auto-Heal Anchor" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                    ` : ''}
                                                    ${(p.status === 'needs_confirmation' || p.status === 'failed' || p.status === 'syntax_error') && !p.gate ? html`
                                                        <sutram-btn data-action="ai-heal-sync" icon="sparkles" intent="highlight" label="AI Heal & Retry (Fast Tier)" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('deselect_patch') ? html`
                                                        <div style="display: flex; align-items: center; gap: 6px;">
                                                            <sutram-btn data-action="deselect-this-patch" data-old="${p.original_file}" data-resolved="${p.resolved_file || ''}" data-cell-id="${p.cell_id}" intent="neutral" label="Deselect Patch" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                            <sutram-btn data-action="deselect-all-file-patches" data-old="${p.original_file}" data-resolved="${p.resolved_file || ''}" intent="neutral" label="Deselect All File Patches" style="--btn-padding: 4px 10px;"></sutram-btn>
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        `;
                                        })}
                                    </div>
                                </sutram-card>
                            `;
                        });
                    })()}
                </div>
            </div>
        `;
    }
    _renderBridgeSurface(groupedCells) {
        return html`
            <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden; background: var(--bg); height: 100%;">
                <!-- INPUT VIEW -->
                <div style="display: ${this.viewMode === 'input' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; padding: 0; background: var(--bg);">
                    ${this.cells.length === 0 ? html`
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed color-mix(in srgb, var(--intent-highlight) 45%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--intent-highlight) 4%, var(--input-bg)); min-height: 300px; position: relative; margin: 20px;"
                            @dragover=${e => e.preventDefault()}
                            @drop=${async e => {
                                e.preventDefault();
                                const text = e.dataTransfer.getData('text');
                                if (text) BridgeStore.getState().parseAndAppendCells(text);
                            }}>
                            <yv-icon name="bridge" style="width: 48px; height: 48px; color: var(--intent-highlight); margin-bottom: 12px;"></yv-icon>
                            <h3 style="margin: 0 0 10px 0; color: var(--text);">Yomama Sync Bridge</h3>
                            <p style="color: var(--text-muted); margin-bottom: 20px; text-align: center; max-width: 400px;">Paste a patch sandwich from your LLM to begin parsing individual file blocks.</p>
                            <textarea style="opacity: 0.01; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; z-index: 1; resize: none;" autofocus></textarea>
                        </div>
                    ` : html`
                        ${Object.entries(groupedCells).map(([file, groupCells]) => {
                            const selectedCount = groupCells.filter(c => c.active).length;
                            const totalCount = groupCells.length;
                            return html`
                                <div class="bridge-group-container">
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
                                        @sutram-card-select-toggled=${(e) => { e.stopPropagation(); this._handleParentToggle(file); }}
                                        style="display: block;">
                                        <div slot="header-actions">
                                            <sutram-btn intent="highlight" label="Remap" style="--btn-padding: 4px 10px; margin: 0;" @click=${(e) => {
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

                                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 5px;">
                                            <sutram-input ?flush=${true} .value=${file} style="width: 100\%; margin: 0; --bg-input: var(--bg);" @sutram-input-changed=${(e) => {
                                                BridgeStore.getState().updateGroupFile(file, e.detail.value);
                                                window.inSetu.stores.Fs?.getState()?.verifyFiles([e.detail.value], true);
                                            }}></sutram-input>
                                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                                                <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--intent-highlight);">
                                                    ${selectedCount} of ${totalCount} patches selected
                                                </span>
                                                ${this._autoSwaps[file] && this._autoSwaps[file] !== file ? html`
                                                    <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--intent-success); font-weight: bold;">
                                                        <span>✨ Auto-mapped</span>
                                                        <sutram-btn size="sm" intent="neutral" label="Undo" style="--btn-padding: 1px 6px; --btn-font-size: 0.7rem; margin: 0;" @click=${(e) => {
                                                            e.stopPropagation();
                                                            const original = this._autoSwaps[file];
                                                            this._rejectedAutoSwaps.add(original);
                                                            const newSwaps = { ...this._autoSwaps };
                                                            delete newSwaps[file];
                                                            this._autoSwaps = newSwaps;
                                                            BridgeStore.getState().updateGroupFile(file, original);
                                                            window.inSetu.stores.Fs?.getState()?.verifyFiles([original], true);
                                                        }}></sutram-btn>
                                                    </span>
                                                ` : ''}
                                            </div>
                                        </div>
                                        ${this._fileVerificationCache[file] === false && !this._autoSwaps[file] ? (() => {
                                            let cands = [];
                                            if (this.vfs && this.vfs.getGlobalManifest) {
                                                const mFiles = this.vfs.getGlobalManifest().filter(f => !f.endsWith('.gitkeep'));
                                                // Strip OS attachment duplicate suffixes like " (1)", " (2)"
                                                const cleanFile = file.replace(/\s*\(\d+\)(?=\.[^.\/]+$|$)/, '').trim();
                                                const cleanFileLower = cleanFile.toLowerCase();
                                                const basename = new window.inSetu.utils.InSetuURI(cleanFile).basename.toLowerCase();

                                                // 1. Try matching the exact fragment (e.g. "c/file.py" matches "a/b/c/file.py")
                                                cands = mFiles.filter(f => f.toLowerCase().endsWith(cleanFileLower));

                                                // 2. Fall back to matching the exact basename
                                                if (cands.length === 0) {
                                                    cands = mFiles.filter(f => f.toLowerCase().endsWith('/' + basename) || f.toLowerCase() === basename);
                                                }
                                                cands = cands.filter(f => f !== file);
                                            }
                                            if (cands.length > 0) {
                                                return html`
                                                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); display: flex; flex-direction: column; gap: 6px;">
                                                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold;">Suggested Matches:</span>
                                                        ${cands.map(c => html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border);">
                                                                <span style="font-family: monospace; font-size: 0.8rem; color: var(--text); word-break: break-all;">${c}</span>
                                                                <sutram-btn intent="success" label="Swap" style="--btn-padding: 4px 8px; margin: 0;" @click=${(e) => {
                                                                    e.stopPropagation();
                                                                    BridgeStore.getState().updateGroupFile(file, c);
                                                                    window.inSetu.stores.Fs?.getState()?.verifyFiles([c], true);
                                                                }}></sutram-btn>
                                                            </div>
                                                        `)}
                                                    </div>
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
                            </div>
                        `;})}
                    `}
                </div>
                <!-- CONSOLE VIEW -->
                <sutram-scroll-view style=${`display: ${this.viewMode === 'console' ? 'flex' : 'none'}; background: var(--bg);`} @click=${this._handleConsoleClick}>${this._renderTelemetry()}
                </sutram-scroll-view>
                <!-- FOOTER -->
                <div class="bridge-footer">
                    ${this.cells.length > 0 && this.viewMode === 'input' ? html`
                        <div class="bridge-footer-heal-row">
                            <sutram-btn
                                intent=${this.autoHeal ? "highlight" : "neutral"}
                                ?active=${this.autoHeal}
                                icon="sparkles"
                                label=${this.autoHeal ? "Auto-Heal: ON (Fast Tier)" : "Auto-Heal: OFF"}
                                title="Defer overlapping/failed patches, apply valid chunks in memory first, and heal failed chunks with the Fast LLM tier"
                                style="flex: 1; width: 100%; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                                @click=${() => BridgeStore.setState({ autoHeal: !this.autoHeal })}>
                            </sutram-btn>
                        </div>
                    ` : ''}
                    <div class="bridge-footer-main-row">
                        <sutram-btn
                            intent="highlight"
                            icon="bridge"
                            title="Toggle Yomama Menu (Active: Bridge)"
                            style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                            @click=${() => BridgeStore.getState().toggleDrawer()}>
                        </sutram-btn>
                        ${this.cells.length === 0 && this.viewMode === 'input' ? html`
                            <sutram-btn intent="highlight" icon="clipboard-paste" label="Paste from Clipboard" style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; width: 100%;" @click=${async () => {
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
                            <sutram-btn intent="danger" icon="trash-2" label="Clear" style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; width: 100%;" @click=${() => { BridgeStore.getState().clearPayload(); }}></sutram-btn>
                            <sutram-async-btn icon="flask-conical" label="Test" intent="warning" style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; width: 100%;" .onClick=${this._getSyncAction(true)}></sutram-async-btn>
                            <sutram-async-btn icon="zap" label="Patch" intent="success" style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; width: 100%;" .onClick=${this._getSyncAction(false)}></sutram-async-btn>
                        ` : html`
                            <sutram-btn intent="neutral" icon="arrow-left" label="Back to Edit" style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; width: 100%;" @click=${() => { BridgeStore.setState({ viewMode: 'input' }); }}></sutram-btn>${this.telemetry && this.telemetry.can_commit && this.telemetry.mode !== 'live' ? html`
                                <sutram-async-btn icon="check-circle-2" label="Apply Patch" intent="success" style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; width: 100%;" .onClick=${this._getSyncAction(false, true, { force: true, ignore_syntax: true, ignore_syntax_errors: true, confirmed_candidates: Object.fromEntries(BridgeStore.getState().getActiveFiles().map(f => [f, f])) })}></sutram-async-btn>
                            ` : ''}
                        `}
                    </div>
                </div>
            </div>
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

        return html`
            <div class="yomama-shell" style="--surface-accent: var(--intent-${activeIntent});" @paste=${e => {
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
                    e.stopPropagation();
                    BridgeStore.getState().parseAndAppendCells(text);
                }
            }}>
                <div class="yomama-drawer-backdrop ${this.drawerOpen ? 'open-mobile' : ''}"
                    @click=${() => BridgeStore.setState({ drawerOpen: false })}>
                </div>
                <div class="yomama-drawer ${this.drawerOpen ? 'open-mobile' : ''} ${this.drawerCollapsedDesktop ? 'collapsed-desktop' : ''}" style="overflow: hidden;">
                    ${drawerWidgets.length > 0 ? html`
                        <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
                            ${drawerWidgets.map(w => this._getOrMountNode(this._drawerNodes, w.component))}
                        </div>
                        <hr style="border: none; border-top: 1px solid var(--border); margin: 6px 0; width: 100%; flex-shrink: 0;">
                    ` : html`<div style="flex: 1;"></div>`}

                    <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
                        <div style="font-size: 0.7rem; font-weight: 800; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--surface-accent, var(--intent-highlight)); padding: 4px 8px; display: flex; align-items: center; justify-content: space-between;">
                            <span>Yomama Surfaces</span>
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--surface-accent, var(--intent-highlight));"></span>
                        </div>
                        ${surfaces.map(s => {
                            const rawId = s.rawId || s.id.split(':').pop();
                            const isActive = currentSurfaceId === rawId || currentSurfaceId === s.id;
                            const isBridgeSurface = rawId === 'bridge';
                            const itemIntent = s.intent || 'highlight';
                            const itemColor = `var(--intent-${itemIntent})`;
                            return html`
                                <div class="drawer-nav-item ${isActive ? 'active' : ''}"
                                    style="--item-accent: ${itemColor};"
                                    @click=${() => BridgeStore.getState().setActiveSurface(rawId)}>
                                    <span style="display: flex; align-items: center; gap: 8px;">
                                        <yv-icon name=${s.icon || 'component'} style="width: 15px; height: 15px; color: ${itemColor}; opacity: ${isActive ? '1' : '0.75'};"></yv-icon>
                                        <span>${s.label}</span>
                                    </span>
                                    ${isBridgeSurface && this.cells.length > 0 ? html`
                                        <span class="drawer-badge" style="background: ${itemColor};">${this.cells.length}</span>
                                    ` : html`
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${itemColor}; opacity: ${isActive ? '1' : '0.35'};"></span>
                                    `}
                                </div>
                            `;
                        })}
                    </div>
                </div>

                <div class="yomama-stage">
                    ${currentSurfaceId === 'bridge'
                        ? this._renderBridgeSurface(groupedCells)
                        : surfaces.map(s => {
                            const rawId = s.rawId || s.id.split(':').pop();
                            if (rawId === 'bridge' || !s.component) return '';
                            const isVisible = currentSurfaceId === rawId || currentSurfaceId === s.id;
                            return html`
                                <div style="display: ${isVisible ? 'flex' : 'none'}; flex: 1; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                                    ${this._getOrMountNode(this._surfaceNodes, s.component)}
                                </div>
                            `;
                        })}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuBridgeDiffProjection extends InSetuElement {
    static properties = {
        caption: { type: String },
        diffContent: { type: String },
        searchStr: { type: String },
        replaceStr: { type: String },
        suggestedFilename: { type: String }
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
            <div style="height: 38px; padding: 0 10px; background: var(--bg-deep); border-bottom: 1px solid var(--border); display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-shrink: 0;">
                <sutram-entity-actions
                    .entityType=${'text_blob'}
                    .entityData=${{ textContent: rawPayload, suggestedFilename: filename }}>
                </sutram-entity-actions>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0;">
                <sutram-diff-viewer
                    .diffText=${this.diffContent}
                    .searchStr=${this.searchStr}
                    .replaceStr=${this.replaceStr}
                    leftTitle="Original"
                    rightTitle="Patch">
                </sutram-diff-viewer>
            </div>
        `;
    }
}
customElements.define('insetu-bridge-diff-projection', InSetuBridgeDiffProjection);

export class InSetuBridgeEditProjection extends InSetuElement {
    static properties = {
        editCellId: { type: String },
        editCellOriginalFile: { type: String },
        cells: { type: Array },
        _previewDiff: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
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
                this.requestUpdate();
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
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; height: 100%; width: 100%;">
                ${this._previewDiff ? html`
                    <sutram-diff-viewer
                        .searchStr=${searchStr}
                        .replaceStr=${replaceStr}
                        leftTitle="SEARCH Block"
                        rightTitle="REPLACE Block">
                    </sutram-diff-viewer>
                ` : html`
                    <insetu-editor-projection 
                        style="flex: 1; min-height: 0; height: 100%; width: 100%;"
                        .filepath=${`yomama://${this.editCellId}`} 
                        data-sub-id=${`yomama://${this.editCellId}`}>
                    </insetu-editor-projection>
                `}
            </div>
            <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; flex-wrap: wrap;">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <sutram-btn intent="danger" icon="x" label="Cancel" style="margin: 0;" @click=${() => {
                        if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                    }}></sutram-btn>
                    <sutram-btn intent="highlight" icon="${this._previewDiff ? 'edit-3' : 'columns'}" label="${this._previewDiff ? 'Raw Editor' : 'Diff View'}" style="margin: 0;" @click=${() => {
                        this._previewDiff = !this._previewDiff;
                    }}></sutram-btn>
                    <sutram-btn intent="warning" icon="refresh-cw" label="Swap S/R" style="margin: 0;" @click=${() => {
                        this.dispatch('insetu:bridge:cell-swap', { id: this.editCellId });
                    }}></sutram-btn>
                </div>
                ${total > 1 ? html`
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <sutram-btn size="sm" intent="neutral" icon="chevron-left" label="Prev" ?disabled=${currentIndex <= 0} @click=${() => this._navigateChunk(-1)}></sutram-btn>
                        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${currentIndex + 1} / ${total}</span>
                        <sutram-btn size="sm" intent="neutral" icon="chevron-right" label="Next" ?disabled=${currentIndex >= total - 1} @click=${() => this._navigateChunk(1)}></sutram-btn>
                    </div>
                ` : ''}
                <sutram-btn intent="success" icon="check" label="Save Patch" style="flex: 1; margin: 0;" @click=${() => {
                    this._commitCurrentBuffer();
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                }}></sutram-btn>
            </div>
        `;
    }
}
customElements.define('insetu-bridge-edit-projection', InSetuBridgeEditProjection);
export class InSetuExtBridgeActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        _pinnedRepos: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
    `];
    connectedCallback() {
        super.connectedCallback();
        this._pinnedRepos = window.inSetu.stores.App.getState().pinnedRepos;
        this.subscribe(
            window.inSetu.stores.App,
            state => state.pinnedRepos,
            (pinnedRepos) => {
                this._pinnedRepos = pinnedRepos;
                this.requestUpdate();
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
            <sutram-filter-dropdown .filterText=${btnText} .hasFilters=${hasF} style="height: 100%; display: flex; align-items: stretch;">
                <div style="min-width: 200px;">
                    <insetu-repo-filter
                        .repos=${this.ecosystem.allRepos}
                        .activeRepos=${Array.from(currentPins)}
                        @repo-filter-changed=${(e) => window.inSetu.stores.App.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                    </insetu-repo-filter>
                </div>
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
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; background: var(--bg); box-sizing: border-box; }
    `];

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
            <sutram-toolbar
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
            <sutram-scroll-view style="gap: 15px;">
                ${this.historyRecords.length === 0 ? html`<p style="color: var(--text-muted); font-style: italic; margin: 0;">No ledger receipts available.</p>` : ''}
                ${repoFilteredRecords.length === 0 && this.historyRecords.length > 0 ? html`<p style="color: var(--text-muted); font-style: italic; margin: 0;">No ledger receipts match criteria.</p>` : ''}

                ${this._viewMode === 'transaction' ? sortedTxs.slice(0, this._renderLimit).map(([txId, txData]) => {
                    const repos = Array.from(new Set(txData.records.map(r => r.repo || r.filepath?.split('/')[0]).filter(Boolean)));
                    const repoStr = repos.length > 0 ? ' in ' + repos.join(', ') : '';
                    const countStr = txData.records.length + (txData.records.length !== 1 ? ' files' : ' file') + ' modified' + repoStr;
                    return html`
                    <div style="padding-bottom: 15px; width: 100%; box-sizing: border-box;">
                        <sutram-card-group ?stacked=${true} ?accordion=${true}>
                            <sutram-card
                                .titleText=${"Tx: " + (txId || 'Unknown')}
                                .descriptionText=${countStr}
                                .detailText=${this.utils.timeAgo(txData.timestamp * 1000)}
                                icon="git-merge"
                                intent="highlight"
                                entityType="yomama-turn"
                                .entityData=${{ transaction_id: txId, records: txData.records }}
                                style="display: block;">
                            </sutram-card>
                            ${txData.records.map((record, idx) => {
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
                                    }}
                                    style="display: block;">
                                </sutram-card>
                                `;
                            })}
                        </sutram-card-group>
                    </div>
                    `;
                }) : sortedFiles.slice(0, this._renderLimit).map(([filepath, fileData]) => {
                    const filename = new window.inSetu.utils.InSetuURI(filepath).basename;
                    const repo = fileData.records[0]?.repo || '';
                    return html`
                    <div style="padding-bottom: 15px; width: 100%; box-sizing: border-box;">
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
                                }}
                                style="display: block;">
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
                                    }}
                                    style="display: block;">
                                </sutram-card>
                                `;
                            })}
                        </sutram-card-group>
                    </div>
                    `;
                })}
                ${((this._viewMode === 'transaction' && sortedTxs.length > this._renderLimit) || (this._viewMode !== 'transaction' && sortedFiles.length > this._renderLimit)) ? html`
                    <div id="history-sentinel" style="height: 20px; width: 100%;"></div>
                ` : ''}
            </sutram-scroll-view>
            <div style="padding: 12px 16px; gap: 10px; border-top: 2px solid color-mix(in srgb, var(--intent-success) 55%, var(--border)); background: color-mix(in srgb, var(--intent-success) 6%, var(--input-bg)); display: flex; align-items: stretch; justify-content: space-between; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                <sutram-btn
                    intent="success"
                    icon="history"
                    title="Toggle Yomama Menu (Active: Receipts)"
                    style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => BridgeStore.getState().toggleDrawer()}>
                </sutram-btn>
                <sutram-btn
                    intent="neutral"
                    icon=${isTx ? 'folder-kanban' : 'file-text'}
                    label=${isTx ? 'Group By File' : 'Group By Turn'}
                    style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => BridgeStore.setState({ historyViewMode: isTx ? 'file' : 'transaction' })}>
                </sutram-btn>
                <sutram-btn
                    intent="success"
                    icon="refresh-cw"
                    label="Refresh"
                    style="margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => BridgeStore.getState().fetchHistory()}>
                </sutram-btn>
            </div>
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
