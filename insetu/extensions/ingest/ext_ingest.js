import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

const AppStore = window.inSetu.stores.App;

export const IngestStore = createExtensionStore('Ingest', {
    ingestModalOpen: false,
    ingestUrl: '',
    ingestMethod: 'bs4',
    ingestStatus: null,
    ingestError: null
});
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Ingest = IngestStore;
export class InSetuExtIngestActions extends InSetuElement {
    static get extensionName() { return 'ingest'; }
    static styles = [sharedStyles];
    render() {
        return html`
            <sutram-surface variant="panel" padding="xs">
                <sutram-stack direction="row" align="center" gap="sm">
                    <sutram-btn ?compact=${true} intent="primary" icon="globe" label="Import from URL" @click=${(e) => { e.preventDefault(); IngestStore.setState({ ingestModalOpen: true, ingestError: null, ingestStatus: null }); }}></sutram-btn>
                </sutram-stack>
            </sutram-surface>
        `;
    }
}
customElements.define('insetu-ext-ingest-actions', InSetuExtIngestActions);

export class InSetuExtIngestModals extends InSetuElement {
    static get extensionName() { return 'ingest'; }
    static properties = {
        ingestModalOpen: { type: Boolean },
        ingestUrl: { type: String },
        ingestMethod: { type: String },
        ingestStatus: { type: String },
        ingestError: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.ingestModalOpen = false;
        this.ingestUrl = '';
        this.ingestMethod = 'bs4';
        this.ingestStatus = null;
        this.ingestError = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            IngestStore,
            state => ({
                ingestModalOpen: !!state.ingestModalOpen,
                ingestUrl: state.ingestUrl || '',
                ingestMethod: state.ingestMethod || 'bs4',
                ingestStatus: state.ingestStatus || null,
                ingestError: state.ingestError || null
            }),
            (slice) => {
                Object.assign(this, slice);
            }
        );
    }
    _getImportAction() {
        return this.api.bindJobAction('ingest/url', () => {
            const url = this.ingestUrl.trim();
            if (!url) throw new Error("Please enter a valid URL.");
            IngestStore.setState({ ingestStatus: 'Fetching and converting...', ingestError: null });
            return { url, method: this.ingestMethod };
        }, {
            onProgress: (msg) => IngestStore.setState({ ingestStatus: msg }),
            onComplete: (statusData) => {
                const artifact = statusData?.artifact || {};
                const slug = (() => {
                    const titleBase = (artifact.title && artifact.title !== 'Imported Content') ? this.utils.slugify(artifact.title) : '';
                    const urlBase = (() => {
                        if (titleBase) return titleBase;
                        try {
                            const urlObj = new URL(artifact.resolved_url || this.ingestUrl.trim());
                            return (urlObj.pathname.split('/').pop() || urlObj.hostname).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                        } catch (e) { return ''; }
                    })();
                    return (urlBase || 'imported-article').replace(/^-+|-+$/g, '').substring(0, 60);
                })();
                const suggestedFilename = `${slug}.md`;
                const isNewFileWindowOpen = Boolean(
                    window.Sutram?.stores?.Layout?.getState()?.windows?.some(w => w.id === 'vfs:new-file')
                );
                if (isNewFileWindowOpen && this.editor?.insertTextAtCursor) {
                    this.editor.insertTextAtCursor(artifact.markdown || '');
                } else {
                    this.vfs?.openNewFileModal?.({ filename: suggestedFilename, content: artifact.markdown || '' });
                }
                this.dispatch('insetu:post-import-url', {
                    ...artifact,
                    slug,
                    suggestedFilename
                });

                IngestStore.setState({ ingestModalOpen: false, ingestStatus: null, ingestError: null, ingestUrl: '' });
                this.setStatus("✅ Imported markdown from URL.", 2500);
            },
            onError: (err) => {
                IngestStore.setState({ ingestStatus: null, ingestError: err.message });
            }
        });
    }
    render() {
        if (!this.ingestModalOpen) return html``;
        const missingPkgs = this.getMissingDependencies('ingest').packages;
        const bs4Missing = missingPkgs.length > 0;
        return html`
            <sutram-modal ?open=${true} titleText="Import from URL" @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) IngestStore.setState({ ingestModalOpen: false }); }}>
                <sutram-stack slot="body" direction="col" gap="md">
                    <sutram-input label="Target URL:" placeholder="https://..." ?flush=${true} .value=${this.ingestUrl} @sutram-input-changed=${e => IngestStore.setState({ ingestUrl: e.detail.value })}></sutram-input>

                    <sutram-select 
                        label="Extraction Method:" 
                        ?flush=${true}
                        .value=${this.ingestMethod} 
                        .options=${[
                            {value: 'bs4', label: bs4Missing ? `BeautifulSoup Local (⚠️ Missing ${missingPkgs.join(', ')})` : 'BeautifulSoup Local (bs4 & markdownify)'},
                            {value: 'jina', label: 'Jina Reader API (sends the URL to r.jina.ai)'}
                        ]} 
                        @sutram-input-changed=${e => IngestStore.setState({ ingestMethod: e.detail.value })}>
                    </sutram-select>

                    ${this.ingestMethod === 'bs4' && bs4Missing ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <sutram-label intent="warning" .text=${`Local parsing requires: ${missingPkgs.join(', ')}`}></sutram-label>
                                <sutram-async-btn
                                    ?compact=${true}
                                    intent="primary"
                                    icon="download"
                                    label="Install Now"
                                    .onClick=${this.installExtensionDependencies('ingest')}>
                                </sutram-async-btn>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}

                    ${this.ingestStatus ? html`<sutram-label .text=${this.ingestStatus}></sutram-label>` : ''}
                    ${this.ingestError ? html`<sutram-surface variant="tinted" intent="danger" padding="xs"><sutram-label intent="danger" .text=${`❌ Error: ${this.ingestError}`}></sutram-label></sutram-surface>` : ''}
                </sutram-stack>
                <sutram-async-btn slot="footer" label="📥 Fetch & Convert" intent="primary" .onClick=${this._getImportAction()}></sutram-async-btn>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-ingest-modals', InSetuExtIngestModals);

window.ExtensionRegistry.registerExtension('ingest', {
    name: "URL Ingestion",
    version: "2.0.0",
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-ingest-modals"
        },
        {
            slot: "modal:new-file:actions",
            component: "insetu-ext-ingest-actions"
        }
    ]
});