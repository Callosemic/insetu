import { html, css } from 'lit';
import { sharedStyles } from '../core/shared_styles.js';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };

export const PublishStore = createExtensionStore('Publish', {
    publishModalOpen: false,
    currentPublishTarget: '',
    publishMode: 'pdf',
    activePublishJobId: null
});

window.inSetu.stores.Publish = PublishStore;

export class InSetuExtPublishModals extends InSetuElement {
    static get extensionName() { return 'publish'; }
    static properties = {
        publishModalOpen: { type: Boolean },
        currentPublishTarget: { type: String },
        publishMode: { type: String },
        activePublishJobId: { type: String }
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
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.inSetu?.extensions?.Registry?.executeUnload) {
            window.inSetu.extensions.Registry.executeUnload('publish');
        }
    }

    async _executePublish() {
        PublishStore.setState({ activePublishJobId: 'starting' });
        try {
            const res = await this.api.post('compile-document', { 
                filepath: this.currentPublishTarget, 
                format: this.publishMode 
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Compilation request failed.");
            }
            const data = await res.json();
            PublishStore.setState({ activePublishJobId: data.job_id });
        } catch (e) {
            PublishStore.setState({ activePublishJobId: null });
            alert("Error starting publish job: " + e.message);
        }
    }

    render() {
        return html`
            <sutram-modal ?open=${this.publishModalOpen} ?fullscreen=${true} titleText="Publish Document" @sutram-modal-closed=${() => PublishStore.setState({ publishModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9rem;">Target Format:</label>
                    <select style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); margin-bottom: 15px; font-weight: bold;"
                        .value=${this.publishMode} @change=${e => PublishStore.setState({ publishMode: e.target.value })}>
                        <option value="pdf">PDF (Requires LaTeX/pdflatex)</option>
                        <option value="docx">Word Document (.docx)</option>
                        <option value="html">HTML Webpage</option>
                    </select>
                    <insetu-job-tracker 
                        .jobId=${this.activePublishJobId} 
                        @job-complete=${async (e) => {
                            PublishStore.setState({ activePublishJobId: null, publishModalOpen: false });
                            if (this.vfs && this.vfs.downloadFile) await this.vfs.downloadFile(e.detail.artifact.download_url, e.detail.artifact.filename);
                        }}
                        @job-error=${() => PublishStore.setState({ activePublishJobId: null })}>
                    </insetu-job-tracker>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;"
                        ?disabled=${!!this.activePublishJobId} @click=${this._executePublish}>
                        🚀 Compile & Download
                    </button>
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
                PublishStore.setState({ publishModalOpen: true, currentPublishTarget: data.filepath, activePublishJobId: null });
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-publish-modals"
        }
    ],
    uiHooks: {}
});