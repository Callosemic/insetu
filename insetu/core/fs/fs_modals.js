/**
 * VFS Explorer Modal Projections: Move File, New File, New Folder/Repository, Link Insert, and Workspace Browser.
 */
import { html } from 'lit';
import { InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { resolveEditorMode, insertLinkToEditor } from '/static/extensions/system/components/ui_editor.js';
import { AppStore } from '/static/extensions/system/store.js';
import {
    FsStore,
    closeBrowseModal,
    confirmFolderSelection,
    executeDeepLinkSearch,
    executeMove,
    getFileExtensionWarning,
    getGlobalManifest,
    onLinkSearchInput,
    resolveFileFetchUrl,
    saveNewFile,
    saveNewFolder,
    shareFiles,
    switchLinkTab,
} from '/static/extensions/fs/fs.js';

export class InSetuMoveFileProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = {
        moveState: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.moveState = FsStore.getState().modals.move || { currentFile: '', destPath: '', initialParts: [] };
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.move || { currentFile: '', destPath: '', initialParts: [] },
            (moveState) => {
                this.moveState = moveState;
                this.requestUpdate();
            }
        );
    }

    render() {
        const m = this.moveState || {};
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <sutram-surface slot="header" variant="panel" border="bottom" padding="normal" gap="compact">
                    <sutram-stack direction="row" align="center" gap="compact">
                        <sutram-icon name="file-code-2" size="sm" intent="primary"></sutram-icon>
                        <sutram-label text="Source:"></sutram-label>
                        <code>${m.currentFile || ''}</code>
                    </sutram-stack>
                    <sutram-input
                        label="Destination Path"
                        ?flush=${true}
                        .value=${m.destPath || ''}
                        placeholder="path/to/destination/file.ext"
                        @sutram-input-changed=${e => {
                            const uri = new window.inSetu.utils.InSetuURI(e.detail.value);
                            const parts = uri.pathSegments;
                            parts.pop();
                            FsStore.getState().setModal('move', { destPath: uri.toString(), initialParts: parts });
                        }}>
                    </sutram-input>
                </sutram-surface>

                <insetu-file-tree
                    basePath=""
                    .files=${getGlobalManifest()}
                    .currentPath=${m.initialParts || []}
                    .hidePath=${false}
                    .hideFiles=${true}
                    .enableSearch=${false}
                    @path-changed=${e => {
                        const pathArr = e.detail.path || [];
                        const folderPrefix = pathArr.join('/');
                        const filename = m.currentFile ? new window.inSetu.utils.InSetuURI(m.currentFile).basename : '';
                        const nextDest = folderPrefix ? `vfs://${folderPrefix}/${filename}` : `vfs://${filename}`;
                        FsStore.getState().setModal('move', {
                            destPath: nextDest,
                            initialParts: pathArr
                        });
                    }}>
                </insetu-file-tree>

                <sutram-btn
                    slot="footer"
                    intent="neutral"
                    icon="x"
                    label="Cancel"
                    @click=${() => {
                        FsStore.getState().setModal('move', { open: false });
                        if (window.Sutram?.stores?.Layout) {
                            window.Sutram.stores.Layout.getState().closeWindow('vfs:move-file');
                        }
                    }}>
                </sutram-btn>
                <sutram-async-btn
                    slot="footer"
                    intent="primary"
                    icon="truck"
                    label="Move File"
                    .onClick=${executeMove}>
                </sutram-async-btn>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-move-file-projection')) {
    customElements.define('insetu-move-file-projection', InSetuMoveFileProjection);
}

