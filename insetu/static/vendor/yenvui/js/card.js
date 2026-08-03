import{LitElement as u,html as l,css as f}from"lit";export class YenvuiCard extends u{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=f`
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
                border-color: var(--card-intent, #3b82f6);
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
            border-color: var(--card-intent, #3b82f6);
        }
        :host([selected]) .card-wrapper {
            border-left-width: 14px;
            padding-left: 0px;
            border-color: var(--card-intent, #3b82f6);
            box-shadow: 0 0 0 1px var(--card-intent, #3b82f6);
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
            padding: 0 15px 15px 15px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        :host([flush]) .card-body {
            padding: 0;
        }
        ::slotted(*) {
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-detail {
            padding: 0 15px 12px 15px;
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
            right: 21px;
            top: -1px;
            min-height: calc(100% + 2px);
            box-sizing: border-box;
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-right: none;
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
            border-radius: 6px 0 0 6px;
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
            border: 2px solid #000000;
            border-right: none;
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

        /* --- Compact Mode Variant --- */
        :host([compact]) {
            margin-bottom: 8px;
        }
        :host([compact]) .card-wrapper {
            align-items: center;
        }
        :host([compact]) .content-col {
            flex-direction: row;
            align-items: center;
            padding: 6px 12px;
        }
        :host([compact]) .card-header {
            padding: 0;
        }
        :host([compact]) .card-title {
            font-size: 0.95rem;
        }
        :host([compact]) .card-desc,
        :host([compact]) .card-body {
            display: none;
        }
        :host([compact]) .card-detail {
            padding: 0 0 0 10px;
            margin-left: auto;
        }
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,s=Math.abs(this._touchStartX-i),c=Math.abs(this._touchStartY-o);this._isSwipingHorizontal===null&&(s>5||c>5)&&(this._isSwipingHorizontal=s>c),this._isSwipingHorizontal&&t.preventDefault()},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1}),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._themeObserver&&this._themeObserver.disconnect()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const i=this.getBoundingClientRect();this._cardWidth=i.width,this._localStartX=this._touchStartX-i.left,this._isSwipingHorizontal=null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,s=this._touchStartX-i,c=this._touchStartY-o;if(Math.abs(s)>Math.abs(c)&&Math.abs(s)>30){const n=s>30,p=s<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?p&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(n?this._overlayActive=!0:p&&(this._overlayActive=!1))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}_handlePointerDown(t){t.pointerType==="mouse"&&t.button!==0||(this._longPressTimer=setTimeout(()=>{this._justLongPressed=!0,this._toggleSelection(),this._longPressTimer=null},500))}_handlePointerCancel(){this._longPressTimer&&(clearTimeout(this._longPressTimer),this._longPressTimer=null)}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const i=t.assignedElements({flatten:!0});this._hasActions=i.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return l`
            ${this.disableSelection?"":l`<div class="selection-gutter" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div>`}
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
                            ${this.icon?l`<span>${this.icon}</span>`:""}
                            ${this.titleText}
                        </div>
                    </div>
                    ${this.descriptionText?l`<div class="card-desc">${this.descriptionText}</div>`:""}
                    <div class="card-body">
                        <slot></slot>
                    </div>
                    ${this.detailText?l`<div class="card-detail">${this.detailText}</div>`:""}
                    <slot name="inline-actions"></slot>
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgbWFyZ2luLWJvdHRvbTogMTJweDsgcG9zaXRpb246IHJlbGF0aXZlOyB0b3VjaC1hY3Rpb246IHBhbi15OyB9XG4gICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMTBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzLCBib3gtc2hhZG93IDAuMnMsIGJvcmRlci1sZWZ0LXdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKSwgcGFkZGluZy1sZWZ0IDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICBAbWVkaWEgKGhvdmVyOiBob3Zlcikge1xuICAgICAgICAgICAgLnNlbGVjdGlvbi1ndXR0ZXI6aG92ZXIgKyAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweDtcbiAgICAgICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5jYXJkLXdyYXBwZXI6aG92ZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIHtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3NlbGVjdGVkXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweDtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMHB4O1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDAgMCAxcHggdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTVweCA4cHggMTVweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGVzYyB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggOHB4IDE1cHg7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xuICAgICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAyO1xuICAgICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggMTVweCAxNXB4O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoKikge1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWRldGFpbCB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggMTJweCAxNXB4O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43NXJlbTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIHdpZHRoOiAyMnB4O1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpKTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGZpbHRlciAwLjJzO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAxLjJyZW07XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMCA1cHggNXB4IDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hhcy1hY3Rpb25zXSkgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyOmhvdmVyIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjIpO1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZTtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IC0ycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLnRyaWdnZXItaWNvbiB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHJvdGF0ZSgxODBkZWcpO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogLTFweDtcbiAgICAgICAgICAgIHJpZ2h0OiAyMXB4O1xuICAgICAgICAgICAgdG9wOiAtMXB4O1xuICAgICAgICAgICAgbWluLWhlaWdodDogY2FsYygxMDAlICsgMnB4KTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIC8qIFBhc3MgQ1NTIHZhcmlhYmxlcyB0byBwZW5ldHJhdGUgc2xvdHRlZCBhc3luYyBidXR0b25zICovXG4gICAgICAgICAgICAtLWJ0bi1wYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgICAgIC0tYnRuLWZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDZweCAxMHB4O1xuICAgICAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cyBlYXNlLCB0cmFuc2Zvcm0gMC4zcyBjdWJpYy1iZXppZXIoMC4xNzUsIDAuODg1LCAwLjMyLCAxLjI3NSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAwIDAgNnB4O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjk4KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC40KTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IDE0cHg7IC8qIEVuc3VyZSBidXR0b25zIGRvbid0IGNsaXAgdGhlIGFic29sdXRlIGNhcHRpb24gKi9cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRyYXktY2FwdGlvbiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDRweDtcbiAgICAgICAgICAgIGxlZnQ6IDEwcHg7XG4gICAgICAgICAgICByaWdodDogMTBweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC42NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC41cHg7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNjtcbiAgICAgICAgfVxuICAgICAgICAvKiBVbnN0eWxlZCBzbG90cyBmb3IgaG9zdC1pbmplY3RlZCBidXR0b25zICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b24pIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZykgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF1bZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDEgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIC0tLSBDb21wYWN0IE1vZGUgVmFyaWFudCAtLS0gKi9cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAwIDAgMTBweDtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kb2NDbGlja0xpc3RlbmVyID0gdGhpcy5faGFuZGxlRG9jdW1lbnRDbGljay5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vdmVybGF5TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZGV0YWlsLnNvdXJjZSAhPT0gdGhpcyAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9mb2N1c091dExpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jb250YWlucyhlLnJlbGF0ZWRUYXJnZXQpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3Vzb3V0JywgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHRoaXMuX292ZXJsYXlMaXN0ZW5lcik7XG4gICAgICAgIC8vIE5hdGl2ZSBFZGdlLVN3aXBlIE5hdmlnYXRpb24gRGVmZWF0ZXJcbiAgICAgICAgdGhpcy5fdG91Y2hNb3ZlTGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICAgICAgY29uc3QgZGlmZlggPSBNYXRoLmFicyh0aGlzLl90b3VjaFN0YXJ0WCAtIGN1cnJlbnRYKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZZID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFkgLSBjdXJyZW50WSk7XG5cbiAgICAgICAgICAgIC8vIExvY2sgdGhlIGdlc3R1cmUgYXhpcyB1cG9uIGluaXRpYWwgNXB4IG9mIG1vdmVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChkaWZmWCA+IDUgfHwgZGlmZlkgPiA1KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBkaWZmWCA+IGRpZmZZO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhlIGdlc3R1cmUgaXMgaG9yaXpvbnRhbCwgZm9yY2VmdWxseSBpbnRlcmNlcHQgdGhlIHRvdWNoIGV2ZW50XG4gICAgICAgICAgICAvLyB0byBwcmV2ZW50IHRoZSBtb2JpbGUgYnJvd3NlciBmcm9tIHRyaWdnZXJpbmcgXCJTd2lwZSB0byBHbyBCYWNrXCJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsKSB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ19vdmVybGF5QWN0aXZlJykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLW92ZXJsYXktb3BlbmVkJywge1xuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNvdXJjZTogdGhpcyB9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxmLUhlYWxpbmcgV3JhcHBlcjogUmVzZXQgdHJhbnNpZW50IG92ZXJsYXkgc3RhdGUgaWYgTGl0IHJlY3ljbGVzIHRoZSBET00gbm9kZSBmb3IgYSBuZXcgaXRlbVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdlbnRpdHlEYXRhJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdmaWxlbmFtZScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygndGl0bGVUZXh0JykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZURvY3VtZW50Q2xpY2soZSkge1xuICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICAgICAgaWYgKCFwYXRoLmluY2x1ZGVzKHRoaXMpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hTdGFydChlKSB7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIHRoaXMuX2NhcmRXaWR0aCA9IHJlY3Qud2lkdGg7XG4gICAgICAgIHRoaXMuX2xvY2FsU3RhcnRYID0gdGhpcy5fdG91Y2hTdGFydFggLSByZWN0LmxlZnQ7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cblxuICAgIF90b2dnbGVTZWxlY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSAhdGhpcy5zZWxlY3RlZDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IHRoaXMuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIF9oYW5kbGVUb3VjaEVuZChlKSB7XG4gICAgICAgIGlmICh0aGlzLl90b3VjaFN0YXJ0WCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICBjb25zdCB0b3VjaEVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IHRvdWNoRW5kWSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gdGhpcy5fdG91Y2hTdGFydFggLSB0b3VjaEVuZFg7XG4gICAgICAgIGNvbnN0IGRlbHRhWSA9IHRoaXMuX3RvdWNoU3RhcnRZIC0gdG91Y2hFbmRZO1xuXG4gICAgICAgIC8vIEVuc3VyZSBob3Jpem9udGFsIHN3aXBlIGlzIGRvbWluYW50IHRvIHByZXZlbnQgYWNjaWRlbnRhbCB0cmlnZ2VycyBkdXJpbmcgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIGlmIChNYXRoLmFicyhkZWx0YVgpID4gTWF0aC5hYnMoZGVsdGFZKSAmJiBNYXRoLmFicyhkZWx0YVgpID4gMzApIHtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVmdFN3aXBlID0gZGVsdGFYID4gMzA7ICAgLy8gUmlnaHQtdG8tTGVmdFxuICAgICAgICAgICAgY29uc3QgaXNSaWdodFN3aXBlID0gZGVsdGFYIDwgLTMwOyAvLyBMZWZ0LXRvLVJpZ2h0XG4gICAgICAgICAgICAvLyBXaWRlbiB0aGUgaGl0IHRhcmdldCB0byAyNSUgZm9yIGJldHRlciBlcmdvbm9taWNzLCBhbmQgZ3VhcmFudGVlIGF0IGxlYXN0IDcwcHhcbiAgICAgICAgICAgIGNvbnN0IGlzTGVmdFNpZGUgPSB0aGlzLl9sb2NhbFN0YXJ0WCA8IE1hdGgubWF4KCh0aGlzLl9jYXJkV2lkdGggKiAwLjI1KSwgNzApO1xuXG4gICAgICAgICAgICBpZiAoaXNMZWZ0U2lkZSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1JpZ2h0U3dpcGUgJiYgIXRoaXMuZGlzYWJsZVNlbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhc0FjdGlvbnMgPSB0aGlzLl9oYXNBY3Rpb25zIHx8ICEhdGhpcy5xdWVyeVNlbGVjdG9yKCdbc2xvdD1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgICAgICAgICBpZiAoaGFzQWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNMZWZ0U3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzUmlnaHRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cblxuICAgIF9oYW5kbGVQb2ludGVyRG93bihlKSB7XG4gICAgICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnICYmIGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9qdXN0TG9uZ1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLl9sb25nUHJlc3NUaW1lciA9IG51bGw7XG4gICAgICAgIH0sIDUwMCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVBvaW50ZXJDYW5jZWwoKSB7XG4gICAgICAgIGlmICh0aGlzLl9sb25nUHJlc3NUaW1lcikge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2xvbmdQcmVzc1RpbWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmaXJzdFVwZGF0ZWQoKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cblxuICAgIF9jaGVja0FjdGlvbnMoKSB7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3Rvcignc2xvdFtuYW1lPVwiYWN0aW9uc1wiXScpO1xuICAgICAgICBpZiAoc2xvdCkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBzbG90LmFzc2lnbmVkRWxlbWVudHMoeyBmbGF0dGVuOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGVsZW1lbnRzLmxlbmd0aCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVNsb3RDaGFuZ2UoZSkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7IXRoaXMuZGlzYWJsZVNlbGVjdGlvbiA/IGh0bWxgPGRpdiBjbGFzcz1cInNlbGVjdGlvbi1ndXR0ZXJcIiB0aXRsZT1cIlNlbGVjdCBJdGVtXCIgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7IH19PjwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIiBzdHlsZT1cIi0tY2FyZC1pbnRlbnQ6ICR7dGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0taW50ZW50LW5ldXRyYWwpJ31cIlxuICAgICAgICAgICAgICAgIEBtb3VzZWxlYXZlPSR7KCkgPT4geyBpZiAod2luZG93Lm1hdGNoTWVkaWEoJyhob3ZlcjogaG92ZXIpJykubWF0Y2hlcykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fVxuICAgICAgICAgICAgICAgIEB0b3VjaHN0YXJ0PSR7dGhpcy5faGFuZGxlVG91Y2hTdGFydH1cbiAgICAgICAgICAgICAgICBAdG91Y2hlbmQ9JHt0aGlzLl9oYW5kbGVUb3VjaEVuZH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcmRvd249JHt0aGlzLl9oYW5kbGVQb2ludGVyRG93bn1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcnVwPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcm1vdmU9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBwb2ludGVyY2FuY2VsPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAY2xpY2s9JHsoZSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2p1c3RMb25nUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fanVzdExvbmdQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfX0+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC10aXRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5pY29uID8gaHRtbGA8c3Bhbj4ke3RoaXMuaWNvbn08L3NwYW4+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRlc2NcIj4ke3RoaXMuZGVzY3JpcHRpb25UZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRldGFpbFwiPiR7dGhpcy5kZXRhaWxUZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImlubGluZS1hY3Rpb25zXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRyaWdnZXItYmFyXCIgIFxuICAgICAgICAgICAgICAgICAgICBAcG9pbnRlcmVudGVyPSR7KGUpID0+IHsgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlOyB9fVxuICAgICAgICAgICAgICAgICAgICBAY2xpY2s9JHsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBlLnByZXZlbnREZWZhdWx0KCk7IHRoaXMuX292ZXJsYXlBY3RpdmUgPSAhdGhpcy5fb3ZlcmxheUFjdGl2ZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJpZ2dlci1pY29uXCI+XHUyMDM5PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXRyYXlcIiBAY2xpY2s9JHsoZSkgPT4geyBpZihlLnRhcmdldC50YWdOYW1lID09PSAnQlVUVE9OJyB8fCBlLnRhcmdldC5jbG9zZXN0KCdidXR0b24nKSB8fCBlLnRhcmdldC50YWdOYW1lLmluY2x1ZGVzKCdZRU5WVUknKSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmF5LWNhcHRpb25cIj4ke3RoaXMudGl0bGVUZXh0fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtd3JhcHBlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImFjdGlvbnNcIiBAc2xvdGNoYW5nZT0ke3RoaXMuX2hhbmRsZVNsb3RDaGFuZ2V9Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1jYXJkJywgWWVudnVpQ2FyZCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEdMT0JBTCBFREdFLVNXSVBFIENPT1JESU5BVE9SIChNb2R1bGUgU2NvcGUpXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTYWZhcmkgaWdub3JlcyBDU1Mgb3ZlcnNjcm9sbC1iZWhhdmlvciBmb3IgZXh0cmVtZSBlZGdlIHN3aXBlcy4gXG4vLyBXZSBsb2NrIHRoZSBPUyBnZXN0dXJlIG5hdGl2ZWx5IGF0IHRoZSBkb2N1bWVudCBsZXZlbCBhbmQgcmVzb2x2ZSB0aGUgXG4vLyBkcm9wIHRhcmdldCB0byBhbGxvdyBnbG9iYWwgY2FyZCBzZWxlY3Rpb24gd2l0aG91dCByZXF1aXJpbmcgYSBET00gd3JhcHBlci5cbmxldCBfZWRnZVN3aXBlU3RhcnRYID0gbnVsbDtcbmxldCBfZWRnZVN3aXBlU3RhcnRZID0gbnVsbDtcbmxldCBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbmxldCBfZ2xvYmFsU3dpcGVBeGlzID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQoeCwgeSwgc2VsZWN0b3IpIHtcbiAgICBsZXQgZWwgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgIHdoaWxlIChlbCAmJiBlbC5zaGFkb3dSb290KSB7XG4gICAgICAgIGNvbnN0IGRlZXBlciA9IGVsLnNoYWRvd1Jvb3QuZWxlbWVudEZyb21Qb2ludCh4LCB5KTtcbiAgICAgICAgaWYgKCFkZWVwZXIgfHwgZGVlcGVyID09PSBlbCkgYnJlYWs7XG4gICAgICAgIGVsID0gZGVlcGVyO1xuICAgIH1cbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiBlbC5jbG9zZXN0KHNlbGVjdG9yKTtcbiAgICAgICAgZWwgPSBlbC5nZXRSb290Tm9kZSgpLmhvc3Q7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0VsZW1lbnRJbnNpZGUoZWwsIHNlbGVjdG9yKSB7XG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICAgIGlmIChlbC5jbG9zZXN0ICYmIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgZWwgPSBlbC5nZXRSb290Tm9kZSgpLmhvc3Q7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCAoZSkgPT4ge1xuICAgIGlmIChlLnRvdWNoZXNbMF0uY2xpZW50WCA8IDMwKSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IHRydWU7XG4gICAgICAgIF9lZGdlU3dpcGVTdGFydFggPSBlLnRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WSA9IGUudG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICB9XG59LCB7IHBhc3NpdmU6IHRydWUgfSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIDVweCBvZiBtb3ZlbWVudCB0byBtYXRoZW1hdGljYWxseSBsb2NrIHRoZSBheGlzXG4gICAgICAgIGlmIChfZ2xvYmFsU3dpcGVBeGlzID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBkeCA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WCAtIF9lZGdlU3dpcGVTdGFydFgpO1xuICAgICAgICAgICAgY29uc3QgZHkgPSBNYXRoLmFicyhlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFkgLSBfZWRnZVN3aXBlU3RhcnRZKTtcbiAgICAgICAgICAgIGlmIChkeCA+IDUgfHwgZHkgPiA1KSB7XG4gICAgICAgICAgICAgICAgX2dsb2JhbFN3aXBlQXhpcyA9IGR4ID4gZHkgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICdob3Jpem9udGFsJykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBLaWxscyBTYWZhcmkgYmFjay1uYXZpZ2F0aW9uICYgbG9ja3MgdmVydGljYWwgZHJpZnRcbiAgICAgICAgfSBlbHNlIGlmIChfZ2xvYmFsU3dpcGVBeGlzID09PSAndmVydGljYWwnKSB7XG4gICAgICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTsgLy8gUmVsZWFzZXMgdGhlIGxvY2sgdG8gYWxsb3cgbmF0aXZlIHZlcnRpY2FsIHNjcm9sbGluZ1xuICAgICAgICB9XG4gICAgfVxufSwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCAoZSkgPT4ge1xuICAgIGlmIChfaXNFZGdlU3dpcGUgJiYgX2VkZ2VTd2lwZVN0YXJ0WCAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBlbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBjb25zdCBlbmRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCBkZWx0YVggPSBlbmRYIC0gX2VkZ2VTd2lwZVN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFZID0gTWF0aC5hYnMoZW5kWSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuXG4gICAgICAgIC8vIE9ubHkgaW50ZXJ2ZW5lIGlmIHRoZSBzd2lwZSBzdGFydGVkIG9uIHRoZSBiYWNrZ3JvdW5kIHBhZGRpbmcvZ3V0dGVyLlxuICAgICAgICBjb25zdCBzdGFydGVkT25DYXJkID0gaXNFbGVtZW50SW5zaWRlKGUudGFyZ2V0LCAneWVudnVpLWNhcmQnKTtcblxuICAgICAgICAvLyBJZiBpdCB3YXMgYSBjbGVhbiByaWdodHdhcmQgc3dpcGUgZnJvbSB0aGUgYmFja2dyb3VuZFxuICAgICAgICBpZiAoIXN0YXJ0ZWRPbkNhcmQgJiYgZGVsdGFYID4gMzAgJiYgZGVsdGFYID4gZGVsdGFZKSB7XG4gICAgICAgICAgICBjb25zdCBjYXJkID0gZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQoZW5kWCwgZW5kWSwgJ3llbnZ1aS1jYXJkJyk7XG4gICAgICAgICAgICBpZiAoY2FyZCAmJiAhY2FyZC5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FyZC5zZWxlY3RlZCA9ICFjYXJkLnNlbGVjdGVkO1xuICAgICAgICAgICAgICAgIGNhcmQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLXNlbGVjdC10b2dnbGVkJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IGNhcmQuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgX2lzRWRnZVN3aXBlID0gZmFsc2U7XG4gICAgICAgIF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xuICAgIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFDL0IsYUFBTSxtQkFBbUJGLENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixnQkFBaUIsQ0FBRSxLQUFNLE1BQU8sRUFDaEMsS0FBTSxDQUFFLEtBQU0sTUFBTyxFQUNyQixZQUFhLENBQUUsS0FBTSxNQUFPLEVBQzVCLFNBQVUsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3pDLGlCQUFrQixDQUFFLEtBQU0sT0FBUSxFQUNsQyxlQUFnQixDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDL0MsWUFBYSxDQUFFLEtBQU0sUUFBUyxRQUFTLEdBQU0sVUFBVyxhQUFjLEVBQ3RFLFFBQVMsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3hDLE1BQU8sQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLENBQzFDLEVBQ0EsT0FBTyxPQUFTRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStRaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLGVBQWlCLEdBQ3RCLEtBQUssWUFBYyxHQUNuQixLQUFLLGFBQWUsS0FDcEIsS0FBSyxhQUFlLEtBQ3BCLEtBQUsscUJBQXVCLEtBQzVCLEtBQUssU0FBVyxHQUNoQixLQUFLLGtCQUFvQixLQUFLLHFCQUFxQixLQUFLLElBQUksRUFDNUQsS0FBSyxpQkFBb0JDLEdBQU0sQ0FDdkJBLEVBQUUsT0FBTyxTQUFXLE1BQVEsS0FBSyxpQkFDakMsS0FBSyxlQUFpQixHQUU5QixFQUNBLEtBQUssa0JBQXFCQSxHQUFNLENBQ3hCLENBQUMsS0FBSyxTQUFTQSxFQUFFLGFBQWEsR0FBSyxLQUFLLGlCQUN4QyxLQUFLLGVBQWlCLEdBRTlCLENBQ0osQ0FDQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxpQkFBaUIsV0FBWSxLQUFLLGlCQUFpQixFQUN4RCxTQUFTLGlCQUFpQixRQUFTLEtBQUssaUJBQWlCLEVBQ3pELFNBQVMsaUJBQWlCLHdCQUF5QixLQUFLLGdCQUFnQixFQUV4RSxLQUFLLG1CQUFzQkEsR0FBTSxDQUM3QixHQUFJLEtBQUssZUFBaUIsS0FBTSxPQUNoQyxNQUFNQyxFQUFXRCxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQy9CRSxFQUFXRixFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQy9CRyxFQUFRLEtBQUssSUFBSSxLQUFLLGFBQWVGLENBQVEsRUFDN0NHLEVBQVEsS0FBSyxJQUFJLEtBQUssYUFBZUYsQ0FBUSxFQUcvQyxLQUFLLHVCQUF5QixPQUMxQkMsRUFBUSxHQUFLQyxFQUFRLEtBQ3JCLEtBQUsscUJBQXVCRCxFQUFRQyxHQU14QyxLQUFLLHNCQUNMSixFQUFFLGVBQWUsQ0FFekIsRUFDQSxLQUFLLGlCQUFpQixZQUFhLEtBQUssbUJBQW9CLENBQUUsUUFBUyxFQUFNLENBQUMsRUFFOUUsS0FBSyxlQUFpQixJQUFJLGlCQUFpQixJQUFNLENBQzdDLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBQUMsRUFDRCxLQUFLLGVBQWUsUUFBUSxTQUFTLEtBQU0sQ0FBRSxXQUFZLEdBQU0sZ0JBQWlCLENBQUMsWUFBWSxDQUFFLENBQUMsRUFDaEcsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FFQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDM0IsS0FBSyxvQkFBb0IsWUFBYSxLQUFLLGtCQUFrQixFQUM3RCxLQUFLLG9CQUFvQixXQUFZLEtBQUssaUJBQWlCLEVBQzNELFNBQVMsb0JBQW9CLFFBQVMsS0FBSyxpQkFBaUIsRUFDNUQsU0FBUyxvQkFBb0Isd0JBQXlCLEtBQUssZ0JBQWdCLEVBQ3ZFLEtBQUssZ0JBQWdCLEtBQUssZUFBZSxXQUFXLENBQzVELENBQ0EsUUFBUUssRUFBbUIsQ0FDdkIsTUFBTSxRQUFRQSxDQUFpQixFQUMzQkEsRUFBa0IsSUFBSSxnQkFBZ0IsR0FBSyxLQUFLLGdCQUNoRCxLQUFLLGNBQWMsSUFBSSxZQUFZLHdCQUF5QixDQUN4RCxRQUFTLEdBQ1QsU0FBVSxHQUNWLE9BQVEsQ0FBRSxPQUFRLElBQUssQ0FDM0IsQ0FBQyxDQUFDLEdBSUZBLEVBQWtCLElBQUksWUFBWSxHQUFLQSxFQUFrQixJQUFJLFVBQVUsR0FBS0EsRUFBa0IsSUFBSSxXQUFXLElBQ3pHLEtBQUssaUJBQ0wsS0FBSyxlQUFpQixHQUdsQyxDQUVBLHFCQUFxQkwsRUFBRyxDQUVoQixDQURTQSxFQUFFLGFBQWEsRUFDbEIsU0FBUyxJQUFJLEdBQUssS0FBSyxpQkFDN0IsS0FBSyxlQUFpQixHQUU5QixDQUNBLGtCQUFrQkEsRUFBRyxDQUNqQixLQUFLLGFBQWVBLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFDeEMsS0FBSyxhQUFlQSxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQ3hDLE1BQU1NLEVBQU8sS0FBSyxzQkFBc0IsRUFDeEMsS0FBSyxXQUFhQSxFQUFLLE1BQ3ZCLEtBQUssYUFBZSxLQUFLLGFBQWVBLEVBQUssS0FDN0MsS0FBSyxxQkFBdUIsSUFDaEMsQ0FFQSxrQkFBbUIsQ0FDZixLQUFLLFNBQVcsQ0FBQyxLQUFLLFNBQ3RCLEtBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxTQUFVLEtBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQ0EsZ0JBQWdCTixFQUFHLENBQ2YsR0FBSSxLQUFLLGVBQWlCLEtBQU0sT0FDaEMsTUFBTU8sRUFBWVAsRUFBRSxlQUFlLENBQUMsRUFBRSxRQUNoQ1EsRUFBWVIsRUFBRSxlQUFlLENBQUMsRUFBRSxRQUNoQ1MsRUFBUyxLQUFLLGFBQWVGLEVBQzdCRyxFQUFTLEtBQUssYUFBZUYsRUFHbkMsR0FBSSxLQUFLLElBQUlDLENBQU0sRUFBSSxLQUFLLElBQUlDLENBQU0sR0FBSyxLQUFLLElBQUlELENBQU0sRUFBSSxHQUFJLENBQzlELE1BQU1FLEVBQWNGLEVBQVMsR0FDdkJHLEVBQWVILEVBQVMsSUFFWCxLQUFLLGFBQWUsS0FBSyxJQUFLLEtBQUssV0FBYSxJQUFPLEVBQUUsRUFHcEVHLEdBQWdCLENBQUMsS0FBSyxrQkFDdEIsS0FBSyxpQkFBaUIsR0FHUCxLQUFLLGFBQWlCLEtBQUssY0FBYyxrQkFBa0IsS0FFdEVELEVBQ0EsS0FBSyxlQUFpQixHQUNmQyxJQUNQLEtBQUssZUFBaUIsSUFJdEMsQ0FFQSxLQUFLLGFBQWUsS0FDcEIsS0FBSyxhQUFlLEtBQ3BCLEtBQUsscUJBQXVCLElBQ2hDLENBRUEsbUJBQW1CWixFQUFHLENBQ2RBLEVBQUUsY0FBZ0IsU0FBV0EsRUFBRSxTQUFXLElBQzlDLEtBQUssZ0JBQWtCLFdBQVcsSUFBTSxDQUNwQyxLQUFLLGlCQUFtQixHQUN4QixLQUFLLGlCQUFpQixFQUN0QixLQUFLLGdCQUFrQixJQUMzQixFQUFHLEdBQUcsRUFDVixDQUVBLHNCQUF1QixDQUNmLEtBQUssa0JBQ0wsYUFBYSxLQUFLLGVBQWUsRUFDakMsS0FBSyxnQkFBa0IsS0FFL0IsQ0FDQSxjQUFlLENBQ1gsS0FBSyxjQUFjLENBQ3ZCLENBRUEsZUFBZ0IsQ0FDWixNQUFNYSxFQUFPLEtBQUssV0FBVyxjQUFjLHNCQUFzQixFQUNqRSxHQUFJQSxFQUFNLENBQ04sTUFBTUMsRUFBV0QsRUFBSyxpQkFBaUIsQ0FBRSxRQUFTLEVBQUssQ0FBQyxFQUN4RCxLQUFLLFlBQWNDLEVBQVMsT0FBUyxDQUN6QyxNQUNJLEtBQUssWUFBYyxDQUFDLENBQUMsS0FBSyxjQUFjLGtCQUFrQixDQUVsRSxDQUVBLGtCQUFrQmQsRUFBRyxDQUNqQixLQUFLLGNBQWMsQ0FDdkIsQ0FDQSxRQUFTLENBQ0wsT0FBT0Y7QUFBQSxjQUNBLEtBQUssaUJBQXVKLEdBQXBJQSw2REFBaUVFLEdBQU0sQ0FBRUEsRUFBRSxnQkFBZ0IsRUFBRyxLQUFLLGlCQUFpQixDQUFHLENBQUMsU0FBYztBQUFBLDhEQUMvRyxLQUFLLGFBQWUsdUJBQXVCO0FBQUEsOEJBQzNFLElBQU0sQ0FBTSxPQUFPLFdBQVcsZ0JBQWdCLEVBQUUsVUFBUyxLQUFLLGVBQWlCLEdBQU8sQ0FBQztBQUFBLDhCQUN2RixLQUFLLGlCQUFpQjtBQUFBLDRCQUN4QixLQUFLLGVBQWU7QUFBQSwrQkFDakIsS0FBSyxrQkFBa0I7QUFBQSw2QkFDekIsS0FBSyxvQkFBb0I7QUFBQSwrQkFDdkIsS0FBSyxvQkFBb0I7QUFBQSxpQ0FDdkIsS0FBSyxvQkFBb0I7QUFBQSx5QkFDaENBLEdBQU0sQ0FDUixLQUFLLG1CQUNMLEtBQUssaUJBQW1CLEdBQ3hCQSxFQUFFLGdCQUFnQixFQUNsQkEsRUFBRSxlQUFlLEVBRXpCLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLDhCQUthLEtBQUssS0FBT0YsVUFBYSxLQUFLLElBQUksVUFBWSxFQUFFO0FBQUEsOEJBQ2hELEtBQUssU0FBUztBQUFBO0FBQUE7QUFBQSxzQkFHdEIsS0FBSyxnQkFBa0JBLDJCQUE4QixLQUFLLGVBQWUsU0FBVyxFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBSXRGLEtBQUssV0FBYUEsNkJBQWdDLEtBQUssVUFBVSxTQUFXLEVBQUU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG9DQUsvREUsR0FBTSxDQUFNQSxFQUFFLGNBQWdCLFVBQVMsS0FBSyxlQUFpQixHQUFNLENBQUM7QUFBQSw2QkFDM0VBLEdBQU0sQ0FBRUEsRUFBRSxnQkFBZ0IsRUFBR0EsRUFBRSxlQUFlLEVBQUcsS0FBSyxlQUFpQixDQUFDLEtBQUssY0FBZ0IsQ0FBQztBQUFBO0FBQUE7QUFBQSxtREFHeEVBLEdBQU0sRUFBS0EsRUFBRSxPQUFPLFVBQVksVUFBWUEsRUFBRSxPQUFPLFFBQVEsUUFBUSxHQUFLQSxFQUFFLE9BQU8sUUFBUSxTQUFTLFFBQVEsS0FBRyxLQUFLLGVBQWlCLEdBQU8sQ0FBQztBQUFBLGlEQUNoSixLQUFLLFNBQVM7QUFBQTtBQUFBLDJEQUVKLEtBQUssaUJBQWlCO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FLN0UsQ0FDSixDQUNBLGVBQWUsT0FBTyxjQUFlLFVBQVUsRUFRL0MsSUFBSWUsRUFBbUIsS0FDbkJDLEVBQW1CLEtBQ25CQyxFQUFlLEdBQ2ZDLEVBQW1CLEtBRXZCLFNBQVNDLEVBQXdCQyxFQUFHQyxFQUFHQyxFQUFVLENBQzdDLElBQUlDLEVBQUssU0FBUyxpQkFBaUJILEVBQUdDLENBQUMsRUFDdkMsS0FBT0UsR0FBTUEsRUFBRyxZQUFZLENBQ3hCLE1BQU1DLEVBQVNELEVBQUcsV0FBVyxpQkFBaUJILEVBQUdDLENBQUMsRUFDbEQsR0FBSSxDQUFDRyxHQUFVQSxJQUFXRCxFQUFJLE1BQzlCQSxFQUFLQyxDQUNULENBQ0EsS0FBT0QsR0FBSSxDQUNQLEdBQUlBLEVBQUcsU0FBV0EsRUFBRyxRQUFRRCxDQUFRLEVBQUcsT0FBT0MsRUFBRyxRQUFRRCxDQUFRLEVBQ2xFQyxFQUFLQSxFQUFHLFlBQVksRUFBRSxJQUMxQixDQUNBLE9BQU8sSUFDWCxDQUVBLFNBQVNFLEVBQWdCRixFQUFJRCxFQUFVLENBQ25DLEtBQU9DLEdBQUksQ0FDUCxHQUFJQSxFQUFHLFNBQVdBLEVBQUcsUUFBUUQsQ0FBUSxFQUFHLE1BQU8sR0FDL0NDLEVBQUtBLEVBQUcsWUFBWSxFQUFFLElBQzFCLENBQ0EsTUFBTyxFQUNYLENBQ0EsU0FBUyxpQkFBaUIsYUFBZSxHQUFNLENBQ3ZDLEVBQUUsUUFBUSxDQUFDLEVBQUUsUUFBVSxJQUN2Qk4sRUFBZSxHQUNmRixFQUFtQixFQUFFLFFBQVEsQ0FBQyxFQUFFLFFBQ2hDQyxFQUFtQixFQUFFLFFBQVEsQ0FBQyxFQUFFLFFBQ2hDRSxFQUFtQixNQUVuQkQsRUFBZSxFQUV2QixFQUFHLENBQUUsUUFBUyxFQUFLLENBQUMsRUFFcEIsU0FBUyxpQkFBaUIsWUFBYyxHQUFNLENBQzFDLEdBQUlBLEdBQWdCRixJQUFxQixLQUFNLENBRTNDLEdBQUlHLElBQXFCLEtBQU0sQ0FDM0IsTUFBTVEsRUFBSyxLQUFLLElBQUksRUFBRSxlQUFlLENBQUMsRUFBRSxRQUFVWCxDQUFnQixFQUM1RFksRUFBSyxLQUFLLElBQUksRUFBRSxlQUFlLENBQUMsRUFBRSxRQUFVWCxDQUFnQixHQUM5RFUsRUFBSyxHQUFLQyxFQUFLLEtBQ2ZULEVBQW1CUSxFQUFLQyxFQUFLLGFBQWUsV0FFcEQsQ0FFSVQsSUFBcUIsYUFDckIsRUFBRSxlQUFlLEVBQ1ZBLElBQXFCLGFBQzVCRCxFQUFlLEdBRXZCLENBQ0osRUFBRyxDQUFFLFFBQVMsRUFBTSxDQUFDLEVBRXJCLFNBQVMsaUJBQWlCLFdBQWEsR0FBTSxDQUN6QyxHQUFJQSxHQUFnQkYsSUFBcUIsS0FBTSxDQUMzQyxNQUFNYSxFQUFPLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFDM0JDLEVBQU8sRUFBRSxlQUFlLENBQUMsRUFBRSxRQUMzQnBCLEVBQVNtQixFQUFPYixFQUNoQkwsRUFBUyxLQUFLLElBQUltQixFQUFPYixDQUFnQixFQU0vQyxHQUFJLENBSGtCUyxFQUFnQixFQUFFLE9BQVEsYUFBYSxHQUd2Q2hCLEVBQVMsSUFBTUEsRUFBU0MsRUFBUSxDQUNsRCxNQUFNb0IsRUFBT1gsRUFBd0JTLEVBQU1DLEVBQU0sYUFBYSxFQUMxREMsR0FBUSxDQUFDQSxFQUFLLG1CQUNkQSxFQUFLLFNBQVcsQ0FBQ0EsRUFBSyxTQUN0QkEsRUFBSyxjQUFjLElBQUksWUFBWSw2QkFBOEIsQ0FDN0QsT0FBUSxDQUFFLFNBQVVBLEVBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxFQUVWLENBQ0FiLEVBQWUsR0FDZkYsRUFBbUIsSUFDdkIsQ0FDSixDQUFDIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJjdXJyZW50WCIsICJjdXJyZW50WSIsICJkaWZmWCIsICJkaWZmWSIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJyZWN0IiwgInRvdWNoRW5kWCIsICJ0b3VjaEVuZFkiLCAiZGVsdGFYIiwgImRlbHRhWSIsICJpc0xlZnRTd2lwZSIsICJpc1JpZ2h0U3dpcGUiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImVsIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
