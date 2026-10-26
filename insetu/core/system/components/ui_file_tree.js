import { html, css } from 'lit';
import { resolveDirectoryState, SutramWorker } from '../../../vendor/sutram/js/utils.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { SutramCard } from '../../../vendor/sutram/js/primitives.js';
import { InSetuElement } from '/static/extensions/system/insetu_sdk.js';
export function buildUriFileTree(uris, rootScope = '') {
    const normScope = (rootScope || 'vfs://').trim();
    const isSchemeOnlyScope = /^[a-zA-Z0-9_-]+:\/\/$/.test(normScope);
    const cleanScope = isSchemeOnlyScope ? normScope : normScope.replace(/\/+$/, '');
    const rootUri = isSchemeOnlyScope ? normScope : `${cleanScope}/`;
    const root = { name: 'root', type: 'directory', children: {}, fullPath: rootUri, canonicalUri: rootUri, treePath: [] };

    (uris || []).forEach(rawItem => {
        if (!rawItem || typeof rawItem !== 'string') return;
        const rawUri = rawItem.includes('://') ? rawItem : `vfs://${rawItem.replace(/^\/+/, '')}`;
        let schemePrefix = '';
        let relSegmentsStr = '';

        if (!isSchemeOnlyScope && cleanScope && rawUri.startsWith(cleanScope + '/')) {
            schemePrefix = cleanScope + '/';
            relSegmentsStr = rawUri.slice(schemePrefix.length);
        } else if (!isSchemeOnlyScope && cleanScope && rawUri === cleanScope) {
            return;
        } else {
            const match = rawUri.match(/^([a-zA-Z0-9_-]+:\/\/)(.*)$/);
            if (!match) return;
            schemePrefix = match[1];
            relSegmentsStr = match[2];
        }

        const parts = relSegmentsStr.split('/').filter(Boolean);
        if (parts.length === 0) return;

        let cursor = root;
        const currentTreePath = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentTreePath.push(part);
            const isLast = (i === parts.length - 1);
            const nodeCanonicalUri = `${schemePrefix}${parts.slice(0, i + 1).join('/')}`;
            if (isLast) {
                const isSource = !rawUri.startsWith('ctx://contexts/') && !rawUri.startsWith('ctx://diffs/') && !rawUri.startsWith('ctx://workflows/');
                cursor.children[part] = {
                    name: part,
                    type: 'file',
                    isSource,
                    fullPath: rawUri,
                    canonicalUri: rawUri,
                    treePath: [...currentTreePath]
                };
            } else {
                if (!cursor.children[part] || cursor.children[part].type !== 'directory') {
                    cursor.children[part] = {
                        name: part,
                        type: 'directory',
                        children: {},
                        fullPath: nodeCanonicalUri,
                        canonicalUri: nodeCanonicalUri,
                        treePath: [...currentTreePath]
                    };
                }
                cursor = cursor.children[part];
            }
        }
    });

    return root;
}

