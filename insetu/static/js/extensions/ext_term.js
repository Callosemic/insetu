// ext_term.js - Terminal Extension
import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const TerminalStore = createExtensionStore('Terminal', {
    termPort: null,
    errorMessage: null
});
window.inSetu.stores.Terminal = TerminalStore;

export class InSetuExtTerm extends InSetuElement {
    get extName() { return 'term'; }
    static properties = {
        termPort: { type: Number },
        errorMessage: { type: String }
    };
    // Host-level CSS filters handle Light/E-Ink theme inversions uniformly; term.css is deprecated.
    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; padding: 0; box-sizing: border-box; overflow: hidden; background: var(--console-bg, #0f172a); }
        /* 布局硬化：通过超越边界的加宽计算与容器级强制切边，彻底粉碎跨源浏览器造成的溢出黑条 */
        iframe { flex: 1; width: calc(100% + 18px); height: 100%; border: none; outline: none; background: transparent; border-radius: 0; overflow: hidden; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; border: 2px solid #0f172a; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
    `;
    constructor() {
        super();
        this.termPort = null;
        this.errorMessage = null;
    }
    async fetchTerminalPort() {
        TerminalStore.setState({ termPort: null, errorMessage: null });
        try {
            const res = await this.api.get('port');
            const data = await res.json();
            if (res.ok) {
                TerminalStore.setState({ termPort: data.term_port });
            } else {
                TerminalStore.setState({ errorMessage: data.error || "Failed to initialize terminal session channel." });
            }
        } catch (e) {
            TerminalStore.setState({ errorMessage: "Ecosystem network disconnect or extension routing failure." });
            console.error("Failed to fetch dynamic workspace terminal port routing context:", e);
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(TerminalStore, state => {
            this.termPort = state.termPort;
            this.errorMessage = state.errorMessage;
        });
        this.fetchTerminalPort();
    }
    onWorkspaceChanged(newWorkspaceId) {
        this.fetchTerminalPort();
    }
    render() {
        if (this.errorMessage) {
            return html`
                <div style="padding: 20px; background: var(--bg); height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                    <div style="font-size: 2.5rem; margin-bottom: 15px;">⚠️</div>
                    <h3 style="margin: 0 0 10px 0; color: var(--intent-danger); font-weight: bold;">Terminal Shell Allocation Error</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 500px; margin: 0 0 20px 0; font-family: var(--font-mono);">${this.errorMessage}</p>
                    <button class="btn-sm" style="background: var(--intent-primary); font-weight: bold;" @click=${this.fetchTerminalPort}>🔄 Retry Connection</button>
                </div>
            `;
        }
        if (!this.termPort) return html`<div style="color: var(--text-muted); font-style: italic; padding: 20px;">Connecting to local TTYD terminal...</div>`;
        return html`<iframe id="term-iframe" scrolling="no" src="${window.location.protocol}//${window.location.hostname}:${this.termPort}"></iframe>`;
    }
}
customElements.define('insetu-ext-term', InSetuExtTerm);
window.ExtensionRegistry.registerExtension('term', {
    name: "Terminal Interface",
    version: "2.0.0",
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "ctrl",
            label: "Ctrl",
            order: 6
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "ctrl",
            id: "term",
            label: "Terminal",
            order: 1,
            component: "insetu-ext-term"
        }
    ],
    uiHooks: {
        'zone:force-refresh': (tabId) => {
            if (tabId === 'term') {
                const termEl = document.querySelector('insetu-ext-term');
                if (termEl) {
                    const iframe = termEl.shadowRoot.getElementById('term-iframe');
                    if (iframe) iframe.src += '';
                }
            }
        },
        'zone:tab-changed': (tabId) => {
            if (tabId === 'term') {
                const termEl = document.querySelector('insetu-ext-term');
                if (termEl) {
                    const iframe = termEl.shadowRoot.getElementById('term-iframe');
                    if (iframe) iframe.focus();
                }
            }
        }
    }
});