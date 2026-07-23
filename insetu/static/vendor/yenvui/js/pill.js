import{LitElement as t,html as e,css as r}from"lit";export class YenvuiPill extends t{static properties={pillId:{type:String},labelText:{type:String},active:{type:Boolean},small:{type:Boolean},variant:{type:String}};static styles=r`
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
    `;constructor(){super(),this.variant="standard"}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}render(){return e`
            <button 
                class="${this.active?"active":"inactive"} ${this.small?"small":""} variant-${this.variant}"
                @click=${this._onClick}>
                ${this.labelText}
            </button>
        `}_onClick(o){this.dispatchEvent(new CustomEvent("yenvui-pill-toggled",{detail:{id:this.pillId,active:!this.active},bubbles:!0,composed:!0}))}}customElements.define("yenvui-pill",YenvuiPill);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVBpbGwgZXh0ZW5kcyBMaXRFbGVtZW50IHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgcGlsbElkOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBsYWJlbFRleHQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGFjdGl2ZTogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIHNtYWxsOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgdmFyaWFudDogeyB0eXBlOiBTdHJpbmcgfSAvLyAnc3RhbmRhcmQnIG9yICd0ZXh0J1xuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgYnV0dG9uIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDRweCA4cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNzVyZW07XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnMsIGNvbG9yIDAuMnMsIGJvcmRlci1jb2xvciAwLjJzO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi5zbWFsbCB7XG4gICAgICAgICAgICBwYWRkaW5nOiAycHggNnB4O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjdyZW07XG4gICAgICAgIH1cblxuICAgICAgICAvKiBTdGFuZGFyZCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXN0YW5kYXJkLmFjdGl2ZSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1idG4sICMzYjgyZjYpO1xuICAgICAgICAgICAgY29sb3I6ICNmZmY7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc3RhbmRhcmQuaW5hY3RpdmUge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgIH1cbiAgICAgICAgLyogVGV4dCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogbm9ybWFsO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQuaW5hY3RpdmUge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQuaW5hY3RpdmU6aG92ZXIge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQuYWN0aXZlIHtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgLyogRS1Jbmsgb3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbi52YXJpYW50LXN0YW5kYXJkLmFjdGl2ZSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IDNweCAwICM5Y2EzYWYgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24udmFyaWFudC10ZXh0LmFjdGl2ZSB7XG4gICAgICAgICAgICBib3JkZXItdG9wOiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudmFyaWFudCA9ICdzdGFuZGFyZCc7XG4gICAgfVxuICAgIFxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS10aGVtZSddIH0pO1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICB9XG4gICAgXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl90aGVtZU9ic2VydmVyKSB0aGlzLl90aGVtZU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gICAgXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgICAgY2xhc3M9XCIke3RoaXMuYWN0aXZlID8gJ2FjdGl2ZScgOiAnaW5hY3RpdmUnfSAke3RoaXMuc21hbGwgPyAnc21hbGwnIDogJyd9IHZhcmlhbnQtJHt0aGlzLnZhcmlhbnR9XCJcbiAgICAgICAgICAgICAgICBAY2xpY2s9JHt0aGlzLl9vbkNsaWNrfT5cbiAgICAgICAgICAgICAgICAke3RoaXMubGFiZWxUZXh0fVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIGA7XG4gICAgfVxuICAgIFxuICAgIF9vbkNsaWNrKGUpIHtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLXBpbGwtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyBpZDogdGhpcy5waWxsSWQsIGFjdGl2ZTogIXRoaXMuYWN0aXZlIH0sXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgfSkpO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLXBpbGwnLCBZZW52dWlQaWxsKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLGNBQUFBLEVBQVksUUFBQUMsRUFBTSxPQUFBQyxNQUFXLE1BRS9CLGFBQU0sbUJBQW1CRixDQUFXLENBQ3ZDLE9BQU8sV0FBYSxDQUNoQixPQUFRLENBQUUsS0FBTSxNQUFPLEVBQ3ZCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsT0FBUSxDQUFFLEtBQU0sT0FBUSxFQUN4QixNQUFPLENBQUUsS0FBTSxPQUFRLEVBQ3ZCLFFBQVMsQ0FBRSxLQUFNLE1BQU8sQ0FDNUIsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErRGhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxRQUFVLFVBQ25CLENBRUEsbUJBQW9CLENBQ2hCLE1BQU0sa0JBQWtCLEVBQ3hCLEtBQUssZUFBaUIsSUFBSSxpQkFBaUIsSUFBTSxDQUM3QyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUFDLEVBQ0QsS0FBSyxlQUFlLFFBQVEsU0FBUyxLQUFNLENBQUUsV0FBWSxHQUFNLGdCQUFpQixDQUFDLFlBQVksQ0FBRSxDQUFDLEVBQ2hHLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBRUEsc0JBQXVCLENBQ25CLE1BQU0scUJBQXFCLEVBQ3ZCLEtBQUssZ0JBQWdCLEtBQUssZUFBZSxXQUFXLENBQzVELENBRUEsUUFBUyxDQUNMLE9BQU9EO0FBQUE7QUFBQSx5QkFFVSxLQUFLLE9BQVMsU0FBVyxVQUFVLElBQUksS0FBSyxNQUFRLFFBQVUsRUFBRSxZQUFZLEtBQUssT0FBTztBQUFBLHlCQUN4RixLQUFLLFFBQVE7QUFBQSxrQkFDcEIsS0FBSyxTQUFTO0FBQUE7QUFBQSxTQUc1QixDQUVBLFNBQVNFLEVBQUcsQ0FDUixLQUFLLGNBQWMsSUFBSSxZQUFZLHNCQUF1QixDQUN0RCxPQUFRLENBQUUsR0FBSSxLQUFLLE9BQVEsT0FBUSxDQUFDLEtBQUssTUFBTyxFQUNoRCxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQ0osQ0FDQSxlQUFlLE9BQU8sY0FBZSxVQUFVIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSJdCn0K
