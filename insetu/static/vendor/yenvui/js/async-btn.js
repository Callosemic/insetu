import{html as i,css as e}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiBtn extends r{static properties={label:{type:String},intent:{type:String},variant:{type:String},emphasis:{type:Boolean},btntype:{type:String},disabled:{type:Boolean},active:{type:Boolean}};static styles=e`
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
    `;constructor(){super(),this.label="Submit",this.intent="primary",this.variant="tinted",this.emphasis=!1,this.btntype="button",this.disabled=!1,this.active=!1}render(){return i`
            <button 
                type="${this.btntype}"
                class="intent-${this.intent} variant-${this.variant} ${this.emphasis?"emphasis":""} ${this.active?"active":""}" 
                ?disabled=${this.disabled}
                @click=${t=>{this.disabled||this.dispatchEvent(new CustomEvent("yv-click",{bubbles:!0,composed:!0,detail:{originalEvent:t}}))}}>
                <slot>${this.label}</slot>
            </button>
        `}}customElements.define("yenvui-btn",YenvuiBtn);export class YenvuiAsyncBtn extends r{static properties={label:{type:String},loadingLabel:{type:String},successLabel:{type:String},errorLabel:{type:String},intent:{type:String},variant:{type:String},emphasis:{type:Boolean},status:{type:String},btntype:{type:String},onClick:{type:Object},disabled:{type:Boolean},active:{type:Boolean}};static styles=e`
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
    `;constructor(){super(),this.label="Submit",this.loadingLabel="\u23F3...",this.successLabel="\u2705",this.errorLabel="\u274C",this.intent="primary",this.variant="tinted",this.emphasis=!1,this.status="idle",this.btntype="button",this.disabled=!1,this.active=!1}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.dispatchEvent(new CustomEvent("yv-click",{bubbles:!0,composed:!0,detail:{originalEvent:t}})),this.onClick&&typeof this.onClick=="function")try{this.status="loading",await this.onClick(t),this.status="success",setTimeout(()=>{this.status="idle"},2e3)}catch(n){this.status="error",console.error(n),setTimeout(()=>{this.status="idle"},2e3)}}render(){let t=this.label;this.status==="loading"&&(t=this.loadingLabel),this.status==="success"&&(t=this.successLabel),this.status==="error"&&(t=this.errorLabel);let n=this.intent;return this.status==="success"&&(n="success"),this.status==="error"&&(n="danger"),i`
            <button 
                type="${this.btntype}"
                class="intent-${n} variant-${this.variant} ${this.emphasis?"emphasis":""} ${this.active?"active":""}" 
                ?disabled=${this.disabled||this.status==="loading"}
                @click=${this._handleClick}>
                ${t}
            </button>
        `}}customElements.define("yenvui-async-btn",YenvuiAsyncBtn);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmV4cG9ydCBjbGFzcyBZZW52dWlCdG4gZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgbGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGludGVudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdmFyaWFudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZW1waGFzaXM6IHsgdHlwZTogQm9vbGVhbiB9LFxuICAgICAgICBidG50eXBlOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkaXNhYmxlZDogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIGFjdGl2ZTogeyB0eXBlOiBCb29sZWFuIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDsgXG4gICAgICAgICAgICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xuICAgICAgICAgICAgbWluLXdpZHRoOiBtYXgtY29udGVudDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbiB7XG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIHBhZGRpbmc6IHZhcigtLWJ0bi1wYWRkaW5nLCA4cHggMTRweCk7XG4gICAgICAgICAgICBmb250LXNpemU6IHZhcigtLWJ0bi1mb250LXNpemUsIDAuODVyZW0pO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogdmFyKC0tYnRuLWZvbnQtd2VpZ2h0LCBib2xkKTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IHZhcigtLWJ0bi1ib3JkZXItcmFkaXVzLCA4cHgpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBtaW4td2lkdGg6IG1heC1jb250ZW50O1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uOmFjdGl2ZTpub3QoOmRpc2FibGVkKSB7IHRyYW5zZm9ybTogc2NhbGUoMC45OCk7IH1cbiAgICAgICAgYnV0dG9uOmRpc2FibGVkIHsgb3BhY2l0eTogMC43OyBjdXJzb3I6IG5vdC1hbGxvd2VkOyB9XG5cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjZWM0ODk5ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAzcHggM3B4IDAgI2VhYjMwOCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbjpob3Zlcjpub3QoOmRpc2FibGVkKSB7IGJhY2tncm91bmQ6ICNmMWY1ZjkgIWltcG9ydGFudDsgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24uYWN0aXZlIHsgYmFja2dyb3VuZDogIzAwMDAwMCAhaW1wb3J0YW50OyBjb2xvcjogI2ZmZmZmZiAhaW1wb3J0YW50OyB9XG5cbiAgICAgICAgLyogQmFzZSBDb2xvcnMgKi9cbiAgICAgICAgLmludGVudC1wcmltYXJ5IHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTsgfVxuICAgICAgICAuaW50ZW50LXN1Y2Nlc3MgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LXN1Y2Nlc3MsICMxMGI5ODEpOyB9XG4gICAgICAgIC5pbnRlbnQtZGFuZ2VyIHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC1kYW5nZXIsICNlZjQ0NDQpOyB9XG4gICAgICAgIC5pbnRlbnQtd2FybmluZyB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtd2FybmluZywgI2Y1OWUwYik7IH1cbiAgICAgICAgLmludGVudC1oaWdobGlnaHQgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LWhpZ2hsaWdodCwgIzhiNWNmNik7IH1cbiAgICAgICAgLmludGVudC1uZXV0cmFsIHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTsgfVxuXG4gICAgICAgIC8qIFNvbGlkIFZhcmlhbnQgKi9cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc29saWQgeyBiYWNrZ3JvdW5kOiB2YXIoLS1idG4tY29sb3IpOyBjb2xvcjogI2ZmZmZmZjsgfVxuICAgICAgICBidXR0b24udmFyaWFudC1zb2xpZC5pbnRlbnQtd2FybmluZyB7IGNvbG9yOiAjMDAwMDAwOyB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHsgZmlsdGVyOiBicmlnaHRuZXNzKDEuMSk7IH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc29saWQuYWN0aXZlIHsgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMnB4ICNmZmZmZmY7IGZpbHRlcjogYnJpZ2h0bmVzcygxLjE1KTsgfVxuXG4gICAgICAgIC8qIFRpbnRlZCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRpbnRlZCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAxNSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1idG4tY29sb3IpO1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSA0MCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgfVxuICAgICAgICBidXR0b24udmFyaWFudC10aW50ZWQ6aG92ZXI6bm90KDpkaXNhYmxlZCkgeyBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAyNSUsIHRyYW5zcGFyZW50KTsgfVxuICAgICAgICBidXR0b24udmFyaWFudC10aW50ZWQuYWN0aXZlIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1idG4tY29sb3IpOyBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAzNSUsIHRyYW5zcGFyZW50KTsgfVxuXG4gICAgICAgIC8qIEVtcGhhc2lzIEdsb3cgKi9cbiAgICAgICAgYnV0dG9uLmVtcGhhc2lzIHsgYm94LXNoYWRvdzogMCAwIDE0cHggY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgNTAlLCB0cmFuc3BhcmVudCk7IH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMubGFiZWwgPSAnU3VibWl0JztcbiAgICAgICAgdGhpcy5pbnRlbnQgPSAncHJpbWFyeSc7XG4gICAgICAgIHRoaXMudmFyaWFudCA9ICd0aW50ZWQnO1xuICAgICAgICB0aGlzLmVtcGhhc2lzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYnRudHlwZSA9ICdidXR0b24nO1xuICAgICAgICB0aGlzLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYWN0aXZlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgICAgdHlwZT1cIiR7dGhpcy5idG50eXBlfVwiXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJpbnRlbnQtJHt0aGlzLmludGVudH0gdmFyaWFudC0ke3RoaXMudmFyaWFudH0gJHt0aGlzLmVtcGhhc2lzID8gJ2VtcGhhc2lzJyA6ICcnfSAke3RoaXMuYWN0aXZlID8gJ2FjdGl2ZScgOiAnJ31cIiBcbiAgICAgICAgICAgICAgICA/ZGlzYWJsZWQ9JHt0aGlzLmRpc2FibGVkfVxuICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kaXNhYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneXYtY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlLCBkZXRhaWw6IHsgb3JpZ2luYWxFdmVudDogZSB9IH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgICAgIDxzbG90PiR7dGhpcy5sYWJlbH08L3Nsb3Q+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1idG4nLCBZZW52dWlCdG4pO1xuXG5leHBvcnQgY2xhc3MgWWVudnVpQXN5bmNCdG4gZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgbGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGxvYWRpbmdMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc3VjY2Vzc0xhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBlcnJvckxhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHZhcmlhbnQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGVtcGhhc2lzOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgc3RhdHVzOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBidG50eXBlOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBvbkNsaWNrOiB7IHR5cGU6IE9iamVjdCB9LFxuICAgICAgICBkaXNhYmxlZDogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIGFjdGl2ZTogeyB0eXBlOiBCb29sZWFuIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDsgXG4gICAgICAgICAgICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xuICAgICAgICAgICAgbWluLXdpZHRoOiBtYXgtY29udGVudDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbiB7XG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIHBhZGRpbmc6IHZhcigtLWJ0bi1wYWRkaW5nLCA4cHggMTRweCk7XG4gICAgICAgICAgICBmb250LXNpemU6IHZhcigtLWJ0bi1mb250LXNpemUsIDAuODVyZW0pO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogdmFyKC0tYnRuLWZvbnQtd2VpZ2h0LCBib2xkKTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IHZhcigtLWJ0bi1ib3JkZXItcmFkaXVzLCA4cHgpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBtaW4td2lkdGg6IG1heC1jb250ZW50O1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzIGVhc2U7XG4gICAgICAgIH1cblxuICAgICAgICBidXR0b246YWN0aXZlOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uOmRpc2FibGVkIHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNztcbiAgICAgICAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNlYzQ4OTkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDNweCAzcHggMCAjZWFiMzA4ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmMWY1ZjkgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24uYWN0aXZlIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBCYXNlIENvbG9ycyAqL1xuICAgICAgICAuaW50ZW50LXByaW1hcnkgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtc3VjY2VzcyB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtc3VjY2VzcywgIzEwYjk4MSk7IH1cbiAgICAgICAgLmludGVudC1kYW5nZXIgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LWRhbmdlciwgI2VmNDQ0NCk7IH1cbiAgICAgICAgLmludGVudC13YXJuaW5nIHsgLS1idG4tY29sb3I6IHZhcigtLWludGVudC13YXJuaW5nLCAjZjU5ZTBiKTsgfVxuICAgICAgICAuaW50ZW50LWhpZ2hsaWdodCB7IC0tYnRuLWNvbG9yOiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTsgfVxuICAgICAgICAuaW50ZW50LW5ldXRyYWwgeyAtLWJ0bi1jb2xvcjogdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpOyB9XG5cbiAgICAgICAgLyogU29saWQgVmFyaWFudCAoRGVmYXVsdCkgKi9cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc29saWQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYnRuLWNvbG9yKTtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkLmludGVudC13YXJuaW5nIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjEpO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXNvbGlkLmFjdGl2ZSB7XG4gICAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAycHggI2ZmZmZmZjtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjE1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFRpbnRlZCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRpbnRlZCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAxNSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1idG4tY29sb3IpO1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSA0MCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgfVxuICAgICAgICBidXR0b24udmFyaWFudC10aW50ZWQ6aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJ0bi1jb2xvcikgMjUlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtdGludGVkLmFjdGl2ZSB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWJ0bi1jb2xvcik7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYnRuLWNvbG9yKSAzNSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIEVtcGhhc2lzIEdsb3cgKi9cbiAgICAgICAgYnV0dG9uLmVtcGhhc2lzIHtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMCAxNHB4IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1idG4tY29sb3IpIDUwJSwgdHJhbnNwYXJlbnQpO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5sYWJlbCA9ICdTdWJtaXQnO1xuICAgICAgICB0aGlzLmxvYWRpbmdMYWJlbCA9ICdcdTIzRjMuLi4nO1xuICAgICAgICB0aGlzLnN1Y2Nlc3NMYWJlbCA9ICdcdTI3MDUnO1xuICAgICAgICB0aGlzLmVycm9yTGFiZWwgPSAnXHUyNzRDJztcbiAgICAgICAgdGhpcy5pbnRlbnQgPSAncHJpbWFyeSc7XG4gICAgICAgIHRoaXMudmFyaWFudCA9ICd0aW50ZWQnO1xuICAgICAgICB0aGlzLmVtcGhhc2lzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gJ2lkbGUnO1xuICAgICAgICB0aGlzLmJ0bnR5cGUgPSAnYnV0dG9uJztcbiAgICAgICAgdGhpcy5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgIH1cbiAgICBhc3luYyBfaGFuZGxlQ2xpY2soZSkge1xuICAgICAgICBpZiAodGhpcy5kaXNhYmxlZCB8fCB0aGlzLnN0YXR1cyA9PT0gJ2xvYWRpbmcnKSB7XG4gICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneXYtY2xpY2snLCB7ICBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsIFxuICAgICAgICAgICAgZGV0YWlsOiB7IG9yaWdpbmFsRXZlbnQ6IGUgfSBcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIC8vIEJyaWRnZSB0aGUgZ2FwIGZvciBsZWdhY3kgaG9zdCBjb21wb25lbnRzIHBhc3NpbmcgZnVuY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICh0aGlzLm9uQ2xpY2sgJiYgdHlwZW9mIHRoaXMub25DbGljayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXR1cyA9ICdsb2FkaW5nJztcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm9uQ2xpY2soZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSAnc3VjY2Vzcyc7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuc3RhdHVzID0gJ2lkbGUnOyB9LCAyMDAwKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gJ2Vycm9yJztcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuc3RhdHVzID0gJ2lkbGUnOyB9LCAyMDAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgbGV0IHRleHQgPSB0aGlzLmxhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdsb2FkaW5nJykgdGV4dCA9IHRoaXMubG9hZGluZ0xhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdzdWNjZXNzJykgdGV4dCA9IHRoaXMuc3VjY2Vzc0xhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdlcnJvcicpIHRleHQgPSB0aGlzLmVycm9yTGFiZWw7XG5cbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBtYXAgdGhlIHN1Y2Nlc3MvZXJyb3Igc3RhdGVzIHRvIHZpc3VhbCBjb2xvciBmZWVkYmFja1xuICAgICAgICBsZXQgYWN0aXZlSW50ZW50ID0gdGhpcy5pbnRlbnQ7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSBhY3RpdmVJbnRlbnQgPSAnc3VjY2Vzcyc7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ2Vycm9yJykgYWN0aXZlSW50ZW50ID0gJ2Rhbmdlcic7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICB0eXBlPVwiJHt0aGlzLmJ0bnR5cGV9XCJcbiAgICAgICAgICAgICAgICBjbGFzcz1cImludGVudC0ke2FjdGl2ZUludGVudH0gdmFyaWFudC0ke3RoaXMudmFyaWFudH0gJHt0aGlzLmVtcGhhc2lzID8gJ2VtcGhhc2lzJyA6ICcnfSAke3RoaXMuYWN0aXZlID8gJ2FjdGl2ZScgOiAnJ31cIiBcbiAgICAgICAgICAgICAgICA/ZGlzYWJsZWQ9JHt0aGlzLmRpc2FibGVkIHx8IHRoaXMuc3RhdHVzID09PSAnbG9hZGluZyd9XG4gICAgICAgICAgICAgICAgQGNsaWNrPSR7dGhpcy5faGFuZGxlQ2xpY2t9PlxuICAgICAgICAgICAgICAgICR7dGV4dH1cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWFzeW5jLWJ0bicsIFllbnZ1aUFzeW5jQnRuKTsi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QUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQTZGaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLE1BQVEsU0FDYixLQUFLLGFBQWUsWUFDcEIsS0FBSyxhQUFlLFNBQ3BCLEtBQUssV0FBYSxTQUNsQixLQUFLLE9BQVMsVUFDZCxLQUFLLFFBQVUsU0FDZixLQUFLLFNBQVcsR0FDaEIsS0FBSyxPQUFTLE9BQ2QsS0FBSyxRQUFVLFNBQ2YsS0FBSyxTQUFXLEdBQ2hCLEtBQUssT0FBUyxFQUNsQixDQUNBLE1BQU0sYUFBYUUsRUFBRyxDQUNsQixHQUFJLEtBQUssVUFBWSxLQUFLLFNBQVcsVUFBVyxDQUN4Q0EsSUFDQUEsRUFBRSxnQkFBZ0IsRUFDbEJBLEVBQUUsZUFBZSxHQUVyQixNQUNKLENBU0EsR0FQQSxLQUFLLGNBQWMsSUFBSSxZQUFZLFdBQVksQ0FDM0MsUUFBUyxHQUNULFNBQVUsR0FDVixPQUFRLENBQUUsY0FBZUEsQ0FBRSxDQUMvQixDQUFDLENBQUMsRUFHRSxLQUFLLFNBQVcsT0FBTyxLQUFLLFNBQVksV0FDeEMsR0FBSSxDQUNBLEtBQUssT0FBUyxVQUNkLE1BQU0sS0FBSyxRQUFRQSxDQUFDLEVBQ3BCLEtBQUssT0FBUyxVQUNkLFdBQVcsSUFBTSxDQUFFLEtBQUssT0FBUyxNQUFRLEVBQUcsR0FBSSxDQUNwRCxPQUFTQyxFQUFLLENBQ1YsS0FBSyxPQUFTLFFBQ2QsUUFBUSxNQUFNQSxDQUFHLEVBQ2pCLFdBQVcsSUFBTSxDQUFFLEtBQUssT0FBUyxNQUFRLEVBQUcsR0FBSSxDQUNwRCxDQUVSLENBRUEsUUFBUyxDQUNMLElBQUlDLEVBQU8sS0FBSyxNQUNaLEtBQUssU0FBVyxZQUFXQSxFQUFPLEtBQUssY0FDdkMsS0FBSyxTQUFXLFlBQVdBLEVBQU8sS0FBSyxjQUN2QyxLQUFLLFNBQVcsVUFBU0EsRUFBTyxLQUFLLFlBR3pDLElBQUlDLEVBQWUsS0FBSyxPQUN4QixPQUFJLEtBQUssU0FBVyxZQUFXQSxFQUFlLFdBQzFDLEtBQUssU0FBVyxVQUFTQSxFQUFlLFVBQ3JDTjtBQUFBO0FBQUEsd0JBRVMsS0FBSyxPQUFPO0FBQUEsZ0NBQ0pNLENBQVksWUFBWSxLQUFLLE9BQU8sSUFBSSxLQUFLLFNBQVcsV0FBYSxFQUFFLElBQUksS0FBSyxPQUFTLFNBQVcsRUFBRTtBQUFBLDRCQUMxRyxLQUFLLFVBQVksS0FBSyxTQUFXLFNBQVM7QUFBQSx5QkFDN0MsS0FBSyxZQUFZO0FBQUEsa0JBQ3hCRCxDQUFJO0FBQUE7QUFBQSxTQUdsQixDQUNKLENBQ0EsZUFBZSxPQUFPLG1CQUFvQixjQUFjIiwKICAibmFtZXMiOiBbImh0bWwiLCAiY3NzIiwgIlllbnZ1aUJhc2UiLCAiZSIsICJlcnIiLCAidGV4dCIsICJhY3RpdmVJbnRlbnQiXQp9Cg==
