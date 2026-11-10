/**
* Decentralized VFS/CTX manifest delta synchronization and background IndexedDB cache warming queue.
*/
import { SutramDB, SutramCacheWarmer } from 'sutram';
import { AppStore } from '/static/extensions/system/store.js';

export async function importModuleWithRetry(url, importer = (u) => import(u), retryDelaysMs = [250, 750]) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
            return await importer(attempt === 0 ? url : `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}_${Date.now()}`);
        } catch (err) {
            lastErr = err;
            if (err instanceof SyntaxError || err instanceof ReferenceError) throw err;
            if (attempt < retryDelaysMs.length) await new Promise(r => setTimeout(r, retryDelaysMs[attempt]));
        }
    }
    throw lastErr;
}

export async function classifyBootModuleFailure(url, err, fetchImpl = fetch) {
    if (err instanceof SyntaxError || err instanceof ReferenceError) return 'code_or_404';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
    try {
        const r = await fetchImpl(url, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(2000) });
        return (r.status >= 500 || r.redirected) ? 'network' : 'code_or_404';
    } catch (_) { return 'network'; }
}

// --- DECENTRALIZED MANIFEST SYNC & KERNEL HEARTBEAT ---
export async function checkManifestVersion() {
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
        const deltaRes = await window.inSetu.api.get(`system/deltas?since=${wm.lastManifestSyncTs}`, { 
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
                    const treeRes = await window.inSetu.api.get(`topology/vfs?repo=${encodeURIComponent(repo)}`);
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
                    SutramCacheWarmer.removeByPrefix?.(activeWs, fetchUrl);
                } else if (localCtxSignatures[path] !== ts) {
                    const entryRes = await window.inSetu.api.get(`gather/manifest/entry?path=${encodeURIComponent(path)}`);
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
                const backendUptimeSeconds = deltaData.timestamp - (deltaData.backend_boot_ts || deltaData.timestamp);
                const isSystemSettled = !deltaData.is_pipeline_active && backendUptimeSeconds > 150;
                if (!AppStore.getState().isOffline && navigator.connection?.saveData !== true && isSystemSettled) {
                    const Warmer = SutramCacheWarmer || window.Sutram?.SutramCacheWarmer;
                    if (typeof Warmer?.enqueue === 'function') {
                        Warmer.enqueue(activeWs, pathsToWarm, async (url, wsId) => {
                            const res = await window.inSetu?.api?.request?.(url, { priority: 'low', onlyIfMissing: true }, wsId);
                            if (res && res.status === 204) {
                                Warmer.clear();
                            }
                        });
                    }
                }
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

export const refreshManifest = window.inSetu.utils.coalescedAsync(async () => {
    try {
        const res = await window.inSetu.api.get('system/manifest?t=' + Date.now());
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
