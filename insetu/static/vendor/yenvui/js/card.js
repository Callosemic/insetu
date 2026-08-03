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

        :host([selected]) .card-wrapper {
            box-shadow: var(--card-box-shadow, none), 0 0 0 1px var(--card-intent, #3b82f6);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgbWFyZ2luLWJvdHRvbTogdmFyKC0tY2FyZC1tYXJnaW4tYm90dG9tLCAxMnB4KTsgcG9zaXRpb246IHJlbGF0aXZlOyB0b3VjaC1hY3Rpb246IHBhbi15OyB9XG4gICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItdG9wOiB2YXIoLS1jYXJkLWJvcmRlci10b3AsIDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpKTtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiA0cHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsICM2NDc0OGIpO1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4ycywgYm94LXNoYWRvdyAwLjJzLCBib3JkZXItbGVmdC13aWR0aCAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSksIHBhZGRpbmctbGVmdCAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRvcC1zaGFkb3cge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgdG9wOiAwO1xuICAgICAgICAgICAgbGVmdDogMDtcbiAgICAgICAgICAgIHJpZ2h0OiAwO1xuICAgICAgICAgICAgaGVpZ2h0OiA2cHg7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkLXRvcC1zaGFkb3csIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgei1pbmRleDogMjA7XG4gICAgICAgICAgICBib3JkZXItdG9wLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtbGVmdC1yYWRpdXMsIDApO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW3NlbGVjdGVkXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3gtc2hhZG93OiB2YXIoLS1jYXJkLWJveC1zaGFkb3csIG5vbmUpLCAwIDAgMCAxcHggdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICB9XG4gICAgICAgIEBtZWRpYSAoaG92ZXI6IGhvdmVyKSB7XG4gICAgICAgICAgICAuc2VsZWN0aW9uLWd1dHRlcjpob3ZlciArIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4O1xuICAgICAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMHB4O1xuICAgICAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmNhcmQtd3JhcHBlcjpob3ZlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkge1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIG91dGxpbmU6IDFweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICBvdXRsaW5lLW9mZnNldDogLTFweDtcbiAgICAgICAgfVxuICAgICAgICAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgbWluLXdpZHRoOiAwO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE1cHggOHB4IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMDVyZW07XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogOHB4O1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWRlc2Mge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDhweCAxNXB4O1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjlyZW07XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgICAgICBkaXNwbGF5OiAtd2Via2l0LWJveDtcbiAgICAgICAgICAgIC13ZWJraXQtbGluZS1jbGFtcDogMjtcbiAgICAgICAgICAgIC13ZWJraXQtYm94LW9yaWVudDogdmVydGljYWw7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDE1cHggMTVweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZmx1c2hdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKCopIHtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDEycHggMTVweDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8sIG1vbm9zcGFjZSk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNzVyZW07XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICB3aWR0aDogMjJweDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKSk7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBmaWx0ZXIgMC4ycztcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDVweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNXB4KSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hhcy1hY3Rpb25zXSkgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyOmhvdmVyIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjIpO1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZTtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IC0ycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLnRyaWdnZXItaWNvbiB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHJvdGF0ZSgxODBkZWcpO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogLTFweDtcbiAgICAgICAgICAgIHJpZ2h0OiAyMXB4O1xuICAgICAgICAgICAgdG9wOiAtMXB4O1xuICAgICAgICAgICAgbWluLWhlaWdodDogY2FsYygxMDAlICsgMnB4KTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIC8qIFBhc3MgQ1NTIHZhcmlhYmxlcyB0byBwZW5ldHJhdGUgc2xvdHRlZCBhc3luYyBidXR0b25zICovXG4gICAgICAgICAgICAtLWJ0bi1wYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgICAgIC0tYnRuLWZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDZweCAxMHB4O1xuICAgICAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cyBlYXNlLCB0cmFuc2Zvcm0gMC4zcyBjdWJpYy1iZXppZXIoMC4xNzUsIDAuODg1LCAwLjMyLCAxLjI3NSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAwIDAgNnB4O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjk4KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC40KTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IDE0cHg7IC8qIEVuc3VyZSBidXR0b25zIGRvbid0IGNsaXAgdGhlIGFic29sdXRlIGNhcHRpb24gKi9cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRyYXktY2FwdGlvbiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDRweDtcbiAgICAgICAgICAgIGxlZnQ6IDEwcHg7XG4gICAgICAgICAgICByaWdodDogMTBweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC42NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC41cHg7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNjtcbiAgICAgICAgfVxuICAgICAgICAvKiBVbnN0eWxlZCBzbG90cyBmb3IgaG9zdC1pbmplY3RlZCBidXR0b25zICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b24pIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZykgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF1bZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDEgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIC0tLSBDb21wYWN0IE1vZGUgVmFyaWFudCAtLS0gKi9cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAwIDAgMTBweDtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kb2NDbGlja0xpc3RlbmVyID0gdGhpcy5faGFuZGxlRG9jdW1lbnRDbGljay5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vdmVybGF5TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZGV0YWlsLnNvdXJjZSAhPT0gdGhpcyAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9mb2N1c091dExpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jb250YWlucyhlLnJlbGF0ZWRUYXJnZXQpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3Vzb3V0JywgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHRoaXMuX292ZXJsYXlMaXN0ZW5lcik7XG4gICAgICAgIC8vIE5hdGl2ZSBFZGdlLVN3aXBlIE5hdmlnYXRpb24gRGVmZWF0ZXJcbiAgICAgICAgdGhpcy5fdG91Y2hNb3ZlTGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICAgICAgY29uc3QgZGlmZlggPSBNYXRoLmFicyh0aGlzLl90b3VjaFN0YXJ0WCAtIGN1cnJlbnRYKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZZID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFkgLSBjdXJyZW50WSk7XG5cbiAgICAgICAgICAgIC8vIExvY2sgdGhlIGdlc3R1cmUgYXhpcyB1cG9uIGluaXRpYWwgNXB4IG9mIG1vdmVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChkaWZmWCA+IDUgfHwgZGlmZlkgPiA1KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBkaWZmWCA+IGRpZmZZO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhlIGdlc3R1cmUgaXMgaG9yaXpvbnRhbCwgZm9yY2VmdWxseSBpbnRlcmNlcHQgdGhlIHRvdWNoIGV2ZW50XG4gICAgICAgICAgICAvLyB0byBwcmV2ZW50IHRoZSBtb2JpbGUgYnJvd3NlciBmcm9tIHRyaWdnZXJpbmcgXCJTd2lwZSB0byBHbyBCYWNrXCJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsKSB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ19vdmVybGF5QWN0aXZlJykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLW92ZXJsYXktb3BlbmVkJywge1xuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNvdXJjZTogdGhpcyB9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxmLUhlYWxpbmcgV3JhcHBlcjogUmVzZXQgdHJhbnNpZW50IG92ZXJsYXkgc3RhdGUgaWYgTGl0IHJlY3ljbGVzIHRoZSBET00gbm9kZSBmb3IgYSBuZXcgaXRlbVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdlbnRpdHlEYXRhJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdmaWxlbmFtZScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygndGl0bGVUZXh0JykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZURvY3VtZW50Q2xpY2soZSkge1xuICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICAgICAgaWYgKCFwYXRoLmluY2x1ZGVzKHRoaXMpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hTdGFydChlKSB7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIHRoaXMuX2NhcmRXaWR0aCA9IHJlY3Qud2lkdGg7XG4gICAgICAgIHRoaXMuX2xvY2FsU3RhcnRYID0gdGhpcy5fdG91Y2hTdGFydFggLSByZWN0LmxlZnQ7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cblxuICAgIF90b2dnbGVTZWxlY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSAhdGhpcy5zZWxlY3RlZDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IHRoaXMuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIF9oYW5kbGVUb3VjaEVuZChlKSB7XG4gICAgICAgIGlmICh0aGlzLl90b3VjaFN0YXJ0WCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICBjb25zdCB0b3VjaEVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IHRvdWNoRW5kWSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gdGhpcy5fdG91Y2hTdGFydFggLSB0b3VjaEVuZFg7XG4gICAgICAgIGNvbnN0IGRlbHRhWSA9IHRoaXMuX3RvdWNoU3RhcnRZIC0gdG91Y2hFbmRZO1xuXG4gICAgICAgIC8vIEVuc3VyZSBob3Jpem9udGFsIHN3aXBlIGlzIGRvbWluYW50IHRvIHByZXZlbnQgYWNjaWRlbnRhbCB0cmlnZ2VycyBkdXJpbmcgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIGlmIChNYXRoLmFicyhkZWx0YVgpID4gTWF0aC5hYnMoZGVsdGFZKSAmJiBNYXRoLmFicyhkZWx0YVgpID4gMzApIHtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVmdFN3aXBlID0gZGVsdGFYID4gMzA7ICAgLy8gUmlnaHQtdG8tTGVmdFxuICAgICAgICAgICAgY29uc3QgaXNSaWdodFN3aXBlID0gZGVsdGFYIDwgLTMwOyAvLyBMZWZ0LXRvLVJpZ2h0XG4gICAgICAgICAgICAvLyBXaWRlbiB0aGUgaGl0IHRhcmdldCB0byAyNSUgZm9yIGJldHRlciBlcmdvbm9taWNzLCBhbmQgZ3VhcmFudGVlIGF0IGxlYXN0IDcwcHhcbiAgICAgICAgICAgIGNvbnN0IGlzTGVmdFNpZGUgPSB0aGlzLl9sb2NhbFN0YXJ0WCA8IE1hdGgubWF4KCh0aGlzLl9jYXJkV2lkdGggKiAwLjI1KSwgNzApO1xuXG4gICAgICAgICAgICBpZiAoaXNMZWZ0U2lkZSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1JpZ2h0U3dpcGUgJiYgIXRoaXMuZGlzYWJsZVNlbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhc0FjdGlvbnMgPSB0aGlzLl9oYXNBY3Rpb25zIHx8ICEhdGhpcy5xdWVyeVNlbGVjdG9yKCdbc2xvdD1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgICAgICAgICBpZiAoaGFzQWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNMZWZ0U3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzUmlnaHRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cblxuICAgIF9oYW5kbGVQb2ludGVyRG93bihlKSB7XG4gICAgICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnICYmIGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9qdXN0TG9uZ1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLl9sb25nUHJlc3NUaW1lciA9IG51bGw7XG4gICAgICAgIH0sIDUwMCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVBvaW50ZXJDYW5jZWwoKSB7XG4gICAgICAgIGlmICh0aGlzLl9sb25nUHJlc3NUaW1lcikge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2xvbmdQcmVzc1RpbWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmaXJzdFVwZGF0ZWQoKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cblxuICAgIF9jaGVja0FjdGlvbnMoKSB7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3Rvcignc2xvdFtuYW1lPVwiYWN0aW9uc1wiXScpO1xuICAgICAgICBpZiAoc2xvdCkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBzbG90LmFzc2lnbmVkRWxlbWVudHMoeyBmbGF0dGVuOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGVsZW1lbnRzLmxlbmd0aCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVNsb3RDaGFuZ2UoZSkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7IXRoaXMuZGlzYWJsZVNlbGVjdGlvbiA/IGh0bWxgPGRpdiBjbGFzcz1cInNlbGVjdGlvbi1ndXR0ZXJcIiB0aXRsZT1cIlNlbGVjdCBJdGVtXCIgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7IH19PjwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIiBzdHlsZT1cIi0tY2FyZC1pbnRlbnQ6ICR7dGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0taW50ZW50LW5ldXRyYWwpJ31cIlxuICAgICAgICAgICAgICAgIEBtb3VzZWxlYXZlPSR7KCkgPT4geyBpZiAod2luZG93Lm1hdGNoTWVkaWEoJyhob3ZlcjogaG92ZXIpJykubWF0Y2hlcykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fVxuICAgICAgICAgICAgICAgIEB0b3VjaHN0YXJ0PSR7dGhpcy5faGFuZGxlVG91Y2hTdGFydH1cbiAgICAgICAgICAgICAgICBAdG91Y2hlbmQ9JHt0aGlzLl9oYW5kbGVUb3VjaEVuZH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcmRvd249JHt0aGlzLl9oYW5kbGVQb2ludGVyRG93bn1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcnVwPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcm1vdmU9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBwb2ludGVyY2FuY2VsPSR7dGhpcy5faGFuZGxlUG9pbnRlckNhbmNlbH1cbiAgICAgICAgICAgICAgICBAY2xpY2s9JHsoZSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2p1c3RMb25nUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fanVzdExvbmdQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfX0+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC10aXRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5pY29uID8gaHRtbGA8c3Bhbj4ke3RoaXMuaWNvbn08L3NwYW4+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRlc2NcIj4ke3RoaXMuZGVzY3JpcHRpb25UZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRldGFpbFwiPiR7dGhpcy5kZXRhaWxUZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImlubGluZS1hY3Rpb25zXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRyaWdnZXItYmFyXCIgIFxuICAgICAgICAgICAgICAgICAgICBAcG9pbnRlcmVudGVyPSR7KGUpID0+IHsgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlOyB9fVxuICAgICAgICAgICAgICAgICAgICBAY2xpY2s9JHsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBlLnByZXZlbnREZWZhdWx0KCk7IHRoaXMuX292ZXJsYXlBY3RpdmUgPSAhdGhpcy5fb3ZlcmxheUFjdGl2ZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJpZ2dlci1pY29uXCI+XHUyMDM5PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXRyYXlcIiBAY2xpY2s9JHsoZSkgPT4geyBpZihlLnRhcmdldC50YWdOYW1lID09PSAnQlVUVE9OJyB8fCBlLnRhcmdldC5jbG9zZXN0KCdidXR0b24nKSB8fCBlLnRhcmdldC50YWdOYW1lLmluY2x1ZGVzKCdZRU5WVUknKSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmF5LWNhcHRpb25cIj4ke3RoaXMudGl0bGVUZXh0fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtd3JhcHBlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImFjdGlvbnNcIiBAc2xvdGNoYW5nZT0ke3RoaXMuX2hhbmRsZVNsb3RDaGFuZ2V9Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b3Atc2hhZG93XCI+PC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY2FyZCcsIFllbnZ1aUNhcmQpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBHTE9CQUwgRURHRS1TV0lQRSBDT09SRElOQVRPUiAoTW9kdWxlIFNjb3BlKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2FmYXJpIGlnbm9yZXMgQ1NTIG92ZXJzY3JvbGwtYmVoYXZpb3IgZm9yIGV4dHJlbWUgZWRnZSBzd2lwZXMuIFxuLy8gV2UgbG9jayB0aGUgT1MgZ2VzdHVyZSBuYXRpdmVseSBhdCB0aGUgZG9jdW1lbnQgbGV2ZWwgYW5kIHJlc29sdmUgdGhlIFxuLy8gZHJvcCB0YXJnZXQgdG8gYWxsb3cgZ2xvYmFsIGNhcmQgc2VsZWN0aW9uIHdpdGhvdXQgcmVxdWlyaW5nIGEgRE9NIHdyYXBwZXIuXG5sZXQgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG5sZXQgX2VkZ2VTd2lwZVN0YXJ0WSA9IG51bGw7XG5sZXQgX2lzRWRnZVN3aXBlID0gZmFsc2U7XG5sZXQgX2dsb2JhbFN3aXBlQXhpcyA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldERlZXBDbG9zZXN0RnJvbVBvaW50KHgsIHksIHNlbGVjdG9yKSB7XG4gICAgbGV0IGVsID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCh4LCB5KTtcbiAgICB3aGlsZSAoZWwgJiYgZWwuc2hhZG93Um9vdCkge1xuICAgICAgICBjb25zdCBkZWVwZXIgPSBlbC5zaGFkb3dSb290LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgICAgIGlmICghZGVlcGVyIHx8IGRlZXBlciA9PT0gZWwpIGJyZWFrO1xuICAgICAgICBlbCA9IGRlZXBlcjtcbiAgICB9XG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICAgIGlmIChlbC5jbG9zZXN0ICYmIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpKSByZXR1cm4gZWwuY2xvc2VzdChzZWxlY3Rvcik7XG4gICAgICAgIGVsID0gZWwuZ2V0Um9vdE5vZGUoKS5ob3N0O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNFbGVtZW50SW5zaWRlKGVsLCBzZWxlY3Rvcikge1xuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIGVsID0gZWwuZ2V0Um9vdE5vZGUoKS5ob3N0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgKGUpID0+IHtcbiAgICBpZiAoZS50b3VjaGVzWzBdLmNsaWVudFggPCAzMCkge1xuICAgICAgICBfaXNFZGdlU3dpcGUgPSB0cnVlO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRYID0gZS50b3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIF9lZGdlU3dpcGVTdGFydFkgPSBlLnRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgX2dsb2JhbFN3aXBlQXhpcyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gZmFsc2U7XG4gICAgfVxufSwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCAoZSkgPT4ge1xuICAgIGlmIChfaXNFZGdlU3dpcGUgJiYgX2VkZ2VTd2lwZVN0YXJ0WCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBXYWl0IGZvciA1cHggb2YgbW92ZW1lbnQgdG8gbWF0aGVtYXRpY2FsbHkgbG9jayB0aGUgYXhpc1xuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgZHggPSBNYXRoLmFicyhlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFggLSBfZWRnZVN3aXBlU3RhcnRYKTtcbiAgICAgICAgICAgIGNvbnN0IGR5ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG4gICAgICAgICAgICBpZiAoZHggPiA1IHx8IGR5ID4gNSkge1xuICAgICAgICAgICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBkeCA+IGR5ID8gJ2hvcml6b250YWwnIDogJ3ZlcnRpY2FsJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfZ2xvYmFsU3dpcGVBeGlzID09PSAnaG9yaXpvbnRhbCcpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gS2lsbHMgU2FmYXJpIGJhY2stbmF2aWdhdGlvbiAmIGxvY2tzIHZlcnRpY2FsIGRyaWZ0XG4gICAgICAgIH0gZWxzZSBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ3ZlcnRpY2FsJykge1xuICAgICAgICAgICAgX2lzRWRnZVN3aXBlID0gZmFsc2U7IC8vIFJlbGVhc2VzIHRoZSBsb2NrIHRvIGFsbG93IG5hdGl2ZSB2ZXJ0aWNhbCBzY3JvbGxpbmdcbiAgICAgICAgfVxuICAgIH1cbn0sIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgZW5kWCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgY29uc3QgZW5kWSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gZW5kWCAtIF9lZGdlU3dpcGVTdGFydFg7XG4gICAgICAgIGNvbnN0IGRlbHRhWSA9IE1hdGguYWJzKGVuZFkgLSBfZWRnZVN3aXBlU3RhcnRZKTtcblxuICAgICAgICAvLyBPbmx5IGludGVydmVuZSBpZiB0aGUgc3dpcGUgc3RhcnRlZCBvbiB0aGUgYmFja2dyb3VuZCBwYWRkaW5nL2d1dHRlci5cbiAgICAgICAgY29uc3Qgc3RhcnRlZE9uQ2FyZCA9IGlzRWxlbWVudEluc2lkZShlLnRhcmdldCwgJ3llbnZ1aS1jYXJkJyk7XG5cbiAgICAgICAgLy8gSWYgaXQgd2FzIGEgY2xlYW4gcmlnaHR3YXJkIHN3aXBlIGZyb20gdGhlIGJhY2tncm91bmRcbiAgICAgICAgaWYgKCFzdGFydGVkT25DYXJkICYmIGRlbHRhWCA+IDMwICYmIGRlbHRhWCA+IGRlbHRhWSkge1xuICAgICAgICAgICAgY29uc3QgY2FyZCA9IGdldERlZXBDbG9zZXN0RnJvbVBvaW50KGVuZFgsIGVuZFksICd5ZW52dWktY2FyZCcpO1xuICAgICAgICAgICAgaWYgKGNhcmQgJiYgIWNhcmQuZGlzYWJsZVNlbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNhcmQuc2VsZWN0ZWQgPSAhY2FyZC5zZWxlY3RlZDtcbiAgICAgICAgICAgICAgICBjYXJkLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2FyZC1zZWxlY3QtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNlbGVjdGVkOiBjYXJkLnNlbGVjdGVkIH0sXG4gICAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRYID0gbnVsbDtcbiAgICB9XG59KTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLGNBQUFBLEVBQVksUUFBQUMsRUFBTSxPQUFBQyxNQUFXLE1BQy9CLGFBQU0sbUJBQW1CRixDQUFXLENBQ3ZDLE9BQU8sV0FBYSxDQUNoQixVQUFXLENBQUUsS0FBTSxNQUFPLEVBQzFCLFdBQVksQ0FBRSxLQUFNLE1BQU8sRUFDM0IsZ0JBQWlCLENBQUUsS0FBTSxNQUFPLEVBQ2hDLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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SUEsR0FBZ0JGLElBQXFCLEtBQU0sQ0FDM0MsTUFBTWEsRUFBTyxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQzNCQyxFQUFPLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFDM0JwQixFQUFTbUIsRUFBT2IsRUFDaEJMLEVBQVMsS0FBSyxJQUFJbUIsRUFBT2IsQ0FBZ0IsRUFNL0MsR0FBSSxDQUhrQlMsRUFBZ0IsRUFBRSxPQUFRLGFBQWEsR0FHdkNoQixFQUFTLElBQU1BLEVBQVNDLEVBQVEsQ0FDbEQsTUFBTW9CLEVBQU9YLEVBQXdCUyxFQUFNQyxFQUFNLGFBQWEsRUFDMURDLEdBQVEsQ0FBQ0EsRUFBSyxtQkFDZEEsRUFBSyxTQUFXLENBQUNBLEVBQUssU0FDdEJBLEVBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxTQUFVQSxFQUFLLFFBQVMsRUFDbEMsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsRUFFVixDQUNBYixFQUFlLEdBQ2ZGLEVBQW1CLElBQ3ZCLENBQ0osQ0FBQyIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImUiLCAiY3VycmVudFgiLCAiY3VycmVudFkiLCAiZGlmZlgiLCAiZGlmZlkiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAicmVjdCIsICJ0b3VjaEVuZFgiLCAidG91Y2hFbmRZIiwgImRlbHRhWCIsICJkZWx0YVkiLCAiaXNMZWZ0U3dpcGUiLCAiaXNSaWdodFN3aXBlIiwgInNsb3QiLCAiZWxlbWVudHMiLCAiX2VkZ2VTd2lwZVN0YXJ0WCIsICJfZWRnZVN3aXBlU3RhcnRZIiwgIl9pc0VkZ2VTd2lwZSIsICJfZ2xvYmFsU3dpcGVBeGlzIiwgImdldERlZXBDbG9zZXN0RnJvbVBvaW50IiwgIngiLCAieSIsICJzZWxlY3RvciIsICJlbCIsICJkZWVwZXIiLCAiaXNFbGVtZW50SW5zaWRlIiwgImR4IiwgImR5IiwgImVuZFgiLCAiZW5kWSIsICJjYXJkIl0KfQo=
