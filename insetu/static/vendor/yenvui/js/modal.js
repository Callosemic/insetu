import{LitElement as i,html as a,css as n}from"lit";export class YenvuiModal extends i{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},maxWidth:{type:String},fullscreen:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0},transparent:{type:Boolean,reflect:!0},_hasFooter:{type:Boolean,state:!0}};static styles=n`
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
    `;constructor(){super(),this.open=!1,this.titleText="",this.maxWidth="",this.fullscreen=!1,this._hasFooter=!1}_handleFooterSlotChange(e){this._hasFooter=e.target.assignedElements({flatten:!0}).length>0}updated(e){const t=this.shadowRoot.querySelector("dialog");t&&(this.open&&!t.open?(window.getComputedStyle(this).display==="none"&&console.warn(`[yenVUI] \u26A0\uFE0F Cannot execute showModal() on <yenvui-modal> because an ancestor is setting 'display: none'. This will cause a UI freeze. Target title: "${this.titleText}"`),t.showModal()):!this.open&&t.open?setTimeout(()=>{t.open&&t.close()},0):this.open&&t.open&&e.has("open")&&(t.close(),t.showModal())),e.has("maxWidth")&&this.maxWidth&&this.style.setProperty("--modal-max-width",this.maxWidth)}bringToFront(){const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(e.close(),e.showModal())}disconnectedCallback(){super.disconnectedCallback();const e=this.shadowRoot.querySelector("dialog");e&&e.open&&(document.body.appendChild(e),e.close(),e.remove())}_handleNativeCancel(e){e.preventDefault(),this._dispatchClose()}_handleBackdropClick(e){const o=this.shadowRoot.querySelector("dialog").getBoundingClientRect();o.top<=e.clientY&&e.clientY<=o.top+o.height&&o.left<=e.clientX&&e.clientX<=o.left+o.width||this._dispatchClose()}_dispatchClose(){const e=new CustomEvent("yenvui-modal-closing",{bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(e),e.defaultPrevented)return;const t=this.shadowRoot.querySelector("dialog");t&&t.open&&t.close(),setTimeout(()=>{this.open=!1,this.dispatchEvent(new CustomEvent("yenvui-modal-closed",{bubbles:!0,composed:!0}))},10)}render(){return a`
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
                <div class="footer" style="display: ${this._hasFooter?"flex":"none"};">
                    <slot name="footer" @slotchange=${this._handleFooterSlotChange}></slot>
                </div>

            </dialog>
        `}}customElements.define("yenvui-modal",YenvuiModal);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlNb2RhbCBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0aXRsZVRleHQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIG9wZW46IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBtYXhXaWR0aDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZnVsbHNjcmVlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGZsdXNoOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfSxcbiAgICAgICAgdHJhbnNwYXJlbnQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBfaGFzRm9vdGVyOiB7IHR5cGU6IEJvb2xlYW4sIHN0YXRlOiB0cnVlIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgZGlzcGxheTogY29udGVudHM7IH0gLyogTmF0aXZlIGRpYWxvZyBoYW5kbGVzIGl0cyBvd24gdmlzaWJpbGl0eS4gSG9zdCBtdXN0IHJlbWFpbiBwZXJtZWFibGUuICovXG4gICAgICAgIGRpYWxvZyB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1wYW5lLWJnLCAjMWUxZTFlKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IHZhcigtLW1vZGFsLW1heC13aWR0aCwgNjAwcHgpO1xuICAgICAgICAgICAgbWF4LWhlaWdodDogODVkdmg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNik7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lOyAvKiBIaWRlIHdoZW4gbm90IG9wZW4gKi9cbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBtYXJnaW46IGF1dG87IC8qIENlbnRlcnMgbmF0aXZlbHkgaW4gdGhlICN0b3AtbGF5ZXIgKi9cbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cblxuICAgICAgICBkaWFsb2dbb3Blbl0ge1xuICAgICAgICAgICAgZGlzcGxheTogZ3JpZDsgLyogQnlwYXNzIFNhZmFyaSBmbGV4IGNvbGxhcHNlIGJ1ZyAqL1xuICAgICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1yb3dzOiBhdXRvIG1pbm1heCgwLCAxZnIpIGF1dG87XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2Z1bGxzY3JlZW5dKSBkaWFsb2cge1xuICAgICAgICAgICAgbWF4LXdpZHRoOiAxMDAlO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBtYXgtaGVpZ2h0OiBjYWxjKDEwMGR2aCAtIDMwcHgpO1xuICAgICAgICAgICAgaGVpZ2h0OiBjYWxjKDEwMGR2aCAtIDMwcHgpO1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMzBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDA7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgLyogTmF0aXZlIEJhY2tkcm9wIFN0eWxpbmcgcmVwbGFjaW5nIG1hbnVhbCBET00gb3ZlcmxheXMgKi9cbiAgICAgICAgZGlhbG9nOjpiYWNrZHJvcCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tb2RhbC1iYWNrZHJvcCwgcmdiYSgwLCAwLCAwLCAwLjc1KSk7XG4gICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IHZhcigtLW1vZGFsLWJhY2tkcm9wLWZpbHRlciwgYmx1cigzcHgpKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbdHJhbnNwYXJlbnRdKSBkaWFsb2c6OmJhY2tkcm9wLFxuICAgICAgICA6aG9zdChbZnVsbHNjcmVlbl0pIGRpYWxvZzo6YmFja2Ryb3Age1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLmhlYWRlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDIwcHg7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IDRweCBzb2xpZCB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNik7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgbWluLXdpZHRoOiAwO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG5cbiAgICAgICAgLmhlYWRlciBoMyB7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgbWFyZ2luLXJpZ2h0OiAxNXB4O1xuICAgICAgICB9XG4gICAgICAgIC5jbG9zZS1idG4ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW50ZW50LW5ldXRyYWwsICM2NDc0OGIpO1xuICAgICAgICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTRweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnMsIGJhY2tncm91bmQgMC4ycztcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLmNsb3NlLWJ0bjpob3ZlciB7XG4gICAgICAgICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMS4yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5jbG9zZS1idG4ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZjtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwMDAwO1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDJweCAycHggMCAjMDAwMDAwO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNsb3NlLWJ0bjpob3ZlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1ob3ZlciwgI2YxZjVmOSk7XG4gICAgICAgICAgICBmaWx0ZXI6IG5vbmU7XG4gICAgICAgIH1cblxuICAgICAgICAuYm9keSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgICAgIG1pbi1oZWlnaHQ6IDA7IC8qIFByZXZlbnRzIHZlcnRpY2FsIGdyaWQgYmxvd291dCAqL1xuICAgICAgICAgICAgbWluLXdpZHRoOiAwOyAvKiBQcmV2ZW50cyBob3Jpem9udGFsIGdyaWQgYmxvd291dCAqL1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBnYXA6IDE1cHg7XG4gICAgICAgICAgICAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2g7IC8qIE1vbWVudHVtIHNjcm9sbGluZyBmb3IgaU9TICovXG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICAgIGdhcDogMDtcbiAgICAgICAgfVxuICAgICAgICAuZm9vdGVyIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMjBweDtcbiAgICAgICAgICAgIGdhcDogMTJweDtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG4gICAgICAgIC8qIFN0YW5kYXJkaXplcyBzbG90dGVkIGZvb3RlciBidXR0b25zIGF1dG9tYXRpY2FsbHkgKi9cbiAgICAgICAgOjpzbG90dGVkKGJ1dHRvbltzbG90PVwiZm9vdGVyXCJdKSB7IFxuICAgICAgICAgICAgZmxleDogMTsgXG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDsgXG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4ICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgZm9udC1zaXplOiAxLjA1cmVtICFpbXBvcnRhbnQ7IFxuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQgIWltcG9ydGFudDsgXG4gICAgICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsgXG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7IFxuICAgICAgICB9XG4gICAgICAgIDo6c2xvdHRlZCh5ZW52dWktYXN5bmMtYnRuW3Nsb3Q9XCJmb290ZXJcIl0pIHtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICAgICAgICAtLWJ0bi1wYWRkaW5nOiAxMnB4O1xuICAgICAgICAgICAgLS1idG4tZm9udC1zaXplOiAxLjA1cmVtO1xuICAgICAgICAgICAgLS1idG4tYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGl0bGVUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMubWF4V2lkdGggPSAnJztcbiAgICAgICAgdGhpcy5mdWxsc2NyZWVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2hhc0Zvb3RlciA9IGZhbHNlO1xuICAgIH1cblxuICAgIF9oYW5kbGVGb290ZXJTbG90Q2hhbmdlKGUpIHtcbiAgICAgICAgdGhpcy5faGFzRm9vdGVyID0gZS50YXJnZXQuYXNzaWduZWRFbGVtZW50cyh7IGZsYXR0ZW46IHRydWUgfSkubGVuZ3RoID4gMDtcbiAgICB9XG4gICAgdXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcykge1xuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGlmIChkaWFsb2cpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wZW4gJiYgIWRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMpLmRpc3BsYXkgPT09ICdub25lJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFt5ZW5WVUldIFx1MjZBMFx1RkUwRiBDYW5ub3QgZXhlY3V0ZSBzaG93TW9kYWwoKSBvbiA8eWVudnVpLW1vZGFsPiBiZWNhdXNlIGFuIGFuY2VzdG9yIGlzIHNldHRpbmcgJ2Rpc3BsYXk6IG5vbmUnLiBUaGlzIHdpbGwgY2F1c2UgYSBVSSBmcmVlemUuIFRhcmdldCB0aXRsZTogXCIke3RoaXMudGl0bGVUZXh0fVwiYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TW9kYWwoKTsgLy8gSW1wZXJhdGl2ZSBBUEkgcHVzaCB0byAjdG9wLWxheWVyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLm9wZW4gJiYgZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgICAgICAvLyBFU0NBUEUgVEhFIFJFTkRFUiBDWUNMRTogSWYgdGhlIGhvc3QgYXBwIHNldHMgb3Blbj1mYWxzZSwgdXBkYXRlZCgpIHJ1bnMuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbGluZyBkaWFsb2cuY2xvc2UoKSBzeW5jaHJvbm91c2x5IGluc2lkZSBMaXQncyByZW5kZXIgcGlwZWxpbmUgdHJpZ2dlcnMgXG4gICAgICAgICAgICAgICAgLy8gdGhlIENocm9taXVtIGluZXJ0IGJ1Zy4gWWllbGQgdG8gdGhlIG1hY3JvLXRhc2sgcXVldWUuXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkaWFsb2cub3BlbikgZGlhbG9nLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub3BlbiAmJiBkaWFsb2cub3BlbiAmJiBjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ29wZW4nKSkge1xuICAgICAgICAgICAgICAgIC8vIFNlbGYtaGVhbGluZyB0b3AtbGF5ZXIgc3RhY2sgYm91bmNlOiBpZiB0aGUgaG9zdCByZS1ldmFsdWF0ZXMgdGhlIG9wZW4gcHJvcGVydHkgdG8gdHJ1ZVxuICAgICAgICAgICAgICAgIC8vIHdoaWxlIHRoZSBtb2RhbCBpcyBhbHJlYWR5IG9wZW4sIGl0IGd1YXJhbnRlZXMgdGhpcyBtb2RhbCBqdW1wcyB0byB0aGUgZnJvbnQuXG4gICAgICAgICAgICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgZGlhbG9nLnNob3dNb2RhbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ21heFdpZHRoJykgJiYgdGhpcy5tYXhXaWR0aCkge1xuICAgICAgICAgICAgdGhpcy5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1tb2RhbC1tYXgtd2lkdGgnLCB0aGlzLm1heFdpZHRoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJyaW5nVG9Gcm9udCgpIHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICBpZiAoZGlhbG9nICYmIGRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgIGRpYWxvZy5zaG93TW9kYWwoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuZGlzY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgLy8gVU5JVkVSU0FMIEZBSUxTQUZFOiBJZiBhIGhvc3QgZnJhbWV3b3JrIChsaWtlIExpdCkgY29uZGl0aW9uYWxseSBkZXN0cm95cyBcbiAgICAgICAgLy8gdGhlIG1vZGFsIGZyb20gdGhlIERPTSB3aGlsZSBpdCBpcyBvcGVuLCB0aGUgYnJvd3NlciB3aWxsIGxlYXZlIHRoZSByZXN0IG9mIFxuICAgICAgICAvLyB0aGUgZG9jdW1lbnQgcGVybWFuZW50bHkgJ2luZXJ0JyAodW5jbGlja2FibGUpLiBcbiAgICAgICAgLy8gV2UgbXVzdCB0ZW1wb3JhcmlseSByZS1hdHRhY2ggdGhlIGRpYWxvZyB0byB0aGUgYWN0aXZlIERPTSB0byBjbG9zZSBpdCBjbGVhbmx5LlxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGlmIChkaWFsb2cgJiYgZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgICAgICAgZGlhbG9nLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZU5hdGl2ZUNhbmNlbChlKSB7XG4gICAgICAgIC8vIFN0b3AgdGhlIGJyb3dzZXIgZnJvbSBpbXBsaWNpdGx5IGNsb3NpbmcgdGhlIGRpYWxvZyBhbmQgZGVzeW5jaHJvbml6aW5nIFVERiBzdGF0ZVxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICB0aGlzLl9kaXNwYXRjaENsb3NlKCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUJhY2tkcm9wQ2xpY2soZSkge1xuICAgICAgICAvLyBOYXRpdmUgPGRpYWxvZz4gc3BhbnMgdGhlIHNjcmVlbiwgYnV0IGl0cyBib3VuZGluZyBib3ggaXMganVzdCB0aGUgY29udGVudCBwYW5lbC5cbiAgICAgICAgLy8gSWYgdGhlIGNsaWNrIGZhbGxzIG91dHNpZGUgdGhlIGJvdW5kaW5nIGJveCwgaXQgaGl0IHRoZSA6OmJhY2tkcm9wLlxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSBkaWFsb2cuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGNvbnN0IGlzSW5EaWFsb2cgPSAocmVjdC50b3AgPD0gZS5jbGllbnRZICYmIGUuY2xpZW50WSA8PSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0XG4gICAgICAgICAgICAmJiByZWN0LmxlZnQgPD0gZS5jbGllbnRYICYmIGUuY2xpZW50WCA8PSByZWN0LmxlZnQgKyByZWN0LndpZHRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaXNJbkRpYWxvZykge1xuICAgICAgICAgICAgdGhpcy5fZGlzcGF0Y2hDbG9zZSgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9kaXNwYXRjaENsb3NlKCkge1xuICAgICAgICBjb25zdCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgneWVudnVpLW1vZGFsLWNsb3NpbmcnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgICAgICBpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkaWFsb2cnKTtcbiAgICAgICAgaWYgKGRpYWxvZyAmJiBkaWFsb2cub3Blbikge1xuICAgICAgICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBZSUVMRCBUTyBCUk9XU0VSIEVOR0lORTogRW5zdXJlIHRoZSBicm93c2VyIG5hdGl2ZWx5IHN0cmlwcyB0aGUgJ2luZXJ0JyBcbiAgICAgICAgLy8gYXR0cmlidXRlIGZyb20gdGhlIGRvY3VtZW50IGJvZHkgQkVGT1JFIGFsZXJ0aW5nIExpdCB0byBtdXRhdGUgdGhlIERPTS5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1tb2RhbC1jbG9zZWQnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlIH0pKTtcbiAgICAgICAgfSwgMTApO1xuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGlhbG9nIFxuICAgICAgICAgICAgICAgIEBjYW5jZWw9JHt0aGlzLl9oYW5kbGVOYXRpdmVDYW5jZWx9XG4gICAgICAgICAgICAgICAgQGNsaWNrPSR7dGhpcy5faGFuZGxlQmFja2Ryb3BDbGlja30+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8aDM+JHt0aGlzLnRpdGxlVGV4dH08L2gzPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCIgQGNsaWNrPSR7dGhpcy5fZGlzcGF0Y2hDbG9zZX0+QmFjazwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJib2R5XCI+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvb3RlclwiIHN0eWxlPVwiZGlzcGxheTogJHt0aGlzLl9oYXNGb290ZXIgPyAnZmxleCcgOiAnbm9uZSd9O1wiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiZm9vdGVyXCIgQHNsb3RjaGFuZ2U9JHt0aGlzLl9oYW5kbGVGb290ZXJTbG90Q2hhbmdlfT48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDwvZGlhbG9nPlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLW1vZGFsJywgWWVudnVpTW9kYWwpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFDL0IsYUFBTSxvQkFBb0JGLENBQVcsQ0FDeEMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsS0FBTSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDckMsU0FBVSxDQUFFLEtBQU0sTUFBTyxFQUN6QixXQUFZLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUMzQyxNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUN0QyxZQUFhLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxFQUM1QyxXQUFZLENBQUUsS0FBTSxRQUFTLE1BQU8sRUFBSyxDQUM3QyxFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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aUIsQ0FDYixNQUFNQyxFQUFRLElBQUksWUFBWSx1QkFBd0IsQ0FBRSxRQUFTLEdBQU0sU0FBVSxHQUFNLFdBQVksRUFBSyxDQUFDLEVBRXpHLEdBREEsS0FBSyxjQUFjQSxDQUFLLEVBQ3BCQSxFQUFNLGlCQUFrQixPQUU1QixNQUFNRixFQUFTLEtBQUssV0FBVyxjQUFjLFFBQVEsRUFDakRBLEdBQVVBLEVBQU8sTUFDakJBLEVBQU8sTUFBTSxFQUtqQixXQUFXLElBQU0sQ0FDYixLQUFLLEtBQU8sR0FDWixLQUFLLGNBQWMsSUFBSSxZQUFZLHNCQUF1QixDQUFFLFFBQVMsR0FBTSxTQUFVLEVBQUssQ0FBQyxDQUFDLENBQ2hHLEVBQUcsRUFBRSxDQUNULENBRUEsUUFBUyxDQUNMLE9BQU9IO0FBQUE7QUFBQSwwQkFFVyxLQUFLLG1CQUFtQjtBQUFBLHlCQUN6QixLQUFLLG9CQUFvQjtBQUFBO0FBQUE7QUFBQSwwQkFHeEIsS0FBSyxTQUFTO0FBQUEsdURBQ2UsS0FBSyxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNEQU1wQixLQUFLLFdBQWEsT0FBUyxNQUFNO0FBQUEsc0RBQ2pDLEtBQUssdUJBQXVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FLOUUsQ0FDSixDQUNBLGVBQWUsT0FBTyxlQUFnQixXQUFXIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAiZGlhbG9nIiwgInJlY3QiLCAiZXZlbnQiXQp9Cg==
