import { AppStore } from '../store.js';
import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

export const FavoritesStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            items: [],
            loading: false,
            fetchFavorites: async () => {
                set({ loading: true });
                try {
                    const res = await fetch('/api/favorites');
                    if (res.ok) {
                        const data = await res.json();
                        set({ items: data.favorites || [] });
                    }
                } catch (e) {
                    console.error("Failed to fetch favorites", e);
                } finally {
                    set({ loading: false });
                }
            }
        })),
        { name: 'FavoritesStore' }
    )
);

export class InSetuExtFavorites extends LitElement {
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
        this._unsub = FavoritesStore.subscribe(state => {
            this.items = state.items;
            this.loading = state.loading;
        });
        this._unsubWs = AppStore.subscribe(state => state.activeWorkspace, () => {
            FavoritesStore.getState().fetchFavorites();
        });
        FavoritesStore.getState().fetchFavorites();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
        if (this._unsubWs) this._unsubWs();
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
            const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
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
                        .icon=${item.type === 'folder' ? '📁' : '📄'}
                        intentColor="var(--intent-highlight)"
                        @card-clicked=${() => this._navigateToFavorite(item)}>
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
            // Automatically inject quick-pin buttons into all system VFS file cards
            if (data.filepath) {
                const pinBtn = document.createElement('button');
                pinBtn.className = 'btn-sm';
                pinBtn.style.background = 'var(--intent-warning)';
                pinBtn.innerText = '⭐ Pin';
                pinBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const isFolder = data.filepath.endsWith('/') || !data.filepath.includes('.');
                    try {
                        const res = await fetch('/api/favorites/add', {
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
                };
                data.actionsContainer.appendChild(pinBtn);
            }
        },
        'zone:fs-dropdown-menu': (data) => {
            if (data.currentPath && !data.isPrompts) {
                data.menuItems.push({
                    label: 'Pin Current Directory',
                    icon: '⭐',
                    onClick: async () => {
                        try {
                            const res = await fetch('/api/favorites/add', {
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