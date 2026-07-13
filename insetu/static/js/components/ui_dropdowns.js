import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { InSetuElement } from '../sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export class InSetuDropdown extends LitElement {
    static properties = {
        items: { type: Array },
        open: { type: Boolean, reflect: true },
        align: { type: String }
    };

    static styles = css`
        .dropdown-menu {
            position: absolute;
            top: calc(100% + 5px);
            background: var(--pane-bg, #1e1e1e);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        :host([align="left"]) .dropdown-menu { left: 0; right: auto; }
        :host([align="right"]) .dropdown-menu { right: 0; left: auto; }
        :host(:not([align])) .dropdown-menu { right: 0; left: auto; }

        .divider { height: 1px; background: var(--border, #444); margin: 4px 0; }
        .menu-item {
            background: transparent; color: var(--text, #e0e0e0); text-align: left; 
            padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; 
            font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; 
            align-items: center; gap: 8px; width: 100%; box-sizing: border-box;
        }
        .menu-item:hover { background: var(--input-bg, #2d2d2d); }
        .icon { font-size: 1.1rem; line-height: 1; }
    `;

    constructor() {
        super();
        this.items = [];
        this.open = false;
        this.align = 'right';
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this._handleOutsideClick);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._handleOutsideClick);
    }

    _handleOutsideClick(e) {
        if (!this.open) return;
        const path = e.composedPath();
        if (!path.includes(this)) {
            this.open = false;
        }
    }

    _toggle(e) {
        this.open = !this.open;
    }

    _executeItem(item, e) {
        this.open = false;
        if (item.onClick) item.onClick(e);
    }

    render() {
        return html`
            <div style="position: relative; display: inline-block; width: 100%;">
                <div @click=${this._toggle}>
                    <slot name="trigger"></slot>
                </div>
                ${this.open && this.items && this.items.length > 0 ? html`
                    <div class="dropdown-menu">
                        ${this.items.map(item => item.divider ? html`<div class="divider"></div>` : html`
                            <button class="menu-item" @click=${(e) => this._executeItem(item, e)}>
                                ${item.icon ? html`<span class="icon">${item.icon}</span>` : ''}
                                <span>${item.label}</span>
                            </button>
                        `)}
                    </div>
                ` : ''}
            </div>
        `;
    }
}
customElements.define('insetu-dropdown', InSetuDropdown);

export class InSetuSelectorModal extends InSetuElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        titleText: { type: String },
        items: { type: Array },
        _searchQuery: { type: String }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.open = false;
        this.titleText = "Select Item";
        this.items = [];
        this._searchQuery = '';
    }
    render() {
        const filtered = this._searchQuery 
            ? this.utils.fuzzyFilterObjects(this.items, this._searchQuery).slice(0, 50) 
            : this.items.slice(0, 50);

        return html`
            <insetu-modal ?open=${this.open} titleText=${this.titleText} @modal-closed=${() => { this.open = false; this.dispatchEvent(new CustomEvent('selector-closed')); }}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <input type="text" placeholder="Search..." .value=${this._searchQuery} @input=${e => this._searchQuery = e.target.value} style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 10px; flex-shrink: 0;">

                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${filtered.length === 0 ? html`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>` : filtered.map(item => {
                            const displayText = typeof item === 'string' && item.startsWith('prompts/') ? item.substring(8) : (item.label || item);
                            return html`
                                <button class="btn-sm" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px; transition: background 0.2s;"
                                    onmouseover="this.style.background='var(--input-bg)'"
                                    onmouseout="this.style.background='var(--bg)'"
                                    @click=${() => {
                                        this.open = false;
                                        this.dispatchEvent(new CustomEvent('item-selected', { detail: { item }, bubbles: true, composed: true }));
                                    }}>
                                    📄 ${displayText}
                                </button>
                            `;
                        })}
                    </div>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-selector-modal', InSetuSelectorModal);