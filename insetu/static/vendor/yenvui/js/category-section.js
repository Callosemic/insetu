import{html as t,css as e}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";export class YenvuiCategorySection extends o{static properties={titleText:{type:String}};static styles=e`
        :host {
            display: block;
        }
        .category-heading {
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--text, #e0e0e0);
            border-bottom: 1px solid var(--border, #444);
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        :host([data-theme="e-ink"]) .category-heading {
            color: #000000;
            border-bottom: 2px solid #000000;
        }
    `;render(){return t`
            <div class="category-heading">
                <span>${this.titleText}</span>
                <slot name="header-actions"></slot>
            </div>
            <div class="category-content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-category-section",YenvuiCategorySection);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUNhdGVnb3J5U2VjdGlvbiBleHRlbmRzIFllbnZ1aUJhc2Uge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0aXRsZVRleHQ6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3Qge1xuICAgICAgICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICAgIH1cbiAgICAgICAgLmNhdGVnb3J5LWhlYWRpbmcge1xuICAgICAgICAgICAgbWFyZ2luLXRvcDogMjVweDtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDE1cHg7XG4gICAgICAgICAgICBmb250LXNpemU6IDEuMnJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQsICNlMGUwZTApO1xuICAgICAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7XG4gICAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogNXB4O1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgOmhvc3QoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmNhdGVnb3J5LWhlYWRpbmcge1xuICAgICAgICAgICAgY29sb3I6ICMwMDAwMDA7XG4gICAgICAgICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgIzAwMDAwMDtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXRlZ29yeS1oZWFkaW5nXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4+JHt0aGlzLnRpdGxlVGV4dH08L3NwYW4+XG4gICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cImhlYWRlci1hY3Rpb25zXCI+PC9zbG90PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2F0ZWdvcnktY29udGVudFwiPlxuICAgICAgICAgICAgICAgIDxzbG90Pjwvc2xvdD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuICAgIH1cbn1cbmN1c3RvbUVsZW1lbnRzLmRlZmluZSgneWVudnVpLWNhdGVnb3J5LXNlY3Rpb24nLCBZZW52dWlDYXRlZ29yeVNlY3Rpb24pOyJdLAogICJtYXBwaW5ncyI6ICJBQUFBLE9BQVMsUUFBQUEsRUFBTSxPQUFBQyxNQUFXLE1BQzFCLE9BQVMsY0FBQUMsTUFBa0IsbUJBRXBCLGFBQU0sOEJBQThCQSxDQUFXLENBQ2xELE9BQU8sV0FBYSxDQUNoQixVQUFXLENBQUUsS0FBTSxNQUFPLENBQzlCLEVBRUEsT0FBTyxPQUFTRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFxQmhCLFFBQVMsQ0FDTCxPQUFPRDtBQUFBO0FBQUEsd0JBRVMsS0FBSyxTQUFTO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBT2xDLENBQ0osQ0FDQSxlQUFlLE9BQU8sMEJBQTJCLHFCQUFxQiIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIl0KfQo=
