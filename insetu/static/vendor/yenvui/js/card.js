import{LitElement as o,html as e,css as a}from"lit";export class YenvuiCard extends o{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"}};static styles=a`
        :host { display: block; margin-bottom: 12px; position: relative; }
        .selection-gutter {
            position: absolute;
            left: -15px;
            top: 0;
            bottom: 0;
            width: 25px;
            z-index: 5;
            cursor: pointer;
        }
        .card-wrapper {
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-left: 4px solid var(--card-intent, #64748b);
            border-radius: 6px;
            display: flex;
            flex-direction: row;
            position: relative;
            margin-left: 0;
            transition: border-color 0.2s, box-shadow 0.2s, border-left-width 0.2s ease, margin-left 0.2s ease;
        }
        .selection-gutter:hover + .card-wrapper {
            border-left-width: 15px;
            margin-left: -11px;
            border-color: var(--intent-highlight, #8b5cf6);
        }
        :host([_overlayactive]) .card-wrapper {
            border-color: var(--intent-primary, #3b82f6);
            border-bottom-left-radius: 0;
        }
        :host([selected]) .card-wrapper {
            border-left-width: 15px;
            margin-left: -11px;
            border-color: var(--intent-highlight, #8b5cf6);
            box-shadow: 0 0 0 2px var(--intent-highlight, #8b5cf6);
        }
        :host([selected][data-theme="e-ink"]) .card-wrapper {
            box-shadow: 6px 6px 0 #8b5cf6 !important;
        }
        .content-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .card-wrapper:hover {
            border-color: var(--card-intent, #3b82f6);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 12px 15px 8px 15px;
        }
        .card-title {
            font-weight: bold;
            color: var(--text, #e0e0e0);
            font-size: 1.05rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-desc {
            padding: 0 15px 8px 15px;
            color: var(--text-muted, #888);
            font-size: 0.9rem;
        }
        .card-body {
            padding: 0 15px;
            display: flex;
            flex-direction: column;
        }
        .card-detail {
            padding: 8px 15px 12px 15px;
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
        }
        .trigger-bar {
            width: 22px;
            flex-shrink: 0;
            background: var(--card-intent, var(--intent-neutral, #64748b));
            cursor: pointer;
            transition: filter 0.2s;
            display: none;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
            line-height: 1;
            user-select: none;
            border-radius: 0 5px 5px 0;
        }
        :host([has-actions]) .trigger-bar {
            display: flex;
        }
        .trigger-bar:hover {
            filter: brightness(1.2);
        }
        .trigger-icon {
            transition: transform 0.2s ease;
            margin-top: -2px;
        }
        :host([_overlayactive]) .trigger-icon {
            transform: rotate(180deg);
        }
        .actions-tray {
            position: absolute;
            left: -1px;
            right: 21px; /* Avoid trigger bar */
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--intent-primary, #3b82f6);
            display: flex;
            justify-content: flex-end;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px 15px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease-in-out, transform 0.15s ease-in-out;
            z-index: 10;
            top: calc(100% - 1px);
            border-top: none;
            border-radius: 0 0 6px 6px;
            transform: translateY(-10px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        }
        :host([_overlayactive]) .actions-tray {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        :host([data-theme="light"]) .actions-tray {
            background: #ffffff;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        :host([data-theme="e-ink"]) .actions-tray {
            background: #ffffff;
            border: 2px solid #8b5cf6;
            border-top: none;
            box-shadow: 4px 4px 0 #14b8a6;
        }

        /* Unstyled slots for host-injected buttons */
        ::slotted(button) {
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.8rem;
            transition: all 0.2s;
        }
        ::slotted(button:hover) {
            background: var(--bg-hover);
        }
        /* E-Ink High Contrast Overrides */
        :host([data-theme="e-ink"]) .card-wrapper {
            border: 2px solid #8b5cf6 !important;
            box-shadow: 4px 4px 0 #14b8a6 !important;
            background: #ffffff !important;
            color: #000000 !important;
        }
        :host([data-theme="e-ink"]) .card-title {
            color: #000000 !important;
            font-weight: 900 !important;
        }
        :host([data-theme="e-ink"]) .card-desc,
        :host([data-theme="e-ink"]) .card-detail {
            color: #000000 !important;
            opacity: 1 !important;
            font-weight: 600 !important;
        }
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=0,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this)}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._docClickListener),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("click",this._docClickListener),this._themeObserver&&this._themeObserver.disconnect()}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].screenX}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){const i=t.changedTouches[0].screenX,r=this._touchStartX-i;r>40?this.selected?this._toggleSelection():this._hasActions&&(this._overlayActive=!0):r<-40&&(this.selected?this._overlayActive=!1:this._toggleSelection())}_handlePointerDown(t){t.pointerType==="mouse"&&t.button!==0||(this._longPressTimer=setTimeout(()=>{this._justLongPressed=!0,this._toggleSelection(),this._longPressTimer=null},500))}_handlePointerCancel(){this._longPressTimer&&(clearTimeout(this._longPressTimer),this._longPressTimer=null)}_handleSlotChange(t){t.target.assignedNodes({flatten:!0}).length>0&&(this._hasActions=!0)}render(){return e`
            ${this.disableSelection?"":e`<div class="selection-gutter" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div>`}
            <div class="card-wrapper" style="--card-intent: ${this.intentColor||"var(--intent-neutral)"}"
                @mouseleave=${()=>this._overlayActive=!1}
                @touchstart=${this._handleTouchStart}
                @touchend=${this._handleTouchEnd}
                @pointerdown=${this._handlePointerDown}
                @pointerup=${this._handlePointerCancel}
                @pointermove=${this._handlePointerCancel}
                @pointercancel=${this._handlePointerCancel}
                @click=${t=>{this._justLongPressed&&(this._justLongPressed=!1,t.stopPropagation(),t.preventDefault())}}>

                <div class="content-col">
                    <div class="card-header">
                        <div class="card-title">
                            ${this.icon?e`<span>${this.icon}</span>`:""}
                            ${this.titleText}
                        </div>
                    </div>
                    ${this.descriptionText?e`<div class="card-desc">${this.descriptionText}</div>`:""}
                    <div class="card-body">
                        <slot></slot>
                    </div>
                    ${this.detailText?e`<div class="card-detail">${this.detailText}</div>`:""}
                </div>

                <div class="trigger-bar" 
                    @pointerenter=${t=>{t.pointerType==="mouse"&&(this._overlayActive=!0)}}
                    @click=${t=>{t.stopPropagation(),this._overlayActive=!this._overlayActive}}>
                    <span class="trigger-icon">‹</span>
                </div>

                <div class="actions-tray" @click=${t=>{(t.target.tagName==="BUTTON"||t.target.closest("button")||t.target.tagName.includes("YENVUI"))&&(this._overlayActive=!1)}}>
                    <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-card",YenvuiCard);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfVxuICAgIH07XG5cbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGJsb2NrOyBtYXJnaW4tYm90dG9tOiAxMnB4OyBwb3NpdGlvbjogcmVsYXRpdmU7IH1cbiAgICAgICAgLnNlbGVjdGlvbi1ndXR0ZXIge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogLTE1cHg7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjVweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiAwO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYm9yZGVyLWNvbG9yIDAuMnMsIGJveC1zaGFkb3cgMC4ycywgYm9yZGVyLWxlZnQtd2lkdGggMC4ycyBlYXNlLCBtYXJnaW4tbGVmdCAwLjJzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgLnNlbGVjdGlvbi1ndXR0ZXI6aG92ZXIgKyAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNXB4O1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IC0xMXB4O1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNXB4O1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IC0xMXB4O1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDJweCB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA2cHggNnB4IDAgIzhiNWNmNiAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtd3JhcHBlcjpob3ZlciB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE1cHggOHB4IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMDVyZW07XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogOHB4O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWRlc2Mge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDhweCAxNXB4O1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjlyZW07XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogOHB4IDE1cHggMTJweCAxNXB4O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43NXJlbTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1iYXIge1xuICAgICAgICAgICAgd2lkdGg6IDIycHg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtaW50ZW50LCB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4YikpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwIDVweCA1cHggMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbaGFzLWFjdGlvbnNdKSAudHJpZ2dlci1iYXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1iYXI6aG92ZXIge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMik7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItaWNvbiB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlO1xuICAgICAgICAgICAgbWFyZ2luLXRvcDogLTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAudHJpZ2dlci1pY29uIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKDE4MGRlZyk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICBsZWZ0OiAtMXB4O1xuICAgICAgICAgICAgcmlnaHQ6IDIxcHg7IC8qIEF2b2lkIHRyaWdnZXIgYmFyICovXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNik7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTVweDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xNXMgZWFzZS1pbi1vdXQsIHRyYW5zZm9ybSAwLjE1cyBlYXNlLWluLW91dDtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICAgICAgdG9wOiBjYWxjKDEwMCUgLSAxcHgpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDAgMCA2cHggNnB4O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xMHB4KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAyMHB4IHJnYmEoMCwwLDAsMC4zKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMjBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmO1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzhiNWNmNjtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IG5vbmU7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFVuc3R5bGVkIHNsb3RzIGZvciBob3N0LWluamVjdGVkIGJ1dHRvbnMgKi9cbiAgICAgICAgOjpzbG90dGVkKGJ1dHRvbikge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDRweCAxMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOHJlbTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBvcGFjaXR5OiAxICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICBgO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSAwO1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIgPSB0aGlzLl9oYW5kbGVEb2N1bWVudENsaWNrLmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZURvY3VtZW50Q2xpY2soZSkge1xuICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICAgICAgaWYgKCFwYXRoLmluY2x1ZGVzKHRoaXMpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hTdGFydChlKSB7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5zY3JlZW5YO1xuICAgIH1cblxuICAgIF90b2dnbGVTZWxlY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSAhdGhpcy5zZWxlY3RlZDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IHRoaXMuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVRvdWNoRW5kKGUpIHtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5zY3JlZW5YO1xuICAgICAgICBjb25zdCBkZWx0YVggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHRvdWNoRW5kWDtcblxuICAgICAgICBpZiAoZGVsdGFYID4gNDApIHtcbiAgICAgICAgICAgIC8vIExlZnQgU3dpcGVcbiAgICAgICAgICAgIGlmICh0aGlzLnNlbGVjdGVkKSB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuX2hhc0FjdGlvbnMpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGRlbHRhWCA8IC00MCkge1xuICAgICAgICAgICAgLy8gUmlnaHQgU3dpcGVcbiAgICAgICAgICAgIGlmICghdGhpcy5zZWxlY3RlZCkgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICBlbHNlIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVQb2ludGVyRG93bihlKSB7XG4gICAgICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnICYmIGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9qdXN0TG9uZ1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLl9sb25nUHJlc3NUaW1lciA9IG51bGw7XG4gICAgICAgIH0sIDUwMCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVBvaW50ZXJDYW5jZWwoKSB7XG4gICAgICAgIGlmICh0aGlzLl9sb25nUHJlc3NUaW1lcikge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2xvbmdQcmVzc1RpbWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVTbG90Q2hhbmdlKGUpIHtcbiAgICAgICAgY29uc3Qgbm9kZXMgPSBlLnRhcmdldC5hc3NpZ25lZE5vZGVzKHsgZmxhdHRlbjogdHJ1ZSB9KTtcbiAgICAgICAgaWYgKG5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICAkeyF0aGlzLmRpc2FibGVTZWxlY3Rpb24gPyBodG1sYDxkaXYgY2xhc3M9XCJzZWxlY3Rpb24tZ3V0dGVyXCIgdGl0bGU9XCJTZWxlY3QgSXRlbVwiIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpOyB9fT48L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC13cmFwcGVyXCIgc3R5bGU9XCItLWNhcmQtaW50ZW50OiAke3RoaXMuaW50ZW50Q29sb3IgfHwgJ3ZhcigtLWludGVudC1uZXV0cmFsKSd9XCJcbiAgICAgICAgICAgICAgICBAbW91c2VsZWF2ZT0keygpID0+IHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZX1cbiAgICAgICAgICAgICAgICBAdG91Y2hzdGFydD0ke3RoaXMuX2hhbmRsZVRvdWNoU3RhcnR9XG4gICAgICAgICAgICAgICAgQHRvdWNoZW5kPSR7dGhpcy5faGFuZGxlVG91Y2hFbmR9XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJkb3duPSR7dGhpcy5faGFuZGxlUG9pbnRlckRvd259XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJ1cD0ke3RoaXMuX2hhbmRsZVBvaW50ZXJDYW5jZWx9XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJtb3ZlPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcmNhbmNlbD0ke3RoaXMuX2hhbmRsZVBvaW50ZXJDYW5jZWx9XG4gICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9qdXN0TG9uZ1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2p1c3RMb25nUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH19PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWhlYWRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtdGl0bGVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuaWNvbiA/IGh0bWxgPHNwYW4+JHt0aGlzLmljb259PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMudGl0bGVUZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGVzY3JpcHRpb25UZXh0ID8gaHRtbGA8ZGl2IGNsYXNzPVwiY2FyZC1kZXNjXCI+JHt0aGlzLmRlc2NyaXB0aW9uVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWJvZHlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXRhaWxUZXh0ID8gaHRtbGA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWxcIj4ke3RoaXMuZGV0YWlsVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHJpZ2dlci1iYXJcIiBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9ICF0aGlzLl9vdmVybGF5QWN0aXZlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmlnZ2VyLWljb25cIj5cdTIwMzk8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy10cmF5XCIgQGNsaWNrPSR7KGUpID0+IHsgaWYoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uJykgfHwgZS50YXJnZXQudGFnTmFtZS5pbmNsdWRlcygnWUVOVlVJJykpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25zXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1jYXJkJywgWWVudnVpQ2FyZCk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUMvQixhQUFNLG1CQUFtQkYsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGdCQUFpQixDQUFFLEtBQU0sTUFBTyxFQUNoQyxLQUFNLENBQUUsS0FBTSxNQUFPLEVBQ3JCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsU0FBVSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDekMsaUJBQWtCLENBQUUsS0FBTSxPQUFRLEVBQ2xDLGVBQWdCLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMvQyxZQUFhLENBQUUsS0FBTSxRQUFTLFFBQVMsR0FBTSxVQUFXLGFBQWMsQ0FDMUUsRUFFQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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QUFLLGdCQUFrQixXQUFXLElBQU0sQ0FDcEMsS0FBSyxpQkFBbUIsR0FDeEIsS0FBSyxpQkFBaUIsRUFDdEIsS0FBSyxnQkFBa0IsSUFDM0IsRUFBRyxHQUFHLEVBQ1YsQ0FFQSxzQkFBdUIsQ0FDZixLQUFLLGtCQUNMLGFBQWEsS0FBSyxlQUFlLEVBQ2pDLEtBQUssZ0JBQWtCLEtBRS9CLENBRUEsa0JBQWtCQSxFQUFHLENBQ0hBLEVBQUUsT0FBTyxjQUFjLENBQUUsUUFBUyxFQUFLLENBQUMsRUFDNUMsT0FBUyxJQUNmLEtBQUssWUFBYyxHQUUzQixDQUNBLFFBQVMsQ0FDTCxPQUFPRjtBQUFBLGNBQ0EsS0FBSyxpQkFBdUosR0FBcElBLDZEQUFpRUUsR0FBTSxDQUFFQSxFQUFFLGdCQUFnQixFQUFHLEtBQUssaUJBQWlCLENBQUcsQ0FBQyxTQUFjO0FBQUEsOERBQy9HLEtBQUssYUFBZSx1QkFBdUI7QUFBQSw4QkFDM0UsSUFBTSxLQUFLLGVBQWlCLEVBQUs7QUFBQSw4QkFDakMsS0FBSyxpQkFBaUI7QUFBQSw0QkFDeEIsS0FBSyxlQUFlO0FBQUEsK0JBQ2pCLEtBQUssa0JBQWtCO0FBQUEsNkJBQ3pCLEtBQUssb0JBQW9CO0FBQUEsK0JBQ3ZCLEtBQUssb0JBQW9CO0FBQUEsaUNBQ3ZCLEtBQUssb0JBQW9CO0FBQUEseUJBQ2hDQSxHQUFNLENBQ1IsS0FBSyxtQkFDTCxLQUFLLGlCQUFtQixHQUN4QkEsRUFBRSxnQkFBZ0IsRUFDbEJBLEVBQUUsZUFBZSxFQUV6QixDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSw4QkFLYSxLQUFLLEtBQU9GLFVBQWEsS0FBSyxJQUFJLFVBQVksRUFBRTtBQUFBLDhCQUNoRCxLQUFLLFNBQVM7QUFBQTtBQUFBO0FBQUEsc0JBR3RCLEtBQUssZ0JBQWtCQSwyQkFBOEIsS0FBSyxlQUFlLFNBQVcsRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUl0RixLQUFLLFdBQWFBLDZCQUFnQyxLQUFLLFVBQVUsU0FBVyxFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUEsb0NBSS9ERSxHQUFNLENBQU1BLEVBQUUsY0FBZ0IsVUFBUyxLQUFLLGVBQWlCLEdBQU0sQ0FBQztBQUFBLDZCQUMzRUEsR0FBTSxDQUFFQSxFQUFFLGdCQUFnQixFQUFHLEtBQUssZUFBaUIsQ0FBQyxLQUFLLGNBQWdCLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxtREFJcERBLEdBQU0sRUFBS0EsRUFBRSxPQUFPLFVBQVksVUFBWUEsRUFBRSxPQUFPLFFBQVEsUUFBUSxHQUFLQSxFQUFFLE9BQU8sUUFBUSxTQUFTLFFBQVEsS0FBRyxLQUFLLGVBQWlCLEdBQU8sQ0FBQztBQUFBLHVEQUMxSSxLQUFLLGlCQUFpQjtBQUFBO0FBQUE7QUFBQSxTQUl6RSxDQUNKLENBQ0EsZUFBZSxPQUFPLGNBQWUsVUFBVSIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImUiLCAidG91Y2hFbmRYIiwgImRlbHRhWCJdCn0K
