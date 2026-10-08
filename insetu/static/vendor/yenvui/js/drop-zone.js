import{html as t,css as r}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";export class YenvuiDropOverlay extends o{static properties={active:{type:Boolean,reflect:!0}};static styles=r`
        :host {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: var(--modal-backdrop, rgba(0, 0, 0, 0.85)) !important;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 20px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            z-index: 9999;
            user-select: none;
            -webkit-user-select: none;
        }
        :host([active]) {
            opacity: 1;
            pointer-events: auto;
        }
        /* Top-Layer Popover API Escalation */
        :host(:popover-open) {
            display: flex;
        }
    `;constructor(){super(),this.active=!1}updated(e){if(super.updated(e),e.has("active")){if(this.active&&typeof this.showPopover=="function"&&!this.matches(":popover-open")){this.setAttribute("popover","manual");try{this.showPopover()}catch{}}else if(!this.active&&typeof this.hidePopover=="function"&&this.matches(":popover-open"))try{this.hidePopover()}catch{}}}render(){return t`<slot></slot>`}}customElements.define("yenvui-drop-overlay",YenvuiDropOverlay);export class YenvuiDropTarget extends o{static properties={hovered:{type:Boolean,reflect:!0},intent:{type:String},zone:{type:String}};static styles=r`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 120px;
            border: 2px dashed var(--drop-target-border, var(--border));
            border-radius: 8px;
            color: var(--text-muted);
            font-size: 1.2rem;
            font-weight: bold;
            transition: all 0.2s ease;
            background: var(--pane-bg);
            box-sizing: border-box;
            width: 100%;
        }
        :host([hovered]) {
            border-style: solid;
            transform: scale(1.05);
        }
        .intent-primary {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--pane-bg));
            color: var(--text);
        }
        .intent-danger {
            border-color: var(--intent-danger);
            color: var(--intent-danger);
        }
        :host([hovered]) .intent-danger {
            background: color-mix(in srgb, var(--intent-danger) 20%, var(--pane-bg));
            color: white;
        }
        :host([intent="danger"]) { 
            height: 80px; 
            max-width: 400px; 
        }
    `;constructor(){super(),this.hovered=!1,this.intent="primary",this.zone=""}render(){return t`
            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; border-radius:inherit; flex-direction: column; background: transparent;">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-drop-target",YenvuiDropTarget);
