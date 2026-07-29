import{css as t}from"lit";export const sharedStyles=t`
    /* Global Reset for Components */
    * { box-sizing: border-box; }

    /* Typography & Scrollbars */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--input-bg); border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; border: 2px solid var(--input-bg); }
    ::-webkit-scrollbar-thumb:hover { background: #888; }
    
    h1, h2, h3, h4, h5, h6 { color: var(--text); }

    /* Inputs */
    textarea, input[type="text"], select, input[type="number"], input[type="date"] {
        width: 100%;
        background: var(--input-bg);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 10px;
        font-family: var(--font-mono);
        line-height: 1.5;
        letter-spacing: 0.3px;
        box-sizing: border-box;
        outline: none;
    }
    textarea:focus, input:focus, select:focus {
        border-color: var(--btn);
    }

    /* Buttons */
    button {
        background: var(--btn);
        color: white;
        border: none;
        padding: 10px 20px;
        font-size: 16px;
        font-weight: bold;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
    }
    button:hover { background: var(--btn-hover); }
    .btn-sm {
        margin: 0;
        padding: 8px 14px;
        font-size: 14px;
    }

    /* Sub-Tabs (Inherited for Shadow DOM components) */
    .sub-tabs-bar { position: relative; display: flex; justify-content: space-between; align-items: center; background: var(--bg); z-index: 99; border-bottom: 1px solid var(--border); padding: 0 20px; height: 44px; box-sizing: border-box; }
    .sub-tabs-actions:empty { display: none !important; }
    .sub-tabs { display: flex; gap: 8px; margin: 0; padding: 0; overflow-x: auto; align-items: center; height: 100%; scrollbar-width: none; }
    .system-action-btn { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-weight: bold; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 1.1rem; transition: background 0.2s; margin: 0; box-sizing: border-box; }
    .system-action-btn:hover { background: var(--input-bg); }
    yenvui-dropdown { display: inline-flex; align-items: center; }
    .sub-tab { cursor: pointer; padding: 0 12px; font-size: 0.9rem; font-weight: bold; color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; display: flex; align-items: center; border-top: 2px solid transparent; border-bottom: 2px solid transparent; box-sizing: border-box; outline: none; }
    .sub-tab:hover { color: var(--text); }
    .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--btn); }

    :host-context([data-theme="e-ink"]) .sub-tab {
        transition: none !important;
    }
    :host-context([data-theme="e-ink"]) .sub-tab:hover {
        color: var(--text-muted);
    }
    :host-context([data-theme="e-ink"]) .sub-tab.active {
        color: var(--text) !important;
    }

    .sticky-header { position: relative; flex-shrink: 0; padding: 0; background: var(--bg); z-index: 10; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; }
    .toolbar-row { display: flex; align-items: center; gap: 10px; padding: 5px 20px; height: 44px; box-sizing: border-box; }
    
    @container (max-width: 50rem) {
        .toolbar-row { padding: 5px 10px; }
    }

    /* Utilities */
    .spinner {
        display: none;
        margin-top: 20px;
        font-style: italic;
        color: #888;
    }
    .folder-label {
        font-weight: bold;
        font-family: monospace;
        color: #facc15;
        font-size: 1.1rem;
    }

    /* Light Theme Overrides */
    :host-context([data-theme="light"]) h1, 
    :host-context([data-theme="light"]) h2, 
    :host-context([data-theme="light"]) h3, 
    :host-context([data-theme="light"]) h4, 
    :host-context([data-theme="light"]) h5, 
    :host-context([data-theme="light"]) h6 { 
        color: var(--text) !important;
    }
    :host-context([data-theme="light"]) textarea, 
    :host-context([data-theme="light"]) input,
    :host-context([data-theme="light"]) select {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
    }
    :host-context([data-theme="light"]) .folder-label {
        color: #b45309;
    }

    /* E-Ink Theme Overrides */
    :host-context([data-theme="e-ink"]) h1, 
    :host-context([data-theme="e-ink"]) h2, 
    :host-context([data-theme="e-ink"]) h3, 
    :host-context([data-theme="e-ink"]) h4, 
    :host-context([data-theme="e-ink"]) h5, 
    :host-context([data-theme="e-ink"]) h6,
    :host-context([data-theme="e-ink"]) .folder-label { 
        color: #000000 !important;
        font-weight: 900;
    }
    :host-context([data-theme="e-ink"]) button {
        background: #ffffff !important;
        color: #000000 !important;
        font-weight: 900 !important;
        border: 2px solid #ec4899 !important;
        box-shadow: 3px 3px 0 #eab308 !important;
    }
    :host-context([data-theme="e-ink"]) button:hover {
        background: #f1f5f9 !important;
    }
    :host-context([data-theme="e-ink"]) textarea, 
    :host-context([data-theme="e-ink"]) input, 
    :host-context([data-theme="e-ink"]) select {
        border: 2px solid #0ea5e9 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-weight: 600;
    }
`;
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gc3V0cmFtL2pzL3NoYXJlZF9zdHlsZXMuanNcbi8vIFB1cmUgQ1NTIEludGVudCBUb2tlbnMgJiBEdW1iIFByZXNlbnRhdGlvbiBQcmltaXRpdmVzXG5cbmltcG9ydCB7IGNzcyB9IGZyb20gJ2xpdCc7XG5cbmV4cG9ydCBjb25zdCBzaGFyZWRTdHlsZXMgPSBjc3NgXG4gICAgLyogR2xvYmFsIFJlc2V0IGZvciBDb21wb25lbnRzICovXG4gICAgKiB7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cblxuICAgIC8qIFR5cG9ncmFwaHkgJiBTY3JvbGxiYXJzICovXG4gICAgOjotd2Via2l0LXNjcm9sbGJhciB7IHdpZHRoOiAxMHB4OyBoZWlnaHQ6IDEwcHg7IH1cbiAgICA6Oi13ZWJraXQtc2Nyb2xsYmFyLXRyYWNrIHsgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpOyBib3JkZXItcmFkaXVzOiA0cHg7IH1cbiAgICA6Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iIHsgYmFja2dyb3VuZDogdmFyKC0tYm9yZGVyKTsgYm9yZGVyLXJhZGl1czogNHB4OyBib3JkZXI6IDJweCBzb2xpZCB2YXIoLS1pbnB1dC1iZyk7IH1cbiAgICA6Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iOmhvdmVyIHsgYmFja2dyb3VuZDogIzg4ODsgfVxuICAgIFxuICAgIGgxLCBoMiwgaDMsIGg0LCBoNSwgaDYgeyBjb2xvcjogdmFyKC0tdGV4dCk7IH1cblxuICAgIC8qIElucHV0cyAqL1xuICAgIHRleHRhcmVhLCBpbnB1dFt0eXBlPVwidGV4dFwiXSwgc2VsZWN0LCBpbnB1dFt0eXBlPVwibnVtYmVyXCJdLCBpbnB1dFt0eXBlPVwiZGF0ZVwiXSB7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7XG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KTtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTtcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuNTtcbiAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuM3B4O1xuICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICBvdXRsaW5lOiBub25lO1xuICAgIH1cbiAgICB0ZXh0YXJlYTpmb2N1cywgaW5wdXQ6Zm9jdXMsIHNlbGVjdDpmb2N1cyB7XG4gICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tYnRuKTtcbiAgICB9XG5cbiAgICAvKiBCdXR0b25zICovXG4gICAgYnV0dG9uIHtcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYnRuKTtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4ycztcbiAgICB9XG4gICAgYnV0dG9uOmhvdmVyIHsgYmFja2dyb3VuZDogdmFyKC0tYnRuLWhvdmVyKTsgfVxuICAgIC5idG4tc20ge1xuICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIHBhZGRpbmc6IDhweCAxNHB4O1xuICAgICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgfVxuXG4gICAgLyogU3ViLVRhYnMgKEluaGVyaXRlZCBmb3IgU2hhZG93IERPTSBjb21wb25lbnRzKSAqL1xuICAgIC5zdWItdGFicy1iYXIgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6IGNlbnRlcjsgYmFja2dyb3VuZDogdmFyKC0tYmcpOyB6LWluZGV4OiA5OTsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7IHBhZGRpbmc6IDAgMjBweDsgaGVpZ2h0OiA0NHB4OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgLnN1Yi10YWJzLWFjdGlvbnM6ZW1wdHkgeyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH1cbiAgICAuc3ViLXRhYnMgeyBkaXNwbGF5OiBmbGV4OyBnYXA6IDhweDsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyBvdmVyZmxvdy14OiBhdXRvOyBhbGlnbi1pdGVtczogY2VudGVyOyBoZWlnaHQ6IDEwMCU7IHNjcm9sbGJhci13aWR0aDogbm9uZTsgfVxuICAgIC5zeXN0ZW0tYWN0aW9uLWJ0biB7IGJhY2tncm91bmQ6IHRyYW5zcGFyZW50OyBjb2xvcjogdmFyKC0tdGV4dCk7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyOyBmb250LXdlaWdodDogYm9sZDsgd2lkdGg6IDM0cHg7IGhlaWdodDogMzRweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IHBhZGRpbmc6IDA7IGZvbnQtc2l6ZTogMS4xcmVtOyB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnM7IG1hcmdpbjogMDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfVxuICAgIC5zeXN0ZW0tYWN0aW9uLWJ0bjpob3ZlciB7IGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTsgfVxuICAgIHllbnZ1aS1kcm9wZG93biB7IGRpc3BsYXk6IGlubGluZS1mbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyB9XG4gICAgLnN1Yi10YWIgeyBjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDAgMTJweDsgZm9udC1zaXplOiAwLjlyZW07IGZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IHdoaXRlLXNwYWNlOiBub3dyYXA7IHRyYW5zaXRpb246IGFsbCAwLjJzOyBoZWlnaHQ6IDEwMCU7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGJvcmRlci10b3A6IDJweCBzb2xpZCB0cmFuc3BhcmVudDsgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkIHRyYW5zcGFyZW50OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyBvdXRsaW5lOiBub25lOyB9XG4gICAgLnN1Yi10YWI6aG92ZXIgeyBjb2xvcjogdmFyKC0tdGV4dCk7IH1cbiAgICAuc3ViLXRhYi5hY3RpdmUgeyBjb2xvcjogdmFyKC0tdGV4dCk7IGJvcmRlci1ib3R0b206IDJweCBzb2xpZCB2YXIoLS1idG4pOyB9XG5cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5zdWItdGFiIHtcbiAgICAgICAgdHJhbnNpdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5zdWItdGFiOmhvdmVyIHtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5zdWItdGFiLmFjdGl2ZSB7XG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KSAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIC5zdGlja3ktaGVhZGVyIHsgcG9zaXRpb246IHJlbGF0aXZlOyBmbGV4LXNocmluazogMDsgcGFkZGluZzogMDsgYmFja2dyb3VuZDogdmFyKC0tYmcpOyB6LWluZGV4OiAxMDsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IH1cbiAgICAudG9vbGJhci1yb3cgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEwcHg7IHBhZGRpbmc6IDVweCAyMHB4OyBoZWlnaHQ6IDQ0cHg7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cbiAgICBcbiAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDUwcmVtKSB7XG4gICAgICAgIC50b29sYmFyLXJvdyB7IHBhZGRpbmc6IDVweCAxMHB4OyB9XG4gICAgfVxuXG4gICAgLyogVXRpbGl0aWVzICovXG4gICAgLnNwaW5uZXIge1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICBtYXJnaW4tdG9wOiAyMHB4O1xuICAgICAgICBmb250LXN0eWxlOiBpdGFsaWM7XG4gICAgICAgIGNvbG9yOiAjODg4O1xuICAgIH1cbiAgICAuZm9sZGVyLWxhYmVsIHtcbiAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgIGZvbnQtZmFtaWx5OiBtb25vc3BhY2U7XG4gICAgICAgIGNvbG9yOiAjZmFjYzE1O1xuICAgICAgICBmb250LXNpemU6IDEuMXJlbTtcbiAgICB9XG5cbiAgICAvKiBMaWdodCBUaGVtZSBPdmVycmlkZXMgKi9cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGgxLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGgyLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGgzLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGg0LCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGg1LCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGg2IHsgXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KSAhaW1wb3J0YW50O1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIHRleHRhcmVhLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIGlucHV0LFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgc2VsZWN0IHtcbiAgICAgICAgYmFja2dyb3VuZDogI2YxZjVmOTtcbiAgICAgICAgY29sb3I6ICMwZjE3MmE7XG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkICNjYmQ1ZTE7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgLmZvbGRlci1sYWJlbCB7XG4gICAgICAgIGNvbG9yOiAjYjQ1MzA5O1xuICAgIH1cblxuICAgIC8qIEUtSW5rIFRoZW1lIE92ZXJyaWRlcyAqL1xuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaDEsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaDIsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaDMsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaDQsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaDUsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaDYsXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuZm9sZGVyLWxhYmVsIHsgXG4gICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA5MDA7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uIHtcbiAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICBmb250LXdlaWdodDogOTAwICFpbXBvcnRhbnQ7XG4gICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNlYzQ4OTkgIWltcG9ydGFudDtcbiAgICAgICAgYm94LXNoYWRvdzogM3B4IDNweCAwICNlYWIzMDggIWltcG9ydGFudDtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b246aG92ZXIge1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZjFmNWY5ICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgdGV4dGFyZWEsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgaW5wdXQsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgc2VsZWN0IHtcbiAgICAgICAgYm9yZGVyOiAycHggc29saWQgIzBlYTVlOSAhaW1wb3J0YW50O1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgfVxuYDsiXSwKICAibWFwcGluZ3MiOiAiQUFHQSxPQUFTLE9BQUFBLE1BQVcsTUFFYixhQUFNLGFBQWVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7IiwKICAibmFtZXMiOiBbImNzcyJdCn0K
