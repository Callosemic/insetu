/**
 * Yomama Sync Bridge ledger receipt history projection (InSetuExtBridgeHistory).
 */
import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { BridgeStore } from '/static/extensions/bridge/bridge_store.js';

export class InSetuExtBridgeHistory extends InSetuElement {
    static get extensionName() { return 'bridge'; }
    static properties = {
        historyRecords: { type: Array },
        searchQuery: { type: String },
        _viewMode: { type: String },
        _renderLimit: { type: Number }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.historyRecords = [];
        this.searchQuery = '';
        this._viewMode = 'transaction';
        this._renderLimit = 15;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('searchQuery') || changedProperties.has('_viewMode')) {
            this._renderLimit = 15;
        }
    }

    firstUpdated() {
        super.firstUpdated();
        this._observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this._renderLimit += 15;
            }
        }, { rootMargin: '200px' });

        const sentinel = this.shadowRoot.querySelector('#history-sentinel');
        if (sentinel) this._observer.observe(sentinel);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._observer) this._observer.disconnect();
    }
    connectedCallback() {
        super.connectedCallback();
        const init = BridgeStore.getState();
        this.historyRecords = init.historyRecords || [];
        this._viewMode = init.historyViewMode || 'transaction';
        this.subscribe(
            BridgeStore,
            state => ({
                historyRecords: state.historyRecords || [],
                historyViewMode: state.historyViewMode || 'transaction'
            }),
            ({ historyRecords, historyViewMode }) => {
                this.historyRecords = historyRecords;
                this._viewMode = historyViewMode;
            }
        );
        BridgeStore.getState().fetchHistory();
    }
    render() {
        const isTx = this._viewMode === 'transaction';
        const filteredRecords = this.searchQuery
            ? this.utils.fuzzyFilterObjects(this.historyRecords, this.searchQuery, r => `${r.filepath} ${r.transaction_id} ${r.post_patch_hash}`)
            : this.historyRecords;
        const activeRepos = this.ecosystem.pinnedRepos;
        const repoFilteredRecords = filteredRecords.filter(r => {
            if (activeRepos.has('ALL')) return true;
            const parsedRepo = new this.utils.InSetuURI(r.filepath || '').repo;
            return activeRepos.has(r.repo) || activeRepos.has(parsedRepo);
        });

        // 1. Transaction-Centric Grouping
        const groupedTxs = repoFilteredRecords.reduce((acc, r) => {
            const txKey = r.transaction_id || "legacy_" + r.patch_id;
            if (!acc[txKey]) acc[txKey] = { timestamp: r.timestamp, records: [] };
            acc[txKey].records.push(r);
            return acc;
        }, {});
        const sortedTxs = Object.entries(groupedTxs).sort((a, b) => b[1].timestamp - a[1].timestamp);

        // 2. File-Centric Grouping
        const groupedFiles = repoFilteredRecords.reduce((acc, r) => {
            if (!acc[r.filepath]) acc[r.filepath] = { latest_ts: 0, records: [] };
            acc[r.filepath].records.push(r);
            if (r.timestamp > acc[r.filepath].latest_ts) acc[r.filepath].latest_ts = r.timestamp;
            return acc;
        }, {});
        const sortedFiles = Object.entries(groupedFiles).sort((a, b) => b[1].latest_ts - a[1].latest_ts);

        return html`
            <sutram-view>
                <sutram-toolbar
                    slot="toolbar"
                    searchPlaceholder="Fuzzy search receipts..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => this.searchQuery = e.detail.value}
                    .enableFilterDropdown=${true}
                    .activeFilters=${Array.from(this.ecosystem.pinnedRepos)}>
                    <insetu-repo-filter
                        slot="filters"
                        .repos=${this.ecosystem.allRepos}
                        .activeRepos=${Array.from(this.ecosystem.pinnedRepos)}
                        @repo-filter-changed=${(e) => window.inSetu.stores.App.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                    </insetu-repo-filter>
                </sutram-toolbar>
                <sutram-stack direction="col" gap="md">
                    ${this.historyRecords.length === 0 ? html`<sutram-empty-state text="No ledger receipts available."></sutram-empty-state>` : ''}
                    ${repoFilteredRecords.length === 0 && this.historyRecords.length > 0 ? html`<sutram-empty-state text="No ledger receipts match criteria."></sutram-empty-state>` : ''}

                ${this._viewMode === 'transaction' ? sortedTxs.slice(0, this._renderLimit).map(([txId, txData]) => {
                    const repos = Array.from(new Set(txData.records.map(r => r.repo || r.filepath?.split('/')[0]).filter(Boolean)));
                    const repoStr = repos.length > 0 ? ' in ' + repos.join(', ') : '';
                    const countStr = txData.records.length + (txData.records.length !== 1 ? ' files' : ' file') + ' modified' + repoStr;
                    return html`
                        <sutram-card-group ?stacked=${true} ?accordion=${true}>
                            <sutram-card
                                .titleText=${"Tx: " + (txId || 'Unknown')}
                                .descriptionText=${countStr}
                                .detailText=${this.utils.timeAgo(txData.timestamp * 1000)}
                                icon="git-merge"
                                intent="highlight"
                                entityType="yomama-turn"
                                .entityData=${{ transaction_id: txId, records: txData.records }}>
                            </sutram-card>
                            ${txData.records.map((record) => {
                                let chunks = record.chunks || record.patches;
                                if (!chunks && record.chunks_json) {
                                    try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                                }
                                const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                                const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                                let descStr = patchStr + (record.is_snapshot ? ' • Snapshot' : '');

                                if (Array.isArray(chunks) && chunks.length > 0 && chunks[0].comment) {
                                    descStr = chunks[0].comment;
                                }
                                return html`
                                <sutram-card
                                    .titleText=${new window.inSetu.utils.InSetuURI(record.filepath).basename}
                                    .descriptionText=${descStr}
                                    .detailText=${record.filepath}
                                    icon=${record.is_snapshot ? 'save' : 'file-text'}
                                    intent=${record.is_snapshot ? 'highlight' : 'neutral'}
                                    entityType="patch-receipt"
                                    .entityData=${record}
                                    @card-clicked=${() => {
                                        if (window.inSetu.vfs.viewSourceFile) {
                                            window.inSetu.vfs.viewSourceFile(record.filepath, true);
                                        }
                                    }}>
                                </sutram-card>
                                `;
                            })}
                        </sutram-card-group>
                    `;
                }) : sortedFiles.slice(0, this._renderLimit).map(([filepath, fileData]) => {
                    const filename = new window.inSetu.utils.InSetuURI(filepath).basename;
                    const repo = fileData.records[0]?.repo || '';
                    return html`
                        <sutram-card-group ?stacked=${true} ?accordion=${true}>
                            <sutram-card
                                .titleText=${filename}
                                .descriptionText=${repo ? "Repo: " + repo : ""}
                                .detailText=${filepath}
                                icon="file-code-2"
                                intent="highlight"
                                entityType="file"
                                .entityData=${{ filepath: filepath, isFS: true, suppress: ['file-browse'] }}
                                @card-clicked=${() => {
                                    if (window.inSetu.vfs.viewSourceFile) {
                                        window.inSetu.vfs.viewSourceFile(filepath, true);
                                    }
                                }}>
                            </sutram-card>
                            ${fileData.records.map((record, idx) => {
                                let chunks = record.chunks || record.patches;
                                if (!chunks && record.chunks_json) {
                                    try { chunks = JSON.parse(record.chunks_json); } catch(e){}
                                }
                                const count = record.patch_count || (Array.isArray(chunks) && chunks.length > 0 ? chunks.length : 1);
                                const patchStr = count + (count !== 1 ? ' patches' : ' patch');
                                let descStr = patchStr + (record.is_snapshot ? ' • Snapshot' : '');

                                if (Array.isArray(chunks) && chunks.length > 0 && chunks[0].comment) {
                                    descStr = chunks[0].comment;
                                }
                                return html`
                                <sutram-card
                                    .titleText=${"Tx: " + (record.transaction_id || 'Unknown')}
                                    .descriptionText=${descStr}
                                    .detailText=${'Turn ' + (idx + 1) + ' of ' + fileData.records.length + ' • ' + this.utils.timeAgo(record.timestamp * 1000)}
                                    icon=${record.is_snapshot ? 'save' : 'git-commit'}
                                    intent=${record.is_snapshot ? 'highlight' : 'neutral'}
                                    entityType="patch-receipt"
                                    .entityData=${record}
                                    @card-clicked=${() => {
                                        if (window.inSetu.vfs.viewSourceFile) {
                                            window.inSetu.vfs.viewSourceFile(record.filepath, true);
                                        }
                                    }}>
                                </sutram-card>
                                `;
                            })}
                        </sutram-card-group>
                    `;
                })}
                ${((this._viewMode === 'transaction' && sortedTxs.length > this._renderLimit) || (this._viewMode !== 'transaction' && sortedFiles.length > this._renderLimit)) ? html`
                    <div id="history-sentinel" style="height: 20px; width: 100%;"></div>
                ` : ''}
                </sutram-stack>
                <sutram-surface slot="footer" variant="tinted" intent="success" border="top" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-btn
                            intent="success"
                            icon="history"
                            title="Toggle Yomama Menu (Active: Receipts)"
                            @click=${() => BridgeStore.getState().toggleDrawer()}>
                        </sutram-btn>
                        <sutram-btn
                            intent="neutral"
                            icon=${isTx ? 'folder-kanban' : 'file-text'}
                            label=${isTx ? 'Group By File' : 'Group By Turn'}
                            ?grow=${true}
                            @click=${() => BridgeStore.setState({ historyViewMode: isTx ? 'file' : 'transaction' })}>
                        </sutram-btn>
                        <sutram-btn
                            intent="success"
                            icon="refresh-cw"
                            label="Refresh"
                            @click=${() => BridgeStore.getState().fetchHistory()}>
                        </sutram-btn>
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
        `;
    }
}
if (!customElements.get('insetu-ext-bridge-history')) {
    customElements.define('insetu-ext-bridge-history', InSetuExtBridgeHistory);
}
