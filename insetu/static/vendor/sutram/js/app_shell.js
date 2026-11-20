import{html as P,css as Q}from"lit";import{SutramElement as tt,ExtensionRegistry as j,LayoutStore as U,StoreRegistry as et,columnCountFor as ot}from"./sutram_sdk.js";import{computeFitActionCount as it}from"./primitives.js";import{sharedStyles as nt}from"./shared_styles.js";import{debounce as G}from"./utils.js";import{SutramProjectionCompiler as at,SutramProjectionPool as st}from"./projection_engine.js";import"./drag-coordinator.js";import{physics as rt}from"sutram-chassis";const{YenvuiGestureController:Z,YenvuiViewportGuard:lt,getDeepElementFromPoint:wt}=rt,F=(T,t,i)=>{const a=Array.isArray(i)&&i.length>0?i:[1,1,1],e=T===1?a.map(()=>1):a,r=Math.max(0,Math.min(t,e.length-T)),d=e.slice(r,r+T).reduce((u,h)=>u+h,0)||1;return{getColWidth:u=>`${e[u]/d*100}%`,getColLeft:u=>`${e.slice(0,u).reduce((w,v)=>w+v,0)/d*100}%`,getTrackOffset:()=>`-${e.slice(0,r).reduce((h,w)=>h+w,0)/d*100}%`,getWinBounds:(u,h)=>{const w=Math.min(h,e.length-u),v=e.slice(0,u).reduce((c,s)=>c+s,0),p=e.slice(u,u+w).reduce((c,s)=>c+s,0);return{left:`${v/d*100}%`,width:`${p/d*100}%`}}}};export const pinMatchesSlot=(T,t)=>{if(!T||!t)return!1;const i=typeof t=="string"?t:t.id||"",a=typeof t=="object"&&t.rawId?t.rawId:i.includes("://")?i:i.includes(":")?i.split(":").slice(1).join(":"):i,e=typeof t=="object"&&t.extName?t.extName:!i.includes("://")&&i.includes(":")?i.split(":")[0]:null;if(T.id===i||T.rawId&&T.rawId===a&&(!e||!T.extName||T.extName===e)||e&&T.id===a&&(!T.extName||T.extName===e))return!0;if(T.id&&!T.id.includes("://")&&T.id.includes(":")){const[r,d]=T.id.split(":");if(d===a&&(!e||r===e))return!0}return T.id===a&&!e};export class SutramAppShell extends tt{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[nt,Q`
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
    `];constructor(){super(),this._layoutConfig=[],this._projectionPool=new st,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._colTabsWidths={left:0,center:0,right:0},this._inlineTabClampCounts={left:null,center:null,right:null},this._lastRenderedInlineCounts={left:0,center:0,right:0},this._lastInlineClampKeys={left:"",center:"",right:""}}_safeEvict(t,i){const a=window.ExtensionRegistry||j;a?.executeUIHook&&a.executeUIHook("sutram:is-projection-dirty",t)&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||i()}_activateDrag(){this._dotDragController&&this._dotDragController.abort(),this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.shadowRoot&&this.shadowRoot.querySelectorAll(".tab-menu-dropdown").forEach(t=>{t.open&&(t.open=!1)}),this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,i,a,e="subtab"){let r=null;const d=this.shadowRoot.querySelector(".spatial-track"),u=d?d.getBoundingClientRect():{top:4,height:window.innerHeight-34};if(a==="window"){const p=t.composedPath().find(c=>c.tagName&&c.tagName.toLowerCase()==="sutram-window");if(p&&p.parentElement){const c=p.parentElement.getBoundingClientRect();r={left:c.left,top:c.top,width:c.width,height:c.height}}}else if(a){const v=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${a}"]`);if(v){const p=v.getBoundingClientRect();r={left:p.left,top:p.top,width:p.width,height:p.height}}}r||(r={left:0,top:u.top,width:window.innerWidth,height:u.height});const h=t.clientX!==void 0?t.clientX:t.touches&&t.touches[0]?t.touches[0].clientX:0,w=t.clientY!==void 0?t.clientY:t.touches&&t.touches[0]?t.touches[0].clientY:0;this._dragState={active:!1,entity:i,sourceCol:a,currentZone:null,startX:h,startY:w,currentX:h,currentY:w,originType:e,sourceRect:r},this._dragController||(this._dragController=new Z(this,{longPressDelay:500,onLongPress:(v,p)=>{this._dragState&&(v!==void 0&&!isNaN(v)&&(this._dragState.currentX=v),p!==void 0&&!isNaN(p)&&(this._dragState.currentY=p)),this._activateDrag()},onPanMove:(v,p)=>{if(!this._dragState.active){const f=Math.abs(v-this._dragState.startX),o=Math.abs(p-this._dragState.startY);(f>8||o>8)&&this._activateDrag();return}this._dragState.currentX=v,this._dragState.currentY=p;let c=!1;const s=this.shadowRoot.querySelector("sutram-drag-coordinator");if(s){const f=typeof s.getHoveredZone=="function"?s.getHoveredZone(v,p):null;this._dragState.currentZone!==f&&(this._dragState.currentZone=f,c=!0),c?s.dragState={...this._dragState}:typeof s.updatePointer=="function"&&s.updatePointer(v,p)}},onPanEnd:(v,p)=>{if(this._dragState.active){const c=this._dragState.currentZone,s=this._dragState.entity,f=this._dragState.sourceCol;if(c&&window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();if(c==="close")this._safeEvict(s.id,()=>{f==="window"?o.closeWindow(s.id):f&&o.unpinFromColumn(f,s.id),o.evictProjection(s.id);const g=window.Sutram.stores.Layout.getState(),b=g.focusedColumn||f||"center",x=g.columns[b]?.active||"";this._updateUrlHash(b,x)});else if(c==="popout"){const g=f&&f!=="window"?f:o.focusedColumn||"center";o.popoutProjection(s.id,{originCol:g})}else if(c==="window"||c==="mode-window"){const g=f&&f!=="window"?f:s.anchorCol||o.focusedColumn||"center";f&&f!=="window"&&o.unpinFromColumn(f,s.id),o.openWindow(s,g,1)}else if(c==="mode-tab"&&!s?.windowOnly){const g=f&&f!=="window"?f:s.anchorCol||o.focusedColumn||"center";f==="window"&&o.closeWindow(s.id),o.columns[g]?.pinned?.some(b=>b.id===s.id)||o.pinToColumn(g,s),o.setActiveProjection(g,s.id),o.setFocusedColumn(g)}else if(c.startsWith("span-")){const g=c.split("-"),b=parseInt(g[1],10),x=g[2];f==="window"?o.updateWindowConstraints(s.id,x,b):(f&&o.unpinFromColumn(f,s.id),o.openWindow(s,x,b))}else if(c.startsWith("reorder-")){if(f){const g=parseInt(c.replace("reorder-",""),10),b=[...o.columns[f].pinned],x=b.findIndex(n=>n.id===s.id);if(x!==-1&&x!==g){const[n]=b.splice(x,1);b.splice(g,0,n),window.Sutram.stores.Layout.setState(_=>({columns:{..._.columns,[f]:{..._.columns[f],pinned:b}}}))}}}else if(["left","center","right"].includes(c)&&c!==f&&!s?.windowOnly){const g=c;f==="window"?o.closeWindow(s.id):f&&o.unpinFromColumn(f,s.id),o.pinToColumn(g,s),o.setActiveProjection(g,s.id),o.setFocusedColumn(g)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:e==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),this._tabsAreaObserver&&(this._tabsAreaObserver.disconnect(),this._tabsAreaObserver=null),[this._dragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const i=this.shadowRoot.querySelector(".spatial-track");if(i){const a=this._spatialState?.capacity||3,e=this._spatialState?.mobileViewportIndex??1,r=this._spatialState?.layoutRatios||[1,1,1],d=F(a,e,r);this._isPanningTrack||(i.style.transform=`translateX(${d.getTrackOffset()})`)}typeof ResizeObserver<"u"&&(this._tabsAreaObserver||(this._tabsAreaObserver=new ResizeObserver(a=>{let e=!1;const r={...this._colTabsWidths},d={...this._inlineTabClampCounts};a.forEach(u=>{const h=u.target?.dataset?.colTabs,w=u.contentRect?u.contentRect.width:u.target.clientWidth;h&&w>0&&Math.abs((r[h]||0)-w)>2&&(r[h]=w,d[h]=null,e=!0)}),e&&(this._colTabsWidths=r,this._inlineTabClampCounts=d,this.requestUpdate())})),this.shadowRoot.querySelectorAll(".col-tabs-area").forEach(a=>{this._tabsAreaObserver.observe(a);const e=a.dataset?.colTabs;e&&a.clientWidth>0&&!this._colTabsWidths[e]&&(this._colTabsWidths={...this._colTabsWidths,[e]:a.clientWidth})})),this._checkInlineTabsOverflow()}_checkInlineTabsOverflow(){if(!this.shadowRoot)return;let t=!1;const i={...this._inlineTabClampCounts};this.shadowRoot.querySelectorAll(".col-tabs-area").forEach(a=>{const e=a.dataset?.colTabs;if(!e||a.clientWidth<=0)return;const r=this._lastRenderedInlineCounts?.[e]||0;r>0&&a.scrollWidth>a.clientWidth+1&&(i[e]=r-1,t=!0)}),t&&(this._inlineTabClampCounts=i,this.requestUpdate())}_queueMoveTabToFront(t,i){const a=`${t}:${i}`;this._pendingFrontMove!==a&&(this._pendingFrontMove=a,queueMicrotask(()=>{this._pendingFrontMove=null;const e=window.Sutram?.stores?.Layout?.getState(),r=e?.columns?.[t]?.pinned?.find(d=>pinMatchesSlot(d,i));r&&e.movePinToFront?.(t,r.id)}))}_isProjectionDirty(t){const i=window.ExtensionRegistry||j;return!!(t&&i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",t))}_formatTabLabel(t){return t?`${t.label}${this._isProjectionDirty(t.id)?"*":""}`:""}connectedCallback(){try{if(super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),lt.install(),U){this.subscribe(U,i=>{const a=i||{};this._spatialState={capacity:a.capacity||3,focusedColumn:a.focusedColumn||"center",mobileViewportIndex:a.mobileViewportIndex??1,layoutRatios:a.layoutRatios||null,columns:a.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:a.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,i=>{const a=i.detail?.extName;a&&this._projectionPool.evictExtension(a),this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,i=>{const{oldId:a,newId:e}=i.detail||{};if(!a||!e)return;if(this._projectionPool.rekey(a,e),decodeURIComponent(window.location.hash||"").includes(a)){const d=U.getState(),u=d.focusedColumn||"center";if(this.variant==="popout"){const h=window.location.hash.replace(encodeURIComponent(a),encodeURIComponent(e)).replace(a,e);h!==window.location.hash&&window.history.replaceState(null,"",h)}else d.columns?.[u]?.active===e&&this._updateUrlHash(u,e)}this.requestUpdate()});const t=()=>{const i=window.innerWidth,a=ot(i),e=U.getState();if(e){const r=e.capacity||3,d=e.userCapacity||3,u=Math.min(d,a),h={left:0,center:1,right:2};if(r!==u&&typeof e.setCapacity=="function"&&e.setCapacity(u),(a===1||e.capacity===1)&&e.focusedColumn){const p=h[e.focusedColumn]??1;e.mobileViewportIndex!==p&&e.setMobileViewport(p)}else if(a===2&&e.focusedColumn&&r!==a){const p=h[e.focusedColumn]??1,c=Math.max(0,(e.layoutRatios||[1,1,1]).length-a),s=p===0?0:p===2?c:Math.min(e.mobileViewportIndex??0,c);e.setMobileViewport(s)}const w=Math.min(e.capacity||a,a);(e.windows||[]).forEach(p=>{let c=Math.min(p.span||1,w),s=p.anchorCol||"center";w===1?(c=1,s=e.focusedColumn||"center"):w===2&&s==="right"&&(s=c===2?"left":"center"),(c!==p.span||s!==p.anchorCol)&&e.updateWindowConstraints(p.id,s,c)})}};this._handleResize=G(t,100),window.addEventListener("resize",this._handleResize),this.registerGlobalListener("sutram:scope-transition-end",window,()=>{t()}),t()}this._debouncedCompile=G(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_compileLayout(){try{this._layoutConfig=at.getCompiledLayout();const t=window.Sutram?.stores?.Layout,i=window.ExtensionRegistry||j,a=window.Sutram?.storeRegistry||et,e=!!(a&&typeof a.isTransitioning=="function"&&a.isTransitioning()||i?.executeUIHook&&(i.executeUIHook("sutram:is-swapping-scope")||i.executeUIHook("sutram:is-swapping-workspace")));if(t&&!i.isBooting&&!e){const r=t.getState();let d=!1;const u={},h={...r.columns},w=o=>typeof i._filterPredicate=="function"?i._filterPredicate(o):!0,v=this._layoutConfig.filter(o=>o.slot==="slots:sub-navigation");["left","center","right"].forEach(o=>{if(!h[o]||!h[o].pinned)return;const g=h[o].pinned.filter(b=>!b.extName||w(b.extName)).map(b=>{const x=v.find(n=>pinMatchesSlot(b,n));return x&&(b.id!==x.id&&(u[b.id]=x.id,d=!0),x.icon!==b.icon||x.label!==b.label||x.intent!==b.intent||x.rawId!==b.rawId||b.id!==x.id)?(d=!0,{...b,id:x.id,rawId:x.rawId||x.id,extName:x.extName,icon:x.icon||b.icon,label:x.label||b.label,intent:x.intent||b.intent}):b});(g.length!==h[o].pinned.length||d)&&(h[o]={...h[o],pinned:g},h[o].active&&u[h[o].active]?(h[o].active=u[h[o].active],d=!0):h[o].active&&!g.some(b=>pinMatchesSlot(b,h[o].active))&&(h[o].active=g.length>0?g[0].id:null,d=!0),Array.isArray(h[o].history)&&(h[o].history=h[o].history.map(b=>u[b]||b)))});const p=r.windows||[],c=p.filter(o=>!o.extName||w(o.extName));c.length!==p.length&&(d=!0);let s=c.map(o=>{const g=v.find(b=>b.id===o.id||o.extName&&b.extName===o.extName&&b.rawId===o.id);return g&&o.id!==g.id?(u[o.id]=g.id,d=!0,{...o,id:g.id,rawId:g.rawId,extName:g.extName,icon:g.icon||o.icon,label:g.label||o.label}):o}),f=(r.focusHistory||[]).map(o=>o&&o.id&&u[o.id]?(d=!0,{...o,id:u[o.id]}):o);d&&(t.setState({columns:h,windows:s,focusHistory:f}),Object.keys(u).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:u},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_buildColumnTabDropdownItems(t,i,a,e,r){const d=[];i.length>0&&(d.push({sectionHeading:"Open in this column",sectionSlug:"",pinnedTop:!0,dividerAfter:!1}),i.forEach(w=>{const v=!!(a&&pinMatchesSlot(w,a.id)),p=w.actualSourceCol||t.id;d.push({id:`open:${w.id}`,label:this._formatTabLabel(w),icon:w.icon||"component",intent:w.intent||"primary",checkable:!0,checked:v,section:"Open in this column",onPointerDown:c=>{this._handlePointerDown(c,w,p,"dropdown")},onClick:()=>{this._handleSubTabClick(w.id)},trailingButton:{icon:"x",title:`Close ${w.label}`,closeMenu:!1,onClick:()=>{this._safeEvict(w.id,()=>{const c=window.Sutram?.stores?.Layout?.getState();if(!c)return;c.unpinFromColumn(p,w.id),c.evictProjection(w.id);const s=window.Sutram.stores.Layout.getState(),f=s.focusedColumn||p||"center",o=s.columns[f]?.active||"";this._updateUrlHash(f,o),this.requestUpdate()})}}})}));const u={left:"chevron-left",center:"dot",right:"chevron-right"},h={left:"Open in Left column",center:"Open in Center column",right:"Open in Right column"};return e.forEach(w=>{const v=r.filter(s=>(s.targetParent||"").toLowerCase()===(w.id||"").toLowerCase());if(v.length===0)return;const p=`Add a tab \xB7 ${w.label}`,c=w.intent||v[0]?.intent||"";d.push({sectionHeading:p,sectionSlug:w.label,sectionIcon:w.icon||"folder",sectionIntent:c}),v.forEach(s=>{let f=null;if(this._spatialState&&this._spatialState.columns){for(const o of["left","center","right"])if(this._spatialState.columns[o]?.pinned?.some(g=>pinMatchesSlot(g,s))){f=o;break}}d.push({id:`add:${s.id}`,label:s.label,icon:s.icon||"puzzle",intent:s.intent||w.intent||"primary",badgeIcon:f&&u[f]||"",badgeTitle:f?h[f]||f:"",section:p,onPointerDown:o=>{const g=window.Sutram?.stores?.Layout?.getState();let b=null;if(g&&g.columns){for(const x of["left","center","right"])if(g.columns[x]?.pinned?.some(n=>pinMatchesSlot(n,s))){b=x;break}}this._handlePointerDown(o,s,b,"dropdown")},onClick:()=>{const o=window.Sutram?.stores?.Layout?.getState();let g=null,b=null;if(o&&o.columns){for(const n of["left","center","right"])if(b=o.columns[n]?.pinned?.find(_=>pinMatchesSlot(_,s)),b){g=n;break}}if(g){this._handleSubTabClick(b?b.id:s.id);return}const x=t.id||s.preferredColumn||"center";if(o){o.pinToColumn(x,s),o.setActiveProjection(x,s.id),o.setFocusedColumn(x);const n={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(n[x])}this.requestUpdate(),this._updateUrlHash(x,s.id)}})})}),d}_updateUrlHash(t,i){const a=window.ExtensionRegistry||j,e=a?.executeUIHook?a.executeUIHook("sutram:resolve-route-hash",{colId:t,subId:i}):null,r=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",d=e||`#/${r}/${t}/${encodeURIComponent(i)}`;window.location.hash!==d&&window.history.replaceState(null,"",d)}_handleSubTabClick(t){let i=null,a=!1,e=t;if(window.Sutram?.stores?.Layout){const r=window.Sutram.stores.Layout.getState();for(const d of["left","center","right"]){const u=r.columns[d]?.pinned.find(h=>pinMatchesSlot(h,t));if(u){i=d,e=u.id;break}}if(i){a=(!r.focusedColumn||r.focusedColumn===i)&&r.columns[i].active===e,r.setActiveProjection(i,e),r.setFocusedColumn(i);const u={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(u[i])}}a&&this.refreshProjection(e),this.requestUpdate(),i&&this._updateUrlHash(i,e)}refreshProjection(t,i=null,a=!0){if(!t)return;const e=this.shadowRoot?.querySelector(`[data-sub-id="${t}"]`);if(e&&typeof e.onForceRefresh=="function")return e.onForceRefresh();a&&window.dispatchEvent(new CustomEvent("sutram:force-refresh",{detail:{parentId:i,subId:t},bubbles:!0,composed:!0}))}_isHeaderBarSurfaceEvent(t){if(!t||!t.currentTarget)return!1;const i=typeof t.composedPath=="function"?t.composedPath():[];for(const r of i){if(r===t.currentTarget)break;if(!r)continue;if(r.hasAttribute&&r.hasAttribute("popover")||r.classList&&(r.classList.contains("dropdown-menu")||r.classList.contains("tray-panel")||r.classList.contains("tray-overlay")||r.classList.contains("panel")))return!1;const d=r.tagName?r.tagName.toLowerCase():"";if(d==="sutram-modal"||d==="yenvui-modal")return!1}const a=t.currentTarget.getBoundingClientRect?.(),e=t.clientY??(t.touches&&t.touches[0]?t.touches[0].clientY:null);return!(a&&a.height>0&&e!==null&&(e<a.top-6||e>a.bottom+6))}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new Z(this,{lockAxis:"horizontal",onPanStart:()=>{this._isPanningTrack=!1},onPanMove:(i,a,e)=>{if(e!=="horizontal")return;const r=this.shadowRoot?.querySelector(".spatial-track");this._isPanningTrack||(this._isPanningTrack=!0,r&&(r.style.transition="none"),this.shadowRoot&&this.shadowRoot.querySelectorAll(".tab-menu-dropdown").forEach(c=>{c.open&&(c.open=!1)}));const d=i-this._dotDragController.startX,u=this._spatialState?.mobileViewportIndex??1,h=this._spatialState?.capacity||3,w=this._spatialState?.layoutRatios||[1,1,1],v=F(h,u,w),p=parseFloat(v.getTrackOffset());if(r){let c=d;const s=Math.max(0,w.length-h),f=F(h,s,w).getTrackOffset(),o=parseFloat(f);(p<=o&&d<0||p>=0&&d>0)&&(c=d*.2),r.style.transform=`translateX(calc(${p}% + ${c}px))`}},onPanEnd:(i,a,e)=>{if(!this._isPanningTrack)return;const r=this.shadowRoot?.querySelector(".spatial-track");if(r&&(r.style.transition=""),this._isPanningTrack=!1,e==="horizontal"){const d=i-this._dotDragController.startX,u=Math.min(110,Math.max(48,(window.innerWidth||360)*.18)),h=this._spatialState?.mobileViewportIndex??1,w=this._spatialState?.capacity||3,v=this._spatialState?.layoutRatios||[1,1,1],p=Math.max(0,v.length-w);let c=h;if(d>u?c=Math.max(0,h-1):d<-u&&(c=Math.min(p,h+1)),c!==h)this._setViewportIndex(c);else{const s=F(w,c,v);r&&(r.style.transform=`translateX(${s.getTrackOffset()})`),this.requestUpdate()}}else this.requestUpdate()}})),this._dotDragController.start(t,{lockAxis:"horizontal"})}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const i=window.Sutram.stores.Layout.getState();i.setMobileViewport(t);const e=["left","center","right"][t];if(e){i.setFocusedColumn(e);const r=i.columns?.[e]?.active||i.columns?.[e]?.pinned?.[0]?.id||"";r&&this._updateUrlHash(e,r)}}}render(){try{this._projectionPool.beginPass();const t=(n,_=null,y=null)=>this._projectionPool.resolve(n,_,y),i=window.ExtensionRegistry||j,a=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let e=this._layoutConfig.filter(n=>n.slot==="slots:primary-navigation");const r=this._layoutConfig.filter(n=>n.slot==="slots:global"),d=this._layoutConfig.filter(n=>n.slot==="slots:sub-navigation");a&&typeof i.getExtension=="function"&&(e=e.filter(n=>{const _=n.extName?i.getExtension(n.extName):null;return _&&_.offline_mode&&_.offline_mode!=="none"?!0:d.filter(I=>(I.targetParent||"").toLowerCase()===(n.id||"").toLowerCase()).some(I=>(i.getExtension(I.extName)?.offline_mode||"none")!=="none")}));const{capacity:u,mobileViewportIndex:h,focusedColumn:w}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},v=u===1?"mobile":u===2?"tablet":"desktop",p=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],c=this._spatialState.layoutRatios||[1,1,1],s=F(u,h,c),f=Math.max(0,Math.min(h,c.length-u)),o=Math.min(p.length-1,f+u-1),g=u<c.length;if(this.dataset.viewport=v,this.variant==="popout"){const n=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",_=n?n.split("/").map(decodeURIComponent):[];let y="";_.length>=4&&_[2]==="editor"?y=_.slice(3).join("/"):_.length>=3&&(y=_.slice(2).join("/"));const I=this._spatialState?.focusedColumn||"center",m=this._spatialState?.columns?.[I];y=y||m?.active||m?.pinned?.[0]?.id;let S=d.find(R=>R.id===y||!y.includes(":")&&R.rawId===y),L=null;if(S)S.allow_popout?L=t(S.component,S.id):L=P`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <sutram-icon name="alert-triangle" size="xl" intent="warning"></sutram-icon>
                            <h3 style="margin: 8px 0 0 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${S.label||S.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(y){const R=typeof i.resolveCustomEditor=="function"?i.resolveCustomEditor(y):null,z=i?.executeUIHook?i.executeUIHook("sutram:resolve-editor-component",y):null,E=R?.component||z||"sutram-editor";L=t(E,y)}const N=P`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div class="projection-mount-slot" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${L||P`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${r.map(R=>t(R.component))}
                </div>
            `;return this._projectionPool.commitPass(),N}const x=P`
            <div class="shell-container spatial-viewport" data-viewport="${v}">
                ${g?P`
                    <div class="position-bar" @pointerdown=${n=>this._handleDotDragStart(n)}>
                        ${c.map((n,_)=>{const y=_>=f&&_<f+u,I=Math.max(0,Math.min(_,c.length-u)),m=p[_]?.id||"center",S=this._spatialState?.columns?.[m]?.pinned||[],L=this._spatialState?.columns?.[m]?.active,N=S.find(E=>pinMatchesSlot(E,L))||S[0],z=(N?d.find(E=>pinMatchesSlot(N,E)):null)?.intent||N?.intent||"primary";return P`
                                <div
                                    class="position-bar-segment ${y?"on-screen":""}"
                                    style="flex: ${Number(n)||1} 1 0%; --seg-intent: var(--intent-${z});"
                                    title="${p[_]?.label||`Column ${_+1}`}"
                                    @click=${E=>{E.stopPropagation(),!this._isPanningTrack&&(this._setViewportIndex(I),window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(m))}}>
                                </div>
                            `})}
                    </div>
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${u}" style="${this._isPanningTrack?"":`transform: translateX(${s.getTrackOffset()});`}">
                    ${p.map((n,_)=>{let y=[],I=[n.id];I.forEach(l=>{(this._spatialState.columns&&this._spatialState.columns[l]?.pinned||[]).forEach(C=>{const k=d.find(A=>pinMatchesSlot(C,A));y.push({id:k?.id||C.id,rawId:k?.rawId||C.rawId||C.id,label:k?.label||C.label||C.title||C.id,component:k?.component||C.component,extName:k?.extName||C.extName||null,targetParent:k?.targetParent||C.targetParent||l,preferredColumn:k?.preferredColumn||C.preferredColumn||l,icon:k?.icon||C.icon,intent:k?.intent||C.intent,bulkActionGroup:k?.bulkActionGroup||C.bulkActionGroup||null,bulkEntityTypes:k?.bulkEntityTypes||C.bulkEntityTypes||null,menuStores:k?.menuStores||C.menuStores||null,menuActions:k?.menuActions||C.menuActions||null,headerActionComponent:k?.headerActionComponent||C.headerActionComponent||null,actualSourceCol:l})})}),a&&typeof i.getExtension=="function"&&(y=y.filter(l=>(i.getExtension(l.extName)?.offline_mode||"none")!=="none"));let m=null;const S=this._spatialState.focusedColumn,L=this._spatialState.columns[S]?.active;if(I.includes(S)&&(m=y.find(l=>pinMatchesSlot(l,L))),!m)for(const l of I){const $=this._spatialState.columns[l]?.active;if(m=y.find(C=>pinMatchesSlot(C,$)),m)break}m||(m=y[0]);const N=_===o,R=m?.intent||"primary",z=m?this._formatTabLabel(m):"Open tab",E=this._buildColumnTabDropdownItems(n,y,m,e,d),W=this._colTabsWidths?.[n.id]||0,K=Math.max(0,W-44-6),J=y.map(l=>Math.max(44,this._formatTabLabel(l).length*7.5+42)),Y=`${W}:${y.map(l=>`${l.id}:${this._formatTabLabel(l)}`).join(",")}`;this._lastInlineClampKeys[n.id]!==Y&&(this._lastInlineClampKeys[n.id]=Y,this._inlineTabClampCounts[n.id]=null);const B=W>0?it(K,J,0,0,!1):0,O=this._inlineTabClampCounts?.[n.id],H=Math.max(m?1:0,O!=null?Math.min(B,O):B);this._lastRenderedInlineCounts[n.id]=H;let V=y.slice(0,H);m&&!V.some(l=>pinMatchesSlot(l,m.id))&&(V=[m,...y.filter(l=>!pinMatchesSlot(l,m.id))].slice(0,H),this._queueMoveTabToFront(m.actualSourceCol||n.id,m.id));const q=[];return m&&m.headerActionComponent&&q.push(t(m.headerActionComponent,m.id)),m&&this._layoutConfig.filter(l=>l.slot==="slots:sub-navigation-actions"&&(l.targetSub===m.id||l.extName===m.extName&&(l.targetSub===m.rawId||l.targetSub===`${m.extName}:${m.rawId}`))).forEach(l=>{q.push(t(l.component,m.id))}),P`
                        <div class="spatial-col ${w===n.id?"is-focused":""}" data-col-id="${n.id}" style="--col-width: ${s.getColWidth(_)}; --col-left: ${s.getColLeft(_)};" @click=${l=>{if(this._isPanningTrack){l.preventDefault(),l.stopPropagation();return}const $=m?m.id:y[0]?y[0].id:null,C=m&&m.actualSourceCol||n.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(C),$&&this._updateUrlHash(C,$)}}>
                            <!-- Unified Single Column Header Row -->
                            <div class="col-header" style="--active-sub-intent: var(--intent-${R});"
                                @sutram:column-jump=${l=>{l.preventDefault(),l.stopPropagation();const{colId:$,colIdx:C}=l.detail||{},k=Math.max(0,Math.min(Number(C)||0,c.length-u));if(this._setViewportIndex(k),$&&window.Sutram?.stores?.Layout){const A=window.Sutram.stores.Layout.getState();A.setFocusedColumn($);const M=A.columns?.[$]?.active||A.columns?.[$]?.pinned?.[0]?.id||"";M&&this._updateUrlHash($,M)}}}
                                @sutram:force-refresh=${l=>{const{subId:$,parentId:C}=l.detail||{};if(!$)return;const k=this.shadowRoot?.querySelector(`[data-sub-id="${$}"]`);if(!k||typeof k.onForceRefresh!="function")return;l.stopPropagation();const A=this.refreshProjection($,C,!1);A&&l.detail&&(l.detail.promise=A)}}
                                @pointerdown=${l=>{g&&this._isHeaderBarSurfaceEvent(l)&&this._handleDotDragStart(l)}}>
                                <!-- 1. View Menu (Always First) -->
                                <sutram-subtab-menu
                                    .columnId=${n.id}
                                    .slotConfig=${m}
                                    .extraContentNodes=${q}>
                                </sutram-subtab-menu>

                                <!-- 2. Active Tab Dropdown + 3. Fitted Inline Open Tabs -->
                                <div class="col-tabs-area" data-col-tabs="${n.id}">
                                    <sutram-dropdown
                                        class="tab-menu-dropdown"
                                        align="left"
                                        searchable
                                        ?chipRows=${!0}
                                        searchPlaceholder="Filter tabs..."
                                        .items=${E}>
                                        <button
                                            slot="trigger"
                                            type="button"
                                            class="tab-menu-trigger"
                                            title="All tabs (${z})"
                                            aria-label="All tabs"
                                            @click=${()=>{const l=m&&m.actualSourceCol||n.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(l)}}>
                                            <sutram-icon name="${y.length?"chevron-down":"plus"}" size="sm"></sutram-icon>
                                        </button>
                                    </sutram-dropdown>

                                    ${V.map(l=>{const $=l.intent||"primary",C=l.icon||"component",k=this._formatTabLabel(l),A=!!(m&&pinMatchesSlot(l,m.id));return P`
                                            <button
                                                type="button"
                                                class="inline-tab-btn ${A?"active":""}"
                                                aria-current=${A?"page":"false"}
                                                title=${k}
                                                @pointerdown=${M=>{const D=Date.now();if(this._lastTapId===l.id&&D-(this._lastTapTime||0)<300){M.stopPropagation();const X=window.Sutram?.stores?.Layout?.getState();X&&(X.unpinFromColumn(l.actualSourceCol||n.id,l.id),X.openWindow(l,n.id,1)),this._lastTapTime=0;return}this._lastTapId=l.id,this._lastTapTime=D,this._handlePointerDown(M,l,l.actualSourceCol||n.id,"subtab")}}
                                                @dblclick=${M=>{M.stopPropagation();const D=window.Sutram?.stores?.Layout?.getState();D&&(D.unpinFromColumn(l.actualSourceCol||n.id,l.id),D.openWindow(l,n.id,1))}}
                                                @click=${M=>{M.stopPropagation(),window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(l.actualSourceCol||n.id),this._handleSubTabClick(l.id)}}>
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
                                ${y.map(l=>{const $=m&&pinMatchesSlot(l,m.id),C=t(l.component,l.id);return P`
                                        <div class="projection-mount-slot" style="display: ${$?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0; overflow: hidden;" data-ext="${l.extName}" data-offline-mode="${(typeof i.getExtension=="function"?i.getExtension(l.extName)?.offline_mode:null)||"none"}">
                                            ${C}
                                        </div>
                                    `})}
                                ${y.length===0?P`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${n.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(n=>{const y={left:0,center:1,right:2}[n.anchorCol||"center"]??1;let I=Math.min(n.span||1,3-y);I=Math.min(I,u);const m=s.getWinBounds(y,I,c);return P`
                            <div style="position: absolute; left: ${m.left}; width: ${m.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${n.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${n.label||n.id}
                                    .anchorCol=${n.anchorCol||"center"}
                                    .span=${I}
                                    .z=${n.z}
                                    .icon=${n.icon||"component"}
                                    .intent=${n.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(n.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(n.id)})}}
                                    @sutram-window-span=${S=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(n.id,n.anchorCol||"center",S.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(n.id)}
                                    @sutram-window-drag-start=${S=>this._handlePointerDown(S.detail.originalEvent,n,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(n.windowOnly)return;const S=window.Sutram?.stores?.Layout?.getState();if(S){const L=n.preferredColumn||"center";S.closeWindow(n.id),S.pinToColumn(L,n),S.setActiveProjection(L,n.id),S.setFocusedColumn(L),this.requestUpdate()}}}>
                            ${t(n.component,n.id,n.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${r.map(n=>t(n.component))}
            </div>
            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._projectionPool.commitPass(),x}catch(t){return console.error("[Telemetry] AppShell render error:",t),P`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><sutram-icon name="alert-triangle" size="lg"></sutram-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
