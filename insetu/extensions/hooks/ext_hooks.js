import { html } from 'lit';
import { createExtensionStore, InSetuElement, bindStoreInput, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

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
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('hooks')) return;
        HooksStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.get('hooks/list');
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
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('hooks')) return;
        try {
            const res = await window.inSetu.api.get('hooks/logs');
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
        allRepos: { type: Array }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.rules = [];
        this.logs = [];
        this.loading = false;
        this.ruleModalOpen = false;
        this.editingRule = null;
        this.ruleForm = { name: '', trigger_type: 'repo_update', trigger_target: 'ALL', command: '', enabled: true };
        this.allRepos = [];
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            HooksStore,
            state => ({
                rules: state.rules || [],
                logs: state.logs || [],
                loading: !!state.loading,
                ruleModalOpen: !!state.ruleModalOpen,
                editingRule: state.editingRule,
                ruleForm: state.ruleForm
            }),
            {
                autoFetch: () => {
                    HooksStore.getState().fetchRules();
                    HooksStore.getState().fetchLogs();
                }
            }
        );
        this.subscribe(
            AppStore,
            state => state.allRepos || [],
            (allRepos) => {
                this.allRepos = allRepos;
            }
        );
        this.allRepos = AppStore.getState()?.allRepos || [];

        this.registerGlobalListener('insetu:hooks:approve', window, (e) => this.approveRule(e.detail.data));
        this.registerGlobalListener('insetu:hooks:toggle', window, (e) => this.toggleRule(e.detail.data));
        this.registerGlobalListener('insetu:hooks:execute', window, (e) => this.executeRule(e.detail.id));
        this.registerGlobalListener('insetu:hooks:edit', window, (e) => this.openCreateModal(e.detail.data));
        this.registerGlobalListener('insetu:hooks:delete', window, (e) => this.deleteRule(e.detail.id));
    }

    onViewActivated() {
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
        if (!name || !command) {
            this.setStatus("Rule name and command are required.", 3500, true);
            return;
        }
        try {
            const payload = { ...this.ruleForm };
            if (this.editingRule) payload.id = this.editingRule.id;
            const res = await this.api.post('hooks/save', payload);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            HooksStore.setState({ ruleModalOpen: false });
            HooksStore.getState().fetchRules();
            this.setStatus("✅ Automation rule saved.", 2500);
        } catch (e) {
            this.setStatus(`❌ Error saving rule: ${e.message}`, 3500, true);
        }
    }

    async approveRule(rule) {
        if (!confirm(`Approve this command? It runs with your account whenever the rule fires.\n\n${rule.command}`)) return;
        try {
            // Sends the command that was shown, so a command changed in the meantime is refused rather than approved unseen
            const res = await this.api.post('hooks/approve', { id: rule.id, command: rule.command });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            HooksStore.getState().fetchRules();
            this.setStatus("✅ Rule command approved.", 2500);
        } catch (e) {
            this.setStatus(`❌ Error approving rule: ${e.message}`, 3500, true);
            HooksStore.getState().fetchRules();
        }
    }

    async toggleRule(rule) {
        try {
            const res = await this.api.post('hooks/toggle', { id: rule.id, enabled: !rule.enabled });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            HooksStore.getState().fetchRules();
        } catch (e) {
            this.setStatus(`❌ Error toggling rule: ${e.message}`, 3500, true);
        }
    }

    async deleteRule(ruleId) {
        if (!confirm("Are you sure you want to delete this automation rule?")) return;
        try {
            const res = await this.api.post('hooks/delete', { id: ruleId });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            HooksStore.getState().fetchRules();
            this.setStatus("🗑️ Automation rule deleted.", 2500);
        } catch (e) {
            this.setStatus(`❌ Error deleting rule: ${e.message}`, 3500, true);
        }
    }
    _getExecuteRuleAction(ruleId) {
        return this.api.bindJobAction('hooks/execute', { id: ruleId }, {
            onProgress: () => {
                this.setStatus("⏳ Executing rule...", null);
            },
            onComplete: () => {
                HooksStore.getState().fetchLogs();
                this.setStatus("✅ Rule executed successfully", 2000);
            },
            onError: (err) => {
                this.setStatus(`❌ Execution failed: ${err.message}`, 3500, true);
                HooksStore.getState().fetchLogs();
            }
        });
    }

    async executeRule(ruleId) {
        try { await this._getExecuteRuleAction(ruleId)(); } catch(e) {}
    }
    render() {
        return html`
            <sutram-view titleText="Automation Rules" descriptionText="Trigger local commands automatically when repositories or buckets update.">
                <sutram-stack direction="col" gap="lg">
                    ${this.loading ? html`<sutram-spinner text="Loading automation rules..."></sutram-spinner>` : ''}
                    <sutram-stack direction="col" gap="sm">
                        ${this.rules.length === 0 && !this.loading ? html`<sutram-empty-state text="No automation rules configured. Click '+ New Rule' to create one."></sutram-empty-state>` : ''}
                        ${this.rules.map(rule => {
                            const needsApproval = rule.approved === false;
                            const desc = `IF: ${rule.trigger_type} [Target:${rule.trigger_target}]${needsApproval ? ' • 🔒 Needs approval: click Approve to review its command' : ''}`;
                            return html`
                            <sutram-card
                                .filename=${rule.id}
                                .titleText=${rule.name}
                                .descriptionText=${desc}
                                icon=${needsApproval ? 'lock' : (rule.enabled ? 'play-circle' : 'circle')}
                                intent=${needsApproval ? 'warning' : (rule.enabled ? 'success' : 'neutral')}
                                entityType="hook_rule"
                                .entityData=${rule}>
                                <sutram-surface variant="inset" padding="xs">
                                    <code><b>THEN:</b> ${rule.command}</code>
                                </sutram-surface>
                            </sutram-card>
                        `;
                        })}
                    </sutram-stack>

                    <sutram-surface variant="ghost" border="top" padding="sm" gap="sm">
                        <sutram-stack direction="col" gap="xs">
                            <h3>Recent Activity</h3>
                            <sutram-label text="Displays the last 20 execution logs (cleared automatically after 24 hours)."></sutram-label>
                        </sutram-stack>
                        <sutram-stack direction="col" gap="sm">
                            ${this.logs.length === 0 ? html`<sutram-empty-state text="No recent activity logged."></sutram-empty-state>` : ''}
                            ${this.logs.map(log => {
                                const intent = log.status === 'completed' ? 'success' : (log.status === 'failed' ? 'danger' : 'warning');
                                const safeDate = log.updated_at ? this.utils.formatDate(log.updated_at * 1000) : 'Unknown';
                                const output = log.artifact?.output || '';
                                return html`
                                    <sutram-collapsible titleText="[${log.status.toUpperCase()}] ${log.message} (${safeDate})" .intent=${intent}>
                                        ${output ? html`<pre>${output}</pre>` : html`<sutram-label text="No terminal output captured."></sutram-label>`}
                                    </sutram-collapsible>
                                `;
                            })}
                        </sutram-stack>
                    </sutram-surface>
                </sutram-stack>
            </sutram-view>
            ${this.ruleModalOpen ? html`
            <sutram-modal  
                ?open=${true} 
                ?fullscreen=${true}
                titleText=${this.editingRule ? 'Edit Automation Rule' : 'New Automation Rule'}
                @sutram-modal-closed=${(e) => { if (e.target === e.currentTarget) HooksStore.setState({ ruleModalOpen: false }); }}>

                <sutram-stack slot="body" direction="col" gap="md">
                    ${bindStoreInput(HooksStore, 'ruleForm.name', this.ruleForm.name, { label: 'Rule Friendly Title', placeholder: 'e.g., Auto-Compile UI Assets on Save', flush: true })}

                    <sutram-stack direction="grid" ?compact=${true}>
                        ${bindStoreInput(HooksStore, 'ruleForm.trigger_type', this.ruleForm.trigger_type, {
                            label: 'Trigger Type (IF)',
                            type: 'select',
                            flush: true,
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

                        ${this.ruleForm.trigger_type === 'repo_update' ? html`
                            <sutram-select 
                                label="Target Boundary"
                                ?flush=${true}
                                .value=${this.ruleForm.trigger_target}
                                .options=${[{ value: 'ALL', label: 'ALL Repositories' }, ...this.allRepos.map(r => ({ value: r, label: r }))]}
                                @sutram-input-changed=${e => HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: e.detail.value } }))}>
                            </sutram-select>
                        ` : html`
                            <sutram-stack direction="row" gap="sm">
                                ${(() => {
                                    const parts = (this.ruleForm.trigger_target || '').split('::');
                                    const selectedRepo = parts[0] || this.allRepos[0] || '';
                                    const selectedBucket = parts[1] || '';
                                    const buckets = selectedRepo ? this.sys.getFlattenedBuckets(selectedRepo) : [];

                                    return html`
                                        <sutram-select 
                                            label="Repo"
                                            ?flush=${true}
                                            ?grow=${true}
                                            .value=${selectedRepo}
                                            .options=${this.allRepos.map(r => ({ value: r, label: r }))}
                                            @sutram-input-changed=${e => {
                                                const newRepo = e.detail.value;
                                                const newBuckets = this.sys.getFlattenedBuckets(newRepo);
                                                const newBucket = newBuckets.length > 0 ? newBuckets[0].id : '';
                                                HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: newRepo + '::' + newBucket } }));
                                            }}>
                                        </sutram-select>
                                        <sutram-select 
                                            label="Bucket"
                                            ?flush=${true}
                                            ?grow=${true}
                                            .value=${selectedBucket}
                                            .options=${buckets.length > 0 ? buckets.map(b => ({ value: b.id, label: b.title })) : [{ value: '', label: 'No Buckets' }]}
                                            @sutram-input-changed=${e => {
                                                HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, trigger_target: selectedRepo + '::' + e.detail.value } }));
                                            }}>
                                        </sutram-select>
                                    `;
                                })()}
                            </sutram-stack>
                        `}
                    </sutram-stack>

                    <sutram-stack direction="col" gap="xs">
                        ${bindStoreInput(HooksStore, 'ruleForm.command', this.ruleForm.command, { label: 'Command Line Command (THEN)', placeholder: 'e.g., bash ./insetu/scripts/vendor_sutram.sh or pytest', flush: true })}
                        <sutram-label text="Executed from workspace root by default. Use explicit ~ or / for host paths."></sutram-label>
                    </sutram-stack>
                    <sutram-toggle
                        label="Enable Rule Immediately"
                        ?flush=${true}
                        .checked=${!!this.ruleForm.enabled}
                        @sutram-input-changed=${e => HooksStore.setState(s => ({ ruleForm: { ...s.ruleForm, enabled: e.detail.value } }))}>
                    </sutram-toggle>
                </sutram-stack>
                <sutram-async-btn slot="footer" label="💾 Save Rule" intent="primary" .onClick=${this.saveRule.bind(this)}></sutram-async-btn>
            </sutram-modal>
            ` : ''}
        `;
    }
}
customElements.define('insetu-ext-hooks', InSetuExtHooks);
window.ExtensionRegistry.registerExtension('hooks', {
    name: "Automation Hooks",
    version: "1.0.0",
    entityActions: [
        {
            targetEntity: 'hook_rule',
            id: 'hook-approve',
            label: 'Approve',
            icon: '🔓',
            intent: 'warning',
            order: 5,
            match: (data) => data.approved === false,
            emitEvent: (data) => ({ name: 'insetu:hooks:approve', detail: { data } })
        },
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
            match: (data) => data.approved !== false,
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
            slot: "slots:primary-navigation",
            id: "ctrl",
            label: "Ctrl",
            order: 6
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "ctrl",
            id: "hooks",
            label: "Hooks",
            icon: "webhook",
            intent: "highlight",
            order: 3,
            menuActions: [
                {
                    label: "New Rule",
                    icon: "plus",
                    onClick: () => window.inSetu?.events?.emit('insetu:hooks:edit', { data: null })
                }
            ],
            component: "insetu-ext-hooks"
        }
    ]
});