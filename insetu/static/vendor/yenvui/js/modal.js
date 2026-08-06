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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aU1vZGFsIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIG1heFdpZHRoOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBmdWxsc2NyZWVuOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGNvbnRlbnRzOyB9IC8qIE5hdGl2ZSBkaWFsb2cgaGFuZGxlcyBpdHMgb3duIHZpc2liaWxpdHkuIEhvc3QgbXVzdCByZW1haW4gcGVybWVhYmxlLiAqL1xuICAgICAgICBkaWFsb2cge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LXdpZHRoOiB2YXIoLS1tb2RhbC1tYXgtd2lkdGgsIDYwMHB4KTtcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDg1ZHZoO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDMwcHggcmdiYSgwLDAsMCwwLjYpO1xuICAgICAgICAgICAgZGlzcGxheTogbm9uZTsgLyogSGlkZSB3aGVuIG5vdCBvcGVuICovXG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgbWFyZ2luOiBhdXRvOyAvKiBDZW50ZXJzIG5hdGl2ZWx5IGluIHRoZSAjdG9wLWxheWVyICovXG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG5cbiAgICAgICAgZGlhbG9nW29wZW5dIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7IC8qIEJ5cGFzcyBTYWZhcmkgZmxleCBjb2xsYXBzZSBidWcgKi9cbiAgICAgICAgICAgIGdyaWQtdGVtcGxhdGUtcm93czogYXV0byBtaW5tYXgoMCwgMWZyKSBhdXRvO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtmdWxsc2NyZWVuXSkgZGlhbG9nIHtcbiAgICAgICAgICAgIG1heC13aWR0aDogMTAwJTtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgbWF4LWhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIGhlaWdodDogY2FsYygxMDBkdmggLSAzMHB4KTtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDMwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC8qIE5hdGl2ZSBCYWNrZHJvcCBTdHlsaW5nIHJlcGxhY2luZyBtYW51YWwgRE9NIG92ZXJsYXlzICovXG4gICAgICAgIGRpYWxvZzo6YmFja2Ryb3Age1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tbW9kYWwtYmFja2Ryb3AsIHJnYmEoMCwgMCwgMCwgMC43NSkpO1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiB2YXIoLS1tb2RhbC1iYWNrZHJvcC1maWx0ZXIsIGJsdXIoM3B4KSk7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogNHB4IHNvbGlkIHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIGgzIHtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgICAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBtYXJnaW4tcmlnaHQ6IDE1cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmNsb3NlLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDZweCAxNHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBmaWx0ZXIgMC4ycywgYmFja2dyb3VuZCAwLjJzO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgIH1cblxuICAgICAgICAuY2xvc2UtYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygxLjIpO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNsb3NlLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmO1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMDAwMDAwO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMnB4IDJweCAwICMwMDAwMDA7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuY2xvc2UtYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyLCAjZjFmNWY5KTtcbiAgICAgICAgICAgIGZpbHRlcjogbm9uZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5ib2R5IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICAgICAgbWluLWhlaWdodDogMDsgLyogUHJldmVudHMgdmVydGljYWwgZ3JpZCBibG93b3V0ICovXG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7IC8qIFByZXZlbnRzIGhvcml6b250YWwgZ3JpZCBibG93b3V0ICovXG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIGdhcDogMTVweDtcbiAgICAgICAgICAgIC13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOiB0b3VjaDsgLyogTW9tZW50dW0gc2Nyb2xsaW5nIGZvciBpT1MgKi9cbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZmx1c2hdKSAuYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgZ2FwOiAwO1xuICAgICAgICB9XG4gICAgICAgIC5mb290ZXIge1xuICAgICAgICAgICAgcGFkZGluZzogMTJweCAyMHB4O1xuICAgICAgICAgICAgZ2FwOiAxMnB4O1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLyogU3RhbmRhcmRpemVzIHNsb3R0ZWQgZm9vdGVyIGJ1dHRvbnMgYXV0b21hdGljYWxseSAqL1xuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uW3Nsb3Q9XCJmb290ZXJcIl0pIHsgXG4gICAgICAgICAgICBmbGV4OiAxOyBcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggIWltcG9ydGFudDsgXG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDsgXG4gICAgICAgICAgICBmb250LXNpemU6IDEuMDVyZW0gIWltcG9ydGFudDsgXG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjsgXG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKHllbnZ1aS1hc3luYy1idG5bc2xvdD1cImZvb3RlclwiXSkge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgICAgICAgIC0tYnRuLXBhZGRpbmc6IDEycHg7XG4gICAgICAgICAgICAtLWJ0bi1mb250LXNpemU6IDEuMDVyZW07XG4gICAgICAgICAgICAtLWJ0bi1ib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMub3BlbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLnRpdGxlVGV4dCA9ICcnO1xuICAgICAgICB0aGlzLm1heFdpZHRoID0gJyc7XG4gICAgICAgIHRoaXMuZnVsbHNjcmVlbiA9IGZhbHNlO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkaWFsb2cnKTtcbiAgICAgICAgaWYgKGRpYWxvZykge1xuICAgICAgICAgICAgaWYgKHRoaXMub3BlbiAmJiAhZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgICAgICBpZiAod2luZG93LmdldENvbXB1dGVkU3R5bGUodGhpcykuZGlzcGxheSA9PT0gJ25vbmUnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3llblZVSV0gXHUyNkEwXHVGRTBGIENhbm5vdCBleGVjdXRlIHNob3dNb2RhbCgpIG9uIDx5ZW52dWktbW9kYWw+IGJlY2F1c2UgYW4gYW5jZXN0b3IgaXMgc2V0dGluZyAnZGlzcGxheTogbm9uZScuIFRoaXMgd2lsbCBjYXVzZSBhIFVJIGZyZWV6ZS4gVGFyZ2V0IHRpdGxlOiBcIiR7dGhpcy50aXRsZVRleHR9XCJgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGlhbG9nLnNob3dNb2RhbCgpOyAvLyBJbXBlcmF0aXZlIEFQSSBwdXNoIHRvICN0b3AtbGF5ZXJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXRoaXMub3BlbiAmJiBkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgICAgIC8vIEVTQ0FQRSBUSEUgUkVOREVSIENZQ0xFOiBJZiB0aGUgaG9zdCBhcHAgc2V0cyBvcGVuPWZhbHNlLCB1cGRhdGVkKCkgcnVucy5cbiAgICAgICAgICAgICAgICAvLyBDYWxsaW5nIGRpYWxvZy5jbG9zZSgpIHN5bmNocm9ub3VzbHkgaW5zaWRlIExpdCdzIHJlbmRlciBwaXBlbGluZSB0cmlnZ2VycyBcbiAgICAgICAgICAgICAgICAvLyB0aGUgQ2hyb21pdW0gaW5lcnQgYnVnLiBZaWVsZCB0byB0aGUgbWFjcm8tdGFzayBxdWV1ZS5cbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRpYWxvZy5vcGVuKSBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdtYXhXaWR0aCcpICYmIHRoaXMubWF4V2lkdGgpIHtcbiAgICAgICAgICAgIHRoaXMuc3R5bGUuc2V0UHJvcGVydHkoJy0tbW9kYWwtbWF4LXdpZHRoJywgdGhpcy5tYXhXaWR0aCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIC8vIFVOSVZFUlNBTCBGQUlMU0FGRTogSWYgYSBob3N0IGZyYW1ld29yayAobGlrZSBMaXQpIGNvbmRpdGlvbmFsbHkgZGVzdHJveXMgXG4gICAgICAgIC8vIHRoZSBtb2RhbCBmcm9tIHRoZSBET00gd2hpbGUgaXQgaXMgb3BlbiwgdGhlIGJyb3dzZXIgd2lsbCBsZWF2ZSB0aGUgcmVzdCBvZiBcbiAgICAgICAgLy8gdGhlIGRvY3VtZW50IHBlcm1hbmVudGx5ICdpbmVydCcgKHVuY2xpY2thYmxlKS4gXG4gICAgICAgIC8vIFdlIG11c3QgdGVtcG9yYXJpbHkgcmUtYXR0YWNoIHRoZSBkaWFsb2cgdG8gdGhlIGFjdGl2ZSBET00gdG8gY2xvc2UgaXQgY2xlYW5seS5cbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBpZiAoZGlhbG9nICYmIGRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgIGRpYWxvZy5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVOYXRpdmVDYW5jZWwoZSkge1xuICAgICAgICAvLyBTdG9wIHRoZSBicm93c2VyIGZyb20gaW1wbGljaXRseSBjbG9zaW5nIHRoZSBkaWFsb2cgYW5kIGRlc3luY2hyb25pemluZyBVREYgc3RhdGVcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBcbiAgICAgICAgdGhpcy5fZGlzcGF0Y2hDbG9zZSgpO1xuICAgIH1cblxuICAgIF9oYW5kbGVCYWNrZHJvcENsaWNrKGUpIHtcbiAgICAgICAgLy8gTmF0aXZlIDxkaWFsb2c+IHNwYW5zIHRoZSBzY3JlZW4sIGJ1dCBpdHMgYm91bmRpbmcgYm94IGlzIGp1c3QgdGhlIGNvbnRlbnQgcGFuZWwuXG4gICAgICAgIC8vIElmIHRoZSBjbGljayBmYWxscyBvdXRzaWRlIHRoZSBib3VuZGluZyBib3gsIGl0IGhpdCB0aGUgOjpiYWNrZHJvcC5cbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBjb25zdCByZWN0ID0gZGlhbG9nLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBjb25zdCBpc0luRGlhbG9nID0gKHJlY3QudG9wIDw9IGUuY2xpZW50WSAmJiBlLmNsaWVudFkgPD0gcmVjdC50b3AgKyByZWN0LmhlaWdodFxuICAgICAgICAgICAgJiYgcmVjdC5sZWZ0IDw9IGUuY2xpZW50WCAmJiBlLmNsaWVudFggPD0gcmVjdC5sZWZ0ICsgcmVjdC53aWR0aCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWlzSW5EaWFsb2cpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rpc3BhdGNoQ2xvc2UoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfZGlzcGF0Y2hDbG9zZSgpIHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1tb2RhbC1jbG9zaW5nJywgeyBidWJibGVzOiB0cnVlLCBjb21wb3NlZDogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSB9KTtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICAgICAgaWYgKGV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGlmIChkaWFsb2cgJiYgZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gWUlFTEQgVE8gQlJPV1NFUiBFTkdJTkU6IEVuc3VyZSB0aGUgYnJvd3NlciBuYXRpdmVseSBzdHJpcHMgdGhlICdpbmVydCcgXG4gICAgICAgIC8vIGF0dHJpYnV0ZSBmcm9tIHRoZSBkb2N1bWVudCBib2R5IEJFRk9SRSBhbGVydGluZyBMaXQgdG8gbXV0YXRlIHRoZSBET00uXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktbW9kYWwtY2xvc2VkJywgeyBidWJibGVzOiB0cnVlLCBjb21wb3NlZDogdHJ1ZSB9KSk7XG4gICAgICAgIH0sIDEwKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpYWxvZyBcbiAgICAgICAgICAgICAgICBAY2FuY2VsPSR7dGhpcy5faGFuZGxlTmF0aXZlQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUJhY2tkcm9wQ2xpY2t9PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGgzPiR7dGhpcy50aXRsZVRleHR9PC9oMz5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNsb3NlLWJ0blwiIEBjbGljaz0ke3RoaXMuX2Rpc3BhdGNoQ2xvc2V9PkJhY2s8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYm9keVwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb290ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImZvb3RlclwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIDwvZGlhbG9nPlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLW1vZGFsJywgWWVudnVpTW9kYWwpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSxvQkFBb0JGLENBQVcsQ0FDeEMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsS0FBTSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDckMsU0FBVSxDQUFFLEtBQU0sTUFBTyxFQUN6QixXQUFZLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMzQyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BMkloQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssS0FBTyxHQUNaLEtBQUssVUFBWSxHQUNqQixLQUFLLFNBQVcsR0FDaEIsS0FBSyxXQUFhLEVBQ3RCLENBQ0EsUUFBUUMsRUFBbUIsQ0FDdkIsTUFBTUMsRUFBUyxLQUFLLFdBQVcsY0FBYyxRQUFRLEVBQ2pEQSxJQUNJLEtBQUssTUFBUSxDQUFDQSxFQUFPLE1BQ2pCLE9BQU8saUJBQWlCLElBQUksRUFBRSxVQUFZLFFBQzFDLFFBQVEsS0FBSyxrS0FBd0osS0FBSyxTQUFTLEdBQUcsRUFFMUxBLEVBQU8sVUFBVSxHQUNWLENBQUMsS0FBSyxNQUFRQSxFQUFPLE1BSTVCLFdBQVcsSUFBTSxDQUNUQSxFQUFPLE1BQU1BLEVBQU8sTUFBTSxDQUNsQyxFQUFHLENBQUMsR0FHUkQsRUFBa0IsSUFBSSxVQUFVLEdBQUssS0FBSyxVQUMxQyxLQUFLLE1BQU0sWUFBWSxvQkFBcUIsS0FBSyxRQUFRLENBRWpFLENBQ0Esc0JBQXVCLENBQ25CLE1BQU0scUJBQXFCLEVBSzNCLE1BQU1DLEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsR0FBVUEsRUFBTyxPQUNqQixTQUFTLEtBQUssWUFBWUEsQ0FBTSxFQUNoQ0EsRUFBTyxNQUFNLEVBQ2JBLEVBQU8sT0FBTyxFQUV0QixDQUVBLG9CQUFvQixFQUFHLENBRW5CLEVBQUUsZUFBZSxFQUNqQixLQUFLLGVBQWUsQ0FDeEIsQ0FFQSxxQkFBcUIsRUFBRyxDQUlwQixNQUFNQyxFQURTLEtBQUssV0FBVyxjQUFjLFFBQVEsRUFDakMsc0JBQXNCLEVBQ3RCQSxFQUFLLEtBQU8sRUFBRSxTQUFXLEVBQUUsU0FBV0EsRUFBSyxJQUFNQSxFQUFLLFFBQ25FQSxFQUFLLE1BQVEsRUFBRSxTQUFXLEVBQUUsU0FBV0EsRUFBSyxLQUFPQSxFQUFLLE9BRzNELEtBQUssZUFBZSxDQUU1QixDQUNBLGdCQUFpQixDQUNiLE1BQU1DLEVBQVEsSUFBSSxZQUFZLHVCQUF3QixDQUFFLFFBQVMsR0FBTSxTQUFVLEdBQU0sV0FBWSxFQUFLLENBQUMsRUFFekcsR0FEQSxLQUFLLGNBQWNBLENBQUssRUFDcEJBLEVBQU0saUJBQWtCLE9BRTVCLE1BQU1GLEVBQVMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqREEsR0FBVUEsRUFBTyxNQUNqQkEsRUFBTyxNQUFNLEVBS2pCLFdBQVcsSUFBTSxDQUNiLEtBQUssS0FBTyxHQUNaLEtBQUssY0FBYyxJQUFJLFlBQVksc0JBQXVCLENBQUUsUUFBUyxHQUFNLFNBQVUsRUFBSyxDQUFDLENBQUMsQ0FDaEcsRUFBRyxFQUFFLENBQ1QsQ0FFQSxRQUFTLENBQ0wsT0FBT0g7QUFBQTtBQUFBLDBCQUVXLEtBQUssbUJBQW1CO0FBQUEseUJBQ3pCLEtBQUssb0JBQW9CO0FBQUE7QUFBQTtBQUFBLDBCQUd4QixLQUFLLFNBQVM7QUFBQSx1REFDZSxLQUFLLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBWXRFLENBQ0osQ0FDQSxlQUFlLE9BQU8sZUFBZ0IsV0FBVyIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIiwgImNoYW5nZWRQcm9wZXJ0aWVzIiwgImRpYWxvZyIsICJyZWN0IiwgImV2ZW50Il0KfQo=
