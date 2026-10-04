import{html as i,css as s}from"lit";import{YenvuiBase as l}from"./yenvui-base.js";import"./search-bar.js";import"./dropdown.js";export class YenvuiToolbar extends l{static properties={searchQuery:{type:String},searchPlaceholder:{type:String},enableFilterDropdown:{type:Boolean},filterText:{type:String},activeFilters:{type:Array},hasFiltersOverride:{type:Boolean},bottomBorder:{type:Boolean}};static styles=s`
        :host { display: contents; }
        .sticky-header {
            position: relative;
            flex-shrink: 0;
            padding: 0;
            background: var(--bg, #121212);
            z-index: 10;
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--border);
        }
        .toolbar-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 0 0 12px;
            height: 44px;
            box-sizing: border-box;
            background: var(--input-bg);
            border: none;
            border-radius: 0;
        }
        yenvui-filter-dropdown {
            height: 100%;
            display: flex;
            align-self: stretch;
        }
        .bottom-border { border-bottom: none; }
    `;constructor(){super(),this.searchQuery="",this.searchPlaceholder="Search...",this.enableFilterDropdown=!1,this.filterText="",this.activeFilters=[],this.hasFiltersOverride=!1,this.bottomBorder=!1}render(){let t=this.filterText,r=this.hasFiltersOverride||!1;if(!t&&this.activeFilters){const e=this.activeFilters.filter(o=>o!=="ALL");e.length>0?(t=`Filters: ${e.slice(0,2).join(", ")}${e.length>2?"...":""}`,r=!0):t="Filters"}return i`
            <div class="sticky-header">
                <div class="toolbar-row ${this.bottomBorder?"bottom-border":""}">
                    <yenvui-search-bar 
                        style="flex: 1;"
                        .placeholder=${this.searchPlaceholder} 
                        .value=${this.searchQuery} 
                        @yenvui-search-changed=${e=>this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:e.detail,bubbles:!0,composed:!0}))}>
                    </yenvui-search-bar>
                    ${this.enableFilterDropdown?i`
                        <yenvui-filter-dropdown filterText=${t} .hasFilters=${r}>
                            <slot name="filters"></slot>
                        </yenvui-filter-dropdown>
                    `:""}
                </div>
                <slot name="bottom-row"></slot>
            </div>
        `}}customElements.define("yenvui-toolbar",YenvuiToolbar);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmltcG9ydCAnLi9zZWFyY2gtYmFyLmpzJztcbmltcG9ydCAnLi9kcm9wZG93bi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBZZW52dWlUb29sYmFyIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHNlYXJjaFF1ZXJ5OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzZWFyY2hQbGFjZWhvbGRlcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZW5hYmxlRmlsdGVyRHJvcGRvd246IHsgdHlwZTogQm9vbGVhbiB9LFxuICAgICAgICBmaWx0ZXJUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBhY3RpdmVGaWx0ZXJzOiB7IHR5cGU6IEFycmF5IH0sXG4gICAgICAgIGhhc0ZpbHRlcnNPdmVycmlkZTogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIGJvdHRvbUJvcmRlcjogeyB0eXBlOiBCb29sZWFuIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgZGlzcGxheTogY29udGVudHM7IH1cbiAgICAgICAgLnN0aWNreS1oZWFkZXIge1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmcsICMxMjEyMTIpO1xuICAgICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICB9XG4gICAgICAgIC50b29sYmFyLXJvdyB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGdhcDogMTBweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDAgMCAwIDEycHg7XG4gICAgICAgICAgICBoZWlnaHQ6IDQ0cHg7XG4gICAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpO1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgICAgfVxuICAgICAgICB5ZW52dWktZmlsdGVyLWRyb3Bkb3duIHtcbiAgICAgICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICAgICAgICB9XG4gICAgICAgIC5ib3R0b20tYm9yZGVyIHsgYm9yZGVyLWJvdHRvbTogbm9uZTsgfVxuICAgIGA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zZWFyY2hRdWVyeSA9ICcnO1xuICAgICAgICB0aGlzLnNlYXJjaFBsYWNlaG9sZGVyID0gJ1NlYXJjaC4uLic7XG4gICAgICAgIHRoaXMuZW5hYmxlRmlsdGVyRHJvcGRvd24gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5maWx0ZXJUZXh0ID0gJyc7XG4gICAgICAgIHRoaXMuYWN0aXZlRmlsdGVycyA9IFtdO1xuICAgICAgICB0aGlzLmhhc0ZpbHRlcnNPdmVycmlkZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmJvdHRvbUJvcmRlciA9IGZhbHNlO1xuICAgIH1cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIGxldCBidG5UZXh0ID0gdGhpcy5maWx0ZXJUZXh0O1xuICAgICAgICBsZXQgaGFzRiA9IHRoaXMuaGFzRmlsdGVyc092ZXJyaWRlIHx8IGZhbHNlO1xuICAgICAgICBpZiAoIWJ0blRleHQgJiYgdGhpcy5hY3RpdmVGaWx0ZXJzKSB7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmUgPSB0aGlzLmFjdGl2ZUZpbHRlcnMuZmlsdGVyKHIgPT4gciAhPT0gJ0FMTCcpO1xuICAgICAgICAgICAgaWYgKGFjdGl2ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYnRuVGV4dCA9IGBGaWx0ZXJzOiAke2FjdGl2ZS5zbGljZSgwLCAyKS5qb2luKCcsICcpfSR7YWN0aXZlLmxlbmd0aCA+IDIgPyAnLi4uJyA6ICcnfWA7XG4gICAgICAgICAgICAgICAgaGFzRiA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ0blRleHQgPSAnRmlsdGVycyc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdGlja3ktaGVhZGVyXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRvb2xiYXItcm93ICR7dGhpcy5ib3R0b21Cb3JkZXIgPyAnYm90dG9tLWJvcmRlcicgOiAnJ31cIj5cbiAgICAgICAgICAgICAgICAgICAgPHllbnZ1aS1zZWFyY2gtYmFyIFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9XCJmbGV4OiAxO1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAucGxhY2Vob2xkZXI9JHt0aGlzLnNlYXJjaFBsYWNlaG9sZGVyfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIC52YWx1ZT0ke3RoaXMuc2VhcmNoUXVlcnl9IFxuICAgICAgICAgICAgICAgICAgICAgICAgQHllbnZ1aS1zZWFyY2gtY2hhbmdlZD0keyhlKSA9PiB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCd5ZW52dWktc2VhcmNoLWNoYW5nZWQnLCB7IGRldGFpbDogZS5kZXRhaWwsIGJ1YmJsZXM6IHRydWUsIGNvbXBvc2VkOiB0cnVlIH0pKX0+XG4gICAgICAgICAgICAgICAgICAgIDwveWVudnVpLXNlYXJjaC1iYXI+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5lbmFibGVGaWx0ZXJEcm9wZG93biA/IGh0bWxgXG4gICAgICAgICAgICAgICAgICAgICAgICA8eWVudnVpLWZpbHRlci1kcm9wZG93biBmaWx0ZXJUZXh0PSR7YnRuVGV4dH0gLmhhc0ZpbHRlcnM9JHtoYXNGfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiZmlsdGVyc1wiPjwvc2xvdD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwveWVudnVpLWZpbHRlci1kcm9wZG93bj5cbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxzbG90IG5hbWU9XCJib3R0b20tcm93XCI+PC9zbG90PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktdG9vbGJhcicsIFllbnZ1aVRvb2xiYXIpOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsUUFBQUEsRUFBTSxPQUFBQyxNQUFXLE1BQzFCLE9BQVMsY0FBQUMsTUFBa0IsbUJBQzNCLE1BQU8sa0JBQ1AsTUFBTyxnQkFFQSxhQUFNLHNCQUFzQkEsQ0FBVyxDQUMxQyxPQUFPLFdBQWEsQ0FDaEIsWUFBYSxDQUFFLEtBQU0sTUFBTyxFQUM1QixrQkFBbUIsQ0FBRSxLQUFNLE1BQU8sRUFDbEMscUJBQXNCLENBQUUsS0FBTSxPQUFRLEVBQ3RDLFdBQVksQ0FBRSxLQUFNLE1BQU8sRUFDM0IsY0FBZSxDQUFFLEtBQU0sS0FBTSxFQUM3QixtQkFBb0IsQ0FBRSxLQUFNLE9BQVEsRUFDcEMsYUFBYyxDQUFFLEtBQU0sT0FBUSxDQUNsQyxFQUNBLE9BQU8sT0FBU0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssWUFBYyxHQUNuQixLQUFLLGtCQUFvQixZQUN6QixLQUFLLHFCQUF1QixHQUM1QixLQUFLLFdBQWEsR0FDbEIsS0FBSyxjQUFnQixDQUFDLEVBQ3RCLEtBQUssbUJBQXFCLEdBQzFCLEtBQUssYUFBZSxFQUN4QixDQUNBLFFBQVMsQ0FDTCxJQUFJRSxFQUFVLEtBQUssV0FDZkMsRUFBTyxLQUFLLG9CQUFzQixHQUN0QyxHQUFJLENBQUNELEdBQVcsS0FBSyxjQUFlLENBQ2hDLE1BQU1FLEVBQVMsS0FBSyxjQUFjLE9BQU9DLEdBQUtBLElBQU0sS0FBSyxFQUNyREQsRUFBTyxPQUFTLEdBQ2hCRixFQUFVLFlBQVlFLEVBQU8sTUFBTSxFQUFHLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHQSxFQUFPLE9BQVMsRUFBSSxNQUFRLEVBQUUsR0FDcEZELEVBQU8sSUFFUEQsRUFBVSxTQUVsQixDQUVBLE9BQU9IO0FBQUE7QUFBQSwwQ0FFMkIsS0FBSyxhQUFlLGdCQUFrQixFQUFFO0FBQUE7QUFBQTtBQUFBLHVDQUczQyxLQUFLLGlCQUFpQjtBQUFBLGlDQUM1QixLQUFLLFdBQVc7QUFBQSxpREFDQyxHQUFNLEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQUUsT0FBUSxFQUFFLE9BQVEsUUFBUyxHQUFNLFNBQVUsRUFBSyxDQUFDLENBQUMsQ0FBQztBQUFBO0FBQUEsc0JBRW5KLEtBQUsscUJBQXVCQTtBQUFBLDZEQUNXRyxDQUFPLGdCQUFnQkMsQ0FBSTtBQUFBO0FBQUE7QUFBQSxzQkFHaEUsRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBS3RCLENBQ0osQ0FDQSxlQUFlLE9BQU8saUJBQWtCLGFBQWEiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSIsICJidG5UZXh0IiwgImhhc0YiLCAiYWN0aXZlIiwgInIiXQp9Cg==
