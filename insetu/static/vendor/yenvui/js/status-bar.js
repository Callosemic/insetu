import{LitElement as e,html as i,css as n}from"lit";export class YenvuiStatusBar extends e{static properties={text:{type:String},isError:{type:Boolean},syncState:{type:String}};static styles=n`
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
    `;constructor(){super(),this.text="",this.isError=!1,this.syncState="synced"}render(){let t=i``;return this.syncState==="pending"&&(t=i`<yv-icon name="circle-dot" style="width: 12px; height: 12px; color: var(--intent-warning); margin-right: 4px; display: inline-block; vertical-align: middle;"></yv-icon> Pending Sync`),this.syncState==="syncing"&&(t=i`<yv-icon name="refresh-cw" style="width: 12px; height: 12px; margin-right: 4px; display: inline-block; vertical-align: middle;"></yv-icon> Syncing...`),this.syncState==="synced"&&(t=i`<yv-icon name="check-circle-2" style="width: 12px; height: 12px; color: var(--intent-success); margin-right: 4px; display: inline-block; vertical-align: middle;"></yv-icon> Synced`),this.syncState==="offline"&&(t=i`<yv-icon name="wifi-off" style="width: 12px; height: 12px; color: var(--text-muted); margin-right: 4px; display: inline-block; vertical-align: middle;"></yv-icon> Offline`),this.syncState==="reconciling"&&(t=i`<yv-icon name="cloud-sync" style="width: 12px; height: 12px; color: var(--intent-highlight); margin-right: 4px; display: inline-block; vertical-align: middle;"></yv-icon> Reconciling...`),this.syncState==="error"&&(t=i`<yv-icon name="alert-triangle" style="width: 12px; height: 12px; color: var(--intent-danger); margin-right: 4px; display: inline-block; vertical-align: middle;"></yv-icon> Sync Error`),i`
            <div class="bottom-bar ${this.isError?"error":""}" title="${this.text}">
                <span class="text-content">${this.text}</span>
                <span class="sync-indicator" style="display: flex; align-items: center;">${t}</span>
            </div>
        `}}customElements.define("yenvui-status-bar",YenvuiStatusBar);
