import { html } from 'lit';
import { InSetuElement, createExtensionStore, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
export const DevStore = createExtensionStore('Dev', {
    thrashingFiles: [],
    bridgeErrors: [],
    systemErrors: [],
    backendLogs: '',
    jsLogs: [],
    _inConsoleHook: false,
    _pendingJsLogs: [],
    _flushScheduled: false,
    memoryTelemetry: null,
    lastUpdate: null,
    forceRefreshTick: 0,
    setMemoryTelemetry: (memoryTelemetry) => DevStore.setState({ memoryTelemetry })
});

const MAX_JS_CONSOLE_LOGS = 250;

function _formatConsoleArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (arg instanceof Error) {
        return `${arg.name || 'Error'}: ${arg.message || ''}${arg.stack ? `\n${arg.stack}` : ''}`;
    }
    if (typeof arg === 'object') {
        try {
            return JSON.stringify(arg, null, 2);
        } catch (_) {
            return String(arg);
        }
    }
    return String(arg);
}

function _flushBrowserJsLogs() {
    const st = DevStore.getState();
    st._flushScheduled = false;
    if (!Array.isArray(st._pendingJsLogs) || st._pendingJsLogs.length === 0) return;
    const batch = st._pendingJsLogs.splice(0, st._pendingJsLogs.length);
    try {
        const cur = st.jsLogs || [];
        DevStore.setState({ jsLogs: [...batch.reverse(), ...cur].slice(0, MAX_JS_CONSOLE_LOGS) });
    } catch (_) {}
}

