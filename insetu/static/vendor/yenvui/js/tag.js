import{html as t,css as r}from"lit";import{YenvuiBase as e}from"./yenvui-base.js";export class YenvuiTag extends e{static properties={text:{type:String},intent:{type:String}};static styles=r`
        :host { display: inline-flex; align-items: center; }
        .tag {
            background: var(--tag-bg, var(--input-bg, #2d2d2d));
            color: var(--tag-color, var(--text, #e0e0e0));
            border: 1px solid var(--tag-border, var(--border, #444));
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            line-height: 1;
            white-space: nowrap;
        }
        .intent-primary { --tag-bg: var(--intent-primary); --tag-color: #fff; --tag-border: var(--intent-primary); }
        .intent-success { --tag-bg: var(--intent-success); --tag-color: #fff; --tag-border: var(--intent-success); }
        .intent-danger { --tag-bg: var(--intent-danger); --tag-color: #fff; --tag-border: var(--intent-danger); }
        .intent-warning { --tag-bg: var(--intent-warning); --tag-color: #000; --tag-border: var(--intent-warning); }
        
        :host([data-theme="e-ink"]) .tag {
            background: #fff !important;
            color: #000 !important;
            border: 1px dashed #000 !important;
        }
        :host([data-theme="light"]) .tag {
            background: var(--tag-bg, #f1f5f9);
            border-color: var(--tag-border, #cbd5e1);
            color: var(--tag-color, #0f172a);
        }
    `;render(){return t`<span class="tag ${this.intent?"intent-"+this.intent:""}">${this.text}<slot></slot></span>`}}customElements.define("yenvui-tag",YenvuiTag);
