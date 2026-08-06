import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../../../vendor/sutram/js/shared_styles.js';
import { InSetuElement } from '../sdk.js';

export class InSetuJobTracker extends InSetuElement {
    static properties = {
        jobId: { type: String },
        interval: { type: Number },
        _status: { type: String },
        _message: { type: String },
        _error: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.jobId = null;
        this.interval = 1000;
        this._status = 'idle';
        this._message = '';
        this._error = '';
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('jobId')) {
            if (this.jobId && this.jobId !== 'starting') {
                this._startPolling();
            } else if (this.jobId === 'starting') {
                this._status = 'polling';
                this._message = 'Initializing...';
                this._error = '';
            } else {
                this._status = 'idle';
                this._message = '';
                this._error = '';
            }
        }
    }

    _startPolling() {
        this._status = 'polling';
        this._error = '';
        this.api.pollJob(this.jobId, {
            interval: this.interval,
            onProgress: (msg) => {
                this._message = msg;
                this.dispatchEvent(new CustomEvent('job-progress', { detail: { message: msg }, bubbles: true, composed: true }));
            },
            onComplete: (data) => {
                this._status = 'completed';
                this.dispatchEvent(new CustomEvent('job-complete', { detail: data, bubbles: true, composed: true }));
            },
            onError: (err) => {
                this._status = 'failed';
                this._error = err.message;
                this.dispatchEvent(new CustomEvent('job-error', { detail: { error: err.message }, bubbles: true, composed: true }));
            }
        });
    }
    render() {
        if (this._status === 'idle' || this._status === 'completed') return html``;
        if (this._status === 'failed') return html`<div style="color: var(--intent-danger); font-weight: bold; margin-top: 10px;">❌ Error: ${this._error}</div>`;
        return html`<div class="spinner" style="display: block; margin-top: 10px;">${this._message || 'Processing...'}</div>`;
    }
}
customElements.define('insetu-job-tracker', InSetuJobTracker);
export class InSetuRebootOverlay extends InSetuElement {
    static properties = { 
        isRebooting: { type: Boolean },
        rebootType: { type: String }
    };
    static styles = css`:host { display: block; }`;

    constructor() {
        super();
        this.isRebooting = false;
        this.rebootType = 'reboot';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(window.inSetu.stores.App, state => { 
            this.isRebooting = !!state.isRebooting;
            this.rebootType = state.rebootType || 'reboot';
        });
    }

    render() {
        if (!this.isRebooting) return html``;
        const isPanic = this.rebootType === 'panic';
        return html`
            <div style="position:fixed; top:0; left:0; width:100vw; height:100dvh; background:rgba(15,23,42,0.95); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:${isPanic ? '#ef4444' : '#38bdf8'}; font-family:monospace; backdrop-filter:blur(5px);">
                <h2>${isPanic ? '⚠️ Initiating Kernel Panic...' : '🔄 Rebooting inSetu OS...'}</h2>
                <p style="color:#94a3b8;">${isPanic ? 'Awaiting Lifeboat FS binding...' : 'Awaiting kernel binding...'}</p>
            </div>
        `;
    }
}
customElements.define('insetu-reboot-overlay', InSetuRebootOverlay);

export class InSetConfigBanner extends InSetuElement {
    static properties = { configMissing: { type: Boolean } };
    static styles = css`:host { display: block; }`;

    constructor() {
        super();
        this.configMissing = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(window.inSetu.stores.App, state => {
            this.configMissing = !!state.configMissing;
        });
    }
    render() {
        if (!this.configMissing) return html``;
        return html`
            <div style="background: var(--intent-warning); color: #000; padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem;">
                ⚠️ Configuration file missing. Operating in empty fallback state.
                <span style="cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;" @click=${() => window.inSetu.stores.App.setState({ configMissing: false })}>Dismiss</span>
            </div>
        `;
    }
}
customElements.define('insetu-config-banner', InSetConfigBanner);
// --- LEGACY INSETU COMPATIBILITY ALIASES ---
// Maps legacy <insetu-*> tags directly to Sutram primitives to prevent 
// template crashes in un-migrated views without polluting Sutram.
import { SutramCard, SutramModal, SutramAsyncBtn } from '../../../vendor/sutram/js/primitives.js';
if (!customElements.get('insetu-card')) customElements.define('insetu-card', class extends SutramCard {});
if (!customElements.get('insetu-modal')) customElements.define('insetu-modal', class extends SutramModal {});
if (!customElements.get('insetu-async-btn')) customElements.define('insetu-async-btn', class extends SutramAsyncBtn {});

export class InSetuSpinner extends LitElement {
    static properties = { text: { type: String } };
    static styles = css`
        :host { display: block; margin: 15px 0; }
        .spinner-container { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted, #888); font-style: italic; font-size: 0.9rem; }
        .loader { border: 2px solid var(--border, #444); border-top: 2px solid var(--intent-primary, #3b82f6); border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    render() { return html`<div class="spinner-container"><div class="loader"></div><span>${this.text || ''}<slot></slot></span></div>`; }
}
if (!customElements.get('insetu-spinner')) customElements.define('insetu-spinner', InSetuSpinner);

export class InSetuEmptyState extends LitElement {
    static properties = { icon: { type: String }, text: { type: String } };
    static styles = css`
        :host { display: block; padding: 20px; }
        .empty-container { display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted, #888); text-align: center; gap: 8px; }
        .icon { font-size: 2rem; opacity: 0.8; margin-bottom: 5px; }
        .text { font-style: italic; font-size: 0.95rem; }
    `;
    render() { return html`<div class="empty-container">${this.icon ? html`<div class="icon">${this.icon}</div>` : ''}<div class="text">${this.text || ''}<slot></slot></div></div>`; }
}
if (!customElements.get('insetu-empty-state')) customElements.define('insetu-empty-state', InSetuEmptyState);
if (!document.getElementById('insetu-toast-root')) {
    const toastRoot = document.createElement('sutram-toast-container');
    toastRoot.id = 'insetu-toast-root';
    document.body.appendChild(toastRoot);
}

if (!document.getElementById('insetu-reboot-overlay-root')) {
    const rebootRoot = document.createElement('insetu-reboot-overlay');
    rebootRoot.id = 'insetu-reboot-overlay-root';
    document.body.appendChild(rebootRoot);
}