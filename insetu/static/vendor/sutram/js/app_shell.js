import{html as v,css as A}from"lit";import{SutramElement as U,ExtensionRegistry as N,LayoutStore as L,StoreRegistry as j}from"./sutram_sdk.js";import{sharedStyles as q}from"./shared_styles.js";import{debounce as z}from"./utils.js";import{SutramProjectionCompiler as H}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as M,YenvuiViewportGuard as W}from"../../yenvui/js/physics.js";const D=(I,e,o)=>{const i=Array.isArray(o)&&o.length>0?o:[1,1,1],u=Math.max(0,Math.min(e,i.length-I)),a=i.slice(u,u+I).reduce((n,p)=>n+p,0)||1;return{getColWidth:n=>`${i[n]/a*100}%`,getColLeft:n=>`${i.slice(0,n).reduce((s,S)=>s+S,0)/a*100}%`,getTrackOffset:()=>`-${i.slice(0,u).reduce((p,s)=>p+s,0)/a*100}%`,getWinBounds:(n,p)=>{const s=Math.min(p,i.length-n),S=i.slice(0,n).reduce((x,m)=>x+m,0),_=i.slice(n,n+s).reduce((x,m)=>x+m,0);return{left:`${S/a*100}%`,width:`${_/a*100}%`}}}};export const pinMatchesSlot=(I,e)=>{if(!I||!e)return!1;const o=typeof e=="string"?e:e.id||"",i=typeof e=="object"&&e.rawId?e.rawId:o.includes("://")?o:o.includes(":")?o.split(":").slice(1).join(":"):o,u=typeof e=="object"&&e.extName?e.extName:!o.includes("://")&&o.includes(":")?o.split(":")[0]:null;if(I.id===o||I.rawId&&I.rawId===i&&(!u||!I.extName||I.extName===u)||u&&I.id===i&&(!I.extName||I.extName===u))return!0;if(I.id&&!I.id.includes("://")&&I.id.includes(":")){const[a,n]=I.id.split(":");if(n===i&&(!u||a===u))return!0}return I.id===i&&!u};export class SutramAppShell extends U{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[q,A`
        :host {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - 30px); /* Account for global status bar */
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            overscroll-behavior: none;
        }
        .shell-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            position: relative;
        }
        .nested-tab-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: var(--bg);
        }
        /* Primary Tab Buttons */
        .tab-btn {
            padding: 0 10px;
            height: 100%;
            display: flex;
            align-items: center;
            cursor: pointer;
            font-weight: 500;
            color: var(--text-muted);
            background: transparent;
            border-radius: 4px;
            white-space: nowrap;
            border: 2px solid transparent;
            box-sizing: border-box;
            font-size: 0.9rem;
            transition: all 0.2s;
            outline: none;
            margin: 0;
        }
        .tab-btn:hover {
            background: var(--bg-hover);
            color: var(--text);
        }
        .tab-btn.active {
            color: var(--text);
            background: transparent;
            border-color: transparent transparent var(--tab-intent, var(--intent-primary)) transparent;
            border-radius: 4px 4px 0 0;
        }
        :host-context([data-theme="e-ink"]) .tab-btn {
            color: #000000 !important;
            font-weight: 600 !important;
            border: 2px solid transparent;
            transition: none !important;
        }
        :host-context([data-theme="e-ink"]) .tab-btn:hover {
            background: transparent !important;
        }
        :host-context([data-theme="e-ink"]) .tab-btn.active {
            background: var(--bg, #ffffff) !important;
            color: var(--text, #000000) !important;
            border: 2px solid var(--intent-neutral, #3b82f6) !important;
            box-shadow: 3px -3px 0 var(--intent-success, #10b981) !important;
        }
        /* Viewport Layout */
        .spatial-viewport {
            overflow: hidden;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .spatial-track {
            position: relative;
            flex: 1;
            min-height: 0;
            transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
            width: 100%;
        }
        /* Responsive Viewport States */
        .spatial-col {
            position: absolute;
            top: 0;
            bottom: 0;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: 1px solid var(--border);
            container-type: inline-size;
            overscroll-behavior-x: none;
            width: var(--col-width, 33.333%) !important;
            left: var(--col-left, 0%) !important;
            transition: width 0.32s cubic-bezier(0.2, 0.9, 0.2, 1), left 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
        }

        :host([data-viewport="mobile"]) .spatial-col, [data-viewport="mobile"] .spatial-col {
            border-right: none;
        }
        .spatial-col:last-child {
            border-right: none !important;
        }
        .masthead-action-rail-cell {
            width: var(--yv-rail-cell-width, 44px);
            height: 100%;
            border-radius: 0;
            border: none;
            border-left: 1px solid var(--border);
            background: var(--rail-bg, rgba(255,255,255,0.02));
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
            box-sizing: border-box;
            color: var(--text-muted);
        }
        .masthead-action-rail-cell:hover {
            background: var(--rail-hover, rgba(99, 102, 241, 0.22));
            color: var(--text);
        }
        /* Strip padding and force stretch alignment for full-bleed action rails */
        .masthead {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            padding-right: 0 !important;
            height: var(--yv-header-height, 44px);
            align-items: stretch !important;
        }
        .masthead-right-rail, .col-header-actions {
            display: flex;
            align-items: stretch;
            height: 100%;
        }

        /* Ensure tab contents stay vertically centered despite parent stretching */
        .col-header > div:first-child, .masthead > div:first-child {
            display: flex;
            align-items: center;
        }
        .col-header > div:last-child {
            align-items: stretch;
        }
        :host([data-viewport="mobile"]) .desktop-only-folders, [data-viewport="mobile"] .desktop-only-folders { display: none !important; }
        :host([data-viewport="mobile"]) .mobile-only-tools, [data-viewport="mobile"] .mobile-only-tools { display: flex !important; }
        :host([data-viewport="desktop"]) .desktop-only-folders, :host([data-viewport="tablet"]) .desktop-only-folders,
        [data-viewport="desktop"] .desktop-only-folders, [data-viewport="tablet"] .desktop-only-folders { display: flex !important; }
        :host([data-viewport="desktop"]) .mobile-only-tools, :host([data-viewport="tablet"]) .mobile-only-tools,
        [data-viewport="desktop"] .mobile-only-tools, [data-viewport="tablet"] .mobile-only-tools { display: none !important; }
        .pos-dot-target { padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pos-dot { width: 6px; height: 6px; border-radius: 9999px; background: var(--text-muted); transition: all 0.2s ease; }
        .pos-dot.active { width: 14px; background: var(--intent-primary); box-shadow: none; }
        :host-context([data-theme="e-ink"]) .pos-dot.active { background: var(--text, #000000); box-shadow: none; }
        .spatial-col.is-focused {
            z-index: 10;
        }
        .spatial-col.is-focused .col-header {
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) var(--header-bg-mix, 20%), var(--bg-deep));
        }
        .col-header {
            display: flex;
            align-items: stretch !important;
            height: var(--yv-header-height, 44px);
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            padding: 0 0 0 var(--yv-gutter-x, 12px);
            flex-shrink: 0;
            position: relative;
            z-index: 100;
            overflow: visible !important;
        }
        /* Draggable Tab Enhancements */
        .sub-tab {
            touch-action: none; user-select: none; display: flex; align-items: center;
            cursor: pointer; padding: 0; margin-right: 16px; font-size: 0.9rem; font-weight: 500; 
            color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; 
            border-bottom: 2px solid transparent; box-sizing: border-box; outline: none;
        }
        .sub-tab:last-child { margin-right: 0; }
        .sub-tab:hover { color: var(--text); }
        .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--intent-primary); }

        :host([data-theme="e-ink"]) .sub-tab { transition: none !important; }
        :host([data-theme="e-ink"]) .sub-tab:hover { color: var(--text-muted); }
        :host([data-theme="e-ink"]) .sub-tab.active { color: var(--text) !important; }

        .sub-tab-icon-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: var(--yv-icon-size, 14px);
            height: var(--yv-icon-size, 14px);
            margin-right: var(--yv-icon-gap, 8px);
            border-radius: 4px;
            transition: background 0.2s;
        }
        .sub-tab-icon-wrapper .default-icon-container { display: flex !important; transition: opacity 0.2s; }
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(e,o){const i=window.ExtensionRegistry||N;i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",e)&&!confirm(`You have unsaved changes in ${e.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||o()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(e,o,i,u="subtab"){let a=null;const n=this.shadowRoot.querySelector(".spatial-track"),p=n?n.getBoundingClientRect():{top:38,height:window.innerHeight-68};if(i==="window"){const x=e.composedPath().find(m=>m.tagName&&m.tagName.toLowerCase()==="sutram-window");if(x&&x.parentElement){const m=x.parentElement.getBoundingClientRect();a={left:m.left,top:m.top,width:m.width,height:m.height}}}else if(i){const _=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${i}"]`);if(_){const x=_.getBoundingClientRect();a={left:x.left,top:x.top,width:x.width,height:x.height}}}a||(a={left:0,top:p.top,width:window.innerWidth,height:p.height});const s=e.clientX!==void 0?e.clientX:e.touches&&e.touches[0]?e.touches[0].clientX:0,S=e.clientY!==void 0?e.clientY:e.touches&&e.touches[0]?e.touches[0].clientY:0;this._dragState={active:!1,entity:o,sourceCol:i,currentZone:null,startX:s,startY:S,currentX:s,currentY:S,originType:u,sourceRect:a},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:(_,x)=>{this._dragState&&(_!==void 0&&!isNaN(_)&&(this._dragState.currentX=_),x!==void 0&&!isNaN(x)&&(this._dragState.currentY=x)),this._activateDrag()},onPanMove:(_,x)=>{if(!this._dragState.active){const g=Math.abs(_-this._dragState.startX),r=Math.abs(x-this._dragState.startY);(g>8||r>8)&&this._activateDrag();return}this._dragState.currentX=_,this._dragState.currentY=x;let m=!1;const f=this.shadowRoot.querySelector("sutram-drag-coordinator");if(f){const g=typeof f.getHoveredZone=="function"?f.getHoveredZone(_,x):null;this._dragState.currentZone!==g&&(this._dragState.currentZone=g,m=!0),m?f.dragState={...this._dragState}:typeof f.updatePointer=="function"&&f.updatePointer(_,x)}},onPanEnd:(_,x)=>{if(this._dragState.active){const m=this._dragState.currentZone,f=this._dragState.entity,g=this._dragState.sourceCol;if(m&&window.Sutram?.stores?.Layout){const r=window.Sutram.stores.Layout.getState();if(m==="close")this._safeEvict(f.id,()=>{g==="window"?r.closeWindow(f.id):g&&r.unpinFromColumn(g,f.id),r.evictProjection(f.id);const w=window.Sutram.stores.Layout.getState(),t=w.focusedColumn||g||"center",c=w.columns[t]?.active||"";this._updateUrlHash(t,c)});else if(m==="popout"){const w=g&&g!=="window"?g:r.focusedColumn||"center";r.popoutProjection(f.id,{originCol:w})}else if(m==="window"||m==="mode-window"){const w=g&&g!=="window"?g:f.anchorCol||r.focusedColumn||"center";g&&g!=="window"&&r.unpinFromColumn(g,f.id),r.openWindow(f,w,1)}else if(m==="mode-tab"&&!f?.windowOnly){const w=g&&g!=="window"?g:f.anchorCol||r.focusedColumn||"center";g==="window"&&r.closeWindow(f.id),r.columns[w]?.pinned?.some(t=>t.id===f.id)||r.pinToColumn(w,f),r.setActiveProjection(w,f.id),r.setFocusedColumn(w)}else if(m.startsWith("span-")){const w=m.split("-"),t=parseInt(w[1],10),c=w[2];g==="window"?r.updateWindowConstraints(f.id,c,t):(g&&r.unpinFromColumn(g,f.id),r.openWindow(f,c,t))}else if(m.startsWith("reorder-")){if(g){const w=parseInt(m.replace("reorder-",""),10),t=[...r.columns[g].pinned],c=t.findIndex(d=>d.id===f.id);if(c!==-1&&c!==w){const[d]=t.splice(c,1);t.splice(w,0,d),window.Sutram.stores.Layout.setState(b=>({columns:{...b.columns,[g]:{...b.columns[g],pinned:t}}}))}}}else if(["left","center","right"].includes(m)&&m!==g&&!f?.windowOnly){const w=m;g==="window"?r.closeWindow(f.id):g&&r.unpinFromColumn(g,f.id),r.pinToColumn(w,f),r.setActiveProjection(w,f.id),r.setFocusedColumn(w)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(e,{lockAxis:u==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(e=>{e&&typeof e.abort=="function"&&e.abort()})}updated(e){super.updated(e);const o=this.shadowRoot.querySelector(".spatial-track");if(o){const u=this._spatialState?.capacity||3,a=this._spatialState?.mobileViewportIndex??1,n=this._spatialState?.layoutRatios||[1,1,1],p=D(u,a,n);this._isPanningTrack||(o.style.transform=`translateX(${p.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(u=>{const a=u.closest("yenvui-scrub-track");if(a&&a.shadowRoot){const n=a.shadowRoot.querySelector(".scrub-container");if(n){const p=u.getBoundingClientRect();if(p.width>0){const s=n.getBoundingClientRect();n.scrollBy({left:p.left-s.left-s.width/2+p.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),W.install(),this.registerGlobalListener("click",document,e=>{this._launcherDropdown&&!e.composedPath().some(o=>o.classList?.contains("global-launcher-menu")||o.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),L&&(this.subscribe(L,e=>{const o=e||{};this._spatialState={capacity:o.capacity||3,focusedColumn:o.focusedColumn||"center",mobileViewportIndex:o.mobileViewportIndex??1,layoutRatios:o.layoutRatios||null,columns:o.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:o.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,e=>{const o=e.detail?.extName;if(o&&this._activeNodes){for(const[i,u]of Array.from(this._activeNodes.entries()))if((u?.extName||u?.dataset?.ext||(u?.tagName?u.tagName.toLowerCase().replace(/^[a-z0-9_-]+-ext-/,""):""))===o||i.includes(`:${o}:`)){try{u.remove()}catch{}this._activeNodes.delete(i)}}this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,e=>{const{oldId:o,newId:i}=e.detail||{};if(!o||!i)return;for(const[a,n]of Array.from(this._activeNodes.entries())){const p=`:${o}`;if(a.endsWith(p)){const s=a.slice(0,a.length-p.length);this._activeNodes.delete(a),n.dataset&&(n.dataset.subId=i),this._activeNodes.set(`${s}:${i}`,n)}}if(decodeURIComponent(window.location.hash||"").includes(o)){const a=L.getState(),n=a.focusedColumn||"center";if(this.variant==="popout"){const p=window.location.hash.replace(encodeURIComponent(o),encodeURIComponent(i)).replace(o,i);p!==window.location.hash&&window.history.replaceState(null,"",p)}else a.columns?.[n]?.active===i&&this._updateUrlHash(n,i)}this.requestUpdate()}),this._handleResize=z(()=>{const e=window.innerWidth,o=Math.min(3,Math.max(1,Math.floor(e/360))),i=L.getState();if(i&&(i.capacity||3)!==o&&typeof i.setCapacity=="function"){if(i.setCapacity(o),o===1&&i.focusedColumn){const n={left:0,center:1,right:2};i.setMobileViewport(n[i.focusedColumn]||1)}else if(o===2&&i.focusedColumn){const p={left:0,center:1,right:2}[i.focusedColumn]||1,s=p===0?0:p===2||i.mobileViewportIndex===2?2:0;i.setMobileViewport(s)}(i.windows||[]).forEach(n=>{let p=Math.min(n.span||1,o),s=n.anchorCol||"center";o===1?(p=1,s=i.focusedColumn||"center"):o===2&&s==="right"&&(s=p===2?"left":"center"),(p!==n.span||s!==n.anchorCol)&&i.updateWindowConstraints(n.id,s,p)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=z(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(e){console.error("[Telemetry] AppShell connectedCallback error:",e)}}_resolvePrimaryTabMeta(e){const o=(typeof e=="string"?e:e?.id)?.toLowerCase()||"",i=window.ExtensionRegistry||N,u=i?.executeUIHook?i.executeUIHook("sutram:resolve-primary-tab-meta",{id:o,tab:e}):null,a={context:{color:"var(--intent-primary)",icon:"folder-code"},edit:{color:"var(--intent-highlight)",icon:"edit-3"},diagnostics:{color:"var(--intent-warning)",icon:"activity"},tasks:{color:"var(--intent-warning)",icon:"check-square"},ctrl:{color:"var(--intent-danger)",icon:"terminal"},dev:{color:"var(--intent-success)",icon:"code"},offline:{color:"var(--text-muted)",icon:"wifi-off"},library:{color:"var(--intent-highlight)",icon:"book-open"}};return{color:e&&e.intent?`var(--intent-${e.intent})`:u?.color||a[o]?.color||"var(--intent-primary)",icon:e&&e.icon?e.icon:u?.icon||a[o]?.icon||"folder"}}_getPrimaryTabColor(e){return this._resolvePrimaryTabMeta(e).color}_getPrimaryTabIcon(e){const{color:o,icon:i}=this._resolvePrimaryTabMeta(e);return v`<yv-icon name="${i}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${o};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=H.getCompiledLayout();const e=window.Sutram?.stores?.Layout,o=window.ExtensionRegistry||N,i=window.Sutram?.storeRegistry||j,u=!!(i&&typeof i.isTransitioning=="function"&&i.isTransitioning()||o?.executeUIHook&&(o.executeUIHook("sutram:is-swapping-scope")||o.executeUIHook("sutram:is-swapping-workspace")));if(e&&!o.isBooting&&!u){const a=e.getState();let n=!1;const p={},s={...a.columns},S=r=>typeof o._filterPredicate=="function"?o._filterPredicate(r):!0,_=this._layoutConfig.filter(r=>r.slot==="slots:sub-navigation");["left","center","right"].forEach(r=>{if(!s[r]||!s[r].pinned)return;const w=s[r].pinned.filter(t=>!t.extName||S(t.extName)).map(t=>{const c=_.find(d=>pinMatchesSlot(t,d));return c&&(t.id!==c.id&&(p[t.id]=c.id,n=!0),c.icon!==t.icon||c.label!==t.label||c.intent!==t.intent||c.rawId!==t.rawId||t.id!==c.id)?(n=!0,{...t,id:c.id,rawId:c.rawId||c.id,extName:c.extName,icon:c.icon||t.icon,label:c.label||t.label,intent:c.intent||t.intent}):t});(w.length!==s[r].pinned.length||n)&&(s[r]={...s[r],pinned:w},s[r].active&&p[s[r].active]?(s[r].active=p[s[r].active],n=!0):s[r].active&&!w.some(t=>pinMatchesSlot(t,s[r].active))&&(s[r].active=w.length>0?w[0].id:null,n=!0),Array.isArray(s[r].history)&&(s[r].history=s[r].history.map(t=>p[t]||t)))});const x=a.windows||[],m=x.filter(r=>!r.extName||S(r.extName));m.length!==x.length&&(n=!0);let f=m.map(r=>{const w=_.find(t=>t.id===r.id||r.extName&&t.extName===r.extName&&t.rawId===r.id);return w&&r.id!==w.id?(p[r.id]=w.id,n=!0,{...r,id:w.id,rawId:w.rawId,extName:w.extName,icon:w.icon||r.icon,label:w.label||r.label}):r}),g=(a.focusHistory||[]).map(r=>r&&r.id&&p[r.id]?(n=!0,{...r,id:p[r.id]}):r);n&&(e.setState({columns:s,windows:f,focusHistory:g}),Object.keys(p).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:p},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(e){console.error("[Telemetry] AppShell _compileLayout error:",e)}}_renderDropdownItem(e){let o=null;if(this._spatialState&&this._spatialState.columns){for(const i of["left","center","right"])if(this._spatialState.columns[i].pinned.some(u=>pinMatchesSlot(u,e))){o=i;break}}return v`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${i=>{const u=window.Sutram?.stores?.Layout?.getState();let a=null;if(u&&u.columns){for(const n of["left","center","right"])if(u.columns[n].pinned.some(p=>pinMatchesSlot(p,e))){a=n;break}}this._handlePointerDown(i,e,a,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const i=window.Sutram?.stores?.Layout?.getState();let u=null,a=null;if(i&&i.columns){for(const s of["left","center","right"])if(a=i.columns[s].pinned.find(S=>pinMatchesSlot(S,e)),a){u=s;break}}let n=u;const p=a?a.id:e.id;u||(n=e.preferredColumn||"center",i&&i.pinToColumn(n,e)),i&&(i.setFocusedColumn(n),i.setActiveProjection(n,p)),this._handleSubTabClick(p),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${e.icon?v`<yv-icon name="${e.icon}" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:v`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${e.label}</span>
            </button>
        `}_updateUrlHash(e,o){const i=window.ExtensionRegistry||N,u=i?.executeUIHook?i.executeUIHook("sutram:resolve-route-hash",{colId:e,subId:o}):null,a=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",n=u||`#/${a}/${e}/${encodeURIComponent(o)}`;window.location.hash!==n&&window.history.replaceState(null,"",n)}_handleSubTabClick(e){let o=null,i=!1,u=e;if(window.Sutram?.stores?.Layout){const a=window.Sutram.stores.Layout.getState();for(const n of["left","center","right"]){const p=a.columns[n]?.pinned.find(s=>pinMatchesSlot(s,e));if(p){o=n,u=p.id;break}}if(o){i=a.columns[o].active===u,a.setActiveProjection(o,u),a.setFocusedColumn(o);const n={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(n[o])}}if(i){const a=this.shadowRoot.querySelector(`[data-sub-id="${u}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${e}"]`);a&&typeof a.onForceRefresh=="function"&&a.onForceRefresh()}this.requestUpdate(),o&&this._updateUrlHash(o,u)}_handleDotDragStart(e){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const o=this.shadowRoot.querySelector(".spatial-track");o&&(o.style.transition="none")},onPanMove:(o,i,u)=>{if(u==="horizontal"){const a=o-this._dotDragController.startX,n=this._spatialState?.mobileViewportIndex??1,p=this._spatialState?.capacity||3,s=this._spatialState?.layoutRatios||[1,1,1],S=D(p,n,s),_=parseFloat(S.getTrackOffset()),x=this.shadowRoot.querySelector(".spatial-track");if(x){let m=a;const f=Math.max(0,s.length-p),g=D(p,f,s).getTrackOffset(),r=parseFloat(g);(_<=r&&a<0||_>=0&&a>0)&&(m=a*.2),x.style.transform=`translateX(calc(${_}% + ${m}px))`}}},onPanEnd:(o,i,u)=>{const a=this.shadowRoot.querySelector(".spatial-track");if(a&&(a.style.transition=""),u==="horizontal"){const n=o-this._dotDragController.startX,p=window.innerWidth*.2,s=this._spatialState?.mobileViewportIndex??1,S=this._spatialState?.capacity||3,_=this._spatialState?.layoutRatios||[1,1,1],x=Math.max(0,_.length-S);let m=s;if(n>p?m=Math.max(0,s-1):n<-p&&(m=Math.min(x,s+1)),this._isPanningTrack=!1,m!==s)this._setViewportIndex(m);else{const f=D(S,m,_);a&&(a.style.transform=`translateX(${f.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(e)}_setViewportIndex(e){if(window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();o.setMobileViewport(e);const i=["left","center","right"];i[e]&&o.setFocusedColumn(i[e])}}render(){try{const e=new Map,o=(t,c=null,d=null)=>{if(!t)return"";const b=c?`${t}:${c}`:t;let l=this._activeNodes.get(b);if(!l)try{l=document.createElement(t)}catch{l=document.createElement("div"),l.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;";const P=document.createElement("yv-icon");P.setAttribute("name","alert-triangle"),P.style.width="14px",P.style.height="14px";const h=document.createElement("span");h.textContent=`Failed to initialize <${t}>`,l.replaceChildren(P,h)}return c&&l.dataset&&(l.dataset.subId=c),d&&typeof d=="object"&&Object.assign(l,d),e.set(b,l),l},i=window.ExtensionRegistry||N,u=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let a=this._layoutConfig.filter(t=>t.slot==="slots:primary-navigation");const n=this._layoutConfig.filter(t=>t.slot==="slots:global"),p=this._layoutConfig.filter(t=>t.slot==="slots:sub-navigation");u&&typeof i.getExtension=="function"&&(a=a.filter(t=>{const c=t.extName?i.getExtension(t.extName):null;return c&&c.offline_mode&&c.offline_mode!=="none"?!0:p.filter(b=>(b.targetParent||"").toLowerCase()===(t.id||"").toLowerCase()).some(b=>(i.getExtension(b.extName)?.offline_mode||"none")!=="none")}));const{capacity:s,mobileViewportIndex:S,focusedColumn:_}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},x=s===1?"mobile":s===2?"tablet":"desktop",m=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],f=this._spatialState.layoutRatios||[1,1,1],g=D(s,S,f);this.dataset.viewport=x;const r=this.variant==="popout";if(r){const t=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",c=t?t.split("/").map(decodeURIComponent):[];let d="";c.length>=4&&c[2]==="editor"?d=c.slice(3).join("/"):c.length>=3&&(d=c.slice(2).join("/"));const b=this._spatialState?.focusedColumn||"center",l=this._spatialState?.columns?.[b];d=d||l?.active||l?.pinned?.[0]?.id;let C=p.find(k=>k.id===d||!d.includes(":")&&k.rawId===d),P=null;if(C)C.allow_popout?P=o(C.component,C.id):P=v`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <yv-icon name="alert-triangle" style="width: 36px; height: 36px; color: var(--intent-warning); margin-bottom: 16px;"></yv-icon>
                            <h3 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${C.label||C.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(d){const k=typeof i.resolveCustomEditor=="function"?i.resolveCustomEditor(d):null,y=i?.executeUIHook?i.executeUIHook("sutram:resolve-editor-component",d):null,$=k?.component||y||"sutram-editor";P=o($,d)}const h=v`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${P||v`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${n.map(k=>o(k.component))}
                </div>
            `;return this._activeNodes=e,h}const w=v`
            <div class="shell-container spatial-viewport" data-viewport="${x}">
                ${r?"":v`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 0; padding-right: 0; ${s<f.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${t=>{s<f.length&&this._handleDotDragStart(t)}}>
                        ${x==="mobile"?v`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${t=>{if(t.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const c=a[0]?a[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:c}}this.requestUpdate()}}>
                                    <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                    <span>Tools</span>
                                    <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                                </button>
                            </div>
                        `:v`
                            <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${a.map(t=>{const c=p.filter(d=>(d.targetParent||"").toLowerCase()===t.id.toLowerCase());return v`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(t)};" @click=${d=>{if(this._launcherDropdown?.tabId===t.id)this._launcherDropdown=null;else{const b=d.currentTarget.getBoundingClientRect(),l=b.right>window.innerWidth-200;this._launcherDropdown={tabId:t.id,items:c,x:l?"auto":b.left+"px",right:l?window.innerWidth-b.right+"px":"auto",y:b.bottom+5+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(t)}${t.label}
                                        </button>
                                    `})}
                            </yenvui-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${s===1&&s<f.length?v`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,f.length-s+1)}).map((t,c)=>v`
                                    <div class="pos-dot-target" @click=${d=>{d.stopPropagation(),d.preventDefault()}} @pointerdown=${d=>{d.stopPropagation(),this._setViewportIndex(c)}} title="Jump to View ${c+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${S===c?"active":""}" style="width: ${S===c?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${S===c?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${S===c?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}
                        <!-- Top Right Utility Rail -->
                        <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: stretch; gap: 0; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 0;">
                            <slot name="header-quickpack"></slot>
                            <slot name="header-actions-left"></slot>
                            ${s>1&&s<f.length?v`
                                <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    ${Array.from({length:Math.max(1,f.length-s+1)}).map((t,c)=>v`
                                        <div class="pos-dot-target" @click=${d=>{d.stopPropagation(),d.preventDefault()}} @pointerdown=${d=>{d.stopPropagation(),this._setViewportIndex(c)}} title="Jump to View ${c+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${S===c?"active":""}" style="width: ${S===c?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${S===c?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${S===c?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                        </div>
                                    `)}
                                </div>
                            `:""}
                            <slot name="header-actions"></slot>
                        </div>
                    </div>
                `}
                <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown?v`
                    ${this._launcherDropdown.isMobileTools?v`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${a.map(t=>{const c=p.filter(d=>(d.targetParent||"").toLowerCase()===t.id.toLowerCase());return c.length===0?"":v`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(t)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(t)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${t.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${c.map(d=>{let b=null;if(this._spatialState&&this._spatialState.columns){for(const l of["left","center","right"])if(this._spatialState.columns[l].pinned.some(C=>C.id===d.id)){b=l;break}}return v`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${l=>{const C=window.Sutram?.stores?.Layout?.getState();let P=null;if(C&&C.columns){for(const h of["left","center","right"])if(C.columns[h].pinned.some(k=>k.id===d.id)){P=h;break}}this._handlePointerDown(l,d,P,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const l=window.Sutram?.stores?.Layout?.getState(),{capacity:C,focusedColumn:P,mobileViewportIndex:h}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let k=null;if(l&&l.columns){for(const $ of["left","center","right"])if(l.columns[$].pinned.some(T=>T.id===d.id)){k=$;break}}let y=k;k||(y=d.preferredColumn||"center",l&&l.pinToColumn(y,d)),l&&l.setFocusedColumn(y),this._handleSubTabClick(d.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${d.icon?v`<yv-icon name="${d.icon}" style="width: 14px; height: 14px; color: ${b?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:v`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${b?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${d.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:v`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(t=>this._renderDropdownItem(t))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${s}" style="${this._isPanningTrack?"":`transform: translateX(${g.getTrackOffset()});`}">
                    ${m.map((t,c)=>{let d=[],b=[t.id];b.forEach(h=>{(this._spatialState.columns&&this._spatialState.columns[h]?.pinned||[]).forEach(y=>{const $=p.find(T=>pinMatchesSlot(y,T));d.push({id:$?.id||y.id,rawId:$?.rawId||y.rawId||y.id,label:$?.label||y.label||y.title||y.id,component:$?.component||y.component,extName:$?.extName||y.extName||null,targetParent:$?.targetParent||y.targetParent||h,preferredColumn:$?.preferredColumn||y.preferredColumn||h,icon:$?.icon||y.icon,intent:$?.intent||y.intent,bulkActionGroup:$?.bulkActionGroup||y.bulkActionGroup||null,bulkEntityTypes:$?.bulkEntityTypes||y.bulkEntityTypes||null,menuStores:$?.menuStores||y.menuStores||null,menuActions:$?.menuActions||y.menuActions||null,headerActionComponent:$?.headerActionComponent||y.headerActionComponent||null,actualSourceCol:h})})}),u&&typeof i.getExtension=="function"&&(d=d.filter(h=>(i.getExtension(h.extName)?.offline_mode||"none")!=="none"));let l=null;const C=this._spatialState.focusedColumn,P=this._spatialState.columns[C]?.active;if(b.includes(C)&&(l=d.find(h=>pinMatchesSlot(h,P))),!l)for(const h of b){const k=this._spatialState.columns[h]?.active;if(l=d.find(y=>pinMatchesSlot(y,k)),l)break}return l||(l=d[0]),v`
                        <div class="spatial-col ${_===t.id&&s>1?"is-focused":""}" data-col-id="${t.id}" style="--col-width: ${g.getColWidth(c)}; --col-left: ${g.getColLeft(c)};" @click=${h=>{if(this._isPanningTrack){h.preventDefault(),h.stopPropagation();return}const k=l?l.id:d[0]?d[0].id:null,y=l&&l.actualSourceCol||t.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(y),k&&this._updateUrlHash(y,k)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${l&&l.intent?`var(--intent-${l.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${d.map(h=>{const k=l&&pinMatchesSlot(h,l.id),y=h.intent?`var(--intent-${h.intent})`:"var(--intent-primary)",$=h.icon||"component";return v`
                                        <div class="sub-tab ${k?"active":""}"
                                                style="${k?`border-bottom-color: ${y}; color: var(--text);`:""}"
                                                @pointerdown=${T=>{const R=Date.now();if(this._lastTapId===h.id&&R-(this._lastTapTime||0)<300){T.stopPropagation();const E=window.Sutram?.stores?.Layout?.getState();E&&(E.unpinFromColumn(h.actualSourceCol||t.id,h.id),E.openWindow(h,t.id,1)),this._lastTapTime=0;return}this._lastTapId=h.id,this._lastTapTime=R,this._handlePointerDown(T,h,h.actualSourceCol||t.id,"subtab")}}
                                                @dblclick=${T=>{T.stopPropagation();const R=window.Sutram?.stores?.Layout?.getState();R&&(R.unpinFromColumn(h.actualSourceCol||t.id,h.id),R.openWindow(h,t.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(h.actualSourceCol||t.id),this._handleSubTabClick(h.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${y}; opacity:${k?"1":"0.5"};">
                                                    <yv-icon name="${$}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${h.label}${i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",h.id)?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: stretch; height: 100%;">
                                    ${l&&l.headerActionComponent?v`
                                        <div style="display: flex; align-items: stretch; height: 100%;" data-ext="${l.extName}">${o(l.headerActionComponent,l.id)}</div>
                                    `:""}
                                    ${l?this._layoutConfig.filter(h=>h.slot==="slots:sub-navigation-actions"&&(h.targetSub===l.id||h.extName===l.extName&&(h.targetSub===l.rawId||h.targetSub===`${l.extName}:${l.rawId}`))).map(h=>v`<div style="display: contents;" data-ext="${h.extName}">${o(h.component,l.id)}</div>`):""}
                                    ${l&&(l.bulkActionGroup||l.menuActions)?v`
                                        <sutram-subtab-menu .slotConfig=${l}></sutram-subtab-menu>
                                    `:""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${d.map(h=>{const k=l&&pinMatchesSlot(h,l.id),y=o(h.component,h.id);return v`
                                        <div style="display: ${k?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${h.extName}" data-offline-mode="${(typeof i.getExtension=="function"?i.getExtension(h.extName)?.offline_mode:null)||"none"}">
                                            ${y}
                                        </div>
                                    `})}
                                ${d.length===0?v`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${t.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(t=>{const d={left:0,center:1,right:2}[t.anchorCol||"center"]??1;let b=Math.min(t.span||1,3-d);b=Math.min(b,s);const l=g.getWinBounds(d,b,f);return v`
                            <div style="position: absolute; left: ${l.left}; width: ${l.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${t.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${t.label||t.id}
                                    .anchorCol=${t.anchorCol||"center"}
                                    .span=${b}
                                    .z=${t.z}
                                    .icon=${t.icon||"component"}
                                    .intent=${t.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(t.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(t.id)})}}
                                    @sutram-window-span=${C=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(t.id,t.anchorCol||"center",C.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(t.id)}
                                    @sutram-window-drag-start=${C=>this._handlePointerDown(C.detail.originalEvent,t,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(t.windowOnly)return;const C=window.Sutram?.stores?.Layout?.getState();if(C){const P=t.preferredColumn||"center";C.closeWindow(t.id),C.pinToColumn(P,t),C.setActiveProjection(P,t.id),C.setFocusedColumn(P),this.requestUpdate()}}}>
                            ${o(t.component,t.id,t.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${n.map(t=>o(t.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=e,w}catch(e){return console.error("[Telemetry] AppShell render error:",e),v`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${e.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${e.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
