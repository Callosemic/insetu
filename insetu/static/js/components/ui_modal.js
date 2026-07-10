import { LitElement, html, css } from 'lit';
export class InSetuModal extends LitElement {
    static properties = {
        titleText: { type: String },
        open: { type: Boolean, reflect: true },
        maxWidth: { type: String },
        fullscreen: { type: Boolean, reflect: true }
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
        }
        .panel {
            background: var(--bg);
            border: 1px solid var(--border); border-radius: 8px;
            width: 100%; max-height: 85dvh; display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); box-sizing: border-box; margin: 0 auto;
        }
        :host([maxWidth="100vw"]) .panel,
        :host([fullscreen]) .panel {
            max-height: 100dvh !important;
            height: 100dvh !important;
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
            <div class="backdrop" @mousedown=${(e) => { if(e.target.classList.contains('backdrop')) this.close(); }}>
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