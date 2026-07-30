import{LitElement as u,html as l,css as f}from"lit";export class YenvuiCard extends u{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0}};static styles=f`
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
            box-shadow: 0 0 0 2px var(--card-intent, #3b82f6);
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null,this.selected=!1,this._docClickListener=this._handleDocumentClick.bind(this),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("click",this._docClickListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this._touchMoveListener=t=>{if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,n=Math.abs(this._touchStartX-i),c=Math.abs(this._touchStartY-o);this._isSwipingHorizontal===null&&(n>5||c>5)&&(this._isSwipingHorizontal=n>c),this._isSwipingHorizontal&&t.preventDefault()},this.addEventListener("touchmove",this._touchMoveListener,{passive:!1}),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("touchmove",this._touchMoveListener),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("click",this._docClickListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._themeObserver&&this._themeObserver.disconnect()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}}))}_handleDocumentClick(t){!t.composedPath().includes(this)&&this._overlayActive&&(this._overlayActive=!1)}_handleTouchStart(t){this._touchStartX=t.changedTouches[0].clientX,this._touchStartY=t.changedTouches[0].clientY;const i=this.getBoundingClientRect();this._cardWidth=i.width,this._localStartX=this._touchStartX-i.left,this._isSwipingHorizontal=null}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}_handleTouchEnd(t){if(this._touchStartX===null)return;const i=t.changedTouches[0].clientX,o=t.changedTouches[0].clientY,n=this._touchStartX-i,c=this._touchStartY-o;if(Math.abs(n)>Math.abs(c)&&Math.abs(n)>30){const s=n>30,p=n<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?p&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(s?this._overlayActive=!0:p&&(this._overlayActive=!1))}this._touchStartX=null,this._touchStartY=null,this._isSwipingHorizontal=null}_handlePointerDown(t){t.pointerType==="mouse"&&t.button!==0||(this._longPressTimer=setTimeout(()=>{this._justLongPressed=!0,this._toggleSelection(),this._longPressTimer=null},500))}_handlePointerCancel(){this._longPressTimer&&(clearTimeout(this._longPressTimer),this._longPressTimer=null)}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const i=t.assignedElements({flatten:!0});this._hasActions=i.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return l`
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
        `}}customElements.define("yenvui-card",YenvuiCard);let r=null,h=null,a=!1,d=null;function v(e,t,i){let o=document.elementFromPoint(e,t);for(;o&&o.shadowRoot;){const n=o.shadowRoot.elementFromPoint(e,t);if(!n||n===o)break;o=n}for(;o;){if(o.closest&&o.closest(i))return o.closest(i);o=o.getRootNode().host}return null}function b(e,t){for(;e;){if(e.closest&&e.closest(t))return!0;e=e.getRootNode().host}return!1}document.addEventListener("touchstart",e=>{e.touches[0].clientX<30?(a=!0,r=e.touches[0].clientX,h=e.touches[0].clientY,d=null):a=!1},{passive:!0}),document.addEventListener("touchmove",e=>{if(a&&r!==null){if(d===null){const t=Math.abs(e.changedTouches[0].clientX-r),i=Math.abs(e.changedTouches[0].clientY-h);(t>5||i>5)&&(d=t>i?"horizontal":"vertical")}d==="horizontal"?e.preventDefault():d==="vertical"&&(a=!1)}},{passive:!1}),document.addEventListener("touchend",e=>{if(a&&r!==null){const t=e.changedTouches[0].clientX,i=e.changedTouches[0].clientY,o=t-r,n=Math.abs(i-h);if(!b(e.target,"yenvui-card")&&o>30&&o>n){const s=v(t,i,"yenvui-card");s&&!s.disableSelection&&(s.selected=!s.selected,s.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:s.selected},bubbles:!0,composed:!0})))}a=!1,r=null}});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlDYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGV0YWlsVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgZGlzcGxheTogYmxvY2s7IG1hcmdpbi1ib3R0b206IDEycHg7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdG91Y2gtYWN0aW9uOiBwYW4teTsgfVxuICAgICAgICAuc2VsZWN0aW9uLWd1dHRlciB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICBsZWZ0OiAwO1xuICAgICAgICAgICAgdG9wOiAwO1xuICAgICAgICAgICAgYm90dG9tOiAwO1xuICAgICAgICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICAgICAgICB6LWluZGV4OiA1O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdG91Y2gtYWN0aW9uOiBwYW4teTtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIHRvdWNoLWFjdGlvbjogcGFuLXk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDEwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4ycywgYm94LXNoYWRvdyAwLjJzLCBib3JkZXItbGVmdC13aWR0aCAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSksIHBhZGRpbmctbGVmdCAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgQG1lZGlhIChob3ZlcjogaG92ZXIpIHtcbiAgICAgICAgICAgIC5zZWxlY3Rpb24tZ3V0dGVyOmhvdmVyICsgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHg7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgIzNiODJmNik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuY2FyZC13cmFwcGVyOmhvdmVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgICAgICAgICBib3gtc2hhZG93OiAwIDRweCAxMnB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSB7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHg7XG4gICAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDBweDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsICMzYjgyZjYpO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAwIDAgMnB4IHZhcigtLWNhcmQtaW50ZW50LCAjM2I4MmY2KTtcbiAgICAgICAgfVxuICAgICAgICAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgbWluLXdpZHRoOiAwO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE1cHggOHB4IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMDVyZW07XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogOHB4O1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWRlc2Mge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4IDhweCAxNXB4O1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjlyZW07XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgICAgICBkaXNwbGF5OiAtd2Via2l0LWJveDtcbiAgICAgICAgICAgIC13ZWJraXQtbGluZS1jbGFtcDogMjtcbiAgICAgICAgICAgIC13ZWJraXQtYm94LW9yaWVudDogdmVydGljYWw7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMCAxNXB4O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZCgqKSB7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDhweCAxNXB4IDEycHggMTVweDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8sIG1vbm9zcGFjZSk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNzVyZW07XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICB3aWR0aDogMjJweDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKSk7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBmaWx0ZXIgMC4ycztcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDAgNXB4IDVweCAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtoYXMtYWN0aW9uc10pIC50cmlnZ2VyLWJhciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB9XG4gICAgICAgIC50cmlnZ2VyLWJhcjpob3ZlciB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4yKTtcbiAgICAgICAgfVxuICAgICAgICAudHJpZ2dlci1pY29uIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2U7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAtMnB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC50cmlnZ2VyLWljb24ge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiByb3RhdGUoMTgwZGVnKTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IC0xcHg7XG4gICAgICAgICAgICByaWdodDogMjFweDtcbiAgICAgICAgICAgIHRvcDogLTFweDtcbiAgICAgICAgICAgIG1pbi1oZWlnaHQ6IGNhbGMoMTAwJSArIDJweCk7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICAvKiBQYXNzIENTUyB2YXJpYWJsZXMgdG8gcGVuZXRyYXRlIHNsb3R0ZWQgYXN5bmMgYnV0dG9ucyAqL1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogNnB4IDEycHg7XG4gICAgICAgICAgICAtLWJ0bi1mb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTBweDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXMgZWFzZSwgdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuMTc1LCAwLjg4NSwgMC4zMiwgMS4yNzUpO1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHggMCAwIDZweDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45OCk7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNCk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAxNHB4OyAvKiBFbnN1cmUgYnV0dG9ucyBkb24ndCBjbGlwIHRoZSBhYnNvbHV0ZSBjYXB0aW9uICovXG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBvcGFjaXR5OiAxO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHNjYWxlKDEpO1xuICAgICAgICB9XG4gICAgICAgIC50cmF5LWNhcHRpb24ge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgdG9wOiA0cHg7XG4gICAgICAgICAgICBsZWZ0OiAxMHB4O1xuICAgICAgICAgICAgcmlnaHQ6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xuICAgICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuNXB4O1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjE1KTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMDAwMDAwO1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogNHB4IDRweCAwICMxNGI4YTY7XG4gICAgICAgIH1cbiAgICAgICAgLyogVW5zdHlsZWQgc2xvdHMgZm9yIGhvc3QtaW5qZWN0ZWQgYnV0dG9ucyAqL1xuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgcGFkZGluZzogdmFyKC0tYnRuLXBhZGRpbmcpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogdmFyKC0tYnRuLWZvbnQtc2l6ZSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uOmhvdmVyKSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1ob3Zlcik7XG4gICAgICAgIH1cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjOGI1Y2Y2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiA0cHggNHB4IDAgIzE0YjhhNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAwcHggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBvcGFjaXR5OiAxICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiAtLS0gQ29tcGFjdCBNb2RlIFZhcmlhbnQgLS0tICovXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkge1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDEycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45NXJlbTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWRlc2MsXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMCAwIDEwcHg7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZG9jQ2xpY2tMaXN0ZW5lciA9IHRoaXMuX2hhbmRsZURvY3VtZW50Q2xpY2suYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbC5zb3VyY2UgIT09IHRoaXMgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29udGFpbnMoZS5yZWxhdGVkVGFyZ2V0KSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2RvY0NsaWNrTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICAvLyBOYXRpdmUgRWRnZS1Td2lwZSBOYXZpZ2F0aW9uIERlZmVhdGVyXG4gICAgICAgIHRoaXMuX3RvdWNoTW92ZUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90b3VjaFN0YXJ0WCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50WSA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZYID0gTWF0aC5hYnModGhpcy5fdG91Y2hTdGFydFggLSBjdXJyZW50WCk7XG4gICAgICAgICAgICBjb25zdCBkaWZmWSA9IE1hdGguYWJzKHRoaXMuX3RvdWNoU3RhcnRZIC0gY3VycmVudFkpO1xuXG4gICAgICAgICAgICAvLyBMb2NrIHRoZSBnZXN0dXJlIGF4aXMgdXBvbiBpbml0aWFsIDVweCBvZiBtb3ZlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzU3dpcGluZ0hvcml6b250YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGlmZlggPiA1IHx8IGRpZmZZID4gNSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pc1N3aXBpbmdIb3Jpem9udGFsID0gZGlmZlggPiBkaWZmWTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBnZXN0dXJlIGlzIGhvcml6b250YWwsIGZvcmNlZnVsbHkgaW50ZXJjZXB0IHRoZSB0b3VjaCBldmVudFxuICAgICAgICAgICAgLy8gdG8gcHJldmVudCB0aGUgbW9iaWxlIGJyb3dzZXIgZnJvbSB0cmlnZ2VyaW5nIFwiU3dpcGUgdG8gR28gQmFja1wiXG4gICAgICAgICAgICBpZiAodGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lciwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl90aGVtZU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS10aGVtZSddIH0pO1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaE1vdmVMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9kb2NDbGlja0xpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgaWYgKHRoaXMuX3RoZW1lT2JzZXJ2ZXIpIHRoaXMuX3RoZW1lT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ19vdmVybGF5QWN0aXZlJykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLW92ZXJsYXktb3BlbmVkJywge1xuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNvdXJjZTogdGhpcyB9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlRG9jdW1lbnRDbGljayhlKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgICAgICBpZiAoIXBhdGguaW5jbHVkZXModGhpcykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9oYW5kbGVUb3VjaFN0YXJ0KGUpIHtcbiAgICAgICAgdGhpcy5fdG91Y2hTdGFydFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgdGhpcy5fY2FyZFdpZHRoID0gcmVjdC53aWR0aDtcbiAgICAgICAgdGhpcy5fbG9jYWxTdGFydFggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHJlY3QubGVmdDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgX3RvZ2dsZVNlbGVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9ICF0aGlzLnNlbGVjdGVkO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2FyZC1zZWxlY3QtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogdGhpcy5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgX2hhbmRsZVRvdWNoRW5kKGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RvdWNoU3RhcnRYID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRvdWNoRW5kWCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICAgICAgY29uc3QgdG91Y2hFbmRZID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICBjb25zdCBkZWx0YVggPSB0aGlzLl90b3VjaFN0YXJ0WCAtIHRvdWNoRW5kWDtcbiAgICAgICAgY29uc3QgZGVsdGFZID0gdGhpcy5fdG91Y2hTdGFydFkgLSB0b3VjaEVuZFk7XG5cbiAgICAgICAgLy8gRW5zdXJlIGhvcml6b250YWwgc3dpcGUgaXMgZG9taW5hbnQgdG8gcHJldmVudCBhY2NpZGVudGFsIHRyaWdnZXJzIGR1cmluZyB2ZXJ0aWNhbCBzY3JvbGxpbmdcbiAgICAgICAgaWYgKE1hdGguYWJzKGRlbHRhWCkgPiBNYXRoLmFicyhkZWx0YVkpICYmIE1hdGguYWJzKGRlbHRhWCkgPiAzMCkge1xuICAgICAgICAgICAgY29uc3QgaXNMZWZ0U3dpcGUgPSBkZWx0YVggPiAzMDsgICAvLyBSaWdodC10by1MZWZ0XG4gICAgICAgICAgICBjb25zdCBpc1JpZ2h0U3dpcGUgPSBkZWx0YVggPCAtMzA7IC8vIExlZnQtdG8tUmlnaHRcbiAgICAgICAgICAgIC8vIFdpZGVuIHRoZSBoaXQgdGFyZ2V0IHRvIDI1JSBmb3IgYmV0dGVyIGVyZ29ub21pY3MsIGFuZCBndWFyYW50ZWUgYXQgbGVhc3QgNzBweFxuICAgICAgICAgICAgY29uc3QgaXNMZWZ0U2lkZSA9IHRoaXMuX2xvY2FsU3RhcnRYIDwgTWF0aC5tYXgoKHRoaXMuX2NhcmRXaWR0aCAqIDAuMjUpLCA3MCk7XG5cbiAgICAgICAgICAgIGlmIChpc0xlZnRTaWRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmlnaHRTd2lwZSAmJiAhdGhpcy5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFzQWN0aW9ucyA9IHRoaXMuX2hhc0FjdGlvbnMgfHwgISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICAgICAgICAgIGlmIChoYXNBY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0xlZnRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNSaWdodFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90b3VjaFN0YXJ0WCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoU3RhcnRZID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNTd2lwaW5nSG9yaXpvbnRhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgX2hhbmRsZVBvaW50ZXJEb3duKGUpIHtcbiAgICAgICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScgJiYgZS5idXR0b24gIT09IDApIHJldHVybjtcbiAgICAgICAgdGhpcy5fbG9uZ1ByZXNzVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX2p1c3RMb25nUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMuX2xvbmdQcmVzc1RpbWVyID0gbnVsbDtcbiAgICAgICAgfSwgNTAwKTtcbiAgICB9XG5cbiAgICBfaGFuZGxlUG9pbnRlckNhbmNlbCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvbmdQcmVzc1RpbWVyKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fbG9uZ1ByZXNzVGltZXIpO1xuICAgICAgICAgICAgdGhpcy5fbG9uZ1ByZXNzVGltZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZpcnN0VXBkYXRlZCgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgX2NoZWNrQWN0aW9ucygpIHtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdzbG90W25hbWU9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIGlmIChzbG90KSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHNsb3QuYXNzaWduZWRFbGVtZW50cyh7IGZsYXR0ZW46IHRydWUgfSk7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZWxlbWVudHMubGVuZ3RoID4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlU2xvdENoYW5nZShlKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgJHshdGhpcy5kaXNhYmxlU2VsZWN0aW9uID8gaHRtbGA8ZGl2IGNsYXNzPVwic2VsZWN0aW9uLWd1dHRlclwiIHRpdGxlPVwiU2VsZWN0IEl0ZW1cIiBAY2xpY2s9JHsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTsgfX0+PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtd3JhcHBlclwiIHN0eWxlPVwiLS1jYXJkLWludGVudDogJHt0aGlzLmludGVudENvbG9yIHx8ICd2YXIoLS1pbnRlbnQtbmV1dHJhbCknfVwiXG4gICAgICAgICAgICAgICAgQG1vdXNlbGVhdmU9JHsoKSA9PiB7IGlmICh3aW5kb3cubWF0Y2hNZWRpYSgnKGhvdmVyOiBob3ZlciknKS5tYXRjaGVzKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7IH19XG4gICAgICAgICAgICAgICAgQHRvdWNoc3RhcnQ9JHt0aGlzLl9oYW5kbGVUb3VjaFN0YXJ0fVxuICAgICAgICAgICAgICAgIEB0b3VjaGVuZD0ke3RoaXMuX2hhbmRsZVRvdWNoRW5kfVxuICAgICAgICAgICAgICAgIEBwb2ludGVyZG93bj0ke3RoaXMuX2hhbmRsZVBvaW50ZXJEb3dufVxuICAgICAgICAgICAgICAgIEBwb2ludGVydXA9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBwb2ludGVybW92ZT0ke3RoaXMuX2hhbmRsZVBvaW50ZXJDYW5jZWx9XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJjYW5jZWw9JHt0aGlzLl9oYW5kbGVQb2ludGVyQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fanVzdExvbmdQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9qdXN0TG9uZ1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9fT5cblxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1oZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXRpdGxlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmljb24gPyBodG1sYDxzcGFuPiR7dGhpcy5pY29ufTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLnRpdGxlVGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRlc2NyaXB0aW9uVGV4dCA/IGh0bWxgPGRpdiBjbGFzcz1cImNhcmQtZGVzY1wiPiR7dGhpcy5kZXNjcmlwdGlvblRleHR9PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1ib2R5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsVGV4dCA/IGh0bWxgPGRpdiBjbGFzcz1cImNhcmQtZGV0YWlsXCI+JHt0aGlzLmRldGFpbFRleHR9PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiaW5saW5lLWFjdGlvbnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHJpZ2dlci1iYXJcIiAgXG4gICAgICAgICAgICAgICAgICAgIEBwb2ludGVyZW50ZXI9JHsoZSkgPT4geyBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IHRydWU7IH19XG4gICAgICAgICAgICAgICAgICAgIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IGUucHJldmVudERlZmF1bHQoKTsgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9ICF0aGlzLl9vdmVybGF5QWN0aXZlOyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0cmlnZ2VyLWljb25cIj5cdTIwMzk8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtdHJheVwiIEBjbGljaz0keyhlKSA9PiB7IGlmKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IGUudGFyZ2V0LmNsb3Nlc3QoJ2J1dHRvbicpIHx8IGUudGFyZ2V0LnRhZ05hbWUuaW5jbHVkZXMoJ1lFTlZVSScpKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7IH19PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRyYXktY2FwdGlvblwiPiR7dGhpcy50aXRsZVRleHR9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy13cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYWN0aW9uc1wiIEBzbG90Y2hhbmdlPSR7dGhpcy5faGFuZGxlU2xvdENoYW5nZX0+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNhcmQnLCBZZW52dWlDYXJkKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR0xPQkFMIEVER0UtU1dJUEUgQ09PUkRJTkFUT1IgKE1vZHVsZSBTY29wZSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNhZmFyaSBpZ25vcmVzIENTUyBvdmVyc2Nyb2xsLWJlaGF2aW9yIGZvciBleHRyZW1lIGVkZ2Ugc3dpcGVzLiBcbi8vIFdlIGxvY2sgdGhlIE9TIGdlc3R1cmUgbmF0aXZlbHkgYXQgdGhlIGRvY3VtZW50IGxldmVsIGFuZCByZXNvbHZlIHRoZSBcbi8vIGRyb3AgdGFyZ2V0IHRvIGFsbG93IGdsb2JhbCBjYXJkIHNlbGVjdGlvbiB3aXRob3V0IHJlcXVpcmluZyBhIERPTSB3cmFwcGVyLlxubGV0IF9lZGdlU3dpcGVTdGFydFggPSBudWxsO1xubGV0IF9lZGdlU3dpcGVTdGFydFkgPSBudWxsO1xubGV0IF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xubGV0IF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludCh4LCB5LCBzZWxlY3Rvcikge1xuICAgIGxldCBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoeCwgeSk7XG4gICAgd2hpbGUgKGVsICYmIGVsLnNoYWRvd1Jvb3QpIHtcbiAgICAgICAgY29uc3QgZGVlcGVyID0gZWwuc2hhZG93Um9vdC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgICAgICBpZiAoIWRlZXBlciB8fCBkZWVwZXIgPT09IGVsKSBicmVhaztcbiAgICAgICAgZWwgPSBkZWVwZXI7XG4gICAgfVxuICAgIHdoaWxlIChlbCkge1xuICAgICAgICBpZiAoZWwuY2xvc2VzdCAmJiBlbC5jbG9zZXN0KHNlbGVjdG9yKSkgcmV0dXJuIGVsLmNsb3Nlc3Qoc2VsZWN0b3IpO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzRWxlbWVudEluc2lkZShlbCwgc2VsZWN0b3IpIHtcbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgICAgaWYgKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdChzZWxlY3RvcikpIHJldHVybiB0cnVlO1xuICAgICAgICBlbCA9IGVsLmdldFJvb3ROb2RlKCkuaG9zdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChlKSA9PiB7XG4gICAgaWYgKGUudG91Y2hlc1swXS5jbGllbnRYIDwgMzApIHtcbiAgICAgICAgX2lzRWRnZVN3aXBlID0gdHJ1ZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IGUudG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICBfZWRnZVN3aXBlU3RhcnRZID0gZS50b3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIF9nbG9iYWxTd2lwZUF4aXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlO1xuICAgIH1cbn0sIHsgcGFzc2l2ZTogdHJ1ZSB9KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgKGUpID0+IHtcbiAgICBpZiAoX2lzRWRnZVN3aXBlICYmIF9lZGdlU3dpcGVTdGFydFggIT09IG51bGwpIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgNXB4IG9mIG1vdmVtZW50IHRvIG1hdGhlbWF0aWNhbGx5IGxvY2sgdGhlIGF4aXNcbiAgICAgICAgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYIC0gX2VkZ2VTd2lwZVN0YXJ0WCk7XG4gICAgICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WSAtIF9lZGdlU3dpcGVTdGFydFkpO1xuICAgICAgICAgICAgaWYgKGR4ID4gNSB8fCBkeSA+IDUpIHtcbiAgICAgICAgICAgICAgICBfZ2xvYmFsU3dpcGVBeGlzID0gZHggPiBkeSA/ICdob3Jpem9udGFsJyA6ICd2ZXJ0aWNhbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2dsb2JhbFN3aXBlQXhpcyA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEtpbGxzIFNhZmFyaSBiYWNrLW5hdmlnYXRpb24gJiBsb2NrcyB2ZXJ0aWNhbCBkcmlmdFxuICAgICAgICB9IGVsc2UgaWYgKF9nbG9iYWxTd2lwZUF4aXMgPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgICAgIF9pc0VkZ2VTd2lwZSA9IGZhbHNlOyAvLyBSZWxlYXNlcyB0aGUgbG9jayB0byBhbGxvdyBuYXRpdmUgdmVydGljYWwgc2Nyb2xsaW5nXG4gICAgICAgIH1cbiAgICB9XG59LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChlKSA9PiB7XG4gICAgaWYgKF9pc0VkZ2VTd2lwZSAmJiBfZWRnZVN3aXBlU3RhcnRYICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZFggPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IGVuZFkgPSBlLmNoYW5nZWRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IGVuZFggLSBfZWRnZVN3aXBlU3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YVkgPSBNYXRoLmFicyhlbmRZIC0gX2VkZ2VTd2lwZVN0YXJ0WSk7XG5cbiAgICAgICAgLy8gT25seSBpbnRlcnZlbmUgaWYgdGhlIHN3aXBlIHN0YXJ0ZWQgb24gdGhlIGJhY2tncm91bmQgcGFkZGluZy9ndXR0ZXIuXG4gICAgICAgIGNvbnN0IHN0YXJ0ZWRPbkNhcmQgPSBpc0VsZW1lbnRJbnNpZGUoZS50YXJnZXQsICd5ZW52dWktY2FyZCcpO1xuXG4gICAgICAgIC8vIElmIGl0IHdhcyBhIGNsZWFuIHJpZ2h0d2FyZCBzd2lwZSBmcm9tIHRoZSBiYWNrZ3JvdW5kXG4gICAgICAgIGlmICghc3RhcnRlZE9uQ2FyZCAmJiBkZWx0YVggPiAzMCAmJiBkZWx0YVggPiBkZWx0YVkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBnZXREZWVwQ2xvc2VzdEZyb21Qb2ludChlbmRYLCBlbmRZLCAneWVudnVpLWNhcmQnKTtcbiAgICAgICAgICAgIGlmIChjYXJkICYmICFjYXJkLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXJkLnNlbGVjdGVkID0gIWNhcmQuc2VsZWN0ZWQ7XG4gICAgICAgICAgICAgICAgY2FyZC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogY2FyZC5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBfaXNFZGdlU3dpcGUgPSBmYWxzZTtcbiAgICAgICAgX2VkZ2VTd2lwZVN0YXJ0WCA9IG51bGw7XG4gICAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUMvQixhQUFNLG1CQUFtQkYsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGdCQUFpQixDQUFFLEtBQU0sTUFBTyxFQUNoQyxLQUFNLENBQUUsS0FBTSxNQUFPLEVBQ3JCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsU0FBVSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDekMsaUJBQWtCLENBQUUsS0FBTSxPQUFRLEVBQ2xDLGVBQWdCLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMvQyxZQUFhLENBQUUsS0FBTSxRQUFTLFFBQVMsR0FBTSxVQUFXLGFBQWMsRUFDdEUsUUFBUyxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssQ0FDNUMsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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QUksWUFBWSw2QkFBOEIsQ0FDN0QsT0FBUSxDQUFFLFNBQVVBLEVBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxFQUVWLENBQ0FiLEVBQWUsR0FDZkYsRUFBbUIsSUFDdkIsQ0FDSixDQUFDIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJjdXJyZW50WCIsICJjdXJyZW50WSIsICJkaWZmWCIsICJkaWZmWSIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJyZWN0IiwgInRvdWNoRW5kWCIsICJ0b3VjaEVuZFkiLCAiZGVsdGFYIiwgImRlbHRhWSIsICJpc0xlZnRTd2lwZSIsICJpc1JpZ2h0U3dpcGUiLCAic2xvdCIsICJlbGVtZW50cyIsICJfZWRnZVN3aXBlU3RhcnRYIiwgIl9lZGdlU3dpcGVTdGFydFkiLCAiX2lzRWRnZVN3aXBlIiwgIl9nbG9iYWxTd2lwZUF4aXMiLCAiZ2V0RGVlcENsb3Nlc3RGcm9tUG9pbnQiLCAieCIsICJ5IiwgInNlbGVjdG9yIiwgImVsIiwgImRlZXBlciIsICJpc0VsZW1lbnRJbnNpZGUiLCAiZHgiLCAiZHkiLCAiZW5kWCIsICJlbmRZIiwgImNhcmQiXQp9Cg==
