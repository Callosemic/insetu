import{LitElement as i,html as a,css as n}from"lit";export class YenvuiModal extends i{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},maxWidth:{type:String},fullscreen:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=n`
        :host { display: contents; } /* Native dialog handles its own visibility. Host must remain permeable. */
        dialog {
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-radius: 8px;
            padding: 0;
            width: 100%;
            max-width: var(--modal-max-width, 600px);
            max-height: 85dvh;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            display: none; /* Hide when not open */
            overflow: hidden;
            margin: auto; /* Centers natively in the #top-layer */
            box-sizing: border-box;
        }

        dialog[open] {
            display: grid; /* Bypass Safari flex collapse bug */
            grid-template-rows: auto minmax(0, 1fr) auto;
        }
        :host([fullscreen]) dialog {
            max-width: 100%;
            width: 100%;
            max-height: calc(100dvh - 30px);
            height: calc(100dvh - 30px);
            margin-bottom: 30px;
            border-radius: 0;
            border: none;
        }
        /* Native Backdrop Styling replacing manual DOM overlays */
        dialog::backdrop {
            background: var(--modal-backdrop, rgba(0, 0, 0, 0.75));
            backdrop-filter: var(--modal-backdrop-filter, blur(3px));
        }

        .header {
            padding: 12px 20px;
            border-bottom: 1px solid var(--border, #444);
            background: var(--input-bg, #2d2d2d);
            border-top: 4px solid var(--intent-primary, #3b82f6);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            min-width: 0;
            width: 100%;
            box-sizing: border-box;
        }

        .header h3 {
            margin: 0;
            font-size: 1.2rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
            flex: 1;
            margin-right: 15px;
        }
        .close-btn {
            background: var(--intent-neutral, #64748b);
            color: var(--text, #ffffff);
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85rem;
            transition: filter 0.2s;
            flex-shrink: 0;
        }

        .close-btn:hover {
            filter: brightness(1.2);
        }
        .body {
            padding: 20px;
            overflow-y: auto;
            min-height: 0; /* Prevents vertical grid blowout */
            min-width: 0; /* Prevents horizontal grid blowout */
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 15px;
            -webkit-overflow-scrolling: touch; /* Momentum scrolling for iOS */
        }
        :host([flush]) .body {
            padding: 0;
            gap: 0;
        }
        .footer {
            padding: 12px 20px;
            gap: 12px;
            border-top: 1px solid var(--border, #444);
            background: var(--input-bg, #2d2d2d);
            display: flex;
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
        }
        /* Standardizes slotted footer buttons automatically */
        ::slotted(button[slot="footer"]) { 
            flex: 1; 
            margin: 0 !important; 
            padding: 12px !important; 
            border-radius: 6px !important; 
            font-size: 1.05rem !important; 
            font-weight: bold !important; 
            border: none !important; 
            cursor: pointer; 
        }
        ::slotted(yenvui-async-btn[slot="footer"]) {
            flex: 1;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            display: block;
            --btn-padding: 12px;
            --btn-font-size: 1.05rem;
            --btn-border-radius: 6px;
        }
    `;constructor(){super(),this.open=!1,this.titleText="",this.maxWidth="",this.fullscreen=!1}updated(e){const t=this.shadowRoot.querySelector("dialog");t&&(this.open&&!t.open?(window.getComputedStyle(this).display==="none"&&console.warn(`[yenVUI] \u26A0\uFE0F Cannot execute showModal() on <yenvui-modal> because an ancestor is setting 'display: none'. This will cause a UI freeze. Target title: "${this.titleText}"`),t.showModal()):!this.open&&t.open&&setTimeout(()=>{t.open&&t.close()},0)),e.has("maxWidth")&&this.maxWidth&&this.style.setProperty("--modal-max-width",this.maxWidth)}disconnectedCallback(){super.disconnectedCallback();const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(document.body.appendChild(e),e.close(),e.remove())}_handleNativeCancel(e){e.preventDefault(),this._dispatchClose()}_handleBackdropClick(e){const o=this.shadowRoot.querySelector("dialog").getBoundingClientRect();o.top<=e.clientY&&e.clientY<=o.top+o.height&&o.left<=e.clientX&&e.clientX<=o.left+o.width||this._dispatchClose()}_dispatchClose(){const e=new CustomEvent("yenvui-modal-closing",{bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(e),e.defaultPrevented)return;const t=this.shadowRoot.querySelector("dialog");t&&t.open&&t.close(),setTimeout(()=>{this.open=!1,this.dispatchEvent(new CustomEvent("yenvui-modal-closed",{bubbles:!0,composed:!0}))},10)}render(){return a`
            <dialog 
                @cancel=${this._handleNativeCancel}
                @click=${this._handleBackdropClick}>
                
                <div class="header">
                    <h3>${this.titleText}</h3>
                    <button class="close-btn" @click=${this._dispatchClose}>Back</button>
                </div>
                <div class="body">
                    <slot name="body"></slot>
                    <slot></slot>
                </div>
                <div class="footer">
                    <slot name="footer"></slot>
                </div>
                
            </dialog>
        `}}customElements.define("yenvui-modal",YenvuiModal);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aU1vZGFsIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIG1heFdpZHRoOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBmdWxsc2NyZWVuOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGNvbnRlbnRzOyB9IC8qIE5hdGl2ZSBkaWFsb2cgaGFuZGxlcyBpdHMgb3duIHZpc2liaWxpdHkuIEhvc3QgbXVzdCByZW1haW4gcGVybWVhYmxlLiAqL1xuICAgICAgICBkaWFsb2cge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LXdpZHRoOiB2YXIoLS1tb2RhbC1tYXgtd2lkdGgsIDYwMHB4KTtcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDg1ZHZoO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjYpO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTsgLyogSGlkZSB3aGVuIG5vdCBvcGVuICovXG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgbWFyZ2luOiBhdXRvOyAvKiBDZW50ZXJzIG5hdGl2ZWx5IGluIHRoZSAjdG9wLWxheWVyICovXG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG5cbiAgICAgICAgZGlhbG9nW29wZW5dIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7IC8qIEJ5cGFzcyBTYWZhcmkgZmxleCBjb2xsYXBzZSBidWcgKi9cbiAgICAgICAgICAgIGdyaWQtdGVtcGxhdGUtcm93czogYXV0byBtaW5tYXgoMCwgMWZyKSBhdXRvO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmdWxsc2NyZWVuXSkgZGlhbG9nIHtcbiAgICAgICAgICAgIG1heC13aWR0aDogMTAwJTtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LWhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIGhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDMwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC8qIE5hdGl2ZSBCYWNrZHJvcCBTdHlsaW5nIHJlcGxhY2luZyBtYW51YWwgRE9NIG92ZXJsYXlzICovXG4gICAgICAgIGRpYWxvZzo6YmFja2Ryb3Age1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tbW9kYWwtYmFja2Ryb3AsIHJnYmEoMCwgMCwgMCwgMC43NSkpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiB2YXIoLS1tb2RhbC1iYWNrZHJvcC1maWx0ZXIsIGJsdXIoM3B4KSk7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogNHB4IHNvbGlkIHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIGgzIHtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBtYXJnaW4tcmlnaHQ6IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNsb3NlLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2ZmZmZmZik7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTRweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5jbG9zZS1idG46aG92ZXIge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMik7XG4gICAgICAgIH1cbiAgICAgICAgLmJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICAgICAgICBtaW4taGVpZ2h0OiAwOyAvKiBQcmV2ZW50cyB2ZXJ0aWNhbCBncmlkIGJsb3dvdXQgKi9cbiAgICAgICAgICAgIG1pbi13aWR0aDogMDsgLyogUHJldmVudHMgaG9yaXpvbnRhbCBncmlkIGJsb3dvdXQgKi9cbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgZ2FwOiAxNXB4O1xuICAgICAgICAgICAgLXdlYmtpdC1vdmVyZmxvdy1zY3JvbGxpbmc6IHRvdWNoOyAvKiBNb21lbnR1bSBzY3JvbGxpbmcgZm9yIGlPUyAqL1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICBnYXA6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmZvb3RlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDIwcHg7XG4gICAgICAgICAgICBnYXA6IDEycHg7XG4gICAgICAgICAgICBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAvKiBTdGFuZGFyZGl6ZXMgc2xvdHRlZCBmb290ZXIgYnV0dG9ucyBhdXRvbWF0aWNhbGx5ICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b25bc2xvdD1cImZvb3RlclwiXSkgeyBcbiAgICAgICAgICAgIGZsZXg6IDE7IFxuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgcGFkZGluZzogMTJweCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbSAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyOyBcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoeWVudnVpLWFzeW5jLWJ0bltzbG90PVwiZm9vdGVyXCJdKSB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogMTJweDtcbiAgICAgICAgICAgIC0tYnRuLWZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIC0tYnRuLWJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGl0bGVUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMubWF4V2lkdGggPSAnJztcbiAgICAgICAgdGhpcy5mdWxsc2NyZWVuID0gZmFsc2U7XG4gICAgfVxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBpZiAoZGlhbG9nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcGVuICYmICFkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzKS5kaXNwbGF5ID09PSAnbm9uZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbeWVuVlVJXSBcdTI2QTBcdUZFMEYgQ2Fubm90IGV4ZWN1dGUgc2hvd01vZGFsKCkgb24gPHllbnZ1aS1tb2RhbD4gYmVjYXVzZSBhbiBhbmNlc3RvciBpcyBzZXR0aW5nICdkaXNwbGF5OiBub25lJy4gVGhpcyB3aWxsIGNhdXNlIGEgVUkgZnJlZXplLiBUYXJnZXQgdGl0bGU6IFwiJHt0aGlzLnRpdGxlVGV4dH1cImApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkaWFsb2cuc2hvd01vZGFsKCk7IC8vIEltcGVyYXRpdmUgQVBJIHB1c2ggdG8gI3RvcC1sYXllclxuICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vcGVuICYmIGRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICAgICAgLy8gRVNDQVBFIFRIRSBSRU5ERVIgQ1lDTEU6IElmIHRoZSBob3N0IGFwcCBzZXRzIG9wZW49ZmFsc2UsIHVwZGF0ZWQoKSBydW5zLlxuICAgICAgICAgICAgICAgIC8vIENhbGxpbmcgZGlhbG9nLmNsb3NlKCkgc3luY2hyb25vdXNseSBpbnNpZGUgTGl0J3MgcmVuZGVyIHBpcGVsaW5lIHRyaWdnZXJzIFxuICAgICAgICAgICAgICAgIC8vIHRoZSBDaHJvbWl1bSBpbmVydCBidWcuIFlpZWxkIHRvIHRoZSBtYWNyby10YXNrIHF1ZXVlLlxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGlhbG9nLm9wZW4pIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ21heFdpZHRoJykgJiYgdGhpcy5tYXhXaWR0aCkge1xuICAgICAgICAgICAgdGhpcy5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1tb2RhbC1tYXgtd2lkdGgnLCB0aGlzLm1heFdpZHRoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgLy8gVU5JVkVSU0FMIEZBSUxTQUZFOiBJZiBhIGhvc3QgZnJhbWV3b3JrIChsaWtlIExpdCkgY29uZGl0aW9uYWxseSBkZXN0cm95cyBcbiAgICAgICAgLy8gdGhlIG1vZGFsIGZyb20gdGhlIERPTSB3aGlsZSBpdCBpcyBvcGVuLCB0aGUgYnJvd3NlciB3aWxsIGxlYXZlIHRoZSByZXN0IG9mIFxuICAgICAgICAvLyB0aGUgZG9jdW1lbnQgcGVybWFuZW50bHkgJ2luZXJ0JyAodW5jbGlja2FibGUpLiBcbiAgICAgICAgLy8gV2UgbXVzdCB0ZW1wb3JhcmlseSByZS1hdHRhY2ggdGhlIGRpYWxvZyB0byB0aGUgYWN0aXZlIERPTSB0byBjbG9zZSBpdCBjbGVhbmx5LlxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGlmIChkaWFsb2cgJiYgZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICAgICAgZGlhbG9nLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZU5hdGl2ZUNhbmNlbChlKSB7XG4gICAgICAgIC8vIFN0b3AgdGhlIGJyb3dzZXIgZnJvbSBpbXBsaWNpdGx5IGNsb3NpbmcgdGhlIGRpYWxvZyBhbmQgZGVzeW5jaHJvbml6aW5nIFVERiBzdGF0ZVxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICB0aGlzLl9kaXNwYXRjaENsb3NlKCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUJhY2tkcm9wQ2xpY2soZSkge1xuICAgICAgICAvLyBOYXRpdmUgPGRpYWxvZz4gc3BhbnMgdGhlIHNjcmVlbiwgYnV0IGl0cyBib3VuZGluZyBib3ggaXMganVzdCB0aGUgY29udGVudCBwYW5lbC5cbiAgICAgICAgLy8gSWYgdGhlIGNsaWNrIGZhbGxzIG91dHNpZGUgdGhlIGJvdW5kaW5nIGJveCwgaXQgaGl0IHRoZSA6OmJhY2tkcm9wLlxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSBkaWFsb2cuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGNvbnN0IGlzSW5EaWFsb2cgPSAocmVjdC50b3AgPD0gZS5jbGllbnRZICYmIGUuY2xpZW50WSA8PSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0XG4gICAgICAgICAgICAmJiByZWN0LmxlZnQgPD0gZS5jbGllbnRYICYmIGUuY2xpZW50WCA8PSByZWN0LmxlZnQgKyByZWN0LndpZHRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaXNJbkRpYWxvZykge1xuICAgICAgICAgICAgdGhpcy5fZGlzcGF0Y2hDbG9zZSgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9kaXNwYXRjaENsb3NlKCkge1xuICAgICAgICBjb25zdCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgneWVudnVpLW1vZGFsLWNsb3NpbmcnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgICAgICBpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkaWFsb2cnKTtcbiAgICAgICAgaWYgKGRpYWxvZyAmJiBkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBZSUVMRCBUTyBCUk9XU0VSIEVOR0lORTogRW5zdXJlIHRoZSBicm93c2VyIG5hdGl2ZWx5IHN0cmlwcyB0aGUgJ2luZXJ0JyBcbiAgICAgICAgLy8gYXR0cmlidXRlIGZyb20gdGhlIGRvY3VtZW50IGJvZHkgQkVGT1JFIGFsZXJ0aW5nIExpdCB0byBtdXRhdGUgdGhlIERPTS5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1tb2RhbC1jbG9zZWQnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlIH0pKTtcbiAgICAgICAgfSwgMTApO1xuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGlhbG9nIFxuICAgICAgICAgICAgICAgIEBjYW5jZWw9JHt0aGlzLl9oYW5kbGVOYXRpdmVDYW5jZWx9XG4gICAgICAgICAgICAgICAgQGNsaWNrPSR7dGhpcy5faGFuZGxlQmFja2Ryb3BDbGlja30+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8aDM+JHt0aGlzLnRpdGxlVGV4dH08L2gzPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCIgQGNsaWNrPSR7dGhpcy5fZGlzcGF0Y2hDbG9zZX0+QmFjazwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJib2R5XCI+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvb3RlclwiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiZm9vdGVyXCI+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgPC9kaWFsb2c+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktbW9kYWwnLCBZZW52dWlNb2RhbCk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUUvQixhQUFNLG9C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LEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsR0FBVUEsRUFBTyxNQUNqQkEsRUFBTyxNQUFNLEVBS2pCLFdBQVcsSUFBTSxDQUNiLEtBQUssS0FBTyxHQUNaLEtBQUssY0FBYyxJQUFJLFlBQVksc0JBQXVCLENBQUUsUUFBUyxHQUFNLFNBQVUsRUFBSyxDQUFDLENBQUMsQ0FDaEcsRUFBRyxFQUFFLENBQ1QsQ0FFQSxRQUFTLENBQ0wsT0FBT0g7QUFBQTtBQUFBLDBCQUVXLEtBQUssbUJBQW1CO0FBQUEseUJBQ3pCLEtBQUssb0JBQW9CO0FBQUE7QUFBQTtBQUFBLDBCQUd4QixLQUFLLFNBQVM7QUFBQSx1REFDZSxLQUFLLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBWXRFLENBQ0osQ0FDQSxlQUFlLE9BQU8sZUFBZ0IsV0FBVyIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImNoYW5nZWRQcm9wZXJ0aWVzIiwgImRpYWxvZyIsICJyZWN0IiwgImV2ZW50Il0KfQo=
