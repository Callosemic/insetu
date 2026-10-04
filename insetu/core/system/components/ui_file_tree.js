import { html, css } from 'lit';
import { buildFileTree } from '../../../vendor/sutram/js/utils.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { SutramCard } from '../../../vendor/sutram/js/primitives.js';
import { InSetuElement } from '/static/extensions/system/sdk.js';

export class InSetuCard extends SutramCard {}
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
        .tree-container { flex: 1; overflow-y: auto; padding: 10px 12px 20px 12px; display: flex; flex-direction: column; gap: 8px; }
        @container (max-width: 480px) {
            .tree-container { padding: 0; gap: 0; }
        }
        .toolbar-row { 
            display: flex; align-items: center; gap: 10px; padding: 5px 20px; height: 44px; box-sizing: border-box; 
        }
        @container (max-width: 50rem) {
            .toolbar-row { padding: 5px 10px; }
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
            const pendingFiles = Array.from(this._pendingMutations || []).filter(f => f && typeof f === 'string');
            let mergedFiles = Array.from(new Set([...this.files, ...pendingFiles]));

            if (this._deletedMutations && this._deletedMutations.size > 0) {
                mergedFiles = mergedFiles.filter(f => !this._deletedMutations.has(f));
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
            const pendingFiles = Array.from(this._pendingMutations || []).filter(f => f && typeof f === 'string');
            let mergedFiles = Array.from(new Set([...this.files, ...pendingFiles]));

            if (this._deletedMutations && this._deletedMutations.size > 0) {
                mergedFiles = mergedFiles.filter(f => !this._deletedMutations.has(f));
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
                            <sutram-btn intent="neutral" @click=${() => this._setPath(this.currentPath.slice(0, -1))} style="margin-right: 8px;">⬆️ Up</sutram-btn>
                            <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem;">
                                /${this.currentPath.join('/')}
                            </yenvui-scrub-track>
                        </div>
                    ` : ''}
                </sutram-toolbar>
            ` : ((!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                <div class="toolbar-row" style="background: var(--input-bg); border-bottom: 1px solid var(--border); overflow: hidden;">
                    <sutram-btn intent="neutral" @click=${() => this._setPath(this.currentPath.slice(0, -1))} style="margin-right: 8px;">⬆️ Up</sutram-btn>
                    <yenvui-scrub-track style="flex: 1; min-width: 0; font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem;">
                        /${this.currentPath.join('/')}
                    </yenvui-scrub-track>
                </div>
            ` : '')}
            <div class="tree-container">
                <sutram-card-group>
                ${isSearching ? flatResults.map(filepath => {
                    const key = filepath.split('/').pop();
                    const fullFilepath = `${this.basePath}${filepath}`;
                    if (this.hideFiles) return '';
                    return html`
                        <insetu-card
                            .filename=${fullFilepath}
                            .detailText=${fullFilepath}
                            .titleText=${key}
                            descriptionText=""
                            intentColor="var(--intent-primary)"
                            icon=${this._pendingMutations.has(fullFilepath) ? '<i data-lucide="cloud-upload" style="width: 14px; height: 14px;"></i>' : '<i data-lucide="file-code-2" style="width: 14px; height: 14px;"></i>'}
                            .entityType=${this.entityType || 'file'}
                            .entityData=${{ filepath: fullFilepath, isFS: true }}>
                        </insetu-card>
                    `;
                }) : keys.map(key => {
                    const item = current[key];
                    const isDir = !item._isFile;
                    if (!isDir && (key === '.gitkeep' || key === '.keep')) return '';
                    if (isDir) {
                        const pathPrefix = this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';
                        const folderPath = `${this.basePath}${pathPrefix}${key}`;
                        return html`
                            <insetu-card
                                .titleText=${key}
                                icon='<i data-lucide="folder" style="width: 14px; height: 14px;"></i>'
                                intentColor="var(--intent-warning)"
                                .entityType=${'folder'}
                                .entityData=${{ id: folderPath, folderpath: folderPath, isDir: true }}
                                @card-clicked=${(e) => { e.stopPropagation(); this._setPath([...this.currentPath, key]); }}>
                            </insetu-card>
                        `;
                    }
                    const pathPrefix = this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';
                    const filepath = `${this.basePath}${pathPrefix}${key}`;
                    if (this.hideFiles) return '';
                    return html`
                        <insetu-card
                            .filename=${filepath}
                            .detailText=${filepath}
                            .titleText=${key}
                            descriptionText=""
                            intentColor="var(--intent-primary)"
                            icon=${this._pendingMutations.has(filepath) ? '<i data-lucide="cloud-upload" style="width: 14px; height: 14px;"></i>' : '<i data-lucide="file-code-2" style="width: 14px; height: 14px;"></i>'}
                            .entityType=${this.entityType || 'file'}
                            .entityData=${{ filepath, isFS: true, is_dirty: this._pendingMutations.has(filepath) }}>
                        </insetu-card>
                    `;
                })}
                </sutram-card-group>
            </div>
        `;
    }
}
customElements.define('insetu-file-tree', InSetuFileTree);