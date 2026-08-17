import { html, css } from 'lit';
import { sharedStyles } from '../core/shared_styles.js';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';

const AppStore = window.inSetu.stores.App;

export const IngestStore = createExtensionStore('Ingest', {
    ingestModalOpen: false,
    ingestUrl: '',
    ingestMethod: 'jina',
    ingestStatus: null,
    ingestError: null,
    activeIngestJobId: null
});
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Ingest = IngestStore;
export class InSetuExtIngestActions extends InSetuElement {
    static styles = [sharedStyles];
    render() {
        return html`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; padding: 8px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; align-items: center;">
                <button @click=${(e) => { e.preventDefault(); IngestStore.setState({ ingestModalOpen: true, ingestError: null, ingestStatus: null }); }} class="btn-sm" style="background: var(--intent-primary); margin: 0;">🌐 Import from URL</button>
            </div>
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
        ingestError: { type: String },
        activeIngestJobId: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.ingestModalOpen = false;
        this.ingestUrl = '';
        this.ingestMethod = 'jina';
        this.ingestStatus = null;
        this.ingestError = null;
        this.activeIngestJobId = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(IngestStore, state => {
            this.ingestModalOpen = state.ingestModalOpen;
            this.ingestUrl = state.ingestUrl;
            this.ingestMethod = state.ingestMethod;
            this.ingestStatus = state.ingestStatus;
            this.ingestError = state.ingestError;
            this.activeIngestJobId = state.activeIngestJobId;
        });
    }
    _getImportAction() {
        return this.api.bindJobAction('url', () => {
            const url = this.ingestUrl.trim();
            if (!url) throw new Error("Please enter a valid URL.");
            IngestStore.setState({ ingestStatus: 'Fetching and converting...', ingestError: null });
            return { url, method: this.ingestMethod };
        }, {
            onProgress: (msg) => IngestStore.setState({ ingestStatus: msg }),
            onComplete: (statusData) => {
                const fsState = window.inSetu.stores.Fs.getState();
                const currentContent = fsState.modals.newFile?.content || '';
                const shouldOverwrite = currentContent.trim() !== '' ? confirm("Overwrite existing content with imported markdown?") : false;
                const newContent = (shouldOverwrite || currentContent.trim() === '') ? statusData.artifact.markdown : currentContent + '\n\n' + statusData.artifact.markdown;
                fsState.setModal('newFile', { content: newContent });
                window.inSetu.events.emitHook('zone:post-import-url', statusData.artifact);

                const currentFileName = fsState.modals.newFile?.fileName || '';
                if (currentFileName.trim() === '') {
                    const slug = (() => {
                        const titleBase = (statusData.artifact.title && statusData.artifact.title !== 'Imported Content') ? window.inSetu.utils.slugify(statusData.artifact.title) : '';
                        const urlBase = (() => {
                            if (titleBase) return titleBase;
                            try {
                                const urlObj = new URL(statusData.artifact.resolved_url || url);
                                return (urlObj.pathname.split('/').pop() || urlObj.hostname).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                            } catch(e) { return ''; }
                        })();
                        return (urlBase || 'imported-article').replace(/^-+|-+$/g, '').substring(0, 60);
                    })();
                    fsState.setModal('newFile', { fileName: slug + '.md' });
                }

                IngestStore.setState({ ingestStatus: '✅ Success' });
                setTimeout(() => IngestStore.setState({ ingestModalOpen: false, ingestStatus: null, ingestUrl: '' }), 1000);
            },
            onError: (err) => {
                IngestStore.setState({ ingestStatus: null, ingestError: err.message });
            }
        });
    }
    render() {
        return html`
            <sutram-modal ?open=${this.ingestModalOpen} titleText="Import from URL" @sutram-modal-closed=${() => IngestStore.setState({ ingestModalOpen: false })}>
                <div slot="body">
                    <sutram-input label="Target URL:" placeholder="https://..." .value=${this.ingestUrl} @sutram-input-changed=${e => IngestStore.setState({ ingestUrl: e.detail.value })}></sutram-input>

                    <sutram-select 
                        label="Extraction Method:" 
                        .value=${this.ingestMethod} 
                        .options=${[
                            {value: 'jina', label: 'Jina Reader API (Clean formatting, remote server)'},
                            {value: 'bs4', label: 'BeautifulSoup Local (Fallback, requires bs4 & markdownify)'}
                        ]} 
                        @sutram-input-changed=${e => IngestStore.setState({ ingestMethod: e.detail.value })}>
                    </sutram-select>

                    ${this.ingestStatus ? html`<div style="color: var(--text-muted); font-weight: bold; margin-bottom: 10px;">${this.ingestStatus}</div>` : ''}
                    ${this.ingestError ? html`<div style="color: var(--intent-danger); font-weight: bold; margin-bottom: 10px;">❌ Error: ${this.ingestError}</div>` : ''}
                </div>
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