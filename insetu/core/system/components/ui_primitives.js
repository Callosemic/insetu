import { LitElement, html, css } from 'lit';
import { InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

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
        if (this._status === 'failed') return html`<div style="color: var(--intent-danger); font-weight: bold; margin-top: 10px; display: flex; align-items: center; gap: 6px;"><yv-icon name="alert-triangle" style="width: 14px; height: 14px;"></yv-icon><span>Error: ${this._error}</span></div>`;
        return html`<div style="margin-top: 10px;"><sutram-spinner .text=${this._message || 'Processing...'}></sutram-spinner></div>`;
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
        this.subscribe(
            window.inSetu.stores.App,
            state => ({ isRebooting: !!state.isRebooting, rebootType: state.rebootType || 'reboot' }),
            ({ isRebooting, rebootType }) => {
                this.isRebooting = isRebooting;
                this.rebootType = rebootType;
            }
        );
    }
    render() {
        if (!this.isRebooting) return html``;
        const isPanic = this.rebootType === 'panic';
        return html`
            <div style="position:fixed; top:0; left:0; width:100vw; height:100dvh; background:var(--modal-backdrop, rgba(15,23,42,0.95)); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:${isPanic ? 'var(--intent-danger)' : 'var(--intent-primary)'}; font-family:monospace; backdrop-filter:blur(5px);">
                <h2 style="display: flex; align-items: center; gap: 10px;">
                    <yv-icon name="${isPanic ? 'alert-triangle' : 'refresh-cw'}" style="width: 24px; height: 24px;"></yv-icon>
                    <span>${isPanic ? 'Initiating Kernel Panic...' : 'Rebooting inSetu OS...'}</span>
                </h2>
                <p style="color:var(--text-muted);">${isPanic ? 'Awaiting Lifeboat FS binding...' : 'Awaiting kernel binding...'}</p>
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
        this.subscribe(
            window.inSetu.stores.App,
            state => !!state.configMissing,
            (configMissing) => {
                this.configMissing = configMissing;
            }
        );
    }
    render() {
        if (!this.configMissing) return html``;
        return html`
            <div style="background: var(--intent-warning); color: var(--bg-deep); padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <yv-icon name="alert-triangle" style="width: 16px; height: 16px;"></yv-icon>
                <span>Configuration file missing. Operating in empty fallback state.</span>
                <span style="cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;" @click=${() => window.inSetu.stores.App.setState({ configMissing: false })}>Dismiss</span>
            </div>
        `;
    }
}
customElements.define('insetu-config-banner', InSetConfigBanner);
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.ui.viewTextBlob = (title, content, suggestedFilename = '') => {
    const filename = suggestedFilename || ('blob_' + Date.now() + '.txt');
    const virtualUri = `virtual://${filename}`;
    const fsStore = window.inSetu?.stores?.Fs;
    if (fsStore) {
        fsStore.getState().openBuffer(virtualUri, {
            filename: virtualUri,
            content: content || '',
            originalContent: content || '',
            fullText: content || '',
            isTruncated: false,
            isFS: false,
            forceEdit: true,
            isMemoryOnly: true,
            isMarkdown: filename.endsWith('.md'),
            isSupportedEditor: true,
            ext: filename.split('.').pop() || 'txt',
            codeMode: filename.endsWith('.md') ? 'markdown' : 'javascript'
        });
    }
    if (window.inSetu?.vfs?.routeToSpatialGrid) {
        window.inSetu.vfs.routeToSpatialGrid(virtualUri, title || filename);
    }
};
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
export class InSetuHostDirPicker extends InSetuElement {
    static properties = {
        titleText: { type: String },
        confirmLabel: { type: String },
        initialPath: { type: String },
        _currentPath: { type: String },
        _dirs: { type: Array },
        _loading: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: block; width: 100%; box-sizing: border-box; }
        .picker-card {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .picker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
    `];

    constructor() {
        super();
        this.titleText = 'Select Host Directory';
        this.confirmLabel = 'Select Current Path';
        this.initialPath = '';
        this._currentPath = '';
        this._dirs = [];
        this._loading = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadHostDirs((this.initialPath || '').trim());
    }

    async _loadHostDirs(path = '') {
        this._loading = true;
        try {
            const res = await window.inSetu.api.workspace.get(`system/fs/list_local?path=${encodeURIComponent(path)}`);
            if (res.ok) {
                const data = await res.json();
                this._currentPath = data.current || '';
                this._dirs = data.dirs || [];
            }
        } catch (e) {
            console.error("Failed to browse host directories:", e);
        } finally {
            this._loading = false;
            this.requestUpdate();
        }
    }
    _selectDir(dirName) {
        this._loadHostDirs(this.utils.HostPath.join(this._currentPath, dirName));
    }

    _goUpDir() {
        this._loadHostDirs(this.utils.HostPath.parent(this._currentPath));
    }

    _emitCancel() {
        this.dispatchEvent(new CustomEvent('host-dir-cancelled', { bubbles: true, composed: true }));
    }

    _emitConfirm() {
        this.dispatchEvent(new CustomEvent('host-dir-selected', {
            detail: { path: this._currentPath },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        return html`
            <div class="picker-card">
                <div class="picker-header">
                    <span style="font-weight: bold; font-size: 0.95rem; color: var(--text);">${this.titleText}</span>
                    <div style="display: flex; gap: 8px;">
                        <sutram-btn size="sm" intent="neutral" icon="x" label="Cancel" @click=${() => this._emitCancel()}></sutram-btn>
                        <sutram-btn size="sm" intent="success" icon="check-circle-2" label=${this.confirmLabel} @click=${() => this._emitConfirm()}></sutram-btn>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                    <sutram-btn size="sm" intent="neutral" icon="corner-left-up" label="Parent Dir" @click=${() => this._goUpDir()}></sutram-btn>
                    <sutram-scrub-track style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--intent-primary); flex: 1;">${this._currentPath}</sutram-scrub-track>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto;">
                    ${this._loading
                        ? html`<sutram-spinner text="Loading directories..."></sutram-spinner>`
                        : (this._dirs.length === 0
                            ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">No subdirectories found.</div>`
                            : this._dirs.map(d => html`
                                <div class="yv-interactive-row" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-radius: 4px;"
                                    @click=${() => this._selectDir(d)}>
                                    <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                                    <span style="font-weight: bold; font-size: 0.9rem;">${d}</span>
                                </div>
                            `))}
                </div>
            </div>
        `;
    }
}
if (!customElements.get('insetu-host-dir-picker')) customElements.define('insetu-host-dir-picker', InSetuHostDirPicker);

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