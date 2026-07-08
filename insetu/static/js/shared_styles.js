import { css } from 'lit';

export const sharedStyles = css`
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
    .sub-tabs { display: flex; gap: 8px; margin: 0; padding: 0; overflow-x: auto; align-items: center; height: 100%; scrollbar-width: none; }
    .sub-tab { cursor: pointer; padding: 0 12px; font-size: 0.9rem; font-weight: bold; color: var(--text-muted); white-space: nowrap; transition: all 0.2s; height: 100%; display: flex; align-items: center; border-top: 2px solid transparent; border-bottom: 2px solid transparent; box-sizing: border-box; }
    .sub-tab:hover { color: var(--text); }
    .sub-tab.active { color: var(--text); border-bottom: 2px solid var(--btn); }

    /* Utilities */
    .spinner {
        display: none;
        margin-top: 20px;
        font-style: italic;
        color: #888;
    }

    .file-card {
        background: var(--input-bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 12px;
        position: relative;
        overflow: hidden;
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
    :host-context([data-theme="light"]) .file-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 5px rgba(0,0,0,0.04);
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
    :host-context([data-theme="e-ink"]) .file-card {
        border: 2px solid #8b5cf6 !important;
        box-shadow: 4px 4px 0 #14b8a6 !important;
        background: #ffffff !important;
        color: #000000 !important;
    }
`;