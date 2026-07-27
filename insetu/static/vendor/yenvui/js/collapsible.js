import{LitElement as t,html as n,css as o}from"lit";export class YenvuiCollapsible extends t{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},intent:{type:String},flush:{type:Boolean,reflect:!0}};static styles=o`
        :host {
            display: block;
            border-bottom: 1px solid var(--border, #444);
            border-top: 1px solid var(--border, #444);
        }
        
        /* Prevent double borders when components are stacked adjacently */
        :host + :host {
            border-top: none;
        }

        .header {
            background: var(--input-bg, #2d2d2d);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }
        .header:hover {
            background: var(--bg-hover, var(--input-bg));
        }

        :host([open]) .header {
            border-bottom: 1px solid var(--border, #444);
        }

        .title {
            font-weight: var(--title-weight, bold);
            font-size: var(--title-size, 1rem);
            color: var(--text, #e0e0e0);
        }
        
        /* Semantic Intents */
        .intent-primary { color: var(--intent-primary, #3b82f6); }
        .intent-success { color: var(--intent-success, #10b981); }
        .intent-highlight { color: var(--intent-highlight, #8b5cf6); }
        .intent-warning { color: var(--intent-warning, #f59e0b); }
        .intent-danger { color: var(--intent-danger, #ef4444); }
        .intent-neutral { color: var(--text, #e0e0e0); }

        .chevron {
            font-size: 0.8rem;
            color: var(--text-muted, #888);
            transition: transform 0.2s ease;
        }

        :host([open]) .chevron {
            transform: rotate(90deg);
        }

        .content {
            display: none;
            padding: 20px;
            background: var(--bg, #121212);
        }

        :host([open]) .content {
            display: flex;
            flex-direction: column;
        }
        
        :host([flush]) .content {
            padding: 0;
        }
        
        /* High Contrast Theme Hooks */
        :host([data-theme="e-ink"]) {
            border-color: #000000;
        }
        :host([data-theme="e-ink"]) .header {
            background: var(--pane-bg);
        }
        :host([data-theme="e-ink"][open]) .header {
            border-bottom: 2px dashed #000000;
        }
        :host([data-theme="e-ink"]) .content {
            background: var(--pane-bg);
        }
    `;constructor(){super(),this.open=!0,this.intent="neutral",this.flush=!1}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}render(){return n`
            <div class="header" @click=${()=>{this.open=!this.open,this.dispatchEvent(new CustomEvent("yenvui-collapsible-toggled",{detail:{open:this.open},bubbles:!0,composed:!0}))}}>
                <span class="title intent-${this.intent}">${this.titleText}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <slot name="actions" @click=${e=>e.stopPropagation()}></slot>
                    <span class="chevron">▶</span>
                </div>
            </div>
            <div class="content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-collapsible",YenvuiCollapsible);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNvbGxhcHNpYmxlIGV4dGVuZHMgTGl0RWxlbWVudCB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGludGVudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcblxuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLyogUHJldmVudCBkb3VibGUgYm9yZGVycyB3aGVuIGNvbXBvbmVudHMgYXJlIHN0YWNrZWQgYWRqYWNlbnRseSAqL1xuICAgICAgICA6aG9zdCArIDpob3N0IHtcbiAgICAgICAgICAgIGJvcmRlci10b3A6IG5vbmU7XG4gICAgICAgIH1cblxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMjBweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnM7XG4gICAgICAgIH1cbiAgICAgICAgLmhlYWRlcjpob3ZlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy1ob3ZlciwgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtvcGVuXSkgLmhlYWRlciB7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC50aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogdmFyKC0tdGl0bGUtd2VpZ2h0LCBib2xkKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogdmFyKC0tdGl0bGUtc2l6ZSwgMXJlbSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8qIFNlbWFudGljIEludGVudHMgKi9cbiAgICAgICAgLmludGVudC1wcmltYXJ5IHsgY29sb3I6IHZhcigtLWludGVudC1wcmltYXJ5LCAjM2I4MmY2KTsgfVxuICAgICAgICAuaW50ZW50LXN1Y2Nlc3MgeyBjb2xvcjogdmFyKC0taW50ZW50LXN1Y2Nlc3MsICMxMGI5ODEpOyB9XG4gICAgICAgIC5pbnRlbnQtaGlnaGxpZ2h0IHsgY29sb3I6IHZhcigtLWludGVudC1oaWdobGlnaHQsICM4YjVjZjYpOyB9XG4gICAgICAgIC5pbnRlbnQtd2FybmluZyB7IGNvbG9yOiB2YXIoLS1pbnRlbnQtd2FybmluZywgI2Y1OWUwYik7IH1cbiAgICAgICAgLmludGVudC1kYW5nZXIgeyBjb2xvcjogdmFyKC0taW50ZW50LWRhbmdlciwgI2VmNDQ0NCk7IH1cbiAgICAgICAgLmludGVudC1uZXV0cmFsIHsgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApOyB9XG5cbiAgICAgICAgLmNoZXZyb24ge1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjhyZW07XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCwgIzg4OCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW29wZW5dKSAuY2hldnJvbiB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHJvdGF0ZSg5MGRlZyk7XG4gICAgICAgIH1cblxuICAgICAgICAuY29udGVudCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLCAjMTIxMjEyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtvcGVuXSkgLmNvbnRlbnQge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5jb250ZW50IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8qIEhpZ2ggQ29udHJhc3QgVGhlbWUgSG9va3MgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkge1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiAjMDAwMDAwO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5oZWFkZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZyk7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXVtvcGVuXSkgLmhlYWRlciB7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAycHggZGFzaGVkICMwMDAwMDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNvbnRlbnQge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZyk7XG4gICAgICAgIH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMub3BlbiA9IHRydWU7XG4gICAgICAgIHRoaXMuaW50ZW50ID0gJ25ldXRyYWwnO1xuICAgICAgICB0aGlzLmZsdXNoID0gZmFsc2U7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIiBAY2xpY2s9JHsoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5vcGVuID0gIXRoaXMub3BlbjtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY29sbGFwc2libGUtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiB7IG9wZW46IHRoaXMub3BlbiB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGl0bGUgaW50ZW50LSR7dGhpcy5pbnRlbnR9XCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTVweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImFjdGlvbnNcIiBAY2xpY2s9JHtlID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjaGV2cm9uXCI+XHUyNUI2PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudFwiPlxuICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNvbGxhcHNpYmxlJywgWWVudnVpQ29sbGFwc2libGUpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSwwQkFBMEJGLENBQVcsQ0FDOUMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsS0FBTSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDckMsT0FBUSxDQUFFLEtBQU0sTUFBTyxFQUN2QixNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW9GaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLEtBQU8sR0FDWixLQUFLLE9BQVMsVUFDZCxLQUFLLE1BQVEsRUFDakIsQ0FFQSxtQkFBb0IsQ0FDaEIsTUFBTSxrQkFBa0IsRUFDeEIsS0FBSyxlQUFpQixJQUFJLGlCQUFpQixJQUFNLENBQzdDLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBQUMsRUFDRCxLQUFLLGVBQWUsUUFBUSxTQUFTLEtBQU0sQ0FBRSxXQUFZLEdBQU0sZ0JBQWlCLENBQUMsWUFBWSxDQUFFLENBQUMsRUFDaEcsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FFQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDdkIsS0FBSyxnQkFBZ0IsS0FBSyxlQUFlLFdBQVcsQ0FDNUQsQ0FFQSxRQUFTLENBQ0wsT0FBT0Q7QUFBQSx5Q0FDMEIsSUFBTSxDQUMvQixLQUFLLEtBQU8sQ0FBQyxLQUFLLEtBQ2xCLEtBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxLQUFNLEtBQUssSUFBSyxFQUMxQixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQUM7QUFBQSw0Q0FDK0IsS0FBSyxNQUFNLEtBQUssS0FBSyxTQUFTO0FBQUE7QUFBQSxrREFFeEIsR0FBSyxFQUFFLGdCQUFnQixDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FRdEUsQ0FDSixDQUNBLGVBQWUsT0FBTyxxQkFBc0IsaUJBQWlCIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiXQp9Cg==
