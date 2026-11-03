import { html } from 'lit';
import { InSetuElement, sharedStyles, resolveDirectoryState, SutramWorker, SutramCard } from '/static/extensions/system/insetu_sdk.js';
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

        let repoPromptsPrefix = null;
        if (cleanScope === 'ctx://prompts') {
            const repoPromptMatch = rawUri.match(/^vfs:\/\/([^/]+)\/\.insetu-data\/prompts\/(.+)$/);
            if (repoPromptMatch) {
                const [, repoName, repoRel] = repoPromptMatch;
                repoPromptsPrefix = `vfs://${repoName}/.insetu-data/prompts`;
                relSegmentsStr = `${repoName}/${repoRel}`;
            }
        }
        if (repoPromptsPrefix === null) {
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
        }

        const parts = relSegmentsStr.split('/').filter(Boolean);
        if (parts.length === 0) return;

        let cursor = root;
        const currentTreePath = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentTreePath.push(part);
            const isLast = (i === parts.length - 1);
            const nodeCanonicalUri = repoPromptsPrefix
                ? (i === 0 ? repoPromptsPrefix : `${repoPromptsPrefix}/${parts.slice(1, i + 1).join('/')}`)
                : `${schemePrefix}${parts.slice(0, i + 1).join('/')}`;
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
                } else if (repoPromptsPrefix && cursor.children[part].canonicalUri?.startsWith('ctx://prompts/')) {
                    cursor.children[part].fullPath = nodeCanonicalUri;
                    cursor.children[part].canonicalUri = nodeCanonicalUri;
                }
                cursor = cursor.children[part];
            }
        }
    });

    return root;
}

