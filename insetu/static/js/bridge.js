import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
import {
    viewSourceFile,
    fetchAndCopy,
    fetchAndDownloadState
} from './app.js';
import { AppStore } from './store.js';

// --- VFS BRIDGE STATE STORE (UDF LAYER) ---
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const BridgeStore = createExtensionStore('Bridge', {
    cells: [],
    activeBridgeJobId: null,
    viewMode: 'input',
    consoleOutput: 'Ready...',
    parseAndAppendCells: (text) => {
        const val = text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
        const fileParts = val.split(/^<<<<<<< FILE:\s*(.+)$/m);
        const newCells = [];
        let cellIdx = 0;
        for (let i = 1; i < fileParts.length; i += 2) {
            const file = fileParts[i].trim();
            const rawContent = (fileParts[i + 1] || '').trim();
            if (file) {
                // Break apart multiple patches under the same FILE header
                const chunkMatches = Array.from(rawContent.matchAll(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/g));
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
        const path = e.composedPath();
        if (this._showFilters) {
            const isFilterContent = path.some(node => node.classList && (node.classList.contains('filter-container') || node.classList.contains('filter-toggle-btn')));
            if (!isFilterContent) {
                this._showFilters = false;
                this.requestUpdate();
            }
        }
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
        document.addEventListener('click', this._docClickListener);
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
        document.removeEventListener('click', this._docClickListener);
    }

    _verifyFiles(files) {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        files.forEach(file => {
            if (this._fileVerificationCache[file] === undefined) {
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
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || await res.text());
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
                        if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUIHook) {
                            savedFiles.forEach(f => window.inSetu.extensions.Registry.executeUIHook('zone:post-file-save', f));
                        }

                        // Silently hydrate manifest to instantly capture any newly created files in the VFS Explorer
                        setTimeout(async () => {
                            try {
                                const mRes = await window.inSetu.api.workspace('manifest?t=' + Date.now());
                                if (mRes.ok) {
                                    window.inSetu.stores.App.setState({ manifest: await mRes.json() });
                                }
                            } catch(e) {}
                        }, 500);
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
            if (window.openVirtualFile) window.openVirtualFile('Diff_Analysis.diff', decodedDiff);
        } else if (action === 'copy-diff') {
            const decodedDiff = new TextDecoder().decode(Uint8Array.from(atob(btn.dataset.b64), c => c.charCodeAt(0)));
            window.inSetu.utils.copyRawText(decodedDiff, btn);
        } else if (action === 'copy-state') {
            fetchAndCopy(btn.dataset.file, btn);
        } else if (action === 'download-state') {
            fetchAndDownloadState(btn.dataset.file, btn);
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
                <div style="display: ${this.viewMode === 'input' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
                    <div style="padding: 8px 20px; display: ${this.cells.length > 0 ? 'flex' : 'none'}; flex-direction: column; border-bottom: 1px solid var(--border); background: var(--bg); z-index: 10; flex-shrink: 0;">

                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; position: relative;">
                            <div data-custom-dropdown="true" class="fuzzy-search-wrapper" style="flex: 1; margin: 0; border: none; border-radius: 0; background: transparent; cursor: pointer; display: flex; align-items: center; padding: 4px 0;" @click=${() => this._dropdownOpen = !this._dropdownOpen}>
                                <span style="font-family: var(--font-mono); font-weight: bold; font-size: 0.95rem; color: var(--text); display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0;">
                                    <span style="color: var(--text-muted); opacity: 0.6; font-size: 1rem; transform: rotate(45deg); flex-shrink: 0;">🧩</span>
                                    ${this._activeCellId ? (() => {
                                        const cell = this.cells.find(c => c.id === this._activeCellId);
                                        if (!cell) return html`<span style="color: var(--text-muted); opacity: 0.6; font-family: sans-serif; font-weight: normal;">Select a patch...</span>`;
                                        const chunkIndex = this.cells.filter(c => c.file === cell.file).findIndex(c => c.id === cell.id) + 1;
                                        const totalChunks = this.cells.filter(c => c.file === cell.file).length;
                                        const shortFile = cell.file.length > 40 ? '...' + cell.file.slice(-37) : cell.file;
                                        return html`<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px;">${shortFile} <span style="color: var(--text-muted); flex-shrink: 0; font-family: sans-serif; font-weight: normal;">(${chunkIndex}/${totalChunks})</span> <span style="color: var(--text-muted); font-size: 0.6rem; flex-shrink: 0; margin-left: 2px;">${this._dropdownOpen ? '▲' : '▼'}</span></span>`;
                                    })() : html`<span style="color: var(--text-muted); opacity: 0.6; display: flex; align-items: center; gap: 8px; font-family: sans-serif; font-weight: normal;">Select a patch... <span style="font-size: 0.6rem;">${this._dropdownOpen ? '▲' : '▼'}</span></span>`}
                                </span>
                            </div>

                            <button class="btn-sm filter-toggle-btn" style="background: ${this._showFilters ? 'var(--input-bg)' : 'transparent'}; border: 1px solid ${this._showFilters ? 'var(--border)' : 'transparent'}; color: var(--text); padding: 4px 8px; margin: 0; font-size: 0.85rem; white-space: nowrap; max-width: 250px; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0;" @click=${() => this._showFilters = !this._showFilters} title="${activeFilters.join(', ')}">
                                ${this._showFilters ? '▼ ' + filterBtnText : '▶ ' + filterBtnText}
                            </button>

                            <div class="filter-container" style="display: ${this._showFilters ? 'flex' : 'none'}; position: absolute; top: calc(100% + 5px); right: 0; width: 300px; max-width: calc(100vw - 40px); z-index: 100; padding: 15px; background: var(--pane-bg); border: 1px solid var(--border); border-radius: 6px; margin: 0; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
                                <insetu-repo-filter
                                    label="📌 Repos:"
                                    .repos=${this.allRepos}
                                    .activeRepos=${Array.from(this.pinnedRepos)}
                                    @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                                </insetu-repo-filter>
                            </div>
                            <div data-custom-dropdown="true" style="display: ${this._dropdownOpen ? 'flex' : 'none'}; position: absolute; top: calc(100% + 5px); left: 0; width: 100%; max-width: calc(100vw - 40px); max-height: 50vh; overflow-y: auto; background: var(--pane-bg); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); flex-direction: column; z-index: 200;">
                                ${this.cells.length === 0 ? html`<div style="padding: 15px; color: var(--text-muted); font-style: italic;">No patches available.</div>` : ''}
                                ${Object.entries(groupedCells).map(([file, groupCells]) => {
                                    return html`
                                        <div style="display: flex; flex-direction: column; border-bottom: 2px solid var(--bg);">
                                            ${groupCells.map((c, i) => {
                                                const chunkIndex = i + 1;
                                                const totalChunks = groupCells.length;
                                                return html`
                                                    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 15px; cursor: pointer; background: ${this._activeCellId === c.id ? 'var(--input-bg)' : 'transparent'}; transition: background 0.2s;" 
                                                        @click=${() => { this._activeCellId = c.id; this._dropdownOpen = false; }}
                                                        onmouseover="this.style.background='var(--input-bg)'"
                                                        onmouseout="this.style.background='${this._activeCellId === c.id ? 'var(--input-bg)' : 'transparent'}'">
                                                        <input type="checkbox" style="transform: scale(1.3); margin: 0; cursor: pointer;" 
                                                            .checked=${c.active} 
                                                            @click=${(e) => e.stopPropagation()}
                                                            @change=${(e) => { e.stopPropagation(); BridgeStore.getState().toggleCellActive(c.id); }}>
                                                        <span style="font-family: var(--font-mono); font-size: 0.9rem; color: ${c.active ? 'var(--text)' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; flex: 1;">&lrm;${c.file}&lrm;</span>
                                                        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: bold; flex-shrink: 0; font-family: sans-serif;">(${chunkIndex}/${totalChunks})</span>
                                                    </div>
                                                `;
                                            })}
                                            <div style="display: flex; gap: 8px; padding: 8px 15px; background: rgba(0,0,0,0.1); align-items: center;" @click=${(e) => e.stopPropagation()}>
                                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => {
                                                    if (window.openWorkspaceBrowser) {
                                                        window.openWorkspaceBrowser({
                                                            mode: 'file',
                                                            title: 'Select File for Patch',
                                                            callback: (filepath) => {
                                                                BridgeStore.getState().updateGroupFile(file, filepath);
                                                            }
                                                        });
                                                    }
                                                }}>📁 Pick File</button>
                                                ${this._fileVerificationCache[file] === true ? html`
                                                    <button class="btn-sm" style="background: var(--intent-success); margin: 0;" @click=${(e) => { e.preventDefault(); window.viewSourceFile(file, true); this._dropdownOpen = false; }}>📋 View</button>
                                                    <button class="btn-sm" style="background: var(--intent-primary); margin: 0;" @click=${(e) => { e.preventDefault(); fetchAndDownloadState(file, e.target); }}>⬇️ Download</button>
                                                ` : html`<span style="font-size: 0.75rem; color: var(--intent-warning); font-weight: bold; margin-left: 5px;">❓ Unknown Target</span>`}
                                            </div>
                                        </div>
                                    `;
                                })}
                            </div>
                        </div>
                    </div>
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
                            <button class="btn-sm" style="background: var(--intent-primary); font-weight: bold; padding: 12px 24px; font-size: 1.1rem; border-radius: 6px; z-index: 10;" @click=${async () => {
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
                            }}>📋 Paste from Clipboard</button>
                            <textarea style="opacity: 0.01; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; z-index: 1; resize: none;" autofocus @paste=${e => {
                                const text = e.clipboardData.getData('text');
                                if (text) { e.preventDefault(); BridgeStore.getState().parseAndAppendCells(text); }
                            }}></textarea>
                        </div>
                    ` : html`
                        <div style="display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; background: var(--input-bg);">
                            ${this.cells.map(cell => html`
                                <textarea style="display: ${this._activeCellId === cell.id ? 'block' : 'none'}; width: 100%; height: 100%; resize: none; border: none; padding: 20px; font-family: monospace; background: transparent; color: var(--text); box-sizing: border-box; outline: none; opacity: ${cell.active ? '1' : '0.5'}; white-space: pre-wrap; overflow-wrap: anywhere; overflow-x: hidden; overflow-y: auto;" 
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
                        <div style="padding: 15px 20px; background: var(--bg); border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; z-index: 10; flex-shrink: 0;">
                            <button class="btn-sm" style="background: var(--intent-danger); margin: 0;" @click=${() => BridgeStore.getState().clearPayload()}>🗑️ Clear All</button>
                            <div style="display: flex; gap: 10px;">
                                <insetu-async-btn label="🧪 Dry Run" intent="warning" .onClick=${() => this._sync(true)}></insetu-async-btn>
                                <insetu-async-btn label="⚡ Execute Patch" intent="success" .onClick=${() => this._sync(false)}></insetu-async-btn>
                            </div>
                        </div>
                    `}
                </div>
                <div style="display: ${this.viewMode === 'console' ? 'flex' : 'none'}; flex: 1; flex-direction: column; min-height: 0; padding: 20px;">
                    <div id="status-box" 
                        @click=${this._handleConsoleClick}
                        style="flex: 1; width: 100%; padding: 15px; background: var(--console-bg); color: var(--console-text); border-radius: 4px; font-family: monospace; white-space: pre-wrap; border: 1px solid var(--border); overflow-y: auto; box-sizing: border-box;"
                        .innerHTML=${this.consoleOutput}></div>
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);
export class InSetuExtBridgeActions extends InSetuElement {
    static properties = { viewMode: { type: String } };
    static styles = [sharedStyles, css`
        .bridge-action-btn { background: var(--btn); color: white; border: none; padding: 0 12px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 0; height: 34px; display: flex; align-items: center; }
        .bridge-action-btn:hover { background: var(--btn-hover); }
        .bridge-action-btn.back-btn { background: var(--intent-neutral); }
    `];
    constructor() { super(); this.viewMode = 'input'; }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(BridgeStore, state => { this.viewMode = state.viewMode; });
        this.viewMode = BridgeStore.getState().viewMode;
    }
    _back() { BridgeStore.setState({ viewMode: 'input' }); }
    render() {
        return this.viewMode === 'input' 
            ? html`` 
            : html`<button class="bridge-action-btn back-btn" @click=${this._back}>🔙 Back to Edit</button>`;
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
