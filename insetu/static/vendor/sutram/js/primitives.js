import{LitElement as T,html as n,css as v}from"lit";import{SutramElement as $,SutramContextMixin as E,SelectionStore as S,ToastStore as j,EnvironmentStore as z}from"./sutram_sdk.js";import*as I from"sutram-chassis";import{sharedStyles as w}from"./shared_styles.js";import{resolveDirectoryState as L,SutramWorker as R}from"./utils.js";import"./inputs.js";import"lit-virtualizer";export const REQUIRED_CHASSIS_PRIMITIVES=["Btn","AsyncBtn","Card","CardGroup","CategorySection","Modal","Window","Tabs","Toolbar","SearchBar","Dropdown","FilterDropdown","Collapsible","Pill","FilterGroup","Tag","Label","Spinner","EmptyState","Board","Column","ScrubTrack","ScrollView","DiffViewer","Editor","Input","Select","Textarea","Toggle"];export function validateChassisContract(d){if(!d||typeof d!="object")throw new Error("[Sutram Boot Error] Invalid or missing chassis provider object.");const t=REQUIRED_CHASSIS_PRIMITIVES.filter(i=>typeof d[i]!="function");if(t.length>0)throw new Error(`[Sutram Boot Error] Chassis '${d.CHASSIS_PROVIDER_META?.name||"Custom"}' fails contract. Missing primitives: ${t.join(", ")}`);return!0}export class SutramUIAdapter{static PASSTHROUGH_MAP=Object.freeze({"sutram-btn":"Btn","sutram-card-group":"CardGroup","sutram-category-section":"CategorySection","sutram-spinner":"Spinner","sutram-empty-state":"EmptyState","sutram-board":"Board","sutram-column":"Column","sutram-tag":"Tag","sutram-label":"Label","sutram-scrub-track":"ScrubTrack","sutram-scroll-view":"ScrollView","sutram-filter-dropdown":"FilterDropdown","sutram-tabs":"Tabs","sutram-input":"Input","sutram-select":"Select","sutram-textarea":"Textarea","sutram-toggle":"Toggle","sutram-drop-overlay":"DropOverlay","sutram-drop-target":"DropTarget"});static registerChassis(t){validateChassisContract(t),Object.entries(this.PASSTHROUGH_MAP).forEach(([i,s])=>{const a=t[s];typeof a=="function"&&!customElements.get(i)&&customElements.define(i,class extends a{})})}}SutramUIAdapter.registerChassis(I);const{Btn:U,AsyncBtn:O,StatusBar:B,ToastContainer:F,Modal:Y,Window:P,CategorySection:q,Card:N,CardGroup:G,Editor:A,Toolbar:H,Collapsible:W,Pill:V,FilterGroup:J,SelectionTray:yt,SearchBar:Q,Spinner:K,EmptyState:Z,Board:X,Column:tt,Tag:et,Label:it,Dropdown:st,FilterDropdown:nt,ScrubTrack:rt,ScrollView:at,DiffViewer:ot,Tabs:lt}=I;A&&(A.languageResolver=async d=>window.ExtensionRegistry&&typeof window.ExtensionRegistry.executeUIHook=="function"?await window.ExtensionRegistry.executeUIHook("sutram:vendorize-language",d):window.Sutram&&typeof window.Sutram.vendorizeLanguage=="function"?await window.Sutram.vendorizeLanguage(d):null);export class SutramVirtualList extends T{static properties={items:{type:Array},renderItem:{type:Object},keyFunction:{type:Object}};static styles=v`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            flex: 1;
            min-width: 0;
            overflow-x: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        lit-virtualizer {
            width: 100%;
            flex: 1;
            min-width: 0;
            overflow-x: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        lit-virtualizer sutram-card,
        lit-virtualizer yenvui-card {
            content-visibility: visible !important;
            contain-intrinsic-size: none !important;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
    `;constructor(){super(),this.items=[],this.renderItem=null,this.keyFunction=(t,i)=>{if(!t)return i;if(typeof t=="string")return t;const s=t.type||t.entityType||"item",a=t.canonicalUri||t.fullPath||t.filepath||t.id||t.name||i;return`${s}::${a}`}}connectedCallback(){super.connectedCallback(),this.setAttribute("data-virtual-list","")}render(){return!this.items||this.items.length===0?n``:n`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .keyFunction=${this.keyFunction}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramBtn extends U{}customElements.get("sutram-btn")||customElements.define("sutram-btn",SutramBtn);export class SutramProjectionWindowControls extends ${static properties={filepath:{type:String},projectionId:{type:String},beforeAction:{attribute:!1}};static styles=[w,v`:host { display: inline-flex; align-items: center; }`];_getTargetId(){return this.projectionId||this.filepath||""}render(){const t=this._getTargetId();if(!t)return n``;const i=typeof window<"u"&&new URLSearchParams(window.location.search).get("popout")==="true",s=window.Sutram?.stores?.Layout?.getState?.();return i?n`
                <sutram-btn
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
                    style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem; margin: 0;"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),s&&typeof s.dockInProjection=="function"&&await s.dockInProjection(t)}}>
                </sutram-btn>
            `:(s&&typeof s.canPopout=="function"?s.canPopout():!0)?n`
                <sutram-btn
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem; margin: 0;"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),s&&typeof s.popoutProjection=="function"&&await s.popoutProjection(t)}}>
                </sutram-btn>
            `:n``}}customElements.get("sutram-projection-window-controls")||customElements.define("sutram-projection-window-controls",SutramProjectionWindowControls);export class SutramAsyncBtn extends E(O){static properties={...O.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(z,t=>{if(t.isOffline){let i=this,s=null;for(;i;){if(i.dataset&&i.dataset.ext){s=i.dataset.ext;break}i=i.getRootNode().host||i.parentElement}const a=s&&window.ExtensionRegistry?.getExtension(s)?.offline_mode;this._isOfflineReadOnly=a==="read_only"||a==="none"||!a}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.jobRoute&&typeof window.ExtensionRegistry?.executeJobAction=="function"){this.status="loading";try{const i=typeof this.jobPayload=="function"?await this.jobPayload(t):this.jobPayload||{};await window.ExtensionRegistry.executeJobAction(this.jobRoute,i,{onProgress:(a,r)=>{this.onJobProgress&&this.onJobProgress(a,r)},onComplete:a=>{this.status="success",this.onJobComplete&&this.onJobComplete(a),setTimeout(()=>{this.status="idle"},2e3)},onError:a=>{this.status="error",this.onJobError&&this.onJobError(a),setTimeout(()=>{this.status="idle"},2e3)}})(t);return}catch(i){if(this.status="error",typeof this.onJobError=="function")try{this.onJobError(i)}catch{}console.error("[SutramAsyncBtn] Job dispatch error:",i),setTimeout(()=>{this.status="idle"},2e3);return}}return super._handleClick(t)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends E(B){static properties={...B.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends E(F){connectedCallback(){super.connectedCallback(),this.subscribe(j,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{j.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends ${static properties={selectedItems:{type:Object},modalOpen:{type:Boolean},trayTitle:{type:String},itemBadge:{type:String}};static styles=[w,v`
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
            color: var(--bg-deep, #000000);
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
            display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--bg-deep); border-radius: 0 0 12px 12px; width: 100%; box-sizing: border-box; overflow: hidden;
        }
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1,this.trayTitle="Selection Tray",this.itemBadge="ITEM"}connectedCallback(){super.connectedCallback(),this.subscribe(S,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.requestUpdate()}),this.selectedItems=S.getState().selectedItems}render(){const t=this.selectedItems.size,i=Array.from(this.selectedItems.values());let s=0,a=!1;const r=window.ExtensionRegistry;i.forEach(l=>{const e=l.data?.size_bytes||(r?.executeUIHook?r.executeUIHook("sutram:resolve-item-size",l.data):null);e?s+=e:a=!0});let o="";s>0?o=`~${Math.round(s/1024)} kb${a?"+":""}`:a&&(o="Calculated on compile");let y=[];return r&&(typeof r.getAggregatableActions=="function"&&(y=r.getAggregatableActions(i,{group:"share"})),r._manifests&&r._manifests.forEach(l=>{l.batchActions&&l.batchActions.forEach(e=>{!y.some(h=>h.id===e.id)&&e.match(i)&&y.push({...e,onClick:e.onClick?h=>e.onClick(i,h):null,asyncAction:e.asyncAction?h=>e.asyncAction(i,h):null})})})),y.sort((l,e)=>(l.order||99)-(e.order||99)),n`
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
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">${this.trayTitle||"Selection Tray"} <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${o?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${o}</span>`:""}
                    </div>
                    <button class="sync-btn" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${i.map(l=>{const e=l.data?.filepath||l.data?.folderpath||l.data?.id||"",h=String(e).replace(/\/+$/,""),f=l.data?.titleText||h.split("/").pop()||"Unknown Item",g=l.key||e,u=l.data?.size_bytes||(r?.executeUIHook?r.executeUIHook("sutram:resolve-item-size",l.data):null),m=u?`${Math.round(u/1024)} kb`:"";return n`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">${this.itemBadge||"ITEM"}</span> ${f}</div>${m?n`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${m}</span>`:""}
                                </div>
                                <div class="tray-item-path">${e}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>S.getState().toggleSelection(g,l.entityType,l.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{S.getState().clearSelection(),this.modalOpen=!1}} style="flex-shrink: 0; margin: 0;"></sutram-async-btn>
                    <sutram-scrub-track style="flex: 1; min-width: 0;">
                        <div style="display: flex; gap: 8px; align-items: center; width: max-content; margin-left: auto;">
                            ${y.map(l=>n`
                                <sutram-async-btn  
                                    style="margin: 0; flex-shrink: 0;"
                                    .label=${l.label}
                                    .icon=${l.icon}
                                    intent="${l.intent||"primary"}" 
                                    variant="${l.variant||"tinted"}"
                                    ?emphasis=${l.emphasis}
                                    .onClick=${async e=>{l.asyncAction?await l.asyncAction(e):l.onClick&&l.onClick(e)}}>
                                </sutram-async-btn>
                            `)}
                        </div>
                    </sutram-scrub-track>
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends T{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[w];render(){if(!this.items||this.items.length===0)return n``;const t={};this.items.forEach(s=>{const a=s[this.categoryKey]||"Uncategorized";t[a]||(t[a]=[]),t[a].push(s)});const i=Object.keys(t).sort((s,a)=>{const r=this.categoryOrder||[];let o=r.indexOf(s),y=r.indexOf(a);return o===-1&&(o=999),y===-1&&(y=999),o!==y?o-y:s.localeCompare(a)});return n`
            <div style="display: flex; flex-direction: column;">
                ${i.map(s=>n`
                    <sutram-category-section titleText=${s}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(s):""}
                        <sutram-card-group>
                            ${t[s].map(a=>this.renderItem(a))}
                        </sutram-card-group>
                    </sutram-category-section>
                `)}
            </div>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends T{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const i=++this._lastReqId;R.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:s})=>{i===this._lastReqId&&(this._treeData=s||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:i}=L(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),n`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                <sutram-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${t.join("/")}
                </sutram-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${i.length===0?n`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>`:i.map(s=>n`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${()=>this._setPath([...t,s.name])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${s.name}</span>
                    </div>
                `)}
            </div>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends E(Y){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends E(P){connectedCallback(){super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramFieldCard extends ${static properties={label:{type:String},description:{type:String},scope:{type:String},secure:{type:Boolean}};static styles=[w,v`
        :host {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-sizing: border-box;
        }
        .field-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .field-title {
            font-size: 0.9rem;
            color: var(--text);
            font-weight: bold;
            margin: 0;
        }
        .field-desc {
            font-size: 0.78rem;
            color: var(--text-muted);
            line-height: 1.4;
        }
    `];constructor(){super(),this.label="",this.description="",this.scope="workspace",this.secure=!1}_renderBadges(){const t=[];this.secure&&t.push(n`<sutram-tag text="secure" intent="warning"></sutram-tag>`);const i=this.scope||"workspace";return i==="daemon"?t.push(n`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`):i==="repo"?t.push(n`<sutram-tag text="repo" intent="highlight"></sutram-tag>`):i!=="none"&&t.push(n`<sutram-tag text="workspace" intent="primary"></sutram-tag>`),n`<div style="display: inline-flex; gap: 6px; align-items: center;"><slot name="header-actions"></slot>${t}</div>`}render(){return n`
            <div class="field-header">
                <span class="field-title">${this.label}</span>${this._renderBadges()}
            </div>
            <slot></slot>
            ${this.description?n`<div class="field-desc">${this.description}</div>`:""}
        `}}customElements.get("sutram-field-card")||customElements.define("sutram-field-card",SutramFieldCard);export class SutramSettingsForm extends ${static properties={extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String},filterQuery:{type:String},hideSaveButton:{type:Boolean},_jsonBuffers:{type:Object}};static styles=[w,v`
        :host { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
        .field-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .field-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .intent-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
            margin-top: 4px;
        }
        .intent-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            background: var(--bg);
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
        }
    `];constructor(){super(),this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo="",this.filterQuery="",this.hideSaveButton=!1,this._jsonBuffers={}}willUpdate(t){(t.has("extName")||t.has("selectedRepo"))&&(this._jsonBuffers={})}_emitFormMutation(t){this.formData=t,this.dispatchEvent(new CustomEvent("sutram-settings-form-changed",{detail:{extName:this.extName,formData:this.formData,repo:this.selectedRepo},bubbles:!0,composed:!0})),this.requestUpdate()}async triggerSave(t){const s=(this.schema||[]).some(r=>r&&r.type!=="hidden"&&r.scope==="repo")&&(this.selectedRepo||this.repos&&this.repos[0])||"",a={...this.formData||{}};return(this.schema||[]).forEach(r=>{if(!r||r.type==="hidden"||r.type==="action")return;const o=a[r.id];r.type==="number"?a[r.id]=o===""||o===null||o===void 0||Number.isNaN(Number(o))?r.default??0:Number(o):r.type==="string_list"?typeof o=="string"?a[r.id]=o.split(",").map(y=>y.trim()).filter(Boolean):Array.isArray(o)||(a[r.id]=Array.isArray(r.default)?r.default:[]):r.type==="intent_map"&&(!o||typeof o!="object"||Array.isArray(o))&&(a[r.id]=r.default&&typeof r.default=="object"?r.default:{})}),this.formData=a,new Promise((r,o)=>{this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,schema:this.schema,formData:a,repo:s,resolve:r,reject:o,originalEvent:t},bubbles:!0,composed:!0}))})}_renderScopeBadge(t){const i=[];t.secure&&i.push(n`<sutram-tag text="secure" intent="warning"></sutram-tag>`);const s=t.scope||"workspace";return s==="daemon"?i.push(n`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`):s==="repo"?i.push(n`<sutram-tag text="repo" intent="highlight"></sutram-tag>`):i.push(n`<sutram-tag text="workspace" intent="primary"></sutram-tag>`),n`<div style="display: inline-flex; gap: 6px; align-items: center;">${i}</div>`}render(){const i=window.ExtensionRegistry?._manifests?.get(this.extName),s=(i?.settingsActions||[]).filter(e=>!e.id.endsWith("_generic_settings")),a=(this.filterQuery||"").trim().toLowerCase(),r=(this.schema||[]).filter(e=>!e||e.type==="hidden"?!1:a?[e.label,e.title,e.id,e.description,e.desc].filter(Boolean).join(" ").toLowerCase().includes(a):!0),o=(this.schema||[]).some(e=>e&&e.type!=="hidden"&&e.scope==="repo"),y=this.selectedRepo||this.repos&&this.repos[0]||"",l=o&&(!this.repos||this.repos.length===0);return n`
            ${o?n`
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: color-mix(in srgb, var(--intent-highlight) 10%, var(--input-bg)); border: 1px solid color-mix(in srgb, var(--intent-highlight) 35%, var(--border)); border-radius: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: bold; color: var(--text);">
                        <yv-icon name="package" style="width: 16px; height: 16px; color: var(--intent-highlight);"></yv-icon>
                        <span>Target Repository Scope</span>
                    </div>
                    ${l?n`
                        <span style="font-size: 0.8rem; color: var(--intent-warning); font-style: italic;">
                            Add a repository in Workspace Manager to configure repository-scoped settings.
                        </span>
                    `:n`
                        <sutram-select
                            .value=${y}
                            .options=${(this.repos||[]).map(e=>({value:e,label:e}))}
                            ?flush=${!0}
                            style="min-width: 200px; margin: 0;"
                            @sutram-input-changed=${e=>{this.selectedRepo=e.detail.value,this.dispatchEvent(new CustomEvent("sutram-settings-repo-changed",{detail:{extName:this.extName,repo:e.detail.value},bubbles:!0,composed:!0}))}}>
                        </sutram-select>
                    `}
                </div>
            `:""}

            ${a?"":s.map(e=>n`
                <div class="field-card">
                    <div class="field-header">
                        <span style="font-size: 0.95rem; color: var(--text); font-weight: bold; display: flex; align-items: center; gap: 8px;">
                            ${e.icon?/^[a-zA-Z0-9-]+$/.test(e.icon)?n`<yv-icon name="${e.icon}" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>`:e.icon:""}
                            <span>${e.label}</span>
                        </span>
                        <sutram-async-btn label="Open Panel" icon="external-link" intent="primary" size="sm" .onClick=${async h=>{this.dispatchEvent(new CustomEvent("sutram-settings-custom-action",{detail:{action:e,originalEvent:h},bubbles:!0,composed:!0})),e.onClick&&await e.onClick(h)}}></sutram-async-btn>
                    </div>
                </div>
            `)}

            ${r.map(e=>{const h=e.scope==="repo"&&l,f=this.formData&&this.formData[e.id]!==void 0?this.formData[e.id]:e.default,g=e.title||e.label||e.id;let u="";if(e.type==="action")u=n`
                        <sutram-async-btn
                            style="width: 100%;"
                            label=${e.button_label||e.label||"Execute Action"}
                            intent=${e.intent||"primary"}
                            ?disabled=${h}
                            .onClick=${async m=>new Promise((c,p)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:e,resolve:c,reject:p,originalEvent:m},bubbles:!0,composed:!0}))})}>
                        </sutram-async-btn>
                    `;else if(e.type==="boolean")u=n`
                        <sutram-toggle
                            .checked=${!!f}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${m=>this._emitFormMutation({...this.formData,[e.id]:m.detail.value})}>
                        </sutram-toggle>
                    `;else if(e.type==="select"){const m=(e.options||[]).map(c=>({value:c.value!==void 0?c.value:c,label:c.label||c.title||c.value||c}));u=n`
                        <sutram-select
                            .value=${f??""}
                            .options=${m}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${c=>this._emitFormMutation({...this.formData,[e.id]:c.detail.value})}>
                        </sutram-select>
                    `}else if(e.type==="number")u=n`
                        <sutram-input
                            type="number"
                            .value=${f!=null&&!Number.isNaN(f)?String(f):""}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${m=>{const c=m.detail.value,p=c===""?"":Number(c);this._emitFormMutation({...this.formData,[e.id]:Number.isNaN(p)?e.default??0:p})}}>
                        </sutram-input>
                    `;else if(e.type==="intent_map"){const m=Array.isArray(e.intent_legend)&&e.intent_legend.length>0?e.intent_legend:["primary","success","warning","danger","highlight","neutral"],c=typeof f=="object"&&f!==null?f:e.default||{};u=n`
                        <div class="intent-grid">
                            ${m.map(p=>{const x=Array.isArray(c[p])?c[p]:[];return n`
                                    <div class="intent-row">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: var(--intent-${p}); display: flex; align-items: center; gap: 6px;">
                                            ● ${p.toUpperCase()}
                                        </span>
                                        <sutram-input
                                            .value=${x.join(", ")}
                                            placeholder="Comma-separated keywords..."
                                            ?disabled=${h}
                                            ?flush=${!0}
                                            @sutram-input-changed=${C=>{const k=C.detail.value.split(",").map(D=>D.trim()).filter(Boolean),_={...c,[p]:k};this._emitFormMutation({...this.formData,[e.id]:_})}}>
                                        </sutram-input>
                                    </div>
                                `})}
                        </div>
                    `}else if(e.type==="string_list"){const m=Array.isArray(f)?f.join(", "):f||"";u=n`
                        <sutram-input
                            .value=${m}
                            placeholder=${e.placeholder||"Comma-separated values..."}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${c=>{const p=c.detail.value.split(",").map(x=>x.trim()).filter(Boolean);this._emitFormMutation({...this.formData,[e.id]:p})}}>
                        </sutram-input>
                    `}else if(e.type==="object"||e.type==="json"||typeof f=="object"&&f!==null){const m=this._jsonBuffers[e.id]!==void 0?this._jsonBuffers[e.id]:typeof f=="object"&&f!==null?JSON.stringify(f,null,2):f||"";u=n`
                        <sutram-textarea
                            .value=${m}
                            .monospace=${!0}
                            .minRows=${4}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${c=>{this._jsonBuffers={...this._jsonBuffers,[e.id]:c.detail.value};try{const p=JSON.parse(c.detail.value);this._emitFormMutation({...this.formData,[e.id]:p})}catch{this.requestUpdate()}}}>
                        </sutram-textarea>
                    `}else{const m=e.secure&&f==="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",c=e.type==="password"||e.secure?"password":"text";u=n`
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <sutram-input
                                type="${c}"
                                style="flex: 1; margin: 0;"
                                .value=${f??""}
                                placeholder=${e.secure?"Enter secret key...":e.placeholder||""}
                                ?disabled=${h}
                                ?flush=${!0}
                                @sutram-input-changed=${p=>this._emitFormMutation({...this.formData,[e.id]:p.detail.value})}>
                            </sutram-input>
                            ${m?n`
                                <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                                <sutram-btn
                                    size="sm"
                                    intent="danger"
                                    label="Clear"
                                    style="margin: 0;"
                                    @click=${()=>this._emitFormMutation({...this.formData,[e.id]:""})}>
                                </sutram-btn>
                            `:""}
                        </div>
                    `}return n`
                    <sutram-field-card
                        .label=${g}
                        .description=${e.description||e.desc||""}
                        .scope=${e.scope||"workspace"}
                        ?secure=${!!e.secure}>${u}
                    </sutram-field-card>
                `})}

            ${!this.hideSaveButton&&r.some(e=>e.type!=="action")?n`
                <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                    <sutram-async-btn
                        label="Save ${i?.name||this.extName} Settings"
                        icon="save"
                        intent="primary"
                        style="width: 100%;"
                        .onClick=${e=>this.triggerSave(e)}>
                    </sutram-async-btn>
                </div>
            `:""}
        `}}customElements.define("sutram-settings-form",SutramSettingsForm);export class SutramGenericSettingsModal extends ${static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String}};static styles=[w,v`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo=""}openModal(t,i,s,a=[],r=""){this.extName=t,this.schema=i||[],this.formData=s||{},this.repos=a||[],this.selectedRepo=r||this.repos[0]||"",this.open=!0,this.requestUpdate()}render(){if(!this.open)return n``;const s=(window.ExtensionRegistry?._manifests?.get(this.extName)?.name||this.extName)+" Settings";return n`
            <sutram-modal
                ?open=${!0}
                titleText=${s}
                ?fullscreen=${!0}
                @sutram-modal-closed=${a=>{a.target===a.currentTarget&&(this.open=!1)}}>
                <div slot="body">
                    <sutram-settings-form
                        .extName=${this.extName}
                        .schema=${this.schema}
                        .formData=${this.formData}
                        .repos=${this.repos}
                        .selectedRepo=${this.selectedRepo}
                        ?hideSaveButton=${!0}
                        @sutram-settings-form-changed=${a=>{this.formData=a.detail.formData}}>
                    </sutram-settings-form>
                </div>
                <sutram-async-btn
                    slot="footer"
                    label="Save Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${async a=>{const r=this.shadowRoot.querySelector("sutram-settings-form");r&&await r.triggerSave(a),this.open=!1}}>
                </sutram-async-btn>
            </sutram-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends ${static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=[w,v`
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
            border: 2px solid var(--border, #000000);
            border-top: none;
            box-shadow: 4px 4px 0 var(--intent-primary, #8b5cf6);
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
            background: var(--bg, #ffffff) !important;
            color: var(--text, #000000) !important;
            font-weight: 900 !important;
            border: 2px solid var(--intent-danger, #ec4899) !important;
            box-shadow: 3px 3px 0 var(--intent-warning, #eab308) !important;
        }
        :host([data-theme="e-ink"]) .sync-btn:hover { background: var(--bg-hover, #f1f5f9) !important; }
        :host([data-theme="e-ink"]) .sync-btn.active { background: var(--text, #000000) !important; color: var(--bg, #ffffff) !important; }
    `];updated(t){if(super.updated(t),t.has("_trayOpen")){const i=this.shadowRoot.querySelector(".action-tray-dialog");i&&(this._trayOpen&&!i.open?i.showModal():!this._trayOpen&&i.open&&i.close())}}connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback();const t=this.shadowRoot?.querySelector(".action-tray-dialog");t&&t.open&&(document.body.appendChild(t),t.close(),t.remove())}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const i=async(e,h)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(e,this.entityData,h);if(e.asyncAction)return await e.asyncAction(this.entityData,h);if(e.onClick)return e.onClick(this.entityData,h)};if(this.variant==="menu-bar"){const e={file:[],edit:[],share:[],tools:[]};t.forEach(u=>{const m=u.group&&e[u.group]?u.group:"tools";e[m].push({...u,label:typeof u.label=="function"?u.label(this.entityData):u.label,icon:typeof u.icon=="function"?u.icon(this.entityData):u.icon||"",asyncAction:u.asyncAction?c=>i(u,c):null,onClick:!u.asyncAction&&u.onClick?c=>i(u,c):null})});const h={file:"File",edit:"Edit",share:"Share",tools:"Tools"},f={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},g=u=>{const m=u.currentTarget;if(!m)return;const c=m.getBoundingClientRect(),p=m.closest(".spatial-col, sutram-app-shell, .editor-header")||document.body,x=p.getBoundingClientRect?p.getBoundingClientRect().right:window.innerWidth,C=Math.min(window.innerWidth,x);c.left+220>C-10?(m.setAttribute("align","right"),m.align="right"):(m.setAttribute("align","left"),m.align="left")};return n`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(e).map(u=>e[u].length===0?"":n`
                            <sutram-dropdown 
                                .items=${e[u]} 
                                align="left"
                                @pointerdown=${g}
                                @click=${g}>
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${f[u]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${h[u]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const s=this.variant==="footer",a=[],r=[];t.forEach(e=>{s||(e.order||99)<20?a.push(e):r.push(e)});const o=e=>{if(e.component)return n`<div style="display: contents; order: ${e.order||99};">${e.component(this.entityData)}</div>`;const h=typeof e.label=="function"?e.label(this.entityData):e.label,f=typeof e.icon=="function"?e.icon(this.entityData):e.icon||"",g=typeof e.intent=="function"?e.intent(this.entityData):e.intent||"primary",u=typeof e.isActive=="function"?e.isActive(this.entityData):!!e.isActive,m=s?"flex: 1; width: 100%;":"";if(e.asyncAction||window.ExtensionRegistry.executeEntityAction&&e.vfsBound)return n`
                    <sutram-async-btn 
                        style="margin: 0; order: ${e.order||99}; ${m}" 
                        .label=${h}
                        .icon=${f}
                        intent="${g}" 
                        ?active=${u}
                        .onClick=${p=>i(e,p)}>
                    </sutram-async-btn>
                `;const c=p=>{if(p&&p.stopPropagation(),e.emitEvent){const x=e.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(x.name,{detail:x.detail,bubbles:!0,composed:!0}))}else i(e,p)};return n`
                <sutram-btn 
                    intent=${g} 
                    ?active=${u}
                    style="margin: 0; order: ${e.order||99}; gap: 4px; ${m}"
                    .label=${h}
                    .icon=${f}
                    @click=${c}>
                </sutram-btn>
            `},y=()=>{const e={file:[],edit:[],share:[],tools:[]};t.forEach(c=>{const p=c.group&&e[c.group]?c.group:"tools";e[p].push(c)});const h={file:"File",edit:"Edit",share:"Share",tools:"Tools"},f={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},g=async(c,p)=>{await i(c,p),c.keepDrawerOpen||(this._trayOpen=!1)},u=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",m=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return n`
                <dialog class="action-tray-dialog" @cancel=${c=>{c.preventDefault(),this._trayOpen=!1}} @click=${c=>{c.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u}</span>
                                ${m?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(e).map(c=>e[c].length===0?"":n`
                                    <div class="tray-group-header">
                                        <yv-icon name="${f[c]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${h[c]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${e[c].map(p=>{const x=typeof p.label=="function"?p.label(this.entityData):p.label,C=typeof p.icon=="function"?p.icon(this.entityData):p.icon||"",k=typeof p.intent=="function"?p.intent(this.entityData):p.intent||"primary",_=typeof p.isActive=="function"?p.isActive(this.entityData):!!p.isActive,D=b=>b?typeof b=="object"?b:b.includes("<")?n`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${b}</span>`:/^[a-zA-Z0-9-]+$/.test(b)?n`<yv-icon name="${b}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:n`<span style="margin-right: 6px;">${b}</span>`:"";return p.asyncAction||window.ExtensionRegistry.executeEntityAction&&p.vfsBound?n`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${x}
                                                        .icon=${C}
                                                        intent="${k}" 
                                                        ?active=${_}
                                                        .onClick=${b=>g(p,b)}>
                                                    </sutram-async-btn>
                                                `:n`
                                                <button 
                                                    class="sync-btn ${_?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${k}) 15%, transparent); color: var(--intent-${k}); border: 1px solid color-mix(in srgb, var(--intent-${k}) 40%, transparent);" 
                                                    @click=${b=>g(p,b)}>
                                                    ${D(C)}${x}
                                                </button>
                                            `})}
                                    </div>
                                `)}
                        </div>
                    </div>
                </dialog>
            `},l=n`
            ${t.length>0&&!s?n`
                <sutram-btn intent="neutral" style="order: -1; margin-right: 4px;"
                    label="⋮"
                    @click=${e=>{e.stopPropagation(),this._trayOpen=!0}}>
                </sutram-btn>
            `:""}
            ${a.map(o)}
        `;return n`
            ${this.scrollable?n`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${l}
                    </div>
                </sutram-scrub-track>
            `:l}
            ${this._trayOpen?y():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends E(N){static properties={...N.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?S:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,s=>{const a=this._getId();a&&s.selectedItems&&(this.selected=s.selectedItems.has(a))});const t=this._getId(),i=this._getStore();t&&i&&i.getState().selectedItems&&(this.selected=i.getState().selectedItems.has(t))}this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const i=this._getId();if(i&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const s=this._getStore();s&&s.getState().toggleSelection&&s.getState().toggleSelection(i,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:i,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if((t.has("icon")||t.has("entityData"))&&(this.entityData?.needs_recompile||this.entityData?.is_dirty||this.entityData?.outdated)&&(!this.icon||this.icon==="alert-triangle"||this.icon==="package")&&(this.icon="construction"),super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const i=this._getId(),s=this._getStore();i&&s&&s.getState().selectedItems&&(this.selected=s.getState().selectedItems.has(i))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this.hasActions||(this.hasActions=!0),!this.actionsOpen)return;let i=this.querySelector(".sutram-injected-actions");if(i){const s=i.querySelector("sutram-entity-actions");s&&(s.entityType=this.entityType,s.entityData=this.entityData)}else{i=document.createElement("div"),i.className="sutram-injected-actions",i.slot="actions",i.style.display="flex",i.style.flexWrap="nowrap",i.style.gap="8px",i.style.alignItems="center",i.style.width="max-content",i.addEventListener("click",a=>a.stopPropagation());const s=document.createElement("sutram-entity-actions");s.entityType=this.entityType,s.entityData=this.entityData,s.scrollable=!0,i.appendChild(s),this.appendChild(i),this.hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends G{}customElements.get("sutram-card-group")||customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends Q{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends K{}customElements.get("sutram-spinner")||customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends Z{}customElements.get("sutram-empty-state")||customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends X{}customElements.get("sutram-board")||customElements.define("sutram-board",SutramBoard);export class SutramColumn extends tt{}customElements.get("sutram-column")||customElements.define("sutram-column",SutramColumn);export class SutramTag extends et{}customElements.get("sutram-tag")||customElements.define("sutram-tag",SutramTag);export class SutramLabel extends it{}customElements.get("sutram-label")||customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends rt{}customElements.get("sutram-scrub-track")||customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends at{}customElements.get("sutram-scroll-view")||customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends H{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends st{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-action-error",t=>{window.dispatchEvent(new CustomEvent("sutram-status-update",{detail:{msg:t.detail?.msg||"Action failed",timeout:4e3,isError:!0}}))})}}customElements.define("sutram-dropdown",SutramDropdown);export class SutramTabs extends lt{}customElements.get("sutram-tabs")||customElements.define("sutram-tabs",SutramTabs);export class SutramFilterDropdown extends nt{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends W{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{t.stopPropagation(),t.target===this&&this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!1,composed:!1}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends q{}customElements.get("sutram-category-section")||customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends V{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends J{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as M}from"./wordcount.js";const bt=[];export class SutramEditor extends E(A){static properties={...A.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const i=Array.isArray(this.customExtensions)?this.customExtensions.filter(s=>s!==M):[];this.enableWordcount&&i.push(M),this.customExtensions=i}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this._lastEmittedValue=t.detail?.value,this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("content-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new Event("input",{bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-selection",t=>{this.dispatchEvent(new CustomEvent("editor-selection",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-scroll",t=>{this.dispatchEvent(new CustomEvent("editor-scroll",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends ${static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[w,v`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const i=++this._lastSearchReq;R.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:s})=>{i===this._lastSearchReq&&(this._filteredItems=(s||[]).slice(0,50))})}}render(){if(!this.open)return n``;const t=this._filteredItems||[];return n`
            <sutram-modal ?open=${!0} titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <sutram-input placeholder="Search..." ?flush=${!0} .value=${this._searchQuery} @sutram-input-changed=${i=>this._searchQuery=i.detail.value} style="width: 100%; margin-bottom: 10px; flex-shrink: 0;"></sutram-input>
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${t.length===0?n`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>`:t.map(i=>{const s=typeof i=="string"?i:i.label||i;return n`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:i},bubbles:!0,composed:!0}))}}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${s}
                                </button>
                            `})}
                    </div>
                </div>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends ${static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[w,v`
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
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,i=this.tabs.find(s=>s.id===t)||this.tabs[0];return i&&i.content||""}return this.content||""}render(){const t=this._getActiveContent(),i=this.tabs&&this.tabs.length>1,s=this.activeTab||this.tabs&&this.tabs[0]?.id||"",a=this.suggestedFilename||`report_${Date.now()}.txt`;return n`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 15px; gap: 10px;">
                ${this.caption?n`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${i?n`
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        ${this.tabs.map(r=>n`
                            <sutram-btn
                                size="sm"
                                .icon=${r.icon||"file-text"}
                                .label=${r.label}
                                intent="${s===r.id?"primary":"neutral"}"
                                ?active=${s===r.id}
                                @click=${()=>{this.activeTab=r.id,this.requestUpdate()}}>
                            </sutram-btn>
                        `)}
                    </div>
                `:""}
                <div class="output-box">${t||"No output."}</div>
                ${this.extraContent?n`<div style="flex-shrink: 0;">${this.extraContent}</div>`:""}
                <div style="padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;">
                    <sutram-entity-actions
                        ?scrollable=${!0}
                        style="justify-content: flex-end;"
                        .entityType=${"text_blob"}
                        .entityData=${{textContent:t,suggestedFilename:a}}>
                    </sutram-entity-actions>
                </div>
            </div>
            ${this.actions&&this.actions.length>0?n`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(r=>{const o=r.style||(r.primary?"flex: 2; margin: 0;":"flex: 1; margin: 0;");return r.asyncAction?n`
                                <sutram-async-btn
                                    .icon=${r.icon}
                                    .label=${r.label}
                                    intent="${r.intent||"primary"}"
                                    style="${o}"
                                    ?disabled=${r.disabled}
                                    .onClick=${r.asyncAction}>
                                </sutram-async-btn>
                            `:n`
                            <sutram-btn
                                .icon=${r.icon}
                                .label=${r.label}
                                intent="${r.intent||"neutral"}"
                                style="${o}"
                                ?disabled=${r.disabled}
                                @click=${r.onClick}>
                            </sutram-btn>
                        `})}
                </div>
            `:""}
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends E(ot){}customElements.define("sutram-diff-viewer",SutramDiffViewer);export class SutramSubtabMenu extends ${static properties={slotConfig:{type:Object},_menuItems:{type:Array,state:!0},_selectedCount:{type:Number,state:!0}};static styles=[w,v`
        :host { display: flex; align-items: stretch; height: 100%; }
        .subtab-menu-trigger {
            background: transparent;
            color: var(--text);
            border: none;
            border-left: 1px solid var(--border);
            border-radius: 0;
            cursor: pointer;
            font-weight: bold;
            height: 100%;
            width: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            position: relative;
            padding: 0;
            margin: 0;
            transition: background 0.15s ease;
        }
        .subtab-menu-trigger:hover {
            background: var(--input-bg);
        }
        .subtab-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            background: var(--intent-warning);
            color: var(--bg-deep, #000000);
            border-radius: 50%;
            width: 14px;
            height: 14px;
            font-size: 9px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
    `];constructor(){super(),this.slotConfig=null,this._menuItems=[],this._selectedCount=0,this._selectedItems=new Map}connectedCallback(){super.connectedCallback(),this.subscribe(S,t=>t.selectedItems||new Map,t=>{this._selectedItems=t,this._rebuildMenu()}),this.subscribe(z,t=>t.isOffline,()=>{this._rebuildMenu()}),this.registerGlobalListener("sutram-subtab-menu-refresh",window,()=>{this._rebuildMenu()}),this._selectedItems=S.getState()?.selectedItems||new Map,this._rebuildMenu()}_bindSlotMenuStores(){this._slotStoreUnsubs&&this._slotStoreUnsubs.forEach(i=>i()),this._slotStoreUnsubs=[],(this.slotConfig?.menuStores||[]).forEach(i=>{const s=this.subscribe(i,()=>{this._rebuildMenu()});this._slotStoreUnsubs.push(s)})}disconnectedCallback(){super.disconnectedCallback(),this._slotStoreUnsubs=[]}willUpdate(t){super.willUpdate(t),t.has("slotConfig")&&(this._bindSlotMenuStores(),this._rebuildMenu())}_rebuildMenu(){const t=this.slotConfig||{},i=this._selectedItems||new Map,s=Array.from(i.values()),a=Array.isArray(t.bulkEntityTypes)&&t.bulkEntityTypes.length>0?t.bulkEntityTypes:null,r=a?s.filter(l=>String(l?.entityType||"").split(":").some(h=>a.includes(h))):s;this._selectedCount=t.bulkActionGroup?r.length:0;const o=[];if(t.bulkActionGroup&&r.length>0){const l=window.ExtensionRegistry?.getAggregatableActions?window.ExtensionRegistry.getAggregatableActions(r,{group:t.bulkActionGroup}):[];l.length>0&&(l.forEach(e=>o.push(e)),o.push({divider:!0})),o.push({label:`Clear Selection (${r.length})`,icon:"x",onClick:()=>S.getState().clearSelection()}),o.push({divider:!0})}for((typeof t.menuActions=="function"?t.menuActions(t):Array.isArray(t.menuActions)?t.menuActions:[]).forEach(l=>{if(l){if(l.divider){o.push({divider:!0});return}o.push({...l,onClick:l.onClick||(l.emitEvent?()=>{const e=typeof l.emitEvent=="function"?l.emitEvent(t):l.emitEvent;typeof e=="string"?window.dispatchEvent(new CustomEvent(e,{bubbles:!0,composed:!0})):e&&e.name&&window.dispatchEvent(new CustomEvent(e.name,{detail:e.detail,bubbles:!0,composed:!0}))}:null)})}});o.length>0&&o[o.length-1].divider;)o.pop();this._menuItems=o}render(){if(!this._menuItems||this._menuItems.length===0)return n``;const t=this._selectedCount||0;return n`
            <sutram-dropdown align="right" .items=${this._menuItems} style="height: 100%; display: flex; align-items: stretch;">
                <button slot="trigger" class="subtab-menu-trigger" @pointerdown=${()=>this._rebuildMenu()} title="${t>0?`Bulk Actions (${t} selected)`:"Actions"}">
                    ${t>0?n`
                        <yv-icon name="layers" style="width: 15px; height: 15px; color: var(--intent-warning);"></yv-icon>
                        <span class="subtab-badge">${t>9?"9+":t}</span>
                    `:n`
                        <yv-icon name="menu" style="width: 14px; height: 14px;"></yv-icon>
                    `}
                </button>
            </sutram-dropdown>
        `}}customElements.get("sutram-subtab-menu")||customElements.define("sutram-subtab-menu",SutramSubtabMenu);export class SutramDagTree extends ${static properties={stages:{type:Array},rootNode:{type:Object},nodes:{type:Array},renderNode:{type:Object},compact:{type:Boolean,reflect:!0}};static styles=[w,v`
        :host {
            display: flex;
            flex-direction: column;
            gap: 14px;
            width: 100%;
            box-sizing: border-box;
        }
        .wavefront-stage {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 12px 14px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-left: 4px solid var(--stage-accent, var(--intent-primary));
            border-radius: 8px;
            position: relative;
        }
        .wavefront-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
        }
        .wavefront-title {
            font-family: var(--font-mono);
            font-size: 0.78rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .wavefront-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 10px;
        }
        .stage-connector {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 14px;
            margin: -7px 0;
            color: var(--text-muted);
            font-size: 0.75rem;
            user-select: none;
        }
        .dag-node-card {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px 12px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            cursor: pointer;
            transition: border-color 0.15s ease, background 0.15s ease;
        }
        .dag-node-card:hover {
            border-color: var(--intent-primary);
            background: var(--bg-hover);
        }
        .tree-branch {
            position: relative;
            display: flex;
            flex-direction: column;
            padding-left: var(--branch-indent, 0px);
        }
        .tree-line-v {
            position: absolute;
            left: 10px;
            top: -12px;
            bottom: 0;
            width: 2px;
            background: var(--border);
            z-index: 1;
        }
        .tree-line-v.last {
            bottom: auto;
            height: 44px;
        }
        .tree-line-h {
            position: absolute;
            left: 10px;
            top: 30px;
            width: 18px;
            height: 2px;
            background: var(--border);
            z-index: 1;
        }
    `];constructor(){super(),this.stages=[],this.rootNode=null,this.nodes=[],this.renderNode=null,this.compact=!1}_renderDefaultStageNode(t,i){if(typeof this.renderNode=="function")return this.renderNode(t,i);const s=typeof t=="string"?t:t.title||t.label||t.id||t.name||"node",a=typeof t=="object"&&Array.isArray(t.badges)?t.badges:[],r=typeof t=="object"&&t.subtitle?String(t.subtitle):"",o=typeof t=="object"&&Array.isArray(t.parents)?t.parents:[];return n`
            <div class="dag-node-card" @click=${()=>this.dispatch("sutram-dag-node-clicked",{node:t,stageIdx:i})}>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="font-weight: bold; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text);">${s}</span>
                    ${a.length>0?n`
                        <div style="display: inline-flex; gap: 4px; align-items: center;">
                            ${a.map(y=>{const l=typeof y=="string"?y:y?.text||"",e=typeof y=="object"&&y?.intent?y.intent:"primary";return l?n`<sutram-tag text=${l} intent=${e}></sutram-tag>`:""})}
                        </div>
                    `:""}
                </div>
                ${r?n`<div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--intent-warning);">${r}</div>`:""}
                ${o.length>0?n`
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-top: 2px;">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">🔗 Parents:</span>
                        ${o.map(y=>n`<span style="font-size: 0.7rem; font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px;">${y}</span>`)}
                    </div>
                `:""}
            </div>
        `}_renderHierarchyBranch(t,i,s=0,a=!0){if(!t)return"";const r=t.id,o=i[r]||[];return n`
            <div class="tree-branch" style="--branch-indent: ${s>0?"28px":"0px"};">
                ${s>0?n`
                    <div class="tree-line-v ${a?"last":""}"></div>
                    <div class="tree-line-h"></div>
                `:""}
                ${typeof this.renderNode=="function"?this.renderNode(t,s):this._renderDefaultStageNode(t,s)}
                ${o.length>0?n`
                    <div style="display: flex; flex-direction: column; margin-left: ${s===0?"8px":"0px"};">
                        ${o.map((y,l)=>this._renderHierarchyBranch(y,i,s+1,l===o.length-1))}
                    </div>
                `:""}
            </div>
        `}render(){if(Array.isArray(this.stages)&&this.stages.length>0)return n`
                ${this.stages.map((t,i)=>{const s=Array.isArray(t)?t:[t],a=s.length>1,r=a?"var(--intent-highlight)":i===0?"var(--intent-primary)":"var(--intent-success)";return n`
                        ${i>0?n`<div class="stage-connector">↓</div>`:""}
                        <div class="wavefront-stage" style="--stage-accent: ${r};">
                            <div class="wavefront-header">
                                <span class="wavefront-title">
                                    <yv-icon name=${a?"git-branch":"layers"} style="width: 14px; height: 14px; color: ${r};"></yv-icon>
                                    <span>Wavefront Stage ${i+1}${i===0?" (Root)":""}</span>
                                </span>
                                <sutram-tag
                                    text=${a?`\u2225 Parallel Stage (${s.length} branches)`:"Sequential Step"}
                                    intent=${a?"highlight":"neutral"}>
                                </sutram-tag>
                            </div>
                            <div class="wavefront-grid">
                                ${s.map(o=>this._renderDefaultStageNode(o,i))}
                            </div>
                        </div>
                    `})}
            `;if(this.rootNode){const i=(Array.isArray(this.nodes)?this.nodes:[]).reduce((s,a)=>{const r=a.parentId||a.parent_id;return r&&(s[r]||(s[r]=[]),s[r].push(a)),s},{});return n`${this._renderHierarchyBranch(this.rootNode,i,0,!0)}`}return n`<slot></slot>`}}customElements.get("sutram-dag-tree")||customElements.define("sutram-dag-tree",SutramDagTree);
