import{LitElement as i,html as a,css as n}from"lit";export class YenvuiModal extends i{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},maxWidth:{type:String},fullscreen:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},transparent:{type:Boolean,reflect:!0}};static styles=n`
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
        :host([transparent]) dialog::backdrop,
        :host([fullscreen]) dialog::backdrop {
            background: transparent !important;
            backdrop-filter: none !important;
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
            color: #ffffff;
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85rem;
            transition: filter 0.2s, background 0.2s;
            flex-shrink: 0;
        }

        .close-btn:hover {
            filter: brightness(1.2);
        }

        :host([data-theme="e-ink"]) .close-btn {
            background: #ffffff;
            color: #000000;
            border: 2px solid #000000;
            box-shadow: 2px 2px 0 #000000;
        }

        :host([data-theme="e-ink"]) .close-btn:hover {
            background: var(--bg-hover, #f1f5f9);
            filter: none;
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
    `;constructor(){super(),this.open=!1,this.titleText="",this.maxWidth="",this.fullscreen=!1}updated(e){const t=this.shadowRoot.querySelector("dialog");t&&(this.open&&!t.open?(window.getComputedStyle(this).display==="none"&&console.warn(`[yenVUI] \u26A0\uFE0F Cannot execute showModal() on <yenvui-modal> because an ancestor is setting 'display: none'. This will cause a UI freeze. Target title: "${this.titleText}"`),t.showModal()):!this.open&&t.open?setTimeout(()=>{t.open&&t.close()},0):this.open&&t.open&&e.has("open")&&(t.close(),t.showModal())),e.has("maxWidth")&&this.maxWidth&&this.style.setProperty("--modal-max-width",this.maxWidth)}bringToFront(){const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(e.close(),e.showModal())}disconnectedCallback(){super.disconnectedCallback();const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(document.body.appendChild(e),e.close(),e.remove())}_handleNativeCancel(e){e.preventDefault(),this._dispatchClose()}_handleBackdropClick(e){const o=this.shadowRoot.querySelector("dialog").getBoundingClientRect();o.top<=e.clientY&&e.clientY<=o.top+o.height&&o.left<=e.clientX&&e.clientX<=o.left+o.width||this._dispatchClose()}_dispatchClose(){const e=new CustomEvent("yenvui-modal-closing",{bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(e),e.defaultPrevented)return;const t=this.shadowRoot.querySelector("dialog");t&&t.open&&t.close(),setTimeout(()=>{this.open=!1,this.dispatchEvent(new CustomEvent("yenvui-modal-closed",{bubbles:!0,composed:!0}))},10)}render(){return a`
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlNb2RhbCBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0aXRsZVRleHQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIG9wZW46IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBtYXhXaWR0aDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZnVsbHNjcmVlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgdHJhbnNwYXJlbnQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGNvbnRlbnRzOyB9IC8qIE5hdGl2ZSBkaWFsb2cgaGFuZGxlcyBpdHMgb3duIHZpc2liaWxpdHkuIEhvc3QgbXVzdCByZW1haW4gcGVybWVhYmxlLiAqL1xuICAgICAgICBkaWFsb2cge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LXdpZHRoOiB2YXIoLS1tb2RhbC1tYXgtd2lkdGgsIDYwMHB4KTtcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDg1ZHZoO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjYpO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTsgLyogSGlkZSB3aGVuIG5vdCBvcGVuICovXG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgbWFyZ2luOiBhdXRvOyAvKiBDZW50ZXJzIG5hdGl2ZWx5IGluIHRoZSAjdG9wLWxheWVyICovXG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG5cbiAgICAgICAgZGlhbG9nW29wZW5dIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7IC8qIEJ5cGFzcyBTYWZhcmkgZmxleCBjb2xsYXBzZSBidWcgKi9cbiAgICAgICAgICAgIGdyaWQtdGVtcGxhdGUtcm93czogYXV0byBtaW5tYXgoMCwgMWZyKSBhdXRvO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmdWxsc2NyZWVuXSkgZGlhbG9nIHtcbiAgICAgICAgICAgIG1heC13aWR0aDogMTAwJTtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LWhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIGhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDMwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC8qIE5hdGl2ZSBCYWNrZHJvcCBTdHlsaW5nIHJlcGxhY2luZyBtYW51YWwgRE9NIG92ZXJsYXlzICovXG4gICAgICAgIGRpYWxvZzo6YmFja2Ryb3Age1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tbW9kYWwtYmFja2Ryb3AsIHJnYmEoMCwgMCwgMCwgMC43NSkpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiB2YXIoLS1tb2RhbC1iYWNrZHJvcC1maWx0ZXIsIGJsdXIoM3B4KSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3RyYW5zcGFyZW50XSkgZGlhbG9nOjpiYWNrZHJvcCxcbiAgICAgICAgOmhvc3QoW2Z1bGxzY3JlZW5dKSBkaWFsb2c6OmJhY2tkcm9wIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5oZWFkZXIge1xuICAgICAgICAgICAgcGFkZGluZzogMTJweCAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBib3JkZXItdG9wOiA0cHggc29saWQgdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5oZWFkZXIgaDMge1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgZm9udC1zaXplOiAxLjJyZW07XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgICAgICAgbWluLXdpZHRoOiAwO1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIG1hcmdpbi1yaWdodDogMTVweDtcbiAgICAgICAgfVxuICAgICAgICAuY2xvc2UtYnRuIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDE0cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGZpbHRlciAwLjJzLCBiYWNrZ3JvdW5kIDAuMnM7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC5jbG9zZS1idG46aG92ZXIge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMik7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2xvc2UtYnRuIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmY7XG4gICAgICAgICAgICBjb2xvcjogIzAwMDAwMDtcbiAgICAgICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwMDAwMDA7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAycHggMnB4IDAgIzAwMDAwMDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jbG9zZS1idG46aG92ZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctaG92ZXIsICNmMWY1ZjkpO1xuICAgICAgICAgICAgZmlsdGVyOiBub25lO1xuICAgICAgICB9XG5cbiAgICAgICAgLmJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICAgICAgICBtaW4taGVpZ2h0OiAwOyAvKiBQcmV2ZW50cyB2ZXJ0aWNhbCBncmlkIGJsb3dvdXQgKi9cbiAgICAgICAgICAgIG1pbi13aWR0aDogMDsgLyogUHJldmVudHMgaG9yaXpvbnRhbCBncmlkIGJsb3dvdXQgKi9cbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgZ2FwOiAxNXB4O1xuICAgICAgICAgICAgLXdlYmtpdC1vdmVyZmxvdy1zY3JvbGxpbmc6IHRvdWNoOyAvKiBNb21lbnR1bSBzY3JvbGxpbmcgZm9yIGlPUyAqL1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICBnYXA6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLmZvb3RlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDIwcHg7XG4gICAgICAgICAgICBnYXA6IDEycHg7XG4gICAgICAgICAgICBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAvKiBTdGFuZGFyZGl6ZXMgc2xvdHRlZCBmb290ZXIgYnV0dG9ucyBhdXRvbWF0aWNhbGx5ICovXG4gICAgICAgIDo6c2xvdHRlZChidXR0b25bc2xvdD1cImZvb3RlclwiXSkgeyBcbiAgICAgICAgICAgIGZsZXg6IDE7IFxuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgcGFkZGluZzogMTJweCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4wNXJlbSAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyOyBcbiAgICAgICAgfVxuICAgICAgICA6OnNsb3R0ZWQoeWVudnVpLWFzeW5jLWJ0bltzbG90PVwiZm9vdGVyXCJdKSB7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgICAgICAgLS1idG4tcGFkZGluZzogMTJweDtcbiAgICAgICAgICAgIC0tYnRuLWZvbnQtc2l6ZTogMS4wNXJlbTtcbiAgICAgICAgICAgIC0tYnRuLWJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGl0bGVUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMubWF4V2lkdGggPSAnJztcbiAgICAgICAgdGhpcy5mdWxsc2NyZWVuID0gZmFsc2U7XG4gICAgfVxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBpZiAoZGlhbG9nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcGVuICYmICFkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzKS5kaXNwbGF5ID09PSAnbm9uZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbeWVuVlVJXSBcdTI2QTBcdUZFMEYgQ2Fubm90IGV4ZWN1dGUgc2hvd01vZGFsKCkgb24gPHllbnZ1aS1tb2RhbD4gYmVjYXVzZSBhbiBhbmNlc3RvciBpcyBzZXR0aW5nICdkaXNwbGF5OiBub25lJy4gVGhpcyB3aWxsIGNhdXNlIGEgVUkgZnJlZXplLiBUYXJnZXQgdGl0bGU6IFwiJHt0aGlzLnRpdGxlVGV4dH1cImApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkaWFsb2cuc2hvd01vZGFsKCk7IC8vIEltcGVyYXRpdmUgQVBJIHB1c2ggdG8gI3RvcC1sYXllclxuICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vcGVuICYmIGRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICAgICAgLy8gRVNDQVBFIFRIRSBSRU5ERVIgQ1lDTEU6IElmIHRoZSBob3N0IGFwcCBzZXRzIG9wZW49ZmFsc2UsIHVwZGF0ZWQoKSBydW5zLlxuICAgICAgICAgICAgICAgIC8vIENhbGxpbmcgZGlhbG9nLmNsb3NlKCkgc3luY2hyb25vdXNseSBpbnNpZGUgTGl0J3MgcmVuZGVyIHBpcGVsaW5lIHRyaWdnZXJzIFxuICAgICAgICAgICAgICAgIC8vIHRoZSBDaHJvbWl1bSBpbmVydCBidWcuIFlpZWxkIHRvIHRoZSBtYWNyby10YXNrIHF1ZXVlLlxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGlhbG9nLm9wZW4pIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm9wZW4gJiYgZGlhbG9nLm9wZW4gJiYgY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdvcGVuJykpIHtcbiAgICAgICAgICAgICAgICAvLyBTZWxmLWhlYWxpbmcgdG9wLWxheWVyIHN0YWNrIGJvdW5jZTogaWYgdGhlIGhvc3QgcmUtZXZhbHVhdGVzIHRoZSBvcGVuIHByb3BlcnR5IHRvIHRydWVcbiAgICAgICAgICAgICAgICAvLyB3aGlsZSB0aGUgbW9kYWwgaXMgYWxyZWFkeSBvcGVuLCBpdCBndWFyYW50ZWVzIHRoaXMgbW9kYWwganVtcHMgdG8gdGhlIGZyb250LlxuICAgICAgICAgICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TW9kYWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdtYXhXaWR0aCcpICYmIHRoaXMubWF4V2lkdGgpIHtcbiAgICAgICAgICAgIHRoaXMuc3R5bGUuc2V0UHJvcGVydHkoJy0tbW9kYWwtbWF4LXdpZHRoJywgdGhpcy5tYXhXaWR0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBicmluZ1RvRnJvbnQoKSB7XG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkaWFsb2cnKTtcbiAgICAgICAgaWYgKGRpYWxvZyAmJiBkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01vZGFsKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIC8vIFVOSVZFUlNBTCBGQUlMU0FGRTogSWYgYSBob3N0IGZyYW1ld29yayAobGlrZSBMaXQpIGNvbmRpdGlvbmFsbHkgZGVzdHJveXMgXG4gICAgICAgIC8vIHRoZSBtb2RhbCBmcm9tIHRoZSBET00gd2hpbGUgaXQgaXMgb3BlbiwgdGhlIGJyb3dzZXIgd2lsbCBsZWF2ZSB0aGUgcmVzdCBvZiBcbiAgICAgICAgLy8gdGhlIGRvY3VtZW50IHBlcm1hbmVudGx5ICdpbmVydCcgKHVuY2xpY2thYmxlKS4gXG4gICAgICAgIC8vIFdlIG11c3QgdGVtcG9yYXJpbHkgcmUtYXR0YWNoIHRoZSBkaWFsb2cgdG8gdGhlIGFjdGl2ZSBET00gdG8gY2xvc2UgaXQgY2xlYW5seS5cbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBpZiAoZGlhbG9nICYmIGRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgIGRpYWxvZy5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVOYXRpdmVDYW5jZWwoZSkge1xuICAgICAgICAvLyBTdG9wIHRoZSBicm93c2VyIGZyb20gaW1wbGljaXRseSBjbG9zaW5nIHRoZSBkaWFsb2cgYW5kIGRlc3luY2hyb25pemluZyBVREYgc3RhdGVcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBcbiAgICAgICAgdGhpcy5fZGlzcGF0Y2hDbG9zZSgpO1xuICAgIH1cblxuICAgIF9oYW5kbGVCYWNrZHJvcENsaWNrKGUpIHtcbiAgICAgICAgLy8gTmF0aXZlIDxkaWFsb2c+IHNwYW5zIHRoZSBzY3JlZW4sIGJ1dCBpdHMgYm91bmRpbmcgYm94IGlzIGp1c3QgdGhlIGNvbnRlbnQgcGFuZWwuXG4gICAgICAgIC8vIElmIHRoZSBjbGljayBmYWxscyBvdXRzaWRlIHRoZSBib3VuZGluZyBib3gsIGl0IGhpdCB0aGUgOjpiYWNrZHJvcC5cbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBjb25zdCByZWN0ID0gZGlhbG9nLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBjb25zdCBpc0luRGlhbG9nID0gKHJlY3QudG9wIDw9IGUuY2xpZW50WSAmJiBlLmNsaWVudFkgPD0gcmVjdC50b3AgKyByZWN0LmhlaWdodFxuICAgICAgICAgICAgJiYgcmVjdC5sZWZ0IDw9IGUuY2xpZW50WCAmJiBlLmNsaWVudFggPD0gcmVjdC5sZWZ0ICsgcmVjdC53aWR0aCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWlzSW5EaWFsb2cpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rpc3BhdGNoQ2xvc2UoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfZGlzcGF0Y2hDbG9zZSgpIHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1tb2RhbC1jbG9zaW5nJywgeyBidWJibGVzOiB0cnVlLCBjb21wb3NlZDogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSB9KTtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICAgICAgaWYgKGV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGlmIChkaWFsb2cgJiYgZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gWUlFTEQgVE8gQlJPV1NFUiBFTkdJTkU6IEVuc3VyZSB0aGUgYnJvd3NlciBuYXRpdmVseSBzdHJpcHMgdGhlICdpbmVydCcgXG4gICAgICAgIC8vIGF0dHJpYnV0ZSBmcm9tIHRoZSBkb2N1bWVudCBib2R5IEJFRk9SRSBhbGVydGluZyBMaXQgdG8gbXV0YXRlIHRoZSBET00uXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktbW9kYWwtY2xvc2VkJywgeyBidWJibGVzOiB0cnVlLCBjb21wb3NlZDogdHJ1ZSB9KSk7XG4gICAgICAgIH0sIDEwKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpYWxvZyBcbiAgICAgICAgICAgICAgICBAY2FuY2VsPSR7dGhpcy5faGFuZGxlTmF0aXZlQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUJhY2tkcm9wQ2xpY2t9PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGgzPiR7dGhpcy50aXRsZVRleHR9PC9oMz5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNsb3NlLWJ0blwiIEBjbGljaz0ke3RoaXMuX2Rpc3BhdGNoQ2xvc2V9PkJhY2s8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYm9keVwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb290ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImZvb3RlclwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIDwvZGlhbG9nPlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLW1vZGFsJywgWWVudnVpTW9kYWwpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFDL0IsYUFBTSxvQkFBb0JGLENBQVcsQ0FDeEMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsS0FBTSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDckMsU0FBVSxDQUFFLEtBQU0sTUFBTyxFQUN6QixXQUFZLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMzQyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN0QyxZQUFhLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUNoRCxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWdKaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLEtBQU8sR0FDWixLQUFLLFVBQVksR0FDakIsS0FBSyxTQUFXLEdBQ2hCLEtBQUssV0FBYSxFQUN0QixDQUNBLFFBQVFDLEVBQW1CLENBQ3ZCLE1BQU1DLEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsSUFDSSxLQUFLLE1BQVEsQ0FBQ0EsRUFBTyxNQUNqQixPQUFPLGlCQUFpQixJQUFJLEVBQUUsVUFBWSxRQUMxQyxRQUFRLEtBQUssa0tBQXdKLEtBQUssU0FBUyxHQUFHLEVBRTFMQSxFQUFPLFVBQVUsR0FDVixDQUFDLEtBQUssTUFBUUEsRUFBTyxLQUk1QixXQUFXLElBQU0sQ0FDVEEsRUFBTyxNQUFNQSxFQUFPLE1BQU0sQ0FDbEMsRUFBRyxDQUFDLEVBQ0csS0FBSyxNQUFRQSxFQUFPLE1BQVFELEVBQWtCLElBQUksTUFBTSxJQUcvREMsRUFBTyxNQUFNLEVBQ2JBLEVBQU8sVUFBVSxJQUdyQkQsRUFBa0IsSUFBSSxVQUFVLEdBQUssS0FBSyxVQUMxQyxLQUFLLE1BQU0sWUFBWSxvQkFBcUIsS0FBSyxRQUFRLENBRWpFLENBRUEsY0FBZSxDQUNYLE1BQU1DLEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsR0FBVUEsRUFBTyxPQUNqQkEsRUFBTyxNQUFNLEVBQ2JBLEVBQU8sVUFBVSxFQUV6QixDQUNBLHNCQUF1QixDQUNuQixNQUFNLHFCQUFxQixFQUszQixNQUFNQSxFQUFTLEtBQUssV0FBVyxjQUFjLFFBQVEsRUFDakRBLEdBQVVBLEVBQU8sT0FDakIsU0FBUyxLQUFLLFlBQVlBLENBQU0sRUFDaENBLEVBQU8sTUFBTSxFQUNiQSxFQUFPLE9BQU8sRUFFdEIsQ0FFQSxvQkFBb0IsRUFBRyxDQUVuQixFQUFFLGVBQWUsRUFDakIsS0FBSyxlQUFlLENBQ3hCLENBRUEscUJBQXFCLEVBQUcsQ0FJcEIsTUFBTUMsRUFEUyxLQUFLLFdBQVcsY0FBYyxRQUFRLEVBQ2pDLHNCQUFzQixFQUN0QkEsRUFBSyxLQUFPLEVBQUUsU0FBVyxFQUFFLFNBQVdBLEVBQUssSUFBTUEsRUFBSyxRQUNuRUEsRUFBSyxNQUFRLEVBQUUsU0FBVyxFQUFFLFNBQVdBLEVBQUssS0FBT0EsRUFBSyxPQUczRCxLQUFLLGVBQWUsQ0FFNUIsQ0FDQSxnQkFBaUIsQ0FDYixNQUFNQyxFQUFRLElBQUksWUFBWSx1QkFBd0IsQ0FBRSxRQUFTLEdBQU0sU0FBVSxHQUFNLFdBQVksRUFBSyxDQUFDLEVBRXpHLEdBREEsS0FBSyxjQUFjQSxDQUFLLEVBQ3BCQSxFQUFNLGlCQUFrQixPQUU1QixNQUFNRixFQUFTLEtBQUssV0FBVyxjQUFjLFFBQVEsRUFDakRBLEdBQVVBLEVBQU8sTUFDakJBLEVBQU8sTUFBTSxFQUtqQixXQUFXLElBQU0sQ0FDYixLQUFLLEtBQU8sR0FDWixLQUFLLGNBQWMsSUFBSSxZQUFZLHNCQUF1QixDQUFFLFFBQVMsR0FBTSxTQUFVLEVBQUssQ0FBQyxDQUFDLENBQ2hHLEVBQUcsRUFBRSxDQUNULENBRUEsUUFBUyxDQUNMLE9BQU9IO0FBQUE7QUFBQSwwQkFFVyxLQUFLLG1CQUFtQjtBQUFBLHlCQUN6QixLQUFLLG9CQUFvQjtBQUFBO0FBQUE7QUFBQSwwQkFHeEIsS0FBSyxTQUFTO0FBQUEsdURBQ2UsS0FBSyxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQVl0RSxDQUNKLENBQ0EsZUFBZSxPQUFPLGVBQWdCLFdBQVciLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJjaGFuZ2VkUHJvcGVydGllcyIsICJkaWFsb2ciLCAicmVjdCIsICJldmVudCJdCn0K
