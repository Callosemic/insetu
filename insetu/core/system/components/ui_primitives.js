import { html } from 'lit';
import {
    InSetuElement,
    sharedStyles,
    SutramProjectionWindowControls
} from '/static/extensions/system/insetu_sdk.js';
import { openProtectedChangesReview } from '/static/extensions/system/components/ui_protected_changes.js';

export class InSetuJobTracker extends InSetuElement {
    static get extensionName() { return 'system'; }
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
        if (this._status === 'failed') {
            return html`
                <sutram-surface variant="tinted" intent="danger" padding="xs">
                    <sutram-stack direction="row" align="center" gap="xs">
                        <sutram-icon name="alert-triangle" size="sm" intent="danger"></sutram-icon>
                        <strong>Error: ${this._error}</strong>
                    </sutram-stack>
                </sutram-surface>
            `;
        }
        return html`<sutram-spinner .text=${this._message || 'Processing...'}></sutram-spinner>`;
    }
}
customElements.define('insetu-job-tracker', InSetuJobTracker);
export class InSetuRebootOverlay extends InSetuElement {
    static get extensionName() { return 'system'; }
    static properties = { 
        isRebooting: { type: Boolean },
        rebootType: { type: String }
    };
    static styles = [sharedStyles];

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
            <sutram-view ?zen=${true} ?noScroll=${true}>
                <sutram-stack direction="col" align="center" justify="center" gap="sm" ?flex=${true}>
                    <sutram-stack direction="row" align="center" gap="sm">
                        <sutram-icon name=${isPanic ? 'alert-triangle' : 'refresh-cw'} size="xl" intent=${isPanic ? 'danger' : 'primary'}></sutram-icon>
                        <h2>${isPanic ? 'Initiating Kernel Panic...' : 'Rebooting inSetu OS...'}</h2>
                    </sutram-stack>
                    <sutram-label ?monospace=${true} .text=${isPanic ? 'Awaiting Lifeboat FS binding...' : 'Awaiting kernel binding...'}></sutram-label>
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-reboot-overlay', InSetuRebootOverlay);

export class InSetConfigBanner extends InSetuElement {
    static get extensionName() { return 'system'; }
    static properties = {
        configMissing: { type: Boolean },
        quarantinedModules: { type: Object },
        workspaceExtensions: { type: Object },
        protectedChangesPending: { type: Number },
        degradedCore: { type: Boolean },
        _dismissedQuarantine: { type: Boolean, state: true },
        _dismissedProtected: { type: Boolean, state: true },
        _dismissedExtensions: { type: Boolean, state: true },
        _extensionReview: { type: Array, state: true },
        _extensionBusy: { type: Boolean, state: true }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.configMissing = false;
        this.quarantinedModules = {};
        this.workspaceExtensions = {};
        this.protectedChangesPending = 0;
        this.degradedCore = false;
        this._dismissedQuarantine = false;
        this._dismissedProtected = false;
        this._dismissedExtensions = false;
        this._extensionReview = null;
        this._extensionBusy = false;
    }
    connectedCallback() {
        super.connectedCallback();
        const select = state => ({
            configMissing: !!state.configMissing,
            quarantinedModules: state.quarantinedModules || {},
            workspaceExtensions: state.workspaceExtensions || {},
            protectedChangesPending: Number(state.protectedChangesPending || 0),
            degradedCore: !!state.degradedCore
        });
        const apply = ({ configMissing, quarantinedModules, workspaceExtensions, protectedChangesPending, degradedCore }) => {
            this.configMissing = configMissing;
            this.quarantinedModules = quarantinedModules;
            this.workspaceExtensions = workspaceExtensions;
            // A new proposal brings a dismissed banner back.
            if (protectedChangesPending > this.protectedChangesPending) this._dismissedProtected = false;
            this.protectedChangesPending = protectedChangesPending;
            this.degradedCore = degradedCore;
        };
        this.subscribe(window.inSetu.stores.App, select, apply);
        // The subscription only reports later changes; boot state (topology) may already be in the store.
        apply(select(window.inSetu.stores.App.getState()));
    }
    _inspectQuarantineReport() {
        const entries = Object.values(this.quarantinedModules || {});
        if (entries.length === 0) return;
        const reportText = entries.map(e => (
            `=== [${(e.tier || 'mod').toUpperCase()}] ${e.id} (${e.status}) ===\n` +
            `Reason: ${e.reason || 'Unknown'}\n` +
            (e.traceback ? `\nTraceback:\n${e.traceback}\n` : '')
        )).join('\n\n');
        const layout = window.Sutram?.stores?.Layout?.getState?.();
        if (layout && typeof layout.openWindow === 'function') {
            layout.openWindow({
                id: 'system:quarantine-report',
                component: 'sutram-report-projection',
                label: 'Degraded Boot Traceback',
                icon: 'shield-alert',
                intent: 'danger',
                extName: 'system',
                windowOnly: true,
                props: {
                    caption: 'One or more modules failed to load during boot and were quarantined.',
                    content: reportText,
                    suggestedFilename: 'quarantined_modules_report.txt',
                    actions: [
                        {
                            label: 'Copy Traceback',
                            icon: 'clipboard',
                            intent: 'primary',
                            onClick: () => window.inSetu?.utils?.copyRawText?.(reportText, '📋 Traceback copied!')
                        },
                        {
                            label: 'Close',
                            icon: 'x',
                            intent: 'neutral',
                            onClick: () => layout.closeWindow('system:quarantine-report')
                        }
                    ]
                }
            }, layout.focusedColumn || 'center', 1);
            return;
        }
        if (window.inSetu?.ui?.viewTextBlob) {
            window.inSetu.ui.viewTextBlob('Degraded Boot: Quarantined Modules Report', reportText, 'quarantined_modules_report.txt');
        }
    }
    _pendingWorkspaceExtensions() {
        // Approved extensions that failed to load are reported by the quarantine banner instead.
        const quarantined = this.quarantinedModules || {};
        return Object.values(this.workspaceExtensions || {}).filter(e => !quarantined[e.id] && (e.status !== 'approved' || !e.loaded));
    }
    async _reviewWorkspaceExtensions() {
        // The fingerprints approved later are the ones in this report, so a person approves exactly what they read.
        this._extensionBusy = true;
        try {
            const data = await this.api.getJson('system/extensions/workspace');
            const review = (data.extensions || []).filter(e => e.status !== 'approved' || !e.loaded);
            this._extensionReview = review;
            const lines = review.map(e => {
                const changes = (e.file_changes || []).map(c => `  ${c.change.padEnd(8)} ${c.path}`).join('\n');
                return `=== ${e.id} (${e.status}) ===\n` +
                    (e.reason ? `${e.reason}\n` : '') +
                    (e.status === 'approved' ? 'Approved; loads at the next restart.\n' : '') +
                    (changes ? `Files to review in .insetu/extensions/${e.id}/:\n${changes}\n` : '') +
                    (e.fingerprint ? `Fingerprint: ${e.fingerprint}\n` : '');
            });
            if (window.inSetu?.ui?.viewTextBlob) {
                window.inSetu.ui.viewTextBlob('Workspace Extensions Awaiting Approval', lines.join('\n') || 'Nothing to review.', 'workspace_extensions_review.txt');
            }
        } catch (err) {
            this.setStatus(`❌ Could not load workspace extensions: ${err.message}`, 5000);
        } finally {
            this._extensionBusy = false;
        }
    }
    async _approveWorkspaceExtension(entry) {
        this._extensionBusy = true;
        try {
            await this.api.postJson('system/extensions/workspace/approve', { name: entry.id, fingerprint: entry.fingerprint });
            this.setStatus(`✅ Approved '${entry.id}'. Restarting...`, 3000);
            await this._restartDaemon();
        } catch (err) {
            this._extensionReview = null;
            this.setStatus(`❌ ${err.message}`, 6000);
        } finally {
            this._extensionBusy = false;
        }
    }
    async _restartDaemon() {
        await this.api.post('system/reboot', {});
        if (window.inSetu?.sys?.waitForDaemonReboot) {
            window.inSetu.sys.waitForDaemonReboot();
        } else {
            setTimeout(() => window.location.reload(), 2500);
        }
    }
    _renderWorkspaceExtensionBanner(pending) {
        const names = pending.map(e => e.id).join(', ');
        const reviewed = (this._extensionReview || []).filter(e => e.fingerprint && (e.status === 'unapproved' || e.status === 'changed'));
        const restartOnly = pending.every(e => e.status === 'approved');
        return html`
            <sutram-surface variant="banner" intent="warning">
                <sutram-stack direction="row" align="center" justify="center" gap="sm" ?wrap=${true}>
                    <sutram-icon name="shield-alert" size="md" intent="warning"></sutram-icon>
                    <strong>${restartOnly ? `Restart to load approved workspace extensions [${names}].` : `Workspace extensions not running until you approve them: [${names}].`}</strong>
                    ${restartOnly
                        ? html`<sutram-btn ?compact=${true} intent="warning" label="Restart" ?disabled=${this._extensionBusy} @click=${() => this._restartDaemon()}></sutram-btn>`
                        : html`<sutram-btn ?compact=${true} intent="warning" label="Review Files" ?disabled=${this._extensionBusy} @click=${() => this._reviewWorkspaceExtensions()}></sutram-btn>`}
                    ${reviewed.map(e => html`
                        <sutram-btn ?compact=${true} intent="danger" label=${`Approve ${e.id} & Restart`} ?disabled=${this._extensionBusy} @click=${() => this._approveWorkspaceExtension(e)}></sutram-btn>
                    `)}
                    <sutram-btn ?compact=${true} intent="neutral" label="Dismiss" @click=${() => { this._dismissedExtensions = true; }}></sutram-btn>
                </sutram-stack>
            </sutram-surface>
        `;
    }
    _renderProtectedChangesBanner() {
        const count = this.protectedChangesPending;
        return html`
            <sutram-surface variant="banner" intent="warning">
                <sutram-stack direction="row" align="center" justify="center" gap="sm" ?wrap=${true}>
                    <sutram-icon name="shield-alert" size="md" intent="warning"></sutram-icon>
                    <strong>${count === 1 ? '1 protected change is' : `${count} protected changes are`} waiting for your confirmation.</strong>
                    <sutram-btn ?compact=${true} intent="warning" label="Review Changes" @click=${() => openProtectedChangesReview()}></sutram-btn>
                    <sutram-btn ?compact=${true} intent="neutral" label="Dismiss" @click=${() => { this._dismissedProtected = true; }}></sutram-btn>
                </sutram-stack>
            </sutram-surface>
        `;
    }
    render() {
        const pendingExtensions = this._pendingWorkspaceExtensions();
        const qEntries = Object.values(this.quarantinedModules || {});
        const primaryFaults = qEntries.filter(e => e.status === 'quarantined' || e.status === 'quarantined_js');
        if (qEntries.length > 0 && !this._dismissedQuarantine) {
            const names = (primaryFaults.length > 0 ? primaryFaults : qEntries).map(e => e.id).join(', ');
            return html`
                <sutram-surface variant="banner" intent="danger">
                    <sutram-stack direction="row" align="center" justify="center" gap="sm" ?wrap=${true}>
                        <sutram-icon name="shield-alert" size="md" intent="danger"></sutram-icon>
                        <strong>
                            Degraded Boot: Quarantined [${names}]${this.degradedCore ? ' (Tier 3 extensions paused; Core Editor & Bridge active)' : ''}.
                        </strong>
                        <sutram-btn ?compact=${true} intent="danger" label="Inspect Traceback" @click=${() => this._inspectQuarantineReport()}></sutram-btn>
                        <sutram-btn ?compact=${true} intent="neutral" label="Dismiss" @click=${() => { this._dismissedQuarantine = true; }}></sutram-btn>
                    </sutram-stack>
                </sutram-surface>
            `;
        }
        if (this.protectedChangesPending > 0 && !this._dismissedProtected) {
            return this._renderProtectedChangesBanner();
        }
        if (pendingExtensions.length > 0 && !this._dismissedExtensions) {
            return this._renderWorkspaceExtensionBanner(pendingExtensions);
        }
        if (!this.configMissing) return html``;
        return html`
            <sutram-surface variant="banner" intent="warning">
                <sutram-stack direction="row" align="center" justify="center" gap="sm" ?wrap=${true}>
                    <sutram-icon name="alert-triangle" size="md" intent="warning"></sutram-icon>
                    <strong>Configuration file missing. Operating in empty fallback state.</strong>
                    <sutram-btn ?compact=${true} intent="neutral" label="Dismiss" @click=${() => window.inSetu.stores.App.setState({ configMissing: false })}></sutram-btn>
                </sutram-stack>
            </sutram-surface>
        `;
    }
}
customElements.define('insetu-config-banner', InSetConfigBanner);

export class InSetuQuarantinedSlotPlaceholder extends InSetuElement {
    static get extensionName() { return 'system'; }
    static properties = {
        quarantinedModules: { type: Object }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.quarantinedModules = {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            window.inSetu.stores.App,
            state => state.quarantinedModules || {},
            (quarantinedModules) => {
                this.quarantinedModules = quarantinedModules;
            }
        );
    }
    render() {
        const subId = this.dataset?.subId || '';
        const modId = (this.dataset?.ext) || (subId.includes(':') ? subId.split(':')[0] : subId);
        const entry = (this.quarantinedModules || {})[modId] || Object.values(this.quarantinedModules || {})[0] || {};
        return html`
            <sutram-view ?compact=${true}>
                <sutram-surface variant="tinted" intent="danger" padding="lg" gap="md">
                    <sutram-stack direction="col" align="center" gap="sm">
                        <sutram-icon name="shield-alert" size="xl" intent="danger"></sutram-icon>
                        <h3>Module Quarantined: ${entry.id || modId || 'Extension'}</h3>
                        <sutram-label .text=${entry.reason || 'This module is temporarily paused in Degraded Mode. Your pinned tab layout is preserved.'}></sutram-label>
                    </sutram-stack>
                    ${entry.traceback ? html`<pre>${entry.traceback}</pre>` : ''}
                </sutram-surface>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-quarantined-slot-placeholder')) {
    customElements.define('insetu-quarantined-slot-placeholder', InSetuQuarantinedSlotPlaceholder);
}
window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.ui.viewTextBlob = (title, content, suggestedFilename = '') => {
    const filename = suggestedFilename || ('blob_' + Date.now() + '.txt');
    const virtualUri = `virtual://${filename}`;
    const fsStore = window.inSetu?.stores?.Fs;
    const modeInfo = window.inSetu?.editor?.resolveEditorMode
        ? window.inSetu.editor.resolveEditorMode(filename)
        : { ext: 'txt', mode: filename.endsWith('.md') ? 'markdown' : 'plaintext', isMarkdown: filename.endsWith('.md') };
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
            isMarkdown: Boolean(modeInfo.isMarkdown),
            ext: modeInfo.ext || 'txt',
            codeMode: modeInfo.mode || 'plaintext'
        });
    }
    if (window.inSetu?.vfs?.routeToSpatialGrid) {
        window.inSetu.vfs.routeToSpatialGrid(virtualUri, title || filename);
    }
};
export class InSetuProjectionWindowControls extends SutramProjectionWindowControls {}
if (!customElements.get('insetu-projection-window-controls')) customElements.define('insetu-projection-window-controls', InSetuProjectionWindowControls);

