// ext_term.js - Terminal Extension
import { LitElement, html, css } from 'lit';
import { AppStore } from '../store.js';

export class InSetuExtTerm extends LitElement {
    static properties = {
        termPort: { type: Number }
    };
    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; padding: 15px; box-sizing: border-box; overflow: hidden; background: var(--console-bg); }
        iframe { flex: 1; width: 100%; height: 100%; border: none; outline: none; background: var(--console-bg); border-radius: 4px; }
    `;
    constructor() {
        super();
        this.termPort = null;
    }
    connectedCallback() {
        super.connectedCallback();
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        fetch('/api/' + activeWs + '/repos').then(r => r.json()).then(d => {
            if (d.term_port) this.termPort = d.term_port;
        }).catch(e => console.error("Failed to fetch term port:", e));
    }
    render() {
        if (!this.termPort) return html`<div style="color: var(--text-muted); font-style: italic;">Connecting to local TTYD terminal...</div>`;
        return html`<iframe id="term-iframe" src="${window.location.protocol}//${window.location.hostname}:${this.termPort}"></iframe>`;
    }
}
customElements.define('insetu-ext-term', InSetuExtTerm);

window.ExtensionRegistry.registerExtension('term', {
    name: "Terminal Interface",
    version: "2.0.0",
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "term",
            label: "Term",
            order: 6,
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