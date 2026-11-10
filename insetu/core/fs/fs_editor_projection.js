/**
 * Core VFS Editor, Frontmatter Editor, and File Diff Spatial Projections extracted from fs.js (God-Objects Wave 3.1).
 */
import { html } from 'lit';
import { InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { openEditorLinkTarget, isMarkdownLinksEnabled } from '/static/extensions/system/components/ui_editor.js';
import {
    FsStore,
    normalizeVfsURI,
    isBufferReadOnly,
    canPreviewFileMacros,
    hydrateVfsBuffer,
    reconcileBufferWithDisk,
} from '/static/extensions/fs/fs_store.js';
import { viewSourceFile } from '/static/extensions/fs/fs.js';

export class InSetuEditorProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = {
        filepath: { type: String }, frontmatterMode: { type: Boolean }, defaultExpanded: { type: Boolean },
        _buffer: { type: Object }, _writingMode: { type: Boolean }, _editorFocused: { type: Boolean },
        _metadataExpanded: { type: Boolean }, _yamlData: { type: Object }, _bodyContent: { type: String },
        _hasTitleSlot: { type: Boolean }, _enableMdLinks: { type: Boolean },
        zenMode: { type: Boolean, reflect: true, attribute: 'zen-mode' }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.filepath = ''; this.frontmatterMode = false; this.defaultExpanded = false;
        this._buffer = null; this._writingMode = false; this._editorFocused = false;
        this._metadataExpanded = false; this._yamlData = {}; this._bodyContent = '';
        this._hasTitleSlot = false; this._enableMdLinks = isMarkdownLinksEnabled();
        this.zenMode = false; this._transientCursorPos = 0; this._transientScrollTop = 0;
        this._autoSaveTimer = null; this._lastEmittedYamlJson = null; this._wasDirty = false;
    }

    _normPath() {
        const raw = this.filepath || this.dataset.subId || '';
        return raw ? normalizeVfsURI(raw) : '';
    }

    _syncFromBuffer(buffer, isInitialHydration = false) {
        this._buffer = buffer;
        if (!buffer || buffer.content === 'Loading...') return;

        if (this.frontmatterMode && !buffer.frontmatterMode) {
            FsStore.getState().enableFrontmatterMode(this._normPath(), true);
            this._buffer = FsStore.getState().activeBuffers[this._normPath()] || buffer;
        }

        const activeBuf = this._buffer;
        this._yamlData = activeBuf.yamlMeta || {};
        this._bodyContent = activeBuf.bodyContent ?? activeBuf.content;

        const nowDirty = this.isDirty;
        if (this._wasDirty !== nowDirty) {
            this._wasDirty = nowDirty;
            this.dispatchEvent(new CustomEvent('editor-dirty', {
                detail: { isDirty: nowDirty },
                bubbles: true,
                composed: true
            }));
        }

        if (this.frontmatterMode || activeBuf.hasFrontmatter) {
            const yamlJson = JSON.stringify(this._yamlData);
            const yamlChanged = yamlJson !== this._lastEmittedYamlJson;
            this._lastEmittedYamlJson = yamlJson;

            if (isInitialHydration) {
                const docType = (this._yamlData?.doctype || this._yamlData?.doc_type || '').toLowerCase();
                const proseDocTypes = ['prose', 'essay', 'article', 'draft', 'spec', 'story', 'novel'];
                if (proseDocTypes.includes(docType) || this._yamlData?.writing_mode === 'true' || this._yamlData?.writing_mode === true) {
                    this._writingMode = true;
                }
                this._metadataExpanded = !!this.defaultExpanded;
            }

            if (isInitialHydration || yamlChanged) {
                this.dispatchEvent(new CustomEvent('insetu:frontmatter-loaded', {
                    detail: { yaml: this._yamlData, content: this._bodyContent },
                    bubbles: true,
                    composed: true
                }));
            }
            if (isInitialHydration && this.frontmatterMode) {
                queueMicrotask(() => this._syncFrontmatterToBuffer(false));
            }
        }
    }
    syncFrontmatter(yamlPatch = null, userEdit = true) {
        if (yamlPatch && typeof yamlPatch === 'object') {
            this._yamlData = { ...(this._yamlData || {}), ...yamlPatch };
        }
        this._syncFrontmatterToBuffer(userEdit);
    }
    _syncFrontmatterToBuffer(userEdit = true) {
        const normPath = this._normPath();
        if (!normPath || !this._buffer || this._buffer.content === 'Loading...') return;

        this._yamlData = { ...(this._yamlData || {}) };
        this._lastEmittedYamlJson = JSON.stringify(this._yamlData);
        const prevContent = this._buffer.content;
        const serialized = FsStore.getState().updateBufferFrontmatter(
            normPath,
            { yamlMeta: this._yamlData, bodyContent: this._bodyContent },
            { userEdit }
        );
        if (userEdit && serialized !== null && serialized !== prevContent) {
            this._triggerDebouncedAutoSave();
        }
    }

    async save() {
        return this._handleSave();
    }

    async _handleSave() {
        const normPath = this._normPath();
        if (!normPath) return;
        if (this.frontmatterMode) {
            this._syncFrontmatterToBuffer(true);
        }
        if (window.inSetu?.ui?.saveBufferFile) {
            await window.inSetu.ui.saveBufferFile(normPath, true);
        }
    }
    _triggerDebouncedAutoSave() {
        const targetPath = this._normPath();
        if (!targetPath) return;
        FsStore.getState().scheduleAutoSave?.(targetPath, 2000);
    }
    _cleanArtifacts() {
        if (this._buffer?.previewMode) return;
        const cleanFn = window.inSetu?.utils?.cleanCodeArtifacts;
        if (!cleanFn) return;
        const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
        let modified = false;
        if (cmEditor && cmEditor.transformContent) {
            modified = cmEditor.transformContent(cleanFn);
        } else if (this.frontmatterMode) {
            const cleaned = cleanFn(this._bodyContent);
            if (cleaned !== this._bodyContent) {
                this._bodyContent = cleaned;
                this._syncFrontmatterToBuffer(true);
                modified = true;
            }
        } else if (this._buffer) {
            const cleaned = cleanFn(this._buffer.content);
            if (cleaned !== this._buffer.content) {
                FsStore.getState().updateBuffer(this._normPath(), { content: cleaned }, { userEdit: true });
                this._triggerDebouncedAutoSave();
                modified = true;
            }
        }
        if (modified) {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✨ Cleaned citations and span tags", 2000);
        } else {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("No citation or span artifacts found", 2000);
        }
    }

    async _toggleWritingMode() {
        this._writingMode = !this._writingMode;
        if (this.frontmatterMode) {
            this._yamlData = { ...this._yamlData, writing_mode: this._writingMode };
            this._syncFrontmatterToBuffer(true);
            return;
        }
        if (this._buffer && this._buffer.isFS) {
            try {
                await this.api.post('editor/preference', {
                    filepath: this._normPath(),
                    writing_mode: this._writingMode
                });
            } catch(e) {}
        }
    }

    async _toggleZenMode() {
        this.zenMode = !this.zenMode;
        if (this.zenMode) {
            if (typeof this.showPopover === 'function') {
                this.setAttribute('popover', 'manual');
                try { this.showPopover(); } catch(e) {}
            }
            try {
                if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
                else if (document.documentElement.webkitRequestFullscreen) await document.documentElement.webkitRequestFullscreen();
            } catch(e) {}
        } else {
            if (typeof this.hidePopover === 'function') {
                if (this.matches(':popover-open')) {
                    try { this.hidePopover(); } catch(e) {}
                }
                this.removeAttribute('popover');
            }
            try {
                if (document.exitFullscreen && document.fullscreenElement) await document.exitFullscreen();
                else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
            } catch(e) {}
        }
    }
    onWorkspaceLoad(workspaceId) {
        super.onWorkspaceLoad(workspaceId);
        if (this.filepath) {
            this._lastEmittedYamlJson = null;
            this._ensureBufferLoaded(this.filepath);
            this._loadPreference(this.filepath);
        }
    }

    onProjectionRekeyed(oldId, newId) {
        const normCur = this._normPath();
        if (this.filepath === oldId || normCur === oldId) {
            this.filepath = newId;
            this.dataset.subId = newId;
            this._syncFromBuffer(FsStore.getState().activeBuffers[newId] || null, false);
            this.requestUpdate();
        } else if (this.filepath && this.filepath.startsWith(oldId + '/')) {
            const childNew = newId + this.filepath.slice(oldId.length);
            this.filepath = childNew;
            this.dataset.subId = childNew;
            this._syncFromBuffer(FsStore.getState().activeBuffers[childNew] || null, false);
            this.requestUpdate();
        }
    }
    async _ensureBufferLoaded(filepath) {
        if (!filepath) return;
        if (filepath.startsWith('yomama://') || filepath.startsWith('virtual://')) {
            const normPath = this._normPath();
            const memBuf = FsStore.getState().activeBuffers?.[normPath] || FsStore.getState().activeBuffers?.[filepath] || null;
            if (memBuf) {
                this._syncFromBuffer(memBuf, true);
                this.requestUpdate();
            }
            return;
        }
        const buf = await hydrateVfsBuffer(filepath, { forceReload: false });
        if (buf) {
            this._syncFromBuffer(buf, true);
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.filepath && this.dataset.subId) this.filepath = this.dataset.subId;
        this.subscribe(
            'Fs',
            state => {
                const np = this._normPath();
                return np ? (state.activeBuffers[np] || state.activeBuffers[this.filepath] || null) : null;
            },
            (buffer) => {
                const isFirstHydration = Boolean(buffer && buffer.content !== 'Loading...' && this._lastEmittedYamlJson === null);
                this._syncFromBuffer(buffer, isFirstHydration);
                this.requestUpdate();
            }
        );
        if (this.filepath) {
            this._lastLoadedFilepath = this.filepath;
            this._ensureBufferLoaded(this.filepath);
        }
        this.registerGlobalListener('insetu:editor:clean-artifacts', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (!normTarget || normTarget === this._normPath() || e.detail?.filepath === this.dataset.subId) {
                this._cleanArtifacts();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-prose', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                this._toggleWritingMode();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-zen', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                this._toggleZenMode();
            }
        });
        this.registerGlobalListener('keydown', window, (e) => {
            if (this.zenMode && e.key === 'Escape') {
                e.preventDefault();
                this._toggleZenMode();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-preview', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail?.filepath === this.filepath || e.detail?.filepath === this.dataset.subId) {
                FsStore.getState().toggleBufferPreview(this._normPath());
            }
        });
        // Live 3-Way Rebase & Hot-Swap Listener (Driven by BroadcastChannel or SSE)
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            if (!this.filepath || !this._buffer) return;
            const mutations = e.detail?.mutations || [];
            const normPath = this._normPath();
            const relocMut = mutations.find(m => {
                const mNorm = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath;
                return m.operation === 'delete' && m.relocated_to && (mNorm === normPath || m.filepath === this.filepath);
            });
            if (relocMut) {
                this.onProjectionRekeyed(normPath, normalizeVfsURI(relocMut.relocated_to));
                return;
            }
            const matchingSave = mutations.find(m => {
                if (m.operation === 'delete') return false;
                const mNorm = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath;
                return mNorm === normPath || m.filepath === this.filepath;
            });
            if (matchingSave) {
                const fsState = FsStore.getState();
                if (fsState.savingPaths?.has(normPath)) return;
                const isKnownHash = Boolean(
                    !this.isDirty && matchingSave.base_hash && (
                        matchingSave.base_hash === this._buffer?.baseHash ||
                        (Array.isArray(this._buffer?.ancestorHashes) && this._buffer.ancestorHashes.includes(matchingSave.base_hash))
                    )
                );
                if (isKnownHash) return;
                reconcileBufferWithDisk(normPath);
            }
        });
        this.registerGlobalListener('insetu:editor-insert-text', window, (e) => {
            const normTarget = e.detail?.filepath ? normalizeVfsURI(e.detail.filepath) : '';
            if (normTarget === this._normPath() || e.detail.filepath === this.filepath || e.detail.filepath === this.dataset.subId) {
                const m = this._buffer;
                if (!m || m.previewMode) return;
                const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                if (cmEditor) {
                    cmEditor.insertAtCursor(e.detail.text);
                } else if (this.frontmatterMode) {
                    this._bodyContent = this._bodyContent + "\n" + e.detail.text;
                    this._syncFrontmatterToBuffer(true);
                } else {
                    window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: m.content + "\n" + e.detail.text }, { userEdit: true });
                    this._triggerDebouncedAutoSave();
                }
            }
        });

        this.registerGlobalListener('insetu:md-links-preference-updated', window, (e) => {
            this._enableMdLinks = Boolean(e.detail?.enabled);
        });
        this._enableMdLinks = isMarkdownLinksEnabled();
        this._loadPreference(this.filepath);
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') && this.filepath && this.filepath !== this._lastLoadedFilepath) {
            this._lastLoadedFilepath = this.filepath;
            this._lastEmittedYamlJson = null;
            const normPath = this._normPath();
            const existing = window.inSetu.stores.Fs?.getState()?.activeBuffers[normPath] || window.inSetu.stores.Fs?.getState()?.activeBuffers[this.filepath] || null;
            if (existing && existing.content !== 'Loading...') {
                this._syncFromBuffer(existing, true);
            } else {
                this._ensureBufferLoaded(this.filepath);
            }
            this._loadPreference(this.filepath);

            if (this._buffer) {
                this._transientCursorPos = this._buffer.cursorPos || 0;
                this._transientScrollTop = this._buffer.scrollTop || 0;

                requestAnimationFrame(() => {
                    const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                    if (cmEditor) {
                        if (this._buffer.cursorPos !== undefined && cmEditor.setCursor) {
                            cmEditor.setCursor(this._buffer.cursorPos);
                        }
                        if (this._buffer.scrollTop !== undefined && cmEditor.setScrollInfo) {
                            cmEditor.setScrollInfo(this._buffer.scrollTop);
                        }
                    }
                });
            }
        }
    }

    get isDirty() {
        return Boolean(this._buffer && this._buffer.isFS && this._buffer.content !== this._buffer.originalContent && this._buffer.content !== 'Loading...');
    }

    async _loadPreference(filename) {
        if (!filename) return;
        try {
            const res = await this.api.get(`editor/preference?file=${encodeURIComponent(filename)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.writing_mode !== undefined && data.writing_mode !== null) {
                    this._writingMode = !!data.writing_mode;
                    return;
                }
            }
        } catch (e) {}
    }

    render() {
        if (!this._buffer || this._buffer.content === 'Loading...') {
            return html`<sutram-view><sutram-spinner text="Loading file..."></sutram-spinner></sutram-view>`;
        }
        const m = this._buffer;
        const isPreview = Boolean(m.previewMode);
        const shouldBeReadOnly = isBufferReadOnly(m);
        const kbSize = Math.round((m.fullText?.length || 0) / 1024);
        const hasDetectedFrontmatter = Boolean(!isPreview && m.isMarkdown && (this.frontmatterMode || (this._yamlData && Object.keys(this._yamlData).length > 0)));
        const rawSourceText = this.frontmatterMode ? this._bodyContent : m.content;
        const editorTextValue = isPreview ? (m.previewContent ?? rawSourceText) : rawSourceText;
        const supportsMacroPreview = canPreviewFileMacros(m.filename, m.content || '');
        return html`
            <sutram-view ?flush=${true} ?noScroll=${true} ?zen=${this.zenMode} @sutram-view-exit-zen=${() => this._toggleZenMode()}>
                <div slot="header">
                    <div style="padding: 8px 15px 6px 15px; display: ${this._hasTitleSlot ? 'block' : 'none'};">
                        <slot name="title-control" @slotchange=${(e) => { this._hasTitleSlot = e.target.assignedNodes({ flatten: true }).length > 0; }}></slot>
                    </div>
                    <sutram-surface variant="panel" border="bottom" padding="xs">
                        <sutram-action-bar collapse="sm" align="between" ?nowrap=${true}>
                            <sutram-stack direction="row" align="center" gap="sm" ?flex=${true}>
                                <slot name="action-bar-extra"></slot>
                                <sutram-entity-actions   
                                    variant="menu-bar"
                                    .entityType=${'file:editor'} 
                                    .entityData=${{ 
                                        filepath: m.filename, 
                                        isFS: m.isFS,
                                        isMarkdown: m.isMarkdown,
                                        writingMode: this._writingMode,
                                        previewMode: isPreview,
                                        supportsMacroPreview,
                                        isSkeleton: false,
                                        isDirty: this.isDirty,
                                        transientContent: editorTextValue,
                                        suppress: ['file-edit', 'file-preview'],
                                        chunks: window.inSetu?.vfs?.getChunks ? window.inSetu.vfs.getChunks(m.filename) : [m.filename]
                                    }}>
                                </sutram-entity-actions>
                            </sutram-stack>
                            <sutram-stack direction="row" align="center" gap="xs">
                                <insetu-projection-window-controls 
                                    .filepath=${m.filename}
                                    .beforeAction=${async () => { if (this.isDirty) await this._handleSave(); }}>
                                </insetu-projection-window-controls>
                                ${hasDetectedFrontmatter ? html`
                                    <sutram-btn
                                        ?compact=${true}
                                        intent=${this._metadataExpanded ? 'primary' : 'neutral'}
                                        ?active=${this._metadataExpanded}
                                        icon="settings"
                                        label="Metadata ${this._metadataExpanded ? '▲' : '▼'}"
                                        @click=${() => {
                                            const nextExpanded = !this._metadataExpanded;
                                            if (!this._alwaysFrontmatter) {
                                                if (nextExpanded && !this.frontmatterMode) {
                                                    this._lastEmittedYamlJson = null;
                                                    this.frontmatterMode = true;
                                                    FsStore.getState().enableFrontmatterMode(this._normPath(), true);
                                                    this._syncFromBuffer(FsStore.getState().activeBuffers[this._normPath()], false);
                                                } else if (!nextExpanded && this.frontmatterMode) {
                                                    this._syncFrontmatterToBuffer(false);
                                                    this.frontmatterMode = false;
                                                    FsStore.getState().enableFrontmatterMode(this._normPath(), false);
                                                }
                                            }
                                            this._metadataExpanded = nextExpanded;
                                        }}>
                                    </sutram-btn>
                                ` : ''}
                            </sutram-stack>
                        </sutram-action-bar>
                    </sutram-surface>

                    ${this._metadataExpanded && hasDetectedFrontmatter ? html`
                        <sutram-surface variant="panel" border="bottom" padding="sm">
                            <slot name="metadata-controls">
                                <sutram-stack direction="grid" ?compact=${true}>
                                    ${Object.keys(this._yamlData || {}).map(k => html`
                                        <sutram-input ?flush=${true} label=${k} .value=${String(this._yamlData[k] ?? '')} @sutram-input-changed=${e => {
                                            this._yamlData = { ...this._yamlData, [k]: e.detail.value };
                                            this._syncFrontmatterToBuffer(true);
                                        }}></sutram-input>
                                    `)}
                                </sutram-stack>
                            </slot>
                        </sutram-surface>
                    ` : ''}

                    ${isPreview ? html`
                        <sutram-surface variant="tinted" intent="highlight" border="bottom" padding="xs">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <sutram-stack direction="row" align="center" gap="sm">
                                    <sutram-icon name="eye" size="md" intent="highlight"></sutram-icon>
                                    <strong>${m.previewLoading ? 'Resolving macro preview...' : 'Macro-Expanded Preview (Read-Only)'}</strong>
                                </sutram-stack>
                                <sutram-btn ?compact=${true} icon="${m.isFS ? 'edit-3' : 'code'}" label="${m.isFS ? 'Edit Raw Source' : 'View Raw Source'}" intent="highlight" @click=${() => FsStore.getState().toggleBufferPreview(this._normPath(), false)}></sutram-btn>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}

                    ${m.isProtected ? html`
                        <sutram-surface variant="tinted" intent="warning" border="bottom" padding="xs">
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-icon name="shield-alert" size="md" intent="warning"></sutram-icon>
                                <sutram-label .text=${m.protectedMessage || 'Protected recovery file: saving runs a smoke test first.'}></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}

                    ${m.isTruncated ? html`
                        <sutram-surface variant="tinted" intent="warning" border="bottom" padding="xs">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <span>⚠️ Only showing the first 200kb of <b>${kbSize}kb</b>.</span>
                                <sutram-btn ?compact=${true} label="Show All" intent="neutral" @click=${() => window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: m.fullText, originalContent: m.fullText, isTruncated: false })}></sutram-btn>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                </div>

                <insetu-markdown-editor 
                    @focusin=${() => this._editorFocused = true}
                    @focusout=${() => { if (!this.shadowRoot.activeElement) this._editorFocused = false; }}
                    .value=${editorTextValue} 
                    .language=${m.codeMode || 'plaintext'} 
                    .readOnly=${shouldBeReadOnly}
                    .enableMarkdownLinks=${this._enableMdLinks}
                    ?writingMode=${this._writingMode}
                    @editor-link-clicked=${(e) => {
                        const href = e.detail?.href;
                        if (href) openEditorLinkTarget(href, this._normPath());
                    }}
                    @editor-selection=${(e) => { this._transientCursorPos = e.detail?.cursor ?? 0; }}
                    @editor-scroll=${(e) => { this._transientScrollTop = e.detail?.top ?? 0; }}
                    @content-changed=${(e) => {
                        if (this._buffer?.previewMode) return;
                        if (this.frontmatterMode) {
                            this._bodyContent = e.detail.value;
                            this._syncFrontmatterToBuffer(true);
                        } else {
                            window.inSetu.stores.Fs?.getState()?.updateBuffer(this._normPath(), { content: e.detail.value }, { userEdit: true });
                            this._triggerDebouncedAutoSave();
                        }
                    }}>
                </insetu-markdown-editor>

                ${this.isDirty && !this._hasTitleSlot ? html`
                    <sutram-async-btn slot="footer" label="Save Changes" icon="save" intent="warning" .onClick=${() => this._handleSave()}></sutram-async-btn>
                ` : ''}
            </sutram-view>
        `;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
        }
        const normPath = this._normPath();
        const activeBuffers = window.inSetu.stores.Fs?.getState()?.activeBuffers || {};
        if (normPath && this._buffer && (activeBuffers[normPath] || activeBuffers[this.filepath])) {
            window.inSetu.stores.Fs.getState().updateBuffer(normPath, { 
                cursorPos: this._transientCursorPos, 
                scrollTop: this._transientScrollTop 
            });
        }
    }
}


export class InSetuFrontmatterEditor extends InSetuEditorProjection {
    constructor() {
        super();
        this.frontmatterMode = true;
        this._alwaysFrontmatter = true;
    }
}


export class InSetuFileDiffProjection extends InSetuElement {
    static get extensionName() { return 'fs'; }
    static properties = {
        filepath: { type: String }, compareFilepath: { type: String }, _loading: { type: Boolean },
        _error: { type: String }, _headContent: { type: String }, _workingContent: { type: String },
        _isUntracked: { type: Boolean }, _hasUnsavedBuffer: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.filepath = ''; this.compareFilepath = ''; this._loading = false; this._error = '';
        this._headContent = ''; this._workingContent = ''; this._isUntracked = false; this._hasUnsavedBuffer = false;
    }
    onWorkspaceLoad(workspaceId) {
        super.onWorkspaceLoad(workspaceId);
        if (this.filepath) {
            this._fetchDiff();
        }
    }

    onProjectionRekeyed(oldId, newId) {
        let updated = false;
        if (this.filepath === oldId) {
            this.filepath = newId;
            updated = true;
        } else if (this.filepath && this.filepath.startsWith(oldId + '/')) {
            this.filepath = newId + this.filepath.slice(oldId.length);
            updated = true;
        }
        if (this.compareFilepath === oldId) {
            this.compareFilepath = newId;
            updated = true;
        } else if (this.compareFilepath && this.compareFilepath.startsWith(oldId + '/')) {
            this.compareFilepath = newId + this.compareFilepath.slice(oldId.length);
            updated = true;
        }
        if (updated) this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.filepath && this.dataset.subId?.startsWith('vfs:pairdiff:')) {
            const pairStr = this.dataset.subId.replace('vfs:pairdiff:', '');
            const [leftFp, rightFp] = pairStr.split('::');
            this.filepath = leftFp || '';
            this.compareFilepath = rightFp || '';
        } else if (!this.filepath && this.dataset.subId?.startsWith('vfs:diff:')) {
            this.filepath = this.dataset.subId.replace('vfs:diff:', '');
        }
        this.subscribe(
            FsStore,
            state => {
                if (!this.filepath) return null;
                const normLeft = normalizeVfsURI(this.filepath);
                const leftBuf = state.activeBuffers?.[normLeft] || state.activeBuffers?.[this.filepath];
                const leftSnap = (leftBuf && leftBuf.isFS && leftBuf.content !== undefined && leftBuf.content !== 'Loading...')
                    ? leftBuf.content
                    : null;

                const targetFp = this.compareFilepath || this.filepath;
                const normRight = normalizeVfsURI(targetFp);
                const rightBuf = state.activeBuffers?.[normRight] || state.activeBuffers?.[targetFp];
                const rightSnap = (rightBuf && rightBuf.isFS && rightBuf.content !== undefined && rightBuf.content !== 'Loading...')
                    ? rightBuf.content
                    : null;
                const rightDirty = Boolean(rightBuf && rightBuf.isFS && rightBuf.content !== rightBuf.originalContent);

                return {
                    leftContent: this.compareFilepath ? leftSnap : null,
                    rightContent: rightSnap,
                    rightDirty
                };
            },
            (snap) => {
                if (!snap) return;
                let changed = false;
                if (this.compareFilepath && snap.leftContent !== null && snap.leftContent !== this._headContent) {
                    this._headContent = snap.leftContent;
                    changed = true;
                }
                if (snap.rightContent !== null && (snap.rightContent !== this._workingContent || snap.rightDirty !== this._hasUnsavedBuffer)) {
                    this._workingContent = snap.rightContent;
                    this._hasUnsavedBuffer = snap.rightDirty;
                    changed = true;
                }
                if (changed) this.requestUpdate();
            }
        );
        if (this.filepath) {
            this._fetchDiff();
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if ((changedProperties.has('filepath') || changedProperties.has('compareFilepath')) && this.filepath) {
            this._fetchDiff();
        }
    }

    async _readBufferOrFetch(targetFp) {
        const normFp = normalizeVfsURI(targetFp);
        const buf = FsStore.getState().activeBuffers?.[normFp] || FsStore.getState().activeBuffers?.[targetFp];
        if (buf && buf.isFS && buf.content !== undefined && buf.content !== 'Loading...') {
            return { text: buf.content, isDirty: buf.content !== buf.originalContent };
        }
        const res = await this.api.get(`fs/fetch?file=${encodeURIComponent(normFp)}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch '${normFp}' (HTTP ${res.status})`);
        }
        return { text: await res.text(), isDirty: false };
    }

    async _fetchDiff() {
        if (!this.filepath) return;
        this._loading = true;
        this._error = '';
        try {
            if (this.compareFilepath) {
                const [leftRes, rightRes] = await Promise.all([
                    this._readBufferOrFetch(this.filepath),
                    this._readBufferOrFetch(this.compareFilepath)
                ]);
                this._headContent = leftRes.text;
                this._workingContent = rightRes.text;
                this._hasUnsavedBuffer = rightRes.isDirty;
            } else {
                const normFp = normalizeVfsURI(this.filepath);
                const res = await this.api.get(`fs/git_diff?file=${encodeURIComponent(normFp)}`);
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }
                const data = await res.json();
                this._headContent = data.head_content || '';
                this._isUntracked = !!data.is_untracked;

                const buf = FsStore.getState().activeBuffers?.[normFp] || FsStore.getState().activeBuffers?.[this.filepath];
                if (buf && buf.isFS && buf.content !== undefined && buf.content !== 'Loading...') {
                    this._workingContent = buf.content;
                    this._hasUnsavedBuffer = buf.content !== buf.originalContent;
                } else {
                    this._workingContent = data.working_content || '';
                    this._hasUnsavedBuffer = false;
                }
            }
        } catch (e) {
            this._error = e.message || 'Failed to load diff.';
        } finally {
            this._loading = false;
        }
    }

    render() {
        if (this._loading) {
            return html`<sutram-view><sutram-spinner text="${this.compareFilepath ? 'Comparing selected files...' : 'Comparing against Git HEAD...'}"></sutram-spinner></sutram-view>`;
        }
        if (this._error) {
            return html`<sutram-view><sutram-surface variant="tinted" intent="danger" padding="md"><sutram-label ?monospace=${true} intent="danger" .text=${`Error: ${this._error}`}></sutram-label></sutram-surface></sutram-view>`;
        }
        const isPairMode = Boolean(this.compareFilepath);
        const leftLabel = isPairMode
            ? `Base: ${new window.inSetu.utils.InSetuURI(this.filepath).basename}`
            : (this._isUntracked ? 'Git HEAD (Untracked / New File)' : 'Git HEAD (Committed)');
        const rightLabel = isPairMode
            ? `Compare: ${new window.inSetu.utils.InSetuURI(this.compareFilepath).basename}`
            : (this._hasUnsavedBuffer ? 'Working Buffer (Unsaved Edits)' : 'Working Tree (Disk)');

        return html`
            <sutram-view ?flush=${true} ?noScroll=${true}>
                <sutram-surface slot="header" variant="panel" border="bottom" padding="xs">
                    <sutram-action-bar collapse="sm" align="between">
                        <code>
                            ${isPairMode
                                ? `${normalizeVfsURI(this.filepath)} ↔ ${normalizeVfsURI(this.compareFilepath)}`
                                : normalizeVfsURI(this.filepath)}
                        </code>
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-btn ?compact=${true} intent="neutral" icon="refresh-cw" label="Refresh" @click=${() => this._fetchDiff()}></sutram-btn>
                            <sutram-btn ?compact=${true} intent="primary" icon="edit-3" label="${isPairMode ? 'Edit Left' : 'Open Editor'}" @click=${() => viewSourceFile(this.filepath, true)}></sutram-btn>
                            ${isPairMode ? html`
                                <sutram-btn ?compact=${true} intent="highlight" icon="edit-3" label="Edit Right" @click=${() => viewSourceFile(this.compareFilepath, true)}></sutram-btn>
                            ` : ''}
                        </sutram-stack>
                    </sutram-action-bar>
                </sutram-surface>
                <sutram-diff-viewer
                    .searchStr=${this._headContent}
                    .replaceStr=${this._workingContent}
                    .leftTitle=${leftLabel}
                    .rightTitle=${rightLabel}>
                </sutram-diff-viewer>
            </sutram-view>
        `;
    }
}

if (!customElements.get('insetu-editor-projection')) {
    customElements.define('insetu-editor-projection', InSetuEditorProjection);
}
if (!customElements.get('insetu-frontmatter-editor')) {
    customElements.define('insetu-frontmatter-editor', InSetuFrontmatterEditor);
}
if (!customElements.get('insetu-file-diff-projection')) {
    customElements.define('insetu-file-diff-projection', InSetuFileDiffProjection);
}
