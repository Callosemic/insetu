import { AppStore, StatusStore } from '/static/extensions/system/store.js';
import { SutramDB, bootSutramServiceWorker, purgeSutramCaches } from '/static/vendor/sutram/js/offline.js';
import '/static/vendor/sutram/js/app_shell.js';
export function bootServiceWorker() {
    bootSutramServiceWorker({
        swUrl: '/sw.js',
        staticPathPrefix: '/static/',
        excludePathPrefix: '/api/',
        isReconciling: () => Boolean(window.inSetu?.stores?.App?.getState()?.isReconciling),
        subscribeReconciling: (cb) => {
            if (window.inSetu?.stores?.App) {
                window.inSetu.stores.App.subscribe(s => s.isReconciling, cb);
            }
        },
        onStatus: (msg, timeout) => {
            if (window.inSetu?.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(msg, timeout);
            }
        },
        onLog: (msg, type) => {
            window.inSetu?.offlineLog?.(msg, type);
        },
        onError: (msg) => {
            alert(msg);
        }
    });
}
// Natively hook browser connectivity events for instant offline transitions
window.addEventListener('offline', () => {
    if (window.inSetu?.stores?.App) {
        window.inSetu.stores.App.setState({ isOffline: true });
    }
    if (window.Sutram?.stores?.Environment) {
        window.Sutram.stores.Environment.setState({ isOffline: true });
    }
    window.inSetu?.offlineLog?.('Network connection lost (browser event). Swapping to offline mode.', 'warning');
});

