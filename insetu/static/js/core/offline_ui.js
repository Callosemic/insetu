import { html, css } from 'lit';
import { InSetuElement, createExtensionStore } from './sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';
import { SutramDB } from '../../vendor/sutram/js/offline.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
export const OfflineStore = createExtensionStore('Offline', {
    cachedBlobs: [],
    outboxItems: [],
    deadLetters: [],
    logs: [],
    loading: false,
    storageModalOpen: false,
    addLog: (message, type = 'info', details = null) => {
        const newEntry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            timestamp: Date.now(),
            message,
            type,
            details
        };
        OfflineStore.setState(s => ({
            logs: [newEntry, ...(s.logs || [])].slice(0, 100)
        }));
    },
    clearLogs: () => OfflineStore.setState({ logs: [] }),
    fetchOfflineState: async (showLoading = false) => {
        const ws = window.inSetu?.utils?.getActiveWorkspace() || 'default';
        if (showLoading) OfflineStore.setState({ loading: true });
        try {
            const [blobs, outbox, dead] = await Promise.all([
                SutramDB.getCacheManifest(ws),
                SutramDB.getOutboxItems(ws),
                SutramDB.getDeadLetters(ws)
            ]);
            OfflineStore.setState({ cachedBlobs: blobs, outboxItems: outbox, deadLetters: dead });
        } catch (e) {
            console.warn("Failed to read IndexedDB offline state", e);
        } finally {
            if (showLoading) OfflineStore.setState({ loading: false });
        }
    }
});
window.inSetu.stores.Offline = OfflineStore;

window.inSetu.offlineLog = (message, type = 'info', details = null) => {
    if (window.inSetu?.stores?.Offline) {
        window.inSetu.stores.Offline.getState().addLog(message, type, details);
    }
};

export class InSetuCoreOfflineLedger extends InSetuElement {
    static get extensionName() { return 'offline'; }
    static properties = {
        cachedBlobs: { type: Array },
        outboxItems: { type: Array },
        deadLetters: { type: Array },
        searchQuery: { type: String },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box; background: var(--bg); }
    `];

    constructor() {
        super();
        this.cachedBlobs = [];
        this.outboxItems = [];
        this.deadLetters = [];
        this.searchQuery = '';
        this.loading = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(OfflineStore, state => {
            this.cachedBlobs = state.cachedBlobs || [];
            this.outboxItems = state.outboxItems || [];
            this.deadLetters = state.deadLetters || [];
            this.loading = state.loading;
            this.requestUpdate();
        });
        // Auto-refresh when outbox drains or fills
        this.subscribe(window.inSetu.stores.App, state => state.outboxCount, () => {
            OfflineStore.getState().fetchOfflineState();
        });

        OfflineStore.getState().fetchOfflineState();
    }
    onWorkspaceLoad() { OfflineStore.getState().fetchOfflineState(); }
    onForceRefresh() {
        this.setStatus("🔄 Refreshing Offline Ledger...", 1500);
        OfflineStore.getState().fetchOfflineState(true);
    }
    onViewActivated() { OfflineStore.getState().fetchOfflineState(); }

    render() {
        const filteredBlobs = this.searchQuery 
            ? this.utils.fuzzyFilterObjects(this.cachedBlobs, this.searchQuery) 
            : this.cachedBlobs;

        return html`
            <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
                <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; color: var(--text);">Offline Ledger (IndexedDB)</h3>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">Inspect the VFS blob cache and pending mutation outbox.</span>
                    </div>
                    <button class="btn-sm" style="background: var(--intent-primary); color: white; border: none; margin: 0; padding: 6px 12px; font-weight: bold; cursor: pointer;"
                        @click=${() => this.onForceRefresh()}>
                        🔄 Refresh
                    </button>
                </div>

                ${this.loading ? html`<sutram-spinner text="Reading IndexedDB..."></sutram-spinner>` : ''}
                
