// insetu/static/js/api.js
// ADR 0016: Explicit API Client SDK & Network Gateway
import {
    SutramDB,
    AkasaBackendAdapter,
    registerBackendAdapter,
    NetworkHysteresisManager,
    OutboxReconciler,
    InSetuURI
} from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const _telemetryChannel = new BroadcastChannel('insetu_telemetry');

if (typeof SutramDB?.configure === 'function') {
    SutramDB.configure({
        isTenantAgnosticUrl: (filepath) => {
            const clean = String(filepath || '');
            return !clean.startsWith('/api/') || clean.startsWith('/api/system/');
        }
    });
}

function _shouldCacheGet(cacheKeyUrl) {
    if (!cacheKeyUrl) return false;
    // 1. Never cache ephemeral polling/stream endpoints in IndexedDB
    if (cacheKeyUrl.includes('/deltas') || cacheKeyUrl.includes('/jobs/') || cacheKeyUrl.includes('/stream')) {
        return false;
    }
    // 2. For physical VFS file fetches (fs/fetch?file=vfs://<repo>/...), respect per-repository offline_capable setting
    if (cacheKeyUrl.includes('/fs/fetch?file=')) {
        try {
            const qIndex = cacheKeyUrl.indexOf('file=');
            const rawParam = qIndex !== -1 ? cacheKeyUrl.slice(qIndex + 5).split('&')[0] : '';
            const decoded = decodeURIComponent(rawParam);
            if (decoded.startsWith('vfs://')) {
                const repoDir = new InSetuURI(decoded).repo;
                const targetConfigs = window.inSetu?.stores?.App?.getState()?.targetConfigs || [];
                if (targetConfigs.length > 0 && repoDir) {
                    const repoCfg = targetConfigs.find(c => c && c.repo_dir === repoDir);
                    if (repoCfg && !repoCfg.offline_capable) {
                        return false;
                    }
                }
            }
        } catch (_) {}
    }
    return true;
}

let _buildMismatchSyncInFlight = false;

