import{LitElement,html,css}from'lit';export class YenvuiModal extends LitElement{static properties={titleText:{type:String},open:{type:Boolean,reflect:true},maxWidth:{type:String},fullscreen:{type:Boolean,reflect:true}};static styles=css`
        :host { display: none; }
        :host([open]) { display: contents; } /* Allows dialog to break out of layout bounds */
        
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
            display: flex;
            flex-direction: column;
            overflow: hidden;
            margin: auto; /* Centers natively in the #top-layer */
        }
        
        :host([fullscreen]) dialog {
            max-width: 100vw;
            max-height: 100dvh;
            height: 100dvh;
            border-radius: 0;
            border: none;
        }

        /* Native Backdrop Styling replacing manual DOM overlays */
        dialog::backdrop {
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(3px);
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
        }

        .header h3 {
            margin: 0;
            font-size: 1.2rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .close-btn {
            background: var(--intent-neutral, #64748b);
            color: var(--text, #ffffff);
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85rem;
            transition: filter 0.2s;
        }
        
        .close-btn:hover {
            filter: brightness(1.2);
        }

        .body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .footer {
            padding: 0;
            border-top: 1px solid var(--border, #444);
            background: var(--input-bg, #2d2d2d);
            display: flex;
            flex-shrink: 0;
            width: 100%;
        }
        
        /* Standardizes slotted footer buttons automatically */
        ::slotted(button[slot="footer"]),
        ::slotted(yenvui-async-btn[slot="footer"]) { 
            flex: 1; 
            margin: 0 !important; 
            padding: 15px !important; 
            border-radius: 0 !important; 
            font-size: 1.1rem !important; 
            font-weight: bold !important; 
            border: none !important; 
            border-right: 1px solid var(--border, #444) !important; 
            cursor: pointer; 
        }
        ::slotted(*[slot="footer"]:last-child) { 
            border-right: none !important; 
        }
    `;constructor(){super();this.open=false;this.titleText='';this.maxWidth='';this.fullscreen=false;}
updated(changedProperties){if(changedProperties.has('open')){const dialog=this.shadowRoot.querySelector('dialog');if(!dialog)return;if(this.open&&!dialog.open){dialog.showModal();}else if(!this.open&&dialog.open){dialog.close();}}
if(changedProperties.has('maxWidth')&&this.maxWidth){this.style.setProperty('--modal-max-width',this.maxWidth);}}
_handleNativeCancel(e){e.preventDefault();this._dispatchClose();}
_handleBackdropClick(e){const dialog=this.shadowRoot.querySelector('dialog');const rect=dialog.getBoundingClientRect();const isInDialog=(rect.top<=e.clientY&&e.clientY<=rect.top+rect.height&&rect.left<=e.clientX&&e.clientX<=rect.left+rect.width);if(!isInDialog){this._dispatchClose();}}
_dispatchClose(){const event=new CustomEvent('yenvui-modal-closing',{bubbles:true,composed:true,cancelable:true});this.dispatchEvent(event);if(event.defaultPrevented)return;this.dispatchEvent(new CustomEvent('yenvui-modal-closed',{bubbles:true,composed:true}));}
render(){return html`
            <dialog 
                @cancel=${this._handleNativeCancel}
                @click=${this._handleBackdropClick}>
                
                <div class="header">
                    <h3>${this.titleText}</h3>
                    <button class="close-btn" @click=${this._dispatchClose}>Back</button>
                </div>
                <div class="body">
                    <slot name="body"></slot>
                </div>
                <div class="footer">
                    <slot name="footer"></slot>
                </div>
                
            </dialog>
        `;}}
customElements.define('yenvui-modal',YenvuiModal);