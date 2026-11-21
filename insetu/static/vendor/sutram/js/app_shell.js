import{html as P,css as Q}from"lit";import{SutramElement as tt,ExtensionRegistry as F,LayoutStore as U,StoreRegistry as et,columnCountFor as ot}from"./sutram_sdk.js";import{computeFitActionCount as it}from"./primitives.js";import{sharedStyles as nt}from"./shared_styles.js";import{debounce as G}from"./utils.js";import{SutramProjectionCompiler as at,SutramProjectionPool as st}from"./projection_engine.js";import"./drag-coordinator.js";import{physics as rt}from"sutram-chassis";const{YenvuiGestureController:Z,YenvuiViewportGuard:lt,getDeepElementFromPoint:wt}=rt,j=(T,t,o)=>{const n=Array.isArray(o)&&o.length>0?o:[1,1,1],e=T===1?n.map(()=>1):n,r=Math.max(0,Math.min(t,e.length-T)),d=e.slice(r,r+T).reduce((u,h)=>u+h,0)||1;return{getColWidth:u=>`${e[u]/d*100}%`,getColLeft:u=>`${e.slice(0,u).reduce((b,x)=>b+x,0)/d*100}%`,getTrackOffset:()=>`-${e.slice(0,r).reduce((h,b)=>h+b,0)/d*100}%`,getWinBounds:(u,h)=>{const b=Math.min(h,e.length-u),x=e.slice(0,u).reduce((c,s)=>c+s,0),p=e.slice(u,u+b).reduce((c,s)=>c+s,0);return{left:`${x/d*100}%`,width:`${p/d*100}%`}}}};export const pinMatchesSlot=(T,t)=>{if(!T||!t)return!1;const o=typeof t=="string"?t:t.id||"",n=typeof t=="object"&&t.rawId?t.rawId:o.includes("://")?o:o.includes(":")?o.split(":").slice(1).join(":"):o,e=typeof t=="object"&&t.extName?t.extName:!o.includes("://")&&o.includes(":")?o.split(":")[0]:null;if(T.id===o||T.rawId&&T.rawId===n&&(!e||!T.extName||T.extName===e)||e&&T.id===n&&(!T.extName||T.extName===e))return!0;if(T.id&&!T.id.includes("://")&&T.id.includes(":")){const[r,d]=T.id.split(":");if(d===n&&(!e||r===e))return!0}return T.id===n&&!e};export class SutramAppShell extends tt{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[nt,Q`
        :host {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - 30px); /* Account for global status bar */
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            overscroll-behavior: none;
            container: yv-band / inline-size; /* outside any column, the shell's width is the band */
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
        /* Top 4px Viewport Position Bar */
        .position-bar {
            display: flex;
            width: 100%;
            height: 4px;
            flex-shrink: 0;
            background: var(--border-dim, rgba(255, 255, 255, 0.06));
            z-index: 120;
            cursor: pointer;
            touch-action: none;
            user-select: none;
            overflow: hidden;
        }
        .position-bar-segment {
            height: 100%;
            background: transparent;
            border-right: 1px solid var(--border);
            box-sizing: border-box;
            transition: background 0.2s ease, opacity 0.2s ease;
        }
        .position-bar-segment:last-child {
            border-right: none;
        }
        .position-bar-segment.on-screen {
            background: var(--seg-intent, var(--intent-primary));
        }
        :host-context([data-theme="e-ink"]) .position-bar {
            background: var(--bg, #ffffff);
            border-bottom: 1px solid var(--border, #000000);
        }
        :host-context([data-theme="e-ink"]) .position-bar-segment.on-screen {
            background: var(--text, #000000);
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
            container: yv-band / inline-size; /* the column band container: no border, so its width is its share */
            overscroll-behavior-x: none;
            width: var(--col-width, 33.333%) !important;
            left: var(--col-left, 0%) !important;
            transition: width 0.32s cubic-bezier(0.2, 0.9, 0.2, 1), left 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
        }

        .spatial-col::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 1px;
            background: var(--border);
            pointer-events: none;
            z-index: 20;
        }
        :host([data-viewport="mobile"]) .spatial-col::after, [data-viewport="mobile"] .spatial-col::after,
        .spatial-col:last-child::after {
            display: none;
        }
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
            min-height: 44px;
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            padding: 0;
            flex-shrink: 0;
            position: relative;
            z-index: 100;
            overflow: visible !important;
            touch-action: none;
            user-select: none;
            box-sizing: border-box;
        }
        .col-tabs-area {
            flex: 1 1 0%;
            min-width: 0;
            height: 100%;
            display: flex;
            align-items: stretch;
            overflow: hidden;
        }
        .tab-menu-dropdown {
            display: inline-flex;
            align-items: stretch;
            height: 100%;
            flex: 0 0 auto;
        }
        .tab-menu-trigger {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 44px;
            width: 44px;
            padding: 0;
            margin: 0;
            border: none;
            border-radius: 0;
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
        }
        .tab-menu-trigger:hover {
            color: var(--text);
            background: var(--bg-hover);
        }
        .inline-tab-btn {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 100%;
            min-height: 44px;
            min-width: 44px;
            padding: 0 10px;
            margin: 0;
            border: none;
            border-bottom: 2px solid transparent;
            border-radius: 0;
            background: transparent;
            color: var(--text-muted);
            font-size: 0.85rem;
            font-weight: 500;
            white-space: nowrap;
            cursor: pointer;
            flex-shrink: 0;
            box-sizing: border-box;
            transition: color 0.15s ease, background 0.15s ease;
        }
        .inline-tab-btn:hover {
            color: var(--text);
            background: var(--bg-hover);
        }
        /* The active tab keeps its place and its weight (bold would widen it and re-fit the row); only the highlight marks it, never a tint on its text or icon. */
        .inline-tab-btn.active {
            color: var(--text);
            border-bottom-color: var(--active-sub-intent, var(--intent-primary));
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 18%, transparent);
            flex-shrink: 1;
            min-width: 44px;
            overflow: hidden;
        }
        .inline-tab-btn.active:hover {
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 28%, var(--bg-hover));
        }
        :host-context([data-theme="e-ink"]) .inline-tab-btn.active {
            background: transparent;
        }
        .inline-tab-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        .inline-tab-btn sutram-icon {
            flex-shrink: 0;
        }
        .col-globals-rail {
            display: flex;
            align-items: stretch;
            height: 100%;
            flex-shrink: 0;
            margin-left: auto;
        }
        /* A <slot> has no child nodes of its own, so :empty would hide what is assigned to it.
           Left at its default display: contents, it takes no space when nothing is pinned. */
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
    `];constructor(){super(),this._layoutConfig=[],this._projectionPool=new st,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._colTabsWidths={left:0,center:0,right:0},this._inlineTabClampCounts={left:null,center:null,right:null},this._lastRenderedInlineCounts={left:0,center:0,right:0},this._lastInlineClampKeys={left:"",center:"",right:""}}_safeEvict(t,o){const n=window.ExtensionRegistry||F;n?.executeUIHook&&n.executeUIHook("sutram:is-projection-dirty",t)&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||o()}_activateDrag(){this._dotDragController&&this._dotDragController.abort(),this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.shadowRoot&&this.shadowRoot.querySelectorAll(".tab-menu-dropdown").forEach(t=>{t.open&&(t.open=!1)}),this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,o,n,e="subtab"){let r=null;const d=this.shadowRoot.querySelector(".spatial-track"),u=d?d.getBoundingClientRect():{top:4,height:window.innerHeight-34};if(n==="window"){const p=t.composedPath().find(c=>c.tagName&&c.tagName.toLowerCase()==="sutram-window");if(p&&p.parentElement){const c=p.parentElement.getBoundingClientRect();r={left:c.left,top:c.top,width:c.width,height:c.height}}}else if(n){const x=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${n}"]`);if(x){const p=x.getBoundingClientRect();r={left:p.left,top:p.top,width:p.width,height:p.height}}}r||(r={left:0,top:u.top,width:window.innerWidth,height:u.height});const h=t.clientX!==void 0?t.clientX:t.touches&&t.touches[0]?t.touches[0].clientX:0,b=t.clientY!==void 0?t.clientY:t.touches&&t.touches[0]?t.touches[0].clientY:0;this._dragState={active:!1,entity:o,sourceCol:n,currentZone:null,startX:h,startY:b,currentX:h,currentY:b,originType:e,sourceRect:r},this._dragController||(this._dragController=new Z(this,{longPressDelay:500,onLongPress:(x,p)=>{this._dragState&&(x!==void 0&&!isNaN(x)&&(this._dragState.currentX=x),p!==void 0&&!isNaN(p)&&(this._dragState.currentY=p)),this._activateDrag()},onPanMove:(x,p)=>{if(!this._dragState.active){const m=Math.abs(x-this._dragState.startX),i=Math.abs(p-this._dragState.startY);(m>8||i>8)&&this._activateDrag();return}this._dragState.currentX=x,this._dragState.currentY=p;let c=!1;const s=this.shadowRoot.querySelector("sutram-drag-coordinator");if(s){const m=typeof s.getHoveredZone=="function"?s.getHoveredZone(x,p):null;this._dragState.currentZone!==m&&(this._dragState.currentZone=m,c=!0),c?s.dragState={...this._dragState}:typeof s.updatePointer=="function"&&s.updatePointer(x,p)}},onPanEnd:(x,p)=>{if(this._dragState.active){const c=this._dragState.currentZone,s=this._dragState.entity,m=this._dragState.sourceCol;if(c&&window.Sutram?.stores?.Layout){const i=window.Sutram.stores.Layout.getState();if(c==="close")this._safeEvict(s.id,()=>{m==="window"?i.closeWindow(s.id):m&&i.unpinFromColumn(m,s.id),i.evictProjection(s.id);const f=window.Sutram.stores.Layout.getState(),w=f.focusedColumn||m||"center",y=f.columns[w]?.active||"";this._updateUrlHash(w,y)});else if(c==="popout"){const f=m&&m!=="window"?m:i.focusedColumn||"center";i.popoutProjection(s.id,{originCol:f})}else if(c==="window"||c==="mode-window"){const f=m&&m!=="window"?m:s.anchorCol||i.focusedColumn||"center";m&&m!=="window"&&i.unpinFromColumn(m,s.id),i.openWindow(s,f,1)}else if(c==="mode-tab"&&!s?.windowOnly){const f=m&&m!=="window"?m:s.anchorCol||i.focusedColumn||"center";m==="window"&&i.closeWindow(s.id),i.columns[f]?.pinned?.some(w=>w.id===s.id)||i.pinToColumn(f,s),i.setActiveProjection(f,s.id),i.setFocusedColumn(f)}else if(c.startsWith("span-")){const f=c.split("-"),w=parseInt(f[1],10),y=f[2];m==="window"?i.updateWindowConstraints(s.id,y,w):(m&&i.unpinFromColumn(m,s.id),i.openWindow(s,y,w))}else if(c.startsWith("reorder-")){if(m){const f=parseInt(c.replace("reorder-",""),10),w=[...i.columns[m].pinned],y=w.findIndex(a=>a.id===s.id);if(y!==-1&&y!==f){const[a]=w.splice(y,1);w.splice(f,0,a),window.Sutram.stores.Layout.setState(_=>({columns:{..._.columns,[m]:{..._.columns[m],pinned:w}}}))}}}else if(["left","center","right"].includes(c)&&c!==m&&!s?.windowOnly){const f=c;m==="window"?i.closeWindow(s.id):m&&i.unpinFromColumn(m,s.id),i.pinToColumn(f,s),i.setActiveProjection(f,s.id),i.setFocusedColumn(f)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:e==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),this._tabsAreaObserver&&(this._tabsAreaObserver.disconnect(),this._tabsAreaObserver=null),[this._dragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const o=this.shadowRoot.querySelector(".spatial-track");if(o){const n=this._spatialState?.capacity||3,e=this._spatialState?.mobileViewportIndex??1,r=this._spatialState?.layoutRatios||[1,1,1],d=j(n,e,r);this._isPanningTrack||(o.style.transform=`translateX(${d.getTrackOffset()})`)}typeof ResizeObserver<"u"&&(this._tabsAreaObserver||(this._tabsAreaObserver=new ResizeObserver(n=>{let e=!1;const r={...this._colTabsWidths},d={...this._inlineTabClampCounts};n.forEach(u=>{const h=u.target?.dataset?.colTabs,b=u.contentRect?u.contentRect.width:u.target.clientWidth;h&&b>0&&Math.abs((r[h]||0)-b)>2&&(r[h]=b,d[h]=null,e=!0)}),e&&(this._colTabsWidths=r,this._inlineTabClampCounts=d,this.requestUpdate())})),this.shadowRoot.querySelectorAll(".col-tabs-area").forEach(n=>{this._tabsAreaObserver.observe(n);const e=n.dataset?.colTabs;e&&n.clientWidth>0&&!this._colTabsWidths[e]&&(this._colTabsWidths={...this._colTabsWidths,[e]:n.clientWidth})})),this._checkInlineTabsOverflow()}_checkInlineTabsOverflow(){if(!this.shadowRoot)return;let t=!1;const o={...this._inlineTabClampCounts};this.shadowRoot.querySelectorAll(".col-tabs-area").forEach(n=>{const e=n.dataset?.colTabs;if(!e||n.clientWidth<=0)return;const r=this._lastRenderedInlineCounts?.[e]||0;r>0&&n.scrollWidth>n.clientWidth+1&&(o[e]=r-1,t=!0)}),t&&(this._inlineTabClampCounts=o,this.requestUpdate())}_queueMoveTabToFront(t,o){const n=`${t}:${o}`;this._pendingFrontMove!==n&&(this._pendingFrontMove=n,queueMicrotask(()=>{this._pendingFrontMove=null;const e=window.Sutram?.stores?.Layout?.getState(),r=e?.columns?.[t]?.pinned?.find(d=>pinMatchesSlot(d,o));r&&e.movePinToFront?.(t,r.id)}))}_isProjectionDirty(t){const o=window.ExtensionRegistry||F;return!!(t&&o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",t))}_formatTabLabel(t){return t?`${t.label}${this._isProjectionDirty(t.id)?"*":""}`:""}connectedCallback(){try{if(super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),lt.install(),U){this.subscribe(U,o=>{const n=o||{};this._spatialState={capacity:n.capacity||3,focusedColumn:n.focusedColumn||"center",mobileViewportIndex:n.mobileViewportIndex??1,layoutRatios:n.layoutRatios||null,columns:n.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:n.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,o=>{const n=o.detail?.extName;n&&this._projectionPool.evictExtension(n),this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,o=>{const{oldId:n,newId:e}=o.detail||{};if(!n||!e)return;if(this._projectionPool.rekey(n,e),decodeURIComponent(window.location.hash||"").includes(n)){const d=U.getState(),u=d.focusedColumn||"center";if(this.variant==="popout"){const h=window.location.hash.replace(encodeURIComponent(n),encodeURIComponent(e)).replace(n,e);h!==window.location.hash&&window.history.replaceState(null,"",h)}else d.columns?.[u]?.active===e&&this._updateUrlHash(u,e)}this.requestUpdate()});const t=()=>{const o=window.innerWidth,n=ot(o),e=U.getState();if(e){const r=e.capacity||3,d=e.userCapacity||3,u=Math.min(d,n),h={left:0,center:1,right:2};if(r!==u&&typeof e.setCapacity=="function"&&e.setCapacity(u),(n===1||e.capacity===1)&&e.focusedColumn){const p=h[e.focusedColumn]??1;e.mobileViewportIndex!==p&&e.setMobileViewport(p)}else if(n===2&&e.focusedColumn&&r!==n){const p=h[e.focusedColumn]??1,c=Math.max(0,(e.layoutRatios||[1,1,1]).length-n),s=p===0?0:p===2?c:Math.min(e.mobileViewportIndex??0,c);e.setMobileViewport(s)}const b=Math.min(e.capacity||n,n);(e.windows||[]).forEach(p=>{let c=Math.min(p.span||1,b),s=p.anchorCol||"center";b===1?(c=1,s=e.focusedColumn||"center"):b===2&&s==="right"&&(s=c===2?"left":"center"),(c!==p.span||s!==p.anchorCol)&&e.updateWindowConstraints(p.id,s,c)})}};this._handleResize=G(t,100),window.addEventListener("resize",this._handleResize),this.registerGlobalListener("sutram:scope-transition-end",window,()=>{t()}),t()}this._debouncedCompile=G(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_compileLayout(){try{this._layoutConfig=at.getCompiledLayout();const t=window.Sutram?.stores?.Layout,o=window.ExtensionRegistry||F,n=window.Sutram?.storeRegistry||et,e=!!(n&&typeof n.isTransitioning=="function"&&n.isTransitioning()||o?.executeUIHook&&(o.executeUIHook("sutram:is-swapping-scope")||o.executeUIHook("sutram:is-swapping-workspace")));if(t&&!o.isBooting&&!e){const r=t.getState();let d=!1;const u={},h={...r.columns},b=i=>typeof o._filterPredicate=="function"?o._filterPredicate(i):!0,x=this._layoutConfig.filter(i=>i.slot==="slots:sub-navigation");["left","center","right"].forEach(i=>{if(!h[i]||!h[i].pinned)return;const f=h[i].pinned.filter(w=>!w.extName||b(w.extName)).map(w=>{const y=x.find(a=>pinMatchesSlot(w,a));return y&&(w.id!==y.id&&(u[w.id]=y.id,d=!0),y.icon!==w.icon||y.label!==w.label||y.intent!==w.intent||y.rawId!==w.rawId||w.id!==y.id)?(d=!0,{...w,id:y.id,rawId:y.rawId||y.id,extName:y.extName,icon:y.icon||w.icon,label:y.label||w.label,intent:y.intent||w.intent}):w});(f.length!==h[i].pinned.length||d)&&(h[i]={...h[i],pinned:f},h[i].active&&u[h[i].active]?(h[i].active=u[h[i].active],d=!0):h[i].active&&!f.some(w=>pinMatchesSlot(w,h[i].active))&&(h[i].active=f.length>0?f[0].id:null,d=!0),Array.isArray(h[i].history)&&(h[i].history=h[i].history.map(w=>u[w]||w)))});const p=r.windows||[],c=p.filter(i=>!i.extName||b(i.extName));c.length!==p.length&&(d=!0);let s=c.map(i=>{const f=x.find(w=>w.id===i.id||i.extName&&w.extName===i.extName&&w.rawId===i.id);return f&&i.id!==f.id?(u[i.id]=f.id,d=!0,{...i,id:f.id,rawId:f.rawId,extName:f.extName,icon:f.icon||i.icon,label:f.label||i.label}):i}),m=(r.focusHistory||[]).map(i=>i&&i.id&&u[i.id]?(d=!0,{...i,id:u[i.id]}):i);d&&(t.setState({columns:h,windows:s,focusHistory:m}),Object.keys(u).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:u},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_buildColumnTabDropdownItems(t,o,n,e,r){const d=[];o.length>0&&(d.push({sectionHeading:"Open in this column",sectionSlug:"",pinnedTop:!0,dividerAfter:!1}),o.forEach(b=>{const x=!!(n&&pinMatchesSlot(b,n.id)),p=b.actualSourceCol||t.id;d.push({id:`open:${b.id}`,label:this._formatTabLabel(b),icon:b.icon||"component",intent:b.intent||"primary",checkable:!0,checked:x,section:"Open in this column",onPointerDown:c=>{this._handlePointerDown(c,b,p,"dropdown")},onClick:()=>{this._handleSubTabClick(b.id)},trailingButton:{icon:"x",title:`Close ${b.label}`,closeMenu:!1,onClick:()=>{this._safeEvict(b.id,()=>{const c=window.Sutram?.stores?.Layout?.getState();if(!c)return;c.unpinFromColumn(p,b.id),c.evictProjection(b.id);const s=window.Sutram.stores.Layout.getState(),m=s.focusedColumn||p||"center",i=s.columns[m]?.active||"";this._updateUrlHash(m,i),this.requestUpdate()})}}})}));const u={left:"chevron-left",center:"dot",right:"chevron-right"},h={left:"Open in Left column",center:"Open in Center column",right:"Open in Right column"};return e.forEach(b=>{const x=r.filter(s=>(s.targetParent||"").toLowerCase()===(b.id||"").toLowerCase());if(x.length===0)return;const p=`Add a tab \xB7 ${b.label}`,c=b.intent||x[0]?.intent||"";d.push({sectionHeading:p,sectionSlug:b.label,sectionIcon:b.icon||"folder",sectionIntent:c}),x.forEach(s=>{let m=null;if(this._spatialState&&this._spatialState.columns){for(const i of["left","center","right"])if(this._spatialState.columns[i]?.pinned?.some(f=>pinMatchesSlot(f,s))){m=i;break}}d.push({id:`add:${s.id}`,label:s.label,icon:s.icon||"puzzle",intent:s.intent||b.intent||"primary",badgeIcon:m&&u[m]||"",badgeTitle:m?h[m]||m:"",section:p,onPointerDown:i=>{const f=window.Sutram?.stores?.Layout?.getState();let w=null;if(f&&f.columns){for(const y of["left","center","right"])if(f.columns[y]?.pinned?.some(a=>pinMatchesSlot(a,s))){w=y;break}}this._handlePointerDown(i,s,w,"dropdown")},onClick:()=>{const i=window.Sutram?.stores?.Layout?.getState();let f=null,w=null;if(i&&i.columns){for(const a of["left","center","right"])if(w=i.columns[a]?.pinned?.find(_=>pinMatchesSlot(_,s)),w){f=a;break}}const y=t.id||s.preferredColumn||"center";if(f&&(f===y||this._isColumnOnScreen(f))){this._handleSubTabClick(w?w.id:s.id);return}if(f&&i&&i.unpinFromColumn(f,w?w.id:s.id),i){i.pinToColumn(y,s),i.setActiveProjection(y,s.id),i.setFocusedColumn(y);const a={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(a[y])}this.requestUpdate(),this._updateUrlHash(y,s.id)}})})}),d}_updateUrlHash(t,o){const n=window.ExtensionRegistry||F,e=n?.executeUIHook?n.executeUIHook("sutram:resolve-route-hash",{colId:t,subId:o}):null,r=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",d=e||`#/${r}/${t}/${encodeURIComponent(o)}`;window.location.hash!==d&&window.history.replaceState(null,"",d)}_isColumnOnScreen(t){const o={left:0,center:1,right:2}[t];if(o===void 0)return!1;const{capacity:n=3,mobileViewportIndex:e=1}=this._spatialState||{},r=(this._spatialState?.layoutRatios||[1,1,1]).length,d=Math.max(0,Math.min(e,r-n));return o>=d&&o<d+n}_handleSubTabClick(t){let o=null,n=!1,e=t;if(window.Sutram?.stores?.Layout){const r=window.Sutram.stores.Layout.getState();for(const d of["left","center","right"]){const u=r.columns[d]?.pinned.find(h=>pinMatchesSlot(h,t));if(u){o=d,e=u.id;break}}if(o){n=(!r.focusedColumn||r.focusedColumn===o)&&r.columns[o].active===e,r.setActiveProjection(o,e),r.setFocusedColumn(o);const u={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(u[o])}}n&&this.refreshProjection(e),this.requestUpdate(),o&&this._updateUrlHash(o,e)}refreshProjection(t,o=null,n=!0){if(!t)return;const e=this.shadowRoot?.querySelector(`[data-sub-id="${t}"]`);if(e&&typeof e.onForceRefresh=="function")return e.onForceRefresh();n&&window.dispatchEvent(new CustomEvent("sutram:force-refresh",{detail:{parentId:o,subId:t},bubbles:!0,composed:!0}))}_isHeaderBarSurfaceEvent(t){if(!t||!t.currentTarget)return!1;const o=typeof t.composedPath=="function"?t.composedPath():[];for(const r of o){if(r===t.currentTarget)break;if(!r)continue;if(r.hasAttribute&&r.hasAttribute("popover")||r.classList&&(r.classList.contains("dropdown-menu")||r.classList.contains("tray-panel")||r.classList.contains("tray-overlay")||r.classList.contains("panel")))return!1;const d=r.tagName?r.tagName.toLowerCase():"";if(d==="sutram-modal"||d==="yenvui-modal")return!1}const n=t.currentTarget.getBoundingClientRect?.(),e=t.clientY??(t.touches&&t.touches[0]?t.touches[0].clientY:null);return!(n&&n.height>0&&e!==null&&(e<n.top-6||e>n.bottom+6))}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new Z(this,{lockAxis:"horizontal",onPanStart:()=>{this._isPanningTrack=!1},onPanMove:(o,n,e)=>{if(e!=="horizontal")return;const r=this.shadowRoot?.querySelector(".spatial-track");this._isPanningTrack||(this._isPanningTrack=!0,r&&(r.style.transition="none"),this.shadowRoot&&this.shadowRoot.querySelectorAll(".tab-menu-dropdown").forEach(c=>{c.open&&(c.open=!1)}));const d=o-this._dotDragController.startX,u=this._spatialState?.mobileViewportIndex??1,h=this._spatialState?.capacity||3,b=this._spatialState?.layoutRatios||[1,1,1],x=j(h,u,b),p=parseFloat(x.getTrackOffset());if(r){let c=d;const s=Math.max(0,b.length-h),m=j(h,s,b).getTrackOffset(),i=parseFloat(m);(p<=i&&d<0||p>=0&&d>0)&&(c=d*.2),r.style.transform=`translateX(calc(${p}% + ${c}px))`}},onPanEnd:(o,n,e)=>{if(!this._isPanningTrack)return;const r=this.shadowRoot?.querySelector(".spatial-track");if(r&&(r.style.transition=""),this._isPanningTrack=!1,e==="horizontal"){const d=o-this._dotDragController.startX,u=Math.min(110,Math.max(48,(window.innerWidth||360)*.18)),h=this._spatialState?.mobileViewportIndex??1,b=this._spatialState?.capacity||3,x=this._spatialState?.layoutRatios||[1,1,1],p=Math.max(0,x.length-b);let c=h;if(d>u?c=Math.max(0,h-1):d<-u&&(c=Math.min(p,h+1)),c!==h)this._setViewportIndex(c);else{const s=j(b,c,x);r&&(r.style.transform=`translateX(${s.getTrackOffset()})`),this.requestUpdate()}}else this.requestUpdate()}})),this._dotDragController.start(t,{lockAxis:"horizontal"})}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();o.setMobileViewport(t);const e=["left","center","right"][t];if(e){o.setFocusedColumn(e);const r=o.columns?.[e]?.active||o.columns?.[e]?.pinned?.[0]?.id||"";r&&this._updateUrlHash(e,r)}}}render(){try{this._projectionPool.beginPass();const t=(a,_=null,v=null)=>this._projectionPool.resolve(a,_,v),o=window.ExtensionRegistry||F,n=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let e=this._layoutConfig.filter(a=>a.slot==="slots:primary-navigation");const r=this._layoutConfig.filter(a=>a.slot==="slots:global"),d=this._layoutConfig.filter(a=>a.slot==="slots:sub-navigation");n&&typeof o.getExtension=="function"&&(e=e.filter(a=>{const _=a.extName?o.getExtension(a.extName):null;return _&&_.offline_mode&&_.offline_mode!=="none"?!0:d.filter(I=>(I.targetParent||"").toLowerCase()===(a.id||"").toLowerCase()).some(I=>(o.getExtension(I.extName)?.offline_mode||"none")!=="none")}));const{capacity:u,mobileViewportIndex:h,focusedColumn:b}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},x=u===1?"mobile":u===2?"tablet":"desktop",p=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],c=this._spatialState.layoutRatios||[1,1,1],s=j(u,h,c),m=Math.max(0,Math.min(h,c.length-u)),i=Math.min(p.length-1,m+u-1),f=u<c.length;if(this.dataset.viewport=x,this.variant==="popout"){const a=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",_=a?a.split("/").map(decodeURIComponent):[];let v="";_.length>=4&&_[2]==="editor"?v=_.slice(3).join("/"):_.length>=3&&(v=_.slice(2).join("/"));const I=this._spatialState?.focusedColumn||"center",g=this._spatialState?.columns?.[I];v=v||g?.active||g?.pinned?.[0]?.id;let S=d.find(A=>A.id===v||!v.includes(":")&&A.rawId===v),L=null;if(S)S.allow_popout?L=t(S.component,S.id):L=P`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <sutram-icon name="alert-triangle" size="xl" intent="warning"></sutram-icon>
                            <h3 style="margin: 8px 0 0 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${S.label||S.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(v){const A=typeof o.resolveCustomEditor=="function"?o.resolveCustomEditor(v):null,z=o?.executeUIHook?o.executeUIHook("sutram:resolve-editor-component",v):null,M=A?.component||z||"sutram-editor";L=t(M,v)}const N=P`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div class="projection-mount-slot" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${L||P`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${r.map(A=>t(A.component))}
                </div>
            `;return this._projectionPool.commitPass(),N}const y=P`
            <div class="shell-container spatial-viewport" data-viewport="${x}">
                ${f?P`
                    <div class="position-bar" @pointerdown=${a=>this._handleDotDragStart(a)}>
                        ${c.map((a,_)=>{const v=_>=m&&_<m+u,I=Math.max(0,Math.min(_,c.length-u)),g=p[_]?.id||"center",S=this._spatialState?.columns?.[g]?.pinned||[],L=this._spatialState?.columns?.[g]?.active,N=S.find(M=>pinMatchesSlot(M,L))||S[0],z=(N?d.find(M=>pinMatchesSlot(N,M)):null)?.intent||N?.intent||"primary";return P`
                                <div
                                    class="position-bar-segment ${v?"on-screen":""}"
                                    style="flex: ${Number(a)||1} 1 0%; --seg-intent: var(--intent-${z});"
                                    title="${p[_]?.label||`Column ${_+1}`}"
                                    @click=${M=>{M.stopPropagation(),!this._isPanningTrack&&(this._setViewportIndex(I),window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(g))}}>
                                </div>
                            `})}
                    </div>
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${u}" style="${this._isPanningTrack?"":`transform: translateX(${s.getTrackOffset()});`}">
                    ${p.map((a,_)=>{let v=[],I=[a.id];I.forEach(l=>{(this._spatialState.columns&&this._spatialState.columns[l]?.pinned||[]).forEach(C=>{const k=d.find(R=>pinMatchesSlot(C,R));v.push({id:k?.id||C.id,rawId:k?.rawId||C.rawId||C.id,label:k?.label||C.label||C.title||C.id,component:k?.component||C.component,extName:k?.extName||C.extName||null,targetParent:k?.targetParent||C.targetParent||l,preferredColumn:k?.preferredColumn||C.preferredColumn||l,icon:k?.icon||C.icon,intent:k?.intent||C.intent,bulkActionGroup:k?.bulkActionGroup||C.bulkActionGroup||null,bulkEntityTypes:k?.bulkEntityTypes||C.bulkEntityTypes||null,menuStores:k?.menuStores||C.menuStores||null,menuActions:k?.menuActions||C.menuActions||null,headerActionComponent:k?.headerActionComponent||C.headerActionComponent||null,actualSourceCol:l})})}),n&&typeof o.getExtension=="function"&&(v=v.filter(l=>(o.getExtension(l.extName)?.offline_mode||"none")!=="none"));let g=null;const S=this._spatialState.focusedColumn,L=this._spatialState.columns[S]?.active;if(I.includes(S)&&(g=v.find(l=>pinMatchesSlot(l,L))),!g)for(const l of I){const $=this._spatialState.columns[l]?.active;if(g=v.find(C=>pinMatchesSlot(C,$)),g)break}g||(g=v[0]);const N=_===i,A=g?.intent||"primary",z=g?this._formatTabLabel(g):"Open tab",M=this._buildColumnTabDropdownItems(a,v,g,e,d),W=this._colTabsWidths?.[a.id]||0,K=Math.max(0,W-44-6),J=v.map(l=>Math.max(44,this._formatTabLabel(l).length*7.5+42)),Y=`${W}:${v.map(l=>`${l.id}:${this._formatTabLabel(l)}`).join(",")}`;this._lastInlineClampKeys[a.id]!==Y&&(this._lastInlineClampKeys[a.id]=Y,this._inlineTabClampCounts[a.id]=null);const B=W>0?it(K,J,0,0,!1):0,O=this._inlineTabClampCounts?.[a.id],V=Math.max(g?1:0,O!=null?Math.min(B,O):B);this._lastRenderedInlineCounts[a.id]=V;let H=v.slice(0,V);g&&!H.some(l=>pinMatchesSlot(l,g.id))&&(H=[g,...v.filter(l=>!pinMatchesSlot(l,g.id))].slice(0,V),this._queueMoveTabToFront(g.actualSourceCol||a.id,g.id));const q=[];return g&&g.headerActionComponent&&q.push(t(g.headerActionComponent,g.id)),g&&this._layoutConfig.filter(l=>l.slot==="slots:sub-navigation-actions"&&(l.targetSub===g.id||l.extName===g.extName&&(l.targetSub===g.rawId||l.targetSub===`${g.extName}:${g.rawId}`))).forEach(l=>{q.push(t(l.component,g.id))}),P`
                        <div class="spatial-col ${b===a.id?"is-focused":""}" data-col-id="${a.id}" style="--col-width: ${s.getColWidth(_)}; --col-left: ${s.getColLeft(_)};" @click=${l=>{if(this._isPanningTrack){l.preventDefault(),l.stopPropagation();return}const $=g?g.id:v[0]?v[0].id:null,C=g&&g.actualSourceCol||a.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(C),$&&this._updateUrlHash(C,$)}}>
                            <!-- Unified Single Column Header Row -->
                            <div class="col-header" style="--active-sub-intent: var(--intent-${A});"
                                @sutram:column-jump=${l=>{l.preventDefault(),l.stopPropagation();const{colId:$,colIdx:C}=l.detail||{},k=Math.max(0,Math.min(Number(C)||0,c.length-u));if(this._setViewportIndex(k),$&&window.Sutram?.stores?.Layout){const R=window.Sutram.stores.Layout.getState();R.setFocusedColumn($);const E=R.columns?.[$]?.active||R.columns?.[$]?.pinned?.[0]?.id||"";E&&this._updateUrlHash($,E)}}}
                                @sutram:force-refresh=${l=>{const{subId:$,parentId:C}=l.detail||{};if(!$)return;const k=this.shadowRoot?.querySelector(`[data-sub-id="${$}"]`);if(!k||typeof k.onForceRefresh!="function")return;l.stopPropagation();const R=this.refreshProjection($,C,!1);R&&l.detail&&(l.detail.promise=R)}}
                                @pointerdown=${l=>{f&&this._isHeaderBarSurfaceEvent(l)&&this._handleDotDragStart(l)}}>
                                <!-- 1. View Menu (Always First) -->
                                <sutram-subtab-menu
                                    .columnId=${a.id}
                                    .slotConfig=${g}
                                    .extraContentNodes=${q}>
                                </sutram-subtab-menu>

                                <!-- 2. Active Tab Dropdown + 3. Fitted Inline Open Tabs -->
                                <div class="col-tabs-area" data-col-tabs="${a.id}">
                                    <sutram-dropdown
                                        class="tab-menu-dropdown"
                                        align="left"
                                        searchable
                                        ?chipRows=${!0}
                                        searchPlaceholder="Filter tabs..."
                                        .items=${M}>
                                        <button
                                            slot="trigger"
                                            type="button"
                                            class="tab-menu-trigger"
                                            data-testid="tab-menu-${a.id}"
                                            title="All tabs (${z})"
                                            aria-label="All tabs"
                                            @click=${()=>{const l=g&&g.actualSourceCol||a.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(l)}}>
                                            <sutram-icon name="${v.length?"chevron-down":"plus"}" size="sm"></sutram-icon>
                                        </button>
                                    </sutram-dropdown>

                                    ${H.map(l=>{const $=l.intent||"primary",C=l.icon||"component",k=this._formatTabLabel(l),R=!!(g&&pinMatchesSlot(l,g.id));return P`
                                            <button
                                                type="button"
                                                class="inline-tab-btn ${R?"active":""}"
                                                aria-current=${R?"page":"false"}
                                                title=${k}
                                                @pointerdown=${E=>{const D=Date.now();if(this._lastTapId===l.id&&D-(this._lastTapTime||0)<300){E.stopPropagation();const X=window.Sutram?.stores?.Layout?.getState();X&&(X.unpinFromColumn(l.actualSourceCol||a.id,l.id),X.openWindow(l,a.id,1)),this._lastTapTime=0;return}this._lastTapId=l.id,this._lastTapTime=D,this._handlePointerDown(E,l,l.actualSourceCol||a.id,"subtab")}}
                                                @dblclick=${E=>{E.stopPropagation();const D=window.Sutram?.stores?.Layout?.getState();D&&(D.unpinFromColumn(l.actualSourceCol||a.id,l.id),D.openWindow(l,a.id,1))}}
                                                @click=${E=>{E.stopPropagation(),window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(l.actualSourceCol||a.id),this._handleSubTabClick(l.id)}}>
                                                <sutram-icon name="${C}" size="sm" intent="${$}"></sutram-icon>
                                                <span class="inline-tab-label">${k}</span>
                                            </button>
                                        `})}
                                </div>

                                <!-- 4. Globals on the Last Visible Column -->
                                ${N?P`
                                    <div class="col-globals-rail" @click=${l=>l.stopPropagation()}>
                                        <slot name="header-quickpack"></slot>
                                        <slot name="header-actions-left"></slot>
                                        <slot name="gear-pinned"></slot>
                                        <slot name="header-actions"></slot>
                                    </div>
                                `:""}
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${v.map(l=>{const $=g&&pinMatchesSlot(l,g.id),C=t(l.component,l.id);return P`
                                        <div class="projection-mount-slot" style="display: ${$?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0; overflow: hidden;" data-ext="${l.extName}" data-offline-mode="${(typeof o.getExtension=="function"?o.getExtension(l.extName)?.offline_mode:null)||"none"}">
                                            ${C}
                                        </div>
                                    `})}
                                ${v.length===0?P`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${a.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(a=>{const v={left:0,center:1,right:2}[a.anchorCol||"center"]??1;let I=Math.min(a.span||1,3-v);I=Math.min(I,u);const g=s.getWinBounds(v,I,c);return P`
                            <div style="position: absolute; left: ${g.left}; width: ${g.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${a.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${a.label||a.id}
                                    .anchorCol=${a.anchorCol||"center"}
                                    .span=${I}
                                    .z=${a.z}
                                    .icon=${a.icon||"component"}
                                    .intent=${a.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(a.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(a.id)})}}
                                    @sutram-window-span=${S=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(a.id,a.anchorCol||"center",S.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(a.id)}
                                    @sutram-window-drag-start=${S=>this._handlePointerDown(S.detail.originalEvent,a,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(a.windowOnly)return;const S=window.Sutram?.stores?.Layout?.getState();if(S){const L=a.preferredColumn||"center";S.closeWindow(a.id),S.pinToColumn(L,a),S.setActiveProjection(L,a.id),S.setFocusedColumn(L),this.requestUpdate()}}}>
                            ${t(a.component,a.id,a.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${r.map(a=>t(a.component))}
            </div>
            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._projectionPool.commitPass(),y}catch(t){return console.error("[Telemetry] AppShell render error:",t),P`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><sutram-icon name="alert-triangle" size="lg"></sutram-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
