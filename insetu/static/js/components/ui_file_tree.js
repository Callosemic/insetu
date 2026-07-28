import { LitElement, html, css } from 'lit';
import { buildFileTree } from '../fs.js';
import { sharedStyles } from '../shared_styles.js';
import '../../vendor/yenvui/js/card.js';
import '../../vendor/yenvui/js/card-group.js';
import '../../vendor/yenvui/js/async-btn.js';

export class InSetuCard extends LitElement {
    static properties = {
        filename: { type: String },
        titleText: { type: String },
        descriptionText: { type: String },
        detailText: { type: String },
        icon: { type: String },
        intentColor: { type: String },
        entityType: { type: String },
        entityData: { type: Object },
        selected: { type: Boolean },
        disableSelection: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.filename = '';
        this.titleText = '';
        this.descriptionText = '';
        this.detailText = '';
        this.icon = '📄';
        this.intentColor = '';
        this.entityType = '';
        this.entityData = {};
        this.selected = false;
    }

    connectedCallback() {
        super.connectedCallback();
        const selStore = window.inSetu.stores.Selection;
        if (selStore) {
            this._unsubSel = selStore.subscribe(state => state.selectedItems, items => {
                const id = this.entityData?.filepath || this.entityData?.id || this.filename;
                const isSelected = items.has(id);
                if (this.selected !== isSelected) {
                    this.selected = isSelected;
                }
            });
            const items = selStore.getState().selectedItems;
            this.selected = items.has(this.entityData?.filepath || this.entityData?.id || this.filename);
        }
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsubSel) this._unsubSel();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        // If Lit reuses this DOM node for a different file due to array filtering, 
        // immediately true-up the visual selection state against the store.
        if (changedProperties.has('entityData') || changedProperties.has('filename')) {
            const selStore = window.inSetu.stores.Selection;
            if (selStore) {
                const id = this.entityData?.filepath || this.entityData?.id || this.filename;
                this.selected = selStore.getState().selectedItems.has(id);
            }
        }
    }

    render() {
        const dynActions = this._renderDynamicActions();
        const hasDynActions = Array.isArray(dynActions) ? dynActions.length > 0 : !!dynActions;
        const hasActionsSlot = Array.from(this.children).some(c => c.getAttribute('slot') === 'actions');

        return html`
            <yenvui-card
                .titleText=${this.titleText}
                .descriptionText=${this.descriptionText}
                .detailText=${this.detailText}
                .icon=${this.icon}
                .intentColor=${this.intentColor}
                ?selected=${this.selected}
                ?disableSelection=${this.disableSelection}
                @yenvui-card-select-toggled=${(e) => {
                    e.stopPropagation();
                    const id = this.entityData?.filepath || this.entityData?.id || this.filename;
                    if (window.inSetu.stores.Selection) {
                        window.inSetu.stores.Selection.getState().toggleSelection(id, this.entityType, this.entityData);
                    }
                }}
                @click=${this._handleMainClick}
                style="cursor: pointer;">

                <slot name="header-tags"></slot>
                <slot></slot>
                ${(hasDynActions || hasActionsSlot) ? html`
                    <div slot="actions" style="display: contents;" @click=${e => e.stopPropagation()}>
                        ${dynActions}
                        <slot name="actions"></slot>
                    </div>
                ` : ''}
            </yenvui-card>
        `;
    }

    _renderDynamicActions() {
        if (!this.entityType || !window.ExtensionRegistry || !window.ExtensionRegistry.getEntityActions) return '';
        const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});

        return actions.map(act => {
            if (act.component) {
                return html`<div style="display: contents; order: ${act.order || 99};">${act.component(this.entityData)}</div>`;
            }

            const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
            const icon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');
            let clickHandler;
            if (act.asyncAction) {
                clickHandler = (e) => act.asyncAction(this.entityData, e);
            } else {
                clickHandler = async (e) => {
                    e.stopPropagation();
                    if (act.emitEvent) {
                        const payload = act.emitEvent(this.entityData);
                        if (window.inSetu?.events?.emit) window.inSetu.events.emit(payload.name, payload.detail);
                    } else if (act.onClick) {
                        act.onClick(this.entityData, e);
                    }
                };
            }
            return html`<insetu-async-btn style="margin: 0; order: ${act.order || 99};" label="${icon} ${label}" intent="${intent}" .onClick=${clickHandler}></insetu-async-btn>`;
        });
    }
    _handleMainClick(e) {
        this._overlayActive = false;
        this.dispatchEvent(new CustomEvent('card-clicked', {
            detail: { filename: this.filename, isSource: true }, 
            bubbles: true,
            composed: true
        }));
    }
}
export class InSetuCategorizedList extends LitElement {
    static properties = {
        items: { type: Array },
        categoryKey: { type: String },
        categoryOrder: { type: Array },
        renderItem: { type: Object },
        renderCategoryHeader: { type: Object }
    };
    static styles = [sharedStyles];

