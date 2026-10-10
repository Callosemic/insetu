import{html as w,css as E}from"lit";import{SutramElement as I,ExtensionRegistry as F,LayoutStore as L}from"./sutram_sdk.js";import{sharedStyles as A}from"./shared_styles.js";import{debounce as R}from"./utils.js";import{SutramProjectionCompiler as q}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as z}from"../../yenvui/js/physics.js";const D=(T,t,o)=>{const i=Array.isArray(o)&&o.length>0?o:[1,1,1],l=Math.max(0,Math.min(t,i.length-T)),c=i.slice(l,l+T).reduce((s,r)=>s+r,0)||1;return{getColWidth:s=>`${i[s]/c*100}%`,getColLeft:s=>`${i.slice(0,s).reduce((n,d)=>n+d,0)/c*100}%`,getTrackOffset:()=>`-${i.slice(0,l).reduce((r,n)=>r+n,0)/c*100}%`,getWinBounds:(s,r)=>{const n=Math.min(r,i.length-s),d=i.slice(0,s).reduce((f,b)=>f+b,0),h=i.slice(s,s+n).reduce((f,b)=>f+b,0);return{left:`${d/c*100}%`,width:`${h/c*100}%`}}}};export class SutramAppShell extends I{static properties={_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[A,E`
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
        .pan-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 29px;
            min-width: 29px;
            max-width: 29px;
            padding: 0;
            box-sizing: border-box;
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--bg-deep));
            border: none;
            color: var(--intent-primary);
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            z-index: 10;
            touch-action: none;
            transition: all 0.2s ease;
        }
        .pan-handle:hover {
            background: color-mix(in srgb, var(--intent-primary) 40%, var(--bg-deep));
            color: var(--text);
        }
        .pan-handle:active {
            cursor: grabbing;
            background: var(--intent-primary);
            color: var(--text-light, #fff);
        }
        .pan-handle.left { left: 0; }
        .pan-handle.right { right: 0; }

        /* Spatial Drop-Zone Overlay */
        .drop-zone-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 20px;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        .drop-zone-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        .drop-row {
            display: flex;
            gap: 15px;
            width: 100%;
            max-width: 800px;
            padding: 0 20px;
            box-sizing: border-box;
            justify-content: center;
        }
        .drop-target {
            flex: 1;
            height: 120px;
            border: 2px dashed var(--border);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            font-size: 1.2rem;
            font-weight: bold;
            transition: all 0.2s ease;
            background: var(--pane-bg);
        }
        .drop-target.hovered {
            border: 2px solid var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--pane-bg));
            color: var(--text);
            transform: scale(1.05);
        }
        .drop-target.source {
            border: 2px dashed var(--intent-neutral);
            background: color-mix(in srgb, var(--intent-neutral) 15%, var(--pane-bg));
            color: var(--text);
        }
        .drop-target.close-zone {
            height: 80px;
            max-width: 400px;
            border-color: var(--intent-danger);
            color: var(--intent-danger);
        }
        .drop-target.close-zone.hovered {
            background: color-mix(in srgb, var(--intent-danger) 20%, var(--pane-bg));
            color: white;
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
        .sub-tab-icon-wrapper .close-icon { display: none !important; position: absolute; }
        .sub-tab-icon-wrapper:hover {
            background: color-mix(in srgb, var(--intent-danger) 15%, transparent);
        }
        .sub-tab:hover .default-icon-container { display: none !important; }
        .sub-tab:hover .close-icon { display: flex !important; }
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(t,o){const i=window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[t];i&&i.isFS&&i.content!==i.originalContent&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||o()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,o,i,l="subtab"){let c=null;if(i==="window"){const r=t.composedPath().find(n=>n.tagName&&n.tagName.toLowerCase()==="sutram-window");if(r&&r.parentElement){const n=r.parentElement.getBoundingClientRect();c={left:n.left,top:n.top,width:n.width,height:n.height}}}else if(i){const s=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${i}"]`);if(s){const r=s.getBoundingClientRect();c={left:r.left,top:r.top,width:r.width,height:r.height}}}this._dragState={active:!1,entity:o,sourceCol:i,currentZone:null,startX:t.clientX,startY:t.clientY,currentX:t.clientX,currentY:t.clientY,originType:l,sourceRect:c},this._dragController||(this._dragController=new z(this,{longPressDelay:500,onLongPress:()=>{this._activateDrag()},onPanMove:(s,r)=>{if(!this._dragState.active){const h=Math.abs(s-this._dragState.startX),f=Math.abs(r-this._dragState.startY);(h>8||f>8)&&this._activateDrag();return}this._dragState.currentX=s,this._dragState.currentY=r;let n=!1;const d=this.shadowRoot.querySelector("sutram-drag-coordinator");if(d){const h=typeof d.getHoveredZone=="function"?d.getHoveredZone(s,r):null;this._dragState.currentZone!==h&&(this._dragState.currentZone=h,n=!0),n?d.dragState={...this._dragState}:typeof d.updatePointer=="function"&&d.updatePointer(s,r)}},onPanEnd:(s,r)=>{if(this._dragState.active){const n=this._dragState.currentZone,d=this._dragState.entity,h=this._dragState.sourceCol;if(n&&window.Sutram?.stores?.Layout){const f=window.Sutram.stores.Layout.getState();if(n==="close")this._safeEvict(d.id,()=>{h==="window"?f.closeWindow(d.id):h&&f.unpinFromColumn(h,d.id),f.evictProjection(d.id)});else if(n==="window")h==="window"?f.closeWindow(d.id):h&&f.unpinFromColumn(h,d.id),f.openWindow(d,f.focusedColumn||"center",1);else if(n.startsWith("span-")){const b=n.split("-"),v=parseInt(b[1],10),_=b[2];h==="window"?f.updateWindowConstraints(d.id,_,v):(h&&f.unpinFromColumn(h,d.id),f.openWindow(d,_,v))}else if(n.startsWith("reorder-")){if(h){const b=parseInt(n.replace("reorder-",""),10),v=[...f.columns[h].pinned],_=v.findIndex($=>$.id===d.id);if(_!==-1&&_!==b){const[$]=v.splice(_,1);v.splice(b,0,$),window.Sutram.stores.Layout.setState(e=>({columns:{...e.columns,[h]:{...e.columns[h],pinned:v}}}))}}}else if(["left","center","right"].includes(n)&&n!==h){const b=n;h==="window"?f.closeWindow(d.id):h&&f.unpinFromColumn(h,d.id),f.pinToColumn(b,d),f.setFocusedColumn(b),f.setActiveProjection(b,d.id),f.setFocusedColumn(b)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:l==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}updated(t){super.updated(t);const o=this.shadowRoot.querySelector(".spatial-track");if(o){const l=this._spatialState?.capacity||3,c=this._spatialState?.mobileViewportIndex??1,s=this._spatialState?.layoutRatios||[1,1,1],r=D(l,c,s);this._isPanningTrack||(o.style.transform=`translateX(${r.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(l=>{const c=l.closest("yenvui-scrub-track");if(c&&c.shadowRoot){const s=c.shadowRoot.querySelector(".scrub-container");if(s){const r=l.getBoundingClientRect();if(r.width>0){const n=s.getBoundingClientRect();s.scrollBy({left:r.left-n.left-n.width/2+r.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,t=>{this._edgeSwipeStartX=t.touches[0].clientX,this._edgeSwipeStartY=t.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,t=>{const o=t.touches[0].clientX,i=t.touches[0].clientY,l=Math.abs(o-this._edgeSwipeStartX),c=Math.abs(i-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&l>c&&l>5&&t.cancelable&&t.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,t=>{this._launcherDropdown&&!t.composedPath().some(o=>o.classList?.contains("global-launcher-menu")||o.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),L&&(this.subscribe(L,t=>{const o=t||{};this._spatialState={capacity:o.capacity||3,focusedColumn:o.focusedColumn||"center",mobileViewportIndex:o.mobileViewportIndex??1,layoutRatios:o.layoutRatios||null,columns:o.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:o.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this._handleResize=R(()=>{const t=window.innerWidth,o=Math.min(3,Math.max(1,Math.floor(t/360))),i=L.getState();if(i&&(i.capacity||3)!==o&&typeof i.setCapacity=="function"){if(i.setCapacity(o),o===1&&i.focusedColumn){const s={left:0,center:1,right:2};i.setMobileViewport(s[i.focusedColumn]||1)}else if(o===2&&i.focusedColumn){const r={left:0,center:1,right:2}[i.focusedColumn]||1,n=r===0?0:r===2||i.mobileViewportIndex===2?2:0;i.setMobileViewport(n)}(i.windows||[]).forEach(s=>{let r=Math.min(s.span||1,o),n=s.anchorCol||"center";o===1?(r=1,n=i.focusedColumn||"center"):o===2&&n==="right"&&(n=r===2?"left":"center"),(r!==s.span||n!==s.anchorCol)&&i.updateWindowConstraints(s.id,n,r)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=R(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_getPrimaryTabColor(t){if(t&&t.intent)return`var(--intent-${t.intent})`;const o=typeof t=="string"?t:t?.id;return{context:"var(--intent-primary)",edit:"var(--intent-highlight)",diagnostics:"var(--intent-warning)",tasks:"var(--intent-warning)",ctrl:"var(--intent-danger)",dev:"var(--intent-success)",offline:"var(--text-muted)",library:"var(--intent-highlight)",cronic:"var(--intent-warning)",skills:"var(--intent-success)",practice:"var(--intent-success)"}[o?.toLowerCase()]||"var(--intent-primary)"}_getPrimaryTabIcon(t){if(t&&t.icon){const s=this._getPrimaryTabColor(t);return w`<yv-icon name="${t.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${s};"></yv-icon>`}const o=typeof t=="string"?t:t?.id,l={context:"folder-code",edit:"edit-3",diagnostics:"activity",tasks:"check-square",ctrl:"terminal",dev:"code",offline:"wifi-off",library:"book-open",cronic:"clock",skills:"award",practice:"target"}[o?.toLowerCase()]||"folder",c=this._getPrimaryTabColor(t);return w`<yv-icon name="${l}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${c};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=q.getCompiledLayout();const t=window.Sutram?.stores?.Layout;if(t){const o=t.getState();let i=!1;const l={...o.columns},c=r=>window.inSetu?.isCore?.(r)||window.ACTIVE_EXTENSIONS?.includes(r),s=this._layoutConfig.filter(r=>r.slot==="slots:sub-navigation");["left","center","right"].forEach(r=>{if(!l[r]||!l[r].pinned)return;const n=l[r].pinned.filter(d=>!d.extName||c(d.extName)).map(d=>{const h=s.find(f=>f.id===d.id);return h&&(h.icon!==d.icon||h.label!==d.label||h.intent!==d.intent)?(i=!0,{...d,icon:h.icon,label:h.label,intent:h.intent}):d});(n.length!==l[r].pinned.length||i)&&(l[r]={...l[r],pinned:n},l[r].active&&!n.some(d=>d.id===l[r].active)&&(l[r].active=n.length>0?n[0].id:null),i=!0)}),i&&t.setState({columns:l})}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_renderDropdownItem(t){let o=null;if(this._spatialState&&this._spatialState.columns){for(const i of["left","center","right"])if(this._spatialState.columns[i].pinned.some(l=>l.id===t.id)){o=i;break}}return w`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${i=>{const l=window.Sutram?.stores?.Layout?.getState();let c=null;if(l&&l.columns){for(const s of["left","center","right"])if(l.columns[s].pinned.some(r=>r.id===t.id)){c=s;break}}this._handlePointerDown(i,t,c,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const i=window.Sutram?.stores?.Layout?.getState(),{capacity:l,focusedColumn:c,mobileViewportIndex:s}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let r=null;if(i&&i.columns){for(const d of["left","center","right"])if(i.columns[d].pinned.some(h=>h.id===t.id)){r=d;break}}let n=r;r||(n=t.preferredColumn||"center",i&&i.pinToColumn(n,t)),i&&(i.setFocusedColumn(n),i.setActiveProjection(n,t.id)),this._handleSubTabClick(t.id),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${t.icon?w`<yv-icon name="${t.icon}" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:w`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${t.label}</span>
            </button>
        `}_updateUrlHash(t,o){const i=window.inSetu?.utils?.getActiveWorkspace?window.inSetu.utils.getActiveWorkspace():"default",l=window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[o],c=l&&l.length>0?"/"+l.map(encodeURIComponent).join("/"):"",s=`#/${i}/${t}/${o}${c}`;window.location.hash!==s&&window.history.replaceState(null,"",s)}_handleSubTabClick(t){let o=null,i=!1;if(window.Sutram?.stores?.Layout){const l=window.Sutram.stores.Layout.getState();for(const c of["left","center","right"])if(l.columns[c]?.pinned.some(s=>s.id===t)){o=c;break}if(o){i=l.columns[o].active===t,l.setActiveProjection(o,t),l.setFocusedColumn(o);const c={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(c[o])}}if(i){const l=this.shadowRoot.querySelector(`[data-sub-id="${t}"]`);l&&typeof l.onForceRefresh=="function"&&l.onForceRefresh()}this.requestUpdate(),o&&this._updateUrlHash(o,t)}_handleFolderDragStart(t){t.pointerType==="mouse"&&(this._folderDragController||(this._folderDragController=new z(this,{onPanStart:()=>{const o=this.shadowRoot.querySelector(".folder-tabs-row");o&&(this._folderStartScroll=o.scrollLeft,o.style.scrollBehavior="auto",o.style.cursor="grabbing")},onPanMove:(o,i,l)=>{if(l==="horizontal"){const c=this.shadowRoot.querySelector(".folder-tabs-row");if(c){const s=o-this._folderDragController.startX;c.scrollLeft=this._folderStartScroll-s}}},onPanEnd:()=>{const o=this.shadowRoot.querySelector(".folder-tabs-row");o&&(o.style.scrollBehavior="",o.style.cursor="grab")}})),this._folderDragController.start(t))}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new z(this,{onPanStart:()=>{this._isPanningTrack=!0;const o=this.shadowRoot.querySelector(".spatial-track");o&&(o.style.transition="none")},onPanMove:(o,i,l)=>{if(l==="horizontal"){const c=o-this._dotDragController.startX,s=this._spatialState?.mobileViewportIndex??1,r=this._spatialState?.capacity||3,n=this._spatialState?.layoutRatios||[1,1,1],d=D(r,s,n),h=parseFloat(d.getTrackOffset()),f=this.shadowRoot.querySelector(".spatial-track");if(f){let b=c;const v=Math.max(0,n.length-r),_=D(r,v,n).getTrackOffset(),$=parseFloat(_);(h<=$&&c<0||h>=0&&c>0)&&(b=c*.2),f.style.transform=`translateX(calc(${h}% + ${b}px))`}}},onPanEnd:(o,i,l)=>{const c=this.shadowRoot.querySelector(".spatial-track");if(c&&(c.style.transition=""),l==="horizontal"){const s=o-this._dotDragController.startX,r=window.innerWidth*.2,n=this._spatialState?.mobileViewportIndex??1,d=this._spatialState?.capacity||3,h=this._spatialState?.layoutRatios||[1,1,1],f=Math.max(0,h.length-d);let b=n;if(s>r?b=Math.max(0,n-1):s<-r&&(b=Math.min(f,n+1)),b!==n&&this._setViewportIndex(b),this._isPanningTrack=!1,b!==n)this._setViewportIndex(b);else{const v=D(d,b,h);c&&(c.style.transform=`translateX(${v.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(t)}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();o.setMobileViewport(t);const i=["left","center","right"];i[t]&&o.setFocusedColumn(i[t])}}render(){try{const t=new Map,o=(e,g=null)=>{if(!e)return"";const p=g?`${e}:${g}`:e;let m=this._activeNodes.get(p);if(!m)try{m=document.createElement(e),g&&(m.dataset.subId=g)}catch{m=document.createElement("div"),m.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace;",m.innerText=`\u26A0\uFE0F Failed to initialize <${e}>`}return t.set(p,m),m},i=window.ExtensionRegistry||F,l=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let c=this._layoutConfig.filter(e=>e.slot==="slots:primary-navigation");const s=this._layoutConfig.filter(e=>e.slot==="slots:global"),r=this._layoutConfig.filter(e=>e.slot==="slots:sub-navigation");l&&typeof i.getExtension=="function"&&(c=c.filter(e=>{const g=e.extName?i.getExtension(e.extName):null;return g&&g.offline_mode&&g.offline_mode!=="none"?!0:r.filter(m=>(m.targetParent||"").toLowerCase()===(e.id||"").toLowerCase()).some(m=>(i.getExtension(m.extName)?.offline_mode||"none")!=="none")}));const{capacity:n,mobileViewportIndex:d,focusedColumn:h}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},f=n===1?"mobile":n===2?"tablet":"desktop",b=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],v=this._spatialState.layoutRatios||[1,1,1],_=D(n,d,v);this.dataset.viewport=f;const $=w`
            <div class="shell-container spatial-viewport" data-viewport="${f}">
                <!-- Persistent Global Launcher Row -->
                <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 2px; padding-right: 0; ${n<v.length?"touch-action: pan-y; cursor: grab;":""}"
                    @pointerdown=${e=>{n<v.length&&this._handleDotDragStart(e)}}>
                    ${f==="mobile"?w`
                        <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                            <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${e=>{if(e.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const g=c[0]?c[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:g}}this.requestUpdate()}}>
                                <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                <span>Tools</span>
                                <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                            </button>
                        </div>
                    `:w`
                        <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                            ${c.map(e=>{const g=r.filter(p=>(p.targetParent||"").toLowerCase()===e.id.toLowerCase());return w`
                                    <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(e)};" @click=${p=>{if(this._launcherDropdown?.tabId===e.id)this._launcherDropdown=null;else{const m=p.currentTarget.getBoundingClientRect(),u=m.right>window.innerWidth-200;this._launcherDropdown={tabId:e.id,items:g,x:u?"auto":m.left+"px",right:u?window.innerWidth-m.right+"px":"auto",y:m.bottom+5+"px"}}this.requestUpdate()}}>
                                        ${this._getPrimaryTabIcon(e)}${e.label}
                                    </button>
                                `})}
                        </yenvui-scrub-track>
                    `}
                    <!-- Centered Dots (1-Column Mobile View) -->
                    ${n===1&&n<v.length?w`
                        <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            ${Array.from({length:Math.max(1,v.length-n+1)}).map((e,g)=>w`
                                <div class="pos-dot-target" @click=${p=>{p.stopPropagation(),p.preventDefault()}} @pointerdown=${p=>{p.stopPropagation(),this._setViewportIndex(g)}} title="Jump to View ${g+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <div class="pos-dot ${d===g?"active":""}" style="width: ${d===g?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${d===g?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${d===g?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                </div>
                            `)}
                        </div>
                    `:""}

                    <!-- Top Right Utility Rail -->
                    <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: center; gap: 6px; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 5px;">
                        <slot name="header-quickpack"></slot>
                        <slot name="header-actions-left"></slot>
                        ${n>1&&n<v.length?w`
                            <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,v.length-n+1)}).map((e,g)=>w`
                                    <div class="pos-dot-target" @click=${p=>{p.stopPropagation(),p.preventDefault()}} @pointerdown=${p=>{p.stopPropagation(),this._setViewportIndex(g)}} title="Jump to View ${g+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${d===g?"active":""}" style="width: ${d===g?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${d===g?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${d===g?"1":"0.5"}; transition: all 0.2s ease;"></div>
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
                            ${c.map(e=>{const g=r.filter(p=>(p.targetParent||"").toLowerCase()===e.id.toLowerCase());return g.length===0?"":w`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(e)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(e)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${e.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${g.map(p=>{let m=null;if(this._spatialState&&this._spatialState.columns){for(const u of["left","center","right"])if(this._spatialState.columns[u].pinned.some(a=>a.id===p.id)){m=u;break}}return w`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${u=>{const a=window.Sutram?.stores?.Layout?.getState();let y=null;if(a&&a.columns){for(const x of["left","center","right"])if(a.columns[x].pinned.some(k=>k.id===p.id)){y=x;break}}this._handlePointerDown(u,p,y,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const u=window.Sutram?.stores?.Layout?.getState(),{capacity:a,focusedColumn:y,mobileViewportIndex:x}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let k=null;if(u&&u.columns){for(const C of["left","center","right"])if(u.columns[C].pinned.some(P=>P.id===p.id)){k=C;break}}let S=k;k||(S=p.preferredColumn||"center",u&&u.pinToColumn(S,p)),u&&u.setFocusedColumn(S),this._handleSubTabClick(p.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${p.icon?w`<yv-icon name="${p.icon}" style="width: 14px; height: 14px; color: ${m?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:w`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${m?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${p.label}</span>
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
                <div class="spatial-track capacity-${n}" style="${this._isPanningTrack?"":`transform: translateX(${_.getTrackOffset()});`}">
                    ${b.map((e,g)=>{let p=[],m=[e.id];m.forEach(a=>{(this._spatialState.columns&&this._spatialState.columns[a]?.pinned||[]).forEach(x=>{const k=r.find(S=>S.id===x.id);p.push({id:x.id,label:k?.label||x.label||x.title||x.id,component:k?.component||x.component,extName:x.extName||"fs",targetParent:x.targetParent||a,preferredColumn:x.preferredColumn||a,icon:k?.icon||x.icon,intent:k?.intent||x.intent,actualSourceCol:a})})}),l&&typeof i.getExtension=="function"&&(p=p.filter(a=>(i.getExtension(a.extName)?.offline_mode||"none")!=="none"));let u=null;if(m.includes(this._spatialState.focusedColumn)&&(u=p.find(a=>a.id===this._spatialState.columns[this._spatialState.focusedColumn]?.active)),!u){for(const a of m)if(u=p.find(y=>y.id===this._spatialState.columns[a]?.active),u)break}return u||(u=p[0]),w`
                        <div class="spatial-col ${h===e.id&&n>1?"is-focused":""}" data-col-id="${e.id}" style="--col-width: ${_.getColWidth(g)}; --col-left: ${_.getColLeft(g)};" @click=${a=>{if(this._isPanningTrack){a.preventDefault(),a.stopPropagation();return}const y=u?u.id:p[0]?p[0].id:null,x=u&&u.actualSourceCol||e.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(x),y&&this._updateUrlHash(x,y)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${u&&u.intent?`var(--intent-${u.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${p.map(a=>{const y=u&&u.id===a.id,x=a.intent?`var(--intent-${a.intent})`:"var(--intent-primary)",k=a.icon||"component";return w`
                                        <div class="sub-tab ${y?"active":""}"
                                                style="${y?`border-bottom-color: ${x}; color: var(--text);`:""}"
                                                @pointerdown=${S=>{const C=Date.now();if(this._lastTapId===a.id&&C-(this._lastTapTime||0)<300){S.stopPropagation();const P=window.Sutram?.stores?.Layout?.getState();P&&(P.unpinFromColumn(a.actualSourceCol||e.id,a.id),P.openWindow(a,e.id,1)),this._lastTapTime=0;return}this._lastTapId=a.id,this._lastTapTime=C,this._handlePointerDown(S,a,a.actualSourceCol||e.id,"subtab")}}
                                                @dblclick=${S=>{S.stopPropagation();const C=window.Sutram?.stores?.Layout?.getState();C&&(C.unpinFromColumn(a.actualSourceCol||e.id,a.id),C.openWindow(a,e.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(a.actualSourceCol||e.id),this._handleSubTabClick(a.id))}}>
                                            <div class="sub-tab-icon-wrapper" @pointerdown=${S=>S.stopPropagation()} @click=${S=>{S.stopPropagation();const C=window.Sutram?.stores?.Layout?.getState();C&&this._safeEvict(a.id,()=>{C.unpinFromColumn(a.actualSourceCol||e.id,a.id),C.evictProjection(a.id);const M=window.Sutram.stores.Layout.getState().columns[a.actualSourceCol||e.id]?.active||"";this._updateUrlHash(a.actualSourceCol||e.id,M)})}}>
                                                <div class="default-icon-container" style="color: ${x}; opacity: ${y?"1":"0.5"};">
                                                    <yv-icon name="${k}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                                <yv-icon name="x" class="close-icon" stroke-width="2.5" style="width: 14px; height: 14px; color: var(--intent-danger);"></yv-icon>
                                            </div>
                                            ${a.label}${window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[a.id]?.content!==window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[a.id]?.originalContent?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${u?this._layoutConfig.filter(a=>a.slot==="slots:sub-navigation-actions"&&a.targetSub===u.id).map(a=>w`<div style="display: contents;" data-ext="${a.extName}">${o(a.component,u.id)}</div>`):""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${p.map(a=>{const y=u&&u.id===a.id,x=o(a.component,a.id);return w`
                                        <div style="display: ${y?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${a.extName}" data-offline-mode="${(typeof i.getExtension=="function"?i.getExtension(a.extName)?.offline_mode:null)||"none"}">
                                            ${x}
                                        </div>
                                    `})}
                                ${p.length===0?w`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${e.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(e=>{const p={left:0,center:1,right:2}[e.anchorCol||"center"]??1;let m=Math.min(e.span||1,3-p);m=Math.min(m,n);const u=_.getWinBounds(p,m,v);return w`
                            <div style="position: absolute; left: ${u.left}; width: ${u.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${e.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${e.label||e.id}
                                    .anchorCol=${e.anchorCol||"center"}
                                    .span=${m}
                                    .z=${e.z}
                                    .icon=${e.icon||"component"}
                                    .intent=${e.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(e.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(e.id)})}}
                                    @sutram-window-span=${a=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(e.id,e.anchorCol||"center",a.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(e.id)}
                                    @sutram-window-drag-start=${a=>this._handlePointerDown(a.detail.originalEvent,e,"window","window-header")}
                                    @sutram-window-dock=${()=>{const a=window.Sutram?.stores?.Layout?.getState();if(a){const y=e.preferredColumn||"center";a.closeWindow(e.id),a.pinToColumn(y,e),a.setFocusedColumn(y),a.setActiveProjection(y,e.id),a.setFocusedColumn(e.preferredColumn||"center"),this.requestUpdate()}}}>
                            ${o(e.component,e.id)}
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
        `;return this._activeNodes=t,$}catch(t){return console.error("[Telemetry] AppShell render error:",t),w`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2>⚠️ AppShell Render Error</h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
