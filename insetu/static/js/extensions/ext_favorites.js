import { AppStore } from '../store.js';
import { html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';

export const FavoritesStore = createExtensionStore('Favorites', {
    items: [],
    loading: false,
    fetchFavorites: async () => {
        FavoritesStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace('favorites/list');
            if (res.ok) {
                const data = await res.json();
                FavoritesStore.setState({ items: data.favorites || [] });
            }
        } catch (e) {
            console.error("Failed to fetch favorites", e);
        } finally {
            FavoritesStore.setState({ loading: false });
        }
    }
});
export class InSetuFavBtn extends InSetuElement {
    static properties = { filepath: { type: String }, _isPinned: { type: Boolean }, _favId: { type: String } };
    static styles = [sharedStyles];

    constructor() { super(); this._isPinned = false; this._favId = null; }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(FavoritesStore, state => {
            const fav = state.items.find(i => i.path === this.filepath);
            this._isPinned = !!fav;
            this._favId = fav ? fav.id : null;
        });
    }

    async _toggle(e) {
        e.stopPropagation();
        if (this._isPinned && this._favId) {
            FavoritesStore.setState(state => ({ items: state.items.filter(item => item.id !== this._favId) }));
            const res = await this.api.delete(this._favId);
            if (!res.ok) FavoritesStore.getState().fetchFavorites();
        } else {
            const isFolder = this.filepath.endsWith('/') || !this.filepath.includes('.');
            const tempId = 'temp_' + Date.now();
            const newItem = { id: tempId, path: this.filepath, type: isFolder ? 'folder' : 'file', name: this.filepath.split('/').pop() || this.filepath };
            FavoritesStore.setState(state => ({ items: [...state.items, newItem] }));

            const res = await this.api.post('add', newItem);
            if (res.ok) {
                FavoritesStore.getState().fetchFavorites();
            } else {
                FavoritesStore.setState(state => ({ items: state.items.filter(item => item.id !== tempId) }));
            }
        }
    }

    render() {
        return html`
            <button class="btn-sm" 
                style="background: transparent; border: none; font-size: 1.2rem; padding: 0 4px; margin: 0 5px 0 0; box-shadow: none; color: ${this._isPinned ? 'var(--intent-warning)' : 'var(--text-muted)'};"
                title="${this._isPinned ? 'Unpin' : 'Pin'}"
                @click=${this._toggle}>
                ${this._isPinned ? '⭐' : '☆'}
            </button>
        `;
    }
}
customElements.define('insetu-fav-btn', InSetuFavBtn);

export class InSetuExtFavorites extends InSetuElement {
    static properties = {
        items: { type: Array },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.items = [];
        this.loading = false;
    }
    connectedCallback() {
        super.connectedCallback();
        // InSetuElement SDK automatically tracks and destroys this subscription on unmount
        this.subscribe(FavoritesStore, state => {
            this.items = state.items;
            this.loading = state.loading;
        });
        FavoritesStore.getState().fetchFavorites();
    }

    // InSetuElement SDK lifecycle hook for stateless tenant swaps
    onWorkspaceChanged(newWorkspaceId) {
        FavoritesStore.getState().fetchFavorites();
    }

    _navigateToFavorite(item) {
        if (item.type === 'file') {
            if (window.viewSourceFile) window.viewSourceFile(item.path, true);
        } else if (item.type === 'folder') {
            const parts = item.path.split('/').filter(p => p);
            AppStore.setState({ globalBrowsePath: parts });
            if (window.switchTab) window.switchTab(null, 'edit');
            if (window.switchSubTab) window.switchSubTab('files');
        }
    }
    async _removeFavorite(e, id) {
        e.stopPropagation();

        // Eagerly splice the element out of the local store for an immediate O(1) visual transition
        FavoritesStore.setState(state => ({
            items: state.items.filter(item => item.id !== id)
        }));

        // Fire transaction off to backend asynchronously
        const res = await this.api.delete(id);
        if (!res.ok) {
            // Re-fetch from DB cache to natively heal state tree if transaction bounds crash
            FavoritesStore.getState().fetchFavorites();
            console.error("Failed to safely delete favorite token on disk.");
        }
    }

    render() {
        if (this.loading) return html`<div class="spinner" style="display:block;">Loading bookmarks...</div>`;
        if (this.items.length === 0) return html`<p style="color: var(--text-muted); font-style: italic;">No favorited nodes pinned yet. Pin nodes from the file tree views!</p>`;

        return html`
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${this.items.map(item => html`
                    <insetu-card
                        .filename=${item.path}
                        .titleText=${item.name}
                        .descriptionText=${item.path}
                        icon=${item.type === 'folder' ? '📁' : '📄'}
                        intentColor="var(--intent-highlight)"
                        @card-clicked=${() => this._navigateToFavorite(item)}>
                        <insetu-file-actions slot="actions" .filepath=${item.path} .isFS=${true}></insetu-file-actions>
                        <insetu-async-btn 
                            slot="actions" 
                            label="❌ Unpin" 
                            intent="danger" 
                            .onClick=${(e) => this._removeFavorite(e, item.id)}>
                        </insetu-async-btn>
                    </insetu-card>
                `)}
            </div>
        `;
    }
}
customElements.define('insetu-ext-favorites', InSetuExtFavorites);

// Declarative OS Extension Mapping
window.ExtensionRegistry.registerExtension('favorites', {
    name: "Favorites Bar",
    version: "1.0.0",
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "favorites",
            label: "⭐ Faves",
            order: 0,
            component: "insetu-ext-favorites"
        }
    ],
    uiHooks: {
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'edit' && data.subId === 'favorites') {
                FavoritesStore.getState().fetchFavorites();
            }
        },
        'zone:file-card-actions': (data) => {
            // Prevent inception: Do not render the Pin button if we are inside the Favorites sub-tab
            const appState = window.inSetu?.stores?.App?.getState();
            if (appState?.activeSubTabs?.edit === 'favorites') return null;

            if (data.filepath) {
                return html`<insetu-fav-btn slot="actions" .filepath=${data.filepath}></insetu-fav-btn>`;
            }
            return null;
        },
        'zone:fs-dropdown-menu': (data) => {
            if (data.currentPath && !data.isPrompts) {
                data.menuItems.push({
                    label: 'Pin Current Directory',
                    icon: '⭐',
                    onClick: async () => {
                        const res = await window.inSetu.api.workspace('favorites/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                path: data.currentPath,
                                type: 'folder',
                                name: data.currentPath.split('/').pop() || data.currentPath
                            })
                        });
                        if (!res.ok) throw new Error("Failed to pin");
                        FavoritesStore.getState().fetchFavorites();
                    }
                });
            }
            return false;
        }
    }
});