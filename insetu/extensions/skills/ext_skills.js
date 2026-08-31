import { html, css } from 'lit';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';

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
                    formMetrics: { ...(item ? item.metrics : {}) }
                });
            },
            updateMetricField: (key, val) => {
                SkillsStore.setState(state => ({
                    formMetrics: { ...state.formMetrics, [key]: val }
                }));
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
        _configModalOpen: { type: Boolean },
        _configText: { type: String },
        _newSkillDomain: { type: String },
        _editName: { type: String },
        _editTags: { type: String },
        _editGroup: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; container-type: inline-size; }
    `];
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
        this._newSkillDomain = '';
        this._newSkillForm = {};
        this._newSkillMetrics = {};
        this._editName = '';
        this._editTags = '';
        this._editGroup = '';
    }
    get currentViewMode() {
        // Strictly prefer the dataset attribute injected by the OS layout engine
        if (this.dataset.subId) return this.dataset.subId;

        // Fallback for legacy static mounting
        const parentId = this.parentNode?.id || '';
        return parentId.replace('sub-', '') || 'repertoire';
    }
    get isActiveTab() {
        // Strict UI boundary isolation: Read layout state from the DOM tree, not global storage
        return this.closest('.sub-tab-content')?.classList.contains('active') ?? false;
    }
    connectedCallback() {
        super.connectedCallback();

        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const touchedSkill = payload.mutations.some(m => m.filepath && m.filepath.includes('.insetu/skills/'));
            if (touchedSkill) {
                SkillsStore.getState().fetchPlaylist(true);
                SkillsStore.getState().fetchAllSkills();
            }
        });

        this.subscribe(SkillsStore, state => {
            this.playlist = state.playlist;
            this.allSkills = state.allSkills;
            this.domainConfig = state.domainConfig;
            this.groupsList = state.groupsList;
            this.loading = state.loading;
            this.selectedItem = state.selectedItem;
            this.newSkillModalOpen = state.newSkillModalOpen;
            this.formScore = state.formScore;
            this.formStatus = state.formStatus;
            this.formMetrics = state.formMetrics;
            this.modalMode = state.modalMode;
            if (state.selectedItem && (this._lastSelectedFile !== state.selectedItem.filepath)) {
                this._lastSelectedFile = state.selectedItem.filepath;
                this._editName = state.selectedItem.name;
                this._editTags = state.selectedItem.tags || '';
                this._editGroup = state.selectedItem.group_name || '';
            } else if (!state.selectedItem) {
                this._lastSelectedFile = null;
                this._editName = '';
                this._editTags = '';
                this._editGroup = '';
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    onWorkspaceLoad(workspaceId) {
        this._reloadAll();
    }
    onForceRefresh() {
        SkillsStore.getState().fetchPlaylist(true);
        SkillsStore.getState().fetchAllSkills();
    }
    _reloadAll(silent = false) {
        SkillsStore.getState().fetchPlaylist(silent);
        SkillsStore.getState().fetchAllSkills();
        SkillsStore.getState().fetchDomainConfig();
    }
    async _handleCreateSkill(e) {
        e.preventDefault();
        const domain = this._newSkillForm.domain || this._newSkillDomain || Object.keys(this.domainConfig)[0];

        const metrics = {};
        const domainMeta = this.domainConfig[domain];
        if (domainMeta && domainMeta.metrics) {
            Object.keys(domainMeta.metrics).forEach(key => {
                const val = this._newSkillMetrics[key];
                if (val !== undefined && val !== null && val !== '') {
                    metrics[key] = domainMeta.metrics[key].type === 'integer' ? parseInt(val, 10) : parseFloat(val);
                }
            });
        }
        const payload = {
            name: this._newSkillForm.name || '',
            domain: domain,
            tags: this._newSkillForm.tags || '',
            group: this._newSkillForm.group || '',
            status: this._newSkillForm.status || 'untouched',
            parts: this._newSkillForm.parts || '',
            custom_steps: this._newSkillForm.custom_steps || '',
            metrics: metrics
        };
        try {
            await this.api.postJson('create', payload);
            SkillsStore.setState({ newSkillModalOpen: false });
        } catch (err) {
            alert(`Failed to compile item structure: ${err.message}`);
        }
    }

    _handleStatusChange(e) {
        const newStatus = e.target.value;
        if (newStatus !== this.selectedItem.status) {
            const shouldClear = confirm("🔄 You are changing the mastery stage. Would you like to reset the completed parts checklist for this new stage?");
            if (shouldClear) {
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
        const partsStr = this.formMetrics.parts !== undefined ? this.formMetrics.parts : (this.selectedItem.metrics?.parts || '');
        if (!partsStr) return '';

        const allParts = partsStr.split(',').map(p => p.trim()).filter(p => p);
        const completedPartsStr = this.formMetrics.completed_parts || '';
        const completedParts = completedPartsStr.split(',').map(p => p.trim()).filter(p => p);

        return html`
            <div style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 15px;">
                <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 8px; color: var(--text-muted);">
                    🧩 Section Coverage Checklist
                </label>
                <div style="display: flex; flex-direction: column; gap: 8px; background: var(--bg); padding: 12px; border-radius: 4px; border: 1px solid var(--border);">
                    ${allParts.map(part => {
                        const isChecked = completedParts.includes(part);
                        return html`
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.9rem; cursor: pointer; user-select: none;">
                                <input type="checkbox" ?checked=${isChecked} 
                                    @change=${(e) => this._togglePartCompletion(part, e.target.checked)}
                                    style="margin: 0; width: 16px; height: 16px; cursor: pointer;">
                                <span style="${isChecked ? 'text-decoration: line-through; color: var(--text-muted); opacity: 0.7;' : 'font-weight: 500;'}">
                                    ${part}
                                </span>
                            </label>
                        `;
                    })}
                </div>
            </div>
        `;
    }
    async _deleteSkillItem() {
        if (!this.selectedItem) return;
        if (!confirm(`⚠️ Are you absolutely sure you want to permanently delete "${this.selectedItem.name}"?\nThis action will destroy the markdown file on disk and cannot be undone.`)) return;
        try {
            await this.api.postJson('delete', { filepath: this.selectedItem.filepath });
            SkillsStore.setState({ selectedItem: null });
            alert("Track permanently wiped from file system.");
        } catch (err) {
            alert(`Failed to execute deletion sequence: ${err.message}`);
        }
    }

    async _submitStructuralEdit() {
        if (!this.selectedItem) return;
        const payload = {
            filepath: this.selectedItem.filepath,
            name: this._editName,
            tags: this._editTags,
            group: this._editGroup,
            status: this.formStatus,
            parts: this.formMetrics.parts || '',
            custom_steps: this.formMetrics.custom_steps || ''
        };
        try {
            await this.api.postJson('update', payload);
            SkillsStore.setState({ selectedItem: null });
            alert("Structural configuration updated successfully!");
        } catch (err) {
            alert(`Failed to save adjustments: ${err.message}`);
        }
    }

    async _submitPracticeSession() {
        if (!this.selectedItem) return;
        const payload = {
            filepath: this.selectedItem.filepath,
            score: this.formScore,
            status: this.formStatus || this.selectedItem.status,
            name: this._editName || this.selectedItem.name,
            tags: this._editTags,
            group: this._editGroup,
            metrics: this.formMetrics
        };
        try {
            await this.api.postJson('log', payload);
            SkillsStore.setState({ selectedItem: null });
            alert("Practice entry committed atomically into text ledger!");
        } catch (err) {
            console.error("Practice logging failed:", err);
            alert(`Network error sync loop failed: ${err.message}`);
        }
    }
    _renderMetricInput(key, def) {
        if (key === 'parts' || key === 'completed_parts' || key === 'custom_steps') return '';
        const value = this.formMetrics[key] !== undefined ? this.formMetrics[key] : '';

        if (def.type === 'rating' || (def.min !== undefined && def.max !== undefined)) {
            const min = def.min !== undefined ? def.min : 1;
            const max = def.max !== undefined ? def.max : 5;
            const options = [];
            for (let i = min; i <= max; i++) {
                options.push({ value: i, label: String(i) });
            }

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
    _renderGroupsTab() {
        const structuredGroups = [...this.groupsList];
        if (structuredGroups.length === 0) {
            return html`<p style="color: var(--text-muted); font-style: italic; padding: 20px 0;">No grouped track items established. Assign a "Group" value in an item's Edit panel to start.</p>`;
        }

        return html`
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${structuredGroups.map(groupName => {
                    const linkedItems = this.allSkills.filter(s => s.group_name === groupName);
                    if (linkedItems.length === 0) return '';
                    const absoluteParts = linkedItems.reduce((acc, item) => acc + (item.metrics?.parts ? item.metrics.parts.split(',').map(p => p.trim()).filter(p => p).length : 0), 0);
                    const absoluteCompleted = linkedItems.reduce((acc, item) => acc + (item.metrics?.completed_parts ? item.metrics.completed_parts.split(',').map(p => p.trim()).filter(p => p).length : 0), 0);

                    const progressPercentage = absoluteParts > 0 ? Math.round((absoluteCompleted / absoluteParts) * 100) : 0;
                    return html`
                        <sutram-collapsible intent="neutral" titleText="📦 ${groupName}">
                            <div slot="actions" style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 0.8rem; color: var(--text-muted); background: var(--bg); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border);">
                                    ${linkedItems.length} item(s)
                                </span>
                                <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                    <div style="flex: 1; height: 6px; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); overflow: hidden; position: relative;">
                                        <div style="width: ${progressPercentage}%; height: 100%; background: var(--intent-success); transition: width 0.3s ease;"></div>
                                    </div>
                                    <span style="font-size: 0.8rem; color: var(--intent-success); font-family: var(--font-mono);">${absoluteCompleted}/${absoluteParts}</span>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 10px; cursor: default;" @click=${(e) => e.stopPropagation()}>
                                ${linkedItems.map(item => {
                                    const domainMeta = this.domainConfig[item.domain] || { label: item.domain };
                                    const tagsLabel = item.tags ? ` [${item.tags}]` : '';
                                    return html`
                                        <insetu-card
                                            .filename=${item.filepath}
                                            .titleText=${item.name}
                                            .descriptionText=${`Domain: ${domainMeta.label}${tagsLabel} | Stage: ${item.status}`}
                                            .detailText=${item.filepath}
                                            icon="🎵"
                                            intentColor="var(--intent-neutral)"
                                            style="cursor: pointer;"
                                            @click=${() => SkillsStore.getState().selectItem(item, 'train')}
                                            entityType="skill"
                                            .entityData=${item}
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                        </insetu-card>
                                    `;
                                })}
                            </div>
                        </sutram-collapsible>
                    `;
                })}
            </div>
        `;
    }
    render() {
        if (!this.isActiveTab) return '';

        const viewMode = this.currentViewMode;
        const activeNewDomain = this._newSkillDomain || Object.keys(this.domainConfig)[0] || 'musical_repertoire';

        return html`
            <div style="display: flex; flex-direction: column; gap: 20px;">
                ${this.loading ? html`<sutram-spinner text="Sweeping session items..."></sutram-spinner>` : ''}
                <div style="display: flex; flex-direction: column; gap: 20px; opacity: ${this.loading ? '0.6' : '1'}; transition: opacity 0.2s ease; pointer-events: ${this.loading ? 'none' : 'auto'};">
                <div style="display: flex; justify-content: flex-end; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-top: -10px;">
                    <button class="btn-sm" style="background: var(--intent-success); font-weight: bold;" @click=${() => { this._newSkillDomain = Object.keys(this.domainConfig)[0] || ''; SkillsStore.setState({ newSkillModalOpen: true }); }}>➕ New Skill Item</button>
                </div>

                ${viewMode === 'active' ? html`
                    <div>
                        ${this.playlist.length === 0 ? html`
                            <p style="color: var(--text-muted); font-style: italic; padding: 20px 0;">✨ Repertoire profile optimized. No tracks currently scheduled for decay inspection.</p>
                        ` : html`
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${this.playlist.map(item => {
                                    const domainMeta = this.domainConfig[item.domain] || { label: item.domain };
                                    const tagsLabel = item.tags ? ` [${item.tags}]` : '';
                                    return html`
                                        <insetu-card
                                            .filename=${item.filepath}
                                            .titleText=${item.name}
                                            .descriptionText=${`Domain: ${domainMeta.label}${tagsLabel} | Stage: ${item.status}`}
                                            .detailText=${item.filepath}
                                            icon="🎯"
                                            intentColor="var(--intent-primary)"
                                            style="cursor: pointer;"
                                            @click=${() => SkillsStore.getState().selectItem(item, 'train')}
                                            entityType="skill"
                                            .entityData=${item}
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                        </insetu-card>
                                    `;
                                })}
                            </div>
                        `}
                    </div>
                ` : viewMode === 'repertoire' ? html`
                    <div>
                        ${this.allSkills.length === 0 ? html`
                            <p style="color: var(--text-muted); font-style: italic; padding: 20px 0;">No items currently added. Click "+ New Skill Item" above to expand database footprint.</p>
                        ` : html`
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${this.allSkills.map(item => {
                                    const domainMeta = this.domainConfig[item.domain] || { label: item.domain };
                                    const tagsLabel = item.tags ? ` [${item.tags}]` : '';
                                    return html`
                                        <insetu-card
                                            .filename=${item.filepath}
                                            .titleText=${item.name}
                                            .descriptionText=${`Domain: ${domainMeta.label}${tagsLabel} | Stage: ${item.status}`}
                                            .detailText=${item.filepath}
                                            icon="🗂️"
                                            intentColor="var(--intent-neutral)"
                                            style="cursor: pointer;"
                                            @click=${() => SkillsStore.getState().selectItem(item, 'train')}
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                            <insetu-file-actions slot="actions" .filepath=${item.filepath} .isFS=${true}></insetu-file-actions>
                                            <div slot="actions" style="display: flex; gap: 6px;">
                                                <button class="btn-sm" style="background: var(--intent-primary);" @click=${(e) => { e.stopPropagation(); SkillsStore.getState().selectItem(item, 'train'); }}>⏱️ Train</button>
                                                <button class="btn-sm" style="background: var(--intent-neutral);" @click=${(e) => { e.stopPropagation(); SkillsStore.getState().selectItem(item, 'edit'); }}>✏️ Edit</button>
                                            </div>
                                        </insetu-card>
                                    `;
                                })}
                            </div>
                        `}
                    </div>
                ` : this._renderGroupsTab()}
            </div>
            </div>
            <sutram-modal
                ?open=${!!this.selectedItem && this.modalMode === 'train'}
                ?fullscreen=${true}
                titleText="⏱️ Practice Session: ${this.selectedItem?.name}"
                @sutram-modal-closed=${() => SkillsStore.setState({ selectedItem: null })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    <div>
                        <sutram-select label="Quality Rating Scale (SM-2 Algorithm)" .value=${this.formScore} .options=${[
                            {value: 5, label: '5 - Perfect execution (Immediate retention)'},
                            {value: 4, label: '4 - Correct execution with minimal hesitation'},
                            {value: 3, label: '3 - Correct execution but required notable effort'},
                            {value: 2, label: '2 - Incorrect execution; clear structural breakdown'},
                            {value: 1, label: '1 - Blackout/Untouched (Complete memory lapse)'}
                        ]} @sutram-input-changed=${(e) => SkillsStore.setState({ formScore: parseInt(e.detail.value, 10) })}></sutram-select>
                    </div>
                    ${(() => {
                        if (!this.selectedItem) return '';
                        const domainMeta = this.domainConfig[this.selectedItem.domain];
                        const options = (this.selectedItem.metrics && this.selectedItem.metrics.custom_steps) ? this.selectedItem.metrics.custom_steps.split(',').map(s => ({ key: s.trim(), label: s.trim() })) : ((domainMeta && domainMeta.step_labels) ? (Array.isArray(domainMeta.step_labels) ? domainMeta.step_labels : Object.keys(domainMeta.step_labels).map(k => ({ key: k, label: domainMeta.step_labels[k] }))) : []);

                        if (options.length === 0) return '';
                        return html`
                            <div>
                                <sutram-select label="Current Mastery Stage" .value=${this.formStatus} .options=${options.map(opt => ({value: opt.key, label: opt.label}))} @sutram-input-changed=${(e) => { this.selectedItem.status = e.detail.value; this._handleStatusChange({target: {value: e.detail.value}}); }}></sutram-select>
                            </div>
                        `;
                    })()}

                    ${this.selectedItem ? this._renderPartsCheckboxes() : ''}

                    ${(() => {
                        if (!this.selectedItem) return '';
                        const domainMeta = this.domainConfig[this.selectedItem.domain];
                        if (!domainMeta || !domainMeta.metrics) return '';
                        return html`
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
                                ${Object.keys(domainMeta.metrics).map(key => this._renderMetricInput(key, domainMeta.metrics[key]))}
                            </div>
                        `;
                    })()}
                </div>
                <button slot="footer" style="background: var(--intent-success); color: white;" @click=${this._submitPracticeSession}>💾 Flush Session Data</button>
            </sutram-modal>
            <sutram-modal
                ?open=${!!this.selectedItem && this.modalMode === 'edit'}
                ?fullscreen=${true}
                titleText="✏️ Edit Skill Architecture & Structure"
                @sutram-modal-closed=${() => SkillsStore.setState({ selectedItem: null })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <sutram-input label="Track / Skill Title" .value=${this._editName || ''} @sutram-input-changed=${(e) => this._editName = e.detail.value}></sutram-input>
                        <div>
                            <sutram-input label="Parent Collection Group" placeholder="e.g. Warmups (or leave blank)" .value=${this._editGroup || ''} @sutram-input-changed=${(e) => this._editGroup = e.detail.value}></sutram-input>
                        </div>
                    </div>
                    <sutram-input label="Tags" .value=${this._editTags || ''} placeholder="e.g. Piano, Acoustic, Classical" @sutram-input-changed=${(e) => this._editTags = e.detail.value}></sutram-input>
                    <sutram-input label="Section / Parts Definition Matrix" .value=${this.formMetrics.parts || ''} placeholder="e.g. Intro, Verse, Solo" @sutram-input-changed=${(e) => SkillsStore.getState().updateMetricField('parts', e.detail.value)}></sutram-input>
                    <sutram-input label="Optional Path Custom Steps (Comma Separated Overrides)" .value=${this.formMetrics.custom_steps || ''} placeholder="e.g. Intro, Solo, Chorus, Mastered" @sutram-input-changed=${(e) => SkillsStore.getState().updateMetricField('custom_steps', e.detail.value)}></sutram-input>
                </div>
                <button slot="footer" style="background: var(--intent-danger); color: white;" @click=${this._deleteSkillItem}>🗑️ Delete Item</button>
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${this._submitStructuralEdit}>💾 Save Structural Changes</button>
            </sutram-modal>
            <sutram-modal
                ?open=${this.newSkillModalOpen}
                ?fullscreen=${true}
                titleText="Add New Training Skill Item"
                @sutram-modal-closed=${() => SkillsStore.setState({ newSkillModalOpen: false })}>
                <form slot="body" @submit=${this._handleCreateSkill} style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <sutram-input label="Item Name / Track Title" placeholder="e.g. Stairway to Heaven" .value=${this._newSkillForm.name || ''} @sutram-input-changed=${e => this._newSkillForm.name = e.detail.value}></sutram-input>
                        <div>
                            <sutram-input label="Collection Group" placeholder="e.g. Repertoire (or leave blank)" .value=${this._newSkillForm.group || ''} @sutram-input-changed=${e => this._newSkillForm.group = e.detail.value}></sutram-input>
                        </div>
                        <sutram-select 
                            label="Target Domain Framework" 
                            .value=${activeNewDomain} 
                            .options=${Object.keys(this.domainConfig).map(k => ({ value: k, label: this.domainConfig[k].label || k }))}
                            @sutram-input-changed=${(e) => { this._newSkillDomain = e.detail.value; this._newSkillForm.domain = e.detail.value; this.requestUpdate(); }}>
                        </sutram-select>
                    </div>

                    <sutram-input label="Tags" placeholder="e.g. Piano, Acoustic, Classical" .value=${this._newSkillForm.tags || ''} @sutram-input-changed=${e => this._newSkillForm.tags = e.detail.value}></sutram-input>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${(() => {
                            const cfg = this.domainConfig[activeNewDomain];
                            const options = (cfg && cfg.step_labels) ? (Array.isArray(cfg.step_labels) ? cfg.step_labels : Object.keys(cfg.step_labels).map(k => ({ key: k, label: cfg.step_labels[k] }))) : [{ key: 'untouched', label: 'Untouched' }];
                            const mappedOptions = options.map(opt => ({ value: opt.key, label: opt.label }));
                            return html`
                                <sutram-select 
                                    label="Initial Starting Status Stage" 
                                    .value=${this._newSkillForm.status || 'untouched'} 
                                    .options=${mappedOptions}
                                    @sutram-input-changed=${e => this._newSkillForm.status = e.detail.value}>
                                </sutram-select>
                            `;
                        })()}
                        <sutram-input label="Sections / Parts Matrix Checklist" placeholder="e.g. Intro, Verse, Solo" .value=${this._newSkillForm.parts || ''} @sutram-input-changed=${e => this._newSkillForm.parts = e.detail.value}></sutram-input>
                    </div>
                    <sutram-input label="Optional Path Custom Steps (Comma Separated Overrides)" placeholder="e.g. Intro, Solo, Chorus, Mastered" .value=${this._newSkillForm.custom_steps || ''} @sutram-input-changed=${e => this._newSkillForm.custom_steps = e.detail.value}></sutram-input>
                    ${(() => {
                        const activeConfig = this.domainConfig[activeNewDomain];
                        if (!activeConfig || !activeConfig.metrics) return '';
                        return html`
                            <div style="border-top: 1px solid var(--border); padding-top: 15px; margin-top: 5px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
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
                                            <div>
                                                <sutram-select 
                                                    label=${m.label} 
                                                    .value=${this._newSkillMetrics[key] || min} 
                                                    .options=${options.map(opt => ({ value: opt, label: String(opt) }))}
                                                    @sutram-input-changed=${e => this._newSkillMetrics[key] = e.detail.value}>
                                                </sutram-select>
                                            </div>
                                        `;
                                    }

                                    return html`
                                        <div>
                                            <sutram-input 
                                                type="number"
                                                label="${m.label} ${m.unit ? `(${m.unit})` : ''}"
                                                placeholder="${m.unit ? m.unit : 'Value'}"
                                                .value=${this._newSkillMetrics[key] || ''} 
                                                @sutram-input-changed=${e => this._newSkillMetrics[key] = e.detail.value}>
                                            </sutram-input>
                                        </div>
                                    `;
                                })}
                            </div>
                        `;
                    })()}
                    <button type="submit" style="background: var(--intent-success); font-weight: bold; width: 100%; padding: 12px; margin-top: 10px;">➕ Initialize Track on Disk</button>
                </form>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-skills', InSetuExtSkills);
window.ExtensionRegistry.registerExtension('skills', {
    name: "Skills Tracker",
    version: "1.0.0",
    entityActions: [
        {
            targetEntity: 'skill',
            id: 'skill-train',
            label: 'Train',
            icon: '⏱️',
            intent: 'primary',
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
            order: 20,
            onClick: (data, e) => {
                SkillsStore.getState().selectItem(data, 'edit');
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "skills",
            label: "Practice",
            order: 5
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "skills",
            id: "active",
            label: "Active Queue",
            order: 0,
            component: "insetu-ext-skills"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "skills",
            id: "repertoire",
            label: "Full Repertoire",
            order: 1,
            component: "insetu-ext-skills"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "skills",
            id: "groups",
            label: "Groups",
            order: 2,
            component: "insetu-ext-skills"
        }
    ]
});