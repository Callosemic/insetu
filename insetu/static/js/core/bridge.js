import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from './sdk.js';
import { sharedStyles } from '../../vendor/sutram/shared_styles.js';
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
        allRepos: { type: Array },
        pinnedRepos: { type: Object },
        _fileVerificationCache: { type: Object },
        _tocModalOpen: { type: Boolean },
        _activeTocFile: { type: String },
        _showFilters: { type: Boolean },
        _activeCellId: { type: String },
        _dropdownOpen: { type: Boolean }
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
        this.allRepos = [];
        this.pinnedRepos = new Set(['ALL']);
        this._fileVerificationCache = {};
        this._globalBypassSandwich = false;
        this._showFilters = false;
        this._activeCellId = null;
        this._dropdownOpen = false;
        this._docClickListener = this._handleDocumentClick.bind(this);
    }
    _handleDocumentClick(e) {
        if (!e.isTrusted) return; // Ignore synthetic clicks like auto-downloads
        const path = e.composedPath();

        // Prevent interactions inside fullscreen modals from closing background UI
        const isInsideModal = path.some(node => 
            (node.tagName && node.tagName.includes('MODAL')) || 
            (node.classList && node.classList.contains('fullscreen-modal'))
        );
        if (isInsideModal) return;

        if (this._dropdownOpen) {
            const isDropdownContent = path.some(node => node.dataset && node.dataset.customDropdown === 'true');
            if (!isDropdownContent) {
                this._dropdownOpen = false;
                this.requestUpdate();
            }
        }
        if (this._tocModalOpen) {
            const isTocContent = path.some(node => node.classList && (node.classList.contains('toc-container') || node.classList.contains('toc-toggle-btn')));
            if (!isTocContent) {
                this._tocModalOpen = false;
                this.requestUpdate();
            }
        }
    }

    onWorkspaceChanged(newWorkspaceId) {
        this._fileVerificationCache = {};
        if (this.cells && this.cells.length > 0) {
            this._verifyFiles(this.cells.map(c => c.file));
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('click', document, this._docClickListener);
        this.subscribe(BridgeStore, (state) => {
            this.cells = state.cells || [];
            this.consoleOutput = state.consoleOutput;
            this.viewMode = state.viewMode;
            this._verifyFiles(this.cells.map(c => c.file));

            if (this.cells.length > 0 && !this.cells.find(c => c.id === this._activeCellId)) {
                this._activeCellId = this.cells[0].id;
            } else if (this.cells.length === 0) {
                this._activeCellId = null;
            }
        });
        this.subscribe(AppStore, (state) => {
            this.allRepos = state.allRepos || [];
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        });

        // Initial sync
        const bState = BridgeStore.getState();
        this.cells = bState.cells || [];
        if (this.cells.length > 0) this._activeCellId = this.cells[0].id;
        this.consoleOutput = bState.consoleOutput;
        this.viewMode = bState.viewMode;
        const aState = AppStore.getState();
        this.allRepos = aState.allRepos || [];
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);

        this._verifyFiles(this.cells.map(c => c.file));
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    _verifyFiles(files, force = false) {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        files.forEach(file => {
            if (force || this._fileVerificationCache[file] === undefined) {
                if (window.inSetu?.extensions?.Registry?.utils) {
                    window.inSetu.extensions.Registry.utils.debounceVerifyFile(activeWs, file, (exists) => {
                        this._fileVerificationCache = { ...this._fileVerificationCache, [file]: exists };
                        this.requestUpdate();
                    });
                }
            }
        });
    }
    async _sync(dryRunActive, bypassSandwich = false) {
        if (bypassSandwich) this._globalBypassSandwich = true;
        this._lastDryRun = dryRunActive;
        const textVal = BridgeStore.getState().getCompiledPayload();
        BridgeStore.setState({ viewMode: 'console' });

        const activeFiles = BridgeStore.getState().getActiveFiles();
        BridgeStore.setState({ consoleOutput: "Dispatching transaction to the Bridge..." });

        try {
            const res = await this.api.post('sync', {
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                pinned_repos: Array.from(AppStore.getState().pinnedRepos)
            });

            if (!res.ok) {
                let errText = `HTTP ${res.status} Error`;
                try { 
                    if (!res.bodyUsed) errText = await res.text(); 
                } catch(e) {}
                let err = {};
                try { err = JSON.parse(errText); } catch(e) {}
                throw new Error(err.error || errText);
            }
            const data = await res.json();
            BridgeStore.setState({ activeBridgeJobId: data.job_id, consoleOutput: "Transaction accepted. Processing matrix off-thread..." });

            this.api.pollJob(data.job_id, {
                interval: 250,
                onProgress: (msg) => BridgeStore.setState({ consoleOutput: msg }),
                onComplete: (statusData) => {
                    BridgeStore.setState({ activeBridgeJobId: null });
                    const rawData = statusData.message || "";
                    let safeData = rawData.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    // Format raw log text into elegant inSetu cards
                    safeData = safeData.replace(/^=== SYNC TRANSACTION PULSE ([^\r\n]+) ===[ \t]*\r?\n?/gm, '<div style="font-weight: bold; font-size: 1.1rem; color: var(--text-muted); margin-bottom: 10px;">Transaction $1</div>');
                    safeData = safeData.replace(/^Targeting: ([^\r\n]+)[ \t]*\r?\n?/gm, '<yenvui-card titletext="🎯 $1" intentcolor="var(--intent-primary)" style="margin-bottom: 15px; display: block;"><div style="font-size: 0.9rem; color: var(--text); line-height: 1.6; font-family: var(--font-mono); margin-top: -5px; padding-bottom: 10px;">');
                    safeData = safeData.replace(/^\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.[ \t]*\r?\n?/gm, '</div></yenvui-card>');
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

        } catch (err) {
            BridgeStore.setState({ consoleOutput: `<span style="color: red;">Error connecting to Bridge Backend: ${err.message}</span>` });
        }
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
            this._sync(this._lastDryRun || false, this._globalBypassSandwich);
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
            this._sync(isDryRun, true);
        }
    }
    render() {
        const activeFilters = [];
        this.pinnedRepos.forEach(r => { if (r !== 'ALL') activeFilters.push(r); });
        const filterBtnText = activeFilters.length > 0 ? `Filters: ${activeFilters.slice(0, 2).join(', ')}${activeFilters.length > 2 ? '...' : ''}` : 'Filters';

        const groupedCells = this.cells.reduce((acc, cell) => {
            if (!acc[cell.file]) acc[cell.file] = [];
            acc[cell.file].push(cell);
            return acc;
        }, {});

        return html`
            <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden; background: var(--bg); height: 100%;">

                <!-- INPUT VIEW -->
                <div style="display: ${this.viewMode === 'input' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
                    <!-- THE COMBOBOX HEADER -->
                    <div data-custom-dropdown="true" style="display: ${this.cells.length > 0 ? 'flex' : 'none'}; flex-direction: column; position: relative; z-index: 10; flex-shrink: 0; background: ${this._dropdownOpen ? 'var(--pane-bg)' : 'var(--bg)'}; border-bottom: ${this._dropdownOpen ? 'none' : '1px solid var(--border)'}; transition: background 0.2s;">
                        <div class="toolbar-row" style="justify-content: space-between; cursor: pointer; user-select: none;" @click=${(e) => { if (!e.target.closest('yenvui-filter-dropdown')) this._dropdownOpen = !this._dropdownOpen; }}>
                            <span style="font-weight: bold; font-size: 0.95rem; color: var(--text); display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                                <span style="color: var(--text-muted); font-size: 0.7rem; flex-shrink: 0;">${this._dropdownOpen ? '▲' : '▼'}</span>
                                ${this._activeCellId ? (() => {
                                    const cell = this.cells.find(c => c.id === this._activeCellId);
                                    if (!cell) return html`<span style="color: var(--text-muted); opacity: 0.6; font-weight: normal;">Select a patch...</span>`;
                                    const chunkIndex = this.cells.findIndex(c => c.id === cell.id) + 1;
                                    const totalChunks = this.cells.length;
                                    const shortFile = cell.file.length > 40 ? '...' + cell.file.slice(-37) : cell.file;
                                    return html`<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left;">&lrm;${shortFile}&lrm; <span style="color: var(--text-muted); font-weight: normal; margin-left: 5px;">(${chunkIndex}/${totalChunks})</span></span>`;
                                })() : html`<span style="color: var(--text-muted); opacity: 0.6; font-weight: normal;">Select a patch...</span>`}
                            </span>
                            <yenvui-filter-dropdown filterText=${filterBtnText} .hasFilters=${activeFilters.length > 0} @click=${e => e.stopPropagation()}>
                                <insetu-repo-filter
                                    label="📌 Repos:"
                                    .repos=${this.allRepos}
                                    .activeRepos=${Array.from(this.pinnedRepos)}
                                    @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                                </insetu-repo-filter>
                            </yenvui-filter-dropdown>
                        </div>
                        <div style="display: ${this._dropdownOpen ? 'flex' : 'none'}; position: absolute; top: 100%; left: 0; right: 0; height: calc(100dvh - 170px); overflow-y: auto; background: var(--pane-bg); border-bottom: 1px solid var(--border); border-top: 1px dashed var(--border); padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); flex-direction: column;">
                            ${this.cells.length === 0 ? html`<div style="padding: 15px; color: var(--text-muted); font-style: italic;">No patches available.</div>` : ''}
                            ${Object.entries(groupedCells).map(([file, groupCells]) => {
                                    const allChecked = groupCells.every(c => c.active);
                                    const someChecked = groupCells.some(c => c.active);

                                    return html`
                                        <insetu-card
                                            .filename=${file}
                                            .titleText=${""}
                                            icon=""
                                            ?disableSelection=${true}
                                            intentColor=${allChecked ? "var(--intent-success)" : (someChecked ? "var(--intent-warning)" : "var(--intent-neutral)")}
                                            style="margin-bottom: 12px; display: block;">
                                            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: -5px;">
                                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                                                    <input type="checkbox" style="transform: scale(1.2); margin: 0; cursor: pointer; margin-left: 2px;"
                                                        .checked=${allChecked}
                                                        .indeterminate=${someChecked && !allChecked}
                                                        @click=${(e) => e.stopPropagation()}
                                                        @change=${(e) => {
                                                            e.stopPropagation();
                                                            const newState = e.target.checked;
                                                            groupCells.forEach(c => {
                                                                if (c.active !== newState) BridgeStore.getState().toggleCellActive(c.id);
                                                            });
                                                        }}>
                                                    <span style="font-size: 0.85rem; font-weight: bold; color: var(--intent-primary); word-break: break-all; direction: rtl; text-align: left; flex: 1;">&lrm;${file}&lrm;</span>
                                                </div>

                                                ${groupCells.map((c, i) => {
                                                    const chunkIndex = this.cells.findIndex(cell => cell.id === c.id) + 1;
                                                    const totalChunks = this.cells.length;
                                                    return html`
                                                        <div style="display: flex; align-items: center; gap: 10px;">
                                                            <input type="checkbox" style="transform: scale(1.2); margin: 0; cursor: pointer; margin-left: 2px;" 
                                                                .checked=${c.active} 
                                                                @click=${(e) => e.stopPropagation()}
                                                                @change=${(e) => { e.stopPropagation(); BridgeStore.getState().toggleCellActive(c.id); }}>
                                                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; cursor: pointer; background: ${this._activeCellId === c.id ? 'var(--input-bg)' : 'transparent'}; border-radius: 4px; transition: background 0.2s; border: 1px solid ${this._activeCellId === c.id ? 'var(--border)' : 'transparent'}; flex: 1;"
                                                                @click=${() => { this._activeCellId = c.id; this._dropdownOpen = false; }}
                                                                onmouseover="this.style.background='var(--input-bg)'"
                                                                onmouseout="this.style.background='${this._activeCellId === c.id ? 'var(--input-bg)' : 'transparent'}'">
                                                                <span style="font-size: 0.85rem; color: ${c.active ? 'var(--text)' : 'var(--text-muted)'}; flex: 1;">Chunk ${i + 1} &gt;&gt; Select</span>
                                                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold;">(${chunkIndex}/${totalChunks})</span>
                                                            </div>
                                                        </div>
                                                    `;
                                                })}
                                            </div>
                                            <div slot="actions" style="display: flex; gap: 8px;" @click=${(e) => e.stopPropagation()}>
                                                <button class="btn-sm" style="background: var(--intent-primary);" title="Change Target" @click=${(e) => {
                                                    e.stopPropagation();
                                                    if (this.ui && this.ui.openWorkspaceBrowser) {
                                                        this.ui.openWorkspaceBrowser({
                                                            mode: 'file',
                                                            title: 'Select File for Patch',
                                                            callback: (filepath) => {
                                                                delete this._fileVerificationCache[filepath];
                                                                BridgeStore.getState().updateGroupFile(file, filepath);
                                                                this._verifyFiles([filepath], true);
                                                            }
                                                        });
                                                    }
                                                }}>📁 Change</button>
                                                ${this._fileVerificationCache[file] === true ? html`
                                                    <button class="btn-sm" style="background: var(--intent-neutral);" title="View Original" @click=${(e) => { e.preventDefault(); e.stopPropagation(); this.vfs.viewSourceFile(file, true); }}>📋 View</button>
                                                    <button class="btn-sm" style="background: var(--intent-highlight);" title="Download Original" @click=${(e) => { e.preventDefault(); e.stopPropagation(); this.vfs.fetchAndDownloadState(file); }}>⬇️ Download</button>
                                                ` : html`
                                                    <div title="Unknown Target" style="font-size: 1.2rem; cursor: help; padding: 4px; opacity: 0.6; text-align: center;">❓</div>
                                                `}
                                            </div>
                                        </insetu-card>
                                    `;
                                })}
                        </div>
                    </div>

                    <!-- TEXTAREA CONTAINER -->
                    ${this.cells.length === 0 ? html`
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed var(--border); border-radius: 8px; margin: 20px; background: var(--input-bg); min-height: 300px; position: relative;"
                            @dragover=${e => e.preventDefault()}
                            @drop=${async e => {
                                e.preventDefault();
                                const text = e.dataTransfer.getData('text');
                                if (text) BridgeStore.getState().parseAndAppendCells(text);
                            }}>
                            <div style="font-size: 3rem; margin-bottom: 10px;">🌉</div>
                            <h3 style="margin: 0 0 10px 0; color: var(--text);">Yomama Sync Bridge</h3>
                            <p style="color: var(--text-muted); margin-bottom: 20px; text-align: center; max-width: 400px;">Paste a patch sandwich from your LLM to begin parsing individual file blocks.</p>
                            <textarea style="opacity: 0.01; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; z-index: 1; resize: none;" autofocus @paste=${e => {
                                const text = e.clipboardData.getData('text');
                                if (text) { e.preventDefault(); BridgeStore.getState().parseAndAppendCells(text); }
                            }}></textarea>
                        </div>
                    ` : html`
                        <div style="display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; background: var(--input-bg);">
                            ${this.cells.map(cell => html`
                                <textarea class="cell-textarea" style="display: ${this._activeCellId === cell.id ? 'block' : 'none'}; width: 100%; height: 100%; resize: none; border: none; padding: 20px; font-family: monospace; background: transparent; color: var(--text); box-sizing: border-box; outline: none; opacity: ${cell.active ? '1' : '0.5'}; white-space: pre-wrap; overflow-wrap: anywhere; overflow-x: hidden; overflow-y: auto;" 
                                    .value=${cell.content}  
                                    @input=${(e) => BridgeStore.getState().updateCellContent(cell.id, e.target.value)} 
                                    @paste=${(e) => {
                                        const text = e.clipboardData.getData('text');
                                        if (text.includes('<<<<<<< FILE:')) {
                                            e.preventDefault();
                                            BridgeStore.getState().parseAndAppendCells(text);
                                        }
                                    }}></textarea>
                            `)}
                        </div>
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
                        }} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 1.05rem; font-weight: bold; border: none; cursor: pointer; background: var(--intent-primary); color: white;">📋 Paste from Clipboard</button>
                    ` : this.viewMode === 'input' ? html`
                        <button @click=${() => BridgeStore.getState().clearPayload()} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 1.05rem; font-weight: bold; border: none; cursor: pointer; background: var(--intent-danger); color: white;">🗑️ Clear</button>
                        <button @click=${() => this._sync(true)} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 1.05rem; font-weight: bold; border: none; cursor: pointer; background: var(--intent-warning); color: #000;">🧪 Dry Run</button>
                        <button @click=${() => this._sync(false)} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 1.05rem; font-weight: bold; border: none; cursor: pointer; background: var(--intent-success); color: white;">⚡ Patch</button>
                    ` : html`
                        <button @click=${() => BridgeStore.setState({ viewMode: 'input' })} style="flex: 1; margin: 0; padding: 12px; border-radius: 6px; font-size: 1.05rem; font-weight: bold; border: none; cursor: pointer; background: var(--intent-neutral); color: white;">🔙 Back to Edit</button>
                    `}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuExtBridgeActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    render() {
        return html``;
    }
}
customElements.define('insetu-ext-bridge-actions', InSetuExtBridgeActions);

window.ExtensionRegistry.registerExtension('bridge', {
    name: "Yomama Sync Bridge",
    version: "2.0.0",
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
