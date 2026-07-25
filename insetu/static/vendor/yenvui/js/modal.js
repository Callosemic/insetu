import{LitElement as i,html as n,css as a}from"lit";export class YenvuiModal extends i{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},maxWidth:{type:String},fullscreen:{type:Boolean,reflect:!0}};static styles=a`
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
            flex-direction: column;
            overflow: hidden;
            margin: auto; /* Centers natively in the #top-layer */
        }

        dialog[open] {
            display: flex; /* Only flex when open */
        }
        :host([fullscreen]) dialog {
            max-width: 100vw;
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
        }

        .header h3 {
            margin: 0;
            font-size: 1.2rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
        }
        
        .close-btn:hover {
            filter: brightness(1.2);
        }
        .body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 15px;
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
    `;constructor(){super(),this.open=!1,this.titleText="",this.maxWidth="",this.fullscreen=!1}updated(e){if(e.has("open")){const t=this.shadowRoot.querySelector("dialog");if(!t)return;this.open&&!t.open?(window.getComputedStyle(this).display==="none"&&console.warn(`[yenVUI] \u26A0\uFE0F Cannot execute showModal() on <yenvui-modal> because an ancestor is setting 'display: none'. This will cause a UI freeze. Target title: "${this.titleText}"`),t.showModal()):!this.open&&t.open&&t.close()}e.has("maxWidth")&&this.maxWidth&&this.style.setProperty("--modal-max-width",this.maxWidth)}_handleNativeCancel(e){e.preventDefault(),this._dispatchClose()}_handleBackdropClick(e){const o=this.shadowRoot.querySelector("dialog").getBoundingClientRect();o.top<=e.clientY&&e.clientY<=o.top+o.height&&o.left<=e.clientX&&e.clientX<=o.left+o.width||this._dispatchClose()}_dispatchClose(){const e=new CustomEvent("yenvui-modal-closing",{bubbles:!0,composed:!0,cancelable:!0});this.dispatchEvent(e),!e.defaultPrevented&&this.dispatchEvent(new CustomEvent("yenvui-modal-closed",{bubbles:!0,composed:!0}))}render(){return n`
            <dialog 
                @cancel=${this._handleNativeCancel}
                @click=${this._handleBackdropClick}>
                
                <div class="header">
                    <h3>${this.titleText}</h3>
                    <button class="close-btn" @click=${this._dispatchClose}>Back</button>
                </div>
                <div class="body">
                    <slot name="body"></slot>
                </div>
                <div class="footer">
                    <slot name="footer"></slot>
                </div>
                
            </dialog>
        `}}customElements.define("yenvui-modal",YenvuiModal);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aU1vZGFsIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIG1heFdpZHRoOiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBmdWxsc2NyZWVuOiB7IHR5cGU6IEJvb2xlYW4sIHJlZmxlY3Q6IHRydWUgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBjb250ZW50czsgfSAvKiBOYXRpdmUgZGlhbG9nIGhhbmRsZXMgaXRzIG93biB2aXNpYmlsaXR5LiBIb3N0IG11c3QgcmVtYWluIHBlcm1lYWJsZS4gKi9cbiAgICAgICAgZGlhbG9nIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXBhbmUtYmcsICMxZTFlMWUpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIG1heC13aWR0aDogdmFyKC0tbW9kYWwtbWF4LXdpZHRoLCA2MDBweCk7XG4gICAgICAgICAgICBtYXgtaGVpZ2h0OiA4NWR2aDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoMCwwLDAsMC42KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7IC8qIEhpZGUgd2hlbiBub3Qgb3BlbiAqL1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICBtYXJnaW46IGF1dG87IC8qIENlbnRlcnMgbmF0aXZlbHkgaW4gdGhlICN0b3AtbGF5ZXIgKi9cbiAgICAgICAgfVxuXG4gICAgICAgIGRpYWxvZ1tvcGVuXSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4OyAvKiBPbmx5IGZsZXggd2hlbiBvcGVuICovXG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2Z1bGxzY3JlZW5dKSBkaWFsb2cge1xuICAgICAgICAgICAgbWF4LXdpZHRoOiAxMDB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IGNhbGMoMTAwZHZoIC0gMzBweCk7XG4gICAgICAgICAgICBoZWlnaHQ6IGNhbGMoMTAwZHZoIC0gMzBweCk7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAzMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIE5hdGl2ZSBCYWNrZHJvcCBTdHlsaW5nIHJlcGxhY2luZyBtYW51YWwgRE9NIG92ZXJsYXlzICovXG4gICAgICAgIGRpYWxvZzo6YmFja2Ryb3Age1xuICAgICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjc1KTtcbiAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cigzcHgpO1xuICAgICAgICAgICAgLyogR2xvYmFsbHkgcHJldmVudCB0aGUgT1Mgc3RhdHVzIGJhciBmcm9tIGJlaW5nIGRhcmtlbmVkIGJ5IHRoZSBtb2RhbCBvdmVybGF5ICovXG4gICAgICAgICAgICBjbGlwLXBhdGg6IHBvbHlnb24oMCAwLCAxMDAlIDAsIDEwMCUgY2FsYygxMDAlIC0gMzBweCksIDAgY2FsYygxMDAlIC0gMzBweCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLmhlYWRlciB7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDIwcHg7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IDRweCBzb2xpZCB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNik7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLmhlYWRlciBoMyB7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgIH1cbiAgICAgICAgLmNsb3NlLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnRlbnQtbmV1dHJhbCwgIzY0NzQ4Yik7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2ZmZmZmZik7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTRweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogZmlsdGVyIDAuMnM7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC5jbG9zZS1idG46aG92ZXIge1xuICAgICAgICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDEuMik7XG4gICAgICAgIH1cbiAgICAgICAgLmJvZHkge1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgbWluLWhlaWdodDogMDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgZ2FwOiAxNXB4O1xuICAgICAgICB9XG4gICAgICAgIC5mb290ZXIge1xuICAgICAgICAgICAgcGFkZGluZzogMTJweCAyMHB4O1xuICAgICAgICAgICAgZ2FwOiAxMnB4O1xuICAgICAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLyogU3RhbmRhcmRpemVzIHNsb3R0ZWQgZm9vdGVyIGJ1dHRvbnMgYXV0b21hdGljYWxseSAqL1xuICAgICAgICA6OnNsb3R0ZWQoYnV0dG9uW3Nsb3Q9XCJmb290ZXJcIl0pIHsgXG4gICAgICAgICAgICBmbGV4OiAxOyBcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggIWltcG9ydGFudDsgXG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDsgXG4gICAgICAgICAgICBmb250LXNpemU6IDEuMDVyZW0gIWltcG9ydGFudDsgXG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZCAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50OyBcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjsgXG4gICAgICAgIH1cbiAgICAgICAgOjpzbG90dGVkKHllbnZ1aS1hc3luYy1idG5bc2xvdD1cImZvb3RlclwiXSkge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgICAgICAgIC0tYnRuLXBhZGRpbmc6IDEycHg7XG4gICAgICAgICAgICAtLWJ0bi1mb250LXNpemU6IDEuMDVyZW07XG4gICAgICAgICAgICAtLWJ0bi1ib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMub3BlbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLnRpdGxlVGV4dCA9ICcnO1xuICAgICAgICB0aGlzLm1heFdpZHRoID0gJyc7XG4gICAgICAgIHRoaXMuZnVsbHNjcmVlbiA9IGZhbHNlO1xuICAgIH1cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ29wZW4nKSkge1xuICAgICAgICAgICAgY29uc3QgZGlhbG9nID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZycpO1xuICAgICAgICAgICAgaWYgKCFkaWFsb2cpIHJldHVybjtcblxuICAgICAgICAgICAgaWYgKHRoaXMub3BlbiAmJiAhZGlhbG9nLm9wZW4pIHtcbiAgICAgICAgICAgICAgICAvLyBHdWFyZHJhaWw6IERldGVjdCBpZiBhbiBleHRlcm5hbCBhcHBsaWNhdGlvbiBzaGVsbCBoYXMgdHJhcHBlZCB0aGUgbW9kYWwgaW4gZGlzcGxheTogbm9uZVxuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzKS5kaXNwbGF5ID09PSAnbm9uZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbeWVuVlVJXSBcdTI2QTBcdUZFMEYgQ2Fubm90IGV4ZWN1dGUgc2hvd01vZGFsKCkgb24gPHllbnZ1aS1tb2RhbD4gYmVjYXVzZSBhbiBhbmNlc3RvciBpcyBzZXR0aW5nICdkaXNwbGF5OiBub25lJy4gVGhpcyB3aWxsIGNhdXNlIGEgVUkgZnJlZXplLiBUYXJnZXQgdGl0bGU6IFwiJHt0aGlzLnRpdGxlVGV4dH1cImApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkaWFsb2cuc2hvd01vZGFsKCk7IC8vIEltcGVyYXRpdmUgQVBJIHB1c2ggdG8gI3RvcC1sYXllclxuICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vcGVuICYmIGRpYWxvZy5vcGVuKSB7XG4gICAgICAgICAgICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5nZWRQcm9wZXJ0aWVzLmhhcygnbWF4V2lkdGgnKSAmJiB0aGlzLm1heFdpZHRoKSB7XG4gICAgICAgICAgICB0aGlzLnN0eWxlLnNldFByb3BlcnR5KCctLW1vZGFsLW1heC13aWR0aCcsIHRoaXMubWF4V2lkdGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZU5hdGl2ZUNhbmNlbChlKSB7XG4gICAgICAgIC8vIFN0b3AgdGhlIGJyb3dzZXIgZnJvbSBpbXBsaWNpdGx5IGNsb3NpbmcgdGhlIGRpYWxvZyBhbmQgZGVzeW5jaHJvbml6aW5nIFVERiBzdGF0ZVxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICB0aGlzLl9kaXNwYXRjaENsb3NlKCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUJhY2tkcm9wQ2xpY2soZSkge1xuICAgICAgICAvLyBOYXRpdmUgPGRpYWxvZz4gc3BhbnMgdGhlIHNjcmVlbiwgYnV0IGl0cyBib3VuZGluZyBib3ggaXMganVzdCB0aGUgY29udGVudCBwYW5lbC5cbiAgICAgICAgLy8gSWYgdGhlIGNsaWNrIGZhbGxzIG91dHNpZGUgdGhlIGJvdW5kaW5nIGJveCwgaXQgaGl0IHRoZSA6OmJhY2tkcm9wLlxuICAgICAgICBjb25zdCBkaWFsb2cgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZGlhbG9nJyk7XG4gICAgICAgIGNvbnN0IHJlY3QgPSBkaWFsb2cuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGNvbnN0IGlzSW5EaWFsb2cgPSAocmVjdC50b3AgPD0gZS5jbGllbnRZICYmIGUuY2xpZW50WSA8PSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0XG4gICAgICAgICAgICAmJiByZWN0LmxlZnQgPD0gZS5jbGllbnRYICYmIGUuY2xpZW50WCA8PSByZWN0LmxlZnQgKyByZWN0LndpZHRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaXNJbkRpYWxvZykge1xuICAgICAgICAgICAgdGhpcy5fZGlzcGF0Y2hDbG9zZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Rpc3BhdGNoQ2xvc2UoKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktbW9kYWwtY2xvc2luZycsIHsgYnViYmxlczogdHJ1ZSwgY29tcG9zZWQ6IHRydWUsIGNhbmNlbGFibGU6IHRydWUgfSk7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgICAgIGlmIChldmVudC5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1tb2RhbC1jbG9zZWQnLCB7IGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpYWxvZyBcbiAgICAgICAgICAgICAgICBAY2FuY2VsPSR7dGhpcy5faGFuZGxlTmF0aXZlQ2FuY2VsfVxuICAgICAgICAgICAgICAgIEBjbGljaz0ke3RoaXMuX2hhbmRsZUJhY2tkcm9wQ2xpY2t9PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGgzPiR7dGhpcy50aXRsZVRleHR9PC9oMz5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNsb3NlLWJ0blwiIEBjbGljaz0ke3RoaXMuX2Rpc3BhdGNoQ2xvc2V9PkJhY2s8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYm9keVwiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9vdGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJmb290ZXJcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICA8L2RpYWxvZz5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1tb2RhbCcsIFllbnZ1aU1vZGFsKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLGNBQUFBLEVBQVksUUFBQUMsRUFBTSxPQUFBQyxNQUFXLE1BRS9CLGFBQU0sb0JBQW9CRixDQUFXLENBQ3hDLE9BQU8sV0FBYSxDQUNoQixVQUFXLENBQUUsS0FBTSxNQUFPLEVBQzFCLEtBQU0sQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3JDLFNBQVUsQ0FBRSxLQUFNLE1BQU8sRUFDekIsV0FBWSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssQ0FDL0MsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BaUhoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssS0FBTyxHQUNaLEtBQUssVUFBWSxHQUNqQixLQUFLLFNBQVcsR0FDaEIsS0FBSyxXQUFhLEVBQ3RCLENBQ0EsUUFBUUMsRUFBbUIsQ0FDdkIsR0FBSUEsRUFBa0IsSUFBSSxNQUFNLEVBQUcsQ0FDL0IsTUFBTUMsRUFBUyxLQUFLLFdBQVcsY0FBYyxRQUFRLEVBQ3JELEdBQUksQ0FBQ0EsRUFBUSxPQUVULEtBQUssTUFBUSxDQUFDQSxFQUFPLE1BRWpCLE9BQU8saUJBQWlCLElBQUksRUFBRSxVQUFZLFFBQzFDLFFBQVEsS0FBSyxrS0FBd0osS0FBSyxTQUFTLEdBQUcsRUFFMUxBLEVBQU8sVUFBVSxHQUNWLENBQUMsS0FBSyxNQUFRQSxFQUFPLE1BQzVCQSxFQUFPLE1BQU0sQ0FFckIsQ0FDSUQsRUFBa0IsSUFBSSxVQUFVLEdBQUssS0FBSyxVQUMxQyxLQUFLLE1BQU0sWUFBWSxvQkFBcUIsS0FBSyxRQUFRLENBRWpFLENBRUEsb0JBQW9CLEVBQUcsQ0FFbkIsRUFBRSxlQUFlLEVBQ2pCLEtBQUssZUFBZSxDQUN4QixDQUVBLHFCQUFxQixFQUFHLENBSXBCLE1BQU1FLEVBRFMsS0FBSyxXQUFXLGNBQWMsUUFBUSxFQUNqQyxzQkFBc0IsRUFDdEJBLEVBQUssS0FBTyxFQUFFLFNBQVcsRUFBRSxTQUFXQSxFQUFLLElBQU1BLEVBQUssUUFDbkVBLEVBQUssTUFBUSxFQUFFLFNBQVcsRUFBRSxTQUFXQSxFQUFLLEtBQU9BLEVBQUssT0FHM0QsS0FBSyxlQUFlLENBRTVCLENBRUEsZ0JBQWlCLENBQ2IsTUFBTUMsRUFBUSxJQUFJLFlBQVksdUJBQXdCLENBQUUsUUFBUyxHQUFNLFNBQVUsR0FBTSxXQUFZLEVBQUssQ0FBQyxFQUN6RyxLQUFLLGNBQWNBLENBQUssRUFDcEIsQ0FBQUEsRUFBTSxrQkFDVixLQUFLLGNBQWMsSUFBSSxZQUFZLHNCQUF1QixDQUFFLFFBQVMsR0FBTSxTQUFVLEVBQUssQ0FBQyxDQUFDLENBQ2hHLENBRUEsUUFBUyxDQUNMLE9BQU9MO0FBQUE7QUFBQSwwQkFFVyxLQUFLLG1CQUFtQjtBQUFBLHlCQUN6QixLQUFLLG9CQUFvQjtBQUFBO0FBQUE7QUFBQSwwQkFHeEIsS0FBSyxTQUFTO0FBQUEsdURBQ2UsS0FBSyxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FXdEUsQ0FDSixDQUNBLGVBQWUsT0FBTyxlQUFnQixXQUFXIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAiZGlhbG9nIiwgInJlY3QiLCAiZXZlbnQiXQp9Cg==
