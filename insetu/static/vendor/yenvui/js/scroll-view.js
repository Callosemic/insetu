import{html as t,css as n}from"lit";import{YenvuiBase as e}from"./yenvui-base.js";export class YenvuiScrollView extends e{static properties={padding:{type:String}};static styles=n`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            box-sizing: border-box;
            padding: var(--scroll-padding, 20px);
            container-type: inline-size;
            --mobile-edge-padding: 0px;
            --content-padding-x: 20px;
        }
        :host([padding="none"]) {
            padding: 0 !important;
        }
        @container (max-width: 480px) {
            :host {
                --content-padding-x: 0px;
            }
            :host(:not([padding="none"])) {
                padding: 0 !important;
                --mobile-edge-padding: 20px;
            }
        }
    `;constructor(){super(),this.padding="20px"}updated(i){super.updated(i),i.has("padding")&&this.padding&&this.padding!=="none"&&this.style.setProperty("--scroll-padding",this.padding)}render(){return t`<slot></slot>`}}customElements.define("yenvui-scroll-view",YenvuiScrollView);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVNjcm9sbFZpZXcgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgcGFkZGluZzogeyB0eXBlOiBTdHJpbmcgfVxuICAgIH07XG5cbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIGZsZXg6IDE7XG4gICAgICAgICAgICBtaW4taGVpZ2h0OiAwO1xuICAgICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgICAgICBwYWRkaW5nOiB2YXIoLS1zY3JvbGwtcGFkZGluZywgMjBweCk7XG4gICAgICAgICAgICBjb250YWluZXItdHlwZTogaW5saW5lLXNpemU7XG4gICAgICAgICAgICAtLW1vYmlsZS1lZGdlLXBhZGRpbmc6IDBweDtcbiAgICAgICAgICAgIC0tY29udGVudC1wYWRkaW5nLXg6IDIwcHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW3BhZGRpbmc9XCJub25lXCJdKSB7XG4gICAgICAgICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgOmhvc3Qge1xuICAgICAgICAgICAgICAgIC0tY29udGVudC1wYWRkaW5nLXg6IDBweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIDpob3N0KDpub3QoW3BhZGRpbmc9XCJub25lXCJdKSkge1xuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgICAgICAgICAgICAtLW1vYmlsZS1lZGdlLXBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMucGFkZGluZyA9ICcyMHB4JztcbiAgICB9XG5cbiAgICB1cGRhdGVkKGNoYW5nZWRQcm9wZXJ0aWVzKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpO1xuICAgICAgICBpZiAoY2hhbmdlZFByb3BlcnRpZXMuaGFzKCdwYWRkaW5nJykgJiYgdGhpcy5wYWRkaW5nICYmIHRoaXMucGFkZGluZyAhPT0gJ25vbmUnKSB7XG4gICAgICAgICAgICB0aGlzLnN0eWxlLnNldFByb3BlcnR5KCctLXNjcm9sbC1wYWRkaW5nJywgdGhpcy5wYWRkaW5nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgPHNsb3Q+PC9zbG90PmA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktc2Nyb2xsLXZpZXcnLCBZZW52dWlTY3JvbGxWaWV3KTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFxQixRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDdEMsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSx5QkFBeUJBLENBQVcsQ0FDN0MsT0FBTyxXQUFhLENBQ2hCLFFBQVMsQ0FBRSxLQUFNLE1BQU8sQ0FDNUIsRUFFQSxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUEyQmhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxRQUFVLE1BQ25CLENBRUEsUUFBUUUsRUFBbUIsQ0FDdkIsTUFBTSxRQUFRQSxDQUFpQixFQUMzQkEsRUFBa0IsSUFBSSxTQUFTLEdBQUssS0FBSyxTQUFXLEtBQUssVUFBWSxRQUNyRSxLQUFLLE1BQU0sWUFBWSxtQkFBb0IsS0FBSyxPQUFPLENBRS9ELENBRUEsUUFBUyxDQUNMLE9BQU9ILGdCQUNYLENBQ0osQ0FDQSxlQUFlLE9BQU8scUJBQXNCLGdCQUFnQiIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIiwgImNoYW5nZWRQcm9wZXJ0aWVzIl0KfQo=
