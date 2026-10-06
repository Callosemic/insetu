import{html as a,css as d}from"lit";import{YenvuiBase as p}from"./yenvui-base.js";import{YenvuiGestureController as h}from"./physics.js";export class YenvuiCard extends p{static properties={titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},statusText:{type:String},icon:{type:String},intentColor:{type:String},intent:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},stale:{type:Boolean,reflect:!0}};static styles=d`
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
            opacity: 0.6;
            pointer-events: none;
            filter: grayscale(0.3);
            border-style: dashed;
            transition: opacity 0.2s ease, filter 0.2s ease;
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
            border-top-left-radius: var(--card-border-top-left-radius, var(--card-border-radius, 8px));
            border-bottom-left-radius: var(--card-border-bottom-left-radius, var(--card-border-radius, 8px));
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
    `;constructor(){super(),this._overlayActive=!1,this._hasActions=!1,this.selected=!1,this._gestureController=new h(this,{scrollableContainerSelector:"actions-wrapper",onPanStart:(t,n)=>{const e=this.getBoundingClientRect();this._cardWidth=e.width,this._localStartX=t-e.left;const r=this.shadowRoot.querySelector(".actions-wrapper");this._actionsScrollLeft=r?r.scrollLeft:null,this._initialScrollLeft=this._actionsScrollLeft},onPanMove:(t,n,e)=>{if(e==="horizontal"&&this._overlayActive){const r=this._gestureController.startX-t,i=this.shadowRoot.querySelector(".actions-wrapper");if(i&&this._initialScrollLeft!==null){let s=this._initialScrollLeft+r;this._drawerRafId&&cancelAnimationFrame(this._drawerRafId),this._drawerRafId=requestAnimationFrame(()=>{s<0?i.style.transform=`translateX(${Math.abs(s)*.4}px)`:(i.style.transform="translateX(0px)",i.scrollLeft=s)})}}},onPanEnd:(t,n,e)=>{if(e!=="horizontal")return;const r=this._gestureController.startX-t;if(Math.abs(r)>10&&(this._isPanning=!0,setTimeout(()=>this._isPanning=!1,150)),this._overlayActive){const i=this.shadowRoot.querySelector(".actions-wrapper");i&&(i.style.transition="transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",i.style.transform="translateX(0px)",setTimeout(()=>{i.style.transition=""},200),this._initialScrollLeft+r<-(this._cardWidth*.2)&&(this._overlayActive=!1));return}if(Math.abs(r)>30){const i=r>30,s=r<-30,c=this._localStartX<this._cardWidth*.3,o=this._localStartX>this._cardWidth*.7;c&&s&&!this.disableSelection?this._toggleSelection():o&&i&&(this._hasActions||this.querySelector('[slot="actions"]'))&&(this._overlayActive=!0)}}}),this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}connectedCallback(){super.connectedCallback(),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this.registerOutsideClick(()=>{this._overlayActive&&(this._overlayActive=!1)})}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._gestureController&&typeof this._gestureController.abort=="function"&&this._gestureController.abort()}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const n=t.assignedElements({flatten:!0});this._hasActions=n.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}render(){const t=!this.descriptionText&&!this.detailText,n=this.intent?`var(--intent-${this.intent})`:this.intentColor||"var(--intent-neutral)";return a`
            <div class="card-wrapper" style="--card-intent: ${n}"
                @mouseleave=${()=>{window.matchMedia("(hover: hover)").matches&&!this._gestureController.active&&(this._overlayActive=!1)}}
                @pointerdown=${e=>this._gestureController.start(e)}>

                ${this.disableSelection?"":a`<div class="selection-hit-zone" title="Select Item" @click=${e=>{e.stopPropagation(),this._toggleSelection()}}></div><div class="selection-strip"></div>`}
                <div class="content-col" @click=${e=>{this.dispatchEvent(new CustomEvent("yenvui-card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))}} style="cursor: pointer; padding: 12px; min-width: 0;">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; gap: 8px;">
                        <div class="card-title" style="display: flex; align-items: center; gap: 6px; font-weight: bold; color: var(--text); font-size: 0.85rem; min-width: 0; overflow: hidden;">
                            ${this.icon&&this.icon.startsWith("<i")?a`<div style="flex-shrink: 0;" .innerHTML=${this.icon}></div>`:this.icon?/^[a-zA-Z0-9-]+$/.test(this.icon)?a`<i data-lucide="${this.icon}" style="width: 14px; height: 14px; color: var(--card-intent, var(--intent-primary)); flex-shrink: 0;"></i>`:a`<span style="flex-shrink: 0;">${this.icon}</span>`:""}
                            <yenvui-scrub-track style="flex: 1; min-width: 0;">
                                ${this.titleText}
                            </yenvui-scrub-track>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            ${this.statusText?a`<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-right: 4px;">${this.statusText}</span>`:""}
                            <slot name="header-actions"></slot>
                            ${this.detailSuffix?a`
                                <div class="card-detail-suffix" style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); opacity: 0.8; flex-shrink: 0; margin-left: 8px;">
                                    ${this.detailSuffix.replace(/^[\s|]+/,"")}
                                </div>
                            `:""}
                        </div>
                    </div>

                    ${this.descriptionText?a`
                        <div class="card-desc" style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${this.descriptionText}
                        </div>
                    `:""}
                    ${this.detailText?a`
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
                    @pointerenter=${e=>{e.pointerType==="mouse"&&(this._overlayActive=!0)}}
                    @click=${e=>{e.stopPropagation(),e.preventDefault(),this._overlayActive=!this._overlayActive}}>
                    <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>
                </div>
                <div class="actions-tray" @click=${{handleEvent:e=>{if(this._isPanning){e.stopPropagation(),e.preventDefault();return}const r=e.composedPath?e.composedPath():[],i=r.some(o=>o.tagName==="SUTRAM-DROPDOWN"||o.tagName==="YENVUI-DROPDOWN"),s=r.some(o=>o.classList&&o.classList.contains("menu-item"));if(i&&!s)return;r.some(o=>{if(!o.tagName)return!1;const l=o.tagName.toUpperCase();return!!(l==="BUTTON"||l==="SUTRAM-ASYNC-BTN"||l==="YENVUI-ASYNC-BTN"||s)})&&(this._overlayActive=!1)},capture:!0}}>
                    ${t?"":a`<span class="tray-caption">${this.titleText}</span>`}
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `}updated(t){super.updated(t),t.has("_overlayActive")&&this._overlayActive&&this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),window.lucide&&typeof window.lucide.createIcons=="function"&&window.lucide.createIcons({root:this.shadowRoot}),(t.has("entityData")||t.has("filename")||t.has("titleText"))&&this._overlayActive&&(this._overlayActive=!1)}}customElements.define("yenvui-card",YenvuiCard);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmltcG9ydCB7IFllbnZ1aUdlc3R1cmVDb250cm9sbGVyIH0gZnJvbSAnLi9waHlzaWNzLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNhcmQgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGl0bGVUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBkZXRhaWxQcmVmaXg6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGRldGFpbFN1ZmZpeDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZGVzY3JpcHRpb25UZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzdGF0dXNUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpY29uOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgaW50ZW50OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzZWxlY3RlZDogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGRpc2FibGVTZWxlY3Rpb246IHsgdHlwZTogQm9vbGVhbiB9LFxuICAgICAgICBfb3ZlcmxheUFjdGl2ZTogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIF9oYXNBY3Rpb25zOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUsIGF0dHJpYnV0ZTogJ2hhcy1hY3Rpb25zJyB9LFxuICAgICAgICBjb21wYWN0OiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBzdGFsZTogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgZGlzcGxheTogYmxvY2s7IG1hcmdpbi1ib3R0b206IHZhcigtLWNhcmQtbWFyZ2luLWJvdHRvbSwgMTJweCk7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdG91Y2gtYWN0aW9uOiBwYW4teCBwYW4teTsgfVxuICAgICAgICAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIHRvdWNoLWFjdGlvbjogcGFuLXggcGFuLXk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1jYXJkLCB2YXIoLS1pbnB1dC1iZykpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IHZhcigtLWNhcmQtYm9yZGVyLXRvcCwgMXB4IHNvbGlkIHZhcigtLWJvcmRlcikpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIG92ZXJmbG93OiB2aXNpYmxlO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogdmFyKC0tY2FyZC1ib3gtc2hhZG93LCAwIDFweCAzcHggcmdiYSgwLDAsMCwwLjA1KSk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzIGVhc2UsIGJvcmRlci1jb2xvciAwLjE1cyBlYXNlLCBib3gtc2hhZG93IDAuMTVzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgLyogU3dpdGNoIHRvIGVkZ2UtdG8tZWRnZSBmbHVzaCBtb2RlIHdoZW4gdGhlIGNvbnRhaW5lciBjb2x1bW4gYmVjb21lcyBuYXJyb3cgKi9cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICBib3JkZXItcmlnaHQtd2lkdGg6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgICAgIGJvcmRlci1ib3R0b20td2lkdGg6IDFweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgICAgIGJvcmRlci1ib3R0b20tc3R5bGU6IHNvbGlkICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuc2VsZWN0aW9uLXN0cmlwIHtcbiAgICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLnNlbGVjdGlvbi1zdHJpcCB7XG4gICAgICAgICAgICB3aWR0aDogMTRweCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWluLXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItdG9wLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgb3BhY2l0eTogdmFyKC0tcGVlay1yYWlsLW9wYWNpdHksIDEpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2UsIGJvcmRlci1sZWZ0LXdpZHRoIDAuMTVzIGVhc2UsIGJveC1zaGFkb3cgMC4xNXMgZWFzZTtcbiAgICAgICAgfVxuICAgICAgICBAbWVkaWEgKGhvdmVyOiBob3Zlcikge1xuICAgICAgICAgICAgLnNlbGVjdGlvbi1zdHJpcDpob3ZlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDZweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5jYXJkLXdyYXBwZXI6aG92ZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyLWhvdmVyLCB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKSk7XG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctY2FyZC1ob3ZlciwgdmFyKC0tYmctaG92ZXIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbc2VsZWN0ZWRdKSAuY2FyZC13cmFwcGVyLFxuICAgICAgICA6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuY2FyZC13cmFwcGVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWNhcmQtc2VsZWN0ZWQsIGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKSB2YXIoLS1pbnRlbnQtYmctbWl4LCAxNSUpLCB2YXIoLS1pbnB1dC1iZykpKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXItaGlnaGxpZ2h0LCB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKSkgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtzZWxlY3RlZF0pIC5zZWxlY3Rpb24tc3RyaXAge1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtd2lkdGg6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LWNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMnB4IDAgMTBweCByZ2JhKDk5LCAxMDIsIDI0MSwgMC40NSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3N0YWxlXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBvcGFjaXR5OiAwLjY7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIGZpbHRlcjogZ3JheXNjYWxlKDAuMyk7XG4gICAgICAgICAgICBib3JkZXItc3R5bGU6IGRhc2hlZDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4ycyBlYXNlLCBmaWx0ZXIgMC4ycyBlYXNlO1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKHZhcigtLXBlZWstY29udGVudC15LCAwcHgpKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDRweDtcbiAgICAgICAgfVxuICAgICAgICAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45NXJlbTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGVzYyB7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOHJlbTtcbiAgICAgICAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xuICAgICAgICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcbiAgICAgICAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xuICAgICAgICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAyO1xuICAgICAgICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmNhcmQtYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZCgqKSB7XG4gICAgICAgICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcbiAgICAgICAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKHApLCA6OnNsb3R0ZWQoaDEpLCA6OnNsb3R0ZWQoaDIpLCA6OnNsb3R0ZWQoaDMpLCA6OnNsb3R0ZWQoaDQpLCA6OnNsb3R0ZWQoaDUpLCA6OnNsb3R0ZWQoaDYpIHtcbiAgICAgICAgICAgIG1hcmdpbi1ibG9jay1zdGFydDogMDtcbiAgICAgICAgICAgIG1hcmdpbi1ibG9jay1lbmQ6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmNhcmQtZGV0YWlsIHtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8sIG1vbm9zcGFjZSk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuN3JlbTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgLmNhcmQtZGV0YWlsLW1haW4geyBkaXNwbGF5OiBub25lOyB9XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbi1ncmlwLXJhaWwge1xuICAgICAgICAgICAgd2lkdGg6IDI2cHg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXJhaWwtYmcsIHJnYmEoMjU1LDI1NSwyNTUsMC4wMikpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogdmFyKC0tY2FyZC1ib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIG9wYWNpdHk6IHZhcigtLXBlZWstcmFpbC1vcGFjaXR5LCAxKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4zcyBlYXNlLCBiYWNrZ3JvdW5kIDAuMTVzIGVhc2UsIGNvbG9yIDAuMTVzIGVhc2U7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hhcy1hY3Rpb25zXSkgLmFjdGlvbi1ncmlwLXJhaWwge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9uLWdyaXAtcmFpbCBpIHsgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgY3ViaWMtYmV6aWVyKDAuMTYsIDEsIDAuMywgMSk7IH1cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmFjdGlvbi1ncmlwLXJhaWwgaSB7IHRyYW5zZm9ybTogcm90YXRlKDE4MGRlZyk7IH1cbiAgICAgICAgLmFjdGlvbi1ncmlwLXJhaWw6aG92ZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcmFpbC1ob3ZlciwgcmdiYSg5OSwgMTAyLCAyNDEsIDAuMjIpKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucy10cmF5IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICByaWdodDogMjZweDtcbiAgICAgICAgICAgIHRvcDogMDtcbiAgICAgICAgICAgIGJvdHRvbTogMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWNhcmQsIHZhcigtLWlucHV0LWJnKSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tYmctY2FyZCwgdmFyKC0taW5wdXQtYmcpKSA5NCUsIHRyYW5zcGFyZW50KTtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cig4cHgpO1xuICAgICAgICAgICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IGJsdXIoOHB4KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA1cHg7XG4gICAgICAgICAgICBwYWRkaW5nOiA0cHggOHB4O1xuICAgICAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEwcHgpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjJzIGN1YmljLWJlemllcigwLjE2LCAxLCAwLjMsIDEpLCB0cmFuc2Zvcm0gMC4ycyBjdWJpYy1iZXppZXIoMC4xNiwgMSwgMC4zLCAxKTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLXRvcC1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1cywgdmFyKC0tY2FyZC1ib3JkZXItcmFkaXVzLCA4cHgpKTtcbiAgICAgICAgICAgIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiB2YXIoLS1jYXJkLWJvcmRlci10b3AtcmlnaHQtcmFkaXVzLCB2YXIoLS1jYXJkLWJvcmRlci1yYWRpdXMsIDhweCkpO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IHZhcigtLWNhcmQtYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMsIHZhcigtLWNhcmQtYm9yZGVyLXJhZGl1cywgOHB4KSk7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlciB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgICAgICAgICAgZ2FwOiA2cHg7XG4gICAgICAgICAgICBvdmVyZmxvdy14OiBhdXRvO1xuICAgICAgICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG4gICAgICAgIC5hY3Rpb25zLXdyYXBwZXI6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgLmFjdGlvbnMtd3JhcHBlcjo6YmVmb3JlLCAuYWN0aW9ucy13cmFwcGVyOjphZnRlciB7XG4gICAgICAgICAgICBjb250ZW50OiAnJzsgbWFyZ2luOiBhdXRvO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW19vdmVybGF5YWN0aXZlXSkgLmFjdGlvbnMtdHJheSB7XG4gICAgICAgICAgICBvcGFjaXR5OiAxO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMCk7XG4gICAgICAgIH1cbiAgICAgICAgLnRyYXktY2FwdGlvbiB7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDkwJTtcbiAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFVuc3R5bGVkIHNsb3RzIGZvciBob3N0LWluamVjdGVkIGJ1dHRvbnMgKi9cbiAgICAgICAgOjpzbG90dGVkKGJ1dHRvbiksIDo6c2xvdHRlZChzdXRyYW0tYXN5bmMtYnRuKSB7XG4gICAgICAgICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDEwcHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43NXJlbSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDVweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGZpbHRlciAwLjE1cyBlYXNlLCB0cmFuc2Zvcm0gMC4xcyBlYXNlO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZChidXR0b246aG92ZXIpIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjEyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIEUtSW5rIEhpZ2ggQ29udHJhc3QgT3ZlcnJpZGVzICovXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhcmQtd3JhcHBlciB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCB2YXIoLS1jYXJkLWludGVudCwgIzhiNWNmNikgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDNweCA0cHggMCAjMTRiOGE2ICFpbXBvcnRhbnQ7IC8qIENvbG9yZnVsIFRlYWwgQm90dG9tIFNoYWRvdyAqL1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pOmhvc3QoW3NlbGVjdGVkXSkgLmNhcmQtd3JhcHBlcixcbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKTpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgI2VjNDg5OSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogM3B4IDRweCAwICNlYWIzMDggIWltcG9ydGFudDsgLyogWWVsbG93IEJvdHRvbSBTaGFkb3cgb24gU2VsZWN0ZWQgKi9cbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnNlbGVjdGlvbi1zdHJpcCB7XG4gICAgICAgICAgICBib3JkZXItbGVmdC13aWR0aDogNXB4ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKTpob3N0KFtzZWxlY3RlZF0pIC5zZWxlY3Rpb24tc3RyaXAsXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSk6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuc2VsZWN0aW9uLXN0cmlwIHtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiAxNHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItbGVmdC1jb2xvcjogI2VjNDg5OSAhaW1wb3J0YW50OyAvKiBIb3QgUGluayB0aGljayBzbGFiICovXG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb24tZ3JpcC1yYWlsIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICM4YjVjZjYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgY29sb3I6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pOmhvc3QoW3NlbGVjdGVkXSkgLmFjdGlvbi1ncmlwLXJhaWwsXG4gICAgICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSk6aG9zdChbX292ZXJsYXlhY3RpdmVdKSAuYWN0aW9uLWdyaXAtcmFpbCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZWM0ODk5ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5hY3Rpb25zLXRyYXkge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiAycHggc29saWQgIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAudHJheS1jYXB0aW9uLFxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLXRpdGxlIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jYXJkLWRldGFpbCB7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgb3BhY2l0eTogMSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLyogLS0tIENvbXBhY3QgTW9kZSBWYXJpYW50IC0tLSAqL1xuICAgICAgICA6aG9zdChbY29tcGFjdF0pIHtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLXdyYXBwZXIge1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jb250ZW50LWNvbCB7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIHBhZGRpbmc6IDZweCAxMnB4O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtjb21wYWN0XSkgLmNhcmQtaGVhZGVyIHtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC10aXRsZSB7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuODVyZW07XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2NvbXBhY3RdKSAuY2FyZC1kZXNjLFxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWJvZHkge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbY29tcGFjdF0pIC5jYXJkLWRldGFpbCB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDAgMCAxMHB4O1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICAgIH1cbiAgICAgICAgLnNlbGVjdGlvbi1oaXQtem9uZSB7XG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgICAgICBsZWZ0OiAwO1xuICAgICAgICAgICAgdG9wOiAwO1xuICAgICAgICAgICAgYm90dG9tOiAwO1xuICAgICAgICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICAgICAgICB6LWluZGV4OiA1O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtfb3ZlcmxheWFjdGl2ZV0pIC5zZWxlY3Rpb24taGl0LXpvbmUge1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICBAbWVkaWEgKGhvdmVyOiBob3Zlcikge1xuICAgICAgICAgICAgLnNlbGVjdGlvbi1oaXQtem9uZTpob3ZlciArIC5zZWxlY3Rpb24tc3RyaXAge1xuICAgICAgICAgICAgICAgIGJvcmRlci1sZWZ0LXdpZHRoOiA2cHg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBgO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9nZXN0dXJlQ29udHJvbGxlciA9IG5ldyBZZW52dWlHZXN0dXJlQ29udHJvbGxlcih0aGlzLCB7XG4gICAgICAgICAgICBzY3JvbGxhYmxlQ29udGFpbmVyU2VsZWN0b3I6ICdhY3Rpb25zLXdyYXBwZXInLFxuICAgICAgICAgICAgb25QYW5TdGFydDogKHN0YXJ0WCwgc3RhcnRZKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FyZFdpZHRoID0gcmVjdC53aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbFN0YXJ0WCA9IHN0YXJ0WCAtIHJlY3QubGVmdDtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb25zLXdyYXBwZXInKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hY3Rpb25zU2Nyb2xsTGVmdCA9IHdyYXBwZXIgPyB3cmFwcGVyLnNjcm9sbExlZnQgOiBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXRpYWxTY3JvbGxMZWZ0ID0gdGhpcy5fYWN0aW9uc1Njcm9sbExlZnQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25QYW5Nb3ZlOiAoeCwgeSwgYXhpcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChheGlzICE9PSAnaG9yaXpvbnRhbCcpIHJldHVybjtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWx0YVggPSB0aGlzLl9nZXN0dXJlQ29udHJvbGxlci5zdGFydFggLSB4O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb25zLXdyYXBwZXInKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdyYXBwZXIgJiYgdGhpcy5faW5pdGlhbFNjcm9sbExlZnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBuZXdTY3JvbGwgPSB0aGlzLl9pbml0aWFsU2Nyb2xsTGVmdCArIGRlbHRhWDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2RyYXdlclJhZklkKSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLl9kcmF3ZXJSYWZJZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9kcmF3ZXJSYWZJZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld1Njcm9sbCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgke01hdGguYWJzKG5ld1Njcm9sbCkgKiAwLjR9cHgpYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGVYKDBweClgO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnNjcm9sbExlZnQgPSBuZXdTY3JvbGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25QYW5FbmQ6IChlbmRYLCBlbmRZLCBheGlzKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGF4aXMgIT09ICdob3Jpem9udGFsJykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMuX2dlc3R1cmVDb250cm9sbGVyLnN0YXJ0WCAtIGVuZFg7XG5cbiAgICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGFYKSA+IDEwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2lzUGFubmluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5faXNQYW5uaW5nID0gZmFsc2UsIDE1MCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcuYWN0aW9ucy13cmFwcGVyJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh3cmFwcGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cmFwcGVyLnN0eWxlLnRyYW5zaXRpb24gPSAndHJhbnNmb3JtIDAuMnMgY3ViaWMtYmV6aWVyKDAuMTYsIDEsIDAuMywgMSknO1xuICAgICAgICAgICAgICAgICAgICAgICAgd3JhcHBlci5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgwcHgpYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyB3cmFwcGVyLnN0eWxlLnRyYW5zaXRpb24gPSAnJzsgfSwgMjAwKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3U2Nyb2xsID0gdGhpcy5faW5pdGlhbFNjcm9sbExlZnQgKyBkZWx0YVg7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBwdWxsZWQgcGFzdCAyMCUgdG8gdGhlIHJpZ2h0LCBzbmFwIGl0IGNsb3NlZFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld1Njcm9sbCA8IC0odGhpcy5fY2FyZFdpZHRoICogMC4yKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKE1hdGguYWJzKGRlbHRhWCkgPiAzMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0xlZnRTd2lwZSA9IGRlbHRhWCA+IDMwOyAgIC8vIFJpZ2h0LXRvLUxlZnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNSaWdodFN3aXBlID0gZGVsdGFYIDwgLTMwOyAvLyBMZWZ0LXRvLVJpZ2h0XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNMZWZ0U2lkZSA9IHRoaXMuX2xvY2FsU3RhcnRYIDwgKHRoaXMuX2NhcmRXaWR0aCAqIDAuMzApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JpZ2h0U2lkZSA9IHRoaXMuX2xvY2FsU3RhcnRYID4gKHRoaXMuX2NhcmRXaWR0aCAqIDAuNzApO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0xlZnRTaWRlICYmIGlzUmlnaHRTd2lwZSAmJiAhdGhpcy5kaXNhYmxlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl90b2dnbGVTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1JpZ2h0U2lkZSAmJiBpc0xlZnRTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzQWN0aW9ucyA9IHRoaXMuX2hhc0FjdGlvbnMgfHwgISF0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tzbG90PVwiYWN0aW9uc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc0FjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX292ZXJsYXlMaXN0ZW5lciA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kZXRhaWwuc291cmNlICE9PSB0aGlzICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2ZvY3VzT3V0TGlzdGVuZXIgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbnRhaW5zKGUucmVsYXRlZFRhcmdldCkgJiYgdGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5yZWdpc3Rlck91dHNpZGVDbGljaygoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCB0aGlzLl9mb2N1c091dExpc3RlbmVyKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigneWVudnVpLW92ZXJsYXktb3BlbmVkJywgdGhpcy5fb3ZlcmxheUxpc3RlbmVyKTtcbiAgICAgICAgaWYgKHRoaXMuX2dlc3R1cmVDb250cm9sbGVyICYmIHR5cGVvZiB0aGlzLl9nZXN0dXJlQ29udHJvbGxlci5hYm9ydCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5fZ2VzdHVyZUNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2VsZi1IZWFsaW5nIFdyYXBwZXI6IFJlc2V0IHRyYW5zaWVudCBvdmVybGF5IHN0YXRlIGlmIExpdCByZWN5Y2xlcyB0aGUgRE9NIG5vZGUgZm9yIGEgbmV3IGl0ZW1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZW50aXR5RGF0YScpIHx8IGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnZmlsZW5hbWUnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RpdGxlVGV4dCcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcmxheUFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF90b2dnbGVTZWxlY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSAhdGhpcy5zZWxlY3RlZDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLWNhcmQtc2VsZWN0LXRvZ2dsZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgc2VsZWN0ZWQ6IHRoaXMuc2VsZWN0ZWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGZpcnN0VXBkYXRlZCgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tBY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgX2NoZWNrQWN0aW9ucygpIHtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdzbG90W25hbWU9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIGlmIChzbG90KSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHNsb3QuYXNzaWduZWRFbGVtZW50cyh7IGZsYXR0ZW46IHRydWUgfSk7XG4gICAgICAgICAgICB0aGlzLl9oYXNBY3Rpb25zID0gZWxlbWVudHMubGVuZ3RoID4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2hhc0FjdGlvbnMgPSAhIXRoaXMucXVlcnlTZWxlY3RvcignW3Nsb3Q9XCJhY3Rpb25zXCJdJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlU2xvdENoYW5nZShlKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrQWN0aW9ucygpO1xuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIGNvbnN0IGlzU2luZ2xlUm93ID0gIXRoaXMuZGVzY3JpcHRpb25UZXh0ICYmICF0aGlzLmRldGFpbFRleHQ7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkSW50ZW50ID0gdGhpcy5pbnRlbnQgPyBgdmFyKC0taW50ZW50LSR7dGhpcy5pbnRlbnR9KWAgOiAodGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0taW50ZW50LW5ldXRyYWwpJyk7XG5cbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC13cmFwcGVyXCIgc3R5bGU9XCItLWNhcmQtaW50ZW50OiAke3Jlc29sdmVkSW50ZW50fVwiXG4gICAgICAgICAgICAgICAgQG1vdXNlbGVhdmU9JHsoKSA9PiB7IGlmICh3aW5kb3cubWF0Y2hNZWRpYSgnKGhvdmVyOiBob3ZlciknKS5tYXRjaGVzICYmICF0aGlzLl9nZXN0dXJlQ29udHJvbGxlci5hY3RpdmUpIHRoaXMuX292ZXJsYXlBY3RpdmUgPSBmYWxzZTsgfX1cbiAgICAgICAgICAgICAgICBAcG9pbnRlcmRvd249JHsoZSkgPT4gdGhpcy5fZ2VzdHVyZUNvbnRyb2xsZXIuc3RhcnQoZSl9PlxuXG4gICAgICAgICAgICAgICAgJHshdGhpcy5kaXNhYmxlU2VsZWN0aW9uID8gaHRtbGA8ZGl2IGNsYXNzPVwic2VsZWN0aW9uLWhpdC16b25lXCIgdGl0bGU9XCJTZWxlY3QgSXRlbVwiIEBjbGljaz0keyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IHRoaXMuX3RvZ2dsZVNlbGVjdGlvbigpOyB9fT48L2Rpdj48ZGl2IGNsYXNzPVwic2VsZWN0aW9uLXN0cmlwXCI+PC9kaXY+YCA6ICcnfVxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbFwiIEBjbGljaz0keyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jYXJkLWNsaWNrZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IHsgZmlsZW5hbWU6IHRoaXMuZmlsZW5hbWUsIGlzU291cmNlOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH19IHN0eWxlPVwiY3Vyc29yOiBwb2ludGVyOyBwYWRkaW5nOiAxMnB4OyBtaW4td2lkdGg6IDA7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWhlYWRlclwiIHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogZmxleC1zdGFydDsgbWFyZ2luLWJvdHRvbTogNHB4OyBnYXA6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXRpdGxlXCIgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDZweDsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiB2YXIoLS10ZXh0KTsgZm9udC1zaXplOiAwLjg1cmVtOyBtaW4td2lkdGg6IDA7IG92ZXJmbG93OiBoaWRkZW47XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmljb24gJiYgdGhpcy5pY29uLnN0YXJ0c1dpdGgoJzxpJykgPyBodG1sYDxkaXYgc3R5bGU9XCJmbGV4LXNocmluazogMDtcIiAuaW5uZXJIVE1MPSR7dGhpcy5pY29ufT48L2Rpdj5gIDogKHRoaXMuaWNvbiA/ICgvXlthLXpBLVowLTktXSskLy50ZXN0KHRoaXMuaWNvbikgPyBodG1sYDxpIGRhdGEtbHVjaWRlPVwiJHt0aGlzLmljb259XCIgc3R5bGU9XCJ3aWR0aDogMTRweDsgaGVpZ2h0OiAxNHB4OyBjb2xvcjogdmFyKC0tY2FyZC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5KSk7IGZsZXgtc2hyaW5rOiAwO1wiPjwvaT5gIDogaHRtbGA8c3BhbiBzdHlsZT1cImZsZXgtc2hyaW5rOiAwO1wiPiR7dGhpcy5pY29ufTwvc3Bhbj5gKSA6ICcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8eWVudnVpLXNjcnViLXRyYWNrIHN0eWxlPVwiZmxleDogMTsgbWluLXdpZHRoOiAwO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMudGl0bGVUZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwveWVudnVpLXNjcnViLXRyYWNrPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5zdGF0dXNUZXh0ID8gaHRtbGA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZTogMC44NXJlbTsgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpOyBmb250LXN0eWxlOiBpdGFsaWM7IG1hcmdpbi1yaWdodDogNHB4O1wiPiR7dGhpcy5zdGF0dXNUZXh0fTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImhlYWRlci1hY3Rpb25zXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXRhaWxTdWZmaXggPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWwtc3VmZml4XCIgc3R5bGU9XCJmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTsgZm9udC1zaXplOiAxMHB4OyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IG9wYWNpdHk6IDAuODsgZmxleC1zaHJpbms6IDA7IG1hcmdpbi1sZWZ0OiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsU3VmZml4LnJlcGxhY2UoL15bXFxzfF0rLywgJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgJHt0aGlzLmRlc2NyaXB0aW9uVGV4dCA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXNjXCIgc3R5bGU9XCJmb250LXNpemU6IDExcHg7IGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTsgbWFyZ2luLWJvdHRvbTogNHB4OyBkaXNwbGF5OiAtd2Via2l0LWJveDsgLXdlYmtpdC1saW5lLWNsYW1wOiAyOyAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsOyBvdmVyZmxvdzogaGlkZGVuO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5kZXNjcmlwdGlvblRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsVGV4dCA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1kZXRhaWxcIiBzdHlsZT1cImZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8pOyBmb250LXNpemU6IDEwcHg7IGNvbG9yOiB2YXIoLS1jYXJkLWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnkpKTsgb3BhY2l0eTogMC44OyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZGV0YWlsUHJlZml4IHx8ICcnfSR7dGhpcy5kZXRhaWxUZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIGAgOiAnJ31cblxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1ib2R5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJkZXRhaWxcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJpbmxpbmUtYWN0aW9uc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWdyaXAtcmFpbFwiICBcbiAgICAgICAgICAgICAgICAgICAgQHBvaW50ZXJlbnRlcj0keyhlKSA9PiB7IGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSB0aGlzLl9vdmVybGF5QWN0aXZlID0gdHJ1ZTsgfX1cbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLl9vdmVybGF5QWN0aXZlID0gIXRoaXMuX292ZXJsYXlBY3RpdmU7IH19PlxuICAgICAgICAgICAgICAgICAgICA8aSBkYXRhLWx1Y2lkZT1cImNoZXZyb24tbGVmdFwiIHN0eWxlPVwid2lkdGg6IDE0cHg7IGhlaWdodDogMTRweDtcIj48L2k+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtdHJheVwiIEBjbGljaz0ke3toYW5kbGVFdmVudDogKGUpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc1Bhbm5pbmcpIHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyByZXR1cm47IH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGggPyBlLmNvbXBvc2VkUGF0aCgpIDogW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzRHJvcGRvd25UcmlnZ2VyID0gcGF0aC5zb21lKGVsID0+IGVsLnRhZ05hbWUgPT09ICdTVVRSQU0tRFJPUERPV04nIHx8IGVsLnRhZ05hbWUgPT09ICdZRU5WVUktRFJPUERPV04nKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNNZW51SXRlbSA9IHBhdGguc29tZShlbCA9PiBlbC5jbGFzc0xpc3QgJiYgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdtZW51LWl0ZW0nKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgd2UgY2xpY2tlZCB0aGUgZHJvcGRvd24gdHJpZ2dlciBpdHNlbGYsIGFib3J0IHNvIHRoZSBtZW51IGNhbiBvcGVuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Ryb3Bkb3duVHJpZ2dlciAmJiAhaXNNZW51SXRlbSkgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQWN0aW9uYWJsZSA9IHBhdGguc29tZShlbCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVsLnRhZ05hbWUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhZyA9IGVsLnRhZ05hbWUudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YWcgPT09ICdCVVRUT04nIHx8IHRhZyA9PT0gJ1NVVFJBTS1BU1lOQy1CVE4nIHx8IHRhZyA9PT0gJ1lFTlZVSS1BU1lOQy1CVE4nKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc01lbnVJdGVtKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQWN0aW9uYWJsZSkgdGhpcy5fb3ZlcmxheUFjdGl2ZSA9IGZhbHNlOyBcbiAgICAgICAgICAgICAgICB9LCBjYXB0dXJlOiB0cnVlfX0+XG4gICAgICAgICAgICAgICAgICAgICR7IWlzU2luZ2xlUm93ID8gaHRtbGA8c3BhbiBjbGFzcz1cInRyYXktY2FwdGlvblwiPiR7dGhpcy50aXRsZVRleHR9PC9zcGFuPmAgOiAnJ31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbnMtd3JhcHBlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImFjdGlvbnNcIiBAc2xvdGNoYW5nZT0ke3RoaXMuX2hhbmRsZVNsb3RDaGFuZ2V9Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG5cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdfb3ZlcmxheUFjdGl2ZScpICYmIHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1vdmVybGF5LW9wZW5lZCcsIHtcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRldGFpbDogeyBzb3VyY2U6IHRoaXMgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBMdWNpZGUgaWNvbnMgaWYgdGhleSBleGlzdCBpbiB0aGUgcmVuZGVyZWQgc2hhZG93IGRvbVxuICAgICAgICBpZiAod2luZG93Lmx1Y2lkZSAmJiB0eXBlb2Ygd2luZG93Lmx1Y2lkZS5jcmVhdGVJY29ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgd2luZG93Lmx1Y2lkZS5jcmVhdGVJY29ucyh7IHJvb3Q6IHRoaXMuc2hhZG93Um9vdCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNlbGYtSGVhbGluZyBXcmFwcGVyOiBSZXNldCB0cmFuc2llbnQgb3ZlcmxheSBzdGF0ZSBpZiBMaXQgcmVjeWNsZXMgdGhlIERPTSBub2RlIGZvciBhIG5ldyBpdGVtXG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ2VudGl0eURhdGEnKSB8fCBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ2ZpbGVuYW1lJykgfHwgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCd0aXRsZVRleHQnKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX292ZXJsYXlBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdmVybGF5QWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1jYXJkJywgWWVudnVpQ2FyZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLFFBQUFBLEVBQU0sT0FBQUMsTUFBVyxNQUMxQixPQUFTLGNBQUFDLE1BQWtCLG1CQUMzQixPQUFTLDJCQUFBQyxNQUErQixlQUVqQyxhQUFNLG1CQUFtQkQsQ0FBVyxDQUN2QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGFBQWMsQ0FBRSxLQUFNLE1BQU8sRUFDN0IsYUFBYyxDQUFFLEtBQU0sTUFBTyxFQUM3QixnQkFBaUIsQ0FBRSxLQUFNLE1BQU8sRUFDaEMsV0FBWSxDQUFFLEtBQU0sTUFBTyxFQUMzQixLQUFNLENBQUUsS0FBTSxNQUFPLEVBQ3JCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsT0FBUSxDQUFFLEtBQU0sTUFBTyxFQUN2QixTQUFVLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN6QyxpQkFBa0IsQ0FBRSxLQUFNLE9BQVEsRUFDbEMsZUFBZ0IsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQy9DLFlBQWEsQ0FBRSxLQUFNLFFBQVMsUUFBUyxHQUFNLFVBQVcsYUFBYyxFQUN0RSxRQUFTLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN4QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN0QyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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QUFDRSxFQUFZLE9BRWpCSCxFQUFLLEtBQUtFLEdBQU0sQ0FDakMsR0FBSSxDQUFDQSxFQUFHLFFBQVMsTUFBTyxHQUN4QixNQUFNRSxFQUFNRixFQUFHLFFBQVEsWUFBWSxFQUVuQyxNQURJLEdBQUFFLElBQVEsVUFBWUEsSUFBUSxvQkFBc0JBLElBQVEsb0JBQzFERCxFQUVSLENBQUMsSUFFaUIsS0FBSyxlQUFpQixHQUM1QyxFQUFHLFFBQVMsRUFBSSxDQUFDO0FBQUEsc0JBQ1ZMLEVBQTBFLEdBQTVEdkIsK0JBQWtDLEtBQUssU0FBUyxTQUFjO0FBQUE7QUFBQSwyREFFeEMsS0FBSyxpQkFBaUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUs3RSxDQUVBLFFBQVFvQixFQUFtQixDQUN2QixNQUFNLFFBQVFBLENBQWlCLEVBQzNCQSxFQUFrQixJQUFJLGdCQUFnQixHQUFLLEtBQUssZ0JBQ2hELEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQ3hELFFBQVMsR0FDVCxTQUFVLEdBQ1YsT0FBUSxDQUFFLE9BQVEsSUFBSyxDQUMzQixDQUFDLENBQUMsRUFJRixPQUFPLFFBQVUsT0FBTyxPQUFPLE9BQU8sYUFBZ0IsWUFDdEQsT0FBTyxPQUFPLFlBQVksQ0FBRSxLQUFNLEtBQUssVUFBVyxDQUFDLEdBSW5EQSxFQUFrQixJQUFJLFlBQVksR0FBS0EsRUFBa0IsSUFBSSxVQUFVLEdBQUtBLEVBQWtCLElBQUksV0FBVyxJQUN6RyxLQUFLLGlCQUNMLEtBQUssZUFBaUIsR0FHbEMsQ0FDSixDQUNBLGVBQWUsT0FBTyxjQUFlLFVBQVUiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSIsICJZZW52dWlHZXN0dXJlQ29udHJvbGxlciIsICJzdGFydFgiLCAic3RhcnRZIiwgInJlY3QiLCAid3JhcHBlciIsICJ4IiwgInkiLCAiYXhpcyIsICJkZWx0YVgiLCAibmV3U2Nyb2xsIiwgImVuZFgiLCAiZW5kWSIsICJpc0xlZnRTd2lwZSIsICJpc1JpZ2h0U3dpcGUiLCAiaXNMZWZ0U2lkZSIsICJpc1JpZ2h0U2lkZSIsICJlIiwgImNoYW5nZWRQcm9wZXJ0aWVzIiwgInNsb3QiLCAiZWxlbWVudHMiLCAiaXNTaW5nbGVSb3ciLCAicmVzb2x2ZWRJbnRlbnQiLCAicGF0aCIsICJpc0Ryb3Bkb3duVHJpZ2dlciIsICJlbCIsICJpc01lbnVJdGVtIiwgInRhZyJdCn0K
