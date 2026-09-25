import{html as s,css as g}from"lit";import{YenvuiBase as x}from"./yenvui-base.js";export class YenvuiCard extends x{static properties={titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},stale:{type:Boolean,reflect:!0}};static styles=g`
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const o=t.changedTouches[0].clientX,i=t.changedTouches[0].clientY,r=Math.abs(this._touchStartX-o),d=Math.abs(this._touchStartY-i);if(this._isSwipingHorizontal===null&&(r>5||d>5)&&(this._isSwipingHorizontal=r>d),this._isSwipingHorizontal){let a=!0;const n=t.composedPath().find(p=>p.classList&&p.classList.contains("actions-wrapper"));if(n){const p=o>this._touchStartX,b=o<this._touchStartX,v=Math.max(0,n.scrollWidth-n.clientWidth);(p&&n.scrollLeft>0||b&&n.scrollLeft<v)&&(a=!1)}a&&t.preventDefault()}},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1})}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener)}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const o=this.getBoundingClientRect();this._cardWidth=o.width,this._localStartX=this._touchStartX-o.left,this._isSwipingHorizontal=null;const i=t.composedPath().find(r=>r.classList&&r.classList.contains("actions-wrapper"));this._actionsScrollLeft=i?i.scrollLeft:null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const o=t.changedTouches[0].clientX,i=t.changedTouches[0].clientY,r=this._touchStartX-o,d=this._touchStartY-i;if(Math.abs(r)>Math.abs(d)&&Math.abs(r)>30){const a=r>30,u=r<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?u&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(a?this._overlayActive=!0:u&&(this._actionsScrollLeft!==null&&this._actionsScrollLeft>0||(this._overlayActive=!1)))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const o=t.assignedElements({flatten:!0});this._hasActions=o.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return s`
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
        `}}customElements.define("yenvui-card",YenvuiCard);let c=null,f=null,l=!1,h=null;function m(e,t,o){let i=document.elementFromPoint(e,t);for(;i&&i.shadowRoot;){const r=i.shadowRoot.elementFromPoint(e,t);if(!r||r===i)break;i=r}for(;i;){if(i.closest&&i.closest(o))return i.closest(o);i=i.getRootNode().host}return null}function w(e,t){for(;e;){if(e.closest&&e.closest(t))return!0;e=e.getRootNode().host}return!1}document.addEventListener("touchstart",e=>{e.touches[0].clientX<30?(l=!0,c=e.touches[0].clientX,f=e.touches[0].clientY,h=null):l=!1},{passive:!0}),document.addEventListener("touchmove",e=>{if(l&&c!==null){if(h===null){const t=Math.abs(e.changedTouches[0].clientX-c),o=Math.abs(e.changedTouches[0].clientY-f);(t>5||o>5)&&(h=t>o?"horizontal":"vertical")}h==="horizontal"?e.preventDefault():h==="vertical"&&(l=!1)}},{passive:!1}),document.addEventListener("touchend",e=>{if(l&&c!==null){const t=e.changedTouches[0].clientX,o=e.changedTouches[0].clientY,i=t-c,r=Math.abs(o-f);if(!w(e.target,"yenvui-card")&&i>30&&i>r){const a=m(t,o,"yenvui-card");a&&!a.disableSelection&&(a.selected=!a.selected,a.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:a.selected},bubbles:!0,composed:!0})))}l=!1,c=null}});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNhcmQgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGl0bGVUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxQcmVmaXg6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGRldGFpbFN1ZmZpeDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgc3RhbGU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGJsb2NrOyBtYXJnaW4tYm90dG9tOiB2YXIoLS1jYXJkLW1hcmdpbi1ib3R0b20sIDEycHgpOyBwb3NpdGlvbjogcmVsYXRpdmU7IHRvdWNoLWFjdGlvbjogcGFuLXggcGFuLXk7IH1cbiAgICAgICAgLnNlbGVjdGlvbi1ndXR0ZXIge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogMDtcbiAgICAgICAgICAgIHRvcDogMDtcbiAgICAgICAgICAgIGJvdHRvbTogMDtcbiAgICAgICAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgICAgICAgei1pbmRleDogNTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHRvdWNoLWFjdGlvbjogcGFuLXk7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IHZhcigtLWNhcmQtYm9yZGVyLXRvcCwgMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCkpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDEwcHg7XG4gICAgICAgICAgICBib3JkZXItdG9wLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtbGVmdC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNnB4KSk7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA2cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDZweCkpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNhcmQtYm94LXNoYWRvdywgMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMSkpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYm9yZGVyLWNvbG9yIDAuMnMsIGJveC1zaGFkb3cgMC4ycywgYm9yZGVyLWxlZnQtd2lkdGggMC4zcyBjdWJpYy1iZXppZXIoMC40LCAwLCAwLjIsIDEpLCBwYWRkaW5nLWxlZnQgMC4zcyBjdWJpYy1iZXppZXIoMC40LCAwLCAwLjIsIDEpO1xuICAgICAgICB9XG4gICAgICAgIC50b3Atc2hhZG93IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIHRvcDogMDtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICByaWdodDogMDtcbiAgICAgICAgICAgIGhlaWdodDogNnB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FyZC10b3Atc2hhZG93LCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIHotaW5kZXg6IDIwO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCAwKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCAwKTtcbiAgICAgICAgfVxuICAgICAgICBAbWVkaWEgKGhvdmVyOiBob3Zlcikge1xuICAgICAgICAgICAgLnNlbGVjdGlvbi1ndXR0ZXI6aG92ZXIgKyAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweDtcbiAgICAgICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5jYXJkLXdyYXBwZXI6aG92ZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIHtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3NlbGVjdGVkXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweDtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMHB4O1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICBvdXRsaW5lOiAxcHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgb3V0bGluZS1vZmZzZXQ6IC0xcHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3N0YWxlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjY1O1xuICAgICAgICAgICAgZmlsdGVyOiBncmF5c2NhbGUoMC4zKTtcbiAgICAgICAgICAgIGJvcmRlci1zdHlsZTogZGFzaGVkO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2UsIGZpbHRlciAwLjNzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICAgICAgcGFkZGluZzogMTJweCAxNXB4IDhweCAxNXB4O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgZm9udC1zaXplOiAxLjA1cmVtO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXNjIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCA4cHggMTVweDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XG4gICAgICAgICAgICAtd2Via2l0LWxpbmUtY2xhbXA6IDI7XG4gICAgICAgICAgICAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTVweCA2cHggMTVweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZmx1c2hdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKCopIHtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDEycHggMTVweDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8sIG1vbm9zcGFjZSk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNzVyZW07XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgICB9XG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNDgwcHgpIHtcbiAgICAgICAgICAgIC5jYXJkLWRldGFpbC1tYWluIHsgZGlzcGxheTogbm9uZTsgfVxuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICB3aWR0aDogMjJweDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKSk7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBmaWx0ZXIgMC4ycztcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDVweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgNXB4KSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hhcy1hY3Rpb25zXSkgLnRyaWdnZXItYmFyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIH1cbiAgICAgICAgLnRyaWdnZXItYmFyOmhvdmVyIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjIpO1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZTtcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IC0ycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLnRyaWdnZXItaWNvbiB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHJvdGF0ZSgxODBkZWcpO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogLTFweDtcbiAgICAgICAgICAgIHJpZ2h0OiAyMXB4O1xuICAgICAgICAgICAgdG9wOiAtMXB4O1xuICAgICAgICAgICAgbWluLWhlaWdodDogY2FsYygxMDAlICsgMnB4KTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpIDc1JSwgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDRweCk7XG4gICAgICAgICAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjogYmx1cig0cHgpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICAvKiBQYXNzIENTUyB2YXJpYWJsZXMgdG8gcGVuZXRyYXRlIHNsb3R0ZWQgYXN5bmMgYnV0dG9ucyAqL1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogOHB4IDE2cHg7XG4gICAgICAgICAgICAtLWJ0bi1mb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTBweCAwcHggMTBweDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXMgZWFzZSwgdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuMTc1LCAwLjg4NSwgMC4zMiwgMS4yNzUpO1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHggMCAwIDZweDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNCk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgICAgICAgb3ZlcmZsb3cteDogYXV0bztcbiAgICAgICAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbiAgICAgICAgICAgIC13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOiB0b3VjaDtcbiAgICAgICAgICAgIHBhZGRpbmctYm90dG9tOiA4cHg7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6YmVmb3JlIHtcbiAgICAgICAgICAgIGNvbnRlbnQ6ICcnO1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFNob3cgc2xpbSBzY3JvbGxiYXJzIGZvciB1c2VycyB3aXRoIGEgbW91c2UgKi9cbiAgICAgICAgQG1lZGlhIChwb2ludGVyOiBmaW5lKSB7XG4gICAgICAgICAgICAuYWN0aW9ucy13cmFwcGVyIHtcbiAgICAgICAgICAgICAgICBzY3JvbGxiYXItd2lkdGg6IHRoaW47XG4gICAgICAgICAgICAgICAgc2Nyb2xsYmFyLWNvbG9yOiB2YXIoLS1ib3JkZXIsICM0NDQpIHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgICAgIHBhZGRpbmctYm90dG9tOiA4cHg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuYWN0aW9ucy13cmFwcGVyOjotd2Via2l0LXNjcm9sbGJhciB7XG4gICAgICAgICAgICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiA2cHg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuYWN0aW9ucy13cmFwcGVyOjotd2Via2l0LXNjcm9sbGJhci10aHVtYiB7XG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBvcGFjaXR5OiAxO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHNjYWxlKDEpO1xuICAgICAgICB9XG4gICAgICAgIC50cmF5LWNhcHRpb24ge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgdG9wOiA0cHg7XG4gICAgICAgICAgICBsZWZ0OiAxMHB4O1xuICAgICAgICAgICAgcmlnaHQ6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xuICAgICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuNXB4O1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsICNmZmZmZmYgNzUlLCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogbm9uZTtcbiAgICAgICAgICAgIC13ZWJraXQtYmFja2Ryb3AtZmlsdGVyOiBub25lO1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMDtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDRweCA0cHggMCAjMTRiOGE2O1xuICAgICAgICB9XG4gICAgICAgIC8qIFVuc3R5bGVkIHNsb3RzIGZvciBob3N0LWluamVjdGVkIGJ1dHRvbnMgKi9cbiAgICAgICAgOjpzbG90dGVkKGJ1dHRvbikge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgICAgIHBhZGRpbmc6IHZhcigtLWJ0bi1wYWRkaW5nKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IHZhcigtLWJ0bi1mb250LXNpemUpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKGJ1dHRvbjpob3Zlcikge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctaG92ZXIpO1xuICAgICAgICB9XG4gICAgICAgIC8qIEUtSW5rIEhpZ2ggQ29udHJhc3QgT3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzhiNWNmNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogNHB4IDRweCAwICMxNGI4YTYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3NlbGVjdGVkXVtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLWRlc2MsXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLWRldGFpbCB7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgb3BhY2l0eTogMSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLyogLS0tIENvbXBhY3QgTW9kZSBWYXJpYW50IC0tLSAqL1xuICAgICAgICA6aG9zdChbY29tcGFjdF0pIHtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIHBhZGRpbmc6IDZweCAxMnB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOTVyZW07XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWRldGFpbCB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDAgMCAxMHB4O1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICAgIH1cbiAgICBgO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIgPSB0aGlzLl9oYW5kbGVEb2N1bWVudENsaWNrLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kZXRhaWwuc291cmNlICE9PSB0aGlzICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbnRhaW5zKGUucmVsYXRlZFRhcmdldCkgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9kb2NDbGlja0xpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgLy8gTmF0aXZlIEVkZ2UtU3dpcGUgTmF2aWdhdGlvbiBEZWZlYXRlclxuICAgICAgICB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdG91Y2hTdGFydFggPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgICAgICBjb25zdCBkaWZmWCA9IE1hdGguYWJzKHRoaXMuX3RvdWNoU3RhcnRYIC0gY3VycmVudFgpO1xuICAgICAgICAgICAgY29uc3QgZGlmZlkgPSBNYXRoLmFicyh0aGlzLl90b3VjaFN0YXJ0WSAtIGN1cnJlbnRZKTtcblxuICAgICAgICAgICAgLy8gTG9jayB0aGUgZ2VzdHVyZSBheGlzIHVwb24gaW5pdGlhbCA1cHggb2YgbW92ZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRpZmZYID4gNSB8fCBkaWZmWSA+IDUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IGRpZmZYID4gZGlmZlk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSWYgdGhlIGdlc3R1cmUgaXMgaG9yaXpvbnRhbCwgZm9yY2VmdWxseSBpbnRlcmNlcHQgdGhlIHRvdWNoIGV2ZW50XG4gICAgICAgICAgICAvLyB0byBwcmV2ZW50IHRoZSBtb2JpbGUgYnJvd3NlciBmcm9tIHRyaWdnZXJpbmcgXCJTd2lwZSB0byBHbyBCYWNrXCJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNob3VsZFByZXZlbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHdyYXBwZXIgPSBwYXRoLmZpbmQoZWwgPT4gZWwuY2xhc3NMaXN0ICYmIGVsLmNsYXNzTGlzdC5jb250YWlucygnYWN0aW9ucy13cmFwcGVyJykpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNSaWdodFN3aXBlID0gY3VycmVudFggPiB0aGlzLl90b3VjaFN0YXJ0WDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNMZWZ0U3dpcGUgPSBjdXJyZW50WCA8IHRoaXMuX3RvdWNoU3RhcnRYO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXhTY3JvbGwgPSBNYXRoLm1heCgwLCB3cmFwcGVyLnNjcm9sbFdpZHRoIC0gd3JhcHBlci5jbGllbnRXaWR0aCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmlnaHRTd2lwZSAmJiB3cmFwcGVyLnNjcm9sbExlZnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRQcmV2ZW50ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNMZWZ0U3dpcGUgJiYgd3JhcHBlci5zY3JvbGxMZWZ0IDwgbWF4U2Nyb2xsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRQcmV2ZW50ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoc2hvdWxkUHJldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2VsZi1IZWFsaW5nIFdyYXBwZXI6IFJlc2V0IHRyYW5zaWVudCBvdmVybGF5IHN0YXRlIGlmIExpdCByZWN5Y2xlcyB0aGUgRE9NIG5vZGUgZm9yIGEgbmV3IGl0ZW1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZW50aXR5RGF0YScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZmlsZW5hbWUnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RpdGxlVGV4dCcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVEb2N1bWVudENsaWNrKGUpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgICAgIGlmICghcGF0aC5pbmNsdWRlcyh0aGlzKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoU3RhcnQoZSkge1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICB0aGlzLl9jYXJkV2lkdGggPSByZWN0LndpZHRoO1xuICAgICAgICB0aGlzLl9sb2NhbFN0YXJ0WCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gbnVsbDtcblxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZS5jb21wb3NlZFBhdGgoKS5maW5kKGVsID0+IGVsLmNsYXNzTGlzdCAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGlvbnMtd3JhcHBlcicpKTtcbiAgICAgICAgdGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgPSB3cmFwcGVyID8gd3JhcHBlci5zY3JvbGxMZWZ0IDogbnVsbDtcbiAgICB9XG5cbiAgICBfdG9nZ2xlU2VsZWN0aW9uKCkge1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gIXRoaXMuc2VsZWN0ZWQ7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLXNlbGVjdC10b2dnbGVkJywge1xuICAgICAgICAgICAgZGV0YWlsOiB7IHNlbGVjdGVkOiB0aGlzLnNlbGVjdGVkIH0sXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBfaGFuZGxlVG91Y2hFbmQoZSkge1xuICAgICAgICBpZiAodGhpcy5fdG91Y2hTdGFydFggPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBjb25zdCB0b3VjaEVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX3RvdWNoU3RhcnRYIC0gdG91Y2hFbmRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSB0aGlzLl90b3VjaFN0YXJ0WSAtIHRvdWNoRW5kWTtcblxuICAgICAgICAvLyBFbnN1cmUgaG9yaXpvbnRhbCBzd2lwZSBpcyBkb21pbmFudCB0byBwcmV2ZW50IGFjY2lkZW50YWwgdHJpZ2dlcnMgZHVyaW5nIHZlcnRpY2FsIHNjcm9sbGluZ1xuICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IE1hdGguYWJzKGRlbHRhWSkgJiYgTWF0aC5hYnMoZGVsdGFYKSA+IDMwKSB7XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTd2lwZSA9IGRlbHRhWCA+IDMwOyAgIC8vIFJpZ2h0LXRvLUxlZnRcbiAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTd2lwZSA9IGRlbHRhWCA8IC0zMDsgLy8gTGVmdC10by1SaWdodFxuICAgICAgICAgICAgLy8gV2lkZW4gdGhlIGhpdCB0YXJnZXQgdG8gMjUlIGZvciBiZXR0ZXIgZXJnb25vbWljcywgYW5kIGd1YXJhbnRlZSBhdCBsZWFzdCA3MHB4XG4gICAgICAgICAgICBjb25zdCBpc0xlZnRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPCBNYXRoLm1heCgodGhpcy5fY2FyZFdpZHRoICogMC4yNSksIDcwKTtcblxuICAgICAgICAgICAgaWYgKGlzTGVmdFNpZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNSaWdodFN3aXBlICYmICF0aGlzLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5faGFzQWN0aW9ucyB8fCAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0FjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVmdFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1JpZ2h0U3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCAhPT0gbnVsbCAmJiB0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIGlzIHNjcm9sbGluZyB0aGUgYnV0dG9ucyBiYWNrIHRvIHRoZSBzdGFydDsgZG9uJ3QgY2xvc2UgdGhlIGRyYXdlciB5ZXRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPSBudWxsO1xuICAgIH1cbiAgICBmaXJzdFVwZGF0ZWQoKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cblxuICAgIF9jaGVja0FjdGlvbnMoKSB7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3Rvcignc2xvdFtuYW1lPVwiYWN0aW9uc1wiXScpO1xuICAgICAgICBpZiAoc2xvdCkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBzbG90LmFzc2lnbmVkRWxlbWVudHMoeyBmbGF0dGVuOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGVsZW1lbnRzLmxlbmd0aCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVNsb3RDaGFuZ2UoZSkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7IXRoaXMuZGlzYWJsZVNlbGVjdGlvbiA/IGh0bWxgPGRpdiBjbGFzcz1cInNlbGVjdGlvbi1ndXR0ZXJcIiB0aXRsZT1cIlNlbGVjdCBJdGVtXCIgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7IH19PjwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIiBzdHlsZT1cIi0tY2FyZC1pbnRlbnQ6ICR7dGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0taW50ZW50LW5ldXRyYWwpJ31cIlxuICAgICAgICAgICAgICAgIEBtb3VzZWxlYXZlPSR7KCkgPT4geyBpZiAod2luZG93Lm1hdGNoTWVkaWEoJyhob3ZlcjogaG92ZXIpJykubWF0Y2hlcykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fVxuICAgICAgICAgICAgICAgIEB0b3VjaHN0YXJ0PSR7dGhpcy5faGFuZGxlVG91Y2hTdGFydH1cbiAgICAgICAgICAgICAgICBAdG91Y2hlbmQ9JHt0aGlzLl9oYW5kbGVUb3VjaEVuZH0+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC10aXRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5pY29uID8gaHRtbGA8c3Bhbj4ke3RoaXMuaWNvbn08L3NwYW4+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJjYXJkLWRlc2NcIj4ke3RoaXMuZGVzY3JpcHRpb25UZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHsodGhpcy5kZXRhaWxUZXh0IHx8IHRoaXMuZGV0YWlsUHJlZml4IHx8IHRoaXMuZGV0YWlsU3VmZml4KSA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWxcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsUHJlZml4ID8gaHRtbGA8c3BhbiBjbGFzcz1cImNhcmQtZGV0YWlsLXByZWZpeFwiPiR7dGhpcy5kZXRhaWxQcmVmaXh9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsVGV4dCA/IGh0bWxgPHNwYW4gY2xhc3M9XCJjYXJkLWRldGFpbC1tYWluXCI+JHt0aGlzLmRldGFpbFRleHR9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsU3VmZml4ID8gaHRtbGA8c3BhbiBjbGFzcz1cImNhcmQtZGV0YWlsLXN1ZmZpeFwiPiR7dGhpcy5kZXRhaWxTdWZmaXh9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJkZXRhaWxcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJpbmxpbmUtYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cmlnZ2VyLWJhclwiICBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLl9vdmVybGF5QWN0aXZlID0gIXRoaXMuX292ZXJsYXlBY3RpdmU7IH19PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRyaWdnZXItaWNvblwiPlx1MjAzOTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy10cmF5XCIgQGNsaWNrPSR7KGUpID0+IHsgaWYoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uJykgfHwgZS50YXJnZXQudGFnTmFtZS5pbmNsdWRlcygnWUVOVlVJJykpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJheS1jYXB0aW9uXCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25zXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9wLXNoYWRvd1wiPjwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNhcmQnLCBZZW52dWlDYXJkKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR0xPQkFMIEVER0UtU1dJUEUgQ09PUkRJTkFUT1IgKE1vZHVsZSBTY29wZSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNhZmFyaSBpZ25vcmVzIENTUyBvdmVyc2Nyb2xsLWJlaGF2aW9yIGZvciBleHRyZW1lIGVkZ2Ugc3dpcGVzLiBcbi8vIFdlIGxvY2sgdGhlIE9TIGdlc3R1cmUgbmF0aXZlbHkgYXQgdGhlIGRvY3VtZW50IGxldmVsIGFuZCByZXNvbHZlIHRoZSBcbi8vIGRyb3AgdGFyZ2V0IHRvIGFsbG93IGdsb2JhbCBjYXJkIHNlbGVjdGlvbiB3aXRob3V0IHJlcXVpcmluZyBhIERPTSB3cmFwcGVyLlxubGV0IF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xubGV0IF9lZGdlU3dpcGVTdGFydFkgPSBudWxsO1xubGV0IF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xubGV0IF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludCh4LCB5LCBzZWxlY3Rvcikge1xuICAgIGxldCBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgd2hpbGUgKGVsICYmIGVsLnNoYWRvd1Jvb3QpIHtcbiAgICAgICAgY29uc3QgZGVlcGVyID0gZWwuc2hhZG93Um9vdC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgICAgICBpZiAoIWRlZXBlciB8fCBkZWVwZXIgPT09IGVsKSBicmVhaztcbiAgICAgICAgZWwgPSBkZWVwZXI7XG4gICAgfVxuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzRWxlbWVudEluc2lkZShlbCwgc2VsZWN0b3IpIHtcbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiB0cnVlO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChlKSA9PiB7XG4gICAgaWYgKGUudG91Y2hlc1swXS5jbGllbnRYIDwgMzApIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gdHJ1ZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IGUudG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRZID0gZS50b3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgIH1cbn0sIHsgcGFzc2l2ZTogdHJ1ZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgNXB4IG9mIG1vdmVtZW50IHRvIG1hdGhlbWF0aWNhbGx5IGxvY2sgdGhlIGF4aXNcbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYIC0gX2VkZ2VTd2lwZVN0YXJ0WCk7XG4gICAgICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuICAgICAgICAgICAgaWYgKGR4ID4gNSB8fCBkeSA+IDUpIHtcbiAgICAgICAgICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gZHggPiBkeSA/ICdob3Jpem9udGFsJyA6ICd2ZXJ0aWNhbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEtpbGxzIFNhZmFyaSBiYWNrLW5hdmlnYXRpb24gJiBsb2NrcyB2ZXJ0aWNhbCBkcmlmdFxuICAgICAgICB9IGVsc2UgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlOyAvLyBSZWxlYXNlcyB0aGUgbG9jayB0byBhbGxvdyBuYXRpdmUgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIH1cbiAgICB9XG59LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IGVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IGVuZFggLSBfZWRnZVN3aXBlU3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSBNYXRoLmFicyhlbmRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG5cbiAgICAgICAgLy8gT25seSBpbnRlcnZlbmUgaWYgdGhlIHN3aXBlIHN0YXJ0ZWQgb24gdGhlIGJhY2tncm91bmQgcGFkZGluZy9ndXR0ZXIuXG4gICAgICAgIGNvbnN0IHN0YXJ0ZWRPbkNhcmQgPSBpc0VsZW1lbnRJbnNpZGUoZS50YXJnZXQsICd5ZW52dWktY2FyZCcpO1xuXG4gICAgICAgIC8vIElmIGl0IHdhcyBhIGNsZWFuIHJpZ2h0d2FyZCBzd2lwZSBmcm9tIHRoZSBiYWNrZ3JvdW5kXG4gICAgICAgIGlmICghc3RhcnRlZE9uQ2FyZCAmJiBkZWx0YVggPiAzMCAmJiBkZWx0YVggPiBkZWx0YVkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludChlbmRYLCBlbmRZLCAneWVudnVpLWNhcmQnKTtcbiAgICAgICAgICAgIGlmIChjYXJkICYmICFjYXJkLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXJkLnNlbGVjdGVkID0gIWNhcmQuc2VsZWN0ZWQ7XG4gICAgICAgICAgICAgICAgY2FyZC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogY2FyZC5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG4gICAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSxtQkFBbUJBLENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsZ0JBQWlCLENBQUUsS0FBTSxNQUFPLEVBQ2hDLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN0QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZ1ZoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssZUFBaUIsR0FDdEIsS0FBSyxZQUFjLEdBQ25CLEtBQUssYUFBZSxLQUNwQixLQUFLLGFBQWUsS0FDcEIsS0FBSyxx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QVMsRUFDbEMsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsRUFFVixDQUNBWixFQUFlLEdBQ2ZGLEVBQW1CLElBQ3ZCLENBQ0osQ0FBQyIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIiwgImUiLCAiY3VycmVudFgiLCAiY3VycmVudFkiLCAiZGlmZlgiLCAiZGlmZlkiLCAic2hvdWxkUHJldmVudCIsICJ3cmFwcGVyIiwgImVsIiwgImlzUmlnaHRTd2lwZSIsICJpc0xlZnRTd2lwZSIsICJtYXhTY3JvbGwiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAicmVjdCIsICJ0b3VjaEVuZFgiLCAidG91Y2hFbmRZIiwgImRlbHRhWCIsICJkZWx0YVkiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
