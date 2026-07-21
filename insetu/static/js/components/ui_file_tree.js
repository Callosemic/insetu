import { LitElement, html, css } from 'lit';
import { buildFileTree } from '../app.js';
import { sharedStyles } from '../shared_styles.js';
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
        _overlayActive: { type: Boolean, reflect: true },
        _hasActions: { type: Boolean, reflect: true, attribute: 'has-actions' }
    };
    static styles = [
        sharedStyles,
        css`
        :host {
            display: block;
            margin-bottom: 12px;
        }
        :host([_overlayactive]) {
            position: relative;
            z-index: 1000;
        }
        .backdrop {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: transparent;
            z-index: -1;
            cursor: default;
        }
        :host([_overlayactive]) .backdrop { display: block; pointer-events: auto; }

        .card-wrapper {
            position: relative;
            z-index: 1; /* Establishes a local stacking context to trap the drawer above the backdrop */
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            display: flex;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            transition: border-color 0.2s;
        }
        :host([_overlayactive]) .card-wrapper {
            border-color: var(--intent-primary, #3b82f6);
            border-bottom-left-radius: 0;
        }
        :host([_overlayactive]) .card-wrapper.overlay-top {
            border-top-left-radius: 0;
            border-bottom-left-radius: 6px;
        }
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 15px;
            padding-right: 15px;
            cursor: pointer;
            min-width: 0;
            border-radius: 6px 0 0 6px;
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            margin-bottom: 8px;
        }
        .card-title {
            font-weight: bold;
            color: var(--intent-primary, #3b82f6);
            font-size: 1.05rem;
            word-break: break-word;
        }
        .card-desc {
            color: var(--text-muted, #888);
            font-size: 0.9rem;
            margin-bottom: 4px;
        }
        .card-detail {
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
            word-break: break-all;
        }
        .trigger-bar {
            width: 22px;
            flex-shrink: 0;
            background: var(--card-intent, var(--intent-neutral, #64748b));
            cursor: pointer;
            transition: filter 0.2s;
            display: none;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
            line-height: 1;
            user-select: none;
        }
        :host([has-actions]) .trigger-bar {
            display: flex;
        }
        .trigger-bar:hover {
            filter: brightness(1.2);
        }
        .trigger-icon {
            transition: transform 0.2s ease;
            margin-top: -2px;
        }
        :host([_overlayactive]) .trigger-icon {
            transform: rotate(180deg);
        }
        .action-overlay {
            position: absolute;
            left: -1px;
            right: 21px; /* Keeps the drawer perfectly out of the trigger bar's vertical path */
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--intent-primary, #3b82f6);
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px 15px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease-in-out, transform 0.15s ease-in-out;
            z-index: 1; /* Elevated above the backdrop to maintain hover events */

            top: calc(100% - 1px);
            border-top: none;
            border-radius: 0 0 6px 6px;
            transform: translateY(-10px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        }
        .action-overlay.position-top {
            top: auto;
            bottom: calc(100% - 1px);
            border-top: 1px solid var(--intent-primary, #3b82f6);
            border-bottom: none;
            border-radius: 6px 6px 0 0;
            transform: translateY(10px);
            box-shadow: 0 -10px 20px rgba(0,0,0,0.3);
        }
        .action-overlay.active {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        :host-context([data-theme="light"]) .action-overlay {
            background: #ffffff;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        :host-context([data-theme="light"]) .action-overlay.position-top {
            box-shadow: 0 -10px 20px rgba(0,0,0,0.1);
        }
        :host-context([data-theme="e-ink"]) .action-overlay {
            background: #ffffff;
            border: 2px solid #8b5cf6;
            border-top: none;
            box-shadow: 4px 4px 0 #14b8a6;
        }
        :host-context([data-theme="e-ink"]) .action-overlay.position-top {
            border-top: 2px solid #8b5cf6;
            border-bottom: none;
            box-shadow: 4px -4px 0 #14b8a6;
        }

        :host-context([data-theme="e-ink"]) .card-wrapper {
            border: 2px solid #8b5cf6;
            box-shadow: 4px 4px 0 #14b8a6;
            background: #ffffff;
            color: #000000;
        }
        :host-context([data-theme="e-ink"]) .card-title {
            color: #000000;
            font-weight: 900;
        }
        :host-context([data-theme="e-ink"]) .card-desc,
        :host-context([data-theme="e-ink"]) .card-detail {
            color: #000000;
            font-weight: 600;
            opacity: 1;
        }
        :host-context([data-theme="e-ink"]) .trigger-bar {
            border-left: 2px solid #000;
        }
    `];
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
        this._overlayActive = false;
        this._hasActions = false;
        this._touchStartX = 0;
        this._docClickListener = this._handleDocumentClick.bind(this);
        this._globalCloseListener = this._handleGlobalClose.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this._docClickListener);
        window.addEventListener('insetu-card-opened', this._globalCloseListener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._docClickListener);
        window.removeEventListener('insetu-card-opened', this._globalCloseListener);
    }

    _handleDocumentClick(e) {
        const path = e.composedPath();
        if (!path.includes(this) && this._overlayActive) {
            this._overlayActive = false;
        }
    }

    _handleGlobalClose(e) {
        if (e.detail.card !== this && this._overlayActive) {
            this._overlayActive = false;
        }
    }
    _openOverlay() {
        this._overlayActive = true;
        window.dispatchEvent(new CustomEvent('insetu-card-opened', { detail: { card: this } }));

        setTimeout(() => {
            const overlay = this.shadowRoot.querySelector('.action-overlay');
            const wrapper = this.shadowRoot.querySelector('.card-wrapper');
            if (!overlay || !wrapper) return;
            const triggerRect = this.getBoundingClientRect();
            const overlayHeight = overlay.offsetHeight || 60;
            if (triggerRect.bottom + overlayHeight > window.innerHeight && triggerRect.top - overlayHeight > 0) {
                overlay.classList.add('position-top');
                wrapper.classList.add('overlay-top');
            } else {
                overlay.classList.remove('position-top');
                wrapper.classList.remove('overlay-top');
            }
        }, 0);
    }

    _handleTouchStart(e) {
        this._touchStartX = e.changedTouches[0].screenX;
    }
    _handleTouchEnd(e) {
        const touchEndX = e.changedTouches[0].screenX;
        const deltaX = this._touchStartX - touchEndX;
        if (deltaX > 40) {
            this._openOverlay();
        } else if (deltaX < -40) {
            this._overlayActive = false;
        }
    }

    updated(changedProperties) {
        if (changedProperties.has('intentColor') && this.intentColor) {
            this.style.setProperty('--card-intent', this.intentColor);
        }
    }
    render() {
        return html`
            <div class="backdrop" @click=${() => this._overlayActive = false}></div>
            <div class="card-wrapper"
                @mouseleave=${() => this._overlayActive = false}
                @touchstart=${this._handleTouchStart}
                @touchend=${this._handleTouchEnd}>

                <div class="main-content" @click=${this._handleMainClick}>
                    <div class="card-header">
                        <span class="card-title">
                            ${this.icon} ${this.titleText}
                        </span>
                        <slot name="header-tags"></slot>
                    </div>
                    ${this.descriptionText ? html`<div class="card-desc">${this.descriptionText}</div>` : ''}
                    ${this.detailText ? html`<div class="card-detail">${this.detailText}</div>` : ''}
                    <slot></slot>
                </div>
                <div class="trigger-bar" 
                    @pointerenter=${(e) => { if (e.pointerType === 'mouse') this._openOverlay(); }}
                    @click=${(e) => { e.stopPropagation();
if (!this._overlayActive) this._openOverlay(); else this._overlayActive = false; }}>
                    <span class="trigger-icon">‹</span>
                </div>
                <div class="action-overlay ${this._overlayActive ? 'active' : ''}"
                    @click=${(e) => { if(e.target.classList.contains('action-overlay') || e.target.tagName === 'BUTTON' || e.target.closest('button')) this._overlayActive = false; }}>
                    ${this._renderDynamicActions()}
                    <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                </div>
            </div>
        `;
        }
        _renderDynamicActions() {
            if (!this.entityType || !window.ExtensionRegistry || !window.ExtensionRegistry.getEntityActions) return '';
            const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});
            if (actions.length > 0) this._hasActions = true;

            return actions.map(act => {
                // Escape hatch for highly reactive state-bound components
                if (act.component) {
                    return html`<div style="display: contents; order: ${act.order || 99};">${act.component(this.entityData)}</div>`;
                }

                const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
                const icon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
                const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');

                if (act.asyncAction) {
                    return html`<insetu-async-btn style="margin: 0; order: ${act.order || 99};" label="${icon} ${label}" intent="${intent}" .onClick=${(e) => act.asyncAction(this.entityData, e)}></insetu-async-btn>`;
                }
                return html`<button class="btn-sm" style="background: var(--intent-${intent}); margin: 0; color: white; border: none; cursor: pointer; order: ${act.order || 99};" @click=${(e) => act.onClick(this.entityData, e)}>${icon} ${label}</button>`;
            });
        }

        _handleSlotChange(e) {
            const nodes = e.target.assignedNodes({ flatten: true });
            if (nodes.some(n => n.nodeType === Node.ELEMENT_NODE)) {
                this._hasActions = true;
            }
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
                    <insetu-category-section titleText=${cat}>
                        ${this.renderCategoryHeader ? this.renderCategoryHeader(cat) : ''}
                        ${categories[cat].map(item => this.renderItem(item))}
                    </insetu-category-section>
                `)}
            </div>
        `;
    }
}

