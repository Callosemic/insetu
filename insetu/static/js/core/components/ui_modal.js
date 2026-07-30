import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../../../vendor/sutram/shared_styles.js';
import { InSetuElement } from '../sdk.js';
import '../../../vendor/yenvui/js/modal.js';
export class InSetuModal extends LitElement {
    static properties = {
        titleText: { type: String },
        open: { type: Boolean, reflect: true },
        maxWidth: { type: String },
        fullscreen: { type: Boolean, reflect: true },
        flush: { type: Boolean, reflect: true }
    };
    static styles = [sharedStyles, css`
        :host { display: contents; }
        /* Catch slotted buttons at this boundary before they pass into yenVUI */
        ::slotted(button[slot="footer"]) { 
            flex: 1; 
            margin: 0 !important; 
            padding: 12px !important; 
            border-radius: 6px !important; 
            font-size: 1.05rem !important; 
            font-weight: bold !important; 
            border: none !important; 
            cursor: pointer; 
        }
        ::slotted(insetu-async-btn[slot="footer"]),
        ::slotted(sutram-async-btn[slot="footer"]),
        ::slotted(yenvui-async-btn[slot="footer"]) {
            flex: 1;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            display: block;
            --btn-padding: 12px;
            --btn-font-size: 1.05rem;
            --btn-border-radius: 6px;
        }
    `];
    constructor() {
        super();
        this.open = false;
    }
    close(e) {
        // Allow imperative calls and direct yenVUI signals, but block nested child bubbling
        if (e && e.target && e.target !== e.currentTarget && e.target.tagName !== 'YENVUI-MODAL') return;
        const event = new CustomEvent('modal-closing', { bubbles: true, composed: true, cancelable: true });
        this.dispatchEvent(event);
        if (event.defaultPrevented) return;
        this.open = false;
        this.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true, composed: true }));
    }
    render() {
        return html`
            <yenvui-modal 
                ?open=${this.open}
                .titleText=${this.titleText}
                .maxWidth=${this.maxWidth}
                ?fullscreen=${this.fullscreen}
                ?flush=${this.flush}
                @yenvui-modal-closed=${this.close}>
                <slot name="body" slot="body"></slot>
                <slot></slot>
                <slot name="footer" slot="footer"></slot>

            </yenvui-modal>
        `;
    }
}
customElements.define('insetu-modal', InSetuModal);
export class InSetuSelectorModal extends InSetuElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        titleText: { type: String },
        items: { type: Array },
        _searchQuery: { type: String }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];
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
            <yenvui-modal ?open=${this.open} titleText=${this.titleText} @yenvui-modal-closed=${() => { this.open = false; this.dispatchEvent(new CustomEvent('selector-closed')); }}>
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
            </yenvui-modal>
        `;
    }
}
customElements.define('insetu-selector-modal', InSetuSelectorModal);