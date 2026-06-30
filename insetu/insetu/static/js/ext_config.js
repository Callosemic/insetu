// ext_config.js - Workspace Configuration Editor Extension

const CONFIG_MODAL_HTML = `
<div id="config-editor-modal" class="fullscreen-modal" style="z-index: 1200; display: none;">
    <div class="modal-content" style="max-height: 90vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin:0; font-size: 1.1rem;">Workspace Configuration</h3>
            <div style="display: flex; gap: 10px;">
                <button id="config-editor-save" class="btn-sm" style="background: #10b981; margin: 0;">💾 Save & Reload</button>
                <button onclick="document.getElementById('config-editor-modal').style.display='none'" class="btn-sm" style="background: #dc2626; margin: 0;">Close</button>
            </div>
        </div>
        
        <div style="flex: 1; overflow-y: auto; padding-right: 10px;">
            <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 20px;">
                <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: #38bdf8;">Target Repositories</label>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0; margin-bottom: 15px;">Repositories dynamically map contexts and define your active multi-tenant workspace environments.</p>
                <div id="config-editor-repos" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;"></div>
                <button id="config-editor-add-repo" class="btn-sm" style="background: #3b82f6; margin: 0;">➕ Add Repository</button>
            </div>
        </div>
    </div>
</div>
`;

document.body.insertAdjacentHTML('beforeend', CONFIG_MODAL_HTML);

let currentConfig = {};

function renderRepos() {
    const container = document.getElementById('config-editor-repos');
    container.innerHTML = '';
    
    const repos = currentConfig.target_repos || [];
    repos.forEach((repo, idx) => {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '10px';
        card.style.background = 'var(--bg)';
        
        const exts = (repo.exts || []).join(', ');
        const ignores = (repo.repo_ignore_dirs || []).join(', ');
        const ignoreFiles = (repo.repo_ignore_files || []).join(', ');
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2rem;">📦</span>
                    <input type="text" value="${repo.repo_dir || ''}" placeholder="Directory Name (e.g. my-repo)" class="repo-dir-input" data-idx="${idx}" style="font-weight: bold; width: 60%; background: var(--input-bg);">
                </div>
                <button class="btn-sm btn-del-repo" data-idx="${idx}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; margin: 0; padding: 4px 8px;">🗑️ Remove</button>
            </div>
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: #888;">Title</label>
                    <input type="text" value="${repo.title || ''}" placeholder="Display Title" class="repo-title-input" data-idx="${idx}">
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: #888;">Domain</label>
                    <input type="text" value="${repo.domain || ''}" placeholder="Category" class="repo-domain-input" data-idx="${idx}">
                </div>
            </div>
            
            <div>
                <label style="font-size: 0.8rem; color: #888;">Tracked Extensions (comma separated)</label>
                <input type="text" value="${exts}" placeholder=".py, .js, .md" class="repo-exts-input" data-idx="${idx}">
            </div>
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: #888;">Ignore Directories (comma separated)</label>
                    <input type="text" value="${ignores}" placeholder="node_modules, build" class="repo-ignores-input" data-idx="${idx}">
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: #888;">Ignore Files (comma separated)</label>
                    <input type="text" value="${ignoreFiles}" placeholder="package-lock.json" class="repo-ignorefiles-input" data-idx="${idx}">
                </div>
            </div>
            
            <div style="background: var(--input-bg); padding: 10px; border-radius: 4px; border: 1px solid var(--border); margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <label style="font-size: 0.85rem; font-weight: bold; color: #a855f7;">Sub-Buckets (JSON Definition)</label>
                </div>
                <textarea class="repo-buckets-input" data-idx="${idx}" style="height: 120px; font-family: monospace; font-size: 0.8rem; margin: 0; background: var(--bg);">${JSON.stringify(repo.sub_buckets || [], null, 2)}</textarea>
            </div>
        `;
        container.appendChild(card);
    });

    // Attach explicit mutators to preserve structure while editing
    document.querySelectorAll('.repo-dir-input').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.idx].repo_dir = e.target.value);
    document.querySelectorAll('.repo-title-input').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.idx].title = e.target.value);
    document.querySelectorAll('.repo-domain-input').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.idx].domain = e.target.value);
    
    document.querySelectorAll('.repo-exts-input').forEach(el => el.oninput = (e) => {
        currentConfig.target_repos[e.target.dataset.idx].exts = e.target.value.split(',').map(s => s.trim()).filter(s => s);
    });
    
    document.querySelectorAll('.repo-ignores-input').forEach(el => el.oninput = (e) => {
        currentConfig.target_repos[e.target.dataset.idx].repo_ignore_dirs = e.target.value.split(',').map(s => s.trim()).filter(s => s);
    });
    
    document.querySelectorAll('.repo-ignorefiles-input').forEach(el => el.oninput = (e) => {
        currentConfig.target_repos[e.target.dataset.idx].repo_ignore_files = e.target.value.split(',').map(s => s.trim()).filter(s => s);
    });
    
    document.querySelectorAll('.repo-buckets-input').forEach(el => el.onchange = (e) => {
        try {
            currentConfig.target_repos[e.target.dataset.idx].sub_buckets = JSON.parse(e.target.value);
            e.target.style.borderColor = 'var(--border)';
        } catch (err) {
            e.target.style.borderColor = '#ef4444';
        }
    });
    
    document.querySelectorAll('.btn-del-repo').forEach(el => el.onclick = (e) => {
        if(confirm("Remove this repository from tracking?")) {
            currentConfig.target_repos.splice(e.target.dataset.idx, 1);
            renderRepos();
        }
    });
}

document.getElementById('config-editor-add-repo').onclick = () => {
    if (!currentConfig.target_repos) currentConfig.target_repos = [];
    currentConfig.target_repos.push({ 
        repo_dir: '', 
        title: '', 
        domain: 'Workspaces', 
        exts: ['.py', '.json', '.md', '.txt'], 
        apply_ignore: true,
        sub_buckets: [] 
    });
    renderRepos();
    const container = document.getElementById('config-editor-repos');
    container.scrollTo(0, container.scrollHeight);
};

document.getElementById('config-editor-save').onclick = async () => {
    const btn = document.getElementById('config-editor-save');
    const origText = btn.innerText;
    btn.innerText = "⏳ Saving...";
    try {
        const res = await fetch('/api/system/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentConfig)
        });
        if (res.ok) {
            window.location.reload();
        } else {
            const data = await res.json();
            alert("Failed to save: " + data.error);
            btn.innerText = origText;
        }
    } catch (e) {
        alert("Network error: " + e.message);
        btn.innerText = origText;
    }
};

export async function openConfigEditor() {
    try {
        const res = await fetch('/api/system/config');
        if (res.ok) {
            currentConfig = await res.json();
            renderRepos();
            document.getElementById('config-editor-modal').style.display = 'block';
        } else {
            alert("Failed to fetch configuration.");
        }
    } catch (e) {
        alert("Network error fetching config.");
    }
}

// Bind explicitly to the Event Zone for the Settings Modal
if (window.ExtensionRegistry && window.ExtensionRegistry.registerSettingsAction) {
    window.ExtensionRegistry.registerSettingsAction('config_editor', 'Configure Workspace', '🛠️', openConfigEditor);
}