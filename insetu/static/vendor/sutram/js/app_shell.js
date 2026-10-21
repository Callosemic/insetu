import{html as v,css as A}from"lit";import{SutramElement as U,ExtensionRegistry as D,LayoutStore as N,StoreRegistry as j}from"./sutram_sdk.js";import{sharedStyles as X}from"./shared_styles.js";import{debounce as z}from"./utils.js";import{SutramProjectionCompiler as q}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as M}from"../../yenvui/js/physics.js";const L=(I,e,i)=>{const o=Array.isArray(i)&&i.length>0?i:[1,1,1],p=Math.max(0,Math.min(e,o.length-I)),n=o.slice(p,p+I).reduce((a,u)=>a+u,0)||1;return{getColWidth:a=>`${o[a]/n*100}%`,getColLeft:a=>`${o.slice(0,a).reduce((s,C)=>s+C,0)/n*100}%`,getTrackOffset:()=>`-${o.slice(0,p).reduce((u,s)=>u+s,0)/n*100}%`,getWinBounds:(a,u)=>{const s=Math.min(u,o.length-a),C=o.slice(0,a).reduce((x,m)=>x+m,0),_=o.slice(a,a+s).reduce((x,m)=>x+m,0);return{left:`${C/n*100}%`,width:`${_/n*100}%`}}}};export const pinMatchesSlot=(I,e)=>{if(!I||!e)return!1;const i=typeof e=="string"?e:e.id||"",o=typeof e=="object"&&e.rawId?e.rawId:i.includes("://")?i:i.includes(":")?i.split(":").slice(1).join(":"):i,p=typeof e=="object"&&e.extName?e.extName:!i.includes("://")&&i.includes(":")?i.split(":")[0]:null;if(I.id===i||I.rawId&&I.rawId===o&&(!p||!I.extName||I.extName===p)||p&&I.id===o&&(!I.extName||I.extName===p))return!0;if(I.id&&!I.id.includes("://")&&I.id.includes(":")){const[n,a]=I.id.split(":");if(a===o&&(!p||n===p))return!0}return I.id===o&&!p};export class SutramAppShell extends U{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[X,A`
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
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(e,i){const o=window.ExtensionRegistry||D;o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",e)&&!confirm(`You have unsaved changes in ${e.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||i()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(e,i,o,p="subtab"){let n=null;const a=this.shadowRoot.querySelector(".spatial-track"),u=a?a.getBoundingClientRect():{top:38,height:window.innerHeight-68};if(o==="window"){const x=e.composedPath().find(m=>m.tagName&&m.tagName.toLowerCase()==="sutram-window");if(x&&x.parentElement){const m=x.parentElement.getBoundingClientRect();n={left:m.left,top:m.top,width:m.width,height:m.height}}}else if(o){const _=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${o}"]`);if(_){const x=_.getBoundingClientRect();n={left:x.left,top:x.top,width:x.width,height:x.height}}}n||(n={left:0,top:u.top,width:window.innerWidth,height:u.height});const s=e.clientX!==void 0?e.clientX:e.touches&&e.touches[0]?e.touches[0].clientX:0,C=e.clientY!==void 0?e.clientY:e.touches&&e.touches[0]?e.touches[0].clientY:0;this._dragState={active:!1,entity:i,sourceCol:o,currentZone:null,startX:s,startY:C,currentX:s,currentY:C,originType:p,sourceRect:n},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:(_,x)=>{this._dragState&&(_!==void 0&&!isNaN(_)&&(this._dragState.currentX=_),x!==void 0&&!isNaN(x)&&(this._dragState.currentY=x)),this._activateDrag()},onPanMove:(_,x)=>{if(!this._dragState.active){const g=Math.abs(_-this._dragState.startX),r=Math.abs(x-this._dragState.startY);(g>8||r>8)&&this._activateDrag();return}this._dragState.currentX=_,this._dragState.currentY=x;let m=!1;const f=this.shadowRoot.querySelector("sutram-drag-coordinator");if(f){const g=typeof f.getHoveredZone=="function"?f.getHoveredZone(_,x):null;this._dragState.currentZone!==g&&(this._dragState.currentZone=g,m=!0),m?f.dragState={...this._dragState}:typeof f.updatePointer=="function"&&f.updatePointer(_,x)}},onPanEnd:(_,x)=>{if(this._dragState.active){const m=this._dragState.currentZone,f=this._dragState.entity,g=this._dragState.sourceCol;if(m&&window.Sutram?.stores?.Layout){const r=window.Sutram.stores.Layout.getState();if(m==="close")this._safeEvict(f.id,()=>{g==="window"?r.closeWindow(f.id):g&&r.unpinFromColumn(g,f.id),r.evictProjection(f.id);const w=window.Sutram.stores.Layout.getState(),t=w.focusedColumn||g||"center",d=w.columns[t]?.active||"";this._updateUrlHash(t,d)});else if(m==="popout"){const w=g&&g!=="window"?g:r.focusedColumn||"center";r.popoutProjection(f.id,{originCol:w})}else if(m==="window"||m==="mode-window"){const w=g&&g!=="window"?g:f.anchorCol||r.focusedColumn||"center";g&&g!=="window"&&r.unpinFromColumn(g,f.id),r.openWindow(f,w,1)}else if(m==="mode-tab"&&!f?.windowOnly){const w=g&&g!=="window"?g:f.anchorCol||r.focusedColumn||"center";g==="window"&&r.closeWindow(f.id),r.columns[w]?.pinned?.some(t=>t.id===f.id)||r.pinToColumn(w,f),r.setActiveProjection(w,f.id),r.setFocusedColumn(w)}else if(m.startsWith("span-")){const w=m.split("-"),t=parseInt(w[1],10),d=w[2];g==="window"?r.updateWindowConstraints(f.id,d,t):(g&&r.unpinFromColumn(g,f.id),r.openWindow(f,d,t))}else if(m.startsWith("reorder-")){if(g){const w=parseInt(m.replace("reorder-",""),10),t=[...r.columns[g].pinned],d=t.findIndex(l=>l.id===f.id);if(d!==-1&&d!==w){const[l]=t.splice(d,1);t.splice(w,0,l),window.Sutram.stores.Layout.setState(b=>({columns:{...b.columns,[g]:{...b.columns[g],pinned:t}}}))}}}else if(["left","center","right"].includes(m)&&m!==g&&!f?.windowOnly){const w=m;g==="window"?r.closeWindow(f.id):g&&r.unpinFromColumn(g,f.id),r.pinToColumn(w,f),r.setActiveProjection(w,f.id),r.setFocusedColumn(w)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(e,{lockAxis:p==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(e=>{e&&typeof e.abort=="function"&&e.abort()})}updated(e){super.updated(e);const i=this.shadowRoot.querySelector(".spatial-track");if(i){const p=this._spatialState?.capacity||3,n=this._spatialState?.mobileViewportIndex??1,a=this._spatialState?.layoutRatios||[1,1,1],u=L(p,n,a);this._isPanningTrack||(i.style.transform=`translateX(${u.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(p=>{const n=p.closest("yenvui-scrub-track");if(n&&n.shadowRoot){const a=n.shadowRoot.querySelector(".scrub-container");if(a){const u=p.getBoundingClientRect();if(u.width>0){const s=a.getBoundingClientRect();a.scrollBy({left:u.left-s.left-s.width/2+u.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,e=>{this._edgeSwipeStartX=e.touches[0].clientX,this._edgeSwipeStartY=e.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,e=>{const i=e.touches[0].clientX,o=e.touches[0].clientY,p=Math.abs(i-this._edgeSwipeStartX),n=Math.abs(o-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&p>n&&p>5&&e.cancelable&&e.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,e=>{this._launcherDropdown&&!e.composedPath().some(i=>i.classList?.contains("global-launcher-menu")||i.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),N&&(this.subscribe(N,e=>{const i=e||{};this._spatialState={capacity:i.capacity||3,focusedColumn:i.focusedColumn||"center",mobileViewportIndex:i.mobileViewportIndex??1,layoutRatios:i.layoutRatios||null,columns:i.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:i.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,e=>{const i=e.detail?.extName;if(i&&this._activeNodes){for(const[o,p]of Array.from(this._activeNodes.entries()))if((p?.extName||p?.dataset?.ext||(p?.tagName?p.tagName.toLowerCase().replace(/^[a-z0-9_-]+-ext-/,""):""))===i||o.includes(`:${i}:`)){try{p.remove()}catch{}this._activeNodes.delete(o)}}this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,e=>{const{oldId:i,newId:o}=e.detail||{};if(!i||!o)return;for(const[n,a]of Array.from(this._activeNodes.entries())){const u=`:${i}`;if(n.endsWith(u)){const s=n.slice(0,n.length-u.length);this._activeNodes.delete(n),a.dataset&&(a.dataset.subId=o),this._activeNodes.set(`${s}:${o}`,a)}}if(decodeURIComponent(window.location.hash||"").includes(i)){const n=N.getState(),a=n.focusedColumn||"center";if(this.variant==="popout"){const u=window.location.hash.replace(encodeURIComponent(i),encodeURIComponent(o)).replace(i,o);u!==window.location.hash&&window.history.replaceState(null,"",u)}else n.columns?.[a]?.active===o&&this._updateUrlHash(a,o)}this.requestUpdate()}),this._handleResize=z(()=>{const e=window.innerWidth,i=Math.min(3,Math.max(1,Math.floor(e/360))),o=N.getState();if(o&&(o.capacity||3)!==i&&typeof o.setCapacity=="function"){if(o.setCapacity(i),i===1&&o.focusedColumn){const a={left:0,center:1,right:2};o.setMobileViewport(a[o.focusedColumn]||1)}else if(i===2&&o.focusedColumn){const u={left:0,center:1,right:2}[o.focusedColumn]||1,s=u===0?0:u===2||o.mobileViewportIndex===2?2:0;o.setMobileViewport(s)}(o.windows||[]).forEach(a=>{let u=Math.min(a.span||1,i),s=a.anchorCol||"center";i===1?(u=1,s=o.focusedColumn||"center"):i===2&&s==="right"&&(s=u===2?"left":"center"),(u!==a.span||s!==a.anchorCol)&&o.updateWindowConstraints(a.id,s,u)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=z(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(e){console.error("[Telemetry] AppShell connectedCallback error:",e)}}_resolvePrimaryTabMeta(e){const i=(typeof e=="string"?e:e?.id)?.toLowerCase()||"",o=window.ExtensionRegistry||D,p=o?.executeUIHook?o.executeUIHook("sutram:resolve-primary-tab-meta",{id:i,tab:e}):null,n={context:{color:"var(--intent-primary)",icon:"folder-code"},edit:{color:"var(--intent-highlight)",icon:"edit-3"},diagnostics:{color:"var(--intent-warning)",icon:"activity"},tasks:{color:"var(--intent-warning)",icon:"check-square"},ctrl:{color:"var(--intent-danger)",icon:"terminal"},dev:{color:"var(--intent-success)",icon:"code"},offline:{color:"var(--text-muted)",icon:"wifi-off"},library:{color:"var(--intent-highlight)",icon:"book-open"}};return{color:e&&e.intent?`var(--intent-${e.intent})`:p?.color||n[i]?.color||"var(--intent-primary)",icon:e&&e.icon?e.icon:p?.icon||n[i]?.icon||"folder"}}_getPrimaryTabColor(e){return this._resolvePrimaryTabMeta(e).color}_getPrimaryTabIcon(e){const{color:i,icon:o}=this._resolvePrimaryTabMeta(e);return v`<yv-icon name="${o}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${i};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=q.getCompiledLayout();const e=window.Sutram?.stores?.Layout,i=window.ExtensionRegistry||D,o=window.Sutram?.storeRegistry||j,p=!!(o&&typeof o.isTransitioning=="function"&&o.isTransitioning()||i?.executeUIHook&&(i.executeUIHook("sutram:is-swapping-scope")||i.executeUIHook("sutram:is-swapping-workspace")));if(e&&!i.isBooting&&!p){const n=e.getState();let a=!1;const u={},s={...n.columns},C=r=>typeof i._filterPredicate=="function"?i._filterPredicate(r):!0,_=this._layoutConfig.filter(r=>r.slot==="slots:sub-navigation");["left","center","right"].forEach(r=>{if(!s[r]||!s[r].pinned)return;const w=s[r].pinned.filter(t=>!t.extName||C(t.extName)).map(t=>{const d=_.find(l=>pinMatchesSlot(t,l));return d&&(t.id!==d.id&&(u[t.id]=d.id,a=!0),d.icon!==t.icon||d.label!==t.label||d.intent!==t.intent||d.rawId!==t.rawId||t.id!==d.id)?(a=!0,{...t,id:d.id,rawId:d.rawId||d.id,extName:d.extName,icon:d.icon||t.icon,label:d.label||t.label,intent:d.intent||t.intent}):t});(w.length!==s[r].pinned.length||a)&&(s[r]={...s[r],pinned:w},s[r].active&&u[s[r].active]?(s[r].active=u[s[r].active],a=!0):s[r].active&&!w.some(t=>pinMatchesSlot(t,s[r].active))&&(s[r].active=w.length>0?w[0].id:null,a=!0),Array.isArray(s[r].history)&&(s[r].history=s[r].history.map(t=>u[t]||t)))});const x=n.windows||[],m=x.filter(r=>!r.extName||C(r.extName));m.length!==x.length&&(a=!0);let f=m.map(r=>{const w=_.find(t=>t.id===r.id||r.extName&&t.extName===r.extName&&t.rawId===r.id);return w&&r.id!==w.id?(u[r.id]=w.id,a=!0,{...r,id:w.id,rawId:w.rawId,extName:w.extName,icon:w.icon||r.icon,label:w.label||r.label}):r}),g=(n.focusHistory||[]).map(r=>r&&r.id&&u[r.id]?(a=!0,{...r,id:u[r.id]}):r);a&&(e.setState({columns:s,windows:f,focusHistory:g}),Object.keys(u).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:u},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(e){console.error("[Telemetry] AppShell _compileLayout error:",e)}}_renderDropdownItem(e){let i=null;if(this._spatialState&&this._spatialState.columns){for(const o of["left","center","right"])if(this._spatialState.columns[o].pinned.some(p=>pinMatchesSlot(p,e))){i=o;break}}return v`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${o=>{const p=window.Sutram?.stores?.Layout?.getState();let n=null;if(p&&p.columns){for(const a of["left","center","right"])if(p.columns[a].pinned.some(u=>pinMatchesSlot(u,e))){n=a;break}}this._handlePointerDown(o,e,n,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const o=window.Sutram?.stores?.Layout?.getState();let p=null,n=null;if(o&&o.columns){for(const s of["left","center","right"])if(n=o.columns[s].pinned.find(C=>pinMatchesSlot(C,e)),n){p=s;break}}let a=p;const u=n?n.id:e.id;p||(a=e.preferredColumn||"center",o&&o.pinToColumn(a,e)),o&&(o.setFocusedColumn(a),o.setActiveProjection(a,u)),this._handleSubTabClick(u),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${e.icon?v`<yv-icon name="${e.icon}" style="width: 14px; height: 14px; color: ${i?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:v`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${i?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${e.label}</span>
            </button>
        `}_updateUrlHash(e,i){const o=window.ExtensionRegistry||D,p=o?.executeUIHook?o.executeUIHook("sutram:resolve-route-hash",{colId:e,subId:i}):null,n=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",a=p||`#/${n}/${e}/${encodeURIComponent(i)}`;window.location.hash!==a&&window.history.replaceState(null,"",a)}_handleSubTabClick(e){let i=null,o=!1,p=e;if(window.Sutram?.stores?.Layout){const n=window.Sutram.stores.Layout.getState();for(const a of["left","center","right"]){const u=n.columns[a]?.pinned.find(s=>pinMatchesSlot(s,e));if(u){i=a,p=u.id;break}}if(i){o=n.columns[i].active===p,n.setActiveProjection(i,p),n.setFocusedColumn(i);const a={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(a[i])}}if(o){const n=this.shadowRoot.querySelector(`[data-sub-id="${p}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${e}"]`);n&&typeof n.onForceRefresh=="function"&&n.onForceRefresh()}this.requestUpdate(),i&&this._updateUrlHash(i,p)}_handleDotDragStart(e){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const i=this.shadowRoot.querySelector(".spatial-track");i&&(i.style.transition="none")},onPanMove:(i,o,p)=>{if(p==="horizontal"){const n=i-this._dotDragController.startX,a=this._spatialState?.mobileViewportIndex??1,u=this._spatialState?.capacity||3,s=this._spatialState?.layoutRatios||[1,1,1],C=L(u,a,s),_=parseFloat(C.getTrackOffset()),x=this.shadowRoot.querySelector(".spatial-track");if(x){let m=n;const f=Math.max(0,s.length-u),g=L(u,f,s).getTrackOffset(),r=parseFloat(g);(_<=r&&n<0||_>=0&&n>0)&&(m=n*.2),x.style.transform=`translateX(calc(${_}% + ${m}px))`}}},onPanEnd:(i,o,p)=>{const n=this.shadowRoot.querySelector(".spatial-track");if(n&&(n.style.transition=""),p==="horizontal"){const a=i-this._dotDragController.startX,u=window.innerWidth*.2,s=this._spatialState?.mobileViewportIndex??1,C=this._spatialState?.capacity||3,_=this._spatialState?.layoutRatios||[1,1,1],x=Math.max(0,_.length-C);let m=s;if(a>u?m=Math.max(0,s-1):a<-u&&(m=Math.min(x,s+1)),this._isPanningTrack=!1,m!==s)this._setViewportIndex(m);else{const f=L(C,m,_);n&&(n.style.transform=`translateX(${f.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(e)}_setViewportIndex(e){if(window.Sutram?.stores?.Layout){const i=window.Sutram.stores.Layout.getState();i.setMobileViewport(e);const o=["left","center","right"];o[e]&&i.setFocusedColumn(o[e])}}render(){try{const e=new Map,i=(t,d=null,l=null)=>{if(!t)return"";const b=d?`${t}:${d}`:t;let c=this._activeNodes.get(b);if(!c)try{c=document.createElement(t)}catch{c=document.createElement("div"),c.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;";const $=document.createElement("yv-icon");$.setAttribute("name","alert-triangle"),$.style.width="14px",$.style.height="14px";const h=document.createElement("span");h.textContent=`Failed to initialize <${t}>`,c.replaceChildren($,h)}return d&&c.dataset&&(c.dataset.subId=d),l&&typeof l=="object"&&Object.assign(c,l),e.set(b,c),c},o=window.ExtensionRegistry||D,p=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let n=this._layoutConfig.filter(t=>t.slot==="slots:primary-navigation");const a=this._layoutConfig.filter(t=>t.slot==="slots:global"),u=this._layoutConfig.filter(t=>t.slot==="slots:sub-navigation");p&&typeof o.getExtension=="function"&&(n=n.filter(t=>{const d=t.extName?o.getExtension(t.extName):null;return d&&d.offline_mode&&d.offline_mode!=="none"?!0:u.filter(b=>(b.targetParent||"").toLowerCase()===(t.id||"").toLowerCase()).some(b=>(o.getExtension(b.extName)?.offline_mode||"none")!=="none")}));const{capacity:s,mobileViewportIndex:C,focusedColumn:_}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},x=s===1?"mobile":s===2?"tablet":"desktop",m=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],f=this._spatialState.layoutRatios||[1,1,1],g=L(s,C,f);this.dataset.viewport=x;const r=this.variant==="popout";if(r){const t=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",d=t?t.split("/").map(decodeURIComponent):[];let l="";d.length>=4&&d[2]==="editor"?l=d.slice(3).join("/"):d.length>=3&&(l=d.slice(2).join("/"));const b=this._spatialState?.focusedColumn||"center",c=this._spatialState?.columns?.[b];l=l||c?.active||c?.pinned?.[0]?.id;let S=u.find(k=>k.id===l||!l.includes(":")&&k.rawId===l),$=null;if(S)S.allow_popout?$=i(S.component,S.id):$=v`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <yv-icon name="alert-triangle" style="width: 36px; height: 36px; color: var(--intent-warning); margin-bottom: 16px;"></yv-icon>
                            <h3 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${S.label||S.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(l){const k=typeof o.resolveCustomEditor=="function"?o.resolveCustomEditor(l):null,y=o?.executeUIHook?o.executeUIHook("sutram:resolve-editor-component",l):null,P=k?.component||y||"sutram-editor";$=i(P,l)}const h=v`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${$||v`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${a.map(k=>i(k.component))}
                </div>
            `;return this._activeNodes=e,h}const w=v`
            <div class="shell-container spatial-viewport" data-viewport="${x}">
                ${r?"":v`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 0; padding-right: 0; ${s<f.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${t=>{s<f.length&&this._handleDotDragStart(t)}}>
                        ${x==="mobile"?v`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${t=>{if(t.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const d=n[0]?n[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:d}}this.requestUpdate()}}>
                                    <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                    <span>Tools</span>
                                    <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                                </button>
                            </div>
                        `:v`
                            <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${n.map(t=>{const d=u.filter(l=>(l.targetParent||"").toLowerCase()===t.id.toLowerCase());return v`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(t)};" @click=${l=>{if(this._launcherDropdown?.tabId===t.id)this._launcherDropdown=null;else{const b=l.currentTarget.getBoundingClientRect(),c=b.right>window.innerWidth-200;this._launcherDropdown={tabId:t.id,items:d,x:c?"auto":b.left+"px",right:c?window.innerWidth-b.right+"px":"auto",y:b.bottom+5+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(t)}${t.label}
                                        </button>
                                    `})}
                            </yenvui-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${s===1&&s<f.length?v`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,f.length-s+1)}).map((t,d)=>v`
                                    <div class="pos-dot-target" @click=${l=>{l.stopPropagation(),l.preventDefault()}} @pointerdown=${l=>{l.stopPropagation(),this._setViewportIndex(d)}} title="Jump to View ${d+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${C===d?"active":""}" style="width: ${C===d?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${C===d?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${C===d?"1":"0.5"}; transition: all 0.2s ease;"></div>
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
                                    ${Array.from({length:Math.max(1,f.length-s+1)}).map((t,d)=>v`
                                        <div class="pos-dot-target" @click=${l=>{l.stopPropagation(),l.preventDefault()}} @pointerdown=${l=>{l.stopPropagation(),this._setViewportIndex(d)}} title="Jump to View ${d+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${C===d?"active":""}" style="width: ${C===d?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${C===d?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${C===d?"1":"0.5"}; transition: all 0.2s ease;"></div>
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
                            ${n.map(t=>{const d=u.filter(l=>(l.targetParent||"").toLowerCase()===t.id.toLowerCase());return d.length===0?"":v`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(t)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(t)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${t.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${d.map(l=>{let b=null;if(this._spatialState&&this._spatialState.columns){for(const c of["left","center","right"])if(this._spatialState.columns[c].pinned.some(S=>S.id===l.id)){b=c;break}}return v`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${c=>{const S=window.Sutram?.stores?.Layout?.getState();let $=null;if(S&&S.columns){for(const h of["left","center","right"])if(S.columns[h].pinned.some(k=>k.id===l.id)){$=h;break}}this._handlePointerDown(c,l,$,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const c=window.Sutram?.stores?.Layout?.getState(),{capacity:S,focusedColumn:$,mobileViewportIndex:h}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let k=null;if(c&&c.columns){for(const P of["left","center","right"])if(c.columns[P].pinned.some(T=>T.id===l.id)){k=P;break}}let y=k;k||(y=l.preferredColumn||"center",c&&c.pinToColumn(y,l)),c&&c.setFocusedColumn(y),this._handleSubTabClick(l.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${l.icon?v`<yv-icon name="${l.icon}" style="width: 14px; height: 14px; color: ${b?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:v`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${b?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${l.label}</span>
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
                    ${m.map((t,d)=>{let l=[],b=[t.id];b.forEach(h=>{(this._spatialState.columns&&this._spatialState.columns[h]?.pinned||[]).forEach(y=>{const P=u.find(T=>pinMatchesSlot(y,T));l.push({id:P?.id||y.id,rawId:P?.rawId||y.rawId||y.id,label:P?.label||y.label||y.title||y.id,component:P?.component||y.component,extName:P?.extName||y.extName||null,targetParent:P?.targetParent||y.targetParent||h,preferredColumn:P?.preferredColumn||y.preferredColumn||h,icon:P?.icon||y.icon,intent:P?.intent||y.intent,bulkActionGroup:P?.bulkActionGroup||y.bulkActionGroup||null,bulkEntityTypes:P?.bulkEntityTypes||y.bulkEntityTypes||null,menuActions:P?.menuActions||y.menuActions||null,actualSourceCol:h})})}),p&&typeof o.getExtension=="function"&&(l=l.filter(h=>(o.getExtension(h.extName)?.offline_mode||"none")!=="none"));let c=null;const S=this._spatialState.focusedColumn,$=this._spatialState.columns[S]?.active;if(b.includes(S)&&(c=l.find(h=>pinMatchesSlot(h,$))),!c)for(const h of b){const k=this._spatialState.columns[h]?.active;if(c=l.find(y=>pinMatchesSlot(y,k)),c)break}return c||(c=l[0]),v`
                        <div class="spatial-col ${_===t.id&&s>1?"is-focused":""}" data-col-id="${t.id}" style="--col-width: ${g.getColWidth(d)}; --col-left: ${g.getColLeft(d)};" @click=${h=>{if(this._isPanningTrack){h.preventDefault(),h.stopPropagation();return}const k=c?c.id:l[0]?l[0].id:null,y=c&&c.actualSourceCol||t.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(y),k&&this._updateUrlHash(y,k)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${c&&c.intent?`var(--intent-${c.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${l.map(h=>{const k=c&&pinMatchesSlot(h,c.id),y=h.intent?`var(--intent-${h.intent})`:"var(--intent-primary)",P=h.icon||"component";return v`
                                        <div class="sub-tab ${k?"active":""}"
                                                style="${k?`border-bottom-color: ${y}; color: var(--text);`:""}"
                                                @pointerdown=${T=>{const R=Date.now();if(this._lastTapId===h.id&&R-(this._lastTapTime||0)<300){T.stopPropagation();const E=window.Sutram?.stores?.Layout?.getState();E&&(E.unpinFromColumn(h.actualSourceCol||t.id,h.id),E.openWindow(h,t.id,1)),this._lastTapTime=0;return}this._lastTapId=h.id,this._lastTapTime=R,this._handlePointerDown(T,h,h.actualSourceCol||t.id,"subtab")}}
                                                @dblclick=${T=>{T.stopPropagation();const R=window.Sutram?.stores?.Layout?.getState();R&&(R.unpinFromColumn(h.actualSourceCol||t.id,h.id),R.openWindow(h,t.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(h.actualSourceCol||t.id),this._handleSubTabClick(h.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${y}; opacity:${k?"1":"0.5"};">
                                                    <yv-icon name="${P}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${h.label}${o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",h.id)?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${c?this._layoutConfig.filter(h=>h.slot==="slots:sub-navigation-actions"&&(h.targetSub===c.id||h.extName===c.extName&&(h.targetSub===c.rawId||h.targetSub===`${c.extName}:${c.rawId}`))).map(h=>v`<div style="display: contents;" data-ext="${h.extName}">${i(h.component,c.id)}</div>`):""}
                                    ${c&&(c.bulkActionGroup||c.menuActions)?v`
                                        <sutram-subtab-menu .slotConfig=${c}></sutram-subtab-menu>
                                    `:""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${l.map(h=>{const k=c&&pinMatchesSlot(h,c.id),y=i(h.component,h.id);return v`
                                        <div style="display: ${k?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${h.extName}" data-offline-mode="${(typeof o.getExtension=="function"?o.getExtension(h.extName)?.offline_mode:null)||"none"}">
                                            ${y}
                                        </div>
                                    `})}
                                ${l.length===0?v`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${t.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(t=>{const l={left:0,center:1,right:2}[t.anchorCol||"center"]??1;let b=Math.min(t.span||1,3-l);b=Math.min(b,s);const c=g.getWinBounds(l,b,f);return v`
                            <div style="position: absolute; left: ${c.left}; width: ${c.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${t.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${t.label||t.id}
                                    .anchorCol=${t.anchorCol||"center"}
                                    .span=${b}
                                    .z=${t.z}
                                    .icon=${t.icon||"component"}
                                    .intent=${t.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(t.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(t.id)})}}
                                    @sutram-window-span=${S=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(t.id,t.anchorCol||"center",S.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(t.id)}
                                    @sutram-window-drag-start=${S=>this._handlePointerDown(S.detail.originalEvent,t,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(t.windowOnly)return;const S=window.Sutram?.stores?.Layout?.getState();if(S){const $=t.preferredColumn||"center";S.closeWindow(t.id),S.pinToColumn($,t),S.setActiveProjection($,t.id),S.setFocusedColumn($),this.requestUpdate()}}}>
                            ${i(t.component,t.id,t.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${a.map(t=>i(t.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=e,w}catch(e){return console.error("[Telemetry] AppShell render error:",e),v`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${e.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${e.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
