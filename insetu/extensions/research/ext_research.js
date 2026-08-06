import { html, css } from 'lit';
import { createExtensionStore, InSetuElement, bindStoreInput } from '../core/sdk.js';
import { sharedStyles } from '../core/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;

// --- UDF STATE STORE ---
export const ResearchStore = createExtensionStore('Research', {
    jobs: [],
    inbox: [],
    selectedJobId: null,
    selectedItemId: null,
    targetDir: 'research/',
    aiTriageMode: false,
    isTabActive: false,
    newJobModalOpen: false,
    searchForm: { query: '', provider: 'serper', parser: 'jina', dateRange: '', dateStart: '', dateEnd: '', yearStart: '', yearEnd: '', maxResults: '50', maxCustom: '' },
    setSearchForm: (field, val) => ResearchStore.setState(state => ({ searchForm: { ...state.searchForm, [field]: val } }))
});

window.inSetu.stores.Research = ResearchStore;
export class InSetuExtResearch extends InSetuElement {
    static get extensionName() { return 'research'; }
    static properties = {
        jobs: { type: Array },
        inbox: { type: Array },
        selectedJobId: { type: String },
        selectedItemId: { type: String },
        targetDir: { type: String },
        aiTriageMode: { type: Boolean },
        newJobModalOpen: { type: Boolean },
        searchForm: { type: Object },
        _aiJsonInput: { type: String }
    };
    static styles = [
        sharedStyles,
        css`
            :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; container-type: inline-size; }
            .rs-layout { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
            .rs-view { display: none; flex-direction: column; height: 100%; overflow: hidden; }
            .rs-view.active { display: flex; }
        `
    ];
    constructor() {
        super();
        this.jobs = [];
        this.inbox = [];
        this.selectedJobId = null;
        this.selectedItemId = null;
        this.targetDir = 'research/';
        this.aiTriageMode = false;
        this.newJobModalOpen = false;
        this.searchForm = {};
        this._aiJsonInput = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(ResearchStore, state => {
            this.jobs = state.jobs;
            this.inbox = state.inbox;
            this.selectedJobId = state.selectedJobId;
            this.selectedItemId = state.selectedItemId;
            this.targetDir = state.targetDir;
            this.aiTriageMode = state.aiTriageMode;
            this.newJobModalOpen = state.newJobModalOpen;
            this.searchForm = state.searchForm;
        });
        // Initial sync
        const state = ResearchStore.getState();
        this.jobs = state.jobs;
        this.inbox = state.inbox;
        this.selectedJobId = state.selectedJobId;
        this.selectedItemId = state.selectedItemId;
        this.targetDir = state.targetDir;
        this.aiTriageMode = state.aiTriageMode;
        this.newJobModalOpen = state.newJobModalOpen;
        this.searchForm = state.searchForm;

        this.registerGlobalListener('insetu:research:action', window, (e) => this.handleJobAction(e.detail.id, e.detail.action));
        this.registerGlobalListener('insetu:research:fetch', window, () => this.fetchState());

        this.fetchState();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._pollTimer) clearTimeout(this._pollTimer);
    }
    async fetchState() {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('research')) return;
        try {
            const [jRes, iRes] = await Promise.all([
                this.api.get('jobs'),
                this.api.get('inbox?status=pending,duplicate,in_library')
            ]);

            if (jRes.ok && iRes.ok) {
                const jData = await jRes.json();
                const iData = await iRes.json();

                // Pre-parse meta_json to avoid heavy O(N) operations inside the Lit render loop
                const parsedJobs = (jData.jobs || []).map(j => ({
                    ...j,
                    meta: (() => { try { return JSON.parse(j.meta_json || '{}'); } catch(e) { return {}; } })()
                }));

                ResearchStore.setState({ jobs: parsedJobs, inbox: iData.items || [] });

                // Native component polling to replace the banned global tick
                const activeJobs = (jData.jobs || []).filter(j => j.status === 'running' || j.status === 'gathering');
                if (activeJobs.length > 0) {
                    if (this._pollTimer) clearTimeout(this._pollTimer);
                    this._pollTimer = setTimeout(() => this.fetchState(), 3000);
                }
            }
        } catch (e) {
            console.error("Failed to fetch research state:", e);
        }
    }

    onWorkspaceChanged(newWorkspaceId) {
        this.fetchState();
    }
    async startJob(e) {
        const { query, provider, parser, dateStart, dateEnd, yearStart, yearEnd, maxResults: formMax, maxCustom, dateRange: rawDateRange } = this.searchForm;
        const targetDir = this.targetDir || 'research/';

        const dateRange = (() => {
            if (rawDateRange === 'custom') {
                if (!dateStart || !dateEnd) return null;
                return `${dateStart}..${dateEnd}`;
            } else if (rawDateRange === 'custom_year') {
                if (!yearStart || !yearEnd || yearStart.length !== 4 || yearEnd.length !== 4) return null;
                return `${yearStart}-01-01..${yearEnd}-12-31`;
            }
            return rawDateRange;
        })();
        if (dateRange === null) throw new Error("Valid date configuration required for custom ranges.");
        if (!query) throw new Error("Query required.");

        const maxResults = formMax === 'custom' ? (parseInt(maxCustom, 10) || 50) : parseInt(formMax, 10);

        try {
            await this.api.postJson('start', { query, provider, parser: parser, target_dir: targetDir, max_results: maxResults, date_range: dateRange });
            ResearchStore.setState(s => ({ searchForm: { ...s.searchForm, query: '' }, newJobModalOpen: false }));
            await this.fetchState();
        } catch (err) {
            throw new Error(err.message || "Failed to start job.");
        }
    }

    async handleJobAction(jobId, action) {
        if (action === 'delete' && !confirm("Are you sure you want to permanently delete this research job and all its scraped items? This cannot be undone.")) return;

        try {
            await this.api.postJson(`${jobId}/action`, { action });
            if (action === 'delete') {
                ResearchStore.setState({ selectedJobId: null, selectedItemId: null, aiTriageMode: false });
            }
            await this.fetchState();
        } catch (err) {
            alert(`Action failed: ${err.message}`);
        }
    }

    async handleDisposition(inboxId, status) {
        const item = this.inbox.find(i => i.id === inboxId);
        if (!item) return;

        if (status === 'accepted') {
            const targetDir = (this.targetDir || 'research/').replace(/\/+$/, '') + '/';
            const slug = (() => {
                const generated = this.utils.slugify(item.title);
                return (generated || 'research-note').replace(/^-+|-+$/g, '').substring(0, 60);
            })();
            const filepath = targetDir + slug + '.md';

            const success = await this.sys.executeWorkspaceMutation('fs/save', { filepath, content: item.raw_markdown }, { silent: true });
            if (!success) return alert("Failed to write Markdown to disk.");
        }

        try {
            await this.api.postJson(`inbox/${inboxId}/disposition`, { status });
            if (this.selectedItemId === inboxId) {
                ResearchStore.setState({ selectedItemId: null });
            }

            const currentInbox = this.inbox;
            if (status === 'force_scrape') {
                const updatedInbox = currentInbox.map(i => i.id === inboxId ? { ...i, status: 'pending', scraped_at: null, raw_markdown: null } : i);
                ResearchStore.setState({ inbox: updatedInbox });
            } else {
                const updatedInbox = currentInbox.filter(i => i.id !== inboxId);
                ResearchStore.setState({ inbox: updatedInbox });
            }
        } catch (err) {
            alert(`Disposition failed: ${err.message}`);
        }
    }
    _getGenerateContextAction(jobId) {
        return this.api.bindJobAction(`${jobId}/export_context`, {}, {
            onComplete: async (statusData) => {
                const files = statusData.artifact.files || [];
                for (const f of files) {
                    await this.vfs.fetchAndDownloadState(f.filename, f.download_url);
                }
            },
            onError: (err) => alert("Failed to generate context files: " + err.message)
        });
    }

    async generateContext(jobId, e) {
        try { await this._getGenerateContextAction(jobId)(e); } catch(err) {}
    }
    async executeAITriage(e) {
        const input = (this._aiJsonInput || '').trim();
        if (!input) return;

        const payload = (() => {
            try {
                const cleanInput = input.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
                return JSON.parse(cleanInput);
            } catch (err) {
                return null;
            }
        })();

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return alert("Invalid JSON object. Ensure it looks like: {\"accept\": [], \"reject\": [], \"rescan\": []}");
        }

        const extractId = (val) => (typeof val === 'object' && val !== null && val.id) ? String(val.id).trim() : String(val).trim();
        const acceptIds = Array.isArray(payload.accept) ? payload.accept.map(extractId) : [];
        const rejectIds = Array.isArray(payload.reject) ? payload.reject.map(extractId) : [];
        const rescanIds = Array.isArray(payload.rescan) ? payload.rescan.map(extractId) : [];

        try {
            for (const id of acceptIds) if (id) await this.handleDisposition(id, 'accepted');
            for (const id of rejectIds) if (id) await this.handleDisposition(id, 'rejected');
            for (const id of rescanIds) if (id) await this.handleDisposition(id, 'force_scrape');

            this._aiJsonInput = '';
            await this.fetchState();
            alert(`✅ Triage complete:\n- ${acceptIds.length} Accepted to Workspace\n- ${rejectIds.length} Rejected\n- ${rescanIds.length} Queued for Rescan`);
            ResearchStore.setState({ aiTriageMode: false, selectedItemId: null });
        } catch(err) {
            throw new Error("An error occurred executing the batch triage.");
        }
    }
    _renderJobCard(job) {
        const meta = job.meta || {};
        const statusColor = (() => {
            if (job.status === 'running') return 'var(--intent-primary)';
            if (job.status === 'gathering') return 'var(--intent-highlight)';
            if (job.status === 'completed') return 'var(--intent-primary)';
            if (job.status === 'reviewed') return 'var(--intent-success)';
            if (job.status === 'failed') return 'var(--intent-danger)';
            return 'var(--text-muted)';
        })();
        const safeDate = this.utils.formatDate(job.created_at);
        const cardStatusExtra = job.status === 'gathering'  
            ? `(Page ${Math.floor((meta.start_index || 0) / 10) + 1} - ${job.total_links} found)`
            : `(${job.processed_links}/${job.total_links} scraped)`;

        return html`
            <insetu-card
                .filename=${job.id}
                .titleText=${`🔍 ${job.query}`}
                .descriptionText=${`Status: ${job.status.toUpperCase()} ${cardStatusExtra}`}
                .detailText=${`Created: ${safeDate} | Range: ${meta.date_range || 'Any Time'}`}
                icon=""
                intentColor=${statusColor}
                entityType="research_job"
                .entityData=${job}
                @card-clicked=${() => ResearchStore.setState({ selectedJobId: job.id, selectedItemId: null })}>
                ${(job.status === 'failed' && meta.error) ? html`<div style="font-size: 0.8rem; color: var(--intent-danger); background: var(--input-bg); padding: 6px 10px; border-radius: 4px; margin-top: 8px; border: 1px solid var(--intent-danger);">⚠️ <b>Error:</b> ${meta.error}</div>` : ''}
            </insetu-card>
        `;
    }
    _renderJobDetailView() {
        const job = this.jobs.find(j => j.id === this.selectedJobId);
        if (!job) return '';

        const meta = job.meta || {};
        const statusColor = (() => {
            if (job.status === 'running') return 'var(--intent-primary)';
            if (job.status === 'gathering') return 'var(--intent-highlight)';
            if (job.status === 'completed') return 'var(--intent-primary)';
            if (job.status === 'reviewed') return 'var(--intent-success)';
            if (job.status === 'failed') return 'var(--intent-danger)';
            return 'var(--text-muted)';
        })();
        const safeDate = this.utils.formatDate(job.created_at);
        const cardStatusExtra = job.status === 'gathering'  
            ? `(Page ${Math.floor((meta.start_index || 0) / 10) + 1} - ${job.total_links} found)`
            : `(${job.processed_links}/${job.total_links} scraped)`;

        const activeInbox = this.inbox.filter(i => i.job_id === this.selectedJobId);

        return html`
            <div id="rs-detail-header" style="margin-bottom: 15px; padding: 15px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                    <div style="font-weight: bold; color: var(--intent-primary); font-size: 1.15rem; word-break: break-word;">🔍 ${job.query}</div>
                    <sutram-async-btn style="flex-shrink: 0;" label="📋 Copy" intent="neutral" .onClick=${() => this.utils.copyRawText(job.query)}></sutram-async-btn>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="font-size: 0.95rem;"><b>Status:</b> <span style="color: ${statusColor}; font-weight: bold;">${job.status.toUpperCase()}</span> <span style="color: var(--text-muted);">${cardStatusExtra}</span></span>
                </div>
                <div style="display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-muted); flex-wrap: wrap; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                    <span><b>Provider:</b> <span style="color: var(--text);">${job.provider}</span></span>
                    <span><b>Date Range:</b> <span style="color: var(--text);">${meta.date_range || 'Any Time'}</span></span>
                    <span><b>Started:</b> <span style="color: var(--text);">${safeDate}</span></span>
                </div>
            </div>
            <div id="rs-job-actions-row" style="margin-bottom: 15px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
                ${job.status === 'running' ? html`<button class="btn-sm" style="background: var(--intent-warning); margin: 0; padding: 6px 12px; font-weight: bold;" @click=${() => this.handleJobAction(job.id, 'pause')}>⏸️ Pause</button>` : ''}
                ${job.status === 'paused' ? html`<button class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 6px 12px; font-weight: bold;" @click=${() => this.handleJobAction(job.id, 'resume')}>▶️ Resume</button>` : ''}
                ${job.status === 'failed' ? html`<button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px; font-weight: bold;" @click=${() => this.handleJobAction(job.id, 'retry')}>🔄 Retry</button>` : ''}
                ${['running', 'paused', 'gathering', 'failed'].includes(job.status) ? html`<button class="btn-sm" style="background: var(--intent-neutral); margin: 0; padding: 6px 12px; font-weight: bold;" @click=${() => this.handleJobAction(job.id, 'cancel')}>⏹️ Cancel</button>` : ''}
                <button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 6px 12px; font-weight: bold;" @click=${() => this.handleJobAction(job.id, 'delete')}>🗑️ Delete</button>
                <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px; font-weight: bold;" @click=${() => ResearchStore.setState({ aiTriageMode: !this.aiTriageMode })}>${this.aiTriageMode ? '🔙 Back to Manual Triage' : '🤖 AI-Assisted Batch Triage'}</button>
            </div>

            ${this.aiTriageMode ? html`
                <div style="display: flex; flex-direction: column; flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 20px; overflow-y: auto;">
                    <h3 style="margin-top: 0; color: var(--intent-highlight); margin-bottom: 15px;">Batch Triage Pipeline</h3>
                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 1: Download Context</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Downloads all fully-scraped pending URLs in this job as chunked text files.</p>
                    <sutram-async-btn style="margin-bottom: 25px; display: block;" label="📦 Pack Context Files" intent="primary" .onClick=${this._getGenerateContextAction(job.id)}></sutram-async-btn>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 2: Prompt Template</h4>
                    <textarea readonly style="width: 100%; min-height: 160px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 25px; resize: vertical;" onclick="this.select()">Review these scraped documents. I am researching [INSERT TOPIC]. Filter out any documents that are SEO spam, irrelevant, or low quality. Output your response as a raw JSON object containing three arrays of \`id\` strings: \`accept\` (highly relevant), \`reject\` (spam/irrelevant), and \`rescan\` (relevant but poorly formatted or truncated). Do not include markdown blocks. Example: {"accept": ["id-1"], "reject": ["id-2"], "rescan": ["id-3"]}</textarea>
                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 3: Ingest AI Triage</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste the raw JSON object from the LLM here to process the batch.</p>
                    <textarea id="rs-ai-json-input" .value=${this._aiJsonInput} @input=${e => this._aiJsonInput = e.target.value} placeholder='{"accept": [], "reject": [], "rescan": []}' style="width: 100%; min-height: 120px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 10px; resize: vertical;"></textarea>
                    <sutram-async-btn style="width: 100%; display: block;" label="🤖 Execute Triage" intent="highlight" .onClick=${this.executeAITriage.bind(this)}></sutram-async-btn>
                </div>
            ` : html`
                <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 200px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg);">
                        <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding: 10px; flex: 1;">
                            ${activeInbox.length === 0 ? html`<insetu-empty-state text="No pending items for this job."></insetu-empty-state>` : activeInbox.map(item => {
                                const statusBadge = item.scraped_at ? '✅' : '⏳';
                                const isSelected = this.selectedItemId === item.id;
                                return html`
                                    <insetu-card
                                        .filename=${item.id}
                                        .titleText=${`${statusBadge} ${item.title || 'Untitled'}`}
                                        .descriptionText=${item.url}
                                        .detailText=${`ID: ${item.id}`}
                                        icon="📄"
                                        ?selected=${isSelected}
                                        intentColor="var(--intent-primary)"
                                        @card-clicked=${() => ResearchStore.setState({ selectedItemId: item.id })}>
                                        ${item.status === 'duplicate' ? html`<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;"><span style="font-size: 0.75rem; color: var(--intent-warning); font-weight: bold;">⚠️ Already Scraped</span><button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-warning); color: var(--intent-warning); padding: 2px 8px; margin: 0; font-size: 0.7rem;" @click=${(e) => { e.stopPropagation(); this.handleDisposition(item.id, 'force_scrape'); }}>Force Scrape Anyway</button></div>` : ''}
                                        ${item.status === 'in_library' ? html`<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;"><span style="font-size: 0.75rem; color: var(--intent-highlight); font-weight: bold;">📚 In Library</span><button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-highlight); color: var(--intent-highlight); padding: 2px 8px; margin: 0; font-size: 0.7rem;" @click=${(e) => { e.stopPropagation(); this.handleDisposition(item.id, 'force_scrape'); }}>Force Scrape Anyway</button></div>` : ''}
                                    </insetu-card>
                                `;
                            })}
                        </div>
                    </div>
                </div>
            `}
        `;
    }

    render() {
        const activeItem = this.inbox.find(i => i.id === this.selectedItemId);

        return html`
            <div class="rs-layout">
                ${!this.selectedJobId ? html`
                    <div class="rs-view active" style="overflow-y: auto; padding-right: 5px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 15px;">
                            <h4 style="margin: 0; color: var(--text);">Active & Past Jobs</h4>
                            <button class="btn-sm" style="background: var(--intent-success); font-weight: bold;" @click=${() => ResearchStore.setState({ newJobModalOpen: true })}>➕ New Job</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${(this.jobs || []).map(job => this._renderJobCard(job))}
                        </div>
                    </div>
                ` : html`
                    <div class="rs-view active">
                        ${this._renderJobDetailView()}
                    </div>
                `}
            </div>
            <sutram-modal ?open=${!!activeItem} titleText="Research Item Preview" ?fullscreen=${true} @sutram-modal-closed=${() => ResearchStore.setState({ selectedItemId: null })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; height: 100%; padding: 0;">
                    ${activeItem ? html`
                        <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; background: var(--input-bg);">
                            <div>
                                <div style="margin-bottom: 4px; font-weight: bold; color: var(--intent-highlight); font-size: 1.15rem;">${activeItem.title || 'Untitled'}</div>
                                <div style="margin-bottom: 4px;"><a href="${activeItem.url}" target="_blank" style="color: var(--intent-primary); font-size: 0.85rem; word-break: break-all; font-weight: normal; text-decoration: none;">🔗 ${activeItem.url}</a></div>
                                <div style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; font-weight: normal; user-select: all;">Item ID: ${activeItem.id}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <div style="display: flex; gap: 5px; flex: 1; min-width: 200px;">
                                    <input type="text" .value=${this.targetDir || 'research/'} placeholder="Target path (e.g. research/)" style="flex: 1; padding: 6px; font-family: monospace;" @input=${(e) => ResearchStore.setState({ targetDir: e.target.value })}>
                                    <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px;" @click=${() => { if(this.ui && this.ui.openFolderBrowser) this.ui.openFolderBrowser((p) => { ResearchStore.setState({ targetDir: p ? p + '/' : '' }); }); }}>...</button>
                                </div>
                                <button class="btn-sm" style="background: var(--intent-success); margin: 0;" @click=${() => this.handleDisposition(activeItem.id, 'accepted')}>✅ Accept to Workspace</button>
                                <button class="btn-sm" style="background: var(--intent-danger); margin: 0;" @click=${() => this.handleDisposition(activeItem.id, 'rejected')}>🗑️ Reject</button>
                                <button class="btn-sm" style="background: var(--intent-warning); margin: 0;" @click=${() => this.handleDisposition(activeItem.id, 'force_scrape')}>🔄 Re-Scrape</button>
                            </div>
                        </div>
                        <div tabindex="0" style="flex: 1; overflow-y: auto; padding: 20px; font-size: 0.95rem; outline: none;" .innerHTML=${activeItem.raw_markdown ? marked.parse(activeItem.raw_markdown) : '<span style="color: var(--intent-warning); font-style: italic;">Awaiting extraction...</span>'}></div>
                    ` : ''}
                </div>
            </sutram-modal>
            <sutram-modal ?open=${this.newJobModalOpen} ?fullscreen=${true} titleText="New Research Job" @sutram-modal-closed=${() => ResearchStore.setState({ newJobModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; flex: 1; min-height: 0; overflow-y: auto;">
                    ${bindStoreInput(ResearchStore, 'searchForm.query', this.searchForm.query, { placeholder: 'Search Query...', style: 'width: 100%;' })}
                    <div style="display: flex; gap: 10px;">
                        ${bindStoreInput(ResearchStore, 'searchForm.provider', this.searchForm.provider || 'serper', { type: 'select', style: 'flex: 1;', selectOptions: [{value: 'serper', label: 'Google (Serper.dev API)'}, {value: 'google', label: 'Google (Playwright)'}, {value: 'duckduckgo', label: 'DuckDuckGo'}] })}
                        ${bindStoreInput(ResearchStore, 'searchForm.dateRange', this.searchForm.dateRange || '', { type: 'select', style: 'flex: 1;', selectOptions: [{value: '', label: 'Any Time'}, {value: 'd', label: 'Past Day'}, {value: 'w', label: 'Past Week'}, {value: 'm', label: 'Past Month'}, {value: 'y', label: 'Past Year'}, {value: 'custom', label: 'Custom Range (Exact)...'}, {value: 'custom_year', label: 'Custom Range (Years)...'}] })}
                    </div>
                    <div style="display: ${this.searchForm.dateRange === 'custom' ? 'flex' : 'none'}; gap: 10px;">
                        ${bindStoreInput(ResearchStore, 'searchForm.dateStart', this.searchForm.dateStart, { type: 'date', style: 'flex: 1;' })}
                        ${bindStoreInput(ResearchStore, 'searchForm.dateEnd', this.searchForm.dateEnd, { type: 'date', style: 'flex: 1;' })}
                    </div>
                    <div style="display: ${this.searchForm.dateRange === 'custom_year' ? 'flex' : 'none'}; gap: 10px;">
                        ${bindStoreInput(ResearchStore, 'searchForm.yearStart', this.searchForm.yearStart, { type: 'number', placeholder: 'YYYY (e.g. 1999)', min: 1990, max: 2100, style: 'flex: 1;' })}
                        ${bindStoreInput(ResearchStore, 'searchForm.yearEnd', this.searchForm.yearEnd, { type: 'number', placeholder: 'YYYY (e.g. 2005)', min: 1990, max: 2100, style: 'flex: 1;' })}
                    </div>
                    <div style="display: flex; gap: 10px; align-items: flex-end;">
                        <div style="flex: 1;">
                            ${bindStoreInput(ResearchStore, 'searchForm.parser', this.searchForm.parser || 'jina', { label: 'Extraction Parser', type: 'select', style: 'width: 100%;', selectOptions: [{value: 'jina', label: 'Jina AI (Rich Markdown)'}, {value: 'bs4', label: 'Local (BeautifulSoup)'}] })}
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; gap: 8px; align-items: flex-end;">
                                ${bindStoreInput(ResearchStore, 'targetDir', this.targetDir || 'research/', { label: 'Default Output Folder', placeholder: 'e.g. research/', style: 'flex: 1; font-family: monospace;' })}
                                <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 12px; height: 38px;" @click=${() => { if(this.ui && this.ui.openFolderBrowser) this.ui.openFolderBrowser((p) => { ResearchStore.setState({ targetDir: p ? p + '/' : '' }); }); }}>...</button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div style="display: flex; gap: 8px; align-items: flex-end;">
                            ${bindStoreInput(ResearchStore, 'searchForm.maxResults', this.searchForm.maxResults || '50', { label: 'Max Results', type: 'select', style: 'flex: 1;', selectOptions: [{value: '10', label: '10 Results'}, {value: '25', label: '25 Results'}, {value: '50', label: '50 Results'}, {value: '100', label: '100 Results'}, {value: '9999', label: 'All (Keep Scraping)'}, {value: 'custom', label: 'Custom...'}] })}
                            ${bindStoreInput(ResearchStore, 'searchForm.maxCustom', this.searchForm.maxCustom, { type: 'number', placeholder: 'e.g. 150', min: 1, max: 1000, style: `flex: 1; display: ${this.searchForm.maxResults === 'custom' ? 'block' : 'none'};` })}
                        </div>
                    </div>
                </div>
                <sutram-async-btn slot="footer" label="🚀 Start Scraping" loadingLabel="⏳ Starting..." intent="highlight" .onClick=${this.startJob.bind(this)}></sutram-async-btn>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-research', InSetuExtResearch);
export class InSetuExtResearchActions extends InSetuElement {
    static properties = { selectedJobId: { type: String } };
    static styles = [sharedStyles, css`
        .research-back-btn { 
            background: var(--intent-neutral); color: white; border: none; padding: 0 12px; font-size: 14px; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 0; height: 34px; display: flex; align-items: center; 
        }
        .research-back-btn:hover { filter: brightness(1.2); }
    `];
    constructor() { super(); this.selectedJobId = null; }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(ResearchStore, state => this.selectedJobId = state.selectedJobId);
        this.selectedJobId = ResearchStore.getState().selectedJobId;
    }
    render() {
        if (!this.selectedJobId) return html``;
        return html`<button class="research-back-btn" @click=${() => ResearchStore.setState({ selectedJobId: null, selectedItemId: null })}>🔙 Back to Jobs</button>`;
    }
}
customElements.define('insetu-ext-research-actions', InSetuExtResearchActions);
window.ExtensionRegistry.registerExtension('research', {
    name: "Research Inbox",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'research_job',
            id: 'rs-pause',
            label: 'Pause',
            icon: '⏸️',
            intent: 'warning',
            order: 10,
            match: (data) => data.status === 'running',
            asyncAction: async (data, e) => window.dispatchEvent(new CustomEvent('insetu:research:action', { detail: { id: data.id, action: 'pause' } }))
        },
        {
            targetEntity: 'research_job',
            id: 'rs-resume',
            label: 'Resume',
            icon: '▶️',
            intent: 'success',
            order: 10,
            match: (data) => data.status === 'paused',
            asyncAction: async (data, e) => window.dispatchEvent(new CustomEvent('insetu:research:action', { detail: { id: data.id, action: 'resume' } }))
        },
        {
            targetEntity: 'research_job',
            id: 'rs-retry',
            label: 'Retry',
            icon: '🔄',
            intent: 'highlight',
            order: 10,
            match: (data) => data.status === 'failed',
            asyncAction: async (data, e) => window.dispatchEvent(new CustomEvent('insetu:research:action', { detail: { id: data.id, action: 'retry' } }))
        },
        {
            targetEntity: 'research_job',
            id: 'rs-cancel',
            label: 'Cancel',
            icon: '⏹️',
            intent: 'neutral',
            order: 20,
            match: (data) => ['running', 'paused', 'gathering', 'failed'].includes(data.status),
            asyncAction: async (data, e) => window.dispatchEvent(new CustomEvent('insetu:research:action', { detail: { id: data.id, action: 'cancel' } }))
        },
        {
            targetEntity: 'research_job',
            id: 'rs-delete',
            label: 'Delete',
            icon: '🗑️',
            intent: 'danger',
            order: 30,
            asyncAction: async (data, e) => window.dispatchEvent(new CustomEvent('insetu:research:action', { detail: { id: data.id, action: 'delete' } }))
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "edit",
            targetSub: "research",
            component: "insetu-ext-research-actions",
            order: 1
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "research",
            label: "Research",
            order: 4,
            component: "insetu-ext-research"
        }
    ],
    uiHooks: {
        'zone:subtab-changed': (data) => {
            if (data.subId === 'research') {
                ResearchStore.setState({ isTabActive: true });
            } else {
                ResearchStore.setState({ isTabActive: false });
            }
        },
        'zone:force-refresh': (data) => {
            if (data.subId === 'research') {
                ResearchStore.setState({ jobs: [], inbox: [] });
                window.inSetu.events.emit('insetu:research:fetch');
            }
            return false;
        }
    }
});

// --- HEADLESS EXTENSION STATE SYNCHRONIZATION ---
// Executes independently of the UI component to ensure the inbox is pre-hydrated.
async function syncResearchState() {
    try {
        const [jRes, iRes] = await Promise.all([
            window.inSetu.api.workspace('research/jobs'),
            window.inSetu.api.workspace('research/inbox?status=pending,duplicate,in_library')
        ]);
        if (jRes.ok && iRes.ok) {
            const jData = await jRes.json();
            const iData = await iRes.json();
            const parsedJobs = (jData.jobs || []).map(j => ({
                ...j,
                meta: (() => { try { return JSON.parse(j.meta_json || '{}'); } catch(e) { return {}; } })()
            }));
            ResearchStore.setState({ jobs: parsedJobs, inbox: iData.items || [] });
        }
    } catch(e) {
        console.warn("Headless research sync failed:", e);
    }
}
syncResearchState();