                <div style="display: flex; flex-direction: column; opacity: ${this.loading ? '0.5' : '1'}; transition: opacity 0.2s ease;">
                <sutram-card-group>
                    <insetu-card
                        titleText="Outbox Mutations (${this.outboxItems.length})"
                        descriptionText="Pending API transactions waiting for network reconnection."
                        icon="🌩️"
                        intentColor="var(--intent-warning)"
                        ?disableSelection=${true}
                        style="margin-bottom: 20px;">
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            ${this.outboxItems.length === 0 ? html`
                                <div style="color: var(--intent-success); font-style: italic; font-size: 0.9rem;">
                                    ✅ Outbox is empty. All mutations are synced.
                                </div>
                            ` : this.outboxItems.map(item => html`
                                <div style="background: var(--bg); border-radius: 4px; border: 1px solid var(--border); padding: 10px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="font-weight: bold; color: var(--text);">${item.method} ${item.path.split('/api/')[1] || item.path}</span>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">${this.utils.formatDate(item.timestamp)}</span>
                                    </div>
                                    <pre style="margin: 0; font-size: 0.75rem; padding: 6px; max-height: 100px; overflow-y: auto;">${JSON.stringify(item.payload, null, 2)}</pre>
                                </div>
                            `)}
                        </div>
                    </insetu-card>
                    
                    ${this.deadLetters.length > 0 ? html`
                    <insetu-card
                        titleText="Dead Letter Queue (${this.deadLetters.length})"
                        descriptionText="Failed offline transactions (Poison Pills)."
                        icon="☠️"
                        intentColor="var(--intent-danger)"
                        ?disableSelection=${true}
                        style="margin-bottom: 20px;">
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            ${this.deadLetters.map(item => html`
                                <div style="background: var(--bg); border-radius: 4px; border: 1px solid var(--intent-danger); padding: 10px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="font-weight: bold; color: var(--intent-danger);">${item.method} ${item.path.split('/api/')[1] || item.path} (HTTP ${item.error_status})</span>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">${this.utils.formatDate(item.failed_at)}</span>
                                    </div>
                                    <pre style="margin: 0; font-size: 0.75rem; padding: 6px; max-height: 100px; overflow-y: auto;">${JSON.stringify(item.payload, null, 2)}</pre>
                                </div>
                            `)}
                        </div>
                    </insetu-card>
                    ` : ''}

