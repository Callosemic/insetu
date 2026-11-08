import { LitElement, html, css } from 'lit';
import { InSetuElement, sharedStyles, SutramEditor, SutramProjectionWindowControls } from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';

// The manifest's built-in entries, used until languages.json arrives so the first paint is highlighted.
// test_editor_vendorize.py checks that this table matches the manifest's built-in entries exactly.
export const _BUILTIN_FALLBACK_LANGUAGES = {
    python: { label: 'Python', kind: 'builtin', export: 'python', extensions: ['py', 'pyi'] },
    javascript: { label: 'JavaScript', kind: 'builtin', export: 'javascript', options: { jsx: true }, extensions: ['js', 'mjs', 'cjs', 'jsx'] },
    typescript: { label: 'TypeScript', kind: 'builtin', export: 'javascript', options: { typescript: true, jsx: true }, extensions: ['ts', 'mts', 'cts', 'tsx'] },
    json: { label: 'JSON', kind: 'builtin', export: 'json', extensions: ['json', 'jsonl'] },
    yaml: { label: 'YAML', kind: 'builtin', export: 'yaml', extensions: ['yaml', 'yml'] },
    html: { label: 'HTML', kind: 'builtin', export: 'htmlLang', extensions: ['html', 'htm'] },
    css: { label: 'CSS', kind: 'builtin', export: 'cssLang', extensions: ['css'] },
    markdown: { label: 'Markdown', kind: 'builtin', export: 'markdown', extensions: ['md', 'markdown'] }
};

let _languageCatalog = { ..._BUILTIN_FALLBACK_LANGUAGES };
let _filenameToMode = new Map();
let _extToMode = new Map();

function _rebuildLanguageLookupTables(languagesObj) {
    _languageCatalog = { ..._BUILTIN_FALLBACK_LANGUAGES, ...(languagesObj || {}) };
    const nextFilenames = new Map();
    const nextExts = new Map();
    for (const [modeId, spec] of Object.entries(_languageCatalog)) {
        if (!spec || typeof spec !== 'object') continue;
        for (const fn of (spec.filenames || [])) {
            const cleanFn = String(fn || '').trim().toLowerCase();
            if (cleanFn && !nextFilenames.has(cleanFn)) {
                nextFilenames.set(cleanFn, modeId);
            }
        }
        for (const ext of (spec.extensions || [])) {
            const cleanExt = String(ext || '').trim().replace(/^\./, '').toLowerCase();
            if (cleanExt && !nextExts.has(cleanExt)) {
                nextExts.set(cleanExt, modeId);
            }
        }
    }
    _filenameToMode = nextFilenames;
    _extToMode = nextExts;
}

_rebuildLanguageLookupTables(_BUILTIN_FALLBACK_LANGUAGES);

function _refreshOpenBufferModes() {
    // Buffers opened before the manifest arrived were resolved against the fallback table; re-resolve them.
    const fsStore = (typeof window !== 'undefined') ? window.inSetu?.stores?.Fs : null;
    const buffers = fsStore?.getState()?.activeBuffers;
    if (!buffers) return;
    for (const [path, buf] of Object.entries(buffers)) {
        if (!buf || buf.isMemoryOnly) continue;
        const { mode } = resolveEditorMode(path);
        if (mode && buf.codeMode !== mode) {
            fsStore.getState().updateBuffer(path, { codeMode: mode });
        }
    }
}

async function _hydrateEditorLanguageManifest() {
    try {
        if (window.inSetu?.api?.request) {
            const staticRes = await window.inSetu.api.request('/static/vendor/codemirror/languages.json');
            if (staticRes && staticRes.ok) {
                const staticData = await staticRes.json();
                if (staticData && typeof staticData.languages === 'object') {
                    _rebuildLanguageLookupTables(staticData.languages);
                    _refreshOpenBufferModes();
                }
            }
        }
    } catch (_) {}

    try {
        if (window.inSetu?.api?.get) {
            const mergedRes = await window.inSetu.api.get('editor/languages');
            if (mergedRes && mergedRes.ok) {
                const mergedData = await mergedRes.json();
                if (mergedData && typeof mergedData.languages === 'object') {
                    _rebuildLanguageLookupTables(mergedData.languages);
                    _refreshOpenBufferModes();
                }
            }
        }
    } catch (_) {}
}

