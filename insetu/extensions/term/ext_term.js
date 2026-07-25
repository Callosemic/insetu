// ext_term.js - Terminal Extension
import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../sdk.js';
import { Terminal } from 'https://esm.sh/xterm@5.3.0';
import { FitAddon } from 'https://esm.sh/xterm-addon-fit@0.8.0';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const TerminalStore = createExtensionStore('Terminal', {});
window.inSetu.stores.Terminal = TerminalStore;

export class InSetuExtTerm extends InSetuElement {
    get extName() { return 'term'; }
    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; padding: 10px; box-sizing: border-box; overflow: hidden; background: var(--console-bg, #0f172a); }
        #terminal-container { flex: 1; overflow: hidden; width: 100%; height: 100%; }
    `;

    constructor() {
        super();
        this._term = null;
        this._fitAddon = null;
        this._ws = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this._initTimer = setTimeout(() => this._initTerminal(), 0);
        window.addEventListener('resize', this._handleResize);
        this._themeObserver = new MutationObserver(() => this._applyTheme());
        this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

        // Decouple from static uiHooks DOM sniffing
        this.registerGlobalListener('insetu:term:resize', window, () => {
            if (this._handleResize) setTimeout(() => this._handleResize(), 50);
        });
        this.registerGlobalListener('insetu:term:restart', window, () => {
            this.onWorkspaceChanged(this.workspaceId);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._initTimer);
        clearTimeout(this._wsTimer);
        window.removeEventListener('resize', this._handleResize);
        if (this._themeObserver) this._themeObserver.disconnect();
        if (this._ws) {
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        if (this._term) {
            this._term.dispose();
            this._term = null;
        }
    }
    onWorkspaceChanged(newWorkspaceId) {
        if (this._ws) {
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        if (this._term) {
            try { this._term.dispose(); } catch (e) {}
            this._term = null;
        }

        // Defer complete terminal recreation to avoid race conditions during DOM teardown
        setTimeout(() => {
            if (this.isConnected) {
                const container = this.shadowRoot.getElementById('terminal-container');
                if (container) container.innerHTML = '';
                this._initTerminal();
            }
        }, 150);
    }
    _handleResize = () => {
        // Only calculate geometry if the component is actively visible on the screen
        if (this._fitAddon && this._term && this.offsetParent !== null && this.isConnected) {
            try {
                this._fitAddon.fit();
                if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                    this._ws.send(JSON.stringify({ type: 'resize', cols: this._term.cols, rows: this._term.rows }));
                }
            } catch (e) {}
        }
    };
    _initTerminal() {
        if (!this.isConnected) return;
        const container = this.shadowRoot.getElementById('terminal-container');
        if (!container) return;

        this._term = new Terminal({
            cursorBlink: true,
            fontFamily: 'monospace',
            fontSize: 14
        });
        this._applyTheme();

        this._fitAddon = new FitAddon();
        this._term.loadAddon(this._fitAddon);
        this._term.open(container);
        // Wait slightly for DOM to settle before fitting
        this._wsTimer = setTimeout(() => {
            if (!this.isConnected) return;
            this._handleResize();
            this._connectWebSocket();
        }, 50);

        this._term.onData(data => {
            if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                this._ws.send(data);
            }
        });
    }
    _connectWebSocket() {
        if (!this.isConnected) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = window.inSetu.stores.App.getState().authToken || sessionStorage.getItem('insetu_boot_token');
        const wsUrl = `${protocol}//${window.location.host}/api/${this.workspaceId}/term/stream?token=${token}`;

        // Xterm WebSocket attachment
        this._ws = new WebSocket(wsUrl);
        this._ws.binaryType = 'arraybuffer';
        this._ws.onopen = () => {
            if (this._term) {
                this._ws.send(JSON.stringify({ type: 'resize', cols: this._term.cols, rows: this._term.rows }));
            }
        };

        this._ws.onmessage = (event) => {
            if (!this._term) return;
            if (typeof event.data === 'string') {
                this._term.write(event.data);
            } else {
                this._term.write(new Uint8Array(event.data));
            }
        };
        this._ws.onclose = (event) => {
            if (this._term) {
                let msg = '\r\n\x1b[31m[Disconnected from terminal session]\x1b[0m\r\n';
                if (event && event.code) {
                    msg += `\x1b[33mCode: ${event.code} Reason: ${event.reason || 'Unknown'}\x1b[0m\r\n`;
                }
                this._term.write(msg);
            }
        };
    }
    _applyTheme() {
        if (!this._term) return;
        const theme = document.body.getAttribute('data-theme') || 'dark';
        if (theme === 'light') {
            this._term.options.theme = { 
                background: '#f8fafc', foreground: '#0f172a', cursor: '#0f172a', selectionBackground: 'rgba(15, 23, 42, 0.2)',
                black: '#000000', red: '#b91c1c', green: '#15803d', yellow: '#b45309', blue: '#1d4ed8', magenta: '#a21caf', cyan: '#0f766e', white: '#64748b',
                brightBlack: '#475569', brightWhite: '#0f172a'
            };
        } else if (theme === 'e-ink') {
            this._term.options.theme = { 
                background: '#ffffff', foreground: '#000000', cursor: '#000000', selectionBackground: 'rgba(0, 0, 0, 0.2)',
                black: '#000000', red: '#000000', green: '#000000', yellow: '#000000', blue: '#000000', magenta: '#000000', cyan: '#000000', white: '#000000',
                brightBlack: '#000000', brightRed: '#000000', brightGreen: '#000000', brightYellow: '#000000', brightBlue: '#000000', brightMagenta: '#000000', brightCyan: '#000000', brightWhite: '#000000'
            };
        } else {
            this._term.options.theme = { 
                background: '#0f172a', foreground: '#38bdf8', cursor: '#38bdf8', selectionBackground: 'rgba(56, 189, 248, 0.3)',
                black: '#000000', red: '#ef4444', green: '#22c55e', yellow: '#f59e0b', blue: '#3b82f6', magenta: '#d946ef', cyan: '#06b6d4', white: '#cbd5e1',
                brightBlack: '#475569', brightWhite: '#f8fafc'
            };
        }
    }

