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
window.inSetu.offlineLog = (message, type = 'info', details = null) => {
    if (window.inSetu?.stores?.Offline) {
        window.inSetu.stores.Offline.getState().addLog(message, type, details);
    }
};

window.Sutram = window.Sutram || {};
window.Sutram.offlineLog = window.inSetu.offlineLog;

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
            alert("Failed to delete record.");
        }
    }
    async _retryDeadLetter(item) {
        try {
            await SutramDB.retryDeadLetter(item);
            OfflineStore.getState().fetchOfflineState();
            const count = await SutramDB.getOutboxCount(item.scope_id);

            // Re-hydrate UDF pending sets so optimistic UI restores instantly
            const pendingSet = new Set(window.inSetu.stores.App.getState().pendingMutations);
            const deletedSet = new Set(window.inSetu.stores.App.getState().deletedMutations);

            try {
                const payload = item.bodyString ? JSON.parse(item.bodyString) : {};
                const fp = payload.filepath || payload.dest_path;
                if (fp) {
                    const isDelete = item.method === 'DELETE' || (item.path && item.path.includes('fs/delete')) || (item.path && item.path.includes('fs/move'));
                    if (isDelete) {
                        deletedSet.add(fp);
                    } else {
                        pendingSet.add(fp);
                    }
                }
            } catch (e) {}
            window.inSetu.stores.App.setState({ outboxCount: count, pendingMutations: pendingSet, deletedMutations: deletedSet });
            if (window.inSetu?.offlineLog) window.inSetu.offlineLog(`Re-queued poison pill for sync: [${item.method}] ${item.path}`, 'info');
            if (this.ui?.setGlobalStatus) this.ui.setGlobalStatus(`Queued for sync (${count})`, 3000);
        } catch (e) {
            alert("Failed to re-queue record.");
        }
    }
    async _requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            const granted = await navigator.storage.persist();
            if (granted) {
                OfflineStore.setState({ storagePersisted: true });
                if (this.ui?.setGlobalStatus) this.ui.setGlobalStatus("Persistent Storage Granted!", 3000);
            } else {
                alert("The browser denied persistent storage rights. You may need to interact with the site more or install it as a PWA to elevate your storage clearance.");
            }
        }
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
                <sutram-stack direction="col" gap="lg">

                    <sutram-surface variant="panel" padding="md">
                        <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${true}>
                            <sutram-stack direction="col" gap="xs" ?flex=${true}>
                                <sutram-stack direction="row" justify="between" align="center">
                                    <strong>Browser Storage Quota</strong>
                                    <sutram-tag text="${usageMB} MB / ${quotaMB} MB"></sutram-tag>
                                </sutram-stack>
                                <div style="width: 100%; height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; border: 1px solid var(--border);">
                                    <div style="width: ${usagePct}%; height: 100%; background: ${usagePct > 90 ? 'var(--intent-danger)' : (usagePct > 75 ? 'var(--intent-warning)' : 'var(--intent-success)')}; transition: width 0.3s ease;"></div>
                                </div>
                            </sutram-stack>
                            <sutram-stack direction="row" align="center" gap="sm">
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
                            <sutram-stack direction="col" gap="sm">
                                ${this.outboxItems.length === 0 ? html`
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name="check-circle-2" size="sm" intent="success"></sutram-icon>
                                        <sutram-label text="Outbox is empty. All mutations are synced."></sutram-label>
                                    </sutram-stack>
                                ` : this.outboxItems.map(item => html`
                                    <sutram-surface variant="inset" padding="sm" gap="xs">
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
                            <sutram-stack direction="col" gap="sm">
                                ${this.deadLetters.map(item => html`
                                    <sutram-surface variant="tinted" intent="danger" padding="sm" gap="xs">
                                        <sutram-stack direction="row" justify="between" align="center">
                                            <strong>${item.method} ${item.path.split('/api/')[1] || item.path} (HTTP ${item.error_status})</strong>
                                            <sutram-label .text=${this.utils.formatDate(item.failed_at)}></sutram-label>
                                        </sutram-stack>
                                        <pre>${item.bodyString ? (item.bodyString.startsWith('{') || item.bodyString.startsWith('[') ? JSON.stringify(JSON.parse(item.bodyString), null, 2) : item.bodyString) : 'Empty Payload'}</pre>
                                        <sutram-stack direction="row" gap="sm">
                                            <sutram-btn intent="warning" ?compact=${true} label="Retry" @click=${() => this._retryDeadLetter(item)}></sutram-btn>
                                            <sutram-btn intent="danger" ?compact=${true} label="Discard" @click=${() => this._discardDeadLetter(item)}></sutram-btn>
                                        </sutram-stack>
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-card>
                        ` : ''}
                        <sutram-card
                            titleText="VFS Blob Cache (${this.cachedBlobs.length})"
                            descriptionText="Stale-While-Revalidate GET requests mirrored for offline viewing."
                            icon="hard-drive"
                            intent="primary"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="sm">
                                <sutram-search-bar 
                                    placeholder="Filter cache keys..." 
                                    .value=${this.searchQuery} 
                                    @search-changed=${e => this.searchQuery = e.detail.value}>
                                </sutram-search-bar>
                                <div style="height: 400px; display: flex; flex-direction: column;">
                                    ${filteredBlobs.length === 0 ? html`
                                        <sutram-empty-state text="No cached blobs found."></sutram-empty-state>
                                    ` : html`
                                        <sutram-virtual-list
                                            .items=${filteredBlobs}
                                            .renderItem=${key => html`
                                                <sutram-surface variant="inset" padding="xs">
                                                    <code>${key}</code>
                                                </sutram-surface>
                                            `}>
                                        </sutram-virtual-list>
                                    `}
                                </div>
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
                <sutram-stack direction="col" gap="md">

                    <sutram-search-bar
                        placeholder="Filter telemetry logs..."
                        .value=${this.searchQuery}
                        @search-changed=${e => this.searchQuery = e.detail.value}>
                    </sutram-search-bar>

                    <sutram-stack direction="col" gap="sm">
                        ${filtered.length === 0 ? html`
                            <sutram-empty-state text="No telemetry entries logged yet. Perform file opens, offline edits, or pre-caching to observe events."></sutram-empty-state>
                        ` : filtered.map(log => {
                            const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
                            const intent = this._getIntentName(log.type);
                            return html`
                                <sutram-surface variant="panel" .intent=${intent} border="left" padding="sm" gap="xs">
                                    <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                                        <sutram-label .text=${timeStr}></sutram-label>
                                        <sutram-tag .text=${log.type.toUpperCase()} .intent=${intent}></sutram-tag>
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