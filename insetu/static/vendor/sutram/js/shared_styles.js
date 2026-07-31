import{css as t}from"lit";export const sharedStyles=t`
    /* CodeMirror & Editor Engine Overrides */
    .cm-editor { height: 100%; }
    .cm-scroller { overflow: auto; font-family: var(--font-mono); }

    .CodeMirror-dialog {
        background: var(--input-bg) !important;
        color: var(--text) !important;
        border-bottom: 1px solid var(--border) !important;
        padding: 8px 10px !important;
    }
    .CodeMirror-dialog input {
        background: var(--bg) !important;
        color: var(--text) !important;
        border: 1px solid var(--border) !important;
        border-radius: 4px;
        padding: 4px 8px !important;
        font-family: var(--font-mono);
        outline: none;
    }
    .CodeMirror-dialog input:focus {
        border-color: var(--btn) !important;
    }
    .CodeMirror-search-match { background: #f59e0b; color: #000; }
    .CodeMirror-search-hint { color: #888; font-style: italic; }

    .EasyMDEContainer { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .EasyMDEContainer .CodeMirror {
        background: var(--input-bg);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 4px;
        font-family: var(--font-mono) !important;
        font-size: 13px;
        line-height: 1.5;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    .EasyMDEContainer .CodeMirror-scroll { flex: 1; min-height: 100%; }
    .EasyMDEContainer .CodeMirror .cm-header-1 { font-size: 1.25em; line-height: 1.3; }
    .EasyMDEContainer .CodeMirror .cm-header-2 { font-size: 1.15em; line-height: 1.3; }
    .EasyMDEContainer .CodeMirror .cm-header-3 { font-size: 1.05em; line-height: 1.3; }
    .EasyMDEContainer .CodeMirror .cm-header-4,
    .EasyMDEContainer .CodeMirror .cm-header-5,
    .EasyMDEContainer .CodeMirror .cm-header-6 { font-size: 1em; line-height: 1.3; }
    .editor-preview { background: var(--input-bg); color: var(--text); }

    /* Global Reset for Components */
    * { box-sizing: border-box; }

    /* Component-Specific Input Enhancements (Base resets inherited from yenVUI theme-tokens.css) */
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gc3V0cmFtL2pzL3NoYXJlZF9zdHlsZXMuanNcbi8vIFB1cmUgQ1NTIEludGVudCBUb2tlbnMgJiBEdW1iIFByZXNlbnRhdGlvbiBQcmltaXRpdmVzXG5cbmltcG9ydCB7IGNzcyB9IGZyb20gJ2xpdCc7XG5leHBvcnQgY29uc3Qgc2hhcmVkU3R5bGVzID0gY3NzYFxuICAgIC8qIENvZGVNaXJyb3IgJiBFZGl0b3IgRW5naW5lIE92ZXJyaWRlcyAqL1xuICAgIC5jbS1lZGl0b3IgeyBoZWlnaHQ6IDEwMCU7IH1cbiAgICAuY20tc2Nyb2xsZXIgeyBvdmVyZmxvdzogYXV0bzsgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubyk7IH1cblxuICAgIC5Db2RlTWlycm9yLWRpYWxvZyB7XG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKSAhaW1wb3J0YW50O1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCkgIWltcG9ydGFudDtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcikgIWltcG9ydGFudDtcbiAgICAgICAgcGFkZGluZzogOHB4IDEwcHggIWltcG9ydGFudDtcbiAgICB9XG4gICAgLkNvZGVNaXJyb3ItZGlhbG9nIGlucHV0IHtcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmcpICFpbXBvcnRhbnQ7XG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KSAhaW1wb3J0YW50O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpICFpbXBvcnRhbnQ7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgcGFkZGluZzogNHB4IDhweCAhaW1wb3J0YW50O1xuICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTtcbiAgICAgICAgb3V0bGluZTogbm9uZTtcbiAgICB9XG4gICAgLkNvZGVNaXJyb3ItZGlhbG9nIGlucHV0OmZvY3VzIHtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1idG4pICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIC5Db2RlTWlycm9yLXNlYXJjaC1tYXRjaCB7IGJhY2tncm91bmQ6ICNmNTllMGI7IGNvbG9yOiAjMDAwOyB9XG4gICAgLkNvZGVNaXJyb3Itc2VhcmNoLWhpbnQgeyBjb2xvcjogIzg4ODsgZm9udC1zdHlsZTogaXRhbGljOyB9XG5cbiAgICAuRWFzeU1ERUNvbnRhaW5lciB7IGZsZXg6IDE7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IG1pbi1oZWlnaHQ6IDA7IH1cbiAgICAuRWFzeU1ERUNvbnRhaW5lciAuQ29kZU1pcnJvciB7XG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8pICFpbXBvcnRhbnQ7XG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuNTtcbiAgICAgICAgZmxleDogMTtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICB9XG4gICAgLkVhc3lNREVDb250YWluZXIgLkNvZGVNaXJyb3Itc2Nyb2xsIHsgZmxleDogMTsgbWluLWhlaWdodDogMTAwJTsgfVxuICAgIC5FYXN5TURFQ29udGFpbmVyIC5Db2RlTWlycm9yIC5jbS1oZWFkZXItMSB7IGZvbnQtc2l6ZTogMS4yNWVtOyBsaW5lLWhlaWdodDogMS4zOyB9XG4gICAgLkVhc3lNREVDb250YWluZXIgLkNvZGVNaXJyb3IgLmNtLWhlYWRlci0yIHsgZm9udC1zaXplOiAxLjE1ZW07IGxpbmUtaGVpZ2h0OiAxLjM7IH1cbiAgICAuRWFzeU1ERUNvbnRhaW5lciAuQ29kZU1pcnJvciAuY20taGVhZGVyLTMgeyBmb250LXNpemU6IDEuMDVlbTsgbGluZS1oZWlnaHQ6IDEuMzsgfVxuICAgIC5FYXN5TURFQ29udGFpbmVyIC5Db2RlTWlycm9yIC5jbS1oZWFkZXItNCxcbiAgICAuRWFzeU1ERUNvbnRhaW5lciAuQ29kZU1pcnJvciAuY20taGVhZGVyLTUsXG4gICAgLkVhc3lNREVDb250YWluZXIgLkNvZGVNaXJyb3IgLmNtLWhlYWRlci02IHsgZm9udC1zaXplOiAxZW07IGxpbmUtaGVpZ2h0OiAxLjM7IH1cbiAgICAuZWRpdG9yLXByZXZpZXcgeyBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7IGNvbG9yOiB2YXIoLS10ZXh0KTsgfVxuXG4gICAgLyogR2xvYmFsIFJlc2V0IGZvciBDb21wb25lbnRzICovXG4gICAgKiB7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cblxuICAgIC8qIENvbXBvbmVudC1TcGVjaWZpYyBJbnB1dCBFbmhhbmNlbWVudHMgKEJhc2UgcmVzZXRzIGluaGVyaXRlZCBmcm9tIHllblZVSSB0aGVtZS10b2tlbnMuY3NzKSAqL1xuICAgIHRleHRhcmVhOmZvY3VzLCBpbnB1dDpmb2N1cywgc2VsZWN0OmZvY3VzIHtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1idG4pO1xuICAgIH1cblxuICAgIC8qIEJ1dHRvbnMgKi9cbiAgICBidXR0b24ge1xuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1idG4pO1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgcGFkZGluZzogMTBweCAyMHB4O1xuICAgICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjJzO1xuICAgIH1cbiAgICBidXR0b246aG92ZXIgeyBiYWNrZ3JvdW5kOiB2YXIoLS1idG4taG92ZXIpOyB9XG4gICAgLmJ0bi1zbSB7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgcGFkZGluZzogOHB4IDE0cHg7XG4gICAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICB9XG5cbiAgICAvKiBTdWItVGFicyAoSW5oZXJpdGVkIGZvciBTaGFkb3cgRE9NIGNvbXBvbmVudHMpICovXG4gICAgLnN1Yi10YWJzLWJhciB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogY2VudGVyOyBiYWNrZ3JvdW5kOiB2YXIoLS1iZyk7IHotaW5kZXg6IDk5OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTsgcGFkZGluZzogMCAyMHB4OyBoZWlnaHQ6IDQ0cHg7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cbiAgICAuc3ViLXRhYnMtYWN0aW9uczplbXB0eSB7IGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsgfVxuICAgIC5zdWItdGFicyB7IGRpc3BsYXk6IGZsZXg7IGdhcDogOHB4OyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IG92ZXJmbG93LXg6IGF1dG87IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGhlaWdodDogMTAwJTsgc2Nyb2xsYmFyLXdpZHRoOiBub25lOyB9XG4gICAgLnN5c3RlbS1hY3Rpb24tYnRuIHsgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7IGZvbnQtd2VpZ2h0OiBib2xkOyB3aWR0aDogMzRweDsgaGVpZ2h0OiAzNHB4OyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjsgcGFkZGluZzogMDsgZm9udC1zaXplOiAxLjFyZW07IHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4yczsgbWFyZ2luOiAwOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgLnN5c3RlbS1hY3Rpb24tYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogdmFyKC0taW5wdXQtYmcpOyB9XG4gICAgeWVudnVpLWRyb3Bkb3duIHsgZGlzcGxheTogaW5saW5lLWZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IH1cbiAgICAuc3ViLXRhYiB7IGN1cnNvcjogcG9pbnRlcjsgcGFkZGluZzogMCAxMnB4OyBmb250LXNpemU6IDAuOXJlbTsgZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgdHJhbnNpdGlvbjogYWxsIDAuMnM7IGhlaWdodDogMTAwJTsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgYm9yZGVyLXRvcDogMnB4IHNvbGlkIHRyYW5zcGFyZW50OyBib3JkZXItYm90dG9tOiAycHggc29saWQgdHJhbnNwYXJlbnQ7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IG91dGxpbmU6IG5vbmU7IH1cbiAgICAuc3ViLXRhYjpob3ZlciB7IGNvbG9yOiB2YXIoLS10ZXh0KTsgfVxuICAgIC5zdWItdGFiLmFjdGl2ZSB7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkIHZhcigtLWJ0bik7IH1cblxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnN1Yi10YWIge1xuICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnN1Yi10YWI6aG92ZXIge1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLnN1Yi10YWIuYWN0aXZlIHtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQpICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLnN0aWNreS1oZWFkZXIgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGZsZXgtc2hyaW5rOiAwOyBwYWRkaW5nOiAwOyBiYWNrZ3JvdW5kOiB2YXIoLS1iZyk7IHotaW5kZXg6IDEwOyBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTsgZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgfVxuICAgIC50b29sYmFyLXJvdyB7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTBweDsgcGFkZGluZzogNXB4IDIwcHg7IGhlaWdodDogNDRweDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfVxuICAgIFxuICAgIEBjb250YWluZXIgKG1heC13aWR0aDogNTByZW0pIHtcbiAgICAgICAgLnRvb2xiYXItcm93IHsgcGFkZGluZzogNXB4IDEwcHg7IH1cbiAgICB9XG5cbiAgICAvKiBVdGlsaXRpZXMgKi9cbiAgICAuc3Bpbm5lciB7XG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICAgIG1hcmdpbi10b3A6IDIwcHg7XG4gICAgICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgICAgICAgY29sb3I6ICM4ODg7XG4gICAgfVxuICAgIC5mb2xkZXItbGFiZWwge1xuICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgZm9udC1mYW1pbHk6IG1vbm9zcGFjZTtcbiAgICAgICAgY29sb3I6ICNmYWNjMTU7XG4gICAgICAgIGZvbnQtc2l6ZTogMS4xcmVtO1xuICAgIH1cblxuICAgIC8qIExpZ2h0IFRoZW1lIE92ZXJyaWRlcyAqL1xuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaDEsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaDIsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaDMsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaDQsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaDUsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaDYgeyBcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQpICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgdGV4dGFyZWEsIFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJsaWdodFwiXSkgaW5wdXQsXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBzZWxlY3Qge1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZjFmNWY5O1xuICAgICAgICBjb2xvcjogIzBmMTcyYTtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgI2NiZDVlMTtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSAuZm9sZGVyLWxhYmVsIHtcbiAgICAgICAgY29sb3I6ICNiNDUzMDk7XG4gICAgfVxuXG4gICAgLyogRS1JbmsgVGhlbWUgT3ZlcnJpZGVzICovXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBoMSwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBoMiwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBoMywgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBoNCwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBoNSwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBoNixcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIC5mb2xkZXItbGFiZWwgeyBcbiAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDkwMDtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBidXR0b24ge1xuICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmZmZmICFpbXBvcnRhbnQ7XG4gICAgICAgIGNvbG9yOiAjMDAwMDAwICFpbXBvcnRhbnQ7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA5MDAgIWltcG9ydGFudDtcbiAgICAgICAgYm9yZGVyOiAycHggc29saWQgI2VjNDg5OSAhaW1wb3J0YW50O1xuICAgICAgICBib3gtc2hhZG93OiAzcHggM3B4IDAgI2VhYjMwOCAhaW1wb3J0YW50O1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbjpob3ZlciB7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmMWY1ZjkgIWltcG9ydGFudDtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSB0ZXh0YXJlYSwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBpbnB1dCwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSBzZWxlY3Qge1xuICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjMGVhNWU5ICFpbXBvcnRhbnQ7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5gOyJdLAogICJtYXBwaW5ncyI6ICJBQUdBLE9BQVMsT0FBQUEsTUFBVyxNQUNiLGFBQU0sYUFBZUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7IiwKICAibmFtZXMiOiBbImNzcyJdCn0K
