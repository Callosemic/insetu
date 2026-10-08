import{LitElement as b,html as y,css as f}from"lit";import{YenvuiGestureController as x,getDeepElementFromPoint as g}from"./physics.js";export class YenvuiCardGroup extends b{static properties={enableEdgeSelection:{type:Boolean},stacked:{type:Boolean,reflect:!0},accordion:{type:Boolean,reflect:!0},expanded:{type:Boolean,reflect:!0},_childCount:{type:Number,state:!0},_exceedsViewport:{type:Boolean,state:!0}};static styles=f`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            position: relative;
            touch-action: pan-x pan-y;
        }
        :host([stacked]) {
            gap: 0;
        }
        .more-handle,
        .collapse-handle {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 10px;
            margin-top: 0;
            background: color-mix(in srgb, var(--intent-primary) 8%, var(--input-bg));
            border: 1px solid var(--border);
            border-top: none;
            border-radius: 0 0 6px 6px;
            cursor: pointer;
            color: color-mix(in srgb, var(--intent-primary) 70%, var(--text-muted));
            font-size: 0.75rem;
            font-weight: 700;
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            transition: background 0.2s, color 0.2s, margin-top 0.3s;
            z-index: 0;
            box-sizing: border-box;
        }
        .more-handle {
            position: relative;
            width: 100%;
            margin-top: -4px;
            margin-bottom: 10px;
            box-shadow: var(--overlay-shadow, 0 4px 12px rgba(0,0,0,0.15));
        }
        .collapse-handle.top {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            z-index: 1;
            border-top: none;
            border-bottom: 1px solid var(--border);
            border-radius: 0;
            margin-top: 0;
            box-shadow: var(--overlay-shadow, 0 4px 12px rgba(0,0,0,0.1));
            transition: background 0.2s, color 0.2s, top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .more-handle:hover,
        .collapse-handle:hover {
            background: color-mix(in srgb, var(--intent-primary) 15%, var(--input-bg));
            color: var(--intent-primary);
        }
        @container (max-width: 480px) {
            .more-handle,
            .collapse-handle {
                width: 100% !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                border-radius: 0 !important;
                border-left: none !important;
                border-right: none !important;
            }
        }
    `;constructor(){super(),this.enableEdgeSelection=!0,this.stacked=!1,this.accordion=!1,this.expanded=!1,this._childCount=0,this._handleStackClick=this._handleStackClick.bind(this),this._gestureController=new x(this,{scrollableContainerSelector:"actions-wrapper",onPanEnd:(e,r,s)=>{if(s==="horizontal"&&this.enableEdgeSelection&&this._gestureController.startX<30){const n=e-this._gestureController.startX,p=Math.abs(r-this._gestureController.startY);if(n>30&&n>p){const o=g(e,r,"yenvui-card");o&&!o.disableSelection&&(o.selected=!o.selected,o.dispatchEvent(new CustomEvent("yenvui-card-select-toggled",{detail:{selected:o.selected},bubbles:!0,composed:!0})))}}}})}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._handleStackClick,{capture:!0}),this._resizeObserver=new ResizeObserver(()=>{this.stacked&&requestAnimationFrame(()=>this._applyStackedZIndex())})}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this._handleStackClick,{capture:!0}),this._resizeObserver&&this._resizeObserver.disconnect(),this._gestureController&&typeof this._gestureController.abort=="function"&&this._gestureController.abort()}firstUpdated(){this.stacked&&this._applyStackedZIndex()}updated(e){super.updated(e),(e.has("stacked")||e.has("expanded"))&&requestAnimationFrame(()=>this._applyStackedZIndex())}_handleSlotChange(){const e=this.shadowRoot.querySelector("slot");if(e){const r=e.assignedElements({flatten:!0});this._childCount=r.length,this._resizeObserver&&(this._resizeObserver.disconnect(),r.forEach(s=>this._resizeObserver.observe(s)))}this.stacked&&requestAnimationFrame(()=>this._applyStackedZIndex())}_handleStackClick(e){if(!this.stacked||!this.accordion||this._childCount<=1)return;const r=e.composedPath();if(r.some(a=>{if(!a||!a.tagName)return!1;if(a._overlayActive)return!0;const t=a.tagName.toLowerCase();return!!(t==="button"||t==="sutram-async-btn"||t==="yenvui-async-btn"||t==="sutram-entity-actions"||a.classList&&(a.classList.contains("actions-tray")||a.classList.contains("trigger-bar")||a.classList.contains("actions-wrapper")||a.classList.contains("selection-gutter")))}))return;const n=this.shadowRoot.querySelector("slot");if(!n)return;const p=n.assignedElements({flatten:!0});if(p.length===0)return;const o=p[0];this.expanded||r.includes(o)||(this.expanded=!0,e.stopPropagation())}_applyStackedZIndex(){const e=this.shadowRoot.querySelector("slot");if(!e)return;const r=e.assignedElements({flatten:!0}),s=r.length,n=this.stacked;let p=0,o=0;const a=r.map(t=>t.offsetHeight||0);if(r.forEach((t,i)=>{if(!t.style)return;const d=a[i];o+=d,i===0&&(p=d),t.style.position="relative",t.style.zIndex=i===0?s+2:s-i,t.style.transition="margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, filter 0.3s, clip-path 0.3s cubic-bezier(0.4, 0, 0.2, 1)",t.style.transformOrigin="top left";const m=1;if(this.accordion&&!this.expanded&&i>0)if(i<=m){if(d>0){const c=Math.max(0,d-26);t.style.marginTop=`-${c}px`;const l=c;t.style.clipPath=l>0?`inset(${l}px -20px -20px -20px)`:"inset(0px -20px -20px -20px)"}t.style.transform="scale(1)",t.style.filter="brightness(0.7)",t.style.opacity="1",t.style.setProperty("--peek-rail-opacity","0"),t.style.setProperty("--peek-content-y","7px"),t.style.pointerEvents="auto",t.style.display=""}else t.style.display="none";else t.style.marginTop="0px",t.style.transform="scale(1)",t.style.filter="",t.style.opacity="1",t.style.removeProperty("--peek-rail-opacity"),t.style.removeProperty("--peek-content-y"),t.style.pointerEvents="auto",t.style.display="",t.style.clipPath="inset(0px -20px -20px -20px)",t.style.maxHeight="",t.style.overflow="";if(n){t.style.setProperty("--card-margin-bottom","0px");const u=this.accordion&&!this.expanded?Math.min(1,s-1):s-1,c=this.accordion&&!this.expanded&&s>2;if(i===0){t.style.setProperty("--card-border-top","1px solid var(--border, #444)"),t.style.setProperty("--card-border-top-left-radius","6px"),t.style.setProperty("--card-border-top-right-radius","6px");const l=s===1;t.style.setProperty("--card-border-bottom-left-radius",l?"6px":"0px"),t.style.setProperty("--card-border-bottom-right-radius",l?"6px":"0px"),t.style.setProperty("--card-top-shadow","none")}else if(t.style.setProperty("--card-border-top","none"),t.style.setProperty("--card-border-top-left-radius","0px"),t.style.setProperty("--card-border-top-right-radius","0px"),t.style.setProperty("--card-top-shadow","none"),i===u){const h=c||this.accordion&&this.expanded?"0px":"6px";t.style.setProperty("--card-border-bottom-left-radius",h),t.style.setProperty("--card-border-bottom-right-radius",h)}else t.style.setProperty("--card-border-bottom-left-radius","0px"),t.style.setProperty("--card-border-bottom-right-radius","0px")}else t.style.removeProperty("--card-margin-bottom"),t.style.removeProperty("--card-border-top"),t.style.removeProperty("--card-border-top-left-radius"),t.style.removeProperty("--card-border-top-right-radius"),t.style.removeProperty("--card-border-bottom-left-radius"),t.style.removeProperty("--card-border-bottom-right-radius"),t.style.removeProperty("--card-top-shadow")}),this.accordion&&this.expanded&&s>1){const t=this.shadowRoot.querySelector(".collapse-handle.top");t&&(t.style.zIndex=s+1,t.style.top=`${p}px`,r[1]&&(r[1].style.marginTop=`${t.offsetHeight}px`))}if(this.accordion){const t=o>window.innerHeight*.75;this._exceedsViewport!==t&&(this._exceedsViewport=t,this.requestUpdate())}}render(){const e=this._childCount-1;return y`
            <div @pointerdown=${r=>this._gestureController.start(r)} style="display: contents;">
                <slot @slotchange=${this._handleSlotChange}></slot>
            </div>
            ${this.accordion&&this.stacked&&!this.expanded&&e>0?y`
                <div class="more-handle" @click=${()=>this.expanded=!0}>
                    <span>Expand ${e} item${e!==1?"s":""}</span>
                    <span style="font-size: 0.65rem; margin-top: 1px; opacity: 0.8;">▼</span>
                </div>
            `:""}
            ${this.accordion&&this.stacked&&this.expanded&&this._childCount>1?y`
                ${this._exceedsViewport?y`
                    <div class="collapse-handle top" @click=${()=>this.expanded=!1}>
                        <span style="font-size: 0.65rem; margin-top: 1px; opacity: 0.8; transform: rotate(180deg);">▼</span>
                        <span>Collapse Stack</span>
                    </div>
                `:""}
                <div class="collapse-handle bottom" @click=${()=>this.expanded=!1}>
                    <span style="font-size: 0.65rem; margin-top: 1px; opacity: 0.8; transform: rotate(180deg);">▼</span>
                    <span>Collapse Stack</span>
                </div>
            `:""}
        `}}customElements.define("yenvui-card-group",YenvuiCardGroup);
