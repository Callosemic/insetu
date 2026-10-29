import { html, css } from 'lit';
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
    static styles = [sharedStyles, css`
        .snippet-box {
            margin-top: 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
        }
        .snippet-pre {
            margin: 0;
            padding: 12px;
            background: var(--bg-deep);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-family: var(--font-mono);
            font-size: 0.8rem;
            line-height: 1.45;
            color: var(--text);
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 320px;
            overflow-y: auto;
        }
    `];

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
                <div slot="body" style="display: flex; flex-direction: column; gap: 12px;">
                    ${missingPandoc ? html`
                        <div style="padding: 10px 12px; background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 6px; color: var(--intent-danger); font-size: 0.82rem;">
                            ⚠️ System binary <code>pandoc</code> was not found in PATH. Install Pandoc on your host OS to compile documents.
                        </div>
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
                        <div style="padding: 12px; background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 4px; color: var(--intent-danger); font-size: 0.85rem; font-family: var(--font-mono); white-space: pre-wrap;">
                            <strong>Error:</strong> ${this.publishError}
                        </div>
                    ` : ''}

                    ${this.snippetHtml ? html`
                        <div class="snippet-box">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="font-size: 0.85rem; font-weight: bold; color: var(--intent-success); display: flex; align-items: center; gap: 6px;">
                                    <yv-icon name="check-circle-2" style="width: 16px; height: 16px;"></yv-icon>
                                    <span>HTML Snippet Ready (${this.snippetHtml.length} chars)</span>
                                </span>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <sutram-btn
                                        size="sm"
                                        intent="success"
                                        icon="clipboard"
                                        label="Copy for Substack (Rich Paste)"
                                        @click=${() => this._copyRichForSubstack(this.snippetHtml)}>
                                    </sutram-btn>
                                    <sutram-btn
                                        size="sm"
                                        intent="highlight"
                                        icon="code"
                                        label="Copy Raw HTML Tags"
                                        @click=${() => this._copyRawHtml(this.snippetHtml)}>
                                    </sutram-btn>
                                </div>
                            </div>
                            <pre class="snippet-pre">${this.snippetHtml}</pre>
                        </div>
                    ` : ''}
                </div>
                <div slot="footer" style="display: flex; gap: 10px; width: 100%;">
                    <sutram-async-btn 
                        icon="${isSnippetMode ? 'code' : 'download'}"
                        label="${isSnippetMode ? 'Generate & Copy Substack Snippet' : 'Compile & Download'}" 
                        intent="primary" 
                        style="flex: 1; margin: 0;"
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
                </div>
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