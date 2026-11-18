/**
 * SQL Console (InSetuExtDevSql) and Backend Memory & Heap Profiler (InSetuExtDevMemory) views for the Developer Tools extension.
 */
import { html } from 'lit';
import { InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { DevStore } from '/static/extensions/dev/ext_dev.js';

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

    onWorkspaceLoad() { this._fetchDatabases(); }
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
                                    <table class="dev-table">
                                        <thead>
                                            <tr>
                                                ${this.result.columns.map(col => html`<th>${col}</th>`)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${this.result.rows.map(row => html`
                                                <tr>
                                                    ${this.result.columns.map(col => {
                                                        const val = row[col];
                                                        const displayVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
                                                        return html`<td class="cell-truncate" title="${displayVal}">${displayVal}</td>`;
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
if (!customElements.get('insetu-ext-dev-sql')) {
    customElements.define('insetu-ext-dev-sql', InSetuExtDevSql);
}

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
                DevStore.getState().setMemoryTelemetry(data);
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
                                <table class="dev-table">
                                    <thead>
                                        <tr>
                                            <th>Thread Class / Pool Prefix</th>
                                            <th>Active Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${threadsList.map(t => html`
                                            <tr>
                                                <td class="cell-bold">${t.group}</td>
                                                <td>${t.count}</td>
                                            </tr>
                                        `)}
                                    </tbody>
                                </table>
                            </sutram-surface>
                        </sutram-collapsible>
                    ` : ''}

                    <sutram-collapsible titleText="Top Python Object Types in GC" intent="primary" ?open=${true}>
                        <sutram-surface variant="panel" padding="sm">
                            <table class="dev-table">
                                <thead>
                                    <tr>
                                        <th>Python Type</th>
                                        <th>Instance Count</th>
                                        <th>Shallow Size (MB)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topObjects.map(obj => html`
                                        <tr>
                                            <td class="cell-bold">${obj.type}</td>
                                            <td>${obj.count.toLocaleString()}</td>
                                            <td>${obj.shallow_mb} MB</td>
                                        </tr>
                                    `)}
                                </tbody>
                            </table>
                        </sutram-surface>
                    </sutram-collapsible>

                    ${traceActive ? html`
                        <sutram-collapsible titleText="Tracemalloc Top Line Allocations (Active)" intent="highlight" ?open=${true}>
                            <sutram-surface variant="panel" padding="sm">
                                <table class="dev-table">
                                    <thead>
                                        <tr>
                                            <th>Source File & Line</th>
                                            <th>Allocations</th>
                                            <th>Size (MB)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${traceTop.map(row => html`
                                            <tr>
                                                <td>${row.location}</td>
                                                <td>${row.count.toLocaleString()}</td>
                                                <td class="cell-bold">${row.size_mb} MB</td>
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
if (!customElements.get('insetu-ext-dev-memory')) {
    customElements.define('insetu-ext-dev-memory', InSetuExtDevMemory);
}