export class InSetuCategorySection extends LitElement {
    static properties = {
        titleText: { type: String }
    };
    static styles = [
        sharedStyles,
        css`
        :host {
            display: block;
}
        .category-heading {
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--text, #e0e0e0);
            border-bottom: 1px solid var(--border, #444);
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    `];

    render() {
        return html`
            <div class="category-heading">
                <span>${this.titleText}</span>
                <slot name="header-actions"></slot>
            </div>
            <div class="category-content">
                <slot></slot>
            </div>
        `;
    }
}
export class InSetuFileTree extends LitElement {
    static properties = {
        files: { type: Array },
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
            for (const p of this.currentPath) {
                if (current[p] && !current[p]._isFile) {
                    current = current[p];
                } else {
                    this.currentPath = [];
                    current = tree;
                    break;
                }
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
                <insetu-standard-toolbar
                    searchPlaceholder=${this.searchPlaceholder}
                    .searchQuery=${this._searchQuery || ''}
                    @search-changed=${(e) => this._searchQuery = e.detail.value}
                    .noPadding=${true}
                    ?bottomBorder=${(!isSearching && this.currentPath.length > 0 && !this.hidePath)}>
                    ${(!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                        <div slot="bottom-row" class="toolbar-row" style="background: var(--input-bg); border-top: 1px solid var(--border);">
                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                            <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentPath.join('/')}</span>
                        </div>
                    ` : ''}
                </insetu-standard-toolbar>
            ` : ((!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                <div class="toolbar-row" style="background: var(--input-bg); border-bottom: 1px solid var(--border);">
                    <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                    <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentPath.join('/')}</span>
                </div>
            ` : '')}
            <div class="tree-container">
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
                        return html`
                            <div class="file-card" style="display: flex; align-items: center; cursor: pointer; flex-shrink: 0; padding: 10px 15px;" @click=${() => this._setPath([...this.currentPath, key])}>
                                <span class="folder-label">📁 ${key}</span>
                            </div>
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
            </div>
        `;
    }
}

customElements.define('insetu-card', InSetuCard);
customElements.define('insetu-categorized-list', InSetuCategorizedList);
customElements.define('insetu-category-section', InSetuCategorySection);
customElements.define('insetu-file-tree', InSetuFileTree);