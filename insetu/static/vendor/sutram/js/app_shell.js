import{html as L,css as et}from"lit";import{SutramElement as ot,ExtensionRegistry as z,LayoutStore as j,StoreRegistry as it,SUTRAM_COLUMN_UNIT_PX as nt}from"./sutram_sdk.js";import{computeFitActionCount as at}from"./primitives.js";import{sharedStyles as st}from"./shared_styles.js";import{debounce as B}from"./utils.js";import{SutramProjectionCompiler as rt,SutramProjectionPool as lt}from"./projection_engine.js";import"./drag-coordinator.js";import{physics as ct}from"sutram-chassis";const{YenvuiGestureController:G,YenvuiViewportGuard:dt,getDeepElementFromPoint:vt}=ct,U=(I,t,n)=>{const a=Array.isArray(n)&&n.length>0?n:[1,1,1],e=I===1?a.map(()=>1):a,l=Math.max(0,Math.min(t,e.length-I)),d=e.slice(l,l+I).reduce((u,h)=>u+h,0)||1;return{getColWidth:u=>`${e[u]/d*100}%`,getColLeft:u=>`${e.slice(0,u).reduce((g,v)=>g+v,0)/d*100}%`,getTrackOffset:()=>`-${e.slice(0,l).reduce((h,g)=>h+g,0)/d*100}%`,getWinBounds:(u,h)=>{const g=Math.min(h,e.length-u),v=e.slice(0,u).reduce((c,s)=>c+s,0),p=e.slice(u,u+g).reduce((c,s)=>c+s,0);return{left:`${v/d*100}%`,width:`${p/d*100}%`}}}};export const pinMatchesSlot=(I,t)=>{if(!I||!t)return!1;const n=typeof t=="string"?t:t.id||"",a=typeof t=="object"&&t.rawId?t.rawId:n.includes("://")?n:n.includes(":")?n.split(":").slice(1).join(":"):n,e=typeof t=="object"&&t.extName?t.extName:!n.includes("://")&&n.includes(":")?n.split(":")[0]:null;if(I.id===n||I.rawId&&I.rawId===a&&(!e||!I.extName||I.extName===e)||e&&I.id===a&&(!I.extName||I.extName===e))return!0;if(I.id&&!I.id.includes("://")&&I.id.includes(":")){const[l,d]=I.id.split(":");if(d===a&&(!e||l===e))return!0}return I.id===a&&!e};export class SutramAppShell extends ot{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[st,et`
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
        .active-tab-dropdown {
            display: inline-flex;
            align-items: stretch;
            height: 100%;
            min-width: 44px;
            max-width: 100%;
            flex: 0 1 auto;
            overflow: hidden;
        }
        .active-tab-trigger {
            touch-action: none;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 100%;
            min-height: 44px;
            min-width: 44px;
            max-width: 100%;
            padding: 0 12px;
            margin: 0;
            border: none;
            border-bottom: 2px solid var(--active-sub-intent, var(--intent-primary));
            border-radius: 0;
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 18%, transparent);
            color: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 28%, var(--text));
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            box-sizing: border-box;
            overflow: hidden;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .active-tab-trigger:hover {
            background: color-mix(in srgb, var(--active-sub-intent, var(--intent-primary)) 28%, var(--bg-hover));
        }
        :host-context([data-theme="e-ink"]) .active-tab-trigger {
            background: transparent;
            color: var(--text);
        }
        .active-tab-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
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
        .active-tab-trigger sutram-icon,
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
    `];constructor(){super(),this._layoutConfig=[],this._projectionPool=new lt,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._colTabsWidths={left:0,center:0,right:0},this._inlineTabClampCounts={left:null,center:null,right:null},this._lastRenderedInlineCounts={left:0,center:0,right:0},this._lastInlineClampKeys={left:"",center:"",right:""}}_safeEvict(t,n){const a=window.ExtensionRegistry||z;a?.executeUIHook&&a.executeUIHook("sutram:is-projection-dirty",t)&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||n()}_activateDrag(){this._dotDragController&&this._dotDragController.abort(),this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.shadowRoot&&this.shadowRoot.querySelectorAll(".active-tab-dropdown").forEach(t=>{t.open&&(t.open=!1)}),this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,n,a,e="subtab"){let l=null;const d=this.shadowRoot.querySelector(".spatial-track"),u=d?d.getBoundingClientRect():{top:4,height:window.innerHeight-34};if(a==="window"){const p=t.composedPath().find(c=>c.tagName&&c.tagName.toLowerCase()==="sutram-window");if(p&&p.parentElement){const c=p.parentElement.getBoundingClientRect();l={left:c.left,top:c.top,width:c.width,height:c.height}}}else if(a){const v=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${a}"]`);if(v){const p=v.getBoundingClientRect();l={left:p.left,top:p.top,width:p.width,height:p.height}}}l||(l={left:0,top:u.top,width:window.innerWidth,height:u.height});const h=t.clientX!==void 0?t.clientX:t.touches&&t.touches[0]?t.touches[0].clientX:0,g=t.clientY!==void 0?t.clientY:t.touches&&t.touches[0]?t.touches[0].clientY:0;this._dragState={active:!1,entity:n,sourceCol:a,currentZone:null,startX:h,startY:g,currentX:h,currentY:g,originType:e,sourceRect:l},this._dragController||(this._dragController=new G(this,{longPressDelay:500,onLongPress:(v,p)=>{this._dragState&&(v!==void 0&&!isNaN(v)&&(this._dragState.currentX=v),p!==void 0&&!isNaN(p)&&(this._dragState.currentY=p)),this._activateDrag()},onPanMove:(v,p)=>{if(!this._dragState.active){const f=Math.abs(v-this._dragState.startX),o=Math.abs(p-this._dragState.startY);(f>8||o>8)&&this._activateDrag();return}this._dragState.currentX=v,this._dragState.currentY=p;let c=!1;const s=this.shadowRoot.querySelector("sutram-drag-coordinator");if(s){const f=typeof s.getHoveredZone=="function"?s.getHoveredZone(v,p):null;this._dragState.currentZone!==f&&(this._dragState.currentZone=f,c=!0),c?s.dragState={...this._dragState}:typeof s.updatePointer=="function"&&s.updatePointer(v,p)}},onPanEnd:(v,p)=>{if(this._dragState.active){const c=this._dragState.currentZone,s=this._dragState.entity,f=this._dragState.sourceCol;if(c&&window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();if(c==="close")this._safeEvict(s.id,()=>{f==="window"?o.closeWindow(s.id):f&&o.unpinFromColumn(f,s.id),o.evictProjection(s.id);const m=window.Sutram.stores.Layout.getState(),b=m.focusedColumn||f||"center",y=m.columns[b]?.active||"";this._updateUrlHash(b,y)});else if(c==="popout"){const m=f&&f!=="window"?f:o.focusedColumn||"center";o.popoutProjection(s.id,{originCol:m})}else if(c==="window"||c==="mode-window"){const m=f&&f!=="window"?f:s.anchorCol||o.focusedColumn||"center";f&&f!=="window"&&o.unpinFromColumn(f,s.id),o.openWindow(s,m,1)}else if(c==="mode-tab"&&!s?.windowOnly){const m=f&&f!=="window"?f:s.anchorCol||o.focusedColumn||"center";f==="window"&&o.closeWindow(s.id),o.columns[m]?.pinned?.some(b=>b.id===s.id)||o.pinToColumn(m,s),o.setActiveProjection(m,s.id),o.setFocusedColumn(m)}else if(c.startsWith("span-")){const m=c.split("-"),b=parseInt(m[1],10),y=m[2];f==="window"?o.updateWindowConstraints(s.id,y,b):(f&&o.unpinFromColumn(f,s.id),o.openWindow(s,y,b))}else if(c.startsWith("reorder-")){if(f){const m=parseInt(c.replace("reorder-",""),10),b=[...o.columns[f].pinned],y=b.findIndex(i=>i.id===s.id);if(y!==-1&&y!==m){const[i]=b.splice(y,1);b.splice(m,0,i),window.Sutram.stores.Layout.setState(_=>({columns:{..._.columns,[f]:{..._.columns[f],pinned:b}}}))}}}else if(["left","center","right"].includes(c)&&c!==f&&!s?.windowOnly){const m=c;f==="window"?o.closeWindow(s.id):f&&o.unpinFromColumn(f,s.id),o.pinToColumn(m,s),o.setActiveProjection(m,s.id),o.setFocusedColumn(m)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:e==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),this._tabsAreaObserver&&(this._tabsAreaObserver.disconnect(),this._tabsAreaObserver=null),[this._dragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const n=this.shadowRoot.querySelector(".spatial-track");if(n){const a=this._spatialState?.capacity||3,e=this._spatialState?.mobileViewportIndex??1,l=this._spatialState?.layoutRatios||[1,1,1],d=U(a,e,l);this._isPanningTrack||(n.style.transform=`translateX(${d.getTrackOffset()})`)}typeof ResizeObserver<"u"&&(this._tabsAreaObserver||(this._tabsAreaObserver=new ResizeObserver(a=>{let e=!1;const l={...this._colTabsWidths},d={...this._inlineTabClampCounts};a.forEach(u=>{const h=u.target?.dataset?.colTabs,g=u.contentRect?u.contentRect.width:u.target.clientWidth;h&&g>0&&Math.abs((l[h]||0)-g)>2&&(l[h]=g,d[h]=null,e=!0)}),e&&(this._colTabsWidths=l,this._inlineTabClampCounts=d,this.requestUpdate())})),this.shadowRoot.querySelectorAll(".col-tabs-area").forEach(a=>{this._tabsAreaObserver.observe(a);const e=a.dataset?.colTabs;e&&a.clientWidth>0&&!this._colTabsWidths[e]&&(this._colTabsWidths={...this._colTabsWidths,[e]:a.clientWidth})})),this._checkInlineTabsOverflow()}_checkInlineTabsOverflow(){if(!this.shadowRoot)return;let t=!1;const n={...this._inlineTabClampCounts};this.shadowRoot.querySelectorAll(".col-tabs-area").forEach(a=>{const e=a.dataset?.colTabs;if(!e||a.clientWidth<=0)return;const l=this._lastRenderedInlineCounts?.[e]||0;l>0&&a.scrollWidth>a.clientWidth+1&&(n[e]=l-1,t=!0)}),t&&(this._inlineTabClampCounts=n,this.requestUpdate())}_isProjectionDirty(t){const n=window.ExtensionRegistry||z;return!!(t&&n?.executeUIHook&&n.executeUIHook("sutram:is-projection-dirty",t))}_formatTabLabel(t){return t?`${t.label}${this._isProjectionDirty(t.id)?"*":""}`:""}connectedCallback(){try{if(super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),dt.install(),j){this.subscribe(j,n=>{const a=n||{};this._spatialState={capacity:a.capacity||3,focusedColumn:a.focusedColumn||"center",mobileViewportIndex:a.mobileViewportIndex??1,layoutRatios:a.layoutRatios||null,columns:a.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:a.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,n=>{const a=n.detail?.extName;a&&this._projectionPool.evictExtension(a),this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,n=>{const{oldId:a,newId:e}=n.detail||{};if(!a||!e)return;if(this._projectionPool.rekey(a,e),decodeURIComponent(window.location.hash||"").includes(a)){const d=j.getState(),u=d.focusedColumn||"center";if(this.variant==="popout"){const h=window.location.hash.replace(encodeURIComponent(a),encodeURIComponent(e)).replace(a,e);h!==window.location.hash&&window.history.replaceState(null,"",h)}else d.columns?.[u]?.active===e&&this._updateUrlHash(u,e)}this.requestUpdate()});const t=()=>{const n=window.innerWidth,a=Math.min(3,Math.max(1,Math.floor(n/nt))),e=j.getState();if(e){const l=e.capacity||3,d=e.userCapacity||3,u=Math.min(d,a),h={left:0,center:1,right:2};if(l!==u&&typeof e.setCapacity=="function"&&e.setCapacity(u),(a===1||e.capacity===1)&&e.focusedColumn){const p=h[e.focusedColumn]??1;e.mobileViewportIndex!==p&&e.setMobileViewport(p)}else if(a===2&&e.focusedColumn&&l!==a){const p=h[e.focusedColumn]??1,c=Math.max(0,(e.layoutRatios||[1,1,1]).length-a),s=p===0?0:p===2?c:Math.min(e.mobileViewportIndex??0,c);e.setMobileViewport(s)}const g=Math.min(e.capacity||a,a);(e.windows||[]).forEach(p=>{let c=Math.min(p.span||1,g),s=p.anchorCol||"center";g===1?(c=1,s=e.focusedColumn||"center"):g===2&&s==="right"&&(s=c===2?"left":"center"),(c!==p.span||s!==p.anchorCol)&&e.updateWindowConstraints(p.id,s,c)})}};this._handleResize=B(t,100),window.addEventListener("resize",this._handleResize),this.registerGlobalListener("sutram:scope-transition-end",window,()=>{t()}),t()}this._debouncedCompile=B(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_compileLayout(){try{this._layoutConfig=rt.getCompiledLayout();const t=window.Sutram?.stores?.Layout,n=window.ExtensionRegistry||z,a=window.Sutram?.storeRegistry||it,e=!!(a&&typeof a.isTransitioning=="function"&&a.isTransitioning()||n?.executeUIHook&&(n.executeUIHook("sutram:is-swapping-scope")||n.executeUIHook("sutram:is-swapping-workspace")));if(t&&!n.isBooting&&!e){const l=t.getState();let d=!1;const u={},h={...l.columns},g=o=>typeof n._filterPredicate=="function"?n._filterPredicate(o):!0,v=this._layoutConfig.filter(o=>o.slot==="slots:sub-navigation");["left","center","right"].forEach(o=>{if(!h[o]||!h[o].pinned)return;const m=h[o].pinned.filter(b=>!b.extName||g(b.extName)).map(b=>{const y=v.find(i=>pinMatchesSlot(b,i));return y&&(b.id!==y.id&&(u[b.id]=y.id,d=!0),y.icon!==b.icon||y.label!==b.label||y.intent!==b.intent||y.rawId!==b.rawId||b.id!==y.id)?(d=!0,{...b,id:y.id,rawId:y.rawId||y.id,extName:y.extName,icon:y.icon||b.icon,label:y.label||b.label,intent:y.intent||b.intent}):b});(m.length!==h[o].pinned.length||d)&&(h[o]={...h[o],pinned:m},h[o].active&&u[h[o].active]?(h[o].active=u[h[o].active],d=!0):h[o].active&&!m.some(b=>pinMatchesSlot(b,h[o].active))&&(h[o].active=m.length>0?m[0].id:null,d=!0),Array.isArray(h[o].history)&&(h[o].history=h[o].history.map(b=>u[b]||b)))});const p=l.windows||[],c=p.filter(o=>!o.extName||g(o.extName));c.length!==p.length&&(d=!0);let s=c.map(o=>{const m=v.find(b=>b.id===o.id||o.extName&&b.extName===o.extName&&b.rawId===o.id);return m&&o.id!==m.id?(u[o.id]=m.id,d=!0,{...o,id:m.id,rawId:m.rawId,extName:m.extName,icon:m.icon||o.icon,label:m.label||o.label}):o}),f=(l.focusHistory||[]).map(o=>o&&o.id&&u[o.id]?(d=!0,{...o,id:u[o.id]}):o);d&&(t.setState({columns:h,windows:s,focusHistory:f}),Object.keys(u).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:u},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_buildColumnTabDropdownItems(t,n,a,e,l){const d=[];n.length>0&&(d.push({sectionHeading:"Open in this column",sectionSlug:"",pinnedTop:!0,dividerAfter:!1}),n.forEach(g=>{const v=!!(a&&pinMatchesSlot(g,a.id)),p=g.actualSourceCol||t.id;d.push({id:`open:${g.id}`,label:this._formatTabLabel(g),icon:g.icon||"component",intent:g.intent||"primary",checkable:!0,checked:v,section:"Open in this column",onPointerDown:c=>{this._handlePointerDown(c,g,p,"dropdown")},onClick:()=>{this._handleSubTabClick(g.id)},trailingButton:{icon:"x",title:`Close ${g.label}`,closeMenu:!1,onClick:()=>{this._safeEvict(g.id,()=>{const c=window.Sutram?.stores?.Layout?.getState();if(!c)return;c.unpinFromColumn(p,g.id),c.evictProjection(g.id);const s=window.Sutram.stores.Layout.getState(),f=s.focusedColumn||p||"center",o=s.columns[f]?.active||"";this._updateUrlHash(f,o),this.requestUpdate()})}}})}));const u={left:"chevron-left",center:"dot",right:"chevron-right"},h={left:"Open in Left column",center:"Open in Center column",right:"Open in Right column"};return e.forEach(g=>{const v=l.filter(s=>(s.targetParent||"").toLowerCase()===(g.id||"").toLowerCase());if(v.length===0)return;const p=`Add a tab \xB7 ${g.label}`,c=g.intent||v[0]?.intent||"";d.push({sectionHeading:p,sectionSlug:g.label,sectionIcon:g.icon||"folder",sectionIntent:c}),v.forEach(s=>{let f=null;if(this._spatialState&&this._spatialState.columns){for(const o of["left","center","right"])if(this._spatialState.columns[o]?.pinned?.some(m=>pinMatchesSlot(m,s))){f=o;break}}d.push({id:`add:${s.id}`,label:s.label,icon:s.icon||"puzzle",intent:s.intent||g.intent||"primary",badgeIcon:f&&u[f]||"",badgeTitle:f?h[f]||f:"",section:p,onPointerDown:o=>{const m=window.Sutram?.stores?.Layout?.getState();let b=null;if(m&&m.columns){for(const y of["left","center","right"])if(m.columns[y]?.pinned?.some(i=>pinMatchesSlot(i,s))){b=y;break}}this._handlePointerDown(o,s,b,"dropdown")},onClick:()=>{const o=window.Sutram?.stores?.Layout?.getState();let m=null,b=null;if(o&&o.columns){for(const i of["left","center","right"])if(b=o.columns[i]?.pinned?.find(_=>pinMatchesSlot(_,s)),b){m=i;break}}if(m){this._handleSubTabClick(b?b.id:s.id);return}const y=t.id||s.preferredColumn||"center";if(o){o.pinToColumn(y,s),o.setActiveProjection(y,s.id),o.setFocusedColumn(y);const i={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(i[y])}this.requestUpdate(),this._updateUrlHash(y,s.id)}})})}),d}_updateUrlHash(t,n){const a=window.ExtensionRegistry||z,e=a?.executeUIHook?a.executeUIHook("sutram:resolve-route-hash",{colId:t,subId:n}):null,l=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",d=e||`#/${l}/${t}/${encodeURIComponent(n)}`;window.location.hash!==d&&window.history.replaceState(null,"",d)}_handleSubTabClick(t){let n=null,a=!1,e=t;if(window.Sutram?.stores?.Layout){const l=window.Sutram.stores.Layout.getState();for(const d of["left","center","right"]){const u=l.columns[d]?.pinned.find(h=>pinMatchesSlot(h,t));if(u){n=d,e=u.id;break}}if(n){a=(!l.focusedColumn||l.focusedColumn===n)&&l.columns[n].active===e,l.setActiveProjection(n,e),l.setFocusedColumn(n);const u={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(u[n])}}a&&this.refreshProjection(e),this.requestUpdate(),n&&this._updateUrlHash(n,e)}refreshProjection(t,n=null,a=!0){if(!t)return;const e=this.shadowRoot?.querySelector(`[data-sub-id="${t}"]`);if(e&&typeof e.onForceRefresh=="function")return e.onForceRefresh();a&&window.dispatchEvent(new CustomEvent("sutram:force-refresh",{detail:{parentId:n,subId:t},bubbles:!0,composed:!0}))}_isHeaderBarSurfaceEvent(t){if(!t||!t.currentTarget)return!1;const n=typeof t.composedPath=="function"?t.composedPath():[];for(const l of n){if(l===t.currentTarget)break;if(!l)continue;if(l.hasAttribute&&l.hasAttribute("popover")||l.classList&&(l.classList.contains("dropdown-menu")||l.classList.contains("tray-panel")||l.classList.contains("tray-overlay")||l.classList.contains("panel")))return!1;const d=l.tagName?l.tagName.toLowerCase():"";if(d==="sutram-modal"||d==="yenvui-modal")return!1}const a=t.currentTarget.getBoundingClientRect?.(),e=t.clientY??(t.touches&&t.touches[0]?t.touches[0].clientY:null);return!(a&&a.height>0&&e!==null&&(e<a.top-6||e>a.bottom+6))}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new G(this,{lockAxis:"horizontal",onPanStart:()=>{this._isPanningTrack=!1},onPanMove:(n,a,e)=>{if(e!=="horizontal")return;const l=this.shadowRoot?.querySelector(".spatial-track");this._isPanningTrack||(this._isPanningTrack=!0,l&&(l.style.transition="none"),this.shadowRoot&&this.shadowRoot.querySelectorAll(".active-tab-dropdown").forEach(c=>{c.open&&(c.open=!1)}));const d=n-this._dotDragController.startX,u=this._spatialState?.mobileViewportIndex??1,h=this._spatialState?.capacity||3,g=this._spatialState?.layoutRatios||[1,1,1],v=U(h,u,g),p=parseFloat(v.getTrackOffset());if(l){let c=d;const s=Math.max(0,g.length-h),f=U(h,s,g).getTrackOffset(),o=parseFloat(f);(p<=o&&d<0||p>=0&&d>0)&&(c=d*.2),l.style.transform=`translateX(calc(${p}% + ${c}px))`}},onPanEnd:(n,a,e)=>{if(!this._isPanningTrack)return;const l=this.shadowRoot?.querySelector(".spatial-track");if(l&&(l.style.transition=""),this._isPanningTrack=!1,e==="horizontal"){const d=n-this._dotDragController.startX,u=Math.min(110,Math.max(48,(window.innerWidth||360)*.18)),h=this._spatialState?.mobileViewportIndex??1,g=this._spatialState?.capacity||3,v=this._spatialState?.layoutRatios||[1,1,1],p=Math.max(0,v.length-g);let c=h;if(d>u?c=Math.max(0,h-1):d<-u&&(c=Math.min(p,h+1)),c!==h)this._setViewportIndex(c);else{const s=U(g,c,v);l&&(l.style.transform=`translateX(${s.getTrackOffset()})`),this.requestUpdate()}}else this.requestUpdate()}})),this._dotDragController.start(t,{lockAxis:"horizontal"})}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const n=window.Sutram.stores.Layout.getState();n.setMobileViewport(t);const e=["left","center","right"][t];if(e){n.setFocusedColumn(e);const l=n.columns?.[e]?.active||n.columns?.[e]?.pinned?.[0]?.id||"";l&&this._updateUrlHash(e,l)}}}render(){try{this._projectionPool.beginPass();const t=(i,_=null,x=null)=>this._projectionPool.resolve(i,_,x),n=window.ExtensionRegistry||z,a=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let e=this._layoutConfig.filter(i=>i.slot==="slots:primary-navigation");const l=this._layoutConfig.filter(i=>i.slot==="slots:global"),d=this._layoutConfig.filter(i=>i.slot==="slots:sub-navigation");a&&typeof n.getExtension=="function"&&(e=e.filter(i=>{const _=i.extName?n.getExtension(i.extName):null;return _&&_.offline_mode&&_.offline_mode!=="none"?!0:d.filter(T=>(T.targetParent||"").toLowerCase()===(i.id||"").toLowerCase()).some(T=>(n.getExtension(T.extName)?.offline_mode||"none")!=="none")}));const{capacity:u,mobileViewportIndex:h,focusedColumn:g}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},v=u===1?"mobile":u===2?"tablet":"desktop",p=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],c=this._spatialState.layoutRatios||[1,1,1],s=U(u,h,c),f=Math.max(0,Math.min(h,c.length-u)),o=Math.min(p.length-1,f+u-1),m=u<c.length;if(this.dataset.viewport=v,this.variant==="popout"){const i=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",_=i?i.split("/").map(decodeURIComponent):[];let x="";_.length>=4&&_[2]==="editor"?x=_.slice(3).join("/"):_.length>=3&&(x=_.slice(2).join("/"));const T=this._spatialState?.focusedColumn||"center",w=this._spatialState?.columns?.[T];x=x||w?.active||w?.pinned?.[0]?.id;let S=d.find(E=>E.id===x||!x.includes(":")&&E.rawId===x),R=null;if(S)S.allow_popout?R=t(S.component,S.id):R=L`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <sutram-icon name="alert-triangle" size="xl" intent="warning"></sutram-icon>
                            <h3 style="margin: 8px 0 0 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${S.label||S.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(x){const E=typeof n.resolveCustomEditor=="function"?n.resolveCustomEditor(x):null,D=n?.executeUIHook?n.executeUIHook("sutram:resolve-editor-component",x):null,A=E?.component||D||"sutram-editor";R=t(A,x)}const N=L`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div class="projection-mount-slot" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${R||L`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${l.map(E=>t(E.component))}
                </div>
            `;return this._projectionPool.commitPass(),N}const y=L`
            <div class="shell-container spatial-viewport" data-viewport="${v}">
                ${m?L`
                    <div class="position-bar" @pointerdown=${i=>this._handleDotDragStart(i)}>
                        ${c.map((i,_)=>{const x=_>=f&&_<f+u,T=Math.max(0,Math.min(_,c.length-u)),w=p[_]?.id||"center",S=this._spatialState?.columns?.[w]?.pinned||[],R=this._spatialState?.columns?.[w]?.active,N=S.find(A=>pinMatchesSlot(A,R))||S[0],D=(N?d.find(A=>pinMatchesSlot(N,A)):null)?.intent||N?.intent||"primary";return L`
                                <div
                                    class="position-bar-segment ${x?"on-screen":""}"
                                    style="flex: ${Number(i)||1} 1 0%; --seg-intent: var(--intent-${D});"
                                    title="${p[_]?.label||`Column ${_+1}`}"
                                    @click=${A=>{A.stopPropagation(),!this._isPanningTrack&&(this._setViewportIndex(T),window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(w))}}>
                                </div>
                            `})}
                    </div>
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${u}" style="${this._isPanningTrack?"":`transform: translateX(${s.getTrackOffset()});`}">
                    ${p.map((i,_)=>{let x=[],T=[i.id];T.forEach(r=>{(this._spatialState.columns&&this._spatialState.columns[r]?.pinned||[]).forEach(C=>{const $=d.find(P=>pinMatchesSlot(C,P));x.push({id:$?.id||C.id,rawId:$?.rawId||C.rawId||C.id,label:$?.label||C.label||C.title||C.id,component:$?.component||C.component,extName:$?.extName||C.extName||null,targetParent:$?.targetParent||C.targetParent||r,preferredColumn:$?.preferredColumn||C.preferredColumn||r,icon:$?.icon||C.icon,intent:$?.intent||C.intent,bulkActionGroup:$?.bulkActionGroup||C.bulkActionGroup||null,bulkEntityTypes:$?.bulkEntityTypes||C.bulkEntityTypes||null,menuStores:$?.menuStores||C.menuStores||null,menuActions:$?.menuActions||C.menuActions||null,headerActionComponent:$?.headerActionComponent||C.headerActionComponent||null,actualSourceCol:r})})}),a&&typeof n.getExtension=="function"&&(x=x.filter(r=>(n.getExtension(r.extName)?.offline_mode||"none")!=="none"));let w=null;const S=this._spatialState.focusedColumn,R=this._spatialState.columns[S]?.active;if(T.includes(S)&&(w=x.find(r=>pinMatchesSlot(r,R))),!w)for(const r of T){const k=this._spatialState.columns[r]?.active;if(w=x.find(C=>pinMatchesSlot(C,k)),w)break}w||(w=x[0]);const N=_===o,E=w?.intent||"primary",D=w?.icon||"plus",A=w?this._formatTabLabel(w):"Open tab",Z=this._buildColumnTabDropdownItems(i,x,w,e,d),W=w?x.filter(r=>!pinMatchesSlot(r,w.id)):[],O=this._colTabsWidths?.[i.id]||0,K=w?Math.min(200,Math.max(88,A.length*7.5+54)):112,J=Math.max(0,O-K-6),Q=W.map(r=>Math.max(44,this._formatTabLabel(r).length*7.5+42)),q=`${O}:${A}:${W.map(r=>`${r.id}:${this._formatTabLabel(r)}`).join(",")}`;this._lastInlineClampKeys[i.id]!==q&&(this._lastInlineClampKeys[i.id]=q,this._inlineTabClampCounts[i.id]=null);const X=O>0?at(J,Q,0,0,!1):0,F=this._inlineTabClampCounts?.[i.id],Y=F!=null?Math.min(X,F):X;this._lastRenderedInlineCounts[i.id]=Y;const tt=W.slice(0,Y),H=[];return w&&w.headerActionComponent&&H.push(t(w.headerActionComponent,w.id)),w&&this._layoutConfig.filter(r=>r.slot==="slots:sub-navigation-actions"&&(r.targetSub===w.id||r.extName===w.extName&&(r.targetSub===w.rawId||r.targetSub===`${w.extName}:${w.rawId}`))).forEach(r=>{H.push(t(r.component,w.id))}),L`
                        <div class="spatial-col ${g===i.id?"is-focused":""}" data-col-id="${i.id}" style="--col-width: ${s.getColWidth(_)}; --col-left: ${s.getColLeft(_)};" @click=${r=>{if(this._isPanningTrack){r.preventDefault(),r.stopPropagation();return}const k=w?w.id:x[0]?x[0].id:null,C=w&&w.actualSourceCol||i.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(C),k&&this._updateUrlHash(C,k)}}>
                            <!-- Unified Single Column Header Row -->
                            <div class="col-header" style="--active-sub-intent: var(--intent-${E});"
                                @sutram:column-jump=${r=>{r.preventDefault(),r.stopPropagation();const{colId:k,colIdx:C}=r.detail||{},$=Math.max(0,Math.min(Number(C)||0,c.length-u));if(this._setViewportIndex($),k&&window.Sutram?.stores?.Layout){const P=window.Sutram.stores.Layout.getState();P.setFocusedColumn(k);const M=P.columns?.[k]?.active||P.columns?.[k]?.pinned?.[0]?.id||"";M&&this._updateUrlHash(k,M)}}}
                                @sutram:force-refresh=${r=>{const{subId:k,parentId:C}=r.detail||{};if(!k)return;const $=this.shadowRoot?.querySelector(`[data-sub-id="${k}"]`);if(!$||typeof $.onForceRefresh!="function")return;r.stopPropagation();const P=this.refreshProjection(k,C,!1);P&&r.detail&&(r.detail.promise=P)}}
                                @pointerdown=${r=>{m&&this._isHeaderBarSurfaceEvent(r)&&this._handleDotDragStart(r)}}>
                                <!-- 1. View Menu (Always First) -->
                                <sutram-subtab-menu
                                    .columnId=${i.id}
                                    .slotConfig=${w}
                                    .extraContentNodes=${H}>
                                </sutram-subtab-menu>

                                <!-- 2. Active Tab Dropdown + 3. Fitted Inline Open Tabs -->
                                <div class="col-tabs-area" data-col-tabs="${i.id}">
                                    <sutram-dropdown
                                        class="active-tab-dropdown"
                                        align="left"
                                        searchable
                                        ?chipRows=${!0}
                                        searchPlaceholder="Filter tabs..."
                                        .items=${Z}>
                                        <button
                                            slot="trigger"
                                            type="button"
                                            class="active-tab-trigger"
                                            title=${A}
                                            @pointerdown=${r=>{const k=r.currentTarget?.closest?.("sutram-dropdown");w&&!k?.open&&this._handlePointerDown(r,w,w.actualSourceCol||i.id,"subtab")}}
                                            @click=${()=>{const r=w&&w.actualSourceCol||i.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(r)}}>
                                            <sutram-icon name="${D}" size="sm" intent="${E}"></sutram-icon>
                                            <span class="active-tab-label">${A}</span>
                                            <sutram-icon name="chevron-down" size="xs"></sutram-icon>
                                        </button>
                                    </sutram-dropdown>

                                    ${tt.map(r=>{const k=r.intent||"primary",C=r.icon||"component",$=this._formatTabLabel(r);return L`
                                            <button
                                                type="button"
                                                class="inline-tab-btn"
                                                title=${$}
                                                @pointerdown=${P=>{const M=Date.now();if(this._lastTapId===r.id&&M-(this._lastTapTime||0)<300){P.stopPropagation();const V=window.Sutram?.stores?.Layout?.getState();V&&(V.unpinFromColumn(r.actualSourceCol||i.id,r.id),V.openWindow(r,i.id,1)),this._lastTapTime=0;return}this._lastTapId=r.id,this._lastTapTime=M,this._handlePointerDown(P,r,r.actualSourceCol||i.id,"subtab")}}
                                                @dblclick=${P=>{P.stopPropagation();const M=window.Sutram?.stores?.Layout?.getState();M&&(M.unpinFromColumn(r.actualSourceCol||i.id,r.id),M.openWindow(r,i.id,1))}}
                                                @click=${P=>{P.stopPropagation(),window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(r.actualSourceCol||i.id),this._handleSubTabClick(r.id)}}>
                                                <sutram-icon name="${C}" size="sm" intent="${k}"></sutram-icon>
                                                <span>${$}</span>
                                            </button>
                                        `})}
                                </div>

                                <!-- 4. Globals on the Last Visible Column -->
                                ${N?L`
                                    <div class="col-globals-rail" @click=${r=>r.stopPropagation()}>
                                        <slot name="header-quickpack"></slot>
                                        <slot name="header-actions-left"></slot>
                                        <slot name="gear-pinned"></slot>
                                        <slot name="header-actions"></slot>
                                    </div>
                                `:""}
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${x.map(r=>{const k=w&&pinMatchesSlot(r,w.id),C=t(r.component,r.id);return L`
                                        <div class="projection-mount-slot" style="display: ${k?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0; overflow: hidden;" data-ext="${r.extName}" data-offline-mode="${(typeof n.getExtension=="function"?n.getExtension(r.extName)?.offline_mode:null)||"none"}">
                                            ${C}
                                        </div>
                                    `})}
                                ${x.length===0?L`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${i.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(i=>{const x={left:0,center:1,right:2}[i.anchorCol||"center"]??1;let T=Math.min(i.span||1,3-x);T=Math.min(T,u);const w=s.getWinBounds(x,T,c);return L`
                            <div style="position: absolute; left: ${w.left}; width: ${w.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${i.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${i.label||i.id}
                                    .anchorCol=${i.anchorCol||"center"}
                                    .span=${T}
                                    .z=${i.z}
                                    .icon=${i.icon||"component"}
                                    .intent=${i.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(i.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(i.id)})}}
                                    @sutram-window-span=${S=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(i.id,i.anchorCol||"center",S.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(i.id)}
                                    @sutram-window-drag-start=${S=>this._handlePointerDown(S.detail.originalEvent,i,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(i.windowOnly)return;const S=window.Sutram?.stores?.Layout?.getState();if(S){const R=i.preferredColumn||"center";S.closeWindow(i.id),S.pinToColumn(R,i),S.setActiveProjection(R,i.id),S.setFocusedColumn(R),this.requestUpdate()}}}>
                            ${t(i.component,i.id,i.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${l.map(i=>t(i.component))}
            </div>
            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._projectionPool.commitPass(),y}catch(t){return console.error("[Telemetry] AppShell render error:",t),L`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><sutram-icon name="alert-triangle" size="lg"></sutram-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
