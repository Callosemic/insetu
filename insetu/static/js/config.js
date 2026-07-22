// config.js - Core OS Workspace Configuration Editor
import { html, css } from 'lit';
import { AppStore } from './store.js';
import { InSetuElement } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
export class InSetuExtConfig extends InSetuElement {
    static properties = {
        configForm: { type: Object },
        configMeta: { type: Object },
        _isOpen: { type: Boolean },
        _generalExpanded: { type: Boolean },
        _extExpanded: { type: Boolean },
        _reposExpanded: { type: Boolean }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.configForm = null;
        this.configMeta = null;
        this._isOpen = false;
        this._generalExpanded = true;
        this._extExpanded = true;
        this._reposExpanded = true;
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
    }

    onWorkspaceChanged(newWorkspaceId) {
        if (this._isOpen) this.openModal();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
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
    renderExtensions() {
        if (!this.configForm) return '';
        const knownExtensions = this.configMeta?.available_extensions || [];
        const activeExtensions = this.configForm.extensions || ['config'];

        // Merge known objects with raw active strings (for missing/deleted extensions)
        const extMap = new Map();
        knownExtensions.forEach(ext => extMap.set(ext.id, ext));
        activeExtensions.forEach(extId => {
            if (!extMap.has(extId)) {
                if (extId === 'config') {
                    extMap.set(extId, { id: extId, title: 'Workspace Configuration', description: 'Core system settings and repository management UI.' });
                } else {
                    extMap.set(extId, { id: extId, title: extId, description: "Unknown or missing extension." });
                }
            }
        });

        const allExtensions = Array.from(extMap.values()).sort((a, b) => a.title.localeCompare(b.title));

        return html`
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${allExtensions.map(ext => {
                    const isConfig = ext.id === 'config';
                    const isChecked = activeExtensions.includes(ext.id) || isConfig;
                    return html`
                        <div style="display: flex; flex-direction: column; gap: 4px; background: var(--bg); padding: 10px 12px; border: 1px solid var(--border); border-radius: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="ext_chk_${ext.id}" .checked=${isChecked} ?disabled=${isConfig} @change=${(e) => {
                                    const current = this.configForm.extensions || [];
                                    const newExts = e.target.checked 
                                        ? (current.includes(ext.id) ? current : [...current, ext.id])
                                        : current.filter(x => x !== ext.id);

                                    this.configForm = { ...this.configForm, extensions: newExts };
                                }}>
                                <label for="ext_chk_${ext.id}" style="font-size: 0.95rem; color: ${isConfig ? 'var(--text-muted)' : 'var(--text)'}; cursor: pointer;"><b>${ext.id}</b>: ${ext.title}</label>
                            </div>
                            ${ext.description ? html`<div style="font-size: 0.8rem; color: var(--text-muted); margin-left: 26px;">${ext.description}</div>` : ''}
                            ${(ext.missing_externals && ext.missing_externals.length > 0) ? html`
                                <div style="font-size: 0.8rem; color: var(--intent-warning); font-weight: bold; margin-left: 26px; margin-top: 4px;">
                                    ⚠️ Missing dependencies. Run: <code style="background: var(--bg); padding: 2px 4px; border: 1px solid var(--border); border-radius: 3px; color: var(--text);">pip install ${ext.missing_externals.join(' ')}</code>
                                </div>
                            ` : ''}
                        </div>
                    `;
                })}
            </div>
        `;
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
            return html`
                <div style="background: var(--bg); border: 1px solid var(--border); padding: 10px; border-radius: 4px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <select style="padding: 4px; font-size: 0.8rem; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); width: 200px;"
                            @change=${(e) => {
                                if (e.target.value === 'implicit') {
                                    this.configForm.target_repos[rIdx].sub_buckets[bIdx] = { dynamic_split_prefix: '.', meta_map: {} };
                                } else {
                                    this.configForm.target_repos[rIdx].sub_buckets[bIdx] = { title: '', match_prefixes: [] };
                                }
                                this.requestUpdate();
                            }}>
                            <option value="explicit" ?selected=${!isImplicit}>Explicit (Match Prefixes)</option>
                            <option value="implicit" ?selected=${isImplicit}>Implicit (Dynamic Folders)</option>
                        </select>
                        <button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 2px 8px; font-size: 0.75rem;"
                            @click=${() => {
                                this.configForm.target_repos[rIdx].sub_buckets.splice(bIdx, 1);
                                this.requestUpdate();
                            }}>🗑️</button>
                    </div>
                    ${!isImplicit ? html`
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Title</label><input type="text" .value=${b.title || ''} placeholder="Display Name" @input=${(e) => { b.title = e.target.value; this.requestUpdate(); }}></div>
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Domain</label><input type="text" .value=${b.domain || ''} placeholder="Category" @input=${(e) => { b.domain = e.target.value; this.requestUpdate(); }}></div>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="flex: 2;"><label style="font-size: 0.75rem; color:var(--text-muted);">Description</label><input type="text" .value=${b.description || ''} placeholder="What goes here?" @input=${(e) => { b.description = e.target.value; this.requestUpdate(); }}></div>
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Custom Out File</label><input type="text" .value=${b.out_file || ''} placeholder="out_context.txt" @input=${(e) => { b.out_file = e.target.value; this.requestUpdate(); }}></div>
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color:var(--text-muted);">Match Prefixes (comma separated)</label>
                            <input type="text" .value=${(b.match_prefixes || []).join(', ')} placeholder="path/to/folder, other/path" @input=${(e) => { b.match_prefixes = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }}>
                        </div>
                        <div style="margin-top: 5px;">
                            <label style="font-size: 0.8rem; color: var(--text); cursor: pointer;"><input type="checkbox" .checked=${!!b.is_catch_all} @change=${(e) => { b.is_catch_all = e.target.checked; this.requestUpdate(); }}> Designate as Catch-All Bucket</label>
                        </div>
                    ` : html`
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="flex: 1;">
                                <label style="font-size: 0.75rem; color:var(--text-muted);">Dynamic Split Prefix</label>
                                <input type="text" .value=${b.dynamic_split_prefix || ''} placeholder="e.g. . or docs/" @input=${(e) => { b.dynamic_split_prefix = e.target.value; this.requestUpdate(); }}>
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 0.75rem; color:var(--text-muted);">Shared Base Domain</label>
                                <input type="text" .value=${b.domain || ''} placeholder="e.g. Dynamic Modules" @input=${(e) => { b.domain = e.target.value; this.requestUpdate(); }}>
                            </div>
                        </div>
                        <div style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <label style="font-size: 0.75rem; color:var(--text-muted);">Meta Map (Folder Overrides)</label>
                                <button class="btn-sm" style="background: var(--intent-primary);" @click=${() => {
                                    if (!b.meta_map) b.meta_map = {};
                                    const nextIdx = Object.keys(b.meta_map).filter(k => k.startsWith('new_folder_')).length + 1;
                                    b.meta_map[`new_folder_${nextIdx}`] = { title: '', domain: '' };
                                    this.requestUpdate();
                                }}>+ Folder Meta</button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                ${Object.keys(b.meta_map || {}).map(dirKey => {
                                    const meta = b.meta_map[dirKey];
                                    return html`
                                        <div style="display: flex; gap: 5px; align-items: center; background: var(--bg); padding: 5px; border-radius: 4px; flex-wrap: wrap; border: 1px solid var(--border);">
                                            <input type="text" .value=${dirKey} placeholder="Folder Name" style="flex: 1; min-width: 100px;" @change=${(e) => {
                                                const newKey = e.target.value;
                                                if (newKey && newKey !== dirKey && !b.meta_map[newKey]) {
                                                    b.meta_map[newKey] = b.meta_map[dirKey];
                                                    delete b.meta_map[dirKey];
                                                    this.requestUpdate();
                                                }
                                            }}>
                                            <input type="text" .value=${meta.title || ''} placeholder="Title" style="flex: 1; min-width: 100px;" @input=${(e) => { meta.title = e.target.value; this.requestUpdate(); }}>
                                            <input type="text" .value=${meta.domain || ''} placeholder="Domain" style="flex: 1; min-width: 100px;" @input=${(e) => { meta.domain = e.target.value; this.requestUpdate(); }}>
                                            <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; font-size: 1.2rem; padding: 0 5px;" @click=${() => {
                                                delete b.meta_map[dirKey];
                                                this.requestUpdate();
                                            }}>×</button>
                                        </div>
                                    `;
                                })}
                            </div>
                        </div>
                    `}
                </div>
            `;
        });
    }
    renderRepos() {
        if (!this.configForm) return '';
        const repos = this.configForm.target_repos || [];
        return repos.map((repo, idx) => html`
            <div class="file-card" style="display: flex; flex-direction: column; gap: 10px; background: var(--bg);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                    <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem;">📦</span>
                        <input type="text" .value=${repo.repo_dir || ''} placeholder="Directory Name (e.g. my-repo)" style="font-weight: bold; width: 60%; background: var(--input-bg);" @input=${(e) => { repo.repo_dir = e.target.value; this.requestUpdate(); }}>
                    </div>
                    <button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 4px 8px;" @click=${() => {
                        if(confirm("Remove this repository from tracking?")) {
                            this.configForm.target_repos.splice(idx, 1);
                            this.requestUpdate();
                        }
                    }}>🗑️ Remove</button>
                </div>

                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                    <div style="flex: 1; min-width: 150px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Title</label>
                        <input type="text" .value=${repo.title || ''} placeholder="Display Title" @input=${(e) => { repo.title = e.target.value; this.requestUpdate(); }}>
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Domain</label>
                        <input type="text" .value=${repo.domain || ''} placeholder="Category" @input=${(e) => { repo.domain = e.target.value; this.requestUpdate(); }}>
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Archive Type</label>
                        <select style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border);" @change=${(e) => { repo.archive_type = e.target.value; this.requestUpdate(); }}>
                            <option value="repo" ?selected=${repo.archive_type === 'repo' || !repo.archive_type}>Standard Repo</option>
                            <option value="media-vault" ?selected=${repo.archive_type === 'media-vault'}>Media Vault</option>
                            ${(repo.archive_type && repo.archive_type !== 'repo' && repo.archive_type !== 'media-vault') ? html`<option value="${repo.archive_type}" selected>${repo.archive_type}</option>` : ''}
                        </select>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Physical Path (Optional Override)</label>
                        <input type="text" .value=${repo.physical_path || ''} placeholder="/absolute/path/to/repo" @input=${(e) => { repo.physical_path = e.target.value; this.requestUpdate(); }}>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Custom Out File (Optional)</label>
                        <input type="text" .value=${repo.out_file || ''} placeholder="custom_context.txt" @input=${(e) => { repo.out_file = e.target.value; this.requestUpdate(); }}>
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Tracked Extensions (comma separated)</label>
                    <input type="text" .value=${(repo.exts || []).join(', ')} placeholder=".py, .js, .md" @input=${(e) => { repo.exts = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }}>
                </div>

                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Ignore Directories (comma separated)</label>
                        <input type="text" .value=${(repo.repo_ignore_dirs || []).join(', ')} placeholder="node_modules, build" @input=${(e) => { repo.repo_ignore_dirs = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }}>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Ignore Files (comma separated)</label>
                        <input type="text" .value=${(repo.repo_ignore_files || []).join(', ')} placeholder="package-lock.json" @input=${(e) => { repo.repo_ignore_files = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }}>
                    </div>
                </div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border-radius: 4px; border: 1px solid var(--border);">
                    <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" .checked=${!!repo.exclude_from_context} @change=${(e) => { repo.exclude_from_context = e.target.checked; this.requestUpdate(); }}> Exclude from Context Compilation</label>
                    ${(() => {
                        const templates = [];
                        if (window.ExtensionRegistry?.uiHooks && window.ExtensionRegistry.uiHooks['zone:repo-config-options']) {
                            for (let cb of window.ExtensionRegistry.uiHooks['zone:repo-config-options']) {
                                const res = cb({ repo, updateCallback: () => this.requestUpdate() });
                                if (res) templates.push(res);
                            }
                        }
                        return templates;
                    })()}
                </div>
                <div style="background: var(--input-bg); padding: 10px; border-radius: 4px; border: 1px solid var(--border); margin-top: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label style="font-size: 0.85rem; font-weight: bold; color: var(--intent-highlight);">Sub-Buckets</label>
                        <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 2px 8px; font-size: 0.75rem;" @click=${() => {
                            if (!repo.sub_buckets) repo.sub_buckets = [];
                            repo.sub_buckets.push({ title: '', match_prefixes: [] });
                            this.requestUpdate();
                        }}>➕ Add Bucket</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${this.renderSubBuckets(repo, idx)}
                    </div>
                </div>
            </div>
        `);
    }
    render() {
        const bodyContent = !this.configForm 
            ? html`<div class="spinner" style="display:block;">Loading configuration...</div>`
            : html`
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; flex-direction: column;">
                        <div @click=${() => this._generalExpanded = !this._generalExpanded} style="background: var(--input-bg); padding: 12px 20px; margin: -20px -20px ${this._generalExpanded ? '15px' : '0'} -20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                            <span style="font-weight: bold; font-size: 1rem; color: var(--intent-success);">General Settings</span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${this._generalExpanded ? '▼' : '▶'}</span>
                        </div>
                        <div style="display: ${this._generalExpanded ? 'flex' : 'none'}; flex-direction: column; gap: 12px; padding-bottom: 20px;">
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <div style="flex: 2; min-width: 200px;">
                                    <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold;">Workspace Title</label>
                                    <input type="text" .value=${this.configForm.instance_title || ''} placeholder="e.g., My Project OS" @input=${(e) => { this.configForm = { ...this.configForm, instance_title: e.target.value }; }}>
                                </div>
                                <div style="flex: 1; min-width: 80px;">
                                    <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold;">Menu Emoji</label>
                                    <input type="text" .value=${this.configForm.instance_emoji || ''} placeholder="⚙️" @input=${(e) => { this.configForm = { ...this.configForm, instance_emoji: e.target.value }; }}>
                                </div>
                            </div>
                            <div style="margin-bottom: 4px; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px;">
                                <label style="font-size: 0.85rem; color: var(--text); font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                                    <input type="checkbox" style="transform: scale(1.2); cursor: pointer;" 
                                        .checked=${this.configForm.track_os !== false} 
                                        @change=${(e) => { this.configForm = { ...this.configForm, track_os: e.target.checked }; }}>
                                    Track inSetu OS (.insetu)
                                </label>
                                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 4px; margin-left: 26px;">Maps the underlying system directory to natively manage prompts and internal state tracking.</span>
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <div style="flex: 1; min-width: 200px;">
                                    <div style="margin-bottom: 4px;">
                                        <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; display: block;">Global Ignore Directories</label>
                                        <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">Completely ignored by the VFS (e.g. node_modules).</span>
                                    </div>
                                    <input type="text" .value=${(this.configForm.ignore_dirs || []).join(', ')} placeholder="node_modules, build" @input=${(e) => { const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, ignore_dirs: arr }; }}>
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <div style="margin-bottom: 4px;">
                                        <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; display: block;">Global Ignore Files</label>
                                        <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">Exact filenames to completely ignore.</span>
                                    </div>
                                    <input type="text" .value=${(this.configForm.ignore_files || []).join(', ')} placeholder=".DS_Store" @input=${(e) => { const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, ignore_files: arr }; }}>
                                </div>
                            </div>

                            <div>
                                <div style="margin-bottom: 4px;">
                                    <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; display: block;">Global Ignore Patterns</label>
                                    <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">Wildcard substring matches to completely ignore (e.g. *.log).</span>
                                </div>
                                <input type="text" .value=${(this.configForm.ignore_patterns || []).join(', ')} placeholder="*.log, cache_*" @input=${(e) => { const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, ignore_patterns: arr }; }}>
                            </div>

                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <div style="flex: 1; min-width: 200px;">
                                    <div style="margin-bottom: 4px;">
                                        <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; display: block;">Global Allowed Extensions</label>
                                        <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">Merged with repo-specific extensions across all repos.</span>
                                    </div>
                                    <input type="text" .value=${(this.configForm.include_extensions || []).join(', ')} placeholder=".py, .js, .md" @input=${(e) => { const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, include_extensions: arr }; }}>
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <div style="margin-bottom: 4px;">
                                        <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; display: block;">Exempted Managed Directories</label>
                                        <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">System folders to exclude from context payloads and diffs.</span>
                                    </div>
                                    <input type="text" .value=${(this.configForm.managed_dirs || []).join(', ')} placeholder=".tracker" @input=${(e) => { const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.configForm = { ...this.configForm, managed_dirs: arr }; }}>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column;">
                        <div @click=${() => this._extExpanded = !this._extExpanded} style="background: var(--input-bg); padding: 12px 20px; margin: 0 -20px ${this._extExpanded ? '15px' : '0'} -20px; border-bottom: 1px solid var(--border); border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                            <span style="font-weight: bold; font-size: 1rem; color: var(--intent-highlight);">Active Extensions</span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${this._extExpanded ? '▼' : '▶'}</span>
                        </div>
                        <div style="display: ${this._extExpanded ? 'block' : 'none'}; padding-bottom: 20px;">
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">Enable or disable system extensions. The 'config' extension is locked.</p>
                            ${this.renderExtensions()}
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column;">
                        <div @click=${() => this._reposExpanded = !this._reposExpanded} style="background: var(--input-bg); padding: 12px 20px; margin: 0 -20px ${this._reposExpanded ? '15px' : '0'} -20px; border-bottom: 1px solid var(--border); border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                            <span style="font-weight: bold; font-size: 1rem; color: var(--intent-primary);">Target Repositories</span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${this._reposExpanded ? '▼' : '▶'}</span>
                        </div>
                        <div style="display: ${this._reposExpanded ? 'block' : 'none'};">
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">Repositories dynamically map contexts and define your active multi-tenant workspace environments.</p>
                            <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;">
                                ${this.renderRepos()}
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button class="btn-sm" style="background: var(--intent-primary); margin: 0;"
                                    @click=${async () => {
                                        if (!this.configForm.target_repos) this.configForm.target_repos = [];

                                        let newRepo = {    
                                        repo_dir: '', title: '', domain: 'Workspaces', 
                                        exts: ['.py', '.json', '.md', '.txt'], apply_ignore: true, sub_buckets: [] 
                                    };

                                    try {
                                        const res = await window.inSetu.api.system('repos/template');
                                        if (res.ok) newRepo = await res.json();
                                    } catch(e) {}
                                        this.configForm.target_repos.push(newRepo);
                                        this.requestUpdate();
                                        setTimeout(() => {
                                            const modal = this.shadowRoot.querySelector('insetu-modal');
                                            const container = modal?.shadowRoot?.querySelector('.body');
                                            if (container) container.scrollTo(0, container.scrollHeight);
                                        }, 50);
                                    }}>➕ Add Repository</button>
                            </div>
                        </div>
            `;
        return html`
            <insetu-modal 
                ?open=${this._isOpen} 
                titleText="Workspace Configuration" 
                maxWidth="100vw" 
                @modal-closed=${() => { this._isOpen = false; AppStore.setState({ isConfigOpen: false }); }}>
                <div slot="body">${bodyContent}</div>

                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveConfig}>
                    💾 Save & Reload
                </button>
            </insetu-modal>
        `;
    }
    async saveConfig(e) {
        const btn = e.target;
        const origText = btn.innerText;
        btn.innerText = '⏳ Saving...';
        try {
            // Config saves utilize explicit multi-tenant URL path boundaries
            const res = await window.inSetu.api.workspace('system/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.configForm)
            });

            if (res.ok) {
                const data = await res.json();
                btn.innerText = '⏳ Re-indexing...';
                if (window.inSetu.sys.executeSystemCompile) {
                    await window.inSetu.sys.executeSystemCompile(null, true);
                }

                if (data.requires_reboot) {
                    btn.innerText = '⏳ Rebooting...';
                    try {
                        await window.inSetu.api.system('reboot', { method: 'POST' });
                    } catch(err) {}
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    btn.innerText = '⏳ Refreshing UI...';
                    this._isOpen = false;
                    AppStore.setState({ isConfigOpen: false });

                    if (window.inSetu.sys.performSoftRefresh) {
                        await window.inSetu.sys.performSoftRefresh();
                    } else {
                        window.location.reload();
                    }
                    btn.innerText = origText;
                }
            } else {
                const data = await res.json();
                alert("Failed to save: " + data.error);
                if (btn) btn.innerText = origText;
            }
        } catch (e) {
            alert("Network error: " + e.message);
            if (btn) btn.innerText = origText;
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

