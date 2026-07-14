// config.js - Core OS Workspace Configuration Editor
import { html, css } from 'lit';
import { AppStore } from './store.js';
import { InSetuElement } from './sdk.js';
import { sharedStyles } from './shared_styles.js';
export class InSetuExtConfig extends InSetuElement {
    static properties = {
        configForm: { type: Object },
        _isOpen: { type: Boolean }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.configForm = null;
        this._isOpen = false;
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
                this.configForm = await res.json();
            }
        } catch (e) {
            console.error("Failed to fetch config", e);
        }
    }

    renderExtensions() {
        if (!this.configForm) return '';
        const knownExtensions = this.configForm._available_extensions || [];
        const activeExtensions = this.configForm.extensions || ['config'];
        const allExtensions = Array.from(new Set([...knownExtensions, ...activeExtensions])).sort();

        return html`
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${allExtensions.map(ext => {
                    const isConfig = ext === 'config';
                    const isChecked = activeExtensions.includes(ext) || isConfig;
                    return html`
                        <label style="display: flex; align-items: center; gap: 8px; background: var(--bg); padding: 8px 12px; border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">
                            <input type="checkbox" .checked=${isChecked} ?disabled=${isConfig} @change=${(e) => {

                                if (e.target.checked) {
                                    if (!this.configForm.extensions) this.configForm.extensions = [];
                                    if (!this.configForm.extensions.includes(ext)) this.configForm.extensions.push(ext);
                                } else {
                                    if (!this.configForm.extensions) this.configForm.extensions = [];
                                    this.configForm.extensions = this.configForm.extensions.filter(x => x !== ext);
                                }
                                this.requestUpdate();
                            }}>
                            <span style="font-weight: bold; font-size: 0.9rem; color: ${isConfig ? 'var(--text-muted)' : 'var(--text)'};">${ext}</span>
                        </label>
                    `;
                })}
            </div>
        `;
    }

    renderSubBuckets(repo, rIdx) {
        const buckets = repo.sub_buckets || [];
        if (buckets.length === 0) {
            return html`<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No sub-buckets defined.</span>`;
        }

        return buckets.map((b, bIdx) => {
            const isImplicit = !!b.dynamic_split_prefix;
            return html`
                <div style="background: var(--bg); border: 1px solid var(--border); padding: 10px; border-radius: 4px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <select style="padding: 4px; font-size: 0.8rem; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); width: 200px;"
                            @change=${(e) => {
                                if (e.target.value === 'implicit') {
                                    this.configForm.target_repos[rIdx].sub_buckets[bIdx] = { dynamic_split_prefix: '.', meta_map: {} };
                                } else {
                                    this.configForm.target_repos[rIdx].sub_buckets[bIdx] = { id: 'new_bucket', title: '', match_prefixes: [] };
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
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">ID</label><input type="text" .value=${b.id || ''} placeholder="my_bucket" @input=${(e) => { b.id = e.target.value; this.requestUpdate(); }}></div>
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

                <div style="display: flex; gap: 15px; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border-radius: 4px; border: 1px solid var(--border);">
                    <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" .checked=${!!repo.exclude_from_context} @change=${(e) => { repo.exclude_from_context = e.target.checked; this.requestUpdate(); }}> Exclude from Context</label>
                    <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" .checked=${!!repo.exclude_from_diffs} @change=${(e) => { repo.exclude_from_diffs = e.target.checked; this.requestUpdate(); }}> Exclude from Diffs</label>
                    <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" .checked=${!!repo.exclude_from_tracker} @change=${(e) => { repo.exclude_from_tracker = e.target.checked; this.requestUpdate(); }}> Exclude from Tracker</label>
                </div>

                <div style="background: var(--input-bg); padding: 10px; border-radius: 4px; border: 1px solid var(--border); margin-top: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label style="font-size: 0.85rem; font-weight: bold; color: var(--intent-highlight);">Sub-Buckets</label>
                        <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 2px 8px; font-size: 0.75rem;" @click=${() => {
                            if (!repo.sub_buckets) repo.sub_buckets = [];
                            repo.sub_buckets.push({ id: 'new_bucket', title: '', match_prefixes: [] });
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
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                        <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 
0.95rem; color: var(--intent-highlight);">Active Extensions</label>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Enable or disable system extensions.
The 'config' extension is locked.</p>
                        ${this.renderExtensions()}
                    </div>

                    <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                        <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: var(--intent-primary);">Target Repositories</label>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">Repositories dynamically map contexts and define your active multi-tenant workspace environments.</p>
                        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;">
                            ${this.renderRepos()}
                        </div>
                        <button class="btn-sm" style="background: var(--intent-primary); margin: 0;"
                            @click=${() => {
                                if (!this.configForm.target_repos) this.configForm.target_repos = [];
                                this.configForm.target_repos.push({  
                                    repo_dir: '', title: '', domain: 'Workspaces', 
                                    exts: ['.py', '.json', '.md', '.txt'], apply_ignore: true, sub_buckets: [] 
                                });
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
                maxWidth="800px" 
                @modal-closed=${() => { this._isOpen = false; AppStore.setState({ isConfigOpen: false }); }}>

                <div slot="body">${bodyContent}</div>

                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;"
                        @click=${this.saveConfig}>
                        💾 Save & Reload
                    </button>
                </div>
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
                btn.innerText = '⏳ Re-indexing...';
                if (window.executeSystemCompile) {
                    await window.executeSystemCompile(null, true);
                }
                btn.innerText = '⏳ Rebooting...';
                try {
                    await window.inSetu.api.system('reboot', { method: 'POST' });
                } catch(err) {}
                setTimeout(() => window.location.reload(), 2000);
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
                const editor = document.querySelector('insetu-workspace-editor');
                if (editor) editor.open = true;
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
export class InSetuWorkspaceEditor extends InSetuElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        workspaces: { type: Object },
        activeWorkspace: { type: String },
        _showHostBrowser: { type: Boolean },
        _hostCurrentPath: { type: String },
        _hostDirs: { type: Array },
        _newWsId: { type: String },
        _newWsRoot: { type: String }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.open = false;
        this.workspaces = {};
        this.activeWorkspace = 'default';
        this._showHostBrowser = false;
        this._hostCurrentPath = '';
        this._hostDirs = [];
        this._newWsId = '';
        this._newWsRoot = '';
    }

    async _openHostBrowser() {
        const currentVal = this.shadowRoot.querySelector('#new-ws-root').value.trim();
        this._showHostBrowser = true;
        await this._loadHostDirs(currentVal);
    }
    async _loadHostDirs(path = '') {
        try {
            const res = await window.inSetu.api.system(`fs/list_local?path=${encodeURIComponent(path)}`);
            if (res.ok) {
                const data = await res.json();
                this._hostCurrentPath = data.current;
                this._hostDirs = data.dirs || [];
                this.requestUpdate();
            }
        } catch (e) {
            console.error("Host file system walking sequence broken", e);
        }
    }

    _selectHostDir(dirName) {
        const separator = this._hostCurrentPath.endsWith('/') ? '' : '/';
        const nextPath = this._hostCurrentPath + separator + dirName;
        this._loadHostDirs(nextPath);
    }

    _goUpHostDir() {
        const parts = this._hostCurrentPath.split('/').filter(p => p);
        parts.pop();
        const nextPath = this._hostCurrentPath.startsWith('/') ? '/' + parts.join('/') : parts.join('/');
        this._loadHostDirs(nextPath || '/');
    }
    _confirmHostDir() {
        this._newWsRoot = this._hostCurrentPath;
        this._showHostBrowser = false;
        this.requestUpdate();
    }

    updated(changedProperties) {
        if (changedProperties.has('open') && this.open) {
            this._loadWorkspacesManifest();
        }
    }
    async _loadWorkspacesManifest() {
        try {
            const res = await window.inSetu.api.system('workspaces?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this.workspaces = data.workspaces || {};
                this.activeWorkspace = data.active_workspace || 'default';
                this.requestUpdate();
            }
        } catch (e) {
            console.error("Failed to load workspaces list.", e);
        }
    }
    async _handleCreateWorkspace(e) {
        e.preventDefault();
        const wsId = this._newWsId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
        const wsRoot = this._newWsRoot.trim();
        if (!wsId) return;
        try {
            const res = await window.inSetu.api.system('workspaces/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: wsId, workspace_root: wsRoot })
            });
            if (res.ok) {
                this._newWsId = '';
                this._newWsRoot = '';
                this.requestUpdate();
                await this._loadWorkspacesManifest();
                if (window.loadWorkspaces) window.loadWorkspaces();
            } else {
                const err = await res.json();
                alert(`Creation failed: ${err.error}`);
            }
        } catch (err) {
            alert(`Network error: ${err.message}`);
        }
    }
    async _handleDeleteWorkspace(wsId) {
        if (wsId === 'default') return;
        if (!confirm(`⚠️ Are you sure you want to permanently delete workspace "${wsId}"?\nThis removes its tracking configuration metadata indexes instantly.`)) return;
        try {
            const res = await window.inSetu.api.system('workspaces/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: wsId })
            });
            if (res.ok) {
                await this._loadWorkspacesManifest();
                if (window.loadWorkspaces) window.loadWorkspaces();
                if (wsId === this.activeWorkspace) {
                    window.location.reload();
                }
            } else {
                const err = await res.json();
                alert(`Purge rejected: ${err.error}`);
            }
        } catch (err) {
            alert(`Network error: ${err.message}`);
        }
    }
    render() {
        if (!this.open) return '';

        return html`
            <insetu-modal ?open=${this.open} titleText="🗃️ Add / Remove Workspaces" @modal-closed=${() => this.open = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 20px;">
                    <form @submit=${this._handleCreateWorkspace} style="display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-muted);">Workspace Unique Name / ID</label>
                            <input type="text" id="new-ws-id" placeholder="e.g. guitar_academy" .value=${this._newWsId} @input=${e => this._newWsId = e.target.value} required style="width: 100%; margin: 0;">
                        </div>
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-muted);">Workspace Root Directory Path</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="new-ws-root" placeholder="e.g. ~/Documents/GuitarRepertoire" .value=${this._newWsRoot} @input=${e => this._newWsRoot = e.target.value} required style="flex: 1; margin: 0;">
                                <button type="button" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 14px;" @click=${this._openHostBrowser}>...</button>
                            </div>
                        </div>
                        <button type="submit" style="background: var(--intent-success); font-weight: bold; width: 100%; padding: 12px; margin: 0; font-size: 0.9rem; border-radius: 4px;">➕ Provision & Mount Isolated Workspace</button>
                    </form>

                    <insetu-modal ?open=${this._showHostBrowser} titleText="📁 Select Local System Directory" @modal-closed=${() => this._showHostBrowser = false}>
                        <div slot="body" style="display: flex; flex-direction: column; gap: 12px; max-height: 60vh;">
                            <div style="display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; flex-shrink: 0;">
                                <button type="button" class="btn-sm" style="background: var(--intent-neutral); margin:0;" @click=${this._goUpHostDir}>Parent Dir</button>
                                <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--intent-primary); word-break: break-all; flex: 1;">${this._hostCurrentPath}</span>
                            </div>
                            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                                ${this._hostDirs.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">No subdirectories found.</div>` : this._hostDirs.map(d => html`
                                    <div style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--input-bg)'"
                                        onmouseout="this.style.background='transparent'"
                                        @click=${() => this._selectHostDir(d)}>
                                        <span style="margin-right: 8px;">📁</span>
                                        <span style="font-weight: bold; font-size: 0.9rem;">${d}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                        <div slot="footer">
                            <button type="button" style="background: var(--intent-success); font-weight: bold; width: 100%; padding: 12px;" @click=${this._confirmHostDir}>✅ Select This Path</button>
                        </div>
                    </insetu-modal>

                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 8px; color: var(--intent-primary);">Registered Workspaces Index</label>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${Object.keys(this.workspaces).map(wsId => {
                                const isActive = wsId === this.activeWorkspace;
                                return html`
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 6px;">
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="font-size: 1.1rem;">${wsId === 'default' ? '🏛️' : '📁'}</span>
                                            <span style="font-weight: bold; color: ${isActive ? 'var(--intent-success)' : 'var(--text)'};">
                                                ${wsId} ${isActive ? '(Active)' : ''}
                                            </span>
                                        </div>
                                        ${wsId !== 'default' ? html`
                                            <button class="btn-sm" style="background: var(--intent-danger); color: white; padding: 4px 10px; margin: 0; font-size: 0.8rem;" @click=${() => this._handleDeleteWorkspace(wsId)}>Remove</button>
                                        ` : html`<span style="font-size:0.8rem; color: var(--text-muted); font-style:italic;">System Protected</span>`}
                                    </div>
                                `;
                            })}
                        </div>
                    </div>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-workspace-editor', InSetuWorkspaceEditor);
