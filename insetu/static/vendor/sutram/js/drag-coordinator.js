import{html as r,css as u}from"lit";import{SutramElement as f}from"./sutram_sdk.js";import"../../yenvui/js/drop-zone.js";export class SutramDragCoordinator extends f{static properties={dragState:{type:Object},spatialState:{type:Object}};static styles=u`
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
    `;connectedCallback(){super.connectedCallback(),this.observeTheme()}updatePointer(e,h){const g=this.shadowRoot.querySelector(".drag-floater");g&&(g.style.transform=`translate3d(${e}px, ${h}px, 0) translate(-50%, -50%)`)}updated(e){super.updated(e),window.lucide&&typeof window.lucide.createIcons=="function"&&window.lucide.createIcons({root:this.shadowRoot})}render(){if(!this.dragState||!this.dragState.active)return r`<yenvui-drop-overlay></yenvui-drop-overlay>`;const{entity:e,currentX:h,currentY:g,sourceCol:i,currentZone:t,sourceRect:b}=this.dragState,n=this.spatialState?.capacity||3,a=b||{left:0,top:0,width:window.innerWidth,height:window.innerHeight};return r`
            <yenvui-drop-overlay class="hud-overlay" ?active=${!0}>
                <!-- Localized Bounding Box HUD Container -->
                <div class="hud-hud-card" style="left: ${a.left}px; top:${a.top}px; width: ${a.width}px; height:${a.height}px;">

                    <div style="width: 100%; max-width: 500px;">
                        <!-- Header -->
                        <div style="display: flex; flex-direction: column; margin-bottom: 20px;">
                            <div class="hud-header-subtitle">
                                <i data-lucide="split" style="width: 14px; height: 14px;"></i> REPOSITION OR DOCK
                            </div>
                            <div class="hud-header-title">
                                ${e?.label||e?.id||"Projection"}
                            </div>
                        </div>

                    <!-- TAB POSITION Section -->
                    <div class="section-box tab-pos">
                        <div class="section-header tab-pos">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="columns" style="width: 14px; height: 14px;"></i> TAB POSITION
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
                    ${i&&i!=="window"&&this.spatialState?.columns?.[i]?.pinned?.length>1?r`
                        <div class="section-box arrange-tabs">
                            <div class="section-header arrange-tabs">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <i data-lucide="arrow-left-right" style="width: 14px; height: 14px;"></i> ARRANGE TABS
                                </span>
                                <span style="opacity: 0.7;">Drop between tabs to reorder</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                ${(()=>{const v=this.spatialState.columns[i].pinned;let o=[...v];const d=o.findIndex(p=>p.id===e?.id);let s=d;if(t&&t.startsWith("reorder-")&&(s=parseInt(t.replace("reorder-",""),10)),d!==-1&&s!==-1&&d!==s){const[p]=o.splice(d,1);o.splice(s,0,p)}return v.map((p,l)=>{const c=o[l],x=t==="reorder-"+l;return r`
                                            ${l>0?r`<span style="color: var(--text-muted); font-size: 0.8rem;">•</span>`:""}
                                            <yenvui-drop-target zone="reorder-${l}" class="drop-target-btn intent-highlight" .intent=${"highlight"} ?hovered=${x}>
                                                <i data-lucide="${c.icon||"component"}" style="width: 14px; height: 14px;"></i>
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
                                <i data-lucide="layout-grid" style="width: 14px; height: 14px;"></i> WINDOW POSITION
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
                                ${n>=3?r`
                                    <yenvui-drop-target zone="span-1-right" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-1-right"}>
                                        Right Flank
                                    </yenvui-drop-target>
                                `:""}
                            </div>

                            ${n>=2?r`
                                <div style="display: flex; gap: 8px;">
                                    <yenvui-drop-target zone="span-2-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-2-left"}>
                                        Left + Center
                                    </yenvui-drop-target>
                                    ${n>=3?r`
                                        <yenvui-drop-target zone="span-2-center" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-2-center"}>
                                            Center + Right
                                        </yenvui-drop-target>
                                    `:""}
                                </div>
                            `:""}

                            ${n>=3?r`
                                <yenvui-drop-target zone="span-3-left" class="drop-target-btn intent-warning" .intent=${"warning"} ?hovered=${t==="span-3-left"}>
                                    All 3 Columns
                                </yenvui-drop-target>
                            `:""}
                        </div>
                    </div>
                    <!-- Bottom Close Action -->
                    <yenvui-drop-target zone="close" class="drop-target-btn intent-danger" .intent=${"danger"} ?hovered=${t==="close"}>
                        <i data-lucide="x" style="width: 18px; height: 18px;"></i> Close
                    </yenvui-drop-target>

                </div>
                <!-- Floating Cursor Node (Hardware Accelerated) -->
                <div class="drag-floater">
                    <i data-lucide="${e?.icon||"component"}" style="width: 16px; height: 16px;"></i> ${e?.label||e?.id||"Dragging"}
                </div>
            </yenvui-drop-overlay>
        `}}customElements.define("sutram-drag-coordinator",SutramDragCoordinator);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gc3V0cmFtL3N1dHJhbS9qcy9kcmFnLWNvb3JkaW5hdG9yLmpzXG5pbXBvcnQgeyBodG1sLCBjc3MgfSBmcm9tICdsaXQnO1xuaW1wb3J0IHsgU3V0cmFtRWxlbWVudCB9IGZyb20gJy4vc3V0cmFtX3Nkay5qcyc7XG5pbXBvcnQgJy4uLy4uL3llbnZ1aS9qcy9kcm9wLXpvbmUuanMnO1xuZXhwb3J0IGNsYXNzIFN1dHJhbURyYWdDb29yZGluYXRvciBleHRlbmRzIFN1dHJhbUVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICBkcmFnU3RhdGU6IHsgdHlwZTogT2JqZWN0IH0sXG4gICAgICAgIHNwYXRpYWxTdGF0ZTogeyB0eXBlOiBPYmplY3QgfVxuICAgIH07XG5cbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBjb250ZW50cztcbiAgICAgICAgfVxuXG4gICAgICAgIC5odWQtb3ZlcmxheSB7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWJnLWRlZXAsICMwMDAwMDApIDc1JSwgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDZweCk7XG4gICAgICAgICAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjogYmx1cig2cHgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLmh1ZC1odWQtY2FyZCB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1wYW5lLWJnKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBib3gtc2hhZG93OiB2YXIoLS1vdmVybGF5LXNoYWRvdywgMCAyNXB4IDYwcHggcmdiYSgwLCAwLCAwLCAwLjYpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiBpbmhlcml0O1xuICAgICAgICB9XG5cbiAgICAgICAgLmh1ZC1oZWFkZXItc3VidGl0bGUge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlbnQtcHJpbWFyeSk7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjdyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDFweDtcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgIH1cblxuICAgICAgICAuaHVkLWhlYWRlci10aXRsZSB7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZW50LWhpZ2hsaWdodCk7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBTZWN0aW9uIENhcmRzICovXG4gICAgICAgIC5zZWN0aW9uLWJveCB7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMTRweDtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDE0cHg7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB0cmFuc3BhcmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5zZWN0aW9uLWJveC50YWItcG9zIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC1wcmltYXJ5KSAzMCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1pbnRlbnQtcHJpbWFyeSkgNSUsIHZhcigtLXBhbmUtYmcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5zZWN0aW9uLWJveC5hcnJhbmdlLXRhYnMge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0taW50ZW50LWhpZ2hsaWdodCkgMzAlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0taW50ZW50LWhpZ2hsaWdodCkgNSUsIHZhcigtLXBhbmUtYmcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5zZWN0aW9uLWJveC53aW5kb3ctcG9zIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC13YXJuaW5nKSAzMCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1pbnRlbnQtd2FybmluZykgNSUsIHZhcigtLXBhbmUtYmcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5zZWN0aW9uLWhlYWRlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjdyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuOHB4O1xuICAgICAgICB9XG5cbiAgICAgICAgLnNlY3Rpb24taGVhZGVyLnRhYi1wb3MgeyBjb2xvcjogdmFyKC0taW50ZW50LXByaW1hcnkpOyB9XG4gICAgICAgIC5zZWN0aW9uLWhlYWRlci5hcnJhbmdlLXRhYnMgeyBjb2xvcjogdmFyKC0taW50ZW50LWhpZ2hsaWdodCk7IH1cbiAgICAgICAgLnNlY3Rpb24taGVhZGVyLndpbmRvdy1wb3MgeyBjb2xvcjogdmFyKC0taW50ZW50LXdhcm5pbmcpOyB9XG5cbiAgICAgICAgLyogRHJvcCBUYXJnZXQgQnV0dG9ucyAqL1xuICAgICAgICAuZHJvcC10YXJnZXQtYnRuIHtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBoZWlnaHQ6IDQ0cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDZweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTBweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjE1cyBlYXNlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5kcm9wLXRhcmdldC1idG4uaW50ZW50LXByaW1hcnlbaG92ZXJlZF0ge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1pbnRlbnQtcHJpbWFyeSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0taW50ZW50LXByaW1hcnkpIDIwJSwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlbnQtcHJpbWFyeSk7XG4gICAgICAgIH1cblxuICAgICAgICAuZHJvcC10YXJnZXQtYnRuLmludGVudC1oaWdobGlnaHRbaG92ZXJlZF0ge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0KSAyMCUsIHZhcigtLWlucHV0LWJnKSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZW50LWhpZ2hsaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAuZHJvcC10YXJnZXQtYnRuLmludGVudC13YXJuaW5nW2hvdmVyZWRdIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0taW50ZW50LXdhcm5pbmcpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC13YXJuaW5nKSAyMCUsIHZhcigtLWlucHV0LWJnKSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZW50LXdhcm5pbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLmRyb3AtdGFyZ2V0LWJ0bi5pbnRlbnQtZGFuZ2VyIHtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgaGVpZ2h0OiA0OHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC1kYW5nZXIpIDQwJSwgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC1kYW5nZXIpIDEwJSwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlbnQtZGFuZ2VyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5kcm9wLXRhcmdldC1idG4uaW50ZW50LWRhbmdlcltob3ZlcmVkXSB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWludGVudC1kYW5nZXIpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC1kYW5nZXIpIDI1JSwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlbnQtZGFuZ2VyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIEZsb2F0aW5nIERyYWcgTm9kZSAqL1xuICAgICAgICAuZHJhZy1mbG9hdGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1oaWdobGlnaHQpO1xuICAgICAgICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICAgICAgICBwYWRkaW5nOiA4cHggMTZweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuOTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAyNXB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjMpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIHdpbGwtY2hhbmdlOiB0cmFuc2Zvcm07XG4gICAgICAgIH1cblxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IFRoZW1lIE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuaHVkLW92ZXJsYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5odWQtaHVkLWNhcmQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAzcHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDZweCA2cHggMCAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuc2VjdGlvbi1ib3gge1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnNlY3Rpb24taGVhZGVyLFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuaHVkLWhlYWRlci1zdWJ0aXRsZSxcbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmh1ZC1oZWFkZXItdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5kcm9wLXRhcmdldC1idG4ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA4MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5kcm9wLXRhcmdldC1idG5baG92ZXJlZF0ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5kcmFnLWZsb2F0ZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMub2JzZXJ2ZVRoZW1lKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlUG9pbnRlcih4LCB5KSB7XG4gICAgICAgIGNvbnN0IGZsb2F0ZXIgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignLmRyYWctZmxvYXRlcicpO1xuICAgICAgICBpZiAoZmxvYXRlcikge1xuICAgICAgICAgICAgZmxvYXRlci5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlM2QoJHt4fXB4LCAke3l9cHgsIDApIHRyYW5zbGF0ZSgtNTAlLCAtNTAlKWA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAod2luZG93Lmx1Y2lkZSAmJiB0eXBlb2Ygd2luZG93Lmx1Y2lkZS5jcmVhdGVJY29ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgd2luZG93Lmx1Y2lkZS5jcmVhdGVJY29ucyh7IHJvb3Q6IHRoaXMuc2hhZG93Um9vdCB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIGlmICghdGhpcy5kcmFnU3RhdGUgfHwgIXRoaXMuZHJhZ1N0YXRlLmFjdGl2ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGh0bWxgPHllbnZ1aS1kcm9wLW92ZXJsYXk+PC95ZW52dWktZHJvcC1vdmVybGF5PmA7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGVudGl0eSwgY3VycmVudFgsIGN1cnJlbnRZLCBzb3VyY2VDb2wsIGN1cnJlbnRab25lLCBzb3VyY2VSZWN0IH0gPSB0aGlzLmRyYWdTdGF0ZTtcbiAgICAgICAgY29uc3QgY2FwYWNpdHkgPSB0aGlzLnNwYXRpYWxTdGF0ZT8uY2FwYWNpdHkgfHwgMztcblxuICAgICAgICAvLyBGYWxsYmFjayByZWN0IGlmIHRoZSBzb3VyY2UgZXh0cmFjdGlvbiBmYWlsZWQgbmF0aXZlbHlcbiAgICAgICAgY29uc3QgcmVjdCA9IHNvdXJjZVJlY3QgfHwgeyBsZWZ0OiAwLCB0b3A6IDAsIHdpZHRoOiB3aW5kb3cuaW5uZXJXaWR0aCwgaGVpZ2h0OiB3aW5kb3cuaW5uZXJIZWlnaHQgfTtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8eWVudnVpLWRyb3Atb3ZlcmxheSBjbGFzcz1cImh1ZC1vdmVybGF5XCIgP2FjdGl2ZT0ke3RydWV9PlxuICAgICAgICAgICAgICAgIDwhLS0gTG9jYWxpemVkIEJvdW5kaW5nIEJveCBIVUQgQ29udGFpbmVyIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJodWQtaHVkLWNhcmRcIiBzdHlsZT1cImxlZnQ6ICR7cmVjdC5sZWZ0fXB4OyB0b3A6JHtyZWN0LnRvcH1weDsgd2lkdGg6ICR7cmVjdC53aWR0aH1weDsgaGVpZ2h0OiR7cmVjdC5oZWlnaHR9cHg7XCI+XG5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiAxMDAlOyBtYXgtd2lkdGg6IDUwMHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPCEtLSBIZWFkZXIgLS0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgbWFyZ2luLWJvdHRvbTogMjBweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaHVkLWhlYWRlci1zdWJ0aXRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aSBkYXRhLWx1Y2lkZT1cInNwbGl0XCIgc3R5bGU9XCJ3aWR0aDogMTRweDsgaGVpZ2h0OiAxNHB4O1wiPjwvaT4gUkVQT1NJVElPTiBPUiBET0NLXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImh1ZC1oZWFkZXItdGl0bGVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtlbnRpdHk/LmxhYmVsIHx8IGVudGl0eT8uaWQgfHwgJ1Byb2plY3Rpb24nfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgPCEtLSBUQUIgUE9TSVRJT04gU2VjdGlvbiAtLT5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNlY3Rpb24tYm94IHRhYi1wb3NcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRlciB0YWItcG9zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDZweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGkgZGF0YS1sdWNpZGU9XCJjb2x1bW5zXCIgc3R5bGU9XCJ3aWR0aDogMTRweDsgaGVpZ2h0OiAxNHB4O1wiPjwvaT4gVEFCIFBPU0lUSU9OXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwib3BhY2l0eTogMC43O1wiPkRyb3AgdGFyZ2V0IGNvbHVtbjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGdhcDogMTBweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8eWVudnVpLWRyb3AtdGFyZ2V0IHpvbmU9XCJsZWZ0XCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LXByaW1hcnlcIiAuaW50ZW50PSR7J3ByaW1hcnknfSA/aG92ZXJlZD0ke2N1cnJlbnRab25lID09PSAnbGVmdCd9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMZWZ0IEZsYW5rXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC95ZW52dWktZHJvcC10YXJnZXQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHllbnZ1aS1kcm9wLXRhcmdldCB6b25lPVwiY2VudGVyXCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LXByaW1hcnlcIiAuaW50ZW50PSR7J3ByaW1hcnknfSA/aG92ZXJlZD0ke2N1cnJlbnRab25lID09PSAnY2VudGVyJ30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENlbnRlciBGb2N1c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwveWVudnVpLWRyb3AtdGFyZ2V0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx5ZW52dWktZHJvcC10YXJnZXQgem9uZT1cInJpZ2h0XCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LXByaW1hcnlcIiAuaW50ZW50PSR7J3ByaW1hcnknfSA/aG92ZXJlZD0ke2N1cnJlbnRab25lID09PSAncmlnaHQnfSBzdHlsZT1cIiR7Y2FwYWNpdHkgPT09IDIgPyAnb3BhY2l0eTogMC40OyBwb2ludGVyLWV2ZW50czogbm9uZTsnIDogJyd9XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJpZ2h0IEZsYW5rXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC95ZW52dWktZHJvcC10YXJnZXQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgPCEtLSBBUlJBTkdFIFRBQlMgU2VjdGlvbiAtLT5cbiAgICAgICAgICAgICAgICAgICAgJHtzb3VyY2VDb2wgJiYgc291cmNlQ29sICE9PSAnd2luZG93JyAmJiB0aGlzLnNwYXRpYWxTdGF0ZT8uY29sdW1ucz8uW3NvdXJjZUNvbF0/LnBpbm5lZD8ubGVuZ3RoID4gMSA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VjdGlvbi1ib3ggYXJyYW5nZS10YWJzXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZGVyIGFycmFuZ2UtdGFic1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogNnB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGkgZGF0YS1sdWNpZGU9XCJhcnJvdy1sZWZ0LXJpZ2h0XCIgc3R5bGU9XCJ3aWR0aDogMTRweDsgaGVpZ2h0OiAxNHB4O1wiPjwvaT4gQVJSQU5HRSBUQUJTXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJvcGFjaXR5OiAwLjc7XCI+RHJvcCBiZXR3ZWVuIHRhYnMgdG8gcmVvcmRlcjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgZ2FwOiA4cHg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGZsZXgtd3JhcDogd3JhcDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHsoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUYWJzID0gdGhpcy5zcGF0aWFsU3RhdGUuY29sdW1uc1tzb3VyY2VDb2xdLnBpbm5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2aXN1YWxUYWJzID0gWy4uLm9yaWdpbmFsVGFic107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50SW5kZXggPSB2aXN1YWxUYWJzLmZpbmRJbmRleChwID0+IHAuaWQgPT09IGVudGl0eT8uaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRhcmdldEluZGV4ID0gY3VycmVudEluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudFpvbmUgJiYgY3VycmVudFpvbmUuc3RhcnRzV2l0aCgncmVvcmRlci0nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldEluZGV4ID0gcGFyc2VJbnQoY3VycmVudFpvbmUucmVwbGFjZSgncmVvcmRlci0nLCAnJyksIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRJbmRleCAhPT0gLTEgJiYgdGFyZ2V0SW5kZXggIT09IC0xICYmIGN1cnJlbnRJbmRleCAhPT0gdGFyZ2V0SW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBbbW92ZWRdID0gdmlzdWFsVGFicy5zcGxpY2UoY3VycmVudEluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXN1YWxUYWJzLnNwbGljZSh0YXJnZXRJbmRleCwgMCwgbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxUYWJzLm1hcCgocCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZUYWIgPSB2aXN1YWxUYWJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IGN1cnJlbnRab25lID09PSAncmVvcmRlci0nICsgaTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtpID4gMCA/IGh0bWxgPHNwYW4gc3R5bGU9XCJjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IGZvbnQtc2l6ZTogMC44cmVtO1wiPlx1MjAyMjwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx5ZW52dWktZHJvcC10YXJnZXQgem9uZT1cInJlb3JkZXItJHtpfVwiIGNsYXNzPVwiZHJvcC10YXJnZXQtYnRuIGludGVudC1oaWdobGlnaHRcIiAuaW50ZW50PSR7J2hpZ2hsaWdodCd9ID9ob3ZlcmVkPSR7aXNIb3ZlcmVkfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpIGRhdGEtbHVjaWRlPVwiJHt2VGFiLmljb24gfHwgJ2NvbXBvbmVudCd9XCIgc3R5bGU9XCJ3aWR0aDogMTRweDsgaGVpZ2h0OiAxNHB4O1wiPjwvaT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwib3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7IHdoaXRlLXNwYWNlOiBub3dyYXA7XCI+JHt2VGFiLmxhYmVsIHx8IHZUYWIuaWR9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3llbnZ1aS1kcm9wLXRhcmdldD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuXG4gICAgICAgICAgICAgICAgICAgIDwhLS0gV0lORE9XIFBPU0lUSU9OIFNlY3Rpb24gLS0+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZWN0aW9uLWJveCB3aW5kb3ctcG9zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkZXIgd2luZG93LXBvc1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA2cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpIGRhdGEtbHVjaWRlPVwibGF5b3V0LWdyaWRcIiBzdHlsZT1cIndpZHRoOiAxNHB4OyBoZWlnaHQ6IDE0cHg7XCI+PC9pPiBXSU5ET1cgUE9TSVRJT05cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJvcGFjaXR5OiAwLjc7XCI+Vmlld3BvcnQgY2FwYWNpdHkgcHJlc2V0PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgZ2FwOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGdhcDogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8eWVudnVpLWRyb3AtdGFyZ2V0IHpvbmU9XCJzcGFuLTEtbGVmdFwiIGNsYXNzPVwiZHJvcC10YXJnZXQtYnRuIGludGVudC13YXJuaW5nXCIgLmludGVudD0keyd3YXJuaW5nJ30gP2hvdmVyZWQ9JHtjdXJyZW50Wm9uZSA9PT0gJ3NwYW4tMS1sZWZ0J30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMZWZ0IEZsYW5rXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwveWVudnVpLWRyb3AtdGFyZ2V0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8eWVudnVpLWRyb3AtdGFyZ2V0IHpvbmU9XCJzcGFuLTEtY2VudGVyXCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LXdhcm5pbmdcIiAuaW50ZW50PSR7J3dhcm5pbmcnfSA/aG92ZXJlZD0ke2N1cnJlbnRab25lID09PSAnc3Bhbi0xLWNlbnRlcid9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2VudGVyIEZvY3VzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwveWVudnVpLWRyb3AtdGFyZ2V0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2NhcGFjaXR5ID49IDMgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHllbnZ1aS1kcm9wLXRhcmdldCB6b25lPVwic3Bhbi0xLXJpZ2h0XCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LXdhcm5pbmdcIiAuaW50ZW50PSR7J3dhcm5pbmcnfSA/aG92ZXJlZD0ke2N1cnJlbnRab25lID09PSAnc3Bhbi0xLXJpZ2h0J30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmlnaHQgRmxhbmtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwveWVudnVpLWRyb3AtdGFyZ2V0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2NhcGFjaXR5ID49IDIgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgZ2FwOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8eWVudnVpLWRyb3AtdGFyZ2V0IHpvbmU9XCJzcGFuLTItbGVmdFwiIGNsYXNzPVwiZHJvcC10YXJnZXQtYnRuIGludGVudC13YXJuaW5nXCIgLmludGVudD0keyd3YXJuaW5nJ30gP2hvdmVyZWQ9JHtjdXJyZW50Wm9uZSA9PT0gJ3NwYW4tMi1sZWZ0J30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTGVmdCArIENlbnRlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC95ZW52dWktZHJvcC10YXJnZXQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2NhcGFjaXR5ID49IDMgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx5ZW52dWktZHJvcC10YXJnZXQgem9uZT1cInNwYW4tMi1jZW50ZXJcIiBjbGFzcz1cImRyb3AtdGFyZ2V0LWJ0biBpbnRlbnQtd2FybmluZ1wiIC5pbnRlbnQ9JHsnd2FybmluZyd9ID9ob3ZlcmVkPSR7Y3VycmVudFpvbmUgPT09ICdzcGFuLTItY2VudGVyJ30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENlbnRlciArIFJpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC95ZW52dWktZHJvcC10YXJnZXQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAgOiAnJ31cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7Y2FwYWNpdHkgPj0gMyA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx5ZW52dWktZHJvcC10YXJnZXQgem9uZT1cInNwYW4tMy1sZWZ0XCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LXdhcm5pbmdcIiAuaW50ZW50PSR7J3dhcm5pbmcnfSA/aG92ZXJlZD0ke2N1cnJlbnRab25lID09PSAnc3Bhbi0zLWxlZnQnfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsbCAzIENvbHVtbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC95ZW52dWktZHJvcC10YXJnZXQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8IS0tIEJvdHRvbSBDbG9zZSBBY3Rpb24gLS0+XG4gICAgICAgICAgICAgICAgICAgIDx5ZW52dWktZHJvcC10YXJnZXQgem9uZT1cImNsb3NlXCIgY2xhc3M9XCJkcm9wLXRhcmdldC1idG4gaW50ZW50LWRhbmdlclwiIC5pbnRlbnQ9JHsnZGFuZ2VyJ30gP2hvdmVyZWQ9JHtjdXJyZW50Wm9uZSA9PT0gJ2Nsb3NlJ30+XG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBkYXRhLWx1Y2lkZT1cInhcIiBzdHlsZT1cIndpZHRoOiAxOHB4OyBoZWlnaHQ6IDE4cHg7XCI+PC9pPiBDbG9zZVxuICAgICAgICAgICAgICAgICAgICA8L3llbnZ1aS1kcm9wLXRhcmdldD5cblxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwhLS0gRmxvYXRpbmcgQ3Vyc29yIE5vZGUgKEhhcmR3YXJlIEFjY2VsZXJhdGVkKSAtLT5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZHJhZy1mbG9hdGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxpIGRhdGEtbHVjaWRlPVwiJHtlbnRpdHk/Lmljb24gfHwgJ2NvbXBvbmVudCd9XCIgc3R5bGU9XCJ3aWR0aDogMTZweDsgaGVpZ2h0OiAxNnB4O1wiPjwvaT4gJHtlbnRpdHk/LmxhYmVsIHx8IGVudGl0eT8uaWQgfHwgJ0RyYWdnaW5nJ31cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwveWVudnVpLWRyb3Atb3ZlcmxheT5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3N1dHJhbS1kcmFnLWNvb3JkaW5hdG9yJywgU3V0cmFtRHJhZ0Nvb3JkaW5hdG9yKTsiXSwKICAibWFwcGluZ3MiOiAiQUFDQSxPQUFTLFFBQUFBLEVBQU0sT0FBQUMsTUFBVyxNQUMxQixPQUFTLGlCQUFBQyxNQUFxQixrQkFDOUIsTUFBTywrQkFDQSxhQUFNLDhCQUE4QkEsQ0FBYyxDQUNyRCxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixhQUFjLENBQUUsS0FBTSxNQUFPLENBQ2pDLEVBRUEsT0FBTyxPQUFTRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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L0MsT0FBT3BCO0FBQUEsOENBQ0RvQixFQUFJLEVBQUlwQix1RUFBNEUsRUFBRTtBQUFBLGdGQUNwRG9CLENBQUMsc0RBQXNELFdBQVcsYUFBYUUsQ0FBUztBQUFBLGtFQUN0R0QsRUFBSyxNQUFRLFdBQVc7QUFBQSxnSUFDc0NBLEVBQUssT0FBU0EsRUFBSyxFQUFFO0FBQUE7QUFBQSx5Q0FHakgsQ0FBQyxDQUNMLEdBQUcsQ0FBQztBQUFBO0FBQUE7QUFBQSxzQkFHWixFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHdIQVk4RixTQUFTLGFBQWFWLElBQWdCLGFBQWE7QUFBQTtBQUFBO0FBQUEsMEhBR2pELFNBQVMsYUFBYUEsSUFBZ0IsZUFBZTtBQUFBO0FBQUE7QUFBQSxrQ0FHN0lFLEdBQVksRUFBSWI7QUFBQSw2SEFDMkUsU0FBUyxhQUFhVyxJQUFnQixjQUFjO0FBQUE7QUFBQTtBQUFBLGtDQUc3SSxFQUFFO0FBQUE7QUFBQTtBQUFBLDhCQUdSRSxHQUFZLEVBQUliO0FBQUE7QUFBQSw0SEFFOEUsU0FBUyxhQUFhVyxJQUFnQixhQUFhO0FBQUE7QUFBQTtBQUFBLHNDQUd6SUUsR0FBWSxFQUFJYjtBQUFBLGtJQUM0RSxTQUFTLGFBQWFXLElBQWdCLGVBQWU7QUFBQTtBQUFBO0FBQUEsc0NBRy9JLEVBQUU7QUFBQTtBQUFBLDhCQUVWLEVBQUU7QUFBQTtBQUFBLDhCQUVKRSxHQUFZLEVBQUliO0FBQUEsd0hBQzBFLFNBQVMsYUFBYVcsSUFBZ0IsYUFBYTtBQUFBO0FBQUE7QUFBQSw4QkFHM0ksRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBLHFHQUltRSxRQUFRLGFBQWFBLElBQWdCLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQ0FPM0dKLEdBQVEsTUFBUSxXQUFXLDZDQUE2Q0EsR0FBUSxPQUFTQSxHQUFRLElBQU0sVUFBVTtBQUFBO0FBQUE7QUFBQSxTQUluSixDQUNKLENBQ0EsZUFBZSxPQUFPLDBCQUEyQixxQkFBcUIiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiU3V0cmFtRWxlbWVudCIsICJ4IiwgInkiLCAiZmxvYXRlciIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJlbnRpdHkiLCAiY3VycmVudFgiLCAiY3VycmVudFkiLCAic291cmNlQ29sIiwgImN1cnJlbnRab25lIiwgInNvdXJjZVJlY3QiLCAiY2FwYWNpdHkiLCAicmVjdCIsICJvcmlnaW5hbFRhYnMiLCAidmlzdWFsVGFicyIsICJjdXJyZW50SW5kZXgiLCAidGFyZ2V0SW5kZXgiLCAibW92ZWQiLCAiaSIsICJ2VGFiIiwgImlzSG92ZXJlZCJdCn0K
