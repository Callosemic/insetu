/**
* Base Web Component class providing tenant workspace hydration, scoped API client access, and ecosystem filtering.
*/
import { SutramElement } from 'sutram';
import { InSetuURI } from '/static/extensions/system/uri.js';


/** Base Web Component class for inSetu core views and extensions with tenant-scoped API, store, and ecosystem bindings. */
export class InSetuElement extends SutramElement {
    static properties = {
        workspaceId: { type: String },
        ecosystem: { type: Object }
    };
    constructor() {
        super();
        this.workspaceId = window.inSetu?.utils?.getActiveWorkspace() || 'default';
        /** @type {import('./types.js').WorkspaceConfig} */
        this.ecosystem = { activeWorkspace: this.workspaceId, allRepos: [], pinnedRepos: new Set(['ALL']), targetConfigs: [] };
    }

    filterItems(items, options = {}) {
        if (!Array.isArray(items) || items.length === 0) return [];
        const {
            repoField = 'repo',
            pinnedRepos = (this.ecosystem?.pinnedRepos || new Set(['ALL'])),
            searchQuery = (this.searchQuery || ''),
            alwaysInclude = null,
            searchFields = (item) => {
                const title = item.titleText || item.title || item.name || '';
                const path = item.filepath || item.filename || item.path || '';
                const repo = item[repoField] || '';
                return `${title} ${repo} ${path}`;
            }
        } = options;

        const currentPins = pinnedRepos instanceof Set 
            ? pinnedRepos 
            : new Set(Array.isArray(pinnedRepos) ? pinnedRepos : [pinnedRepos]);

        const repoFiltered = items.filter(item => {
            if (!item) return false;
            if (typeof alwaysInclude === 'function' && alwaysInclude(item)) return true;
            if (currentPins.has('ALL')) return true;
            const itemRepo = item[repoField] || (
                item.filepath ? (new InSetuURI(item.filepath).repo || '') : ''
            );

            return currentPins.has(itemRepo);
        });

        const cleanQuery = searchQuery.trim();
        if (!cleanQuery) return repoFiltered;

        return this.utils.fuzzyFilterObjects(repoFiltered, cleanQuery, searchFields);
    }

    get extName() {
        const myTag = this.tagName.toLowerCase();
        if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
            for (const [extName, config] of window.ExtensionRegistry._manifests.entries()) {
                if (config.layoutSlots && config.layoutSlots.some(s => s.component === myTag)) {
                    return extName;
                }
            }
        }

        let currentNode = this;
        while (currentNode) {
            if (currentNode.dataset && currentNode.dataset.ext) return currentNode.dataset.ext;
            if (currentNode.closest) {
                const ancestor = currentNode.closest('[data-ext]');
                if (ancestor) return ancestor.dataset.ext;
            }
            const root = currentNode.getRootNode();
            currentNode = (root instanceof ShadowRoot) ? root.host : null;
        }

