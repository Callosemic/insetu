import { html, css } from 'lit';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';

const AppStore = window.inSetu.stores.App;

export const FavoritesStore = createExtensionStore('Favorites', {
    items: [],
    loading: false,
    fetchFavorites: async () => {
        // Guardrail: Short-circuit the fetch if the extension is not enabled for the active tenant workspace
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('favorites')) {
            FavoritesStore.setState({ items: [], loading: false });
            return;
        }
        FavoritesStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.get('favorites/list');
            if (res.ok) {
                const data = await res.json();
                FavoritesStore.setState({ items: data.favorites || [] });
            } else if (res.status === 403) {
                // Gracefully ignore 403s during tenant hot-swaps before unmount
                FavoritesStore.setState({ items: [] });
            }
        } catch (e) {
            console.error("Failed to fetch favorites", e);
        } finally {
            FavoritesStore.setState({ loading: false });
        }
    },
    addFavorite: async (targetPath, typeOverride = null) => {
        const isFolder = typeOverride === 'folder' || targetPath.endsWith('/') || !targetPath.includes('.');
        const type = typeOverride || (isFolder ? 'folder' : 'file');
        const name = targetPath.split('/').pop() || targetPath;
        const tempId = 'temp_' + Date.now();
        const newItem = { 
            id: tempId, 
            path: targetPath,
            folderpath: isFolder ? targetPath : undefined,
            filepath: !isFolder ? targetPath : undefined,
            type, 
            name 
        };

        FavoritesStore.setState(state => ({ items: [...state.items, newItem] }));
        try {
            const res = await window.inSetu.api.post('favorites/add', newItem);
            if (res.ok) {
                const data = await res.json().catch(()=>({}));
                if (data.job_id !== 'offline_queue') {
                    FavoritesStore.getState().fetchFavorites();
                }
            } else {
                FavoritesStore.setState(state => ({ items: state.items.filter(item => item.id !== tempId) }));
            }
        } catch (e) {
            console.error("Failed to add favorite", e);
            FavoritesStore.setState(state => ({ items: state.items.filter(item => item.id !== tempId) }));
        }
    },
    removeFavorite: async (id) => {
        FavoritesStore.setState(state => ({
            items: state.items.filter(item => item.id !== id)
        }));

        try {
            const res = await window.inSetu.api.post(`favorites/delete/${id}`, {});
            if (!res.ok) {
                FavoritesStore.getState().fetchFavorites();
                console.error("Failed to safely delete favorite token on disk.");
            }
        } catch (e) {
            FavoritesStore.getState().fetchFavorites();
            console.error("Network error deleting favorite", e);
        }
    }
});
export class InSetuFavBtn extends InSetuElement {
    static get extensionName() { return 'favorites'; }
    get extName() { return 'favorites'; }

    static properties = { filepath: { type: String }, folderpath: { type: String }, _isPinned: { type: Boolean }, _favId: { type: String } };
    static styles = [sharedStyles];

