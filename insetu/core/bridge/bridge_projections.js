/**
 * Yomama Sync Bridge auxiliary projections: Diff Viewer, Chunk Editor, and Header Repo Filter.
 */
import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { BridgeStore } from '/static/extensions/bridge/bridge_store.js';

export class InSetuBridgeDiffProjection extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        caption: { type: String },
        diffContent: { type: String },
        searchStr: { type: String },
        replaceStr: { type: String },
        suggestedFilename: { type: String }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.caption = '';
        this.diffContent = '';
        this.searchStr = '';
        this.replaceStr = '';
        this.suggestedFilename = '';
    }
    render() {
        const filename = this.suggestedFilename || `diff_${Date.now()}.diff`;
        const rawPayload = this.diffContent || `<<<<<<< SEARCH\n${this.searchStr}\n=======\n${this.replaceStr}\n>>>>>>> REPLACE`;
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <sutram-surface slot="header" variant="inset" border="bottom" padding="xs">
                    <sutram-stack direction="row" justify="end" align="center">
                        <sutram-entity-actions
                            .entityType=${'text_blob'}
                            .entityData=${{ textContent: rawPayload, suggestedFilename: filename }}>
                        </sutram-entity-actions>
                    </sutram-stack>
                </sutram-surface>
                <sutram-diff-viewer
                    .diffText=${this.diffContent}
                    .searchStr=${this.searchStr}
                    .replaceStr=${this.replaceStr}
                    leftTitle="Original"
                    rightTitle="Patch">
                </sutram-diff-viewer>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-bridge-diff-projection')) {
    customElements.define('insetu-bridge-diff-projection', InSetuBridgeDiffProjection);
}