function _appendBrowserJsLog(level, args, stack = '') {
    const st = DevStore.getState();
    if (!st || st._inConsoleHook) return;
    st._inConsoleHook = true;
    try {
        const text = Array.from(args || []).map(_formatConsoleArg).join(' ');
        if (!text && !stack) return;
        if (!Array.isArray(st._pendingJsLogs)) st._pendingJsLogs = [];
        st._pendingJsLogs.push({
            id: `js_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            level,
            timestamp: Date.now(),
            text: text.slice(0, 6000),
            stack: stack ? String(stack).slice(0, 6000) : ''
        });
        if (!st._flushScheduled) {
            st._flushScheduled = true;
            queueMicrotask(_flushBrowserJsLogs);
        }
    } catch (_) {
    } finally {
        st._inConsoleHook = false;
    }
}

function _installBrowserConsoleInterceptor() {
    if (typeof window === 'undefined' || window.__inSetuConsoleIntercepted) return;
    window.__inSetuConsoleIntercepted = true;
    ['log', 'info', 'warn', 'error'].forEach(level => {
        const orig = console[level] ? console[level].bind(console) : null;
        if (!orig) return;
        console[level] = (...args) => {
            orig(...args);
            if (DevStore.getState()?._inConsoleHook) return;
            const errObj = args.find(a => a instanceof Error);
            _appendBrowserJsLog(level, args, errObj?.stack || '');
        };
    });
}
_installBrowserConsoleInterceptor();
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
    _prettyJson(text) {
        try { return JSON.stringify(JSON.parse(text), null, 2); } catch (_) { return text; }
    }
    async fetchMetrics() {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('dev')) return;
        const startedAt = Date.now();
        if (this._lastMetricsFetchAt && startedAt - this._lastMetricsFetchAt < 1500) return;
        this._lastMetricsFetchAt = startedAt;
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
                                                    <sutram-textarea readonly ?monospace=${true} .value=${err.patch_payload ? (typeof err.patch_payload === 'string' && (err.patch_payload.startsWith('{') || err.patch_payload.startsWith('[')) ? this._prettyJson(err.patch_payload) : err.patch_payload) : 'N/A'}></sutram-textarea>
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
        jsLogs: { type: Array },
        loading: { type: Boolean },
        _logSource: { type: String, state: true },
        _levelFilter: { type: String, state: true },
        _searchQuery: { type: String, state: true }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.backendLogs = '';
        this.jsLogs = [];
        this.loading = false;
        this._logSource = 'js';
        this._levelFilter = 'all';
        this._searchQuery = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            DevStore,
            state => ({
                backendLogs: state.backendLogs || '',
                jsLogs: state.jsLogs || []
            }),
            { autoFetch: () => this.fetchLogs() }
        );
        this.registerGlobalListener('error', window, (e) => {
            const loc = e.filename ? `${e.filename}:${e.lineno || 0}:${e.colno || 0}` : '';
            const msg = e.message || 'Uncaught JavaScript Error';
            const stack = e.error?.stack || loc;
            _appendBrowserJsLog('error', [`[Uncaught] ${msg}`], stack);
            this.api.post('dev/client_error', {
                source: 'Browser:onerror',
                error_type: e.error?.name || 'UncaughtError',
                message: msg,
                traceback: stack,
                payload: loc
            }).catch(() => {});
        });
        this.registerGlobalListener('unhandledrejection', window, (e) => {
            const reason = e.reason;
            const msg = reason instanceof Error ? reason.message : _formatConsoleArg(reason);
            const stack = reason instanceof Error ? (reason.stack || '') : '';
            _appendBrowserJsLog('error', [`[UnhandledRejection] ${msg}`], stack);
            this.api.post('dev/client_error', {
                source: 'Browser:Promise',
                error_type: reason?.name || 'UnhandledRejection',
                message: String(msg || 'Unhandled Promise Rejection'),
                traceback: stack
            }).catch(() => {});
        });
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
    _getFilteredJsLogs() {
        const all = Array.isArray(this.jsLogs) ? this.jsLogs : [];
        const byLevel = this._levelFilter === 'all'
            ? all
            : all.filter(item => item.level === this._levelFilter);
        const q = (this._searchQuery || '').trim().toLowerCase();
        if (!q) return byLevel;
        return byLevel.filter(item =>
            (item.text || '').toLowerCase().includes(q) ||
            (item.stack || '').toLowerCase().includes(q)
        );
    }
    async copyLogs() {
        const textToCopy = this._logSource === 'js'
            ? this._getFilteredJsLogs().map(item => `[${new Date(item.timestamp).toISOString()}] [${item.level.toUpperCase()}] ${item.text}${item.stack ? `\n${item.stack}` : ''}`).join('\n\n')
            : this.backendLogs;
        if (!textToCopy) return;
        try {
            await this.utils.copyRawText(textToCopy);
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
        const isJs = this._logSource === 'js';
        const filteredJs = isJs ? this._getFilteredJsLogs() : [];
        const errCount = (this.jsLogs || []).filter(x => x.level === 'error').length;
        const warnCount = (this.jsLogs || []).filter(x => x.level === 'warn').length;

        return html`
            <sutram-view
                size="wide"
                .titleText=${isJs ? "Browser JS Console" : "Daemon Logs"}
                .descriptionText=${isJs ? "Live mobile/browser console.log, warn, error, and uncaught exception stream." : "Recent systemd output for insetu.service."}>
                ${this.loading && !isJs ? html`<sutram-spinner slot="header-actions" text="Fetching..."></sutram-spinner>` : ''}
                <sutram-btn
                    slot="header-actions"
                    ?compact=${true}
                    icon="terminal"
                    label=${`JS Console (${(this.jsLogs || []).length})`}
                    intent=${isJs ? 'primary' : 'neutral'}
                    ?active=${isJs}
                    @click=${() => { this._logSource = 'js'; }}>
                </sutram-btn>
                <sutram-btn
                    slot="header-actions"
                    ?compact=${true}
                    icon="server"
                    label="Daemon Logs"
                    intent=${!isJs ? 'primary' : 'neutral'}
                    ?active=${!isJs}
                    @click=${() => { this._logSource = 'daemon'; this.fetchLogs(); }}>
                </sutram-btn>
                <sutram-btn slot="header-actions" ?compact=${true} icon="copy" label="Copy" intent="neutral" @click=${() => this.copyLogs()}></sutram-btn>
                ${isJs ? html`
                    <sutram-btn
                        slot="header-actions"
                        ?compact=${true}
                        icon="trash-2"
                        label="Clear"
                        intent="danger"
                        @click=${() => DevStore.setState({ jsLogs: [] })}>
                    </sutram-btn>
                ` : html`
                    <sutram-async-btn
                        slot="header-actions"
                        ?compact=${true}
                        icon="download"
                        label="Export Boot Logs"
                        intent="primary"
                        .onClick=${this._getDownloadLogsAction()}>
                    </sutram-async-btn>
                `}

                ${isJs ? html`
                    <sutram-stack direction="col" gap="sm">
                        <sutram-surface variant="panel" padding="xs" gap="xs">
                            <sutram-stack direction="row" justify="between" align="center" gap="xs" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                    <sutram-pill ?compact=${true} labelText=${`All (${(this.jsLogs || []).length})`} ?active=${this._levelFilter === 'all'} @sutram-pill-toggled=${() => { this._levelFilter = 'all'; }}></sutram-pill>
                                    <sutram-pill ?compact=${true} labelText=${`Errors (${errCount})`} ?active=${this._levelFilter === 'error'} @sutram-pill-toggled=${() => { this._levelFilter = 'error'; }}></sutram-pill>
                                    <sutram-pill ?compact=${true} labelText=${`Warnings (${warnCount})`} ?active=${this._levelFilter === 'warn'} @sutram-pill-toggled=${() => { this._levelFilter = 'warn'; }}></sutram-pill>
                                    <sutram-pill ?compact=${true} labelText="Info / Log" ?active=${this._levelFilter === 'log'} @sutram-pill-toggled=${() => { this._levelFilter = 'log'; }}></sutram-pill>
                                </sutram-stack>
                                <sutram-input
                                    ?flush=${true}
                                    ?grow=${true}
                                    placeholder="Filter console output..."
                                    .value=${this._searchQuery}
                                    @sutram-input-changed=${e => { this._searchQuery = e.detail.value; }}>
                                </sutram-input>
                            </sutram-stack>
                        </sutram-surface>

                        ${filteredJs.length === 0 ? html`
                            <sutram-empty-state text="No browser console entries match the current filter."></sutram-empty-state>
                        ` : filteredJs.map(entry => {
                            const levelIntent = entry.level === 'error' ? 'danger' : (entry.level === 'warn' ? 'warning' : 'neutral');
                            return html`
                                <sutram-surface variant="inset" .intent=${levelIntent} border="left" padding="xs" gap="xs">
                                    <sutram-stack direction="row" justify="between" align="center" gap="xs">
                                        <sutram-stack direction="row" align="center" gap="xs">
                                            <sutram-tag .text=${entry.level.toUpperCase()} .intent=${levelIntent}></sutram-tag>
                                            <sutram-label ?monospace=${true} .text=${this.utils.formatDate(entry.timestamp)}></sutram-label>
                                        </sutram-stack>
                                        <sutram-btn
                                            ?compact=${true}
                                            intent="neutral"
                                            icon="clipboard"
                                            label="Copy"
                                            @click=${() => this.utils.copyRawText(`${entry.text}${entry.stack ? `\n${entry.stack}` : ''}`, "📋 Console entry copied!")}>
                                        </sutram-btn>
                                    </sutram-stack>
                                    <sutram-label ?monospace=${true} ?multiline=${true} .intent=${levelIntent === 'neutral' ? 'neutral' : levelIntent} .text=${entry.text}></sutram-label>
                                    ${entry.stack ? html`
                                        <sutram-collapsible ?compact=${true} ?open=${false} intent="neutral" titleText="Stack Trace">
                                            <pre>${entry.stack}</pre>
                                        </sutram-collapsible>
                                    ` : ''}
                                </sutram-surface>
                            `;
                        })}
                    </sutram-stack>
                ` : html`
                    <sutram-surface variant="panel" padding="md">
                        <pre>${this.backendLogs || 'No logs available.'}</pre>
                    </sutram-surface>
                `}
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-dev-logs', InSetuExtDevLogs);

import { InSetuExtDevMemory, InSetuExtDevSql } from '/static/extensions/dev/dev_sql_and_memory.js';
export { InSetuExtDevMemory, InSetuExtDevSql };

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
