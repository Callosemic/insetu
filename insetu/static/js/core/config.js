// config.js - Core OS Workspace Configuration Editor
import { html, css } from 'lit';
import { AppStore } from './store.js';
import { InSetuElement } from './sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';

export class InSetuExtConfig extends InSetuElement {
    static properties = {
        configForm: { type: Object },
        configMeta: { type: Object },
        _isOpen: { type: Boolean },
        _generalExpanded: { type: Boolean },
        _extExpanded: { type: Boolean },
        _reposExpanded: { type: Boolean },
        _editingRepoIdx: { type: Number },
        _repoSettingsExpanded: { type: Boolean },
        _repoBucketsExpanded: { type: Boolean },
        _expandedBuckets: { type: Object },
        _repoBackup: { type: Object }
    };

    static styles = [sharedStyles];
    _renderOverrideToggle(repo, key, label, globalFallback) {
        const isOverridden = repo[key] !== undefined && repo[key] !== null;
        return html`
            <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; background: var(--bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <sutram-toggle 
                        label="Override ${label}" 
                        .checked=${isOverridden}
                        @sutram-input-changed=${(e) => {
                            if (e.detail.value) {
                                repo[key] = [];
                            } else {
                                delete repo[key];
                            }
                            this.requestUpdate();
                        }}
                        ?flush=${true}>
                    </sutram-toggle>
                </div>
                ${isOverridden ? html`
                    <sutram-input 
                        label="${label} (comma separated)" 
                        .value=${(repo[key] || []).join(', ')} 
                        placeholder="Override values..." 
                        @sutram-input-changed=${(e) => { 
                            repo[key] = e.detail.value.split(',').map(s => s.trim()).filter(s => s); 
                            this.requestUpdate(); 
                        }} 
                        ?flush=${true}>
                    </sutram-input>
                ` : html`
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
                        Inheriting: ${globalFallback.length > 0 ? globalFallback.join(', ') : 'None'}
                    </div>
                `}
            </div>
        `;
    }