export class InSetuBridgeEditProjection extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        editCellId: { type: String },
        editCellOriginalFile: { type: String },
        cells: { type: Array },
        _previewDiff: { type: Boolean }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        const st = BridgeStore.getState();
        this.editCellId = st.editCellId;
        this.editCellOriginalFile = st.editCellOriginalFile || '';
        this.cells = st.cells || [];
        this._previewDiff = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            BridgeStore,
            state => ({
                editCellId: state.editCellId,
                editCellOriginalFile: state.editCellOriginalFile || '',
                cells: state.cells || []
            }),
            ({ editCellId, editCellOriginalFile, cells }) => {
                this.editCellId = editCellId;
                this.editCellOriginalFile = editCellOriginalFile;
                this.cells = cells;
            }
        );
    }
    _commitCurrentBuffer() {
        if (!this.editCellId) return;
        const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${this.editCellId}`];
        if (buffer) {
            const text = buffer.content;
            const fileMatch = text.match(/^<<<<<<< FILE:\s*(.+)$/m);
            const rawNewFile = fileMatch ? fileMatch[1].trim() : this.editCellOriginalFile;
            const newFile = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(rawNewFile) : rawNewFile;
            const rawContent = text.replace(/^<<<<<<< FILE:.*\n?/m, '').trim();
            BridgeStore.getState().updateCellFile(this.editCellId, newFile);
            BridgeStore.getState().updateCellContent(this.editCellId, rawContent);
        }
    }
    _navigateChunk(direction) {
        if (!this.editCellId || this.cells.length <= 1) return;
        const prevCellId = this.editCellId;
        this._commitCurrentBuffer();
        const currentIndex = this.cells.findIndex(c => c.id === prevCellId);
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= this.cells.length) return;

        const nextCell = this.cells[newIndex];
        if (prevCellId !== nextCell.id) {
            window.inSetu?.stores?.Fs?.getState()?.closeBuffer(`yomama://${prevCellId}`);
        }
        const virtualUri = `yomama://${nextCell.id}`;
        window.inSetu.stores.Fs?.getState()?.openBuffer(virtualUri, {
            filename: virtualUri,
            content: `<<<<<<< FILE: ${nextCell.file}\n${nextCell.content}`,
            originalContent: `<<<<<<< FILE: ${nextCell.file}\n${nextCell.content}`,
            fullText: `<<<<<<< FILE: ${nextCell.file}\n${nextCell.content}`,
            isFS: false,
            forceEdit: true,
            isMemoryOnly: true,
            isSupportedEditor: true,
            ext: 'js',
            codeMode: 'javascript'
        });
        BridgeStore.setState({ editCellId: nextCell.id, editCellOriginalFile: nextCell.file });
        if (window.Sutram?.stores?.Layout) {
            const layoutStore = window.Sutram.stores.Layout;
            const nextLabel = `Edit Patch: ${new window.inSetu.utils.InSetuURI(nextCell.file).basename}`;
            layoutStore.setState(s => ({
                windows: (s.windows || []).map(w => w.id === 'bridge:edit-cell' ? { ...w, label: nextLabel, titleText: nextLabel } : w)
            }));
        }
    }
    _extractCurrentBlocks() {
        const buffer = window.inSetu.stores.Fs?.getState()?.activeBuffers[`yomama://${this.editCellId}`];
        const rawText = buffer ? buffer.content : (this.cells.find(c => c.id === this.editCellId)?.content || '');
        const match = rawText.match(/<<<<<<< SEARCH[ \t]*\r?\n([\s\S]*?)^=======[ \t]*\r?\n([\s\S]*?)^>>>>>>> REPLACE/m);
        if (match) {
            return { searchStr: match[1].replace(/\r?\n$/, ''), replaceStr: match[2].replace(/\r?\n$/, '') };
        }
        return { searchStr: '', replaceStr: rawText };
    }
    render() {
        if (!this.editCellId) return html``;
        const currentIndex = this.cells.findIndex(c => c.id === this.editCellId);
        const total = this.cells.length;
        const { searchStr, replaceStr } = this._previewDiff ? this._extractCurrentBlocks() : { searchStr: '', replaceStr: '' };
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                ${this._previewDiff ? html`
                    <sutram-diff-viewer
                        .searchStr=${searchStr}
                        .replaceStr=${replaceStr}
                        leftTitle="SEARCH Block"
                        rightTitle="REPLACE Block">
                    </sutram-diff-viewer>
                ` : html`
                    <insetu-editor-projection 
                        .filepath=${`yomama://${this.editCellId}`} 
                        data-sub-id=${`yomama://${this.editCellId}`}>
                    </insetu-editor-projection>
                `}
                <sutram-surface slot="footer" variant="panel" border="top" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-btn intent="danger" icon="x" label="Cancel" @click=${() => {
                                if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                            }}></sutram-btn>
                            <sutram-btn intent="highlight" icon="${this._previewDiff ? 'edit-3' : 'columns'}" label="${this._previewDiff ? 'Raw Editor' : 'Diff View'}" @click=${() => {
                                this._previewDiff = !this._previewDiff;
                            }}></sutram-btn>
                            <sutram-btn intent="warning" icon="refresh-cw" label="Swap S/R" @click=${() => {
                                this.dispatch('insetu:bridge:cell-swap', { id: this.editCellId });
                            }}></sutram-btn>
                        </sutram-stack>
                        ${total > 1 ? html`
                            <sutram-stack direction="row" align="center" gap="xs">
                                <sutram-btn ?compact=${true} intent="neutral" icon="chevron-left" label="Prev" ?disabled=${currentIndex <= 0} @click=${() => this._navigateChunk(-1)}></sutram-btn>
                                <sutram-tag text="${currentIndex + 1} / ${total}"></sutram-tag>
                                <sutram-btn ?compact=${true} intent="neutral" icon="chevron-right" label="Next" ?disabled=${currentIndex >= total - 1} @click=${() => this._navigateChunk(1)}></sutram-btn>
                            </sutram-stack>
                        ` : ''}
                        <sutram-btn intent="success" icon="check" label="Save Patch" ?grow=${true} @click=${() => {
                            this._commitCurrentBuffer();
                            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('bridge:edit-cell');
                        }}></sutram-btn>
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-bridge-edit-projection')) {
    customElements.define('insetu-bridge-edit-projection', InSetuBridgeEditProjection);
}

export class InSetuExtBridgeActions extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        _pinnedRepos: { type: Object }
    };
    static styles = [sharedStyles];
    connectedCallback() {
        super.connectedCallback();
        this._pinnedRepos = window.inSetu.stores.App.getState().pinnedRepos;
        this.subscribe(
            window.inSetu.stores.App,
            state => state.pinnedRepos,
            (pinnedRepos) => {
                this._pinnedRepos = pinnedRepos;
            }
        );
    }

    render() {
        const currentPins = this._pinnedRepos || this.ecosystem.pinnedRepos;
        const active = Array.from(currentPins).filter(r => r !== 'ALL');
        let btnText = 'Filters';
        let hasF = false;
        if (active.length > 0) {
            btnText = `Filters: ${active.slice(0, 2).join(', ')}${active.length > 2 ? '...' : ''}`;
            hasF = true;
        }
        return html`
            <sutram-filter-dropdown .filterText=${btnText} .hasFilters=${hasF}>
                <insetu-repo-filter
                    .repos=${this.ecosystem.allRepos}
                    .activeRepos=${Array.from(currentPins)}
                    @repo-filter-changed=${(e) => window.inSetu.stores.App.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                </insetu-repo-filter>
            </sutram-filter-dropdown>
        `;
    }
}
if (!customElements.get('insetu-ext-bridge-actions')) {
    customElements.define('insetu-ext-bridge-actions', InSetuExtBridgeActions);
}