export class InSetuHostDirPicker extends InSetuElement {
    static get extensionName() { return 'system'; }
    static properties = {
        titleText: { type: String },
        confirmLabel: { type: String },
        initialPath: { type: String },
        _currentPath: { type: String },
        _dirs: { type: Array },
        _loading: { type: Boolean }
    };
    static styles = [sharedStyles];

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
            const res = await this.api.get(`system/fs/list_local?path=${encodeURIComponent(path)}`);
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
            <sutram-surface variant="panel" padding="md" gap="md">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <strong>${this.titleText}</strong>
                    <sutram-stack direction="row" gap="sm">
                        <sutram-btn ?compact=${true} intent="neutral" icon="x" label="Cancel" @click=${() => this._emitCancel()}></sutram-btn>
                        <sutram-btn ?compact=${true} intent="success" icon="check-circle-2" label=${this.confirmLabel} @click=${() => this._emitConfirm()}></sutram-btn>
                    </sutram-stack>
                </sutram-stack>
                <sutram-surface variant="ghost" border="bottom" padding="xs">
                    <sutram-stack direction="row" align="center" gap="sm">
                        <sutram-btn ?compact=${true} intent="neutral" icon="corner-left-up" label="Parent Dir" @click=${() => this._goUpDir()}></sutram-btn>
                        <sutram-scrub-track ?grow=${true} ?monospace=${true}>${this._currentPath}</sutram-scrub-track>
                    </sutram-stack>
                </sutram-surface>
                <sutram-stack direction="col" gap="xs" ?scrollable=${true}>
                    ${this._loading
                        ? html`<sutram-spinner text="Loading directories..."></sutram-spinner>`
                        : (this._dirs.length === 0
                            ? html`<sutram-empty-state text="No subdirectories found."></sutram-empty-state>`
                            : this._dirs.map(d => html`
                                <sutram-surface variant="inset" padding="xs" ?interactive=${true} @click=${() => this._selectDir(d)}>
                                    <sutram-stack direction="row" align="center" gap="sm">
                                        <sutram-icon name="folder" size="md" intent="warning"></sutram-icon>
                                        <strong>${d}</strong>
                                    </sutram-stack>
                                </sutram-surface>
                            `))}
                </sutram-stack>
            </sutram-surface>
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