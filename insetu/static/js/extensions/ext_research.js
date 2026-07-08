import { executeWorkspaceMutation } from '../app.js';
import { downloadFile } from '../fs.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

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

// --- UI REGISTRATION ---
const researchTab = window.inSetu.extensions.Registry.registerSubTab('edit', 'research', 'Research');
if (researchTab) {
    researchTab.innerHTML = `
        <style>
            .rs-layout {
                display: flex;
                flex-direction: column; height: calc(100dvh - 180px); overflow: hidden;
            }
            .rs-view {
                display: none; flex-direction: column; height: 100%; overflow: hidden;
            }
            .rs-view.active {
                display: flex;
            }
        </style>
        <div class="rs-layout">
            <div id="rs-view-jobs" class="rs-view active" style="overflow-y: auto; padding-right: 5px;">
                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: var(--intent-primary);">New Research Job</h3>
                    <input type="text" id="rs-query" placeholder="Search Query..." style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box;"
oninput="window.inSetu.stores.Research.getState().setSearchForm('query', event.target.value)">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <select id="rs-provider" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
onchange="window.inSetu.stores.Research.getState().setSearchForm('provider', event.target.value)">
                            <option value="serper">Google (Serper.dev API)</option>
                            <option value="google">Google (Playwright)</option>
                            <option value="duckduckgo">DuckDuckGo</option>
                        </select>
<select id="rs-date-range" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
onchange="window.inSetu.stores.Research.getState().setSearchForm('dateRange', event.target.value)">
    <option value="">Any Time</option>
                            <option value="d">Past Day</option>
                            <option value="w">Past Week</option>
                            <option value="m">Past Month</option>
                            <option value="y">Past Year</option>
                            <option value="custom">Custom Range (Exact)...</option>
                            <option value="custom_year">Custom Range (Years)...</option>
                        </select>
                    </div>
                    <div id="rs-custom-dates" style="display: none; gap: 10px; margin-bottom: 10px;">
                        <input type="date" id="rs-date-start" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
oninput="window.inSetu.stores.Research.getState().setSearchForm('dateStart', event.target.value)">
                        <input type="date" id="rs-date-end" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
oninput="window.inSetu.stores.Research.getState().setSearchForm('dateEnd', event.target.value)">
                    </div>
                    <div id="rs-custom-years" style="display: none; gap: 10px; margin-bottom: 10px;">
                        <input type="number" id="rs-year-start" placeholder="YYYY (e.g. 1999)" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
min="1990" max="2100" oninput="window.inSetu.stores.Research.getState().setSearchForm('yearStart', event.target.value)">
                        <input type="number" id="rs-year-end" placeholder="YYYY (e.g. 2005)" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
min="1990" max="2100" oninput="window.inSetu.stores.Research.getState().setSearchForm('yearEnd', event.target.value)">
                    </div>
                    <div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-end;">
                        <div style="flex: 1;">
                            <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Extraction Parser</label>
                            <select id="rs-parser" style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
onchange="window.inSetu.stores.Research.getState().setSearchForm('parser', event.target.value)">
                                <option value="jina">Jina AI (Rich Markdown)</option>
                                <option value="bs4">Local (BeautifulSoup)</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Default Output Folder</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="rs-default-dir" value="research/" placeholder="e.g. research/" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace;">
                                <button id="btn-pick-rs-dir" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 12px;" type="button">...</button>
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Max Results</label>
                        <div style="display: flex; gap: 8px;">
                            <select id="rs-max-results-select" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                                <option value="10">10 Results</option>
                                <option value="25">25 Results</option>
                                <option value="50" selected>50 Results</option>
                                <option value="100">100 Results</option>
                                <option value="9999">All (Keep Scraping)</option>
                                <option value="custom">Custom...</option>
                            </select>
                            <input type="number" id="rs-max-results-custom" placeholder="e.g. 150" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; display: none;" min="1" max="1000">
                        </div>
                    </div>
                    <button id="rs-start-btn" class="btn-sm" style="background: var(--intent-highlight); width: 100%; margin: 0; padding: 10px; font-weight: bold;">🚀 Start Scraping</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: var(--text);">Active & Past Jobs</h4>
                </div>
                <div id="rs-jobs-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>

            <div id="rs-view-detail" class="rs-view">
                <div id="rs-detail-header" style="margin-bottom: 15px; padding: 15px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border);"></div>
                <div id="rs-job-actions-row" style="margin-bottom: 15px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
                    <button id="rs-btn-pause-job" class="btn-sm" style="background: var(--intent-warning); margin: 0; padding: 6px 12px; font-weight: bold; display: none;">⏸️ Pause</button>
                    <button id="rs-btn-resume-job" class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 6px 12px; font-weight: bold; display: none;">▶️ Resume</button>
                    <button id="rs-btn-retry-job" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px; font-weight: bold; display: none;">🔄 Retry</button>
                    <button id="rs-btn-cancel-job" class="btn-sm" style="background: var(--intent-neutral); margin: 0; padding: 6px 12px; font-weight: bold; display: none;">⏹️ Cancel</button>
                    <button id="rs-btn-delete-job" class="btn-sm" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 6px 12px; font-weight: bold;">🗑️ Delete</button>
                    <button id="rs-toggle-ai-triage" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px; font-weight: bold;">🤖 Batch Triage</button>
                </div>
                <div id="rs-manual-triage" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 200px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg);">
                        <div id="rs-inbox-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding: 10px; flex: 1;"></div>
                    </div>
                </div>

                <div id="rs-ai-triage" style="display: none; flex-direction: column; flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 20px; overflow-y: auto;">
                    <h3 style="margin-top: 0; color: var(--intent-highlight); margin-bottom: 15px;">Batch Triage Pipeline</h3>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 1: Download Context</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Downloads all fully-scraped pending URLs in this job as chunked text files.</p>
                    <button id="rs-btn-gen-context" class="btn-sm" style="background: var(--intent-primary); width: fit-content; margin: 0 0 10px 0;">📦 Pack Context Files</button>
                    <div id="rs-context-links" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 25px;"></div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 2: Prompt Template</h4>
                    <textarea readonly style="width: 100%; min-height: 160px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 25px; resize: vertical;" onclick="this.select()">Review these scraped documents. I am researching [INSERT TOPIC]. Filter out any documents that are SEO spam, irrelevant, or low quality. 

Output your response as a raw JSON object containing three arrays of \`id\` strings: \`accept\` (highly relevant), \`reject\` (spam/irrelevant), and \`rescan\` (relevant but poorly formatted or truncated). Do not include markdown blocks. Example: {"accept": ["id-1"], "reject": ["id-2"], "rescan": ["id-3"]}</textarea>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 3: Ingest AI Triage</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste the raw JSON object from the LLM here to process the batch.</p>
                    <textarea id="rs-ai-json-input" placeholder='{"accept": [], "reject": [], "rescan": []}' style="width: 100%; min-height: 120px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 10px; resize: vertical;"></textarea>
                    <button id="rs-btn-exec-ai" class="btn-sm" style="background: var(--intent-highlight); width: 100%; margin: 0; padding: 10px; font-weight: bold;">🤖 Execute Triage</button>
                </div>
            </div>

        </div>
    `;

    // --- ACTIONS ---
    const fetchState = async () => {
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
    };
    const startJob = async () => {
        const { query, provider, parser, dateStart, dateEnd, yearStart, yearEnd, maxResults: formMax, maxCustom, dateRange: rawDateRange } = ResearchStore.getState().searchForm;

      const targetDir = ResearchStore.getState().targetDir || 'research/';
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

        const btn = document.getElementById('rs-start-btn');
        if (btn) btn.innerText = "⏳ Starting...";
        try {
            const maxResults = formMax === 'custom' ? (parseInt(maxCustom, 10) || 50) : parseInt(formMax, 10);
            const res = await fetch('/api/research/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, provider, parser: parser, target_dir: targetDir, max_results: maxResults, date_range: dateRange })
            });
            if (res.ok) {
                const qEl = document.getElementById('rs-query');
                if (qEl) qEl.value = '';
                ResearchStore.setState(s => ({ searchForm: { ...s.searchForm, query: '' } }));
                await fetchState();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to start job.");
            }
        } finally {
            btn.innerText = "🚀 Start Scraping";
        }
    };

    const handleJobAction = async (jobId, action) => {
        await fetch(`/api/research/${jobId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        await fetchState();
    };
    const handleDisposition = async (inboxId, status) => {
        const item = ResearchStore.getState().inbox.find(i => i.id === inboxId);
if (!item) return;
        if (status === 'accepted') {
            const targetDir = (ResearchStore.getState().targetDir || 'research/').replace(/\/+$/, '') + '/';
            const slug = (() => {
                const generated = item.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return (generated || 'research-note').replace(/^-+|-+$/g, '').substring(0, 60);
            })();
            const filepath = targetDir + slug + '.md';
            const contentToSave = await (async () => {
                if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes('citations') && window.addFileToLibrary) {
                    return await window.addFileToLibrary(slug + '.md', item.raw_markdown, filepath);
                }
                return item.raw_markdown;
            })();

            // Physically save to workspace first
            const success = await executeWorkspaceMutation('/api/fs/save', {
                filepath: filepath,
                content: contentToSave
            }, { silent: true });

            if (!success) return alert("Failed to write Markdown to disk.");
        }
        // Update DB status
        await fetch(`/api/research/inbox/${inboxId}/disposition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        // Clear preview if resolving active item
        if (ResearchStore.getState().selectedItemId === inboxId) {
            ResearchStore.setState({ selectedItemId: null });
        }

        // Surgically update UDF State without N+1 backend fetches
        const currentInbox = ResearchStore.getState().inbox;
        if (status === 'force_scrape') {
            const updatedInbox = currentInbox.map(i => i.id === inboxId ? { ...i, status: 'pending', scraped_at: null, raw_markdown: null } : i);
            ResearchStore.setState({ inbox: updatedInbox });
        } else {
            const updatedInbox = currentInbox.filter(i => i.id !== inboxId);
            ResearchStore.setState({ inbox: updatedInbox });
        }
    };
    // --- DOM BINDINGS ---
    document.getElementById('rs-btn-pause-job').onclick = () => { if (ResearchStore.getState().selectedJobId) handleJobAction(ResearchStore.getState().selectedJobId, 'pause'); };
document.getElementById('rs-btn-resume-job').onclick = () => { if (ResearchStore.getState().selectedJobId) handleJobAction(ResearchStore.getState().selectedJobId, 'resume'); };
    document.getElementById('rs-btn-retry-job').onclick = () => { if (ResearchStore.getState().selectedJobId) handleJobAction(ResearchStore.getState().selectedJobId, 'retry'); };
document.getElementById('rs-btn-cancel-job').onclick = () => { if (ResearchStore.getState().selectedJobId) handleJobAction(ResearchStore.getState().selectedJobId, 'cancel'); };
document.getElementById('rs-btn-delete-job').onclick = async () => {
        const jobId = ResearchStore.getState().selectedJobId;
        if (!jobId) return;

        if (!confirm("Are you sure you want to permanently delete this research job and all its scraped items? This cannot be undone.")) return;

        const btn = document.getElementById('rs-btn-delete-job');
        btn.innerText = "⏳ Deleting...";

        try {
            await fetch(`/api/research/${jobId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete' })
            });
            ResearchStore.setState({ selectedJobId: null, selectedItemId: null, aiTriageMode: false });
            await fetchState();
        } catch(e) {
            alert("Failed to delete job.");
            btn.innerText = "🗑️ Delete Job";
        }
    };
    document.getElementById('rs-toggle-ai-triage').onclick = () => {
            ResearchStore.setState({ aiTriageMode: !ResearchStore.getState().aiTriageMode });
        };
    document.getElementById('rs-btn-gen-context').onclick = async () => {
        const jobId = ResearchStore.getState().selectedJobId;
        if (!jobId) return;

        const btn = document.getElementById('rs-btn-gen-context');
        btn.innerText = "⏳ Packing...";
        try {
            const container = document.getElementById('rs-context-links');
            container.replaceChildren();
            const res = await fetch(`/api/research/${jobId}/export_context`);
            if (!res.ok) throw new Error("Failed to export context");
            const data = await res.json();
            const chunks = data.chunks || [];

            if (chunks.length === 0) {
                container.innerHTML = '<span style="color: var(--intent-warning); font-size: 0.85rem;">No fully scraped pending links available to pack.</span>';
                return;
            }
            chunks.forEach((chunk, i) => {
                const filename = `context_${jobId.substring(0, 8)}_part_${i+1}.txt`;
                const blob = new Blob([chunk], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = '#';
                a.innerText = `📄 Download Part ${i+1} (${(chunk.length/1024).toFixed(1)} kb)`;
                a.style.cssText = 'color: var(--intent-primary); text-decoration: none; font-size: 0.9rem; padding: 4px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; width: fit-content; margin-bottom: 5px; display: inline-block; cursor: pointer;';
                a.onmouseover = () => a.style.background = 'var(--input-bg)';
                a.onmouseout = () => a.style.background = 'var(--bg)';
                a.onclick = (e) => {
                    e.preventDefault();
                    downloadFile(url, filename);
                };
                container.appendChild(a);
            });
        } catch(e) {
            alert("Failed to generate context files.");
        } finally {
            btn.innerText = "📦 Pack Context Files";
        }
    };
    document.getElementById('rs-btn-exec-ai').onclick = async () => {
        const input = (ResearchStore.getState().aiJsonInput || '').trim();
if (!input) return;

        const payload = (() => {
            try {
                // Strip out markdown code blocks in case the LLM wrapped its response
                const cleanInput = input
                    .replace(/^```json/, '')
                    .replace(/^```/, '')
                    .replace(/```$/, '')
                    .trim();
                return JSON.parse(cleanInput);
            } catch (e) {
                return null;
            }
        })();

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return alert("Invalid JSON object. Ensure it looks like: {\"accept\": [], \"reject\": [], \"rescan\": []}");
        }
        try {
            if (typeof payload !== 'object' || Array.isArray(payload)) throw new Error("Not an object");
        } catch(e) {
            return alert("Invalid JSON object. Ensure it looks like: {\"accept\": [], \"reject\": [], \"rescan\": []}");
        }
        // Deep-clean LLM string hallucinations (leading/trailing spaces, or wrapping IDs in nested objects)
        const extractId = (val) => (typeof val === 'object' && val !== null && val.id) ? String(val.id).trim() : String(val).trim();

        const acceptIds = Array.isArray(payload.accept) ? payload.accept.map(extractId) : [];
        const rejectIds = Array.isArray(payload.reject) ? payload.reject.map(extractId) : [];
        const rescanIds = Array.isArray(payload.rescan) ? payload.rescan.map(extractId) : [];

        const btn = document.getElementById('rs-btn-exec-ai');
        btn.innerText = "⏳ Processing (Please wait)...";
        try {
            // Execute sequentially to prevent concurrent I/O lockups and Cartographer bottlenecks
            for (const id of acceptIds) {
                if (id) await handleDisposition(id, 'accepted');
            }
            for (const id of rejectIds) {
                if (id) await handleDisposition(id, 'rejected');
            }
            for (const id of rescanIds) {
                if (id) await handleDisposition(id, 'force_scrape');
}
            const aiInp = document.getElementById('rs-ai-json-input');
            if (aiInp) aiInp.value = '';
            await fetchState(); // Final sync with the backend
            alert(`✅ Triage complete:\n- ${acceptIds.length} Accepted to Workspace\n- ${rejectIds.length} Rejected\n- ${rescanIds.length} Queued for Rescan`);
            ResearchStore.setState({ aiTriageMode: false, selectedItemId: null });
        } catch(e) {
            alert("An error occurred executing the batch triage.");
        } finally {
            btn.innerText = "🤖 Execute Triage";
        }
    };

    document.getElementById('btn-pick-rs-dir').onclick = () => {
        if (window.openFolderBrowser) {
            window.openFolderBrowser((path) => {
                const finalPath = path ? path + '/' : '';
                const dirInput = document.getElementById('rs-default-dir');
                dirInput.value = finalPath;
                dirInput.dispatchEvent(new Event('input'));
            });
        }
    };
    document.getElementById('rs-default-dir').addEventListener('input', (e) => {
        ResearchStore.setState({ targetDir: e.target.value });
        const targetInput = document.getElementById('rs-target-dir');
        if (targetInput) targetInput.value = e.target.value;
        const headerInput = document.getElementById('rs-header-target-dir');
        if (headerInput) headerInput.value = e.target.value;
    });
    document.getElementById('rs-target-dir').addEventListener('input', (e) => {
            const activeJobId = ResearchStore.getState().selectedJobId;
            if (activeJobId) {
                const activeJob = ResearchStore.getState().jobs.find(j => j.id === activeJobId);
                if (activeJob) {
                    const m = (() => {
                        try { 
                            return JSON.parse(activeJob.meta_json || '{}'); } 
                        catch(err) { return {}; }
                    })();
                    m.target_dir = e.target.value;
                    activeJob.meta_json = JSON.stringify(m);
                }
            }
            ResearchStore.setState({ targetDir: e.target.value });
            const defaultInput = document.getElementById('rs-default-dir');
            if (defaultInput) defaultInput.value = e.target.value;
            const headerInput = document.getElementById('rs-header-target-dir');
            if (headerInput) headerInput.value = e.target.value;
        });
    document.getElementById('rs-target-dir').addEventListener('change', async (e) => {
            const activeJobId = ResearchStore.getState().selectedJobId;
            if (activeJobId) {
                await fetch(`/api/research/${activeJobId}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_meta', meta: { target_dir: e.target.value } })
                });
            }
        });

    // Inject Global Back Button into the right-aligned sub-tabs-bar
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
    // Observer replaced by pure UDF zone:subtab-changed UI Hook
    document.getElementById('rs-start-btn').onclick = startJob;
    document.getElementById('rs-date-range').addEventListener('change', (e) => {
        document.getElementById('rs-custom-dates').style.display = e.target.value === 'custom' ? 'flex' : 'none';
        document.getElementById('rs-custom-years').style.display = e.target.value === 'custom_year' ? 'flex' : 'none';
    });

    document.getElementById('rs-max-results-select').addEventListener('change', (e) => {
        document.getElementById('rs-max-results-custom').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    document.getElementById('btn-pick-rs-target-dir').onclick = () => {
        if (window.openFolderBrowser) {
            window.openFolderBrowser((path) => {
                const finalPath = path ? path + '/' : '';
                const dirInput = document.getElementById('rs-target-dir');
                dirInput.value = finalPath;
                dirInput.dispatchEvent(new Event('input'));
                dirInput.dispatchEvent(new Event('change'));
            });
        }
    };
    window.forceScrapeLink = async (inboxId) => {
        await fetch(`/api/research/inbox/${inboxId}/disposition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'force_scrape' })
        });
        fetchState();
    };
    // --- RENDERERS (Subscribed to UDF Store) ---
    const updateLayout = () => {
        const state = ResearchStore.getState();
        const globalBackBtn = document.getElementById('rs-global-back-btn');
        const subResearchActive = state.isTabActive;

        if (state.selectedJobId) {
            if (state.aiTriageMode) {
                document.getElementById('rs-manual-triage').style.display = 'none';
                document.getElementById('rs-ai-triage').style.display = 'flex';
                document.getElementById('rs-toggle-ai-triage').innerText = '🔙 Back to Manual Triage';
                document.getElementById('rs-toggle-ai-triage').style.background = 'var(--intent-neutral)';
            } else {
                document.getElementById('rs-manual-triage').style.display = 'flex';
                document.getElementById('rs-ai-triage').style.display = 'none';
                document.getElementById('rs-toggle-ai-triage').innerText = '🤖 AI-Assisted Batch Triage';
                document.getElementById('rs-toggle-ai-triage').style.background = 'var(--intent-highlight)';
            }
            const jobsView = document.getElementById('rs-view-jobs');
            const detailView = document.getElementById('rs-view-detail');
            if (jobsView) jobsView.className = 'rs-view';
            if (detailView) detailView.className = 'rs-view active';

            if (globalBackBtn && subResearchActive) globalBackBtn.style.display = 'block';
        } else {
            const headerEl = document.getElementById('rs-detail-header');
            if (headerEl) headerEl.dataset.jobId = '';

            const jobsView = document.getElementById('rs-view-jobs');
            const detailView = document.getElementById('rs-view-detail');
            if (jobsView) jobsView.className = 'rs-view active';
            if (detailView) detailView.className = 'rs-view';

            if (globalBackBtn) globalBackBtn.style.display = 'none';
        }
    };

    const updateJobHeader = () => {
        const state = ResearchStore.getState();
        if (!state.selectedJobId) return;
        const activeJob = state.jobs.find(j => j.id === state.selectedJobId);
        if (!activeJob) return;

        const meta = (() => {
            try { return JSON.parse(activeJob.meta_json || '{}'); } 
            catch(e) { return {}; }
        })();
const safeDate = activeJob.created_at ?
new Date(activeJob.created_at).toLocaleString() : 'Unknown Date';
const statusColor = (() => {
    if (activeJob.status === 'running') return 'var(--intent-primary)';
    if (activeJob.status === 'gathering') return 'var(--intent-highlight)';
    if (activeJob.status === 'completed') return 'var(--intent-primary)';
    if (activeJob.status === 'reviewed') return 'var(--intent-success)';
    if (activeJob.status === 'failed') return 'var(--intent-danger)';
    return 'var(--text-muted)';
})();
const safeQueryForClick = activeJob.query.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const dr = meta.date_range ? meta.date_range : 'Any Time';
        const parserUsed = meta.parser || 'jina';
        const targetDirUsed = meta.target_dir || state.targetDir || 'research/';

        const statusExtraDetail = (() => {
          if (activeJob.status === 'gathering') {
            const pageNum = Math.floor((meta.start_index || 0) / 10) + 1;
            return `(Page ${pageNum} - ${activeJob.total_links} found)`;
          }
          return `(${activeJob.processed_links}/${activeJob.total_links} scraped)`;
        })();

        const headerEl = document.getElementById('rs-detail-header');

        if (headerEl.dataset.jobId !== activeJob.id) {
            headerEl.dataset.jobId = activeJob.id;
            headerEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                    <div style="font-weight: bold; color: var(--intent-primary); font-size: 1.15rem; word-break: break-word;">🔍 ${activeJob.query}</div>
                    <button class="btn-sm" style="background: transparent; border: 1px solid var(--border); color: var(--text); padding: 2px 8px; margin: 0; font-size: 0.8rem; white-space: nowrap; flex-shrink: 0;" onclick="navigator.clipboard.writeText('${safeQueryForClick}'); this.innerText='✅ Copied!'; setTimeout(()=>this.innerText='📋 Copy', 2000)">📋 Copy</button>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="font-size: 0.95rem;"><b>Status:</b> <span id="rs-header-status-color" style="color: ${statusColor}; font-weight: bold;">${activeJob.status.toUpperCase()}</span> <span id="rs-header-status-text" style="color: var(--text-muted);">${statusExtraDetail}</span></span>
                    <button id="rs-btn-expand-details" class="btn-sm" style="background: transparent; border: none; color: var(--intent-highlight); padding: 2px 8px; margin: 0; font-size: 0.85rem; font-weight: bold; cursor: pointer;">Show More ▼</button>
                </div>

                <div id="rs-header-expanded-details" style="display: none; flex-direction: column; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                    <div style="display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-muted); flex-wrap: wrap;">
                        <span><b>Provider:</b> <span style="color: var(--text);">${activeJob.provider}</span></span>
                        <span><b>Date Range:</b> <span style="color: var(--text);">${dr}</span></span>
                        <span><b>Started:</b> <span style="color: var(--text);">${safeDate}</span></span>
                    </div>

                    <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;">
                        <div style="flex: 1; min-width: 200px;">
                            <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Extraction Parser</label>
                            <select id="rs-header-parser" style="width: 100%; padding: 6px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;">
                                <option value="jina" ${parserUsed === 'jina' ? 'selected' : ''}>Jina AI (Rich Markdown)</option>
                                <option value="bs4" ${parserUsed === 'bs4' ? 'selected' : ''}>Local (BeautifulSoup)</option>
                            </select>
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Output Folder</label>
                            <div style="display: flex; gap: 5px;">
                                <input type="text" id="rs-header-target-dir" value="${targetDirUsed}" style="flex: 1; padding: 6px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem;">
                                <button id="btn-pick-rs-header-dir" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px;" type="button">...</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Bind Expansion Toggle
            const expandBtn = document.getElementById('rs-btn-expand-details');
            const expandedDiv = document.getElementById('rs-header-expanded-details');
            expandBtn.onclick = () => {
                const isHidden = expandedDiv.style.display === 'none';
                expandedDiv.style.display = isHidden ? 'flex' : 'none';
                expandBtn.innerText = isHidden ? 'Hide ▲' : 'Show More ▼';
            };
            // Bind Target Dir Input (Mirrors the global application state and database)
            const dirInput = document.getElementById('rs-header-target-dir');
            dirInput.addEventListener('input', (e) => {
                // Optimistic update to prevent render-loop rollback
                meta.target_dir = e.target.value;
                activeJob.meta_json = JSON.stringify(meta);

                ResearchStore.setState({ targetDir: e.target.value });
                const mainDefault = document.getElementById('rs-default-dir');
                if (mainDefault) mainDefault.value = e.target.value;
                const modalTarget = document.getElementById('rs-target-dir');
                if (modalTarget) modalTarget.value = e.target.value;
            });

            dirInput.addEventListener('change', async (e) => {
                await fetch(`/api/research/${activeJob.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_meta', meta: { target_dir: e.target.value } })
                });
            });
            // Bind Directory Picker
            document.getElementById('btn-pick-rs-header-dir').onclick = () => {
                if (window.openFolderBrowser) {
                    window.openFolderBrowser((path) => {
                        const finalPath = path ? path + '/' : '';
                        dirInput.value = finalPath;
                        dirInput.dispatchEvent(new Event('input'));
                        dirInput.dispatchEvent(new Event('change'));
                    });
                }
            };
            // Bind Parser Action API
            document.getElementById('rs-header-parser').addEventListener('change', async (e) => {
                await fetch(`/api/research/${activeJob.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_meta', meta: { parser: e.target.value } })
                });
            });
        } else {
            // Soft-update the dynamic tracking strings so we don't break input focus
            const statusColorSpan = document.getElementById('rs-header-status-color');
            const statusTextSpan = document.getElementById('rs-header-status-text');
            const headerDirInput = document.getElementById('rs-header-target-dir');

            if (statusColorSpan) {
                statusColorSpan.innerText = activeJob.status.toUpperCase();
                statusColorSpan.style.color = statusColor;
            }
            if (statusTextSpan) {
                statusTextSpan.innerText = statusExtraDetail;
            }
            if (headerDirInput && document.activeElement !== headerDirInput) {
                headerDirInput.value = targetDirUsed;
            }
            const modalTarget = document.getElementById('rs-target-dir');
            if (modalTarget && document.activeElement !== modalTarget) {
                modalTarget.value = targetDirUsed;
            }
        }

        const btnPause = document.getElementById('rs-btn-pause-job');
        const btnResume = document.getElementById('rs-btn-resume-job');
        const btnRetry = document.getElementById('rs-btn-retry-job');
        const btnCancel = document.getElementById('rs-btn-cancel-job');

        if (btnPause) btnPause.style.display = (activeJob.status === 'running') ? 'block' : 'none';
        if (btnResume) btnResume.style.display = (activeJob.status === 'paused') ? 'block' : 'none';
        if (btnRetry) btnRetry.style.display = (activeJob.status === 'failed') ? 'block' : 'none';
        if (btnCancel) btnCancel.style.display = (['running', 'paused', 'gathering', 'failed'].includes(activeJob.status)) ? 'block' : 'none';
    };
    const updateJobsList = () => {
        const state = ResearchStore.getState();
        const jobsList = document.getElementById('rs-jobs-list');
        jobsList.replaceChildren();
        state.jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.padding = '10px';
            card.style.cursor = 'pointer';

            const meta = (() => {
                try { return JSON.parse(job.meta_json || '{}'); } catch(e) { return {}; }
            })();

            const statusColor = (() => {
                if (job.status === 'running') return 'var(--intent-primary)';
                if (job.status === 'gathering') return 'var(--intent-highlight)';
                if (job.status === 'completed') return 'var(--intent-primary)';
                if (job.status === 'reviewed') return 'var(--intent-success)';
                if (job.status === 'failed') return 'var(--intent-danger)';
                return 'var(--text-muted)';
            })();

            const actionHtml = (() => {
                if (job.status === 'gathering') {
                    return `<button class="btn-sm job-cancel" data-id="${job.id}" style="background: var(--intent-danger); margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
                } else if (job.status === 'running') {
                    return `<button class="btn-sm job-pause" data-id="${job.id}" style="background: var(--intent-warning); margin:0; padding: 2px 8px;">⏸️ Pause</button>
                                  <button class="btn-sm job-cancel" data-id="${job.id}" style="background: var(--intent-danger); margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
                } else if (job.status === 'paused') {
                    return `<button class="btn-sm job-resume" data-id="${job.id}" style="background: var(--intent-success); margin:0; padding: 2px 8px;">▶️ Resume</button>
                                  <button class="btn-sm job-cancel" data-id="${job.id}" style="background: var(--intent-danger); margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
                } else if (job.status === 'failed') {
                    return `<button class="btn-sm job-retry" data-id="${job.id}" style="background: var(--intent-highlight); margin:0; padding: 2px 8px;">🔄 Retry</button>
                                  <button class="btn-sm job-cancel" data-id="${job.id}" style="background: var(--intent-danger); margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
                }
                return '';
            })();

            const errorHtml = (job.status === 'failed' && meta.error) 
                ? `<div style="font-size: 0.8rem; color: var(--intent-danger); background: var(--input-bg); padding: 6px 10px; border-radius: 4px; margin-top: 8px; border: 1px solid var(--intent-danger);">⚠️ <b>Error:</b> ${meta.error}</div>`
                : '';
            const safeDate = job.created_at ?
new Date(job.created_at).toLocaleString() : 'Unknown Date';
            const cardStatusExtra = (() => {
                if (job.status === 'gathering') {
                    const pageNum = Math.floor((meta.start_index || 0) / 10) + 1;
                    return `(Page ${pageNum} - ${job.total_links} found)`;
                }
                return `(${job.processed_links}/${job.total_links} scraped)`;
            })();

            const dr = meta.date_range ? meta.date_range : 'Any Time';

            card.innerHTML = `
                <div style="font-weight: bold; color: var(--text); font-size: 0.95rem; word-break: break-word;">🔍 ${job.query} <span style="font-weight: normal; font-size: 0.8rem; color: var(--text-muted);">(${dr})</span></div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Created: ${safeDate}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                    <span style="font-size: 0.8rem; color: ${statusColor};">Status: ${job.status.toUpperCase()} ${cardStatusExtra}</span>
                    <div style="display: flex; gap: 5px;">${actionHtml}</div>
                </div>
                ${errorHtml}
            `;

            // Clicking the card opens the job (if not clicking an action button)
            card.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    ResearchStore.setState({ selectedJobId: job.id, selectedItemId: null });
                }
            };

            jobsList.appendChild(card);
        });

        // Re-bind dynamically generated job buttons
        document.querySelectorAll('.job-pause').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'pause'));
        document.querySelectorAll('.job-resume').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'resume'));
        document.querySelectorAll('.job-retry').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'retry'));
        document.querySelectorAll('.job-cancel').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'cancel'));
    };
    const updateInboxList = () => {
        const state = ResearchStore.getState();
        const inboxList = document.getElementById('rs-inbox-list');
        inboxList.replaceChildren();
        // Filter inbox by active job
        const activeInbox = state.selectedJobId ? state.inbox.filter(i => i.job_id === state.selectedJobId) : [];

        if (activeInbox.length === 0 && state.selectedJobId) {
            inboxList.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No pending items for this job.</span>';
        } else {
            activeInbox.forEach(item => {
                const card = document.createElement('div');
                card.className = 'file-card';
                card.style.cursor = 'pointer';
                card.style.padding = '10px';
                if (state.selectedItemId === item.id) {
                  card.style.border = '2px solid var(--intent-highlight)';
                }
                const dupHtml = (() => {
                  if (item.status === 'duplicate') {
                    return `<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 0.75rem; color: var(--intent-warning); font-weight: bold;">⚠️ Already Scraped</span>
                          <button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-warning); color: var(--intent-warning); 
          padding: 2px 8px; margin: 0; font-size: 0.7rem;" onclick="event.stopPropagation(); window.forceScrapeLink('${item.id}')">Force Scrape Anyway</button>
                          </div>`;
                  } else if (item.status === 'in_library') {
                    return `<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 0.75rem; color: var(--intent-highlight); font-weight: bold;">📚 In Library</span>

              <button class="btn-sm" style="background: transparent; border: 1px solid var(--intent-highlight); color: var(--intent-highlight); padding: 2px 8px; margin: 0; font-size: 0.7rem;"
          onclick="event.stopPropagation(); window.forceScrapeLink('${item.id}')">Force Scrape Anyway</button>
                          </div>`;
                  }
                  return '';
                })();
                const scrapedBadge = item.scraped_at ? '<span title="Extraction Complete" style="font-size: 0.8rem;">✅</span>' : '<span title="Waiting for extraction..." style="font-size: 0.8rem; opacity: 0.5;">⏳</span>';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 5px;">
                        <div style="font-weight: bold; color: var(--text); font-size: 0.9rem; word-wrap: break-word;">${item.title || 'Untitled'}</div>
                        <div style="flex-shrink: 0;">${scrapedBadge}</div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--intent-primary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.url}</div>
                    <div style="color: var(--text-muted); font-family: monospace; font-size: 0.7rem; margin-top: 4px; user-select: all;">ID: ${item.id}</div>
                    ${dupHtml}
                `;
                card.onclick = () => ResearchStore.setState({ selectedItemId: item.id });
                inboxList.appendChild(card);
            });
        }
    };
    const updatePreviewModal = () => {
        const state = ResearchStore.getState();
        const activeItem = state.inbox.find(i => i.id === state.selectedItemId);

        // If there's an existing dynamic modal but no active item, close it
        if (!activeItem) {
            if (document.getElementById('rs-preview-dynamic-modal')) {
                window.inSetu.ui.Factory.closeModal('rs-preview-dynamic-modal');
            }
            return;
        }

        // Create the modal dynamically if it doesn't exist
        if (!document.getElementById('rs-preview-dynamic-modal')) {
            const bodyHtml = `
                <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; background: var(--input-bg);">
                    <div id="rs-preview-title-container"></div>
                    <div id="rs-disposition-controls" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div style="display: flex; gap: 5px; flex: 1; min-width: 200px;">
<input type="text" id="rs-target-dir-modal" value="${state.targetDir || 'research/'}" placeholder="Target path (e.g. research/)" style="flex: 1; padding: 6px; font-family: monospace;"
oninput="ResearchStore.setState({ targetDir: event.target.value })">
<button id="btn-pick-rs-target-dir-modal" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 6px 12px;"
type="button" onclick="if(window.openFolderBrowser) window.openFolderBrowser((p) => { const tmEl = document.getElementById('rs-target-dir-modal'); if(tmEl) tmEl.value = p ? p + '/' : ''; ResearchStore.setState({ targetDir: p ? p + '/' : '' }); })">...</button>
</div>
                        <button id="rs-accept-btn" class="btn-sm" style="background: var(--intent-success); margin: 0;">✅ Accept to Workspace</button>
                        <button id="rs-reject-btn" class="btn-sm" style="background: var(--intent-danger); margin: 0;">🗑️ Reject</button>
                        <button id="rs-rescrape-btn" class="btn-sm" style="background: var(--intent-warning); margin: 0;">🔄 Re-Scrape</button>
                    </div>
                </div>
                <div id="rs-markdown-preview" tabindex="0" style="flex: 1; overflow-y: auto; padding: 20px; font-size: 0.95rem; outline: none;"></div>
            `;
            window.inSetu.ui.Factory.createModal({
                id: 'rs-preview-dynamic-modal',
                title: 'Research Item Preview',
                body: bodyHtml,
                maxWidth: '95vw',
                actions: [] // Actions are handled inline for specific research layout mapping
            });

            // Re-bind actions for newly created dynamic modal
            document.getElementById('rs-accept-btn').onclick = () => {
                if (ResearchStore.getState().selectedItemId) handleDisposition(ResearchStore.getState().selectedItemId, 'accepted');
            };
            document.getElementById('rs-reject-btn').onclick = () => {
                if (ResearchStore.getState().selectedItemId) handleDisposition(ResearchStore.getState().selectedItemId, 'rejected');
            };
            document.getElementById('rs-rescrape-btn').onclick = () => {
                if (ResearchStore.getState().selectedItemId) handleDisposition(ResearchStore.getState().selectedItemId, 'force_scrape');
            };

            // Hook the generic modal 'Back' button to reset active state
            const modalPanel = document.getElementById('rs-preview-dynamic-modal');
            const backBtn = modalPanel.querySelector('.modal-header button');
            if (backBtn) backBtn.addEventListener('click', () => ResearchStore.setState({ selectedItemId: null }));
        }

        // Update content of active dynamic modal safely
        const titleEl = document.getElementById('rs-preview-title-container');
        const previewEl = document.getElementById('rs-markdown-preview');

        if (titleEl) {
            titleEl.innerHTML = `
                <div style="margin-bottom: 4px; font-weight: bold; color: var(--intent-highlight); font-size: 1.15rem;">${activeItem.title || 'Untitled'}</div>
                <div style="margin-bottom: 4px;"><a href="${activeItem.url}" target="_blank" style="color: var(--intent-primary); font-size: 0.85rem; word-break: break-all; font-weight: normal; text-decoration: none;">🔗 ${activeItem.url}</a></div>
                <div style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; font-weight: normal; user-select: all;">Item ID: ${activeItem.id}</div>
            `;
        }

        if (previewEl) {
            if (activeItem.raw_markdown) {
                previewEl.innerHTML = marked.parse(activeItem.raw_markdown);
            } else {
                previewEl.innerHTML = '<span style="color: var(--intent-warning); font-style: italic;">Awaiting extraction...</span>';
            }
            setTimeout(() => previewEl.focus(), 50);
        }
    };

    ResearchStore.subscribe((state) => state.aiTriageMode, updateLayout);
    ResearchStore.subscribe((state) => state.selectedJobId, () => {
        updateLayout();
        updateJobHeader();
        updateInboxList();
    });
    ResearchStore.subscribe((state) => state.jobs, () => {
        updateJobHeader();
        updateJobsList();
    });
    ResearchStore.subscribe((state) => state.inbox, () => {
        updateInboxList();
        updatePreviewModal();
    });
    ResearchStore.subscribe((state) => state.selectedItemId, () => {
        updateInboxList();
        updatePreviewModal();
    });

    // Initial render
    updateLayout();
    updateJobsList();
    // Auto-poll securely via the Centralized Metronome
    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerTick) {
        window.inSetu.extensions.Registry.registerTick('research', 3000, () => {
            if (ResearchStore.getState().jobs.some(j => j.status === 'running' || j.status === 'gathering')) {
                fetchState();
            }
        });
    }
    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
        window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
            if (tabId === 'research') fetchState();
        });
        window.inSetu.extensions.Registry.registerUIHook('zone:subtab-changed', (data) => {
            if (data.parentId === 'edit') {
                ResearchStore.setState({ isTabActive: data.subId === 'research' });
                if (data.subId === 'research' && data.forceRefresh) fetchState();
            }
        });
    }

// Initial load
    fetchState();
}