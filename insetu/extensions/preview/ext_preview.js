import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

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

const LAN_LEASE_OPTIONS = [
    { value: 'run', label: 'Until this server stops' },
    { value: '15m', label: 'For 15 minutes' },
    { value: '1h', label: 'For 1 hour' },
    { value: '8h', label: 'For 8 hours' }
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
    pendingApproval: null,
    lanDuration: 'run',
    fetchStatus: async () => {
        PreviewStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.get('preview/status?t=' + Date.now());
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
            const res = await window.inSetu.api.get(`preview/logs?repo=${encodeURIComponent(repo)}&t=${Date.now()}`);
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
        pendingApproval: { type: Object },
        lanDuration: { type: String },
        _draftConfig: { type: Object }
    };

    static styles = [sharedStyles];

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
        this.pendingApproval = st.pendingApproval || null;
        this.lanDuration = st.lanDuration || 'run';
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
                loading: !!state.loading,
                pendingApproval: state.pendingApproval || null,
                lanDuration: state.lanDuration || 'run'
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
            const parsed = new this.utils.InSetuURI(rawFp);
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
            bind_host: srv.bind_host || '127.0.0.1',
            entry_target: srv.entry_target || '',
            tailscale_https: !!srv.tailscale_https,
            static_cors: !!srv.static_cors,
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
    _isLocalViewer() {
        const host = window.location.hostname || '127.0.0.1';
        return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
    }

    // A loopback-only server is unreachable from another device unless Tailscale HTTPS proxies it (S2).
    _isUnreachableHere(srv) {
        // An adopted external server binds wherever its owner chose, so only managed servers are judged here.
        return !!srv && srv.status === 'running' && !this._isLocalViewer() && srv.exposure === 'loopback';
    }

    _resolvePreviewUrl(srv) {
        if (!srv || !srv.port || this._isUnreachableHere(srv)) return '';
        const host = window.location.hostname || '127.0.0.1';
        const isLocal = this._isLocalViewer();
        const protocol = (!isLocal && srv.tailscale_https) ? 'https:' : 'http:';
        const baseOrigin = isLocal ? `http://127.0.0.1:${srv.port}` : `${protocol}//${host}:${srv.port}`;
        const cleanSub = (this.subpath || '').replace(/^\/+/, '');
        const params = [`_t=${this.reloadTick || 1}`];
        if (srv.access_token) params.push(`access_token=${encodeURIComponent(srv.access_token)}`);
        const sep = cleanSub.includes('?') ? '&' : '?';
        return `${baseOrigin}/${cleanSub}${sep}${params.join('&')}`;
    }

    _applyServerResult(repo, srv) {
        const crashed = srv?.status === 'crashed';
        PreviewStore.setState(state => ({
            servers: { ...state.servers, [repo]: srv },
            logs: srv?.logs || [],
            logsOpen: crashed ? true : state.logsOpen,
            pendingApproval: null,
            reloadTick: Date.now()
        }));
        this._syncDraftFromServer(repo);
        return crashed;
    }

    async _postServerAction(path, payload) {
        const res = await this.api.post(path, payload);
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && data.status === 'needs_approval') {
            PreviewStore.setState({ pendingApproval: { repo: data.repo || payload.repo, command: data.command || '' } });
            this.setStatus('This custom command needs your approval before it runs.', 3000, true);
            return null;
        }
        if (!res.ok) throw new Error(data.error || 'Preview server request failed.');
        return data.server;
    }

    async _approveAndStart() {
        const pending = this.pendingApproval;
        if (!pending?.repo || !pending?.command) return;
        const res = await this.api.post('preview/approve_command', { repo: pending.repo, command: pending.command });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Approval failed.');
        }
        PreviewStore.setState({ pendingApproval: null });
        await this._startServer(pending.repo);
    }

    async _openToLan() {
        if (!this.selectedRepo) return;
        const srv = await this._postServerAction('preview/open_lan', { repo: this.selectedRepo, duration: this.lanDuration || 'run' });
        if (srv) {
            this._applyServerResult(this.selectedRepo, srv);
            this.setStatus(`'${this.selectedRepo}' is open to the LAN on port :${srv.port}.`, 3000);
        }
    }

    async _closeLan() {
        if (!this.selectedRepo) return;
        const srv = await this._postServerAction('preview/close_lan', { repo: this.selectedRepo });
        if (srv) {
            this._applyServerResult(this.selectedRepo, srv);
            this.setStatus(`'${this.selectedRepo}' is back on loopback.`, 2500);
        }
    }

    async _enableTailscaleHttps() {
        if (!this.selectedRepo) return;
        this._draftConfig = { ...this._draftConfig, tailscale_https: true };
        await this._saveRepoConfig();
        await this._startServer();
    }

    _renderExposureBar(srv, isRunning) {
        if (!srv || !this.selectedRepo) return '';
        if (this.pendingApproval && this.pendingApproval.repo === this.selectedRepo) {
            return html`
                <sutram-surface variant="tinted" intent="warning" border="bottom" padding="xs">
                    <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                        <span>Approve this custom command before it runs: <code>${this.pendingApproval.command}</code></span>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-async-btn ?compact=${true} intent="warning" icon="check" label="Approve & Start" .onClick=${() => this._approveAndStart()}></sutram-async-btn>
                            <sutram-btn ?compact=${true} intent="neutral" label="Cancel" @click=${() => PreviewStore.setState({ pendingApproval: null })}></sutram-btn>
                        </sutram-stack>
                    </sutram-stack>
                </sutram-surface>
            `;
        }
        if (isRunning && srv.exposure === 'lan') {
            const until = srv.lan_lease_until ? `until ${this.utils.formatDate(srv.lan_lease_until * 1000)}` : 'until this server stops';
            return html`
                <sutram-surface variant="tinted" intent="warning" border="bottom" padding="xs">
                    <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                        <span>Open to the LAN on port :${srv.port} ${until}. Anyone on your network can reach it.</span>
                        <sutram-async-btn ?compact=${true} intent="warning" icon="shield" label="Back to Loopback" .onClick=${() => this._closeLan()}></sutram-async-btn>
                    </sutram-stack>
                </sutram-surface>
            `;
        }
        if (srv.status === 'running' && srv.lan_allowed) {
            return html`
                <sutram-surface variant="panel" border="bottom" padding="xs">
                    <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                        <sutram-label text="Running on loopback. This repository may be opened to the LAN."></sutram-label>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-select
                                ?flush=${true}
                                .value=${this.lanDuration || 'run'}
                                .options=${LAN_LEASE_OPTIONS}
                                @sutram-input-changed=${(e) => PreviewStore.setState({ lanDuration: e.detail.value })}>
                            </sutram-select>
                            <sutram-async-btn ?compact=${true} intent="warning" icon="wifi" label="Open to LAN" .onClick=${() => this._openToLan()}></sutram-async-btn>
                        </sutram-stack>
                    </sutram-stack>
                </sutram-surface>
            `;
        }
        return '';
    }
    async _startServer(repoOverride = null) {
        const repo = repoOverride || this.selectedRepo;
        if (!repo) return;
        const payload = {
            repo,
            ...(this._draftConfig || {})
        };
        const srv = await this._postServerAction('preview/start', payload);
        if (!srv) return;
        const crashed = this._applyServerResult(repo, srv);
        if (crashed) {
            this.setStatus(`Server for '${repo}' exited prematurely. Check logs.`, 4000, true);
        } else {
            this.setStatus(`Server running on port :${srv.port}`, 2500);
        }
    }
    async _stopServer() {
        if (!this.selectedRepo) return;
        const res = await this.api.post('preview/stop', { repo: this.selectedRepo });
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
        const res = await this.api.post(`preview/settings?repo=${encodeURIComponent(this.selectedRepo)}`, this._draftConfig);
        if (res.ok) {
            await PreviewStore.getState().fetchStatus();
            this._syncDraftFromServer(this.selectedRepo);
            this.setStatus(`Saved preview settings for '${this.selectedRepo}'.`, 2000);
        }
    }

    async _toggleAutoBoot(checked) {
        if (!this.selectedRepo) return;
        this._draftConfig = { ...this._draftConfig, auto_start: checked };
        await this.api.post(`preview/settings?repo=${encodeURIComponent(this.selectedRepo)}`, { auto_start: checked });
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
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <div slot="header">
                    <sutram-surface variant="panel" border="bottom" padding="xs">
                        <sutram-action-bar collapse="sm" align="between">
                            <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                                <sutram-select
                                    ?flush=${true}
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
                                    placeholder="subpath (e.g. index.html)"
                                    .value=${this.subpath || ''}
                                    @sutram-input-changed=${(e) => {
                                        PreviewStore.setState({ subpath: e.detail.value, reloadTick: Date.now() });
                                    }}>
                                </sutram-input>

                                <sutram-tag
                                    intent="${isRunning ? 'success' : (status === 'crashed' ? 'danger' : 'neutral')}"
                                    .text=${`${status.toUpperCase()}${srv?.port ? ` :${srv.port}` : ''} (${modeLabel})`}>
                                </sutram-tag>
                            </sutram-stack>

                            <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                ${!isRunning ? html`
                                    <sutram-async-btn
                                        ?compact=${true}
                                        intent="success"
                                        icon="play"
                                        label="Start"
                                        .onClick=${() => this._startServer()}>
                                    </sutram-async-btn>
                                ` : html`
                                    <sutram-async-btn
                                        ?compact=${true}
                                        intent="warning"
                                        icon="rotate-cw"
                                        label="Restart"
                                        .onClick=${() => this._startServer()}>
                                    </sutram-async-btn>
                                    ${status === 'running' ? html`
                                        <sutram-async-btn
                                            ?compact=${true}
                                            intent="danger"
                                            icon="square"
                                            label="Stop"
                                            .onClick=${() => this._stopServer()}>
                                        </sutram-async-btn>
                                    ` : ''}
                                    <sutram-btn
                                        ?compact=${true}
                                        intent="primary"
                                        icon="refresh-cw"
                                        label="Reload"
                                        @click=${() => PreviewStore.setState({ reloadTick: Date.now() })}>
                                    </sutram-btn>
                                `}

                                <sutram-btn
                                    ?compact=${true}
                                    intent="${this.autoReload ? 'highlight' : 'neutral'}"
                                    ?active=${this.autoReload}
                                    icon="zap"
                                    label="Auto"
                                    title="Auto-reload iframe when repository files change"
                                    @click=${() => PreviewStore.setState({ autoReload: !this.autoReload })}>
                                </sutram-btn>

                                <sutram-btn
                                    ?compact=${true}
                                    intent="${srv?.auto_start ? 'primary' : 'neutral'}"
                                    ?active=${!!srv?.auto_start}
                                    icon="pin"
                                    label="Boot"
                                    title="Auto-start this server on workspace boot"
                                    @click=${() => this._toggleAutoBoot(!srv?.auto_start)}>
                                </sutram-btn>

                                <sutram-btn
                                    ?compact=${true}
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
                                        ?compact=${true}
                                        intent="neutral"
                                        icon="external-link"
                                        label="Open"
                                        title="Open in new browser tab"
                                        @click=${() => window.open(previewUrl, '_blank', 'noopener')}>
                                    </sutram-btn>
                                ` : ''}
                                <insetu-projection-window-controls .filepath=${'preview:preview'}></insetu-projection-window-controls>
                            </sutram-stack>
                        </sutram-action-bar>
                    </sutram-surface>

                    ${this.configOpen && activeRepo ? html`
                        <sutram-surface variant="panel" border="bottom" padding="md" gap="md">
                            <sutram-stack direction="grid" ?compact=${true}>
                                <sutram-select
                                    label="Server Profile"
                                    ?flush=${true}
                                    .value=${this._draftConfig.server_mode || 'auto'}
                                    .options=${SERVER_MODE_OPTIONS}
                                    @sutram-input-changed=${(e) => {
                                        this._draftConfig = { ...this._draftConfig, server_mode: e.detail.value };
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
                                    .value=${this._draftConfig.bind_host || '127.0.0.1'}
                                    .options=${[
                                        { value: '127.0.0.1', label: '127.0.0.1 (Loopback)' },
                                        { value: '0.0.0.0', label: '0.0.0.0 (May open to LAN)' }
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
                            </sutram-stack>

                            <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="md" ?wrap=${true}>
                                    <sutram-toggle
                                        label="Bind Tailscale HTTPS Serve"
                                        ?flush=${true}
                                        .checked=${!!this._draftConfig.tailscale_https}
                                        @sutram-input-changed=${(e) => {
                                            this._draftConfig = { ...this._draftConfig, tailscale_https: e.detail.value };
                                        }}>
                                    </sutram-toggle>
                                    <sutram-toggle
                                        label="Static Server CORS"
                                        ?flush=${true}
                                        .checked=${!!this._draftConfig.static_cors}
                                        @sutram-input-changed=${(e) => {
                                            this._draftConfig = { ...this._draftConfig, static_cors: e.detail.value };
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
                                </sutram-stack>

                                <sutram-stack direction="row" gap="sm">
                                    <sutram-async-btn
                                        ?compact=${true}
                                        intent="primary"
                                        icon="save"
                                        label="Save Profile"
                                        .onClick=${() => this._saveRepoConfig()}>
                                    </sutram-async-btn>
                                    <sutram-async-btn
                                        ?compact=${true}
                                        intent="success"
                                        icon="play"
                                        label="Save & Start"
                                        .onClick=${async () => {
                                            await this._saveRepoConfig();
                                            await this._startServer();
                                        }}>
                                    </sutram-async-btn>
                                </sutram-stack>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}

                    ${this._renderExposureBar(srv, isRunning)}
                </div>

                ${isRunning && this._isUnreachableHere(srv) ? html`
                    <sutram-stack direction="col" align="center" justify="center" gap="sm" ?flex=${true}>
                        <sutram-icon name="shield" size="xl" intent="highlight"></sutram-icon>
                        <h3>Only reachable on this machine</h3>
                        <sutram-label text="This server only listens on loopback. Turn on Tailscale HTTPS to view it from this device."></sutram-label>
                        <sutram-async-btn intent="primary" icon="lock" label="Turn On Tailscale HTTPS" .onClick=${() => this._enableTailscaleHttps()}></sutram-async-btn>
                    </sutram-stack>
                ` : isRunning && previewUrl ? html`
                    <iframe
                        style="flex: 1; width: 100%; height: 100%; border: none;"
                        src=${previewUrl}
                        allow="clipboard-read; clipboard-write; fullscreen"
                        title="Live App Preview (${activeRepo})">
                    </iframe>
                ` : html`
                    <sutram-stack direction="col" align="center" justify="center" gap="sm" ?flex=${true}>
                        <sutram-icon name="${status === 'crashed' ? 'alert-triangle' : 'globe'}" size="xl" intent="${status === 'crashed' ? 'danger' : 'highlight'}"></sutram-icon>
                        <h3>${status === 'crashed' ? `Server Crashed (${activeRepo})` : `Preview Server Stopped (${activeRepo || 'No Repo'})`}</h3>
                        <sutram-label .text=${status === 'crashed'
                            ? 'The development server exited during startup. Inspect the Server Output Logs below for traceback details.'
                            : `Detected profile: ${modeLabel}. Click Start to launch a dedicated local server instance for '${activeRepo}'.`}></sutram-label>
                        ${activeRepo ? html`
                            <sutram-async-btn
                                intent="success"
                                icon="play"
                                label="Start ${activeRepo} Server"
                                .onClick=${() => this._startServer()}>
                            </sutram-async-btn>
                        ` : ''}
                    </sutram-stack>
                `}

                <sutram-surface slot="footer" variant="inset" border="top" padding="xs" gap="xs" ?interactive=${true}
                    @click=${() => {
                        const nextOpen = !this.logsOpen;
                        PreviewStore.setState({ logsOpen: nextOpen });
                        if (nextOpen) PreviewStore.getState().fetchLogs();
                    }}>
                    <sutram-stack
                        direction="row"
                        justify="between"
                        align="center">
                        <sutram-stack direction="row" align="center" gap="xs">
                            <sutram-icon name="${this.logsOpen ? 'chevron-down' : 'chevron-right'}" size="sm"></sutram-icon>
                            <sutram-icon name="terminal" size="sm" intent="highlight"></sutram-icon>
                            <strong>Server Output Logs (${(this.logs || []).length} lines)</strong>
                        </sutram-stack>
                        <div @click=${(e) => e.stopPropagation()}>
                            <sutram-btn
                                ?compact=${true}
                                intent="neutral"
                                icon="refresh-cw"
                                label="Refresh Logs"
                                @click=${() => PreviewStore.getState().fetchLogs()}>
                            </sutram-btn>
                        </div>
                    </sutram-stack>
                    ${this.logsOpen ? html`
                        <pre style="max-height: 220px; overflow-y: auto; margin: 0;">${(this.logs && this.logs.length > 0) ? this.logs.join('\n') : 'No output logged yet.'}</pre>
                    ` : ''}
                </sutram-surface>
            </sutram-view>
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