        if (this.constructor.extensionName) return this.constructor.extensionName;
        return myTag.replace('insetu-ext-', '');
    }
    get vfs() { return window.inSetu.vfs; }
    get ui() { return window.inSetu.ui; }
    get sys() { return window.inSetu.sys; }
    get editor() { return window.inSetu.editor; }
    get manifest() {
        return window.inSetu?.stores?.App?.getState()?.manifest || { vfs: {}, ctx: {} };
    }
    isExtensionActive(name = this.extName) {
        if (window.inSetu?.isCore && window.inSetu.isCore(name)) return true;
        return !!(window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes(name));
    }
    getOfflineMode(name = this.extName) {
        const manifest = window.ExtensionRegistry?.getExtension(name);
        return manifest?.offline_mode || 'full';
    }

    getMissingDependencies(name = this.extName) {
        const meta = window.inSetu?.stores?.App?.getState()?.extensionDependencyMeta?.[name];
        return {
            packages: meta?.missingExternals || [],
            binaries: meta?.missingBinaries || []
        };
    }

    installExtensionDependencies(name = this.extName, onInstalled = null) {
        return this.api.bindJobAction(
            'system/extensions/install_deps',
            { ext_name: name },
            {
                onProgress: (msg) => this.setStatus(`⏳ ${msg}`, null),
                onComplete: async (statusData) => {
                    try {
                        const cRes = await window.inSetu.api.get('system/config?t=' + Date.now(), { cache: 'no-store' });
                        if (cRes.ok) {
                            const data = await cRes.json();
                            window.inSetu.utils.syncExtensionDependencyMeta(data);
                        }
                    } catch (_) {}
                    const artifact = statusData?.artifact || {};
                    if (artifact.requires_reboot) {
                        this.setStatus(`✅ Packages installed for '${name}'. Rebooting daemon...`, 3000);
                        await window.inSetu.api.post('system/reboot', {});
                        if (window.inSetu?.sys?.waitForDaemonReboot) {
                            window.inSetu.sys.waitForDaemonReboot();
                        } else {
                            setTimeout(() => window.location.reload(), 2500);
                        }
                        return;
                    }
                    this.setStatus(`✅ ${statusData?.message || 'Dependencies installed!'}`, 3000);
                    if (typeof onInstalled === 'function') await onInstalled(statusData);
                    this.requestUpdate();
                },
                onError: (err) => {
                    alert(`Dependency installation failed:\n\n${err.message}`);
                }
            }
        );
    }

    setStatus(msg, timeout = 3000, isError = false) {
        if (window.inSetu?.ui?.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus(msg, timeout, isError);
        }
    }
    compileSystem(onProgress = null, forceFull = false, startStep = null, targetRepos = null) {
        if (window.inSetu?.stores?.Gather) {
            return window.inSetu.stores.Gather.getState().executeCompile(onProgress, forceFull, startStep, targetRepos);
        }
        return Promise.resolve();
    }
    get utils() {
        return {
            fuzzyFilterObjects: window.inSetu.utils.fuzzyFilterObjects,
            normalizeAccentText: window.inSetu.utils.normalizeAccentText,
            truncateFilename: window.inSetu.utils.truncateFilename,
            pollJob: window.inSetu.utils.pollJob,
            slugify: window.inSetu.utils.slugify,
            copyToClipboard: window.inSetu.utils.copyToClipboard,
            copyRichHtml: window.inSetu.utils.copyRichHtml,
            copyRawText: window.inSetu.utils.copyRawText,
            formatDate: window.inSetu.utils.formatDate,
            timeAgo: window.inSetu.utils.timeAgo,
            clone: window.inSetu.utils.clone,
            debounce: window.ExtensionRegistry.utils.debounce,
            coalescedAsync: window.inSetu.utils.coalescedAsync,
            nativeShareFiles: window.inSetu.utils.nativeShareFiles,
            HostPath: window.inSetu.utils.HostPath,
            InSetuURI: window.inSetu.utils.InSetuURI,
            parseURI: window.inSetu.utils.parseURI,
            formatArtifactSize: window.inSetu.utils.formatArtifactSize,
            extractManifestFiles: window.inSetu.utils.extractManifestFiles,
            parseFrontmatter: window.inSetu.utils.parseFrontmatter,
            serializeFrontmatter: window.inSetu.utils.serializeFrontmatter,
            cleanCodeArtifacts: window.inSetu.utils.cleanCodeArtifacts,
            shallowEqual: window.inSetu.utils.shallowEqual,
            threeWayMergeText: window.inSetu.utils.threeWayMergeText,
            compileDagWavefronts: window.inSetu.utils.compileDagWavefronts,
            extractTemplateVariables: window.inSetu.utils.extractTemplateVariables,
            interpolateTemplateVariables: window.inSetu.utils.interpolateTemplateVariables,
            getActiveWorkspace: window.inSetu.utils.getActiveWorkspace
        };
    }
    get api() {
        const resolveScopedPath = (path) => {
            const cleanPath = String(path || '').replace(/^\/+/, '');
            const pathWithoutQuery = cleanPath.split('?')[0];
            const segments = pathWithoutQuery.split('/').filter(Boolean);
            if (segments.length >= 2) {
                const firstSeg = segments[0];
                const isKnownModule = (
                    firstSeg === this.extName ||
                    (window.inSetu?.isCore && window.inSetu.isCore(firstSeg)) ||
                    (Array.isArray(window.ACTIVE_EXTENSIONS) && window.ACTIVE_EXTENSIONS.includes(firstSeg)) ||
                    (window.ExtensionRegistry?.hasExtension && window.ExtensionRegistry.hasExtension(firstSeg))
                );
                if (isKnownModule) {
                    return cleanPath;
                }
            }
            return `${this.extName}/${cleanPath}`;
        };
        return {
            request: (url, options = {}) => window.inSetu.api.request(url, options, this.workspaceId),
            pollJob: (jobId, options = {}) => window.inSetu.utils.pollJob(jobId, options),
            bindJobAction: (path, payloadGenerator, pollOptions = {}) => {
                return window.inSetu.api.bindJobAction(resolveScopedPath(path), payloadGenerator, pollOptions);
            },
            _resolveScopedPath: resolveScopedPath,
            get: (path, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                return window.inSetu.api.get(resolveScopedPath(path), options);
            },
            post: (path, payload, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                return window.inSetu.api.post(resolveScopedPath(path), payload, options);
            },
            delete: (path, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                return window.inSetu.api.delete(resolveScopedPath(path), options);
            },
            fetchImmutableText: async (path, options = {}) => {
                return window.inSetu.api.fetchImmutableText(path, options, this.workspaceId);
            },
            getJson: async (path, options = {}) => {
                const res = await this.api.get(path, options);
                if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
                return res.json();
            },
            postJson: async (path, payload, options = {}) => {
                const res = await this.api.post(path, payload, options);
                if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
                return res.json();
            },
            deleteJson: async (path, options = {}) => {
                const res = await this.api.delete(path, options);
                if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
                return res.json();
            }
        };
    }
    dispatch(eventName, detail = null) {
        if (window.inSetu?.events?.emit) {
            window.inSetu.events.emit(eventName, detail);
        } else {
            super.dispatch(eventName, detail);
        }
    }

    emitHook(zoneName, payload = null) {
        if (window.inSetu?.events?.emitHook) {
            return window.inSetu.events.emitHook(zoneName, payload);
        }
        return null;
    }
    _runWorkspaceHydration(ws) {
        if (typeof this.clearManagedTimeouts === 'function') {
            this.clearManagedTimeouts();
        }
        this._autoFetchTriggeredInCycle = false;
        if (typeof this.onWorkspaceLoad === 'function') {
            this.onWorkspaceLoad(ws);
        }
        if (!this._autoFetchTriggeredInCycle && Array.isArray(this._autoFetchFns)) {
            this._autoFetchFns.forEach(fn => fn(ws));
        }
    }

    _runForceRefresh() {
        this._autoFetchTriggeredInCycle = false;
        if (typeof this.onForceRefresh === 'function') {
            this.onForceRefresh();
        }
        if (!this._autoFetchTriggeredInCycle && Array.isArray(this._autoFetchFns)) {
            this._autoFetchFns.forEach(fn => fn(this.workspaceId));
        }
    }

    connectedCallback() {
        super.connectedCallback();
        // Wire up the unified onForceRefresh lifecycle method
        this.registerGlobalListener('insetu:force-refresh', window, (e) => {
            const { parentId, subId } = e.detail || {};
            const mySubId = this.dataset.subId || this.extName;

            let myParentId = this.dataset.parentId;
            if (!myParentId && window.ExtensionRegistry) {
                const slots = window.ExtensionRegistry.getLayoutSlots();
                const mySlot = slots.find(s => s.component === this.tagName.toLowerCase());
                if (mySlot) myParentId = mySlot.targetParent;
            }

            const matchesSub = subId && subId === mySubId;
            const matchesParent = parentId && (parentId === this.extName || parentId === myParentId);

            if (matchesSub || (!subId && matchesParent) || (parentId && !subId && matchesParent)) {
                this._runForceRefresh();
            }
        });
        // Wire up workspace soft-refresh lifecycle method
        this.registerGlobalListener('insetu:soft-refresh', window, (e) => {
            const ws = e.detail || window.inSetu?.utils?.getActiveWorkspace() || 'default';
            this.workspaceId = ws;
            this._runWorkspaceHydration(ws);
            this.requestUpdate();
        });
        const appStore = window.inSetu?.stores?.App;
        if (appStore) {
            const isLocked = () => Boolean(
                window.Sutram?.storeRegistry?.isTransitioning?.() ||
                appStore.getState().isSwappingWorkspace
            );
            this.subscribe(appStore, state => state.activeWorkspace, (ws) => {
                if (this.workspaceId !== ws) {
                    this.workspaceId = ws;
                    if (!isLocked()) {
                        this._runWorkspaceHydration(ws);
                    }
                }
            });
            // Guarantee components natively hydrate their workspace context on initial mount 
            // even if they were instantiated after the global swap event fired.
            const currentWs = appStore.getState().activeWorkspace;
            if (!this._hasHydratedWorkspaceSwap) {
                this._hasHydratedWorkspaceSwap = true;
                this.workspaceId = currentWs;
                const mountEpoch = this._scopeEpoch;
                this.registerTimeout(() => {
                    if (this._scopeEpoch === mountEpoch && !isLocked()) {
                        this._runWorkspaceHydration(currentWs);
                    }
                }, 0);
            }
        }
        // Auto-hydrate the ecosystem topology for all extensions natively using structural slice equality
        if (appStore) {
            const as = appStore.getState ? appStore.getState() : {};
            this.ecosystem = {
                allRepos: as.allRepos || [],
                pinnedRepos: as.pinnedRepos || new Set(['ALL']),
                targetConfigs: as.targetConfigs || []
            };
            this.subscribe(
                appStore,
                state => ({
                    allRepos: state.allRepos || [],
                    pinnedRepos: state.pinnedRepos || new Set(['ALL']),
                    targetConfigs: state.targetConfigs || []
                }),
                (eco) => {
                    this.ecosystem = eco;
                    this.requestUpdate();
                }
            );
        }
    }
    onWorkspaceLoad(workspaceId) {
        this._autoFetchTriggeredInCycle = true;
        if (Array.isArray(this._autoFetchFns)) {
            this._autoFetchFns.forEach(fn => fn(workspaceId));
        }
    }
    onForceRefresh() {
        this._autoFetchTriggeredInCycle = true;
        if (Array.isArray(this._autoFetchFns)) {
            this._autoFetchFns.forEach(fn => fn(this.workspaceId));
        }
    }
}
