import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const CronicStore = createExtensionStore('Cronic', {
    jobs: [],
    loading: false,
    selectedLog: '',
    selectedJobId: null,
    hasCrontab: true,
    fetchStatus: async () => {
        try {
            const res = await window.inSetu.api.get('cronic/status');
            if (res.ok) {
                const data = await res.json();
                CronicStore.setState({ hasCrontab: data.has_crontab });
            }
        } catch (e) {}
    },
    fetchJobs: async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('cronic')) return;
        CronicStore.setState({ loading: true });
        try {
            // Complies with SEMANTIC_API_ROUTING_MANDATE
            const res = await window.inSetu.api.get('cronic/list');
            if (res.ok) {
                const data = await res.json();
                CronicStore.setState({ jobs: data.jobs || [] });
            }
        } catch (e) {
            console.error("Failed to load cronic jobs:", e);
        } finally {
            CronicStore.setState({ loading: false });
        }
    },
    fetchLogs: async (jobId) => {
        try {
            const res = await window.inSetu.api.get(`cronic/logs?job_id=${jobId}`);
            if (res.ok) {
                const data = await res.json();
                CronicStore.setState({ selectedLog: data.logs, selectedJobId: jobId });
            }
        } catch (e) {
            console.error("Failed to fetch cronic logs:", e);
        }
    }
});

window.inSetu.stores.Cronic = CronicStore;
export class InSetuExtCronic extends InSetuElement {
    static get extensionName() { return 'cronic'; }
    static properties = {
        jobs: { type: Array },
        loading: { type: Boolean },
        selectedLog: { type: String },
        selectedJobId: { type: String },
        hasCrontab: { type: Boolean }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        this.jobs = [];
        this.loading = false;
        this.selectedLog = '';
        this.selectedJobId = null;
        this.hasCrontab = true;
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            CronicStore,
            state => ({
                jobs: state.jobs || [],
                loading: !!state.loading,
                selectedLog: state.selectedLog || '',
                selectedJobId: state.selectedJobId,
                hasCrontab: state.hasCrontab !== false
            }),
            {
                autoFetch: () => {
                    CronicStore.getState().fetchStatus();
                    CronicStore.getState().fetchJobs();
                }
            }
        );

