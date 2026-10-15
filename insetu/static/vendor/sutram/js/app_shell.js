import{html as v,css as U}from"lit";import{SutramElement as j,ExtensionRegistry as R,LayoutStore as E}from"./sutram_sdk.js";import{sharedStyles as A}from"./shared_styles.js";import{debounce as N}from"./utils.js";import{SutramProjectionCompiler as X}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as M}from"../../yenvui/js/physics.js";const L=(P,t,i)=>{const o=Array.isArray(i)&&i.length>0?i:[1,1,1],d=Math.max(0,Math.min(t,o.length-P)),n=o.slice(d,d+P).reduce((l,m)=>l+m,0)||1;return{getColWidth:l=>`${o[l]/n*100}%`,getColLeft:l=>`${o.slice(0,l).reduce((f,C)=>f+C,0)/n*100}%`,getTrackOffset:()=>`-${o.slice(0,d).reduce((m,f)=>m+f,0)/n*100}%`,getWinBounds:(l,m)=>{const f=Math.min(m,o.length-l),C=o.slice(0,l).reduce((r,u)=>r+u,0),_=o.slice(l,l+f).reduce((r,u)=>r+u,0);return{left:`${C/n*100}%`,width:`${_/n*100}%`}}}};export const pinMatchesSlot=(P,t)=>{if(!P||!t)return!1;const i=typeof t=="string"?t:t.id||"",o=typeof t=="object"&&t.rawId?t.rawId:i.includes("://")?i:i.includes(":")?i.split(":").slice(1).join(":"):i,d=typeof t=="object"&&t.extName?t.extName:!i.includes("://")&&i.includes(":")?i.split(":")[0]:null;if(P.id===i||P.rawId&&P.rawId===o&&(!d||!P.extName||P.extName===d)||d&&P.id===o&&(!P.extName||P.extName===d))return!0;if(P.id&&!P.id.includes("://")&&P.id.includes(":")){const[n,l]=P.id.split(":");if(l===o&&(!d||n===d))return!0}return P.id===o&&!d};export class SutramAppShell extends j{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[A,U`
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
            background: #ffffff !important;
            color: #000000 !important;
            border: 2px solid #3b82f6 !important;
            box-shadow: 3px -3px 0 #10b981 !important;
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
        :host-context([data-theme="e-ink"]) .pos-dot.active { background: #000; box-shadow: none; }
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
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(t,i){const o=window.ExtensionRegistry||R;o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",t)&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||i()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,i,o,d="subtab"){let n=null;const l=this.shadowRoot.querySelector(".spatial-track"),m=l?l.getBoundingClientRect():{top:38,height:window.innerHeight-68};if(o==="window"){const r=t.composedPath().find(u=>u.tagName&&u.tagName.toLowerCase()==="sutram-window");if(r&&r.parentElement){const u=r.parentElement.getBoundingClientRect();n={left:u.left,top:u.top,width:u.width,height:u.height}}}else if(o){const _=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${o}"]`);if(_){const r=_.getBoundingClientRect();n={left:r.left,top:r.top,width:r.width,height:r.height}}}n||(n={left:0,top:m.top,width:window.innerWidth,height:m.height});const f=t.clientX!==void 0?t.clientX:t.touches&&t.touches[0]?t.touches[0].clientX:0,C=t.clientY!==void 0?t.clientY:t.touches&&t.touches[0]?t.touches[0].clientY:0;this._dragState={active:!1,entity:i,sourceCol:o,currentZone:null,startX:f,startY:C,currentX:f,currentY:C,originType:d,sourceRect:n},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:(_,r)=>{this._dragState&&(_!==void 0&&!isNaN(_)&&(this._dragState.currentX=_),r!==void 0&&!isNaN(r)&&(this._dragState.currentY=r)),this._activateDrag()},onPanMove:(_,r)=>{if(!this._dragState.active){const s=Math.abs(_-this._dragState.startX),w=Math.abs(r-this._dragState.startY);(s>8||w>8)&&this._activateDrag();return}this._dragState.currentX=_,this._dragState.currentY=r;let u=!1;const a=this.shadowRoot.querySelector("sutram-drag-coordinator");if(a){const s=typeof a.getHoveredZone=="function"?a.getHoveredZone(_,r):null;this._dragState.currentZone!==s&&(this._dragState.currentZone=s,u=!0),u?a.dragState={...this._dragState}:typeof a.updatePointer=="function"&&a.updatePointer(_,r)}},onPanEnd:(_,r)=>{if(this._dragState.active){const u=this._dragState.currentZone,a=this._dragState.entity,s=this._dragState.sourceCol;if(u&&window.Sutram?.stores?.Layout){const w=window.Sutram.stores.Layout.getState();if(u==="close")this._safeEvict(a.id,()=>{s==="window"?w.closeWindow(a.id):s&&w.unpinFromColumn(s,a.id),w.evictProjection(a.id);const S=window.Sutram.stores.Layout.getState(),e=S.focusedColumn||s||"center",g=S.columns[e]?.active||"";this._updateUrlHash(e,g)});else if(u==="popout"){const S=window.ExtensionRegistry||R;if(!(S?.executeUIHook?S.executeUIHook("sutram:popout-projection",a.id):!1)){const h=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",y=s&&s!=="window"?s:w.focusedColumn||"center",c=`${window.location.pathname}?popout=true#/${encodeURIComponent(h)}/${encodeURIComponent(y)}/${encodeURIComponent(a.id)}`;window.open(c,"_blank","popup=yes,width=850,height=900"),s==="window"?w.closeWindow(a.id):s&&w.unpinFromColumn(s,a.id),w.evictProjection(a.id)}}else if(u==="window"||u==="mode-window"){const S=s&&s!=="window"?s:a.anchorCol||w.focusedColumn||"center";s&&s!=="window"&&w.unpinFromColumn(s,a.id),w.openWindow(a,S,1)}else if(u==="mode-tab"&&!a?.windowOnly){const S=s&&s!=="window"?s:a.anchorCol||w.focusedColumn||"center";s==="window"&&w.closeWindow(a.id),w.columns[S]?.pinned?.some(e=>e.id===a.id)||w.pinToColumn(S,a),w.setActiveProjection(S,a.id),w.setFocusedColumn(S)}else if(u.startsWith("span-")){const S=u.split("-"),e=parseInt(S[1],10),g=S[2];s==="window"?w.updateWindowConstraints(a.id,g,e):(s&&w.unpinFromColumn(s,a.id),w.openWindow(a,g,e))}else if(u.startsWith("reorder-")){if(s){const S=parseInt(u.replace("reorder-",""),10),e=[...w.columns[s].pinned],g=e.findIndex(h=>h.id===a.id);if(g!==-1&&g!==S){const[h]=e.splice(g,1);e.splice(S,0,h),window.Sutram.stores.Layout.setState(y=>({columns:{...y.columns,[s]:{...y.columns[s],pinned:e}}}))}}}else if(["left","center","right"].includes(u)&&u!==s&&!a?.windowOnly){const S=u;s==="window"?w.closeWindow(a.id):s&&w.unpinFromColumn(s,a.id),w.pinToColumn(S,a),w.setActiveProjection(S,a.id),w.setFocusedColumn(S)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:d==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const i=this.shadowRoot.querySelector(".spatial-track");if(i){const d=this._spatialState?.capacity||3,n=this._spatialState?.mobileViewportIndex??1,l=this._spatialState?.layoutRatios||[1,1,1],m=L(d,n,l);this._isPanningTrack||(i.style.transform=`translateX(${m.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(d=>{const n=d.closest("yenvui-scrub-track");if(n&&n.shadowRoot){const l=n.shadowRoot.querySelector(".scrub-container");if(l){const m=d.getBoundingClientRect();if(m.width>0){const f=l.getBoundingClientRect();l.scrollBy({left:m.left-f.left-f.width/2+m.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,t=>{this._edgeSwipeStartX=t.touches[0].clientX,this._edgeSwipeStartY=t.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,t=>{const i=t.touches[0].clientX,o=t.touches[0].clientY,d=Math.abs(i-this._edgeSwipeStartX),n=Math.abs(o-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&d>n&&d>5&&t.cancelable&&t.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,t=>{this._launcherDropdown&&!t.composedPath().some(i=>i.classList?.contains("global-launcher-menu")||i.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),E&&(this.subscribe(E,t=>{const i=t||{};this._spatialState={capacity:i.capacity||3,focusedColumn:i.focusedColumn||"center",mobileViewportIndex:i.mobileViewportIndex??1,layoutRatios:i.layoutRatios||null,columns:i.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:i.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this._handleResize=N(()=>{const t=window.innerWidth,i=Math.min(3,Math.max(1,Math.floor(t/360))),o=E.getState();if(o&&(o.capacity||3)!==i&&typeof o.setCapacity=="function"){if(o.setCapacity(i),i===1&&o.focusedColumn){const l={left:0,center:1,right:2};o.setMobileViewport(l[o.focusedColumn]||1)}else if(i===2&&o.focusedColumn){const m={left:0,center:1,right:2}[o.focusedColumn]||1,f=m===0?0:m===2||o.mobileViewportIndex===2?2:0;o.setMobileViewport(f)}(o.windows||[]).forEach(l=>{let m=Math.min(l.span||1,i),f=l.anchorCol||"center";i===1?(m=1,f=o.focusedColumn||"center"):i===2&&f==="right"&&(f=m===2?"left":"center"),(m!==l.span||f!==l.anchorCol)&&o.updateWindowConstraints(l.id,f,m)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=N(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_getPrimaryTabColor(t){if(t&&t.intent)return`var(--intent-${t.intent})`;const i=typeof t=="string"?t:t?.id;return{context:"var(--intent-primary)",edit:"var(--intent-highlight)",diagnostics:"var(--intent-warning)",tasks:"var(--intent-warning)",ctrl:"var(--intent-danger)",dev:"var(--intent-success)",offline:"var(--text-muted)",library:"var(--intent-highlight)",cronic:"var(--intent-warning)",skills:"var(--intent-success)",practice:"var(--intent-success)"}[i?.toLowerCase()]||"var(--intent-primary)"}_getPrimaryTabIcon(t){if(t&&t.icon){const l=this._getPrimaryTabColor(t);return v`<yv-icon name="${t.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${l};"></yv-icon>`}const i=typeof t=="string"?t:t?.id,d={context:"folder-code",edit:"edit-3",diagnostics:"activity",tasks:"check-square",ctrl:"terminal",dev:"code",offline:"wifi-off",library:"book-open",cronic:"clock",skills:"award",practice:"target"}[i?.toLowerCase()]||"folder",n=this._getPrimaryTabColor(t);return v`<yv-icon name="${d}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${n};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=X.getCompiledLayout();const t=window.Sutram?.stores?.Layout;if(t){const i=t.getState();let o=!1;const d={},n={...i.columns},l=window.ExtensionRegistry||R,m=r=>typeof l._filterPredicate=="function"?l._filterPredicate(r):!0,f=this._layoutConfig.filter(r=>r.slot==="slots:sub-navigation");["left","center","right"].forEach(r=>{if(!n[r]||!n[r].pinned)return;const u=n[r].pinned.filter(a=>!a.extName||m(a.extName)).map(a=>{const s=f.find(w=>pinMatchesSlot(a,w));return s&&(a.id!==s.id&&(d[a.id]=s.id,o=!0),s.icon!==a.icon||s.label!==a.label||s.intent!==a.intent||s.rawId!==a.rawId||a.id!==s.id)?(o=!0,{...a,id:s.id,rawId:s.rawId||s.id,extName:s.extName,icon:s.icon||a.icon,label:s.label||a.label,intent:s.intent||a.intent}):a});(u.length!==n[r].pinned.length||o)&&(n[r]={...n[r],pinned:u},n[r].active&&d[n[r].active]?(n[r].active=d[n[r].active],o=!0):n[r].active&&!u.some(a=>pinMatchesSlot(a,n[r].active))&&(n[r].active=u.length>0?u[0].id:null,o=!0),Array.isArray(n[r].history)&&(n[r].history=n[r].history.map(a=>d[a]||a)))});let C=(i.windows||[]).map(r=>{const u=f.find(a=>a.id===r.id||r.extName&&a.extName===r.extName&&a.rawId===r.id);return u&&r.id!==u.id?(d[r.id]=u.id,o=!0,{...r,id:u.id,rawId:u.rawId,extName:u.extName,icon:u.icon||r.icon,label:u.label||r.label}):r}),_=(i.focusHistory||[]).map(r=>r&&r.id&&d[r.id]?(o=!0,{...r,id:d[r.id]}):r);if(o&&(t.setState({columns:n,windows:C,focusHistory:_}),window.inSetu?.stores?.App)){const r=window.inSetu.stores.App,u=r.getState().tabBrowsePaths||{};let a=!1;const s={...u};for(const[w,S]of Object.entries(d))s[w]&&(s[S]=s[w],delete s[w],a=!0);a&&r.setState({tabBrowsePaths:s})}}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_renderDropdownItem(t){let i=null;if(this._spatialState&&this._spatialState.columns){for(const o of["left","center","right"])if(this._spatialState.columns[o].pinned.some(d=>pinMatchesSlot(d,t))){i=o;break}}return v`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${o=>{const d=window.Sutram?.stores?.Layout?.getState();let n=null;if(d&&d.columns){for(const l of["left","center","right"])if(d.columns[l].pinned.some(m=>pinMatchesSlot(m,t))){n=l;break}}this._handlePointerDown(o,t,n,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const o=window.Sutram?.stores?.Layout?.getState();let d=null,n=null;if(o&&o.columns){for(const f of["left","center","right"])if(n=o.columns[f].pinned.find(C=>pinMatchesSlot(C,t)),n){d=f;break}}let l=d;const m=n?n.id:t.id;d||(l=t.preferredColumn||"center",o&&o.pinToColumn(l,t)),o&&(o.setFocusedColumn(l),o.setActiveProjection(l,m)),this._handleSubTabClick(m),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${t.icon?v`<yv-icon name="${t.icon}" style="width: 14px; height: 14px; color: ${i?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:v`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${i?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${t.label}</span>
            </button>
        `}_updateUrlHash(t,i){const o=window.ExtensionRegistry||R,d=o?.executeUIHook?o.executeUIHook("sutram:resolve-route-hash",{colId:t,subId:i}):null,n=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",l=d||`#/${n}/${t}/${encodeURIComponent(i)}`;window.location.hash!==l&&window.history.replaceState(null,"",l)}_handleSubTabClick(t){let i=null,o=!1,d=t;if(window.Sutram?.stores?.Layout){const n=window.Sutram.stores.Layout.getState();for(const l of["left","center","right"]){const m=n.columns[l]?.pinned.find(f=>pinMatchesSlot(f,t));if(m){i=l,d=m.id;break}}if(i){o=n.columns[i].active===d,n.setActiveProjection(i,d),n.setFocusedColumn(i);const l={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(l[i])}}if(o){const n=this.shadowRoot.querySelector(`[data-sub-id="${d}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${t}"]`);n&&typeof n.onForceRefresh=="function"&&n.onForceRefresh()}this.requestUpdate(),i&&this._updateUrlHash(i,d)}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const i=this.shadowRoot.querySelector(".spatial-track");i&&(i.style.transition="none")},onPanMove:(i,o,d)=>{if(d==="horizontal"){const n=i-this._dotDragController.startX,l=this._spatialState?.mobileViewportIndex??1,m=this._spatialState?.capacity||3,f=this._spatialState?.layoutRatios||[1,1,1],C=L(m,l,f),_=parseFloat(C.getTrackOffset()),r=this.shadowRoot.querySelector(".spatial-track");if(r){let u=n;const a=Math.max(0,f.length-m),s=L(m,a,f).getTrackOffset(),w=parseFloat(s);(_<=w&&n<0||_>=0&&n>0)&&(u=n*.2),r.style.transform=`translateX(calc(${_}% + ${u}px))`}}},onPanEnd:(i,o,d)=>{const n=this.shadowRoot.querySelector(".spatial-track");if(n&&(n.style.transition=""),d==="horizontal"){const l=i-this._dotDragController.startX,m=window.innerWidth*.2,f=this._spatialState?.mobileViewportIndex??1,C=this._spatialState?.capacity||3,_=this._spatialState?.layoutRatios||[1,1,1],r=Math.max(0,_.length-C);let u=f;if(l>m?u=Math.max(0,f-1):l<-m&&(u=Math.min(r,f+1)),this._isPanningTrack=!1,u!==f)this._setViewportIndex(u);else{const a=L(C,u,_);n&&(n.style.transform=`translateX(${a.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(t)}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const i=window.Sutram.stores.Layout.getState();i.setMobileViewport(t);const o=["left","center","right"];o[t]&&i.setFocusedColumn(o[t])}}render(){try{const t=new Map,i=(e,g=null,h=null)=>{if(!e)return"";const y=g?`${e}:${g}`:e;let c=this._activeNodes.get(y);if(!c)try{c=document.createElement(e)}catch{c=document.createElement("div"),c.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;";const k=document.createElement("yv-icon");k.setAttribute("name","alert-triangle"),k.style.width="14px",k.style.height="14px";const p=document.createElement("span");p.textContent=`Failed to initialize <${e}>`,c.replaceChildren(k,p)}return g&&c.dataset&&(c.dataset.subId=g),h&&typeof h=="object"&&Object.assign(c,h),t.set(y,c),c},o=window.ExtensionRegistry||R,d=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let n=this._layoutConfig.filter(e=>e.slot==="slots:primary-navigation");const l=this._layoutConfig.filter(e=>e.slot==="slots:global"),m=this._layoutConfig.filter(e=>e.slot==="slots:sub-navigation");d&&typeof o.getExtension=="function"&&(n=n.filter(e=>{const g=e.extName?o.getExtension(e.extName):null;return g&&g.offline_mode&&g.offline_mode!=="none"?!0:m.filter(y=>(y.targetParent||"").toLowerCase()===(e.id||"").toLowerCase()).some(y=>(o.getExtension(y.extName)?.offline_mode||"none")!=="none")}));const{capacity:f,mobileViewportIndex:C,focusedColumn:_}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},r=f===1?"mobile":f===2?"tablet":"desktop",u=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],a=this._spatialState.layoutRatios||[1,1,1],s=L(f,C,a);this.dataset.viewport=r;const w=this.variant==="popout";if(w){const e=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",g=e?e.split("/").map(decodeURIComponent):[],h=g.length>=3?g.slice(2).join("/"):"",y=this._spatialState?.focusedColumn||"center",c=this._spatialState?.columns?.[y],b=h||c?.active||c?.pinned?.[0]?.id;let k=m.find(x=>x.id===b||!b.includes(":")&&x.rawId===b),p=null;if(k)k.allow_popout?p=i(k.component,k.id):p=v`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <yv-icon name="alert-triangle" style="width: 36px; height: 36px; color: var(--intent-warning); margin-bottom: 16px;"></yv-icon>
                            <h3 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${k.label||k.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(b){const x=typeof o.resolveCustomEditor=="function"?o.resolveCustomEditor(b):null,I=o?.executeUIHook?o.executeUIHook("sutram:resolve-editor-component",b):null,T=x?.component||I||"sutram-editor";p=i(T,b)}const $=v`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${p||v`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${l.map(x=>i(x.component))}
                </div>
            `;return this._activeNodes=t,$}const S=v`
            <div class="shell-container spatial-viewport" data-viewport="${r}">
                ${w?"":v`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 0; padding-right: 0; ${f<a.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${e=>{f<a.length&&this._handleDotDragStart(e)}}>
                        ${r==="mobile"?v`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${e=>{if(e.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const g=n[0]?n[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:g}}this.requestUpdate()}}>
                                    <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                    <span>Tools</span>
                                    <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                                </button>
                            </div>
                        `:v`
                            <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${n.map(e=>{const g=m.filter(h=>(h.targetParent||"").toLowerCase()===e.id.toLowerCase());return v`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(e)};" @click=${h=>{if(this._launcherDropdown?.tabId===e.id)this._launcherDropdown=null;else{const y=h.currentTarget.getBoundingClientRect(),c=y.right>window.innerWidth-200;this._launcherDropdown={tabId:e.id,items:g,x:c?"auto":y.left+"px",right:c?window.innerWidth-y.right+"px":"auto",y:y.bottom+5+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(e)}${e.label}
                                        </button>
                                    `})}
                            </yenvui-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${f===1&&f<a.length?v`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,a.length-f+1)}).map((e,g)=>v`
                                    <div class="pos-dot-target" @click=${h=>{h.stopPropagation(),h.preventDefault()}} @pointerdown=${h=>{h.stopPropagation(),this._setViewportIndex(g)}} title="Jump to View ${g+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${C===g?"active":""}" style="width: ${C===g?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${C===g?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${C===g?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}
                        <!-- Top Right Utility Rail -->
                        <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: stretch; gap: 0; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 0;">
                            <slot name="header-quickpack"></slot>
                            <slot name="header-actions-left"></slot>
                            ${f>1&&f<a.length?v`
                                <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    ${Array.from({length:Math.max(1,a.length-f+1)}).map((e,g)=>v`
                                        <div class="pos-dot-target" @click=${h=>{h.stopPropagation(),h.preventDefault()}} @pointerdown=${h=>{h.stopPropagation(),this._setViewportIndex(g)}} title="Jump to View ${g+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${C===g?"active":""}" style="width: ${C===g?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${C===g?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${C===g?"1":"0.5"}; transition: all 0.2s ease;"></div>
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
                            ${n.map(e=>{const g=m.filter(h=>(h.targetParent||"").toLowerCase()===e.id.toLowerCase());return g.length===0?"":v`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(e)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(e)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${e.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${g.map(h=>{let y=null;if(this._spatialState&&this._spatialState.columns){for(const c of["left","center","right"])if(this._spatialState.columns[c].pinned.some(b=>b.id===h.id)){y=c;break}}return v`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${c=>{const b=window.Sutram?.stores?.Layout?.getState();let k=null;if(b&&b.columns){for(const p of["left","center","right"])if(b.columns[p].pinned.some($=>$.id===h.id)){k=p;break}}this._handlePointerDown(c,h,k,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const c=window.Sutram?.stores?.Layout?.getState(),{capacity:b,focusedColumn:k,mobileViewportIndex:p}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let $=null;if(c&&c.columns){for(const I of["left","center","right"])if(c.columns[I].pinned.some(T=>T.id===h.id)){$=I;break}}let x=$;$||(x=h.preferredColumn||"center",c&&c.pinToColumn(x,h)),c&&c.setFocusedColumn(x),this._handleSubTabClick(h.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${h.icon?v`<yv-icon name="${h.icon}" style="width: 14px; height: 14px; color: ${y?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:v`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${y?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${h.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:v`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(e=>this._renderDropdownItem(e))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${f}" style="${this._isPanningTrack?"":`transform: translateX(${s.getTrackOffset()});`}">
                    ${u.map((e,g)=>{let h=[],y=[e.id];y.forEach(p=>{(this._spatialState.columns&&this._spatialState.columns[p]?.pinned||[]).forEach(x=>{const I=m.find(T=>pinMatchesSlot(x,T));h.push({id:I?.id||x.id,rawId:I?.rawId||x.rawId||x.id,label:I?.label||x.label||x.title||x.id,component:I?.component||x.component,extName:I?.extName||x.extName||"fs",targetParent:I?.targetParent||x.targetParent||p,preferredColumn:I?.preferredColumn||x.preferredColumn||p,icon:I?.icon||x.icon,intent:I?.intent||x.intent,actualSourceCol:p})})}),d&&typeof o.getExtension=="function"&&(h=h.filter(p=>(o.getExtension(p.extName)?.offline_mode||"none")!=="none"));let c=null;const b=this._spatialState.focusedColumn,k=this._spatialState.columns[b]?.active;if(y.includes(b)&&(c=h.find(p=>pinMatchesSlot(p,k))),!c)for(const p of y){const $=this._spatialState.columns[p]?.active;if(c=h.find(x=>pinMatchesSlot(x,$)),c)break}return c||(c=h[0]),v`
                        <div class="spatial-col ${_===e.id&&f>1?"is-focused":""}" data-col-id="${e.id}" style="--col-width: ${s.getColWidth(g)}; --col-left: ${s.getColLeft(g)};" @click=${p=>{if(this._isPanningTrack){p.preventDefault(),p.stopPropagation();return}const $=c?c.id:h[0]?h[0].id:null,x=c&&c.actualSourceCol||e.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(x),$&&this._updateUrlHash(x,$)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${c&&c.intent?`var(--intent-${c.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${h.map(p=>{const $=c&&pinMatchesSlot(p,c.id),x=p.intent?`var(--intent-${p.intent})`:"var(--intent-primary)",I=p.icon||"component";return v`
                                        <div class="sub-tab ${$?"active":""}"
                                                style="${$?`border-bottom-color: ${x}; color: var(--text);`:""}"
                                                @pointerdown=${T=>{const D=Date.now();if(this._lastTapId===p.id&&D-(this._lastTapTime||0)<300){T.stopPropagation();const z=window.Sutram?.stores?.Layout?.getState();z&&(z.unpinFromColumn(p.actualSourceCol||e.id,p.id),z.openWindow(p,e.id,1)),this._lastTapTime=0;return}this._lastTapId=p.id,this._lastTapTime=D,this._handlePointerDown(T,p,p.actualSourceCol||e.id,"subtab")}}
                                                @dblclick=${T=>{T.stopPropagation();const D=window.Sutram?.stores?.Layout?.getState();D&&(D.unpinFromColumn(p.actualSourceCol||e.id,p.id),D.openWindow(p,e.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(p.actualSourceCol||e.id),this._handleSubTabClick(p.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${x}; opacity:${$?"1":"0.5"};">
                                                    <yv-icon name="${I}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${p.label}${o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",p.id)?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${c?this._layoutConfig.filter(p=>p.slot==="slots:sub-navigation-actions"&&(p.targetSub===c.id||p.extName===c.extName&&(p.targetSub===c.rawId||p.targetSub===`${c.extName}:${c.rawId}`))).map(p=>v`<div style="display: contents;" data-ext="${p.extName}">${i(p.component,c.id)}</div>`):""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${h.map(p=>{const $=c&&pinMatchesSlot(p,c.id),x=i(p.component,p.id);return v`
                                        <div style="display: ${$?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${p.extName}" data-offline-mode="${(typeof o.getExtension=="function"?o.getExtension(p.extName)?.offline_mode:null)||"none"}">
                                            ${x}
                                        </div>
                                    `})}
                                ${h.length===0?v`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${e.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(e=>{const h={left:0,center:1,right:2}[e.anchorCol||"center"]??1;let y=Math.min(e.span||1,3-h);y=Math.min(y,f);const c=s.getWinBounds(h,y,a);return v`
                            <div style="position: absolute; left: ${c.left}; width: ${c.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${e.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${e.label||e.id}
                                    .anchorCol=${e.anchorCol||"center"}
                                    .span=${y}
                                    .z=${e.z}
                                    .icon=${e.icon||"component"}
                                    .intent=${e.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(e.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(e.id)})}}
                                    @sutram-window-span=${b=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(e.id,e.anchorCol||"center",b.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(e.id)}
                                    @sutram-window-drag-start=${b=>this._handlePointerDown(b.detail.originalEvent,e,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(e.windowOnly)return;const b=window.Sutram?.stores?.Layout?.getState();if(b){const k=e.preferredColumn||"center";b.closeWindow(e.id),b.pinToColumn(k,e),b.setActiveProjection(k,e.id),b.setFocusedColumn(k),this.requestUpdate()}}}>
                            ${i(e.component,e.id,e.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${l.map(e=>i(e.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=t,S}catch(t){return console.error("[Telemetry] AppShell render error:",t),v`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
