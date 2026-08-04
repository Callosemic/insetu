import{LitElement as u,html as c,css as v}from"lit";export class YenvuiCard extends u{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=v`
        :host { display: block; margin-bottom: var(--card-margin-bottom, 12px); position: relative; touch-action: pan-y; }
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
            border-top: var(--card-border-top, 1px solid var(--border, #444));
            border-left: 4px solid var(--card-intent, #64748b);
            padding-left: 10px;
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 6px));
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 6px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 6px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 6px));
            display: flex;
            flex-direction: row;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            box-shadow: var(--card-box-shadow, 0 4px 12px rgba(0,0,0,0.1));
            transition: border-color 0.2s, box-shadow 0.2s, border-left-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .top-shadow {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: var(--card-top-shadow, transparent);
            pointer-events: none;
            z-index: 20;
            border-top-left-radius: var(--card-border-top-left-radius, 0);
            border-top-right-radius: var(--card-border-top-right-radius, 0);
        }
        @media (hover: hover) {
            .selection-gutter:hover + .card-wrapper {
                border-left-width: 14px;
                padding-left: 0px;
                border-color: var(--card-intent, #3b82f6);
            }
            .card-wrapper:hover {
                border-color: var(--card-intent, #3b82f6);
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
            outline: 1px solid var(--card-intent, #3b82f6);
            outline-offset: -1px;
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
            padding: 0 15px 6px 15px;
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
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 5px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 5px));
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,r=Math.abs(this._touchStartX-i),d=Math.abs(this._touchStartY-o);this._isSwipingHorizontal===null&&(r>5||d>5)&&(this._isSwipingHorizontal=r>d),this._isSwipingHorizontal&&t.preventDefault()},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1}),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._themeObserver&&this._themeObserver.disconnect()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const i=this.getBoundingClientRect();this._cardWidth=i.width,this._localStartX=this._touchStartX-i.left,this._isSwipingHorizontal=null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,r=this._touchStartX-i,d=this._touchStartY-o;if(Math.abs(r)>Math.abs(d)&&Math.abs(r)>30){const a=r>30,p=r<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?p&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(a?this._overlayActive=!0:p&&(this._overlayActive=!1))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}_handlePointerDown(t){t.pointerType==="mouse"&&t.button!==0||(this._longPressTimer=setTimeout(()=>{this._justLongPressed=!0,this._toggleSelection(),this._longPressTimer=null},500))}_handlePointerCancel(){this._longPressTimer&&(clearTimeout(this._longPressTimer),this._longPressTimer=null)}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const i=t.assignedElements({flatten:!0});this._hasActions=i.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return c`
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
            <div class="top-shadow"></div>
        `}}customElements.define("yenvui-card",YenvuiCard);let s=null,h=null,n=!1,l=null;function f(e,t,i){let o=document.elementFromPoint(e,t);for(;o&&o.shadowRoot;){const r=o.shadowRoot.elementFromPoint(e,t);if(!r||r===o)break;o=r}for(;o;){if(o.closest&&o.closest(i))return o.closest(i);o=o.getRootNode().host}return null}function b(e,t){for(;e;){if(e.closest&&e.closest(t))return!0;e=e.getRootNode().host}return!1}document.addEventListener("touchstart",e=>{e.touches[0].clientX<30?(n=!0,s=e.touches[0].clientX,h=e.touches[0].clientY,l=null):n=!1},{passive:!0}),document.addEventListener("touchmove",e=>{if(n&&s!==null){if(l===null){const t=Math.abs(e.changedTouches[0].clientX-s),i=Math.abs(e.changedTouches[0].clientY-h);(t>5||i>5)&&(l=t>i?"horizontal":"vertical")}l==="horizontal"?e.preventDefault():l==="vertical"&&(n=!1)}},{passive:!1}),document.addEventListener("touchend",e=>{if(n&&s!==null){const t=e.changedTouches[0].clientX,i=e.changedTouches[0].clientY,o=t-s,r=Math.abs(i-h);if(!b(e.target,"yenvui-card")&&o>30&&o>r){const a=f(t,i,"yenvui-card");a&&!a.disableSelection&&(a.selected=!a.selected,a.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:a.selected},bubbles:!0,composed:!0})))}n=!1,s=null}});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgbWFyZ2luLWJvdHRvbTogdmFyKC0tY2FyZC1tYXJnaW4tYm90dG9tLCAxMnB4KTsgcG9zaXRpb246IHJlbGF0aXZlOyB0b3VjaC1hY3Rpb246IHBhbi15OyB9XG4gICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItdG9wOiB2YXIoLS1jYXJkLWJvcmRlci10b3AsIDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpKTtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiA0cHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsICM2NDc0OGIpO1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBib3gtc2hhZG93OiB2YXIoLS1jYXJkLWJveC1zaGFkb3csIDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjEpKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzLCBib3gtc2hhZG93IDAuMnMsIGJvcmRlci1sZWZ0LXdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKSwgcGFkZGluZy1sZWZ0IDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICAudG9wLXNoYWRvdyB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBsZWZ0OiAwO1xuICAgICAgICAgICAgcmlnaHQ6IDA7XG4gICAgICAgICAgICBoZWlnaHQ6IDZweDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtdG9wLXNoYWRvdywgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB6LWluZGV4OiAyMDtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgMCk7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgMCk7XG4gICAgICAgIH1cbiAgICAgICAgQG1lZGlhIChob3ZlcjogaG92ZXIpIHtcbiAgICAgICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyOmhvdmVyICsgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuY2FyZC13cmFwcGVyOmhvdmVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSB7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgb3V0bGluZTogMXB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIG91dGxpbmUtb2Zmc2V0OiAtMXB4O1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTVweCA4cHggMTVweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGVzYyB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggOHB4IDE1cHg7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xuICAgICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAyO1xuICAgICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggNnB4IDE1cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZCgqKSB7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCAxMnB4IDE1cHg7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjc1cmVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1iYXIge1xuICAgICAgICAgICAgd2lkdGg6IDIycHg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtaW50ZW50LCB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4YikpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA1cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDVweCkpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtoYXMtYWN0aW9uc10pIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhcjpob3ZlciB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4yKTtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1pY29uIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2U7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAtMnB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiByb3RhdGUoMTgwZGVnKTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IC0xcHg7XG4gICAgICAgICAgICByaWdodDogMjFweDtcbiAgICAgICAgICAgIHRvcDogLTFweDtcbiAgICAgICAgICAgIG1pbi1oZWlnaHQ6IGNhbGMoMTAwJSArIDJweCk7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICAvKiBQYXNzIENTUyB2YXJpYWJsZXMgdG8gcGVuZXRyYXRlIHNsb3R0ZWQgYXN5bmMgYnV0dG9ucyAqL1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogNnB4IDEycHg7XG4gICAgICAgICAgICAtLWJ0bi1mb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTBweDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXMgZWFzZSwgdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuMTc1LCAwLjg4NSwgMC4zMiwgMS4yNzUpO1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHggMCAwIDZweDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNCk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAxNHB4OyAvKiBFbnN1cmUgYnV0dG9ucyBkb24ndCBjbGlwIHRoZSBhYnNvbHV0ZSBjYXB0aW9uICovXG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBvcGFjaXR5OiAxO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHNjYWxlKDEpO1xuICAgICAgICB9XG4gICAgICAgIC50cmF5LWNhcHRpb24ge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgdG9wOiA0cHg7XG4gICAgICAgICAgICBsZWZ0OiAxMHB4O1xuICAgICAgICAgICAgcmlnaHQ6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xuICAgICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuNXB4O1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjE1KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMDAwMDAwO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogNHB4IDRweCAwICMxNGI4YTY7XG4gICAgICAgIH1cbiAgICAgICAgLyogVW5zdHlsZWQgc2xvdHMgZm9yIGhvc3QtaW5qZWN0ZWQgYnV0dG9ucyAqL1xuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgcGFkZGluZzogdmFyKC0tYnRuLXBhZGRpbmcpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogdmFyKC0tYnRuLWZvbnQtc2l6ZSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uOmhvdmVyKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1ob3Zlcik7XG4gICAgICAgIH1cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjOGI1Y2Y2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBvcGFjaXR5OiAxICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiAtLS0gQ29tcGFjdCBNb2RlIFZhcmlhbnQgLS0tICovXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkge1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDEycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45NXJlbTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWRlc2MsXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMCAwIDEwcHg7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lciA9IHRoaXMuX2hhbmRsZURvY3VtZW50Q2xpY2suYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbC5zb3VyY2UgIT09IHRoaXMgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29udGFpbnMoZS5yZWxhdGVkVGFyZ2V0KSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICAvLyBOYXRpdmUgRWRnZS1Td2lwZSBOYXZpZ2F0aW9uIERlZmVhdGVyXG4gICAgICAgIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90b3VjaFN0YXJ0WCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZYID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFggLSBjdXJyZW50WCk7XG4gICAgICAgICAgICBjb25zdCBkaWZmWSA9IE1hdGguYWJzKHRoaXMuX3RvdWNoU3RhcnRZIC0gY3VycmVudFkpO1xuXG4gICAgICAgICAgICAvLyBMb2NrIHRoZSBnZXN0dXJlIGF4aXMgdXBvbiBpbml0aWFsIDVweCBvZiBtb3ZlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGlmZlggPiA1IHx8IGRpZmZZID4gNSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gZGlmZlggPiBkaWZmWTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBnZXN0dXJlIGlzIGhvcml6b250YWwsIGZvcmNlZnVsbHkgaW50ZXJjZXB0IHRoZSB0b3VjaCBldmVudFxuICAgICAgICAgICAgLy8gdG8gcHJldmVudCB0aGUgbW9iaWxlIGJyb3dzZXIgZnJvbSB0cmlnZ2VyaW5nIFwiU3dpcGUgdG8gR28gQmFja1wiXG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lciwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS10aGVtZSddIH0pO1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9kb2NDbGlja0xpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgaWYgKHRoaXMuX3RoZW1lT2JzZXJ2ZXIpIHRoaXMuX3RoZW1lT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2VsZi1IZWFsaW5nIFdyYXBwZXI6IFJlc2V0IHRyYW5zaWVudCBvdmVybGF5IHN0YXRlIGlmIExpdCByZWN5Y2xlcyB0aGUgRE9NIG5vZGUgZm9yIGEgbmV3IGl0ZW1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZW50aXR5RGF0YScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZmlsZW5hbWUnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RpdGxlVGV4dCcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVEb2N1bWVudENsaWNrKGUpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgICAgIGlmICghcGF0aC5pbmNsdWRlcyh0aGlzKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoU3RhcnQoZSkge1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICB0aGlzLl9jYXJkV2lkdGggPSByZWN0LndpZHRoO1xuICAgICAgICB0aGlzLl9sb2NhbFN0YXJ0WCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICB9XG5cbiAgICBfdG9nZ2xlU2VsZWN0aW9uKCkge1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gIXRoaXMuc2VsZWN0ZWQ7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLXNlbGVjdC10b2dnbGVkJywge1xuICAgICAgICAgICAgZGV0YWlsOiB7IHNlbGVjdGVkOiB0aGlzLnNlbGVjdGVkIH0sXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hFbmQoZSkge1xuICAgICAgICBpZiAodGhpcy5fdG91Y2hTdGFydFggPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBjb25zdCB0b3VjaEVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gdG91Y2hFbmRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSB0aGlzLl90b3VjaFN0YXJ0WSAtIHRvdWNoRW5kWTtcblxuICAgICAgICAvLyBFbnN1cmUgaG9yaXpvbnRhbCBzd2lwZSBpcyBkb21pbmFudCB0byBwcmV2ZW50IGFjY2lkZW50YWwgdHJpZ2dlcnMgZHVyaW5nIHZlcnRpY2FsIHNjcm9sbGluZ1xuICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IE1hdGguYWJzKGRlbHRhWSkgJiYgTWF0aC5hYnMoZGVsdGFYKSA+IDMwKSB7XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTd2lwZSA9IGRlbHRhWCA+IDMwOyAgIC8vIFJpZ2h0LXRvLUxlZnRcbiAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTd2lwZSA9IGRlbHRhWCA8IC0zMDsgLy8gTGVmdC10by1SaWdodFxuICAgICAgICAgICAgLy8gV2lkZW4gdGhlIGhpdCB0YXJnZXQgdG8gMjUlIGZvciBiZXR0ZXIgZXJnb25vbWljcywgYW5kIGd1YXJhbnRlZSBhdCBsZWFzdCA3MHB4XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPCBNYXRoLm1heCgodGhpcy5fY2FyZFdpZHRoICogMC4yNSksIDcwKTtcblxuICAgICAgICAgICAgaWYgKGlzTGVmdFNpZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNSaWdodFN3aXBlICYmICF0aGlzLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5faGFzQWN0aW9ucyB8fCAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0FjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVmdFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1JpZ2h0U3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICB9XG5cbiAgICBfaGFuZGxlUG9pbnRlckRvd24oZSkge1xuICAgICAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJyAmJiBlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9sb25nUHJlc3NUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fanVzdExvbmdQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5fbG9uZ1ByZXNzVGltZXIgPSBudWxsO1xuICAgICAgICB9LCA1MDApO1xuICAgIH1cblxuICAgIF9oYW5kbGVQb2ludGVyQ2FuY2VsKCkge1xuICAgICAgICBpZiAodGhpcy5fbG9uZ1ByZXNzVGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9sb25nUHJlc3NUaW1lcik7XG4gICAgICAgICAgICB0aGlzLl9sb25nUHJlc3NUaW1lciA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZmlyc3RVcGRhdGVkKCkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG5cbiAgICBfY2hlY2tBY3Rpb25zKCkge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ3Nsb3RbbmFtZT1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgaWYgKHNsb3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gc2xvdC5hc3NpZ25lZEVsZW1lbnRzKHsgZmxhdHRlbjogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSBlbGVtZW50cy5sZW5ndGggPiAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9ICEhdGhpcy5xdWVyeVNlbGVjdG9yKCdbc2xvdD1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVTbG90Q2hhbmdlKGUpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICAkeyF0aGlzLmRpc2FibGVTZWxlY3Rpb24gPyBodG1sYDxkaXYgY2xhc3M9XCJzZWxlY3Rpb24tZ3V0dGVyXCIgdGl0bGU9XCJTZWxlY3QgSXRlbVwiIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpOyB9fT48L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC13cmFwcGVyXCIgc3R5bGU9XCItLWNhcmQtaW50ZW50OiAke3RoaXMuaW50ZW50Q29sb3IgfHwgJ3ZhcigtLWludGVudC1uZXV0cmFsKSd9XCJcbiAgICAgICAgICAgICAgICBAbW91c2VsZWF2ZT0keygpID0+IHsgaWYgKHdpbmRvdy5tYXRjaE1lZGlhKCcoaG92ZXI6IGhvdmVyKScpLm1hdGNoZXMpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX1cbiAgICAgICAgICAgICAgICBAdG91Y2hzdGFydD0ke3RoaXMuX2hhbmRsZVRvdWNoU3RhcnR9XG4gICAgICAgICAgICAgICAgQHRvdWNoZW5kPSR7dGhpcy5faGFuZGxlVG91Y2hFbmR9XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJkb3duPSR7dGhpcy5faGFuZGxlUG9pbnRlckRvd259XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJ1cD0ke3RoaXMuX2hhbmRsZVBvaW50ZXJDYW5jZWx9XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJtb3ZlPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcmNhbmNlbD0ke3RoaXMuX2hhbmRsZVBvaW50ZXJDYW5jZWx9XG4gICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9qdXN0TG9uZ1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2p1c3RMb25nUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH19PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWhlYWRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtdGl0bGVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuaWNvbiA/IGh0bWxgPHNwYW4+JHt0aGlzLmljb259PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMudGl0bGVUZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGVzY3JpcHRpb25UZXh0ID8gaHRtbGA8ZGl2IGNsYXNzPVwiY2FyZC1kZXNjXCI+JHt0aGlzLmRlc2NyaXB0aW9uVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWJvZHlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXRhaWxUZXh0ID8gaHRtbGA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWxcIj4ke3RoaXMuZGV0YWlsVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJpbmxpbmUtYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cmlnZ2VyLWJhclwiICBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLl9vdmVybGF5QWN0aXZlID0gIXRoaXMuX292ZXJsYXlBY3RpdmU7IH19PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRyaWdnZXItaWNvblwiPlx1MjAzOTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy10cmF5XCIgQGNsaWNrPSR7KGUpID0+IHsgaWYoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uJykgfHwgZS50YXJnZXQudGFnTmFtZS5pbmNsdWRlcygnWUVOVlVJJykpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJheS1jYXB0aW9uXCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25zXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9wLXNoYWRvd1wiPjwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNhcmQnLCBZZW52dWlDYXJkKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR0xPQkFMIEVER0UtU1dJUEUgQ09PUkRJTkFUT1IgKE1vZHVsZSBTY29wZSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNhZmFyaSBpZ25vcmVzIENTUyBvdmVyc2Nyb2xsLWJlaGF2aW9yIGZvciBleHRyZW1lIGVkZ2Ugc3dpcGVzLiBcbi8vIFdlIGxvY2sgdGhlIE9TIGdlc3R1cmUgbmF0aXZlbHkgYXQgdGhlIGRvY3VtZW50IGxldmVsIGFuZCByZXNvbHZlIHRoZSBcbi8vIGRyb3AgdGFyZ2V0IHRvIGFsbG93IGdsb2JhbCBjYXJkIHNlbGVjdGlvbiB3aXRob3V0IHJlcXVpcmluZyBhIERPTSB3cmFwcGVyLlxubGV0IF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xubGV0IF9lZGdlU3dpcGVTdGFydFkgPSBudWxsO1xubGV0IF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xubGV0IF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludCh4LCB5LCBzZWxlY3Rvcikge1xuICAgIGxldCBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgd2hpbGUgKGVsICYmIGVsLnNoYWRvd1Jvb3QpIHtcbiAgICAgICAgY29uc3QgZGVlcGVyID0gZWwuc2hhZG93Um9vdC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgICAgICBpZiAoIWRlZXBlciB8fCBkZWVwZXIgPT09IGVsKSBicmVhaztcbiAgICAgICAgZWwgPSBkZWVwZXI7XG4gICAgfVxuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzRWxlbWVudEluc2lkZShlbCwgc2VsZWN0b3IpIHtcbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiB0cnVlO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChlKSA9PiB7XG4gICAgaWYgKGUudG91Y2hlc1swXS5jbGllbnRYIDwgMzApIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gdHJ1ZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IGUudG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRZID0gZS50b3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgIH1cbn0sIHsgcGFzc2l2ZTogdHJ1ZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgNXB4IG9mIG1vdmVtZW50IHRvIG1hdGhlbWF0aWNhbGx5IGxvY2sgdGhlIGF4aXNcbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYIC0gX2VkZ2VTd2lwZVN0YXJ0WCk7XG4gICAgICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuICAgICAgICAgICAgaWYgKGR4ID4gNSB8fCBkeSA+IDUpIHtcbiAgICAgICAgICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gZHggPiBkeSA/ICdob3Jpem9udGFsJyA6ICd2ZXJ0aWNhbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEtpbGxzIFNhZmFyaSBiYWNrLW5hdmlnYXRpb24gJiBsb2NrcyB2ZXJ0aWNhbCBkcmlmdFxuICAgICAgICB9IGVsc2UgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlOyAvLyBSZWxlYXNlcyB0aGUgbG9jayB0byBhbGxvdyBuYXRpdmUgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIH1cbiAgICB9XG59LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IGVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IGVuZFggLSBfZWRnZVN3aXBlU3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSBNYXRoLmFicyhlbmRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG5cbiAgICAgICAgLy8gT25seSBpbnRlcnZlbmUgaWYgdGhlIHN3aXBlIHN0YXJ0ZWQgb24gdGhlIGJhY2tncm91bmQgcGFkZGluZy9ndXR0ZXIuXG4gICAgICAgIGNvbnN0IHN0YXJ0ZWRPbkNhcmQgPSBpc0VsZW1lbnRJbnNpZGUoZS50YXJnZXQsICd5ZW52dWktY2FyZCcpO1xuXG4gICAgICAgIC8vIElmIGl0IHdhcyBhIGNsZWFuIHJpZ2h0d2FyZCBzd2lwZSBmcm9tIHRoZSBiYWNrZ3JvdW5kXG4gICAgICAgIGlmICghc3RhcnRlZE9uQ2FyZCAmJiBkZWx0YVggPiAzMCAmJiBkZWx0YVggPiBkZWx0YVkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludChlbmRYLCBlbmRZLCAneWVudnVpLWNhcmQnKTtcbiAgICAgICAgICAgIGlmIChjYXJkICYmICFjYXJkLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXJkLnNlbGVjdGVkID0gIWNhcmQuc2VsZWN0ZWQ7XG4gICAgICAgICAgICAgICAgY2FyZC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogY2FyZC5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG4gICAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUMvQixhQUFNLG1CQUFtQkYsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGdCQUFpQixDQUFFLEtBQU0sTUFBTyxFQUNoQyxLQUFNLENBQUUsS0FBTSxNQUFPLEVBQ3JCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsU0FBVSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDekMsaUJBQWtCLENBQUUsS0FBTSxPQUFRLEVBQ2xDLGVBQWdCLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMvQyxZQUFhLENBQUUsS0FBTSxRQUFTLFFBQVMsR0FBTSxVQUFXLGFBQWMsRUFDdEUsUUFBUyxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDeEMsTUFBTyxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssQ0FDMUMsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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QyxHQUFJLENBSGtCUyxFQUFnQixFQUFFLE9BQVEsYUFBYSxHQUd2Q2hCLEVBQVMsSUFBTUEsRUFBU0MsRUFBUSxDQUNsRCxNQUFNb0IsRUFBT1gsRUFBd0JTLEVBQU1DLEVBQU0sYUFBYSxFQUMxREMsR0FBUSxDQUFDQSxFQUFLLG1CQUNkQSxFQUFLLFNBQVcsQ0FBQ0EsRUFBSyxTQUN0QkEsRUFBSyxjQUFjLElBQUksWUFBWSw2QkFBOEIsQ0FDN0QsT0FBUSxDQUFFLFNBQVVBLEVBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxFQUVWLENBQ0FiLEVBQWUsR0FDZkYsRUFBbUIsSUFDdkIsQ0FDSixDQUFDIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJjdXJyZW50WCIsICJjdXJyZW50WSIsICJkaWZmWCIsICJkaWZmWSIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJyZWN0IiwgInRvdWNoRW5kWCIsICJ0b3VjaEVuZFkiLCAiZGVsdGFYIiwgImRlbHRhWSIsICJpc0xlZnRTd2lwZSIsICJpc1JpZ2h0U3dpcGUiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImVsIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
