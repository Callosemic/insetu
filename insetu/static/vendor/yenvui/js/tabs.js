import{LitElement,html,css}from'lit';export class YenvuiTabs extends LitElement{static properties={tabs:{type:Array},activeTab:{type:String}};static styles=css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .tabs-container {
            display: flex;
            gap: 8px;
            padding: 0 20px;
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
            color: #fff;
            background: var(--intent-primary);
        }
        .content-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: var(--bg);
        }
    `;constructor(){super();this.tabs=[];this.activeTab='';}
_handleTabClick(tabId){this.dispatchEvent(new CustomEvent('yenvui-tab-selected',{detail:{tabId},bubbles:true,composed:true}));}
render(){return html`
            <div class="tabs-container">
                ${this.tabs.map(tab => html`<button
class="tab-btn ${this.activeTab === tab.id ? 'active' : ''}"@click=${()=>this._handleTabClick(tab.id)}>${tab.label}</button>`)}
                <!-- Projection slot for right-aligned header items (e.g., Settings dropdown) -->
                <div style="margin-left: auto; display: flex; align-items: center;">
                    <slot name="header-actions"></slot>
                </div>
            </div>
            <div class="content-container">
                <!-- Projection slot for the host application's active view logic -->
                <slot></slot>
            </div>
        `;}}
customElements.define('yenvui-tabs',YenvuiTabs);