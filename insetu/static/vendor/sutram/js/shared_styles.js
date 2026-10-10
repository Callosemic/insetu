import{css as t}from"lit";import{sharedStyles as r}from"../../yenvui/js/shared_styles.js";export const sharedStyles=t`
    ${r}

    /* Global Reset for Components */
    * { 
        box-sizing: border-box; 
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
`;
