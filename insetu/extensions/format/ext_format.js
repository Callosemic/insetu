import { html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
const AppStore = window.inSetu.stores.App;
export const FormatStore = createExtensionStore('Format', {
    formatModalOpen: false,
    currentFormatTarget: '',
    formatMode: 'pdf',
    activeFormatJobId: null
});

window.inSetu.stores.Format = FormatStore;

export class InSetuExtFormatModals extends InSetuElement {
    static properties = {
        formatModalOpen: { type: Boolean },
        currentFormatTarget: { type: String },
        formatMode: { type: String },
        activeFormatJobId: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.formatModalOpen = false;
        this.currentFormatTarget = '';
        this.formatMode = 'pdf';
        this.activeFormatJobId = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(FormatStore, state => {
            this.formatModalOpen = state.formatModalOpen;
            this.currentFormatTarget = state.currentFormatTarget;
            this.formatMode = state.formatMode;
            this.activeFormatJobId = state.activeFormatJobId;
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUnload) {
            window.inSetu.extensions.Registry.executeUnload('format');
        }
    }
    async _executePublish() {
        FormatStore.setState({ activeFormatJobId: 'starting' });
        try {
            const res = await this.api.post('compile-document', { 
                filepath: this.currentFormatTarget, 
                format: this.formatMode 
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Compilation request failed.");
            }
            const data = await res.json();
            FormatStore.setState({ activeFormatJobId: data.job_id });
        } catch (e) {
            FormatStore.setState({ activeFormatJobId: null });
            alert("Error starting format job: " + e.message);
        }
    }

    render() {
        return html`
            <insetu-modal ?open=${this.formatModalOpen} titleText="Publish Document" @modal-closed=${() => FormatStore.setState({ formatModalOpen: false })}>
                <div slot="body">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9rem;">Target Format:</label>
                    <select style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); margin-bottom: 15px; font-weight: bold;"
                        .value=${this.formatMode} @change=${e => FormatStore.setState({ formatMode: e.target.value })}>
                        <option value="pdf">PDF (Requires LaTeX/pdflatex)</option>
                        <option value="docx">Word Document (.docx)</option>
                        <option value="html">HTML Webpage</option>
                    </select>
                    <insetu-job-tracker 
                        .jobId=${this.activeFormatJobId} 
                        @job-complete=${async (e) => {
                            FormatStore.setState({ activeFormatJobId: null, formatModalOpen: false });
                            if (this.vfs && this.vfs.downloadFile) await this.vfs.downloadFile(e.detail.artifact.download_url, e.detail.artifact.filename);
                        }}
                        @job-error=${() => FormatStore.setState({ activeFormatJobId: null })}>
                    </insetu-job-tracker>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;"
                        ?disabled=${!!this.activeFormatJobId} @click=${this._executePublish}>
                        🚀 Compile & Download
                    </button>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-format-modals', InSetuExtFormatModals);
window.ExtensionRegistry.registerExtension('format', {
    name: "Document Formatting",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'format-doc',
            label: 'Publish',
            icon: '📄',
            intent: 'primary',
            order: 40,
            match: (data) => data.filepath && data.filepath.toLowerCase().endsWith('.md'),
            onClick: (data, e) => {
                FormatStore.setState({ formatModalOpen: true, currentFormatTarget: data.filepath, formatJobError: null, activeFormatJobId: null });
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-format-modals"
        }
    ],
    uiHooks: {
        'zone:modal-ext-menu': (data) => {
            if (data.isMarkdown) {
                data.menuItems.push({ label: 'Publish', icon: '📄', onClick: () => {
                    FormatStore.setState({ formatModalOpen: true, currentFormatTarget: data.filepath, formatJobError: null, activeFormatJobId: null });
                }});
            }
            return false;
        }
    }
});