// Intercept window refreshes only if offline mutations are actively staged in the outbox
window.addEventListener('beforeunload', (e) => {
    const appState = window.inSetu?.stores?.App?.getState();
    if (appState && appState.outboxCount > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});
import { CORE_UI_SCRIPTS } from '/static/extensions/system/insetu_sdk.js';
import { initShortcutRouter } from '/static/vendor/sutram/js/shortcuts.js';
import '/static/vendor/sutram/js/primitives.js';
import '/static/vendor/sutram/js/inputs.js';
// --- CENTRALIZED SHORTCUT ROUTER ---
initShortcutRouter(window.ExtensionRegistry, () => {
    const contexts = ['global'];
    // 1. Active Spatial Focus Hierarchy
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (layout && layout.focusedColumn) {
        contexts.unshift('tab:' + layout.focusedColumn);
        const activeSub = layout.columns[layout.focusedColumn]?.active;
        if (activeSub) {
            contexts.unshift('subtab:' + activeSub);
            if (activeSub.includes(':')) {
                contexts.unshift('subtab:' + activeSub.split(':').pop());
            }
        }
    }
    // 2. Active Element (Piercing Shadow DOM)
    let activeEl = document.activeElement;
    while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
        activeEl = activeEl.shadowRoot.activeElement;
    }
    if (activeEl && activeEl !== document.body) {
        const tag = activeEl.tagName.toLowerCase();
        contexts.unshift('element:' + tag);
        if (activeEl.id) contexts.unshift('element-id:' + activeEl.id);
    }
    // 3. Active Modal (Highest Priority)
    const openModals = Array.from(document.querySelectorAll('sutram-modal[open], dialog[open]'));
    openModals.forEach(m => {
        if (m.id) {
            contexts.unshift('modal:' + m.id);
        }
    });

    return contexts;
});
// Default OS Shortcut Registrations
const _isCoreExt = (extName) => window.inSetu?.isCore ? window.inSetu.isCore(extName) : false;
export function autoWireSettingsSchemas() {
    if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
        window.inSetu.settingsSchemas = window.inSetu.settingsSchemas || {};
        window.ExtensionRegistry._manifests.forEach((manifest, extName) => {
            if (manifest.settingsSchema && !window.inSetu.settingsSchemas[extName]) {
                window.inSetu.settingsSchemas[extName] = manifest.settingsSchema;
            }
        });
    }
}
async function bootExtensions() {
    const isPopout = new URLSearchParams(window.location.search).get('popout') === 'true';
    const activeExts = window.ACTIVE_EXTENSIONS || [];

    // Batch 0: Core UI Primitives & Foundational Components
    const coreComponents = [
        '/static/extensions/system/components/ui_file_tree.js',
        '/static/extensions/system/components/ui_system_settings.js',
        '/static/extensions/system/components/ui_filter_pills.js',
        '/static/extensions/system/components/ui_primitives.js'
    ];
    if (isPopout) {
        // Fast-path popout: Only load UI primitives and the VFS file editor
        const popoutScripts = ['/static/extensions/fs/fs.js'];
        const hash = window.location.hash.replace(/^#\/?/, '');
        const parts = hash.split('/').map(decodeURIComponent);
        const subId = parts.slice(2).join('/') || '';
        const targetPath = (parts.length >= 4 && parts[2] === 'editor') ? parts.slice(3).join('/') : subId;
        const subParts = targetPath.includes(':') ? targetPath.split(':') : [targetPath];
        let matchingExt = activeExts.find(ext => subParts.includes(ext) || ext === targetPath || targetPath.startsWith(`${ext}:`));
        if (!matchingExt) {
            const dataMatch = targetPath.match(/\.(?:insetu-data|insetu\/data)\/([a-z0-9_]+)\//);
            const ctxMatch = targetPath.match(/^ctx:\/\/([a-z0-9_]+)\//);
            if (dataMatch) matchingExt = dataMatch[1];
            else if (ctxMatch) matchingExt = ctxMatch[1];
            else matchingExt = activeExts.find(ext => targetPath.includes(`/${ext}/`) || targetPath === ext);
        }
        if (matchingExt && matchingExt !== 'fs' && activeExts.includes(matchingExt)) {
            popoutScripts.push(`/static/extensions/${matchingExt}/ext_${matchingExt}.js`);
        }

        if (window.ExtensionRegistry && typeof window.ExtensionRegistry.loadBatches === 'function') {
            await window.ExtensionRegistry.loadBatches([
                coreComponents,
                popoutScripts
            ]);
        }
        return;
    }

    // Batch 1: Core OS Chassis Modules
    const coreUrls = CORE_UI_SCRIPTS;

    // Batch 2: Feature Extensions
    const extensionUrls = activeExts
        .filter(ext => !(window.inSetu?.isCore && window.inSetu.isCore(ext)))
        .map(ext => `/static/extensions/${ext}/ext_${ext}.js`);

    if (window.ExtensionRegistry && typeof window.ExtensionRegistry.loadBatches === 'function') {
        await window.ExtensionRegistry.loadBatches([
            coreComponents,
            coreUrls,
            extensionUrls
        ]);
    }

    // Automatically map schemas to the System Settings menu
    autoWireSettingsSchemas();
}
// --- DECENTRALIZED MANIFEST SYNC & KERNEL HEARTBEAT ---
async function checkManifestVersion() {
    if (!window.BOOT_COMPLETE) return;
    const appState = window.inSetu?.stores?.App?.getState();
    if (appState?.isSwappingWorkspace) return; // Suspend heartbeat while workspace swap FSM is locked
    if (appState?.isReconciling) return; // Wait for outbox drain
    if (appState?.isPipelineActive) return; // Yield to active compilation DAG
    const wm = appState.getSyncWatermarks();
    const { localVfsSignatures, localCtxSignatures, warmedVfsSignatures } = wm;

    const activeWs = window.inSetu.utils.getActiveWorkspace();
    const nowMs = Date.now();
    const isSseConnected = window.inSetu?.sse?.isConnected;

    // Adaptive Backoff: If SSE is healthy, poll at 30s intervals. If disconnected, poll at 3s intervals.
    const requiredIntervalMs = isSseConnected ? 30000 : 3000;
    if (nowMs - wm.lastPolledTs < requiredIntervalMs) {
        return;
    }
    wm.lastPolledTs = nowMs;
    try {
        const deltaRes = await window.inSetu.api.workspace.get(`system/deltas?since=${wm.lastManifestSyncTs}`, { 
            signal: AbortSignal.timeout(8000) 
        });

        if (!deltaRes.ok) return;
        if (window.inSetu.utils.getActiveWorkspace() !== activeWs) return;

        const deltaData = await deltaRes.json();
        let manifestUpdated = false;

        const stateManifest = AppStore.getState().manifest || { vfs: {}, ctx: {} };
        const currentManifest = { 
            vfs: { ...(stateManifest.vfs || {}) }, 
            ctx: { ...(stateManifest.ctx || {}) } 
        };

        const now = Date.now();
        const currentLocks = AppStore.getState().resolvingLocks || {};
        const locks = { ...currentLocks };
        const lockedRepos = new Set();
        let expiredLocks = false;
        for (const [path, lock] of Object.entries(locks)) {
            if (lock.expires > now) {
                const parsed = window.inSetu?.utils?.InSetuURI ? new window.inSetu.utils.InSetuURI(path) : { repo: '' };
                if (parsed.repo) lockedRepos.add(parsed.repo);
            } else {
                delete locks[path];
                expiredLocks = true;
            }
        }
        if (expiredLocks) AppStore.setState({ resolvingLocks: locks });

        const sigs = deltaData.signatures || {};
        // 1. Evaluate VFS Repo Signatures
        if (sigs.vfs) {
            for (const [repo, sig] of Object.entries(sigs.vfs)) {
                if (lockedRepos.has(repo)) continue;
                if (sig === null) {
                    // Tombstone: Remove repo buckets
                    Object.keys(currentManifest.vfs).forEach(key => {
                        if (key.startsWith(`${repo}::`)) delete currentManifest.vfs[key];
                    });
                    delete localVfsSignatures[repo];
                    manifestUpdated = true;
                } else if (localVfsSignatures[repo] !== sig) {
                    // Short-circuit N+1 fetches on workspace swap/boot if we already have the data
                    if (wm.lastManifestSyncTs === 0 && currentManifest.vfs && Object.keys(currentManifest.vfs).some(k => k.startsWith(`${repo}::`))) {
                        localVfsSignatures[repo] = sig;
                        continue;
                    }
                    // Surgical Fetch: Fetch repo tree
                    const treeRes = await window.inSetu.api.workspace.get(`topology/vfs?repo=${encodeURIComponent(repo)}`);
                    if (window.inSetu.utils.getActiveWorkspace() !== activeWs) return;
                    if (treeRes.ok) {
                        const treeData = await treeRes.json();
                        if (treeData.buckets) {
                            Object.keys(currentManifest.vfs).forEach(key => {
                                if (key.startsWith(`${repo}::`)) delete currentManifest.vfs[key];
                            });
                            Object.assign(currentManifest.vfs, treeData.buckets);
                            localVfsSignatures[repo] = sig;
                            manifestUpdated = true;
                        }
                    }
                }
            }
        }
        const pathsToWarm = [];
        // 2. Evaluate CTX Artifact Signatures
        if (sigs.ctx) {
            const activeWs = window.inSetu.utils.getActiveWorkspace();
            for (const [path, ts] of Object.entries(sigs.ctx)) {
                const fetchUrl = window.inSetu.vfs?.resolveFileFetchUrl ? window.inSetu.vfs.resolveFileFetchUrl(path, false) : `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(path)}`;
                if (ts === null) {
                    delete currentManifest.ctx[path];
                    delete localCtxSignatures[path];
                    SutramDB.deleteVFSBlob(activeWs, fetchUrl).catch(()=>{});
                    manifestUpdated = true;
                    AppStore.setState(s => {
                        const newQ = new Set(s.warmingQueue);
                        const filtered = new Set(Array.from(newQ).filter(u => !u.startsWith(fetchUrl)));
                        return { warmingQueue: filtered };
                    });
                } else if (localCtxSignatures[path] !== ts) {
                    const entryRes = await window.inSetu.api.workspace.get(`gather/manifest/entry?path=${encodeURIComponent(path)}`);
                    if (window.inSetu.utils.getActiveWorkspace() !== activeWs) return;
                    if (entryRes.ok) {
                        const entryData = await entryRes.json();
                        if (entryData.entry) {
                            currentManifest.ctx[path] = entryData.entry;
                            SutramDB.deleteVFSBlob(activeWs, fetchUrl).catch(()=>{});
                            // Only warm the primary base artifact if it is a valid ctx:// or vfs:// URI and not a multi-part virtual key
                            const chunks = entryData.entry.chunks || [path];
                            chunks.forEach(chunkUri => {
                                if (chunkUri && (chunkUri.startsWith('ctx://') || chunkUri.startsWith('vfs://'))) {
                                    const chunkFetchUrl = window.inSetu.vfs?.resolveFileFetchUrl ? window.inSetu.vfs.resolveFileFetchUrl(chunkUri, false) : `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(chunkUri)}`;
                                    const sep = chunkFetchUrl.includes('?') ? '&' : '?';
                                    pathsToWarm.push(`${chunkFetchUrl}${sep}t=${Date.now()}`);
                                }
                            });
                        } else if (!deltaData.is_pipeline_active) {
                            delete currentManifest.ctx[path];
                            SutramDB.deleteVFSBlob(activeWs, fetchUrl).catch(()=>{});
                        }
                        localCtxSignatures[path] = ts;
                        manifestUpdated = true;
                    } else if (entryRes.status === 404 && !deltaData.is_pipeline_active) {
                        delete currentManifest.ctx[path];
                        delete localCtxSignatures[path];
                        SutramDB.deleteVFSBlob(activeWs, fetchUrl).catch(()=>{});
                        manifestUpdated = true;
                    }
                }
            }
        }
        if (manifestUpdated) {
            AppStore.setState({ manifest: currentManifest || { vfs: {}, ctx: {} } });

            // Phase 4: Hash-Delta Cache Warmer (Queue Injection)
            const activeWs = window.inSetu.utils.getActiveWorkspace();
            // Map offline-capable VFS files dynamically
            const targetConfigs = AppStore.getState().targetConfigs || [];
            const offlineRepos = targetConfigs.filter(c => c.offline_capable).map(c => c.repo_dir);
            if (offlineRepos.length > 0 && currentManifest.vfs && sigs.vfs) {
                const mutatedPaths = new Set(
                    (deltaData.mutations || [])
                        .filter(m => m.operation !== 'delete' && m.filepath)
                        .map(m => window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath)
                );

                Object.entries(currentManifest.vfs).forEach(([key, bucket]) => {
                    const repo = key.split('::')[0];
                    const currentSig = sigs.vfs[repo];
                    if (offlineRepos.includes(repo) && currentSig && warmedVfsSignatures[repo] !== currentSig) {
                        const isInitialWarm = !warmedVfsSignatures[repo];
                        (bucket.files || []).forEach(f => {
                            if (!f || f.endsWith('/.gitkeep') || f.endsWith('/.keep')) return;
                            if (!isInitialWarm && mutatedPaths.size > 0 && !mutatedPaths.has(f)) return;
                            const cacheKeyUrl = window.inSetu.vfs?.resolveFileFetchUrl ? window.inSetu.vfs.resolveFileFetchUrl(f, true) : `/api/${activeWs}/fs/fetch?file=${encodeURIComponent(f)}`;
                            SutramDB.deleteVFSBlob(activeWs, cacheKeyUrl).catch(()=>{});
                            const sep = cacheKeyUrl.includes('?') ? '&' : '?';
                            pathsToWarm.push(`${cacheKeyUrl}${sep}t=${Date.now()}`);
                        });
                    }
                });
                Object.keys(sigs.vfs).forEach(repo => {
                    if (offlineRepos.includes(repo) && sigs.vfs[repo]) {
                        warmedVfsSignatures[repo] = sigs.vfs[repo];
                    }
                });
            }

            if (pathsToWarm.length > 0) {
                AppStore.getState().enqueueWarming(pathsToWarm);
            }
        }
        // Phase 5: Drain the Global Cache Warming Queue (Background Priority Threads)
        // Guardrail: Suspend warming during active I/O (is_pipeline_active) and for 2.5 minutes after backend boot
        const backendUptimeSeconds = deltaData.timestamp - (deltaData.backend_boot_ts || deltaData.timestamp);
        const isBootSettled = backendUptimeSeconds > 150;
        const isSystemSettled = !deltaData.is_pipeline_active && isBootSettled;
        if (!AppStore.getState().isOffline && navigator.connection?.saveData !== true && isSystemSettled) {
            const q = Array.from(AppStore.getState().warmingQueue);
            if (q.length > 0) {
                // Dynamic Throttle: Keep background warming gentle so local WSGI/Werkzeug threads are never starved
                let chunkSize = 10; 

                if (navigator.connection) {
                    if (navigator.connection.effectiveType === '2g' || navigator.connection.effectiveType === '3g') {
                        chunkSize = 4;
                    } else if (navigator.connection.downlink) {
                        const mbps = navigator.connection.downlink;
                        if (mbps < 2) chunkSize = 5;
                        else if (mbps < 10) chunkSize = 8;
                        else chunkSize = 10;
                    }
                }

                // Spread the chunk evenly across a 2.5 second window to prevent bursting
                const staggerMs = Math.floor(2500 / chunkSize);

                const chunk = q.slice(0, chunkSize);
                const activeWs = window.inSetu.utils.getActiveWorkspace();

                chunk.forEach((p, index) => {
                    setTimeout(() => {
                        if (window.inSetu?.api?.request) {
                            window.inSetu.api.request(p, { priority: 'low', onlyIfMissing: true }, activeWs).catch(() => {});
                        } else {
                            fetch(p, { priority: 'low' }).catch(() => {});
                        }
                    }, index * staggerMs);
                });

                AppStore.setState(s => {
                    const newQ = new Set(s.warmingQueue);
                    chunk.forEach(u => newQ.delete(u));
                    return { warmingQueue: newQ };
                });
            }
        }
        if (deltaData.active_modules !== undefined && JSON.stringify(AppStore.getState().activeModules) !== JSON.stringify(deltaData.active_modules)) {
            AppStore.setState({ activeModules: deltaData.active_modules });
        }
        if (deltaData.pending_modules !== undefined && JSON.stringify(AppStore.getState().pendingModules) !== JSON.stringify(deltaData.pending_modules)) {
            AppStore.setState({ pendingModules: deltaData.pending_modules });
        }
        if (deltaData.is_pipeline_active !== undefined) {
            AppStore.setState({ isPipelineActive: deltaData.is_pipeline_active });
        }
        if (deltaData.timestamp) {
            wm.lastManifestSyncTs = deltaData.timestamp;
        }
        // 3. Dispatch Physical Mutations to Event Bus
        if (deltaData.mutations && deltaData.mutations.length > 0) {
            const currentLocks = AppStore.getState().resolvingLocks || {};
            let locksChanged = false;
            const nextLocks = { ...currentLocks };
            deltaData.mutations.forEach(m => {
                const rawFp = m.filepath ? m.filepath.replace(/\\/g, '/').replace(/\/+$/, '') : '';
                const canonFp = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawFp) : rawFp;
                if (nextLocks[canonFp]) {
                    delete nextLocks[canonFp];
                    locksChanged = true;
                }
                if (nextLocks[rawFp]) {
                    delete nextLocks[rawFp];
                    locksChanged = true;
                }
            });
            if (locksChanged) AppStore.setState({ resolvingLocks: nextLocks });

            try {
                window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: deltaData.mutations });
            } catch (e) {
                console.error("VFS Mutation Hook Error:", e);
            }
        }
        // 4. Sync UI Status with Kernel Pipeline State
        if (window.inSetu.ui && window.inSetu.ui.setSyncStatus) {
            if (deltaData.is_pipeline_active) {
                window.inSetu.ui.setSyncStatus('syncing');
            } else if (!deltaData.mutations || deltaData.mutations.length === 0) {
                window.inSetu.ui.setSyncStatus('synced');
            }
        }
    } catch (e) {
        if (e.name === 'AbortError' || e.name === 'TimeoutError' || (e.message && e.message.includes('Failed to fetch'))) return;
        console.warn("Heartbeat delta check failed:", e);
    }
}
// Keep tick running at 3s so degraded mode reacts immediately when SSE drops (Bypassed in Pop-outs)
if (!new URLSearchParams(window.location.search).get('popout')) {
    window.ExtensionRegistry.registerTick('manifest_sync', 3000, checkManifestVersion);
    window.ExtensionRegistry.registerTick('core_refresh', 1000, updateRefreshText);
    window.ExtensionRegistry.startMetronome(
        () => window.ACTIVE_EXTENSIONS || [],
        [...Array.from(window.inSetu?.CORE_MODULES || []), 'core_refresh', 'manifest_sync']
    );
}
import './api.js'; // Mount explicit API client and network interceptors
import { createJobPoller } from '/static/vendor/sutram/js/poller.js';
// ADR 0017: Wrap the global poller to statelessly swallow callbacks and pin requests to the originating workspace
window.inSetu.utils.pollJob = (jobId, options = {}) => {
    const initWs = window.inSetu.utils.getActiveWorkspace();
    const safeOptions = { ...options };
    let settled = false;
    let trackedJobId = jobId;
    const cleanupSseFastPath = () => {
        settled = true;
        window.removeEventListener('sutram-compile-progress', sseHandler);
        window.removeEventListener('insetu:compile-progress', sseHandler);
    };

    ['onProgress', 'onComplete', 'onError'].forEach(cbName => {
        if (options[cbName]) {
            safeOptions[cbName] = (...args) => {
                if (window.inSetu.utils.getActiveWorkspace() !== initWs) return;
                if (settled && (cbName === 'onComplete' || cbName === 'onError')) return;

                if (cbName === 'onComplete' || cbName === 'onError') {
                    cleanupSseFastPath();
                }

                // UI Telemetry Mutex: Silence redundant HTTP polling updates if SSE is healthy
                if (cbName === 'onProgress' && window.inSetu?.sse?.isConnected) {
                    return;
                }

                return options[cbName](...args);
            };
        }
    });
    const sseHandler = (e) => {
        if (settled) return;
        const d = e.detail;
        if (!d || (d.job_id !== trackedJobId && d.id !== trackedJobId && d.artifact?.root_job_id !== jobId)) return;
        if (window.inSetu.utils.getActiveWorkspace() !== initWs) return;

        if (d.status === 'completed') {
            if (d.artifact?.next_job_id) {
                trackedJobId = d.artifact.next_job_id;
            } else {
                cleanupSseFastPath();
                if (options.onComplete) options.onComplete(d);
            }
        } else if (d.status === 'failed') {
            cleanupSseFastPath();
            if (options.onError) options.onError(new Error(d.message || 'Job failed'));
        }
    };
    window.addEventListener('sutram-compile-progress', sseHandler);
    window.addEventListener('insetu:compile-progress', sseHandler);

    // Instantiate a dynamically bound poller to strictly lock network requests to the originating tenant
    const scopedPoller = createJobPoller({
        get: async (path) => {
            if (settled) return new Response(JSON.stringify({ status: 'completed', _aborted_by_sse: true }), { status: 200 });
            return window.inSetu.api.request(`/api/${initWs}/system/${path}`, { method: 'GET' }, initWs);
        }
    });

    return scopedPoller(jobId, safeOptions);
};
// Restore UI State on Load
let bootCurrentStep = 0;
let bootTotalSteps = 8;
let bootHighestPercent = 0;
function updateBootProgress(statusMsg) {
    bootCurrentStep++;
    let percent = Math.min(100, Math.round((bootCurrentStep / bootTotalSteps) * 100));
    bootHighestPercent = Math.max(bootHighestPercent, percent);
    percent = bootHighestPercent;

    const fillBar = document.getElementById('retro-bar-fill');
    const statusEl = document.getElementById('retro-status-msg');
    if (statusEl && statusMsg) {
        statusEl.textContent = `${statusMsg} (${percent}%) `;
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'retro-cursor';
        statusEl.appendChild(cursorSpan);
    }
    if (fillBar) {
        fillBar.style.width = `${percent}%`;
    }
}

