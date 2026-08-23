import{LitElement as e,html as t,css as r}from"lit";export class YenvuiBoard extends e{static styles=r`
        :host { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr);
            align-items: start;
            gap: 15px; 
            width: 100%; 
        }
        @container (max-width: 1100px) {
            :host { 
                grid-template-columns: repeat(2, 1fr); 
            }
        }
        @container (max-width: 700px) {
            :host { 
                grid-template-columns: 1fr; 
                gap: 25px; 
            }
        }
    `;render(){return t`<slot></slot>`}}customElements.define("yenvui-board",YenvuiBoard);export class YenvuiColumn extends e{static properties={titleText:{type:String},intentColor:{type:String}};static styles=r`
        :host { 
            min-width: 0; 
            background: var(--input-bg, #2d2d2d); 
            padding: 10px; 
            border-radius: 6px; 
            display: flex; 
            flex-direction: column; 
            gap: 10px; 
        }
        .header { 
            margin-top: 0; 
            font-size: 1.1rem; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: var(--text, #e0e0e0); 
        }
        @container (max-width: 700px) {
            :host { 
                background: transparent; 
                padding: 0; 
            }
            .header { 
                font-size: 1.2rem; 
                border-bottom: 1px solid var(--border, #444); 
                padding-bottom: 5px; 
                margin-bottom: 15px; 
            }
        }
    `;constructor(){super(),this.titleText="",this.intentColor=""}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}render(){return t`
            ${this.titleText?t`<div class="header" style="color: ${this.intentColor||"var(--text, #e0e0e0)"};">${this.titleText}</div>`:""}
            <slot></slot>
        `}}customElements.define("yenvui-column",YenvuiColumn);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmV4cG9ydCBjbGFzcyBZZW52dWlCb2FyZCBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBkaXNwbGF5OiBncmlkOyBcbiAgICAgICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDMsIDFmcik7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogc3RhcnQ7XG4gICAgICAgICAgICBnYXA6IDE1cHg7IFxuICAgICAgICAgICAgd2lkdGg6IDEwMCU7IFxuICAgICAgICB9XG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogMTEwMHB4KSB7XG4gICAgICAgICAgICA6aG9zdCB7IFxuICAgICAgICAgICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDIsIDFmcik7IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNzAwcHgpIHtcbiAgICAgICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiAxZnI7IFxuICAgICAgICAgICAgICAgIGdhcDogMjVweDsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGA8c2xvdD48L3Nsb3Q+YDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1ib2FyZCcsIFllbnZ1aUJvYXJkKTtcbmV4cG9ydCBjbGFzcyBZZW52dWlDb2x1bW4gZXh0ZW5kcyBMaXRFbGVtZW50IHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgdGl0bGVUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnRDb2xvcjogeyB0eXBlOiBTdHJpbmcgfVxuICAgIH07XG5cbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IFxuICAgICAgICAgICAgbWluLXdpZHRoOiAwOyBcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTsgXG4gICAgICAgICAgICBwYWRkaW5nOiAxMHB4OyBcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDsgXG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IFxuICAgICAgICAgICAgZ2FwOiAxMHB4OyBcbiAgICAgICAgfVxuICAgICAgICAuaGVhZGVyIHsgXG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAwOyBcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4xcmVtOyBcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkOyBcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7IFxuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApOyBcbiAgICAgICAgfVxuICAgICAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDcwMHB4KSB7XG4gICAgICAgICAgICA6aG9zdCB7IFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50OyBcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiAwOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC5oZWFkZXIgeyBcbiAgICAgICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTsgXG4gICAgICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7IFxuICAgICAgICAgICAgICAgIHBhZGRpbmctYm90dG9tOiA1cHg7IFxuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDE1cHg7IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgYDtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnRpdGxlVGV4dCA9ICcnO1xuICAgICAgICB0aGlzLmludGVudENvbG9yID0gJyc7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJoZWFkZXJcIiBzdHlsZT1cImNvbG9yOiAke3RoaXMuaW50ZW50Q29sb3IgfHwgJ3ZhcigtLXRleHQsICNlMGUwZTApJ307XCI+JHt0aGlzLnRpdGxlVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY29sdW1uJywgWWVudnVpQ29sdW1uKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLGNBQUFBLEVBQVksUUFBQUMsRUFBTSxPQUFBQyxNQUFXLE1BQy9CLGFBQU0sb0JBQW9CRixDQUFXLENBQ3hDLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXFCaEIsUUFBUyxDQUNMLE9BQU9ELGdCQUNYLENBQ0osQ0FDQSxlQUFlLE9BQU8sZUFBZ0IsV0FBVyxFQUMxQyxhQUFNLHFCQUFxQkQsQ0FBVyxDQUN6QyxPQUFPLFdBQWEsQ0FDaEIsVUFBVyxDQUFFLEtBQU0sTUFBTyxFQUMxQixZQUFhLENBQUUsS0FBTSxNQUFPLENBQ2hDLEVBRUEsT0FBTyxPQUFTRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErQmhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxVQUFZLEdBQ2pCLEtBQUssWUFBYyxFQUN2QixDQUVBLG1CQUFvQixDQUNoQixNQUFNLGtCQUFrQixFQUN4QixLQUFLLGVBQWlCLElBQUksaUJBQWlCLElBQU0sQ0FDN0MsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FBQyxFQUNELEtBQUssZUFBZSxRQUFRLFNBQVMsS0FBTSxDQUFFLFdBQVksR0FBTSxnQkFBaUIsQ0FBQyxZQUFZLENBQUUsQ0FBQyxFQUNoRyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUVBLHNCQUF1QixDQUNuQixNQUFNLHFCQUFxQixFQUN2QixLQUFLLGdCQUFnQixLQUFLLGVBQWUsV0FBVyxDQUM1RCxDQUVBLFFBQVMsQ0FDTCxPQUFPRDtBQUFBLGNBQ0QsS0FBSyxVQUFZQSxzQ0FBeUMsS0FBSyxhQUFlLHNCQUFzQixNQUFNLEtBQUssU0FBUyxTQUFXLEVBQUU7QUFBQTtBQUFBLFNBRy9JLENBQ0osQ0FDQSxlQUFlLE9BQU8sZ0JBQWlCLFlBQVkiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyJdCn0K
