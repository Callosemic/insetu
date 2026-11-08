import{LitElement as T,html as n,css as w}from"lit";import{SutramElement as S,SutramContextMixin as _,SelectionStore as C,ToastStore as z,EnvironmentStore as I}from"./sutram_sdk.js";import*as j from"sutram-chassis";import{sharedStyles as $}from"./shared_styles.js";import{resolveDirectoryState as M,fuzzyFilterObjects as F,SutramWorker as B}from"./utils.js";import"./inputs.js";import"lit-virtualizer";export const REQUIRED_CHASSIS_PRIMITIVES=["Icon","View","Stack","Surface","ActionBar","SidebarLayout","Btn","AsyncBtn","Card","CardGroup","CategorySection","Modal","Window","Tabs","Toolbar","SearchBar","Dropdown","FilterDropdown","Collapsible","Pill","FilterGroup","Tag","Label","Spinner","EmptyState","Board","Column","ScrubTrack","ScrollView","DiffViewer","Editor","Input","Select","Textarea","Toggle"];export function validateChassisContract(o){if(!o||typeof o!="object")throw new Error("[Sutram Boot Error] Invalid or missing chassis provider object.");const t=REQUIRED_CHASSIS_PRIMITIVES.filter(s=>typeof o[s]!="function");if(t.length>0)throw new Error(`[Sutram Boot Error] Chassis '${o.CHASSIS_PROVIDER_META?.name||"Custom"}' fails contract. Missing primitives: ${t.join(", ")}`);return!0}export class SutramUIAdapter{static PASSTHROUGH_MAP=Object.freeze({"sutram-icon":"Icon","sutram-view":"View","sutram-stack":"Stack","sutram-surface":"Surface","sutram-action-bar":"ActionBar","sutram-btn":"Btn","sutram-card-group":"CardGroup","sutram-category-section":"CategorySection","sutram-spinner":"Spinner","sutram-empty-state":"EmptyState","sutram-board":"Board","sutram-column":"Column","sutram-tag":"Tag","sutram-label":"Label","sutram-scrub-track":"ScrubTrack","sutram-scroll-view":"ScrollView","sutram-filter-dropdown":"FilterDropdown","sutram-tabs":"Tabs","sutram-input":"Input","sutram-select":"Select","sutram-textarea":"Textarea","sutram-toggle":"Toggle","sutram-drop-overlay":"DropOverlay","sutram-drop-target":"DropTarget"});static registerChassis(t){validateChassisContract(t),Object.entries(this.PASSTHROUGH_MAP).forEach(([s,i])=>{const a=t[i];typeof a=="function"&&!customElements.get(s)&&customElements.define(s,class extends a{})})}}SutramUIAdapter.registerChassis(j);const{Icon:Y,View:P,Stack:U,Surface:H,ActionBar:W,SidebarLayout:G,Btn:V,AsyncBtn:R,StatusBar:O,ToastContainer:q,Modal:J,Window:K,CategorySection:Q,Card:N,CardGroup:Z,Editor:D,Toolbar:X,Collapsible:tt,Pill:et,FilterGroup:st,SelectionTray:Et,SearchBar:it,Spinner:nt,EmptyState:rt,Board:at,Column:ot,Tag:lt,Label:ct,Dropdown:dt,FilterDropdown:ut,ScrubTrack:pt,ScrollView:mt,DiffViewer:ht,Tabs:gt}=j;D&&(D.languageResolver=async o=>window.ExtensionRegistry&&typeof window.ExtensionRegistry.executeUIHook=="function"?await window.ExtensionRegistry.executeUIHook("sutram:vendorize-language",o):window.Sutram&&typeof window.Sutram.vendorizeLanguage=="function"?await window.Sutram.vendorizeLanguage(o):null);export class SutramVirtualList extends T{static properties={items:{type:Array},renderItem:{type:Object},keyFunction:{type:Object},flush:{type:Boolean,reflect:!0}};static styles=w`
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
    `;constructor(){super(),this.items=[],this.renderItem=null,this.keyFunction=(t,s)=>{if(!t)return s;if(typeof t=="string")return t;const i=t.type||t.entityType||"item",a=t.canonicalUri||t.fullPath||t.filepath||t.id||t.name||s;return`${i}::${a}`}}connectedCallback(){super.connectedCallback(),this.setAttribute("data-virtual-list","")}render(){return!this.items||this.items.length===0?n``:n`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .keyFunction=${this.keyFunction}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramIcon extends Y{}customElements.get("sutram-icon")||customElements.define("sutram-icon",SutramIcon);export class SutramView extends P{connectedCallback(){super.connectedCallback(),this._zenBridged||(this._zenBridged=!0,this.addEventListener("yenvui-view-exit-zen",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-view-exit-zen",{bubbles:!0,composed:!0}))}))}}customElements.get("sutram-view")||customElements.define("sutram-view",SutramView);export class SutramStack extends U{}customElements.get("sutram-stack")||customElements.define("sutram-stack",SutramStack);export class SutramSurface extends H{}customElements.get("sutram-surface")||customElements.define("sutram-surface",SutramSurface);export class SutramActionBar extends W{}customElements.get("sutram-action-bar")||customElements.define("sutram-action-bar",SutramActionBar);export class SutramSidebarLayout extends G{connectedCallback(){super.connectedCallback(),this._sidebarBridged||(this._sidebarBridged=!0,this.addEventListener("yenvui-nav-selected",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-nav-selected",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-drawer-closed",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-drawer-closed",{bubbles:!0,composed:!0}))}))}}customElements.get("sutram-sidebar-layout")||customElements.define("sutram-sidebar-layout",SutramSidebarLayout);export class SutramBtn extends V{}customElements.get("sutram-btn")||customElements.define("sutram-btn",SutramBtn);export class SutramProjectionWindowControls extends S{static properties={filepath:{type:String},projectionId:{type:String},beforeAction:{attribute:!1}};static styles=[$,w`:host { display: inline-flex; align-items: center; }`];_getTargetId(){return this.projectionId||this.filepath||""}render(){const t=this._getTargetId();if(!t)return n``;const s=typeof window<"u"&&new URLSearchParams(window.location.search).get("popout")==="true",i=window.Sutram?.stores?.Layout?.getState?.();return s?n`
                <sutram-btn
                    ?compact=${!0}
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),i&&typeof i.dockInProjection=="function"&&await i.dockInProjection(t)}}>
                </sutram-btn>
            `:(i&&typeof i.canPopout=="function"?i.canPopout():!0)?n`
                <sutram-btn
                    ?compact=${!0}
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    @click=${async()=>{typeof this.beforeAction=="function"&&await this.beforeAction(),i&&typeof i.dockInProjection=="function"&&await i.popoutProjection(t)}}>
                </sutram-btn>
            `:n``}}customElements.get("sutram-projection-window-controls")||customElements.define("sutram-projection-window-controls",SutramProjectionWindowControls);export class SutramAsyncBtn extends _(R){static properties={...R.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(I,t=>{if(t.isOffline){let s=this,i=null;for(;s;){if(s.dataset&&s.dataset.ext){i=s.dataset.ext;break}s=s.getRootNode().host||s.parentElement}const a=i&&window.ExtensionRegistry?.getExtension(i)?.offline_mode;this._isOfflineReadOnly=a==="read_only"||a==="none"||!a}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.jobRoute&&typeof window.ExtensionRegistry?.executeJobAction=="function"){this.status="loading";try{const s=typeof this.jobPayload=="function"?await this.jobPayload(t):this.jobPayload||{};await window.ExtensionRegistry.executeJobAction(this.jobRoute,s,{onProgress:(a,r)=>{this.onJobProgress&&this.onJobProgress(a,r)},onComplete:a=>{this.status="success",this.onJobComplete&&this.onJobComplete(a),setTimeout(()=>{this.status="idle"},2e3)},onError:a=>{this.status="error",this.onJobError&&this.onJobError(a),setTimeout(()=>{this.status="idle"},2e3)}})(t);return}catch(s){if(this.status="error",typeof this.onJobError=="function")try{this.onJobError(s)}catch{}console.error("[SutramAsyncBtn] Job dispatch error:",s),setTimeout(()=>{this.status="idle"},2e3);return}}return super._handleClick(t)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends _(O){static properties={...O.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends _(q){connectedCallback(){super.connectedCallback(),this.subscribe(z,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{z.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends S{static properties={selectedItems:{type:Object},modalOpen:{type:Boolean},trayTitle:{type:String},itemBadge:{type:String}};static styles=[$,w`
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
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1,this.trayTitle="Selection Tray",this.itemBadge="ITEM"}connectedCallback(){super.connectedCallback(),this.subscribe(C,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1)}),this.selectedItems=C.getState().selectedItems}render(){const t=this.selectedItems.size,s=Array.from(this.selectedItems.values());let i=0,a=!1;const r=window.ExtensionRegistry;s.forEach(l=>{const e=l.data?.size_bytes||(r?.executeUIHook?r.executeUIHook("sutram:resolve-item-size",l.data):null);e?i+=e:a=!0});let d="";i>0?d=`~${Math.round(i/1024)} kb${a?"+":""}`:a&&(d="Calculated on compile");let b=[];return r&&(typeof r.getAggregatableActions=="function"&&(b=r.getAggregatableActions(s,{group:"share"})),r._manifests&&r._manifests.forEach(l=>{l.batchActions&&l.batchActions.forEach(e=>{!b.some(h=>h.id===e.id)&&e.match(s)&&b.push({...e,onClick:e.onClick?h=>e.onClick(s,h):null,asyncAction:e.asyncAction?h=>e.asyncAction(s,h):null})})})),b.sort((l,e)=>(l.order||99)-(e.order||99)),n`
            ${t>0?n`
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
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">${this.trayTitle||"Selection Tray"} <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${d?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d}</span>`:""}
                    </div>
                    <button class="sync-btn" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${s.map(l=>{const e=l.data?.filepath||l.data?.folderpath||l.data?.id||"",h=String(e).replace(/\/+$/,""),g=l.data?.titleText||h.split("/").pop()||"Unknown Item",x=l.key||e,p=l.data?.size_bytes||(r?.executeUIHook?r.executeUIHook("sutram:resolve-item-size",l.data):null),m=p?`${Math.round(p/1024)} kb`:"";return n`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">${this.itemBadge||"ITEM"}</span> ${g}</div>${m?n`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${m}</span>`:""}
                                </div>
                                <div class="tray-item-path">${e}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>C.getState().toggleSelection(x,l.entityType,l.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{C.getState().clearSelection(),this.modalOpen=!1}}></sutram-async-btn>
                    <sutram-scrub-track ?grow=${!0}>
                        <div style="display: flex; gap: 8px; align-items: center; width: max-content; margin-left: auto;">
                            ${b.map(l=>n`
                                <sutram-async-btn  
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
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends T{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[$];render(){if(!this.items||this.items.length===0)return n``;const t={};this.items.forEach(i=>{const a=i[this.categoryKey]||"Uncategorized";t[a]||(t[a]=[]),t[a].push(i)});const s=Object.keys(t).sort((i,a)=>{const r=this.categoryOrder||[];let d=r.indexOf(i),b=r.indexOf(a);return d===-1&&(d=999),b===-1&&(b=999),d!==b?d-b:i.localeCompare(a)});return n`
            <sutram-stack direction="col" gap="none">
                ${s.map(i=>n`
                    <sutram-category-section titleText=${i}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(i):""}
                        <sutram-card-group>
                            ${t[i].map(a=>this.renderItem(a))}
                        </sutram-card-group>
                    </sutram-category-section>
                `)}
            </sutram-stack>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends T{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const s=++this._lastReqId;B.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:i})=>{s===this._lastReqId&&(this._treeData=i||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:s}=M(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),n`
            <sutram-surface variant="ghost" border="bottom" padding="xs">
                <sutram-stack direction="row" align="center" gap="sm">
                    <sutram-btn intent="neutral" ?compact=${!0} icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                    <sutram-scrub-track ?grow=${!0} ?monospace=${!0}>
                        /${t.join("/")}
                    </sutram-scrub-track>
                </sutram-stack>
            </sutram-surface>
            <sutram-stack direction="col" gap="xs" ?flex=${!0} ?scrollable=${!0}>
                ${s.length===0?n`<sutram-empty-state text="No sub-folders available."></sutram-empty-state>`:s.map(i=>n`
                    <sutram-surface variant="inset" padding="xs" ?interactive=${!0}
                        @click=${()=>this._setPath([...t,i.name])}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="folder" size="md" intent="warning"></sutram-icon>
                            <strong>${i.name}</strong>
                        </sutram-stack>
                    </sutram-surface>
                `)}
            </sutram-stack>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends _(J){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends _(K){connectedCallback(){super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramFieldCard extends S{static properties={label:{type:String},description:{type:String},scope:{type:String},secure:{type:Boolean}};static styles=[$,w`
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
    `];constructor(){super(),this.label="",this.description="",this.scope="workspace",this.secure=!1}_renderBadges(){const t=[];this.secure&&t.push(n`<span class="scope-badge warning">secure</span>`);const s=this.scope||"workspace";return s==="daemon"?t.push(n`<span class="scope-badge neutral">daemon</span>`):s==="repo"?t.push(n`<span class="scope-badge highlight">repo</span>`):s!=="none"&&t.push(n`<span class="scope-badge primary">workspace</span>`),n`<div style="display: inline-flex; gap: 6px; align-items: center;"><slot name="header-actions"></slot>${t}</div>`}render(){return n`
            <div class="field-header">
                <span class="field-title">${this.label}</span>${this._renderBadges()}
            </div>
            <slot></slot>
            ${this.description?n`<div class="field-desc">${this.description}</div>`:""}
        `}}customElements.get("sutram-field-card")||customElements.define("sutram-field-card",SutramFieldCard);export class SutramSettingsForm extends S{static properties={extName:{type:String},schema:{type:Array},optionResolver:{attribute:!1},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String},filterQuery:{type:String},hideSaveButton:{type:Boolean},_jsonBuffers:{type:Object}};static styles=[$,w`
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
    `];constructor(){super(),this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo="",this.filterQuery="",this.hideSaveButton=!1,this._jsonBuffers={},this.optionResolver=null}willUpdate(t){(t.has("extName")||t.has("selectedRepo"))&&(this._jsonBuffers={})}_emitFormMutation(t){this.formData=t,this.dispatchEvent(new CustomEvent("sutram-settings-form-changed",{detail:{extName:this.extName,formData:this.formData,repo:this.selectedRepo},bubbles:!0,composed:!0})),this.requestUpdate()}async triggerSave(t){const i=(this.schema||[]).some(r=>r&&r.type!=="hidden"&&r.scope==="repo")&&(this.selectedRepo||this.repos&&this.repos[0])||"",a={...this.formData||{}};return(this.schema||[]).forEach(r=>{if(!r||r.type==="hidden"||r.type==="action")return;const d=a[r.id];r.type==="number"?a[r.id]=d===""||d===null||d===void 0||Number.isNaN(Number(d))?r.default??0:Number(d):r.type==="string_list"?typeof d=="string"?a[r.id]=d.split(",").map(b=>b.trim()).filter(Boolean):Array.isArray(d)||(a[r.id]=Array.isArray(r.default)?r.default:[]):r.type==="intent_map"&&(!d||typeof d!="object"||Array.isArray(d))&&(a[r.id]=r.default&&typeof r.default=="object"?r.default:{})}),this.formData=a,new Promise((r,d)=>{this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,schema:this.schema,formData:a,repo:i,resolve:r,reject:d,originalEvent:t},bubbles:!0,composed:!0}))})}_renderScopeBadge(t){const s=[];t.secure&&s.push(n`<sutram-tag text="secure" intent="warning"></sutram-tag>`);const i=t.scope||"workspace";return i==="daemon"?s.push(n`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`):i==="repo"?s.push(n`<sutram-tag text="repo" intent="highlight"></sutram-tag>`):s.push(n`<sutram-tag text="workspace" intent="primary"></sutram-tag>`),n`<div style="display: inline-flex; gap: 6px; align-items: center;">${s}</div>`}render(){const s=window.ExtensionRegistry?._manifests?.get(this.extName),i=(s?.settingsActions||[]).filter(e=>!e.id.endsWith("_generic_settings")),a=(this.filterQuery||"").trim().toLowerCase(),r=(this.schema||[]).filter(e=>!e||e.type==="hidden"?!1:a?[e.label,e.title,e.id,e.description,e.desc].filter(Boolean).join(" ").toLowerCase().includes(a):!0),d=(this.schema||[]).some(e=>e&&e.type!=="hidden"&&e.scope==="repo"),b=this.selectedRepo||this.repos&&this.repos[0]||"",l=d&&(!this.repos||this.repos.length===0);return n`
            ${d?n`
                <sutram-surface variant="tinted" intent="highlight" padding="sm">
                    <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${!0}>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="package" size="md" intent="highlight"></sutram-icon>
                            <strong>Target Repository Scope</strong>
                        </sutram-stack>
                        ${l?n`
                            <sutram-label text="Add a repository in Workspace Manager to configure repository-scoped settings."></sutram-label>
                        `:n`
                            <sutram-select
                                .value=${b}
                                .options=${(this.repos||[]).map(e=>({value:e,label:e}))}
                                ?flush=${!0}
                                ?grow=${!0}
                                @sutram-input-changed=${e=>{this.selectedRepo=e.detail.value,this.dispatchEvent(new CustomEvent("sutram-settings-repo-changed",{detail:{extName:this.extName,repo:e.detail.value},bubbles:!0,composed:!0}))}}>
                            </sutram-select>
                        `}
                    </sutram-stack>
                </sutram-surface>
            `:""}

            ${a?"":i.map(e=>n`
                <sutram-field-card .label=${e.label} scope="workspace">
                    <sutram-async-btn slot="header-actions" label="Open Panel" icon="external-link" intent="primary" ?compact=${!0} .onClick=${async h=>{this.dispatchEvent(new CustomEvent("sutram-settings-custom-action",{detail:{action:{...e,extName:e.extName||this.extName},extName:this.extName,originalEvent:h},bubbles:!0,composed:!0})),e.onClick&&await e.onClick(h)}}></sutram-async-btn>
                </sutram-field-card>
            `)}

            ${r.map(e=>{const h=e.scope==="repo"&&l,g=this.formData&&this.formData[e.id]!==void 0?this.formData[e.id]:e.default,x=e.title||e.label||e.id;let p="";if(e.type==="action")p=n`
                        <sutram-async-btn
                            ?fullWidth=${!0}
                            label=${e.button_label||e.action_label||e.label||"Execute Action"}
                            intent=${e.intent||"primary"}
                            ?disabled=${h}
                            .onClick=${async m=>new Promise((c,u)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:e,resolve:c,reject:u,originalEvent:m},bubbles:!0,composed:!0}))})}>
                        </sutram-async-btn>
                    `;else if(e.type==="boolean")p=n`
                        <sutram-toggle
                            .checked=${!!g}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${m=>this._emitFormMutation({...this.formData,[e.id]:m.detail.value})}>
                        </sutram-toggle>
                    `;else if(e.type==="select"){let m=e.options||[];if(e.options_from&&typeof e.options_from=="object"){const f=e.options_from.field,k=e.options_from.value_key||"id",E=e.options_from.label_key||"title";m=(Array.isArray(this.formData?.[f])?this.formData[f]:[]).filter(y=>y&&typeof y=="object"&&(y[k]||y[E])).map(y=>({value:String(y[k]||y[E]),label:String(y[E]||y[k])}))}const c=m.map(f=>({value:f.value!==void 0?f.value:f,label:f.label||f.title||f.value||f})),u=g!==void 0&&g!==""&&c.some(f=>f.value===g)?g:c[0]?.value??g??"";p=n`
                        <sutram-select
                            .value=${u}
                            .options=${c}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${f=>this._emitFormMutation({...this.formData,[e.id]:f.detail.value})}>
                        </sutram-select>
                    `}else if(e.type==="target_binding"){const m=e.endpoint_source||"compute_endpoints",c=Array.isArray(this.formData?.[m])?this.formData[m]:[],u=f=>typeof this.optionResolver=="function"?this.optionResolver(e,f,this.formData):[];p=n`
                        <sutram-target-binding
                            ?flush=${!0}
                            ?disabled=${h}
                            ?allowEmptyEndpoint=${!!e.allow_empty}
                            .value=${g||{endpoint:"",model:""}}
                            .endpoints=${c}
                            .models=${u}
                            .endpointPlaceholder=${e.endpoint_placeholder||"Select endpoint..."}
                            .modelPlaceholder=${e.placeholder||"Select or type model..."}
                            @sutram-input-changed=${f=>this._emitFormMutation({...this.formData,[e.id]:f.detail.value})}>
                        </sutram-target-binding>
                    `}else if(e.type==="number")p=n`
                        <sutram-input
                            type="number"
                            .value=${g!=null&&!Number.isNaN(g)?String(g):""}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${m=>{const c=m.detail.value,u=c===""?"":Number(c);this._emitFormMutation({...this.formData,[e.id]:Number.isNaN(u)?e.default??0:u})}}>
                        </sutram-input>
                    `;else if(e.type==="intent_map"){const m=Array.isArray(e.intent_legend)&&e.intent_legend.length>0?e.intent_legend:["primary","success","warning","danger","highlight","neutral"],c=typeof g=="object"&&g!==null?g:e.default||{};p=n`
                        <div class="intent-grid">
                            ${m.map(u=>{const f=Array.isArray(c[u])?c[u]:[];return n`
                                    <div class="intent-row">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: var(--intent-${u}); display: flex; align-items: center; gap: 6px;">
                                            ● ${u.toUpperCase()}
                                        </span>
                                        <sutram-input
                                            .value=${f.join(", ")}
                                            placeholder="Comma-separated keywords..."
                                            ?disabled=${h}
                                            ?flush=${!0}
                                            @sutram-input-changed=${k=>{const E=k.detail.value.split(",").map(y=>y.trim()).filter(Boolean),A={...c,[u]:E};this._emitFormMutation({...this.formData,[e.id]:A})}}>
                                        </sutram-input>
                                    </div>
                                `})}
                        </div>
                    `}else if(e.type==="string_list"){const m=Array.isArray(g)?g.join(", "):g||"";p=n`
                        <sutram-input
                            .value=${m}
                            placeholder=${e.placeholder||"Comma-separated values..."}
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${c=>{const u=c.detail.value.split(",").map(f=>f.trim()).filter(Boolean);this._emitFormMutation({...this.formData,[e.id]:u})}}>
                        </sutram-input>
                    `}else if(e.type==="object"||e.type==="json"||typeof g=="object"&&g!==null){const m=this._jsonBuffers[e.id]!==void 0?this._jsonBuffers[e.id]:typeof g=="object"&&g!==null?JSON.stringify(g,null,2):g||"";p=n`
                        <sutram-textarea
                            .value=${m}
                            .monospace=${!0}
                            size="wide"
                            ?disabled=${h}
                            ?flush=${!0}
                            @sutram-input-changed=${c=>{this._jsonBuffers={...this._jsonBuffers,[e.id]:c.detail.value};try{const u=JSON.parse(c.detail.value);this._emitFormMutation({...this.formData,[e.id]:u})}catch{this.requestUpdate()}}}>
                        </sutram-textarea>
                    `}else{const m=e.secure&&g==="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",c=e.type==="password"||e.secure?"password":"text";p=n`
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-input
                                type="${c}"
                                ?grow=${!0}
                                .value=${g??""}
                                placeholder=${e.secure?"Enter secret key...":e.placeholder||""}
                                ?disabled=${h}
                                ?flush=${!0}
                                @sutram-input-changed=${u=>this._emitFormMutation({...this.formData,[e.id]:u.detail.value})}>
                            </sutram-input>
                            ${m?n`
                                <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                                <sutram-btn
                                    ?compact=${!0}
                                    intent="danger"
                                    label="Clear"
                                    @click=${()=>this._emitFormMutation({...this.formData,[e.id]:""})}>
                                </sutram-btn>
                            `:""}
                        </sutram-stack>
                    `}return n`
                    <sutram-field-card
                        .label=${x}
                        .description=${e.description||e.desc||""}
                        .scope=${e.scope||"workspace"}
                        ?secure=${!!e.secure}>${p}
                    </sutram-field-card>
                `})}

            ${!this.hideSaveButton&&r.some(e=>e.type!=="action")?n`
                <sutram-async-btn
                    ?fullWidth=${!0}
                    label="Save ${s?.name||this.extName} Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${e=>this.triggerSave(e)}>
                </sutram-async-btn>
            `:""}
        `}}customElements.define("sutram-settings-form",SutramSettingsForm);export class SutramGenericSettingsModal extends S{static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String}};static styles=[$,w`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo=""}openModal(t,s,i,a=[],r=""){this.extName=t,this.schema=s||[],this.formData=i||{},this.repos=a||[],this.selectedRepo=r||this.repos[0]||"",this.open=!0}render(){if(!this.open)return n``;const i=(window.ExtensionRegistry?._manifests?.get(this.extName)?.name||this.extName)+" Settings";return n`
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
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends S{static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=[$,w`
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
    `];updated(t){if(super.updated(t),t.has("_trayOpen")){const s=this.shadowRoot.querySelector(".action-tray-dialog");s&&(this._trayOpen&&!s.open?s.showModal():!this._trayOpen&&s.open&&s.close())}}connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback();const t=this.shadowRoot?.querySelector(".action-tray-dialog");t&&t.open&&(document.body.appendChild(t),t.close(),t.remove())}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const s=async(e,h)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(e,this.entityData,h);if(e.asyncAction)return await e.asyncAction(this.entityData,h);if(e.onClick)return e.onClick(this.entityData,h)};if(this.variant==="menu-bar"){const e={file:[],edit:[],share:[],tools:[]};t.forEach(p=>{const m=p.group&&e[p.group]?p.group:"tools";e[m].push({...p,label:typeof p.label=="function"?p.label(this.entityData):p.label,icon:typeof p.icon=="function"?p.icon(this.entityData):p.icon||"",asyncAction:p.asyncAction?c=>s(p,c):null,onClick:!p.asyncAction&&p.onClick?c=>s(p,c):null})});const h={file:"File",edit:"Edit",share:"Share",tools:"Tools"},g={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},x=p=>{const m=p.currentTarget;if(!m)return;const c=m.getBoundingClientRect(),u=m.closest(".spatial-col, sutram-app-shell, .editor-header")||document.body,f=u.getBoundingClientRect?u.getBoundingClientRect().right:window.innerWidth,k=Math.min(window.innerWidth,f);c.left+220>k-10?(m.setAttribute("align","right"),m.align="right"):(m.setAttribute("align","left"),m.align="left")};return n`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(e).map(p=>e[p].length===0?"":n`
                            <sutram-dropdown 
                                .items=${e[p]} 
                                align="left"
                                @pointerdown=${x}
                                @click=${x}>
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <sutram-icon name="${g[p]}" size="sm" style="margin-right: 4px;"></sutram-icon> <span>${h[p]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const i=this.variant==="footer",a=[],r=[];t.forEach(e=>{i||(e.order||99)<20?a.push(e):r.push(e)});const d=e=>{if(e.component)return n`<div style="display: contents;">${e.component(this.entityData)}</div>`;const h=typeof e.label=="function"?e.label(this.entityData):e.label,g=typeof e.icon=="function"?e.icon(this.entityData):e.icon||"",x=typeof e.intent=="function"?e.intent(this.entityData):e.intent||"primary",p=typeof e.isActive=="function"?e.isActive(this.entityData):!!e.isActive;return e.asyncAction||window.ExtensionRegistry.executeEntityAction&&e.vfsBound?n`
                    <sutram-async-btn 
                        .label=${h}
                        .icon=${g}
                        intent="${x}" 
                        ?active=${p}
                        ?grow=${i}
                        ?fullWidth=${i}
                        .onClick=${c=>s(e,c)}>
                    </sutram-async-btn>
                `:n`
                <sutram-btn 
                    intent=${x} 
                    ?active=${p}
                    ?grow=${i}
                    ?fullWidth=${i}
                    .label=${h}
                    .icon=${g}
                    @click=${c=>{if(c&&c.stopPropagation(),e.emitEvent){const u=e.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(u.name,{detail:u.detail,bubbles:!0,composed:!0}))}else s(e,c)}}>
                </sutram-btn>
            `},b=()=>{const e={file:[],edit:[],share:[],tools:[]};t.forEach(c=>{const u=c.group&&e[c.group]?c.group:"tools";e[u].push(c)});const h={file:"File",edit:"Edit",share:"Share",tools:"Tools"},g={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},x=async(c,u)=>{await s(c,u),c.keepDrawerOpen||(this._trayOpen=!1)},p=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",m=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return n`
                <dialog class="action-tray-dialog" @cancel=${c=>{c.preventDefault(),this._trayOpen=!1}} @click=${c=>{c.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p}</span>
                                ${m?n`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(e).map(c=>e[c].length===0?"":n`
                                    <div class="tray-group-header">
                                        <sutram-icon name="${g[c]}" size="sm" style="margin-right: 6px;"></sutram-icon>${h[c]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${e[c].map(u=>{const f=typeof u.label=="function"?u.label(this.entityData):u.label,k=typeof u.icon=="function"?u.icon(this.entityData):u.icon||"",E=typeof u.intent=="function"?u.intent(this.entityData):u.intent||"primary",A=typeof u.isActive=="function"?u.isActive(this.entityData):!!u.isActive,y=v=>v?typeof v=="object"?v:v.includes("<")?n`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${v}</span>`:/^[a-zA-Z0-9-]+$/.test(v)?n`<sutram-icon name="${v}" size="sm" style="margin-right: 6px;"></sutram-icon>`:n`<span style="margin-right: 6px;">${v}</span>`:"";return u.asyncAction||window.ExtensionRegistry.executeEntityAction&&u.vfsBound?n`
                                                    <sutram-async-btn 
                                                        ?fullWidth=${!0}
                                                        .label=${f}
                                                        .icon=${k}
                                                        intent="${E}" 
                                                        ?active=${A}
                                                        .onClick=${v=>x(u,v)}>
                                                    </sutram-async-btn>
                                                `:n`
                                                <button 
                                                    class="sync-btn ${A?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${E}) 15%, transparent); color: var(--intent-${E}); border: 1px solid color-mix(in srgb, var(--intent-${E}) 40%, transparent);" 
                                                    @click=${v=>x(u,v)}>
                                                    ${y(k)}${f}
                                                </button>
                                            `})}
                                    </div>
                                `)}
                        </div>
                    </div>
                </dialog>
            `},l=n`
            ${t.length>0&&!i?n`
                <sutram-btn intent="neutral"
                    label="⋮"
                    @click=${e=>{e.stopPropagation(),this._trayOpen=!0}}>
                </sutram-btn>
            `:""}
            ${a.map(d)}
        `;return n`
            ${this.scrollable?n`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${l}
                    </div>
                </sutram-scrub-track>
            `:l}
            ${this._trayOpen?b():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends _(N){static properties={...N.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?C:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,i=>{const a=this._getId();a&&i.selectedItems&&(this.selected=i.selectedItems.has(a))});const t=this._getId(),s=this._getStore();t&&s&&s.getState().selectedItems&&(this.selected=s.getState().selectedItems.has(t))}this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const s=this._getId();if(s&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const i=this._getStore();i&&i.getState().toggleSelection&&i.getState().toggleSelection(s,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:s,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if((t.has("icon")||t.has("entityData"))&&(this.entityData?.needs_recompile||this.entityData?.is_dirty||this.entityData?.outdated)&&(!this.icon||this.icon==="alert-triangle"||this.icon==="package")&&(this.icon="construction"),super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const s=this._getId(),i=this._getStore();s&&i&&i.getState().selectedItems&&(this.selected=i.getState().selectedItems.has(s))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this.hasActions||(this.hasActions=!0),!this.actionsOpen)return;let s=this.querySelector(".sutram-injected-actions");if(s){const i=s.querySelector("sutram-entity-actions");i&&(i.entityType=this.entityType,i.entityData=this.entityData)}else{s=document.createElement("div"),s.className="sutram-injected-actions",s.slot="actions",s.style.display="flex",s.style.flexWrap="nowrap",s.style.gap="8px",s.style.alignItems="center",s.style.width="max-content",s.addEventListener("click",a=>a.stopPropagation());const i=document.createElement("sutram-entity-actions");i.style.flexWrap="nowrap",i.style.width="max-content",i.entityType=this.entityType,i.entityData=this.entityData,i.scrollable=!1,s.appendChild(i),this.appendChild(s),this.hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends Z{}customElements.get("sutram-card-group")||customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends it{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends nt{}customElements.get("sutram-spinner")||customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends rt{}customElements.get("sutram-empty-state")||customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends at{}customElements.get("sutram-board")||customElements.define("sutram-board",SutramBoard);export class SutramColumn extends ot{}customElements.get("sutram-column")||customElements.define("sutram-column",SutramColumn);export class SutramTag extends lt{}customElements.get("sutram-tag")||customElements.define("sutram-tag",SutramTag);export class SutramLabel extends ct{}customElements.get("sutram-label")||customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends pt{}customElements.get("sutram-scrub-track")||customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends mt{}customElements.get("sutram-scroll-view")||customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends X{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends dt{constructor(){super(),this.filterFn=(t,s)=>F(t,s,i=>`${i.label||""} ${i.id||""} ${i.token||""} ${i.badge||""} ${i.description||""}`)}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-action-error",t=>{window.dispatchEvent(new CustomEvent("sutram-status-update",{detail:{msg:t.detail?.msg||"Action failed",timeout:4e3,isError:!0}}))})}}customElements.define("sutram-dropdown",SutramDropdown);export class SutramTabs extends gt{connectedCallback(){super.connectedCallback(),this._tabsBridged||(this._tabsBridged=!0,this.addEventListener("yenvui-tab-selected",t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-tab-selected",{detail:t.detail,bubbles:!0,composed:!0}))}))}}customElements.get("sutram-tabs")||customElements.define("sutram-tabs",SutramTabs);export class SutramFilterDropdown extends ut{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends tt{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{t.stopPropagation(),t.target===this&&this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!1,composed:!1}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends Q{}customElements.get("sutram-category-section")||customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends et{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends st{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as L}from"./wordcount.js";const kt=[];export class SutramEditor extends _(D){static properties={...D.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const s=Array.isArray(this.customExtensions)?this.customExtensions.filter(i=>i!==L):[];this.enableWordcount&&s.push(L),this.customExtensions=s}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this._lastEmittedValue=t.detail?.value,this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("content-changed",{detail:t.detail,bubbles:!0,composed:!0})),this.dispatchEvent(new Event("input",{bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-selection",t=>{this.dispatchEvent(new CustomEvent("editor-selection",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-scroll",t=>{this.dispatchEvent(new CustomEvent("editor-scroll",{detail:t.detail,bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-editor-link-clicked",t=>{this.dispatchEvent(new CustomEvent("editor-link-clicked",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends S{static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[$,w`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const s=++this._lastSearchReq;B.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:i})=>{s===this._lastSearchReq&&(this._filteredItems=(i||[]).slice(0,50))})}}render(){if(!this.open)return n``;const t=this._filteredItems||[];return n`
            <sutram-modal open titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <sutram-stack slot="body" direction="col" gap="sm" ?flex=${!0}>
                    <sutram-input placeholder="Search..." ?flush=${!0} .value=${this._searchQuery} @sutram-input-changed=${s=>this._searchQuery=s.detail.value}></sutram-input>
                    <sutram-stack direction="col" gap="xs" ?flex=${!0} ?scrollable=${!0}>
                        ${t.length===0?n`<sutram-empty-state text="No matches found."></sutram-empty-state>`:t.map(s=>{const i=typeof s=="string"?s:s.label||s;return n`
                                <sutram-surface variant="inset" padding="sm" ?interactive=${!0}
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:s},bubbles:!0,composed:!0}))}}>
                                    <sutram-stack direction="row" align="center" gap="sm">
                                        <sutram-icon name="file" size="sm" intent="primary"></sutram-icon>
                                        <sutram-label ?monospace=${!0} intent="neutral" .text=${i}></sutram-label>
                                    </sutram-stack>
                                </sutram-surface>
                            `})}
                    </sutram-stack>
                </sutram-stack>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends S{static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[$,w`
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
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,s=this.tabs.find(i=>i.id===t)||this.tabs[0];return s&&s.content||""}return this.content||""}render(){const t=this._getActiveContent(),s=this.tabs&&this.tabs.length>1,i=this.activeTab||this.tabs&&this.tabs[0]?.id||"",a=this.suggestedFilename||`report_${Date.now()}.txt`;return n`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: var(--mobile-edge-padding, 15px); gap: 10px;">
                ${this.caption?n`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${s?n`
                    <sutram-stack direction="row" gap="sm">
                        ${this.tabs.map(r=>n`
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
                ${this.extraContent?n`<div style="flex-shrink: 0;">${this.extraContent}</div>`:""}
                <sutram-surface variant="panel" padding="xs" align="end">
                    <sutram-entity-actions
                        ?scrollable=${!0}
                        .entityType=${"text_blob"}
                        .entityData=${{textContent:t,suggestedFilename:a}}>
                    </sutram-entity-actions>
                </sutram-surface>
            </div>
            ${this.actions&&this.actions.length>0?n`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(r=>r.asyncAction?n`
                                <sutram-async-btn
                                    .icon=${r.icon}
                                    .label=${r.label}
                                    intent="${r.intent||"primary"}"
                                    ?grow=${!0}
                                    ?emphasis=${!!r.primary}
                                    ?disabled=${r.disabled}
                                    .onClick=${r.asyncAction}>
                                </sutram-async-btn>
                            `:n`
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
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends _(ht){}customElements.define("sutram-diff-viewer",SutramDiffViewer);export class SutramSubtabMenu extends S{static properties={slotConfig:{type:Object},_menuItems:{type:Array,state:!0},_selectedCount:{type:Number,state:!0}};static styles=[$,w`
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
    `];constructor(){super(),this.slotConfig=null,this._menuItems=[],this._selectedCount=0,this._selectedItems=new Map}connectedCallback(){super.connectedCallback(),this.subscribe(C,t=>t.selectedItems||new Map,t=>{this._selectedItems=t,this._rebuildMenu()}),this.subscribe(I,t=>t.isOffline,()=>{this._rebuildMenu()}),this.registerGlobalListener("sutram-subtab-menu-refresh",window,()=>{this._rebuildMenu()}),this._selectedItems=C.getState()?.selectedItems||new Map,this._rebuildMenu()}_bindSlotMenuStores(){this._slotStoreUnsubs&&this._slotStoreUnsubs.forEach(s=>s()),this._slotStoreUnsubs=[],(this.slotConfig?.menuStores||[]).forEach(s=>{const i=this.subscribe(s,()=>{this._rebuildMenu()});this._slotStoreUnsubs.push(i)})}disconnectedCallback(){super.disconnectedCallback(),this._slotStoreUnsubs=[]}willUpdate(t){super.willUpdate(t),t.has("slotConfig")&&(this._bindSlotMenuStores(),this._rebuildMenu())}_rebuildMenu(){const t=this.slotConfig||{},s=this._selectedItems||new Map,i=Array.from(s.values()),a=Array.isArray(t.bulkEntityTypes)&&t.bulkEntityTypes.length>0?t.bulkEntityTypes:null,r=a?i.filter(l=>String(l?.entityType||"").split(":").some(h=>a.includes(h))):i;this._selectedCount=t.bulkActionGroup?r.length:0;const d=[];if(t.bulkActionGroup&&r.length>0){const l=window.ExtensionRegistry?.getAggregatableActions?window.ExtensionRegistry.getAggregatableActions(r,{group:t.bulkActionGroup}):[];l.length>0&&(l.forEach(e=>d.push(e)),d.push({divider:!0})),d.push({label:`Clear Selection (${r.length})`,icon:"x",onClick:()=>C.getState().clearSelection()}),d.push({divider:!0})}for((typeof t.menuActions=="function"?t.menuActions(t):Array.isArray(t.menuActions)?t.menuActions:[]).forEach(l=>{if(l){if(l.divider){d.push({divider:!0});return}d.push({...l,onClick:l.onClick||(l.emitEvent?()=>{const e=typeof l.emitEvent=="function"?l.emitEvent(t):l.emitEvent;typeof e=="string"?window.dispatchEvent(new CustomEvent(e,{bubbles:!0,composed:!0})):e&&e.name&&window.dispatchEvent(new CustomEvent(e.name,{detail:e.detail,bubbles:!0,composed:!0}))}:null)})}});d.length>0&&d[d.length-1].divider;)d.pop();this._menuItems=d}render(){if(!this._menuItems||this._menuItems.length===0)return n``;const t=this._selectedCount||0;return n`
            <sutram-dropdown align="right" .items=${this._menuItems}>
                <button slot="trigger" class="subtab-menu-trigger" @pointerdown=${()=>this._rebuildMenu()} title="${t>0?`Bulk Actions (${t} selected)`:"Actions"}">
                    ${t>0?n`
                        <sutram-icon name="layers" size="sm" intent="warning"></sutram-icon>
                        <span class="subtab-badge">${t>9?"9+":t}</span>
                    `:n`
                        <sutram-icon name="menu" size="sm"></sutram-icon>
                    `}
                </button>
            </sutram-dropdown>
        `}}customElements.get("sutram-subtab-menu")||customElements.define("sutram-subtab-menu",SutramSubtabMenu);export class SutramDagTree extends S{static properties={stages:{type:Array},rootNode:{type:Object},nodes:{type:Array},renderNode:{type:Object},compact:{type:Boolean,reflect:!0}};static styles=[$,w`
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
    `];constructor(){super(),this.stages=[],this.rootNode=null,this.nodes=[],this.renderNode=null,this.compact=!1}_renderDefaultStageNode(t,s){if(typeof this.renderNode=="function")return this.renderNode(t,s);const i=typeof t=="string"?t:t.title||t.label||t.id||t.name||"node",a=typeof t=="object"&&Array.isArray(t.badges)?t.badges:[],r=typeof t=="object"&&t.subtitle?String(t.subtitle):"",d=typeof t=="object"&&Array.isArray(t.parents)?t.parents:[];return n`
            <div class="dag-node-card" @click=${()=>this.dispatch("sutram-dag-node-clicked",{node:t,stageIdx:s})}>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="font-weight: bold; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text);">${i}</span>
                    ${a.length>0?n`
                        <div style="display: inline-flex; gap: 4px; align-items: center;">
                            ${a.map(b=>{const l=typeof b=="string"?b:b?.text||"",e=typeof b=="object"&&b?.intent?b.intent:"primary";return l?n`<sutram-tag text=${l} intent=${e}></sutram-tag>`:""})}
                        </div>
                    `:""}
                </div>
                ${r?n`<div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--intent-warning);">${r}</div>`:""}
                ${d.length>0?n`
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-top: 2px;">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">🔗 Parents:</span>
                        ${d.map(b=>n`<span style="font-size: 0.7rem; font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px;">${b}</span>`)}
                    </div>
                `:""}
            </div>
        `}_renderHierarchyBranch(t,s,i=0,a=!0){if(!t)return"";const r=t.id,d=s[r]||[];return n`
            <div class="tree-branch" style="--branch-indent: ${i>0?"28px":"0px"};">
                ${i>0?n`
                    <div class="tree-line-v ${a?"last":""}"></div>
                    <div class="tree-line-h"></div>
                `:""}
                ${typeof this.renderNode=="function"?this.renderNode(t,i):this._renderDefaultStageNode(t,i)}
                ${d.length>0?n`
                    <div style="display: flex; flex-direction: column; margin-left: ${i===0?"8px":"0px"};">
                        ${d.map((b,l)=>this._renderHierarchyBranch(b,s,i+1,l===d.length-1))}
                    </div>
                `:""}
            </div>
        `}render(){if(Array.isArray(this.stages)&&this.stages.length>0)return n`
                ${this.stages.map((t,s)=>{const i=Array.isArray(t)?t:[t],a=i.length>1,r=a?"var(--intent-highlight)":s===0?"var(--intent-primary)":"var(--intent-success)";return n`
                        ${s>0?n`<div class="stage-connector">↓</div>`:""}
                        <div class="wavefront-stage" style="--stage-accent: ${r};">
                            <div class="wavefront-header">
                                <span class="wavefront-title">
                                    <sutram-icon name=${a?"git-branch":"layers"} size="sm" style="color: ${r};"></sutram-icon>
                                    <span>Wavefront Stage ${s+1}${s===0?" (Root)":""}</span>
                                </span>
                                <sutram-tag
                                    text=${a?`\u2225 Parallel Stage (${i.length} branches)`:"Sequential Step"}
                                    intent=${a?"highlight":"neutral"}>
                                </sutram-tag>
                            </div>
                            <div class="wavefront-grid">
                                ${i.map(d=>this._renderDefaultStageNode(d,s))}
                            </div>
                        </div>
                    `})}
            `;if(this.rootNode){const s=(Array.isArray(this.nodes)?this.nodes:[]).reduce((i,a)=>{const r=a.parentId||a.parent_id;return r&&(i[r]||(i[r]=[]),i[r].push(a)),i},{});return n`${this._renderHierarchyBranch(this.rootNode,s,0,!0)}`}return n`<slot></slot>`}}customElements.get("sutram-dag-tree")||customElements.define("sutram-dag-tree",SutramDagTree);export class SutramFloatingHud extends S{static properties={position:{type:String,reflect:!0},icon:{type:String},badgeText:{type:String},titleText:{type:String},intent:{type:String,reflect:!0},open:{type:Boolean,reflect:!0}};static styles=[$,w`
        :host {
            position: absolute;
            z-index: 60;
            display: inline-flex;
            flex-direction: column;
            pointer-events: auto;
            max-width: calc(100% - 24px);
            box-sizing: border-box;
            --hud-accent: var(--intent-primary);
        }
        :host([position="top-right"]), :host(:not([position])) {
            top: 12px;
            right: 16px;
            align-items: flex-end;
        }
        :host([position="top-left"]) {
            top: 12px;
            left: 16px;
            align-items: flex-start;
        }
        :host([position="bottom-right"]) {
            bottom: 12px;
            right: 16px;
            align-items: flex-end;
        }
        :host([position="bottom-left"]) {
            bottom: 12px;
            left: 16px;
            align-items: flex-start;
        }
        :host([intent="primary"]) { --hud-accent: var(--intent-primary); }
        :host([intent="success"]) { --hud-accent: var(--intent-success); }
        :host([intent="warning"]) { --hud-accent: var(--intent-warning); }
        :host([intent="danger"]) { --hud-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --hud-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --hud-accent: var(--intent-neutral); }

        .hud-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 9999px;
            background: color-mix(in srgb, var(--pane-bg) 92%, transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid color-mix(in srgb, var(--hud-accent) 45%, var(--border));
            color: var(--text);
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: var(--overlay-shadow);
            user-select: none;
            transition: border-color 0.15s ease, transform 0.1s ease;
        }
        .hud-pill:hover {
            border-color: var(--hud-accent);
        }
        .hud-drawer {
            margin-top: 6px;
            width: 340px;
            max-width: calc(100vw - 32px);
            max-height: 60vh;
            overflow-y: auto;
        }
    `];constructor(){super(),this.position="top-right",this.icon="activity",this.badgeText="",this.titleText="",this.intent="primary",this.open=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1,this.dispatch("sutram-hud-toggled",{open:!1}))})}_toggleHud(t){t&&t.stopPropagation(),this.open=!this.open,this.dispatch("sutram-hud-toggled",{open:this.open})}render(){return n`
            <button type="button" class="hud-pill" @click=${t=>this._toggleHud(t)}>
                ${this.icon?n`<sutram-icon name=${this.icon} size="sm" intent=${this.intent||"primary"}></sutram-icon>`:""}
                ${this.badgeText?n`<span>${this.badgeText}</span>`:""}
                <sutram-icon name=${this.open?"chevron-up":"chevron-down"} size="xs" intent="muted"></sutram-icon>
            </button>
            ${this.open?n`
                <sutram-surface class="hud-drawer" variant="floating" .intent=${this.intent||"primary"} padding="md" gap="sm" @click=${t=>t.stopPropagation()}>
                    <sutram-stack direction="row" justify="between" align="center" gap="sm">
                        <sutram-stack direction="row" align="center" gap="xs">
                            ${this.icon?n`<sutram-icon name=${this.icon} size="sm" intent=${this.intent||"primary"}></sutram-icon>`:""}
                            <span style="font-weight: 700; font-size: 0.85rem;">${this.titleText||this.badgeText||"Status"}</span>
                        </sutram-stack>
                        <slot name="header"></slot>
                    </sutram-stack>
                    <slot></slot>
                    <slot name="footer"></slot>
                </sutram-surface>
            `:""}
        `}}customElements.get("sutram-floating-hud")||customElements.define("sutram-floating-hud",SutramFloatingHud);
