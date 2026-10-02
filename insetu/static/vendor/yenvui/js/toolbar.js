import{html as i,css as s}from"lit";import{YenvuiBase as l}from"./yenvui-base.js";import"./search-bar.js";import"./dropdown.js";export class YenvuiToolbar extends l{static properties={searchQuery:{type:String},searchPlaceholder:{type:String},enableFilterDropdown:{type:Boolean},filterText:{type:String},activeFilters:{type:Array},hasFiltersOverride:{type:Boolean},bottomBorder:{type:Boolean}};static styles=s`
        :host { display: contents; }
        .sticky-header {
            position: relative;
            flex-shrink: 0;
            padding: 0;
            margin-bottom: 12px;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcbmltcG9ydCAnLi9zZWFyY2gtYmFyLmpzJztcbmltcG9ydCAnLi9kcm9wZG93bi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBZZW52dWlUb29sYmFyIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHNlYXJjaFF1ZXJ5OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBzZWFyY2hQbGFjZWhvbGRlcjogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgZW5hYmxlRmlsdGVyRHJvcGRvd246IHsgdHlwZTogQm9vbGVhbiB9LFxuICAgICAgICBmaWx0ZXJUZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBhY3RpdmVGaWx0ZXJzOiB7IHR5cGU6IEFycmF5IH0sXG4gICAgICAgIGhhc0ZpbHRlcnNPdmVycmlkZTogeyB0eXBlOiBCb29sZWFuIH0sXG4gICAgICAgIGJvdHRvbUJvcmRlcjogeyB0eXBlOiBCb29sZWFuIH1cbiAgICB9O1xuICAgIHN0YXRpYyBzdHlsZXMgPSBjc3NgXG4gICAgICAgIDpob3N0IHsgZGlzcGxheTogY29udGVudHM7IH1cbiAgICAgICAgLnN0aWNreS1oZWFkZXIge1xuICAgICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLCAjMTIxMjEyKTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgfVxuICAgICAgICAudG9vbGJhci1yb3cge1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgICBwYWRkaW5nOiAwIDAgMCAxMnB4O1xuICAgICAgICAgICAgaGVpZ2h0OiA0NHB4O1xuICAgICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDA7XG4gICAgICAgIH1cbiAgICAgICAgeWVudnVpLWZpbHRlci1kcm9wZG93biB7XG4gICAgICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgICAgICAgfVxuICAgICAgICAuYm90dG9tLWJvcmRlciB7IGJvcmRlci1ib3R0b206IG5vbmU7IH1cbiAgICBgO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc2VhcmNoUXVlcnkgPSAnJztcbiAgICAgICAgdGhpcy5zZWFyY2hQbGFjZWhvbGRlciA9ICdTZWFyY2guLi4nO1xuICAgICAgICB0aGlzLmVuYWJsZUZpbHRlckRyb3Bkb3duID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZmlsdGVyVGV4dCA9ICcnO1xuICAgICAgICB0aGlzLmFjdGl2ZUZpbHRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5oYXNGaWx0ZXJzT3ZlcnJpZGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5ib3R0b21Cb3JkZXIgPSBmYWxzZTtcbiAgICB9XG4gICAgcmVuZGVyKCkge1xuICAgICAgICBsZXQgYnRuVGV4dCA9IHRoaXMuZmlsdGVyVGV4dDtcbiAgICAgICAgbGV0IGhhc0YgPSB0aGlzLmhhc0ZpbHRlcnNPdmVycmlkZSB8fCBmYWxzZTtcbiAgICAgICAgaWYgKCFidG5UZXh0ICYmIHRoaXMuYWN0aXZlRmlsdGVycykge1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlID0gdGhpcy5hY3RpdmVGaWx0ZXJzLmZpbHRlcihyID0+IHIgIT09ICdBTEwnKTtcbiAgICAgICAgICAgIGlmIChhY3RpdmUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGJ0blRleHQgPSBgRmlsdGVyczogJHthY3RpdmUuc2xpY2UoMCwgMikuam9pbignLCAnKX0ke2FjdGl2ZS5sZW5ndGggPiAyID8gJy4uLicgOiAnJ31gO1xuICAgICAgICAgICAgICAgIGhhc0YgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBidG5UZXh0ID0gJ0ZpbHRlcnMnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3RpY2t5LWhlYWRlclwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b29sYmFyLXJvdyAke3RoaXMuYm90dG9tQm9yZGVyID8gJ2JvdHRvbS1ib3JkZXInIDogJyd9XCI+XG4gICAgICAgICAgICAgICAgICAgIDx5ZW52dWktc2VhcmNoLWJhciBcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPVwiZmxleDogMTtcIlxuICAgICAgICAgICAgICAgICAgICAgICAgLnBsYWNlaG9sZGVyPSR7dGhpcy5zZWFyY2hQbGFjZWhvbGRlcn0gXG4gICAgICAgICAgICAgICAgICAgICAgICAudmFsdWU9JHt0aGlzLnNlYXJjaFF1ZXJ5fSBcbiAgICAgICAgICAgICAgICAgICAgICAgIEB5ZW52dWktc2VhcmNoLWNoYW5nZWQ9JHsoZSkgPT4gdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgneWVudnVpLXNlYXJjaC1jaGFuZ2VkJywgeyBkZXRhaWw6IGUuZGV0YWlsLCBidWJibGVzOiB0cnVlLCBjb21wb3NlZDogdHJ1ZSB9KSl9PlxuICAgICAgICAgICAgICAgICAgICA8L3llbnZ1aS1zZWFyY2gtYmFyPlxuICAgICAgICAgICAgICAgICAgICAke3RoaXMuZW5hYmxlRmlsdGVyRHJvcGRvd24gPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICAgICAgPHllbnZ1aS1maWx0ZXItZHJvcGRvd24gZmlsdGVyVGV4dD0ke2J0blRleHR9IC5oYXNGaWx0ZXJzPSR7aGFzRn0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImZpbHRlcnNcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3llbnZ1aS1maWx0ZXItZHJvcGRvd24+XG4gICAgICAgICAgICAgICAgICAgIGAgOiAnJ31cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8c2xvdCBuYW1lPVwiYm90dG9tLXJvd1wiPjwvc2xvdD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLXRvb2xiYXInLCBZZW52dWlUb29sYmFyKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLFFBQUFBLEVBQU0sT0FBQUMsTUFBVyxNQUMxQixPQUFTLGNBQUFDLE1BQWtCLG1CQUMzQixNQUFPLGtCQUNQLE1BQU8sZ0JBRUEsYUFBTSxzQkFBc0JBLENBQVcsQ0FDMUMsT0FBTyxXQUFhLENBQ2hCLFlBQWEsQ0FBRSxLQUFNLE1BQU8sRUFDNUIsa0JBQW1CLENBQUUsS0FBTSxNQUFPLEVBQ2xDLHFCQUFzQixDQUFFLEtBQU0sT0FBUSxFQUN0QyxXQUFZLENBQUUsS0FBTSxNQUFPLEVBQzNCLGNBQWUsQ0FBRSxLQUFNLEtBQU0sRUFDN0IsbUJBQW9CLENBQUUsS0FBTSxPQUFRLEVBQ3BDLGFBQWMsQ0FBRSxLQUFNLE9BQVEsQ0FDbEMsRUFDQSxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZ0NoQixhQUFjLENBQ1YsTUFBTSxFQUNOLEtBQUssWUFBYyxHQUNuQixLQUFLLGtCQUFvQixZQUN6QixLQUFLLHFCQUF1QixHQUM1QixLQUFLLFdBQWEsR0FDbEIsS0FBSyxjQUFnQixDQUFDLEVBQ3RCLEtBQUssbUJBQXFCLEdBQzFCLEtBQUssYUFBZSxFQUN4QixDQUNBLFFBQVMsQ0FDTCxJQUFJRSxFQUFVLEtBQUssV0FDZkMsRUFBTyxLQUFLLG9CQUFzQixHQUN0QyxHQUFJLENBQUNELEdBQVcsS0FBSyxjQUFlLENBQ2hDLE1BQU1FLEVBQVMsS0FBSyxjQUFjLE9BQU9DLEdBQUtBLElBQU0sS0FBSyxFQUNyREQsRUFBTyxPQUFTLEdBQ2hCRixFQUFVLFlBQVlFLEVBQU8sTUFBTSxFQUFHLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHQSxFQUFPLE9BQVMsRUFBSSxNQUFRLEVBQUUsR0FDcEZELEVBQU8sSUFFUEQsRUFBVSxTQUVsQixDQUVBLE9BQU9IO0FBQUE7QUFBQSwwQ0FFMkIsS0FBSyxhQUFlLGdCQUFrQixFQUFFO0FBQUE7QUFBQTtBQUFBLHVDQUczQyxLQUFLLGlCQUFpQjtBQUFBLGlDQUM1QixLQUFLLFdBQVc7QUFBQSxpREFDQyxHQUFNLEtBQUssY0FBYyxJQUFJLFlBQVksd0JBQXlCLENBQUUsT0FBUSxFQUFFLE9BQVEsUUFBUyxHQUFNLFNBQVUsRUFBSyxDQUFDLENBQUMsQ0FBQztBQUFBO0FBQUEsc0JBRW5KLEtBQUsscUJBQXVCQTtBQUFBLDZEQUNXRyxDQUFPLGdCQUFnQkMsQ0FBSTtBQUFBO0FBQUE7QUFBQSxzQkFHaEUsRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBS3RCLENBQ0osQ0FDQSxlQUFlLE9BQU8saUJBQWtCLGFBQWEiLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSIsICJidG5UZXh0IiwgImhhc0YiLCAiYWN0aXZlIiwgInIiXQp9Cg==
