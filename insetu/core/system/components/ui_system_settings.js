import { html, css } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { AppStore } from '/static/extensions/system/store.js';
export class InSetuSystemSettings extends InSetuElement {
    static properties = {
        menuOpen: { type: Boolean },
        modalOpen: { type: Boolean },
        manageExtOpen: { type: Boolean },
        docsModalOpen: { type: Boolean },
        _docsStatus: { type: Array },
        activeTab: { type: String },
        workspaces: { type: Object },
        emoji: { type: String },
        currentTheme: { type: String },
        layoutCapacity: { type: Number },
        _sysConfigForm: { type: Object },
        _sysConfigMeta: { type: Object }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; align-items: stretch; height: 100%; }
        .menu-btn { transition: background 0.2s, border-color 0.2s; }
        .menu-btn:hover { background: color-mix(in srgb, var(--text) 8%, transparent) !important; }
        .menu-btn.active { background: color-mix(in srgb, var(--text) 15%, transparent) !important; border: 1px solid var(--border) !important; }

        :host-context([data-theme="light"]) .menu-btn:hover { background: color-mix(in srgb, var(--text) 3%, transparent) !important; }
        :host-context([data-theme="light"]) .menu-btn.active { background: color-mix(in srgb, var(--text) 4%, transparent) !important; }
        :host-context([data-theme="e-ink"]) .menu-btn {
            border: 1px solid transparent !important;
            box-shadow: none !important;
        }
        :host-context([data-theme="e-ink"]) .menu-btn:hover {
            background: transparent !important;
        }
        :host-context([data-theme="e-ink"]) .menu-btn.active {
            background: transparent !important;
            border: 2px solid var(--intent-primary) !important;
        }
        .masthead-action-rail-cell {
            width: 44px; height: 100%; border-radius: 0; border: none; border-left: 1px solid var(--border);
            background: var(--rail-bg, rgba(255,255,255,0.02)); display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s ease, color 0.15s ease; box-sizing: border-box; color: var(--text-muted);
        }
        .masthead-action-rail-cell:hover {
            background: var(--rail-hover, rgba(99, 102, 241, 0.22)); color: var(--text);
        }
        .masthead-action-rail-cell i { color: currentColor !important; }
    `];
    constructor() {
        super();
        this.menuOpen = false;
        this.modalOpen = false;
        this.manageExtOpen = false;
        this.docsModalOpen = false;
        this._docsStatus = null;
        this.activeTab = 'system';
        this.workspaces = {};
        this.emoji = '⚙️️';
        this.currentTheme = document.body.getAttribute('data-theme') || 'dark';
        this.layoutCapacity = 3;
        this._sysConfigForm = {};
        this._sysConfigMeta = {};
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
    }
    async _openGenericSettings(extName, filteredSchema = null) {
        const genericModal = document.getElementById('insetu-generic-settings-root');
        const schema = filteredSchema || window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas?.[extName];
        let formData = {};
        try {
            const res = await window.inSetu.api.workspace.get(`${extName}/settings?t=${Date.now()}`);
            if (res.ok) formData = await res.json();
        } catch(e) {}
        if (genericModal) genericModal.openModal(extName, schema, formData);
    }
    _renderExtensionActions(ext, renderBtn) {
        const manifest = window.ExtensionRegistry?._manifests?.get(ext.id);
        const customActions = manifest?.settingsActions || [];
        const btns = [];

        let hasCompleteTakeover = false;

        customActions.forEach(act => {
            if (act.id === `${ext.id}_generic_settings`) {
                hasCompleteTakeover = true;
                btns.push(renderBtn(act.icon || '⚙️', act.label || `${ext.title} Base Settings`, act.onClick));
            }
        });

        if (!hasCompleteTakeover) {
            const rawSchema = window.inSetu.serverSchemas?.[ext.id] || window.inSetu.settingsSchemas?.[ext.id] || [];

            const visibleSchema = rawSchema.filter(s => s.type !== 'hidden');
            const embeddedActions = customActions.filter(act => !act.id.endsWith('_generic_settings'));

            // If there are visible settings OR custom actions to display in the modal, render the Base Settings button
            if (visibleSchema.length > 0 || embeddedActions.length > 0) {
                btns.push(renderBtn('⚙️', `${ext.title} Base Settings`, () => this._openGenericSettings(ext.id, rawSchema)));
            }
        }

        return btns;
    }
    connectedCallback() {
        super.connectedCallback();
        this.currentTheme = document.body.getAttribute('data-theme') || localStorage.getItem('insetu_theme') || 'dark';
        this.subscribe(AppStore, state => {
            this.workspaces = state.workspaces || {};
            this.emoji = state.instanceEmoji || '⚙️';
        });
        this.subscribe('Layout', state => {
            this.layoutCapacity = state.capacity || 3;
        });
        this.registerGlobalListener('click', document, this._handleOutsideClick);
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
    _setLayoutCapacity(cap) {
        if (window.Sutram?.stores?.Layout) {
            window.Sutram.stores.Layout.getState().setCapacity(cap);
        }
        this.menuOpen = false;
    }
    async _openSettings() {
        this.menuOpen = false; 
        this.modalOpen = true;
        try {
            const res = await window.inSetu.api.workspace.get('system/config?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this._sysConfigForm = data.config || {};
                this._sysConfigMeta = data.meta || {};
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
                const res = await fetch(url, { method: 'HEAD' });
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
            const res = await fetch(doc.url);
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
                    setInterval(() => window.location.reload(), 2000);
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
    render() {
        const activeWs = window.inSetu.utils.getActiveWorkspace();
        const allSchemas = { ...window.inSetu.settingsSchemas, ...window.inSetu.serverSchemas };
        const coreList = [];
        const extList = [];

        // Create a union of all schemas and all registered frontend extensions
        const allExtKeys = new Set([...Object.keys(allSchemas), ...Array.from(window.ExtensionRegistry?._manifests?.keys() || [])]);

        allExtKeys.forEach(ext => {
            // system and config actions are manually hardcoded in the system tab
            if (ext === 'core_system' || ext === 'system' || ext === 'config') return; 

            const schema = allSchemas[ext] || [];
            const manifest = window.ExtensionRegistry?._manifests?.get(ext);
            const hasActions = manifest?.settingsActions && manifest.settingsActions.length > 0;

            // If an extension has neither a backend schema nor frontend UI actions, skip it
            if ((!schema || schema.length === 0) && !hasActions) return;

            // Enforce ecosystem boundaries: hide settings for disabled domain extensions
            if (!window.inSetu.isCore(ext) && window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes(ext)) {
                return;
            }

            const title = manifest?.name || ext.charAt(0).toUpperCase() + ext.slice(1);

            if (window.inSetu.isCore(ext)) {
                coreList.push({ id: ext, title });
            } else {
                extList.push({ id: ext, title });
            }
        });
        const renderBtn = (icon, label, onClick) => html`
            <sutram-btn 
                intent="neutral" 
                class="yv-interactive-row" 
                style="width: 100%; justify-content: flex-start; --btn-padding: 12px 15px; --btn-font-size: 0.95rem; margin: 0;"
                @click=${onClick}>
                ${icon ? (/^[a-zA-Z0-9-]+$/.test(icon) ? html`<yv-icon name="${icon}" style="width: 18px; height: 18px; color: var(--intent-primary);"></yv-icon>` : html`<span style="font-size: 1.2rem;">${icon}</span>`) : ''}
                <span>${label}</span>
            </sutram-btn>
        `;
        return html`
            <div style="position: relative; display: flex; align-items: stretch; height: 100%;">
                <button class="masthead-action-rail-cell" @click=${() => this.menuOpen = !this.menuOpen} style="border: none; margin: 0; border-left: 1px solid var(--border); border-radius: 0; height: 100%; width: 44px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                    <yv-icon name="settings" style="width: 16px; height: 16px;"></yv-icon>
                </button>
                ${this.menuOpen ? html`
                    <div style="position: absolute; top: 100%; right: 0; margin-top: 5px; background: var(--pane-bg); background: color-mix(in srgb, var(--pane-bg) 95%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--overlay-shadow); width: 280px; z-index: 2000; max-height: calc(100dvh - 85px); overflow-y: auto; box-sizing: border-box; padding: 15px; display: flex; flex-direction: column; gap: 18px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--intent-primary); border-bottom: 1px solid color-mix(in srgb, var(--intent-primary) 30%, transparent); padding: 0 14px 4px 14px;">System</div>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <sutram-btn intent="neutral" class="yv-interactive-row" @click=${() => this._openSettings()} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal;">
                                    <yv-icon name="settings-2" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: 8px;"></yv-icon> <span>Settings Hub</span>
                                </sutram-btn>
                                <sutram-btn intent="neutral" class="yv-interactive-row" @click=${() => this._openDocsModal()} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal;">
                                    <yv-icon name="book" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: 8px;"></yv-icon> <span>Documentation</span>
                                </sutram-btn>
                                <sutram-btn intent="danger" class="yv-interactive-row" @click=${() => { this.menuOpen = false; if(window.inSetu.sys.fullRefresh) window.inSetu.sys.fullRefresh(); }} style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal;">
                                    <yv-icon name="refresh-cw" style="width: 14px; height: 14px; margin-right: 8px;"></yv-icon> <span>Force UI Refresh</span>
                                </sutram-btn>
                            </div>
                        </div>

                        ${Object.keys(this.workspaces).length > 1 ? html`
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding: 0 14px 4px 14px;">Workspace</div>
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <sutram-btn intent="primary" ?active=${true} style="width: 100%; justify-content: space-between; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <yv-icon name="package" style="width: 14px; height: 14px; color: var(--intent-primary); margin-right: 8px;"></yv-icon>
                                            <span>${this.workspaces[activeWs]?.title || activeWs}</span>
                                        </div>
                                        <yv-icon name="check" style="width: 14px; height: 14px; color: var(--intent-primary);"></yv-icon>
                                    </sutram-btn>
                                    ${Object.entries(this.workspaces).filter(([key, _]) => key !== activeWs).map(([key, ws]) => html`
                                        <sutram-btn intent="neutral" class="yv-interactive-row" style="width: 100%; justify-content: flex-start; --btn-padding: 8px 14px; --btn-font-size: 0.85rem; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal;"
                                            @click=${(e) => { 
                                                e.stopPropagation(); 
                                                this.menuOpen = false; 
                                                if (window.inSetu.sys.executeWorkspaceSwap) {
                                                    window.inSetu.sys.executeWorkspaceSwap(key, ws.title);
                                                }
                                            }}>
                                            <yv-icon name="layout-grid" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: 8px;"></yv-icon>
                                            <span>${ws.title || key}</span>
                                        </sutram-btn>
                                    `)}
                                </div>
                            </div>
                        ` : ''}

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding: 0 14px 4px 14px;">Display Theme</div>
                            <div style="display: flex; gap: 4px;">
                                <sutram-btn intent="${this.currentTheme === 'dark' ? 'primary' : 'neutral'}" class="yv-interactive-row" ?active=${this.currentTheme === 'dark'} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal; font-size: 0.8rem;" @click=${() => this._setTheme('dark')}>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <yv-icon name="moon" style="width: 16px; height: 16px; color: ${this.currentTheme === 'dark' ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>
                                        Dark
                                    </div>
                                </sutram-btn>
                                <sutram-btn intent="${this.currentTheme === 'light' ? 'primary' : 'neutral'}" class="yv-interactive-row" ?active=${this.currentTheme === 'light'} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal; font-size: 0.8rem;" @click=${() => this._setTheme('light')}>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <yv-icon name="sun" style="width: 16px; height: 16px; color: ${this.currentTheme === 'light' ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>
                                        Light
                                    </div>
                                </sutram-btn>
                                <sutram-btn intent="${this.currentTheme === 'e-ink' ? 'primary' : 'neutral'}" class="yv-interactive-row" ?active=${this.currentTheme === 'e-ink'} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal; font-size: 0.8rem;" @click=${() => this._setTheme('e-ink')}>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <yv-icon name="book-open" style="width: 16px; height: 16px; color: ${this.currentTheme === 'e-ink' ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>
                                        E-Ink
                                    </div>
                                </sutram-btn>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding: 0 14px 4px 14px;">Viewport Grid</div>
                            <div style="display: flex; gap: 4px;">
                                <sutram-btn intent="${this.layoutCapacity === 1 ? 'primary' : 'neutral'}" class="yv-interactive-row" ?active=${this.layoutCapacity === 1} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal; font-size: 0.8rem;" @click=${() => this._setLayoutCapacity(1)}>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <yv-icon name="smartphone" style="width: 16px; height: 16px; color: ${this.layoutCapacity === 1 ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>
                                        1-Col
                                    </div>
                                </sutram-btn>
                                <sutram-btn intent="${this.layoutCapacity === 2 ? 'primary' : 'neutral'}" class="yv-interactive-row" ?active=${this.layoutCapacity === 2} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal; font-size: 0.8rem;" @click=${() => this._setLayoutCapacity(2)}>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <yv-icon name="tablet" style="width: 16px; height: 16px; color: ${this.layoutCapacity === 2 ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>
                                        2-Col
                                    </div>
                                </sutram-btn>
                                <sutram-btn intent="${this.layoutCapacity === 3 ? 'primary' : 'neutral'}" class="yv-interactive-row" ?active=${this.layoutCapacity === 3} style="flex: 1; justify-content: center; --btn-padding: 8px; margin: 0; font-family: var(--font-mono, monospace); font-weight: normal; font-size: 0.8rem;" @click=${() => this._setLayoutCapacity(3)}>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <yv-icon name="monitor" style="width: 16px; height: 16px; color: ${this.layoutCapacity === 3 ? 'var(--intent-primary)' : 'var(--text-muted)'};"></yv-icon>
                                        3-Col
                                    </div>
                                </sutram-btn>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            ${this.modalOpen ? html`
            <sutram-modal 
                ?open=${true} 
                ?fullscreen=${true} 
                titleText="OS Settings Hub" 
                @sutram-modal-closed=${() => this.modalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: hidden;">
                    <div style="display: flex; gap: 8px; margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-shrink: 0; overflow-x: auto; scrollbar-width: none;">
                        <sutram-btn intent=${this.activeTab === 'system' ? 'primary' : 'neutral'} ?active=${this.activeTab === 'system'} style="--btn-padding: 8px 16px; white-space: nowrap;" @click=${() => this.activeTab = 'system'}>System</sutram-btn>
                        <sutram-btn intent=${this.activeTab === 'core' ? 'primary' : 'neutral'} ?active=${this.activeTab === 'core'} style="--btn-padding: 8px 16px; white-space: nowrap;" @click=${() => this.activeTab = 'core'}>Core</sutram-btn>
                        <sutram-btn intent=${this.activeTab === 'extensions' ? 'primary' : 'neutral'} ?active=${this.activeTab === 'extensions'} style="--btn-padding: 8px 16px; white-space: nowrap;" @click=${() => this.activeTab = 'extensions'}>Extensions</sutram-btn>
                    </div>
                    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 20px;">
                        ${this.activeTab === 'system' ? html`
                            ${renderBtn('settings', 'System Preferences', () => this._openGenericSettings('system'))}
                            ${renderBtn('layers', 'Add / Remove Workspaces', () => AppStore.setState({ isWorkspaceEditorOpen: true }))}
                            ${renderBtn('folder-cog', 'Configure Current Workspace', () => AppStore.setState({ isConfigOpen: true }))}
                            ${renderBtn('blocks', 'Manage Workspace Extensions', () => this.manageExtOpen = true)}
                        ` : ''}
                        ${this.activeTab === 'core' ? html`
                            ${coreList.map(ext => this._renderExtensionActions(ext, renderBtn))}
                        ` : ''}

                        ${this.activeTab === 'extensions' ? html`
                            ${extList.map(ext => this._renderExtensionActions(ext, renderBtn))}
                            ${extList.length === 0 ? html`<span style="color: var(--text-muted); font-style: italic; padding: 10px;">No third-party extensions active.</span>` : ''}
                        ` : ''}
                    </div>
                </div>
                <div slot="footer" style="width: 100%; display: flex; gap: 8px;">
                    <sutram-entity-actions 
                        .entityType=${'system_control'} 
                        .entityData=${{ closeModal: () => this.modalOpen = false }}
                        style="width: 100%; display: flex; gap: 8px;">
                    </sutram-entity-actions>
                </div>
            </sutram-modal>
            ` : ''}
            ${this.manageExtOpen ? html`
            <sutram-modal 
                ?open=${true} 
                titleText="Manage Workspace Extensions"  
                ?fullscreen=${true} 
                @sutram-modal-closed=${() => this.manageExtOpen = false}>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Enable or disable optional tools for this specific workspace ecosystem.</p>
                ${(this._sysConfigMeta?.available_extensions || []).map(ext => {
                    const isConfig = ext.id === 'config';
                    const isChecked = (this._sysConfigForm.extensions || []).includes(ext.id) || isConfig;
                    return html`
                        <div style="display: flex; align-items: flex-start; gap: 12px; background: var(--input-bg); padding: 12px 15px; border: 1px solid var(--border); border-radius: 6px;">
                            <sutram-toggle .checked=${isChecked} ?disabled=${isConfig} @sutram-input-changed=${(e) => {
                                const current = this._sysConfigForm.extensions || [];
                                const newExts = e.detail.value 
                                    ? (current.includes(ext.id) ? current : [...current, ext.id])
                                    : current.filter(x => x !== ext.id);
                                this._sysConfigForm = { ...this._sysConfigForm, extensions: newExts };
                                this.requestUpdate();
                            }} ?flush=${true} style="margin-top: 2px;"></sutram-toggle>
                            <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
                                <span style="font-size: 0.95rem; color: ${isConfig ? 'var(--text-muted)' : 'var(--text)'}; font-weight: bold; margin: 0;">
                                    ${ext.title} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(${ext.id})</span>
                                </span>
                                ${ext.description ? html`
                                    <span style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.3;">
                                        ${ext.description}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    `;
                })}
                <div slot="footer" style="width: 100%;">
                    <sutram-async-btn style="width: 100%; display: block;" label="Save Active Extensions" intent="success" .onClick=${() => this._saveActiveExtensions()}></sutram-async-btn>
                </div>
            </sutram-modal>
            ` : ''}
            ${this.docsModalOpen ? html`
            <sutram-modal 
                ?open=${true} 
                titleText="📖 Documentation Hub"  
                ?fullscreen=${true} 
                @sutram-modal-closed=${() => this.docsModalOpen = false}>${!this._docsStatus ? html`
                    <div style="padding: 20px;"><yenvui-spinner text="Scanning for documentation..."></yenvui-spinner></div>
                ` : html`
                    <div style="display: contents;">
                        <div>
                            <h4 style="margin: 0 0 10px 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 5px;">Primary OS</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
                                ${this._docsStatus.filter(d => d.type === 'root').map(doc => html`
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 6px; opacity: ${doc.exists ? 1 : 0.6};">
                                        <span style="font-weight: bold; color: var(--text);">${doc.title}</span>${doc.exists ? html`
                                            <sutram-btn intent="success" @click=${() => this._readDoc(doc)}>Read</sutram-btn>
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
                                            <sutram-btn intent="primary" @click=${() => this._readDoc(doc)}>Read</sutram-btn>
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
                                            <sutram-btn intent="highlight" @click=${() => this._readDoc(doc)}>Read</sutram-btn>
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
            const res = await window.inSetu.api.workspace.get(`fs/list_local?path=${encodeURIComponent(path)}`);
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
            const res = await window.inSetu.api.workspace.get('system/workspaces?t=' + Date.now(), { cache: 'no-store' });
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
            const res = await window.inSetu.api.workspace.post('system/workspaces/create', { id: wsId, workspace_root: wsRoot });
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
            const res = await window.inSetu.api.workspace.post('system/workspaces/delete', { id: wsId });
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
        return html`
            ${this.open ? html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="🗃️ Add / Remove Workspaces" @sutram-modal-closed=${(e) => { if (e.target !== e.currentTarget) return; this.open = false; AppStore.setState({ isWorkspaceEditorOpen: false }); }}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 20px; flex: 1; min-height: 0; overflow-y: auto;">
                    <form @submit=${this._handleCreateWorkspace} style="display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">
                        <sutram-input label="Workspace Unique Name / ID" placeholder="e.g. guitar_academy" .value=${this._newWsId} @sutram-input-changed=${e => this._newWsId = e.detail.value} ?flush=${true}></sutram-input>
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-muted);">Workspace Root Directory Path</label>
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <sutram-input placeholder="e.g. ~/Documents/GuitarRepertoire" .value=${this._newWsRoot} @sutram-input-changed=${e => this._newWsRoot = e.detail.value} ?flush=${true} style="flex: 1; margin: 0;"></sutram-input>
                                <sutram-btn intent="highlight" style="margin: 0; --btn-padding: 8px 14px;" @click=${this._openHostBrowser}>...</sutram-btn>
                            </div>
                        </div>
                        <sutram-async-btn btntype="submit" label="Provision & Mount Isolated Workspace" intent="success" style="width: 100%; display: block;" .onClick=${(e) => {
                            if (!this._newWsId || !this._newWsRoot) {
                                e.preventDefault();
                                alert("Workspace ID and Root Path are required.");
                                throw new Error("Validation failed");
                            }
                            return this._handleCreateWorkspace(e);
                        }}></sutram-async-btn>
                    </form>
                    ${this._showHostBrowser ? html`
                    <sutram-modal ?open=${true} ?fullscreen=${true} titleText="📁 Select Local System Directory" @sutram-modal-closed=${() => this._showHostBrowser = false}>
                        <div slot="body" style="display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow-y: auto;">
                            <div style="display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; flex-shrink: 0;">
                                <sutram-btn intent="neutral" @click=${this._goUpHostDir}>Parent Dir</sutram-btn>
                                <yenvui-scrub-track style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--intent-primary); flex: 1;">${this._hostCurrentPath}</yenvui-scrub-track>
                            </div>
                            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                                ${this._hostDirs.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">No subdirectories found.</div>` : this._hostDirs.map(d => html`
                                    <div class="yv-interactive-row" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-radius: 4px;"
                                        @click=${() => this._selectHostDir(d)}>
                                        <yv-icon name="folder" style="width: 16px; height: 16px; color: var(--intent-warning); margin-right: 8px;"></yv-icon>
                                        <span style="font-weight: bold; font-size: 0.9rem;">${d}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                        <sutram-btn slot="footer" intent="success" @click=${this._confirmHostDir}><yv-icon name="check-circle-2" style="width: 16px; height: 16px; margin-right: 6px;"></yv-icon> Select This Path</sutram-btn>
                    </sutram-modal>
                    ` : ''}

                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 8px; color: var(--intent-primary);">Registered Workspaces Index</label>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${Object.keys(this.workspaces).map(wsId => {
                                const isActive = wsId === this.activeWorkspace;
                                return html`
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--input-bg); padding: 10px 15px; border: 1px solid var(--border); border-radius: 6px;">
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <yv-icon name="${wsId === 'default' ? 'landmark' : 'folder'}" style="width: 16px; height: 16px; color: ${wsId === 'default' ? 'var(--intent-highlight)' : 'var(--intent-warning)'};"></yv-icon>
                                            <span style="font-weight: bold; color: ${isActive ? 'var(--intent-success)' : 'var(--text)'};">
                                                ${wsId} ${isActive ? '(Active)' : ''}
                                            </span>
                                        </div>
                                        ${wsId !== 'default' ? html`
                                            <sutram-btn intent="danger" style="--btn-padding: 4px 10px; --btn-font-size: 0.8rem;" @click=${() => this._handleDeleteWorkspace(wsId)}>Remove</sutram-btn>
                                        ` : html`<span style="font-size:0.8rem; color: var(--text-muted); font-style:italic;">System Protected</span>`}
                                    </div>
                                `;
                            })}
                        </div>
                    </div>
                </div>
            </sutram-modal>
            ` : ''}
        `;
}
}
customElements.define('insetu-workspace-editor', InSetuWorkspaceEditor);
if (!document.getElementById('insetu-workspace-editor-root')) {
    const wsRoot = document.createElement('insetu-workspace-editor');
    wsRoot.id = 'insetu-workspace-editor-root';
    document.body.appendChild(wsRoot);
}
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
    const { extName, formData, btn, origText } = e.detail;
    const schema = window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas?.[extName] || window.ExtensionRegistry?._manifests?.get(extName)?.settingsSchema || [];
    try {
        const payload = {};

        schema.forEach(f => {
            if (f.type !== 'hidden') {
                let val = formData[f.id] !== undefined ? formData[f.id] : f.default;
                if ((f.type === 'object' || f.type === 'json') && typeof val === 'string') {
                    try {
                        val = JSON.parse(val);
                    } catch(err) {
                        throw new Error(`Invalid JSON format in field: ${f.label || f.id}`);
                    }
                }
                payload[f.id] = val;
            }
        });

        // If the generic modal has nothing to save (everything was custom or hidden), just close
        if (Object.keys(payload).length === 0) {
            document.getElementById('insetu-generic-settings-root').open = false;
            btn.innerText = origText;
            return;
        }

        const res = await window.inSetu.api.workspace.post(`${extName}/settings`, payload);
        if (res.ok) {
            document.getElementById('insetu-generic-settings-root').open = false;
            btn.innerText = origText;
            window.dispatchEvent(new Event(`insetu-${extName}-settings-changed`));
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("Failed to save settings: " + (errData.error || res.statusText || "Unknown Server Error"));
            btn.innerText = origText;
        }
    } catch(err) {
        alert("Network error: " + err.message);
        btn.innerText = origText;
    }
});

if (!document.getElementById('insetu-generic-settings-root')) {
    const genRoot = document.createElement('sutram-generic-settings');
    genRoot.id = 'insetu-generic-settings-root';
    document.body.appendChild(genRoot);
}