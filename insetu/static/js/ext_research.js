import { executeWorkspaceMutation } from './app.js';

// --- UDF STATE STORE ---
const ResearchStore = {
    state: {
        jobs: [],
        inbox: [],
        selectedItemId: null,
        targetDir: 'research/'
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
                display: flex; gap: 15px; height: calc(100vh - 180px); overflow: hidden;
            }
            .rs-pane {
                display: flex; flex-direction: column; overflow-y: auto;
            }
            .rs-pane-1 { flex: 1; min-width: 280px; gap: 15px; border-right: 1px solid var(--border); padding-right: 15px; }
            .rs-pane-2 { flex: 1; min-width: 250px; gap: 10px; border-right: 1px solid var(--border); padding-right: 15px; }
            .rs-pane-3 { flex: 2; min-width: 300px; }

            @media (max-width: 768px) {
                .rs-layout {
                    flex-direction: column;
                    height: auto;
                    overflow: visible;
                }
                .rs-pane-1, .rs-pane-2 {
                    border-right: none;
                    border-bottom: 1px solid var(--border);
                    padding-right: 0;
                    padding-bottom: 15px;
                    min-height: 400px;
                }
                .rs-pane-3 {
                    min-height: 500px;
                }
            }
        </style>
        <div class="rs-layout">

            <div class="rs-pane rs-pane-1">
                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                    <h3 style="margin-top: 0; color: #38bdf8;">New Research Job</h3>
                    <input type="text" id="rs-query" placeholder="Search Query..." style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <select id="rs-provider" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                            <option value="duckduckgo">DuckDuckGo</option>
                            <option value="google">Google (Stub)</option>
                        </select>
                        <select id="rs-date-range" style="flex: 1; padding: 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                            <option value="">Any Time</option>
                            <option value="d">Past Day</option>
                            <option value="w">Past Week</option>
                            <option value="m">Past Month</option>
                            <option value="y">Past Year</option>
                            <option value="custom">Custom Range...</option>
                        </select>
                    </div>
                    <div id="rs-custom-dates" style="display: none; gap: 10px; margin-bottom: 10px;">
                        <input type="date" id="rs-date-start" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                        <input type="date" id="rs-date-end" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
                    </div>
                    <button id="rs-start-btn" class="btn-sm" style="background: #8b5cf6; width: 100%; margin: 0; padding: 10px; font-weight: bold;">🚀 Start Scraping</button>
                </div>
                
                <h4 style="margin: 0; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 5px;">Active & Past Jobs</h4>
                <div id="rs-jobs-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
            <div class="rs-pane rs-pane-2">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 5px;">
                    <h4 style="margin: 0; color: var(--text);">Triage Inbox</h4>
                    <button id="rs-refresh-btn" class="btn-sm" style="background: transparent; color: var(--text); border: 1px solid var(--border); margin: 0; padding: 2px 8px;">🔄 Refresh</button>
                </div>
                <div id="rs-inbox-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
            </div>
            <div class="rs-pane rs-pane-3">
                <div id="rs-preview-pane" style="display: flex; flex-direction: column; height: 100%; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border);">
                    <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px;">
                        <span id="rs-preview-title" style="font-weight: bold; color: #a855f7; font-size: 1.1rem;">No item selected</span>
                        
                        <div id="rs-disposition-controls" style="display: none; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <input type="text" id="rs-target-dir" value="research/" placeholder="Target path (e.g. research/)" style="flex: 1; padding: 6px; font-family: monospace;">
                            <button id="rs-accept-btn" class="btn-sm" style="background: #10b981; margin: 0;">✅ Accept to Workspace</button>
                            <button id="rs-reject-btn" class="btn-sm" style="background: #dc2626; margin: 0;">🗑️ Reject</button>
                        </div>
                    </div>
                    <div id="rs-markdown-preview" style="flex: 1; overflow-y: auto; padding: 15px; font-size: 0.95rem;">
                        <span style="color: #888; font-style: italic;">Select a pending URL from the inbox to preview its scraped content here.</span>
                    </div>
                </div>
            </div>

        </div>
    `;

    // --- ACTIONS ---
    const fetchState = async () => {
        try {
            const [jRes, iRes] = await Promise.all([
                fetch('/api/research/jobs'),
                fetch('/api/research/inbox?status=pending')
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
        let dateRange = document.getElementById('rs-date-range').value;

        if (dateRange === 'custom') {
            const start = document.getElementById('rs-date-start').value;
            const end = document.getElementById('rs-date-end').value;
            if (!start || !end) return alert("Both start and end dates are required for a custom range.");
            dateRange = `${start}..${end}`;
        }

        if (!query) return alert("Query required.");

        const btn = document.getElementById('rs-start-btn');
        btn.innerText = "⏳ Starting...";
        try {
            const res = await fetch('/api/research/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, provider, max_results: 10, date_range: dateRange })
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

            // Physically save to workspace first
            const success = await executeWorkspaceMutation('/api/fs/save', {
                filepath: filepath,
                content: item.raw_markdown
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
    document.getElementById('rs-start-btn').onclick = startJob;
    document.getElementById('rs-refresh-btn').onclick = fetchState;

    document.getElementById('rs-date-range').addEventListener('change', (e) => {
        document.getElementById('rs-custom-dates').style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });

    document.getElementById('rs-accept-btn').onclick = () => {
        if (ResearchStore.state.selectedItemId) handleDisposition(ResearchStore.state.selectedItemId, 'accepted');
    };
    document.getElementById('rs-reject-btn').onclick = () => {
        if (ResearchStore.state.selectedItemId) handleDisposition(ResearchStore.state.selectedItemId, 'rejected');
    };

    // --- RENDERERS (Subscribed to UDF Store) ---
    ResearchStore.subscribe((state) => {
        
        // 1. Render Jobs
        const jobsList = document.getElementById('rs-jobs-list');
        jobsList.innerHTML = '';
        state.jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.padding = '10px';
            
            let statusColor = '#888';
            if (job.status === 'running') statusColor = '#3b82f6';
            if (job.status === 'completed') statusColor = '#10b981';
            if (job.status === 'failed') statusColor = '#dc2626';

            let actionHtml = '';
            if (job.status === 'running') {
                actionHtml = `<button class="btn-sm job-pause" data-id="${job.id}" style="background: #f59e0b; margin:0; padding: 2px 8px;">⏸️ Pause</button>
                              <button class="btn-sm job-cancel" data-id="${job.id}" style="background: #dc2626; margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
            } else if (job.status === 'paused') {
                actionHtml = `<button class="btn-sm job-resume" data-id="${job.id}" style="background: #10b981; margin:0; padding: 2px 8px;">▶️ Resume</button>
                              <button class="btn-sm job-cancel" data-id="${job.id}" style="background: #dc2626; margin:0; padding: 2px 8px;">🗑️ Cancel</button>`;
            }

            card.innerHTML = `
                <div style="font-weight: bold; color: var(--text); font-size: 0.95rem;">🔍 ${job.query}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                    <span style="font-size: 0.8rem; color: ${statusColor};">Status: ${job.status.toUpperCase()} (${job.processed_links}/${job.total_links})</span>
                    <div style="display: flex; gap: 5px;">${actionHtml}</div>
                </div>
            `;
            jobsList.appendChild(card);
        });

        // Re-bind dynamically generated job buttons
        document.querySelectorAll('.job-pause').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'pause'));
        document.querySelectorAll('.job-resume').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'resume'));
        document.querySelectorAll('.job-cancel').forEach(btn => btn.onclick = (e) => handleJobAction(e.target.dataset.id, 'cancel'));

        // 2. Render Inbox
        const inboxList = document.getElementById('rs-inbox-list');
        inboxList.innerHTML = '';
        if (state.inbox.length === 0) {
            inboxList.innerHTML = '<span style="color: #888; font-style: italic;">No pending items.</span>';
        } else {
            state.inbox.forEach(item => {
                const card = document.createElement('div');
                card.className = 'file-card';
                card.style.cursor = 'pointer';
                card.style.padding = '10px';
                if (state.selectedItemId === item.id) {
                    card.style.border = '2px solid #8b5cf6';
                }

                card.innerHTML = `
                    <div style="font-weight: bold; color: var(--text); font-size: 0.9rem; word-wrap: break-word;">${item.title || 'Untitled'}</div>
                    <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.url}</div>
                `;
                card.onclick = () => ResearchStore.setState({ selectedItemId: item.id });
                inboxList.appendChild(card);
            });
        }

        // 3. Render Preview
        const titleEl = document.getElementById('rs-preview-title');
        const previewEl = document.getElementById('rs-markdown-preview');
        const controls = document.getElementById('rs-disposition-controls');

        const activeItem = state.inbox.find(i => i.id === state.selectedItemId);

        if (activeItem) {
            titleEl.innerText = activeItem.title || 'Untitled';
            controls.style.display = 'flex';
            
            if (activeItem.raw_markdown) {
                previewEl.innerHTML = marked.parse(activeItem.raw_markdown);
            } else {
                previewEl.innerHTML = '<span style="color: #f59e0b; font-style: italic;">Awaiting extraction...</span>';
            }
        } else {
            titleEl.innerText = 'No item selected';
            controls.style.display = 'none';
            previewEl.innerHTML = '<span style="color: #888; font-style: italic;">Select a pending URL from the inbox to preview its scraped content here.</span>';
        }
    });

    // Auto-poll if there are running jobs
    setInterval(() => {
        if (ResearchStore.state.jobs.some(j => j.status === 'running')) {
            fetchState();
        }
    }, 5000);

    // Initial load
    fetchState();
}