    constructor() {
        super();
        this.configForm = null;
        this.configMeta = null;
        this._isOpen = false;
        this._editingRepoIdx = null;
        this._generalExpanded = true;
        this._extExpanded = true;
        this._reposExpanded = true;
        this._repoSettingsExpanded = true;
        this._repoBucketsExpanded = true;
        this._expandedBuckets = {};
        this._repoBackup = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, (state) => {
            if (state.isConfigOpen && !this._isOpen) {
                this.openModal();
            } else if (!state.isConfigOpen && this._isOpen) {
                this._isOpen = false;
            }
        });
        this.registerGlobalListener('insetu:config:save', window, () => {
            if (this._isOpen) this._saveConfig();
        });
    }

    onWorkspaceChanged(newWorkspaceId) {
        if (this._isOpen) this.openModal();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
    async _testRepoBucketing(repoIdx, filterBucketId = null) {
        const repo = this.configForm.target_repos[repoIdx];
        try {
            const res = await window.inSetu.api.workspace('system/config/test_bucketing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_cfg: repo })
            });
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

                if (window.inSetu.ui && window.inSetu.ui.viewTextBlob) {
                    window.inSetu.ui.viewTextBlob(`Test Bucketing: ${filterBucketId || repo.repo_dir}`, text, `test_bucketing_${repo.repo_dir}.txt`);
                }
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
            const res = await window.inSetu.api.workspace('system/config?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this.configForm = data.config || {};
                this.configMeta = data.meta || {};
            }
        } catch (e) {
            console.error("Failed to fetch config", e);
        }
    }
    renderSubBuckets(repo, rIdx) {
        const buckets = repo.sub_buckets || [];
        const visibleBuckets = buckets.filter(b => !b.is_system);
        if (visibleBuckets.length === 0) {
            return html`<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No sub-buckets defined.</span>`;
        }
        return buckets.map((b, bIdx) => {
            if (b.is_system) return '';
            const isImplicit = !!b.dynamic_split_prefix;
            const headerTitle = b.title || b.dynamic_split_prefix || `Bucket ${bIdx + 1}`;
            const isExpanded = !!this._expandedBuckets[bIdx]; // Default false
            return html`
                <sutram-collapsible 
                    titleText="📦 ${headerTitle}" 
                    intent="neutral" 
                    .open=${isExpanded} 
                    style="--title-weight: normal; --title-size: 0.95rem;"
                    @sutram-collapsible-toggled=${(e) => {
                        e.stopPropagation();
                        this._expandedBuckets = { ...this._expandedBuckets, [bIdx]: e.detail.open };
                        this.requestUpdate();
                    }}>
                    <div slot="actions" style="display: flex; gap: 8px;">
                        ${!isImplicit ? html`
                            <button class="btn-sm" style="background: var(--input-bg); border: 1px solid var(--border); color: var(--text); margin: 0; padding: 2px 8px; font-size: 0.75rem;"
                                @click=${(e) => {
                                    e.stopPropagation();
                                    this._testRepoBucketing(rIdx, b.id || 'untitled_bucket');
                                }}>🧪 Test</button>
                        ` : ''}
                        <button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 2px 8px; font-size: 0.75rem;"
                            @click=${(e) => {
                                e.stopPropagation();
                                this.configForm.target_repos[rIdx].sub_buckets.splice(bIdx, 1);
                                this.requestUpdate();
                            }}>🗑️ Remove</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <sutram-select 
                                .value=${isImplicit ? 'implicit' : 'explicit'} 
                                .options=${[
                                    { value: 'explicit', label: 'Explicit (Match Prefixes)' },
                                    { value: 'implicit', label: 'Implicit (Dynamic Folders)' }
                                ]}
                                @sutram-input-changed=${(e) => {
                                    if (e.detail.value === 'implicit') {
                                        this.configForm.target_repos[rIdx].sub_buckets[bIdx] = { dynamic_split_prefix: '.', meta_map: {} };
                                    } else {
                                        this.configForm.target_repos[rIdx].sub_buckets[bIdx] = { title: '', match_prefixes: [] };
                                    }
                                    this.requestUpdate();
                                }} ?flush=${true} style="width: 250px;">
                            </sutram-select>
                        </div>
                        ${!isImplicit ? html`
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                            <sutram-input label="Title" .value=${b.title || ''} placeholder="Display Name" @sutram-input-changed=${(e) => { b.title = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-input>
                            <sutram-input label="Domain" .value=${b.domain || ''} placeholder="Category" @sutram-input-changed=${(e) => { b.domain = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-input>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                            <sutram-input label="Description" .value=${b.description || ''} placeholder="What goes here?" @sutram-input-changed=${(e) => { b.description = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 200px;"></sutram-input>
                        </div>
                        <sutram-input label="Match Prefixes (comma separated)" .value=${(b.match_prefixes || []).join(', ')} placeholder="path/to/folder, other/path" @sutram-input-changed=${(e) => { b.match_prefixes = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }}></sutram-input>
                    ` : html`
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <sutram-input label="Dynamic Split Prefix" .value=${b.dynamic_split_prefix || ''} placeholder="e.g. . or docs/" @sutram-input-changed=${(e) => { b.dynamic_split_prefix = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-input>
                            <sutram-input label="Shared Base Domain" .value=${b.domain || ''} placeholder="e.g. Dynamic Modules" @sutram-input-changed=${(e) => { b.domain = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-input>
                        </div>
                        <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <label style="font-size: 0.85rem; font-weight: bold; color:var(--text-muted);">Meta Map (Folder Overrides)</label>
                                <button class="btn-sm" style="background: var(--intent-primary); color: white; border: none; font-weight: bold; border-radius: 4px;" @click=${() => {
                                    if (!b.meta_map) b.meta_map = {};
                                    const nextIdx = Object.keys(b.meta_map).filter(k => k.startsWith('new_folder_')).length + 1;
                                    b.meta_map[`new_folder_${nextIdx}`] = { title: '', domain: '' };
                                    this.requestUpdate();
                                }}>➕ Folder Meta</button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${Object.keys(b.meta_map || {}).map(dirKey => {
                                    const meta = b.meta_map[dirKey];
                                    return html`
                                        <div style="display: flex; gap: 8px; align-items: center; background: var(--bg); padding: 8px 10px; border-radius: 6px; flex-wrap: wrap; border: 1px solid var(--border);">
                                            <sutram-input .value=${dirKey} placeholder="Folder Name" @sutram-input-changed=${(e) => {
                                                const newKey = e.detail.value;
                                                if (newKey && newKey !== dirKey && !b.meta_map[newKey]) {
                                                    b.meta_map[newKey] = b.meta_map[dirKey];
                                                    delete b.meta_map[dirKey];
                                                    this.requestUpdate();
                                                }
                                            }} ?flush=${true} style="flex: 1; min-width: 120px;"></sutram-input>
                                            <sutram-input .value=${meta.title || ''} placeholder="Title" @sutram-input-changed=${(e) => { meta.title = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 120px;"></sutram-input>
                                            <sutram-input .value=${meta.domain || ''} placeholder="Domain" @sutram-input-changed=${(e) => { meta.domain = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 120px;"></sutram-input>
                                            <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; font-size: 1.2rem; padding: 0 8px; flex-shrink: 0; cursor: pointer;" @click=${() => {
                                                delete b.meta_map[dirKey];
                                                this.requestUpdate();
                                            }}>✕</button>
                                        </div>
                                    `;
                                })}
                            </div>
                        </div>
                    `}
                    <div style="display: flex; gap: 15px; flex-wrap: wrap; padding: 12px 15px; background: var(--bg); border-radius: 6px; border: 1px solid var(--border); align-items: center; margin-top: 10px;">
                        ${(() => {
                            const templates = [];
                            if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
                                window.ExtensionRegistry._manifests.forEach((manifest, extName) => {
                                    if (!window.inSetu.isCore(extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(extName)) return;
                                    if (manifest.bucketConfigOptions) {
                                        manifest.bucketConfigOptions
                                            .sort((a, b) => (a.order || 50) - (b.order || 50))
                                            .forEach(opt => {
                                                if (opt.component) {
                                                    templates.push(opt.component({ bucket: b, repoDir: repo.repo_dir, updateCallback: () => this.requestUpdate() }));
                                                }
                                            });
                                    }
                                });
                            }
                            return templates;
                        })()}
                    </div>
                    </div>
                </sutram-collapsible>
            `;
        });
    }
    renderRepos() {
        if (!this.configForm) return '';
        const repos = this.configForm.target_repos || [];
        return html`
            <div style="padding: 15px;">
                <sutram-card-group>
                    ${repos.map((repo, idx) => html`
                        <insetu-card
                            titleText=${repo.repo_dir || 'New Repository'}
                            descriptionText=${repo.title || 'No Title'}
                            detailText=${repo.domain || 'Workspaces'}
                            icon="📦"
                            intentColor="var(--intent-highlight)"
                            has-actions
                            ?disableSelection=${true}
                            style="cursor: pointer;"
                            @click=${() => { 
                                this._repoBackup = JSON.parse(JSON.stringify(repo)); 
                                this._editingRepoIdx = idx; 
                            }}>
                            <div slot="actions" style="display: flex; gap: 8px;">
                                <button class="btn-sm" style="background: var(--intent-primary);" @click=${(e) => { 
                                    e.stopPropagation(); 
                                    this._repoBackup = JSON.parse(JSON.stringify(repo)); 
                                    this._editingRepoIdx = idx; 
                                }}>✏️ Edit</button>
                                <button class="btn-sm" style="background: var(--intent-danger);" @click=${(e) => {
                                    e.stopPropagation();
                                    if(confirm("Remove this repository from tracking?")) {
                                        this.configForm.target_repos.splice(idx, 1);
                                        this.requestUpdate();
                                    }
                                }}>🗑️ Remove</button>
                            </div>
                        </insetu-card>
                    `)}
                </sutram-card-group>
            </div>
        `;
    }
    renderRepoEditorModal() {
        const idx = this._editingRepoIdx;
        const repo = (idx !== null && this.configForm) ? this.configForm.target_repos[idx] : null;
        const isOpen = idx !== null && repo !== null;
        return html`
            <sutram-modal 
                ?open=${isOpen} 
                titleText="Edit Repository: ${repo ? (repo.repo_dir || 'New') : ''}" 
                ?fullscreen=${true}
                ?flush=${true}
                @sutram-modal-closed=${() => { 
                    if (this._repoBackup && this._editingRepoIdx !== null) {
                        this.configForm.target_repos[this._editingRepoIdx] = JSON.parse(JSON.stringify(this._repoBackup));
                    }
                    this._editingRepoIdx = null; 
                    this._repoBackup = null;
                    this.requestUpdate();
                }}>
                <div slot="body" style="display: flex; flex-direction: column;">
                    ${repo ? html`
                    <div style="padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: var(--bg);">
                        <span style="font-size: 1.4rem;">📦</span>
                        <sutram-input .value=${repo.repo_dir || ''} placeholder="Directory Name (e.g. my-repo)" style="flex: 1; margin: 0; --bg-input: var(--input-bg);" @sutram-input-changed=${(e) => { repo.repo_dir = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-input>
                    </div>
                    <sutram-collapsible 
                        titleText="Bucket 0 (Base Pipeline)" 
                        intent="primary"
                        .open=${this._repoSettingsExpanded}
                        @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._repoSettingsExpanded = e.detail.open; }}>
                        <div slot="actions" style="display: flex; gap: 8px;">
                            <button class="btn-sm" style="background: var(--input-bg); border: 1px solid var(--border); color: var(--text); margin: 0; padding: 4px 10px; font-size: 0.75rem;" @click=${(e) => {
                                e.stopPropagation();
                                this._testRepoBucketing(idx);
                            }}>🧪 Test All Buckets</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 0;">Files not captured by explicit sub-buckets automatically fall into this baseline group.</p>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <sutram-input label="Title" .value=${repo.title || ''} placeholder="Display Title" @sutram-input-changed=${(e) => { repo.title = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-input>
                                <sutram-input label="Domain" .value=${repo.domain || ''} placeholder="Category" @sutram-input-changed=${(e) => { repo.domain = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-input>
                                <sutram-select label="Archive Type" .value=${repo.archive_type || 'repo'} .options=${[
                                    { value: 'repo', label: 'Standard Repo' },
                                    { value: 'media-vault', label: 'Media Vault' },
                                    ...(repo.archive_type && repo.archive_type !== 'repo' && repo.archive_type !== 'media-vault' ? [{ value: repo.archive_type, label: repo.archive_type }] : [])
                                ]} @sutram-input-changed=${(e) => { repo.archive_type = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 150px;"></sutram-select>
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <sutram-input label="Physical Path (Optional Override)" .value=${repo.physical_path || ''} placeholder="/absolute/path/to/repo" @sutram-input-changed=${(e) => { repo.physical_path = e.detail.value; this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 200px;"></sutram-input>
                            </div>
                            ${this._renderOverrideToggle(repo, 'exts', 'Tracked Extensions', (this.configForm.include_extensions || []))}
                            ${this._renderOverrideToggle(repo, 'repo_ignore_dirs', 'Ignore Directories', (this.configForm.ignore_dirs || []))}
                            ${this._renderOverrideToggle(repo, 'repo_ignore_files', 'Ignore Files', (this.configForm.ignore_files || []))}
                            ${this._renderOverrideToggle(repo, 'repo_ignore_patterns', 'Ignore Patterns', (this.configForm.ignore_patterns || []))}

                            <sutram-input label="Ignore Exceptions (comma separated prefixes)" .value=${(repo.ignore_exceptions || []).join(', ')} placeholder="docs/archived/, .tracker/" @sutram-input-changed=${(e) => { repo.ignore_exceptions = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }} ?flush=${true}></sutram-input>

                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <sutram-input label="Force Include Files (comma separated)" .value=${(repo.force_include || []).join(', ')} placeholder="docs/todos.md" @sutram-input-changed=${(e) => { repo.force_include = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 200px;"></sutram-input>
                                <sutram-input label="Managed Dirs (Cartographer Labels)" .value=${(repo.repo_managed_dirs || []).join(', ')} placeholder="adrs, standups" @sutram-input-changed=${(e) => { repo.repo_managed_dirs = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }} ?flush=${true} style="flex: 1; min-width: 200px;"></sutram-input>
                            </div>

                            <sutram-input label="Path Prefix (Virtual Root Restriction)" .value=${repo.prefix || ''} placeholder="src/frontend/" @sutram-input-changed=${(e) => { repo.prefix = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-input>

                            <div style="display: flex; gap: 15px; flex-wrap: wrap; padding: 12px 15px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border); align-items: center;">
                                <sutram-toggle label="Apply Ignore Rules" .checked=${repo.apply_ignore !== false} @sutram-input-changed=${(e) => { repo.apply_ignore = e.detail.value; this.requestUpdate(); }} ?flush=${true}></sutram-toggle>
                                ${(() => {
                                    const templates = [];
                                    if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
                                        window.ExtensionRegistry._manifests.forEach((manifest, extName) => {
                                            if (!window.inSetu.isCore(extName) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(extName)) return;
                                            if (manifest.repoConfigOptions) {
                                                manifest.repoConfigOptions
                                                    .sort((a, b) => (a.order || 50) - (b.order || 50))
                                                    .forEach(opt => {
                                                        if (opt.component) {
                                                            templates.push(opt.component({ repo, updateCallback: () => this.requestUpdate() }));
                                                        }
                                                    });
                                            }
                                        });
                                    }
                                    return templates;
                                })()}
                            </div>
                        </div>
                    </sutram-collapsible>
                    <sutram-collapsible 
                        titleText="Sub-Buckets" 
                        intent="highlight" 
                        ?flush=${true}
                        .open=${this._repoBucketsExpanded}
                        @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._repoBucketsExpanded = e.detail.open; }}>
                        <div slot="actions" style="display: flex; gap: 8px;">
                            <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 4px 10px; font-size: 0.75rem;" @click=${(e) => {
                                e.stopPropagation();
                                if (!repo.sub_buckets) repo.sub_buckets = [];
                                repo.sub_buckets.push({ title: '', match_prefixes: [] });
                                this.requestUpdate();
                            }}>➕ Add Bucket</button>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            ${this.renderSubBuckets(repo, idx)}
                        </div>
                    </sutram-collapsible>
                    ` : ''}
                </div>
                ${repo ? html`
                    <button slot="footer" style="background: var(--intent-neutral); color: white;" @click=${() => { 
                        if (this._repoBackup && this._editingRepoIdx !== null) {
                            this.configForm.target_repos[this._editingRepoIdx] = JSON.parse(JSON.stringify(this._repoBackup));
                        }
                        this._editingRepoIdx = null;
                        this._repoBackup = null;
                        this.requestUpdate();
                    }}>
                        ❌ Cancel
                    </button>
                    <button slot="footer" style="background: var(--intent-success); color: white;" @click=${() => { 
                        this._repoBackup = null;
                        this._editingRepoIdx = null;
                        this.requestUpdate();
                    }}>
                        ✅ Keep Edits
                    </button>
                ` : ''}
            </sutram-modal>
        `;
    }

    render() {
        const bodyContent = !this.configForm 
            ? html`<div class="spinner" style="display:block; padding: 20px;">Loading configuration...</div>`
            : html`
                <div style="display: flex; flex-direction: column;">
                    <sutram-collapsible 
                        titleText="Global Ignore Rules" 
                        intent="neutral"
                        .open=${this._generalExpanded}
                        @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._generalExpanded = e.detail.open; }}>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <div style="flex: 1; min-width: 200px;">
                                    <sutram-input label="Global Ignore Directories" .value=${(this.configForm.ignore_dirs || []).join(', ')} placeholder="node_modules, build" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, ignore_dirs: arr }; }}></sutram-input>
                                    <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8; display: block; margin-top: -12px; margin-bottom: 8px;">Completely ignored by the VFS (e.g. node_modules).</span>
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <sutram-input label="Global Ignore Files" .value=${(this.configForm.ignore_files || []).join(', ')} placeholder=".DS_Store" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, ignore_files: arr }; }}></sutram-input>
                                    <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8; display: block; margin-top: -12px; margin-bottom: 8px;">Exact filenames to completely ignore.</span>
                                </div>
                            </div>

                            <div>
                                <sutram-input label="Global Ignore Patterns" .value=${(this.configForm.ignore_patterns || []).join(', ')} placeholder="*.log, cache_*" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, ignore_patterns: arr }; }}></sutram-input>
                                <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8; display: block; margin-top: -12px; margin-bottom: 8px;">Wildcard substring matches to completely ignore (e.g. *.log).</span>
                            </div>

                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <div style="flex: 1; min-width: 200px;">
                                    <sutram-input label="Global Allowed Extensions" .value=${(this.configForm.include_extensions || []).join(', ')} placeholder=".py, .js, .md" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(s => s !== null && s !== undefined); this.configForm = { ...this.configForm, include_extensions: arr }; }}></sutram-input>
                                    <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8; display: block; margin-top: -12px; margin-bottom: 8px;">Merged with repo-specific extensions across all repos.</span>
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <sutram-input label="Exempted Managed Directories" .value=${(this.configForm.managed_dirs || []).join(', ')} placeholder=".tracker" @sutram-input-changed=${(e) => { const arr = e.detail.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, managed_dirs: arr }; }}></sutram-input>
                                    <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8; display: block; margin-top: -12px; margin-bottom: 8px;">System folders to exclude from context payloads and diffs.</span>
                                </div>
                            </div>
                        </div>
                    </sutram-collapsible>
                    <sutram-collapsible 
                        titleText="Target Repositories"  
                        intent="primary"
                        .open=${this._reposExpanded}
                        @sutram-collapsible-toggled=${(e) => { if (e.target === e.currentTarget) this._reposExpanded = e.detail.open; }}>
                        <div slot="actions">
                            <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 4px 10px; font-size: 0.75rem;"
                                @click=${async () => {
                                    if (!this.configForm.target_repos) this.configForm.target_repos = [];

                                    let newRepo = {    
                                        repo_dir: '', title: '', domain: 'Workspaces', 
                                        exts: ['.py', '.json', '.md', '.txt'], apply_ignore: true, sub_buckets: [] 
                                    };
                                    try {
                                        const res = await window.inSetu.api.workspace('gather/repos/template');
                                        if (res.ok) newRepo = await res.json();
                                    } catch(e) {}
                                        this.configForm.target_repos.push(newRepo);
                                        this.requestUpdate();
                                }}>➕ Add Repository</button>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">Repositories dynamically map contexts and define your active multi-tenant workspace environments.</p>
                        ${this.renderRepos()}
                    </sutram-collapsible>
                </div>
            `;

        return html`
            ${this.renderRepoEditorModal()}
            <sutram-modal 
                ?open=${this._isOpen} 
                titleText="Workspace Manager" 
                ?fullscreen=${true} 
                ?flush=${true}
                @sutram-modal-closed=${() => { this._isOpen = false; AppStore.setState({ isConfigOpen: false }); }}>
                <div slot="body">${bodyContent}</div>
                <sutram-async-btn slot="footer" label="💾 Save & Remap Disk" intent="primary" .onClick=${this._saveConfig.bind(this)}></sutram-async-btn>
            </sutram-modal>
        `;
    }

    async _saveConfig() {
        try {
            // Config saves utilize explicit multi-tenant URL path boundaries
            const res = await window.inSetu.api.workspace('system/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.configForm)
            });

            if (res.ok) {
                const data = await res.json();
                if (window.inSetu.sys.executeSystemCompile) {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus("⏳ Re-indexing...", null);
                    await window.inSetu.sys.executeSystemCompile(null, true);
                }
                if (data.requires_reboot) {
                    // Declarative UI State Transition
                    AppStore.setState({ isRebooting: true, rebootType: 'reboot' });

                    try {
                        await window.inSetu.api.system('reboot', { method: 'POST' });
                    } catch(err) {}
                    setInterval(async () => {
                        try {
                            const ping = await fetch('/?t=' + Date.now(), { cache: 'no-store' });
                            if (ping.ok) window.location.reload();
                        } catch(err) {}
                    }, 1000);

                    // Stall the promise so the async button remains in the loading state through reboot
                    await new Promise(() => {});
                } else {
                    this._isOpen = false;
                    AppStore.setState({ isConfigOpen: false });

                    if (window.inSetu.sys.performSoftRefresh) {
                        await window.inSetu.sys.performSoftRefresh();
                    } else {
                        window.location.reload();
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

// Instantiated once as a persistent background event substrate on extension script load
if (!document.getElementById('insetu-config-root')) {
    const root = document.createElement('insetu-ext-config');
    root.id = 'insetu-config-root';
    document.body.appendChild(root);
}

// --- DECLARATIVE SCHEMA PAYLOAD ---
window.ExtensionRegistry.registerExtension('config', {
    name: "Workspace Configuration",
    version: "2.0.0",
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
            targetEntity: 'system_control',
            id: 'sys-refresh-files',
            label: 'Refresh Files',
            icon: '⚙️',
            intent: 'primary',
            order: 10,
            asyncAction: async (data, e) => {
                if (window.inSetu.sys.executeSystemCompile) {
                    await window.inSetu.sys.executeSystemCompile(null, true);
                }
            }
        },
        {
            targetEntity: 'system_control',
            id: 'sys-reboot',
            label: 'Reboot',
            icon: '🔄',
            intent: 'success',
            order: 20,
            asyncAction: async (data, e) => {
                if (!confirm("Reboot the inSetu OS daemon?")) return;
                if (data && data.closeModal) data.closeModal();
                AppStore.setState({ isRebooting: true, rebootType: 'reboot' });
                try {
                    await window.inSetu.api.system('reboot', { method: 'POST' });
                    setInterval(async () => {
                        try {
                            const ping = await fetch('/?t=' + Date.now(), { cache: 'no-store' });
                            if (ping.ok) window.location.reload();
                        } catch(err) {}
                    }, 1000);
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
            icon: '⚠️',
            intent: 'warning',
            order: 30,
            onClick: (data, e) => {
                if (data && data.closeModal) data.closeModal();
                if (window.inSetu.sys.simulatePanic) window.inSetu.sys.simulatePanic();
            }
        }
    ],
    settingsActions: [
        {
            id: 'workspaces_editor',
            label: 'Add / Remove Workspaces',
            icon: '🗃️',
            onClick: () => {
                AppStore.setState({ isWorkspaceEditorOpen: true });
            }
        },
        {
            id: 'config_editor',
            label: 'Configure Current Workspace',
            icon: '🛠️',
            onClick: () => {
                AppStore.setState({ isConfigOpen: true });
            }
        }
    ]
});