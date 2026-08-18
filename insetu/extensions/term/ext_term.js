// ext_term.js - Terminal Extension
import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const TerminalStore = createExtensionStore('Terminal', {});
window.inSetu.stores.Terminal = TerminalStore;
export class InSetuExtTerm extends InSetuElement {
    static get extensionName() { return 'term'; }
    get extName() { return 'term'; }
    static properties = {
        _hasSock: { type: Boolean },
        _supportPty: { type: Boolean }
    };
    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; padding: 10px; box-sizing: border-box; overflow: hidden; background: var(--console-bg, #0f172a); }
        #terminal-container { flex: 1; overflow: hidden; width: 100%; height: 100%; }
    `;
    constructor() {
        super();
        this._term = null;
        this._fitAddon = null;
        this._ws = null;
        this._hasSock = true;
        this._supportPty = true;
        this._initSequence = 0;
    }
    connectedCallback() {
        super.connectedCallback();
        this._checkStatus();
        this.registerGlobalListener('resize', window, this._handleResize);
        this._themeObserver = new MutationObserver(() => this._applyTheme());
        this._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        // Decouple from static uiHooks DOM sniffing
        this.registerGlobalListener('insetu:term:resize', window, this.utils.debounce(() => {
            if (!this.isConnected) return;
            if (!this._term) {
                this._initTerminal();
            } else if (this._handleResize) {
                this._handleResize();
            }
        }, 50));
        this.registerGlobalListener('insetu:term:restart', window, () => {
            this.onWorkspaceChanged(this.workspaceId);
        });
    }
    firstUpdated() {
        const container = this.shadowRoot.getElementById('terminal-container');
        if (container) {
            this._visibilityObserver = new IntersectionObserver(this.utils.debounce((entries) => {
                if (entries[0].isIntersecting && this.isConnected) {
                    if (!this._term) {
                        this._initTerminal();
                    } else {
                        this._handleResize();
                    }
                }
            }, 50));
            this._visibilityObserver.observe(this);

            this._resizeObserver = new ResizeObserver(this.utils.debounce(() => this._handleResize(), 50));
            this._resizeObserver.observe(this);
        }
    }
    onForceRefresh() {
        this.onWorkspaceChanged(this.workspaceId);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._isUnmounted = true;
        window.removeEventListener('resize', this._handleResize);
        if (this._themeObserver) this._themeObserver.disconnect();
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._visibilityObserver) this._visibilityObserver.disconnect();
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onerror = null;
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        if (this._term) {
            this._term.dispose();
            this._term = null;
        }
    }
    async _checkStatus() {
        try {
            const res = await this.api.get('status');
            if (res.ok) {
                const data = await res.json();
                this._hasSock = data.has_sock;
                this._supportPty = data.support_pty;
            }
        } catch (e) {}
    }
    onWorkspaceChanged(newWorkspaceId) {
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onerror = null;
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        if (this._term) {
            try { this._term.dispose(); } catch (e) {}
            this._term = null;
        }

        // Use an incrementing sequence token to orphan previous pending builds
        this._initSequence = (this._initSequence || 0) + 1;
        const currentSeq = this._initSequence;

        if (!this.isExtensionActive()) return;

        // Defer complete terminal recreation to avoid race conditions during DOM teardown
        setTimeout(() => {
            if (!this.isConnected || this._initSequence !== currentSeq) return;

            if (this._ws) {
                this._ws.onopen = null;
                this._ws.onmessage = null;
                this._ws.onerror = null;
                this._ws.onclose = null;
                this._ws.close();
                this._ws = null;
            }
            if (this._term) {
                try { this._term.dispose(); } catch (e) {}
                this._term = null;
            }
            const container = this.shadowRoot.getElementById('terminal-container');
            if (container) {
                while (container.firstChild) container.removeChild(container.firstChild);
            }
            this._initTerminal();
        }, 300);
    }
    _handleResize = () => {
        if (this._fitAddon && this._term && this.isConnected && this.clientWidth > 0) {
            try {
                // Guardrail: Ensure Xterm's internal renderer has successfully booted 
                // before attempting to calculate fit geometry
                if (this._term._core && this._term._core._renderService) {
                    this._fitAddon.fit();
                    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                        this._ws.send(JSON.stringify({ type: 'resize', cols: this._term.cols, rows: this._term.rows }));
                    }
                }
            } catch (e) {}
        }
    };
    _initTerminal() {
        if (!this.isConnected || !this.isExtensionActive()) return;
        if (this._term) return; // Prevent double-initialization on load

        const container = this.shadowRoot.getElementById('terminal-container');
        // Must have physical pixel dimensions painted to the screen
        if (!container || container.clientWidth === 0) return; 

        this._term = new Terminal({
            cursorBlink: true,
            fontFamily: 'monospace',
            fontSize: 14
        });
        this._applyTheme();

        this._fitAddon = new FitAddon();
        this._term.loadAddon(this._fitAddon);
        this._term.open(container);

        // Provide immediate visual feedback so the screen is never blank
        this._term.writeln('\x1b[36mInitializing terminal session...\x1b[0m');
        // Wait slightly for DOM to settle before fitting
        const currentSeq = this._initSequence || 0;
        setTimeout(() => {
            if (!this.isConnected || this._initSequence !== currentSeq) return;
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
        if (!this.isConnected || !this.isExtensionActive()) return;
        if (this._ws && (this._ws.readyState === WebSocket.CONNECTING || this._ws.readyState === WebSocket.OPEN)) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = window.inSetu.stores.App.getState().authToken || sessionStorage.getItem('insetu_boot_token');
        const wsUrl = `${protocol}//${window.location.host}/api/${this.workspaceId}/term/stream?token=${token}`;

        // Xterm WebSocket attachment
        this._ws = new WebSocket(wsUrl);
        this._ws.binaryType = 'arraybuffer';
        this._ws.onopen = () => {
            if (this._term) {
                // Delay initial resize payload to prevent full-duplex proxy collisions on boot
                setTimeout(() => {
                    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                        this._ws.send(JSON.stringify({ type: 'resize', cols: this._term.cols, rows: this._term.rows }));
                    }
                }, 100);
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
        this._ws.onerror = (error) => {
            if (this._term) {
                this._term.write('\r\n\x1b[31m[WebSocket Connection Error]\x1b[0m\r\n');
                this._term.write('\x1b[33mIf using Tailscale/HTTPS with the built-in Flask server, WebSockets may fail due to Werkzeug SSL handling. Try using an HTTP port instead, or deploy with Gunicorn.\x1b[0m\r\n');
            }
        };
        this._ws.onclose = (event) => {
            if (this._term) {
                const msgBase = '\r\n\x1b[31m[Disconnected from terminal session]\x1b[0m\r\n';
                const msgAdd = (event && event.code) ? `\x1b[33mCode: ${event.code} Reason: ${event.reason || 'Unknown'}\x1b[0m\r\n` : '';
                this._term.write(msgBase + msgAdd);
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
        if (!this._hasSock) {
            return html`
                <div style="padding: 20px; background: var(--input-bg); border: 1px solid var(--intent-warning); border-radius: 6px; color: var(--text); margin: 20px;">
                    <h3 style="margin-top: 0; color: var(--intent-warning);">⚠️ Missing Backend Dependency</h3>
                    <p>The Terminal extension requires <code>flask-sock</code> for WebSocket PTY streaming.</p>
                    <p style="font-family: var(--font-mono); background: var(--bg); padding: 10px; border-radius: 4px;">pip install insetu[term]</p>
                </div>
            `;
        }
        return html`
            <link rel="stylesheet" href="/static/extensions/term/vendor/xterm.css" />
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
    ]
});