import{html as b,css as I}from"lit";import{SutramElement as E,ExtensionRegistry as M,LayoutStore as P}from"./sutram_sdk.js";import{sharedStyles as X}from"./shared_styles.js";import{debounce as z}from"./utils.js";import{SutramProjectionCompiler as F}from"./projection_engine.js";import"./drag-coordinator.js";import"../../yenvui/js/tabs.js";import{YenvuiGestureController as L,getDeepElementFromPoint as R}from"../../yenvui/js/physics.js";export class SutramAppShell extends E{static properties={_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[X,I`
        :host {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - 30px); /* Account for global status bar */
            width: 100vw;
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
            display: flex;
            flex: 1;
            min-height: 0;
            transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
            width: 100%;
        }

        /* Responsive Viewport States */
        :host([data-viewport="mobile"]) .spatial-track, [data-viewport="mobile"] .spatial-track {
            width: 300% !important;
        }
        :host([data-viewport="mobile"]) .spatial-col, [data-viewport="mobile"] .spatial-col {
            width: 33.333333% !important;
            min-width: 33.333333% !important;
            max-width: 33.333333% !important;
            flex-shrink: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: none;
        }

        :host([data-viewport="tablet"]) .spatial-track, [data-viewport="tablet"] .spatial-track {
            width: 150% !important;
        }
        :host([data-viewport="tablet"]) .spatial-col, [data-viewport="tablet"] .spatial-col {
            width: 33.333333% !important;
            min-width: 33.333333% !important;
            max-width: 33.333333% !important;
            flex-shrink: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: 1px solid var(--border);
        }

        :host([data-viewport="desktop"]) .spatial-track, [data-viewport="desktop"] .spatial-track {
            width: 100% !important;
            transform: translateX(0) !important;
        }
        :host([data-viewport="desktop"]) .spatial-col, [data-viewport="desktop"] .spatial-col {
            flex: 1 !important;
            width: 33.333333% !important;
            min-width: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-right: 1px solid var(--border);
        }
        .spatial-col {
            container-type: inline-size;
            overscroll-behavior-x: none;
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
        :host([data-viewport="mobile"]) .mobile-dots-wrapper, [data-viewport="mobile"] .mobile-dots-wrapper { display: flex !important; }
        :host([data-viewport="desktop"]) .desktop-only-folders, :host([data-viewport="tablet"]) .desktop-only-folders,
        [data-viewport="desktop"] .desktop-only-folders, [data-viewport="tablet"] .desktop-only-folders { display: flex !important; }
        :host([data-viewport="desktop"]) .mobile-only-tools, :host([data-viewport="tablet"]) .mobile-only-tools,
        [data-viewport="desktop"] .mobile-only-tools, [data-viewport="tablet"] .mobile-only-tools { display: none !important; }
        :host([data-viewport="desktop"]) .mobile-dots-wrapper, :host([data-viewport="tablet"]) .mobile-dots-wrapper,
        [data-viewport="desktop"] .mobile-dots-wrapper, [data-viewport="tablet"] .mobile-dots-wrapper { display: none !important; }
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
    `];constructor(){super(),this._layoutConfig=[],this._activeNodes=new Map,this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(t,o){const n=window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[t];n&&n.isFS&&n.content!==n.originalContent&&!confirm(`You have unsaved changes in ${t.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||o()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(t,o,n,a="subtab"){let d=null;if(n==="window"){const l=t.composedPath().find(r=>r.tagName&&r.tagName.toLowerCase()==="sutram-window");if(l&&l.parentElement){const r=l.parentElement.getBoundingClientRect();d={left:r.left,top:r.top,width:r.width,height:r.height}}}else if(n){const c=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${n}"]`);if(c){const l=c.getBoundingClientRect();d={left:l.left,top:l.top,width:l.width,height:l.height}}}this._dragState={active:!1,entity:o,sourceCol:n,currentZone:null,startX:t.clientX,startY:t.clientY,currentX:t.clientX,currentY:t.clientY,originType:a,sourceRect:d},this._dragController||(this._dragController=new L(this,{longPressDelay:500,onLongPress:()=>{this._activateDrag()},onPanMove:(c,l)=>{if(!this._dragState.active){const f=Math.abs(c-this._dragState.startX),y=Math.abs(l-this._dragState.startY);(f>8||y>8)&&this._activateDrag();return}this._dragState.currentX=c,this._dragState.currentY=l;let r=!1;const s=Date.now();if(!this._lastDropCheck||s-this._lastDropCheck>50){this._lastDropCheck=s;const f=R(c,l,"yenvui-drop-target"),y=f?f.zone:null;this._dragState.currentZone!==y&&(this._dragState.currentZone=y,r=!0)}const h=this.shadowRoot.querySelector("sutram-drag-coordinator");h&&(r?h.dragState={...this._dragState}:typeof h.updatePointer=="function"&&h.updatePointer(c,l))},onPanEnd:(c,l)=>{if(this._dragState.active){const r=this._dragState.currentZone,s=this._dragState.entity,h=this._dragState.sourceCol;if(r&&window.Sutram?.stores?.Layout){const f=window.Sutram.stores.Layout.getState();if(r==="close")this._safeEvict(s.id,()=>{h==="window"?f.closeWindow(s.id):h&&f.unpinFromColumn(h,s.id),f.evictProjection(s.id)});else if(r==="window")h==="window"?f.closeWindow(s.id):h&&f.unpinFromColumn(h,s.id),f.openWindow(s,f.focusedColumn||"center",1);else if(r.startsWith("span-")){const y=r.split("-"),C=parseInt(y[1],10),k=y[2];h==="window"?f.updateWindowConstraints(s.id,k,C):(h&&f.unpinFromColumn(h,s.id),f.openWindow(s,k,C))}else if(r.startsWith("reorder-")){if(h){const y=parseInt(r.replace("reorder-",""),10),C=[...f.columns[h].pinned],k=C.findIndex(D=>D.id===s.id);if(k!==-1&&k!==y){const[D]=C.splice(k,1);C.splice(y,0,D),window.Sutram.stores.Layout.setState(e=>({columns:{...e.columns,[h]:{...e.columns[h],pinned:C}}}))}}}else if(["left","center","right"].includes(r)&&r!==h){const y=r;h==="window"?f.closeWindow(s.id):h&&f.unpinFromColumn(h,s.id),f.pinToColumn(y,s),f.setFocusedColumn(y),f.setActiveProjection(y,s.id);const C={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(C[y])}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(t,{lockAxis:a==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(t=>{t&&typeof t.abort=="function"&&t.abort()})}connectedCallback(){try{super.connectedCallback(),this._edgeSwipeStartX=0,this._edgeSwipeStartY=0,this.registerGlobalListener("touchstart",window,t=>{this._edgeSwipeStartX=t.touches[0].clientX,this._edgeSwipeStartY=t.touches[0].clientY},{passive:!0,capture:!0}),this.registerGlobalListener("touchmove",window,t=>{const o=t.touches[0].clientX,n=t.touches[0].clientY,a=Math.abs(o-this._edgeSwipeStartX),d=Math.abs(n-this._edgeSwipeStartY);(this._edgeSwipeStartX<30||this._edgeSwipeStartX>window.innerWidth-30)&&a>d&&a>5&&t.cancelable&&t.preventDefault()},{passive:!1,capture:!0}),this.registerGlobalListener("click",document,t=>{this._launcherDropdown&&!t.composedPath().some(o=>o.classList?.contains("global-launcher-menu")||o.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),P&&(this.subscribe(P,t=>{const o=t||{};this._spatialState={capacity:o.capacity||3,focusedColumn:o.focusedColumn||"center",mobileViewportIndex:o.mobileViewportIndex??1,columns:o.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:o.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this._handleResize=z(()=>{const t=window.innerWidth,o=Math.min(3,Math.max(1,Math.floor(t/360))),n=P.getState();if(n&&(n.capacity||3)!==o&&typeof n.setCapacity=="function"){if(n.setCapacity(o),o===1&&n.focusedColumn){const c={left:0,center:1,right:2};n.setMobileViewport(c[n.focusedColumn]||1)}(n.windows||[]).forEach(c=>{let l=Math.min(c.span||1,o),r=c.anchorCol||"center";o===1?(l=1,r=n.focusedColumn||"center"):o===2&&r==="right"&&(r=l===2?"left":"center"),(l!==c.span||r!==c.anchorCol)&&n.updateWindowConstraints(c.id,r,l)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=z(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this._compileLayout()}catch(t){console.error("[Telemetry] AppShell connectedCallback error:",t)}}_getPrimaryTabColor(t){if(t&&t.intent)return`var(--intent-${t.intent})`;const o=typeof t=="string"?t:t?.id;return{context:"var(--intent-primary)",edit:"var(--intent-highlight)",diagnostics:"var(--intent-warning)",tasks:"var(--intent-warning)",ctrl:"var(--intent-danger)",dev:"var(--intent-success)",offline:"var(--text-muted)",library:"var(--intent-highlight)",cronic:"var(--intent-warning)",skills:"var(--intent-success)",practice:"var(--intent-success)"}[o?.toLowerCase()]||"var(--intent-primary)"}_getPrimaryTabIcon(t){if(t&&t.icon){const c=this._getPrimaryTabColor(t);return b`<yv-icon name="${t.icon}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${c};"></yv-icon>`}const o=typeof t=="string"?t:t?.id,a={context:"folder-code",edit:"edit-3",diagnostics:"activity",tasks:"check-square",ctrl:"terminal",dev:"code",offline:"wifi-off",library:"book-open",cronic:"clock",skills:"award",practice:"target"}[o?.toLowerCase()]||"folder",d=this._getPrimaryTabColor(t);return b`<yv-icon name="${a}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${d};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=F.getCompiledLayout();const t=window.Sutram?.stores?.Layout;if(t){const o=t.getState();let n=!1;const a={...o.columns},d=l=>window.inSetu?.isCore?.(l)||window.ACTIVE_EXTENSIONS?.includes(l),c=this._layoutConfig.filter(l=>l.slot==="slots:sub-navigation");["left","center","right"].forEach(l=>{if(!a[l]||!a[l].pinned)return;const r=a[l].pinned.filter(s=>!s.extName||d(s.extName)).map(s=>{const h=c.find(f=>f.id===s.id);return h&&(h.icon!==s.icon||h.label!==s.label||h.intent!==s.intent)?(n=!0,{...s,icon:h.icon,label:h.label,intent:h.intent}):s});(r.length!==a[l].pinned.length||n)&&(a[l]={...a[l],pinned:r},a[l].active&&!r.some(s=>s.id===a[l].active)&&(a[l].active=r.length>0?r[0].id:null),n=!0)}),n&&t.setState({columns:a})}this.requestUpdate()}catch(t){console.error("[Telemetry] AppShell _compileLayout error:",t)}}_renderDropdownItem(t){let o=null;if(this._spatialState&&this._spatialState.columns){for(const n of["left","center","right"])if(this._spatialState.columns[n].pinned.some(a=>a.id===t.id)){o=n;break}}return b`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${n=>{const a=window.Sutram?.stores?.Layout?.getState();let d=null;if(a&&a.columns){for(const c of["left","center","right"])if(a.columns[c].pinned.some(l=>l.id===t.id)){d=c;break}}this._handlePointerDown(n,t,d,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const n=window.Sutram?.stores?.Layout?.getState(),{capacity:a,focusedColumn:d,mobileViewportIndex:c}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let l=null;if(n&&n.columns){for(const s of["left","center","right"])if(n.columns[s].pinned.some(h=>h.id===t.id)){l=s;break}}let r=l;if(!l){r=t.preferredColumn||"center";let s=["left","center","right"];a===1?s=[["left","center","right"][c]||d||"center"]:a===2&&(s=["left","center"]),s.includes(r)||(r=a===1?s[0]:d),n&&n.pinToColumn(r,t)}if(n&&(n.setFocusedColumn(r),n.setActiveProjection(r,t.id),a===1)){const s={left:0,center:1,right:2};this._setViewportIndex(s[r])}this._handleSubTabClick(t.id),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${t.icon?b`<yv-icon name="${t.icon}" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:b`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:t.targetParent,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${t.label}</span>
            </button>
        `}_updateUrlHash(t,o){const n=window.inSetu?.utils?.getActiveWorkspace?window.inSetu.utils.getActiveWorkspace():"default",a=window.inSetu?.stores?.App?.getState()?.tabBrowsePaths?.[o],d=a&&a.length>0?"/"+a.map(encodeURIComponent).join("/"):"",c=`#/${n}/${t}/${o}${d}`;window.location.hash!==c&&window.history.replaceState(null,"",c)}_handleSubTabClick(t){let o=null,n=!1;if(window.Sutram?.stores?.Layout){const a=window.Sutram.stores.Layout.getState();for(const d of["left","center","right"])if(a.columns[d]?.pinned.some(c=>c.id===t)){o=d;break}if(o){n=a.columns[o].active===t,a.setActiveProjection(o,t),a.setFocusedColumn(o);const d={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(d[o])}}if(n){const a=this.shadowRoot.querySelector(`[data-sub-id="${t}"]`);a&&typeof a.onForceRefresh=="function"&&a.onForceRefresh()}this.requestUpdate(),o&&this._updateUrlHash(o,t)}_handleFolderDragStart(t){t.pointerType==="mouse"&&(this._folderDragController||(this._folderDragController=new L(this,{onPanStart:()=>{const o=this.shadowRoot.querySelector(".folder-tabs-row");o&&(this._folderStartScroll=o.scrollLeft,o.style.scrollBehavior="auto",o.style.cursor="grabbing")},onPanMove:(o,n,a)=>{if(a==="horizontal"){const d=this.shadowRoot.querySelector(".folder-tabs-row");if(d){const c=o-this._folderDragController.startX;d.scrollLeft=this._folderStartScroll-c}}},onPanEnd:()=>{const o=this.shadowRoot.querySelector(".folder-tabs-row");o&&(o.style.scrollBehavior="",o.style.cursor="grab")}})),this._folderDragController.start(t))}_handleDotDragStart(t){this._dotDragController||(this._dotDragController=new L(this,{onPanStart:()=>{const o=this.shadowRoot.querySelector(".spatial-track");o&&(o.style.transition="none")},onPanMove:(o,n,a)=>{if(a==="horizontal"){const d=o-this._dotDragController.startX,c=this._spatialState?.mobileViewportIndex??1,l=this.shadowRoot.querySelector(".spatial-track");if(l){let r=d;(c===0&&d>0||c===2&&d<0)&&(r=d*.2),l.style.transform=`translateX(calc(${c*-100}vw + ${r}px))`}}},onPanEnd:(o,n,a)=>{const d=this.shadowRoot.querySelector(".spatial-track");if(d&&(d.style.transition=""),a==="horizontal"){const c=o-this._dotDragController.startX,l=window.innerWidth*.2,r=this._spatialState?.mobileViewportIndex??1;let s=r;c>l?s=Math.max(0,r-1):c<-l&&(s=Math.min(2,r+1)),s!==r&&this._setViewportIndex(s),d&&(d.style.transform=`translateX(${s*-100}vw)`),this.requestUpdate()}}})),this._dotDragController.start(t)}_setViewportIndex(t){if(window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();o.setMobileViewport(t);const n=["left","center","right"];n[t]&&o.setFocusedColumn(n[t])}}render(){try{const t=new Map,o=(e,v=null)=>{if(!e)return"";const u=v?`${e}:${v}`:e;let m=this._activeNodes.get(u);if(!m)try{m=document.createElement(e),v&&(m.dataset.subId=v)}catch{m=document.createElement("div"),m.style.cssText="padding: 15px; color: var(--intent-danger); font-family: monospace;",m.innerText=`\u26A0\uFE0F Failed to initialize <${e}>`}return t.set(u,m),m},n=window.ExtensionRegistry||M,a=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let d=this._layoutConfig.filter(e=>e.slot==="slots:primary-navigation");const c=this._layoutConfig.filter(e=>e.slot==="slots:global"),l=this._layoutConfig.filter(e=>e.slot==="slots:sub-navigation");a&&typeof n.getExtension=="function"&&(d=d.filter(e=>{const v=e.extName?n.getExtension(e.extName):null;return v&&v.offline_mode&&v.offline_mode!=="none"?!0:l.filter(m=>(m.targetParent||"").toLowerCase()===(e.id||"").toLowerCase()).some(m=>(n.getExtension(m.extName)?.offline_mode||"none")!=="none")}));const{capacity:r,mobileViewportIndex:s,focusedColumn:h}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},f=r===1?"mobile":r===2?"tablet":"desktop",y=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}];let C="translateX(0vw)",k="100%";r===1?(C=`translateX(${s*-100}vw)`,k="300%"):r===2&&(C="translateX(0vw)",k="150%"),this.dataset.viewport=f;const D=b`
            <div class="shell-container spatial-viewport" data-viewport="${f}">
                <!-- Persistent Global Launcher Row -->
                <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 2px; padding-right: 0; ${f==="mobile"?"touch-action: pan-y; cursor: grab;":""}"
                    @pointerdown=${e=>{f==="mobile"&&this._handleDotDragStart(e)}}>
                    ${f==="mobile"?b`
                        <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                            <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${e=>{if(e.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const v=d[0]?d[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:v}}this.requestUpdate()}}>
                                <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                <span>Tools</span>
                                <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                            </button>
                        </div>
                    `:b`
                        <yenvui-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                            ${d.map(e=>{const v=l.filter(u=>(u.targetParent||"").toLowerCase()===e.id.toLowerCase());return b`
                                    <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(e)};" @click=${u=>{if(this._launcherDropdown?.tabId===e.id)this._launcherDropdown=null;else{const m=u.currentTarget.getBoundingClientRect(),p=m.right>window.innerWidth-200;this._launcherDropdown={tabId:e.id,items:v,x:p?"auto":m.left+"px",right:p?window.innerWidth-m.right+"px":"auto",y:m.bottom+5+"px"}}this.requestUpdate()}}>
                                        ${this._getPrimaryTabIcon(e)}${e.label}
                                    </button>
                                `})}
                        </yenvui-scrub-track>
                    `}
                    <!-- Mathematically Centered Mobile Dots -->
                    ${f==="mobile"?b`
                        <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            ${y.map((e,v)=>b`
                                <div class="pos-dot-target" @click=${()=>this._setViewportIndex(v)} title="Jump to ${e.label}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <div class="pos-dot ${s===v?"active":""}" style="width: ${s===v?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${s===v?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${s===v?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                </div>
                            `)}
                        </div>
                    `:""}

                    <div style="display: flex; align-items: center; height: 100%; flex-shrink: 0; position: relative;">
                        <slot name="header-actions"></slot>
                    </div>
                </div>
                <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown?b`
                    ${this._launcherDropdown.isMobileTools?b`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${d.map(e=>{const v=l.filter(u=>(u.targetParent||"").toLowerCase()===e.id.toLowerCase());return v.length===0?"":b`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(e)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(e)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${e.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${v.map(u=>{let m=null;if(this._spatialState&&this._spatialState.columns){for(const p of["left","center","right"])if(this._spatialState.columns[p].pinned.some(i=>i.id===u.id)){m=p;break}}return b`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${p=>{const i=window.Sutram?.stores?.Layout?.getState();let g=null;if(i&&i.columns){for(const w of["left","center","right"])if(i.columns[w].pinned.some(_=>_.id===u.id)){g=w;break}}this._handlePointerDown(p,u,g,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const p=window.Sutram?.stores?.Layout?.getState(),{capacity:i,focusedColumn:g,mobileViewportIndex:w}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let _=null;if(p&&p.columns){for(const x of["left","center","right"])if(p.columns[x].pinned.some($=>$.id===u.id)){_=x;break}}let S=_;if(!_){S=u.preferredColumn||"center";let x=["left","center","right"];i===1?x=[["left","center","right"][w]||g||"center"]:i===2&&(x=["left","center"]),x.includes(S)||(S=i===1?x[0]:g),p&&p.pinToColumn(S,u)}if(p&&(p.setFocusedColumn(S),i===1)){const x={left:0,center:1,right:2};this._setViewportIndex(x[S])}this._handleSubTabClick(u.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${u.icon?b`<yv-icon name="${u.icon}" style="width: 14px; height: 14px; color: ${m?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:b`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${m?this._getPrimaryTabColor({id:e.id,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${u.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:b`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(e=>this._renderDropdownItem(e))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${r}" style="width: ${k}; transform:${C}; position: relative;">
                    ${y.map((e,v)=>{let u=[],m=[e.id];r===2&&(e.id==="left"?m=["left","right"]:e.id==="right"&&(m=[])),m.forEach(i=>{(this._spatialState.columns&&this._spatialState.columns[i]?.pinned||[]).forEach(w=>{const _=l.find(S=>S.id===w.id);u.push({id:w.id,label:_?.label||w.label||w.title||w.id,component:_?.component||w.component,extName:w.extName||"fs",targetParent:w.targetParent||i,preferredColumn:w.preferredColumn||i,icon:_?.icon||w.icon,intent:_?.intent||w.intent,actualSourceCol:i})})}),a&&typeof n.getExtension=="function"&&(u=u.filter(i=>(n.getExtension(i.extName)?.offline_mode||"none")!=="none"));let p=null;if(m.includes(this._spatialState.focusedColumn)&&(p=u.find(i=>i.id===this._spatialState.columns[this._spatialState.focusedColumn]?.active)),!p){for(const i of m)if(p=u.find(g=>g.id===this._spatialState.columns[i]?.active),p)break}return p||(p=u[0]),b`
                        <div class="spatial-col ${h===e.id&&r>1?"is-focused":""}" data-col-id="${e.id}" @click=${()=>{const i=p?p.id:u[0]?u[0].id:null,g=p&&p.actualSourceCol||e.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(g),i&&this._updateUrlHash(g,i)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${p&&p.intent?`var(--intent-${p.intent})`:"var(--intent-primary)"};">
                                <yenvui-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${u.map(i=>{const g=p&&p.id===i.id,w=i.intent?`var(--intent-${i.intent})`:"var(--intent-primary)",_=i.icon||"component";return b`
                                        <div class="sub-tab ${g?"active":""}"
                                                style="${g?`border-bottom-color: ${w}; color: var(--text);`:""}"
                                                @pointerdown=${S=>{const x=Date.now();if(this._lastTapId===i.id&&x-(this._lastTapTime||0)<300){S.stopPropagation();const $=window.Sutram?.stores?.Layout?.getState();$&&($.unpinFromColumn(i.actualSourceCol||e.id,i.id),$.openWindow(i,e.id,1)),this._lastTapTime=0;return}this._lastTapId=i.id,this._lastTapTime=x,this._handlePointerDown(S,i,i.actualSourceCol||e.id,"subtab")}}
                                                @dblclick=${S=>{S.stopPropagation();const x=window.Sutram?.stores?.Layout?.getState();x&&(x.unpinFromColumn(i.actualSourceCol||e.id,i.id),x.openWindow(i,e.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(i.actualSourceCol||e.id),this._handleSubTabClick(i.id))}}>
                                            <div class="sub-tab-icon-wrapper" @pointerdown=${S=>S.stopPropagation()} @click=${S=>{S.stopPropagation();const x=window.Sutram?.stores?.Layout?.getState();x&&this._safeEvict(i.id,()=>{x.unpinFromColumn(i.actualSourceCol||e.id,i.id),x.evictProjection(i.id);const T=window.Sutram.stores.Layout.getState().columns[i.actualSourceCol||e.id]?.active||"";this._updateUrlHash(i.actualSourceCol||e.id,T)})}}>
                                                <div class="default-icon-container" style="color: ${w}; opacity: ${g?"1":"0.5"};">
                                                    <yv-icon name="${_}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                                <yv-icon name="x" class="close-icon" stroke-width="2.5" style="width: 14px; height: 14px; color: var(--intent-danger);"></yv-icon>
                                            </div>
                                            ${i.label}${window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[i.id]?.content!==window.inSetu?.stores?.Fs?.getState()?.activeBuffers?.[i.id]?.originalContent?"*":""}
                                        </div>
                                    `})}
                                </yenvui-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: center; height: 100%;">
                                    ${p?this._layoutConfig.filter(i=>i.slot==="slots:sub-navigation-actions"&&i.targetSub===p.id).map(i=>b`<div style="display: contents;" data-ext="${i.extName}">${o(i.component,p.id)}</div>`):""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${u.map(i=>{const g=p&&p.id===i.id,w=o(i.component,i.id);return b`
                                        <div style="display: ${g?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${i.extName}" data-offline-mode="${(typeof n.getExtension=="function"?n.getExtension(i.extName)?.offline_mode:null)||"none"}">
                                            ${w}
                                        </div>
                                    `})}
                                ${u.length===0?b`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${e.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(e=>{const u={left:0,center:1,right:2}[e.anchorCol||"center"]??1;let m=Math.min(e.span||1,3-u);m=Math.min(m,r);const p=u/3*100,i=m/3*100;return b`
                            <div style="position: absolute; left: ${p}%; width: ${i}\%; top: 0; bottom: 0; pointer-events: auto; z-index:${e.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${e.label||e.id}
                                    .anchorCol=${e.anchorCol||"center"}
                                    .span=${m}
                                    .z=${e.z}
                                    .icon=${e.icon||"component"}
                                    .intent=${e.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(e.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(e.id)})}}
                                    @sutram-window-span=${g=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(e.id,e.anchorCol||"center",g.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(e.id)}
                                    @sutram-window-drag-start=${g=>this._handlePointerDown(g.detail.originalEvent,e,"window","window-header")}
                                    @sutram-window-dock=${()=>{const g=window.Sutram?.stores?.Layout?.getState();if(g){const w=e.preferredColumn||"center";g.closeWindow(e.id),g.pinToColumn(w,e),g.setFocusedColumn(w),g.setActiveProjection(w,e.id);const _={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(_[e.preferredColumn||"center"]),this.requestUpdate()}}}>
                            ${o(e.component,e.id)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${c.map(e=>o(e.component))}
            </div>

            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._activeNodes=t,D}catch(t){return console.error("[Telemetry] AppShell render error:",t),b`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2>⚠️ AppShell Render Error</h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${t.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${t.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
