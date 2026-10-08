import{html as t,css as e}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiPill extends r{static properties={pillId:{type:String},labelText:{type:String},active:{type:Boolean},small:{type:Boolean},variant:{type:String}};static styles=e`
        button {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            border: 1px solid var(--border, #444);
            cursor: pointer;
            font-weight: bold;
            margin: 0;
            transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        button.small {
            padding: 2px 6px;
            font-size: 0.7rem;
        }

        /* Standard Variant */
        button.variant-standard.active {
            background: var(--btn, #3b82f6);
            color: #fff;
        }
        button.variant-standard.inactive {
            background: transparent;
            color: var(--text, #e0e0e0);
        }
        /* Text Variant */
        button.variant-text {
            background: transparent;
            font-weight: normal;
            border-radius: 0;
            border-left: none;
            border-right: none;
            border-top: 1px solid transparent;
            border-bottom: 1px solid transparent;
        }
        button.variant-text.inactive {
            color: var(--text-muted, #888);
        }
        button.variant-text.inactive:hover {
            color: var(--text, #e0e0e0);
        }
        button.variant-text.active {
            border-top: 1px solid var(--text, #e0e0e0);
            border-bottom: 1px solid var(--text, #e0e0e0);
            color: var(--text, #e0e0e0);
            font-weight: bold;
            background: transparent;
        }
        /* E-Ink overrides */
        :host([data-theme="e-ink"]) button.variant-standard.active {
            background: #000000 !important;
            color: #ffffff !important;
            border: 2px solid #000000 !important;
            box-shadow: 3px 3px 0 #9ca3af !important;
        }
        :host([data-theme="e-ink"]) button.variant-text.active {
            border-top: 2px solid #000000 !important;
            border-bottom: 2px solid #000000 !important;
            border-left: none !important;
            border-right: none !important;
        }
    `;constructor(){super(),this.variant="standard"}render(){return t`
            <button 
                class="${this.active?"active":"inactive"} ${this.small?"small":""} variant-${this.variant}"
                @click=${this._onClick}>
                ${this.labelText}
            </button>
        `}_onClick(a){this.dispatchEvent(new CustomEvent("yenvui-pill-toggled",{detail:{id:this.pillId,active:!this.active},bubbles:!0,composed:!0}))}}customElements.define("yenvui-pill",YenvuiPill);