const backendAdapter = new AkasaBackendAdapter({
    name: 'InSetuAkasaBackendAdapter',
    namespace: 'insetu',
    tokenHeader: 'X-InSetu-Token',
    tokenAliasHeader: 'X-Akasa-Token',
    scopeHeader: 'X-Workspace-ID',
    buildIdHeader: 'X-InSetu-Build-ID',
    bootstrapUrl: '/auth/bootstrap',
    streamUrl: '/api/system/stream',
    probeUrl: '/auth/bootstrap',
    probeMethod: 'POST',
    initialBuildId: (typeof window !== 'undefined' && window.INSETU_BUILD_ID) || null,
    getActiveScope: () => (window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default'),
    isExtensionEnabled: (extName) => {
        const isCore = Boolean(window.inSetu?.isCore ? window.inSetu.isCore(extName) : window.inSetu?.CORE_MODULES?.has(extName));
        if (isCore) return true;
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(extName)) return false;
        return true;
    },
    isStreamConnected: () => Boolean(window.inSetu?.sse?.isConnected),
    checkOfflineState: () => Boolean(window.inSetu?.stores?.App?.getState()?.isOffline),
    setOfflineState: (val) => {
        const prev = window.inSetu?.stores?.App?.getState()?.isOffline;
        window.inSetu.stores.App.setState({ isOffline: val });
        if (prev !== val) {
            _telemetryChannel.postMessage({ type: 'network_state', data: { isOffline: val } });
        }
    },
    shouldCacheGet: _shouldCacheGet,
    isOfflineCapable: (url) => {
        if (url.includes('/search')) return false;
        const extName = url.split('/api/')[1]?.split('/')[1] || '';
        const extManifest = window.ExtensionRegistry?.getExtension(extName);
        if (extManifest && extManifest.offline_mode) {
            return extManifest.offline_mode !== 'read_only' && extManifest.offline_mode !== 'none';
        }
        return Boolean(window.inSetu?.isCore && window.inSetu.isCore(extName));
    },
    onBuildMismatch: () => {
        if (_buildMismatchSyncInFlight || typeof window.inSetu?.sys?.ensureAppShellCached !== 'function') return;
        _buildMismatchSyncInFlight = true;
        window.inSetu.sys.ensureAppShellCached({
            buildId: window.INSETU_BUILD_ID || null,
            buildIdHeader: 'X-InSetu-Build-ID',
            staticPathPrefix: '/static/',
            excludePathPrefix: '/api/',
            onUpdateReady: (id) => window.inSetu?.ui?.setGlobalStatus?.(`Update ready (${id}), reload to apply.`, 10000)
        }).catch(() => {}).finally(() => {
            _buildMismatchSyncInFlight = false;
        });
    },
    onEnqueue: (count, bodyString, headers, url, method, scopeId, options = {}) => {
        const pendingSet = new Set(window.inSetu.stores.App.getState().pendingMutations);
        const deletedSet = new Set(window.inSetu.stores.App.getState().deletedMutations);

        // Pure IoC: Extensions explicitly declare which VFS paths are pending mutation
        const pendingItems = options.pendingMutations || [];
        pendingItems.forEach(p => pendingSet.add(p));

        const deletedItems = options.deletedMutations || [];
        deletedItems.forEach(p => deletedSet.add(p));

        window.inSetu.stores.App.setState({ outboxCount: count, pendingMutations: pendingSet, deletedMutations: deletedSet });
        if (window.inSetu?.stores?.Offline) {
            const curOutbox = window.inSetu.stores.Offline.getState()?.outboxItems || [];
            if (typeof window.inSetu.stores.Offline.setState === 'function') {
                window.inSetu.stores.Offline.setState({
                    outboxItems: [...curOutbox, { scope_id: scopeId, path: url, method, headers, bodyString, timestamp: Date.now() }]
                });
            }
            if (typeof window.inSetu.stores.Offline.getState()?.fetchOfflineState === 'function') {
                window.inSetu.stores.Offline.getState().fetchOfflineState();
            }
        }
        // Notify peer/host windows so their outbox counts, file trees, and offline ledgers stay in lockstep
        _telemetryChannel.postMessage({
            type: 'outbox_mutated',
            data: {
                scopeId,
                count,
                pendingMutations: pendingItems,
                deletedMutations: deletedItems
            }
        });
        window.inSetu?.offlineLog?.(`Enqueued mutation [${method}] (${count} pending): ${url}`, 'info', bodyString);
        if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`🌩️ Queued for sync (${count})`, 3000);
    },
    onOfflineError: (msg, url) => {
        window.inSetu?.offlineLog?.(`Offline Error: ${msg} (${url})`, 'error');
        if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ ${msg}`, 4000, true);
    },
    onCacheWrite: (cacheKeyUrl, size) => {
        window.inSetu?.offlineLog?.(`Cached VFS blob: ${cacheKeyUrl} (${size} bytes)`, 'info');
        if (window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState) {
            window.inSetu.stores.Offline.getState().fetchOfflineState();
        }
    }
});

const _origWriteToken = backendAdapter._writeStoredToken.bind(backendAdapter);
backendAdapter._writeStoredToken = (token) => {
    _origWriteToken(token);
    if (token && window.inSetu?.stores?.App) {
        window.inSetu.stores.App.setState({ authToken: token });
    }
};

registerBackendAdapter(backendAdapter);

window.inSetu.api = {
    adapter: backendAdapter,
    getWorkspaceSignal: function(workspaceId) {
        return backendAdapter.getScopeSignal(workspaceId);
    },
    abortWorkspace: function(workspaceId) {
        return backendAdapter.abortScope(workspaceId);
    },
    _getHeaders: function() {
        const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        return backendAdapter.buildHeaders(activeWs);
    },
    _attemptReAuthAndRetry: async function(fullUrl, options, isWorkspaceScoped) {
        const authRes = await backendAdapter.bootstrap();
        if (authRes && authRes.authenticated) {
            const scopeId = isWorkspaceScoped
                ? (window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default')
                : 'default';
            const newHeaders = backendAdapter.buildHeaders(scopeId, options.headers);
            options.headers = newHeaders;
            return await backendAdapter.fetchRaw(fullUrl, { ...options, _skipAuthRetry: true }, scopeId);
        }
        return null;
    },
    fetchImmutableText: async function(url, options = {}, scopeId = 'default') {
        // ADR 0042: Direct-Pipe Immutable Text Extraction
        // Bypasses OfflineHttpProvider proxy streams to guarantee Safari GC stability for native OS intents.
        // Always attempts fresh network read first when online, falling back to SutramDB when offline or unreachable.
        const isOffline = window.inSetu?.stores?.App?.getState()?.isOffline;
        const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const cacheKeyUrl = url.replace(/([?&])t=\d+&?/, '$1').replace(/[?&]$/, '');

        if (isOffline && browserOffline) {
            const blob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (!blob) throw new Error(`File not in offline cache: ${url}`);
            return await blob.text();
        }

        try {
            const res = await backendAdapter.fetchRaw(url, { cache: 'no-store', ...options }, scopeId);

            if ([502, 503, 504].includes(res.status)) {
                throw new TypeError(`Gateway unreachable (HTTP ${res.status})`);
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const textContent = await res.text();
            const type = res.headers.get('content-type') || 'text/plain';

            // Quietly update the offline cache with the fresh text if permitted by repo offline_capable policy
            if (_shouldCacheGet(cacheKeyUrl)) {
                SutramDB.cacheVFSBlob(scopeId, cacheKeyUrl, new Blob([textContent], { type })).catch(() => {});
            }

            return textContent;
        } catch (err) {
            const blob = await SutramDB.getVFSBlob(scopeId, cacheKeyUrl);
            if (blob) return await blob.text();
            throw err;
        }
    },
    request: async function(url, options = {}, scopeId = 'default') {
        const method = options.method ? options.method.toUpperCase() : 'GET';
        if (method !== 'GET' && Array.isArray(options.deletedMutations) && options.deletedMutations.length > 0 && !options.deletedCacheUrls) {
            options.deletedCacheUrls = options.deletedMutations.map(fp => `/api/${scopeId}/fs/fetch?file=${encodeURIComponent(fp)}`);
        }

        const res = await backendAdapter.request(url, options, scopeId);

        // Soft Refresh Evaluation
        if (method !== 'GET') {
            try {
                const clone = res.clone();
                const data = await clone.json();
                if (data && data.requires_refresh && window.inSetu.sys.performSoftRefresh) {
                    window.inSetu.sys.performSoftRefresh();
                }
            } catch (e) {}
        }

        return res;
    },
    _dispatchScoped: function(path, options = {}) {
        return backendAdapter._dispatchScoped(path, options);
    },
    get: function(path, options = {}) {
        return backendAdapter.get(path, options);
    },
    post: function(path, payload, options = {}) {
        return backendAdapter.post(path, payload, options);
    },
    delete: function(path, options = {}) {
        return backendAdapter.delete(path, options);
    },
    getJson: function(path, options = {}) {
        return backendAdapter.getJson(path, options);
    },
    postJson: function(path, payload, options = {}) {
        return backendAdapter.postJson(path, payload, options);
    },
    deleteJson: function(path, options = {}) {
        return backendAdapter.deleteJson(path, options);
    },
    pollJob: function(jobId, options = {}) {
        return window.inSetu.utils.pollJob(jobId, options);
    },
    bindJobAction: function(path, payloadGenerator, pollOptions = {}) {
        return async (e) => {
            const payload = typeof payloadGenerator === 'function' ? await payloadGenerator(e) : (payloadGenerator || {});
            if (pollOptions.closeWindowId && window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow(pollOptions.closeWindowId);
            }
            const cleanRoute = String(path || '').replace(/^\/+/, '');
            // A refused or unreachable request is an error like a failed job: callers rely on onError to report it
            const fail = (err) => {
                if (pollOptions.onError) pollOptions.onError(err);
                throw err;
            };
            let res;
            try {
                res = await window.inSetu.api.post(cleanRoute, payload);
            } catch (err) {
                return fail(err);
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                return fail(new Error(body.error || `HTTP ${res.status}`));
            }
            const data = await res.json();
            if (!data.job_id) {
                if (pollOptions.onComplete) pollOptions.onComplete(data);
                return data;
            }
            return new Promise((resolve, reject) => {
                window.inSetu.api.pollJob(data.job_id, {
                    ...pollOptions,
                    onComplete: (statusData) => {
                        if (pollOptions.onComplete) pollOptions.onComplete(statusData);
                        resolve(statusData);
                    },
                    onError: (err) => {
                        if (pollOptions.onError) pollOptions.onError(err);
                        reject(err);
                    }
                });
            });
        };
    },
    keepalivePost: function(path, payload, workspaceId = null) {
        const ws = workspaceId || (window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default');
        const url = backendAdapter.resolveScopedUrl(path, ws);
        return backendAdapter.fetchRaw(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {}),
            keepalive: true
        }, ws).catch(() => {});
    }
};

// Phase E: Network Hysteresis, Outbox Reconciliation & SSE Pipeline
class SSEPipeline {
    constructor() {
        this.source = null;
        this._streamHandle = null;
        this.reconnectTimer = null;
        this.isConnected = false;
    }
    _shouldDrop(workspaceId = null) {
        if (window.inSetu?.events?.shouldDropTenantEvent) {
            return window.inSetu.events.shouldDropTenantEvent(workspaceId);
        }
        if (AppStore.getState().isSwappingWorkspace) return true;
        return Boolean(workspaceId && workspaceId !== window.inSetu.utils.getActiveWorkspace());
    }
    connect() {
        if (this.source) return;
        const appToken = window.inSetu.stores?.App?.getState()?.authToken;
        if (appToken && !backendAdapter.getToken()) {
            backendAdapter.setToken(appToken);
        }
        const bc = _telemetryChannel;
        bc.onmessage = (ev) => {
            const { type, data } = ev.data || {};
            if (type === 'presence_ping') {
                bc.postMessage({ type: 'presence_pong' });
            } else if (type === 'outbox_mutated') {
                if (this._shouldDrop(data?.scopeId)) return;
                const appState = window.inSetu.stores.App.getState();
                const pendingSet = new Set(appState.pendingMutations);
                const deletedSet = new Set(appState.deletedMutations);
                (data.pendingMutations || []).forEach(p => pendingSet.add(p));
                (data.deletedMutations || []).forEach(p => deletedSet.add(p));
                window.inSetu.stores.App.setState({
                    outboxCount: data.count ?? appState.outboxCount,
                    pendingMutations: pendingSet,
                    deletedMutations: deletedSet,
                    isOffline: true
                });
                if (window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState) {
                    window.inSetu.stores.Offline.getState().fetchOfflineState();
                }
            } else if (type === 'network_state') {
                const isOff = Boolean(data?.isOffline);
                if (window.inSetu.stores.App.getState().isOffline !== isOff) {
                    window.inSetu.stores.App.setState({ isOffline: isOff });
                }
            }
        };

        this._streamHandle = backendAdapter.connectStream({
            onOpen: () => {
                this.isConnected = true;
                console.log("🟢 [SSE TELEMETRY] Connected to real-time system stream. Fallback polling relaxed.");
            },
            onError: () => {
                this.isConnected = false;
                if (this._streamHandle) {
                    this._streamHandle.disconnect();
                    this._streamHandle = null;
                }
                this.source = null;
                console.warn("🔴 [SSE TELEMETRY] Stream disconnected. Degrading to 3s fallback polling. Reconnecting in 5s...");
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => this.connect(), 5000);
            },
            events: {
                vfs_mutated: (e) => {
                    const data = JSON.parse(e.data);
                    bc.postMessage({ type: 'vfs_mutated', data });
                    if (this._shouldDrop(data.workspace_id)) return;
                    window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: data.mutations });
                },
                manifest_settled: (e) => {
                    const data = JSON.parse(e.data);
                    bc.postMessage({ type: 'manifest_settled', data });
                    if (this._shouldDrop(data.workspace_id)) return;
                    if (window.inSetu?.sys?.refreshManifest) {
                        window.inSetu.sys.refreshManifest();
                    }
                    if (window.inSetu?.ui?.setSyncStatus) {
                        window.inSetu.ui.setSyncStatus('synced');
                    }
                },
                // S8: protected changes are daemon-wide (not per workspace), so every tab shows the same count.
                protected_changes: (e) => {
                    const data = JSON.parse(e.data);
                    window.inSetu.stores.App.setState({ protectedChangesPending: Number(data.pending || 0) });
                },
                topology_resolved: (e) => {
                    const data = JSON.parse(e.data);
                    bc.postMessage({ type: 'topology_resolved', data });
                    if (this._shouldDrop(data.workspace_id)) return;
                    if ((data.dirty_repos && data.dirty_repos.length > 0) || (data.dirty_buckets && data.dirty_buckets.length > 0)) {
                        if (window.inSetu?.sys?.refreshManifest) {
                            window.inSetu.sys.refreshManifest();
                        }
                    }
                },
                job_progress: (e) => {
                    const data = JSON.parse(e.data);
                    bc.postMessage({ type: 'job_progress', data });
                    if (this._shouldDrop(data.workspace_id)) return;
                    const isChainedPipelineJob = Boolean(
                        data.artifact?.root_job_id ||
                        data.artifact?.chain_history ||
                        data.artifact?.next_job_id ||
                        ['topology', 'cartographer', 'gather'].includes(data.ext_name)
                    );

                    // 1. ALWAYS emit step completion hooks regardless of job_category to keep manifest & dirty states fresh
                    if (data.status === 'completed' && data.artifact) {
                        window.inSetu.events.emitHook('insetu:compile-step-complete', {
                            job_id: data.job_id,
                            ext_name: data.ext_name,
                            artifact: data.artifact
                        });
                    }
                    // Route events to the UI spinner strictly if they belong to the 'ui_blocking' category
                    if (data.job_category === 'ui_blocking') {
                        if (isChainedPipelineJob) {
                            window.inSetu.events.emitHook('insetu:compile-progress', data);
                        }

                        if (data.status === 'processing' || data.status === 'pending' || (data.status === 'completed' && data.artifact && data.artifact.next_job_id)) {
                            const msg = data.message || "Processing...";
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                                window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                            }
                        }
                        // 2. Only terminate UI spinners when the ENTIRE chain completes
                        const isStatusTrackedJob = isChainedPipelineJob || data.ext_name === 'bridge';
                        if (isStatusTrackedJob && (data.status === 'completed' || data.status === 'failed') && !(data.artifact && data.artifact.next_job_id)) {
                            window.inSetu.events.emitHook('insetu:compile-progress', { status: 'terminated' });
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                                window.inSetu.ui.setGlobalStatus(data.status === 'completed' ? "✅ Sync Complete" : "❌ Sync Failed", 2000, data.status === 'failed');
                            }
                            if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) {
                                window.inSetu.ui.setSyncStatus(data.status === 'completed' ? 'synced' : 'pending');
                            }
                        }
                    }
                    // Apply definitive SSOT state directly from the kernel
                    if (data.active_modules !== undefined && data.pending_modules !== undefined) {
                        if (window.inSetu.stores?.App) {
                            const state = window.inSetu.stores.App.getState();
                            const sameActive = JSON.stringify(state.activeModules) === JSON.stringify(data.active_modules);
                            const samePending = JSON.stringify(state.pendingModules) === JSON.stringify(data.pending_modules);
                            if (!sameActive || !samePending) {
                                window.inSetu.stores.App.setState({
                                    activeModules: data.active_modules,
                                    pendingModules: data.pending_modules
                                });
                            }
                        }
                    }
                }
            }
        });
        this.source = this._streamHandle?.source || this._streamHandle;
    }
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this._streamHandle) {
            this._streamHandle.disconnect();
            this._streamHandle = null;
        } else if (this.source && typeof this.source.close === 'function') {
            this.source.close();
        }
        this.source = null;
        this.isConnected = false;
    }
}
window.inSetu.sse = new SSEPipeline();

window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.syncOutboxMutationMarkers = async function(workspaceId = null) {
    const ws = workspaceId || window.inSetu.utils.getActiveWorkspace?.() || 'default';
    try {
        const outbox = await SutramDB.getOutboxItems(ws);
        const pendingSet = new Set();
        const deletedSet = new Set();
        outbox.forEach(item => {
            if (Array.isArray(item.pendingMutations) && item.pendingMutations.length > 0) {
                item.pendingMutations.forEach(p => { if (p) pendingSet.add(p); });
            }
            if (Array.isArray(item.deletedMutations) && item.deletedMutations.length > 0) {
                item.deletedMutations.forEach(d => { if (d) deletedSet.add(d); });
            }
            if ((!item.pendingMutations || item.pendingMutations.length === 0) && (!item.deletedMutations || item.deletedMutations.length === 0)) {
                try {
                    const payload = item.bodyString ? JSON.parse(item.bodyString) : {};
                    const fp = payload.filepath || payload.dest_path;
                    if (fp) {
                        const isDelete = item.method === 'DELETE' || (item.path && item.path.includes('fs/delete')) || (item.path && item.path.includes('fs/move'));
                        if (isDelete) deletedSet.add(fp);
                        else pendingSet.add(fp);
                    }
                } catch (_) {}
            }
        });
        window.inSetu.stores.App.setState({ outboxCount: outbox.length, pendingMutations: pendingSet, deletedMutations: deletedSet });
        return outbox.length;
    } catch (_) {
        return 0;
    }
};

// S8 Offline Protected-File Reversion: when an offline save to a protected file drains and returns
// 202 with status: 'pending_confirmation', restore vfs_cache to the server's current content so an
// unconfirmed edit never appears as written.
window.addEventListener('sutram-outbox-item-synced', async (e) => {
    const { scopeId, bodyString, responseData } = e.detail || {};
    if (!responseData || responseData.status !== 'pending_confirmation') return;
    const ws = scopeId || window.inSetu?.utils?.getActiveWorkspace?.() || 'default';
    let targetFp = responseData.filepath || '';
    if (!targetFp && bodyString) {
        try {
            const parsed = JSON.parse(bodyString);
            targetFp = parsed.filepath || '';
        } catch (_) {}
    }
    if (window.inSetu?.stores?.App) {
        const curPending = Number(window.inSetu.stores.App.getState().protectedChangesPending || 0);
        window.inSetu.stores.App.setState({ protectedChangesPending: Math.max(1, curPending + 1) });
    }
    if (!targetFp) return;
    const normFp = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(targetFp) : targetFp;
    const cacheKeyUrl = backendAdapter.resolveScopedUrl(`fs/fetch?file=${encodeURIComponent(normFp)}`, ws);
    try {
        const liveRes = await backendAdapter.fetchRaw(cacheKeyUrl, { method: 'GET', cache: 'no-store' }, ws);
        if (liveRes.ok) {
            const liveText = await liveRes.text();
            const liveBlob = new Blob([liveText], { type: liveRes.headers.get('content-type') || 'text/plain;charset=utf-8' });
            await SutramDB.cacheVFSBlob(ws, cacheKeyUrl, liveBlob);
            const fsStore = window.inSetu?.stores?.Fs;
            if (fsStore?.getState?.()?.activeBuffers?.[normFp]) {
                fsStore.getState().updateBuffer(normFp, { content: liveText, originalContent: liveText, fullText: liveText });
            }
        } else if (liveRes.status === 404) {
            await SutramDB.deleteVFSBlob(ws, cacheKeyUrl);
        }
    } catch (_) {}
    if (window.inSetu?.ui?.setGlobalStatus) {
        const baseName = new InSetuURI(normFp).basename || normFp;
        window.inSetu.ui.setGlobalStatus(`🔒 Protected file '${baseName}' held for confirmation.`, 5000);
    }
});

const networkManager = new NetworkHysteresisManager(null, 3, { adapter: backendAdapter });
let lastCacheCheck = 0;
const attemptReconciliation = async () => {
    const appState = window.inSetu?.stores?.App?.getState();
    if (appState && appState.isOffline && !appState.isReconciling) {
        await networkManager.check(async () => {
            window.inSetu.stores.App.setState({ isOffline: false, isReconciling: true });
            window.inSetu?.offlineLog?.('Network stability verified. Beginning outbox reconciliation...', 'info');

            try {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                await OutboxReconciler.drain(activeWs, async (path, fetchOptions, scopeId) => {
                    // Route through adapter.fetchRaw to bypass OfflineHttpProvider re-queuing while
                    // preserving auth headers, 401 single-flight re-authentication, and build-ID sniffing.
                    const res = await backendAdapter.fetchRaw(path, fetchOptions, scopeId);

                    // Trigger soft refreshes if the backend demands it
                    if (res.ok && fetchOptions.method !== 'GET') {
                        try {
                            const clone = res.clone();
                            const data = await clone.json();
                            if (data?.requires_refresh && window.inSetu.sys.performSoftRefresh) {
                                window.inSetu.sys.performSoftRefresh();
                            }
                        } catch (e) {}
                    }

                    return res;
                });
            } catch (e) {
                window.inSetu.stores.App.setState({ isOffline: true });
            } finally {
                window.inSetu.stores.App.setState({ isReconciling: false });
                const remaining = await SutramDB.getOutboxCount(window.inSetu.utils.getActiveWorkspace());
                window.inSetu.stores.App.setState({ outboxCount: remaining });
                if (remaining === 0) {
                    window.inSetu?.offlineLog?.('Outbox fully reconciled.', 'success');
                    if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus('✅ System Synced', 3000);
                    // Clear the ephemeral tracking sets once the queue is fully drained and notify pop-out peers
                    window.inSetu.stores.App.setState({ pendingMutations: new Set(), deletedMutations: new Set() });
                    _telemetryChannel.postMessage({ type: 'outbox_reconciled', data: { scopeId: window.inSetu.utils.getActiveWorkspace() } });
                    window.dispatchEvent(new CustomEvent('sutram-sync-complete'));
                }
            }
        });
    } else if (appState && !appState.isOffline) {
        networkManager.reset();
    }
};

// Trigger instantly on native online events
window.addEventListener('online', () => {
    window.inSetu?.offlineLog?.('Network connection restored (browser event). Verifying stability...', 'info');
    attemptReconciliation();
});

const _runOfflineMaintenanceTick = async () => {
    // LRU Cache Eviction Sweep
    if (Date.now() - lastCacheCheck > 60000) {
        lastCacheCheck = Date.now();
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const est = await navigator.storage.estimate();
                const limitBytes = 250 * 1024 * 1024;
                if (est.usage > limitBytes || (est.quota && est.usage > est.quota * 0.8)) {
                    const targetFree = Math.max(est.usage - (limitBytes * 0.8), est.usage * 0.2);
                    window.inSetu?.offlineLog?.(`Storage threshold reached. Evicting ${Math.round(targetFree / 1024 / 1024)}MB of old cache...`, 'warning');
                    await SutramDB.pruneCache(targetFree);
                    if (window.inSetu?.stores?.Offline?.getState()?.fetchOfflineState) {
                        window.inSetu.stores.Offline.getState().fetchOfflineState();
                    }
                }
            } catch (e) {}
        }
    }
    // Only the authoritative host window (or a standalone pop-out whose host was closed) drives reconciliation
    const isPopout = new URLSearchParams(window.location.search).get('popout') === 'true';
    if (!isPopout || window.inSetu?.sse?.isConnected) {
        await attemptReconciliation();
    }
};

if (window.ExtensionRegistry?.registerTick) {
    window.ExtensionRegistry.registerTick('offline', 5000, _runOfflineMaintenanceTick);
}
