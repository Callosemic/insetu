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
    parseAndAppendCells: (text) => {
        let val = text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
        // Heal strictly anchored spaced angle-bracket REPLACE tags and trailing decay ladders
        val = val.replace(/^[ \t\u00A0]*(?:>[ \t\u00A0]*)+REPLACE[ \t\u00A0]*(?:\n[ \t\u00A0]*(?:>[ \t\u00A0]*)+$)*/gm, '>>>>>>> REPLACE');
        const fileParts = val.split(/^<<<<<<< FILE:\s*(.+)$/m);
        const newCells = [];
        let cellIdx = 0;
        for (let i = 1; i < fileParts.length; i += 2) {
            const file = fileParts[i].trim();
            const rawContent = (fileParts[i + 1] || '').trim();
            if (file) {
                // Break apart multiple patches under the same FILE header
                const chunkMatches = Array.from(rawContent.matchAll(/^<<<<<<< SEARCH[\s\S]*?^>>>>>>> REPLACE\s*$/gm));
                if (chunkMatches.length > 0) {
                    chunkMatches.forEach(match => {
                        newCells.push({ id: `cell_${Date.now()}_${cellIdx++}`, file, content: match[0].trim(), active: true });
                    });
                } else if (rawContent) {
                    // Fallback: If tags are malformed, pass the whole block through for manual fixing
                    newCells.push({ id: `cell_${Date.now()}_${cellIdx++}`, file, content: rawContent, active: true });
                }
            }
        }
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
    clearPayload: () => BridgeStore.setState({ 
        cells: [], 
        activeBridgeJobId: null,
        viewMode: 'input',
        consoleOutput: 'Ready...'
    }),
    setViewMode: (mode) => BridgeStore.setState({ viewMode: mode }),
    setConsoleOutput: (out) => BridgeStore.setState({ consoleOutput: out }),

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

    onWorkspaceChanged(newWorkspaceId) {
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

        const chunkMatch = textToSwap.match(/<<<<<<< SEARCH([\s\S]*?)^=======\s*([\s\S]*?)^>>>>>>> REPLACE/m);
        if (chunkMatch) {
            const searchBlock = chunkMatch[1].replace(/^\n/, '').replace(/\n$/, '');
            const replaceBlock = chunkMatch[2].replace(/^\n/, '').replace(/\n$/, '');
            const swappedChunk = `<<<<<<< SEARCH\n${replaceBlock}\n=======\n${searchBlock}\n>>>>>>> REPLACE`;

            if (this._editCellId === id) {
                this._editContent = this._editContent.replace(chunkMatch[0], swappedChunk);
                this.requestUpdate();
            } else {
                BridgeStore.getState().updateCellContent(id, swappedChunk);
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
    _saveEditModal() {
        const text = this._editContent;
        const fileMatch = text.match(/^<<<<<<< FILE:\s*(.+)$/m);
        const newFile = fileMatch ? fileMatch[1].trim() : this._editCellOriginalFile;

        const rawContent = text.replace(/^<<<<<<< FILE:.*\n?/m, '').trim();

        BridgeStore.getState().updateCellFile(this._editCellId, newFile);
        BridgeStore.getState().updateCellContent(this._editCellId, rawContent);
        this._editCellId = null;
    }
    _getSyncAction(dryRunActive, bypassSandwich = false) {
        return async (e) => {
            if (bypassSandwich) this._globalBypassSandwich = true;
            this._lastDryRun = dryRunActive;
            const textVal = BridgeStore.getState().getCompiledPayload();
            BridgeStore.setState({ viewMode: 'console', consoleOutput: "Dispatching transaction to the Bridge..." });
            const activeFiles = BridgeStore.getState().getActiveFiles();

            const action = this.api.bindJobAction('sync', {
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                pinned_repos: Array.from(this.ecosystem.pinnedRepos)
            }, {
                interval: 250,
                onProgress: (msg) => BridgeStore.setState({ consoleOutput: msg }),
                onComplete: (statusData) => {
                    BridgeStore.setState({ activeBridgeJobId: null });
                    const rawData = statusData.message || "";
                    let safeData = rawData.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    // Format raw log text into elegant inSetu cards
                    safeData = safeData.replace(/^=== SYNC TRANSACTION PULSE ([^\r\n]+) ===[ \t]*\r?\n?/gm, '<div style="font-weight: bold; font-size: 1.1rem; color: var(--text-muted); margin-bottom: 10px;">Transaction $1</div>');
                    safeData = safeData.replace(/^Targeting: ([^\r\n]+)[ \t]*\r?\n?/gm, '<sutram-card titletext="🎯 $1" intentcolor="var(--intent-primary)" style="margin-bottom: 15px; display: block;"><div style="font-size: 0.9rem; color: var(--text); line-height: 1.6; font-family: var(--font-mono); margin-top: -5px; padding-bottom: 10px;">');
                    safeData = safeData.replace(/^\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.[ \t]*\r?\n?/gm, '</div></sutram-card>');
                    safeData = safeData.replace(/^=== PULSE ([^\r\n]+) COMPLETE ===[ \t]*\r?\n?/gm, '');
                    // Embellish semantic tags
                    safeData = safeData.replace(/\[✓\]/g, '<span style="color: var(--intent-success); font-weight: bold;">[✓]</span>');
                    safeData = safeData.replace(/\[!\]/g, '<span style="color: var(--intent-danger); font-weight: bold;">[!]</span>');
                    safeData = safeData.replace(/\[🚀\]/g, '<span style="color: var(--intent-highlight); font-weight: bold;">[🚀]</span>');
                    safeData = safeData.replace(/\[⏭️\]/g, '<span style="color: var(--intent-warning); font-weight: bold;">[⏭️]</span>');
                    safeData = safeData.replace(/\[ℹ️\]/g, '<span style="color: var(--text-muted); font-weight: bold;">[ℹ️]</span>');

                    safeData = safeData.replace(/\[ACTION_REQUIRED: UPDATE_PATH \|\s*([\s\S]*?)\s*\|\s*([\s\S]*?)\s*\]/g, (match, p1, p2) => {
                        const safeP1 = p1.trim().replace(/\\/g, '\\\\');
                        const safeP2 = p2.trim().replace(/\\/g, '\\\\');
                        if (safeP1 === safeP2) return `<br><span style="color: var(--intent-danger); font-weight: bold;">[!] Path collision detected. Please manually remove the folder prefix in your FILE target.</span>`;
                        return `<br><button type="button" data-action="update-path" data-old="${safeP1}" data-new="${safeP2}" class="btn-sm" style="background: var(--intent-primary); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-size: 0.8rem; font-weight: bold;">[YES] Update Path & Retry</button>`;
                    });

                    safeData = safeData.replace(/\[ACTION_REQUIRED: COPY_ERROR \|\s*([\s\S]*?)\s*\]/g, (match, b64err) => {
                        return `<br><div style="display: flex; gap: 10px; margin-top: 5px;">
                            <button type="button" data-action="view-diff" data-b64="${b64err.trim()}" class="btn-sm" style="background: var(--intent-danger); margin: 0;">👁️ View Diff</button>
                            <button type="button" data-action="copy-diff" data-b64="${b64err.trim()}" class="btn-sm" style="background: var(--intent-neutral); margin: 0;">📋 Copy Diff</button>
                        </div>`;
                    });

                    safeData = safeData.replace(/\[ACTION_REQUIRED: COPY_STATE \|\s*([\s\S]*?)\s*\]/g, (match, p1) => {
                        const safeP1 = p1.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        return `<br><div style="display: flex; gap: 10px; margin-top: 5px;">
                        <button type="button" data-action="copy-state" data-file="${safeP1}" class="btn-sm" style="background: var(--intent-success); margin: 0;">📋 Copy State</button>
                        <button type="button" data-action="download-state" data-file="${safeP1}" class="btn-sm" style="background: var(--intent-primary); margin: 0;">⬇️ Download State</button>
                    </div>`;
                    });
                    BridgeStore.setState({ consoleOutput: safeData });
                    if (!rawData.includes('[!]') && !rawData.includes('ACTION_REQUIRED') && !rawData.includes('[DRY RUN]')) {
                        const savedFiles = BridgeStore.getState().getActiveFiles();
                        BridgeStore.setState({ cells: [] });
                        // Alert listening extensions (like the Tracker) that files have been modified
                        const mutations = savedFiles.map(f => ({ filepath: f, operation: 'save' }));
                        window.inSetu.events.emitHook('zone:vfs-mutated', { mutations });

                        // Trigger a definitive proactive ledger flush to surgically compile Gather payloads immediately
                        if (window.inSetu.sys.executeSystemCompile) {
                            window.inSetu.sys.executeSystemCompile();
                        }
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
        if (action === 'update-path') {
            const oldPath = btn.dataset.old;
            const newPath = btn.dataset.new;
            const cells = BridgeStore.getState().cells;
            const target = cells.find(c => c.file === oldPath);
            if (target) BridgeStore.getState().updateCellFile(target.id, newPath);
            this._getSyncAction(this._lastDryRun || false, this._globalBypassSandwich)();
        } else if (action === 'view-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            if (this.vfs && this.vfs.openVirtualFile) this.vfs.openVirtualFile('Diff_Analysis.diff', decodedDiff);
        } else if (action === 'copy-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            this.utils.copyRawText(decodedDiff);
        } else if (action === 'copy-state') {
            this.vfs.fetchAndCopy(btn.dataset.file);
        } else if (action === 'download-state') {
            this.vfs.fetchAndDownloadState(btn.dataset.file);
        } else if (action === 'force-sync') {
            const isDryRun = btn.dataset.dryrun === 'true';
            this._getSyncAction(isDryRun, true)();
        }
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
                            const headerTitle = `${file.split('/').pop()} (${totalCount} patch${totalCount === 1 ? '' : 'es'})`;
                            return html`
                            <sutram-collapsible titleText=${headerTitle} intent="neutral" .open=${true} ?flush=${true} style="background: var(--bg);">
                                <div style="padding: 15px 20px; display: flex; flex-direction: column; border-bottom: 1px solid var(--border);">
                                    <sutram-card-group ?stacked=${true}>
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
                                                .titleText=${`Patch Chunk ${i + 1}`}
                                                .descriptionText=${typeStr}
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
                            </sutram-collapsible>
                        `;})}
                    `}
                </div>

                <!-- CONSOLE VIEW -->
                <div style="display: ${this.viewMode === 'console' ? 'flex' : 'none'}; flex: 1; flex-direction: column; min-height: 0; padding: 20px; overflow-y: auto; background: var(--bg);">
                    <div id="status-box" 
                        @click=${this._handleConsoleClick}
                        style="width: 100%; max-width: 800px; margin: 0 auto; font-family: var(--font-mono); white-space: pre-wrap; color: var(--text);"
                        .innerHTML=${this.consoleOutput}></div>
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
                    `}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuExtBridgeActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static styles = [sharedStyles];
    render() { return html``; }
}
customElements.define('insetu-ext-bridge-actions', InSetuExtBridgeActions);
window.ExtensionRegistry.registerExtension('bridge', {
    name: "Yomama Sync Bridge",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'yomama',
            id: 'yomama-copy',
            label: 'Copy',
            icon: '📋',
            intent: 'neutral',
            order: 10,
            asyncAction: async (data) => {
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
            slot: "slots:sub-navigation-actions",
            targetParent: "edit",
            targetSub: "bridge",
            component: "insetu-ext-bridge-actions",
            order: 1
        }
    ]
});
