import{LitElement as u,html as c,css as f}from"lit";export class YenvuiCard extends u{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"}};static styles=f`
        :host { display: block; margin-bottom: 12px; position: relative; touch-action: pan-y; }
        .selection-gutter {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 20px;
            z-index: 5;
            cursor: pointer;
            touch-action: pan-y;
        }
        .card-wrapper {
            touch-action: pan-y;
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-left: 4px solid var(--card-intent, #64748b);
            padding-left: 10px;
            border-radius: 6px;
            display: flex;
            flex-direction: row;
            position: relative;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s, border-left-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @media (hover: hover) {
            .selection-gutter:hover + .card-wrapper {
                border-left-width: 14px;
                padding-left: 0px;
                border-color: var(--intent-highlight, #8b5cf6);
            }
            .card-wrapper:hover {
                border-color: var(--card-intent, #3b82f6);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
        }
        :host([_overlayactive]) {
            z-index: 10;
        }
        :host([_overlayactive]) .card-wrapper {
            border-color: var(--intent-primary, #3b82f6);
        }
        :host([selected]) .card-wrapper {
            border-left-width: 14px;
            padding-left: 0px;
            border-color: var(--intent-highlight, #8b5cf6);
            box-shadow: 0 0 0 2px var(--intent-highlight, #8b5cf6);
        }
        .content-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
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
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-desc {
            padding: 0 15px 8px 15px;
            color: var(--text-muted, #888);
            font-size: 0.9rem;
            overflow-wrap: anywhere;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .card-body {
            padding: 0 15px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        ::slotted(*) {
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-detail {
            padding: 8px 15px 12px 15px;
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
            right: -1px;
            top: -1px;
            min-height: calc(100% + 2px);
            box-sizing: border-box;
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--intent-primary, #3b82f6);
            display: flex;
            flex-direction: column;
            justify-content: center;
            /* Pass CSS variables to penetrate slotted async buttons */
            --btn-padding: 6px 12px;
            --btn-font-size: 0.85rem;
            padding: 6px 10px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 10;
            border-radius: 6px;
            transform: scale(0.98);
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        .actions-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 14px; /* Ensure buttons don't clip the absolute caption */
        }
        :host([_overlayactive]) .actions-tray {
            opacity: 1;
            pointer-events: auto;
            transform: scale(1);
        }
        .tray-caption {
            position: absolute;
            top: 4px;
            left: 10px;
            right: 10px;
            font-size: 0.65rem;
            font-weight: bold;
            color: var(--text-muted, #888);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            pointer-events: none;
        }
        :host([data-theme="light"]) .actions-tray {
            background: #ffffff;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        :host([data-theme="e-ink"]) .actions-tray {
            background: #ffffff;
            border: 2px solid #8b5cf6;
            box-shadow: 4px 4px 0 #14b8a6;
        }
        /* Unstyled slots for host-injected buttons */
        ::slotted(button) {
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
            padding: var(--btn-padding) !important;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: var(--btn-font-size) !important;
            transition: all 0.2s;
            box-sizing: border-box;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            margin: 0 !important;
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
            transition: none !important;
        }
        :host([selected][data-theme="e-ink"]) .card-wrapper {
            border-left-width: 14px !important;
            padding-left: 0px !important;
        }
        :host([data-theme="e-ink"]) .actions-tray {
            transition: none !important;
            transform: none !important;
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,s=Math.abs(this._touchStartX-i),l=Math.abs(this._touchStartY-o);this._isSwipingHorizontal===null&&(s>5||l>5)&&(this._isSwipingHorizontal=s>l),this._isSwipingHorizontal&&t.preventDefault()},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1}),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._themeObserver&&this._themeObserver.disconnect()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}}))}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const i=this.getBoundingClientRect();this._cardWidth=i.width,this._localStartX=this._touchStartX-i.left,this._isSwipingHorizontal=null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,s=this._touchStartX-i,l=this._touchStartY-o;if(Math.abs(s)>Math.abs(l)&&Math.abs(s)>30){const n=s>30,p=s<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?p&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(n?this._overlayActive=!0:p&&(this._overlayActive=!1))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}_handlePointerDown(t){t.pointerType==="mouse"&&t.button!==0||(this._longPressTimer=setTimeout(()=>{this._justLongPressed=!0,this._toggleSelection(),this._longPressTimer=null},500))}_handlePointerCancel(){this._longPressTimer&&(clearTimeout(this._longPressTimer),this._longPressTimer=null)}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const i=t.assignedElements({flatten:!0});this._hasActions=i.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return c`
            ${this.disableSelection?"":c`<div class="selection-gutter" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div>`}
            <div class="card-wrapper" style="--card-intent: ${this.intentColor||"var(--intent-neutral)"}"
                @mouseleave=${()=>{window.matchMedia("(hover: hover)").matches&&(this._overlayActive=!1)}}
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
                            ${this.icon?c`<span>${this.icon}</span>`:""}
                            ${this.titleText}
                        </div>
                    </div>
                    ${this.descriptionText?c`<div class="card-desc">${this.descriptionText}</div>`:""}
                    <div class="card-body">
                        <slot></slot>
                    </div>
                    ${this.detailText?c`<div class="card-detail">${this.detailText}</div>`:""}
                </div>

                <div class="trigger-bar" 
                    @pointerenter=${t=>{t.pointerType==="mouse"&&(this._overlayActive=!0)}}
                    @click=${t=>{t.stopPropagation(),t.preventDefault(),this._overlayActive=!this._overlayActive}}>
                    <span class="trigger-icon">‹</span>
                </div>
                <div class="actions-tray" @click=${t=>{(t.target.tagName==="BUTTON"||t.target.closest("button")||t.target.tagName.includes("YENVUI"))&&(this._overlayActive=!1)}}>
                    <span class="tray-caption">${this.titleText}</span>
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `}}customElements.define("yenvui-card",YenvuiCard);let r=null,h=null,a=!1,d=null;function v(e,t,i){let o=document.elementFromPoint(e,t);for(;o&&o.shadowRoot;){const s=o.shadowRoot.elementFromPoint(e,t);if(!s||s===o)break;o=s}for(;o;){if(o.closest&&o.closest(i))return o.closest(i);o=o.getRootNode().host}return null}function b(e,t){for(;e;){if(e.closest&&e.closest(t))return!0;e=e.getRootNode().host}return!1}document.addEventListener("touchstart",e=>{e.touches[0].clientX<30?(a=!0,r=e.touches[0].clientX,h=e.touches[0].clientY,d=null):a=!1},{passive:!0}),document.addEventListener("touchmove",e=>{if(a&&r!==null){if(d===null){const t=Math.abs(e.changedTouches[0].clientX-r),i=Math.abs(e.changedTouches[0].clientY-h);(t>5||i>5)&&(d=t>i?"horizontal":"vertical")}d==="horizontal"?e.preventDefault():d==="vertical"&&(a=!1)}},{passive:!1}),document.addEventListener("touchend",e=>{if(a&&r!==null){const t=e.changedTouches[0].clientX,i=e.changedTouches[0].clientY,o=t-r,s=Math.abs(i-h);if(!b(e.target,"yenvui-card")&&o>30&&o>s){const n=v(t,i,"yenvui-card");n&&!n.disableSelection&&(n.selected=!n.selected,n.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:n.selected},bubbles:!0,composed:!0})))}a=!1,r=null}});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgbWFyZ2luLWJvdHRvbTogMTJweDsgcG9zaXRpb246IHJlbGF0aXZlOyB0b3VjaC1hY3Rpb246IHBhbi15OyB9XG4gICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMTBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzLCBib3gtc2hhZG93IDAuMnMsIGJvcmRlci1sZWZ0LXdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKSwgcGFkZGluZy1sZWZ0IDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICBAbWVkaWEgKGhvdmVyOiBob3Zlcikge1xuICAgICAgICAgICAgLnNlbGVjdGlvbi1ndXR0ZXI6aG92ZXIgKyAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweDtcbiAgICAgICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmNhcmQtd3JhcHBlcjpob3ZlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkge1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAwIDAgMnB4IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpO1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTVweCA4cHggMTVweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGVzYyB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggOHB4IDE1cHg7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xuICAgICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAyO1xuICAgICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKCopIHtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogOHB4IDE1cHggMTJweCAxNXB4O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43NXJlbTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIHdpZHRoOiAyMnB4O1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpKTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGZpbHRlciAwLjJzO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAxLjJyZW07XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMCA1cHggNXB4IDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hhcy1hY3Rpb25zXSkgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyOmhvdmVyIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjIpO1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZTtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IC0ycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLnRyaWdnZXItaWNvbiB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHJvdGF0ZSgxODBkZWcpO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogLTFweDtcbiAgICAgICAgICAgIHJpZ2h0OiAtMXB4O1xuICAgICAgICAgICAgdG9wOiAtMXB4O1xuICAgICAgICAgICAgbWluLWhlaWdodDogY2FsYygxMDAlICsgMnB4KTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNik7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgLyogUGFzcyBDU1MgdmFyaWFibGVzIHRvIHBlbmV0cmF0ZSBzbG90dGVkIGFzeW5jIGJ1dHRvbnMgKi9cbiAgICAgICAgICAgIC0tYnRuLXBhZGRpbmc6IDZweCAxMnB4O1xuICAgICAgICAgICAgLS1idG4tZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDEwcHg7XG4gICAgICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMjVzIGVhc2UsIHRyYW5zZm9ybSAwLjNzIGN1YmljLWJlemllcigwLjE3NSwgMC44ODUsIDAuMzIsIDEuMjc1KTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjk4KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC40KTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IDE0cHg7IC8qIEVuc3VyZSBidXR0b25zIGRvbid0IGNsaXAgdGhlIGFic29sdXRlIGNhcHRpb24gKi9cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRyYXktY2FwdGlvbiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDRweDtcbiAgICAgICAgICAgIGxlZnQ6IDEwcHg7XG4gICAgICAgICAgICByaWdodDogMTBweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC42NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC41cHg7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjY7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNjtcbiAgICAgICAgfVxuICAgICAgICAvKiBVbnN0eWxlZCBzbG90cyBmb3IgaG9zdC1pbmplY3RlZCBidXR0b25zICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b24pIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZykgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF1bZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDEgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lciA9IHRoaXMuX2hhbmRsZURvY3VtZW50Q2xpY2suYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbC5zb3VyY2UgIT09IHRoaXMgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29udGFpbnMoZS5yZWxhdGVkVGFyZ2V0KSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICAvLyBOYXRpdmUgRWRnZS1Td2lwZSBOYXZpZ2F0aW9uIERlZmVhdGVyXG4gICAgICAgIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90b3VjaFN0YXJ0WCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZYID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFggLSBjdXJyZW50WCk7XG4gICAgICAgICAgICBjb25zdCBkaWZmWSA9IE1hdGguYWJzKHRoaXMuX3RvdWNoU3RhcnRZIC0gY3VycmVudFkpO1xuXG4gICAgICAgICAgICAvLyBMb2NrIHRoZSBnZXN0dXJlIGF4aXMgdXBvbiBpbml0aWFsIDVweCBvZiBtb3ZlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGlmZlggPiA1IHx8IGRpZmZZID4gNSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gZGlmZlggPiBkaWZmWTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBnZXN0dXJlIGlzIGhvcml6b250YWwsIGZvcmNlZnVsbHkgaW50ZXJjZXB0IHRoZSB0b3VjaCBldmVudFxuICAgICAgICAgICAgLy8gdG8gcHJldmVudCB0aGUgbW9iaWxlIGJyb3dzZXIgZnJvbSB0cmlnZ2VyaW5nIFwiU3dpcGUgdG8gR28gQmFja1wiXG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lciwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS10aGVtZSddIH0pO1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9kb2NDbGlja0xpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgaWYgKHRoaXMuX3RoZW1lT2JzZXJ2ZXIpIHRoaXMuX3RoZW1lT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ19vdmVybGF5QWN0aXZlJykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLW92ZXJsYXktb3BlbmVkJywge1xuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNvdXJjZTogdGhpcyB9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlRG9jdW1lbnRDbGljayhlKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgICAgICBpZiAoIXBhdGguaW5jbHVkZXModGhpcykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9oYW5kbGVUb3VjaFN0YXJ0KGUpIHtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgdGhpcy5fY2FyZFdpZHRoID0gcmVjdC53aWR0aDtcbiAgICAgICAgdGhpcy5fbG9jYWxTdGFydFggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHJlY3QubGVmdDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgX3RvZ2dsZVNlbGVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9ICF0aGlzLnNlbGVjdGVkO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2FyZC1zZWxlY3QtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogdGhpcy5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoRW5kKGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRvdWNoRW5kWCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCBkZWx0YVggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHRvdWNoRW5kWDtcbiAgICAgICAgY29uc3QgZGVsdGFZID0gdGhpcy5fdG91Y2hTdGFydFkgLSB0b3VjaEVuZFk7XG5cbiAgICAgICAgLy8gRW5zdXJlIGhvcml6b250YWwgc3dpcGUgaXMgZG9taW5hbnQgdG8gcHJldmVudCBhY2NpZGVudGFsIHRyaWdnZXJzIGR1cmluZyB2ZXJ0aWNhbCBzY3JvbGxpbmdcbiAgICAgICAgaWYgKE1hdGguYWJzKGRlbHRhWCkgPiBNYXRoLmFicyhkZWx0YVkpICYmIE1hdGguYWJzKGRlbHRhWCkgPiAzMCkge1xuICAgICAgICAgICAgY29uc3QgaXNMZWZ0U3dpcGUgPSBkZWx0YVggPiAzMDsgICAvLyBSaWdodC10by1MZWZ0XG4gICAgICAgICAgICBjb25zdCBpc1JpZ2h0U3dpcGUgPSBkZWx0YVggPCAtMzA7IC8vIExlZnQtdG8tUmlnaHRcbiAgICAgICAgICAgIC8vIFdpZGVuIHRoZSBoaXQgdGFyZ2V0IHRvIDI1JSBmb3IgYmV0dGVyIGVyZ29ub21pY3MsIGFuZCBndWFyYW50ZWUgYXQgbGVhc3QgNzBweFxuICAgICAgICAgICAgY29uc3QgaXNMZWZ0U2lkZSA9IHRoaXMuX2xvY2FsU3RhcnRYIDwgTWF0aC5tYXgoKHRoaXMuX2NhcmRXaWR0aCAqIDAuMjUpLCA3MCk7XG5cbiAgICAgICAgICAgIGlmIChpc0xlZnRTaWRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmlnaHRTd2lwZSAmJiAhdGhpcy5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFzQWN0aW9ucyA9IHRoaXMuX2hhc0FjdGlvbnMgfHwgISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICAgICAgICAgIGlmIChoYXNBY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0xlZnRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNSaWdodFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgX2hhbmRsZVBvaW50ZXJEb3duKGUpIHtcbiAgICAgICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScgJiYgZS5idXR0b24gIT09IDApIHJldHVybjtcbiAgICAgICAgdGhpcy5fbG9uZ1ByZXNzVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX2p1c3RMb25nUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gbnVsbDtcbiAgICAgICAgfSwgNTAwKTtcbiAgICB9XG5cbiAgICBfaGFuZGxlUG9pbnRlckNhbmNlbCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvbmdQcmVzc1RpbWVyKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fbG9uZ1ByZXNzVGltZXIpO1xuICAgICAgICAgICAgdGhpcy5fbG9uZ1ByZXNzVGltZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZpcnN0VXBkYXRlZCgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgX2NoZWNrQWN0aW9ucygpIHtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdzbG90W25hbWU9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIGlmIChzbG90KSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHNsb3QuYXNzaWduZWRFbGVtZW50cyh7IGZsYXR0ZW46IHRydWUgfSk7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZWxlbWVudHMubGVuZ3RoID4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlU2xvdENoYW5nZShlKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgJHshdGhpcy5kaXNhYmxlU2VsZWN0aW9uID8gaHRtbGA8ZGl2IGNsYXNzPVwic2VsZWN0aW9uLWd1dHRlclwiIHRpdGxlPVwiU2VsZWN0IEl0ZW1cIiBAY2xpY2s9JHsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTsgfX0+PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtd3JhcHBlclwiIHN0eWxlPVwiLS1jYXJkLWludGVudDogJHt0aGlzLmludGVudENvbG9yIHx8ICd2YXIoLS1pbnRlbnQtbmV1dHJhbCknfVwiXG4gICAgICAgICAgICAgICAgQG1vdXNlbGVhdmU9JHsoKSA9PiB7IGlmICh3aW5kb3cubWF0Y2hNZWRpYSgnKGhvdmVyOiBob3ZlciknKS5tYXRjaGVzKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7IH19XG4gICAgICAgICAgICAgICAgQHRvdWNoc3RhcnQ9JHt0aGlzLl9oYW5kbGVUb3VjaFN0YXJ0fVxuICAgICAgICAgICAgICAgIEB0b3VjaGVuZD0ke3RoaXMuX2hhbmRsZVRvdWNoRW5kfVxuICAgICAgICAgICAgICAgIEBwb2ludGVyZG93bj0ke3RoaXMuX2hhbmRsZVBvaW50ZXJEb3dufVxuICAgICAgICAgICAgICAgIEBwb2ludGVydXA9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBwb2ludGVybW92ZT0ke3RoaXMuX2hhbmRsZVBvaW50ZXJDYW5jZWx9XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJjYW5jZWw9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fanVzdExvbmdQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9qdXN0TG9uZ1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9fT5cblxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1oZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXRpdGxlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmljb24gPyBodG1sYDxzcGFuPiR7dGhpcy5pY29ufTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLnRpdGxlVGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRlc2NyaXB0aW9uVGV4dCA/IGh0bWxgPGRpdiBjbGFzcz1cImNhcmQtZGVzY1wiPiR7dGhpcy5kZXNjcmlwdGlvblRleHR9PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1ib2R5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsVGV4dCA/IGh0bWxgPGRpdiBjbGFzcz1cImNhcmQtZGV0YWlsXCI+JHt0aGlzLmRldGFpbFRleHR9PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRyaWdnZXItYmFyXCIgXG4gICAgICAgICAgICAgICAgICAgIEBwb2ludGVyZW50ZXI9JHsoZSkgPT4geyBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IHRydWU7IH19XG4gICAgICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IGUucHJldmVudERlZmF1bHQoKTsgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9ICF0aGlzLl9vdmVybGF5QWN0aXZlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmlnZ2VyLWljb25cIj5cdTIwMzk8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtdHJheVwiIEBjbGljaz0keyhlKSA9PiB7IGlmKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IGUudGFyZ2V0LmNsb3Nlc3QoJ2J1dHRvbicpIHx8IGUudGFyZ2V0LnRhZ05hbWUuaW5jbHVkZXMoJ1lFTlZVSScpKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7IH19PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRyYXktY2FwdGlvblwiPiR7dGhpcy50aXRsZVRleHR9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy13cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYWN0aW9uc1wiIEBzbG90Y2hhbmdlPSR7dGhpcy5faGFuZGxlU2xvdENoYW5nZX0+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNhcmQnLCBZZW52dWlDYXJkKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR0xPQkFMIEVER0UtU1dJUEUgQ09PUkRJTkFUT1IgKE1vZHVsZSBTY29wZSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNhZmFyaSBpZ25vcmVzIENTUyBvdmVyc2Nyb2xsLWJlaGF2aW9yIGZvciBleHRyZW1lIGVkZ2Ugc3dpcGVzLiBcbi8vIFdlIGxvY2sgdGhlIE9TIGdlc3R1cmUgbmF0aXZlbHkgYXQgdGhlIGRvY3VtZW50IGxldmVsIGFuZCByZXNvbHZlIHRoZSBcbi8vIGRyb3AgdGFyZ2V0IHRvIGFsbG93IGdsb2JhbCBjYXJkIHNlbGVjdGlvbiB3aXRob3V0IHJlcXVpcmluZyBhIERPTSB3cmFwcGVyLlxubGV0IF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xubGV0IF9lZGdlU3dpcGVTdGFydFkgPSBudWxsO1xubGV0IF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xubGV0IF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludCh4LCB5LCBzZWxlY3Rvcikge1xuICAgIGxldCBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgd2hpbGUgKGVsICYmIGVsLnNoYWRvd1Jvb3QpIHtcbiAgICAgICAgY29uc3QgZGVlcGVyID0gZWwuc2hhZG93Um9vdC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgICAgICBpZiAoIWRlZXBlciB8fCBkZWVwZXIgPT09IGVsKSBicmVhaztcbiAgICAgICAgZWwgPSBkZWVwZXI7XG4gICAgfVxuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzRWxlbWVudEluc2lkZShlbCwgc2VsZWN0b3IpIHtcbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiB0cnVlO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChlKSA9PiB7XG4gICAgaWYgKGUudG91Y2hlc1swXS5jbGllbnRYIDwgMzApIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gdHJ1ZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IGUudG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRZID0gZS50b3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgIH1cbn0sIHsgcGFzc2l2ZTogdHJ1ZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgNXB4IG9mIG1vdmVtZW50IHRvIG1hdGhlbWF0aWNhbGx5IGxvY2sgdGhlIGF4aXNcbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYIC0gX2VkZ2VTd2lwZVN0YXJ0WCk7XG4gICAgICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuICAgICAgICAgICAgaWYgKGR4ID4gNSB8fCBkeSA+IDUpIHtcbiAgICAgICAgICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gZHggPiBkeSA/ICdob3Jpem9udGFsJyA6ICd2ZXJ0aWNhbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEtpbGxzIFNhZmFyaSBiYWNrLW5hdmlnYXRpb24gJiBsb2NrcyB2ZXJ0aWNhbCBkcmlmdFxuICAgICAgICB9IGVsc2UgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlOyAvLyBSZWxlYXNlcyB0aGUgbG9jayB0byBhbGxvdyBuYXRpdmUgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIH1cbiAgICB9XG59LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IGVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IGVuZFggLSBfZWRnZVN3aXBlU3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSBNYXRoLmFicyhlbmRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG5cbiAgICAgICAgLy8gT25seSBpbnRlcnZlbmUgaWYgdGhlIHN3aXBlIHN0YXJ0ZWQgb24gdGhlIGJhY2tncm91bmQgcGFkZGluZy9ndXR0ZXIuXG4gICAgICAgIGNvbnN0IHN0YXJ0ZWRPbkNhcmQgPSBpc0VsZW1lbnRJbnNpZGUoZS50YXJnZXQsICd5ZW52dWktY2FyZCcpO1xuXG4gICAgICAgIC8vIElmIGl0IHdhcyBhIGNsZWFuIHJpZ2h0d2FyZCBzd2lwZSBmcm9tIHRoZSBiYWNrZ3JvdW5kXG4gICAgICAgIGlmICghc3RhcnRlZE9uQ2FyZCAmJiBkZWx0YVggPiAzMCAmJiBkZWx0YVggPiBkZWx0YVkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludChlbmRYLCBlbmRZLCAneWVudnVpLWNhcmQnKTtcbiAgICAgICAgICAgIGlmIChjYXJkICYmICFjYXJkLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXJkLnNlbGVjdGVkID0gIWNhcmQuc2VsZWN0ZWQ7XG4gICAgICAgICAgICAgICAgY2FyZC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogY2FyZC5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG4gICAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUMvQixhQUFNLG1CQUFtQkYsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGdCQUFpQixDQUFFLEtBQU0sTUFBTyxFQUNoQyxLQUFNLENBQUUsS0FBTSxNQUFPLEVBQ3JCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsU0FBVSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDekMsaUJBQWtCLENBQUUsS0FBTSxPQUFRLEVBQ2xDLGVBQWdCLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMvQyxZQUFhLENBQUUsS0FBTSxRQUFTLFFBQVMsR0FBTSxVQUFXLGFBQWMsQ0FDMUUsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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RUFFcEIsU0FBUyxpQkFBaUIsWUFBYyxHQUFNLENBQzFDLEdBQUlBLEdBQWdCRixJQUFxQixLQUFNLENBRTNDLEdBQUlHLElBQXFCLEtBQU0sQ0FDM0IsTUFBTVEsRUFBSyxLQUFLLElBQUksRUFBRSxlQUFlLENBQUMsRUFBRSxRQUFVWCxDQUFnQixFQUM1RFksRUFBSyxLQUFLLElBQUksRUFBRSxlQUFlLENBQUMsRUFBRSxRQUFVWCxDQUFnQixHQUM5RFUsRUFBSyxHQUFLQyxFQUFLLEtBQ2ZULEVBQW1CUSxFQUFLQyxFQUFLLGFBQWUsV0FFcEQsQ0FFSVQsSUFBcUIsYUFDckIsRUFBRSxlQUFlLEVBQ1ZBLElBQXFCLGFBQzVCRCxFQUFlLEdBRXZCLENBQ0osRUFBRyxDQUFFLFFBQVMsRUFBTSxDQUFDLEVBRXJCLFNBQVMsaUJBQWlCLFdBQWEsR0FBTSxDQUN6QyxHQUFJQSxHQUFnQkYsSUFBcUIsS0FBTSxDQUMzQyxNQUFNYSxFQUFPLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFDM0JDLEVBQU8sRUFBRSxlQUFlLENBQUMsRUFBRSxRQUMzQnBCLEVBQVNtQixFQUFPYixFQUNoQkwsRUFBUyxLQUFLLElBQUltQixFQUFPYixDQUFnQixFQU0vQyxHQUFJLENBSGtCUyxFQUFnQixFQUFFLE9BQVEsYUFBYSxHQUd2Q2hCLEVBQVMsSUFBTUEsRUFBU0MsRUFBUSxDQUNsRCxNQUFNb0IsRUFBT1gsRUFBd0JTLEVBQU1DLEVBQU0sYUFBYSxFQUMxREMsR0FBUSxDQUFDQSxFQUFLLG1CQUNkQSxFQUFLLFNBQVcsQ0FBQ0EsRUFBSyxTQUN0QkEsRUFBSyxjQUFjLElBQUksWUFBWSw2QkFBOEIsQ0FDN0QsT0FBUSxDQUFFLFNBQVVBLEVBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxFQUVWLENBQ0FiLEVBQWUsR0FDZkYsRUFBbUIsSUFDdkIsQ0FDSixDQUFDIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJjdXJyZW50WCIsICJjdXJyZW50WSIsICJkaWZmWCIsICJkaWZmWSIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJyZWN0IiwgInRvdWNoRW5kWCIsICJ0b3VjaEVuZFkiLCAiZGVsdGFYIiwgImRlbHRhWSIsICJpc0xlZnRTd2lwZSIsICJpc1JpZ2h0U3dpcGUiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImVsIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
