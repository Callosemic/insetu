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
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(3px);
            /* Globally prevent the OS status bar from being darkened by the modal overlay */
            clip-path: polygon(0 0, 100% 0, 100% calc(100% - 30px), 0 calc(100% - 30px));
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
    `;constructor(){super(),this.open=!1,this.titleText="",this.maxWidth="",this.fullscreen=!1}updated(e){const t=this.shadowRoot.querySelector("dialog");t&&(this.open&&!t.open?(window.getComputedStyle(this).display==="none"&&console.warn(`[yenVUI] \u26A0\uFE0F Cannot execute showModal() on <yenvui-modal> because an ancestor is setting 'display: none'. This will cause a UI freeze. Target title: "${this.titleText}"`),t.showModal()):!this.open&&t.open&&t.close()),e.has("maxWidth")&&this.maxWidth&&this.style.setProperty("--modal-max-width",this.maxWidth)}disconnectedCallback(){super.disconnectedCallback();const e=this.shadowRoot.querySelector("dialog");e&&e.open&&e.close()}_handleNativeCancel(e){e.preventDefault(),this._dispatchClose()}_handleBackdropClick(e){const o=this.shadowRoot.querySelector("dialog").getBoundingClientRect();o.top<=e.clientY&&e.clientY<=o.top+o.height&&o.left<=e.clientX&&e.clientX<=o.left+o.width||this._dispatchClose()}_dispatchClose(){const e=new CustomEvent("yenvui-modal-closing",{bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(e),e.defaultPrevented)return;this.open=!1;const t=this.shadowRoot.querySelector("dialog");t&&t.open&&t.close(),this.dispatchEvent(new CustomEvent("yenvui-modal-closed",{bubbles:!0,composed:!0}))}render(){return a`
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aU1vZGFsIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIG1heFdpZHRoOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBmdWxsc2NyZWVuOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGNvbnRlbnRzOyB9IC8qIE5hdGl2ZSBkaWFsb2cgaGFuZGxlcyBpdHMgb3duIHZpc2liaWxpdHkuIEhvc3QgbXVzdCByZW1haW4gcGVybWVhYmxlLiAqL1xuICAgICAgICBkaWFsb2cge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LXdpZHRoOiB2YXIoLS1tb2RhbC1tYXgtd2lkdGgsIDYwMHB4KTtcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDg1ZHZoO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjYpO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTsgLyogSGlkZSB3aGVuIG5vdCBvcGVuICovXG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgbWFyZ2luOiBhdXRvOyAvKiBDZW50ZXJzIG5hdGl2ZWx5IGluIHRoZSAjdG9wLWxheWVyICovXG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG5cbiAgICAgICAgZGlhbG9nW29wZW5dIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7IC8qIEJ5cGFzcyBTYWZhcmkgZmxleCBjb2xsYXBzZSBidWcgKi9cbiAgICAgICAgICAgIGdyaWQtdGVtcGxhdGUtcm93czogYXV0byBtaW5tYXgoMCwgMWZyKSBhdXRvO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmdWxsc2NyZWVuXSkgZGlhbG9nIHtcbiAgICAgICAgICAgIG1heC13aWR0aDogMTAwJTtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LWhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIGhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDMwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogTmF0aXZlIEJhY2tkcm9wIFN0eWxpbmcgcmVwbGFjaW5nIG1hbnVhbCBET00gb3ZlcmxheXMgKi9cbiAgICAgICAgZGlhbG9nOjpiYWNrZHJvcCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDAsIDAsIDAuNzUpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDNweCk7XG4gICAgICAgICAgICAvKiBHbG9iYWxseSBwcmV2ZW50IHRoZSBPUyBzdGF0dXMgYmFyIGZyb20gYmVpbmcgZGFya2VuZWQgYnkgdGhlIG1vZGFsIG92ZXJsYXkgKi9cbiAgICAgICAgICAgIGNsaXAtcGF0aDogcG9seWdvbigwIDAsIDEwMCUgMCwgMTAwJSBjYWxjKDEwMCUgLSAzMHB4KSwgMCBjYWxjKDEwMCUgLSAzMHB4KSk7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogNHB4IHNvbGlkIHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIGgzIHtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBtYXJnaW4tcmlnaHQ6IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNsb3NlLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2ZmZmZmZik7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTRweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5jbG9zZS1idG46aG92ZXIge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMik7XG4gICAgICAgIH1cbiAgICAgICAgLmJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICAgICAgICBtaW4taGVpZ2h0OiAwOyAvKiBQcmV2ZW50cyB2ZXJ0aWNhbCBncmlkIGJsb3dvdXQgKi9cbiAgICAgICAgICAgIG1pbi13aWR0aDogMDsgLyogUHJldmVudHMgaG9yaXpvbnRhbCBncmlkIGJsb3dvdXQgKi9cbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgZ2FwOiAxNXB4O1xuICAgICAgICAgICAgLXdlYmtpdC1vdmVyZmxvdy1zY3JvbGxpbmc6IHRvdWNoOyAvKiBNb21lbnR1bSBzY3JvbGxpbmcgZm9yIGlPUyAqL1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICBnYXA6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmZvb3RlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDIwcHg7XG4gICAgICAgICAgICBnYXA6IDEycHg7XG4gICAgICAgICAgICBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAvKiBTdGFuZGFyZGl6ZXMgc2xvdHRlZCBmb290ZXIgYnV0dG9ucyBhdXRvbWF0aWNhbGx5ICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b25bc2xvdD1cImZvb3RlclwiXSkgeyBcbiAgICAgICAgICAgIGZsZXg6IDE7IFxuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgcGFkZGluZzogMTJweCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbSAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyOyBcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoeWVudnVpLWFzeW5jLWJ0bltzbG90PVwiZm9vdGVyXCJdKSB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogMTJweDtcbiAgICAgICAgICAgIC0tYnRuLWZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIC0tYnRuLWJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGl0bGVUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMubWF4V2lkdGggPSAnJztcbiAgICAgICAgdGhpcy5mdWxsc2NyZWVuID0gZmFsc2U7XG4gICAgfVxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBpZiAoZGlhbG9nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcGVuICYmICFkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgICAgIC8vIEd1YXJkcmFpbDogRGV0ZWN0IGlmIGFuIGV4dGVybmFsIGFwcGxpY2F0aW9uIHNoZWxsIGhhcyB0cmFwcGVkIHRoZSBtb2RhbCBpbiBkaXNwbGF5OiBub25lXG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMpLmRpc3BsYXkgPT09ICdub25lJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFt5ZW5WVUldIFx1MjZBMFx1RkUwRiBDYW5ub3QgZXhlY3V0ZSBzaG93TW9kYWwoKSBvbiA8eWVudnVpLW1vZGFsPiBiZWNhdXNlIGFuIGFuY2VzdG9yIGlzIHNldHRpbmcgJ2Rpc3BsYXk6IG5vbmUnLiBUaGlzIHdpbGwgY2F1c2UgYSBVSSBmcmVlemUuIFRhcmdldCB0aXRsZTogXCIke3RoaXMudGl0bGVUZXh0fVwiYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TW9kYWwoKTsgLy8gSW1wZXJhdGl2ZSBBUEkgcHVzaCB0byAjdG9wLWxheWVyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLm9wZW4gJiYgZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgICAgICBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdtYXhXaWR0aCcpICYmIHRoaXMubWF4V2lkdGgpIHtcbiAgICAgICAgICAgIHRoaXMuc3R5bGUuc2V0UHJvcGVydHkoJy0tbW9kYWwtbWF4LXdpZHRoJywgdGhpcy5tYXhXaWR0aCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIC8vIEZhaWxzYWZlOiBJZiB0aGUgaG9zdCBjb21wb25lbnQgZGVzdHJveXMgdGhlIG1vZGFsIGZyb20gdGhlIERPTSB3aGlsZSBpdCBpcyBvcGVuLCBcbiAgICAgICAgLy8gZm9yY2UgdGhlIG5hdGl2ZSBkaWFsb2cgdG8gY2xvc2Ugc28gaXQgZG9lc24ndCBnZXQgb3JwaGFuZWQgaW4gdGhlICN0b3AtbGF5ZXIuXG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkaWFsb2cnKTtcbiAgICAgICAgaWYgKGRpYWxvZyAmJiBkaWFsb2cub3BlbikgZGlhbG9nLmNsb3NlKCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZU5hdGl2ZUNhbmNlbChlKSB7XG4gICAgICAgIC8vIFN0b3AgdGhlIGJyb3dzZXIgZnJvbSBpbXBsaWNpdGx5IGNsb3NpbmcgdGhlIGRpYWxvZyBhbmQgZGVzeW5jaHJvbml6aW5nIFVERiBzdGF0ZVxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICB0aGlzLl9kaXNwYXRjaENsb3NlKCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUJhY2tkcm9wQ2xpY2soZSkge1xuICAgICAgICAvLyBOYXRpdmUgPGRpYWxvZz4gc3BhbnMgdGhlIHNjcmVlbiwgYnV0IGl0cyBib3VuZGluZyBib3ggaXMganVzdCB0aGUgY29udGVudCBwYW5lbC5cbiAgICAgICAgLy8gSWYgdGhlIGNsaWNrIGZhbGxzIG91dHNpZGUgdGhlIGJvdW5kaW5nIGJveCwgaXQgaGl0IHRoZSA6OmJhY2tkcm9wLlxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSBkaWFsb2cuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGNvbnN0IGlzSW5EaWFsb2cgPSAocmVjdC50b3AgPD0gZS5jbGllbnRZICYmIGUuY2xpZW50WSA8PSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0XG4gICAgICAgICAgICAmJiByZWN0LmxlZnQgPD0gZS5jbGllbnRYICYmIGUuY2xpZW50WCA8PSByZWN0LmxlZnQgKyByZWN0LndpZHRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaXNJbkRpYWxvZykge1xuICAgICAgICAgICAgdGhpcy5fZGlzcGF0Y2hDbG9zZSgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9kaXNwYXRjaENsb3NlKCkge1xuICAgICAgICBjb25zdCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgneWVudnVpLW1vZGFsLWNsb3NpbmcnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgICAgICBpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIFBFUk1BTkVOVCBGSVg6IEluc3RhbnRseSB0ZWFyIGRvd24gdGhlIG5hdGl2ZSBkaWFsb2cgdG8gcHJldmVudCBVSSBmcmVlemVzXG4gICAgICAgIC8vIGNhdXNlZCBieSBVREYgcmVmbGVjdGlvbiBsYXRlbmN5IG9yIGRyb3BwZWQgcHJvcGVydHkgYmluZGluZ3MuXG4gICAgICAgIHRoaXMub3BlbiA9IGZhbHNlO1xuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGlmIChkaWFsb2cgJiYgZGlhbG9nLm9wZW4pIGRpYWxvZy5jbG9zZSgpO1xuXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1tb2RhbC1jbG9zZWQnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpYWxvZyBcbiAgICAgICAgICAgICAgICBAY2FuY2VsPSR7dGhpcy5faGFuZGxlTmF0aXZlQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUJhY2tkcm9wQ2xpY2t9PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGgzPiR7dGhpcy50aXRsZVRleHR9PC9oMz5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNsb3NlLWJ0blwiIEBjbGljaz0ke3RoaXMuX2Rpc3BhdGNoQ2xvc2V9PkJhY2s8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYm9keVwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb290ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImZvb3RlclwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIDwvZGlhbG9nPlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLW1vZGFsJywgWWVudnVpTW9kYWwpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSxvQkFBb0JGLENBQVcsQ0FDeEMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsS0FBTSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDckMsU0FBVSxDQUFFLEtBQU0sTUFBTyxFQUN6QixXQUFZLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMzQyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWlJaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLEtBQU8sR0FDWixLQUFLLFVBQVksR0FDakIsS0FBSyxTQUFXLEdBQ2hCLEtBQUssV0FBYSxFQUN0QixDQUNBLFFBQVFDLEVBQW1CLENBQ3ZCLE1BQU1DLEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsSUFDSSxLQUFLLE1BQVEsQ0FBQ0EsRUFBTyxNQUVqQixPQUFPLGlCQUFpQixJQUFJLEVBQUUsVUFBWSxRQUMxQyxRQUFRLEtBQUssa0tBQXdKLEtBQUssU0FBUyxHQUFHLEVBRTFMQSxFQUFPLFVBQVUsR0FDVixDQUFDLEtBQUssTUFBUUEsRUFBTyxNQUM1QkEsRUFBTyxNQUFNLEdBR2pCRCxFQUFrQixJQUFJLFVBQVUsR0FBSyxLQUFLLFVBQzFDLEtBQUssTUFBTSxZQUFZLG9CQUFxQixLQUFLLFFBQVEsQ0FFakUsQ0FDQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFHM0IsTUFBTUMsRUFBUyxLQUFLLFdBQVcsY0FBYyxRQUFRLEVBQ2pEQSxHQUFVQSxFQUFPLE1BQU1BLEVBQU8sTUFBTSxDQUM1QyxDQUVBLG9CQUFvQixFQUFHLENBRW5CLEVBQUUsZUFBZSxFQUNqQixLQUFLLGVBQWUsQ0FDeEIsQ0FFQSxxQkFBcUIsRUFBRyxDQUlwQixNQUFNQyxFQURTLEtBQUssV0FBVyxjQUFjLFFBQVEsRUFDakMsc0JBQXNCLEVBQ3RCQSxFQUFLLEtBQU8sRUFBRSxTQUFXLEVBQUUsU0FBV0EsRUFBSyxJQUFNQSxFQUFLLFFBQ25FQSxFQUFLLE1BQVEsRUFBRSxTQUFXLEVBQUUsU0FBV0EsRUFBSyxLQUFPQSxFQUFLLE9BRzNELEtBQUssZUFBZSxDQUU1QixDQUNBLGdCQUFpQixDQUNiLE1BQU1DLEVBQVEsSUFBSSxZQUFZLHVCQUF3QixDQUFFLFFBQVMsR0FBTSxTQUFVLEdBQU0sV0FBWSxFQUFLLENBQUMsRUFFekcsR0FEQSxLQUFLLGNBQWNBLENBQUssRUFDcEJBLEVBQU0saUJBQWtCLE9BSTVCLEtBQUssS0FBTyxHQUNaLE1BQU1GLEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsR0FBVUEsRUFBTyxNQUFNQSxFQUFPLE1BQU0sRUFFeEMsS0FBSyxjQUFjLElBQUksWUFBWSxzQkFBdUIsQ0FBRSxRQUFTLEdBQU0sU0FBVSxFQUFLLENBQUMsQ0FBQyxDQUNoRyxDQUVBLFFBQVMsQ0FDTCxPQUFPSDtBQUFBO0FBQUEsMEJBRVcsS0FBSyxtQkFBbUI7QUFBQSx5QkFDekIsS0FBSyxvQkFBb0I7QUFBQTtBQUFBO0FBQUEsMEJBR3hCLEtBQUssU0FBUztBQUFBLHVEQUNlLEtBQUssY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FZdEUsQ0FDSixDQUNBLGVBQWUsT0FBTyxlQUFnQixXQUFXIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAiZGlhbG9nIiwgInJlY3QiLCAiZXZlbnQiXQp9Cg==
