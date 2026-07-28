import { LitElement, html } from 'lit';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
export function createExtensionStore(name, initialState, persistKeys = []) {
    const store = createStore(
        devtools(
            subscribeWithSelector((set, get) => ({
                ...initialState,
                resetState: () => set(initialState)
            })),
            { name: `${name}Store` }
        )
    );
    if (persistKeys && persistKeys.length > 0) {
        const getWs = () => window.inSetu.utils.getActiveWorkspace();

        const hydrate = (ws) => {
            const hydrated = {};
            persistKeys.forEach(k => {
                const val = localStorage.getItem(`insetu_${name.toLowerCase()}_${k}_${ws}`);
                if (val) {
                    try { 
                        const parsed = JSON.parse(val); 
                        hydrated[k] = initialState[k] instanceof Set ? new Set(parsed) : parsed;
                    } catch(e) {}
                }
            });
            if (Object.keys(hydrated).length > 0) store.setState(hydrated);
        };

        setTimeout(() => hydrate(getWs()), 0);

        setTimeout(() => {
            const appStore = window.inSetu?.stores?.App;
            if (appStore) {
                appStore.subscribe(state => state.activeWorkspace, ws => hydrate(ws));
            }
        }, 100);
        store.subscribe((state, prevState) => {
            const ws = getWs();
            persistKeys.forEach(k => {
                if (state[k] !== prevState[k]) {
                    const valToSave = state[k] instanceof Set ? Array.from(state[k]) : state[k];
                    localStorage.setItem(`insetu_${name.toLowerCase()}_${k}_${ws}`, JSON.stringify(valToSave));
                }
            });
        });
    }

    return store;
}

export function createIsolatedSlice(store, sliceKey) {
    return {
        get: () => store.getState()[sliceKey],
        set: (val) => store.setState({ [sliceKey]: typeof val === 'object' && val !== null ? { ...val } : val })
    };
}
export class InSetuElement extends LitElement {
    static properties = {
        workspaceId: { type: String }
    };
    constructor() {
        super();
        this.workspaceId = window.inSetu.utils.getActiveWorkspace();
        this._storeUnsubs = [];
        this._managedIntervals = [];
        this._managedListeners = [];
    }
    get extName() {
        // 1. SSOT Registry Lookup (Identify which extension mapped this component)
        const myTag = this.tagName.toLowerCase();
        if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
            for (const [extName, config] of window.ExtensionRegistry._manifests.entries()) {
                if (config.layoutSlots && config.layoutSlots.some(s => s.component === myTag)) {
                    return extName;
                }
            }
        }

        // 2. Contextual DOM Inheritance (Piercing Shadow DOM boundaries)
        let currentNode = this;
        while (currentNode) {
            if (currentNode.dataset && currentNode.dataset.ext) return currentNode.dataset.ext;

            if (currentNode.closest) {
                const ancestor = currentNode.closest('[data-ext]');
                if (ancestor) return ancestor.dataset.ext;
            }

            // Pierce the Shadow DOM boundary upwards
            const root = currentNode.getRootNode();
            currentNode = (root instanceof ShadowRoot) ? root.host : null;
        }

        // 3. Explicit static class definition (Manual override)
        if (this.constructor.extensionName) return this.constructor.extensionName;

        // 4. Fallback to tag name inference (Convention over configuration)
        const inferred = myTag.replace('insetu-ext-', '');
        if (myTag === inferred) {
            console.warn(`[SDK Warning] Component <${myTag}> is unmapped and lacks the 'insetu-ext-' prefix. API routing may fail.`);
        }

        return inferred;
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
    subscribe(store, selectorOrListener, listener = undefined) {
        const unsub = listener ? store.subscribe(selectorOrListener, listener) : store.subscribe(selectorOrListener);
        this._storeUnsubs.push(unsub);
        return unsub;
    }

    registerInterval(callback, delayMs) {
        const id = setInterval(callback, delayMs);
        this._managedIntervals.push(id);
        return id;
    }

