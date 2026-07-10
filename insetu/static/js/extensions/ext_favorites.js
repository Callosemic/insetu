import { AppStore } from '../store.js';
import { html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createExtensionStore, InSetuElement } from '../app.js';

export const FavoritesStore = createExtensionStore('Favorites', {
    items: [],
    loading: false,
    fetchFavorites: async () => {
        FavoritesStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace('favorites');
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
        try {
            // InSetuElement SDK automatically routes to /api/<workspace_id>/favorites/<id>
            const res = await this.api.delete(id);
            if (res.ok) FavoritesStore.getState().fetchFavorites();
        } catch (e) {
            alert("Failed to delete favorite token.");
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
                        <button slot="actions" class="btn-sm" style="background: var(--intent-danger);" @click=${(e) => this._removeFavorite(e, item.id)}>❌ Unpin</button>
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
            if (localStorage.getItem('insetu_subtab_edit') === 'favorites') return null;

            // Declaratively inject quick-pin buttons into all system VFS file cards
            if (data.filepath) {
                return html`
                    <button slot="actions" class="btn-sm" style="background: var(--intent-warning); margin: 0 5px 0 0;" @click=${async (e) => {
                        e.stopPropagation();
                        const isFolder = data.filepath.endsWith('/') || !data.filepath.includes('.');
                        try {
                            const res = await window.inSetu.api.workspace('favorites/add', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    path: data.filepath,
                                    type: isFolder ? 'folder' : 'file',
                                    name: data.filepath.split('/').pop() || data.filepath
                                })
                            });
                            if (res.ok) alert("Node pinned securely into Favorites matrix!");
                        } catch (err) {
                            console.error(err);
                        }
                    }}>⭐ Pin</button>
                `;
            }
            return null;
        },
        'zone:fs-dropdown-menu': (data) => {
            if (data.currentPath && !data.isPrompts) {
                data.menuItems.push({
                    label: 'Pin Current Directory',
                    icon: '⭐',
                    onClick: async () => {
                        try {
                            const res = await window.inSetu.api.workspace('favorites/add', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    path: data.currentPath,
                                    type: 'folder',
                                    name: data.currentPath.split('/').pop() || data.currentPath
                                })
                            });
                            if (res.ok) {
                                alert("Directory pinned securely into Favorites matrix!");
                                FavoritesStore.getState().fetchFavorites();
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                });
            }
            return false;
        }
    }
});