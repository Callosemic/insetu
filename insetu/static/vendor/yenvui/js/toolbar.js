import{html as i,css as l}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";import"./search-bar.js";import"./dropdown.js";export class YenvuiToolbar extends o{static properties={searchQuery:{type:String},searchPlaceholder:{type:String},enableFilterDropdown:{type:Boolean},filterText:{type:String},activeFilters:{type:Array},hasFiltersOverride:{type:Boolean},flush:{type:Boolean,reflect:!0}};static styles=l`
        :host { display: contents; }
        .sticky-header {
            position: relative;
            flex-shrink: 0;
            padding: 0;
            background: var(--bg, #121212);
            z-index: 10;
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--border);
        }
        .toolbar-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 0 0 var(--yv-gutter-x, 12px);
            height: var(--yv-header-height, 44px);
            box-sizing: border-box;
            background: var(--input-bg);
            border: none;
            border-radius: 0;
        }
        yenvui-filter-dropdown {
            height: 100%;
            display: flex;
            align-self: stretch;
        }
        .bottom-border { border-bottom: none; }
    `;constructor(){super(),this.searchQuery="",this.searchPlaceholder="Search...",this.enableFilterDropdown=!1,this.filterText="",this.activeFilters=[],this.hasFiltersOverride=!1,this.flush=!1}render(){let t=this.filterText,r=this.hasFiltersOverride||!1;if(!t&&this.activeFilters){const e=this.activeFilters.filter(s=>s!=="ALL");e.length>0?(t=`Filters: ${e.slice(0,2).join(", ")}${e.length>2?"...":""}`,r=!0):t="Filters"}return i`
            <div class="sticky-header">
                <div class="toolbar-row ${this.flush?"bottom-border":""}">
                    <yenvui-search-bar 
                        style="flex: 1;"
                        .placeholder=${this.searchPlaceholder} 
                        .value=${this.searchQuery} 
                        @yenvui-search-changed=${e=>this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:e.detail,bubbles:!0,composed:!0}))}>
                    </yenvui-search-bar>
                    ${this.enableFilterDropdown?i`
                        <yenvui-filter-dropdown filterText=${t} .hasFilters=${r}>
                            <slot name="filters"></slot>
                        </yenvui-filter-dropdown>
                    `:""}
                </div>
                <slot name="bottom-row"></slot>
            </div>
        `}}customElements.define("yenvui-toolbar",YenvuiToolbar);
