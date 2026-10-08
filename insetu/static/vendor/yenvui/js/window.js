import{html as n,css as i}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";import"./physics.js";export class YenvuiWindow extends r{static properties={titleText:{type:String},anchorCol:{type:String},span:{type:Number},z:{type:Number},icon:{type:String},intent:{type:String}};static styles=i`
        :host { display: contents; }
        dialog {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: var(--pane-bg);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 0;
            box-shadow: var(--overlay-shadow);
            display: none;
            flex-direction: column;
            max-width: none;
            max-height: none;
            overflow: hidden;
            resize: none;
        }
        dialog[open] { display: flex; }
        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 15px; border-bottom: 1px solid var(--border);
            background: var(--input-bg); cursor: grab; user-select: none;
            border-top: 4px solid var(--intent-color, var(--intent-primary));
        }
        .header:active { cursor: grabbing; }
        .title-area { display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 0.95rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .window-btn { background: transparent; color: var(--text-muted); border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; line-height: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono, monospace); font-weight: bold; transition: all 0.15s ease; }
        .window-btn:hover { background: var(--bg-hover); color: var(--text); }
        .window-btn.active-span { background: color-mix(in srgb, var(--intent-color, var(--intent-primary)) 20%, transparent); color: var(--intent-color, var(--intent-primary)); border: 1px solid var(--intent-color, var(--intent-primary)); }
        .window-btn.close-btn:hover { color: var(--intent-danger); background: color-mix(in srgb, var(--intent-danger) 15%, transparent); }
        .body { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--bg); }

        :host([data-theme="e-ink"]) dialog {
            border: 2px solid #000;
            box-shadow: 4px 4px 0 var(--intent-color, #8b5cf6);
        }
    `;constructor(){super(),this.anchorCol="center",this.span=1,this.z=1e3,this.titleText="",this.icon="component",this.intent="primary"}updated(t){super.updated(t);const e=this.shadowRoot.querySelector("dialog");if(e){e.open||e.show(),e.style.zIndex=this.z;const o=`var(--intent-${this.intent})`;e.style.setProperty("--intent-color",o)}}render(){return n`
            <dialog @pointerdown=${()=>this.dispatchEvent(new CustomEvent("yenvui-window-focus",{bubbles:!0,composed:!0}))}>
                <div class="header" 
                    @dblclick=${t=>{t.stopPropagation(),this.dispatchEvent(new CustomEvent("yenvui-window-dock",{bubbles:!0,composed:!0}))}}
                    @pointerdown=${t=>{t.stopPropagation();const e=Date.now();if(e-(this._lastTapTime||0)<300){this.dispatchEvent(new CustomEvent("yenvui-window-dock",{bubbles:!0,composed:!0})),this._lastTapTime=0;return}this._lastTapTime=e,this.dispatchEvent(new CustomEvent("yenvui-window-drag-start",{detail:{originalEvent:t},bubbles:!0,composed:!0}))}}>
                    <div class="title-area">
                        <yv-icon name="${this.icon}" style="width: 14px; height: 14px; color: var(--intent-color, var(--intent-primary));"></yv-icon>
                        ${this.titleText}
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button class="window-btn close-btn" title="Close" @pointerdown=${t=>t.stopPropagation()} @click=${()=>this.dispatchEvent(new CustomEvent("yenvui-window-close",{bubbles:!0,composed:!0}))}>
                            <yv-icon name="x" style="width: 16px; height: 16px;"></yv-icon>
                        </button>
                    </div>
                </div>
                <div class="body"><slot></slot></div>
            </dialog>
        `}}customElements.define("yenvui-window",YenvuiWindow);
