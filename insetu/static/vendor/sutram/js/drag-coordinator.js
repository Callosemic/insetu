import{html as e,css as m}from"lit";import{SutramElement as y}from"./sutram_sdk.js";import"../../yenvui/js/drop-zone.js";export class SutramDragCoordinator extends y{static properties={dragState:{type:Object},spatialState:{type:Object}};static styles=m`
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
    `;connectedCallback(){super.connectedCallback(),this.observeTheme()}updatePointer(r,h){const g=this.shadowRoot.querySelector(".drag-floater");g&&(g.style.transform=`translate3d(${r}px, ${h}px, 0) translate(-50%, -50%)`)}render(){if(!this.dragState||!this.dragState.active)return e`<yenvui-drop-overlay></yenvui-drop-overlay>`;const{entity:r,currentX:h,currentY:g,sourceCol:o,currentZone:t,sourceRect:b}=this.dragState,n=this.spatialState?.capacity||3,i=b||{left:0,top:0,width:window.innerWidth,height:window.innerHeight};return e`
            <yenvui-drop-overlay class="hud-overlay" ?active=${!0}>
                <!-- Localized Bounding Box HUD Container -->
                <div class="hud-hud-card" style="left: ${i.left}px; top:${i.top}px; width: ${i.width}px; height:${i.height}px;">

                    <div style="width: 100%; max-width: 500px;">
                        <!-- Header -->
                        <div style="display: flex; flex-direction: column; margin-bottom: 20px;">
                            <div class="hud-header-subtitle">
                                <yv-icon name="split" style="width: 14px; height: 14px;"></yv-icon> REPOSITION OR DOCK
                            </div>
                            <div class="hud-header-title">
                                ${r?.label||r?.id||"Projection"}
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
                                Left Flank
                            </yenvui-drop-target>
                            <yenvui-drop-target zone="center" class="drop-target-btn intent-primary" .intent=${"primary"} ?hovered=${t==="center"}>
                                Center Focus
                            </yenvui-drop-target>
                            <yenvui-drop-target zone="right" class="drop-target-btn intent-primary" .intent=${"primary"} ?hovered=${t==="right"} style="${n===2?"opacity: 0.4; pointer-events: none;":""}">
                                Right Flank
                            </yenvui-drop-target>
                        </div>
                    </div>

                    <!-- ARRANGE TABS Section -->
                    ${o&&o!=="window"&&this.spatialState?.columns?.[o]?.pinned?.length>1?e`
                        <div class="section-box arrange-tabs">
                            <div class="section-header arrange-tabs">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <yv-icon name="arrow-left-right" style="width: 14px; height: 14px;"></yv-icon> ARRANGE TABS
                                </span>
                                <span style="opacity: 0.7;">Drop between tabs to reorder</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                ${(()=>{const v=this.spatialState.columns[o].pinned;let a=[...v];const d=a.findIndex(p=>p.id===r?.id);let s=d;if(t&&t.startsWith("reorder-")&&(s=parseInt(t.replace("reorder-",""),10)),d!==-1&&s!==-1&&d!==s){const[p]=a.splice(d,1);a.splice(s,0,p)}return v.map((p,l)=>{const c=a[l],x=t==="reorder-"+l;return e`
                                            ${l>0?e`<span style="color: var(--text-muted); font-size: 0.8rem;">•</span>`:""}
                                            <yenvui-drop-target zone="reorder-${l}" class="drop-target-btn intent-highlight" .intent=${"highlight"} ?hovered=${x}>
                                                <yv-icon name="${c.icon||"component"}" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon>
                                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.label||c.id}</span>
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
                                    Left Flank
                                </yenvui-drop-target>
                                <yenvui-drop-target zone="span-1-center" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-1-center"}>
                                    Center Focus
                                </yenvui-drop-target>
                                ${n>=3?e`
                                    <yenvui-drop-target zone="span-1-right" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-1-right"}>
                                        Right Flank
                                    </yenvui-drop-target>
                                `:""}
                            </div>

                            ${n>=2?e`
                                <div style="display: flex; gap: 8px;">
                                    <yenvui-drop-target zone="span-2-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-2-left"}>
                                        Left + Center
                                    </yenvui-drop-target>
                                    ${n>=3?e`
                                        <yenvui-drop-target zone="span-2-center" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-2-center"}>
                                            Center + Right
                                        </yenvui-drop-target>
                                    `:""}
                                </div>
                            `:""}

                            ${n>=3?e`
                                <yenvui-drop-target zone="span-3-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-3-left"}>
                                    All 3 Columns
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
                    <yv-icon name="${r?.icon||"component"}" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"></yv-icon> ${r?.label||r?.id||"Dragging"}
                </div>
            </yenvui-drop-overlay>
        `}}customElements.define("sutram-drag-coordinator",SutramDragCoordinator);
