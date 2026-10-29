import{css as e}from"lit";import{sharedStyles as n,Btn as i}from"sutram-chassis";export{i as YenvuiBtn};export const sharedStyles=e`
    ${n}

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
    sutram-pill { display: inline-flex; }
    sutram-tag { display: inline-flex; align-items: center; }
    sutram-label { display: inline-block; margin-bottom: 4px; }
    sutram-input, sutram-select, sutram-textarea, sutram-toggle, sutram-combobox, sutram-target-binding {
        display: block;
        margin-bottom: 15px;
        font-family: inherit;
    }
    sutram-input[flush], sutram-select[flush], sutram-textarea[flush], sutram-toggle[flush], sutram-combobox[flush], sutram-target-binding[flush],
    sutram-input[inline], sutram-select[inline], sutram-textarea[inline], sutram-toggle[inline], sutram-combobox[inline], sutram-target-binding[inline] {
        margin-bottom: 0 !important;
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
