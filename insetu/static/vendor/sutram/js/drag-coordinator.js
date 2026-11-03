import{html as n,css as S}from"lit";import{SutramElement as C}from"./sutram_sdk.js";import{DropOverlay as _,DropTarget as O}from"sutram-chassis";customElements.get("sutram-drop-overlay")||customElements.define("sutram-drop-overlay",class extends _{}),customElements.get("sutram-drop-target")||customElements.define("sutram-drop-target",class extends O{});export class SutramDragCoordinator extends C{static properties={dragState:{type:Object},spatialState:{type:Object},_activeMode:{type:String,state:!0}};static styles=S`
        :host {
            display: contents;
        }

        .hud-overlay {
            overflow: hidden;
            background: color-mix(in srgb, var(--bg-deep, #000000) 75%, transparent);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
        }
        .hud-hud-card {
            position: absolute;
            background: color-mix(in srgb, var(--pane-bg) 94%, transparent);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid var(--border);
            padding: 12px 16px 16px 16px;
            box-sizing: border-box;
            box-shadow: var(--overlay-shadow, 0 25px 60px rgba(0, 0, 0, 0.6));
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow-y: auto;
            color: var(--text);
            font-family: inherit;
        }

        .top-anchor-row {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            width: 100%;
            gap: 12px;
            flex-shrink: 0;
        }

        .top-third-slot {
            width: calc((100% - 24px) / 3);
            display: flex;
        }
        .middle-workspace {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 520px;
            margin: 22px auto auto auto;
            gap: 14px;
        }

        .mode-switcher-row {
            display: flex;
            width: 100%;
            gap: 12px;
        }

        .mode-switcher-btn {
            flex: 1;
            width: 50%;
            height: 58px;
            border-radius: 10px;
            border: 2px solid var(--border);
            background: var(--input-bg);
            color: var(--text-muted);
            font-weight: 700;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.15s ease;
            box-sizing: border-box;
        }

        .mode-switcher-btn.active-mode.tab-mode {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 14%, var(--input-bg));
            color: var(--intent-primary);
        }

        .mode-switcher-btn.active-mode.win-mode {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 14%, var(--input-bg));
            color: var(--intent-warning);
        }

        .mode-switcher-btn[hovered].tab-mode {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 28%, var(--input-bg));
            color: var(--intent-primary);
            transform: scale(1.02);
        }

        .mode-switcher-btn[hovered].win-mode {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 28%, var(--input-bg));
            color: var(--intent-warning);
            transform: scale(1.02);
        }

        .screen-drop-btn {
            flex: 1;
            height: 76px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--text);
            font-weight: 600;
            font-size: 0.85rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            box-sizing: border-box;
        }

        .screen-drop-btn.intent-primary[hovered] {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 22%, var(--input-bg));
            color: var(--intent-primary);
        }

        .screen-drop-btn.intent-warning[hovered] {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 22%, var(--input-bg));
            color: var(--intent-warning);
        }

        .bottom-anchor-footer {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-top: auto;
            padding-top: 12px;
            flex-shrink: 0;
        }

        .hud-header-subtitle {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--intent-primary);
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .hud-header-title {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--intent-highlight);
            margin-top: 4px;
        }

        /* Section Cards */
        .section-box {
            border-radius: 10px;
            padding: 14px;
            margin-bottom: 14px;
            border: 1px solid transparent;
        }

        .section-box.tab-pos {
            border-color: color-mix(in srgb, var(--intent-primary) 30%, transparent);
            background: color-mix(in srgb, var(--intent-primary) 5%, var(--pane-bg));
        }

        .section-box.arrange-tabs {
            border-color: color-mix(in srgb, var(--intent-highlight) 30%, transparent);
            background: color-mix(in srgb, var(--intent-highlight) 5%, var(--pane-bg));
        }

        .section-box.window-pos {
            border-color: color-mix(in srgb, var(--intent-warning) 30%, transparent);
            background: color-mix(in srgb, var(--intent-warning) 5%, var(--pane-bg));
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.8px;
        }

        .section-header.tab-pos { color: var(--intent-primary); }
        .section-header.arrange-tabs { color: var(--intent-highlight); }
        .section-header.window-pos { color: var(--intent-warning); }

        /* Drop Target Buttons */
        .drop-target-btn {
            flex: 1;
            height: 44px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: var(--text);
            font-weight: 500;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            box-sizing: border-box;
        }

        .drop-target-btn.intent-primary[hovered] {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--input-bg));
            color: var(--intent-primary);
        }

        .drop-target-btn.intent-highlight[hovered] {
            border-color: var(--intent-highlight);
            background: color-mix(in srgb, var(--intent-highlight) 20%, var(--input-bg));
            color: var(--intent-highlight);
        }

        .drop-target-btn.intent-warning[hovered] {
            border-color: var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 20%, var(--input-bg));
            color: var(--intent-warning);
        }

        .drop-target-btn.intent-danger {
            width: 100%;
            height: 48px;
            border-radius: 10px;
            border-color: color-mix(in srgb, var(--intent-danger) 40%, transparent);
            background: color-mix(in srgb, var(--intent-danger) 10%, var(--input-bg));
            color: var(--intent-danger);
        }

        .drop-target-btn.intent-danger[hovered] {
            border-color: var(--intent-danger);
            background: color-mix(in srgb, var(--intent-danger) 25%, var(--input-bg));
            color: var(--intent-danger);
        }
        /* Floating Drag Node */
        .drag-floater {
            position: fixed;
            left: 0;
            top: 0;
            pointer-events: none;
            background: var(--intent-highlight);
            color: var(--text-light, #ffffff);
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.9rem;
            opacity: 0.9;
            box-shadow: var(--overlay-shadow, 0 10px 25px rgba(0, 0, 0, 0.4));
            z-index: 10000;
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 8px;
            will-change: transform;
        }

        /* E-Ink High Contrast Theme Overrides */
        :host-context([data-theme="e-ink"]) .hud-overlay {
            background: var(--modal-backdrop, rgba(255, 255, 255, 0.9)) !important;
            backdrop-filter: none !important;
        }

        :host-context([data-theme="e-ink"]) .hud-hud-card {
            background: var(--bg, #ffffff) !important;
            border: 3px solid var(--border, #000000) !important;
            color: var(--text, #000000) !important;
            box-shadow: 6px 6px 0 var(--border, #000000) !important;
        }

        :host-context([data-theme="e-ink"]) .section-box {
            border: 2px solid var(--border, #000000) !important;
            background: var(--bg, #ffffff) !important;
        }

        :host-context([data-theme="e-ink"]) .section-header,
        :host-context([data-theme="e-ink"]) .hud-header-subtitle,
        :host-context([data-theme="e-ink"]) .hud-header-title {
            color: var(--text, #000000) !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]) .drop-target-btn,
        :host-context([data-theme="e-ink"]) .mode-switcher-btn,
        :host-context([data-theme="e-ink"]) .screen-drop-btn {
            background: var(--bg, #ffffff) !important;
            border: 2px solid var(--border, #000000) !important;
            color: var(--text, #000000) !important;
            font-weight: 800 !important;
        }

        :host-context([data-theme="e-ink"]) .mode-switcher-btn.active-mode {
            border-style: dashed !important;
            box-shadow: 3px 3px 0 var(--border, #000000) !important;
        }

        :host-context([data-theme="e-ink"]) .drop-target-btn[hovered],
        :host-context([data-theme="e-ink"]) .mode-switcher-btn[hovered],
        :host-context([data-theme="e-ink"]) .screen-drop-btn[hovered] {
            background: var(--text, #000000) !important;
            color: var(--bg, #ffffff) !important;
        }
        :host-context([data-theme="e-ink"]) .drag-floater {
            background: var(--bg, #ffffff) !important;
            color: var(--text, #000000) !important;
            border: 2px solid var(--border, #000000) !important;
            box-shadow: 4px 4px 0 var(--border, #000000) !important;
        }
    `;constructor(){super(),this._activeMode="tab",this._lastDragActive=!1}connectedCallback(){super.connectedCallback()}willUpdate(t){if(super.willUpdate(t),t.has("dragState")){const a=!!this.dragState?.active;if(a&&!this._lastDragActive){const o=this.dragState?.entity,e=this.dragState?.sourceCol;this._activeMode=o?.windowOnly||e==="window"?"window":"tab"}this._lastDragActive=a;const r=this.dragState?.currentZone;r==="mode-tab"||["left","center","right"].includes(r)||r&&r.startsWith("reorder-")?!this.dragState?.entity?.windowOnly&&this._activeMode!=="tab"&&(this._activeMode="tab"):(r==="mode-window"||r==="window"||r&&r.startsWith("span-"))&&this._activeMode!=="window"&&(this._activeMode="window")}}updated(t){super.updated(t),(t.has("dragState")||t.has("_activeMode"))&&(this._dropZonesCache=null,this.dragState?.active&&this.dragState.currentX!==void 0&&this.dragState.currentY!==void 0&&this.updatePointer(this.dragState.currentX,this.dragState.currentY))}getHoveredZone(t,a){this._dropZonesCache||(this._dropZonesCache=Array.from(this.shadowRoot.querySelectorAll("yenvui-drop-target")).map(e=>{const i=e.getBoundingClientRect();return{zone:e.zone,left:i.left,right:i.right,top:i.top,bottom:i.bottom}}));const r=this._dropZonesCache.find(e=>t>=e.left&&t<=e.right&&a>=e.top&&a<=e.bottom),o=r?r.zone:null;return o==="mode-tab"&&!this.dragState?.entity?.windowOnly&&this._activeMode!=="tab"?(this._activeMode="tab",this._dropZonesCache=null,this.requestUpdate()):o==="mode-window"&&this._activeMode!=="window"&&(this._activeMode="window",this._dropZonesCache=null,this.requestUpdate()),o}updatePointer(t,a){const r=this.shadowRoot.querySelector(".drag-floater");r&&(r.style.transform=`translate3d(${t}px, ${a}px, 0) translate(-50%, -50%)`)}render(){if(!this.dragState||!this.dragState.active)return n`<yenvui-drop-overlay></yenvui-drop-overlay>`;const{entity:t,currentX:a,currentY:r,sourceCol:o,currentZone:e,sourceRect:i}=this.dragState,s=this.spatialState?.capacity||3,d=i||{left:0,top:0,width:window.innerWidth,height:window.innerHeight},b=(window.Sutram?.stores?.Layout?.getState()?.canPopout?window.Sutram.stores.Layout.getState().canPopout():!0)&&!!(t?.allow_popout||t?.id&&window.ExtensionRegistry?.resolveCustomEditor?.(t.id)||t?.id&&window.ExtensionRegistry?.executeUIHook?.("sutram:is-popoutable",t.id)||t?.id&&t.id.includes("://")),h=t?.windowOnly?"window":this._activeMode,x=`left: ${d.left}px; top: ${d.top}px; width: ${d.width}px; height: ${d.height}px;`,f=`transform: translate3d(${a||0}px, ${r||0}px, 0) translate(-50%, -50%);`,w=`mode-switcher-btn tab-mode ${h==="tab"?"active-mode":""}`,y=`mode-switcher-btn win-mode ${h==="window"?"active-mode":""}`,$=s===2?"opacity: 0.4; pointer-events: none;":"";return n`
            <yenvui-drop-overlay class="hud-overlay" ?active=${!0}>
                <div class="hud-hud-card" style=${x}>
                    <div class="top-anchor-row">
                        <div class="top-third-slot">
                            ${b?n`
                                <yenvui-drop-target zone="popout" class="drop-target-btn intent-highlight" .intent=${"highlight"} ?hovered=${e==="popout"} style="width: 100%; height: 42px;">
                                    <sutram-icon name="external-link" size="md"></sutram-icon> Pop Out
                                </yenvui-drop-target>
                            `:""}
                        </div>
                        <div class="top-third-slot"></div>
                        <div class="top-third-slot">
                            <yenvui-drop-target zone="close" class="drop-target-btn intent-danger" .intent=${"danger"} ?hovered=${e==="close"} style="width: 100%; height: 42px;">
                                <sutram-icon name="x" size="md"></sutram-icon> Close
                            </yenvui-drop-target>
                        </div>
                    </div>

                    <div class="middle-workspace">
                        <div class="mode-switcher-row">
                            ${t?.windowOnly?"":n`
                                <yenvui-drop-target zone="mode-tab" class=${w} .intent=${"primary"} ?hovered=${e==="mode-tab"}>
                                    <sutram-icon name="columns" size="md"></sutram-icon> Tab
                                </yenvui-drop-target>
                            `}
                            <yenvui-drop-target zone="mode-window" class=${y} .intent=${"warning"} ?hovered=${e==="mode-window"}>
                                <sutram-icon name="layout-grid" size="md"></sutram-icon> Window
                            </yenvui-drop-target>
                        </div>

                        ${h==="tab"&&!t?.windowOnly?n`
                            <div class="section-box tab-pos" style="margin-bottom: 0;">
                                <div class="section-header tab-pos">
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <sutram-icon name="columns" size="sm"></sutram-icon> TAB POSITION
                                    </span>
                                    <span style="opacity: 0.7;">Drop target column</span>
                                </div>
                                <div style="display: flex; gap: 10px;">
                                    <yenvui-drop-target zone="left" class="screen-drop-btn intent-primary" .intent=${"primary"} ?hovered=${e==="left"}>
                                        <sutram-icon name="panel-left" size="md"></sutram-icon>
                                        <span>Left</span>
                                    </yenvui-drop-target>
                                    <yenvui-drop-target zone="center" class="screen-drop-btn intent-primary" .intent=${"primary"} ?hovered=${e==="center"}>
                                        <sutram-icon name="columns" size="md"></sutram-icon>
                                        <span>Center</span>
                                    </yenvui-drop-target>
                                    <yenvui-drop-target zone="right" class="screen-drop-btn intent-primary" .intent=${"primary"} ?hovered=${e==="right"} style=${$}>
                                        <sutram-icon name="panel-right" size="md"></sutram-icon>
                                        <span>Right</span>
                                    </yenvui-drop-target>
                                </div>
                            </div>

                            ${o&&o!=="window"&&this.spatialState?.columns?.[o]?.pinned?.length>1?n`
                                <div class="section-box arrange-tabs" style="margin-bottom: 0;">
                                    <div class="section-header arrange-tabs">
                                        <span style="display: flex; align-items: center; gap: 6px;">
                                            <sutram-icon name="arrow-left-right" size="sm"></sutram-icon> ARRANGE TABS
                                        </span>
                                        <span style="opacity: 0.7;">Drop to reorder</span>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                        ${(()=>{const u=this.spatialState.columns[o].pinned;let p=[...u];const c=p.findIndex(g=>g.id===t?.id);let l=c;if(e&&e.startsWith("reorder-")&&(l=parseInt(e.replace("reorder-",""),10)),c!==-1&&l!==-1&&c!==l){const[g]=p.splice(c,1);p.splice(l,0,g)}return u.map((g,m)=>{const v=p[m],k=e==="reorder-"+m,z="reorder-"+m;return n`
                                                    ${m>0?n`<span style="color: var(--text-muted); font-size: 0.8rem;">•</span>`:""}
                                                    <yenvui-drop-target zone=${z} class="drop-target-btn intent-highlight" .intent=${"highlight"} ?hovered=${k}>
                                                        <sutram-icon name=${v.icon||"component"} size="sm"></sutram-icon>
                                                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.label||v.id}</span>
                                                    </yenvui-drop-target>
                                                `})})()}
                                    </div>
                                </div>
                            `:""}
                        `:n`
                            <div class="section-box window-pos" style="margin-bottom: 0;">
                                <div class="section-header window-pos">
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <sutram-icon name="layout-grid" size="sm"></sutram-icon> WINDOW POSITION
                                    </span>
                                    <span style="opacity: 0.7;">Viewport capacity preset</span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <div style="display: flex; gap: 10px;">
                                        <yenvui-drop-target zone="span-1-left" class="screen-drop-btn intent-warning" .intent=${"warning"} ?hovered=${e==="span-1-left"}>
                                            <sutram-icon name="panel-left" size="md"></sutram-icon>
                                            <span>Left</span>
                                        </yenvui-drop-target>
                                        <yenvui-drop-target zone="span-1-center" class="screen-drop-btn intent-warning" .intent=${"warning"} ?hovered=${e==="span-1-center"}>
                                            <sutram-icon name="square" size="md"></sutram-icon>
                                            <span>Center</span>
                                        </yenvui-drop-target>
                                        ${s>=3?n`
                                            <yenvui-drop-target zone="span-1-right" class="screen-drop-btn intent-warning" .intent=${"warning"} ?hovered=${e==="span-1-right"}>
                                                <sutram-icon name="panel-right" size="md"></sutram-icon>
                                                <span>Right</span>
                                            </yenvui-drop-target>
                                        `:""}
                                    </div>

                                    ${s>=2?n`
                                        <div style="display: flex; gap: 10px;">
                                            <yenvui-drop-target zone="span-2-left" class="screen-drop-btn intent-warning" .intent=${"warning"} ?hovered=${e==="span-2-left"}>
                                                <sutram-icon name="columns" size="md"></sutram-icon>
                                                <span>Left + Center</span>
                                            </yenvui-drop-target>
                                            ${s>=3?n`
                                                <yenvui-drop-target zone="span-2-center" class="screen-drop-btn intent-warning" .intent=${"warning"} ?hovered=${e==="span-2-center"}>
                                                    <sutram-icon name="columns" size="md"></sutram-icon>
                                                    <span>Center + Right</span>
                                                </yenvui-drop-target>
                                            `:""}
                                        </div>
                                    `:""}

                                    ${s>=3?n`
                                        <yenvui-drop-target zone="span-3-left" class="screen-drop-btn intent-warning" .intent=${"warning"} ?hovered=${e==="span-3-left"} style="height: 60px;">
                                            <sutram-icon name="maximize-2" size="md"></sutram-icon>
                                            <span>Span Across</span>
                                        </yenvui-drop-target>
                                    `:""}
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="bottom-anchor-footer">
                        <div class="hud-header-subtitle" style="justify-content: center;">
                            <sutram-icon name="split" size="sm"></sutram-icon> ${t?.id||"REPOSITION OR DOCK"}
                        </div>
                        <div class="hud-header-title">
                            ${t?.label||t?.id||"Projection"}
                        </div>
                    </div>
                </div>
                <div class="drag-floater" style=${f}>
                    <sutram-icon name=${t?.icon||"component"} size="md"></sutram-icon> ${t?.label||t?.id||"Dragging"}
                </div>
            </yenvui-drop-overlay>
        `}}customElements.define("sutram-drag-coordinator",SutramDragCoordinator);
