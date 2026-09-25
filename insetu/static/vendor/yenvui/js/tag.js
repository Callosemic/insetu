import{html as t,css as r}from"lit";import{YenvuiBase as e}from"./yenvui-base.js";export class YenvuiTag extends e{static properties={text:{type:String},intent:{type:String}};static styles=r`
        :host { display: inline-flex; align-items: center; }
        .tag {
            background: var(--tag-bg, var(--input-bg, #2d2d2d));
            color: var(--tag-color, var(--text, #e0e0e0));
            border: 1px solid var(--tag-border, var(--border, #444));
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            line-height: 1;
            white-space: nowrap;
        }
        .intent-primary { --tag-bg: var(--intent-primary); --tag-color: #fff; --tag-border: var(--intent-primary); }
        .intent-success { --tag-bg: var(--intent-success); --tag-color: #fff; --tag-border: var(--intent-success); }
        .intent-danger { --tag-bg: var(--intent-danger); --tag-color: #fff; --tag-border: var(--intent-danger); }
        .intent-warning { --tag-bg: var(--intent-warning); --tag-color: #000; --tag-border: var(--intent-warning); }
        
        :host([data-theme="e-ink"]) .tag {
            background: #fff !important;
            color: #000 !important;
            border: 1px dashed #000 !important;
        }
        :host([data-theme="light"]) .tag {
            background: var(--tag-bg, #f1f5f9);
            border-color: var(--tag-border, #cbd5e1);
            color: var(--tag-color, #0f172a);
        }
    `;render(){return t`<span class="tag ${this.intent?"intent-"+this.intent:""}">${this.text}<slot></slot></span>`}}customElements.define("yenvui-tag",YenvuiTag);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aVRhZyBleHRlbmRzIFllbnZ1aUJhc2Uge1xuICAgIHN0YXRpYyBwcm9wZXJ0aWVzID0ge1xuICAgICAgICB0ZXh0OiB7IHR5cGU6IFN0cmluZyB9LFxuICAgICAgICBpbnRlbnQ6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBpbmxpbmUtZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgfVxuICAgICAgICAudGFnIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXRhZy1iZywgdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpKTtcbiAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10YWctY29sb3IsIHZhcigtLXRleHQsICNlMGUwZTApKTtcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLXRhZy1ib3JkZXIsIHZhcigtLWJvcmRlciwgIzQ0NCkpO1xuICAgICAgICAgICAgcGFkZGluZzogNHB4IDhweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMC43NXJlbTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgZ2FwOiA2cHg7XG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICAgIH1cbiAgICAgICAgLmludGVudC1wcmltYXJ5IHsgLS10YWctYmc6IHZhcigtLWludGVudC1wcmltYXJ5KTsgLS10YWctY29sb3I6ICNmZmY7IC0tdGFnLWJvcmRlcjogdmFyKC0taW50ZW50LXByaW1hcnkpOyB9XG4gICAgICAgIC5pbnRlbnQtc3VjY2VzcyB7IC0tdGFnLWJnOiB2YXIoLS1pbnRlbnQtc3VjY2Vzcyk7IC0tdGFnLWNvbG9yOiAjZmZmOyAtLXRhZy1ib3JkZXI6IHZhcigtLWludGVudC1zdWNjZXNzKTsgfVxuICAgICAgICAuaW50ZW50LWRhbmdlciB7IC0tdGFnLWJnOiB2YXIoLS1pbnRlbnQtZGFuZ2VyKTsgLS10YWctY29sb3I6ICNmZmY7IC0tdGFnLWJvcmRlcjogdmFyKC0taW50ZW50LWRhbmdlcik7IH1cbiAgICAgICAgLmludGVudC13YXJuaW5nIHsgLS10YWctYmc6IHZhcigtLWludGVudC13YXJuaW5nKTsgLS10YWctY29sb3I6ICMwMDA7IC0tdGFnLWJvcmRlcjogdmFyKC0taW50ZW50LXdhcm5pbmcpOyB9XG4gICAgICAgIFxuICAgICAgICA6aG9zdChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAudGFnIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmZmYgIWltcG9ydGFudDtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBkYXNoZWQgIzAwMCAhaW1wb3J0YW50O1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC50YWcge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tdGFnLWJnLCAjZjFmNWY5KTtcbiAgICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tdGFnLWJvcmRlciwgI2NiZDVlMSk7XG4gICAgICAgICAgICBjb2xvcjogdmFyKC0tdGFnLWNvbG9yLCAjMGYxNzJhKTtcbiAgICAgICAgfVxuICAgIGA7XG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gaHRtbGA8c3BhbiBjbGFzcz1cInRhZyAke3RoaXMuaW50ZW50ID8gJ2ludGVudC0nICsgdGhpcy5pbnRlbnQgOiAnJ31cIj4ke3RoaXMudGV4dH08c2xvdD48L3Nsb3Q+PC9zcGFuPmA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktdGFnJywgWWVudnVpVGFnKTsiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxPQUFTLFFBQUFBLEVBQU0sT0FBQUMsTUFBVyxNQUMxQixPQUFTLGNBQUFDLE1BQWtCLG1CQUVwQixhQUFNLGtCQUFrQkEsQ0FBVyxDQUN0QyxPQUFPLFdBQWEsQ0FDaEIsS0FBTSxDQUFFLEtBQU0sTUFBTyxFQUNyQixPQUFRLENBQUUsS0FBTSxNQUFPLENBQzNCLEVBRUEsT0FBTyxPQUFTRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZ0NoQixRQUFTLENBQ0wsT0FBT0QscUJBQXdCLEtBQUssT0FBUyxVQUFZLEtBQUssT0FBUyxFQUFFLEtBQUssS0FBSyxJQUFJLHNCQUMzRixDQUNKLENBQ0EsZUFBZSxPQUFPLGFBQWMsU0FBUyIsCiAgIm5hbWVzIjogWyJodG1sIiwgImNzcyIsICJZZW52dWlCYXNlIl0KfQo=
