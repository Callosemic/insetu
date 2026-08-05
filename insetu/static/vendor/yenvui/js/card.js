import{LitElement as g,html as h,css as m}from"lit";export class YenvuiCard extends g{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=m`
        :host { display: block; margin-bottom: var(--card-margin-bottom, 12px); position: relative; touch-action: pan-x pan-y; }
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
            touch-action: pan-x pan-y;
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
            --btn-padding: 8px 16px;
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
            justify-content: flex-start;
            align-items: center;
            flex-wrap: nowrap;
            gap: 8px;
            margin-top: 0;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 2px;
            width: 100%;
            box-sizing: border-box;
        }
        .actions-wrapper::before {
            content: '';
            margin-left: auto;
        }
        .actions-wrapper::-webkit-scrollbar {
            display: none;
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const o=t.changedTouches[0].clientX,i=t.changedTouches[0].clientY,r=Math.abs(this._touchStartX-o),l=Math.abs(this._touchStartY-i);if(this._isSwipingHorizontal===null&&(r>5||l>5)&&(this._isSwipingHorizontal=r>l),this._isSwipingHorizontal){let a=!0;const s=t.composedPath().find(d=>d.classList&&d.classList.contains("actions-wrapper"));if(s){const d=o>this._touchStartX,v=o<this._touchStartX,b=Math.max(0,s.scrollWidth-s.clientWidth);(d&&s.scrollLeft>0||v&&s.scrollLeft<b)&&(a=!1)}a&&t.preventDefault()}},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1}),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._themeObserver&&this._themeObserver.disconnect()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const o=this.getBoundingClientRect();this._cardWidth=o.width,this._localStartX=this._touchStartX-o.left,this._isSwipingHorizontal=null;const i=t.composedPath().find(r=>r.classList&&r.classList.contains("actions-wrapper"));this._actionsScrollLeft=i?i.scrollLeft:null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const o=t.changedTouches[0].clientX,i=t.changedTouches[0].clientY,r=this._touchStartX-o,l=this._touchStartY-i;if(Math.abs(r)>Math.abs(l)&&Math.abs(r)>30){const a=r>30,u=r<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?u&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(a?this._overlayActive=!0:u&&(this._actionsScrollLeft!==null&&this._actionsScrollLeft>0||(this._overlayActive=!1)))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}_handlePointerDown(t){t.pointerType==="mouse"&&t.button!==0||(this._longPressTimer=setTimeout(()=>{this._justLongPressed=!0,this._toggleSelection(),this._longPressTimer=null},500))}_handlePointerCancel(){this._longPressTimer&&(clearTimeout(this._longPressTimer),this._longPressTimer=null)}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const o=t.assignedElements({flatten:!0});this._hasActions=o.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return h`
            ${this.disableSelection?"":h`<div class="selection-gutter" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div>`}
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
                            ${this.icon?h`<span>${this.icon}</span>`:""}
                            ${this.titleText}
                        </div>
                    </div>
                    ${this.descriptionText?h`<div class="card-desc">${this.descriptionText}</div>`:""}
                    <div class="card-body">
                        <slot></slot>
                    </div>
                    ${this.detailText?h`<div class="card-detail">${this.detailText}</div>`:""}
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
        `}}customElements.define("yenvui-card",YenvuiCard);let n=null,f=null,c=!1,p=null;function x(e,t,o){let i=document.elementFromPoint(e,t);for(;i&&i.shadowRoot;){const r=i.shadowRoot.elementFromPoint(e,t);if(!r||r===i)break;i=r}for(;i;){if(i.closest&&i.closest(o))return i.closest(o);i=i.getRootNode().host}return null}function w(e,t){for(;e;){if(e.closest&&e.closest(t))return!0;e=e.getRootNode().host}return!1}document.addEventListener("touchstart",e=>{e.touches[0].clientX<30?(c=!0,n=e.touches[0].clientX,f=e.touches[0].clientY,p=null):c=!1},{passive:!0}),document.addEventListener("touchmove",e=>{if(c&&n!==null){if(p===null){const t=Math.abs(e.changedTouches[0].clientX-n),o=Math.abs(e.changedTouches[0].clientY-f);(t>5||o>5)&&(p=t>o?"horizontal":"vertical")}p==="horizontal"?e.preventDefault():p==="vertical"&&(c=!1)}},{passive:!1}),document.addEventListener("touchend",e=>{if(c&&n!==null){const t=e.changedTouches[0].clientX,o=e.changedTouches[0].clientY,i=t-n,r=Math.abs(o-f);if(!w(e.target,"yenvui-card")&&i>30&&i>r){const a=x(t,o,"yenvui-card");a&&!a.disableSelection&&(a.selected=!a.selected,a.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:a.selected},bubbles:!0,composed:!0})))}c=!1,n=null}});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgbWFyZ2luLWJvdHRvbTogdmFyKC0tY2FyZC1tYXJnaW4tYm90dG9tLCAxMnB4KTsgcG9zaXRpb246IHJlbGF0aXZlOyB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15OyB9XG4gICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teCBwYW4teTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItdG9wOiB2YXIoLS1jYXJkLWJvcmRlci10b3AsIDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpKTtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiA0cHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsICM2NDc0OGIpO1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBib3gtc2hhZG93OiB2YXIoLS1jYXJkLWJveC1zaGFkb3csIDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjEpKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzLCBib3gtc2hhZG93IDAuMnMsIGJvcmRlci1sZWZ0LXdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKSwgcGFkZGluZy1sZWZ0IDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICAudG9wLXNoYWRvdyB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBsZWZ0OiAwO1xuICAgICAgICAgICAgcmlnaHQ6IDA7XG4gICAgICAgICAgICBoZWlnaHQ6IDZweDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtdG9wLXNoYWRvdywgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB6LWluZGV4OiAyMDtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgMCk7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgMCk7XG4gICAgICAgIH1cbiAgICAgICAgQG1lZGlhIChob3ZlcjogaG92ZXIpIHtcbiAgICAgICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyOmhvdmVyICsgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuY2FyZC13cmFwcGVyOmhvdmVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSB7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgb3V0bGluZTogMXB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIG91dGxpbmUtb2Zmc2V0OiAtMXB4O1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTVweCA4cHggMTVweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGVzYyB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggOHB4IDE1cHg7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xuICAgICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAyO1xuICAgICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggNnB4IDE1cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZCgqKSB7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCAxMnB4IDE1cHg7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjc1cmVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1iYXIge1xuICAgICAgICAgICAgd2lkdGg6IDIycHg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtaW50ZW50LCB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4YikpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA1cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDVweCkpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtoYXMtYWN0aW9uc10pIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhcjpob3ZlciB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4yKTtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1pY29uIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2U7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAtMnB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiByb3RhdGUoMTgwZGVnKTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IC0xcHg7XG4gICAgICAgICAgICByaWdodDogMjFweDtcbiAgICAgICAgICAgIHRvcDogLTFweDtcbiAgICAgICAgICAgIG1pbi1oZWlnaHQ6IGNhbGMoMTAwJSArIDJweCk7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICAvKiBQYXNzIENTUyB2YXJpYWJsZXMgdG8gcGVuZXRyYXRlIHNsb3R0ZWQgYXN5bmMgYnV0dG9ucyAqL1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogOHB4IDE2cHg7XG4gICAgICAgICAgICAtLWJ0bi1mb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTBweDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXMgZWFzZSwgdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuMTc1LCAwLjg4NSwgMC4zMiwgMS4yNzUpO1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHggMCAwIDZweDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNCk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgICAgICAgb3ZlcmZsb3cteDogYXV0bztcbiAgICAgICAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbiAgICAgICAgICAgIC13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOiB0b3VjaDtcbiAgICAgICAgICAgIHBhZGRpbmctYm90dG9tOiAycHg7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6YmVmb3JlIHtcbiAgICAgICAgICAgIGNvbnRlbnQ6ICcnO1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRyYXktY2FwdGlvbiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDRweDtcbiAgICAgICAgICAgIGxlZnQ6IDEwcHg7XG4gICAgICAgICAgICByaWdodDogMTBweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC42NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC41cHg7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNjtcbiAgICAgICAgfVxuICAgICAgICAvKiBVbnN0eWxlZCBzbG90cyBmb3IgaG9zdC1pbmplY3RlZCBidXR0b25zICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b24pIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZykgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF1bZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDEgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIC0tLSBDb21wYWN0IE1vZGUgVmFyaWFudCAtLS0gKi9cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAwIDAgMTBweDtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kb2NDbGlja0xpc3RlbmVyID0gdGhpcy5faGFuZGxlRG9jdW1lbnRDbGljay5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vdmVybGF5TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZGV0YWlsLnNvdXJjZSAhPT0gdGhpcyAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9mb2N1c091dExpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jb250YWlucyhlLnJlbGF0ZWRUYXJnZXQpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3Vzb3V0JywgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHRoaXMuX292ZXJsYXlMaXN0ZW5lcik7XG4gICAgICAgIC8vIE5hdGl2ZSBFZGdlLVN3aXBlIE5hdmlnYXRpb24gRGVmZWF0ZXJcbiAgICAgICAgdGhpcy5fdG91Y2hNb3ZlTGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICAgICAgY29uc3QgZGlmZlggPSBNYXRoLmFicyh0aGlzLl90b3VjaFN0YXJ0WCAtIGN1cnJlbnRYKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZZID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFkgLSBjdXJyZW50WSk7XG5cbiAgICAgICAgICAgIC8vIExvY2sgdGhlIGdlc3R1cmUgYXhpcyB1cG9uIGluaXRpYWwgNXB4IG9mIG1vdmVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChkaWZmWCA+IDUgfHwgZGlmZlkgPiA1KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBkaWZmWCA+IGRpZmZZO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIElmIHRoZSBnZXN0dXJlIGlzIGhvcml6b250YWwsIGZvcmNlZnVsbHkgaW50ZXJjZXB0IHRoZSB0b3VjaCBldmVudFxuICAgICAgICAgICAgLy8gdG8gcHJldmVudCB0aGUgbW9iaWxlIGJyb3dzZXIgZnJvbSB0cmlnZ2VyaW5nIFwiU3dpcGUgdG8gR28gQmFja1wiXG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGxldCBzaG91bGRQcmV2ZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwcGVyID0gcGF0aC5maW5kKGVsID0+IGVsLmNsYXNzTGlzdCAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGlvbnMtd3JhcHBlcicpKTtcblxuICAgICAgICAgICAgICAgIGlmICh3cmFwcGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTd2lwZSA9IGN1cnJlbnRYID4gdGhpcy5fdG91Y2hTdGFydFg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVmdFN3aXBlID0gY3VycmVudFggPCB0aGlzLl90b3VjaFN0YXJ0WDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF4U2Nyb2xsID0gTWF0aC5tYXgoMCwgd3JhcHBlci5zY3JvbGxXaWR0aCAtIHdyYXBwZXIuY2xpZW50V2lkdGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1JpZ2h0U3dpcGUgJiYgd3JhcHBlci5zY3JvbGxMZWZ0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkUHJldmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzTGVmdFN3aXBlICYmIHdyYXBwZXIuc2Nyb2xsTGVmdCA8IG1heFNjcm9sbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkUHJldmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZFByZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lciwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS10aGVtZSddIH0pO1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9kb2NDbGlja0xpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgaWYgKHRoaXMuX3RoZW1lT2JzZXJ2ZXIpIHRoaXMuX3RoZW1lT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2VsZi1IZWFsaW5nIFdyYXBwZXI6IFJlc2V0IHRyYW5zaWVudCBvdmVybGF5IHN0YXRlIGlmIExpdCByZWN5Y2xlcyB0aGUgRE9NIG5vZGUgZm9yIGEgbmV3IGl0ZW1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZW50aXR5RGF0YScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZmlsZW5hbWUnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RpdGxlVGV4dCcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVEb2N1bWVudENsaWNrKGUpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgICAgIGlmICghcGF0aC5pbmNsdWRlcyh0aGlzKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoU3RhcnQoZSkge1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICB0aGlzLl9jYXJkV2lkdGggPSByZWN0LndpZHRoO1xuICAgICAgICB0aGlzLl9sb2NhbFN0YXJ0WCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcblxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZS5jb21wb3NlZFBhdGgoKS5maW5kKGVsID0+IGVsLmNsYXNzTGlzdCAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGlvbnMtd3JhcHBlcicpKTtcbiAgICAgICAgdGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgPSB3cmFwcGVyID8gd3JhcHBlci5zY3JvbGxMZWZ0IDogbnVsbDtcbiAgICB9XG5cbiAgICBfdG9nZ2xlU2VsZWN0aW9uKCkge1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gIXRoaXMuc2VsZWN0ZWQ7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLXNlbGVjdC10b2dnbGVkJywge1xuICAgICAgICAgICAgZGV0YWlsOiB7IHNlbGVjdGVkOiB0aGlzLnNlbGVjdGVkIH0sXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hFbmQoZSkge1xuICAgICAgICBpZiAodGhpcy5fdG91Y2hTdGFydFggPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBjb25zdCB0b3VjaEVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gdG91Y2hFbmRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSB0aGlzLl90b3VjaFN0YXJ0WSAtIHRvdWNoRW5kWTtcblxuICAgICAgICAvLyBFbnN1cmUgaG9yaXpvbnRhbCBzd2lwZSBpcyBkb21pbmFudCB0byBwcmV2ZW50IGFjY2lkZW50YWwgdHJpZ2dlcnMgZHVyaW5nIHZlcnRpY2FsIHNjcm9sbGluZ1xuICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IE1hdGguYWJzKGRlbHRhWSkgJiYgTWF0aC5hYnMoZGVsdGFYKSA+IDMwKSB7XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTd2lwZSA9IGRlbHRhWCA+IDMwOyAgIC8vIFJpZ2h0LXRvLUxlZnRcbiAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTd2lwZSA9IGRlbHRhWCA8IC0zMDsgLy8gTGVmdC10by1SaWdodFxuICAgICAgICAgICAgLy8gV2lkZW4gdGhlIGhpdCB0YXJnZXQgdG8gMjUlIGZvciBiZXR0ZXIgZXJnb25vbWljcywgYW5kIGd1YXJhbnRlZSBhdCBsZWFzdCA3MHB4XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPCBNYXRoLm1heCgodGhpcy5fY2FyZFdpZHRoICogMC4yNSksIDcwKTtcblxuICAgICAgICAgICAgaWYgKGlzTGVmdFNpZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNSaWdodFN3aXBlICYmICF0aGlzLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5faGFzQWN0aW9ucyB8fCAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0FjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVmdFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1JpZ2h0U3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCAhPT0gbnVsbCAmJiB0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIGlzIHNjcm9sbGluZyB0aGUgYnV0dG9ucyBiYWNrIHRvIHRoZSBzdGFydDsgZG9uJ3QgY2xvc2UgdGhlIGRyYXdlciB5ZXRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cblxuICAgIF9oYW5kbGVQb2ludGVyRG93bihlKSB7XG4gICAgICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnICYmIGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9qdXN0TG9uZ1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLl9sb25nUHJlc3NUaW1lciA9IG51bGw7XG4gICAgICAgIH0sIDUwMCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVBvaW50ZXJDYW5jZWwoKSB7XG4gICAgICAgIGlmICh0aGlzLl9sb25nUHJlc3NUaW1lcikge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2xvbmdQcmVzc1RpbWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmaXJzdFVwZGF0ZWQoKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cblxuICAgIF9jaGVja0FjdGlvbnMoKSB7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3Rvcignc2xvdFtuYW1lPVwiYWN0aW9uc1wiXScpO1xuICAgICAgICBpZiAoc2xvdCkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBzbG90LmFzc2lnbmVkRWxlbWVudHMoeyBmbGF0dGVuOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGVsZW1lbnRzLmxlbmd0aCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVNsb3RDaGFuZ2UoZSkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7IXRoaXMuZGlzYWJsZVNlbGVjdGlvbiA/IGh0bWxgPGRpdiBjbGFzcz1cInNlbGVjdGlvbi1ndXR0ZXJcIiB0aXRsZT1cIlNlbGVjdCBJdGVtXCIgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7IH19PjwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIiBzdHlsZT1cIi0tY2FyZC1pbnRlbnQ6ICR7dGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0taW50ZW50LW5ldXRyYWwpJ31cIlxuICAgICAgICAgICAgICAgIEBtb3VzZWxlYXZlPSR7KCkgPT4geyBpZiAod2luZG93Lm1hdGNoTWVkaWEoJyhob3ZlcjogaG92ZXIpJykubWF0Y2hlcykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fVxuICAgICAgICAgICAgICAgIEB0b3VjaHN0YXJ0PSR7dGhpcy5faGFuZGxlVG91Y2hTdGFydH1cbiAgICAgICAgICAgICAgICBAdG91Y2hlbmQ9JHt0aGlzLl9oYW5kbGVUb3VjaEVuZH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcmRvd249JHt0aGlzLl9oYW5kbGVQb2ludGVyRG93bn1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcnVwPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcm1vdmU9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBwb2ludGVyY2FuY2VsPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAY2xpY2s9JHsoZSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2p1c3RMb25nUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fanVzdExvbmdQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfX0+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC10aXRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5pY29uID8gaHRtbGA8c3Bhbj4ke3RoaXMuaWNvbn08L3NwYW4+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRlc2NcIj4ke3RoaXMuZGVzY3JpcHRpb25UZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRldGFpbFwiPiR7dGhpcy5kZXRhaWxUZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImlubGluZS1hY3Rpb25zXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRyaWdnZXItYmFyXCIgIFxuICAgICAgICAgICAgICAgICAgICBAcG9pbnRlcmVudGVyPSR7KGUpID0+IHsgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlOyB9fVxuICAgICAgICAgICAgICAgICAgICBAY2xpY2s9JHsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBlLnByZXZlbnREZWZhdWx0KCk7IHRoaXMuX292ZXJsYXlBY3RpdmUgPSAhdGhpcy5fb3ZlcmxheUFjdGl2ZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJpZ2dlci1pY29uXCI+XHUyMDM5PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXRyYXlcIiBAY2xpY2s9JHsoZSkgPT4geyBpZihlLnRhcmdldC50YWdOYW1lID09PSAnQlVUVE9OJyB8fCBlLnRhcmdldC5jbG9zZXN0KCdidXR0b24nKSB8fCBlLnRhcmdldC50YWdOYW1lLmluY2x1ZGVzKCdZRU5WVUknKSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmF5LWNhcHRpb25cIj4ke3RoaXMudGl0bGVUZXh0fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtd3JhcHBlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImFjdGlvbnNcIiBAc2xvdGNoYW5nZT0ke3RoaXMuX2hhbmRsZVNsb3RDaGFuZ2V9Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b3Atc2hhZG93XCI+PC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY2FyZCcsIFllbnZ1aUNhcmQpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBHTE9CQUwgRURHRS1TV0lQRSBDT09SRElOQVRPUiAoTW9kdWxlIFNjb3BlKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2FmYXJpIGlnbm9yZXMgQ1NTIG92ZXJzY3JvbGwtYmVoYXZpb3IgZm9yIGV4dHJlbWUgZWRnZSBzd2lwZXMuIFxuLy8gV2UgbG9jayB0aGUgT1MgZ2VzdHVyZSBuYXRpdmVseSBhdCB0aGUgZG9jdW1lbnQgbGV2ZWwgYW5kIHJlc29sdmUgdGhlIFxuLy8gZHJvcCB0YXJnZXQgdG8gYWxsb3cgZ2xvYmFsIGNhcmQgc2VsZWN0aW9uIHdpdGhvdXQgcmVxdWlyaW5nIGEgRE9NIHdyYXBwZXIuXG5sZXQgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG5sZXQgX2VkZ2VTd2lwZVN0YXJ0WSA9IG51bGw7XG5sZXQgX2lzRWRnZVN3aXBlID0gZmFsc2U7XG5sZXQgX2dsb2JhbFN3aXBlQXhpcyA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldERlZXBDbG9zZXN0RnJvbVBvaW50KHgsIHksIHNlbGVjdG9yKSB7XG4gICAgbGV0IGVsID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCh4LCB5KTtcbiAgICB3aGlsZSAoZWwgJiYgZWwuc2hhZG93Um9vdCkge1xuICAgICAgICBjb25zdCBkZWVwZXIgPSBlbC5zaGFkb3dSb290LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgICAgIGlmICghZGVlcGVyIHx8IGRlZXBlciA9PT0gZWwpIGJyZWFrO1xuICAgICAgICBlbCA9IGRlZXBlcjtcbiAgICB9XG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICAgIGlmIChlbC5jbG9zZXN0ICYmIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpKSByZXR1cm4gZWwuY2xvc2VzdChzZWxlY3Rvcik7XG4gICAgICAgIGVsID0gZWwuZ2V0Um9vdE5vZGUoKS5ob3N0O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNFbGVtZW50SW5zaWRlKGVsLCBzZWxlY3Rvcikge1xuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIGVsID0gZWwuZ2V0Um9vdE5vZGUoKS5ob3N0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgKGUpID0+IHtcbiAgICBpZiAoZS50b3VjaGVzWzBdLmNsaWVudFggPCAzMCkge1xuICAgICAgICBfaXNFZGdlU3dpcGUgPSB0cnVlO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRYID0gZS50b3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIF9lZGdlU3dpcGVTdGFydFkgPSBlLnRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgX2dsb2JhbFN3aXBlQXhpcyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gZmFsc2U7XG4gICAgfVxufSwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCAoZSkgPT4ge1xuICAgIGlmIChfaXNFZGdlU3dpcGUgJiYgX2VkZ2VTd2lwZVN0YXJ0WCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBXYWl0IGZvciA1cHggb2YgbW92ZW1lbnQgdG8gbWF0aGVtYXRpY2FsbHkgbG9jayB0aGUgYXhpc1xuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgZHggPSBNYXRoLmFicyhlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFggLSBfZWRnZVN3aXBlU3RhcnRYKTtcbiAgICAgICAgICAgIGNvbnN0IGR5ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG4gICAgICAgICAgICBpZiAoZHggPiA1IHx8IGR5ID4gNSkge1xuICAgICAgICAgICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBkeCA+IGR5ID8gJ2hvcml6b250YWwnIDogJ3ZlcnRpY2FsJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfZ2xvYmFsU3dpcGVBeGlzID09PSAnaG9yaXpvbnRhbCcpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gS2lsbHMgU2FmYXJpIGJhY2stbmF2aWdhdGlvbiAmIGxvY2tzIHZlcnRpY2FsIGRyaWZ0XG4gICAgICAgIH0gZWxzZSBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ3ZlcnRpY2FsJykge1xuICAgICAgICAgICAgX2lzRWRnZVN3aXBlID0gZmFsc2U7IC8vIFJlbGVhc2VzIHRoZSBsb2NrIHRvIGFsbG93IG5hdGl2ZSB2ZXJ0aWNhbCBzY3JvbGxpbmdcbiAgICAgICAgfVxuICAgIH1cbn0sIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgZW5kWCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgY29uc3QgZW5kWSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gZW5kWCAtIF9lZGdlU3dpcGVTdGFydFg7XG4gICAgICAgIGNvbnN0IGRlbHRhWSA9IE1hdGguYWJzKGVuZFkgLSBfZWRnZVN3aXBlU3RhcnRZKTtcblxuICAgICAgICAvLyBPbmx5IGludGVydmVuZSBpZiB0aGUgc3dpcGUgc3RhcnRlZCBvbiB0aGUgYmFja2dyb3VuZCBwYWRkaW5nL2d1dHRlci5cbiAgICAgICAgY29uc3Qgc3RhcnRlZE9uQ2FyZCA9IGlzRWxlbWVudEluc2lkZShlLnRhcmdldCwgJ3llbnZ1aS1jYXJkJyk7XG5cbiAgICAgICAgLy8gSWYgaXQgd2FzIGEgY2xlYW4gcmlnaHR3YXJkIHN3aXBlIGZyb20gdGhlIGJhY2tncm91bmRcbiAgICAgICAgaWYgKCFzdGFydGVkT25DYXJkICYmIGRlbHRhWCA+IDMwICYmIGRlbHRhWCA+IGRlbHRhWSkge1xuICAgICAgICAgICAgY29uc3QgY2FyZCA9IGdldERlZXBDbG9zZXN0RnJvbVBvaW50KGVuZFgsIGVuZFksICd5ZW52dWktY2FyZCcpO1xuICAgICAgICAgICAgaWYgKGNhcmQgJiYgIWNhcmQuZGlzYWJsZVNlbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNhcmQuc2VsZWN0ZWQgPSAhY2FyZC5zZWxlY3RlZDtcbiAgICAgICAgICAgICAgICBjYXJkLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2FyZC1zZWxlY3QtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNlbGVjdGVkOiBjYXJkLnNlbGVjdGVkIH0sXG4gICAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRYID0gbnVsbDtcbiAgICB9XG59KTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLGNBQUFBLEVBQVksUUFBQUMsRUFBTSxPQUFBQyxNQUFXLE1BQy9CLGFBQU0sbUJBQW1CRixDQUFXLENBQ3ZDLE9BQU8sV0FBYSxDQUNoQixVQUFXLENBQUUsS0FBTSxNQUFPLEVBQzFCLFdBQVksQ0FBRSxLQUFNLE1BQU8sRUFDM0IsZ0JBQWlCLENBQUUsS0FBTSxNQUFPLEVBQ2hDLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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QzVEVyxFQUFLLEtBQUssSUFBSSxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQVVWLENBQWdCLEdBQzlEUyxFQUFLLEdBQUtDLEVBQUssS0FDZlIsRUFBbUJPLEVBQUtDLEVBQUssYUFBZSxXQUVwRCxDQUVJUixJQUFxQixhQUNyQixFQUFFLGVBQWUsRUFDVkEsSUFBcUIsYUFDNUJELEVBQWUsR0FFdkIsQ0FDSixFQUFHLENBQUUsUUFBUyxFQUFNLENBQUMsRUFFckIsU0FBUyxpQkFBaUIsV0FBYSxHQUFNLENBQ3pDLEdBQUlBLEdBQWdCRixJQUFxQixLQUFNLENBQzNDLE1BQU1ZLEVBQU8sRUFBRSxlQUFlLENBQUMsRUFBRSxRQUMzQkMsRUFBTyxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQzNCakIsRUFBU2dCLEVBQU9aLEVBQ2hCSCxFQUFTLEtBQUssSUFBSWdCLEVBQU9aLENBQWdCLEVBTS9DLEdBQUksQ0FIa0JRLEVBQWdCLEVBQUUsT0FBUSxhQUFhLEdBR3ZDYixFQUFTLElBQU1BLEVBQVNDLEVBQVEsQ0FDbEQsTUFBTWlCLEVBQU9WLEVBQXdCUSxFQUFNQyxFQUFNLGFBQWEsRUFDMURDLEdBQVEsQ0FBQ0EsRUFBSyxtQkFDZEEsRUFBSyxTQUFXLENBQUNBLEVBQUssU0FDdEJBLEVBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxTQUFVQSxFQUFLLFFBQVMsRUFDbEMsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsRUFFVixDQUNBWixFQUFlLEdBQ2ZGLEVBQW1CLElBQ3ZCLENBQ0osQ0FBQyIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImUiLCAiY3VycmVudFgiLCAiY3VycmVudFkiLCAiZGlmZlgiLCAiZGlmZlkiLCAic2hvdWxkUHJldmVudCIsICJ3cmFwcGVyIiwgImVsIiwgImlzUmlnaHRTd2lwZSIsICJpc0xlZnRTd2lwZSIsICJtYXhTY3JvbGwiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAicmVjdCIsICJ0b3VjaEVuZFgiLCAidG91Y2hFbmRZIiwgImRlbHRhWCIsICJkZWx0YVkiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
