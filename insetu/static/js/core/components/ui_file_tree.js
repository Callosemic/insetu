import { LitElement, html, css } from 'lit';
import { buildFileTree } from '../../../vendor/sutram/js/utils.js';
import { sharedStyles } from '../../../vendor/sutram/js/shared_styles.js';
import { SutramCard } from '../../../vendor/sutram/js/primitives.js';

export class InSetuCard extends SutramCard {}
export class InSetuFileTree extends LitElement {
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
        _searchQuery: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; container-type: inline-size; }
        .tree-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
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
}
    _buildTree() {
        const filteredFiles = (this.enableSearch && this._searchQuery)
            ? window.inSetu.utils.fuzzyFilterObjects(this.files, this._searchQuery)
            : this.files;
        const mappedFiles = filteredFiles.map(f => this.stripPrefix ? f.replace(new RegExp('^' + this.stripPrefix), '') : f);
        return buildFileTree(mappedFiles);
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
            const filteredFiles = window.inSetu.utils.fuzzyFilterObjects(this.files, this._searchQuery);
            flatResults = filteredFiles.map(f => this.stripPrefix ? f.replace(new RegExp('^' + this.stripPrefix), '') : f);
        } else {
            const tree = this._buildTree();
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
                <yenvui-toolbar
                    searchPlaceholder=${this.searchPlaceholder}
                    .searchQuery=${this._searchQuery || ''}
                    @search-changed=${(e) => this._searchQuery = e.detail.value}
                    ?bottomBorder=${(!isSearching && this.currentPath.length > 0 && !this.hidePath)}>
                    ${(!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                        <div slot="bottom-row" class="toolbar-row" style="background: var(--input-bg); border-top: 1px solid var(--border);">
                            <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                            <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentPath.join('/')}</span>
                        </div>
                    ` : ''}
                </yenvui-toolbar>
            ` : ((!isSearching && this.currentPath.length > 0 && !this.hidePath) ? html`
                <div class="toolbar-row" style="background: var(--input-bg); border-bottom: 1px solid var(--border);">
                    <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                    <span style="font-family: monospace; color: var(--text); opacity: 0.7; font-size: 0.85rem; word-break: break-all;">/${this.currentPath.join('/')}</span>
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
                            icon="📄"
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
                                icon="📁"
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
                            icon="📄"
                            .entityType=${this.entityType || 'file'}
                            .entityData=${{ filepath, isFS: true }}>
                        </insetu-card>
                    `;
                })}
                </sutram-card-group>
            </div>
        `;
    }
}
customElements.define('insetu-file-tree', InSetuFileTree);