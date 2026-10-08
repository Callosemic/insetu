import{LitElement as i,html as t,css as a}from"lit";window.addEventListener("error",s=>{s.message&&(s.message.includes("ResizeObserver loop limit exceeded")||s.message.includes("ResizeObserver loop completed with undelivered notifications"))&&s.stopImmediatePropagation()});const r=a`
    :host { display: block; margin-bottom: 15px; font-family: var(--font-family, inherit); }
    :host([flush]) { margin-bottom: 0 !important; }
    .wrapper { display: flex; flex-direction: column; gap: 6px; }

    :host([inline]) .wrapper { flex-direction: row; align-items: center; gap: 15px; }
    :host([inline]) sutram-label { flex-shrink: 0; margin: 0; white-space: nowrap; }
    :host([inline]) .input-base { flex: 1; min-width: 0; }
    
    .input-base {
        padding: 8px 12px;
        font-size: 0.95rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg-input, var(--bg));
        color: var(--text);
        transition: border-color 0.2s, box-shadow 0.2s;
        font-family: inherit;
        box-sizing: border-box;
        width: 100%;
    }
    
    .input-base:focus {
        outline: none;
        border-color: var(--intent-primary);
        box-shadow: 0 0 0 2px rgba(var(--intent-primary-rgb, 0, 123, 255), 0.2);
    }
    
    .input-base:disabled {
        background: var(--bg-hover);
        cursor: not-allowed;
        opacity: 0.7;
    }
`;export class SutramInput extends i{static properties={label:{type:String},value:{type:String},placeholder:{type:String},type:{type:String},disabled:{type:Boolean},inline:{type:Boolean,reflect:!0}};static styles=[r];constructor(){super(),this.type="text",this.value="",this.placeholder="",this.disabled=!1,this.inline=!1}_onInput(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){return t`
            <div class="wrapper">
                ${this.label?t`<sutram-label .text=${this.label}></sutram-label>`:""}
                <input 
                    class="input-base"
                    type=${this.type}
                    .value=${this.value}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    @input=${this._onInput}
                >
            </div>
        `}}customElements.define("sutram-input",SutramInput);export class SutramSelect extends i{static properties={label:{type:String},value:{type:String},options:{type:Array},disabled:{type:Boolean},inline:{type:Boolean,reflect:!0}};static styles=[r,a`
        select.input-base { cursor: pointer; appearance: auto; }
    `];constructor(){super(),this.value="",this.options=[],this.disabled=!1,this.inline=!1}_onChange(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){return t`
            <div class="wrapper">
                ${this.label?t`<sutram-label .text=${this.label}></sutram-label>`:""}
                <select class="input-base" .value=${this.value} ?disabled=${this.disabled} @change=${this._onChange}>
                    ${this.options.map(e=>t`<option value=${e.value} ?selected=${this.value===e.value}>${e.label||e.value}</option>`)}
                </select>
            </div>
        `}}customElements.define("sutram-select",SutramSelect);export class SutramTextarea extends i{static properties={label:{type:String},value:{type:String},placeholder:{type:String},rows:{type:Number},monospace:{type:Boolean},disabled:{type:Boolean},readOnly:{type:Boolean},inline:{type:Boolean,reflect:!0},autoSize:{type:Boolean},maxHeight:{type:Number},minRows:{type:Number},borderless:{type:Boolean,reflect:!0}};static styles=[r,a`
        textarea { resize: vertical; min-height: 80px; }
        .monospace { font-family: var(--font-monospace, monospace); font-size: 0.9rem; }

        /* Align textarea labels to the top if inline */
        :host([inline]) .wrapper { align-items: flex-start; }
        :host([inline]) label { padding-top: 8px; }
        :host([borderless]) {
            margin-bottom: 0 !important;
        }
        :host([borderless]) textarea, textarea.borderless {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
            resize: none !important;
            overflow: hidden !important;
            padding: 0 !important;
            min-height: 0 !important;
        }
    `];constructor(){super(),this.value="",this.placeholder="",this.rows=1,this.monospace=!1,this.disabled=!1,this.readOnly=!1,this.inline=!1,this.autoSize=!0,this.maxHeight=500,this.minRows=1,this.borderless=!1}connectedCallback(){super.connectedCallback(),this._boundAdjustHeight=this._adjustHeight.bind(this),window.addEventListener("resize",this._boundAdjustHeight)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this._boundAdjustHeight),this._visibilityObserver&&this._visibilityObserver.disconnect()}firstUpdated(){this._visibilityObserver=new IntersectionObserver(e=>{e[0].isIntersecting&&this._adjustHeight()}),this._visibilityObserver.observe(this),this._adjustHeight()}updated(e){super.updated(e),(e.has("value")||e.has("autoSize")||e.has("borderless"))&&this._adjustHeight()}_adjustHeight(){this.autoSize!==!1&&window.requestAnimationFrame(()=>{const e=this.shadowRoot.querySelector("textarea");if(!e||e.scrollHeight===0)return;const l=e.style.height;e.style.height="auto";const n=`${Math.min(e.scrollHeight+2,this.maxHeight||500)}px`;l!==n?e.style.height=n:e.style.height=l})}_onInput(e){this.value=e.target.value,this._adjustHeight(),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){return t`
            <div class="wrapper">
                ${this.label?t`<sutram-label .text=${this.label}></sutram-label>`:""}
                <textarea 
                    class="input-base ${this.monospace?"monospace":""}"
                    rows=${this.rows}
                    .value=${this.value}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    ?readonly=${this.readOnly}
                    @input=${this._onInput}
                ></textarea>
            </div>
        `}}customElements.define("sutram-textarea",SutramTextarea);export class SutramToggle extends i{static properties={label:{type:String},checked:{type:Boolean},disabled:{type:Boolean}};static styles=[r,a`
        .toggle-wrapper { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 4px; }
        .toggle-wrapper.disabled { cursor: not-allowed; opacity: 0.6; }
        .track {
            width: 36px; height: 20px;
            background: var(--border);
            border-radius: 20px;
            position: relative;
            transition: background 0.2s;
        }
        .track.checked { background: var(--intent-primary); }
        .thumb {
            width: 16px; height: 16px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 2px; left: 2px;
            transition: transform 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .track.checked .thumb { transform: translateX(16px); }
        input[type="checkbox"] { display: none; }
    `];constructor(){super(),this.checked=!1,this.disabled=!1}_onToggle(e){this.disabled||(e&&e.preventDefault(),this.checked=!this.checked,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.checked},bubbles:!0,composed:!0})))}render(){return t`
            <div class="wrapper">
                <label class="toggle-wrapper ${this.disabled?"disabled":""}" @click=${this._onToggle}>
                    <div class="track ${this.checked?"checked":""}">
                        <div class="thumb"></div>
                    </div>
                    ${this.label?t`<span style="font-size: 0.9rem; font-weight: 500; color: var(--text);">${this.label}</span>`:""}
                    <input type="checkbox" .checked=${this.checked} ?disabled=${this.disabled}>
                </label>
            </div>
        `}}customElements.define("sutram-toggle",SutramToggle);
