import { html, css } from 'lit';
import { InSetuElement } from '../sdk.js';
import { sharedStyles } from '../shared_styles.js';
import { AppStore } from '../store.js';
export class InSetuSystemSettings extends InSetuElement {
    static properties = {
        menuOpen: { type: Boolean },
        modalOpen: { type: Boolean },
        workspaces: { type: Object },
        emoji: { type: String },
        currentTheme: { type: String },
        settingsActions: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host { display: contents; }
        :host-context([data-theme="e-ink"]) .menu-btn {
            border: 1px solid transparent !important;
            box-shadow: none !important;
        }
        :host-context([data-theme="e-ink"]) .menu-btn.active {
            border: 2px solid #000 !important;
        }
    `];
    constructor() {
        super();
        this.menuOpen = false;
        this.modalOpen = false;
        this.workspaces = {};
        this.emoji = '⚙️';
        this.currentTheme = document.body.getAttribute('data-theme') || 'dark';
        this.settingsActions = [];
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
        this._handleActionsUpdate = () => {
            this.settingsActions = window.ExtensionRegistry._settingsActions || [];
        };
    }
    connectedCallback() {
        super.connectedCallback();
        this.currentTheme = document.body.getAttribute('data-theme') || localStorage.getItem('insetu_theme') || 'dark';
        this.subscribe(AppStore, state => {
            this.workspaces = state.workspaces || {};
            this.emoji = state.instanceEmoji || '⚙️';
        });
        this.registerGlobalListener('click', document, this._handleOutsideClick);
        this.registerGlobalListener('insetu-settings-actions-updated', window, this._handleActionsUpdate);
        this.settingsActions = window.ExtensionRegistry?._settingsActions || [];
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    _handleOutsideClick(e) {
        if (!this.menuOpen) return;
        const path = e.composedPath();
        if (!path.includes(this)) {
            this.menuOpen = false;
        }
    }
    _setTheme(theme) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('insetu_theme', theme);
        this.menuOpen = false;
    }
    render() {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const groupedActions = this.settingsActions.reduce((acc, act) => {
            const isSystem = act.section === 'System' || act.section === 'Workspace';
            const sec = isSystem ? 'System Settings' : 'Extension Settings';
            if (!acc[sec]) acc[sec] = [];
            acc[sec].push(act);
            return acc;
        }, {});

        const sortedSections = Object.keys(groupedActions).sort((a, b) => {
            if (a === 'System Settings') return -1;
            if (b === 'System Settings') return 1;
            return a.localeCompare(b);
        });

        return html`
            <div style="position: relative; display: inline-block;">
                <button class="system-action-btn" @click=${() => this.menuOpen = !this.menuOpen}>${this.emoji}</button>
                ${this.menuOpen ? html`
                    <div style="position: absolute; top: 100%; right: 0; margin-top: 10px; background: var(--pane-bg); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); width: 280px; z-index: 2000; overflow: hidden; padding: 15px;">
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
                            <button class="menu-btn" @click=${() => { this.menuOpen = false; this.modalOpen = true; }} style="margin: 0; background: var(--input-bg); color: var(--text); text-align: left; padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='var(--input-bg)'">
                                <span style="font-size: 1.1rem;">⚙️</span> <span>Settings</span>
                            </button>
                        </div>

                        ${Object.keys(this.workspaces).length > 0 ? html`
                            <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-size: 0.9rem; color: var(--text);">Workspace</h4>
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
                                ${Object.entries(this.workspaces).map(([key, ws]) => {
                                    const isActive = activeWs === key;
                                    return html`
                                        <button class="menu-btn ${isActive ? 'active' : ''}" style="margin: 0; background: ${isActive ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${isActive ? 'var(--border)' : 'transparent'}; cursor: pointer; border-radius: 4px; font-weight: ${isActive ? 'bold' : 'normal'};"
                                            @click=${() => { this.menuOpen = false; if(window.inSetu.sys.executeWorkspaceSwap) window.inSetu.sys.executeWorkspaceSwap(key, ws.title); }}>
                                            ${isActive ? '🟢 ' : '⚪ '} ${ws.title || key}
                                        </button>
                                    `;
                                })}
                            </div>
                        ` : ''}

                        <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-size: 0.9rem; color: var(--text);">Theme</h4>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button class="menu-btn ${this.currentTheme === 'light' ? 'active' : ''}" style="margin: 0; background: ${this.currentTheme === 'light' ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${this.currentTheme === 'light' ? 'var(--border)' : 'transparent'}; cursor: pointer; font-weight: ${this.currentTheme === 'light' ? 'bold' : 'normal'}; border-radius: 4px;" @click=${() => this._setTheme('light')}>☀️ Light</button>
                            <button class="menu-btn ${this.currentTheme === 'dark' ? 'active' : ''}" style="margin: 0; background: ${this.currentTheme === 'dark' ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${this.currentTheme === 'dark' ? 'var(--border)' : 'transparent'}; cursor: pointer; font-weight: ${this.currentTheme === 'dark' ? 'bold' : 'normal'}; border-radius: 4px;" @click=${() => this._setTheme('dark')}>🌙 Dark</button>
                            <button class="menu-btn ${this.currentTheme === 'e-ink' ? 'active' : ''}" style="margin: 0; background: ${this.currentTheme === 'e-ink' ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${this.currentTheme === 'e-ink' ? 'var(--border)' : 'transparent'}; cursor: pointer; font-weight: ${this.currentTheme === 'e-ink' ? 'bold' : 'normal'}; border-radius: 4px;" @click=${() => this._setTheme('e-ink')}>📖 E-Ink</button>
                        </div>
                        <h4 style="margin: 15px 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-size: 0.9rem; color: var(--text);">System</h4>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button class="menu-btn" @click=${() => { this.menuOpen = false; if(window.inSetu.sys.fullRefresh) window.inSetu.sys.fullRefresh(); }} style="margin: 0; background: transparent; color: #ef4444; text-align: left; padding: 6px; border: 1px solid transparent; cursor: pointer; font-weight: bold;">🔄 Full UI Refresh</button>
                        </div>
                    </div>
                ` : ''}
            </div>
            <insetu-modal ?open=${this.modalOpen} ?fullscreen=${true} titleText="System Settings & Extensions" @modal-closed=${() => this.modalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow-y: auto; margin-bottom: 20px;">
                    ${sortedSections.map(section => html`
                        <div style="font-weight: bold; font-size: 0.85rem; color: var(--intent-primary); margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">${section}:</div>
                        ${groupedActions[section].map(act => html`
                            <button class="btn-sm" style="background: var(--input-bg); color: var(--text); border: 1px solid var(--border); text-align: left; padding: 10px 15px; font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 10px; font-weight: bold; transition: background 0.2s; width: 100%;"
                                onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='var(--input-bg)'"
                                @click=${() => { act.callback(); }}>
                                <span style="font-size: 1.2rem;">${act.icon}</span> <span>${act.label}</span>
                            </button>
                        `)}
                    `)}
                    <div style="border-top: 1px solid var(--border); padding-top: 15px; display: flex; justify-content: flex-end; margin-top: auto; gap: 8px;">
                        <button class="btn-sm" style="background: var(--intent-primary); margin: 0; font-weight: bold; color: white;" 
                            @click=${async (e) => {
                                const btn = e.target;
                                const orig = btn.innerText;
                                btn.innerText = "⏳ Recompiling...";
                                try {
                                    if (window.inSetu.sys.executeSystemCompile) await window.inSetu.sys.executeSystemCompile(null, true);
                                } catch(err) {}
                                btn.innerText = orig;
                            }}>⚙️ Full Context Recompile</button>
                        <button class="btn-sm" style="background: var(--intent-warning); margin: 0; font-weight: bold; color: black;" @click=${() => { this.modalOpen = false; if(window.inSetu.sys.simulatePanic) window.inSetu.sys.simulatePanic(); }}>⚠️ Test Recovery</button>
                    </div>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-system-settings', InSetuSystemSettings);
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
    static styles = [sharedStyles, css`:host { display: contents; }`];
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

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, state => {
            if (state.isWorkspaceEditorOpen !== this.open) {
                this.open = !!state.isWorkspaceEditorOpen;
            }
        });
    }

