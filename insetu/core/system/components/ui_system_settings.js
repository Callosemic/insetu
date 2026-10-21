import { html, css } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { AppStore } from '/static/extensions/system/store.js';
export class InSetuSystemSettings extends InSetuElement {
    static properties = {
        menuOpen: { type: Boolean },
        modalOpen: { type: Boolean },
        docsModalOpen: { type: Boolean },
        _activeView: { type: String },
        _searchQuery: { type: String },
        _categoryFilter: { type: String },
        _extForms: { type: Object },
        _selectedRepo: { type: String },
        _mountsLoading: { type: Boolean },
        _sharedMounts: { type: Array },
        _exportSharedDomains: { type: Object },
        _newMountWs: { type: String },
        _newMountDomain: { type: String },
        _newExportDomain: { type: String },
        _newExportWildcard: { type: Boolean },
        _newExportAllowed: { type: Array },
        _docsStatus: { type: Array },
        workspaces: { type: Object },
        currentTheme: { type: String },
        layoutCapacity: { type: Number },
        _sysConfigForm: { type: Object },
        _sysConfigMeta: { type: Object },
        _topologyEditingRepo: { type: Boolean },
        _topologyRepoTitle: { type: String },
        _topologyIsNewRepo: { type: Boolean },
        _showHostBrowser: { type: Boolean },
        _newWsId: { type: String },
        _newWsRoot: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
        .hub-breadcrumb-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 20px;
            background: var(--input-bg);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 20;
        }
        .hub-section-title {
            font-size: 0.75rem;
            font-weight: 800;
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--intent-primary);
            margin: 16px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid color-mix(in srgb, var(--intent-primary) 25%, transparent);
        }
        .hub-section-title:first-child {
            margin-top: 4px;
        }
    `];
    constructor() {
        super();
        this.menuOpen = false;
        this.modalOpen = false;
        this.docsModalOpen = false;
        this._activeView = null;
        this._searchQuery = '';
        this._categoryFilter = 'ALL';
        this._extForms = {};
        this._selectedRepo = '';
        this._docsStatus = null;
        this.workspaces = {};
        this.currentTheme = document.body.getAttribute('data-theme') || 'dark';
        this.layoutCapacity = 3;
        this._sysConfigForm = {};
        this._sysConfigMeta = {};
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
        this._mountsLoading = false;
        this._sharedMounts = [];
        this._exportSharedDomains = {};
        this._newMountWs = '';
        this._newMountDomain = 'prompts';
        this._newExportDomain = 'prompts';
        this._newExportWildcard = true;
        this._newExportAllowed = [];
        this._topologyEditingRepo = false;
        this._topologyRepoTitle = '';
        this._topologyIsNewRepo = false;
        this._showHostBrowser = false;
        this._newWsId = '';
        this._newWsRoot = '';
    }
    async _loadMountsData() {
        this._mountsLoading = true;
        this.requestUpdate();
        try {
            const res = await this.api.workspace.get('system/settings?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                this._sharedMounts = Array.isArray(data.shared_mounts) ? [...data.shared_mounts] : [];
                this._exportSharedDomains = (typeof data.export_shared_domains === 'object' && data.export_shared_domains !== null) 
                    ? { ...data.export_shared_domains } 
                    : {};
            }
        } catch (e) {
            console.error("Failed to load mounts settings:", e);
        } finally {
            this._mountsLoading = false;
            this.requestUpdate();
        }
    }
    _addMount(targetWs, domain) {
        if (!targetWs || !domain) return;
        const exists = (this._sharedMounts || []).some(m => m.workspace_id === targetWs && m.domain === domain);
        if (exists) {
            alert('Virtual mount for ' + targetWs + '/' + domain + ' is already active.');
            return;
        }
        this._sharedMounts = [...(this._sharedMounts || []), { workspace_id: targetWs, domain }];
        this.requestUpdate();
    }
    _removeMount(index) {
        this._sharedMounts = (this._sharedMounts || []).filter((_, i) => i !== index);
        this.requestUpdate();
    }
    _addExport() {
        const domain = (this._newExportDomain || '').trim();
        if (!domain) return;
        const allowed = this._newExportWildcard ? ['*'] : [...this._newExportAllowed];
        this._exportSharedDomains = {
            ...(this._exportSharedDomains || {}),
            [domain]: { allowed }
        };
        this.requestUpdate();
    }
    _revokeExport(domain) {
        const next = { ...(this._exportSharedDomains || {}) };
        delete next[domain];
        this._exportSharedDomains = next;
        this.requestUpdate();
    }
    async _saveMountsAndExports() {
        try {
            const res = await this.api.workspace.post('system/settings', {
                shared_mounts: this._sharedMounts || [],
                export_shared_domains: this._exportSharedDomains || {}
            });
            if (res.ok) {
                if (this._extForms?.system) {
                    this._extForms = {
                        ...this._extForms,
                        system: {
                            ...this._extForms.system,
                            shared_mounts: this._sharedMounts || [],
                            export_shared_domains: this._exportSharedDomains || {}
                        }
                    };
                }
                this._activeView = null;
                this.setStatus("Mount configurations and sharing permissions saved.", 2500);
                if (window.inSetu?.stores?.Prompts?.getState()?.fetchPrompts) {
                    window.inSetu.stores.Prompts.getState().fetchPrompts();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert('Failed to save mount settings: ' + (err.error || res.statusText));
            }
        } catch (e) {
            alert('Network error: ' + e.message);
        }
    }
    async _fetchExtSettings(extName, repo = '') {
        try {
            const allRepos = this.ecosystem?.allRepos || [];
            const targetRepo = repo || this._selectedRepo || allRepos[0] || '';
            if (targetRepo && (!this._selectedRepo || repo)) {
                this._selectedRepo = targetRepo;
            }
            const qs = targetRepo ? ('?repo=' + encodeURIComponent(targetRepo) + '&t=' + Date.now()) : ('?t=' + Date.now());
            const res = await window.inSetu.api.workspace.get(extName + '/settings' + qs);
            if (res.ok) {
                const data = await res.json();
                this._extForms = { ...this._extForms, [extName]: data };
                this.requestUpdate();
            }
        } catch (e) {}
    }
    async _drillIntoExtension(extName) {
        const allRepos = this.ecosystem?.allRepos || [];
        if (!this._selectedRepo && allRepos.length > 0) {
            this._selectedRepo = allRepos[0];
        }
        this._activeView = 'ext:' + extName;
        await this._fetchExtSettings(extName, this._selectedRepo);
    }
    _getCatalogModules() {
        const allSchemas = { ...window.inSetu.settingsSchemas, ...window.inSetu.serverSchemas, ...(this._sysConfigMeta?.settings_schemas || {}) };
        const coreList = [];
        const extList = [];
        const allExtKeys = new Set([
            ...Object.keys(allSchemas),
            ...Array.from(window.ExtensionRegistry?._manifests?.keys() || [])
        ]);
        const coreDefaultIcons = {
            system: 'settings',
            security: 'shield',
            llm: 'bot',
            gather: 'hexagon',
            editor: 'edit-3',
            offline: 'hard-drive'
        };

        allExtKeys.forEach(ext => {
            if (ext === 'core_system' || ext === 'config') return;
            const rawSchema = allSchemas[ext] || [];
            const visibleSchema = Array.isArray(rawSchema) ? rawSchema.filter(s => s && s.type !== 'hidden') : [];
            const manifest = window.ExtensionRegistry?._manifests?.get(ext);
            const customActions = (manifest?.settingsActions || []).filter(a => !a.id.endsWith('_generic_settings'));

            if (visibleSchema.length === 0 && customActions.length === 0) return;
            if (!window.inSetu.isCore(ext) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(ext)) {
                return;
            }

            const metaEntry = (this._sysConfigMeta?.available_extensions || []).find(a => a.id === ext);
            const slotIcon = (manifest?.layoutSlots || []).find(s => s.icon)?.icon;
            const resolvedIcon = manifest?.icon || metaEntry?.icon || customActions[0]?.icon || slotIcon || coreDefaultIcons[ext] || 'sliders';
            const title = manifest?.name || metaEntry?.title || (ext === 'system' ? 'System & Daemon Preferences' : ext.charAt(0).toUpperCase() + ext.slice(1));
            const description = metaEntry?.description || (visibleSchema[0]?.description || (title + ' configuration and preferences.'));
            const item = {
                id: ext,
                title,
                description,
                icon: resolvedIcon,
                schema: rawSchema,
                visibleCount: visibleSchema.length,
                customActions,
                isCore: window.inSetu.isCore(ext)
            };

            if (ext === 'system' || item.isCore) {
                coreList.push(item);
            } else {
                extList.push(item);
            }
        });

        coreList.sort((a, b) => (a.id === 'system' ? -1 : b.id === 'system' ? 1 : a.title.localeCompare(b.title)));
        extList.sort((a, b) => a.title.localeCompare(b.title));
        return { coreList, extList };
    }
    connectedCallback() {
        super.connectedCallback();
        this.currentTheme = document.body.getAttribute('data-theme') || localStorage.getItem('insetu_theme') || 'dark';
        const initApp = AppStore.getState();
        this.workspaces = initApp.workspaces || {};
        this.subscribe(
            AppStore,
            state => ({
                workspaces: state.workspaces || {},
                isConfigOpen: !!state.isConfigOpen,
                isWorkspaceEditorOpen: !!state.isWorkspaceEditorOpen
            }),
            ({ workspaces, isConfigOpen, isWorkspaceEditorOpen }) => {
                this.workspaces = workspaces;
                if (isConfigOpen) {
                    AppStore.setState({ isConfigOpen: false });
                    this._openSettings('sys:topology');
                } else if (isWorkspaceEditorOpen) {
                    AppStore.setState({ isWorkspaceEditorOpen: false });
                    this._openSettings('sys:workspaces');
                }
                this.requestUpdate();
            }
        );
        const initLayout = window.Sutram?.stores?.Layout?.getState?.();
        if (initLayout?.capacity) this.layoutCapacity = initLayout.capacity;
        this.subscribe(
            'Layout',
            state => state.capacity || 3,
            (capacity) => {
                this.layoutCapacity = capacity;
                this.requestUpdate();
            }
        );
        this.registerGlobalListener('click', document, this._handleOutsideClick);
        this.registerGlobalListener('insetu:system:close-settings', window, () => {
            this.modalOpen = false;
            this._activeView = null;
        });
        this.registerGlobalListener('insetu:system:open-settings-view', window, (e) => {
            const targetView = e.detail?.view || null;
            this._openSettings(targetView);
        });
        this.registerGlobalListener('insetu:soft-refresh', window, () => {
            this._extForms = {};
            this._selectedRepo = '';
            this._activeView = null;
        });
        this.registerGlobalListener('sutram-settings-repo-changed', this, (e) => {
            const { extName, repo } = e.detail || {};
            if (extName && repo) {
                this._selectedRepo = repo;
                this._fetchExtSettings(extName, repo);
            }
        });
        this.registerGlobalListener('sutram-settings-custom-action', this, (e) => {
            const act = e.detail?.action;
            if (act && (typeof act.render === 'function' || act.component)) {
                this._activeCustomAction = act;
                this._activeView = `action:${act.id}`;
                this.requestUpdate();
            } else {
                this.modalOpen = false;
                this._activeView = null;
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    _handleOutsideClick(e) {
        if (!this.menuOpen) return;
        if (!this.getEventPath(e).includes(this)) {
            this.menuOpen = false;
        }
    }
    _setTheme(theme) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('insetu_theme', theme);
        this.menuOpen = false;
        this.dispatch('sutram-theme-changed', { theme });
        this.dispatch('insetu:theme-changed', { theme });
    }
    _setLayoutCapacity(cap) {
        if (window.Sutram?.stores?.Layout) {
            window.Sutram.stores.Layout.getState().setCapacity(cap);
        }
        this.menuOpen = false;
    }
    async _openSettings(initialView = null) {
        this.menuOpen = false;
        this._activeView = initialView;
        this._topologyEditingRepo = false;
        this._topologyRepoTitle = '';
        this._showHostBrowser = false;
        this._searchQuery = '';
        this._extForms = {};
        this.modalOpen = true;
        if (initialView === 'sys:workspaces') {
            this._loadWorkspacesManifest();
        } else if (initialView === 'sys:mounts') {
            this._loadMountsData();
        }
        const allRepos = this.ecosystem?.allRepos || [];
        if (!this._selectedRepo && allRepos.length > 0) {
            this._selectedRepo = allRepos[0];
        }
        try {
            const res = await window.inSetu.api.workspace.get('system/config?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this._sysConfigForm = data.config || {};
                this._sysConfigMeta = data.meta || {};
                if (data.meta?.settings_schemas) {
                    window.inSetu.serverSchemas = { ...(window.inSetu.serverSchemas || {}), ...data.meta.settings_schemas };
                }
                this.requestUpdate();
            }
        } catch(e) {}
    }
    async _openDocsModal() {
        this.menuOpen = false;
        this.docsModalOpen = true;
        this._docsStatus = null;
        this.requestUpdate();
        const checks = [];
        const checkUrl = async (id, title, url, type) => {
            try {
                const res = await this.api.request(url, { method: 'HEAD' });
                return { id, title, url, type, exists: res.ok };
            } catch {
                return { id, title, url, type, exists: false };
            }
        };

        checks.push(checkUrl('insetu', 'inSetu Workbench', '/README.md', 'root'));

        ['bridge', 'cartographer', 'editor', 'gather', 'sdk', 'topology'].forEach(ext => {
            const title = ext.charAt(0).toUpperCase() + ext.slice(1);
            checks.push(checkUrl(ext, title, `/static/extensions/${ext}/README.md`, 'core'));
        });

        (this._sysConfigMeta?.available_extensions || []).forEach(ext => {
            checks.push(checkUrl(ext.id, ext.title, `/static/extensions/${ext.id}/README.md`, 'ext'));
        });

        this._docsStatus = await Promise.all(checks);
        this.requestUpdate();
    }
    async _readDoc(doc) {
        if (!doc.exists) return;
        try {
            const res = await this.api.request(doc.url);
            if (res.ok) {
                const text = await res.text();
                if (window.inSetu.ui && window.inSetu.ui.viewTextBlob) {
                    window.inSetu.ui.viewTextBlob(`${doc.title} Documentation`, text, `${doc.id}_docs.md`);
                }
                this.docsModalOpen = false;
            }
        } catch(e) {
            this.setStatus(`Error loading docs: ${e.message}`, 3000, true);
        }
    }
    async _saveActiveExtensions() {
        try {
            const res = await window.inSetu.api.workspace.post('system/config', this._sysConfigForm);
            if (res.ok) {
                const data = await res.json();
                if (data.requires_reboot) {
                    this.setStatus("Reboot required. Restarting...", 3000, true);
                    await window.inSetu.api.workspace.post('system/reboot', {});
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    this.setStatus("Extensions updated. Refreshing UI...", 2000);
                    if (window.inSetu.sys.performSoftRefresh) await window.inSetu.sys.performSoftRefresh();
                }
            }
        } catch(e) {
            this.setStatus(`Error: ${e.message}`, 3000, true);
            throw e;
        }
    }
    _renderMountsDrillDown() {
        const activeWs = window.inSetu?.utils?.getActiveWorkspace() || 'default';
        const otherWorkspaces = Object.keys(this.workspaces || {}).filter(w => w !== activeWs);
        const domainOptions = [
            { value: 'prompts', label: 'prompts (.insetu/data/prompts)' },
            { value: 'notes', label: 'notes (.insetu/data/notes)' },
            { value: 'flow', label: 'flow (.insetu/data/flow)' },
            { value: '*', label: '* (All Domains)' }
        ];

        if (this._mountsLoading) {
            return html`<div style="padding: 20px;"><sutram-spinner text="Loading mount configurations..."></sutram-spinner></div>`;
        }

        return html`
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <sutram-collapsible titleText="Virtual Mounts (Subscriber)" intent="primary" ?open=${true}>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">
                        External workspace assets mounted read-only into this tenant via <code>ws://</code> URIs.
                    </p>
                    <div style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: var(--text);">Mount Remote Domain</span>
                        ${otherWorkspaces.length === 0 ? html`
                            <span style="font-size: 0.8rem; color: var(--intent-warning); font-style: italic;">
                                At least two registered workspaces are required to configure peer-to-peer virtual mounts.
                            </span>
                        ` : html`
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                <sutram-select 
                                    label="Source Workspace"
                                    .value=${this._newMountWs || otherWorkspaces[0]} .options=${otherWorkspaces.map(w => {
                                        const wsTitle = (this.workspaces && this.workspaces[w] && this.workspaces[w].title) ? this.workspaces[w].title : w;
                                        return { value: w, label: wsTitle + ' (' + w + ')' };
                                    })}
                                    @sutram-input-changed=${(e) => { this._newMountWs = e.detail.value; this.requestUpdate(); }}
                                    ?flush=${true}>
                                </sutram-select>
                                <sutram-select 
                                    label="Target Domain"
                                    .value=${this._newMountDomain}
                                    .options=${domainOptions}
                                    @sutram-input-changed=${(e) => { this._newMountDomain = e.detail.value; this.requestUpdate(); }}
                                    ?flush=${true}>
                                </sutram-select>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                                <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--intent-highlight);">
                                    URI: ws://${this._newMountWs || otherWorkspaces[0]}/${this._newMountDomain}/
                                </span>
                                <sutram-btn 
                                    size="sm"
                                    intent="primary"
                                    icon="plus"
                                    label="Add Mount"
                                    @click=${() => this._addMount(this._newMountWs || otherWorkspaces[0], this._newMountDomain)}>
                                </sutram-btn>
                            </div>
                        `}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${this._sharedMounts.length === 0 ? html`
                            <sutram-empty-state text="No external domains mounted in this workspace."></sutram-empty-state>
                        ` : this._sharedMounts.map((m, idx) => html`
                            <sutram-card 
                                .titleText=${'ws://' + m.workspace_id + '/' + m.domain + '/'}
                                .descriptionText=${'Read-only mount from tenant "' + m.workspace_id + '" • Domain: ' + m.domain}
                                .detailText=${'Virtual Mount'}
                                icon="globe"
                                intent="highlight"
                                ?disableSelection=${true}>
                                <div slot="header-actions">
                                    <sutram-btn size="sm" intent="danger" icon="trash-2" label="Unmount" @click=${(e) => { e.stopPropagation(); this._removeMount(idx); }}></sutram-btn>
                                </div>
                            </sutram-card>
                        `)}
                    </div>
                </sutram-collapsible>

                <sutram-collapsible titleText="Exported Domains (Publisher)" intent="neutral" ?open=${true}>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">
                        Local directories declared accessible to other workspace tenants on this system.
                    </p>
                    <div style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: var(--text);">Export Local Domain</span>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                            <sutram-select 
                                label="Local Domain"
                                .value=${this._newExportDomain}
                                .options=${domainOptions.filter(d => d.value !== '*')}
                                @sutram-input-changed=${(e) => { this._newExportDomain = e.detail.value; this.requestUpdate(); }}
                                ?flush=${true}>
                            </sutram-select>
                            <div style="display: flex; align-items: center; padding-top: 18px;">
                                <sutram-toggle 
                                    label="Authorize All Workspaces (*)"
                                    .checked=${this._newExportWildcard}
                                    @sutram-input-changed=${(e) => { this._newExportWildcard = e.detail.value; this.requestUpdate(); }}
                                    ?flush=${true}>
                                </sutram-toggle>
                            </div>
                        </div>
                        ${!this._newExportWildcard ? html`
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">Permitted Subscribers</span>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${otherWorkspaces.map(w => {
                                        const isAllowed = this._newExportAllowed.includes(w);
                                        const wsLabel = (this.workspaces && this.workspaces[w] && this.workspaces[w].title) ? this.workspaces[w].title : w;
                                        return html`
                                            <sutram-pill 
                                                pillId=${w}
                                                labelText=${wsLabel + ' (' + w + ')'}
                                                ?active=${isAllowed}
                                                @sutram-pill-toggled=${() => {
                                                    const s = new Set(this._newExportAllowed);
                                                    s.has(w) ? s.delete(w) : s.add(w);
                                                    this._newExportAllowed = Array.from(s);
                                                    this.requestUpdate();
                                                }}>
                                            </sutram-pill>
                                        `;
                                    })}
                                </div>
                            </div>
                        ` : ''}
                        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                            <sutram-btn 
                                size="sm"
                                intent="primary"
                                icon="plus"
                                label="Export Domain"
                                @click=${() => this._addExport()}>
                            </sutram-btn>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${Object.keys(this._exportSharedDomains).length === 0 ? html`
                            <sutram-empty-state text="No local domains currently exported to peer workspaces."></sutram-empty-state>
                        ` : Object.entries(this._exportSharedDomains).map(([domain, policy]) => {
                            const isWildcard = (policy.allowed || []).includes('*');
                            const allowedSummary = isWildcard ? 'All Workspaces (*)' : ((policy.allowed || []).join(', ') || 'None (Private)');
                            return html`
                                <sutram-card 
                                    .titleText=${domain}
                                    .descriptionText=${'Access Policy: ' + allowedSummary}
                                    .detailText=${'Publisher Export'}
                                    icon="share-2"
                                    intent="neutral"
                                    ?disableSelection=${true}>
                                    <div slot="header-actions">
                                        <sutram-btn size="sm" intent="danger" icon="trash-2" label="Revoke" @click=${(e) => { e.stopPropagation(); this._revokeExport(domain); }}></sutram-btn>
                                    </div>
                                </sutram-card>
                            `;
                        })}
                    </div>
                </sutram-collapsible>
            </div>
        `;
    }
    async _loadWorkspacesManifest() {
        try {
            const res = await window.inSetu.api.workspace.get('system/workspaces?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this.workspaces = data.workspaces || {};
                AppStore.setState({ workspaces: this.workspaces });
                this.requestUpdate();
            }
        } catch (e) {
            console.error("Failed to load workspaces list.", e);
        }
    }
    async _handleCreateWorkspace(e) {
        if (e && e.preventDefault) e.preventDefault();
        const wsId = this.utils.slugify(this._newWsId);
        const wsRoot = (this._newWsRoot || '').trim();
        if (!wsId || !wsRoot) {
            alert("Workspace ID and Root Directory Path are required.");
            throw new Error("Validation failed");
        }
        const res = await window.inSetu.api.workspace.post('system/workspaces/create', { id: wsId, workspace_root: wsRoot });
        if (res.ok) {
            this._newWsId = '';
            this._newWsRoot = '';
            await this._loadWorkspacesManifest();
            if (window.inSetu.sys.loadWorkspaces) window.inSetu.sys.loadWorkspaces();
            this.setStatus(`Provisioned workspace '${wsId}'.`, 2500);
        } else {
            const err = await res.json().catch(() => ({}));
            alert(`Creation failed: ${err.error || res.statusText}`);
            throw new Error(err.error || "Creation failed");
        }
    }

    async _handleDeleteWorkspace(wsId) {
        if (wsId === 'default') return;
        if (!confirm(`⚠️ Are you sure you want to permanently remove workspace "${wsId}" from the system routing index?`)) return;
        try {
            const res = await window.inSetu.api.workspace.post('system/workspaces/delete', { id: wsId });
            if (res.ok) {
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                await this._loadWorkspacesManifest();
                if (window.inSetu.sys.loadWorkspaces) window.inSetu.sys.loadWorkspaces();
                if (wsId === activeWs) {
                    sessionStorage.setItem('insetu_workspace', 'default');
                    localStorage.setItem('insetu_workspace', 'default');
                    window.location.reload();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Purge rejected: ${err.error}`);
            }
        } catch (err) {
            alert(`Network error: ${err.message}`);
        }
    }
    _renderWorkspacesDrillDown() {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        if (this._showHostBrowser) {
            return html`
                <insetu-host-dir-picker
                    titleText="Select Host Directory for New Workspace"
                    confirmLabel="Select This Path"
                    .initialPath=${this._newWsRoot || ''}
                    @host-dir-cancelled=${() => { this._showHostBrowser = false; }}
                    @host-dir-selected=${(e) => {
                        this._newWsRoot = e.detail?.path || '';
                        this._showHostBrowser = false;
                        this.requestUpdate();
                    }}>
                </insetu-host-dir-picker>
            `;
        }

        return html`
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <sutram-collapsible titleText="Provision New Isolated Workspace" intent="success" ?open=${true}>
                    <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 4px;">
                        <sutram-field-card
                            label="Workspace Unique ID"
                            description="Alphanumeric slug used in URL routing (#/<workspace_id>/...) and X-Workspace-ID headers."
                            scope="daemon">
                            <sutram-input placeholder="e.g. guitar_academy" .value=${this._newWsId} @sutram-input-changed=${e => this._newWsId = e.detail.value} ?flush=${true}></sutram-input>
                        </sutram-field-card>

                        <sutram-field-card
                            label="Workspace Root Directory Path"
                            description="Physical host directory where this workspace's .insetu/ control plane and repositories reside."
                            scope="daemon">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <sutram-input placeholder="e.g. ~/Documents/GuitarRepertoire" .value=${this._newWsRoot} @sutram-input-changed=${e => this._newWsRoot = e.detail.value} ?flush=${true} style="flex: 1; margin: 0;"></sutram-input>
                                <sutram-btn intent="highlight" label="Browse..." icon="folder" style="margin: 0;" @click=${() => { this._showHostBrowser = true; }}></sutram-btn>
                            </div>
                        </sutram-field-card>

                        <sutram-async-btn icon="plus" label="Provision & Mount Isolated Workspace" intent="success" style="width: 100%; display: block;" .onClick=${(e) => this._handleCreateWorkspace(e)}></sutram-async-btn>
                    </div>
                </sutram-collapsible>

                <sutram-collapsible titleText="Registered Workspaces Index (${Object.keys(this.workspaces || {}).length})" intent="primary" ?open=${true}>
                    <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 4px;">
                        ${Object.entries(this.workspaces || {}).map(([wsId, wsMeta]) => {
                            const isActive = wsId === activeWs;
                            const wsTitle = wsMeta?.title || wsId;
                            return html`
                                <sutram-card
                                    .titleText=${`${wsTitle} (${wsId})`}
                                    .descriptionText=${`Config Path: ${wsMeta?.config_path || 'config.json'}`}
                                    .detailSuffix=${isActive ? '● Active Tenant' : 'Mounted'}
                                    icon=${wsId === 'default' ? 'landmark' : 'layers'}
                                    intent=${isActive ? 'success' : 'neutral'}
                                    ?disableSelection=${true}>
                                    <div slot="header-actions" style="display: flex; gap: 8px; align-items: center;">
                                        ${!isActive ? html`
                                            <sutram-btn size="sm" intent="primary" icon="arrow-right" label="Switch Active" @click=${(e) => {
                                                e.stopPropagation();
                                                this.modalOpen = false;
                                                this._activeView = null;
                                                if (window.inSetu.sys.executeWorkspaceSwap) {
                                                    window.inSetu.sys.executeWorkspaceSwap(wsId, wsTitle);
                                                }
                                            }}></sutram-btn>
                                        ` : ''}
                                        ${wsId !== 'default' ? html`
                                            <sutram-btn size="sm" intent="danger" icon="trash-2" label="Remove" @click=${(e) => {
                                                e.stopPropagation();
                                                this._handleDeleteWorkspace(wsId);
                                            }}></sutram-btn>
                                        ` : html`<sutram-tag text="System Protected" intent="neutral"></sutram-tag>`}
                                    </div>
                                </sutram-card>
                            `;
                        })}
                    </div>
                </sutram-collapsible>
            </div>
        `;
    }

    _renderManageExtensionsDrillDown() {
        const mountedList = this._sysConfigMeta?.mounted_extensions || [];
        return html`
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 6px 0;">
                    Enable or disable optional domain extensions for this workspace. Extensions already mounted in RAM apply with a zero-downtime soft refresh; newly activated extensions will automatically reboot the daemon.
                </p>
                ${(this._sysConfigMeta?.available_extensions || []).map(ext => {
                    const isConfig = ext.id === 'config';
                    const isChecked = (this._sysConfigForm.extensions || []).includes(ext.id) || isConfig;
                    const isMounted = isConfig || mountedList.includes(ext.id);
                    const missingPy = ext.missing_externals || [];
                    const missingBins = ext.missing_binaries || [];
                    const hasMissingDeps = missingPy.length > 0 || missingBins.length > 0;
                    return html`
                        <div style="display: flex; align-items: flex-start; gap: 12px; background: var(--input-bg); padding: 14px 16px; border: 1px solid ${hasMissingDeps && isChecked ? 'var(--intent-warning)' : 'var(--border)'}; border-radius: 8px;">
                            <sutram-toggle .checked=${isChecked} ?disabled=${isConfig} @sutram-input-changed=${(e) => { const current = this._sysConfigForm.extensions || []; const newExts = e.detail.value ? (current.includes(ext.id) ? current : [...current, ext.id]) : current.filter(x => x !== ext.id); this._sysConfigForm = { ...this._sysConfigForm, extensions: newExts }; this.requestUpdate(); }} ?flush=${true} style="margin-top: 2px;"></sutram-toggle>
                            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-size: 0.95rem; color: ${isConfig ? 'var(--text-muted)' : 'var(--text)'}; font-weight: bold; margin: 0;">
                                        ${ext.title} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem; font-family: var(--font-mono);">(${ext.id})</span>
                                    </span>
                                    <div style="display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                        ${hasMissingDeps ? html`<sutram-tag text="Missing Deps" intent="danger"></sutram-tag>` : ''}
                                        ${isMounted
                                            ? html`<sutram-tag text="Mounted in RAM" intent="success"></sutram-tag>`
                                            : html`<sutram-tag text="Requires Reboot" intent="warning"></sutram-tag>`}
                                        <sutram-tag text="workspace" intent="primary"></sutram-tag>
                                    </div>
                                </div>
                                ${ext.description ? html`
                                    <span style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.35;">
                                        ${ext.description}
                                    </span>
                                ` : ''}
                                ${missingPy.length > 0 ? html`
                                    <div style="font-size: 0.75rem; color: var(--intent-warning); font-family: var(--font-mono); background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); margin-top: 4px;">
                                        Missing Python packages: <strong>pip install ${missingPy.join(' ')}</strong>
                                    </div>
                                ` : ''}
                                ${missingBins.length > 0 ? html`
                                    <div style="font-size: 0.75rem; color: var(--intent-danger); font-family: var(--font-mono); background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); margin-top: 4px;">
                                        Missing system binaries in PATH: <strong>${missingBins.join(', ')}</strong>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    render() {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const { coreList, extList } = this._getCatalogModules();
        const allModules = [...coreList, ...extList];
        const allRepos = this.ecosystem?.allRepos || [];
        const q = (this._searchQuery || '').trim().toLowerCase();
        let drillHeaderTitle = 'OS Settings Hub';
        let activeExtModule = null;
        let activeCustomAction = null;
        if (this._activeView && this._activeView.startsWith('action:')) {
            const actId = this._activeView.slice(7);
            const allSettingsActions = window.ExtensionRegistry?.getSettingsActions?.() || [];
            activeCustomAction = (this._activeCustomAction?.id === actId ? this._activeCustomAction : null)
                || allSettingsActions.find(a => a.id === actId)
                || null;
            drillHeaderTitle = activeCustomAction?.label || 'Module Configuration';
        } else if (this._activeView && this._activeView.startsWith('ext:')) {
            const targetId = this._activeView.slice(4);
            activeExtModule = allModules.find(m => m.id === targetId) || {
                id: targetId,
                title: targetId.charAt(0).toUpperCase() + targetId.slice(1),
                schema: window.inSetu.serverSchemas?.[targetId] || window.inSetu.settingsSchemas?.[targetId] || []
            };
            drillHeaderTitle = activeExtModule.title;
        } else if (this._activeView === 'sys:topology') {
            drillHeaderTitle = this._topologyEditingRepo
                ? (this._topologyRepoTitle || 'Edit Repository')
                : 'Workspace & Repository Topology';
        } else if (this._activeView === 'sys:workspaces') {
            drillHeaderTitle = 'Multi-Tenant Workspaces';
        } else if (this._activeView === 'sys:mounts') {
            drillHeaderTitle = 'Virtual Mounts & Asset Sharing';
        } else if (this._activeView === 'sys:extensions') {
            drillHeaderTitle = 'Manage Workspace Extensions';
        }

        return html`
            <div style="position: relative; display: flex; align-items: stretch; height: 100%;">
                <button class="system-action-btn" @click=${() => this.menuOpen = !this.menuOpen} title="System Menu">
                    <yv-icon name="settings" style="width: 16px; height: 16px;"></yv-icon>
                </button>
                ${this.menuOpen ? html`
                    <div style="position: absolute; top: 100%; right: 0; margin-top: 5px; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--overlay-shadow); width: 280px; z-index: 2000; max-height: calc(100dvh - 85px); overflow-y: auto; box-sizing: border-box; padding: 15px; display: flex; flex-direction: column; gap: 18px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--intent-primary); border-bottom: 1px solid color-mix(in srgb, var(--intent-primary) 30%, transparent); padding: 0 14px 4px 14px;">System</div>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <sutram-btn intent="highlight" variant="tinted" class="yv-interactive-row" icon="settings-2" label="Settings Hub" @click=${() => this._openSettings()} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace);"></sutram-btn>
                                <sutram-btn intent="highlight" variant="tinted" class="yv-interactive-row" icon="book" label="Documentation" @click=${() => this._openDocsModal()} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace);"></sutram-btn>
                                <sutram-btn intent="danger" variant="tinted" class="yv-interactive-row" icon="refresh-cw" label="Force UI Refresh" @click=${() => { this.menuOpen = false; if(window.inSetu.sys.fullRefresh) window.inSetu.sys.fullRefresh(); }} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace);"></sutram-btn>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding: 0 14px 4px 14px;">Workspace</div>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <sutram-btn intent="success" variant="tinted" ?active=${true} icon="package" .label=${html`<span style="flex: 1; text-align: left;">${this.workspaces[activeWs]?.title || activeWs}</span><yv-icon name="check" style="width: 14px; height: 14px;"></yv-icon>`} style="width: 100%; justify-content: space-between; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace);"></sutram-btn>
                                ${Object.entries(this.workspaces).filter(([key, _]) => key !== activeWs).map(([key, ws]) => html`
                                    <sutram-btn intent="success" variant="tinted" class="yv-interactive-row" icon="layout-grid" label=${ws.title || key} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace);"
                                        @click=${(e) => {  
                                            e.stopPropagation(); 
                                            this.menuOpen = false; 
                                            if (window.inSetu.sys.executeWorkspaceSwap) {
                                                window.inSetu.sys.executeWorkspaceSwap(key, ws.title);
                                            }
                                        }}>
                                    </sutram-btn>
                                `)}
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding: 0 14px 4px 14px;">Display Theme</div>
                            <div style="display: flex; gap: 4px;">
                                <sutram-btn intent="${this.currentTheme === 'dark' ? 'warning' : 'neutral'}" variant="tinted" class="yv-interactive-row" ?active=${this.currentTheme === 'dark'} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;" @click=${() => this._setTheme('dark')} .label=${html`<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><yv-icon name="moon" style="width: 16px; height: 16px; color: ${this.currentTheme === 'dark' ? 'var(--intent-warning)' : 'var(--text-muted)'};"></yv-icon>Dark</div>`}></sutram-btn>
                                <sutram-btn intent="${this.currentTheme === 'light' ? 'warning' : 'neutral'}" variant="tinted" class="yv-interactive-row" ?active=${this.currentTheme === 'light'} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;" @click=${() => this._setTheme('light')} .label=${html`<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><yv-icon name="sun" style="width: 16px; height: 16px; color: ${this.currentTheme === 'light' ? 'var(--intent-warning)' : 'var(--text-muted)'};"></yv-icon>Light</div>`}></sutram-btn>
                                <sutram-btn intent="${this.currentTheme === 'e-ink' ? 'warning' : 'neutral'}" variant="tinted" class="yv-interactive-row" ?active=${this.currentTheme === 'e-ink'} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;" @click=${() => this._setTheme('e-ink')} .label=${html`<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><yv-icon name="book-open" style="width: 16px; height: 16px; color: ${this.currentTheme === 'e-ink' ? 'var(--intent-warning)' : 'var(--text-muted)'};"></yv-icon>E-Ink</div>`}></sutram-btn>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding: 0 14px 4px 14px;">Viewport Grid</div>
                            <div style="display: flex; gap: 4px;">
                                <sutram-btn intent="${this.layoutCapacity === 1 ? 'primary' : 'neutral'}" variant="tinted" class="yv-interactive-row" ?active=${this.layoutCapacity === 1} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;" @click=${() => this._setLayoutCapacity(1)} .label=${html`<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><yv-icon name="smartphone" style="width: 16px; height: 16px; color: ${this.layoutCapacity === 1 ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>1-Col</div>`}></sutram-btn>
                                <sutram-btn intent="${this.layoutCapacity === 2 ? 'primary' : 'neutral'}" variant="tinted" class="yv-interactive-row" ?active=${this.layoutCapacity === 2} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;" @click=${() => this._setLayoutCapacity(2)} .label=${html`<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><yv-icon name="tablet" style="width: 16px; height: 16px; color: ${this.layoutCapacity === 2 ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>2-Col</div>`}></sutram-btn>
                                <sutram-btn intent="${this.layoutCapacity === 3 ? 'primary' : 'neutral'}" variant="tinted" class="yv-interactive-row" ?active=${this.layoutCapacity === 3} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;" @click=${() => this._setLayoutCapacity(3)} .label=${html`<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><yv-icon name="monitor" style="width: 16px; height: 16px; color: ${this.layoutCapacity === 3 ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>3-Col</div>`}></sutram-btn>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>

            ${this.modalOpen ? html`
            <sutram-modal 
                ?open=${true} 
                ?fullscreen=${true}
                ?flush=${true}
                titleText="OS Settings Hub" 
                @sutram-modal-closed=${(e) => { if (e.target !== e.currentTarget) return; this.modalOpen = false; this._activeView = null; }}>
                <div slot="body" style="display: flex; flex-direction: column;">
                    ${this._activeView ? html`
                        <div class="hub-breadcrumb-bar">
                            <sutram-btn
                                intent="neutral"
                                size="sm"
                                icon="corner-left-up"
                                label=${(this._activeView === 'sys:topology' && this._topologyEditingRepo)
                                    ? 'Workspace Topology'
                                    : (activeCustomAction?.extName ? `Back to ${activeCustomAction.extName.charAt(0).toUpperCase() + activeCustomAction.extName.slice(1)}` : 'All Settings')}
                                style="margin: 0;"
                                @click=${() => {
                                    if (this._activeView === 'sys:topology' && this._topologyEditingRepo) {
                                        const topEl = this.shadowRoot.querySelector('#hub-topology-editor');
                                        if (topEl) topEl._cancelRepoEditor();
                                    } else if (activeCustomAction?.extName) {
                                        const parentExt = activeCustomAction.extName;
                                        this._activeCustomAction = null;
                                        this._drillIntoExtension(parentExt);
                                    } else {
                                        this._showHostBrowser = false;
                                        this._activeCustomAction = null;
                                        this._activeView = null;
                                    }
                                }}>
                            </sutram-btn>
                            <span style="font-weight: bold; font-size: 0.95rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${drillHeaderTitle}
                            </span>
                        </div>
                        <div style="padding: 20px; display: flex; flex-direction: column; gap: 15px;">
                            ${typeof activeCustomAction?.render === 'function'
                                ? activeCustomAction.render()
                                : (this._activeView === 'sys:topology'
                                    ? html`
                                        <insetu-ext-config
                                            id="hub-topology-editor"
                                            ?embedded=${true}
                                            @insetu-topology-mode-changed=${(e) => {
                                                this._topologyEditingRepo = !!e.detail.isEditingRepo;
                                                this._topologyIsNewRepo = !!e.detail.isNewRepo;
                                                this._topologyRepoTitle = e.detail.activeRepoTitle || '';
                                            }}>
                                        </insetu-ext-config>
                                    `
                                    : (this._activeView === 'sys:workspaces'
                                        ? this._renderWorkspacesDrillDown()
                                        : (this._activeView === 'sys:mounts'
                                            ? this._renderMountsDrillDown()
                                            : (this._activeView === 'sys:extensions'
                                                ? this._renderManageExtensionsDrillDown()
                                                : html`
                                                    <sutram-settings-form
                                                        id="hub-active-settings-form"
                                                        .extName=${activeExtModule.id}
                                                        .schema=${activeExtModule.schema}
                                                        .formData=${this._extForms[activeExtModule.id] || {}}
                                                        .repos=${allRepos}
                                                        .selectedRepo=${this._selectedRepo}
                                                        ?hideSaveButton=${true}
                                                        @sutram-settings-form-changed=${(e) => {
                                                            this._extForms = { ...this._extForms, [activeExtModule.id]: e.detail.formData };
                                                        }}>
                                                    </sutram-settings-form>
                                                `))))}
                        </div>
                    ` : html`
                        <div style="padding: 12px 20px; background: var(--input-bg); border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; z-index: 20;">
                            <sutram-search-bar
                                placeholder="Search settings (e.g. port, api key, watchdog, color)..."
                                .value=${this._searchQuery}
                                @search-changed=${(e) => {
                                    this._searchQuery = e.detail.value;
                                    if (this._searchQuery) {
                                        allModules.forEach(m => {
                                            if (!this._extForms[m.id]) this._fetchExtSettings(m.id, this._selectedRepo);
                                        });
                                    }
                                }}>
                            </sutram-search-bar>
                            ${!q ? html`
                                <sutram-scrub-track style="--scrub-gap: 6px;">
                                    <div style="display: flex; gap: 6px; align-items: center;">
                                        <sutram-pill pillId="ALL" labelText="All" ?active=${this._categoryFilter === 'ALL'} @sutram-pill-toggled=${() => this._categoryFilter = 'ALL'}></sutram-pill>
                                        <sutram-pill pillId="SYSTEM" labelText="System & Workspace" ?active=${this._categoryFilter === 'SYSTEM'} @sutram-pill-toggled=${() => this._categoryFilter = 'SYSTEM'}></sutram-pill>
                                        <sutram-pill pillId="CORE" labelText="Core Engines" ?active=${this._categoryFilter === 'CORE'} @sutram-pill-toggled=${() => this._categoryFilter = 'CORE'}></sutram-pill>
                                        <sutram-pill pillId="EXT" labelText="Extensions" ?active=${this._categoryFilter === 'EXT'} @sutram-pill-toggled=${() => this._categoryFilter = 'EXT'}></sutram-pill>
                                    </div>
                                </sutram-scrub-track>
                            ` : ''}
                        </div>

                        <div style="padding: 16px 20px 24px 20px; display: flex; flex-direction: column; gap: 8px;">
                            ${q ? html`
                                ${allModules.filter(m => {
                                    const matchesTitle = [m.title, m.id, m.description].filter(Boolean).join(' ').toLowerCase().includes(q);
                                    const matchesField = (m.schema || []).some(f => f && f.type !== 'hidden' && [f.label, f.title, f.id, f.description].filter(Boolean).join(' ').toLowerCase().includes(q));
                                    return matchesTitle || matchesField;
                                }).map(m => {
                                    const moduleMatchesDirectly = [m.title, m.id].filter(Boolean).join(' ').toLowerCase().includes(q);
                                    return html`
                                        <div style="margin-bottom: 16px;">
                                            <div class="hub-section-title" style="display: flex; justify-content: space-between; align-items: center;">
                                                <span>${m.title}</span>
                                                <sutram-btn size="sm" intent="neutral" label="Open Module" icon="arrow-right" @click=${() => { this._searchQuery = ''; this._drillIntoExtension(m.id); }}></sutram-btn>
                                            </div>
                                            <sutram-settings-form
                                                .extName=${m.id}
                                                .schema=${m.schema}
                                                .formData=${this._extForms[m.id] || {}}
                                                .repos=${allRepos}
                                                .selectedRepo=${this._selectedRepo}
                                                .filterQuery=${moduleMatchesDirectly ? '' : this._searchQuery}
                                                @sutram-settings-form-changed=${(e) => {
                                                    this._extForms = { ...this._extForms, [m.id]: e.detail.formData };
                                                }}>
                                            </sutram-settings-form>
                                        </div>
                                    `;
                                })}
                            ` : html`
                                ${(this._categoryFilter === 'ALL' || this._categoryFilter === 'SYSTEM') ? html`
                                    <div class="hub-section-title">System & Workspace</div>
                                    <sutram-card-group>
                                        ${coreList.filter(m => m.id === 'system').map(sysMod => html`
                                            <sutram-card
                                                .titleText=${sysMod.title}
                                                .descriptionText=${sysMod.description}
                                                .detailSuffix=${sysMod.visibleCount + ' settings ›'}
                                                icon="settings"
                                                intent="primary"
                                                ?disableSelection=${true}
                                                @card-clicked=${() => this._drillIntoExtension('system')}>
                                            </sutram-card>
                                        `)}
                                        <sutram-card
                                            titleText="Workspace & Repository Topology"
                                            descriptionText="Manage tracked repositories, Bucket 0 sieve rules, Sub-Buckets, and UI tab/category ordering."
                                            detailSuffix="${(this._sysConfigForm.target_repos || []).length} repos ›"
                                            icon="folder-cog"
                                            intent="highlight"
                                            ?disableSelection=${true}
                                            @card-clicked=${() => {
                                                this._topologyEditingRepo = false;
                                                this._activeView = 'sys:topology';
                                            }}>
                                        </sutram-card>
                                        <sutram-card
                                            titleText="Manage Workspace Extensions"
                                            descriptionText="Enable or disable optional domain extensions and inspect dependency/mount status."
                                            detailSuffix="${(this._sysConfigForm.extensions || []).length} enabled ›"
                                            icon="blocks"
                                            intent="primary"
                                            ?disableSelection=${true}
                                            @card-clicked=${() => { this._activeView = 'sys:extensions'; }}>
                                        </sutram-card>
                                        <sutram-card
                                            titleText="Virtual Mounts & Asset Sharing"
                                            descriptionText="Cross-workspace ws:// subscriber mounts and publisher domain exports."
                                            detailSuffix="Configure ›"
                                            icon="globe"
                                            intent="highlight"
                                            ?disableSelection=${true}
                                            @card-clicked=${() => { this._activeView = 'sys:mounts'; this._loadMountsData(); }}>
                                        </sutram-card>
                                        <sutram-card
                                            titleText="Multi-Tenant Workspaces"
                                            descriptionText="Switch active workspaces, provision isolated tenants, or manage the system routing index."
                                            detailSuffix="${Object.keys(this.workspaces || {}).length} mounted ›"
                                            icon="layers"
                                            intent="neutral"
                                            ?disableSelection=${true}
                                            @card-clicked=${() => {
                                                this._activeView = 'sys:workspaces';
                                                this._loadWorkspacesManifest();
                                            }}>
                                        </sutram-card>
                                    </sutram-card-group>
                                ` : ''}

                                ${(this._categoryFilter === 'ALL' || this._categoryFilter === 'CORE') ? html`
                                    <div class="hub-section-title">Core Engines</div>
                                    <sutram-card-group>
                                        ${coreList.filter(m => m.id !== 'system').map(mod => html`
                                            <sutram-card
                                                .titleText=${mod.title}
                                                .descriptionText=${mod.description}
                                                .detailSuffix=${mod.visibleCount > 0 ? (mod.visibleCount + ' setting' + (mod.visibleCount === 1 ? '' : 's') + ' ›') : 'Open ›'}
                                                .icon=${mod.icon}
                                                intent="primary"
                                                ?disableSelection=${true}
                                                @card-clicked=${() => {
                                                    if (mod.visibleCount === 0 && mod.customActions.length === 1) {
                                                        const singleAct = mod.customActions[0];
                                                        if (typeof singleAct.render === 'function' || singleAct.component) {
                                                            this._activeCustomAction = { ...singleAct, extName: mod.id };
                                                            this._activeView = `action:${singleAct.id}`;
                                                        } else {
                                                            const prevView = this._activeView;
                                                            singleAct.onClick();
                                                            if (this._activeView === prevView) {
                                                                this.modalOpen = false;
                                                                this._activeView = null;
                                                            }
                                                        }
                                                    } else {
                                                        this._drillIntoExtension(mod.id);
                                                    }
                                                }}>
                                            </sutram-card>
                                        `)}
                                    </sutram-card-group>
                                ` : ''}

                                ${(this._categoryFilter === 'ALL' || this._categoryFilter === 'EXT') ? html`
                                    <div class="hub-section-title">Active Extensions</div>
                                    ${extList.length === 0 ? html`
                                        <span style="color: var(--text-muted); font-style: italic; font-size: 0.85rem; padding: 6px 0;">
                                            No configurable domain extensions active in this workspace.
                                        </span>
                                    ` : html`
                                        <sutram-card-group>
                                            ${extList.map(mod => html`
                                                <sutram-card
                                                    .titleText=${mod.title}
                                                    .descriptionText=${mod.description}
                                                    .detailSuffix=${mod.visibleCount > 0 ? (mod.visibleCount + ' setting' + (mod.visibleCount === 1 ? '' : 's') + ' ›') : 'Open ›'}
                                                    .icon=${mod.icon}
                                                    intent="highlight"
                                                    ?disableSelection=${true}
                                                    @card-clicked=${() => {
                                                        if (mod.visibleCount === 0 && mod.customActions.length === 1) {
                                                            const singleAct = mod.customActions[0];
                                                            if (typeof singleAct.render === 'function' || singleAct.component) {
                                                                this._activeCustomAction = { ...singleAct, extName: mod.id };
                                                                this._activeView = `action:${singleAct.id}`;
                                                            } else {
                                                                this.modalOpen = false;
                                                                this._activeView = null;
                                                                singleAct.onClick();
                                                            }
                                                        } else {
                                                            this._drillIntoExtension(mod.id);
                                                        }
                                                    }}>
                                                </sutram-card>
                                            `)}
                                        </sutram-card-group>
                                    `}
                                ` : ''}
                            `}
                        </div>
                    `}
                </div>
                ${this._activeView ? html`
                    <sutram-btn
                        slot="footer"
                        intent="neutral"
                        icon="arrow-left"
                        label=${(this._activeView === 'sys:topology' && this._topologyEditingRepo)
                            ? 'Cancel & Back to Topology'
                            : (activeCustomAction?.extName ? `Back to ${activeCustomAction.extName.charAt(0).toUpperCase() + activeCustomAction.extName.slice(1)}` : 'Back to Settings Hub')}
                        @click=${() => {
                            if (this._activeView === 'sys:topology' && this._topologyEditingRepo) {
                                const topEl = this.shadowRoot.querySelector('#hub-topology-editor');
                                if (topEl) topEl._cancelRepoEditor();
                            } else if (activeCustomAction?.extName) {
                                const parentExt = activeCustomAction.extName;
                                this._activeCustomAction = null;
                                this._drillIntoExtension(parentExt);
                            } else {
                                this._showHostBrowser = false;
                                this._activeCustomAction = null;
                                this._activeView = null;
                            }
                        }}>
                    </sutram-btn>
                    ${this._activeView === 'sys:workspaces' ? html`` : (activeCustomAction?.component ? html`
                        <sutram-async-btn
                            slot="footer"
                            intent="success"
                            icon="save"
                            label=${activeCustomAction.saveLabel || ('Save ' + drillHeaderTitle)}
                            .onClick=${async () => {
                                const panelEl = this.shadowRoot.querySelector('#hub-custom-action-panel');
                                if (panelEl && typeof panelEl.saveSettings === 'function') {
                                    await panelEl.saveSettings();
                                }
                            }}>
                        </sutram-async-btn>
                    ` : (this._activeView === 'sys:topology' ? html`
                        <sutram-async-btn
                            slot="footer"
                            intent="success"
                            icon="save"
                            label=${this._topologyEditingRepo ? (this._topologyIsNewRepo ? 'Create Repo & Remap Disk' : 'Save Repository & Remap') : 'Save Topology & Remap Disk'}
                            .onClick=${async () => {
                                const topEl = this.shadowRoot.querySelector('#hub-topology-editor');
                                if (!topEl) return;
                                if (this._topologyEditingRepo) {
                                    await topEl.saveAndCommitRepo();
                                } else {
                                    await topEl._saveConfig({ stayOpenInHub: false });
                                    this._activeView = null;
                                }
                            }}>
                        </sutram-async-btn>
                    ` : (this._activeView === 'sys:mounts' ? html`
                        <sutram-async-btn
                            slot="footer"
                            intent="success"
                            icon="save"
                            label="Save Mounts & Sharing"
                            .onClick=${() => this._saveMountsAndExports()}>
                        </sutram-async-btn>
                    ` : (this._activeView === 'sys:extensions' ? html`
                        <sutram-async-btn
                            slot="footer"
                            intent="success"
                            icon="save"
                            label="Save Active Extensions"
                            .onClick=${async () => {
                                await this._saveActiveExtensions();
                                this._activeView = null;
                            }}>
                        </sutram-async-btn>
                    ` : html`
                        <sutram-async-btn
                            slot="footer"
                            intent="success"
                            icon="save"
                            label=${'Save ' + drillHeaderTitle}
                            .onClick=${async (e) => {
                                const formEl = this.shadowRoot.querySelector('#hub-active-settings-form');
                                if (formEl) await formEl.triggerSave(e);
                            }}>
                        </sutram-async-btn>
                    `))))}
                ` : html`
                    <div slot="footer" style="width: 100%; display: flex; gap: 8px;">
                        <sutram-entity-actions 
                            .entityType=${'system_control'} 
                            .entityData=${{}}
                            style="width: 100%; display: flex; gap: 8px;">
                        </sutram-entity-actions>
                    </div>
                `}
            </sutram-modal>
            ` : ''}
            ${this.docsModalOpen ? html`
            <sutram-modal 
                ?open=${true} 
                titleText="Documentation Hub"  
                ?fullscreen=${true} 
                @sutram-modal-closed=${() => this.docsModalOpen = false}>${!this._docsStatus ? html`
                    <div style="padding: 20px;"><sutram-spinner text="Scanning for documentation..."></sutram-spinner></div>
                ` : html`
                    <div style="display: contents;">
                        <div>
                            <h4 style="margin: 0 0 10px 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 5px;">Primary OS</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
                                ${this._docsStatus.filter(d => d.type === 'root').map(doc => html`
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 6px; opacity: ${doc.exists ? 1 : 0.6};">
                                        <span style="font-weight: bold; color: var(--text);">${doc.title}</span>${doc.exists ? html`
                                            <sutram-btn intent="success" label="Read" @click=${() => this._readDoc(doc)}></sutram-btn>
                                        ` : html`
                                            <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No README</span>
                                        `}
                                    </div>
                                `)}
                            </div>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 10px 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 5px;">Core Modules</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
                                ${this._docsStatus.filter(d => d.type === 'core').map(doc => html`
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 6px; opacity: ${doc.exists ? 1 : 0.6};">
                                        <span style="font-weight: bold; color: var(--text);">${doc.title}</span>${doc.exists ? html`
                                            <sutram-btn intent="primary" label="Read" @click=${() => this._readDoc(doc)}></sutram-btn>
                                        ` : html`
                                            <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No README</span>
                                        `}
                                    </div>
                                `)}
                            </div>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 10px 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 5px;">Extensions</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
                                ${this._docsStatus.filter(d => d.type === 'ext').map(doc => html`
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 6px; opacity: ${doc.exists ? 1 : 0.6};">
                                        <span style="font-weight: bold; color: var(--text);">${doc.title}</span>${doc.exists ? html`
                                            <sutram-btn intent="highlight" label="Read" @click=${() => this._readDoc(doc)}></sutram-btn>
                                        ` : html`
                                            <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No README</span>
                                        `}
                                    </div>
                                `)}
                            </div>
                        </div>
                    </div>
                `}
            </sutram-modal>
            ` : ''}
        `;
}
}
customElements.define('insetu-system-settings', InSetuSystemSettings);

// OS-Managed Generic Settings Form Engine (Migrated to sutram/js/primitives.js)
window.addEventListener('sutram-settings-action', async (e) => {
    const { extName, field, resolve, reject } = e.detail;
    const rawEndpoint = field.endpoint || `${extName}/action`;
    const cleanEndpoint = rawEndpoint.startsWith('/') ? rawEndpoint.substring(1) : rawEndpoint;

    try {
        const res = await window.inSetu.api.workspace.post(cleanEndpoint, {});
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Action request failed.");
        }
        const data = await res.json();
        if (res.status === 202 && data.job_id) {
            window.inSetu.utils.pollJob(data.job_id, {
                onProgress: (msg) => { if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null); },
                onComplete: (statusData) => {
                    if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(statusData.message || "✅ Action Completed!", 2000);
                    resolve(statusData);
                },
                onError: (err) => {
                    if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ ${err.message}`, 3000, true);
                    reject(err);
                }
            });
        } else {
            if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(data.message || "✅ Action Completed!", 2000);
            resolve(data);
        }
    } catch (err) {
        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ ${err.message}`, 3000, true);
        reject(err);
    }
});
window.addEventListener('sutram-settings-save', async (e) => {
    const { extName, formData, repo, btn, origText, resolve, reject } = e.detail || {};
    const schema = e.detail?.schema || window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas?.[extName] || window.ExtensionRegistry?._manifests?.get(extName)?.settingsSchema || [];
    try {
        const payload = {};
        schema.forEach(f => {
            if (f && f.type !== 'hidden' && f.type !== 'action') {
                let val = formData && formData[f.id] !== undefined ? formData[f.id] : f.default;
                if (f.type === 'number') {
                    const num = (val === '' || val === null || val === undefined) ? (f.default ?? 0) : Number(val);
                    val = Number.isNaN(num) ? (f.default ?? 0) : num;
                } else if ((f.type === 'object' || f.type === 'json') && typeof val === 'string') {
                    try {
                        val = JSON.parse(val);
                    } catch(err) {
                        throw new Error('Invalid JSON format in field: ' + (f.label || f.id));
                    }
                }
                payload[f.id] = val;
            }
        });
        if (Object.keys(payload).length === 0) {
            if (btn && origText) btn.innerText = origText;
            if (resolve) resolve({});
            return;
        }

        const qs = repo ? ('?repo=' + encodeURIComponent(repo)) : '';
        const res = await window.inSetu.api.workspace.post(extName + '/settings' + qs, payload);
        if (res.ok) {
            const resData = await res.json().catch(() => ({}));
            if (btn && origText) btn.innerText = origText;
            window.dispatchEvent(new Event('insetu-' + extName + '-settings-changed'));

            if (resData.job_id && window.inSetu?.utils?.pollJob) {
                if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("Recompiling contexts with updated settings...", null);
                window.inSetu.utils.pollJob(resData.job_id, {
                    onProgress: (msg) => {
                        if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(msg, null);
                    },
                    onComplete: async () => {
                        if (window.inSetu.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
                        if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus("Settings saved & contexts updated", 2500);
                    }
                });
            } else if (window.inSetu.ui?.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus("Settings saved", 2000);
            }
            if (resolve) resolve(resData);
        } else {
            const errData = await res.json().catch(() => ({}));
            const msg = errData.error || res.statusText || "Unknown Server Error";
            alert("Failed to save settings: " + msg);
            if (btn && origText) btn.innerText = origText;
            if (reject) reject(new Error(msg));
        }
    } catch(err) {
        alert("Settings Error: " + err.message);
        if (btn && origText) btn.innerText = origText;
        if (reject) reject(err);
    }
});
