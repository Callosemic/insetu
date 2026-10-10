import{LitElement as a,html as s}from"lit";window.addEventListener("error",i=>{i.message&&(i.message.includes("ResizeObserver loop limit exceeded")||i.message.includes("ResizeObserver loop completed with undelivered notifications"))&&i.stopImmediatePropagation()});export class SutramInput extends a{static properties={label:{type:String},value:{type:String},placeholder:{type:String},type:{type:String},disabled:{type:Boolean},inline:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.type="text",this.value="",this.placeholder="",this.disabled=!1,this.inline=!1,this.flush=!1}_onInput(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""} ${this.inline?"yv-form-wrapper--inline":""}`;return s`
            <div class="${e}">
                ${this.label?s`<sutram-label .text=${this.label}></sutram-label>`:""}
                <input 
                    class="yv-input"
                    type=${this.type}
                    .value=${this.value||""}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    @input=${this._onInput}
                >
            </div>
        `}}customElements.define("sutram-input",SutramInput);export class SutramSelect extends a{static properties={label:{type:String},value:{type:String},options:{type:Array},disabled:{type:Boolean},inline:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.value="",this.options=[],this.disabled=!1,this.inline=!1,this.flush=!1}_onChange(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""} ${this.inline?"yv-form-wrapper--inline":""}`;return s`
            <div class="${e}">
                ${this.label?s`<sutram-label .text=${this.label}></sutram-label>`:""}
                <select class="yv-select" .value=${this.value||""} ?disabled=${this.disabled} @change=${this._onChange}>
                    ${this.options.map(t=>s`<option value=${t.value} ?selected=${this.value===t.value}>${t.label||t.value}</option>`)}
                </select>
            </div>
        `}}customElements.define("sutram-select",SutramSelect);export class SutramTextarea extends a{static properties={label:{type:String},value:{type:String},placeholder:{type:String},rows:{type:Number},monospace:{type:Boolean},disabled:{type:Boolean},readOnly:{type:Boolean},inline:{type:Boolean,reflect:!0},autoSize:{type:Boolean},maxHeight:{type:Number},minRows:{type:Number},borderless:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.value="",this.placeholder="",this.rows=1,this.monospace=!1,this.disabled=!1,this.readOnly=!1,this.inline=!1,this.autoSize=!0,this.maxHeight=500,this.minRows=1,this.borderless=!1,this.flush=!1}connectedCallback(){super.connectedCallback(),this._boundAdjustHeight=this._adjustHeight.bind(this),window.addEventListener("resize",this._boundAdjustHeight)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this._boundAdjustHeight),this._visibilityObserver&&this._visibilityObserver.disconnect()}firstUpdated(){this._visibilityObserver=new IntersectionObserver(e=>{e[0].isIntersecting&&this._adjustHeight()}),this._visibilityObserver.observe(this),this._adjustHeight()}updated(e){super.updated(e),(e.has("value")||e.has("autoSize")||e.has("borderless"))&&this._adjustHeight()}_adjustHeight(){this.autoSize!==!1&&window.requestAnimationFrame(()=>{const e=this.querySelector("textarea");if(!e||e.scrollHeight===0)return;const t=e.style.height;e.style.height="auto";const l=`${Math.min(e.scrollHeight+2,this.maxHeight||500)}px`;t!==l?e.style.height=l:e.style.height=t})}_onInput(e){this.value=e.target.value,this._adjustHeight(),this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""} ${this.inline?"yv-form-wrapper--inline":""}`,t=this.monospace?"yv-textarea--monospace":"",l=this.borderless?"yv-textarea--borderless":"";return s`
            <div class="${e}">
                ${this.label?s`<sutram-label .text=${this.label}></sutram-label>`:""}
                <textarea 
                    class="yv-textarea ${t} ${l}"
                    rows=${this.rows}
                    .value=${this.value||""}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    ?readonly=${this.readOnly}
                    @input=${this._onInput}
                ></textarea>
            </div>
        `}}customElements.define("sutram-textarea",SutramTextarea);export class SutramToggle extends a{static properties={label:{type:String},checked:{type:Boolean},disabled:{type:Boolean},flush:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.checked=!1,this.disabled=!1,this.flush=!1}_onToggle(e){this.disabled||(e&&e.preventDefault(),this.checked=!this.checked,this.dispatchEvent(new CustomEvent("sutram-input-changed",{detail:{value:this.checked},bubbles:!0,composed:!0})))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""}`;return s`
            <div class="${e}">
                <label class="yv-toggle-wrapper ${this.disabled?"disabled":""}" @click=${this._onToggle}>
                    <div class="yv-toggle-track ${this.checked?"checked":""}">
                        <div class="yv-toggle-thumb"></div>
                    </div>
                    ${this.label?s`<span style="font-size: 0.9rem; font-weight: 500; color: var(--text);">${this.label}</span>`:""}
                    <input type="checkbox" style="display:none;" .checked=${this.checked} ?disabled=${this.disabled}>
                </label>
            </div>
        `}}customElements.define("sutram-toggle",SutramToggle);
