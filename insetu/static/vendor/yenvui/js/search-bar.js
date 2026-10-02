import{html as t,css as a}from"lit";import{YenvuiBase as i}from"./yenvui-base.js";export class YenvuiSearchBar extends i{static properties={placeholder:{type:String},value:{type:String}};static styles=a`
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
    `;constructor(){super(),this.placeholder="Search...",this.value="",this._debounceTimer=null}disconnectedCallback(){super.disconnectedCallback(),this._debounceTimer&&clearTimeout(this._debounceTimer)}_handleInput(e){const r=e.target.value;this._debounceTimer&&clearTimeout(this._debounceTimer),this._debounceTimer=setTimeout(()=>{this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:r},bubbles:!0,composed:!0}))},250)}_handleClear(){this._debounceTimer&&clearTimeout(this._debounceTimer),this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:""},bubbles:!0,composed:!0}))}render(){return t`
            <div class="fuzzy-search-wrapper">
                <i data-lucide="search" stroke-width="2.5" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: 8px; flex-shrink: 0;"></i>
                <input type="text" .placeholder=${this.placeholder} .value=${this.value} @input=${this._handleInput}>
                ${this.value?t`<button class="fuzzy-search-clear" @click=${this._handleClear}>Clear</button>`:""}
            </div>
        `}updated(e){super.updated(e),window.lucide&&typeof window.lucide.createIcons=="function"&&window.lucide.createIcons({root:this.shadowRoot})}}customElements.define("yenvui-search-bar",YenvuiSearchBar);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVNlYXJjaEJhciBleHRlbmRzIFllbnZ1aUJhc2Uge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICBwbGFjZWhvbGRlcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgdmFsdWU6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgfVxuICAgICAgICAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGhlaWdodDogMzRweDtcbiAgICAgICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQge1xuICAgICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcbiAgICAgICAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCwgI2UwZTBlMCk7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgICAgZm9udC1zaXplOiAwLjk1cmVtO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkLCAjODg4KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDAuNjtcbiAgICAgICAgfVxuICAgICAgICAuZnV6enktc2VhcmNoLWNsZWFyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWludGVudC1uZXV0cmFsLCAjNjQ3NDhiKTtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuNjVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDJweCA4cHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgICAgICB9XG4gICAgICAgIC8qIEhpZ2ggQ29udHJhc3QgVGhlbWVzICovXG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC5mdXp6eS1zZWFyY2gtd3JhcHBlciB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuZnV6enktc2VhcmNoLXdyYXBwZXIge1xuICAgICAgICAgICAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGlucHV0IHtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgYDtcbiAgICBjb25zdHJ1Y3RvcigpIHsgXG4gICAgICAgIHN1cGVyKCk7IFxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyID0gJ1NlYXJjaC4uLic7IFxuICAgICAgICB0aGlzLnZhbHVlID0gJyc7IFxuICAgICAgICB0aGlzLl9kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHN1cGVyLmRpc2Nvbm5lY3RlZENhbGxiYWNrKCk7XG4gICAgICAgIGlmICh0aGlzLl9kZWJvdW5jZVRpbWVyKSBjbGVhclRpbWVvdXQodGhpcy5fZGVib3VuY2VUaW1lcik7XG4gICAgfVxuICAgIF9oYW5kbGVJbnB1dChlKSB7XG4gICAgICAgIGNvbnN0IHZhbCA9IGUudGFyZ2V0LnZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX2RlYm91bmNlVGltZXIpO1xuXG4gICAgICAgIHRoaXMuX2RlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ3llbnZ1aS1zZWFyY2gtY2hhbmdlZCcsIHsgXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiB2YWwgfSwgXG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSwgXG4gICAgICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0sIDI1MCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZUNsZWFyKCkge1xuICAgICAgICBpZiAodGhpcy5fZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX2RlYm91bmNlVGltZXIpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktc2VhcmNoLWNoYW5nZWQnLCB7IFxuICAgICAgICAgICAgZGV0YWlsOiB7IHZhbHVlOiAnJyB9LCBcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsIFxuICAgICAgICAgICAgY29tcG9zZWQ6IHRydWUgXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmdXp6eS1zZWFyY2gtd3JhcHBlclwiPlxuICAgICAgICAgICAgICAgIDxpIGRhdGEtbHVjaWRlPVwic2VhcmNoXCIgc3Ryb2tlLXdpZHRoPVwiMi41XCIgc3R5bGU9XCJ3aWR0aDogMTRweDsgaGVpZ2h0OiAxNHB4OyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IG1hcmdpbi1yaWdodDogOHB4OyBmbGV4LXNocmluazogMDtcIj48L2k+XG4gICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgLnBsYWNlaG9sZGVyPSR7dGhpcy5wbGFjZWhvbGRlcn0gLnZhbHVlPSR7dGhpcy52YWx1ZX0gQGlucHV0PSR7dGhpcy5faGFuZGxlSW5wdXR9PlxuICAgICAgICAgICAgICAgICR7dGhpcy52YWx1ZSA/IGh0bWxgPGJ1dHRvbiBjbGFzcz1cImZ1enp5LXNlYXJjaC1jbGVhclwiIEBjbGljaz0ke3RoaXMuX2hhbmRsZUNsZWFyfT5DbGVhcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cblxuICAgIHVwZGF0ZWQoY2hhbmdlZFByb3BlcnRpZXMpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlZChjaGFuZ2VkUHJvcGVydGllcyk7XG4gICAgICAgIGlmICh3aW5kb3cubHVjaWRlICYmIHR5cGVvZiB3aW5kb3cubHVjaWRlLmNyZWF0ZUljb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB3aW5kb3cubHVjaWRlLmNyZWF0ZUljb25zKHsgcm9vdDogdGhpcy5zaGFkb3dSb290IH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktc2VhcmNoLWJhcicsIFllbnZ1aVNlYXJjaEJhcik7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSx3QkFBd0JBLENBQVcsQ0FDNUMsT0FBTyxXQUFhLENBQ2hCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsTUFBTyxDQUFFLEtBQU0sTUFBTyxDQUMxQixFQUVBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXdEaEIsYUFBYyxDQUNWLE1BQU0sRUFDTixLQUFLLFlBQWMsWUFDbkIsS0FBSyxNQUFRLEdBQ2IsS0FBSyxlQUFpQixJQUMxQixDQUNBLHNCQUF1QixDQUNuQixNQUFNLHFCQUFxQixFQUN2QixLQUFLLGdCQUFnQixhQUFhLEtBQUssY0FBYyxDQUM3RCxDQUNBLGFBQWEsRUFBRyxDQUNaLE1BQU1FLEVBQU0sRUFBRSxPQUFPLE1BQ2pCLEtBQUssZ0JBQWdCLGFBQWEsS0FBSyxjQUFjLEVBRXpELEtBQUssZUFBaUIsV0FBVyxJQUFNLENBQ25DLEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQ3hELE9BQVEsQ0FBRSxNQUFPQSxDQUFJLEVBQ3JCLFFBQVMsR0FDVCxTQUFVLEVBQ2QsQ0FBQyxDQUFDLENBQ04sRUFBRyxHQUFHLENBQ1YsQ0FFQSxjQUFlLENBQ1AsS0FBSyxnQkFBZ0IsYUFBYSxLQUFLLGNBQWMsRUFDekQsS0FBSyxjQUFjLElBQUksWUFBWSx3QkFBeUIsQ0FDeEQsT0FBUSxDQUFFLE1BQU8sRUFBRyxFQUNwQixRQUFTLEdBQ1QsU0FBVSxFQUNkLENBQUMsQ0FBQyxDQUNOLENBQ0EsUUFBUyxDQUNMLE9BQU9IO0FBQUE7QUFBQTtBQUFBLGtEQUdtQyxLQUFLLFdBQVcsV0FBVyxLQUFLLEtBQUssV0FBVyxLQUFLLFlBQVk7QUFBQSxrQkFDakcsS0FBSyxNQUFRQSw4Q0FBaUQsS0FBSyxZQUFZLGtCQUFvQixFQUFFO0FBQUE7QUFBQSxTQUduSCxDQUVBLFFBQVFJLEVBQW1CLENBQ3ZCLE1BQU0sUUFBUUEsQ0FBaUIsRUFDM0IsT0FBTyxRQUFVLE9BQU8sT0FBTyxPQUFPLGFBQWdCLFlBQ3RELE9BQU8sT0FBTyxZQUFZLENBQUUsS0FBTSxLQUFLLFVBQVcsQ0FBQyxDQUUzRCxDQUNKLENBQ0EsZUFBZSxPQUFPLG9CQUFxQixlQUFlIiwKICAibmFtZXMiOiBbImh0bWwiLCAiY3NzIiwgIlllbnZ1aUJhc2UiLCAidmFsIiwgImNoYW5nZWRQcm9wZXJ0aWVzIl0KfQo=
