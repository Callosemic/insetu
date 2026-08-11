import { LitElement, html, css } from 'lit';
import { InSetuElement } from '../sdk.js';
import { FsStore } from '../fs.js';
import { AppStore } from '../store.js';
import { sharedStyles } from '../../../vendor/sutram/js/shared_styles.js';

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

export function getEditorContent() {
    return FsStore.getState().fileModal.content;
}
export function setEditorContent(text) {
    FsStore.setState(s => ({ fileModal: { ...s.fileModal, content: text } }));
}
export function insertTextAtCursor(textToInsert) {
    const state = FsStore.getState().fileModal;
    const modalEl = document.querySelector('insetu-file-modal');

    if (modalEl && modalEl.shadowRoot) {
        const cmEditor = modalEl.shadowRoot.querySelector('insetu-markdown-editor');
        const textarea = modalEl.shadowRoot.querySelector('textarea');

        if (state.isSupportedEditor && cmEditor) {
            cmEditor.insertAtCursor(textToInsert);
            return; 
        } else if (textarea) {
            const insertPos = textarea.selectionStart;
            const newContent = state.content.substring(0, insertPos) + textToInsert + state.content.substring(insertPos);
            const st = textarea.scrollTop;

            textarea.value = newContent;
            textarea.selectionStart = textarea.selectionEnd = insertPos + textToInsert.length;
            textarea.scrollTop = st;

            FsStore.setState({ fileModal: { ...state, content: newContent } });
            return;
        }
    }

    FsStore.setState({ fileModal: { ...state, content: state.content + "\n" + textToInsert } });
}
export function insertLinkToEditor(path, name) {
    let finalPath = path;
    const currentModalFile = FsStore.getState().fileModal.filename;
    if (currentModalFile) {
        const targetConfigs = AppStore.getState().targetConfigs || [];
        const getRepo = (p) => {
            const match = targetConfigs.find(c => p.startsWith(c.repo_dir + '/'));
            return match ? match.repo_dir : p.split('/')[0];
        };

        const currentRepo = getRepo(currentModalFile);
        const targetRepo = getRepo(path);

        if (currentRepo !== targetRepo) {
            const targetPathWithinRepo = path.substring(targetRepo.length + 1);
            finalPath = `${targetRepo}::${targetPathWithinRepo}`;
        } else {
            const currentParts = currentModalFile.split('/');
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

    FsStore.getState().setModal('linkInsert', { open: false });
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
        _customExtensions: { type: Array },
        _mdLinksEnabled: { type: Boolean }
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
        this._customExtensions = [];
        this._mdLinksEnabled = true;
        this._settingsListener = this._handleSettingsChange.bind(this);
        this._linkPluginBase = null;
        this._checkboxPluginBase = null;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('insetu-editor-settings-changed', this._settingsListener);
        this._buildExtensions();
        this._fetchSettings();
    }

    async _fetchSettings() {
        try {
            const res = await window.inSetu.api.workspace('editor/settings');
            if (res.ok) {
                const data = await res.json();
                this._mdLinksEnabled = data.insetu_md_links !== false;
                this._updateCustomExtensions();
            }
        } catch(e) {}
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('insetu-editor-settings-changed', this._settingsListener);
    }
    _handleSettingsChange() {
        this._fetchSettings();
    }

    async _buildExtensions() {
        const [
            { EditorView },
            { hoverTooltip }
        ] = await Promise.all([
            import('https://esm.sh/@codemirror/view'),
            import('https://esm.sh/@codemirror/view')
        ]);

        this._linkPluginBase = hoverTooltip((view, pos, side) => {
            let { from, to, text } = view.state.doc.lineAt(pos);
            let match;
            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            while ((match = linkRegex.exec(text)) !== null) {
                let start = from + match.index;
                let end = start + match[0].length;
                if (pos >= start && pos <= end) {
                    const url = match[2];
                    return {
                        pos: start,
                        end,
                        above: true,
                        create(view) {
                            let dom = document.createElement("div");
                            dom.className = "wiki-link-popup";
                            dom.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener noreferrer" onclick="window.open(\\\'' + url + '\\\', \\\'_blank\\\', \\\'noopener,noreferrer\\\'); return false;" style="color: var(--intent-primary); font-weight: bold; text-decoration: none; font-size: 1.05rem; display: flex; align-items: center; gap: 12px; padding: 6px 4px;">Go ↗ <span style="color: var(--text-muted); font-size: 0.9rem; font-weight: normal; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + url + '</span></a>';
                            return { dom };
                        }
                    };
                }
            }
            return null;
        });

        this._checkboxPluginBase = EditorView.domEventHandlers({
            mousedown(e, view) {
                const pos = view.posAtCoords({x: e.clientX, y: e.clientY});
                if (pos === null) return false;
                const line = view.state.doc.lineAt(pos);
                const match = /^\s*-\s*\[([ xX])\]/.exec(line.text);
                if (match) {
                    const boxStart = line.from + match[0].indexOf('[');
                    const boxEnd = line.from + match[0].indexOf(']') + 1;
                    if (pos >= boxStart && pos <= boxEnd) {
                        e.preventDefault();
                        const isChecked = match[1] !== ' ';
                        const char = isChecked ? ' ' : 'x';
                        view.dispatch({
                            changes: { from: boxStart + 1, to: boxEnd - 1, insert: char }
                        });
                        return true;
                    }
                }
                return false;
            }
        });

        this._updateCustomExtensions();
    }
    _updateCustomExtensions() {
        if (!this._linkPluginBase || !this._checkboxPluginBase) return;

        const exts = [this._checkboxPluginBase];
        if (this._mdLinksEnabled) exts.push(this._linkPluginBase);

        this._customExtensions = [...exts];
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
                .customExtensions=${this._customExtensions}
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
        _metadataExpanded: { type: Boolean }
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
            @media (max-width: 480px) {
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
            const res = await window.inSetu.api.workspace(`fs/fetch?file=${encodeURIComponent(this.filepath)}`);
            if (res.ok) {
                const text = await res.text();
                const { meta, content } = window.inSetu.utils.parseFrontmatter(text);
                this._yamlData = meta;
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

        await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
            filepath: this.filepath,
            content: newFileText
        }, {
            loadingText: 'Saving...',
            onSuccess: () => {
                this._yamlData = { ...latestYaml };
                this._originalContent = this._content.trim();
                this._originalYaml = JSON.stringify(latestYaml);
                this._isDirty = false;
                this.dispatchEvent(new CustomEvent('editor-dirty', { detail: { isDirty: false }, bubbles: true, composed: true }));
                this.requestUpdate();

                window.inSetu.events.emitHook('zone:vfs-mutated', { mutations: [{ filepath: this.filepath, operation: 'save' }] });

                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus("💾 File Saved Successfully", 2000);
                }
            }
        });
    }

    render() {
        if (this._loading) {
            return html`<div class="spinner" style="display:block; padding: 20px;">Loading file...</div>`;
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
                            style="flex-wrap: nowrap; display: flex;"
                            .entityType=${'file'} 
                            .entityData=${{ 
                                filepath: this.filepath, 
                                isFS: true,
                                suppress: ['file-edit']
                            }}>
                        </sutram-entity-actions>
                    </div>
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
                        @content-changed=${e => {
                            this._content = e.detail.value;
                            this._checkDirty();
                        }}>
                    </insetu-markdown-editor>
                </div>
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
        shortcuts: [
            {
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
            }
        ]
    });
}