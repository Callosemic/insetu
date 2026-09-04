import { html, css } from 'lit';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
export const PublishStore = createExtensionStore('Publish', {
    publishModalOpen: false,
    currentPublishTarget: '',
    publishMode: 'pdf',
    activePublishJobId: null,
    publishError: ''
});

window.inSetu.stores.Publish = PublishStore;

export class InSetuExtPublishModals extends InSetuElement {
    static get extensionName() { return 'publish'; }
    static properties = {
        publishModalOpen: { type: Boolean },
        currentPublishTarget: { type: String },
        publishMode: { type: String },
        activePublishJobId: { type: String },
        publishError: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.publishModalOpen = false;
        this.currentPublishTarget = '';
        this.publishMode = 'pdf';
        this.activePublishJobId = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(PublishStore, state => {
            this.publishModalOpen = state.publishModalOpen;
            this.currentPublishTarget = state.currentPublishTarget;
            this.publishMode = state.publishMode;
            this.activePublishJobId = state.activePublishJobId;
            this.publishError = state.publishError;
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.inSetu?.extensions?.Registry?.executeUnload) {
            window.inSetu.extensions.Registry.executeUnload('publish');
        }
    }

    render() {
        return html`
            <sutram-modal ?open=${this.publishModalOpen} ?fullscreen=${true} titleText="Publish Document" @sutram-modal-closed=${() => PublishStore.setState({ publishModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <sutram-select 
                        label="Target Format"
                        .value=${this.publishMode}
                        .options=${[
                            { value: 'pdf', label: 'PDF (Requires LaTeX/pdflatex)' },
                            { value: 'docx', label: 'Word Document (.docx)' },
                            { value: 'html', label: 'HTML Webpage' }
                        ]}
                        @sutram-input-changed=${e => PublishStore.setState({ publishMode: e.detail.value })}>
                    </sutram-select>

                    ${this.publishError ? html`
                        <div style="margin-top: 15px; padding: 12px; background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 4px; color: var(--intent-danger); font-size: 0.85rem; font-family: var(--font-mono); white-space: pre-wrap;">
                            <strong>Error:</strong> ${this.publishError}
                        </div>
                    ` : ''}
                </div>
                <div slot="footer">
                    <sutram-async-btn 
                        label="🚀 Compile & Download" 
                        intent="primary" 
                        style="flex: 1; margin: 0; --btn-padding: 15px;"
                        .onClick=${this.api.bindJobAction('compile-document', 
                            () => {
                                PublishStore.setState({ publishError: '' });
                                return { filepath: this.currentPublishTarget, format: this.publishMode };
                            }, 
                            {
                                onProgress: (msg) => this.setStatus(`⏳ ${msg}`, null),
                                onComplete: async (statusData) => {
                                    const artifact = statusData.artifact;
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
            icon: '📄',
            intent: 'primary',
            order: 40,
            match: (data) => {
                if (!data) return false;
                const fp = (data.filepath || data.path || data.filename || '').toLowerCase();
                return fp.endsWith('.md');
            },
            onClick: (data, e) => {
                PublishStore.setState({ publishModalOpen: true, currentPublishTarget: data.filepath, activePublishJobId: null, publishError: '' });
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