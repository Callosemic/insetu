import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import {
    BRIDGE_BASE_LAYOUT_SLOTS,
    BRIDGE_FLAG_UI_MAP,
    BRIDGE_GATE_UI_MAP,
    BridgeStore,
} from '/static/extensions/bridge/bridge_store.js';
import {
    InSetuBridgeDiffProjection,
    InSetuBridgeEditProjection,
    InSetuExtBridgeActions,
} from '/static/extensions/bridge/bridge_projections.js';
import { InSetuExtBridgeHistory } from '/static/extensions/bridge/bridge_history.js';

export {
    BRIDGE_BASE_LAYOUT_SLOTS,
    BRIDGE_FLAG_UI_MAP,
    BRIDGE_GATE_UI_MAP,
    BridgeStore,
    InSetuBridgeDiffProjection,
    InSetuBridgeEditProjection,
    InSetuExtBridgeActions,
    InSetuExtBridgeHistory,
};

export class InSetuExtBridge extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        cells: { type: Array },
        activeSurface: { type: String },
        repairMode: { type: String },
        autoHeal: { type: Boolean },
        fastTierStatus: { type: Object },
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
        this.repairMode = BridgeStore.getState().repairMode || 'algorithmic';
        this.autoHeal = false;
        this.fastTierStatus = BridgeStore.getState().fastTierStatus || { canAutoHeal: false, reason: '' };
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
        BridgeStore.getState().fetchFastTierStatus();
        this.requestUpdate();
    }
    onForceRefresh() {
        BridgeStore.getState().fetchHistory();
        BridgeStore.getState().fetchFastTierStatus();
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            BridgeStore,
            state => ({
                cells: state.cells || [],
                activeSurface: state.activeSurface || 'bridge',
                repairMode: state.repairMode || 'algorithmic',
                autoHeal: !!state.autoHeal,
                fastTierStatus: state.fastTierStatus || { canAutoHeal: false, reason: '' },
                drawerOpen: !!state.drawerOpen,
                drawerCollapsedDesktop: !!state.drawerCollapsedDesktop,
                consoleOutput: state.consoleOutput,
                viewMode: state.viewMode,
                telemetry: state.telemetry
            }),
            ({ cells, activeSurface, repairMode, autoHeal, fastTierStatus, drawerOpen, drawerCollapsedDesktop, consoleOutput, viewMode, telemetry }) => {
                const cellsChanged = this.cells !== cells;
                this.cells = cells;
                this.activeSurface = activeSurface;
                this.repairMode = repairMode;
                this.autoHeal = autoHeal;
                this.fastTierStatus = fastTierStatus;
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
        this.registerGlobalListener('insetu-llm-settings-changed', window, () => {
            BridgeStore.getState().fetchFastTierStatus();
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
        this.repairMode = bState.repairMode || 'algorithmic';
        this.autoHeal = !!bState.autoHeal;
        this.fastTierStatus = bState.fastTierStatus || { canAutoHeal: false, reason: '' };
        this.drawerOpen = !!bState.drawerOpen;
        this.drawerCollapsedDesktop = !!bState.drawerCollapsedDesktop;
        this.consoleOutput = bState.consoleOutput;
        this.viewMode = bState.viewMode;
        this.telemetry = bState.telemetry;
        const fsState = window.inSetu.stores.Fs?.getState() || {};
        this._fileVerificationCache = fsState.fileVerificationCache || {};

        window.inSetu.stores.Fs?.getState()?.verifyFiles(this.cells.map(c => c.file));
        BridgeStore.getState().fetchFastTierStatus();
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
        BridgeStore.getState().recomputeOptimisticTelemetry();
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
            if (this.vfs?.flushAllDirtyBuffers) await this.vfs.flushAllDirtyBuffers(false);
            const bState = BridgeStore.getState();
            const textVal = bState.getCompiledPayload();
            BridgeStore.setState({ viewMode: 'console', consoleOutput: "Dispatching transaction to the Bridge...", telemetry: null });
            const activeFiles = bState.getActiveFiles();
            const activeProfileId = window.inSetu?.stores?.Agent?.getState()?.activeProfileId || undefined;
            const curRepairMode = bState.repairMode || 'algorithmic';
            const action = this.api.bindJobAction('bridge/sync', {
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                repair_mode: curRepairMode,
                auto_heal: curRepairMode === 'ai_assisted',
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
                        const tel = statusData.artifact;
                        BridgeStore.setState({ telemetry: tel, consoleOutput: '' });
                        if (!(tel.can_commit && tel.mode === 'live') && tel.healed_cells && Object.keys(tel.healed_cells).length > 0) {
                            BridgeStore.getState().applyHealedCells(tel.healed_cells);
                        } else if (tel.healed_payload && tel.mode === 'dry_run' && tel.can_commit) {
                            BridgeStore.setState({ cells: [] });
                            BridgeStore.getState().parseAndAppendCells(tel.healed_payload);
                            BridgeStore.setState({ viewMode: 'console', telemetry: tel });
                        }

                        // State Parity: Auto-sync frontend paths when backend resolves a fuzzy/pinned path
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
                                    <sutram-btn
                                        ?compact=${true}
                                        ?disabled=${!this.fastTierStatus?.canAutoHeal}
                                        title=${this.fastTierStatus?.reason || ''}
                                        data-action="ai-repair-all"
                                        icon="sparkles"
                                        intent="highlight"
                                        label="AI Repair All Failed (${aiRepairableCount})">
                                    </sutram-btn>
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
                                            const spec = BRIDGE_FLAG_UI_MAP[flagStr];
                                            if (spec) return typeof spec.label === 'function' ? spec.label(p) : spec.label;
                                            return String(flagStr || '').replace(/_/g, ' ');
                                        };
                                        const resolveFlagIntent = (flagStr) => {
                                            const spec = BRIDGE_FLAG_UI_MAP[flagStr];
                                            return spec ? spec.intent : 'primary';
                                        };
                                        const resolveFlagTooltip = (flagStr) => {
                                            const spec = BRIDGE_FLAG_UI_MAP[flagStr];
                                            if (spec && typeof spec.tooltip === 'function') return spec.tooltip(p);
                                            return resolveFlagLabel(flagStr);
                                        };
                                        const patchDetailText = p.symbol
                                            ? `${p.symbol}${p.target_uri ? ` → ${new window.inSetu.utils.InSetuURI(p.target_uri).basename}` : ''}`
                                            : '';
                                        return html`
                                            <sutram-card
                                                .titleText=${`Patch #${(p.patch_index || 0) + 1} (${idxInFile + 1} of ${filePatches.length}): ${(p.status || 'unknown').replace(/_/g, ' ')}`}
                                                .detailText=${patchDetailText}
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
                                                            <sutram-tag .text=${resolveFlagLabel(flag)} .intent=${resolveFlagIntent(flag)} title=${resolveFlagTooltip(flag)}></sutram-tag>
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
                                                            <sutram-btn
                                                                ?compact=${true}
                                                                ?disabled=${!this.fastTierStatus?.canAutoHeal}
                                                                title=${this.fastTierStatus?.reason || ''}
                                                                data-action="ai-repair-cell"
                                                                data-cell-id="${p.cell_id || ''}"
                                                                icon="sparkles"
                                                                intent="highlight"
                                                                label="AI Repair This Patch">
                                                            </sutram-btn>
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
                                intent=${this.repairMode === 'ai_assisted' ? 'highlight' : (this.repairMode === 'algorithmic' ? 'primary' : 'neutral')}
                                ?active=${this.repairMode !== 'off'}
                                icon=${this.repairMode === 'ai_assisted' ? 'sparkles' : (this.repairMode === 'algorithmic' ? 'cpu' : 'shield-off')}
                                label=${this.repairMode === 'ai_assisted'
                                    ? 'Repair: AI-Assisted'
                                    : (this.repairMode === 'algorithmic' ? 'Repair: Algorithmic' : 'Repair: OFF')}
                                title=${`Click to cycle Bridge repair mode (OFF → Algorithmic${this.fastTierStatus?.canAutoHeal ? ' → AI-Assisted' : ' [Fast LLM unavailable for AI-Assisted]'}). ${this.fastTierStatus?.reason || ''}`}
                                @click=${() => {
                                    BridgeStore.getState().cycleRepairMode();
                                }}>
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
    layoutSlots: BRIDGE_BASE_LAYOUT_SLOTS.map(slot => ({ ...slot }))
});