    constructor() { super(); this._isPinned = false; this._favId = null; }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(FavoritesStore, state => this._evaluateState(state));
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') || changedProperties.has('folderpath')) {
            this._evaluateState(FavoritesStore.getState());
        }
    }
    _evaluateState(state) {
        const targetPath = this.folderpath || this.filepath;
        if (!targetPath) return;
        const fav = state.items.find(i => i.path === targetPath);
        this._isPinned = !!fav;
        this._favId = fav ? fav.id : null;
    }
    async _toggle(e) {
        e.stopPropagation();
        if (this._isPinned && this._favId) {
            await FavoritesStore.getState().removeFavorite(this._favId);
        } else {
            const targetPath = this.folderpath || this.filepath;
            await FavoritesStore.getState().addFavorite(targetPath, this.folderpath ? 'folder' : 'file');
        }
    }
    render() {
        return html`
            <button class="btn-sm" 
                style="background: var(--input-bg); border: 1px solid var(--border); font-size: 1.1rem; padding: 4px 8px; margin: 0 5px 0 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); color: ${this._isPinned ? 'var(--intent-warning)' : 'var(--text-muted)'};"
                title="${this._isPinned ? 'Unpin' : 'Pin'}"
                @click=${this._toggle}>
                ${this._isPinned ? '⭐' : '☆'}
            </button>
        `;
    }
}
customElements.define('insetu-fav-btn', InSetuFavBtn);
export class InSetuExtFavorites extends InSetuElement {
    static get extensionName() { return 'favorites'; }
    static properties = {
        items: { type: Array },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
        .favorites-body { flex: 1; overflow-y: auto; padding: 20px; }
    `];

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
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            FavoritesStore.getState().fetchFavorites();
        });
        FavoritesStore.getState().fetchFavorites();
    }
    // InSetuElement SDK lifecycle hook for stateless tenant swaps
    onWorkspaceLoad(workspaceId) {
        FavoritesStore.getState().fetchFavorites();
    }

    onForceRefresh() {
        FavoritesStore.getState().fetchFavorites();
    }

    _navigateToFavorite(item) {
        if (item.type === 'file') {
            const isContext = item.path.startsWith('ctx://') || item.path.endsWith('_context.txt') || item.path.endsWith('_diffs.txt') || item.path.includes('workflow_');

            if (!isContext && this.vfs && this.vfs.viewSourceFile) {
                this.vfs.viewSourceFile(item.path, true);
            } else if (isContext && this.vfs && this.vfs.viewAndCopy) {
                this.vfs.viewAndCopy(item.path);
            }
        } else if (item.type === 'folder') {
            const parts = item.path.replace(/^vfs:\/\//, '').split('/').filter(p => p);
            AppStore.getState().setActiveRoute('edit', 'files', parts);
        }
    }
    render() {
        if (this.items.length === 0 && !this.loading) return html`<div class="favorites-body"><p style="color: var(--text-muted); font-style: italic; margin: 0;">No favorited nodes pinned yet. Pin nodes from the file tree views!</p></div>`;

        return html`
            <div class="favorites-body" style="display: flex; flex-direction: column; gap: 8px;">
                ${this.loading ? html`<sutram-spinner text="Loading bookmarks..."></sutram-spinner>` : ''}
                <div style="display: flex; flex-direction: column; gap: 8px; opacity: ${this.loading ? '0.6' : '1'}; transition: opacity 0.2s ease; pointer-events: ${this.loading ? 'none' : 'auto'};">
                ${this.items.map(item => {
                    const isContext = item.type === 'file' && (item.path.startsWith('ctx://') || item.path.endsWith('_context.txt') || item.path.endsWith('_diffs.txt') || item.path.includes('workflow_'));
                    const eType = item.type === 'folder' ? 'folder' : (isContext ? 'file:context' : 'file');
                    const displayPath = item.path.replace(/^vfs:\/\//, '');
                    return html`
                    <insetu-card
                        .filename=${displayPath}
                        .titleText=${item.name}
                        .descriptionText=${item.path}
                        icon=${item.type === 'folder' ? '📁' : (isContext ? '📦' : '📄')}
                        intentColor="var(--intent-highlight)"
                        entityType=${eType}
                        .entityData=${{ filepath: item.path, repoDir: displayPath.split('/')[0], isFS: !isContext }}
                        @card-clicked=${() => this._navigateToFavorite(item)}>
                    </insetu-card>
                    `;
                })}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-ext-favorites', InSetuExtFavorites);

// Declarative OS Extension Mapping
window.ExtensionRegistry.registerExtension('favorites', {
    name: "Favorites Bar",
    version: "1.0.0",
    offline_mode: "full",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'fave_toggle_file',
            order: -1, // Pinned to the far left
            component: (data) => html`<insetu-fav-btn .filepath=${data.filepath}></insetu-fav-btn>`
        },
        {
            targetEntity: 'repo',
            id: 'fave_toggle_repo',
            order: -1,
            component: (data) => html`<insetu-fav-btn .filepath=${data.filepath || data.repoDir}></insetu-fav-btn>`
        },
        {
            targetEntity: 'folder',
            id: 'fave_toggle_folder',
            order: -1,
            component: (data) => html`<insetu-fav-btn .folderpath=${data.folderpath || data.filepath}></insetu-fav-btn>`
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "favorites",
            label: "⭐ Faves",
            order: 0,
            component: "insetu-ext-favorites"
        }
    ]
});