    render() {
        return html`
            <link rel="stylesheet" href="https://esm.sh/xterm@5.3.0/css/xterm.css" />
            <div id="terminal-container"></div>
        `;
    }
}
customElements.define('insetu-ext-term', InSetuExtTerm);

export class InSetuExtTermActions extends InSetuElement {
    static styles = [css`
        button {
            background: transparent; color: var(--text); border: 1px solid var(--border);
            border-radius: 4px; cursor: pointer; font-weight: bold; width: 34px; height: 34px;
            display: flex; align-items: center; justify-content: center; padding: 0;
            font-size: 1.1rem; transition: background 0.2s; margin: 0;
        }
        button:hover { background: var(--input-bg); }
    `];
    render() {
        return html`
            <button title="Restart Terminal" @click=${() => {
                this.dispatch('insetu:term:restart');
            }}>🔄</button>
        `;
    }
}
customElements.define('insetu-ext-term-actions', InSetuExtTermActions);

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
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "ctrl",
            targetSub: "term",
            component: "insetu-ext-term-actions",
            order: 1
        }
    ],
    uiHooks: {
        'zone:force-refresh': (tabId) => {
            if (tabId === 'ctrl') {
                window.inSetu.events.emit('insetu:term:restart');
            }
        },
        'zone:tab-changed': (tabId) => {
            if (tabId === 'ctrl') {
                window.inSetu.events.emit('insetu:term:resize');
            }
        },
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'ctrl' && data.subId === 'term') {
                if (data.forceRefresh) {
                    window.dispatchEvent(new CustomEvent('insetu:term:restart'));
                }
                window.dispatchEvent(new CustomEvent('insetu:term:resize'));
            }
        }
    }
});