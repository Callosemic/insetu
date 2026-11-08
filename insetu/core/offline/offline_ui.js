import { html } from 'lit';
import { InSetuElement, createExtensionStore, sharedStyles, SutramDB } from '/static/extensions/system/insetu_sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
export const OfflineStore = createExtensionStore('Offline', {
    cachedBlobs: [],
    outboxItems: [],
    deadLetters: [],
    logs: [],
    loading: false,
    storageUsage: 0,
    storageQuota: 0,
    storagePersisted: false,
    addLog: (message, type = 'info', details = null, category = 'offline') => {
        const newEntry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            timestamp: Date.now(),
            message,
            type,
            category,
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

            let usage = 0;
            let quota = 0;
            let persisted = false;

            if (navigator.storage && navigator.storage.estimate) {
                try {
                    const est = await navigator.storage.estimate();
                    usage = est.usage || 0;
                    quota = est.quota || 0;
                    persisted = await navigator.storage.persisted();
                } catch(err) {}
            }

            OfflineStore.setState({ 
                cachedBlobs: blobs, 
                outboxItems: outbox, 
                deadLetters: dead,
                storageUsage: usage,
                storageQuota: quota,
                storagePersisted: persisted
            });
        } catch (e) {
            console.warn("Failed to read IndexedDB offline state", e);
        } finally {
            if (showLoading) OfflineStore.setState({ loading: false });
        }
    }
});
window.inSetu.stores.Offline = OfflineStore;
window.inSetu.offlineLog = (message, type = 'info', details = null, category = 'offline') => {
    if (window.inSetu?.stores?.Offline) {
        window.inSetu.stores.Offline.getState().addLog(message, type, details, category);
    }
};

window.Sutram = window.Sutram || {};
window.Sutram.offlineLog = window.inSetu.offlineLog;

if (typeof SutramDB.subscribeTelemetry === 'function') {
    SutramDB.subscribeTelemetry((d) => {
        if (d.message && window.inSetu?.stores?.Offline) {
            window.inSetu.stores.Offline.getState().addLog(d.message, d.type || 'info', d.details || null, d.category || 'kernel');
        }
    });
} else {
    window.addEventListener('sutram:offline-telemetry', (e) => {
        const d = e.detail || {};
        if (d.message && window.inSetu?.stores?.Offline) {
            window.inSetu.stores.Offline.getState().addLog(d.message, d.type || 'info', d.details || null, d.category || 'kernel');
        }
    });
}

window.addEventListener('sutram:offline-state-changed', () => {
    if (window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState) {
        window.inSetu.stores.Offline.getState().fetchOfflineState();
    }
});

export class InSetuCoreOfflineLedger extends InSetuElement {
    static get extensionName() { return 'offline'; }
    static properties = {
        cachedBlobs: { type: Array },
        outboxItems: { type: Array },
        deadLetters: { type: Array },
        searchQuery: { type: String },
        loading: { type: Boolean },
        storageUsage: { type: Number },
        storageQuota: { type: Number },
        storagePersisted: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.cachedBlobs = [];
        this.outboxItems = [];
        this.deadLetters = [];
        this.searchQuery = '';
        this.loading = false;
        this.storageUsage = 0;
        this.storageQuota = 0;
        this.storagePersisted = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            OfflineStore,
            state => ({
                cachedBlobs: state.cachedBlobs || [],
                outboxItems: state.outboxItems || [],
                deadLetters: state.deadLetters || [],
                loading: !!state.loading,
                storageUsage: state.storageUsage || 0,
                storageQuota: state.storageQuota || 0,
                storagePersisted: state.storagePersisted || false
            }),
            (slice) => {
                this.cachedBlobs = slice.cachedBlobs;
                this.outboxItems = slice.outboxItems;
                this.deadLetters = slice.deadLetters;
                this.loading = slice.loading;
                this.storageUsage = slice.storageUsage;
                this.storageQuota = slice.storageQuota;
                this.storagePersisted = slice.storagePersisted;
                this.requestUpdate();
            }
        );
        // Auto-refresh when outbox drains or fills
        this.subscribe(window.inSetu.stores.App, state => state.outboxCount, () => {
            OfflineStore.getState().fetchOfflineState();
        });

