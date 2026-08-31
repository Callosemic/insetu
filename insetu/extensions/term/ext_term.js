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
        _supportPty: { type: Boolean },
        _ctrlLatched: { type: Boolean },
        _shiftLatched: { type: Boolean },
        _actionBarVisible: { type: Boolean },
        _contextMenuOpen: { type: Boolean },
        _contextMenuX: { type: Number },
        _contextMenuY: { type: Number },
        _contextMenuTransX: { type: String },
        _contextMenuTransY: { type: String }
    };
    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; padding: 10px; box-sizing: border-box; overflow: hidden; background: var(--console-bg, #0f172a); position: relative; }
        #terminal-container { flex: 1; overflow: hidden; width: 100%; height: 100%; position: relative; }
        /* FOUC Prevention: Target only the measurement string, leaving the input textarea fully interactive */
        .xterm-char-measure-element {
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            visibility: hidden !important;
        }
    `;
    constructor() {
        super();
        this._term = null;
        this._fitAddon = null;
        this._ws = null;
        this._hasSock = true;
        this._supportPty = true;
        this._initSequence = 0;

        // Virtual Keyboard & Gesture Tracking
        this._ctrlLatched = false;
        this._shiftLatched = false;
        this._actionBarVisible = true;
        this._contextMenuOpen = false;
        this._contextMenuX = 0;
        this._contextMenuY = 0;

        this._touchStartX = null;
        this._touchStartY = null;
        this._lastTapTime = 0;
        this._longPressTimer = null;
    }
    _trackPointerDown = (e) => {
        const cx = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const cy = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

        if (cx !== undefined && cy !== undefined) {
            this._latestX = cx;
            this._latestY = cy;
        }

        if (e.type === 'touchstart' && e.touches.length === 1) {
            this._touchStartX = cx;
            this._touchStartY = cy;
            clearTimeout(this._longPressTimer);
            this._longPressTimer = setTimeout(() => {
                // Explicitly pass the cached touch coordinates to avoid event recycling
                this._openContextMenu(cx, cy);
            }, 600);
        }
    };

    _trackPointerMove = (e) => {
        const cx = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const cy = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        if (cx !== undefined && cy !== undefined) {
            this._latestX = cx;
            this._latestY = cy;
        }

        if (this._touchStartX !== null && e.type === 'touchmove') {
            const dx = cx - this._touchStartX;
            const dy = cy - this._touchStartY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                clearTimeout(this._longPressTimer);
            }
        }
    };

    _trackPointerUp = (e) => {
        clearTimeout(this._longPressTimer);
        if (e.type === 'touchend' && this._touchStartX !== null) {
            const cx = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : this._latestX;
            const cy = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientY : this._latestY;
            const dx = cx - this._touchStartX;
            const dy = cy - this._touchStartY;

            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) this._sendData('\t'); 
                else this._sendData('\x17'); 
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                const now = Date.now();
                if (now - this._lastTapTime < 300) {
                    this._actionBarVisible = !this._actionBarVisible;
                    this.updateComplete.then(() => {
                        if (this._handleResize) this._handleResize();
                        if (this._term) this._term.focus();
                    });
                }
                this._lastTapTime = now;
            }
            this._touchStartX = null;
        }
    };

    connectedCallback() {
        super.connectedCallback();
        this._checkStatus();
        this.registerGlobalListener('resize', window, this._handleResize);

        // The "Invisible Overlay" (Capture Phase) - Guaranteed to fire before xterm.js
        this.addEventListener('pointerdown', this._trackPointerDown, { capture: true, passive: true });
        this.addEventListener('touchstart', this._trackPointerDown, { capture: true, passive: true });

        this.addEventListener('pointermove', this._trackPointerMove, { capture: true, passive: true });
        this.addEventListener('touchmove', this._trackPointerMove, { capture: true, passive: true });

        this.addEventListener('pointerup', this._trackPointerUp, { capture: true, passive: true });
        this.addEventListener('touchend', this._trackPointerUp, { capture: true, passive: true });

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
        this.registerGlobalListener('insetu:term:toggle-keyboard', window, () => {
            this._actionBarVisible = !this._actionBarVisible;
            this.updateComplete.then(() => {
                this._handleResize();
                if (this._term) this._term.focus();
            });
        });
    }
    firstUpdated() {
        const container = this.shadowRoot.getElementById('terminal-container');
        if (container) {
            this._resizeObserver = new ResizeObserver(this.utils.debounce(() => this._handleResize(), 50));
            this._resizeObserver.observe(container);
        }
    }
    onViewActivated() {
        setTimeout(() => {
            if (!this.isConnected) return;
            if (!this._term) {
                this._initTerminal();
            } else {
                this._handleResize();
                if (this._term) this._term.focus();
                if (!this._ws || this._ws.readyState === WebSocket.CLOSED) {
                    this._connectWebSocket();
                }
            }
        }, 50);
    }
    onForceRefresh() {
        this.onWorkspaceLoad(this.workspaceId);
    }
    _destroyTerminal() {
        if (!this._term) return;
        try {
            const core = this._term._core;
            if (core) {
                // Aggressively cancel internal Xterm requestAnimationFrames to prevent 
                // uncaught dimensions TypeErrors after the renderer is disposed.
                if (core.viewport && core.viewport._refreshAnimationFrame) {
                    window.cancelAnimationFrame(core.viewport._refreshAnimationFrame);
                }
                if (core._renderService && core._renderService._renderDebouncer && core._renderService._renderDebouncer._animationFrame) {
                    window.cancelAnimationFrame(core._renderService._renderDebouncer._animationFrame);
                }
            }
            this._term.dispose();
        } catch (e) {}
        this._term = null;
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._isUnmounted = true;

        this.removeEventListener('pointerdown', this._trackPointerDown, { capture: true });
        this.removeEventListener('touchstart', this._trackPointerDown, { capture: true });
        this.removeEventListener('pointermove', this._trackPointerMove, { capture: true });
        this.removeEventListener('touchmove', this._trackPointerMove, { capture: true });
        this.removeEventListener('pointerup', this._trackPointerUp, { capture: true });
        this.removeEventListener('touchend', this._trackPointerUp, { capture: true });

        window.removeEventListener('resize', this._handleResize);
        if (this._themeObserver) this._themeObserver.disconnect();
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onerror = null;
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        this._destroyTerminal();
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
    onWorkspaceLoad(workspaceId) {
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onerror = null;
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        this._destroyTerminal();

        // Use an incrementing sequence token to orphan previous pending builds
        this._initSequence = (this._initSequence || 0) + 1;
        const currentSeq = this._initSequence;

        if (!this.isExtensionActive()) return;
        // Defer complete terminal recreation to avoid race conditions during DOM teardown
        setTimeout(() => {
            requestAnimationFrame(() => {
                if (!this.isConnected || this._initSequence !== currentSeq) return;

                if (this._ws) {
                    this._ws.onopen = null;
                    this._ws.onmessage = null;
                    this._ws.onerror = null;
                    this._ws.onclose = null;
                    this._ws.close();
                    this._ws = null;
                }
                this._destroyTerminal();
                const container = this.shadowRoot.getElementById('terminal-container');
                if (container) {
                    while (container.firstChild) container.removeChild(container.firstChild);
                }
                this._initTerminal();
            });
        }, 300);
    }
    _handleResize = () => {
        if (!this.isConnected) return;

        const container = this.shadowRoot.getElementById('terminal-container');
        // Native layout check: abort instantly if the container is hidden
        if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

        if (!this._term) {
            this._initTerminal();
            return;
        }

        if (!this._fitAddon) return;

        try {
            const core = this._term._core;
            if (!core || !core._renderService || !core._renderService._renderer || !core._renderService._renderer.value) return;

            this._fitAddon.fit();
            if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                this._ws.send(JSON.stringify({ type: 'resize', cols: this._term.cols, rows: this._term.rows }));
            }
        } catch (e) {
            console.warn("[Terminal] Resize logic swallowed an internal Xterm exception:", e);
        }
    };
    _initTerminal() {
        if (!this.isConnected || !this.isExtensionActive()) return;
        if (this._term) return; // Prevent double-initialization on load

        const container = this.shadowRoot.getElementById('terminal-container');
        // Strict visibility check: abort if the element or an ancestor is display: none
        if (!container || container.clientWidth === 0 || container.clientHeight === 0) return; 

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
        this._term.focus();

        // Wait slightly for DOM to settle before fitting
        const currentSeq = this._initSequence || 0;
        setTimeout(() => {
            if (!this.isConnected || this._initSequence !== currentSeq) return;
            this._handleResize();
            this._connectWebSocket();
        }, 50);
        this._term.onData(data => {
            if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
            let finalData = data;

            // Latching Evaluation
            if (this._ctrlLatched && data.length === 1) {
                const charCode = data.charCodeAt(0);
                if (charCode >= 97 && charCode <= 122) finalData = String.fromCharCode(charCode - 96);
                else if (charCode >= 65 && charCode <= 90) finalData = String.fromCharCode(charCode - 64);
            }
            if (this._shiftLatched && data.length === 1) {
                const charCode = data.charCodeAt(0);
                if (charCode >= 97 && charCode <= 122) finalData = String.fromCharCode(charCode - 32);
            }

            // Auto-unlatch after modifier consumed
            if (this._ctrlLatched || this._shiftLatched) {
                this._ctrlLatched = false;
                this._shiftLatched = false;
                this.requestUpdate();
            }

            this._ws.send(finalData);
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
    _sendData(data) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(data);
        }
    }
    _handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        this._touchStartX = e.touches[0].clientX;
        this._touchStartY = e.touches[0].clientY;

        // Cache the coordinates immediately because the browser will wipe 
        // the TouchEvent object from memory before the timeout resolves.
        const cx = this._touchStartX;
        const cy = this._touchStartY;

        this._longPressTimer = setTimeout(() => {
            this._openContextMenu(cx, cy);
        }, 600);
    }

    _handleTouchEnd(e) {
        clearTimeout(this._longPressTimer);
        if (this._touchStartX === null) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - this._touchStartX;
        const dy = touchEndY - this._touchStartY;

        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            // Evaluated Swipes
            if (dx > 0) this._sendData('\t'); // Rightward: Tab
            else this._sendData('\x17'); // Leftward: Ctrl+W
        } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            // Evaluated Double Tap
            const now = Date.now();
            if (now - this._lastTapTime < 300) {
                this._actionBarVisible = !this._actionBarVisible;
                this.updateComplete.then(() => {
                    if (this._handleResize) this._handleResize();
                    if (this._term) this._term.focus();
                });
            }
            this._lastTapTime = now;
        }
        this._touchStartX = null;
    }
    _openContextMenu(x, y) {
        this._menuOpenTime = Date.now();

        // Prioritize explicitly passed coordinates from the triggering event, fallback to tracker
        const targetX = (typeof x === 'number' && !isNaN(x)) ? x : (this._latestX || 0);
        const targetY = (typeof y === 'number' && !isNaN(y)) ? y : (this._latestY || 0);

        const rect = this.getBoundingClientRect();

        // Convert absolute viewport coordinates to host-local coordinates
        let localX = targetX - rect.left;
        let localY = targetY - rect.top;

        // Clamp securely to prevent the menu from rendering outside the host boundaries
        localX = Math.max(0, Math.min(localX, rect.width));
        localY = Math.max(0, Math.min(localY, rect.height));

        this._contextMenuX = localX;
        this._contextMenuY = localY;

        // Prevent clipping by flipping direction if past halfway
        this._contextMenuTransX = localX > (rect.width / 2) ? '-100%' : '0';
        this._contextMenuTransY = localY > (rect.height / 2) ? '-100%' : '0';

        this._contextMenuOpen = true;
        this.requestUpdate();
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
            ${this._actionBarVisible ? html`
                <div style="padding: 4px; background: var(--input-bg); border-bottom: 1px solid var(--border); display: flex; flex-shrink: 0; overflow-x: auto; scrollbar-width: none; gap: 4px; z-index: 10;">
                    <sutram-entity-actions
                        ?scrollable=${true}
                        .entityType=${'virtual_keyboard'}
                        .entityData=${{ filepath: 'terminal', term: this, ctrlLatched: this._ctrlLatched, shiftLatched: this._shiftLatched }}>
                    </sutram-entity-actions>
                </div>
            ` : ''}
            <div id="terminal-container"
                @contextmenu=${(e) => { e.preventDefault(); this._openContextMenu(); }}>
            </div>
            ${this._contextMenuOpen ? html`
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;" 
                    @mousedown=${(e) => e.preventDefault()}
                    @pointerdown=${(e) => e.preventDefault()}
                    @click=${() => { 
                        if (Date.now() - (this._menuOpenTime || 0) < 250) return; // Prevent synthesized touch 'ghost clicks' from immediately closing the menu
                        this._contextMenuOpen = false; 
                        if (this._term) this._term.focus(); 
                    }} 
                    @contextmenu=${(e) => { e.preventDefault(); this._openContextMenu(); }}>
                    <div style="position: absolute; top: ${this._contextMenuY || 0}px; left: ${this._contextMenuX || 0}px; transform: translate(${this._contextMenuTransX || '0'}, ${this._contextMenuTransY || '0'}); background: var(--pane-bg); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); padding: 5px; display: flex; flex-direction: column; min-width: 200px;"
                        @click=${(e) => e.stopPropagation()}
                        @contextmenu=${(e) => e.stopPropagation()}>
                        <sutram-entity-actions
                            .entityType=${'terminal_context'}
                            .entityData=${{ filepath: 'terminal', term: this }}
                            style="display: flex; flex-direction: column; gap: 4px; align-items: stretch;">
                        </sutram-entity-actions>
                    </div>
                </div>
            ` : ''}
        `;
    }
}
customElements.define('insetu-ext-term', InSetuExtTerm);
export class InSetuExtTermActions extends InSetuElement {
    static get extensionName() { return 'term'; }
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
            <button title="Toggle Keyboard Bar" @click=${() => {
                window.inSetu.events.emit('insetu:term:toggle-keyboard');
            }}>⌨️</button>
        `;
    }
}
customElements.define('insetu-ext-term-actions', InSetuExtTermActions);
window.ExtensionRegistry.registerExtension('term', {
        name: "Terminal Interface",
        version: "2.0.0",
        entityActions: [
                // Virtual Keyboard Plugin System
                { targetEntity: 'virtual_keyboard', id: 'vk-tab', label: 'Tab', icon: '⇥', intent: 'neutral', order: 10, onClick: (data) => { if(data.term) { data.term._sendData('\t'); if(data.term._term) data.term._term.focus(); } } },
                { targetEntity: 'virtual_keyboard', id: 'vk-ctrl', label: 'Ctrl', icon: '⌃', intent: 'neutral', order: 20, 
                    isActive: (data) => data.ctrlLatched,
                    onClick: (data) => { if(data.term) { data.term._ctrlLatched = !data.term._ctrlLatched; data.term.requestUpdate(); if(data.term._term) data.term._term.focus(); } } },
                { targetEntity: 'virtual_keyboard', id: 'vk-shift', label: 'Shift', icon: '⇧', intent: 'neutral', order: 30, 
                    isActive: (data) => data.shiftLatched,
                    onClick: (data) => { if(data.term) { data.term._shiftLatched = !data.term._shiftLatched; data.term.requestUpdate(); if(data.term._term) data.term._term.focus(); } } },
                { targetEntity: 'virtual_keyboard', id: 'vk-up', label: '▲', icon: '', intent: 'neutral', order: 40, onClick: (data) => { if(data.term) { data.term._sendData('\x1b[A'); if(data.term._term) data.term._term.focus(); } } },
                { targetEntity: 'virtual_keyboard', id: 'vk-down', label: '▼', icon: '', intent: 'neutral', order: 50, onClick: (data) => { if(data.term) { data.term._sendData('\x1b[B'); if(data.term._term) data.term._term.focus(); } } },
                { targetEntity: 'virtual_keyboard', id: 'vk-left', label: '◀', icon: '', intent: 'neutral', order: 60, onClick: (data) => { if(data.term) { data.term._sendData('\x1b[D'); if(data.term._term) data.term._term.focus(); } } },
                { targetEntity: 'virtual_keyboard', id: 'vk-right', label: '▶', icon: '', intent: 'neutral', order: 70, onClick: (data) => { if(data.term) { data.term._sendData('\x1b[C'); if(data.term._term) data.term._term.focus(); } } },

                // Terminal Context Menu
                { targetEntity: 'terminal_context', id: 'tc-copy', label: 'Copy Buffer', icon: '📋', intent: 'neutral', order: 10, onClick: (data) => { 
                    const el = data.term;
                    if(el && el._term) {
                        let text = el._term.getSelection();
                        if (!text) {
                            el._term.selectAll();
                            text = el._term.getSelection();
                            el._term.clearSelection();
                        }
                        if (text) window.inSetu.utils.copyRawText(text.trim());
                    }
                    if(el) { el._contextMenuOpen = false; el.requestUpdate(); if(el._term) el._term.focus(); }
                } },
                { targetEntity: 'terminal_context', id: 'tc-paste', label: 'Paste Clipboard', icon: '📝', intent: 'neutral', order: 20, onClick: async (data) => { 
                        const el = data.term;
                        try {
                                const text = await navigator.clipboard.readText();
                                if(el) el._sendData(text);
                        } catch(e) { 
                                if(window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("Clipboard read failed", 3000, true); 
                        }
                        if(el) { el._contextMenuOpen = false; el.requestUpdate(); if(el._term) el._term.focus(); }
                } },
                { targetEntity: 'terminal_context', id: 'tc-sigint', label: 'Send SIGINT (Ctrl+C)', icon: '🛑', intent: 'danger', order: 30, onClick: (data) => { 
                        const el = data.term;
                        if(el) el._sendData('\x03');
                        if(el) { el._contextMenuOpen = false; el.requestUpdate(); if(el._term) el._term.focus(); }
                } }
        ],
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

