import{LitElement as e,html as t,css as i}from"lit";export class YenvuiEmptyState extends e{static properties={icon:{type:String},text:{type:String}};static styles=i`
        :host { display: block; padding: 20px; }
        .empty-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-muted, #888);
            text-align: center;
            gap: 8px;
        }
        .icon {
            font-size: 2rem;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        .text {
            font-style: italic;
            font-size: 0.95rem;
        }
    `;render(){return t`
            <div class="empty-container">
                ${this.icon?t`<div class="icon">${this.icon}</div>`:""}
                <div class="text">${this.text||""}<slot></slot></div>
            </div>
        `}}customElements.define("yenvui-empty-state",YenvuiEmptyState);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUVtcHR5U3RhdGUgZXh0ZW5kcyBMaXRFbGVtZW50IHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgaWNvbjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdGV4dDogeyB0eXBlOiBTdHJpbmcgfVxuICAgIH07XG4gICAgXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgcGFkZGluZzogMjBweDsgfVxuICAgICAgICAuZW1wdHktY29udGFpbmVyIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmljb24ge1xuICAgICAgICAgICAgZm9udC1zaXplOiAycmVtO1xuICAgICAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogNXB4O1xuICAgICAgICB9XG4gICAgICAgIC50ZXh0IHtcbiAgICAgICAgICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45NXJlbTtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJlbXB0eS1jb250YWluZXJcIj5cbiAgICAgICAgICAgICAgICAke3RoaXMuaWNvbiA/IGh0bWxgPGRpdiBjbGFzcz1cImljb25cIj4ke3RoaXMuaWNvbn08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHRcIj4ke3RoaXMudGV4dCB8fCAnJ308c2xvdD48L3Nsb3Q+PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1lbXB0eS1zdGF0ZScsIFllbnZ1aUVtcHR5U3RhdGUpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSx5QkFBeUJGLENBQVcsQ0FDN0MsT0FBTyxXQUFhLENBQ2hCLEtBQU0sQ0FBRSxLQUFNLE1BQU8sRUFDckIsS0FBTSxDQUFFLEtBQU0sTUFBTyxDQUN6QixFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Bc0JoQixRQUFTLENBQ0wsT0FBT0Q7QUFBQTtBQUFBLGtCQUVHLEtBQUssS0FBT0Esc0JBQXlCLEtBQUssSUFBSSxTQUFXLEVBQUU7QUFBQSxvQ0FDekMsS0FBSyxNQUFRLEVBQUU7QUFBQTtBQUFBLFNBRy9DLENBQ0osQ0FDQSxlQUFlLE9BQU8scUJBQXNCLGdCQUFnQiIsCiAgIm5hbWVzIjogWyJMaXRFbGVtZW50IiwgImh0bWwiLCAiY3NzIl0KfQo=
