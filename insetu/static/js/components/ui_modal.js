import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { InSetuElement } from '../sdk.js';

export class InSetuModal extends LitElement {
    static properties = {
        titleText: { type: String },
        open: { type: Boolean, reflect: true },
        maxWidth: { type: String },
        fullscreen: { type: Boolean, reflect: true },
        zIndex: { type: Number }
    };
    static styles = css`
        .backdrop {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100dvh;
            background: rgba(0,0,0,0.85); z-index: 1000;
            align-items: center; justify-content: center; flex-direction: column;
            padding: 15px; box-sizing: border-box;
        }
        :host([open]) .backdrop { display: flex; }
        :host([maxWidth="100vw"]) .backdrop,
        :host([fullscreen]) .backdrop {
            padding: 0 !important;
            height: calc(100dvh - 30px) !important;
        }
        .panel {
            background: var(--bg);
            border: 1px solid var(--border); border-radius: 8px;
            width: 100%; max-height: 85dvh; display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); box-sizing: border-box; margin: 0 auto;
        }
        :host([maxWidth="100vw"]) .panel,
        :host([fullscreen]) .panel {
            max-height: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            border: none !important;
        }
        .header {
            padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--input-bg);
            border-top: 4px solid var(--intent-primary); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
        }
        .header h3 { margin: 0; font-size: 1.2rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 15px; }
        .footer { padding: 0; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; flex-shrink: 0; }
::slotted([slot="footer"]) { display: flex; width: 100%;
}
.btn-sm { background: var(--intent-neutral); color: white; border: none; padding: 0 14px;
font-size: 14px; border-radius: 4px; cursor: pointer; margin: 0; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
`;
constructor() {
        super();
        this.open = false;
    }
    close() {
        const event = new CustomEvent('modal-closing', { bubbles: true, composed: true, cancelable: true });
        this.dispatchEvent(event);
        if (event.defaultPrevented) return;
        this.open = false;
        this.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true, composed: true }));
    }
    render() {
        return html`
            <div class="backdrop" style="z-index: ${this.zIndex || 1000};" @mousedown=${(e) => { if(e.target.classList.contains('backdrop')) this.close(); }}>
                <div class="panel" style="max-width: ${this.maxWidth || '600px'}">
                    <div class="header">
                        <h3>${this.titleText}</h3>
                        <button class="btn-sm" @click=${this.close}>Back</button>
                    </div>
                    <div class="body">
                        <slot name="body"></slot>
                    </div>
                    <div class="footer">
                        <slot name="footer"></slot>
                    </div>
                </div>
            </div>
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