import{LitElement as r,html as e,css as a}from"lit";export class YenvuiSearchBar extends r{static properties={placeholder:{type:String},value:{type:String}};static styles=a`
        :host { display: block; }
        .fuzzy-search-wrapper {
            display: flex;
            align-items: center;
            background: transparent;
            border: none;
            border-radius: 4px;
            padding: 0;
            width: 100%;
            height: 34px;
            box-sizing: border-box;
        }
        input {
            flex: 1;
            border: none !important;
            background: transparent !important;
            outline: none;
            color: var(--text, #e0e0e0);
            padding: 0;
            margin: 0;
            height: 100%;
            font-size: 0.95rem;
            box-shadow: none !important;
            font-family: inherit;
        }
        input::placeholder {
            color: var(--text-muted, #888);
            opacity: 0.6;
        }
        .fuzzy-search-clear {
            background: var(--intent-neutral, #64748b);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.65rem;
            font-weight: bold;
            padding: 2px 8px;
            cursor: pointer;
            margin-left: 8px;
        }
        /* High Contrast Themes */
        :host([data-theme="light"]) .fuzzy-search-wrapper {
            background: transparent;
            border: none;
        }
        :host([data-theme="e-ink"]) .fuzzy-search-wrapper {
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
        }
        :host([data-theme="e-ink"]) input {
            border: none !important;
            box-shadow: none !important;
        }
    `;constructor(){super(),this.placeholder="Search...",this.value=""}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect()}_handleInput(t){this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:t.target.value},bubbles:!0,composed:!0}))}_handleClear(){this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:""},bubbles:!0,composed:!0}))}render(){return e`
            <div class="fuzzy-search-wrapper">
                <input type="text" .placeholder=${this.placeholder} .value=${this.value} @input=${this._handleInput}>
                ${this.value?e`<button class="fuzzy-search-clear" @click=${this._handleClear}>Clear</button>`:""}
            </div>
        `}}customElements.define("yenvui-search-bar",YenvuiSearchBar);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVNlYXJjaEJhciBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICBwbGFjZWhvbGRlcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdmFsdWU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgfVxuICAgICAgICAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGhlaWdodDogMzRweDtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNjtcbiAgICAgICAgfVxuICAgICAgICAuZnV6enktc2VhcmNoLWNsZWFyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDJweCA4cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgICAgICB9XG4gICAgICAgIC8qIEhpZ2ggQ29udHJhc3QgVGhlbWVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC5mdXp6eS1zZWFyY2gtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGlucHV0IHtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgYDtcblxuICAgIGNvbnN0cnVjdG9yKCkgeyBcbiAgICAgICAgc3VwZXIoKTsgXG4gICAgICAgIHRoaXMucGxhY2Vob2xkZXIgPSAnU2VhcmNoLi4uJzsgXG4gICAgICAgIHRoaXMudmFsdWUgPSAnJzsgXG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmNvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIGRvY3VtZW50LmJvZHkuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJykgfHwgJ2RhcmsnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3RoZW1lT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLXRoZW1lJ10gfSk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUlucHV0KGUpIHtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLXNlYXJjaC1jaGFuZ2VkJywgeyBcbiAgICAgICAgICAgIGRldGFpbDogeyB2YWx1ZTogZS50YXJnZXQudmFsdWUgfSwgXG4gICAgICAgICAgICBidWJibGVzOiB0cnVlLCBcbiAgICAgICAgICAgIGNvbXBvc2VkOiB0cnVlIFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUNsZWFyKCkge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktc2VhcmNoLWNoYW5nZWQnLCB7IFxuICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiAnJyB9LCBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZ1enp5LXNlYXJjaC13cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgLnBsYWNlaG9sZGVyPSR7dGhpcy5wbGFjZWhvbGRlcn0gLnZhbHVlPSR7dGhpcy52YWx1ZX0gQGlucHV0PSR7dGhpcy5faGFuZGxlSW5wdXR9PlxuICAgICAgICAgICAgICAgICR7dGhpcy52YWx1ZSA/IGh0bWxgPGJ1dHRvbiBjbGFzcz1cImZ1enp5LXNlYXJjaC1jbGVhclwiIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsZWFyfT5DbGVhcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLXNlYXJjaC1iYXInLCBZZW52dWlTZWFyY2hCYXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSx3QkFBd0JGLENBQVcsQ0FDNUMsT0FBTyxXQUFhLENBQ2hCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsTUFBTyxDQUFFLEtBQU0sTUFBTyxDQUMxQixFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXlEaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLFlBQWMsWUFDbkIsS0FBSyxNQUFRLEVBQ2pCLENBRUEsbUJBQW9CLENBQ2hCLE1BQU0sa0JBQWtCLEVBQ3hCLEtBQUssZUFBaUIsSUFBSSxpQkFBaUIsSUFBTSxDQUM3QyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUFDLEVBQ0QsS0FBSyxlQUFlLFFBQVEsU0FBUyxLQUFNLENBQUUsV0FBWSxHQUFNLGdCQUFpQixDQUFDLFlBQVksQ0FBRSxDQUFDLEVBQ2hHLEtBQUssYUFBYSxhQUFjLFNBQVMsS0FBSyxhQUFhLFlBQVksR0FBSyxNQUFNLENBQ3RGLENBRUEsc0JBQXVCLENBQ25CLE1BQU0scUJBQXFCLEVBQ3ZCLEtBQUssZ0JBQWdCLEtBQUssZUFBZSxXQUFXLENBQzVELENBRUEsYUFBYUMsRUFBRyxDQUNaLEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQ3hELE9BQVEsQ0FBRSxNQUFPQSxFQUFFLE9BQU8sS0FBTSxFQUNoQyxRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBRUEsY0FBZSxDQUNYLEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQ3hELE9BQVEsQ0FBRSxNQUFPLEVBQUcsRUFDcEIsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsQ0FDTixDQUVBLFFBQVMsQ0FDTCxPQUFPRjtBQUFBO0FBQUEsa0RBRW1DLEtBQUssV0FBVyxXQUFXLEtBQUssS0FBSyxXQUFXLEtBQUssWUFBWTtBQUFBLGtCQUNqRyxLQUFLLE1BQVFBLDhDQUFpRCxLQUFLLFlBQVksa0JBQW9CLEVBQUU7QUFBQTtBQUFBLFNBR25ILENBQ0osQ0FDQSxlQUFlLE9BQU8sb0JBQXFCLGVBQWUiLAogICJuYW1lcyI6IFsiTGl0RWxlbWVudCIsICJodG1sIiwgImNzcyIsICJlIl0KfQo=