window.addEventListener('sutram:extension-registered', (e) => {
    const extName = e.detail?.extName || 'extension';
    updateBootProgress(`Loaded Extension: ${extName}`);
});
async function executeSecurityHandshake() {
    // Fast-track offline boot if the browser natively reports no network connection
    if (!navigator.onLine) {
        window.inSetu?.offlineLog?.("Browser reports offline status. Fast-tracking offline boot.", "info");
        const cachedToken = localStorage.getItem('insetu_boot_token');
        if (cachedToken) {
            AppStore.setState({ authToken: cachedToken, isOffline: true });
            return true;
        }
        return false;
    }

    try {
        // Attempt a seamless, zero-config Tailscale or Localhost handshake first.
        // Retry transient connection/5xx errors for up to ~4s so in-place os.execv() reboots never false-fail.
        let res = null;
        let lastErr = null;
        for (let attempt = 0; attempt < 6; attempt++) {
            try {
                res = await fetch('/auth/bootstrap?t=' + Date.now(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                    cache: 'no-store',
                    signal: AbortSignal.timeout(2500)
                });
                if (res.status < 500) {
                    break;
                }
            } catch (fetchErr) {
                lastErr = fetchErr;
                res = null;
            }
            if (!navigator.onLine) break;
            if (attempt < 5) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
        if (!res) {
            throw lastErr || new Error("Bootstrap endpoint unreachable");
        }

        if (res.ok) {
            const data = await res.json();
            if (data && data.status === 'recovery') {
                window.location.href = '/recovery';
                return new Promise(() => {});
            }
            if (data && data.token) {
                sessionStorage.setItem('insetu_boot_token', data.token);
                localStorage.setItem('insetu_boot_token', data.token);
                AppStore.setState({ authToken: data.token, isOffline: false });
                return true;
            }
        }
        // Fallback: Challenge issued, render HTML auth gate
        if (res.status === 401) {
            return new Promise((resolve) => {
                document.body.innerHTML = `
                    <div style="font-family:var(--font-mono, monospace); background:var(--bg-deep, #0f172a); color:var(--text, #f8fafc); padding:20px; text-align:center; height:100dvh; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                        <h2 style="color:var(--intent-success, #10b981); margin-top:0; display:flex; align-items:center; gap:8px;"><yv-icon name="key" style="width:22px; height:22px;"></yv-icon><span>inSetu Security Gate</span></h2>
                        <p style="color:var(--text-muted, #94a3b8); margin-bottom:20px;">Enter the persistent 'auth_token' defined in your config.json:</p>
                        <input type="password" id="auth-token-input" style="padding:12px; font-size:1.1rem; border-radius:4px; border:1px solid var(--border, #334155); background:var(--input-bg, #1e293b); color:var(--text, #ffffff); margin-bottom:15px; width:100%; max-width:300px; text-align:center;" />
                        <button id="auth-submit-btn" style="background:var(--intent-primary, #3b82f6); color:var(--text-light, #ffffff); border:none; padding:12px 20px; border-radius:4px; font-size:1.1rem; font-weight:bold; cursor:pointer; width:100%; max-width:300px;">Authenticate</button>
                    </div>
                `;
                const btn = document.getElementById('auth-submit-btn');
                const input = document.getElementById('auth-token-input');

                const submitToken = async () => {
                    const userToken = input.value;
                    if (!userToken) return;
                    btn.innerText = 'Verifying...';
                    try {
                        let retryRes = await fetch('/auth/bootstrap', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: userToken.trim() })
                        });
                        if (retryRes.ok) {
                            const data = await retryRes.json();
                            sessionStorage.setItem('insetu_boot_token', data.token);
                            localStorage.setItem('insetu_boot_token', data.token);
                            AppStore.setState({ authToken: data.token, isOffline: false });
                            window.location.reload(); // Reload to cleanly restore the boot screen
                        } else {
                            btn.innerText = 'Invalid Token';
                            setTimeout(() => btn.innerText = 'Authenticate', 2000);
                        }
                    } catch (e) {
                        btn.innerText = 'Network Error';
                        setTimeout(() => btn.innerText = 'Authenticate', 2000);
                    }
                };

                btn.addEventListener('click', submitToken);
                input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitToken(); });
            });
        }
    } catch (err) {
        // Offline Fallback: If network fetch fails, inspect cached credentials
        const cachedToken = localStorage.getItem('insetu_boot_token');
        if (cachedToken) {
            window.inSetu?.offlineLog?.("Network handshake failed. Hydrating offline OS shell.", "warning", err.message);
            AppStore.setState({ authToken: cachedToken, isOffline: true });
            return true; // Unblock boot sequence
        }
    }
    return false;
}
export async function executeBootSequence(options = {}) {
    console.log("[BOOT] Starting sequence...");
    const isPopout = options.isPopout !== undefined 
        ? options.isPopout 
        : new URLSearchParams(window.location.search).get('popout') === 'true';
    // Fast-track pop-out UI suppression before rendering cycles begin
    if (isPopout) {
        const retroBoot = document.getElementById('js-panic-button');
        if (retroBoot) retroBoot.remove();
        const configBanner = document.querySelector('insetu-config-banner');
        if (configBanner) configBanner.remove();
        const appShell = document.querySelector('sutram-app-shell');
        if (appShell) appShell.setAttribute('variant', 'popout');
    }

    // Pre-emptively extract workspace from URL hash to prevent boot-time layout swapping and 404 fetches
    const initialHash = window.location.hash.replace(/^#\/?/, '');
    const hashParts = initialHash.split('/').map(decodeURIComponent);
    if (hashParts[0]) {
        try {
            sessionStorage.setItem('insetu_workspace', hashParts[0]);
            if (!isPopout) {
                localStorage.setItem('insetu_workspace', hashParts[0]);
            }
        } catch(e) {}
    }

    if (window.ExtensionRegistry) {
        window.ExtensionRegistry.isBooting = true;
        // ADR 0104: Global Action Middleware Pipeline (VFS Parity Gatekeeper)
        window.ExtensionRegistry.registerActionMiddleware(async (action, data) => {
            if (action.vfsBound && data) {
                let isDirty = data.isDirty;
                const dirtyFiles = [];

                // Dynamically cross-reference the VFS multi-buffer store to catch out-of-context actions
                const activeBuffers = window.inSetu?.stores?.Fs?.getState()?.activeBuffers || {};

                // Handle single files, Gather batches (Arrays), or Bridge turns (data.records)
                const targets = Array.isArray(data) ? data : (data.records || [data]);
                targets.forEach(t => {
                    const fp = t.filepath || t.folderpath || t;
                    if (!fp || typeof fp !== 'string') return;
                    const normFp = fp.includes('://') ? fp : `vfs://${fp.replace(/^\/+/, '')}`;
                    const buffer = activeBuffers[normFp] || activeBuffers[fp];
                    // A buffer is only physically dirty if it represents a real VFS file and its content differs
                    if (buffer && buffer.isFS && buffer.content !== buffer.originalContent) {
                        isDirty = true;
                        if (!dirtyFiles.includes(buffer.filename)) dirtyFiles.push(buffer.filename);
                    }
                });

                if (isDirty) {
                    const label = typeof action.label === 'function' ? action.label(data) : (action.label || action.id);
                    if (confirm(`You have unsaved changes. To execute '${label}', these changes must be saved to the filesystem.\n\nClick OK to Save and continue, or Cancel to abort.`)) {
                        if (window.inSetu?.ui?.saveBufferFile) {
                            // Auto-save all explicitly detected dirty files
                            for (const fp of dirtyFiles) {
                                await window.inSetu.ui.saveBufferFile(fp);
                            }
                            // Also save the generic filepath if it was passed natively
                            if (data.filepath && !dirtyFiles.includes(data.filepath)) {
                                await window.inSetu.ui.saveBufferFile(data.filepath);
                            }
                            if (data.isDirty !== undefined) data.isDirty = false;
                        }
                    } else {
                        throw new Error(`Action '${label}' aborted by user due to unsaved changes.`);
                    }
                }
            }
        });
    }
    // Handshake Token Extraction for Pop-outs (Passed via URL to survive cross-window sessionStorage partitioning)
    const urlParams = new URLSearchParams(window.location.search);
    const queryToken = urlParams.get('token');
    if (queryToken) {
        sessionStorage.setItem('insetu_boot_token', queryToken);
        urlParams.delete('token');
        const newSearch = urlParams.toString() ? '?' + urlParams.toString() : '';
        const cleanUrl = window.location.pathname + newSearch + window.location.hash;
        window.history.replaceState(null, '', cleanUrl);
    }

    updateBootProgress("Security Handshake...");
    const authenticated = await executeSecurityHandshake();
    console.log("[BOOT] Security Handshake completed:", authenticated);
    if (!authenticated) {
        document.body.innerHTML = `<div style="font-family:monospace; color:var(--intent-danger); text-align:center; padding-top:20dvh;"><h2>Access Denied</h2><p>Invalid framework credentials configuration.</p></div>`;
        return;
    }
    // Connect SSE or wire up BroadcastChannel relay for Pop-outs
    if (isPopout) {
        const channel = new BroadcastChannel('insetu_telemetry');
        let primaryAcknowledged = false;

        channel.onmessage = (e) => {
            const { type, data } = e.data || {};
            if (type === 'presence_pong') {
                primaryAcknowledged = true;
                return;
            }
            primaryAcknowledged = true;
            if (type === 'network_state') {
                const isOff = Boolean(data?.isOffline);
                AppStore.setState({ isOffline: isOff });
                if (window.Sutram?.stores?.Environment) window.Sutram.stores.Environment.setState({ isOffline: isOff });
                return;
            }
            const shouldDrop = window.inSetu?.events?.shouldDropTenantEvent
                ? window.inSetu.events.shouldDropTenantEvent(data?.workspace_id || data?.scopeId)
                : Boolean(AppStore.getState().isSwappingWorkspace);
            if (shouldDrop) return;
            if (type === 'vfs_mutated') {
                window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: data.mutations });
            } else if (type === 'job_progress') {
                if (data.status === 'completed' && data.artifact) {
                    window.inSetu.events.emitHook('insetu:compile-step-complete', {
                        job_id: data.job_id,
                        ext_name: data.ext_name,
                        artifact: data.artifact
                    });
                }
            } else if (type === 'manifest_settled' || type === 'topology_resolved') {
                if (window.inSetu?.sys?.refreshManifest) {
                    window.inSetu.sys.refreshManifest();
                }
            } else if (type === 'outbox_reconciled') {
                AppStore.setState({ isOffline: false, isReconciling: false, outboxCount: 0, pendingMutations: new Set(), deletedMutations: new Set() });
                if (window.Sutram?.stores?.Environment) window.Sutram.stores.Environment.setState({ isOffline: false });
                if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus('✅ System Synced', 3000);
                window.dispatchEvent(new CustomEvent('sutram-sync-complete'));
            }
        };

        channel.postMessage({ type: 'presence_ping' });
        setTimeout(() => {
            if (!primaryAcknowledged && window.inSetu?.sse && !window.inSetu.sse.isConnected) {
                console.log("📡 [Pop-out] Standalone mode: No primary window detected via BroadcastChannel. Lazily mounting direct SSE stream...");
                window.inSetu.sse.connect();
            }
        }, 1500);
    } else if (window.inSetu.sse) {
        window.inSetu.sse.connect();
    }
    if (AppStore.getState().isOffline) {
        updateBootProgress("Offline Mode — Hydrating Cached Shell...");
        if (window.inSetu && window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus("Running in Offline Mode", 4000);
        }

        // Hydrate offline UI shell state from local storage
        const ws = localStorage.getItem('insetu_workspace') || 'default';
        AppStore.setState({ activeWorkspace: ws });
        window.inSetu?.offlineLog?.(`[BOOT] Initiating offline shell for workspace: ${ws}`, 'info');
        try {
            updateBootProgress("Loading Offline Workspaces...");
            const wsStr = window.inSetu.utils.getScopedStorage('offline_workspaces');
            if (wsStr) {
                const wsData = JSON.parse(wsStr);
                if (wsData.workspaces) AppStore.setState({ workspaces: wsData.workspaces });
            }
        } catch(e) { console.warn("Offline Workspace Hydration Failed", e); }
        try {
            updateBootProgress("Loading Offline Config...");
            const confStr = window.inSetu.utils.getScopedStorage('offline_config');
            if (confStr) {
                const data = JSON.parse(confStr);
                const config = data.config || {};
                window.ACTIVE_EXTENSIONS = data.meta?.mounted_extensions || config.extensions || [];
                window.inSetu.serverSchemas = data.meta?.settings_schemas || {};
                if (data.meta?.core_modules) {
                    window.inSetu.CORE_MODULES = new Set(data.meta.core_modules);
                }
                window.inSetu.utils.syncExtensionDependencyMeta?.(data);

                // Surface missing extension dependencies directly to the UI
                const bypassed = config.bypassed_extensions || data.meta?.bypassed_extensions || [];
                if (bypassed.length > 0) {
                    const toastStore = window.inSetu?.stores?.Toast || window.Sutram?.stores?.Toast;
                    bypassed.forEach(b => {
                        const warningMsg = `⚠️ Extension [${b.extension}] disabled: Missing dependency [${b.missing_dependency}]`;
                        if (toastStore && typeof toastStore.getState === 'function') {
                            toastStore.getState().addToast(warningMsg, 'warning', 10000);
                        } else {
                            console.warn(`[inSetu Boot Warning] ${warningMsg}`);
                        }
                    });
                }
                AppStore.setState({ instanceEmoji: config.instance_emoji || "⚙️" });
                const statusBar = document.querySelector('sutram-status-bar');
                if (statusBar) statusBar.baseTitle = config.instance_title || "inSetu Workbench";
                bootTotalSteps = 5 + window.ACTIVE_EXTENSIONS.length;
                window.inSetu?.offlineLog?.(`[BOOT] Loaded Config (${window.ACTIVE_EXTENSIONS.length} extensions)`, 'success');
            }
        } catch(e) { console.warn("Offline Config Hydration Failed", e); }
        try {
            updateBootProgress("Loading Offline Topology...");
            const topStr = window.inSetu.utils.getScopedStorage('offline_topology');
            if (topStr) {
                const d = JSON.parse(topStr);
                const tabOrder = d.tab_order || [];
                AppStore.setState({ 
                    allRepos: d.repos,
                    targetConfigs: d.target_repos || [],
                    virtualContexts: d.virtual_contexts || [],
                    categoryOrder: d.category_order || [],
                    hiddenOutputs: d.hidden_outputs || [],
                    configMissing: !!d.config_missing,
                    tabOrder: tabOrder
                });
                if (window.ExtensionRegistry?.setTabOrder && tabOrder.length > 0) {
                    window.ExtensionRegistry.setTabOrder(tabOrder);
                }
            }
        } catch(e) { console.warn("Offline Topology Hydration Failed", e); }
        try {
            updateBootProgress("Loading Offline Manifest...");
            // Pull the file manifest from the IDB cache interceptor
            let mRes = await window.inSetu.api.workspace.get('system/manifest'); 
            if (mRes.ok) {
                AppStore.setState({ manifest: await mRes.json() });
                window.inSetu?.offlineLog?.(`[BOOT] Loaded cached VFS manifest`, 'success');
            }
        } catch(e) { console.warn("Offline Manifest Hydration Failed", e); }

    }

    // 1. Establish tenant workspace context FIRST so API calls route to the true active workspace
    console.log("[BOOT] Loading Workspaces...");
    updateBootProgress("Loading Workspaces...");
    await loadWorkspaces();
    const resolvedBootWs = window.inSetu.utils.getActiveWorkspace();
    if (window.Sutram?.stores?.Layout && window.Sutram.stores.Layout._boundScope !== resolvedBootWs) {
        window.Sutram.stores.Layout.hydrateStore(resolvedBootWs);
    }
        // 2. Fetch tenant configuration for the true active workspace
        try {
            console.log("[BOOT] Fetching system configuration...");
            updateBootProgress("Fetching system config...");
            const cRes = await window.inSetu.api.workspace.get('system/config?t=' + Date.now(), { cache: 'no-store' });
            console.log("[BOOT] System configuration fetched. OK:", cRes.ok);
            if (cRes.ok) {
                const data = await cRes.json();
                window.inSetu.utils.setScopedStorage('offline_config', JSON.stringify(data)); // Save for offline boot
                const config = data.config || {};
                window.ACTIVE_EXTENSIONS = data.meta?.mounted_extensions || config.extensions || [];
                window.inSetu.serverSchemas = data.meta?.settings_schemas || {};
                if (data.meta?.core_modules) {
                    window.inSetu.CORE_MODULES = new Set(data.meta.core_modules);
                }
                window.inSetu.utils.syncExtensionDependencyMeta?.(data);
                // Synchronize branding tokens while we have the config
                AppStore.setState({ instanceEmoji: config.instance_emoji || "⚙️" });
                const statusBar = document.querySelector('sutram-status-bar');
                if (statusBar) {
                    statusBar.baseTitle = config.instance_title || "inSetu Workbench";
                }

                // Recalculate total boot steps dynamically based on discovered extension count
                bootTotalSteps = 5 + window.ACTIVE_EXTENSIONS.length;
            }
        } catch (e) {
            console.warn("Failed to fetch tenant configuration on boot.", e);
        }
        console.log("[BOOT] Workspaces loaded.");
        console.log("[BOOT] Initializing Workspace Topology...");
        updateBootProgress("Initializing Topology...");
        await initializeWorkspaceTopology();
        console.log("[BOOT] Topology initialized.");
    console.log(`[BOOT TELEMETRY] ACTIVE_EXTENSIONS before boot:`, window.ACTIVE_EXTENSIONS);
    console.log(`[BOOT TELEMETRY] tabOrder before boot:`, AppStore.getState().tabOrder);
    window.inSetu?.offlineLog?.(`[BOOT TELEMETRY] ACTIVE_EXTENSIONS: ${JSON.stringify(window.ACTIVE_EXTENSIONS)}`, 'info');

    console.log("[BOOT] Booting Extensions...");
    try {
        await bootExtensions();
        console.log(`[BOOT TELEMETRY] bootExtensions completed successfully.`);
    } catch (e) {
        console.warn("⚠️ Non-fatal error during extension boot (likely missing offline cache). Proceeding with partial layout.", e);
        window.inSetu?.offlineLog?.(`[BOOT TELEMETRY] Extension boot error: ${e.message}`, 'error');
        autoWireSettingsSchemas();
    }

    // Always force layout compilation after extension boot sequence to ensure DOM hydration
    if (window.ExtensionRegistry && typeof window.ExtensionRegistry.compileLayout === 'function') {
        const slots = window.ExtensionRegistry.getLayoutSlots();
        console.log(`[BOOT TELEMETRY] Retrieved Layout Slots before compile:`, slots);
        window.inSetu?.offlineLog?.(`[BOOT TELEMETRY] Layout Slots count: ${slots.length}`, 'info');
        window.ExtensionRegistry.compileLayout();
    }

    // Safety Fallback: If topology failed to hydrate offline, build a default tab order
    const currentTabOrder = AppStore.getState().tabOrder;
    console.log(`[BOOT TELEMETRY] Post-compile Tab Order:`, currentTabOrder);
    if (AppStore.getState().isOffline && (!currentTabOrder || currentTabOrder.length === 0)) {
        console.log(`[BOOT TELEMETRY] Firing Safety Fallback for missing tab order!`);
        const fallbackTabs = ['context', 'files', ...(window.ACTIVE_EXTENSIONS || [])];
        AppStore.setState({ tabOrder: fallbackTabs });
        if (window.ExtensionRegistry?.setTabOrder) {
            window.ExtensionRegistry.setTabOrder(fallbackTabs);
        }
        window.inSetu?.offlineLog?.("No offline topology found. Generated fallback tab order.", "warning", fallbackTabs);
    }

    // Native System Sync Indicator Hook
    window.inSetu.events.emitHook = window.inSetu.events.emitHook || function(){};
    window.addEventListener('insetu:vfs-mutated', (e) => {
        const payload = e.detail;
        if (payload && payload.mutations) {
            const requiresSync = payload.mutations.some(m => !m.ignore_ledger);
            if (requiresSync && window.inSetu.ui && window.inSetu.ui.setSyncStatus) {
                window.inSetu.ui.setSyncStatus('pending');
            }
            // Rely strictly on the SSE heartbeat (checkManifestVersion) to pull confirmed state
            // to avoid race conditions with the asynchronous VFS write queue.
        }
    });
    // Declarative Tab Ordering: AppStore syncs tabOrder directly to Sutram
    AppStore.subscribe(
        state => state.tabOrder,
        (tabOrder) => {
            if (window.ExtensionRegistry?.setTabOrder && Array.isArray(tabOrder)) {
                window.ExtensionRegistry.setTabOrder(tabOrder);
            }
        }
    );
    // Initial Sync for Cold Boot
    const initialTabOrder = AppStore.getState().tabOrder;
    if (window.ExtensionRegistry?.setTabOrder && Array.isArray(initialTabOrder) && initialTabOrder.length > 0) {
        window.ExtensionRegistry.setTabOrder(initialTabOrder);
    }
    // Sync UI to Offline State degradation natively via Sutram Environment
    AppStore.subscribe(
        state => [state.isOffline, state.isReconciling], 
        ([isOffline, isReconciling]) => {
            if (window.Sutram?.stores?.Environment) {
                window.Sutram.stores.Environment.setState({ isOffline });
            }

            // Allow network states to preempt standard VFS pipeline indicators
            if (isOffline) {
                window.inSetu.ui.setSyncStatus('offline');
            } else if (isReconciling) {
                window.inSetu.ui.setSyncStatus('reconciling');
            } else {
                // Return control to the standard pipeline, defaulting to 'pending' if the outbox hasn't fully cleared
                const outboxCount = AppStore.getState().outboxCount || 0;
                window.inSetu.ui.setSyncStatus(outboxCount > 0 ? 'pending' : 'synced');
            }

            // Force the app shell to instantly re-evaluate tab visibility 
            if (window.ExtensionRegistry && typeof window.ExtensionRegistry.compileLayout === 'function') {
                window.ExtensionRegistry.compileLayout();
            }
        }
    );

    // Sync pinned repos to the agnostic Sutram Status Bar
    const statusBar = document.querySelector('sutram-status-bar');
    if (statusBar) {
        AppStore.subscribe(state => state.pinnedRepos, (repos) => {
            if (repos && repos.size > 0 && !repos.has('ALL')) {
                statusBar.statusString = `[${Array.from(repos).join(', ')}]`;
            } else {
                statusBar.statusString = '';
            }
        });
        const repos = AppStore.getState().pinnedRepos;
        if (repos && repos.size > 0 && !repos.has('ALL')) {
            statusBar.statusString = `[${Array.from(repos).join(', ')}]`;
        }
    }
    // Initialize Zero-Bundler SPA Router (Native Hash Routing)
    const handleHashChange = () => {
        if (AppStore.getState().isSwappingWorkspace) return;

        const hash = window.location.hash.replace(/^#\/?/, '');
        const parts = hash.split('/').map(decodeURIComponent);

        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const ws = parts[0] || activeWs;
        let colId = parts[1] || 'center';
        let subId = parts[2] || '';
        const deepPath = parts.slice(3);
        // Legacy Hash Migration Guardrail
        let validColumns = ['left', 'center', 'right'];
        if (window.Sutram?.stores?.Layout) {
            validColumns = Object.keys(window.Sutram.stores.Layout.getState().columns);
        }

        if (!validColumns.includes(colId)) {
            subId = parts[2] || colId; 
            colId = 'center';

            // Silently rewrite the URL to the new format
            const deepStr = deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
            const newHash = `#/${encodeURIComponent(ws)}/${colId}/${encodeURIComponent(subId)}${deepStr}`;
            history.replaceState(null, '', newHash);
        }

        if (ws && ws !== activeWs) {
            if (window.inSetu.sys.executeWorkspaceSwap) {
                window.inSetu.sys.executeWorkspaceSwap(ws, null, window.location.hash);
            }
            return;
        }
        if (deepPath.length > 0) {
            AppStore.getState().setBrowsePath(deepPath, subId);
        } else {
            const savedPath = AppStore.getState().tabBrowsePaths?.[subId];
            if (savedPath && savedPath.length > 0) {
                const deepStr = '/' + savedPath.map(encodeURIComponent).join('/');
                const newHash = `#/${encodeURIComponent(ws)}/${colId}/${encodeURIComponent(subId)}${deepStr}`;
                history.replaceState(null, '', newHash);
                AppStore.getState().setBrowsePath(savedPath, subId);
            } else {
                AppStore.getState().setBrowsePath([], subId);
            }
        }
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();

            if (colId && layout.columns[colId] && (subId || layout.columns[colId].pinned?.length > 0)) {
                layout.setFocusedColumn(colId);
            }
            if (!subId) {
                const activeCol = layout.focusedColumn || colId || 'center';
                const restoredActive = layout.columns[activeCol]?.active || layout.columns[activeCol]?.pinned?.[0]?.id || '';
                if (restoredActive) {
                    colId = activeCol;
                    subId = restoredActive;
                    const savedDeep = AppStore.getState().tabBrowsePaths?.[subId] || [];
                    const deepStr = savedDeep.length > 0 ? '/' + savedDeep.map(encodeURIComponent).join('/') : '';
                    history.replaceState(null, '', `#/${encodeURIComponent(ws)}/${colId}/${encodeURIComponent(subId)}${deepStr}`);
                }
            }
            if (subId) {
                const colState = layout.columns[colId];
                const isPinned = colState && colState.pinned.some(p => p.id === subId || p.rawId === subId);
                let resolvedTargetId = subId;
                if (!isPinned && window.ExtensionRegistry) {
                    const slots = window.ExtensionRegistry.getLayoutSlots();
                    let slot = slots.find(s => s.id === subId);
                    if (!slot) {
                        const candidates = slots.filter(s => s.rawId === subId);
                        slot = candidates.find(s => s.targetParent === colId || s.preferredColumn === colId) || candidates[0];
                    }
                    if (slot) {
                        resolvedTargetId = slot.id;
                        layout.pinToColumn(colId, {
                            id: slot.id,
                            rawId: slot.rawId || slot.id,
                            component: slot.component,
                            label: slot.label,
                            extName: slot.extName,
                            targetParent: slot.targetParent || colId,
                            icon: slot.icon,
                            intent: slot.intent
                        });
                        if (resolvedTargetId !== subId) {
                            const deepStr = deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
                            const upgradedHash = `#/${encodeURIComponent(ws)}/${colId}/${encodeURIComponent(resolvedTargetId)}${deepStr}`;
                            history.replaceState(null, '', upgradedHash);
                        }
                    } else if (subId.includes('://') || subId.includes('/') || subId.endsWith('.md') || subId.endsWith('.py') || subId.endsWith('.js') || subId.endsWith('.txt')) {
                        const safeLabel = subId.split('/').pop();
                        layout.pinToColumn(colId, {
                            id: subId,
                            rawId: subId,
                            component: 'insetu-editor-projection',
                            label: safeLabel,
                            extName: 'fs',
                            targetParent: colId,
                            icon: 'file-text',
                            intent: 'primary'
                        });
                    }
                } else if (isPinned) {
                    const pinnedItem = colState.pinned.find(p => p.id === subId || p.rawId === subId);
                    if (pinnedItem) resolvedTargetId = pinnedItem.id;
                }
                if (typeof layout.setActiveProjection === 'function') {
                    layout.setActiveProjection(colId, resolvedTargetId);
                }

                if (isPopout) {
                    const baseTitle = document.querySelector('sutram-status-bar')?.baseTitle || 'inSetu Workbench';
                    const pinnedItem = layout.columns[colId]?.pinned?.find(p => p.id === resolvedTargetId || p.rawId === subId);
                    const rawTarget = (subId === 'editor' && deepPath.length > 0) ? deepPath.join('/') : (resolvedTargetId || subId);
                    const parsed = window.inSetu?.utils?.InSetuURI ? new window.inSetu.utils.InSetuURI(rawTarget) : {};
                    const itemLabel = (rawTarget.includes('://') || rawTarget.includes('/'))
                        ? rawTarget.replace(/\/+$/, '').split('/').pop()
                        : (pinnedItem?.label || rawTarget);
                    const repoSuffix = parsed.repo ? ` — ${parsed.repo}` : '';
                    document.title = itemLabel ? `${itemLabel}${repoSuffix} · ${baseTitle}` : baseTitle;
                }
            }
        }
        if (!isPopout) {
            const baseTitle = document.querySelector('sutram-status-bar')?.baseTitle || 'inSetu Workbench';
            document.title = (ws && ws !== 'default') ? `${baseTitle} [${ws}]` : baseTitle;
        }
    };
    window.addEventListener('hashchange', handleHashChange);
    // Bootstrap initial route from URL or set default from restored LayoutStore state
    const currentWs = window.inSetu.utils.getActiveWorkspace();
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
        const restoredLayout = window.Sutram?.stores?.Layout?.getState();
        const restoredCol = restoredLayout?.focusedColumn || 'center';
        const restoredActive = restoredLayout?.columns?.[restoredCol]?.active || '';
        window.location.hash = `#/${encodeURIComponent(currentWs)}/${restoredCol}/${encodeURIComponent(restoredActive)}`;
    }
    // Always trigger handleHashChange on startup to populate layout state
    handleHashChange();
    // Everything is fully booted, topologies mapped, and extensions mounted.
    if (isPopout) {
        const banner = document.querySelector('insetu-config-banner');
        if (banner) banner.remove();
        const shell = document.querySelector('sutram-app-shell');
        if (shell) shell.setAttribute('variant', 'popout');
    }
    updateBootProgress("System Ready!");
    window.BOOT_COMPLETE = true;
    if (window.inSetu?.ui?.setGlobalStatus) {
        window.inSetu.ui.setGlobalStatus("System Ready", 2000);
    }
    if (window.panicTimeout) clearTimeout(window.panicTimeout);
    const _initPanicBtn = document.getElementById('js-panic-button');
    if (_initPanicBtn) {
        _initPanicBtn.style.opacity = '0';
        _initPanicBtn.style.transition = 'opacity 0.3s ease';
        setTimeout(() => { _initPanicBtn.style.display = 'none'; }, 300);
    }
}
// --- FAIL-SAFE EXTENSION ERROR GATEWAY ---
// Intercepts unhandled extension runtime errors to prevent them from taking down the OS shell.
window.addEventListener('unhandledrejection', (e) => {
    if (!window.BOOT_COMPLETE) {
        const errorMsg = e.reason?.message || String(e.reason);
        console.error("⚠️ [BOOT FATAL] Unhandled Promise Rejection:", errorMsg);
        window.inSetu?.offlineLog?.(`[BOOT FATAL] Promise Rejection: ${errorMsg}`, 'error');
        // Paint the exact missing module error directly to the boot screen UI
        const statusEl = document.getElementById('retro-status-msg');
        if (statusEl) {
            const errSpan = document.createElement('span');
            errSpan.style.color = 'var(--intent-danger)';
            errSpan.textContent = `Boot Error: ${errorMsg}`;
            statusEl.replaceChildren(errSpan);
        }
    }
});
window.addEventListener('error', (e) => {
    if (e.filename && e.filename.includes('codemirror')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.warn("[CodeMirror] Suppressed internal editor exception:", e.error || e.message);
        return;
    }
    const isExtensionError = e.filename && (e.filename.includes('ext_') || e.filename.includes('extensions/'));
    if (window.BOOT_COMPLETE || isExtensionError) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.error("⚠️ [Isolated Extension Error]:", e.error || e.message);
        const toastStore = window.inSetu?.stores?.Toast;
        if (toastStore && typeof toastStore.getState === 'function') {
            toastStore.getState().addToast(
                `Extension Error (${e.filename ? e.filename.split('/').pop() : 'UI'}): ${e.message}`,
                'danger'
            );
        }
        // Forcefully suppress panic overlay if error originated from an extension
        const panicBtn = document.getElementById('js-panic-button');
        if (panicBtn && (window.BOOT_COMPLETE || isExtensionError)) {
            panicBtn.style.display = 'none';
        }
    }
});

