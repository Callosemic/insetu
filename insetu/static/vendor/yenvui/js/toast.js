import{LitElement as n,html as e,css as s}from"lit";export class YenvuiToastContainer extends n{static properties={toasts:{type:Array}};static styles=s`
        :host {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: 400px;
            width: 100%;
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
    `;constructor(){super(),this.toasts=[]}_dismiss(t){this.dispatchEvent(new CustomEvent("yenvui-toast-dismissed",{detail:{id:t},bubbles:!0,composed:!0}))}render(){return e`
            ${this.toasts.map(t=>e`
                <div 
                    class="toast intent-${t.intent||"primary"}"
                    @click=${()=>this._dismiss(t.id)}>
                    <span>${t.message}</span>
                    <button class="dismiss-btn" aria-label="Dismiss toast">✕</button>
                </div>
            `)}
        `}}customElements.define("yenvui-toast-container",YenvuiToastContainer);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRvYXN0Q29udGFpbmVyIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRvYXN0czogeyB0eXBlOiBBcnJheSB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIGJvdHRvbTogMjBweDtcbiAgICAgICAgICAgIHJpZ2h0OiAyMHB4O1xuICAgICAgICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgZ2FwOiAxMHB4O1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDQwMHB4O1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIH1cblxuICAgICAgICAudG9hc3Qge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDRweCBzb2xpZCB2YXIoLS10b2FzdC1pbnRlbnQsIHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KSk7XG4gICAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vLCBtb25vc3BhY2UpO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjg1cmVtO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsIDAsIDAsIDAuNCk7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiAxMnB4O1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZSwgb3BhY2l0eSAwLjJzIGVhc2U7XG4gICAgICAgIH1cblxuICAgICAgICAudG9hc3QuaW50ZW50LXByaW1hcnkgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpOyB9XG4gICAgICAgIC50b2FzdC5pbnRlbnQtc3VjY2VzcyB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtc3VjY2VzcywgIzEwYjk4MSk7IH1cbiAgICAgICAgLnRvYXN0LmludGVudC1kYW5nZXIgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LWRhbmdlciwgI2VmNDQ0NCk7IH1cbiAgICAgICAgLnRvYXN0LmludGVudC13YXJuaW5nIHsgLS10b2FzdC1pbnRlbnQ6IHZhcigtLWludGVudC13YXJuaW5nLCAjZjU5ZTBiKTsgfVxuICAgICAgICAudG9hc3QuaW50ZW50LWhpZ2hsaWdodCB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTsgfVxuXG4gICAgICAgIC5kaXNtaXNzLWJ0biB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMXJlbTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC5kaXNtaXNzLWJ0bjpob3ZlciB7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2ZmZmZmZik7XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudG9hc3RzID0gW107XG4gICAgfVxuXG4gICAgX2Rpc21pc3MoaWQpIHtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLXRvYXN0LWRpc21pc3NlZCcsIHtcbiAgICAgICAgICAgIGRldGFpbDogeyBpZCB9LFxuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgJHt0aGlzLnRvYXN0cy5tYXAodG9hc3QgPT4gaHRtbGBcbiAgICAgICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRvYXN0IGludGVudC0ke3RvYXN0LmludGVudCB8fCAncHJpbWFyeSd9XCJcbiAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KCkgPT4gdGhpcy5fZGlzbWlzcyh0b2FzdC5pZCl9PlxuICAgICAgICAgICAgICAgICAgICA8c3Bhbj4ke3RvYXN0Lm1lc3NhZ2V9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiZGlzbWlzcy1idG5cIiBhcmlhLWxhYmVsPVwiRGlzbWlzcyB0b2FzdFwiPlx1MjcxNTwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgYCl9XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktdG9hc3QtY29udGFpbmVyJywgWWVudnVpVG9hc3RDb250YWluZXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSw2QkFBNkJGLENBQVcsQ0FDakQsT0FBTyxXQUFhLENBQ2hCLE9BQVEsQ0FBRSxLQUFNLEtBQU0sQ0FDMUIsRUFFQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFzRGhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxPQUFTLENBQUMsQ0FDbkIsQ0FFQSxTQUFTQyxFQUFJLENBQ1QsS0FBSyxjQUFjLElBQUksWUFBWSx5QkFBMEIsQ0FDekQsT0FBUSxDQUFFLEdBQUFBLENBQUcsRUFDYixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBRUEsUUFBUyxDQUNMLE9BQU9GO0FBQUEsY0FDRCxLQUFLLE9BQU8sSUFBSUcsR0FBU0g7QUFBQTtBQUFBLDBDQUVHRyxFQUFNLFFBQVUsU0FBUztBQUFBLDZCQUN0QyxJQUFNLEtBQUssU0FBU0EsRUFBTSxFQUFFLENBQUM7QUFBQSw0QkFDOUJBLEVBQU0sT0FBTztBQUFBO0FBQUE7QUFBQSxhQUc1QixDQUFDO0FBQUEsU0FFVixDQUNKLENBQ0EsZUFBZSxPQUFPLHlCQUEwQixvQkFBb0IiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJpZCIsICJ0b2FzdCJdCn0K
