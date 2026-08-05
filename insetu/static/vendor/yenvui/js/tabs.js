import{LitElement as r,html as a,css as o}from"lit";export class YenvuiTabs extends r{static properties={tabs:{type:Array},activeTab:{type:String},variant:{type:String,reflect:!0},cacheViews:{type:Boolean}};static styles=o`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .tabs-container {
            display: flex;
            gap: 8px;
            padding: 0 15px 0 3px;
            margin: 0;
            overflow-x: auto;
            align-items: center;
            height: 54px; /* Standardizes the top-bar height globally */
            scrollbar-width: none;
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
            touch-action: pan-x pan-y;
        }
        .tabs-container::-webkit-scrollbar {
            display: none;
        }
        .tab-btn {
            padding: 6px 12px;
            cursor: pointer;
            font-weight: bold;
            color: var(--text-muted);
            background: transparent;
            border-radius: 4px;
            white-space: nowrap;
            border: 2px solid transparent;
            box-sizing: border-box;
            font-size: 0.95rem;
            transition: all 0.2s;
            outline: none;
        }
        .tab-btn:hover {
            background: var(--bg-hover);
            color: var(--text);
        }
        .tab-btn.active {
            color: var(--text-light, #ffffff);
            background: var(--intent-primary);
        }
        /* Sub-tab variant styles */
        :host([variant="sub"]) .tabs-container {
            padding: 0 15px 0 3px;
        }
        :host([variant="sub"]) .tab-btn {
            height: 100%;
            border-radius: 0;
            background: transparent;
            color: var(--text-muted);
            border: none;
            border-bottom: 2px solid transparent;
            padding: 0 12px;
            display: flex;
            align-items: center;
        }
        :host([variant="sub"]) .tab-btn:hover {
            color: var(--text);
            background: transparent;
        }
        :host([variant="sub"]) .tab-btn.active {
            color: var(--text);
            background: transparent;
            border-bottom: 2px solid var(--intent-primary);
        }
        .tabs-header-wrap {
            position: relative;
            border-bottom: 1px solid var(--border);
        }
        :host([data-theme="e-ink"]:not([variant="sub"])) .tabs-header-wrap {
            border-bottom: 2px solid #d946ef !important; /* Fuchsia header separator */
        }
        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) .tab-btn {
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid transparent;
            transition: none !important;
        }
        :host([data-theme="e-ink"]) .tab-btn:hover {
            background: transparent !important;
        }
        :host([data-theme="e-ink"]) .tab-btn.active {
            background: #ffffff !important;
            color: #000000 !important;
            border: 2px solid #3b82f6 !important;
            box-shadow: 3px -3px 0 #10b981 !important;
        }
        :host([data-theme="e-ink"][variant="sub"]) .tab-btn.active {
            border: none !important;
            border-bottom: 4px solid #f97316 !important;
            box-shadow: none !important;
            background: transparent !important;
        }

        .content-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: var(--bg);
        }
    `;constructor(){super(),this.tabs=[],this.activeTab="",this.variant="primary",this.cacheViews=!0}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}_handleTabClick(e){this.dispatchEvent(new CustomEvent("yenvui-tab-selected",{detail:{tabId:e},bubbles:!0,composed:!0}))}render(){const e=this.variant==="sub";return a`
            <div class="tabs-header-wrap" style="display: flex; width: 100%; background: ${e?"var(--bg)":"var(--bg-deep)"}; flex-shrink: 0; height: ${e?"44px":"54px"};">
                <div class="tabs-container" style="border-bottom: none; flex: 1; height: 100%; background: transparent;">
                    ${this.tabs.map(t=>a`
                        <button 
                            class="tab-btn ${this.activeTab===t.id?"active":""}"
                            @click=${()=>this._handleTabClick(t.id)}>
                            ${t.label}
                        </button>
                    `)}
                </div>
                <!-- Projection slot for right-aligned header items (e.g., Settings dropdown) -->
                <div style="display: flex; align-items: center; padding-right: 15px;">
                    <slot name="header-actions"></slot>
                </div>
            </div>
            <div class="content-container">
                ${this.cacheViews?this.tabs.map(t=>a`
                    <div style="display: ${this.activeTab===t.id?"flex":"none"}; flex: 1; height: 100%; min-height: 0; flex-direction: column;" class="yenvui-tab-view">
                        <slot name="${t.id}"></slot>
                    </div>
                `):""}
                <!-- Fallback projection slot for global or unslotted host logic -->
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-tabs",YenvuiTabs);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRhYnMgZXh0ZW5kcyBMaXRFbGVtZW50IHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGFiczogeyB0eXBlOiBBcnJheSB9LCAvLyBFeHBlY3RlZCBmb3JtYXQ6IFt7IGlkOiAnc3RyaW5nJywgbGFiZWw6ICdzdHJpbmcnLCBjb21wb25lbnQ/OiAnc3RyaW5nJyB9XVxuICAgICAgICBhY3RpdmVUYWI6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHZhcmlhbnQ6IHsgdHlwZTogU3RyaW5nLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGNhY2hlVmlld3M6IHsgdHlwZTogQm9vbGVhbiB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgIH1cbiAgICAgICAgLnRhYnMtY29udGFpbmVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCAwIDNweDtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIG92ZXJmbG93LXg6IGF1dG87XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgaGVpZ2h0OiA1NHB4OyAvKiBTdGFuZGFyZGl6ZXMgdGhlIHRvcC1iYXIgaGVpZ2h0IGdsb2JhbGx5ICovXG4gICAgICAgICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1kZWVwKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC50YWJzLWNvbnRhaW5lcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICAudGFiLWJ0biB7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC50YWItYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICAudGFiLWJ0bi5hY3RpdmUge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbGlnaHQsICNmZmZmZmYpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LXByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIC8qIFN1Yi10YWIgdmFyaWFudCBzdHlsZXMgKi9cbiAgICAgICAgOmhvc3QoW3ZhcmlhbnQ9XCJzdWJcIl0pIC50YWJzLWNvbnRhaW5lciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggMCAzcHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3ZhcmlhbnQ9XCJzdWJcIl0pIC50YWItYnRuIHtcbiAgICAgICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDA7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDJweCBzb2xpZCB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTJweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFt2YXJpYW50PVwic3ViXCJdKSAudGFiLWJ0bjpob3ZlciB7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbdmFyaWFudD1cInN1YlwiXSkgLnRhYi1idG4uYWN0aXZlIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkIHZhcigtLWludGVudC1wcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICAudGFicy1oZWFkZXItd3JhcCB7XG4gICAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdOm5vdChbdmFyaWFudD1cInN1YlwiXSkpIC50YWJzLWhlYWRlci13cmFwIHtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDJweCBzb2xpZCAjZDk0NmVmICFpbXBvcnRhbnQ7IC8qIEZ1Y2hzaWEgaGVhZGVyIHNlcGFyYXRvciAqL1xuICAgICAgICB9XG4gICAgICAgIC8qIEUtSW5rIEhpZ2ggQ29udHJhc3QgT3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC50YWItYnRuIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAudGFiLWJ0bjpob3ZlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC50YWItYnRuLmFjdGl2ZSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzNiODJmNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IC0zcHggMCAjMTBiOTgxICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXVt2YXJpYW50PVwic3ViXCJdKSAudGFiLWJ0bi5hY3RpdmUge1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiA0cHggc29saWQgI2Y5NzMxNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5jb250ZW50LWNvbnRhaW5lciB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4taGVpZ2h0OiAwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnKTtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudGFicyA9IFtdO1xuICAgICAgICB0aGlzLmFjdGl2ZVRhYiA9ICcnO1xuICAgICAgICB0aGlzLnZhcmlhbnQgPSAncHJpbWFyeSc7XG4gICAgICAgIHRoaXMuY2FjaGVWaWV3cyA9IHRydWU7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVRhYkNsaWNrKHRhYklkKSB7XG4gICAgICAgIC8vIEVtaXRzIHRoZSBpbnRlbnQgdG8gY2hhbmdlIHRhYnMsIG1haW50YWluaW5nIHN0cmljdCBVREYgcHVyaXR5XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS10YWItc2VsZWN0ZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgdGFiSWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgY29uc3QgaXNTdWIgPSB0aGlzLnZhcmlhbnQgPT09ICdzdWInO1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0YWJzLWhlYWRlci13cmFwXCIgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyB3aWR0aDogMTAwJTsgYmFja2dyb3VuZDogJHtpc1N1YiA/ICd2YXIoLS1iZyknIDogJ3ZhcigtLWJnLWRlZXApJ307IGZsZXgtc2hyaW5rOiAwOyBoZWlnaHQ6ICR7aXNTdWIgPyAnNDRweCcgOiAnNTRweCd9O1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0YWJzLWNvbnRhaW5lclwiIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogbm9uZTsgZmxleDogMTsgaGVpZ2h0OiAxMDAlOyBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcIj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLnRhYnMubWFwKHRhYiA9PiBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRhYi1idG4gJHt0aGlzLmFjdGl2ZVRhYiA9PT0gdGFiLmlkID8gJ2FjdGl2ZScgOiAnJ31cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEBjbGljaz0keygpID0+IHRoaXMuX2hhbmRsZVRhYkNsaWNrKHRhYi5pZCl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGFiLmxhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIGApfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwhLS0gUHJvamVjdGlvbiBzbG90IGZvciByaWdodC1hbGlnbmVkIGhlYWRlciBpdGVtcyAoZS5nLiwgU2V0dGluZ3MgZHJvcGRvd24pIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBwYWRkaW5nLXJpZ2h0OiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiaGVhZGVyLWFjdGlvbnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgICR7dGhpcy5jYWNoZVZpZXdzID8gdGhpcy50YWJzLm1hcCh0YWIgPT4gaHRtbGBcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ICR7dGhpcy5hY3RpdmVUYWIgPT09IHRhYi5pZCA/ICdmbGV4JyA6ICdub25lJ307IGZsZXg6IDE7IGhlaWdodDogMTAwJTsgbWluLWhlaWdodDogMDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcIiBjbGFzcz1cInllbnZ1aS10YWItdmlld1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cIiR7dGFiLmlkfVwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgYCkgOiAnJ31cbiAgICAgICAgICAgICAgICA8IS0tIEZhbGxiYWNrIHByb2plY3Rpb24gc2xvdCBmb3IgZ2xvYmFsIG9yIHVuc2xvdHRlZCBob3N0IGxvZ2ljIC0tPlxuICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLXRhYnMnLCBZZW52dWlUYWJzKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLGNBQUFBLEVBQVksUUFBQUMsRUFBTSxPQUFBQyxNQUFXLE1BRS9CLGFBQU0sbUJBQW1CRixDQUFXLENBQ3ZDLE9BQU8sV0FBYSxDQUNoQixLQUFNLENBQUUsS0FBTSxLQUFNLEVBQ3BCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsUUFBUyxDQUFFLEtBQU0sT0FBUSxRQUFTLEVBQUssRUFDdkMsV0FBWSxDQUFFLEtBQU0sT0FBUSxDQUNoQyxFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUE2R2hCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxLQUFPLENBQUMsRUFDYixLQUFLLFVBQVksR0FDakIsS0FBSyxRQUFVLFVBQ2YsS0FBSyxXQUFhLEVBQ3RCLENBRUEsbUJBQW9CLENBQ2hCLE1BQU0sa0JBQWtCLEVBQ3hCLEtBQUssZUFBaUIsSUFBSSxpQkFBaUIsSUFBTSxDQUM3QyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUFDLEVBQ0QsS0FBSyxlQUFlLFFBQVEsU0FBUyxLQUFNLENBQUUsV0FBWSxHQUFNLGdCQUFpQixDQUFDLFlBQVksQ0FBRSxDQUFDLEVBQ2hHLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBRUEsc0JBQXVCLENBQ25CLE1BQU0scUJBQXFCLEVBQ3ZCLEtBQUssZ0JBQWdCLEtBQUssZUFBZSxXQUFXLENBQzVELENBRUEsZ0JBQWdCQyxFQUFPLENBRW5CLEtBQUssY0FBYyxJQUFJLFlBQVksc0JBQXVCLENBQ3RELE9BQVEsQ0FBRSxNQUFBQSxDQUFNLEVBQ2hCLFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sQ0FDQSxRQUFTLENBQ0wsTUFBTUMsRUFBUSxLQUFLLFVBQVksTUFDL0IsT0FBT0g7QUFBQSwyRkFDNEVHLEVBQVEsWUFBYyxnQkFBZ0IsNkJBQTZCQSxFQUFRLE9BQVMsTUFBTTtBQUFBO0FBQUEsc0JBRS9KLEtBQUssS0FBSyxJQUFJQyxHQUFPSjtBQUFBO0FBQUEsNkNBRUUsS0FBSyxZQUFjSSxFQUFJLEdBQUssU0FBVyxFQUFFO0FBQUEscUNBQ2pELElBQU0sS0FBSyxnQkFBZ0JBLEVBQUksRUFBRSxDQUFDO0FBQUEsOEJBQ3pDQSxFQUFJLEtBQUs7QUFBQTtBQUFBLHFCQUVsQixDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFRSixLQUFLLFdBQWEsS0FBSyxLQUFLLElBQUlBLEdBQU9KO0FBQUEsMkNBQ2QsS0FBSyxZQUFjSSxFQUFJLEdBQUssT0FBUyxNQUFNO0FBQUEsc0NBQ2hEQSxFQUFJLEVBQUU7QUFBQTtBQUFBLGlCQUUzQixFQUFJLEVBQUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUtuQixDQUNKLENBQ0EsZUFBZSxPQUFPLGNBQWUsVUFBVSIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgInRhYklkIiwgImlzU3ViIiwgInRhYiJdCn0K
