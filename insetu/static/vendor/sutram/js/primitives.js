import{LitElement as k,html as n,css as v}from"lit";import{SutramElement as E,SutramContextMixin as b,SelectionStore as w,ToastStore as A,EnvironmentStore as I}from"./sutram_sdk.js";import{YenvuiBtn as Y,YenvuiAsyncBtn as T}from"../../yenvui/js/async-btn.js";import{YenvuiStatusBar as O}from"../../yenvui/js/status-bar.js";import{YenvuiToastContainer as B}from"../../yenvui/js/toast.js";import{YenvuiModal as R}from"../../yenvui/js/modal.js";import{YenvuiWindow as N}from"../../yenvui/js/window.js";import{YenvuiCategorySection as M}from"../../yenvui/js/category-section.js";import{YenvuiCard as z}from"../../yenvui/js/card.js";import{YenvuiCardGroup as U}from"../../yenvui/js/card-group.js";import{YenvuiEditor as j}from"../../yenvui/js/editor.js";import{YenvuiToolbar as K}from"../../yenvui/js/toolbar.js";import{YenvuiCollapsible as F}from"../../yenvui/js/collapsible.js";import{YenvuiPill as q}from"../../yenvui/js/pill.js";import{YenvuiFilterGroup as P}from"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import{YenvuiSearchBar as G}from"../../yenvui/js/search-bar.js";import{YenvuiSpinner as W}from"../../yenvui/js/spinner.js";import{YenvuiEmptyState as Q}from"../../yenvui/js/empty-state.js";import{YenvuiBoard as H,YenvuiColumn as V}from"../../yenvui/js/board.js";import{YenvuiTag as J}from"../../yenvui/js/tag.js";import{YenvuiLabel as Z}from"../../yenvui/js/label.js";import{YenvuiDropdown as X}from"../../yenvui/js/dropdown.js";import{YenvuiScrubTrack as tt}from"../../yenvui/js/yenvui-base.js";import{sharedStyles as S}from"./shared_styles.js";import{buildFileTree as et}from"./utils.js";import"../../yenvui/js/async-btn.js";import"../../yenvui/js/status-bar.js";import"../../yenvui/js/toast.js";import"../../yenvui/js/modal.js";import"../../yenvui/js/window.js";import"../../yenvui/js/category-section.js";import"../../yenvui/js/card.js";import"../../yenvui/js/card-group.js";import"../../yenvui/js/editor.js";import"../../yenvui/js/toolbar.js";import"../../yenvui/js/collapsible.js";import{YenvuiFilterDropdown as it}from"../../yenvui/js/dropdown.js";import"../../yenvui/js/pill.js";import"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import"../../yenvui/js/search-bar.js";import"../../yenvui/js/spinner.js";import"../../yenvui/js/empty-state.js";import"../../yenvui/js/board.js";import"../../yenvui/js/tag.js";import"../../yenvui/js/label.js";import{YenvuiScrollView as st}from"../../yenvui/js/scroll-view.js";import"../../yenvui/js/scroll-view.js";import"/static/vendor/lit/lit-virtualizer.min.js";export class SutramVirtualList extends k{static properties={items:{type:Array},renderItem:{type:Object}};static styles=v`
        :host { display: flex; flex-direction: column; width: 100%; flex: 1; min-width: 0; }
        lit-virtualizer { width: 100%; flex: 1; min-width: 0; }
    `;render(){return!this.items||this.items.length===0?n``:n`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramBtn extends Y{}customElements.define("sutram-btn",SutramBtn);export class SutramAsyncBtn extends b(T){static properties={...T.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(I,t=>{if(t.isOffline){let e=this,i=null;for(;e;){if(e.dataset&&e.dataset.ext){i=e.dataset.ext;break}e=e.getRootNode().host||e.parentElement}const o=i&&window.ExtensionRegistry?.getExtension(i)?.offline_mode;this._isOfflineReadOnly=o==="read_only"||o==="none"||!o}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="\u{1F6AB} Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label)}_updateState(){this._isOfflineReadOnly?(this.label!=="\u{1F6AB} Offline"&&(this._originalLabel=this.label),this.label="\u{1F6AB} Offline",this.disabled=!0):(this.label=this._originalLabel||this.label,this.disabled=!1)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends b(O){static properties={...O.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends b(B){connectedCallback(){super.connectedCallback(),this.subscribe(A,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{A.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends E{static properties={selectedItems:{type:Object},modalOpen:{type:Boolean}};static styles=v`
        .cart-btn {
            background: color-mix(in srgb, var(--intent-warning) 15%, transparent);
            color: var(--intent-warning);
            border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent);
            border-radius: 20px;
            height: 32px;
            padding: 0 12px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
            margin-right: 12px;
        }
        .cart-btn:hover {
            background: color-mix(in srgb, var(--intent-warning) 25%, transparent);
        }
        .cart-badge.mobile-only { display: none; }
        .cart-badge {
            background: var(--intent-warning);
            color: #000;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
        }
        @container (max-width: 480px) {
            .cart-text { display: none; }
            .cart-badge.mobile-only { display: flex; }
            .cart-btn { padding: 0 8px; }
        }

        .tray-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2999;
            opacity: 0; pointer-events: none; transition: opacity 0.2s;
        }
        .tray-overlay.open { opacity: 1; pointer-events: auto; }

        .tray-panel {
            position: fixed; top: 60px; right: 20px; width: 450px; max-width: calc(100vw - 40px);
            background: var(--pane-bg); border: 1px solid var(--border); border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 3000; display: flex; flex-direction: column;
            transform: translateY(-20px); opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            max-height: calc(100dvh - 80px);
        }
        .tray-panel.open { transform: translateY(0); opacity: 1; pointer-events: auto; }

        .tray-header {
            display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 20px 15px 20px;
        }
        .tray-header h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.1rem; color: var(--text); }
        .tray-header p { margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem; font-family: var(--font-mono); }
        .tray-header button { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; }
        .tray-header button:hover { color: var(--text); }

        .tray-subheader {
            padding: 0 20px 15px 20px; border-bottom: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center;
            font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);
        }

        .tray-items {
            flex: 1; overflow-y: auto; padding: 15px 20px; display: flex; flex-direction: column; gap: 10px;
        }
        .tray-item {
            display: flex; align-items: center; justify-content: space-between;
            background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px;
            padding: 12px; border-left: 4px solid var(--intent-warning); gap: 12px;
        }
        .tray-item-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
        .tray-item-title { font-weight: bold; color: var(--text); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        .tray-item-path { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pack-tag { background: color-mix(in srgb, var(--intent-warning) 20%, transparent); color: var(--intent-warning); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }

        .tray-footer {
            display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid var(--border); background: var(--bg-deep); border-radius: 0 0 12px 12px;
        }
    `;constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1}connectedCallback(){super.connectedCallback(),this.subscribe(w,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.requestUpdate()}),this.selectedItems=w.getState().selectedItems}render(){const t=this.selectedItems.size,e=Array.from(this.selectedItems.values());let i=0;e.forEach(a=>{a.data?.size_bytes?i+=a.data.size_bytes:i+=4096});let o=[];const r=window.ExtensionRegistry;return r&&r._manifests&&r._manifests.forEach(a=>{a.batchActions&&a.batchActions.forEach(c=>{c.match(e)&&o.push(c)})}),o.sort((a,c)=>(a.order||99)-(c.order||99)),n`
            ${t>0?n`
                <button class="cart-btn" @click=${()=>this.modalOpen=!0}>
                    <yv-icon name="zap" style="width: 14px; height: 14px;"></yv-icon>
                    <span class="cart-text">${t} items</span>
                    <span class="cart-badge mobile-only">${t}</span>
                </button>
            `:""}

            <div class="tray-overlay ${this.modalOpen?"open":""}" @click=${()=>this.modalOpen=!1}></div>
            <div class="tray-panel ${this.modalOpen?"open":""}">
                <div class="tray-header">
                    <div style="display: flex; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: color-mix(in srgb, var(--intent-warning) 15%, transparent); border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent); display: flex; align-items: center; justify-content: center; color: var(--intent-warning);">
                            <yv-icon name="zap" style="width: 18px; height: 18px;"></yv-icon>
                        </div>
                        <div>
                            <h3>Quickpack Staging Deck <span class="cart-badge" style="margin-left: 8px;">${t}</span></h3>
                            <p>Compiled payload bundle staging</p>
                        </div>
                    </div>
                    <button @click=${()=>this.modalOpen=!1}>✕</button>
                </div>
                <div class="tray-subheader">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="display: flex; align-items: center; gap: 6px;"><yv-icon name="layers" style="width: 14px; height: 14px;"></yv-icon> ${t} items</span>
                        <span style="display: flex; align-items: center; gap: 6px;"><yv-icon name="database" style="width: 14px; height: 14px;"></yv-icon> ~${Math.round(i/1024)} kb</span>
                    </div>
                </div>
                <div class="tray-items">
                    ${e.map(a=>{const c=a.data?.titleText||a.data?.filepath?.split("/").pop()||"Unknown Item",s=a.data?.filepath||a.data?.folderpath||a.data?.id||"",u=a.data?.size_bytes?`${Math.round(a.data.size_bytes/1024)} kb`:"";return n`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${c}</div>${u?n`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${u}</span>`:""}
                                </div>
                                <div class="tray-item-path">${s}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>w.getState().toggleSelection(s,a.entityType,a.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{w.getState().clearSelection(),this.modalOpen=!1}} style="margin-right: auto;"></sutram-async-btn>
                    ${o.map(a=>n`
                        <sutram-async-btn  
                            label="${a.icon}${a.label}" 
                            intent="${a.intent||"primary"}" 
                            variant="${a.variant||"solid"}"
                            ?emphasis=${a.emphasis}
                            .onClick=${async c=>{a.asyncAction?await a.asyncAction(e,c):a.onClick&&a.onClick(e,c)}}>
                        </sutram-async-btn>
                    `)}
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends k{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[S];render(){if(!this.items||this.items.length===0)return n``;const t={};this.items.forEach(i=>{const o=i[this.categoryKey]||"Uncategorized";t[o]||(t[o]=[]),t[o].push(i)});const e=Object.keys(t).sort((i,o)=>{const r=this.categoryOrder||[];let a=r.indexOf(i),c=r.indexOf(o);return a===-1&&(a=999),c===-1&&(c=999),a!==c?a-c:i.localeCompare(o)});return n`
            <div style="display: flex; flex-direction: column;">
                ${e.map(i=>n`
                    <yenvui-category-section titleText=${i}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(i):""}
                        <yenvui-card-group>
                            ${t[i].map(o=>this.renderItem(o))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends k{static properties={files:{type:Array},currentPath:{type:Array}};constructor(){super(),this.files=[],this.currentPath=[]}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const t=et(this.files);let e=t;for(const o of this.currentPath)if(e[o])e=e[o];else{e=t,this.currentPath=[];break}const i=Object.keys(e).filter(o=>o!=="_isFile"&&!e[o]._isFile).sort((o,r)=>o.localeCompare(r));return n`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" ?disabled=${this.currentPath.length===0} @click=${()=>this._setPath(this.currentPath.slice(0,-1))}><yv-icon name="corner-left-up" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> Up</sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${this.currentPath.join("/")}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${i.length===0?n`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>`:i.map(o=>n`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${()=>this._setPath([...this.currentPath,o])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${o}</span>
                    </div>
                `)}
            </div>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends b(R){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends b(N){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramGenericSettingsModal extends E{static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},_jsonBuffers:{type:Object}};static styles=[S,v`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this._jsonBuffers={}}openModal(t,e,i){this.extName=t,this.schema=e||[],this.formData=i||{},this._jsonBuffers={},this.open=!0,this.requestUpdate()}saveSettings(t){const e=t.target,i=e.innerText;e.innerText="\u23F3 Saving...",this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,formData:this.formData,btn:e,origText:i},bubbles:!0,composed:!0}))}render(){if(!this.open)return n``;const e=window.ExtensionRegistry?._manifests?.get(this.extName),i=(e?.name||this.extName)+" Settings",o=e?.settingsActions||[];return n`
            <yenvui-modal  
                ?open=${!0} 
                titleText=${i}  
                ?fullscreen=${!0} 
                ?transparent=${!0}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @yenvui-modal-closed=${()=>this.open=!1}>
                ${o.filter(r=>!r.id.endsWith("_generic_settings")).map(r=>n`
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px;">
                            <label style="font-size: 0.95rem; color: var(--text); font-weight: bold;">${r.icon||""} ${r.label}</label>
                            <span style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Click to open the dedicated configuration panel.</span>
                            <sutram-async-btn label="Open Editor" intent="primary" .onClick=${async a=>{this.open=!1,r.onClick&&await r.onClick(a)}}></sutram-async-btn>
                        </div>
                    `)}

                    ${this.schema.map(r=>{if(r.type==="hidden")return"";const a=this.formData[r.id]!==void 0?this.formData[r.id]:r.default;let c="";if(r.type==="action")c=n`
                                <sutram-async-btn
                                    label=${r.button_label||r.label||"Execute Action"}
                                    intent=${r.intent||"primary"}
                                    .onClick=${async u=>new Promise((m,p)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:r,resolve:m,reject:p,originalEvent:u},bubbles:!0,composed:!0}))})}>
                                </sutram-async-btn>
                            `;else if(r.type==="boolean")c=n`<sutram-toggle .checked=${!!a} @sutram-input-changed=${u=>{this.formData={...this.formData,[r.id]:u.detail.value},this.requestUpdate()}} ?flush=${!0} style="margin-top: 4px;"></sutram-toggle>`;else if(r.type==="select"){const u=(r.options||[]).map(m=>({value:m.value!==void 0?m.value:m,label:m.label||m.title||m.value||m}));c=n`<sutram-select .value=${a} .options=${u} @sutram-input-changed=${m=>{this.formData={...this.formData,[r.id]:m.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-select>`}else if(r.type==="number")c=n`<sutram-input type="number" .value=${a} @sutram-input-changed=${u=>{this.formData={...this.formData,[r.id]:parseFloat(u.detail.value)},this.requestUpdate()}} ?flush=${!0}></sutram-input>`;else if(r.type==="object"||r.type==="json"||typeof a=="object"&&a!==null){const u=this._jsonBuffers[r.id]!==void 0?this._jsonBuffers[r.id]:typeof a=="object"&&a!==null?JSON.stringify(a,null,2):a;c=n`<sutram-textarea .value=${u} .monospace=${!0} .minRows=${4} @sutram-input-changed=${m=>{this._jsonBuffers={...this._jsonBuffers,[r.id]:m.detail.value};try{this.formData={...this.formData,[r.id]:JSON.parse(m.detail.value)}}catch{}this.requestUpdate()}} ?flush=${!0}></sutram-textarea>`}else{const u=r.type==="password"?"password":"text";c=n`<sutram-input type="${u}" .value=${a} @sutram-input-changed=${m=>{this.formData={...this.formData,[r.id]:m.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-input>`}const s=r.title||r.label||r.id;return n`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${r.type==="boolean"?n`<div style="display: flex; align-items: center; gap: 10px;"><label style="font-size: 0.95rem; color: var(--text); font-weight: bold; margin: 0; cursor: pointer;">${s}</label>${c}</div>`:n`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${s}</label>${c}`}
                                ${r.html_desc?n`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;" .innerHTML=${r.html_desc}></div>`:r.description||r.desc?n`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;">${r.description||r.desc}</div>`:""}
                            </div>
                        `})}
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveSettings}>
                    Save Settings
                </button>
            </yenvui-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends E{static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=v`
        :host { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        :host([scrollable]) {
            flex-wrap: nowrap;
            width: 100%;
            display: block;
        }
        .action-tray-dialog {
            background: transparent;
            border: none;
            padding: 0;
            margin: 0;
            max-width: 100vw;
            width: 100%;
            max-height: 100dvh;
            height: 100%;
            overflow: hidden;
            pointer-events: auto !important;
        }
        .action-tray-dialog::backdrop {
            background: var(--modal-backdrop, rgba(0,0,0,0.6));
            backdrop-filter: var(--modal-backdrop-filter, blur(3px));
            pointer-events: auto !important;
        }
        .action-tray-dialog[open] {
            display: flex;
            align-items: flex-start;
            justify-content: center;
        }
        .action-tray-panel {
            background: var(--pane-bg);
            border-bottom: 1px solid var(--border);
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 800px;
            max-height: 85dvh;
            overflow: hidden;
            margin: 0 auto;
            animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        :host([data-theme="e-ink"]) .action-tray-panel {
            border: 2px solid #000;
            border-top: none;
            box-shadow: 4px 4px 0 #8b5cf6;
        }
        .tray-group-header {
            font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
            color: var(--intent-primary); border-bottom: 1px solid color-mix(in srgb, var(--intent-primary) 30%, transparent);
            padding: 0 4px 4px 4px; margin: 15px 15px 10px 15px;
        }
        .tray-group-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: 0 15px;
        }
        .sync-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--btn-padding, 8px 14px);
            font-size: var(--btn-font-size, 0.85rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, normal);
            border-radius: var(--btn-border-radius, 4px);
            border: none;
            cursor: pointer;
            white-space: nowrap;
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
            color: #ffffff;
        }
        .sync-btn:hover { filter: brightness(1.1); }
        .sync-btn:active { transform: scale(0.98); }
        .sync-btn.active {
            box-shadow: inset 0 0 0 2px var(--text, #ffffff);
            filter: brightness(1.15);
        }
        :host([data-theme="e-ink"]) .sync-btn {
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 3px 0 #eab308 !important;
        }
        :host([data-theme="e-ink"]) .sync-btn:hover { background: #f1f5f9 !important; }
        :host([data-theme="e-ink"]) .sync-btn.active { background: #000000 !important; color: #ffffff !important; }
    `;updated(t){if(super.updated(t),t.has("_trayOpen")){const e=this.shadowRoot.querySelector(".action-tray-dialog");e&&(this._trayOpen&&!e.open?e.showModal():!this._trayOpen&&e.open&&e.close())}}connectedCallback(){super.connectedCallback(),this.observeTheme()}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const e=async(s,u)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(s,this.entityData,u);if(s.asyncAction)return await s.asyncAction(this.entityData,u);if(s.onClick)return s.onClick(this.entityData,u)};if(this.variant==="menu-bar"){const s={file:[],edit:[],share:[],tools:[]};t.forEach(p=>{const x=p.group&&s[p.group]?p.group:"tools";s[x].push({...p,label:typeof p.label=="function"?p.label(this.entityData):p.label,icon:typeof p.icon=="function"?p.icon(this.entityData):p.icon||"",asyncAction:p.asyncAction?f=>e(p,f):null,onClick:!p.asyncAction&&p.onClick?f=>e(p,f):null})});const u={file:"File",edit:"Edit",share:"Share",tools:"Tools"},m={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"};return n`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(s).map(p=>s[p].length===0?"":n`
                            <sutram-dropdown .items=${s[p]} align="left">
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${m[p]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${u[p]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const i=[],o=[];t.forEach(s=>{(s.order||99)<20?i.push(s):o.push(s)});const r=s=>{if(s.component)return n`<div style="display: contents; order: ${s.order||99};">${s.component(this.entityData)}</div>`;const u=typeof s.label=="function"?s.label(this.entityData):s.label,m=typeof s.icon=="function"?s.icon(this.entityData):s.icon||"",p=typeof s.intent=="function"?s.intent(this.entityData):s.intent||"primary",x=typeof s.isActive=="function"?s.isActive(this.entityData):!!s.isActive,f=l=>l?typeof l=="object"?l:l.includes("<")?n`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${l}</span>`:/^[a-zA-Z0-9-]+$/.test(l)?n`<yv-icon name="${l}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:n`<span style="margin-right: 6px;">${l}</span>`:"";if(s.asyncAction||window.ExtensionRegistry.executeEntityAction&&s.vfsBound)return n`
                    <sutram-async-btn 
                        style="margin: 0; order: ${s.order||99};" 
                        .label=${n`${f(m)}${u}`} 
                        intent="${p}" 
                        ?active=${x}
                        .onClick=${l=>e(s,l)}>
                    </sutram-async-btn>
                `;const h=l=>{if(l&&l.stopPropagation(),s.emitEvent){const g=s.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(g.name,{detail:g.detail,bubbles:!0,composed:!0}))}else e(s,l)};return n`
                <sutram-btn 
                    intent=${p} 
                    ?active=${x}
                    style="order: ${s.order||99}; gap: 4px;" 
                    @click=${h}>
                    ${f(m)}${u}
                </sutram-btn>
            `},a=()=>{const s={file:[],edit:[],share:[],tools:[]};t.forEach(h=>{const l=h.group&&s[h.group]?h.group:"tools";s[l].push(h)});const u={file:"File",edit:"Edit",share:"Share",tools:"Tools"},m={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},p=async(h,l)=>{this._trayOpen=!1,await e(h,l)},x=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",f=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return n`
                <dialog class="action-tray-dialog" @cancel=${h=>{h.preventDefault(),this._trayOpen=!1}} @click=${h=>{h.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${x}</span>
                                ${f?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(s).map(h=>s[h].length===0?"":n`
                                    <div class="tray-group-header">
                                        <yv-icon name="${m[h]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${u[h]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${s[h].map(l=>{const g=typeof l.label=="function"?l.label(this.entityData):l.label,_=typeof l.icon=="function"?l.icon(this.entityData):l.icon||"",$=typeof l.intent=="function"?l.intent(this.entityData):l.intent||"primary",C=typeof l.isActive=="function"?l.isActive(this.entityData):!!l.isActive,D=y=>y?typeof y=="object"?y:y.includes("<")?n`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${y}</span>`:/^[a-zA-Z0-9-]+$/.test(y)?n`<yv-icon name="${y}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:n`<span style="margin-right: 6px;">${y}</span>`:"";return l.asyncAction||window.ExtensionRegistry.executeEntityAction&&l.vfsBound?n`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${n`${D(_)}${g}`} 
                                                        intent="${$}" 
                                                        ?active=${C}
                                                        .onClick=${y=>p(l,y)}>
                                                    </sutram-async-btn>
                                                `:n`
                                                <button 
                                                    class="sync-btn ${C?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: var(--intent-${$}); color: ${$==="warning"?"#000":"#fff"};" 
                                                    @click=${y=>p(l,y)}>
                                                    ${D(_)}${g}
                                                </button>
                                            `})}
                                    </div>
                                `)}
                        </div>
                    </div>
                </dialog>
            `},c=n`
            ${t.length>0?n`
                <sutram-btn intent="neutral" style="padding: 4px 12px; font-size: 1.1rem; line-height: 1; order: -1; margin-right: 4px;"
                    @click=${s=>{s.stopPropagation(),this._trayOpen=!0}}>
                    ⋮
                </sutram-btn>
            `:""}
            ${i.map(r)}
        `;return n`
            ${this.scrollable?n`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${c}
                    </div>
                </sutram-scrub-track>
            `:c}
            ${this._trayOpen?a():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends b(z){static properties={...z.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?w:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,i=>{const o=this._getId();o&&i.selectedItems&&(this.selected=i.selectedItems.has(o))});const t=this._getId(),e=this._getStore();t&&e&&e.getState().selectedItems&&(this.selected=e.getState().selectedItems.has(t))}this.addEventListener("yenvui-overlay-opened",t=>{if(!this.entityType||!this.entityData)return;(window.ExtensionRegistry?.getEntityActions?.(this.entityType,this.entityData)||[]).forEach(i=>{typeof i.onReveal=="function"&&i.onReveal(this.entityData)})}),this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const e=this._getId();if(e&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const i=this._getStore();i&&i.getState().toggleSelection&&i.getState().toggleSelection(e,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:e,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if(super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const e=this._getId(),i=this._getStore();e&&i&&i.getState().selectedItems&&(this.selected=i.getState().selectedItems.has(e))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this._hasActions||(this._hasActions=!0),!this._overlayActive)return;let e=this.querySelector(".sutram-injected-actions");if(e){const i=e.querySelector("sutram-entity-actions");i&&(i.entityType=this.entityType,i.entityData=this.entityData)}else{e=document.createElement("div"),e.className="sutram-injected-actions",e.slot="actions",e.style.display="flex",e.style.flexWrap="nowrap",e.style.gap="8px",e.style.alignItems="center",e.style.width="max-content",e.addEventListener("click",o=>o.stopPropagation());const i=document.createElement("sutram-entity-actions");i.entityType=this.entityType,i.entityData=this.entityData,i.scrollable=!0,e.appendChild(i),this.appendChild(e),this._hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends U{}customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends G{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends W{}customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends Q{}customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends H{}customElements.define("sutram-board",SutramBoard);export class SutramColumn extends V{}customElements.define("sutram-column",SutramColumn);export class SutramTag extends J{}customElements.define("sutram-tag",SutramTag);export class SutramLabel extends Z{}customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends tt{}customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends st{}customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends K{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends X{}customElements.define("sutram-dropdown",SutramDropdown);export class SutramFilterDropdown extends it{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends F{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends M{}customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends q{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends P{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as L}from"./wordcount.js";const ie=[];export class SutramEditor extends b(j){static properties={...j.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const e=Array.isArray(this.customExtensions)?this.customExtensions.filter(i=>i!==L):[];this.enableWordcount&&e.push(L),this.customExtensions=e}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends E{static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String}};static styles=[S,v`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery=""}render(){if(!this.open)return n``;const t=this._searchQuery?this.utils.fuzzyFilterObjects(this.items,this._searchQuery).slice(0,50):this.items.slice(0,50);return n`
            <sutram-modal ?open=${!0} titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <input type="text" placeholder="Search..." .value=${this._searchQuery} @input=${e=>this._searchQuery=e.target.value} style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 10px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${t.length===0?n`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>`:t.map(e=>{const i=typeof e=="string"?e:e.label||e;return n`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:e},bubbles:!0,composed:!0}))}}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${i}
                                </button>
                            `})}
                    </div>
                </div>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);
