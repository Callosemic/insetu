import{html as i,css as r}from"lit";import{YenvuiBase as s}from"./yenvui-base.js";export class YenvuiDropdown extends s{static properties={items:{type:Array},open:{type:Boolean,reflect:!0},align:{type:String},_loadingItemId:{type:String,state:!0}};static styles=r`
        :host { display: block; height: 100%; }
        .dropdown-menu {
            position: absolute;
            top: calc(100% + 5px);
            background: var(--pane-bg, #1e1e1e);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: var(--overlay-shadow);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        :host([align="left"]) .dropdown-menu { left: 0; right: auto; }
        :host([align="right"]) .dropdown-menu { right: 0; left: auto; }
        :host(:not([align])) .dropdown-menu { right: 0; left: auto; }

        .divider { height: 1px; background: var(--border, #444); margin: 4px 0; }
        .menu-item {
            background: transparent; color: var(--text, #e0e0e0); text-align: left; 
            padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; 
            font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; 
            align-items: center; gap: 8px; width: 100%; box-sizing: border-box;
        }
        .menu-item:hover:not(:disabled) { background: var(--input-bg, #2d2d2d); }
        .menu-item:disabled { opacity: 0.7; cursor: not-allowed; }
        .icon { font-size: 1.1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }

        .menu-spinner {
            width: 14px; height: 14px;
            border: 2px solid var(--border, #444);
            border-top: 2px solid var(--intent-primary, #3b82f6);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;constructor(){super(),this.items=[],this.open=!1,this.align="right",this._loadingItemId=null}connectedCallback(){super.connectedCallback(),this.registerOutsideClick&&this.registerOutsideClick(()=>{this.open&&(this.open=!1)})}_toggle(e){this._loadingItemId||(this.open=!this.open)}async _executeItem(e,o){if(!this._loadingItemId){if(e.asyncAction){this._loadingItemId=e.id||e.label;try{await e.asyncAction(o)}catch(t){console.error(t),window.inSetu?.ui?.setGlobalStatus&&window.inSetu.ui.setGlobalStatus(`Action Failed: ${t.message}`,4e3,!0)}finally{this._loadingItemId=null,this.open=!1}}else if(this.open=!1,e.onClick)try{const t=e.onClick(o);t&&typeof t.catch=="function"&&t.catch(n=>{console.error(n),window.inSetu?.ui?.setGlobalStatus&&window.inSetu.ui.setGlobalStatus(`Action Failed: ${n.message}`,4e3,!0)})}catch(t){console.error(t),window.inSetu?.ui?.setGlobalStatus&&window.inSetu.ui.setGlobalStatus(`Action Failed: ${t.message}`,4e3,!0)}}}render(){return i`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                ${this.open&&this.items&&this.items.length>0?i`
                    <div class="dropdown-menu">
                        ${this.items.map(e=>{if(e.divider)return i`<div class="divider"></div>`;const o=this._loadingItemId===(e.id||e.label);return i`
                                <button class="menu-item" ?disabled=${!!this._loadingItemId} @click=${t=>this._executeItem(e,t)}>
                                    <span class="icon">${o?i`<div class="menu-spinner"></div>`:e.icon?/^[a-zA-Z0-9-]+$/.test(e.icon)?i`<yv-icon name="${e.icon}" style="width: 14px; height: 14px;"></yv-icon>`:e.icon:""}</span>
                                    <span>${o?"Processing...":e.label||e.id||"Unknown Action"}</span>
                                </button>
                            `})}
                    </div>
                `:""}
            </div>
        `}}customElements.define("yenvui-dropdown",YenvuiDropdown);export class YenvuiFilterDropdown extends s{static properties={filterText:{type:String},open:{type:Boolean,reflect:!0},hasFilters:{type:Boolean}};static styles=r`
        :host { display: block; position: static; height: 100%; }
        .container { display: flex; align-items: stretch; height: 100%; }
        .panel {
            display: none; position: absolute; top: 100%; left: 0; right: 0;
            z-index: 2000; padding: 15px 20px; background: var(--pane-bg, #1e1e1e); border-bottom: 1px solid var(--border, #444);
            box-shadow: var(--overlay-shadow);
            max-height: 50vh; overflow-y: auto;
        }
        :host([open]) .panel { display: flex; flex-direction: column; }

        .system-action-btn { 
            background: var(--rail-bg, transparent); color: var(--text-muted, #888); border: none;
            border-left: 1px solid var(--border, #444); 
            border-radius: 0; border-top-right-radius: inherit; border-bottom-right-radius: inherit;
            cursor: pointer; font-weight: bold; width: 44px; height: 100%; 
            display: flex; align-items: center; justify-content: center; padding: 0; 
            font-size: 1.1rem; transition: background 0.2s, color 0.2s; margin: 0; box-sizing: border-box;
        }
        .system-action-btn:hover { background: var(--rail-hover, var(--input-bg, #2d2d2d)); color: var(--text); }
        
        .btn {
            padding: 4px 8px; margin: 0; font-size: 0.85rem; white-space: nowrap;
            max-width: 250px; overflow: hidden; text-overflow: ellipsis;
            background: transparent; border: 1px solid transparent; color: var(--text, #e0e0e0);
        }
        :host([open]) .btn { background: var(--input-bg, #2d2d2d); border-color: var(--border, #444); }
    `;constructor(){super(),this.open=!1,this.filterText="Filters",this.hasFilters=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1)})}render(){return i`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${()=>this.open=!this.open} style="opacity: ${this.hasFilters?"1":"0.5"};">
                    <yv-icon name="filter" style="width: 14px; height: 14px;"></yv-icon>
                </button>
                <div class="panel">
                    <slot></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-filter-dropdown",YenvuiFilterDropdown);
