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