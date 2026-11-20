import{html as o,css as u}from"lit";import{YenvuiBase as g}from"./yenvui-base.js";import{syncTopLayerPopover as h,anchorTopLayerPopover as f}from"./physics.js";import"./search-bar.js";export class YenvuiDropdown extends g{static properties={items:{type:Array},open:{type:Boolean,reflect:!0},align:{type:String},direction:{type:String},searchable:{type:Boolean},searchPlaceholder:{type:String},chipRows:{type:Boolean,reflect:!0},confirmHoldMs:{type:Number},filterFn:{attribute:!1},_searchQuery:{type:String,state:!0},_hasSlottedHeader:{type:Boolean,state:!0},_hasSlottedContent:{type:Boolean,state:!0},_loadingItemId:{type:String,state:!0},_confirmedItemId:{type:String,state:!0},_confirmedLabel:{type:String,state:!0}};static styles=u`
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
            touch-action: pan-y;
            user-select: auto;
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
        :host([chipRows]) .dropdown-menu,
        :host([chip-rows]) .dropdown-menu {
            min-width: min(92vw, 320px);
            max-width: min(94vw, 540px);
            width: max-content;
            padding: 10px;
            gap: 0;
        }
        .chip-section {
            display: grid;
            grid-template-columns: 92px minmax(0, 1fr);
            align-items: start;
            column-gap: 10px;
            padding: 4px 2px 14px 2px;
            width: 100%;
            box-sizing: border-box;
        }
        .chip-section.no-slug {
            grid-template-columns: minmax(0, 1fr);
        }
        .chip-section:last-of-type {
            padding-bottom: 4px;
        }
        .chip-section.has-divider-after {
            border-bottom: 1px solid var(--border, #444);
            margin-bottom: 8px;
            padding-bottom: 14px;
        }
        .chip-section-slug {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 30px;
            padding: 0 8px;
            border-radius: 6px;
            background: var(--text, #e0e0e0);
            color: var(--bg-deep, #121212);
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.02em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            user-select: none;
            box-sizing: border-box;
        }
        .chip-section-slug .slug-icon {
            display: none;
        }
        .chip-section-slug .slug-label {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .dropdown-menu[data-compact-slugs] .chip-section.has-section-icon {
            grid-template-columns: 30px minmax(0, 1fr);
            column-gap: 8px;
        }
        .dropdown-menu[data-compact-slugs] .chip-section-slug.has-icon {
            width: 30px;
            padding: 0;
        }
        .dropdown-menu[data-compact-slugs] .chip-section-slug.has-icon .slug-icon {
            display: inline-flex;
        }
        .dropdown-menu[data-compact-slugs] .chip-section-slug.has-icon .slug-label {
            display: none;
        }
        .chip-section-items {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .chip-section-slug.is-active-slug,
        .chip-section-slug.has-intent {
            background: var(--slug-intent, var(--intent-primary, #8b5cf6));
            color: var(--bg-deep, #000000);
        }
        .chip-item {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 10px;
            margin: 0;
            border-radius: 6px;
            border: 1px solid var(--border, #444);
            border-bottom: 2px solid var(--border, #444);
            background: var(--input-bg, #262626);
            color: var(--text, #e0e0e0);
            font-size: 0.82rem;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            flex-shrink: 0;
            box-sizing: border-box;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .chip-item:hover:not(:disabled) {
            background: color-mix(in srgb, var(--chip-intent, var(--intent-primary, #8b5cf6)) 14%, var(--bg-hover, #333));
            border-color: var(--chip-intent, var(--intent-primary, #8b5cf6));
        }
        .chip-item.is-checked {
            border-color: color-mix(in srgb, var(--chip-intent, var(--intent-primary, #8b5cf6)) 65%, var(--border, #444));
            border-bottom: 2px solid var(--chip-intent, var(--intent-primary, #8b5cf6));
            background: color-mix(in srgb, var(--chip-intent, var(--intent-primary, #8b5cf6)) 24%, var(--input-bg, #262626));
            color: var(--text, #ffffff);
        }
        .chip-item.confirmed {
            color: var(--intent-success, #10b981);
            border-color: var(--intent-success, #10b981);
            background: color-mix(in srgb, var(--intent-success, #10b981) 14%, transparent);
        }
        .chip-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-mono, monospace);
            font-size: 0.74rem;
            font-weight: 700;
            color: var(--text-muted, #94a3b8);
        }
        .chip-trailing {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            margin-left: 2px;
            margin-right: -4px;
            border-radius: 4px;
            color: var(--text-muted, #94a3b8);
            cursor: pointer;
        }
        .chip-trailing:hover {
            color: var(--intent-danger, #f43f5e);
            background: var(--bg, #121212);
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
        .menu-item-check {
            width: 14px;
            height: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--intent-primary, #8b5cf6);
            flex-shrink: 0;
        }
        .menu-item-trailing {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            min-height: 28px;
            padding: 2px 6px;
            border: 1px solid transparent;
            border-radius: 4px;
            background: transparent;
            color: var(--text-muted, #888);
            cursor: pointer;
            flex-shrink: 0;
        }
        .menu-item-trailing:hover {
            color: var(--intent-danger, #f43f5e);
            background: var(--bg);
            border-color: var(--border, #444);
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
    `;constructor(){super(),this.items=[],this.open=!1,this.align="auto",this.direction="auto",this.searchable=!1,this.searchPlaceholder="Filter actions...",this.chipRows=!1,this.filterFn=null,this._searchQuery="",this._hasSlottedHeader=!1,this._hasSlottedContent=!1,this._loadingItemId=null,this._confirmedItemId=null,this._confirmedLabel="",this.confirmHoldMs=900}connectedCallback(){super.connectedCallback(),this.registerOutsideClick&&this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundReposition=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&f(this,e,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:0})}},window.addEventListener("resize",this._boundReposition),window.addEventListener("scroll",this._boundReposition,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundReposition&&(window.removeEventListener("resize",this._boundReposition),window.removeEventListener("scroll",this._boundReposition,!0));const e=this.shadowRoot?.querySelector(".dropdown-menu");e&&h(this,e,!1)}updated(e){if(super.updated(e),e.has("open")&&!this.open&&this._searchQuery&&(this._searchQuery=""),e.has("open")||e.has("items")||e.has("align")||e.has("direction")||e.has("chipRows")||e.has("_searchQuery")||e.has("_hasSlottedHeader")||e.has("_hasSlottedContent")){const s=this.shadowRoot?.querySelector(".dropdown-menu");if(s){const n=!!(this.open&&(this.items&&this.items.length>0||this._hasSlottedHeader||this._hasSlottedContent||this.searchable));h(this,s,n,{mode:"menu",align:this.align||"auto",direction:this.direction||"auto",offset:0})}}}_toggle(e){this._loadingItemId||(this.open=!this.open)}_getFilteredItems(){const e=this.items||[],s=(this._searchQuery||"").trim();if(!s)return e;const n=a=>{if(typeof this.filterFn=="function")return this.filterFn(a,s);const l=s.toLowerCase();return a.filter(d=>`${d.label||""} ${d.id||""} ${d.token||""} ${d.badge||""} ${d.description||""} ${d.section||""}`.toLowerCase().includes(l))},i=[];let r={heading:null,entries:[]};e.forEach(a=>{!a||a.divider||(a.sectionHeading?((r.heading||r.entries.length>0)&&i.push(r),r={heading:a,entries:[]}):r.entries.push(a))}),(r.heading||r.entries.length>0)&&i.push(r);const t=[];return i.forEach(a=>{const l=n(a.entries);l.length>0&&(a.heading&&t.push(a.heading),t.push(...l))}),t}_notifyError(e){console.error(e),this.dispatchEvent(new CustomEvent("yenvui-action-error",{detail:{msg:`Action Failed: ${e.message}`,error:e},bubbles:!0,composed:!0}))}async _executeItem(e,s){if(this._loadingItemId||this._confirmedItemId)return;const n=e.id||e.label,i=Number(e.confirmHoldMs??this.confirmHoldMs)>=0?Number(e.confirmHoldMs??this.confirmHoldMs):900,r=async()=>{const t=!!e.keepDrawerOpen,a=!!e.keepSelection;e.successLabel&&i>0&&(this._confirmedItemId=n,this._confirmedLabel=e.successLabel,this.dispatchEvent(new CustomEvent("yenvui-action-confirmed",{bubbles:!0,composed:!0,detail:{item:e,action:e,status:"success",phase:"start",label:e.successLabel,holdMs:i,keepDrawerOpen:t,keepSelection:a}})),await new Promise(l=>this.registerTimeout(l,i)),this._confirmedItemId=null,this._confirmedLabel=""),t||(this.open=!1),this.dispatchEvent(new CustomEvent("yenvui-action-confirmed",{bubbles:!0,composed:!0,detail:{item:e,action:e,status:"success",phase:"settled",label:e.successLabel||"Done",holdMs:i,keepDrawerOpen:t,keepSelection:a}}))};if(e.asyncAction){this._loadingItemId=n;try{await e.asyncAction(s),this._loadingItemId=null,await r()}catch(t){this._loadingItemId=null,this._notifyError(t),this.open=!1}}else if(e.onClick)try{const t=e.onClick(s);t&&typeof t.then=="function"&&(this._loadingItemId=n,await t,this._loadingItemId=null),await r()}catch(t){this._loadingItemId=null,this._notifyError(t),this.open=!1}else this.open=!1}_getChipRowSections(e){const s=[];let n=null;return(e||[]).forEach(i=>{if(i){if(i.divider){n&&(n.dividerAfter=!0);return}i.sectionHeading?(n&&(n.heading||n.entries.length>0)&&s.push(n),n={heading:i,entries:[],dividerAfter:!!i.dividerAfter}):(n||(n={heading:null,entries:[],dividerAfter:!1}),n.entries.push(i))}}),n&&(n.heading||n.entries.length>0)&&s.push(n),s}_renderChipItem(e){const s=e.id||e.label,n=this._loadingItemId===s,i=this._confirmedItemId===s,r=i?"check":e.icon,t=e.intent||"primary",a=i?"success":e.intent||"current",l=i?this._confirmedLabel||e.successLabel||"Done":n?"Processing...":e.label||e.id||"Action";return o`
            <button
                type="button"
                class="chip-item ${e.checked?"is-checked":""} ${i?"confirmed":""}"
                style="--chip-intent: var(--intent-${t}, var(--intent-primary));"
                ?disabled=${!!(this._loadingItemId||this._confirmedItemId)}
                @pointerdown=${d=>{typeof e.onPointerDown=="function"&&e.onPointerDown(d)}}
                @click=${d=>this._executeItem(e,d)}>
                ${n?o`<div class="menu-spinner"></div>`:r?/^[a-zA-Z0-9-]+$/.test(r)?o`<yenvui-icon name="${r}" size="xs" intent="${a}"></yenvui-icon>`:o`<span>${r}</span>`:""}
                <span>${l}</span>
                ${e.badgeIcon?o`<span class="chip-badge" title=${e.badgeTitle||""}><yenvui-icon name=${e.badgeIcon} size="xs"></yenvui-icon></span>`:e.badge?o`<span class="chip-badge">${e.badge}</span>`:""}
                ${e.trailingButton?o`
                    <span
                        role="button"
                        tabindex="0"
                        class="chip-trailing"
                        title=${e.trailingButton.title||""}
                        @pointerdown=${d=>d.stopPropagation()}
                        @click=${d=>{d.stopPropagation(),d.preventDefault(),typeof e.trailingButton.onClick=="function"&&e.trailingButton.onClick(d),e.trailingButton.closeMenu!==!1&&(this.open=!1)}}>
                        <yenvui-icon name=${e.trailingButton.icon||"x"} size="xs"></yenvui-icon>
                    </span>
                `:""}
            </button>
        `}_renderChipSection(e){const n=e.heading&&Object.prototype.hasOwnProperty.call(e.heading,"sectionSlug")&&!e.heading.sectionSlug?"":e.heading?.sectionSlug||e.heading?.sectionHeading||"",i=n&&e.heading?.sectionIcon||"",r=e.heading?.sectionIntent||"",t=e.heading?.sectionVariant==="active";return o`
            <div class="chip-section ${n?"":"no-slug"} ${i?"has-section-icon":""} ${e.dividerAfter?"has-divider-after":""}">
                ${n?o`
                    <span
                        class="chip-section-slug ${t?"is-active-slug":""} ${r?"has-intent":""} ${i?"has-icon":""}"
                        style="${r?`--slug-intent: var(--intent-${r}, var(--intent-primary));`:""}"
                        title=${n}>
                        ${i?o`<yenvui-icon class="slug-icon" name=${i} size="sm"></yenvui-icon>`:""}
                        <span class="slug-label">${n}</span>
                    </span>
                `:""}
                <div class="chip-section-items">
                    ${e.entries.map(a=>this._renderChipItem(a))}
                </div>
            </div>
        `}render(){const e=this._getFilteredItems(),s=this.chipRows?this._getChipRowSections(this.items||[]):null,n=this.chipRows?this._getChipRowSections(e):null,i=this.chipRows&&s?s.filter(t=>!!t.heading?.pinnedTop):[],r=this.chipRows&&n?n.filter(t=>!t.heading?.pinnedTop):[];return o`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                <div class="dropdown-menu" popover="manual" @click=${t=>t.stopPropagation()}>
                    <slot name="header" @slotchange=${t=>{this._hasSlottedHeader=t.target.assignedNodes({flatten:!0}).length>0}}></slot>
                    ${i.map(t=>this._renderChipSection(t))}
                    ${this.searchable?o`
                        <div class="dropdown-search-header">
                            <yenvui-search-bar
                                .placeholder=${this.searchPlaceholder||"Filter..."}
                                .value=${this._searchQuery}
                                @yenvui-search-changed=${t=>{this._searchQuery=t.detail.value}}>
                            </yenvui-search-bar>
                        </div>
                    `:""}
                    ${this.chipRows&&n?r.map(t=>this._renderChipSection(t)):e.map(t=>{if(!t)return"";if(t.divider)return o`<div class="divider"></div>`;if(t.sectionHeading)return o`<div class="section-heading">${t.sectionHeading}</div>`;const a=t.id||t.label,l=this._loadingItemId===a,d=this._confirmedItemId===a,p=d?"check":t.icon,b=d?this._confirmedLabel||t.successLabel||"Done":l?"Processing...":t.label||t.id||"Unknown Action",x=!!(t.checked||t.checkable);return o`
                            <button
                                class="menu-item ${d?"confirmed":""}"
                                ?disabled=${!!(this._loadingItemId||this._confirmedItemId)}
                                @pointerdown=${c=>{typeof t.onPointerDown=="function"&&t.onPointerDown(c)}}
                                @click=${c=>this._executeItem(t,c)}>
                                <span class="menu-item-main">
                                    ${x?o`
                                        <span class="menu-item-check">
                                            ${t.checked?o`<yenvui-icon name="check" size="xs"></yenvui-icon>`:""}
                                        </span>
                                    `:""}
                                    <span class="icon">${l?o`<div class="menu-spinner"></div>`:p?/^[a-zA-Z0-9-]+$/.test(p)?o`<yenvui-icon name="${p}" size="sm"></yenvui-icon>`:p:""}</span>
                                    <span class="menu-item-text">
                                        <span>${b}</span>
                                        ${t.description?o`<span class="menu-item-desc">${t.description}</span>`:""}
                                    </span>
                                </span>
                                ${t.badgeIcon?o`<span class="menu-item-badge" title=${t.badgeTitle||""}><yenvui-icon name=${t.badgeIcon} size="xs"></yenvui-icon></span>`:t.badge?o`<span class="menu-item-badge">${t.badge}</span>`:""}
                                ${t.trailingButton?o`
                                    <span
                                        role="button"
                                        tabindex="0"
                                        class="menu-item-trailing"
                                        title=${t.trailingButton.title||""}
                                        @pointerdown=${c=>c.stopPropagation()}
                                        @click=${c=>{c.stopPropagation(),c.preventDefault(),typeof t.trailingButton.onClick=="function"&&t.trailingButton.onClick(c),t.trailingButton.closeMenu!==!1&&(this.open=!1)}}>
                                        <yenvui-icon name=${t.trailingButton.icon||"x"} size="xs"></yenvui-icon>
                                    </span>
                                `:""}
                            </button>
                        `})}
                    <slot name="content" @slotchange=${t=>{this._hasSlottedContent=t.target.assignedNodes({flatten:!0}).length>0}}></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-dropdown",YenvuiDropdown);export class YenvuiFilterDropdown extends g{static properties={filterText:{type:String},open:{type:Boolean,reflect:!0},hasFilters:{type:Boolean}};static styles=u`
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
    `;constructor(){super(),this.open=!1,this.filterText="Filters",this.hasFilters=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1)}),this._boundSyncBounds=()=>{if(this.open){const e=this.shadowRoot?.querySelector(".panel");e&&f(this,e,{mode:"column-drawer"})}},window.addEventListener("resize",this._boundSyncBounds),window.addEventListener("scroll",this._boundSyncBounds,!0)}disconnectedCallback(){super.disconnectedCallback(),this._boundSyncBounds&&(window.removeEventListener("resize",this._boundSyncBounds),window.removeEventListener("scroll",this._boundSyncBounds,!0));const e=this.shadowRoot?.querySelector(".panel");e&&h(this,e,!1)}updated(e){if(super.updated(e),e.has("open")){const s=this.shadowRoot?.querySelector(".panel");s&&h(this,s,this.open,{mode:"column-drawer"})}}_toggleOpen(e){e.stopPropagation(),this.open=!this.open}render(){return o`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${this._toggleOpen} style="opacity: ${this.hasFilters?"1":"0.5"};">
                    <yenvui-icon name="filter" size="sm"></yenvui-icon>
                </button>
                <div class="panel" popover="manual">
                    <slot></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-filter-dropdown",YenvuiFilterDropdown);
