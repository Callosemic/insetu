import { LitElement, html, css } from 'lit';
import { sharedStyles } from './shared_styles.js';
import {
    viewSourceFile,
    fetchAndCopy,
    fetchAndDownloadState
} from './app.js';
import { AppStore } from './store.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

// --- VFS BRIDGE STATE STORE (UDF LAYER) ---
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export const BridgeStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            payloadText: '',
            detectedFiles: [],
            activeFiles: new Set(),
            activeBridgeJobId: null,
            viewMode: 'input',
            consoleOutput: 'Ready...',

            setPayloadText: (text) => {
                const val = text.replace(/\u00A0/g, ' ');
                const regex = /^<<<<<<< FILE:\s*(.+)$/gm;
                let match;
                const files = new Set();
                while ((match = regex.exec(val)) !== null) {
                    files.add(match[1].trim());
                }
                const fileArray = Array.from(files);
                set({ 
                    payloadText: val, 
                    detectedFiles: fileArray,
                    activeFiles: new Set(fileArray)
                });
            },
            toggleFileSelection: (file) => set((state) => {
                const updated = new Set(state.activeFiles);
                if (updated.has(file)) updated.delete(file);
                else updated.add(file);
                return { activeFiles: updated };
            }),
            clearPayload: () => set({ 
                payloadText: '', 
                detectedFiles: [], 
                activeFiles: new Set(), 
                activeBridgeJobId: null
            }),
            setViewMode: (mode) => set({ viewMode: mode }),
            setConsoleOutput: (out) => set({ consoleOutput: out })
        })),
        { name: 'BridgeStore' }
    )
);

