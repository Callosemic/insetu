import { html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';

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

export class InSetuExtIngestModals extends InSetuElement {
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

    async _executeImportUrl() {
        const url = this.ingestUrl.trim();
        if (!url) return alert("Please enter a valid URL.");

        IngestStore.setState({ activeIngestJobId: 'starting', ingestStatus: 'Fetching and converting...', ingestError: null });
        try {
            const res = await this.api.post('url', { url, method: this.ingestMethod });
            if (res.ok) {
                const data = await res.json();
                IngestStore.setState({ activeIngestJobId: data.job_id });

                this.api.pollJob(data.job_id, {
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

                        IngestStore.setState({ activeIngestJobId: null, ingestStatus: '✅ Success' });
                        setTimeout(() => IngestStore.setState({ ingestModalOpen: false, ingestStatus: null, ingestUrl: '' }), 1000);
                    },
                    onError: (err) => {
                        IngestStore.setState({ activeIngestJobId: null, ingestStatus: null, ingestError: err.message });
                    }
                });

            } else {
                const err = await res.json();
                throw new Error(err.error || "Ingestion request failed.");
            }
        } catch (e) {
            IngestStore.setState({ activeIngestJobId: null, ingestError: e.message });
        }
    }
    render() {
        return html`
            <yenvui-modal ?open=${this.ingestModalOpen} titleText="Import from URL" @yenvui-modal-closed=${() => IngestStore.setState({ ingestModalOpen: false })}>
                <div slot="body">
                    <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Target URL:</label>
                    <input type="text" placeholder="https://..." style="margin-bottom: 15px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;"
                        .value=${this.ingestUrl} @input=${e => IngestStore.setState({ ingestUrl: e.target.value })}>

                    <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Extraction Method:</label>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; font-size: 0.9rem; background: var(--input-bg); padding: 10px; border: 1px solid var(--border); border-radius: 4px;"
                        @change=${e => IngestStore.setState({ ingestMethod: e.target.value })}>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <input type="radio" name="import-method" value="jina" ?checked=${this.ingestMethod === 'jina'}>  
                            <b>Jina Reader API</b> <span style="color: var(--text-muted); font-size: 0.8rem;">(Clean formatting, relies on remote server)</span>
                        </label>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <input type="radio" name="import-method" value="bs4" ?checked=${this.ingestMethod === 'bs4'}> 
                            <b>BeautifulSoup Local</b> <span style="color: var(--text-muted); font-size: 0.8rem;">(Fallback, requires pip install bs4 markdownify)</span>
                        </label>
                    </div>
                    ${this.ingestStatus ? html`<div style="color: var(--text-muted); font-weight: bold; margin-bottom: 10px;">${this.ingestStatus}</div>` : ''}
                    ${this.ingestError ? html`<div style="color: var(--intent-danger); font-weight: bold; margin-bottom: 10px;">❌ Error: ${this.ingestError}</div>` : ''}
                </div>
                <button slot="footer" style="background: var(--intent-primary); color: white;"
                    ?disabled=${!!this.ingestStatus && this.ingestStatus !== '✅ Success'} @click=${this._executeImportUrl}>
                    📥 Fetch & Convert
                </button>
            </yenvui-modal>
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
        }
    ],
    uiHooks: {
        'zone:new-file-options-lit': () => {
            return html`
                <div style="display: flex; gap: 10px; margin-bottom: 10px; padding: 8px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; align-items: center;">
                    <button @click=${(e) => { e.preventDefault(); IngestStore.setState({ ingestModalOpen: true, ingestError: null, ingestStatus: null }); }} class="btn-sm" style="background: var(--intent-primary); margin: 0;">🌐 Import from URL</button>
                </div>
            `;
        }
    }
});