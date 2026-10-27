// insetu/insetu/static/js/core/sdk.js
// Tier 1A: inSetu Local OS SDK Wrapper
import { SutramElement, createSutramStore, StoreRegistry, ExtensionRegistry as SutramRegistry, bindStoreInput } from '/static/vendor/sutram/js/sutram_sdk.js';
import { fuzzyFilterObjects, normalizeAccentText, slugify, debounce, coalescedAsync, formatDate, timeAgo, nativeShareFiles, cleanCodeArtifacts, shallowEqual, copyRichHtml, threeWayMergeText, HostPath, truncateFilename, clone } from '/static/vendor/sutram/js/utils.js';
import { getEventPath, getEventTarget } from '/static/vendor/yenvui/js/physics.js';
import * as jsYaml from '/static/vendor/js-yaml/js-yaml.min.js';

export { bindStoreInput, truncateFilename };

export function createExtensionStore(name, initialState, persistenceSchema = {}) {
    const getWs = () => window.inSetu.utils.getActiveWorkspace();
    const store = createSutramStore(name, initialState, persistenceSchema, getWs, 'insetu');
    window.inSetu = window.inSetu || {};
    window.inSetu.stores = window.inSetu.stores || {};
    window.inSetu.stores[name] = store;
    return store;
}
export function createIsolatedSlice(store, sliceKey) {
    return {
        get: () => store.getState()[sliceKey],
        set: (val) => store.setState({ [sliceKey]: typeof val === 'object' && val !== null ? { ...val } : val })
    };
}

export class BucketAddress {
    constructor(repo, bucketId = 'main') {
        this.repo = (repo || 'global').toLowerCase().trim();
        this.bucketId = (bucketId || 'main').trim();
    }

    get key() {
        return `${this.repo}::${this.bucketId}`;
    }
    get contextUri() {
        const safeRepo = this.repo.startsWith('.') ? `dot_${this.repo.substring(1)}`.replace(/-/g, '_').toLowerCase() : this.repo.replace(/-/g, '_').toLowerCase();
        if (this.bucketId === 'main') return `ctx://contexts/${safeRepo}_context.txt`;
        return `ctx://contexts/${safeRepo}_${this.bucketId}_context.txt`;
    }

    get diffUri() {
        const safeRepo = this.repo.startsWith('.') ? `dot_${this.repo.substring(1)}`.replace(/-/g, '_').toLowerCase() : this.repo.replace(/-/g, '_').toLowerCase();
        if (this.bucketId === 'main') return `ctx://diffs/${safeRepo}_diffs.txt`;
        return `ctx://diffs/${safeRepo}_${this.bucketId}_diffs.txt`;
    }

