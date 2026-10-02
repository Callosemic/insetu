import{html as e,css as r}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";export class YenvuiDropOverlay extends o{static properties={active:{type:Boolean,reflect:!0}};static styles=r`
        :host {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: var(--modal-backdrop, rgba(0, 0, 0, 0.85)) !important;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 20px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            z-index: 9999;
            user-select: none;
            -webkit-user-select: none;
        }
        :host([active]) {
            opacity: 1;
            pointer-events: auto;
        }
        /* Top-Layer Popover API Escalation */
        :host(:popover-open) {
            display: flex;
        }
    `;constructor(){super(),this.active=!1}updated(t){if(super.updated(t),t.has("active")){if(this.active&&typeof this.showPopover=="function"&&!this.matches(":popover-open")){this.setAttribute("popover","manual");try{this.showPopover()}catch{}}else if(!this.active&&typeof this.hidePopover=="function"&&this.matches(":popover-open"))try{this.hidePopover()}catch{}}}render(){return e`<slot></slot>`}}customElements.define("yenvui-drop-overlay",YenvuiDropOverlay);export class YenvuiDropTarget extends o{static properties={hovered:{type:Boolean,reflect:!0},intent:{type:String},zone:{type:String}};static styles=r`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 120px;
            border: 2px dashed var(--border);
            border-radius: 8px;
            color: var(--text-muted);
            font-size: 1.2rem;
            font-weight: bold;
            transition: all 0.2s ease;
            background: var(--pane-bg);
            box-sizing: border-box;
            width: 100%;
        }
        :host([hovered]) {
            border-style: solid;
            transform: scale(1.05);
        }
        .intent-primary {
            border-color: var(--intent-primary);
            background: color-mix(in srgb, var(--intent-primary) 20%, var(--pane-bg));
            color: var(--text);
        }
        .intent-danger {
            border-color: var(--intent-danger);
            color: var(--intent-danger);
        }
        :host([hovered]) .intent-danger {
            background: color-mix(in srgb, var(--intent-danger) 20%, var(--pane-bg));
            color: white;
        }
        :host([intent="danger"]) { 
            height: 80px; 
            max-width: 400px; 
        }
    `;constructor(){super(),this.hovered=!1,this.intent="primary",this.zone=""}render(){const t=this.hovered||this.intent==="danger"?`intent-${this.intent}`:"";return e`
            <div class="${t}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; border-radius:inherit; flex-direction: column;">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-drop-target",YenvuiDropTarget);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gc3V0cmFtL3llbnZ1aS9qcy9kcm9wLXpvbmUuanNcbmltcG9ydCB7IGh0bWwsIGNzcyB9IGZyb20gJ2xpdCc7XG5pbXBvcnQgeyBZZW52dWlCYXNlIH0gZnJvbSAnLi95ZW52dWktYmFzZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBZZW52dWlEcm9wT3ZlcmxheSBleHRlbmRzIFllbnZ1aUJhc2Uge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICBhY3RpdmU6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZCAhaW1wb3J0YW50O1xuICAgICAgICAgICAgaW5zZXQ6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgIHdpZHRoOiAxMDB2dyAhaW1wb3J0YW50O1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDBkdmggIWltcG9ydGFudDtcbiAgICAgICAgICAgIG1heC13aWR0aDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWF4LWhlaWdodDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLW1vZGFsLWJhY2tkcm9wLCByZ2JhKDAsIDAsIDAsIDAuODUpKSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDRweCk7XG4gICAgICAgICAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjogYmx1cig0cHgpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDIwcHg7XG4gICAgICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMnMgZWFzZTtcbiAgICAgICAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICAgIC13ZWJraXQtdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2FjdGl2ZV0pIHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcbiAgICAgICAgfVxuICAgICAgICAvKiBUb3AtTGF5ZXIgUG9wb3ZlciBBUEkgRXNjYWxhdGlvbiAqL1xuICAgICAgICA6aG9zdCg6cG9wb3Zlci1vcGVuKSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICB9XG4gICAgYDtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmIChjaGFuZ2VkUHJvcGVydGllcy5oYXMoJ2FjdGl2ZScpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hY3RpdmUgJiYgdHlwZW9mIHRoaXMuc2hvd1BvcG92ZXIgPT09ICdmdW5jdGlvbicgJiYgIXRoaXMubWF0Y2hlcygnOnBvcG92ZXItb3BlbicpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ3BvcG92ZXInLCAnbWFudWFsJyk7XG4gICAgICAgICAgICAgICAgdHJ5IHsgdGhpcy5zaG93UG9wb3ZlcigpOyB9IGNhdGNoKGUpIHt9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmFjdGl2ZSAmJiB0eXBlb2YgdGhpcy5oaWRlUG9wb3ZlciA9PT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLm1hdGNoZXMoJzpwb3BvdmVyLW9wZW4nKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7IHRoaXMuaGlkZVBvcG92ZXIoKTsgfSBjYXRjaChlKSB7fVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGA8c2xvdD48L3Nsb3Q+YDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1kcm9wLW92ZXJsYXknLCBZZW52dWlEcm9wT3ZlcmxheSk7XG5cbmV4cG9ydCBjbGFzcyBZZW52dWlEcm9wVGFyZ2V0IGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIGhvdmVyZWQ6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBpbnRlbnQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIHpvbmU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3Qge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgIGhlaWdodDogMTIwcHg7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBkYXNoZWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycyBlYXNlO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZyk7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hvdmVyZWRdKSB7XG4gICAgICAgICAgICBib3JkZXItc3R5bGU6IHNvbGlkO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjA1KTtcbiAgICAgICAgfVxuICAgICAgICAuaW50ZW50LXByaW1hcnkge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1pbnRlbnQtcHJpbWFyeSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0taW50ZW50LXByaW1hcnkpIDIwJSwgdmFyKC0tcGFuZS1iZykpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICB9XG4gICAgICAgIC5pbnRlbnQtZGFuZ2VyIHtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0taW50ZW50LWRhbmdlcik7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZW50LWRhbmdlcik7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2hvdmVyZWRdKSAuaW50ZW50LWRhbmdlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0taW50ZW50LWRhbmdlcikgMjAlLCB2YXIoLS1wYW5lLWJnKSk7XG4gICAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ludGVudD1cImRhbmdlclwiXSkgeyBcbiAgICAgICAgICAgIGhlaWdodDogODBweDsgXG4gICAgICAgICAgICBtYXgtd2lkdGg6IDQwMHB4OyBcbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5ob3ZlcmVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaW50ZW50ID0gJ3ByaW1hcnknO1xuICAgICAgICB0aGlzLnpvbmUgPSAnJztcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIGNvbnN0IGludGVudENsYXNzID0gdGhpcy5ob3ZlcmVkIHx8IHRoaXMuaW50ZW50ID09PSAnZGFuZ2VyJyA/IGBpbnRlbnQtJHt0aGlzLmludGVudH1gIDogJyc7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIiR7aW50ZW50Q2xhc3N9XCIgc3R5bGU9XCJ3aWR0aDoxMDAlOyBoZWlnaHQ6MTAwJTsgZGlzcGxheTpmbGV4OyBhbGlnbi1pdGVtczpjZW50ZXI7IGp1c3RpZnktY29udGVudDpjZW50ZXI7IGJvcmRlci1yYWRpdXM6aW5oZXJpdDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcIj5cbiAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1kcm9wLXRhcmdldCcsIFllbnZ1aURyb3BUYXJnZXQpOyJdLAogICJtYXBwaW5ncyI6ICJBQUNBLE9BQVMsUUFBQUEsRUFBTSxPQUFBQyxNQUFXLE1BQzFCLE9BQVMsY0FBQUMsTUFBa0IsbUJBRXBCLGFBQU0sMEJBQTBCQSxDQUFXLENBQzlDLE9BQU8sV0FBYSxDQUNoQixPQUFRLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMzQyxFQUVBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW9DaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLE9BQVMsRUFDbEIsQ0FFQSxRQUFRRSxFQUFtQixDQUV2QixHQURBLE1BQU0sUUFBUUEsQ0FBaUIsRUFDM0JBLEVBQWtCLElBQUksUUFBUSxHQUM5QixHQUFJLEtBQUssUUFBVSxPQUFPLEtBQUssYUFBZ0IsWUFBYyxDQUFDLEtBQUssUUFBUSxlQUFlLEVBQUcsQ0FDekYsS0FBSyxhQUFhLFVBQVcsUUFBUSxFQUNyQyxHQUFJLENBQUUsS0FBSyxZQUFZLENBQUcsTUFBVyxDQUFDLENBQzFDLFNBQVcsQ0FBQyxLQUFLLFFBQVUsT0FBTyxLQUFLLGFBQWdCLFlBQWMsS0FBSyxRQUFRLGVBQWUsRUFDN0YsR0FBSSxDQUFFLEtBQUssWUFBWSxDQUFHLE1BQVcsQ0FBQyxFQUdsRCxDQUVBLFFBQVMsQ0FDTCxPQUFPSCxnQkFDWCxDQUNKLENBQ0EsZUFBZSxPQUFPLHNCQUF1QixpQkFBaUIsRUFFdkQsYUFBTSx5QkFBeUJFLENBQVcsQ0FDN0MsT0FBTyxXQUFhLENBQ2hCLFFBQVMsQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3hDLE9BQVEsQ0FBRSxLQUFNLE1BQU8sRUFDdkIsS0FBTSxDQUFFLEtBQU0sTUFBTyxDQUN6QixFQUVBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXVDaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLFFBQVUsR0FDZixLQUFLLE9BQVMsVUFDZCxLQUFLLEtBQU8sRUFDaEIsQ0FFQSxRQUFTLENBQ0wsTUFBTUcsRUFBYyxLQUFLLFNBQVcsS0FBSyxTQUFXLFNBQVcsVUFBVSxLQUFLLE1BQU0sR0FBSyxHQUN6RixPQUFPSjtBQUFBLDBCQUNXSSxDQUFXO0FBQUE7QUFBQTtBQUFBLFNBSWpDLENBQ0osQ0FDQSxlQUFlLE9BQU8scUJBQXNCLGdCQUFnQiIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIiwgImNoYW5nZWRQcm9wZXJ0aWVzIiwgImludGVudENsYXNzIl0KfQo=
