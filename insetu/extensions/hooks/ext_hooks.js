import { html, css } from 'lit';
import { createExtensionStore, InSetuElement, bindStoreInput } from '../sdk.js';
import { sharedStyles } from '../shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const HooksStore = createExtensionStore('Hooks', {
    rules: [],
    logs: [],
    loading: false,
    ruleModalOpen: false,
    editingRule: null,
    ruleForm: { name: '', trigger_type: 'repo_update', trigger_target: 'ALL', command: '', enabled: true },
    fetchRules: async () => {
        if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('hooks')) return;
        HooksStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace('hooks/list');
            if (res.ok) {
                const data = await res.json();
                HooksStore.setState({ rules: data.rules || [] });
            }
        } catch (e) {
            console.error("Failed to load automation rules:", e);
        } finally {
            HooksStore.setState({ loading: false });
        }
    },
    fetchLogs: async () => {
        if (!window.ACTIVE_EXTENSIONS || !window.ACTIVE_EXTENSIONS.includes('hooks')) return;
        try {
            const res = await window.inSetu.api.workspace('hooks/logs');
            if (res.ok) {
                const data = await res.json();
                HooksStore.setState({ logs: data.logs || [] });
            }
        } catch (e) {
            console.error("Failed to load automation logs:", e);
        }
    }
});
window.inSetu.stores.Hooks = HooksStore;

export class InSetuExtHooks extends InSetuElement {
    static get extensionName() { return 'hooks'; }
    static properties = {
        rules: { type: Array },
        logs: { type: Array },
        loading: { type: Boolean },
        ruleModalOpen: { type: Boolean },
        editingRule: { type: Object },
        ruleForm: { type: Object },
        allRepos: { type: Array },
        targetConfigs: { type: Array }
    };

    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
            .hooks-body { flex: 1; overflow-y: auto; padding: 20px; }
            .rule-card { background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px; margin-bottom: 12px; }
            .cmd-box { font-family: var(--font-mono); background: var(--bg); border: 1px solid var(--border); padding: 8px 12px; border-radius: 4px; font-size: 0.85rem; color: var(--intent-primary); word-break: break-all; margin-top: 8px; }
        `
    ];
    constructor() {
        super();
        this.rules = [];
        this.logs = [];
        this.loading = false;
        this.ruleModalOpen = false;
        this.editingRule = null;
        this.ruleForm = { name: '', trigger_type: 'repo_update', trigger_target: 'ALL', command: '', enabled: true };
        this.allRepos = [];
        this.targetConfigs = [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(HooksStore, state => {
            this.rules = state.rules || [];
            this.logs = state.logs || [];
            this.loading = state.loading;
            this.ruleModalOpen = state.ruleModalOpen;
            this.editingRule = state.editingRule;
            this.ruleForm = state.ruleForm;
        });
        this.subscribe(window.inSetu.stores.Gather, state => {
            this.allRepos = state.allRepos || [];
            this.targetConfigs = state.targetConfigs || [];
        });
        const gState = window.inSetu.stores.Gather.getState();
        this.allRepos = gState.allRepos || [];
        this.targetConfigs = gState.targetConfigs || [];

        this.registerGlobalListener('insetu:hooks:toggle', window, (e) => this.toggleRule(e.detail.data));
        this.registerGlobalListener('insetu:hooks:execute', window, (e) => this.executeRule(e.detail.id));
        this.registerGlobalListener('insetu:hooks:edit', window, (e) => this.openCreateModal(e.detail.data));
        this.registerGlobalListener('insetu:hooks:delete', window, (e) => this.deleteRule(e.detail.id));

        HooksStore.getState().fetchRules();
        HooksStore.getState().fetchLogs();
    }

    onWorkspaceChanged(newWorkspaceId) {
        HooksStore.getState().fetchRules();
        HooksStore.getState().fetchLogs();
    }

    openCreateModal(rule = null) {
        if (rule) {
            HooksStore.setState({
                editingRule: rule,
                ruleForm: { ...rule, enabled: !!rule.enabled },
                ruleModalOpen: true
            });
        } else {
            HooksStore.setState({
                editingRule: null,
                ruleForm: { name: '', trigger_type: 'repo_update', trigger_target: 'ALL', command: '', enabled: true },
                ruleModalOpen: true
            });
        }
    }

    async saveRule() {
        const { name, command } = this.ruleForm;
        if (!name || !command) return alert("Rule name and command are required.");

        try {
            const payload = { ...this.ruleForm };
            if (this.editingRule) payload.id = this.editingRule.id;

            const res = await this.api.post('save', payload);
            if (res.ok) {
                HooksStore.setState({ ruleModalOpen: false });
                HooksStore.getState().fetchRules();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) {
            alert(`Network error saving rule: ${e.message}`);
        }
    }

    async toggleRule(rule) {
        const nextState = !rule.enabled;
        try {
            await this.api.post('toggle', { id: rule.id, enabled: nextState });
            HooksStore.getState().fetchRules();
        } catch (e) {
            alert(`Error toggling rule: ${e.message}`);
        }
    }
    async deleteRule(ruleId) {
        if (!confirm("Are you sure you want to delete this automation rule?")) return;
        try {
            await this.api.post('delete', { id: ruleId });
            HooksStore.getState().fetchRules();
        } catch (e) {
            alert(`Error deleting rule: ${e.message}`);
        }
    }

    async executeRule(ruleId) {
        try {
            const res = await this.api.post('execute', { id: ruleId });
            if (res.ok) {
                const data = await res.json();
                this.api.pollJob(data.job_id, {
                    onProgress: () => {},
                    onComplete: () => {
                        HooksStore.getState().fetchLogs();
                        if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Rule executed successfully", 2000);
                    },
                    onError: (err) => {
                        alert(`Execution failed: ${err.message}`);
                        HooksStore.getState().fetchLogs();
                    }
                });
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("⏳ Executing rule...", null);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) {
            alert(`Network error executing rule: ${e.message}`);
        }
    }

    render() {
        return html`
            <div class="hooks-body">
                <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: var(--text);">Automation Rules</h3>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Trigger local commands automatically when repositories or buckets update.</span>
                </div>
                ${this.loading ? html`<div style="padding: 15px; color: var(--text-muted); font-style: italic;">⏳ Loading automation rules...</div>` : ''}
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${this.rules.length === 0 && !this.loading ? html`<p style="color: var(--text-muted); font-style: italic;">No automation rules configured. Click "+ New Rule" to create one.</p>` : ''}

