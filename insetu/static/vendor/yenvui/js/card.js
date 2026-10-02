import{html as e,css as s}from"lit";import{YenvuiBase as l}from"./yenvui-base.js";import{YenvuiGestureController as c}from"./physics.js";export class YenvuiCard extends l{static properties={titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},stale:{type:Boolean,reflect:!0}};static styles=s`
        :host { display: block; margin-bottom: var(--card-margin-bottom, 12px); position: relative; touch-action: pan-x pan-y; }
        .card-wrapper {
            touch-action: pan-x pan-y;
            background: var(--bg-card, var(--input-bg));
            border: 1px solid var(--border);
            border-top: var(--card-border-top, 1px solid var(--border));
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 8px));
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 8px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 8px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 8px));
            display: flex;
            flex-direction: row;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            box-shadow: var(--card-box-shadow, 0 1px 3px rgba(0,0,0,0.05));
            transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        /* Switch to edge-to-edge flush mode when the container column becomes narrow */
        @container (max-width: 480px) {
            .card-wrapper {
                border-left-width: 0 !important;
                border-right-width: 0 !important;
                border-radius: 0 !important;
                margin-bottom: 0 !important;
                border-bottom: 1px solid var(--border) !important;
            }
        }
        .selection-strip {
            width: 14px !important;
            min-width: 14px !important;
            max-width: 14px !important;
            flex-shrink: 0 !important;
            cursor: pointer;
            box-sizing: border-box !important;
            position: relative;
            background: transparent !important;
            border-left: 4px solid var(--card-intent, var(--intent-primary));
            border-right: none !important;
            border-top: none !important;
            border-bottom: none !important;
            opacity: var(--peek-rail-opacity, 1);
            transition: opacity 0.3s ease, border-left-width 0.15s ease, box-shadow 0.15s ease;
        }
        @media (hover: hover) {
            .selection-strip:hover {
                border-left-width: 6px;
            }
            .card-wrapper:hover {
                border-color: var(--border-hover, var(--intent-primary));
                background: var(--bg-card-hover, var(--bg-hover));
            }
        }
        :host([selected]) .card-wrapper,
        :host([_overlayactive]) .card-wrapper {
            background: var(--bg-card-selected, color-mix(in srgb, var(--card-intent, var(--intent-primary)) var(--intent-bg-mix, 15%), var(--input-bg))) !important;
            border-color: var(--border-highlight, var(--card-intent, var(--intent-primary))) !important;
        }

        :host([selected]) .selection-strip {
            border-left-width: 14px !important;
            border-left-color: var(--card-intent, var(--intent-primary)) !important;
            box-shadow: 2px 0 10px rgba(99, 102, 241, 0.45);
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
            padding: 12px;
            transform: translateY(var(--peek-content-y, 0px));
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
        }
        .card-title {
            font-weight: bold;
            color: var(--text, #e0e0e0);
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 8px;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-desc {
            color: var(--text-muted, #888);
            font-size: 0.8rem;
            overflow-wrap: anywhere;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 4px;
        }
        .card-body {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;
        }
        :host([flush]) .card-body {
            padding: 0;
        }
        ::slotted(*) {
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        ::slotted(p), ::slotted(h1), ::slotted(h2), ::slotted(h3), ::slotted(h4), ::slotted(h5), ::slotted(h6) {
            margin-block-start: 0;
            margin-block-end: 0;
        }
        .card-detail {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        @container (max-width: 480px) {
            .card-detail-main { display: none; }
        }
        .action-grip-rail {
            width: 26px;
            flex-shrink: 0;
            background: var(--rail-bg, rgba(255,255,255,0.02));
            border-left: 1px solid var(--border);
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            opacity: var(--peek-rail-opacity, 1);
            transition: opacity 0.3s ease, background 0.15s ease, color 0.15s ease;
        }
        :host([has-actions]) .action-grip-rail {
            display: flex;
        }
        .action-grip-rail:hover {
            background: var(--rail-hover, rgba(99, 102, 241, 0.22));
            color: var(--text);
        }
        .actions-tray {
            position: absolute;
            left: 0;
            right: 26px;
            top: 0;
            bottom: 0;
            background: var(--bg-card, var(--input-bg));
            background: color-mix(in srgb, var(--bg-card, var(--input-bg)) 94%, transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 5px;
            padding: 4px 8px;
            opacity: 0;
            pointer-events: none;
            transform: translateX(10px);
            transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 10;
        }
        .actions-wrapper {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            flex-wrap: nowrap;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
            width: 100%;
            box-sizing: border-box;
        }
        .actions-wrapper::-webkit-scrollbar {
            display: none;
        }
        .actions-wrapper::before, .actions-wrapper::after {
            content: ''; margin: auto;
        }

        :host([_overlayactive]) .actions-tray {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0);
        }
        .tray-caption {
            font-size: 0.65rem;
            font-weight: 700;
            font-family: var(--font-mono, monospace);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            user-select: none;
            max-width: 90%;
            text-align: center;
            margin-bottom: 4px;
        }

        /* Unstyled slots for host-injected buttons */
        ::slotted(button), ::slotted(sutram-async-btn) {
            height: 30px;
            padding: 0 10px !important;
            border-radius: 6px;
            font-size: 0.75rem !important;
            font-weight: 700;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            gap: 5px;
            cursor: pointer;
            transition: filter 0.15s ease, transform 0.1s ease;
            white-space: nowrap;
            user-select: none;
            margin: 0 !important;
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
        }
        ::slotted(button:hover) {
            filter: brightness(1.12);
        }

        /* E-Ink High Contrast Overrides */
        :host-context([data-theme="e-ink"]) .card-wrapper {
            border: 2px solid var(--card-intent, #8b5cf6) !important;
            box-shadow: 3px 4px 0 #14b8a6 !important; /* Colorful Teal Bottom Shadow */
            background: #ffffff !important;
            color: #000000 !important;
            transition: none !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .card-wrapper,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .card-wrapper {
            border: 2px solid #ec4899 !important;
            box-shadow: 3px 4px 0 #eab308 !important; /* Yellow Bottom Shadow on Selected */
        }

        :host-context([data-theme="e-ink"]) .selection-strip {
            border-left-width: 5px !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .selection-strip,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .selection-strip {
            border-left-width: 14px !important;
            border-left-color: #ec4899 !important; /* Hot Pink thick slab */
        }

        :host-context([data-theme="e-ink"]) .action-grip-rail {
            background: #8b5cf6 !important;
            border-left: 2px solid #000000 !important;
            color: #ffffff !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .action-grip-rail,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .action-grip-rail {
            background: #ec4899 !important;
        }

        :host-context([data-theme="e-ink"]) .actions-tray {
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-right: 2px solid #000000 !important;
            transition: none !important;
            transform: none !important;
        }
        :host-context([data-theme="e-ink"]) .tray-caption,
        :host-context([data-theme="e-ink"]) .card-title {
            color: #000000 !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]) .card-desc,
        :host-context([data-theme="e-ink"]) .card-detail {
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
            margin-bottom: 0;
        }
        :host([compact]) .card-title {
            font-size: 0.85rem;
        }
        :host([compact]) .card-desc,
        :host([compact]) .card-body {
            display: none;
        }
        :host([compact]) .card-detail {
            padding: 0 0 0 10px;
            margin-left: auto;
        }
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this.selected=!1,this._gestureController=new c(this,{scrollableContainerSelector:"actions-wrapper",onPanStart:(t,i)=>{const r=this.getBoundingClientRect();this._cardWidth=r.width,this._localStartX=t-r.left;const o=this.shadowRoot.querySelector(".actions-wrapper");this._actionsScrollLeft=o?o.scrollLeft:null},onPanEnd:(t,i,r)=>{if(r!=="horizontal")return;const o=this._gestureController.startX-t;if(Math.abs(o)>30){const n=o>30,a=o<-30;this._localStartX<Math.max(this._cardWidth*.25,70)?a&&!this.disableSelection&&this._toggleSelection():(this._hasActions||this.querySelector('[slot="actions"]'))&&(n?this._overlayActive=!0:a&&(this._actionsScrollLeft!==null&&this._actionsScrollLeft>0||(this._overlayActive=!1)))}}}),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this.registerOutsideClick(()=>{this._overlayActive&&(this._overlayActive=!1)})}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener)}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const i=t.assignedElements({flatten:!0});this._hasActions=i.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return e`
            <div class="card-wrapper" style="--card-intent: ${this.intentColor||"var(--intent-neutral)"}"
                @mouseleave=${()=>{window.matchMedia("(hover: hover)").matches&&(this._overlayActive=!1)}}
                @pointerdown=${t=>this._gestureController.start(t)}>

                ${this.disableSelection?"":e`<div class="selection-strip" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div>`}
                <div class="content-col" @click=${t=>{this.dispatchEvent(new CustomEvent("yenvui-card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))}} style="cursor: pointer; padding: 12px; min-width: 0;">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; gap: 8px;">
                        <div class="card-title" style="display: flex; align-items: center; gap: 6px; font-weight: bold; color: var(--text); font-size: 0.85rem; min-width: 0; overflow: hidden;">
                            ${this.icon&&this.icon.startsWith("<i")?e`<div style="flex-shrink: 0;" .innerHTML=${this.icon}></div>`:this.icon?e`<span style="flex-shrink: 0;">${this.icon}</span>`:""}
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.titleText}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <slot name="header-actions"></slot>
                            ${this.detailSuffix?e`
                                <div class="card-detail-suffix" style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); opacity: 0.8; flex-shrink: 0; margin-left: 8px;">
                                    ${this.detailSuffix.replace(/^[\s|]+/,"")}
                                </div>
                            `:""}
                        </div>
                    </div>

                    ${this.descriptionText?e`
                        <div class="card-desc" style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${this.descriptionText}
                        </div>
                    `:""}
                    ${this.detailText?e`
                        <div class="card-detail" style="font-family: var(--font-mono); font-size: 10px; color: var(--card-intent, var(--intent-primary)); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${this.detailPrefix||""}${this.detailText}
                        </div>
                    `:""}

                    <div class="card-body">
                        <slot></slot>
                    </div>

                    <slot name="detail"></slot>
                    <slot name="inline-actions"></slot>
                </div>

                <div class="action-grip-rail"  
                    @pointerenter=${t=>{t.pointerType==="mouse"&&(this._overlayActive=!0)}}
                    @click=${t=>{t.stopPropagation(),t.preventDefault(),this._overlayActive=!this._overlayActive}}>
                    <i data-lucide=${this._overlayActive?"chevron-right":"chevron-left"} style="width: 14px; height: 14px;"></i>
                </div>

                <div class="actions-tray" @click=${t=>{(t.target.tagName==="BUTTON"||t.target.closest("button")||t.target.tagName.includes("YENVUI")||t.target.tagName.includes("SUTRAM"))&&(this._overlayActive=!1)}}>
                    <span class="tray-caption">${this.titleText}</span>
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),window.lucide&&typeof window.lucide.createIcons=="function"&&window.lucide.createIcons({root:this.shadowRoot}),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}}customElements.define("yenvui-card",YenvuiCard);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmltcG9ydCB7IFllbnZ1aUdlc3R1cmVDb250cm9sbGVyIH0gZnJvbSAnLi9waHlzaWNzLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNhcmQgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGl0bGVUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxQcmVmaXg6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGRldGFpbFN1ZmZpeDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgc3RhbGU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGJsb2NrOyBtYXJnaW4tYm90dG9tOiB2YXIoLS1jYXJkLW1hcmdpbi1ib3R0b20sIDEycHgpOyBwb3NpdGlvbjogcmVsYXRpdmU7IHRvdWNoLWFjdGlvbjogcGFuLXggcGFuLXk7IH1cbiAgICAgICAgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctY2FyZCwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBib3JkZXItdG9wOiB2YXIoLS1jYXJkLWJvcmRlci10b3AsIDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogdmFyKC0tY2FyZC1ib3gtc2hhZG93LCAwIDFweCAzcHggcmdiYSgwLDAsMCwwLjA1KSk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzIGVhc2UsIGJvcmRlci1jb2xvciAwLjE1cyBlYXNlLCBib3gtc2hhZG93IDAuMTVzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgLyogU3dpdGNoIHRvIGVkZ2UtdG8tZWRnZSBmbHVzaCBtb2RlIHdoZW4gdGhlIGNvbnRhaW5lciBjb2x1bW4gYmVjb21lcyBuYXJyb3cgKi9cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICBib3JkZXItcmlnaHQtd2lkdGg6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLnNlbGVjdGlvbi1zdHJpcCB7XG4gICAgICAgICAgICB3aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWluLXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgb3BhY2l0eTogdmFyKC0tcGVlay1yYWlsLW9wYWNpdHksIDEpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2UsIGJvcmRlci1sZWZ0LXdpZHRoIDAuMTVzIGVhc2UsIGJveC1zaGFkb3cgMC4xNXMgZWFzZTtcbiAgICAgICAgfVxuICAgICAgICBAbWVkaWEgKGhvdmVyOiBob3Zlcikge1xuICAgICAgICAgICAgLnNlbGVjdGlvbi1zdHJpcDpob3ZlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDZweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5jYXJkLXdyYXBwZXI6aG92ZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyLWhvdmVyLCB2YXIoLS1pbnRlbnQtcHJpbWFyeSkpO1xuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWNhcmQtaG92ZXIsIHZhcigtLWJnLWhvdmVyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3NlbGVjdGVkXSkgLmNhcmQtd3JhcHBlcixcbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1jYXJkLXNlbGVjdGVkLCBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkgdmFyKC0taW50ZW50LWJnLW1peCwgMTUlKSwgdmFyKC0taW5wdXQtYmcpKSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyLWhpZ2hsaWdodCwgdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkpICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuc2VsZWN0aW9uLXN0cmlwIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItbGVmdC1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDJweCAwIDEwcHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNDUpO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW3N0YWxlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjY1O1xuICAgICAgICAgICAgZmlsdGVyOiBncmF5c2NhbGUoMC4zKTtcbiAgICAgICAgICAgIGJvcmRlci1zdHlsZTogZGFzaGVkO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2UsIGZpbHRlciAwLjNzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHg7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkodmFyKC0tcGVlay1jb250ZW50LXksIDBweCkpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXNjIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC44cmVtO1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XG4gICAgICAgICAgICAtd2Via2l0LWxpbmUtY2xhbXA6IDI7XG4gICAgICAgICAgICAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDRweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZmx1c2hdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKCopIHtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQocCksIDo6c2xvdHRlZChoMSksIDo6c2xvdHRlZChoMiksIDo6c2xvdHRlZChoMyksIDo6c2xvdHRlZChoNCksIDo6c2xvdHRlZChoNSksIDo6c2xvdHRlZChoNikge1xuICAgICAgICAgICAgbWFyZ2luLWJsb2NrLXN0YXJ0OiAwO1xuICAgICAgICAgICAgbWFyZ2luLWJsb2NrLWVuZDogMDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43cmVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgfVxuICAgICAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDQ4MHB4KSB7XG4gICAgICAgICAgICAuY2FyZC1kZXRhaWwtbWFpbiB7IGRpc3BsYXk6IG5vbmU7IH1cbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9uLWdyaXAtcmFpbCB7XG4gICAgICAgICAgICB3aWR0aDogMjZweDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcmFpbC1iZywgcmdiYSgyNTUsMjU1LDI1NSwwLjAyKSk7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBvcGFjaXR5OiB2YXIoLS1wZWVrLXJhaWwtb3BhY2l0eSwgMSk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuM3MgZWFzZSwgYmFja2dyb3VuZCAwLjE1cyBlYXNlLCBjb2xvciAwLjE1cyBlYXNlO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtoYXMtYWN0aW9uc10pIC5hY3Rpb24tZ3JpcC1yYWlsIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbi1ncmlwLXJhaWw6aG92ZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcmFpbC1ob3ZlciwgcmdiYSg5OSwgMTAyLCAyNDEsIDAuMjIpKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICByaWdodDogMjZweDtcbiAgICAgICAgICAgIHRvcDogMDtcbiAgICAgICAgICAgIGJvdHRvbTogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWNhcmQsIHZhcigtLWlucHV0LWJnKSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYmctY2FyZCwgdmFyKC0taW5wdXQtYmcpKSA5NCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cig4cHgpO1xuICAgICAgICAgICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IGJsdXIoOHB4KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA1cHg7XG4gICAgICAgICAgICBwYWRkaW5nOiA0cHggOHB4O1xuICAgICAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEwcHgpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjJzIGN1YmljLWJlemllcigwLjE2LCAxLCAwLjMsIDEpLCB0cmFuc2Zvcm0gMC4ycyBjdWJpYy1iZXppZXIoMC4xNiwgMSwgMC4zLCAxKTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXdyYXBwZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICAgICAgICAgIGdhcDogNnB4O1xuICAgICAgICAgICAgb3ZlcmZsb3cteDogYXV0bztcbiAgICAgICAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyOjotd2Via2l0LXNjcm9sbGJhciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXdyYXBwZXI6OmJlZm9yZSwgLmFjdGlvbnMtd3JhcHBlcjo6YWZ0ZXIge1xuICAgICAgICAgICAgY29udGVudDogJyc7IG1hcmdpbjogYXV0bztcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgb3BhY2l0eTogMTtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBhdXRvO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApO1xuICAgICAgICB9XG4gICAgICAgIC50cmF5LWNhcHRpb24ge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjY1cmVtO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8sIG1vbm9zcGFjZSk7XG4gICAgICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xuICAgICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA5MCU7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBVbnN0eWxlZCBzbG90cyBmb3IgaG9zdC1pbmplY3RlZCBidXR0b25zICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b24pLCA6OnNsb3R0ZWQoc3V0cmFtLWFzeW5jLWJ0bikge1xuICAgICAgICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMCAxMHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNzVyZW0gIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA1cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBmaWx0ZXIgMC4xNXMgZWFzZSwgdHJhbnNmb3JtIDAuMXMgZWFzZTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uOmhvdmVyKSB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4xMik7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBFLUluayBIaWdoIENvbnRyYXN0IE92ZXJyaWRlcyAqL1xuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsICM4YjVjZjYpICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAzcHggNHB4IDAgIzE0YjhhNiAhaW1wb3J0YW50OyAvKiBDb2xvcmZ1bCBUZWFsIEJvdHRvbSBTaGFkb3cgKi9cbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKTpob3N0KFtzZWxlY3RlZF0pIC5jYXJkLXdyYXBwZXIsXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSk6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNlYzQ4OTkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDNweCA0cHggMCAjZWFiMzA4ICFpbXBvcnRhbnQ7IC8qIFllbGxvdyBCb3R0b20gU2hhZG93IG9uIFNlbGVjdGVkICovXG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5zZWxlY3Rpb24tc3RyaXAge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDVweCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSk6aG9zdChbc2VsZWN0ZWRdKSAuc2VsZWN0aW9uLXN0cmlwLFxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLnNlbGVjdGlvbi1zdHJpcCB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtY29sb3I6ICNlYzQ4OTkgIWltcG9ydGFudDsgLyogSG90IFBpbmsgdGhpY2sgc2xhYiAqL1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9uLWdyaXAtcmFpbCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjOGI1Y2Y2ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogMnB4IHNvbGlkICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKTpob3N0KFtzZWxlY3RlZF0pIC5hY3Rpb24tZ3JpcC1yYWlsLFxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmFjdGlvbi1ncmlwLXJhaWwge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2VjNDg5OSAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogMnB4IHNvbGlkICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnRyYXktY2FwdGlvbixcbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG9wYWNpdHk6IDEgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIC0tLSBDb21wYWN0IE1vZGUgVmFyaWFudCAtLS0gKi9cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY29udGVudC1jb2wge1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWhlYWRlciB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGVzYyxcbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgcGFkZGluZzogMCAwIDAgMTBweDtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9nZXN0dXJlQ29udHJvbGxlciA9IG5ldyBZZW52dWlHZXN0dXJlQ29udHJvbGxlcih0aGlzLCB7XG4gICAgICAgICAgICBzY3JvbGxhYmxlQ29udGFpbmVyU2VsZWN0b3I6ICdhY3Rpb25zLXdyYXBwZXInLFxuICAgICAgICAgICAgb25QYW5TdGFydDogKHN0YXJ0WCwgc3RhcnRZKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FyZFdpZHRoID0gcmVjdC53aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbFN0YXJ0WCA9IHN0YXJ0WCAtIHJlY3QubGVmdDtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb25zLXdyYXBwZXInKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCA9IHdyYXBwZXIgPyB3cmFwcGVyLnNjcm9sbExlZnQgOiBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uUGFuRW5kOiAoZW5kWCwgZW5kWSwgYXhpcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChheGlzICE9PSAnaG9yaXpvbnRhbCcpIHJldHVybjtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX2dlc3R1cmVDb250cm9sbGVyLnN0YXJ0WCAtIGVuZFg7XG5cbiAgICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IDMwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVmdFN3aXBlID0gZGVsdGFYID4gMzA7ICAgLy8gUmlnaHQtdG8tTGVmdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JpZ2h0U3dpcGUgPSBkZWx0YVggPCAtMzA7IC8vIExlZnQtdG8tUmlnaHRcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0xlZnRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPCBNYXRoLm1heCgodGhpcy5fY2FyZFdpZHRoICogMC4yNSksIDcwKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNMZWZ0U2lkZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmlnaHRTd2lwZSAmJiAhdGhpcy5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5faGFzQWN0aW9ucyB8fCAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0xlZnRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzUmlnaHRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgIT09IG51bGwgJiYgdGhpcy5fYWN0aW9uc1Njcm9sbExlZnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIGlzIHNjcm9sbGluZyB0aGUgYnV0dG9ucyBiYWNrIHRvIHRoZSBzdGFydDsgZG9uJ3QgY2xvc2UgdGhlIGRyYXdlciB5ZXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kZXRhaWwuc291cmNlICE9PSB0aGlzICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbnRhaW5zKGUucmVsYXRlZFRhcmdldCkgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5yZWdpc3Rlck91dHNpZGVDbGljaygoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2VsZi1IZWFsaW5nIFdyYXBwZXI6IFJlc2V0IHRyYW5zaWVudCBvdmVybGF5IHN0YXRlIGlmIExpdCByZWN5Y2xlcyB0aGUgRE9NIG5vZGUgZm9yIGEgbmV3IGl0ZW1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZW50aXR5RGF0YScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZmlsZW5hbWUnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RpdGxlVGV4dCcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF90b2dnbGVTZWxlY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSAhdGhpcy5zZWxlY3RlZDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IHRoaXMuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGZpcnN0VXBkYXRlZCgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgX2NoZWNrQWN0aW9ucygpIHtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdzbG90W25hbWU9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIGlmIChzbG90KSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHNsb3QuYXNzaWduZWRFbGVtZW50cyh7IGZsYXR0ZW46IHRydWUgfSk7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZWxlbWVudHMubGVuZ3RoID4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlU2xvdENoYW5nZShlKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtd3JhcHBlclwiIHN0eWxlPVwiLS1jYXJkLWludGVudDogJHt0aGlzLmludGVudENvbG9yIHx8ICd2YXIoLS1pbnRlbnQtbmV1dHJhbCknfVwiXG4gICAgICAgICAgICAgICAgQG1vdXNlbGVhdmU9JHsoKSA9PiB7IGlmICh3aW5kb3cubWF0Y2hNZWRpYSgnKGhvdmVyOiBob3ZlciknKS5tYXRjaGVzKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7IH19XG4gICAgICAgICAgICAgICAgQHBvaW50ZXJkb3duPSR7KGUpID0+IHRoaXMuX2dlc3R1cmVDb250cm9sbGVyLnN0YXJ0KGUpfT5cblxuICAgICAgICAgICAgICAgICR7IXRoaXMuZGlzYWJsZVNlbGVjdGlvbiA/IGh0bWxgPGRpdiBjbGFzcz1cInNlbGVjdGlvbi1zdHJpcFwiIHRpdGxlPVwiU2VsZWN0IEl0ZW1cIiBAY2xpY2s9JHsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTsgfX0+PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbFwiIEBjbGljaz0keyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLWNsaWNrZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IHsgZmlsZW5hbWU6IHRoaXMuZmlsZW5hbWUsIGlzU291cmNlOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH19IHN0eWxlPVwiY3Vyc29yOiBwb2ludGVyOyBwYWRkaW5nOiAxMnB4OyBtaW4td2lkdGg6IDA7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWhlYWRlclwiIHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogZmxleC1zdGFydDsgbWFyZ2luLWJvdHRvbTogNHB4OyBnYXA6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXRpdGxlXCIgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDZweDsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiB2YXIoLS10ZXh0KTsgZm9udC1zaXplOiAwLjg1cmVtOyBtaW4td2lkdGg6IDA7IG92ZXJmbG93OiBoaWRkZW47XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmljb24gJiYgdGhpcy5pY29uLnN0YXJ0c1dpdGgoJzxpJykgPyBodG1sYDxkaXYgc3R5bGU9XCJmbGV4LXNocmluazogMDtcIiAuaW5uZXJIVE1MPSR7dGhpcy5pY29ufT48L2Rpdj5gIDogKHRoaXMuaWNvbiA/IGh0bWxgPHNwYW4gc3R5bGU9XCJmbGV4LXNocmluazogMDtcIj4ke3RoaXMuaWNvbn08L3NwYW4+YCA6ICcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cIndoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1wiPiR7dGhpcy50aXRsZVRleHR9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJoZWFkZXItYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsU3VmZml4ID8gaHRtbGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtZGV0YWlsLXN1ZmZpeFwiIHN0eWxlPVwiZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubyk7IGZvbnQtc2l6ZTogMTBweDsgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpOyBvcGFjaXR5OiAwLjg7IGZsZXgtc2hyaW5rOiAwOyBtYXJnaW4tbGVmdDogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFN1ZmZpeC5yZXBsYWNlKC9eW1xcc3xdKy8sICcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHQgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtZGVzY1wiIHN0eWxlPVwiZm9udC1zaXplOiAxMXB4OyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IG1hcmdpbi1ib3R0b206IDRweDsgZGlzcGxheTogLXdlYmtpdC1ib3g7IC13ZWJraXQtbGluZS1jbGFtcDogMjsgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDsgb3ZlcmZsb3c6IGhpZGRlbjtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGVzY3JpcHRpb25UZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIGAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFRleHQgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtZGV0YWlsXCIgc3R5bGU9XCJmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTsgZm9udC1zaXplOiAxMHB4OyBjb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSk7IG9wYWNpdHk6IDAuODsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgb3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRldGFpbFByZWZpeCB8fCAnJ30ke3RoaXMuZGV0YWlsVGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiZGV0YWlsXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiaW5saW5lLWFjdGlvbnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWdyaXAtcmFpbFwiICBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLl9vdmVybGF5QWN0aXZlID0gIXRoaXMuX292ZXJsYXlBY3RpdmU7IH19PlxuICAgICAgICAgICAgICAgICAgICA8aSBkYXRhLWx1Y2lkZT0ke3RoaXMuX292ZXJsYXlBY3RpdmUgPyBcImNoZXZyb24tcmlnaHRcIiA6IFwiY2hldnJvbi1sZWZ0XCJ9IHN0eWxlPVwid2lkdGg6IDE0cHg7IGhlaWdodDogMTRweDtcIj48L2k+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9ucy10cmF5XCIgQGNsaWNrPSR7KGUpID0+IHsgaWYoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uJykgfHwgZS50YXJnZXQudGFnTmFtZS5pbmNsdWRlcygnWUVOVlVJJykgfHwgZS50YXJnZXQudGFnTmFtZS5pbmNsdWRlcygnU1VUUkFNJykpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJheS1jYXB0aW9uXCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25zXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxuXG4gICAgdXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcykge1xuICAgICAgICBzdXBlci51cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnX292ZXJsYXlBY3RpdmUnKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB7XG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkZXRhaWw6IHsgc291cmNlOiB0aGlzIH1cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluaXRpYWxpemUgTHVjaWRlIGljb25zIGlmIHRoZXkgZXhpc3QgaW4gdGhlIHJlbmRlcmVkIHNoYWRvdyBkb21cbiAgICAgICAgaWYgKHdpbmRvdy5sdWNpZGUgJiYgdHlwZW9mIHdpbmRvdy5sdWNpZGUuY3JlYXRlSWNvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHdpbmRvdy5sdWNpZGUuY3JlYXRlSWNvbnMoeyByb290OiB0aGlzLnNoYWRvd1Jvb3QgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxmLUhlYWxpbmcgV3JhcHBlcjogUmVzZXQgdHJhbnNpZW50IG92ZXJsYXkgc3RhdGUgaWYgTGl0IHJlY3ljbGVzIHRoZSBET00gbm9kZSBmb3IgYSBuZXcgaXRlbVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdlbnRpdHlEYXRhJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdmaWxlbmFtZScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygndGl0bGVUZXh0JykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY2FyZCcsIFllbnZ1aUNhcmQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFDM0IsT0FBUywyQkFBQUMsTUFBK0IsZUFFakMsYUFBTSxtQkFBbUJELENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsZ0JBQWlCLENBQUUsS0FBTSxNQUFPLEVBQ2hDLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN0QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWdVaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLGVBQWlCLEdBQ3RCLEtBQUssWUFBYyxHQUNuQixLQUFLLFNBQVcsR0FFaEIsS0FBSyxtQkFBcUIsSUFBSUUsRUFBd0IsS0FBTSxDQUN4RCw0QkFBNkIsa0JBQzdCLFdBQVksQ0FBQ0MsRUFBUUMsSUFBVyxDQUM1QixNQUFNQyxFQUFPLEtBQUssc0JBQXNCLEVBQ3hDLEtBQUssV0FBYUEsRUFBSyxNQUN2QixLQUFLLGFBQWVGLEVBQVNFLEVBQUssS0FDbEMsTUFBTUMsRUFBVSxLQUFLLFdBQVcsY0FBYyxrQkFBa0IsRUFDaEUsS0FBSyxtQkFBcUJBLEVBQVVBLEVBQVEsV0FBYSxJQUM3RCxFQUNBLFNBQVUsQ0FBQ0MsRUFBTUMsRUFBTUMsSUFBUyxDQUM1QixHQUFJQSxJQUFTLGFBQWMsT0FFM0IsTUFBTUMsRUFBUyxLQUFLLG1CQUFtQixPQUFTSCxFQUVoRCxHQUFJLEtBQUssSUFBSUcsQ0FBTSxFQUFJLEdBQUksQ0FDdkIsTUFBTUMsRUFBY0QsRUFBUyxHQUN2QkUsRUFBZUYsRUFBUyxJQUVYLEtBQUssYUFBZSxLQUFLLElBQUssS0FBSyxXQUFhLElBQU8sRUFBRSxFQUdwRUUsR0FBZ0IsQ0FBQyxLQUFLLGtCQUN0QixLQUFLLGlCQUFpQixHQUdQLEtBQUssYUFBaUIsS0FBSyxjQUFjLGtCQUFrQixLQUV0RUQsRUFDQSxLQUFLLGVBQWlCLEdBQ2ZDLElBQ0gsS0FBSyxxQkFBdUIsTUFBUSxLQUFLLG1CQUFxQixJQUc5RCxLQUFLLGVBQWlCLEtBSzFDLENBQ0osQ0FDSixDQUFDLEVBQ0QsS0FBSyxpQkFBb0JDLEdBQU0sQ0FDdkJBLEVBQUUsT0FBTyxTQUFXLE1BQVEsS0FBSyxpQkFDakMsS0FBSyxlQUFpQixHQUU5QixFQUNBLEtBQUssa0JBQXFCQSxHQUFNLENBQ3hCLENBQUMsS0FBSyxTQUFTQSxFQUFFLGFBQWEsR0FBSyxLQUFLLGlCQUN4QyxLQUFLLGVBQWlCLEdBRTlCLENBQ0osQ0FDQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxpQkFBaUIsV0FBWSxLQUFLLGlCQUFpQixFQUN4RCxTQUFTLGlCQUFpQix3QkFBeUIsS0FBSyxnQkFBZ0IsRUFDeEUsS0FBSyxxQkFBcUIsSUFBTSxDQUN4QixLQUFLLGlCQUFnQixLQUFLLGVBQWlCLEdBQ25ELENBQUMsQ0FDTCxDQUVBLHNCQUF1QixDQUNuQixNQUFNLHFCQUFxQixFQUMzQixLQUFLLG9CQUFvQixXQUFZLEtBQUssaUJBQWlCLEVBQzNELFNBQVMsb0JBQW9CLHdCQUF5QixLQUFLLGdCQUFnQixDQUMvRSxDQUNBLFFBQVFDLEVBQW1CLENBQ3ZCLE1BQU0sUUFBUUEsQ0FBaUIsRUFDM0JBLEVBQWtCLElBQUksZ0JBQWdCLEdBQUssS0FBSyxnQkFDaEQsS0FBSyxjQUFjLElBQUksWUFBWSx3QkFBeUIsQ0FDeEQsUUFBUyxHQUNULFNBQVUsR0FDVixPQUFRLENBQUUsT0FBUSxJQUFLLENBQzNCLENBQUMsQ0FBQyxHQUlGQSxFQUFrQixJQUFJLFlBQVksR0FBS0EsRUFBa0IsSUFBSSxVQUFVLEdBQUtBLEVBQWtCLElBQUksV0FBVyxJQUN6RyxLQUFLLGlCQUNMLEtBQUssZUFBaUIsR0FHbEMsQ0FFQSxrQkFBbUIsQ0FDZixLQUFLLFNBQVcsQ0FBQyxLQUFLLFNBQ3RCLEtBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxTQUFVLEtBQUssUUFBUyxFQUNsQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQ0EsY0FBZSxDQUNYLEtBQUssY0FBYyxDQUN2QixDQUVBLGVBQWdCLENBQ1osTUFBTUMsRUFBTyxLQUFLLFdBQVcsY0FBYyxzQkFBc0IsRUFDakUsR0FBSUEsRUFBTSxDQUNOLE1BQU1DLEVBQVdELEVBQUssaUJBQWlCLENBQUUsUUFBUyxFQUFLLENBQUMsRUFDeEQsS0FBSyxZQUFjQyxFQUFTLE9BQVMsQ0FDekMsTUFDSSxLQUFLLFlBQWMsQ0FBQyxDQUFDLEtBQUssY0FBYyxrQkFBa0IsQ0FFbEUsQ0FFQSxrQkFBa0JILEVBQUcsQ0FDakIsS0FBSyxjQUFjLENBQ3ZCLENBQ0EsUUFBUyxDQUNMLE9BQU9kO0FBQUEsOERBQytDLEtBQUssYUFBZSx1QkFBdUI7QUFBQSw4QkFDM0UsSUFBTSxDQUFNLE9BQU8sV0FBVyxnQkFBZ0IsRUFBRSxVQUFTLEtBQUssZUFBaUIsR0FBTyxDQUFDO0FBQUEsK0JBQ3JGYyxHQUFNLEtBQUssbUJBQW1CLE1BQU1BLENBQUMsQ0FBQztBQUFBO0FBQUEsa0JBRW5ELEtBQUssaUJBQXNKLEdBQW5JZCw0REFBZ0VjLEdBQU0sQ0FBRUEsRUFBRSxnQkFBZ0IsRUFBRyxLQUFLLGlCQUFpQixDQUFHLENBQUMsU0FBYztBQUFBLGtEQUM3SEEsR0FBTSxDQUNyQyxLQUFLLGNBQWMsSUFBSSxZQUFZLHNCQUF1QixDQUN0RCxPQUFRLENBQUUsU0FBVSxLQUFLLFNBQVUsU0FBVSxFQUFLLEVBQ2xELFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sQ0FBQztBQUFBO0FBQUE7QUFBQSw4QkFHYSxLQUFLLE1BQVEsS0FBSyxLQUFLLFdBQVcsSUFBSSxFQUFJZCw0Q0FBK0MsS0FBSyxJQUFJLFVBQWEsS0FBSyxLQUFPQSxrQ0FBcUMsS0FBSyxJQUFJLFVBQVksRUFBRztBQUFBLDRHQUMxRyxLQUFLLFNBQVM7QUFBQTtBQUFBO0FBQUE7QUFBQSw4QkFJNUYsS0FBSyxhQUFlQTtBQUFBO0FBQUEsc0NBRVosS0FBSyxhQUFhLFFBQVEsVUFBVyxFQUFFLENBQUM7QUFBQTtBQUFBLDhCQUU5QyxFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBSVosS0FBSyxnQkFBa0JBO0FBQUE7QUFBQSw4QkFFZixLQUFLLGVBQWU7QUFBQTtBQUFBLHNCQUUxQixFQUFFO0FBQUEsc0JBQ0osS0FBSyxXQUFhQTtBQUFBO0FBQUEsOEJBRVYsS0FBSyxjQUFnQixFQUFFLEdBQUcsS0FBSyxVQUFVO0FBQUE7QUFBQSxzQkFFL0MsRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsb0NBV1djLEdBQU0sQ0FBTUEsRUFBRSxjQUFnQixVQUFTLEtBQUssZUFBaUIsR0FBTSxDQUFDO0FBQUEsNkJBQzNFQSxHQUFNLENBQUVBLEVBQUUsZ0JBQWdCLEVBQUdBLEVBQUUsZUFBZSxFQUFHLEtBQUssZUFBaUIsQ0FBQyxLQUFLLGNBQWdCLENBQUM7QUFBQSxxQ0FDdkYsS0FBSyxlQUFpQixnQkFBa0IsY0FBYztBQUFBO0FBQUE7QUFBQSxtREFHdkNBLEdBQU0sRUFBS0EsRUFBRSxPQUFPLFVBQVksVUFBWUEsRUFBRSxPQUFPLFFBQVEsUUFBUSxHQUFLQSxFQUFFLE9BQU8sUUFBUSxTQUFTLFFBQVEsR0FBS0EsRUFBRSxPQUFPLFFBQVEsU0FBUyxRQUFRLEtBQUcsS0FBSyxlQUFpQixHQUFPLENBQUM7QUFBQSxpREFDdkwsS0FBSyxTQUFTO0FBQUE7QUFBQSwyREFFSixLQUFLLGlCQUFpQjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBSzdFLENBRUEsUUFBUUMsRUFBbUIsQ0FDdkIsTUFBTSxRQUFRQSxDQUFpQixFQUMzQkEsRUFBa0IsSUFBSSxnQkFBZ0IsR0FBSyxLQUFLLGdCQUNoRCxLQUFLLGNBQWMsSUFBSSxZQUFZLHdCQUF5QixDQUN4RCxRQUFTLEdBQ1QsU0FBVSxHQUNWLE9BQVEsQ0FBRSxPQUFRLElBQUssQ0FDM0IsQ0FBQyxDQUFDLEVBSUYsT0FBTyxRQUFVLE9BQU8sT0FBTyxPQUFPLGFBQWdCLFlBQ3RELE9BQU8sT0FBTyxZQUFZLENBQUUsS0FBTSxLQUFLLFVBQVcsQ0FBQyxHQUluREEsRUFBa0IsSUFBSSxZQUFZLEdBQUtBLEVBQWtCLElBQUksVUFBVSxHQUFLQSxFQUFrQixJQUFJLFdBQVcsSUFDekcsS0FBSyxpQkFDTCxLQUFLLGVBQWlCLEdBR2xDLENBQ0osQ0FDQSxlQUFlLE9BQU8sY0FBZSxVQUFVIiwKICAibmFtZXMiOiBbImh0bWwiLCAiY3NzIiwgIlllbnZ1aUJhc2UiLCAiWWVudnVpR2VzdHVyZUNvbnRyb2xsZXIiLCAic3RhcnRYIiwgInN0YXJ0WSIsICJyZWN0IiwgIndyYXBwZXIiLCAiZW5kWCIsICJlbmRZIiwgImF4aXMiLCAiZGVsdGFYIiwgImlzTGVmdFN3aXBlIiwgImlzUmlnaHRTd2lwZSIsICJlIiwgImNoYW5nZWRQcm9wZXJ0aWVzIiwgInNsb3QiLCAiZWxlbWVudHMiXQp9Cg==
