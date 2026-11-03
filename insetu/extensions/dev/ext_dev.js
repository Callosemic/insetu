import { html } from 'lit';
import { InSetuElement, createExtensionStore, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
export const DevStore = createExtensionStore('Dev', {
    thrashingFiles: [],
    bridgeErrors: [],
    systemErrors: [],
    backendLogs: '',
    memoryTelemetry: null,
    lastUpdate: null,
    forceRefreshTick: 0
});
export class InSetuExtDevDash extends InSetuElement {
    static get extensionName() { return 'dev'; }
    static properties = {
        thrashingFiles: { type: Array },
        bridgeErrors: { type: Array },
        systemErrors: { type: Array },
        lastUpdate: { type: String },
        _expandedGraphs: { type: Object }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.thrashingFiles = [];
        this.bridgeErrors = [];
        this.systemErrors = [];
        this.lastUpdate = '';
        this._expandedGraphs = {};
        this._lastTick = 0;
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            DevStore,
            state => ({
                thrashingFiles: state.thrashingFiles || [],
                bridgeErrors: state.bridgeErrors || [],
                systemErrors: state.systemErrors || [],
                lastUpdate: state.lastUpdate,
                forceRefreshTick: state.forceRefreshTick
            }),
            {
                autoFetch: () => this.fetchMetrics(),
                equalityFn: (a, b) => {
                    if (b.forceRefreshTick && b.forceRefreshTick !== this._lastTick) {
                        this._lastTick = b.forceRefreshTick;
                        this.fetchMetrics();
                    }
                    return this.utils.shallowEqual(a, b);
                }
            }
        );
        this.registerGlobalListener('sutram-route-changed', window, (e) => {
            if (e.detail.tab === 'dev' && (!e.detail.subTabs['dev'] || e.detail.subTabs['dev'] === 'dash')) {
                DevStore.setState({ forceRefreshTick: Date.now() });
            }
        });
        this.registerGlobalListener('insetu:vfs-mutated', window, this.utils.debounce((e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const layout = window.Sutram?.stores?.Layout?.getState?.();
            const isDevVisible = ['left', 'center', 'right'].some(c => (layout?.columns?.[c]?.active || '').startsWith('dev:'));
            if (isDevVisible) {
                DevStore.setState({ forceRefreshTick: Date.now() });
            }
        }, 2000));
    }
    onViewActivated() {
        this.fetchMetrics();
    }
    async fetchMetrics() {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('dev')) return;
        try {
            const res = await this.api.get('dev/metrics');
            if (res.ok) {
                const data = await res.json();
                DevStore.setState({ 
                    thrashingFiles: data.thrashing || [],
                    bridgeErrors: data.bridge_errors || [],
                    systemErrors: data.system_errors || [],
                    lastUpdate: this.utils.formatDate(new Date())
                });
            } else {
                DevStore.setState({ lastUpdate: `Error (HTTP ${res.status})` });
            }
        } catch(e) {
            console.error("Telemetry fetch failed", e);
            DevStore.setState({ lastUpdate: 'Network Error' });
        }
    }
    render() {
        return html`
            <sutram-view size="wide" titleText="Developer Dashboard" .descriptionText=${`Last Updated: ${this.lastUpdate || '...'}`}>
                <sutram-stack direction="col" gap="lg">
                    <sutram-card-group>
                        <sutram-card
                            titleText="File Thrashing (Last 1 Hour)"
                            descriptionText="Files mutated more than 3 times in the past hour."
                            icon="flame"
                            intent="danger"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="sm">
                                ${this.thrashingFiles.length === 0 ? html`
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name="check-circle-2" size="sm" intent="success"></sutram-icon>
                                        <sutram-label text="File system is stable. No thrashing detected."></sutram-label>
                                    </sutram-stack>
                                ` : this.thrashingFiles.map(f => html`
                                    <sutram-surface variant="inset" padding="xs" gap="xs" ?interactive=${true}
                                        @click=${() => {
                                            this._expandedGraphs = { ...this._expandedGraphs, [f.filepath]: !this._expandedGraphs[f.filepath] };
                                        }}>
                                        <sutram-stack
                                            direction="row"
                                            justify="between"
                                            align="center">
                                            <sutram-stack direction="row" align="center" gap="sm">
                                                <sutram-label .text=${this._expandedGraphs[f.filepath] ? '▼' : '▶'}></sutram-label>
                                                <code>${f.filepath}</code>
                                            </sutram-stack>
                                            <sutram-tag text="${f.peak_mutations} mut/min peak" intent="danger"></sutram-tag>
                                        </sutram-stack>
                                        ${this._expandedGraphs[f.filepath] ? html`
                                            <sutram-surface variant="panel" border="top" padding="sm" gap="xs">
                                                <sutram-stack direction="row" justify="between" align="center">
                                                    <sutram-label text="60 mins ago"></sutram-label>
                                                    <strong>${f.total_mutations} total mutations</strong>
                                                    <sutram-label text="Now"></sutram-label>
                                                </sutram-stack>
                                                <div style="display: flex; align-items: flex-end; height: 60px; gap: 2px;">
                                                    ${f.history.map(val => {
                                                        const heightPct = f.peak_mutations > 0 ? Math.max(5, (val / f.peak_mutations) * 100) : 0;
                                                        return html`
                                                            <div style="flex: 1; background: ${val >= 3 ? 'var(--intent-danger)' : (val > 0 ? 'var(--intent-primary)' : 'transparent')}; height: ${val > 0 ? heightPct + '%' : '2px'}; opacity: ${val > 0 ? '1' : '0.2'}; border-radius: 2px 2px 0 0;" title="${val} mutations"></div>
                                                        `;
                                                    })}
                                                </div>
                                            </sutram-surface>
                                        ` : ''}
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-card>

                        <sutram-card
                            titleText="System Error Ledger"
                            descriptionText="Background worker crashes, VFS write failures, and unhandled exceptions."
                            icon="alert-triangle"
                            intent="danger"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="sm">
                                ${this.systemErrors.length === 0 ? html`
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name="check-circle-2" size="sm" intent="success"></sutram-icon>
                                        <sutram-label text="No system errors recorded."></sutram-label>
                                    </sutram-stack>
                                ` : this.systemErrors.map(err => html`
                                    <sutram-surface variant="inset" padding="sm" gap="xs">
                                        <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                            <strong>[${err.source}] ${err.error_type}</strong>
                                            <sutram-stack direction="row" align="center" gap="sm">
                                                <sutram-label .text=${this.utils.formatDate(err.timestamp * 1000)}></sutram-label>
                                                <sutram-btn
                                                    ?compact=${true}
                                                    intent="neutral"
                                                    icon="clipboard"
                                                    label="Copy"
                                                    @click=${() => {
                                                        const fullErrText = `[${err.source}] ${err.error_type} (${this.utils.formatDate(err.timestamp * 1000)})\nMessage: ${err.message || ''}${err.payload ? `\n\nPayload:\n${err.payload}` : ''}${err.traceback ? `\n\nTraceback:\n${err.traceback}` : ''}`;
                                                        this.utils.copyRawText(fullErrText, "📋 Error copied to clipboard!");
                                                    }}>
                                                </sutram-btn>
                                            </sutram-stack>
                                        </sutram-stack>
                                        <pre>${err.message}</pre>
                                        ${(err.traceback || err.payload) ? html`
                                            <sutram-collapsible titleText="🔍 View Details" intent="neutral">
                                                <sutram-stack direction="col" gap="sm">
                                                    ${err.payload ? html`
                                                        <sutram-label text="Payload:"></sutram-label>
                                                        <pre>${(() => {
                                                            if (typeof err.payload !== 'string') return String(err.payload);
                                                            if (!err.payload.trim().startsWith('{') && !err.payload.trim().startsWith('[')) return err.payload;
                                                            try { return JSON.stringify(JSON.parse(err.payload), null, 2); } 
                                                            catch(e) { return err.payload; }
                                                        })()}</pre>
                                                    ` : ''}
                                                    ${err.traceback ? html`
                                                        <sutram-label text="Traceback:"></sutram-label>
                                                        <pre>${err.traceback}</pre>
                                                    ` : ''}
                                                </sutram-stack>
                                            </sutram-collapsible>
                                        ` : ''}
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-card>

                        <sutram-card
                            titleText="Bridge Error Ledger"
                            descriptionText="AST validation and patch diff failures for LLM analysis."
                            icon="layout"
                            intent="warning"
                            ?disableSelection=${true}>
                            <sutram-stack direction="col" gap="sm">
                                ${this.bridgeErrors.length === 0 ? html`
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name="check-circle-2" size="sm" intent="success"></sutram-icon>
                                        <sutram-label text="No bridge errors recorded."></sutram-label>
                                    </sutram-stack>
                                ` : this.bridgeErrors.map(err => html`
                                    <sutram-surface variant="inset" padding="sm" gap="xs">
                                        <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                            <sutram-stack direction="row" align="center" gap="sm">
                                                <code>${err.filepath}</code>
                                                ${err.attempt_count > 1 ? html`<sutram-tag text="${err.attempt_count}x Attempts" intent="warning"></sutram-tag>` : ''}
                                            </sutram-stack>
                                            <sutram-label .text=${this.utils.formatDate(err.timestamp * 1000)}></sutram-label>
                                        </sutram-stack>
                                        <strong>[${err.error_type}]</strong>
                                        <pre>${err.details}</pre>
                                        ${(err.file_content || err.patch_payload) ? html`
                                            <sutram-collapsible titleText="🔍 View Full Context" intent="neutral">
                                                <sutram-stack direction="col" gap="sm">
                                                    <sutram-label text="Patch Payload:"></sutram-label>
                                                    <sutram-textarea readonly ?monospace=${true} .value=${err.patch_payload ? (typeof err.patch_payload === 'string' && (err.patch_payload.startsWith('{') || err.patch_payload.startsWith('[')) ? JSON.stringify(JSON.parse(err.patch_payload), null, 2) : err.patch_payload) : 'N/A'}></sutram-textarea>
                                                    <sutram-label text="Target File Content:"></sutram-label>
                                                    <sutram-textarea readonly ?monospace=${true} .value=${err.file_content || 'N/A'}></sutram-textarea>
                                                </sutram-stack>
                                            </sutram-collapsible>
                                        ` : ''}
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-card>
                    </sutram-card-group>
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-dev-dash', InSetuExtDevDash);
export class InSetuExtDevLogs extends InSetuElement {
    static get extensionName() { return 'dev'; }
    static properties = {
        backendLogs: { type: String },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.backendLogs = '';
        this.loading = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            DevStore,
            state => ({ backendLogs: state.backendLogs || '' }),
            { autoFetch: () => this.fetchLogs() }
        );
    }

    onViewActivated() { this.fetchLogs(); }
    async fetchLogs() {
        this.loading = true;
        try {
            const res = await this.api.get('dev/logs');
            if (res.ok) {
                const data = await res.json();
                DevStore.setState({ backendLogs: data.logs || '' });
            }
        } catch(e) {
            DevStore.setState({ backendLogs: 'Failed to fetch logs: ' + e.message });
        } finally {
            this.loading = false;
        }
    }
    async copyLogs() {
        if (!this.backendLogs) return;
        try {
            await this.utils.copyRawText(this.backendLogs);
            if (window.inSetu?.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus("📋 Logs copied to clipboard!", 2000);
            }
        } catch (err) {
            console.error("Failed to copy logs:", err);
        }
    }
    _getDownloadLogsAction() {
        return this.api.bindJobAction('dev/logs/download', {}, {
            onProgress: (msg) => {
                if (window.inSetu?.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`⏳ ${msg || 'Exporting logs...'}`, null);
                }
            },
            onComplete: async (statusData) => {
                const targetFile = statusData.artifact?.file;
                if (targetFile) {
                    const fetchUrl = `${window.inSetu.vfs.resolveFileFetchUrl(targetFile, false)}&download=1`;
                    await window.inSetu.vfs.fetchAndDownloadState(targetFile, fetchUrl);
                } else {
                    alert("✅ Logs generated, but no download payload was returned.");
                }
            },
            onError: (err) => alert(`❌ Export failed:\n\n${err.message}`)
        });
    }

    render() {
        return html`
            <sutram-view size="wide" titleText="Daemon Logs" descriptionText="Recent systemd output for insetu.service.">
                ${this.loading ? html`<sutram-spinner slot="header-actions" text="Fetching..."></sutram-spinner>` : ''}
                <sutram-btn slot="header-actions" ?compact=${true} icon="copy" label="Copy" intent="neutral" @click=${this.copyLogs}></sutram-btn>
                <sutram-async-btn
                    slot="header-actions"
                    ?compact=${true}
                    icon="download"
                    label="Export Boot Logs"
                    intent="primary"
                    .onClick=${this._getDownloadLogsAction()}>
                </sutram-async-btn>
                <sutram-surface variant="panel" padding="md">
                    <pre>${this.backendLogs || 'No logs available.'}</pre>
                </sutram-surface>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-dev-logs', InSetuExtDevLogs);

export class InSetuExtDevSql extends InSetuElement {
    static get extensionName() { return 'dev'; }
    static properties = {
        databases: { type: Array },
        selectedDb: { type: String },
        query: { type: String },
        result: { type: Object },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.databases = ['workers', 'vfs_index', 'topology', 'tracker', 'dev'];
        this.selectedDb = 'workers';
        this.query = 'SELECT * FROM immediate_jobs ORDER BY created_at DESC LIMIT 20;';
        this.result = null;
        this.loading = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this._fetchDatabases();
    }

    onWorkspaceLoad(workspaceId) { this._fetchDatabases(); }
    onViewActivated() { this._fetchDatabases(); }
    onForceRefresh() { this._fetchDatabases(); }
    async _fetchDatabases() {
        try {
            const res = await this.api.get('dev/sql/databases');
            if (res.ok) {
                const data = await res.json();
                if (data.databases && data.databases.length > 0) {
                    this.databases = data.databases;
                    if (!this.databases.includes(this.selectedDb)) {
                        this.selectedDb = this.databases[0];
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to fetch database list", e);
        }
    }
    async _executeQuery() {
        if (!this.query.trim()) return;
        this.loading = true;
        this.result = null;
        try {
            const res = await this.api.post('dev/sql/query', {
                db_name: this.selectedDb,
                query: this.query
            });
            const data = await res.json();
            this.result = data;
        } catch (e) {
            this.result = { status: 'error', error: e.message };
        } finally {
            this.loading = false;
        }
    }

    _applyPreset(queryStr, dbName = null) {
        if (dbName && this.databases.includes(dbName)) {
            this.selectedDb = dbName;
        }
        this.query = queryStr;
    }
    render() {
        return html`
            <sutram-view size="wide" titleText="SQL Console" descriptionText="Execute queries directly against workspace SQLite databases.">
                <sutram-stack direction="col" gap="md">

                    <sutram-surface variant="panel" padding="md" gap="md">
                        <sutram-stack direction="row" align="center" gap="md" ?wrap=${true}>
                            <sutram-select 
                                label="Target Database" 
                                ?flush=${true}
                                .value=${this.selectedDb} 
                                .options=${this.databases.map(db => ({ value: db, label: `${db}.db` }))} 
                                @sutram-input-changed=${e => this.selectedDb = e.detail.value}>
                            </sutram-select>
                            <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true} ?flex=${true}>
                                <sutram-label text="Quick Presets:"></sutram-label>
                                <sutram-btn ?compact=${true} intent="neutral" label="Topology Ledger" @click=${() => this._applyPreset('SELECT * FROM topology_ledger ORDER BY timestamp DESC LIMIT 20;', 'topology')}></sutram-btn>
                                <sutram-btn ?compact=${true} intent="neutral" label="Manifest Ledger" @click=${() => this._applyPreset('SELECT * FROM manifest_ledger ORDER BY timestamp DESC LIMIT 20;', 'vfs_index')}></sutram-btn>
                                <sutram-btn ?compact=${true} intent="neutral" label="VFS Event Log" @click=${() => this._applyPreset('SELECT * FROM vfs_event_log ORDER BY timestamp DESC LIMIT 20;', 'workers')}></sutram-btn>
                                <sutram-btn ?compact=${true} intent="neutral" label="Immediate Jobs" @click=${() => this._applyPreset('SELECT * FROM immediate_jobs ORDER BY created_at DESC LIMIT 20;', 'workers')}></sutram-btn>
                                <sutram-btn ?compact=${true} intent="neutral" label="System Errors" @click=${() => this._applyPreset('SELECT * FROM system_errors ORDER BY timestamp DESC LIMIT 20;', 'dev')}></sutram-btn>
                                <sutram-btn ?compact=${true} intent="neutral" label="Bridge Errors" @click=${() => this._applyPreset('SELECT * FROM bridge_errors ORDER BY timestamp DESC LIMIT 20;', 'dev')}></sutram-btn>
                            </sutram-stack>
                        </sutram-stack>

                        <sutram-textarea 
                            label="SQL Query" 
                            ?flush=${true}
                            .value=${this.query} 
                            ?monospace=${true} 
                            @sutram-input-changed=${e => this.query = e.detail.value}>
                        </sutram-textarea>

                        <sutram-stack direction="row" justify="end">
                            <sutram-async-btn 
                                label="▶ Execute Query" 
                                intent="primary" 
                                ?disabled=${this.loading} 
                                .onClick=${() => this._executeQuery()}>
                            </sutram-async-btn>
                        </sutram-stack>
                    </sutram-surface>

                    ${this.loading ? html`<sutram-spinner text="Executing query..."></sutram-spinner>` : ''}

                    ${this.result ? html`
                        <sutram-surface variant="tinted" intent=${this.result.status === 'success' ? 'success' : 'danger'} padding="xs">
                            ${this.result.status === 'success' ? html`
                                <strong>✅ ${this.result.type === 'select' ? `${this.result.row_count} row(s) returned` : `${this.result.affected_rows} row(s) affected`} (${this.result.elapsed_ms}ms)</strong>
                            ` : html`
                                <strong>❌ Query Error: ${this.result.error}</strong>
                            `}
                        </sutram-surface>

                        ${this.result.status === 'success' && this.result.type === 'select' ? html`
                            <sutram-surface variant="panel" padding="sm">
                                <sutram-scrub-track>
                                ${this.result.rows.length === 0 ? html`
                                    <sutram-empty-state text="Query returned 0 rows."></sutram-empty-state>
                                ` : html`
                                    <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.8rem;">
                                        <thead>
                                            <tr>
                                                ${this.result.columns.map(col => html`<th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">${col}</th>`)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${this.result.rows.map(row => html`
                                                <tr>
                                                    ${this.result.columns.map(col => {
                                                        const val = row[col];
                                                        const displayVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
                                                        return html`<td style="padding: 8px 12px; border-bottom: 1px solid var(--border); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayVal}">${displayVal}</td>`;
                                                    })}
                                                </tr>
                                            `)}
                                        </tbody>
                                    </table>
                                `}
                                </sutram-scrub-track>
                            </sutram-surface>
                        ` : ''}
                    ` : ''}
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-dev-sql', InSetuExtDevSql);

export class InSetuExtDevMemory extends InSetuElement {
    static get extensionName() { return 'dev'; }
    static properties = {
        memoryData: { type: Object },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.memoryData = DevStore.getState().memoryTelemetry || null;
        this.loading = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            DevStore,
            state => state.memoryTelemetry,
            (memoryTelemetry) => {
                this.memoryData = memoryTelemetry;
            }
        );
        this.fetchMemory();
    }

    onViewActivated() { this.fetchMemory(); }
    onForceRefresh() { this.fetchMemory(); }
    async fetchMemory(action = null) {
        this.loading = true;
        try {
            const res = action
                ? await this.api.post('system/memory', { action })
                : await this.api.get('system/memory?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                DevStore.setState({ memoryTelemetry: data });
                if (action === 'trim' && this.ui?.setGlobalStatus) {
                    this.ui.setGlobalStatus("🧹 Garbage collection & glibc malloc_trim completed", 2500);
                }
            }
        } catch (e) {
            console.error("Failed to fetch memory telemetry:", e);
        } finally {
            this.loading = false;
        }
    }

    _formatKbToMb(valStr) {
        if (!valStr) return 'N/A';
        const match = String(valStr).match(/(\d+)/);
        if (!match) return valStr;
        const mb = (parseInt(match[1], 10) / 1024).toFixed(1);
        return `${mb} MB`;
    }

    render() {
        const proc = this.memoryData?.process || {};
        const caches = this.memoryData?.caches || {};
        const threadsList = this.memoryData?.threads || [];
        const topObjects = this.memoryData?.top_object_types || [];
        const traceActive = !!this.memoryData?.tracemalloc_active;
        const traceTop = this.memoryData?.tracemalloc_top || [];

        return html`
            <sutram-view
                size="wide"
                titleText="Backend Memory & Heap Profiler"
                descriptionText="Live resident set size (RSS), glibc arena footprint, VFS cache occupancy, and Python GC object tables.">
                <sutram-btn slot="header-actions" ?compact=${true} icon="refresh-cw" label="Refresh" intent="neutral" @click=${() => this.fetchMemory()}></sutram-btn>
                <sutram-async-btn slot="header-actions" ?compact=${true} icon="sparkles" label="GC + Trim Heap" intent="success" .onClick=${() => this.fetchMemory('trim')}></sutram-async-btn>
                <sutram-async-btn
                    slot="header-actions"
                    ?compact=${true}
                    icon=${traceActive ? 'square' : 'activity'}
                    label=${traceActive ? 'Stop Tracemalloc' : 'Start Tracemalloc'}
                    intent=${traceActive ? 'danger' : 'highlight'}
                    .onClick=${() => this.fetchMemory(traceActive ? 'tracemalloc_stop' : 'tracemalloc_start')}>
                </sutram-async-btn>
                <sutram-stack direction="col" gap="lg">
                    ${this.loading && !this.memoryData ? html`<sutram-spinner text="Inspecting backend heap..."></sutram-spinner>` : ''}

                    <sutram-stack direction="grid" ?compact=${true}>
                        <sutram-surface variant="panel" padding="md" gap="xs">
                            <sutram-label text="RESIDENT RAM (VMRSS)"></sutram-label>
                            <h3>${this._formatKbToMb(proc.VmRSS)}</h3>
                            <sutram-label text="Physical memory actively in use"></sutram-label>
                        </sutram-surface>
                        <sutram-surface variant="panel" padding="md" gap="xs">
                            <sutram-label text="HEAP / STACK DATA (VMDATA)"></sutram-label>
                            <h3>${this._formatKbToMb(proc.VmData)}</h3>
                            <sutram-label text="Virtual heap + thread stack arenas"></sutram-label>
                        </sutram-surface>
                        <sutram-surface variant="panel" padding="md" gap="xs">
                            <sutram-label text="ACTIVE OS THREADS"></sutram-label>
                            <h3>${proc.Threads || 'N/A'}</h3>
                            <sutram-label text="Worker pool + Watchdog + WSGI"></sutram-label>
                        </sutram-surface>
                        <sutram-surface variant="panel" padding="md" gap="xs">
                            <sutram-label text="VFS READ CACHE"></sutram-label>
                            <h3>${caches.vfs_read_cache_mb ?? 0} MB</h3>
                            <sutram-label .text=${`${caches.vfs_read_cache_files ?? 0} files cached in RAM`}></sutram-label>
                        </sutram-surface>
                        <sutram-surface variant="panel" padding="md" gap="xs">
                            <sutram-label text="JSON CONFIG CACHE"></sutram-label>
                            <h3>${caches.json_config_cache_kb ?? 0} KB</h3>
                            <sutram-label .text=${`${caches.json_config_cache_files ?? 0} config files`}></sutram-label>
                        </sutram-surface>
                    </sutram-stack>

                    ${threadsList.length > 0 ? html`
                        <sutram-collapsible titleText="Active OS Threads Breakdown (${proc.Threads || threadsList.reduce((a, b) => a + b.count, 0)})" intent="neutral" ?open=${true}>
                            <sutram-surface variant="panel" padding="sm">
                                <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.8rem;">
                                    <thead>
                                        <tr>
                                            <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Thread Class / Pool Prefix</th>
                                            <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Active Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${threadsList.map(t => html`
                                            <tr>
                                                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: bold;">${t.group}</td>
                                                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">${t.count}</td>
                                            </tr>
                                        `)}
                                    </tbody>
                                </table>
                            </sutram-surface>
                        </sutram-collapsible>
                    ` : ''}

                    <sutram-collapsible titleText="Top Python Object Types in GC" intent="primary" ?open=${true}>
                        <sutram-surface variant="panel" padding="sm">
                            <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.8rem;">
                                <thead>
                                    <tr>
                                        <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Python Type</th>
                                        <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Instance Count</th>
                                        <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Shallow Size (MB)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topObjects.map(obj => html`
                                        <tr>
                                            <td style="padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: bold;">${obj.type}</td>
                                            <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">${obj.count.toLocaleString()}</td>
                                            <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">${obj.shallow_mb} MB</td>
                                        </tr>
                                    `)}
                                </tbody>
                            </table>
                        </sutram-surface>
                    </sutram-collapsible>

                    ${traceActive ? html`
                        <sutram-collapsible titleText="Tracemalloc Top Line Allocations (Active)" intent="highlight" ?open=${true}>
                            <sutram-surface variant="panel" padding="sm">
                                <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.8rem;">
                                    <thead>
                                        <tr>
                                            <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Source File & Line</th>
                                            <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Allocations</th>
                                            <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border);">Size (MB)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${traceTop.map(row => html`
                                            <tr>
                                                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">${row.location}</td>
                                                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">${row.count.toLocaleString()}</td>
                                                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: bold;">${row.size_mb} MB</td>
                                            </tr>
                                        `)}
                                    </tbody>
                                </table>
                            </sutram-surface>
                        </sutram-collapsible>
                    ` : ''}
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-dev-memory', InSetuExtDevMemory);

window.ExtensionRegistry.registerExtension('dev', {
    name: "Developer Tools",
    version: "1.0.0",
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "dev",
            label: "Dev",
            order: 90
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "dev",
            id: "dash",
            label: "Dashboard",
            icon: "activity",
            intent: "success",
            order: 1,
            component: "insetu-ext-dev-dash"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "dev",
            id: "logs",
            label: "Daemon Logs",
            icon: "terminal",
            intent: "neutral",
            order: 2,
            menuActions: [
                {
                    label: "Refresh Logs",
                    icon: "refresh-cw",
                    onClick: () => window.inSetu?.events?.emit('insetu:force-refresh', { parentId: 'dev', subId: 'logs' })
                }
            ],
            component: "insetu-ext-dev-logs"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "dev",
            id: "sql",
            label: "SQL Console",
            icon: "database",
            intent: "highlight",
            order: 3,
            component: "insetu-ext-dev-sql"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "dev",
            id: "memory",
            label: "Memory",
            icon: "cpu",
            intent: "warning",
            order: 4,
            component: "insetu-ext-dev-memory"
        }
    ],
});
