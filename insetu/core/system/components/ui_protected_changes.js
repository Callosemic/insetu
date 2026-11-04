// S8: the review window for pending changes to protected files (the CLI, the lifeboat, the credential store),
// one change at a time as a diff against the file as it is now, with Confirm and Discard.
import { html } from 'lit';
import { InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

/** SHA-256 of the content the window rendered (or 'delete'), sent with Confirm so the server writes only what the person saw. */
export async function hashReviewedContent(change) {
    if (change.action === 'delete') return 'delete';
    const bytes = new TextEncoder().encode(change.content ?? '');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Shows pending protected changes one at a time as diffs, with Previous and Next, Confirm and Discard. */
export class InSetuProtectedChangesProjection extends InSetuElement {
    static get extensionName() { return 'system'; }
    static properties = {
        _changes: { type: Array, state: true },
        _selectedId: { type: String, state: true },
        _loading: { type: Boolean, state: true },
        _busyId: { type: String, state: true },
        _error: { type: String, state: true }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this._changes = [];
        this._selectedId = null;
        this._loading = true;
        this._busyId = null;
        this._error = '';
    }
    connectedCallback() {
        super.connectedCallback();
        // A new proposal, or a confirmation in another tab, changes the daemon-wide count.
        this.subscribe(window.inSetu.stores.App, state => state.protectedChangesPending, () => this._load());
        this._load();
    }
    async _load() {
        try {
            const data = await this.api.getJson('system/protected/pending');
            this._changes = data.changes || [];
            this._error = '';
        } catch (err) {
            this._error = err.message || 'Could not load pending changes.';
        } finally {
            this._loading = false;
        }
    }
    _current() {
        // The selection survives reloads; once its change is gone, the oldest waiting change is shown.
        return this._changes.find(c => c.id === this._selectedId) || this._changes[0] || null;
    }
    _step(delta) {
        const index = this._changes.indexOf(this._current());
        const next = this._changes[(index + delta + this._changes.length) % this._changes.length];
        if (next) this._selectedId = next.id;
    }
    async _confirm(change) {
        this._busyId = change.id;
        try {
            const resultHash = await hashReviewedContent(change);
            await this.api.postJson('system/protected/confirm', { change_id: change.id, result_hash: resultHash });
            this.setStatus(`✅ ${change.action === 'delete' ? 'Deleted' : 'Wrote'} ${change.filepath}.`, 3000);
        } catch (err) {
            this.setStatus(`❌ ${err.message}`, 8000);
        } finally {
            this._busyId = null;
            await this._load();
        }
    }
    async _discard(change) {
        this._busyId = change.id;
        try {
            await this.api.postJson('system/protected/discard', { change_id: change.id });
            this.setStatus(`Discarded the change to ${change.filepath}.`, 3000);
        } catch (err) {
            this.setStatus(`❌ ${err.message}`, 6000);
        } finally {
            this._busyId = null;
            await this._load();
        }
    }
    _describeProposer(change) {
        const by = change.proposed_by || {};
        const when = change.created_at ? new Date(change.created_at * 1000).toLocaleString() : '';
        return [`From ${by.origin || 'unknown'}`, by.source, by.reference, when].filter(Boolean).join(' · ');
    }
    _renderHeader(change) {
        const busy = this._busyId === change.id;
        const count = this._changes.length;
        const position = this._changes.indexOf(change) + 1;
        return html`
            <sutram-surface slot="header" variant="panel" border="bottom" padding="xs">
                <sutram-stack direction="col" gap="xs">
                    <sutram-label intent="warning" .text=${'Nothing here has been written. Confirming runs a smoke test first and keeps the previous version as the last-good copy.'}></sutram-label>
                    <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                        ${count > 1 ? html`
                            <sutram-btn ?compact=${true} intent="neutral" icon="chevron-left" label="Previous" @click=${() => this._step(-1)}></sutram-btn>
                            <sutram-label .text=${`${position} of ${count}`}></sutram-label>
                            <sutram-btn ?compact=${true} intent="neutral" icon="chevron-right" label="Next" @click=${() => this._step(1)}></sutram-btn>
                        ` : ''}
                        <code>${change.filepath}</code>
                        <sutram-tag .text=${change.action === 'delete' ? 'Delete' : 'Change'} .intent=${change.action === 'delete' ? 'danger' : 'warning'}></sutram-tag>
                        ${change.stale ? html`<sutram-tag text="File changed since" intent="danger"></sutram-tag>` : ''}
                    </sutram-stack>
                    <sutram-label .text=${this._describeProposer(change)}></sutram-label>
                    ${change.stale ? html`
                        <sutram-label intent="danger" .text=${'The file changed after this was proposed. Confirming would overwrite newer work, so only Discard is available.'}></sutram-label>
                    ` : ''}
                    <sutram-stack direction="row" justify="end" align="center" gap="sm" ?wrap=${true}>
                        <sutram-btn ?compact=${true} intent="neutral" icon="x" label="Discard" ?disabled=${busy} @click=${() => this._discard(change)}></sutram-btn>
                        <sutram-btn ?compact=${true} intent="danger" icon="check" label=${change.action === 'delete' ? 'Confirm Delete' : 'Confirm & Write'} ?disabled=${busy || change.stale} @click=${() => this._confirm(change)}></sutram-btn>
                    </sutram-stack>
                </sutram-stack>
            </sutram-surface>
        `;
    }
    render() {
        if (this._loading) {
            return html`<sutram-view><sutram-spinner text="Loading protected changes..."></sutram-spinner></sutram-view>`;
        }
        if (this._error) {
            return html`<sutram-view><sutram-surface variant="tinted" intent="danger" padding="md"><sutram-label intent="danger" .text=${this._error}></sutram-label></sutram-surface></sutram-view>`;
        }
        const change = this._current();
        if (!change) {
            return html`<sutram-view><sutram-surface padding="md"><sutram-label .text=${'No protected changes are waiting.'}></sutram-label></sutram-surface></sutram-view>`;
        }
        // One change at a time, with the diff viewer filling the window like the other diff projections: it scrolls
        // itself and keeps its view toggle (side by side, stacked, interleaved) in reach.
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                ${this._renderHeader(change)}
                <sutram-diff-viewer
                    .searchStr=${change.current_content ?? ''}
                    .replaceStr=${change.action === 'delete' ? '' : (change.content ?? '')}
                    .leftTitle=${'Now on disk'}
                    .rightTitle=${change.action === 'delete' ? 'Deleted' : 'Proposed'}>
                </sutram-diff-viewer>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-protected-changes-projection')) {
    customElements.define('insetu-protected-changes-projection', InSetuProtectedChangesProjection);
}

/** Opens the review window beside the current column. */
export function openProtectedChangesReview() {
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (!layout) return;
    layout.openWindow({
        id: 'system:protected-changes',
        component: 'insetu-protected-changes-projection',
        label: 'Protected Changes',
        icon: 'shield-alert',
        intent: 'warning',
        extName: 'system',
        windowOnly: true,
        props: {}
    }, layout.focusedColumn || 'center', 1);
}
