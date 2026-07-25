import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { InSetuElement } from '../sdk.js';
export class InSetuAsyncBtn extends LitElement {
    static properties = {
        label: { type: String },
        loadingLabel: { type: String },
        successLabel: { type: String },
        errorLabel: { type: String },
        intent: { type: String },
        onClick: { type: Object },
        _status: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: inline-block; }
        yenvui-async-btn { display: block; width: 100%; height: 100%; }
    `];
    constructor() {
        super();
        this.label = 'Submit';
        this.loadingLabel = '⏳...';
        this.successLabel = '✅';
        this.errorLabel = '❌';
        this.intent = 'primary';
        this._status = 'idle';
    }
    async _handleClick(e) {
        if (e) e.stopPropagation();
        if (this._status === 'loading' || !this.onClick) return;
        this._status = 'loading';
        try {
            // Unwrap the original event payload if routed through yenVUI's dispatcher
            await this.onClick(e?.detail?.originalEvent || e);
            this._status = 'success';
        } catch (err) {
            console.error(err);
            this._status = 'error';
        } finally {
            setTimeout(() => { if (this._status !== 'loading') this._status = 'idle'; }, 2000);
        }
    }
    render() {
        return html`
            <yenvui-async-btn
                .label=${this.label}
                .loadingLabel=${this.loadingLabel}
                .successLabel=${this.successLabel}
                .errorLabel=${this.errorLabel}
                .intent=${this.intent}
                .status=${this._status}
                @yv-click=${this._handleClick}>
            </yenvui-async-btn>
        `;
    }
}

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
customElements.define('insetu-async-btn', InSetuAsyncBtn);
import '../../vendor/yenvui/js/status-bar.js';

export class InSetuStatusBar extends InSetuElement {
    static properties = {
        baseTitle: { type: String },
        pinnedRepos: { type: Object },
        tempMessage: { type: String },
        isError: { type: Boolean }
    };
    static styles = css`
        :host { display: block; width: 100%; flex-shrink: 0; z-index: 1000; }
    `;
    constructor() {
        super();
        this.baseTitle = 'inSetu Developer OS';
        this.pinnedRepos = new Set(['ALL']);
        this.tempMessage = '';
        this.isError = false;
        this._statusListener = this._handleStatusUpdate.bind(this);
    }
    connectedCallback() {
        super.connectedCallback();
        // Bind statelessly to the central AppStore
        this.subscribe(window.inSetu.stores.App, state => {
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        });
        window.addEventListener('insetu-status-update', this._statusListener);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('insetu-status-update', this._statusListener);
    }
    _handleStatusUpdate(e) {
        this.tempMessage = e.detail.msg;
        this.isError = e.detail.isError;
        if (this._timeout) clearTimeout(this._timeout);
        if (e.detail.timeout) {
            this._timeout = setTimeout(() => {
                this.tempMessage = '';
                this.isError = false;
            }, e.detail.timeout);
        }
    }
    render() {
        if (this.tempMessage) {
            return html`<yenvui-status-bar .text=${this.tempMessage} ?isError=${this.isError}></yenvui-status-bar>`;
        }
        let text = this.baseTitle;
        if (this.pinnedRepos && this.pinnedRepos.size > 0 && !this.pinnedRepos.has('ALL')) {
            text = `${text} | [${Array.from(this.pinnedRepos).join(', ')}]`;
        }
        return html`<yenvui-status-bar .text=${text} ?isError=${false}></yenvui-status-bar>`;
    }
}
customElements.define('insetu-status-bar', InSetuStatusBar);