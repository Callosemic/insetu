import{html as b,css as N}from"lit";import{SutramElement as A,ExtensionRegistry as R,LayoutStore as L,StoreRegistry as j}from"./sutram_sdk.js";import{sharedStyles as U}from"./shared_styles.js";import{debounce as E}from"./utils.js";import{SutramProjectionCompiler as q,SutramProjectionPool as H}from"./projection_engine.js";import"./drag-coordinator.js";import{physics as W}from"sutram-chassis";const{YenvuiGestureController:M,YenvuiViewportGuard:V,getDeepElementFromPoint:J}=W,D=(k,e,o)=>{const i=Array.isArray(o)&&o.length>0?o:[1,1,1],u=Math.max(0,Math.min(e,i.length-k)),d=i.slice(u,u+k).reduce((r,l)=>r+l,0)||1;return{getColWidth:r=>`${i[r]/d*100}%`,getColLeft:r=>`${i.slice(0,r).reduce((c,$)=>c+$,0)/d*100}%`,getTrackOffset:()=>`-${i.slice(0,u).reduce((l,c)=>l+c,0)/d*100}%`,getWinBounds:(r,l)=>{const c=Math.min(l,i.length-r),$=i.slice(0,r).reduce((x,m)=>x+m,0),v=i.slice(r,r+c).reduce((x,m)=>x+m,0);return{left:`${$/d*100}%`,width:`${v/d*100}%`}}}};export const pinMatchesSlot=(k,e)=>{if(!k||!e)return!1;const o=typeof e=="string"?e:e.id||"",i=typeof e=="object"&&e.rawId?e.rawId:o.includes("://")?o:o.includes(":")?o.split(":").slice(1).join(":"):o,u=typeof e=="object"&&e.extName?e.extName:!o.includes("://")&&o.includes(":")?o.split(":")[0]:null;if(k.id===o||k.rawId&&k.rawId===i&&(!u||!k.extName||k.extName===u)||u&&k.id===i&&(!k.extName||k.extName===u))return!0;if(k.id&&!k.id.includes("://")&&k.id.includes(":")){const[d,r]=k.id.split(":");if(r===i&&(!u||d===u))return!0}return k.id===i&&!u};export class SutramAppShell extends A{static properties={variant:{type:String,reflect:!0},_layoutConfig:{type:Array},_spatialState:{type:Object}};static styles=[U,N`
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
    `];constructor(){super(),this._layoutConfig=[],this._projectionPool=new H,this.variant="standard",this._spatialState={capacity:3,focusedColumn:"center",mobileViewportIndex:1,layoutRatios:null,columns:{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}}},this._launcherDropdown=null}_safeEvict(e,o){const i=window.ExtensionRegistry||R;i?.executeUIHook&&i.executeUIHook("sutram:is-projection-dirty",e)&&!confirm(`You have unsaved changes in ${e.split("/").pop()}.

Click OK to discard changes and close, or Cancel to abort.`)||o()}_activateDrag(){this._dragController&&this._dragController._dragTimer&&(clearTimeout(this._dragController._dragTimer),this._dragController._dragTimer=null),this._dragState&&this._dragController&&(this._dragController.currentX!==void 0&&!isNaN(this._dragController.currentX)&&(this._dragState.currentX=this._dragController.currentX),this._dragController.currentY!==void 0&&!isNaN(this._dragController.currentY)&&(this._dragState.currentY=this._dragController.currentY)),this._dragState.active=!0,this.requestUpdate(),navigator.vibrate&&navigator.vibrate(50)}_handlePointerDown(e,o,i,u="subtab"){let d=null;const r=this.shadowRoot.querySelector(".spatial-track"),l=r?r.getBoundingClientRect():{top:38,height:window.innerHeight-68};if(i==="window"){const x=e.composedPath().find(m=>m.tagName&&m.tagName.toLowerCase()==="sutram-window");if(x&&x.parentElement){const m=x.parentElement.getBoundingClientRect();d={left:m.left,top:m.top,width:m.width,height:m.height}}}else if(i){const v=this.shadowRoot.querySelector(`.spatial-col[data-col-id="${i}"]`);if(v){const x=v.getBoundingClientRect();d={left:x.left,top:x.top,width:x.width,height:x.height}}}d||(d={left:0,top:l.top,width:window.innerWidth,height:l.height});const c=e.clientX!==void 0?e.clientX:e.touches&&e.touches[0]?e.touches[0].clientX:0,$=e.clientY!==void 0?e.clientY:e.touches&&e.touches[0]?e.touches[0].clientY:0;this._dragState={active:!1,entity:o,sourceCol:i,currentZone:null,startX:c,startY:$,currentX:c,currentY:$,originType:u,sourceRect:d},this._dragController||(this._dragController=new M(this,{longPressDelay:500,onLongPress:(v,x)=>{this._dragState&&(v!==void 0&&!isNaN(v)&&(this._dragState.currentX=v),x!==void 0&&!isNaN(x)&&(this._dragState.currentY=x)),this._activateDrag()},onPanMove:(v,x)=>{if(!this._dragState.active){const g=Math.abs(v-this._dragState.startX),s=Math.abs(x-this._dragState.startY);(g>8||s>8)&&this._activateDrag();return}this._dragState.currentX=v,this._dragState.currentY=x;let m=!1;const f=this.shadowRoot.querySelector("sutram-drag-coordinator");if(f){const g=typeof f.getHoveredZone=="function"?f.getHoveredZone(v,x):null;this._dragState.currentZone!==g&&(this._dragState.currentZone=g,m=!0),m?f.dragState={...this._dragState}:typeof f.updatePointer=="function"&&f.updatePointer(v,x)}},onPanEnd:(v,x)=>{if(this._dragState.active){const m=this._dragState.currentZone,f=this._dragState.entity,g=this._dragState.sourceCol;if(m&&window.Sutram?.stores?.Layout){const s=window.Sutram.stores.Layout.getState();if(m==="close")this._safeEvict(f.id,()=>{g==="window"?s.closeWindow(f.id):g&&s.unpinFromColumn(g,f.id),s.evictProjection(f.id);const t=window.Sutram.stores.Layout.getState(),a=t.focusedColumn||g||"center",n=t.columns[a]?.active||"";this._updateUrlHash(a,n)});else if(m==="popout"){const t=g&&g!=="window"?g:s.focusedColumn||"center";s.popoutProjection(f.id,{originCol:t})}else if(m==="window"||m==="mode-window"){const t=g&&g!=="window"?g:f.anchorCol||s.focusedColumn||"center";g&&g!=="window"&&s.unpinFromColumn(g,f.id),s.openWindow(f,t,1)}else if(m==="mode-tab"&&!f?.windowOnly){const t=g&&g!=="window"?g:f.anchorCol||s.focusedColumn||"center";g==="window"&&s.closeWindow(f.id),s.columns[t]?.pinned?.some(a=>a.id===f.id)||s.pinToColumn(t,f),s.setActiveProjection(t,f.id),s.setFocusedColumn(t)}else if(m.startsWith("span-")){const t=m.split("-"),a=parseInt(t[1],10),n=t[2];g==="window"?s.updateWindowConstraints(f.id,n,a):(g&&s.unpinFromColumn(g,f.id),s.openWindow(f,n,a))}else if(m.startsWith("reorder-")){if(g){const t=parseInt(m.replace("reorder-",""),10),a=[...s.columns[g].pinned],n=a.findIndex(y=>y.id===f.id);if(n!==-1&&n!==t){const[y]=a.splice(n,1);a.splice(t,0,y),window.Sutram.stores.Layout.setState(p=>({columns:{...p.columns,[g]:{...p.columns[g],pinned:a}}}))}}}else if(["left","center","right"].includes(m)&&m!==g&&!f?.windowOnly){const t=m;g==="window"?s.closeWindow(f.id):g&&s.unpinFromColumn(g,f.id),s.pinToColumn(t,f),s.setActiveProjection(t,f.id),s.setFocusedColumn(t)}}}this._dragState={active:!1,entity:null,sourceCol:null,currentZone:null,startX:0,startY:0,currentX:0,currentY:0,originType:null},this.requestUpdate()}})),this._dragController.start(e,{lockAxis:u==="subtab"?"vertical":"both"})}disconnectedCallback(){super.disconnectedCallback(),this._handleResize&&window.removeEventListener("resize",this._handleResize),[this._dragController,this._folderDragController,this._dotDragController].forEach(e=>{e&&typeof e.abort=="function"&&e.abort()})}updated(e){super.updated(e);const o=this.shadowRoot.querySelector(".spatial-track");if(o){const u=this._spatialState?.capacity||3,d=this._spatialState?.mobileViewportIndex??1,r=this._spatialState?.layoutRatios||[1,1,1],l=D(u,d,r);this._isPanningTrack||(o.style.transform=`translateX(${l.getTrackOffset()})`)}this.shadowRoot.querySelectorAll(".sub-tab.active").forEach(u=>{const d=u.closest("sutram-scrub-track, yenvui-scrub-track");if(d&&d.shadowRoot){const r=d.shadowRoot.querySelector(".scrub-container");if(r){const l=u.getBoundingClientRect();if(l.width>0){const c=r.getBoundingClientRect();r.scrollBy({left:l.left-c.left-c.width/2+l.width/2,behavior:"smooth"})}}}})}connectedCallback(){try{super.connectedCallback(),this.setAttribute("data-spatial-boundary",""),V.install(),this.registerGlobalListener("click",document,e=>{this._launcherDropdown&&!e.composedPath().some(o=>o.classList?.contains("global-launcher-menu")||o.classList?.contains("tab-btn"))&&(this._launcherDropdown=null,this.requestUpdate())}),L&&(this.subscribe(L,e=>{const o=e||{};this._spatialState={capacity:o.capacity||3,focusedColumn:o.focusedColumn||"center",mobileViewportIndex:o.mobileViewportIndex??1,layoutRatios:o.layoutRatios||null,columns:o.columns||{left:{pinned:[]},center:{pinned:[]},right:{pinned:[]}},windows:o.windows||[]},this.requestUpdate()}),this.registerGlobalListener("sutram-evict-projection",window,()=>{this.requestUpdate()}),this.registerGlobalListener("sutram-extension-unloaded",window,e=>{const o=e.detail?.extName;o&&this._projectionPool.evictExtension(o),this.requestUpdate()}),this.registerGlobalListener("sutram-rekey-projection",window,e=>{const{oldId:o,newId:i}=e.detail||{};if(!o||!i)return;if(this._projectionPool.rekey(o,i),decodeURIComponent(window.location.hash||"").includes(o)){const d=L.getState(),r=d.focusedColumn||"center";if(this.variant==="popout"){const l=window.location.hash.replace(encodeURIComponent(o),encodeURIComponent(i)).replace(o,i);l!==window.location.hash&&window.history.replaceState(null,"",l)}else d.columns?.[r]?.active===i&&this._updateUrlHash(r,i)}this.requestUpdate()}),this._handleResize=E(()=>{const e=window.innerWidth,o=Math.min(3,Math.max(1,Math.floor(e/360))),i=L.getState();if(i&&(i.capacity||3)!==o&&typeof i.setCapacity=="function"){if(i.setCapacity(o),o===1&&i.focusedColumn){const r={left:0,center:1,right:2};i.setMobileViewport(r[i.focusedColumn]||1)}else if(o===2&&i.focusedColumn){const l={left:0,center:1,right:2}[i.focusedColumn]||1,c=l===0?0:l===2||i.mobileViewportIndex===2?2:0;i.setMobileViewport(c)}(i.windows||[]).forEach(r=>{let l=Math.min(r.span||1,o),c=r.anchorCol||"center";o===1?(l=1,c=i.focusedColumn||"center"):o===2&&c==="right"&&(c=l===2?"left":"center"),(l!==r.span||c!==r.anchorCol)&&i.updateWindowConstraints(r.id,c,l)})}},100),window.addEventListener("resize",this._handleResize),this._handleResize()),this._debouncedCompile=E(()=>this._compileLayout(),50),this.registerGlobalListener("sutram-layout-recompile",window,this._debouncedCompile),this.registerGlobalListener("sutram:scope-transition-start",window,()=>{this._debouncedCompile&&typeof this._debouncedCompile.cancel=="function"&&this._debouncedCompile.cancel()}),this._compileLayout()}catch(e){console.error("[Telemetry] AppShell connectedCallback error:",e)}}_resolvePrimaryTabMeta(e){const o=(typeof e=="string"?e:e?.id)?.toLowerCase()||"",i=window.ExtensionRegistry||R,u=i?.executeUIHook?i.executeUIHook("sutram:resolve-primary-tab-meta",{id:o,tab:e}):null,d={context:{color:"var(--intent-primary)",icon:"folder-code"},edit:{color:"var(--intent-highlight)",icon:"edit-3"},diagnostics:{color:"var(--intent-warning)",icon:"activity"},tasks:{color:"var(--intent-warning)",icon:"check-square"},ctrl:{color:"var(--intent-danger)",icon:"terminal"},dev:{color:"var(--intent-success)",icon:"code"},offline:{color:"var(--text-muted)",icon:"wifi-off"},library:{color:"var(--intent-highlight)",icon:"book-open"}};return{color:e&&e.intent?`var(--intent-${e.intent})`:u?.color||d[o]?.color||"var(--intent-primary)",icon:e&&e.icon?e.icon:u?.icon||d[o]?.icon||"folder"}}_getPrimaryTabColor(e){return this._resolvePrimaryTabMeta(e).color}_getPrimaryTabIcon(e){const{color:o,icon:i}=this._resolvePrimaryTabMeta(e);return b`<yv-icon name="${i}" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 8px; display: inline-block; vertical-align: text-bottom; color: ${o};"></yv-icon>`}_compileLayout(){try{this._layoutConfig=q.getCompiledLayout();const e=window.Sutram?.stores?.Layout,o=window.ExtensionRegistry||R,i=window.Sutram?.storeRegistry||j,u=!!(i&&typeof i.isTransitioning=="function"&&i.isTransitioning()||o?.executeUIHook&&(o.executeUIHook("sutram:is-swapping-scope")||o.executeUIHook("sutram:is-swapping-workspace")));if(e&&!o.isBooting&&!u){const d=e.getState();let r=!1;const l={},c={...d.columns},$=s=>typeof o._filterPredicate=="function"?o._filterPredicate(s):!0,v=this._layoutConfig.filter(s=>s.slot==="slots:sub-navigation");["left","center","right"].forEach(s=>{if(!c[s]||!c[s].pinned)return;const t=c[s].pinned.filter(a=>!a.extName||$(a.extName)).map(a=>{const n=v.find(y=>pinMatchesSlot(a,y));return n&&(a.id!==n.id&&(l[a.id]=n.id,r=!0),n.icon!==a.icon||n.label!==a.label||n.intent!==a.intent||n.rawId!==a.rawId||a.id!==n.id)?(r=!0,{...a,id:n.id,rawId:n.rawId||n.id,extName:n.extName,icon:n.icon||a.icon,label:n.label||a.label,intent:n.intent||a.intent}):a});(t.length!==c[s].pinned.length||r)&&(c[s]={...c[s],pinned:t},c[s].active&&l[c[s].active]?(c[s].active=l[c[s].active],r=!0):c[s].active&&!t.some(a=>pinMatchesSlot(a,c[s].active))&&(c[s].active=t.length>0?t[0].id:null,r=!0),Array.isArray(c[s].history)&&(c[s].history=c[s].history.map(a=>l[a]||a)))});const x=d.windows||[],m=x.filter(s=>!s.extName||$(s.extName));m.length!==x.length&&(r=!0);let f=m.map(s=>{const t=v.find(a=>a.id===s.id||s.extName&&a.extName===s.extName&&a.rawId===s.id);return t&&s.id!==t.id?(l[s.id]=t.id,r=!0,{...s,id:t.id,rawId:t.rawId,extName:t.extName,icon:t.icon||s.icon,label:t.label||s.label}):s}),g=(d.focusHistory||[]).map(s=>s&&s.id&&l[s.id]?(r=!0,{...s,id:l[s.id]}):s);r&&(e.setState({columns:c,windows:f,focusHistory:g}),Object.keys(l).length>0&&window.dispatchEvent(new CustomEvent("sutram-projections-migrated",{detail:{migrationMap:l},bubbles:!0,composed:!0})))}this.requestUpdate()}catch(e){console.error("[Telemetry] AppShell _compileLayout error:",e)}}_renderDropdownItem(e){let o=null;if(this._spatialState&&this._spatialState.columns){for(const i of["left","center","right"])if(this._spatialState.columns[i].pinned.some(u=>pinMatchesSlot(u,e))){o=i;break}}return b`
            <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); text-align: left; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                @pointerdown=${i=>{const u=window.Sutram?.stores?.Layout?.getState();let d=null;if(u&&u.columns){for(const r of["left","center","right"])if(u.columns[r].pinned.some(l=>pinMatchesSlot(l,e))){d=r;break}}this._handlePointerDown(i,e,d,"dropdown")}}
                @click=${()=>{if(this._dragState.active)return;const i=window.Sutram?.stores?.Layout?.getState();let u=null,d=null;if(i&&i.columns){for(const c of["left","center","right"])if(d=i.columns[c].pinned.find($=>pinMatchesSlot($,e)),d){u=c;break}}let r=u;const l=d?d.id:e.id;u||(r=e.preferredColumn||"center",i&&i.pinToColumn(r,e)),i&&(i.setFocusedColumn(r),i.setActiveProjection(r,l)),this._handleSubTabClick(l),this._launcherDropdown=null,this.requestUpdate()}}>
                <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                    ${e.icon?b`<yv-icon name="${e.icon}" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`:b`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${o?this._getPrimaryTabColor({id:e.targetParent,intent:e.intent}):"var(--text-muted)"};"></yv-icon>`}
                </div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${e.label}</span>
            </button>
        `}_updateUrlHash(e,o){const i=window.ExtensionRegistry||R,u=i?.executeUIHook?i.executeUIHook("sutram:resolve-route-hash",{colId:e,subId:o}):null,d=window.location.hash.replace(/^#\/?/,"").split("/")[0]||"default",r=u||`#/${d}/${e}/${encodeURIComponent(o)}`;window.location.hash!==r&&window.history.replaceState(null,"",r)}_handleSubTabClick(e){let o=null,i=!1,u=e;if(window.Sutram?.stores?.Layout){const d=window.Sutram.stores.Layout.getState();for(const r of["left","center","right"]){const l=d.columns[r]?.pinned.find(c=>pinMatchesSlot(c,e));if(l){o=r,u=l.id;break}}if(o){i=d.columns[o].active===u,d.setActiveProjection(o,u),d.setFocusedColumn(o);const r={left:0,center:1,right:2};this._spatialState?.capacity===1&&this._setViewportIndex(r[o])}}if(i){const d=this.shadowRoot.querySelector(`[data-sub-id="${u}"]`)||this.shadowRoot.querySelector(`[data-sub-id="${e}"]`);d&&typeof d.onForceRefresh=="function"&&d.onForceRefresh()}this.requestUpdate(),o&&this._updateUrlHash(o,u)}_handleDotDragStart(e){this._dotDragController||(this._dotDragController=new M(this,{onPanStart:()=>{this._isPanningTrack=!0;const o=this.shadowRoot.querySelector(".spatial-track");o&&(o.style.transition="none")},onPanMove:(o,i,u)=>{if(u==="horizontal"){const d=o-this._dotDragController.startX,r=this._spatialState?.mobileViewportIndex??1,l=this._spatialState?.capacity||3,c=this._spatialState?.layoutRatios||[1,1,1],$=D(l,r,c),v=parseFloat($.getTrackOffset()),x=this.shadowRoot.querySelector(".spatial-track");if(x){let m=d;const f=Math.max(0,c.length-l),g=D(l,f,c).getTrackOffset(),s=parseFloat(g);(v<=s&&d<0||v>=0&&d>0)&&(m=d*.2),x.style.transform=`translateX(calc(${v}% + ${m}px))`}}},onPanEnd:(o,i,u)=>{const d=this.shadowRoot.querySelector(".spatial-track");if(d&&(d.style.transition=""),u==="horizontal"){const r=o-this._dotDragController.startX,l=window.innerWidth*.2,c=this._spatialState?.mobileViewportIndex??1,$=this._spatialState?.capacity||3,v=this._spatialState?.layoutRatios||[1,1,1],x=Math.max(0,v.length-$);let m=c;if(r>l?m=Math.max(0,c-1):r<-l&&(m=Math.min(x,c+1)),this._isPanningTrack=!1,m!==c)this._setViewportIndex(m);else{const f=D($,m,v);d&&(d.style.transform=`translateX(${f.getTrackOffset()})`),this.requestUpdate()}}else this._isPanningTrack=!1,this.requestUpdate()}})),this._dotDragController.start(e)}_setViewportIndex(e){if(window.Sutram?.stores?.Layout){const o=window.Sutram.stores.Layout.getState();o.setMobileViewport(e);const i=["left","center","right"];i[e]&&o.setFocusedColumn(i[e])}}render(){try{this._projectionPool.beginPass();const e=(t,a=null,n=null)=>this._projectionPool.resolve(t,a,n),o=window.ExtensionRegistry||R,i=window.Sutram?.stores?.Environment?.getState()?.isOffline||!1;let u=this._layoutConfig.filter(t=>t.slot==="slots:primary-navigation");const d=this._layoutConfig.filter(t=>t.slot==="slots:global"),r=this._layoutConfig.filter(t=>t.slot==="slots:sub-navigation");i&&typeof o.getExtension=="function"&&(u=u.filter(t=>{const a=t.extName?o.getExtension(t.extName):null;return a&&a.offline_mode&&a.offline_mode!=="none"?!0:r.filter(y=>(y.targetParent||"").toLowerCase()===(t.id||"").toLowerCase()).some(y=>(o.getExtension(y.extName)?.offline_mode||"none")!=="none")}));const{capacity:l,mobileViewportIndex:c,focusedColumn:$}=this._spatialState||{capacity:3,mobileViewportIndex:1,focusedColumn:"center"},v=l===1?"mobile":l===2?"tablet":"desktop",x=[{id:"left",label:"Left Flank"},{id:"center",label:"Center Focus"},{id:"right",label:"Right Flank"}],m=this._spatialState.layoutRatios||[1,1,1],f=D(l,c,m);this.dataset.viewport=v;const g=this.variant==="popout";if(g){const t=typeof window<"u"?window.location.hash.replace(/^#\/?/,""):"",a=t?t.split("/").map(decodeURIComponent):[];let n="";a.length>=4&&a[2]==="editor"?n=a.slice(3).join("/"):a.length>=3&&(n=a.slice(2).join("/"));const y=this._spatialState?.focusedColumn||"center",p=this._spatialState?.columns?.[y];n=n||p?.active||p?.pinned?.[0]?.id;let _=r.find(C=>C.id===n||!n.includes(":")&&C.rawId===n),P=null;if(_)_.allow_popout?P=e(_.component,_.id):P=b`
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; color: var(--text-muted); box-sizing: border-box; font-family: var(--font-mono, monospace);">
                            <yv-icon name="alert-triangle" style="width: 36px; height: 36px; color: var(--intent-warning); margin-bottom: 16px;"></yv-icon>
                            <h3 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">Unsupported Pop-Out View</h3>
                            <p style="margin: 0; max-width: 440px; font-size: 0.85rem; line-height: 1.5;">The projection <strong>${_.label||_.id}</strong> is not permitted to run in an ephemeral pop-out window.</p>
                        </div>
                    `;else if(n){const C=typeof o.resolveCustomEditor=="function"?o.resolveCustomEditor(n):null,w=o?.executeUIHook?o.executeUIHook("sutram:resolve-editor-component",n):null,S=C?.component||w||"sutram-editor";P=e(S,n)}const h=b`
                <div class="shell-container" style="flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden; background: var(--bg);">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; overflow: hidden;">
                        ${P||b`<div style="padding: 20px; color: var(--text-muted); font-style: italic;">Loading pop-out view...</div>`}
                    </div>
                </div>
                <!-- Global / Transient Overlays -->
                <div style="display: contents;">
                    ${d.map(C=>e(C.component))}
                </div>
            `;return this._projectionPool.commitPass(),h}const s=b`
            <div class="shell-container spatial-viewport" data-viewport="${v}">
                ${g?"":b`
                    <!-- Persistent Global Launcher Row -->
                    <div class="top-utility-row" style="position: relative; display: flex; justify-content: space-between; width: 100%; background: var(--bg-deep); flex-shrink: 0; height: 38px; border-bottom: 1px solid var(--border); z-index: 50; padding-left: 0; padding-right: 0; ${l<m.length?"touch-action: pan-y; cursor: grab;":""}"
                        @pointerdown=${t=>{l<m.length&&this._handleDotDragStart(t)}}>
                        ${v==="mobile"?b`
                            <div class="mobile-only-tools flex items-center" style="display: flex; align-items: center; height: 100%;">
                                <button class="tab-btn ${this._launcherDropdown?.isMobileTools?"active":""}" style="display: flex; align-items: center;" @click=${t=>{if(t.stopPropagation(),this._launcherDropdown?.isMobileTools)this._launcherDropdown=null;else{const a=u[0]?u[0].id:"context";this._launcherDropdown={isMobileTools:!0,selectedFolder:a}}this.requestUpdate()}}>
                                    <yv-icon name="wrench" stroke-width="2.5" style="width: 14px; height: 14px; margin-right: 6px; color: var(--intent-primary);"></yv-icon>
                                    <span>Tools</span>
                                    <yv-icon name="chevron-down" stroke-width="2.5" style="width: 12px; height: 12px; margin-left: 4px; color: var(--text-muted);"></yv-icon>
                                </button>
                            </div>
                        `:b`
                            <sutram-scrub-track class="desktop-only-folders" @scroll=${()=>{this._launcherDropdown&&(this._launcherDropdown=null,this.requestUpdate())}} style="flex: 1; min-width: 0; height: 100%; background: transparent; --scrub-gap: 2px;">
                                ${u.map(t=>{const a=r.filter(n=>(n.targetParent||"").toLowerCase()===t.id.toLowerCase());return b`
                                        <button class="tab-btn" style="--tab-intent: ${this._getPrimaryTabColor(t)};" @click=${n=>{if(this._launcherDropdown?.tabId===t.id)this._launcherDropdown=null;else{const y=n.currentTarget.getBoundingClientRect(),p=y.right>window.innerWidth-200;this._launcherDropdown={tabId:t.id,items:a,x:p?"auto":y.left+"px",right:p?window.innerWidth-y.right+"px":"auto",y:y.bottom+5+"px"}}this.requestUpdate()}}>
                                            ${this._getPrimaryTabIcon(t)}${t.label}
                                        </button>
                                    `})}
                            </sutram-scrub-track>
                        `}
                        <!-- Centered Dots (1-Column Mobile View) -->
                        ${l===1&&l<m.length?b`
                            <div class="mobile-dots-wrapper" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${Array.from({length:Math.max(1,m.length-l+1)}).map((t,a)=>b`
                                    <div class="pos-dot-target" @click=${n=>{n.stopPropagation(),n.preventDefault()}} @pointerdown=${n=>{n.stopPropagation(),this._setViewportIndex(a)}} title="Jump to View ${a+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                        <div class="pos-dot ${c===a?"active":""}" style="width: ${c===a?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${c===a?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${c===a?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                    </div>
                                `)}
                            </div>
                        `:""}
                        <!-- Top Right Utility Rail -->
                        <div style="position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: stretch; gap: 0; height: 100%; flex-shrink: 0; background: var(--bg-deep); z-index: 105; padding-right: 0;">
                            <slot name="header-quickpack"></slot>
                            <slot name="header-actions-left"></slot>
                            ${l>1&&l<m.length?b`
                                <div class="desktop-dots-wrapper" style="display: flex; align-items: center; gap: 4px; background: var(--input-bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    ${Array.from({length:Math.max(1,m.length-l+1)}).map((t,a)=>b`
                                        <div class="pos-dot-target" @click=${n=>{n.stopPropagation(),n.preventDefault()}} @pointerdown=${n=>{n.stopPropagation(),this._setViewportIndex(a)}} title="Jump to View ${a+1}" style="padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                            <div class="pos-dot ${c===a?"active":""}" style="width: ${c===a?"14px":"6px"}; height: 6px; border-radius: 9999px; background: ${c===a?"var(--intent-primary)":"var(--text-muted)"}; opacity: ${c===a?"1":"0.5"}; transition: all 0.2s ease;"></div>
                                        </div>
                                    `)}
                                </div>
                            `:""}
                            <slot name="header-actions"></slot>
                        </div>
                    </div>
                `}
                <!-- Global Launcher Dropdown Overlay -->
                ${this._launcherDropdown?b`
                    ${this._launcherDropdown.isMobileTools?b`
                        <div class="global-launcher-menu mobile-tools-panel" style="position: absolute; top: 38px; left: 0; right: 0; width: 100vw; max-height: calc(100dvh - 38px); overflow-y: auto; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; padding: 12px 12px 20px 12px; box-sizing: border-box; gap: 18px;">
                            ${u.map(t=>{const a=r.filter(n=>(n.targetParent||"").toLowerCase()===t.id.toLowerCase());return a.length===0?"":b`
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${this._getPrimaryTabColor(t)}; border-bottom: 1px solid color-mix(in srgb, ${this._getPrimaryTabColor(t)} 30%, transparent); padding: 0 14px 4px 14px;">
                                            ${t.label}
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            ${a.map(n=>{let y=null;if(this._spatialState&&this._spatialState.columns){for(const p of["left","center","right"])if(this._spatialState.columns[p].pinned.some(_=>_.id===n.id)){y=p;break}}return b`
                                                <button class="yv-interactive-row" style="background: var(--input-bg); color: var(--text); padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-mono, monospace); font-weight: normal; margin: 0 !important; display: inline-flex; align-items: center; gap: 8px; width: auto; box-sizing: border-box; touch-action: none; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                                    @pointerdown=${p=>{const _=window.Sutram?.stores?.Layout?.getState();let P=null;if(_&&_.columns){for(const h of["left","center","right"])if(_.columns[h].pinned.some(C=>C.id===n.id)){P=h;break}}this._handlePointerDown(p,n,P,"dropdown")}}
                                                    @click=${()=>{if(this._dragState.active)return;const p=window.Sutram?.stores?.Layout?.getState(),{capacity:_,focusedColumn:P,mobileViewportIndex:h}=this._spatialState||{capacity:3,focusedColumn:"center",mobileViewportIndex:1};let C=null;if(p&&p.columns){for(const S of["left","center","right"])if(p.columns[S].pinned.some(T=>T.id===n.id)){C=S;break}}let w=C;C||(w=n.preferredColumn||"center",p&&p.pinToColumn(w,n)),p&&p.setFocusedColumn(w),this._handleSubTabClick(n.id),this._launcherDropdown=null,this.requestUpdate()}}>
                                                    <div style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;">
                                                        ${n.icon?b`<yv-icon name="${n.icon}" style="width: 14px; height: 14px; color: ${y?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`:b`<yv-icon name="puzzle" style="width: 14px; height: 14px; color: ${y?this._getPrimaryTabColor({id:t.id,intent:t.intent}):"var(--text-muted)"};"></yv-icon>`}
                                                    </div>
                                                    <span style="white-space: nowrap;">${n.label}</span>
                                                </button>
                                            `})}
                                        </div>
                                    </div>
                                `})}
                        </div>
                    `:b`
                        <div class="global-launcher-menu" style="position: fixed; top: ${this._launcherDropdown.y}; left: ${this._launcherDropdown.x}; right:${this._launcherDropdown.right}; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; padding: 8px; box-shadow: var(--overlay-shadow); z-index: 9999; display: flex; flex-direction: column; gap: 6px; min-width: 220px; max-height: 80vh; overflow-y: auto;">
                            ${this._launcherDropdown.items.map(t=>this._renderDropdownItem(t))}
                        </div>
                    `}
                `:""}
                <!-- Adaptive Spatial Track -->
                <div class="spatial-track capacity-${l}" style="${this._isPanningTrack?"":`transform: translateX(${f.getTrackOffset()});`}">
                    ${x.map((t,a)=>{let n=[],y=[t.id];y.forEach(h=>{(this._spatialState.columns&&this._spatialState.columns[h]?.pinned||[]).forEach(w=>{const S=r.find(T=>pinMatchesSlot(w,T));n.push({id:S?.id||w.id,rawId:S?.rawId||w.rawId||w.id,label:S?.label||w.label||w.title||w.id,component:S?.component||w.component,extName:S?.extName||w.extName||null,targetParent:S?.targetParent||w.targetParent||h,preferredColumn:S?.preferredColumn||w.preferredColumn||h,icon:S?.icon||w.icon,intent:S?.intent||w.intent,bulkActionGroup:S?.bulkActionGroup||w.bulkActionGroup||null,bulkEntityTypes:S?.bulkEntityTypes||w.bulkEntityTypes||null,menuStores:S?.menuStores||w.menuStores||null,menuActions:S?.menuActions||w.menuActions||null,headerActionComponent:S?.headerActionComponent||w.headerActionComponent||null,actualSourceCol:h})})}),i&&typeof o.getExtension=="function"&&(n=n.filter(h=>(o.getExtension(h.extName)?.offline_mode||"none")!=="none"));let p=null;const _=this._spatialState.focusedColumn,P=this._spatialState.columns[_]?.active;if(y.includes(_)&&(p=n.find(h=>pinMatchesSlot(h,P))),!p)for(const h of y){const C=this._spatialState.columns[h]?.active;if(p=n.find(w=>pinMatchesSlot(w,C)),p)break}return p||(p=n[0]),b`
                        <div class="spatial-col ${$===t.id&&l>1?"is-focused":""}" data-col-id="${t.id}" style="--col-width: ${f.getColWidth(a)}; --col-left: ${f.getColLeft(a)};" @click=${h=>{if(this._isPanningTrack){h.preventDefault(),h.stopPropagation();return}const C=p?p.id:n[0]?n[0].id:null,w=p&&p.actualSourceCol||t.id;window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(w),C&&this._updateUrlHash(w,C)}}>
                            <!-- Local Column Header (Projection Stack) -->
                            <div class="col-header" style="justify-content: space-between; padding: 0 0 0 12px; --active-sub-intent: ${p&&p.intent?`var(--intent-${p.intent})`:"var(--intent-primary)"};">
                                <sutram-scrub-track class="sub-tabs" style="flex: 1; padding: 0; height: 100%;">
                                    ${n.map(h=>{const C=p&&pinMatchesSlot(h,p.id),w=h.intent?`var(--intent-${h.intent})`:"var(--intent-primary)",S=h.icon||"component";return b`
                                        <div class="sub-tab ${C?"active":""}"
                                                style="${C?`border-bottom-color: ${w}; color: var(--text);`:""}"
                                                @pointerdown=${T=>{const I=Date.now();if(this._lastTapId===h.id&&I-(this._lastTapTime||0)<300){T.stopPropagation();const z=window.Sutram?.stores?.Layout?.getState();z&&(z.unpinFromColumn(h.actualSourceCol||t.id,h.id),z.openWindow(h,t.id,1)),this._lastTapTime=0;return}this._lastTapId=h.id,this._lastTapTime=I,this._handlePointerDown(T,h,h.actualSourceCol||t.id,"subtab")}}
                                                @dblclick=${T=>{T.stopPropagation();const I=window.Sutram?.stores?.Layout?.getState();I&&(I.unpinFromColumn(h.actualSourceCol||t.id,h.id),I.openWindow(h,t.id,1))}}
                                                @click=${()=>{this._dragState.active||(window.Sutram?.stores?.Layout&&window.Sutram.stores.Layout.getState().setFocusedColumn(h.actualSourceCol||t.id),this._handleSubTabClick(h.id))}}>
                                            <div class="sub-tab-icon-wrapper">
                                                <div class="default-icon-container" style="color: ${w}; opacity:${C?"1":"0.5"};">
                                                    <yv-icon name="${S}" stroke-width="2.5" style="width: 14px; height: 14px;"></yv-icon>
                                                </div>
                                            </div>
                                            ${h.label}${o?.executeUIHook&&o.executeUIHook("sutram:is-projection-dirty",h.id)?"*":""}
                                        </div>
                                    `})}
                                </sutram-scrub-track>
                                <!-- Projection Top Actions -->
                                <div style="display: flex; align-items: stretch; height: 100%;">
                                    ${p&&p.headerActionComponent?b`
                                        <div style="display: flex; align-items: stretch; height: 100%;" data-ext="${p.extName}">${e(p.headerActionComponent,p.id)}</div>
                                    `:""}
                                    ${p?this._layoutConfig.filter(h=>h.slot==="slots:sub-navigation-actions"&&(h.targetSub===p.id||h.extName===p.extName&&(h.targetSub===p.rawId||h.targetSub===`${p.extName}:${p.rawId}`))).map(h=>b`<div style="display: contents;" data-ext="${h.extName}">${e(h.component,p.id)}</div>`):""}
                                    ${p&&(p.bulkActionGroup||p.menuActions)?b`
                                        <sutram-subtab-menu .slotConfig=${p}></sutram-subtab-menu>
                                    `:""}
                                </div>
                            </div>
                            <!-- Pinned Tab Rendering Pool -->
                            <div style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); min-height: 0;">
                                ${n.map(h=>{const C=p&&pinMatchesSlot(h,p.id),w=e(h.component,h.id);return b`
                                        <div style="display: ${C?"flex":"none"}; flex-direction: column; flex: 1; height: 100%; min-height: 0;" data-ext="${h.extName}" data-offline-mode="${(typeof o.getExtension=="function"?o.getExtension(h.extName)?.offline_mode:null)||"none"}">
                                            ${w}
                                        </div>
                                    `})}
                                ${n.length===0?b`
                                    <div style="padding: 20px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 20px;">
                                        No projections allocated to the ${t.id} surface.
                                    </div>
                                `:""}
                            </div>
                        </div>
                        `})}
                    <!-- Grid-Constrained Window Surfaces -->
                    <div class="windowed-surfaces" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;">
                        ${(this._spatialState.windows||[]).map(t=>{const n={left:0,center:1,right:2}[t.anchorCol||"center"]??1;let y=Math.min(t.span||1,3-n);y=Math.min(y,l);const p=f.getWinBounds(n,y,m);return b`
                            <div style="position: absolute; left: ${p.left}; width: ${p.width}; top: 0; bottom: 0; pointer-events: auto; z-index:${t.z||1e3}; transition: left 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);">
                                <sutram-window
                                    .titleText=${t.label||t.id}
                                    .anchorCol=${t.anchorCol||"center"}
                                    .span=${y}
                                    .z=${t.z}
                                    .icon=${t.icon||"component"}
                                    .intent=${t.intent||"neutral"}
                                    @sutram-window-closed=${()=>{this._safeEvict(t.id,()=>{window.Sutram?.stores?.Layout?.getState().closeWindow(t.id)})}}
                                    @sutram-window-span=${_=>window.Sutram?.stores?.Layout?.getState().updateWindowConstraints(t.id,t.anchorCol||"center",_.detail.span)}
                                    @sutram-window-focused=${()=>window.Sutram?.stores?.Layout?.getState().focusWindow(t.id)}
                                    @sutram-window-drag-start=${_=>this._handlePointerDown(_.detail.originalEvent,t,"window","window-header")}
                                    @sutram-window-dock=${()=>{if(t.windowOnly)return;const _=window.Sutram?.stores?.Layout?.getState();if(_){const P=t.preferredColumn||"center";_.closeWindow(t.id),_.pinToColumn(P,t),_.setActiveProjection(P,t.id),_.setFocusedColumn(P),this.requestUpdate()}}}>
                            ${e(t.component,t.id,t.props)}
                        </sutram-window>
                            </div>
                        `})}
                    </div>
                </div>
            </div>
            <!-- Global / Transient Overlays -->
            <div style="display: contents;">
                ${d.map(t=>e(t.component))}
            </div>
            <!-- Spatial Drop-Zone Overlay -->
            <sutram-drag-coordinator  
                .dragState=${{...this._dragState}}  
                .spatialState=${this._spatialState}
                @click=${()=>{this._dragState.active=!1,this.requestUpdate()}}>
            </sutram-drag-coordinator>
        `;return this._projectionPool.commitPass(),s}catch(e){return console.error("[Telemetry] AppShell render error:",e),b`<div style="color:#ef4444; background:#1e293b; padding: 40px; z-index:99999; position:relative; width: 100vw; height: 100vh; overflow-y: auto; box-sizing: border-box;"><h2 style="display: flex; align-items: center; gap: 8px;"><yv-icon name="alert-triangle" style="width: 22px; height: 22px;"></yv-icon><span>AppShell Render Error</span></h2><pre style="white-space: pre-wrap; margin-bottom: 20px;">${e.message}</pre><pre style="white-space: pre-wrap; font-size: 0.85rem; color: #94a3b8;">${e.stack}</pre></div>`}}}customElements.define("sutram-app-shell",SutramAppShell);
