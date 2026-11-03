import { html } from 'lit';
import { createExtensionStore, InSetuElement, bindStoreInput, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;

// --- UDF STATE STORE ---
export const ResearchStore = createExtensionStore('Research', {
    jobs: [],
    inbox: [],
    selectedJobId: null,
    selectedItemId: null,
    targetDir: 'vfs://research/',
    aiTriageMode: false,
    isTabActive: false,
    newJobModalOpen: false,
    searchForm: { query: '', provider: 'serper', parser: 'bs4', dateRange: '', dateStart: '', dateEnd: '', yearStart: '', yearEnd: '', maxResults: '50', maxCustom: '' },
    setSearchForm: (field, val) => ResearchStore.setState(state => ({ searchForm: { ...state.searchForm, [field]: val } })),
    openItemPreview: (itemId) => {
        ResearchStore.setState({ selectedItemId: itemId });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            const item = (ResearchStore.getState().inbox || []).find(i => i.id === itemId);
            layout.openWindow({
                id: 'research:preview',
                component: 'insetu-research-preview-projection',
                label: item?.title ? `Preview: ${item.title.substring(0, 30)}` : 'Research Item Preview',
                icon: 'file-text',
                intent: 'highlight',
                extName: 'research',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
    }
}, {
    onEvict: {
        'research:preview': { selectedItemId: null }
    }
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
    static styles = [sharedStyles];
    constructor() {
        super();
        this.jobs = [];
        this.inbox = [];
        this.selectedJobId = null;
        this.selectedItemId = null;
        this.targetDir = 'vfs://research/';
        this.aiTriageMode = false;
        this.newJobModalOpen = false;
        this.searchForm = {};
        this._aiJsonInput = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            ResearchStore,
            state => ({
                jobs: state.jobs,
                inbox: state.inbox,
                selectedJobId: state.selectedJobId,
                selectedItemId: state.selectedItemId,
                targetDir: state.targetDir,
                aiTriageMode: state.aiTriageMode,
                newJobModalOpen: state.newJobModalOpen,
                searchForm: state.searchForm
            }),
            { autoFetch: () => this.fetchState() }
        );

        this.registerGlobalListener('insetu:research:action', window, (e) => this.handleJobAction(e.detail.id, e.detail.action));
        this.registerGlobalListener('insetu:research:fetch', window, () => this.fetchState());
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._isUnmounted = true;
    }
    async fetchState() {
        this.clearManagedTimeouts();
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('research')) return;
        const fetchWs = this.workspaceId;
        try {
            const [jRes, iRes] = await Promise.all([
                this.api.get('research/jobs'),
                this.api.get('research/inbox?status=pending,duplicate,in_library')
            ]);
            if (window.inSetu.utils.getActiveWorkspace() !== fetchWs) return;

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
                if (activeJobs.length > 0 && !this._isUnmounted) {
                    this.registerTimeout(() => {
                        if (!this._isUnmounted) this.fetchState();
                    }, 3000);
                }
            }
        } catch (e) {
            console.error("Failed to fetch research state:", e);
        }
    }
    onViewActivated() {
        this.fetchState();
    }
    onForceRefresh() {
        super.onForceRefresh();
        ResearchStore.setState({ isTabActive: true });
        this.fetchState();
    }
    async startJob(e) {
        const { query, provider, parser, dateStart, dateEnd, yearStart, yearEnd, maxResults: formMax, maxCustom, dateRange: rawDateRange } = this.searchForm;
        const targetDir = this.targetDir || 'vfs://research/';

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
            await this.api.post('research/start', { query, provider, parser: parser, target_dir: targetDir, max_results: maxResults, date_range: dateRange });
            ResearchStore.setState(s => ({ searchForm: { ...s.searchForm, query: '' }, newJobModalOpen: false }));
            await this.fetchState();
        } catch (err) {
            throw new Error(err.message || "Failed to start job.");
        }
    }
    async handleJobAction(jobId, action) {
        if (action === 'delete' && !confirm("Are you sure you want to permanently delete this research job and all its scraped items? This cannot be undone.")) return;

        try {
            await this.api.post(`research/${jobId}/action`, { action });
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
            const rawFp = targetDir + slug + '.md';
            const filepath = this.vfs?.normalizeVfsURI ? this.vfs.normalizeVfsURI(rawFp) : rawFp;

            const success = await this.sys.executeWorkspaceMutation('fs/save', { filepath, content: item.raw_markdown }, { silent: true });
            if (!success) return alert("Failed to write Markdown to disk.");
        }
        try {
            await this.api.post(`research/inbox/${inboxId}/disposition`, { status });
            if (this.selectedItemId === inboxId) {
                ResearchStore.setState({ selectedItemId: null });
                if (window.Sutram?.stores?.Layout) {
                    window.Sutram.stores.Layout.getState().closeWindow('research:preview');
                }
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
        return this.api.bindJobAction(`research/${jobId}/export_context`, {}, {
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
        const statusIntent = (() => {
            if (job.status === 'running') return 'primary';
            if (job.status === 'gathering') return 'highlight';
            if (job.status === 'completed') return 'primary';
            if (job.status === 'reviewed') return 'success';
            if (job.status === 'failed') return 'danger';
            return 'neutral';
        })();
        const safeDate = this.utils.formatDate(job.created_at);
        const cardStatusExtra = job.status === 'gathering'  
            ? `(Page ${Math.floor((meta.start_index || 0) / 10) + 1} -${job.total_links} found)`
            : `(${job.processed_links}/${job.total_links} scraped)`;
        return html`
            <sutram-card
                .filename=${job.id}
                .titleText=${`🔍 ${job.query}`}
                .descriptionText=${`Status: ${job.status.toUpperCase()}${cardStatusExtra}`}
                .detailText=${`Created: ${safeDate} | Range:${meta.date_range || 'Any Time'}`}
                icon="search"
                intent=${statusIntent}
                entityType="research_job"
                .entityData=${job}
                @card-clicked=${() => ResearchStore.setState({ selectedJobId: job.id, selectedItemId: null })}>
                ${(job.status === 'failed' && meta.error) ? html`<sutram-surface variant="tinted" intent="danger" padding="xs"><span>⚠️ <b>Error:</b> ${meta.error}</span></sutram-surface>` : ''}
            </sutram-card>
        `;
    }
    _renderJobDetailView() {
        const job = this.jobs.find(j => j.id === this.selectedJobId);
        if (!job) return '';

        const meta = job.meta || {};
        const activeIntent = (() => {
            if (job.status === 'running') return 'primary';
            if (job.status === 'gathering') return 'highlight';
            if (job.status === 'completed') return 'primary';
            if (job.status === 'reviewed') return 'success';
            if (job.status === 'failed') return 'danger';
            return 'neutral';
        })();
        const safeDate = this.utils.formatDate(job.created_at);
        const cardStatusExtra = job.status === 'gathering'  
            ? `(Page ${Math.floor((meta.start_index || 0) / 10) + 1} - ${job.total_links} found)`
            : `(${job.processed_links}/${job.total_links} scraped)`;
        const activeInbox = this.inbox.filter(i => i.job_id === this.selectedJobId);
        return html`
            <sutram-surface id="rs-detail-header" variant="panel" padding="md" gap="sm">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <sutram-stack direction="row" align="center" gap="sm">
                        <sutram-btn ?compact=${true} intent="neutral" icon="arrow-left" label="Back to Jobs" @click=${() => ResearchStore.setState({ selectedJobId: null, selectedItemId: null, aiTriageMode: false })}></sutram-btn>
                        <sutram-icon name="search" size="md" intent="primary"></sutram-icon>
                        <h4>${job.query}</h4>
                    </sutram-stack>
                    <sutram-async-btn icon="copy" label="Copy" intent="neutral" .onClick=${() => this.utils.copyRawText(job.query)}></sutram-async-btn>
                </sutram-stack>
                <sutram-stack direction="row" align="center" gap="sm">
                    <sutram-tag .text=${`${job.status.toUpperCase()} ${cardStatusExtra}`} .intent=${activeIntent}></sutram-tag>
                </sutram-stack>
                <sutram-stack direction="row" gap="md" ?wrap=${true}>
                    <sutram-label .text=${`Provider: ${job.provider}`}></sutram-label>
                    <sutram-label .text=${`Date Range: ${meta.date_range || 'Any Time'}`}></sutram-label>
                    <sutram-label .text=${`Started: ${safeDate}`}></sutram-label>
                </sutram-stack>
            </sutram-surface>
            <sutram-stack id="rs-job-actions-row" direction="row" justify="end" gap="sm" ?wrap=${true}>
                ${job.status === 'running' ? html`<sutram-btn ?compact=${true} intent="warning" icon="pause" label="Pause" @click=${() => this.handleJobAction(job.id, 'pause')}></sutram-btn>` : ''}
                ${job.status === 'paused' ? html`<sutram-btn ?compact=${true} intent="success" icon="play" label="Resume" @click=${() => this.handleJobAction(job.id, 'resume')}></sutram-btn>` : ''}
                ${job.status === 'failed' ? html`<sutram-btn ?compact=${true} intent="highlight" icon="refresh-cw" label="Retry" @click=${() => this.handleJobAction(job.id, 'retry')}></sutram-btn>` : ''}
                ${['running', 'paused', 'gathering', 'failed'].includes(job.status) ? html`<sutram-btn ?compact=${true} intent="neutral" icon="square" label="Cancel" @click=${() => this.handleJobAction(job.id, 'cancel')}></sutram-btn>` : ''}
                <sutram-btn ?compact=${true} variant="tinted" intent="danger" icon="trash-2" label="Delete" @click=${() => this.handleJobAction(job.id, 'delete')}></sutram-btn>
                <sutram-btn ?compact=${true} intent="highlight" icon="${this.aiTriageMode ? 'arrow-left' : 'bot'}" .label=${this.aiTriageMode ? 'Back to Manual Triage' : 'AI-Assisted Batch Triage'} @click=${() => ResearchStore.setState({ aiTriageMode: !this.aiTriageMode })}></sutram-btn>
            </sutram-stack>

            ${this.aiTriageMode ? html`
                <sutram-surface variant="panel" padding="lg" gap="md">
                    <h3>Batch Triage Pipeline</h3>
                    <h4>Step 1: Download Context</h4>
                    <sutram-label text="Downloads all fully-scraped pending URLs in this job as chunked text files."></sutram-label>
                    <sutram-async-btn icon="package" label="Pack Context Files" intent="primary" .onClick=${this._getGenerateContextAction(job.id)}></sutram-async-btn>

                    <h4>Step 2: Prompt Template</h4>
                    <sutram-textarea readonly ?flush=${true} .value=${'Review these scraped documents. I am researching [INSERT TOPIC]. Filter out any documents that are SEO spam, irrelevant, or low quality. Output your response as a raw JSON object containing three arrays of `id` strings: `accept` (highly relevant), `reject` (spam/irrelevant), and `rescan` (relevant but poorly formatted or truncated). Do not include markdown blocks. Example: {"accept": ["id-1"], "reject": ["id-2"], "rescan": ["id-3"]}'}></sutram-textarea>
                    <h4>Step 3: Ingest AI Triage</h4>
                    <sutram-label text="Paste the raw JSON object from the LLM here to process the batch."></sutram-label>
                    <sutram-textarea id="rs-ai-json-input" ?flush=${true} .value=${this._aiJsonInput} @sutram-input-changed=${e => this._aiJsonInput = e.detail.value} placeholder='{"accept": [], "reject": [], "rescan": []}'></sutram-textarea>
                    <sutram-async-btn ?fullWidth=${true} icon="bot" label="Execute Triage" intent="highlight" .onClick=${this.executeAITriage.bind(this)}></sutram-async-btn>
                </sutram-surface>
            ` : html`
                <sutram-surface variant="panel" padding="sm">
                    <sutram-stack direction="col" gap="sm">
                        ${activeInbox.length === 0 ? html`<sutram-empty-state text="No pending items for this job."></sutram-empty-state>` : activeInbox.map(item => {
                            const statusBadge = item.scraped_at ? '✅ ' : '⏳ ';
                            const isSelected = this.selectedItemId === item.id;
                            return html`
                                <sutram-card
                                    .filename=${item.id}
                                    .titleText=${`${statusBadge}${item.title || 'Untitled'}`}
                                    .descriptionText=${item.url}
                                    .detailText=${`ID: ${item.id}`}
                                    icon="file-text"
                                    ?selected=${isSelected}
                                    intent="primary"
                                    @card-clicked=${() => ResearchStore.getState().openItemPreview(item.id)}>
                                    ${item.status === 'duplicate' ? html`<sutram-stack direction="row" align="center" gap="sm"><sutram-tag text="⚠️ Already Scraped" intent="warning"></sutram-tag><sutram-btn ?compact=${true} intent="warning" label="Force Scrape Anyway" @click=${(e) => { e.stopPropagation(); this.handleDisposition(item.id, 'force_scrape'); }}></sutram-btn></sutram-stack>` : ''}
                                    ${item.status === 'in_library' ? html`<sutram-stack direction="row" align="center" gap="sm"><sutram-tag text="📚 In Library" intent="highlight"></sutram-tag><sutram-btn ?compact=${true} intent="highlight" label="Force Scrape Anyway" @click=${(e) => { e.stopPropagation(); this.handleDisposition(item.id, 'force_scrape'); }}></sutram-btn></sutram-stack>` : ''}
                                </sutram-card>
                            `;
                        })}
                    </sutram-stack>
                </sutram-surface>
            `}
        `;
    }
    render() {
        return html`
            <sutram-view>
                ${!this.selectedJobId ? html`
                    <sutram-stack direction="col" gap="md">
                        <sutram-surface variant="ghost" border="bottom" padding="sm">
                            <sutram-stack direction="row" justify="between" align="center">
                                <h4>Active & Past Jobs</h4>
                                <sutram-btn ?compact=${true} intent="success" icon="plus" label="New Job" @click=${() => ResearchStore.setState({ newJobModalOpen: true })}></sutram-btn>
                            </sutram-stack>
                        </sutram-surface>
                        <sutram-stack direction="col" gap="sm">
                            ${(this.jobs || []).map(job => this._renderJobCard(job))}
                        </sutram-stack>
                    </sutram-stack>
                ` : html`
                    <sutram-stack direction="col" gap="md">
                        ${this._renderJobDetailView()}
                    </sutram-stack>
                `}
            </sutram-view>
            ${this.newJobModalOpen ? (() => {
                const missingPkgs = this.getMissingDependencies('research').packages;
                const needsPlaywright = (this.searchForm.provider === 'google') && missingPkgs.includes('playwright');
                const needsBs4 = (this.searchForm.provider === 'duckduckgo' || this.searchForm.parser === 'bs4') && missingPkgs.includes('beautifulsoup4');
                return html`
            <sutram-modal ?open=${true} ?fullscreen=${true} titleText="New Research Job" @sutram-modal-closed=${() => ResearchStore.setState({ newJobModalOpen: false })}>
                <sutram-stack slot="body" direction="col" gap="md">
                    ${bindStoreInput(ResearchStore, 'searchForm.query', this.searchForm.query, { placeholder: 'Search Query...', flush: true })}
                    <sutram-stack direction="grid" ?compact=${true}>
                        ${bindStoreInput(ResearchStore, 'searchForm.provider', this.searchForm.provider || 'serper', { type: 'select', flush: true, selectOptions: [{value: 'serper', label: 'Google (Serper.dev API)'}, {value: 'google', label: missingPkgs.includes('playwright') ? 'Google (Playwright — ⚠️ Missing playwright)' : 'Google (Playwright)'}, {value: 'duckduckgo', label: missingPkgs.includes('beautifulsoup4') ? 'DuckDuckGo (⚠️ Missing beautifulsoup4)' : 'DuckDuckGo'}] })}
                        ${bindStoreInput(ResearchStore, 'searchForm.dateRange', this.searchForm.dateRange || '', { type: 'select', flush: true, selectOptions: [{value: '', label: 'Any Time'}, {value: 'd', label: 'Past Day'}, {value: 'w', label: 'Past Week'}, {value: 'm', label: 'Past Month'}, {value: 'y', label: 'Past Year'}, {value: 'custom', label: 'Custom Range (Exact)...'}, {value: 'custom_year', label: 'Custom Range (Years)...'}] })}
                    </sutram-stack>
                    ${(needsPlaywright || needsBs4) ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <span>Selected provider/parser requires <strong>${missingPkgs.join(', ')}</strong>.</span>
                                <sutram-async-btn
                                    ?compact=${true}
                                    intent="primary"
                                    icon="download"
                                    label="Install Missing Packages"
                                    .onClick=${this.installExtensionDependencies('research')}>
                                </sutram-async-btn>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                    ${this.searchForm.dateRange === 'custom' ? html`
                        <sutram-stack direction="grid" ?compact=${true}>
                            ${bindStoreInput(ResearchStore, 'searchForm.dateStart', this.searchForm.dateStart, { type: 'date', flush: true })}
                            ${bindStoreInput(ResearchStore, 'searchForm.dateEnd', this.searchForm.dateEnd, { type: 'date', flush: true })}
                        </sutram-stack>
                    ` : ''}
                    ${this.searchForm.dateRange === 'custom_year' ? html`
                        <sutram-stack direction="grid" ?compact=${true}>
                            ${bindStoreInput(ResearchStore, 'searchForm.yearStart', this.searchForm.yearStart, { type: 'number', placeholder: 'YYYY (e.g. 1999)', min: 1990, max: 2100, flush: true })}
                            ${bindStoreInput(ResearchStore, 'searchForm.yearEnd', this.searchForm.yearEnd, { type: 'number', placeholder: 'YYYY (e.g. 2005)', min: 1990, max: 2100, flush: true })}
                        </sutram-stack>
                    ` : ''}
                    <sutram-stack direction="grid" ?compact=${true}>
                        ${bindStoreInput(ResearchStore, 'searchForm.parser', this.searchForm.parser || 'bs4', { label: 'Extraction Parser', type: 'select', flush: true, selectOptions: [{value: 'bs4', label: 'Local (BeautifulSoup)'}, {value: 'jina', label: 'Jina AI (sends each URL to r.jina.ai)'}] })}
                        <sutram-stack direction="row" align="end" gap="xs">
                            ${bindStoreInput(ResearchStore, 'targetDir', this.targetDir || 'research/', { label: 'Default Output Folder', placeholder: 'e.g. research/', flush: true, grow: true })}
                            <sutram-btn ?compact=${true} intent="highlight" label="..." @click=${() => { if(this.ui && this.ui.openFolderBrowser) this.ui.openFolderBrowser((p) => { ResearchStore.setState({ targetDir: p ? p + '/' : '' }); }); }}></sutram-btn>
                        </sutram-stack>
                    </sutram-stack>
                    <sutram-stack direction="row" align="end" gap="sm">
                        ${bindStoreInput(ResearchStore, 'searchForm.maxResults', this.searchForm.maxResults || '50', { label: 'Max Results', type: 'select', flush: true, grow: true, selectOptions: [{value: '10', label: '10 Results'}, {value: '25', label: '25 Results'}, {value: '50', label: '50 Results'}, {value: '100', label: '100 Results'}, {value: '9999', label: 'All (Keep Scraping)'}, {value: 'custom', label: 'Custom...'}] })}
                        ${this.searchForm.maxResults === 'custom' ? bindStoreInput(ResearchStore, 'searchForm.maxCustom', this.searchForm.maxCustom, { type: 'number', placeholder: 'e.g. 150', min: 1, max: 1000, flush: true, grow: true }) : ''}
                    </sutram-stack>
                </sutram-stack>
                <sutram-async-btn slot="footer" icon="rocket" label="Start Scraping" loadingLabel="Starting..." intent="highlight" .onClick=${this.startJob.bind(this)}></sutram-async-btn>
            </sutram-modal>
            `;
            })() : ''}
        `;
    }
}
customElements.define('insetu-ext-research', InSetuExtResearch);

export class InSetuResearchPreviewProjection extends InSetuElement {
    static get extensionName() { return 'research'; }
    static properties = {
        inbox: { type: Array },
        selectedItemId: { type: String },
        targetDir: { type: String }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        const st = ResearchStore.getState();
        this.inbox = st.inbox || [];
        this.selectedItemId = st.selectedItemId || null;
        this.targetDir = st.targetDir || 'research/';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            ResearchStore,
            state => ({
                inbox: state.inbox || [],
                selectedItemId: state.selectedItemId,
                targetDir: state.targetDir || 'research/'
            }),
            (slice) => {
                this.inbox = slice.inbox;
                this.selectedItemId = slice.selectedItemId;
                this.targetDir = slice.targetDir;
            }
        );
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
            const rawFp = targetDir + slug + '.md';
            const filepath = this.vfs?.normalizeVfsURI ? this.vfs.normalizeVfsURI(rawFp) : rawFp;

            const success = await this.sys.executeWorkspaceMutation('fs/save', { filepath, content: item.raw_markdown }, { silent: true });
            if (!success) return alert("Failed to write Markdown to disk.");
        }
        try {
            await this.api.post(`research/inbox/${inboxId}/disposition`, { status });
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('research:preview');
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
    render() {
        const activeItem = this.inbox.find(i => i.id === this.selectedItemId);
        if (!activeItem) return html``;
        return html`
            <sutram-view>
                <sutram-surface slot="header" variant="panel" border="bottom" padding="md" gap="sm">
                    <sutram-stack direction="col" gap="xs">
                        <h4>${activeItem.title || 'Untitled'}</h4>
                        <sutram-stack direction="row" align="center" gap="xs">
                            <sutram-icon name="link" size="sm" intent="primary"></sutram-icon>
                            <a href="${activeItem.url}" target="_blank" style="color: var(--intent-primary); word-break: break-all;">${activeItem.url}</a>
                        </sutram-stack>
                        <code>Item ID: ${activeItem.id}</code>
                    </sutram-stack>
                    <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                        <sutram-stack direction="row" align="center" gap="xs" ?flex=${true}>
                            <sutram-input ?flush=${true} ?grow=${true} .value=${this.targetDir || 'research/'} placeholder="Target path (e.g. research/)" @sutram-input-changed=${(e) => ResearchStore.setState({ targetDir: e.detail.value })}></sutram-input>
                            <sutram-btn ?compact=${true} intent="highlight" label="..." @click=${() => { if(this.ui && this.ui.openFolderBrowser) this.ui.openFolderBrowser((p) => { ResearchStore.setState({ targetDir: p ? p + '/' : '' }); }); }}></sutram-btn>
                        </sutram-stack>
                        <sutram-btn ?compact=${true} intent="success" icon="check" label="Accept to Workspace" @click=${() => this.handleDisposition(activeItem.id, 'accepted')}></sutram-btn>
                        <sutram-btn ?compact=${true} intent="danger" icon="trash-2" label="Reject" @click=${() => this.handleDisposition(activeItem.id, 'rejected')}></sutram-btn>
                        <sutram-btn ?compact=${true} intent="warning" icon="refresh-cw" label="Re-Scrape" @click=${() => this.handleDisposition(activeItem.id, 'force_scrape')}></sutram-btn>
                    </sutram-stack>
                </sutram-surface>
                <pre tabindex="0" .textContent=${activeItem.raw_markdown || 'Awaiting extraction...'}></pre>
            </sutram-view>
        `;
    }
}
customElements.define('insetu-research-preview-projection', InSetuResearchPreviewProjection);
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
            emitEvent: (data) => ({ name: 'insetu:research:action', detail: { id: data.id, action: 'pause' } })
        },
        {
            targetEntity: 'research_job',
            id: 'rs-resume',
            label: 'Resume',
            icon: '▶️',
            intent: 'success',
            order: 10,
            match: (data) => data.status === 'paused',
            emitEvent: (data) => ({ name: 'insetu:research:action', detail: { id: data.id, action: 'resume' } })
        },
        {
            targetEntity: 'research_job',
            id: 'rs-retry',
            label: 'Retry',
            icon: '🔄',
            intent: 'highlight',
            order: 10,
            match: (data) => data.status === 'failed',
            emitEvent: (data) => ({ name: 'insetu:research:action', detail: { id: data.id, action: 'retry' } })
        },
        {
            targetEntity: 'research_job',
            id: 'rs-cancel',
            label: 'Cancel',
            icon: '⏹️',
            intent: 'neutral',
            order: 20,
            match: (data) => ['running', 'paused', 'gathering', 'failed'].includes(data.status),
            emitEvent: (data) => ({ name: 'insetu:research:action', detail: { id: data.id, action: 'cancel' } })
        },
        {
            targetEntity: 'research_job',
            id: 'rs-delete',
            label: 'Delete',
            icon: '🗑️',
            intent: 'danger',
            order: 30,
            emitEvent: (data) => ({ name: 'insetu:research:action', detail: { id: data.id, action: 'delete' } })
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "research",
            label: "Research",
            icon: "search",
            intent: "highlight",
            order: 4,
            menuActions: [
                {
                    label: "New Research Job",
                    icon: "plus",
                    onClick: () => ResearchStore.setState({ newJobModalOpen: true })
                }
            ],
            component: "insetu-ext-research"
        }
    ]
});
