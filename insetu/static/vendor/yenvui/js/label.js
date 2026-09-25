import{html as t,css as e}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";export class YenvuiLabel extends o{static properties={text:{type:String}};static styles=e`
        :host { display: inline-block; margin-bottom: 4px; }
        label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted, #888);
            font-family: var(--font-family, inherit);
            user-select: none;
        }
        :host([data-theme="e-ink"]) label {
            color: #000 !important;
            font-weight: 900 !important;
        }
    `;render(){return t`<label>${this.text}<slot></slot></label>`}}customElements.define("yenvui-label",YenvuiLabel);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aUxhYmVsIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIHRleHQ6IHsgdHlwZTogU3RyaW5nIH1cbiAgICB9O1xuXG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IG1hcmdpbi1ib3R0b206IDRweDsgfVxuICAgICAgICBsYWJlbCB7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuODVyZW07XG4gICAgICAgICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtZmFtaWx5LCBpbmhlcml0KTtcbiAgICAgICAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIDpob3N0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGxhYmVsIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIH1cbiAgICBgO1xuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgPGxhYmVsPiR7dGhpcy50ZXh0fTxzbG90Pjwvc2xvdD48L2xhYmVsPmA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktbGFiZWwnLCBZZW52dWlMYWJlbCk7Il0sCiAgIm1hcHBpbmdzIjogIkFBQUEsT0FBUyxRQUFBQSxFQUFNLE9BQUFDLE1BQVcsTUFDMUIsT0FBUyxjQUFBQyxNQUFrQixtQkFFcEIsYUFBTSxvQkFBb0JBLENBQVcsQ0FDeEMsT0FBTyxXQUFhLENBQ2hCLEtBQU0sQ0FBRSxLQUFNLE1BQU8sQ0FDekIsRUFFQSxPQUFPLE9BQVNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFjaEIsUUFBUyxDQUNMLE9BQU9ELFdBQWMsS0FBSyxJQUFJLHVCQUNsQyxDQUNKLENBQ0EsZUFBZSxPQUFPLGVBQWdCLFdBQVciLAogICJuYW1lcyI6IFsiaHRtbCIsICJjc3MiLCAiWWVudnVpQmFzZSJdCn0K
