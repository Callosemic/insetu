import { AppStore } from '../store.js';
import { html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { createExtensionStore, InSetuElement } from '../sdk.js';

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

            clearPayload: () => set({ playlist: [], allSkills: [], groupsList: [] }),
            fetchPlaylist: async (silent = false) => {
                if (!silent) SkillsStore.setState({ loading: true });
                try {
                    const res = await window.inSetu.api.workspace('skills/playlist');
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
                try {
                    const res = await window.inSetu.api.workspace('skills/list');
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
                try {
                    const res = await window.inSetu.api.system('config');
                    if (res.ok) {
                        const config = await res.json();
                        const skillCfg = config.extension_config?.skills_practice?.domains || {
                            musical_repertoire: {
                                label: "Musical Repertoire",
                                metrics: {
                                    tempo: { type: "integer", label: "Current Tempo", unit: "BPM", target: "target_tempo" },
                                    intonation: { type: "rating", min: 1, max: 10, label: "Intonation Accuracy" }
                                },
                                step_labels: [
                                    { key: "untouched", label: "Untouched (Not Started)" },
                                    { key: "memorizing", label: "Memorizing" },
                                    { key: "memorized", label: "Memorized" },
                                    { key: "improvising", label: "Improvising Over Structure" },
                                    { key: "mastered", label: "Mastered (Performance Ready)" }
                                ]
                            }
                        };
                        SkillsStore.setState({ domainConfig: skillCfg });
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
        this._configModalOpen = false;
        this._configText = '';
        this._rawSystemConfig = null;
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
        const globalActiveSub = localStorage.getItem('insetu_subtab_skills') || 'active';
        return this.currentViewMode === globalActiveSub;
    }

    connectedCallback() {
        super.connectedCallback();
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

            if (state.selectedItem && !this._editName) {
                this._editName = state.selectedItem.name;
                this._editTags = state.selectedItem.tags || '';
                this._editGroup = state.selectedItem.group_name || '';
            } else if (!state.selectedItem) {
                this._editName = '';
                this._editTags = '';
                this._editGroup = '';
            }
        });
        this.subscribe(AppStore, state => state.activeWorkspace, () => {
            this._reloadAll();
        });

        this._boundOpenConfig = this._openConfigModal.bind(this);
        document.addEventListener('skills-open-config', this._boundOpenConfig);

        this._reloadAll();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('skills-open-config', this._boundOpenConfig);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
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
            const res = await this.api.post('create', payload);
            if (res.ok) {
                SkillsStore.setState({ newSkillModalOpen: false });
            } else {
                const faultText = await res.json().catch(() => ({}));
                alert(`Failed to compile item structure: ${faultText.error || res.statusText}`);
            }
        } catch (err) {
            alert(`Network synchronization failure: ${err.message}`);
        }
    }
    async _openConfigModal() {
        try {
            const res = await window.inSetu.api.system('config');
            if (res.ok) {
                this._rawSystemConfig = await res.json();
                this._configText = JSON.stringify(this._rawSystemConfig.extension_config?.skills_practice?.domains || {}, null, 2);
                this._configModalOpen = true;
            }
        } catch(e) {
            console.error("Config load error:", e);
            alert("Failed to load skills targets.");
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

    async _saveConfig() {
        try {
            const domains = JSON.parse(this._configText);
            const config = this._rawSystemConfig || {};
            if (!config.extension_config) config.extension_config = {};
            if (!config.extension_config.skills_practice) config.extension_config.skills_practice = {};
            config.extension_config.skills_practice.domains = domains;
            const res = await window.inSetu.api.system('config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                this._configModalOpen = false;
                this._reloadAll();
                alert("Skills targets committed safely to configuration matrix!");
            } else {
                alert("Failed to preserve configuration framework.");
            }
        } catch (err) {
            console.error("Configuration Save Error:", err);
            alert("Invalid JSON schema structure detected inside domains configuration. Check the console for details.");
        }
    }
    async _deleteSkillItem() {
        if (!this.selectedItem) return;
        if (!confirm(`⚠️ Are you absolutely sure you want to permanently delete "${this.selectedItem.name}"?\nThis action will destroy the markdown file on disk and cannot be undone.`)) return;
        try {
            const res = await this.api.post('delete', { filepath: this.selectedItem.filepath });
            if (res.ok) {
                SkillsStore.setState({ selectedItem: null });
                alert("Track permanently wiped from file system.");
            } else {
                const faultText = await res.json().catch(() => ({}));
                alert(`Failed to execute deletion sequence: ${faultText.error || res.statusText}`);
            }
        } catch (err) {
            alert(`Network synchronization failure: ${err.message}`);
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
            const res = await this.api.post('update', payload);
            if (res.ok) {
                SkillsStore.setState({ selectedItem: null });
                alert("Structural configuration updated successfully!");
            } else {
                const faultText = await res.json().catch(() => ({}));
                alert(`Failed to save adjustments: ${faultText.error || res.statusText}`);
            }
        } catch (err) {
            alert(`Network failure: ${err.message}`);
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
            const res = await this.api.post('log', payload);
            if (res.ok) {
                SkillsStore.setState({ selectedItem: null });
                alert("Practice entry committed atomically into text ledger!");
            }
        } catch (e) {
            console.error("Practice logging failed:", e);
            alert("Network error sync loop failed. Check the console for details.");
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
                options.push(i);
            }

            return html`
                <div>
                    <label style="font-size:0.8rem; font-weight:bold; color:var(--text-muted); display:block; margin-bottom:4px;">${def.label}</label>
                    <select .value=${value !== '' ? value : min} 
                        @change=${(e) => SkillsStore.getState().updateMetricField(key, parseInt(e.target.value, 10))}>
                        ${options.map(opt => html`<option value="${opt}">${opt}</option>`)}
                    </select>
                </div>
            `;
        }

        return html`
            <div>
                <label style="font-size:0.8rem; font-weight:bold; color:var(--text-muted); display:block; margin-bottom:4px;">${def.label} ${def.unit ? `(${def.unit})` : ''}</label>
                <input type="number" .value=${value} placeholder="e.g. 120"
                    @input=${(e) => SkillsStore.getState().updateMetricField(key, e.target.value === '' ? '' : parseFloat(e.target.value))}>
            </div>
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
                        <details style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; cursor: pointer;">
                            <summary style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 1rem; list-style: none; user-select: none;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span>📦 ${groupName}</span>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); background: var(--bg); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border);">
                                        ${linkedItems.length} item(s)
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px; width: 40%; max-width: 300px;">
                                    <div style="flex: 1; height: 8px; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); overflow: hidden; position: relative;">
                                        <div style="width: ${progressPercentage}%; height: 100%; background: var(--intent-success); transition: width 0.3s ease;"></div>
                                    </div>
                                    <span style="font-size: 0.85rem; color: var(--intent-success); white-space: nowrap; font-family: var(--font-mono);">${absoluteCompleted}/${absoluteParts} (${progressPercentage}%)</span>
                                </div>
                            </summary>
                            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px; border-top: 1px solid var(--border); padding-top: 12px; cursor: default;" @click=${(e) => e.stopPropagation()}>
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
                        </details>
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
                ${this.loading ? html`<div class="spinner" style="display:block; margin-top: 0;">Sweeping session items...</div>` : ''}
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
                                            @card-clicked=${() => SkillsStore.getState().selectItem(item, 'train')}>
                                            <insetu-file-actions slot="actions" .filepath=${item.filepath} .isFS=${true}></insetu-file-actions>
                                            <div slot="actions" style="display: flex; gap: 6px;">
                                                <button class="btn-sm" style="background: var(--intent-highlight);" @click=${(e) => { e.stopPropagation(); SkillsStore.getState().selectItem(item, 'train'); }}>⏱️ Train</button>
                                                <button class="btn-sm" style="background: var(--intent-neutral);" @click=${(e) => { e.stopPropagation(); SkillsStore.getState().selectItem(item, 'edit'); }}>✏️ Edit</button>
                                            </div>
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
            <insetu-modal
                ?open=${!!this.selectedItem && this.modalMode === 'train'}
                titleText="⏱️ Practice Session: ${this.selectedItem?.name}"
                @modal-closed=${() => SkillsStore.setState({ selectedItem: null })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Quality Rating Scale (SM-2 Algorithm)</label>
                        <select .value=${this.formScore} @change=${(e) => SkillsStore.setState({ formScore: parseInt(e.target.value, 10) })}>
                            <option value="5">5 - Perfect execution (Immediate retention)</option>
                            <option value="4">4 - Correct execution with minimal hesitation</option>
                            <option value="3">3 - Correct execution but required notable effort</option>
                            <option value="2">2 - Incorrect execution; clear structural breakdown</option>
                            <option value="1">1 - Blackout/Untouched (Complete memory lapse)</option>
                        </select>
                    </div>
                    ${(() => {
                        if (!this.selectedItem) return '';
                        const domainMeta = this.domainConfig[this.selectedItem.domain];
                        const options = (this.selectedItem.metrics && this.selectedItem.metrics.custom_steps) ? this.selectedItem.metrics.custom_steps.split(',').map(s => ({ key: s.trim(), label: s.trim() })) : ((domainMeta && domainMeta.step_labels) ? (Array.isArray(domainMeta.step_labels) ? domainMeta.step_labels : Object.keys(domainMeta.step_labels).map(k => ({ key: k, label: domainMeta.step_labels[k] }))) : []);

                        if (options.length === 0) return '';
                        return html`
                            <div>
                                <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Current Mastery Stage</label>
                                <select .value=${this.formStatus} @change=${this._handleStatusChange}>
                                    ${options.map(opt => html`<option value="${opt.key}">${opt.label}</option>`)}
                                </select>
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
                <div slot="footer">
                    <button style="background: var(--intent-success); font-weight: bold; width: 100%; padding: 12px;" @click=${this._submitPracticeSession}>💾 Flush Session Data</button>
                </div>
            </insetu-modal>
            <insetu-modal
                ?open=${!!this.selectedItem && this.modalMode === 'edit'}
                titleText="✏️ Edit Skill Architecture & Structure"
                @modal-closed=${() => SkillsStore.setState({ selectedItem: null })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Track / Skill Title</label>
                            <input type="text" .value=${this._editName || ''} @input=${(e) => this._editName = e.target.value} style="width:100%;">
                        </div>
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Parent Collection Group</label>
                            <input type="text" list="edit-group-list" placeholder="e.g. Warmups (or leave blank)" .value=${this._editGroup || ''} @input=${(e) => this._editGroup = e.target.value} style="width:100%;">
                            <datalist id="edit-group-list">
                                ${this.groupsList.map(g => html`<option value="${g}"></option>`)}
                            </datalist>
                        </div>
                    </div>
                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Tags</label>
                        <input type="text" .value=${this._editTags || ''} placeholder="e.g. Piano, Acoustic, Classical" @input=${(e) => this._editTags = e.target.value} style="width:100%;">
                    </div>
                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Section / Parts Definition Matrix</label>
                        <input type="text" .value=${this.formMetrics.parts || ''} placeholder="e.g. Intro, Verse, Solo" @input=${(e) => SkillsStore.getState().updateMetricField('parts', e.target.value)} style="width:100%;">
                    </div>
                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Optional Path Custom Steps (Comma Separated Overrides)</label>
                        <input type="text" .value=${this.formMetrics.custom_steps || ''} placeholder="e.g. Intro, Solo, Chorus, Mastered" @input=${(e) => SkillsStore.getState().updateMetricField('custom_steps', e.target.value)} style="width:100%;">
                    </div>
                </div>
                <div slot="footer" style="display: flex; gap: 10px; width: 100%;">
<button class="btn-sm" style="background: var(--intent-danger); color: white; font-weight: bold; padding: 12px 18px; 
border: none; border-radius: 4px;" @click=${this._deleteSkillItem}>🗑️ Delete Item</button>
                    <button style="background: var(--intent-primary); font-weight: bold; flex: 1; padding: 12px;" @click=${this._submitStructuralEdit}>💾 Save Structural Changes</button>
                </div>
            </insetu-modal>
            <insetu-modal
                ?open=${this.newSkillModalOpen}
                titleText="Add New Training Skill Item"
                @modal-closed=${() => SkillsStore.setState({ newSkillModalOpen: false })}>
                <form slot="body" @submit=${this._handleCreateSkill} style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Item Name / Track Title</label>
                            <input type="text" placeholder="e.g. Stairway to Heaven" required style="width: 100%;"
                                .value=${this._newSkillForm.name || ''} @input=${e => this._newSkillForm.name = e.target.value}>
                        </div>
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Collection Group</label>
                            <input type="text" list="new-group-list" placeholder="e.g. Repertoire (or leave blank)" style="width: 100%;"
                                .value=${this._newSkillForm.group || ''} @input=${e => this._newSkillForm.group = e.target.value}>
                            <datalist id="new-group-list">
                                ${this.groupsList.map(g => html`<option value="${g}"></option>`)}
                            </datalist>
                        </div>
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Target Domain Framework</label>
                            <select .value=${activeNewDomain} @change=${(e) => { this._newSkillDomain = e.target.value; this._newSkillForm.domain = e.target.value; this.requestUpdate(); }}>
                                ${Object.keys(this.domainConfig).map(k => html`
                                    <option value="${k}">${this.domainConfig[k].label || k}</option>
                                `)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Tags</label>
                        <input type="text" placeholder="e.g. Piano, Acoustic, Classical" style="width: 100%;"
                            .value=${this._newSkillForm.tags || ''} @input=${e => this._newSkillForm.tags = e.target.value}>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Initial Starting Status Stage</label>
                            <select .value=${this._newSkillForm.status || 'untouched'} @change=${e => this._newSkillForm.status = e.target.value}>
                                ${(() => {
                                    const cfg = this.domainConfig[activeNewDomain];
                                    const options = (cfg && cfg.step_labels) ? (Array.isArray(cfg.step_labels) ? cfg.step_labels : Object.keys(cfg.step_labels).map(k => ({ key: k, label: cfg.step_labels[k] }))) : [{ key: 'untouched', label: 'Untouched' }];
                                    return options.map(opt => html`<option value="${opt.key}">${opt.label}</option>`);
                                })()}
                            </select>
                        </div>
                        <div>
                            <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Sections / Parts Matrix Checklist</label>
                            <input type="text" placeholder="e.g. Intro, Verse, Solo" style="width: 100%;"
                                .value=${this._newSkillForm.parts || ''} @input=${e => this._newSkillForm.parts = e.target.value}>
                        </div>
                    </div>
                    <div>
                        <label style="font-weight: bold; font-size: 0.85rem; display: block; margin-bottom: 5px;">Optional Path Custom Steps (Comma Separated Overrides)</label>
                        <input type="text" placeholder="e.g. Intro, Solo, Chorus, Mastered" style="width: 100%;"
                            .value=${this._newSkillForm.custom_steps || ''} @input=${e => this._newSkillForm.custom_steps = e.target.value}>
                    </div>
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
                                                <label style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">${m.label}</label>
                                                <select .value=${this._newSkillMetrics[key] || min} @change=${e => this._newSkillMetrics[key] = e.target.value}>
                                                    ${options.map(opt => html`<option value="${opt}">${opt}</option>`)}
                                                </select>
                                            </div>
                                        `;
                                    }

                                    return html`
                                        <div>
                                            <label style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">${m.label} ${m.unit ? `(${m.unit})` : ''}</label>
                                            <input type="number" placeholder="${m.unit ? m.unit : 'Value'}"
                                                .value=${this._newSkillMetrics[key] || ''} @input=${e => this._newSkillMetrics[key] = e.target.value}>
                                        </div>
                                    `;
                                })}
                            </div>
                        `;
                    })()}
                    
                    <button type="submit" style="background: var(--intent-success); font-weight: bold; width: 100%; padding: 12px; margin-top: 10px;">➕ Initialize Track on Disk</button>
                </form>
            </insetu-modal>

            <insetu-modal
                ?open=${this._configModalOpen}
                titleText="Practice Domain Configurations"
                @modal-closed=${() => this._configModalOpen = false}>
                <div slot="body">
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0;">Define metrics schemas polymorphically using JSON parameters:</p>
                    <textarea 
                        style="font-family: var(--font-mono); min-height: 250px; font-size: 13px;"
                        .value=${this._configText}
                        @input=${(e) => this._configText = e.target.value}></textarea>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); font-weight: bold;" @click=${this._saveConfig}>💾 Save Targets</button>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-skills', InSetuExtSkills);

window.ExtensionRegistry.registerExtension('skills', {
    name: "Skills Tracker",
    version: "1.0.0",
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
    ],
    settingsActions: [
        {
            id: 'skills_config',
            label: 'Practice Configurations',
            icon: '🏋️',
            onClick: () => {
                if (window.switchTab) window.switchTab(null, 'skills');
                // UDF Enforcement: Dispatch intent to the centralized store statelessly
                document.dispatchEvent(new CustomEvent('skills-open-config'));
            }
        }
    ],
    uiHooks: {
        'zone:tab-changed': (tabId) => {
            if (tabId === 'skills') {
                SkillsStore.getState().fetchPlaylist(true);
                SkillsStore.getState().fetchAllSkills();
            }
        },
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'skills') {
                SkillsStore.getState().fetchPlaylist(true);
                SkillsStore.getState().fetchAllSkills();
            }
        },
        'zone:file-card-actions': (data) => {
            if (data.filepath && data.filepath.includes('.skills/')) {
                // Future capability extension hooks can bind downstream items here
            }
        },
        'zone:post-file-save': (filepath) => {
            if (filepath && filepath.includes('.insetu/skills/')) {
                SkillsStore.getState().fetchPlaylist(true);
                SkillsStore.getState().fetchAllSkills();
            }
            return false;
        },
        'zone:post-file-delete': (filepath) => {
            if (filepath && filepath.includes('.insetu/skills/')) {
                SkillsStore.getState().fetchPlaylist(true);
                SkillsStore.getState().fetchAllSkills();
            }
            return false;
        }
    }
});