// PWA Isolation: Honor URL-bound workspace parameters before reading cache
const urlParams = new URLSearchParams(window.location.search);
const nodeParam = urlParams.get('node');
const isPopoutParam = urlParams.get('popout') === 'true';
if (nodeParam) {
    try {
        sessionStorage.setItem('insetu_workspace', nodeParam);
        if (!isPopoutParam) {
            localStorage.setItem('insetu_workspace', nodeParam);
        }
    } catch(e) {}
}

let currentTheme = 'dark';
try {
    currentTheme = localStorage.getItem('insetu_theme') || 'dark';
} catch(e) {}
document.body.setAttribute('data-theme', currentTheme);
function _setAppShellLock(locked) {
    const appShell = document.querySelector('sutram-app-shell');
    if (!appShell) return;
    if (locked) {
        appShell.setAttribute('inert', '');
        appShell.style.pointerEvents = 'none';
    } else {
        appShell.removeAttribute('inert');
        appShell.style.pointerEvents = '';
    }
}
function _reconcileExtensionsAndSettings(previousExts = [], nextExts = []) {
    if (!window.ExtensionRegistry) return;

    const candidateExts = new Set([
        ...(previousExts || []),
        ...Array.from(window.ExtensionRegistry._manifests?.keys() || [])
    ]);
    candidateExts.forEach(extName => {
        if (!extName || _isCoreExt(extName)) return;
        if (!nextExts.includes(extName) && typeof window.ExtensionRegistry.executeUnload === 'function') {
            window.ExtensionRegistry.executeUnload(extName);
        }
    });

    autoWireSettingsSchemas();
    if (typeof window.ExtensionRegistry.compileLayout === 'function') {
        window.ExtensionRegistry.compileLayout();
    }
}