window.inSetu.stores.Bridge = BridgeStore;
export class InSetuExtBridge extends LitElement {
    static properties = {
        payloadText: { type: String },
        detectedFiles: { type: Array },
        activeFiles: { type: Object },
        consoleOutput: { type: String },
        viewMode: { type: String },
        allRepos: { type: Array },
        pinnedRepos: { type: Object },
        _fileVerificationCache: { type: Object }
    };

    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; flex: 1; }
            .checkbox-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
            .file-label { font-family: monospace; font-weight: bold; cursor: pointer; flex: 1; word-break: break-all; }
            #target-files { max-height: 200px; overflow-y: auto; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-bottom: 15px; flex-shrink: 0; }
            #target-files:empty { display: none; }
        `
    ];

    constructor() {
        super();
        this.payloadText = '';
        this.detectedFiles = [];
        this.activeFiles = new Set();
        this.consoleOutput = 'Ready...';
        this.viewMode = 'input';
        this.allRepos = [];
        this.pinnedRepos = new Set(['ALL']);
        this._fileVerificationCache = {};
        this._globalBypassSandwich = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._unsubBridge = BridgeStore.subscribe((state) => {
            this.payloadText = state.payloadText;
            this.detectedFiles = state.detectedFiles || [];
            this.activeFiles = state.activeFiles;
            this.consoleOutput = state.consoleOutput;
            this.viewMode = state.viewMode;
            this._verifyFiles(this.detectedFiles);
        });
        this._unsubApp = AppStore.subscribe((state) => {
            this.allRepos = state.allRepos || [];
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        });

        // Initial sync
        const bState = BridgeStore.getState();
        this.payloadText = bState.payloadText;
        this.detectedFiles = bState.detectedFiles || [];
        this.activeFiles = bState.activeFiles;
        this.consoleOutput = bState.consoleOutput;
        this.viewMode = bState.viewMode;

        const aState = AppStore.getState();
        this.allRepos = aState.allRepos || [];
        this.pinnedRepos = aState.pinnedRepos || new Set(['ALL']);

        this._verifyFiles(this.detectedFiles);

        // Bind internal metronome polling loop
        if (window.inSetu?.extensions?.Registry?.registerTick) {
            window.inSetu.extensions.Registry.registerTick('bridge', 250, this._pollStatus.bind(this));
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsubBridge) this._unsubBridge();
        if (this._unsubApp) this._unsubApp();
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

    _isIdempotencyRisk(text) {
        const blocks = text.split('>>>>>>> REPLACE');
        for (const b of blocks) {
            if (!b.includes('<<<<<<< SEARCH') || !b.includes('=======')) continue;
            const searchPart = b.split('<<<<<<< SEARCH')[1].split('=======')[0].trim();
            const replacePart = b.split('=======')[1].trim();
            if (!searchPart) continue;
            if (replacePart.includes(searchPart)) return true;
        }
        return false;
    }

    _sync(dryRunActive, bypassSandwich = false) {
        if (bypassSandwich) this._globalBypassSandwich = true;
        const textVal = BridgeStore.getState().payloadText;
        BridgeStore.setState({ viewMode: 'console' });

        if (!this._globalBypassSandwich && this._isIdempotencyRisk(textVal)) {
            BridgeStore.setState({ 
                consoleOutput: `<span style="color: var(--intent-warning); font-weight: bold;">[!] WARNING: Idempotency Risk Detected.</span><br><br>Your REPLACE block contains an exact copy of your SEARCH block. This can lead to endless duplication if applied multiple times.<br><br><button type="button" data-action="force-sync" data-dryrun="${dryRunActive}" style="background: var(--intent-danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px;">⚠️ Do it anyway</button>` 
            });
            return;
        }

        const activeFiles = Array.from(BridgeStore.getState().activeFiles);
        BridgeStore.setState({ consoleOutput: "Dispatching transaction to the Bridge..." });

        const activeWs = AppStore.getState().activeWorkspace || 'default';
        fetch(`/api/${activeWs}/bridge/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                pinned_repos: Array.from(AppStore.getState().pinnedRepos)
            })
        })
        .then(async res => {
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        })
        .then(data => {
            BridgeStore.setState({ activeBridgeJobId: data.job_id, consoleOutput: "Transaction accepted. Processing matrix off-thread..." });
        }).catch(err => {
            BridgeStore.setState({ consoleOutput: `<span style="color: red;">Error connecting to Bridge Backend: ${err.message}</span>` });
        });
    }

    async _pollStatus() {
        const { activeBridgeJobId } = BridgeStore.getState();
        if (!activeBridgeJobId) return;

        try {
            const res = await fetch(`/api/system/jobs/${activeBridgeJobId}`);
            if (!res.ok) return;
            const statusData = await res.json();

            if (statusData.status === 'processing' || statusData.status === 'pending') {
                BridgeStore.setState({ consoleOutput: statusData.message || "Processing..." });
            } else if (statusData.status === 'completed' || statusData.status === 'failed') {
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

                if (statusData.status === 'completed' && !rawData.includes('[!]') && !rawData.includes('ACTION_REQUIRED') && !rawData.includes('[DRY RUN]')) {
                    BridgeStore.getState().clearPayload();
                }
            }
        } catch(e) {
            console.error("Bridge polling error:", e);
        }
    }

    _handleConsoleClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'update-path') {
            const oldPath = btn.dataset.old;
            const newPath = btn.dataset.new;
            const currentVal = BridgeStore.getState().payloadText;
            const updatedVal = currentVal.split("<<<<<<< FILE: " + oldPath).join("<<<<<<< FILE: " + newPath);
            BridgeStore.getState().setPayloadText(updatedVal);
            this._sync(false, this._globalBypassSandwich);
        } else if (action === 'view-diff') {
            if (window.openVirtualFile) window.openVirtualFile('Diff_Analysis.diff', atob(btn.dataset.b64));
        } else if (action === 'copy-diff') {
            navigator.clipboard.writeText(atob(btn.dataset.b64));
            const orig = btn.innerText;
            btn.innerText = '✅ Copied!';
            setTimeout(() => btn.innerText = orig, 2000);
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
        return html`
            <div style="display:flex; flex-direction:column; height: 100%;">
                <div style="display: ${this.viewMode === 'input' ? 'flex' : 'none'}; flex-direction: column; flex: 1;">
                    <textarea 
                        placeholder="<<<<<<< FILE: sample.py\n<<<<<<< SEARCH\nstart_anchor()\n{{until}}\nend_anchor()\n=======\nnew_code()\n>>>>>>> REPLACE" 
                        style="min-height: 300px; margin-top: 0; flex: 1; margin-bottom: 15px;"
                        .value=${this.payloadText}
                        @paste=${() => BridgeStore.getState().setConsoleOutput('Ready...')}
                        @input=${(e) => { BridgeStore.getState().setConsoleOutput('Ready...');
                        BridgeStore.getState().setPayloadText(e.target.value); }}></textarea>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; justify-content: flex-end;">
                        <button @click=${() => this._sync(true)} class="btn-sm" style="background: #d97706;">🧪 Dry Run</button>
                        <button @click=${() => this._sync(false)} class="btn-sm" style="background: #10b981;">⚡ Execute Patch</button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 15px; flex-wrap: wrap;">
                        <insetu-filter-group
                            label="📌 Repos:"
                            .allowAll=${true}
                            .items=${this.allRepos.map(r => ({ id: r, label: r }))}
                            .activeItems=${Array.from(this.pinnedRepos)}
                            @filter-changed=${(e) => {
                                const newPins = new Set(e.detail.activeItems);
                                localStorage.setItem('insetu_pinned_repos', JSON.stringify(Array.from(newPins)));
                                AppStore.setState({ pinnedRepos: newPins });
                            }}>
                        </insetu-filter-group>
                    </div>
                    <div id="target-files" style="display: ${this.detectedFiles.length > 0 ? 'block' : 'none'};">
                        ${this.detectedFiles.map(file => html`
                            <div class="checkbox-row">
                                <input type="checkbox" id="cb-${file}" .checked=${this.activeFiles.has(file)} @change=${() => BridgeStore.getState().toggleFileSelection(file)}>
                                <label for="cb-${file}" class="file-label">${file}</label>
                                <div>
                                    ${this._fileVerificationCache[file] === true ? html`
                                        <button class="btn-sm" style="background: var(--intent-primary);" @click=${(e) => { e.preventDefault(); viewSourceFile(file, true); }}>📋 View</button>
                                    ` : this._fileVerificationCache[file] === false ? html`
                                        <span style="font-size: 0.75rem; color: var(--intent-warning); font-weight: bold; padding: 4px 8px;">❓ Unknown</span>
                                    ` : ''}
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
                <div style="display: ${this.viewMode === 'console' ? 'flex' : 'none'}; flex: 1; flex-direction: column;">
                    <div id="status-box" 
                        @click=${this._handleConsoleClick}
                        style="flex: 1; width: 100%; padding: 15px; background: var(--console-bg); color: var(--console-text); border-radius: 4px; font-family: monospace; white-space: pre-wrap; border: 1px solid var(--border); overflow-y: auto; box-sizing: border-box; min-height: 300px; margin-bottom: 15px;"
                        .innerHTML=${this.consoleOutput}></div>
                </div>

            </div>
        `;
    }
}
customElements.define('insetu-ext-bridge', InSetuExtBridge);

export class InSetuExtBridgeActions extends LitElement {
    static properties = { viewMode: { type: String } };
    static styles = css`
        button { background: var(--btn); color: white; border: none; padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 0; }
        button:hover { background: var(--btn-hover); }
        button.back-btn { background: var(--intent-neutral); }
    `;
    constructor() { super(); this.viewMode = 'input'; }
    connectedCallback() {
        super.connectedCallback();
        this._unsub = BridgeStore.subscribe(state => { this.viewMode = state.viewMode; });
        this.viewMode = BridgeStore.getState().viewMode;
    }
    disconnectedCallback() { super.disconnectedCallback(); if (this._unsub) this._unsub(); }
    _paste() {
        navigator.clipboard.readText().then(t => {
            BridgeStore.getState().setPayloadText(t);
            BridgeStore.getState().setConsoleOutput('Ready...');
        }).catch(e => alert('Clipboard access denied.'));
    }
    _back() { BridgeStore.setState({ viewMode: 'input' }); }
    render() {
        return this.viewMode === 'input' 
            ? html`<button @click=${this._paste}>📋 Paste</button>` 
            : html`<button class="back-btn" @click=${this._back}>🔙 Back to Edit</button>`;
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