let _mdLinksEnabled = true;

async function _hydrateEditorGlobalSettings() {
    try {
        if (window.inSetu?.api?.get) {
            const res = await window.inSetu.api.get('editor/settings');
            if (res && res.ok) {
                const data = await res.json();
                if (data && data.insetu_md_links !== undefined) {
                    _mdLinksEnabled = Boolean(data.insetu_md_links);
                    window.dispatchEvent(new CustomEvent('insetu:md-links-preference-updated', {
                        detail: { enabled: _mdLinksEnabled }
                    }));
                }
            }
        }
    } catch (_) {}
}

export function isMarkdownLinksEnabled() {
    return _mdLinksEnabled;
}

if (typeof window !== 'undefined') {
    queueMicrotask(() => {
        _hydrateEditorLanguageManifest();
        _hydrateEditorGlobalSettings();
    });
    window.addEventListener('insetu:soft-refresh', () => {
        _hydrateEditorLanguageManifest();
        _hydrateEditorGlobalSettings();
    });
    window.addEventListener('insetu-editor-settings-changed', () => {
        _hydrateEditorGlobalSettings();
    });
}

/** Replaces the language lookup tables with a manifest's languages (used by tests and hosts that preload it). */
export function setEditorLanguageManifest(languagesObj) {
    _rebuildLanguageLookupTables(languagesObj);
}

