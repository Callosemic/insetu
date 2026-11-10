import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';
import { cascadeRepeaterIdRename } from '/static/extensions/system/components/ui_schema_repeater.js';

export class InSetuSystemSettings extends InSetuElement {
    static get extensionName() { return 'system'; }
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
        _newWsRoot: { type: String },
        _directivesData: { type: Object },
        _directiveDrafts: { type: Object },
        _directivesDiffOpen: { type: Boolean }
    };
    static styles = [sharedStyles];
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
        this._exportRepeaterItems = [];
        this._llmCatalogMap = {};
        this._driverTierDefaults = {};
        this._topologyEditingRepo = false;
        this._topologyRepoTitle = '';
        this._topologyIsNewRepo = false;
        this._showHostBrowser = false;
        this._newWsId = '';
        this._newWsRoot = '';
        this._directivesData = null;
        this._directiveDrafts = {};
        this._directivesDiffOpen = false;
    }
    async _loadMountsData() {
        this._mountsLoading = true;
        this.requestUpdate();
        try {
            const res = await this.api.get('system/settings?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                this._sharedMounts = Array.isArray(data.shared_mounts) ? [...data.shared_mounts] : [];
                this._exportSharedDomains = (typeof data.export_shared_domains === 'object' && data.export_shared_domains !== null) 
                    ? { ...data.export_shared_domains } 
                    : {};
                this._exportRepeaterItems = Object.entries(this._exportSharedDomains).map(([domain, policy]) => {
                    const allowedArr = Array.isArray(policy?.allowed) ? policy.allowed : ['*'];
                    const isWild = allowedArr.includes('*');
                    return {
                        domain,
                        wildcard: isWild,
                        allowed: isWild ? [] : allowedArr
                    };
                });
            }
        } catch (e) {
            console.error("Failed to load mounts settings:", e);
        } finally {
            this._mountsLoading = false;
            this.requestUpdate();
        }
    }
    async _saveMountsAndExports() {
        const nextExports = {};
        (this._exportRepeaterItems || []).forEach(item => {
            const dom = String(item?.domain || '').trim();
            if (!dom) return;
            const allowedList = item.wildcard
                ? ['*']
                : (Array.isArray(item.allowed) ? item.allowed : String(item.allowed || '').split(',').map(s => s.trim()).filter(Boolean));
            nextExports[dom] = { allowed: allowedList };
        });
        this._exportSharedDomains = nextExports;
        try {
            const res = await this.api.post('system/settings', {
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
    async _fetchExtSettings(extName, repo = '', preserveNonRepoEdits = false) {
        try {
            const allRepos = this.ecosystem?.allRepos || [];
            const targetRepo = repo || this._selectedRepo || allRepos[0] || '';
            if (targetRepo && (!this._selectedRepo || repo)) {
                this._selectedRepo = targetRepo;
            }
            const qs = targetRepo ? ('?repo=' + encodeURIComponent(targetRepo) + '&t=' + Date.now()) : ('?t=' + Date.now());
            const res = await this.api.get(extName + '/settings' + qs);
            if (res.ok) {
                const data = await res.json();
                const merged = { ...data };
                const allSchemas = { ...window.inSetu.settingsSchemas, ...window.inSetu.serverSchemas, ...(this._sysConfigMeta?.settings_schemas || {}) };
                const schema = allSchemas[extName] || [];
                schema.forEach(f => {
                    if (f && f.type === 'repeater' && Array.isArray(f.pinned_items) && f.pinned_items.length > 0) {
                        const curList = Array.isArray(merged[f.id]) ? [...merged[f.id]] : [];
                        const idKey = f.id_key || 'id';
                        f.pinned_items.forEach(pin => {
                            if (pin && pin[idKey] && !curList.some(it => it && (it[idKey] === pin[idKey] || (pin.driver && it.driver === pin.driver)))) {
                                curList.push({ ...pin });
                            }
                        });
                        merged[f.id] = curList;
                    }
                    if (preserveNonRepoEdits && f && f.id && f.scope !== 'repo') {
                        const prevForm = this._extForms[extName] || {};
                        if (prevForm[f.id] !== undefined && prevForm[f.id] !== data[f.id]) {
                            merged[f.id] = prevForm[f.id];
                        }
                    }
                });
                this._extForms = { ...this._extForms, [extName]: merged };
                this.requestUpdate();
            }
        } catch (e) {}
    }
    async _fetchDirectives(repo = '') {
        const allRepos = this.ecosystem?.allRepos || [];
        const targetRepo = repo || this._selectedRepo || allRepos[0] || '';
        try {
            const qs = targetRepo ? `?repo=${encodeURIComponent(targetRepo)}&t=${Date.now()}` : `?t=${Date.now()}`;
            const res = await this.api.get('system/directives' + qs);
            if (res.ok) {
                const data = await res.json();
                this._directivesData = data;
                const drafts = {};
                Object.entries(data.tiers || {}).forEach(([tKey, tInfo]) => {
                    drafts[tKey] = tInfo.body || '';
                });
                this._directiveDrafts = drafts;
                this.requestUpdate();
            }
        } catch (e) {
            console.warn('Failed to load directives:', e);
        }
    }

    async _saveDirectiveTier(tierKey) {
        const repo = this._directivesData?.repo || this._selectedRepo || (this.ecosystem?.allRepos || [])[0] || '';
        const content = this._directiveDrafts?.[tierKey] ?? '';
        const res = await this.api.post('system/directives/save', { tier: tierKey, repo, content });
        if (res.ok) {
            const data = await res.json();
            if (data.directives) {
                this._directivesData = data.directives;
            } else {
                await this._fetchDirectives(repo);
            }
            this.setStatus(`Saved ${tierKey} directives.`, 2500);
            this.requestUpdate();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Failed to save directive tier.');
        }
    }

    async _acceptSharedDirectives() {
        const repo = this._directivesData?.repo || this._selectedRepo || '';
        const sharedTier = this._directivesData?.tiers?.repo_shared;
        if (!repo || !sharedTier?.digest) return;
        const res = await this.api.post('system/directives/accept', { repo, digest: sharedTier.digest });
        if (res.ok) {
            const data = await res.json();
            this._directivesData = data.directives || this._directivesData;
            this._directivesDiffOpen = false;
            this.setStatus(`Accepted shared directives for ${repo}.`, 2500);
            this.requestUpdate();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Could not accept repository directives.');
            await this._fetchDirectives(repo);
        }
    }

    async _revokeSharedDirectives() {
        const repo = this._directivesData?.repo || this._selectedRepo || '';
        if (!repo) return;
        const res = await this.api.post('system/directives/revoke', { repo });
        if (res.ok) {
            const data = await res.json();
            this._directivesData = data.directives || this._directivesData;
            this.setStatus(`Revoked shared directives for ${repo}.`, 2500);
            this.requestUpdate();
        }
    }

    _renderAgentDirectivesSection(allRepos) {
        const d = this._directivesData;
        const activeRepo = d?.repo || this._selectedRepo || allRepos[0] || '';
        const tiers = d?.tiers || {};
        // Same order as the prompt (DIRECTIVE_TIERS): least to most authoritative.
        const tierOrder = [
            ...(activeRepo ? [
                { id: 'repo_shared', label: `1. Shared Repository Directives (${activeRepo})`, scope: 'repo' }
            ] : []),
            { id: 'user', label: '2. Your Directives (User Tier)', scope: 'daemon' },
            { id: 'workspace', label: '3. Workspace Directives', scope: 'workspace' },
            ...(activeRepo ? [
                { id: 'repo_local', label: `4. Local Repository Directives (${activeRepo}, git-ignored)`, scope: 'repo' }
            ] : [])
        ];
        const sharedInfo = tiers.repo_shared || {};
        const hasDiffFromAccepted = Boolean(
            sharedInfo.accepted_body && sharedInfo.body && sharedInfo.accepted_body !== sharedInfo.body
        );

        return html`
            <sutram-collapsible titleText="Directives (4-Tier Markdown-as-Code)" intent="highlight" ?open=${true}>
                <sutram-stack direction="col" gap="md">
                    <sutram-label text="Prose instructions assembled into sys.directives (Repository Shared → User → Workspace → Repository Local). Later sections win on conflict."></sutram-label>
                    ${allRepos.length > 1 ? html`
                        <sutram-select
                            label="Target Repository for Repository Directives"
                            ?flush=${true}
                            .value=${activeRepo}
                            .options=${allRepos.map(r => ({ value: r, label: r }))}
                            @sutram-input-changed=${e => {
                                this._selectedRepo = e.detail.value;
                                this._fetchDirectives(e.detail.value);
                            }}>
                        </sutram-select>
                    ` : ''}
                    ${(d?.notices || []).map(notice => html`
                        <sutram-surface variant="tinted" intent="warning" padding="xs">
                            <sutram-label intent="warning" .text=${notice}></sutram-label>
                        </sutram-surface>
                    `)}
                    ${tierOrder.map(tSpec => {
                        const info = tiers[tSpec.id] || {};
                        const isShared = tSpec.id === 'repo_shared';
                        const waitingAcceptance = isShared && info.body && !info.accepted;
                        return html`
                            <sutram-field-card
                                .label=${tSpec.label}
                                .description=${info.uri || ''}
                                .scope=${tSpec.scope}>
                                <sutram-stack slot="header-actions" direction="row" align="center" gap="xs" ?wrap=${true}>
                                    ${waitingAcceptance ? html`
                                        <sutram-tag text="Not in prompts until you accept" intent="warning"></sutram-tag>
                                        ${hasDiffFromAccepted ? html`
                                            <sutram-btn
                                                ?compact=${true}
                                                intent="warning"
                                                icon="git-compare"
                                                label="View Diff"
                                                @click=${() => { this._directivesDiffOpen = true; }}>
                                            </sutram-btn>
                                        ` : ''}
                                        <sutram-async-btn
                                            ?compact=${true}
                                            intent="success"
                                            icon="check"
                                            label="Accept"
                                            .onClick=${() => this._acceptSharedDirectives()}>
                                        </sutram-async-btn>
                                    ` : (isShared && info.accepted && info.body ? html`
                                        <sutram-tag text="Accepted" intent="success"></sutram-tag>
                                        <sutram-async-btn
                                            ?compact=${true}
                                            intent="neutral"
                                            icon="x"
                                            label="Revoke"
                                            .onClick=${() => this._revokeSharedDirectives()}>
                                        </sutram-async-btn>
                                    ` : '')}
                                    <sutram-async-btn
                                        ?compact=${true}
                                        intent="primary"
                                        icon="save"
                                        label="Save Tier"
                                        .onClick=${() => this._saveDirectiveTier(tSpec.id)}>
                                    </sutram-async-btn>
                                </sutram-stack>
                                <sutram-textarea
                                    ?flush=${true}
                                    .monospace=${true}
                                    placeholder="Markdown directives for this tier..."
                                    .value=${this._directiveDrafts?.[tSpec.id] ?? info.body ?? ''}
                                    @sutram-input-changed=${e => {
                                        this._directiveDrafts = { ...(this._directiveDrafts || {}), [tSpec.id]: e.detail.value };
                                    }}>
                                </sutram-textarea>
                            </sutram-field-card>
                        `;
                    })}
                </sutram-stack>
            </sutram-collapsible>
            ${this._directivesDiffOpen ? html`
                <sutram-modal
                    ?open=${true}
                    ?fullscreen=${true}
                    ?flush=${true}
                    titleText=${`Directive Changes in ${activeRepo}`}
                    @sutram-modal-closed=${() => { this._directivesDiffOpen = false; }}>
                    <sutram-view slot="body" ?flush=${true} ?noScroll=${true}>
                        <sutram-diff-viewer
                            .searchStr=${sharedInfo.accepted_body || ''}
                            .replaceStr=${sharedInfo.body || ''}
                            leftTitle="Previously Accepted"
                            rightTitle="Current on Disk">
                        </sutram-diff-viewer>
                    </sutram-view>
                    <sutram-btn slot="footer" intent="neutral" icon="x" label="Close" @click=${() => { this._directivesDiffOpen = false; }}></sutram-btn>
                    <sutram-async-btn slot="footer" intent="success" icon="check" label="Accept Current Directives" .onClick=${() => this._acceptSharedDirectives()}></sutram-async-btn>
                </sutram-modal>
            ` : ''}
        `;
    }

    async _drillIntoExtension(extName) {
        const allRepos = this.ecosystem?.allRepos || [];
        if (!this._selectedRepo && allRepos.length > 0) {
            this._selectedRepo = allRepos[0];
        }
        this._activeView = 'ext:' + extName;
        await this._fetchExtSettings(extName, this._selectedRepo);
        if (extName === 'agent') {
            await this._fetchDirectives(this._selectedRepo);
        }
        if (extName === 'llm') {
            try {
                const [profRes, catRes] = await Promise.all([
                    this.api.get('llm/profiles'),
                    Object.keys(this._llmCatalogMap || {}).length === 0 ? this.api.get('llm/catalog') : Promise.resolve(null)
                ]);
                if (profRes && profRes.ok) {
                    const profData = await profRes.json();
                    if (profData?.driver_tier_defaults && typeof profData.driver_tier_defaults === 'object') {
                        this._driverTierDefaults = { ...this._driverTierDefaults, ...profData.driver_tier_defaults };
                    }
                    if (Array.isArray(profData?.endpoints) && profData.endpoints.length > 0) {
                        const curLlmForm = this._extForms.llm || {};
                        const curEps = Array.isArray(curLlmForm.compute_endpoints) ? [...curLlmForm.compute_endpoints] : [];
                        profData.endpoints.forEach(ep => {
                            if (ep && ep.id && !curEps.some(e => e && e.id === ep.id)) {
                                curEps.push({ ...ep });
                            }
                        });
                        this._extForms = {
                            ...this._extForms,
                            llm: { ...curLlmForm, compute_endpoints: curEps }
                        };
                    }
                }
                if (catRes && catRes.ok) {
                    const catData = await catRes.json();
                    this._ingestLlmCatalogPayload(catData);
                } else {
                    this._healProfileTiersForEndpoints();
                    this.requestUpdate();
                }
            } catch (_) {}
        }
    }

    _ingestLlmCatalogPayload(catData) {
        if (!catData || typeof catData !== 'object') return;
        const map = {};
        (catData.models || []).forEach(m => {
            if (m && m.id) {
                const key = m.source && m.category === 'local' ? `${m.source}::${m.id}` : m.id;
                map[key] = m;
                if (!map[m.id]) map[m.id] = m;
            }
        });
        this._llmCatalogMap = map;
        if (catData.driver_tier_defaults && typeof catData.driver_tier_defaults === 'object') {
            this._driverTierDefaults = { ...this._driverTierDefaults, ...catData.driver_tier_defaults };
        }
        this._healProfileTiersForEndpoints();
        this.requestUpdate();
    }

    _isModelForeignToDriver(modelId, driver) {
        const m = String(modelId || '').trim().toLowerCase();
        if (!m) return true;
        const isWebChatToken = m === 'chatbot' || m === 'web_chat' || m === 'manual' || m.startsWith('web-chat');
        if (driver === 'web_chat') return !isWebChatToken;
        if (isWebChatToken && driver !== 'web_chat') return true;
        if (driver === 'gemini') return m.startsWith('claude-') || m.startsWith('anthropic/');
        if (driver === 'anthropic' || driver === 'claude_cli') return m.startsWith('gemini-') || m.startsWith('google/');
        if (driver === 'decisions') return !m.includes('jev') && !m.includes('drex') && !m.includes('liquid');
        return false;
    }

    _getDefaultModelForEndpointTier(ep, tierId) {
        if (!ep) return '';
        const driver = String(ep.driver || 'openai_compatible').toLowerCase();
        const custom = Array.isArray(ep.custom_models) ? ep.custom_models : [];
        if (custom.length > 0) return custom[0];
        if (driver === 'openai_compatible') {
            const localMatch = Object.values(this._llmCatalogMap || {}).find(
                e => e && (String(e.source || '').toLowerCase() === String(ep.id || '').toLowerCase())
            );
            return localMatch ? localMatch.id : '';
        }
        const driverMap = (this._driverTierDefaults || {})[driver] || {};
        return driverMap[tierId] || driverMap.standard || '';
    }

    _healProfileTiersForEndpoints() {
        const llmForm = this._extForms?.llm;
        if (!llmForm) return;
        const rawEndpoints = Array.isArray(llmForm.compute_endpoints) ? [...llmForm.compute_endpoints] : [];
        if (!rawEndpoints.some(e => e && (e.id === 'web_chat' || e.driver === 'web_chat'))) {
            rawEndpoints.push({
                id: 'web_chat',
                label: 'External Web Chatbot (Copy Context + Prompt Handoff)',
                driver: 'web_chat',
                base_url: '',
                api_key: '',
                custom_models: ['chatbot'],
                models: ['chatbot'],
                max_parallel: 1,
                enabled: true,
                is_system: true
            });
        }
        const endpoints = rawEndpoints;
        const profiles = Array.isArray(llmForm.llm_profiles) ? llmForm.llm_profiles : [];
        if (endpoints.length === 0 || profiles.length === 0) return;

        const epById = {};
        endpoints.forEach(e => { if (e && e.id) epById[e.id] = e; });
        const fallbackEp = endpoints[0];
        let mutated = false;

        const nextProfiles = profiles.map(prof => {
            if (!prof || typeof prof !== 'object') return prof;
            const rawTiers = (prof.tiers && typeof prof.tiers === 'object') ? { ...prof.tiers } : {};
            let profMutated = false;

            ['decision', 'fast', 'standard', 'thinking', 'frontier'].forEach(tKey => {
                let tVal = rawTiers[tKey];
                if (typeof tVal === 'string') {
                    if (tVal.includes('::')) {
                        const [ePart, mPart] = tVal.split('::');
                        tVal = { endpoint: ePart.trim(), model: mPart.trim() };
                    } else {
                        tVal = { endpoint: tVal ? fallbackEp.id : '', model: tVal.trim() };
                    }
                    profMutated = true;
                } else if (!tVal || typeof tVal !== 'object') {
                    tVal = { endpoint: tKey === 'decision' ? '' : fallbackEp.id, model: '' };
                    profMutated = true;
                } else {
                    tVal = { ...tVal };
                }

                if (tKey !== 'decision' && (!tVal.endpoint || !epById[tVal.endpoint])) {
                    tVal.endpoint = fallbackEp.id;
                    profMutated = true;
                }

                const targetEp = epById[tVal.endpoint];
                if (targetEp) {
                    const drv = String(targetEp.driver || '').toLowerCase();
                    if (!tVal.model || this._isModelForeignToDriver(tVal.model, drv)) {
                        const suggested = this._getDefaultModelForEndpointTier(targetEp, tKey);
                        if (suggested && suggested !== tVal.model) {
                            tVal.model = suggested;
                            profMutated = true;
                        }
                    }
                }
                rawTiers[tKey] = tVal;
            });

            if (profMutated) {
                mutated = true;
                return { ...prof, tiers: rawTiers };
            }
            return prof;
        });

        if (mutated || endpoints.length !== (llmForm.compute_endpoints || []).length) {
            this._extForms = {
                ...this._extForms,
                llm: { ...llmForm, compute_endpoints: endpoints, llm_profiles: nextProfiles }
            };
        }
    }
    _renderCustomActionComponent(tagName) {
        if (!tagName) return html``;
        const Ctor = typeof customElements !== 'undefined' ? customElements.get(tagName) : null;
        if (Ctor) {
            if (!this._customActionNodes) this._customActionNodes = new Map();
            let node = this._customActionNodes.get(tagName);
            if (!node) {
                node = new Ctor();
                node.id = 'hub-custom-action-panel';
                node.embedded = true;
                node.setAttribute('embedded', '');
                this._customActionNodes.set(tagName, node);
            }
            return node;
        }
        return html``;
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
        this.registerGlobalListener('insetu:llm-catalog-updated', window, (e) => {
            if (e.detail) {
                this._ingestLlmCatalogPayload(e.detail);
            }
        });
        this.registerGlobalListener('sutram-settings-repo-changed', this, (e) => {
            const { extName, repo } = e.detail || {};
            if (extName && repo) {
                this._selectedRepo = repo;
                this._fetchExtSettings(extName, repo, true);
                if (extName === 'agent') {
                    this._fetchDirectives(repo);
                }
            }
        });
        this.registerGlobalListener('sutram-settings-custom-action', this, (e) => {
            const act = e.detail?.action;
            const parentExt = e.detail?.extName || act?.extName || (this._activeView?.startsWith('ext:') ? this._activeView.slice(4) : null);
            if (act && (typeof act.render === 'function' || act.component)) {
                this._activeCustomAction = parentExt ? { ...act, extName: parentExt } : act;
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
            const layout = window.Sutram.stores.Layout.getState();
            if (typeof layout.setUserCapacity === 'function') {
                layout.setUserCapacity(cap);
            } else {
                layout.setCapacity(cap);
            }
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
            const res = await this.api.get('system/config?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this._sysConfigForm = data.config || {};
                this._sysConfigMeta = data.meta || {};
                if (data.meta?.settings_schemas) {
                    window.inSetu.serverSchemas = { ...(window.inSetu.serverSchemas || {}), ...data.meta.settings_schemas };
                }
                window.inSetu.utils.syncExtensionDependencyMeta?.(data);
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
            const res = await this.api.post('system/config', this._sysConfigForm);
            if (res.ok) {
                const data = await res.json();
                if (data.requires_reboot) {
                    this.setStatus("Reboot required. Restarting...", 3000, true);
                    AppStore.setState({ isRebooting: true, rebootType: 'reboot' });
                    await this.api.post('system/reboot', {});
                    if (window.inSetu?.sys?.waitForDaemonReboot) {
                        window.inSetu.sys.waitForDaemonReboot();
                    } else {
                        setTimeout(() => window.location.reload(), 2500);
                    }
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
        const wsOptions = otherWorkspaces.length > 0
            ? otherWorkspaces.map(w => {
                const wsTitle = (this.workspaces && this.workspaces[w] && this.workspaces[w].title) ? this.workspaces[w].title : w;
                return { value: w, label: `${wsTitle} (${w})` };
            })
            : [{ value: 'default', label: 'default' }];

        const sysSchema = window.inSetu.serverSchemas?.system || window.inSetu.settingsSchemas?.system || [];
        const mountsField = sysSchema.find(f => f && f.id === 'shared_mounts');
        const schemaDomainField = (mountsField?.item_schema || []).find(sf => sf && sf.id === 'domain');
        const domainOptions = (Array.isArray(schemaDomainField?.options) && schemaDomainField.options.length > 0)
            ? schemaDomainField.options
            : [
                { value: 'prompts', label: 'prompts (.insetu/data/prompts)' },
                { value: 'agent', label: 'routines (.insetu/data/agent)' },
                { value: '*', label: '* (All Domains)' }
            ];

        if (this._mountsLoading) {
            return html`<sutram-surface variant="ghost" padding="lg"><sutram-spinner text="Loading mount configurations..."></sutram-spinner></sutram-surface>`;
        }

        const subscriberSchema = {
            id: 'shared_mounts',
            label: 'Virtual Mounts (Subscriber ws://)',
            scope: 'workspace',
            min_items: 0,
            max_items: 32,
            item_label: 'Mount',
            item_title_key: 'workspace_id',
            item_subtitle_key: 'domain',
            add_label: 'Add Virtual Mount',
            empty_text: 'No external domains mounted in this workspace.',
            description: 'External workspace assets mounted read-only into this tenant via ws://<workspace>/<domain>/ URIs.',
            item_schema: [
                { id: 'workspace_id', label: 'Source Workspace', type: 'select', default: wsOptions[0]?.value || 'default', options: wsOptions },
                { id: 'domain', label: 'Target Domain', type: 'select', default: 'prompts', options: domainOptions }
            ]
        };

        const publisherSchema = {
            id: 'export_shared_domains',
            label: 'Exported Domains (Publisher)',
            scope: 'workspace',
            min_items: 0,
            max_items: 16,
            item_label: 'Export',
            item_title_key: 'domain',
            add_label: 'Export Local Domain',
            empty_text: 'No local domains currently exported to peer workspaces.',
            description: 'Local directories declared accessible to other workspace tenants on this system.',
            item_schema: [
                { id: 'domain', label: 'Local Domain', type: 'select', default: 'prompts', options: domainOptions.filter(d => d.value !== '*') },
                { id: 'wildcard', label: 'Access Scope', toggle_label: 'Authorize All Workspaces (*)', type: 'boolean', default: true },
                {
                    id: 'allowed',
                    label: 'Permitted Subscriber Workspace IDs (Comma-Separated)',
                    type: 'comma_list',
                    default: [],
                    placeholder: otherWorkspaces.join(', ') || 'workspace_a, workspace_b',
                    show_if: { field: 'wildcard', equals: false }
                }
            ]
        };

        return html`
            <sutram-stack direction="col" gap="md">
                <insetu-schema-repeater
                    .field=${subscriberSchema}
                    .items=${this._sharedMounts || []}
                    @insetu-repeater-changed=${e => { this._sharedMounts = e.detail.value; this.requestUpdate(); }}>
                </insetu-schema-repeater>
                <insetu-schema-repeater
                    .field=${publisherSchema}
                    .items=${this._exportRepeaterItems || []}
                    @insetu-repeater-changed=${e => { this._exportRepeaterItems = e.detail.value; this.requestUpdate(); }}>
                </insetu-schema-repeater>
            </sutram-stack>
        `;
    }
    async _loadWorkspacesManifest() {
        try {
            const res = await this.api.get('system/workspaces?t=' + Date.now(), { cache: 'no-store' });
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
        const res = await this.api.post('system/workspaces/create', { id: wsId, workspace_root: wsRoot });
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
            const res = await this.api.post('system/workspaces/delete', { id: wsId });
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
            <sutram-stack direction="col" gap="md">
                <sutram-collapsible titleText="Provision New Isolated Workspace" intent="success" ?open=${true}>
                    <sutram-stack direction="col" gap="md">
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
                            <sutram-stack direction="row" gap="sm" align="center">
                                <sutram-input placeholder="e.g. ~/Documents/GuitarRepertoire" .value=${this._newWsRoot} @sutram-input-changed=${e => this._newWsRoot = e.detail.value} ?flush=${true} ?grow=${true}></sutram-input>
                                <sutram-btn intent="highlight" label="Browse..." icon="folder" @click=${() => { this._showHostBrowser = true; }}></sutram-btn>
                            </sutram-stack>
                        </sutram-field-card>

                        <sutram-async-btn icon="plus" label="Provision & Mount Isolated Workspace" intent="success" ?fullWidth=${true} .onClick=${(e) => this._handleCreateWorkspace(e)}></sutram-async-btn>
                    </sutram-stack>
                </sutram-collapsible>

                <sutram-collapsible titleText="Registered Workspaces Index (${Object.keys(this.workspaces || {}).length})" intent="primary" ?open=${true}>
                    <sutram-stack direction="col" gap="sm">
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
                                    <sutram-stack slot="header-actions" direction="row" gap="sm" align="center">
                                        ${!isActive ? html`
                                            <sutram-btn ?compact=${true} intent="primary" icon="arrow-right" label="Switch Active" @click=${(e) => {
                                                e.stopPropagation();
                                                this.modalOpen = false;
                                                this._activeView = null;
                                                if (window.inSetu.sys.executeWorkspaceSwap) {
                                                    window.inSetu.sys.executeWorkspaceSwap(wsId, wsTitle);
                                                }
                                            }}></sutram-btn>
                                        ` : ''}
                                        ${wsId !== 'default' ? html`
                                            <sutram-btn ?compact=${true} intent="danger" icon="trash-2" label="Remove" @click=${(e) => {
                                                e.stopPropagation();
                                                this._handleDeleteWorkspace(wsId);
                                            }}></sutram-btn>
                                        ` : html`<sutram-tag text="System Protected" intent="neutral"></sutram-tag>`}
                                    </sutram-stack>
                                </sutram-card>
                            `;
                        })}
                    </sutram-stack>
                </sutram-collapsible>
            </sutram-stack>
        `;
    }
    _renderActiveDrillDownBody(activeExtModule, activeCustomAction, allRepos) {
        if (typeof activeCustomAction?.render === 'function') {
            return activeCustomAction.render();
        }
        if (activeCustomAction?.component) {
            return this._renderCustomActionComponent(activeCustomAction.component);
        }
        if (this._activeView === 'sys:topology') {
            return html`
                <insetu-ext-config
                    id="hub-topology-editor"
                    ?embedded=${true}
                    @insetu-topology-mode-changed=${(e) => {
                        this._topologyEditingRepo = !!e.detail.isEditingRepo;
                        this._topologyIsNewRepo = !!e.detail.isNewRepo;
                        this._topologyRepoTitle = e.detail.activeRepoTitle || '';
                    }}>
                </insetu-ext-config>
            `;
        }
        if (this._activeView === 'sys:workspaces') {
            return this._renderWorkspacesDrillDown();
        }
        if (this._activeView === 'sys:mounts') {
            return this._renderMountsDrillDown();
        }
        if (this._activeView === 'sys:extensions') {
            return this._renderManageExtensionsDrillDown();
        }
        return this._renderGenericExtensionDrillDown(activeExtModule, allRepos);
    }

    _resolveTargetBindingModels(subField, endpointId, rootFormData = {}) {
        const endpoints = Array.isArray(rootFormData?.compute_endpoints) ? rootFormData.compute_endpoints : [];
        const ep = endpoints.find(e => e && e.id === endpointId);
        if (!ep) return [];

        const driver = String(ep.driver || 'openai_compatible').toLowerCase();
        const customModels = Array.isArray(ep.custom_models)
            ? ep.custom_models
            : (Array.isArray(ep.models)
                ? ep.models
                : String(ep.custom_models || ep.models || '').split(',').map(s => s.trim()).filter(Boolean));

        const targetTier = String(subField?.id || 'standard').toLowerCase();
        const driverTierMap = (this._driverTierDefaults || {})[driver] || {};
        const recommendedDefaultForTier = driverTierMap[targetTier] || '';
        const curatedFromDefaults = Array.from(new Set(Object.values(driverTierMap).filter(Boolean)));

        const seen = new Set();
        const tierMatchedOptions = [];
        const otherOptions = [];

        const formatBadge = (catEntry, recTier = '') => {
            const parts = [];
            const effectiveTier = recTier || catEntry?.recommended_tier || '';
            if (effectiveTier) {
                parts.push(effectiveTier.toUpperCase());
            }
            if (catEntry?.context_length) {
                parts.push(`${Math.round(catEntry.context_length / 1000)}k`);
            }
            if (catEntry?.category === 'local') {
                parts.push('Local $0');
            } else if (catEntry && (catEntry.input_cost_per_1m || catEntry.output_cost_per_1m)) {
                parts.push(`$${catEntry.input_cost_per_1m}/$${catEntry.output_cost_per_1m}`);
            }
            return parts.join(' • ');
        };

        const addModelOption = (modelId, catEntry = null, badgeOverride = '', isTierMatch = false) => {
            const cleanId = String(modelId || '').trim();
            if (!cleanId || seen.has(cleanId)) return;
            seen.add(cleanId);
            const entry = catEntry || (this._llmCatalogMap || {})[cleanId] || (this._llmCatalogMap || {})[`${endpointId}::${cleanId}`];
            const matchesTier = isTierMatch || cleanId === recommendedDefaultForTier || (entry?.recommended_tier === targetTier);
            const item = {
                value: cleanId,
                label: cleanId,
                badge: badgeOverride || formatBadge(entry, cleanId === recommendedDefaultForTier ? targetTier : '')
            };
            if (matchesTier) {
                tierMatchedOptions.push(item);
            } else {
                otherOptions.push(item);
            }
        };

        if (driver === 'web_chat') {
            addModelOption('chatbot', null, 'MANUAL HANDOFF', true);
            return tierMatchedOptions;
        }
        customModels.forEach(m => addModelOption(m, null, 'CUSTOM', true));
        if (recommendedDefaultForTier) {
            addModelOption(recommendedDefaultForTier, null, '', true);
        }
        curatedFromDefaults.forEach(m => addModelOption(m));

        Object.values(this._llmCatalogMap || {}).forEach(entry => {
            if (!entry || !entry.id) return;
            const prov = String(entry.provider || '').toLowerCase();
            const src = String(entry.source || '').toLowerCase();
            if (driver === 'anthropic' && (prov === 'anthropic' || entry.id.startsWith('claude-'))) {
                const bareId = entry.id.startsWith('anthropic/') ? entry.id.slice('anthropic/'.length) : entry.id;
                addModelOption(bareId, entry);
            } else if (driver === 'gemini' && (prov === 'google' || prov === 'gemini' || entry.id.includes('gemini'))) {
                const bareId = entry.id.includes('/') ? entry.id.split('/').pop() : entry.id;
                addModelOption(bareId, entry);
            } else if (driver === 'openrouter' && src === 'openrouter') {
                addModelOption(entry.id, entry);
            } else if (driver === 'decisions' && entry.category === 'decision') {
                addModelOption(entry.id, entry);
            } else if (driver === 'openai_compatible' && (src === endpointId.toLowerCase() || prov === endpointId.toLowerCase())) {
                addModelOption(entry.id, entry);
            }
        });

        return [...tierMatchedOptions, ...otherOptions];
    }

    _renderGenericExtensionDrillDown(activeExtModule, allRepos) {
        const fullSchema = activeExtModule?.schema || [];
        const scalarSchema = fullSchema.filter(s => s && s.type !== 'repeater');
        const repeaterSchema = fullSchema.filter(s => s && s.type === 'repeater');
        const extForm = this._extForms[activeExtModule.id] || {};
        const boundResolver = (subField, epId, rootData) => this._resolveTargetBindingModels(subField, epId, rootData || extForm);

        const hydratedScalarSchema = scalarSchema.map(f => {
            if (f && f.type === 'select' && f.options_from && typeof f.options_from === 'object') {
                const srcArr = Array.isArray(extForm[f.options_from.field])
                    ? extForm[f.options_from.field]
                    : (Array.isArray((repeaterSchema.find(r => r.id === f.options_from.field) || {}).default)
                        ? repeaterSchema.find(r => r.id === f.options_from.field).default
                        : []);
                const vKey = f.options_from.value_key || 'id';
                const lKey = f.options_from.label_key || 'title';
                const resolvedOptions = srcArr
                    .filter(it => it && typeof it === 'object' && (it[vKey] || it[lKey]))
                    .map(it => ({ value: String(it[vKey] || it[lKey]), label: String(it[lKey] || it[vKey]) }));
                return { ...f, options: resolvedOptions.length > 0 ? resolvedOptions : [{ value: 'default', label: 'Default Configuration' }] };
            }
            return f;
        });

        return html`
            <sutram-settings-form
                id="hub-active-settings-form"
                .extName=${activeExtModule.id}
                .schema=${hydratedScalarSchema}
                .formData=${extForm}
                .repos=${allRepos}
                .selectedRepo=${this._selectedRepo}
                .optionResolver=${boundResolver}
                ?hideSaveButton=${true}
                @sutram-settings-form-changed=${(e) => {
                    const merged = { ...(this._extForms[activeExtModule.id] || {}), ...(e.detail.formData || {}) };
                    this._extForms = { ...this._extForms, [activeExtModule.id]: merged };
                    this.requestUpdate();
                }}>
            </sutram-settings-form>
            ${repeaterSchema.map(repField => html`
                <insetu-schema-repeater
                    .field=${repField}
                    .items=${Array.isArray(extForm[repField.id]) ? extForm[repField.id] : (Array.isArray(repField.default) ? repField.default : [])}
                    .rootFormData=${extForm}
                    .optionResolver=${boundResolver}
                    @insetu-repeater-changed=${(e) => {
                        let nextExtForm = {
                            ...(this._extForms[activeExtModule.id] || {}),
                            [e.detail.id]: e.detail.value
                        };
                        if (e.detail.renamedId?.from && e.detail.renamedId?.to) {
                            nextExtForm = cascadeRepeaterIdRename(
                                fullSchema,
                                nextExtForm,
                                e.detail.id,
                                e.detail.renamedId.from,
                                e.detail.renamedId.to
                            );
                        }
                        if (activeExtModule.id === 'llm' && e.detail.id === 'llm_profiles') {
                            const profiles = Array.isArray(e.detail.value) ? e.detail.value : [];
                            if (profiles.length > 0 && !profiles.some(p => p && p.id === nextExtForm.active_profile_id)) {
                                nextExtForm.active_profile_id = profiles[0].id;
                            }
                        }
                        this._extForms = { ...this._extForms, [activeExtModule.id]: nextExtForm };
                        if (activeExtModule.id === 'llm' && (e.detail.id === 'compute_endpoints' || e.detail.id === 'llm_profiles')) {
                            this._healProfileTiersForEndpoints();
                        }
                        this.requestUpdate();
                    }}>
                </insetu-schema-repeater>
            `)}
            ${activeExtModule?.id === 'agent' ? this._renderAgentDirectivesSection(allRepos) : ''}
        `;
    }

    _renderManageExtensionsDrillDown() {
        const mountedList = this._sysConfigMeta?.mounted_extensions || [];
        return html`
            <sutram-stack direction="col" gap="sm">
                <sutram-label text="Enable or disable optional domain extensions for this workspace. Extensions already mounted in RAM apply with a zero-downtime soft refresh; newly activated extensions will automatically reboot the daemon."></sutram-label>
                ${(this._sysConfigMeta?.available_extensions || []).map(ext => {
                    const isConfig = ext.id === 'config';
                    const isChecked = (this._sysConfigForm.extensions || []).includes(ext.id) || isConfig;
                    const isMounted = isConfig || mountedList.includes(ext.id);
                    const missingPy = ext.missing_externals || [];
                    const missingBins = ext.missing_binaries || [];
                    const hasMissingDeps = missingPy.length > 0 || missingBins.length > 0;
                    return html`
                        <sutram-surface variant=${hasMissingDeps && isChecked ? 'tinted' : 'panel'} intent=${hasMissingDeps && isChecked ? 'warning' : 'neutral'} padding="md">
                            <sutram-stack direction="row" align="start" gap="md">
                                <sutram-toggle .checked=${isChecked} ?disabled=${isConfig} @sutram-input-changed=${(e) => { const current = this._sysConfigForm.extensions || []; const newExts = e.detail.value ? (current.includes(ext.id) ? current : [...current, ext.id]) : current.filter(x => x !== ext.id); this._sysConfigForm = { ...this._sysConfigForm, extensions: newExts }; this.requestUpdate(); }} ?flush=${true}></sutram-toggle>
                                <sutram-stack direction="col" gap="xs" ?flex=${true}>
                                    <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                        <strong>
                                            ${ext.title} <code>(${ext.id})</code>
                                        </strong>
                                        <sutram-stack direction="row" gap="xs" align="center" ?wrap=${true}>
                                            ${hasMissingDeps ? html`<sutram-tag text="Missing Deps" intent="danger"></sutram-tag>` : ''}
                                            ${isMounted
                                                ? html`<sutram-tag text="Mounted in RAM" intent="success"></sutram-tag>`
                                                : html`<sutram-tag text="Requires Reboot" intent="warning"></sutram-tag>`}
                                            <sutram-tag text="workspace" intent="primary"></sutram-tag>
                                        </sutram-stack>
                                    </sutram-stack>
                                    ${ext.description ? html`<sutram-label .text=${ext.description}></sutram-label>` : ''}
                                    ${missingPy.length > 0 ? html`
                                        <sutram-surface variant="inset" padding="xs">
                                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                                <span>Missing Python packages: <code>pip install ${missingPy.join(' ')}</code></span>
                                                <sutram-async-btn
                                                    ?compact=${true}
                                                    intent="primary"
                                                    icon="download"
                                                    label="Install Now"
                                                    .onClick=${this.installExtensionDependencies(ext.id, async () => {
                                                        await this._openSettings('sys:extensions');
                                                    })}>
                                                </sutram-async-btn>
                                            </sutram-stack>
                                        </sutram-surface>
                                    ` : ''}
                                    ${missingBins.length > 0 ? html`
                                        <sutram-surface variant="tinted" intent="danger" padding="xs">
                                            <span>Missing system binaries in PATH: <code>${missingBins.join(', ')}</code></span>
                                        </sutram-surface>
                                    ` : ''}
                                </sutram-stack>
                            </sutram-stack>
                        </sutram-surface>
                    `;
                })}
            </sutram-stack>
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
            <sutram-dropdown align="right" direction="down" .open=${this.menuOpen}>
                <button slot="trigger" class="system-action-btn" title="System Menu">
                    <sutram-icon name="settings" size="md"></sutram-icon>
                </button>
                <sutram-stack slot="content" direction="col" gap="compact" padding="xs">
                    <sutram-stack direction="col" gap="xs">
                        <sutram-label text="SYSTEM"></sutram-label>
                        <sutram-btn intent="highlight" variant="tinted" icon="settings-2" label="Settings Hub" ?fullWidth=${true} @click=${() => this._openSettings()}></sutram-btn>
                        <sutram-btn intent="highlight" variant="tinted" icon="book" label="Documentation" ?fullWidth=${true} @click=${() => this._openDocsModal()}></sutram-btn>
                        <sutram-btn intent="danger" variant="tinted" icon="refresh-cw" label="Force UI Refresh" ?fullWidth=${true} @click=${() => { this.menuOpen = false; if(window.inSetu.sys.fullRefresh) window.inSetu.sys.fullRefresh(); }}></sutram-btn>
                    </sutram-stack>

                    <sutram-stack direction="col" gap="xs">
                        <sutram-label text="WORKSPACE"></sutram-label>
                        <sutram-btn intent="success" variant="tinted" ?active=${true} icon="package" label="${this.workspaces[activeWs]?.title || activeWs} ✓" ?fullWidth=${true}></sutram-btn>
                        ${Object.entries(this.workspaces).filter(([key, _]) => key !== activeWs).map(([key, ws]) => html`
                            <sutram-btn intent="success" variant="tinted" icon="layout-grid" label=${ws.title || key} ?fullWidth=${true}
                                @click=${(e) => {  
                                    e.stopPropagation(); 
                                    this.menuOpen = false; 
                                    if (window.inSetu.sys.executeWorkspaceSwap) {
                                        window.inSetu.sys.executeWorkspaceSwap(key, ws.title);
                                    }
                                }}>
                            </sutram-btn>
                        `)}
                    </sutram-stack>

                    <sutram-stack direction="col" gap="xs">
                        <sutram-label text="DISPLAY THEME"></sutram-label>
                        <sutram-stack direction="row" gap="xs">
                            <sutram-btn intent="${this.currentTheme === 'dark' ? 'warning' : 'neutral'}" variant="tinted" ?active=${this.currentTheme === 'dark'} ?grow=${true} @click=${() => this._setTheme('dark')} .label=${html`<sutram-stack direction="col" align="center" gap="xs"><sutram-icon name="moon" size="md" intent="${this.currentTheme === 'dark' ? 'warning' : 'muted'}"></sutram-icon><span>Dark</span></sutram-stack>`}></sutram-btn>
                            <sutram-btn intent="${this.currentTheme === 'light' ? 'warning' : 'neutral'}" variant="tinted" ?active=${this.currentTheme === 'light'} ?grow=${true} @click=${() => this._setTheme('light')} .label=${html`<sutram-stack direction="col" align="center" gap="xs"><sutram-icon name="sun" size="md" intent="${this.currentTheme === 'light' ? 'warning' : 'muted'}"></sutram-icon><span>Light</span></sutram-stack>`}></sutram-btn>
                            <sutram-btn intent="${this.currentTheme === 'e-ink' ? 'warning' : 'neutral'}" variant="tinted" ?active=${this.currentTheme === 'e-ink'} ?grow=${true} @click=${() => this._setTheme('e-ink')} .label=${html`<sutram-stack direction="col" align="center" gap="xs"><sutram-icon name="book-open" size="md" intent="${this.currentTheme === 'e-ink' ? 'warning' : 'muted'}"></sutram-icon><span>E-Ink</span></sutram-stack>`}></sutram-btn>
                        </sutram-stack>
                    </sutram-stack>

                    <sutram-stack direction="col" gap="xs">
                        <sutram-label text="VIEWPORT GRID"></sutram-label>
                        <sutram-stack direction="row" gap="xs">
                            <sutram-btn intent="${this.layoutCapacity === 1 ? 'primary' : 'neutral'}" variant="tinted" ?active=${this.layoutCapacity === 1} ?grow=${true} @click=${() => this._setLayoutCapacity(1)} .label=${html`<sutram-stack direction="col" align="center" gap="xs"><sutram-icon name="smartphone" size="md" intent="${this.layoutCapacity === 1 ? 'primary' : 'muted'}"></sutram-icon><span>1-Col</span></sutram-stack>`}></sutram-btn>
                            <sutram-btn intent="${this.layoutCapacity === 2 ? 'primary' : 'neutral'}" variant="tinted" ?active=${this.layoutCapacity === 2} ?grow=${true} @click=${() => this._setLayoutCapacity(2)} .label=${html`<sutram-stack direction="col" align="center" gap="xs"><sutram-icon name="tablet" size="md" intent="${this.layoutCapacity === 2 ? 'primary' : 'muted'}"></sutram-icon><span>2-Col</span></sutram-stack>`}></sutram-btn>
                            <sutram-btn intent="${this.layoutCapacity === 3 ? 'primary' : 'neutral'}" variant="tinted" ?active=${this.layoutCapacity === 3} ?grow=${true} @click=${() => this._setLayoutCapacity(3)} .label=${html`<sutram-stack direction="col" align="center" gap="xs"><sutram-icon name="monitor" size="md" intent="${this.layoutCapacity === 3 ? 'primary' : 'muted'}"></sutram-icon><span>3-Col</span></sutram-stack>`}></sutram-btn>
                        </sutram-stack>
                    </sutram-stack>
                </sutram-stack>
            </sutram-dropdown>

            ${this.modalOpen ? html`
            <sutram-modal 
                ?open=${true} 
                ?fullscreen=${true}
                ?flush=${true}
                titleText="OS Settings Hub" 
                @sutram-modal-closed=${(e) => { if (e.target !== e.currentTarget) return; this.modalOpen = false; this._activeView = null; }}>
                <sutram-stack slot="body" direction="col" gap="none">
                    ${this._activeView ? html`
                        <sutram-surface variant="panel" border="bottom" padding="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <sutram-btn
                                    intent="neutral"
                                    ?compact=${true}
                                    icon="corner-left-up"
                                    label=${(this._activeView === 'sys:topology' && this._topologyEditingRepo)
                                        ? 'Workspace Topology'
                                        : (activeCustomAction?.extName ? `Back to ${activeCustomAction.extName.charAt(0).toUpperCase() + activeCustomAction.extName.slice(1)}` : 'All Settings')}
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
                                <sutram-label intent="neutral" ?truncate=${true} .text=${drillHeaderTitle}></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                        <sutram-surface variant="ghost" padding="lg" gap="md">
                            ${this._renderActiveDrillDownBody(activeExtModule, activeCustomAction, allRepos)}
                        </sutram-surface>
                    ` : html`
                        <sutram-surface variant="panel" border="bottom" padding="md" gap="sm">
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
                                <sutram-scrub-track>
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-pill pillId="ALL" labelText="All" ?active=${this._categoryFilter === 'ALL'} @sutram-pill-toggled=${() => this._categoryFilter = 'ALL'}></sutram-pill>
                                        <sutram-pill pillId="SYSTEM" labelText="System & Workspace" ?active=${this._categoryFilter === 'SYSTEM'} @sutram-pill-toggled=${() => this._categoryFilter = 'SYSTEM'}></sutram-pill>
                                        <sutram-pill pillId="CORE" labelText="Core Engines" ?active=${this._categoryFilter === 'CORE'} @sutram-pill-toggled=${() => this._categoryFilter = 'CORE'}></sutram-pill>
                                        <sutram-pill pillId="EXT" labelText="Extensions" ?active=${this._categoryFilter === 'EXT'} @sutram-pill-toggled=${() => this._categoryFilter = 'EXT'}></sutram-pill>
                                    </sutram-stack>
                                </sutram-scrub-track>
                            ` : ''}
                        </sutram-surface>

                        <sutram-surface variant="ghost" padding="lg" gap="md">
                            ${q ? html`
                                ${allModules.filter(m => {
                                    const matchesTitle = [m.title, m.id, m.description].filter(Boolean).join(' ').toLowerCase().includes(q);
                                    const matchesField = (m.schema || []).some(f => f && f.type !== 'hidden' && [f.label, f.title, f.id, f.description].filter(Boolean).join(' ').toLowerCase().includes(q));
                                    return matchesTitle || matchesField;
                                }).map(m => html`
                                    <sutram-stack direction="col" gap="sm">
                                        <sutram-stack direction="row" justify="between" align="center">
                                            <h4>${m.title}</h4>
                                            <sutram-btn ?compact=${true} intent="neutral" label="Open Module" icon="arrow-right" @click=${() => { this._searchQuery = ''; this._drillIntoExtension(m.id); }}></sutram-btn>
                                        </sutram-stack>
                                        ${this._renderGenericExtensionDrillDown(m, allRepos)}
                                    </sutram-stack>
                                `)}
                            ` : html`
                                ${(this._categoryFilter === 'ALL' || this._categoryFilter === 'SYSTEM') ? html`
                                    <sutram-label text="SYSTEM & WORKSPACE"></sutram-label>
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
                                    <sutram-label text="CORE ENGINES"></sutram-label>
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
                                    <sutram-label text="ACTIVE EXTENSIONS"></sutram-label>
                                    ${extList.length === 0 ? html`
                                        <sutram-empty-state text="No configurable domain extensions active in this workspace."></sutram-empty-state>
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
                        </sutram-surface>
                    `}
                </sutram-stack>
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
                    <sutram-entity-actions 
                        slot="footer"
                        variant="footer"
                        .entityType=${'system_control'} 
                        .entityData=${{}}>
                    </sutram-entity-actions>
                `}
            </sutram-modal>
            ` : ''}
            ${this.docsModalOpen ? html`
            <sutram-modal 
                ?open=${true} 
                titleText="Documentation Hub"  
                ?fullscreen=${true} 
                @sutram-modal-closed=${() => this.docsModalOpen = false}>${!this._docsStatus ? html`
                    <sutram-surface variant="ghost" padding="lg"><sutram-spinner text="Scanning for documentation..."></sutram-spinner></sutram-surface>
                ` : html`
                    <sutram-stack slot="body" direction="col" gap="lg">
                        <sutram-stack direction="col" gap="sm">
                            <h4>Primary OS</h4>
                            <sutram-stack direction="grid" gap="sm">
                                ${this._docsStatus.filter(d => d.type === 'root').map(doc => html`
                                    <sutram-surface variant="panel" padding="sm">
                                        <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                            <strong>${doc.title}</strong>
                                            ${doc.exists
                                                ? html`<sutram-btn ?compact=${true} intent="success" label="Read" @click=${() => this._readDoc(doc)}></sutram-btn>`
                                                : html`<sutram-label text="No README"></sutram-label>`}
                                        </sutram-stack>
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-stack>
                        <sutram-stack direction="col" gap="sm">
                            <h4>Core Modules</h4>
                            <sutram-stack direction="grid" gap="sm">
                                ${this._docsStatus.filter(d => d.type === 'core').map(doc => html`
                                    <sutram-surface variant="panel" padding="sm">
                                        <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                            <strong>${doc.title}</strong>
                                            ${doc.exists
                                                ? html`<sutram-btn ?compact=${true} intent="primary" label="Read" @click=${() => this._readDoc(doc)}></sutram-btn>`
                                                : html`<sutram-label text="No README"></sutram-label>`}
                                        </sutram-stack>
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-stack>
                        <sutram-stack direction="col" gap="sm">
                            <h4>Extensions</h4>
                            <sutram-stack direction="grid" gap="sm">
                                ${this._docsStatus.filter(d => d.type === 'ext').map(doc => html`
                                    <sutram-surface variant="panel" padding="sm">
                                        <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                            <strong>${doc.title}</strong>
                                            ${doc.exists
                                                ? html`<sutram-btn ?compact=${true} intent="highlight" label="Read" @click=${() => this._readDoc(doc)}></sutram-btn>`
                                                : html`<sutram-label text="No README"></sutram-label>`}
                                        </sutram-stack>
                                    </sutram-surface>
                                `)}
                            </sutram-stack>
                        </sutram-stack>
                    </sutram-stack>
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
        const res = await window.inSetu.api.post(cleanEndpoint, {});
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
            if (cleanEndpoint === 'llm/catalog' && data && Array.isArray(data.models)) {
                window.dispatchEvent(new CustomEvent('insetu:llm-catalog-updated', { detail: data }));
                if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`✅ Synced ${data.count || data.models.length} models & tier defaults!`, 2500);
            } else if (window.inSetu.ui.setGlobalStatus) {
                window.inSetu.ui.setGlobalStatus(data.message || "✅ Action Completed!", 2000);
            }
            resolve(data);
        }
    } catch (err) {
        if (window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`❌ ${err.message}`, 3000, true);
        reject(err);
    }
});
window.addEventListener('sutram-settings-save', async (e) => {
    const { extName, formData, repo, btn, origText, resolve, reject } = e.detail || {};
    const fullSchema = window.inSetu.serverSchemas?.[extName] || window.inSetu.settingsSchemas?.[extName] || window.ExtensionRegistry?._manifests?.get(extName)?.settingsSchema || e.detail?.schema || [];
    try {
        const payload = {};
        fullSchema.forEach(f => {
            if (f && f.type !== 'hidden' && f.type !== 'action') {
                let val = formData && formData[f.id] !== undefined ? formData[f.id] : f.default;
                if (f.type === 'repeater') {
                    const arr = Array.isArray(val) ? val : (Array.isArray(f.default) ? f.default : []);
                    const minItems = f.min_items ?? 0;
                    const maxItems = f.max_items ?? Infinity;
                    if (arr.length < minItems) {
                        throw new Error(`'${f.label || f.id}' requires at least ${minItems} item(s).`);
                    }
                    if (arr.length > maxItems) {
                        throw new Error(`'${f.label || f.id}' allows at most ${maxItems} item(s).`);
                    }
                    val = arr;
                } else if (f.type === 'number') {
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
        const res = await window.inSetu.api.post(extName + '/settings' + qs, payload);
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
