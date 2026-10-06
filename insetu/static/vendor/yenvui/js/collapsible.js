import{html as e,css as n}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiCollapsible extends r{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},intent:{type:String},flush:{type:Boolean,reflect:!0}};static styles=n`
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
            border-left: 4px solid var(--intent-color, var(--intent-primary));
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
            margin-bottom: 12px;
        }
        :host([flush]) .header {
            border-radius: 0;
            border-left: none;
            border-right: none;
            margin: 0;
        }
        :host([flush][open]) .header {
            margin-bottom: 12px;
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
            padding: 0 12px 12px 12px;
        }

        :host([flush]) .content {
            padding: 0;
        }
        @container (max-width: 480px) {
            :host { margin-bottom: 0; }
            .header {
                margin: 0;
                border-radius: 0;
                border-left: 4px solid var(--intent-color, var(--intent-primary));
                border-right: none;
                border-top: none;
                border-bottom: 1px solid var(--border);
            }
            :host([open]) .header, :host([flush][open]) .header {
                margin-bottom: 12px;
            }
            :host([open]) .content { padding: 0 0 12px 0; }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNvbGxhcHNpYmxlIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRpdGxlVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGludGVudDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZmx1c2g6IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgfVxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNvbGxhcHNpYmxlLWhlYWRlci1iZywgdmFyKC0taW5wdXQtYmcpKTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnMgZWFzZSwgYm9yZGVyLWNvbG9yIDAuMnMgZWFzZTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIG1hcmdpbjogMCAxMnB4O1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgICAuaGVhZGVyOmhvdmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLWhvdmVyKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbb3Blbl0pIC5oZWFkZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKSB2YXIoLS1oZWFkZXItYmctbWl4LCAxMCUpLCB2YXIoLS1pbnB1dC1iZykpO1xuICAgICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQtY29sb3I6IHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXSkgLmhlYWRlciB7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xuICAgICAgICAgICAgYm9yZGVyLWxlZnQ6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2ZsdXNoXVtvcGVuXSkgLmhlYWRlciB7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxMnB4O1xuICAgICAgICB9XG4gICAgICAgIC50aXRsZSB7XG4gICAgICAgICAgICBmb250LXdlaWdodDogdmFyKC0tdGl0bGUtd2VpZ2h0LCA3MDApO1xuICAgICAgICAgICAgZm9udC1zaXplOiB2YXIoLS10aXRsZS1zaXplLCAwLjg1cmVtKTtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8pO1xuICAgICAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcbiAgICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA0ZW07XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBTZW1hbnRpYyBJbnRlbnQgQWNjZW50cyAqL1xuICAgICAgICA6aG9zdChbaW50ZW50PVwicHJpbWFyeVwiXSkgeyAtLWludGVudC1jb2xvcjogdmFyKC0taW50ZW50LXByaW1hcnkpOyB9XG4gICAgICAgIDpob3N0KFtpbnRlbnQ9XCJzdWNjZXNzXCJdKSB7IC0taW50ZW50LWNvbG9yOiB2YXIoLS1pbnRlbnQtc3VjY2Vzcyk7IH1cbiAgICAgICAgOmhvc3QoW2ludGVudD1cImhpZ2hsaWdodFwiXSkgeyAtLWludGVudC1jb2xvcjogdmFyKC0taW50ZW50LWhpZ2hsaWdodCk7IH1cbiAgICAgICAgOmhvc3QoW2ludGVudD1cIndhcm5pbmdcIl0pIHsgLS1pbnRlbnQtY29sb3I6IHZhcigtLWludGVudC13YXJuaW5nKTsgfVxuICAgICAgICA6aG9zdChbaW50ZW50PVwiZGFuZ2VyXCJdKSB7IC0taW50ZW50LWNvbG9yOiB2YXIoLS1pbnRlbnQtZGFuZ2VyKTsgfVxuICAgICAgICA6aG9zdChbaW50ZW50PVwibmV1dHJhbFwiXSkgeyAtLWludGVudC1jb2xvcjogdmFyKC0taW50ZW50LW5ldXRyYWwpOyB9XG5cbiAgICAgICAgLmNoZXZyb24ge1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgY3ViaWMtYmV6aWVyKDAuMTYsIDEsIDAuMywgMSk7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtvcGVuXSkgLmNoZXZyb24ge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiByb3RhdGUoMTgwZGVnKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICAuY29udGVudCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICA6aG9zdChbb3Blbl0pIC5jb250ZW50IHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgICAgcGFkZGluZzogMCAxMnB4IDEycHggMTJweDtcbiAgICAgICAgfVxuXG4gICAgICAgIDpob3N0KFtmbHVzaF0pIC5jb250ZW50IHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgIH1cbiAgICAgICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgICAgICAgOmhvc3QgeyBtYXJnaW4tYm90dG9tOiAwOyB9XG4gICAgICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgICAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIHZhcigtLWludGVudC1jb2xvciwgdmFyKC0taW50ZW50LXByaW1hcnkpKTtcbiAgICAgICAgICAgICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XG4gICAgICAgICAgICAgICAgYm9yZGVyLXRvcDogbm9uZTtcbiAgICAgICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIDpob3N0KFtvcGVuXSkgLmhlYWRlciwgOmhvc3QoW2ZsdXNoXVtvcGVuXSkgLmhlYWRlciB7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIDpob3N0KFtvcGVuXSkgLmNvbnRlbnQgeyBwYWRkaW5nOiAwIDAgMTJweCAwOyB9XG4gICAgICAgIH1cblxuICAgICAgICAvKiBIaWdoIENvbnRyYXN0IFRoZW1lIEhvb2tzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5oZWFkZXIge1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzAwMDAwMDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXBhbmUtYmcpO1xuICAgICAgICB9XG4gICAgICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNDgwcHgpIHtcbiAgICAgICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5oZWFkZXIge1xuICAgICAgICAgICAgICAgIGJvcmRlci1sZWZ0OiBub25lO1xuICAgICAgICAgICAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcbiAgICAgICAgICAgICAgICBib3JkZXItdG9wOiBub25lO1xuICAgICAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDJweCBkb3R0ZWQgIzAwMDAwMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIGA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5vcGVuID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5pbnRlbnQgPSAnbmV1dHJhbCc7XG4gICAgICAgIHRoaXMuZmx1c2ggPSBmYWxzZTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIiBAY2xpY2s9JHsoZSkgPT4ge1xuICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5vcGVuID0gIXRoaXMub3BlbjtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktY29sbGFwc2libGUtdG9nZ2xlZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiB7IG9wZW46IHRoaXMub3BlbiB9LFxuICAgICAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb21wb3NlZDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGl0bGUgaW50ZW50LSR7dGhpcy5pbnRlbnR9XCI+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTVweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImFjdGlvbnNcIiBAY2xpY2s9JHtlID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9Pjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjaGV2cm9uXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE2XCIgaGVpZ2h0PVwiMTZcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBvbHlsaW5lIHBvaW50cz1cIjYgOSAxMiAxNSAxOCA5XCI+PC9wb2x5bGluZT48L3N2Zz5cbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudFwiPlxuICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNvbGxhcHNpYmxlJywgWWVudnVpQ29sbGFwc2libGUpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsUUFBQUEsRUFBTSxPQUFBQyxNQUFXLE1BQzFCLE9BQVMsY0FBQUMsTUFBa0IsbUJBRXBCLGFBQU0sMEJBQTBCQSxDQUFXLENBQzlDLE9BQU8sV0FBYSxDQUNoQixVQUFXLENBQUUsS0FBTSxNQUFPLEVBQzFCLEtBQU0sQ0FBRSxLQUFNLFFBQVMsUUFBUyxFQUFLLEVBQ3JDLE9BQVEsQ0FBRSxLQUFNLE1BQU8sRUFDdkIsTUFBTyxDQUFFLEtBQU0sUUFBUyxRQUFTLEVBQUssQ0FDMUMsRUFDQSxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErR2hCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxLQUFPLEdBQ1osS0FBSyxPQUFTLFVBQ2QsS0FBSyxNQUFRLEVBQ2pCLENBQ0EsUUFBUyxDQUNMLE9BQU9EO0FBQUEseUNBQzJCRyxHQUFNLENBQ2hDQSxFQUFFLGdCQUFnQixFQUNsQixLQUFLLEtBQU8sQ0FBQyxLQUFLLEtBQ2xCLEtBQUssY0FBYyxJQUFJLFlBQVksNkJBQThCLENBQzdELE9BQVEsQ0FBRSxLQUFNLEtBQUssSUFBSyxFQUMxQixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQUM7QUFBQSw0Q0FDK0IsS0FBSyxNQUFNLEtBQUssS0FBSyxTQUFTO0FBQUE7QUFBQSxrREFFeEJBLEdBQUtBLEVBQUUsZ0JBQWdCLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FVdEUsQ0FDSixDQUNBLGVBQWUsT0FBTyxxQkFBc0IsaUJBQWlCIiwKICAibmFtZXMiOiBbImh0bWwiLCAiY3NzIiwgIlllbnZ1aUJhc2UiLCAiZSJdCn0K
