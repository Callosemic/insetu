import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

const AppStore = window.inSetu.stores.App;

export const SkillsStore = createExtensionStore('Skills', {
            playlist: [],
            allSkills: [],
            domainConfig: {},
            groupsList: [],
            loading: false,
            selectedItem: null,
            modalMode: 'train',
            newSkillModalOpen: false,
            formScore: 4,
            formStatus: '',
            formMetrics: {},
            editForm: { name: '', tags: '', group: '' },
            newSkillForm: { name: '', group: '', domain: '', tags: '', status: 'untouched', parts: '', custom_steps: '' },
            newSkillMetrics: {},
            clearPayload: () => SkillsStore.setState({ playlist: [], allSkills: [], groupsList: [] }),
            fetchPlaylist: async (silent = false) => {
                if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('skills')) return;
                if (!silent) SkillsStore.setState({ loading: true });
                try {
                    const res = await window.inSetu.api.get('skills/playlist');
                    if (res.ok) {
                        const data = await res.json();
                        SkillsStore.setState({ playlist: data.playlist || [] });
                    }
                } catch (e) {
                    console.error("Failed to load skills queue:", e);
                } finally {
                    if (!silent) SkillsStore.setState({ loading: false });
                }
            },
            fetchAllSkills: async () => {
                if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('skills')) return;
                try {
                    const res = await window.inSetu.api.get('skills/list');
                    if (res.ok) {
                        const data = await res.json();
                        const skills = data.skills || [];
                        const uniqueGroups = Array.from(new Set(skills.map(s => s.group_name).filter(g => g))).sort();
                        SkillsStore.setState({ allSkills: skills, groupsList: uniqueGroups });
                    }
                } catch (e) {
                    console.error("Failed to load repertoire listing:", e);
                }
            },
            fetchDomainConfig: async () => {
                if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('skills')) return;
                try {
                    const res = await window.inSetu.api.get('skills/settings');
                    if (res.ok) {
                        const settings = await res.json();
                        SkillsStore.setState({ domainConfig: settings.domains || {} });
                    }
                } catch (e) {
                    console.warn("Failed to dynamically pull configurations matrix.", e);
                }
            },
            selectItem: (item, mode = 'train') => {
                SkillsStore.setState({ 
                    selectedItem: item,
                    modalMode: mode,
                    formScore: 4,
                    formStatus: item ? item.status : '',
                    formMetrics: { ...(item ? item.metrics : {}) },
                    editForm: item ? { name: item.name || '', tags: item.tags || '', group: item.group_name || '' } : { name: '', tags: '', group: '' }
                });
                if (item && mode === 'train' && window.Sutram?.stores?.Layout) {
                    const layout = window.Sutram.stores.Layout.getState();
                    layout.openWindow({
                        id: 'skills:session',
                        component: 'insetu-skills-session-projection',
                        label: `Practice: ${item.name}`,
                        icon: 'target',
                        intent: 'success',
                        extName: 'skills',
                        windowOnly: true
                    }, layout.focusedColumn || 'center', 1);
                }
            },
            updateMetricField: (key, val) => {
                SkillsStore.setState(state => ({
                    formMetrics: { ...state.formMetrics, [key]: val }
                }));
            }
}, {
    onEvict: {
        'skills:session': (state) => state.modalMode === 'train' ? { selectedItem: null } : {}
    }
});
export class InSetuExtSkills extends InSetuElement {
    static get extensionName() { return 'skills'; }
    static properties = {
        playlist: { type: Array },
        allSkills: { type: Array },
        domainConfig: { type: Object },
        groupsList: { type: Array },
        loading: { type: Boolean },
        selectedItem: { type: Object },
        newSkillModalOpen: { type: Boolean },
        formScore: { type: Number },
        formStatus: { type: String },
        formMetrics: { type: Object },
        modalMode: { type: String },
        editForm: { type: Object },
        newSkillForm: { type: Object },
        newSkillMetrics: { type: Object }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.playlist = [];
        this.allSkills = [];
        this.domainConfig = {};
        this.groupsList = [];
        this.loading = false;
        this.selectedItem = null;
        this.newSkillModalOpen = false;
        this.formScore = 4;
        this.formStatus = '';
        this.formMetrics = {};
        this.modalMode = 'train';
        this.editForm = { name: '', tags: '', group: '' };
        this.newSkillForm = { name: '', group: '', domain: '', tags: '', status: 'untouched', parts: '', custom_steps: '' };
        this.newSkillMetrics = {};
    }
    get currentViewMode() {
        if (this.dataset.subId) {
            return this.dataset.subId.includes(':') ? this.dataset.subId.split(':').pop() : this.dataset.subId;
        }
        const parentId = this.parentNode?.id || '';
        return parentId.replace('sub-', '') || 'repertoire';
    }
    connectedCallback() {
        super.connectedCallback();
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const touchedSkill = payload.mutations.some(m => m.filepath && (
                m.filepath.startsWith('ctx://skills/') || m.filepath.includes('/skills/')
            ));
            if (touchedSkill) {
                this.registerTimeout(() => {
                    SkillsStore.getState().fetchPlaylist(true);
                    SkillsStore.getState().fetchAllSkills();
                }, 300);
            }
        });
        this.bindStore(
            SkillsStore,
            state => ({
                playlist: state.playlist,
                allSkills: state.allSkills,
                domainConfig: state.domainConfig,
                groupsList: state.groupsList,
                loading: state.loading,
                selectedItem: state.selectedItem,
                newSkillModalOpen: state.newSkillModalOpen,
                formScore: state.formScore,
                formStatus: state.formStatus,
                formMetrics: state.formMetrics,
                modalMode: state.modalMode,
                editForm: state.editForm,
                newSkillForm: state.newSkillForm,
                newSkillMetrics: state.newSkillMetrics
            }),
            { autoFetch: () => this._reloadAll() }
        );
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            this._reloadAll(true);
        });
        this.registerGlobalListener('insetu-skills-settings-changed', window, () => {
            SkillsStore.getState().fetchDomainConfig();
        });
}
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    onViewActivated() {
        this._reloadAll();
    }
    onForceRefresh() {
        super.onForceRefresh();
        SkillsStore.getState().fetchPlaylist(true);
        SkillsStore.getState().fetchAllSkills();
    }
    _reloadAll(silent = false) {
        SkillsStore.getState().fetchPlaylist(silent);
        SkillsStore.getState().fetchAllSkills();
        SkillsStore.getState().fetchDomainConfig();
    }
    _renderGroupsTab() {
        const structuredGroups = [...this.groupsList];
        if (structuredGroups.length === 0) {
            return html`<sutram-empty-state text="No grouped track items established. Assign a 'Group' value in an item's Edit panel to start."></sutram-empty-state>`;
        }

        return html`
            <sutram-stack direction="col" gap="md">
                ${structuredGroups.map(groupName => {
                    const linkedItems = this.allSkills.filter(s => s.group_name === groupName);
                    if (linkedItems.length === 0) return '';
                    const absoluteParts = linkedItems.reduce((acc, item) => acc + (item.metrics?.parts ? item.metrics.parts.split(',').map(p => p.trim()).filter(p => p).length : 0), 0);
                    const absoluteCompleted = linkedItems.reduce((acc, item) => acc + (item.metrics?.completed_parts ? item.metrics.completed_parts.split(',').map(p => p.trim()).filter(p => p).length : 0), 0);

                    const progressPercentage = absoluteParts > 0 ? Math.round((absoluteCompleted / absoluteParts) * 100) : 0;
                    return html`
                        <sutram-collapsible intent="neutral" titleText="📦 ${groupName}">
                            <sutram-stack slot="actions" direction="row" align="center" gap="sm">
                                <sutram-tag text="${linkedItems.length} item(s)" intent="neutral"></sutram-tag>
                                <sutram-tag text="${absoluteCompleted}/${absoluteParts} (${progressPercentage}%)" intent="success"></sutram-tag>
                            </sutram-stack>
                            <sutram-stack direction="col" gap="sm" @click=${(e) => e.stopPropagation()}>
                                ${linkedItems.map(item => {
                                    const domainMeta = this.domainConfig[item.domain] || { label: item.domain };
                                    const tagsLabel = item.tags ? ` [${item.tags}]` : '';
                                    return html`
                                        <sutram-card
                                            .filename=${item.filepath}
                                            .titleText=${item.name}
                                            .descriptionText=${`Domain: ${domainMeta.label}${tagsLabel} | Stage: ${item.status}`}
                                            .detailText=${item.filepath}
                                            icon="music"
                                            intent="neutral"
                                            entityType="skill"
                                            .entityData=${item}
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                        </sutram-card>
                                    `;
                                })}
                            </sutram-stack>
                        </sutram-collapsible>
                    `;
                })}
            </sutram-stack>
        `;
    }
    render() {
        const viewMode = this.currentViewMode;

        return html`
            <sutram-view>
                <sutram-stack direction="col" gap="md">
                    ${this.loading ? html`<sutram-spinner text="Sweeping session items..."></sutram-spinner>` : ''}
                    <sutram-surface variant="ghost" border="bottom" padding="xs">
                        <sutram-stack direction="row" justify="end" align="center">
                            <sutram-btn ?compact=${true} intent="success" icon="plus" label="New Skill Item" @click=${() => {
                                const defaultDomain = Object.keys(this.domainConfig)[0] || 'musical_repertoire';
                                SkillsStore.setState({
                                    newSkillModalOpen: true,
                                    newSkillForm: { name: '', group: '', domain: defaultDomain, tags: '', status: 'untouched', parts: '', custom_steps: '' },
                                    newSkillMetrics: {}
                                });
                            }}></sutram-btn>
                        </sutram-stack>
                    </sutram-surface>

                    ${viewMode === 'active' ? html`
                        ${this.playlist.length === 0 ? html`
                            <sutram-empty-state text="✨ Repertoire profile optimized. No tracks currently scheduled for decay inspection."></sutram-empty-state>
                        ` : html`
                            <sutram-stack direction="col" gap="sm">
                                ${this.playlist.map(item => {
                                    const domainMeta = this.domainConfig[item.domain] || { label: item.domain };
                                    const tagsLabel = item.tags ? ` [${item.tags}]` : '';
                                    return html`
                                        <sutram-card
                                            .filename=${item.filepath}
                                            .titleText=${item.name}
                                            .descriptionText=${`Domain: ${domainMeta.label}${tagsLabel} | Stage: ${item.status}`}
                                            .detailText=${item.filepath}
                                            icon="target"
                                            intent="primary"
                                            entityType="skill"
                                            .entityData=${item}
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                        </sutram-card>
                                    `;
                                })}
                            </sutram-stack>
                        `}
                    ` : viewMode === 'repertoire' ? html`
                        ${this.allSkills.length === 0 ? html`
                            <sutram-empty-state text="No items currently added. Click '+ New Skill Item' above to expand database footprint."></sutram-empty-state>
                        ` : html`
                            <sutram-stack direction="col" gap="sm">
                                ${this.allSkills.map(item => {
                                    const domainMeta = this.domainConfig[item.domain] || { label: item.domain };
                                    const tagsLabel = item.tags ? ` [${item.tags}]` : '';
                                    return html`
                                        <sutram-card
                                            .filename=${item.filepath}
                                            .titleText=${item.name}
                                            .descriptionText=${`Domain: ${domainMeta.label}${tagsLabel} | Stage: ${item.status}`}
                                            .detailText=${item.filepath}
                                            icon="folder"
                                            intent="neutral"
                                            entityType="skill"
                                            .entityData=${item}
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                        </sutram-card>
                                    `;
                                })}
                            </sutram-stack>
                        `}
                    ` : this._renderGroupsTab()}
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-skills', InSetuExtSkills);

export class InSetuExtSkillsModals extends InSetuElement {
    static get extensionName() { return 'skills'; }
    static properties = {
        domainConfig: { type: Object },
        selectedItem: { type: Object },
        newSkillModalOpen: { type: Boolean },
        formStatus: { type: String },
        formMetrics: { type: Object },
        modalMode: { type: String },
        editForm: { type: Object },
        newSkillForm: { type: Object },
        newSkillMetrics: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.domainConfig = {};
        this.selectedItem = null;
        this.newSkillModalOpen = false;
        this.formStatus = '';
        this.formMetrics = {};
        this.modalMode = 'train';
        this.editForm = { name: '', tags: '', group: '' };
        this.newSkillForm = { name: '', group: '', domain: '', tags: '', status: 'untouched', parts: '', custom_steps: '' };
        this.newSkillMetrics = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            SkillsStore,
            state => ({
                domainConfig: state.domainConfig || {},
                selectedItem: state.selectedItem,
                newSkillModalOpen: !!state.newSkillModalOpen,
                formStatus: state.formStatus || '',
                formMetrics: state.formMetrics || {},
                modalMode: state.modalMode || 'train',
                editForm: state.editForm || { name: '', tags: '', group: '' },
                newSkillForm: state.newSkillForm || { name: '', group: '', domain: '', tags: '', status: 'untouched', parts: '', custom_steps: '' },
                newSkillMetrics: state.newSkillMetrics || {}
            }),
            (slice) => {
                Object.assign(this, slice);
            }
        );
    }

    async _handleCreateSkill(e) {
        if (e && e.preventDefault) e.preventDefault();
        const domain = this.newSkillForm.domain || Object.keys(this.domainConfig)[0] || 'musical_repertoire';

        const metrics = {};
        const domainMeta = this.domainConfig[domain];
        if (domainMeta && domainMeta.metrics) {
            Object.keys(domainMeta.metrics).forEach(key => {
                const val = this.newSkillMetrics[key];
                if (val !== undefined && val !== null && val !== '') {
                    metrics[key] = domainMeta.metrics[key].type === 'integer' ? parseInt(val, 10) : parseFloat(val);
                }
            });
        }
        const payload = {
            name: this.newSkillForm.name || '',
            domain: domain,
            tags: this.newSkillForm.tags || '',
            group: this.newSkillForm.group || '',
            status: this.newSkillForm.status || 'untouched',
            parts: this.newSkillForm.parts || '',
            custom_steps: this.newSkillForm.custom_steps || '',
            metrics: metrics
        };
        const res = await this.api.post('skills/create', payload, {
            collapseKey: `skills:create:${payload.name}`
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.setStatus(`❌ ${data.error || 'Failed to create skill item.'}`, 4000, true);
            throw new Error(data.error || 'Failed to create skill item.');
        }
        SkillsStore.setState({
            newSkillModalOpen: false,
            newSkillForm: { name: '', group: '', domain: '', tags: '', status: 'untouched', parts: '', custom_steps: '' },
            newSkillMetrics: {}
        });
        if (data.job_id === 'offline_queue') {
            const tempFilepath = `ctx://skills/${this.utils.slugify(payload.name)}.md`;
            const newItem = { ...payload, filepath: tempFilepath, id: 'SKL-' + Date.now() };
            SkillsStore.setState(s => ({ allSkills: [...s.allSkills, newItem] }));
        }
        this.setStatus("✅ Skill item created.", 2500);
    }

    async _deleteSkillItem() {
        if (!this.selectedItem) return;
        if (!confirm(`⚠️ Are you absolutely sure you want to permanently delete "${this.selectedItem.name}"?\nThis action will destroy the markdown file on disk and cannot be undone.`)) return;
        const res = await this.api.post('skills/delete', { filepath: this.selectedItem.filepath }, { 
            collapseKey: `skills:delete:${this.selectedItem.filepath}`,
            pendingMutations: [this.selectedItem.filepath]
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.setStatus(`❌ ${data.error || 'Failed to delete skill item.'}`, 4000, true);
            throw new Error(data.error || 'Failed to delete skill item.');
        }
        const filepath = this.selectedItem.filepath;
        SkillsStore.setState({ selectedItem: null });
        if (data.job_id === 'offline_queue') {
            SkillsStore.setState(s => ({
                playlist: s.playlist.filter(p => p.filepath !== filepath),
                allSkills: s.allSkills.filter(p => p.filepath !== filepath)
            }));
        }
        this.setStatus("🗑️ Skill item deleted.", 2500);
    }

    async _submitStructuralEdit() {
        if (!this.selectedItem) return;
        const payload = {
            filepath: this.selectedItem.filepath,
            name: this.editForm.name,
            tags: this.editForm.tags,
            group: this.editForm.group,
            status: this.formStatus,
            parts: this.formMetrics.parts || '',
            custom_steps: this.formMetrics.custom_steps || ''
        };
        const res = await this.api.post('skills/update', payload, { 
            collapseKey: `skills:update:${this.selectedItem.filepath}`,
            pendingMutations: [this.selectedItem.filepath]
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.setStatus(`❌ ${data.error || 'Failed to update skill item.'}`, 4000, true);
            throw new Error(data.error || 'Failed to update skill item.');
        }
        const item = this.selectedItem;
        SkillsStore.setState({ selectedItem: null });
        if (data.job_id === 'offline_queue') {
            SkillsStore.setState(s => ({
                allSkills: s.allSkills.map(p => p.id === item.id ? { ...p, name: payload.name, tags: payload.tags, group_name: payload.group, status: payload.status, metrics: { ...p.metrics, parts: payload.parts, custom_steps: payload.custom_steps } } : p),
                playlist: s.playlist.map(p => p.id === item.id ? { ...p, name: payload.name, tags: payload.tags, group_name: payload.group, status: payload.status, metrics: { ...p.metrics, parts: payload.parts, custom_steps: payload.custom_steps } } : p)
            }));
        }
        this.setStatus("✅ Structural configuration updated.", 2500);
    }

    render() {
        const activeNewDomain = this.newSkillForm.domain || Object.keys(this.domainConfig)[0] || 'musical_repertoire';
        return html`
            ${(!!this.selectedItem && this.modalMode === 'edit') ? html`
            <sutram-modal
                ?open=${true}
                ?fullscreen=${true}
                titleText="Edit Skill Architecture & Structure"
                @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) SkillsStore.setState({ selectedItem: null }); }}>
                <sutram-stack slot="body" direction="col" gap="md">
                    <sutram-stack direction="grid" ?compact=${true}>
                        <sutram-input label="Track / Skill Title" .value=${this.editForm.name || ''} @sutram-input-changed=${(e) => SkillsStore.setState(s => ({ editForm: { ...s.editForm, name: e.detail.value } }))}></sutram-input>
                        <sutram-input label="Parent Collection Group" placeholder="e.g. Warmups (or leave blank)" .value=${this.editForm.group || ''} @sutram-input-changed=${(e) => SkillsStore.setState(s => ({ editForm: { ...s.editForm, group: e.detail.value } }))}></sutram-input>
                    </sutram-stack>
                    <sutram-input label="Tags" .value=${this.editForm.tags || ''} placeholder="e.g. Piano, Acoustic, Classical" @sutram-input-changed=${(e) => SkillsStore.setState(s => ({ editForm: { ...s.editForm, tags: e.detail.value } }))}></sutram-input>
                    <sutram-input label="Section / Parts Definition Matrix" .value=${this.formMetrics.parts || ''} placeholder="e.g. Intro, Verse, Solo" @sutram-input-changed=${(e) => SkillsStore.getState().updateMetricField('parts', e.detail.value)}></sutram-input>
                    <sutram-input label="Optional Path Custom Steps (Comma Separated Overrides)" .value=${this.formMetrics.custom_steps || ''} placeholder="e.g. Intro, Solo, Chorus, Mastered" @sutram-input-changed=${(e) => SkillsStore.getState().updateMetricField('custom_steps', e.detail.value)}></sutram-input>
                </sutram-stack>
                <sutram-async-btn slot="footer" icon="trash-2" label="Delete Item" intent="danger" .onClick=${this._deleteSkillItem.bind(this)}></sutram-async-btn>
                <sutram-async-btn slot="footer" icon="save" label="Save Structural Changes" intent="primary" .onClick=${this._submitStructuralEdit.bind(this)}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
            ${this.newSkillModalOpen ? html`
            <sutram-modal
                ?open=${true}
                ?fullscreen=${true}
                titleText="Add New Training Skill Item"
                @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) SkillsStore.setState({ newSkillModalOpen: false }); }}>
                <sutram-stack slot="body" direction="col" gap="md">
                    <sutram-stack direction="grid" ?compact=${true}>
                        <sutram-input label="Item Name / Track Title" placeholder="e.g. Stairway to Heaven" .value=${this.newSkillForm.name || ''} @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, name: e.detail.value } }))}></sutram-input>
                        <sutram-input label="Collection Group" placeholder="e.g. Repertoire (or leave blank)" .value=${this.newSkillForm.group || ''} @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, group: e.detail.value } }))}></sutram-input>
                        <sutram-select 
                            label="Target Domain Framework" 
                            .value=${activeNewDomain} 
                            .options=${Object.keys(this.domainConfig).map(k => ({ value: k, label: this.domainConfig[k].label || k }))}
                            @sutram-input-changed=${(e) => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, domain: e.detail.value } }))}>
                        </sutram-select>
                    </sutram-stack>

                    <sutram-input label="Tags" placeholder="e.g. Piano, Acoustic, Classical" .value=${this.newSkillForm.tags || ''} @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, tags: e.detail.value } }))}></sutram-input>

                    <sutram-stack direction="grid" ?compact=${true}>
                        ${(() => {
                            const cfg = this.domainConfig[activeNewDomain];
                            const options = (cfg && cfg.step_labels) ? (Array.isArray(cfg.step_labels) ? cfg.step_labels : Object.keys(cfg.step_labels).map(k => ({ key: k, label: cfg.step_labels[k] }))) : [{ key: 'untouched', label: 'Untouched' }];
                            const mappedOptions = options.map(opt => ({ value: opt.key, label: opt.label }));
                            return html`
                                <sutram-select 
                                    label="Initial Starting Status Stage" 
                                    .value=${this.newSkillForm.status || 'untouched'} 
                                    .options=${mappedOptions}
                                    @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, status: e.detail.value } }))}>
                                </sutram-select>
                            `;
                        })()}
                        <sutram-input label="Sections / Parts Matrix Checklist" placeholder="e.g. Intro, Verse, Solo" .value=${this.newSkillForm.parts || ''} @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, parts: e.detail.value } }))}></sutram-input>
                    </sutram-stack>
                    <sutram-input label="Optional Path Custom Steps (Comma Separated Overrides)" placeholder="e.g. Intro, Solo, Chorus, Mastered" .value=${this.newSkillForm.custom_steps || ''} @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillForm: { ...s.newSkillForm, custom_steps: e.detail.value } }))}></sutram-input>
                    ${(() => {
                        const activeConfig = this.domainConfig[activeNewDomain];
                        if (!activeConfig || !activeConfig.metrics) return '';
                        return html`
                            <sutram-surface variant="ghost" border="top" padding="sm">
                                <sutram-stack direction="grid" ?compact=${true}>
                                    ${Object.keys(activeConfig.metrics).map(key => {
                                        const m = activeConfig.metrics[key];
                                        if (key === 'parts' || key === 'completed_parts' || key === 'custom_steps') return '';

                                        if (m.type === 'rating' || (m.min !== undefined && m.max !== undefined)) {
                                            const min = m.min !== undefined ? m.min : 1;
                                            const max = m.max !== undefined ? m.max : 5;
                                            const options = [];
                                            for (let i = min; i <= max; i++) {
                                                options.push(i);
                                            }
                                            return html`
                                                <sutram-select 
                                                    label=${m.label} 
                                                    .value=${this.newSkillMetrics[key] ?? min} 
                                                    .options=${options.map(opt => ({ value: opt, label: String(opt) }))}
                                                    @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillMetrics: { ...s.newSkillMetrics, [key]: e.detail.value } }))}>
                                                </sutram-select>
                                            `;
                                        }

                                        return html`
                                            <sutram-input 
                                                type="number"
                                                label="${m.label} ${m.unit ? `(${m.unit})` : ''}"
                                                placeholder="${m.unit ? m.unit : 'Value'}"
                                                .value=${this.newSkillMetrics[key] ?? ''} 
                                                @sutram-input-changed=${e => SkillsStore.setState(s => ({ newSkillMetrics: { ...s.newSkillMetrics, [key]: e.detail.value } }))}>
                                            </sutram-input>
                                        `;
                                    })}
                                </sutram-stack>
                            </sutram-surface>
                        `;
                    })()}
                </sutram-stack>
                <sutram-async-btn slot="footer" intent="success" icon="plus" label="Initialize Track on Disk" ?fullWidth=${true} .onClick=${(e) => this._handleCreateSkill(e)}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
        `;
    }
}
customElements.define('insetu-ext-skills-modals', InSetuExtSkillsModals);

