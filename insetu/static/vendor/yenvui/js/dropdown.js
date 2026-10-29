import{html as o,css as s}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";import{syncTopLayerPopover as n,anchorTopLayerPopover as a}from"./physics.js";export class YenvuiDropdown extends r{static properties={items:{type:Array},open:{type:Boolean,reflect:!0},align:{type:String},direction:{type:String},_loadingItemId:{type:String,state:!0}};static styles=s`
        :host { display: inline-flex; align-items: stretch; height: 100%; }
        .dropdown-menu {
            position: fixed;
            margin: 0;
            inset: auto;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: var(--overlay-shadow);
            z-index: 99999;
            display: none;
            flex-direction: column;
            gap: 2px;
            box-sizing: border-box;
        }
        :host([open]) .dropdown-menu,
        .dropdown-menu:popover-open {
            display: flex;
        }

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
    `;constructor(){super(),this.items=[],this.open=!1,this.align="auto",this.direction="auto",this._loadingItemId=null}connectedCallback(){super.connectedCallback(),this.registerOutsideClick&&this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundReposition=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&a(this,e,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:5})}},window.addEventListener("resize",this._boundReposition),window.addEventListener("scroll",this._boundReposition,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundReposition&&(window.removeEventListener("resize",this._boundReposition),window.removeEventListener("scroll",this._boundReposition,!0));const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&n(this,e,!1)}updated(e){if(super.updated(e),e.has("open")||e.has("items")||e.has("align")||e.has("direction")){const t=this.shadowRoot?.querySelector(".dropdown-menu");if(t){const i=!!(this.open&&this.items&&this.items.length>0);n(this,t,i,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:5})}}}_toggle(e){this._loadingItemId||(this.open=!this.open)}_notifyError(e){console.error(e),this.dispatchEvent(new CustomEvent("yenvui-action-error",{detail:{msg:`Action Failed: ${e.message}`,error:e},bubbles:!0,composed:!0}))}async _executeItem(e,t){if(!this._loadingItemId){if(e.asyncAction){this._loadingItemId=e.id||e.label;try{await e.asyncAction(t)}catch(i){this._notifyError(i)}finally{this._loadingItemId=null,this.open=!1}}else if(this.open=!1,e.onClick)try{const i=e.onClick(t);i&&typeof i.catch=="function"&&i.catch(l=>this._notifyError(l))}catch(i){this._notifyError(i)}}}render(){return o`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual">
                    ${(this.items||[]).map(e=>{if(e.divider)return o`<div class="divider"></div>`;const t=this._loadingItemId===(e.id||e.label);return o`
                            <button class="menu-item" ?disabled=${!!this._loadingItemId} @click=${i=>this._executeItem(e,i)}>
                                <span class="icon">${t?o`<div class="menu-spinner"></div>`:e.icon?/^[a-zA-Z0-9-]+$/.test(e.icon)?o`<yv-icon name="${e.icon}" style="width: 14px; height: 14px;"></yv-icon>`:e.icon:""}</span>
                                <span>${t?"Processing...":e.label||e.id||"Unknown Action"}</span>
                            </button>
                        `})}
                </div>
            </div>
        `}}customElements.define("yenvui-dropdown",YenvuiDropdown);export class YenvuiFilterDropdown extends r{static properties={filterText:{type:String},open:{type:Boolean,reflect:!0},hasFilters:{type:Boolean}};static styles=s`
        :host { display: flex; position: static; height: 100%; align-items: stretch; }
        .container { display: flex; align-items: stretch; height: 100%; }
        .panel {
            display: none;
            position: fixed;
            margin: 0;
            inset: auto;
            z-index: 99999;
            padding: 15px 20px;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-top: none;
            box-shadow: var(--overlay-shadow);
            max-height: 50vh;
            overflow-y: auto;
            box-sizing: border-box;
        }
        :host([open]) .panel,
        .panel:popover-open {
            display: flex;
            flex-direction: column;
        }

        .system-action-btn { 
            background: var(--rail-bg, transparent); color: var(--text-muted, #888); border: none;
            border-left: 1px solid var(--border, #444); 
            border-radius: 0; border-top-right-radius: inherit; border-bottom-right-radius: inherit;
            cursor: pointer; font-weight: bold; width: var(--yv-rail-cell-width, 44px); height: 100%; 
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
    `;constructor(){super(),this.open=!1,this.filterText="Filters",this.hasFilters=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundSyncBounds=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".panel");e&&a(this,e,{mode:"column-drawer"})}},window.addEventListener("resize",this._boundSyncBounds),window.addEventListener("scroll",this._boundSyncBounds,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundSyncBounds&&(window.removeEventListener("resize",this._boundSyncBounds),window.removeEventListener("scroll",this._boundSyncBounds,!0));const e=this.shadowRoot?.querySelector(".panel");e&&n(this,e,!1)}updated(e){if(super.updated(e),e.has("open")){const t=this.shadowRoot?.querySelector(".panel");t&&n(this,t,this.open,{mode:"column-drawer"})}}_toggleOpen(e){e.stopPropagation(),this.open=!this.open}render(){return o`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${this._toggleOpen} style="opacity: ${this.hasFilters?"1":"0.5"};">
                    <yv-icon name="filter" style="width: var(--yv-icon-size, 14px); height: var(--yv-icon-size, 14px);"></yv-icon>
                </button>
                <div class="panel" popover="manual">
                    <slot></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-filter-dropdown",YenvuiFilterDropdown);
