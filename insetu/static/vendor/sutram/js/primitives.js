import{LitElement as S,html as n,css as v}from"lit";import{SutramElement as $,SutramContextMixin as g,SelectionStore as w,ToastStore as D,EnvironmentStore as j}from"./sutram_sdk.js";import{YenvuiBtn as R,YenvuiAsyncBtn as A}from"../../yenvui/js/async-btn.js";import{YenvuiStatusBar as T}from"../../yenvui/js/status-bar.js";import{YenvuiToastContainer as B}from"../../yenvui/js/toast.js";import{YenvuiModal as U}from"../../yenvui/js/modal.js";import{YenvuiWindow as Y}from"../../yenvui/js/window.js";import{YenvuiCategorySection as M}from"../../yenvui/js/category-section.js";import{YenvuiCard as z}from"../../yenvui/js/card.js";import{YenvuiCardGroup as N}from"../../yenvui/js/card-group.js";import{YenvuiEditor as O}from"../../yenvui/js/editor.js";import{YenvuiToolbar as q}from"../../yenvui/js/toolbar.js";import{YenvuiCollapsible as P}from"../../yenvui/js/collapsible.js";import{YenvuiPill as K}from"../../yenvui/js/pill.js";import{YenvuiFilterGroup as F}from"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import{YenvuiSearchBar as H}from"../../yenvui/js/search-bar.js";import{YenvuiSpinner as G}from"../../yenvui/js/spinner.js";import{YenvuiEmptyState as W}from"../../yenvui/js/empty-state.js";import{YenvuiBoard as Q,YenvuiColumn as V}from"../../yenvui/js/board.js";import{YenvuiTag as Z}from"../../yenvui/js/tag.js";import{YenvuiLabel as J}from"../../yenvui/js/label.js";import{YenvuiDropdown as X}from"../../yenvui/js/dropdown.js";import{YenvuiScrubTrack as tt}from"../../yenvui/js/yenvui-base.js";import{sharedStyles as E}from"./shared_styles.js";import"./utils.js";import"../../yenvui/js/async-btn.js";import"../../yenvui/js/status-bar.js";import"../../yenvui/js/toast.js";import"../../yenvui/js/modal.js";import"../../yenvui/js/window.js";import"../../yenvui/js/category-section.js";import"../../yenvui/js/card.js";import"../../yenvui/js/card-group.js";import"../../yenvui/js/editor.js";import"../../yenvui/js/toolbar.js";import"../../yenvui/js/collapsible.js";import{YenvuiFilterDropdown as et}from"../../yenvui/js/dropdown.js";import"../../yenvui/js/pill.js";import"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import"../../yenvui/js/search-bar.js";import"../../yenvui/js/spinner.js";import"../../yenvui/js/empty-state.js";import"../../yenvui/js/board.js";import"../../yenvui/js/tag.js";import"../../yenvui/js/label.js";import{YenvuiScrollView as it}from"../../yenvui/js/scroll-view.js";import"../../yenvui/js/scroll-view.js";import"/static/vendor/lit/lit-virtualizer.min.js";export class SutramVirtualList extends S{static properties={items:{type:Array},renderItem:{type:Object}};static styles=v`
        :host { display: flex; flex-direction: column; width: 100%; flex: 1; min-width: 0; }
        lit-virtualizer { width: 100%; flex: 1; min-width: 0; }
    `;render(){return!this.items||this.items.length===0?n``:n`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramBtn extends R{}customElements.define("sutram-btn",SutramBtn);export class SutramAsyncBtn extends g(A){static properties={...A.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(j,t=>{if(t.isOffline){let e=this,s=null;for(;e;){if(e.dataset&&e.dataset.ext){s=e.dataset.ext;break}e=e.getRootNode().host||e.parentElement}const p=s&&window.ExtensionRegistry?.getExtension(s)?.offline_mode;this._isOfflineReadOnly=p==="read_only"||p==="none"||!p}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="\u{1F6AB} Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label)}_updateState(){this._isOfflineReadOnly?(this.label!=="\u{1F6AB} Offline"&&(this._originalLabel=this.label),this.label="\u{1F6AB} Offline",this.disabled=!0):(this.label=this._originalLabel||this.label,this.disabled=!1)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends g(T){static properties={...T.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends g(B){connectedCallback(){super.connectedCallback(),this.subscribe(D,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{D.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends ${static properties={selectedItems:{type:Object},modalOpen:{type:Boolean}};static styles=[E,v`
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
            background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 3000; display: flex; flex-direction: column;
            transform: translateY(-20px); opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            max-height: calc(100dvh - 80px);
        }
        .tray-panel.open { transform: translateY(0); opacity: 1; pointer-events: auto; }

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
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1}connectedCallback(){super.connectedCallback(),this.subscribe(w,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.requestUpdate()}),this.selectedItems=w.getState().selectedItems}render(){const t=this.selectedItems.size,e=Array.from(this.selectedItems.values());let s=0,p=!1;e.forEach(i=>{if(i.data?.size_bytes)s+=i.data.size_bytes;else{const a=i.data?.filepath||i.data?.folderpath||i.data?.id,c=window.inSetu?.stores?.App?.getState()?.manifest;c?.ctx?.[a]?.meta?.size_bytes?s+=c.ctx[a].meta.size_bytes:p=!0}});let r="";s>0?r=`~${Math.round(s/1024)} kb${p?"+":""}`:p&&(r="Calculated on compile");let u=[];const m=window.ExtensionRegistry;return m&&m._manifests&&m._manifests.forEach(i=>{i.batchActions&&i.batchActions.forEach(a=>{a.match(e)&&u.push(a)})}),u.sort((i,a)=>(i.order||99)-(a.order||99)),n`
            ${t>0?n`
                <button class="cart-btn" @click=${()=>this.modalOpen=!0}>
                    <yv-icon name="zap" style="width: 14px; height: 14px;"></yv-icon>
                    <span class="cart-text">${t} items</span>
                    <span class="cart-badge mobile-only">${t}</span>
                </button>
            `:""}

            <div class="tray-overlay ${this.modalOpen?"open":""}" @click=${()=>this.modalOpen=!1}></div>
            <div class="tray-panel ${this.modalOpen?"open":""}">
                <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">SELECTION STAGING</span>
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">Quickpack Deck <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${r?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r}</span>`:""}
                    </div>
                    <button class="sync-btn" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${e.map(i=>{const a=i.data?.titleText||i.data?.filepath?.split("/").pop()||"Unknown Item",c=i.data?.filepath||i.data?.folderpath||i.data?.id||"";let l=i.data?.size_bytes;l||(l=window.inSetu?.stores?.App?.getState()?.manifest?.ctx?.[c]?.meta?.size_bytes);const f=l?`${Math.round(l/1024)} kb`:"";return n`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${a}</div>${f?n`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${f}</span>`:""}
                                </div>
                                <div class="tray-item-path">${c}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>w.getState().toggleSelection(c,i.entityType,i.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{w.getState().clearSelection(),this.modalOpen=!1}} style="margin-right: auto;"></sutram-async-btn>
                    ${u.map(i=>n`
                        <sutram-async-btn  
                            .label=${i.label}
                            .icon=${i.icon}
                            intent="${i.intent||"primary"}" 
                            variant="${i.variant||"tinted"}"
                            ?emphasis=${i.emphasis}
                            .onClick=${async a=>{i.asyncAction?await i.asyncAction(e,a):i.onClick&&i.onClick(e,a)}}>
                        </sutram-async-btn>
                    `)}
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends S{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[E];render(){if(!this.items||this.items.length===0)return n``;const t={};this.items.forEach(s=>{const p=s[this.categoryKey]||"Uncategorized";t[p]||(t[p]=[]),t[p].push(s)});const e=Object.keys(t).sort((s,p)=>{const r=this.categoryOrder||[];let u=r.indexOf(s),m=r.indexOf(p);return u===-1&&(u=999),m===-1&&(m=999),u!==m?u-m:s.localeCompare(p)});return n`
            <div style="display: flex; flex-direction: column;">
                ${e.map(s=>n`
                    <yenvui-category-section titleText=${s}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(s):""}
                        <yenvui-card-group>
                            ${t[s].map(p=>this.renderItem(p))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends S{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={};const t=window.SUTRAM_PUBLIC_PATH?new URL("./workers/search-worker.js",window.SUTRAM_PUBLIC_PATH):new URL("./workers/search-worker.js",import.meta.url);this._worker=new Worker(t,{type:"module"}),this._worker.onmessage=e=>{e.data.requestId===this._lastReqId&&(this._treeData=e.data.tree)}}disconnectedCallback(){super.disconnectedCallback(),this._worker&&this._worker.terminate()}updated(t){super.updated(t),t.has("files")&&(this._lastReqId=Date.now(),this._worker.postMessage({type:"BUILD_TREE",requestId:this._lastReqId,items:this.files}))}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){let t=this._treeData||{};for(const s of this.currentPath)if(t[s])t=t[s];else{t=this._treeData||{},this.currentPath=[];break}const e=Object.keys(t).filter(s=>s!=="_isFile"&&!t[s]._isFile).sort((s,p)=>s.localeCompare(p));return n`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" icon="corner-left-up" label="Up" ?disabled=${this.currentPath.length===0} @click=${()=>this._setPath(this.currentPath.slice(0,-1))}></sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${this.currentPath.join("/")}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${e.length===0?n`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>`:e.map(s=>n`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${()=>this._setPath([...this.currentPath,s])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${s}</span>
                    </div>
                `)}
            </div>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends g(U){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends g(Y){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramGenericSettingsModal extends ${static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},_jsonBuffers:{type:Object}};static styles=[E,v`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this._jsonBuffers={}}openModal(t,e,s){this.extName=t,this.schema=e||[],this.formData=s||{},this._jsonBuffers={},this.open=!0,this.requestUpdate()}saveSettings(t){const e=t.target,s=e.innerText;e.innerText="\u23F3 Saving...",this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,formData:this.formData,btn:e,origText:s},bubbles:!0,composed:!0}))}render(){if(!this.open)return n``;const e=window.ExtensionRegistry?._manifests?.get(this.extName),s=(e?.name||this.extName)+" Settings",p=e?.settingsActions||[];return n`
            <yenvui-modal  
                ?open=${!0} 
                titleText=${s}  
                ?fullscreen=${!0} 
                ?transparent=${!0}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @yenvui-modal-closed=${()=>this.open=!1}>
                ${p.filter(r=>!r.id.endsWith("_generic_settings")).map(r=>n`
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px;">
                            <label style="font-size: 0.95rem; color: var(--text); font-weight: bold;">${r.icon||""} ${r.label}</label>
                            <span style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Click to open the dedicated configuration panel.</span>
                            <sutram-async-btn label="Open Editor" intent="primary" .onClick=${async u=>{this.open=!1,r.onClick&&await r.onClick(u)}}></sutram-async-btn>
                        </div>
                    `)}

                    ${this.schema.map(r=>{if(r.type==="hidden")return"";const u=this.formData[r.id]!==void 0?this.formData[r.id]:r.default;let m="";if(r.type==="action")m=n`
                                <sutram-async-btn
                                    label=${r.button_label||r.label||"Execute Action"}
                                    intent=${r.intent||"primary"}
                                    .onClick=${async a=>new Promise((c,l)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:r,resolve:c,reject:l,originalEvent:a},bubbles:!0,composed:!0}))})}>
                                </sutram-async-btn>
                            `;else if(r.type==="boolean")m=n`<sutram-toggle .checked=${!!u} @sutram-input-changed=${a=>{this.formData={...this.formData,[r.id]:a.detail.value},this.requestUpdate()}} ?flush=${!0} style="margin-top: 4px;"></sutram-toggle>`;else if(r.type==="select"){const a=(r.options||[]).map(c=>({value:c.value!==void 0?c.value:c,label:c.label||c.title||c.value||c}));m=n`<sutram-select .value=${u} .options=${a} @sutram-input-changed=${c=>{this.formData={...this.formData,[r.id]:c.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-select>`}else if(r.type==="number")m=n`<sutram-input type="number" .value=${u} @sutram-input-changed=${a=>{this.formData={...this.formData,[r.id]:parseFloat(a.detail.value)},this.requestUpdate()}} ?flush=${!0}></sutram-input>`;else if(r.type==="object"||r.type==="json"||typeof u=="object"&&u!==null){const a=this._jsonBuffers[r.id]!==void 0?this._jsonBuffers[r.id]:typeof u=="object"&&u!==null?JSON.stringify(u,null,2):u;m=n`<sutram-textarea .value=${a} .monospace=${!0} .minRows=${4} @sutram-input-changed=${c=>{this._jsonBuffers={...this._jsonBuffers,[r.id]:c.detail.value};try{this.formData={...this.formData,[r.id]:JSON.parse(c.detail.value)}}catch{}this.requestUpdate()}} ?flush=${!0}></sutram-textarea>`}else{const a=r.type==="password"?"password":"text";m=n`<sutram-input type="${a}" .value=${u} @sutram-input-changed=${c=>{this.formData={...this.formData,[r.id]:c.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-input>`}const i=r.title||r.label||r.id;return n`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${r.type==="boolean"?n`<div style="display: flex; align-items: center; gap: 10px;"><label style="font-size: 0.95rem; color: var(--text); font-weight: bold; margin: 0; cursor: pointer;">${i}</label>${m}</div>`:n`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${i}</label>${m}`}
                                ${r.html_desc?n`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;" .innerHTML=${r.html_desc}></div>`:r.description||r.desc?n`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;">${r.description||r.desc}</div>`:""}
                            </div>
                        `})}
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveSettings}>
                    Save Settings
                </button>
            </yenvui-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends ${static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=[E,v`
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
    `];updated(t){if(super.updated(t),t.has("_trayOpen")){const e=this.shadowRoot.querySelector(".action-tray-dialog");e&&(this._trayOpen&&!e.open?e.showModal():!this._trayOpen&&e.open&&e.close())}}connectedCallback(){super.connectedCallback()}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const e=async(i,a)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(i,this.entityData,a);if(i.asyncAction)return await i.asyncAction(this.entityData,a);if(i.onClick)return i.onClick(this.entityData,a)};if(this.variant==="menu-bar"){const i={file:[],edit:[],share:[],tools:[]};t.forEach(l=>{const f=l.group&&i[l.group]?l.group:"tools";i[f].push({...l,label:typeof l.label=="function"?l.label(this.entityData):l.label,icon:typeof l.icon=="function"?l.icon(this.entityData):l.icon||"",asyncAction:l.asyncAction?b=>e(l,b):null,onClick:!l.asyncAction&&l.onClick?b=>e(l,b):null})});const a={file:"File",edit:"Edit",share:"Share",tools:"Tools"},c={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"};return n`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(i).map(l=>i[l].length===0?"":n`
                            <sutram-dropdown .items=${i[l]} align="left">
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${c[l]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${a[l]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const s=[],p=[];t.forEach(i=>{(i.order||99)<20?s.push(i):p.push(i)});const r=i=>{if(i.component)return n`<div style="display: contents; order: ${i.order||99};">${i.component(this.entityData)}</div>`;const a=typeof i.label=="function"?i.label(this.entityData):i.label,c=typeof i.icon=="function"?i.icon(this.entityData):i.icon||"",l=typeof i.intent=="function"?i.intent(this.entityData):i.intent||"primary",f=typeof i.isActive=="function"?i.isActive(this.entityData):!!i.isActive,b=o=>o?typeof o=="object"?o:o.includes("<")?n`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${o}</span>`:/^[a-zA-Z0-9-]+$/.test(o)?n`<yv-icon name="${o}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:n`<span style="margin-right: 6px;">${o}</span>`:"";if(i.asyncAction||window.ExtensionRegistry.executeEntityAction&&i.vfsBound)return n`
                    <sutram-async-btn 
                        style="margin: 0; order: ${i.order||99};" 
                        .label=${a}
                        .icon=${c}
                        intent="${l}" 
                        ?active=${f}
                        .onClick=${o=>e(i,o)}>
                    </sutram-async-btn>
                `;const h=o=>{if(o&&o.stopPropagation(),i.emitEvent){const x=i.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(x.name,{detail:x.detail,bubbles:!0,composed:!0}))}else e(i,o)};return n`
                <sutram-btn 
                    intent=${l} 
                    ?active=${f}
                    style="order: ${i.order||99}; gap: 4px;"
                    .label=${a}
                    .icon=${c}
                    @click=${h}>
                </sutram-btn>
            `},u=()=>{const i={file:[],edit:[],share:[],tools:[]};t.forEach(h=>{const o=h.group&&i[h.group]?h.group:"tools";i[o].push(h)});const a={file:"File",edit:"Edit",share:"Share",tools:"Tools"},c={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},l=async(h,o)=>{await e(h,o)},f=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",b=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return n`
                <dialog class="action-tray-dialog" @cancel=${h=>{h.preventDefault(),this._trayOpen=!1}} @click=${h=>{h.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f}</span>
                                ${b?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(i).map(h=>i[h].length===0?"":n`
                                    <div class="tray-group-header">
                                        <yv-icon name="${c[h]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${a[h]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${i[h].map(o=>{const x=typeof o.label=="function"?o.label(this.entityData):o.label,_=typeof o.icon=="function"?o.icon(this.entityData):o.icon||"",k=typeof o.intent=="function"?o.intent(this.entityData):o.intent||"primary",C=typeof o.isActive=="function"?o.isActive(this.entityData):!!o.isActive,L=y=>y?typeof y=="object"?y:y.includes("<")?n`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${y}</span>`:/^[a-zA-Z0-9-]+$/.test(y)?n`<yv-icon name="${y}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:n`<span style="margin-right: 6px;">${y}</span>`:"";return o.asyncAction||window.ExtensionRegistry.executeEntityAction&&o.vfsBound?n`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${x}
                                                        .icon=${_}
                                                        intent="${k}" 
                                                        ?active=${C}
                                                        .onClick=${y=>l(o,y)}>
                                                    </sutram-async-btn>
                                                `:n`
                                                <button 
                                                    class="sync-btn ${C?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${k}) 15%, transparent); color: var(--intent-${k}); border: 1px solid color-mix(in srgb, var(--intent-${k}) 40%, transparent);" 
                                                    @click=${y=>l(o,y)}>
                                                    ${L(_)}${x}
                                                </button>
                                            `})}
                                    </div>
                                `)}
                        </div>
                    </div>
                </dialog>
            `},m=n`
            ${t.length>0?n`
                <sutram-btn intent="neutral" style="order: -1; margin-right: 4px;"
                    label="⋮"
                    @click=${i=>{i.stopPropagation(),this._trayOpen=!0}}>
                </sutram-btn>
            `:""}
            ${s.map(r)}
        `;return n`
            ${this.scrollable?n`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${m}
                    </div>
                </sutram-scrub-track>
            `:m}
            ${this._trayOpen?u():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends g(z){static properties={...z.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?w:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,s=>{const p=this._getId();p&&s.selectedItems&&(this.selected=s.selectedItems.has(p))});const t=this._getId(),e=this._getStore();t&&e&&e.getState().selectedItems&&(this.selected=e.getState().selectedItems.has(t))}this.addEventListener("yenvui-overlay-opened",t=>{if(!this.entityType||!this.entityData)return;(window.ExtensionRegistry?.getEntityActions?.(this.entityType,this.entityData)||[]).forEach(s=>{typeof s.onReveal=="function"&&s.onReveal(this.entityData)})}),this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const e=this._getId();if(e&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const s=this._getStore();s&&s.getState().toggleSelection&&s.getState().toggleSelection(e,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:e,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if(super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const e=this._getId(),s=this._getStore();e&&s&&s.getState().selectedItems&&(this.selected=s.getState().selectedItems.has(e))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this._hasActions||(this._hasActions=!0),!this._overlayActive)return;let e=this.querySelector(".sutram-injected-actions");if(e){const s=e.querySelector("sutram-entity-actions");s&&(s.entityType=this.entityType,s.entityData=this.entityData)}else{e=document.createElement("div"),e.className="sutram-injected-actions",e.slot="actions",e.style.display="flex",e.style.flexWrap="nowrap",e.style.gap="8px",e.style.alignItems="center",e.style.width="max-content",e.addEventListener("click",p=>p.stopPropagation());const s=document.createElement("sutram-entity-actions");s.entityType=this.entityType,s.entityData=this.entityData,s.scrollable=!0,e.appendChild(s),this.appendChild(e),this._hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends N{}customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends H{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends G{}customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends W{}customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends Q{}customElements.define("sutram-board",SutramBoard);export class SutramColumn extends V{}customElements.define("sutram-column",SutramColumn);export class SutramTag extends Z{}customElements.define("sutram-tag",SutramTag);export class SutramLabel extends J{}customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends tt{}customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends it{}customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends q{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends X{}customElements.define("sutram-dropdown",SutramDropdown);export class SutramFilterDropdown extends et{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends P{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends M{}customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends K{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends F{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as I}from"./wordcount.js";const ie=[];export class SutramEditor extends g(O){static properties={...O.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const e=Array.isArray(this.customExtensions)?this.customExtensions.filter(s=>s!==I):[];this.enableWordcount&&e.push(I),this.customExtensions=e}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends ${static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[E,v`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[];const t=window.SUTRAM_PUBLIC_PATH?new URL("./workers/search-worker.js",window.SUTRAM_PUBLIC_PATH):new URL("./workers/search-worker.js",import.meta.url);this._worker=new Worker(t,{type:"module"}),this._worker.onmessage=e=>{e.data.requestId===this._lastSearchReq&&(this._filteredItems=e.data.results.slice(0,50))}}disconnectedCallback(){super.disconnectedCallback(),this._worker&&this._worker.terminate()}updated(t){super.updated(t),(t.has("items")||t.has("_searchQuery"))&&(this._searchQuery?(this._lastSearchReq=Date.now(),this._worker.postMessage({type:"FUZZY_SEARCH",requestId:this._lastSearchReq,items:this.items,query:this._searchQuery})):this._filteredItems=this.items.slice(0,50))}render(){if(!this.open)return n``;const t=this._filteredItems||[];return n`
            <sutram-modal ?open=${!0} titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <input type="text" placeholder="Search..." .value=${this._searchQuery} @input=${e=>this._searchQuery=e.target.value} style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 10px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${t.length===0?n`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>`:t.map(e=>{const s=typeof e=="string"?e:e.label||e;return n`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:e},bubbles:!0,composed:!0}))}}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${s}
                                </button>
                            `})}
                    </div>
                </div>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);
