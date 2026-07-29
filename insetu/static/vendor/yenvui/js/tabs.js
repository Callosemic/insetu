import{LitElement as r,html as a,css as n}from"lit";export class YenvuiTabs extends r{static properties={tabs:{type:Array},activeTab:{type:String},variant:{type:String,reflect:!0},cacheViews:{type:Boolean}};static styles=n`
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
            color: #ffffff;
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
    `;constructor(){super(),this.tabs=[],this.activeTab="",this.variant="primary",this.cacheViews=!1,this._componentCache=new Map}_renderViewContent(e){if(!this._componentCache.has(e.id)){const t=document.createElement(e.component);t.dataset.subId=e.id,t.classList.add("screen","active"),this._componentCache.set(e.id,t)}return this._componentCache.get(e.id)}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}_handleTabClick(e){this.dispatchEvent(new CustomEvent("yenvui-tab-selected",{detail:{tabId:e},bubbles:!0,composed:!0}))}render(){const e=this.variant==="sub";return a`
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
                        ${t.component?this._renderViewContent(t):a`<slot name="${t.id}"></slot>`}
                    </div>
                `):""}
                <!-- Fallback projection slot for global or unslotted host logic -->
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-tabs",YenvuiTabs);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRhYnMgZXh0ZW5kcyBMaXRFbGVtZW50IHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGFiczogeyB0eXBlOiBBcnJheSB9LCAvLyBFeHBlY3RlZCBmb3JtYXQ6IFt7IGlkOiAnc3RyaW5nJywgbGFiZWw6ICdzdHJpbmcnLCBjb21wb25lbnQ/OiAnc3RyaW5nJyB9XVxuICAgICAgICBhY3RpdmVUYWI6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHZhcmlhbnQ6IHsgdHlwZTogU3RyaW5nLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGNhY2hlVmlld3M6IHsgdHlwZTogQm9vbGVhbiB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgIH1cbiAgICAgICAgLnRhYnMtY29udGFpbmVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCAwIDNweDtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIG92ZXJmbG93LXg6IGF1dG87XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgaGVpZ2h0OiA1NHB4OyAvKiBTdGFuZGFyZGl6ZXMgdGhlIHRvcC1iYXIgaGVpZ2h0IGdsb2JhbGx5ICovXG4gICAgICAgICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1kZWVwKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC50YWJzLWNvbnRhaW5lcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICAudGFiLWJ0biB7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC50YWItYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICAudGFiLWJ0bi5hY3RpdmUge1xuICAgICAgICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtcHJpbWFyeSk7XG4gICAgICAgIH1cbiAgICAgICAgLyogU3ViLXRhYiB2YXJpYW50IHN0eWxlcyAqL1xuICAgICAgICA6aG9zdChbdmFyaWFudD1cInN1YlwiXSkgLnRhYnMtY29udGFpbmVyIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCAwIDNweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbdmFyaWFudD1cInN1YlwiXSkgLnRhYi1idG4ge1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgcGFkZGluZzogMCAxMnB4O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3ZhcmlhbnQ9XCJzdWJcIl0pIC50YWItYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFt2YXJpYW50PVwic3ViXCJdKSAudGFiLWJ0bi5hY3RpdmUge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgdmFyKC0taW50ZW50LXByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIC50YWJzLWhlYWRlci13cmFwIHtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl06bm90KFt2YXJpYW50PVwic3ViXCJdKSkgLnRhYnMtaGVhZGVyLXdyYXAge1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkICNkOTQ2ZWYgIWltcG9ydGFudDsgLyogRnVjaHNpYSBoZWFkZXIgc2VwYXJhdG9yICovXG4gICAgICAgIH1cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnRhYi1idG4ge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkIHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC50YWItYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnRhYi1idG4uYWN0aXZlIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjM2I4MmY2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAzcHggLTNweCAwICMxMGI5ODEgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdW3ZhcmlhbnQ9XCJzdWJcIl0pIC50YWItYnRuLmFjdGl2ZSB7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDRweCBzb2xpZCAjZjk3MzE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLmNvbnRlbnQtY29udGFpbmVyIHtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG1pbi1oZWlnaHQ6IDA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmcpO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy50YWJzID0gW107XG4gICAgICAgIHRoaXMuYWN0aXZlVGFiID0gJyc7XG4gICAgICAgIHRoaXMudmFyaWFudCA9ICdwcmltYXJ5JztcbiAgICAgICAgdGhpcy5jYWNoZVZpZXdzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudENhY2hlID0gbmV3IE1hcCgpO1xuICAgIH1cblxuICAgIF9yZW5kZXJWaWV3Q29udGVudCh0YWIpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb21wb25lbnRDYWNoZS5oYXModGFiLmlkKSkge1xuICAgICAgICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhYi5jb21wb25lbnQpO1xuICAgICAgICAgICAgZWwuZGF0YXNldC5zdWJJZCA9IHRhYi5pZDtcbiAgICAgICAgICAgIC8vIEFkZCBpZGVudGlmeWluZyBjbGFzcyBmb3IgZWFzeSB0YXJnZXRpbmdcbiAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ3NjcmVlbicsICdhY3RpdmUnKTtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudENhY2hlLnNldCh0YWIuaWQsIGVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50Q2FjaGUuZ2V0KHRhYi5pZCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVRhYkNsaWNrKHRhYklkKSB7XG4gICAgICAgIC8vIEVtaXRzIHRoZSBpbnRlbnQgdG8gY2hhbmdlIHRhYnMsIG1haW50YWluaW5nIHN0cmljdCBVREYgcHVyaXR5XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS10YWItc2VsZWN0ZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgdGFiSWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgY29uc3QgaXNTdWIgPSB0aGlzLnZhcmlhbnQgPT09ICdzdWInO1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0YWJzLWhlYWRlci13cmFwXCIgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyB3aWR0aDogMTAwJTsgYmFja2dyb3VuZDogJHtpc1N1YiA/ICd2YXIoLS1iZyknIDogJ3ZhcigtLWJnLWRlZXApJ307IGZsZXgtc2hyaW5rOiAwOyBoZWlnaHQ6ICR7aXNTdWIgPyAnNDRweCcgOiAnNTRweCd9O1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0YWJzLWNvbnRhaW5lclwiIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogbm9uZTsgZmxleDogMTsgaGVpZ2h0OiAxMDAlOyBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcIj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLnRhYnMubWFwKHRhYiA9PiBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRhYi1idG4gJHt0aGlzLmFjdGl2ZVRhYiA9PT0gdGFiLmlkID8gJ2FjdGl2ZScgOiAnJ31cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEBjbGljaz0keygpID0+IHRoaXMuX2hhbmRsZVRhYkNsaWNrKHRhYi5pZCl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGFiLmxhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIGApfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwhLS0gUHJvamVjdGlvbiBzbG90IGZvciByaWdodC1hbGlnbmVkIGhlYWRlciBpdGVtcyAoZS5nLiwgU2V0dGluZ3MgZHJvcGRvd24pIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBwYWRkaW5nLXJpZ2h0OiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiaGVhZGVyLWFjdGlvbnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgICR7dGhpcy5jYWNoZVZpZXdzID8gdGhpcy50YWJzLm1hcCh0YWIgPT4gaHRtbGBcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ICR7dGhpcy5hY3RpdmVUYWIgPT09IHRhYi5pZCA/ICdmbGV4JyA6ICdub25lJ307IGZsZXg6IDE7IGhlaWdodDogMTAwJTsgbWluLWhlaWdodDogMDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcIiBjbGFzcz1cInllbnZ1aS10YWItdmlld1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgJHt0YWIuY29tcG9uZW50ID8gdGhpcy5fcmVuZGVyVmlld0NvbnRlbnQodGFiKSA6IGh0bWxgPHNsb3QgbmFtZT1cIiR7dGFiLmlkfVwiPjwvc2xvdD5gfVxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBgKSA6ICcnfVxuICAgICAgICAgICAgICAgIDwhLS0gRmFsbGJhY2sgcHJvamVjdGlvbiBzbG90IGZvciBnbG9iYWwgb3IgdW5zbG90dGVkIGhvc3QgbG9naWMgLS0+XG4gICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktdGFicycsIFllbnZ1aVRhYnMpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSxtQkFBbUJGLENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLEtBQU0sQ0FBRSxLQUFNLEtBQU0sRUFDcEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixRQUFTLENBQUUsS0FBTSxPQUFRLFFBQVMsRUFBSyxFQUN2QyxXQUFZLENBQUUsS0FBTSxPQUFRLENBQ2hDLEVBRUEsT0FBTyxPQUFTRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUE0R2hCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxLQUFPLENBQUMsRUFDYixLQUFLLFVBQVksR0FDakIsS0FBSyxRQUFVLFVBQ2YsS0FBSyxXQUFhLEdBQ2xCLEtBQUssZ0JBQWtCLElBQUksR0FDL0IsQ0FFQSxtQkFBbUJDLEVBQUssQ0FDcEIsR0FBSSxDQUFDLEtBQUssZ0JBQWdCLElBQUlBLEVBQUksRUFBRSxFQUFHLENBQ25DLE1BQU1DLEVBQUssU0FBUyxjQUFjRCxFQUFJLFNBQVMsRUFDL0NDLEVBQUcsUUFBUSxNQUFRRCxFQUFJLEdBRXZCQyxFQUFHLFVBQVUsSUFBSSxTQUFVLFFBQVEsRUFDbkMsS0FBSyxnQkFBZ0IsSUFBSUQsRUFBSSxHQUFJQyxDQUFFLENBQ3ZDLENBQ0EsT0FBTyxLQUFLLGdCQUFnQixJQUFJRCxFQUFJLEVBQUUsQ0FDMUMsQ0FFQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxlQUFpQixJQUFJLGlCQUFpQixJQUFNLENBQzdDLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBQUMsRUFDRCxLQUFLLGVBQWUsUUFBUSxTQUFTLEtBQU0sQ0FBRSxXQUFZLEdBQU0sZ0JBQWlCLENBQUMsWUFBWSxDQUFFLENBQUMsRUFDaEcsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FFQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDdkIsS0FBSyxnQkFBZ0IsS0FBSyxlQUFlLFdBQVcsQ0FDNUQsQ0FFQSxnQkFBZ0JFLEVBQU8sQ0FFbkIsS0FBSyxjQUFjLElBQUksWUFBWSxzQkFBdUIsQ0FDdEQsT0FBUSxDQUFFLE1BQUFBLENBQU0sRUFDaEIsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsQ0FDTixDQUNBLFFBQVMsQ0FDTCxNQUFNQyxFQUFRLEtBQUssVUFBWSxNQUMvQixPQUFPTDtBQUFBLDJGQUM0RUssRUFBUSxZQUFjLGdCQUFnQiw2QkFBNkJBLEVBQVEsT0FBUyxNQUFNO0FBQUE7QUFBQSxzQkFFL0osS0FBSyxLQUFLLElBQUlILEdBQU9GO0FBQUE7QUFBQSw2Q0FFRSxLQUFLLFlBQWNFLEVBQUksR0FBSyxTQUFXLEVBQUU7QUFBQSxxQ0FDakQsSUFBTSxLQUFLLGdCQUFnQkEsRUFBSSxFQUFFLENBQUM7QUFBQSw4QkFDekNBLEVBQUksS0FBSztBQUFBO0FBQUEscUJBRWxCLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGtCQVFKLEtBQUssV0FBYSxLQUFLLEtBQUssSUFBSUEsR0FBT0Y7QUFBQSwyQ0FDZCxLQUFLLFlBQWNFLEVBQUksR0FBSyxPQUFTLE1BQU07QUFBQSwwQkFDNURBLEVBQUksVUFBWSxLQUFLLG1CQUFtQkEsQ0FBRyxFQUFJRixnQkFBbUJFLEVBQUksRUFBRSxXQUFXO0FBQUE7QUFBQSxpQkFFNUYsRUFBSSxFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FLbkIsQ0FDSixDQUNBLGVBQWUsT0FBTyxjQUFlLFVBQVUiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJ0YWIiLCAiZWwiLCAidGFiSWQiLCAiaXNTdWIiXQp9Cg==
