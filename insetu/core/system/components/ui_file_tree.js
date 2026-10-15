import { html, css } from 'lit';
import { buildFileTree, resolveDirectoryState } from '../../../vendor/sutram/js/utils.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { SutramCard } from '../../../vendor/sutram/js/primitives.js';
import { InSetuElement } from '/static/extensions/system/insetu_sdk.js';
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
        if (changedProperties.has('files') || changedProperties.has('stripPrefix') || changedProperties.has('_pendingMutations') || changedProperties.has('_deletedMutations')) {
            this._cachedTree = null;
        }
    }
    _getTree() {
        if (!this._cachedTree) {
            const prefix = this.stripPrefix;
            // CQRS Read-Path: Overlay pending offline mutations at render time
            const normalizeToNaked = (p) => p.replace(/^vfs:\/\//, '');
            const pendingFiles = Array.from(this._pendingMutations || []).filter(f => f && typeof f === 'string').map(normalizeToNaked);
            let mergedFiles = Array.from(new Set([...this.files, ...pendingFiles]));
            if (this._deletedMutations && this._deletedMutations.size > 0) {
                const deletedSet = new Set(Array.from(this._deletedMutations).map(normalizeToNaked));
                mergedFiles = mergedFiles.filter(f => {
                    if (deletedSet.has(f)) return false;
                    for (const d of deletedSet) {
                        if (f.startsWith(d + '/')) return false;
                    }
                    return true;
                });
            }

            const mappedFiles = prefix 
                ? mergedFiles.map(f => f.startsWith(prefix) ? f.slice(prefix.length) : f)
                : mergedFiles;
            this._cachedTree = buildFileTree(mappedFiles);
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
            const normalizeToNaked = (p) => p.replace(/^vfs:\/\//, '');
            const pendingFiles = Array.from(this._pendingMutations || []).filter(f => f && typeof f === 'string').map(normalizeToNaked);
            let mergedFiles = Array.from(new Set([...this.files, ...pendingFiles]));
            if (this._deletedMutations && this._deletedMutations.size > 0) {
                const deletedSet = new Set(Array.from(this._deletedMutations).map(normalizeToNaked));
                mergedFiles = mergedFiles.filter(f => {
                    if (deletedSet.has(f)) return false;
                    for (const d of deletedSet) {
                        if (f.startsWith(d + '/')) return false;
                    }
                    return true;
                });
            }

            const filteredFiles = window.inSetu.utils.fuzzyFilterObjects(mergedFiles, this._searchQuery);
            const prefix = this.stripPrefix;
            flatResults = prefix 
                ? filteredFiles.map(f => f.startsWith(prefix) ? f.slice(prefix.length) : f)
                : filteredFiles;
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
                        .renderItem=${filepath => {
                            if (!filepath || typeof filepath !== 'string') return html``;
                            const key = filepath.split('/').pop();
                            const fullFilepath = `${this.basePath}${filepath}`;
                            const isGitMod = this._gitModifiedFiles.has(fullFilepath) || this._gitModifiedFiles.has(fullFilepath.replace(/^vfs:\/\//, ''));
                            return html`
                                <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                    <sutram-card
                                        style="margin-bottom: 0;"
                                        .filename=${fullFilepath}
                                        .detailText=${fullFilepath}
                                        .detailSuffix=${isGitMod ? 'M' : ''}
                                        .titleText=${key}
                                        descriptionText=""
                                        intent=${isGitMod ? 'highlight' : 'primary'}
                                        icon=${(this._pendingMutations.has(fullFilepath) || this._pendingMutations.has(`vfs://${fullFilepath}`)) ? 'cloud-upload' : 'file-code-2'}
                                        .entityType=${this.entityType || 'file'}
                                        .entityData=${{ filepath: fullFilepath, isFS: true, git_modified: isGitMod }}>
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
                            const fullTarget = `${this.basePath}${node.fullPath}`;
                            if (node.type === 'directory') {
                                const nextPath = node.fullPath.split('/').filter(Boolean);
                                return html`
                                    <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                        <sutram-card
                                            style="margin-bottom: 0;"
                                            .titleText=${node.name}
                                            icon="folder"
                                            intent="warning"
                                            .entityType=${'folder'}
                                            .entityData=${{ id: fullTarget, folderpath: fullTarget, isDir: true }}
                                            @card-clicked=${(e) => { e.stopPropagation(); this._setPath(nextPath); }}>
                                        </sutram-card>
                                    </div>
                                `;
                            }
                            const isGitMod = this._gitModifiedFiles.has(fullTarget) || this._gitModifiedFiles.has(fullTarget.replace(/^vfs:\/\//, ''));
                            const isPending = this._pendingMutations.has(fullTarget) || this._pendingMutations.has(`vfs://${fullTarget}`);
                            return html`
                                <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                    <sutram-card
                                        style="margin-bottom: 0;"
                                        .filename=${fullTarget}
                                        .detailText=${fullTarget}
                                        .detailSuffix=${isGitMod ? 'M' : ''}
                                        .titleText=${node.name}
                                        descriptionText=""
                                        intent=${isGitMod ? 'highlight' : 'primary'}
                                        icon=${isPending ? 'cloud-upload' : 'file-code-2'}
                                        .entityType=${this.entityType || 'file'}
                                        .entityData=${{ filepath: fullTarget, isFS: true, git_modified: isGitMod, is_dirty: isPending }}>
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
customElements.define('insetu-file-tree', InSetuFileTree);