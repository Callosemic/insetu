// insetu/insetu/static/js/sdk.js
// Tier 1A: inSetu Local OS SDK Wrapper

import { SutramElement, createSutramStore, ExtensionRegistry as SutramRegistry, bindStoreInput } from '../vendor/sutram/sdk.js';
import { fuzzyFilterObjects, normalizeAccentText, slugify, debounce } from '../vendor/sutram/utils.js';

export { bindStoreInput };

export function createExtensionStore(name, initialState, persistKeys = []) {
    const getWs = () => window.inSetu.utils.getActiveWorkspace();
    return createSutramStore(name, initialState, persistKeys, getWs, 'insetu');
}

export function createIsolatedSlice(store, sliceKey) {
    return {
        get: () => store.getState()[sliceKey],
        set: (val) => store.setState({ [sliceKey]: typeof val === 'object' && val !== null ? { ...val } : val })
    };
}

export class InSetuElement extends SutramElement {
    static properties = {
        workspaceId: { type: String }
    };

    constructor() {
        super();
        this.workspaceId = window.inSetu?.utils?.getActiveWorkspace() || 'default';
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

    get utils() {
        return {
            fuzzyFilterObjects: window.inSetu.utils.fuzzyFilterObjects,
            normalizeAccentText: window.inSetu.utils.normalizeAccentText,
            pollJob: window.inSetu.utils.pollJob,
            slugify: window.inSetu.utils.slugify,
            copyToClipboard: window.inSetu.utils.copyToClipboard,
            copyRawText: window.inSetu.utils.copyRawText
        };
    }

    get api() {
        return {
            pollJob: (jobId, options = {}) => window.inSetu.utils.pollJob(jobId, options),
            get: (path, options = {}) => {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                return window.inSetu.api.workspace(`${this.extName}/${cleanPath}`, { ...options, method: 'GET' });
            },
            post: (path, payload, options = {}) => {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                return window.inSetu.api.workspace(`${this.extName}/${cleanPath}`, {
                    ...options,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                    body: JSON.stringify(payload)
                });
            },
            delete: (path, options = {}) => {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                return window.inSetu.api.workspace(`${this.extName}/${cleanPath}`, { ...options, method: 'DELETE' });
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

    connectedCallback() {
        super.connectedCallback();
        const appStore = window.inSetu?.stores?.App;
        if (appStore) {
            this.subscribe(appStore, state => state.activeWorkspace, (ws) => {
                if (this.workspaceId !== ws) {
                    this.workspaceId = ws;
                    this.onWorkspaceChanged(ws);
                }
            });
        }
    }

    onWorkspaceChanged(newWorkspaceId) {}
}

// Safely initialize nested global namespaces individually
window.inSetu = window.inSetu || {};
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.extensions = window.inSetu.extensions || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.utils = window.inSetu.utils || {};

// Abstracted Event Bus & Fail-Safe Hook Emitter
window.inSetu.events = window.inSetu.events || {
    emit: function(eventName, detail = null) {
        window.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
    },
    emitHook: function(zoneName, payload = null) {
        if (window.inSetu?.extensions?.Registry?.executeUIHook) {
            return window.inSetu.extensions.Registry.executeUIHook(zoneName, payload);
        }
        return null;
    }
};
// Forward the central registry
window.inSetu.extensions.Registry = SutramRegistry;
window.ExtensionRegistry = SutramRegistry;
window.inSetu.extensions.InSetuElement = InSetuElement;
window.inSetu.extensions.createExtensionStore = createExtensionStore;
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
        return slots.filter(s => {
            if (!s.extName) return true;
            const isCore = ['bridge', 'gather', 'config', 'files', 'editor'].includes(s.extName);
            if (isCore) return true;
            if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes(s.extName)) return true;
            return false;
        });
    } catch (e) {
        console.error("Error in getLayoutSlots:", e);
        return [];
    }
};

const _baseGetEntityActions = window.ExtensionRegistry.getEntityActions.bind(window.ExtensionRegistry);
window.ExtensionRegistry.getEntityActions = function(compoundType, data) {
    const actions = _baseGetEntityActions(compoundType, data);
    return actions.filter(act => {
        if (act.extName && !['bridge', 'gather', 'config', 'files'].includes(act.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(act.extName)) {
            return false;
        }
        return true;
    });
};

window.ExtensionRegistry.utils = {
    debounce,
    _verifyTimers: {},
    debounceVerifyFile: function(workspaceId, filepath, callback, delay = 300) {
        const key = `verify_${filepath}`;
        if (this._verifyTimers[key]) window.clearTimeout(this._verifyTimers[key]); // utils.debounce whitelist
        this._verifyTimers[key] = setTimeout(async () => {
            try {
                const res = await window.inSetu.api.workspace(`fs/exists?file=${encodeURIComponent(filepath)}`);
                if (res.ok) {
                    const data = await res.json();
                    callback(data.exists, filepath);
                }
            } catch(e) {
                console.warn("Silent verify failed", e);
            }
        }, delay);
    }
};

const _originalRegister = window.ExtensionRegistry.registerExtension.bind(window.ExtensionRegistry);
window.ExtensionRegistry.registerExtension = function(extName, config) {
    if (config.entityActions) {
        config.entityActions.forEach(act => {
            if (act.emitEvent && !act.onClick && !act.asyncAction) {
                act.onClick = (data, e) => {
                    if (e) e.stopPropagation();
                    const payload = act.emitEvent(data);
                    if (window.inSetu?.events?.emit) {
                        window.inSetu.events.emit(payload.name, payload.detail);
                    }
                };
            }
        });
    }
    _originalRegister(extName, config);

    if (config.settingsActions) {
        config.settingsActions.forEach(act => {
            let sectionName = 'Extensions';
            if (config.name === 'Workspace Configuration' || act.id === 'config_editor' || act.id === 'workspaces_editor') sectionName = 'Workspace';
            else if (config.name === 'Issue Tracker') sectionName = 'Tracker';
            else if (config.name === 'Skills Tracker') sectionName = 'Practice';
            this.registerSettingsAction(act.id, act.label, act.icon, act.onClick, sectionName);
        });
    }
};

// Attach util wrappers mapping to the Sutram imports
window.inSetu.utils.slugify = slugify;
window.inSetu.utils.fuzzyFilterObjects = fuzzyFilterObjects;
window.inSetu.utils.normalizeAccentText = normalizeAccentText;

// Preserve clipboard API bindings
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

window.inSetu.utils.parseFrontmatter = function(text) {
    const match = text.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return { meta: {}, content: text, rawFrontmatter: '' };

    const rawFrontmatter = match[1];
    const content = text.slice(match[0].length);
    const meta = {};

    rawFrontmatter.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(':').trim().replace(/^['"](.*)['"]$/, '$1');
            meta[key] = val;
        }
    });

    return { meta, content, rawFrontmatter: match[0] };
};

window.inSetu.utils.extractManifestFiles = function(manifestData, targetKey = null) {
    const extract = (data) => {
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && data !== null) {
            return data.chunks || data.files || [];
        }
        return [];
    };

    if (targetKey) {
        return extract(manifestData[targetKey]);
    }

    const allFiles = new Set();
    Object.entries(manifestData).forEach(([k, v]) => {
        if (typeof k === 'string' && k.endsWith('.txt')) allFiles.add(k);
        extract(v).forEach(f => {
            if (typeof f === 'string') allFiles.add(f);
        });
    });
    return Array.from(allFiles);
};
