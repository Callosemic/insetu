import{LitElement as i,html as e,css as n}from"lit";export class YenvuiStatusBar extends i{static properties={text:{type:String},isError:{type:Boolean},syncState:{type:String}};static styles=n`
        :host { display: block; width: 100%; flex-shrink: 0; z-index: 1000; }
        .bottom-bar {
            width: 100%; box-sizing: border-box; height: 28px; 
            background: var(--bg-deep, #05070a); border-top: 1px solid var(--border, #444); 
            padding: 0 12px; font-family: var(--font-mono, monospace); 
            font-size: 11px; color: var(--text-muted, #94a3b8); font-weight: normal; 
            line-height: 27px; white-space: nowrap; display: flex; 
            justify-content: space-between; align-items: center;
        }
        .bottom-bar.error {
            color: var(--intent-danger, #ef4444);
        }
        .text-content {
            overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
        }
        .sync-indicator {
            flex-shrink: 0; font-weight: normal; opacity: 0.8; margin-left: 15px;
        }
    `;constructor(){super(),this.text="",this.isError=!1,this.syncState="synced"}render(){let t=e``;return this.syncState==="pending"&&(t=e`<yenvui-icon name="circle-dot" size="xs" intent="warning" style="margin-right: 4px;"></yenvui-icon> Pending Sync`),this.syncState==="syncing"&&(t=e`<yenvui-icon name="refresh-cw" size="xs" style="margin-right: 4px;"></yenvui-icon> Syncing...`),this.syncState==="synced"&&(t=e`<yenvui-icon name="check-circle-2" size="xs" intent="success" style="margin-right: 4px;"></yenvui-icon> Synced`),this.syncState==="offline"&&(t=e`<yenvui-icon name="wifi-off" size="xs" intent="muted" style="margin-right: 4px;"></yenvui-icon> Offline`),this.syncState==="reconciling"&&(t=e`<yenvui-icon name="cloud-sync" size="xs" intent="highlight" style="margin-right: 4px;"></yenvui-icon> Reconciling...`),this.syncState==="error"&&(t=e`<yenvui-icon name="alert-triangle" size="xs" intent="danger" style="margin-right: 4px;"></yenvui-icon> Sync Error`),e`
            <div class="bottom-bar ${this.isError?"error":""}" title="${this.text}">
                <span class="text-content">${this.text}</span>
                <span class="sync-indicator" style="display: flex; align-items: center;">${t}</span>
            </div>
        `}}customElements.define("yenvui-status-bar",YenvuiStatusBar);
