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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmV4cG9ydCBjbGFzcyBZZW52dWlCdG4gZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgbGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGludGVudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdmFyaWFudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2l6ZTogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZW1waGFzaXM6IHsgdHlwZTogQm9vbGVhbiB9LFxuICAgICAgICBidG50eXBlOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkaXNhYmxlZDogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIGFjdGl2ZTogeyB0eXBlOiBCb29sZWFuIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDsgIFxuICAgICAgICAgICAgdmVydGljYWwtYWxpZ246IG1pZGRsZTtcbiAgICAgICAgICAgIG1pbi13aWR0aDogbWF4LWNvbnRlbnQ7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgfVxuICAgICAgICBidXR0b24ge1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZywgOHB4IDE0cHgpO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplLCAwLjg1cmVtKTtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiBpbmhlcml0O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IHZhcigtLWJ0bi1mb250LXdlaWdodCwgYm9sZCk7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiB2YXIoLS1idG4tYm9yZGVyLXJhZGl1cywgOHB4KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWluLXdpZHRoOiBtYXgtY29udGVudDtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycyBlYXNlO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbjphY3RpdmU6bm90KDpkaXNhYmxlZCkgeyB0cmFuc2Zvcm06IHNjYWxlKDAuOTgpOyB9XG4gICAgICAgIGJ1dHRvbjpkaXNhYmxlZCB7IG9wYWNpdHk6IDAuNzsgY3Vyc29yOiBub3QtYWxsb3dlZDsgfVxuXG4gICAgICAgIC8qIEUtSW5rIEhpZ2ggQ29udHJhc3QgT3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgI2VjNDg5OSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IDNweCAwICNlYWIzMDggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b246aG92ZXI6bm90KDpkaXNhYmxlZCkgeyBiYWNrZ3JvdW5kOiAjZjFmNWY5ICFpbXBvcnRhbnQ7IH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uLmFjdGl2ZSB7IGJhY2tncm91bmQ6ICMwMDAwMDAgIWltcG9ydGFudDsgY29sb3I6ICNmZmZmZmYgIWltcG9ydGFudDsgfVxuXG4gICAgICAgIC8qIEJhc2UgQ29sb3JzICovXG4gICAgICAgIC5pbnRlbnQtcHJpbWFyeSB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNik7IH1cbiAgICAgICAgLmludGVudC1zdWNjZXNzIHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC1zdWNjZXNzLCAjMTBiOTgxKTsgfVxuICAgICAgICAuaW50ZW50LWRhbmdlciB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtZGFuZ2VyLCAjZWY0NDQ0KTsgfVxuICAgICAgICAuaW50ZW50LXdhcm5pbmcgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LXdhcm5pbmcsICNmNTllMGIpOyB9XG4gICAgICAgIC5pbnRlbnQtaGlnaGxpZ2h0IHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtbmV1dHJhbCB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4Yik7IH1cblxuICAgICAgICAvKiBTb2xpZCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkIHsgYmFja2dyb3VuZDogdmFyKC0tYnRuLWNvbG9yKTsgY29sb3I6ICNmZmZmZmY7IH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc29saWQuaW50ZW50LXdhcm5pbmcgeyBjb2xvcjogIzAwMDAwMDsgfVxuICAgICAgICBidXR0b24udmFyaWFudC1zb2xpZDpob3Zlcjpub3QoOmRpc2FibGVkKSB7IGZpbHRlcjogYnJpZ2h0bmVzcygxLjEpOyB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkLmFjdGl2ZSB7IGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDJweCAjZmZmZmZmOyBmaWx0ZXI6IGJyaWdodG5lc3MoMS4xNSk7IH1cblxuICAgICAgICAvKiBUaW50ZWQgVmFyaWFudCAqL1xuICAgICAgICBidXR0b24udmFyaWFudC10aW50ZWQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgMTUlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tYnRuLWNvbG9yKTtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgNDAlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtdGludGVkOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHsgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgMjUlLCB0cmFuc3BhcmVudCk7IH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtdGludGVkLmFjdGl2ZSB7IGJvcmRlci1jb2xvcjogdmFyKC0tYnRuLWNvbG9yKTsgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgMzUlLCB0cmFuc3BhcmVudCk7IH1cbiAgICAgICAgLyogRW1waGFzaXMgR2xvdyAqL1xuICAgICAgICBidXR0b24uZW1waGFzaXMgeyBib3gtc2hhZG93OiAwIDAgMTRweCBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSA1MCUsIHRyYW5zcGFyZW50KTsgfVxuXG4gICAgICAgIC8qIFNpemluZyAqL1xuICAgICAgICBidXR0b24uc2l6ZS1zbSB7IC0tYnRuLXBhZGRpbmc6IDRweCAxMHB4OyAtLWJ0bi1mb250LXNpemU6IDAuNzVyZW07IH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMubGFiZWwgPSAnU3VibWl0JztcbiAgICAgICAgdGhpcy5pbnRlbnQgPSAncHJpbWFyeSc7XG4gICAgICAgIHRoaXMudmFyaWFudCA9ICd0aW50ZWQnO1xuICAgICAgICB0aGlzLmVtcGhhc2lzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYnRudHlwZSA9ICdidXR0b24nO1xuICAgICAgICB0aGlzLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYWN0aXZlID0gZmFsc2U7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgIHR5cGU9XCIke3RoaXMuYnRudHlwZX1cIlxuICAgICAgICAgICAgICAgIGNsYXNzPVwiaW50ZW50LSR7dGhpcy5pbnRlbnR9IHZhcmlhbnQtJHt0aGlzLnZhcmlhbnR9IHNpemUtJHt0aGlzLnNpemUgfHwgJ21kJ30gJHt0aGlzLmVtcGhhc2lzID8gJ2VtcGhhc2lzJyA6ICcnfSAke3RoaXMuYWN0aXZlID8gJ2FjdGl2ZScgOiAnJ31cIiBcbiAgICAgICAgICAgICAgICA/ZGlzYWJsZWQ9JHt0aGlzLmRpc2FibGVkfVxuICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kaXNhYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneXYtY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlLCBkZXRhaWw6IHsgb3JpZ2luYWxFdmVudDogZSB9IH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgICAgIDxzbG90PiR7dGhpcy5sYWJlbH08L3Nsb3Q+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1idG4nLCBZZW52dWlCdG4pO1xuXG5leHBvcnQgY2xhc3MgWWVudnVpQXN5bmNCdG4gZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgbGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGxvYWRpbmdMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc3VjY2Vzc0xhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBlcnJvckxhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHZhcmlhbnQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHNpemU6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGVtcGhhc2lzOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgc3RhdHVzOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBidG50eXBlOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBvbkNsaWNrOiB7IHR5cGU6IE9iamVjdCB9LFxuICAgICAgICBkaXNhYmxlZDogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIGFjdGl2ZTogeyB0eXBlOiBCb29sZWFuIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDsgXG4gICAgICAgICAgICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xuICAgICAgICAgICAgbWluLXdpZHRoOiBtYXgtY29udGVudDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbiB7XG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIHBhZGRpbmc6IHZhcigtLWJ0bi1wYWRkaW5nLCA4cHggMTRweCk7XG4gICAgICAgICAgICBmb250LXNpemU6IHZhcigtLWJ0bi1mb250LXNpemUsIDAuODVyZW0pO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogdmFyKC0tYnRuLWZvbnQtd2VpZ2h0LCBib2xkKTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IHZhcigtLWJ0bi1ib3JkZXItcmFkaXVzLCA4cHgpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBtaW4td2lkdGg6IG1heC1jb250ZW50O1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzIGVhc2U7XG4gICAgICAgIH1cblxuICAgICAgICBidXR0b246YWN0aXZlOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uOmRpc2FibGVkIHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNztcbiAgICAgICAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNlYzQ4OTkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDNweCAzcHggMCAjZWFiMzA4ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmMWY1ZjkgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24uYWN0aXZlIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBCYXNlIENvbG9ycyAqL1xuICAgICAgICAuaW50ZW50LXByaW1hcnkgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtc3VjY2VzcyB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtc3VjY2VzcywgIzEwYjk4MSk7IH1cbiAgICAgICAgLmludGVudC1kYW5nZXIgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LWRhbmdlciwgI2VmNDQ0NCk7IH1cbiAgICAgICAgLmludGVudC13YXJuaW5nIHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC13YXJuaW5nLCAjZjU5ZTBiKTsgfVxuICAgICAgICAuaW50ZW50LWhpZ2hsaWdodCB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTsgfVxuICAgICAgICAuaW50ZW50LW5ldXRyYWwgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpOyB9XG5cbiAgICAgICAgLyogU29saWQgVmFyaWFudCAoRGVmYXVsdCkgKi9cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc29saWQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYnRuLWNvbG9yKTtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkLmludGVudC13YXJuaW5nIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjEpO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkLmFjdGl2ZSB7XG4gICAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAycHggI2ZmZmZmZjtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjE1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFRpbnRlZCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRpbnRlZCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAxNSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1idG4tY29sb3IpO1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSA0MCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgfVxuICAgICAgICBidXR0b24udmFyaWFudC10aW50ZWQ6aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgMjUlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtdGludGVkLmFjdGl2ZSB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWJ0bi1jb2xvcik7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAzNSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFbXBoYXNpcyBHbG93ICovXG4gICAgICAgIGJ1dHRvbi5lbXBoYXNpcyB7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDAgMTRweCBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSA1MCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFNpemluZyAqL1xuICAgICAgICBidXR0b24uc2l6ZS1zbSB7IC0tYnRuLXBhZGRpbmc6IDRweCAxMHB4OyAtLWJ0bi1mb250LXNpemU6IDAuNzVyZW07IH1cbiAgICBgO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmxhYmVsID0gJ1N1Ym1pdCc7XG4gICAgICAgIHRoaXMubG9hZGluZ0xhYmVsID0gJ1x1MjNGMy4uLic7XG4gICAgICAgIHRoaXMuc3VjY2Vzc0xhYmVsID0gJ1x1MjcwNSc7XG4gICAgICAgIHRoaXMuZXJyb3JMYWJlbCA9ICdcdTI3NEMnO1xuICAgICAgICB0aGlzLmludGVudCA9ICdwcmltYXJ5JztcbiAgICAgICAgdGhpcy52YXJpYW50ID0gJ3RpbnRlZCc7XG4gICAgICAgIHRoaXMuZW1waGFzaXMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSAnaWRsZSc7XG4gICAgICAgIHRoaXMuYnRudHlwZSA9ICdidXR0b24nO1xuICAgICAgICB0aGlzLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYWN0aXZlID0gZmFsc2U7XG4gICAgfVxuICAgIGFzeW5jIF9oYW5kbGVDbGljayhlKSB7XG4gICAgICAgIGlmICh0aGlzLmRpc2FibGVkIHx8IHRoaXMuc3RhdHVzID09PSAnbG9hZGluZycpIHtcbiAgICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5di1jbGljaycsIHsgIFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSwgXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZSwgXG4gICAgICAgICAgICBkZXRhaWw6IHsgb3JpZ2luYWxFdmVudDogZSB9IFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgLy8gQnJpZGdlIHRoZSBnYXAgZm9yIGxlZ2FjeSBob3N0IGNvbXBvbmVudHMgcGFzc2luZyBmdW5jdGlvbmFsIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKHRoaXMub25DbGljayAmJiB0eXBlb2YgdGhpcy5vbkNsaWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gJ2xvYWRpbmcnO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMub25DbGljayhlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXR1cyA9ICdzdWNjZXNzJztcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5zdGF0dXMgPSAnaWRsZSc7IH0sIDIwMDApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSAnZXJyb3InO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5zdGF0dXMgPSAnaWRsZSc7IH0sIDIwMDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICBsZXQgdGV4dCA9IHRoaXMubGFiZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ2xvYWRpbmcnKSB0ZXh0ID0gdGhpcy5sb2FkaW5nTGFiZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSB0ZXh0ID0gdGhpcy5zdWNjZXNzTGFiZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ2Vycm9yJykgdGV4dCA9IHRoaXMuZXJyb3JMYWJlbDtcblxuICAgICAgICAvLyBBdXRvbWF0aWNhbGx5IG1hcCB0aGUgc3VjY2Vzcy9lcnJvciBzdGF0ZXMgdG8gdmlzdWFsIGNvbG9yIGZlZWRiYWNrXG4gICAgICAgIGxldCBhY3RpdmVJbnRlbnQgPSB0aGlzLmludGVudDtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAnc3VjY2VzcycpIGFjdGl2ZUludGVudCA9ICdzdWNjZXNzJztcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAnZXJyb3InKSBhY3RpdmVJbnRlbnQgPSAnZGFuZ2VyJztcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgIHR5cGU9XCIke3RoaXMuYnRudHlwZX1cIlxuICAgICAgICAgICAgICAgIGNsYXNzPVwiaW50ZW50LSR7YWN0aXZlSW50ZW50fSB2YXJpYW50LSR7dGhpcy52YXJpYW50fSBzaXplLSR7dGhpcy5zaXplIHx8ICdtZCd9ICR7dGhpcy5lbXBoYXNpcyA/ICdlbXBoYXNpcycgOiAnJ30gJHt0aGlzLmFjdGl2ZSA/ICdhY3RpdmUnIDogJyd9XCIgXG4gICAgICAgICAgICAgICAgP2Rpc2FibGVkPSR7dGhpcy5kaXNhYmxlZCB8fCB0aGlzLnN0YXR1cyA9PT0gJ2xvYWRpbmcnfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsaWNrfT5cbiAgICAgICAgICAgICAgICAke3RleHR9XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1hc3luYy1idG4nLCBZZW52dWlBc3luY0J0bik7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFDcEIsYUFBTSxrQkFBa0JBLENBQVcsQ0FDdEMsT0FBTyxXQUFhLENBQ2hCLE1BQU8sQ0FBRSxLQUFNLE1BQU8sRUFDdEIsT0FBUSxDQUFFLEtBQU0sTUFBTyxFQUN2QixRQUFTLENBQUUsS0FBTSxNQUFPLEVBQ3hCLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsU0FBVSxDQUFFLEtBQU0sT0FBUSxFQUMxQixRQUFTLENBQUUsS0FBTSxNQUFPLEVBQ3hCLFNBQVUsQ0FBRSxLQUFNLE9BQVEsRUFDMUIsT0FBUSxDQUFFLEtBQU0sT0FBUSxDQUM1QixFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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SSxZQUFZLFdBQVksQ0FDM0MsUUFBUyxHQUNULFNBQVUsR0FDVixPQUFRLENBQUUsY0FBZUEsQ0FBRSxDQUMvQixDQUFDLENBQUMsRUFHRSxLQUFLLFNBQVcsT0FBTyxLQUFLLFNBQVksV0FDeEMsR0FBSSxDQUNBLEtBQUssT0FBUyxVQUNkLE1BQU0sS0FBSyxRQUFRQSxDQUFDLEVBQ3BCLEtBQUssT0FBUyxVQUNkLFdBQVcsSUFBTSxDQUFFLEtBQUssT0FBUyxNQUFRLEVBQUcsR0FBSSxDQUNwRCxPQUFTQyxFQUFLLENBQ1YsS0FBSyxPQUFTLFFBQ2QsUUFBUSxNQUFNQSxDQUFHLEVBQ2pCLFdBQVcsSUFBTSxDQUFFLEtBQUssT0FBUyxNQUFRLEVBQUcsR0FBSSxDQUNwRCxDQUVSLENBRUEsUUFBUyxDQUNMLElBQUlDLEVBQU8sS0FBSyxNQUNaLEtBQUssU0FBVyxZQUFXQSxFQUFPLEtBQUssY0FDdkMsS0FBSyxTQUFXLFlBQVdBLEVBQU8sS0FBSyxjQUN2QyxLQUFLLFNBQVcsVUFBU0EsRUFBTyxLQUFLLFlBR3pDLElBQUlDLEVBQWUsS0FBSyxPQUN4QixPQUFJLEtBQUssU0FBVyxZQUFXQSxFQUFlLFdBQzFDLEtBQUssU0FBVyxVQUFTQSxFQUFlLFVBQ3JDTjtBQUFBO0FBQUEsd0JBRVMsS0FBSyxPQUFPO0FBQUEsZ0NBQ0pNLENBQVksWUFBWSxLQUFLLE9BQU8sU0FBUyxLQUFLLE1BQVEsSUFBSSxJQUFJLEtBQUssU0FBVyxXQUFhLEVBQUUsSUFBSSxLQUFLLE9BQVMsU0FBVyxFQUFFO0FBQUEsNEJBQ3BJLEtBQUssVUFBWSxLQUFLLFNBQVcsU0FBUztBQUFBLHlCQUM3QyxLQUFLLFlBQVk7QUFBQSxrQkFDeEJELENBQUk7QUFBQTtBQUFBLFNBR2xCLENBQ0osQ0FDQSxlQUFlLE9BQU8sbUJBQW9CLGNBQWMiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSIsICJlIiwgImVyciIsICJ0ZXh0IiwgImFjdGl2ZUludGVudCJdCn0K
