import{html as x,css as j}from"lit";import{SutramElement as A,ExtensionRegistry as R,LayoutStore as E}from"./sutram_sdk.js";import{sharedStyles as U}from"./shared_styles.js";import{debounce as N}from"./utils.js";import{SutramProjectionCompiler as X}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as M}from"../../yenvui/js/physics.js";const L=(P,t,i)=>{const o=Array.isArray(i)&&i.length>0?i:[1,1,1],c=Math.max(0,Math.min(t,o.length-P)),n=o.slice(c,c+P).reduce((d,g)=>d+g,0)||1;return{getColWidth:d=>`${o[d]/n*100}%`,getColLeft:d=>`${o.slice(0,d).reduce((f,C)=>f+C,0)/n*100}%`,getTrackOffset:()=>`-${o.slice(0,c).reduce((g,f)=>g+f,0)/n*100}%`,getWinBounds:(d,g)=>{const f=Math.min(g,o.length-d),C=o.slice(0,d).reduce((a,u)=>a+u,0),S=o.slice(d,d+f).reduce((a,u)=>a+u,0);return{left:`${C/n*100}%`,width:`${S/n*100}%`}}}};export const pinMatchesSlot=(P,t)=>{if(!P||!t)return!1;const i=typeof t=="string"?t:t.id||"",o=typeof t=="object"&&t.rawId?t.rawId:i.includes("://")?i:i.includes(":")?i.split(":").slice(1).join(":"):i,c=typeof t=="object"&&t.extName?t.extName:!i.includes("://")&&i.includes(":")?i.split(":")[0]:null;if(P.id===i||P.rawId&&P.rawId===o&&(!c||!P.extName||P.extName===c)||c&&P.id===o&&(!P.extName||P.extName===c))return!0;if(P.id&&!P.id.includes("://")&&P.id.includes(":")){const[n,d]=P.id.split(":");if(d===o&&(!c||n===c))return!0}return P.id===o&&!c};export class SutramAppShell extends A{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[U,j`
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

Click OK to discard changes and close, or Cancel to abort.`)||i()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,i,o,c="subtab"){let n=null;const d=this.shadowRoot.querySelector(".spatial-track"),g=d?d.getBoundingClientRect():{top:38,height:window.innerHeight-68};if(o==="window"){const a=t.composedPath().find(u=>u.tagName&&u.tagName.toLowerCase()==="sutram-window");if(a&&a.parentElement){const u=a.parentElement.getBoundingClientRect();n={left:u.left,top:u.top,width:u.width,height:u.height}}}else if(o){const S=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${o}"]`);if(S){const a=S.getBoundingClientRect();n={left:a.left,top:a.top,width:a.width,height:a.height}}}n||(n={left:0,top:g.top,width:window.innerWidth,height:g.height});const f=t.clientX!==void 0?t.clientX:t.touches&&t.touches[0]?t.touches[0].clientX:0,C=t.clientY!==void 0?t.clientY:t.touches&&t.touches[0]?t.touches[0].clientY:0;this._dragState={active:!1,entity:i,sourceCol:o,currentZone:null,startX:f,startY:C,currentX:f,currentY:C,originType:c,sourceRect:n},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:(S,a)=>{this._dragState&&(S!==void 0&&!isNaN(S)&&(this._dragState.currentX=S),a!==void 0&&!isNaN(a)&&(this._dragState.currentY=a)),this._activateDrag()},onPanMove:(S,a)=>{if(!this._dragState.active){const s=Math.abs(S-this._dragState.startX),w=Math.abs(a-this._dragState.startY);(s>8||w>8)&&this._activateDrag();return}this._dragState.currentX=S,this._dragState.currentY=a;let u=!1;const r=this.shadowRoot.querySelector("sutram-drag-coordinator");if(r){const s=typeof r.getHoveredZone=="function"?r.getHoveredZone(S,a):null;this._dragState.currentZone!==s&&(this._dragState.currentZone=s,u=!0),u?r.dragState={...this._dragState}:typeof r.updatePointer=="function"&&r.updatePointer(S,a)}},onPanEnd:(S,a)=>{if(this._dragState.active){const u=this._dragState.currentZone,r=this._dragState.entity,s=this._dragState.sourceCol;if(u&&window.Sutram?.stores?.Layout){const w=window.Sutram.stores.Layout.getState();if(u==="close")this._safeEvict(r.id,()=>{s==="window"?w.closeWindow(r.id):s&&w.unpinFromColumn(s,r.id),w.evictProjection(r.id);const _=window.Sutram.stores.Layout.getState(),e=_.focusedColumn||s||"center",m=_.columns[e]?.active||"";this._updateUrlHash(e,m)});else if(u==="popout"){const _=s&&s!=="window"?s:w.focusedColumn||"center";w.popoutProjection(r.id,{originCol:_})}else if(u==="window"||u==="mode-window"){const _=s&&s!=="window"?s:r.anchorCol||w.focusedColumn||"center";s&&s!=="window"&&w.unpinFromColumn(s,r.id),w.openWindow(r,_,1)}else if(u==="mode-tab"&&!r?.windowOnly){const _=s&&s!=="window"?s:r.anchorCol||w.focusedColumn||"center";s==="window"&&w.closeWindow(r.id),w.columns[_]?.pinned?.some(e=>e.id===r.id)||w.pinToColumn(_,r),w.setActiveProjection(_,r.id),w.setFocusedColumn(_)}else if(u.startsWith("span-")){const _=u.split("-"),e=parseInt(_[1],10),m=_[2];s==="window"?w.updateWindowConstraints(r.id,m,e):(s&&w.unpinFromColumn(s,r.id),w.openWindow(r,m,e))}else if(u.startsWith("reorder-")){if(s){const _=parseInt(u.replace("reorder-",""),10),e=[...w.columns[s].pinned],m=e.findIndex(l=>l.id===r.id);if(m!==-1&&m!==_){const[l]=e.splice(m,1);e.splice(_,0,l),window.Sutram.stores.Layout.setState(y=>({columns:{...y.columns,[s]:{...y.columns[s],pinned:e}}}))}}}else if(["left","center","right"].includes(u)&&u!==s&&!r?.windowOnly){const _=u;s==="window"?w.closeWindow(r.id):s&&w.unpinFromColumn(s,r.id),w.pinToColumn(_,r),w.setActiveProjection(_,r.id),w.setFocusedColumn(_)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:c==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const i=this.shadowRoot.querySelector(".spatial-track");if(i){const c=this._spatialState?.capacity||3,n=this._spatialState?.mobileViewportIndex??1,d=this._spatialState?.layoutRatios||[1,1,1],g=L(c,n,d);this._isPanningTrack||(i.style.transform=`translateX(${g.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(c=>{const n=c.closest("yenvui-scrub-track");if(n&&n.shadowRoot){const d=n.shadowRoot.querySelector(".scrub-container");if(d){const g=c.getBoundingClientRect();if(g.width>0){const f=d.getBoundingClientRect();d.scrollBy({left:g.left-f.left-f.width/2+g.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,t=>{this._edgeSwipeStartX=t.touches[0].clientX,this._edgeSwipeStartY=t.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,t=>{const i=t.touches[0].clientX,o=t.touches[0].clientY,c=Math.abs(i-this._edgeSwipeStartX),n=Math.abs(o-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&c>n&&c>5&&t.cancelable&&t.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,t=>{this._launcherDropdown&&!t.composedPath().some(i=>i.classList?.contains("global-launcher-menu")||i.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),E&&(this.subscribe(E,t=>{const i=t||{};this._spatialState={capacity:i.capacity||3,focusedColumn:i.focusedColumn||"center",mobileViewportIndex:i.mobileViewportIndex??1,layoutRatios:i.layoutRatios||null,columns:i.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:i.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this._handleResize=N(()=>{const t=window.innerWidth,i=Math.min(3,Math.max(1,Math.floor(t/360))),o=E.getState();if(o&&(o.capacity||3)!==i&&typeof o.setCapacity=="function"){if(o.setCapacity(i),i===1&&o.focusedColumn){const d={left:0,center:1,right:2};o.setMobileViewport(d[o.focusedColumn]||1)}else if(i===2&&o.focusedColumn){const g={left:0,center:1,right:2}[o.focusedColumn]||1,f=g===0?0:g===2||o.mobileViewportIndex===2?2:0;o.setMobileViewport(f)}(o.windows||[]).forEach(d=>{let g=Math.min(d.span||1,i),f=d.anchorCol||"center";i===1?(g=1,f=o.focusedColumn||"center"):i===2&&f==="right"&&(f=g===2?"left":"center"),(g!==d.span||f!==d.anchorCol)&&o.updateWindowConstraints(d.id,f,g)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=N(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_getPrimaryTabColor(t){if(t&&t.intent)return`var(--intent-${t.intent})`;const i=typeof t=="string"?t:t?.id;return{context:"var(--intent-primary)",edit:"var(--intent-highlight)",diagnostics:"var(--intent-warning)",tasks:"var(--intent-warning)",ctrl:"var(--intent-danger)",dev:"var(--intent-success)",offline:"var(--text-muted)",library:"var(--intent-highlight)",cronic:"var(--intent-warning)",skills:"var(--intent-success)",practice:"var(--intent-success)"}[i?.toLowerCase()]||"var(--intent-primary)"}_getPrimaryTabIcon(t){if(t&&t.icon){const d=this._getPrimaryTabColor(t);return x`<yv-icon name="${t.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${d};"></yv-icon>`}const i=typeof t=="string"?t:t?.id,c={context:"folder-code",edit:"edit-3",diagnostics:"activity",tasks:"check-square",ctrl:"terminal",dev:"code",offline:"wifi-off",library:"book-open",cronic:"clock",skills:"award",practice:"target"}[i?.toLowerCase()]||"folder",n=this._getPrimaryTabColor(t);return x`<yv-icon name="${c}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${n};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=X.getCompiledLayout();const t=window.Sutram?.stores?.Layout;if(t){const i=t.getState();let o=!1;const c={},n={...i.columns},d=window.ExtensionRegistry||R,g=a=>typeof d._filterPredicate=="function"?d._filterPredicate(a):!0,f=this._layoutConfig.filter(a=>a.slot==="slots:sub-navigation");["left","center","right"].forEach(a=>{if(!n[a]||!n[a].pinned)return;const u=n[a].pinned.filter(r=>!r.extName||g(r.extName)).map(r=>{const s=f.find(w=>pinMatchesSlot(r,w));return s&&(r.id!==s.id&&(c[r.id]=s.id,o=!0),s.icon!==r.icon||s.label!==r.label||s.intent!==r.intent||s.rawId!==r.rawId||r.id!==s.id)?(o=!0,{...r,id:s.id,rawId:s.rawId||s.id,extName:s.extName,icon:s.icon||r.icon,label:s.label||r.label,intent:s.intent||r.intent}):r});(u.length!==n[a].pinned.length||o)&&(n[a]={...n[a],pinned:u},n[a].active&&c[n[a].active]?(n[a].active=c[n[a].active],o=!0):n[a].active&&!u.some(r=>pinMatchesSlot(r,n[a].active))&&(n[a].active=u.length>0?u[0].id:null,o=!0),Array.isArray(n[a].history)&&(n[a].history=n[a].history.map(r=>c[r]||r)))});let C=(i.windows||[]).map(a=>{const u=f.find(r=>r.id===a.id||a.extName&&r.extName===a.extName&&r.rawId===a.id);return u&&a.id!==u.id?(c[a.id]=u.id,o=!0,{...a,id:u.id,rawId:u.rawId,extName:u.extName,icon:u.icon||a.icon,label:u.label||a.label}):a}),S=(i.focusHistory||[]).map(a=>a&&a.id&&c[a.id]?(o=!0,{...a,id:c[a.id]}):a);if(o&&(t.setState({columns:n,windows:C,focusHistory:S}),window.inSetu?.stores?.App)){const a=window.inSetu.stores.App,u=a.getState().tabBrowsePaths||{};let r=!1;const s={...u};for(const[w,_]of Object.entries(c))s[w]&&(s[_]=s[w],delete s[w],r=!0);r&&a.setState({tabBrowsePaths:s})}}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_renderDropdownItem(t){let i=null;if(this._spatialState&&this._spatialState.columns){for(const o of["left","center","right"])if(this._spatialState.columns[o].pinned.some(c=>pinMatchesSlot(c,t))){i=o;break}}return x`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${o=>{const c=window.Sutram?.stores?.Layout?.getState();let n=null;if(c&&c.columns){for(const d of["left","center","right"])if(c.columns[d].pinned.some(g=>pinMatchesSlot(g,t))){n=d;break}}this._handlePointerDown(o,t,n,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const o=window.Sutram?.stores?.Layout?.getState();let c=null,n=null;if(o&&o.columns){for(const f of["left","center","right"])if(n=o.columns[f].pinned.find(C=>pinMatchesSlot(C,t)),n){c=f;break}}let d=c;const g=n?n.id:t.id;c||(d=t.preferredColumn||"center",o&&o.pinToColumn(d,t)),o&&(o.setFocusedColumn(d),o.setActiveProjection(d,g)),this._handleSubTabClick(g),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${t.icon?x`<yv-icon name="${t.icon}" style="width: 14px; height: 14px; color: ${i?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:x`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${i?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${t.label}</span>
            </button>
        `}_updateUrlHash(t,i){const o=window.ExtensionRegistry||R,c=o?.executeUIHook?o.executeUIHook("sutram:resolve-route-hash",{colId:t,subId:i}):null,n=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",d=c||`#/${n}/${t}/${encodeURIComponent(i)}`;window.location.hash!==d&&window.history.replaceState(null,"",d)}_handleSubTabClick(t){let i=null,o=!1,c=t;if(window.Sutram?.stores?.Layout){const n=window.Sutram.stores.Layout.getState();for(const d of["left","center","right"]){const g=n.columns[d]?.pinned.find(f=>pinMatchesSlot(f,t));if(g){i=d,c=g.id;break}}if(i){o=n.columns[i].active===c,n.setActiveProjection(i,c),n.setFocusedColumn(i);const d={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(d[i])}}if(o){const n=this.shadowRoot.querySelector(`[data-sub-id="${c}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${t}"]`);n&&typeof n.onForceRefresh=="function"&&n.onForceRefresh()}this.requestUpdate(),i&&this._updateUrlHash(i,c)}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const i=this.shadowRoot.querySelector(".spatial-track");i&&(i.style.transition="none")},onPanMove:(i,o,c)=>{if(c==="horizontal"){const n=i-this._dotDragController.startX,d=this._spatialState?.mobileViewportIndex??1,g=this._spatialState?.capacity||3,f=this._spatialState?.layoutRatios||[1,1,1],C=L(g,d,f),S=parseFloat(C.getTrackOffset()),a=this.shadowRoot.querySelector(".spatial-track");if(a){let u=n;const r=Math.max(0,f.length-g),s=L(g,r,f).getTrackOffset(),w=parseFloat(s);(S<=w&&n<0||S>=0&&n>0)&&(u=n*.2),a.style.transform=`translateX(calc(${S}% + ${u}px))`}}},onPanEnd:(i,o,c)=>{const n=this.shadowRoot.querySelector(".spatial-track");if(n&&(n.style.transition=""),c==="horizontal"){const d=i-this._dotDragController.startX,g=window.innerWidth*.2,f=this._spatialState?.mobileViewportIndex??1,C=this._spatialState?.capacity||3,S=this._spatialState?.layoutRatios||[1,1,1],a=Math.max(0,S.length-C);let u=f;if(d>g?u=Math.max(0,f-1):d<-g&&(u=Math.min(a,f+1)),this._isPanningTrack=!1,u!==f)this._setViewportIndex(u);else{const r=L(C,u,S);n&&(n.style.transform=`translateX(${r.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(t)}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const i=window.Sutram.stores.Layout.getState();i.setMobileViewport(t);const o=["left","center","right"];o[t]&&i.setFocusedColumn(o[t])}}render(){try{const t=new Map,i=(e,m=null,l=null)=>{if(!e)return"";const y=m?`${e}:${m}`:e;let p=this._activeNodes.get(y);if(!p)try{p=document.createElement(e)}catch{p=document.createElement("div"),p.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;";const $=document.createElement("yv-icon");$.setAttribute("name","alert-triangle"),$.style.width="14px",$.style.height="14px";const h=document.createElement("span");h.textContent=`Failed to initialize <${e}>`,p.replaceChildren($,h)}return m&&p.dataset&&(p.dataset.subId=m),l&&typeof l=="object"&&Object.assign(p,l),t.set(y,p),p},o=window.ExtensionRegistry||R,c=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let n=this._layoutConfig.filter(e=>e.slot==="slots:primary-navigation");const d=this._layoutConfig.filter(e=>e.slot==="slots:global"),g=this._layoutConfig.filter(e=>e.slot==="slots:sub-navigation");c&&typeof o.getExtension=="function"&&(n=n.filter(e=>{const m=e.extName?o.getExtension(e.extName):null;return m&&m.offline_mode&&m.offline_mode!=="none"?!0:g.filter(y=>(y.targetParent||"").toLowerCase()===(e.id||"").toLowerCase()).some(y=>(o.getExtension(y.extName)?.offline_mode||"none")!=="none")}));const{capacity:f,mobileViewportIndex:C,focusedColumn:S}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},a=f===1?"mobile":f===2?"tablet":"desktop",u=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],r=this._spatialState.layoutRatios||[1,1,1],s=L(f,C,r);this.dataset.viewport=a;const w=this.variant==="popout";if(w){const e=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",m=e?e.split("/").map(decodeURIComponent):[];let l="";m.length>=4&&m[2]==="editor"?l=m.slice(3).join("/"):m.length>=3&&(l=m.slice(2).join("/"));const y=this._spatialState?.focusedColumn||"center",p=this._spatialState?.columns?.[y];l=l||p?.active||p?.pinned?.[0]?.id;let b=g.find(k=>k.id===l||!l.includes(":")&&k.rawId===l),$=null;if(b)b.allow_popout?$=i(b.component,b.id):$=x`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <yv-icon name="alert-triangle" style="width: 36px; height: 36px; color: var(--intent-warning); margin-bottom: 16px;"></yv-icon>
                            <h3 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${b.label||b.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(l){const k=typeof o.resolveCustomEditor=="function"?o.resolveCustomEditor(l):null,v=o?.executeUIHook?o.executeUIHook("sutram:resolve-editor-component",l):null,T=k?.component||v||"sutram-editor";$=i(T,l)}const h=x`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${$||x`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${d.map(k=>i(k.component))}
                </div>
            `;return this._activeNodes=t,h}const _=x`
            <div class="shell-container spatial-viewport" data-viewport="${a}">
                ${w?"":x`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 0; padding-right: 0; ${f<r.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${e=>{f<r.length&&this._handleDotDragStart(e)}}>
                        ${a==="mobile"?x`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${e=>{if(e.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const m=n[0]?n[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:m}}this.requestUpdate()}}>
                                    <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                    <span>Tools</span>
                                    <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                                </button>
                            </div>
                        `:x`
                            <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${n.map(e=>{const m=g.filter(l=>(l.targetParent||"").toLowerCase()===e.id.toLowerCase());return x`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(e)};" @click=${l=>{if(this._launcherDropdown?.tabId===e.id)this._launcherDropdown=null;else{const y=l.currentTarget.getBoundingClientRect(),p=y.right>window.innerWidth-200;this._launcherDropdown={tabId:e.id,items:m,x:p?"auto":y.left+"px",right:p?window.innerWidth-y.right+"px":"auto",y:y.bottom+5+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(e)}${e.label}
                                        </button>
                                    `})}
                            </yenvui-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${f===1&&f<r.length?x`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,r.length-f+1)}).map((e,m)=>x`
                                    <div class="pos-dot-target" @click=${l=>{l.stopPropagation(),l.preventDefault()}} @pointerdown=${l=>{l.stopPropagation(),this._setViewportIndex(m)}} title="Jump to View ${m+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${C===m?"active":""}" style="width: ${C===m?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${C===m?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${C===m?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}
                        <!-- Top Right Utility Rail -->
                        <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: stretch; gap: 0; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 0;">
                            <slot name="header-quickpack"></slot>
                            <slot name="header-actions-left"></slot>
                            ${f>1&&f<r.length?x`
                                <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    ${Array.from({length:Math.max(1,r.length-f+1)}).map((e,m)=>x`
                                        <div class="pos-dot-target" @click=${l=>{l.stopPropagation(),l.preventDefault()}} @pointerdown=${l=>{l.stopPropagation(),this._setViewportIndex(m)}} title="Jump to View ${m+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${C===m?"active":""}" style="width: ${C===m?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${C===m?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${C===m?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                        </div>
                                    `)}
                                </div>
                            `:""}
                            <slot name="header-actions"></slot>
                        </div>
                    </div>
                `}
                <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown?x`
                    ${this._launcherDropdown.isMobileTools?x`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${n.map(e=>{const m=g.filter(l=>(l.targetParent||"").toLowerCase()===e.id.toLowerCase());return m.length===0?"":x`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(e)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(e)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${e.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${m.map(l=>{let y=null;if(this._spatialState&&this._spatialState.columns){for(const p of["left","center","right"])if(this._spatialState.columns[p].pinned.some(b=>b.id===l.id)){y=p;break}}return x`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${p=>{const b=window.Sutram?.stores?.Layout?.getState();let $=null;if(b&&b.columns){for(const h of["left","center","right"])if(b.columns[h].pinned.some(k=>k.id===l.id)){$=h;break}}this._handlePointerDown(p,l,$,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const p=window.Sutram?.stores?.Layout?.getState(),{capacity:b,focusedColumn:$,mobileViewportIndex:h}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let k=null;if(p&&p.columns){for(const T of["left","center","right"])if(p.columns[T].pinned.some(D=>D.id===l.id)){k=T;break}}let v=k;k||(v=l.preferredColumn||"center",p&&p.pinToColumn(v,l)),p&&p.setFocusedColumn(v),this._handleSubTabClick(l.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${l.icon?x`<yv-icon name="${l.icon}" style="width: 14px; height: 14px; color: ${y?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:x`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${y?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${l.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:x`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(e=>this._renderDropdownItem(e))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${f}" style="${this._isPanningTrack?"":`transform: translateX(${s.getTrackOffset()});`}">
                    ${u.map((e,m)=>{let l=[],y=[e.id];y.forEach(h=>{(this._spatialState.columns&&this._spatialState.columns[h]?.pinned||[]).forEach(v=>{const T=g.find(D=>pinMatchesSlot(v,D));l.push({id:T?.id||v.id,rawId:T?.rawId||v.rawId||v.id,label:T?.label||v.label||v.title||v.id,component:T?.component||v.component,extName:T?.extName||v.extName||"fs",targetParent:T?.targetParent||v.targetParent||h,preferredColumn:T?.preferredColumn||v.preferredColumn||h,icon:T?.icon||v.icon,intent:T?.intent||v.intent,actualSourceCol:h})})}),c&&typeof o.getExtension=="function"&&(l=l.filter(h=>(o.getExtension(h.extName)?.offline_mode||"none")!=="none"));let p=null;const b=this._spatialState.focusedColumn,$=this._spatialState.columns[b]?.active;if(y.includes(b)&&(p=l.find(h=>pinMatchesSlot(h,$))),!p)for(const h of y){const k=this._spatialState.columns[h]?.active;if(p=l.find(v=>pinMatchesSlot(v,k)),p)break}return p||(p=l[0]),x`
                        <div class="spatial-col ${S===e.id&&f>1?"is-focused":""}" data-col-id="${e.id}" style="--col-width: ${s.getColWidth(m)}; --col-left: ${s.getColLeft(m)};" @click=${h=>{if(this._isPanningTrack){h.preventDefault(),h.stopPropagation();return}const k=p?p.id:l[0]?l[0].id:null,v=p&&p.actualSourceCol||e.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(v),k&&this._updateUrlHash(v,k)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${p&&p.intent?`var(--intent-${p.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${l.map(h=>{const k=p&&pinMatchesSlot(h,p.id),v=h.intent?`var(--intent-${h.intent})`:"var(--intent-primary)",T=h.icon||"component";return x`
                                        <div class="sub-tab ${k?"active":""}"
                                                style="${k?`border-bottom-color: ${v}; color: var(--text);`:""}"
                                                @pointerdown=${D=>{const I=Date.now();if(this._lastTapId===h.id&&I-(this._lastTapTime||0)<300){D.stopPropagation();const z=window.Sutram?.stores?.Layout?.getState();z&&(z.unpinFromColumn(h.actualSourceCol||e.id,h.id),z.openWindow(h,e.id,1)),this._lastTapTime=0;return}this._lastTapId=h.id,this._lastTapTime=I,this._handlePointerDown(D,h,h.actualSourceCol||e.id,"subtab")}}
                                                @dblclick=${D=>{D.stopPropagation();const I=window.Sutram?.stores?.Layout?.getState();I&&(I.unpinFromColumn(h.actualSourceCol||e.id,h.id),I.openWindow(h,e.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(h.actualSourceCol||e.id),this._handleSubTabClick(h.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${v}; opacity:${k?"1":"0.5"};">
                                                    <yv-icon name="${T}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${h.label}${o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",h.id)?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${p?this._layoutConfig.filter(h=>h.slot==="slots:sub-navigation-actions"&&(h.targetSub===p.id||h.extName===p.extName&&(h.targetSub===p.rawId||h.targetSub===`${p.extName}:${p.rawId}`))).map(h=>x`<div style="display: contents;" data-ext="${h.extName}">${i(h.component,p.id)}</div>`):""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${l.map(h=>{const k=p&&pinMatchesSlot(h,p.id),v=i(h.component,h.id);return x`
                                        <div style="display: ${k?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${h.extName}" data-offline-mode="${(typeof o.getExtension=="function"?o.getExtension(h.extName)?.offline_mode:null)||"none"}">
                                            ${v}
                                        </div>
                                    `})}
                                ${l.length===0?x`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${e.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(e=>{const l={left:0,center:1,right:2}[e.anchorCol||"center"]??1;let y=Math.min(e.span||1,3-l);y=Math.min(y,f);const p=s.getWinBounds(l,y,r);return x`
                            <div style="position: absolute; left: ${p.left}; width: ${p.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${e.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
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
                                    @sutram-window-dock=${()=>{if(e.windowOnly)return;const b=window.Sutram?.stores?.Layout?.getState();if(b){const $=e.preferredColumn||"center";b.closeWindow(e.id),b.pinToColumn($,e),b.setActiveProjection($,e.id),b.setFocusedColumn($),this.requestUpdate()}}}>
                            ${i(e.component,e.id,e.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${d.map(e=>i(e.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=t,_}catch(t){return console.error("[Telemetry] AppShell render error:",t),x`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
