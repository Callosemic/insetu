import{LitElement as e,html as t,css as r}from"lit";export class YenvuiBoard extends e{static styles=r`
        :host { 
            display: flex; 
            gap: 15px; 
            width: 100%; 
        }
        @container (max-width: 800px) {
            :host { 
                flex-direction: column; 
                gap: 25px; 
            }
        }
    `;render(){return t`<slot></slot>`}}customElements.define("yenvui-board",YenvuiBoard);export class YenvuiColumn extends e{static properties={titleText:{type:String},intentColor:{type:String}};static styles=r`
        :host { 
            flex: 1; 
            min-width: 250px; 
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
        @container (max-width: 800px) {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUJvYXJkIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IFxuICAgICAgICAgICAgZ2FwOiAxNXB4OyBcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlOyBcbiAgICAgICAgfVxuICAgICAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDgwMHB4KSB7XG4gICAgICAgICAgICA6aG9zdCB7IFxuICAgICAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IFxuICAgICAgICAgICAgICAgIGdhcDogMjVweDsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGA8c2xvdD48L3Nsb3Q+YDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1ib2FyZCcsIFllbnZ1aUJvYXJkKTtcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNvbHVtbiBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0aXRsZVRleHQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGludGVudENvbG9yOiB7IHR5cGU6IFN0cmluZyB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBmbGV4OiAxOyBcbiAgICAgICAgICAgIG1pbi13aWR0aDogMjUwcHg7IFxuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpOyBcbiAgICAgICAgICAgIHBhZGRpbmc6IDEwcHg7IFxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4OyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IFxuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgXG4gICAgICAgICAgICBnYXA6IDEwcHg7IFxuICAgICAgICB9XG4gICAgICAgIC5oZWFkZXIgeyBcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IDA7IFxuICAgICAgICAgICAgZm9udC1zaXplOiAxLjFyZW07IFxuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7IFxuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDsgXG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7IFxuICAgICAgICB9XG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogODAwcHgpIHtcbiAgICAgICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7IFxuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDA7IFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmhlYWRlciB7IFxuICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtOyBcbiAgICAgICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTsgXG4gICAgICAgICAgICAgICAgcGFkZGluZy1ib3R0b206IDVweDsgXG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudGl0bGVUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMuaW50ZW50Q29sb3IgPSAnJztcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtdGhlbWUnXSB9KTtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl90aGVtZU9ic2VydmVyKSB0aGlzLl90aGVtZU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgJHt0aGlzLnRpdGxlVGV4dCA/IGh0bWxgPGRpdiBjbGFzcz1cImhlYWRlclwiIHN0eWxlPVwiY29sb3I6ICR7dGhpcy5pbnRlbnRDb2xvciB8fCAndmFyKC0tdGV4dCwgI2UwZTBlMCknfTtcIj4ke3RoaXMudGl0bGVUZXh0fTwvZGl2PmAgOiAnJ31cbiAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1jb2x1bW4nLCBZZW52dWlDb2x1bW4pOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSxvQkFBb0JGLENBQVcsQ0FDeEMsT0FBTyxPQUFTRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWNoQixRQUFTLENBQ0wsT0FBT0QsZ0JBQ1gsQ0FDSixDQUNBLGVBQWUsT0FBTyxlQUFnQixXQUFXLEVBRTFDLGFBQU0scUJBQXFCRCxDQUFXLENBQ3pDLE9BQU8sV0FBYSxDQUNoQixVQUFXLENBQUUsS0FBTSxNQUFPLEVBQzFCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sQ0FDaEMsRUFFQSxPQUFPLE9BQVNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZ0NoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssVUFBWSxHQUNqQixLQUFLLFlBQWMsRUFDdkIsQ0FFQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxlQUFpQixJQUFJLGlCQUFpQixJQUFNLENBQzdDLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBQUMsRUFDRCxLQUFLLGVBQWUsUUFBUSxTQUFTLEtBQU0sQ0FBRSxXQUFZLEdBQU0sZ0JBQWlCLENBQUMsWUFBWSxDQUFFLENBQUMsRUFDaEcsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FFQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDdkIsS0FBSyxnQkFBZ0IsS0FBSyxlQUFlLFdBQVcsQ0FDNUQsQ0FFQSxRQUFTLENBQ0wsT0FBT0Q7QUFBQSxjQUNELEtBQUssVUFBWUEsc0NBQXlDLEtBQUssYUFBZSxzQkFBc0IsTUFBTSxLQUFLLFNBQVMsU0FBVyxFQUFFO0FBQUE7QUFBQSxTQUcvSSxDQUNKLENBQ0EsZUFBZSxPQUFPLGdCQUFpQixZQUFZIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiXQp9Cg==
