import{html as t,css as e}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiSelectionTray extends r{static properties={count:{type:Number},open:{type:Boolean,reflect:!0}};static styles=e`
        :host {
            position: fixed;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%) translateY(150%);
            z-index: 4000;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex;
            align-items: center;
            gap: 15px;
            background: var(--pane-bg, #1e1e1e);
            border: 1px solid var(--intent-highlight, #8b5cf6);
            padding: 10px 20px;
            border-radius: 50px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        :host([open]) {
            transform: translateX(-50%) translateY(0);
        }
        :host([data-theme="e-ink"]) {
            border: 2px solid #000;
            box-shadow: 4px 4px 0 #8b5cf6;
        }
        .count-badge {
            background: var(--intent-highlight, #8b5cf6);
            color: white;
            font-weight: bold;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
        }
        .actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .clear-btn {
            background: transparent;
            border: none;
            color: var(--text-muted, #888);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 4px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s, background 0.2s;
        }
        .clear-btn:hover { 
            color: var(--text, #fff); 
            background: var(--input-bg); 
        }
    `;constructor(){super(),this.count=0,this.open=!1}render(){return t`
            <div class="count-badge">${this.count}</div>
            <div class="actions"><slot name="batch-actions"></slot></div>
            <div style="width: 1px; height: 20px; background: var(--border);"></div>
            <button class="clear-btn" @click=${()=>this.dispatchEvent(new CustomEvent("yenvui-clear-selection",{bubbles:!0,composed:!0}))}>✕</button>
        `}}customElements.define("yenvui-selection-tray",YenvuiSelectionTray);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVNlbGVjdGlvblRyYXkgZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgY291bnQ6IHsgdHlwZTogTnVtYmVyIH0sXG4gICAgICAgIG9wZW46IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIGJvdHRvbTogMjVweDtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKSB0cmFuc2xhdGVZKDE1MCUpO1xuICAgICAgICAgICAgei1pbmRleDogNDAwMDtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjNzIGN1YmljLWJlemllcigwLjE3NSwgMC44ODUsIDAuMzIsIDEuMjc1KTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiAxNXB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1pbnRlbnQtaGlnaGxpZ2h0LCAjOGI1Y2Y2KTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDUwcHg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMzBweCByZ2JhKDAsMCwwLDAuNSk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW29wZW5dKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSkgdHJhbnNsYXRlWSgwKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMDAwO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogNHB4IDRweCAwICM4YjVjZjY7XG4gICAgICAgIH1cbiAgICAgICAgLmNvdW50LWJhZGdlIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpO1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICAgICAgICB3aWR0aDogMjhweDtcbiAgICAgICAgICAgIGhlaWdodDogMjhweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgfVxuICAgICAgICAuYWN0aW9ucyB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIC5jbGVhci1idG4ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDRweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBjb2xvciAwLjJzLCBiYWNrZ3JvdW5kIDAuMnM7XG4gICAgICAgIH1cbiAgICAgICAgLmNsZWFyLWJ0bjpob3ZlciB7IFxuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNmZmYpOyBcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTsgXG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7IFxuICAgICAgICBzdXBlcigpOyBcbiAgICAgICAgdGhpcy5jb3VudCA9IDA7IFxuICAgICAgICB0aGlzLm9wZW4gPSBmYWxzZTsgXG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY291bnQtYmFkZ2VcIj4ke3RoaXMuY291bnR9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uc1wiPjxzbG90IG5hbWU9XCJiYXRjaC1hY3Rpb25zXCI+PC9zbG90PjwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIndpZHRoOiAxcHg7IGhlaWdodDogMjBweDsgYmFja2dyb3VuZDogdmFyKC0tYm9yZGVyKTtcIj48L2Rpdj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJjbGVhci1idG5cIiBAY2xpY2s9JHsoKSA9PiB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY2xlYXItc2VsZWN0aW9uJywge2J1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlfSkpfT5cdTI3MTU8L2J1dHRvbj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1zZWxlY3Rpb24tdHJheScsIFllbnZ1aVNlbGVjdGlvblRyYXkpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsUUFBQUEsRUFBTSxPQUFBQyxNQUFXLE1BQzFCLE9BQVMsY0FBQUMsTUFBa0IsbUJBRXBCLGFBQU0sNEJBQTRCQSxDQUFXLENBQ2hELE9BQU8sV0FBYSxDQUNoQixNQUFPLENBQUUsS0FBTSxNQUFPLEVBQ3RCLEtBQU0sQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLENBQ3pDLEVBRUEsT0FBTyxPQUFTRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BNERoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssTUFBUSxFQUNiLEtBQUssS0FBTyxFQUNoQixDQUNBLFFBQVMsQ0FDTCxPQUFPRDtBQUFBLHVDQUN3QixLQUFLLEtBQUs7QUFBQTtBQUFBO0FBQUEsK0NBR0YsSUFBTSxLQUFLLGNBQWMsSUFBSSxZQUFZLHlCQUEwQixDQUFDLFFBQVMsR0FBTSxTQUFVLEVBQUksQ0FBQyxDQUFDLENBQUM7QUFBQSxTQUUvSSxDQUNKLENBQ0EsZUFBZSxPQUFPLHdCQUF5QixtQkFBbUIiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSJdCn0K