export class InSetuFileTree extends InSetuElement {
    static get extensionName() { return 'fs'; }
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
    static styles = [sharedStyles];
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
        const isPromptsRoot = rootScope.replace(/\/+$/, '') === 'ctx://prompts';
        const pendingFiles = Array.from(this._pendingMutations || [])
            .filter(f => f && typeof f === 'string' && (
                f.startsWith(rootScope) ||
                (isPromptsRoot && /^vfs:\/\/[^/]+\/\.insetu-data\/prompts\//.test(f))
            ));
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
            return html`<sutram-empty-state text="No files found."></sutram-empty-state>`;
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
            <sutram-view ?flush=${true} ?noScroll=${true}>
                ${this.enableSearch ? html`
                    <sutram-toolbar
                        slot="toolbar"
                        searchPlaceholder=${this.searchPlaceholder}
                        .searchQuery=${this._searchQuery || ''}
                        @search-changed=${(e) => this._searchQuery = e.detail.value}
                        ?flush=${(!isSearching && activePath.length > 0 && !this.hidePath)}>
                        ${(!isSearching && activePath.length > 0 && !this.hidePath) ? html`
                            <sutram-surface slot="bottom-row" variant="panel" border="top" padding="xs">
                                <sutram-stack direction="row" align="center" gap="sm">
                                    <sutram-btn intent="neutral" ?compact=${true} icon="corner-left-up" label="Up" @click=${() => this._setPath(activePath.slice(0, -1))}></sutram-btn>
                                    <sutram-scrub-track ?grow=${true} ?monospace=${true}>
                                        /${activePath.join('/')}
                                    </sutram-scrub-track>
                                </sutram-stack>
                            </sutram-surface>
                        ` : ''}
                    </sutram-toolbar>
                ` : ((!isSearching && activePath.length > 0 && !this.hidePath) ? html`
                    <sutram-surface slot="toolbar" variant="panel" border="bottom" padding="xs">
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-btn intent="neutral" ?compact=${true} icon="corner-left-up" label="Up" @click=${() => this._setPath(activePath.slice(0, -1))}></sutram-btn>
                            <sutram-scrub-track ?grow=${true} ?monospace=${true}>
                                /${activePath.join('/')}
                            </sutram-scrub-track>
                        </sutram-stack>
                    </sutram-surface>
                ` : '')}
                ${isSearching ? html`
                    <sutram-virtual-list
                        .items=${flatResults}
                        .renderItem=${fullFilepath => {
                            if (!fullFilepath || typeof fullFilepath !== 'string') return html``;
                            const parsed = new this.utils.InSetuURI(fullFilepath);
                            const isRepoPromptFile = /^vfs:\/\/[^/]+\/\.insetu-data\/prompts\//.test(fullFilepath);
                            const isGitMod = this._gitModifiedFiles.has(fullFilepath);
                            const cardSuffix = parsed.isSharedMount
                                ? `🌐 ${parsed.volume}`
                                : (parsed.isUserTemplate
                                    ? 'User Template'
                                    : (parsed.isReadOnlyTemplate
                                        ? 'Template'
                                        : (isRepoPromptFile ? `📦 ${parsed.repo}` : (isGitMod ? 'M' : ''))));
                            return html`
                                <sutram-card
                                    .filename=${fullFilepath}
                                    .detailText=${fullFilepath}
                                    .detailSuffix=${cardSuffix}
                                    .titleText=${parsed.filename}
                                    descriptionText=""
                                    intent=${isRepoPromptFile ? 'success' : ((parsed.isSharedMount || parsed.isTemplate || isGitMod) ? 'highlight' : 'primary')}
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
                            const isRepoPromptRoot = isDirNode && /^vfs:\/\/[^/]+\/\.insetu-data\/prompts\/?$/.test(fullTarget);
                            const isRepoPromptNode = /^vfs:\/\/[^/]+\/\.insetu-data\/prompts(?:\/|$)/.test(fullTarget);

                            const nextPath = isDirNode
                                ? (Array.isArray(node.treePath) ? node.treePath : node.fullPath.split('/').filter(Boolean))
                                : null;
                            const isSharedDirRoot = isDirNode && parsed.isSharedMount && nextPath.length === 1;
                            const cleanDirUri = isDirNode ? String(fullTarget).replace(/\/+$/, '') : '';
                            const cardFilename = isDirNode ? `${cleanDirUri}/` : fullTarget;

                            const isGitMod = !isDirNode && this._gitModifiedFiles.has(fullTarget);
                            const isPending = !isDirNode && this._pendingMutations.has(fullTarget);
                            const repoMountUri = isRepoPromptRoot ? `vfs://${parsed.repo}/.insetu-data/prompts` : '';
                            const cardDetailText = isDirNode ? '' : fullTarget;
                            const cardSuffix = isDirNode
                                ? ''
                                : (parsed.isSharedMount
                                    ? `🌐 ${parsed.volume}`
                                    : (parsed.isUserTemplate
                                        ? 'User Template'
                                        : (isReadOnlyTemplateNode
                                            ? 'Template'
                                            : (isGitMod ? 'M' : ''))));
                            const cardIcon = isDirNode
                                ? (isRepoPromptRoot ? 'folder-symlink' : (isUserTemplateRoot ? 'user' : (isReadOnlyTemplateNode ? 'library' : (isSharedDirRoot ? 'globe' : 'folder'))))
                                : (parsed.isSharedMount ? 'globe' : (isReadOnlyTemplateNode ? 'book-open' : (isPending ? 'cloud-upload' : 'file-code-2')));
                            const cardIntent = isDirNode
                                ? (isRepoPromptNode ? 'success' : ((isReadOnlyTemplateNode || isUserTemplateRoot || isSharedDirRoot) ? 'highlight' : 'warning'))
                                : (isRepoPromptNode ? 'success' : ((parsed.isSharedMount || isReadOnlyTemplateNode || parsed.isUserTemplate || isGitMod) ? 'highlight' : 'primary'));
                            const isProtectedVirtualMount = isReadOnlyTemplateNode || isRepoPromptRoot;
                            const cardEntityType = isDirNode ? 'folder' : (this.entityType || 'file');
                            const cardEntityData = isDirNode
                                ? { id: cardFilename, filepath: cardFilename, folderpath: cleanDirUri, titleText: displayName, isDir: !isProtectedVirtualMount, isSkeleton: isProtectedVirtualMount, isTemplate: isReadOnlyTemplateNode || parsed.isUserTemplate }
                                : { filepath: fullTarget, titleText: displayName, isSource: parsed.isSource, isFS: parsed.isEditable, isTemplate: isReadOnlyTemplateNode || parsed.isUserTemplate, git_modified: isGitMod, is_dirty: isPending };

                            return html`
                                <sutram-card
                                    .filename=${cardFilename}
                                    .titleText=${displayName}
                                    .detailText=${cardDetailText}
                                    .detailSuffix=${cardSuffix}
                                    .descriptionText=${''}
                                    .icon=${cardIcon}
                                    .intent=${cardIntent}
                                    .entityType=${cardEntityType}
                                    .entityData=${cardEntityData}
                                    title=${repoMountUri ? `Linked Repository Prompts (${repoMountUri})` : ''}
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
                            `;
                        }}>
                    </sutram-virtual-list>
                `}
            </sutram-view>
        `;
    }
}
window.inSetu = window.inSetu || {};
window.inSetu.vfs = window.inSetu.vfs || {};
window.inSetu.vfs.buildUriFileTree = buildUriFileTree;

if (!customElements.get('insetu-file-tree')) {
    customElements.define('insetu-file-tree', InSetuFileTree);
}