import{LitElement as e,html as t,css as i}from"lit";export class YenvuiEmptyState extends e{static properties={icon:{type:String},text:{type:String}};static styles=i`
        :host { display: block; padding: 20px; }
        .empty-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-muted, #888);
            text-align: center;
            gap: 8px;
        }
        .icon {
            font-size: 2rem;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        .text {
            font-style: italic;
            font-size: 0.95rem;
        }
    `;render(){return t`
            <div class="empty-container">
                ${this.icon?t`<div class="icon">${this.icon}</div>`:""}
                <div class="text">${this.text||""}<slot></slot></div>
            </div>
        `}}customElements.define("yenvui-empty-state",YenvuiEmptyState);
