import{html as t,css as e}from"lit";import{YenvuiBase as n}from"./yenvui-base.js";export class YenvuiBoard extends n{static styles=e`
        :host { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr);
            align-items: start;
            gap: 15px; 
            width: 100%; 
        }
        @container (max-width: 1100px) {
            :host { 
                grid-template-columns: repeat(2, 1fr); 
            }
        }
        @container (max-width: 700px) {
            :host { 
                grid-template-columns: 1fr; 
                gap: 25px; 
            }
        }
    `;render(){return t`<slot></slot>`}}customElements.define("yenvui-board",YenvuiBoard);export class YenvuiColumn extends n{static properties={titleText:{type:String},intent:{type:String,reflect:!0}};static styles=e`
        :host { 
            min-width: 0; 
            background: var(--input-bg, #2d2d2d); 
            padding: 10px; 
            border-radius: 6px; 
            display: flex; 
            flex-direction: column; 
            gap: 10px;
            --col-accent: var(--text, #e0e0e0);
        }
        :host([intent="primary"]) { --col-accent: var(--intent-primary); }
        :host([intent="success"]) { --col-accent: var(--intent-success); }
        :host([intent="warning"]) { --col-accent: var(--intent-warning); }
        :host([intent="danger"]) { --col-accent: var(--intent-danger); }
        :host([intent="highlight"]) { --col-accent: var(--intent-highlight); }
        :host([intent="neutral"]) { --col-accent: var(--intent-neutral); }
        .header { 
            margin-top: 0; 
            font-size: 1.1rem; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: var(--col-accent); 
        }
        @container (max-width: 700px) {
            :host { 
                background: transparent; 
                padding: 0; 
            }
            .header { 
                font-size: 1.2rem; 
                border-bottom: 1px solid var(--border, #444); 
                padding-bottom: 5px; 
                margin-bottom: 15px; 
            }
        }
    `;constructor(){super(),this.titleText="",this.intent=""}render(){return t`
            ${this.titleText?t`<div class="header">${this.titleText}</div>`:""}
            <slot></slot>
        `}}customElements.define("yenvui-column",YenvuiColumn);