export class InSetuNewFileProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = { newFileState: { type: Object } };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.newFileState = FsStore.getState().modals?.newFile || {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.newFile || {},
            (newFileState) => {
                this.newFileState = newFileState;
                this.requestUpdate();
            }
        );
    }
    render() {
        const nf = this.newFileState || {};
        const extWarning = getFileExtensionWarning(nf.fileName || '', nf.basePath || '');
        const actions = window.ExtensionRegistry?.getLayoutSlots?.().filter(s => s.slot === 'modal:new-file:actions') || [];
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <sutram-surface slot="header" variant="panel" border="bottom" padding="normal" gap="compact">
                    <sutram-stack direction="row" align="center" gap="compact">
                        <sutram-icon name="folder" size="sm" intent="highlight"></sutram-icon>
                        <sutram-label text="Directory:"></sutram-label>
                        <code>/${nf.basePath || ''}</code>
                    </sutram-stack>
                    <sutram-input
                        label="Filename"
                        ?flush=${true}
                        placeholder="Filename (e.g. my-prompt.md)..."
                        .value=${nf.fileName || ''}
                        @sutram-input-changed=${e => {
                            FsStore.getState().setModal('newFile', { fileName: e.detail.value });
                        }}>
                    </sutram-input>
                    ${extWarning ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="compact">
                            <sutram-stack direction="row" align="center" gap="compact">
                                <sutram-icon name="alert-triangle" size="sm" intent="warning"></sutram-icon>
                                <span>${extWarning}</span>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                    ${actions.map(act => html`<div style="display: contents;" data-ext="${act.extName}">${this.mountDynamicSlot(act.component)}</div>`)}
                </sutram-surface>
                <insetu-markdown-editor
                    .value=${nf.content || ''}
                    .language=${resolveEditorMode(nf.fileName || '').mode || 'markdown'}
                    @content-changed=${e => FsStore.getState().setModal('newFile', { content: e.detail.value })}>
                </insetu-markdown-editor>
                <sutram-btn slot="footer" intent="neutral" icon="x" label="Cancel" @click=${() => {
                    FsStore.getState().setModal('newFile', { open: false });
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('vfs:new-file');
                }}></sutram-btn>
                <sutram-async-btn slot="footer" intent="primary" icon="save" label="Create & Save File" .onClick=${saveNewFile}></sutram-async-btn>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-new-file-projection')) {
    customElements.define('insetu-new-file-projection', InSetuNewFileProjection);
}

export class InSetuNewFolderProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = { newFolderState: { type: Object } };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.newFolderState = FsStore.getState().modals?.newFolder || {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.newFolder || {},
            (newFolderState) => {
                this.newFolderState = newFolderState;
                this.requestUpdate();
            }
        );
    }
    render() {
        const nf = this.newFolderState || {};
        return html`
            <sutram-view>
                <sutram-stack direction="col" gap="normal">
                    <sutram-stack direction="row" align="center" gap="compact">
                        <sutram-icon name="folder" size="sm" intent="highlight"></sutram-icon>
                        <sutram-label text="Base Path:"></sutram-label>
                        <code>/${nf.basePath || ''}</code>
                    </sutram-stack>
                    <sutram-input
                        label="Directory Name"
                        placeholder="Directory name..."
                        .value=${nf.folderName || ''}
                        @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { folderName: e.detail.value })}>
                    </sutram-input>
                    ${nf.basePath === '' ? html`
                        <sutram-surface variant="panel" padding="normal" gap="normal">
                            <h4>Repository Configuration</h4>
                            <sutram-input label="Repository Title" placeholder="e.g., Core API" .value=${nf.repoTitle || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoTitle: e.detail.value })}></sutram-input>
                            <sutram-input label="Domain Category" placeholder="e.g., Workspaces" .value=${nf.repoDomain || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoDomain: e.detail.value })}></sutram-input>
                            <sutram-input label="Description" placeholder="Short summary..." .value=${nf.repoDesc || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoDesc: e.detail.value })}></sutram-input>
                            <sutram-input label="Tracked Extensions" placeholder="e.g., .py, .json, .md" .value=${nf.repoExts || ''} ?flush=${true} @sutram-input-changed=${e => FsStore.getState().setModal('newFolder', { repoExts: e.detail.value })}></sutram-input>
                        </sutram-surface>
                    ` : ''}
                </sutram-stack>
                <sutram-btn slot="footer" intent="neutral" icon="x" label="Cancel" @click=${() => {
                    FsStore.getState().setModal('newFolder', { open: false });
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('vfs:new-folder');
                }}></sutram-btn>
                <sutram-async-btn slot="footer" intent="primary" icon="${nf.basePath === '' ? 'package' : 'folder-plus'}" label="${nf.basePath === '' ? 'Initialize Repository' : 'Create Folder'}" .onClick=${saveNewFolder}></sutram-async-btn>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-new-folder-projection')) {
    customElements.define('insetu-new-folder-projection', InSetuNewFolderProjection);
}

export class InSetuLinkInsertProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = { linkState: { type: Object } };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.linkState = FsStore.getState().modals?.linkInsert || {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.linkInsert || {},
            (linkState) => {
                this.linkState = linkState;
                this.requestUpdate();
            }
        );
    }
    render() {
        const li = this.linkState || {};
        return html`
            <sutram-view>
                <sutram-surface slot="header" variant="panel" border="bottom" padding="compact" gap="compact">
                    <sutram-stack direction="row" gap="compact">
                        <sutram-pill pillId="filename" labelText="Filename" ?active=${li.activeTab === 'filename'} @sutram-pill-toggled=${() => switchLinkTab('filename')}></sutram-pill>
                        <sutram-pill pillId="deep" labelText="Deep Search" ?active=${li.activeTab === 'deep'} @sutram-pill-toggled=${() => switchLinkTab('deep')}></sutram-pill>
                    </sutram-stack>
                    <sutram-stack direction="row" align="center" gap="compact">
                        <sutram-input
                            placeholder="Search files..."
                            ?flush=${true}
                            ?grow=${true}
                            .value=${li.searchQuery || ''}
                            @sutram-input-changed=${e => onLinkSearchInput(e.detail.value)}>
                        </sutram-input>
                        ${li.activeTab === 'deep' ? html`
                            <sutram-btn label="${li.deepSearchLoading ? 'Searching...' : 'Search'}" icon="search" @click=${() => executeDeepLinkSearch()} intent="highlight" ?disabled=${li.deepSearchLoading}></sutram-btn>
                        ` : ''}
                    </sutram-stack>
                </sutram-surface>
                <sutram-stack direction="col" gap="compact">
                    ${li.deepSearchLoading ? html`<sutram-spinner text="Searching file contents across workspace..."></sutram-spinner>` : ''}
                    ${(!li.deepSearchLoading && (!li.searchResults || li.searchResults.length === 0)) ? html`
                        <sutram-empty-state text=${(!li.searchQuery) ? 'Type to search...' : 'No files found.'}></sutram-empty-state>
                    ` : ''}
                    ${(li.searchResults || []).map(item => {
                        const name = new window.inSetu.utils.InSetuURI(item.path).basename;
                        return html`
                            <sutram-card
                                .filename=${item.path}
                                .titleText=${name}
                                .detailText=${item.path}
                                .detailSuffix=${item.score !== undefined ? `Score: ${item.score}` : ''}
                                .descriptionText=${item.snippet ? '"...' + item.snippet.replace(/</g, '&lt;') + '"' : ''}
                                icon="file-text"
                                intent="primary"
                                ?disableSelection=${true}
                                @card-clicked=${() => {
                                    insertLinkToEditor(item.path, name);
                                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('vfs:link-insert');
                                }}>
                            </sutram-card>
                        `;
                    })}
                </sutram-stack>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-link-insert-projection')) {
    customElements.define('insetu-link-insert-projection', InSetuLinkInsertProjection);
}

