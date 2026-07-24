import{LitElement as t,html as e,css as o}from"lit";export class YenvuiCategorySection extends t{static properties={titleText:{type:String}};static styles=o`
        :host {
            display: block;
        }
        .category-heading {
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--text, #e0e0e0);
            border-bottom: 1px solid var(--border, #444);
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        :host([data-theme="e-ink"]) .category-heading {
            color: #000000;
            border-bottom: 2px solid #000000;
        }
    `;connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}render(){return e`
            <div class="category-heading">
                <span>${this.titleText}</span>
                <slot name="header-actions"></slot>
            </div>
            <div class="category-content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-category-section",YenvuiCategorySection);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNhdGVnb3J5U2VjdGlvbiBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0aXRsZVRleHQ6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3Qge1xuICAgICAgICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICAgIH1cbiAgICAgICAgLmNhdGVnb3J5LWhlYWRpbmcge1xuICAgICAgICAgICAgbWFyZ2luLXRvcDogMjVweDtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDE1cHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogNXB4O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhdGVnb3J5LWhlYWRpbmcge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgIzAwMDAwMDtcbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtdGhlbWUnXSB9KTtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl90aGVtZU9ic2VydmVyKSB0aGlzLl90aGVtZU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhdGVnb3J5LWhlYWRpbmdcIj5cbiAgICAgICAgICAgICAgICA8c3Bhbj4ke3RoaXMudGl0bGVUZXh0fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiaGVhZGVyLWFjdGlvbnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXRlZ29yeS1jb250ZW50XCI+XG4gICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY2F0ZWdvcnktc2VjdGlvbicsIFllbnZ1aUNhdGVnb3J5U2VjdGlvbik7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxjQUFBQSxFQUFZLFFBQUFDLEVBQU0sT0FBQUMsTUFBVyxNQUUvQixhQUFNLDhCQUE4QkYsQ0FBVyxDQUNsRCxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxDQUM5QixFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Bc0JoQixtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxlQUFpQixJQUFJLGlCQUFpQixJQUFNLENBQzdDLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBQUMsRUFDRCxLQUFLLGVBQWUsUUFBUSxTQUFTLEtBQU0sQ0FBRSxXQUFZLEdBQU0sZ0JBQWlCLENBQUMsWUFBWSxDQUFFLENBQUMsRUFDaEcsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FFQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDdkIsS0FBSyxnQkFBZ0IsS0FBSyxlQUFlLFdBQVcsQ0FDNUQsQ0FFQSxRQUFTLENBQ0wsT0FBT0Q7QUFBQTtBQUFBLHdCQUVTLEtBQUssU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQU9sQyxDQUNKLENBQ0EsZUFBZSxPQUFPLDBCQUEyQixxQkFBcUIiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyJdCn0K
