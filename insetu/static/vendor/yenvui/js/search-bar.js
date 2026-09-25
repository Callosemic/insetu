import{html as e,css as n}from"lit";import{YenvuiBase as a}from"./yenvui-base.js";export class YenvuiSearchBar extends a{static properties={placeholder:{type:String},value:{type:String}};static styles=n`
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
    `;constructor(){super(),this.placeholder="Search...",this.value="",this._debounceTimer=null}disconnectedCallback(){super.disconnectedCallback(),this._debounceTimer&&clearTimeout(this._debounceTimer)}_handleInput(t){const r=t.target.value;this._debounceTimer&&clearTimeout(this._debounceTimer),this._debounceTimer=setTimeout(()=>{this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:r},bubbles:!0,composed:!0}))},250)}_handleClear(){this._debounceTimer&&clearTimeout(this._debounceTimer),this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:""},bubbles:!0,composed:!0}))}render(){return e`
            <div class="fuzzy-search-wrapper">
                <input type="text" .placeholder=${this.placeholder} .value=${this.value} @input=${this._handleInput}>
                ${this.value?e`<button class="fuzzy-search-clear" @click=${this._handleClear}>Clear</button>`:""}
            </div>
        `}}customElements.define("yenvui-search-bar",YenvuiSearchBar);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVNlYXJjaEJhciBleHRlbmRzIFllbnZ1aUJhc2Uge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICBwbGFjZWhvbGRlcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdmFsdWU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgfVxuICAgICAgICAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGhlaWdodDogMzRweDtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNjtcbiAgICAgICAgfVxuICAgICAgICAuZnV6enktc2VhcmNoLWNsZWFyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDJweCA4cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgICAgICB9XG4gICAgICAgIC8qIEhpZ2ggQ29udHJhc3QgVGhlbWVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC5mdXp6eS1zZWFyY2gtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGlucHV0IHtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHsgXG4gICAgICAgIHN1cGVyKCk7IFxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyID0gJ1NlYXJjaC4uLic7IFxuICAgICAgICB0aGlzLnZhbHVlID0gJyc7IFxuICAgICAgICB0aGlzLl9kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl9kZWJvdW5jZVRpbWVyKSBjbGVhclRpbWVvdXQodGhpcy5fZGVib3VuY2VUaW1lcik7XG4gICAgfVxuICAgIF9oYW5kbGVJbnB1dChlKSB7XG4gICAgICAgIGNvbnN0IHZhbCA9IGUudGFyZ2V0LnZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX2RlYm91bmNlVGltZXIpO1xuXG4gICAgICAgIHRoaXMuX2RlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1zZWFyY2gtY2hhbmdlZCcsIHsgXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiB2YWwgfSwgXG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSwgXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0sIDI1MCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUNsZWFyKCkge1xuICAgICAgICBpZiAodGhpcy5fZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX2RlYm91bmNlVGltZXIpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktc2VhcmNoLWNoYW5nZWQnLCB7IFxuICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiAnJyB9LCBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiBodG1sYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZ1enp5LXNlYXJjaC13cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgLnBsYWNlaG9sZGVyPSR7dGhpcy5wbGFjZWhvbGRlcn0gLnZhbHVlPSR7dGhpcy52YWx1ZX0gQGlucHV0PSR7dGhpcy5faGFuZGxlSW5wdXR9PlxuICAgICAgICAgICAgICAgICR7dGhpcy52YWx1ZSA/IGh0bWxgPGJ1dHRvbiBjbGFzcz1cImZ1enp5LXNlYXJjaC1jbGVhclwiIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsZWFyfT5DbGVhcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLXNlYXJjaC1iYXInLCBZZW52dWlTZWFyY2hCYXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsUUFBQUEsRUFBTSxPQUFBQyxNQUFXLE1BQzFCLE9BQVMsY0FBQUMsTUFBa0IsbUJBRXBCLGFBQU0sd0JBQXdCQSxDQUFXLENBQzVDLE9BQU8sV0FBYSxDQUNoQixZQUFhLENBQUUsS0FBTSxNQUFPLEVBQzVCLE1BQU8sQ0FBRSxLQUFNLE1BQU8sQ0FDMUIsRUFFQSxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUF3RGhCLGFBQWMsQ0FDVixNQUFNLEVBQ04sS0FBSyxZQUFjLFlBQ25CLEtBQUssTUFBUSxHQUNiLEtBQUssZUFBaUIsSUFDMUIsQ0FDQSxzQkFBdUIsQ0FDbkIsTUFBTSxxQkFBcUIsRUFDdkIsS0FBSyxnQkFBZ0IsYUFBYSxLQUFLLGNBQWMsQ0FDN0QsQ0FDQSxhQUFhRSxFQUFHLENBQ1osTUFBTUMsRUFBTUQsRUFBRSxPQUFPLE1BQ2pCLEtBQUssZ0JBQWdCLGFBQWEsS0FBSyxjQUFjLEVBRXpELEtBQUssZUFBaUIsV0FBVyxJQUFNLENBQ25DLEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQ3hELE9BQVEsQ0FBRSxNQUFPQyxDQUFJLEVBQ3JCLFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sRUFBRyxHQUFHLENBQ1YsQ0FFQSxjQUFlLENBQ1AsS0FBSyxnQkFBZ0IsYUFBYSxLQUFLLGNBQWMsRUFDekQsS0FBSyxjQUFjLElBQUksWUFBWSx3QkFBeUIsQ0FDeEQsT0FBUSxDQUFFLE1BQU8sRUFBRyxFQUNwQixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBRUEsUUFBUyxDQUNMLE9BQU9KO0FBQUE7QUFBQSxrREFFbUMsS0FBSyxXQUFXLFdBQVcsS0FBSyxLQUFLLFdBQVcsS0FBSyxZQUFZO0FBQUEsa0JBQ2pHLEtBQUssTUFBUUEsOENBQWlELEtBQUssWUFBWSxrQkFBb0IsRUFBRTtBQUFBO0FBQUEsU0FHbkgsQ0FDSixDQUNBLGVBQWUsT0FBTyxvQkFBcUIsZUFBZSIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIiwgImUiLCAidmFsIl0KfQo=
