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
                <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: #a855f7;">Active Extensions</label>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0; margin-bottom: 10px;">Enable or disable system extensions. The 'config' extension is locked to prevent losing access to this menu.</p>
                <div id="config-editor-extensions" style="display: flex; gap: 10px; flex-wrap: wrap;"></div>
            </div>

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

function renderExtensions() {
    const container = document.getElementById('config-editor-extensions');
    container.innerHTML = '';
    if (!currentConfig.extensions) currentConfig.extensions = ['config'];
    // Dynamically load available extensions from the backend payload
    const knownExtensions = currentConfig._available_extensions || [];
    const allExtensions = Array.from(new Set([...knownExtensions, ...(currentConfig.extensions || [])])).sort();

    allExtensions.forEach(ext => {
        const isConfig = ext === 'config';
        const isChecked = currentConfig.extensions.includes(ext) || isConfig;

        const wrap = document.createElement('label');
        wrap.style.cssText = "display: flex; align-items: center; gap: 8px; background: var(--bg); padding: 8px 12px; border: 1px solid var(--border); border-radius: 4px; cursor: pointer;";

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = ext;
        cb.checked = isChecked;
        if (isConfig) cb.disabled = true;

        cb.onchange = (e) => {
            if (e.target.checked) {
                if (!currentConfig.extensions.includes(ext)) currentConfig.extensions.push(ext);
            } else {
                currentConfig.extensions = currentConfig.extensions.filter(x => x !== ext);
            }
        };

        const text = document.createElement('span');
        text.innerText = ext;
        text.style.fontWeight = "bold";
        text.style.fontSize = "0.9rem";
        text.style.color = isConfig ? "#888" : "var(--text)";

        wrap.appendChild(cb);
        wrap.appendChild(text);
        container.appendChild(wrap);
    });
}

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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-size: 0.85rem; font-weight: bold; color: #a855f7;">Sub-Buckets</label>
                    <button class="btn-sm btn-add-bucket" data-idx="${idx}" style="background: #a855f7; margin: 0; padding: 2px 8px; font-size: 0.75rem;">➕ Add Bucket</button>
                </div>
                <div id="sub-buckets-container-${idx}" style="display: flex; flex-direction: column; gap: 10px;"></div>
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

    document.querySelectorAll('.btn-add-bucket').forEach(btn => btn.onclick = (e) => {
        const idx = e.target.dataset.idx;
        if (!currentConfig.target_repos[idx].sub_buckets) currentConfig.target_repos[idx].sub_buckets = [];
        currentConfig.target_repos[idx].sub_buckets.push({ id: 'new_bucket', title: '', match_prefixes: [] });
        renderSubBuckets(idx);
    });

    document.querySelectorAll('.btn-del-repo').forEach(el => el.onclick = (e) => {
        if(confirm("Remove this repository from tracking?")) {
            currentConfig.target_repos.splice(e.target.dataset.idx, 1);
            renderRepos();
        }
    });

    repos.forEach((r, idx) => renderSubBuckets(idx));
}

