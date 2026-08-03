import{LitElement as a,html as e,css as n}from"lit";export class YenvuiSearchBar extends a{static properties={placeholder:{type:String},value:{type:String}};static styles=n`
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
    `;constructor(){super(),this.placeholder="Search...",this.value="",this._debounceTimer=null}connectedCallback(){super.connectedCallback(),this._themeObserver=new MutationObserver(()=>{this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark")}disconnectedCallback(){super.disconnectedCallback(),this._themeObserver&&this._themeObserver.disconnect(),this._debounceTimer&&clearTimeout(this._debounceTimer)}_handleInput(t){const r=t.target.value;this._debounceTimer&&clearTimeout(this._debounceTimer),this._debounceTimer=setTimeout(()=>{this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:r},bubbles:!0,composed:!0}))},250)}_handleClear(){this._debounceTimer&&clearTimeout(this._debounceTimer),this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:""},bubbles:!0,composed:!0}))}render(){return e`
            <div class="fuzzy-search-wrapper">
                <input type="text" .placeholder=${this.placeholder} .value=${this.value} @input=${this._handleInput}>
                ${this.value?e`<button class="fuzzy-search-clear" @click=${this._handleClear}>Clear</button>`:""}
            </div>
        `}}customElements.define("yenvui-search-bar",YenvuiSearchBar);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTGl0RWxlbWVudCwgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVNlYXJjaEJhciBleHRlbmRzIExpdEVsZW1lbnQge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICBwbGFjZWhvbGRlcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdmFsdWU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgfVxuICAgICAgICAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGhlaWdodDogMzRweDtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNjtcbiAgICAgICAgfVxuICAgICAgICAuZnV6enktc2VhcmNoLWNsZWFyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDJweCA4cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgICAgICB9XG4gICAgICAgIC8qIEhpZ2ggQ29udHJhc3QgVGhlbWVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC5mdXp6eS1zZWFyY2gtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGlucHV0IHtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHsgXG4gICAgICAgIHN1cGVyKCk7IFxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyID0gJ1NlYXJjaC4uLic7IFxuICAgICAgICB0aGlzLnZhbHVlID0gJyc7IFxuICAgICAgICB0aGlzLl9kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgZG9jdW1lbnQuYm9keS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKSB8fCAnZGFyaycpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdGhlbWVPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtdGhlbWUnXSB9KTtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCBkb2N1bWVudC5ib2R5LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpIHx8ICdkYXJrJyk7XG4gICAgfVxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5kaXNjb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5fdGhlbWVPYnNlcnZlcikgdGhpcy5fdGhlbWVPYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgIGlmICh0aGlzLl9kZWJvdW5jZVRpbWVyKSBjbGVhclRpbWVvdXQodGhpcy5fZGVib3VuY2VUaW1lcik7XG4gICAgfVxuICAgIF9oYW5kbGVJbnB1dChlKSB7XG4gICAgICAgIGNvbnN0IHZhbCA9IGUudGFyZ2V0LnZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX2RlYm91bmNlVGltZXIpO1xuXG4gICAgICAgIHRoaXMuX2RlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1zZWFyY2gtY2hhbmdlZCcsIHsgXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiB2YWwgfSwgXG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSwgXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0sIDI1MCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUNsZWFyKCkge1xuICAgICAgICBpZiAodGhpcy5fZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX2RlYm91bmNlVGltZXIpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktc2VhcmNoLWNoYW5nZWQnLCB7IFxuICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiAnJyB9LCBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZ1enp5LXNlYXJjaC13cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgLnBsYWNlaG9sZGVyPSR7dGhpcy5wbGFjZWhvbGRlcn0gLnZhbHVlPSR7dGhpcy52YWx1ZX0gQGlucHV0PSR7dGhpcy5faGFuZGxlSW5wdXR9PlxuICAgICAgICAgICAgICAgICR7dGhpcy52YWx1ZSA/IGh0bWxgPGJ1dHRvbiBjbGFzcz1cImZ1enp5LXNlYXJjaC1jbGVhclwiIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsZWFyfT5DbGVhcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLXNlYXJjaC1iYXInLCBZZW52dWlTZWFyY2hCYXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsY0FBQUEsRUFBWSxRQUFBQyxFQUFNLE9BQUFDLE1BQVcsTUFFL0IsYUFBTSx3QkFBd0JGLENBQVcsQ0FDNUMsT0FBTyxXQUFhLENBQ2hCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsTUFBTyxDQUFFLEtBQU0sTUFBTyxDQUMxQixFQUVBLE9BQU8sT0FBU0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXdEaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLFlBQWMsWUFDbkIsS0FBSyxNQUFRLEdBQ2IsS0FBSyxlQUFpQixJQUMxQixDQUVBLG1CQUFvQixDQUNoQixNQUFNLGtCQUFrQixFQUN4QixLQUFLLGVBQWlCLElBQUksaUJBQWlCLElBQU0sQ0FDN0MsS0FBSyxhQUFhLGFBQWMsU0FBUyxLQUFLLGFBQWEsWUFBWSxHQUFLLE1BQU0sQ0FDdEYsQ0FBQyxFQUNELEtBQUssZUFBZSxRQUFRLFNBQVMsS0FBTSxDQUFFLFdBQVksR0FBTSxnQkFBaUIsQ0FBQyxZQUFZLENBQUUsQ0FBQyxFQUNoRyxLQUFLLGFBQWEsYUFBYyxTQUFTLEtBQUssYUFBYSxZQUFZLEdBQUssTUFBTSxDQUN0RixDQUNBLHNCQUF1QixDQUNuQixNQUFNLHFCQUFxQixFQUN2QixLQUFLLGdCQUFnQixLQUFLLGVBQWUsV0FBVyxFQUNwRCxLQUFLLGdCQUFnQixhQUFhLEtBQUssY0FBYyxDQUM3RCxDQUNBLGFBQWFDLEVBQUcsQ0FDWixNQUFNQyxFQUFNRCxFQUFFLE9BQU8sTUFDakIsS0FBSyxnQkFBZ0IsYUFBYSxLQUFLLGNBQWMsRUFFekQsS0FBSyxlQUFpQixXQUFXLElBQU0sQ0FDbkMsS0FBSyxjQUFjLElBQUksWUFBWSx3QkFBeUIsQ0FDeEQsT0FBUSxDQUFFLE1BQU9DLENBQUksRUFDckIsUUFBUyxHQUNULFNBQVUsRUFDZCxDQUFDLENBQUMsQ0FDTixFQUFHLEdBQUcsQ0FDVixDQUVBLGNBQWUsQ0FDUCxLQUFLLGdCQUFnQixhQUFhLEtBQUssY0FBYyxFQUN6RCxLQUFLLGNBQWMsSUFBSSxZQUFZLHdCQUF5QixDQUN4RCxPQUFRLENBQUUsTUFBTyxFQUFHLEVBQ3BCLFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sQ0FFQSxRQUFTLENBQ0wsT0FBT0g7QUFBQTtBQUFBLGtEQUVtQyxLQUFLLFdBQVcsV0FBVyxLQUFLLEtBQUssV0FBVyxLQUFLLFlBQVk7QUFBQSxrQkFDakcsS0FBSyxNQUFRQSw4Q0FBaUQsS0FBSyxZQUFZLGtCQUFvQixFQUFFO0FBQUE7QUFBQSxTQUduSCxDQUNKLENBQ0EsZUFBZSxPQUFPLG9CQUFxQixlQUFlIiwKICAibmFtZXMiOiBbIkxpdEVsZW1lbnQiLCAiaHRtbCIsICJjc3MiLCAiZSIsICJ2YWwiXQp9Cg==
