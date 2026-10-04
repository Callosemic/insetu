import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
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

export const BridgeStore = createExtensionStore('Bridge', {
    cells: [],
    activeBridgeJobId: null,
    viewMode: 'input',
    consoleOutput: 'Ready...',
    telemetry: null,
    historyRecords: [],
    historyViewMode: 'transaction',
    parseAndAppendCells: (text) => {
        const val = text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
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
                currentFile = line.substring(13).trim();
                isInsideChunk = false;
                chunkLines = [];
                fileRawLines = [];
                foundChunksInFile = false;
                continue;
            }

            if (currentFile && !isInsideChunk) {
                fileRawLines.push(line);
            }
            if (trimmed === '<<<<<<< COMMENT' || trimmed === '<<<<<<< SEARCH') {
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
                if (trimmed === '>>>>>>> REPLACE') {
                    isReplace = true;
                } else if (trimmed.endsWith('REPLACE')) {
                    const prefix = trimmed.slice(0, -7).replace(/\s+/g, '');
                    if (prefix.length > 0 && prefix.split('').every(c => c === '>')) {
                        isReplace = true;
                    }
                }

                if (isReplace) {
                    chunkLines.push('>>>>>>> REPLACE');
                    if (currentFile) {
                        newCells.push({
                            id: `cell_${Date.now()}_${cellIdx++}`,
                            file: currentFile,
                            content: chunkLines.join('\n'),
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
            BridgeStore.setState(state => ({ cells: [...state.cells, ...newCells] }));
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
    clearPayload: () => {
        BridgeStore.setState({ 
            cells: [], 
            activeBridgeJobId: null,
            viewMode: 'input',
            consoleOutput: 'Ready...',
            telemetry: null
        });
    },
    setViewMode: (mode) => BridgeStore.setState({ viewMode: mode }),
    setConsoleOutput: (out) => BridgeStore.setState({ consoleOutput: out }),
    setTelemetry: (tel) => BridgeStore.setState({ telemetry: tel }),
    fetchHistory: async () => {
        try {
            const res = await window.inSetu.api.workspace.get('bridge/history');
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
});
window.inSetu.stores.Bridge = BridgeStore;
export class InSetuExtBridge extends InSetuElement {
    static properties = {
        cells: { type: Array },
        consoleOutput: { type: String },
        viewMode: { type: String },
        telemetry: { type: Object },
        _fileVerificationCache: { type: Object },
        _editCellId: { type: String },
        _editContent: { type: String },
        _editCellOriginalFile: { type: String },
        _autoSwaps: { type: Object },
        _syntaxErrorDiff: { type: String }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }
            .bridge-group-container {
                padding: 15px 20px;
                display: flex;
                flex-direction: column;
                border-bottom: 1px solid var(--border);
            }
            @container (max-width: 480px) {
                .bridge-group-container {
                    padding: 0;
                }
            }
            .btn-sm { margin: 0; padding: 8px 14px; font-size: 14px; }
        `
    ];
    constructor() {
        super();
        this.cells = [];
        this.consoleOutput = 'Ready...';
        this.viewMode = 'input';
        this._fileVerificationCache = {};
        this._globalBypassSandwich = false;
        this._editCellId = null;
        this._editContent = '';
        this._editCellOriginalFile = '';
        this._headerTouchStartX = null;
        this._headerTouchStartY = null;
        this._autoSwaps = {};
        this._rejectedAutoSwaps = new Set();
        this._syntaxErrorDiff = null;
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
            if (this._fileVerificationCache[file] === false && !this._rejectedAutoSwaps.has(file)) {
                const cleanFile = file.replace(/\s*\(\d+\)(?=\.[^.\/]+$|$)/, '').trim();
                const cleanFileLower = cleanFile.toLowerCase();
                const basename = cleanFile.split('/').pop().toLowerCase();

                let cands = mFiles.filter(f => f.toLowerCase().endsWith(cleanFileLower));
                if (cands.length === 0) {
                    cands = mFiles.filter(f => f.toLowerCase().endsWith('/' + basename) || f.toLowerCase() === basename);
                }

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
        BridgeStore.setState({ cells: [], activeBridgeJobId: null, telemetry: null, consoleOutput: 'Ready...' });
        window.inSetu.stores.Fs?.setState({ fileVerificationCache: {} });
        BridgeStore.getState().fetchHistory();
        this.requestUpdate();
    }
    onViewActivated() {
        BridgeStore.getState().fetchHistory();
        this.requestUpdate();
    }
    onForceRefresh() {
        BridgeStore.getState().fetchHistory();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(BridgeStore, (state) => {
            this.cells = state.cells || [];
            this.consoleOutput = state.consoleOutput;
            this.viewMode = state.viewMode;
            this.telemetry = state.telemetry;
            window.inSetu.stores.Fs?.getState()?.verifyFiles(this.cells.map(c => c.file));
            this._evaluateAutoSwaps();
        });
        this.subscribe('Fs', (state) => {
            this._fileVerificationCache = state.fileVerificationCache || {};
            this._evaluateAutoSwaps();
        });
        // Event listeners for Yomama Actions
        this.registerGlobalListener('insetu:bridge:cell-deleted', window, (e) => {
            if (this._editCellId === e.detail.id) {
                this._editCellId = null;
                this.requestUpdate();
            }
        });
        this.registerGlobalListener('insetu:bridge:cell-swap', window, (e) => this._handleSwap(e.detail.id));

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
                        const newFile = fileMatch ? fileMatch[1].trim() : this._editCellOriginalFile;
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
    _handleSwap(id) {
        let textToSwap = this.cells.find(c => c.id === id)?.content;
        if (this._editCellId === id) {
            const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${id}`];
            if (buffer) textToSwap = buffer.content;
            else textToSwap = this._editContent;
        }
        if (!textToSwap) return;

        // Strict multiline matching: anchors to the start of the line to bypass inline '=======' in code strings
        const blockRegex = /^(<<<<<<< SEARCH)[ \t]*\r?\n([\s\S]*?)^(=======)[ \t]*\r?\n([\s\S]*?)^(>>>>>>> REPLACE)/m;
        const match = textToSwap.match(blockRegex);

        if (match) {
            const before = textToSwap.substring(0, match.index);
            const searchBlock = match[2];
            const replaceBlock = match[4];
            const after = textToSwap.substring(match.index + match[0].length);

            const swappedChunk = `${before}<<<<<<< SEARCH\n${replaceBlock}=======\n${searchBlock}>>>>>>> REPLACE${after}`;

            if (this._editCellId === id) {
                this._editContent = swappedChunk;
                window.inSetu.stores.Fs?.getState()?.updateBuffer(`yomama://${id}`, { content: swappedChunk });
                this.requestUpdate();
            } else {
                BridgeStore.getState().updateCellContent(id, swappedChunk.trim());
            }
        } else {
            alert("Could not cleanly parse SEARCH/REPLACE blocks to swap. Ensure '=======' is on its own line.");
        }
    }
    _openEditorModal(cell) {
        this._editCellId = cell.id;
        this._editCellOriginalFile = cell.file;
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
    }
    _navigateChunk(direction) {
        if (!this._editCellId) return;

        // Auto-save current edits before navigating away
        const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${this._editCellId}`];
        const text = buffer ? buffer.content : this._editContent;
        const fileMatch = text.match(/^<<<<<<< FILE:\s*(.+)$/m);
        const newFile = fileMatch ? fileMatch[1].trim() : this._editCellOriginalFile;
        const rawContent = text.replace(/^<<<<<<< FILE:.*\n?/m, '').trim();
        BridgeStore.getState().updateCellFile(this._editCellId, newFile);
        BridgeStore.getState().updateCellContent(this._editCellId, rawContent);
        // Find and open the next chunk in the entire payload
        const allCells = this.cells;
        if (allCells.length <= 1) return;

        const currentIndex = allCells.findIndex(c => c.id === this._editCellId);
        let newIndex = currentIndex + direction;

        // Prevent wrapping at the boundaries
        if (newIndex < 0 || newIndex >= allCells.length) return;

        this._openEditorModal(allCells[newIndex]);
    }

    _handleHeaderTouchStart(e) {
        this._headerTouchStartX = e.changedTouches[0].clientX;
        this._headerTouchStartY = e.changedTouches[0].clientY;
    }

    _handleHeaderTouchEnd(e) {
        if (this._headerTouchStartX === null) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = this._headerTouchStartX - endX;
        const deltaY = Math.abs(this._headerTouchStartY - endY);

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
            if (deltaX > 0) this._navigateChunk(1);
            else this._navigateChunk(-1);
        }
        this._headerTouchStartX = null;
        this._headerTouchStartY = null;
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
    _saveEditModal() {
        const text = this._editContent;
        const fileMatch = text.match(/^<<<<<<< FILE:\s*(.+)$/m);
        const newFile = fileMatch ? fileMatch[1].trim() : this._editCellOriginalFile;

        const rawContent = text.replace(/^<<<<<<< FILE:.*\n?/m, '').trim();

        BridgeStore.getState().updateCellFile(this._editCellId, newFile);
        BridgeStore.getState().updateCellContent(this._editCellId, rawContent);
        this._editCellId = null;
    }
    _getSyncAction(dryRunActive, bypassSandwich = false, overridePayload = {}) {
        return async (e) => {
            if (bypassSandwich) this._globalBypassSandwich = true;
            this._lastDryRun = dryRunActive;
            const textVal = BridgeStore.getState().getCompiledPayload();
            BridgeStore.setState({ viewMode: 'console', consoleOutput: "Dispatching transaction to the Bridge...", telemetry: null });
            const activeFiles = BridgeStore.getState().getActiveFiles();

            const action = this.api.bindJobAction('sync', {
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                pinned_repos: Array.from(this.ecosystem.pinnedRepos),
                confirmed_candidates: this._confirmedCandidates || {},
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

                        // State Parity: Auto-sync frontend paths with backend fuzzy resolutions
                        if (tel.patches) {
                            tel.patches.forEach(p => {
                                if (p.cell_id && p.resolved_file && p.original_file !== p.resolved_file) {
                                    BridgeStore.getState().updateCellFile(p.cell_id, p.resolved_file);
                                }
                            });
                        }

                        if (tel.can_commit && tel.mode === 'live') {
                            // Extract the true OS-resolved paths from the telemetry payload
                            const safePatches = tel.patches || [];
                            const resolvedFiles = Array.from(new Set(safePatches.map(p => p.resolved_file).filter(Boolean)));
                            BridgeStore.setState({ cells: [] });

                            // The backend Event Bus natively handles RAG RAG compilation and RAG RAG diffs via the Topology Slew Limiter.
                            // We only need to refresh the ledger UI history locally.
                            BridgeStore.getState().fetchHistory();
                        }
                    } else {
                        BridgeStore.setState({ consoleOutput: statusData.message || "Unknown error" });
                    }
                },
                onError: (err) => {
                    BridgeStore.setState({ activeBridgeJobId: null, consoleOutput: `<span style="color: var(--intent-danger); font-weight: bold;">[!] ${err.message}</span>` });
                }
            });
            await action(e);
        };
    }
    _handleConsoleClick(e) {
        const path = e.composedPath ? e.composedPath() : [e.target];
        const btn = path.find(el => el && el.dataset && el.dataset.action);
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'update-path' || action === 'confirm-candidate') {
            const oldPath = btn.dataset.old;
            const newPath = btn.dataset.new;
            const cellId = btn.dataset.cellId;
            const cells = BridgeStore.getState().cells;

            if (cellId) {
                const targetCell = cells.find(c => c.id === cellId);
                if (targetCell && oldPath !== newPath) {
                    BridgeStore.getState().updateCellFile(targetCell.id, newPath);
                }
            } else {
                const target = cells.find(c => c.file === oldPath || c.file.endsWith(oldPath) || oldPath.endsWith(c.file));
                if (target && oldPath !== newPath) BridgeStore.getState().updateGroupFile(target.file, newPath);
            }

            // We explicitly do NOT populate _confirmedCandidates with oldPath -> newPath here.
            // Updating the cell file directly in the store ensures getCompiledPayload() 
            // sends the correct target_file to the backend natively, preventing cross-contamination 
            // of other patches that share the same oldPath.
            this._confirmedCandidates = this._confirmedCandidates || {};

            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich, {
                confirmed_candidates: this._confirmedCandidates
            })();
        } else if (action === 'view-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            this._syntaxErrorDiff = decodedDiff;
            this.requestUpdate();
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
                this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich)();
            }
        } else if (action === 'deselect-this-patch') {
            const cellId = btn.dataset.cellId;
            BridgeStore.getState().toggleCellActive(cellId);
            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich)();
        } else if (action === 'deselect-all-file-patches' || action === 'deselect-patch') {
            const oldPath = btn.dataset.old;
            const resolvedPath = btn.dataset.resolved;
            this._deselectAllFilePatches(oldPath, resolvedPath);
            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich)();
        } else if (action === 'deep-search') {
            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich, { allow_deep_search: true })();
        }
    }
    _renderTelemetry() {
        const t = this.telemetry;
        if (!t) return html`<div id="status-box" style="width: 100%; font-family: var(--font-mono); white-space: pre-wrap; color: var(--text);" .innerHTML=${this.consoleOutput}></div>`;

        return html`
            <div style="width: 100%; display: flex; flex-direction: column;">
                <h3 style="color: ${t.can_commit ? 'var(--intent-success)' : 'var(--intent-warning)'}; margin-top: 0;">
                    ${t.can_commit ? (t.mode === 'live' ? '✅ Transaction Committed' : '✅ Dry Run Verified') : '⚠️ Action Required'}
                </h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">
                    Total: ${t.summary?.total_patches || 0} | Resolved: ${t.summary?.resolved || 0} | Skipped: ${t.summary?.auto_skipped || 0} | Failed: ${t.summary?.failed || 0}
                </p>
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

                            let intentColor = 'var(--intent-success)';
                            let icon = '✅';
                            if (hasError) { intentColor = 'var(--intent-danger)'; icon = '❌'; }
                            else if (hasWarning) { intentColor = 'var(--intent-warning)'; icon = '⚠️'; }
                            else if (isSkipped) { intentColor = 'var(--intent-neutral)'; icon = '⏭️'; }

                            const targetEntityFile = file;
                            return html`
                                <insetu-card 
                                    titleText="${icon} ${file}" 
                                    detailText="${filePatches.length} Patch${filePatches.length !== 1 ? 'es' : ''}" 
                                    intentColor="${intentColor}"
                                    entityType="file"
                                    .entityData=${{ filepath: targetEntityFile, isFS: true, suppress: ['file-browse'] }}>

                                    <div style="padding: 2px 0; font-size: 0.9rem; color: var(--text);">
                                        ${filePatches.map((p) => {
                                            const origFile = p.original_file;
                                            const origFileIdx = origFileCounters[origFile] || 0;
                                            origFileCounters[origFile] = origFileIdx + 1;

                                            return html`
                                            <div style="border-bottom: ${origFileIdx < filePatches.length - 1 ? '1px solid var(--border)' : 'none'}; padding-bottom: ${origFileIdx < filePatches.length - 1 ? '12px' : '0'}; margin-bottom: ${origFileIdx < filePatches.length - 1 ? '12px' : '0'};">
                                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                                    <p style="margin: 0; font-weight: bold; color: var(--text-muted);">Patch #${(p.patch_index || 0) + 1}: <span style="color: var(--text);">${(p.status || 'unknown').replace('_', ' ')}</span></p>
                                                    ${p.flags && p.flags.length > 0 ? html`
                                                        <span style="font-size: 0.75rem; color: var(--intent-highlight); border: 1px solid var(--intent-highlight); padding: 2px 6px; border-radius: 4px;">${p.flags.join(', ')}</span>
                                                    ` : ''}
                                                </div>

                                                ${p.error_message ? html`<p style="color: ${p.status === 'auto_skipped' ? 'var(--intent-warning)' : 'var(--intent-danger)'}; margin: 6px 0 0 0;">${p.error_message}</p>` : ''}
                                                ${p.syntax_error ? html`
                                                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                                                        <sutram-btn data-action="view-diff" data-b64="${p.syntax_error}" intent="danger" style="--btn-padding: 4px 10px;">👁️ View Syntax Error Diff</sutram-btn>
                                                    </div>
                                                ` : ''}
                                                ${p.candidates && p.candidates.length > 0 ? html`
                                                    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                                                        ${p.candidates.map(c => {
                                                            const btnLabel = p.flags?.includes('confirm-to-overwrite') || c.match_type === 'overwrite' ? 'Confirm Overwrite' : 'Confirm Match';
                                                            return html`
                                                                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                                                                    <span style="font-family: monospace;">${c.filepath}${c.score ? `(Score: ${c.score})` : ''}</span>
                                                                    <sutram-btn data-action="confirm-candidate" data-old="${p.original_file}" data-new="${c.filepath}" data-cell-id="${p.cell_id}" intent="primary" style="--btn-padding: 4px 10px;">${btnLabel}</sutram-btn>
                                                                </div>
                                                            `;
                                                        })}
                                                    </div>
                                                ` : ''}
                                                <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; align-items: center;">
                                                    ${p.available_actions?.includes('offer_deep_search') ? html`
                                                        <sutram-btn data-action="deep-search" intent="highlight" style="--btn-padding: 4px 10px;">🔍 Run Deep Search</sutram-btn>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('heal_anchor') ? html`
                                                        <sutram-btn data-action="heal-anchor" data-old="${p.original_file}" data-cell-id="${p.cell_id}" data-anchor="${p.actual_anchor}" intent="success" style="--btn-padding: 4px 10px;">🩹 Auto-Heal Anchor</sutram-btn>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('ignore_syntax_error') ? html`
                                                        <sutram-btn data-action="ignore-syntax" intent="danger" style="--btn-padding: 4px 10px;">⚠️ Ignore Syntax & Commit</sutram-btn>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('deselect_patch') ? html`
                                                        <div style="display: flex; align-items: center; gap: 6px;">
                                                            <sutram-btn data-action="deselect-this-patch" data-old="${p.original_file}" data-resolved="${p.resolved_file || ''}" data-cell-id="${p.cell_id}" intent="neutral" style="--btn-padding: 4px 10px;">Deselect Patch</sutram-btn>
                                                            <sutram-btn data-action="deselect-all-file-patches" data-old="${p.original_file}" data-resolved="${p.resolved_file || ''}" intent="neutral" style="--btn-padding: 4px 10px;">Deselect All File Patches</sutram-btn>
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        `;
                                        })}
                                    </div>
                                </insetu-card>
                            `;
                        });
                    })()}
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

        return html`
            <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden; background: var(--bg); height: 100%;">
                <!-- INPUT VIEW -->
                <div style="display: ${this.viewMode === 'input' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; padding: 0; background: var(--bg);" @paste=${e => {
                    const text = e.clipboardData.getData('text');
                    if (text && text.includes('<<<<<<< FILE:')) { e.preventDefault(); BridgeStore.getState().parseAndAppendCells(text); }
                }}>
                    ${this.cells.length === 0 ? html`
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed var(--border); border-radius: 8px; background: var(--input-bg); min-height: 300px; position: relative; margin: 20px;"
                            @dragover=${e => e.preventDefault()}
                            @drop=${async e => {
                                e.preventDefault();
                                const text = e.dataTransfer.getData('text');
                                if (text) BridgeStore.getState().parseAndAppendCells(text);
                            }}>
                            <div style="font-size: 3rem; margin-bottom: 10px;">🌉</div>
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
                                    <insetu-card
                                        .titleText=${"Target File:"}
                                        .descriptionText=${this._fileVerificationCache[file] === false ? "⚠️ Target file not found in workspace." : ""}
                                        .detailText=${""}
                                        icon='<i data-lucide="file-code-2" style="width: 14px; height: 14px;"></i>'
                                        intentColor=${this._fileVerificationCache[file] === false ? 'var(--intent-danger)' : '#06b6d4'}
                                        entityType="file"
                                        .entityData=${{ filepath: file, isFS: true, suppress: ['file-browse'] }}
                                        selectionStoreKey="none"
                                        ?selected=${selectedCount > 0}
                                        @sutram-card-select-toggled=${(e) => { e.stopPropagation(); this._handleParentToggle(file); }}
                                        style="display: block;">
                                        <div slot="header-actions">
                                            <sutram-btn intent="highlight" style="--btn-padding: 4px 10px; margin: 0;" @click=${(e) => {
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
                                            }}>📁 Remap</sutram-btn>
                                        </div>

                                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 5px;">
                                            <sutram-input ?flush=${true} .value=${file} style="width: 100\%; margin: 0; --bg-input: var(--bg);" @sutram-input-changed=${(e) => {
                                                BridgeStore.getState().updateGroupFile(file, e.detail.value);
                                                window.inSetu.stores.Fs?.getState()?.verifyFiles([e.detail.value], true);
                                            }}></sutram-input>

                                            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--intent-highlight);">
                                                ${selectedCount} of${totalCount} patches selected
                                            </div>
                                        </div>
                                        ${this._autoSwaps[file] ? html`
                                            <div style="font-size: 0.8rem; color: var(--intent-success); margin-top: 10px; font-weight: bold; display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px dashed var(--border);">
                                                <span>✨ Auto-mapped from: <span style="font-family: monospace; opacity: 0.8;">${this._autoSwaps[file]}</span></span>
                                                <sutram-btn variant="tinted" intent="neutral" style="--btn-padding: 2px 8px; margin: 0;" @click=${(e) => {
                                                    e.stopPropagation();
                                                    const original = this._autoSwaps[file];
                                                    this._rejectedAutoSwaps.add(original);
                                                    const newSwaps = { ...this._autoSwaps };
                                                    delete newSwaps[file];
                                                    this._autoSwaps = newSwaps;
                                                    BridgeStore.getState().updateGroupFile(file, original);
                                                    window.inSetu.stores.Fs?.getState()?.verifyFiles([original], true);
                                                }}>Undo</sutram-btn>
                                            </div>
                                        ` : ''}
                                        ${this._fileVerificationCache[file] === false ? (() => {
                                            let cands = [];
                                            if (this.vfs && this.vfs.getGlobalManifest) {
                                                const mFiles = this.vfs.getGlobalManifest().filter(f => !f.endsWith('.gitkeep'));

                                                // Strip OS attachment duplicate suffixes like " (1)", " (2)"
                                                const cleanFile = file.replace(/\s*\(\d+\)(?=\.[^.\/]+$|$)/, '').trim();
                                                const cleanFileLower = cleanFile.toLowerCase();
                                                const basename = cleanFile.split('/').pop().toLowerCase();

                                                // 1. Try matching the exact fragment (e.g. "c/file.py" matches "a/b/c/file.py")
                                                cands = mFiles.filter(f => f.toLowerCase().endsWith(cleanFileLower));

                                                // 2. Fall back to matching the exact basename
                                                if (cands.length === 0) {
                                                    cands = mFiles.filter(f => f.toLowerCase().endsWith('/' + basename) || f.toLowerCase() === basename);
                                                }
                                            }
                                            if (cands.length > 0) {
                                                return html`
                                                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); display: flex; flex-direction: column; gap: 6px;">
                                                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold;">Suggested Matches:</span>
                                                        ${cands.map(c => html`
                                                            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border);">
                                                                <span style="font-family: monospace; font-size: 0.8rem; color: var(--text); word-break: break-all;">${c}</span>
                                                                <sutram-btn intent="success" style="--btn-padding: 4px 8px; margin: 0;" @click=${(e) => {
                                                                    e.stopPropagation();
                                                                    BridgeStore.getState().updateGroupFile(file, c);
                                                                    window.inSetu.stores.Fs?.getState()?.verifyFiles([c], true);
                                                                }}>Swap</sutram-btn>
                                                            </div>
                                                        `)}
                                                    </div>
                                                `;
                                            }
                                            return '';
                                        })() : ''}
                                    </insetu-card>
                                    <!-- Patches (Subsequent Stacked Chunks) -->
                                    ${groupCells.map((c, i) => {
                                        const isGenesis = !!c.content.match(/<<<<<<< SEARCH\s*=======/);
                                        const typeStr = isGenesis ? "Type: Create File" : "Type: Search & Replace";
                                        let commentText = "";
                                        const commentMatch = c.content.match(/<<<<<<< COMMENT\r?\n([\s\S]*?)\r?\n<<<<<<< SEARCH/);
                                        if (commentMatch && commentMatch[1]) {
                                            commentText = commentMatch[1].trim();
                                        }
                                        const descStr = commentText ? `${i + 1} of ${groupCells.length} • "${commentText}"` : `${i + 1} of${groupCells.length}`;

                                        return html`
                                        <insetu-card
                                            .titleText=${typeStr}
                                            .descriptionText=${descStr}
                                            icon='<i data-lucide="git-commit" style="width: 14px; height: 14px;"></i>'
                                            ?selected=${c.active}
                                            intentColor=${c.active ? "var(--intent-success)" : "var(--intent-neutral)"}
                                            selectionStoreKey="none"
                                            entityType="yomama"
                                            .entityData=${{...c, suppress: ['yomama-swap']}}
                                            @sutram-card-select-toggled=${(e) => BridgeStore.getState().toggleCellActive(c.id)}
                                            @card-clicked=${() => this._openEditorModal(c)}>
                                        </insetu-card>
                                    `})}
                                </sutram-card-group>
                            </div>
                        `;})}
                    `}
                </div>
                <!-- CONSOLE VIEW -->
                <div style="display: ${this.viewMode === 'console' ? 'flex' : 'none'}; flex: 1; flex-direction: column; min-height: 0; padding: 20px; box-sizing: border-box; overflow-y: auto; background: var(--bg);">
                    <div @click=${this._handleConsoleClick} style="display: flex; flex-direction: column; width: 100%; padding-bottom: 20px;">
                        ${this._renderTelemetry()}
                    </div>
                </div>
                <!-- FOOTER -->
                <div style="padding: 12px 20px; gap: 12px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                    ${this.cells.length === 0 && this.viewMode === 'input' ? html`
                        <sutram-btn intent="primary" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-font-size: 0.95rem; width: 100%;" @click=${async () => {
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
                        }}>📋 Paste from Clipboard</sutram-btn>
                    ` : this.viewMode === 'input' ? html`
                        <sutram-btn intent="danger" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-font-size: 0.95rem; width: 100%;" @click=${() => BridgeStore.getState().clearPayload()}>🗑️ Clear</sutram-btn>
                        <sutram-async-btn label="🧪 Test" intent="warning" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-border-radius: 6px; --btn-font-size: 0.95rem; width: 100%; color: #000;" .onClick=${this._getSyncAction(true)}></sutram-async-btn>
                        <sutram-async-btn label="⚡ Patch" intent="success" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-border-radius: 6px; --btn-font-size: 0.95rem; width: 100%; color: white;" .onClick=${this._getSyncAction(false)}></sutram-async-btn>
                    ` : html`
                        <sutram-btn intent="neutral" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-font-size: 0.95rem; width: 100%;" @click=${() => BridgeStore.setState({ viewMode: 'input' })}>🔙 Back to Edit</sutram-btn>
                        ${this.telemetry && this.telemetry.can_commit && this.telemetry.mode !== 'live' ? html`
                            <sutram-async-btn label="⚡ Apply Patch" intent="success" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-border-radius: 6px; --btn-font-size: 0.95rem; width: 100%; color: white;" .onClick=${this._getSyncAction(false, true, { force: true, ignore_syntax_errors: true, confirmed_candidates: Object.fromEntries(BridgeStore.getState().getActiveFiles().map(f => [f, f])) })}></sutram-async-btn>
                        ` : ''}
                    `}
                </div>
            </div>

            <sutram-modal 
                ?open=${!!this._editCellId} 
                ?fullscreen=${true} 
                titleText=${this._editCellId ? `Edit Patch: ${this._editCellOriginalFile.split('/').pop()}` : ''}
                @sutram-modal-closed=${() => this._editCellId = null}>

                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 0;">
                    ${this._editCellId ? html`
                        <insetu-editor-projection 
                            .filepath=${`yomama://${this._editCellId}`} 
                            data-sub-id=${`yomama://${this._editCellId}`}>
                        </insetu-editor-projection>
                    ` : ''}
                </div>
                <div slot="footer" style="display: flex; width: 100%; justify-content: space-between;">
                    <sutram-btn intent="danger" style="margin: 0;" @click=${() => this._editCellId = null}>Cancel</sutram-btn>
                    <sutram-btn intent="success" style="margin: 0;" @click=${() => {
                        const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${this._editCellId}`];
                        if (buffer) {
                            this._editContent = buffer.content;
                            this._saveEditModal();
                        }
                    }}>💾 Save Patch</sutram-btn>
                </div>
            </sutram-modal>

            <sutram-modal 
                ?open=${!!this._syntaxErrorDiff} 
                ?fullscreen=${true} 
                titleText="Syntax Error Diff"
                @sutram-modal-closed=${() => this._syntaxErrorDiff = null}>

                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 0;">
                    ${this._syntaxErrorDiff ? html`
                        <sutram-textarea 
                            readonly 
                            style="width: 100%; height: 100%; font-family: var(--font-mono); font-size: 0.85rem; background: var(--input-bg); color: var(--text); border: none; margin: 0; --bg-input: var(--input-bg);" 
                            .value=${this._syntaxErrorDiff}>
                        </sutram-textarea>
                    ` : ''}
                </div>
                <div slot="footer" style="display: flex; width: 100%; justify-content: flex-end;">
                    <sutram-btn intent="neutral" style="margin: 0;" @click=${() => this._syntaxErrorDiff = null}>Close</sutram-btn>
                </div>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuExtBridgeHistoryActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = { _viewMode: { type: String } };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
        .system-action-btn {
            width: 44px !important; height: auto !important; align-self: stretch !important; flex-shrink: 0 !important;
            border-radius: 0 !important; border: none !important; border-left: 1px solid var(--border) !important;
            background: var(--rail-bg, rgba(255,255,255,0.02)) !important; display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s ease, color 0.15s ease; color: var(--text-muted) !important;
            margin: 0 !important; padding: 0 !important; box-sizing: border-box;
        }
        .system-action-btn:hover {
            background: var(--rail-hover, rgba(99, 102, 241, 0.22)) !important; color: var(--text) !important;
        }
    `];

    constructor() {
        super();
        this._viewMode = 'transaction';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(BridgeStore, state => {
            this._viewMode = state.historyViewMode || 'transaction';
        });
    }
    render() {
        const isTx = this._viewMode === 'transaction';
        return html`
            <button 
                class="system-action-btn"
                @click=${() => BridgeStore.setState({ historyViewMode: isTx ? 'file' : 'transaction' })}
                title="${isTx ? 'Switch to By File view' : 'Switch to By Turn view'}">
                ${isTx ? '🗂️' : '📄'}
            </button>
        `;
    }
}
customElements.define('insetu-ext-bridge-history-actions', InSetuExtBridgeHistoryActions);
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
        this.subscribe(window.inSetu.stores.App, (state) => {
            this._pinnedRepos = state.pinnedRepos;
            this.requestUpdate();
        });
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
customElements.define('insetu-ext-bridge-actions', InSetuExtBridgeActions);
export class InSetuExtBridgeHistory extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        historyRecords: { type: Array },
        searchQuery: { type: String },
        _viewMode: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; background: var(--bg); box-sizing: border-box; }
        .history-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; width: 100%; box-sizing: border-box; }
    `];

    constructor() {
        super();
        this.historyRecords = [];
        this.searchQuery = '';
        this._viewMode = 'transaction';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(BridgeStore, state => {
            this.historyRecords = state.historyRecords || [];
            this._viewMode = state.historyViewMode || 'transaction';
        });
        BridgeStore.getState().fetchHistory();
    }

    render() {
        const filteredRecords = this.searchQuery
            ? this.utils.fuzzyFilterObjects(this.historyRecords, this.searchQuery, r => `${r.filepath} ${r.transaction_id} ${r.post_patch_hash}`)
            : this.historyRecords;

        const activeRepos = this.ecosystem.pinnedRepos;
        const repoFilteredRecords = filteredRecords.filter(r => {
            if (activeRepos.has('ALL')) return true;
            return activeRepos.has(r.repo) || activeRepos.has(r.filepath?.split('/')[0]);
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
                    label="📌 Repos:"
                    .repos=${this.ecosystem.allRepos}
                    .activeRepos=${Array.from(this.ecosystem.pinnedRepos)}
                    @repo-filter-changed=${(e) => window.inSetu.stores.App.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                </insetu-repo-filter>
            </sutram-toolbar>

            <div class="history-body">
                ${this.historyRecords.length === 0 ? html`<p style="color: var(--text-muted); font-style: italic;">No ledger receipts available.</p>` : ''}
                ${repoFilteredRecords.length === 0 && this.historyRecords.length > 0 ? html`<p style="color: var(--text-muted); font-style: italic;">No ledger receipts match criteria.</p>` : ''}
                ${this._viewMode === 'transaction' ? sortedTxs.map(([txId, txData]) => {
                    const repos = Array.from(new Set(txData.records.map(r => r.repo || r.filepath?.split('/')[0]).filter(Boolean)));
                    const repoStr = repos.length > 0 ? ' in ' + repos.join(', ') : '';
                    const countStr = txData.records.length + (txData.records.length !== 1 ? ' files' : ' file') + ' modified' + repoStr;
                    return html`
                    <sutram-card-group ?stacked=${true} ?accordion=${true}>
                        <insetu-card
                            .titleText=${"Tx: " + (txId || 'Unknown')}
                            .descriptionText=${countStr}
                            .detailText=${this.utils.timeAgo(txData.timestamp * 1000)}
                            icon='<i data-lucide="git-merge" style="width: 14px; height: 14px;"></i>'
                            intentColor="var(--intent-highlight)"
                            entityType="yomama-turn"
                            .entityData=${{ transaction_id: txId, records: txData.records }}
                            style="display: block;">
                        </insetu-card>
                        ${txData.records.map((record, idx) => {
                            let chunks = record.chunks || record.patches;
                            if (!chunks && record.chunks_json) {
                                try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                            }
                            const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                            const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                            let descStr = patchStr + (record.is_snapshot ? ' • 💾 Snapshot' : '');

                            if (Array.isArray(chunks) && chunks.length > 0 && chunks[0].comment) {
                                descStr = `💬 ${chunks[0].comment}`;
                            }
                            return html`
                            <insetu-card
                                .titleText=${record.filepath.split('/').pop()}
                                .descriptionText=${descStr}
                                .detailText=${record.filepath}
                                icon=${record.is_snapshot ? '<i data-lucide="save" style="width: 14px; height: 14px;"></i>' : '<i data-lucide="file-text" style="width: 14px; height: 14px;"></i>'}
                                intentColor=${record.is_snapshot ? 'var(--intent-highlight)' : 'var(--intent-neutral)'}
                                entityType="patch-receipt"
                                .entityData=${record}
                                @card-clicked=${() => {
                                    if (window.inSetu.vfs.viewSourceFile) {
                                        window.inSetu.vfs.viewSourceFile(record.filepath, true);
                                    }
                                }}
                                style="display: block;">
                            </insetu-card>
                            `;
                        })}
                    </sutram-card-group>
                    `;
                }) : sortedFiles.map(([filepath, fileData]) => {
                    const filename = filepath.split('/').pop();
                    const repo = fileData.records[0]?.repo || '';
                    return html`
                    <sutram-card-group ?stacked=${true} ?accordion=${true}>
                        <insetu-card
                            .titleText=${filename}
                            .descriptionText=${repo ? "Repo: " + repo : ""}
                            .detailText=${filepath}
                            icon='<i data-lucide="file-code-2" style="width: 14px; height: 14px;"></i>'
                            intentColor="#06b6d4"
                            entityType="file"
                            .entityData=${{ filepath: filepath, isFS: true, suppress: ['file-browse'] }}
                            @card-clicked=${() => {
                                if (window.inSetu.vfs.viewSourceFile) {
                                    window.inSetu.vfs.viewSourceFile(filepath, true);
                                }
                            }}
                            style="display: block;">
                        </insetu-card>
                        ${fileData.records.map((record, idx) => {
                            let chunks = record.chunks || record.patches;
                            if (!chunks && record.chunks_json) {
                                try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                            }
                            const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                            const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                            let descStr = patchStr + (record.is_snapshot ? ' • 💾 Snapshot' : '');

                            if (Array.isArray(chunks) && chunks.length > 0 && chunks[0].comment) {
                                descStr = `💬 ${chunks[0].comment}`;
                            }
                            return html`
                            <insetu-card
                                .titleText=${"Tx: " + (record.transaction_id || 'Unknown')}
                                .descriptionText=${descStr}
                                .detailText=${`Turn ${idx + 1} of ${fileData.records.length} • ${this.utils.timeAgo(record.timestamp * 1000)}`}
                                icon=${record.is_snapshot ? '<i data-lucide="save" style="width: 14px; height: 14px;"></i>' : '<i data-lucide="git-commit" style="width: 14px; height: 14px;"></i>'}
                                intentColor=${record.is_snapshot ? 'var(--intent-highlight)' : 'var(--intent-neutral)'}
                                entityType="patch-receipt"
                                .entityData=${record}
                                @card-clicked=${() => {
                                    if (window.inSetu.vfs.viewSourceFile) {
                                        window.inSetu.vfs.viewSourceFile(record.filepath, true);
                                    }
                                }}
                                style="display: block;">
                            </insetu-card>
                            `;
                        })}
                    </sutram-card-group>
                `;})}
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
            icon: '⏪',
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
            icon: '🎯',
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
            icon: '📋',
            intent: 'neutral',
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
            icon: '🗑️',
            intent: 'danger',
            group: 'file',
            vfsBound: false,
            order: 30,
            onClick: (data) => {
                if (confirm("Remove this patch?")) {
                    window.inSetu.stores.Bridge.getState().removeCell(data.id);
                    window.dispatchEvent(new CustomEvent('insetu:bridge:cell-deleted', { detail: { id: data.id } }));
                }
            }
        },
        {
            targetEntity: 'yomama',
            id: 'yomama-swap',
            label: 'Swap',
            icon: '🔄',
            intent: 'warning',
            group: 'edit',
            vfsBound: false,
            order: 40,
            onClick: (data) => {
                window.dispatchEvent(new CustomEvent('insetu:bridge:cell-swap', { detail: { id: data.id } }));
            }
        },
        {
            targetEntity: 'patch-receipt',
            id: 'patch-receipt-undo',
            label: 'Revert Pre-Patch',
            icon: '⏪',
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
            icon: '🎯',
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
            icon: '📋',
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
            icon: "git-pull-request",
            intent: "highlight",
            order: 1,
            component: "insetu-ext-bridge"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "history",
            label: "Receipts",
            icon: "history",
            intent: "neutral",
            order: 2,
            component: "insetu-ext-bridge-history"
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "edit",
            targetSub: "bridge",
            component: "insetu-ext-bridge-actions",
            order: 1
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "edit",
            targetSub: "history",
            component: "insetu-ext-bridge-history-actions",
            order: 1
        }
    ]
});
