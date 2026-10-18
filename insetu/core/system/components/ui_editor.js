import { LitElement, html, css } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';

export function resolveEditorMode(filename) {
    if (!filename) return { ext: '', mode: null, isSupported: false, isMarkdown: false };
    const ext = filename.split('.').pop().toLowerCase();
    const modeMap = {
        'md': 'markdown', 'py': 'python', 'js': 'javascript',
        'json': 'javascript', 'sh': 'shell', 'ts': 'javascript',
        'rs': 'rust', 'go': 'go', 'yaml': 'yaml', 'yml': 'yaml',
        'html': 'html', 'htm': 'html', 'css': 'css'
    };
    return { ext, mode: modeMap[ext], isSupported: !!modeMap[ext], isMarkdown: ext === 'md' };
}
export function getActiveEditorPath() {
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (!layout) return null;
    const activeCol = layout.focusedColumn;

    // Direct UDF lookup: Check if the active projection in the focused column matches a buffer
    if (activeCol && layout.columns[activeCol] && layout.columns[activeCol].active) {
        const activeSub = layout.columns[activeCol].active;
        if (activeSub && window.inSetu.stores.Fs?.getState()?.activeBuffers[activeSub]) {
            return activeSub;
        }
    }

    // Fallback 1: Iterate DOM for focused element
    let activeEl = document.activeElement;
    while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
        activeEl = activeEl.shadowRoot.activeElement;
    }

    const projEl = activeEl ? activeEl.closest('insetu-editor-projection') : null;
    if (projEl && projEl.filepath) {
        return projEl.filepath;
    }

    // Fallback 3: Return the most recently updated buffer if only one is open
    const bufs = Object.keys(window.inSetu.stores.Fs?.getState()?.activeBuffers || {});
    if (bufs.length > 0) return bufs[0];

    return null;
}

export function getEditorContent() {
    const activePath = getActiveEditorPath();
    if (!activePath) return '';
    return window.inSetu.stores.Fs?.getState()?.activeBuffers[activePath]?.content || '';
}

export function setEditorContent(text) {
    const activePath = getActiveEditorPath();
    if (activePath) {
        window.inSetu.stores.Fs?.getState()?.updateBuffer(activePath, { content: text });
    }
}
export function insertTextAtCursor(textToInsert) {
    const activePath = getActiveEditorPath();
    if (!activePath) return;

    const state = window.inSetu.stores.Fs?.getState()?.activeBuffers[activePath];
    if (!state) return;

    window.dispatchEvent(new CustomEvent('insetu:editor-insert-text', {
        detail: { filepath: activePath, text: textToInsert },
        bubbles: true,
        composed: true
    }));
}
export function insertLinkToEditor(path, name) {
    let finalPath = path;
    const currentActiveFile = getActiveEditorPath();
    if (currentActiveFile && window.inSetu?.utils?.parseURI) {
        const curParsed = window.inSetu.utils.parseURI(currentActiveFile);
        const targetParsed = window.inSetu.utils.parseURI(path);

        if (curParsed.repo && targetParsed.repo && curParsed.repo !== targetParsed.repo) {
            finalPath = `vfs://${targetParsed.repo}/${targetParsed.relativePath}`;
        } else {
            const currentParts = (curParsed.relativePath || '').split('/').filter(Boolean);
            currentParts.pop();
            const targetParts = (targetParsed.relativePath || '').split('/').filter(Boolean);
            let commonLength = 0;
            while (commonLength < currentParts.length && commonLength < targetParts.length && currentParts[commonLength] === targetParts[commonLength]) {
                commonLength++;
            }
            const upSteps = currentParts.length - commonLength;
            const upString = upSteps > 0 ? '../'.repeat(upSteps) : './';
            const downString = targetParts.slice(commonLength).join('/');
            finalPath = upString + downString;
        }
    }
    const linkText = `[${name}](${finalPath})`;
    insertTextAtCursor(linkText);

    window.inSetu.stores.Fs?.getState()?.setModal('linkInsert', { open: false });
}
window.Sutram = window.Sutram || {};
window.Sutram.vendorizeLanguage = async (lang) => {
    if (window.inSetu?.api?.workspace?.post) {
        const res = await window.inSetu.api.workspace.post('editor/vendorize', { mode: lang });
        if (res.ok) {
            const data = await res.json();
            return data.path;
        }
    }
    return null;
};
export function canUseMultiWindowPopout() {
    const layout = window.Sutram?.stores?.Layout?.getState();
    return layout && typeof layout.canPopout === 'function' ? layout.canPopout() : true;
}

