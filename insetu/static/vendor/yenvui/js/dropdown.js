import{html as n,css as r}from"lit";import{YenvuiBase as a}from"./yenvui-base.js";import{syncTopLayerPopover as s,anchorTopLayerPopover as d}from"./physics.js";import"./search-bar.js";export class YenvuiDropdown extends a{static properties={items:{type:Array},open:{type:Boolean,reflect:!0},align:{type:String},direction:{type:String},searchable:{type:Boolean},searchPlaceholder:{type:String},filterFn:{attribute:!1},_searchQuery:{type:String,state:!0},_hasSlottedContent:{type:Boolean,state:!0},_loadingItemId:{type:String,state:!0}};static styles=r`
        :host { display: inline-flex; align-items: stretch; height: 100%; }
        .dropdown-menu {
            position: fixed;
            margin: 0;
            inset: auto;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-radius: 0 0 6px 6px;
            padding: 6px;
            min-width: 220px;
            max-height: var(--yv-dropdown-max-height, min(82dvh, 640px));
            overflow-y: auto;
            box-shadow: var(--overlay-shadow);
            z-index: 99999;
            display: none;
            flex-direction: column;
            gap: 2px;
            box-sizing: border-box;
        }
        :host([direction="up"]) .dropdown-menu {
            border-radius: 6px 6px 0 0;
        }
        .dropdown-menu > * {
            flex-shrink: 0;
        }
        .dropdown-menu > ::slotted(*) {
            flex-shrink: 0;
        }
        :host([open]) .dropdown-menu,
        .dropdown-menu:popover-open {
            display: flex;
        }
        .dropdown-search-header {
            position: sticky;
            top: -5px;
            background: var(--pane-bg, #1e1e1e);
            padding: 4px 6px;
            border-bottom: 1px solid var(--border, #444);
            margin-bottom: 4px;
            z-index: 2;
        }
        .divider { height: 1px; background: var(--border, #444); margin: 4px 0; }
        .menu-item {
            background: transparent; color: var(--text, #e0e0e0); text-align: left; 
            padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; 
            font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; 
            align-items: center; justify-content: space-between; gap: 8px; width: 100%; box-sizing: border-box;
        }
        .menu-item:hover:not(:disabled) { background: var(--input-bg, #2d2d2d); }
        .menu-item:disabled { opacity: 0.7; cursor: not-allowed; }
        .menu-item-main {
            display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
        }
        .menu-item-text {
            display: flex; flex-direction: column; min-width: 0; flex: 1;
        }
        .menu-item-desc {
            font-size: 0.72rem; font-weight: normal; color: var(--text-muted, #888);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .menu-item-badge {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: normal;
            color: var(--text-muted, #888);
            background: var(--bg);
            border: 1px solid var(--border, #444);
            padding: 1px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
        .icon { font-size: 1.1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .menu-spinner {
            width: 14px; height: 14px;
            border: 2px solid var(--border, #444);
            border-top: 2px solid var(--intent-primary, #3b82f6);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;constructor(){super(),this.items=[],this.open=!1,this.align="auto",this.direction="auto",this.searchable=!1,this.searchPlaceholder="Filter actions...",this.filterFn=null,this._searchQuery="",this._hasSlottedContent=!1,this._loadingItemId=null}connectedCallback(){super.connectedCallback(),this.registerOutsideClick&&this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundReposition=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&d(this,e,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:0})}},window.addEventListener("resize",this._boundReposition),window.addEventListener("scroll",this._boundReposition,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundReposition&&(window.removeEventListener("resize",this._boundReposition),window.removeEventListener("scroll",this._boundReposition,!0));const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&s(this,e,!1)}updated(e){if(super.updated(e),e.has("open")&&!this.open&&this._searchQuery&&(this._searchQuery=""),e.has("open")||e.has("items")||e.has("align")||e.has("direction")||e.has("_hasSlottedContent")){const t=this.shadowRoot?.querySelector(".dropdown-menu");if(t){const i=!!(this.open&&(this.items&&this.items.length>0||this._hasSlottedContent||this.searchable));s(this,t,i,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:0})}}}_toggle(e){this._loadingItemId||(this.open=!this.open)}_getFilteredItems(){const e=this.items||[],t=(this._searchQuery||"").trim();if(!t)return e;if(typeof this.filterFn=="function")return this.filterFn(e.filter(o=>!o.divider),t);const i=t.toLowerCase();return e.filter(o=>!o||o.divider?!1:`${o.label||""} ${o.id||""} ${o.token||""} ${o.badge||""} ${o.description||""}`.toLowerCase().includes(i))}_notifyError(e){console.error(e),this.dispatchEvent(new CustomEvent("yenvui-action-error",{detail:{msg:`Action Failed: ${e.message}`,error:e},bubbles:!0,composed:!0}))}async _executeItem(e,t){if(!this._loadingItemId){if(e.asyncAction){this._loadingItemId=e.id||e.label;try{await e.asyncAction(t)}catch(i){this._notifyError(i)}finally{this._loadingItemId=null,this.open=!1}}else if(this.open=!1,e.onClick)try{const i=e.onClick(t);i&&typeof i.catch=="function"&&i.catch(o=>this._notifyError(o))}catch(i){this._notifyError(i)}}}render(){const e=this._getFilteredItems();return n`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual" @click=${t=>t.stopPropagation()}>
                    <slot name="header"></slot>
                    ${this.searchable?n`
                        <div class="dropdown-search-header">
                            <yenvui-search-bar
                                .placeholder=${this.searchPlaceholder||"Filter..."}
                                .value=${this._searchQuery}
                                @yenvui-search-changed=${t=>{this._searchQuery=t.detail.value}}>
                            </yenvui-search-bar>
                        </div>
                    `:""}
                    ${e.map(t=>{if(t.divider)return n`<div class="divider"></div>`;const i=this._loadingItemId===(t.id||t.label);return n`
                            <button class="menu-item" ?disabled=${!!this._loadingItemId} @click=${o=>this._executeItem(t,o)}>
                                <span class="menu-item-main">
                                    <span class="icon">${i?n`<div class="menu-spinner"></div>`:t.icon?/^[a-zA-Z0-9-]+$/.test(t.icon)?n`<yenvui-icon name="${t.icon}" size="sm"></yenvui-icon>`:t.icon:""}</span>
                                    <span class="menu-item-text">
                                        <span>${i?"Processing...":t.label||t.id||"Unknown Action"}</span>
                                        ${t.description?n`<span class="menu-item-desc">${t.description}</span>`:""}
                                    </span>
                                </span>
                                ${t.badge?n`<span class="menu-item-badge">${t.badge}</span>`:""}
                            </button>
                        `})}
                    <slot name="content" @slotchange=${t=>{this._hasSlottedContent=t.target.assignedNodes({flatten:!0}).length>0}}></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-dropdown",YenvuiDropdown);export class YenvuiFilterDropdown extends a{static properties={filterText:{type:String},open:{type:Boolean,reflect:!0},hasFilters:{type:Boolean}};static styles=r`
        :host { display: flex; position: static; height: 100%; align-items: stretch; }
        .container { display: flex; align-items: stretch; height: 100%; }
        .panel {
            display: none;
            position: fixed;
            margin: 0;
            inset: auto;
            z-index: 99999;
            min-width: 240px;
            padding: 12px 16px;
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-top: none;
            border-radius: 0 0 6px 6px;
            box-shadow: var(--overlay-shadow);
            max-height: min(80dvh, 640px);
            overflow-y: auto;
            box-sizing: border-box;
        }
        .panel > ::slotted(*) {
            flex-shrink: 0;
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
    `;constructor(){super(),this.open=!1,this.filterText="Filters",this.hasFilters=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundSyncBounds=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".panel");e&&d(this,e,{mode:"column-drawer"})}},window.addEventListener("resize",this._boundSyncBounds),window.addEventListener("scroll",this._boundSyncBounds,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundSyncBounds&&(window.removeEventListener("resize",this._boundSyncBounds),window.removeEventListener("scroll",this._boundSyncBounds,!0));const e=this.shadowRoot?.querySelector(".panel");e&&s(this,e,!1)}updated(e){if(super.updated(e),e.has("open")){const t=this.shadowRoot?.querySelector(".panel");t&&s(this,t,this.open,{mode:"column-drawer"})}}_toggleOpen(e){e.stopPropagation(),this.open=!this.open}render(){return n`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${this._toggleOpen} style="opacity: ${this.hasFilters?"1":"0.5"};">
                    <yenvui-icon name="filter" size="sm"></yenvui-icon>
                </button>
                <div class="panel" popover="manual">
                    <slot></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-filter-dropdown",YenvuiFilterDropdown);
