import{html as y,css as A}from"lit";import{SutramElement as X,ExtensionRegistry as R,LayoutStore as N}from"./sutram_sdk.js";import{sharedStyles as j}from"./shared_styles.js";import{debounce as z}from"./utils.js";import{SutramProjectionCompiler as F}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as E}from"../../yenvui/js/physics.js";const L=(k,t,o)=>{const i=Array.isArray(o)&&o.length>0?o:[1,1,1],d=Math.max(0,Math.min(t,i.length-k)),a=i.slice(d,d+k).reduce((s,f)=>s+f,0)||1;return{getColWidth:s=>`${i[s]/a*100}%`,getColLeft:s=>`${i.slice(0,s).reduce((r,g)=>r+g,0)/a*100}%`,getTrackOffset:()=>`-${i.slice(0,d).reduce((f,r)=>f+r,0)/a*100}%`,getWinBounds:(s,f)=>{const r=Math.min(f,i.length-s),g=i.slice(0,s).reduce((n,p)=>n+p,0),x=i.slice(s,s+r).reduce((n,p)=>n+p,0);return{left:`${g/a*100}%`,width:`${x/a*100}%`}}}};export const pinMatchesSlot=(k,t)=>{if(!k||!t)return!1;const o=typeof t=="string"?t:t.id||"",i=typeof t=="object"&&t.rawId?t.rawId:o.includes("://")?o:o.includes(":")?o.split(":").slice(1).join(":"):o,d=typeof t=="object"&&t.extName?t.extName:!o.includes("://")&&o.includes(":")?o.split(":")[0]:null;if(k.id===o||k.rawId&&k.rawId===i&&(!d||!k.extName||k.extName===d)||d&&k.id===i&&(!k.extName||k.extName===d))return!0;if(k.id&&!k.id.includes("://")&&k.id.includes(":")){const[a,s]=k.id.split(":");if(s===i&&(!d||a===d))return!0}return k.id===i&&!d};export class SutramAppShell extends X{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[j,A`
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
            width: 44px;
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
            height: 44px;
            align-items: stretch !important;
        }
        .col-header {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            height: 44px;
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
            align-items: center;
            height: 36px;
            background: var(--bg-deep);
            border-bottom: 1px solid var(--border);
            padding: 0 0 0 12px;
            flex-shrink: 0;
            position: relative;
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
            width: 20px;
            height: 20px;
            margin-right: 6px;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .sub-tab-icon-wrapper .default-icon-container { display: flex !important; transition: opacity 0.2s; }
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(t,o){const i=window.ExtensionRegistry||R;i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",t)&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||o()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,o,i,d="subtab"){let a=null;if(i==="window"){const g=t.composedPath().find(x=>x.tagName&&x.tagName.toLowerCase()==="sutram-window");if(g&&g.parentElement){const x=g.parentElement.getBoundingClientRect();a={left:x.left,top:0,width:x.width,height:window.innerHeight}}}else if(i){const r=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${i}"]`);if(r){const g=r.getBoundingClientRect();a={left:g.left,top:0,width:g.width,height:window.innerHeight}}}const s=t.clientX!==void 0?t.clientX:t.touches&&t.touches[0]?t.touches[0].clientX:0,f=t.clientY!==void 0?t.clientY:t.touches&&t.touches[0]?t.touches[0].clientY:0;this._dragState={active:!1,entity:o,sourceCol:i,currentZone:null,startX:s,startY:f,currentX:s,currentY:f,originType:d,sourceRect:a},this._dragController||(this._dragController=new E(this,{longPressDelay:500,onLongPress:(r,g)=>{this._dragState&&(r!==void 0&&!isNaN(r)&&(this._dragState.currentX=r),g!==void 0&&!isNaN(g)&&(this._dragState.currentY=g)),this._activateDrag()},onPanMove:(r,g)=>{if(!this._dragState.active){const p=Math.abs(r-this._dragState.startX),l=Math.abs(g-this._dragState.startY);(p>8||l>8)&&this._activateDrag();return}this._dragState.currentX=r,this._dragState.currentY=g;let x=!1;const n=this.shadowRoot.querySelector("sutram-drag-coordinator");if(n){const p=typeof n.getHoveredZone=="function"?n.getHoveredZone(r,g):null;this._dragState.currentZone!==p&&(this._dragState.currentZone=p,x=!0),x?n.dragState={...this._dragState}:typeof n.updatePointer=="function"&&n.updatePointer(r,g)}},onPanEnd:(r,g)=>{if(this._dragState.active){const x=this._dragState.currentZone,n=this._dragState.entity,p=this._dragState.sourceCol;if(x&&window.Sutram?.stores?.Layout){const l=window.Sutram.stores.Layout.getState();if(x==="close")this._safeEvict(n.id,()=>{p==="window"?l.closeWindow(n.id):p&&l.unpinFromColumn(p,n.id),l.evictProjection(n.id);const m=window.Sutram.stores.Layout.getState(),_=m.focusedColumn||p||"center",P=m.columns[_]?.active||"";this._updateUrlHash(_,P)});else if(x==="window")p==="window"?l.closeWindow(n.id):p&&l.unpinFromColumn(p,n.id),l.openWindow(n,l.focusedColumn||"center",1);else if(x.startsWith("span-")){const m=x.split("-"),_=parseInt(m[1],10),P=m[2];p==="window"?l.updateWindowConstraints(n.id,P,_):(p&&l.unpinFromColumn(p,n.id),l.openWindow(n,P,_))}else if(x.startsWith("reorder-")){if(p){const m=parseInt(x.replace("reorder-",""),10),_=[...l.columns[p].pinned],P=_.findIndex(e=>e.id===n.id);if(P!==-1&&P!==m){const[e]=_.splice(P,1);_.splice(m,0,e),window.Sutram.stores.Layout.setState(w=>({columns:{...w.columns,[p]:{...w.columns[p],pinned:_}}}))}}}else if(["left","center","right"].includes(x)&&x!==p&&!n?.windowOnly){const m=x;p==="window"?l.closeWindow(n.id):p&&l.unpinFromColumn(p,n.id),l.pinToColumn(m,n),l.setFocusedColumn(m),l.setActiveProjection(m,n.id),l.setFocusedColumn(m)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:d==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const o=this.shadowRoot.querySelector(".spatial-track");if(o){const d=this._spatialState?.capacity||3,a=this._spatialState?.mobileViewportIndex??1,s=this._spatialState?.layoutRatios||[1,1,1],f=L(d,a,s);this._isPanningTrack||(o.style.transform=`translateX(${f.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(d=>{const a=d.closest("yenvui-scrub-track");if(a&&a.shadowRoot){const s=a.shadowRoot.querySelector(".scrub-container");if(s){const f=d.getBoundingClientRect();if(f.width>0){const r=s.getBoundingClientRect();s.scrollBy({left:f.left-r.left-r.width/2+f.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,t=>{this._edgeSwipeStartX=t.touches[0].clientX,this._edgeSwipeStartY=t.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,t=>{const o=t.touches[0].clientX,i=t.touches[0].clientY,d=Math.abs(o-this._edgeSwipeStartX),a=Math.abs(i-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&d>a&&d>5&&t.cancelable&&t.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,t=>{this._launcherDropdown&&!t.composedPath().some(o=>o.classList?.contains("global-launcher-menu")||o.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),N&&(this.subscribe(N,t=>{const o=t||{};this._spatialState={capacity:o.capacity||3,focusedColumn:o.focusedColumn||"center",mobileViewportIndex:o.mobileViewportIndex??1,layoutRatios:o.layoutRatios||null,columns:o.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:o.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this._handleResize=z(()=>{const t=window.innerWidth,o=Math.min(3,Math.max(1,Math.floor(t/360))),i=N.getState();if(i&&(i.capacity||3)!==o&&typeof i.setCapacity=="function"){if(i.setCapacity(o),o===1&&i.focusedColumn){const s={left:0,center:1,right:2};i.setMobileViewport(s[i.focusedColumn]||1)}else if(o===2&&i.focusedColumn){const f={left:0,center:1,right:2}[i.focusedColumn]||1,r=f===0?0:f===2||i.mobileViewportIndex===2?2:0;i.setMobileViewport(r)}(i.windows||[]).forEach(s=>{let f=Math.min(s.span||1,o),r=s.anchorCol||"center";o===1?(f=1,r=i.focusedColumn||"center"):o===2&&r==="right"&&(r=f===2?"left":"center"),(f!==s.span||r!==s.anchorCol)&&i.updateWindowConstraints(s.id,r,f)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=z(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_getPrimaryTabColor(t){if(t&&t.intent)return`var(--intent-${t.intent})`;const o=typeof t=="string"?t:t?.id;return{context:"var(--intent-primary)",edit:"var(--intent-highlight)",diagnostics:"var(--intent-warning)",tasks:"var(--intent-warning)",ctrl:"var(--intent-danger)",dev:"var(--intent-success)",offline:"var(--text-muted)",library:"var(--intent-highlight)",cronic:"var(--intent-warning)",skills:"var(--intent-success)",practice:"var(--intent-success)"}[o?.toLowerCase()]||"var(--intent-primary)"}_getPrimaryTabIcon(t){if(t&&t.icon){const s=this._getPrimaryTabColor(t);return y`<yv-icon name="${t.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${s};"></yv-icon>`}const o=typeof t=="string"?t:t?.id,d={context:"folder-code",edit:"edit-3",diagnostics:"activity",tasks:"check-square",ctrl:"terminal",dev:"code",offline:"wifi-off",library:"book-open",cronic:"clock",skills:"award",practice:"target"}[o?.toLowerCase()]||"folder",a=this._getPrimaryTabColor(t);return y`<yv-icon name="${d}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${a};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=F.getCompiledLayout();const t=window.Sutram?.stores?.Layout;if(t){const o=t.getState();let i=!1;const d={},a={...o.columns},s=window.ExtensionRegistry||R,f=n=>typeof s._filterPredicate=="function"?s._filterPredicate(n):!0,r=this._layoutConfig.filter(n=>n.slot==="slots:sub-navigation");["left","center","right"].forEach(n=>{if(!a[n]||!a[n].pinned)return;const p=a[n].pinned.filter(l=>!l.extName||f(l.extName)).map(l=>{const m=r.find(_=>pinMatchesSlot(l,_));return m&&(l.id!==m.id&&(d[l.id]=m.id,i=!0),m.icon!==l.icon||m.label!==l.label||m.intent!==l.intent||m.rawId!==l.rawId||l.id!==m.id)?(i=!0,{...l,id:m.id,rawId:m.rawId||m.id,extName:m.extName,icon:m.icon||l.icon,label:m.label||l.label,intent:m.intent||l.intent}):l});(p.length!==a[n].pinned.length||i)&&(a[n]={...a[n],pinned:p},a[n].active&&d[a[n].active]?(a[n].active=d[a[n].active],i=!0):a[n].active&&!p.some(l=>pinMatchesSlot(l,a[n].active))&&(a[n].active=p.length>0?p[0].id:null,i=!0),Array.isArray(a[n].history)&&(a[n].history=a[n].history.map(l=>d[l]||l)))});let g=(o.windows||[]).map(n=>{const p=r.find(l=>l.id===n.id||n.extName&&l.extName===n.extName&&l.rawId===n.id);return p&&n.id!==p.id?(d[n.id]=p.id,i=!0,{...n,id:p.id,rawId:p.rawId,extName:p.extName,icon:p.icon||n.icon,label:p.label||n.label}):n}),x=(o.focusHistory||[]).map(n=>n&&n.id&&d[n.id]?(i=!0,{...n,id:d[n.id]}):n);if(i&&(t.setState({columns:a,windows:g,focusHistory:x}),window.inSetu?.stores?.App)){const n=window.inSetu.stores.App,p=n.getState().tabBrowsePaths||{};let l=!1;const m={...p};for(const[_,P]of Object.entries(d))m[_]&&(m[P]=m[_],delete m[_],l=!0);l&&n.setState({tabBrowsePaths:m})}}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_renderDropdownItem(t){let o=null;if(this._spatialState&&this._spatialState.columns){for(const i of["left","center","right"])if(this._spatialState.columns[i].pinned.some(d=>pinMatchesSlot(d,t))){o=i;break}}return y`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${i=>{const d=window.Sutram?.stores?.Layout?.getState();let a=null;if(d&&d.columns){for(const s of["left","center","right"])if(d.columns[s].pinned.some(f=>pinMatchesSlot(f,t))){a=s;break}}this._handlePointerDown(i,t,a,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const i=window.Sutram?.stores?.Layout?.getState();let d=null,a=null;if(i&&i.columns){for(const r of["left","center","right"])if(a=i.columns[r].pinned.find(g=>pinMatchesSlot(g,t)),a){d=r;break}}let s=d;const f=a?a.id:t.id;d||(s=t.preferredColumn||"center",i&&i.pinToColumn(s,t)),i&&(i.setFocusedColumn(s),i.setActiveProjection(s,f)),this._handleSubTabClick(f),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${t.icon?y`<yv-icon name="${t.icon}" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:y`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${t.label}</span>
            </button>
        `}_updateUrlHash(t,o){const i=window.ExtensionRegistry||R,d=i?.executeUIHook?i.executeUIHook("sutram:resolve-route-hash",{colId:t,subId:o}):null,a=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",s=d||`#/${a}/${t}/${encodeURIComponent(o)}`;window.location.hash!==s&&window.history.replaceState(null,"",s)}_handleSubTabClick(t){let o=null,i=!1,d=t;if(window.Sutram?.stores?.Layout){const a=window.Sutram.stores.Layout.getState();for(const s of["left","center","right"]){const f=a.columns[s]?.pinned.find(r=>pinMatchesSlot(r,t));if(f){o=s,d=f.id;break}}if(o){i=a.columns[o].active===d,a.setActiveProjection(o,d),a.setFocusedColumn(o);const s={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(s[o])}}if(i){const a=this.shadowRoot.querySelector(`[data-sub-id="${d}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${t}"]`);a&&typeof a.onForceRefresh=="function"&&a.onForceRefresh()}this.requestUpdate(),o&&this._updateUrlHash(o,d)}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new E(this,{onPanStart:()=>{this._isPanningTrack=!0;const o=this.shadowRoot.querySelector(".spatial-track");o&&(o.style.transition="none")},onPanMove:(o,i,d)=>{if(d==="horizontal"){const a=o-this._dotDragController.startX,s=this._spatialState?.mobileViewportIndex??1,f=this._spatialState?.capacity||3,r=this._spatialState?.layoutRatios||[1,1,1],g=L(f,s,r),x=parseFloat(g.getTrackOffset()),n=this.shadowRoot.querySelector(".spatial-track");if(n){let p=a;const l=Math.max(0,r.length-f),m=L(f,l,r).getTrackOffset(),_=parseFloat(m);(x<=_&&a<0||x>=0&&a>0)&&(p=a*.2),n.style.transform=`translateX(calc(${x}% + ${p}px))`}}},onPanEnd:(o,i,d)=>{const a=this.shadowRoot.querySelector(".spatial-track");if(a&&(a.style.transition=""),d==="horizontal"){const s=o-this._dotDragController.startX,f=window.innerWidth*.2,r=this._spatialState?.mobileViewportIndex??1,g=this._spatialState?.capacity||3,x=this._spatialState?.layoutRatios||[1,1,1],n=Math.max(0,x.length-g);let p=r;if(s>f?p=Math.max(0,r-1):s<-f&&(p=Math.min(n,r+1)),this._isPanningTrack=!1,p!==r)this._setViewportIndex(p);else{const l=L(g,p,x);a&&(a.style.transform=`translateX(${l.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(t)}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();o.setMobileViewport(t);const i=["left","center","right"];i[t]&&o.setFocusedColumn(i[t])}}render(){try{const t=new Map,o=(e,w=null,h=null)=>{if(!e)return"";const S=w?`${e}:${w}`:e;let c=this._activeNodes.get(S);if(!c)try{c=document.createElement(e)}catch{c=document.createElement("div"),c.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;",c.innerHTML=`<yv-icon name="alert-triangle" style="width: 14px; height: 14px;"></yv-icon><span>Failed to initialize &lt;${e}&gt;</span>`}return w&&c.dataset&&(c.dataset.subId=w),h&&typeof h=="object"&&Object.assign(c,h),t.set(S,c),c},i=window.ExtensionRegistry||R,d=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let a=this._layoutConfig.filter(e=>e.slot==="slots:primary-navigation");const s=this._layoutConfig.filter(e=>e.slot==="slots:global"),f=this._layoutConfig.filter(e=>e.slot==="slots:sub-navigation");d&&typeof i.getExtension=="function"&&(a=a.filter(e=>{const w=e.extName?i.getExtension(e.extName):null;return w&&w.offline_mode&&w.offline_mode!=="none"?!0:f.filter(S=>(S.targetParent||"").toLowerCase()===(e.id||"").toLowerCase()).some(S=>(i.getExtension(S.extName)?.offline_mode||"none")!=="none")}));const{capacity:r,mobileViewportIndex:g,focusedColumn:x}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},n=r===1?"mobile":r===2?"tablet":"desktop",p=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],l=this._spatialState.layoutRatios||[1,1,1],m=L(r,g,l);this.dataset.viewport=n;const _=this.variant==="popout";if(_){const e=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",w=e?e.split("/").map(decodeURIComponent):[],h=w.length>=3?w.slice(2).join("/"):"",S=this._spatialState?.focusedColumn||"center",c=this._spatialState?.columns?.[S],v=h||c?.active||c?.pinned?.[0]?.id;let T=f.find(b=>b.id===v||!v.includes(":")&&b.rawId===v),u=null;T?u=o(T.component,T.id):v&&(u=o("insetu-editor-projection",v));const C=y`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${u||y`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${s.map(b=>o(b.component))}
                </div>
            `;return this._activeNodes=t,C}const P=y`
            <div class="shell-container spatial-viewport" data-viewport="${n}">
                ${_?"":y`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 2px; padding-right: 0; ${r<l.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${e=>{r<l.length&&this._handleDotDragStart(e)}}>
                        ${n==="mobile"?y`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${e=>{if(e.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const w=a[0]?a[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:w}}this.requestUpdate()}}>
                                    <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                    <span>Tools</span>
                                    <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                                </button>
                            </div>
                        `:y`
                            <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${a.map(e=>{const w=f.filter(h=>(h.targetParent||"").toLowerCase()===e.id.toLowerCase());return y`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(e)};" @click=${h=>{if(this._launcherDropdown?.tabId===e.id)this._launcherDropdown=null;else{const S=h.currentTarget.getBoundingClientRect(),c=S.right>window.innerWidth-200;this._launcherDropdown={tabId:e.id,items:w,x:c?"auto":S.left+"px",right:c?window.innerWidth-S.right+"px":"auto",y:S.bottom+5+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(e)}${e.label}
                                        </button>
                                    `})}
                            </yenvui-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${r===1&&r<l.length?y`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,l.length-r+1)}).map((e,w)=>y`
                                    <div class="pos-dot-target" @click=${h=>{h.stopPropagation(),h.preventDefault()}} @pointerdown=${h=>{h.stopPropagation(),this._setViewportIndex(w)}} title="Jump to View ${w+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${g===w?"active":""}" style="width: ${g===w?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${g===w?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${g===w?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}

                        <!-- Top Right Utility Rail -->
                        <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: center; gap: 6px; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 5px;">
                            <slot name="header-quickpack"></slot>
                            <slot name="header-actions-left"></slot>
                            ${r>1&&r<l.length?y`
                                <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    ${Array.from({length:Math.max(1,l.length-r+1)}).map((e,w)=>y`
                                        <div class="pos-dot-target" @click=${h=>{h.stopPropagation(),h.preventDefault()}} @pointerdown=${h=>{h.stopPropagation(),this._setViewportIndex(w)}} title="Jump to View ${w+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${g===w?"active":""}" style="width: ${g===w?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${g===w?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${g===w?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                        </div>
                                    `)}
                                </div>
                            `:""}
                            <slot name="header-actions"></slot>
                        </div>
                    </div>
                `}
                <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown?y`
                    ${this._launcherDropdown.isMobileTools?y`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${a.map(e=>{const w=f.filter(h=>(h.targetParent||"").toLowerCase()===e.id.toLowerCase());return w.length===0?"":y`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(e)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(e)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${e.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${w.map(h=>{let S=null;if(this._spatialState&&this._spatialState.columns){for(const c of["left","center","right"])if(this._spatialState.columns[c].pinned.some(v=>v.id===h.id)){S=c;break}}return y`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${c=>{const v=window.Sutram?.stores?.Layout?.getState();let T=null;if(v&&v.columns){for(const u of["left","center","right"])if(v.columns[u].pinned.some(C=>C.id===h.id)){T=u;break}}this._handlePointerDown(c,h,T,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const c=window.Sutram?.stores?.Layout?.getState(),{capacity:v,focusedColumn:T,mobileViewportIndex:u}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let C=null;if(c&&c.columns){for(const $ of["left","center","right"])if(c.columns[$].pinned.some(D=>D.id===h.id)){C=$;break}}let b=C;C||(b=h.preferredColumn||"center",c&&c.pinToColumn(b,h)),c&&c.setFocusedColumn(b),this._handleSubTabClick(h.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${h.icon?y`<yv-icon name="${h.icon}" style="width: 14px; height: 14px; color: ${S?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:y`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${S?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${h.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:y`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(e=>this._renderDropdownItem(e))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${r}" style="${this._isPanningTrack?"":`transform: translateX(${m.getTrackOffset()});`}">
                    ${p.map((e,w)=>{let h=[],S=[e.id];S.forEach(u=>{(this._spatialState.columns&&this._spatialState.columns[u]?.pinned||[]).forEach(b=>{const $=f.find(D=>pinMatchesSlot(b,D));h.push({id:$?.id||b.id,rawId:$?.rawId||b.rawId||b.id,label:$?.label||b.label||b.title||b.id,component:$?.component||b.component,extName:$?.extName||b.extName||"fs",targetParent:$?.targetParent||b.targetParent||u,preferredColumn:$?.preferredColumn||b.preferredColumn||u,icon:$?.icon||b.icon,intent:$?.intent||b.intent,actualSourceCol:u})})}),d&&typeof i.getExtension=="function"&&(h=h.filter(u=>(i.getExtension(u.extName)?.offline_mode||"none")!=="none"));let c=null;const v=this._spatialState.focusedColumn,T=this._spatialState.columns[v]?.active;if(S.includes(v)&&(c=h.find(u=>pinMatchesSlot(u,T))),!c)for(const u of S){const C=this._spatialState.columns[u]?.active;if(c=h.find(b=>pinMatchesSlot(b,C)),c)break}return c||(c=h[0]),y`
                        <div class="spatial-col ${x===e.id&&r>1?"is-focused":""}" data-col-id="${e.id}" style="--col-width: ${m.getColWidth(w)}; --col-left: ${m.getColLeft(w)};" @click=${u=>{if(this._isPanningTrack){u.preventDefault(),u.stopPropagation();return}const C=c?c.id:h[0]?h[0].id:null,b=c&&c.actualSourceCol||e.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(b),C&&this._updateUrlHash(b,C)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${c&&c.intent?`var(--intent-${c.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${h.map(u=>{const C=c&&pinMatchesSlot(u,c.id),b=u.intent?`var(--intent-${u.intent})`:"var(--intent-primary)",$=u.icon||"component";return y`
                                        <div class="sub-tab ${C?"active":""}"
                                                style="${C?`border-bottom-color: ${b}; color: var(--text);`:""}"
                                                @pointerdown=${D=>{const I=Date.now();if(this._lastTapId===u.id&&I-(this._lastTapTime||0)<300){D.stopPropagation();const M=window.Sutram?.stores?.Layout?.getState();M&&(M.unpinFromColumn(u.actualSourceCol||e.id,u.id),M.openWindow(u,e.id,1)),this._lastTapTime=0;return}this._lastTapId=u.id,this._lastTapTime=I,this._handlePointerDown(D,u,u.actualSourceCol||e.id,"subtab")}}
                                                @dblclick=${D=>{D.stopPropagation();const I=window.Sutram?.stores?.Layout?.getState();I&&(I.unpinFromColumn(u.actualSourceCol||e.id,u.id),I.openWindow(u,e.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(u.actualSourceCol||e.id),this._handleSubTabClick(u.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${b}; opacity:${C?"1":"0.5"};">
                                                    <yv-icon name="${$}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${u.label}${i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",u.id)?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${c?this._layoutConfig.filter(u=>u.slot==="slots:sub-navigation-actions"&&(u.targetSub===c.id||u.extName===c.extName&&(u.targetSub===c.rawId||u.targetSub===`${c.extName}:${c.rawId}`))).map(u=>y`<div style="display: contents;" data-ext="${u.extName}">${o(u.component,c.id)}</div>`):""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${h.map(u=>{const C=c&&pinMatchesSlot(u,c.id),b=o(u.component,u.id);return y`
                                        <div style="display: ${C?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${u.extName}" data-offline-mode="${(typeof i.getExtension=="function"?i.getExtension(u.extName)?.offline_mode:null)||"none"}">
                                            ${b}
                                        </div>
                                    `})}
                                ${h.length===0?y`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${e.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(e=>{const h={left:0,center:1,right:2}[e.anchorCol||"center"]??1;let S=Math.min(e.span||1,3-h);S=Math.min(S,r);const c=m.getWinBounds(h,S,l);return y`
                            <div style="position: absolute; left: ${c.left}; width: ${c.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${e.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${e.label||e.id}
                                    .anchorCol=${e.anchorCol||"center"}
                                    .span=${S}
                                    .z=${e.z}
                                    .icon=${e.icon||"component"}
                                    .intent=${e.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(e.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(e.id)})}}
                                    @sutram-window-span=${v=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(e.id,e.anchorCol||"center",v.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(e.id)}
                                    @sutram-window-drag-start=${v=>this._handlePointerDown(v.detail.originalEvent,e,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(e.windowOnly)return;const v=window.Sutram?.stores?.Layout?.getState();if(v){const T=e.preferredColumn||"center";v.closeWindow(e.id),v.pinToColumn(T,e),v.setFocusedColumn(T),v.setActiveProjection(T,e.id),v.setFocusedColumn(e.preferredColumn||"center"),this.requestUpdate()}}}>
                            ${o(e.component,e.id,e.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${s.map(e=>o(e.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=t,P}catch(t){return console.error("[Telemetry] AppShell render error:",t),y`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
