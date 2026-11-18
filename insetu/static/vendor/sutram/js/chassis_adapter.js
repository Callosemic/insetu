import{html as e,css as p}from"lit";import{SutramElement as c}from"./sutram_sdk.js";import{sharedStyles as d}from"./shared_styles.js";export class SutramDagTree extends c{static properties={stages:{type:Array},rootNode:{type:Object},nodes:{type:Array},renderNode:{type:Object},compact:{type:Boolean,reflect:!0}};static styles=[d,p`
        :host { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
        .wavefront-stage { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; background: var(--input-bg); border: 1px solid var(--border); border-left: 4px solid var(--stage-accent, var(--intent-primary)); border-radius: 8px; position: relative; }
        .wavefront-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .wavefront-title { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text); display: inline-flex; align-items: center; gap: 6px; }
        .wavefront-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
        .stage-connector { display: flex; align-items: center; justify-content: center; height: 14px; margin: -7px 0; color: var(--text-muted); font-size: 0.75rem; user-select: none; }
        .dag-node-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
        .dag-node-card:hover { border-color: var(--intent-primary); background: var(--bg-hover); }
        .tree-branch { position: relative; display: flex; flex-direction: column; padding-left: var(--branch-indent, 0px); }
        .tree-line-v { position: absolute; left: 10px; top: -12px; bottom: 0; width: 2px; background: var(--border); z-index: 1; }
        .tree-line-v.last { bottom: auto; height: 44px; }
        .tree-line-h { position: absolute; left: 10px; top: 30px; width: 18px; height: 2px; background: var(--border); z-index: 1; }
    `];constructor(){super(),this.stages=[],this.rootNode=null,this.nodes=[],this.renderNode=null,this.compact=!1}_renderDefaultStageNode(t,i){if(typeof this.renderNode=="function")return this.renderNode(t,i);const r=typeof t=="string"?t:t.title||t.label||t.id||t.name||"node",n=typeof t=="object"&&Array.isArray(t.badges)?t.badges:[],s=typeof t=="object"&&t.subtitle?String(t.subtitle):"",o=typeof t=="object"&&Array.isArray(t.parents)?t.parents:[];return e`
            <div class="dag-node-card" @click=${()=>this.dispatch("sutram-dag-node-clicked",{node:t,stageIdx:i})}>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="font-weight: bold; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text);">${r}</span>
                    ${n.length>0?e`
                        <div style="display: inline-flex; gap: 4px; align-items: center;">
                            ${n.map(a=>{const l=typeof a=="string"?a:a?.text||"",g=typeof a=="object"&&a?.intent?a.intent:"primary";return l?e`<sutram-tag text=${l} intent=${g}></sutram-tag>`:""})}
                        </div>
                    `:""}
                </div>
                ${s?e`<div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--intent-warning);">${s}</div>`:""}
                ${o.length>0?e`
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-top: 2px;">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">🔗 Parents:</span>
                        ${o.map(a=>e`<span style="font-size: 0.7rem; font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px;">${a}</span>`)}
                    </div>
                `:""}
            </div>
        `}_renderHierarchyBranch(t,i,r=0,n=!0){if(!t)return"";const s=i[t.id]||[];return e`
            <div class="tree-branch" style="--branch-indent: ${r>0?"28px":"0px"};">
                ${r>0?e`<div class="tree-line-v ${n?"last":""}"></div><div class="tree-line-h"></div>`:""}
                ${typeof this.renderNode=="function"?this.renderNode(t,r):this._renderDefaultStageNode(t,r)}
                ${s.length>0?e`
                    <div style="display: flex; flex-direction: column; margin-left: ${r===0?"8px":"0px"};">
                        ${s.map((o,a)=>this._renderHierarchyBranch(o,i,r+1,a===s.length-1))}
                    </div>
                `:""}
            </div>
        `}render(){if(Array.isArray(this.stages)&&this.stages.length>0)return e`
                ${this.stages.map((t,i)=>{const r=Array.isArray(t)?t:[t],n=r.length>1,s=n?"var(--intent-highlight)":i===0?"var(--intent-primary)":"var(--intent-success)";return e`
                        ${i>0?e`<div class="stage-connector">↓</div>`:""}
                        <div class="wavefront-stage" style="--stage-accent: ${s};">
                            <div class="wavefront-header">
                                <span class="wavefront-title">
                                    <sutram-icon name=${n?"git-branch":"layers"} size="sm" style="color: ${s};"></sutram-icon>
                                    <span>Wavefront Stage ${i+1}${i===0?" (Root)":""}</span>
                                </span>
                                <sutram-tag text=${n?`\u2225 Parallel Stage (${r.length} branches)`:"Sequential Step"} intent=${n?"highlight":"neutral"}></sutram-tag>
                            </div>
                            <div class="wavefront-grid">${r.map(o=>this._renderDefaultStageNode(o,i))}</div>
                        </div>
                    `})}
            `;if(this.rootNode){const t=(Array.isArray(this.nodes)?this.nodes:[]).reduce((i,r)=>{const n=r.parentId||r.parent_id;return n&&(i[n]=i[n]||[]).push(r),i},{});return e`${this._renderHierarchyBranch(this.rootNode,t,0,!0)}`}return e`<slot></slot>`}}customElements.get("sutram-dag-tree")||customElements.define("sutram-dag-tree",SutramDagTree);export class SutramFloatingHud extends c{static properties={position:{type:String,reflect:!0},icon:{type:String},badgeText:{type:String},titleText:{type:String},intent:{type:String,reflect:!0},open:{type:Boolean,reflect:!0}};static styles=[d,p`
        :host { position: absolute; z-index: 60; display: inline-flex; flex-direction: column; pointer-events: auto; max-width: calc(100% - 24px); box-sizing: border-box; --hud-accent: var(--intent-primary); }
        :host([position="top-right"]), :host(:not([position])) { top: 12px; right: 16px; align-items: flex-end; }
        :host([position="top-left"]) { top: 12px; left: 16px; align-items: flex-start; }
        :host([position="bottom-right"]) { bottom: 12px; right: 16px; align-items: flex-end; }
        :host([position="bottom-left"]) { bottom: 12px; left: 16px; align-items: flex-start; }
        :host([intent="primary"]) { --hud-accent: var(--intent-primary); }
        :host([intent="success"]) { --hud-accent: var(--intent-success); }
        :host([intent="warning"]) { --hud-accent: var(--intent-warning); }
        :host([intent="danger"]) { --hud-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --hud-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --hud-accent: var(--intent-neutral); }
        .hud-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; background: color-mix(in srgb, var(--pane-bg) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid color-mix(in srgb, var(--hud-accent) 45%, var(--border)); color: var(--text); font-family: var(--font-mono, monospace); font-size: 0.75rem; font-weight: 700; cursor: pointer; box-shadow: var(--overlay-shadow); user-select: none; transition: border-color 0.15s ease, transform 0.1s ease; }
        .hud-pill:hover { border-color: var(--hud-accent); }
        .hud-drawer { margin-top: 6px; width: 340px; max-width: calc(100vw - 24px); max-height: min(68dvh, 480px); overflow-y: auto; overflow-x: hidden; }
        .hud-title { font-weight: 700; font-size: 0.8rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `];constructor(){super(),this.position="top-right",this.icon="activity",this.badgeText="",this.titleText="",this.intent="primary",this.open=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1,this.dispatch("sutram-hud-toggled",{open:!1}))})}_toggleHud(t){t&&t.stopPropagation(),this.open=!this.open,this.dispatch("sutram-hud-toggled",{open:this.open})}render(){return e`
            <button type="button" class="hud-pill" @click=${t=>this._toggleHud(t)}>
                ${this.icon?e`<sutram-icon name=${this.icon} size="sm" intent=${this.intent||"primary"}></sutram-icon>`:""}
                ${this.badgeText?e`<span>${this.badgeText}</span>`:""}
                <sutram-icon name=${this.open?"chevron-up":"chevron-down"} size="xs" intent="muted"></sutram-icon>
            </button>
            ${this.open?e`
                <sutram-surface class="hud-drawer" variant="floating" .intent=${this.intent||"primary"} padding="sm" gap="xs" @click=${t=>t.stopPropagation()}>
                    <sutram-stack direction="row" justify="between" align="center" gap="xs">
                        <sutram-stack direction="row" align="center" gap="xs">
                            ${this.icon?e`<sutram-icon name=${this.icon} size="sm" intent=${this.intent||"primary"}></sutram-icon>`:""}
                            <span class="hud-title" title=${this.titleText||this.badgeText||"Status"}>${this.titleText||this.badgeText||"Status"}</span>
                        </sutram-stack>
                        <slot name="header"></slot>
                    </sutram-stack>
                    <slot></slot>
                    <slot name="footer"></slot>
                </sutram-surface>
            `:""}
        `}}customElements.get("sutram-floating-hud")||customElements.define("sutram-floating-hud",SutramFloatingHud);
