import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';

const SERVER_MODE_OPTIONS = [
    { value: 'auto', label: 'Auto-Detect' },
    { value: 'static', label: 'Static HTTP' },
    { value: 'uvicorn', label: 'Uvicorn (ASGI)' },
    { value: 'flask', label: 'Flask (WSGI)' },
    { value: 'django', label: 'Django' },
    { value: 'streamlit', label: 'Streamlit' },
    { value: 'gradio', label: 'Gradio' },
    { value: 'marimo', label: 'Marimo' },
    { value: 'vite', label: 'Vite' },
    { value: 'storybook', label: 'Storybook' },
    { value: 'mkdocs', label: 'MkDocs' },
    { value: 'hugo', label: 'Hugo' },
    { value: 'custom', label: 'Custom Command' }
];

export const PreviewStore = createExtensionStore('Preview', {
    servers: {},
    selectedRepo: '',
    subpath: '',
    autoReload: false,
    reloadTick: Date.now(),
    configOpen: false,
    logsOpen: false,
    logs: [],
    loading: false,
    fetchStatus: async () => {
        PreviewStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace.get('preview/status?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                const servers = data.servers || {};
                const curRepo = PreviewStore.getState().selectedRepo;
                const availableRepos = Object.keys(servers);
                const nextRepo = (curRepo && servers[curRepo]) ? curRepo : (availableRepos[0] || '');
                const activeSrv = nextRepo ? servers[nextRepo] : null;
                PreviewStore.setState({
                    servers,
                    selectedRepo: nextRepo,
                    logs: activeSrv?.logs || []
                });
            }
        } catch (e) {
            console.warn('[Preview] Failed to fetch server status:', e);
        } finally {
            PreviewStore.setState({ loading: false });
        }
    },
    fetchLogs: async (repoOverride = null) => {
        const repo = repoOverride || PreviewStore.getState().selectedRepo;
        if (!repo) return;
        try {
            const res = await window.inSetu.api.workspace.get(`preview/logs?repo=${encodeURIComponent(repo)}&t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                PreviewStore.setState(state => ({
                    logs: data.logs || [],
                    servers: state.servers[repo]
                        ? { ...state.servers, [repo]: { ...state.servers[repo], status: data.status, port: data.port } }
                        : state.servers
                }));
            }
        } catch (e) {}
    }
}, {
    localSync: ['selectedRepo', 'subpath', 'autoReload']
});

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Preview = PreviewStore;

export class InSetuExtPreview extends InSetuElement {
    static get extensionName() { return 'preview'; }
    static properties = {
        servers: { type: Object },
        selectedRepo: { type: String },
        subpath: { type: String },
        autoReload: { type: Boolean },
        reloadTick: { type: Number },
        configOpen: { type: Boolean },
        logsOpen: { type: Boolean },
        logs: { type: Array },
        loading: { type: Boolean },
        _draftConfig: { type: Object }
    };

    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
            container-type: inline-size;
        }
        .preview-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 8px 12px;
            background: var(--input-bg);
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
            flex-wrap: wrap;
        }
        .toolbar-group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            min-width: 0;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 999px;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            font-weight: 700;
            border: 1px solid var(--border);
            background: var(--bg);
            white-space: nowrap;
        }
        .status-badge.running, .status-badge.external {
            color: var(--intent-success);
            border-color: color-mix(in srgb, var(--intent-success) 45%, transparent);
            background: color-mix(in srgb, var(--intent-success) 12%, transparent);
        }
        .status-badge.crashed {
            color: var(--intent-danger);
            border-color: color-mix(in srgb, var(--intent-danger) 45%, transparent);
            background: color-mix(in srgb, var(--intent-danger) 12%, transparent);
        }
        .status-badge.stopped {
            color: var(--text-muted);
        }
        .config-drawer {
            padding: 12px 15px;
            background: var(--pane-bg);
            border-bottom: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex-shrink: 0;
        }
        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
            align-items: end;
        }
        .iframe-stage {
            flex: 1;
            min-height: 0;
            width: 100%;
            position: relative;
            background: var(--preview-canvas-bg, var(--pane-bg));
            display: flex;
            flex-direction: column;
        }
        .iframe-stage.empty {
            background: var(--bg);
            align-items: center;
            justify-content: center;
        }
        iframe {
            flex: 1;
            width: 100%;
            height: 100%;
            border: none;
            background: var(--preview-canvas-bg, var(--pane-bg));
        }
        .logs-drawer {
            flex-shrink: 0;
            border-top: 1px solid var(--border);
            background: var(--bg-deep);
            display: flex;
            flex-direction: column;
            max-height: 38%;
        }
        .logs-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 12px;
            background: var(--input-bg);
            cursor: pointer;
            user-select: none;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            font-weight: bold;
            color: var(--text-muted);
        }
        .logs-body {
            padding: 10px 14px;
            margin: 0;
            overflow-y: auto;
            font-family: var(--font-mono);
            font-size: 0.78rem;
            line-height: 1.45;
            color: var(--text);
            background: var(--bg-deep);
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 220px;
        }
    `];

    constructor() {
        super();
        const st = PreviewStore.getState();
        this.servers = st.servers || {};
        this.selectedRepo = st.selectedRepo || '';
        this.subpath = st.subpath || '';
        this.autoReload = !!st.autoReload;
        this.reloadTick = st.reloadTick || Date.now();
        this.configOpen = !!st.configOpen;
        this.logsOpen = !!st.logsOpen;
        this.logs = st.logs || [];
        this.loading = !!st.loading;
        this._draftConfig = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            PreviewStore,
            state => ({
                servers: state.servers || {},
                selectedRepo: state.selectedRepo || '',
                subpath: state.subpath || '',
                autoReload: !!state.autoReload,
                reloadTick: state.reloadTick || 0,
                configOpen: !!state.configOpen,
                logsOpen: !!state.logsOpen,
                logs: state.logs || [],
                loading: !!state.loading
            }),
            { autoFetch: 'fetchStatus' }
        );

        const debouncedReload = this.utils.debounce(() => {
            PreviewStore.setState({ reloadTick: Date.now() });
        }, 500);

        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            if (!this.autoReload || !this.selectedRepo) return;
            if (document.body.getAttribute('data-theme') === 'e-ink') return;
            const srv = this.servers?.[this.selectedRepo];
            if (!srv || (srv.status !== 'running' && srv.status !== 'external')) return;
            const mutations = e.detail?.mutations || [];
            const prefix = `vfs://${this.selectedRepo}/`;
            const webExts = ['.html', '.htm', '.js', '.mjs', '.ts', '.css', '.json', '.py', '.svg', '.md', '.toml', '.yaml', '.yml'];
            const relevant = mutations.some(m => {
                const fp = (m.filepath || '').toLowerCase();
                return fp.startsWith(prefix.toLowerCase()) && webExts.some(ext => fp.endsWith(ext));
            });
            if (relevant) debouncedReload();
        });

        this.registerGlobalListener('insetu:preview:open-file', window, async (e) => {
            const rawFp = e.detail?.filepath || '';
            const isDir = !!e.detail?.isDir;
            if (!rawFp) return;

            const parsed = this.utils.parseURI(rawFp);
            const repo = parsed.repo;
            if (!repo) return;

            await PreviewStore.getState().fetchStatus();
            const srv = PreviewStore.getState().servers?.[repo] || {};
            const serveDir = (srv.serve_dir && srv.serve_dir !== '.') ? srv.serve_dir.replace(/^\/+|\/+$/g, '') : '';

            let relSub = (parsed.relativePath || '').replace(/^\/+/, '');
            if (serveDir && relSub.startsWith(serveDir + '/')) {
                relSub = relSub.slice(serveDir.length + 1);
            } else if (serveDir && relSub === serveDir) {
                relSub = '';
            }
            if (isDir && relSub && !relSub.endsWith('/')) {
                relSub += '/';
            }

            PreviewStore.setState({
                selectedRepo: repo,
                subpath: relSub,
                reloadTick: Date.now()
            });
            this._syncDraftFromServer(repo);
            const curStatus = PreviewStore.getState().servers?.[repo]?.status;
            if (curStatus !== 'running' && curStatus !== 'external') {
                await this._startServer(repo);
            }
        });

        this.registerGlobalListener('insetu-preview-settings-changed', window, async () => {
            await PreviewStore.getState().fetchStatus();
            this._syncDraftFromServer(this.selectedRepo);
        });
    }

    onForceRefresh() {
        PreviewStore.setState({ reloadTick: Date.now() });
        PreviewStore.getState().fetchStatus();
        if (this.logsOpen) {
            PreviewStore.getState().fetchLogs();
        }
    }

    _syncDraftFromServer(repo = this.selectedRepo) {
        const srv = this.servers?.[repo] || {};
        this._draftConfig = {
            server_mode: srv.server_mode || 'auto',
            serve_dir: srv.serve_dir || '.',
            port: srv.port || 0,
            bind_host: srv.bind_host || '0.0.0.0',
            entry_target: srv.entry_target || '',
            tailscale_https: !!srv.tailscale_https,
            auto_start: !!srv.auto_start
        };
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('selectedRepo') || changedProperties.has('servers')) {
            if (this.selectedRepo && (!this._draftConfig || this._lastDraftRepo !== this.selectedRepo)) {
                this._lastDraftRepo = this.selectedRepo;
                this._syncDraftFromServer(this.selectedRepo);
            }
        }
    }
    _resolvePreviewUrl(srv) {
        if (!srv || !srv.port) return '';
        const host = window.location.hostname || '127.0.0.1';
        const isLocal = host === '127.0.0.1' || host === 'localhost';
        const protocol = (!isLocal && srv.tailscale_https) ? 'https:' : 'http:';
        const baseOrigin = isLocal ? `http://127.0.0.1:${srv.port}` : `${protocol}//${host}:${srv.port}`;
        const cleanSub = (this.subpath || '').replace(/^\/+/, '');
        const sep = cleanSub.includes('?') ? '&' : '?';
        return `${baseOrigin}/${cleanSub}${sep}_t=${this.reloadTick || 1}`;
    }

    async _startServer(repoOverride = null) {
        const repo = repoOverride || this.selectedRepo;
        if (!repo) return;
        const payload = {
            repo,
            ...(this._draftConfig || {})
        };
        const res = await this.api.post('start', payload);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to start server.');
        }
        const data = await res.json();
        const srv = data.server;
        const crashed = srv?.status === 'crashed';
        PreviewStore.setState(state => ({
            servers: { ...state.servers, [repo]: srv },
            logs: srv?.logs || [],
            logsOpen: crashed ? true : state.logsOpen,
            reloadTick: Date.now()
        }));
        this._syncDraftFromServer(repo);
        if (crashed) {
            this.setStatus(`Server for '${repo}' exited prematurely. Check logs.`, 4000, true);
        } else {
            this.setStatus(`Server running on port :${srv.port}`, 2500);
        }
    }

    async _stopServer() {
        if (!this.selectedRepo) return;
        const res = await this.api.post('stop', { repo: this.selectedRepo });
        if (res.ok) {
            const data = await res.json();
            PreviewStore.setState(state => ({
                servers: { ...state.servers, [this.selectedRepo]: data.server },
                logs: data.server?.logs || []
            }));
            this.setStatus(`Stopped server for '${this.selectedRepo}'.`, 2000);
        }
    }

    async _saveRepoConfig() {
        if (!this.selectedRepo) return;
        const res = await this.api.post(`settings?repo=${encodeURIComponent(this.selectedRepo)}`, this._draftConfig);
        if (res.ok) {
            await PreviewStore.getState().fetchStatus();
            this._syncDraftFromServer(this.selectedRepo);
            this.setStatus(`Saved preview settings for '${this.selectedRepo}'.`, 2000);
        }
    }

    async _toggleAutoBoot(checked) {
        if (!this.selectedRepo) return;
        this._draftConfig = { ...this._draftConfig, auto_start: checked };
        await this.api.post(`settings?repo=${encodeURIComponent(this.selectedRepo)}`, { auto_start: checked });
        await PreviewStore.getState().fetchStatus();
    }

    render() {
        const allRepos = this.ecosystem?.allRepos?.length > 0
            ? this.ecosystem.allRepos
            : Object.keys(this.servers || {});
        const activeRepo = this.selectedRepo || allRepos[0] || '';
        const srv = (activeRepo && this.servers?.[activeRepo]) ? this.servers[activeRepo] : null;
        const status = srv?.status || 'stopped';
        const isRunning = status === 'running' || status === 'external';
        const previewUrl = isRunning ? this._resolvePreviewUrl(srv) : '';

        const modeLabel = srv
            ? (srv.server_mode === 'auto' ? `Auto (${srv.detected_mode || 'static'})` : srv.server_mode)
            : 'auto';

        return html`
            <div class="preview-toolbar">
                <div class="toolbar-group">
                    <sutram-select
                        ?flush=${true}
                        style="width: 165px; margin: 0;"
                        .value=${activeRepo}
                        .options=${allRepos.map(r => ({ value: r, label: r }))}
                        @sutram-input-changed=${(e) => {
                            const nextRepo = e.detail.value;
                            PreviewStore.setState({ selectedRepo: nextRepo, subpath: '' });
                            this._syncDraftFromServer(nextRepo);
                            PreviewStore.getState().fetchLogs(nextRepo);
                        }}>
                    </sutram-select>

                    <sutram-input
                        ?flush=${true}
                        style="width: 170px; margin: 0; font-family: var(--font-mono);"
                        placeholder="subpath (e.g. index.html)"
                        .value=${this.subpath || ''}
                        @sutram-input-changed=${(e) => {
                            PreviewStore.setState({ subpath: e.detail.value, reloadTick: Date.now() });
                        }}>
                    </sutram-input>

                    <span class="status-badge ${status}">
                        <yv-icon name="${isRunning ? 'check-circle-2' : (status === 'crashed' ? 'alert-triangle' : 'power')}" style="width: 12px; height: 12px;"></yv-icon>
                        <span>${status.toUpperCase()}</span>
                        ${srv?.port ? html`<span>:${srv.port}</span>` : ''}
                        <span style="opacity: 0.75;">(${modeLabel})</span>
                    </span>
                </div>

                <div class="toolbar-group">
                    ${!isRunning ? html`
                        <sutram-async-btn
                            size="sm"
                            intent="success"
                            icon="play"
                            label="Start"
                            .onClick=${() => this._startServer()}>
                        </sutram-async-btn>
                    ` : html`
                        <sutram-async-btn
                            size="sm"
                            intent="warning"
                            icon="rotate-cw"
                            label="Restart"
                            .onClick=${() => this._startServer()}>
                        </sutram-async-btn>
                        ${status === 'running' ? html`
                            <sutram-async-btn
                                size="sm"
                                intent="danger"
                                icon="square"
                                label="Stop"
                                .onClick=${() => this._stopServer()}>
                            </sutram-async-btn>
                        ` : ''}
                        <sutram-btn
                            size="sm"
                            intent="primary"
                            icon="refresh-cw"
                            label="Reload"
                            @click=${() => PreviewStore.setState({ reloadTick: Date.now() })}>
                        </sutram-btn>
                    `}

                    <sutram-btn
                        size="sm"
                        intent="${this.autoReload ? 'highlight' : 'neutral'}"
                        ?active=${this.autoReload}
                        icon="zap"
                        label="Auto"
                        title="Auto-reload iframe when repository files change"
                        @click=${() => PreviewStore.setState({ autoReload: !this.autoReload })}>
                    </sutram-btn>

                    <sutram-btn
                        size="sm"
                        intent="${srv?.auto_start ? 'primary' : 'neutral'}"
                        ?active=${!!srv?.auto_start}
                        icon="pin"
                        label="Boot"
                        title="Auto-start this server on workspace boot"
                        @click=${() => this._toggleAutoBoot(!srv?.auto_start)}>
                    </sutram-btn>

                    <sutram-btn
                        size="sm"
                        intent="${this.configOpen ? 'primary' : 'neutral'}"
                        ?active=${this.configOpen}
                        icon="sliders"
                        label="Config"
                        @click=${() => {
                            this._syncDraftFromServer(activeRepo);
                            PreviewStore.setState({ configOpen: !this.configOpen });
                        }}>
                    </sutram-btn>

                    ${isRunning && previewUrl ? html`
                        <sutram-btn
                            size="sm"
                            intent="neutral"
                            icon="external-link"
                            label="Open"
                            title="Open in new browser tab"
                            @click=${() => window.open(previewUrl, '_blank', 'noopener')}>
                        </sutram-btn>
                    ` : ''}
                    <insetu-projection-window-controls .filepath=${'preview:preview'}></insetu-projection-window-controls>
                </div>
            </div>

            ${this.configOpen && activeRepo ? html`
                <div class="config-drawer">
                    <div class="config-grid">
                        <sutram-select
                            label="Server Profile"
                            ?flush=${true}
                            .value=${this._draftConfig.server_mode || 'auto'}
                            .options=${SERVER_MODE_OPTIONS}
                            @sutram-input-changed=${(e) => {
                                this._draftConfig = { ...this._draftConfig, server_mode: e.detail.value };
                                this.requestUpdate();
                            }}>
                        </sutram-select>

                        <sutram-input
                            label="Serve Subdirectory"
                            ?flush=${true}
                            placeholder="."
                            .value=${this._draftConfig.serve_dir || '.'}
                            @sutram-input-changed=${(e) => {
                                this._draftConfig = { ...this._draftConfig, serve_dir: e.detail.value };
                            }}>
                        </sutram-input>

                        <sutram-input
                            label="Sticky Port (0 = Auto)"
                            type="number"
                            ?flush=${true}
                            .value=${String(this._draftConfig.port ?? 0)}
                            @sutram-input-changed=${(e) => {
                                this._draftConfig = { ...this._draftConfig, port: parseInt(e.detail.value || '0', 10) || 0 };
                            }}>
                        </sutram-input>

                        <sutram-select
                            label="Bind Host"
                            ?flush=${true}
                            .value=${this._draftConfig.bind_host || '0.0.0.0'}
                            .options=${[
                                { value: '0.0.0.0', label: '0.0.0.0 (LAN / Tailnet)' },
                                { value: '127.0.0.1', label: '127.0.0.1 (Loopback)' }
                            ]}
                            @sutram-input-changed=${(e) => {
                                this._draftConfig = { ...this._draftConfig, bind_host: e.detail.value };
                            }}>
                        </sutram-select>

                        <sutram-input
                            label="Entry Target / Custom Command"
                            ?flush=${true}
                            placeholder=${srv?.inferred_target || 'e.g. main:app or npm run dev -- --port {port}'}
                            .value=${this._draftConfig.entry_target || ''}
                            @sutram-input-changed=${(e) => {
                                this._draftConfig = { ...this._draftConfig, entry_target: e.detail.value };
                            }}>
                        </sutram-input>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: 4px;">
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                            <sutram-toggle
                                label="Bind Tailscale HTTPS Serve"
                                ?flush=${true}
                                .checked=${!!this._draftConfig.tailscale_https}
                                @sutram-input-changed=${(e) => {
                                    this._draftConfig = { ...this._draftConfig, tailscale_https: e.detail.value };
                                }}>
                            </sutram-toggle>
                            <sutram-toggle
                                label="Auto-Start on Workspace Boot"
                                ?flush=${true}
                                .checked=${!!this._draftConfig.auto_start}
                                @sutram-input-changed=${(e) => {
                                    this._draftConfig = { ...this._draftConfig, auto_start: e.detail.value };
                                }}>
                            </sutram-toggle>
                        </div>

                        <div style="display: flex; gap: 8px;">
                            <sutram-async-btn
                                size="sm"
                                intent="primary"
                                icon="save"
                                label="Save Profile"
                                .onClick=${() => this._saveRepoConfig()}>
                            </sutram-async-btn>
                            <sutram-async-btn
                                size="sm"
                                intent="success"
                                icon="play"
                                label="Save & Start"
                                .onClick=${async () => {
                                    await this._saveRepoConfig();
                                    await this._startServer();
                                }}>
                            </sutram-async-btn>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="iframe-stage ${isRunning ? '' : 'empty'}">
                ${isRunning && previewUrl ? html`
                    <iframe
                        src=${previewUrl}
                        allow="clipboard-read; clipboard-write; fullscreen"
                        title="Live App Preview (${activeRepo})">
                    </iframe>
                ` : html`
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 30px; text-align: center; max-width: 460px;">
                        <yv-icon name="${status === 'crashed' ? 'alert-triangle' : 'globe'}" style="width: 44px; height: 44px; color: ${status === 'crashed' ? 'var(--intent-danger)' : 'var(--intent-highlight)'}; opacity: 0.85;"></yv-icon>
                        <h3 style="margin: 0; color: var(--text);">
                            ${status === 'crashed' ? `Server Crashed (${activeRepo})` : `Preview Server Stopped (${activeRepo || 'No Repo'})`}
                        </h3>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
                            ${status === 'crashed'
                                ? 'The development server exited during startup. Inspect the Server Output Logs below for traceback details.'
                                : `Detected profile: ${modeLabel}. Click Start to launch a dedicated local server instance for '${activeRepo}'.`}
                        </p>
                        ${activeRepo ? html`
                            <sutram-async-btn
                                intent="success"
                                icon="play"
                                label="Start ${activeRepo} Server"
                                .onClick=${() => this._startServer()}>
                            </sutram-async-btn>
                        ` : ''}
                    </div>
                `}
            </div>

            <div class="logs-drawer">
                <div class="logs-header" @click=${() => {
                    const nextOpen = !this.logsOpen;
                    PreviewStore.setState({ logsOpen: nextOpen });
                    if (nextOpen) PreviewStore.getState().fetchLogs();
                }}>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                        <yv-icon name="${this.logsOpen ? 'chevron-down' : 'chevron-right'}" style="width: 14px; height: 14px;"></yv-icon>
                        <yv-icon name="terminal" style="width: 14px; height: 14px; color: var(--intent-highlight);"></yv-icon>
                        <span>Server Output Logs (${(this.logs || []).length} lines)</span>
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px;" @click=${(e) => e.stopPropagation()}>
                        <sutram-btn
                            size="sm"
                            intent="neutral"
                            icon="refresh-cw"
                            label="Refresh Logs"
                            @click=${() => PreviewStore.getState().fetchLogs()}>
                        </sutram-btn>
                    </div>
                </div>
                ${this.logsOpen ? html`
                    <pre class="logs-body">${(this.logs && this.logs.length > 0) ? this.logs.join('\n') : 'No output logged yet.'}</pre>
                ` : ''}
            </div>
        `;
    }
}
customElements.define('insetu-ext-preview', InSetuExtPreview);

const openInPreview = (data, isDir = false) => {
    const rawFp = data?.filepath || data?.folderpath || '';
    if (!rawFp) return;
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (layout) {
        const col = layout.focusedColumn || 'center';
        const slot = window.ExtensionRegistry?.getLayoutSlots?.().find(s => s.id === 'preview:preview' || s.rawId === 'preview');
        if (slot) {
            if (!layout.columns[col]?.pinned?.some(p => p.id === slot.id)) {
                layout.pinToColumn(col, slot);
            }
            layout.setActiveProjection(col, slot.id);
            layout.setFocusedColumn(col);
        }
    }
    setTimeout(() => {
        window.inSetu.events.emit('insetu:preview:open-file', { filepath: rawFp, isDir });
    }, 50);
};

window.ExtensionRegistry.registerExtension('preview', {
    name: "App Server & Preview",
    version: "1.0.0",
    offline_mode: "none",
    entityActions: [
        {
            targetEntity: 'file',
            targetEntities: ['file', 'folder'],
            id: 'preview-html-file',
            label: 'Preview Web App',
            icon: 'globe',
            intent: 'highlight',
            group: 'tools',
            vfsBound: true,
            order: 25,
            match: (data) => {
                if (data?.isSkeleton) return false;
                if (data?.isDir) return true;
                const fp = (data?.filepath || '').toLowerCase();
                return fp.endsWith('.html') || fp.endsWith('.htm');
            },
            onClick: (data) => openInPreview(data, !!data?.isDir)
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "ctrl",
            id: "preview",
            label: "Preview",
            icon: "globe",
            intent: "highlight",
            order: 5,
            allow_popout: true,
            component: "insetu-ext-preview"
        }
    ]
});