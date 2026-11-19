import{html as s,css as d}from"lit";import{YenvuiBase as l}from"./yenvui-base.js";import{syncTopLayerPopover as a,anchorTopLayerPopover as c}from"./physics.js";import"./search-bar.js";export class YenvuiDropdown extends l{static properties={items:{type:Array},open:{type:Boolean,reflect:!0},align:{type:String},direction:{type:String},searchable:{type:Boolean},searchPlaceholder:{type:String},confirmHoldMs:{type:Number},filterFn:{attribute:!1},_searchQuery:{type:String,state:!0},_hasSlottedContent:{type:Boolean,state:!0},_loadingItemId:{type:String,state:!0},_confirmedItemId:{type:String,state:!0},_confirmedLabel:{type:String,state:!0}};static styles=d`
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
        .section-heading {
            font-size: 0.7rem;
            font-weight: 800;
            font-family: var(--font-mono, monospace);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--intent-primary, #8b5cf6);
            padding: 6px 10px 3px 10px;
            margin-top: 2px;
            border-bottom: 1px solid color-mix(in srgb, var(--intent-primary, #8b5cf6) 28%, transparent);
            user-select: none;
        }
        .menu-item.confirmed {
            color: var(--intent-success, #10b981);
            background: color-mix(in srgb, var(--intent-success, #10b981) 14%, transparent);
        }
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
    `;constructor(){super(),this.items=[],this.open=!1,this.align="auto",this.direction="auto",this.searchable=!1,this.searchPlaceholder="Filter actions...",this.filterFn=null,this._searchQuery="",this._hasSlottedContent=!1,this._loadingItemId=null,this._confirmedItemId=null,this._confirmedLabel="",this.confirmHoldMs=900}connectedCallback(){super.connectedCallback(),this.registerOutsideClick&&this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundReposition=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&c(this,e,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:0})}},window.addEventListener("resize",this._boundReposition),window.addEventListener("scroll",this._boundReposition,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundReposition&&(window.removeEventListener("resize",this._boundReposition),window.removeEventListener("scroll",this._boundReposition,!0));const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&a(this,e,!1)}updated(e){if(super.updated(e),e.has("open")&&!this.open&&this._searchQuery&&(this._searchQuery=""),e.has("open")||e.has("items")||e.has("align")||e.has("direction")||e.has("_hasSlottedContent")){const t=this.shadowRoot?.querySelector(".dropdown-menu");if(t){const o=!!(this.open&&(this.items&&this.items.length>0||this._hasSlottedContent||this.searchable));a(this,t,o,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:0})}}}_toggle(e){this._loadingItemId||(this.open=!this.open)}_getFilteredItems(){const e=this.items||[],t=(this._searchQuery||"").trim();if(!t)return e;const o=e.filter(i=>i&&!i.divider&&!i.sectionHeading);if(typeof this.filterFn=="function")return this.filterFn(o,t);const r=t.toLowerCase();return o.filter(i=>`${i.label||""} ${i.id||""} ${i.token||""} ${i.badge||""} ${i.description||""} ${i.section||""}`.toLowerCase().includes(r))}_notifyError(e){console.error(e),this.dispatchEvent(new CustomEvent("yenvui-action-error",{detail:{msg:`Action Failed: ${e.message}`,error:e},bubbles:!0,composed:!0}))}async _executeItem(e,t){if(this._loadingItemId||this._confirmedItemId)return;const o=e.id||e.label,r=Number(e.confirmHoldMs??this.confirmHoldMs)>=0?Number(e.confirmHoldMs??this.confirmHoldMs):900,i=async()=>{e.successLabel&&r>0&&(this._confirmedItemId=o,this._confirmedLabel=e.successLabel,this.dispatchEvent(new CustomEvent("yenvui-action-confirmed",{bubbles:!0,composed:!0,detail:{item:e,status:"success",phase:"start",label:e.successLabel,holdMs:r,keepDrawerOpen:!!e.keepDrawerOpen}})),await new Promise(n=>this.registerTimeout(n,r)),this._confirmedItemId=null,this._confirmedLabel=""),e.keepDrawerOpen||(this.open=!1),this.dispatchEvent(new CustomEvent("yenvui-action-confirmed",{bubbles:!0,composed:!0,detail:{item:e,status:"success",phase:"settled",label:e.successLabel||"Done",holdMs:r,keepDrawerOpen:!!e.keepDrawerOpen}}))};if(e.asyncAction){this._loadingItemId=o;try{await e.asyncAction(t),this._loadingItemId=null,await i()}catch(n){this._loadingItemId=null,this._notifyError(n),this.open=!1}}else if(e.onClick)try{const n=e.onClick(t);n&&typeof n.then=="function"&&(this._loadingItemId=o,await n,this._loadingItemId=null),await i()}catch(n){this._loadingItemId=null,this._notifyError(n),this.open=!1}else this.open=!1}render(){const e=this._getFilteredItems();return s`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual" @click=${t=>t.stopPropagation()}>
                    <slot name="header"></slot>
                    ${this.searchable?s`
                        <div class="dropdown-search-header">
                            <yenvui-search-bar
                                .placeholder=${this.searchPlaceholder||"Filter..."}
                                .value=${this._searchQuery}
                                @yenvui-search-changed=${t=>{this._searchQuery=t.detail.value}}>
                            </yenvui-search-bar>
                        </div>
                    `:""}
                    ${e.map(t=>{if(!t)return"";if(t.divider)return s`<div class="divider"></div>`;if(t.sectionHeading)return s`<div class="section-heading">${t.sectionHeading}</div>`;const o=t.id||t.label,r=this._loadingItemId===o,i=this._confirmedItemId===o,n=i?"check":t.icon,h=i?this._confirmedLabel||t.successLabel||"Done":r?"Processing...":t.label||t.id||"Unknown Action";return s`
                            <button class="menu-item ${i?"confirmed":""}" ?disabled=${!!(this._loadingItemId||this._confirmedItemId)} @click=${u=>this._executeItem(t,u)}>
                                <span class="menu-item-main">
                                    <span class="icon">${r?s`<div class="menu-spinner"></div>`:n?/^[a-zA-Z0-9-]+$/.test(n)?s`<yenvui-icon name="${n}" size="sm"></yenvui-icon>`:n:""}</span>
                                    <span class="menu-item-text">
                                        <span>${h}</span>
                                        ${t.description?s`<span class="menu-item-desc">${t.description}</span>`:""}
                                    </span>
                                </span>
                                ${t.badge?s`<span class="menu-item-badge">${t.badge}</span>`:""}
                            </button>
                        `})}
                    <slot name="content" @slotchange=${t=>{this._hasSlottedContent=t.target.assignedNodes({flatten:!0}).length>0}}></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-dropdown",YenvuiDropdown);export class YenvuiFilterDropdown extends l{static properties={filterText:{type:String},open:{type:Boolean,reflect:!0},hasFilters:{type:Boolean}};static styles=d`
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
    `;constructor(){super(),this.open=!1,this.filterText="Filters",this.hasFilters=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundSyncBounds=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".panel");e&&c(this,e,{mode:"column-drawer"})}},window.addEventListener("resize",this._boundSyncBounds),window.addEventListener("scroll",this._boundSyncBounds,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundSyncBounds&&(window.removeEventListener("resize",this._boundSyncBounds),window.removeEventListener("scroll",this._boundSyncBounds,!0));const e=this.shadowRoot?.querySelector(".panel");e&&a(this,e,!1)}updated(e){if(super.updated(e),e.has("open")){const t=this.shadowRoot?.querySelector(".panel");t&&a(this,t,this.open,{mode:"column-drawer"})}}_toggleOpen(e){e.stopPropagation(),this.open=!this.open}render(){return s`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${this._toggleOpen} style="opacity: ${this.hasFilters?"1":"0.5"};">
                    <yenvui-icon name="filter" size="sm"></yenvui-icon>
                </button>
                <div class="panel" popover="manual">
                    <slot></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-filter-dropdown",YenvuiFilterDropdown);
