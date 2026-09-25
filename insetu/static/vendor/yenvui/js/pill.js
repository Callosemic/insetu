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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVBpbGwgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgcGlsbElkOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBsYWJlbFRleHQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGFjdGl2ZTogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIHNtYWxsOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgdmFyaWFudDogeyB0eXBlOiBTdHJpbmcgfSAvLyAnc3RhbmRhcmQnIG9yICd0ZXh0J1xuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgYnV0dG9uIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDRweCA4cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNzVyZW07XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnMsIGNvbG9yIDAuMnMsIGJvcmRlci1jb2xvciAwLjJzO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi5zbWFsbCB7XG4gICAgICAgICAgICBwYWRkaW5nOiAycHggNnB4O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjdyZW07XG4gICAgICAgIH1cblxuICAgICAgICAvKiBTdGFuZGFyZCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXN0YW5kYXJkLmFjdGl2ZSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1idG4sICMzYjgyZjYpO1xuICAgICAgICAgICAgY29sb3I6ICNmZmY7XG4gICAgICAgIH1cbiAgICAgICAgYnV0dG9uLnZhcmlhbnQtc3RhbmRhcmQuaW5hY3RpdmUge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgIH1cbiAgICAgICAgLyogVGV4dCBWYXJpYW50ICovXG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogbm9ybWFsO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQuaW5hY3RpdmUge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQuaW5hY3RpdmU6aG92ZXIge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICB9XG4gICAgICAgIGJ1dHRvbi52YXJpYW50LXRleHQuYWN0aXZlIHtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgLyogRS1Jbmsgb3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbi52YXJpYW50LXN0YW5kYXJkLmFjdGl2ZSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IDNweCAwICM5Y2EzYWYgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24udmFyaWFudC10ZXh0LmFjdGl2ZSB7XG4gICAgICAgICAgICBib3JkZXItdG9wOiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudmFyaWFudCA9ICdzdGFuZGFyZCc7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgIGNsYXNzPVwiJHt0aGlzLmFjdGl2ZSA/ICdhY3RpdmUnIDogJ2luYWN0aXZlJ30gJHt0aGlzLnNtYWxsID8gJ3NtYWxsJyA6ICcnfSB2YXJpYW50LSR7dGhpcy52YXJpYW50fVwiXG4gICAgICAgICAgICAgICAgQGNsaWNrPSR7dGhpcy5fb25DbGlja30+XG4gICAgICAgICAgICAgICAgJHt0aGlzLmxhYmVsVGV4dH1cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICBgO1xuICAgIH1cbiAgICBcbiAgICBfb25DbGljayhlKSB7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1waWxsLXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgaWQ6IHRoaXMucGlsbElkLCBhY3RpdmU6ICF0aGlzLmFjdGl2ZSB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1waWxsJywgWWVudnVpUGlsbCk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSxtQkFBbUJBLENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLE9BQVEsQ0FBRSxLQUFNLE1BQU8sRUFDdkIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixPQUFRLENBQUUsS0FBTSxPQUFRLEVBQ3hCLE1BQU8sQ0FBRSxLQUFNLE9BQVEsRUFDdkIsUUFBUyxDQUFFLEtBQU0sTUFBTyxDQUM1QixFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStEaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLFFBQVUsVUFDbkIsQ0FDQSxRQUFTLENBQ0wsT0FBT0Q7QUFBQTtBQUFBLHlCQUVVLEtBQUssT0FBUyxTQUFXLFVBQVUsSUFBSSxLQUFLLE1BQVEsUUFBVSxFQUFFLFlBQVksS0FBSyxPQUFPO0FBQUEseUJBQ3hGLEtBQUssUUFBUTtBQUFBLGtCQUNwQixLQUFLLFNBQVM7QUFBQTtBQUFBLFNBRzVCLENBRUEsU0FBU0csRUFBRyxDQUNSLEtBQUssY0FBYyxJQUFJLFlBQVksc0JBQXVCLENBQ3RELE9BQVEsQ0FBRSxHQUFJLEtBQUssT0FBUSxPQUFRLENBQUMsS0FBSyxNQUFPLEVBQ2hELFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sQ0FDSixDQUNBLGVBQWUsT0FBTyxjQUFlLFVBQVUiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSIsICJlIl0KfQo=