    async _openHostBrowser() {
        const currentVal = this._newWsRoot.trim();
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
        const wsId = this.utils.slugify(this._newWsId);
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
                if (window.inSetu.sys.loadWorkspaces) window.inSetu.sys.loadWorkspaces();
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
                if (window.inSetu.sys.loadWorkspaces) window.inSetu.sys.loadWorkspaces();
                if (wsId === this.activeWorkspace) {
                    sessionStorage.setItem('insetu_workspace', 'default');
                    localStorage.setItem('insetu_workspace', 'default');
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
            <insetu-modal ?open=${this.open} ?fullscreen=${true} titleText="🗃️ Add / Remove Workspaces" @modal-closed=${(e) => { if (e.target !== e.currentTarget) return; this.open = false; AppStore.setState({ isWorkspaceEditorOpen: false }); }}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 20px; flex: 1; min-height: 0; overflow-y: auto;">
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
                    <insetu-modal ?open=${this._showHostBrowser} ?fullscreen=${true} titleText="📁 Select Local System Directory" @modal-closed=${() => this._showHostBrowser = false}>
                        <div slot="body" style="display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow-y: auto;">
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
                        <button slot="footer" type="button" style="background: var(--intent-success); color: white;" @click=${this._confirmHostDir}>✅ Select This Path</button>
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
    static styles = [sharedStyles, css`:host { display: contents; }`];

    constructor() {
        super();
        this.open = false;
        this.extName = '';
        this.schema = [];
        this.formData = {};
    }
    async openModal(extName, isLocal = false) {
        this.extName = extName;
        this.isLocal = isLocal;
        this.schema = window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas[extName] || window.ExtensionRegistry?._manifests?.get(extName)?.settingsSchema || [];
        this.open = true;

        if (this.isLocal) {
            this.formData = {};
            this.schema.forEach(f => {
                const val = localStorage.getItem(f.id);
                this.formData[f.id] = val !== null ? JSON.parse(val) : f.default;
            });
            this.requestUpdate();
        } else {
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
    }

    async saveSettings(e) {
        const btn = e.target;
        const orig = btn.innerText;
        btn.innerText = '⏳ Saving...';
        try {
            if (this.isLocal) {
                this.schema.forEach(f => {
                    const val = this.formData[f.id] !== undefined ? this.formData[f.id] : f.default;
                    localStorage.setItem(f.id, JSON.stringify(val));
                });
                this.open = false;
                btn.innerText = orig;
                window.dispatchEvent(new Event(`insetu-${this.extName}-settings-changed`));
            } else {
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
                ?fullscreen=${true} 
                @modal-closed=${() => this.open = false}>

                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
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
                            const inputType = field.type === 'password' ? 'password' : 'text';
                            inputHtml = html`<input type="${inputType}" .value=${val} style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); box-sizing: border-box;" @input=${e => { this.formData = {...this.formData, [field.id]: e.target.value}; this.requestUpdate(); }}>`;
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
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this.saveSettings}>
                    💾 Save Settings
                </button>
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