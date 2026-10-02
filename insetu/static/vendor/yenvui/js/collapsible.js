import{html as e,css as r}from"lit";import{YenvuiBase as n}from"./yenvui-base.js";export class YenvuiCollapsible extends n{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},intent:{type:String},flush:{type:Boolean,reflect:!0}};static styles=r`
        :host {
            display: block;
            margin-bottom: 8px;
        }
        .header {
            background: var(--collapsible-header-bg, var(--input-bg));
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s ease, border-color 0.2s ease;
            border: 1px solid var(--border);
            border-left: 3px solid var(--intent-color, var(--intent-primary));
            border-radius: 6px;
            margin: 0 12px;
            box-sizing: border-box;
        }
        .header:hover {
            background: var(--bg-hover);
        }
        :host([open]) .header {
            background: color-mix(in srgb, var(--intent-color, var(--intent-primary)) var(--header-bg-mix, 10%), var(--input-bg));
            border-color: var(--border);
            border-left-color: var(--intent-color, var(--intent-primary));
        }
        :host([flush]) .header {
            border-radius: 0;
            border-left: none;
            border-right: none;
            margin: 0;
        }
        .title {
            font-weight: var(--title-weight, 700);
            font-size: var(--title-size, 0.85rem);
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text);
        }

        /* Semantic Intent Accents */
        :host([intent="primary"]) { --intent-color: var(--intent-primary); }
        :host([intent="success"]) { --intent-color: var(--intent-success); }
        :host([intent="highlight"]) { --intent-color: var(--intent-highlight); }
        :host([intent="warning"]) { --intent-color: var(--intent-warning); }
        :host([intent="danger"]) { --intent-color: var(--intent-danger); }
        :host([intent="neutral"]) { --intent-color: var(--intent-neutral); }

        .chevron {
            color: var(--text-muted);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            align-items: center;
        }

        :host([open]) .chevron {
            transform: rotate(180deg);
            color: var(--text);
        }

        .content {
            display: none;
            background: transparent;
        }

        :host([open]) .content {
            display: flex;
            flex-direction: column;
        }

        :host([flush]) .content {
            padding: 0;
        }

        @container (max-width: 480px) {
            :host { margin-bottom: 0; }
            .header {
                margin: 0;
                border-radius: 0;
                border-left: 3px solid var(--intent-color, var(--intent-primary));
                border-right: none;
                border-top: none;
                border-bottom: 1px solid var(--border);
            }
            .content { padding: 0; }
        }

        /* High Contrast Theme Hooks */
        :host([data-theme="e-ink"]) .header {
            border: 2px solid #000000;
            background: var(--pane-bg);
        }
        @container (max-width: 480px) {
            :host([data-theme="e-ink"]) .header {
                border-left: none;
                border-right: none;
                border-top: none;
                border-bottom: 2px dotted #000000;
            }
        }
    `;constructor(){super(),this.open=!0,this.intent="neutral",this.flush=!1}render(){return e`
            <div class="header" @click=${t=>{t.stopPropagation(),this.open=!this.open,this.dispatchEvent(new CustomEvent("yenvui-collapsible-toggled",{detail:{open:this.open},bubbles:!0,composed:!0}))}}>
                <span class="title intent-${this.intent}">${this.titleText}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <slot name="actions" @click=${t=>t.stopPropagation()}></slot>
                    <span class="chevron">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </span>
                </div>
            </div>
            <div class="content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-collapsible",YenvuiCollapsible);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNvbGxhcHNpYmxlIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGludGVudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgfVxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNvbGxhcHNpYmxlLWhlYWRlci1iZywgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnMgZWFzZSwgYm9yZGVyLWNvbG9yIDAuMnMgZWFzZTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIG1hcmdpbjogMCAxMnB4O1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAuaGVhZGVyOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbb3Blbl0pIC5oZWFkZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKSB2YXIoLS1oZWFkZXItYmctbWl4LCAxMCUpLCB2YXIoLS1pbnB1dC1iZykpO1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtY29sb3I6IHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZmx1c2hdKSAuaGVhZGVyIHtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDA7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgfVxuICAgICAgICAudGl0bGUge1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IHZhcigtLXRpdGxlLXdlaWdodCwgNzAwKTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogdmFyKC0tdGl0bGUtc2l6ZSwgMC44NXJlbSk7XG4gICAgICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTtcbiAgICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4wNGVtO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogU2VtYW50aWMgSW50ZW50IEFjY2VudHMgKi9cbiAgICAgICAgOmhvc3QoW2ludGVudD1cInByaW1hcnlcIl0pIHsgLS1pbnRlbnQtY29sb3I6IHZhcigtLWludGVudC1wcmltYXJ5KTsgfVxuICAgICAgICA6aG9zdChbaW50ZW50PVwic3VjY2Vzc1wiXSkgeyAtLWludGVudC1jb2xvcjogdmFyKC0taW50ZW50LXN1Y2Nlc3MpOyB9XG4gICAgICAgIDpob3N0KFtpbnRlbnQ9XCJoaWdobGlnaHRcIl0pIHsgLS1pbnRlbnQtY29sb3I6IHZhcigtLWludGVudC1oaWdobGlnaHQpOyB9XG4gICAgICAgIDpob3N0KFtpbnRlbnQ9XCJ3YXJuaW5nXCJdKSB7IC0taW50ZW50LWNvbG9yOiB2YXIoLS1pbnRlbnQtd2FybmluZyk7IH1cbiAgICAgICAgOmhvc3QoW2ludGVudD1cImRhbmdlclwiXSkgeyAtLWludGVudC1jb2xvcjogdmFyKC0taW50ZW50LWRhbmdlcik7IH1cbiAgICAgICAgOmhvc3QoW2ludGVudD1cIm5ldXRyYWxcIl0pIHsgLS1pbnRlbnQtY29sb3I6IHZhcigtLWludGVudC1uZXV0cmFsKTsgfVxuXG4gICAgICAgIC5jaGV2cm9uIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGN1YmljLWJlemllcigwLjE2LCAxLCAwLjMsIDEpO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbb3Blbl0pIC5jaGV2cm9uIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKDE4MGRlZyk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgIH1cblxuICAgICAgICAuY29udGVudCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbb3Blbl0pIC5jb250ZW50IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICB9XG5cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmNvbnRlbnQge1xuICAgICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNDgwcHgpIHtcbiAgICAgICAgICAgIDpob3N0IHsgbWFyZ2luLWJvdHRvbTogMDsgfVxuICAgICAgICAgICAgLmhlYWRlciB7XG4gICAgICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDA7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCB2YXIoLS1pbnRlbnQtY29sb3IsIHZhcigtLWludGVudC1wcmltYXJ5KSk7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgICAgIGJvcmRlci10b3A6IG5vbmU7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAuY29udGVudCB7IHBhZGRpbmc6IDA7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qIEhpZ2ggQ29udHJhc3QgVGhlbWUgSG9va3MgKi9cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmhlYWRlciB7XG4gICAgICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMDAwMDAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZyk7XG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmhlYWRlciB7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IG5vbmU7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xuICAgICAgICAgICAgICAgIGJvcmRlci10b3A6IG5vbmU7XG4gICAgICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMnB4IGRvdHRlZCAjMDAwMDAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgYDtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLm9wZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLmludGVudCA9ICduZXV0cmFsJztcbiAgICAgICAgdGhpcy5mbHVzaCA9IGZhbHNlO1xuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlclwiIEBjbGljaz0keyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICB0aGlzLm9wZW4gPSAhdGhpcy5vcGVuO1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1jb2xsYXBzaWJsZS10b2dnbGVkJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IHsgb3BlbjogdGhpcy5vcGVuIH0sXG4gICAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfX0+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0aXRsZSBpbnRlbnQtJHt0aGlzLmludGVudH1cIj4ke3RoaXMudGl0bGVUZXh0fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYWN0aW9uc1wiIEBjbGljaz0ke2UgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX0+PC9zbG90PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNoZXZyb25cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMTZcIiBoZWlnaHQ9XCIxNlwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48cG9seWxpbmUgcG9pbnRzPVwiNiA5IDEyIDE1IDE4IDlcIj48L3BvbHlsaW5lPjwvc3ZnPlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50XCI+XG4gICAgICAgICAgICAgICAgPHNsb3Q+PC9zbG90PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktY29sbGFwc2libGUnLCBZZW52dWlDb2xsYXBzaWJsZSk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSwwQkFBMEJBLENBQVcsQ0FDOUMsT0FBTyxXQUFhLENBQ2hCLFVBQVcsQ0FBRSxLQUFNLE1BQU8sRUFDMUIsS0FBTSxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssRUFDckMsT0FBUSxDQUFFLEtBQU0sTUFBTyxFQUN2QixNQUFPLENBQUUsS0FBTSxRQUFTLFFBQVMsRUFBSyxDQUMxQyxFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXlHaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLEtBQU8sR0FDWixLQUFLLE9BQVMsVUFDZCxLQUFLLE1BQVEsRUFDakIsQ0FDQSxRQUFTLENBQ0wsT0FBT0Q7QUFBQSx5Q0FDMkJHLEdBQU0sQ0FDaENBLEVBQUUsZ0JBQWdCLEVBQ2xCLEtBQUssS0FBTyxDQUFDLEtBQUssS0FDbEIsS0FBSyxjQUFjLElBQUksWUFBWSw2QkFBOEIsQ0FDN0QsT0FBUSxDQUFFLEtBQU0sS0FBSyxJQUFLLEVBQzFCLFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sQ0FBQztBQUFBLDRDQUMrQixLQUFLLE1BQU0sS0FBSyxLQUFLLFNBQVM7QUFBQTtBQUFBLGtEQUV4QkEsR0FBS0EsRUFBRSxnQkFBZ0IsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQVV0RSxDQUNKLENBQ0EsZUFBZSxPQUFPLHFCQUFzQixpQkFBaUIiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSIsICJlIl0KfQo=
