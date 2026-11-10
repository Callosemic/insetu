import{Input as _,Select as w,Textarea as S,Toggle as $}from"sutram-chassis";const h=n=>class extends n{connectedCallback(){super.connectedCallback(),this._sutramInputBridged||(this._sutramInputBridged=!0,this.addEventListener("yenvui-input-changed",e=>{e.stopPropagation(),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:e.detail,bubbles:!0,composed:!0}))}))}},m=(n,e)=>{typeof customElements<"u"&&(!customElements.get||!customElements.get(n))&&customElements.define(n,e)};export class SutramInput extends h(_){}m("sutram-input",SutramInput);export class SutramSelect extends h(w){}m("sutram-select",SutramSelect);export class SutramTextarea extends h(S){}m("sutram-textarea",SutramTextarea);export class SutramToggle extends h($){}m("sutram-toggle",SutramToggle);import{html as l,css as g}from"lit";import{SutramElement as b}from"./sutram_sdk.js";import{sharedStyles as f}from"./shared_styles.js";export class SutramCombobox extends b{static properties={label:{type:String},value:{type:String},placeholder:{type:String},options:{type:Array},disabled:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},inline:{type:Boolean,reflect:!0},_open:{type:Boolean,state:!0},_highlightedIndex:{type:Number,state:!0},_filterText:{type:String,state:!0}};static styles=[f,g`
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
    `];constructor(){super(),this.label="",this.value="",this.placeholder="",this.options=[],this.disabled=!1,this.flush=!1,this.inline=!1,this._open=!1,this._highlightedIndex=-1,this._filterText=null}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this._open&&(this._open=!1,this._filterText=null)})}_getNormalizedOptions(){return(this.options||[]).map(e=>typeof e=="object"&&e!==null?{value:String(e.value!==void 0?e.value:e.id||e.label||""),label:String(e.label||e.name||e.value||""),badge:e.badge||e.detail||""}:{value:String(e),label:String(e),badge:""})}_getFilteredOptions(){const e=this._getNormalizedOptions(),t=(this._filterText!==null?this._filterText:"").trim().toLowerCase();return t?e.filter(i=>i.value.toLowerCase().includes(t)||i.label.toLowerCase().includes(t)||i.badge&&i.badge.toLowerCase().includes(t)).slice(0,60):e.slice(0,60)}_commitValue(e,t=!0){this.value=e,t&&(this._open=!1,this._filterText=null,this._highlightedIndex=-1),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:e},bubbles:!0,composed:!0}))}_handleKeyDown(e){const t=this._getFilteredOptions();e.key==="ArrowDown"?(e.preventDefault(),this._open||(this._open=!0),this._highlightedIndex=t.length>0?(this._highlightedIndex+1)%t.length:-1):e.key==="ArrowUp"?(e.preventDefault(),this._open||(this._open=!0),this._highlightedIndex=t.length>0?(this._highlightedIndex-1+t.length)%t.length:-1):e.key==="Enter"&&this._open&&this._highlightedIndex>=0&&t[this._highlightedIndex]?(e.preventDefault(),this._commitValue(t[this._highlightedIndex].value,!0)):e.key==="Escape"&&this._open&&(e.preventDefault(),this._open=!1,this._filterText=null)}render(){const e=this._open?this._getFilteredOptions():[];return l`
            ${this.label?l`<label class="combo-label">${this.label}</label>`:""}
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
                    <sutram-icon name="chevron-down" size="sm"></sutram-icon>
                </button>
            </div>
            ${this._open&&e.length>0?l`
                <div class="combo-menu">
                    ${e.map((t,i)=>l`
                        <button
                            type="button"
                            class="combo-option ${i===this._highlightedIndex?"highlighted":""}"
                            @pointerdown=${s=>{s.preventDefault(),s.stopPropagation(),this._commitValue(t.value,!0)}}>
                            <span class="combo-option-main">${t.label}</span>
                            ${t.badge?l`<span class="combo-option-badge">${t.badge}</span>`:""}
                        </button>
                    `)}
                </div>
            `:""}
        `}}typeof customElements<"u"&&!customElements.get("sutram-combobox")&&customElements.define("sutram-combobox",SutramCombobox);export class SutramTargetBinding extends b{static properties={label:{type:String},value:{type:Object},endpoints:{type:Array},models:{type:Array},endpointKey:{type:String},modelKey:{type:String},endpointPlaceholder:{type:String},modelPlaceholder:{type:String},allowEmptyEndpoint:{type:Boolean},disabled:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=[f,g`
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
    `];constructor(){super(),this.label="",this.value={endpoint:"",model:""},this.endpoints=[],this.models=[],this.endpointKey="endpoint",this.modelKey="model",this.endpointPlaceholder="Select endpoint...",this.modelPlaceholder="Select or type model...",this.allowEmptyEndpoint=!1,this.disabled=!1,this.flush=!1}_normalizeValue(){const e=this.endpointKey||"endpoint",t=this.modelKey||"model",i=this.value;if(typeof i=="string"){if(i.includes("::")){const[s,r]=i.split("::");return{[e]:s.trim(),[t]:r.trim()}}return{[e]:"",[t]:i.trim()}}return i&&typeof i=="object"?{[e]:String(i[e]||i.endpoint_id||""),[t]:String(i[t]||"")}:{[e]:"",[t]:""}}_emitBinding(e){this.value=e,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:e},bubbles:!0,composed:!0}))}render(){const e=this.endpointKey||"endpoint",t=this.modelKey||"model",i=this._normalizeValue(),s=[];this.allowEmptyEndpoint&&s.push({value:"",label:this.endpointPlaceholder||"Fallback / None"}),(this.endpoints||[]).forEach(o=>{if(typeof o=="object"&&o!==null){const a=String(o.value!==void 0?o.value:o.id||""),u=String(o.label||o.title||a);a&&s.push({value:a,label:u})}else o&&s.push({value:String(o),label:String(o)})});const r=i[e]||!this.allowEmptyEndpoint&&s[0]?.value||"",d=typeof this.models=="function"?this.models(r):Array.isArray(this.models)?this.models:[];return l`
            ${this.label?l`<span class="binding-label">${this.label}</span>`:""}
            <div class="binding-grid">
                <sutram-select
                    ?flush=${!0}
                    ?disabled=${this.disabled}
                    .value=${r}
                    .options=${s}
                    @sutram-input-changed=${o=>{o.stopPropagation();const a=o.detail.value,c=(typeof this.models=="function"?this.models(a):this.models||[]).map(p=>String(typeof p=="object"&&p!==null?p.value??p.id??"":p)),x=c[0]||"",v=i[t]&&(c.length===0||c.includes(i[t])),y=a?v?i[t]:x||i[t]||"":"";this._emitBinding({[e]:a,[t]:y})}}>
                </sutram-select>
                <sutram-combobox
                    ?flush=${!0}
                    ?disabled=${this.disabled||!r&&this.allowEmptyEndpoint}
                    .value=${i[t]||""}
                    .placeholder=${this.modelPlaceholder||"Select or type model..."}
                    .options=${d}
                    @sutram-input-changed=${o=>{o.stopPropagation(),this._emitBinding({[e]:r,[t]:o.detail.value})}}>
                </sutram-combobox>
            </div>
        `}}typeof customElements<"u"&&!customElements.get("sutram-target-binding")&&customElements.define("sutram-target-binding",SutramTargetBinding);export class SutramComposer extends b{static properties={value:{type:String},placeholder:{type:String},triggerPrefix:{type:String},triggers:{type:Array},activeTrigger:{type:Object},intent:{type:String,reflect:!0},disabled:{type:Boolean,reflect:!0},_menuOpen:{type:Boolean,state:!0},_focused:{type:Boolean,state:!0,reflect:!0}};static styles=[f,g`
        :host {
            display: block;
            width: 100%;
            box-sizing: border-box;
            --composer-accent: var(--intent-primary);
        }
        :host([intent="primary"]) { --composer-accent: var(--intent-primary); }
        :host([intent="success"]) { --composer-accent: var(--intent-success); }
        :host([intent="warning"]) { --composer-accent: var(--intent-warning); }
        :host([intent="danger"]) { --composer-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --composer-accent: var(--intent-highlight); }

        .composer-shell {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px 12px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            box-sizing: border-box;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        :host([_focused]) .composer-shell {
            border-color: var(--composer-accent);
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--composer-accent) 20%, transparent);
        }
        .composer-input-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }
        .composer-input-row > sutram-textarea {
            flex: 1 1 0%;
            min-width: 0;
            margin: 0;
        }
        .trigger-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 6px;
            background: color-mix(in srgb, var(--composer-accent) 16%, var(--bg));
            border: 1px solid color-mix(in srgb, var(--composer-accent) 45%, var(--border));
            color: var(--text);
            font-family: var(--font-mono, monospace);
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            margin-top: 2px;
        }
        .trigger-pill:hover {
            border-color: var(--composer-accent);
        }
    `];constructor(){super(),this.value="",this.placeholder="Type a message or /command...",this.triggerPrefix="/",this.triggers=[],this.activeTrigger=null,this.intent="primary",this.disabled=!1,this._menuOpen=!1,this._focused=!1}_syncInnerTextareaValue(e){const t=this.shadowRoot?.querySelector("sutram-textarea");if(t){t.value=e;const i=t.shadowRoot?.querySelector("textarea, input")||t.querySelector?.("textarea, input");i&&i.value!==e&&(i.value=e)}}_selectTrigger(e,t=null){this.activeTrigger=e||null,this._menuOpen=!1,t!==null&&(this.value=t,this._syncInnerTextareaValue(t)),this.dispatchEvent(new CustomEvent("sutram-trigger-changed",{detail:{trigger:this.activeTrigger,remainingText:this.value},bubbles:!0,composed:!0}))}_handleTextInput(e){e&&typeof e.stopPropagation=="function"&&e.stopPropagation();let t=e.detail?.value??"";const i=this.triggerPrefix??"/",s=this.shadowRoot?.querySelector("sutram-dropdown");if(i&&Array.isArray(this.triggers)&&this.triggers.length>0&&t.startsWith(i)){const r=t.indexOf(" ");if(r>i.length){const d=t.slice(i.length,r).trim().toLowerCase(),o=this.triggers.find(a=>{const u=String(a.token||a.id||"").replace(/^\//,"").toLowerCase(),c=String(a.altToken||"").replace(/^\//,"").toLowerCase();return u===d||c&&c===d});o&&(t=t.slice(r+1),this._selectTrigger(o,t),s&&(s.open=!1,s._searchQuery=""))}else if(r===-1){const d=t.slice(i.length).trim();this._menuOpen=!0,s&&(s.open=!0,s._searchQuery=d)}}else this._menuOpen&&s&&!t.startsWith(i)&&(this._menuOpen=!1,s.open=!1,s._searchQuery="");this.value=t,this._syncInnerTextareaValue(t),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value,activeTrigger:this.activeTrigger},bubbles:!0,composed:!0}))}_handleKeyDown(e){if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault(),this.disabled||this.dispatchEvent(new CustomEvent("sutram-composer-submit",{detail:{value:this.value,activeTrigger:this.activeTrigger},bubbles:!0,composed:!0}));return}if(e.key==="Backspace"&&this.activeTrigger){const t=this.shadowRoot?.querySelector("sutram-textarea")?.querySelector("textarea")||e.target;(t&&t.selectionStart!==void 0?t.selectionStart===0&&t.selectionEnd===0:!this.value)&&(e.preventDefault(),this._selectTrigger(null))}}render(){const e=this.triggerPrefix??"/",t=Array.isArray(this.triggers)&&this.triggers.length>0,i=(this.triggers||[]).map(s=>({id:s.id||s.token,token:s.token||s.id,label:s.label||`${e}${s.token||s.id}`,icon:s.icon||"terminal",badge:s.badge||(s.token?`${e}${s.token}`:""),description:s.description||"",onClick:()=>{const r=(this.value||"").replace(/^\/(?:user:[a-zA-Z0-9_:-]*|[a-zA-Z0-9_:-]*)\s*/,"");this._selectTrigger(s,r)}}));return l`
            <div class="composer-shell"
                @focusin=${()=>{this._focused=!0}}
                @focusout=${()=>{this._focused=!1}}>
                <slot name="header"></slot>
                <div class="composer-input-row">
                    <slot name="prefix">
                        ${t?l`
                            <sutram-dropdown
                                .items=${i}
                                .open=${this._menuOpen}
                                ?searchable=${!0}
                                searchPlaceholder="Search commands..."
                                direction="up"
                                align="left">
                                <button slot="trigger" type="button" class="trigger-pill" ?disabled=${this.disabled}>
                                    <sutram-icon name=${this.activeTrigger?.icon||"terminal"} size="sm"></sutram-icon>
                                    <span>${this.activeTrigger?this.activeTrigger.pillLabel||this.activeTrigger.label||`${e}${this.activeTrigger.token||this.activeTrigger.id}`:e}</span>
                                </button>
                            </sutram-dropdown>
                        `:""}
                    </slot>
                    <sutram-textarea
                        variant="ghost"
                        ?compact=${!0}
                        ?flush=${!0}
                        ?disabled=${this.disabled}
                        .value=${this.value||""}
                        .placeholder=${this.placeholder||""}
                        @keydown=${s=>this._handleKeyDown(s)}
                        @sutram-input-changed=${s=>this._handleTextInput(s)}>
                    </sutram-textarea>
                </div>
                <slot name="footer"></slot>
            </div>
        `}}typeof customElements<"u"&&!customElements.get("sutram-composer")&&customElements.define("sutram-composer",SutramComposer);
