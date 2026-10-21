import { LitElement, html, css } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';
import { SutramEditor, SutramProjectionWindowControls } from '/static/vendor/sutram/js/primitives.js';
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
    if (currentActiveFile && window.inSetu?.utils?.InSetuURI) {
        const curUri = new window.inSetu.utils.InSetuURI(currentActiveFile);
        const targetUri = new window.inSetu.utils.InSetuURI(path);

        if (curUri.repo && targetUri.repo && curUri.repo !== targetUri.repo) {
            finalPath = targetUri.toString();
        } else {
            const currentParts = curUri.pathSegments.slice(curUri.repo ? 1 : 0);
            currentParts.pop();
            const targetParts = targetUri.pathSegments.slice(targetUri.repo ? 1 : 0);
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
async function vendorizeEditorLanguage(lang) {
    if (window.inSetu?.api?.workspace?.post) {
        const res = await window.inSetu.api.workspace.post('editor/vendorize', { mode: lang });
        if (res.ok) {
            const data = await res.json();
            return data.path;
        }
    }
    return null;
}
window.Sutram = window.Sutram || {};
window.Sutram.vendorizeLanguage = vendorizeEditorLanguage;
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
export class InSetuProjectionWindowControls extends SutramProjectionWindowControls {}
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
export class InSetuMarkdownEditor extends SutramEditor {}
if (!customElements.get('insetu-markdown-editor')) {
    customElements.define('insetu-markdown-editor', InSetuMarkdownEditor);
}

// Register extension manifest for proper labeling in OS UI
if (window.ExtensionRegistry) {
    window.ExtensionRegistry.registerExtension('editor', {
        name: "Editor Preferences",
        version: "2.0.0",
        icon: "edit-3",
        allow_popout: true,
        offline_mode: "full",
        uiHooks: {
            'sutram:vendorize-language': (lang) => {
                return vendorizeEditorLanguage(lang);
            },
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
                } else if (id.includes('.insetu-data/tracker/')) {
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
                id: 'editor-save-active-buffer',
                context: 'global',
                key: 'ctrl+s',
                label: 'Save Active Document',
                action: () => {
                    const activePath = getActiveEditorPath();
                    if (activePath && window.inSetu?.ui?.saveBufferFile) {
                        window.inSetu.ui.saveBufferFile(activePath, false);
                    }
                }
            }
        ]
    });
}