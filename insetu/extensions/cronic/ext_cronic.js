import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';

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
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; padding: 20px; box-sizing: border-box; background: var(--bg); overflow-y: auto; }
            .job-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
            .log-box { font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 0.85rem; max-height: 250px; overflow-y: auto; margin-top: 10px; }
        `
    ];
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
        this.subscribe(CronicStore, state => {
            this.jobs = state.jobs || [];
            this.loading = state.loading;
            this.selectedLog = state.selectedLog;
            this.selectedJobId = state.selectedJobId;
            this.hasCrontab = state.hasCrontab !== false;
        });
        CronicStore.getState().fetchStatus();
        CronicStore.getState().fetchJobs();

        // Auto-refresh the execution output log every 10 seconds if one is actively open
        this.registerInterval(() => {
            if (this.selectedJobId) {
                CronicStore.getState().fetchLogs(this.selectedJobId);
            }
        }, 10000);
    }

    onWorkspaceLoad(workspaceId) {
        CronicStore.getState().fetchStatus();
        CronicStore.getState().fetchJobs();
    }

    async _toggleJob(job) {
        await this.api.post('toggle', { job_id: job.id, enabled: !job.enabled });
        CronicStore.getState().fetchJobs();
    }
    async _deleteJob(jobId) {
        if (!confirm("Delete this scheduled cronic job?")) return;
        await this.api.post('delete', { job_id: jobId });
        CronicStore.getState().fetchJobs();
    }
    _getRunNowAction(jobId) {
        return this.api.bindJobAction('run_now', { job_id: jobId }, {
            onProgress: (msg) => this.setStatus(`⏳ ${msg}`, null),
            onComplete: (statusData) => {
                this.setStatus(`✅ ${statusData.message}`, 2000);
                CronicStore.getState().fetchLogs(jobId);
            },
            onError: (err) => alert(`❌ Execution failed: ${err.message}`)
        });
    }

    _getKillAction(jobId) {
        return this.api.bindJobAction('kill', { job_id: jobId }, {
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
                <div style="padding: 20px; background: var(--input-bg); border: 1px solid var(--intent-warning); border-radius: 6px; color: var(--text); margin: 20px;">
                    <h3 style="margin-top: 0; color: var(--intent-warning);">⚠️ OS Not Supported</h3>
                    <p>The Cronic extension requires a Unix-like environment with <code>crontab</code> installed (Linux, macOS, WSL).</p>
                </div>
            `;
        }

        if (this.loading && this.jobs.length === 0) {
            return html`<sutram-spinner text="Loading scheduled jobs..."></sutram-spinner>`;
        }

        return html`
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 5px;">
                    <h3 style="margin: 0; color: var(--text);">⏰ Scheduled System Tasks</h3>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Manage crontab bindings and manual script executions.</span>
                </div>

                <sutram-card-group>
                    ${this.jobs.length === 0 ? html`<p style="color: var(--text-muted); font-style: italic;">No active cronic jobs scheduled for this workspace.</p>` : ''}
                    ${this.jobs.map(job => html`
                        <insetu-card
                            .filename=${job.filepath.split('/').pop()}
                            .titleText=${job.filepath.split('/').pop()}
                            .descriptionText=${`Schedule: ${job.schedule} • Status: ${job.last_status || 'pending'}`}
                            .detailText=${job.filepath}
                            icon="⏰"
                            intentColor=${job.enabled ? 'var(--intent-success)' : 'var(--intent-neutral)'}>
                            <div slot="actions" class="job-actions">
                                <sutram-async-btn label="▶️ Run Now" intent="primary" style="margin: 0;" .onClick=${this._getRunNowAction(job.id)}></sutram-async-btn>
                                <sutram-async-btn label="⏹️ Stop" intent="neutral" style="margin: 0;" .onClick=${this._getKillAction(job.id)}></sutram-async-btn>
                                <sutram-async-btn label=${job.enabled ? '⏸️ Pause' : '▶️ Resume'} intent="warning" style="margin: 0;" .onClick=${async () => this._toggleJob(job)}></sutram-async-btn>
                                <button class="btn-sm" style="background: var(--input-bg); border: 1px solid var(--border); color: var(--text);" @click=${() => CronicStore.getState().fetchLogs(job.id)}>📜 Logs</button>
                                <sutram-async-btn label="🗑️ Remove" intent="danger" style="margin: 0;" .onClick=${async () => this._deleteJob(job.id)}></sutram-async-btn>
                            </div>
                        </insetu-card>
                    `)}
                </sutram-card-group>

                ${this.selectedJobId ? html`
                    <sutram-collapsible titleText="📜 Execution Output Log" .open=${true} style="margin-top: 10px;">
                        <div class="log-box">${this.selectedLog || 'No logs recorded.'}</div>
                    </sutram-collapsible>
                ` : ''}
            </div>
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
                    `Schedule '${data.filepath.split('/').pop()}' via Cronic:\n\n` +
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
            order: 85
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "cronic",
            id: "main",
            label: "Scheduled Scripts",
            order: 1,
            component: "insetu-ext-cronic"
        }
    ]
});