                    <insetu-card
                        titleText="VFS Blob Cache (${this.cachedBlobs.length})"
                        descriptionText="Stale-While-Revalidate GET requests mirrored for offline viewing."
                        icon="🗄️"
                        intentColor="var(--intent-primary)"
                        ?disableSelection=${true}>
                        <sutram-search-bar 
                            placeholder="Filter cache keys..." 
                            .value=${this.searchQuery} 
                            @search-changed=${e => this.searchQuery = e.detail.value}
                            style="margin-top: 10px; margin-bottom: 10px;">
                        </sutram-search-bar>
                        <div style="display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto;">
                            ${filteredBlobs.length === 0 ? html`
                                <div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">
                                    No cached blobs found.
                                </div>
                            ` : filteredBlobs.map(key => html`
                                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text); padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; word-break: break-all;">
                                    ${key}
                                </div>
                            `)}
                        </div>
                    </insetu-card>
                </sutram-card-group>
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-core-offline-ledger', InSetuCoreOfflineLedger);

export class InSetuCoreOfflineSettings extends InSetuElement {
    static get extensionName() { return 'offline'; }
    static properties = {
        storageModalOpen: { type: Boolean },
        targetConfigs: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: contents; }
    `];

    constructor() {
        super();
        this.storageModalOpen = false;
        this.targetConfigs = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(OfflineStore, state => {
            this.storageModalOpen = state.storageModalOpen || false;
        });
        this.subscribe(window.inSetu.stores.App, state => {
            this.targetConfigs = this.utils.clone(state.targetConfigs || []);
        });
        this.targetConfigs = this.utils.clone(window.inSetu.stores.App.getState().targetConfigs || []);
    }
    async _toggleOffline(repoDir, isEnabled) {
        const configs = [...this.targetConfigs];
        const repo = configs.find(c => c.repo_dir === repoDir);
        if (repo) {
            repo.offline_capable = isEnabled;
            try {
                // Fetch full configuration to prevent wiping extensions and other settings
                const cfgRes = await this.api.workspace.get('system/config?t=' + Date.now(), { cache: 'no-store' });
                if (!cfgRes.ok) throw new Error("Failed to fetch current config.");
                const data = await cfgRes.json();
                const fullConfig = data.config || {};

                fullConfig.target_repos = configs;

                const res = await this.api.workspace.post('system/config', fullConfig);
                if (res.ok) {
                    window.inSetu.stores.App.setState({ targetConfigs: configs });
                    if (this.ui?.setGlobalStatus) this.ui.setGlobalStatus(`✅ Saved offline capability for ${repoDir}`, 2000);
                }
            } catch (e) {
                alert(`Failed to save setting: ${e.message}`);
            }
        }
    }
    async _preCacheRepo(repoDir) {
        const files = [];
        const vfsManifest = window.inSetu.stores.App.getState().manifest?.vfs || {};

        Object.entries(vfsManifest).forEach(([key, bucket]) => {
            if (key.startsWith(repoDir + '::')) {
                files.push(...(bucket.files || []));
            }
        });

        if (files.length === 0) {
            alert(`No indexed files found for ${repoDir}. Check your cartographer mappings.`);
            return;
        }
        window.inSetu?.offlineLog?.(`Starting pre-cache for repository '${repoDir}' (${files.length} files)...`, 'info');
        try {
            let cachedCount = 0;
            for (const f of files) {
                const res = await this.api.workspace.get(`fs/fetch?file=${encodeURIComponent(f)}`).catch(()=>{});

                if (res && res.ok) {
                    await res.blob().catch(()=>{});
                    cachedCount++;
                }
            }
            window.inSetu?.offlineLog?.(`Pre-cache complete for '${repoDir}': ${cachedCount}/${files.length} cached.`, 'success');
            if (this.ui?.setGlobalStatus) this.ui.setGlobalStatus(`✅ Successfully cached ${files.length} files for ${repoDir}`, 3000);

            setTimeout(() => {
                this.dispatch('insetu:force-refresh', { parentId: 'offline', subId: 'ledger' });
            }, 500);
        } catch (e) {
            window.inSetu?.offlineLog?.(`Pre-cache failed for '${repoDir}': ${e.message}`, 'error');
            alert(`Failed to cache repository: ${e.message}`);
        }
    }

    render() {
        return html`
            <sutram-modal ?open=${this.storageModalOpen} ?fullscreen=${true} titleText="🗄️ Offline Storage Management" @sutram-modal-closed=${() => OfflineStore.setState({ storageModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Manage offline cache capabilities per-repository.</p>

                    ${this.targetConfigs.map(repo => html`
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; padding: 15px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border); align-items: center; justify-content: space-between;">
                            <div style="display: flex; flex-direction: column; flex: 1; min-width: 250px;">
                                <span style="font-weight: bold; color: var(--intent-primary); font-size: 1.1rem;">📁 ${repo.repo_dir}</span>
                                <span style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${repo.title || 'No Display Title'}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                                <sutram-toggle 
                                    label="Offline Capable" 
                                    .checked=${!!repo.offline_capable} 
                                    @sutram-input-changed=${(e) => this._toggleOffline(repo.repo_dir, e.detail.value)} 
                                    ?flush=${true}>
                                </sutram-toggle>

                                <sutram-async-btn 
                                    label="⬇️ Pre-Cache Repository" 
                                    intent="neutral" 
                                    ?disabled=${!repo.offline_capable}
                                    style="margin: 0;" 
                                    .onClick=${() => this._preCacheRepo(repo.repo_dir)}>
                                </sutram-async-btn>
                            </div>
                        </div>
                    `)}

                    ${this.targetConfigs.length === 0 ? html`
                        <div style="color: var(--text-muted); font-style: italic; padding: 20px; text-align: center; background: var(--input-bg); border-radius: 6px; border: 1px dashed var(--border);">
                            No repositories mapped to this workspace yet.
                        </div>
                    ` : ''}
                </div>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-core-offline-settings', InSetuCoreOfflineSettings);
export class InSetuCoreOfflineLog extends InSetuElement {
    static get extensionName() { return 'offline'; }
    static properties = {
        logs: { type: Array },
        searchQuery: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box; background: var(--bg); }
    `];

    constructor() {
        super();
        this.logs = [];
        this.searchQuery = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(OfflineStore, state => {
            this.logs = state.logs || [];
            this.requestUpdate();
        });
        this.logs = OfflineStore.getState().logs || [];
    }

    onWorkspaceLoad() { this.requestUpdate(); }
    onForceRefresh() { this.setStatus("🔄 Refreshed Telemetry Log", 1500); this.requestUpdate(); }
    onViewActivated() { this.requestUpdate(); }

    _getIntentColor(type) {
        if (type === 'success') return 'var(--intent-success)';
        if (type === 'warning') return 'var(--intent-warning)';
        if (type === 'error') return 'var(--intent-danger)';
        return 'var(--intent-primary)';
    }

    render() {
        const filtered = this.searchQuery
            ? this.utils.fuzzyFilterObjects(this.logs, this.searchQuery, l => `${l.message} ${l.type} ${JSON.stringify(l.details || {})}`)
            : this.logs;

        return html`
            <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
                <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; color: var(--text);">Offline Telemetry Log (${this.logs.length}/100)</h3>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">Real-time inspection of caching, reads, outbox mutations, and sync events.</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-sm" style="background: var(--intent-danger); color: white; border: none; margin: 0; padding: 6px 12px; font-weight: bold; cursor: pointer;"
                            @click=${() => OfflineStore.getState().clearLogs()}>
                            🗑️ Clear Logs
                        </button>
                    </div>
                </div>

                <sutram-search-bar
                    placeholder="Filter telemetry logs..."
                    .value=${this.searchQuery}
                    @search-changed=${e => this.searchQuery = e.detail.value}
                    style="margin-bottom: 15px;">
                </sutram-search-bar>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${filtered.length === 0 ? html`
                        <div style="color: var(--text-muted); font-style: italic; padding: 20px 0; text-align: center;">
                            No telemetry entries logged yet. Perform file opens, offline edits, or pre-caching to observe events.
                        </div>
                    ` : filtered.map(log => {
                        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
                        const color = this._getIntentColor(log.type);
                        return html`
                            <div style="background: var(--input-bg); border: 1px solid var(--border); border-left: 4px solid ${color}; border-radius: 4px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
                                        <span style="font-size: 0.7rem; font-weight: bold; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; background: var(--bg); color: ${color}; border: 1px solid ${color};">
                                            ${log.type}
                                        </span>
                                        <span style="font-weight: bold; font-size: 0.9rem; color: var(--text);">${log.message}</span>
                                    </div>
                                </div>
                                ${log.details ? html`
                                    <pre style="margin: 0; font-size: 0.75rem; background: var(--bg); padding: 8px; border-radius: 4px; overflow-x: auto; max-height: 150px; color: var(--text-muted); border: 1px solid var(--border);">${typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}</pre>
                                ` : ''}
                            </div>
                        `;
                    })}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-core-offline-log', InSetuCoreOfflineLog);

window.ExtensionRegistry.registerExtension('offline', {
    name: "Offline Engine",
    version: "2.0.0",
    offline_mode: "read_only",
    settingsActions: [
        {
            id: 'offline_storage_management',
            label: 'Offline Storage Management',
            icon: '🗄️',
            onClick: () => {
                OfflineStore.setState({ storageModalOpen: true });
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-core-offline-settings"
        },
        {
            slot: "slots:primary-navigation",
            id: "offline",
            label: "Offline",
            order: 91
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "offline",
            id: "ledger",
            label: "Ledger",
            order: 1,
            component: "insetu-core-offline-ledger"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "offline",
            id: "log",
            label: "Log",
            order: 2,
            component: "insetu-core-offline-log"
        }
    ]
});