// insetu/insetu/static/js/core/sdk.js
// Tier 1A: inSetu Local OS SDK Wrapper (Single-File Frontend Membrane)
export * from 'sutram';
import {
    SutramElement,
    createSutramStore,
    StoreRegistry,
    ExtensionRegistry as SutramRegistry,
    fuzzyFilterObjects,
    normalizeAccentText,
    slugify,
    debounce,
    coalescedAsync,
    formatDate,
    timeAgo,
    nativeShareFiles,
    shallowEqual,
    copyRichHtml,
    threeWayMergeText,
    HostPath,
    truncateFilename,
    clone,
    compileDagWavefronts,
    extractTemplateVariables as _sutramExtractTemplateVariables,
    interpolateTemplateVariables as _sutramInterpolateTemplateVariables,
    ensureSutramAppShellCached as ensureAppShellCached,
    SutramCacheWarmer,
    getEventPath,
    getEventTarget
} from 'sutram';
import * as jsYaml from '/static/vendor/js-yaml/js-yaml.min.js';
import { BucketAddress, InSetuURI } from '/static/extensions/system/uri.js';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';

export { ensureAppShellCached, SutramCacheWarmer };

if (typeof window !== 'undefined') {
    window.inSetu = window.inSetu || {};
    window.inSetu.sys = window.inSetu.sys || {};
    window.inSetu.sys.ensureAppShellCached = ensureAppShellCached;
}

export { BucketAddress, InSetuURI, InSetuElement };
const INSETU_RESERVED_MACROS = Object.freeze([
    'UNTIL', 'triple', 'inputs', 'nodes', 'item', 'loop', 'global',
    'system_prompt', 'user_message', 'user_prompt', 'context_block', 'history_summary', 'plan_uri'
]);
const INSETU_RESERVED_PREFIXES = Object.freeze([
    'wordcount_', 'nodes.', 'inputs.', 'global.', 'item.', 'loop.', 'include_prompt:', 'include_prompt?:', 'ymm:', 'sys.'
]);

export function extractTemplateVariables(text, options = {}) {
    return _sutramExtractTemplateVariables(text, {
        reservedMacros: INSETU_RESERVED_MACROS,
        reservedPrefixes: INSETU_RESERVED_PREFIXES,
        ...options
    });
}

export function interpolateTemplateVariables(text, values = {}, options = {}) {
    return _sutramInterpolateTemplateVariables(text, values, {
        reservedMacros: INSETU_RESERVED_MACROS,
        reservedPrefixes: INSETU_RESERVED_PREFIXES,
        ...options
    });
}

export function cleanCodeArtifacts(text) {
    if (!text || typeof text !== 'string') return '';
    let result = text;
    const firstDollar = result.indexOf('$');
    const lastDollar = result.lastIndexOf('$');
    if (firstDollar !== -1 && lastDollar > firstDollar && result.includes('\\vert{}')) {
        result = result.slice(0, firstDollar + 1)
            + result.slice(firstDollar + 1, lastDollar).replace(/\\vert\{\}/g, '|')
            + result.slice(lastDollar);
    }
    result = result.replace(/\{\{\s*ymm:(.)[x*](\d+)\s*\}\}/g, (_, char, count) => char.repeat(parseInt(count, 10)));
    result = result.replace(/\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}/g, (_, char, count) => char.repeat(parseInt(count, 10)));
    result = result.replace(/\{\{\s*triple(.)\s*\}\}/g, (_, char) => char.repeat(3));
    result = result.replace(/_(?:[^_\n]_){3,}/g, (match) => match.replace(/_/g, ''));
    result = result.replace(/\x5b\x73\x6f\x75\x72\x63\x65:\s*\d+\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65:\s*[\d\s,]+\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65_start\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65_end\x5d/gi, '');
    result = result.replace(/\x5b\x63\x69\x74\x65\x5d/gi, '');
    result = result.replace(/<\/?(?:span|cite)[^>]*>/gi, '');
    return result;
}

