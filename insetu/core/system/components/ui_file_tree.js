import { html, css } from 'lit';
import { buildFileTree } from '../../../vendor/sutram/js/utils.js';
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
        _deletedMutations: { type: Object }
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
}
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(window.inSetu.stores.App, state => {
            this._pendingMutations = state.pendingMutations || new Set();
            this._deletedMutations = state.deletedMutations || new Set();
        });
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
                mergedFiles = mergedFiles.filter(f => !deletedSet.has(f));
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

        let current = null;
        let keys = [];
        let flatResults = [];
        // Short-circuit the hierarchical tree generation if we are actively searching
        if (isSearching) {
            const normalizeToNaked = (p) => p.replace(/^vfs:\/\//, '');
            const pendingFiles = Array.from(this._pendingMutations || []).filter(f => f && typeof f === 'string').map(normalizeToNaked);
            let mergedFiles = Array.from(new Set([...this.files, ...pendingFiles]));

            if (this._deletedMutations && this._deletedMutations.size > 0) {
                const deletedSet = new Set(Array.from(this._deletedMutations).map(normalizeToNaked));
                mergedFiles = mergedFiles.filter(f => !deletedSet.has(f));
            }

            const filteredFiles = window.inSetu.utils.fuzzyFilterObjects(mergedFiles, this._searchQuery);
            const prefix = this.stripPrefix;
            flatResults = prefix 
                ? filteredFiles.map(f => f.startsWith(prefix) ? f.slice(prefix.length) : f)
                : filteredFiles;
        } else {
            const tree = this._getTree();
            current = tree;
            const validPath = [];
            for (const p of (this.currentPath || [])) {
                if (current[p] && !current[p]._isFile) {
                    current = current[p];
                    validPath.push(p);
                } else {
                    break;
                }
            }
            if (validPath.length !== (this.currentPath || []).length) {
                this.currentPath = validPath;
            }
            keys = Object.keys(current).filter(k => k !== '_isFile').sort((a, b) => {
                const aIsDir = !current[a]._isFile;
                const bIsDir = !current[b]._isFile;
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.localeCompare(b);
            });
        }
        return html`
            ${this.enableSearch ? html`
                <sutram-toolbar
                    searchPlaceholder=${this.searchPlaceholder}
                    .searchQuery=${this._searchQuery || ''}
                    @search-changed=${(e) => this._searchQuery = e.detail.value}
                    ?bottomBorder=${(!isSearching && this.currentPath.length > 0 && !this.hidePath)}>
                    ${(!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                        <div slot="bottom-row" class="toolbar-row" style="background: var(--input-bg); border-top: 1px solid var(--border); overflow: hidden;">
                            <sutram-btn intent="neutral" icon="corner-left-up" label="Up" @click=${() => this._setPath(this.currentPath.slice(0, -1))} style="margin-right: 8px;"></sutram-btn>
                            <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem;">
                                /${this.currentPath.join('/')}
                            </yenvui-scrub-track>
                        </div>
                    ` : ''}
                </sutram-toolbar>
            ` : ((!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                <div class="toolbar-row" style="background: var(--input-bg); border-bottom: 1px solid var(--border); overflow: hidden;">
                    <sutram-btn intent="neutral" icon="corner-left-up" label="Up" @click=${() => this._setPath(this.currentPath.slice(0, -1))} style="margin-right: 8px;"></sutram-btn>
                    <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem;">
                        /${this.currentPath.join('/')}
                    </yenvui-scrub-track>
                </div>
            ` : '')}
            <div class="file-list-container">
                ${isSearching ? html`
                    <sutram-virtual-list
                        .items=${flatResults}
                        .renderItem=${filepath => {
                            const key = filepath.split('/').pop();
                            const fullFilepath = `${this.basePath}${filepath}`;
                            return html`
                                <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                    <sutram-card
                                        style="margin-bottom: 0;"
                                        .filename=${fullFilepath}
                                        .detailText=${fullFilepath}
                                        .titleText=${key}
                                        descriptionText=""
                                        intent="primary"
                                        icon=${(this._pendingMutations.has(fullFilepath) || this._pendingMutations.has(`vfs://${fullFilepath}`)) ? 'cloud-upload' : 'file-code-2'}
                                        .entityType=${this.entityType || 'file'}
                                        .entityData=${{ filepath: fullFilepath, isFS: true }}>
                                    </sutram-card>
                                </div>
                            `;
                        }}>
                    </sutram-virtual-list>
                ` : html`
                    <sutram-virtual-list
                        .items=${keys}
                        .renderItem=${key => {
                            const item = current[key];
                            const isDir = !item._isFile;
                            if (!isDir && (key === '.gitkeep' || key === '.keep')) return '';
                            if (isDir) {
                                const pathPrefix = this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';
                                const folderPath = `${this.basePath}${pathPrefix}${key}`;
                                return html`
                                    <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                        <sutram-card
                                            style="margin-bottom: 0;"
                                            .titleText=${key}
                                            icon="folder"
                                            intent="warning"
                                            .entityType=${'folder'}
                                            .entityData=${{ id: folderPath, folderpath: folderPath, isDir: true }}
                                            @card-clicked=${(e) => { e.stopPropagation(); this._setPath([...this.currentPath, key]); }}>
                                        </sutram-card>
                                    </div>
                                `;
                            }
                            const pathPrefix = this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';
                            const filepath = `${this.basePath}${pathPrefix}${key}`;
                            if (this.hideFiles) return '';
                            return html`
                                <div style="width: 100%; box-sizing: border-box; padding: 0 var(--tree-item-px) 8px var(--tree-item-px);">
                                    <sutram-card
                                        style="margin-bottom: 0;"
                                        .filename=${filepath}
                                        .detailText=${filepath}
                                        .titleText=${key}
                                        descriptionText=""
                                        intent="primary"
                                        icon=${(this._pendingMutations.has(filepath) || this._pendingMutations.has(`vfs://${filepath}`)) ? 'cloud-upload' : 'file-code-2'}
                                        .entityType=${this.entityType || 'file'}
                                        .entityData=${{ filepath, isFS: true, is_dirty: this._pendingMutations.has(filepath) || this._pendingMutations.has(`vfs://${filepath}`) }}>
                                    </sutram-card>
                                </div>
                            `;
                        }}>
                `}
            </div>
        `;
    }
}
customElements.define('insetu-file-tree', InSetuFileTree);