async function _hydrateWorkspaceEnvironment(targetWs, previousExts = []) {
    // 1. Hydrate Topology
    const rRes = await window.inSetu.api.workspace.get('system/topology?t=' + Date.now());
    if (rRes.ok) {
        const d = await rRes.json();
        window.inSetu.utils.setScopedStorage('offline_topology', JSON.stringify(d), targetWs);
        const tabOrder = d.tab_order || [];
        AppStore.setState({
            activeWorkspace: targetWs,
            allRepos: d.repos,
            targetConfigs: d.target_repos || [],
            virtualContexts: d.virtual_contexts || [],
            categoryOrder: d.category_order || [],
            hiddenOutputs: d.hidden_outputs || [],
            configMissing: !!d.config_missing,
            tabOrder: tabOrder
        });
        if (window.ExtensionRegistry?.setTabOrder && tabOrder.length > 0) {
            window.ExtensionRegistry.setTabOrder(tabOrder);
        }
    }

    // 2. Hydrate Config, Boot Newly Enabled Extensions & Unload Disabled Extensions
    const cRes = await window.inSetu.api.workspace.get('system/config?t=' + Date.now(), { cache: 'no-store' });
    if (cRes.ok) {
        const data = await cRes.json();
        window.inSetu.utils.setScopedStorage('offline_config', JSON.stringify(data), targetWs);
        const config = data.config || {};
        window.ACTIVE_EXTENSIONS = data.meta?.mounted_extensions || config.extensions || [];
        window.inSetu.serverSchemas = data.meta?.settings_schemas || {};
        if (data.meta?.core_modules) {
            window.inSetu.CORE_MODULES = new Set(data.meta.core_modules);
        }
        await bootExtensions();
        window.inSetu.utils.syncExtensionDependencyMeta?.(data);
        AppStore.setState({ instanceEmoji: config.instance_emoji || "⚙️" });
        const statusBar = document.querySelector('sutram-status-bar');
        if (statusBar) {
            statusBar.baseTitle = config.instance_title || "inSetu Workbench";
        }
        _reconcileExtensionsAndSettings(previousExts, window.ACTIVE_EXTENSIONS);
    }

    // 3. Hydrate Offline Outbox Markers from IndexedDB
    try {
        const outbox = await SutramDB.getOutboxItems(targetWs);
        const pendingSet = new Set();
        const deletedSet = new Set();
        outbox.forEach(item => {
            try {
                const payload = item.bodyString ? JSON.parse(item.bodyString) : {};
                const fp = payload.filepath || payload.dest_path;
                if (fp) {
                    const isDelete = item.method === 'DELETE' || (item.path && item.path.includes('fs/delete')) || (item.path && item.path.includes('fs/move'));
                    if (isDelete) deletedSet.add(fp);
                    else pendingSet.add(fp);
                }
            } catch (_) {}
        });
        AppStore.setState({ outboxCount: outbox.length, pendingMutations: pendingSet, deletedMutations: deletedSet });
    } catch (_) {}

    // 4. Hydrate Manifest
    AppStore.setState({ manifest: { vfs: {}, ctx: {} } });
    const mRes = await window.inSetu.api.workspace.get('system/manifest?t=' + Date.now());
    const rawManifest = mRes.ok ? await mRes.json() : null;
    const manifestData = { vfs: rawManifest?.vfs || {}, ctx: rawManifest?.ctx || {} };
    const appState = AppStore.getState();
    const hasActiveRepos = appState.targetConfigs && appState.targetConfigs.length > 0;
    const isEmptyCtxManifest = Object.keys(manifestData.ctx || {}).length === 0;
    AppStore.setState({ manifest: { vfs: manifestData.vfs || {}, ctx: manifestData.ctx || {} } });
    if (manifestData.ctx) {
        const { localCtxSignatures } = AppStore.getState().getSyncWatermarks();
        Object.entries(manifestData.ctx).forEach(([p, entry]) => {
            if (entry && entry.meta && entry.meta.timestamp) {
                localCtxSignatures[p] = entry.meta.timestamp;
            }
        });
    }
    if (isEmptyCtxManifest && hasActiveRepos && window.inSetu.stores.Gather) {
        await window.inSetu.stores.Gather.getState().executeCompile();
    }
}