function renderSubBuckets(repoIdx) {
    const container = document.getElementById(`sub-buckets-container-${repoIdx}`);
    if (!container) return;
    container.innerHTML = '';
    const repo = currentConfig.target_repos[repoIdx];
    const buckets = repo.sub_buckets || [];

    if (buckets.length === 0) {
        container.innerHTML = '<span style="color: #888; font-size: 0.8rem; font-style: italic;">No sub-buckets defined.</span>';
        return;
    }

    buckets.forEach((b, bIdx) => {
        const isImplicit = !!b.dynamic_split_prefix;

        const card = document.createElement('div');
        card.style.cssText = "background: var(--bg); border: 1px solid var(--border); padding: 10px; border-radius: 4px; display: flex; flex-direction: column; gap: 8px;";

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <select class="bucket-type-select" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding: 4px; font-size: 0.8rem; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); width: 200px;">
                    <option value="explicit" ${!isImplicit ? 'selected' : ''}>Explicit (Match Prefixes)</option>
                    <option value="implicit" ${isImplicit ? 'selected' : ''}>Implicit (Dynamic Folders)</option>
                </select>
                <button class="btn-sm btn-del-bucket" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; margin: 0; padding: 2px 8px; font-size: 0.75rem;">🗑️</button>
            </div>
        `;

        if (!isImplicit) {
            html += `
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1;"><label style="font-size: 0.75rem; color:#888;">ID</label><input type="text" value="${b.id || ''}" placeholder="my_bucket" class="b-id" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                    <div style="flex: 1;"><label style="font-size: 0.75rem; color:#888;">Title</label><input type="text" value="${b.title || ''}" placeholder="Display Name" class="b-title" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                </div>
                <div>
                    <label style="font-size: 0.75rem; color:#888;">Match Prefixes (comma separated)</label>
                    <input type="text" value="${(b.match_prefixes || []).join(', ')}" placeholder="path/to/folder, other/path" class="b-prefixes" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;">
                </div>
            `;
        } else {
            let metaHtml = '';
            const mmap = b.meta_map || {};
            Object.keys(mmap).forEach((dirKey) => {
                const meta = mmap[dirKey];
                metaHtml += `
                    <div style="display: flex; gap: 5px; align-items: center; background: var(--input-bg); padding: 5px; border-radius: 4px; flex-wrap: wrap;">
                        <input type="text" value="${dirKey}" placeholder="Folder Name" class="m-dir" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-oldkey="${dirKey}" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;">
                        <input type="text" value="${meta.title || ''}" placeholder="Title" class="m-title" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-oldkey="${dirKey}" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;">
                        <input type="text" value="${meta.domain || ''}" placeholder="Domain" class="m-domain" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-oldkey="${dirKey}" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;">
                        <button class="btn-sm btn-del-meta" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-key="${dirKey}" style="background: transparent; color: #ef4444; border: none; font-size: 1rem; padding: 0 5px; cursor: pointer;">×</button>
                    </div>
                `;
            });

            html += `
                <div>
                    <label style="font-size: 0.75rem; color:#888;">Dynamic Split Prefix</label>
                    <input type="text" value="${b.dynamic_split_prefix || ''}" placeholder="e.g. . or docs/" class="b-dyn" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;">
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <label style="font-size: 0.75rem; color:#888;">Meta Map (Folder Overrides)</label>
                        <button class="btn-sm btn-add-meta" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="background: #3b82f6; margin: 0; padding: 2px 6px; font-size: 0.7rem;">+ Folder Meta</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        ${metaHtml}
                    </div>
                </div>
            `;
        }

        card.innerHTML = html;
        container.appendChild(card);
    });

    container.querySelectorAll('.bucket-type-select').forEach(sel => sel.onchange = (e) => {
        const r = e.target.dataset.ridx;
        const b = e.target.dataset.bidx;
        if (e.target.value === 'implicit') {
            currentConfig.target_repos[r].sub_buckets[b] = { dynamic_split_prefix: '.', meta_map: {} };
        } else {
            currentConfig.target_repos[r].sub_buckets[b] = { id: 'new_bucket', title: '', match_prefixes: [] };
        }
        renderSubBuckets(r);
    });

    container.querySelectorAll('.btn-del-bucket').forEach(btn => btn.onclick = (e) => {
        currentConfig.target_repos[e.target.dataset.ridx].sub_buckets.splice(e.target.dataset.bidx, 1);
        renderSubBuckets(e.target.dataset.ridx);
    });

    container.querySelectorAll('.b-id').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].id = e.target.value);
    container.querySelectorAll('.b-title').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].title = e.target.value);
    container.querySelectorAll('.b-prefixes').forEach(el => el.oninput = (e) => {
        currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].match_prefixes = e.target.value.split(',').map(s => s.trim()).filter(s => s);
    });

    container.querySelectorAll('.b-dyn').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].dynamic_split_prefix = e.target.value);

    container.querySelectorAll('.btn-add-meta').forEach(btn => btn.onclick = (e) => {
        const r = e.target.dataset.ridx;
        const b = e.target.dataset.bidx;
        const mmap = currentConfig.target_repos[r].sub_buckets[b].meta_map || {};
        currentConfig.target_repos[r].sub_buckets[b].meta_map = mmap;
        let n = 1;
        while (mmap[`new_folder_${n}`]) n++;
        mmap[`new_folder_${n}`] = { title: '', domain: '' };
        renderSubBuckets(r);
    });

    container.querySelectorAll('.btn-del-meta').forEach(btn => btn.onclick = (e) => {
        const r = e.target.dataset.ridx;
        const b = e.target.dataset.bidx;
        delete currentConfig.target_repos[r].sub_buckets[b].meta_map[e.target.dataset.key];
        renderSubBuckets(r);
    });

    const updateMetaKey = (e, field) => {
        const r = e.target.dataset.ridx;
        const b = e.target.dataset.bidx;
        const oldKey = e.target.dataset.oldkey;
        const mmap = currentConfig.target_repos[r].sub_buckets[b].meta_map;

        if (field === 'key') {
            const newKey = e.target.value;
            if (newKey && newKey !== oldKey && !mmap[newKey]) {
                mmap[newKey] = mmap[oldKey];
                delete mmap[oldKey];
                e.target.dataset.oldkey = newKey; 
            }
        } else {
            mmap[oldKey][field] = e.target.value;
        }
    };

    container.querySelectorAll('.m-dir').forEach(el => el.onchange = (e) => {
        updateMetaKey(e, 'key');
        renderSubBuckets(e.target.dataset.ridx);
    });
    container.querySelectorAll('.m-title').forEach(el => el.oninput = (e) => updateMetaKey(e, 'title'));
    container.querySelectorAll('.m-domain').forEach(el => el.oninput = (e) => updateMetaKey(e, 'domain'));
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
            renderExtensions();
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