import{LitElement as e,html as t,css as r}from"lit";export class YenvuiSpinner extends e{static properties={text:{type:String}};static styles=r`
        :host { display: block; margin: 15px 0; }
        .spinner-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: var(--text-muted, #888);
            font-style: italic;
            font-size: 0.9rem;
        }
        .loader {
            border: 2px solid var(--border, #444);
            border-top: 2px solid var(--intent-primary, #3b82f6);
            border-radius: 50%;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;render(){return t`
            <div class="spinner-container">
                <div class="loader"></div>
                <span>${this.text||""}<slot></slot></span>
            </div>
        `}}customElements.define("yenvui-spinner",YenvuiSpinner);
