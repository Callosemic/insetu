import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
export const PublishStore = createExtensionStore('Publish', {
    publishModalOpen: false,
    currentPublishTarget: '',
    publishMode: 'html_snippet',
    activePublishJobId: null,
    publishError: '',
    snippetHtml: ''
}, {
    localSync: ['publishMode']
});

window.inSetu.stores.Publish = PublishStore;

export class InSetuExtPublishModals extends InSetuElement {
    static get extensionName() { return 'publish'; }
    static properties = {
        publishModalOpen: { type: Boolean },
        currentPublishTarget: { type: String },
        publishMode: { type: String },
        activePublishJobId: { type: String },
        publishError: { type: String },
        snippetHtml: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        const st = PublishStore.getState();
        this.publishModalOpen = false;
        this.currentPublishTarget = '';
        this.publishMode = st.publishMode || 'html_snippet';
        this.activePublishJobId = null;
        this.publishError = '';
        this.snippetHtml = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            PublishStore,
            state => ({
                publishModalOpen: state.publishModalOpen,
                currentPublishTarget: state.currentPublishTarget,
                publishMode: state.publishMode,
                activePublishJobId: state.activePublishJobId,
                publishError: state.publishError,
                snippetHtml: state.snippetHtml
            }),
            (slice) => {
                Object.assign(this, slice);
            }
        );
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    async _copyRichForSubstack(htmlStr) {
        if (!htmlStr) return;
        await this.utils.copyRichHtml(htmlStr);
        this.setStatus("✅ Copied Rich HTML! Paste directly into Substack editor (Ctrl+V / Cmd+V).", 3500);
    }

    async _copyRawHtml(htmlStr) {
        if (!htmlStr) return;
        await this.utils.copyToClipboard(htmlStr);
        this.setStatus("✅ Copied raw HTML source tags to clipboard!", 2500);
    }
    render() {
        if (!this.publishModalOpen) return html``;
        const isSnippetMode = this.publishMode === 'html_snippet';
        const missingBins = this.getMissingDependencies('publish').binaries;
        const missingPandoc = missingBins.includes('pandoc');
        const missingPdflatex = missingBins.includes('pdflatex');
        return html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="Publish Document" @sutram-modal-closed=${() => PublishStore.setState({ publishModalOpen: false, snippetHtml: '', publishError: '' })}>
                <sutram-stack slot="body" direction="col" gap="md">
                    ${missingPandoc ? html`
                        <sutram-surface variant="tinted" intent="danger" padding="sm">
                            ⚠️ System binary <code>pandoc</code> was not found in PATH. Install Pandoc on your host OS to compile documents.
                        </sutram-surface>
                    ` : ''}
                    <sutram-select 
                        label="Target Format"
                        .value=${this.publishMode}
                        .options=${[
                            { value: 'html_snippet', label: 'Substack / Rich-Text Snippet (HTML Fragment)' },
                            { value: 'pdf', label: missingPdflatex ? 'PDF Document (⚠️ Missing pdflatex binary in PATH)' : 'PDF Document (LaTeX/pdflatex)' },
                            { value: 'docx', label: 'Word Document (.docx)' },
                            { value: 'html', label: 'Standalone HTML Webpage (.html)' }
                        ]}
                        @sutram-input-changed=${e => PublishStore.setState({ publishMode: e.detail.value, snippetHtml: '', publishError: '' })}>
                    </sutram-select>

                    ${this.publishError ? html`
                        <sutram-surface variant="tinted" intent="danger" padding="sm">
                            <strong>Error:</strong> ${this.publishError}
                        </sutram-surface>
                    ` : ''}

                    ${this.snippetHtml ? html`
                        <sutram-surface variant="panel" padding="md" gap="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-icon name="check-circle-2" size="md" intent="success"></sutram-icon>
                                    <strong>HTML Snippet Ready (${this.snippetHtml.length} chars)</strong>
                                </sutram-stack>
                                <sutram-stack direction="row" gap="sm" ?wrap=${true}>
                                    <sutram-btn
                                        ?compact=${true}
                                        intent="success"
                                        icon="clipboard"
                                        label="Copy for Substack (Rich Paste)"
                                        @click=${() => this._copyRichForSubstack(this.snippetHtml)}>
                                    </sutram-btn>
                                    <sutram-btn
                                        ?compact=${true}
                                        intent="highlight"
                                        icon="code"
                                        label="Copy Raw HTML Tags"
                                        @click=${() => this._copyRawHtml(this.snippetHtml)}>
                                    </sutram-btn>
                                </sutram-stack>
                            </sutram-stack>
                            <pre style="max-height: 320px; overflow-y: auto; margin: 0;">${this.snippetHtml}</pre>
                        </sutram-surface>
                    ` : ''}
                </sutram-stack>
                <sutram-stack slot="footer" direction="row" gap="sm">
                    <sutram-async-btn 
                        icon="${isSnippetMode ? 'code' : 'download'}"
                        label="${isSnippetMode ? 'Generate & Copy Substack Snippet' : 'Compile & Download'}" 
                        intent="primary" 
                        ?grow=${true}
                        .onClick=${this.api.bindJobAction('publish/compile-document', 
                            () => {
                                PublishStore.setState({ publishError: '', snippetHtml: '' });
                                return { filepath: this.currentPublishTarget, format: this.publishMode };
                            }, 
                            {
                                onProgress: (msg) => this.setStatus(`⏳ ${msg}`, null),
                                onComplete: async (statusData) => {
                                    const artifact = statusData.artifact || {};
                                    if (this.publishMode === 'html_snippet') {
                                        let snippet = artifact.snippet_html || '';
                                        if (!snippet && artifact.download_url) {
                                            try {
                                                const res = await this.api.request(artifact.download_url);
                                                if (res.ok) snippet = (await res.text()).trim();
                                            } catch (_) {}
                                        }
                                        if (snippet) {
                                            PublishStore.setState({ snippetHtml: snippet });
                                            await this._copyRichForSubstack(snippet);
                                        } else {
                                            PublishStore.setState({
                                                publishError: "Snippet payload was empty. Please reboot the inSetu daemon (Settings Hub -> Reboot) so the updated Publish engine loads."
                                            });
                                        }
                                        return;
                                    }
                                    if (this.vfs && this.vfs.downloadFile) {
                                        try {
                                            await this.vfs.downloadFile(artifact.download_url, artifact.filename);
                                        } catch (err) {
                                            PublishStore.setState({ publishError: "Download failed: " + err.message });
                                        }
                                    }
                                    PublishStore.setState({ publishModalOpen: false });
                                    this.setStatus("✅ Compilation successful.", 2000);
                                },
                                onError: (err) => {
                                    PublishStore.setState({ publishError: err.message });
                                    this.setStatus("❌ Compile failed.", 5000, true);
                                }
                            }
                        )}>
                    </sutram-async-btn>
                </sutram-stack>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-publish-modals', InSetuExtPublishModals);

window.ExtensionRegistry.registerExtension('publish', {
    name: "Document Publishing",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'publish-doc',
            label: 'Publish',
            icon: 'book-open',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 40,
            match: (data) => {
                if (!data) return false;
                const fp = (data.filepath || data.path || data.filename || '').toLowerCase();
                return fp.endsWith('.md');
            },
            onClick: (data, e) => {
                PublishStore.setState({ publishModalOpen: true, currentPublishTarget: data.filepath, activePublishJobId: null, publishError: '', snippetHtml: '' });
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-publish-modals"
        }
    ]
});