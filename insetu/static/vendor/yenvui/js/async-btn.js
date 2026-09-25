import{html as i,css as n}from"lit";import{YenvuiBase as s}from"./yenvui-base.js";export class YenvuiAsyncBtn extends s{static properties={label:{type:String},loadingLabel:{type:String},successLabel:{type:String},errorLabel:{type:String},intent:{type:String},status:{type:String},btntype:{type:String},onClick:{type:Object},disabled:{type:Boolean},active:{type:Boolean}};static styles=n`
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
            font-weight: var(--btn-font-weight, normal);
            border-radius: var(--btn-border-radius, 4px);
            border: none;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            min-width: max-content;
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
            color: #ffffff;
        }

        button:hover:not(:disabled) {
            filter: brightness(1.1);
        }
        
        button:active:not(:disabled) {
            transform: scale(0.98);
        }
        button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        button.active {
            box-shadow: inset 0 0 0 2px var(--text, #ffffff);
            filter: brightness(1.15);
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

        /* Semantic Intent Mapping */
        .intent-primary { background: var(--intent-primary, #3b82f6); }
        .intent-success { background: var(--intent-success, #10b981); }
        .intent-danger { background: var(--intent-danger, #ef4444); }
        .intent-warning { background: var(--intent-warning, #f59e0b); color: #000000; } /* Amber needs dark text */
        .intent-highlight { background: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { background: var(--intent-neutral, #64748b); }
    `;constructor(){super(),this.label="Submit",this.loadingLabel="\u23F3...",this.successLabel="\u2705",this.errorLabel="\u274C",this.intent="primary",this.status="idle",this.btntype="button",this.disabled=!1,this.active=!1}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.dispatchEvent(new CustomEvent("yv-click",{bubbles:!0,composed:!0,detail:{originalEvent:t}})),this.onClick&&typeof this.onClick=="function")try{this.status="loading",await this.onClick(t),this.status="success",setTimeout(()=>{this.status="idle"},2e3)}catch(e){this.status="error",console.error(e),setTimeout(()=>{this.status="idle"},2e3)}}render(){let t=this.label;this.status==="loading"&&(t=this.loadingLabel),this.status==="success"&&(t=this.successLabel),this.status==="error"&&(t=this.errorLabel);let e=this.intent;return this.status==="success"&&(e="success"),this.status==="error"&&(e="danger"),i`
            <button 
                type="${this.btntype}"
                class="intent-${e} ${this.active?"active":""}" 
                ?disabled=${this.disabled||this.status==="loading"}
                @click=${this._handleClick}>
                ${t}
            </button>
        `}}customElements.define("yenvui-async-btn",YenvuiAsyncBtn);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUFzeW5jQnRuIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIGxhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBsb2FkaW5nTGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHN1Y2Nlc3NMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZXJyb3JMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaW50ZW50OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzdGF0dXM6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGJ0bnR5cGU6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIG9uQ2xpY2s6IHsgdHlwZTogT2JqZWN0IH0sXG4gICAgICAgIGRpc2FibGVkOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgYWN0aXZlOiB7IHR5cGU6IEJvb2xlYW4gfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4OyBcbiAgICAgICAgICAgIHZlcnRpY2FsLWFsaWduOiBtaWRkbGU7XG4gICAgICAgICAgICBtaW4td2lkdGg6IG1heC1jb250ZW50O1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgcGFkZGluZzogdmFyKC0tYnRuLXBhZGRpbmcsIDhweCAxNHB4KTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogdmFyKC0tYnRuLWZvbnQtc2l6ZSwgMC44NXJlbSk7XG4gICAgICAgICAgICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiB2YXIoLS1idG4tZm9udC13ZWlnaHQsIG5vcm1hbCk7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiB2YXIoLS1idG4tYm9yZGVyLXJhZGl1cywgNHB4KTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIG1pbi13aWR0aDogbWF4LWNvbnRlbnQ7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnMgZWFzZSwgdHJhbnNmb3JtIDAuMXMgZWFzZTtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgICB9XG5cbiAgICAgICAgYnV0dG9uOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjEpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBidXR0b246YWN0aXZlOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uOmRpc2FibGVkIHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNztcbiAgICAgICAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uLmFjdGl2ZSB7XG4gICAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAycHggdmFyKC0tdGV4dCwgI2ZmZmZmZik7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4xNSk7XG4gICAgICAgIH1cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjZWM0ODk5ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAzcHggM3B4IDAgI2VhYjMwOCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbjpob3Zlcjpub3QoOmRpc2FibGVkKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZjFmNWY5ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uLmFjdGl2ZSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLyogU2VtYW50aWMgSW50ZW50IE1hcHBpbmcgKi9cbiAgICAgICAgLmludGVudC1wcmltYXJ5IHsgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtc3VjY2VzcyB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1zdWNjZXNzLCAjMTBiOTgxKTsgfVxuICAgICAgICAuaW50ZW50LWRhbmdlciB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1kYW5nZXIsICNlZjQ0NDQpOyB9XG4gICAgICAgIC5pbnRlbnQtd2FybmluZyB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC13YXJuaW5nLCAjZjU5ZTBiKTsgY29sb3I6ICMwMDAwMDA7IH0gLyogQW1iZXIgbmVlZHMgZGFyayB0ZXh0ICovXG4gICAgICAgIC5pbnRlbnQtaGlnaGxpZ2h0IHsgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LWhpZ2hsaWdodCwgIzhiNWNmNik7IH1cbiAgICAgICAgLmludGVudC1uZXV0cmFsIHsgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpOyB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5sYWJlbCA9ICdTdWJtaXQnO1xuICAgICAgICB0aGlzLmxvYWRpbmdMYWJlbCA9ICdcdTIzRjMuLi4nO1xuICAgICAgICB0aGlzLnN1Y2Nlc3NMYWJlbCA9ICdcdTI3MDUnO1xuICAgICAgICB0aGlzLmVycm9yTGFiZWwgPSAnXHUyNzRDJztcbiAgICAgICAgdGhpcy5pbnRlbnQgPSAncHJpbWFyeSc7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gJ2lkbGUnO1xuICAgICAgICB0aGlzLmJ0bnR5cGUgPSAnYnV0dG9uJztcbiAgICAgICAgdGhpcy5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgIH1cbiAgICBhc3luYyBfaGFuZGxlQ2xpY2soZSkge1xuICAgICAgICBpZiAodGhpcy5kaXNhYmxlZCB8fCB0aGlzLnN0YXR1cyA9PT0gJ2xvYWRpbmcnKSB7XG4gICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneXYtY2xpY2snLCB7ICBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsIFxuICAgICAgICAgICAgZGV0YWlsOiB7IG9yaWdpbmFsRXZlbnQ6IGUgfSBcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIC8vIEJyaWRnZSB0aGUgZ2FwIGZvciBsZWdhY3kgaG9zdCBjb21wb25lbnRzIHBhc3NpbmcgZnVuY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICh0aGlzLm9uQ2xpY2sgJiYgdHlwZW9mIHRoaXMub25DbGljayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXR1cyA9ICdsb2FkaW5nJztcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm9uQ2xpY2soZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSAnc3VjY2Vzcyc7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuc3RhdHVzID0gJ2lkbGUnOyB9LCAyMDAwKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gJ2Vycm9yJztcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuc3RhdHVzID0gJ2lkbGUnOyB9LCAyMDAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgbGV0IHRleHQgPSB0aGlzLmxhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdsb2FkaW5nJykgdGV4dCA9IHRoaXMubG9hZGluZ0xhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdzdWNjZXNzJykgdGV4dCA9IHRoaXMuc3VjY2Vzc0xhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdlcnJvcicpIHRleHQgPSB0aGlzLmVycm9yTGFiZWw7XG5cbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBtYXAgdGhlIHN1Y2Nlc3MvZXJyb3Igc3RhdGVzIHRvIHZpc3VhbCBjb2xvciBmZWVkYmFja1xuICAgICAgICBsZXQgYWN0aXZlSW50ZW50ID0gdGhpcy5pbnRlbnQ7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSBhY3RpdmVJbnRlbnQgPSAnc3VjY2Vzcyc7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ2Vycm9yJykgYWN0aXZlSW50ZW50ID0gJ2Rhbmdlcic7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICB0eXBlPVwiJHt0aGlzLmJ0bnR5cGV9XCJcbiAgICAgICAgICAgICAgICBjbGFzcz1cImludGVudC0ke2FjdGl2ZUludGVudH0gJHt0aGlzLmFjdGl2ZSA/ICdhY3RpdmUnIDogJyd9XCIgXG4gICAgICAgICAgICAgICAgP2Rpc2FibGVkPSR7dGhpcy5kaXNhYmxlZCB8fCB0aGlzLnN0YXR1cyA9PT0gJ2xvYWRpbmcnfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsaWNrfT5cbiAgICAgICAgICAgICAgICAke3RleHR9XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1hc3luYy1idG4nLCBZZW52dWlBc3luY0J0bik7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSx1QkFBdUJBLENBQVcsQ0FDM0MsT0FBTyxXQUFhLENBQ2hCLE1BQU8sQ0FBRSxLQUFNLE1BQU8sRUFDdEIsYUFBYyxDQUFFLEtBQU0sTUFBTyxFQUM3QixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLFdBQVksQ0FBRSxLQUFNLE1BQU8sRUFDM0IsT0FBUSxDQUFFLEtBQU0sTUFBTyxFQUN2QixPQUFRLENBQUUsS0FBTSxNQUFPLEVBQ3ZCLFFBQVMsQ0FBRSxLQUFNLE1BQU8sRUFDeEIsUUFBUyxDQUFFLEtBQU0sTUFBTyxFQUN4QixTQUFVLENBQUUsS0FBTSxPQUFRLEVBQzFCLE9BQVEsQ0FBRSxLQUFNLE9BQVEsQ0FDNUIsRUFDQSxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWtFaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLE1BQVEsU0FDYixLQUFLLGFBQWUsWUFDcEIsS0FBSyxhQUFlLFNBQ3BCLEtBQUssV0FBYSxTQUNsQixLQUFLLE9BQVMsVUFDZCxLQUFLLE9BQVMsT0FDZCxLQUFLLFFBQVUsU0FDZixLQUFLLFNBQVcsR0FDaEIsS0FBSyxPQUFTLEVBQ2xCLENBQ0EsTUFBTSxhQUFhRSxFQUFHLENBQ2xCLEdBQUksS0FBSyxVQUFZLEtBQUssU0FBVyxVQUFXLENBQ3hDQSxJQUNBQSxFQUFFLGdCQUFnQixFQUNsQkEsRUFBRSxlQUFlLEdBRXJCLE1BQ0osQ0FTQSxHQVBBLEtBQUssY0FBYyxJQUFJLFlBQVksV0FBWSxDQUMzQyxRQUFTLEdBQ1QsU0FBVSxHQUNWLE9BQVEsQ0FBRSxjQUFlQSxDQUFFLENBQy9CLENBQUMsQ0FBQyxFQUdFLEtBQUssU0FBVyxPQUFPLEtBQUssU0FBWSxXQUN4QyxHQUFJLENBQ0EsS0FBSyxPQUFTLFVBQ2QsTUFBTSxLQUFLLFFBQVFBLENBQUMsRUFDcEIsS0FBSyxPQUFTLFVBQ2QsV0FBVyxJQUFNLENBQUUsS0FBSyxPQUFTLE1BQVEsRUFBRyxHQUFJLENBQ3BELE9BQVNDLEVBQUssQ0FDVixLQUFLLE9BQVMsUUFDZCxRQUFRLE1BQU1BLENBQUcsRUFDakIsV0FBVyxJQUFNLENBQUUsS0FBSyxPQUFTLE1BQVEsRUFBRyxHQUFJLENBQ3BELENBRVIsQ0FFQSxRQUFTLENBQ0wsSUFBSUMsRUFBTyxLQUFLLE1BQ1osS0FBSyxTQUFXLFlBQVdBLEVBQU8sS0FBSyxjQUN2QyxLQUFLLFNBQVcsWUFBV0EsRUFBTyxLQUFLLGNBQ3ZDLEtBQUssU0FBVyxVQUFTQSxFQUFPLEtBQUssWUFHekMsSUFBSUMsRUFBZSxLQUFLLE9BQ3hCLE9BQUksS0FBSyxTQUFXLFlBQVdBLEVBQWUsV0FDMUMsS0FBSyxTQUFXLFVBQVNBLEVBQWUsVUFDckNOO0FBQUE7QUFBQSx3QkFFUyxLQUFLLE9BQU87QUFBQSxnQ0FDSk0sQ0FBWSxJQUFJLEtBQUssT0FBUyxTQUFXLEVBQUU7QUFBQSw0QkFDL0MsS0FBSyxVQUFZLEtBQUssU0FBVyxTQUFTO0FBQUEseUJBQzdDLEtBQUssWUFBWTtBQUFBLGtCQUN4QkQsQ0FBSTtBQUFBO0FBQUEsU0FHbEIsQ0FDSixDQUNBLGVBQWUsT0FBTyxtQkFBb0IsY0FBYyIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIiwgImUiLCAiZXJyIiwgInRleHQiLCAiYWN0aXZlSW50ZW50Il0KfQo=
