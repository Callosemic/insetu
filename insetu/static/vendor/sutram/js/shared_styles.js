import{css as a}from"lit";import{sharedStyles as r,Btn as e}from"sutram-chassis";export{e as YenvuiBtn};export const sharedStyles=a`
    ${r}

    /* Global Reset for Components & iOS WebKit Text-Inflation Guard */
    :host {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
    }
    * { 
        box-sizing: border-box;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
    }
    sutram-btn, sutram-async-btn {
        display: inline-flex;
        vertical-align: middle;
        min-width: max-content;
        flex-shrink: 0;
    }
    sutram-btn[grow], sutram-async-btn[grow] {
        flex: 1 1 0%;
    }
    sutram-btn[fullwidth], sutram-async-btn[fullwidth] {
        width: 100%;
    }
    sutram-icon { display: inline-block; vertical-align: middle; flex-shrink: 0; }
    sutram-view { display: flex; flex-direction: column; flex: 1; height: 100%; width: 100%; min-height: 0; min-width: 0; }
    sutram-virtual-list { display: flex; flex-direction: column; flex: 1; height: 100%; width: 100%; min-height: 0; min-width: 0; }
    sutram-stack, sutram-surface { display: flex; box-sizing: border-box; }
    sutram-action-bar { display: flex; align-items: center; width: 100%; box-sizing: border-box; }
    sutram-pill { display: inline-flex; }
    sutram-tag { display: inline-flex; align-items: center; max-width: 100%; min-width: 0; }
    sutram-label { display: inline-block; margin-bottom: 4px; max-width: 100%; }
    sutram-label[truncate] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    sutram-input, sutram-select, sutram-textarea, sutram-toggle, sutram-combobox, sutram-target-binding, sutram-composer {
        display: block;
        margin-bottom: 15px;
        font-family: inherit;
    }
    sutram-input[flush], sutram-select[flush], sutram-textarea[flush], sutram-toggle[flush], sutram-combobox[flush], sutram-target-binding[flush], sutram-composer[flush],
    sutram-input[inline], sutram-select[inline], sutram-textarea[inline], sutram-toggle[inline], sutram-combobox[inline], sutram-target-binding[inline], sutram-composer[inline],
    sutram-stack > sutram-input, sutram-stack > sutram-select, sutram-stack > sutram-textarea, sutram-stack > sutram-toggle, sutram-stack > sutram-combobox, sutram-stack > sutram-target-binding,
    sutram-surface > sutram-input, sutram-surface > sutram-select, sutram-surface > sutram-textarea, sutram-surface > sutram-toggle, sutram-surface > sutram-combobox, sutram-surface > sutram-target-binding,
    sutram-field-card > sutram-input, sutram-field-card > sutram-select, sutram-field-card > sutram-textarea, sutram-field-card > sutram-toggle, sutram-field-card > sutram-combobox, sutram-field-card > sutram-target-binding,
    sutram-action-bar > sutram-input, sutram-action-bar > sutram-select {
        margin-bottom: 0 !important;
    }
    sutram-input[grow], sutram-select[grow] {
        flex: 1 1 0%;
        min-width: 120px;
    }
    yenvui-dropdown, sutram-dropdown { display: inline-flex; align-items: stretch; height: 100%; }

    .system-action-btn {
        width: 44px !important; height: auto !important; align-self: stretch !important; flex-shrink: 0 !important;
        border-radius: 0 !important; border: none !important; border-left: 1px solid var(--border) !important;
        background: var(--rail-bg, rgba(255,255,255,0.02)) !important; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background 0.15s ease, color 0.15s ease; color: var(--text-muted) !important;
        margin: 0 !important; padding: 0 !important; box-sizing: border-box; outline: none;
    }
    .system-action-btn:hover {
        background: var(--rail-hover, rgba(99, 102, 241, 0.22)) !important; color: var(--text) !important;
    }
    .system-action-btn i { color: currentColor !important; }
`;if(typeof document<"u"&&!document.getElementById("sutram-shared-styles")){const t=document.createElement("style");t.id="sutram-shared-styles",t.textContent=sharedStyles.cssText,document.head.appendChild(t)}
