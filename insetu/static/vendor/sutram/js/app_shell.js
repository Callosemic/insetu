import{html as w,css as E}from"lit";import{SutramElement as I,ExtensionRegistry as z,LayoutStore as L}from"./sutram_sdk.js";import{sharedStyles as F}from"./shared_styles.js";import{debounce as R}from"./utils.js";import{SutramProjectionCompiler as A}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as M}from"../../yenvui/js/physics.js";const T=(D,t,n)=>{const i=Array.isArray(n)&&n.length>0?n:[1,1,1],s=Math.max(0,Math.min(t,i.length-D)),d=i.slice(s,s+D).reduce((r,l)=>r+l,0)||1;return{getColWidth:r=>`${i[r]/d*100}%`,getColLeft:r=>`${i.slice(0,r).reduce((o,c)=>o+c,0)/d*100}%`,getTrackOffset:()=>`-${i.slice(0,s).reduce((l,o)=>l+o,0)/d*100}%`,getWinBounds:(r,l)=>{const o=Math.min(l,i.length-r),c=i.slice(0,r).reduce((f,g)=>f+g,0),u=i.slice(r,r+o).reduce((f,g)=>f+g,0);return{left:`${c/d*100}%`,width:`${u/d*100}%`}}}};export class SutramAppShell extends I{static properties={_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[F,E`
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
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(t,n){const i=window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[t];i&&i.isFS&&i.content!==i.originalContent&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||n()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,n,i,s="subtab"){let d=null;if(i==="window"){const l=t.composedPath().find(o=>o.tagName&&o.tagName.toLowerCase()==="sutram-window");if(l&&l.parentElement){const o=l.parentElement.getBoundingClientRect();d={left:o.left,top:0,width:o.width,height:window.innerHeight}}}else if(i){const r=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${i}"]`);if(r){const l=r.getBoundingClientRect();d={left:l.left,top:0,width:l.width,height:window.innerHeight}}}this._dragState={active:!1,entity:n,sourceCol:i,currentZone:null,startX:t.clientX,startY:t.clientY,currentX:t.clientX,currentY:t.clientY,originType:s,sourceRect:d},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:()=>{this._activateDrag()},onPanMove:(r,l)=>{if(!this._dragState.active){const u=Math.abs(r-this._dragState.startX),f=Math.abs(l-this._dragState.startY);(u>8||f>8)&&this._activateDrag();return}this._dragState.currentX=r,this._dragState.currentY=l;let o=!1;const c=this.shadowRoot.querySelector("sutram-drag-coordinator");if(c){const u=typeof c.getHoveredZone=="function"?c.getHoveredZone(r,l):null;this._dragState.currentZone!==u&&(this._dragState.currentZone=u,o=!0),o?c.dragState={...this._dragState}:typeof c.updatePointer=="function"&&c.updatePointer(r,l)}},onPanEnd:(r,l)=>{if(this._dragState.active){const o=this._dragState.currentZone,c=this._dragState.entity,u=this._dragState.sourceCol;if(o&&window.Sutram?.stores?.Layout){const f=window.Sutram.stores.Layout.getState();if(o==="close")this._safeEvict(c.id,()=>{u==="window"?f.closeWindow(c.id):u&&f.unpinFromColumn(u,c.id),f.evictProjection(c.id);const g=window.Sutram.stores.Layout.getState(),x=g.focusedColumn||u||"center",S=g.columns[x]?.active||"";this._updateUrlHash(x,S)});else if(o==="window")u==="window"?f.closeWindow(c.id):u&&f.unpinFromColumn(u,c.id),f.openWindow(c,f.focusedColumn||"center",1);else if(o.startsWith("span-")){const g=o.split("-"),x=parseInt(g[1],10),S=g[2];u==="window"?f.updateWindowConstraints(c.id,S,x):(u&&f.unpinFromColumn(u,c.id),f.openWindow(c,S,x))}else if(o.startsWith("reorder-")){if(u){const g=parseInt(o.replace("reorder-",""),10),x=[...f.columns[u].pinned],S=x.findIndex($=>$.id===c.id);if(S!==-1&&S!==g){const[$]=x.splice(S,1);x.splice(g,0,$),window.Sutram.stores.Layout.setState(e=>({columns:{...e.columns,[u]:{...e.columns[u],pinned:x}}}))}}}else if(["left","center","right"].includes(o)&&o!==u&&!c?.windowOnly){const g=o;u==="window"?f.closeWindow(c.id):u&&f.unpinFromColumn(u,c.id),f.pinToColumn(g,c),f.setFocusedColumn(g),f.setActiveProjection(g,c.id),f.setFocusedColumn(g)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:s==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const n=this.shadowRoot.querySelector(".spatial-track");if(n){const s=this._spatialState?.capacity||3,d=this._spatialState?.mobileViewportIndex??1,r=this._spatialState?.layoutRatios||[1,1,1],l=T(s,d,r);this._isPanningTrack||(n.style.transform=`translateX(${l.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(s=>{const d=s.closest("yenvui-scrub-track");if(d&&d.shadowRoot){const r=d.shadowRoot.querySelector(".scrub-container");if(r){const l=s.getBoundingClientRect();if(l.width>0){const o=r.getBoundingClientRect();r.scrollBy({left:l.left-o.left-o.width/2+l.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,t=>{this._edgeSwipeStartX=t.touches[0].clientX,this._edgeSwipeStartY=t.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,t=>{const n=t.touches[0].clientX,i=t.touches[0].clientY,s=Math.abs(n-this._edgeSwipeStartX),d=Math.abs(i-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&s>d&&s>5&&t.cancelable&&t.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,t=>{this._launcherDropdown&&!t.composedPath().some(n=>n.classList?.contains("global-launcher-menu")||n.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),L&&(this.subscribe(L,t=>{const n=t||{};this._spatialState={capacity:n.capacity||3,focusedColumn:n.focusedColumn||"center",mobileViewportIndex:n.mobileViewportIndex??1,layoutRatios:n.layoutRatios||null,columns:n.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:n.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this._handleResize=R(()=>{const t=window.innerWidth,n=Math.min(3,Math.max(1,Math.floor(t/360))),i=L.getState();if(i&&(i.capacity||3)!==n&&typeof i.setCapacity=="function"){if(i.setCapacity(n),n===1&&i.focusedColumn){const r={left:0,center:1,right:2};i.setMobileViewport(r[i.focusedColumn]||1)}else if(n===2&&i.focusedColumn){const l={left:0,center:1,right:2}[i.focusedColumn]||1,o=l===0?0:l===2||i.mobileViewportIndex===2?2:0;i.setMobileViewport(o)}(i.windows||[]).forEach(r=>{let l=Math.min(r.span||1,n),o=r.anchorCol||"center";n===1?(l=1,o=i.focusedColumn||"center"):n===2&&o==="right"&&(o=l===2?"left":"center"),(l!==r.span||o!==r.anchorCol)&&i.updateWindowConstraints(r.id,o,l)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=R(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_getPrimaryTabColor(t){if(t&&t.intent)return`var(--intent-${t.intent})`;const n=typeof t=="string"?t:t?.id;return{context:"var(--intent-primary)",edit:"var(--intent-highlight)",diagnostics:"var(--intent-warning)",tasks:"var(--intent-warning)",ctrl:"var(--intent-danger)",dev:"var(--intent-success)",offline:"var(--text-muted)",library:"var(--intent-highlight)",cronic:"var(--intent-warning)",skills:"var(--intent-success)",practice:"var(--intent-success)"}[n?.toLowerCase()]||"var(--intent-primary)"}_getPrimaryTabIcon(t){if(t&&t.icon){const r=this._getPrimaryTabColor(t);return w`<yv-icon name="${t.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${r};"></yv-icon>`}const n=typeof t=="string"?t:t?.id,s={context:"folder-code",edit:"edit-3",diagnostics:"activity",tasks:"check-square",ctrl:"terminal",dev:"code",offline:"wifi-off",library:"book-open",cronic:"clock",skills:"award",practice:"target"}[n?.toLowerCase()]||"folder",d=this._getPrimaryTabColor(t);return w`<yv-icon name="${s}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${d};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=A.getCompiledLayout();const t=window.Sutram?.stores?.Layout;if(t){const n=t.getState();let i=!1;const s={...n.columns},d=window.ExtensionRegistry||z,r=o=>typeof d._filterPredicate=="function"?d._filterPredicate(o):!0,l=this._layoutConfig.filter(o=>o.slot==="slots:sub-navigation");["left","center","right"].forEach(o=>{if(!s[o]||!s[o].pinned)return;const c=s[o].pinned.filter(u=>!u.extName||r(u.extName)).map(u=>{const f=l.find(g=>g.id===u.id);return f&&(f.icon!==u.icon||f.label!==u.label||f.intent!==u.intent)?(i=!0,{...u,icon:f.icon,label:f.label,intent:f.intent}):u});(c.length!==s[o].pinned.length||i)&&(s[o]={...s[o],pinned:c},s[o].active&&!c.some(u=>u.id===s[o].active)&&(s[o].active=c.length>0?c[0].id:null),i=!0)}),i&&t.setState({columns:s})}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_renderDropdownItem(t){let n=null;if(this._spatialState&&this._spatialState.columns){for(const i of["left","center","right"])if(this._spatialState.columns[i].pinned.some(s=>s.id===t.id)){n=i;break}}return w`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${i=>{const s=window.Sutram?.stores?.Layout?.getState();let d=null;if(s&&s.columns){for(const r of["left","center","right"])if(s.columns[r].pinned.some(l=>l.id===t.id)){d=r;break}}this._handlePointerDown(i,t,d,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const i=window.Sutram?.stores?.Layout?.getState(),{capacity:s,focusedColumn:d,mobileViewportIndex:r}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let l=null;if(i&&i.columns){for(const c of["left","center","right"])if(i.columns[c].pinned.some(u=>u.id===t.id)){l=c;break}}let o=l;l||(o=t.preferredColumn||"center",i&&i.pinToColumn(o,t)),i&&(i.setFocusedColumn(o),i.setActiveProjection(o,t.id)),this._handleSubTabClick(t.id),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${t.icon?w`<yv-icon name="${t.icon}" style="width: 14px; height: 14px; color: ${n?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:w`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${n?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${t.label}</span>
            </button>
        `}_updateUrlHash(t,n){const i=window.inSetu?.utils?.getActiveWorkspace?window.inSetu.utils.getActiveWorkspace():"default",s=window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[n],d=s&&s.length>0?"/"+s.map(encodeURIComponent).join("/"):"",r=`#/${i}/${t}/${n}${d}`;window.location.hash!==r&&window.history.replaceState(null,"",r)}_handleSubTabClick(t){let n=null,i=!1;if(window.Sutram?.stores?.Layout){const s=window.Sutram.stores.Layout.getState();for(const d of["left","center","right"])if(s.columns[d]?.pinned.some(r=>r.id===t)){n=d;break}if(n){i=s.columns[n].active===t,s.setActiveProjection(n,t),s.setFocusedColumn(n);const d={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(d[n])}}if(i){const s=this.shadowRoot.querySelector(`[data-sub-id="${t}"]`);s&&typeof s.onForceRefresh=="function"&&s.onForceRefresh()}this.requestUpdate(),n&&this._updateUrlHash(n,t)}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const n=this.shadowRoot.querySelector(".spatial-track");n&&(n.style.transition="none")},onPanMove:(n,i,s)=>{if(s==="horizontal"){const d=n-this._dotDragController.startX,r=this._spatialState?.mobileViewportIndex??1,l=this._spatialState?.capacity||3,o=this._spatialState?.layoutRatios||[1,1,1],c=T(l,r,o),u=parseFloat(c.getTrackOffset()),f=this.shadowRoot.querySelector(".spatial-track");if(f){let g=d;const x=Math.max(0,o.length-l),S=T(l,x,o).getTrackOffset(),$=parseFloat(S);(u<=$&&d<0||u>=0&&d>0)&&(g=d*.2),f.style.transform=`translateX(calc(${u}% + ${g}px))`}}},onPanEnd:(n,i,s)=>{const d=this.shadowRoot.querySelector(".spatial-track");if(d&&(d.style.transition=""),s==="horizontal"){const r=n-this._dotDragController.startX,l=window.innerWidth*.2,o=this._spatialState?.mobileViewportIndex??1,c=this._spatialState?.capacity||3,u=this._spatialState?.layoutRatios||[1,1,1],f=Math.max(0,u.length-c);let g=o;if(r>l?g=Math.max(0,o-1):r<-l&&(g=Math.min(f,o+1)),this._isPanningTrack=!1,g!==o)this._setViewportIndex(g);else{const x=T(c,g,u);d&&(d.style.transform=`translateX(${x.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(t)}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const n=window.Sutram.stores.Layout.getState();n.setMobileViewport(t);const i=["left","center","right"];i[t]&&n.setFocusedColumn(i[t])}}render(){try{const t=new Map,n=(e,m=null,h=null)=>{if(!e)return"";const b=m?`${e}:${m}`:e;let p=this._activeNodes.get(b);if(!p)try{p=document.createElement(e)}catch{p=document.createElement("div"),p.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace; display: flex; align-items: center; gap: 6px;",p.innerHTML=`<yv-icon name="alert-triangle" style="width: 14px; height: 14px;"></yv-icon><span>Failed to initialize &lt;${e}&gt;</span>`}return m&&p.dataset&&(p.dataset.subId=m),h&&typeof h=="object"&&Object.assign(p,h),t.set(b,p),p},i=window.ExtensionRegistry||z,s=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let d=this._layoutConfig.filter(e=>e.slot==="slots:primary-navigation");const r=this._layoutConfig.filter(e=>e.slot==="slots:global"),l=this._layoutConfig.filter(e=>e.slot==="slots:sub-navigation");s&&typeof i.getExtension=="function"&&(d=d.filter(e=>{const m=e.extName?i.getExtension(e.extName):null;return m&&m.offline_mode&&m.offline_mode!=="none"?!0:l.filter(b=>(b.targetParent||"").toLowerCase()===(e.id||"").toLowerCase()).some(b=>(i.getExtension(b.extName)?.offline_mode||"none")!=="none")}));const{capacity:o,mobileViewportIndex:c,focusedColumn:u}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},f=o===1?"mobile":o===2?"tablet":"desktop",g=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],x=this._spatialState.layoutRatios||[1,1,1],S=T(o,c,x);this.dataset.viewport=f;const $=w`
            <div class="shell-container spatial-viewport" data-viewport="${f}">
                <!-- Persistent Global Launcher Row -->
                <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 2px; padding-right: 0; ${o<x.length?"touch-action: pan-y; cursor: grab;":""}"
                    @pointerdown=${e=>{o<x.length&&this._handleDotDragStart(e)}}>
                    ${f==="mobile"?w`
                        <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                            <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${e=>{if(e.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const m=d[0]?d[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:m}}this.requestUpdate()}}>
                                <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                <span>Tools</span>
                                <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                            </button>
                        </div>
                    `:w`
                        <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                            ${d.map(e=>{const m=l.filter(h=>(h.targetParent||"").toLowerCase()===e.id.toLowerCase());return w`
                                    <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(e)};" @click=${h=>{if(this._launcherDropdown?.tabId===e.id)this._launcherDropdown=null;else{const b=h.currentTarget.getBoundingClientRect(),p=b.right>window.innerWidth-200;this._launcherDropdown={tabId:e.id,items:m,x:p?"auto":b.left+"px",right:p?window.innerWidth-b.right+"px":"auto",y:b.bottom+5+"px"}}this.requestUpdate()}}>
                                        ${this._getPrimaryTabIcon(e)}${e.label}
                                    </button>
                                `})}
                        </yenvui-scrub-track>
                    `}
                    <!-- Centered Dots (1-Column Mobile View) -->
                    ${o===1&&o<x.length?w`
                        <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            ${Array.from({length:Math.max(1,x.length-o+1)}).map((e,m)=>w`
                                <div class="pos-dot-target" @click=${h=>{h.stopPropagation(),h.preventDefault()}} @pointerdown=${h=>{h.stopPropagation(),this._setViewportIndex(m)}} title="Jump to View ${m+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <div class="pos-dot ${c===m?"active":""}" style="width: ${c===m?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${c===m?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${c===m?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                </div>
                            `)}
                        </div>
                    `:""}

                    <!-- Top Right Utility Rail -->
                    <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: center; gap: 6px; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 5px;">
                        <slot name="header-quickpack"></slot>
                        <slot name="header-actions-left"></slot>
                        ${o>1&&o<x.length?w`
                            <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,x.length-o+1)}).map((e,m)=>w`
                                    <div class="pos-dot-target" @click=${h=>{h.stopPropagation(),h.preventDefault()}} @pointerdown=${h=>{h.stopPropagation(),this._setViewportIndex(m)}} title="Jump to View ${m+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${c===m?"active":""}" style="width: ${c===m?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${c===m?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${c===m?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}
                        <slot name="header-actions"></slot>
                    </div>
                </div>
                        <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown?w`
                    ${this._launcherDropdown.isMobileTools?w`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${d.map(e=>{const m=l.filter(h=>(h.targetParent||"").toLowerCase()===e.id.toLowerCase());return m.length===0?"":w`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(e)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(e)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${e.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${m.map(h=>{let b=null;if(this._spatialState&&this._spatialState.columns){for(const p of["left","center","right"])if(this._spatialState.columns[p].pinned.some(a=>a.id===h.id)){b=p;break}}return w`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${p=>{const a=window.Sutram?.stores?.Layout?.getState();let v=null;if(a&&a.columns){for(const y of["left","center","right"])if(a.columns[y].pinned.some(_=>_.id===h.id)){v=y;break}}this._handlePointerDown(p,h,v,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const p=window.Sutram?.stores?.Layout?.getState(),{capacity:a,focusedColumn:v,mobileViewportIndex:y}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let _=null;if(p&&p.columns){for(const k of["left","center","right"])if(p.columns[k].pinned.some(P=>P.id===h.id)){_=k;break}}let C=_;_||(C=h.preferredColumn||"center",p&&p.pinToColumn(C,h)),p&&p.setFocusedColumn(C),this._handleSubTabClick(h.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${h.icon?w`<yv-icon name="${h.icon}" style="width: 14px; height: 14px; color: ${b?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:w`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${b?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${h.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:w`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(e=>this._renderDropdownItem(e))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${o}" style="${this._isPanningTrack?"":`transform: translateX(${S.getTrackOffset()});`}">
                    ${g.map((e,m)=>{let h=[],b=[e.id];b.forEach(a=>{(this._spatialState.columns&&this._spatialState.columns[a]?.pinned||[]).forEach(y=>{const _=l.find(C=>C.id===y.id);h.push({id:y.id,label:_?.label||y.label||y.title||y.id,component:_?.component||y.component,extName:y.extName||"fs",targetParent:y.targetParent||a,preferredColumn:y.preferredColumn||a,icon:_?.icon||y.icon,intent:_?.intent||y.intent,actualSourceCol:a})})}),s&&typeof i.getExtension=="function"&&(h=h.filter(a=>(i.getExtension(a.extName)?.offline_mode||"none")!=="none"));let p=null;if(b.includes(this._spatialState.focusedColumn)&&(p=h.find(a=>a.id===this._spatialState.columns[this._spatialState.focusedColumn]?.active)),!p){for(const a of b)if(p=h.find(v=>v.id===this._spatialState.columns[a]?.active),p)break}return p||(p=h[0]),w`
                        <div class="spatial-col ${u===e.id&&o>1?"is-focused":""}" data-col-id="${e.id}" style="--col-width: ${S.getColWidth(m)}; --col-left: ${S.getColLeft(m)};" @click=${a=>{if(this._isPanningTrack){a.preventDefault(),a.stopPropagation();return}const v=p?p.id:h[0]?h[0].id:null,y=p&&p.actualSourceCol||e.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(y),v&&this._updateUrlHash(y,v)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${p&&p.intent?`var(--intent-${p.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${h.map(a=>{const v=p&&p.id===a.id,y=a.intent?`var(--intent-${a.intent})`:"var(--intent-primary)",_=a.icon||"component";return w`
                                        <div class="sub-tab ${v?"active":""}"
                                                style="${v?`border-bottom-color: ${y}; color: var(--text);`:""}"
                                                @pointerdown=${C=>{const k=Date.now();if(this._lastTapId===a.id&&k-(this._lastTapTime||0)<300){C.stopPropagation();const P=window.Sutram?.stores?.Layout?.getState();P&&(P.unpinFromColumn(a.actualSourceCol||e.id,a.id),P.openWindow(a,e.id,1)),this._lastTapTime=0;return}this._lastTapId=a.id,this._lastTapTime=k,this._handlePointerDown(C,a,a.actualSourceCol||e.id,"subtab")}}
                                                @dblclick=${C=>{C.stopPropagation();const k=window.Sutram?.stores?.Layout?.getState();k&&(k.unpinFromColumn(a.actualSourceCol||e.id,a.id),k.openWindow(a,e.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(a.actualSourceCol||e.id),this._handleSubTabClick(a.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${y}; opacity:${v?"1":"0.5"};">
                                                    <yv-icon name="${_}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${a.label}${window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[a.id]?.content!==window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[a.id]?.originalContent?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${p?this._layoutConfig.filter(a=>a.slot==="slots:sub-navigation-actions"&&a.targetSub===p.id).map(a=>w`<div style="display: contents;" data-ext="${a.extName}">${n(a.component,p.id)}</div>`):""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${h.map(a=>{const v=p&&p.id===a.id,y=n(a.component,a.id);return w`
                                        <div style="display: ${v?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${a.extName}" data-offline-mode="${(typeof i.getExtension=="function"?i.getExtension(a.extName)?.offline_mode:null)||"none"}">
                                            ${y}
                                        </div>
                                    `})}
                                ${h.length===0?w`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${e.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(e=>{const h={left:0,center:1,right:2}[e.anchorCol||"center"]??1;let b=Math.min(e.span||1,3-h);b=Math.min(b,o);const p=S.getWinBounds(h,b,x);return w`
                            <div style="position: absolute; left: ${p.left}; width: ${p.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${e.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${e.label||e.id}
                                    .anchorCol=${e.anchorCol||"center"}
                                    .span=${b}
                                    .z=${e.z}
                                    .icon=${e.icon||"component"}
                                    .intent=${e.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(e.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(e.id)})}}
                                    @sutram-window-span=${a=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(e.id,e.anchorCol||"center",a.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(e.id)}
                                    @sutram-window-drag-start=${a=>this._handlePointerDown(a.detail.originalEvent,e,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(e.windowOnly)return;const a=window.Sutram?.stores?.Layout?.getState();if(a){const v=e.preferredColumn||"center";a.closeWindow(e.id),a.pinToColumn(v,e),a.setFocusedColumn(v),a.setActiveProjection(v,e.id),a.setFocusedColumn(e.preferredColumn||"center"),this.requestUpdate()}}}>
                            ${n(e.component,e.id,e.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${r.map(e=>n(e.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=t,$}catch(t){return console.error("[Telemetry] AppShell render error:",t),w`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
