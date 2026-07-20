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
        button { margin: 0; white-space: nowrap; width: 100%; height: 100%; box-sizing: border-box; }
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
        e.stopPropagation();
        if (this._status === 'loading' || !this.onClick) return;
        this._status = 'loading';
        try {
            await this.onClick(e);
            this._status = 'success';
        } catch (err) {
            console.error(err);
            this._status = 'error';
        } finally {
            setTimeout(() => { if (this._status !== 'loading') this._status = 'idle'; }, 2000);
        }
    }
    render() {
        let text = this.label;
        if (this._status === 'loading') text = this.loadingLabel;
        if (this._status === 'success') text = this.successLabel;
        if (this._status === 'error') text = this.errorLabel;
        return html`<button class="btn-sm" style="background: var(--intent-${this.intent});" @click=${this._handleClick}>${text}</button>`;
    }
}

export class InSetuSearchBar extends LitElement {
    static properties = {
        placeholder: { type: String },
        value: { type: String }
    };
    static styles = [sharedStyles];
    constructor() { super(); this.placeholder = 'Search...'; this.value = ''; }
    render() {
        return html`
            <div class="fuzzy-search-wrapper" style="margin: 0; border: none; border-radius: 0; background: transparent;">
                <input type="text" placeholder=${this.placeholder} .value=${this.value} 
                    style="border: none; background: transparent; padding: 4px 0; margin: 0; border-radius: 0; outline: none; box-shadow: none; width: 100%; box-sizing: border-box;"
                    @input=${(e) => this.dispatchEvent(new CustomEvent('search-changed', { detail: { value: e.target.value }, bubbles: true, composed: true }))}>
                ${this.value ? html`<button class="fuzzy-search-clear" @click=${() => this.dispatchEvent(new CustomEvent('search-changed', { detail: { value: '' }, bubbles: true, composed: true }))}>Clear</button>` : ''}
            </div>
        `;
    }
}
export class InSetuStandardToolbar extends InSetuElement {
    static properties = {
        searchQuery: { type: String },
        searchPlaceholder: { type: String },
        enableFilterDropdown: { type: Boolean },
        filterText: { type: String },
        activeFilters: { type: Array },
        hasFiltersOverride: { type: Boolean },
        noPadding: { type: Boolean },
        bottomBorder: { type: Boolean }
    };
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.searchQuery = '';
        this.searchPlaceholder = 'Search...';
        this.enableFilterDropdown = false;
        this.filterText = '';
        this.activeFilters = [];
        this.hasFiltersOverride = false;
        this.noPadding = false;
        this.bottomBorder = false;
    }

    render() {
        let btnText = this.filterText;
        let hasF = this.hasFiltersOverride || false;
        if (!btnText && this.activeFilters) {
            const active = this.activeFilters.filter(r => r !== 'ALL');
            if (active.length > 0) {
                btnText = `Filters: ${active.slice(0, 2).join(', ')}${active.length > 2 ? '...' : ''}`;
                hasF = true;
            } else {
                btnText = 'Filters';
            }
        }

        return html`
            <div class="sticky-header" style="${this.noPadding ? 'padding: 0; gap: 0;' : 'flex-shrink: 0;'}">
                <div style="${this.noPadding ? 'padding: 5px 20px;' : 'display: flex; align-items: center; gap: 10px;'} ${this.bottomBorder ? 'border-bottom: 1px solid var(--border);' : ''}">
                    <insetu-search-bar 
                        style="flex: 1;"
                        placeholder=${this.searchPlaceholder} 
                        .value=${this.searchQuery} 
                        @search-changed=${(e) => this.dispatchEvent(new CustomEvent('search-changed', { detail: e.detail, bubbles: true, composed: true }))}>
                    </insetu-search-bar>
                    ${this.enableFilterDropdown ? html`
                        <insetu-filter-dropdown filterText=${btnText} .hasFilters=${hasF}>
                            <slot name="filters"></slot>
                        </insetu-filter-dropdown>
                    ` : ''}
                </div>
                <slot name="bottom-row"></slot>
            </div>
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
customElements.define('insetu-search-bar', InSetuSearchBar);
customElements.define('insetu-standard-toolbar', InSetuStandardToolbar);
customElements.define('insetu-job-tracker', InSetuJobTracker);
customElements.define('insetu-async-btn', InSetuAsyncBtn);