        OfflineStore.getState().fetchOfflineState();
    }
    onWorkspaceLoad() { OfflineStore.getState().fetchOfflineState(); }
    onForceRefresh() {
        this.setStatus("Refreshing Offline Ledger...", 1500);
        OfflineStore.getState().fetchOfflineState(true);
    }

    async _discardDeadLetter(item) {
        if (!confirm("Are you sure you want to discard this failed mutation? The data will be permanently lost.")) return;
        try {
            await SutramDB.deleteDeadLetter(item._key);
            OfflineStore.getState().fetchOfflineState();
            if (window.inSetu?.offlineLog) window.inSetu.offlineLog(`Discarded poison pill: [${item.method}] ${item.path}`, 'warning');
        } catch (e) {
            this.setStatus("❌ Failed to delete dead-letter record.", 3500, true);
        }
    }
    async _retryDeadLetter(item) {
        try {
            await SutramDB.retryDeadLetter(item);
            OfflineStore.getState().fetchOfflineState();
            const count = await window.inSetu.utils?.syncOutboxMutationMarkers?.(item.scope_id);
            if (window.inSetu?.offlineLog) window.inSetu.offlineLog(`Re-queued poison pill for sync: [${item.method}] ${item.path}`, 'info');
            this.setStatus(`Queued for sync (${count})`, 3000);
        } catch (e) {
            this.setStatus("❌ Failed to re-queue dead-letter record.", 3500, true);
        }
    }
    async _requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            const granted = await navigator.storage.persist();
            if (granted) {
                OfflineStore.setState({ storagePersisted: true });
                this.setStatus("Persistent Storage Granted!", 3000);
            } else {
                this.setStatus("⚠️ Browser denied persistent storage rights (try installing as a PWA).", 4500, true);
            }
        }
    }

    async _preCacheRepository(repoDir) {
        if (!repoDir) return;
        const vfsManifest = window.inSetu?.stores?.App?.getState()?.manifest?.vfs || {};
        const files = [];
        Object.entries(vfsManifest).forEach(([key, bucket]) => {
            if (key.startsWith(`${repoDir}::`)) {
                files.push(...(bucket.files || []));
            }
        });
        if (this.vfs?.preCacheFiles) {
            await this.vfs.preCacheFiles(files, { label: repoDir });
        }
    }

    async _evictRepositoryCache(repoDir) {
        if (!repoDir || typeof SutramDB.evictByPrefix !== 'function') return;
        const ws = this.utils.getActiveWorkspace();
        const evicted = await SutramDB.evictByPrefix(ws, encodeURIComponent(`vfs://${repoDir}/`)).catch(() => 0);
        OfflineStore.getState().fetchOfflineState();
        window.inSetu?.offlineLog?.(`Evicted ${evicted} cached blob(s) for '${repoDir}'.`, 'warning', null, 'cache');
        if (this.ui?.setGlobalStatus) {
            this.ui.setGlobalStatus(`Evicted ${evicted} cached blobs for ${repoDir}`, 3000);
        }
    }

    async _toggleRepositoryOffline(repoDir, enabled) {
        if (!repoDir) return;
        const appStore = window.inSetu?.stores?.App;
        const currentTargets = appStore?.getState?.()?.targetConfigs || [];
        const updatedTargets = currentTargets.map(r => (r && r.repo_dir === repoDir ? { ...r, offline_capable: enabled } : r));
        if (appStore) {
            appStore.setState({ targetConfigs: updatedTargets });
        }
        try {
            await this.api.postJson('offline/repo_toggle', { repo: repoDir, enabled });
        } catch (err) {
            window.inSetu?.offlineLog?.(`Offline toggle saved locally for '${repoDir}' (${err.message})`, 'warning', null, 'cache');
        }
        if (enabled) {
            await this._preCacheRepository(repoDir);
        } else {
            await this._evictRepositoryCache(repoDir);
        }
        this.requestUpdate();
    }

    render() {
        const filteredBlobs = this.searchQuery 
            ? this.utils.fuzzyFilterObjects(this.cachedBlobs, this.searchQuery) 
            : this.cachedBlobs;

        const usageMB = (this.storageUsage / (1024 * 1024)).toFixed(2);
        const quotaMB = (this.storageQuota / (1024 * 1024)).toFixed(2);
        const usagePct = this.storageQuota > 0 ? Math.min(100, (this.storageUsage / this.storageQuota) * 100).toFixed(1) : 0;

        return html`
            <sutram-view
                size="wide"
                titleText="Offline Ledger (IndexedDB)"
                descriptionText="Inspect the VFS blob cache and pending mutation outbox.">
                <sutram-btn slot="header-actions" ?compact=${true} intent="primary" icon="refresh-cw" label="Refresh" @click=${() => this.onForceRefresh()}></sutram-btn>
                <sutram-stack direction="col" gap="wide">

                    <sutram-surface variant="panel" padding="normal">
                        <sutram-stack direction="row" justify="between" align="center" gap="normal" ?wrap=${true}>
                            <sutram-stack direction="col" gap="compact" ?flex=${true}>
                                <sutram-stack direction="row" justify="between" align="center">
                                    <strong>Browser Storage Quota</strong>
                                    <sutram-tag text="${usageMB} MB / ${quotaMB} MB"></sutram-tag>
                                </sutram-stack>
                                <div style="width: 100%; height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; border: 1px solid var(--border);">
                                    <div style="width: ${usagePct}%; height: 100%; background: ${usagePct > 90 ? 'var(--intent-danger)' : (usagePct > 75 ? 'var(--intent-warning)' : 'var(--intent-success)')}; transition: width 0.3s ease;"></div>
                                </div>
                            </sutram-stack>
                            <sutram-stack direction="row" align="center" gap="compact">
                                <sutram-tag
                                    intent=${this.storagePersisted ? 'success' : 'warning'}
                                    text=${this.storagePersisted ? 'Persisted (Safe from Eviction)' : 'Best Effort (At risk of eviction)'}>
                                </sutram-tag>
                                ${!this.storagePersisted ? html`
                                    <sutram-btn intent="highlight" ?compact=${true} label="Request Rights" @click=${this._requestPersistentStorage}></sutram-btn>
                                ` : ''}
                            </sutram-stack>
                        </sutram-stack>
                    </sutram-surface>

                    ${this.loading ? html`<sutram-spinner text="Reading IndexedDB..."></sutram-spinner>` : ''}
                    <sutram-card-group>
                        <sutram-card
                            titleText="Outbox Mutations (${this.outboxItems.length})"
                            descriptionText="Pending API transactions waiting for network reconnection."
                            icon="cloud-lightning"
                            intent="warning"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="compact">
                                ${this.outboxItems.length === 0 ? html`
                                    <sutram-stack direction="row" align="center" gap="compact">
                                        <sutram-icon name="check-circle-2" size="sm" intent="success"></sutram-icon>
                                        <sutram-label text="Outbox is empty. All mutations are synced."></sutram-label>
                                    </sutram-stack>
                                ` : this.outboxItems.map(item => html`
                                    <sutram-surface variant="inset" padding="compact" gap="compact">
                                        <sutram-stack direction="row" justify="between" align="center">
                                            <strong>${item.method} ${item.path.split('/api/')[1] || item.path}</strong>
                                            <sutram-label .text=${this.utils.formatDate(item.timestamp)}></sutram-label>
                                        </sutram-stack>
                                        <pre>${item.bodyString ? (item.bodyString.startsWith('{') || item.bodyString.startsWith('[') ? JSON.stringify(JSON.parse(item.bodyString), null, 2) : item.bodyString) : 'Empty Payload'}</pre>
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-card>
                        ${this.deadLetters.length > 0 ? html`
                        <sutram-card
                            titleText="Dead Letter Queue (${this.deadLetters.length})"
                            descriptionText="Failed offline transactions (Poison Pills)."
                            icon="skull"
                            intent="danger"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="compact">
                                ${this.deadLetters.map(item => html`
                                    <sutram-surface variant="tinted" intent="danger" padding="compact" gap="compact">
                                        <sutram-stack direction="row" justify="between" align="center">
                                            <strong>${item.method} ${item.path.split('/api/')[1] || item.path} (HTTP ${item.error_status})</strong>
                                            <sutram-label .text=${this.utils.formatDate(item.failed_at)}></sutram-label>
                                        </sutram-stack>
                                        <pre>${item.bodyString ? (item.bodyString.startsWith('{') || item.bodyString.startsWith('[') ? JSON.stringify(JSON.parse(item.bodyString), null, 2) : item.bodyString) : 'Empty Payload'}</pre>
                                        <sutram-stack direction="row" gap="compact">
                                            <sutram-btn intent="warning" ?compact=${true} label="Retry" @click=${() => this._retryDeadLetter(item)}></sutram-btn>
                                            <sutram-btn intent="danger" ?compact=${true} label="Discard" @click=${() => this._discardDeadLetter(item)}></sutram-btn>
                                        </sutram-stack>
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-card>
                        ` : ''}
                        ${(this.ecosystem?.targetConfigs || []).length > 0 ? html`
                        <sutram-card
                            titleText="Repository Offline Switchboard (${(this.ecosystem?.targetConfigs || []).filter(r => r.offline_capable).length}/${(this.ecosystem?.targetConfigs || []).length} enabled)"
                            descriptionText="Toggle which repositories sync to IndexedDB for offline editing. Turning a repository on warms its cache; turning it off evicts its cached blobs."
                            icon="package"
                            intent="highlight"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="compact">
                                ${(this.ecosystem?.targetConfigs || []).map(repo => {
                                    const rDir = repo.repo_dir || '';
                                    const encodedPrefix = encodeURIComponent(`vfs://${rDir}/`);
                                    const repoBlobCount = (this.cachedBlobs || []).filter(k => k.includes(encodedPrefix) || k.includes(`vfs://${rDir}/`)).length;
                                    return html`
                                        <sutram-surface variant="inset" padding="compact">
                                            <sutram-stack direction="row" justify="between" align="center" gap="compact" ?wrap=${true}>
                                                <sutram-stack direction="row" align="center" gap="compact" ?wrap=${true}>
                                                    <sutram-toggle
                                                        .label=${repo.title || rDir}
                                                        .checked=${!!repo.offline_capable}
                                                        ?flush=${true}
                                                        @sutram-input-changed=${(e) => this._toggleRepositoryOffline(rDir, Boolean(e.detail.value))}>
                                                    </sutram-toggle>
                                                    <sutram-tag
                                                        .text=${repo.offline_capable ? '⚡ Offline Enabled' : 'Online Only'}
                                                        .intent=${repo.offline_capable ? 'success' : 'neutral'}>
                                                    </sutram-tag>
                                                    <sutram-tag .text=${`${repoBlobCount} cached blobs`} intent="primary"></sutram-tag>
                                                </sutram-stack>
                                                <sutram-stack direction="row" align="center" gap="compact">
                                                    ${repo.offline_capable ? html`
                                                        <sutram-async-btn ?compact=${true} intent="primary" icon="download" label="Warm Now" .onClick=${() => this._preCacheRepository(rDir)}></sutram-async-btn>
                                                    ` : ''}
                                                    ${repoBlobCount > 0 ? html`
                                                        <sutram-async-btn ?compact=${true} intent="danger" icon="trash-2" label="Evict" .onClick=${() => this._evictRepositoryCache(rDir)}></sutram-async-btn>
                                                    ` : ''}
                                                </sutram-stack>
                                            </sutram-stack>
                                        </sutram-surface>
                                    `;
                                })}
                            </sutram-stack>
                        </sutram-card>
                        ` : ''}
                        <sutram-card
                            titleText="VFS Blob Cache (${this.cachedBlobs.length})"
                            descriptionText="Stale-While-Revalidate GET requests mirrored for offline viewing."
                            icon="hard-drive"
                            intent="primary"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="compact">
                                <sutram-search-bar 
                                    placeholder="Filter cache keys..." 
                                    .value=${this.searchQuery} 
                                    @search-changed=${e => this.searchQuery = e.detail.value}>
                                </sutram-search-bar>
                                <sutram-stack direction="col" ?scrollable=${true}>
                                    ${filteredBlobs.length === 0 ? html`
                                        <sutram-empty-state text="No cached blobs found."></sutram-empty-state>
                                    ` : html`
                                        <sutram-virtual-list
                                            .items=${filteredBlobs}
                                            .renderItem=${key => html`
                                                <sutram-surface variant="inset" padding="compact">
                                                    <code>${key}</code>
                                                </sutram-surface>
                                            `}>
                                        </sutram-virtual-list>
                                    `}
                                </sutram-stack>
                            </sutram-stack>
                        </sutram-card>
                    </sutram-card-group>
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-core-offline-ledger', InSetuCoreOfflineLedger);

export class InSetuCoreOfflineLog extends InSetuElement {
    static get extensionName() { return 'offline'; }
    static properties = {
        logs: { type: Array },
        searchQuery: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.logs = [];
        this.searchQuery = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            OfflineStore,
            state => state.logs || [],
            (logs) => {
                this.logs = logs;
                this.requestUpdate();
            }
        );
        this.logs = OfflineStore.getState().logs || [];
    }
    onWorkspaceLoad() { this.requestUpdate(); }
    onForceRefresh() { this.setStatus("Refreshed Telemetry Log", 1500); this.requestUpdate(); }

    _getIntentName(type) {
        if (type === 'success') return 'success';
        if (type === 'warning') return 'warning';
        if (type === 'error') return 'danger';
        return 'primary';
    }

    render() {
        const filtered = this.searchQuery
            ? this.utils.fuzzyFilterObjects(this.logs, this.searchQuery, l => `${l.message} ${l.type} ${JSON.stringify(l.details || {})}`)
            : this.logs;

        return html`
            <sutram-view
                size="wide"
                titleText="Offline Telemetry Log (${this.logs.length}/100)"
                descriptionText="Real-time inspection of caching, reads, outbox mutations, and sync events.">
                <sutram-btn slot="header-actions" ?compact=${true} intent="danger" icon="trash-2" label="Clear Logs" @click=${() => OfflineStore.getState().clearLogs()}></sutram-btn>
                <sutram-stack direction="col" gap="normal">

                    <sutram-search-bar
                        placeholder="Filter telemetry logs..."
                        .value=${this.searchQuery}
                        @search-changed=${e => this.searchQuery = e.detail.value}>
                    </sutram-search-bar>

                    <sutram-stack direction="col" gap="compact">
                        ${filtered.length === 0 ? html`
                            <sutram-empty-state text="No telemetry entries logged yet. Perform file opens, offline edits, or pre-caching to observe events."></sutram-empty-state>
                        ` : filtered.map(log => {
                            const timeStr = this.utils.formatDate(log.timestamp);
                            const intent = this._getIntentName(log.type);
                            return html`
                                <sutram-surface variant="panel" .intent=${intent} border="left" padding="compact" gap="compact">
                                    <sutram-stack direction="row" align="center" gap="compact" ?wrap=${true}>
                                        <sutram-label .text=${timeStr}></sutram-label>
                                        <sutram-tag .text=${log.type.toUpperCase()} .intent=${intent}></sutram-tag>
                                        ${log.category ? html`<sutram-tag .text=${String(log.category).toUpperCase()} intent="neutral"></sutram-tag>` : ''}
                                        <strong>${log.message}</strong>
                                    </sutram-stack>
                                    ${log.details ? html`
                                        <pre>${typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}</pre>
                                    ` : ''}
                                </sutram-surface>
                            `;
                        })}
                    </sutram-stack>
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-core-offline-log', InSetuCoreOfflineLog);
window.ExtensionRegistry.registerExtension('offline', {
    name: "Offline Engine",
    version: "2.0.0",
    icon: "hard-drive",
    offline_mode: "read_only",
    settingsActions: [
        {
            id: 'offline_storage_management',
            label: 'Repository Offline Cache & Storage',
            icon: 'hard-drive',
            onClick: () => {
                window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'sys:topology' });
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "offline",
            label: "Offline",
            icon: "wifi-off",
            intent: "neutral",
            order: 91
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "offline",
            id: "ledger",
            label: "Ledger",
            icon: "database",
            intent: "neutral",
            order: 1,
            component: "insetu-core-offline-ledger"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "offline",
            id: "log",
            label: "Log",
            icon: "terminal",
            intent: "neutral",
            order: 2,
            component: "insetu-core-offline-log"
        }
    ]
});