export class InSetuSkillsSessionProjection extends InSetuElement {
    static get extensionName() { return 'skills'; }
    static properties = {
        selectedItem: { type: Object },
        domainConfig: { type: Object },
        formScore: { type: Number },
        formStatus: { type: String },
        formMetrics: { type: Object }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        const st = SkillsStore.getState();
        this.selectedItem = st.selectedItem;
        this.domainConfig = st.domainConfig || {};
        this.formScore = st.formScore || 4;
        this.formStatus = st.formStatus || '';
        this.formMetrics = st.formMetrics || {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            SkillsStore,
            state => ({
                selectedItem: state.selectedItem,
                domainConfig: state.domainConfig || {},
                formScore: state.formScore,
                formStatus: state.formStatus,
                formMetrics: state.formMetrics || {}
            }),
            (slice) => {
                this.selectedItem = slice.selectedItem;
                this.domainConfig = slice.domainConfig;
                this.formScore = slice.formScore;
                this.formStatus = slice.formStatus;
                this.formMetrics = slice.formMetrics;
            }
        );
    }
    _handleStatusChange(newStatus) {
        if (this.selectedItem && newStatus !== this.selectedItem.status) {
            if (confirm("🔄 You are changing the mastery stage. Would you like to reset the completed parts checklist for this new stage?")) {
                SkillsStore.getState().updateMetricField('completed_parts', '');
            }
        }
        SkillsStore.setState({ formStatus: newStatus });
    }
    _togglePartCompletion(part, isChecked) {
        const currentPartsStr = this.formMetrics.completed_parts || '';
        const parsedParts = currentPartsStr.split(',').map(p => p.trim()).filter(p => p);
        const completedParts = isChecked ? (parsedParts.includes(part) ? parsedParts : [...parsedParts, part]) : parsedParts.filter(p => p !== part);
        SkillsStore.getState().updateMetricField('completed_parts', completedParts.join(', '));
    }
    _renderPartsCheckboxes() {
        const partsStr = this.formMetrics.parts !== undefined ? this.formMetrics.parts : (this.selectedItem?.metrics?.parts || '');
        if (!partsStr) return '';
        const allParts = partsStr.split(',').map(p => p.trim()).filter(p => p);
        const completedPartsStr = this.formMetrics.completed_parts || '';
        const completedParts = completedPartsStr.split(',').map(p => p.trim()).filter(p => p);
        return html`
            <sutram-surface variant="panel" border="top" padding="sm" gap="xs">
                <sutram-label text="Section Coverage Checklist"></sutram-label>
                <sutram-stack direction="col" gap="xs">
                    ${allParts.map(part => {
                        const isChecked = completedParts.includes(part);
                        return html`
                            <sutram-toggle
                                label=${part}
                                ?flush=${true}
                                .checked=${isChecked}
                                @sutram-input-changed=${(e) => this._togglePartCompletion(part, e.detail.value)}>
                            </sutram-toggle>
                        `;
                    })}
                </sutram-stack>
            </sutram-surface>
        `;
    }
    _renderMetricInput(key, def) {
        if (key === 'parts' || key === 'completed_parts' || key === 'custom_steps') return '';
        const value = this.formMetrics[key] !== undefined ? this.formMetrics[key] : '';
        if (def.type === 'rating' || (def.min !== undefined && def.max !== undefined)) {
            const min = def.min !== undefined ? def.min : 1;
            const max = def.max !== undefined ? def.max : 5;
            const options = [];
            for (let i = min; i <= max; i++) options.push({ value: i, label: String(i) });
            return html`
                <sutram-select 
                    .label=${def.label} 
                    .value=${value !== '' ? value : min} 
                    .options=${options}
                    @sutram-input-changed=${(e) => SkillsStore.getState().updateMetricField(key, parseInt(e.detail.value, 10))}>
                </sutram-select>
            `;
        }
        return html`
            <sutram-input 
                type="number" 
                .label=${def.label + (def.unit ? ` (${def.unit})` : '')}
                .value=${value} 
                placeholder="e.g. 120"
                @sutram-input-changed=${(e) => SkillsStore.getState().updateMetricField(key, e.detail.value === '' ? '' : parseFloat(e.detail.value))}>
            </sutram-input>
        `;
    }
    async _submitPracticeSession() {
        if (!this.selectedItem) return;
        const payload = {
            filepath: this.selectedItem.filepath,
            score: this.formScore,
            status: this.formStatus || this.selectedItem.status,
            name: this.selectedItem.name,
            tags: this.selectedItem.tags || '',
            group: this.selectedItem.group_name || '',
            metrics: this.formMetrics
        };
        try {
            const res = await this.api.post('skills/log', payload, { 
                collapseKey: `skills:log:${this.selectedItem.filepath}`,
                pendingMutations: [this.selectedItem.filepath]
            });
            const data = await res.json();
            const item = this.selectedItem;
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('skills:session');
            }
            if (data.job_id === 'offline_queue') {
                SkillsStore.setState(s => ({
                    playlist: s.playlist.filter(p => p.id !== item.id),
                    allSkills: s.allSkills.map(p => p.id === item.id ? { ...p, status: payload.status, metrics: payload.metrics } : p)
                }));
            }
            this.setStatus("✅ Practice entry committed to ledger.", 2500);
        } catch (err) {
            this.setStatus(`❌ Failed to log practice session: ${err.message}`, 4000, true);
        }
    }
    render() {
        if (!this.selectedItem) return html``;
        const domainMeta = this.domainConfig[this.selectedItem.domain];
        const options = (this.selectedItem.metrics && this.selectedItem.metrics.custom_steps)
            ? this.selectedItem.metrics.custom_steps.split(',').map(s => ({ key: s.trim(), label: s.trim() }))
            : ((domainMeta && domainMeta.step_labels) ? (Array.isArray(domainMeta.step_labels) ? domainMeta.step_labels : Object.keys(domainMeta.step_labels).map(k => ({ key: k, label: domainMeta.step_labels[k] }))) : []);
        return html`
            <sutram-view>
                <sutram-stack direction="col" gap="md">
                    <sutram-select label="Quality Rating Scale (SM-2 Algorithm)" .value=${this.formScore} .options=${[
                        {value: 5, label: '5 - Perfect execution (Immediate retention)'},
                        {value: 4, label: '4 - Correct execution with minimal hesitation'},
                        {value: 3, label: '3 - Correct execution but required notable effort'},
                        {value: 2, label: '2 - Incorrect execution; clear structural breakdown'},
                        {value: 1, label: '1 - Blackout/Untouched (Complete memory lapse)'}
                    ]} @sutram-input-changed=${(e) => SkillsStore.setState({ formScore: parseInt(e.detail.value, 10) })}></sutram-select>

                    ${options.length > 0 ? html`
                        <sutram-select label="Current Mastery Stage" .value=${this.formStatus} .options=${options.map(opt => ({value: opt.key, label: opt.label}))} @sutram-input-changed=${(e) => this._handleStatusChange(e.detail.value)}></sutram-select>
                    ` : ''}

                    ${this._renderPartsCheckboxes()}

                    ${domainMeta && domainMeta.metrics ? html`
                        <sutram-stack direction="grid" ?compact=${true}>
                            ${Object.keys(domainMeta.metrics).map(key => this._renderMetricInput(key, domainMeta.metrics[key]))}
                        </sutram-stack>
                    ` : ''}
                </sutram-stack>
                <sutram-btn slot="footer" intent="neutral" icon="x" label="Cancel" @click=${() => {
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('skills:session');
                }}></sutram-btn>
                <sutram-async-btn slot="footer" icon="save" label="Flush Session Data" intent="success" .onClick=${this._submitPracticeSession.bind(this)}></sutram-async-btn>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-skills-session-projection', InSetuSkillsSessionProjection);

window.ExtensionRegistry.registerExtension('skills', {
    name: "Skills Tracker",
    version: "1.0.0",
    offline_mode: "full",
    settingsCategory: "Practice",
    entityActions: [
        {
            targetEntity: 'skill',
            id: 'skill-train',
            label: 'Train',
            icon: '⏱️',
            intent: 'primary',
            group: 'tools',
            vfsBound: false,
            order: 10,
            onClick: (data, e) => {
                SkillsStore.getState().selectItem(data, 'train');
            }
        },
        {
            targetEntity: 'skill',
            id: 'skill-edit',
            label: 'Edit',
            icon: '✏️',
            intent: 'neutral',
            group: 'tools',
            vfsBound: false,
            order: 20,
            onClick: (data, e) => {
                SkillsStore.getState().selectItem(data, 'edit');
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:global",
            component: "insetu-ext-skills-modals"
        },
        {
            slot: "slots:primary-navigation",
            id: "skills",
            label: "Practice",
            icon: "target",
            intent: "success",
            order: 5
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "skills",
            id: "active",
            label: "Active Queue",
            icon: "target",
            intent: "primary",
            order: 0,
            component: "insetu-ext-skills"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "skills",
            id: "repertoire",
            label: "Full Repertoire",
            icon: "music",
            intent: "neutral",
            order: 1,
            component: "insetu-ext-skills"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "skills",
            id: "groups",
            label: "Groups",
            icon: "folder",
            intent: "highlight",
            order: 2,
            component: "insetu-ext-skills"
        }
    ]
});