import{LitElement,html,css}from'lit';export class YenvuiCard extends LitElement{static properties={titleText:{type:String},detailText:{type:String},descriptionText:{type:String},icon:{type:String},intentColor:{type:String}};static styles=css`
        :host { display: block; margin-bottom: 12px; }
        .card-wrapper {
            background: var(--input-bg, #2d2d2d);
            border: 1px solid var(--border, #444);
            border-left: 4px solid var(--card-intent, #64748b);
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            position: relative;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .card-wrapper:hover {
            border-color: var(--card-intent, #3b82f6);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 15px 15px 10px 15px;
        }
        .card-title {
            font-weight: bold;
            color: var(--text, #e0e0e0);
            font-size: 1.05rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-desc {
            padding: 0 15px;
            color: var(--text-muted, #888);
            font-size: 0.9rem;
        }
        .card-body {
            padding: 5px 15px 15px 15px;
            display: flex;
            flex-direction: column;
        }
        .card-detail {
            padding: 10px 15px 15px 15px;
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            color: var(--text-muted, #888);
            opacity: 0.8;
        }
        .actions-tray {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 8px;
        }
        
        /* Unstyled slots for host-injected buttons */
        ::slotted(button) {
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.8rem;
            transition: all 0.2s;
        }
        ::slotted(button:hover) {
            background: var(--bg-hover);
        }
    `;render(){return html`
            <div class="card-wrapper" style="--card-intent: ${this.intentColor || 'var(--intent-neutral)'}">
                <div class="card-header">
                    <div class="card-title">
                        ${this.icon ? html`<span>${this.icon}</span>` : ''}
                        ${this.titleText}
                    </div>
                    <div class="actions-tray">
                        <slot name="actions"></slot>
                    </div>
                </div>
                ${this.descriptionText ? html`<div class="card-desc">${this.descriptionText}</div>` : ''}
                <div class="card-body">
                    <slot></slot>
                </div>
                ${this.detailText ? html`<div class="card-detail">${this.detailText}</div>` : ''}
            </div>
        `;}}
customElements.define('yenvui-card',YenvuiCard);