export const SessionOrchestrator = {
    get phase() {
        return AppStore.getState().swapPhase || 'READY';
    },

    transitionToWorkspace: async function(targetWs, title = null, targetHash = null) {
        if (!targetWs || AppStore.getState().isSwappingWorkspace) return;
        const oldWs = window.inSetu.utils.getActiveWorkspace();
        if (targetWs === oldWs) {
            return await this.refreshCurrentWorkspace(targetHash);
        }

        const isPopout = new URLSearchParams(window.location.search).get('popout') === 'true';
        const previousExts = [...(window.ACTIVE_EXTENSIONS || [])];

        // --- PHASE 1: LOCKED ---
        AppStore.setState({ isSwappingWorkspace: true, swapPhase: 'LOCKED' });
        _setAppShellLock(true);
        window.inSetu.ui.setGlobalStatus(`Switched to ${title || targetWs}. Hydrating UI...`, null);

        try {
            // --- PHASE 2: TEARDOWN (Executes strictly under oldWs identity) ---
            AppStore.setState({ swapPhase: 'TEARDOWN' });
            try {
                if (window.inSetu?.vfs?.flushAllDirtyBuffers) {
                    await window.inSetu.vfs.flushAllDirtyBuffers(false);
                }
            } catch (_) {}

            try {
                await window.inSetu.api.workspace.post('system/workspaces', { active_workspace: targetWs });
            } catch (_) {}

            if (oldWs && window.inSetu.api?.abortWorkspace) {
                window.inSetu.api.abortWorkspace(oldWs);
            }
            await purgeServiceWorkerCaches();
            // Synchronously evict all open projections on LayoutStore while suspending persistence so oldWs's saved layout is not mutated
            const layoutStore = window.Sutram?.stores?.Layout;
            if (layoutStore && typeof layoutStore.getState === 'function') {
                layoutStore._suspendPersistence = true;
                try {
                    const lState = layoutStore.getState();
                    (lState.windows || []).forEach(w => lState.evictProjection(w.id, true));
                    ['left', 'center', 'right'].forEach(col => {
                        const pinned = lState.columns?.[col]?.pinned || [];
                        pinned.forEach(p => lState.evictProjection(p.id, true));
                    });
                } finally {
                    layoutStore._suspendPersistence = false;
                }
            }

            // Hold ExtensionRegistry.isBooting during identity swap so setTabOrder does not compile an empty extension list
            if (window.ExtensionRegistry) window.ExtensionRegistry.isBooting = true;

            // Temporarily clear active extensions during identity transition to prevent 403 calls
            window.ACTIVE_EXTENSIONS = [];
            // --- PHASE 3: IDENTITY_SWAP (Atomic Pointer Update) ---
            AppStore.setState({ swapPhase: 'IDENTITY_SWAP' });
            try {
                sessionStorage.setItem('insetu_workspace', targetWs);
                if (!isPopout) {
                    localStorage.setItem('insetu_workspace', targetWs);
                }
            } catch (_) {}

            // --- PHASE 4: HYDRATE (Deterministic New-Tenant Hydration via StoreRegistry) ---
            if (window.Sutram?.storeRegistry?.beginScopeTransition) {
                window.Sutram.storeRegistry.beginScopeTransition(targetWs);
            } else if (window.Sutram?.storeRegistry) {
                window.Sutram.storeRegistry.switchTenantScope(targetWs);
            }
            AppStore.setState({ activeWorkspace: targetWs, isSwappingWorkspace: true, swapPhase: 'HYDRATE' });

            await _hydrateWorkspaceEnvironment(targetWs, previousExts);
            // --- PHASE 5: ROUTING ---
            if (window.ExtensionRegistry) {
                window.ExtensionRegistry.isBooting = false;
            }
            AppStore.setState({ isSwappingWorkspace: false, swapPhase: 'ROUTING' });
            if (window.Sutram?.storeRegistry?.endScopeTransition) {
                window.Sutram.storeRegistry.endScopeTransition();
            } else if (window.ExtensionRegistry && typeof window.ExtensionRegistry.compileLayout === 'function') {
                window.ExtensionRegistry.compileLayout();
            }
            const restoredLayout = window.Sutram?.stores?.Layout?.getState();
            const restoredCol = restoredLayout?.focusedColumn || 'center';
            const restoredActive = restoredLayout?.columns?.[restoredCol]?.active || '';
            const desiredHash = (targetHash && targetHash.startsWith(`#/${encodeURIComponent(targetWs)}/`))
                ? targetHash
                : `#/${encodeURIComponent(targetWs)}/${restoredCol}/${encodeURIComponent(restoredActive)}`;
            if (window.location.hash !== desiredHash) {
                window.location.hash = desiredHash;
            } else {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }

            window.inSetu.events.emitHook('insetu:soft-refresh', targetWs);
            loadWorkspaces();
            window.inSetu.ui.setGlobalStatus("Workspace Hydrated", 2000);
        } catch (e) {
            console.error("[SessionOrchestrator] Swap failed:", e);
            alert("Workspace transition failed. Falling back to hard reload.");
            window.location.reload();
        } finally {
            // --- PHASE 6: READY ---
            if (window.ExtensionRegistry) window.ExtensionRegistry.isBooting = false;
            if (window.Sutram?.storeRegistry?.isTransitioning?.()) {
                window.Sutram.storeRegistry.endScopeTransition();
            }
            _setAppShellLock(false);
            AppStore.setState({ isSwappingWorkspace: false, swapPhase: 'READY' });
        }
    },

    refreshCurrentWorkspace: async function(targetHash = null) {
        if (AppStore.getState().isSwappingWorkspace) return;
        const currentWs = AppStore.getState().activeWorkspace || window.inSetu.utils.getActiveWorkspace();
        const previousExts = [...(window.ACTIVE_EXTENSIONS || [])];

        AppStore.getState().resetSyncWatermarks();
        AppStore.setState({ isSwappingWorkspace: true, swapPhase: 'HYDRATE' });
        if (window.Sutram?.storeRegistry?.beginScopeTransition) {
            window.Sutram.storeRegistry.beginScopeTransition();
        }
        _setAppShellLock(true);

        try {
            await _hydrateWorkspaceEnvironment(currentWs, previousExts);
            AppStore.setState({ isSwappingWorkspace: false, swapPhase: 'ROUTING' });
            if (window.Sutram?.storeRegistry?.endScopeTransition) {
                window.Sutram.storeRegistry.endScopeTransition();
            }

            if (targetHash && window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
            window.inSetu.events.emitHook('insetu:soft-refresh', currentWs);
            window.inSetu.ui.setGlobalStatus("Workspace Hydrated", 2000);
        } catch (e) {
            console.error("[SessionOrchestrator] In-place soft refresh failed:", e);
            alert("Soft refresh failed. Falling back to hard reload.");
            window.location.reload();
        } finally {
            if (window.Sutram?.storeRegistry?.isTransitioning?.()) {
                window.Sutram.storeRegistry.endScopeTransition();
            }
            _setAppShellLock(false);
            AppStore.setState({ isSwappingWorkspace: false, swapPhase: 'READY' });
        }
    }
};

async function executeWorkspaceSwap(key, title = null, targetHash = null) {
    return await SessionOrchestrator.transitionToWorkspace(key, title, targetHash);
}
async function loadWorkspaces() {
    try {
        console.log("[TELEMETRY] Requesting workspaces...");
        const res = await window.inSetu.api.workspace.get('system/workspaces?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`[TELEMETRY] loadWorkspaces failed with status: ${res.status}`);
            return;
        }
        const data = await res.json();
        console.log("[TELEMETRY] Workspaces loaded successfully.");
        window.inSetu.utils.setScopedStorage('offline_workspaces', JSON.stringify(data));
        if (data.workspaces) {
            let activeWs = window.inSetu.utils.getActiveWorkspace();
            if (!activeWs || (!data.workspaces[activeWs] && activeWs !== 'default')) {
                activeWs = Object.keys(data.workspaces)[0] || 'default';
                sessionStorage.setItem('insetu_workspace', activeWs);
                localStorage.setItem('insetu_workspace', activeWs);
            }
            AppStore.setState({ activeWorkspace: activeWs, workspaces: data.workspaces });
        }
    } catch(e) {
        console.error("Failed to load workspaces:", e);
    }
}

let lastRefreshed = null;
function updateRefreshText() {
    if (!lastRefreshed) return;
    const text = window.inSetu.utils.timeAgo(lastRefreshed);
    const el = document.getElementById('refresh-time');
    if (el) el.innerText = `Refreshed ${text}`;
}
export function setGlobalStatus(msg, timeout = 3000, isError = false) {
    if (StatusStore && typeof StatusStore.getState === 'function') {
        const state = StatusStore.getState();
        if (typeof state.setStatus === 'function') {
            state.setStatus(msg, timeout, isError);
        } else if (typeof StatusStore.setState === 'function') {
            StatusStore.setState({ message: msg, isError, timeout, timestamp: Date.now() });
        }
    }
    window.dispatchEvent(new CustomEvent('sutram-status-update', { detail: { msg, timeout, isError } }));
    window.dispatchEvent(new CustomEvent('insetu-status-update', { detail: { msg, timeout, isError } }));
}
export function setSyncStatus(state) {
    window.dispatchEvent(new CustomEvent('sutram-sync-status', { detail: { state } }));
}
// --- NON-BLOCKING TOAST NOTIFICATIONS ---
// Hijack native alerts to prevent thread blocking while preserving stack traces
window.alert = function(msg, intent = null) {
    let resolvedIntent = intent;
    if (!resolvedIntent) {
        const str = String(msg || '');
        if (/^(?:✅|\s*(?:success|pull successful|checkout successful|remote connected|sweep successful|triage complete|initialized|practice entry|structural configuration))/i.test(str) || str.toLowerCase().includes('successfully')) {
            resolvedIntent = 'success';
        } else if (/^⚠️/i.test(str)) {
            resolvedIntent = 'warning';
        } else {
            resolvedIntent = 'danger';
        }
    }
    if (resolvedIntent === 'danger') {
        console.error("[inSetu Alert]:", msg);
    } else if (resolvedIntent === 'warning') {
        console.warn("[inSetu Alert]:", msg);
    }
    const toastStore = window.inSetu?.stores?.Toast || window.Sutram?.stores?.Toast;
    if (toastStore && typeof toastStore.getState === 'function') {
        toastStore.getState().addToast(String(msg || '').replace(/^(?:✅|❌|⚠️)\s*/, ''), resolvedIntent);
    } else {
        console.warn("Alert:", msg); // Graceful fallback
    }
};
export async function executeWorkspaceMutation(path, payload, options = {}) {
    const { silent = false, onSuccess } = options;

    try {
        // Strip legacy prefixes if extensions haven't been updated yet
        let cleanPath = path;
        if (cleanPath.startsWith('/api/')) {
            const parts = cleanPath.split('/');
            cleanPath = parts.slice(3).join('/'); // strips /api/<ws>/
        }
        const isFormData = payload instanceof FormData;
        const reqOptions = isFormData ? { ...options, headers: { ...(options.headers || {}) } } : { ...options };
        const res = await window.inSetu.api.workspace.post(cleanPath, payload, reqOptions);

        if (!res.ok) {
            let errMsg = res.statusText;
            try {
                const errData = await res.clone().json();
                errMsg = errData.error || errMsg;
            } catch (parseError) {
                const rawText = await res.text();
                errMsg = `Raw Server Error (${res.status}):\n\n${rawText.substring(0, 500)}`;
            }
            throw new Error(errMsg);
        }
        const data = await res.json();
        if (onSuccess) await onSuccess(data);
        if (data && Array.isArray(data.mutations) && data.mutations.length > 0 && !options.skipCentralMutationBroadcast) {
            const normFn = window.inSetu?.vfs?.normalizeVfsURI || ((p) => p);
            const appState = AppStore.getState();
            data.mutations.forEach(m => {
                const rawFp = String(m.filepath || '').replace(/\/+$/, '');
                const normFp = normFn(rawFp);
                if (m.operation === 'delete' && m.relocated_to) {
                    const normDest = normFn(String(m.relocated_to).replace(/\/+$/, ''));
                    appState.setResolvingLock(normFp, 'move_source');
                    appState.setResolvingLock(normDest, 'move_dest');
                    if (window.inSetu?.vfs?.renameFileTracking) {
                        window.inSetu.vfs.renameFileTracking(normFp, normDest);
                    }
                } else if (m.operation === 'delete') {
                    appState.setResolvingLock(normFp, 'delete');
                } else if (m.operation === 'save' && !m.relocated_from) {
                    appState.setResolvingLock(normFp, 'create');
                }
            });
            window.inSetu?.events?.emitHook('insetu:vfs-mutated', { mutations: data.mutations });
        }
        if (!silent) {
            const toastStore = window.inSetu?.stores?.Toast || window.Sutram?.stores?.Toast;
            if (toastStore && typeof toastStore.getState === 'function') {
                const isQueuedOffline = data && data.job_id === 'offline_queue';
                const UriCls = window.inSetu?.utils?.InSetuURI;
                const targetName = (payload?.filepath && UriCls) ? new UriCls(payload.filepath).basename : '';
                let toastMsg = options.successMessage || '';

                if (!toastMsg) {
                    if (isQueuedOffline) {
                        toastMsg = `Queued offline: ${targetName || cleanPath}`;
                    } else if (cleanPath === 'fs/save') {
                        toastMsg = `Saved ${targetName || 'file'}`;
                    } else if (cleanPath === 'fs/move') {
                        const destName = (payload?.dest_path && UriCls) ? new UriCls(payload.dest_path).basename : '';
                        toastMsg = `Moved ${targetName || 'item'}${destName ? ` to ${destName}` : ''}`;
                    } else if (cleanPath === 'fs/archive') {
                        toastMsg = `Archived ${targetName || 'item'}`;
                    } else if (cleanPath === 'fs/delete') {
                        toastMsg = `Deleted ${targetName || 'item'}`;
                    } else if (cleanPath === 'fs/upload') {
                        toastMsg = data?.message || 'Upload complete';
                    } else if (cleanPath === 'fs/bulk') {
                        toastMsg = data?.message || 'Bulk file operation complete';
                    } else if (data?.message) {
                        toastMsg = data.message;
                    }
                }

                if (toastMsg) {
                    toastStore.getState().addToast(toastMsg, isQueuedOffline ? 'warning' : 'success', 3000);
                }
            }
        }
        return data;
    } catch (e) {
        if (!silent) {
            alert(`Operation failed.\nReason: ${e.message}`);
            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(`Error: ${e.message}`, 5000, true);
            }
        }
        throw e;
    }
}
export const refreshManifest = window.inSetu.utils.coalescedAsync(async () => {
    try {
        const res = await window.inSetu.api.workspace.get('system/manifest?t=' + Date.now());
        if (res.ok) {
            const rawManifest = await res.json();
            const nextVfs = rawManifest?.vfs || {};
            const nextCtx = rawManifest?.ctx || {};
            const { localCtxSignatures } = AppStore.getState().getSyncWatermarks();
            Object.entries(nextCtx).forEach(([p, entry]) => {
                if (entry && entry.meta && entry.meta.timestamp) {
                    localCtxSignatures[p] = entry.meta.timestamp;
                }
            });

            const safeManifest = { vfs: nextVfs, ctx: nextCtx };
            AppStore.setState({ manifest: safeManifest });
            return safeManifest;
        }
    } catch (e) {
        console.error("Failed to refresh manifest:", e);
    }
    return null;
});
async function purgeServiceWorkerCaches() {
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        } catch(e) {}
    }
}

