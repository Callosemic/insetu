import{Input as f,Select as x,Textarea as y,Toggle as v}from"sutram-chassis";const p=s=>class extends s{connectedCallback(){super.connectedCallback(),this._sutramInputBridged||(this._sutramInputBridged=!0,this.addEventListener("yenvui-input-changed",e=>{e.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:e.detail,bubbles:!0,composed:!0}))}))}};export class SutramInput extends p(f){}customElements.get("sutram-input")||customElements.define("sutram-input",SutramInput);export class SutramSelect extends p(x){}customElements.get("sutram-select")||customElements.define("sutram-select",SutramSelect);export class SutramTextarea extends p(y){}customElements.get("sutram-textarea")||customElements.define("sutram-textarea",SutramTextarea);export class SutramToggle extends p(v){}customElements.get("sutram-toggle")||customElements.define("sutram-toggle",SutramToggle);import{html as r,css as h}from"lit";import{SutramElement as u}from"./sutram_sdk.js";import{sharedStyles as c}from"./shared_styles.js";export class SutramCombobox extends u{static properties={label:{type:String},value:{type:String},placeholder:{type:String},options:{type:Array},disabled:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},inline:{type:Boolean,reflect:!0},_open:{type:Boolean,state:!0},_highlightedIndex:{type:Number,state:!0},_filterText:{type:String,state:!0}};static styles=[c,h`
        :host {
            display: block;
            margin-bottom: 15px;
            font-family: inherit;
            position: relative;
            width: 100%;
            box-sizing: border-box;
        }
        :host([flush]), :host([inline]) {
            margin-bottom: 0 !important;
        }
        .combo-label {
            display: block;
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-muted);
            margin-bottom: 4px;
        }
        .combo-wrap {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
        }
        .combo-input {
            width: 100%;
            background: var(--bg-input, var(--input-bg));
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 8px 30px 8px 10px;
            font-size: 0.85rem;
            font-family: var(--font-mono, inherit);
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s ease;
        }
        .combo-input:focus {
            border-color: var(--intent-primary);
        }
        .combo-input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .combo-chevron {
            position: absolute;
            right: 6px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .combo-menu {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            max-height: 220px;
            overflow-y: auto;
            background: var(--pane-bg, var(--bg));
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: var(--overlay-shadow, 0 10px 25px rgba(0, 0, 0, 0.45));
            z-index: 3500;
            padding: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .combo-option {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.82rem;
            color: var(--text);
            text-align: left;
            background: transparent;
            border: none;
            width: 100%;
            box-sizing: border-box;
        }
        .combo-option:hover, .combo-option.highlighted {
            background: color-mix(in srgb, var(--intent-primary) 18%, var(--input-bg));
            color: var(--text);
        }
        .combo-option-main {
            font-family: var(--font-mono, inherit);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .combo-option-badge {
            font-size: 0.7rem;
            font-family: var(--font-mono, monospace);
            color: var(--text-muted);
            background: var(--bg);
            border: 1px solid var(--border);
            padding: 1px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
    `];constructor(){super(),this.label="",this.value="",this.placeholder="",this.options=[],this.disabled=!1,this.flush=!1,this.inline=!1,this._open=!1,this._highlightedIndex=-1,this._filterText=null}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this._open&&(this._open=!1,this._filterText=null)})}_getNormalizedOptions(){return(this.options||[]).map(e=>typeof e=="object"&&e!==null?{value:String(e.value!==void 0?e.value:e.id||e.label||""),label:String(e.label||e.name||e.value||""),badge:e.badge||e.detail||""}:{value:String(e),label:String(e),badge:""})}_getFilteredOptions(){const e=this._getNormalizedOptions(),t=(this._filterText!==null?this._filterText:"").trim().toLowerCase();return t?e.filter(i=>i.value.toLowerCase().includes(t)||i.label.toLowerCase().includes(t)||i.badge&&i.badge.toLowerCase().includes(t)).slice(0,60):e.slice(0,60)}_commitValue(e,t=!0){this.value=e,t&&(this._open=!1,this._filterText=null,this._highlightedIndex=-1),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:e},bubbles:!0,composed:!0}))}_handleKeyDown(e){const t=this._getFilteredOptions();e.key==="ArrowDown"?(e.preventDefault(),this._open||(this._open=!0),this._highlightedIndex=t.length>0?(this._highlightedIndex+1)%t.length:-1):e.key==="ArrowUp"?(e.preventDefault(),this._open||(this._open=!0),this._highlightedIndex=t.length>0?(this._highlightedIndex-1+t.length)%t.length:-1):e.key==="Enter"&&this._open&&this._highlightedIndex>=0&&t[this._highlightedIndex]?(e.preventDefault(),this._commitValue(t[this._highlightedIndex].value,!0)):e.key==="Escape"&&this._open&&(e.preventDefault(),this._open=!1,this._filterText=null)}render(){const e=this._open?this._getFilteredOptions():[];return r`
            ${this.label?r`<label class="combo-label">${this.label}</label>`:""}
            <div class="combo-wrap">
                <input
                    class="combo-input"
                    type="text"
                    .value=${this.value??""}
                    placeholder=${this.placeholder||""}
                    ?disabled=${this.disabled}
                    @focus=${()=>{this.disabled||(this._open=!0,this._filterText="")}}
                    @input=${t=>{const i=t.target.value;this._filterText=i,this._open=!0,this._highlightedIndex=0,this._commitValue(i,!1)}}
                    @keydown=${t=>this._handleKeyDown(t)}
                />
                <button
                    type="button"
                    class="combo-chevron"
                    tabindex="-1"
                    ?disabled=${this.disabled}
                    @click=${t=>{t.stopPropagation(),!this.disabled&&(this._open=!this._open,this._filterText="")}}>
                    <yv-icon name="chevron-down" style="width: 14px; height: 14px;"></yv-icon>
                </button>
            </div>
            ${this._open&&e.length>0?r`
                <div class="combo-menu">
                    ${e.map((t,i)=>r`
                        <button
                            type="button"
                            class="combo-option ${i===this._highlightedIndex?"highlighted":""}"
                            @pointerdown=${n=>{n.preventDefault(),n.stopPropagation(),this._commitValue(t.value,!0)}}>
                            <span class="combo-option-main">${t.label}</span>
                            ${t.badge?r`<span class="combo-option-badge">${t.badge}</span>`:""}
                        </button>
                    `)}
                </div>
            `:""}
        `}}customElements.get("sutram-combobox")||customElements.define("sutram-combobox",SutramCombobox);export class SutramTargetBinding extends u{static properties={label:{type:String},value:{type:Object},endpoints:{type:Array},models:{type:Array},endpointKey:{type:String},modelKey:{type:String},endpointPlaceholder:{type:String},modelPlaceholder:{type:String},allowEmptyEndpoint:{type:Boolean},disabled:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=[c,h`
        :host {
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
            box-sizing: border-box;
        }
        .binding-label {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-muted);
        }
        .binding-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
            gap: 10px;
            align-items: center;
            width: 100%;
            min-width: 0;
        }
        .binding-grid > * {
            min-width: 0;
            width: 100%;
        }
        @media (max-width: 520px) {
            .binding-grid {
                grid-template-columns: 1fr;
            }
        }
    `];constructor(){super(),this.label="",this.value={endpoint:"",model:""},this.endpoints=[],this.models=[],this.endpointKey="endpoint",this.modelKey="model",this.endpointPlaceholder="Select endpoint...",this.modelPlaceholder="Select or type model...",this.allowEmptyEndpoint=!1,this.disabled=!1,this.flush=!1}_normalizeValue(){const e=this.endpointKey||"endpoint",t=this.modelKey||"model",i=this.value;if(typeof i=="string"){if(i.includes("::")){const[n,a]=i.split("::");return{[e]:n.trim(),[t]:a.trim()}}return{[e]:"",[t]:i.trim()}}return i&&typeof i=="object"?{[e]:String(i[e]||i.endpoint_id||""),[t]:String(i[t]||"")}:{[e]:"",[t]:""}}_emitBinding(e){this.value=e,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:e},bubbles:!0,composed:!0}))}render(){const e=this.endpointKey||"endpoint",t=this.modelKey||"model",i=this._normalizeValue(),n=[];this.allowEmptyEndpoint&&n.push({value:"",label:this.endpointPlaceholder||"Fallback / None"}),(this.endpoints||[]).forEach(o=>{if(typeof o=="object"&&o!==null){const l=String(o.value!==void 0?o.value:o.id||""),d=String(o.label||o.title||l);l&&n.push({value:l,label:d})}else o&&n.push({value:String(o),label:String(o)})});const a=i[e]||!this.allowEmptyEndpoint&&n[0]?.value||"",m=typeof this.models=="function"?this.models(a):Array.isArray(this.models)?this.models:[];return r`
            ${this.label?r`<span class="binding-label">${this.label}</span>`:""}
            <div class="binding-grid">
                <sutram-select
                    ?flush=${!0}
                    ?disabled=${this.disabled}
                    .value=${a}
                    .options=${n}
                    @sutram-input-changed=${o=>{const l=o.detail.value,d=typeof this.models=="function"?this.models(l):this.models||[],b=d[0]?typeof d[0]=="object"?d[0].value:d[0]:"",g=l&&(i[t]||b)||"";this._emitBinding({[e]:l,[t]:g})}}>
                </sutram-select>
                <sutram-combobox
                    ?flush=${!0}
                    ?disabled=${this.disabled||!a&&this.allowEmptyEndpoint}
                    .value=${i[t]||""}
                    .placeholder=${this.modelPlaceholder||"Select or type model..."}
                    .options=${m}
                    @sutram-input-changed=${o=>{this._emitBinding({[e]:a,[t]:o.detail.value})}}>
                </sutram-combobox>
            </div>
        `}}customElements.get("sutram-target-binding")||customElements.define("sutram-target-binding",SutramTargetBinding);