export function createExtensionStore(name, initialState, persistenceSchema = {}) {
    const getWs = () => window.inSetu.utils.getActiveWorkspace();
    const store = createSutramStore(name, initialState, persistenceSchema, getWs, 'insetu');
    Object.defineProperty(store, 'api', {
        get: () => window.inSetu.api,
        configurable: true
    });
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

window.inSetu = window.inSetu || {};
window.inSetu.utils = window.inSetu.utils || {};
window.inSetu.utils.BucketAddress = BucketAddress;
window.inSetu.utils.InSetuURI = InSetuURI;
window.inSetu.utils.canonicalizeURI = (raw, defaultScheme = 'vfs') => InSetuURI.canonicalize(raw, defaultScheme);
window.inSetu.utils.openFilePicker = function({ multiple = true, accept = '', onSelect = null } = {}) {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = Boolean(multiple);
    if (accept) input.accept = accept;
    input.onchange = (e) => {
        const files = e.target?.files;
        if (files && files.length > 0 && typeof onSelect === 'function') {
            onSelect(files);
        }
    };
    input.click();
};
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

window.inSetu = window.inSetu || {};
// Pre-seed foundational OS chassis modules to protect against offline cache misses or backend latency
const _baseCore = ['bridge', 'gather', 'cartographer', 'config', 'editor', 'fs', 'system', 'workers', 'auth', 'security', 'topology', 'offline', 'llm', 'agent', 'prompts', 'mcp', 'remote'];
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
    return window.inSetu.api.bindJobAction(route, payloadGenerator, pollOptions);
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
        const quarantined = window.inSetu?.stores?.App?.getState()?.quarantinedModules || {};

        const validSlots = slots.filter(s => {
            if (!s.extName) return true;
            if (quarantined[s.extName]) return false;
            if (window.inSetu.isCore(s.extName)) return true;
            if (!active) return true;
            return active.includes(s.extName);
        });

        // Preserve pinned LayoutStore tabs for quarantined modules via non-destructive placeholder slots
        const existingIds = new Set(validSlots.map(s => s.id));
        const layoutCols = window.Sutram?.stores?.Layout?.getState()?.columns || {};
        Object.entries(layoutCols).forEach(([colId, colObj]) => {
            (colObj?.pinned || []).forEach(p => {
                if (!p || !p.id || existingIds.has(p.id)) return;
                const extCand = p.extName || (p.id.includes(':') ? p.id.split(':')[0] : p.id);
                if (extCand && quarantined[extCand]) {
                    existingIds.add(p.id);
                    validSlots.push({
                        slot: 'slots:sub-navigation',
                        id: p.id,
                        rawId: p.rawId || p.id.split(':').pop(),
                        label: `⚠️ ${p.label || extCand}`,
                        icon: 'shield-alert',
                        intent: 'danger',
                        extName: extCand,
                        targetParent: p.targetParent || colId,
                        component: 'insetu-quarantined-slot-placeholder'
                    });
                }
            });
        });

        return validSlots;
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
                const res = await window.inSetu.api.get(`fs/exists?file=${encodeURIComponent(filepath)}`);
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
window.inSetu.utils.compileDagWavefronts = compileDagWavefronts;
window.inSetu.utils.extractTemplateVariables = extractTemplateVariables;
window.inSetu.utils.interpolateTemplateVariables = interpolateTemplateVariables;
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
    // An empty copy would silently clear the clipboard, so it is reported instead
    if (typeof text !== 'string' || !text.trim()) {
        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("Nothing to copy.", 3000, true);
        throw new Error("Nothing to copy");
    }
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
                return {
                    intent: primarySlot.intent || 'primary',
                    icon: primarySlot.icon || 'folder'
                };
            }
            const coreTabMap = {
                'context': { intent: 'primary', icon: 'folder-code' },
                'edit': { intent: 'highlight', icon: 'edit-3' },
                'diagnostics': { intent: 'warning', icon: 'activity' },
                'tasks': { intent: 'warning', icon: 'check-square' },
                'ctrl': { intent: 'danger', icon: 'terminal' },
                'offline': { intent: 'neutral', icon: 'wifi-off' },
                'library': { intent: 'highlight', icon: 'book-open' }
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
