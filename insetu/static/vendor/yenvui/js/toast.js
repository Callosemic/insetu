import{LitElement as n,html as e,css as s}from"lit";export class YenvuiToastContainer extends n{static properties={toasts:{type:Array}};static styles=s`
        :host {
            position: fixed !important;
            inset: auto 20px 20px auto !important;
            margin: 0 !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            overflow: visible !important;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none !important;
            max-width: 400px;
            width: 100%;
        }

        :host::backdrop {
            display: none !important;
            background: transparent !important;
        }

        .toast {
            background: var(--pane-bg, #1e1e1e);
            color: var(--text, #e0e0e0);
            border: 1px solid var(--border, #444);
            border-left: 4px solid var(--toast-intent, var(--intent-primary, #3b82f6));
            padding: 12px 16px;
            border-radius: 6px;
            font-family: var(--font-mono, monospace);
            font-size: 0.85rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            pointer-events: auto;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .toast.intent-primary { --toast-intent: var(--intent-primary, #3b82f6); }
        .toast.intent-success { --toast-intent: var(--intent-success, #10b981); }
        .toast.intent-danger { --toast-intent: var(--intent-danger, #ef4444); }
        .toast.intent-warning { --toast-intent: var(--intent-warning, #f59e0b); }
        .toast.intent-highlight { --toast-intent: var(--intent-highlight, #8b5cf6); }

        .dismiss-btn {
            background: transparent;
            border: none;
            color: var(--text-muted, #888);
            cursor: pointer;
            font-size: 1rem;
            padding: 0;
            line-height: 1;
        }

        .dismiss-btn:hover {
            color: var(--text, #ffffff);
        }
    `;constructor(){super(),this.toasts=[]}connectedCallback(){if(super.connectedCallback(),typeof this.showPopover=="function"){this.setAttribute("popover","manual");try{this.showPopover()}catch{}}}updated(t){if(super.updated(t),t.has("toasts")&&this.toasts&&this.toasts.length>0&&typeof this.showPopover=="function")try{this.hidePopover(),this.showPopover()}catch{}}_dismiss(t){this.dispatchEvent(new CustomEvent("yenvui-toast-dismissed",{detail:{id:t},bubbles:!0,composed:!0}))}render(){return!this.toasts||this.toasts.length===0?e``:e`
            ${this.toasts.map(t=>e`
                <div 
                    class="toast intent-${t.intent||"primary"}"
                    @click=${()=>this._dismiss(t.id)}>
                    <span>${t.message}</span>
                    <button class="dismiss-btn" aria-label="Dismiss toast">✕</button>
                </div>
            `)}
        `}}customElements.define("yenvui-toast-container",YenvuiToastContainer);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRvYXN0Q29udGFpbmVyIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRvYXN0czogeyB0eXBlOiBBcnJheSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGluc2V0OiBhdXRvIDIwcHggMjBweCBhdXRvICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA0MDBweDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3Q6OmJhY2tkcm9wIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAudG9hc3Qge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS10b2FzdC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KSk7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsIDAsIDAsIDAuNCk7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiAxMnB4O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZSwgb3BhY2l0eSAwLjJzIGVhc2U7XG4gICAgICAgIH1cblxuICAgICAgICAudG9hc3QuaW50ZW50LXByaW1hcnkgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpOyB9XG4gICAgICAgIC50b2FzdC5pbnRlbnQtc3VjY2VzcyB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtc3VjY2VzcywgIzEwYjk4MSk7IH1cbiAgICAgICAgLnRvYXN0LmludGVudC1kYW5nZXIgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LWRhbmdlciwgI2VmNDQ0NCk7IH1cbiAgICAgICAgLnRvYXN0LmludGVudC13YXJuaW5nIHsgLS10b2FzdC1pbnRlbnQ6IHZhcigtLWludGVudC13YXJuaW5nLCAjZjU5ZTBiKTsgfVxuICAgICAgICAudG9hc3QuaW50ZW50LWhpZ2hsaWdodCB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTsgfVxuXG4gICAgICAgIC5kaXNtaXNzLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMXJlbTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5kaXNtaXNzLWJ0bjpob3ZlciB7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2ZmZmZmZik7XG4gICAgICAgIH1cbiAgICBgO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnRvYXN0cyA9IFtdO1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnNob3dQb3BvdmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgncG9wb3ZlcicsICdtYW51YWwnKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93UG9wb3ZlcigpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIC8vIFJlLXByb21vdGUgdGhlIGNvbnRhaW5lciB0byB0aGUgdG9wIG9mIHRoZSAjdG9wLWxheWVyIHdoZW5ldmVyIG5ldyB0b2FzdHMgYXJyaXZlXG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ3RvYXN0cycpICYmIHRoaXMudG9hc3RzICYmIHRoaXMudG9hc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5zaG93UG9wb3ZlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZVBvcG92ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaG93UG9wb3ZlcigpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZGlzbWlzcyhpZCkge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktdG9hc3QtZGlzbWlzc2VkJywge1xuICAgICAgICAgICAgZGV0YWlsOiB7IGlkIH0sXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWVcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgaWYgKCF0aGlzLnRvYXN0cyB8fCB0aGlzLnRvYXN0cy5sZW5ndGggPT09IDApIHJldHVybiBodG1sYGA7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgJHt0aGlzLnRvYXN0cy5tYXAodG9hc3QgPT4gaHRtbGBcbiAgICAgICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRvYXN0IGludGVudC0ke3RvYXN0LmludGVudCB8fCAncHJpbWFyeSd9XCJcbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KCkgPT4gdGhpcy5fZGlzbWlzcyh0b2FzdC5pZCl9PlxuICAgICAgICAgICAgICAgICAgICA8c3Bhbj4ke3RvYXN0Lm1lc3NhZ2V9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiZGlzbWlzcy1idG5cIiBhcmlhLWxhYmVsPVwiRGlzbWlzcyB0b2FzdFwiPlx1MjcxNTwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgYCl9XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktdG9hc3QtY29udGFpbmVyJywgWWVudnVpVG9hc3RDb250YWluZXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSw2QkFBNkJGLENBQVcsQ0FDakQsT0FBTyxXQUFhLENBQ2hCLE9BQVEsQ0FBRSxLQUFNLEtBQU0sQ0FDMUIsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUE4RGhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxPQUFTLENBQUMsQ0FDbkIsQ0FDQSxtQkFBb0IsQ0FFaEIsR0FEQSxNQUFNLGtCQUFrQixFQUNwQixPQUFPLEtBQUssYUFBZ0IsV0FBWSxDQUN4QyxLQUFLLGFBQWEsVUFBVyxRQUFRLEVBQ3JDLEdBQUksQ0FDQSxLQUFLLFlBQVksQ0FDckIsTUFBWSxDQUFDLENBQ2pCLENBQ0osQ0FFQSxRQUFRQyxFQUFtQixDQUd2QixHQUZBLE1BQU0sUUFBUUEsQ0FBaUIsRUFFM0JBLEVBQWtCLElBQUksUUFBUSxHQUFLLEtBQUssUUFBVSxLQUFLLE9BQU8sT0FBUyxHQUNuRSxPQUFPLEtBQUssYUFBZ0IsV0FDNUIsR0FBSSxDQUNBLEtBQUssWUFBWSxFQUNqQixLQUFLLFlBQVksQ0FDckIsTUFBWSxDQUFDLENBR3pCLENBRUEsU0FBU0MsRUFBSSxDQUNULEtBQUssY0FBYyxJQUFJLFlBQVkseUJBQTBCLENBQ3pELE9BQVEsQ0FBRSxHQUFBQSxDQUFHLEVBQ2IsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsQ0FDTixDQUVBLFFBQVMsQ0FDTCxNQUFJLENBQUMsS0FBSyxRQUFVLEtBQUssT0FBTyxTQUFXLEVBQVVILElBQzlDQTtBQUFBLGNBQ0QsS0FBSyxPQUFPLElBQUlJLEdBQVNKO0FBQUE7QUFBQSwwQ0FFR0ksRUFBTSxRQUFVLFNBQVM7QUFBQSw2QkFDdEMsSUFBTSxLQUFLLFNBQVNBLEVBQU0sRUFBRSxDQUFDO0FBQUEsNEJBQzlCQSxFQUFNLE9BQU87QUFBQTtBQUFBO0FBQUEsYUFHNUIsQ0FBQztBQUFBLFNBRVYsQ0FDSixDQUNBLGVBQWUsT0FBTyx5QkFBMEIsb0JBQW9CIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiY2hhbmdlZFByb3BlcnRpZXMiLCAiaWQiLCAidG9hc3QiXQp9Cg==
