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
    `;constructor(){super(),this.toasts=[]}connectedCallback(){super.connectedCallback(),this.removeAttribute("popover")}_dismiss(t){this.dispatchEvent(new CustomEvent("yenvui-toast-dismissed",{detail:{id:t},bubbles:!0,composed:!0}))}render(){return!this.toasts||this.toasts.length===0?e``:e`
            ${this.toasts.map(t=>e`
                <div 
                    class="toast intent-${t.intent||"primary"}"
                    @click=${()=>this._dismiss(t.id)}>
                    <span>${t.message}</span>
                    <button class="dismiss-btn" aria-label="Dismiss toast">✕</button>
                </div>
            `)}
        `}}customElements.define("yenvui-toast-container",YenvuiToastContainer);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRvYXN0Q29udGFpbmVyIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRvYXN0czogeyB0eXBlOiBBcnJheSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGluc2V0OiBhdXRvIDIwcHggMjBweCBhdXRvICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA0MDBweDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICB9XG5cbiAgICAgICAgLnRvYXN0IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXBhbmUtYmcsICMxZTFlMWUpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1sZWZ0OiA0cHggc29saWQgdmFyKC0tdG9hc3QtaW50ZW50LCB2YXIoLS1pbnRlbnQtcHJpbWFyeSwgIzNiODJmNikpO1xuICAgICAgICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgbW9ub3NwYWNlKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC44NXJlbTtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogMTJweDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2UsIG9wYWNpdHkgMC4ycyBlYXNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLnRvYXN0LmludGVudC1wcmltYXJ5IHsgLS10b2FzdC1pbnRlbnQ6IHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTsgfVxuICAgICAgICAudG9hc3QuaW50ZW50LXN1Y2Nlc3MgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LXN1Y2Nlc3MsICMxMGI5ODEpOyB9XG4gICAgICAgIC50b2FzdC5pbnRlbnQtZGFuZ2VyIHsgLS10b2FzdC1pbnRlbnQ6IHZhcigtLWludGVudC1kYW5nZXIsICNlZjQ0NDQpOyB9XG4gICAgICAgIC50b2FzdC5pbnRlbnQtd2FybmluZyB7IC0tdG9hc3QtaW50ZW50OiB2YXIoLS1pbnRlbnQtd2FybmluZywgI2Y1OWUwYik7IH1cbiAgICAgICAgLnRvYXN0LmludGVudC1oaWdobGlnaHQgeyAtLXRvYXN0LWludGVudDogdmFyKC0taW50ZW50LWhpZ2hsaWdodCwgIzhiNWNmNik7IH1cblxuICAgICAgICAuZGlzbWlzcy1idG4ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBmb250LXNpemU6IDFyZW07XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICAgIH1cblxuICAgICAgICAuZGlzbWlzcy1idG46aG92ZXIge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNmZmZmZmYpO1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy50b2FzdHMgPSBbXTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgLy8gQW5uaWhpbGF0ZSB0aGUgcG9wb3ZlciBhdHRyaWJ1dGUgdG8gcHJldmVudCB0aGUgYnJvd3NlciBmcm9tIGdlbmVyYXRpbmdcbiAgICAgICAgLy8gYW4gaW52aXNpYmxlIGJsb2NraW5nIDo6YmFja2Ryb3AgbGF5ZXIgb3ZlciB0aGUgc2NyZWVuLlxuICAgICAgICB0aGlzLnJlbW92ZUF0dHJpYnV0ZSgncG9wb3ZlcicpO1xuICAgIH1cblxuICAgIF9kaXNtaXNzKGlkKSB7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS10b2FzdC1kaXNtaXNzZWQnLCB7XG4gICAgICAgICAgICBkZXRhaWw6IHsgaWQgfSxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMudG9hc3RzIHx8IHRoaXMudG9hc3RzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGh0bWxgYDtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICAke3RoaXMudG9hc3RzLm1hcCh0b2FzdCA9PiBodG1sYFxuICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidG9hc3QgaW50ZW50LSR7dG9hc3QuaW50ZW50IHx8ICdwcmltYXJ5J31cIlxuICAgICAgICAgICAgICAgICAgICBAY2xpY2s9JHsoKSA9PiB0aGlzLl9kaXNtaXNzKHRvYXN0LmlkKX0+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuPiR7dG9hc3QubWVzc2FnZX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJkaXNtaXNzLWJ0blwiIGFyaWEtbGFiZWw9XCJEaXNtaXNzIHRvYXN0XCI+XHUyNzE1PC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICBgKX1cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS10b2FzdC1jb250YWluZXInLCBZZW52dWlUb2FzdENvbnRhaW5lcik7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUUvQixhQUFNLDZCQUE2QkYsQ0FBVyxDQUNqRCxPQUFPLFdBQWEsQ0FDaEIsT0FBUSxDQUFFLEtBQU0sS0FBTSxDQUMxQixFQUNBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BeURoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssT0FBUyxDQUFDLENBQ25CLENBRUEsbUJBQW9CLENBQ2hCLE1BQU0sa0JBQWtCLEVBR3hCLEtBQUssZ0JBQWdCLFNBQVMsQ0FDbEMsQ0FFQSxTQUFTQyxFQUFJLENBQ1QsS0FBSyxjQUFjLElBQUksWUFBWSx5QkFBMEIsQ0FDekQsT0FBUSxDQUFFLEdBQUFBLENBQUcsRUFDYixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBRUEsUUFBUyxDQUNMLE1BQUksQ0FBQyxLQUFLLFFBQVUsS0FBSyxPQUFPLFNBQVcsRUFBVUYsSUFDOUNBO0FBQUEsY0FDRCxLQUFLLE9BQU8sSUFBSUcsR0FBU0g7QUFBQTtBQUFBLDBDQUVHRyxFQUFNLFFBQVUsU0FBUztBQUFBLDZCQUN0QyxJQUFNLEtBQUssU0FBU0EsRUFBTSxFQUFFLENBQUM7QUFBQSw0QkFDOUJBLEVBQU0sT0FBTztBQUFBO0FBQUE7QUFBQSxhQUc1QixDQUFDO0FBQUEsU0FFVixDQUNKLENBQ0EsZUFBZSxPQUFPLHlCQUEwQixvQkFBb0IiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJpZCIsICJ0b2FzdCJdCn0K
