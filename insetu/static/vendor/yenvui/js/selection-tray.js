import{html as t,css as e}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiSelectionTray extends r{static properties={count:{type:Number},open:{type:Boolean,reflect:!0}};static styles=e`
        :host {
            position: fixed;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%) translateY(150%);
            z-index: 4000;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex;
            align-items: center;
            gap: 15px;
            background: var(--pane-bg, #1e1e1e);
            border: 1px solid var(--intent-highlight, #8b5cf6);
            padding: 10px 20px;
            border-radius: 50px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        :host([open]) {
            transform: translateX(-50%) translateY(0);
        }
        :host([data-theme="e-ink"]) {
            border: 2px solid #000;
            box-shadow: 4px 4px 0 #8b5cf6;
        }
        .count-badge {
            background: var(--intent-highlight, #8b5cf6);
            color: white;
            font-weight: bold;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
        }
        .actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .clear-btn {
            background: transparent;
            border: none;
            color: var(--text-muted, #888);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 4px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s, background 0.2s;
        }
        .clear-btn:hover { 
            color: var(--text, #fff); 
            background: var(--input-bg); 
        }
    `;constructor(){super(),this.count=0,this.open=!1}render(){return t`
            <div class="count-badge">${this.count}</div>
            <div class="actions"><slot name="batch-actions"></slot></div>
            <div style="width: 1px; height: 20px; background: var(--border);"></div>
            <button class="clear-btn" @click=${()=>this.dispatchEvent(new CustomEvent("yenvui-clear-selection",{bubbles:!0,composed:!0}))}>✕</button>
        `}}customElements.define("yenvui-selection-tray",YenvuiSelectionTray);
