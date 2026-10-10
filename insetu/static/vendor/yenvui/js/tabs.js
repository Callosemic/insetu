import{html as e,css as r}from"lit";import{YenvuiBase as i}from"./yenvui-base.js";export class YenvuiTabs extends i{static properties={tabs:{type:Array},activeTab:{type:String},variant:{type:String,reflect:!0},cacheViews:{type:Boolean}};static styles=r`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .tabs-container {
            display: flex;
            gap: 2px;
            padding: 0 15px 0 2px;
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
            padding: 6px 10px;
            cursor: pointer;
            font-weight: 500;
            color: var(--text-muted);
            background: transparent;
            border-radius: 4px;
            white-space: nowrap;
            border: 2px solid transparent;
            box-sizing: border-box;
            font-size: 0.9rem;
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
            padding: 0 15px;
        }
        :host([variant="sub"]) .tab-btn {
            height: 100%;
            border-radius: 0;
            background: transparent;
            color: var(--text-muted);
            border: none;
            border-bottom: 2px solid transparent;
            padding: 0 3px;
            margin-right: 12px;
            display: flex;
            align-items: center;
        }
        :host([variant="sub"]) .tab-btn:last-child {
            margin-right: 0;
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
            font-weight: 600 !important;
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
            container-type: inline-size;
        }
    `;constructor(){super(),this.tabs=[],this.activeTab="",this.variant="primary",this.cacheViews=!0}_handleTabClick(a){this.dispatchEvent(new CustomEvent("yenvui-tab-selected",{detail:{tabId:a},bubbles:!0,composed:!0}))}render(){const a=this.variant==="sub";return e`
            <div class="tabs-header-wrap" style="display: flex; width: 100%; background: ${a?"var(--bg)":"var(--bg-deep)"}; flex-shrink: 0; height: ${a?"44px":"54px"};">
                <div class="tabs-container" style="border-bottom: none; flex: 1; height: 100%; background: transparent;">
                    ${this.tabs.map(t=>e`
                        <button 
                            class="tab-btn ${this.activeTab===t.id?"active":""}"
                            @click=${()=>this._handleTabClick(t.id)}>
                            ${t.label}
                        </button>
                    `)}
                </div>
                <!-- Projection slot for right-aligned header items (e.g., Settings dropdown) -->
                <div style="display: flex; align-items: stretch; padding-right: 0;">
                    <slot name="header-actions"></slot>
                </div>
            </div>
            <div class="content-container">
                ${this.cacheViews?this.tabs.map(t=>e`
                    <div style="display: ${this.activeTab===t.id?"flex":"none"}; flex: 1; height: 100%; min-height: 0; flex-direction: column;" class="yenvui-tab-view">
                        <slot name="${t.id}"></slot>
                    </div>
                `):""}
                <!-- Fallback projection slot for global or unslotted host logic -->
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-tabs",YenvuiTabs);
