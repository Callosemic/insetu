import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from './sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';
import { AppStore } from './store.js';

// --- VFS BRIDGE STATE STORE (UDF LAYER) ---
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
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

            if (trimmed === '<<<<<<< SEARCH') {
                isInsideChunk = true;
                chunkLines = ['<<<<<<< SEARCH'];
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
        const bridgeEl = document.querySelector('insetu-ext-bridge');
        if (bridgeEl) bridgeEl._confirmedCandidates = {};
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
        return activeCells.map(c => `<<<<<<< FILE: ${c.file}\n${c.content}`).join('\n\n');
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
        _editCellOriginalFile: { type: String }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }
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
    }
    onWorkspaceLoad(workspaceId) {
        window.inSetu.stores.Fs.setState({ fileVerificationCache: {} });
        if (this.cells && this.cells.length > 0) {
            window.inSetu.stores.Fs.getState().verifyFiles(this.cells.map(c => c.file));
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(BridgeStore, (state) => {
            this.cells = state.cells || [];
            this.consoleOutput = state.consoleOutput;
            this.viewMode = state.viewMode;
            this.telemetry = state.telemetry;
            window.inSetu.stores.Fs.getState().verifyFiles(this.cells.map(c => c.file));
        });
        this.subscribe(window.inSetu.stores.Fs, (state) => {
            this._fileVerificationCache = state.fileVerificationCache || {};
        });

        // Event listeners for Yomama Actions
        this.registerGlobalListener('bridge-cell-deleted', window, (e) => {
            if (this._editCellId === e.detail.id) {
                this._editCellId = null;
                this.requestUpdate();
            }
        });
        this.registerGlobalListener('bridge-cell-swap', window, (e) => this._handleSwap(e.detail.id));

        // Initial sync
        const bState = BridgeStore.getState();
        this.cells = bState.cells || [];
        this.consoleOutput = bState.consoleOutput;
        this.viewMode = bState.viewMode;
        this.telemetry = bState.telemetry;
        const fsState = window.inSetu.stores.Fs.getState();
        this._fileVerificationCache = fsState.fileVerificationCache || {};

        window.inSetu.stores.Fs.getState().verifyFiles(this.cells.map(c => c.file));
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    _handleSwap(id) {
        const textToSwap = this._editCellId === id ? this._editContent : this.cells.find(c => c.id === id)?.content;
        if (!textToSwap) return;

        const sIdx = textToSwap.indexOf('<<<<<<< SEARCH');
        const mIdx = textToSwap.indexOf('=======', sIdx);
        const eIdx = textToSwap.indexOf('>>>>>>> REPLACE', mIdx);

        if (sIdx !== -1 && mIdx !== -1 && eIdx !== -1) {
            const before = textToSwap.substring(0, sIdx);
            const searchBlock = textToSwap.substring(sIdx + 14, mIdx).replace(/^\n/, '').replace(/\n$/, '');
            const replaceBlock = textToSwap.substring(mIdx + 7, eIdx).replace(/^\n/, '').replace(/\n$/, '');
            const after = textToSwap.substring(eIdx + 15);

            const swappedChunk = `${before}<<<<<<< SEARCH\n${replaceBlock}\n=======\n${searchBlock}\n>>>>>>> REPLACE${after}`;

            if (this._editCellId === id) {
                this._editContent = swappedChunk;
                this.requestUpdate();
            } else {
                BridgeStore.getState().updateCellContent(id, swappedChunk.trim());
            }
        } else {
            alert("Could not cleanly parse SEARCH/REPLACE blocks to swap.");
        }
    }

    _openEditorModal(cell) {
        this._editCellId = cell.id;
        this._editCellOriginalFile = cell.file;
        this._editContent = `<<<<<<< FILE: ${cell.file}\n${cell.content}`;
        this.requestUpdate();
    }
    _navigateChunk(direction) {
        if (!this._editCellId) return;

        // Auto-save current edits before navigating away
        const text = this._editContent;
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

    _deselectSpecificPatch(file, patchIdx) {
        const cells = BridgeStore.getState().cells || [];
        const activeGroupCells = cells.filter(c => c.file === file && c.active);
        const targetCell = activeGroupCells[patchIdx];
        if (targetCell) {
            const updatedCells = cells.map(c => 
                c.id === targetCell.id ? { ...c, active: false } : c
            );
            BridgeStore.setState({ cells: updatedCells });
            this.requestUpdate();
        }
    }

    _deselectAllFilePatches(file) {
        const cells = BridgeStore.getState().cells || [];
        const updatedCells = cells.map(c => 
            c.file === file ? { ...c, active: false } : c
        );
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
                        if (tel.can_commit && tel.mode === 'live') {
                            // Extract the true OS-resolved paths from the telemetry payload
                            const safePatches = tel.patches || [];
                            const resolvedFiles = Array.from(new Set(safePatches.map(p => p.resolved_file).filter(Boolean)));

                            BridgeStore.setState({ cells: [] });
                            const mutations = resolvedFiles.map(f => ({ filepath: f, operation: 'save' }));
                            window.inSetu.events.emitHook('zone:vfs-mutated', { mutations });

                            // Reactivity: Auto-refresh the ledger UI after a commit
                            BridgeStore.getState().fetchHistory();

                            if (window.inSetu.sys.executeSystemCompile) {
                                window.inSetu.sys.executeSystemCompile();
                            }
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
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'update-path' || action === 'confirm-candidate') {
            const oldPath = btn.dataset.old;
            const newPath = btn.dataset.new;
            const cells = BridgeStore.getState().cells;
            const target = cells.find(c => c.file === oldPath);
            if (target && oldPath !== newPath) BridgeStore.getState().updateGroupFile(oldPath, newPath);

            this._confirmedCandidates = this._confirmedCandidates || {};
            this._confirmedCandidates[oldPath] = newPath;
            this._confirmedCandidates[newPath] = newPath;

            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich, {
                confirmed_candidates: this._confirmedCandidates
            })();
        } else if (action === 'view-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            if (this.ui && this.ui.viewTextBlob) {
                this.ui.viewTextBlob('Syntax Error Diff', decodedDiff, `Syntax_Diff_${Date.now()}.diff`);
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
        } else if (action === 'deselect-this-patch') {
            const oldPath = btn.dataset.old;
            const patchIdx = parseInt(btn.dataset.patchIdx, 10);
            this._deselectSpecificPatch(oldPath, patchIdx);
            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich)();
        } else if (action === 'deselect-all-file-patches' || action === 'deselect-patch') {
            const oldPath = btn.dataset.old;
            this._deselectAllFilePatches(oldPath);
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
                            return html`<div style="padding: 15px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text-muted); font-style: italic;">No patch data available for this transaction.</div>`;
                        }

                        const groupedPatches = safePatches.reduce((acc, p) => {
                            const file = p.original_file || 'Unknown File';
                            if (!acc[file]) acc[file] = [];
                            acc[file].push(p);
                            return acc;
                        }, {});

                        return Object.entries(groupedPatches).map(([file, filePatches]) => {
                            const hasError = filePatches.some(p => p.status === 'failed' || p.status === 'syntax_error');
                            const hasWarning = filePatches.some(p => p.status === 'needs_confirmation' || p.status === 'offer_deep_search');
                            const isSkipped = filePatches.every(p => p.status === 'auto_skipped');

                            let intentColor = 'var(--intent-success)';
                            let icon = '✅';
                            if (hasError) { intentColor = 'var(--intent-danger)'; icon = '❌'; }
                            else if (hasWarning) { intentColor = 'var(--intent-warning)'; icon = '⚠️'; }
                            else if (isSkipped) { intentColor = 'var(--intent-neutral)'; icon = '⏭️'; }

                            const targetEntityFile = filePatches[0]?.resolved_file || file;
                            return html`
                                <insetu-card 
                                    titleText="${icon} ${file}" 
                                    detailText="${filePatches.length} Patch${filePatches.length !== 1 ? 'es' : ''}" 
                                    intentColor="${intentColor}"
                                    entityType="file"
                                    .entityData=${{ filepath: targetEntityFile, isFS: true, suppress: ['file-browse'] }}>

                                    <div style="padding: 2px 0; font-size: 0.9rem; color: var(--text);">
                                        ${filePatches.map((p, idx) => html`
                                            <div style="border-bottom: ${idx < filePatches.length - 1 ? '1px solid var(--border)' : 'none'}; padding-bottom: ${idx < filePatches.length - 1 ? '12px' : '0'}; margin-bottom: ${idx < filePatches.length - 1 ? '12px' : '0'};">
                                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                                    <p style="margin: 0; font-weight: bold; color: var(--text-muted);">Patch #${(p.patch_index || 0) + 1}: <span style="color: var(--text);">${(p.status || 'unknown').replace('_', ' ')}</span></p>
                                                    ${p.flags && p.flags.length > 0 ? html`
                                                        <span style="font-size: 0.75rem; color: var(--intent-highlight); border: 1px solid var(--intent-highlight); padding: 2px 6px; border-radius: 4px;">${p.flags.join(', ')}</span>
                                                    ` : ''}
                                                </div>

                                                ${p.error_message ? html`<p style="color: ${p.status === 'auto_skipped' ? 'var(--intent-warning)' : 'var(--intent-danger)'}; margin: 6px 0 0 0;">${p.error_message}</p>` : ''}

                                                ${p.syntax_error ? html`
                                                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                                                        <button data-action="view-diff" data-b64="${p.syntax_error}" class="btn-sm" style="background: var(--intent-danger);">👁️ View Syntax Error Diff</button>
                                                    </div>
                                                ` : ''}
                                                ${p.candidates && p.candidates.length > 0 ? html`
                                                    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                                                        ${p.candidates.map(c => {
                                                            const btnLabel = p.flags?.includes('confirm-to-overwrite') || c.match_type === 'overwrite' ? 'Confirm Overwrite' : 'Confirm Match';
                                                            return html`
                                                                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 8px; border: 1px solid var(--border); border-radius: 4px;">
                                                                    <span style="font-family: monospace;">${c.filepath} ${c.score ? `(Score: ${c.score})` : ''}</span>
                                                                    <button data-action="confirm-candidate" data-old="${p.original_file}" data-new="${c.filepath}" class="btn-sm" style="background: var(--intent-primary);">${btnLabel}</button>
                                                                </div>
                                                            `;
                                                        })}
                                                    </div>
                                                ` : ''}
                                                <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; align-items: center;">
                                                    ${p.available_actions?.includes('offer_deep_search') ? html`
                                                        <button data-action="deep-search" class="btn-sm" style="background: var(--intent-highlight);">🔍 Run Deep Search</button>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('ignore_syntax_error') ? html`
                                                        <button data-action="ignore-syntax" class="btn-sm" style="background: var(--intent-danger);">⚠️ Ignore Syntax & Commit</button>
                                                    ` : ''}
                                                    ${p.available_actions?.includes('deselect_patch') ? html`
                                                        <div style="display: flex; align-items: center; gap: 6px;">
                                                            <button data-action="deselect-this-patch" data-old="${p.original_file}" data-patch-idx="${idx}" class="btn-sm" style="background: var(--intent-neutral);">Deselect Patch</button>
                                                            <button data-action="deselect-all-file-patches" data-old="${p.original_file}" class="btn-sm" style="background: var(--intent-neutral);">Deselect All File Patches</button>
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        `)}
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
                <!-- EDITOR MODAL -->
                ${(() => {
                    const allCells = this.cells;
                    const chunkIndex = allCells.findIndex(c => c.id === this._editCellId) + 1;
                    const shortFile = this._editCellOriginalFile ? this._editCellOriginalFile.split('/').pop() : '';
                    return html`
                        <sutram-modal ?open=${!!this._editCellId} ?fullscreen=${true} ?flush=${true} titleText="Patch for ${shortFile}" @sutram-modal-closed=${() => this._editCellId = null}>
                            <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--bg);">
                                <div style="display: flex; align-items: stretch; background: var(--pane-bg); border-bottom: 1px solid var(--border); flex-shrink: 0; padding: 0;"
                                    @touchstart=${this._handleHeaderTouchStart}
                                    @touchend=${this._handleHeaderTouchEnd}>
                                    ${allCells.length > 1 ? html`
                                        <button @click=${() => this._navigateChunk(-1)} ?disabled=${chunkIndex === 1} style="width: 26px; padding: 0; background: ${chunkIndex === 1 ? 'var(--input-bg)' : 'var(--intent-highlight)'}; border: none; color: ${chunkIndex === 1 ? 'var(--text-muted)' : 'white'}; cursor: ${chunkIndex === 1 ? 'not-allowed' : 'pointer'}; font-size: 1.6rem; font-weight: bold; transition: filter 0.2s; display: flex; align-items: center; justify-content: center; opacity: ${chunkIndex === 1 ? '0.5' : '1'};" onmouseover="if(!this.disabled) this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='none'">‹</button>
                                    ` : ''}
                                    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 15px 20px;">
                                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold; text-align: center;">Chunk ${chunkIndex} of ${allCells.length}</span>
                                        <sutram-entity-actions entityType="yomama" .entityData=${{ id: this._editCellId, file: this._editCellOriginalFile, content: this._editContent }} style="justify-content: center;"></sutram-entity-actions>
                                    </div>
                                    ${allCells.length > 1 ? html`
                                        <button @click=${() => this._navigateChunk(1)} ?disabled=${chunkIndex === allCells.length} style="width: 26px; padding: 0; background: ${chunkIndex === allCells.length ? 'var(--input-bg)' : 'var(--intent-highlight)'}; border: none; color: ${chunkIndex === allCells.length ? 'var(--text-muted)' : 'white'}; cursor: ${chunkIndex === allCells.length ? 'not-allowed' : 'pointer'}; font-size: 1.6rem; font-weight: bold; transition: filter 0.2s; display: flex; align-items: center; justify-content: center; opacity: ${chunkIndex === allCells.length ? '0.5' : '1'};" onmouseover="if(!this.disabled) this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='none'">›</button>
                                    ` : ''}
                                </div>
                                <sutram-editor 
                                    .value=${this._editContent}
                                    language="javascript"
                                    @editor-changed=${e => { this._editContent = e.detail.value; this.requestUpdate(); }}>
                                </sutram-editor>
                            </div>
                            <div slot="footer" style="display: flex; width: 100%; align-items: center; gap: 12px;">
                                <button class="btn-sm" @click=${() => this._editCellId = null} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 1.05rem; font-weight: bold; background: var(--intent-neutral); color: white; border: none; cursor: pointer;">❌ Cancel</button>
                                <sutram-async-btn label="💾 Save & Close" intent="primary" .onClick=${() => this._saveEditModal()} style="flex: 1; margin: 0; --btn-padding: 12px; --btn-font-size: 1.05rem;"></sutram-async-btn>
                            </div>
                        </sutram-modal>
                    `;
                })()}
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
                            <div style="padding: 20px; display: flex; flex-direction: column; border-bottom: 1px solid var(--border);">
                                <sutram-card-group ?stacked=${true} ?accordion=${true}>
                                    <!-- Target File Card (Top of Stack) -->
                                    <insetu-card
                                        .titleText=${"Target File:"}
                                        .descriptionText=${this._fileVerificationCache[file] === false ? "⚠️ Target file not found in workspace." : ""}
                                        .detailText=${`${selectedCount} of ${totalCount} patches selected`}
                                        icon="📄"
                                        intentColor=${this._fileVerificationCache[file] === false ? 'var(--intent-danger)' : 'var(--intent-primary)'}
                                        entityType="file"
                                        .entityData=${{ filepath: file, isFS: true, suppress: ['file-browse'] }}
                                        selectionStoreKey="none"
                                        ?selected=${selectedCount > 0}
                                        @sutram-card-select-toggled=${(e) => { e.stopPropagation(); this._handleParentToggle(file); }}
                                        style="display: block;">

                                        <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                                            <sutram-input inline .value=${file} style="flex: 1; margin: 0; --bg-input: var(--bg);" @sutram-input-changed=${(e) => {
                                                BridgeStore.getState().updateGroupFile(file, e.detail.value);
                                                window.inSetu.stores.Fs.getState().verifyFiles([e.detail.value], true);
                                            }}></sutram-input>
                                            <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; flex-shrink: 0;" @click=${() => {
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
                                            }}>📁 Remap</button>
                                        </div>
                                    </insetu-card>
                                    <!-- Patches (Subsequent Stacked Chunks) -->
                                    ${groupCells.map((c, i) => {
                                        const isGenesis = !!c.content.match(/<<<<<<< SEARCH\s*=======/);
                                        const typeStr = isGenesis ? "Type: Create File" : "Type: Search & Replace";
                                        return html`
                                        <insetu-card
                                            .titleText=${typeStr}
                                            .detailText=${`Patch ${i + 1} of ${groupCells.length}`}
                                            icon="🧩"
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
                <div style="display: ${this.viewMode === 'console' ? 'flex' : 'none'}; flex: 1; flex-direction: column; min-height: 0; padding: 20px; overflow-y: auto; background: var(--bg);">
                    <div @click=${this._handleConsoleClick} style="display: contents;">
                        ${this._renderTelemetry()}
                    </div>
                </div>
                <!-- FOOTER -->
                <div style="padding: 12px 20px; gap: 12px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                    ${this.cells.length === 0 && this.viewMode === 'input' ? html`
                        <button @click=${async () => {
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
                        }} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 0.95rem; font-weight: normal; border: none; cursor: pointer; background: var(--intent-primary); color: white;">📋 Paste from Clipboard</button>
                    ` : this.viewMode === 'input' ? html`
                        <button @click=${() => BridgeStore.getState().clearPayload()} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 0.95rem; font-weight: normal; border: none; cursor: pointer; background: var(--intent-danger); color: white;">🗑️ Clear</button>
                        <sutram-async-btn label="🧪 Test" intent="warning" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-border-radius: 6px; --btn-font-size: 0.95rem; color: #000;" .onClick=${this._getSyncAction(true)}></sutram-async-btn>
                        <sutram-async-btn label="⚡ Patch" intent="success" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-border-radius: 6px; --btn-font-size: 0.95rem; color: white;" .onClick=${this._getSyncAction(false)}></sutram-async-btn>
                    ` : html`
                        <button @click=${() => BridgeStore.setState({ viewMode: 'input' })} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 0.95rem; font-weight: normal; border: none; cursor: pointer; background: var(--intent-neutral); color: white;">🔙 Back to Edit</button>
                        ${this.telemetry && this.telemetry.can_commit && this.telemetry.mode !== 'live' ? html`
                            <sutram-async-btn label="⚡ Apply Patch" intent="success" style="flex: 1; margin: 0; --btn-padding: 12px; --btn-border-radius: 6px; --btn-font-size: 0.95rem; color: white;" .onClick=${this._getSyncAction(false, true, { force: true, ignore_syntax_errors: true, confirmed_candidates: Object.fromEntries(BridgeStore.getState().getActiveFiles().map(f => [f, f])) })}></sutram-async-btn>
                        ` : ''}
                    `}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuExtBridgeHistoryActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = { _viewMode: { type: String } };
    static styles = [sharedStyles];

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
    static styles = [sharedStyles];
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
            <sutram-filter-dropdown .filterText=${btnText} .hasFilters=${hasF}>
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
                searchPlaceholder="🔍 Fuzzy search receipts..."
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
                            icon="🗂️"
                            intentColor="var(--intent-primary)"
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
                            const descStr = patchStr + (record.is_snapshot ? ' • 💾 Snapshot' : '');
                            return html`
                            <insetu-card
                                .titleText=${record.filepath.split('/').pop()}
                                .descriptionText=${descStr}
                                .detailText=${record.filepath}
                                icon=${record.is_snapshot ? '💾' : '📄'}
                                intentColor=${record.is_snapshot ? 'var(--intent-highlight)' : 'var(--intent-neutral)'}
                                entityType="patch-receipt"
                                .entityData=${record}
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
                            icon="📄"
                            intentColor="var(--intent-primary)"
                            entityType="file"
                            .entityData=${{ filepath: filepath, isFS: true, suppress: ['file-browse'] }}
                            has-actions
                            style="display: block;">
                        </insetu-card>
                        ${fileData.records.map((record, idx) => {
                            let chunks = record.chunks || record.patches;
                            if (!chunks && record.chunks_json) {
                                try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                            }
                            const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                            const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                            const descStr = patchStr + (record.is_snapshot ? ' • 💾 Snapshot' : '');
                            return html`
                            <insetu-card
                                .titleText=${"Tx: " + (record.transaction_id || 'Unknown')}
                                .descriptionText=${descStr}
                                .detailText=${`Turn ${idx + 1} of ${fileData.records.length} • ${this.utils.timeAgo(record.timestamp * 1000)}`}
                                icon=${record.is_snapshot ? '💾' : '🧩'}
                                intentColor=${record.is_snapshot ? 'var(--intent-highlight)' : 'var(--intent-neutral)'}
                                entityType="patch-receipt"
                                .entityData=${record}
                                has-actions
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
    entityActions: [
        {
            targetEntity: 'yomama-turn',
            id: 'yomama-turn-undo',
            label: 'Undo Turn (Pre-Tx)',
            icon: '⏪',
            intent: 'danger',
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
            order: 30,
            onClick: (data) => {
                if (confirm("Remove this patch?")) {
                    window.inSetu.stores.Bridge.getState().removeCell(data.id);
                    window.dispatchEvent(new CustomEvent('bridge-cell-deleted', { detail: { id: data.id } }));
                }
            }
        },
        {
            targetEntity: 'yomama',
            id: 'yomama-swap',
            label: 'Swap',
            icon: '🔄',
            intent: 'warning',
            order: 40,
            onClick: (data) => {
                window.dispatchEvent(new CustomEvent('bridge-cell-swap', { detail: { id: data.id } }));
            }
        },
        {
            targetEntity: 'patch-receipt',
            id: 'patch-receipt-undo',
            label: 'Revert Pre-Patch',
            icon: '⏪',
            intent: 'danger',
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
            order: 20,
            onClick: async (data) => {
                let sandwich = "<<<<<<< FILE: " + data.filepath + "\n";
                let chunks = data.chunks || data.patches;
                if (!chunks && data.chunks_json) {
                    try { chunks = JSON.parse(data.chunks_json); } catch(e) {}
                }

                if (Array.isArray(chunks) && chunks.length > 0) {
                    sandwich += chunks.map(c => {
                        const s = c.search !== undefined ? c.search : (c.search_block || '');
                        const r = c.replace !== undefined ? c.replace : (c.replace_block || '');
                        return `<<<<<<< SEARCH\n${s}\n=======\n${r}\n>>>>>>> REPLACE`;
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
            order: 1,
            component: "insetu-ext-bridge"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "history",
            label: "Receipts",
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
