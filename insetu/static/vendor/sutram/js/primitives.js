import{LitElement as D,html as a,css as $}from"lit";import{SutramElement as S,SutramContextMixin as v,SelectionStore as k,ToastStore as A,EnvironmentStore as B}from"./sutram_sdk.js";import{YenvuiBtn as L,YenvuiAsyncBtn as T}from"../../yenvui/js/async-btn.js";import{YenvuiStatusBar as R}from"../../yenvui/js/status-bar.js";import{YenvuiToastContainer as N}from"../../yenvui/js/toast.js";import{YenvuiModal as Y}from"../../yenvui/js/modal.js";import{YenvuiWindow as M}from"../../yenvui/js/window.js";import{YenvuiCategorySection as F}from"../../yenvui/js/category-section.js";import{YenvuiCard as z}from"../../yenvui/js/card.js";import{YenvuiCardGroup as U}from"../../yenvui/js/card-group.js";import{YenvuiEditor as j}from"../../yenvui/js/editor.js";import{YenvuiToolbar as q}from"../../yenvui/js/toolbar.js";import{YenvuiCollapsible as W}from"../../yenvui/js/collapsible.js";import{YenvuiPill as J}from"../../yenvui/js/pill.js";import{YenvuiFilterGroup as P}from"../../yenvui/js/filter-group.js";import"../../yenvui/js/selection-tray.js";import{YenvuiSearchBar as K}from"../../yenvui/js/search-bar.js";import{YenvuiSpinner as Q}from"../../yenvui/js/spinner.js";import{YenvuiEmptyState as G}from"../../yenvui/js/empty-state.js";import{YenvuiBoard as H,YenvuiColumn as V}from"../../yenvui/js/board.js";import{YenvuiTag as Z}from"../../yenvui/js/tag.js";import{YenvuiLabel as X}from"../../yenvui/js/label.js";import{YenvuiDropdown as tt,YenvuiFilterDropdown as et}from"../../yenvui/js/dropdown.js";import{YenvuiScrubTrack as it}from"../../yenvui/js/yenvui-base.js";import{YenvuiScrollView as st}from"../../yenvui/js/scroll-view.js";import{YenvuiDiffViewer as nt}from"../../yenvui/js/diff-viewer.js";import{sharedStyles as E}from"./shared_styles.js";import{resolveDirectoryState as at,SutramWorker as O}from"./utils.js";import"lit-virtualizer";export class SutramVirtualList extends D{static properties={items:{type:Array},renderItem:{type:Object}};static styles=$`
        :host { display: flex; flex-direction: column; width: 100%; flex: 1; min-width: 0; }
        lit-virtualizer { width: 100%; flex: 1; min-width: 0; }
    `;render(){return!this.items||this.items.length===0?a``:a`
            <lit-virtualizer
                scroller
                .items=${this.items}
                .renderItem=${this.renderItem}>
            </lit-virtualizer>
        `}}customElements.define("sutram-virtual-list",SutramVirtualList);export class SutramBtn extends L{}customElements.define("sutram-btn",SutramBtn);export class SutramAsyncBtn extends v(T){static properties={...T.properties,_isOfflineReadOnly:{type:Boolean},_originalLabel:{type:String}};constructor(){super(),this._isOfflineReadOnly=!1,this._originalLabel=""}connectedCallback(){super.connectedCallback(),this._originalLabel=this.label,this.subscribe(B,t=>{if(t.isOffline){let i=this,n=null;for(;i;){if(i.dataset&&i.dataset.ext){n=i.dataset.ext;break}i=i.getRootNode().host||i.parentElement}const o=n&&window.ExtensionRegistry?.getExtension(n)?.offline_mode;this._isOfflineReadOnly=o==="read_only"||o==="none"||!o}else this._isOfflineReadOnly=!1;this._updateState()})}updated(t){super.updated(t),t.has("label")&&this.label!=="Offline"&&!this._isOfflineReadOnly&&(this._originalLabel=this.label),t.has("icon")&&this.icon!=="wifi-off"&&!this._isOfflineReadOnly&&(this._originalIcon=this.icon)}_updateState(){this._isOfflineReadOnly?(this.label!=="Offline"&&(this._originalLabel=this.label),this.icon!=="wifi-off"&&(this._originalIcon=this.icon),this.label="Offline",this.icon="wifi-off",this.disabled=!0):(this.label=this._originalLabel||this.label,this._originalIcon!==void 0&&(this.icon=this._originalIcon),this.disabled=!1)}async _handleClick(t){if(this.disabled||this.status==="loading"){t&&(t.stopPropagation(),t.preventDefault());return}if(this.jobRoute&&typeof window.ExtensionRegistry?.executeJobAction=="function"){this.status="loading";try{const i=typeof this.jobPayload=="function"?await this.jobPayload(t):this.jobPayload||{};await window.ExtensionRegistry.executeJobAction(this.jobRoute,i,{onProgress:(o,l)=>{this.onJobProgress&&this.onJobProgress(o,l)},onComplete:o=>{this.status="success",this.onJobComplete&&this.onJobComplete(o),setTimeout(()=>{this.status="idle"},2e3)},onError:o=>{this.status="error",this.onJobError&&this.onJobError(o),setTimeout(()=>{this.status="idle"},2e3)}})(t);return}catch(i){if(this.status="error",typeof this.onJobError=="function")try{this.onJobError(i)}catch{}console.error("[SutramAsyncBtn] Job dispatch error:",i),setTimeout(()=>{this.status="idle"},2e3);return}}return super._handleClick(t)}}customElements.define("sutram-async-btn",SutramAsyncBtn);export class SutramStatusBar extends v(R){static properties={...R.properties,baseTitle:{type:String},statusString:{type:String},tempMessage:{type:String}};constructor(){super(),this.baseTitle="System Online",this.statusString="",this.tempMessage="",this._statusListener=this._handleStatusUpdate.bind(this),this._syncListener=t=>{this.syncState=t.detail.state}}connectedCallback(){super.connectedCallback(),this.registerGlobalListener("sutram-status-update",window,this._statusListener),this.registerGlobalListener("sutram-sync-status",window,this._syncListener),this._updateDisplayedText()}updated(t){super.updated(t),(t.has("baseTitle")||t.has("statusString")||t.has("tempMessage"))&&this._updateDisplayedText()}_handleStatusUpdate(t){this.tempMessage=t.detail.msg,this.isError=t.detail.isError,this._timeout&&clearTimeout(this._timeout),t.detail.timeout&&(this._timeout=setTimeout(()=>{this.tempMessage="",this.isError=!1,this._updateDisplayedText()},t.detail.timeout)),this._updateDisplayedText()}_updateDisplayedText(){this.tempMessage?this.text=this.tempMessage:this.text=this.statusString?`${this.baseTitle} | ${this.statusString}`:this.baseTitle}}customElements.define("sutram-status-bar",SutramStatusBar);export class SutramToastContainer extends v(N){connectedCallback(){super.connectedCallback(),this.subscribe(A,t=>{this.toasts=t.toasts}),this.addEventListener("yenvui-toast-dismissed",t=>{A.getState().removeToast(t.detail.id)})}}customElements.define("sutram-toast-container",SutramToastContainer);export class SutramSelectionTray extends S{static properties={selectedItems:{type:Object},modalOpen:{type:Boolean}};static styles=[E,$`
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
    `];constructor(){super(),this.selectedItems=new Map,this.modalOpen=!1}connectedCallback(){super.connectedCallback(),this.subscribe(k,t=>{this.selectedItems=t.selectedItems,this.selectedItems.size===0&&(this.modalOpen=!1),this.requestUpdate()}),this.selectedItems=k.getState().selectedItems}render(){const t=this.selectedItems.size,i=Array.from(this.selectedItems.values());let n=0,o=!1;const l=window.ExtensionRegistry;i.forEach(s=>{const e=s.data?.size_bytes||(l?.executeUIHook?l.executeUIHook("sutram:resolve-item-size",s.data):null);e?n+=e:o=!0});let f="";n>0?f=`~${Math.round(n/1024)} kb${o?"+":""}`:o&&(f="Calculated on compile");let g=[];return l&&(typeof l.getAggregatableActions=="function"&&(g=l.getAggregatableActions(i,{group:"share"})),l._manifests&&l._manifests.forEach(s=>{s.batchActions&&s.batchActions.forEach(e=>{!g.some(m=>m.id===e.id)&&e.match(i)&&g.push({...e,onClick:e.onClick?m=>e.onClick(i,m):null,asyncAction:e.asyncAction?m=>e.asyncAction(i,m):null})})})),g.sort((s,e)=>(s.order||99)-(e.order||99)),a`
            ${t>0?a`
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
                        <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">Quickpack Deck <span class="cart-badge" style="display: inline-flex; margin-left: 8px;">${t}</span></span>${f?a`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f}</span>`:""}
                    </div>
                    <button class="sync-btn" @click=${()=>this.modalOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                </div>
                <div class="tray-items">
                    ${i.map(s=>{const e=s.data?.filepath||s.data?.folderpath||s.data?.id||"",m=String(e).replace(/\/+$/,""),p=s.data?.titleText||m.split("/").pop()||"Unknown Item",u=s.key||e,h=s.data?.size_bytes||(l?.executeUIHook?l.executeUIHook("sutram:resolve-item-size",s.data):null),d=h?`${Math.round(h/1024)} kb`:"";return a`
                        <div class="tray-item">
                            <div class="tray-item-info">
                                <div class="tray-item-title">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="pack-tag">PACK</span> ${p}</div>${d?a`<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem; font-family: monospace;">${d}</span>`:""}
                                </div>
                                <div class="tray-item-path">${e}</div>
                            </div>
                            <button class="btn-sm" style="background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;" @click=${()=>k.getState().toggleSelection(u,s.entityType,s.data)}>✕</button>
                        </div>
                    `})}
                </div>
                <div class="tray-footer">
                    <sutram-async-btn label="Clear" intent="danger" .onClick=${()=>{k.getState().clearSelection(),this.modalOpen=!1}} style="margin-right: auto;"></sutram-async-btn>
                    ${g.map(s=>a`
                        <sutram-async-btn  
                            .label=${s.label}
                            .icon=${s.icon}
                            intent="${s.intent||"primary"}" 
                            variant="${s.variant||"tinted"}"
                            ?emphasis=${s.emphasis}
                            .onClick=${async e=>{s.asyncAction?await s.asyncAction(e):s.onClick&&s.onClick(e)}}>
                        </sutram-async-btn>
                    `)}
                </div>
            </div>
        `}}customElements.define("sutram-selection-tray",SutramSelectionTray);export class SutramCategorizedList extends D{static properties={items:{type:Array},categoryKey:{type:String},categoryOrder:{type:Array},renderItem:{type:Object},renderCategoryHeader:{type:Object}};static styles=[E];render(){if(!this.items||this.items.length===0)return a``;const t={};this.items.forEach(n=>{const o=n[this.categoryKey]||"Uncategorized";t[o]||(t[o]=[]),t[o].push(n)});const i=Object.keys(t).sort((n,o)=>{const l=this.categoryOrder||[];let f=l.indexOf(n),g=l.indexOf(o);return f===-1&&(f=999),g===-1&&(g=999),f!==g?f-g:n.localeCompare(o)});return a`
            <div style="display: flex; flex-direction: column;">
                ${i.map(n=>a`
                    <yenvui-category-section titleText=${n}>
                        ${this.renderCategoryHeader?this.renderCategoryHeader(n):""}
                        <yenvui-card-group>
                            ${t[n].map(o=>this.renderItem(o))}
                        </yenvui-card-group>
                    </yenvui-category-section>
                `)}
            </div>
        `}}customElements.define("sutram-categorized-list",SutramCategorizedList);export class SutramFolderBrowser extends D{static properties={files:{type:Array},currentPath:{type:Array},_treeData:{type:Object,state:!0}};constructor(){super(),this.files=[],this.currentPath=[],this._treeData={},this._lastReqId=0}updated(t){if(super.updated(t),t.has("files")){const i=++this._lastReqId;O.dispatch("BUILD_TREE",{items:this.files||[]}).then(({tree:n})=>{i===this._lastReqId&&(this._treeData=n||{})})}}createRenderRoot(){return this}_setPath(t){this.currentPath=t,this.dispatchEvent(new CustomEvent("path-changed",{detail:{path:t.join("/")},bubbles:!0,composed:!0}))}render(){const{validPath:t,entries:i}=at(this._treeData,this.currentPath,{hideFiles:!0});return t.length!==(this.currentPath||[]).length&&(this.currentPath=t),a`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow: hidden;">
                <sutram-btn intent="neutral" icon="corner-left-up" label="Up" ?disabled=${t.length===0} @click=${()=>this._setPath(t.slice(0,-1))}></sutram-btn>
                <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.9rem;">
                    /${t.join("/")}
                </yenvui-scrub-track>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${i.length===0?a`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>`:i.map(n=>a`
                    <div class="yv-interactive-row" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 4px;" 
                        @click=${()=>this._setPath([...t,n.name])}>
                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${n.name}</span>
                    </div>
                `)}
            </div>
        `}}customElements.define("sutram-folder-browser",SutramFolderBrowser);export class SutramModal extends v(Y){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-modal-closed",t=>{this.dispatchEvent(new CustomEvent("sutram-modal-closed",{bubbles:!0,composed:!0}))})}}customElements.define("sutram-modal",SutramModal);export class SutramWindow extends v(M){connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-window-close",t=>this.dispatchEvent(new CustomEvent("sutram-window-closed",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-span",t=>this.dispatchEvent(new CustomEvent("sutram-window-span",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-focused",t=>this.dispatchEvent(new CustomEvent("sutram-window-focused",{bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-drag-start",t=>this.dispatchEvent(new CustomEvent("sutram-window-drag-start",{detail:t.detail,bubbles:!0,composed:!0}))),this.addEventListener("yenvui-window-dock",t=>this.dispatchEvent(new CustomEvent("sutram-window-dock",{bubbles:!0,composed:!0})))}}customElements.define("sutram-window",SutramWindow);export class SutramSettingsForm extends S{static properties={extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String},filterQuery:{type:String},hideSaveButton:{type:Boolean},_jsonBuffers:{type:Object}};static styles=[E,$`
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
    `];constructor(){super(),this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo="",this.filterQuery="",this.hideSaveButton=!1,this._jsonBuffers={}}willUpdate(t){(t.has("extName")||t.has("selectedRepo"))&&(this._jsonBuffers={})}_emitFormMutation(t){this.formData=t,this.dispatchEvent(new CustomEvent("sutram-settings-form-changed",{detail:{extName:this.extName,formData:this.formData,repo:this.selectedRepo},bubbles:!0,composed:!0})),this.requestUpdate()}async triggerSave(t){const n=(this.schema||[]).some(o=>o&&o.type!=="hidden"&&o.scope==="repo")&&(this.selectedRepo||this.repos&&this.repos[0])||"";return new Promise((o,l)=>{this.dispatchEvent(new CustomEvent("sutram-settings-save",{detail:{extName:this.extName,schema:this.schema,formData:this.formData,repo:n,resolve:o,reject:l,originalEvent:t},bubbles:!0,composed:!0}))})}_renderScopeBadge(t){const i=[];t.secure&&i.push(a`<sutram-tag text="secure" intent="warning"></sutram-tag>`);const n=t.scope||"workspace";return n==="daemon"?i.push(a`<sutram-tag text="daemon" intent="neutral"></sutram-tag>`):n==="repo"?i.push(a`<sutram-tag text="repo" intent="highlight"></sutram-tag>`):i.push(a`<sutram-tag text="workspace" intent="primary"></sutram-tag>`),a`<div style="display: inline-flex; gap: 6px; align-items: center;">${i}</div>`}render(){const i=window.ExtensionRegistry?._manifests?.get(this.extName),n=(i?.settingsActions||[]).filter(e=>!e.id.endsWith("_generic_settings")),o=(this.filterQuery||"").trim().toLowerCase(),l=(this.schema||[]).filter(e=>!e||e.type==="hidden"?!1:o?[e.label,e.title,e.id,e.description,e.desc].filter(Boolean).join(" ").toLowerCase().includes(o):!0),f=(this.schema||[]).some(e=>e&&e.type!=="hidden"&&e.scope==="repo"),g=this.selectedRepo||this.repos&&this.repos[0]||"",s=f&&(!this.repos||this.repos.length===0);return a`
            ${f?a`
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: color-mix(in srgb, var(--intent-highlight) 10%, var(--input-bg)); border: 1px solid color-mix(in srgb, var(--intent-highlight) 35%, var(--border)); border-radius: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: bold; color: var(--text);">
                        <yv-icon name="package" style="width: 16px; height: 16px; color: var(--intent-highlight);"></yv-icon>
                        <span>Target Repository Scope</span>
                    </div>
                    ${s?a`
                        <span style="font-size: 0.8rem; color: var(--intent-warning); font-style: italic;">
                            Add a repository in Workspace Manager to configure repository-scoped settings.
                        </span>
                    `:a`
                        <sutram-select
                            .value=${g}
                            .options=${(this.repos||[]).map(e=>({value:e,label:e}))}
                            ?flush=${!0}
                            style="min-width: 200px; margin: 0;"
                            @sutram-input-changed=${e=>{this.selectedRepo=e.detail.value,this.dispatchEvent(new CustomEvent("sutram-settings-repo-changed",{detail:{extName:this.extName,repo:e.detail.value},bubbles:!0,composed:!0}))}}>
                        </sutram-select>
                    `}
                </div>
            `:""}

            ${o?"":n.map(e=>a`
                <div class="field-card">
                    <div class="field-header">
                        <span style="font-size: 0.95rem; color: var(--text); font-weight: bold; display: flex; align-items: center; gap: 8px;">
                            ${e.icon?/^[a-zA-Z0-9-]+$/.test(e.icon)?a`<yv-icon name="${e.icon}" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>`:e.icon:""}
                            <span>${e.label}</span>
                        </span>
                        <sutram-async-btn label="Open Panel" icon="external-link" intent="primary" size="sm" .onClick=${async m=>{this.dispatchEvent(new CustomEvent("sutram-settings-custom-action",{detail:{action:e,originalEvent:m},bubbles:!0,composed:!0})),e.onClick&&await e.onClick(m)}}></sutram-async-btn>
                    </div>
                </div>
            `)}

            ${l.map(e=>{const m=e.scope==="repo"&&s,p=this.formData&&this.formData[e.id]!==void 0?this.formData[e.id]:e.default,u=e.title||e.label||e.id;let h="";if(e.type==="action")h=a`
                        <sutram-async-btn
                            label=${e.button_label||e.label||"Execute Action"}
                            intent=${e.intent||"primary"}
                            ?disabled=${m}
                            .onClick=${async d=>new Promise((r,y)=>{this.dispatchEvent(new CustomEvent("sutram-settings-action",{detail:{extName:this.extName,field:e,resolve:r,reject:y,originalEvent:d},bubbles:!0,composed:!0}))})}>
                        </sutram-async-btn>
                    `;else if(e.type==="boolean")h=a`
                        <sutram-toggle
                            .checked=${!!p}
                            ?disabled=${m}
                            ?flush=${!0}
                            @sutram-input-changed=${d=>this._emitFormMutation({...this.formData,[e.id]:d.detail.value})}>
                        </sutram-toggle>
                    `;else if(e.type==="select"){const d=(e.options||[]).map(r=>({value:r.value!==void 0?r.value:r,label:r.label||r.title||r.value||r}));h=a`
                        <sutram-select
                            .value=${p??""}
                            .options=${d}
                            ?disabled=${m}
                            ?flush=${!0}
                            @sutram-input-changed=${r=>this._emitFormMutation({...this.formData,[e.id]:r.detail.value})}>
                        </sutram-select>
                    `}else if(e.type==="number")h=a`
                        <sutram-input
                            type="number"
                            .value=${p!=null&&!Number.isNaN(p)?String(p):""}
                            ?disabled=${m}
                            ?flush=${!0}
                            @sutram-input-changed=${d=>{const r=d.detail.value,y=r===""?"":Number(r);this._emitFormMutation({...this.formData,[e.id]:Number.isNaN(y)?e.default??0:y})}}>
                        </sutram-input>
                    `;else if(e.type==="intent_map"){const d=Array.isArray(e.intent_legend)&&e.intent_legend.length>0?e.intent_legend:["primary","success","warning","danger","highlight","neutral"],r=typeof p=="object"&&p!==null?p:e.default||{};h=a`
                        <div class="intent-grid">
                            ${d.map(y=>{const x=Array.isArray(r[y])?r[y]:[];return a`
                                    <div class="intent-row">
                                        <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: var(--intent-${y}); display: flex; align-items: center; gap: 6px;">
                                            ● ${y.toUpperCase()}
                                        </span>
                                        <sutram-input
                                            .value=${x.join(", ")}
                                            placeholder="Comma-separated keywords..."
                                            ?disabled=${m}
                                            ?flush=${!0}
                                            @sutram-input-changed=${w=>{const _=w.detail.value.split(",").map(b=>b.trim()).filter(Boolean),C={...r,[y]:_};this._emitFormMutation({...this.formData,[e.id]:C})}}>
                                        </sutram-input>
                                    </div>
                                `})}
                        </div>
                    `}else if(e.type==="string_list"){const d=Array.isArray(p)?p.join(", "):p||"";h=a`
                        <sutram-input
                            .value=${d}
                            placeholder=${e.placeholder||"Comma-separated values..."}
                            ?disabled=${m}
                            ?flush=${!0}
                            @sutram-input-changed=${r=>{const y=r.detail.value.split(",").map(x=>x.trim()).filter(Boolean);this._emitFormMutation({...this.formData,[e.id]:y})}}>
                        </sutram-input>
                    `}else if(e.type==="object"||e.type==="json"||typeof p=="object"&&p!==null){const d=this._jsonBuffers[e.id]!==void 0?this._jsonBuffers[e.id]:typeof p=="object"&&p!==null?JSON.stringify(p,null,2):p||"";h=a`
                        <sutram-textarea
                            .value=${d}
                            .monospace=${!0}
                            .minRows=${4}
                            ?disabled=${m}
                            ?flush=${!0}
                            @sutram-input-changed=${r=>{this._jsonBuffers={...this._jsonBuffers,[e.id]:r.detail.value};try{const y=JSON.parse(r.detail.value);this._emitFormMutation({...this.formData,[e.id]:y})}catch{this.requestUpdate()}}}>
                        </sutram-textarea>
                    `}else{const d=e.secure&&p==="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",r=e.type==="password"||e.secure?"password":"text";h=a`
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <sutram-input
                                type="${r}"
                                style="flex: 1; margin: 0;"
                                .value=${p??""}
                                placeholder=${e.secure?"Enter secret key...":e.placeholder||""}
                                ?disabled=${m}
                                ?flush=${!0}
                                @sutram-input-changed=${y=>this._emitFormMutation({...this.formData,[e.id]:y.detail.value})}>
                            </sutram-input>
                            ${d?a`
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
                    `}return a`
                    <div class="field-card">
                        <div class="field-header">
                            <label style="font-size: 0.9rem; color: var(--text); font-weight: bold; margin: 0;">${u}</label>
                            ${this._renderScopeBadge(e)}
                        </div>
                        ${h}
                        ${e.description||e.desc?a`
                            <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                                ${e.description||e.desc}
                            </div>
                        `:""}
                    </div>
                `})}

            ${!this.hideSaveButton&&l.some(e=>e.type!=="action")?a`
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
        `}}customElements.define("sutram-settings-form",SutramSettingsForm);export class SutramGenericSettingsModal extends S{static properties={open:{type:Boolean,reflect:!0},extName:{type:String},schema:{type:Array},formData:{type:Object},repos:{type:Array},selectedRepo:{type:String}};static styles=[E,$`:host { display: contents; }`];constructor(){super(),this.open=!1,this.extName="",this.schema=[],this.formData={},this.repos=[],this.selectedRepo=""}openModal(t,i,n,o=[],l=""){this.extName=t,this.schema=i||[],this.formData=n||{},this.repos=o||[],this.selectedRepo=l||this.repos[0]||"",this.open=!0,this.requestUpdate()}render(){if(!this.open)return a``;const n=(window.ExtensionRegistry?._manifests?.get(this.extName)?.name||this.extName)+" Settings";return a`
            <yenvui-modal
                ?open=${!0}
                titleText=${n}
                ?fullscreen=${!0}
                @yenvui-modal-closed=${o=>{o.target===o.currentTarget&&(this.open=!1)}}>
                <div slot="body">
                    <sutram-settings-form
                        .extName=${this.extName}
                        .schema=${this.schema}
                        .formData=${this.formData}
                        .repos=${this.repos}
                        .selectedRepo=${this.selectedRepo}
                        ?hideSaveButton=${!0}
                        @sutram-settings-form-changed=${o=>{this.formData=o.detail.formData}}>
                    </sutram-settings-form>
                </div>
                <sutram-async-btn
                    slot="footer"
                    label="Save Settings"
                    icon="save"
                    intent="primary"
                    .onClick=${async o=>{const l=this.shadowRoot.querySelector("sutram-settings-form");l&&await l.triggerSave(o),this.open=!1}}>
                </sutram-async-btn>
            </yenvui-modal>
        `}}customElements.define("sutram-generic-settings",SutramGenericSettingsModal);export class SutramEntityActions extends S{static properties={entityType:{type:String},entityData:{type:Object},scrollable:{type:Boolean,reflect:!0},variant:{type:String},_trayOpen:{type:Boolean,state:!0}};static styles=[E,$`
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
    `];updated(t){if(super.updated(t),t.has("_trayOpen")){const i=this.shadowRoot.querySelector(".action-tray-dialog");i&&(this._trayOpen&&!i.open?i.showModal():!this._trayOpen&&i.open&&i.close())}}connectedCallback(){super.connectedCallback()}render(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return"";const t=window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{});if(t.length===0)return"";const i=async(s,e)=>{if(window.ExtensionRegistry.executeEntityAction)return await window.ExtensionRegistry.executeEntityAction(s,this.entityData,e);if(s.asyncAction)return await s.asyncAction(this.entityData,e);if(s.onClick)return s.onClick(this.entityData,e)};if(this.variant==="menu-bar"){const s={file:[],edit:[],share:[],tools:[]};t.forEach(u=>{const h=u.group&&s[u.group]?u.group:"tools";s[h].push({...u,label:typeof u.label=="function"?u.label(this.entityData):u.label,icon:typeof u.icon=="function"?u.icon(this.entityData):u.icon||"",asyncAction:u.asyncAction?d=>i(u,d):null,onClick:!u.asyncAction&&u.onClick?d=>i(u,d):null})});const e={file:"File",edit:"Edit",share:"Share",tools:"Tools"},m={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},p=u=>{const h=u.currentTarget;if(!h)return;const d=h.getBoundingClientRect(),r=h.closest(".spatial-col, sutram-app-shell, .editor-header")||document.body,y=r.getBoundingClientRect?r.getBoundingClientRect().right:window.innerWidth,x=Math.min(window.innerWidth,y);d.left+220>x-10?(h.setAttribute("align","right"),h.align="right"):(h.setAttribute("align","left"),h.align="left")};return a`
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    ${Object.keys(s).map(u=>s[u].length===0?"":a`
                            <sutram-dropdown 
                                .items=${s[u]} 
                                align="left"
                                @pointerdown=${p}
                                @click=${p}>
                                <button slot="trigger" class="sync-btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 6px 10px;">
                                    <yv-icon name="${m[u]}" style="width: 14px; height: 14px; margin-right: 4px;"></yv-icon> <span>${e[u]}</span>
                                </button>
                            </sutram-dropdown>
                        `)}
                </div>
            `}const n=[],o=[];t.forEach(s=>{(s.order||99)<20?n.push(s):o.push(s)});const l=s=>{if(s.component)return a`<div style="display: contents; order: ${s.order||99};">${s.component(this.entityData)}</div>`;const e=typeof s.label=="function"?s.label(this.entityData):s.label,m=typeof s.icon=="function"?s.icon(this.entityData):s.icon||"",p=typeof s.intent=="function"?s.intent(this.entityData):s.intent||"primary",u=typeof s.isActive=="function"?s.isActive(this.entityData):!!s.isActive;if(s.asyncAction||window.ExtensionRegistry.executeEntityAction&&s.vfsBound)return a`
                    <sutram-async-btn 
                        style="margin: 0; order: ${s.order||99};" 
                        .label=${e}
                        .icon=${m}
                        intent="${p}" 
                        ?active=${u}
                        .onClick=${d=>i(s,d)}>
                    </sutram-async-btn>
                `;const h=d=>{if(d&&d.stopPropagation(),s.emitEvent){const r=s.emitEvent(this.entityData);window.dispatchEvent(new CustomEvent(r.name,{detail:r.detail,bubbles:!0,composed:!0}))}else i(s,d)};return a`
                <sutram-btn 
                    intent=${p} 
                    ?active=${u}
                    style="order: ${s.order||99}; gap: 4px;"
                    .label=${e}
                    .icon=${m}
                    @click=${h}>
                </sutram-btn>
            `},f=()=>{const s={file:[],edit:[],share:[],tools:[]};t.forEach(d=>{const r=d.group&&s[d.group]?d.group:"tools";s[r].push(d)});const e={file:"File",edit:"Edit",share:"Share",tools:"Tools"},m={file:"file-text",edit:"edit-3",share:"share-2",tools:"wrench"},p=async(d,r)=>{await i(d,r)},u=this.entityData?.titleText||this.entityData?.filepath?.split("/").pop()||this.entityData?.id||"Actions",h=this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.repoDir||"";return a`
                <dialog class="action-tray-dialog" @cancel=${d=>{d.preventDefault(),this._trayOpen=!1}} @click=${d=>{d.target.tagName==="DIALOG"&&(this._trayOpen=!1)}}>
                    <div class="action-tray-panel">
                        <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--bg-deep); display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; padding-right: 15px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: bold;">${this.entityType.replace(":"," / ")}</span>
                                <span style="font-weight: bold; font-size: 1.15rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u}</span>
                                ${h?a`<span style="font-size: 0.8rem; color: var(--intent-highlight); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h}</span>`:""}
                            </div>
                            <button class="sync-btn" @click=${()=>this._trayOpen=!1} style="background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); padding: 4px; font-size: 1.2rem; line-height: 1;">✕</button>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;">
                            ${Object.keys(s).map(d=>s[d].length===0?"":a`
                                    <div class="tray-group-header">
                                        <yv-icon name="${m[d]}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>${e[d]}
                                    </div>
                                    <div class="tray-group-grid">
                                        ${s[d].map(r=>{const y=typeof r.label=="function"?r.label(this.entityData):r.label,x=typeof r.icon=="function"?r.icon(this.entityData):r.icon||"",w=typeof r.intent=="function"?r.intent(this.entityData):r.intent||"primary",_=typeof r.isActive=="function"?r.isActive(this.entityData):!!r.isActive,C=b=>b?typeof b=="object"?b:b.includes("<")?a`<span style="display: inline-flex; align-items: center; margin-right: 6px;">${b}</span>`:/^[a-zA-Z0-9-]+$/.test(b)?a`<yv-icon name="${b}" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"></yv-icon>`:a`<span style="margin-right: 6px;">${b}</span>`:"";return r.asyncAction||window.ExtensionRegistry.executeEntityAction&&r.vfsBound?a`
                                                    <sutram-async-btn 
                                                        style="margin: 0; width: 100%; justify-content: flex-start; --btn-padding: 10px 12px; font-size: 0.9rem;" 
                                                        .label=${y}
                                                        .icon=${x}
                                                        intent="${w}" 
                                                        ?active=${_}
                                                        .onClick=${b=>p(r,b)}>
                                                    </sutram-async-btn>
                                                `:a`
                                                <button 
                                                    class="sync-btn ${_?"active":""}" 
                                                    style="width: 100%; justify-content: flex-start; padding: 10px 12px; font-size: 0.9rem; background: color-mix(in srgb, var(--intent-${w}) 15%, transparent); color: var(--intent-${w}); border: 1px solid color-mix(in srgb, var(--intent-${w}) 40%, transparent);" 
                                                    @click=${b=>p(r,b)}>
                                                    ${C(x)}${y}
                                                </button>
                                            `})}
                                    </div>
                                `)}
                        </div>
                    </div>
                </dialog>
            `},g=a`
            ${t.length>0?a`
                <sutram-btn intent="neutral" style="order: -1; margin-right: 4px;"
                    label="⋮"
                    @click=${s=>{s.stopPropagation(),this._trayOpen=!0}}>
                </sutram-btn>
            `:""}
            ${n.map(l)}
        `;return a`
            ${this.scrollable?a`
                <sutram-scrub-track>
                    <div style="display: flex; gap: 8px; align-items: center; width: max-content;">
                        ${g}
                    </div>
                </sutram-scrub-track>
            `:g}
            ${this._trayOpen?f():""}
        `}}customElements.define("sutram-entity-actions",SutramEntityActions);export class SutramCard extends v(z){static properties={...z.properties,entityType:{type:String},entityData:{type:Object},selectionStoreKey:{type:String}};constructor(){super(),this.entityType="",this.entityData={},this.selectionStoreKey="Selection"}_getId(){return this.entityData?.filepath||this.entityData?.folderpath||this.entityData?.id||this.filename}_getStore(){return this.selectionStoreKey==="Selection"?k:window.Sutram?.stores?.[this.selectionStoreKey]}connectedCallback(){if(super.connectedCallback(),this.selectionStoreKey&&this.selectionStoreKey!=="none"){this.subscribe(this.selectionStoreKey,n=>{const o=this._getId();o&&n.selectedItems&&(this.selected=n.selectedItems.has(o))});const t=this._getId(),i=this._getStore();t&&i&&i.getState().selectedItems&&(this.selected=i.getState().selectedItems.has(t))}this.addEventListener("yenvui-overlay-opened",t=>{if(!this.entityType||!this.entityData)return;(window.ExtensionRegistry?.getEntityActions?.(this.entityType,this.entityData)||[]).forEach(n=>{typeof n.onReveal=="function"&&n.onReveal(this.entityData)})}),this.addEventListener("yenvui-card-select-toggled",t=>{t.stopPropagation();const i=this._getId();if(i&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const n=this._getStore();n&&n.getState().toggleSelection&&n.getState().toggleSelection(i,this.entityType,this.entityData)}this.dispatchEvent(new CustomEvent("sutram-card-select-toggled",{detail:{id:i,selected:this.selected,entityType:this.entityType,entityData:this.entityData},bubbles:!0,composed:!0}))}),this.addEventListener("yenvui-card-clicked",t=>{this.dispatchEvent(new CustomEvent("card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))})}updated(t){if((t.has("icon")||t.has("entityData"))&&(this.entityData?.needs_recompile||this.entityData?.is_dirty||this.entityData?.outdated)&&(!this.icon||this.icon==="alert-triangle"||this.icon==="package")&&(this.icon="construction"),super.updated(t),(t.has("entityData")||t.has("filename"))&&this.selectionStoreKey&&this.selectionStoreKey!=="none"){const i=this._getId(),n=this._getStore();i&&n&&n.getState().selectedItems&&(this.selected=n.getState().selectedItems.has(i))}(t.has("entityType")||t.has("entityData")||t.has("_overlayActive"))&&this._injectEntityActions()}firstUpdated(){super.firstUpdated&&super.firstUpdated(),this._injectEntityActions()}_injectEntityActions(){if(!this.entityType||!window.ExtensionRegistry?.getEntityActions)return;if(window.ExtensionRegistry.getEntityActions(this.entityType,this.entityData||{}).length>0){if(this._hasActions||(this._hasActions=!0),!this._overlayActive)return;let i=this.querySelector(".sutram-injected-actions");if(i){const n=i.querySelector("sutram-entity-actions");n&&(n.entityType=this.entityType,n.entityData=this.entityData)}else{i=document.createElement("div"),i.className="sutram-injected-actions",i.slot="actions",i.style.display="flex",i.style.flexWrap="nowrap",i.style.gap="8px",i.style.alignItems="center",i.style.width="max-content",i.addEventListener("click",o=>o.stopPropagation());const n=document.createElement("sutram-entity-actions");n.entityType=this.entityType,n.entityData=this.entityData,n.scrollable=!0,i.appendChild(n),this.appendChild(i),this._hasActions=!0}}}_isStale(){return this.stale||!!this.entityData?.stale||!!this.entityData?.needs_recompile||!!this.entityData?.is_dirty||!!this.entityData?.outdated}}customElements.define("sutram-card",SutramCard);export class SutramCardGroup extends U{}customElements.define("sutram-card-group",SutramCardGroup);export class SutramSearchBar extends K{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-search-bar",SutramSearchBar);export class SutramSpinner extends Q{}customElements.define("sutram-spinner",SutramSpinner);export class SutramEmptyState extends G{}customElements.define("sutram-empty-state",SutramEmptyState);export class SutramBoard extends H{}customElements.define("sutram-board",SutramBoard);export class SutramColumn extends V{}customElements.define("sutram-column",SutramColumn);export class SutramTag extends Z{}customElements.define("sutram-tag",SutramTag);export class SutramLabel extends X{}customElements.define("sutram-label",SutramLabel);export class SutramScrubTrack extends it{}customElements.define("sutram-scrub-track",SutramScrubTrack);export class SutramScrollView extends st{}customElements.define("sutram-scroll-view",SutramScrollView);export class SutramToolbar extends q{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-search-changed",t=>{this.dispatchEvent(new CustomEvent("search-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-toolbar",SutramToolbar);export class SutramDropdown extends tt{}customElements.define("sutram-dropdown",SutramDropdown);export class SutramFilterDropdown extends et{}customElements.get("sutram-filter-dropdown")||customElements.define("sutram-filter-dropdown",SutramFilterDropdown);export class SutramCollapsible extends W{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-collapsible-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-collapsible-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-collapsible",SutramCollapsible);export class SutramCategorySection extends F{}customElements.define("sutram-category-section",SutramCategorySection);export class SutramPill extends J{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-pill-toggled",t=>{this.dispatchEvent(new CustomEvent("sutram-pill-toggled",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-pill",SutramPill);export class SutramFilterGroup extends P{connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-filter-changed",t=>{this.dispatchEvent(new CustomEvent("sutram-filter-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-filter-group",SutramFilterGroup);import{wordCountPlugin as I}from"./wordcount.js";const Nt=[];export class SutramEditor extends v(j){static properties={...j.properties,enableWordcount:{type:Boolean}};constructor(){super(),this.enableWordcount=!0}willUpdate(t){if(super.willUpdate(t),t.has("customExtensions")||t.has("enableWordcount")){const i=Array.isArray(this.customExtensions)?this.customExtensions.filter(n=>n!==I):[];this.enableWordcount&&i.push(I),this.customExtensions=i}}connectedCallback(){super.connectedCallback(),this.addEventListener("yenvui-editor-changed",t=>{this.dispatchEvent(new CustomEvent("editor-changed",{detail:t.detail,bubbles:!0,composed:!0}))})}}customElements.define("sutram-editor",SutramEditor);export class SutramSelectorModal extends S{static properties={open:{type:Boolean,reflect:!0},titleText:{type:String},items:{type:Array},_searchQuery:{type:String},_filteredItems:{type:Array,state:!0}};static styles=[E,$`:host { display: contents; }`];constructor(){super(),this.open=!1,this.titleText="Select Item",this.items=[],this._searchQuery="",this._filteredItems=[],this._lastSearchReq=0}updated(t){if(super.updated(t),t.has("items")||t.has("_searchQuery"))if(!this._searchQuery)this._filteredItems=(this.items||[]).slice(0,50);else{const i=++this._lastSearchReq;O.dispatch("FUZZY_SEARCH",{items:this.items||[],query:this._searchQuery}).then(({results:n})=>{i===this._lastSearchReq&&(this._filteredItems=(n||[]).slice(0,50))})}}render(){if(!this.open)return a``;const t=this._filteredItems||[];return a`
            <sutram-modal ?open=${!0} titleText=${this.titleText} @sutram-modal-closed=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("selector-closed"))}}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 300px;">
                    <sutram-input placeholder="Search..." ?flush=${!0} .value=${this._searchQuery} @sutram-input-changed=${i=>this._searchQuery=i.detail.value} style="width: 100%; margin-bottom: 10px; flex-shrink: 0;"></sutram-input>
                    <div style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
                        ${t.length===0?a`<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>`:t.map(i=>{const n=typeof i=="string"?i:i.label||i;return a`
                                <button class="btn-sm yv-interactive-row" style="background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px;"
                                    @click=${()=>{this.open=!1,this.dispatchEvent(new CustomEvent("item-selected",{detail:{item:i},bubbles:!0,composed:!0}))}}>
                                    <yv-icon name="file" style="width: 14px; height: 14px; margin-right: 6px;"></yv-icon> ${n}
                                </button>
                            `})}
                    </div>
                </div>
            </sutram-modal>
        `}}customElements.define("sutram-selector-modal",SutramSelectorModal);export class SutramReportProjection extends S{static properties={caption:{type:String},content:{type:String},tabs:{type:Array},activeTab:{type:String},actions:{type:Array},extraContent:{type:Object},suggestedFilename:{type:String},windowId:{type:String}};static styles=[E,$`
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
    `];constructor(){super(),this.caption="",this.content="",this.tabs=[],this.activeTab="",this.actions=[],this.extraContent=null,this.suggestedFilename="",this.windowId=""}_getActiveContent(){if(this.tabs&&this.tabs.length>0){const t=this.activeTab||this.tabs[0].id,i=this.tabs.find(n=>n.id===t)||this.tabs[0];return i&&i.content||""}return this.content||""}render(){const t=this._getActiveContent(),i=this.tabs&&this.tabs.length>1,n=this.activeTab||this.tabs&&this.tabs[0]?.id||"",o=this.suggestedFilename||`report_${Date.now()}.txt`;return a`
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 15px; gap: 10px;">
                ${this.caption?a`<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${this.caption}</p>`:""}
                ${i?a`
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        ${this.tabs.map(l=>a`
                            <sutram-btn
                                size="sm"
                                .icon=${l.icon||"file-text"}
                                .label=${l.label}
                                intent="${n===l.id?"primary":"neutral"}"
                                ?active=${n===l.id}
                                @click=${()=>{this.activeTab=l.id,this.requestUpdate()}}>
                            </sutram-btn>
                        `)}
                    </div>
                `:""}
                <div class="output-box">${t||"No output."}</div>
                ${this.extraContent?a`<div style="flex-shrink: 0;">${this.extraContent}</div>`:""}
                <div style="padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;">
                    <sutram-entity-actions
                        ?scrollable=${!0}
                        style="justify-content: flex-end;"
                        .entityType=${"text_blob"}
                        .entityData=${{textContent:t,suggestedFilename:o}}>
                    </sutram-entity-actions>
                </div>
            </div>
            ${this.actions&&this.actions.length>0?a`
                <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; width: 100%; gap: 10px; flex-shrink: 0; box-sizing: border-box;">
                    ${this.actions.map(l=>{const f=l.style||(l.primary?"flex: 2; margin: 0;":"flex: 1; margin: 0;");return l.asyncAction?a`
                                <sutram-async-btn
                                    .icon=${l.icon}
                                    .label=${l.label}
                                    intent="${l.intent||"primary"}"
                                    style="${f}"
                                    ?disabled=${l.disabled}
                                    .onClick=${l.asyncAction}>
                                </sutram-async-btn>
                            `:a`
                            <sutram-btn
                                .icon=${l.icon}
                                .label=${l.label}
                                intent="${l.intent||"neutral"}"
                                style="${f}"
                                ?disabled=${l.disabled}
                                @click=${l.onClick}>
                            </sutram-btn>
                        `})}
                </div>
            `:""}
        `}}customElements.define("sutram-report-projection",SutramReportProjection);export class SutramDiffViewer extends v(nt){}customElements.define("sutram-diff-viewer",SutramDiffViewer);
