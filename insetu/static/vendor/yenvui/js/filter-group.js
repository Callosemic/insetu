import{LitElement as s,html as i,css as n}from"lit";import"./pill.js";export class YenvuiFilterGroup extends s{static properties={label:{type:String},items:{type:Array},activeItems:{type:Array},allowAll:{type:Boolean}};static styles=n`
        .wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .label { font-size: 0.85rem; font-weight: bold; color: var(--text, #e0e0e0); opacity: 0.8; margin-right: 5px; white-space: nowrap; user-select: none; }
    `;_handleToggle(t){const{id:l,active:a}=t.detail;let e=new Set(this.activeItems);this.allowAll&&l==="ALL"?(e.clear(),e.add("ALL")):(e.delete("ALL"),a?e.add(l):e.delete(l),e.size===0&&this.allowAll&&e.add("ALL")),this.dispatchEvent(new CustomEvent("yenvui-filter-changed",{detail:{activeItems:Array.from(e)},bubbles:!0,composed:!0}))}render(){const t=new Set(this.activeItems),l=this.items||[],a=this.allowAll;return i`
            <div class="wrap" @yenvui-pill-toggled=${this._handleToggle}>
                ${this.label?i`<span class="label">${this.label}</span>`:""}
                ${a?i`<yenvui-pill pillId="ALL" labelText="All" ?active=${t.has("ALL")}></yenvui-pill>`:""}
                ${l.map(e=>i`
                    <yenvui-pill 
                        pillId=${e.id} 
                        labelText=${e.label} 
                        ?active=${t.has(e.id)}>
                    </yenvui-pill>
                `)}
            </div>
        `}}customElements.define("yenvui-filter-group",YenvuiFilterGroup);