    registerGlobalListener(eventType, targetNode, callback, options = false) {
        targetNode.addEventListener(eventType, callback, options);
        this._managedListeners.push({ eventType, targetNode, callback, options });
    }
    dispatch(eventName, detail = null) {
        if (window.inSetu?.events?.emit) {
            window.inSetu.events.emit(eventName, detail);
        } else {
            window.dispatchEvent(new CustomEvent(eventName, { 
                detail, 
                bubbles: true, 
                composed: true 
            }));
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
    disconnectedCallback() {
        super.disconnectedCallback();
        this._storeUnsubs.forEach(unsub => unsub());
        this._storeUnsubs = [];

        this._managedIntervals.forEach(id => clearInterval(id));
        this._managedIntervals = [];

        this._managedListeners.forEach(({ eventType, targetNode, callback, options }) => {
            targetNode.removeEventListener(eventType, callback, options);
        });
        this._managedListeners = [];
    }

    onWorkspaceChanged(newWorkspaceId) {}
}
export function bindStoreInput(store, statePath, currentValue, options = {}) {
    const { type = 'text', placeholder = '', style = '', id = '', selectOptions = [], min, max, onUpdate } = options;
    const handleInput = (e) => {
        let val = type === 'checkbox' ? e.target.checked : e.target.value;
        if (type === 'number') val = parseFloat(val);
        const parts = statePath.split('.');
        if (parts.length === 1) {
            store.setState({ [parts[0]]: val });
        } else {
            const state = store.getState();
            store.setState({ [parts[0]]: { ...state[parts[0]], [parts[1]]: val } });
        }
        if (onUpdate) onUpdate(val, e);
    };

    if (type === 'textarea') {
        return html`<textarea id=${id} style=${style} placeholder=${placeholder} .value=${currentValue || ''} @input=${handleInput}></textarea>`;
    } else if (type === 'select') {
        return html`<select id=${id} style=${style} .value=${currentValue || ''} @change=${handleInput}>
            ${selectOptions.map(o => html`<option value=${o.value !== undefined ? o.value : o}>${o.label || o}</option>`)}
        </select>`;
    } else if (type === 'checkbox') {
        return html`<input id=${id} type="checkbox" style=${style} .checked=${!!currentValue} @change=${handleInput}>`;
    }
    return html`<input id=${id} type=${type} style=${style} placeholder=${placeholder} min=${min||''} max=${max||''} .value=${currentValue || ''} @input=${handleInput}>`;
}

export function normalizeAccentText(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function fuzzyFilterObjects(items, query, getSearchString = (item) => String(item)) {
    if (!query.trim()) return items;

    const norm = normalizeAccentText;
    const queryWords = norm(query).trim().split(/\s+/).filter(t => t);

    const scoredItems = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const targetStr = norm(getSearchString(item));
        let totalScore = 0;
        let isMatch = true;

        for (let w = 0; w < queryWords.length; w++) {
            const qWord = queryWords[w];
            let wordScore = 0;

            if (targetStr.includes(qWord)) {
                wordScore = qWord.length * 50;
                if (targetStr.startsWith(qWord) || new RegExp(`[\\/\\s\\-_]${qWord}`).test(targetStr)) {
                    wordScore += 50;
                }
            } else {
                let qIdx = 0;
                let tIdx = 0;
                let prevTIdx = -1;

                while (qIdx < qWord.length && tIdx < targetStr.length) {
                    if (qWord[qIdx] === targetStr[tIdx]) {
                        if (tIdx === 0 || /[\\/\\s\\-_]/.test(targetStr[tIdx - 1])) {
                            wordScore += 10;
                        } else {
                            wordScore += 1;
                        }
                        if (prevTIdx !== -1) {
                            const gap = tIdx - prevTIdx - 1;
                            wordScore -= (gap * 1.5); 
                        }
                        prevTIdx = tIdx;
                        qIdx++;
                    }
                    tIdx++;
                }
                if (qIdx !== qWord.length || wordScore <= 0) {
                    isMatch = false; 
                    break;
                }
            }
            totalScore += wordScore;
        }
        if (isMatch) scoredItems.push({ item, score: totalScore });
    }
    return scoredItems.sort((a, b) => b.score - a.score).map(res => res.item);
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

// Define the Job Polling Subroutine
window.inSetu.utils.pollJob = function(jobId, options = {}) {
    const { onProgress = ()=>{}, onComplete = ()=>{}, onError = ()=>{}, interval = 1000, maxRetries = 300 } = options;
    let retries = 0;
    const poll = async () => {
        try {
            const res = await window.inSetu.api.system(`jobs/${jobId}`);
            if (!res.ok) {
                if (res.status === 401) {
                    // Server likely rebooted and rotated its boot token. Attempt a seamless re-handshake.
                    const authRes = await fetch('/auth/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                    if (authRes.ok) {
                        const authData = await authRes.json();
                        sessionStorage.setItem('insetu_boot_token', authData.token);
                        if (window.inSetu.stores.App) window.inSetu.stores.App.setState({ authToken: authData.token });
                    }
                } else if (res.status === 404) {
                    try {
                        const errData = await res.clone().json();
                        if (errData.error === "Job not found") {
                            onError(new Error("Job not found."));
                            return;
                        }
                    } catch(e) {}
                }
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data.status === 'processing' || data.status === 'pending') {
                onProgress(data.message || "Processing...", data);
                if (retries < maxRetries) {
                    retries++;
                    setTimeout(poll, interval);
                } else onError(new Error("Job polling timed out."));
            } else if (data.status === 'completed') {
                onComplete(data);
            } else if (data.status === 'failed') {
                onError(new Error(data.message || "Job failed."));
            }
        } catch (e) {
            // Silent retry for network interruptions and brief 404/502s during reboot
            if (retries < maxRetries) {
                retries++;
                setTimeout(poll, interval);
            } else {
                onError(e);
            }
        }
    };
    setTimeout(poll, 500);
};

// Register SDK primitives
window.inSetu.extensions.InSetuElement = InSetuElement;
window.inSetu.extensions.createExtensionStore = createExtensionStore;
window.inSetu.utils.slugify = function(str) {
    if (!str) return '';
    return window.inSetu.utils.normalizeAccentText(str).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};
window.inSetu.utils.fuzzyFilterObjects = fuzzyFilterObjects;
window.inSetu.utils.normalizeAccentText = normalizeAccentText;
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

// Global backwards compatibility proxies for HTML click handlers and legacy extensions
window.switchTab = (e, tabId) => window.inSetu.sys && window.inSetu.sys.switchTab ? window.inSetu.sys.switchTab(e, tabId) : null;
window.switchSubTab = (subId, forceRefresh, isProgrammatic) => window.inSetu.sys && window.inSetu.sys.switchSubTab ? window.inSetu.sys.switchSubTab(subId, forceRefresh, isProgrammatic) : null;