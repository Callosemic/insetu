import { LitElement, css } from 'lit';
import { InSetuElement } from '../sdk.js';

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
            { MatchDecorator, WidgetType, ViewPlugin, Decoration }
        ] = await Promise.all([
            import('https://esm.sh/@codemirror/state'),
            import('https://esm.sh/codemirror'),
            import('https://esm.sh/@codemirror/view')
        ]);

        this.languageConf = new Compartment();
        this.readOnlyConf = new Compartment();
        this.linkConf = new Compartment();
        this._EditorView = EditorView;

        class LinkWidget extends WidgetType {
            constructor(url) { super(); this.url = url; }
            eq(other) { return this.url === other.url; }
            toDOM() {
                const btn = document.createElement('a');
                btn.href = this.url;
                btn.target = '_blank';
                btn.innerHTML = ' 🔗';
                btn.style.cssText = 'text-decoration: none; font-size: 0.9em; cursor: pointer; user-select: none; margin-left: 2px;';
                btn.title = "Open link: " + this.url;
                btn.onclick = (e) => { e.stopPropagation(); };
                return btn;
            }
        }

        const linkDecorator = new MatchDecorator({
            regexp: /\[([^\]]+)\]\(([^)]+)\)/g,
            decoration: (match) => Decoration.widget({
                widget: new LinkWidget(match[2]),
                side: 1
            })
        });

        this._linkPluginExtension = ViewPlugin.fromClass(class {
            constructor(view) { this.decorations = linkDecorator.createDeco(view); }
            update(update) { this.decorations = linkDecorator.updateDeco(update, this.decorations); }
        }, { decorations: v => v.decorations });
        const val = localStorage.getItem('insetu_md_links');
        const enableLinks = val !== null ? JSON.parse(val) : true;

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

    window.ExtensionRegistry.registerSettingsAction(
        'editor_settings',
        'Editor Settings',
        '📝',
        () => {
            const genericModal = document.getElementById('insetu-generic-settings-root');
            if (genericModal) genericModal.openModal('editor', true);
        },
        'System'
    );
}