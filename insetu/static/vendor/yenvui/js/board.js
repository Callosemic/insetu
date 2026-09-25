import{html as t,css as e}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiBoard extends r{static styles=e`
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
    `;render(){return t`<slot></slot>`}}customElements.define("yenvui-board",YenvuiBoard);export class YenvuiColumn extends r{static properties={titleText:{type:String},intentColor:{type:String}};static styles=e`
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
    `;constructor(){super(),this.titleText="",this.intentColor=""}render(){return t`
            ${this.titleText?t`<div class="header" style="color: ${this.intentColor||"var(--text, #e0e0e0)"};">${this.titleText}</div>`:""}
            <slot></slot>
        `}}customElements.define("yenvui-column",YenvuiColumn);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUJvYXJkIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7IFxuICAgICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoMywgMWZyKTtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBzdGFydDtcbiAgICAgICAgICAgIGdhcDogMTVweDsgXG4gICAgICAgICAgICB3aWR0aDogMTAwJTsgXG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiAxMTAwcHgpIHtcbiAgICAgICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoMiwgMWZyKTsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA3MDBweCkge1xuICAgICAgICAgICAgOmhvc3QgeyBcbiAgICAgICAgICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmcjsgXG4gICAgICAgICAgICAgICAgZ2FwOiAyNXB4OyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYDxzbG90Pjwvc2xvdD5gO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWJvYXJkJywgWWVudnVpQm9hcmQpO1xuZXhwb3J0IGNsYXNzIFllbnZ1aUNvbHVtbiBleHRlbmRzIFllbnZ1aUJhc2Uge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0aXRsZVRleHQ6IHsgdHlwZTogU3RyaW5nIH0sXG4gICAgICAgIGludGVudENvbG9yOiB7IHR5cGU6IFN0cmluZyB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICBtaW4td2lkdGg6IDA7IFxuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpOyBcbiAgICAgICAgICAgIHBhZGRpbmc6IDEwcHg7IFxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4OyBcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IFxuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgXG4gICAgICAgICAgICBnYXA6IDEwcHg7IFxuICAgICAgICB9XG4gICAgICAgIC5oZWFkZXIgeyBcbiAgICAgICAgICAgIG1hcmdpbi10b3A6IDA7IFxuICAgICAgICAgICAgZm9udC1zaXplOiAxLjFyZW07IFxuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7IFxuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDsgXG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7IFxuICAgICAgICB9XG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNzAwcHgpIHtcbiAgICAgICAgICAgIDpob3N0IHsgXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7IFxuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDA7IFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLmhlYWRlciB7IFxuICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMS4ycmVtOyBcbiAgICAgICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTsgXG4gICAgICAgICAgICAgICAgcGFkZGluZy1ib3R0b206IDVweDsgXG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudGl0bGVUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMuaW50ZW50Q29sb3IgPSAnJztcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgICR7dGhpcy50aXRsZVRleHQgPyBodG1sYDxkaXYgY2xhc3M9XCJoZWFkZXJcIiBzdHlsZT1cImNvbG9yOiAke3RoaXMuaW50ZW50Q29sb3IgfHwgJ3ZhcigtLXRleHQsICNlMGUwZTApJ307XCI+JHt0aGlzLnRpdGxlVGV4dH08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY29sdW1uJywgWWVudnVpQ29sdW1uKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLFFBQUFBLEVBQU0sT0FBQUMsTUFBVyxNQUMxQixPQUFTLGNBQUFDLE1BQWtCLG1CQUVwQixhQUFNLG9CQUFvQkEsQ0FBVyxDQUN4QyxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFxQmhCLFFBQVMsQ0FDTCxPQUFPRCxnQkFDWCxDQUNKLENBQ0EsZUFBZSxPQUFPLGVBQWdCLFdBQVcsRUFDMUMsYUFBTSxxQkFBcUJFLENBQVcsQ0FDekMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsWUFBYSxDQUFFLEtBQU0sTUFBTyxDQUNoQyxFQUVBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssVUFBWSxHQUNqQixLQUFLLFlBQWMsRUFDdkIsQ0FDQSxRQUFTLENBQ0wsT0FBT0Q7QUFBQSxjQUNELEtBQUssVUFBWUEsc0NBQXlDLEtBQUssYUFBZSxzQkFBc0IsTUFBTSxLQUFLLFNBQVMsU0FBVyxFQUFFO0FBQUE7QUFBQSxTQUcvSSxDQUNKLENBQ0EsZUFBZSxPQUFPLGdCQUFpQixZQUFZIiwKICAibmFtZXMiOiBbImh0bWwiLCAiY3NzIiwgIlllbnZ1aUJhc2UiXQp9Cg==
