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
    if (currentActiveFile) {
        const targetConfigs = AppStore.getState().targetConfigs || [];
        const getRepo = (p) => {
            const match = targetConfigs.find(c => p.startsWith(c.repo_dir + '/'));
            return match ? match.repo_dir : p.split('/')[0];
        };

        const currentRepo = getRepo(currentActiveFile);
        const targetRepo = getRepo(path);

        if (currentRepo !== targetRepo) {
            const targetPathWithinRepo = path.substring(targetRepo.length + 1);
            finalPath = `${targetRepo}::${targetPathWithinRepo}`;
        } else {
            const currentParts = currentActiveFile.split('/');
            currentParts.pop();
            const targetParts = path.split('/');
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
                width: 100vw !important; height: 100dvh !important;
                z-index: 99999 !important; background: var(--bg-deep, #05070a) !important;
            }
            :host([zen-mode]) .action-bar-row, :host([zen-mode]) slot[name="title-control"] {
                display: none !important;
            }
            .zen-exit-btn {
                position: fixed; top: 20px; right: 20px; z-index: 100000;
                background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--border); border-radius: 50%;
                width: 44px; height: 44px; display: none; align-items: center; justify-content: center;
                cursor: pointer; opacity: 0.1; transition: opacity 0.3s ease, color 0.3s ease;
            }
            :host([zen-mode]) .zen-exit-btn { display: flex; }
            :host([zen-mode]) .zen-exit-btn:hover { opacity: 1; color: var(--intent-danger); border-color: var(--intent-danger); }
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
    }

    _toggleWritingMode() {
        this._writingMode = !this._writingMode;
        this._yamlData = { ...this._yamlData, writing_mode: this._writingMode };
        this._checkDirty();
    }

    async _toggleZenMode() {
        if (!document.fullscreenElement) {
            try { await this.requestFullscreen(); } catch (e) { this.zenMode = true; }
        } else {
            document.exitFullscreen();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this._fsListener = () => { this.zenMode = !!document.fullscreenElement; };
        document.addEventListener('fullscreenchange', this._fsListener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._fsListener) document.removeEventListener('fullscreenchange', this._fsListener);
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('filepath') && this.filepath) {
            this._loadFile();
        }
    }
    async _loadFile() {
        if (!this.filepath) return;
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
            const pendingWrite = [...outbox].reverse().find(i => i.method === 'POST' && i.path.endsWith('fs/save') && i.payload?.filepath === this.filepath);
            if (pendingWrite && pendingWrite.payload?.content !== undefined) {
                text = pendingWrite.payload.content;
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
        this.requestUpdate();
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
                    window.inSetu.ui.setGlobalStatus("💾 File Saved Successfully", 2000);
                }
            }
        });
    }
    render() {
        if (this._loading) {
            return html`<div style="padding: 20px;"><yenvui-spinner text="Loading file..."></yenvui-spinner></div>`;
        }
        return html`
            <div style="display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg);"
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
                            .entityType=${'file'} 
                            .entityData=${{ 
                                filepath: this.filepath, 
                                isFS: true,
                                isDirty: this._isDirty,
                                getTransientState: () => this._content,
                                suppress: ['file-edit']
                            }}>
                        </sutram-entity-actions>
                    </div>
                    <sutram-btn variant="tinted" intent="neutral" style="margin: 0; --btn-padding: 4px 8px;" title="Toggle Prose Mode" @click=${() => this._toggleWritingMode()}>
                        ${this._writingMode ? '✍' : '💻'}
                    </sutram-btn>
                    <sutram-btn variant="tinted" intent="neutral" style="margin: 0; --btn-padding: 4px 8px;" title="Focus Mode" @click=${() => this._toggleZenMode()}>
                        ⛶
                    </sutram-btn>
                    <button class="meta-btn ${this._metadataExpanded ? 'active' : ''}"
                        @click=${() => this._metadataExpanded = !this._metadataExpanded}
                        title="Toggle Metadata">
                        ⚙️<span class="meta-btn-text"> Metadata</span> <span style="font-size: 0.7rem; margin-left: 2px;">${this._metadataExpanded ? '▲' : '▼'}</span>
                    </button>
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
                <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
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
                <button class="zen-exit-btn" title="Exit Focus Mode (Esc)" @click=${() => this._toggleZenMode()}>
                    <i data-lucide="minimize-2" style="width: 20px; height: 20px;"></i>
                </button>
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
        offline_mode: "full",
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
                id: 'editor-save-frontmatter',
                context: 'global',
                key: 'ctrl+s',
                label: 'Save Active Frontmatter Document',
                action: () => {
                    const activeEditor = document.querySelector('insetu-frontmatter-editor');
                    if (activeEditor && activeEditor._isDirty) {
                        activeEditor._handleSave();
                    }
                }
            }
        ]
    });
}