import{html as n,css as x}from"lit";import{SutramElement as f}from"./sutram_sdk.js";import"../../yenvui/js/drop-zone.js";export class SutramDragCoordinator extends f{static properties={dragState:{type:Object},spatialState:{type:Object}};static styles=x`
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
            background: var(--pane-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: var(--overlay-shadow, 0 25px 60px rgba(0, 0, 0, 0.6));
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow-y: auto;
            color: var(--text);
            font-family: inherit;
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
            color: #ffffff;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.9rem;
            opacity: 0.9;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            z-index: 10000;
            border: 1px solid rgba(255, 255, 255, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            will-change: transform;
        }

        /* E-Ink High Contrast Theme Overrides */
        :host([data-theme="e-ink"]) .hud-overlay {
            background: rgba(255, 255, 255, 0.9) !important;
            backdrop-filter: none !important;
        }

        :host([data-theme="e-ink"]) .hud-hud-card {
            background: #ffffff !important;
            border: 3px solid #000000 !important;
            color: #000000 !important;
            box-shadow: 6px 6px 0 #000000 !important;
        }

        :host([data-theme="e-ink"]) .section-box {
            border: 2px solid #000000 !important;
            background: #ffffff !important;
        }

        :host([data-theme="e-ink"]) .section-header,
        :host([data-theme="e-ink"]) .hud-header-subtitle,
        :host([data-theme="e-ink"]) .hud-header-title {
            color: #000000 !important;
            font-weight: 900 !important;
        }

        :host([data-theme="e-ink"]) .drop-target-btn {
            background: #ffffff !important;
            border: 2px solid #000000 !important;
            color: #000000 !important;
            font-weight: 800 !important;
        }

        :host([data-theme="e-ink"]) .drop-target-btn[hovered] {
            background: #000000 !important;
            color: #ffffff !important;
        }
        :host([data-theme="e-ink"]) .drag-floater {
            background: #ffffff !important;
            color: #000000 !important;
            border: 2px solid #000000 !important;
            box-shadow: 4px 4px 0 #000000 !important;
        }
    `;connectedCallback(){super.connectedCallback()}updated(e){super.updated(e),e.has("dragState")&&(this._dropZonesCache=null)}getHoveredZone(e,i){this._dropZonesCache||(this._dropZonesCache=Array.from(this.shadowRoot.querySelectorAll("yenvui-drop-target")).map(r=>{const t=r.getBoundingClientRect();return{zone:r.zone,left:t.left,right:t.right,top:t.top,bottom:t.bottom}}));const o=this._dropZonesCache.find(r=>e>=r.left&&e<=r.right&&i>=r.top&&i<=r.bottom);return o?o.zone:null}updatePointer(e,i){const o=this.shadowRoot.querySelector(".drag-floater");o&&(o.style.transform=`translate3d(${e}px, ${i}px, 0) translate(-50%, -50%)`)}render(){if(!this.dragState||!this.dragState.active)return n`<yenvui-drop-overlay></yenvui-drop-overlay>`;const{entity:e,currentX:i,currentY:o,sourceCol:r,currentZone:t,sourceRect:b}=this.dragState,a=this.spatialState?.capacity||3,d=b||{left:0,top:0,width:window.innerWidth,height:window.innerHeight};return n`
            <yenvui-drop-overlay class="hud-overlay" ?active=${!0}>
                <!-- Localized Bounding Box HUD Container -->
                <div class="hud-hud-card" style="left: ${d.left}px; top:${d.top}px; width: ${d.width}px; height:${d.height}px;">

                    <div style="width: 100%; max-width: 500px;">
                        <!-- Header -->
                        <div style="display: flex; flex-direction: column; margin-bottom: 20px;">
                            <div class="hud-header-subtitle">
                                <yv-icon name="split" style="width: 14px; height: 14px;"></yv-icon> REPOSITION OR DOCK
                            </div>
                            <div class="hud-header-title">
                                ${e?.label||e?.id||"Projection"}
                            </div>
                        </div>

                    <!-- TAB POSITION Section -->
                    <div class="section-box tab-pos">
                        <div class="section-header tab-pos">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <yv-icon name="columns" style="width: 14px; height: 14px;"></yv-icon> TAB POSITION
                            </span>
                            <span style="opacity: 0.7;">Drop target column</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <yenvui-drop-target zone="left" class="drop-target-btn intent-primary" .intent=${"primary"} ?hovered=${t==="left"}>
                                Left
                            </yenvui-drop-target>
                            <yenvui-drop-target zone="center" class="drop-target-btn intent-primary" .intent=${"primary"} ?hovered=${t==="center"}>
                                Center
                            </yenvui-drop-target>
                            <yenvui-drop-target zone="right" class="drop-target-btn intent-primary" .intent=${"primary"} ?hovered=${t==="right"} style="${a===2?"opacity: 0.4; pointer-events: none;":""}">
                                Right
                            </yenvui-drop-target>
                        </div>
                    </div>

                    <!-- ARRANGE TABS Section -->
                    ${r&&r!=="window"&&this.spatialState?.columns?.[r]?.pinned?.length>1?n`
                        <div class="section-box arrange-tabs">
                            <div class="section-header arrange-tabs">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <yv-icon name="arrow-left-right" style="width: 14px; height: 14px;"></yv-icon> ARRANGE TABS
                                </span>
                                <span style="opacity: 0.7;">Drop between tabs to reorder</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                ${(()=>{const v=this.spatialState.columns[r].pinned;let s=[...v];const p=s.findIndex(g=>g.id===e?.id);let l=p;if(t&&t.startsWith("reorder-")&&(l=parseInt(t.replace("reorder-",""),10)),p!==-1&&l!==-1&&p!==l){const[g]=s.splice(p,1);s.splice(l,0,g)}return v.map((g,c)=>{const h=s[c],u=t==="reorder-"+c;return n`
                                            ${c>0?n`<span style="color: var(--text-muted); font-size: 0.8rem;">•</span>`:""}
                                            <yenvui-drop-target zone="reorder-${c}" class="drop-target-btn intent-highlight" .intent=${"highlight"} ?hovered=${u}>
                                                <yv-icon name="${h.icon||"component"}" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon>
                                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.label||h.id}</span>
                                            </yenvui-drop-target>
                                        `})})()}
                            </div>
                        </div>
                    `:""}

                    <!-- WINDOW POSITION Section -->
                    <div class="section-box window-pos">
                        <div class="section-header window-pos">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <yv-icon name="layout-grid" style="width: 14px; height: 14px;"></yv-icon> WINDOW POSITION
                            </span>
                            <span style="opacity: 0.7;">Viewport capacity preset</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; gap: 8px;">
                                <yenvui-drop-target zone="span-1-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-1-left"}>
                                    Left
                                </yenvui-drop-target>
                                <yenvui-drop-target zone="span-1-center" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-1-center"}>
                                    Center
                                </yenvui-drop-target>
                                ${a>=3?n`
                                    <yenvui-drop-target zone="span-1-right" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-1-right"}>
                                        Right
                                    </yenvui-drop-target>
                                `:""}
                            </div>

                            ${a>=2?n`
                                <div style="display: flex; gap: 8px;">
                                    <yenvui-drop-target zone="span-2-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-2-left"}>
                                        Left + Center
                                    </yenvui-drop-target>
                                    ${a>=3?n`
                                        <yenvui-drop-target zone="span-2-center" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-2-center"}>
                                            Center + Right
                                        </yenvui-drop-target>
                                    `:""}
                                </div>
                            `:""}

                            ${a>=3?n`
                                <yenvui-drop-target zone="span-3-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-3-left"}>
                                    All Columns
                                </yenvui-drop-target>
                            `:""}
                        </div>
                    </div>
                    <!-- Bottom Close Action -->
                    <yenvui-drop-target zone="close" class="drop-target-btn intent-danger" .intent=${"danger"} ?hovered=${t==="close"}>
                        <yv-icon name="x" style="width: 18px; height: 18px;"></yv-icon> Close
                    </yenvui-drop-target>

                </div>
                <!-- Floating Cursor Node (Hardware Accelerated) -->
                <div class="drag-floater">
                    <yv-icon name="${e?.icon||"component"}" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon> ${e?.label||e?.id||"Dragging"}
                </div>
            </yenvui-drop-overlay>
        `}}customElements.define("sutram-drag-coordinator",SutramDragCoordinator);
