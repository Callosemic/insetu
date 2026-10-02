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
    .sub-tabs-bar { position: relative; display: flex; justify-content: space-between; align-items: center; background: var(--bg); z-index: 99; border-bottom: 1px solid var(--border); padding: 0 12px; height: 36px; box-sizing: border-box; }
    .sub-tabs-actions:empty { display: none !important; }
    .sub-tabs { display: flex; gap: 2px; margin: 0; padding: 0; overflow-x: auto; align-items: center; height: 100%; scrollbar-width: none; }
    .system-action-btn, .masthead-action-rail-cell {
        width: 44px !important;
        height: auto !important;
        align-self: stretch !important;
        flex-shrink: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        border-left: 1px solid var(--border) !important;
        background: var(--rail-bg, rgba(255,255,255,0.02)) !important;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        color: var(--text-muted) !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box;
    }
    .system-action-btn:hover, .masthead-action-rail-cell:hover {
        background: var(--rail-hover, rgba(99, 102, 241, 0.22)) !important;
        color: var(--text) !important;
    }
    /* Ensure any icons inside these buttons inherit the forced text color */
    .system-action-btn i, .system-action-btn svg, .masthead-action-rail-cell i, .masthead-action-rail-cell svg {
        color: currentColor !important;
    }
    yenvui-dropdown { display: inline-flex; align-items: center; height: 100%; }
    .sub-tab { cursor: pointer; padding: 0 10px; margin-right: 0; font-size: 0.9rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; display: flex; align-items: center; border-bottom: 2px solid transparent; box-sizing: border-box; outline: none; }
    .sub-tab:hover { color: var(--text); }
    .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--intent-primary); }

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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gc3V0cmFtL2pzL3NoYXJlZF9zdHlsZXMuanNcbi8vIFB1cmUgQ1NTIEludGVudCBUb2tlbnMgJiBEdW1iIFByZXNlbnRhdGlvbiBQcmltaXRpdmVzXG5cbmltcG9ydCB7IGNzcyB9IGZyb20gJ2xpdCc7XG5leHBvcnQgY29uc3Qgc2hhcmVkU3R5bGVzID0gY3NzYFxuICAgIC8qIENvZGVNaXJyb3IgJiBFZGl0b3IgRW5naW5lIE92ZXJyaWRlcyAqL1xuICAgIC5jbS1lZGl0b3IgeyBoZWlnaHQ6IDEwMCU7IH1cbiAgICAuY20tc2Nyb2xsZXIgeyBvdmVyZmxvdzogYXV0bzsgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubyk7IH1cblxuICAgIC5Db2RlTWlycm9yLWRpYWxvZyB7XG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKSAhaW1wb3J0YW50O1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCkgIWltcG9ydGFudDtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcikgIWltcG9ydGFudDtcbiAgICAgICAgcGFkZGluZzogOHB4IDEwcHggIWltcG9ydGFudDtcbiAgICB9XG4gICAgLkNvZGVNaXJyb3ItZGlhbG9nIGlucHV0IHtcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmcpICFpbXBvcnRhbnQ7XG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0KSAhaW1wb3J0YW50O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpICFpbXBvcnRhbnQ7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgcGFkZGluZzogNHB4IDhweCAhaW1wb3J0YW50O1xuICAgICAgICBmb250LWZhbWlseTogdmFyKC0tZm9udC1tb25vKTtcbiAgICAgICAgb3V0bGluZTogbm9uZTtcbiAgICB9XG4gICAgLkNvZGVNaXJyb3ItZGlhbG9nIGlucHV0OmZvY3VzIHtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1idG4pICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIC5Db2RlTWlycm9yLXNlYXJjaC1tYXRjaCB7IGJhY2tncm91bmQ6ICNmNTllMGI7IGNvbG9yOiAjMDAwOyB9XG4gICAgLkNvZGVNaXJyb3Itc2VhcmNoLWhpbnQgeyBjb2xvcjogIzg4ODsgZm9udC1zdHlsZTogaXRhbGljOyB9XG5cbiAgICAuRWFzeU1ERUNvbnRhaW5lciB7IGZsZXg6IDE7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IG1pbi1oZWlnaHQ6IDA7IH1cbiAgICAuRWFzeU1ERUNvbnRhaW5lciAuQ29kZU1pcnJvciB7XG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnKTtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQpO1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGZvbnQtZmFtaWx5OiB2YXIoLS1mb250LW1vbm8pICFpbXBvcnRhbnQ7XG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuNTtcbiAgICAgICAgZmxleDogMTtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICB9XG4gICAgLkVhc3lNREVDb250YWluZXIgLkNvZGVNaXJyb3Itc2Nyb2xsIHsgZmxleDogMTsgbWluLWhlaWdodDogMTAwJTsgfVxuICAgIC5FYXN5TURFQ29udGFpbmVyIC5Db2RlTWlycm9yIC5jbS1oZWFkZXItMSB7IGZvbnQtc2l6ZTogMS4yNWVtOyBsaW5lLWhlaWdodDogMS4zOyB9XG4gICAgLkVhc3lNREVDb250YWluZXIgLkNvZGVNaXJyb3IgLmNtLWhlYWRlci0yIHsgZm9udC1zaXplOiAxLjE1ZW07IGxpbmUtaGVpZ2h0OiAxLjM7IH1cbiAgICAuRWFzeU1ERUNvbnRhaW5lciAuQ29kZU1pcnJvciAuY20taGVhZGVyLTMgeyBmb250LXNpemU6IDEuMDVlbTsgbGluZS1oZWlnaHQ6IDEuMzsgfVxuICAgIC5FYXN5TURFQ29udGFpbmVyIC5Db2RlTWlycm9yIC5jbS1oZWFkZXItNCxcbiAgICAuRWFzeU1ERUNvbnRhaW5lciAuQ29kZU1pcnJvciAuY20taGVhZGVyLTUsXG4gICAgLkVhc3lNREVDb250YWluZXIgLkNvZGVNaXJyb3IgLmNtLWhlYWRlci02IHsgZm9udC1zaXplOiAxZW07IGxpbmUtaGVpZ2h0OiAxLjM7IH1cbiAgICAuZWRpdG9yLXByZXZpZXcgeyBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZyk7IGNvbG9yOiB2YXIoLS10ZXh0KTsgfVxuXG4gICAgLyogR2xvYmFsIFJlc2V0IGZvciBDb21wb25lbnRzICovXG4gICAgKiB7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cblxuICAgIC8qIENvbXBvbmVudC1TcGVjaWZpYyBJbnB1dCBFbmhhbmNlbWVudHMgKEJhc2UgcmVzZXRzIGluaGVyaXRlZCBmcm9tIHllblZVSSB0aGVtZS10b2tlbnMuY3NzKSAqL1xuICAgIHRleHRhcmVhOmZvY3VzLCBpbnB1dDpmb2N1cywgc2VsZWN0OmZvY3VzIHtcbiAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1idG4pO1xuICAgIH1cblxuICAgIC8qIEJ1dHRvbnMgKi9cbiAgICBidXR0b24ge1xuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1idG4pO1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgcGFkZGluZzogMTBweCAyMHB4O1xuICAgICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjJzO1xuICAgIH1cbiAgICBidXR0b246aG92ZXIgeyBiYWNrZ3JvdW5kOiB2YXIoLS1idG4taG92ZXIpOyB9XG4gICAgLmJ0bi1zbSB7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgcGFkZGluZzogOHB4IDE0cHg7XG4gICAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICB9XG4gICAgLyogU3ViLVRhYnMgKEluaGVyaXRlZCBmb3IgU2hhZG93IERPTSBjb21wb25lbnRzKSAqL1xuICAgIC5zdWItdGFicy1iYXIgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6IGNlbnRlcjsgYmFja2dyb3VuZDogdmFyKC0tYmcpOyB6LWluZGV4OiA5OTsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7IHBhZGRpbmc6IDAgMTJweDsgaGVpZ2h0OiAzNnB4OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgLnN1Yi10YWJzLWFjdGlvbnM6ZW1wdHkgeyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH1cbiAgICAuc3ViLXRhYnMgeyBkaXNwbGF5OiBmbGV4OyBnYXA6IDJweDsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyBvdmVyZmxvdy14OiBhdXRvOyBhbGlnbi1pdGVtczogY2VudGVyOyBoZWlnaHQ6IDEwMCU7IHNjcm9sbGJhci13aWR0aDogbm9uZTsgfVxuICAgIC5zeXN0ZW0tYWN0aW9uLWJ0biwgLm1hc3RoZWFkLWFjdGlvbi1yYWlsLWNlbGwge1xuICAgICAgICB3aWR0aDogNDRweCAhaW1wb3J0YW50O1xuICAgICAgICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDtcbiAgICAgICAgYWxpZ24tc2VsZjogc3RyZXRjaCAhaW1wb3J0YW50O1xuICAgICAgICBmbGV4LXNocmluazogMCAhaW1wb3J0YW50O1xuICAgICAgICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICBib3JkZXItbGVmdDogMXB4IHNvbGlkIHZhcigtLWJvcmRlcikgIWltcG9ydGFudDtcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcmFpbC1iZywgcmdiYSgyNTUsMjU1LDI1NSwwLjAyKSkgIWltcG9ydGFudDtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cyBlYXNlLCBjb2xvciAwLjE1cyBlYXNlO1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCkgIWltcG9ydGFudDtcbiAgICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICB9XG4gICAgLnN5c3RlbS1hY3Rpb24tYnRuOmhvdmVyLCAubWFzdGhlYWQtYWN0aW9uLXJhaWwtY2VsbDpob3ZlciB7XG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXJhaWwtaG92ZXIsIHJnYmEoOTksIDEwMiwgMjQxLCAwLjIyKSkgIWltcG9ydGFudDtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQpICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIC8qIEVuc3VyZSBhbnkgaWNvbnMgaW5zaWRlIHRoZXNlIGJ1dHRvbnMgaW5oZXJpdCB0aGUgZm9yY2VkIHRleHQgY29sb3IgKi9cbiAgICAuc3lzdGVtLWFjdGlvbi1idG4gaSwgLnN5c3RlbS1hY3Rpb24tYnRuIHN2ZywgLm1hc3RoZWFkLWFjdGlvbi1yYWlsLWNlbGwgaSwgLm1hc3RoZWFkLWFjdGlvbi1yYWlsLWNlbGwgc3ZnIHtcbiAgICAgICAgY29sb3I6IGN1cnJlbnRDb2xvciAhaW1wb3J0YW50O1xuICAgIH1cbiAgICB5ZW52dWktZHJvcGRvd24geyBkaXNwbGF5OiBpbmxpbmUtZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgaGVpZ2h0OiAxMDAlOyB9XG4gICAgLnN1Yi10YWIgeyBjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDAgMTBweDsgbWFyZ2luLXJpZ2h0OiAwOyBmb250LXNpemU6IDAuOXJlbTsgZm9udC13ZWlnaHQ6IDUwMDsgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpOyB3aGl0ZS1zcGFjZTogbm93cmFwOyB0cmFuc2l0aW9uOiBhbGwgMC4yczsgaGVpZ2h0OiAxMDAlOyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBib3JkZXItYm90dG9tOiAycHggc29saWQgdHJhbnNwYXJlbnQ7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IG91dGxpbmU6IG5vbmU7IH1cbiAgICAuc3ViLXRhYjpob3ZlciB7IGNvbG9yOiB2YXIoLS10ZXh0KTsgfVxuICAgIC5zdWItdGFiLmFjdGl2ZSB7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkIHZhcigtLWludGVudC1wcmltYXJ5KTsgfVxuXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuc3ViLXRhYiB7XG4gICAgICAgIHRyYW5zaXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuc3ViLXRhYjpob3ZlciB7XG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImUtaW5rXCJdKSAuc3ViLXRhYi5hY3RpdmUge1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCkgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgICAuc3RpY2t5LWhlYWRlciB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgZmxleC1zaHJpbms6IDA7IHBhZGRpbmc6IDA7IGJhY2tncm91bmQ6IHZhcigtLWJnKTsgei1pbmRleDogMTA7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyB9XG4gICAgLnRvb2xiYXItcm93IHsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMHB4OyBwYWRkaW5nOiA1cHggMjBweDsgaGVpZ2h0OiA0NHB4OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgXG4gICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiA1MHJlbSkge1xuICAgICAgICAudG9vbGJhci1yb3cgeyBwYWRkaW5nOiA1cHggMTBweDsgfVxuICAgIH1cblxuICAgIC8qIFV0aWxpdGllcyAqL1xuICAgIC5zcGlubmVyIHtcbiAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgICAgbWFyZ2luLXRvcDogMjBweDtcbiAgICAgICAgZm9udC1zdHlsZTogaXRhbGljO1xuICAgICAgICBjb2xvcjogIzg4ODtcbiAgICB9XG4gICAgLmZvbGRlci1sYWJlbCB7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICBmb250LWZhbWlseTogbW9ub3NwYWNlO1xuICAgICAgICBjb2xvcjogI2ZhY2MxNTtcbiAgICAgICAgZm9udC1zaXplOiAxLjFyZW07XG4gICAgfVxuXG4gICAgLyogTGlnaHQgVGhlbWUgT3ZlcnJpZGVzICovXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBoMSwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBoMiwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBoMywgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBoNCwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBoNSwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBoNiB7IFxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dCkgIWltcG9ydGFudDtcbiAgICB9XG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSB0ZXh0YXJlYSwgXG4gICAgOmhvc3QtY29udGV4dChbZGF0YS10aGVtZT1cImxpZ2h0XCJdKSBpbnB1dCxcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIHNlbGVjdCB7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmMWY1Zjk7XG4gICAgICAgIGNvbG9yOiAjMGYxNzJhO1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjY2JkNWUxO1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwibGlnaHRcIl0pIC5mb2xkZXItbGFiZWwge1xuICAgICAgICBjb2xvcjogI2I0NTMwOTtcbiAgICB9XG5cbiAgICAvKiBFLUluayBUaGVtZSBPdmVycmlkZXMgKi9cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGgxLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGgyLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGgzLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGg0LCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGg1LCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGg2LFxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgLmZvbGRlci1sYWJlbCB7IFxuICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICBmb250LXdlaWdodDogOTAwO1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGJ1dHRvbiB7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmZmZmZmYgIWltcG9ydGFudDtcbiAgICAgICAgY29sb3I6ICMwMDAwMDAgIWltcG9ydGFudDtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDkwMCAhaW1wb3J0YW50O1xuICAgICAgICBib3JkZXI6IDJweCBzb2xpZCAjZWM0ODk5ICFpbXBvcnRhbnQ7XG4gICAgICAgIGJveC1zaGFkb3c6IDNweCAzcHggMCAjZWFiMzA4ICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIDpob3N0LWNvbnRleHQoW2RhdGEtdGhlbWU9XCJlLWlua1wiXSkgYnV0dG9uOmhvdmVyIHtcbiAgICAgICAgYmFja2dyb3VuZDogI2YxZjVmOSAhaW1wb3J0YW50O1xuICAgIH1cbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIHRleHRhcmVhLCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIGlucHV0LCBcbiAgICA6aG9zdC1jb250ZXh0KFtkYXRhLXRoZW1lPVwiZS1pbmtcIl0pIHNlbGVjdCB7XG4gICAgICAgIGJvcmRlcjogMnB4IHNvbGlkICMwZWE1ZTkgIWltcG9ydGFudDtcbiAgICAgICAgYmFja2dyb3VuZDogI2ZmZmZmZiAhaW1wb3J0YW50O1xuICAgICAgICBjb2xvcjogIzAwMDAwMCAhaW1wb3J0YW50O1xuICAgICAgICBmb250LXdlaWdodDogNjAwO1xuICAgIH1cbmA7Il0sCiAgIm1hcHBpbmdzIjogIkFBR0EsT0FBUyxPQUFBQSxNQUFXLE1BQ2IsYUFBTSxhQUFlQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTsiLAogICJuYW1lcyI6IFsiY3NzIl0KfQo=