function _handleBrowserCardClick(detail) {
    const { browserConfig } = AppStore.getState();
    if (browserConfig && browserConfig.mode === 'file') {
        if (browserConfig.callback) browserConfig.callback(detail.filename);
        closeBrowseModal();
    } else if (browserConfig && browserConfig.mode === 'view') {
        if (detail.isSource && window.inSetu.vfs.viewSourceFile) {
            window.inSetu.vfs.viewSourceFile(detail.filename, true);
        } else if (window.inSetu.vfs.viewAndCopy) {
            window.inSetu.vfs.viewAndCopy(detail.filename);
        }
    }
}

export class InSetuBrowserProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = {
        browserModal: { type: Object },
        browserConfig: { type: Object },
        browserPath: { type: Array }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        const bModal = FsStore.getState().modals?.browser || {};
        this.browserModal = bModal;
        this.browserConfig = AppStore.getState().browserConfig || {};
        this.browserPath = bModal.currentPath || [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FsStore,
            state => state.modals?.browser || {},
            (browserModal) => {
                this.browserModal = browserModal;
                this.browserPath = browserModal.currentPath || [];
                this.requestUpdate();
            }
        );
        this.subscribe(
            AppStore,
            state => state.browserConfig || {},
            (browserConfig) => {
                this.browserConfig = browserConfig;
                this.requestUpdate();
            }
        );
    }
    render() {
        const b = this.browserModal || {};
        const isParts = b.isParts || b.title?.startsWith('Parts:');
        const manifest = b.manifest || [];

        return html`
            <sutram-view ?flush=${true} ?noScroll=${!isParts}>
                ${isParts ? html`
                    <sutram-stack direction="col" gap="none">
                        ${manifest.length > 0 ? html`
                            <sutram-surface variant="panel" border="bottom" padding="normal">
                                <sutram-stack direction="row" align="center" gap="compact">
                                    <sutram-icon name="package" size="md" intent="highlight"></sutram-icon>
                                    <strong>${manifest[0].includes('/') ? manifest[0].split('/').pop() : manifest[0]}</strong>
                                </sutram-stack>
                            </sutram-surface>
                            ${manifest.map((f, idx) => {
                                const fetchUrl = `${resolveFileFetchUrl(f, false)}&download=1`;
                                const partMatch = f.match(/_part(\d+)/i);
                                const displayTitle = partMatch ? `Part ${partMatch[1]}` : `Part ${idx + 1}`;
                                return html`
                                    <sutram-surface variant="inset" border="bottom" padding="normal">
                                        <sutram-stack direction="row" justify="between" align="center" gap="compact">
                                            <sutram-stack direction="row" align="center" gap="compact">
                                                <sutram-icon name="puzzle" size="md" intent="muted"></sutram-icon>
                                                <strong>${displayTitle}</strong>
                                            </sutram-stack>
                                            <sutram-stack direction="row" gap="compact">
                                                <sutram-async-btn label="View" icon="eye" intent="neutral" ?compact=${true} .onClick=${async () => { if (window.inSetu.vfs.viewAndCopy) window.inSetu.vfs.viewAndCopy(f); }}></sutram-async-btn>
                                                <sutram-async-btn label="Download" icon="download" intent="primary" ?compact=${true} .onClick=${async () => { await window.inSetu.vfs.fetchAndDownloadState(f, fetchUrl); }}></sutram-async-btn>
                                            </sutram-stack>
                                        </sutram-stack>
                                    </sutram-surface>
                                `;
                            })}
                        ` : ''}
                    </sutram-stack>
                ` : html`
                    <insetu-file-tree 
                        basePath=""
                        .files=${manifest}
                        .currentPath=${this.browserPath || []}
                        .hidePath=${false}
                        .enableSearch=${this.browserConfig?.mode !== 'folder'}
                        searchPlaceholder="Fuzzy find files..."
                        .hideFiles=${this.browserConfig?.mode === 'folder'}
                        @path-changed=${e => FsStore.getState().setModal('browser', { currentPath: e.detail.path || [] })}
                        @card-clicked=${e => _handleBrowserCardClick(e.detail)}>
                    </insetu-file-tree>
                `}
                ${isParts ? html`
                    <sutram-surface slot="footer" variant="panel" border="top" padding="compact">
                        <sutram-stack direction="row" gap="compact">
                            <sutram-async-btn label="Download All" icon="download" intent="primary" ?grow=${true} .onClick=${async () => {
                                for (const f of manifest) {
                                    await window.inSetu.vfs.fetchAndDownloadState(f, `${resolveFileFetchUrl(f, false)}&download=1`);
                                    await new Promise(r => setTimeout(r, 300));
                                }
                            }}></sutram-async-btn>
                            ${!!navigator.share && !!navigator.canShare ? html`
                                <sutram-async-btn label="Share All" icon="share" intent="neutral" ?grow=${true} .onClick=${async () => {
                                    if (manifest.length > 0) {
                                        const firstFile = manifest[0];
                                        const cleanFirst = new window.inSetu.utils.InSetuURI(firstFile).basename || firstFile;
                                        await shareFiles(cleanFirst, manifest, false);
                                    }
                                }}></sutram-async-btn>
                            ` : ''}
                        </sutram-stack>
                    </sutram-surface>
                ` : (this.browserConfig?.mode === 'folder' ? html`
                    <sutram-surface slot="footer" variant="panel" border="top" padding="compact">
                        <sutram-stack direction="row" gap="compact">
                            <sutram-btn intent="neutral" icon="x" label="Cancel" ?grow=${true} @click=${closeBrowseModal}></sutram-btn>
                            <sutram-async-btn label="Select This Folder" icon="check-circle-2" intent="success" ?grow=${true} .onClick=${confirmFolderSelection}></sutram-async-btn>
                        </sutram-stack>
                    </sutram-surface>
                ` : '')}
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-browser-projection')) {
    customElements.define('insetu-browser-projection', InSetuBrowserProjection);
}
