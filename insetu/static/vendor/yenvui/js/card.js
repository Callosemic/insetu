import{LitElement as g,html as s,css as m}from"lit";export class YenvuiCard extends g{static properties={titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=m`
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsUHJlZml4OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxTdWZmaXg6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaWNvbjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaW50ZW50Q29sb3I6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHNlbGVjdGVkOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgZGlzYWJsZVNlbGVjdGlvbjogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIF9vdmVybGF5QWN0aXZlOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgX2hhc0FjdGlvbnM6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSwgYXR0cmlidXRlOiAnaGFzLWFjdGlvbnMnIH0sXG4gICAgICAgIGNvbXBhY3Q6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBmbHVzaDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgZGlzcGxheTogYmxvY2s7IG1hcmdpbi1ib3R0b206IHZhcigtLWNhcmQtbWFyZ2luLWJvdHRvbSwgMTJweCk7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdG91Y2gtYWN0aW9uOiBwYW4teCBwYW4teTsgfVxuICAgICAgICAuc2VsZWN0aW9uLWd1dHRlciB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICBsZWZ0OiAwO1xuICAgICAgICAgICAgdG9wOiAwO1xuICAgICAgICAgICAgYm90dG9tOiAwO1xuICAgICAgICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICAgICAgICB6LWluZGV4OiA1O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teTtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIHRvdWNoLWFjdGlvbjogcGFuLXggcGFuLXk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogdmFyKC0tY2FyZC1ib3JkZXItdG9wLCAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KSk7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMTBweDtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogdmFyKC0tY2FyZC1ib3gtc2hhZG93LCAwIDRweCAxMnB4IHJnYmEoMCwwLDAsMC4xKSk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4ycywgYm94LXNoYWRvdyAwLjJzLCBib3JkZXItbGVmdC13aWR0aCAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSksIHBhZGRpbmctbGVmdCAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRvcC1zaGFkb3cge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgdG9wOiAwO1xuICAgICAgICAgICAgbGVmdDogMDtcbiAgICAgICAgICAgIHJpZ2h0OiAwO1xuICAgICAgICAgICAgaGVpZ2h0OiA2cHg7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkLXRvcC1zaGFkb3csIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgei1pbmRleDogMjA7XG4gICAgICAgICAgICBib3JkZXItdG9wLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtbGVmdC1yYWRpdXMsIDApO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIDApO1xuICAgICAgICB9XG4gICAgICAgIEBtZWRpYSAoaG92ZXI6IGhvdmVyKSB7XG4gICAgICAgICAgICAuc2VsZWN0aW9uLWd1dHRlcjpob3ZlciArIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4O1xuICAgICAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMHB4O1xuICAgICAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmNhcmQtd3JhcHBlcjpob3ZlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkge1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIG91dGxpbmU6IDFweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICBvdXRsaW5lLW9mZnNldDogLTFweDtcbiAgICAgICAgfVxuICAgICAgICAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgbWluLXdpZHRoOiAwO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE1cHggOHB4IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMDVyZW07XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogOHB4O1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWRlc2Mge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDhweCAxNXB4O1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjlyZW07XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgICAgICBkaXNwbGF5OiAtd2Via2l0LWJveDtcbiAgICAgICAgICAgIC13ZWJraXQtbGluZS1jbGFtcDogMjtcbiAgICAgICAgICAgIC13ZWJraXQtYm94LW9yaWVudDogdmVydGljYWw7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDZweCAxNXB4O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoKikge1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWRldGFpbCB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDE1cHggMTJweCAxNXB4O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43NXJlbTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgLmNhcmQtZGV0YWlsLW1haW4geyBkaXNwbGF5OiBub25lOyB9XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIHdpZHRoOiAyMnB4O1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpKTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGZpbHRlciAwLjJzO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAxLjJyZW07XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNXB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA1cHgpKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbaGFzLWFjdGlvbnNdKSAudHJpZ2dlci1iYXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1iYXI6aG92ZXIge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMik7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItaWNvbiB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlO1xuICAgICAgICAgICAgbWFyZ2luLXRvcDogLTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAudHJpZ2dlci1pY29uIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKDE4MGRlZyk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICBsZWZ0OiAtMXB4O1xuICAgICAgICAgICAgcmlnaHQ6IDIxcHg7XG4gICAgICAgICAgICB0b3A6IC0xcHg7XG4gICAgICAgICAgICBtaW4taGVpZ2h0OiBjYWxjKDEwMCUgKyAycHgpO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCkgNzUlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoNHB4KTtcbiAgICAgICAgICAgIC13ZWJraXQtYmFja2Ryb3AtZmlsdGVyOiBibHVyKDRweCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIC8qIFBhc3MgQ1NTIHZhcmlhYmxlcyB0byBwZW5ldHJhdGUgc2xvdHRlZCBhc3luYyBidXR0b25zICovXG4gICAgICAgICAgICAtLWJ0bi1wYWRkaW5nOiA4cHggMTZweDtcbiAgICAgICAgICAgIC0tYnRuLWZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDZweCAxMHB4IDBweCAxMHB4O1xuICAgICAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cyBlYXNlLCB0cmFuc2Zvcm0gMC4zcyBjdWJpYy1iZXppZXIoMC4xNzUsIDAuODg1LCAwLjMyLCAxLjI3NSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAwIDAgNnB4O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjk4KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC40KTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IDA7XG4gICAgICAgICAgICBvdmVyZmxvdy14OiBhdXRvO1xuICAgICAgICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xuICAgICAgICAgICAgLXdlYmtpdC1vdmVyZmxvdy1zY3JvbGxpbmc6IHRvdWNoO1xuICAgICAgICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyOjpiZWZvcmUge1xuICAgICAgICAgICAgY29udGVudDogJyc7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyOjotd2Via2l0LXNjcm9sbGJhciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogU2hvdyBzbGltIHNjcm9sbGJhcnMgZm9yIHVzZXJzIHdpdGggYSBtb3VzZSAqL1xuICAgICAgICBAbWVkaWEgKHBvaW50ZXI6IGZpbmUpIHtcbiAgICAgICAgICAgIC5hY3Rpb25zLXdyYXBwZXIge1xuICAgICAgICAgICAgICAgIHNjcm9sbGJhci13aWR0aDogdGhpbjtcbiAgICAgICAgICAgICAgICBzY3JvbGxiYXItY29sb3I6IHZhcigtLWJvcmRlciwgIzQ0NCkgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5hY3Rpb25zLXdyYXBwZXI6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IDZweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5hY3Rpb25zLXdyYXBwZXI6Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iIHtcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XG4gICAgICAgIH1cbiAgICAgICAgLnRyYXktY2FwdGlvbiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICB0b3A6IDRweDtcbiAgICAgICAgICAgIGxlZnQ6IDEwcHg7XG4gICAgICAgICAgICByaWdodDogMTBweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC42NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC41cHg7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgI2ZmZmZmZiA3NSUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC4xNSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBub25lO1xuICAgICAgICAgICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMDAwMDAwO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogNHB4IDRweCAwICMxNGI4YTY7XG4gICAgICAgIH1cbiAgICAgICAgLyogVW5zdHlsZWQgc2xvdHMgZm9yIGhvc3QtaW5qZWN0ZWQgYnV0dG9ucyAqL1xuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgcGFkZGluZzogdmFyKC0tYnRuLXBhZGRpbmcpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogdmFyKC0tYnRuLWZvbnQtc2l6ZSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uOmhvdmVyKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1ob3Zlcik7XG4gICAgICAgIH1cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjOGI1Y2Y2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBvcGFjaXR5OiAxICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiAtLS0gQ29tcGFjdCBNb2RlIFZhcmlhbnQgLS0tICovXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkge1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDEycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45NXJlbTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWRlc2MsXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMCAwIDEwcHg7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lciA9IHRoaXMuX2hhbmRsZURvY3VtZW50Q2xpY2suYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbC5zb3VyY2UgIT09IHRoaXMgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29udGFpbnMoZS5yZWxhdGVkVGFyZ2V0KSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICAvLyBOYXRpdmUgRWRnZS1Td2lwZSBOYXZpZ2F0aW9uIERlZmVhdGVyXG4gICAgICAgIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90b3VjaFN0YXJ0WCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZYID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFggLSBjdXJyZW50WCk7XG4gICAgICAgICAgICBjb25zdCBkaWZmWSA9IE1hdGguYWJzKHRoaXMuX3RvdWNoU3RhcnRZIC0gY3VycmVudFkpO1xuXG4gICAgICAgICAgICAvLyBMb2NrIHRoZSBnZXN0dXJlIGF4aXMgdXBvbiBpbml0aWFsIDVweCBvZiBtb3ZlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGlmZlggPiA1IHx8IGRpZmZZID4gNSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gZGlmZlggPiBkaWZmWTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBJZiB0aGUgZ2VzdHVyZSBpcyBob3Jpem9udGFsLCBmb3JjZWZ1bGx5IGludGVyY2VwdCB0aGUgdG91Y2ggZXZlbnRcbiAgICAgICAgICAgIC8vIHRvIHByZXZlbnQgdGhlIG1vYmlsZSBicm93c2VyIGZyb20gdHJpZ2dlcmluZyBcIlN3aXBlIHRvIEdvIEJhY2tcIlxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwpIHtcbiAgICAgICAgICAgICAgICBsZXQgc2hvdWxkUHJldmVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgd3JhcHBlciA9IHBhdGguZmluZChlbCA9PiBlbC5jbGFzc0xpc3QgJiYgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdhY3Rpb25zLXdyYXBwZXInKSk7XG5cbiAgICAgICAgICAgICAgICBpZiAod3JhcHBlcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JpZ2h0U3dpcGUgPSBjdXJyZW50WCA+IHRoaXMuX3RvdWNoU3RhcnRYO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0xlZnRTd2lwZSA9IGN1cnJlbnRYIDwgdGhpcy5fdG91Y2hTdGFydFg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1heFNjcm9sbCA9IE1hdGgubWF4KDAsIHdyYXBwZXIuc2Nyb2xsV2lkdGggLSB3cmFwcGVyLmNsaWVudFdpZHRoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSaWdodFN3aXBlICYmIHdyYXBwZXIuc2Nyb2xsTGVmdCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3VsZFByZXZlbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc0xlZnRTd2lwZSAmJiB3cmFwcGVyLnNjcm9sbExlZnQgPCBtYXhTY3JvbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3VsZFByZXZlbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzaG91bGRQcmV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5fdG91Y2hNb3ZlTGlzdGVuZXIsIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG5cbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtdGhlbWUnXSB9KTtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5fdG91Y2hNb3ZlTGlzdGVuZXIpO1xuICAgICAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2ZvY3Vzb3V0JywgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHRoaXMuX292ZXJsYXlMaXN0ZW5lcik7XG4gICAgICAgIGlmICh0aGlzLl90aGVtZU9ic2VydmVyKSB0aGlzLl90aGVtZU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gICAgdXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcykge1xuICAgICAgICBzdXBlci51cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnX292ZXJsYXlBY3RpdmUnKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB7XG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkZXRhaWw6IHsgc291cmNlOiB0aGlzIH1cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNlbGYtSGVhbGluZyBXcmFwcGVyOiBSZXNldCB0cmFuc2llbnQgb3ZlcmxheSBzdGF0ZSBpZiBMaXQgcmVjeWNsZXMgdGhlIERPTSBub2RlIGZvciBhIG5ldyBpdGVtXG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ2VudGl0eURhdGEnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ2ZpbGVuYW1lJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCd0aXRsZVRleHQnKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlRG9jdW1lbnRDbGljayhlKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgICAgICBpZiAoIXBhdGguaW5jbHVkZXModGhpcykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9oYW5kbGVUb3VjaFN0YXJ0KGUpIHtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgdGhpcy5fY2FyZFdpZHRoID0gcmVjdC53aWR0aDtcbiAgICAgICAgdGhpcy5fbG9jYWxTdGFydFggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHJlY3QubGVmdDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG5cbiAgICAgICAgY29uc3Qgd3JhcHBlciA9IGUuY29tcG9zZWRQYXRoKCkuZmluZChlbCA9PiBlbC5jbGFzc0xpc3QgJiYgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdhY3Rpb25zLXdyYXBwZXInKSk7XG4gICAgICAgIHRoaXMuX2FjdGlvbnNTY3JvbGxMZWZ0ID0gd3JhcHBlciA/IHdyYXBwZXIuc2Nyb2xsTGVmdCA6IG51bGw7XG4gICAgfVxuXG4gICAgX3RvZ2dsZVNlbGVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9ICF0aGlzLnNlbGVjdGVkO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2FyZC1zZWxlY3QtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogdGhpcy5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoRW5kKGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRvdWNoRW5kWCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCBkZWx0YVggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHRvdWNoRW5kWDtcbiAgICAgICAgY29uc3QgZGVsdGFZID0gdGhpcy5fdG91Y2hTdGFydFkgLSB0b3VjaEVuZFk7XG5cbiAgICAgICAgLy8gRW5zdXJlIGhvcml6b250YWwgc3dpcGUgaXMgZG9taW5hbnQgdG8gcHJldmVudCBhY2NpZGVudGFsIHRyaWdnZXJzIGR1cmluZyB2ZXJ0aWNhbCBzY3JvbGxpbmdcbiAgICAgICAgaWYgKE1hdGguYWJzKGRlbHRhWCkgPiBNYXRoLmFicyhkZWx0YVkpICYmIE1hdGguYWJzKGRlbHRhWCkgPiAzMCkge1xuICAgICAgICAgICAgY29uc3QgaXNMZWZ0U3dpcGUgPSBkZWx0YVggPiAzMDsgICAvLyBSaWdodC10by1MZWZ0XG4gICAgICAgICAgICBjb25zdCBpc1JpZ2h0U3dpcGUgPSBkZWx0YVggPCAtMzA7IC8vIExlZnQtdG8tUmlnaHRcbiAgICAgICAgICAgIC8vIFdpZGVuIHRoZSBoaXQgdGFyZ2V0IHRvIDI1JSBmb3IgYmV0dGVyIGVyZ29ub21pY3MsIGFuZCBndWFyYW50ZWUgYXQgbGVhc3QgNzBweFxuICAgICAgICAgICAgY29uc3QgaXNMZWZ0U2lkZSA9IHRoaXMuX2xvY2FsU3RhcnRYIDwgTWF0aC5tYXgoKHRoaXMuX2NhcmRXaWR0aCAqIDAuMjUpLCA3MCk7XG5cbiAgICAgICAgICAgIGlmIChpc0xlZnRTaWRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmlnaHRTd2lwZSAmJiAhdGhpcy5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFzQWN0aW9ucyA9IHRoaXMuX2hhc0FjdGlvbnMgfHwgISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICAgICAgICAgIGlmIChoYXNBY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0xlZnRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNSaWdodFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgIT09IG51bGwgJiYgdGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlciBpcyBzY3JvbGxpbmcgdGhlIGJ1dHRvbnMgYmFjayB0byB0aGUgc3RhcnQ7IGRvbid0IGNsb3NlIHRoZSBkcmF3ZXIgeWV0XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRYID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcbiAgICB9XG4gICAgZmlyc3RVcGRhdGVkKCkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG5cbiAgICBfY2hlY2tBY3Rpb25zKCkge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ3Nsb3RbbmFtZT1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgaWYgKHNsb3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gc2xvdC5hc3NpZ25lZEVsZW1lbnRzKHsgZmxhdHRlbjogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSBlbGVtZW50cy5sZW5ndGggPiAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9ICEhdGhpcy5xdWVyeVNlbGVjdG9yKCdbc2xvdD1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVTbG90Q2hhbmdlKGUpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICAkeyF0aGlzLmRpc2FibGVTZWxlY3Rpb24gPyBodG1sYDxkaXYgY2xhc3M9XCJzZWxlY3Rpb24tZ3V0dGVyXCIgdGl0bGU9XCJTZWxlY3QgSXRlbVwiIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpOyB9fT48L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC13cmFwcGVyXCIgc3R5bGU9XCItLWNhcmQtaW50ZW50OiAke3RoaXMuaW50ZW50Q29sb3IgfHwgJ3ZhcigtLWludGVudC1uZXV0cmFsKSd9XCJcbiAgICAgICAgICAgICAgICBAbW91c2VsZWF2ZT0keygpID0+IHsgaWYgKHdpbmRvdy5tYXRjaE1lZGlhKCcoaG92ZXI6IGhvdmVyKScpLm1hdGNoZXMpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX1cbiAgICAgICAgICAgICAgICBAdG91Y2hzdGFydD0ke3RoaXMuX2hhbmRsZVRvdWNoU3RhcnR9XG4gICAgICAgICAgICAgICAgQHRvdWNoZW5kPSR7dGhpcy5faGFuZGxlVG91Y2hFbmR9PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWhlYWRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtdGl0bGVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuaWNvbiA/IGh0bWxgPHNwYW4+JHt0aGlzLmljb259PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMudGl0bGVUZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGVzY3JpcHRpb25UZXh0ID8gaHRtbGA8ZGl2IGNsYXNzPVwiY2FyZC1kZXNjXCI+JHt0aGlzLmRlc2NyaXB0aW9uVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWJvZHlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7KHRoaXMuZGV0YWlsVGV4dCB8fCB0aGlzLmRldGFpbFByZWZpeCB8fCB0aGlzLmRldGFpbFN1ZmZpeCkgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtZGV0YWlsXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFByZWZpeCA/IGh0bWxgPHNwYW4gY2xhc3M9XCJjYXJkLWRldGFpbC1wcmVmaXhcIj4ke3RoaXMuZGV0YWlsUHJlZml4fTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFRleHQgPyBodG1sYDxzcGFuIGNsYXNzPVwiY2FyZC1kZXRhaWwtbWFpblwiPiR7dGhpcy5kZXRhaWxUZXh0fTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFN1ZmZpeCA/IGh0bWxgPHNwYW4gY2xhc3M9XCJjYXJkLWRldGFpbC1zdWZmaXhcIj4ke3RoaXMuZGV0YWlsU3VmZml4fTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiZGV0YWlsXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiaW5saW5lLWFjdGlvbnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHJpZ2dlci1iYXJcIiAgXG4gICAgICAgICAgICAgICAgICAgIEBwb2ludGVyZW50ZXI9JHsoZSkgPT4geyBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IHRydWU7IH19XG4gICAgICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IGUucHJldmVudERlZmF1bHQoKTsgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9ICF0aGlzLl9vdmVybGF5QWN0aXZlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmlnZ2VyLWljb25cIj5cdTIwMzk8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtdHJheVwiIEBjbGljaz0keyhlKSA9PiB7IGlmKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IGUudGFyZ2V0LmNsb3Nlc3QoJ2J1dHRvbicpIHx8IGUudGFyZ2V0LnRhZ05hbWUuaW5jbHVkZXMoJ1lFTlZVSScpKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7IH19PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRyYXktY2FwdGlvblwiPiR7dGhpcy50aXRsZVRleHR9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy13cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYWN0aW9uc1wiIEBzbG90Y2hhbmdlPSR7dGhpcy5faGFuZGxlU2xvdENoYW5nZX0+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRvcC1zaGFkb3dcIj48L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1jYXJkJywgWWVudnVpQ2FyZCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEdMT0JBTCBFREdFLVNXSVBFIENPT1JESU5BVE9SIChNb2R1bGUgU2NvcGUpXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTYWZhcmkgaWdub3JlcyBDU1Mgb3ZlcnNjcm9sbC1iZWhhdmlvciBmb3IgZXh0cmVtZSBlZGdlIHN3aXBlcy4gXG4vLyBXZSBsb2NrIHRoZSBPUyBnZXN0dXJlIG5hdGl2ZWx5IGF0IHRoZSBkb2N1bWVudCBsZXZlbCBhbmQgcmVzb2x2ZSB0aGUgXG4vLyBkcm9wIHRhcmdldCB0byBhbGxvdyBnbG9iYWwgY2FyZCBzZWxlY3Rpb24gd2l0aG91dCByZXF1aXJpbmcgYSBET00gd3JhcHBlci5cbmxldCBfZWRnZVN3aXBlU3RhcnRYID0gbnVsbDtcbmxldCBfZWRnZVN3aXBlU3RhcnRZID0gbnVsbDtcbmxldCBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbmxldCBfZ2xvYmFsU3dpcGVBeGlzID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQoeCwgeSwgc2VsZWN0b3IpIHtcbiAgICBsZXQgZWwgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgIHdoaWxlIChlbCAmJiBlbC5zaGFkb3dSb290KSB7XG4gICAgICAgIGNvbnN0IGRlZXBlciA9IGVsLnNoYWRvd1Jvb3QuZWxlbWVudEZyb21Qb2ludCh4LCB5KTtcbiAgICAgICAgaWYgKCFkZWVwZXIgfHwgZGVlcGVyID09PSBlbCkgYnJlYWs7XG4gICAgICAgIGVsID0gZGVlcGVyO1xuICAgIH1cbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiBlbC5jbG9zZXN0KHNlbGVjdG9yKTtcbiAgICAgICAgZWwgPSBlbC5nZXRSb290Tm9kZSgpLmhvc3Q7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0VsZW1lbnRJbnNpZGUoZWwsIHNlbGVjdG9yKSB7XG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICAgIGlmIChlbC5jbG9zZXN0ICYmIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgZWwgPSBlbC5nZXRSb290Tm9kZSgpLmhvc3Q7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCAoZSkgPT4ge1xuICAgIGlmIChlLnRvdWNoZXNbMF0uY2xpZW50WCA8IDMwKSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IHRydWU7XG4gICAgICAgIF9lZGdlU3dpcGVTdGFydFggPSBlLnRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WSA9IGUudG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICB9XG59LCB7IHBhc3NpdmU6IHRydWUgfSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIDVweCBvZiBtb3ZlbWVudCB0byBtYXRoZW1hdGljYWxseSBsb2NrIHRoZSBheGlzXG4gICAgICAgIGlmIChfZ2xvYmFsU3dpcGVBeGlzID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBkeCA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WCAtIF9lZGdlU3dpcGVTdGFydFgpO1xuICAgICAgICAgICAgY29uc3QgZHkgPSBNYXRoLmFicyhlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFkgLSBfZWRnZVN3aXBlU3RhcnRZKTtcbiAgICAgICAgICAgIGlmIChkeCA+IDUgfHwgZHkgPiA1KSB7XG4gICAgICAgICAgICAgICAgX2dsb2JhbFN3aXBlQXhpcyA9IGR4ID4gZHkgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICdob3Jpem9udGFsJykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBLaWxscyBTYWZhcmkgYmFjay1uYXZpZ2F0aW9uICYgbG9ja3MgdmVydGljYWwgZHJpZnRcbiAgICAgICAgfSBlbHNlIGlmIChfZ2xvYmFsU3dpcGVBeGlzID09PSAndmVydGljYWwnKSB7XG4gICAgICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTsgLy8gUmVsZWFzZXMgdGhlIGxvY2sgdG8gYWxsb3cgbmF0aXZlIHZlcnRpY2FsIHNjcm9sbGluZ1xuICAgICAgICB9XG4gICAgfVxufSwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCAoZSkgPT4ge1xuICAgIGlmIChfaXNFZGdlU3dpcGUgJiYgX2VkZ2VTd2lwZVN0YXJ0WCAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBlbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBjb25zdCBlbmRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCBkZWx0YVggPSBlbmRYIC0gX2VkZ2VTd2lwZVN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFZID0gTWF0aC5hYnMoZW5kWSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuXG4gICAgICAgIC8vIE9ubHkgaW50ZXJ2ZW5lIGlmIHRoZSBzd2lwZSBzdGFydGVkIG9uIHRoZSBiYWNrZ3JvdW5kIHBhZGRpbmcvZ3V0dGVyLlxuICAgICAgICBjb25zdCBzdGFydGVkT25DYXJkID0gaXNFbGVtZW50SW5zaWRlKGUudGFyZ2V0LCAneWVudnVpLWNhcmQnKTtcblxuICAgICAgICAvLyBJZiBpdCB3YXMgYSBjbGVhbiByaWdodHdhcmQgc3dpcGUgZnJvbSB0aGUgYmFja2dyb3VuZFxuICAgICAgICBpZiAoIXN0YXJ0ZWRPbkNhcmQgJiYgZGVsdGFYID4gMzAgJiYgZGVsdGFYID4gZGVsdGFZKSB7XG4gICAgICAgICAgICBjb25zdCBjYXJkID0gZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQoZW5kWCwgZW5kWSwgJ3llbnZ1aS1jYXJkJyk7XG4gICAgICAgICAgICBpZiAoY2FyZCAmJiAhY2FyZC5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FyZC5zZWxlY3RlZCA9ICFjYXJkLnNlbGVjdGVkO1xuICAgICAgICAgICAgICAgIGNhcmQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLXNlbGVjdC10b2dnbGVkJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IGNhcmQuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgX2lzRWRnZVN3aXBlID0gZmFsc2U7XG4gICAgICAgIF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xuICAgIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFDL0IsYUFBTSxtQkFBbUJGLENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsZ0JBQWlCLENBQUUsS0FBTSxNQUFPLEVBQ2hDLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BMFVoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssZUFB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RSxRQUMzQkMsRUFBTyxFQUFFLGVBQWUsQ0FBQyxFQUFFLFFBQzNCakIsRUFBU2dCLEVBQU9aLEVBQ2hCSCxFQUFTLEtBQUssSUFBSWdCLEVBQU9aLENBQWdCLEVBTS9DLEdBQUksQ0FIa0JRLEVBQWdCLEVBQUUsT0FBUSxhQUFhLEdBR3ZDYixFQUFTLElBQU1BLEVBQVNDLEVBQVEsQ0FDbEQsTUFBTWlCLEVBQU9WLEVBQXdCUSxFQUFNQyxFQUFNLGFBQWEsRUFDMURDLEdBQVEsQ0FBQ0EsRUFBSyxtQkFDZEEsRUFBSyxTQUFXLENBQUNBLEVBQUssU0FDdEJBLEVBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxTQUFVQSxFQUFLLFFBQVMsRUFDbEMsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsRUFFVixDQUNBWixFQUFlLEdBQ2ZGLEVBQW1CLElBQ3ZCLENBQ0osQ0FBQyIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImUiLCAiY3VycmVudFgiLCAiY3VycmVudFkiLCAiZGlmZlgiLCAiZGlmZlkiLCAic2hvdWxkUHJldmVudCIsICJ3cmFwcGVyIiwgImVsIiwgImlzUmlnaHRTd2lwZSIsICJpc0xlZnRTd2lwZSIsICJtYXhTY3JvbGwiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAicmVjdCIsICJ0b3VjaEVuZFgiLCAidG91Y2hFbmRZIiwgImRlbHRhWCIsICJkZWx0YVkiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