export function focusActivePopout(filepath) {
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (!layout || typeof layout.focusPopout !== 'function') return false;
    const ws = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
    const normFp = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(filepath) : filepath;
    return layout.focusPopout(normFp, ws) || layout.focusPopout(filepath, ws);
}

export function clearActivePopout(filepath, workspaceId = null) {
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (!layout || typeof layout.clearPopout !== 'function') return;
    const ws = workspaceId || (window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default');
    const normFp = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(filepath) : filepath;
    layout.clearPopout(normFp, ws);
    layout.clearPopout(filepath, ws);
}

export async function popoutProjection(filepath) {
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (layout && typeof layout.popoutProjection === 'function') {
        const ws = window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default';
        return await layout.popoutProjection(filepath, { scopeId: ws });
    }
}

export async function dockInProjection(filepath = null) {
    const layout = window.Sutram?.stores?.Layout?.getState();
    if (layout && typeof layout.dockInProjection === 'function') {
        return await layout.dockInProjection(filepath);
    }
}
export class InSetuProjectionWindowControls extends InSetuElement {
    static properties = {
        filepath: { type: String },
        beforeAction: { attribute: false }
    };
    static styles = [sharedStyles, css`:host { display: inline-flex; align-items: center; }`];

    render() {
        if (!this.filepath) return html``;
        const isPopout = new URLSearchParams(window.location.search).get('popout') === 'true';
        if (isPopout) {
            return html`
                <sutram-btn
                    intent="highlight"
                    variant="tinted"
                    icon="minimize-2"
                    label="Dock In"
                    title="Return projection to main workbench window"
                    style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem; margin: 0;"
                    @click=${async () => {
                        if (typeof this.beforeAction === 'function') await this.beforeAction();
                        if (window.inSetu?.ui?.dockInProjection) {
                            window.inSetu.ui.dockInProjection(this.filepath);
                        }
                    }}>
                </sutram-btn>
            `;
        }
        if (canUseMultiWindowPopout()) {
            return html`
                <sutram-btn
                    intent="neutral"
                    variant="tinted"
                    icon="external-link"
                    label="Pop Out"
                    title="Open in dedicated pop-out window"
                    style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem; margin: 0;"
                    @click=${async () => {
                        if (typeof this.beforeAction === 'function') await this.beforeAction();
                        if (window.inSetu?.ui?.popoutProjection) {
                            window.inSetu.ui.popoutProjection(this.filepath);
                        }
                    }}>
                </sutram-btn>
            `;
        }
        return html``;
    }
}
if (!customElements.get('insetu-projection-window-controls')) {
    customElements.define('insetu-projection-window-controls', InSetuProjectionWindowControls);
}

window.inSetu.ui = window.inSetu.ui || {};
window.inSetu.ui.canUseMultiWindowPopout = canUseMultiWindowPopout;
window.inSetu.ui.popoutProjection = popoutProjection;
window.inSetu.ui.dockInProjection = dockInProjection;
window.inSetu.ui.focusActivePopout = focusActivePopout;
window.inSetu.ui.clearActivePopout = clearActivePopout;

window.inSetu.editor = window.inSetu.editor || {};
window.inSetu.editor.getEditorContent = getEditorContent;
window.inSetu.editor.setEditorContent = setEditorContent;
window.inSetu.editor.insertTextAtCursor = insertTextAtCursor;
window.inSetu.editor.resolveEditorMode = resolveEditorMode;
window.inSetu.editor.insertLinkToEditor = insertLinkToEditor;
export class InSetuMarkdownEditor extends InSetuElement {
    static properties = {
        value: { type: String },
        readOnly: { type: Boolean },
        language: { type: String },
        writingMode: { type: Boolean }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; overflow: hidden; }
        `
    ];

    constructor() {
        super();
        this.value = '';
        this.readOnly = false;
        this.language = 'markdown';
        this.writingMode = false;
    }

    _handleEditorChange(e) {
        this.value = e.detail.value;
        this.dispatchEvent(new CustomEvent('content-changed', {
            detail: { value: this.value },
            bubbles: true,
            composed: true
        }));
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    insertAtCursor(text) {
        const editor = this.shadowRoot.querySelector('sutram-editor');
        if (editor && editor.insertAtCursor) {
            editor.insertAtCursor(text);
        }
    }

    transformContent(transformFn) {
        const editor = this.shadowRoot.querySelector('sutram-editor');
        if (editor && editor.transformContent) {
            return editor.transformContent(transformFn);
        }
        return false;
    }

    setCursor(pos) {
        const editor = this.shadowRoot.querySelector('sutram-editor');
        if (editor && editor.setCursor) editor.setCursor(pos);
    }

    setScrollInfo(top) {
        const editor = this.shadowRoot.querySelector('sutram-editor');
        if (editor && editor.setScrollInfo) editor.setScrollInfo(top);
    }

    render() {
        return html`
            <sutram-editor 
                .value=${this.value}
                .language=${this.language}
                .readOnly=${this.readOnly}
                ?writingMode=${this.writingMode}
                @editor-changed=${this._handleEditorChange}>
            </sutram-editor>
        `;
    }
}
if (!customElements.get('insetu-markdown-editor')) {
    customElements.define('insetu-markdown-editor', InSetuMarkdownEditor);
}
export class InSetuFrontmatterEditor extends InSetuElement {
    static properties = {
        filepath: { type: String },
        defaultExpanded: { type: Boolean },
        _content: { type: String },
        _yamlData: { type: Object },
        _loading: { type: Boolean },
        _isDirty: { type: Boolean },
        _metadataExpanded: { type: Boolean },
        _writingMode: { type: Boolean },
        zenMode: { type: Boolean, reflect: true, attribute: 'zen-mode' }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }
            .meta-btn {
                background: transparent;
                color: var(--text);
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 0.85rem;
                transition: background 0.2s;
                margin: 0;
                flex-shrink: 0;
            }
            .meta-btn:hover { background: var(--input-bg); }
            .meta-btn.active {
                background: var(--input-bg);
                border-color: var(--intent-primary);
                color: var(--intent-primary);
            }
            @container (max-width: 480px) {
                .meta-btn-text { display: none; }
                .meta-btn { padding: 4px 6px; }
            }
            .action-bar-row {
                padding: 6px 15px;
                background: var(--bg);
                border-top: 1px solid var(--border);
                border-bottom: 1px solid var(--border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-shrink: 0;
            }
            .action-bar-scroll {
                display: flex;
                gap: 8px;
                align-items: center;
                flex: 1;
                min-width: 0;
                overflow-x: auto;
                scrollbar-width: none;
                flex-wrap: nowrap;
                white-space: nowrap;
            }
            .action-bar-scroll::-webkit-scrollbar { display: none; }
            .footer-row {
                padding: 12px 20px;
                border-top: 1px solid var(--border);
                background: var(--input-bg);
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                gap: 12px;
                box-sizing: border-box;
                width: 100%;
            }
            .footer-btn-group {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
            }
            .btn-truncate {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            :host([zen-mode]) {
                position: fixed !important; inset: 0 !important;
                width: 100% !important; height: 100% !important;
                z-index: 99999 !important; background: var(--bg-deep, #05070a) !important;
                margin: 0 !important; max-width: none !important; max-height: none !important;
                border: none !important; padding: 0 !important; box-sizing: border-box !important;
            }
            .zen-exit-btn {
                position: absolute; top: 20px; right: 35px; z-index: 2147483647;
                background: var(--input-bg); color: var(--text-muted); border: 2px solid var(--border); border-radius: 50%;
                width: 48px; height: 48px; display: none; align-items: center; justify-content: center;
                cursor: pointer; opacity: 0.9; transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            :host([zen-mode]) .zen-exit-btn { display: flex; }
            :host([zen-mode]) .zen-exit-btn:hover { opacity: 1; color: var(--intent-danger); border-color: var(--intent-danger); transform: scale(1.05); }
            :host([zen-mode]) .zen-exit-btn:active { transform: scale(0.95); }
        `
    ];
    constructor() {
        super();
        this.filepath = '';
        this._content = '';
        this._yamlData = {};
        this._loading = false;
        this._isDirty = false;
        this._originalContent = '';
        this._originalYaml = '';
        this.defaultExpanded = false;
        this._metadataExpanded = false;
        this._writingMode = false;
        this.zenMode = false;
        this._autoSaveTimer = null;
    }

    _triggerDebouncedAutoSave() {
        if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = setTimeout(() => {
            if (this._isDirty && typeof this._handleSave === 'function') {
                this._handleSave();
            }
        }, 2000);
    }
    _cleanArtifacts() {
        const cleanFn = window.inSetu?.utils?.cleanCodeArtifacts;
        if (!cleanFn) return;
        const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
        let modified = false;
        if (cmEditor && cmEditor.transformContent) {
            modified = cmEditor.transformContent(cleanFn);
        } else if (this._content) {
            const nextContent = cleanFn(this._content);
            if (nextContent !== this._content) {
                this._content = nextContent;
                this._checkDirty();
                modified = true;
            }
        }
        if (modified) {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("✨ Cleaned citations and span tags", 2000);
        } else {
            if (window.inSetu?.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("No citation or span artifacts found", 2000);
        }
    }

    _toggleWritingMode() {
        this._writingMode = !this._writingMode;
        this._yamlData = { ...this._yamlData, writing_mode: this._writingMode };
        this._checkDirty();
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
            this._escListener = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this._toggleZenMode();
                }
            };
            window.addEventListener('keydown', this._escListener);
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
            if (this._escListener) {
                window.removeEventListener('keydown', this._escListener);
                this._escListener = null;
            }
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('insetu:editor:clean-artifacts', window, (e) => {
            if (!e.detail?.filepath || e.detail.filepath === this.filepath) {
                this._cleanArtifacts();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-prose', window, (e) => {
            if (e.detail?.filepath === this.filepath) {
                this._toggleWritingMode();
            }
        });
        this.registerGlobalListener('insetu:editor:toggle-zen', window, (e) => {
            if (e.detail?.filepath === this.filepath) {
                this._toggleZenMode();
            }
        });
        this.registerGlobalListener('insetu:editor:save-frontmatter', window, () => {
            if (this._isDirty) {
                this._handleSave();
            }
        });

        // Emergency Flush on Window Close (Protects in-flight keystrokes during debounce)
        this._beforeUnloadFlush = (e) => {
            if (this._isDirty) {
                if (e) {
                    e.preventDefault();
                    e.returnValue = '';
                }
                if (this.filepath && window.inSetu?.api?.keepalivePost) {
                    let latestYaml = { ...this._yamlData };
                    this.dispatchEvent(new CustomEvent('insetu:request-frontmatter', {
                        detail: { currentYaml: latestYaml, respond: (newYaml) => { latestYaml = newYaml; } },
                        bubbles: true, composed: true
                    }));
                    const newFileText = window.inSetu.utils.serializeFrontmatter(latestYaml, this._content);
                    const normPath = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(this.filepath) : this.filepath;
                    window.inSetu.api.keepalivePost('fs/save', {
                        filepath: normPath,
                        content: newFileText,
                        base_hash: null
                    });
                }
            }
        };
        window.addEventListener('beforeunload', this._beforeUnloadFlush);

        // Focus-Aware Idle Hot-Swap Listener
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const mutations = e.detail?.mutations || [];
            const normPath = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(this.filepath) : this.filepath;
            const isMatch = mutations.some(m => {
                const mNorm = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(m.filepath) : m.filepath;
                return mNorm === normPath || m.filepath === this.filepath;
            });

            if (isMatch) {
                const cmEditor = this.shadowRoot.querySelector('insetu-markdown-editor');
                const hasFocus = cmEditor?.shadowRoot?.activeElement || this.shadowRoot.activeElement;
                if (!this._isDirty && !hasFocus) {
                    this._loadFile();
                }
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._escListener) {
            window.removeEventListener('keydown', this._escListener);
        }
        if (this._beforeUnloadFlush) {
            window.removeEventListener('beforeunload', this._beforeUnloadFlush);
        }
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
        }
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') && this.filepath && this.filepath !== this._lastLoadedFilepath) {
            this._loadFile();
        }
    }
    async _loadFile() {
        if (!this.filepath) return;
        this._lastLoadedFilepath = this.filepath;
        this._loading = true;
        try {
            let text = null;
            try {
                const res = await window.inSetu.api.workspace.get(`fs/fetch?file=${encodeURIComponent(this.filepath)}`);
                if (res.ok) text = await res.text();
            } catch (e) {
                // Network or cache miss, proceed to outbox rescue
            }

            // Always check the outbox for pending writes to prevent stale cache reads offline
            const outbox = window.inSetu?.stores?.Offline?.getState()?.outboxItems || [];
            let pendingContent = undefined;
            [...outbox].reverse().find(i => {
                if (i.method === 'POST' && i.path.endsWith('fs/save')) {
                    try {
                        const payload = i.bodyString ? JSON.parse(i.bodyString) : (i.payload || {});
                        if (payload.filepath === this.filepath && payload.content !== undefined) {
                            pendingContent = payload.content;
                            return true;
                        }
                    } catch(e) {}
                }
                return false;
            });

            if (pendingContent !== undefined) {
                text = pendingContent;
            } else if (text === null) {
                throw new Error("Failed to read file.");
            }
            if (text !== null) {
                this._rawOriginalText = text;
                const { meta, content } = window.inSetu.utils.parseFrontmatter(text);
                this._yamlData = meta;
                const docType = (meta.doctype || meta.doc_type || '').toLowerCase();
                const proseDocTypes = ['prose', 'essay', 'article', 'draft', 'spec', 'story', 'novel'];
                this._writingMode = proseDocTypes.includes(docType) || meta.writing_mode === 'true' || meta.writing_mode === true;
                this._content = content.replace(/^\s+/, ''); // Strip leading newlines to keep it clean
                this._originalContent = this._content.trim();
                this._metadataExpanded = this.defaultExpanded;

                // Alert the parent extension so it can bind to its Zustand store if needed
                this.dispatchEvent(new CustomEvent('insetu:frontmatter-loaded', { 
                    detail: { yaml: meta, content: this._content },
                    bubbles: true, composed: true 
                }));

                let latestYaml = { ...this._yamlData };
                this.dispatchEvent(new CustomEvent('insetu:request-frontmatter', {
                    detail: {
                        currentYaml: latestYaml,
                        respond: (newYaml) => { latestYaml = newYaml; }
                    },
                    bubbles: true, composed: true
                }));
                this._yamlData = { ...latestYaml };
                this._originalYaml = JSON.stringify(latestYaml);
                this._isDirty = false;
                this.dispatchEvent(new CustomEvent('editor-dirty', { detail: { isDirty: false }, bubbles: true, composed: true }));
            } else {
                throw new Error("Failed to read file.");
            }
        } catch(e) {
            console.error("Editor load failed:", e);
        } finally {
            this._loading = false;
        }
    }
    _checkDirty() {
        queueMicrotask(() => {
            let latestYaml = { ...this._yamlData };
            this.dispatchEvent(new CustomEvent('insetu:request-frontmatter', {
                detail: {
                    currentYaml: latestYaml,
                    respond: (newYaml) => { latestYaml = newYaml; }
                },
                bubbles: true, composed: true
            }));
            const contentDirty = (this._content.trim() !== this._originalContent.trim());
            const yamlDirty = (JSON.stringify(latestYaml) !== this._originalYaml);
            this._isDirty = contentDirty || yamlDirty;
            this.dispatchEvent(new CustomEvent('editor-dirty', { detail: { isDirty: this._isDirty }, bubbles: true, composed: true }));
            if (this._isDirty) {
                this._triggerDebouncedAutoSave();
            }
            this.requestUpdate();
        });
    }

    async _handleSave() {
        // Pub/Sub Intercept: Ask the extension for its latest UI state before saving
        let latestYaml = { ...this._yamlData };
        this.dispatchEvent(new CustomEvent('insetu:request-frontmatter', {
            detail: {
                currentYaml: latestYaml,
                respond: (newYaml) => { latestYaml = newYaml; }
            },
            bubbles: true, composed: true
        }));
        // Reconstruct the frontmatter using the centralized SDK utility
        const newFileText = window.inSetu.utils.serializeFrontmatter(latestYaml, this._content);

        let baseHash = null;
        if (this._rawOriginalText) {
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this._rawOriginalText));
            baseHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
            filepath: this.filepath,
            content: newFileText,
            base_hash: baseHash
        }, {
            collapseKey: `vfs:save:${this.filepath}`,
            pendingMutations: [this.filepath],
            cacheBlobUrl: `/api/${window.inSetu.utils.getActiveWorkspace()}/fs/fetch?file=${encodeURIComponent(this.filepath)}`,
            cacheBlobContent: newFileText,
            loadingText: 'Saving...',
            onSuccess: () => {
                this._rawOriginalText = newFileText;
                this._yamlData = { ...latestYaml };
                this._originalContent = this._content.trim();
                this._originalYaml = JSON.stringify(latestYaml);
                this._isDirty = false;
                this.dispatchEvent(new CustomEvent('editor-dirty', { detail: { isDirty: false }, bubbles: true, composed: true }));
                this.requestUpdate();
                window.inSetu.events.emitHook('insetu:vfs-mutated', { mutations: [{ filepath: this.filepath, operation: 'save' }] });
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus("File Saved Successfully", 2000);
                }
            }
        });
    }
    render() {
        if (this._loading) {
            return html`<div style="padding: 20px;"><sutram-spinner text="Loading file..."></sutram-spinner></div>`;
        }
        return html`
            <div style="display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); position: relative;"
                @input=${() => this._checkDirty()}
                @sutram-input-changed=${() => this._checkDirty()}>
                <!-- Full-Width Title Control Header -->
                <div style="padding: 8px 15px 6px 15px; background: var(--bg); flex-shrink: 0;">
                    <slot name="title-control"></slot>
                </div>
                <!-- Entity Action Bar Row with Metadata Button on the Right -->
                <div class="action-bar-row">
                    <div class="action-bar-scroll">
                        <slot name="action-bar-extra"></slot>
                        <sutram-entity-actions 
                            variant="menu-bar"
                            ?scrollable=${true}
                            .entityType=${'file:editor'} 
                            .entityData=${{ 
                                filepath: this.filepath, 
                                isFS: true,
                                isMarkdown: true,
                                writingMode: this._writingMode,
                                isDirty: this._isDirty,
                                transientContent: this._content,
                                suppress: ['file-edit']
                            }}>
                        </sutram-entity-actions>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        <insetu-projection-window-controls
                            .filepath=${this.filepath}
                            .beforeAction=${async () => { if (this._isDirty) await this._handleSave(); }}>
                        </insetu-projection-window-controls>
                        <button class="meta-btn ${this._metadataExpanded ? 'active' : ''}"
                            @click=${() => this._metadataExpanded = !this._metadataExpanded}
                            title="Toggle Metadata">
                            <yv-icon name="settings" style="width: 14px; height: 14px;"></yv-icon><span class="meta-btn-text"> Metadata</span> <span style="font-size: 0.7rem; margin-left: 2px;">${this._metadataExpanded ? '▲' : '▼'}</span>
                        </button>
                    </div>
                </div>

                <!-- Collapsible Metadata Drawer (Default Collapsed, BELOW Action Bar) -->
                ${this._metadataExpanded ? html`
                    <div style="padding: 8px 15px; background: var(--input-bg); border-bottom: 1px solid var(--border); flex-shrink: 0;">
                        <slot name="metadata-controls">
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${Object.keys(this._yamlData || {}).map(k => html`
                                    <div style="flex: 1; min-width: 150px;">
                                        <sutram-input ?flush=${true} label=${k} .value=${this._yamlData[k]} @sutram-input-changed=${e => {
                                            this._yamlData = { ...this._yamlData, [k]: e.detail.value };
                                            this._checkDirty();
                                        }}></sutram-input>
                                    </div>
                                `)}
                            </div>
                        </slot>
                    </div>
                ` : ''}
                <!-- Core Markdown / CodeMirror Canvas -->
                <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; z-index: 1;">
                    <insetu-markdown-editor 
                        .value=${this._content}
                        language="markdown"
                        ?writingMode=${this._writingMode}
                        @content-changed=${e => {
                            this._content = e.detail.value;
                            this._checkDirty();
                        }}>
                    </insetu-markdown-editor>
                </div>
                ${this.zenMode ? html`
                    <div style="position: absolute; inset: 0; pointer-events: none; z-index: 2147483647; display: flex; justify-content: flex-end; align-items: flex-start; padding: 20px 35px;">
                        <button title="Exit Focus Mode (Esc)" 
                            style="background: var(--intent-danger); color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 0.9rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: auto;"
                            @pointerdown=${(e) => { e.preventDefault(); e.stopPropagation(); this._toggleZenMode(); }}
                            @click=${(e) => { e.preventDefault(); e.stopPropagation(); this._toggleZenMode(); }}>
                            <yv-icon name="minimize-2" style="width: 16px; height: 16px; pointer-events: none;"></yv-icon> Exit Focus
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
}
if (!customElements.get('insetu-frontmatter-editor')) {
    customElements.define('insetu-frontmatter-editor', InSetuFrontmatterEditor);
}
// Register extension manifest for proper labeling in OS UI
if (window.ExtensionRegistry) {
    window.ExtensionRegistry.registerExtension('editor', {
        name: "Editor Preferences",
        version: "2.0.0",
        allow_popout: true,
        offline_mode: "full",
        uiHooks: {
            'sutram:resolve-editor-component': (id) => {
                return 'insetu-editor-projection';
            },
            'sutram:normalize-projection-id': (id) => {
                return window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(id) : id;
            },
            'sutram:popout-fallback': (id) => {
                window.inSetu?.events?.emit('insetu:editor:toggle-zen', { filepath: id });
                if (window.inSetu?.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`🔍 Maximized in Focus Mode (PWA single-window environment)`, 2500);
                }
                return true;
            },
            'sutram:before-popout': (id) => {
                const normFp = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(id) : id;
                const fsState = window.inSetu?.stores?.Fs?.getState() || {};
                const buf = fsState.activeBuffers?.[normFp] || fsState.activeBuffers?.[id];
                if (buf && buf.isFS && buf.content !== buf.originalContent && window.inSetu?.ui?.saveBufferFile) {
                    return window.inSetu.ui.saveBufferFile(normFp, true);
                }
                return null;
            },
            'sutram:before-dock-in': (id) => {
                const normFp = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(id) : id;
                const fsState = window.inSetu?.stores?.Fs?.getState() || {};
                const buf = fsState.activeBuffers?.[normFp] || fsState.activeBuffers?.[id];
                if (buf && buf.isFS && buf.content !== buf.originalContent && window.inSetu?.ui?.saveBufferFile) {
                    return window.inSetu.ui.saveBufferFile(normFp, true);
                }
                return null;
            },
            'sutram:build-popout-url': ({ id, colId, scopeId }) => {
                const ws = scopeId || (window.inSetu?.utils?.getActiveWorkspace ? window.inSetu.utils.getActiveWorkspace() : 'default');
                const token = sessionStorage.getItem('insetu_boot_token') || '';
                const isSlot = window.ExtensionRegistry?.getLayoutSlots?.().some(s => s.id === id || s.rawId === id);
                if (isSlot) {
                    return `/?popout=true&token=${encodeURIComponent(token)}#/${encodeURIComponent(ws)}/${encodeURIComponent(colId)}/${encodeURIComponent(id)}`;
                }
                return `/?popout=true&token=${encodeURIComponent(token)}#/${encodeURIComponent(ws)}/${encodeURIComponent(colId)}/editor/${encodeURIComponent(id)}`;
            },
            'sutram:restore-docked-projection': ({ id, colId }) => {
                if (id.startsWith('ctx://notes/') || id.includes('.insetu-data/notes/')) {
                    if (window.inSetu?.stores?.Notes?.getState()?.openNoteEditor) {
                        window.inSetu.stores.Notes.getState().openNoteEditor(id);
                        return true;
                    }
                } else if (id.includes('.insetu-data/tracker/') || id.includes('.tracker/')) {
                    const normTaskUri = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(id) : id;
                    window.inSetu.events.emit('insetu:tracker:open-edit-task', { filepath: normTaskUri });
                    return true;
                } else if (window.inSetu?.vfs?.viewSourceFile) {
                    const isReadOnlyTpl = !id.includes('/.templates/user/') && id.includes('/.templates/');
                    const isShared = id.startsWith('ws://');
                    const isEditable = !isReadOnlyTpl && !isShared && (!id.startsWith('ctx://') || id.startsWith('ctx://prompts/'));
                    window.inSetu.vfs.viewSourceFile(id, isEditable);
                    return true;
                }
                return false;
            },
            'sutram:popout-projection': (id) => {
                if (id) {
                    popoutProjection(id);
                    return true;
                }
                return false;
            }
        },
        entityActions: [
            {
                targetEntity: 'editor',
                id: 'editor-toggle-prose',
                label: (data) => data?.writingMode ? 'Code Mode' : 'Prose Mode',
                icon: (data) => data?.writingMode ? 'code' : 'pen-tool',
                group: 'tools',
                vfsBound: false,
                intent: 'neutral',
                order: 11,
                match: (data) => !!data?.isMarkdown,
                emitEvent: (data) => ({ name: 'insetu:editor:toggle-prose', detail: { filepath: data.filepath } })
            },
            {
                targetEntity: 'editor',
                id: 'editor-focus-mode',
                label: 'Focus Mode',
                icon: 'maximize-2',
                group: 'tools',
                vfsBound: false,
                intent: 'neutral',
                order: 12,
                emitEvent: (data) => ({ name: 'insetu:editor:toggle-zen', detail: { filepath: data.filepath } })
            },
            {
                targetEntity: 'editor',
                id: 'editor-clean-ai-tags',
                label: 'Clean AI Tags',
                icon: 'sparkles',
                group: 'tools',
                vfsBound: false,
                intent: 'neutral',
                order: 13,
                emitEvent: (data) => ({ name: 'insetu:editor:clean-artifacts', detail: { filepath: data.filepath } })
            },
            {
                targetEntity: 'editor',
                id: 'editor-popout-window',
                label: 'Pop Out',
                icon: 'external-link',
                group: 'tools',
                vfsBound: false,
                intent: 'neutral',
                order: 14,
                match: () => canUseMultiWindowPopout(),
                onClick: (data) => {
                    popoutProjection(data.filepath);
                }
            }
        ],
        shortcuts: [
            {
                id: 'editor-indent-tab',
                context: 'element:textarea',
                key: 'tab',
                label: 'Indent (4 Spaces)',
                action: (e) => {
                    const el = e.target;
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    el.value = el.value.substring(0, start) + "    " + el.value.substring(end);
                    el.selectionStart = el.selectionEnd = start + 4;
                    el.dispatchEvent(new Event('input'));
                }
            },
            {
                id: 'editor-clean-artifacts',
                context: 'global',
                key: 'ctrl+alt+c',
                label: 'Clean AI Tags',
                action: () => {
                    const activePath = getActiveEditorPath();
                    window.inSetu?.events?.emit('insetu:editor:clean-artifacts', { filepath: activePath });
                }
            },
            {
                id: 'editor-save-frontmatter',
                context: 'global',
                key: 'ctrl+s',
                label: 'Save Active Frontmatter Document',
                action: () => {
                    window.inSetu?.events?.emit('insetu:editor:save-frontmatter');
                }
            }
        ]
    });
}