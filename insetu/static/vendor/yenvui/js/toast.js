import{LitElement as e,html as n,css as s}from"lit";export class YenvuiToastContainer extends e{static properties={toasts:{type:Array}};static styles=s`
        :host {
            display: contents;
        }

        .toast-container {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            margin: 0 !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            overflow: visible !important;
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
    `;constructor(){super(),this.toasts=[]}connectedCallback(){super.connectedCallback()}_dismiss(t){this.dispatchEvent(new CustomEvent("yenvui-toast-dismissed",{detail:{id:t},bubbles:!0,composed:!0}))}render(){return!this.toasts||this.toasts.length===0?n``:n`
            <div class="toast-container">
                ${this.toasts.map(t=>n`
                    <div 
                        class="toast intent-${t.intent||"primary"}"
                        @click=${()=>this._dismiss(t.id)}>
                        <span>${t.message}</span>
                        <button class="dismiss-btn" aria-label="Dismiss toast">✕</button>
                    </div>
                `)}
            </div>
        `}}customElements.define("yenvui-toast-container",YenvuiToastContainer);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRvYXN0Q29udGFpbmVyIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRvYXN0czogeyB0eXBlOiBBcnJheSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBjb250ZW50cztcbiAgICAgICAgfVxuXG4gICAgICAgIC50b2FzdC1jb250YWluZXIge1xuICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3R0b206IDIwcHggIWltcG9ydGFudDtcbiAgICAgICAgICAgIHJpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICAgIG1heC13aWR0aDogNDAwcHg7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgfVxuXG4gICAgICAgIC50b2FzdCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1wYW5lLWJnLCAjMWUxZTFlKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIHZhcigtLXRvYXN0LWludGVudCwgdmFyKC0taW50ZW50LXByaW1hcnksICMzYjgyZjYpKTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMTZweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8sIG1vbm9zcGFjZSk7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDRweCAxMnB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBhdXRvO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDEycHg7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlLCBvcGFjaXR5IDAuMnMgZWFzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC50b2FzdC5pbnRlbnQtcHJpbWFyeSB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNik7IH1cbiAgICAgICAgLnRvYXN0LmludGVudC1zdWNjZXNzIHsgLS10b2FzdC1pbnRlbnQ6IHZhcigtLWludGVudC1zdWNjZXNzLCAjMTBiOTgxKTsgfVxuICAgICAgICAudG9hc3QuaW50ZW50LWRhbmdlciB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtZGFuZ2VyLCAjZWY0NDQ0KTsgfVxuICAgICAgICAudG9hc3QuaW50ZW50LXdhcm5pbmcgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LXdhcm5pbmcsICNmNTllMGIpOyB9XG4gICAgICAgIC50b2FzdC5pbnRlbnQtaGlnaGxpZ2h0IHsgLS10b2FzdC1pbnRlbnQ6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpOyB9XG5cbiAgICAgICAgLmRpc21pc3MtYnRuIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgZm9udC1zaXplOiAxcmVtO1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLmRpc21pc3MtYnRuOmhvdmVyIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LCAjZmZmZmZmKTtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudG9hc3RzID0gW107XG4gICAgfVxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgIH1cblxuICAgIF9kaXNtaXNzKGlkKSB7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS10b2FzdC1kaXNtaXNzZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgaWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgLy8gR3VhcmRyYWlsOiBLZWVwIHRoZSBET00gZW50aXJlbHkgY2xlYW4gaWYgbm8gdG9hc3RzIGFyZSBhY3RpdmVcbiAgICAgICAgaWYgKCF0aGlzLnRvYXN0cyB8fCB0aGlzLnRvYXN0cy5sZW5ndGggPT09IDApIHJldHVybiBodG1sYGA7XG5cbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9hc3QtY29udGFpbmVyXCI+XG4gICAgICAgICAgICAgICAgJHt0aGlzLnRvYXN0cy5tYXAodG9hc3QgPT4gaHRtbGBcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidG9hc3QgaW50ZW50LSR7dG9hc3QuaW50ZW50IHx8ICdwcmltYXJ5J31cIlxuICAgICAgICAgICAgICAgICAgICAgICAgQGNsaWNrPSR7KCkgPT4gdGhpcy5fZGlzbWlzcyh0b2FzdC5pZCl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+JHt0b2FzdC5tZXNzYWdlfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJkaXNtaXNzLWJ0blwiIGFyaWEtbGFiZWw9XCJEaXNtaXNzIHRvYXN0XCI+XHUyNzE1PC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIGApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktdG9hc3QtY29udGFpbmVyJywgWWVudnVpVG9hc3RDb250YWluZXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSw2QkFBNkJGLENBQVcsQ0FDakQsT0FBTyxXQUFhLENBQ2hCLE9BQVEsQ0FBRSxLQUFNLEtBQU0sQ0FDMUIsRUFDQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUE4RGhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxPQUFTLENBQUMsQ0FDbkIsQ0FDQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsQ0FDNUIsQ0FFQSxTQUFTQyxFQUFJLENBQ1QsS0FBSyxjQUFjLElBQUksWUFBWSx5QkFBMEIsQ0FDekQsT0FBUSxDQUFFLEdBQUFBLENBQUcsRUFDYixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQ0EsUUFBUyxDQUVMLE1BQUksQ0FBQyxLQUFLLFFBQVUsS0FBSyxPQUFPLFNBQVcsRUFBVUYsSUFFOUNBO0FBQUE7QUFBQSxrQkFFRyxLQUFLLE9BQU8sSUFBSUcsR0FBU0g7QUFBQTtBQUFBLDhDQUVHRyxFQUFNLFFBQVUsU0FBUztBQUFBLGlDQUN0QyxJQUFNLEtBQUssU0FBU0EsRUFBTSxFQUFFLENBQUM7QUFBQSxnQ0FDOUJBLEVBQU0sT0FBTztBQUFBO0FBQUE7QUFBQSxpQkFHNUIsQ0FBQztBQUFBO0FBQUEsU0FHZCxDQUNKLENBQ0EsZUFBZSxPQUFPLHlCQUEwQixvQkFBb0IiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJpZCIsICJ0b2FzdCJdCn0K
