import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../../../vendor/sutram/shared_styles.js';
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

if (!document.getElementById('insetu-toast-root')) {
    const toastRoot = document.createElement('sutram-toast-container');
    toastRoot.id = 'insetu-toast-root';
    document.body.appendChild(toastRoot);
}