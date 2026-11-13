import{LitElement as l,html as t}from"lit";typeof window<"u"&&window.addEventListener("error",s=>{s.message&&(s.message.includes("ResizeObserver loop limit exceeded")||s.message.includes("ResizeObserver loop completed with undelivered notifications"))&&s.stopImmediatePropagation()});export class YenvuiInput extends l{static properties={label:{type:String},placeholder:{type:String},value:{type:String},type:{type:String},disabled:{type:Boolean},inline:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},grow:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.type="text",this.value="",this.placeholder="",this.disabled=!1,this.inline=!1,this.flush=!1,this.grow=!1}_onInput(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent("yenvui-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""} ${this.inline?"yv-form-wrapper--inline":""}`;return t`
            <div class="${e}">
                ${this.label?t`<yenvui-label .text=${this.label}></yenvui-label>`:""}
                <input
                    class="yv-input"
                    type=${this.type}
                    .value=${this.value||""}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    @input=${this._onInput}
                >
            </div>
        `}}customElements.get("yenvui-input")||customElements.define("yenvui-input",YenvuiInput);export class YenvuiSelect extends l{static properties={label:{type:String},value:{type:String},options:{type:Array},disabled:{type:Boolean},inline:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},grow:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.value="",this.options=[],this.disabled=!1,this.inline=!1,this.flush=!1,this.grow=!1}_onChange(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent("yenvui-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}updated(){const e=this.querySelector("select.yv-select");e&&e.value!==(this.value||"")&&(e.value=this.value||"")}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""} ${this.inline?"yv-form-wrapper--inline":""}`;return t`
            <div class="${e}">
                ${this.label?t`<yenvui-label .text=${this.label}></yenvui-label>`:""}
                <select class="yv-select" ?disabled=${this.disabled} @change=${this._onChange}>
                    ${(this.options||[]).map(i=>t`<option value=${i.value}>${i.label||i.value}</option>`)}
                </select>
            </div>
        `}}customElements.get("yenvui-select")||customElements.define("yenvui-select",YenvuiSelect);const u=Object.freeze({compact:{minPx:38,maxPx:150},normal:{minPx:60,maxPx:380},wide:{minPx:110,maxPx:540},full:{minPx:320,maxPx:720}});export class YenvuiTextarea extends l{static properties={label:{type:String},value:{type:String},placeholder:{type:String},variant:{type:String,reflect:!0},size:{type:String,reflect:!0},compact:{type:Boolean,reflect:!0},monospace:{type:Boolean},disabled:{type:Boolean},readOnly:{type:Boolean},inline:{type:Boolean,reflect:!0},autoSize:{type:Boolean},flush:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.value="",this.placeholder="",this.variant="default",this.size="normal",this.compact=!1,this.monospace=!1,this.disabled=!1,this.readOnly=!1,this.inline=!1,this.autoSize=!0,this.flush=!1}connectedCallback(){super.connectedCallback(),this._boundAdjustHeight=this._adjustHeight.bind(this),window.addEventListener("resize",this._boundAdjustHeight)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this._boundAdjustHeight),this._visibilityObserver&&this._visibilityObserver.disconnect()}firstUpdated(){typeof IntersectionObserver<"u"&&(this._visibilityObserver=new IntersectionObserver(e=>{e[0].isIntersecting&&this._adjustHeight()}),this._visibilityObserver.observe(this)),this._adjustHeight()}updated(e){super.updated(e),(e.has("value")||e.has("autoSize")||e.has("variant")||e.has("size")||e.has("compact"))&&this._adjustHeight()}_adjustHeight(){this.autoSize!==!1&&window.requestAnimationFrame(()=>{const e=this.querySelector("textarea");if(!e||e.scrollHeight===0)return;const i=e.style.height;e.style.height="auto";const a=this.compact?"compact":this.size||"normal",n=u[a]||u.normal,r=this.variant==="ghost"?28:n.minPx,o=`${this.value?Math.max(r,Math.min(e.scrollHeight+2,n.maxPx)):r}px`;i!==o?e.style.height=o:e.style.height=i})}_onInput(e){this.value=e.target.value,this._adjustHeight(),this.dispatchEvent(new CustomEvent("yenvui-input-changed",{detail:{value:this.value},bubbles:!0,composed:!0}))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""} ${this.inline?"yv-form-wrapper--inline":""}`,i=this.monospace?"yv-textarea--monospace":"",a=this.variant==="ghost"?"yv-textarea--borderless":"";return t`
            <div class="${e}">
                ${this.label?t`<yenvui-label .text=${this.label}></yenvui-label>`:""}
                <textarea
                    class="yv-textarea ${i} ${a}"
                    rows="1"
                    .value=${this.value||""}
                    placeholder=${this.placeholder}
                    ?disabled=${this.disabled}
                    ?readonly=${this.readOnly}
                    @input=${this._onInput}
                ></textarea>
            </div>
        `}}customElements.get("yenvui-textarea")||customElements.define("yenvui-textarea",YenvuiTextarea);export class YenvuiToggle extends l{static properties={label:{type:String},checked:{type:Boolean},disabled:{type:Boolean},flush:{type:Boolean,reflect:!0}};createRenderRoot(){return this}constructor(){super(),this.checked=!1,this.disabled=!1,this.flush=!1}_onToggle(e){this.disabled||(e&&e.preventDefault(),this.checked=!this.checked,this.dispatchEvent(new CustomEvent("yenvui-input-changed",{detail:{value:this.checked},bubbles:!0,composed:!0})))}render(){const e=`yv-form-wrapper ${this.flush?"yv-form-wrapper--flush":""}`;return t`
            <div class="${e}">
                <label class="yv-toggle-wrapper ${this.disabled?"disabled":""}" @click=${this._onToggle}>
                    <div class="yv-toggle-track ${this.checked?"checked":""}">
                        <div class="yv-toggle-thumb"></div>
                    </div>
                    ${this.label?t`<span style="font-size: 0.9rem; font-weight: 500; color: var(--text);">${this.label}</span>`:""}
                    <input type="checkbox" style="display:none;" .checked=${this.checked} ?disabled=${this.disabled}>
                </label>
            </div>
        `}}customElements.get("yenvui-toggle")||customElements.define("yenvui-toggle",YenvuiToggle);
