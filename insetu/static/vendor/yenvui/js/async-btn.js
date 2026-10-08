import{html as i,css as e}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiBtn extends r{static properties={label:{type:String},intent:{type:String},variant:{type:String},size:{type:String},emphasis:{type:Boolean},btntype:{type:String},disabled:{type:Boolean},active:{type:Boolean}};static styles=e`
        :host { 
            display: inline-flex;  
            vertical-align: middle;
            min-width: max-content;
            flex-shrink: 0;
        }
        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--btn-padding, 8px 14px);
            font-size: var(--btn-font-size, 0.85rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, bold);
            border-radius: var(--btn-border-radius, 8px);
            border: 1px solid transparent;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            min-width: max-content;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }
        button:active:not(:disabled) { transform: scale(0.98); }
        button:disabled { opacity: 0.7; cursor: not-allowed; }

        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) button {
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 3px 0 #eab308 !important;
        }
        :host([data-theme="e-ink"]) button:hover:not(:disabled) { background: #f1f5f9 !important; }
        :host([data-theme="e-ink"]) button.active { background: #000000 !important; color: #ffffff !important; }

        /* Base Colors */
        .intent-primary { --btn-color: var(--intent-primary, #3b82f6); }
        .intent-success { --btn-color: var(--intent-success, #10b981); }
        .intent-danger { --btn-color: var(--intent-danger, #ef4444); }
        .intent-warning { --btn-color: var(--intent-warning, #f59e0b); }
        .intent-highlight { --btn-color: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { --btn-color: var(--intent-neutral, #64748b); }

        /* Solid Variant */
        button.variant-solid { background: var(--btn-color); color: #ffffff; }
        button.variant-solid.intent-warning { color: #000000; }
        button.variant-solid:hover:not(:disabled) { filter: brightness(1.1); }
        button.variant-solid.active { box-shadow: inset 0 0 0 2px #ffffff; filter: brightness(1.15); }

        /* Tinted Variant */
        button.variant-tinted {
            background: color-mix(in srgb, var(--btn-color) 15%, transparent);
            color: var(--btn-color);
            border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
        }
        button.variant-tinted:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-color) 25%, transparent); }
        button.variant-tinted.active { border-color: var(--btn-color); background: color-mix(in srgb, var(--btn-color) 35%, transparent); }
        /* Emphasis Glow */
        button.emphasis { box-shadow: 0 0 14px color-mix(in srgb, var(--btn-color) 50%, transparent); }

        /* Sizing */
        button.size-sm { --btn-padding: 4px 10px; --btn-font-size: 0.75rem; }
    `;constructor(){super(),this.label="Submit",this.intent="primary",this.variant="tinted",this.emphasis=!1,this.btntype="button",this.disabled=!1,this.active=!1}render(){return i`
            <button 
                type="${this.btntype}"
                class="intent-${this.intent} variant-${this.variant} size-${this.size||"md"} ${this.emphasis?"emphasis":""} ${this.active?"active":""}" 
                ?disabled=${this.disabled}
                @click=${t=>{this.disabled||this.dispatchEvent(new CustomEvent("yv-click",{bubbles:!0,composed:!0,detail:{originalEvent:t}}))}}>
                <slot>${this.label}</slot>
            </button>
        `}}customElements.define("yenvui-btn",YenvuiBtn);export class YenvuiAsyncBtn extends r{static properties={label:{type:String},loadingLabel:{type:String},successLabel:{type:String},errorLabel:{type:String},intent:{type:String},variant:{type:String},size:{type:String},emphasis:{type:Boolean},status:{type:String},btntype:{type:String},onClick:{type:Object},disabled:{type:Boolean},active:{type:Boolean}};static styles=e`
        :host { 
            display: inline-flex; 
            vertical-align: middle;
            min-width: max-content;
            flex-shrink: 0;
        }
        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--btn-padding, 8px 14px);
            font-size: var(--btn-font-size, 0.85rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, bold);
            border-radius: var(--btn-border-radius, 8px);
            border: 1px solid transparent;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            min-width: max-content;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }

        button:active:not(:disabled) {
            transform: scale(0.98);
        }
        button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) button {
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 3px 0 #eab308 !important;
        }
        :host([data-theme="e-ink"]) button:hover:not(:disabled) {
            background: #f1f5f9 !important;
        }
        :host([data-theme="e-ink"]) button.active {
            background: #000000 !important;
            color: #ffffff !important;
        }

        /* Base Colors */
        .intent-primary { --btn-color: var(--intent-primary, #3b82f6); }
        .intent-success { --btn-color: var(--intent-success, #10b981); }
        .intent-danger { --btn-color: var(--intent-danger, #ef4444); }
        .intent-warning { --btn-color: var(--intent-warning, #f59e0b); }
        .intent-highlight { --btn-color: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { --btn-color: var(--intent-neutral, #64748b); }

        /* Solid Variant (Default) */
        button.variant-solid {
            background: var(--btn-color);
            color: #ffffff;
        }
        button.variant-solid.intent-warning {
            color: #000000;
        }
        button.variant-solid:hover:not(:disabled) {
            filter: brightness(1.1);
        }
        button.variant-solid.active {
            box-shadow: inset 0 0 0 2px #ffffff;
            filter: brightness(1.15);
        }

        /* Tinted Variant */
        button.variant-tinted {
            background: color-mix(in srgb, var(--btn-color) 15%, transparent);
            color: var(--btn-color);
            border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
        }
        button.variant-tinted:hover:not(:disabled) {
            background: color-mix(in srgb, var(--btn-color) 25%, transparent);
        }
        button.variant-tinted.active {
            border-color: var(--btn-color);
            background: color-mix(in srgb, var(--btn-color) 35%, transparent);
        }
        /* Emphasis Glow */
        button.emphasis {
            box-shadow: 0 0 14px color-mix(in srgb, var(--btn-color) 50%, transparent);
        }

        /* Sizing */
        button.size-sm { --btn-padding: 4px 10px; --btn-font-size: 0.75rem; }
    `;constructor(){super(),this.label="Submit",this.loadingLabel="\u23F3...",this.successLabel="\u2705",this.errorLabel="\u274C",this.intent="primary",this.variant="tinted",this.emphasis=!1,this.status="idle",this.btntype="button",this.disabled=!1,this.active=!1}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.dispatchEvent(new CustomEvent("yv-click",{bubbles:!0,composed:!0,detail:{originalEvent:t}})),this.onClick&&typeof this.onClick=="function")try{this.status="loading",await this.onClick(t),this.status="success",setTimeout(()=>{this.status="idle"},2e3)}catch(n){this.status="error",console.error(n),setTimeout(()=>{this.status="idle"},2e3)}}render(){let t=this.label;this.status==="loading"&&(t=this.loadingLabel),this.status==="success"&&(t=this.successLabel),this.status==="error"&&(t=this.errorLabel);let n=this.intent;return this.status==="success"&&(n="success"),this.status==="error"&&(n="danger"),i`
            <button 
                type="${this.btntype}"
                class="intent-${n} variant-${this.variant} size-${this.size||"md"} ${this.emphasis?"emphasis":""} ${this.active?"active":""}" 
                ?disabled=${this.disabled||this.status==="loading"}
                @click=${this._handleClick}>
                ${t}
            </button>
        `}}customElements.define("yenvui-async-btn",YenvuiAsyncBtn);
