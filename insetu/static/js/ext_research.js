import { executeWorkspaceMutation } from './app.js';
import { downloadFile } from './fs.js';
// --- UDF STATE STORE ---
const ResearchStore = {
    state: {
        jobs: [],
        inbox: [],
        selectedJobId: null,
        selectedItemId: null,
        targetDir: 'research/',
        aiTriageMode: false
    },
    listeners: [],
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.listeners.forEach(fn => fn(this.state));
    },
    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.state);
    }
};

// --- UI REGISTRATION ---
const researchTab = window.ExtensionRegistry.registerSubTab('edit', 'research', 'Research');
if (researchTab) {
    researchTab.innerHTML = `
        <style>
            .rs-layout {
                display: flex; flex-direction: column; height: calc(100vh - 180px); overflow: hidden;
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
                    <h3 style="margin-top: 0; color: #38bdf8;">New Research Job</h3>
                    <input type="text" id="rs-query" placeholder="Search Query..." style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <select id="rs-provider" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                            <option value="serper">Google (Serper.dev API)</option>
                            <option value="google">Google (Playwright)</option>
                            <option value="duckduckgo">DuckDuckGo</option>
                        </select>
                        <select id="rs-date-range" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
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
                        <input type="date" id="rs-date-start" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                        <input type="date" id="rs-date-end" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                    </div>
                    <div id="rs-custom-years" style="display: none; gap: 10px; margin-bottom: 10px;">
                        <input type="number" id="rs-year-start" placeholder="YYYY (e.g. 1999)" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" min="1990" max="2100">
                        <input type="number" id="rs-year-end" placeholder="YYYY (e.g. 2005)" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" min="1990" max="2100">
                    </div>
                    <div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-end;">
                        <div style="flex: 1;">
                            <label style="font-weight: bold; font-size: 0.85rem; color: #888; display: block; margin-bottom: 4px;">Extraction Parser</label>
                            <select id="rs-parser" style="width: 100%; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                                <option value="jina">Jina AI (Rich Markdown)</option>
                                <option value="bs4">Local (BeautifulSoup)</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <label style="font-weight: bold; font-size: 0.85rem; color: #888; display: block; margin-bottom: 4px;">Default Output Folder</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="rs-default-dir" value="research/" placeholder="e.g. research/" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace;">
                                <button id="btn-pick-rs-dir" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 8px 12px;" type="button">...</button>
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="font-weight: bold; font-size: 0.85rem; color: #888; display: block; margin-bottom: 4px;">Max Results</label>
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
                    <button id="rs-start-btn" class="btn-sm" style="background: #8b5cf6; width: 100%; margin: 0; padding: 10px; font-weight: bold;">🚀 Start Scraping</button>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: var(--text);">Active & Past Jobs</h4>
                    <button id="rs-refresh-btn" class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; padding: 2px 8px;">🔄 Refresh</button>
                </div>
                <div id="rs-jobs-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>

            <div id="rs-view-detail" class="rs-view">
                <div id="rs-detail-header" style="margin-bottom: 15px; padding: 15px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border);"></div>
                <div id="rs-job-actions-row" style="margin-bottom: 15px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
                    <button id="rs-btn-pause-job" class="btn-sm" style="background: #f59e0b; margin: 0; padding: 6px 12px; font-weight: bold; display: none;">⏸️ Pause</button>
                    <button id="rs-btn-resume-job" class="btn-sm" style="background: #10b981; margin: 0; padding: 6px 12px; font-weight: bold; display: none;">▶️ Resume</button>
                    <button id="rs-btn-retry-job" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 6px 12px; font-weight: bold; display: none;">🔄 Retry</button>
                    <button id="rs-btn-cancel-job" class="btn-sm" style="background: #64748b; margin: 0; padding: 6px 12px; font-weight: bold; display: none;">⏹️ Cancel</button>
                    <button id="rs-btn-delete-job" class="btn-sm" style="background: transparent; border: 1px solid #dc2626; color: #dc2626; margin: 0; padding: 6px 12px; font-weight: bold;">🗑️ Delete</button>
                    <button id="rs-toggle-ai-triage" class="btn-sm" style="background: #a855f7; margin: 0; padding: 6px 12px; font-weight: bold;">🤖 Batch Triage</button>
                </div>
                <div id="rs-manual-triage" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <div style="flex: 1; display: flex; flex-direction: column; min-height: 200px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg);">
                        <div id="rs-inbox-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding: 10px; flex: 1;"></div>
                    </div>
                </div>
                <div id="rs-preview-modal" class="fullscreen-modal" style="z-index: 1090; display: none;">
                    <div class="modal-content" style="max-height: 95vh; height: 95vh; width: 95vw; max-width: none; display: flex; flex-direction: column; padding: 0; overflow: hidden; background: var(--bg);">
                        <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; background: var(--input-bg);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
                                <span id="rs-preview-title" style="font-weight: bold; color: #a855f7; font-size: 1.15rem; word-break: break-word;">No item selected</span>
                                <button id="rs-close-preview-btn" class="btn-sm" style="background: #dc2626; margin: 0; flex-shrink: 0; padding: 4px 12px;">Close</button>
                            </div>
                            <div id="rs-disposition-controls" style="display: none; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <div style="display: flex; gap: 5px; flex: 1; min-width: 200px;">
                                    <input type="text" id="rs-target-dir" value="research/" placeholder="Target path (e.g. research/)" style="flex: 1; padding: 6px; font-family: monospace;">
                                    <button id="btn-pick-rs-target-dir" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 6px 12px;" type="button">...</button>
                                </div>
                                <button id="rs-accept-btn" class="btn-sm" style="background: #10b981; margin: 0;">✅ Accept to Workspace</button>
                                <button id="rs-reject-btn" class="btn-sm" style="background: #dc2626; margin: 0;">🗑️ Reject</button>
                                <button id="rs-rescrape-btn" class="btn-sm" style="background: #f59e0b; margin: 0;">🔄 Re-Scrape</button>
                            </div>
                        </div>
                        <div id="rs-markdown-preview" tabindex="0" style="flex: 1; overflow-y: auto; padding: 20px; font-size: 0.95rem; outline: none;"></div>
                    </div>
                </div>

                <div id="rs-ai-triage" style="display: none; flex-direction: column; flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 20px; overflow-y: auto;">
                    <h3 style="margin-top: 0; color: #a855f7; margin-bottom: 15px;">Batch Triage Pipeline</h3>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 1: Download Context</h4>
                    <p style="font-size: 0.85rem; color: #888; margin-top: 0; margin-bottom: 10px;">Downloads all fully-scraped pending URLs in this job as chunked text files.</p>
                    <button id="rs-btn-gen-context" class="btn-sm" style="background: #3b82f6; width: fit-content; margin: 0 0 10px 0;">📦 Pack Context Files</button>
                    <div id="rs-context-links" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 25px;"></div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 2: Prompt Template</h4>
                    <textarea readonly style="width: 100%; min-height: 160px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 25px; resize: vertical;" onclick="this.select()">Review these scraped documents. I am researching [INSERT TOPIC]. Filter out any documents that are SEO spam, irrelevant, or low quality. 

Output your response as a raw JSON object containing three arrays of \`id\` strings: \`accept\` (highly relevant), \`reject\` (spam/irrelevant), and \`rescan\` (relevant but poorly formatted or truncated). Do not include markdown blocks. Example: {"accept": ["id-1"], "reject": ["id-2"], "rescan": ["id-3"]}</textarea>

                    <h4 style="margin: 0 0 10px 0; color: var(--text);">Step 3: Ingest AI Triage</h4>
                    <p style="font-size: 0.85rem; color: #888; margin-top: 0; margin-bottom: 10px;">Paste the raw JSON object from the LLM here to process the batch.</p>
                    <textarea id="rs-ai-json-input" placeholder='{"accept": [], "reject": [], "rescan": []}' style="width: 100%; min-height: 120px; padding: 10px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem; margin-bottom: 10px; resize: vertical;"></textarea>
                    <button id="rs-btn-exec-ai" class="btn-sm" style="background: #a855f7; width: 100%; margin: 0; padding: 10px; font-weight: bold;">🤖 Execute Triage</button>
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
        const query = document.getElementById('rs-query').value.trim();
        const provider = document.getElementById('rs-provider').value;
        const parser = document.getElementById('rs-parser').value;
        const targetDir = document.getElementById('rs-default-dir').value;
        let dateRange = document.getElementById('rs-date-range').value;
        if (dateRange === 'custom') {
            const start = document.getElementById('rs-date-start').value;
            const end = document.getElementById('rs-date-end').value;
            if (!start || !end) return alert("Both start and end dates are required for a custom range.");
            dateRange = `${start}..${end}`;
        } else if (dateRange === 'custom_year') {
            const startYr = document.getElementById('rs-year-start').value.trim();
            const endYr = document.getElementById('rs-year-end').value.trim();
            if (!startYr || !endYr || startYr.length !== 4 || endYr.length !== 4) {
                return alert("Both start and end years (YYYY) are required.");
            }
            // Expand into full ISO dates for the backend parser
            dateRange = `${startYr}-01-01..${endYr}-12-31`;
        }
        if (!query) return alert("Query required.");
        const btn = document.getElementById('rs-start-btn');
        btn.innerText = "⏳ Starting...";
        try {
            let maxResults = 50;
            const maxSelect = document.getElementById('rs-max-results-select').value;
            if (maxSelect === 'custom') {
                maxResults = parseInt(document.getElementById('rs-max-results-custom').value, 10) || 50;
            } else {
                maxResults = parseInt(maxSelect, 10);
            }
            const res = await fetch('/api/research/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, provider, parser: parser, target_dir: targetDir, max_results: maxResults, date_range: dateRange })
            });
            if (res.ok) {
                document.getElementById('rs-query').value = '';
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
        const item = ResearchStore.state.inbox.find(i => i.id === inboxId);
        if (!item) return;
        if (status === 'accepted') {
            const targetDir = document.getElementById('rs-target-dir').value.replace(/\/+$/, '') + '/';
            let slug = item.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (!slug) slug = 'research-note';
            slug = slug.replace(/^-+|-+$/g, '').substring(0, 60);

            const filepath = targetDir + slug + '.md';
            let contentToSave = item.raw_markdown;

            // Automatically bridge to the Citations Extension if active
            if (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes('citations') && window.addFileToLibrary) {
                contentToSave = await window.addFileToLibrary(slug + '.md', contentToSave, filepath);
            }

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
        if (ResearchStore.state.selectedItemId === inboxId) {
            ResearchStore.setState({ selectedItemId: null });
        }
        await fetchState();
    };
    // --- DOM BINDINGS ---
    document.getElementById('rs-btn-pause-job').onclick = () => { if (ResearchStore.state.selectedJobId) handleJobAction(ResearchStore.state.selectedJobId, 'pause'); };
    document.getElementById('rs-btn-resume-job').onclick = () => { if (ResearchStore.state.selectedJobId) handleJobAction(ResearchStore.state.selectedJobId, 'resume'); };
    document.getElementById('rs-btn-retry-job').onclick = () => { if (ResearchStore.state.selectedJobId) handleJobAction(ResearchStore.state.selectedJobId, 'retry'); };
    document.getElementById('rs-btn-cancel-job').onclick = () => { if (ResearchStore.state.selectedJobId) handleJobAction(ResearchStore.state.selectedJobId, 'cancel'); };

    document.getElementById('rs-btn-delete-job').onclick = async () => {
        const jobId = ResearchStore.state.selectedJobId;
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
        ResearchStore.setState({ aiTriageMode: !ResearchStore.state.aiTriageMode });
    };
    document.getElementById('rs-btn-gen-context').onclick = async () => {
        const jobId = ResearchStore.state.selectedJobId;
        if (!jobId) return;

        const btn = document.getElementById('rs-btn-gen-context');
        btn.innerText = "⏳ Packing...";

        try {
            const container = document.getElementById('rs-context-links');
            container.innerHTML = '';
            const res = await fetch(`/api/research/${jobId}/export_context`);
            if (!res.ok) throw new Error("Failed to export context");
            const data = await res.json();
            const chunks = data.chunks || [];

            if (chunks.length === 0) {
                container.innerHTML = '<span style="color: #f59e0b; font-size: 0.85rem;">No fully scraped pending links available to pack.</span>';
                return;
            }
            chunks.forEach((chunk, i) => {
                const filename = `context_${jobId.substring(0, 8)}_part_${i+1}.txt`;
                const blob = new Blob([chunk], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = '#';
                a.innerText = `📄 Download Part ${i+1} (${(chunk.length/1024).toFixed(1)} kb)`;
                a.style.cssText = 'color: #38bdf8; text-decoration: none; font-size: 0.9rem; padding: 4px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; width: fit-content; margin-bottom: 5px; display: inline-block; cursor: pointer;';
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
        const input = document.getElementById('rs-ai-json-input').value.trim();
        if (!input) return;

        let payload = {};
        try {
            // Strip out markdown code blocks in case the LLM wrapped its response
            let cleanInput = input;
            if (cleanInput.startsWith('```json')) cleanInput = cleanInput.substring(7);
            else if (cleanInput.startsWith('```')) cleanInput = cleanInput.substring(3);
            if (cleanInput.endsWith('```')) cleanInput = cleanInput.substring(0, cleanInput.length - 3);
            cleanInput = cleanInput.trim();

            payload = JSON.parse(cleanInput);
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

            document.getElementById('rs-ai-json-input').value = '';
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
        const activeJobId = ResearchStore.state.selectedJobId;
        if (activeJobId) {
            const activeJob = ResearchStore.state.jobs.find(j => j.id === activeJobId);
            if (activeJob) {
                let m = {};
                try { m = JSON.parse(activeJob.meta_json || '{}'); } catch(err){}
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
        const activeJobId = ResearchStore.state.selectedJobId;
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
        backBtn.style.cssText = 'background: #64748b; margin: 0; padding: 4px 12px; display: none;';
        backBtn.innerText = '🔙 Back to Jobs';
        backBtn.onclick = () => ResearchStore.setState({ selectedJobId: null, selectedItemId: null });
        actionContainer.prepend(backBtn);
    }

    // Observer to toggle Back button visibility if the user switches tabs while in detail view
    const subResearchNode = document.getElementById('sub-research');
    if (subResearchNode) {
        new MutationObserver(() => {
            const isActive = subResearchNode.classList.contains('active');
            const globalBackBtn = document.getElementById('rs-global-back-btn');
            if (globalBackBtn) {
                globalBackBtn.style.display = (isActive && ResearchStore.state.selectedJobId) ? 'block' : 'none';
            }
        }).observe(subResearchNode, { attributes: true, attributeFilter: ['class'] });
    }

    document.getElementById('rs-start-btn').onclick = startJob;
    document.getElementById('rs-refresh-btn').onclick = fetchState;
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
    document.getElementById('rs-close-preview-btn').onclick = () => {
        ResearchStore.setState({ selectedItemId: null });
    };

    document.getElementById('rs-accept-btn').onclick = () => {
        if (ResearchStore.state.selectedItemId) handleDisposition(ResearchStore.state.selectedItemId, 'accepted');
    };
    document.getElementById('rs-reject-btn').onclick = () => {
        if (ResearchStore.state.selectedItemId) handleDisposition(ResearchStore.state.selectedItemId, 'rejected');
    };
    document.getElementById('rs-rescrape-btn').onclick = () => {
        if (ResearchStore.state.selectedItemId) handleDisposition(ResearchStore.state.selectedItemId, 'force_scrape');
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
    ResearchStore.subscribe((state) => {
        // 0. Toggle Views & Global Back Button
        const globalBackBtn = document.getElementById('rs-global-back-btn');
        const subResearchActive = document.getElementById('sub-research') && document.getElementById('sub-research').classList.contains('active');

        if (state.selectedJobId) {
            if (state.aiTriageMode) {
                document.getElementById('rs-manual-triage').style.display = 'none';
                document.getElementById('rs-ai-triage').style.display = 'flex';
                document.getElementById('rs-toggle-ai-triage').innerText = '🔙 Back to Manual Triage';
                document.getElementById('rs-toggle-ai-triage').style.background = '#64748b';
            } else {
                document.getElementById('rs-manual-triage').style.display = 'flex';
                document.getElementById('rs-ai-triage').style.display = 'none';
                document.getElementById('rs-toggle-ai-triage').innerText = '🤖 AI-Assisted Batch Triage';
                document.getElementById('rs-toggle-ai-triage').style.background = '#a855f7';
            }

            document.getElementById('rs-view-jobs').classList.remove('active');
            document.getElementById('rs-view-detail').classList.add('active');
            if (globalBackBtn && subResearchActive) globalBackBtn.style.display = 'block';
            // Populate Job Header
            const activeJob = state.jobs.find(j => j.id === state.selectedJobId);
            if (activeJob) {
                let meta = {};
                try { meta = JSON.parse(activeJob.meta_json || '{}'); } catch(e) {}

                const safeDate = activeJob.created_at ? new Date(activeJob.created_at).toLocaleString() : 'Unknown Date';
                let statusColor = '#888';
                if (activeJob.status === 'running') statusColor = '#3b82f6';
                if (activeJob.status === 'gathering') statusColor = '#a855f7';
                if (activeJob.status === 'completed') statusColor = '#0ea5e9';
                if (activeJob.status === 'reviewed') statusColor = '#10b981';
                if (activeJob.status === 'failed') statusColor = '#dc2626';

                const safeQueryForClick = activeJob.query.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const dr = meta.date_range ? meta.date_range : 'Any Time';
                const parserUsed = meta.parser || 'jina';
                const targetDirUsed = meta.target_dir || state.targetDir || 'research/';

                let statusExtraDetail = `(${activeJob.processed_links}/${activeJob.total_links} scraped)`;
                if (activeJob.status === 'gathering') {
                    const pageNum = Math.floor((meta.start_index || 0) / 10) + 1;
                    statusExtraDetail = `(Page ${pageNum} - ${activeJob.total_links} found)`;
                }

                const headerEl = document.getElementById('rs-detail-header');

                if (headerEl.dataset.jobId !== activeJob.id) {
                    headerEl.dataset.jobId = activeJob.id;
                    headerEl.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                            <div style="font-weight: bold; color: #38bdf8; font-size: 1.15rem; word-break: break-word;">🔍 ${activeJob.query}</div>
                            <button class="btn-sm" style="background: transparent; border: 1px solid var(--border); color: var(--text); padding: 2px 8px; margin: 0; font-size: 0.8rem; white-space: nowrap; flex-shrink: 0;" onclick="navigator.clipboard.writeText('${safeQueryForClick}'); this.innerText='✅ Copied!'; setTimeout(()=>this.innerText='📋 Copy', 2000)">📋 Copy</button>
                        </div>

                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <span style="font-size: 0.95rem;"><b>Status:</b> <span id="rs-header-status-color" style="color: ${statusColor}; font-weight: bold;">${activeJob.status.toUpperCase()}</span> <span id="rs-header-status-text" style="color: #888;">${statusExtraDetail}</span></span>
                            <button id="rs-btn-expand-details" class="btn-sm" style="background: transparent; border: none; color: #a855f7; padding: 2px 8px; margin: 0; font-size: 0.85rem; font-weight: bold; cursor: pointer;">Show More ▼</button>
                        </div>

                        <div id="rs-header-expanded-details" style="display: none; flex-direction: column; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                            <div style="display: flex; gap: 15px; font-size: 0.85rem; color: #888; flex-wrap: wrap;">
                                <span><b>Provider:</b> <span style="color: var(--text);">${activeJob.provider}</span></span>
                                <span><b>Date Range:</b> <span style="color: var(--text);">${dr}</span></span>
                                <span><b>Started:</b> <span style="color: var(--text);">${safeDate}</span></span>
                            </div>

                            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;">
                                <div style="flex: 1; min-width: 200px;">
                                    <label style="font-weight: bold; font-size: 0.85rem; color: #888; display: block; margin-bottom: 4px;">Extraction Parser</label>
                                    <select id="rs-header-parser" style="width: 100%; padding: 6px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;">
                                        <option value="jina" ${parserUsed === 'jina' ? 'selected' : ''}>Jina AI (Rich Markdown)</option>
                                        <option value="bs4" ${parserUsed === 'bs4' ? 'selected' : ''}>Local (BeautifulSoup)</option>
                                    </select>
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <label style="font-weight: bold; font-size: 0.85rem; color: #888; display: block; margin-bottom: 4px;">Output Folder</label>
                                    <div style="display: flex; gap: 5px;">
                                        <input type="text" id="rs-header-target-dir" value="${targetDirUsed}" style="flex: 1; padding: 6px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.85rem;">
                                        <button id="btn-pick-rs-header-dir" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 6px 12px;" type="button">...</button>
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
            }
        } else {
            document.getElementById('rs-detail-header').dataset.jobId = '';
            document.getElementById('rs-view-jobs').classList.add('active');
            document.getElementById('rs-view-detail').classList.remove('active');
            if (globalBackBtn) globalBackBtn.style.display = 'none';
        }

        // 1. Render Jobs
        const jobsList = document.getElementById('rs-jobs-list');
        jobsList.innerHTML = '';
        state.jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.padding = '10px';
            card.style.cursor = 'pointer';

            let meta = {};
            try { meta = JSON.parse(job.meta_json || '{}'); } catch(e) {}
            let statusColor = '#888';
            if (job.status === 'running') statusColor = '#3b82f6';
            if (job.status === 'gathering') statusColor = '#a855f7';
            if (job.status === 'completed') statusColor = '#0ea5e9';
            if (job.status === 'reviewed') statusColor = '#10b981';
            if (job.status === 'failed') statusColor = '#dc2626';

            let actionHtml = '';
            if (job.status === 'gathering') {
                actionHtml = `<button class="btn-sm job-cancel" data-id="${job.id}" style="background: #dc2626; margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
            } else if (job.status === 'running') {
                actionHtml = `<button class="btn-sm job-pause" data-id="${job.id}" style="background: #f59e0b; margin:0; padding: 2px 8px;">⏸️ Pause</button>
                              <button class="btn-sm job-cancel" data-id="${job.id}" style="background: #dc2626; margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
            } else if (job.status === 'paused') {
                actionHtml = `<button class="btn-sm job-resume" data-id="${job.id}" style="background: #10b981; margin:0; padding: 2px 8px;">▶️ Resume</button>
                              <button class="btn-sm job-cancel" data-id="${job.id}" style="background: #dc2626; margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
            } else if (job.status === 'failed') {
                actionHtml = `<button class="btn-sm job-retry" data-id="${job.id}" style="background: #8b5cf6; margin:0; padding: 2px 8px;">🔄 Retry</button>
                              <button class="btn-sm job-cancel" data-id="${job.id}" style="background: #dc2626; margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
            }

            let errorHtml = '';
            if (job.status === 'failed' && meta.error) {
                errorHtml = `<div style="font-size: 0.8rem; color: #dc2626; background: #fef2f2; padding: 6px 10px; border-radius: 4px; margin-top: 8px; border: 1px solid #f87171;">⚠️ <b>Error:</b> ${meta.error}</div>`;
            }
            const safeDate = job.created_at ? new Date(job.created_at).toLocaleString() : 'Unknown Date';
            let cardStatusExtra = `(${job.processed_links}/${job.total_links} scraped)`;
            if (job.status === 'gathering') {
                const pageNum = Math.floor((meta.start_index || 0) / 10) + 1;
                cardStatusExtra = `(Page ${pageNum} - ${job.total_links} found)`;
            }

            const dr = meta.date_range ? meta.date_range : 'Any Time';

            card.innerHTML = `
                <div style="font-weight: bold; color: var(--text); font-size: 0.95rem; word-break: break-word;">🔍 ${job.query} <span style="font-weight: normal; font-size: 0.8rem; color: #888;">(${dr})</span></div>
                <div style="font-size: 0.75rem; color: #888; margin-top: 2px;">Created: ${safeDate}</div>
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

        // 2. Render Inbox
        const inboxList = document.getElementById('rs-inbox-list');
        inboxList.innerHTML = '';

        // Filter inbox by active job
        const activeInbox = state.selectedJobId ? state.inbox.filter(i => i.job_id === state.selectedJobId) : [];

        if (activeInbox.length === 0 && state.selectedJobId) {
            inboxList.innerHTML = '<span style="color: #888; font-style: italic;">No pending items for this job.</span>';
        } else {
            activeInbox.forEach(item => {
                const card = document.createElement('div');
                card.className = 'file-card';
                card.style.cursor = 'pointer';
                card.style.padding = '10px';
                if (state.selectedItemId === item.id) {
                    card.style.border = '2px solid #8b5cf6';
                }
                let dupHtml = '';
                if (item.status === 'duplicate') {
                    dupHtml = `<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.75rem; color: #f59e0b; font-weight: bold;">⚠️ Already Scraped</span>
                                <button class="btn-sm" style="background: transparent; border: 1px solid #f59e0b; color: #f59e0b; padding: 2px 8px; margin: 0; font-size: 0.7rem;" onclick="event.stopPropagation(); window.forceScrapeLink('${item.id}')">Force Scrape Anyway</button>
                                </div>`;
                } else if (item.status === 'in_library') {
                    dupHtml = `<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.75rem; color: #8b5cf6; font-weight: bold;">📚 In Library</span>
                                <button class="btn-sm" style="background: transparent; border: 1px solid #8b5cf6; color: #8b5cf6; padding: 2px 8px; margin: 0; font-size: 0.7rem;" onclick="event.stopPropagation(); window.forceScrapeLink('${item.id}')">Force Scrape Anyway</button>
                                </div>`;
                }
                const scrapedBadge = item.scraped_at ? '<span title="Extraction Complete" style="font-size: 0.8rem;">✅</span>' : '<span title="Waiting for extraction..." style="font-size: 0.8rem; opacity: 0.5;">⏳</span>';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 5px;">
                        <div style="font-weight: bold; color: var(--text); font-size: 0.9rem; word-wrap: break-word;">${item.title || 'Untitled'}</div>
                        <div style="flex-shrink: 0;">${scrapedBadge}</div>
                    </div>
                    <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.url}</div>
                    <div style="color: #555; font-family: monospace; font-size: 0.7rem; margin-top: 4px; user-select: all;">ID: ${item.id}</div>
                    ${dupHtml}
                `;
                card.onclick = () => ResearchStore.setState({ selectedItemId: item.id });
                inboxList.appendChild(card);
            });
        }
        // 3. Render Preview
        const titleEl = document.getElementById('rs-preview-title');
        const previewEl = document.getElementById('rs-markdown-preview');
        const controls = document.getElementById('rs-disposition-controls');
        const modalEl = document.getElementById('rs-preview-modal');

        const activeItem = state.inbox.find(i => i.id === state.selectedItemId);
        if (activeItem) {
            titleEl.innerHTML = `
                <div style="margin-bottom: 4px;">${activeItem.title || 'Untitled'}</div>
                <div style="margin-bottom: 4px;"><a href="${activeItem.url}" target="_blank" style="color: #3b82f6; font-size: 0.85rem; word-break: break-all; font-weight: normal; text-decoration: none;">🔗 ${activeItem.url}</a></div>
                <div style="color: #888; font-family: monospace; font-size: 0.75rem; font-weight: normal; user-select: all;">Item ID: ${activeItem.id}</div>
            `;
            controls.style.display = 'flex';
            modalEl.style.display = 'block';
            if (activeItem.raw_markdown) {
                previewEl.innerHTML = marked.parse(activeItem.raw_markdown);
            } else {
                previewEl.innerHTML = '<span style="color: #f59e0b; font-style: italic;">Awaiting extraction...</span>';
            }
            setTimeout(() => previewEl.focus(), 50);
        } else {
            if (modalEl) modalEl.style.display = 'none';
        }
    });
    // Auto-poll if there are running or gathering jobs
    setInterval(() => {
        if (ResearchStore.state.jobs.some(j => j.status === 'running' || j.status === 'gathering')) {
            fetchState();
        }
    }, 3000);

    // Initial load
    fetchState();
}