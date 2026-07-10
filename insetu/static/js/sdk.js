import { LitElement } from 'lit';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

export function createExtensionStore(name, initialState) {
    return createStore(
        devtools(
            subscribeWithSelector((set, get) => ({
                ...initialState,
                resetState: () => set(initialState)
            })),
            { name: `${name}Store` }
        )
    );
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
        return this.tagName.toLowerCase().replace('insetu-ext-', '');
    }

    get api() {
        return {
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

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.extensions.InSetuElement = InSetuElement;
window.inSetu.extensions.createExtensionStore = createExtensionStore;