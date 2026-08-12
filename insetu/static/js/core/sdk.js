// insetu/insetu/static/js/sdk.js
// Tier 1A: inSetu Local OS SDK Wrapper
import { SutramElement, createSutramStore, ExtensionRegistry as SutramRegistry, bindStoreInput } from '../../vendor/sutram/js/sdk.js';
import { fuzzyFilterObjects, normalizeAccentText, slugify, debounce, formatDate, timeAgo } from '../../vendor/sutram/js/utils.js';

export { bindStoreInput };
export function createExtensionStore(name, initialState, persistKeys = []) {
    const getWs = () => window.inSetu.utils.getActiveWorkspace();
    const store = createSutramStore(name, initialState, persistKeys, getWs, 'insetu');
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
    isExtensionActive(name = this.extName) {
        if (window.inSetu?.isCore && window.inSetu.isCore(name)) return true;
        return !!(window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes(name));
    }

    setStatus(msg, timeout = 3000, isError = false) {
        if (window.inSetu?.ui?.setGlobalStatus) {
            window.inSetu.ui.setGlobalStatus(msg, timeout, isError);
        }
    }
    compileSystem(onProgress = null, forceFull = false, startStep = null, targetRepos = null) {
        if (window.inSetu?.sys?.executeSystemCompile) {
            return window.inSetu.sys.executeSystemCompile(onProgress, forceFull, startStep, targetRepos);
        }
        return Promise.resolve();
    }
    get utils() {
        return {
            fuzzyFilterObjects: window.inSetu.utils.fuzzyFilterObjects,
            normalizeAccentText: window.inSetu.utils.normalizeAccentText,
            pollJob: window.inSetu.utils.pollJob,
            slugify: window.inSetu.utils.slugify,
            copyToClipboard: window.inSetu.utils.copyToClipboard,
            copyRawText: window.inSetu.utils.copyRawText,
            formatDate: window.inSetu.utils.formatDate,
            timeAgo: window.inSetu.utils.timeAgo
        };
    }
    get api() {
        return {
            pollJob: (jobId, options = {}) => window.inSetu.utils.pollJob(jobId, options),
            bindJobAction: (path, payloadGenerator, pollOptions = {}) => {
                return async (e) => {
                    const payload = typeof payloadGenerator === 'function' ? await payloadGenerator(e) : payloadGenerator;
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
            get: (path, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                return window.inSetu.api.workspace(`${this.extName}/${cleanPath}`, { ...options, method: 'GET' });
            },
            post: (path, payload, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                return window.inSetu.api.workspace(`${this.extName}/${cleanPath}`, {
                    ...options,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                    body: JSON.stringify(payload)
                });
            },
            delete: (path, options = {}) => {
                if (!window.inSetu.isCore(this.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(this.extName)) {
                    return Promise.resolve(new Response(JSON.stringify({ error: "Extension disabled" }), { status: 403 }));
                }
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                return window.inSetu.api.workspace(`${this.extName}/${cleanPath}`, { ...options, method: 'DELETE' });
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
    connectedCallback() {
        super.connectedCallback();

        // Wire up the new unified onForceRefresh lifecycle method
        this.registerGlobalListener('insetu:force-refresh', window, (e) => {
            if (typeof this.onForceRefresh === 'function') {
                const { parentId, subId } = e.detail || {};
                const mySubId = this.dataset.subId || this.extName;
                if (subId === mySubId || (!subId && parentId === this.extName)) {
                    this.onForceRefresh();
                }
            }
        });

        const appStore = window.inSetu?.stores?.App;
        if (appStore) {
            this.subscribe(appStore, state => state.activeWorkspace, (ws) => {
                if (this.workspaceId !== ws) {
                    this.workspaceId = ws;
                    this.onWorkspaceChanged(ws);
                }
            });
        }
        // Auto-hydrate the ecosystem topology for all extensions natively
        if (appStore) {
            this.subscribe(appStore, state => {
                this.ecosystem = {
                    allRepos: state.allRepos || [],
                    pinnedRepos: state.pinnedRepos || new Set(['ALL']),
                    targetConfigs: state.targetConfigs || []
                };
                this.requestUpdate();
            });
            const as = appStore.getState ? appStore.getState() : {};
            this.ecosystem = {
                allRepos: as.allRepos || [],
                pinnedRepos: as.pinnedRepos || new Set(['ALL']),
                targetConfigs: as.targetConfigs || []
            };
        }
    }

    onWorkspaceChanged(newWorkspaceId) {}
}
// Safely initialize nested global namespaces individually
export const CORE_MODULES = new Set(['bridge', 'gather', 'config', 'files', 'editor', 'system', 'fs', 'workers', 'auth', 'security', 'cartographer', 'core_text_blobs']);

window.inSetu = window.inSetu || {};
window.inSetu.CORE_MODULES = CORE_MODULES;
window.inSetu.isCore = (extName) => CORE_MODULES.has(extName);

window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.extensions = window.inSetu.extensions || {};
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.editor = window.inSetu.editor || {};
window.inSetu.utils = window.inSetu.utils || {};
// Abstracted Event Bus & Fail-Safe Hook Emitter
window.inSetu.events = window.inSetu.events || {
    emit: function(eventName, detail = null) {
        window.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
    },
    emitHook: function(zoneName, payload = null) {
        if (zoneName === 'zone:force-refresh') {
            window.dispatchEvent(new CustomEvent('insetu:force-refresh', { detail: payload, bubbles: true, composed: true }));
        }
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

// Wire inSetu's active extension policy into Sutram's agnostic filter slot
window.ExtensionRegistry.setFilterPredicate((extName) => {
    if (window.inSetu?.isCore && window.inSetu.isCore(extName)) return true;
    if (!window.ACTIVE_EXTENSIONS || window.ACTIVE_EXTENSIONS.length === 0) return true;
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
            if (!active || active.length === 0) return true;
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
    return actions.filter(act => {
        if (act.extName && !window.inSetu.isCore(act.extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(act.extName)) {
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

    if (config.shortcuts) {
        config.shortcuts.forEach(s => {
            window.ExtensionRegistry.registerShortcut(s.context, s.key, s.action);
        });
    }

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
window.inSetu.utils.formatDate = formatDate;
window.inSetu.utils.timeAgo = timeAgo;

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
window.inSetu.utils.serializeFrontmatter = function(yamlObj, markdownBody) {
    if (!yamlObj || Object.keys(yamlObj).length === 0) return markdownBody;

    let text = '---\n';
    for (const [k, v] of Object.entries(yamlObj)) {
        let safeVal = v;
        if (typeof v === 'string' && (v.includes(':') || v.includes('#') || v.includes('\n') || v.includes('{') || v.includes('['))) {
            // Escape inner quotes and wrap the whole string
            safeVal = `"${v.replace(/"/g, '\\"')}"`;
        }
        text += `${k}: ${safeVal}\n`;
    }
    text += '---\n\n' + markdownBody;
    return text;
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

window.inSetu.utils.extractManifestFiles = function(manifestData, targetKey = null) {
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
        let entry = ctxManifest[targetKey] || vfsManifest[targetKey] || manifestData[targetKey];
        if (!entry && (targetKey.includes('/') || targetKey.includes('\\'))) {
            const name = targetKey.split('/').pop();
            entry = ctxManifest[name] || vfsManifest[name] || manifestData[name];
        }
        if (!entry) return [targetKey];
        return extract(entry);
    }

    const allFiles = new Set();
    const combined = (manifestData.ctx || manifestData.vfs) ? { ...vfsManifest, ...ctxManifest } : manifestData;
    Object.entries(combined).forEach(([k, v]) => {
        if (typeof k === 'string' && k.endsWith('.txt')) allFiles.add(k);
        extract(v).forEach(f => {
            if (typeof f === 'string') allFiles.add(f);
        });
    });
    return Array.from(allFiles);
};

window.ExtensionRegistry.registerExtension('core_text_blobs', {
    name: "Core Text Blob Actions",
    version: "1.0.0",
    entityActions: [
        {
            targetEntity: 'text_blob',
            id: 'blob-copy',
            label: 'Copy',
            icon: '📋',
            intent: 'neutral',
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
            icon: '💾',
            intent: 'neutral',
            order: 20,
            onClick: (data) => {
                if (data.textContent && window.inSetu.ui && window.inSetu.ui.openFolderBrowser) {
                    window.inSetu.ui.openFolderBrowser(async (selectedPath) => {
                        if (selectedPath === undefined || selectedPath === null) return; // User cancelled

                        const filename = data.suggestedFilename || ('blob_' + Date.now() + '.txt');
                        const filepath = selectedPath ? (selectedPath + '/' + filename) : filename;

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
            icon: '⬇️',
            intent: 'neutral',
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
