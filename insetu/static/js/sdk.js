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
        const getWs = () => {
            if (window.inSetu?.stores?.App) return window.inSetu.stores.App.getState().activeWorkspace || 'default';
            return sessionStorage.getItem('insetu_workspace') || localStorage.getItem('insetu_workspace') || 'default';
        };

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

export class InSetuElement extends LitElement {
    static properties = {
        workspaceId: { type: String }
    };

    constructor() {
        super();
        this.workspaceId = window.inSetu?.stores?.App?.getState()?.activeWorkspace || 'default';
        this._storeUnsubs = [];
    }
    get extName() {
        // 1. Explicit static class definition (Strict OOP)
        if (this.constructor.extensionName) return this.constructor.extensionName;

        // 2. Contextual DOM Inheritance (Inherit from parent extension view)
        const parentExt = this.closest('[data-ext]');
        if (parentExt && parentExt.dataset.ext) return parentExt.dataset.ext;

        // 3. Fallback to tag name inference (Legacy support)
        const inferred = this.tagName.toLowerCase().replace('insetu-ext-', '');

        // Throw a warning so the developer knows to fix their component
        if (inferred && !this.tagName.toLowerCase().startsWith('insetu-ext-')) {
            console.warn(`[SDK Warning] Component <${this.tagName.toLowerCase()}> is relying on implicit tag-name routing and may fail. Please define 'static extensionName = "${inferred}";' on the class.`);
        }

        return inferred;
    }
    get utils() {
        return {
            fuzzyFilterObjects: window.inSetu.utils.fuzzyFilterObjects,
            normalizeAccentText: window.inSetu.utils.normalizeAccentText,
            pollJob: window.inSetu.utils.pollJob,
            slugify: window.inSetu.utils.slugify
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

// Define the Job Polling Subroutine
window.inSetu.utils.pollJob = function(jobId, options = {}) {
    const { onProgress = ()=>{}, onComplete = ()=>{}, onError = ()=>{}, interval = 1000, maxRetries = 300 } = options;
    let retries = 0;
    const poll = async () => {
        try {
            const res = await window.inSetu.api.system(`jobs/${jobId}`);
            if (!res.ok) {
                if (res.status === 404) return onError(new Error("Job not found (404)."));
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
            onError(e);
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