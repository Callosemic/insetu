import{LitElement as n,html as i,css as s}from"lit";export class YenvuiAsyncBtn extends n{static properties={label:{type:String},loadingLabel:{type:String},successLabel:{type:String},errorLabel:{type:String},intent:{type:String},status:{type:String},btntype:{type:String}};static styles=s`
        :host { 
            display: inline-block; 
        }
        button {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--btn-padding, 8px 14px);
            font-size: var(--btn-font-size, 0.9rem);
            font-family: inherit;
            font-weight: bold;
            border-radius: var(--btn-border-radius, 4px);
            border: none;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            height: 100%;
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

        /* Semantic Intent Mapping */
        .intent-primary { background: var(--intent-primary, #3b82f6); }
        .intent-success { background: var(--intent-success, #10b981); }
        .intent-danger { background: var(--intent-danger, #ef4444); }
        .intent-warning { background: var(--intent-warning, #f59e0b); color: #000000; } /* Amber needs dark text */
        .intent-highlight { background: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { background: var(--intent-neutral, #64748b); }
    `;constructor(){super(),this.label="Submit",this.loadingLabel="\u23F3...",this.successLabel="\u2705",this.errorLabel="\u274C",this.intent="primary",this.status="idle",this.btntype="button"}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}_handleClick(t){if(this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}this.dispatchEvent(new CustomEvent("yv-click",{bubbles:!0,composed:!0,detail:{originalEvent:t}}))}render(){let t=this.label;this.status==="loading"&&(t=this.loadingLabel),this.status==="success"&&(t=this.successLabel),this.status==="error"&&(t=this.errorLabel);let e=this.intent;return this.status==="success"&&(e="success"),this.status==="error"&&(e="danger"),i`
            <button 
                type="${this.btntype}"
                class="intent-${e}" 
                ?disabled=${this.status==="loading"}
                @click=${this._handleClick}>
                ${t}
            </button>
        `}}customElements.define("yenvui-async-btn",YenvuiAsyncBtn);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUFzeW5jQnRuIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIGxhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBsb2FkaW5nTGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHN1Y2Nlc3NMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZXJyb3JMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaW50ZW50OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzdGF0dXM6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGJ0bnR5cGU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jazsgXG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZywgOHB4IDE0cHgpO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplLCAwLjlyZW0pO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IHZhcigtLWJ0bi1ib3JkZXItcmFkaXVzLCA0cHgpO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGZpbHRlciAwLjJzIGVhc2UsIHRyYW5zZm9ybSAwLjFzIGVhc2U7XG4gICAgICAgICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ1dHRvbjpob3Zlcjpub3QoOmRpc2FibGVkKSB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4xKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYnV0dG9uOmFjdGl2ZTpub3QoOmRpc2FibGVkKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHNjYWxlKDAuOTgpO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbjpkaXNhYmxlZCB7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjc7XG4gICAgICAgICAgICBjdXJzb3I6IG5vdC1hbGxvd2VkO1xuICAgICAgICB9XG4gICAgICAgIC8qIEUtSW5rIEhpZ2ggQ29udHJhc3QgT3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgI2VjNDg5OSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IDNweCAwICNlYWIzMDggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b246aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2YxZjVmOSAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLyogU2VtYW50aWMgSW50ZW50IE1hcHBpbmcgKi9cbiAgICAgICAgLmludGVudC1wcmltYXJ5IHsgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtc3VjY2VzcyB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1zdWNjZXNzLCAjMTBiOTgxKTsgfVxuICAgICAgICAuaW50ZW50LWRhbmdlciB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1kYW5nZXIsICNlZjQ0NDQpOyB9XG4gICAgICAgIC5pbnRlbnQtd2FybmluZyB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC13YXJuaW5nLCAjZjU5ZTBiKTsgY29sb3I6ICMwMDAwMDA7IH0gLyogQW1iZXIgbmVlZHMgZGFyayB0ZXh0ICovXG4gICAgICAgIC5pbnRlbnQtaGlnaGxpZ2h0IHsgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LWhpZ2hsaWdodCwgIzhiNWNmNik7IH1cbiAgICAgICAgLmludGVudC1uZXV0cmFsIHsgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpOyB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5sYWJlbCA9ICdTdWJtaXQnO1xuICAgICAgICB0aGlzLmxvYWRpbmdMYWJlbCA9ICdcdTIzRjMuLi4nO1xuICAgICAgICB0aGlzLnN1Y2Nlc3NMYWJlbCA9ICdcdTI3MDUnO1xuICAgICAgICB0aGlzLmVycm9yTGFiZWwgPSAnXHUyNzRDJztcbiAgICAgICAgdGhpcy5pbnRlbnQgPSAncHJpbWFyeSc7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gJ2lkbGUnO1xuICAgICAgICB0aGlzLmJ0bnR5cGUgPSAnYnV0dG9uJztcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtdGhlbWUnXSB9KTtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl90aGVtZU9ic2VydmVyKSB0aGlzLl90aGVtZU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG5cbiAgICBfaGFuZGxlQ2xpY2soZSkge1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdsb2FkaW5nJykge1xuICAgICAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3l2LWNsaWNrJywgeyBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsIFxuICAgICAgICAgICAgZGV0YWlsOiB7IG9yaWdpbmFsRXZlbnQ6IGUgfSBcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgbGV0IHRleHQgPSB0aGlzLmxhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdsb2FkaW5nJykgdGV4dCA9IHRoaXMubG9hZGluZ0xhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdzdWNjZXNzJykgdGV4dCA9IHRoaXMuc3VjY2Vzc0xhYmVsO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdlcnJvcicpIHRleHQgPSB0aGlzLmVycm9yTGFiZWw7XG5cbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBtYXAgdGhlIHN1Y2Nlc3MvZXJyb3Igc3RhdGVzIHRvIHZpc3VhbCBjb2xvciBmZWVkYmFja1xuICAgICAgICBsZXQgYWN0aXZlSW50ZW50ID0gdGhpcy5pbnRlbnQ7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSBhY3RpdmVJbnRlbnQgPSAnc3VjY2Vzcyc7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ2Vycm9yJykgYWN0aXZlSW50ZW50ID0gJ2Rhbmdlcic7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICB0eXBlPVwiJHt0aGlzLmJ0bnR5cGV9XCJcbiAgICAgICAgICAgICAgICBjbGFzcz1cImludGVudC0ke2FjdGl2ZUludGVudH1cIiBcbiAgICAgICAgICAgICAgICA/ZGlzYWJsZWQ9JHt0aGlzLnN0YXR1cyA9PT0gJ2xvYWRpbmcnfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsaWNrfT5cbiAgICAgICAgICAgICAgICAke3RleHR9XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1hc3luYy1idG4nLCBZZW52dWlBc3luY0J0bik7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUUvQixhQUFNLHVCQUF1QkYsQ0FBVyxDQUMzQyxPQUFPLFdBQWEsQ0FDaEIsTUFBTyxDQUFFLEtBQU0sTUFBTyxFQUN0QixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixPQUFRLENBQUUsS0FBTSxNQUFPLEVBQ3ZCLE9BQVEsQ0FBRSxLQUFNLE1BQU8sRUFDdkIsUUFBUyxDQUFFLEtBQU0sTUFBTyxDQUM1QixFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUF1RGhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxNQUFRLFNBQ2IsS0FBSyxhQUFlLFlBQ3BCLEtBQUssYUFBZSxTQUNwQixLQUFLLFdBQWEsU0FDbEIsS0FBSyxPQUFTLFVBQ2QsS0FBSyxPQUFTLE9BQ2QsS0FBSyxRQUFVLFFBQ25CLENBRUEsbUJBQW9CLENBQ2hCLE1BQU0sa0JBQWtCLEVBQ3hCLEtBQUssZUFBaUIsSUFBSSxpQkFBaUIsSUFBTSxDQUM3QyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUFDLEVBQ0QsS0FBSyxlQUFlLFFBQVEsU0FBUyxLQUFNLENBQUUsV0FBWSxHQUFNLGdCQUFpQixDQUFDLFlBQVksQ0FBRSxDQUFDLEVBQ2hHLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBRUEsc0JBQXVCLENBQ25CLE1BQU0scUJBQXFCLEVBQ3ZCLEtBQUssZ0JBQWdCLEtBQUssZUFBZSxXQUFXLENBQzVELENBRUEsYUFBYUMsRUFBRyxDQUNaLEdBQUksS0FBSyxTQUFXLFVBQVcsQ0FDdkJBLElBQ0FBLEVBQUUsZ0JBQWdCLEVBQ2xCQSxFQUFFLGVBQWUsR0FFckIsTUFDSixDQUVBLEtBQUssY0FBYyxJQUFJLFlBQVksV0FBWSxDQUMzQyxRQUFTLEdBQ1QsU0FBVSxHQUNWLE9BQVEsQ0FBRSxjQUFlQSxDQUFFLENBQy9CLENBQUMsQ0FBQyxDQUNOLENBRUEsUUFBUyxDQUNMLElBQUlDLEVBQU8sS0FBSyxNQUNaLEtBQUssU0FBVyxZQUFXQSxFQUFPLEtBQUssY0FDdkMsS0FBSyxTQUFXLFlBQVdBLEVBQU8sS0FBSyxjQUN2QyxLQUFLLFNBQVcsVUFBU0EsRUFBTyxLQUFLLFlBR3pDLElBQUlDLEVBQWUsS0FBSyxPQUN4QixPQUFJLEtBQUssU0FBVyxZQUFXQSxFQUFlLFdBQzFDLEtBQUssU0FBVyxVQUFTQSxFQUFlLFVBQ3JDSjtBQUFBO0FBQUEsd0JBRVMsS0FBSyxPQUFPO0FBQUEsZ0NBQ0pJLENBQVk7QUFBQSw0QkFDaEIsS0FBSyxTQUFXLFNBQVM7QUFBQSx5QkFDNUIsS0FBSyxZQUFZO0FBQUEsa0JBQ3hCRCxDQUFJO0FBQUE7QUFBQSxTQUdsQixDQUNKLENBQ0EsZUFBZSxPQUFPLG1CQUFvQixjQUFjIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJ0ZXh0IiwgImFjdGl2ZUludGVudCJdCn0K
