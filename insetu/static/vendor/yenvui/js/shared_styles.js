import{css as e}from"lit";export const sharedStyles=e`
    /* --- CUSTOM ELEMENT HOST STRUCTURAL REPAIRS --- */
    yenvui-btn, sutram-btn, yenvui-async-btn, sutram-async-btn {
        display: inline-flex;
        vertical-align: middle;
        min-width: max-content;
        flex-shrink: 0;
    }
    yenvui-pill, sutram-pill { display: inline-flex; }
    yenvui-tag, sutram-tag { display: inline-flex; align-items: center; }
    yenvui-label, sutram-label { display: inline-block; margin-bottom: 4px; }
    sutram-input, sutram-select, sutram-textarea, sutram-toggle {
        display: block;
        margin-bottom: 15px;
        font-family: inherit;
    }
    sutram-input[flush], sutram-select[flush], sutram-textarea[flush], sutram-toggle[flush],
    sutram-input[inline], sutram-select[inline], sutram-textarea[inline], sutram-toggle[inline] {
        margin-bottom: 0 !important;
    }

    /* --- BUTTON PRIMITIVES (.yv-btn) --- */
    .yv-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: var(--btn-padding, 8px 14px);
        font-size: var(--btn-font-size, 0.85rem);
        font-family: inherit;
        font-weight: var(--btn-font-weight, normal);
        border-radius: var(--btn-border-radius, 8px);
        border: 1px solid transparent;
        cursor: pointer;
        white-space: nowrap;
        width: 100%;
        min-width: max-content;
        box-sizing: border-box;
        transition: all 0.2s ease;
    }
    .yv-btn:active:not(:disabled) { transform: scale(0.98); }
    .yv-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .yv-btn--primary { --btn-color: var(--intent-primary, #3b82f6); }
    .yv-btn--success { --btn-color: var(--intent-success, #10b981); }
    .yv-btn--danger { --btn-color: var(--intent-danger, #ef4444); }
    .yv-btn--warning { --btn-color: var(--intent-warning, #f59e0b); }
    .yv-btn--highlight { --btn-color: var(--intent-highlight, #8b5cf6); }
    .yv-btn--neutral { --btn-color: var(--intent-neutral, #64748b); }
    .yv-btn--solid { background: var(--btn-color); color: #ffffff; }
    .yv-btn--solid.yv-btn--warning { color: #000000; }
    .yv-btn--solid:hover:not(:disabled) { filter: brightness(1.1); }
    .yv-btn--solid.yv-btn--active { box-shadow: inset 0 0 0 2px #ffffff; filter: brightness(1.15); }

    .yv-btn--tinted {
        background: color-mix(in srgb, var(--btn-color) 15%, transparent);
        color: var(--btn-color);
        border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
    }
    .yv-btn--tinted:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-color) 25%, transparent); }
    .yv-btn--tinted.yv-btn--active { border-color: var(--btn-color); background: color-mix(in srgb, var(--btn-color) 35%, transparent); }

    .yv-btn--emphasis { box-shadow: 0 0 14px color-mix(in srgb, var(--btn-color) 50%, transparent); }
    .yv-btn--sm { --btn-padding: 4px 10px; --btn-font-size: 0.75rem; }
    /* High-Contrast E-Ink Overrides for Buttons */
    :host-context([data-theme="e-ink"]) .yv-btn,
    :host([data-theme="e-ink"]) .yv-btn,
    [data-theme="e-ink"] .yv-btn {
        background: transparent !important;
        color: #000000 !important;
        font-weight: 900 !important;
        border: 2px dashed #000000 !important;
        box-shadow: 3px 3px 0 var(--btn-color, #eab308) !important;
    }
    :host-context([data-theme="e-ink"]) .yv-btn:hover:not(:disabled),
    :host([data-theme="e-ink"]) .yv-btn:hover:not(:disabled),
    [data-theme="e-ink"] .yv-btn:hover:not(:disabled) {  
        background: rgba(0, 0, 0, 0.05) !important; 
        border-color: var(--btn-color, #ec4899) !important; 
    }
    :host-context([data-theme="e-ink"]) .yv-btn.yv-btn--active,
    :host([data-theme="e-ink"]) .yv-btn.yv-btn--active,
    [data-theme="e-ink"] .yv-btn.yv-btn--active {  
        background: #ffffff !important; 
        color: #000000 !important; 
        border: 2px solid #000000 !important; 
        box-shadow: 4px 4px 0 var(--btn-color, #ec4899) !important;
    }
    /* --- PILL PRIMITIVES (.yv-pill) --- */
    .yv-pill {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        border: 1px solid var(--border, #444);
        cursor: pointer;
        font-weight: bold;
        margin: 0;
        transition: background 0.2s, color 0.2s, border-color 0.2s;
    }
    .yv-pill--small { padding: 2px 6px; font-size: 0.7rem; }
    .yv-pill--standard.yv-pill--active { background: var(--btn, #3b82f6); color: #fff; }
    .yv-pill--standard.yv-pill--inactive { background: transparent; color: var(--text, #e0e0e0); }

    .yv-pill--text {
        background: transparent;
        font-weight: normal;
        border-radius: 0;
        border-left: none;
        border-right: none;
        border-top: 1px solid transparent;
        border-bottom: 1px solid transparent;
    }
    .yv-pill--text.yv-pill--inactive { color: var(--text-muted, #888); }
    .yv-pill--text.yv-pill--inactive:hover { color: var(--text, #e0e0e0); }
    .yv-pill--text.yv-pill--active {
        border-top: 1px solid var(--text, #e0e0e0);
        border-bottom: 1px solid var(--text, #e0e0e0);
        color: var(--text, #e0e0e0);
        font-weight: bold;
        background: transparent;
    }
    :host-context([data-theme="e-ink"]) .yv-pill--standard.yv-pill--active,
    :host([data-theme="e-ink"]) .yv-pill--standard.yv-pill--active,
    [data-theme="e-ink"] .yv-pill--standard.yv-pill--active {
        background: transparent !important;
        color: #000000 !important;
        border: 2px dashed #000000 !important;
        box-shadow: 3px 3px 0 #9ca3af !important;
    }
    :host-context([data-theme="e-ink"]) .yv-pill--text.yv-pill--active,
    :host([data-theme="e-ink"]) .yv-pill--text.yv-pill--active,
    [data-theme="e-ink"] .yv-pill--text.yv-pill--active {
        border-top: 2px solid #000000 !important;
        border-bottom: 2px solid #000000 !important;
        border-left: none !important;
        border-right: none !important;
    }

    /* --- LABEL PRIMITIVES (.yv-label) --- */
    .yv-label {
        display: inline-block;
        margin-bottom: 4px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-muted, #888);
        font-family: var(--font-family, inherit);
        user-select: none;
    }
    :host-context([data-theme="e-ink"]) .yv-label,
    :host([data-theme="e-ink"]) .yv-label,
    [data-theme="e-ink"] .yv-label {
        color: #000000 !important;
        font-weight: 900 !important;
    }

    /* --- TAG PRIMITIVES (.yv-tag) --- */
    .yv-tag {
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
    .yv-tag--primary { --tag-bg: var(--intent-primary); --tag-color: #fff; --tag-border: var(--intent-primary); }
    .yv-tag--success { --tag-bg: var(--intent-success); --tag-color: #fff; --tag-border: var(--intent-success); }
    .yv-tag--danger { --tag-bg: var(--intent-danger); --tag-color: #fff; --tag-border: var(--intent-danger); }
    .yv-tag--warning { --tag-bg: var(--intent-warning); --tag-color: #000; --tag-border: var(--intent-warning); }
    :host-context([data-theme="e-ink"]) .yv-tag,
    :host([data-theme="e-ink"]) .yv-tag,
    [data-theme="e-ink"] .yv-tag {
        background: transparent !important;
        color: #000000 !important;
        border: 1px dashed #000000 !important;
    }
    :host-context([data-theme="light"]) .yv-tag,
    :host([data-theme="light"]) .yv-tag,
    [data-theme="light"] .yv-tag {
        background: var(--tag-bg, #f1f5f9);
        border-color: var(--tag-border, #cbd5e1);
        color: var(--tag-color, #0f172a);
    }

    /* --- INPUT & FORM PRIMITIVES (.yv-input, .yv-select, .yv-textarea, .yv-toggle) --- */
    .yv-form-wrapper { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px; width: 100%; }
    .yv-form-wrapper--flush { margin-bottom: 0 !important; }
    .yv-form-wrapper--inline { flex-direction: row; align-items: center; gap: 15px; }

    .yv-input, .yv-select, .yv-textarea {
        padding: 8px 12px;
        font-size: 0.95rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg-input, var(--bg));
        color: var(--text);
        transition: border-color 0.2s, box-shadow 0.2s;
        font-family: inherit;
        box-sizing: border-box;
        width: 100%;
    }
    .yv-input:focus, .yv-select:focus, .yv-textarea:focus {
        outline: none;
        border-color: var(--intent-primary);
        box-shadow: 0 0 0 2px rgba(var(--intent-primary-rgb, 0, 123, 255), 0.2);
    }
    .yv-input:disabled, .yv-select:disabled, .yv-textarea:disabled {
        background: var(--bg-hover);
        cursor: not-allowed;
        opacity: 0.7;
    }

    .yv-select { cursor: pointer; appearance: auto; }
    .yv-textarea { resize: vertical; min-height: 80px; }
    .yv-textarea--monospace { font-family: var(--font-mono, monospace); font-size: 0.9rem; }
    .yv-textarea--borderless {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        background: transparent !important;
        resize: none !important;
        overflow: hidden !important;
        padding: 0 !important;
        min-height: 0 !important;
    }

    .yv-toggle-wrapper { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 4px; }
    .yv-toggle-wrapper.disabled { cursor: not-allowed; opacity: 0.6; }
    .yv-toggle-track {
        width: 36px; height: 20px;
        background: var(--border);
        border-radius: 20px;
        position: relative;
        transition: background 0.2s;
    }
    .yv-toggle-track.checked { background: var(--intent-primary); }
    .yv-toggle-thumb {
        width: 16px; height: 16px;
        background: #ffffff;
        border-radius: 50%;
        position: absolute;
        top: 2px; left: 2px;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .yv-toggle-track.checked .yv-toggle-thumb { transform: translateX(16px); }
`;if(typeof document<"u"&&!document.getElementById("yenvui-shared-styles")){const t=document.createElement("style");t.id="yenvui-shared-styles",t.textContent=sharedStyles.cssText,document.head.appendChild(t)}