async function simulatePanic() {
    if (!confirm("This will intentionally crash the server to test the Immutable Recovery Bootloader. The page will reload automatically. Continue?")) return;
    sessionStorage.clear();
    localStorage.removeItem('insetu_boot_token');
    const btn = document.getElementById('simulate-panic-btn');
    if (btn) btn.innerText = "⏳ Crashing...";
    // Declarative UI State Transition
    AppStore.setState({ isRebooting: true, rebootType: 'panic' });

    await purgeServiceWorkerCaches();
    if ('serviceWorker' in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let reg of regs) await reg.unregister();
        } catch(e) {}
    }
    try {
        // Raw fetch bypasses tenant injection, hitting the global app.py route natively
        await fetch('/api/system/panic', { method: 'POST', headers: window.inSetu.api._getHeaders() });
        setInterval(async () => {
            try {
                // Ping the un-cached recovery route
                const res = await fetch('/recovery?t=' + Date.now(), { cache: 'no-store' });
                if (res.ok) window.location.href = '/recovery';
            } catch(err) {}
        }, 1000);
    } catch (e) {
        alert("Error triggering panic.");
    }
}
async function performSoftRefresh(targetWs = null, targetHash = null) {
    const activeWs = window.inSetu.utils.getActiveWorkspace();
    if (targetWs && targetWs !== activeWs) {
        return await SessionOrchestrator.transitionToWorkspace(targetWs, null, targetHash);
    }
    return await SessionOrchestrator.refreshCurrentWorkspace(targetHash);
}
async function fullRefresh() {
    if (window.inSetu?.sse?.disconnect) {
        window.inSetu.sse.disconnect();
    }
    if (window.inSetu?.ui?.setGlobalStatus) {
        window.inSetu.ui.setGlobalStatus("Rebooting Frontend & Purging Caches...", 2000);
    }
    try {
        // 1. Purge stale legacy UI state keys without wiping active tenant layout or pinned repo filters
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
            if (k.startsWith('insetu_task_') || k.startsWith('insetu_lib_')) {
                localStorage.removeItem(k);
            }
        });
        // 2. Unregister Service Workers and clear CacheStorage via Sutram offline kernel
        await purgeSutramCaches();

        // 4. Hard reload browser
        window.location.reload(true);
    } catch (error) {
        console.error("Error during full UI refresh:", error);
        window.location.reload();
    }
}
async function initializeWorkspaceTopology() {
    // 1. Fetch Repository Configurations
    try {
        console.log("[TELEMETRY] Requesting topology...");
        const rRes = await window.inSetu.api.workspace.get('system/topology');
        if (rRes.ok) {
            const d = await rRes.json();
            console.log("[TELEMETRY] Topology loaded successfully.");
            window.inSetu.utils.setScopedStorage('offline_topology', JSON.stringify(d));
            const tabOrder = d.tab_order || [];
            AppStore.setState({ 
                allRepos: d.repos,
                targetConfigs: d.target_repos || [],
                virtualContexts: d.virtual_contexts || [],
                categoryOrder: d.category_order || [],
                hiddenOutputs: d.hidden_outputs || [],
                configMissing: !!d.config_missing,
                tabOrder: tabOrder
            });
            if (window.ExtensionRegistry?.setTabOrder && tabOrder.length > 0) {
                window.ExtensionRegistry.setTabOrder(tabOrder);
            }
        }
} catch(e) { console.error("Topology fetch failed:", e); }
    // 2. Auto-Hydrate Manifest
    try {
        let mRes = await window.inSetu.api.workspace.get('system/manifest?t=' + Date.now());
        let rawManifest = mRes.ok ? await mRes.json() : null;
        let manifestData = { vfs: rawManifest?.vfs || {}, ctx: rawManifest?.ctx || {} };
        const isEmptyManifest = Object.keys(manifestData.vfs).length === 0 && Object.keys(manifestData.ctx).length === 0;
        if (isEmptyManifest) {
            if (window.inSetu.stores.Gather) {
                await window.inSetu.stores.Gather.getState().executeCompile();
            }
            manifestData = AppStore.getState().manifest;
        }
        if (mRes.ok || manifestData) {
            const ctxMap = manifestData?.ctx || {};
            const { localCtxSignatures } = AppStore.getState().getSyncWatermarks();
            Object.entries(ctxMap).forEach(([p, entry]) => {
                if (entry && entry.meta && entry.meta.timestamp) {
                    localCtxSignatures[p] = entry.meta.timestamp;
                }
            });
            AppStore.setState({ manifest: { vfs: manifestData?.vfs || {}, ctx: ctxMap } });
        }
    } catch (e) {
        console.error("Auto-hydration failed:", e);
    }
}

/* ==========================================================================
            ES6 MODULE PREPARATION (WINDOW BRIDGE)
            Explicitly binding UI-triggered functions to the global scope so they 
            survive the transition to <script type="module">
            ========================================================================== */
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.sys.fullRefresh = fullRefresh;
window.inSetu.sys.performSoftRefresh = performSoftRefresh;
window.inSetu.sys.refreshManifest = refreshManifest;
window.inSetu.sys.simulatePanic = simulatePanic;
window.inSetu.sys.executeWorkspaceMutation = executeWorkspaceMutation;
window.inSetu.sys.loadWorkspaces = loadWorkspaces;
window.inSetu.sys.executeWorkspaceSwap = executeWorkspaceSwap;
window.inSetu.sys.SessionOrchestrator = SessionOrchestrator;
window.inSetu.ui.setGlobalStatus = setGlobalStatus;
window.inSetu.ui.setSyncStatus = setSyncStatus;

