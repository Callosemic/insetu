import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
import { downloadFile } from '../fs.js';
import { AppStore } from '../store.js';

export const FormatStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            formatModalOpen: false,
            currentFormatTarget: '',
            formatMode: 'pdf',
            activeFormatJobId: null,
            formatJobMessage: null,
            formatJobError: null
        })),
        { name: 'FormatStore' }
    )
);
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
window.inSetu.stores.Format = FormatStore;

export class InSetuExtFormatModals extends LitElement {
    static properties = {
        formatModalOpen: { type: Boolean },
        currentFormatTarget: { type: String },
        formatMode: { type: String },
        activeFormatJobId: { type: String },
        formatJobMessage: { type: String },
        formatJobError: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.formatModalOpen = false;
        this.currentFormatTarget = '';
        this.formatMode = 'pdf';
        this.activeFormatJobId = null;
        this.formatJobMessage = null;
        this.formatJobError = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this._unsub = FormatStore.subscribe(state => {
            this.formatModalOpen = state.formatModalOpen;
            this.currentFormatTarget = state.currentFormatTarget;
            this.formatMode = state.formatMode;
            this.activeFormatJobId = state.activeFormatJobId;
            this.formatJobMessage = state.formatJobMessage;
            this.formatJobError = state.formatJobError;
        });

        if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerTick) {
            window.inSetu.extensions.Registry.registerTick('format', 1000, async () => {
                const { activeFormatJobId } = FormatStore.getState();
                if (!activeFormatJobId || activeFormatJobId === 'starting') return;
                try {
                    const statusRes = await window.inSetu.api.system(`jobs/${activeFormatJobId}`);
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        FormatStore.setState({ formatJobMessage: statusData.message || "⏳ Compiling..." });
                        if (statusData.status === 'completed') {
                            FormatStore.setState({ activeFormatJobId: null, formatModalOpen: false });
                            if (window.downloadFile) await window.downloadFile(statusData.artifact.download_url, statusData.artifact.filename);
                        } else if (statusData.status === 'failed') {
                            FormatStore.setState({ activeFormatJobId: null, formatJobError: statusData.message });
                        }
                    }
                } catch (e) {
                    console.error("Format polling error:", e);
                }
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
        if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.executeUnload) {
            window.inSetu.extensions.Registry.executeUnload('format');
        }
    }
    async _executePublish() {
        FormatStore.setState({ activeFormatJobId: 'starting', formatJobMessage: '⏳ Compiling...', formatJobError: null });
        try {
            const res = await window.inSetu.api.workspace('format/compile-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath: this.currentFormatTarget, format: this.formatMode })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Compilation request failed.");
            }
            const data = await res.json();
            FormatStore.setState({ activeFormatJobId: data.job_id, formatJobMessage: '⏳ Compiling...' });
        } catch (e) {
            FormatStore.setState({ activeFormatJobId: null, formatJobError: e.message });
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
                    ${this.activeFormatJobId ? html`<div class="spinner" style="display: block; margin-top: 10px;">${this.formatJobMessage}</div>` : ''}
                    ${this.formatJobError ? html`<div style="color: var(--intent-danger); margin-top: 10px; font-weight: bold;">❌ Error: ${this.formatJobError}</div>` : ''}
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