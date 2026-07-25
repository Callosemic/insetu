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
            padding: 0 20px 0 16px;
            margin: 0;
            overflow-x: auto;
            align-items: center;
            height: 54px; /* Standardizes the top-bar height globally */
            scrollbar-width: none;
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
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
            color: var(--pane-bg, #ffffff);
            background: var(--intent-primary);
        }
        /* Sub-tab variant styles */
        :host([variant="sub"]) .tabs-container {
            padding: 0 20px 0 18px;
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
                <div style="display: flex; align-items: center; padding-right: 20px;">
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRhYnMgZXh0ZW5kcyBMaXRFbGVtZW50IHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGFiczogeyB0eXBlOiBBcnJheSB9LCAvLyBFeHBlY3RlZCBmb3JtYXQ6IFt7IGlkOiAnc3RyaW5nJywgbGFiZWw6ICdzdHJpbmcnLCBjb21wb25lbnQ/OiAnc3RyaW5nJyB9XVxuICAgICAgICBhY3RpdmVUYWI6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHZhcmlhbnQ6IHsgdHlwZTogU3RyaW5nLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGNhY2hlVmlld3M6IHsgdHlwZTogQm9vbGVhbiB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgIH1cbiAgICAgICAgLnRhYnMtY29udGFpbmVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMjBweCAwIDE2cHg7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICBvdmVyZmxvdy14OiBhdXRvO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGhlaWdodDogNTRweDsgLyogU3RhbmRhcmRpemVzIHRoZSB0b3AtYmFyIGhlaWdodCBnbG9iYWxseSAqL1xuICAgICAgICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctZGVlcCk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG4gICAgICAgIC50YWJzLWNvbnRhaW5lcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICAudGFiLWJ0biB7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC50YWItYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICAudGFiLWJ0bi5hY3RpdmUge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXBhbmUtYmcsICNmZmZmZmYpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LXByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIC8qIFN1Yi10YWIgdmFyaWFudCBzdHlsZXMgKi9cbiAgICAgICAgOmhvc3QoW3ZhcmlhbnQ9XCJzdWJcIl0pIC50YWJzLWNvbnRhaW5lciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDIwcHggMCAxOHB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFt2YXJpYW50PVwic3ViXCJdKSAudGFiLWJ0biB7XG4gICAgICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDEycHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbdmFyaWFudD1cInN1YlwiXSkgLnRhYi1idG46aG92ZXIge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3ZhcmlhbnQ9XCJzdWJcIl0pIC50YWItYnRuLmFjdGl2ZSB7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDJweCBzb2xpZCB2YXIoLS1pbnRlbnQtcHJpbWFyeSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRhYnMtaGVhZGVyLXdyYXAge1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXTpub3QoW3ZhcmlhbnQ9XCJzdWJcIl0pKSAudGFicy1oZWFkZXItd3JhcCB7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgI2Q5NDZlZiAhaW1wb3J0YW50OyAvKiBGdWNoc2lhIGhlYWRlciBzZXBhcmF0b3IgKi9cbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAudGFiLWJ0biB7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnRhYi1idG46aG92ZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAudGFiLWJ0bi5hY3RpdmUge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMzYjgyZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDNweCAtM3B4IDAgIzEwYjk4MSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl1bdmFyaWFudD1cInN1YlwiXSkgLnRhYi1idG4uYWN0aXZlIHtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogNHB4IHNvbGlkICNmOTczMTYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAuY29udGVudC1jb250YWluZXIge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgbWluLWhlaWdodDogMDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZyk7XG4gICAgICAgIH1cbiAgICBgO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnRhYnMgPSBbXTtcbiAgICAgICAgdGhpcy5hY3RpdmVUYWIgPSAnJztcbiAgICAgICAgdGhpcy52YXJpYW50ID0gJ3ByaW1hcnknO1xuICAgICAgICB0aGlzLmNhY2hlVmlld3MgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50Q2FjaGUgPSBuZXcgTWFwKCk7XG4gICAgfVxuXG4gICAgX3JlbmRlclZpZXdDb250ZW50KHRhYikge1xuICAgICAgICBpZiAoIXRoaXMuX2NvbXBvbmVudENhY2hlLmhhcyh0YWIuaWQpKSB7XG4gICAgICAgICAgICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFiLmNvbXBvbmVudCk7XG4gICAgICAgICAgICBlbC5kYXRhc2V0LnN1YklkID0gdGFiLmlkO1xuICAgICAgICAgICAgLy8gQWRkIGlkZW50aWZ5aW5nIGNsYXNzIGZvciBlYXN5IHRhcmdldGluZ1xuICAgICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc2NyZWVuJywgJ2FjdGl2ZScpO1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50Q2FjaGUuc2V0KHRhYi5pZCwgZWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRDYWNoZS5nZXQodGFiLmlkKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtdGhlbWUnXSB9KTtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl90aGVtZU9ic2VydmVyKSB0aGlzLl90aGVtZU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG5cbiAgICBfaGFuZGxlVGFiQ2xpY2sodGFiSWQpIHtcbiAgICAgICAgLy8gRW1pdHMgdGhlIGludGVudCB0byBjaGFuZ2UgdGFicywgbWFpbnRhaW5pbmcgc3RyaWN0IFVERiBwdXJpdHlcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLXRhYi1zZWxlY3RlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyB0YWJJZCB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICBjb25zdCBpc1N1YiA9IHRoaXMudmFyaWFudCA9PT0gJ3N1Yic7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRhYnMtaGVhZGVyLXdyYXBcIiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IHdpZHRoOiAxMDAlOyBiYWNrZ3JvdW5kOiAke2lzU3ViID8gJ3ZhcigtLWJnKScgOiAndmFyKC0tYmctZGVlcCknfTsgZmxleC1zaHJpbms6IDA7IGhlaWdodDogJHtpc1N1YiA/ICc0NHB4JyA6ICc1NHB4J307XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRhYnMtY29udGFpbmVyXCIgc3R5bGU9XCJib3JkZXItYm90dG9tOiBub25lOyBmbGV4OiAxOyBoZWlnaHQ6IDEwMCU7IGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1wiPlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMudGFicy5tYXAodGFiID0+IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGFiLWJ0biAke3RoaXMuYWN0aXZlVGFiID09PSB0YWIuaWQgPyAnYWN0aXZlJyA6ICcnfVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KCkgPT4gdGhpcy5faGFuZGxlVGFiQ2xpY2sodGFiLmlkKX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0YWIubGFiZWx9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgYCl9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPCEtLSBQcm9qZWN0aW9uIHNsb3QgZm9yIHJpZ2h0LWFsaWduZWQgaGVhZGVyIGl0ZW1zIChlLmcuLCBTZXR0aW5ncyBkcm9wZG93bikgLS0+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IHBhZGRpbmctcmlnaHQ6IDIwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJoZWFkZXItYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtY29udGFpbmVyXCI+XG4gICAgICAgICAgICAgICAgJHt0aGlzLmNhY2hlVmlld3MgPyB0aGlzLnRhYnMubWFwKHRhYiA9PiBodG1sYFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogJHt0aGlzLmFjdGl2ZVRhYiA9PT0gdGFiLmlkID8gJ2ZsZXgnIDogJ25vbmUnfTsgZmxleDogMTsgaGVpZ2h0OiAxMDAlOyBtaW4taGVpZ2h0OiAwOyBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1wiIGNsYXNzPVwieWVudnVpLXRhYi12aWV3XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAke3RhYi5jb21wb25lbnQgPyB0aGlzLl9yZW5kZXJWaWV3Q29udGVudCh0YWIpIDogaHRtbGA8c2xvdCBuYW1lPVwiJHt0YWIuaWR9XCI+PC9zbG90PmB9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIGApIDogJyd9XG4gICAgICAgICAgICAgICAgPCEtLSBGYWxsYmFjayBwcm9qZWN0aW9uIHNsb3QgZm9yIGdsb2JhbCBvciB1bnNsb3R0ZWQgaG9zdCBsb2dpYyAtLT5cbiAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS10YWJzJywgWWVudnVpVGFicyk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUUvQixhQUFNLG1CQUFtQkYsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsS0FBTSxDQUFFLEtBQU0sS0FBTSxFQUNwQixVQUFXLENBQUUsS0FBTSxNQUFPLEVBQzFCLFFBQVMsQ0FBRSxLQUFNLE9BQVEsUUFBUyxFQUFLLEVBQ3ZDLFdBQVksQ0FBRSxLQUFNLE9BQVEsQ0FDaEMsRUFFQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUEyR2hCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxLQUFPLENBQUMsRUFDYixLQUFLLFVBQVksR0FDakIsS0FBSyxRQUFVLFVBQ2YsS0FBSyxXQUFhLEdBQ2xCLEtBQUssZ0JBQWtCLElBQUksR0FDL0IsQ0FFQSxtQkFBbUJDLEVBQUssQ0FDcEIsR0FBSSxDQUFDLEtBQUssZ0JBQWdCLElBQUlBLEVBQUksRUFBRSxFQUFHLENBQ25DLE1BQU1DLEVBQUssU0FBUyxjQUFjRCxFQUFJLFNBQVMsRUFDL0NDLEVBQUcsUUFBUSxNQUFRRCxFQUFJLEdBRXZCQyxFQUFHLFVBQVUsSUFBSSxTQUFVLFFBQVEsRUFDbkMsS0FBSyxnQkFBZ0IsSUFBSUQsRUFBSSxHQUFJQyxDQUFFLENBQ3ZDLENBQ0EsT0FBTyxLQUFLLGdCQUFnQixJQUFJRCxFQUFJLEVBQUUsQ0FDMUMsQ0FFQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxlQUFpQixJQUFJLGlCQUFpQixJQUFNLENBQzdDLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBQUMsRUFDRCxLQUFLLGVBQWUsUUFBUSxTQUFTLEtBQU0sQ0FBRSxXQUFZLEdBQU0sZ0JBQWlCLENBQUMsWUFBWSxDQUFFLENBQUMsRUFDaEcsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FFQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDdkIsS0FBSyxnQkFBZ0IsS0FBSyxlQUFlLFdBQVcsQ0FDNUQsQ0FFQSxnQkFBZ0JFLEVBQU8sQ0FFbkIsS0FBSyxjQUFjLElBQUksWUFBWSxzQkFBdUIsQ0FDdEQsT0FBUSxDQUFFLE1BQUFBLENBQU0sRUFDaEIsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsQ0FDTixDQUNBLFFBQVMsQ0FDTCxNQUFNQyxFQUFRLEtBQUssVUFBWSxNQUMvQixPQUFPTDtBQUFBLDJGQUM0RUssRUFBUSxZQUFjLGdCQUFnQiw2QkFBNkJBLEVBQVEsT0FBUyxNQUFNO0FBQUE7QUFBQSxzQkFFL0osS0FBSyxLQUFLLElBQUlILEdBQU9GO0FBQUE7QUFBQSw2Q0FFRSxLQUFLLFlBQWNFLEVBQUksR0FBSyxTQUFXLEVBQUU7QUFBQSxxQ0FDakQsSUFBTSxLQUFLLGdCQUFnQkEsRUFBSSxFQUFFLENBQUM7QUFBQSw4QkFDekNBLEVBQUksS0FBSztBQUFBO0FBQUEscUJBRWxCLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGtCQVFKLEtBQUssV0FBYSxLQUFLLEtBQUssSUFBSUEsR0FBT0Y7QUFBQSwyQ0FDZCxLQUFLLFlBQWNFLEVBQUksR0FBSyxPQUFTLE1BQU07QUFBQSwwQkFDNURBLEVBQUksVUFBWSxLQUFLLG1CQUFtQkEsQ0FBRyxFQUFJRixnQkFBbUJFLEVBQUksRUFBRSxXQUFXO0FBQUE7QUFBQSxpQkFFNUYsRUFBSSxFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FLbkIsQ0FDSixDQUNBLGVBQWUsT0FBTyxjQUFlLFVBQVUiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJ0YWIiLCAiZWwiLCAidGFiSWQiLCAiaXNTdWIiXQp9Cg==
