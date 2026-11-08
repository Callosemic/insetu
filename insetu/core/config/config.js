// config.js - Core OS Workspace Configuration Editor
import { html } from 'lit';
import { AppStore } from '/static/extensions/system/store.js';
import { InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
function _pollUntilDaemonReady() {
    const check = async () => {
        try {
            const ping = await window.inSetu.api.request('/auth/bootstrap?t=' + Date.now(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
                cache: 'no-store',
                signal: AbortSignal.timeout(1500)
            });
            if (ping && (ping.ok || ping.status === 401)) {
                const data = await ping.json().catch(() => ({}));
                if (data && data.status === 'recovery') {
                    window.location.href = '/recovery';
                    return;
                }
                if (data && data.token) {
                    sessionStorage.setItem('insetu_boot_token', data.token);
                    localStorage.setItem('insetu_boot_token', data.token);
                }
                window.location.reload();
                return;
            }
        } catch (err) {}
        setTimeout(check, 800);
    };
    setTimeout(check, 1200);
}
window.inSetu = window.inSetu || {};
window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.sys.waitForDaemonReboot = _pollUntilDaemonReady;
const DEFAULT_GLOBAL_SIEVE = {
    ignore_dirs: ['node_modules', '__pycache__', 'venv', '.venv', '.git', '.insetu', 'dist', 'build'],
    ignore_files: ['.DS_Store'],
    ignore_patterns: ['*.pyc', '*.log'],
    include_extensions: ['.py', '.js', '.ts', '.json', '.md', '.txt', '.html', '.css', '.sh', '.yaml', '.yml', '.toml'],
    managed_dirs: ['.insetu-data']
};

export class InSetuExtConfig extends InSetuElement {
    static get extensionName() { return 'config'; }
    static properties = {
        embedded: { type: Boolean, reflect: true },
        configForm: { type: Object },
        configMeta: { type: Object },
        _isOpen: { type: Boolean },
        _generalExpanded: { type: Boolean },
        _orderingExpanded: { type: Boolean },
        _reposExpanded: { type: Boolean },
        _editingRepoIdx: { type: Number },
        _repoSettingsExpanded: { type: Boolean },
        _repoBucketsExpanded: { type: Boolean },
        _expandedBuckets: { type: Object },
        _repoBackup: { type: Object },
        _dryRunReport: { type: Object },
        _showHostBrowser: { type: Boolean }
    };

    static styles = [sharedStyles];

    constructor() {
        super();
        this.embedded = false;
        this.configForm = null;
        this.configMeta = null;
        this._isOpen = false;
        this._editingRepoIdx = null;
        this._generalExpanded = true;
        this._orderingExpanded = false;
        this._reposExpanded = true;
        this._repoSettingsExpanded = true;
        this._repoBucketsExpanded = true;
        this._expandedBuckets = {};
        this._repoBackup = null;
        this._isNewRepo = false;
        this._createDirIfNeeded = true;
        this._dryRunReport = null;
        this._showHostBrowser = false;
    }

    get isEditingRepo() {
        const idx = this._editingRepoIdx;
        return idx !== null && Boolean(this.configForm?.target_repos?.[idx]);
    }

    get activeRepoTitle() {
        if (!this.isEditingRepo) return '';
        const repo = this.configForm.target_repos[this._editingRepoIdx];
        return `${this._isNewRepo ? 'Add Repository' : 'Edit Repository'}: ${repo.title || repo.repo_dir || 'New'}`;
    }

    _notifyModeChange() {
        this.dispatchEvent(new CustomEvent('insetu-topology-mode-changed', {
            detail: {
                isEditingRepo: this.isEditingRepo,
                isNewRepo: this._isNewRepo,
                activeRepoTitle: this.activeRepoTitle
            },
            bubbles: true,
            composed: true
        }));
    }
    _renderFieldCard(label, description, inputTemplate, scope = 'workspace', extraAction = null) {
        return html`
            <sutram-field-card
                .label=${label}
                .description=${description || ''}
                .scope=${scope}>
                ${extraAction ? html`<div slot="header-actions">${extraAction}</div>` : ''}
                ${inputTemplate}
            </sutram-field-card>
        `;
    }

    _renderOverrideToggle(repo, key, label, globalFallback, description = '') {
        const isOverridden = repo[key] !== undefined && repo[key] !== null;
        return html`
            <sutram-surface variant="panel" padding="md" gap="sm">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <sutram-toggle 
                        label="Override ${label}" 
                        .checked=${isOverridden}
                        @sutram-input-changed=${(e) => {
                            if (e.detail.value) {
                                repo[key] = [...globalFallback];
                            } else {
                                delete repo[key];
                            }
                            this.requestUpdate();
                        }}
                        ?flush=${true}>
                    </sutram-toggle>
                    <sutram-tag
                        text=${isOverridden ? 'Repo Override' : 'Inheriting Global'}
                        intent=${isOverridden ? 'highlight' : 'neutral'}>
                    </sutram-tag>
                </sutram-stack>
                ${isOverridden ? html`
                    <sutram-input 
                        .value=${(repo[key] || []).map(s => s === '' ? '""' : s).join(', ')} 
                        placeholder="Comma-separated override values (&quot;&quot; matches files with no extension)..." 
                        @sutram-input-changed=${(e) => { 
                            // Empty items are dropped; an explicit "" (or '') item is kept as the empty string.
                            repo[key] = e.detail.value.split(',')
                                .map(s => s.trim())
                                .filter(s => s !== '')
                                .map(s => (s === '""' || s === "''") ? '' : s); 
                            this.requestUpdate(); 
                        }} 
                        ?flush=${true}>
                    </sutram-input>
                ` : html`
                    <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                        ${globalFallback.length > 0
                            ? globalFallback.map(item => html`<sutram-tag .text=${item}></sutram-tag>`)
                            : html`<sutram-label text="None configured globally"></sutram-label>`}
                    </sutram-stack>
                `}
                ${description ? html`<sutram-label .text=${description}></sutram-label>` : ''}
            </sutram-surface>
        `;
    }

    _cancelRepoEditor() {
        if (this._isNewRepo && this._editingRepoIdx !== null) {
            this.configForm.target_repos.splice(this._editingRepoIdx, 1);
        } else if (this._repoBackup && this._editingRepoIdx !== null) {
            this.configForm.target_repos[this._editingRepoIdx] = JSON.parse(JSON.stringify(this._repoBackup));
        }
        this._editingRepoIdx = null;
        this._repoBackup = null;
        this._isNewRepo = false;
        this._dryRunReport = null;
        this._showHostBrowser = false;
        this._notifyModeChange();
        this.requestUpdate();
    }

    async saveAndCommitRepo() {
        const idx = this._editingRepoIdx;
        const repo = (idx !== null && this.configForm?.target_repos) ? this.configForm.target_repos[idx] : null;
        if (!repo || !repo.repo_dir || !repo.repo_dir.trim()) {
            alert("Repository Directory Name is required.");
            throw new Error("Repository Directory Name is required.");
        }
        repo.repo_dir = repo.repo_dir.trim();
        if (!repo.title || !repo.title.trim()) {
            repo.title = repo.repo_dir.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        if (repo.physical_path) repo.physical_path = repo.physical_path.trim();
        // 1. Commit configuration to disk first so VFS volumes and physical paths are dynamically mounted
        await this._saveConfig({ stayOpenInHub: true });

        // 2. Initialize .gitkeep through canonical VFS volume mount if requested
        if (this._isNewRepo && this._createDirIfNeeded && repo.repo_dir) {
            try {
                const targetPath = `vfs://${repo.repo_dir}/.gitkeep`;
                await window.inSetu.sys.executeWorkspaceMutation('fs/save', {
                    filepath: targetPath,
                    content: ''
                }, { silent: true });
            } catch (e) {
                console.warn("Failed to create directory for new repository:", e);
            }
        }
        this._repoBackup = null;
        this._isNewRepo = false;
        this._editingRepoIdx = null;
        this._dryRunReport = null;
        this._showHostBrowser = false;
        this._notifyModeChange();
        this.requestUpdate();
    }
    connectedCallback() {
        super.connectedCallback();
        if (this.embedded) {
            this.openModal();
        }
        this.registerGlobalListener('insetu:config:save', window, () => {
            if (this._isOpen || this.embedded) {
                if (this.isEditingRepo) this.saveAndCommitRepo();
                else this._saveConfig();
            }
        });
        this.registerGlobalListener('insetu:config:edit-repo', window, (e) => {
            const { repo, idx } = e.detail;
            this._repoBackup = JSON.parse(JSON.stringify(repo));
            this._editingRepoIdx = idx;
            this._isNewRepo = false;
            this._dryRunReport = null;
            this._notifyModeChange();
            this.requestUpdate();
        });
        this.registerGlobalListener('insetu:config:remove-repo', window, async (e) => {
            const { idx } = e.detail;
            const target = this.configForm?.target_repos?.[idx];
            if (!target) return;
            if (confirm(`Remove repository '${target.title || target.repo_dir}' from workspace tracking? (Physical files on disk will not be deleted)`)) {
                this.configForm.target_repos.splice(idx, 1);
                await this._saveConfig({ stayOpenInHub: true });
                this.requestUpdate();
            }
        });
    }

    onWorkspaceLoad(workspaceId) {
        if (this._isOpen || this.embedded) this.openModal();
    }

    async _testRepoBucketing(repoIdx, filterBucketId = null) {
        const repo = this.configForm.target_repos[repoIdx];
        try {
            const res = await this.api.post('system/config/test_bucketing', { repo_cfg: repo });
            if (res.ok) {
                const data = await res.json();
                let text = `Dry Run: Repository Bucketing for '${repo.repo_dir}'\n=======================================================\n\n`;

                if (filterBucketId) {
                    const files = data.buckets[filterBucketId] || [];
                    text = `Dry Run: Bucket '${filterBucketId}' in '${repo.repo_dir}'\n=======================================================\n\n`;
                    if (files.length === 0) {
                        text += "No files matched this bucket based on your current configuration.";
                    } else {
                        text += `Total Matches: ${files.length}\n-------------------------------------------------------\n`;
                        text += files.map(f => `  - ${f}`).join('\n');
                    }
                } else {
                    if (Object.keys(data.buckets).length === 0) {
                        text += "No files matched or repository is empty.";
                    } else {
                        Object.entries(data.buckets).forEach(([bucketId, files]) => {
                            text += `[Bucket: ${bucketId}] (${files.length} files)\n`;
                            text += `-------------------------------------------------------\n`;
                            text += files.map(f => `  - ${f}`).join('\n');
                            text += `\n\n`;
                        });
                    }
                }

                this._dryRunReport = {
                    title: `Dry-Run Bucketing Preview: ${filterBucketId || repo.repo_dir}`,
                    filename: `test_bucketing_${repo.repo_dir}.txt`,
                    content: text
                };
                this.requestUpdate();
            } else {
                const err = await res.json();
                alert("Error testing bucketing: " + err.error);
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }

    async openModal() {
        this._isOpen = true;
        try {
            const [cfgRes, topRes] = await Promise.all([
                this.api.get('system/config?t=' + Date.now(), { cache: 'no-store' }),
                this.api.get('system/topology?t=' + Date.now(), { cache: 'no-store' })
            ]);
            if (cfgRes.ok) {
                const data = await cfgRes.json();
                this.configForm = data.config || {};
                this.configMeta = data.meta || {};
            }
            if (topRes.ok && this.configForm) {
                const topData = await topRes.json();
                if (!this.configForm.tab_order && topData.tab_order) {
                    this.configForm.tab_order = topData.tab_order;
                }
                if (!this.configForm.category_order && topData.category_order) {
                    this.configForm.category_order = topData.category_order;
                }
                if (!this.configForm.hidden_outputs && topData.hidden_outputs) {
                    this.configForm.hidden_outputs = topData.hidden_outputs;
                }
            }
            this.requestUpdate();
        } catch (e) {
            console.error("Failed to fetch workspace topology config", e);
        }
    }
    _getSubBucketsRepeaterSchema(repo, rIdx) {
        const parentDom = repo?.domain || 'Workspaces';
        return {
            id: 'sub_buckets',
            label: 'Sub-Buckets (Specialized Context Splitters)',
            scope: 'repo',
            min_items: 0,
            max_items: 50,
            item_label: 'Sub-Bucket',
            item_title_key: 'title',
            item_subtitle_key: 'id',
            add_label: 'Add Sub-Bucket',
            empty_text: 'No sub-buckets defined. All tracked files route to Bucket 0 (main).',
            description: 'Route specific folder prefixes or dynamically split subfolders into dedicated context artifacts.',
            item_actions: (b) => {
                if (b?._mode === 'implicit' || b?.dynamic_split_prefix) return '';
                return html`
                    <sutram-btn
                        intent="neutral"
                        ?compact=${true}
                        label="Test"
                        icon="flask-conical"
                        @click=${(e) => {
                            e.stopPropagation();
                            this._testRepoBucketing(rIdx, b.id);
                        }}>
                    </sutram-btn>
                `;
            },
            item_schema: [
                {
                    id: '_mode',
                    label: 'Sub-Bucket Extraction Mode',
                    type: 'select',
                    default: 'explicit',
                    options: [
                        { value: 'explicit', label: 'Explicit (Match Folder/File Prefixes)' },
                        { value: 'implicit', label: 'Implicit (Dynamic Subfolder Splitting)' }
                    ]
                },
                {
                    id: 'title',
                    label: 'Bucket Display Title',
                    type: 'text',
                    default: '',
                    placeholder: 'e.g. Core Architecture',
                    show_if: { field: '_mode', not_equals: 'implicit' }
                },
                {
                    id: 'id',
                    label: 'Bucket ID (Slug)',
                    type: 'slug',
                    source_key: 'title',
                    default: ''
                },
                {
                    id: 'domain',
                    label: 'Domain Category Override',
                    type: 'text',
                    default: '',
                    placeholder: parentDom
                },
                {
                    id: 'description',
                    label: 'Description',
                    type: 'text',
                    default: '',
                    placeholder: 'Summary displayed on the compiled context card...',
                    show_if: { field: '_mode', not_equals: 'implicit' }
                },
                {
                    id: 'priority_bucket',
                    label: 'Priority Cache Warming',
                    toggle_label: 'Prioritize in Offline Cache',
                    type: 'boolean',
                    default: false,
                    show_if: { field: '_mode', not_equals: 'implicit' }
                },
                {
                    id: 'match_prefixes',
                    label: 'Match Prefixes (Comma-Separated)',
                    type: 'comma_list',
                    default: [],
                    placeholder: 'src/core/, docs/',
                    show_if: { field: '_mode', not_equals: 'implicit' }
                },
                {
                    id: 'dynamic_split_prefix',
                    label: 'Dynamic Split Prefix',
                    type: 'text',
                    default: '',
                    placeholder: 'e.g. . or extensions/',
                    show_if: { field: '_mode', equals: 'implicit' }
                },
                {
                    id: 'drop_patterns',
                    label: 'Drop Patterns (.gitignore syntax, comma-separated)',
                    type: 'comma_list',
                    default: [],
                    placeholder: 'archived/, *.draft.md'
                },
                {
                    id: 'ignore_patterns',
                    label: 'Pass-Through Ignore Patterns (Comma-Separated)',
                    type: 'comma_list',
                    default: [],
                    placeholder: '*.py, /legacy/'
                },
                {
                    id: '_meta_map_editor',
                    type: 'custom',
                    show_if: { field: '_mode', equals: 'implicit' },
                    custom_render: (b, bIdx, patchItem) => {
                        const metaMap = (b && typeof b.meta_map === 'object' && b.meta_map !== null) ? b.meta_map : {};
                        return this._renderFieldCard(
                            'Meta Map (Subfolder Title & Domain Overrides)',
                            'Optional display title and domain overrides for specific child directories.',
                            html`
                                <sutram-stack direction="col" gap="sm">
                                    ${Object.keys(metaMap).map(dirKey => {
                                        const meta = metaMap[dirKey] || {};
                                        return html`
                                            <sutram-surface variant="inset" padding="sm">
                                                <sutram-stack direction="row" gap="sm" align="center" ?wrap=${true}>
                                                    <sutram-input .value=${dirKey} placeholder="Folder Name" @sutram-input-changed=${(e) => {
                                                        const newKey = e.detail.value;
                                                        if (newKey && newKey !== dirKey && !metaMap[newKey]) {
                                                            const nextMap = { ...metaMap, [newKey]: metaMap[dirKey] };
                                                            delete nextMap[dirKey];
                                                            patchItem({ meta_map: nextMap });
                                                        }
                                                    }} ?flush=${true} ?grow=${true}></sutram-input>
                                                    <sutram-input .value=${meta.title || ''} placeholder="Display Title" @sutram-input-changed=${(e) => {
                                                        patchItem({ meta_map: { ...metaMap, [dirKey]: { ...meta, title: e.detail.value } } });
                                                    }} ?flush=${true} ?grow=${true}></sutram-input>
                                                    <sutram-input .value=${meta.domain || ''} placeholder=${b.domain || parentDom} @sutram-input-changed=${(e) => {
                                                        const val = e.detail.value.trim();
                                                        const nextEntry = { ...meta };
                                                        if (val) nextEntry.domain = val;
                                                        else delete nextEntry.domain;
                                                        patchItem({ meta_map: { ...metaMap, [dirKey]: nextEntry } });
                                                    }} ?flush=${true} ?grow=${true}></sutram-input>
                                                    <sutram-btn intent="danger" ?compact=${true} variant="text" icon="trash-2" label="Remove" @click=${() => {
                                                        const nextMap = { ...metaMap };
                                                        delete nextMap[dirKey];
                                                        patchItem({ meta_map: nextMap });
                                                    }}></sutram-btn>
                                                </sutram-stack>
                                            </sutram-surface>
                                        `;
                                    })}
                                </sutram-stack>
                            `,
                            'repo',
                            html`
                                <sutram-btn ?compact=${true} intent="primary" icon="plus" label="Add Folder Override" @click=${() => {
                                    const nextIdx = Object.keys(metaMap).filter(k => k.startsWith('new_folder_')).length + 1;
                                    patchItem({ meta_map: { ...metaMap, [`new_folder_${nextIdx}`]: { title: '', domain: '' } } });
                                }}></sutram-btn>
                            `
                        );
                    }
                },
                {
                    id: '_ext_pipeline_rules',
                    type: 'custom',
                    custom_render: (b, bIdx, patchItem) => {
                        const opts = typeof window.ExtensionRegistry?.getBucketConfigOptions === 'function'
                            ? window.ExtensionRegistry.getBucketConfigOptions()
                            : [];
                        const templates = opts
                            .filter(opt => typeof opt.component === 'function')
                            .map(opt => opt.component({
                                bucket: b,
                                repoDir: repo.repo_dir,
                                updateCallback: () => patchItem({ ...b })
                            }));
                        if (templates.length === 0) return '';
                        return this._renderFieldCard(
                            'Extension Pipeline Rules',
                            'Domain-specific compilation and diff rules registered by active extensions.',
                            html`<sutram-stack direction="row" gap="lg" align="center" ?wrap=${true}>${templates}</sutram-stack>`,
                            'repo'
                        );
                    }
                }
            ]
        };
    }

    renderSubBuckets(repo, rIdx) {
        const rawBuckets = (repo.sub_buckets || []).filter(b => !b.is_system).map(b => ({
            ...b,
            _mode: b.dynamic_split_prefix ? 'implicit' : 'explicit'
        }));
        const schema = this._getSubBucketsRepeaterSchema(repo, rIdx);
        return html`
            <insetu-schema-repeater
                .field=${schema}
                .items=${rawBuckets}
                @insetu-repeater-changed=${(e) => {
                    const systemBuckets = (repo.sub_buckets || []).filter(b => b.is_system);
                    const updated = (e.detail.value || []).map(item => {
                        const copy = { ...item };
                        const mode = copy._mode || (copy.dynamic_split_prefix ? 'implicit' : 'explicit');
                        delete copy._mode;
                        if (mode === 'implicit') {
                            if (!copy.dynamic_split_prefix) copy.dynamic_split_prefix = '.';
                            delete copy.match_prefixes;
                        } else {
                            delete copy.dynamic_split_prefix;
                        }
                        if (!copy.domain) delete copy.domain;
                        return copy;
                    });
                    this.configForm.target_repos[rIdx].sub_buckets = [...systemBuckets, ...updated];
                    this.requestUpdate();
                }}>
            </insetu-schema-repeater>
        `;
    }

    renderRepos() {
        if (!this.configForm) return '';
        const repos = this.configForm.target_repos || [];
        if (repos.length === 0) {
            return html`<sutram-empty-state text="No repositories tracked yet. Click 'Add Repository' to map a codebase into this workspace."></sutram-empty-state>`;
        }
        return html`
            <sutram-card-group>
                ${repos.map((repo, idx) => {
                        const bucketCount = (repo.sub_buckets || []).filter(b => !b.is_system).length;
                        const pathInfo = repo.physical_path ? `Host Path: ${repo.physical_path}` : `Directory: ${repo.repo_dir || 'Unset'}`;
                        const suffix = `${bucketCount} sub-bucket${bucketCount === 1 ? '' : 's'}${repo.offline_capable ? ' • ⚡ Offline' : ''}`;
                        return html`
                            <sutram-card
                                titleText=${repo.title || repo.repo_dir || 'New Repository'}
                                descriptionText=${pathInfo}
                                detailText=${repo.domain || 'Workspaces'}
                                detailSuffix=${suffix}
                                icon="package"
                                intent="highlight"
                                ?disableSelection=${true}
                                entityType="config-repo"
                                .entityData=${{ repo, idx }}
                                @card-clicked=${() => { 
                                    this._repoBackup = JSON.parse(JSON.stringify(repo)); 
                                    this._editingRepoIdx = idx; 
                                    this._isNewRepo = false;
                                    this._dryRunReport = null;
                                    this._notifyModeChange();
                                }}>
                            </sutram-card>
                        `;
                    })}
            </sutram-card-group>
        `;
    }
    renderRepoDrillDown(repo, idx) {
        if (!repo) return html``;
        if (this._showHostBrowser) {
            return html`
                <insetu-host-dir-picker
                    .titleText=${`Select Host Directory for '${repo.title || repo.repo_dir || 'Repository'}'`}
                    confirmLabel="Select Current Path"
                    .initialPath=${repo.physical_path || ''}
                    @host-dir-cancelled=${() => { this._showHostBrowser = false; }}
                    @host-dir-selected=${(e) => {
                        const selectedDir = e.detail?.path || '';
                        repo.physical_path = selectedDir;
                        if (!repo.repo_dir) {
                            repo.repo_dir = this.utils.HostPath.basename(selectedDir);
                        }
                        this._showHostBrowser = false;
                        this.requestUpdate();
                    }}>
                </insetu-host-dir-picker>
            `;
        }

        return html`
            <sutram-stack direction="col" gap="md">
                ${!this.embedded ? html`
                    <sutram-surface variant="panel" border="bottom" padding="sm">
                        <sutram-stack direction="row" justify="between" align="center" gap="sm">
                            <sutram-btn
                                intent="neutral"
                                ?compact=${true}
                                icon="corner-left-up"
                                label="All Repositories"
                                @click=${() => this._cancelRepoEditor()}>
                            </sutram-btn>
                            <sutram-label .text=${this.activeRepoTitle}></sutram-label>
                        </sutram-stack>
                    </sutram-surface>
                ` : ''}

                ${this._dryRunReport ? html`
                    <sutram-surface variant="tinted" intent="highlight" padding="md" gap="sm">
                        <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-icon name="flask-conical" size="md" intent="highlight"></sutram-icon>
                                <strong>${this._dryRunReport.title}</strong>
                            </sutram-stack>
                            <sutram-stack direction="row" gap="sm">
                                <sutram-btn ?compact=${true} intent="primary" icon="external-link" label="Open in Editor" @click=${() => {
                                    const rpt = this._dryRunReport;
                                    window.inSetu?.events?.emit('insetu:system:close-settings');
                                    this._isOpen = false;
                                    AppStore.setState({ isConfigOpen: false });
                                    if (window.inSetu.ui?.viewTextBlob) {
                                        window.inSetu.ui.viewTextBlob(rpt.title, rpt.content, rpt.filename);
                                    }
                                }}></sutram-btn>
                                <sutram-btn ?compact=${true} intent="neutral" icon="x" label="Dismiss" @click=${() => { this._dryRunReport = null; }}></sutram-btn>
                            </sutram-stack>
                        </sutram-stack>
                        <pre>${this._dryRunReport.content}</pre>
                    </sutram-surface>
                ` : ''}

                <sutram-collapsible   
                    titleText="Bucket 0 (Base Repository & Sieve Pipeline)" 
                    intent="primary"
                    .open=${this._repoSettingsExpanded}
                    @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._repoSettingsExpanded = e.detail.open; }}>
                    <sutram-stack slot="actions" direction="row" gap="sm">
                        <sutram-btn intent="neutral" ?compact=${true} icon="flask-conical" label="Test All Buckets" @click=${(e) => {
                            e.stopPropagation();
                            this._testRepoBucketing(idx);
                        }}></sutram-btn>
                    </sutram-stack>
                    <sutram-stack direction="col" gap="md">
                        <sutram-stack direction="grid" gap="md">
                            ${this._renderFieldCard(
                                'Display Title',
                                'Human-readable title shown on context cards and headers.',
                                html`<sutram-input .value=${repo.title || ''} placeholder="e.g. My Repository" @sutram-input-changed=${(e) => { repo.title = e.detail.value; this._notifyModeChange(); this.requestUpdate(); }} ?flush=${true}></sutram-input>`,
                                'repo'
                            )}
                            ${this._renderFieldCard(
                                'Directory Name (Volume ID)',
                                `Canonical VFS volume: vfs://${repo.repo_dir || 'my-repo'}/`,
                                html`<sutram-input .value=${repo.repo_dir || ''} placeholder="e.g. my-repo" @sutram-input-changed=${(e) => { repo.repo_dir = e.detail.value; this._notifyModeChange(); this.requestUpdate(); }} ?flush=${true}></sutram-input>`,
                                'repo'
                            )}
                            ${this._renderFieldCard(
                                'Domain Category',
                                'Primary grouping heading in Gather & Diffs views.',
                                html`<sutram-input .value=${repo.domain || ''} placeholder="Workspaces" @sutram-input-changed=${(e) => { repo.domain = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-input>`,
                                'repo'
                            )}
                            ${this._renderFieldCard(
                                'Archive Type',
                                'Standard code repository or media vault.',
                                html`<sutram-select .value=${repo.archive_type || 'repo'} .options=${[
                                    { value: 'repo', label: 'Standard Repo' },
                                    { value: 'media-vault', label: 'Media Vault' },
                                    ...(repo.archive_type && repo.archive_type !== 'repo' && repo.archive_type !== 'media-vault' ? [{ value: repo.archive_type, label: repo.archive_type }] : [])
                                ]} @sutram-input-changed=${(e) => { repo.archive_type = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-select>`,
                                'repo'
                            )}
                        </sutram-stack>

                        ${this._renderFieldCard(
                            'Physical Host Path (Optional External Mount Override)',
                            `Resolved Path: ${repo.physical_path ? repo.physical_path : `[workspace root]/${repo.repo_dir || 'my-new-repo'}/`}`,
                            html`
                                <sutram-stack direction="row" gap="sm" align="center">
                                    <sutram-input .value=${repo.physical_path || ''} placeholder="Leave blank for [workspace root]/${repo.repo_dir || 'repo'}, or browse host..." @sutram-input-changed=${(e) => { repo.physical_path = e.detail.value; this.requestUpdate(); }} ?flush=${true} ?grow=${true}></sutram-input>
                                    <sutram-btn intent="highlight" icon="folder" label="Browse..." @click=${() => { this._showHostBrowser = true; }}></sutram-btn>
                                </sutram-stack>
                                ${this._isNewRepo ? html`
                                    <sutram-toggle 
                                        label="Create directory on disk if it does not exist yet" 
                                        .checked=${this._createDirIfNeeded !== false} 
                                        @sutram-input-changed=${(e) => { this._createDirIfNeeded = e.detail.value; this.requestUpdate(); }} 
                                        ?flush=${true}>
                                    </sutram-toggle>
                                ` : ''}
                            `,
                            'repo'
                        )}

                        ${this._renderOverrideToggle(repo, 'exts', 'Tracked Extensions', (this.configForm.include_extensions || []), 'File extensions indexed by the VFS and Cartographer for this repository.')}
                        ${this._renderOverrideToggle(repo, 'repo_ignore_dirs', 'Ignore Directories', (this.configForm.ignore_dirs || []), 'Directory names skipped during VFS traversal.')}
                        ${this._renderOverrideToggle(repo, 'repo_ignore_files', 'Ignore Files', (this.configForm.ignore_files || []), 'Exact filenames skipped during VFS traversal.')}
                        ${this._renderOverrideToggle(repo, 'repo_ignore_patterns', 'Ignore Patterns', (this.configForm.ignore_patterns || []), 'Wildcard or .gitignore patterns skipped during VFS traversal.')}
                        ${this._renderOverrideToggle(repo, 'repo_managed_dirs', 'Managed Dirs (Cartographer Labels)', (this.configForm.managed_dirs || []), 'Directories treated as managed data containers in CODE_INDEX.md.')}

                        <sutram-stack direction="grid" gap="md">
                            ${this._renderFieldCard(
                                'Ignore Exceptions (Comma-Separated)',
                                'Paths or patterns exempted from global/repo ignore rules (e.g. .insetu-data/, docs/archived/).',
                                html`<sutram-input .value=${(repo.ignore_exceptions || []).join(', ')} placeholder="docs/archived/, .insetu-data/" @sutram-input-changed=${(e) => { repo.ignore_exceptions = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }} ?flush=${true}></sutram-input>`,
                                'repo'
                            )}
                            ${this._renderFieldCard(
                                'Force Include Files (Comma-Separated)',
                                'Specific relative filepaths always included regardless of extension filters.',
                                html`<sutram-input .value=${(repo.force_include || []).join(', ')} placeholder="docs/todos.md, Makefile" @sutram-input-changed=${(e) => { repo.force_include = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }} ?flush=${true}></sutram-input>`,
                                'repo'
                            )}
                            ${this._renderFieldCard(
                                'Path Prefix (Virtual Root Restriction)',
                                'Optional subdirectory prefix to restrict VFS scanning within a monorepo.',
                                html`<sutram-input .value=${repo.prefix || ''} placeholder="e.g. packages/web/" @sutram-input-changed=${(e) => { repo.prefix = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-input>`,
                                'repo'
                            )}
                        </sutram-stack>

                        ${this._renderFieldCard(
                            'Pipeline & Sieve Capabilities',
                            'Control ignore rule evaluation and extension-specific exclusions for this repository.',
                            html`
                                <sutram-stack direction="row" justify="between" align="center" gap="normal" ?wrap=${true}>
                                    <sutram-stack direction="row" align="center" gap="normal" ?wrap=${true}>
                                        <sutram-toggle label="Apply Ignore Rules" .checked=${repo.apply_ignore !== false} @sutram-input-changed=${(e) => { repo.apply_ignore = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-toggle>
                                        ${(() => {
                                            const opts = typeof window.ExtensionRegistry?.getRepoConfigOptions === 'function'
                                                ? window.ExtensionRegistry.getRepoConfigOptions()
                                                : Array.from(window.ExtensionRegistry?._manifests?.entries() || [])
                                                    .filter(([extName]) => window.inSetu.isCore(extName) || !window.ACTIVE_EXTENSIONS || window.ACTIVE_EXTENSIONS.includes(extName))
                                                    .flatMap(([, m]) => m.repoConfigOptions || [])
                                                    .sort((a, b) => (a.order || 50) - (b.order || 50));
                                            return opts
                                                .filter(opt => typeof opt.component === 'function')
                                                .map(opt => opt.component({ repo, updateCallback: () => this.requestUpdate() }));
                                        })()}
                                    </sutram-stack>
                                </sutram-stack>
                            `,
                            'repo'
                        )}
                    </sutram-stack>
                </sutram-collapsible>

                <sutram-collapsible 
                    titleText="Sub-Buckets (Specialized Context Splitters)" 
                    intent="highlight" 
                    .open=${this._repoBucketsExpanded}
                    @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._repoBucketsExpanded = e.detail.open; }}>
                    <sutram-stack slot="actions" direction="row" gap="sm">
                        <sutram-btn intent="highlight" ?compact=${true} icon="plus" label="Add Sub-Bucket" @click=${(e) => {
                            e.stopPropagation();
                            if (!repo.sub_buckets) repo.sub_buckets = [];
                            const newIdx = repo.sub_buckets.length;
                            repo.sub_buckets.push({ id: `bucket_${Date.now()}`, title: '', match_prefixes: [] });
                            this._expandedBuckets = { ...this._expandedBuckets, [newIdx]: true };
                            this._repoBucketsExpanded = true;
                            this.requestUpdate();
                        }}></sutram-btn>
                    </sutram-stack>
                    <sutram-stack direction="col" gap="sm">
                        ${this.renderSubBuckets(repo, idx)}
                    </sutram-stack>
                </sutram-collapsible>
            </sutram-stack>
        `;
    }
    _renderTopologyOverview() {
        return html`
            <sutram-stack direction="col" gap="md">
                <sutram-collapsible 
                    titleText="Global VFS Sieve & Ignore Defaults" 
                    intent="neutral"
                    .open=${this._generalExpanded}
                    @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._generalExpanded = e.detail.open; }}>
                    <div slot="actions">
                        <sutram-btn intent="neutral" ?compact=${true} icon="rotate-ccw" label="Reset Defaults"
                            @click=${(e) => {
                                e.stopPropagation();
                                this.configForm = {
                                    ...this.configForm,
                                    ignore_dirs: [...DEFAULT_GLOBAL_SIEVE.ignore_dirs],
                                    ignore_files: [...DEFAULT_GLOBAL_SIEVE.ignore_files],
                                    ignore_patterns: [...DEFAULT_GLOBAL_SIEVE.ignore_patterns],
                                    include_extensions: [...DEFAULT_GLOBAL_SIEVE.include_extensions],
                                    managed_dirs: [...DEFAULT_GLOBAL_SIEVE.managed_dirs]
                                };
                                this.requestUpdate();
                            }}>
                        </sutram-btn>
                    </div>
                    <sutram-stack direction="col" gap="md">
                        <sutram-stack direction="grid" gap="md">
                            ${this._renderFieldCard(
                                'Global Ignore Directories',
                                'Directories completely skipped by the VFS and Watchdog unless overridden by a repository.',
                                html`<sutram-input .value=${(this.configForm.ignore_dirs || []).join(', ')} placeholder="node_modules, __pycache__, venv" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, ignore_dirs: arr }; }} ?flush=${true}></sutram-input>`,
                                'workspace'
                            )}
                            ${this._renderFieldCard(
                                'Global Ignore Files',
                                'Exact filenames ignored across all repositories.',
                                html`<sutram-input .value=${(this.configForm.ignore_files || []).join(', ')} placeholder=".DS_Store" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, ignore_files: arr }; }} ?flush=${true}></sutram-input>`,
                                'workspace'
                            )}
                        </sutram-stack>
                        ${this._renderFieldCard(
                            'Global Ignore Patterns (.gitignore syntax, one per line)',
                            'Wildcard and .gitignore patterns ignored globally (e.g. *.pyc, *.log).',
                            html`<sutram-textarea .value=${(this.configForm.ignore_patterns || []).join('\n')} .monospace=${true} placeholder="*.pyc\n*.log" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, ignore_patterns: arr }; }} ?flush=${true}></sutram-textarea>`,
                            'workspace'
                        )}
                        <sutram-stack direction="grid" gap="md">
                            ${this._renderFieldCard(
                                'Global Allowed Extensions',
                                'Default tracked file extensions for repositories that do not define an explicit override.',
                                html`<sutram-input .value=${(this.configForm.include_extensions || []).join(', ')} placeholder=".py, .js, .md" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(s => s !== null && s !== undefined); this.configForm = { ...this.configForm, include_extensions: arr }; }} ?flush=${true}></sutram-input>`,
                                'workspace'
                            )}
                            ${this._renderFieldCard(
                                'Exempted Managed Directories',
                                'Data folders indexed with structural labels in CODE_INDEX.md without requiring inline comments.',
                                html`<sutram-input .value=${(this.configForm.managed_dirs || []).join(', ')} placeholder=".insetu-data" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, managed_dirs: arr }; }} ?flush=${true}></sutram-input>`,
                                'workspace'
                            )}
                        </sutram-stack>
                    </sutram-stack>
                </sutram-collapsible>

                <sutram-collapsible 
                    titleText="Target Repositories (${(this.configForm.target_repos || []).length})"  
                    intent="primary"
                    .open=${this._reposExpanded}
                    @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._reposExpanded = e.detail.open; }}>
                    <div slot="actions">
                        <sutram-btn intent="primary" ?compact=${true} icon="plus" label="Add Repository"
                            @click=${async (e) => {
                                e.stopPropagation();
                                if (!this.configForm.target_repos) this.configForm.target_repos = [];
                                let newRepo = {    
                                    repo_dir: '', title: '', domain: 'Workspaces', 
                                    apply_ignore: true, sub_buckets: [] 
                                };
                                try {
                                    const res = await this.api.get('gather/repos/template');
                                    if (res.ok) newRepo = await res.json();
                                } catch(err) {}
                                this.configForm.target_repos.push(newRepo);
                                const newIdx = this.configForm.target_repos.length - 1;
                                this._repoBackup = null;
                                this._editingRepoIdx = newIdx;
                                this._isNewRepo = true;
                                this._createDirIfNeeded = true;
                                this._dryRunReport = null;
                                this._notifyModeChange();
                                this.requestUpdate();
                            }}></sutram-btn>
                    </div>
                    <sutram-label text="Click any repository card to configure its Bucket 0 sieve overrides, sub-buckets, host path, or offline cache warming."></sutram-label>
                    ${this.renderRepos()}
                </sutram-collapsible>

                <sutram-collapsible
                    titleText="Workspace UI & Output Ordering"
                    intent="highlight"
                    .open=${this._orderingExpanded}
                    @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._orderingExpanded = e.detail.open; }}>
                    <sutram-stack direction="col" gap="md">
                        <sutram-stack direction="grid" gap="md">
                            ${this._renderFieldCard(
                                'Primary Navigation Tab Order',
                                'Comma-separated top-level folder IDs controlling the left-to-right order in the top bar.',
                                html`<sutram-input .value=${(this.configForm.tab_order || ['context', 'edit', 'tasks', 'ctrl', 'library']).join(', ')} placeholder="context, edit, tasks, ctrl, library" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, tab_order: arr }; }} ?flush=${true}></sutram-input>`,
                                'workspace'
                            )}
                            ${this._renderFieldCard(
                                'Context Domain Category Order',
                                'Comma-separated domain names controlling vertical section order in Gather and Diffs views.',
                                html`<sutram-input .value=${(this.configForm.category_order || []).join(', ')} placeholder="Core OS, Workspaces, Documentation" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, category_order: arr }; }} ?flush=${true}></sutram-input>`,
                                'workspace'
                            )}
                        </sutram-stack>
                        ${this._renderFieldCard(
                            'Hidden Context Outputs',
                            'Compiled ctx:// URIs to hide from the primary Gather and Diffs card lists.',
                            html`<sutram-input .value=${(this.configForm.hidden_outputs || []).join(', ')} placeholder="ctx://contexts/context_prompt.md" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(Boolean); this.configForm = { ...this.configForm, hidden_outputs: arr }; }} ?flush=${true}></sutram-input>`,
                            'workspace'
                        )}
                    </sutram-stack>
                </sutram-collapsible>
            </sutram-stack>
        `;
    }

    render() {
        const idx = this._editingRepoIdx;
        const activeRepo = (idx !== null && this.configForm && this.configForm.target_repos) ? this.configForm.target_repos[idx] : null;
        const isEditingRepo = idx !== null && activeRepo !== null;

        const bodyContent = !this.configForm 
            ? html`<sutram-surface variant="ghost" padding="lg"><sutram-spinner text="Loading workspace topology..."></sutram-spinner></sutram-surface>`
            : (isEditingRepo ? this.renderRepoDrillDown(activeRepo, idx) : this._renderTopologyOverview());

        if (this.embedded) {
            return bodyContent;
        }

        return html`
            ${this._isOpen ? html`
                <sutram-modal 
                    ?open=${true} 
                    titleText=${isEditingRepo ? this.activeRepoTitle : 'Workspace Topology Manager'} 
                    ?fullscreen=${true} 
                    ?flush=${true}
                    @sutram-modal-closed=${(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (this._editingRepoIdx !== null) {
                            this._cancelRepoEditor();
                        }
                        this._isOpen = false;
                        AppStore.setState({ isConfigOpen: false });
                    }}>
                    <sutram-surface slot="body" variant="ghost" padding="lg">${bodyContent}</sutram-surface>
                    ${isEditingRepo ? html`
                        <sutram-btn slot="footer" intent="neutral" icon="x" label="Cancel" @click=${() => this._cancelRepoEditor()}></sutram-btn>
                        <sutram-async-btn 
                            slot="footer" 
                            icon="save"
                            label="${this._isNewRepo ? 'Create & Remap Disk' : 'Save Repository & Remap'}" 
                            intent="success" 
                            .onClick=${async () => await this.saveAndCommitRepo()}>
                        </sutram-async-btn>
                    ` : html`
                        <sutram-async-btn slot="footer" icon="save" label="Save & Remap Disk" intent="primary" .onClick=${() => this._saveConfig()}></sutram-async-btn>
                    `}
                </sutram-modal>
            ` : ''}
        `;
    }
    async _saveConfig(options = {}) {
        const { stayOpenInHub = false } = options;
        try {
            const res = await this.api.post('system/config', this.configForm);
            if (res.ok) {
                const data = await res.json();
                if (window.inSetu.stores.Gather) {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⏳ Re-indexing workspace topology...", null);
                    await window.inSetu.stores.Gather.getState().executeCompile(null, true);
                }
                if (data.requires_reboot) {
                    AppStore.setState({ isRebooting: true, rebootType: 'reboot' });
                    try {
                        await this.api.post('system/reboot', {});
                    } catch(err) {}
                    _pollUntilDaemonReady();
                    await new Promise(() => {});
                } else {
                    if (!stayOpenInHub && !this.embedded) {
                        this._isOpen = false;
                        AppStore.setState({ isConfigOpen: false });
                    }
                    if (window.inSetu.sys.performSoftRefresh) {
                        await window.inSetu.sys.performSoftRefresh();
                    } else {
                        window.location.reload();
                    }
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("✅ Workspace topology saved and remapped", 2500);
                    }
                }
            } else {
                const data = await res.json();
                throw new Error(data.error || "Unknown Server Error");
            }
        } catch (e) {
            throw new Error(e.message || "Network error");
        }
    }
}
customElements.define('insetu-ext-config', InSetuExtConfig);

// --- DECLARATIVE SCHEMA PAYLOAD ---
window.ExtensionRegistry.registerExtension('config', {
    name: "Workspace Configuration",
    version: "2.0.0",
    settingsCategory: "Workspace",
    offline_mode: "read_only",
    shortcuts: [
        {
            context: 'modal:config-editor-modal',
            key: 'ctrl+s',
            label: 'Save Workspace Config',
            action: () => window.dispatchEvent(new Event('insetu:config:save'))
        }
    ],
    entityActions: [
        {
            targetEntity: 'config-repo',
            id: 'config-repo-edit',
            label: 'Edit',
            icon: 'edit-3',
            intent: 'primary',
            group: 'edit',
            vfsBound: false,
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:config:edit-repo', detail: data })
        },
        {
            targetEntity: 'config-repo',
            id: 'config-repo-remove',
            label: 'Remove',
            icon: 'trash-2',
            intent: 'danger',
            group: 'file',
            vfsBound: false,
            order: 20,
            emitEvent: (data) => ({ name: 'insetu:config:remove-repo', detail: data })
        },
        {
            targetEntity: 'system_control',
            id: 'sys-refresh-files',
            label: 'Refresh Files',
            icon: 'refresh-cw',
            intent: 'primary',
            group: 'tools',
            vfsBound: false,
            order: 10,
            asyncAction: async (data, e) => {
                if (window.inSetu?.stores?.Gather) {
                    await window.inSetu.stores.Gather.getState().executeCompile(null, true);
                }
            }
        },
        {
            targetEntity: 'system_control',
            id: 'sys-reboot',
            label: 'Reboot',
            icon: 'power',
            intent: 'success',
            group: 'tools',
            vfsBound: false,
            order: 20,
            asyncAction: async (data, e) => {
                if (!confirm("Reboot the inSetu OS daemon?")) return;
                window.inSetu?.events?.emit('insetu:system:close-settings');
                AppStore.setState({ isRebooting: true, rebootType: 'reboot' });
                try {
                    await window.inSetu.api.post('system/reboot', {});
                    _pollUntilDaemonReady();
                } catch (err) {
                    alert("Reboot failed: " + err.message);
                    AppStore.setState({ isRebooting: false });
                }
            }
        },
        {
            targetEntity: 'system_control',
            id: 'sys-lifeboat',
            label: 'Lifeboat',
            icon: 'life-buoy',
            intent: 'warning',
            group: 'tools',
            vfsBound: false,
            order: 30,
            onClick: (data, e) => {
                window.inSetu?.events?.emit('insetu:system:close-settings');
                if (window.inSetu.sys.simulatePanic) window.inSetu.sys.simulatePanic();
            }
        }
    ],
    settingsActions: [
        {
            id: 'workspaces_editor',
            label: 'Add / Remove Workspaces',
            icon: 'layers',
            onClick: () => {
                AppStore.setState({ isWorkspaceEditorOpen: true });
            }
        },
        {
            id: 'config_editor',
            label: 'Configure Current Workspace',
            icon: 'settings',
            onClick: () => {
                AppStore.setState({ isConfigOpen: true });
            }
        }
    ]
});