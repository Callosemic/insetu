import{LitElement as T,html as r,css as b}from"lit";import{SutramElement as k,SutramContextMixin as x,SelectionStore as S,ToastStore as z,EnvironmentStore as N}from"./sutram_sdk.js";import{YenvuiBtn as M,YenvuiAsyncBtn as I}from"../../yenvui/js/async-btn.js";import{YenvuiStatusBar as L}from"../../yenvui/js/status-bar.js";import{YenvuiToastContainer as q}from"../../yenvui/js/toast.js";import{YenvuiModal as W}from"../../yenvui/js/modal.js";import{YenvuiWindow as H}from"../../yenvui/js/window.js";import{YenvuiCategorySection as F}from"../../yenvui/js/category-section.js";import{YenvuiCard as O}from"../../yenvui/js/card.js";import{YenvuiCardGroup as K}from"../../yenvui/js/card-group.js";import{YenvuiEditor as R}from"../../yenvui/js/editor.js";import{YenvuiToolbar as _}from"../../yenvui/js/toolbar.js";import{YenvuiCollapsible as G}from"../../yenvui/js/collapsible.js";import{YenvuiPill as Q}from"../../yenvui/js/pill.js";import{YenvuiFilterGroup as V}from"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import{YenvuiSearchBar as P}from"../../yenvui/js/search-bar.js";import{YenvuiSpinner as Z}from"../../yenvui/js/spinner.js";import{YenvuiEmptyState as J}from"../../yenvui/js/empty-state.js";import{YenvuiBoard as X,YenvuiColumn as tt}from"../../yenvui/js/board.js";import{YenvuiTag as et}from"../../yenvui/js/tag.js";import{YenvuiLabel as it}from"../../yenvui/js/label.js";import{YenvuiDropdown as v}from"../../yenvui/js/dropdown.js";import{YenvuiScrubTrack as nt}from"../../yenvui/js/yenvui-base.js";import{sharedStyles as w}from"./shared_styles.js";import{resolveDirectoryState as st,SutramWorker as j}from"./utils.js";import"../../yenvui/js/async-btn.js";import"../../yenvui/js/status-bar.js";import"../../yenvui/js/toast.js";import"../../yenvui/js/modal.js";import"../../yenvui/js/window.js";import"../../yenvui/js/category-section.js";import"../../yenvui/js/card.js";import"../../yenvui/js/card-group.js";import"../../yenvui/js/editor.js";import"../../yenvui/js/toolbar.js";import"../../yenvui/js/collapsible.js";import{YenvuiFilterDropdown as E}from"../../yenvui/js/dropdown.js";import"../../yenvui/js/pill.js";import"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import"../../yenvui/js/search-bar.js";import"../../yenvui/js/spinner.js";import"../../yenvui/js/empty-state.js";import"../../yenvui/js/board.js";import"../../yenvui/js/tag.js";import"../../yenvui/js/label.js";import{YenvuiScrollView as rt}from"../../yenvui/js/scroll-view.js";import"../../yenvui/js/scroll-view.js";import{YenvuiDiffViewer as ot}from"../../yenvui/js/diff-viewer.js";import"../../yenvui/js/diff-viewer.js";import"/static/vendor/lit/lit-virtualizer.min.js";export class SutramVirtualList extends T{static properties={items:{type:Array},renderItem:{type:Object}};static styles=b`
        :host { display: flex; flex-direction: column; width: 100%; flex: 1; min-width: 0; }
        lit-virtualizer { width: 100%; flex: 1; min-width: 0; }
    `;render(){return!this.items||this.items.length===0?r``:r`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramBtn extends M{}customElements.define("sutram-btn",SutramBtn);export class SutramAsyncBtn extends x(I){static properties={...I.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(N,t=>{if(t.isOffline){let i=this,e=null;for(;i;){if(i.dataset&&i.dataset.ext){e=i.dataset.ext;break}i=i.getRootNode().host||i.parentElement}const l=e&&window.ExtensionRegistry?.getExtension(e)?.offline_mode;this._isOfflineReadOnly=l==="read_only"||l==="none"||!l}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends x(L){static properties={...L.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends x(q){connectedCallback(){super.connectedCallback(),this.subscribe(z,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{z.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends k{static properties={selectedItems:{type:Object},modalOpen:{type:Boolean}};static styles=[w,b`
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
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1}connectedCallback(){super.connectedCallback(),this.subscribe(S,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.requestUpdate()}),this.selectedItems=S.getState().selectedItems}render(){const t=this.selectedItems.size,i=Array.from(this.selectedItems.values());let e=0,l=!1;const s=window.ExtensionRegistry;i.forEach(n=>{const o=n.data?.size_bytes||(s?.executeUIHook?s.executeUIHook("sutram:resolve-item-size",n.data):null);o?e+=o:l=!0});let p="";e>0?p=`~${Math.round(e/1024)} kb${l?"+":""}`:l&&(p="Calculated on compile");let h=[];return s&&(typeof s.getAggregatableActions=="function"&&(h=s.getAggregatableActions(i,{group:"share"})),s._manifests&&s._manifests.forEach(n=>{n.batchActions&&n.batchActions.forEach(o=>{!h.some(d=>d.id===o.id)&&o.match(i)&&h.push({...o,onClick:o.onClick?d=>o.onClick(i,d):null,asyncAction:o.asyncAction?d=>o.asyncAction(i,d):null})})})),h.sort((n,o)=>(n.order||99)-(o.order||99)),r`
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
                    ${i.map(n=>{const o=n.data?.titleText||n.data?.filepath?.split("/").pop()||"Unknown Item",d=n.data?.filepath||n.data?.folderpath||n.data?.id||"",y=n.data?.size_bytes||(s?.executeUIHook?s.executeUIHook("sutram:resolve-item-size",n.data):null),c=y?`${Math.round(y/1024)} kb`:"";return r`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${o}</div>${c?r`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${c}</span>`:""}
                                </div>
                                <div class="tray-item-path">${d}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>S.getState().toggleSelection(d,n.entityType,n.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{S.getState().clearSelection(),this.modalOpen=!1}} style="margin-right: auto;"></sutram-async-btn>
                    ${h.map(n=>r`
                        <sutram-async-btn  
                            .label=${n.label}
                            .icon=${n.icon}
                            intent="${n.intent||"primary"}" 
                            variant="${n.variant||"tinted"}"
                            ?emphasis=${n.emphasis}
                            .onClick=${async o=>{n.asyncAction?await n.asyncAction(o):n.onClick&&n.onClick(o)}}>
                        </sutram-async-btn>
                    `)}
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends T{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[w];render(){if(!this.items||this.items.length===0)return r``;const t={};this.items.forEach(e=>{const l=e[this.categoryKey]||"Uncategorized";t[l]||(t[l]=[]),t[l].push(e)});const i=Object.keys(t).sort((e,l)=>{const s=this.categoryOrder||[];let p=s.indexOf(e),h=s.indexOf(l);return p===-1&&(p=999),h===-1&&(h=999),p!==h?p-h:e.localeCompare(l)});return r`
            <div style="display: flex; flex-direction: column;">
                ${i.map(e=>r`
                    <yenvui-category-section titleText=${e}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(e):""}
                        <yenvui-card-group>
                            ${t[e].map(l=>this.renderItem(l))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends T{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const i=++this._lastReqId;j.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:e})=>{i===this._lastReqId&&(this._treeData=e||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:i}=st(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),r`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${t.join("/")}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${i.length===0?r`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>`:i.map(e=>r`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${()=>this._setPath([...t,e.name])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${e.name}</span>
                    </div>
                `)}
            </div>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends x(W){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends x(H){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramGenericSettingsModal extends k{static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},_jsonBuffers:{type:Object}};static styles=[w,b`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this._jsonBuffers={}}openModal(t,i,e){this.extName=t,this.schema=i||[],this.formData=e||{},this._jsonBuffers={},this.open=!0,this.requestUpdate()}saveSettings(t){const i=t.target,e=i.innerText;i.innerText="Saving...",this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,formData:this.formData,btn:i,origText:e},bubbles:!0,composed:!0}))}render(){if(!this.open)return r``;const i=window.ExtensionRegistry?._manifests?.get(this.extName),e=(i?.name||this.extName)+" Settings",l=i?.settingsActions||[];return r`
            <yenvui-modal  
                ?open=${!0} 
                titleText=${e}  
                ?fullscreen=${!0} 
                ?transparent=${!0}
                style="--modal-backdrop: transparent; --modal-backdrop-filter: none;"
                @yenvui-modal-closed=${()=>this.open=!1}>
                ${l.filter(s=>!s.id.endsWith("_generic_settings")).map(s=>r`
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
                                    .onClick=${async o=>new Promise((d,y)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:s,resolve:d,reject:y,originalEvent:o},bubbles:!0,composed:!0}))})}>
                                </sutram-async-btn>
                            `;else if(s.type==="boolean")h=r`<sutram-toggle .checked=${!!p} @sutram-input-changed=${o=>{this.formData={...this.formData,[s.id]:o.detail.value},this.requestUpdate()}} ?flush=${!0} style="margin-top: 4px;"></sutram-toggle>`;else if(s.type==="select"){const o=(s.options||[]).map(d=>({value:d.value!==void 0?d.value:d,label:d.label||d.title||d.value||d}));h=r`<sutram-select .value=${p} .options=${o} @sutram-input-changed=${d=>{this.formData={...this.formData,[s.id]:d.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-select>`}else if(s.type==="number")h=r`<sutram-input type="number" .value=${p} @sutram-input-changed=${o=>{this.formData={...this.formData,[s.id]:parseFloat(o.detail.value)},this.requestUpdate()}} ?flush=${!0}></sutram-input>`;else if(s.type==="object"||s.type==="json"||typeof p=="object"&&p!==null){const o=this._jsonBuffers[s.id]!==void 0?this._jsonBuffers[s.id]:typeof p=="object"&&p!==null?JSON.stringify(p,null,2):p;h=r`<sutram-textarea .value=${o} .monospace=${!0} .minRows=${4} @sutram-input-changed=${d=>{this._jsonBuffers={...this._jsonBuffers,[s.id]:d.detail.value};try{this.formData={...this.formData,[s.id]:JSON.parse(d.detail.value)}}catch{}this.requestUpdate()}} ?flush=${!0}></sutram-textarea>`}else{const o=s.type==="password"?"password":"text";h=r`<sutram-input type="${o}" .value=${p} @sutram-input-changed=${d=>{this.formData={...this.formData,[s.id]:d.detail.value},this.requestUpdate()}} ?flush=${!0}></sutram-input>`}const n=s.title||s.label||s.id;return r`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${s.type==="boolean"?r`<div style="display: flex; align-items: center; gap: 10px;"><label style="font-size: 0.95rem; color: var(--text); font-weight: bold; margin: 0; cursor: pointer;">${n}</label>${h}</div>`:r`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${n}</label>${h}`}
                                ${s.html_desc?r`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;" .innerHTML=${s.html_desc}></div>`:s.description||s.desc?r`<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: -2px;">${s.description||s.desc}</div>`:""}
                            </div>
                        `})}
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveSettings}>
                    Save Settings
                </button>
            </yenvui-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends k{static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=[w,b`
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
    `];updated(t){if(super.updated(t),t.has("_trayOpen")){const i=this.shadowRoot.querySelector(".action-tray-dialog");i&&(this._trayOpen&&!i.open?i.showModal():!this._trayOpen&&i.open&&i.close())}}connectedCallback(){super.connectedCallback()}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const i=async(n,o)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(n,this.entityData,o);if(n.asyncAction)return await n.asyncAction(this.entityData,o);if(n.onClick)return n.onClick(this.entityData,o)};if(this.variant==="menu-bar"){const n={file:[],edit:[],share:[],tools:[]};t.forEach(c=>{const f=c.group&&n[c.group]?c.group:"tools";n[f].push({...c,label:typeof c.label=="function"?c.label(this.entityData):c.label,icon:typeof c.icon=="function"?c.icon(this.entityData):c.icon||"",asyncAction:c.asyncAction?u=>i(c,u):null,onClick:!c.asyncAction&&c.onClick?u=>i(c,u):null})});const o={file:"File",edit:"Edit",share:"Share",tools:"Tools"},d={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},y=c=>{const f=c.currentTarget;if(!f)return;const u=f.getBoundingClientRect(),m=f.closest(".spatial-col, sutram-app-shell, .editor-header")||document.body,A=m.getBoundingClientRect?m.getBoundingClientRect().right:window.innerWidth,C=Math.min(window.innerWidth,A);u.left+220>C-10?(f.setAttribute("align","right"),f.align="right"):(f.setAttribute("align","left"),f.align="left")};return r`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(n).map(c=>n[c].length===0?"":r`
                            <sutram-dropdown 
                                .items=${n[c]} 
                                align="left"
                                @pointerdown=${y}
                                @click=${y}>
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${d[c]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${o[c]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const e=[],l=[];t.forEach(n=>{(n.order||99)<20?e.push(n):l.push(n)});const s=n=>{if(n.component)return r`<div style="display: contents; order: ${n.order||99};">${n.component(this.entityData)}</div>`;const o=typeof n.label=="function"?n.label(this.entityData):n.label,d=typeof n.icon=="function"?n.icon(this.entityData):n.icon||"",y=typeof n.intent=="function"?n.intent(this.entityData):n.intent||"primary",c=typeof n.isActive=="function"?n.isActive(this.entityData):!!n.isActive;if(n.asyncAction||window.ExtensionRegistry.executeEntityAction&&n.vfsBound)return r`
                    <sutram-async-btn 
                        style="margin: 0; order: ${n.order||99};" 
                        .label=${o}
                        .icon=${d}
                        intent="${y}" 
                        ?active=${c}
                        .onClick=${u=>i(n,u)}>
                    </sutram-async-btn>
                `;const f=u=>{if(u&&u.stopPropagation(),n.emitEvent){const m=n.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(m.name,{detail:m.detail,bubbles:!0,composed:!0}))}else i(n,u)};return r`
                <sutram-btn 
                    intent=${y} 
                    ?active=${c}
                    style="order: ${n.order||99}; gap: 4px;"
                    .label=${o}
                    .icon=${d}
                    @click=${f}>
                </sutram-btn>
            `},p=()=>{const n={file:[],edit:[],share:[],tools:[]};t.forEach(u=>{const m=u.group&&n[u.group]?u.group:"tools";n[m].push(u)});const o={file:"File",edit:"Edit",share:"Share",tools:"Tools"},d={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},y=async(u,m)=>{await i(u,m)},c=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",f=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return r`
                <dialog class="action-tray-dialog" @cancel=${u=>{u.preventDefault(),this._trayOpen=!1}} @click=${u=>{u.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c}</span>
                                ${f?r`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(n).map(u=>n[u].length===0?"":r`
                                    <div class="tray-group-header">
                                        <yv-icon name="${d[u]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${o[u]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${n[u].map(m=>{const A=typeof m.label=="function"?m.label(this.entityData):m.label,C=typeof m.icon=="function"?m.icon(this.entityData):m.icon||"",$=typeof m.intent=="function"?m.intent(this.entityData):m.intent||"primary",D=typeof m.isActive=="function"?m.isActive(this.entityData):!!m.isActive,Y=g=>g?typeof g=="object"?g:g.includes("<")?r`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${g}</span>`:/^[a-zA-Z0-9-]+$/.test(g)?r`<yv-icon name="${g}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:r`<span style="margin-right: 6px;">${g}</span>`:"";return m.asyncAction||window.ExtensionRegistry.executeEntityAction&&m.vfsBound?r`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${A}
                                                        .icon=${C}
                                                        intent="${$}" 
                                                        ?active=${D}
                                                        .onClick=${g=>y(m,g)}>
                                                    </sutram-async-btn>
                                                `:r`
                                                <button 
                                                    class="sync-btn ${D?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${$}) 15%, transparent); color: var(--intent-${$}); border: 1px solid color-mix(in srgb, var(--intent-${$}) 40%, transparent);" 
                                                    @click=${g=>y(m,g)}>
                                                    ${Y(C)}${A}
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
                    @click=${n=>{n.stopPropagation(),this._trayOpen=!0}}>
                </sutram-btn>
            `:""}
            ${e.map(s)}
        `;return r`
            ${this.scrollable?r`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${h}
                    </div>
                </sutram-scrub-track>
            `:h}
            ${this._trayOpen?p():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends x(O){static properties={...O.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?S:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,e=>{const l=this._getId();l&&e.selectedItems&&(this.selected=e.selectedItems.has(l))});const t=this._getId(),i=this._getStore();t&&i&&i.getState().selectedItems&&(this.selected=i.getState().selectedItems.has(t))}this.addEventListener("yenvui-overlay-opened",t=>{if(!this.entityType||!this.entityData)return;(window.ExtensionRegistry?.getEntityActions?.(this.entityType,this.entityData)||[]).forEach(e=>{typeof e.onReveal=="function"&&e.onReveal(this.entityData)})}),this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const i=this._getId();if(i&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const e=this._getStore();e&&e.getState().toggleSelection&&e.getState().toggleSelection(i,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:i,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if(super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const i=this._getId(),e=this._getStore();i&&e&&e.getState().selectedItems&&(this.selected=e.getState().selectedItems.has(i))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this._hasActions||(this._hasActions=!0),!this._overlayActive)return;let i=this.querySelector(".sutram-injected-actions");if(i){const e=i.querySelector("sutram-entity-actions");e&&(e.entityType=this.entityType,e.entityData=this.entityData)}else{i=document.createElement("div"),i.className="sutram-injected-actions",i.slot="actions",i.style.display="flex",i.style.flexWrap="nowrap",i.style.gap="8px",i.style.alignItems="center",i.style.width="max-content",i.addEventListener("click",l=>l.stopPropagation());const e=document.createElement("sutram-entity-actions");e.entityType=this.entityType,e.entityData=this.entityData,e.scrollable=!0,i.appendChild(e),this.appendChild(i),this._hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends K{}customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends P{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends Z{}customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends J{}customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends X{}customElements.define("sutram-board",SutramBoard);export class SutramColumn extends tt{}customElements.define("sutram-column",SutramColumn);export class SutramTag extends et{}customElements.define("sutram-tag",SutramTag);export class SutramLabel extends it{}customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends nt{}customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends rt{}customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends _{static styles=[...Array.isArray(_.styles)?_.styles:_.styles?[_.styles]:[],b`
            :host {
                position: relative;
                z-index: 25;
            }
            yenvui-dropdown, sutram-dropdown, yenvui-filter-dropdown, sutram-filter-dropdown, [class*="dropdown"] {
                position: relative !important;
                z-index: 50 !important;
            }
            .yv-dropdown-menu,
            .dropdown-menu,
            .menu,
            .dropdown-content,
            [class*="dropdown-menu"],
            [class*="menu-panel"],
            [class*="dropdown-content"],
            [part="menu"] {
                left: auto !important;
                right: 0 !important;
                z-index: 9999 !important;
            }
        `];connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))}),this._toolbarAlignHandler=()=>{this.shadowRoot?.querySelectorAll('yenvui-dropdown, sutram-dropdown, yenvui-filter-dropdown, sutram-filter-dropdown, [class*="dropdown"]')?.forEach(e=>{if(e.setAttribute("align","right"),e.setAttribute("data-fixed-align","true"),e.align="right",e.shadowRoot){if(!e.shadowRoot.querySelector("#sutram-force-right-style")){const s=document.createElement("style");s.id="sutram-force-right-style",s.textContent=`
                            :host, :host([align]) { position: relative !important; }
                            .yv-dropdown-menu, .dropdown-menu, .menu, .dropdown-content, [class*="menu"], [class*="dropdown"], [part="menu"] {
                                left: auto !important;
                                right: 0 !important;
                                z-index: 9999 !important;
                            }
                        `,e.shadowRoot.appendChild(s)}const l=e.shadowRoot.querySelector('.dropdown-menu, .menu, .yv-dropdown-menu, .dropdown-content, [class*="menu"], [class*="dropdown"], [part="menu"]');l&&(l.style.left="auto",l.style.right="0px",l.style.zIndex="9999")}}),this.shadowRoot?.querySelectorAll('.dropdown-menu, .menu, .yv-dropdown-menu, .dropdown-content, [class*="menu"], [class*="dropdown"], [part="menu"]')?.forEach(e=>{e.style.left="auto",e.style.right="0px",e.style.zIndex="9999"})},this.shadowRoot?.addEventListener("pointerdown",this._toolbarAlignHandler,{capture:!0}),this.shadowRoot?.addEventListener("click",this._toolbarAlignHandler,{capture:!0})}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._toolbarAlignHandler&&this._toolbarAlignHandler()}}customElements.define("sutram-toolbar",SutramToolbar);const B=a=>{if(!a||a._sutramEnhanced)return;a._sutramEnhanced=!0;const t=a.prototype.connectedCallback;a.prototype.connectedCallback=function(){t&&t.call(this),this._autoAlignListener=()=>{let e=this,l=window.innerWidth,s=!1;for(;e;){if(e.classList&&(e.classList.contains("spatial-col")||e.classList.contains("col-header")||e.classList.contains("editor-header")||e.classList.contains("toolbar-row"))){l=e.getBoundingClientRect().right;break}if(e.tagName&&["SUTRAM-TOOLBAR","YENVUI-TOOLBAR","INSETU-FILE-TREE","SUTRAM-APP-SHELL","SUTRAM-WINDOW"].includes(e.tagName.toUpperCase())){l=e.getBoundingClientRect().right,e.tagName.toUpperCase().includes("TOOLBAR")&&(s=!0);break}e=e.parentElement||(e.getRootNode?e.getRootNode()?.host:null)}const p=this.getBoundingClientRect(),h=Math.min(window.innerWidth,l),n=this.shadowRoot?.querySelector('.dropdown-menu, .menu, .yv-dropdown-menu, .dropdown-content, [class*="menu"], [class*="dropdown"], [part="menu"]'),o=n?.offsetWidth||220;if(s||this.hasAttribute("data-fixed-align")||p.left+o>h-10){if(this.setAttribute("align","right"),this.align="right",n&&(n.style.left="auto",n.style.right="0px",n.style.zIndex="9999"),this.shadowRoot&&!this.shadowRoot.querySelector("#sutram-right-align-style")){const d=document.createElement("style");d.id="sutram-right-align-style",d.textContent=`
                        :host([align="right"]) .yv-dropdown-menu,
                        :host([align="right"]) .dropdown-menu,
                        :host([align="right"]) .menu,
                        :host([align="right"]) .dropdown-content,
                        :host([align="right"]) [class*="menu"],
                        :host([align="right"]) [class*="dropdown"],
                        :host([align="right"]) [part="menu"] {
                            left: auto !important;
                            right: 0 !important;
                            z-index: 9999 !important;
                        }
                    `,this.shadowRoot.appendChild(d)}}else this.hasAttribute("data-fixed-align")||(this.setAttribute("align","left"),this.align="left",n&&(n.style.left="0px",n.style.right="auto",n.style.zIndex="9999"))},this.addEventListener("pointerdown",this._autoAlignListener,{capture:!0}),this.addEventListener("click",this._autoAlignListener,{capture:!0}),this.addEventListener("focusin",this._autoAlignListener,{capture:!0})};const i=a.prototype.disconnectedCallback;a.prototype.disconnectedCallback=function(){i&&i.call(this),this._autoAlignListener&&(this.removeEventListener("pointerdown",this._autoAlignListener,{capture:!0}),this.removeEventListener("click",this._autoAlignListener,{capture:!0}),this.removeEventListener("focusin",this._autoAlignListener,{capture:!0}))}};B(v),B(E);export class SutramDropdown extends v{static styles=[...Array.isArray(v.styles)?v.styles:v.styles?[v.styles]:[],b`
            :host {
                position: relative !important;
                z-index: 50 !important;
            }
            :host(:focus-within), :host([open]), :host([active]) {
                z-index: 1000 !important;
            }
            :host([align="right"]) .yv-dropdown-menu,
            :host([align="right"]) .dropdown-menu,
            :host([align="right"]) .menu,
            :host([align="right"]) .dropdown-content,
            :host([align="right"]) [class*="menu"],
            :host([align="right"]) [class*="dropdown"],
            :host([align="right"]) [part="menu"] {
                left: auto !important;
                right: 0 !important;
                z-index: 9999 !important;
            }
            :host([align="left"]) .yv-dropdown-menu,
            :host([align="left"]) .dropdown-menu,
            :host([align="left"]) .menu,
            :host([align="left"]) .dropdown-content,
            :host([align="left"]) [class*="menu"],
            :host([align="left"]) [class*="dropdown"],
            :host([align="left"]) [part="menu"] {
                left: 0 !important;
                right: auto !important;
                z-index: 9999 !important;
            }
        `]}customElements.define("sutram-dropdown",SutramDropdown);export class SutramFilterDropdown extends E{static styles=[...Array.isArray(E.styles)?E.styles:E.styles?[E.styles]:[],b`
            :host {
                position: relative !important;
                z-index: 50 !important;
            }
            :host(:focus-within), :host([open]), :host([active]) {
                z-index: 1000 !important;
            }
            .yv-dropdown-menu,
            .dropdown-menu,
            .menu,
            .dropdown-content,
            [class*="dropdown-menu"],
            [class*="menu-panel"],
            [class*="dropdown-content"],
            [part="menu"] {
                left: auto !important;
                right: 0 !important;
                z-index: 9999 !important;
            }
        `]}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends G{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends F{}customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends Q{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends V{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as U}from"./wordcount.js";const le=[];export class SutramEditor extends x(R){static properties={...R.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const i=Array.isArray(this.customExtensions)?this.customExtensions.filter(e=>e!==U):[];this.enableWordcount&&i.push(U),this.customExtensions=i}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends k{static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[w,b`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const i=++this._lastSearchReq;j.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:e})=>{i===this._lastSearchReq&&(this._filteredItems=(e||[]).slice(0,50))})}}render(){if(!this.open)return r``;const t=this._filteredItems||[];return r`
            <sutram-modal ?open=${!0} titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <input type="text" placeholder="Search..." .value=${this._searchQuery} @input=${i=>this._searchQuery=i.target.value} style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 10px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${t.length===0?r`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>`:t.map(i=>{const e=typeof i=="string"?i:i.label||i;return r`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:i},bubbles:!0,composed:!0}))}}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${e}
                                </button>
                            `})}
                    </div>
                </div>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends k{static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[w,b`
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
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,i=this.tabs.find(e=>e.id===t)||this.tabs[0];return i&&i.content||""}return this.content||""}render(){const t=this._getActiveContent(),i=this.tabs&&this.tabs.length>1,e=this.activeTab||this.tabs&&this.tabs[0]?.id||"",l=this.suggestedFilename||`report_${Date.now()}.txt`;return r`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 15px; gap: 10px;">
                ${this.caption?r`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${i?r`
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        ${this.tabs.map(s=>r`
                            <sutram-btn
                                size="sm"
                                .icon=${s.icon||"file-text"}
                                .label=${s.label}
                                intent="${e===s.id?"primary":"neutral"}"
                                ?active=${e===s.id}
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
                        .entityData=${{textContent:t,suggestedFilename:l}}>
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
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends x(ot){}customElements.define("sutram-diff-viewer",SutramDiffViewer);