export class InSetuFileTree extends InSetuElement {
    static properties = {
        files: { type: Array },
        currentPath: { type: Array },
        stripPrefix: { type: String },
        basePath: { type: String },
        hideFiles: { type: Boolean },
        hidePath: { type: Boolean },
        enableSearch: { type: Boolean },
        searchPlaceholder: { type: String },
        entityType: { type: String },
        _searchQuery: { type: String },
        _searchResults: { type: Array, state: true },
        _pendingMutations: { type: Object },
        _deletedMutations: { type: Object },
        _gitModifiedFiles: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; container-type: inline-size; }
        .toolbar-row {    
            display: flex; align-items: center; gap: 10px; padding: 5px 20px; height: 44px; box-sizing: border-box; 
        }
        @container (max-width: 50rem) {
            .toolbar-row { padding: 5px 10px; }
        }
        .file-list-container {
            flex: 1; display: flex; flex-direction: column; min-height: 0;
            --tree-item-px: 12px;
        }
        @container (max-width: 480px) {
            .file-list-container { --tree-item-px: 0px; }
        }
    `];
constructor() {
        super();
        this.files = [];
        this.stripPrefix = '';
        this.basePath = '';
        this.currentPath = [];
        this.hideFiles = false;
        this.hidePath = false;
        this.enableSearch = false;
        this.searchPlaceholder = 'Search...';
        this._searchQuery = '';
        this._searchResults = [];
        this._searchReqId = 0;
        this._cachedTree = null;
        this._pendingMutations = new Set();
        this._gitModifiedFiles = new Set();
}
    connectedCallback() {
        super.connectedCallback();
        const appStore = window.inSetu.stores.App;
        if (appStore) {
            const init = appStore.getState();
            this._pendingMutations = init.pendingMutations || new Set();
            this._deletedMutations = init.deletedMutations || new Set();
            this._gitModifiedFiles = init.derivedGitModifiedSet || new Set();

            this.subscribe(
                appStore,
                state => ({
                    pendingMutations: state.pendingMutations || new Set(),
                    deletedMutations: state.deletedMutations || new Set(),
                    gitModifiedFiles: state.derivedGitModifiedSet || new Set()
                }),
                ({ pendingMutations, deletedMutations, gitModifiedFiles }) => {
                    this._pendingMutations = pendingMutations;
                    this._deletedMutations = deletedMutations;
                    this._gitModifiedFiles = gitModifiedFiles;
                }
            );
        }
    }
    willUpdate(changedProperties) {
        const filesChanged = changedProperties.has('files') || changedProperties.has('stripPrefix') || changedProperties.has('_pendingMutations') || changedProperties.has('_deletedMutations');
        if (filesChanged) {
            this._cachedTree = null;
        }
        if (filesChanged || changedProperties.has('_searchQuery')) {
            if (this.enableSearch && this._searchQuery) {
                const { mergedFiles } = this._getMergedUris();
                if (mergedFiles.length < 500) {
                    this._searchResults = window.inSetu.utils.fuzzyFilterObjects(mergedFiles, this._searchQuery);
                } else {
                    const reqId = ++this._searchReqId;
                    SutramWorker.dispatch('FUZZY_SEARCH', { items: mergedFiles, query: this._searchQuery }).then(({ results }) => {
                        if (reqId === this._searchReqId) {
                            this._searchResults = results || [];
                        }
                    });
                }
            } else {
                this._searchResults = [];
            }
        }
    }
    _getMergedUris() {
        const rootScope = this.stripPrefix || this.basePath || 'vfs://';
        const baseFiles = (this.files || [])
            .filter(f => f && typeof f === 'string')
            .map(f => f.includes('://') ? f : `vfs://${f.replace(/^\/+/, '')}`);
        const pendingFiles = Array.from(this._pendingMutations || [])
            .filter(f => f && typeof f === 'string' && f.startsWith(rootScope));
        let mergedFiles = Array.from(new Set([...baseFiles, ...pendingFiles]));
        if (this._deletedMutations && this._deletedMutations.size > 0) {
            const deletedSet = this._deletedMutations;
            mergedFiles = mergedFiles.filter(f => {
                if (deletedSet.has(f)) return false;
                for (const d of deletedSet) {
                    if (f.startsWith(String(d).replace(/\/+$/, '') + '/')) return false;
                }
                return true;
            });
        }
        return { mergedFiles, rootScope };
    }

    _getTree() {
        if (!this._cachedTree) {
            const { mergedFiles, rootScope } = this._getMergedUris();
            this._cachedTree = buildUriFileTree(mergedFiles, rootScope);
        }
        return this._cachedTree;
    }
    
    _setPath(newPath) {
        this.currentPath = newPath;
        this.requestUpdate();
        this.dispatchEvent(new CustomEvent('path-changed', {
            detail: { path: newPath },
            bubbles: true,
            composed: true
        }));
    }
    render() {
        if (this.files.length === 0) {
            return html`<p style="padding: 20px; color: var(--text-muted); font-style: italic;">No files found.</p>`;
        }
        const isSearching = this.enableSearch && this._searchQuery;

        let directoryEntries = [];
        let flatResults = [];
        if (isSearching) {
            flatResults = this._searchResults || [];
        } else {
            const tree = this._getTree();
            const { validPath, entries } = resolveDirectoryState(tree, this.currentPath, {
                hideFiles: this.hideFiles,
                ignoreDotKeep: true
            });
            if (validPath.length !== (this.currentPath || []).length) {
                this.currentPath = validPath;
            }
            directoryEntries = entries;
        }

        const activePath = this.currentPath || [];

        return html`
            ${this.enableSearch ? html`
                <sutram-toolbar
                    searchPlaceholder=${this.searchPlaceholder}
                    .searchQuery=${this._searchQuery || ''}
                    @search-changed=${(e) => this._searchQuery = e.detail.value}
                    ?bottomBorder=${(!isSearching && activePath.length > 0 && !this.hidePath)}>
                    ${(!isSearching && activePath.length > 0 && !this.hidePath) ? html`
                        <div slot="bottom-row" class="toolbar-row" style="background: var(--input-bg); border-top: 1px solid var(--border); overflow: hidden;">
                            <sutram-btn intent="neutral" icon="corner-left-up" label="Up" @click=${() => this._setPath(activePath.slice(0, -1))} style="margin-right: 8px;"></sutram-btn>
                            <sutram-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem;">
                                /${activePath.join('/')}
                            </sutram-scrub-track>
                        </div>
                    ` : ''}
                </sutram-toolbar>
            ` : ((!isSearching && activePath.length > 0 && !this.hidePath) ? html`
                <div class="toolbar-row" style="background: var(--input-bg); border-bottom: 1px solid var(--border); overflow: hidden;">
                    <sutram-btn intent="neutral" icon="corner-left-up" label="Up" @click=${() => this._setPath(activePath.slice(0, -1))} style="margin-right: 8px;"></sutram-btn>
                    <sutram-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem;">
                        /${activePath.join('/')}
                    </sutram-scrub-track>
                </div>
            ` : '')}
            <div class="file-list-container">
                ${isSearching ? html`
                    <sutram-virtual-list
                        .items=${flatResults}
                        .renderItem=${fullFilepath => {
                            if (!fullFilepath || typeof fullFilepath !== 'string') return html``;
                            const parsed = new this.utils.InSetuURI(fullFilepath);
                            const isGitMod = this._gitModifiedFiles.has(fullFilepath);
                            const cardSuffix = parsed.isSharedMount ? `🌐 ${parsed.volume}` : (parsed.isUserTemplate ? 'User Template' : (parsed.isReadOnlyTemplate ? 'Template' : (isGitMod ? 'M' : '')));
                            return html`
                                <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                    <sutram-card
                                        style="margin-bottom: 0;"
                                        .filename=${fullFilepath}
                                        .detailText=${fullFilepath}
                                        .detailSuffix=${cardSuffix}
                                        .titleText=${parsed.filename}
                                        descriptionText=""
                                        intent=${(parsed.isSharedMount || parsed.isTemplate || isGitMod) ? 'highlight' : 'primary'}
                                        icon=${parsed.isSharedMount ? 'globe' : (parsed.isReadOnlyTemplate ? 'book-open' : (this._pendingMutations.has(fullFilepath) ? 'cloud-upload' : 'file-code-2'))}
                                        .entityType=${this.entityType || 'file'}
                                        .entityData=${{ filepath: fullFilepath, isSource: parsed.isSource, isFS: parsed.isEditable, isTemplate: parsed.isTemplate, git_modified: isGitMod }}
                                        @card-clicked=${(e) => {
                                            e.stopPropagation();
                                            this.dispatchEvent(new CustomEvent('card-clicked', {
                                                detail: { filename: fullFilepath, isSource: parsed.isSource, isFS: parsed.isEditable },
                                                bubbles: true,
                                                composed: true
                                            }));
                                        }}>
                                    </sutram-card>
                                </div>
                            `;
                        }}>
                    </sutram-virtual-list>
                ` : html`
                    <sutram-virtual-list
                        .items=${directoryEntries}
                        .renderItem=${node => {
                            if (!node || typeof node !== 'object') return html``;
                            const isDirNode = node.type === 'directory';
                            const fullTarget = node.canonicalUri || node.fullPath || '';
                            const parsed = new this.utils.InSetuURI(fullTarget);
                            const displayName = node.name || parsed.basename || fullTarget;
                            const isUserTemplateRoot = fullTarget.endsWith('/.templates/user');
                            const isReadOnlyTemplateNode = !parsed.isUserTemplate && !isUserTemplateRoot && fullTarget.includes('/.templates');

                            const nextPath = isDirNode
                                ? (Array.isArray(node.treePath) ? node.treePath : node.fullPath.split('/').filter(Boolean))
                                : null;
                            const isSharedDirRoot = isDirNode && parsed.isSharedMount && nextPath.length === 1;
                            const cleanDirUri = isDirNode ? String(fullTarget).replace(/\/+$/, '') : '';
                            const cardFilename = isDirNode ? `${cleanDirUri}/` : fullTarget;

                            const isGitMod = !isDirNode && this._gitModifiedFiles.has(fullTarget);
                            const isPending = !isDirNode && this._pendingMutations.has(fullTarget);
                            const cardDetailText = isDirNode ? '' : fullTarget;
                            const cardSuffix = isDirNode
                                ? ''
                                : (parsed.isSharedMount ? `🌐 ${parsed.volume}` : (parsed.isUserTemplate ? 'User Template' : (isReadOnlyTemplateNode ? 'Template' : (isGitMod ? 'M' : ''))));
                            const cardIcon = isDirNode
                                ? (isUserTemplateRoot ? 'user' : (isReadOnlyTemplateNode ? 'library' : (isSharedDirRoot ? 'globe' : 'folder')))
                                : (parsed.isSharedMount ? 'globe' : (isReadOnlyTemplateNode ? 'book-open' : (isPending ? 'cloud-upload' : 'file-code-2')));
                            const cardIntent = isDirNode
                                ? ((isReadOnlyTemplateNode || isUserTemplateRoot || isSharedDirRoot) ? 'highlight' : 'warning')
                                : ((parsed.isSharedMount || isReadOnlyTemplateNode || parsed.isUserTemplate || isGitMod) ? 'highlight' : 'primary');
                            const cardEntityType = isDirNode ? 'folder' : (this.entityType || 'file');
                            const cardEntityData = isDirNode
                                ? { id: cardFilename, filepath: cardFilename, folderpath: cleanDirUri, titleText: displayName, isDir: !isReadOnlyTemplateNode, isSkeleton: isReadOnlyTemplateNode, isTemplate: isReadOnlyTemplateNode || parsed.isUserTemplate }
                                : { filepath: fullTarget, titleText: displayName, isSource: parsed.isSource, isFS: parsed.isEditable, isTemplate: isReadOnlyTemplateNode || parsed.isUserTemplate, git_modified: isGitMod, is_dirty: isPending };

                            return html`
                                <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                    <sutram-card
                                        style="margin-bottom: 0;"
                                        .filename=${cardFilename}
                                        .titleText=${displayName}
                                        .detailText=${cardDetailText}
                                        .detailSuffix=${cardSuffix}
                                        .descriptionText=${''}
                                        .icon=${cardIcon}
                                        .intent=${cardIntent}
                                        .entityType=${cardEntityType}
                                        .entityData=${cardEntityData}
                                        @card-clicked=${(e) => {
                                            e.stopPropagation();
                                            if (isDirNode) {
                                                this._setPath(nextPath);
                                            } else {
                                                this.dispatchEvent(new CustomEvent('card-clicked', {
                                                    detail: { filename: fullTarget, isSource: parsed.isSource, isFS: parsed.isEditable },
                                                    bubbles: true,
                                                    composed: true
                                                }));
                                            }
                                        }}>
                                    </sutram-card>
                                </div>
                            `;
                        }}>
                    </sutram-virtual-list>
                `}
            </div>
        `;
    }
}
window.inSetu = window.inSetu || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.vfs.buildUriFileTree = buildUriFileTree;

if (!customElements.get('insetu-file-tree')) {
    customElements.define('insetu-file-tree', InSetuFileTree);
}