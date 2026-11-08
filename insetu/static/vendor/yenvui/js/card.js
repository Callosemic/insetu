import{html as s,css as d}from"lit";import{YenvuiBase as p}from"./yenvui-base.js";import{YenvuiGestureController as h,getEventPath as v}from"./physics.js";export class YenvuiCard extends p{static properties={filename:{type:String},titleText:{type:String},detailText:{type:String},detailPrefix:{type:String},detailSuffix:{type:String},descriptionText:{type:String},statusText:{type:String},icon:{type:String},intent:{type:String},selected:{type:Boolean,reflect:!0},disableSelection:{type:Boolean},_overlayActive:{type:Boolean,reflect:!0},_hasActions:{type:Boolean,reflect:!0,attribute:"has-actions"},_hasBodySlot:{type:Boolean,state:!0},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},stale:{type:Boolean,reflect:!0}};static styles=d`
        :host {
            display: block;
            margin-bottom: var(--card-margin-bottom, 12px);
            position: relative;
            touch-action: pan-y;
            overscroll-behavior-x: none;
            content-visibility: var(--card-content-visibility, auto);
            contain-intrinsic-size: var(--card-contain-intrinsic-size, auto 76px);
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
        }
        :host([compact]) {
            contain-intrinsic-size: var(--card-contain-intrinsic-size, auto 42px);
        }
        :host([_overlayactive]),
        :host-context(lit-virtualizer),
        :host-context([data-virtual-list]) {
            content-visibility: visible;
            contain-intrinsic-size: none;
        }
        .card-wrapper {
            touch-action: pan-y;
            overscroll-behavior-x: none;
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
            .action-grip-rail {
                border-radius: 0 !important;
            }
            .actions-tray {
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
            justify-content: center;
            min-width: 0;
            padding: 12px;
            transform: translateY(var(--peek-content-y, 0px));
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
            gap: 8px;
        }
        .card-header.single-row {
            margin-bottom: 0;
        }
        .card-title {
            font-weight: 700;
            color: var(--text, #e0e0e0);
            font-size: 0.88rem;
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1 1 35%;
            min-width: 0;
            overflow: hidden;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .card-header-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex: 0 1 auto;
            max-width: 65%;
            min-width: 0;
            overflow: hidden;
        }
        .card-header-actions > ::slotted(*) {
            max-width: 100%;
            min-width: 0;
            overflow: hidden;
        }
        .card-desc {
            color: var(--text-muted, #888);
            font-size: 0.76rem;
            overflow-wrap: anywhere;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 4px;
        }
        .card-body {
            display: none;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;
            font-size: 0.8rem;
            line-height: 1.4;
            margin-top: 4px;
        }
        .card-body.has-content {
            display: flex;
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
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x pan-y;
            scrollbar-width: none;
            width: 100%;
            min-width: 0;
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
        ::slotted(button), ::slotted(yenvui-btn), ::slotted(yenvui-async-btn) {
            height: 30px;
            padding: 0 10px !important;
            font-size: 0.75rem !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            gap: 5px;
            white-space: nowrap;
            margin: 0 !important;
        }
        ::slotted([slot="actions"]) {
            display: inline-flex !important;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            margin: 0 !important;
            flex-shrink: 0;
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
            border: 2px solid var(--intent-danger, #ec4899) !important;
            box-shadow: 3px 4px 0 var(--intent-warning, #eab308) !important;
        }

        :host-context([data-theme="e-ink"]) .selection-strip {
            border-left-width: 5px !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .selection-strip,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .selection-strip {
            border-left-width: 14px !important;
            border-left-color: var(--intent-danger, #ec4899) !important;
        }

        :host-context([data-theme="e-ink"]) .action-grip-rail {
            background: var(--intent-primary, #8b5cf6) !important;
            border-left: 2px solid var(--border, #000000) !important;
            color: var(--bg, #ffffff) !important;
            font-weight: 900 !important;
        }
        :host-context([data-theme="e-ink"]):host([selected]) .action-grip-rail,
        :host-context([data-theme="e-ink"]):host([_overlayactive]) .action-grip-rail {
            background: var(--intent-danger, #ec4899) !important;
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
    `;constructor(){super(),this.titleText="",this.detailText="",this.detailPrefix="",this.detailSuffix="",this.descriptionText="",this.statusText="",this.icon="",this.intent="",this.disableSelection=!1,this.compact=!1,this.flush=!1,this.stale=!1,this._overlayActive=!1,this._hasActions=!1,this._hasBodySlot=!1,this.selected=!1,this._isPanning=!1,this._overlayListener=t=>{t.detail.source!==this&&this._overlayActive&&(this._overlayActive=!1)},this._focusOutListener=t=>{!this.contains(t.relatedTarget)&&this._overlayActive&&(this._overlayActive=!1)}}_initGestureController(){this._gestureController||(this._gestureController=new h(this,{scrollableContainerSelector:"actions-wrapper",onPanStart:(t,o)=>{const e=this.getBoundingClientRect();this._cardWidth=e.width,this._localStartX=t-e.left;const r=this.shadowRoot.querySelector(".actions-wrapper");this._actionsScrollLeft=r?r.scrollLeft:null,this._initialScrollLeft=this._actionsScrollLeft},onPanMove:(t,o,e)=>{if(e==="horizontal"&&this._overlayActive){const r=this._gestureController.startX-t,i=this.shadowRoot.querySelector(".actions-wrapper");if(i&&this._initialScrollLeft!==null){let n=this._initialScrollLeft+r;this._drawerRafId&&cancelAnimationFrame(this._drawerRafId),this._drawerRafId=requestAnimationFrame(()=>{n<0?i.style.transform=`translateX(${Math.abs(n)*.4}px)`:(i.style.transform="translateX(0px)",i.scrollLeft=n)})}}},onPanEnd:(t,o,e)=>{if(e!=="horizontal")return;const r=this._gestureController.startX-t;if(Math.abs(r)>10&&(this._isPanning=!0,setTimeout(()=>this._isPanning=!1,150)),this._overlayActive){const i=this.shadowRoot.querySelector(".actions-wrapper");i&&(i.style.transition="transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",i.style.transform="translateX(0px)",setTimeout(()=>{i.style.transition=""},200),this._initialScrollLeft+r<-(this._cardWidth*.2)&&(this._overlayActive=!1));return}if(Math.abs(r)>30){const i=r>30,n=r<-30,c=this._localStartX<this._cardWidth*.3,a=this._localStartX>this._cardWidth*.7;c&&n&&!this.disableSelection?this._toggleSelection():a&&i&&(this._hasActions||this.querySelector('[slot="actions"]'))&&(this._overlayActive=!0)}}}))}get actionsOpen(){return!!this._overlayActive}set actionsOpen(t){this._overlayActive=!!t}get hasActions(){return!!this._hasActions}set hasActions(t){this._hasActions=!!t}connectedCallback(){super.connectedCallback(),this.setAttribute("data-yv-card",""),this.addEventListener("focusout",this._focusOutListener),document.addEventListener("yenvui-overlay-opened",this._overlayListener),this.registerOutsideClick(()=>{this._overlayActive&&(this._overlayActive=!1)})}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("focusout",this._focusOutListener),document.removeEventListener("yenvui-overlay-opened",this._overlayListener),this._gestureController&&typeof this._gestureController.abort=="function"&&this._gestureController.abort()}updated(t){if(super.updated(t),t.has("_overlayActive")&&this._overlayActive&&(this.dispatchEvent(new CustomEvent("yenvui-overlay-opened",{bubbles:!0,composed:!0,detail:{source:this}})),this.dispatchEvent(new CustomEvent("yenvui-card-actions-opened",{bubbles:!0,composed:!0,detail:{source:this}}))),t.has("entityData")||t.has("filename")||t.has("titleText")){const o=t.get("filename"),e=t.get("titleText"),r=t.has("filename")&&o!==this.filename,i=t.has("titleText")&&e!==this.titleText;this._overlayActive&&(r||i)&&(this._overlayActive=!1)}}_toggleSelection(){this.selected=!this.selected,this.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:this.selected},bubbles:!0,composed:!0}))}firstUpdated(){this._checkActions()}_checkActions(){const t=this.shadowRoot.querySelector('slot[name="actions"]');if(t){const o=t.assignedElements({flatten:!0});this._hasActions=o.length>0}else this._hasActions=!!this.querySelector('[slot="actions"]')}_handleSlotChange(t){this._checkActions()}_handleBodySlotChange(t){const o=t.target.assignedNodes({flatten:!0});this._hasBodySlot=o.some(e=>e.nodeType===Node.ELEMENT_NODE||e.nodeType===Node.TEXT_NODE&&e.textContent.trim().length>0)}render(){const t=!this.descriptionText&&!this.detailText&&!this._hasBodySlot,o=this.intent?`var(--intent-${this.intent})`:"var(--intent-neutral)";return s`
            <div class="card-wrapper" style="--card-intent: ${o}"
                @mouseleave=${()=>{window.matchMedia("(hover: hover)").matches&&(!this._gestureController||!this._gestureController.active)&&(this._overlayActive=!1)}}
                @pointerdown=${e=>{this._initGestureController(),this._gestureController.start(e)}}>

                ${this.disableSelection?"":s`<div class="selection-hit-zone" title="Select Item" @click=${e=>{e.stopPropagation(),this._toggleSelection()}}></div><div class="selection-strip"></div>`}
                <div class="content-col" @click=${e=>{if(this._isPanning){e.stopPropagation(),e.preventDefault();return}this.dispatchEvent(new CustomEvent("yenvui-card-clicked",{detail:{filename:this.filename,isSource:!0},bubbles:!0,composed:!0}))}} style="cursor: pointer;">
                    <div class="card-header ${t?"single-row":""}">
                        <div class="card-title">
                            ${this.icon?/^[a-zA-Z0-9-]+$/.test(this.icon)?s`<yenvui-icon name="${this.icon}" size="sm" style="color: var(--card-intent, var(--intent-primary)); flex-shrink: 0;"></yenvui-icon>`:s`<span style="flex-shrink: 0;">${this.icon}</span>`:""}
                            <yenvui-scrub-track ?grow=${!0}>
                                ${this.titleText}
                            </yenvui-scrub-track>
                        </div>
                        <div class="card-header-actions">
                            ${this.statusText?s`<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; margin-right: 4px; flex-shrink: 0;">${this.statusText}</span>`:""}
                            <slot name="header-actions"></slot>
                            ${this.detailSuffix?s`
                                <div class="card-detail-suffix" style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); opacity: 0.85; flex-shrink: 0; margin-left: 8px;">
                                    ${this.detailSuffix.replace(/^[\s|]+/,"")}
                                </div>
                            `:""}
                        </div>
                    </div>

                    ${this.descriptionText?s`
                        <div class="card-desc">
                            ${this.descriptionText}
                        </div>
                    `:""}
                    ${this.detailText?s`
                        <div class="card-detail" style="color: var(--card-intent, var(--intent-primary));">
                            ${this.detailPrefix||""}${this.detailText}
                        </div>
                    `:""}

                    <div class="card-body ${this._hasBodySlot?"has-content":""}">
                        <slot @slotchange=${this._handleBodySlotChange}></slot>
                    </div>

                    <slot name="detail"></slot>
                    <slot name="inline-actions"></slot>
                </div>
                <div class="action-grip-rail"  
                    @pointerenter=${e=>{e.pointerType==="mouse"&&(this._overlayActive=!0)}}
                    @click=${e=>{e.stopPropagation(),e.preventDefault(),this._overlayActive=!this._overlayActive}}>
                    <yenvui-icon name="chevron-left" size="sm"></yenvui-icon>
                </div>
                <div class="actions-tray" @click=${{handleEvent:e=>{if(this._isPanning){e.stopPropagation(),e.preventDefault();return}const r=v(e),i=r.some(a=>a.tagName&&a.tagName.endsWith("-DROPDOWN")),n=r.some(a=>a.classList&&a.classList.contains("menu-item"));if(i&&!n)return;const c=r.some(a=>{if(!a.tagName)return!1;const l=a.tagName.toUpperCase();return!!(l==="BUTTON"||l.endsWith("-ASYNC-BTN")||l.endsWith("-BTN")||n)})},capture:!0}}>
                    ${t?"":s`<span class="tray-caption">${this.titleText}</span>`}
                    <div class="actions-wrapper">
                        <slot name="actions" @slotchange=${this._handleSlotChange}></slot>
                    </div>
                </div>
            </div>
        `}}customElements.define("yenvui-card",YenvuiCard);
