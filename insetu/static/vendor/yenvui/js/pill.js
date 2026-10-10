import{html as l}from"lit";import{YenvuiBase as s}from"./yenvui-base.js";export class YenvuiPill extends s{static properties={pillId:{type:String},labelText:{type:String},active:{type:Boolean},small:{type:Boolean},variant:{type:String}};createRenderRoot(){return this}constructor(){super(),this.variant="standard"}render(){const t=this.active?"yv-pill--active":"yv-pill--inactive",e=this.small?"yv-pill--small":"",i=`yv-pill--${this.variant||"standard"}`;return l`
            <button 
                class="yv-pill ${t} ${e} ${i}"
                @click=${this._onClick}>
                ${this.labelText}
            </button>
        `}_onClick(t){this.dispatchEvent(new CustomEvent("yenvui-pill-toggled",{detail:{id:this.pillId,active:!this.active},bubbles:!0,composed:!0}))}}customElements.define("yenvui-pill",YenvuiPill);
