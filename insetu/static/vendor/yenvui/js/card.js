import{html as s,css as c}from"lit";import{YenvuiBase as d}from"./yenvui-base.js";import{YenvuiGestureController as p}from"./physics.js";export class YenvuiCard extends d{static properties={titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},stale:{type:Boolean,reflect:!0}};static styles=c`
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
            overflow: visible;
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
                border-bottom-width: 1px !important;
                border-bottom-style: solid !important;
            }
            .selection-strip {
                border-radius: 0 !important;
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
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 8px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 8px));
            opacity: var(--peek-rail-opacity, 1);
            transition: opacity 0.3s ease, border-left-width 0.15s ease, box-shadow 0.15s ease;
        }
        @media (hover: hover) {
            .selection-strip:hover {
                border-left-width: 6px;
            }
            .card-wrapper:hover {
                border-color: var(--border-hover, var(--card-intent, var(--intent-primary)));
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
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 8px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 8px));
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
        .action-grip-rail i { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        :host([_overlayactive]) .action-grip-rail i { transform: rotate(180deg); }
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
            overflow: hidden;
            border-top-right-radius: var(--card-border-top-right-radius, var(--card-border-radius, 8px));
            border-bottom-right-radius: var(--card-border-bottom-right-radius, var(--card-border-radius, 8px));
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
            margin: 0;
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
        .selection-hit-zone {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 30px;
            z-index: 5;
            cursor: pointer;
        }
        :host([_overlayactive]) .selection-hit-zone {
            display: none;
        }
        @media (hover: hover) {
            .selection-hit-zone:hover + .selection-strip {
                border-left-width: 6px;
            }
        }
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this.selected=!1,this._gestureController=new p(this,{scrollableContainerSelector:"actions-wrapper",onPanStart:(t,i)=>{const a=this.getBoundingClientRect();this._cardWidth=a.width,this._localStartX=t-a.left;const r=this.shadowRoot.querySelector(".actions-wrapper");this._actionsScrollLeft=r?r.scrollLeft:null,this._initialScrollLeft=this._actionsScrollLeft},onPanMove:(t,i,a)=>{if(a==="horizontal"&&this._overlayActive){const r=this._gestureController.startX-t,o=this.shadowRoot.querySelector(".actions-wrapper");if(o&&this._initialScrollLeft!==null){let e=this._initialScrollLeft+r;this._drawerRafId&&cancelAnimationFrame(this._drawerRafId),this._drawerRafId=requestAnimationFrame(()=>{e<0?o.style.transform=`translateX(${Math.abs(e)*.4}px)`:(o.style.transform="translateX(0px)",o.scrollLeft=e)})}}},onPanEnd:(t,i,a)=>{if(a!=="horizontal")return;const r=this._gestureController.startX-t;if(Math.abs(r)>10&&(this._isPanning=!0,setTimeout(()=>this._isPanning=!1,150)),this._overlayActive){const o=this.shadowRoot.querySelector(".actions-wrapper");o&&(o.style.transition="transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",o.style.transform="translateX(0px)",setTimeout(()=>{o.style.transition=""},200),this._initialScrollLeft+r<-(this._cardWidth*.2)&&(this._overlayActive=!1));return}if(Math.abs(r)>30){const o=r>30,e=r<-30,n=this._localStartX<this._cardWidth*.3,l=this._localStartX>this._cardWidth*.7;n&&e&&!this.disableSelection?this._toggleSelection():l&&o&&(this._hasActions||this.querySelector('[slot="actions"]'))&&(this._overlayActive=!0)}}}),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this.registerOutsideClick(()=>{this._overlayActive&&(this._overlayActive=!1)})}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._gestureController&&typeof this._gestureController.abort=="function"&&this._gestureController.abort()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const i=t.assignedElements({flatten:!0});this._hasActions=i.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){return s`
            <div class="card-wrapper" style="--card-intent: ${this.intentColor||"var(--intent-neutral)"}"
                @mouseleave=${()=>{window.matchMedia("(hover: hover)").matches&&!this._gestureController.active&&(this._overlayActive=!1)}}
                @pointerdown=${t=>this._gestureController.start(t)}>

                ${this.disableSelection?"":s`<div class="selection-hit-zone" title="Select Item" @click=${t=>{t.stopPropagation(),this._toggleSelection()}}></div><div class="selection-strip"></div>`}
                <div class="content-col" @click=${t=>{this.dispatchEvent(new CustomEvent("yenvui-card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))}} style="cursor: pointer; padding: 12px; min-width: 0;">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; gap: 8px;">
                        <div class="card-title" style="display: flex; align-items: center; gap: 6px; font-weight: bold; color: var(--text); font-size: 0.85rem; min-width: 0; overflow: hidden;">
                            ${this.icon&&this.icon.startsWith("<i")?s`<div style="flex-shrink: 0;" .innerHTML=${this.icon}></div>`:this.icon?s`<span style="flex-shrink: 0;">${this.icon}</span>`:""}
                            <yenvui-scrub-track style="flex: 1; min-width: 0;">
                                ${this.titleText}
                            </yenvui-scrub-track>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <slot name="header-actions"></slot>
                            ${this.detailSuffix?s`
                                <div class="card-detail-suffix" style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); opacity: 0.8; flex-shrink: 0; margin-left: 8px;">
                                    ${this.detailSuffix.replace(/^[\s|]+/,"")}
                                </div>
                            `:""}
                        </div>
                    </div>

                    ${this.descriptionText?s`
                        <div class="card-desc" style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${this.descriptionText}
                        </div>
                    `:""}
                    ${this.detailText?s`
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
                    <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>
                </div>
                <div class="actions-tray" @click=${{handleEvent:t=>{if(this._isPanning){t.stopPropagation(),t.preventDefault();return}const i=t.composedPath?t.composedPath():[],a=i.some(e=>e.tagName==="SUTRAM-DROPDOWN"||e.tagName==="YENVUI-DROPDOWN"),r=i.some(e=>e.classList&&e.classList.contains("menu-item"));if(a&&!r)return;i.some(e=>{if(!e.tagName)return!1;const n=e.tagName.toUpperCase();return!!(n==="BUTTON"||n==="SUTRAM-ASYNC-BTN"||n==="YENVUI-ASYNC-BTN"||r)})&&(this._overlayActive=!1)},capture:!0}}>
                    <span class="tray-caption">${this.titleText}</span>
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),window.lucide&&typeof window.lucide.createIcons=="function"&&window.lucide.createIcons({root:this.shadowRoot}),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}}customElements.define("yenvui-card",YenvuiCard);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmltcG9ydCB7IFllbnZ1aUdlc3R1cmVDb250cm9sbGVyIH0gZnJvbSAnLi9waHlzaWNzLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNhcmQgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGl0bGVUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxQcmVmaXg6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGRldGFpbFN1ZmZpeDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgc2VsZWN0ZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBkaXNhYmxlU2VsZWN0aW9uOiB7IHR5cGU6IEJvb2xlYW4gfSxcbiAgICAgICAgX292ZXJsYXlBY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzQWN0aW9uczogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlLCBhdHRyaWJ1dGU6ICdoYXMtYWN0aW9ucycgfSxcbiAgICAgICAgY29tcGFjdDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgc3RhbGU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGJsb2NrOyBtYXJnaW4tYm90dG9tOiB2YXIoLS1jYXJkLW1hcmdpbi1ib3R0b20sIDEycHgpOyBwb3NpdGlvbjogcmVsYXRpdmU7IHRvdWNoLWFjdGlvbjogcGFuLXggcGFuLXk7IH1cbiAgICAgICAgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICB0b3VjaC1hY3Rpb246IHBhbi14IHBhbi15O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctY2FyZCwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBib3JkZXItdG9wOiB2YXIoLS1jYXJkLWJvcmRlci10b3AsIDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBvdmVyZmxvdzogdmlzaWJsZTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNhcmQtYm94LXNoYWRvdywgMCAxcHggM3B4IHJnYmEoMCwwLDAsMC4wNSkpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cyBlYXNlLCBib3JkZXItY29sb3IgMC4xNXMgZWFzZSwgYm94LXNoYWRvdyAwLjE1cyBlYXNlO1xuICAgICAgICB9XG4gICAgICAgIC8qIFN3aXRjaCB0byBlZGdlLXRvLWVkZ2UgZmx1c2ggbW9kZSB3aGVuIHRoZSBjb250YWluZXIgY29sdW1uIGJlY29tZXMgbmFycm93ICovXG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNDgwcHgpIHtcbiAgICAgICAgICAgIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJpZ2h0LXdpZHRoOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICBib3JkZXItYm90dG9tLXdpZHRoOiAxcHggIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICBib3JkZXItYm90dG9tLXN0eWxlOiBzb2xpZCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLnNlbGVjdGlvbi1zdHJpcCB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC5zZWxlY3Rpb24tc3RyaXAge1xuICAgICAgICAgICAgd2lkdGg6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiA0cHggc29saWQgdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSk7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIG9wYWNpdHk6IHZhcigtLXBlZWstcmFpbC1vcGFjaXR5LCAxKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4zcyBlYXNlLCBib3JkZXItbGVmdC13aWR0aCAwLjE1cyBlYXNlLCBib3gtc2hhZG93IDAuMTVzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgQG1lZGlhIChob3ZlcjogaG92ZXIpIHtcbiAgICAgICAgICAgIC5zZWxlY3Rpb24tc3RyaXA6aG92ZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiA2cHg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuY2FyZC13cmFwcGVyOmhvdmVyIHtcbiAgICAgICAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlci1ob3ZlciwgdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkpO1xuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWNhcmQtaG92ZXIsIHZhcigtLWJnLWhvdmVyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3NlbGVjdGVkXSkgLmNhcmQtd3JhcHBlcixcbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1jYXJkLXNlbGVjdGVkLCBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkgdmFyKC0taW50ZW50LWJnLW1peCwgMTUlKSwgdmFyKC0taW5wdXQtYmcpKSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyLWhpZ2hsaWdodCwgdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkpICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuc2VsZWN0aW9uLXN0cmlwIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItbGVmdC1jb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSkgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDJweCAwIDEwcHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNDUpO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW3N0YWxlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjY1O1xuICAgICAgICAgICAgZmlsdGVyOiBncmF5c2NhbGUoMC4zKTtcbiAgICAgICAgICAgIGJvcmRlci1zdHlsZTogZGFzaGVkO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2UsIGZpbHRlciAwLjNzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHg7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkodmFyKC0tcGVlay1jb250ZW50LXksIDBweCkpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xuICAgICAgICB9XG4gICAgICAgIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXNjIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC44cmVtO1xuICAgICAgICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XG4gICAgICAgICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XG4gICAgICAgICAgICAtd2Via2l0LWxpbmUtY2xhbXA6IDI7XG4gICAgICAgICAgICAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDRweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZmx1c2hdKSAuY2FyZC1ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKCopIHtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQocCksIDo6c2xvdHRlZChoMSksIDo6c2xvdHRlZChoMiksIDo6c2xvdHRlZChoMyksIDo6c2xvdHRlZChoNCksIDo6c2xvdHRlZChoNSksIDo6c2xvdHRlZChoNikge1xuICAgICAgICAgICAgbWFyZ2luLWJsb2NrLXN0YXJ0OiAwO1xuICAgICAgICAgICAgbWFyZ2luLWJsb2NrLWVuZDogMDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC1kZXRhaWwge1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43cmVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgfVxuICAgICAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDQ4MHB4KSB7XG4gICAgICAgICAgICAuY2FyZC1kZXRhaWwtbWFpbiB7IGRpc3BsYXk6IG5vbmU7IH1cbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9uLWdyaXAtcmFpbCB7XG4gICAgICAgICAgICB3aWR0aDogMjZweDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcmFpbC1iZywgcmdiYSgyNTUsMjU1LDI1NSwwLjAyKSk7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICAgICAgb3BhY2l0eTogdmFyKC0tcGVlay1yYWlsLW9wYWNpdHksIDEpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2UsIGJhY2tncm91bmQgMC4xNXMgZWFzZSwgY29sb3IgMC4xNXMgZWFzZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbaGFzLWFjdGlvbnNdKSAuYWN0aW9uLWdyaXAtcmFpbCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb24tZ3JpcC1yYWlsIGkgeyB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBjdWJpYy1iZXppZXIoMC4xNiwgMSwgMC4zLCAxKTsgfVxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9uLWdyaXAtcmFpbCBpIHsgdHJhbnNmb3JtOiByb3RhdGUoMTgwZGVnKTsgfVxuICAgICAgICAuYWN0aW9uLWdyaXAtcmFpbDpob3ZlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1yYWlsLWhvdmVyLCByZ2JhKDk5LCAxMDIsIDI0MSwgMC4yMikpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgICAgbGVmdDogMDtcbiAgICAgICAgICAgIHJpZ2h0OiAyNnB4O1xuICAgICAgICAgICAgdG9wOiAwO1xuICAgICAgICAgICAgYm90dG9tOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctY2FyZCwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1iZy1jYXJkLCB2YXIoLS1pbnB1dC1iZykpIDk0JSwgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDhweCk7XG4gICAgICAgICAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjogYmx1cig4cHgpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDVweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDRweCA4cHg7XG4gICAgICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMTBweCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMnMgY3ViaWMtYmV6aWVyKDAuMTYsIDEsIDAuMywgMSksIHRyYW5zZm9ybSAwLjJzIGN1YmljLWJlemllcigwLjE2LCAxLCAwLjMsIDEpO1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgICAgICAgICBnYXA6IDZweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXg6IGF1dG87XG4gICAgICAgICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy13cmFwcGVyOjpiZWZvcmUsIC5hY3Rpb25zLXdyYXBwZXI6OmFmdGVyIHtcbiAgICAgICAgICAgIGNvbnRlbnQ6ICcnOyBtYXJnaW46IGF1dG87XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgwKTtcbiAgICAgICAgfVxuICAgICAgICAudHJheS1jYXB0aW9uIHtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC42NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcbiAgICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTAlO1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogVW5zdHlsZWQgc2xvdHMgZm9yIGhvc3QtaW5qZWN0ZWQgYnV0dG9ucyAqL1xuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uKSwgOjpzbG90dGVkKHN1dHJhbS1hc3luYy1idG4pIHtcbiAgICAgICAgICAgIGhlaWdodDogMzBweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMTBweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjc1cmVtICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogNXB4O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMTVzIGVhc2UsIHRyYW5zZm9ybSAwLjFzIGVhc2U7XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKGJ1dHRvbjpob3Zlcikge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMTIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogRS1JbmsgSGlnaCBDb250cmFzdCBPdmVycmlkZXMgKi9cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkIHZhcigtLWNhcmQtaW50ZW50LCAjOGI1Y2Y2KSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IDRweCAwICMxNGI4YTYgIWltcG9ydGFudDsgLyogQ29sb3JmdWwgVGVhbCBCb3R0b20gU2hhZG93ICovXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSk6aG9zdChbc2VsZWN0ZWRdKSAuY2FyZC13cmFwcGVyLFxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjZWM0ODk5ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAzcHggNHB4IDAgI2VhYjMwOCAhaW1wb3J0YW50OyAvKiBZZWxsb3cgQm90dG9tIFNoYWRvdyBvbiBTZWxlY3RlZCAqL1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuc2VsZWN0aW9uLXN0cmlwIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiA1cHggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pOmhvc3QoW3NlbGVjdGVkXSkgLnNlbGVjdGlvbi1zdHJpcCxcbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKTpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5zZWxlY3Rpb24tc3RyaXAge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LWNvbG9yOiAjZWM0ODk5ICFpbXBvcnRhbnQ7IC8qIEhvdCBQaW5rIHRoaWNrIHNsYWIgKi9cbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmFjdGlvbi1ncmlwLXJhaWwge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogIzhiNWNmNiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDJweCBzb2xpZCAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjb2xvcjogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSk6aG9zdChbc2VsZWN0ZWRdKSAuYWN0aW9uLWdyaXAtcmFpbCxcbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKTpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5hY3Rpb24tZ3JpcC1yYWlsIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNlYzQ4OTkgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIC13ZWJraXQtYmFja2Ryb3AtZmlsdGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IDJweCBzb2xpZCAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC50cmF5LWNhcHRpb24sXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtdGl0bGUge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLWRlc2MsXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBvcGFjaXR5OiAxICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiAtLS0gQ29tcGFjdCBNb2RlIFZhcmlhbnQgLS0tICovXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkge1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNvbnRlbnQtY29sIHtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDEycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1oZWFkZXIge1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWRlc2MsXG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMCAwIDEwcHg7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICAgICAgfVxuICAgICAgICAuc2VsZWN0aW9uLWhpdC16b25lIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB0b3A6IDA7XG4gICAgICAgICAgICBib3R0b206IDA7XG4gICAgICAgICAgICB3aWR0aDogMzBweDtcbiAgICAgICAgICAgIHotaW5kZXg6IDU7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLnNlbGVjdGlvbi1oaXQtem9uZSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIEBtZWRpYSAoaG92ZXI6IGhvdmVyKSB7XG4gICAgICAgICAgICAuc2VsZWN0aW9uLWhpdC16b25lOmhvdmVyICsgLnNlbGVjdGlvbi1zdHJpcCB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDZweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2dlc3R1cmVDb250cm9sbGVyID0gbmV3IFllbnZ1aUdlc3R1cmVDb250cm9sbGVyKHRoaXMsIHtcbiAgICAgICAgICAgIHNjcm9sbGFibGVDb250YWluZXJTZWxlY3RvcjogJ2FjdGlvbnMtd3JhcHBlcicsXG4gICAgICAgICAgICBvblBhblN0YXJ0OiAoc3RhcnRYLCBzdGFydFkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYXJkV2lkdGggPSByZWN0LndpZHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsU3RhcnRYID0gc3RhcnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICAgICAgICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignLmFjdGlvbnMtd3JhcHBlcicpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FjdGlvbnNTY3JvbGxMZWZ0ID0gd3JhcHBlciA/IHdyYXBwZXIuc2Nyb2xsTGVmdCA6IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdGlhbFNjcm9sbExlZnQgPSB0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblBhbk1vdmU6ICh4LCB5LCBheGlzKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGF4aXMgIT09ICdob3Jpem9udGFsJykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX2dlc3R1cmVDb250cm9sbGVyLnN0YXJ0WCAtIHg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignLmFjdGlvbnMtd3JhcHBlcicpO1xuICAgICAgICAgICAgICAgICAgICBpZiAod3JhcHBlciAmJiB0aGlzLl9pbml0aWFsU2Nyb2xsTGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG5ld1Njcm9sbCA9IHRoaXMuX2luaXRpYWxTY3JvbGxMZWZ0ICsgZGVsdGFYO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZHJhd2VyUmFmSWQpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMuX2RyYXdlclJhZklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2RyYXdlclJhZklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3U2Nyb2xsIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGVYKCR7TWF0aC5hYnMobmV3U2Nyb2xsKSAqIDAuNH1weClgO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBwZXIuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZVgoMHB4KWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBwZXIuc2Nyb2xsTGVmdCA9IG5ld1Njcm9sbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblBhbkVuZDogKGVuZFgsIGVuZFksIGF4aXMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYXhpcyAhPT0gJ2hvcml6b250YWwnKSByZXR1cm47XG4gICAgICAgICAgICAgICAgY29uc3QgZGVsdGFYID0gdGhpcy5fZ2VzdHVyZUNvbnRyb2xsZXIuc3RhcnRYIC0gZW5kWDtcblxuICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhkZWx0YVgpID4gMTApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faXNQYW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9pc1Bhbm5pbmcgPSBmYWxzZSwgMTUwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb25zLXdyYXBwZXInKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBwZXIuc3R5bGUudHJhbnNpdGlvbiA9ICd0cmFuc2Zvcm0gMC4ycyBjdWJpYy1iZXppZXIoMC4xNiwgMSwgMC4zLCAxKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGVYKDBweClgO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHdyYXBwZXIuc3R5bGUudHJhbnNpdGlvbiA9ICcnOyB9LCAyMDApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdTY3JvbGwgPSB0aGlzLl9pbml0aWFsU2Nyb2xsTGVmdCArIGRlbHRhWDtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHB1bGxlZCBwYXN0IDIwJSB0byB0aGUgcmlnaHQsIHNuYXAgaXQgY2xvc2VkXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3U2Nyb2xsIDwgLSh0aGlzLl9jYXJkV2lkdGggKiAwLjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IDMwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVmdFN3aXBlID0gZGVsdGFYID4gMzA7ICAgLy8gUmlnaHQtdG8tTGVmdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JpZ2h0U3dpcGUgPSBkZWx0YVggPCAtMzA7IC8vIExlZnQtdG8tUmlnaHRcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0xlZnRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPCAodGhpcy5fY2FyZFdpZHRoICogMC4zMCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmlnaHRTaWRlID0gdGhpcy5fbG9jYWxTdGFydFggPiAodGhpcy5fY2FyZFdpZHRoICogMC43MCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVmdFNpZGUgJiYgaXNSaWdodFN3aXBlICYmICF0aGlzLmRpc2FibGVTZWxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzUmlnaHRTaWRlICYmIGlzTGVmdFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5faGFzQWN0aW9ucyB8fCAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fb3ZlcmxheUxpc3RlbmVyID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbC5zb3VyY2UgIT09IHRoaXMgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZm9jdXNPdXRMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29udGFpbnMoZS5yZWxhdGVkVGFyZ2V0KSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyT3V0c2lkZUNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB0aGlzLl9vdmVybGF5TGlzdGVuZXIpO1xuICAgICAgICBpZiAodGhpcy5fZ2VzdHVyZUNvbnRyb2xsZXIgJiYgdHlwZW9mIHRoaXMuX2dlc3R1cmVDb250cm9sbGVyLmFib3J0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLl9nZXN0dXJlQ29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ19vdmVybGF5QWN0aXZlJykgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLW92ZXJsYXktb3BlbmVkJywge1xuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHNvdXJjZTogdGhpcyB9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxmLUhlYWxpbmcgV3JhcHBlcjogUmVzZXQgdHJhbnNpZW50IG92ZXJsYXkgc3RhdGUgaWYgTGl0IHJlY3ljbGVzIHRoZSBET00gbm9kZSBmb3IgYSBuZXcgaXRlbVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdlbnRpdHlEYXRhJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdmaWxlbmFtZScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygndGl0bGVUZXh0JykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3RvZ2dsZVNlbGVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9ICF0aGlzLnNlbGVjdGVkO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2FyZC1zZWxlY3QtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyBzZWxlY3RlZDogdGhpcy5zZWxlY3RlZCB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgZmlyc3RVcGRhdGVkKCkge1xuICAgICAgICB0aGlzLl9jaGVja0FjdGlvbnMoKTtcbiAgICB9XG5cbiAgICBfY2hlY2tBY3Rpb25zKCkge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ3Nsb3RbbmFtZT1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgaWYgKHNsb3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gc2xvdC5hc3NpZ25lZEVsZW1lbnRzKHsgZmxhdHRlbjogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSBlbGVtZW50cy5sZW5ndGggPiAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faGFzQWN0aW9ucyA9ICEhdGhpcy5xdWVyeVNlbGVjdG9yKCdbc2xvdD1cImFjdGlvbnNcIl0nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVTbG90Q2hhbmdlKGUpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC13cmFwcGVyXCIgc3R5bGU9XCItLWNhcmQtaW50ZW50OiAke3RoaXMuaW50ZW50Q29sb3IgfHwgJ3ZhcigtLWludGVudC1uZXV0cmFsKSd9XCJcbiAgICAgICAgICAgICAgICBAbW91c2VsZWF2ZT0keygpID0+IHsgaWYgKHdpbmRvdy5tYXRjaE1lZGlhKCcoaG92ZXI6IGhvdmVyKScpLm1hdGNoZXMgJiYgIXRoaXMuX2dlc3R1cmVDb250cm9sbGVyLmFjdGl2ZSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyB9fVxuICAgICAgICAgICAgICAgIEBwb2ludGVyZG93bj0keyhlKSA9PiB0aGlzLl9nZXN0dXJlQ29udHJvbGxlci5zdGFydChlKX0+XG5cbiAgICAgICAgICAgICAgICAkeyF0aGlzLmRpc2FibGVTZWxlY3Rpb24gPyBodG1sYDxkaXYgY2xhc3M9XCJzZWxlY3Rpb24taGl0LXpvbmVcIiB0aXRsZT1cIlNlbGVjdCBJdGVtXCIgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdGhpcy5fdG9nZ2xlU2VsZWN0aW9uKCk7IH19PjwvZGl2PjxkaXYgY2xhc3M9XCJzZWxlY3Rpb24tc3RyaXBcIj48L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtY29sXCIgQGNsaWNrPSR7KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtY2xpY2tlZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyBmaWxlbmFtZTogdGhpcy5maWxlbmFtZSwgaXNTb3VyY2U6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfX0gc3R5bGU9XCJjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDEycHg7IG1pbi13aWR0aDogMDtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtaGVhZGVyXCIgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0OyBtYXJnaW4tYm90dG9tOiA0cHg7IGdhcDogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtdGl0bGVcIiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogNnB4OyBmb250LXdlaWdodDogYm9sZDsgY29sb3I6IHZhcigtLXRleHQpOyBmb250LXNpemU6IDAuODVyZW07IG1pbi13aWR0aDogMDsgb3ZlcmZsb3c6IGhpZGRlbjtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuaWNvbiAmJiB0aGlzLmljb24uc3RhcnRzV2l0aCgnPGknKSA/IGh0bWxgPGRpdiBzdHlsZT1cImZsZXgtc2hyaW5rOiAwO1wiIC5pbm5lckhUTUw9JHt0aGlzLmljb259PjwvZGl2PmAgOiAodGhpcy5pY29uID8gaHRtbGA8c3BhbiBzdHlsZT1cImZsZXgtc2hyaW5rOiAwO1wiPiR7dGhpcy5pY29ufTwvc3Bhbj5gIDogJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx5ZW52dWktc2NydWItdHJhY2sgc3R5bGU9XCJmbGV4OiAxOyBtaW4td2lkdGg6IDA7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC95ZW52dWktc2NydWItdHJhY2s+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDhweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImhlYWRlci1hY3Rpb25zXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXRhaWxTdWZmaXggPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWwtc3VmZml4XCIgc3R5bGU9XCJmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTsgZm9udC1zaXplOiAxMHB4OyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IG9wYWNpdHk6IDAuODsgZmxleC1zaHJpbms6IDA7IG1hcmdpbi1sZWZ0OiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsU3VmZml4LnJlcGxhY2UoL15bXFxzfF0rLywgJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRlc2NyaXB0aW9uVGV4dCA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXNjXCIgc3R5bGU9XCJmb250LXNpemU6IDExcHg7IGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTsgbWFyZ2luLWJvdHRvbTogNHB4OyBkaXNwbGF5OiAtd2Via2l0LWJveDsgLXdlYmtpdC1saW5lLWNsYW1wOiAyOyAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsOyBvdmVyZmxvdzogaGlkZGVuO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsVGV4dCA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWxcIiBzdHlsZT1cImZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8pOyBmb250LXNpemU6IDEwcHg7IGNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKTsgb3BhY2l0eTogMC44OyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsUHJlZml4IHx8ICcnfSR7dGhpcy5kZXRhaWxUZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIGAgOiAnJ31cblxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1ib2R5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJkZXRhaWxcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJpbmxpbmUtYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWdyaXAtcmFpbFwiICBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLl9vdmVybGF5QWN0aXZlID0gIXRoaXMuX292ZXJsYXlBY3RpdmU7IH19PlxuICAgICAgICAgICAgICAgICAgICA8aSBkYXRhLWx1Y2lkZT1cImNoZXZyb24tbGVmdFwiIHN0eWxlPVwid2lkdGg6IDE0cHg7IGhlaWdodDogMTRweDtcIj48L2k+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtdHJheVwiIEBjbGljaz0ke3toYW5kbGVFdmVudDogKGUpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc1Bhbm5pbmcpIHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyByZXR1cm47IH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGggPyBlLmNvbXBvc2VkUGF0aCgpIDogW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzRHJvcGRvd25UcmlnZ2VyID0gcGF0aC5zb21lKGVsID0+IGVsLnRhZ05hbWUgPT09ICdTVVRSQU0tRFJPUERPV04nIHx8IGVsLnRhZ05hbWUgPT09ICdZRU5WVUktRFJPUERPV04nKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNNZW51SXRlbSA9IHBhdGguc29tZShlbCA9PiBlbC5jbGFzc0xpc3QgJiYgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdtZW51LWl0ZW0nKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgd2UgY2xpY2tlZCB0aGUgZHJvcGRvd24gdHJpZ2dlciBpdHNlbGYsIGFib3J0IHNvIHRoZSBtZW51IGNhbiBvcGVuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Ryb3Bkb3duVHJpZ2dlciAmJiAhaXNNZW51SXRlbSkgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQWN0aW9uYWJsZSA9IHBhdGguc29tZShlbCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVsLnRhZ05hbWUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhZyA9IGVsLnRhZ05hbWUudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YWcgPT09ICdCVVRUT04nIHx8IHRhZyA9PT0gJ1NVVFJBTS1BU1lOQy1CVE4nIHx8IHRhZyA9PT0gJ1lFTlZVSS1BU1lOQy1CVE4nKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc01lbnVJdGVtKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQWN0aW9uYWJsZSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyBcbiAgICAgICAgICAgICAgICB9LCBjYXB0dXJlOiB0cnVlfX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidHJheS1jYXB0aW9uXCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb25zLXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25zXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxuXG4gICAgdXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcykge1xuICAgICAgICBzdXBlci51cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnX292ZXJsYXlBY3RpdmUnKSAmJiB0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktb3ZlcmxheS1vcGVuZWQnLCB7XG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkZXRhaWw6IHsgc291cmNlOiB0aGlzIH1cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluaXRpYWxpemUgTHVjaWRlIGljb25zIGlmIHRoZXkgZXhpc3QgaW4gdGhlIHJlbmRlcmVkIHNoYWRvdyBkb21cbiAgICAgICAgaWYgKHdpbmRvdy5sdWNpZGUgJiYgdHlwZW9mIHdpbmRvdy5sdWNpZGUuY3JlYXRlSWNvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHdpbmRvdy5sdWNpZGUuY3JlYXRlSWNvbnMoeyByb290OiB0aGlzLnNoYWRvd1Jvb3QgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxmLUhlYWxpbmcgV3JhcHBlcjogUmVzZXQgdHJhbnNpZW50IG92ZXJsYXkgc3RhdGUgaWYgTGl0IHJlY3ljbGVzIHRoZSBET00gbm9kZSBmb3IgYSBuZXcgaXRlbVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdlbnRpdHlEYXRhJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdmaWxlbmFtZScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygndGl0bGVUZXh0JykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVybGF5QWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY2FyZCcsIFllbnZ1aUNhcmQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFDM0IsT0FBUywyQkFBQUMsTUFBK0IsZUFFakMsYUFBTSxtQkFBbUJELENBQVcsQ0FDdkMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixhQUFjLENBQUUsS0FBTSxNQUFPLEVBQzdCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsZ0JBQWlCLENBQUUsS0FBTSxNQUFPLEVBQ2hDLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN0QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtB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QUFBQSwyREFFSixLQUFLLGlCQUFpQjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBSzdFLENBRUEsUUFBUU4sRUFBbUIsQ0FDdkIsTUFBTSxRQUFRQSxDQUFpQixFQUMzQkEsRUFBa0IsSUFBSSxnQkFBZ0IsR0FBSyxLQUFLLGdCQUNoRCxLQUFLLGNBQWMsSUFBSSxZQUFZLHdCQUF5QixDQUN4RCxRQUFTLEdBQ1QsU0FBVSxHQUNWLE9BQVEsQ0FBRSxPQUFRLElBQUssQ0FDM0IsQ0FBQyxDQUFDLEVBSUYsT0FBTyxRQUFVLE9BQU8sT0FBTyxPQUFPLGFBQWdCLFlBQ3RELE9BQU8sT0FBTyxZQUFZLENBQUUsS0FBTSxLQUFLLFVBQVcsQ0FBQyxHQUluREEsRUFBa0IsSUFBSSxZQUFZLEdBQUtBLEVBQWtCLElBQUksVUFBVSxHQUFLQSxFQUFrQixJQUFJLFdBQVcsSUFDekcsS0FBSyxpQkFDTCxLQUFLLGVBQWlCLEdBR2xDLENBQ0osQ0FDQSxlQUFlLE9BQU8sY0FBZSxVQUFVIiwKICAibmFtZXMiOiBbImh0bWwiLCAiY3NzIiwgIlllbnZ1aUJhc2UiLCAiWWVudnVpR2VzdHVyZUNvbnRyb2xsZXIiLCAic3RhcnRYIiwgInN0YXJ0WSIsICJyZWN0IiwgIndyYXBwZXIiLCAieCIsICJ5IiwgImF4aXMiLCAiZGVsdGFYIiwgIm5ld1Njcm9sbCIsICJlbmRYIiwgImVuZFkiLCAiaXNMZWZ0U3dpcGUiLCAiaXNSaWdodFN3aXBlIiwgImlzTGVmdFNpZGUiLCAiaXNSaWdodFNpZGUiLCAiZSIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJzbG90IiwgImVsZW1lbnRzIiwgInBhdGgiLCAiaXNEcm9wZG93blRyaWdnZXIiLCAiZWwiLCAiaXNNZW51SXRlbSIsICJ0YWciXQp9Cg==
