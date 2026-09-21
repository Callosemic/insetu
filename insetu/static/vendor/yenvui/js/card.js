import{LitElement as g,html as s,css as m}from"lit";export class YenvuiCard extends g{static properties={titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},stale:{type:Boolean,reflect:!0}};static styles=m`
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
        :host([stale]) .card-wrapper {
            opacity: 0.65;
            filter: grayscale(0.3);
            border-style: dashed;
            transition: opacity 0.3s ease, filter 0.3s ease;
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
        @container (max-width: 480px) {
            .card-detail-main { display: none; }
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
            background: color-mix(in srgb, var(--input-bg, #2d2d2d) 75%, transparent);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            border: 1px solid var(--border, #444);
            border-right: none;
            display: flex;
            flex-direction: column;
            justify-content: center;
            /* Pass CSS variables to penetrate slotted async buttons */
            --btn-padding: 8px 16px;
            --btn-font-size: 0.85rem;
            padding: 6px 10px 0px 10px;
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
            padding-bottom: 8px;
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

        /* Show slim scrollbars for users with a mouse */
        @media (pointer: fine) {
            .actions-wrapper {
                scrollbar-width: thin;
                scrollbar-color: var(--border, #444) transparent;
                padding-bottom: 8px;
            }
            .actions-wrapper::-webkit-scrollbar {
                display: block;
                height: 6px;
            }
            .actions-wrapper::-webkit-scrollbar-thumb {
                background-color: var(--border, #444);
                border-radius: 10px;
            }
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
            background: color-mix(in srgb, #ffffff 75%, transparent);
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        :host([data-theme="e-ink"]) .actions-tray {
            background: #ffffff;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const o=t.changedTouches[0].clientX,i=t.changedTouches[0].clientY,r=Math.abs(this._touchStartX-o),l=Math.abs(this._touchStartY-i);if(this._isSwipingHorizontal===null&&(r>5||l>5)&&(this._isSwipingHorizontal=r>l),this._isSwipingHorizontal){let a=!0;const n=t.composedPath().find(h=>h.classList&&h.classList.contains("actions-wrapper"));if(n){const h=o>this._touchStartX,b=o<this._touchStartX,v=Math.max(0,n.scrollWidth-n.clientWidth);(h&&n.scrollLeft>0||b&&n.scrollLeft<v)&&(a=!1)}a&&t.preventDefault()}},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1}),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._themeObserver&&this._themeObserver.disconnect()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const o=this.getBoundingClientRect();this._cardWidth=o.width,this._localStartX=this._touchStartX-o.left,this._isSwipingHorizontal=null;const i=t.composedPath().find(r=>r.classList&&r.classList.contains("actions-wrapper"));this._actionsScrollLeft=i?i.scrollLeft:null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const o=t.changedTouches[0].clientX,i=t.changedTouches[0].clientY,r=this._touchStartX-o,l=this._touchStartY-i;if(Math.abs(r)>Math.abs(l)&&Math.abs(r)>30){const a=r>30,u=r<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?u&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(a?this._overlayActive=!0:u&&(this._actionsScrollLeft!==null&&this._actionsScrollLeft>0||(this._overlayActive=!1)))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const o=t.assignedElements({flatten:!0});this._hasActions=o.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return s`
            ${this.disableSelection?"":s`<div class="selection-gutter" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div>`}
            <div class="card-wrapper" style="--card-intent: ${this.intentColor||"var(--intent-neutral)"}"
                @mouseleave=${()=>{window.matchMedia("(hover: hover)").matches&&(this._overlayActive=!1)}}
                @touchstart=${this._handleTouchStart}
                @touchend=${this._handleTouchEnd}>

                <div class="content-col">
                    <div class="card-header">
                        <div class="card-title">
                            ${this.icon?s`<span>${this.icon}</span>`:""}
                            ${this.titleText}
                        </div>
                    </div>
                    ${this.descriptionText?s`<div class="card-desc">${this.descriptionText}</div>`:""}
                    <div class="card-body">
                        <slot></slot>
                    </div>
                    ${this.detailText||this.detailPrefix||this.detailSuffix?s`
                        <div class="card-detail">
                            ${this.detailPrefix?s`<span class="card-detail-prefix">${this.detailPrefix}</span>`:""}
                            ${this.detailText?s`<span class="card-detail-main">${this.detailText}</span>`:""}
                            ${this.detailSuffix?s`<span class="card-detail-suffix">${this.detailSuffix}</span>`:""}
                        </div>
                    `:""}
                    <slot name="detail"></slot>
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
        `}}customElements.define("yenvui-card",YenvuiCard);let c=null,f=null,d=!1,p=null;function x(e,t,o){let i=document.elementFromPoint(e,t);for(;i&&i.shadowRoot;){const r=i.shadowRoot.elementFromPoint(e,t);if(!r||r===i)break;i=r}for(;i;){if(i.closest&&i.closest(o))return i.closest(o);i=i.getRootNode().host}return null}function w(e,t){for(;e;){if(e.closest&&e.closest(t))return!0;e=e.getRootNode().host}return!1}document.addEventListener("touchstart",e=>{e.touches[0].clientX<30?(d=!0,c=e.touches[0].clientX,f=e.touches[0].clientY,p=null):d=!1},{passive:!0}),document.addEventListener("touchmove",e=>{if(d&&c!==null){if(p===null){const t=Math.abs(e.changedTouches[0].clientX-c),o=Math.abs(e.changedTouches[0].clientY-f);(t>5||o>5)&&(p=t>o?"horizontal":"vertical")}p==="horizontal"?e.preventDefault():p==="vertical"&&(d=!1)}},{passive:!1}),document.addEventListener("touchend",e=>{if(d&&c!==null){const t=e.changedTouches[0].clientX,o=e.changedTouches[0].clientY,i=t-c,r=Math.abs(o-f);if(!w(e.target,"yenvui-card")&&i>30&&i>r){const a=x(t,o,"yenvui-card");a&&!a.disableSelection&&(a.selected=!a.selected,a.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:a.selected},bubbles:!0,composed:!0})))}d=!1,c=null}});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsUHJlZml4OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxTdWZmaXg6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaWNvbjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaW50ZW50Q29sb3I6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHNlbGVjdGVkOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgZGlzYWJsZVNlbGVjdGlvbjogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIF9vdmVybGF5QWN0aXZlOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgX2hhc0FjdGlvbnM6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSwgYXR0cmlidXRlOiAnaGFzLWFjdGlvbnMnIH0sXG4gICAgICAgIGNvbXBhY3Q6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBmbHVzaDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIHN0YWxlOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgbWFyZ2luLWJvdHRvbTogdmFyKC0tY2FyZC1tYXJnaW4tYm90dG9tLCAxMnB4KTsgcG9zaXRpb246IHJlbGF0aXZlOyB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15OyB9XG4gICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMjBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi15O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teCBwYW4teTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItdG9wOiB2YXIoLS1jYXJkLWJvcmRlci10b3AsIDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpKTtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiA0cHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsICM2NDc0OGIpO1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBib3gtc2hhZG93OiB2YXIoLS1jYXJkLWJveC1zaGFkb3csIDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjEpKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzLCBib3gtc2hhZG93IDAuMnMsIGJvcmRlci1sZWZ0LXdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKSwgcGFkZGluZy1sZWZ0IDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICAudG9wLXNoYWRvdyB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBsZWZ0OiAwO1xuICAgICAgICAgICAgcmlnaHQ6IDA7XG4gICAgICAgICAgICBoZWlnaHQ6IDZweDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtdG9wLXNoYWRvdywgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB6LWluZGV4OiAyMDtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgMCk7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgMCk7XG4gICAgICAgIH1cbiAgICAgICAgQG1lZGlhIChob3ZlcjogaG92ZXIpIHtcbiAgICAgICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyOmhvdmVyICsgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuY2FyZC13cmFwcGVyOmhvdmVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSB7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgb3V0bGluZTogMXB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIG91dGxpbmUtb2Zmc2V0OiAtMXB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzdGFsZV0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgb3BhY2l0eTogMC42NTtcbiAgICAgICAgICAgIGZpbHRlcjogZ3JheXNjYWxlKDAuMyk7XG4gICAgICAgICAgICBib3JkZXItc3R5bGU6IGRhc2hlZDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4zcyBlYXNlLCBmaWx0ZXIgMC4zcyBlYXNlO1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTVweCA4cHggMTVweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGVzYyB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggOHB4IDE1cHg7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xuICAgICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAyO1xuICAgICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggNnB4IDE1cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZCgqKSB7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCAxMnB4IDE1cHg7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjc1cmVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgfVxuICAgICAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDQ4MHB4KSB7XG4gICAgICAgICAgICAuY2FyZC1kZXRhaWwtbWFpbiB7IGRpc3BsYXk6IG5vbmU7IH1cbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1iYXIge1xuICAgICAgICAgICAgd2lkdGg6IDIycHg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhcmQtaW50ZW50LCB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4YikpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA1cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDVweCkpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtoYXMtYWN0aW9uc10pIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhcjpob3ZlciB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4yKTtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1pY29uIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2U7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAtMnB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiByb3RhdGUoMTgwZGVnKTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IC0xcHg7XG4gICAgICAgICAgICByaWdodDogMjFweDtcbiAgICAgICAgICAgIHRvcDogLTFweDtcbiAgICAgICAgICAgIG1pbi1oZWlnaHQ6IGNhbGMoMTAwJSArIDJweCk7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKSA3NSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cig0cHgpO1xuICAgICAgICAgICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IGJsdXIoNHB4KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgLyogUGFzcyBDU1MgdmFyaWFibGVzIHRvIHBlbmV0cmF0ZSBzbG90dGVkIGFzeW5jIGJ1dHRvbnMgKi9cbiAgICAgICAgICAgIC0tYnRuLXBhZGRpbmc6IDhweCAxNnB4O1xuICAgICAgICAgICAgLS1idG4tZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDEwcHggMHB4IDEwcHg7XG4gICAgICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMjVzIGVhc2UsIHRyYW5zZm9ybSAwLjNzIGN1YmljLWJlemllcigwLjE3NSwgMC44ODUsIDAuMzIsIDEuMjc1KTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4IDAgMCA2cHg7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHNjYWxlKDAuOTgpO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjQpO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXdyYXBwZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICAgICAgICAgIGdhcDogOHB4O1xuICAgICAgICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgICAgICAgIG92ZXJmbG93LXg6IGF1dG87XG4gICAgICAgICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XG4gICAgICAgICAgICAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2g7XG4gICAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXdyYXBwZXI6OmJlZm9yZSB7XG4gICAgICAgICAgICBjb250ZW50OiAnJztcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXdyYXBwZXI6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBTaG93IHNsaW0gc2Nyb2xsYmFycyBmb3IgdXNlcnMgd2l0aCBhIG1vdXNlICovXG4gICAgICAgIEBtZWRpYSAocG9pbnRlcjogZmluZSkge1xuICAgICAgICAgICAgLmFjdGlvbnMtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgc2Nyb2xsYmFyLXdpZHRoOiB0aGluO1xuICAgICAgICAgICAgICAgIHNjcm9sbGJhci1jb2xvcjogdmFyKC0tYm9yZGVyLCAjNDQ0KSB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgICAgICAgICAgIGhlaWdodDogNnB4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6LXdlYmtpdC1zY3JvbGxiYXItdGh1bWIge1xuICAgICAgICAgICAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgb3BhY2l0eTogMTtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBhdXRvO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxKTtcbiAgICAgICAgfVxuICAgICAgICAudHJheS1jYXB0aW9uIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIHRvcDogNHB4O1xuICAgICAgICAgICAgbGVmdDogMTBweDtcbiAgICAgICAgICAgIHJpZ2h0OiAxMHB4O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjY1cmVtO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcbiAgICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjVweDtcbiAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCAjZmZmZmZmIDc1JSwgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjE1KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IG5vbmU7XG4gICAgICAgICAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNjtcbiAgICAgICAgfVxuICAgICAgICAvKiBVbnN0eWxlZCBzbG90cyBmb3IgaG9zdC1pbmplY3RlZCBidXR0b25zICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b24pIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1idG4tcGFkZGluZykgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS1idG4tZm9udC1zaXplKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF1bZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDEgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIC0tLSBDb21wYWN0IE1vZGUgVmFyaWFudCAtLS0gKi9cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAwIDAgMTBweDtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kb2NDbGlja0xpc3RlbmVyID0gdGhpcy5faGFuZGxlRG9jdW1lbnRDbGljay5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vdmVybGF5TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZGV0YWlsLnNvdXJjZSAhPT0gdGhpcyAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9mb2N1c091dExpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jb250YWlucyhlLnJlbGF0ZWRUYXJnZXQpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3Vzb3V0JywgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHRoaXMuX292ZXJsYXlMaXN0ZW5lcik7XG4gICAgICAgIC8vIE5hdGl2ZSBFZGdlLVN3aXBlIE5hdmlnYXRpb24gRGVmZWF0ZXJcbiAgICAgICAgdGhpcy5fdG91Y2hNb3ZlTGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICAgICAgY29uc3QgZGlmZlggPSBNYXRoLmFicyh0aGlzLl90b3VjaFN0YXJ0WCAtIGN1cnJlbnRYKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZZID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFkgLSBjdXJyZW50WSk7XG5cbiAgICAgICAgICAgIC8vIExvY2sgdGhlIGdlc3R1cmUgYXhpcyB1cG9uIGluaXRpYWwgNXB4IG9mIG1vdmVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChkaWZmWCA+IDUgfHwgZGlmZlkgPiA1KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBkaWZmWCA+IGRpZmZZO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIElmIHRoZSBnZXN0dXJlIGlzIGhvcml6b250YWwsIGZvcmNlZnVsbHkgaW50ZXJjZXB0IHRoZSB0b3VjaCBldmVudFxuICAgICAgICAgICAgLy8gdG8gcHJldmVudCB0aGUgbW9iaWxlIGJyb3dzZXIgZnJvbSB0cmlnZ2VyaW5nIFwiU3dpcGUgdG8gR28gQmFja1wiXG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGxldCBzaG91bGRQcmV2ZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwcGVyID0gcGF0aC5maW5kKGVsID0+IGVsLmNsYXNzTGlzdCAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGlvbnMtd3JhcHBlcicpKTtcblxuICAgICAgICAgICAgICAgIGlmICh3cmFwcGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTd2lwZSA9IGN1cnJlbnRYID4gdGhpcy5fdG91Y2hTdGFydFg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVmdFN3aXBlID0gY3VycmVudFggPCB0aGlzLl90b3VjaFN0YXJ0WDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF4U2Nyb2xsID0gTWF0aC5tYXgoMCwgd3JhcHBlci5zY3JvbGxXaWR0aCAtIHdyYXBwZXIuY2xpZW50V2lkdGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1JpZ2h0U3dpcGUgJiYgd3JhcHBlci5zY3JvbGxMZWZ0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkUHJldmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzTGVmdFN3aXBlICYmIHdyYXBwZXIuc2Nyb2xsTGVmdCA8IG1heFNjcm9sbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkUHJldmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZFByZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lciwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS10aGVtZSddIH0pO1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9kb2NDbGlja0xpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgaWYgKHRoaXMuX3RoZW1lT2JzZXJ2ZXIpIHRoaXMuX3RoZW1lT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2VsZi1IZWFsaW5nIFdyYXBwZXI6IFJlc2V0IHRyYW5zaWVudCBvdmVybGF5IHN0YXRlIGlmIExpdCByZWN5Y2xlcyB0aGUgRE9NIG5vZGUgZm9yIGEgbmV3IGl0ZW1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZW50aXR5RGF0YScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZmlsZW5hbWUnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RpdGxlVGV4dCcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVEb2N1bWVudENsaWNrKGUpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgICAgIGlmICghcGF0aC5pbmNsdWRlcyh0aGlzKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoU3RhcnQoZSkge1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICB0aGlzLl9jYXJkV2lkdGggPSByZWN0LndpZHRoO1xuICAgICAgICB0aGlzLl9sb2NhbFN0YXJ0WCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcblxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZS5jb21wb3NlZFBhdGgoKS5maW5kKGVsID0+IGVsLmNsYXNzTGlzdCAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGlvbnMtd3JhcHBlcicpKTtcbiAgICAgICAgdGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgPSB3cmFwcGVyID8gd3JhcHBlci5zY3JvbGxMZWZ0IDogbnVsbDtcbiAgICB9XG5cbiAgICBfdG9nZ2xlU2VsZWN0aW9uKCkge1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gIXRoaXMuc2VsZWN0ZWQ7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLXNlbGVjdC10b2dnbGVkJywge1xuICAgICAgICAgICAgZGV0YWlsOiB7IHNlbGVjdGVkOiB0aGlzLnNlbGVjdGVkIH0sXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hFbmQoZSkge1xuICAgICAgICBpZiAodGhpcy5fdG91Y2hTdGFydFggPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBjb25zdCB0b3VjaEVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gdG91Y2hFbmRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSB0aGlzLl90b3VjaFN0YXJ0WSAtIHRvdWNoRW5kWTtcblxuICAgICAgICAvLyBFbnN1cmUgaG9yaXpvbnRhbCBzd2lwZSBpcyBkb21pbmFudCB0byBwcmV2ZW50IGFjY2lkZW50YWwgdHJpZ2dlcnMgZHVyaW5nIHZlcnRpY2FsIHNjcm9sbGluZ1xuICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IE1hdGguYWJzKGRlbHRhWSkgJiYgTWF0aC5hYnMoZGVsdGFYKSA+IDMwKSB7XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTd2lwZSA9IGRlbHRhWCA+IDMwOyAgIC8vIFJpZ2h0LXRvLUxlZnRcbiAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTd2lwZSA9IGRlbHRhWCA8IC0zMDsgLy8gTGVmdC10by1SaWdodFxuICAgICAgICAgICAgLy8gV2lkZW4gdGhlIGhpdCB0YXJnZXQgdG8gMjUlIGZvciBiZXR0ZXIgZXJnb25vbWljcywgYW5kIGd1YXJhbnRlZSBhdCBsZWFzdCA3MHB4XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPCBNYXRoLm1heCgodGhpcy5fY2FyZFdpZHRoICogMC4yNSksIDcwKTtcblxuICAgICAgICAgICAgaWYgKGlzTGVmdFNpZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNSaWdodFN3aXBlICYmICF0aGlzLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5faGFzQWN0aW9ucyB8fCAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0FjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVmdFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1JpZ2h0U3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCAhPT0gbnVsbCAmJiB0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIGlzIHNjcm9sbGluZyB0aGUgYnV0dG9ucyBiYWNrIHRvIHRoZSBzdGFydDsgZG9uJ3QgY2xvc2UgdGhlIGRyYXdlciB5ZXRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cbiAgICBmaXJzdFVwZGF0ZWQoKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cblxuICAgIF9jaGVja0FjdGlvbnMoKSB7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3Rvcignc2xvdFtuYW1lPVwiYWN0aW9uc1wiXScpO1xuICAgICAgICBpZiAoc2xvdCkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBzbG90LmFzc2lnbmVkRWxlbWVudHMoeyBmbGF0dGVuOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGVsZW1lbnRzLmxlbmd0aCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVNsb3RDaGFuZ2UoZSkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7IXRoaXMuZGlzYWJsZVNlbGVjdGlvbiA/IGh0bWxgPGRpdiBjbGFzcz1cInNlbGVjdGlvbi1ndXR0ZXJcIiB0aXRsZT1cIlNlbGVjdCBJdGVtXCIgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7IH19PjwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIiBzdHlsZT1cIi0tY2FyZC1pbnRlbnQ6ICR7dGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0taW50ZW50LW5ldXRyYWwpJ31cIlxuICAgICAgICAgICAgICAgIEBtb3VzZWxlYXZlPSR7KCkgPT4geyBpZiAod2luZG93Lm1hdGNoTWVkaWEoJyhob3ZlcjogaG92ZXIpJykubWF0Y2hlcykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fVxuICAgICAgICAgICAgICAgIEB0b3VjaHN0YXJ0PSR7dGhpcy5faGFuZGxlVG91Y2hTdGFydH1cbiAgICAgICAgICAgICAgICBAdG91Y2hlbmQ9JHt0aGlzLl9oYW5kbGVUb3VjaEVuZH0+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC10aXRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5pY29uID8gaHRtbGA8c3Bhbj4ke3RoaXMuaWNvbn08L3NwYW4+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRlc2NcIj4ke3RoaXMuZGVzY3JpcHRpb25UZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHsodGhpcy5kZXRhaWxUZXh0IHx8IHRoaXMuZGV0YWlsUHJlZml4IHx8IHRoaXMuZGV0YWlsU3VmZml4KSA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWxcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsUHJlZml4ID8gaHRtbGA8c3BhbiBjbGFzcz1cImNhcmQtZGV0YWlsLXByZWZpeFwiPiR7dGhpcy5kZXRhaWxQcmVmaXh9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsVGV4dCA/IGh0bWxgPHNwYW4gY2xhc3M9XCJjYXJkLWRldGFpbC1tYWluXCI+JHt0aGlzLmRldGFpbFRleHR9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsU3VmZml4ID8gaHRtbGA8c3BhbiBjbGFzcz1cImNhcmQtZGV0YWlsLXN1ZmZpeFwiPiR7dGhpcy5kZXRhaWxTdWZmaXh9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJkZXRhaWxcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJpbmxpbmUtYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cmlnZ2VyLWJhclwiICBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLl9vdmVybGF5QWN0aXZlID0gIXRoaXMuX292ZXJsYXlBY3RpdmU7IH19PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRyaWdnZXItaWNvblwiPlx1MjAzOTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy10cmF5XCIgQGNsaWNrPSR7KGUpID0+IHsgaWYoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uJykgfHwgZS50YXJnZXQudGFnTmFtZS5pbmNsdWRlcygnWUVOVlVJJykpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJheS1jYXB0aW9uXCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25zXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9wLXNoYWRvd1wiPjwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNhcmQnLCBZZW52dWlDYXJkKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR0xPQkFMIEVER0UtU1dJUEUgQ09PUkRJTkFUT1IgKE1vZHVsZSBTY29wZSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNhZmFyaSBpZ25vcmVzIENTUyBvdmVyc2Nyb2xsLWJlaGF2aW9yIGZvciBleHRyZW1lIGVkZ2Ugc3dpcGVzLiBcbi8vIFdlIGxvY2sgdGhlIE9TIGdlc3R1cmUgbmF0aXZlbHkgYXQgdGhlIGRvY3VtZW50IGxldmVsIGFuZCByZXNvbHZlIHRoZSBcbi8vIGRyb3AgdGFyZ2V0IHRvIGFsbG93IGdsb2JhbCBjYXJkIHNlbGVjdGlvbiB3aXRob3V0IHJlcXVpcmluZyBhIERPTSB3cmFwcGVyLlxubGV0IF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xubGV0IF9lZGdlU3dpcGVTdGFydFkgPSBudWxsO1xubGV0IF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xubGV0IF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludCh4LCB5LCBzZWxlY3Rvcikge1xuICAgIGxldCBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgd2hpbGUgKGVsICYmIGVsLnNoYWRvd1Jvb3QpIHtcbiAgICAgICAgY29uc3QgZGVlcGVyID0gZWwuc2hhZG93Um9vdC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgICAgICBpZiAoIWRlZXBlciB8fCBkZWVwZXIgPT09IGVsKSBicmVhaztcbiAgICAgICAgZWwgPSBkZWVwZXI7XG4gICAgfVxuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzRWxlbWVudEluc2lkZShlbCwgc2VsZWN0b3IpIHtcbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiB0cnVlO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChlKSA9PiB7XG4gICAgaWYgKGUudG91Y2hlc1swXS5jbGllbnRYIDwgMzApIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gdHJ1ZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IGUudG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRZID0gZS50b3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgIH1cbn0sIHsgcGFzc2l2ZTogdHJ1ZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgNXB4IG9mIG1vdmVtZW50IHRvIG1hdGhlbWF0aWNhbGx5IGxvY2sgdGhlIGF4aXNcbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYIC0gX2VkZ2VTd2lwZVN0YXJ0WCk7XG4gICAgICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuICAgICAgICAgICAgaWYgKGR4ID4gNSB8fCBkeSA+IDUpIHtcbiAgICAgICAgICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gZHggPiBkeSA/ICdob3Jpem9udGFsJyA6ICd2ZXJ0aWNhbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEtpbGxzIFNhZmFyaSBiYWNrLW5hdmlnYXRpb24gJiBsb2NrcyB2ZXJ0aWNhbCBkcmlmdFxuICAgICAgICB9IGVsc2UgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlOyAvLyBSZWxlYXNlcyB0aGUgbG9jayB0byBhbGxvdyBuYXRpdmUgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIH1cbiAgICB9XG59LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IGVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IGVuZFggLSBfZWRnZVN3aXBlU3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSBNYXRoLmFicyhlbmRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG5cbiAgICAgICAgLy8gT25seSBpbnRlcnZlbmUgaWYgdGhlIHN3aXBlIHN0YXJ0ZWQgb24gdGhlIGJhY2tncm91bmQgcGFkZGluZy9ndXR0ZXIuXG4gICAgICAgIGNvbnN0IHN0YXJ0ZWRPbkNhcmQgPSBpc0VsZW1lbnRJbnNpZGUoZS50YXJnZXQsICd5ZW52dWktY2FyZCcpO1xuXG4gICAgICAgIC8vIElmIGl0IHdhcyBhIGNsZWFuIHJpZ2h0d2FyZCBzd2lwZSBmcm9tIHRoZSBiYWNrZ3JvdW5kXG4gICAgICAgIGlmICghc3RhcnRlZE9uQ2FyZCAmJiBkZWx0YVggPiAzMCAmJiBkZWx0YVggPiBkZWx0YVkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludChlbmRYLCBlbmRZLCAneWVudnVpLWNhcmQnKTtcbiAgICAgICAgICAgIGlmIChjYXJkICYmICFjYXJkLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXJkLnNlbGVjdGVkID0gIWNhcmQuc2VsZWN0ZWQ7XG4gICAgICAgICAgICAgICAgY2FyZC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogY2FyZC5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG4gICAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUMvQixhQUFNLG1CQUFtQkYsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsYUFBYyxDQUFFLEtBQU0sTUFBTyxFQUM3QixnQkFBaUIsQ0FBRSxLQUFNLE1BQU8sRUFDaEMsS0FBTSxDQUFFLEtBQU0sTUFBTyxFQUNyQixZQUFhLENBQUUsS0FBTSxNQUFPLEVBQzVCLFNBQVUsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3pDLGlCQUFrQixDQUFFLEtBQU0sT0FBUSxFQUNsQyxlQUFnQixDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDL0MsWUFBYSxDQUFFLEtBQU0sUUFBUyxRQUFTLEdBQU0sVUFBVyxhQUFjLEVBQ3RFLFFBQVMsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3hDLE1BQU8sQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3RDLE1BQU8sQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLENBQzFDLEVBQ0EsT0FBTyxPQUFTRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtB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QUFJLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFBVVYsQ0FBZ0IsRUFDNURXLEVBQUssS0FBSyxJQUFJLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFBVVYsQ0FBZ0IsR0FDOURTLEVBQUssR0FBS0MsRUFBSyxLQUNmUixFQUFtQk8sRUFBS0MsRUFBSyxhQUFlLFdBRXBELENBRUlSLElBQXFCLGFBQ3JCLEVBQUUsZUFBZSxFQUNWQSxJQUFxQixhQUM1QkQsRUFBZSxHQUV2QixDQUNKLEVBQUcsQ0FBRSxRQUFTLEVBQU0sQ0FBQyxFQUVyQixTQUFTLGlCQUFpQixXQUFhLEdBQU0sQ0FDekMsR0FBSUEsR0FBZ0JGLElBQXFCLEtBQU0sQ0FDM0MsTUFBTVksRUFBTyxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQzNCQyxFQUFPLEVBQUUsZUFBZSxDQUFDLEVBQUUsUUFDM0JqQixFQUFTZ0IsRUFBT1osRUFDaEJILEVBQVMsS0FBSyxJQUFJZ0IsRUFBT1osQ0FBZ0IsRUFNL0MsR0FBSSxDQUhrQlEsRUFBZ0IsRUFBRSxPQUFRLGFBQWEsR0FHdkNiLEVBQVMsSUFBTUEsRUFBU0MsRUFBUSxDQUNsRCxNQUFNaUIsRUFBT1YsRUFBd0JRLEVBQU1DLEVBQU0sYUFBYSxFQUMxREMsR0FBUSxDQUFDQSxFQUFLLG1CQUNkQSxFQUFLLFNBQVcsQ0FBQ0EsRUFBSyxTQUN0QkEsRUFBSyxjQUFjLElBQUksWUFBWSw2QkFBOEIsQ0FDN0QsT0FBUSxDQUFFLFNBQVVBLEVBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxFQUVWLENBQ0FaLEVBQWUsR0FDZkYsRUFBbUIsSUFDdkIsQ0FDSixDQUFDIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJjdXJyZW50WCIsICJjdXJyZW50WSIsICJkaWZmWCIsICJkaWZmWSIsICJzaG91bGRQcmV2ZW50IiwgIndyYXBwZXIiLCAiZWwiLCAiaXNSaWdodFN3aXBlIiwgImlzTGVmdFN3aXBlIiwgIm1heFNjcm9sbCIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJyZWN0IiwgInRvdWNoRW5kWCIsICJ0b3VjaEVuZFkiLCAiZGVsdGFYIiwgImRlbHRhWSIsICJzbG90IiwgImVsZW1lbnRzIiwgIl9lZGdlU3dpcGVTdGFydFgiLCAiX2VkZ2VTd2lwZVN0YXJ0WSIsICJfaXNFZGdlU3dpcGUiLCAiX2dsb2JhbFN3aXBlQXhpcyIsICJnZXREZWVwQ2xvc2VzdEZyb21Qb2ludCIsICJ4IiwgInkiLCAic2VsZWN0b3IiLCAiZGVlcGVyIiwgImlzRWxlbWVudEluc2lkZSIsICJkeCIsICJkeSIsICJlbmRYIiwgImVuZFkiLCAiY2FyZCJdCn0K
