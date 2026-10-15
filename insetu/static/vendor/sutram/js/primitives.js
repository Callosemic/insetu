import{LitElement as _,html as r,css as x}from"lit";import{SutramElement as $,SutramContextMixin as g,SelectionStore as E,ToastStore as D,EnvironmentStore as R}from"./sutram_sdk.js";import{YenvuiBtn as B,YenvuiAsyncBtn as A}from"../../yenvui/js/async-btn.js";import{YenvuiStatusBar as T}from"../../yenvui/js/status-bar.js";import{YenvuiToastContainer as Y}from"../../yenvui/js/toast.js";import{YenvuiModal as U}from"../../yenvui/js/modal.js";import{YenvuiWindow as N}from"../../yenvui/js/window.js";import{YenvuiCategorySection as q}from"../../yenvui/js/category-section.js";import{YenvuiCard as z}from"../../yenvui/js/card.js";import{YenvuiCardGroup as M}from"../../yenvui/js/card-group.js";import{YenvuiEditor as I}from"../../yenvui/js/editor.js";import{YenvuiToolbar as F}from"../../yenvui/js/toolbar.js";import{YenvuiCollapsible as K}from"../../yenvui/js/collapsible.js";import{YenvuiPill as W}from"../../yenvui/js/pill.js";import{YenvuiFilterGroup as H}from"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import{YenvuiSearchBar as G}from"../../yenvui/js/search-bar.js";import{YenvuiSpinner as Q}from"../../yenvui/js/spinner.js";import{YenvuiEmptyState as V}from"../../yenvui/js/empty-state.js";import{YenvuiBoard as P,YenvuiColumn as Z}from"../../yenvui/js/board.js";import{YenvuiTag as J}from"../../yenvui/js/tag.js";import{YenvuiLabel as X}from"../../yenvui/js/label.js";import{YenvuiDropdown as tt,YenvuiFilterDropdown as et}from"../../yenvui/js/dropdown.js";import{YenvuiScrubTrack as it}from"../../yenvui/js/yenvui-base.js";import{YenvuiScrollView as st}from"../../yenvui/js/scroll-view.js";import{YenvuiDiffViewer as nt}from"../../yenvui/js/diff-viewer.js";import{sharedStyles as v}from"./shared_styles.js";import{resolveDirectoryState as rt,SutramWorker as O}from"./utils.js";import"lit-virtualizer";export class SutramVirtualList extends _{static properties={items:{type:Array},renderItem:{type:Object}};static styles=x`
        :host { display: flex; flex-direction: column; width: 100%; flex: 1; min-width: 0; }
        lit-virtualizer { width: 100%; flex: 1; min-width: 0; }
    `;render(){return!this.items||this.items.length===0?r``:r`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramBtn extends B{}customElements.define("sutram-btn",SutramBtn);export class SutramAsyncBtn extends g(A){static properties={...A.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(R,t=>{if(t.isOffline){let e=this,n=null;for(;e;){if(e.dataset&&e.dataset.ext){n=e.dataset.ext;break}e=e.getRootNode().host||e.parentElement}const c=n&&window.ExtensionRegistry?.getExtension(n)?.offline_mode;this._isOfflineReadOnly=c==="read_only"||c==="none"||!c}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends g(T){static properties={...T.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends g(Y){connectedCallback(){super.connectedCallback(),this.subscribe(D,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{D.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends ${static properties={selectedItems:{type:Object},modalOpen:{type:Boolean}};static styles=[v,x`
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
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1}connectedCallback(){super.connectedCallback(),this.subscribe(E,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.requestUpdate()}),this.selectedItems=E.getState().selectedItems}render(){const t=this.selectedItems.size,e=Array.from(this.selectedItems.values());let n=0,c=!1;const s=window.ExtensionRegistry;e.forEach(i=>{const a=i.data?.size_bytes||(s?.executeUIHook?s.executeUIHook("sutram:resolve-item-size",i.data):null);a?n+=a:c=!0});let p="";n>0?p=`~${Math.round(n/1024)} kb${c?"+":""}`:c&&(p="Calculated on compile");let h=[];return s&&(typeof s.getAggregatableActions=="function"&&(h=s.getAggregatableActions(e,{group:"share"})),s._manifests&&s._manifests.forEach(i=>{i.batchActions&&i.batchActions.forEach(a=>{!h.some(l=>l.id===a.id)&&a.match(e)&&h.push({...a,onClick:a.onClick?l=>a.onClick(e,l):null,asyncAction:a.asyncAction?l=>a.asyncAction(e,l):null})})})),h.sort((i,a)=>(i.order||99)-(a.order||99)),r`
            ${t>0?r`
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
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">Quickpack Deck <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${p?r`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p}</span>`:""}
                    </div>
                    <button class="sync-btn" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${e.map(i=>{const a=i.data?.titleText||i.data?.filepath?.split("/").pop()||"Unknown Item",l=i.data?.filepath||i.data?.folderpath||i.data?.id||"",y=i.data?.size_bytes||(s?.executeUIHook?s.executeUIHook("sutram:resolve-item-size",i.data):null),d=y?`${Math.round(y/1024)} kb`:"";return r`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${a}</div>${d?r`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${d}</span>`:""}
                                </div>
                                <div class="tray-item-path">${l}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>E.getState().toggleSelection(l,i.entityType,i.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{E.getState().clearSelection(),this.modalOpen=!1}} style="margin-right: auto;"></sutram-async-btn>
                    ${h.map(i=>r`
                        <sutram-async-btn  
                            .label=${i.label}
                            .icon=${i.icon}
                            intent="${i.intent||"primary"}" 
                            variant="${i.variant||"tinted"}"
                            ?emphasis=${i.emphasis}
                            .onClick=${async a=>{i.asyncAction?await i.asyncAction(a):i.onClick&&i.onClick(a)}}>
                        </sutram-async-btn>
                    `)}
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends _{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[v];render(){if(!this.items||this.items.length===0)return r``;const t={};this.items.forEach(n=>{const c=n[this.categoryKey]||"Uncategorized";t[c]||(t[c]=[]),t[c].push(n)});const e=Object.keys(t).sort((n,c)=>{const s=this.categoryOrder||[];let p=s.indexOf(n),h=s.indexOf(c);return p===-1&&(p=999),h===-1&&(h=999),p!==h?p-h:n.localeCompare(c)});return r`
            <div style="display: flex; flex-direction: column;">
                ${e.map(n=>r`
                    <yenvui-category-section titleText=${n}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(n):""}
                        <yenvui-card-group>
                            ${t[n].map(c=>this.renderItem(c))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends _{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const e=++this._lastReqId;O.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:n})=>{e===this._lastReqId&&(this._treeData=n||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:e}=rt(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),r`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${t.join("/")}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${e.length===0?r`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>`:e.map(n=>r`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${()=>this._setPath([...t,n.name])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${n.name}</span>
                    </div>
                `)}
            </div>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends g(U){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends g(N){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramGenericSettingsModal extends ${static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},_jsonBuffers:{type:Object}};static styles=[v,x`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this._jsonBuffers={}}openModal(t,e,n){this.extName=t,this.schema=e||[],this.formData=n||{},this._jsonBuffers={},this.open=!0,this.requestUpdate()}saveSettings(t){const e=t.target,n=e.innerText;e.innerText="Saving...",this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,formData:this.formData,btn:e,origText:n},bubbles:!0,composed:!0}))}render(){if(!this.open)return r``;const e=window.ExtensionRegistry?._manifests?.get(this.extName),n=(e?.name||this.extName)+" Settings",c=e?.settingsActions||[];return r`
            <yenvui-modal  
                ?open=${!0} 
                titleText=${n}  
                ?fullscreen=${!0} 
                ?transparent=${!0}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @yenvui-modal-closed=${()=>this.open=!1}>
                ${c.filter(s=>!s.id.endsWith("_generic_settings")).map(s=>r`
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px;">
                            <label style="font-size: 0.95rem; color: var(--text); font-weight: bold;">${s.icon||""} ${s.label}</label>
                            <span style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Click to open the dedicated configuration panel.</span>
                            <sutram-async-btn label="Open Editor" intent="primary" .onClick=${async p=>{this.open=!1,s.onClick&&await s.onClick(p)}}></sutram-async-btn>
                        </div>
                    `)}

                    ${this.schema.map(s=>{if(s.type==="hidden")return"";const p=this.formData[s.id]!==void 0?this.formData[s.id]:s.default;let h="";if(s.type==="action")h=r`
                                <sutram-async-btn
                                    label=${s.button_label||s.label||"Execute Action"}
                                    intent=${s.intent||"primary"}
                                    .onClick=${async a=>new Promise((l,y)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:s,resolve:l,reject:y,originalEvent:a},bubbles:!0,composed:!0}))})}>
                                </sutram-async-btn>
                            `;else if(s.type==="boolean")h=r`<sutram-toggle .checked=${!!p} @sutram-input-changed=${a=>{this.formData={...this.formData,[s.id]:a.detail.value},this.requestUpdate()}} ?flush=${!0} style="margin-top: 4px;"></sutram-toggle>`;else if(s.type==="select"){const a=(s.options||[]).map(l=>({value:l.value!==void 0?l.value:l,label:l.label||l.title||l.value||l}));h=r`<sutram-select .value=${p} .options=${a} @sutram-input-changed=${l=>{this.formData={...this.formData,[s.id]:l.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-select>`}else if(s.type==="number")h=r`<sutram-input type="number" .value=${p} @sutram-input-changed=${a=>{this.formData={...this.formData,[s.id]:parseFloat(a.detail.value)},this.requestUpdate()}} ?flush=${!0}></sutram-input>`;else if(s.type==="object"||s.type==="json"||typeof p=="object"&&p!==null){const a=this._jsonBuffers[s.id]!==void 0?this._jsonBuffers[s.id]:typeof p=="object"&&p!==null?JSON.stringify(p,null,2):p;h=r`<sutram-textarea .value=${a} .monospace=${!0} .minRows=${4} @sutram-input-changed=${l=>{this._jsonBuffers={...this._jsonBuffers,[s.id]:l.detail.value};try{this.formData={...this.formData,[s.id]:JSON.parse(l.detail.value)}}catch{}this.requestUpdate()}} ?flush=${!0}></sutram-textarea>`}else{const a=s.type==="password"?"password":"text";h=r`<sutram-input type="${a}" .value=${p} @sutram-input-changed=${l=>{this.formData={...this.formData,[s.id]:l.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-input>`}const i=s.title||s.label||s.id;return r`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${s.type==="boolean"?r`<div style="display: flex; align-items: center; gap: 10px;"><label style="font-size: 0.95rem; color: var(--text); font-weight: bold; margin: 0; cursor: pointer;">${i}</label>${h}</div>`:r`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${i}</label>${h}`}
                                ${s.html_desc?r`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;" .innerHTML=${s.html_desc}></div>`:s.description||s.desc?r`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;">${s.description||s.desc}</div>`:""}
                            </div>
                        `})}
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveSettings}>
                    Save Settings
                </button>
            </yenvui-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends ${static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=[v,x`
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
    `];updated(t){if(super.updated(t),t.has("_trayOpen")){const e=this.shadowRoot.querySelector(".action-tray-dialog");e&&(this._trayOpen&&!e.open?e.showModal():!this._trayOpen&&e.open&&e.close())}}connectedCallback(){super.connectedCallback()}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const e=async(i,a)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(i,this.entityData,a);if(i.asyncAction)return await i.asyncAction(this.entityData,a);if(i.onClick)return i.onClick(this.entityData,a)};if(this.variant==="menu-bar"){const i={file:[],edit:[],share:[],tools:[]};t.forEach(d=>{const f=d.group&&i[d.group]?d.group:"tools";i[f].push({...d,label:typeof d.label=="function"?d.label(this.entityData):d.label,icon:typeof d.icon=="function"?d.icon(this.entityData):d.icon||"",asyncAction:d.asyncAction?u=>e(d,u):null,onClick:!d.asyncAction&&d.onClick?u=>e(d,u):null})});const a={file:"File",edit:"Edit",share:"Share",tools:"Tools"},l={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},y=d=>{const f=d.currentTarget;if(!f)return;const u=f.getBoundingClientRect(),m=f.closest(".spatial-col, sutram-app-shell, .editor-header")||document.body,k=m.getBoundingClientRect?m.getBoundingClientRect().right:window.innerWidth,S=Math.min(window.innerWidth,k);u.left+220>S-10?(f.setAttribute("align","right"),f.align="right"):(f.setAttribute("align","left"),f.align="left")};return r`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(i).map(d=>i[d].length===0?"":r`
                            <sutram-dropdown 
                                .items=${i[d]} 
                                align="left"
                                @pointerdown=${y}
                                @click=${y}>
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${l[d]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${a[d]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const n=[],c=[];t.forEach(i=>{(i.order||99)<20?n.push(i):c.push(i)});const s=i=>{if(i.component)return r`<div style="display: contents; order: ${i.order||99};">${i.component(this.entityData)}</div>`;const a=typeof i.label=="function"?i.label(this.entityData):i.label,l=typeof i.icon=="function"?i.icon(this.entityData):i.icon||"",y=typeof i.intent=="function"?i.intent(this.entityData):i.intent||"primary",d=typeof i.isActive=="function"?i.isActive(this.entityData):!!i.isActive;if(i.asyncAction||window.ExtensionRegistry.executeEntityAction&&i.vfsBound)return r`
                    <sutram-async-btn 
                        style="margin: 0; order: ${i.order||99};" 
                        .label=${a}
                        .icon=${l}
                        intent="${y}" 
                        ?active=${d}
                        .onClick=${u=>e(i,u)}>
                    </sutram-async-btn>
                `;const f=u=>{if(u&&u.stopPropagation(),i.emitEvent){const m=i.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(m.name,{detail:m.detail,bubbles:!0,composed:!0}))}else e(i,u)};return r`
                <sutram-btn 
                    intent=${y} 
                    ?active=${d}
                    style="order: ${i.order||99}; gap: 4px;"
                    .label=${a}
                    .icon=${l}
                    @click=${f}>
                </sutram-btn>
            `},p=()=>{const i={file:[],edit:[],share:[],tools:[]};t.forEach(u=>{const m=u.group&&i[u.group]?u.group:"tools";i[m].push(u)});const a={file:"File",edit:"Edit",share:"Share",tools:"Tools"},l={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},y=async(u,m)=>{await e(u,m)},d=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",f=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return r`
                <dialog class="action-tray-dialog" @cancel=${u=>{u.preventDefault(),this._trayOpen=!1}} @click=${u=>{u.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d}</span>
                                ${f?r`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(i).map(u=>i[u].length===0?"":r`
                                    <div class="tray-group-header">
                                        <yv-icon name="${l[u]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${a[u]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${i[u].map(m=>{const k=typeof m.label=="function"?m.label(this.entityData):m.label,S=typeof m.icon=="function"?m.icon(this.entityData):m.icon||"",w=typeof m.intent=="function"?m.intent(this.entityData):m.intent||"primary",C=typeof m.isActive=="function"?m.isActive(this.entityData):!!m.isActive,L=b=>b?typeof b=="object"?b:b.includes("<")?r`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${b}</span>`:/^[a-zA-Z0-9-]+$/.test(b)?r`<yv-icon name="${b}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:r`<span style="margin-right: 6px;">${b}</span>`:"";return m.asyncAction||window.ExtensionRegistry.executeEntityAction&&m.vfsBound?r`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${k}
                                                        .icon=${S}
                                                        intent="${w}" 
                                                        ?active=${C}
                                                        .onClick=${b=>y(m,b)}>
                                                    </sutram-async-btn>
                                                `:r`
                                                <button 
                                                    class="sync-btn ${C?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${w}) 15%, transparent); color: var(--intent-${w}); border: 1px solid color-mix(in srgb, var(--intent-${w}) 40%, transparent);" 
                                                    @click=${b=>y(m,b)}>
                                                    ${L(S)}${k}
                                                </button>
                                            `})}
                                    </div>
                                `)}
                        </div>
                    </div>
                </dialog>
            `},h=r`
            ${t.length>0?r`
                <sutram-btn intent="neutral" style="order: -1; margin-right: 4px;"
                    label="⋮"
                    @click=${i=>{i.stopPropagation(),this._trayOpen=!0}}>
                </sutram-btn>
            `:""}
            ${n.map(s)}
        `;return r`
            ${this.scrollable?r`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${h}
                    </div>
                </sutram-scrub-track>
            `:h}
            ${this._trayOpen?p():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends g(z){static properties={...z.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?E:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,n=>{const c=this._getId();c&&n.selectedItems&&(this.selected=n.selectedItems.has(c))});const t=this._getId(),e=this._getStore();t&&e&&e.getState().selectedItems&&(this.selected=e.getState().selectedItems.has(t))}this.addEventListener("yenvui-overlay-opened",t=>{if(!this.entityType||!this.entityData)return;(window.ExtensionRegistry?.getEntityActions?.(this.entityType,this.entityData)||[]).forEach(n=>{typeof n.onReveal=="function"&&n.onReveal(this.entityData)})}),this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const e=this._getId();if(e&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const n=this._getStore();n&&n.getState().toggleSelection&&n.getState().toggleSelection(e,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:e,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if(super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const e=this._getId(),n=this._getStore();e&&n&&n.getState().selectedItems&&(this.selected=n.getState().selectedItems.has(e))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this._hasActions||(this._hasActions=!0),!this._overlayActive)return;let e=this.querySelector(".sutram-injected-actions");if(e){const n=e.querySelector("sutram-entity-actions");n&&(n.entityType=this.entityType,n.entityData=this.entityData)}else{e=document.createElement("div"),e.className="sutram-injected-actions",e.slot="actions",e.style.display="flex",e.style.flexWrap="nowrap",e.style.gap="8px",e.style.alignItems="center",e.style.width="max-content",e.addEventListener("click",c=>c.stopPropagation());const n=document.createElement("sutram-entity-actions");n.entityType=this.entityType,n.entityData=this.entityData,n.scrollable=!0,e.appendChild(n),this.appendChild(e),this._hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends M{}customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends G{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends Q{}customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends V{}customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends P{}customElements.define("sutram-board",SutramBoard);export class SutramColumn extends Z{}customElements.define("sutram-column",SutramColumn);export class SutramTag extends J{}customElements.define("sutram-tag",SutramTag);export class SutramLabel extends X{}customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends it{}customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends st{}customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends F{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends tt{}customElements.define("sutram-dropdown",SutramDropdown);export class SutramFilterDropdown extends et{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends K{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends q{}customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends W{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends H{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as j}from"./wordcount.js";const Yt=[];export class SutramEditor extends g(I){static properties={...I.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const e=Array.isArray(this.customExtensions)?this.customExtensions.filter(n=>n!==j):[];this.enableWordcount&&e.push(j),this.customExtensions=e}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends ${static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[v,x`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const e=++this._lastSearchReq;O.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:n})=>{e===this._lastSearchReq&&(this._filteredItems=(n||[]).slice(0,50))})}}render(){if(!this.open)return r``;const t=this._filteredItems||[];return r`
            <sutram-modal ?open=${!0} titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <input type="text" placeholder="Search..." .value=${this._searchQuery} @input=${e=>this._searchQuery=e.target.value} style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 10px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${t.length===0?r`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>`:t.map(e=>{const n=typeof e=="string"?e:e.label||e;return r`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:e},bubbles:!0,composed:!0}))}}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${n}
                                </button>
                            `})}
                    </div>
                </div>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends ${static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[v,x`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
        }
        .output-box {
            font-family: var(--font-mono);
            background: var(--input-bg);
            border: 1px solid var(--border);
            padding: 12px;
            border-radius: 4px;
            font-size: 0.85rem;
            color: var(--text);
            white-space: pre-wrap;
            overflow-y: auto;
            flex: 1;
            min-height: 150px;
        }
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,e=this.tabs.find(n=>n.id===t)||this.tabs[0];return e&&e.content||""}return this.content||""}render(){const t=this._getActiveContent(),e=this.tabs&&this.tabs.length>1,n=this.activeTab||this.tabs&&this.tabs[0]?.id||"",c=this.suggestedFilename||`report_${Date.now()}.txt`;return r`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 15px; gap: 10px;">
                ${this.caption?r`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${e?r`
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        ${this.tabs.map(s=>r`
                            <sutram-btn
                                size="sm"
                                .icon=${s.icon||"file-text"}
                                .label=${s.label}
                                intent="${n===s.id?"primary":"neutral"}"
                                ?active=${n===s.id}
                                @click=${()=>{this.activeTab=s.id,this.requestUpdate()}}>
                            </sutram-btn>
                        `)}
                    </div>
                `:""}
                <div class="output-box">${t||"No output."}</div>
                ${this.extraContent?r`<div style="flex-shrink: 0;">${this.extraContent}</div>`:""}
                <div style="padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;">
                    <sutram-entity-actions
                        ?scrollable=${!0}
                        style="justify-content: flex-end;"
                        .entityType=${"text_blob"}
                        .entityData=${{textContent:t,suggestedFilename:c}}>
                    </sutram-entity-actions>
                </div>
            </div>
            ${this.actions&&this.actions.length>0?r`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(s=>{const p=s.style||(s.primary?"flex: 2; margin: 0;":"flex: 1; margin: 0;");return s.asyncAction?r`
                                <sutram-async-btn
                                    .icon=${s.icon}
                                    .label=${s.label}
                                    intent="${s.intent||"primary"}"
                                    style="${p}"
                                    ?disabled=${s.disabled}
                                    .onClick=${s.asyncAction}>
                                </sutram-async-btn>
                            `:r`
                            <sutram-btn
                                .icon=${s.icon}
                                .label=${s.label}
                                intent="${s.intent||"neutral"}"
                                style="${p}"
                                ?disabled=${s.disabled}
                                @click=${s.onClick}>
                            </sutram-btn>
                        `})}
                </div>
            `:""}
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends g(nt){}customElements.define("sutram-diff-viewer",SutramDiffViewer);