    static fromKey(key) {
        if (!key) return new BucketAddress('global', 'main');
        if (key.includes('::')) {
            const [repo, bucketId] = key.split('::');
            return new BucketAddress(repo, bucketId);
        }
        return new BucketAddress(key, 'main');
    }
    static fromFilepath(filepath, manifestMeta = null) {
        if (manifestMeta) {
            const primaryRepo = manifestMeta.repo || (Array.isArray(manifestMeta.repos) && manifestMeta.repos.length === 1 ? manifestMeta.repos[0] : (Array.isArray(manifestMeta.repos) ? 'global' : null));
            const bucketId = manifestMeta.bucket_id || manifestMeta.type || null;
            if (primaryRepo && bucketId) {
                return new BucketAddress(primaryRepo, bucketId);
            }
        }
        const filename = new InSetuURI(filepath).basename;
        return new BucketAddress('orphan', filename);
    }
    static fromVfsPath(filepath) {
        const manifestVfs = window.inSetu?.stores?.App?.getState()?.manifest?.vfs || {};
        const normUri = filepath && filepath.includes('://') ? filepath : `vfs://${String(filepath || '').replace(/^\/+/, '')}`;

        for (const [key, bucket] of Object.entries(manifestVfs)) {
            if (bucket.files && (bucket.files.includes(normUri) || bucket.files.includes(filepath))) {
                return BucketAddress.fromKey(key);
            }
        }
        const parsed = new InSetuURI(normUri);
        return new BucketAddress(parsed.repo || 'global', 'main');
    }
}
export class InSetuURI {
    constructor(raw = '', defaultScheme = 'vfs') {
        if (raw instanceof InSetuURI) {
            Object.assign(this, raw);
            return;
        }
        const rawStr = typeof raw === 'object' && raw !== null
            ? String(raw.folderpath || raw.filepath || raw.id || '')
            : String(raw || '');
        const normRaw = rawStr.replace(/\\/g, '/').trim();
        const hadTrailingSlash = normRaw.endsWith('/') && !normRaw.endsWith('://');
        const clean = normRaw.replace(/\/+$/, '');
        let withScheme = clean
            ? (clean.includes('://') ? clean : `${defaultScheme}://${clean.replace(/^\/+/, '')}`)
            : '';
        if (withScheme.startsWith('ctx://contexts/workflow_') && (withScheme.endsWith('_context.txt') || /_context_part\d+\.txt$/.test(withScheme))) {
            withScheme = withScheme.replace(/^ctx:\/\/contexts\//, 'ctx://workflows/');
        }

        let str = withScheme;
        let scheme = defaultScheme;
        const schemeMatch = str.match(/^([a-zA-Z0-9_-]+):\/\/(.*)$/);
        if (schemeMatch) {
            scheme = schemeMatch[1];
            str = schemeMatch[2];
        }
        str = str.replace(/^\/+/, '');
        const parts = str.split('/').filter(Boolean);
        const volume = parts.length > 0 ? parts[0] : '';
        const repo = parts.length > 1 ? parts[0] : (scheme === 'vfs' ? volume : '');
        const relativePath = parts.length > 1 ? parts.slice(1).join('/') : (scheme === 'vfs' ? '' : str);
        const filename = parts[parts.length - 1] || '';

        this.scheme = scheme;
        this.volume = volume;
        this.repo = repo;
        this.relativePath = relativePath;
        this.filename = filename;
        this.raw = rawStr;
        this.canonical = withScheme;
        this.isDir = hadTrailingSlash;

        this.isCompiledArtifact = scheme === 'ctx' && ['contexts', 'diffs', 'workflows'].includes(volume);
        this.isUserTemplate = withScheme.includes('/.templates/user/');
        this.isReadOnlyTemplate = !this.isUserTemplate && withScheme.includes('/.templates/');
        this.isTemplate = this.isUserTemplate || this.isReadOnlyTemplate;
        this.isSharedMount = scheme === 'ws';
        this.isReadOnly = this.isSharedMount || this.isCompiledArtifact || this.isReadOnlyTemplate;
        this.isEditable = !this.isReadOnly && (scheme === 'vfs' || scheme === 'ctx' || scheme === 'virtual' || scheme === 'yomama');
        this.isSource = !this.isCompiledArtifact;
    }

    get basename() {
        return this.filename || this.volume || '';
    }

    get pathSegments() {
        const rel = this.repo
            ? (this.relativePath ? `${this.repo}/${this.relativePath}` : this.repo)
            : (this.volume ? (this.relativePath ? `${this.volume}/${this.relativePath}` : this.volume) : this.relativePath);
        return String(rel || '').split('/').filter(Boolean);
    }

    get isRootVolume() {
        return Boolean(this.volume && !this.relativePath);
    }

    get parentUri() {
        if (!this.scheme) return '';
        const segs = this.pathSegments;
        if (segs.length <= 1) {
            return `${this.scheme}://`;
        }
        segs.pop();
        return `${this.scheme}://${segs.join('/')}`;
    }

    withName(newName) {
        const cleanName = String(newName || '').trim().replace(/^\/+|\/+$/g, '');
        if (!cleanName) return this.toString();
        const parent = this.parentUri;
        if (!parent || parent.endsWith('://')) {
            return `${this.scheme || 'vfs'}://${cleanName}`;
        }
        return `${parent}/${cleanName}`;
    }

    join(...segments) {
        const cleanSegs = segments
            .map(s => String(s || '').trim().replace(/^\/+|\/+$/g, ''))
            .filter(Boolean);
        const base = this.toString().replace(/\/+$/, '');
        if (cleanSegs.length === 0) return base;
        if (!base || base.endsWith('://')) {
            return `${this.scheme || 'vfs'}://${cleanSegs.join('/')}`;
        }
        return `${base}/${cleanSegs.join('/')}`;
    }
    static canonicalize(raw, defaultScheme = 'vfs') {
        if (!raw) return '';
        const rawStr = typeof raw === 'object' && raw !== null
            ? String(raw.folderpath || raw.filepath || raw.id || '')
            : String(raw || '');
        let s = rawStr.replace(/\\/g, '/').trim();
        if (!s) return '';
        const hasTrailingSlash = (s.endsWith('/') && !s.endsWith('://')) || Boolean(typeof raw === 'object' && raw?.isDir);
        s = s.replace(/^(vfs|ctx|ws|virtual|yomama):\/(?!\/)/, '$1://');
        if (s.startsWith('vfs://') || s.startsWith('ctx://') || s.startsWith('ws://') || s.startsWith('virtual://') || s.startsWith('yomama://')) {
            const parsed = new InSetuURI(s);
            return hasTrailingSlash ? `${parsed.toString()}/` : parsed.toString();
        }
        while (s.includes('://')) {
            s = s.split('://').pop();
        }
        const clean = s.replace(/^\/+|\/+$/g, '');
        if (!clean) return `${defaultScheme}://`;
        if (clean.includes('diffs/') || clean.endsWith('_diffs.txt')) {
            return `ctx://diffs/${clean.replace(/^diffs\//, '')}`;
        }
        if (clean.includes('workflows/') || clean.endsWith('_workflow_context.txt') || (clean.startsWith('workflow_') && clean.endsWith('_context.txt'))) {
            return `ctx://workflows/${clean.replace(/^workflows\//, '').replace(/^contexts\//, '')}`;
        }
        if (clean.includes('prompts/')) {
            return `ctx://prompts/${clean.replace(/^prompts\//, '')}`;
        }
        if (clean.endsWith('_context.txt') || clean.startsWith('contexts/')) {
            return `ctx://contexts/${clean.replace(/^contexts\//, '')}`;
        }
        return `${defaultScheme}://${clean}${hasTrailingSlash ? '/' : ''}`;
    }

    toString() {
        if (!this.canonical) return '';
        return this.canonical;
    }
}

window.inSetu = window.inSetu || {};
window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.BucketAddress = BucketAddress;
window.inSetu.utils.InSetuURI = InSetuURI;
window.inSetu.utils.canonicalizeURI = (raw, defaultScheme = 'vfs') => InSetuURI.canonicalize(raw, defaultScheme);
window.inSetu.utils.syncExtensionDependencyMeta = function(configResponseData) {
    const depMeta = {};
    (configResponseData?.meta?.available_extensions || []).forEach(ext => {
        depMeta[ext.id] = {
            missingExternals: ext.missing_externals || [],
            missingBinaries: ext.missing_binaries || []
        };
    });
    if (window.inSetu?.stores?.App) {
        window.inSetu.stores.App.setState({ extensionDependencyMeta: depMeta });
    }
    return depMeta;
};

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
                        const cRes = await window.inSetu.api.workspace.get('system/config?t=' + Date.now(), { cache: 'no-store' });
                        if (cRes.ok) {
                            const data = await cRes.json();
                            window.inSetu.utils.syncExtensionDependencyMeta(data);
                        }
                    } catch (_) {}
                    const artifact = statusData?.artifact || {};
                    if (artifact.requires_reboot) {
                        this.setStatus(`✅ Packages installed for '${name}'. Rebooting daemon...`, 3000);
                        await window.inSetu.api.workspace.post('system/reboot', {});
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
            getActiveWorkspace: window.inSetu.utils.getActiveWorkspace
        };
    }
    get api() {
        return {
            request: (url, options = {}) => window.inSetu.api.request(url, options, this.workspaceId),
            system: {
                get: (path, options = {}) => window.inSetu.api.system.get(path, options),
                post: (path, payload, options = {}) => window.inSetu.api.system.post(path, payload, options),
                delete: (path, options = {}) => window.inSetu.api.system.delete(path, options)
            },
            workspace: {
                get: (path, options = {}) => window.inSetu.api.workspace.get(path, options),
                post: (path, payload, options = {}) => window.inSetu.api.workspace.post(path, payload, options),
                delete: (path, options = {}) => window.inSetu.api.workspace.delete(path, options)
            },
            pollJob: (jobId, options = {}) => window.inSetu.utils.pollJob(jobId, options),
            bindJobAction: (path, payloadGenerator, pollOptions = {}) => {
                return async (e) => {
                    const payload = typeof payloadGenerator === 'function' ? await payloadGenerator(e) : payloadGenerator;
                    if (pollOptions.closeWindowId && window.Sutram?.stores?.Layout) {
                        window.Sutram.stores.Layout.getState().closeWindow(pollOptions.closeWindowId);
                    }
                    const res = await this.api.post(path, payload);
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Request failed.");
                    }
                    const data = await res.json();

                    return new Promise((resolve, reject) => {
                        this.api.pollJob(data.job_id, {
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
            _resolveScopedPath: (path) => {
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
            },
            get: (path, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                return window.inSetu.api.workspace.get(this.api._resolveScopedPath(path), options);
            },
            post: (path, payload, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                return window.inSetu.api.workspace.post(this.api._resolveScopedPath(path), payload, options);
            },
            delete: (path, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                return window.inSetu.api.workspace.delete(this.api._resolveScopedPath(path), options);
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
            this.subscribe(appStore, state => state.activeWorkspace, (ws) => {
                if (this.workspaceId !== ws) {
                    this.workspaceId = ws;
                    if (!appStore.getState().isSwappingWorkspace) {
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
                    if (this._scopeEpoch === mountEpoch && !appStore.getState().isSwappingWorkspace) {
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
window.inSetu = window.inSetu || {};
// Pre-seed foundational OS chassis modules to protect against offline cache misses or backend latency
const _baseCore = ['bridge', 'gather', 'cartographer', 'config', 'editor', 'fs', 'system', 'workers', 'auth', 'security', 'topology', 'offline', 'llm', 'agent', 'prompts', 'mcp'];
window.inSetu.CORE_MODULES = window.inSetu.CORE_MODULES && window.inSetu.CORE_MODULES.size > 0 
    ? window.inSetu.CORE_MODULES 
    : new Set(window.CORE_MODULES || _baseCore);
window.inSetu.isCore = (extName) => window.inSetu.CORE_MODULES.has(extName);

// Safely export the dynamic namespace
export const CORE_MODULES = window.inSetu.CORE_MODULES;

// Explicit list of Core OS modules that require frontend UI payloads to be mounted on boot
export const CORE_UI_SCRIPTS = [
    '/static/extensions/fs/fs.js',
    '/static/extensions/bridge/bridge.js',
    '/static/extensions/gather/gather.js',
    '/static/extensions/config/config.js',
    '/static/extensions/offline/offline_ui.js',
    '/static/extensions/agent/agent.js',
    '/static/extensions/prompts/prompts.js'
];
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.extensions = window.inSetu.extensions || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.editor = window.inSetu.editor || {};
window.inSetu.utils = window.inSetu.utils || {};
const TENANT_SCOPED_HOOKS = new Set([
    'insetu:vfs-mutated',
    'insetu:compile-step-complete',
    'insetu:compile-progress'
]);

// Abstracted Event Bus & Fail-Safe Hook Emitter
window.inSetu.events = window.inSetu.events || {
    shouldDropTenantEvent: function(targetWorkspaceId = null) {
        const appState = window.inSetu?.stores?.App?.getState?.();
        if (appState?.isSwappingWorkspace) return true;
        if (targetWorkspaceId) {
            const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
            if (targetWorkspaceId !== activeWs) return true;
        }
        return false;
    },
    emit: function(eventName, detail = null) {
        if (TENANT_SCOPED_HOOKS.has(eventName) && this.shouldDropTenantEvent(detail?.workspace_id)) {
            return;
        }
        window.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
    },
    emitHook: function(zoneName, payload = null) {
        if (TENANT_SCOPED_HOOKS.has(zoneName) && this.shouldDropTenantEvent(payload?.workspace_id)) {
            return null;
        }
        if (zoneName === 'insetu:force-refresh') {
            window.dispatchEvent(new CustomEvent('insetu:force-refresh', { detail: payload, bubbles: true, composed: true }));
        }
        // Standardize all legacy zone emissions to the Typed Event Bus for migration (ADR 0041)
        const event = new CustomEvent(zoneName, { detail: payload, bubbles: true, composed: true });
        event.inSetuResponses = [];
        window.dispatchEvent(event);
        if (event.inSetuResponses.length > 0) return event.inSetuResponses[0];

        return null;
    },
    emitHookAll: function(zoneName, payload = null) {
        if (TENANT_SCOPED_HOOKS.has(zoneName) && this.shouldDropTenantEvent(payload?.workspace_id)) {
            return [];
        }
        const event = new CustomEvent(zoneName, { detail: payload, bubbles: true, composed: true });
        event.inSetuResponses = [];
        window.dispatchEvent(event);
        return event.inSetuResponses || [];
    }
};
// Forward the central registry and bind the host tenant scope provider
window.inSetu.extensions.Registry = SutramRegistry;
window.ExtensionRegistry = SutramRegistry;
if (window.Sutram?.storeRegistry?.setScopeProvider) {
    window.Sutram.storeRegistry.setScopeProvider(() => window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default');
}
window.ExtensionRegistry.executeJobAction = (route, payloadGenerator, pollOptions = {}) => {
    return async (e) => {
        const payload = typeof payloadGenerator === 'function' ? await payloadGenerator(e) : (payloadGenerator || {});
        if (pollOptions.closeWindowId && window.Sutram?.stores?.Layout) {
            window.Sutram.stores.Layout.getState().closeWindow(pollOptions.closeWindowId);
        }
        const cleanRoute = String(route || '').replace(/^\/+/, '');
        const res = await window.inSetu.api.workspace.post(cleanRoute, payload);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data.job_id) {
            if (pollOptions.onComplete) pollOptions.onComplete(data);
            return data;
        }
        return new Promise((resolve, reject) => {
            window.inSetu.utils.pollJob(data.job_id, {
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
};
window.inSetu.extensions.InSetuElement = InSetuElement;
window.inSetu.extensions.createExtensionStore = createExtensionStore;
// Wire inSetu's active extension policy into Sutram's agnostic filter slot
window.ExtensionRegistry.setFilterPredicate((extName) => {
    if (window.inSetu?.isCore && window.inSetu.isCore(extName)) return true;
    if (!window.ACTIVE_EXTENSIONS) return true;
    return window.ACTIVE_EXTENSIONS.includes(extName);
});
// Apply opinionated inSetu OS extensions to the generic Sutram Registry
const _baseGetLayoutSlots = typeof window.ExtensionRegistry.getLayoutSlots === 'function' 
    ? window.ExtensionRegistry.getLayoutSlots.bind(window.ExtensionRegistry) 
    : function() {
        const slots = [];
        this._manifests.forEach((manifest, extName) => {
            if (manifest.layoutSlots && Array.isArray(manifest.layoutSlots)) {
                slots.push(...manifest.layoutSlots.map(s => {
                    const slotType = (s.slot || '').startsWith('slots:') ? s.slot : 'slots:' + s.slot;
                    return { ...s, slot: slotType, extName };
                }));
            }
        });
        return slots;
    }.bind(window.ExtensionRegistry);
window.ExtensionRegistry.getLayoutSlots = function() {
    try {
        const slots = _baseGetLayoutSlots() || [];
        const active = window.ACTIVE_EXTENSIONS;

        // Filter out slots from explicitly deactivated workspace extensions
        return slots.filter(s => {
            if (!s.extName) return true;
            if (window.inSetu.isCore(s.extName)) return true;
            if (!active) return true; // Allow if strictly undefined/uninitialized
            return active.includes(s.extName);
        });
    } catch (e) {
        console.error("Error in getLayoutSlots:", e);
        return [];
    }
};
const _baseGetEntityActions = window.ExtensionRegistry.getEntityActions.bind(window.ExtensionRegistry);
window.ExtensionRegistry.getEntityActions = function(compoundType, data) {
    const actions = _baseGetEntityActions(compoundType, data);
    const rawFp = data?.filepath || data?.folderpath || data?.id || '';
    const isSharedAsset = Boolean(rawFp && String(rawFp).startsWith('ws://'));
    const MUTATIVE_ACTION_IDS = ['file-edit', 'vfs-move', 'vfs-rename', 'vfs-archive', 'vfs-delete'];

    return actions.filter(act => {
        if (act.extName && !window.inSetu.isCore(act.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(act.extName)) {
            return false;
        }
        if (isSharedAsset && MUTATIVE_ACTION_IDS.includes(act.id)) {
            return false;
        }
        return true;
    });
};
window.ExtensionRegistry.utils = {
    debounce,
    _verifyTokens: {},
    debounceVerifyFile: function(workspaceId, filepath, callback, delay = 300) {
        const key = `verify_${filepath}`;
        this._verifyTokens[key] = (this._verifyTokens[key] || 0) + 1;
        const currentToken = this._verifyTokens[key];

        setTimeout(async () => {
            if (this._verifyTokens[key] !== currentToken) return;
            try {
                const res = await window.inSetu.api.workspace.get(`fs/exists?file=${encodeURIComponent(filepath)}`);
                if (res.ok && this._verifyTokens[key] === currentToken) {
                    const data = await res.json();
                    callback(data.exists, filepath);
                }
            } catch(e) {
                console.warn("Silent verify failed", e);
            }
        }, delay);
    }
};

// Attach util wrappers mapping to the Sutram imports
window.inSetu.utils.getEventPath = getEventPath;
window.inSetu.utils.getEventTarget = getEventTarget;
window.inSetu.utils.slugify = slugify;
window.inSetu.utils.fuzzyFilterObjects = fuzzyFilterObjects;
window.inSetu.utils.normalizeAccentText = normalizeAccentText;
window.inSetu.utils.formatDate = formatDate;
window.inSetu.utils.timeAgo = timeAgo;
window.inSetu.utils.coalescedAsync = coalescedAsync;
window.inSetu.utils.nativeShareFiles = nativeShareFiles;
window.inSetu.utils.cleanCodeArtifacts = cleanCodeArtifacts;
window.inSetu.utils.shallowEqual = shallowEqual;
window.inSetu.utils.threeWayMergeText = threeWayMergeText;
window.inSetu.utils.HostPath = HostPath;
window.inSetu.utils.truncateFilename = truncateFilename;
window.inSetu.utils.formatArtifactSize = function(meta) {
    if (!meta) return "";
    if (meta.size_bytes !== undefined) {
        const kb = Math.round(meta.size_bytes / 1024);
        let sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " mb" : kb + " kb";
        if (meta.chunk_sizes && meta.chunk_sizes.length > 1) {
            sizeStr += ` / ${meta.chunk_sizes.length}`;
        }
        return sizeStr;
    }
    return "";
};
window.inSetu.utils.clone = clone;
window.inSetu.utils.getScopedStorage = (key, defaultVal = null, workspaceId = null) => StoreRegistry.getScopedStorage(key, defaultVal, workspaceId, 'insetu');
window.inSetu.utils.setScopedStorage = (key, value, workspaceId = null) => StoreRegistry.setScopedStorage(key, value, workspaceId, 'insetu');
window.inSetu.utils.removeScopedStorage = (key, workspaceId = null) => StoreRegistry.removeScopedStorage(key, workspaceId, 'insetu');
// Preserve clipboard API bindings
window.inSetu.utils.copyRichHtml = copyRichHtml;
window.inSetu.utils.copyToClipboard = async function(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("Clipboard access denied.", 3000, true);
        throw new Error("Clipboard access denied");
    }
};

window.inSetu.utils.copyRawText = async function(text, successMsg = "✅ Copied!") {
    try {
        await window.inSetu.utils.copyToClipboard(text);
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(successMsg, 2000);
    } catch (e) {
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("❌ Error copying text", 3000, true);
        throw e;
    }
};
window.inSetu.utils.parseURI = function(pathStr) {
    return new InSetuURI(pathStr);
};

window.inSetu.utils.parseFrontmatter = function(text) {
    if (!text) return { meta: {}, content: '', rawFrontmatter: '' };

    // Improved regex: handles EOF immediately after the closing ---
    const match = text.match(/^\s*---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    if (!match) return { meta: {}, content: text, rawFrontmatter: '' };

    const rawFrontmatter = match[1];
    const content = text.slice(match[0].length);
    let meta = {};

    try {
        const parsed = jsYaml.load(rawFrontmatter);
        if (typeof parsed === 'object' && parsed !== null) {
            meta = parsed;
        }
    } catch (e) {
        console.warn("[SDK] Frontmatter YAML parse error:", e);
    }

    return { meta, content, rawFrontmatter: match[0] };
};

window.inSetu.utils.serializeFrontmatter = function(yamlObj, markdownBody) {
    if (!yamlObj || Object.keys(yamlObj).length === 0) return markdownBody;

    try {
        const yamlStr = jsYaml.dump(yamlObj, {
            indent: 2,
            noArrayIndent: true,
            lineWidth: -1 // Disable line wrapping
        });
        return `---\n${yamlStr.trim()}\n---\n\n${markdownBody}`;
    } catch (e) {
        console.error("[SDK] Frontmatter YAML serialization error:", e);
        return markdownBody;
    }
};
/**
* Normalizes polymorphic entity data objects onto the SSOT EntityData contract.
* @param {Object|string} data - Raw entity data object or path string.
* @returns {import('./types.js').EntityData} Standardized EntityData payload.
*/
window.inSetu.utils.normalizeEntityData = function(data) {
    if (!data) return { filepath: '' };
    if (typeof data === 'string') return { filepath: data };

    const rawPath = data.filepath || data.path || data.filename || '';
    return {
        ...data,
        filepath: rawPath
    };
};
window.inSetu.utils.extractManifestFiles = function(manifestData, targetKey = null, domain = 'auto') {
    if (!manifestData) return [];
    const ctxManifest = manifestData.ctx || {};
    const vfsManifest = manifestData.vfs || {};

    const extract = (data) => {
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && data !== null) {
            return data.chunks || data.files || [];
        }
        return [];
    };

    if (targetKey) {
        let entry = (domain === 'ctx') ? ctxManifest[targetKey] : (domain === 'vfs' ? vfsManifest[targetKey] : (ctxManifest[targetKey] || vfsManifest[targetKey] || manifestData[targetKey]));
        if (!entry && (targetKey.includes('/') || targetKey.includes('\\'))) {
            const name = targetKey.split('/').pop();
            entry = (domain === 'ctx') ? ctxManifest[name] : (domain === 'vfs' ? vfsManifest[name] : (ctxManifest[name] || vfsManifest[name] || manifestData[name]));
        }
        if (!entry) return [targetKey];
        return extract(entry);
    }

    // Explicit partition isolation: query vfs OR ctx depending on domain intent
    const targetPartition = (domain === 'ctx') ? ctxManifest : (domain === 'vfs' ? vfsManifest : (manifestData.vfs || manifestData.ctx ? vfsManifest : manifestData));
    const allFiles = new Set();
    Object.entries(targetPartition).forEach(([k, v]) => {
        if (typeof k === 'string' && k.endsWith('.txt')) allFiles.add(k);
        extract(v).forEach(f => {
            if (typeof f === 'string') allFiles.add(f);
        });
    });
    return Array.from(allFiles);
};
window.ExtensionRegistry.registerExtension('system', {
    name: "System Core Actions",
    version: "1.0.0",
    uiHooks: {
        'sutram:is-swapping-scope': () => {
            return Boolean(
                window.Sutram?.storeRegistry?.isTransitioning?.() ||
                window.inSetu?.stores?.App?.getState()?.isSwappingWorkspace
            );
        },
        'sutram:resolve-preferred-column': (targetParent) => {
            if (!targetParent) return 'center';
            const t = String(targetParent).toLowerCase();
            if (t === 'context' || t === 'library') return 'left';
            if (t === 'edit' || t === 'ctrl') return 'center';
            return 'right';
        },
        'sutram:resolve-primary-tab-meta': ({ id }) => {
            const slots = window.ExtensionRegistry?.getLayoutSlots?.() || [];
            const primarySlot = slots.find(s => s.slot === 'slots:primary-navigation' && (s.id === id || s.rawId === id));
            if (primarySlot && (primarySlot.icon || primarySlot.intent)) {
                const intentColorMap = {
                    primary: 'var(--intent-primary)',
                    highlight: 'var(--intent-highlight)',
                    warning: 'var(--intent-warning)',
                    danger: 'var(--intent-danger)',
                    success: 'var(--intent-success)',
                    neutral: 'var(--text-muted)'
                };
                return {
                    color: intentColorMap[primarySlot.intent] || 'var(--intent-primary)',
                    icon: primarySlot.icon || 'folder'
                };
            }
            const coreTabMap = {
                'context': { color: 'var(--intent-primary)', icon: 'folder-code' },
                'edit': { color: 'var(--intent-highlight)', icon: 'edit-3' },
                'diagnostics': { color: 'var(--intent-warning)', icon: 'activity' },
                'tasks': { color: 'var(--intent-warning)', icon: 'check-square' },
                'ctrl': { color: 'var(--intent-danger)', icon: 'terminal' },
                'offline': { color: 'var(--text-muted)', icon: 'wifi-off' },
                'library': { color: 'var(--intent-highlight)', icon: 'book-open' }
            };
            return coreTabMap[id] || null;
        },
        'sutram:resolve-route-hash': ({ colId, subId }) => {
            const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
            const deepPath = window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[subId];
            const deepStr = deepPath && deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
            return `#/${activeWs}/${colId}/${subId}${deepStr}`;
        }
    },
    shortcuts: [
        { id: 'layout-focus-col-left', context: 'global', key: 'ctrl+1', label: 'Focus Left Column', action: () => { const l = window.Sutram?.stores?.Layout?.getState(); if(l) l.setFocusedColumn('left'); } },
        { id: 'layout-focus-col-center', context: 'global', key: 'ctrl+2', label: 'Focus Center Column', action: () => { const l = window.Sutram?.stores?.Layout?.getState(); if(l) l.setFocusedColumn('center'); } },
        { id: 'layout-focus-col-right', context: 'global', key: 'ctrl+3', label: 'Focus Right Column', action: () => { const l = window.Sutram?.stores?.Layout?.getState(); if(l) l.setFocusedColumn('right'); } },
        { id: 'layout-focus-col-prev', context: 'global', key: 'ctrl+shift+arrowleft', label: 'Focus Previous Column', action: () => { 
            const l = window.Sutram?.stores?.Layout?.getState(); 
            if(l) {
                const cols = ['left', 'center', 'right'];
                let idx = cols.indexOf(l.focusedColumn || 'center');
                while (idx > 0) {
                    idx--;
                    if (l.columns[cols[idx]] && l.columns[cols[idx]].pinned && l.columns[cols[idx]].pinned.length > 0) {
                        l.setFocusedColumn(cols[idx]);
                        break;
                    }
                }
            }
        } },
        { id: 'layout-focus-col-next', context: 'global', key: 'ctrl+shift+arrowright', label: 'Focus Next Column', action: () => { 
            const l = window.Sutram?.stores?.Layout?.getState(); 
            if(l) {
                const cols = ['left', 'center', 'right'];
                let idx = cols.indexOf(l.focusedColumn || 'center');
                while (idx < 2) {
                    idx++;
                    if (l.columns[cols[idx]] && l.columns[cols[idx]].pinned && l.columns[cols[idx]].pinned.length > 0) {
                        l.setFocusedColumn(cols[idx]);
                        break;
                    }
                }
            }
        } },
        { id: 'layout-focus-tab-prev', context: 'global', key: 'ctrl+shift+arrowup', label: 'Focus Previous Tab', action: () => {
            const l = window.Sutram?.stores?.Layout?.getState();
            if(l && l.focusedColumn) {
                const col = l.columns[l.focusedColumn];
                if (!col || !col.pinned || col.pinned.length <= 1) return;
                const idx = col.pinned.findIndex(p => p.id === col.active);
                let targetId;
                if (idx > 0) targetId = col.pinned[idx - 1].id;
                else targetId = col.pinned[col.pinned.length - 1].id;

                const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
                const deepPath = window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[targetId];
                const deepStr = deepPath && deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
                window.location.hash = `#/${encodeURIComponent(activeWs)}/${l.focusedColumn}/${encodeURIComponent(targetId)}${deepStr}`;
            }
        } },
        { id: 'layout-focus-tab-next', context: 'global', key: 'ctrl+shift+arrowdown', label: 'Focus Next Tab', action: () => {
            const l = window.Sutram?.stores?.Layout?.getState();
            if(l && l.focusedColumn) {
                const col = l.columns[l.focusedColumn];
                if (!col || !col.pinned || col.pinned.length <= 1) return;
                const idx = col.pinned.findIndex(p => p.id === col.active);
                let targetId;
                if (idx !== -1 && idx < col.pinned.length - 1) targetId = col.pinned[idx + 1].id;
                else targetId = col.pinned[0].id;

                const activeWs = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
                const deepPath = window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[targetId];
                const deepStr = deepPath && deepPath.length > 0 ? '/' + deepPath.map(encodeURIComponent).join('/') : '';
                window.location.hash = `#/${encodeURIComponent(activeWs)}/${l.focusedColumn}/${encodeURIComponent(targetId)}${deepStr}`;
            }
        } }
    ],
    entityActions: [
        {
            targetEntity: 'text_blob',
            id: 'blob-copy',
            label: 'Copy',
            icon: 'clipboard',
            group: 'edit',
            vfsBound: false,
            order: 10,
            onClick: async (data) => {
                if (data.textContent && window.inSetu.utils) {
                    await window.inSetu.utils.copyRawText(data.textContent);
                    if (window.inSetu.ui) window.inSetu.ui.setGlobalStatus("✅ Copied to clipboard", 2000);
                }
            }
        },
        {
            targetEntity: 'text_blob',
            id: 'blob-save-vfs',
            label: 'Save to VFS',
            icon: 'save',
            intent: 'neutral',
            group: 'file',
            vfsBound: false,
            order: 20,
            onClick: (data) => {
                if (data.textContent && window.inSetu.ui && window.inSetu.ui.openFolderBrowser) {
                    window.inSetu.ui.openFolderBrowser(async (selectedPath) => {
                        if (selectedPath === undefined || selectedPath === null) return; // User cancelled
                        const filename = data.suggestedFilename || ('blob_' + Date.now() + '.txt');
                        const cleanFolder = String(selectedPath || '').replace(/\/+$/, '');
                        const rawTarget = cleanFolder ? `${cleanFolder}/${filename}` : filename;
                        const filepath = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawTarget) : rawTarget;

                        if (window.inSetu.sys) {
                            await window.inSetu.sys.executeWorkspaceMutation('fs/save', { filepath, content: data.textContent });
                            if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus('✅ Saved to ' + filepath, 3000);
                        }
                    });
                }
            }
        },
        {
            targetEntity: 'text_blob',
            id: 'blob-download',
            label: 'Download',
            icon: 'download',
            group: 'file',
            vfsBound: false,
            order: 30,
            onClick: (data) => {
                if (data.textContent) {
                    const filename = data.suggestedFilename || `blob_${Date.now()}.txt`;
                    const blob = new Blob([data.textContent], { type: 'text/plain;charset=utf-8' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    if (window.inSetu.ui) window.inSetu.ui.setGlobalStatus(`✅ Downloaded ${filename}`, 3000);
                }
            }
        }
    ]
});
