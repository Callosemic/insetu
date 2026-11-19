import{LitElement as j,html as l,css as k}from"lit";import{SutramElement as _,SutramContextMixin as A,SelectionStore as D,ToastStore as M,EnvironmentStore as N,VariantDefaultStore as R,ExtensionRegistry as I}from"./sutram_sdk.js";import*as U from"sutram-chassis";import{sharedStyles as $}from"./shared_styles.js";import{resolveDirectoryState as G,fuzzyFilterObjects as q,SutramWorker as F}from"./utils.js";import"./inputs.js";import"lit-virtualizer";import{SutramDagTree as J,SutramFloatingHud as K}from"./chassis_adapter.js";export{J as SutramDagTree,K as SutramFloatingHud};export const REQUIRED_CHASSIS_PRIMITIVES=["Icon","View","Stack","Surface","ActionBar","SidebarLayout","Btn","AsyncBtn","Card","CardGroup","CategorySection","Modal","Window","Tabs","Toolbar","SearchBar","Dropdown","FilterDropdown","Collapsible","Pill","FilterGroup","Tag","Label","Spinner","EmptyState","Board","Column","ScrubTrack","ScrollView","DiffViewer","Editor","Input","Select","Textarea","Toggle"];export function validateChassisContract(c){if(!c||typeof c!="object")throw new Error("[Sutram Boot Error] Invalid or missing chassis provider object.");const t=REQUIRED_CHASSIS_PRIMITIVES.filter(e=>typeof c[e]!="function");if(t.length>0)throw new Error(`[Sutram Boot Error] Chassis '${c.CHASSIS_PROVIDER_META?.name||"Custom"}' fails contract. Missing primitives: ${t.join(", ")}`);return!0}export class SutramUIAdapter{static PASSTHROUGH_MAP=Object.freeze({"sutram-icon":"Icon","sutram-view":"View","sutram-stack":"Stack","sutram-surface":"Surface","sutram-action-bar":"ActionBar","sutram-btn":"Btn","sutram-card-group":"CardGroup","sutram-category-section":"CategorySection","sutram-spinner":"Spinner","sutram-empty-state":"EmptyState","sutram-board":"Board","sutram-column":"Column","sutram-tag":"Tag","sutram-label":"Label","sutram-scrub-track":"ScrubTrack","sutram-scroll-view":"ScrollView","sutram-filter-dropdown":"FilterDropdown","sutram-tabs":"Tabs","sutram-input":"Input","sutram-select":"Select","sutram-textarea":"Textarea","sutram-toggle":"Toggle","sutram-drop-overlay":"DropOverlay","sutram-drop-target":"DropTarget"});static registerChassis(t){validateChassisContract(t),Object.entries(this.PASSTHROUGH_MAP).forEach(([e,s])=>{const r=t[s];typeof r=="function"&&!customElements.get(e)&&customElements.define(e,class extends r{})})}}SutramUIAdapter.registerChassis(U);const{Icon:Q,View:Z,Stack:X,Surface:tt,ActionBar:et,SidebarLayout:st,Btn:it,AsyncBtn:Y,StatusBar:V,ToastContainer:nt,Modal:at,Window:rt,CategorySection:ot,Card:P,CardGroup:lt,Editor:z,Toolbar:ct,Collapsible:ut,Pill:dt,FilterGroup:pt,SelectionTray:Ot,SearchBar:mt,Spinner:ht,EmptyState:bt,Board:ft,Column:gt,Tag:yt,Label:vt,Dropdown:xt,FilterDropdown:wt,ScrubTrack:Et,ScrollView:St,DiffViewer:kt,Tabs:$t}=U;z&&(z.languageResolver=async c=>window.ExtensionRegistry&&typeof window.ExtensionRegistry.executeUIHook=="function"?await window.ExtensionRegistry.executeUIHook("sutram:vendorize-language",c):window.Sutram&&typeof window.Sutram.vendorizeLanguage=="function"?await window.Sutram.vendorizeLanguage(c):null);export class SutramVirtualList extends j{static properties={items:{type:Array},renderItem:{type:Object},keyFunction:{type:Object},flush:{type:Boolean,reflect:!0}};static styles=k`
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
        @container (max-width: 480px) {
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
        @container (max-width: 480px) {
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
    `;constructor(){super(),this.items=[],this.renderItem=null,this.keyFunction=(t,e)=>{if(!t)return e;if(typeof t=="string")return t;const s=t.type||t.entityType||"item",r=t.canonicalUri||t.fullPath||t.filepath||t.id||t.name||e;return`${s}::${r}`}}connectedCallback(){super.connectedCallback(),this.setAttribute("data-virtual-list","")}render(){return!this.items||this.items.length===0?l``:l`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .keyFunction=${this.keyFunction}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramIcon extends Q{}customElements.get("sutram-icon")||customElements.define("sutram-icon",SutramIcon);export class SutramView extends Z{connectedCallback(){super.connectedCallback(),this._zenBridged||(this._zenBridged=!0,this.addEventListener("yenvui-view-exit-zen",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-view-exit-zen",{bubbles:!0,composed:!0}))}))}}customElements.get("sutram-view")||customElements.define("sutram-view",SutramView);export class SutramStack extends X{}customElements.get("sutram-stack")||customElements.define("sutram-stack",SutramStack);export class SutramSurface extends tt{}customElements.get("sutram-surface")||customElements.define("sutram-surface",SutramSurface);export class SutramActionBar extends et{}customElements.get("sutram-action-bar")||customElements.define("sutram-action-bar",SutramActionBar);export class SutramSidebarLayout extends st{connectedCallback(){super.connectedCallback(),this._sidebarBridged||(this._sidebarBridged=!0,this.addEventListener("yenvui-nav-selected",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-nav-selected",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-drawer-closed",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-drawer-closed",{bubbles:!0,composed:!0}))}))}}customElements.get("sutram-sidebar-layout")||customElements.define("sutram-sidebar-layout",SutramSidebarLayout);export class SutramBtn extends it{}customElements.get("sutram-btn")||customElements.define("sutram-btn",SutramBtn);export class SutramProjectionWindowControls extends _{static properties={filepath:{type:String},projectionId:{type:String},beforeAction:{attribute:!1}};static styles=[$,k`:host { display: inline-flex; align-items: center; }`];_getTargetId(){return this.projectionId||this.filepath||""}render(){const t=this._getTargetId();if(!t)return l``;const e=typeof window<"u"&&new URLSearchParams(window.location.search).get("popout")==="true",s=window.Sutram?.stores?.Layout?.getState?.();return e?l`
                <sutram-btn
                    ?compact=${!0}
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),s&&typeof s.dockInProjection=="function"&&await s.dockInProjection(t)}}>
                </sutram-btn>
            `:(s&&typeof s.canPopout=="function"?s.canPopout():!0)?l`
                <sutram-btn
                    ?compact=${!0}
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),s&&typeof s.dockInProjection=="function"&&await s.popoutProjection(t)}}>
                </sutram-btn>
            `:l``}}customElements.get("sutram-projection-window-controls")||customElements.define("sutram-projection-window-controls",SutramProjectionWindowControls);export class SutramAsyncBtn extends A(Y){static properties={...Y.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(N,t=>{if(t.isOffline){let e=this,s=null;for(;e;){if(e.dataset&&e.dataset.ext){s=e.dataset.ext;break}e=e.getRootNode().host||e.parentElement}const r=s&&window.ExtensionRegistry?.getExtension(s)?.offline_mode;this._isOfflineReadOnly=r==="read_only"||r==="none"||!r}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.jobRoute&&typeof window.ExtensionRegistry?.executeJobAction=="function"){this.status="loading";try{const e=typeof this.jobPayload=="function"?await this.jobPayload(t):this.jobPayload||{};await window.ExtensionRegistry.executeJobAction(this.jobRoute,e,{onProgress:(r,a)=>{this.onJobProgress&&this.onJobProgress(r,a)},onComplete:r=>{this.onJobComplete&&this.onJobComplete(r),this._completeWithConfirmation()},onError:r=>{this.status="error",this.onJobError&&this.onJobError(r),this.registerTimeout(()=>{this.status="idle"},2e3)}})(t);return}catch(e){if(this.status="error",typeof this.onJobError=="function")try{this.onJobError(e)}catch{}console.error("[SutramAsyncBtn] Job dispatch error:",e),this.registerTimeout(()=>{this.status="idle"},2e3);return}}return super._handleClick(t)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends A(V){static properties={...V.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends A(nt){connectedCallback(){super.connectedCallback(),this.subscribe(M,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{M.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends _{static properties={selectedItems:{type:Object},modalOpen:{type:Boolean},trayTitle:{type:String},itemBadge:{type:String}};static styles=[$,k`
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
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1,this.trayTitle="Selection Tray",this.itemBadge="ITEM"}connectedCallback(){super.connectedCallback(),this.subscribe(D,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1)}),this.selectedItems=D.getState().selectedItems}render(){const t=this.selectedItems.size,e=Array.from(this.selectedItems.values());let s=0,r=!1;const a=window.ExtensionRegistry;e.forEach(d=>{const i=d.data?.size_bytes||(a?.executeUIHook?a.executeUIHook("sutram:resolve-item-size",d.data):null);i?s+=i:r=!0});let n="";s>0?n=`~${Math.round(s/1024)} kb${r?"+":""}`:r&&(n="Calculated on compile");let h=[];return a&&typeof a.getAggregatableActions=="function"&&(h=a.getAggregatableActions(e,{group:"share"})),l`
            ${t>0?l`
                <button class="cart-btn" @click=${()=>this.modalOpen=!0}>
                    <sutram-icon name="zap" size="sm"></sutram-icon>
                    <span class="cart-text">${t} items</span>
                    <span class="cart-badge mobile-only">${t}</span>
                </button>
            `:""}

            <div class="tray-overlay ${this.modalOpen?"open":""}" @click=${()=>this.modalOpen=!1}></div>
            <div class="tray-panel ${this.modalOpen?"open":""}">
                <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">SELECTION STAGING</span>
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">${this.trayTitle||"Selection Tray"} <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${n?l`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n}</span>`:""}
                    </div>
                    <button type="button" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 1.1rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${e.map(d=>{const i=d.data?.filepath||d.data?.folderpath||d.data?.id||"",p=String(i).replace(/\/+$/,""),u=d.data?.titleText||p.split("/").pop()||"Unknown Item",E=d.key||i,v=d.data?.size_bytes||(a?.executeUIHook?a.executeUIHook("sutram:resolve-item-size",d.data):null),f=v?`${Math.round(v/1024)} kb`:"";return l`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">${this.itemBadge||"ITEM"}</span> ${u}</div>${f?l`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${f}</span>`:""}
                                </div>
                                <div class="tray-item-path">${i}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>D.getState().toggleSelection(E,d.entityType,d.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{D.getState().clearSelection(),this.modalOpen=!1}}></sutram-async-btn>
                    <div style="flex: 1 1 0%; min-width: 0; display: flex; justify-content: flex-end;">
                        <sutram-entity-actions
                            .actionsList=${h}
                            .entityType=${e.length===1&&e[0]?.entityType||"bulk"}
                            .entityData=${e}>
                        </sutram-entity-actions>
                    </div>
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends j{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[$];render(){if(!this.items||this.items.length===0)return l``;const t={};this.items.forEach(s=>{const r=s[this.categoryKey]||"Uncategorized";t[r]||(t[r]=[]),t[r].push(s)});const e=Object.keys(t).sort((s,r)=>{const a=this.categoryOrder||[];let n=a.indexOf(s),h=a.indexOf(r);return n===-1&&(n=999),h===-1&&(h=999),n!==h?n-h:s.localeCompare(r)});return l`
            <sutram-stack direction="col" gap="none">
                ${e.map(s=>l`
                    <sutram-category-section titleText=${s}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(s):""}
                        <sutram-card-group>
                            ${t[s].map(r=>this.renderItem(r))}
                        </sutram-card-group>
                    </sutram-category-section>
                `)}
            </sutram-stack>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends j{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const e=++this._lastReqId;F.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:s})=>{e===this._lastReqId&&(this._treeData=s||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:e}=G(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),l`
            <sutram-surface variant="ghost" border="bottom" padding="xs">
                <sutram-stack direction="row" align="center" gap="sm">
                    <sutram-btn intent="neutral" ?compact=${!0} icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                    <sutram-scrub-track ?grow=${!0} ?monospace=${!0}>
                        /${t.join("/")}
                    </sutram-scrub-track>
                </sutram-stack>
            </sutram-surface>
            <sutram-stack direction="col" gap="xs" ?flex=${!0} ?scrollable=${!0}>
                ${e.length===0?l`<sutram-empty-state text="No sub-folders available."></sutram-empty-state>`:e.map(s=>l`
                    <sutram-surface variant="inset" padding="xs" ?interactive=${!0}
                        @click=${()=>this._setPath([...t,s.name])}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="folder" size="md" intent="warning"></sutram-icon>
                            <strong>${s.name}</strong>
                        </sutram-stack>
                    </sutram-surface>
                `)}
            </sutram-stack>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends A(at){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends A(rt){connectedCallback(){super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramFieldCard extends _{static properties={label:{type:String},description:{type:String},scope:{type:String},secure:{type:Boolean}};static styles=[$,k`
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
        `}}customElements.get("sutram-field-card")||customElements.define("sutram-field-card",SutramFieldCard);export class SutramSettingsForm extends _{static properties={extName:{type:String},schema:{type:Array},optionResolver:{attribute:!1},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String},filterQuery:{type:String},hideSaveButton:{type:Boolean},_jsonBuffers:{type:Object}};static styles=[$,k`
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
    `];constructor(){super(),this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo="",this.filterQuery="",this.hideSaveButton=!1,this._jsonBuffers={},this.optionResolver=null}willUpdate(t){(t.has("extName")||t.has("selectedRepo"))&&(this._jsonBuffers={})}_emitFormMutation(t){this.formData=t,this.dispatchEvent(new CustomEvent("sutram-settings-form-changed",{detail:{extName:this.extName,formData:this.formData,repo:this.selectedRepo},bubbles:!0,composed:!0})),this.requestUpdate()}async triggerSave(t){const s=(this.schema||[]).some(a=>a&&a.type!=="hidden"&&a.scope==="repo")&&(this.selectedRepo||this.repos&&this.repos[0])||"",r={...this.formData||{}};return(this.schema||[]).forEach(a=>{if(!a||a.type==="hidden"||a.type==="action")return;const n=r[a.id];a.type==="number"?r[a.id]=n===""||n===null||n===void 0||Number.isNaN(Number(n))?a.default??0:Number(n):a.type==="string_list"?typeof n=="string"?r[a.id]=n.split(",").map(h=>h.trim()).filter(Boolean):Array.isArray(n)||(r[a.id]=Array.isArray(a.default)?a.default:[]):a.type==="intent_map"&&(!n||typeof n!="object"||Array.isArray(n))&&(r[a.id]=a.default&&typeof a.default=="object"?a.default:{})}),this.formData=r,new Promise((a,n)=>{this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,schema:this.schema,formData:r,repo:s,resolve:a,reject:n,originalEvent:t},bubbles:!0,composed:!0}))})}_renderScopeBadge(t){const e=[];t.secure&&e.push(l`<sutram-tag text="secure" intent="warning"></sutram-tag>`);const s=t.scope||"workspace";return s==="daemon"?e.push(l`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`):s==="repo"?e.push(l`<sutram-tag text="repo" intent="highlight"></sutram-tag>`):e.push(l`<sutram-tag text="workspace" intent="primary"></sutram-tag>`),l`<div style="display: inline-flex; gap: 6px; align-items: center;">${e}</div>`}render(){const e=window.ExtensionRegistry?._manifests?.get(this.extName),s=(e?.settingsActions||[]).filter(i=>!i.id.endsWith("_generic_settings")),r=(this.filterQuery||"").trim().toLowerCase(),a=(this.schema||[]).filter(i=>!i||i.type==="hidden"?!1:r?[i.label,i.title,i.id,i.description,i.desc].filter(Boolean).join(" ").toLowerCase().includes(r):!0),n=(this.schema||[]).some(i=>i&&i.type!=="hidden"&&i.scope==="repo"),h=this.selectedRepo||this.repos&&this.repos[0]||"",d=n&&(!this.repos||this.repos.length===0);return l`
            ${n?l`
                <sutram-surface variant="tinted" intent="highlight" padding="sm">
                    <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${!0}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="package" size="md" intent="highlight"></sutram-icon>
                            <strong>Target Repository Scope</strong>
                        </sutram-stack>
                        ${d?l`
                            <sutram-label text="Add a repository in Workspace Manager to configure repository-scoped settings."></sutram-label>
                        `:l`
                            <sutram-select
                                .value=${h}
                                .options=${(this.repos||[]).map(i=>({value:i,label:i}))}
                                ?flush=${!0}
                                ?grow=${!0}
                                @sutram-input-changed=${i=>{this.selectedRepo=i.detail.value,this.dispatchEvent(new CustomEvent("sutram-settings-repo-changed",{detail:{extName:this.extName,repo:i.detail.value},bubbles:!0,composed:!0}))}}>
                            </sutram-select>
                        `}
                    </sutram-stack>
                </sutram-surface>
            `:""}

            ${r?"":s.map(i=>l`
                <sutram-field-card .label=${i.label} scope="workspace">
                    <sutram-async-btn slot="header-actions" label="Open Panel" icon="external-link" intent="primary" ?compact=${!0} .onClick=${async p=>{this.dispatchEvent(new CustomEvent("sutram-settings-custom-action",{detail:{action:{...i,extName:i.extName||this.extName},extName:this.extName,originalEvent:p},bubbles:!0,composed:!0})),i.onClick&&await i.onClick(p)}}></sutram-async-btn>
                </sutram-field-card>
            `)}

            ${a.map(i=>{const p=i.scope==="repo"&&d,u=this.formData&&this.formData[i.id]!==void 0?this.formData[i.id]:i.default,E=i.title||i.label||i.id;let v="";if(i.type==="action")v=l`
                        <sutram-async-btn
                            ?fullWidth=${!0}
                            label=${i.button_label||i.action_label||i.label||"Execute Action"}
                            intent=${i.intent||"primary"}
                            ?disabled=${p}
                            .onClick=${async f=>new Promise((g,b)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:i,resolve:g,reject:b,originalEvent:f},bubbles:!0,composed:!0}))})}>
                        </sutram-async-btn>
                    `;else if(i.type==="boolean")v=l`
                        <sutram-toggle
                            .checked=${!!u}
                            ?disabled=${p}
                            ?flush=${!0}
                            @sutram-input-changed=${f=>this._emitFormMutation({...this.formData,[i.id]:f.detail.value})}>
                        </sutram-toggle>
                    `;else if(i.type==="select"){let f=i.options||[];if(i.options_from&&typeof i.options_from=="object"){const o=i.options_from.field,w=i.options_from.value_key||"id",m=i.options_from.label_key||"title";f=(Array.isArray(this.formData?.[o])?this.formData[o]:[]).filter(y=>y&&typeof y=="object"&&(y[w]||y[m])).map(y=>({value:String(y[w]||y[m]),label:String(y[m]||y[w])}))}const g=f.map(o=>({value:o.value!==void 0?o.value:o,label:o.label||o.title||o.value||o})),b=u!==void 0&&u!==""&&g.some(o=>o.value===u)?u:g[0]?.value??u??"";v=l`
                        <sutram-select
                            .value=${b}
                            .options=${g}
                            ?disabled=${p}
                            ?flush=${!0}
                            @sutram-input-changed=${o=>this._emitFormMutation({...this.formData,[i.id]:o.detail.value})}>
                        </sutram-select>
                    `}else if(i.type==="target_binding"){const f=i.endpoint_source||"compute_endpoints",g=Array.isArray(this.formData?.[f])?this.formData[f]:[],b=o=>typeof this.optionResolver=="function"?this.optionResolver(i,o,this.formData):[];v=l`
                        <sutram-target-binding
                            ?flush=${!0}
                            ?disabled=${p}
                            ?allowEmptyEndpoint=${!!i.allow_empty}
                            .value=${u||{endpoint:"",model:""}}
                            .endpoints=${g}
                            .models=${b}
                            .endpointPlaceholder=${i.endpoint_placeholder||"Select endpoint..."}
                            .modelPlaceholder=${i.placeholder||"Select or type model..."}
                            @sutram-input-changed=${o=>this._emitFormMutation({...this.formData,[i.id]:o.detail.value})}>
                        </sutram-target-binding>
                    `}else if(i.type==="number")v=l`
                        <sutram-input
                            type="number"
                            .value=${u!=null&&!Number.isNaN(u)?String(u):""}
                            ?disabled=${p}
                            ?flush=${!0}
                            @sutram-input-changed=${f=>{const g=f.detail.value,b=g===""?"":Number(g);this._emitFormMutation({...this.formData,[i.id]:Number.isNaN(b)?i.default??0:b})}}>
                        </sutram-input>
                    `;else if(i.type==="intent_map"){const f=Array.isArray(i.intent_legend)&&i.intent_legend.length>0?i.intent_legend:["primary","success","warning","danger","highlight","neutral"],g=typeof u=="object"&&u!==null?u:i.default||{};v=l`
                        <div class="intent-grid">
                            ${f.map(b=>{const o=Array.isArray(g[b])?g[b]:[];return l`
                                    <div class="intent-row">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: var(--intent-${b}); display: flex; align-items: center; gap: 6px;">
                                            ● ${b.toUpperCase()}
                                        </span>
                                        <sutram-input
                                            .value=${o.join(", ")}
                                            placeholder="Comma-separated keywords..."
                                            ?disabled=${p}
                                            ?flush=${!0}
                                            @sutram-input-changed=${w=>{const m=w.detail.value.split(",").map(y=>y.trim()).filter(Boolean),x={...g,[b]:m};this._emitFormMutation({...this.formData,[i.id]:x})}}>
                                        </sutram-input>
                                    </div>
                                `})}
                        </div>
                    `}else if(i.type==="string_list"){const f=Array.isArray(u)?u.join(", "):u||"";v=l`
                        <sutram-input
                            .value=${f}
                            placeholder=${i.placeholder||"Comma-separated values..."}
                            ?disabled=${p}
                            ?flush=${!0}
                            @sutram-input-changed=${g=>{const b=g.detail.value.split(",").map(o=>o.trim()).filter(Boolean);this._emitFormMutation({...this.formData,[i.id]:b})}}>
                        </sutram-input>
                    `}else if(i.type==="object"||i.type==="json"||typeof u=="object"&&u!==null){const f=this._jsonBuffers[i.id]!==void 0?this._jsonBuffers[i.id]:typeof u=="object"&&u!==null?JSON.stringify(u,null,2):u||"";v=l`
                        <sutram-textarea
                            .value=${f}
                            .monospace=${!0}
                            size="wide"
                            ?disabled=${p}
                            ?flush=${!0}
                            @sutram-input-changed=${g=>{this._jsonBuffers={...this._jsonBuffers,[i.id]:g.detail.value};try{const b=JSON.parse(g.detail.value);this._emitFormMutation({...this.formData,[i.id]:b})}catch{this.requestUpdate()}}}>
                        </sutram-textarea>
                    `}else{const f=i.secure&&u==="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",g=i.type==="password"||i.secure?"password":"text";v=l`
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-input
                                type="${g}"
                                ?grow=${!0}
                                .value=${u??""}
                                placeholder=${i.secure?"Enter secret key...":i.placeholder||""}
                                ?disabled=${p}
                                ?flush=${!0}
                                @sutram-input-changed=${b=>this._emitFormMutation({...this.formData,[i.id]:b.detail.value})}>
                            </sutram-input>
                            ${f?l`
                                <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                                <sutram-btn
                                    ?compact=${!0}
                                    intent="danger"
                                    label="Clear"
                                    @click=${()=>this._emitFormMutation({...this.formData,[i.id]:""})}>
                                </sutram-btn>
                            `:""}
                        </sutram-stack>
                    `}return l`
                    <sutram-field-card
                        .label=${E}
                        .description=${i.description||i.desc||""}
                        .scope=${i.scope||"workspace"}
                        ?secure=${!!i.secure}>${v}
                    </sutram-field-card>
                `})}

            ${!this.hideSaveButton&&a.some(i=>i.type!=="action")?l`
                <sutram-async-btn
                    ?fullWidth=${!0}
                    label="Save ${e?.name||this.extName} Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${i=>this.triggerSave(i)}>
                </sutram-async-btn>
            `:""}
        `}}customElements.define("sutram-settings-form",SutramSettingsForm);export class SutramGenericSettingsModal extends _{static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String}};static styles=[$,k`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo=""}openModal(t,e,s,r=[],a=""){this.extName=t,this.schema=e||[],this.formData=s||{},this.repos=r||[],this.selectedRepo=a||this.repos[0]||"",this.open=!0}render(){if(!this.open)return l``;const s=(window.ExtensionRegistry?._manifests?.get(this.extName)?.name||this.extName)+" Settings";return l`
            <sutram-modal
                open
                titleText=${s}
                fullscreen
                @sutram-modal-closed=${r=>{r.target===r.currentTarget&&(this.open=!1)}}>
                <div slot="body">
                    <sutram-settings-form
                        .extName=${this.extName}
                        .schema=${this.schema}
                        .formData=${this.formData}
                        .repos=${this.repos}
                        .selectedRepo=${this.selectedRepo}
                        ?hideSaveButton=${!0}
                        @sutram-settings-form-changed=${r=>{this.formData=r.detail.formData}}>
                    </sutram-settings-form>
                </div>
                <sutram-async-btn
                    slot="footer"
                    label="Save Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${async r=>{const a=this.shadowRoot.querySelector("sutram-settings-form");a&&await a.triggerSave(r),this.open=!1}}>
                </sutram-async-btn>
            </sutram-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export const ACTION_CONFIRM_HOLD_MS=900;export class SutramVariantBtn extends _{static properties={setEntry:{type:Object},entityType:{type:String},entityData:{type:Object},compact:{type:Boolean,reflect:!0},executeAction:{attribute:!1},_lastUsedMap:{type:Object,state:!0}};static styles=[$,k`
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
    `];constructor(){super(),this.setEntry=null,this.entityType="",this.entityData=null,this.compact=!1,this.executeAction=null,this._lastUsedMap={}}connectedCallback(){super.connectedCallback(),this.subscribe(R,t=>t.lastUsed,t=>{this._lastUsedMap=t||{}}),this._lastUsedMap=R.getState()?.lastUsed||{}}_resolveCurrentDefault(){const t=this.setEntry;if(!t||!Array.isArray(t.variants)||t.variants.length===0)return null;const e=window.ExtensionRegistry||I,s=this.entityType||t.entityType||"file";return e.resolveDefaultVariant(s,t.setId,t.variants)||t.variants[0]}async _runVariant(t,e){if(!t)return;const s=window.ExtensionRegistry||I,r=this.entityType||this.setEntry?.entityType||"file",a=this.setEntry?.setId||t.set,n=t.variantId||t.id;if(a&&n&&typeof s.setLastUsedVariant=="function"&&s.setLastUsedVariant(r,a,n),typeof this.executeAction=="function")return await this.executeAction(t,e);if(typeof s.executeEntityAction=="function")return await s.executeEntityAction(t,this.entityData,e);if(t.asyncAction)return await t.asyncAction(this.entityData,e);if(t.onClick)return t.onClick(this.entityData,e)}_buildDropdownItems(){const t=this.setEntry;if(!t||!Array.isArray(t.variants))return[];const e=[];return(Array.isArray(t.sections)&&t.sections.length>0?t.sections:Array.from(new Set(t.variants.map(r=>r.section||"Actions")))).forEach(r=>{const a=t.variants.filter(n=>(n.section||"Actions")===r);a.length!==0&&(e.push({sectionHeading:r}),a.forEach(n=>{const h=typeof n.label=="function"?n.label(this.entityData):n.label,d=typeof n.icon=="function"?n.icon(this.entityData):n.icon||"";e.push({id:n.id,label:h,icon:d,section:r,successLabel:n.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,keepDrawerOpen:!!n.keepDrawerOpen,asyncAction:i=>this._runVariant(n,i)})}))}),e}render(){const t=this.setEntry,e=this._resolveCurrentDefault();if(!t||!e)return l``;const s=typeof e.label=="function"?e.label(this.entityData):e.label,r=typeof e.icon=="function"?e.icon(this.entityData):e.icon||t.icon||"",a=typeof e.intent=="function"?e.intent(this.entityData):e.intent||t.intent||"primary",n=e.successLabel||"Done",h=Math.max(Number(t.maxLabelChars)||0,String(s||"").length),d=h>0?`--variant-min-width: calc(${h}ch + 38px);`:"",i=this._buildDropdownItems();return l`
            <div class="split-group" style="${d}" @click=${p=>p.stopPropagation()}>
                <div class="split-main">
                    <sutram-async-btn
                        ?compact=${this.compact}
                        .label=${s}
                        .icon=${r}
                        .successLabel=${n}
                        intent="${a}"
                        .onClick=${p=>this._runVariant(e,p)}>
                    </sutram-async-btn>
                </div>
                <sutram-dropdown .items=${i} align="right">
                    <button
                        slot="trigger"
                        type="button"
                        class="split-arrow-trigger split-arrow-trigger--${a}"
                        title="More ${t.label||"options"}">
                        <sutram-icon name="chevron-down" size="xs"></sutram-icon>
                    </button>
                </sutram-dropdown>
            </div>
        `}}customElements.get("sutram-variant-btn")||customElements.define("sutram-variant-btn",SutramVariantBtn);const B=Object.freeze({file:"File",edit:"Edit",share:"Share",vcs:"Source Control",tools:"Tools"});export function computeFitActionCount(c,t=[],e=38,s=6,r=!1){if(!Array.isArray(t)||t.length===0)return 0;const a=Number(c)||0;if(a<=0||!r&&t.reduce((p,u,E)=>p+u+(E>0?s:0),0)<=a)return t.length;const n=Math.max(0,a-e-s);let h=0,d=0;for(let i=0;i<t.length;i++){const p=t[i]+(d>0?s:0);if(h+p<=n)h+=p,d++;else break}return d}export class SutramEntityActions extends _{static properties={entityType:{type:String},entityData:{type:Object},actionsList:{type:Array},variant:{type:String},compact:{type:Boolean,reflect:!0},_containerWidth:{type:Number,state:!0}};static styles=[$,k`
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
    `];constructor(){super(),this.entityType="",this.entityData={},this.actionsList=null,this.variant="row",this.compact=!1,this._containerWidth=0}connectedCallback(){super.connectedCallback(),this.subscribe(R,t=>t.lastUsed,()=>{this.requestUpdate()}),typeof ResizeObserver<"u"&&(this._rowResizeObserver=new ResizeObserver(t=>{for(const e of t){const s=e.contentRect?e.contentRect.width:this.clientWidth;s>0&&Math.abs(s-this._containerWidth)>2&&(this._containerWidth=s)}}),this._rowResizeObserver.observe(this)),this.clientWidth>0&&(this._containerWidth=this.clientWidth)}disconnectedCallback(){super.disconnectedCallback(),this._rowResizeObserver&&(this._rowResizeObserver.disconnect(),this._rowResizeObserver=null)}_resolveActions(){if(Array.isArray(this.actionsList))return this.actionsList;const t=window.ExtensionRegistry||I;return!this.entityType||typeof t?.getEntityActions!="function"?[]:t.getEntityActions(this.entityType,this.entityData||{})}_estimateEntryWidth(t){if(t.kind==="variant-set")return Math.max(Number(t.maxLabelChars)||10,8)*7.5+68;const e=typeof t.label=="function"?t.label(this.entityData):t.label||"";return String(e).length*7.5+38}_buildOverflowMenuItems(t,e){const s=[],r=new Map,a=(n,h)=>{r.has(n)||r.set(n,[]),r.get(n).push(h)};return t.forEach(n=>{if(n.kind==="variant-set"&&Array.isArray(n.variants)){const h=n.label||"Options",d=Array.isArray(n.sections)&&n.sections.length>0?n.sections:["Actions"];d.forEach(i=>{const p=d.length>1?`${h} \xB7 ${i}`:h;n.variants.filter(u=>(u.section||"Actions")===i).forEach(u=>{const E=typeof u.label=="function"?u.label(this.entityData):u.label,v=typeof u.icon=="function"?u.icon(this.entityData):u.icon||"";a(p,{id:u.id,label:E,icon:v,successLabel:u.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,keepDrawerOpen:!!u.keepDrawerOpen,asyncAction:async f=>{const g=window.ExtensionRegistry||I;typeof g?.setLastUsedVariant=="function"&&g.setLastUsedVariant(this.entityType||n.entityType||"file",n.setId,u.variantId||u.id),await e(u,f)}})})})}else{const h=n.group||"tools",d=B[h]||h.charAt(0).toUpperCase()+h.slice(1),i=typeof n.label=="function"?n.label(this.entityData):n.label,p=typeof n.icon=="function"?n.icon(this.entityData):n.icon||"";a(d,{id:n.id,label:i,icon:p,intent:n.intent,successLabel:n.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,keepDrawerOpen:!!n.keepDrawerOpen,asyncAction:u=>e(n,u)})}}),r.forEach((n,h)=>{if(n.length===0)return;s.push({sectionHeading:h});const d=n.filter(p=>p.intent!=="danger"),i=n.filter(p=>p.intent==="danger");[...d,...i].forEach(p=>s.push(p))}),s}render(){const t=this._resolveActions();if(!t||t.length===0)return"";const e=window.ExtensionRegistry||I,s=async(o,w)=>{const m=Array.isArray(this.actionsList);if(!m&&e?.executeEntityAction)return await e.executeEntityAction(o,this.entityData,w);if(o.asyncAction)return m?await o.asyncAction(w):await o.asyncAction(this.entityData,w);if(o.onClick){const x=m?o.onClick(w):o.onClick(this.entityData,w);return x&&typeof x.then=="function"&&await x,x}};if(this.variant==="menu-bar"){const o={file:[],edit:[],share:[],vcs:[],tools:[]};t.forEach(m=>{const x=m.group&&o[m.group]?m.group:"tools";if(m.kind==="variant-set"&&Array.isArray(m.variants)){const y=m.label||"Options",L=Array.isArray(m.sections)&&m.sections.length>0?m.sections:["Actions"];L.forEach(O=>{const C=m.variants.filter(T=>(T.section||"Actions")===O);if(C.length>0){const T=L.length>1?`${y} \xB7 ${O}`:y;o[x].push({sectionHeading:T}),C.forEach(S=>{o[x].push({...S,label:typeof S.label=="function"?S.label(this.entityData):S.label,icon:typeof S.icon=="function"?S.icon(this.entityData):S.icon||"",successLabel:S.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,asyncAction:async W=>{typeof e?.setLastUsedVariant=="function"&&e.setLastUsedVariant(this.entityType||m.entityType||"file",m.setId,S.variantId||S.id),await s(S,W)}})})}})}else(o[x].length===0||o[x].every(y=>y.sectionHeading))&&o[x].push({sectionHeading:B[x]}),o[x].push({...m,label:typeof m.label=="function"?m.label(this.entityData):m.label,icon:typeof m.icon=="function"?m.icon(this.entityData):m.icon||"",successLabel:m.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,asyncAction:m.asyncAction?y=>s(m,y):null,onClick:!m.asyncAction&&m.onClick?y=>s(m,y):null})});const w={file:"file-text",edit:"edit-3",share:"share-2",vcs:"git-branch",tools:"wrench"};return l`
                <div class="action-row" style="justify-content: flex-start;">
                    ${Object.keys(o).map(m=>o[m].length===0?"":l`
                            <sutram-dropdown .items=${o[m]} align="left">
                                <button slot="trigger" class="sync-btn">
                                    <sutram-icon name="${w[m]}" size="sm" style="margin-right: 4px;"></sutram-icon>
                                    <span>${B[m]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const r=this.variant==="footer",a=Array.isArray(this.actionsList),n=t.some(o=>o.surfaced!==void 0&&o.surfaced!==null),h=[],d=[];t.forEach(o=>{const w=o.intent==="danger",m=o.surfaced!==void 0&&o.surfaced!==null;r||!w&&(n?m:a||(o.order??99)<20)?h.push(o):d.push(o)});const i=h.map(o=>this._estimateEntryWidth(o)),p=this._containerWidth||this.clientWidth||0,u=d.length>0,E=r?h.length:p>0?computeFitActionCount(p,i,38,6,u):h.length,v=h.slice(0,E),f=[...h.slice(E),...d],g=o=>{if(o.kind==="variant-set")return l`
                    <sutram-variant-btn
                        ?compact=${!r}
                        .setEntry=${o}
                        .entityType=${this.entityType||o.entityType}
                        .entityData=${this.entityData}
                        .executeAction=${s}>
                    </sutram-variant-btn>
                `;if(o.component)return l`<div style="display: contents;">${o.component(this.entityData)}</div>`;const w=typeof o.label=="function"?o.label(this.entityData):o.label,m=typeof o.icon=="function"?o.icon(this.entityData):o.icon||"",x=typeof o.intent=="function"?o.intent(this.entityData):o.intent||"primary",y=typeof o.isActive=="function"?o.isActive(this.entityData):!!o.isActive,L=o.successLabel||"Done";return o.asyncAction||o.successLabel||e?.executeEntityAction&&o.vfsBound?l`
                    <sutram-async-btn
                        ?compact=${!r}
                        .label=${w}
                        .icon=${m}
                        .successLabel=${L}
                        intent="${x}"
                        ?active=${y}
                        ?grow=${r}
                        ?fullWidth=${r}
                        .onClick=${C=>s(o,C)}>
                    </sutram-async-btn>
                `:l`
                <sutram-btn
                    ?compact=${!r}
                    intent=${x}
                    ?active=${y}
                    ?grow=${r}
                    ?fullWidth=${r}
                    .label=${w}
                    .icon=${m}
                    @click=${async C=>{if(C&&C.stopPropagation(),o.emitEvent){const T=o.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(T.name,{detail:T.detail,bubbles:!0,composed:!0}))}else await s(o,C);o.keepDrawerOpen||this.dispatchEvent(new CustomEvent("yenvui-action-confirmed",{bubbles:!0,composed:!0,detail:{action:o,status:"success",phase:"settled",holdMs:0,keepDrawerOpen:!1}}))}}>
                </sutram-btn>
            `},b=f.length>0?this._buildOverflowMenuItems(f,s):[];return l`
            <div class="action-row" @click=${o=>o.stopPropagation()}>
                ${v.map(g)}
                ${b.length>0?l`
                    <sutram-dropdown .items=${b} align="right">
                        <button slot="trigger" type="button" class="more-trigger-btn" title="More actions">
                            <sutram-icon name="more-horizontal" size="sm"></sutram-icon>
                        </button>
                    </sutram-dropdown>
                `:""}
            </div>
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends A(P){static properties={...P.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?D:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,s=>{const r=this._getId();r&&s.selectedItems&&(this.selected=s.selectedItems.has(r))});const t=this._getId(),e=this._getStore();t&&e&&e.getState().selectedItems&&(this.selected=e.getState().selectedItems.has(t))}this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const e=this._getId();if(e&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const s=this._getStore();s&&s.getState().toggleSelection&&s.getState().toggleSelection(e,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:e,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-tier-changed",()=>{this._injectEntityActions()}),this.addEventListener("yenvui-action-confirmed",t=>{!this._overlayActive||this._wideCard||t.detail?.keepDrawerOpen||t.detail?.action?.keepDrawerOpen||t.detail?.item?.keepDrawerOpen||t.detail?.phase==="settled"&&(this._overlayActive=!1)})}updated(t){if((t.has("icon")||t.has("entityData"))&&(this.entityData?.needs_recompile||this.entityData?.is_dirty||this.entityData?.outdated)&&(!this.icon||this.icon==="alert-triangle"||this.icon==="package")&&(this.icon="construction"),super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const e=this._getId(),s=this._getStore();e&&s&&s.getState().selectedItems&&(this.selected=s.getState().selectedItems.has(e))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive")||t.has("_wideCard"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this.hasActions||(this.hasActions=!0),!this.actionsOpen&&!this._wideCard)return;let e=this.querySelector(".sutram-injected-actions");if(e){const s=e.querySelector("sutram-entity-actions");s&&(s.entityType=this.entityType,s.entityData=this.entityData)}else{e=document.createElement("div"),e.className="sutram-injected-actions",e.slot="actions",e.style.display="flex",e.style.flexWrap="nowrap",e.style.gap="6px",e.style.alignItems="center",e.style.justifyContent="flex-end",e.style.width="100%",e.style.minWidth="0",e.addEventListener("click",r=>r.stopPropagation());const s=document.createElement("sutram-entity-actions");s.style.width="100%",s.style.minWidth="0",s.entityType=this.entityType,s.entityData=this.entityData,e.appendChild(s),this.appendChild(e),this.hasActions=!0}}else{const e=this.querySelector(".sutram-injected-actions");e&&e.remove(),this.hasActions&&(this.hasActions=!1)}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends lt{}customElements.get("sutram-card-group")||customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends mt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends ht{}customElements.get("sutram-spinner")||customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends bt{}customElements.get("sutram-empty-state")||customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends ft{}customElements.get("sutram-board")||customElements.define("sutram-board",SutramBoard);export class SutramColumn extends gt{}customElements.get("sutram-column")||customElements.define("sutram-column",SutramColumn);export class SutramTag extends yt{}customElements.get("sutram-tag")||customElements.define("sutram-tag",SutramTag);export class SutramLabel extends vt{}customElements.get("sutram-label")||customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends Et{}customElements.get("sutram-scrub-track")||customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends St{}customElements.get("sutram-scroll-view")||customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends ct{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends xt{constructor(){super(),this.filterFn=(t,e)=>q(t,e,s=>`${s.label||""} ${s.id||""} ${s.token||""} ${s.badge||""} ${s.description||""} ${s.section||""}`)}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-action-error",t=>{window.dispatchEvent(new CustomEvent("sutram-status-update",{detail:{msg:t.detail?.msg||"Action failed",timeout:4e3,isError:!0}}))})}}customElements.define("sutram-dropdown",SutramDropdown);export class SutramTabs extends $t{connectedCallback(){super.connectedCallback(),this._tabsBridged||(this._tabsBridged=!0,this.addEventListener("yenvui-tab-selected",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-tab-selected",{detail:t.detail,bubbles:!0,composed:!0}))}))}}customElements.get("sutram-tabs")||customElements.define("sutram-tabs",SutramTabs);export class SutramFilterDropdown extends wt{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends ut{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{t.stopPropagation(),t.target===this&&this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!1,composed:!1}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends ot{}customElements.get("sutram-category-section")||customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends dt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends pt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as H}from"./wordcount.js";const Rt=[];export class SutramEditor extends A(z){static properties={...z.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const e=Array.isArray(this.customExtensions)?this.customExtensions.filter(s=>s!==H):[];this.enableWordcount&&e.push(H),this.customExtensions=e}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this._lastEmittedValue=t.detail?.value,this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("content-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new Event("input",{bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-selection",t=>{this.dispatchEvent(new CustomEvent("editor-selection",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-scroll",t=>{this.dispatchEvent(new CustomEvent("editor-scroll",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-link-clicked",t=>{this.dispatchEvent(new CustomEvent("editor-link-clicked",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends _{static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[$,k`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const e=++this._lastSearchReq;F.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:s})=>{e===this._lastSearchReq&&(this._filteredItems=(s||[]).slice(0,50))})}}render(){if(!this.open)return l``;const t=this._filteredItems||[];return l`
            <sutram-modal open titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <sutram-stack slot="body" direction="col" gap="sm" ?flex=${!0}>
                    <sutram-input placeholder="Search..." ?flush=${!0} .value=${this._searchQuery} @sutram-input-changed=${e=>this._searchQuery=e.detail.value}></sutram-input>
                    <sutram-stack direction="col" gap="xs" ?flex=${!0} ?scrollable=${!0}>
                        ${t.length===0?l`<sutram-empty-state text="No matches found."></sutram-empty-state>`:t.map(e=>{const s=typeof e=="string"?e:e.label||e;return l`
                                <sutram-surface variant="inset" padding="sm" ?interactive=${!0}
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:e},bubbles:!0,composed:!0}))}}>
                                    <sutram-stack direction="row" align="center" gap="sm">
                                        <sutram-icon name="file" size="sm" intent="primary"></sutram-icon>
                                        <sutram-label ?monospace=${!0} intent="neutral" .text=${s}></sutram-label>
                                    </sutram-stack>
                                </sutram-surface>
                            `})}
                    </sutram-stack>
                </sutram-stack>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends _{static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[$,k`
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
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,e=this.tabs.find(s=>s.id===t)||this.tabs[0];return e&&e.content||""}return this.content||""}render(){const t=this._getActiveContent(),e=this.tabs&&this.tabs.length>1,s=this.activeTab||this.tabs&&this.tabs[0]?.id||"",r=this.suggestedFilename||`report_${Date.now()}.txt`;return l`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: var(--mobile-edge-padding, 15px); gap: 10px;">
                ${this.caption?l`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${e?l`
                    <sutram-stack direction="row" gap="sm">
                        ${this.tabs.map(a=>l`
                            <sutram-btn
                                ?compact=${!0}
                                .icon=${a.icon||"file-text"}
                                .label=${a.label}
                                intent="${s===a.id?"primary":"neutral"}"
                                ?active=${s===a.id}
                                @click=${()=>{this.activeTab=a.id}}>
                            </sutram-btn>
                        `)}
                    </sutram-stack>
                `:""}
                <div class="output-box">${t||"No output."}</div>
                ${this.extraContent?l`<div style="flex-shrink: 0;">${this.extraContent}</div>`:""}
                <sutram-surface variant="panel" padding="xs" align="end">
                    <sutram-entity-actions
                        .entityType=${"text_blob"}
                        .entityData=${{textContent:t,suggestedFilename:r}}>
                    </sutram-entity-actions>
                </sutram-surface>
            </div>
            ${this.actions&&this.actions.length>0?l`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(a=>a.asyncAction?l`
                                <sutram-async-btn
                                    .icon=${a.icon}
                                    .label=${a.label}
                                    intent="${a.intent||"primary"}"
                                    ?grow=${!0}
                                    ?emphasis=${!!a.primary}
                                    ?disabled=${a.disabled}
                                    .onClick=${a.asyncAction}>
                                </sutram-async-btn>
                            `:l`
                            <sutram-btn
                                .icon=${a.icon}
                                .label=${a.label}
                                intent="${a.intent||"neutral"}"
                                ?grow=${!0}
                                ?emphasis=${!!a.primary}
                                ?disabled=${a.disabled}
                                @click=${a.onClick}>
                            </sutram-btn>
                        `)}
                </div>
            `:""}
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends A(kt){}customElements.define("sutram-diff-viewer",SutramDiffViewer);export class SutramSubtabMenu extends _{static properties={slotConfig:{type:Object},_menuItems:{type:Array,state:!0},_selectedCount:{type:Number,state:!0}};static styles=[$,k`
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
    `];constructor(){super(),this.slotConfig=null,this._menuItems=[],this._selectedCount=0,this._selectedItems=new Map}connectedCallback(){super.connectedCallback(),this.subscribe(D,t=>t.selectedItems||new Map,t=>{this._selectedItems=t,this._rebuildMenu()}),this.subscribe(N,t=>t.isOffline,()=>{this._rebuildMenu()}),this.registerGlobalListener("sutram-subtab-menu-refresh",window,()=>{this._rebuildMenu()}),this._selectedItems=D.getState()?.selectedItems||new Map,this._rebuildMenu()}_bindSlotMenuStores(){this._slotStoreUnsubs&&this._slotStoreUnsubs.forEach(e=>e()),this._slotStoreUnsubs=[],(this.slotConfig?.menuStores||[]).forEach(e=>{const s=this.subscribe(e,()=>{this._rebuildMenu()});this._slotStoreUnsubs.push(s)})}disconnectedCallback(){super.disconnectedCallback(),this._slotStoreUnsubs=[]}willUpdate(t){super.willUpdate(t),t.has("slotConfig")&&(this._bindSlotMenuStores(),this._rebuildMenu())}_rebuildMenu(){const t=this.slotConfig||{},e=this._selectedItems||new Map,s=Array.from(e.values()),r=Array.isArray(t.bulkEntityTypes)&&t.bulkEntityTypes.length>0?t.bulkEntityTypes:null,a=r?s.filter(d=>String(d?.entityType||"").split(":").some(p=>r.includes(p))):s;this._selectedCount=t.bulkActionGroup?a.length:0;const n=[];if(t.bulkActionGroup&&a.length>0){const d=window.ExtensionRegistry||I,i=d?.getAggregatableActions?d.getAggregatableActions(a,{group:t.bulkActionGroup}):[];i.length>0&&(i.forEach(p=>{if(p.kind==="variant-set"&&Array.isArray(p.variants)){const u=p.label||"Options",E=Array.isArray(p.sections)&&p.sections.length>0?p.sections:["Actions"];E.forEach(v=>{const f=p.variants.filter(b=>(b.section||"Actions")===v);if(f.length===0)return;const g=E.length>1?`${u} \xB7 ${v}`:u;n.push({sectionHeading:g}),f.forEach(b=>{n.push({...b,successLabel:b.successLabel||"Done",confirmHoldMs:ACTION_CONFIRM_HOLD_MS,asyncAction:async o=>{typeof d?.setLastUsedVariant=="function"&&d.setLastUsedVariant(p.entityType||"bulk",p.setId,b.variantId||b.id),b.asyncAction?await b.asyncAction(o):b.onClick&&await b.onClick(o)},onClick:null})})})}else n.push(p)}),n.push({divider:!0})),n.push({label:`Clear Selection (${a.length})`,icon:"x",onClick:()=>D.getState().clearSelection()}),n.push({divider:!0})}for((typeof t.menuActions=="function"?t.menuActions(t):Array.isArray(t.menuActions)?t.menuActions:[]).forEach(d=>{if(d){if(d.divider){n.push({divider:!0});return}n.push({...d,onClick:d.onClick||(d.emitEvent?()=>{const i=typeof d.emitEvent=="function"?d.emitEvent(t):d.emitEvent;typeof i=="string"?window.dispatchEvent(new CustomEvent(i,{bubbles:!0,composed:!0})):i&&i.name&&window.dispatchEvent(new CustomEvent(i.name,{detail:i.detail,bubbles:!0,composed:!0}))}:null)})}});n.length>0&&n[n.length-1].divider;)n.pop();this._menuItems=n}render(){if(!this._menuItems||this._menuItems.length===0)return l``;const t=this._selectedCount||0;return l`
            <sutram-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="subtab-menu-trigger" @pointerdown=${()=>this._rebuildMenu()} title="${t>0?`Bulk Actions (${t} selected)`:"Actions"}">
                    ${t>0?l`
                        <sutram-icon name="layers" size="sm" intent="warning"></sutram-icon>
                        <span class="subtab-badge">${t>9?"9+":t}</span>
                    `:l`
                        <sutram-icon name="menu" size="sm"></sutram-icon>
                    `}
                </button>
            </sutram-dropdown>
        `}}customElements.get("sutram-subtab-menu")||customElements.define("sutram-subtab-menu",SutramSubtabMenu);
