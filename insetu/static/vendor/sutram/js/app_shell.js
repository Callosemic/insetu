import{html as v,css as j}from"lit";import{SutramElement as A,ExtensionRegistry as R,LayoutStore as z,StoreRegistry as N}from"./sutram_sdk.js";import{sharedStyles as U}from"./shared_styles.js";import{debounce as E}from"./utils.js";import{SutramProjectionCompiler as q,SutramProjectionPool as H}from"./projection_engine.js";import"./drag-coordinator.js";import{physics as V}from"sutram-chassis";const{YenvuiGestureController:M,YenvuiViewportGuard:W,getDeepElementFromPoint:J}=V,D=($,e,i)=>{const a=Array.isArray(i)&&i.length>0?i:[1,1,1],o=$===1?a.map(()=>1):a,p=Math.max(0,Math.min(e,o.length-$)),c=o.slice(p,p+$).reduce((l,d)=>l+d,0)||1;return{getColWidth:l=>`${o[l]/c*100}%`,getColLeft:l=>`${o.slice(0,l).reduce((S,x)=>S+x,0)/c*100}%`,getTrackOffset:()=>`-${o.slice(0,p).reduce((d,S)=>d+S,0)/c*100}%`,getWinBounds:(l,d)=>{const S=Math.min(d,o.length-l),x=o.slice(0,l).reduce((h,f)=>h+f,0),g=o.slice(l,l+S).reduce((h,f)=>h+f,0);return{left:`${x/c*100}%`,width:`${g/c*100}%`}}}};export const pinMatchesSlot=($,e)=>{if(!$||!e)return!1;const i=typeof e=="string"?e:e.id||"",a=typeof e=="object"&&e.rawId?e.rawId:i.includes("://")?i:i.includes(":")?i.split(":").slice(1).join(":"):i,o=typeof e=="object"&&e.extName?e.extName:!i.includes("://")&&i.includes(":")?i.split(":")[0]:null;if($.id===i||$.rawId&&$.rawId===a&&(!o||!$.extName||$.extName===o)||o&&$.id===a&&(!$.extName||$.extName===o))return!0;if($.id&&!$.id.includes("://")&&$.id.includes(":")){const[p,c]=$.id.split(":");if(c===a&&(!o||p===o))return!0}return $.id===a&&!o};export class SutramAppShell extends A{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[U,j`
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
        .projection-mount-slot > * {
            flex: 1;
            min-height: 0;
            min-width: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }
    `];constructor(){super(),this._layoutConfig=[],this._projectionPool=new H,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(e,i){const a=window.ExtensionRegistry||R;a?.executeUIHook&&a.executeUIHook("sutram:is-projection-dirty",e)&&!confirm(`You have unsaved changes in ${e.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||i()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(e,i,a,o="subtab"){let p=null;const c=this.shadowRoot.querySelector(".spatial-track"),l=c?c.getBoundingClientRect():{top:38,height:window.innerHeight-68};if(a==="window"){const g=e.composedPath().find(h=>h.tagName&&h.tagName.toLowerCase()==="sutram-window");if(g&&g.parentElement){const h=g.parentElement.getBoundingClientRect();p={left:h.left,top:h.top,width:h.width,height:h.height}}}else if(a){const x=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${a}"]`);if(x){const g=x.getBoundingClientRect();p={left:g.left,top:g.top,width:g.width,height:g.height}}}p||(p={left:0,top:l.top,width:window.innerWidth,height:l.height});const d=e.clientX!==void 0?e.clientX:e.touches&&e.touches[0]?e.touches[0].clientX:0,S=e.clientY!==void 0?e.clientY:e.touches&&e.touches[0]?e.touches[0].clientY:0;this._dragState={active:!1,entity:i,sourceCol:a,currentZone:null,startX:d,startY:S,currentX:d,currentY:S,originType:o,sourceRect:p},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:(x,g)=>{this._dragState&&(x!==void 0&&!isNaN(x)&&(this._dragState.currentX=x),g!==void 0&&!isNaN(g)&&(this._dragState.currentY=g)),this._activateDrag()},onPanMove:(x,g)=>{if(!this._dragState.active){const w=Math.abs(x-this._dragState.startX),s=Math.abs(g-this._dragState.startY);(w>8||s>8)&&this._activateDrag();return}this._dragState.currentX=x,this._dragState.currentY=g;let h=!1;const f=this.shadowRoot.querySelector("sutram-drag-coordinator");if(f){const w=typeof f.getHoveredZone=="function"?f.getHoveredZone(x,g):null;this._dragState.currentZone!==w&&(this._dragState.currentZone=w,h=!0),h?f.dragState={...this._dragState}:typeof f.updatePointer=="function"&&f.updatePointer(x,g)}},onPanEnd:(x,g)=>{if(this._dragState.active){const h=this._dragState.currentZone,f=this._dragState.entity,w=this._dragState.sourceCol;if(h&&window.Sutram?.stores?.Layout){const s=window.Sutram.stores.Layout.getState();if(h==="close")this._safeEvict(f.id,()=>{w==="window"?s.closeWindow(f.id):w&&s.unpinFromColumn(w,f.id),s.evictProjection(f.id);const t=window.Sutram.stores.Layout.getState(),r=t.focusedColumn||w||"center",n=t.columns[r]?.active||"";this._updateUrlHash(r,n)});else if(h==="popout"){const t=w&&w!=="window"?w:s.focusedColumn||"center";s.popoutProjection(f.id,{originCol:t})}else if(h==="window"||h==="mode-window"){const t=w&&w!=="window"?w:f.anchorCol||s.focusedColumn||"center";w&&w!=="window"&&s.unpinFromColumn(w,f.id),s.openWindow(f,t,1)}else if(h==="mode-tab"&&!f?.windowOnly){const t=w&&w!=="window"?w:f.anchorCol||s.focusedColumn||"center";w==="window"&&s.closeWindow(f.id),s.columns[t]?.pinned?.some(r=>r.id===f.id)||s.pinToColumn(t,f),s.setActiveProjection(t,f.id),s.setFocusedColumn(t)}else if(h.startsWith("span-")){const t=h.split("-"),r=parseInt(t[1],10),n=t[2];w==="window"?s.updateWindowConstraints(f.id,n,r):(w&&s.unpinFromColumn(w,f.id),s.openWindow(f,n,r))}else if(h.startsWith("reorder-")){if(w){const t=parseInt(h.replace("reorder-",""),10),r=[...s.columns[w].pinned],n=r.findIndex(y=>y.id===f.id);if(n!==-1&&n!==t){const[y]=r.splice(n,1);r.splice(t,0,y),window.Sutram.stores.Layout.setState(u=>({columns:{...u.columns,[w]:{...u.columns[w],pinned:r}}}))}}}else if(["left","center","right"].includes(h)&&h!==w&&!f?.windowOnly){const t=h;w==="window"?s.closeWindow(f.id):w&&s.unpinFromColumn(w,f.id),s.pinToColumn(t,f),s.setActiveProjection(t,f.id),s.setFocusedColumn(t)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(e,{lockAxis:o==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(e=>{e&&typeof e.abort=="function"&&e.abort()})}updated(e){super.updated(e);const i=this.shadowRoot.querySelector(".spatial-track");if(i){const o=this._spatialState?.capacity||3,p=this._spatialState?.mobileViewportIndex??1,c=this._spatialState?.layoutRatios||[1,1,1],l=D(o,p,c);this._isPanningTrack||(i.style.transform=`translateX(${l.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(o=>{const p=o.closest("sutram-scrub-track, yenvui-scrub-track");if(p&&p.shadowRoot){const c=p.shadowRoot.querySelector(".scrub-container");if(c){const l=o.getBoundingClientRect();if(l.width>0){const d=c.getBoundingClientRect();c.scrollBy({left:l.left-d.left-d.width/2+l.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{if(super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),W.install(),this.registerGlobalListener("click",document,e=>{this._launcherDropdown&&!e.composedPath().some(i=>i.classList?.contains("global-launcher-menu")||i.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),z){this.subscribe(z,i=>{const a=i||{};this._spatialState={capacity:a.capacity||3,focusedColumn:a.focusedColumn||"center",mobileViewportIndex:a.mobileViewportIndex??1,layoutRatios:a.layoutRatios||null,columns:a.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:a.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,i=>{const a=i.detail?.extName;a&&this._projectionPool.evictExtension(a),this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,i=>{const{oldId:a,newId:o}=i.detail||{};if(!a||!o)return;if(this._projectionPool.rekey(a,o),decodeURIComponent(window.location.hash||"").includes(a)){const c=z.getState(),l=c.focusedColumn||"center";if(this.variant==="popout"){const d=window.location.hash.replace(encodeURIComponent(a),encodeURIComponent(o)).replace(a,o);d!==window.location.hash&&window.history.replaceState(null,"",d)}else c.columns?.[l]?.active===o&&this._updateUrlHash(l,o)}this.requestUpdate()});const e=()=>{const i=window.innerWidth,a=Math.min(3,Math.max(1,Math.floor(i/360))),o=z.getState();if(o){const p=o.capacity||3,c=o.userCapacity||3,l=Math.min(c,a),d={left:0,center:1,right:2};if(p!==l&&typeof o.setCapacity=="function"&&o.setCapacity(l),(a===1||o.capacity===1)&&o.focusedColumn){const g=d[o.focusedColumn]??1;o.mobileViewportIndex!==g&&o.setMobileViewport(g)}else if(a===2&&o.focusedColumn&&p!==a){const g=d[o.focusedColumn]??1,h=g===0?0:g===2||o.mobileViewportIndex===2?2:0;o.setMobileViewport(h)}const S=Math.min(o.capacity||a,a);(o.windows||[]).forEach(g=>{let h=Math.min(g.span||1,S),f=g.anchorCol||"center";S===1?(h=1,f=o.focusedColumn||"center"):S===2&&f==="right"&&(f=h===2?"left":"center"),(h!==g.span||f!==g.anchorCol)&&o.updateWindowConstraints(g.id,f,h)})}};this._handleResize=E(e,100),window.addEventListener("resize",this._handleResize),this.registerGlobalListener("sutram:scope-transition-end",window,()=>{e()}),e()}this._debouncedCompile=E(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(e){console.error("[Telemetry] AppShell connectedCallback error:",e)}}_resolvePrimaryTabMeta(e){const i=(typeof e=="string"?e:e?.id)?.toLowerCase()||"",a=window.ExtensionRegistry||R,o=a?.executeUIHook?a.executeUIHook("sutram:resolve-primary-tab-meta",{id:i,tab:e}):null,p=d=>d?d==="neutral"||d==="muted"?"var(--text-muted)":`var(--intent-${d})`:null,c={context:{intent:"primary",icon:"folder-code"},edit:{intent:"highlight",icon:"edit-3"},diagnostics:{intent:"warning",icon:"activity"},tasks:{intent:"warning",icon:"check-square"},ctrl:{intent:"danger",icon:"terminal"},dev:{intent:"success",icon:"code"},offline:{intent:"neutral",icon:"wifi-off"},library:{intent:"highlight",icon:"book-open"}},l=e&&e.intent||o?.intent||c[i]?.intent||"primary";return{intent:l,color:p(l)||o?.color||"var(--intent-primary)",icon:e&&e.icon?e.icon:o?.icon||c[i]?.icon||"folder"}}_getPrimaryTabColor(e){return this._resolvePrimaryTabMeta(e).color}_getPrimaryTabIcon(e){const{color:i,icon:a}=this._resolvePrimaryTabMeta(e);return v`<sutram-icon name="${a}" size="sm" stroke-width="2.5" style="margin-right: 8px; vertical-align: text-bottom; color: ${i};"></sutram-icon>`}_compileLayout(){try{this._layoutConfig=q.getCompiledLayout();const e=window.Sutram?.stores?.Layout,i=window.ExtensionRegistry||R,a=window.Sutram?.storeRegistry||N,o=!!(a&&typeof a.isTransitioning=="function"&&a.isTransitioning()||i?.executeUIHook&&(i.executeUIHook("sutram:is-swapping-scope")||i.executeUIHook("sutram:is-swapping-workspace")));if(e&&!i.isBooting&&!o){const p=e.getState();let c=!1;const l={},d={...p.columns},S=s=>typeof i._filterPredicate=="function"?i._filterPredicate(s):!0,x=this._layoutConfig.filter(s=>s.slot==="slots:sub-navigation");["left","center","right"].forEach(s=>{if(!d[s]||!d[s].pinned)return;const t=d[s].pinned.filter(r=>!r.extName||S(r.extName)).map(r=>{const n=x.find(y=>pinMatchesSlot(r,y));return n&&(r.id!==n.id&&(l[r.id]=n.id,c=!0),n.icon!==r.icon||n.label!==r.label||n.intent!==r.intent||n.rawId!==r.rawId||r.id!==n.id)?(c=!0,{...r,id:n.id,rawId:n.rawId||n.id,extName:n.extName,icon:n.icon||r.icon,label:n.label||r.label,intent:n.intent||r.intent}):r});(t.length!==d[s].pinned.length||c)&&(d[s]={...d[s],pinned:t},d[s].active&&l[d[s].active]?(d[s].active=l[d[s].active],c=!0):d[s].active&&!t.some(r=>pinMatchesSlot(r,d[s].active))&&(d[s].active=t.length>0?t[0].id:null,c=!0),Array.isArray(d[s].history)&&(d[s].history=d[s].history.map(r=>l[r]||r)))});const g=p.windows||[],h=g.filter(s=>!s.extName||S(s.extName));h.length!==g.length&&(c=!0);let f=h.map(s=>{const t=x.find(r=>r.id===s.id||s.extName&&r.extName===s.extName&&r.rawId===s.id);return t&&s.id!==t.id?(l[s.id]=t.id,c=!0,{...s,id:t.id,rawId:t.rawId,extName:t.extName,icon:t.icon||s.icon,label:t.label||s.label}):s}),w=(p.focusHistory||[]).map(s=>s&&s.id&&l[s.id]?(c=!0,{...s,id:l[s.id]}):s);c&&(e.setState({columns:d,windows:f,focusHistory:w}),Object.keys(l).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:l},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(e){console.error("[Telemetry] AppShell _compileLayout error:",e)}}_renderDropdownItem(e){let i=null;if(this._spatialState&&this._spatialState.columns){for(const a of["left","center","right"])if(this._spatialState.columns[a].pinned.some(o=>pinMatchesSlot(o,e))){i=a;break}}return v`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${a=>{const o=window.Sutram?.stores?.Layout?.getState();let p=null;if(o&&o.columns){for(const c of["left","center","right"])if(o.columns[c].pinned.some(l=>pinMatchesSlot(l,e))){p=c;break}}this._handlePointerDown(a,e,p,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const a=window.Sutram?.stores?.Layout?.getState();let o=null,p=null;if(a&&a.columns){for(const d of["left","center","right"])if(p=a.columns[d].pinned.find(S=>pinMatchesSlot(S,e)),p){o=d;break}}let c=o;const l=p?p.id:e.id;o||(c=e.preferredColumn||"center",a&&a.pinToColumn(c,e)),a&&(a.setFocusedColumn(c),a.setActiveProjection(c,l)),this._handleSubTabClick(l),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    <sutram-icon name="${e.icon||"puzzle"}" size="sm" style="color: ${i?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></sutram-icon>
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${e.label}</span>
            </button>
        `}_updateUrlHash(e,i){const a=window.ExtensionRegistry||R,o=a?.executeUIHook?a.executeUIHook("sutram:resolve-route-hash",{colId:e,subId:i}):null,p=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",c=o||`#/${p}/${e}/${encodeURIComponent(i)}`;window.location.hash!==c&&window.history.replaceState(null,"",c)}_handleSubTabClick(e){let i=null,a=!1,o=e;if(window.Sutram?.stores?.Layout){const p=window.Sutram.stores.Layout.getState();for(const c of["left","center","right"]){const l=p.columns[c]?.pinned.find(d=>pinMatchesSlot(d,e));if(l){i=c,o=l.id;break}}if(i){a=p.columns[i].active===o,p.setActiveProjection(i,o),p.setFocusedColumn(i);const c={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(c[i])}}if(a){const p=this.shadowRoot.querySelector(`[data-sub-id="${o}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${e}"]`);p&&typeof p.onForceRefresh=="function"&&p.onForceRefresh()}this.requestUpdate(),i&&this._updateUrlHash(i,o)}_handleDotDragStart(e){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const i=this.shadowRoot.querySelector(".spatial-track");i&&(i.style.transition="none")},onPanMove:(i,a,o)=>{if(o==="horizontal"){const p=i-this._dotDragController.startX,c=this._spatialState?.mobileViewportIndex??1,l=this._spatialState?.capacity||3,d=this._spatialState?.layoutRatios||[1,1,1],S=D(l,c,d),x=parseFloat(S.getTrackOffset()),g=this.shadowRoot.querySelector(".spatial-track");if(g){let h=p;const f=Math.max(0,d.length-l),w=D(l,f,d).getTrackOffset(),s=parseFloat(w);(x<=s&&p<0||x>=0&&p>0)&&(h=p*.2),g.style.transform=`translateX(calc(${x}% + ${h}px))`}}},onPanEnd:(i,a,o)=>{const p=this.shadowRoot.querySelector(".spatial-track");if(p&&(p.style.transition=""),o==="horizontal"){const c=i-this._dotDragController.startX,l=window.innerWidth*.2,d=this._spatialState?.mobileViewportIndex??1,S=this._spatialState?.capacity||3,x=this._spatialState?.layoutRatios||[1,1,1],g=Math.max(0,x.length-S);let h=d;if(c>l?h=Math.max(0,d-1):c<-l&&(h=Math.min(g,d+1)),this._isPanningTrack=!1,h!==d)this._setViewportIndex(h);else{const f=D(S,h,x);p&&(p.style.transform=`translateX(${f.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(e)}_setViewportIndex(e){if(window.Sutram?.stores?.Layout){const i=window.Sutram.stores.Layout.getState();i.setMobileViewport(e);const a=["left","center","right"];a[e]&&i.setFocusedColumn(a[e])}}render(){try{this._projectionPool.beginPass();const e=(t,r=null,n=null)=>this._projectionPool.resolve(t,r,n),i=window.ExtensionRegistry||R,a=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let o=this._layoutConfig.filter(t=>t.slot==="slots:primary-navigation");const p=this._layoutConfig.filter(t=>t.slot==="slots:global"),c=this._layoutConfig.filter(t=>t.slot==="slots:sub-navigation");a&&typeof i.getExtension=="function"&&(o=o.filter(t=>{const r=t.extName?i.getExtension(t.extName):null;return r&&r.offline_mode&&r.offline_mode!=="none"?!0:c.filter(y=>(y.targetParent||"").toLowerCase()===(t.id||"").toLowerCase()).some(y=>(i.getExtension(y.extName)?.offline_mode||"none")!=="none")}));const{capacity:l,mobileViewportIndex:d,focusedColumn:S}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},x=l===1?"mobile":l===2?"tablet":"desktop",g=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],h=this._spatialState.layoutRatios||[1,1,1],f=D(l,d,h);this.dataset.viewport=x;const w=this.variant==="popout";if(w){const t=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",r=t?t.split("/").map(decodeURIComponent):[];let n="";r.length>=4&&r[2]==="editor"?n=r.slice(3).join("/"):r.length>=3&&(n=r.slice(2).join("/"));const y=this._spatialState?.focusedColumn||"center",u=this._spatialState?.columns?.[y];n=n||u?.active||u?.pinned?.[0]?.id;let _=c.find(C=>C.id===n||!n.includes(":")&&C.rawId===n),P=null;if(_)_.allow_popout?P=e(_.component,_.id):P=v`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <sutram-icon name="alert-triangle" size="xl" intent="warning" style="margin-bottom: 16px;"></sutram-icon>
                            <h3 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${_.label||_.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(n){const C=typeof i.resolveCustomEditor=="function"?i.resolveCustomEditor(n):null,b=i?.executeUIHook?i.executeUIHook("sutram:resolve-editor-component",n):null,k=C?.component||b||"sutram-editor";P=e(k,n)}const m=v`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div class="projection-mount-slot" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${P||v`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${p.map(C=>e(C.component))}
                </div>
            `;return this._projectionPool.commitPass(),m}const s=v`
            <div class="shell-container spatial-viewport" data-viewport="${x}">
                ${w?"":v`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 0; padding-right: 0; ${l<h.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${t=>{l<h.length&&this._handleDotDragStart(t)}}>
                        ${x==="mobile"?v`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${t=>{if(t.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const r=o[0]?o[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:r}}this.requestUpdate()}}>
                                    <sutram-icon name="wrench" size="sm" intent="primary" stroke-width="2.5" style="margin-right: 6px;"></sutram-icon>
                                    <span>Tools</span>
                                    <sutram-icon name="chevron-down" size="xs" intent="muted" stroke-width="2.5" style="margin-left: 4px;"></sutram-icon>
                                </button>
                            </div>
                        `:v`
                            <sutram-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${o.map(t=>{const r=c.filter(n=>(n.targetParent||"").toLowerCase()===t.id.toLowerCase());return v`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(t)};" @click=${n=>{if(this._launcherDropdown?.tabId===t.id)this._launcherDropdown=null;else{const y=n.currentTarget.getBoundingClientRect(),u=y.right>window.innerWidth-200;this._launcherDropdown={tabId:t.id,items:r,x:u?"auto":y.left+"px",right:u?window.innerWidth-y.right+"px":"auto",y:y.bottom+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(t)}${t.label}
                                        </button>
                                    `})}
                            </sutram-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${l===1&&l<h.length?v`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,h.length-l+1)}).map((t,r)=>v`
                                    <div class="pos-dot-target" @click=${n=>{n.stopPropagation(),n.preventDefault()}} @pointerdown=${n=>{n.stopPropagation(),this._setViewportIndex(r)}} title="Jump to View ${r+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${d===r?"active":""}" style="width: ${d===r?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${d===r?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${d===r?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}
                        <!-- Top Right Utility Rail -->
                        <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: stretch; gap: 0; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 0;">
                            <slot name="header-quickpack"></slot>
                            <slot name="header-actions-left"></slot>
                            ${l>1&&l<h.length?v`
                                <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    ${Array.from({length:Math.max(1,h.length-l+1)}).map((t,r)=>v`
                                        <div class="pos-dot-target" @click=${n=>{n.stopPropagation(),n.preventDefault()}} @pointerdown=${n=>{n.stopPropagation(),this._setViewportIndex(r)}} title="Jump to View ${r+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${d===r?"active":""}" style="width: ${d===r?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${d===r?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${d===r?"1":"0.5"}; transition: all 0.2s ease;"></div>
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
                            ${o.map(t=>{const r=c.filter(n=>(n.targetParent||"").toLowerCase()===t.id.toLowerCase());return r.length===0?"":v`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(t)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(t)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${t.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${r.map(n=>{let y=null;if(this._spatialState&&this._spatialState.columns){for(const u of["left","center","right"])if(this._spatialState.columns[u].pinned.some(_=>_.id===n.id)){y=u;break}}return v`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${u=>{const _=window.Sutram?.stores?.Layout?.getState();let P=null;if(_&&_.columns){for(const m of["left","center","right"])if(_.columns[m].pinned.some(C=>C.id===n.id)){P=m;break}}this._handlePointerDown(u,n,P,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const u=window.Sutram?.stores?.Layout?.getState(),{capacity:_,focusedColumn:P,mobileViewportIndex:m}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let C=null;if(u&&u.columns){for(const k of["left","center","right"])if(u.columns[k].pinned.some(I=>I.id===n.id)){C=k;break}}let b=C;C||(b=n.preferredColumn||"center",u&&u.pinToColumn(b,n)),u&&u.setFocusedColumn(b),this._handleSubTabClick(n.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        <sutram-icon name="${n.icon||"puzzle"}" size="sm" style="color: ${y?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></sutram-icon>
                                                    </div>
                                                    <span style="white-space: nowrap;">${n.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:v`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(t=>this._renderDropdownItem(t))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${l}" style="${this._isPanningTrack?"":`transform: translateX(${f.getTrackOffset()});`}">
                    ${g.map((t,r)=>{let n=[],y=[t.id];y.forEach(m=>{(this._spatialState.columns&&this._spatialState.columns[m]?.pinned||[]).forEach(b=>{const k=c.find(I=>pinMatchesSlot(b,I));n.push({id:k?.id||b.id,rawId:k?.rawId||b.rawId||b.id,label:k?.label||b.label||b.title||b.id,component:k?.component||b.component,extName:k?.extName||b.extName||null,targetParent:k?.targetParent||b.targetParent||m,preferredColumn:k?.preferredColumn||b.preferredColumn||m,icon:k?.icon||b.icon,intent:k?.intent||b.intent,bulkActionGroup:k?.bulkActionGroup||b.bulkActionGroup||null,bulkEntityTypes:k?.bulkEntityTypes||b.bulkEntityTypes||null,menuStores:k?.menuStores||b.menuStores||null,menuActions:k?.menuActions||b.menuActions||null,headerActionComponent:k?.headerActionComponent||b.headerActionComponent||null,actualSourceCol:m})})}),a&&typeof i.getExtension=="function"&&(n=n.filter(m=>(i.getExtension(m.extName)?.offline_mode||"none")!=="none"));let u=null;const _=this._spatialState.focusedColumn,P=this._spatialState.columns[_]?.active;if(y.includes(_)&&(u=n.find(m=>pinMatchesSlot(m,P))),!u)for(const m of y){const C=this._spatialState.columns[m]?.active;if(u=n.find(b=>pinMatchesSlot(b,C)),u)break}return u||(u=n[0]),v`
                        <div class="spatial-col ${S===t.id&&l>1?"is-focused":""}" data-col-id="${t.id}" style="--col-width: ${f.getColWidth(r)}; --col-left: ${f.getColLeft(r)};" @click=${m=>{if(this._isPanningTrack){m.preventDefault(),m.stopPropagation();return}const C=u?u.id:n[0]?n[0].id:null,b=u&&u.actualSourceCol||t.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(b),C&&this._updateUrlHash(b,C)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${u&&u.intent?`var(--intent-${u.intent})`:"var(--intent-primary)"};">
                                <sutram-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${n.map(m=>{const C=u&&pinMatchesSlot(m,u.id),b=m.intent?`var(--intent-${m.intent})`:"var(--intent-primary)",k=m.icon||"component";return v`
                                        <div class="sub-tab ${C?"active":""}"
                                                style="${C?`border-bottom-color: ${b}; color: var(--text);`:""}"
                                                @pointerdown=${I=>{const T=Date.now();if(this._lastTapId===m.id&&T-(this._lastTapTime||0)<300){I.stopPropagation();const L=window.Sutram?.stores?.Layout?.getState();L&&(L.unpinFromColumn(m.actualSourceCol||t.id,m.id),L.openWindow(m,t.id,1)),this._lastTapTime=0;return}this._lastTapId=m.id,this._lastTapTime=T,this._handlePointerDown(I,m,m.actualSourceCol||t.id,"subtab")}}
                                                @dblclick=${I=>{I.stopPropagation();const T=window.Sutram?.stores?.Layout?.getState();T&&(T.unpinFromColumn(m.actualSourceCol||t.id,m.id),T.openWindow(m,t.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(m.actualSourceCol||t.id),this._handleSubTabClick(m.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${b}; opacity:${C?"1":"0.5"};">
                                                    <sutram-icon name="${k}" size="sm" stroke-width="2.5"></sutram-icon>
                                                </div>
                                            </div>
                                            ${m.label}${i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",m.id)?"*":""}
                                        </div>
                                    `})}
                                </sutram-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: stretch; height: 100%;">
                                    ${u&&u.headerActionComponent?v`
                                        <div style="display: flex; align-items: stretch; height: 100%;" data-ext="${u.extName}">${e(u.headerActionComponent,u.id)}</div>
                                    `:""}
                                    ${u?this._layoutConfig.filter(m=>m.slot==="slots:sub-navigation-actions"&&(m.targetSub===u.id||m.extName===u.extName&&(m.targetSub===u.rawId||m.targetSub===`${u.extName}:${u.rawId}`))).map(m=>v`<div style="display: contents;" data-ext="${m.extName}">${e(m.component,u.id)}</div>`):""}
                                    ${u&&(u.bulkActionGroup||u.menuActions)?v`
                                        <sutram-subtab-menu .slotConfig=${u}></sutram-subtab-menu>
                                    `:""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${n.map(m=>{const C=u&&pinMatchesSlot(m,u.id),b=e(m.component,m.id);return v`
                                        <div class="projection-mount-slot" style="display: ${C?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0; overflow: hidden;" data-ext="${m.extName}" data-offline-mode="${(typeof i.getExtension=="function"?i.getExtension(m.extName)?.offline_mode:null)||"none"}">
                                            ${b}
                                        </div>
                                    `})}
                                ${n.length===0?v`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${t.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(t=>{const n={left:0,center:1,right:2}[t.anchorCol||"center"]??1;let y=Math.min(t.span||1,3-n);y=Math.min(y,l);const u=f.getWinBounds(n,y,h);return v`
                            <div style="position: absolute; left: ${u.left}; width: ${u.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${t.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${t.label||t.id}
                                    .anchorCol=${t.anchorCol||"center"}
                                    .span=${y}
                                    .z=${t.z}
                                    .icon=${t.icon||"component"}
                                    .intent=${t.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(t.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(t.id)})}}
                                    @sutram-window-span=${_=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(t.id,t.anchorCol||"center",_.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(t.id)}
                                    @sutram-window-drag-start=${_=>this._handlePointerDown(_.detail.originalEvent,t,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(t.windowOnly)return;const _=window.Sutram?.stores?.Layout?.getState();if(_){const P=t.preferredColumn||"center";_.closeWindow(t.id),_.pinToColumn(P,t),_.setActiveProjection(P,t.id),_.setFocusedColumn(P),this.requestUpdate()}}}>
                            ${e(t.component,t.id,t.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${p.map(t=>e(t.component))}
            </div>
            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._projectionPool.commitPass(),s}catch(e){return console.error("[Telemetry] AppShell render error:",e),v`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><sutram-icon name="alert-triangle" size="lg"></sutram-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${e.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${e.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
