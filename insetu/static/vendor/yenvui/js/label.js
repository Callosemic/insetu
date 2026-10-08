import{html as t,css as e}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";export class YenvuiLabel extends o{static properties={text:{type:String}};static styles=e`
        :host { display: inline-block; margin-bottom: 4px; }
        label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted, #888);
            font-family: var(--font-family, inherit);
            user-select: none;
        }
        :host([data-theme="e-ink"]) label {
            color: #000 !important;
            font-weight: 900 !important;
        }
    `;render(){return t`<label>${this.text}<slot></slot></label>`}}customElements.define("yenvui-label",YenvuiLabel);