if (!document.getElementById('insetu-workspace-editor-root')) {
    const wsRoot = document.createElement('insetu-workspace-editor');
    wsRoot.id = 'insetu-workspace-editor-root';
    document.body.appendChild(wsRoot);
}

// OS-Managed Generic Settings Form Engine
export class InSetuGenericSettingsModal extends InSetuElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        extName: { type: String },
        schema: { type: Array },
        formData: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.open = false;
        this.extName = '';
        this.schema = [];
        this.formData = {};
    }
    async openModal(extName) {
        this.extName = extName;
        this.schema = window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas[extName] || window.ExtensionRegistry?._manifests?.get(extName)?.settingsSchema || [];
        this.open = true;
        try {
            const res = await window.inSetu.api.workspace(`${extName}/settings?t=${Date.now()}`);
            if (res.ok) {
                this.formData = await res.json();
            } else {
                this.formData = {};
            }
        } catch(e) {
            this.formData = {};
        }
        this.requestUpdate();
    }

    async saveSettings(e) {
        const btn = e.target;
        const orig = btn.innerText;
        btn.innerText = '⏳ Saving...';
        try {
            const payload = {};
            this.schema.forEach(f => {
                payload[f.id] = this.formData[f.id] !== undefined ? this.formData[f.id] : f.default;
            });
            const res = await window.inSetu.api.workspace(`${this.extName}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                this.open = false;
                btn.innerText = orig;
                if(window.executeSystemCompile) window.executeSystemCompile(null, true);
            } else {
                alert("Failed to save settings.");
                btn.innerText = orig;
            }
        } catch(err) {
            alert("Network error: " + err.message);
            btn.innerText = orig;
        }
    }

    render() {
        if (!this.open) return '';

        const title = (window.ExtensionRegistry?._manifests?.get(this.extName)?.name || this.extName) + ' Settings';

        return html`
            <insetu-modal 
                ?open=${this.open} 
                titleText=${title} 
                maxWidth="600px" 
                @modal-closed=${() => this.open = false}>

                <div slot="body" style="display: flex; flex-direction: column; gap: 15px;">
                    ${this.schema.map(field => {
                        const val = this.formData[field.id] !== undefined ? this.formData[field.id] : field.default;
                        let inputHtml = '';
                        if (field.type === 'boolean') {
                            inputHtml = html`<input type="checkbox" style="transform: scale(1.2); cursor: pointer;" .checked=${!!val} @change=${e => { this.formData = {...this.formData, [field.id]: e.target.checked}; this.requestUpdate(); }}>`;
                        } else if (field.type === 'select') {
                            inputHtml = html`
                                <select style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
                                    .value=${val} @change=${e => { this.formData = {...this.formData, [field.id]: e.target.value}; this.requestUpdate(); }}>
                                    ${(field.options || []).map(opt => html`<option value="${opt.value !== undefined ? opt.value : opt}">${opt.label || opt.title || opt.value || opt}</option>`)}
                                </select>
                            `;
                        } else if (field.type === 'number') {
                            inputHtml = html`<input type="number" .value=${val} style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box;" @input=${e => { this.formData = {...this.formData, [field.id]: parseFloat(e.target.value)}; this.requestUpdate(); }}>`;
                        } else if (field.type === 'object' || field.type === 'json' || (typeof val === 'object' && val !== null)) {
                            const strVal = typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : val;
                            inputHtml = html`<textarea style="width: 100%; height: 120px; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box; font-family: monospace;" @input=${e => {
                                try {
                                    this.formData = {...this.formData, [field.id]: JSON.parse(e.target.value)};
                                    e.target.style.borderColor = 'var(--border)';
                                } catch(err) {
                                    e.target.style.borderColor = 'var(--intent-danger)';
                                }
                                this.requestUpdate();
                            }}>${strVal}</textarea>`;
                        } else {
                            inputHtml = html`<input type="text" .value=${val} style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box;" @input=${e => { this.formData = {...this.formData, [field.id]: e.target.value}; this.requestUpdate(); }}>`;
                        }

                        const displayLabel = field.title || field.label || field.id;
                        return html`
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                                ${field.type === 'boolean' 
                                    ? html`<label style="font-size: 0.95rem; color: var(--text); cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: bold;">${inputHtml} ${displayLabel}</label>` 
                                    : html`<label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">${displayLabel}</label>${inputHtml}`}
                                ${field.description || field.desc ? html`<div style="font-size: 0.75rem; color: var(--text-muted);">${field.description || field.desc}</div>` : ''}
                            </div>
                        `;
                    })}
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;"
                        @click=${this.saveSettings}>
                        💾 Save Settings
                    </button>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-generic-settings', InSetuGenericSettingsModal);

if (!document.getElementById('insetu-generic-settings-root')) {
    const genRoot = document.createElement('insetu-generic-settings');
    genRoot.id = 'insetu-generic-settings-root';
    document.body.appendChild(genRoot);
}