        // Auto-refresh the execution output log every 10 seconds if one is actively open
        this.registerInterval(() => {
            if (this.selectedJobId) {
                CronicStore.getState().fetchLogs(this.selectedJobId);
            }
        }, 10000);
    }
    onViewActivated() {
        CronicStore.getState().fetchStatus();
        CronicStore.getState().fetchJobs();
    }
    async _toggleJob(job) {
        await this.api.post('cronic/toggle', { job_id: job.id, enabled: !job.enabled });
        CronicStore.getState().fetchJobs();
    }
    async _deleteJob(jobId) {
        if (!confirm("Delete this scheduled cronic job?")) return;
        await this.api.post('cronic/delete', { job_id: jobId });
        CronicStore.getState().fetchJobs();
    }
    _getRunNowAction(jobId) {
        return this.api.bindJobAction('cronic/run_now', { job_id: jobId }, {
            onProgress: (msg) => this.setStatus(`⏳ ${msg}`, null),
            onComplete: (statusData) => {
                this.setStatus(`✅ ${statusData.message}`, 2000);
                CronicStore.getState().fetchLogs(jobId);
            },
            onError: (err) => alert(`❌ Execution failed: ${err.message}`)
        });
    }

    _getKillAction(jobId) {
        return this.api.bindJobAction('cronic/kill', { job_id: jobId }, {
            onProgress: (msg) => this.setStatus(`⏳ ${msg}`, null),
            onComplete: (statusData) => {
                this.setStatus(`✅ ${statusData.message}`, 2000);
                CronicStore.getState().fetchJobs();
                if (this.selectedJobId === jobId) {
                    CronicStore.getState().fetchLogs(jobId);
                }
            },
            onError: (err) => alert(`❌ Termination failed: ${err.message}`)
        });
    }
    render() {
        if (!this.hasCrontab) {
            return html`
                <sutram-view>
                    <sutram-surface variant="tinted" intent="warning" padding="md">
                        <sutram-stack direction="row" align="start" gap="sm">
                            <sutram-icon name="alert-triangle" size="lg" intent="warning"></sutram-icon>
                            <sutram-stack direction="col" gap="xs">
                                <h3>OS Not Supported</h3>
                                <sutram-label text="The Cronic extension requires a Unix-like environment with crontab installed (Linux, macOS, WSL)."></sutram-label>
                            </sutram-stack>
                        </sutram-stack>
                    </sutram-surface>
                </sutram-view>
            `;
        }
        if (this.loading && this.jobs.length === 0) {
            return html`<sutram-view><sutram-spinner text="Loading scheduled jobs..."></sutram-spinner></sutram-view>`;
        }

        return html`
            <sutram-view titleText="Scheduled System Tasks" descriptionText="Manage crontab bindings and manual script executions.">
                <sutram-stack direction="col" gap="md">

                    <sutram-card-group>
                        ${this.jobs.length === 0 ? html`<sutram-empty-state text="No active cronic jobs scheduled for this workspace."></sutram-empty-state>` : ''}
                        ${this.jobs.map(job => {
                            const jobBasename = new this.utils.InSetuURI(job.filepath).basename;
                            return html`
                            <sutram-card
                                .filename=${jobBasename}
                                .titleText=${jobBasename}
                                .descriptionText=${`Schedule: ${job.schedule} • Status: ${job.last_status || 'pending'}`}
                                .detailText=${job.filepath}
                                icon="clock"
                                intent=${job.enabled ? 'success' : 'neutral'}>
                                <sutram-stack slot="actions" direction="row" gap="sm" ?wrap=${true}>
                                    <sutram-async-btn ?compact=${true} icon="play" label="Run Now" intent="primary" .onClick=${this._getRunNowAction(job.id)}></sutram-async-btn>
                                    <sutram-async-btn ?compact=${true} icon="square" label="Stop" intent="neutral" .onClick=${this._getKillAction(job.id)}></sutram-async-btn>
                                    <sutram-async-btn ?compact=${true} icon=${job.enabled ? 'pause' : 'play'} label=${job.enabled ? 'Pause' : 'Resume'} intent="warning" .onClick=${async () => this._toggleJob(job)}></sutram-async-btn>
                                    <sutram-btn ?compact=${true} intent="neutral" icon="file-text" label="Logs" @click=${() => CronicStore.getState().fetchLogs(job.id)}></sutram-btn>
                                    <sutram-async-btn ?compact=${true} icon="trash-2" label="Remove" intent="danger" .onClick=${async () => this._deleteJob(job.id)}></sutram-async-btn>
                                </sutram-stack>
                            </sutram-card>
                        `;})}
                    </sutram-card-group>
                    ${this.selectedJobId ? html`
                        <sutram-collapsible titleText="Execution Output Log" .open=${true}>
                            <pre style="max-height: 250px; overflow-y: auto; margin: 0;">${this.selectedLog || 'No logs recorded.'}</pre>
                        </sutram-collapsible>
                    ` : ''}
                </sutram-stack>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-ext-cronic', InSetuExtCronic);

window.ExtensionRegistry.registerExtension('cronic', {
    name: "Cronic Job Manager",
    version: "1.0.0",
    offline_mode: "read_only",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'cronic-schedule-file',
            label: 'Schedule Cronic',
            icon: '⏰',
            intent: 'primary',
            order: 15,
            match: (data) => {
                const store = window.inSetu.stores.Cronic;
                if (store && store.getState().hasCrontab === false) return false;
                const fp = data?.filepath || '';
                return fp.endsWith('.py') || fp.endsWith('.sh');
            },
            asyncAction: async (data, e) => {
                const choice = prompt(
                    `Schedule '${new window.inSetu.utils.InSetuURI(data.filepath).basename}' via Cronic:\n\n` +
                    `1: Every Hour (0 * * * *)\n` +
                    `2: Daily at 2 AM (0 2 * * *)\n` +
                    `3: Every Monday (0 0 * * 1)\n` +
                    `4: Every 15 Mins (*/15 * * * *)\n\n` +
                    `Enter 1-4 or enter a custom cron expression:`,
                    "1"
                );

                if (!choice) return;

                let schedule = "0 * * * *";
                if (choice === "1") schedule = "0 * * * *";
                else if (choice === "2") schedule = "0 2 * * *";
                else if (choice === "3") schedule = "0 0 * * 1";
                else if (choice === "4") schedule = "*/15 * * * *";
                else if (choice.includes("*")) schedule = choice.trim();

                const res = await window.inSetu.api.post('cronic/schedule', {
                    filepath: data.filepath,
                    schedule: schedule
                });

                if (res.ok) {
                    if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⏰ Cronic Job Scheduled Successfully", 2000);
                    }
                    CronicStore.getState().fetchJobs();
                }
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "cronic",
            label: "Cronic",
            icon: "clock",
            intent: "warning",
            order: 85
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "cronic",
            id: "main",
            label: "Scheduled Scripts",
            icon: "clock",
            intent: "warning",
            order: 1,
            component: "insetu-ext-cronic"
        }
    ]
});