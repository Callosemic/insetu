import{LitElement as M,html as l,css as C}from"lit";import{BAND_QUERY as F,columnBandOf as Z,DiffViewStore as R,SutramElement as A,SutramContextMixin as I,SelectionStore as D,ToastStore as V,EnvironmentStore as H,VariantDefaultStore as N,ExtensionRegistry as O,resolveSelectionEntityType as Y}from"./sutram_sdk.js";import*as W from"sutram-chassis";import{sharedStyles as _}from"./shared_styles.js";import{resolveDirectoryState as X,fuzzyFilterObjects as tt,SutramWorker as q}from"./utils.js";import"./inputs.js";import"lit-virtualizer";import{SutramDagTree as et,SutramFloatingHud as it}from"./chassis_adapter.js";export{et as SutramDagTree,it as SutramFloatingHud};export const REQUIRED_CHASSIS_PRIMITIVES=["Icon","View","Stack","Surface","ActionBar","SidebarLayout","Btn","AsyncBtn","Card","CardGroup","CategorySection","Modal","Window","Tabs","Toolbar","SearchBar","Dropdown","FilterDropdown","Collapsible","Pill","FilterGroup","Tag","Label","Spinner","EmptyState","Board","Column","ScrubTrack","ScrollView","DiffViewer","Editor","Input","Select","Textarea","Toggle"];export function validateChassisContract(d){if(!d||typeof d!="object")throw new Error("[Sutram Boot Error] Invalid or missing chassis provider object.");const t=REQUIRED_CHASSIS_PRIMITIVES.filter(e=>typeof d[e]!="function");if(t.length>0)throw new Error(`[Sutram Boot Error] Chassis '${d.CHASSIS_PROVIDER_META?.name||"Custom"}' fails contract. Missing primitives: ${t.join(", ")}`);return!0}export class SutramUIAdapter{static PASSTHROUGH_MAP=Object.freeze({"sutram-icon":"Icon","sutram-view":"View","sutram-stack":"Stack","sutram-surface":"Surface","sutram-action-bar":"ActionBar","sutram-btn":"Btn","sutram-card-group":"CardGroup","sutram-category-section":"CategorySection","sutram-spinner":"Spinner","sutram-empty-state":"EmptyState","sutram-board":"Board","sutram-column":"Column","sutram-tag":"Tag","sutram-label":"Label","sutram-scrub-track":"ScrubTrack","sutram-scroll-view":"ScrollView","sutram-filter-dropdown":"FilterDropdown","sutram-tabs":"Tabs","sutram-input":"Input","sutram-select":"Select","sutram-textarea":"Textarea","sutram-toggle":"Toggle","sutram-drop-overlay":"DropOverlay","sutram-drop-target":"DropTarget"});static registerChassis(t){validateChassisContract(t),Object.entries(this.PASSTHROUGH_MAP).forEach(([e,i])=>{const a=t[i];typeof a=="function"&&!customElements.get(e)&&customElements.define(e,class extends a{})})}}SutramUIAdapter.registerChassis(W);const{Icon:st,View:nt,Stack:at,Surface:rt,ActionBar:ot,SidebarLayout:lt,Btn:ct,AsyncBtn:P,StatusBar:G,ToastContainer:ut,Modal:dt,Window:pt,CategorySection:mt,Card:K,CardGroup:ht,Editor:j,Toolbar:bt,Collapsible:ft,Pill:gt,FilterGroup:yt,SelectionTray:Ft,SearchBar:vt,Spinner:xt,EmptyState:wt,Board:St,Column:kt,Tag:Et,Label:$t,Dropdown:Ct,FilterDropdown:_t,ScrubTrack:At,ScrollView:Dt,DiffViewer:Tt,Tabs:It}=W;j&&(j.languageResolver=async d=>window.ExtensionRegistry&&typeof window.ExtensionRegistry.executeUIHook=="function"?await window.ExtensionRegistry.executeUIHook("sutram:vendorize-language",d):window.Sutram&&typeof window.Sutram.vendorizeLanguage=="function"?await window.Sutram.vendorizeLanguage(d):null);export class SutramVirtualList extends M{static properties={items:{type:Array},renderItem:{type:Object},keyFunction:{type:Object},flush:{type:Boolean,reflect:!0}};static styles=C`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            container-type: inline-size;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        lit-virtualizer {
            width: 100%;
            height: 100%;
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            padding: 8px 0;
            box-sizing: border-box;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        :host([flush]) lit-virtualizer {
            padding: 0;
        }
        @container ${F.compact} {
            lit-virtualizer {
                padding: 0;
            }
        }
        lit-virtualizer > * {
            width: calc(100% - 24px) !important;
            max-width: calc(100% - 24px) !important;
            margin-left: 12px !important;
            margin-right: 12px !important;
            box-sizing: border-box;
        }
        :host([flush]) lit-virtualizer > * {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
        }
        lit-virtualizer sutram-card,
        lit-virtualizer yenvui-card {
            margin-bottom: 8px;
            content-visibility: visible !important;
            contain-intrinsic-size: none !important;
            --card-content-visibility: visible;
            --card-contain-intrinsic-size: none;
        }
        @container ${F.compact} {
            lit-virtualizer > * {
                width: 100% !important;
                max-width: 100% !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            lit-virtualizer sutram-card,
            lit-virtualizer yenvui-card {
                margin-bottom: 0;
            }
        }
    `;constructor(){super(),this.items=[],this.renderItem=null,this.keyFunction=(t,e)=>{if(!t)return e;if(typeof t=="string")return t;const i=t.type||t.entityType||"item",a=t.canonicalUri||t.fullPath||t.filepath||t.id||t.name||e;return`${i}::${a}`}}connectedCallback(){super.connectedCallback(),this.setAttribute("data-virtual-list","")}render(){return!this.items||this.items.length===0?l``:l`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .keyFunction=${this.keyFunction}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export function renderAdaptiveLabel({icon:d="",label:t="",badge:e=null,showLabel:i=!0,iconSize:a="sm",intent:r=null}={}){return l`
        ${d?l`<sutram-icon name=${d} size=${a} intent=${r||"current"}></sutram-icon>`:""}
        ${i&&t?l`<span class="adaptive-label-text">${t}</span>`:""}
        ${!i&&e!==null&&e!==void 0&&e!==""?l`<span class="adaptive-label-badge">${e}</span>`:""}
    `}export class SutramIcon extends st{}customElements.get("sutram-icon")||customElements.define("sutram-icon",SutramIcon);export class SutramView extends nt{connectedCallback(){super.connectedCallback(),this._zenBridged||(this._zenBridged=!0,this.addEventListener("yenvui-view-exit-zen",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-view-exit-zen",{bubbles:!0,composed:!0}))}))}}customElements.get("sutram-view")||customElements.define("sutram-view",SutramView);export class SutramStack extends at{}customElements.get("sutram-stack")||customElements.define("sutram-stack",SutramStack);export class SutramSurface extends rt{}customElements.get("sutram-surface")||customElements.define("sutram-surface",SutramSurface);export class SutramActionBar extends ot{}customElements.get("sutram-action-bar")||customElements.define("sutram-action-bar",SutramActionBar);export class SutramSidebarLayout extends lt{connectedCallback(){super.connectedCallback(),this._sidebarBridged||(this._sidebarBridged=!0,this.addEventListener("yenvui-nav-selected",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-nav-selected",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-drawer-closed",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-drawer-closed",{bubbles:!0,composed:!0}))}))}}customElements.get("sutram-sidebar-layout")||customElements.define("sutram-sidebar-layout",SutramSidebarLayout);export class SutramBtn extends ct{}customElements.get("sutram-btn")||customElements.define("sutram-btn",SutramBtn);export class SutramProjectionWindowControls extends A{static properties={filepath:{type:String},projectionId:{type:String},beforeAction:{attribute:!1}};static styles=[_,C`:host { display: inline-flex; align-items: center; }`];_getTargetId(){return this.projectionId||this.filepath||""}render(){const t=this._getTargetId();if(!t)return l``;const e=typeof window<"u"&&new URLSearchParams(window.location.search).get("popout")==="true",i=window.Sutram?.stores?.Layout?.getState?.();return e?l`
                <sutram-btn
                    ?compact=${!0}
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),i&&typeof i.dockInProjection=="function"&&await i.dockInProjection(t)}}>
                </sutram-btn>
            `:(i&&typeof i.canPopout=="function"?i.canPopout():!0)?l`
                <sutram-btn
                    ?compact=${!0}
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),i&&typeof i.dockInProjection=="function"&&await i.popoutProjection(t)}}>
                </sutram-btn>
            `:l``}}customElements.get("sutram-projection-window-controls")||customElements.define("sutram-projection-window-controls",SutramProjectionWindowControls);export class SutramAsyncBtn extends I(P){static properties={...P.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(H,t=>{if(t.isOffline){let e=this,i=null;for(;e;){if(e.dataset&&e.dataset.ext){i=e.dataset.ext;break}e=e.getRootNode().host||e.parentElement}const a=i&&window.ExtensionRegistry?.getExtension(i)?.offline_mode;this._isOfflineReadOnly=a==="read_only"||a==="none"||!a}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.jobRoute&&typeof window.ExtensionRegistry?.executeJobAction=="function"){this.status="loading";try{const e=typeof this.jobPayload=="function"?await this.jobPayload(t):this.jobPayload||{};await window.ExtensionRegistry.executeJobAction(this.jobRoute,e,{onProgress:(a,r)=>{this.onJobProgress&&this.onJobProgress(a,r)},onComplete:a=>{this.onJobComplete&&this.onJobComplete(a),this._completeWithConfirmation()},onError:a=>{this.status="error",this.onJobError&&this.onJobError(a),this.registerTimeout(()=>{this.status="idle"},2e3)}})(t);return}catch(e){if(this.status="error",typeof this.onJobError=="function")try{this.onJobError(e)}catch{}console.error("[SutramAsyncBtn] Job dispatch error:",e),this.registerTimeout(()=>{this.status="idle"},2e3);return}}return super._handleClick(t)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends I(G){static properties={...G.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends I(ut){connectedCallback(){super.connectedCallback(),this.subscribe(V,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{V.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);function Lt(d){const t=Math.max(0,Math.round(d));return t<1e3?String(t):t<1e4?`${(t/1e3).toFixed(1)}k`:`${Math.round(t/1e3)}k`}export class SutramSelectionTray extends A{static properties={selectedItems:{type:Object},modalOpen:{type:Boolean},trayTitle:{type:String},itemBadge:{type:String},chipLabel:{type:String},bulkGroup:{type:String},empty:{type:Boolean,reflect:!0},_compactChip:{type:Boolean,state:!0}};static styles=[_,C`
        :host {
            display: inline-flex;
            align-items: center;
            height: 100%;
            flex-shrink: 0;
        }
        :host([empty]) {
            display: none !important;
        }
        .cart-btn {
            background: color-mix(in srgb, var(--intent-warning) 15%, transparent);
            color: var(--intent-warning);
            border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent);
            border-radius: 20px;
            min-height: 44px;
            min-width: 44px;
            padding: 0 12px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
            margin: 0 6px;
            box-sizing: border-box;
            white-space: nowrap;
        }
        .cart-btn:hover {
            background: color-mix(in srgb, var(--intent-warning) 25%, transparent);
        }
        .adaptive-label-badge,
        .cart-badge {
            background: var(--intent-warning);
            color: var(--bg-deep, #000000);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: bold;
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
        .item-order { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); min-width: 1.2em; text-align: right; flex-shrink: 0; }
        .pack-tag { flex-shrink: 0; background: color-mix(in srgb, var(--intent-warning) 20%, transparent); color: var(--intent-warning); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
        .tray-footer {
            display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--bg-deep); border-radius: 0 0 12px 12px; width: 100%; box-sizing: border-box; overflow: hidden;
        }
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1,this.trayTitle="Selection Tray",this.itemBadge="ITEM",this.chipLabel="",this.bulkGroup="share",this.empty=!0,this._compactChip=!1}_syncChipMode(t=null){let e=t;e==null&&(e=this.resolveAssignedSpatialContainer(".spatial-col, [data-spatial-boundary]")?.clientWidth||(typeof window<"u"?window.innerWidth:1024)),this._compactChip=e>0&&Z(e).compact}connectedCallback(){super.connectedCallback(),this.subscribe(D,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.empty=this.selectedItems.size===0&&!this.modalOpen}),this.selectedItems=D.getState().selectedItems,this.empty=this.selectedItems.size===0&&!this.modalOpen,this.observeAssignedContainer(t=>this._syncChipMode(t),".spatial-col, [data-spatial-boundary]")}willUpdate(t){if(super.willUpdate(t),t.has("selectedItems")||t.has("modalOpen")){const e=this.selectedItems?.size||0;this.empty=e===0&&!this.modalOpen}}_handleBulkActionSettled(t){t?.detail?.phase!=="settled"||t.detail.keepSelection||t.detail.action?.keepSelection||(D.getState().clearSelection(),this.modalOpen=!1)}render(){const t=this.selectedItems.size;if(t===0&&!this.modalOpen)return l``;const e=Array.from(this.selectedItems.values()),i=Y(e);let a=0,r=!1;const n=window.ExtensionRegistry;e.forEach(s=>{const u=s.data?.size_bytes||(n?.executeUIHook?n.executeUIHook("sutram:resolve-item-size",s.data):null);u?a+=u:r=!0});const m=a>0?`~${Math.max(1,Math.round(a/1024))} kB \xB7 ~${Lt(a/4)} tokens${r?" +":""}`:"";let f=[];return n&&typeof n.getAggregatableActions=="function"&&(f=n.getAggregatableActions(e,{group:this.bulkGroup||"share"})),l`
            ${t>0?l`
                <button class="cart-btn" data-testid="selection-tray-chip" title="${this.chipLabel?`${this.chipLabel} (${t})`:`${t} selected`}" @click=${()=>{this.modalOpen=!0,this.empty=!1}}>
                    ${renderAdaptiveLabel({icon:"layers",label:this.chipLabel?`${this.chipLabel} (${t})`:`${t} selected`,badge:String(t),showLabel:!this._compactChip,iconSize:"sm"})}
                </button>
            `:""}

            <div class="tray-overlay ${this.modalOpen?"open":""}" @click=${()=>this.modalOpen=!1}></div>
            <div class="tray-panel ${this.modalOpen?"open":""}">
                <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">${this.trayTitle||"Selection Tray"} <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${m?l`<span data-testid="selection-tray-size" style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m}</span>`:""}
                    </div>
                    <button type="button" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 1.1rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${e.map((s,u)=>{const c=s.data?.filepath||s.data?.folderpath||s.data?.id||"",g=String(c).replace(/\/+$/,""),y=s.data?.titleText||g.split("/").pop()||"Unknown Item",h=s.key||c,b=s.data?.size_bytes||(n?.executeUIHook?n.executeUIHook("sutram:resolve-item-size",s.data):null),v=b?`${Math.max(1,Math.round(b/1024))} kB`:"",x=(n?.executeUIHook?n.executeUIHook("sutram:resolve-item-kind",s):null)||this.itemBadge||"ITEM";return l`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;"><span class="item-order">${u+1}</span><span class="pack-tag">${x}</span> <span style="overflow: hidden; text-overflow: ellipsis;">${y}</span></div>${v?l`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${v}</span>`:""}
                                </div>
                                <div class="tray-item-path">${c}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>D.getState().toggleSelection(h,s.entityType,s.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{D.getState().clearSelection(),this.modalOpen=!1}}></sutram-async-btn>
                    <div
                        style="flex: 1 1 0%; min-width: 0; display: flex; justify-content: flex-end;"
                        @yenvui-action-confirmed=${s=>this._handleBulkActionSettled(s)}>
                        <sutram-entity-actions
                            .actionsList=${f}
                            .entityType=${i}
                            .entityData=${e}>
                        </sutram-entity-actions>
                    </div>
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends M{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[_];render(){if(!this.items||this.items.length===0)return l``;const t={};this.items.forEach(i=>{const a=i[this.categoryKey]||"Uncategorized";t[a]||(t[a]=[]),t[a].push(i)});const e=Object.keys(t).sort((i,a)=>{const r=this.categoryOrder||[];let n=r.indexOf(i),m=r.indexOf(a);return n===-1&&(n=999),m===-1&&(m=999),n!==m?n-m:i.localeCompare(a)});return l`
            <sutram-stack direction="col" gap="none">
                ${e.map(i=>l`
                    <sutram-category-section titleText=${i}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(i):""}
                        <sutram-card-group>
                            ${t[i].map(a=>this.renderItem(a))}
                        </sutram-card-group>
                    </sutram-category-section>
                `)}
            </sutram-stack>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends M{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const e=++this._lastReqId;q.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:i})=>{e===this._lastReqId&&(this._treeData=i||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:e}=X(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),l`
            <sutram-surface variant="ghost" border="bottom" padding="xs">
                <sutram-stack direction="row" align="center" gap="sm">
                    <sutram-btn intent="neutral" ?compact=${!0} icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                    <sutram-scrub-track ?grow=${!0} ?monospace=${!0}>
                        /${t.join("/")}
                    </sutram-scrub-track>
                </sutram-stack>
            </sutram-surface>
            <sutram-stack direction="col" gap="xs" ?flex=${!0} ?scrollable=${!0}>
                ${e.length===0?l`<sutram-empty-state text="No sub-folders available."></sutram-empty-state>`:e.map(i=>l`
                    <sutram-surface variant="inset" padding="xs" ?interactive=${!0}
                        @click=${()=>this._setPath([...t,i.name])}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="folder" size="md" intent="warning"></sutram-icon>
                            <strong>${i.name}</strong>
                        </sutram-stack>
                    </sutram-surface>
                `)}
            </sutram-stack>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends I(dt){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends I(pt){connectedCallback(){super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramFieldCard extends A{static properties={label:{type:String},description:{type:String},scope:{type:String},secure:{type:Boolean}};static styles=[_,C`
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
        .scope-badge {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 8px;
            border-radius: 4px;
            line-height: 1.4;
            white-space: nowrap;
        }
        .scope-badge.primary {
            background: color-mix(in srgb, var(--intent-primary) 18%, transparent);
            color: var(--intent-primary);
            border: 1px solid color-mix(in srgb, var(--intent-primary) 40%, transparent);
        }
        .scope-badge.neutral {
            background: var(--bg);
            color: var(--text-muted);
            border: 1px solid var(--border);
        }
        .scope-badge.highlight {
            background: color-mix(in srgb, var(--intent-highlight) 18%, transparent);
            color: var(--intent-highlight);
            border: 1px solid color-mix(in srgb, var(--intent-highlight) 40%, transparent);
        }
        .scope-badge.warning {
            background: color-mix(in srgb, var(--intent-warning) 18%, transparent);
            color: var(--intent-warning);
            border: 1px solid color-mix(in srgb, var(--intent-warning) 40%, transparent);
        }
    `];constructor(){super(),this.label="",this.description="",this.scope="workspace",this.secure=!1}_renderBadges(){const t=[];this.secure&&t.push(l`<span class="scope-badge warning">secure</span>`);const e=this.scope||"workspace";return e==="daemon"?t.push(l`<span class="scope-badge neutral">daemon</span>`):e==="repo"?t.push(l`<span class="scope-badge highlight">repo</span>`):e!=="none"&&t.push(l`<span class="scope-badge primary">workspace</span>`),l`<div style="display: inline-flex; gap: 6px; align-items: center;"><slot name="header-actions"></slot>${t}</div>`}render(){return l`
            <div class="field-header">
                <span class="field-title">${this.label}</span>${this._renderBadges()}
            </div>
            <slot></slot>
            ${this.description?l`<div class="field-desc">${this.description}</div>`:""}
        `}}customElements.get("sutram-field-card")||customElements.define("sutram-field-card",SutramFieldCard);export class SutramSettingsForm extends A{static properties={extName:{type:String},schema:{type:Array},optionResolver:{attribute:!1},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String},filterQuery:{type:String},hideSaveButton:{type:Boolean},_jsonBuffers:{type:Object}};static styles=[_,C`
        :host { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
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
    `];constructor(){super(),this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo="",this.filterQuery="",this.hideSaveButton=!1,this._jsonBuffers={},this.optionResolver=null}willUpdate(t){(t.has("extName")||t.has("selectedRepo"))&&(this._jsonBuffers={})}_emitFormMutation(t){this.formData=t,this.dispatchEvent(new CustomEvent("sutram-settings-form-changed",{detail:{extName:this.extName,formData:this.formData,repo:this.selectedRepo},bubbles:!0,composed:!0})),this.requestUpdate()}async triggerSave(t){const i=(this.schema||[]).some(r=>r&&r.type!=="hidden"&&r.scope==="repo")&&(this.selectedRepo||this.repos&&this.repos[0])||"",a={...this.formData||{}};return(this.schema||[]).forEach(r=>{if(!r||r.type==="hidden"||r.type==="action")return;const n=a[r.id];r.type==="number"?a[r.id]=n===""||n===null||n===void 0||Number.isNaN(Number(n))?r.default??0:Number(n):r.type==="string_list"?typeof n=="string"?a[r.id]=n.split(",").map(m=>m.trim()).filter(Boolean):Array.isArray(n)||(a[r.id]=Array.isArray(r.default)?r.default:[]):r.type==="intent_map"&&(!n||typeof n!="object"||Array.isArray(n))&&(a[r.id]=r.default&&typeof r.default=="object"?r.default:{})}),this.formData=a,new Promise((r,n)=>{this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,schema:this.schema,formData:a,repo:i,resolve:r,reject:n,originalEvent:t},bubbles:!0,composed:!0}))})}_renderScopeBadge(t){const e=[];t.secure&&e.push(l`<sutram-tag text="secure" intent="warning"></sutram-tag>`);const i=t.scope||"workspace";return i==="daemon"?e.push(l`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`):i==="repo"?e.push(l`<sutram-tag text="repo" intent="highlight"></sutram-tag>`):e.push(l`<sutram-tag text="workspace" intent="primary"></sutram-tag>`),l`<div style="display: inline-flex; gap: 6px; align-items: center;">${e}</div>`}render(){const e=window.ExtensionRegistry?._manifests?.get(this.extName),i=(e?.settingsActions||[]).filter(s=>!s.id.endsWith("_generic_settings")),a=(this.filterQuery||"").trim().toLowerCase(),r=(this.schema||[]).filter(s=>!s||s.type==="hidden"?!1:a?[s.label,s.title,s.id,s.description,s.desc].filter(Boolean).join(" ").toLowerCase().includes(a):!0),n=(this.schema||[]).some(s=>s&&s.type!=="hidden"&&s.scope==="repo"),m=this.selectedRepo||this.repos&&this.repos[0]||"",f=n&&(!this.repos||this.repos.length===0);return l`
            ${n?l`
                <sutram-surface variant="tinted" intent="highlight" padding="sm">
                    <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${!0}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="package" size="md" intent="highlight"></sutram-icon>
                            <strong>Target Repository Scope</strong>
                        </sutram-stack>
                        ${f?l`
                            <sutram-label text="Add a repository in Workspace Manager to configure repository-scoped settings."></sutram-label>
                        `:l`
                            <sutram-select
                                .value=${m}
                                .options=${(this.repos||[]).map(s=>({value:s,label:s}))}
                                ?flush=${!0}
                                ?grow=${!0}
                                @sutram-input-changed=${s=>{this.selectedRepo=s.detail.value,this.dispatchEvent(new CustomEvent("sutram-settings-repo-changed",{detail:{extName:this.extName,repo:s.detail.value},bubbles:!0,composed:!0}))}}>
                            </sutram-select>
                        `}
                    </sutram-stack>
                </sutram-surface>
            `:""}

            ${a?"":i.map(s=>l`
                <sutram-field-card .label=${s.label} scope="workspace">
                    <sutram-async-btn slot="header-actions" label="Open Panel" icon="external-link" intent="primary" ?compact=${!0} .onClick=${async u=>{this.dispatchEvent(new CustomEvent("sutram-settings-custom-action",{detail:{action:{...s,extName:s.extName||this.extName},extName:this.extName,originalEvent:u},bubbles:!0,composed:!0})),s.onClick&&await s.onClick(u)}}></sutram-async-btn>
                </sutram-field-card>
            `)}

            ${r.map(s=>{const u=s.scope==="repo"&&f,c=this.formData&&this.formData[s.id]!==void 0?this.formData[s.id]:s.default,g=s.title||s.label||s.id;let y="";if(s.type==="action")y=l`
                        <sutram-async-btn
                            ?fullWidth=${!0}
                            label=${s.button_label||s.action_label||s.label||"Execute Action"}
                            intent=${s.intent||"primary"}
                            ?disabled=${u}
                            .onClick=${async h=>new Promise((b,v)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:s,resolve:b,reject:v,originalEvent:h},bubbles:!0,composed:!0}))})}>
                        </sutram-async-btn>
                    `;else if(s.type==="boolean")y=l`
                        <sutram-toggle
                            .checked=${!!c}
                            ?disabled=${u}
                            ?flush=${!0}
                            @sutram-input-changed=${h=>this._emitFormMutation({...this.formData,[s.id]:h.detail.value})}>
                        </sutram-toggle>
                    `;else if(s.type==="select"){let h=s.options||[];if(s.options_from&&typeof s.options_from=="object"){const x=s.options_from.field,k=s.options_from.value_key||"id",o=s.options_from.label_key||"title";h=(Array.isArray(this.formData?.[x])?this.formData[x]:[]).filter(p=>p&&typeof p=="object"&&(p[k]||p[o])).map(p=>({value:String(p[k]||p[o]),label:String(p[o]||p[k])}))}const b=h.map(x=>({value:x.value!==void 0?x.value:x,label:x.label||x.title||x.value||x})),v=c!==void 0&&c!==""&&b.some(x=>x.value===c)?c:b[0]?.value??c??"";y=l`
                        <sutram-select
                            .value=${v}
                            .options=${b}
                            ?disabled=${u}
                            ?flush=${!0}
                            @sutram-input-changed=${x=>this._emitFormMutation({...this.formData,[s.id]:x.detail.value})}>
                        </sutram-select>
                    `}else if(s.type==="target_binding"){const h=s.endpoint_source||"compute_endpoints",b=Array.isArray(this.formData?.[h])?this.formData[h]:[],v=x=>typeof this.optionResolver=="function"?this.optionResolver(s,x,this.formData):[];y=l`
                        <sutram-target-binding
                            ?flush=${!0}
                            ?disabled=${u}
                            ?allowEmptyEndpoint=${!!s.allow_empty}
                            .value=${c||{endpoint:"",model:""}}
                            .endpoints=${b}
                            .models=${v}
                            .endpointPlaceholder=${s.endpoint_placeholder||"Select endpoint..."}
                            .modelPlaceholder=${s.placeholder||"Select or type model..."}
                            @sutram-input-changed=${x=>this._emitFormMutation({...this.formData,[s.id]:x.detail.value})}>
                        </sutram-target-binding>
                    `}else if(s.type==="number")y=l`
                        <sutram-input
                            type="number"
                            .value=${c!=null&&!Number.isNaN(c)?String(c):""}
                            ?disabled=${u}
                            ?flush=${!0}
                            @sutram-input-changed=${h=>{const b=h.detail.value,v=b===""?"":Number(b);this._emitFormMutation({...this.formData,[s.id]:Number.isNaN(v)?s.default??0:v})}}>
                        </sutram-input>
                    `;else if(s.type==="intent_map"){const h=Array.isArray(s.intent_legend)&&s.intent_legend.length>0?s.intent_legend:["primary","success","warning","danger","highlight","neutral"],b=typeof c=="object"&&c!==null?c:s.default||{};y=l`
                        <div class="intent-grid">
                            ${h.map(v=>{const x=Array.isArray(b[v])?b[v]:[];return l`
                                    <div class="intent-row">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: var(--intent-${v}); display: flex; align-items: center; gap: 6px;">
                                            ● ${v.toUpperCase()}
                                        </span>
                                        <sutram-input
                                            .value=${x.join(", ")}
                                            placeholder="Comma-separated keywords..."
                                            ?disabled=${u}
                                            ?flush=${!0}
                                            @sutram-input-changed=${k=>{const o=k.detail.value.split(",").map(p=>p.trim()).filter(Boolean),w={...b,[v]:o};this._emitFormMutation({...this.formData,[s.id]:w})}}>
                                        </sutram-input>
                                    </div>
                                `})}
                        </div>
                    `}else if(s.type==="string_list"){const h=Array.isArray(c)?c.join(", "):c||"";y=l`
                        <sutram-input
                            .value=${h}
                            placeholder=${s.placeholder||"Comma-separated values..."}
                            ?disabled=${u}
                            ?flush=${!0}
                            @sutram-input-changed=${b=>{const v=b.detail.value.split(",").map(x=>x.trim()).filter(Boolean);this._emitFormMutation({...this.formData,[s.id]:v})}}>
                        </sutram-input>
                    `}else if(s.type==="object"||s.type==="json"||typeof c=="object"&&c!==null){const h=this._jsonBuffers[s.id]!==void 0?this._jsonBuffers[s.id]:typeof c=="object"&&c!==null?JSON.stringify(c,null,2):c||"";y=l`
                        <sutram-textarea
                            .value=${h}
                            .monospace=${!0}
                            size="wide"
                            ?disabled=${u}
                            ?flush=${!0}
                            @sutram-input-changed=${b=>{this._jsonBuffers={...this._jsonBuffers,[s.id]:b.detail.value};try{const v=JSON.parse(b.detail.value);this._emitFormMutation({...this.formData,[s.id]:v})}catch{this.requestUpdate()}}}>
                        </sutram-textarea>
                    `}else{const h=s.secure&&c==="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",b=s.type==="password"||s.secure?"password":"text";y=l`
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-input
                                type="${b}"
                                ?grow=${!0}
                                .value=${c??""}
                                placeholder=${s.secure?"Enter secret key...":s.placeholder||""}
                                ?disabled=${u}
                                ?flush=${!0}
                                @sutram-input-changed=${v=>this._emitFormMutation({...this.formData,[s.id]:v.detail.value})}>
                            </sutram-input>
                            ${h?l`
                                <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                                <sutram-btn
                                    ?compact=${!0}
                                    intent="danger"
                                    label="Clear"
                                    @click=${()=>this._emitFormMutation({...this.formData,[s.id]:""})}>
                                </sutram-btn>
                            `:""}
                        </sutram-stack>
                    `}return l`
                    <sutram-field-card
                        .label=${g}
                        .description=${s.description||s.desc||""}
                        .scope=${s.scope||"workspace"}
                        ?secure=${!!s.secure}>${y}
                    </sutram-field-card>
                `})}

            ${!this.hideSaveButton&&r.some(s=>s.type!=="action")?l`
                <sutram-async-btn
                    ?fullWidth=${!0}
                    label="Save ${e?.name||this.extName} Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${s=>this.triggerSave(s)}>
                </sutram-async-btn>
            `:""}
        `}}customElements.define("sutram-settings-form",SutramSettingsForm);export class SutramGenericSettingsModal extends A{static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String}};static styles=[_,C`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo=""}openModal(t,e,i,a=[],r=""){this.extName=t,this.schema=e||[],this.formData=i||{},this.repos=a||[],this.selectedRepo=r||this.repos[0]||"",this.open=!0}render(){if(!this.open)return l``;const i=(window.ExtensionRegistry?._manifests?.get(this.extName)?.name||this.extName)+" Settings";return l`
            <sutram-modal
                open
                titleText=${i}
                fullscreen
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
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export const ACTION_CONFIRM_HOLD_MS=900;export class SutramVariantBtn extends A{static properties={setEntry:{type:Object},entityType:{type:String},entityData:{type:Object},compact:{type:Boolean,reflect:!0},executeAction:{attribute:!1},_lastUsedMap:{type:Object,state:!0}};static styles=[_,C`
        :host {
            display: inline-flex;
            align-items: stretch;
            vertical-align: middle;
            flex-shrink: 0;
        }
        .split-group {
            display: inline-flex;
            align-items: stretch;
            border-radius: 8px;
        }
        .split-main {
            display: inline-flex;
            min-width: var(--variant-min-width, max-content);
            --btn-border-radius: 8px 0 0 8px;
        }
        .split-main sutram-async-btn {
            width: 100%;
            min-width: var(--variant-min-width, max-content);
        }
        .split-arrow-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 7px;
            margin: 0;
            border-radius: 0 8px 8px 0;
            border: 1px solid color-mix(in srgb, var(--btn-color, var(--intent-primary)) 40%, transparent);
            border-left: none;
            background: color-mix(in srgb, var(--btn-color, var(--intent-primary)) 15%, transparent);
            color: var(--btn-color, var(--intent-primary));
            cursor: pointer;
            transition: background 0.15s ease;
        }
        .split-arrow-trigger:hover {
            background: color-mix(in srgb, var(--btn-color, var(--intent-primary)) 26%, transparent);
        }
        .split-arrow-trigger--primary { --btn-color: var(--intent-primary); }
        .split-arrow-trigger--success { --btn-color: var(--intent-success); }
        .split-arrow-trigger--warning { --btn-color: var(--intent-warning); }
        .split-arrow-trigger--danger { --btn-color: var(--intent-danger); }
        .split-arrow-trigger--highlight { --btn-color: var(--intent-highlight); }
        .split-arrow-trigger--neutral { --btn-color: var(--intent-neutral); }
    `];constructor(){super(),this.setEntry=null,this.entityType="",this.entityData=null,this.compact=!1,this.executeAction=null,this._lastUsedMap={}}connectedCallback(){super.connectedCallback(),this.subscribe(N,t=>t.lastUsed,t=>{this._lastUsedMap=t||{}}),this._lastUsedMap=N.getState()?.lastUsed||{}}_resolveCurrentDefault(){const t=this.setEntry;if(!t||!Array.isArray(t.variants)||t.variants.length===0)return null;const e=window.ExtensionRegistry||O,i=this.entityType||t.entityType||"file";return e.resolveDefaultVariant(i,t.setId,t.variants)||t.variants[0]}async _runVariant(t,e){if(!t)return;const i=window.ExtensionRegistry||O,a=this.entityType||this.setEntry?.entityType||"file",r=this.setEntry?.setId||t.set,n=t.variantId||t.id;if(r&&n&&typeof i.setLastUsedVariant=="function"&&i.setLastUsedVariant(a,r,n),typeof this.executeAction=="function")return await this.executeAction(t,e);if(typeof i.executeEntityAction=="function")return await i.executeEntityAction(t,this.entityData,e);if(t.asyncAction)return await t.asyncAction(this.entityData,e);if(t.onClick)return t.onClick(this.entityData,e)}_buildDropdownItems(){const t=this.setEntry;if(!t||!Array.isArray(t.variants))return[];const e=[];return(Array.isArray(t.sections)&&t.sections.length>0?t.sections:Array.from(new Set(t.variants.map(a=>a.section||"Actions")))).forEach(a=>{const r=t.variants.filter(n=>(n.section||"Actions")===a);r.length!==0&&(e.push({sectionHeading:a}),r.forEach(n=>{const m=typeof n.label=="function"?n.label(this.entityData):n.label,f=typeof n.icon=="function"?n.icon(this.entityData):n.icon||"";e.push({id:n.id,label:m,icon:f,section:a,successLabel:n.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,keepDrawerOpen:!!n.keepDrawerOpen,keepSelection:!!n.keepSelection,asyncAction:s=>this._runVariant(n,s)})}))}),e}render(){const t=this.setEntry,e=this._resolveCurrentDefault();if(!t||!e)return l``;const i=typeof e.label=="function"?e.label(this.entityData):e.label,a=typeof e.icon=="function"?e.icon(this.entityData):e.icon||t.icon||"",r=typeof e.intent=="function"?e.intent(this.entityData):e.intent||t.intent||"primary",n=e.successLabel||"Done",m=Math.max(Number(t.maxLabelChars)||0,String(i||"").length),f=m>0?`--variant-min-width: calc(${m}ch + 38px);`:"",s=this._buildDropdownItems();return l`
            <div class="split-group" style="${f}" @click=${u=>u.stopPropagation()}>
                <div class="split-main">
                    <sutram-async-btn
                        ?compact=${this.compact}
                        .label=${i}
                        .icon=${a}
                        .successLabel=${n}
                        .keepDrawerOpen=${!!e.keepDrawerOpen}
                        .keepSelection=${!!e.keepSelection}
                        intent="${r}"
                        .onClick=${u=>this._runVariant(e,u)}>
                    </sutram-async-btn>
                </div>
                <sutram-dropdown .items=${s} align="right">
                    <button
                        slot="trigger"
                        type="button"
                        class="split-arrow-trigger split-arrow-trigger--${r}"
                        title="More ${t.label||"options"}">
                        <sutram-icon name="chevron-down" size="xs"></sutram-icon>
                    </button>
                </sutram-dropdown>
            </div>
        `}}customElements.get("sutram-variant-btn")||customElements.define("sutram-variant-btn",SutramVariantBtn);const U=Object.freeze({file:"File",edit:"Edit",share:"Share",vcs:"Source Control",tools:"Tools"});export function computeFitActionCount(d,t=[],e=38,i=6,a=!1){if(!Array.isArray(t)||t.length===0)return 0;const r=Number(d)||0;if(r<=0||!a&&t.reduce((u,c,g)=>u+c+(g>0?i:0),0)<=r)return t.length;const n=Math.max(0,r-e-i);let m=0,f=0;for(let s=0;s<t.length;s++){const u=t[s]+(f>0?i:0);if(m+u<=n)m+=u,f++;else break}return f}export class SutramEntityActions extends A{static properties={entityType:{type:String},entityData:{type:Object},actionsList:{type:Array},variant:{type:String},compact:{type:Boolean,reflect:!0},_containerWidth:{type:Number,state:!0},_overflowClampCount:{type:Number,state:!0}};static styles=[_,C`
        :host {
            display: flex;
            flex-wrap: nowrap;
            gap: 6px;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
        }
        .action-row {
            display: flex;
            flex-wrap: nowrap;
            gap: 6px;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            min-width: 0;
            overflow: hidden;
        }
        .more-trigger-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 30px;
            min-width: 34px;
            padding: 0 8px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--text);
            cursor: pointer;
            font-weight: bold;
            flex-shrink: 0;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .more-trigger-btn:hover {
            background: var(--bg-hover);
            border-color: var(--intent-primary);
        }
        .sync-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            margin: 0;
            padding: var(--btn-padding, 6px 12px);
            font-size: var(--btn-font-size, 0.82rem);
            font-family: inherit;
            font-weight: var(--btn-font-weight, normal);
            border-radius: var(--btn-border-radius, 6px);
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text);
            cursor: pointer;
            white-space: nowrap;
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
        }
        .sync-btn:hover { background: var(--bg-hover); }
    `];constructor(){super(),this.entityType="",this.entityData={},this.actionsList=null,this.variant="row",this.compact=!1,this._containerWidth=0,this._overflowClampCount=null,this._lastRenderedFitCount=0,this._lastClampContextKey=""}connectedCallback(){super.connectedCallback(),this.subscribe(N,t=>t.lastUsed,()=>{this._overflowClampCount=null,this.requestUpdate()}),typeof ResizeObserver<"u"&&(this._rowResizeObserver=new ResizeObserver(t=>{for(const e of t){const i=e.contentRect?e.contentRect.width:this.clientWidth;i>0&&Math.abs(i-this._containerWidth)>2&&(this._containerWidth=i,this._overflowClampCount=null)}}),this._rowResizeObserver.observe(this)),this.clientWidth>0&&(this._containerWidth=this.clientWidth)}updated(t){if(super.updated(t),this.variant==="footer"||this.variant==="menu-bar")return;const e=this.shadowRoot?.querySelector(".action-row");if(!e||e.clientWidth<=0)return;e.scrollWidth>e.clientWidth+1&&this._lastRenderedFitCount>0&&(this._overflowClampCount=this._lastRenderedFitCount-1)}disconnectedCallback(){super.disconnectedCallback(),this._rowResizeObserver&&(this._rowResizeObserver.disconnect(),this._rowResizeObserver=null)}_resolveActions(){if(Array.isArray(this.actionsList))return this.actionsList;const t=window.ExtensionRegistry||O;return!this.entityType||typeof t?.getEntityActions!="function"?[]:t.getEntityActions(this.entityType,this.entityData||{})}_estimateEntryWidth(t){if(t.kind==="variant-set")return Math.max(Number(t.maxLabelChars)||10,8)*7.5+68;const e=typeof t.label=="function"?t.label(this.entityData):t.label||"";return String(e).length*7.5+38}_buildOverflowMenuItems(t,e){const i=[],a=new Map,r=(n,m)=>{a.has(n)||a.set(n,[]),a.get(n).push(m)};return t.forEach(n=>{if(n.kind==="variant-set"&&Array.isArray(n.variants)){const m=n.label||"Options",f=Array.isArray(n.sections)&&n.sections.length>0?n.sections:["Actions"];f.forEach(s=>{const u=f.length>1?`${m} \xB7 ${s}`:m;n.variants.filter(c=>(c.section||"Actions")===s).forEach(c=>{const g=typeof c.label=="function"?c.label(this.entityData):c.label,y=typeof c.icon=="function"?c.icon(this.entityData):c.icon||"";r(u,{id:c.id,label:g,icon:y,successLabel:c.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,keepDrawerOpen:!!c.keepDrawerOpen,keepSelection:!!c.keepSelection,asyncAction:async h=>{const b=window.ExtensionRegistry||O;typeof b?.setLastUsedVariant=="function"&&b.setLastUsedVariant(this.entityType||n.entityType||"file",n.setId,c.variantId||c.id),await e(c,h)}})})})}else{const m=n.group||"tools",f=U[m]||m.charAt(0).toUpperCase()+m.slice(1),s=typeof n.label=="function"?n.label(this.entityData):n.label,u=typeof n.icon=="function"?n.icon(this.entityData):n.icon||"";r(f,{id:n.id,label:s,icon:u,intent:n.intent,successLabel:n.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,keepDrawerOpen:!!n.keepDrawerOpen,keepSelection:!!n.keepSelection,asyncAction:c=>e(n,c)})}}),a.forEach((n,m)=>{if(n.length===0)return;i.push({sectionHeading:m});const f=n.filter(u=>u.intent!=="danger"),s=n.filter(u=>u.intent==="danger");[...f,...s].forEach(u=>i.push(u))}),i}render(){const t=this._resolveActions();if(!t||t.length===0)return"";const e=window.ExtensionRegistry||O,i=async(o,w)=>{const p=Array.isArray(this.actionsList);if(!p&&e?.executeEntityAction)return await e.executeEntityAction(o,this.entityData,w);if(o.asyncAction)return p?await o.asyncAction(w):await o.asyncAction(this.entityData,w);if(o.onClick){const S=p?o.onClick(w):o.onClick(this.entityData,w);return S&&typeof S.then=="function"&&await S,S}};if(this.variant==="menu-bar"){const o={file:[],edit:[],share:[],vcs:[],tools:[]};t.forEach(p=>{const S=p.group&&o[p.group]?p.group:"tools";if(p.kind==="variant-set"&&Array.isArray(p.variants)){const E=p.label||"Options",z=Array.isArray(p.sections)&&p.sections.length>0?p.sections:["Actions"];z.forEach(B=>{const T=p.variants.filter(L=>(L.section||"Actions")===B);if(T.length>0){const L=z.length>1?`${E} \xB7 ${B}`:E;o[S].push({sectionHeading:L}),T.forEach($=>{o[S].push({...$,label:typeof $.label=="function"?$.label(this.entityData):$.label,icon:typeof $.icon=="function"?$.icon(this.entityData):$.icon||"",successLabel:$.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,asyncAction:async J=>{typeof e?.setLastUsedVariant=="function"&&e.setLastUsedVariant(this.entityType||p.entityType||"file",p.setId,$.variantId||$.id),await i($,J)}})})}})}else(o[S].length===0||o[S].every(E=>E.sectionHeading))&&o[S].push({sectionHeading:U[S]}),o[S].push({...p,label:typeof p.label=="function"?p.label(this.entityData):p.label,icon:typeof p.icon=="function"?p.icon(this.entityData):p.icon||"",successLabel:p.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,asyncAction:p.asyncAction?E=>i(p,E):null,onClick:!p.asyncAction&&p.onClick?E=>i(p,E):null})});const w={file:"file-text",edit:"edit-3",share:"share-2",vcs:"git-branch",tools:"wrench"};return l`
                <div class="action-row" style="justify-content: flex-start;">
                    ${Object.keys(o).map(p=>o[p].length===0?"":l`
                            <sutram-dropdown .items=${o[p]} align="left">
                                <button slot="trigger" class="sync-btn">
                                    <sutram-icon name="${w[p]}" size="sm"></sutram-icon>
                                    <span>${U[p]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const a=this.variant==="footer",r=Array.isArray(this.actionsList),n=t.some(o=>o.surfaced!==void 0&&o.surfaced!==null),m=[],f=[];t.forEach(o=>{const w=o.intent==="danger",p=o.surfaced!==void 0&&o.surfaced!==null;a||!w&&(n?p:r||(o.order??99)<20)?m.push(o):f.push(o)});const s=m.map(o=>this._estimateEntryWidth(o)),u=this._containerWidth||this.clientWidth||0,c=f.length>0,g=`${u}:${m.map((o,w)=>`${o.id||o.setId||w}:${s[w]}`).join(",")}`;g!==this._lastClampContextKey&&(this._lastClampContextKey=g,this._overflowClampCount=null);const y=a?m.length:u>0?computeFitActionCount(u,s,38,6,c):m.length,h=!a&&this._overflowClampCount!==null?Math.min(y,this._overflowClampCount):y;this._lastRenderedFitCount=h;const b=m.slice(0,h),v=[...m.slice(h),...f],x=o=>{if(o.kind==="variant-set")return l`
                    <sutram-variant-btn
                        data-testid="action-set-${o.setId||o.set||o.id||"variants"}"
                        ?compact=${!a}
                        .setEntry=${o}
                        .entityType=${this.entityType||o.entityType}
                        .entityData=${this.entityData}
                        .executeAction=${i}>
                    </sutram-variant-btn>
                `;if(o.component)return l`<div style="display: contents;">${o.component(this.entityData)}</div>`;const w=typeof o.label=="function"?o.label(this.entityData):o.label,p=typeof o.icon=="function"?o.icon(this.entityData):o.icon||"",S=typeof o.intent=="function"?o.intent(this.entityData):o.intent||"primary",E=typeof o.isActive=="function"?o.isActive(this.entityData):!!o.isActive,z=o.successLabel||"Done";if(o.asyncAction||o.successLabel||e?.executeEntityAction&&o.vfsBound)return l`
                    <sutram-async-btn
                        data-testid="action-${o.id||"unnamed"}"
                        ?compact=${!a}
                        .label=${w}
                        .icon=${p}
                        .successLabel=${z}
                        .keepDrawerOpen=${!!o.keepDrawerOpen}
                        .keepSelection=${!!o.keepSelection}
                        intent="${S}"
                        ?active=${E}
                        ?grow=${a}
                        ?fullWidth=${a}
                        .onClick=${T=>i(o,T)}>
                    </sutram-async-btn>
                `;const B=async T=>{if(T&&T.stopPropagation(),o.emitEvent){const L=o.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(L.name,{detail:L.detail,bubbles:!0,composed:!0}))}else await i(o,T);o.keepDrawerOpen||this.dispatchEvent(new CustomEvent("yenvui-action-confirmed",{bubbles:!0,composed:!0,detail:{action:o,status:"success",phase:"settled",holdMs:0,keepDrawerOpen:!1,keepSelection:!!o.keepSelection}}))};return l`
                <sutram-btn
                    data-testid="action-${o.id||"unnamed"}"
                    ?compact=${!a}
                    intent=${S}
                    ?active=${E}
                    ?grow=${a}
                    ?fullWidth=${a}
                    .label=${w}
                    .icon=${p}
                    @click=${B}>
                </sutram-btn>
            `},k=v.length>0?this._buildOverflowMenuItems(v,i):[];return l`
            <div class="action-row" @click=${o=>o.stopPropagation()}>
                ${b.map(x)}
                ${k.length>0?l`
                    <sutram-dropdown .items=${k} align="right">
                        <button slot="trigger" type="button" class="more-trigger-btn" title="More actions">
                            <sutram-icon name="more-horizontal" size="sm"></sutram-icon>
                        </button>
                    </sutram-dropdown>
                `:""}
            </div>
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends I(K){static properties={...K.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?D:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,i=>{const a=this._getId();a&&i.selectedItems&&(this.selected=i.selectedItems.has(a))});const t=this._getId(),e=this._getStore();t&&e&&e.getState().selectedItems&&(this.selected=e.getState().selectedItems.has(t))}this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const e=this._getId();if(e&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const i=this._getStore();i&&i.getState().toggleSelection&&i.getState().toggleSelection(e,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:e,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-tier-changed",()=>{this._injectEntityActions()}),this.addEventListener("yenvui-action-confirmed",t=>{!this._overlayActive||this._wideCard||t.detail?.keepDrawerOpen||t.detail?.action?.keepDrawerOpen||t.detail?.item?.keepDrawerOpen||t.detail?.phase==="settled"&&(this._overlayActive=!1)})}updated(t){if((t.has("icon")||t.has("entityData"))&&(this.entityData?.needs_recompile||this.entityData?.is_dirty||this.entityData?.outdated)&&(!this.icon||this.icon==="alert-triangle"||this.icon==="package")&&(this.icon="construction"),super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const e=this._getId(),i=this._getStore();e&&i&&i.getState().selectedItems&&(this.selected=i.getState().selectedItems.has(e))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive")||t.has("_wideCard"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this.hasActions||(this.hasActions=!0),!this.actionsOpen&&!this._wideCard)return;let e=this.querySelector(".sutram-injected-actions");if(e){const i=e.querySelector("sutram-entity-actions");i&&(i.entityType=this.entityType,i.entityData=this.entityData)}else{e=document.createElement("div"),e.className="sutram-injected-actions",e.slot="actions",e.style.display="flex",e.style.flexWrap="nowrap",e.style.gap="6px",e.style.alignItems="center",e.style.justifyContent="flex-end",e.style.width="100%",e.style.minWidth="0",e.addEventListener("click",a=>a.stopPropagation());const i=document.createElement("sutram-entity-actions");i.style.width="100%",i.style.minWidth="0",i.entityType=this.entityType,i.entityData=this.entityData,e.appendChild(i),this.appendChild(e),this.hasActions=!0}}else{const e=this.querySelector(".sutram-injected-actions");e&&e.remove(),this.hasActions&&(this.hasActions=!1)}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends ht{}customElements.get("sutram-card-group")||customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends vt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends xt{}customElements.get("sutram-spinner")||customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends wt{}customElements.get("sutram-empty-state")||customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends St{}customElements.get("sutram-board")||customElements.define("sutram-board",SutramBoard);export class SutramColumn extends kt{}customElements.get("sutram-column")||customElements.define("sutram-column",SutramColumn);export class SutramTag extends Et{}customElements.get("sutram-tag")||customElements.define("sutram-tag",SutramTag);export class SutramLabel extends $t{}customElements.get("sutram-label")||customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends At{}customElements.get("sutram-scrub-track")||customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends Dt{}customElements.get("sutram-scroll-view")||customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends bt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends Ct{constructor(){super(),this.filterFn=(t,e)=>tt(t,e,i=>`${i.label||""} ${i.id||""} ${i.token||""} ${i.badge||""} ${i.description||""} ${i.section||""}`)}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-action-error",t=>{window.dispatchEvent(new CustomEvent("sutram-status-update",{detail:{msg:t.detail?.msg||"Action failed",timeout:4e3,isError:!0}}))})}}customElements.define("sutram-dropdown",SutramDropdown);export class SutramTabs extends It{connectedCallback(){super.connectedCallback(),this._tabsBridged||(this._tabsBridged=!0,this.addEventListener("yenvui-tab-selected",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-tab-selected",{detail:t.detail,bubbles:!0,composed:!0}))}))}}customElements.get("sutram-tabs")||customElements.define("sutram-tabs",SutramTabs);export class SutramFilterDropdown extends _t{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends ft{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{t.stopPropagation(),t.target===this&&this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!1,composed:!1}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends mt{}customElements.get("sutram-category-section")||customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends gt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends yt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as Q}from"./wordcount.js";const Ht=[];export class SutramEditor extends I(j){static properties={...j.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const e=Array.isArray(this.customExtensions)?this.customExtensions.filter(i=>i!==Q):[];this.enableWordcount&&e.push(Q),this.customExtensions=e}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this._lastEmittedValue=t.detail?.value,this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("content-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new Event("input",{bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-selection",t=>{this.dispatchEvent(new CustomEvent("editor-selection",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-scroll",t=>{this.dispatchEvent(new CustomEvent("editor-scroll",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-link-clicked",t=>{this.dispatchEvent(new CustomEvent("editor-link-clicked",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends A{static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[_,C`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const e=++this._lastSearchReq;q.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:i})=>{e===this._lastSearchReq&&(this._filteredItems=(i||[]).slice(0,50))})}}render(){if(!this.open)return l``;const t=this._filteredItems||[];return l`
            <sutram-modal open titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <sutram-stack slot="body" direction="col" gap="sm" ?flex=${!0}>
                    <sutram-input placeholder="Search..." ?flush=${!0} .value=${this._searchQuery} @sutram-input-changed=${e=>this._searchQuery=e.detail.value}></sutram-input>
                    <sutram-stack direction="col" gap="xs" ?flex=${!0} ?scrollable=${!0}>
                        ${t.length===0?l`<sutram-empty-state text="No matches found."></sutram-empty-state>`:t.map(e=>{const i=typeof e=="string"?e:e.label||e;return l`
                                <sutram-surface variant="inset" padding="sm" ?interactive=${!0}
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:e},bubbles:!0,composed:!0}))}}>
                                    <sutram-stack direction="row" align="center" gap="sm">
                                        <sutram-icon name="file" size="sm" intent="primary"></sutram-icon>
                                        <sutram-label ?monospace=${!0} intent="neutral" .text=${i}></sutram-label>
                                    </sutram-stack>
                                </sutram-surface>
                            `})}
                    </sutram-stack>
                </sutram-stack>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends A{static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[_,C`
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
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,e=this.tabs.find(i=>i.id===t)||this.tabs[0];return e&&e.content||""}return this.content||""}render(){const t=this._getActiveContent(),e=this.tabs&&this.tabs.length>1,i=this.activeTab||this.tabs&&this.tabs[0]?.id||"",a=this.suggestedFilename||`report_${Date.now()}.txt`;return l`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: var(--mobile-edge-padding, 15px); gap: 10px;">
                ${this.caption?l`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${e?l`
                    <sutram-stack direction="row" gap="sm">
                        ${this.tabs.map(r=>l`
                            <sutram-btn
                                ?compact=${!0}
                                .icon=${r.icon||"file-text"}
                                .label=${r.label}
                                intent="${i===r.id?"primary":"neutral"}"
                                ?active=${i===r.id}
                                @click=${()=>{this.activeTab=r.id}}>
                            </sutram-btn>
                        `)}
                    </sutram-stack>
                `:""}
                <div class="output-box">${t||"No output."}</div>
                ${this.extraContent?l`<div style="flex-shrink: 0;">${this.extraContent}</div>`:""}
                <sutram-surface variant="panel" padding="xs" align="end">
                    <sutram-entity-actions
                        .entityType=${"text_blob"}
                        .entityData=${{textContent:t,suggestedFilename:a}}>
                    </sutram-entity-actions>
                </sutram-surface>
            </div>
            ${this.actions&&this.actions.length>0?l`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(r=>r.asyncAction?l`
                                <sutram-async-btn
                                    .icon=${r.icon}
                                    .label=${r.label}
                                    intent="${r.intent||"primary"}"
                                    ?grow=${!0}
                                    ?emphasis=${!!r.primary}
                                    ?disabled=${r.disabled}
                                    .onClick=${r.asyncAction}>
                                </sutram-async-btn>
                            `:l`
                            <sutram-btn
                                .icon=${r.icon}
                                .label=${r.label}
                                intent="${r.intent||"neutral"}"
                                ?grow=${!0}
                                ?emphasis=${!!r.primary}
                                ?disabled=${r.disabled}
                                @click=${r.onClick}>
                            </sutram-btn>
                        `)}
                </div>
            `:""}
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends I(Tt){connectedCallback(){super.connectedCallback();const t=e=>{this.mode=e.mode||"auto",this.wrap=e.wrap||"auto"};t(R.getState()),this.subscribe(R,e=>({mode:e.mode,wrap:e.wrap}),t),this.registerGlobalListener("yenvui-diff-mode-changed",this,e=>R.getState().setMode(e.detail?.mode||"auto")),this.registerGlobalListener("yenvui-diff-wrap-changed",this,e=>R.getState().setWrap(e.detail?.wrap||"auto"))}}customElements.define("sutram-diff-viewer",SutramDiffViewer);export class SutramSubtabMenu extends A{static properties={columnId:{type:String},slotConfig:{type:Object},extraContentNodes:{type:Array},_menuItems:{type:Array,state:!0},_selectedCount:{type:Number,state:!0},_refreshState:{type:String,state:!0},_layoutSnap:{type:Object,state:!0}};static styles=[_,C`
        :host { display: flex; align-items: stretch; height: 100%; flex-shrink: 0; }
        .subtab-menu-trigger {
            background: transparent;
            color: var(--text);
            border: none;
            border-right: 1px solid var(--border);
            border-radius: 0;
            cursor: pointer;
            font-weight: bold;
            height: 100%;
            min-height: 44px;
            min-width: 44px;
            width: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            position: relative;
            padding: 0;
            margin: 0;
            transition: background 0.15s ease, opacity 0.15s ease;
        }
        .subtab-menu-trigger:hover:not(:disabled) {
            background: var(--input-bg);
        }
        .subtab-menu-trigger:disabled {
            opacity: 0.35;
            cursor: default;
        }
        .subtab-quick-bar {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr auto auto;
            align-items: center;
            gap: 4px;
            padding: 2px;
            width: 100%;
            box-sizing: border-box;
        }
        .subtab-quick-bar.has-body {
            padding-bottom: 6px;
            margin-bottom: 2px;
            border-bottom: 1px solid var(--border);
        }
        .quick-col-slot {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 36px;
            min-width: 44px;
            padding: 0 8px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg-deep);
            color: var(--text-muted);
            font-family: var(--font-mono, monospace);
            font-size: 0.85rem;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            box-sizing: border-box;
            transition: all 0.15s ease;
        }
        .quick-col-slot:hover {
            background: var(--bg-hover);
            color: var(--text);
            border-color: var(--intent-primary);
        }
        .quick-col-slot.is-active {
            background: color-mix(in srgb, var(--intent-primary) 18%, var(--bg-deep));
            color: var(--intent-primary);
            border-color: var(--intent-primary);
        }
        .quick-col-slot.is-empty {
            opacity: 0.55;
        }
        .quick-bar-divider {
            width: 1px;
            height: 22px;
            background: var(--border);
            margin: 0 2px;
        }
        .quick-refresh-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 36px;
            min-width: 44px;
            padding: 0 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg-deep);
            color: var(--text);
            cursor: pointer;
            box-sizing: border-box;
            transition: all 0.15s ease;
        }
        .quick-refresh-btn:hover:not(:disabled) {
            background: var(--bg-hover);
            border-color: var(--intent-primary);
            color: var(--intent-primary);
        }
        .quick-refresh-btn:disabled {
            opacity: 0.35;
            cursor: default;
        }
        .quick-refresh-btn.is-confirmed {
            border-color: var(--intent-success);
            color: var(--intent-success);
            background: color-mix(in srgb, var(--intent-success) 16%, var(--bg-deep));
        }
        .extra-view-section {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 4px 6px 6px 6px;
        }
        .extra-view-heading {
            font-size: 0.7rem;
            font-weight: 800;
            font-family: var(--font-mono, monospace);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--intent-primary, #8b5cf6);
            padding: 4px 6px 3px 6px;
            border-bottom: 1px solid color-mix(in srgb, var(--intent-primary, #8b5cf6) 28%, transparent);
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
    `];constructor(){super(),this.columnId="",this.slotConfig=null,this.extraContentNodes=[],this._menuItems=[],this._selectedCount=0,this._selectedItems=new Map,this._boundMenuStoresKey="",this._refreshState="idle",this._layoutSnap=null}connectedCallback(){super.connectedCallback(),this.subscribe(D,t=>t.selectedItems||new Map,t=>{this._selectedItems=t,this._rebuildMenu()}),this.subscribe("Layout",t=>({focusedColumn:t?.focusedColumn||"center",mobileViewportIndex:t?.mobileViewportIndex??1,capacity:t?.capacity||3,leftCount:t?.columns?.left?.pinned?.length||0,centerCount:t?.columns?.center?.pinned?.length||0,rightCount:t?.columns?.right?.pinned?.length||0}),t=>{this._layoutSnap=t}),this.subscribe(H,t=>t.isOffline,()=>{this._rebuildMenu()}),this.registerGlobalListener("sutram-subtab-menu-refresh",window,()=>{this._rebuildMenu()}),this._selectedItems=D.getState()?.selectedItems||new Map,this._rebuildMenu()}_bindSlotMenuStores(t=!1){const e=Array.isArray(this.slotConfig?.menuStores)?this.slotConfig.menuStores:[],i=e.join(",");!t&&i===this._boundMenuStoresKey&&this._slotStoreUnsubs&&this._slotStoreUnsubs.length===e.length||(this._slotStoreUnsubs&&this._slotStoreUnsubs.forEach(a=>this.unsubscribe(a)),this._slotStoreUnsubs=[],this._boundMenuStoresKey=i,e.forEach(a=>{const r=this.subscribe(a,()=>{this._rebuildMenu()});this._slotStoreUnsubs.push(r)}))}disconnectedCallback(){super.disconnectedCallback(),this._slotStoreUnsubs=[],this._boundMenuStoresKey=""}willUpdate(t){if(super.willUpdate(t),t.has("slotConfig")){const e=t.get("slotConfig");this._bindSlotMenuStores(),!!(e&&this.slotConfig&&e.id===this.slotConfig.id&&e.bulkActionGroup===this.slotConfig.bulkActionGroup&&e.bulkEntityTypes===this.slotConfig.bulkEntityTypes&&e.menuActions===this.slotConfig.menuActions&&typeof this.slotConfig.menuActions!="function")||this._rebuildMenu()}}_rebuildMenu(){const t=this.slotConfig||{},e=this._selectedItems||new Map,i=Array.from(e.values()),a=Array.isArray(t.bulkEntityTypes)&&t.bulkEntityTypes.length>0?t.bulkEntityTypes:null,r=a?i.filter(u=>String(u?.entityType||"").split(":").some(g=>a.includes(g))):i;this._selectedCount=t.bulkActionGroup?r.length:0;const n=[],m=Y(r);if(t.bulkActionGroup&&r.length>0){const u=window.ExtensionRegistry||O,c=u?.getAggregatableActions?u.getAggregatableActions(r,{group:t.bulkActionGroup}):[];if(c.length>0){let g=null;c.forEach(y=>{if(y.kind==="variant-set"&&Array.isArray(y.variants)){const h=y.label||"Options",b=Array.isArray(y.sections)&&y.sections.length>0?y.sections:["Actions"];b.forEach(v=>{const x=y.variants.filter(o=>(o.section||"Actions")===v);if(x.length===0)return;const k=b.length>1?`${h} \xB7 ${v}`:h;g=k,n.push({sectionHeading:k}),x.forEach(o=>{n.push({...o,isBulkItem:!0,successLabel:o.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,asyncAction:async w=>{typeof u?.setLastUsedVariant=="function"&&u.setLastUsedVariant(y.entityType||m,y.setId,o.variantId||o.id),o.asyncAction?await o.asyncAction(w):o.onClick&&await o.onClick(w)},onClick:null})})})}else g!=="Selection"&&(g="Selection",n.push({sectionHeading:"Selection"})),n.push({...y,isBulkItem:!0})}),g!=="Selection"&&n.push({sectionHeading:"Selection"})}else n.push({sectionHeading:"Selection"});n.push({label:`Clear Selection (${r.length})`,icon:"x",section:"Selection",onClick:()=>D.getState().clearSelection()})}const f=typeof t.menuActions=="function"?t.menuActions(t):Array.isArray(t.menuActions)?t.menuActions:[];let s=null;for(f.forEach(u=>{if(!u)return;if(u.divider){s=null;return}if(u.sectionHeading){s=u.sectionHeading,n.push(u);return}const c=u.section||"View";s!==c&&(s=c,n.push({sectionHeading:c})),n.push({...u,onClick:u.onClick||(u.emitEvent?()=>{const g=typeof u.emitEvent=="function"?u.emitEvent(t):u.emitEvent;typeof g=="string"?window.dispatchEvent(new CustomEvent(g,{bubbles:!0,composed:!0})):g&&g.name&&window.dispatchEvent(new CustomEvent(g.name,{detail:g.detail,bubbles:!0,composed:!0}))}:null)})});n.length>0&&n[n.length-1].divider;)n.pop();this._menuItems=n}_handleQuickColumnJump(t,e,i){i&&i.stopPropagation();const a=new CustomEvent("sutram:column-jump",{detail:{colId:t,colIdx:e},bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(a),!a.defaultPrevented&&window.Sutram?.stores?.Layout){const n=window.Sutram.stores.Layout.getState(),m=n.capacity||1,f=(n.layoutRatios||[1,1,1]).length;n.setMobileViewport?.(Math.max(0,Math.min(e,f-m))),n.setFocusedColumn?.(t)}const r=this.shadowRoot?.querySelector("sutram-dropdown");r&&(r.open=!1)}async _handleQuickRefresh(t){t&&t.stopPropagation();const e=this.slotConfig;if(!(!e||!e.id||e.refreshable===!1||this._refreshState==="loading")){this._refreshState="loading";try{const i={parentId:e.targetParent||null,subId:e.id,promise:null},a=new CustomEvent("sutram:force-refresh",{detail:i,bubbles:!0,composed:!0});(!(typeof this.dispatchEvent=="function"?this.dispatchEvent(a):!1)||!this.isConnected)&&window.dispatchEvent(a),i.promise&&typeof i.promise.then=="function"&&await i.promise,this._refreshState="confirmed",this.registerTimeout(()=>{this._refreshState="idle";const n=this.shadowRoot?.querySelector("sutram-dropdown");n&&(n.open=!1)},ACTION_CONFIRM_HOLD_MS)}catch{this._refreshState="idle"}}}render(){const t=Array.isArray(this.extraContentNodes)?this.extraContentNodes.filter(Boolean):[],e=this._selectedCount||0,i=this.slotConfig||null,a=!!(i&&i.id&&i.refreshable!==!1),r=window.Sutram?.stores?.Layout?.getState?.()||{},n=this._layoutSnap?.focusedColumn||r.focusedColumn||this.columnId||"center",m=this.columnId||n,f=[{id:"left",idx:0,label:"1",title:"Column 1 (Left)",count:r.columns?.left?.pinned?.length??this._layoutSnap?.leftCount??0},{id:"center",idx:1,label:"2",title:"Column 2 (Center)",count:r.columns?.center?.pinned?.length??this._layoutSnap?.centerCount??0},{id:"right",idx:2,label:"3",title:"Column 3 (Right)",count:r.columns?.right?.pinned?.length??this._layoutSnap?.rightCount??0}],s=this._refreshState==="confirmed"?"check":this._refreshState==="loading"?"loader":"refresh-cw",u=this._refreshState==="confirmed"?"success":"current";return l`
            <sutram-dropdown
                align="left"
                .items=${this._menuItems}
                @yenvui-action-confirmed=${c=>{c.detail?.phase==="settled"&&c.detail?.item?.isBulkItem&&!c.detail?.keepSelection&&D.getState().clearSelection()}}>
                <button slot="trigger" type="button" class="subtab-menu-trigger" data-testid="view-menu" @pointerdown=${()=>this._rebuildMenu()} title="${e>0?`View & Bulk Actions (${e} selected)`:"View Menu"}">
                    ${e>0?l`
                        <sutram-icon name="more-vertical" size="sm" intent="warning"></sutram-icon>
                        <span class="subtab-badge">${e>9?"9+":e}</span>
                    `:l`
                        <sutram-icon name="more-vertical" size="sm"></sutram-icon>
                    `}
                </button>
                <div slot="header" class="subtab-quick-bar ${this._menuItems?.length>0||t.length>0?"has-body":""}" @click=${c=>c.stopPropagation()}>
                    ${f.map(c=>{const g=c.id===m,y=c.count===0;return l`
                            <button
                                type="button"
                                class="quick-col-slot ${g?"is-active":""} ${y?"is-empty":""}"
                                title="${c.title}${g?" (Active)":""}"
                                data-testid="column-jump-${c.idx+1}"
                                @click=${h=>this._handleQuickColumnJump(c.id,c.idx,h)}>
                                <span>${c.label}</span>
                            </button>
                        `})}
                    <div class="quick-bar-divider"></div>
                    <button
                        type="button"
                        class="quick-refresh-btn ${this._refreshState==="confirmed"?"is-confirmed":""}"
                        ?disabled=${!a}
                        title="${a?`Refresh ${i.label||"Tab"}`:"No active tab to refresh"}"
                        @click=${c=>this._handleQuickRefresh(c)}>
                        <sutram-icon name="${s}" size="sm" intent="${u}"></sutram-icon>
                    </button>
                </div>
                ${t.length>0?l`
                    <div
                        slot="content"
                        class="extra-view-section"
                        @yenvui-action-confirmed=${c=>{if(c.detail?.phase==="settled"&&!c.detail?.keepDrawerOpen){const g=this.shadowRoot?.querySelector("sutram-dropdown");g&&(g.open=!1)}}}>
                        <div class="extra-view-heading">View Controls</div>
                        ${t}
                    </div>
                `:""}
            </sutram-dropdown>
        `}}customElements.get("sutram-subtab-menu")||customElements.define("sutram-subtab-menu",SutramSubtabMenu);