                    ${this.rules.map(rule => html`
                        <insetu-card
                            .filename=${rule.id}
                            .titleText=${rule.name}
                            .descriptionText=${`IF: ${rule.trigger_type} [Target: ${rule.trigger_target}]`}
                            icon=${rule.enabled ? '🟢' : '⚪'}
                            intentColor=${rule.enabled ? 'var(--intent-success)' : 'var(--intent-neutral)'}
                            entityType="hook_rule"
                            .entityData=${rule}
                            style="opacity: ${rule.enabled ? '1' : '0.6'}; display: block;">

                            <div class="cmd-box" style="margin-top: 5px;"><b>THEN:</b> ${rule.command}</div>
                        </insetu-card>
                    `)}
                </div>
                <div style="margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px;">
                    <div style="margin-bottom: 15px;">
                        <h3 style="margin: 0; color: var(--text);">Recent Activity</h3>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">Displays the last 20 execution logs (cleared automatically after 24 hours).</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${this.logs.length === 0 ? html`<p style="color: var(--text-muted); font-style: italic;">No recent activity logged.</p>` : ''}

                        ${this.logs.map(log => {
                            const statusColor = log.status === 'completed' ? 'var(--intent-success)' : (log.status === 'failed' ? 'var(--intent-danger)' : 'var(--intent-warning)');
                            // Python time.time() returns seconds, JS expects milliseconds
                            const safeDate = log.updated_at ? new Date(log.updated_at * 1000).toLocaleString() : 'Unknown';
                            const output = log.artifact?.output || '';

                            return html`
                                <details style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; overflow: hidden;">
                                    <summary style="padding: 10px 15px; cursor: pointer; outline: none; user-select: none; display: flex; align-items: center; justify-content: space-between; background: var(--bg);">
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="color: ${statusColor}; font-weight: bold; font-size: 0.85rem;">[${log.status.toUpperCase()}]</span>
                                            <span style="font-size: 0.9rem; color: var(--text);">${log.message}</span>
                                        </div>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">${safeDate}</span>
                                    </summary>
                                    ${output ? html`
                                        <div style="padding: 15px; border-top: 1px solid var(--border);">
                                            <pre style="margin: 0; font-size: 0.8rem; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">${output}</pre>
                                        </div>
                                    ` : html`
                                        <div style="padding: 15px; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
                                            No terminal output captured.
                                        </div>
                                    `}
                                </details>
                            `;
                        })}
                    </div>
                </div>
            </div>
            <yenvui-modal  
                ?open=${this.ruleModalOpen} 
                ?fullscreen=${true}
                titleText=${this.editingRule ? 'Edit Automation Rule' : 'New Automation Rule'}
                @yenvui-modal-closed=${() => HooksStore.setState({ ruleModalOpen: false })}>

                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    <div>
                        <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Rule Friendly Title</label>
                        ${bindStoreInput(HooksStore, 'ruleForm.name', this.ruleForm.name, { placeholder: 'e.g., Auto-Compile UI Assets on Save' })}
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 180px;">
                            <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Trigger Type (IF)</label>
                            ${bindStoreInput(HooksStore, 'ruleForm.trigger_type', this.ruleForm.trigger_type, {
                                type: 'select',
                                selectOptions: [
                                    { value: 'repo_update', label: 'IF (repo_update)' },
                                    { value: 'repo_bucket_update', label: 'IF (repo_bucket_update)' }
                                ],
                                onUpdate: () => {
                                    if (this.ruleForm.trigger_type === 'repo_update') {
                                        HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: 'ALL' } }));
                                    } else {
                                        const firstRepo = this.allRepos[0] || '';
                                        const buckets = firstRepo ? this.sys.getFlattenedBuckets(firstRepo) : [];
                                        const firstBucket = buckets.length > 0 ? buckets[0].id : '';
                                        HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: firstRepo + '::' + firstBucket } }));
                                    }
                                }
                            })}
                        </div>

                        <div style="flex: 1; min-width: 180px;">
                            <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Target Boundary</label>
                            ${this.ruleForm.trigger_type === 'repo_update' ? html`
                                <select style="width: 100%; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
                                    .value=${this.ruleForm.trigger_target}
                                    @change=${e => HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: e.target.value } }))}>
                                    <option value="ALL">ALL Repositories</option>
                                    ${this.allRepos.map(r => html`<option value="${r}">${r}</option>`)}
                                </select>
                            ` : html`
                                <div style="display: flex; gap: 8px;">
                                    ${(() => {
                                        const parts = (this.ruleForm.trigger_target || '').split('::');
                                        const selectedRepo = parts[0] || this.allRepos[0] || '';
                                        const selectedBucket = parts[1] || '';
                                        const buckets = selectedRepo ? this.sys.getFlattenedBuckets(selectedRepo) : [];

                                        return html`
                                            <select style="flex: 1; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
                                                .value=${selectedRepo}
                                                @change=${e => {
                                                    const newRepo = e.target.value;
                                                    const newBuckets = this.sys.getFlattenedBuckets(newRepo);
                                                    const newBucket = newBuckets.length > 0 ? newBuckets[0].id : '';
                                                    HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: newRepo + '::' + newBucket } }));
                                                }}>
                                                ${this.allRepos.map(r => html`<option value="${r}">${r}</option>`)}
                                            </select>
                                            <select style="flex: 1; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
                                                .value=${selectedBucket}
                                                @change=${e => {
                                                    HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: selectedRepo + '::' + e.target.value } }));
                                                }}>
                                                ${buckets.map(b => html`<option value="${b.id}">${b.title}</option>`)}
                                                ${buckets.length === 0 ? html`<option value="">No Buckets</option>` : ''}
                                            </select>
                                        `;
                                    })()}
                                </div>
                            `}
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 4px;">Command Line Command (THEN)</label>
                        ${bindStoreInput(HooksStore, 'ruleForm.command', this.ruleForm.command, { placeholder: 'e.g., axnm compile local or npm test' })}
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 4px;">
                            Executed from workspace root by default. Use explicit <code>~</code> or <code>/</code> for host paths.
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
                        ${bindStoreInput(HooksStore, 'ruleForm.enabled', this.ruleForm.enabled, { type: 'checkbox' })}
                        <label style="font-size: 0.9rem; color: var(--text); font-weight: bold; cursor: pointer;">Enable Rule Immediately</label>
                    </div>
                </div>
                <yenvui-async-btn slot="footer" label="💾 Save Rule" intent="primary" .onClick=${this.saveRule.bind(this)}></yenvui-async-btn>
            </yenvui-modal>
        `;
    }
}
customElements.define('insetu-ext-hooks', InSetuExtHooks);

export class InSetuExtHooksActions extends InSetuElement {
    static get extensionName() { return 'hooks'; }
    static styles = [
        sharedStyles,
        css`
            button {
                background: transparent; color: var(--text); border: 1px solid var(--border);
                border-radius: 4px; cursor: pointer; font-weight: bold; width: 34px; height: 34px;
                display: flex; align-items: center; justify-content: center; padding: 0;
                font-size: 1.1rem; transition: background 0.2s; margin: 0;
            }
            button:hover { background: var(--input-bg); }
        `
    ];
    render() {
        return html`
            <button title="New Rule" @click=${() => this.dispatch('insetu:hooks:edit', { data: null })}>➕</button>
        `;
    }
}
customElements.define('insetu-ext-hooks-actions', InSetuExtHooksActions);
window.ExtensionRegistry.registerExtension('hooks', {
    name: "Automation Hooks",
    version: "1.0.0",
    entityActions: [
        {
            targetEntity: 'hook_rule',
            id: 'hook-toggle',
            label: (data) => data.enabled ? 'Pause' : 'Enable',
            icon: (data) => data.enabled ? '⏸️' : '▶️',
            intent: (data) => data.enabled ? 'warning' : 'success',
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:hooks:toggle', detail: { data } })
        },
        {
            targetEntity: 'hook_rule',
            id: 'hook-execute',
            label: 'Run Now',
            icon: '⚡',
            intent: 'highlight',
            order: 15,
            emitEvent: (data) => ({ name: 'insetu:hooks:execute', detail: { id: data.id } })
        },
        {
            targetEntity: 'hook_rule',
            id: 'hook-edit',
            label: 'Edit',
            icon: '✏️',
            intent: 'primary',
            order: 20,
            emitEvent: (data) => ({ name: 'insetu:hooks:edit', detail: { data } })
        },
        {
            targetEntity: 'hook_rule',
            id: 'hook-delete',
            label: 'Delete',
            icon: '🗑️',
            intent: 'danger',
            order: 30,
            emitEvent: (data) => ({ name: 'insetu:hooks:delete', detail: { id: data.id } })
        }
    ],
    layoutSlots: [
        {
            slot: "primary-navigation",
            id: "ctrl",
            label: "Ctrl",
            order: 6
        },
        {
            slot: "sub-navigation",
            targetParent: "ctrl",
            id: "hooks",
            label: "Hooks",
            order: 3,
            component: "insetu-ext-hooks"
        },
        {
            slot: "sub-navigation-actions",
            targetParent: "ctrl",
            targetSub: "hooks",
            component: "insetu-ext-hooks-actions",
            order: 1
        }
    ],
    uiHooks: {
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'ctrl' && data.subId === 'hooks') {
                HooksStore.getState().fetchRules();
                HooksStore.getState().fetchLogs();
            }
        },
        'zone:soft-refresh': (ws) => {
            HooksStore.setState({ rules: [], logs: [] });
            return false;
        }
    }
});