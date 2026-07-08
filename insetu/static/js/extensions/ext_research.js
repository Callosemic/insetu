import { executeWorkspaceMutation } from '../app.js';
import { downloadFile } from '../fs.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
import { LitElement, html, css } from 'https://esm.sh/lit';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

// --- UDF STATE STORE ---
export const ResearchStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            jobs: [],
            inbox: [],
            selectedJobId: null,
            selectedItemId: null,
            targetDir: 'research/',
            aiTriageMode: false,
            isTabActive: false,
            searchForm: { query: '', provider: 'serper', parser: 'jina', dateRange: '', dateStart: '', dateEnd: '', yearStart: '', yearEnd: '', maxResults: '50', maxCustom: '' },
            setSearchForm: (field, val) => set(state => ({ searchForm: { ...state.searchForm, [field]: val } })),
            resetState: () => set({ jobs: [], inbox: [], selectedJobId: null, selectedItemId: null, aiTriageMode: false })
        })),
        { name: 'ResearchStore' }
    )
);

window.inSetu.stores.Research = ResearchStore;
export class InSetuExtResearch extends LitElement {
    static properties = {
        jobs: { type: Array },
        inbox: { type: Array },
        selectedJobId: { type: String },
        selectedItemId: { type: String },
        targetDir: { type: String },
        aiTriageMode: { type: Boolean },
        searchForm: { type: Object }
    };
    static styles = [        css`
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
        this.searchForm = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this._unsub = ResearchStore.subscribe(state => {
            this.jobs = state.jobs;
            this.inbox = state.inbox;
            this.selectedJobId = state.selectedJobId;
            this.selectedItemId = state.selectedItemId;
            this.targetDir = state.targetDir;
            this.aiTriageMode = state.aiTriageMode;
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
        this.searchForm = state.searchForm;

        this.fetchState();

        // Dynamically inject the global back button into the external tab bar
        setTimeout(() => {
            const actionContainer = document.querySelector('#tab-edit .sub-tabs-bar > div:last-child');
            if (actionContainer && !document.getElementById('rs-global-back-btn')) {
                const backBtn = document.createElement('button');
                backBtn.id = 'rs-global-back-btn';
                backBtn.className = 'btn-sm';
                backBtn.style.cssText = 'background: var(--intent-neutral); margin: 0; padding: 4px 12px; display: none;';
                backBtn.innerText = '🔙 Back to Jobs';
                backBtn.onclick = () => ResearchStore.setState({ selectedJobId: null, selectedItemId: null });
                actionContainer.prepend(backBtn);
            }
        }, 100);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._unsub) this._unsub();
        const globalBackBtn = document.getElementById('rs-global-back-btn');
        if (globalBackBtn) globalBackBtn.remove();
    }

    updated(changedProperties) {
        if (changedProperties.has('selectedJobId') || changedProperties.has('isTabActive')) {
            const globalBackBtn = document.getElementById('rs-global-back-btn');
            const isTabActive = ResearchStore.getState().isTabActive;
            if (globalBackBtn) {
                globalBackBtn.style.display = (this.selectedJobId && isTabActive) ? 'block' : 'none';
            }
        }
    }

    async fetchState() {
        try {
            const [jRes, iRes] = await Promise.all([
                fetch('/api/research/jobs'),
                fetch('/api/research/inbox?status=pending,duplicate,in_library')
            ]);
            if (jRes.ok && iRes.ok) {
                const jData = await jRes.json();
                const iData = await iRes.json();
                ResearchStore.setState({ jobs: jData.jobs, inbox: iData.items });
            }
        } catch (e) {
            console.error("Failed to fetch research state:", e);
        }
    }

    async startJob(e) {
        const btn = e.target;
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

        if (dateRange === null) return alert("Valid date configuration required for custom ranges.");
        if (!query) return alert("Query required.");

        btn.innerText = "⏳ Starting...";
        try {
            const maxResults = formMax === 'custom' ? (parseInt(maxCustom, 10) || 50) : parseInt(formMax, 10);
            const res = await fetch('/api/research/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, provider, parser: parser, target_dir: targetDir, max_results: maxResults, date_range: dateRange })
            });

            if (res.ok) {
                ResearchStore.setState(s => ({ searchForm: { ...s.searchForm, query: '' } }));
                await this.fetchState();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to start job.");
            }
        } finally {
            btn.innerText = "🚀 Start Scraping";
        }
    }

    async handleJobAction(jobId, action) {
        if (action === 'delete' && !confirm("Are you sure you want to permanently delete this research job and all its scraped items? This cannot be undone.")) return;

        await fetch(`/api/research/${jobId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        if (action === 'delete') {
            ResearchStore.setState({ selectedJobId: null, selectedItemId: null, aiTriageMode: false });
        }
        await this.fetchState();
    }

    async handleDisposition(inboxId, status) {
        const item = this.inbox.find(i => i.id === inboxId);
        if (!item) return;
        if (status === 'accepted') {
            const targetDir = (this.targetDir || 'research/').replace(/\/+$/, '') + '/';
            const slug = (() => {
                const generated = window.generateSafeSlug(item.title);
                return (generated || 'research-note').replace(/^-+|-+$/g, '').substring(0, 60);
            })();
            const filepath = targetDir + slug + '.md';

            const contentToSave = await (async () => {
                if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes('citations') && window.addFileToLibrary) {
                    return await window.addFileToLibrary(slug + '.md', item.raw_markdown, filepath);
                }
                return item.raw_markdown;
            })();

            const success = await executeWorkspaceMutation('/api/fs/save', { filepath, content: contentToSave }, { silent: true });
            if (!success) return alert("Failed to write Markdown to disk.");
        }

        await fetch(`/api/research/inbox/${inboxId}/disposition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

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
    }

    async generateContext(jobId, e) {
        const btn = e.target;
        btn.innerText = "⏳ Packing...";
        try {
            const res = await fetch(`/api/research/${jobId}/export_context`);
            if (!res.ok) throw new Error("Failed to export context");
            const data = await res.json();
            const chunks = data.chunks || [];

            if (chunks.length === 0) return alert("No fully scraped pending links available to pack.");

            chunks.forEach((chunk, i) => {
                const filename = `context_${jobId.substring(0, 8)}_part_${i+1}.txt`;
                const blob = new Blob([chunk], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                downloadFile(url, filename);
            });
        } catch(err) {
            alert("Failed to generate context files.");
        } finally {
            btn.innerText = "📦 Pack Context Files";
        }
    }

    async executeAITriage(e) {
        const inputEl = this.shadowRoot.getElementById('rs-ai-json-input');
        const input = (inputEl.value || '').trim();
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

        const btn = e.target;
        btn.innerText = "⏳ Processing (Please wait)...";
        try {
            for (const id of acceptIds) if (id) await this.handleDisposition(id, 'accepted');
            for (const id of rejectIds) if (id) await this.handleDisposition(id, 'rejected');
            for (const id of rescanIds) if (id) await this.handleDisposition(id, 'force_scrape');

            inputEl.value = '';
            await this.fetchState();
            alert(`✅ Triage complete:\n- ${acceptIds.length} Accepted to Workspace\n- ${rejectIds.length} Rejected\n- ${rescanIds.length} Queued for Rescan`);
            ResearchStore.setState({ aiTriageMode: false, selectedItemId: null });
        } catch(err) {
            alert("An error occurred executing the batch triage.");
        } finally {
            btn.innerText = "🤖 Execute Triage";
        }
    }

    _renderJobCard(job) {
        const meta = (() => { try { return JSON.parse(job.meta_json || '{}'); } catch(e) { return {}; } })();
        const statusColor = (() => {
            if (job.status === 'running') return 'var(--intent-primary)';
            if (job.status === 'gathering') return 'var(--intent-highlight)';
            if (job.status === 'completed') return 'var(--intent-primary)';
            if (job.status === 'reviewed') return 'var(--intent-success)';
            if (job.status === 'failed') return 'var(--intent-danger)';
            return 'var(--text-muted)';
        })();

        const safeDate = job.created_at ? new Date(job.created_at).toLocaleString() : 'Unknown Date';
        const cardStatusExtra = job.status === 'gathering' 
            ? `(Page ${Math.floor((meta.start_index || 0) / 10) + 1} - ${job.total_links} found)`
            : `(${job.processed_links}/${job.total_links} scraped)`;

        return html`
            <div class="file-card" style="padding: 10px; cursor: pointer;"
                @click=${(e) => { if (e.target.tagName !== 'BUTTON') ResearchStore.setState({ selectedJobId: job.id, selectedItemId: null }); }}>
                <div style="font-weight: bold; color: var(--text); font-size: 0.95rem; word-break: break-word;">
                    🔍 ${job.query} <span style="font-weight: normal; font-size: 0.8rem; color: var(--text-muted);">(${meta.date_range || 'Any Time'})</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Created: ${safeDate}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                    <span style="font-size: 0.8rem; color: ${statusColor};">Status: ${job.status.toUpperCase()} ${cardStatusExtra}</span>
                    <div style="display: flex; gap: 5px;">
                        ${job.status === 'gathering' ? html`<button class="btn-sm" style="background: var(--intent-danger); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'cancel')}>🗑️ Cancel</button>` : ''}
                        ${job.status === 'running' ? html`
                            <button class="btn-sm" style="background: var(--intent-warning); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'pause')}>⏸️ Pause</button>
                            <button class="btn-sm" style="background: var(--intent-danger); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'cancel')}>🗑️ Cancel</button>
                        ` : ''}
                        ${job.status === 'paused' ? html`
                            <button class="btn-sm" style="background: var(--intent-success); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'resume')}>▶️ Resume</button>
                            <button class="btn-sm" style="background: var(--intent-danger); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'cancel')}>🗑️ Cancel</button>
                        ` : ''}
                        ${job.status === 'failed' ? html`
                            <button class="btn-sm" style="background: var(--intent-highlight); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'retry')}>🔄 Retry</button>
                            <button class="btn-sm" style="background: var(--intent-danger); margin:0; padding: 2px 8px;" @click=${() => this.handleJobAction(job.id, 'cancel')}>🗑️ Cancel</button>
                        ` : ''}
                    </div>
                </div>
                ${(job.status === 'failed' && meta.error) ? html`<div style="font-size: 0.8rem; color: var(--intent-danger); background: var(--input-bg); padding: 6px 10px; border-radius: 4px; margin-top: 8px; border: 1px solid var(--intent-danger);">⚠️ <b>Error:</b> ${meta.error}</div>` : ''}
            </div>
        `;
    }

    _renderJobDetailView() {
        const job = this.jobs.find(j => j.id === this.selectedJobId);
        if (!job) return '';

        const meta = (() => { try { return JSON.parse(job.meta_json || '{}'); } catch(e) { return {}; } })();
        const statusColor = (() => {
            if (job.status === 'running') return 'var(--intent-primary)';
            if (job.status === 'gathering') return 'var(--intent-highlight)';
            if (job.status === 'completed') return 'var(--intent-primary)';
            if (job.status === 'reviewed') return 'var(--intent-success)';
            if (job.status === 'failed') return 'var(--intent-danger)';
            return 'var(--text-muted)';
        })();
        const safeDate = job.created_at ? new Date(job.created_at).toLocaleString() : 'Unknown Date';
        const cardStatusExtra = job.status === 'gathering' 
            ? `(Page ${Math.floor((meta.start_index || 0) / 10) + 1} - ${job.total_links} found)`
            : `(${job.processed_links}/${job.total_links} scraped)`;

        const activeInbox = this.inbox.filter(i => i.job_id === this.selectedJobId);

        return html`
            <div id="rs-detail-header" style="margin-bottom: 15px; padding: 15px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                    <div style="font-weight: bold; color: var(--intent-primary); font-size: 1.15rem; word-break: break-word;">🔍 ${job.query}</div>
                    <button class="btn-sm" style="background: transparent; border: 1px solid var(--border); color: var(--text); padding: 2px 8px; margin: 0; font-size: 0.8rem; white-space: nowrap; flex-shrink: 0;"
                        @click=${(e) => { navigator.clipboard.writeText(job.query); e.target.innerText='✅ Copied!'; setTimeout(()=>e.target.innerText='📋 Copy', 2000); }}>📋 Copy</button>
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
                    <button class="btn-sm" style="background: var(--intent-primary); width: fit-content; margin: 0 0 25px 0;" @click=${(e) => this.generateContext(job.id, e)}>📦 Pack Context Files</button>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 2: Prompt Template</h4>
                    <textarea readonly style="width: 100%; min-height: 160px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 25px; resize: vertical;" onclick="this.select()">Review these scraped documents. I am researching [INSERT TOPIC]. Filter out any documents that are SEO spam, irrelevant, or low quality. Output your response as a raw JSON object containing three arrays of \`id\` strings: \`accept\` (highly relevant), \`reject\` (spam/irrelevant), and \`rescan\` (relevant but poorly formatted or truncated). Do not include markdown blocks. Example: {"accept": ["id-1"], "reject": ["id-2"], "rescan": ["id-3"]}</textarea>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 3: Ingest AI Triage</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste the raw JSON object from the LLM here to process the batch.</p>
                    <textarea id="rs-ai-json-input" placeholder='{"accept": [], "reject": [], "rescan": []}' style="width: 100%; min-height: 120px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 10px; resize: vertical;"></textarea>
                    <button class="btn-sm" style="background: var(--intent-highlight); width: 100%; margin: 0; padding: 10px; font-weight: bold;" @click=${this.executeAITriage}>🤖 Execute Triage</button>
                </div>
            ` : html`
                <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 200px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg);">
                        <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding: 10px; flex: 1;">
                            ${activeInbox.length === 0 ? html`<span style="color: var(--text-muted); font-style: italic;">No pending items for this job.</span>` : activeInbox.map(item => {
                                const scrapedBadge = item.scraped_at ? html`<span title="Extraction Complete" style="font-size: 0.8rem;">✅</span>` : html`<span title="Waiting for extraction..." style="font-size: 0.8rem; opacity: 0.5;">⏳</span>`;
                                return html`
                                    <div class="file-card" style="cursor: pointer; padding: 10px; ${this.selectedItemId === item.id ? 'border: 2px solid var(--intent-highlight);' : ''}" @click=${() => ResearchStore.setState({ selectedItemId: item.id })}>
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 5px;">
                                            <div style="font-weight: bold; color: var(--text); font-size: 0.9rem; word-wrap: break-word;">${item.title || 'Untitled'}</div>
                                            <div style="flex-shrink: 0;">${scrapedBadge}</div>
                                        </div>
                                        <div style="font-size: 0.75rem; color: var(--intent-primary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.url}</div>
                                        <div style="color: var(--text-muted); font-family: monospace; font-size: 0.7rem; margin-top: 4px; user-select: all;">ID: ${item.id}</div>
                                        ${item.status === 'duplicate' ? html`<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;"><span style="font-size: 0.75rem; color: var(--intent-warning); font-weight: bold;">⚠️ Already Scraped</span><button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-warning); color: var(--intent-warning); padding: 2px 8px; margin: 0; font-size: 0.7rem;" @click=${(e) => { e.stopPropagation(); this.handleDisposition(item.id, 'force_scrape'); }}>Force Scrape Anyway</button></div>` : ''}
                                        ${item.status === 'in_library' ? html`<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;"><span style="font-size: 0.75rem; color: var(--intent-highlight); font-weight: bold;">📚 In Library</span><button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-highlight); color: var(--intent-highlight); padding: 2px 8px; margin: 0; font-size: 0.7rem;" @click=${(e) => { e.stopPropagation(); this.handleDisposition(item.id, 'force_scrape'); }}>Force Scrape Anyway</button></div>` : ''}
                                    </div>
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
                        <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 20px;">
                            <h3 style="margin-top: 0; color: var(--intent-primary);">New Research Job</h3>
                            <input type="text" placeholder="Search Query..." style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box;" .value=${this.searchForm.query || ''} @input=${(e) => ResearchStore.getState().setSearchForm('query', e.target.value)}>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <select style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this.searchForm.provider || 'serper'} @change=${(e) => ResearchStore.getState().setSearchForm('provider', e.target.value)}>
                                    <option value="serper">Google (Serper.dev API)</option>
                                    <option value="google">Google (Playwright)</option>
                                    <option value="duckduckgo">DuckDuckGo</option>
                                </select>
                                <select style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this.searchForm.dateRange || ''} @change=${(e) => ResearchStore.getState().setSearchForm('dateRange', e.target.value)}>
                                    <option value="">Any Time</option>
                                    <option value="d">Past Day</option>
                                    <option value="w">Past Week</option>
                                    <option value="m">Past Month</option>
                                    <option value="y">Past Year</option>
                                    <option value="custom">Custom Range (Exact)...</option>
                                    <option value="custom_year">Custom Range (Years)...</option>
                                </select>
                            </div>
                            <div style="display: ${this.searchForm.dateRange === 'custom' ? 'flex' : 'none'}; gap: 10px; margin-bottom: 10px;">
                                <input type="date" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this.searchForm.dateStart || ''} @input=${(e) => ResearchStore.getState().setSearchForm('dateStart', e.target.value)}>
                                <input type="date" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this.searchForm.dateEnd || ''} @input=${(e) => ResearchStore.getState().setSearchForm('dateEnd', e.target.value)}>
                            </div>
                            <div style="display: ${this.searchForm.dateRange === 'custom_year' ? 'flex' : 'none'}; gap: 10px; margin-bottom: 10px;">
                                <input type="number" placeholder="YYYY (e.g. 1999)" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" min="1990" max="2100" .value=${this.searchForm.yearStart || ''} @input=${(e) => ResearchStore.getState().setSearchForm('yearStart', e.target.value)}>
                                <input type="number" placeholder="YYYY (e.g. 2005)" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" min="1990" max="2100" .value=${this.searchForm.yearEnd || ''} @input=${(e) => ResearchStore.getState().setSearchForm('yearEnd', e.target.value)}>
                            </div>
                            <div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-end;">
                                <div style="flex: 1;">
                                    <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Extraction Parser</label>
                                    <select style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this.searchForm.parser || 'jina'} @change=${(e) => ResearchStore.getState().setSearchForm('parser', e.target.value)}>
                                        <option value="jina">Jina AI (Rich Markdown)</option>
                                        <option value="bs4">Local (BeautifulSoup)</option>
                                    </select>
                                </div>
                                <div style="flex: 1;">
                                    <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Default Output Folder</label>
                                    <div style="display: flex; gap: 8px;">
                                        <input type="text" placeholder="e.g. research/" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace;" .value=${this.targetDir || 'research/'} @input=${(e) => ResearchStore.setState({ targetDir: e.target.value })}>
                                        <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 12px;" @click=${() => { if(window.openFolderBrowser) window.openFolderBrowser((p) => { ResearchStore.setState({ targetDir: p ? p + '/' : '' }); }); }}>...</button>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Max Results</label>
                                <div style="display: flex; gap: 8px;">
                                    <select style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" .value=${this.searchForm.maxResults || '50'} @change=${(e) => ResearchStore.getState().setSearchForm('maxResults', e.target.value)}>
                                        <option value="10">10 Results</option>
                                        <option value="25">25 Results</option>
                                        <option value="50">50 Results</option>
                                        <option value="100">100 Results</option>
                                        <option value="9999">All (Keep Scraping)</option>
                                        <option value="custom">Custom...</option>
                                    </select>
                                    <input type="number" placeholder="e.g. 150" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; display: ${this.searchForm.maxResults === 'custom' ? 'block' : 'none'};" min="1" max="1000" .value=${this.searchForm.maxCustom || ''} @input=${(e) => ResearchStore.getState().setSearchForm('maxCustom', e.target.value)}>
                                </div>
                            </div>
                            <button class="btn-sm" style="background: var(--intent-highlight); width: 100%; margin: 0; padding: 10px; font-weight: bold;" @click=${this.startJob}>🚀 Start Scraping</button>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: var(--text);">Active & Past Jobs</h4>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${this.jobs.map(job => this._renderJobCard(job))}
                        </div>
                    </div>
                ` : html`
                    <div class="rs-view active">
                        ${this._renderJobDetailView()}
                    </div>
                `}
            </div>

            <insetu-modal ?open=${!!activeItem} titleText="Research Item Preview" maxWidth="95vw" @modal-closed=${() => ResearchStore.setState({ selectedItemId: null })}>
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
                                    <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px;" @click=${() => { if(window.openFolderBrowser) window.openFolderBrowser((p) => { ResearchStore.setState({ targetDir: p ? p + '/' : '' }); }); }}>...</button>
                                </div>
                                <button class="btn-sm" style="background: var(--intent-success); margin: 0;" @click=${() => this.handleDisposition(activeItem.id, 'accepted')}>✅ Accept to Workspace</button>
                                <button class="btn-sm" style="background: var(--intent-danger); margin: 0;" @click=${() => this.handleDisposition(activeItem.id, 'rejected')}>🗑️ Reject</button>
                                <button class="btn-sm" style="background: var(--intent-warning); margin: 0;" @click=${() => this.handleDisposition(activeItem.id, 'force_scrape')}>🔄 Re-Scrape</button>
                            </div>
                        </div>
                        <div tabindex="0" style="flex: 1; overflow-y: auto; padding: 20px; font-size: 0.95rem; outline: none;" .innerHTML=${activeItem.raw_markdown ? marked.parse(activeItem.raw_markdown) : '<span style="color: var(--intent-warning); font-style: italic;">Awaiting extraction...</span>'}></div>
                    ` : ''}
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-research', InSetuExtResearch);

window.ExtensionRegistry.registerExtension('research', {
    name: "Research Inbox",
    version: "2.0.0",
    layoutSlots: [
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
        'zone:tab-changed': (tabId) => {
            if (tabId === 'research') {
                const el = document.querySelector('insetu-ext-research');
                if (el) el.fetchState();
            }
        },
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'edit' && data.subId === 'research') {
                ResearchStore.setState({ isTabActive: true });
                const el = document.querySelector('insetu-ext-research');
                if (el && data.forceRefresh) el.fetchState();
            } else {
                ResearchStore.setState({ isTabActive: false });
            }
        }
    }
});

// Resurrect Metronome Hook via Declarative Registration
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerTick) {
    window.inSetu.extensions.Registry.registerTick('research', 3000, () => {
        if (ResearchStore.getState().jobs.some(j => j.status === 'running' || j.status === 'gathering')) {
            const el = document.querySelector('insetu-ext-research');
            if (el) el.fetchState();
        }
    });
}