    render() {
        if (!this.items || this.items.length === 0) return html``;
        const categories = {};
        this.items.forEach(item => {
            const cat = item[this.categoryKey] || 'Uncategorized';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        const sortedCats = Object.keys(categories).sort((a, b) => {
            const orderArr = this.categoryOrder || [];
            let iA = orderArr.indexOf(a);
            let iB = orderArr.indexOf(b);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });
        return html`
            <div style="display: flex; flex-direction: column;">
                ${sortedCats.map(cat => html`
                    <yenvui-category-section titleText=${cat}>
                        ${this.renderCategoryHeader ? this.renderCategoryHeader(cat) : ''}
                        <yenvui-card-group>
                            ${categories[cat].map(item => this.renderItem(item))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `;
    }
}
export class InSetuFileTree extends LitElement {
    static properties = {
        files: { type: Array },
        currentPath: { type: Array },
        stripPrefix: { type: String },
        basePath: { type: String },
        hideFiles: { type: Boolean },
        hidePath: { type: Boolean },
        enableSearch: { type: Boolean },
        searchPlaceholder: { type: String },
        entityType: { type: String },
        _searchQuery: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; container-type: inline-size; }
        .tree-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
    `];

constructor() {
        super();
        this.files = [];
        this.stripPrefix = '';
        this.basePath = '';
        this.currentPath = [];
        this.hideFiles = false;
        this.hidePath = false;
        this.enableSearch = false;
        this.searchPlaceholder = 'Search...';
        this._searchQuery = '';
}
    _buildTree() {
        const filteredFiles = (this.enableSearch && this._searchQuery)
            ? window.inSetu.utils.fuzzyFilterObjects(this.files, this._searchQuery)
            : this.files;
        const mappedFiles = filteredFiles.map(f => this.stripPrefix ? f.replace(new RegExp('^' + this.stripPrefix), '') : f);
        return buildFileTree(mappedFiles);
    }
    
    _setPath(newPath) {
        this.currentPath = newPath;
        this.requestUpdate();
        this.dispatchEvent(new CustomEvent('path-changed', {
            detail: { path: newPath },
            bubbles: true,
            composed: true
        }));
    }
    render() {
        if (this.files.length === 0) {
            return html`<p style="padding: 20px; color: var(--text-muted); font-style: italic;">No files found.</p>`;
        }

        const isSearching = this.enableSearch && this._searchQuery;

        let current = null;
        let keys = [];
        let flatResults = [];

        // Short-circuit the hierarchical tree generation if we are actively searching
        if (isSearching) {
            const filteredFiles = window.inSetu.utils.fuzzyFilterObjects(this.files, this._searchQuery);
            flatResults = filteredFiles.map(f => this.stripPrefix ? f.replace(new RegExp('^' + this.stripPrefix), '') : f);
        } else {
            const tree = this._buildTree();
            current = tree;
            const validPath = [];
            for (const p of (this.currentPath || [])) {
                if (current[p] && !current[p]._isFile) {
                    current = current[p];
                    validPath.push(p);
                } else {
                    break;
                }
            }
            if (validPath.length !== (this.currentPath || []).length) {
                this.currentPath = validPath;
            }
            keys = Object.keys(current).filter(k => k !== '_isFile').sort((a, b) => {
                const aIsDir = !current[a]._isFile;
                const bIsDir = !current[b]._isFile;
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.localeCompare(b);
            });
        }
        return html`
            ${this.enableSearch ? html`
                <yenvui-toolbar
                    searchPlaceholder=${this.searchPlaceholder}
                    .searchQuery=${this._searchQuery || ''}
                    @search-changed=${(e) => this._searchQuery = e.detail.value}
                    ?bottomBorder=${(!isSearching && this.currentPath.length > 0 && !this.hidePath)}>
                    ${(!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                        <div slot="bottom-row" class="toolbar-row" style="background: var(--input-bg); border-top: 1px solid var(--border);">
                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                            <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentPath.join('/')}</span>
                        </div>
                    ` : ''}
                </yenvui-toolbar>
            ` : ((!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                <div class="toolbar-row" style="background: var(--input-bg); border-bottom: 1px solid var(--border);">
                    <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                    <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentPath.join('/')}</span>
                </div>
            ` : '')}
            <div class="tree-container">
                <yenvui-card-group>
                ${isSearching ? flatResults.map(filepath => {
                    const key = filepath.split('/').pop();
                    const fullFilepath = `${this.basePath}${filepath}`;
                    if (this.hideFiles) return '';
                    return html`
                        <insetu-card
                            .filename=${fullFilepath}
                            .detailText=${fullFilepath}
                            .titleText=${key}
                            descriptionText=""
                            intentColor="var(--intent-primary)"
                            icon="📄"
                            .entityType=${this.entityType || 'file'}
                            .entityData=${{ filepath: fullFilepath, isFS: true }}>
                        </insetu-card>
                    `;
                }) : keys.map(key => {
                    const item = current[key];
                    const isDir = !item._isFile;
                    if (!isDir && (key === '.gitkeep' || key === '.keep')) return '';
                    if (isDir) {
                        const pathPrefix = this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';
                        const folderPath = `${this.basePath}${pathPrefix}${key}`;
                        return html`
                            <insetu-card
                                .titleText=${key}
                                icon="📁"
                                intentColor="var(--intent-warning)"
                                .entityType=${'folder'}
                                .entityData=${{ id: folderPath, folderpath: folderPath, isDir: true }}
                                @card-clicked=${(e) => { e.stopPropagation(); this._setPath([...this.currentPath, key]); }}>
                            </insetu-card>
                        `;
                    }
                    const pathPrefix = this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';
                    const filepath = `${this.basePath}${pathPrefix}${key}`;
                    if (this.hideFiles) return '';
                    return html`
                        <insetu-card
                            .filename=${filepath}
                            .detailText=${filepath}
                            .titleText=${key}
                            descriptionText=""
                            intentColor="var(--intent-primary)"
                            icon="📄"
                            .entityType=${this.entityType || 'file'}
                            .entityData=${{ filepath, isFS: true }}>
                        </insetu-card>
                    `;
                })}
                </yenvui-card-group>
            </div>
        `;
    }
}

customElements.define('insetu-card', InSetuCard);
customElements.define('insetu-categorized-list', InSetuCategorizedList);
customElements.define('insetu-file-tree', InSetuFileTree);