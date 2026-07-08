// ext_config.js - Workspace Configuration Editor Extension
import { LitElement, html, css } from 'lit';
import { AppStore } from '../store.js';
import { sharedStyles } from '../shared_styles.js';

export class InSetuExtConfig extends LitElement {
    static properties = {
        configForm: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.configForm = null;
    }

    async connectedCallback() {
        super.connectedCallback();
        try {
            const res = await fetch('/api/system/config?t=' + Date.now(), { cache: 'no-store' });
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
                                    if (!this.configForm.extensions.includes(ext)) this.configForm.extensions.push(ext);
                                } else {
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
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">ID</label><input type="text" .value=${b.id || ''} placeholder="my_bucket" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.id = e.target.value; this.requestUpdate(); }}></div>
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Title</label><input type="text" .value=${b.title || ''} placeholder="Display Name" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.title = e.target.value; this.requestUpdate(); }}></div>
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Domain</label><input type="text" .value=${b.domain || ''} placeholder="Category" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.domain = e.target.value; this.requestUpdate(); }}></div>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="flex: 2;"><label style="font-size: 0.75rem; color:var(--text-muted);">Description</label><input type="text" .value=${b.description || ''} placeholder="What goes here?" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.description = e.target.value; this.requestUpdate(); }}></div>
                            <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Custom Out File</label><input type="text" .value=${b.out_file || ''} placeholder="out_context.txt" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.out_file = e.target.value; this.requestUpdate(); }}></div>
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color:var(--text-muted);">Match Prefixes (comma separated)</label>
                            <input type="text" .value=${(b.match_prefixes || []).join(', ')} placeholder="path/to/folder, other/path" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.match_prefixes = e.target.value.split(',').map(s => s.trim()).filter(s => s); this.requestUpdate(); }}>
                        </div>
                        <div style="margin-top: 5px;">
                            <label style="font-size: 0.8rem; color: var(--text); cursor: pointer;"><input type="checkbox" .checked=${!!b.is_catch_all} @change=${(e) => { b.is_catch_all = e.target.checked; this.requestUpdate(); }}> Designate as Catch-All Bucket</label>
                        </div>
                    ` : html`
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="flex: 1;">
                                <label style="font-size: 0.75rem; color:var(--text-muted);">Dynamic Split Prefix</label>
                                <input type="text" .value=${b.dynamic_split_prefix || ''} placeholder="e.g. . or docs/" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.dynamic_split_prefix = e.target.value; this.requestUpdate(); }}>
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 0.75rem; color:var(--text-muted);">Shared Base Domain</label>
                                <input type="text" .value=${b.domain || ''} placeholder="e.g. Dynamic Modules" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;" @input=${(e) => { b.domain = e.target.value; this.requestUpdate(); }}>
                            </div>
                        </div>
                        <div style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <label style="font-size: 0.75rem; color:var(--text-muted);">Meta Map (Folder Overrides)</label>
                                <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 2px 6px; font-size: 0.7rem;" @click=${() => {
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
                                        <div style="display: flex; gap: 5px; align-items: center; background: var(--input-bg); padding: 5px; border-radius: 4px; flex-wrap: wrap;">
                                            <input type="text" .value=${dirKey} placeholder="Folder Name" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;" @change=${(e) => {
                                                const newKey = e.target.value;
                                                if (newKey && newKey !== dirKey && !b.meta_map[newKey]) {
                                                    b.meta_map[newKey] = b.meta_map[dirKey];
                                                    delete b.meta_map[dirKey];
                                                    this.requestUpdate();
                                                }
                                            }}>
                                            <input type="text" .value=${meta.title || ''} placeholder="Title" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;" @input=${(e) => { meta.title = e.target.value; this.requestUpdate(); }}>
                                            <input type="text" .value=${meta.domain || ''} placeholder="Domain" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;" @input=${(e) => { meta.domain = e.target.value; this.requestUpdate(); }}>
                                            <button class="btn-sm" style="background: transparent; color: var(--intent-danger); border: none; font-size: 1rem; padding: 0 5px; cursor: pointer;" @click=${() => {
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
                            <option value="prompt-library" ?selected=${repo.archive_type === 'prompt-library'}>Prompt Library</option>
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
        if (!this.configForm) return html`<div class="spinner" style="display:block;">Loading configuration...</div>`;

        return html`
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: var(--intent-highlight);">Active Extensions</label>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Enable or disable system extensions. The 'config' extension is locked.</p>
                    ${this.renderExtensions()}
                </div>

                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: var(--intent-primary);">Target Repositories</label>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">Repositories dynamically map contexts and define your active multi-tenant workspace environments.</p>
                    <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;">
                        ${this.renderRepos()}
                    </div>
                    <button class="btn-sm" style="background: var(--intent-primary); margin: 0;" @click=${() => {
                        if (!this.configForm.target_repos) this.configForm.target_repos = [];
                        this.configForm.target_repos.push({  
                            repo_dir: '', 
                            title: '', 
                            domain: 'Workspaces', 
                            exts: ['.py', '.json', '.md', '.txt'], 
                            apply_ignore: true,
                            sub_buckets: [] 
                        });
                        this.requestUpdate();
                        // Scroll to bottom
                        setTimeout(() => {
                            const container = this.shadowRoot.querySelector('.modal-body');
                            if (container) container.scrollTo(0, container.scrollHeight);
                        }, 50);
                    }}>➕ Add Repository</button>
                </div>
            </div>
        `;
    }

    async saveConfig() {
        try {
            const activeWs = AppStore.getState().activeWorkspace || 'default';
            const res = await fetch('/api/system/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Workspace-ID': activeWs },
                body: JSON.stringify(this.configForm)
            });
            if (res.ok) {
                window.location.reload();
            } else {
                const data = await res.json();
                alert("Failed to save: " + data.error);
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
}
customElements.define('insetu-ext-config', InSetuExtConfig);

// --- DECLARATIVE SCHEMA PAYLOAD ---
window.ExtensionRegistry.registerExtension('config', {
    name: "Workspace Configuration",
    version: "2.0.0",
    settingsActions: [
        {
            id: 'config_editor',
            label: 'Configure Workspace',
            icon: '🛠️',
            onClick: () => {
                const el = document.createElement('insetu-ext-config');
                el.id = 'insetu-config-root';
                window.inSetu.ui.Factory.createModal({
                    id: 'config-editor-modal',
                    title: 'Workspace Configuration',
                    body: el,
                    maxWidth: '800px',
                    actions: [
                        { label: '💾 Save & Reload', style: 'primary', id: 'config-editor-save', onClick: async () => {
                            const btn = document.getElementById('config-editor-save');
                            const orig = btn.innerText;
                            btn.innerText = '⏳ Saving...';
                            await document.getElementById('insetu-config-root').saveConfig();
                            btn.innerText = orig;
                            return true;
                        }}
                    ]
                });
            }
        }
    ]
});
