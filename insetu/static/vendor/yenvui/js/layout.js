import{html as t,css as o}from"lit";import{YenvuiBase as s}from"./yenvui-base.js";export class YenvuiView extends s{static properties={titleText:{type:String},descriptionText:{type:String},flush:{type:Boolean,reflect:!0},compact:{type:Boolean,reflect:!0},noScroll:{type:Boolean,reflect:!0},zen:{type:Boolean,reflect:!0},size:{type:String,reflect:!0},_hasFooterSlot:{type:Boolean,state:!0}};static styles=o`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            width: 100%;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
            container-type: inline-size;
            position: relative;
        }
        :host([zen]) {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            z-index: 99999;
            background: var(--bg-deep, #05070a);
            margin: 0;
            max-width: none;
            max-height: none;
            border: none;
            padding: 0;
        }
        .zen-exit-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100000;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--input-bg);
            color: var(--text-muted);
            border: 1px solid var(--border);
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0.25;
            transition: opacity 0.2s ease, color 0.2s ease, border-color 0.2s ease;
            pointer-events: auto;
        }
        @media (hover: none) {
            .zen-exit-btn { opacity: 0.65; }
        }
        :host([zen]) .zen-exit-btn {
            display: inline-flex;
        }
        :host([zen]) .zen-exit-btn:hover {
            opacity: 1;
            color: var(--intent-danger);
            border-color: var(--intent-danger);
        }
        .view-header,
        .view-toolbar,
        .view-footer {
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
        }
        .view-overlay {
            position: relative;
            width: 100%;
            height: 0;
            overflow: visible;
            z-index: 40;
        }
        .view-body {
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            min-width: 0;
            width: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            padding: var(--yv-view-padding, 16px 20px);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }
        :host([flush]) .view-body {
            padding: 0 !important;
        }
        :host([no-scroll]) .view-body,
        :host([noscroll]) .view-body {
            overflow: hidden !important;
        }
        :host([compact]),
        :host([size="compact"]) { --yv-view-max-width: var(--yv-view-compact, 540px); }
        :host([size="normal"]) { --yv-view-max-width: var(--yv-view-normal, 960px); }
        :host([size="wide"]) { --yv-view-max-width: var(--yv-view-wide, 1200px); }
        :host([size="full"]) { --yv-view-max-width: none; }
        .view-title-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            padding: 8px 0 12px 0;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }
        .view-title-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
        }
        .view-title-text h3 {
            margin: 0;
            font-size: 1.1rem;
            color: var(--text);
        }
        .view-title-desc {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted);
        }
        .view-title-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .view-footer.has-direct-actions {
            padding: 10px 14px;
            gap: 8px;
            border-top: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            align-items: center;
        }
        .view-footer.has-direct-actions ::slotted(*) {
            flex: 1 1 0%;
        }
        .view-inner {
            width: 100%;
            max-width: var(--yv-view-max-width, none);
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            flex: 0 0 auto;
            min-width: 0;
        }
        :host([no-scroll]) .view-inner,
        :host([noscroll]) .view-inner {
            flex: 1 1 0%;
            min-height: 0;
            height: 100%;
        }
        :host([no-scroll]) .view-inner > ::slotted(*),
        :host([noscroll]) .view-inner > ::slotted(*) {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            min-width: 0 !important;
            height: 100% !important;
            width: 100% !important;
        }
        @container (max-width: 480px) {
            :host(:not([flush])) .view-body {
                padding: 0;
            }
        }
    `;constructor(){super(),this.titleText="",this.descriptionText="",this.flush=!1,this.compact=!1,this.noScroll=!1,this.zen=!1,this.size="",this._hasFooterSlot=!1,this._hasDirectFooterButtons=!1}_handleFooterSlotChange(i){const e=i.target.assignedElements({flatten:!0});this._hasFooterSlot=e.length>0,this._hasDirectFooterButtons=e.some(a=>{const r=a.tagName?.toLowerCase()||"";return r.endsWith("-btn")||r==="button"}),this.requestUpdate()}render(){return t`
            <div class="view-header"><slot name="header"></slot></div>
            <div class="view-toolbar"><slot name="toolbar"></slot></div>
            <div class="view-overlay"><slot name="overlay"></slot></div>
            <div class="view-body">
                <div class="view-inner">
                    ${this.titleText?t`
                        <div class="view-title-bar">
                            <div class="view-title-text">
                                <h3>${this.titleText}</h3>
                                ${this.descriptionText?t`<span class="view-title-desc">${this.descriptionText}</span>`:""}
                            </div>
                            <div class="view-title-actions">
                                <slot name="header-actions"></slot>
                            </div>
                        </div>
                    `:""}
                    <slot></slot>
                </div>
            </div>
            <div class="view-footer ${this._hasDirectFooterButtons?"has-direct-actions":""}"><slot name="footer" @slotchange=${this._handleFooterSlotChange}></slot></div>
            ${this.zen?t`
                <button
                    type="button"
                    class="zen-exit-btn"
                    title="Exit Focus Mode (Esc)"
                    @click=${i=>{i.preventDefault(),i.stopPropagation(),this.dispatchEvent(new CustomEvent("yenvui-view-exit-zen",{bubbles:!0,composed:!0}))}}>
                    <yenvui-icon name="minimize-2" size="md"></yenvui-icon>
                </button>
            `:""}
        `}}customElements.get("yenvui-view")||customElements.define("yenvui-view",YenvuiView);export class YenvuiStack extends s{static properties={direction:{type:String,reflect:!0},columns:{type:String,reflect:!0},gap:{type:String,reflect:!0},align:{type:String,reflect:!0},justify:{type:String,reflect:!0},padding:{type:String,reflect:!0},compact:{type:Boolean,reflect:!0},grow:{type:Boolean,reflect:!0},wrap:{type:Boolean,reflect:!0},flex:{type:Boolean,reflect:!0},scrollable:{type:Boolean,reflect:!0},spanFull:{type:Boolean,reflect:!0}};static styles=o`
        :host {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            flex-shrink: 0;
            gap: var(--yv-stack-gap, 12px);
            box-sizing: border-box;
            min-width: 0;
        }
        :host([direction="row"]) {
            flex-direction: row !important;
            align-items: center;
            width: auto;
        }
        :host([direction="col"]),
        :host([direction="column"]) {
            flex-direction: column;
            width: 100%;
        }
        :host([direction="grid"]) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(var(--yv-grid-min-col, var(--yv-col-normal, 240px)), 1fr));
            width: 100%;
        }
        :host([direction="grid"]) ::slotted(yenvui-textarea:not([inline])) {
            grid-column: 1 / -1;
        }
        :host([compact]),
        :host([columns="compact"]) { --yv-grid-min-col: var(--yv-col-compact, 160px); }
        :host([columns="normal"]) { --yv-grid-min-col: var(--yv-col-normal, 240px); }
        :host([columns="wide"]) { --yv-grid-min-col: var(--yv-col-wide, 320px); }

        :host([gap="none"]) { --yv-stack-gap: 0px; }
        :host([gap="xs"]) { --yv-stack-gap: 4px; }
        :host([gap="normal"]),
        :host([gap="md"]) { --yv-stack-gap: 12px; }
        :host([compact]),
        :host([gap="compact"]),
        :host([gap="sm"]) { --yv-stack-gap: 8px; }
        :host([gap="wide"]),
        :host([gap="lg"]) { --yv-stack-gap: 16px; }
        :host([gap="xl"]) { --yv-stack-gap: 24px; }

        :host([align="start"]) { align-items: flex-start; }
        :host([align="center"]) { align-items: center; }
        :host([align="end"]) { align-items: flex-end; }
        :host([align="stretch"]) { align-items: stretch; }
        :host([align="baseline"]) { align-items: baseline; }

        :host([justify="start"]) { justify-content: flex-start; }
        :host([justify="center"]) { justify-content: center; }
        :host([justify="end"]) { justify-content: flex-end; }
        :host([justify="between"]) { justify-content: space-between; }
        :host([justify="around"]) { justify-content: space-around; }

        :host([padding="none"]) { padding: 0; }
        :host([padding="xs"]) { padding: 4px 8px; }
        :host([padding="compact"]),
        :host([padding="sm"]) { padding: 8px 12px; }
        :host([padding="normal"]),
        :host([padding="md"]) { padding: 12px 16px; }
        :host([padding="wide"]),
        :host([padding="lg"]) { padding: 16px 20px; }

        :host([grow]) ::slotted(*) { flex: 1 1 0%; }
        :host([wrap]) { flex-wrap: wrap; }
        :host([flex]) { flex: 1; min-height: 0; }
        :host([scrollable]) { overflow-y: auto; max-height: var(--yv-stack-max-height, 360px); }
        :host([flex][scrollable]) { max-height: none; }
        :host([spanfull]) { grid-column: 1 / -1; }
    `;constructor(){super(),this.direction="col",this.columns="",this.gap="md",this.align="",this.justify="",this.padding="",this.compact=!1,this.grow=!1,this.wrap=!1,this.flex=!1,this.scrollable=!1,this.spanFull=!1}render(){return t`<slot></slot>`}}customElements.get("yenvui-stack")||customElements.define("yenvui-stack",YenvuiStack);export class YenvuiSurface extends s{static properties={variant:{type:String,reflect:!0},intent:{type:String,reflect:!0},padding:{type:String,reflect:!0},border:{type:String,reflect:!0},gap:{type:String,reflect:!0},align:{type:String,reflect:!0},justify:{type:String,reflect:!0},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},flex:{type:Boolean,reflect:!0},interactive:{type:Boolean,reflect:!0}};static styles=o`
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--yv-surface-gap, 10px);
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: var(--yv-surface-radius, 8px);
            padding: var(--yv-surface-padding, 14px 16px);
            box-sizing: border-box;
            min-width: 0;
            color: var(--text);
            --surface-accent: var(--intent-primary);
        }

        :host([intent="primary"]) { --surface-accent: var(--intent-primary); }
        :host([intent="success"]) { --surface-accent: var(--intent-success); }
        :host([intent="warning"]) { --surface-accent: var(--intent-warning); }
        :host([intent="danger"]) { --surface-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --surface-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --surface-accent: var(--intent-neutral); }

        :host([variant="panel"]) {
            background: var(--input-bg);
        }
        :host([variant="inset"]) {
            background: var(--bg);
        }
        :host([variant="tinted"]) {
            background: color-mix(in srgb, var(--surface-accent) 10%, var(--input-bg));
            border-color: color-mix(in srgb, var(--surface-accent) 35%, var(--border));
        }
        :host([variant="floating"]) {
            background: color-mix(in srgb, var(--pane-bg) 95%, transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            box-shadow: var(--overlay-shadow);
        }
        :host([variant="ghost"]) {
            background: transparent;
            border-color: transparent;
        }
        :host([variant="banner"]) {
            position: fixed;
            bottom: 30px;
            left: 0;
            right: 0;
            z-index: 1000;
            background: color-mix(in srgb, var(--surface-accent) 12%, var(--pane-bg));
            border: none;
            border-top: 1px solid color-mix(in srgb, var(--surface-accent) 45%, var(--border));
            --yv-surface-radius: 0px;
            --yv-surface-padding: 6px 12px;
        }
        :host([variant="dropzone"]) {
            background: color-mix(in srgb, var(--surface-accent) 10%, var(--input-bg));
            border: 1px dashed color-mix(in srgb, var(--surface-accent) 45%, var(--border));
            min-height: var(--yv-surface-min-h-wide, 300px);
            align-items: center;
            justify-content: center;
            --yv-surface-padding: 18px 20px;
        }
        :host([variant="bubble"]) {
            max-width: var(--yv-bubble-max-width, 88%);
            align-self: flex-start;
            background: var(--input-bg);
            --yv-surface-padding: 12px 14px;
            --yv-surface-gap: 4px;
        }
        :host([variant="bubble"][intent="primary"]) {
            align-self: flex-end;
            background: color-mix(in srgb, var(--surface-accent) 12%, var(--input-bg));
            border-color: color-mix(in srgb, var(--surface-accent) 35%, var(--border));
        }

        :host([flush]),
        :host([padding="none"]) { --yv-surface-padding: 0px; }
        :host([padding="xs"]) { --yv-surface-padding: 6px 10px; }
        :host([padding="normal"]),
        :host([padding="md"]) { --yv-surface-padding: 14px 16px; }
        :host([compact]),
        :host([padding="compact"]),
        :host([padding="sm"]) { --yv-surface-padding: 8px 12px; }
        :host([padding="wide"]),
        :host([padding="lg"]) { --yv-surface-padding: 18px 20px; }

        :host([gap="none"]) { --yv-surface-gap: 0px; }
        :host([gap="xs"]) { --yv-surface-gap: 4px; }
        :host([gap="normal"]),
        :host([gap="md"]) { --yv-surface-gap: 12px; }
        :host([compact]),
        :host([gap="compact"]),
        :host([gap="sm"]) { --yv-surface-gap: 8px; }
        :host([gap="wide"]),
        :host([gap="lg"]) { --yv-surface-gap: 16px; }

        :host([border="none"]) { border: none; }
        :host([border="top"]) { border: none; border-top: 1px solid var(--border); --yv-surface-radius: 0px; }
        :host([border="bottom"]) { border: none; border-bottom: 1px solid var(--border); --yv-surface-radius: 0px; }
        :host([border="left"]) { border-left: 4px solid var(--surface-accent); }

        :host([align="start"]) { align-items: flex-start; }
        :host([align="center"]) { align-items: center; }
        :host([align="end"]) { align-items: flex-end; }
        :host([align="stretch"]) { align-items: stretch; }

        :host([justify="start"]) { justify-content: flex-start; }
        :host([justify="center"]) { justify-content: center; }
        :host([justify="end"]) { justify-content: flex-end; }
        :host([justify="between"]) { justify-content: space-between; }
        :host([flex]) { flex: 1 1 0%; min-height: 0; }
        :host([interactive]) {
            cursor: pointer;
            user-select: none;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        :host([interactive]:hover) {
            background: var(--bg-hover);
            border-color: color-mix(in srgb, var(--surface-accent) 45%, var(--border));
        }

        :host-context([data-theme="e-ink"]) {
            background: var(--bg, #ffffff) !important;
            border-color: var(--border, #000000) !important;
            backdrop-filter: none !important;
        }
        :host-context([data-theme="e-ink"]):host([variant="floating"]) {
            border-width: 2px !important;
            box-shadow: 4px 4px 0 var(--surface-accent, #000000) !important;
        }
    `;constructor(){super(),this.variant="panel",this.intent="",this.padding="md",this.border="all",this.gap="sm",this.align="",this.justify="",this.compact=!1,this.flush=!1,this.flex=!1,this.interactive=!1}render(){return t`<slot></slot>`}}customElements.get("yenvui-surface")||customElements.define("yenvui-surface",YenvuiSurface);export class YenvuiActionBar extends s{static properties={collapse:{type:String,reflect:!0},align:{type:String,reflect:!0},gap:{type:String,reflect:!0},nowrap:{type:Boolean,reflect:!0},_overflowing:{type:Boolean,reflect:!0,attribute:"data-overflow"}};static styles=o`
        :host {
            display: flex;
            align-items: center;
            gap: var(--yv-action-bar-gap, 8px);
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            flex-wrap: wrap;
        }
        :host([nowrap]) {
            flex-wrap: nowrap;
            overflow-x: auto;
            scrollbar-width: none;
        }
        :host([nowrap])::-webkit-scrollbar {
            display: none;
        }
        :host([gap="none"]) { --yv-action-bar-gap: 0px; }
        :host([gap="xs"]) { --yv-action-bar-gap: 4px; }
        :host([gap="compact"]),
        :host([gap="sm"]) { --yv-action-bar-gap: 8px; }
        :host([gap="normal"]),
        :host([gap="md"]) { --yv-action-bar-gap: 12px; }
        :host([gap="wide"]),
        :host([gap="lg"]) { --yv-action-bar-gap: 16px; }

        :host([align="start"]) { justify-content: flex-start; }
        :host([align="center"]) { justify-content: center; }
        :host([align="end"]) { justify-content: flex-end; }
        :host([align="between"]) { justify-content: space-between; }

        :host([data-overflow]:not([collapse="none"])) ::slotted(*) {
            --yv-btn-label-display: none;
            --yv-btn-label-gap: 0px;
        }
    `;constructor(){super(),this.collapse="auto",this.align="start",this.gap="sm",this.nowrap=!1,this._overflowing=!1,this._expandedMinWidth=0,this._measuring=!1}connectedCallback(){super.connectedCallback(),typeof ResizeObserver<"u"&&(this._resizeObserver=new ResizeObserver(()=>{this._checkOverflow()}),this._resizeObserver.observe(this))}disconnectedCallback(){super.disconnectedCallback(),this._resizeObserver&&(this._resizeObserver.disconnect(),this._resizeObserver=null)}firstUpdated(){this._checkOverflow(!0)}_checkOverflow(i=!1){if(this._measuring||this.collapse==="none")return;const e=this.clientWidth;if(!(e<=0)&&!(this._overflowing&&!i&&this._expandedMinWidth>0&&e<this._expandedMinWidth)){this._measuring=!0;try{this._overflowing&&this.removeAttribute("data-overflow");const r=this.style.flexWrap;this.style.flexWrap="nowrap";const n=this.scrollWidth;this.style.flexWrap=r,n>e+1?(this._expandedMinWidth=n+4,this._overflowing=!0,this.setAttribute("data-overflow","")):(this._expandedMinWidth=n,this._overflowing=!1,this.removeAttribute("data-overflow"))}finally{this._measuring=!1}}}render(){return t`<slot @slotchange=${()=>{this._expandedMinWidth=0,this._checkOverflow(!0)}}></slot>`}}customElements.get("yenvui-action-bar")||customElements.define("yenvui-action-bar",YenvuiActionBar);export class YenvuiSidebarLayout extends s{static properties={intent:{type:String,reflect:!0},drawerOpen:{type:Boolean,reflect:!0},collapsed:{type:Boolean,reflect:!0},navTitle:{type:String},navItems:{type:Array},activeNavId:{type:String},_hasSidebarSlot:{type:Boolean,state:!0}};static styles=o`
        :host {
            display: flex;
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            container-type: inline-size;
            background: var(--bg);
            --sidebar-accent: var(--intent-highlight);
        }
        :host([intent="primary"]) { --sidebar-accent: var(--intent-primary); }
        :host([intent="success"]) { --sidebar-accent: var(--intent-success); }
        :host([intent="warning"]) { --sidebar-accent: var(--intent-warning); }
        :host([intent="danger"]) { --sidebar-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --sidebar-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --sidebar-accent: var(--intent-neutral); }

        .sidebar-backdrop {
            display: none;
        }
        .sidebar-rail {
            width: 240px;
            border-right: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            flex-direction: column;
            padding: 10px;
            gap: 6px;
            flex-shrink: 0;
            box-sizing: border-box;
            overflow: hidden;
            z-index: 40;
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        :host([collapsed]) .sidebar-rail {
            display: none;
        }
        @container (max-width: 45rem) {
            .sidebar-rail,
            :host([collapsed]) .sidebar-rail {
                display: flex;
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                width: 260px;
                max-width: 82%;
                background: color-mix(in srgb, var(--pane-bg) 96%, transparent);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: var(--overlay-shadow, 0 12px 32px rgba(0, 0, 0, 0.45));
                transform: translateX(-105%);
            }
            :host([draweropen]) .sidebar-rail {
                transform: translateX(0);
            }
            :host([draweropen]) .sidebar-backdrop {
                display: block;
                position: absolute;
                inset: 0;
                background: var(--modal-backdrop, rgba(0, 0, 0, 0.45));
                z-index: 35;
            }
        }
        .sidebar-slot-wrap {
            flex: 1 1 0%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .sidebar-divider {
            border: none;
            border-top: 1px solid var(--border);
            margin: 6px 0;
            width: 100%;
            flex-shrink: 0;
        }
        .nav-section {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex-shrink: 0;
        }
        .nav-header {
            font-size: 0.7rem;
            font-weight: 800;
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--sidebar-accent);
            padding: 4px 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .nav-header-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--sidebar-accent);
        }
        .nav-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-muted);
            background: transparent;
            border: 1px solid transparent;
            border-left: 3px solid transparent;
            user-select: none;
            transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
            text-align: left;
            width: 100%;
            box-sizing: border-box;
            font-family: inherit;
        }
        .nav-item:hover {
            background: color-mix(in srgb, var(--item-accent, var(--sidebar-accent)) 8%, var(--bg-hover));
            color: var(--text);
        }
        .nav-item.active {
            background: color-mix(in srgb, var(--item-accent, var(--sidebar-accent)) 16%, var(--bg));
            color: var(--text);
            border-color: color-mix(in srgb, var(--item-accent, var(--sidebar-accent)) 40%, var(--border));
            border-left: 3px solid var(--item-accent, var(--sidebar-accent));
        }
        .nav-item-main {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }
        .nav-badge {
            background: var(--item-accent, var(--sidebar-accent));
            color: #ffffff;
            font-size: 0.7rem;
            font-family: var(--font-mono);
            padding: 1px 6px;
            border-radius: 10px;
            line-height: 1.3;
        }
        .nav-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--item-accent, var(--sidebar-accent));
            opacity: 0.35;
        }
        .nav-item.active .nav-dot {
            opacity: 1;
        }
        .stage-pane {
            flex: 1 1 0%;
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            background: var(--bg);
        }
    `;constructor(){super(),this.intent="highlight",this.drawerOpen=!1,this.collapsed=!1,this.navTitle="",this.navItems=[],this.activeNavId="",this._hasSidebarSlot=!1}render(){const i=Array.isArray(this.navItems)?this.navItems:[];return t`
            <div class="sidebar-backdrop" @click=${()=>{this.dispatchEvent(new CustomEvent("yenvui-drawer-closed",{bubbles:!0,composed:!0}))}}></div>
            <aside class="sidebar-rail">
                <div class="sidebar-slot-wrap">
                    <slot name="sidebar" @slotchange=${e=>{this._hasSidebarSlot=e.target.assignedNodes({flatten:!0}).length>0}}></slot>
                </div>
                ${this._hasSidebarSlot&&i.length>0?t`<hr class="sidebar-divider">`:""}
                ${i.length>0?t`
                    <nav class="nav-section">
                        ${this.navTitle?t`
                            <div class="nav-header">
                                <span>${this.navTitle}</span>
                                <span class="nav-header-dot"></span>
                            </div>
                        `:""}
                        ${i.map(e=>{const a=e.id||e.rawId||"",r=!!(this.activeNavId&&(this.activeNavId===a||this.activeNavId===e.rawId)),n=e.intent||this.intent||"highlight",c=`var(--intent-${n})`;return t`
                                <button
                                    type="button"
                                    class="nav-item ${r?"active":""}"
                                    style="--item-accent: ${c};"
                                    @click=${()=>{this.dispatchEvent(new CustomEvent("yenvui-nav-selected",{detail:{id:a,item:e},bubbles:!0,composed:!0}))}}>
                                    <span class="nav-item-main">
                                        <yenvui-icon name=${e.icon||"component"} size="sm" intent=${n}></yenvui-icon>
                                        <span>${e.label||a}</span>
                                    </span>
                                    ${e.badge!==void 0&&e.badge!==null&&e.badge!==""&&e.badge!==0?t`
                                        <span class="nav-badge">${e.badge}</span>
                                    `:t`
                                        <span class="nav-dot"></span>
                                    `}
                                </button>
                            `})}
                    </nav>
                `:""}
            </aside>
            <main class="stage-pane">
                <slot></slot>
            </main>
        `}}customElements.get("yenvui-sidebar-layout")||customElements.define("yenvui-sidebar-layout",YenvuiSidebarLayout);
