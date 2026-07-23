import{LitElement as n,html as i,css as s}from"lit";export class YenvuiAsyncBtn extends n{static properties={label:{type:String},loadingLabel:{type:String},successLabel:{type:String},errorLabel:{type:String},intent:{type:String},status:{type:String},btntype:{type:String}};static styles=s`
        :host { 
            display: inline-block; 
        }
        button {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 8px 14px;
            font-size: 0.9rem;
            font-family: inherit;
            font-weight: bold;
            border-radius: 4px;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUFzeW5jQnRuIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIGxhYmVsOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBsb2FkaW5nTGFiZWw6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHN1Y2Nlc3NMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZXJyb3JMYWJlbDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaW50ZW50OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzdGF0dXM6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGJ0bnR5cGU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jazsgXG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICBwYWRkaW5nOiA4cHggMTRweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBmaWx0ZXIgMC4ycyBlYXNlLCB0cmFuc2Zvcm0gMC4xcyBlYXNlO1xuICAgICAgICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICAgIH1cblxuICAgICAgICBidXR0b246aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGJ1dHRvbjphY3RpdmU6bm90KDpkaXNhYmxlZCkge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjk4KTtcbiAgICAgICAgfVxuICAgICAgICBidXR0b246ZGlzYWJsZWQge1xuICAgICAgICAgICAgb3BhY2l0eTogMC43O1xuICAgICAgICAgICAgY3Vyc29yOiBub3QtYWxsb3dlZDtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNlYzQ4OTkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDNweCAzcHggMCAjZWFiMzA4ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmMWY1ZjkgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFNlbWFudGljIEludGVudCBNYXBwaW5nICovXG4gICAgICAgIC5pbnRlbnQtcHJpbWFyeSB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTsgfVxuICAgICAgICAuaW50ZW50LXN1Y2Nlc3MgeyBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtc3VjY2VzcywgIzEwYjk4MSk7IH1cbiAgICAgICAgLmludGVudC1kYW5nZXIgeyBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtZGFuZ2VyLCAjZWY0NDQ0KTsgfVxuICAgICAgICAuaW50ZW50LXdhcm5pbmcgeyBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtd2FybmluZywgI2Y1OWUwYik7IGNvbG9yOiAjMDAwMDAwOyB9IC8qIEFtYmVyIG5lZWRzIGRhcmsgdGV4dCAqL1xuICAgICAgICAuaW50ZW50LWhpZ2hsaWdodCB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtbmV1dHJhbCB7IGJhY2tncm91bmQ6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTsgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMubGFiZWwgPSAnU3VibWl0JztcbiAgICAgICAgdGhpcy5sb2FkaW5nTGFiZWwgPSAnXHUyM0YzLi4uJztcbiAgICAgICAgdGhpcy5zdWNjZXNzTGFiZWwgPSAnXHUyNzA1JztcbiAgICAgICAgdGhpcy5lcnJvckxhYmVsID0gJ1x1Mjc0Qyc7XG4gICAgICAgIHRoaXMuaW50ZW50ID0gJ3ByaW1hcnknO1xuICAgICAgICB0aGlzLnN0YXR1cyA9ICdpZGxlJztcbiAgICAgICAgdGhpcy5idG50eXBlID0gJ2J1dHRvbic7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUNsaWNrKGUpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAnbG9hZGluZycpIHtcbiAgICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5di1jbGljaycsIHsgXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLCBcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLCBcbiAgICAgICAgICAgIGRldGFpbDogeyBvcmlnaW5hbEV2ZW50OiBlIH0gXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIGxldCB0ZXh0ID0gdGhpcy5sYWJlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAnbG9hZGluZycpIHRleHQgPSB0aGlzLmxvYWRpbmdMYWJlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAnc3VjY2VzcycpIHRleHQgPSB0aGlzLnN1Y2Nlc3NMYWJlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAnZXJyb3InKSB0ZXh0ID0gdGhpcy5lcnJvckxhYmVsO1xuXG4gICAgICAgIC8vIEF1dG9tYXRpY2FsbHkgbWFwIHRoZSBzdWNjZXNzL2Vycm9yIHN0YXRlcyB0byB2aXN1YWwgY29sb3IgZmVlZGJhY2tcbiAgICAgICAgbGV0IGFjdGl2ZUludGVudCA9IHRoaXMuaW50ZW50O1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdzdWNjZXNzJykgYWN0aXZlSW50ZW50ID0gJ3N1Y2Nlc3MnO1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09ICdlcnJvcicpIGFjdGl2ZUludGVudCA9ICdkYW5nZXInO1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgICAgdHlwZT1cIiR7dGhpcy5idG50eXBlfVwiXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJpbnRlbnQtJHthY3RpdmVJbnRlbnR9XCIgXG4gICAgICAgICAgICAgICAgP2Rpc2FibGVkPSR7dGhpcy5zdGF0dXMgPT09ICdsb2FkaW5nJ31cbiAgICAgICAgICAgICAgICBAY2xpY2s9JHt0aGlzLl9oYW5kbGVDbGlja30+XG4gICAgICAgICAgICAgICAgJHt0ZXh0fVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktYXN5bmMtYnRuJywgWWVudnVpQXN5bmNCdG4pOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSx1QkFBdUJGLENBQVcsQ0FDM0MsT0FBTyxXQUFhLENBQ2hCLE1BQU8sQ0FBRSxLQUFNLE1BQU8sRUFDdEIsYUFBYyxDQUFFLEtBQU0sTUFBTyxFQUM3QixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLFdBQVksQ0FBRSxLQUFNLE1BQU8sRUFDM0IsT0FBUSxDQUFFLEtBQU0sTUFBTyxFQUN2QixPQUFRLENBQUUsS0FBTSxNQUFPLEVBQ3ZCLFFBQVMsQ0FBRSxLQUFNLE1BQU8sQ0FDNUIsRUFFQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BdURoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssTUFBUSxTQUNiLEtBQUssYUFBZSxZQUNwQixLQUFLLGFBQWUsU0FDcEIsS0FBSyxXQUFhLFNBQ2xCLEtBQUssT0FBUyxVQUNkLEtBQUssT0FBUyxPQUNkLEtBQUssUUFBVSxRQUNuQixDQUVBLG1CQUFvQixDQUNoQixNQUFNLGtCQUFrQixFQUN4QixLQUFLLGVBQWlCLElBQUksaUJBQWlCLElBQU0sQ0FDN0MsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FBQyxFQUNELEtBQUssZUFBZSxRQUFRLFNBQVMsS0FBTSxDQUFFLFdBQVksR0FBTSxnQkFBaUIsQ0FBQyxZQUFZLENBQUUsQ0FBQyxFQUNoRyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUVBLHNCQUF1QixDQUNuQixNQUFNLHFCQUFxQixFQUN2QixLQUFLLGdCQUFnQixLQUFLLGVBQWUsV0FBVyxDQUM1RCxDQUVBLGFBQWFDLEVBQUcsQ0FDWixHQUFJLEtBQUssU0FBVyxVQUFXLENBQ3ZCQSxJQUNBQSxFQUFFLGdCQUFnQixFQUNsQkEsRUFBRSxlQUFlLEdBRXJCLE1BQ0osQ0FFQSxLQUFLLGNBQWMsSUFBSSxZQUFZLFdBQVksQ0FDM0MsUUFBUyxHQUNULFNBQVUsR0FDVixPQUFRLENBQUUsY0FBZUEsQ0FBRSxDQUMvQixDQUFDLENBQUMsQ0FDTixDQUVBLFFBQVMsQ0FDTCxJQUFJQyxFQUFPLEtBQUssTUFDWixLQUFLLFNBQVcsWUFBV0EsRUFBTyxLQUFLLGNBQ3ZDLEtBQUssU0FBVyxZQUFXQSxFQUFPLEtBQUssY0FDdkMsS0FBSyxTQUFXLFVBQVNBLEVBQU8sS0FBSyxZQUd6QyxJQUFJQyxFQUFlLEtBQUssT0FDeEIsT0FBSSxLQUFLLFNBQVcsWUFBV0EsRUFBZSxXQUMxQyxLQUFLLFNBQVcsVUFBU0EsRUFBZSxVQUNyQ0o7QUFBQTtBQUFBLHdCQUVTLEtBQUssT0FBTztBQUFBLGdDQUNKSSxDQUFZO0FBQUEsNEJBQ2hCLEtBQUssU0FBVyxTQUFTO0FBQUEseUJBQzVCLEtBQUssWUFBWTtBQUFBLGtCQUN4QkQsQ0FBSTtBQUFBO0FBQUEsU0FHbEIsQ0FDSixDQUNBLGVBQWUsT0FBTyxtQkFBb0IsY0FBYyIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImUiLCAidGV4dCIsICJhY3RpdmVJbnRlbnQiXQp9Cg==
