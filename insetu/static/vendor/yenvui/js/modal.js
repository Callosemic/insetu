import{LitElement as i,html as a,css as n}from"lit";export class YenvuiModal extends i{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},maxWidth:{type:String},fullscreen:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},transparent:{type:Boolean,reflect:!0},_hasFooter:{type:Boolean,state:!0}};static styles=n`
        :host { display: contents; } /* Native dialog handles its own visibility. Host must remain permeable. */
        dialog {
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-radius: 8px;
            padding: 0;
            width: 100%;
            max-width: var(--modal-max-width, 600px);
            max-height: 85dvh;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            display: none; /* Hide when not open */
            overflow: hidden;
            margin: auto; /* Centers natively in the #top-layer */
            box-sizing: border-box;
        }

        dialog[open] {
            display: grid; /* Bypass Safari flex collapse bug */
            grid-template-rows: auto minmax(0, 1fr) auto;
        }
        :host([fullscreen]) dialog {
            max-width: 100%;
            width: 100%;
            max-height: calc(100dvh - 30px);
            height: calc(100dvh - 30px);
            margin-bottom: 30px;
            border-radius: 0;
            border: none;
        }
        /* Native Backdrop Styling replacing manual DOM overlays */
        dialog::backdrop {
            background: var(--modal-backdrop, rgba(0, 0, 0, 0.75));
            backdrop-filter: var(--modal-backdrop-filter, blur(3px));
        }
        :host([transparent]) dialog::backdrop,
        :host([fullscreen]) dialog::backdrop {
            background: transparent !important;
            backdrop-filter: none !important;
        }

        .header {
            padding: 12px 20px;
            border-bottom: 1px solid var(--border, #444);
            background: var(--input-bg, #2d2d2d);
            border-top: 4px solid var(--intent-primary, #3b82f6);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            min-width: 0;
            width: 100%;
            box-sizing: border-box;
        }

        .header h3 {
            margin: 0;
            font-size: 1.2rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
            flex: 1;
            margin-right: 15px;
        }
        .close-btn {
            background: var(--intent-neutral, #64748b);
            color: #ffffff;
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85rem;
            transition: filter 0.2s, background 0.2s;
            flex-shrink: 0;
        }

        .close-btn:hover {
            filter: brightness(1.2);
        }

        :host([data-theme="e-ink"]) .close-btn {
            background: #ffffff;
            color: #000000;
            border: 2px solid #000000;
            box-shadow: 2px 2px 0 #000000;
        }

        :host([data-theme="e-ink"]) .close-btn:hover {
            background: var(--bg-hover, #f1f5f9);
            filter: none;
        }
        .body {
            padding: 20px;
            overflow-y: auto;
            min-height: 0; /* Prevents vertical grid blowout */
            min-width: 0; /* Prevents horizontal grid blowout */
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 15px;
            -webkit-overflow-scrolling: touch; /* Momentum scrolling for iOS */
            container-type: inline-size;
        }
        :host([flush]) .body {
            padding: 0;
            gap: 0;
        }
        .footer {
            padding: 12px 20px;
            gap: 12px;
            border-top: 1px solid var(--border, #444);
            background: var(--input-bg, #2d2d2d);
            display: flex;
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
        }
        /* Standardizes slotted footer buttons automatically */
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
        ::slotted(yenvui-async-btn[slot="footer"]),
        ::slotted(sutram-async-btn[slot="footer"]) {
            flex: 1;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            display: block;
            --btn-padding: 12px;
            --btn-font-size: 1.05rem;
            --btn-border-radius: 6px;
        }
    `;constructor(){super(),this.open=!1,this.titleText="",this.maxWidth="",this.fullscreen=!1,this._hasFooter=!1}_handleFooterSlotChange(e){this._hasFooter=e.target.assignedElements({flatten:!0}).length>0}updated(e){const t=this.shadowRoot.querySelector("dialog");t&&(this.open&&!t.open?(window.getComputedStyle(this).display==="none"&&console.warn(`[yenVUI] \u26A0\uFE0F Cannot execute showModal() on <yenvui-modal> because an ancestor is setting 'display: none'. This will cause a UI freeze. Target title: "${this.titleText}"`),t.showModal()):!this.open&&t.open?setTimeout(()=>{t.open&&t.close()},0):this.open&&t.open&&e.has("open")&&(t.close(),t.showModal())),e.has("maxWidth")&&this.maxWidth&&this.style.setProperty("--modal-max-width",this.maxWidth)}bringToFront(){const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(e.close(),e.showModal())}disconnectedCallback(){super.disconnectedCallback();const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(document.body.appendChild(e),e.close(),e.remove())}_handleNativeCancel(e){e.preventDefault(),this._dispatchClose()}_handleBackdropClick(e){const t=this.shadowRoot.querySelector("dialog")||e.currentTarget;if(!t)return;const o=t.getBoundingClientRect();o.top<=e.clientY&&e.clientY<=o.top+o.height&&o.left<=e.clientX&&e.clientX<=o.left+o.width||this._dispatchClose()}_dispatchClose(){const e=new CustomEvent("yenvui-modal-closing",{bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(e),e.defaultPrevented)return;const t=this.shadowRoot.querySelector("dialog");t&&t.open&&t.close(),setTimeout(()=>{this.open=!1,this.dispatchEvent(new CustomEvent("yenvui-modal-closed",{bubbles:!0,composed:!0}))},10)}render(){return a`
            <dialog 
                @cancel=${this._handleNativeCancel}
                @click=${this._handleBackdropClick}>
                
                <div class="header">
                    <h3>${this.titleText}</h3>
                    <button class="close-btn" @click=${this._dispatchClose}>Back</button>
                </div>
                <div class="body">
                    <slot name="body"></slot>
                    <slot></slot>
                </div>
                <div class="footer" style="display: ${this._hasFooter?"flex":"none"};">
                    <slot name="footer" @slotchange=${this._handleFooterSlotChange}></slot>
                </div>

            </dialog>
        `}}customElements.define("yenvui-modal",YenvuiModal);