export function resolveEditorMode(filename) {
    if (!filename || typeof filename !== 'string') {
        return { ext: '', mode: 'plaintext', isMarkdown: false };
    }
    const norm = filename.replace(/\\/g, '/').replace(/\/+$/, '');
    const slashIdx = norm.lastIndexOf('/');
    const baseName = (typeof window !== 'undefined' && window.inSetu?.utils?.InSetuURI)
        ? new window.inSetu.utils.InSetuURI(filename).basename
        : (slashIdx >= 0 ? norm.slice(slashIdx + 1) : norm);
    const lowerBase = String(baseName || '').toLowerCase();
    const dotIdx = lowerBase.lastIndexOf('.');
    const ext = dotIdx > 0 ? lowerBase.slice(dotIdx + 1) : '';

    // 1. Exact filename match wins over extension match (e.g. Dockerfile, .bashrc, CMakeLists.txt)
    if (lowerBase && _filenameToMode.has(lowerBase)) {
        const mode = _filenameToMode.get(lowerBase);
        return { ext, mode, isMarkdown: mode === 'markdown' };
    }

    // 2. Extension match
    if (ext && _extToMode.has(ext)) {
        const mode = _extToMode.get(ext);
        return { ext, mode, isMarkdown: mode === 'markdown' };
    }

    return { ext, mode: 'plaintext', isMarkdown: false };
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

export function resolveEditorLinkTarget(rawHref, currentFileUri = null) {
    const href = String(rawHref || '').trim();
    if (!href || href.startsWith('#')) return null;

    if (/^(?:https?:|mailto:)/i.test(href)) {
        return { type: 'external', url: href };
    }

    const rawPathPart = href.split('#')[0].split('?')[0].trim();
    let cleanHref = rawPathPart;
    try {
        cleanHref = decodeURIComponent(rawPathPart);
    } catch (_) {}
    if (!cleanHref) return null;

    const UriCls = window.inSetu?.utils?.InSetuURI;
    if (cleanHref.includes('://')) {
        const parsed = UriCls ? new UriCls(cleanHref) : null;
        return { type: 'vfs', uri: parsed ? parsed.toString() : cleanHref };
    }

    const activeFile = currentFileUri || getActiveEditorPath();
    if (activeFile && UriCls) {
        const baseUri = new UriCls(activeFile);
        if (baseUri.scheme === 'vfs' || baseUri.scheme === 'ctx' || baseUri.scheme === 'ws') {
            return { type: 'vfs', uri: baseUri.resolveRelative(cleanHref) };
        }
    }

    const fallbackUri = window.inSetu?.vfs?.normalizeVfsURI
        ? window.inSetu.vfs.normalizeVfsURI(cleanHref)
        : cleanHref;
    return { type: 'vfs', uri: fallbackUri };
}

export async function openEditorLinkTarget(rawHref, currentFileUri = null) {
    const resolved = resolveEditorLinkTarget(rawHref, currentFileUri);
    if (!resolved) return false;

    if (resolved.type === 'external') {
        window.open(resolved.url, '_blank', 'noopener,noreferrer');
        return true;
    }

    const targetUri = resolved.uri;
    if (!targetUri) return false;
    const UriCls = window.inSetu?.utils?.InSetuURI;
    const parsed = UriCls ? new UriCls(targetUri) : null;
    if (parsed && parsed.isCompiledArtifact && window.inSetu?.vfs?.viewInWindow) {
        await window.inSetu.vfs.viewInWindow(targetUri);
        return true;
    }
    if (window.inSetu?.vfs?.viewSourceFile) {
        const isEditable = parsed
            ? Boolean(parsed.isEditable)
            : (!targetUri.startsWith('ws://') && !targetUri.includes('/.templates/'));
        await window.inSetu.vfs.viewSourceFile(targetUri, isEditable);
        return true;
    }
    return false;
}

async function vendorizeEditorLanguage(lang) {
    if (window.inSetu?.api?.post) {
        const res = await window.inSetu.api.post('editor/vendorize', { mode: lang });
        if (res.ok) {
            const data = await res.json();
            const url = data.url || data.path || '';
            if (!url) return null;
            return {
                url,
                path: data.path || url,
                kind: data.kind || 'lezer',
                export: data.export || lang,
                options: data.options || {}
            };
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
window.inSetu.editor.resolveEditorLinkTarget = resolveEditorLinkTarget;
window.inSetu.editor.openEditorLinkTarget = openEditorLinkTarget;
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
                const normId = window.inSetu?.vfs?.normalizeVfsURI ? window.inSetu.vfs.normalizeVfsURI(id) : id;
                const customEd = window.ExtensionRegistry?.resolveCustomEditor?.(normId);
                if (customEd && typeof customEd.onOpen === 'function') {
                    customEd.onOpen(normId);
                    return true;
                }
                if (window.inSetu?.vfs?.viewSourceFile) {
                    const parsed = window.inSetu?.utils?.InSetuURI ? new window.inSetu.utils.InSetuURI(normId) : null;
                    const isEditable = parsed ? parsed.isEditable : (!normId.startsWith('ws://') && !normId.includes('/.templates/'));
                    window.inSetu.vfs.viewSourceFile(normId, isEditable);
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
                id: 'editor-toggle-macro-preview',
                label: (data) => data?.previewMode ? (data?.isFS ? 'Edit Source' : 'Raw Source') : 'Preview Macros',
                icon: (data) => data?.previewMode ? 'edit-3' : 'eye',
                group: 'tools',
                vfsBound: false,
                intent: 'highlight',
                order: 10.5,
                match: (data) => !!data?.supportsMacroPreview,
                emitEvent: (data) => ({ name: 'insetu:editor:toggle-preview', detail: { filepath: data.filepath } })
            },
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
                    let el = window.inSetu?.utils?.getEventTarget ? window.inSetu.utils.getEventTarget(e) : e.target;
                    if (!el || typeof el.value !== 'string') {
                        el = document.activeElement;
                        while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                            el = el.shadowRoot.activeElement;
                        }
                    }
                    if (!el || typeof el.value !== 'string') return;
                    const start = el.selectionStart ?? el.value.length;
                    const end = el.selectionEnd ?? start;
                    el.value = el.value.substring(0, start) + "    " + el.value.substring(end);
                    el.selectionStart = el.selectionEnd = start + 4;
                    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
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