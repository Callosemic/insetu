import { LitElement, css } from 'lit';
import { InSetuElement } from '../sdk.js';
import { FsStore } from '../fs.js';
import { AppStore } from '../store.js';

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
        const { targetConfigs } = AppStore.getState();
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

async function loadLanguageExtension(lang) {
    try {
        if (lang === 'python') return (await import('https://esm.sh/@codemirror/lang-python')).python();
        if (lang === 'javascript') return (await import('https://esm.sh/@codemirror/lang-javascript')).javascript();
        if (lang === 'yaml') return (await import('https://esm.sh/@codemirror/lang-yaml')).yaml();
        if (lang === 'html') return (await import('https://esm.sh/@codemirror/lang-html')).html();
        if (lang === 'css') return (await import('https://esm.sh/@codemirror/lang-css')).css();
        if (lang === 'rust') return (await import('https://esm.sh/@codemirror/lang-rust')).rust();
        if (lang === 'go') return (await import('https://esm.sh/@codemirror/lang-go')).go();

        // Default fallback
        return (await import('https://esm.sh/@codemirror/lang-markdown')).markdown();
    } catch (e) {
        console.warn(`Failed to dynamically load language: ${lang}`, e);
        return [];
    }
}

export class InSetuMarkdownEditor extends InSetuElement {
    static properties = {
        value: { type: String },
        readOnly: { type: Boolean },
        language: { type: String }
    };

    static styles = css`
        :host { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; }
        .cm-editor { height: 100%; flex: 1; display: flex; flex-direction: column; }
        .cm-scroller { overflow: auto; flex: 1; font-family: var(--font-mono, monospace); }
    `;
    constructor() {
        super();
        this.value = '';
        this.readOnly = false;
        this.language = 'markdown';
        this._view = null;
        this.languageConf = null;
        this.readOnlyConf = null;
        this.linkConf = null;
        this._EditorView = null;
        this._settingsListener = this._handleSettingsChange.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('insetu-editor-settings-changed', this._settingsListener);
        setTimeout(() => this._initEditor(), 0);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('insetu-editor-settings-changed', this._settingsListener);
        if (this._view) {
            this._view.destroy();
            this._view = null;
        }
    }
    _handleSettingsChange() {
        if (this._view && this.linkConf && this._linkPluginExtension) {
            const val = localStorage.getItem('insetu_md_links');
            const enable = val !== null ? JSON.parse(val) : true;
            this._view.dispatch({
                effects: this.linkConf.reconfigure(enable ? this._linkPluginExtension : [])
            });
        }
    }
    updated(changedProperties) {
        if (this._view && this._EditorView && this.languageConf && this.readOnlyConf) {
            if (changedProperties.has('value')) {
                const currentDoc = this._view.state.doc.toString();
                if (currentDoc !== this.value) {
                    this._view.dispatch({
                        changes: { from: 0, to: currentDoc.length, insert: this.value || '' }
                    });
                }
            }
            if (changedProperties.has('readOnly')) {
                this._view.dispatch({
                    effects: this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))
                });
            }
            if (changedProperties.has('language')) {
                loadLanguageExtension(this.language).then(ext => {
                    if (this._view) {
                        this._view.dispatch({
                            effects: this.languageConf.reconfigure(ext)
                        });
                    }
                });
            }
        }
    }

    async _initEditor() {
        if (this._view || this._initializingEditor) return;
        this._initializingEditor = true;
        const [
            { EditorState, Compartment },
            { EditorView, basicSetup },
            { hoverTooltip }
        ] = await Promise.all([
            import('https://esm.sh/@codemirror/state'),
            import('https://esm.sh/codemirror'),
            import('https://esm.sh/@codemirror/view')
        ]);

        this.languageConf = new Compartment();
        this.readOnlyConf = new Compartment();
        this.linkConf = new Compartment();
        this._EditorView = EditorView;

        this._linkPluginExtension = hoverTooltip((view, pos, side) => {
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
                            dom.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener noreferrer" onclick="window.open(\'' + url + '\', \'_blank\', \'noopener,noreferrer\'); return false;" style="color: var(--intent-primary); font-weight: bold; text-decoration: none; font-size: 1.05rem; display: flex; align-items: center; gap: 12px; padding: 6px 4px;">Go ↗ <span style="color: var(--text-muted); font-size: 0.9rem; font-weight: normal; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + url + '</span></a>';
                            return { dom };
                        }
                    };
                }
            }
            return null;
        });

        const val = localStorage.getItem('insetu_md_links');
        const enableLinks = val !== null ? JSON.parse(val) : true;

        const checkboxToggleExtension = EditorView.domEventHandlers({
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

        const langExt = await loadLanguageExtension(this.language);

        // Guardrail: if the view was created or component unmounted while fetching
        if (this._view || !this.isConnected) {
            this._initializingEditor = false;
            return;
        }
        this._view = new EditorView({
            state: EditorState.create({
                doc: this.value || '',
                extensions: [
                    basicSetup,
                    checkboxToggleExtension,
                    this.languageConf.of(langExt),
                    this.readOnlyConf.of(EditorView.editable.of(!this.readOnly)),
                    this.linkConf.of(enableLinks ? this._linkPluginExtension : []),
                    EditorView.theme({
                        "&": { backgroundColor: "transparent", color: "var(--text)" },
                        ".cm-gutters": { backgroundColor: "var(--pane-bg)", color: "var(--text-muted)", borderRight: "1px solid var(--border)" },
                        ".cm-content": { fontFamily: "var(--font-mono, monospace)", fontSize: "13px" },
                        "&.cm-focused .cm-cursor": { borderLeftColor: "var(--text)" },
                        "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "rgba(59, 130, 246, 0.3)" }
                    }),
                    EditorView.lineWrapping,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            const newVal = update.state.doc.toString();
                            this.value = newVal;
                            this.dispatchEvent(new CustomEvent('content-changed', {
                                detail: { value: newVal },
                                bubbles: true,
                                composed: true
                            }));
                            this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                        }
                    })
                ]
            }),
            parent: this.renderRoot,
            root: this.renderRoot
        });

        this._initializingEditor = false;
    }
    getCursor() { return this._view ? this._view.state.selection.main.head : 0; }
    setCursor(pos) { if(this._view) this._view.dispatch({selection: {anchor: pos}}); }
    focus() { if(this._view) this._view.focus(); }

    insertAtCursor(text) {
        if (this._view) {
            const pos = this.getCursor();
            this._view.dispatch({
                changes: { from: pos, insert: text },
                selection: { anchor: pos + text.length },
                scrollIntoView: true
            });
        }
    }
}
customElements.define('insetu-markdown-editor', InSetuMarkdownEditor);
// Register local schema and action for the generic settings modal
if (window.ExtensionRegistry) {
    window.inSetu.settingsSchemas = window.inSetu.settingsSchemas || {};
    window.inSetu.settingsSchemas['editor'] = [
        { id: 'insetu_md_links', label: 'Enable Interactive MD Links', type: 'boolean', default: true, description: 'Renders Markdown links as clickable icons in the editor.' }
    ];
    window.ExtensionRegistry.registerExtension('editor', {
        name: "Editor Configuration",
        version: "1.0.0",
        settingsActions: [
            {
                id: 'editor_generic_settings',
                label: 'Editor Settings',
                icon: '📝',
                onClick: () => {
                    const genericModal = document.getElementById('insetu-generic-settings-root');
                    if (genericModal) genericModal.openModal('editor', true);
                }
            }
        ]
    });
}