// ext_config.js - Workspace Configuration Editor Extension
import { AppStore } from '../store.js';

function renderExtensions() {
    const container = document.getElementById('config-editor-extensions');
    container.replaceChildren();
    const currentConfig = AppStore.getState().workspaceConfigForm || {};
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
        text.style.color = isConfig ? "var(--text-muted)" : "var(--text)";

        wrap.appendChild(cb);
        wrap.appendChild(text);
        container.appendChild(wrap);
    });
}
function renderRepos() {
    const container = document.getElementById('config-editor-repos');
    container.replaceChildren();

    const currentConfig = AppStore.getState().workspaceConfigForm || {};
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
                <button class="btn-sm btn-del-repo" data-idx="${idx}" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 4px 8px;">🗑️ Remove</button>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Title</label>
                    <input type="text" value="${repo.title || ''}" placeholder="Display Title" class="repo-title-input" data-idx="${idx}">
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Domain</label>
                    <input type="text" value="${repo.domain || ''}" placeholder="Category" class="repo-domain-input" data-idx="${idx}">
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Archive Type</label>
                    <select class="repo-archive-type" data-idx="${idx}" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border);">
                        <option value="repo" ${repo.archive_type === 'repo' || !repo.archive_type ? 'selected' : ''}>Standard Repo</option>
                        <option value="media-vault" ${repo.archive_type === 'media-vault' ? 'selected' : ''}>Media Vault</option>
                        <option value="prompt-library" ${repo.archive_type === 'prompt-library' ? 'selected' : ''}>Prompt Library</option>
                    </select>
                </div>
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Physical Path (Optional Override)</label>
                    <input type="text" value="${repo.physical_path || ''}" placeholder="/absolute/path/to/repo" class="repo-physical-input" data-idx="${idx}">
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Custom Out File (Optional)</label>
                    <input type="text" value="${repo.out_file || ''}" placeholder="custom_context.txt" class="repo-outfile-input" data-idx="${idx}">
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Tracked Extensions (comma separated)</label>
                <input type="text" value="${exts}" placeholder=".py, .js, .md" class="repo-exts-input" data-idx="${idx}">
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Ignore Directories (comma separated)</label>
                    <input type="text" value="${ignores}" placeholder="node_modules, build" class="repo-ignores-input" data-idx="${idx}">
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Ignore Files (comma separated)</label>
                    <input type="text" value="${ignoreFiles}" placeholder="package-lock.json" class="repo-ignorefiles-input" data-idx="${idx}">
                </div>
            </div>

            <div style="display: flex; gap: 15px; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border-radius: 4px; border: 1px solid var(--border);">
                <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" class="repo-exclude-ctx" data-idx="${idx}" ${repo.exclude_from_context ? 'checked' : ''}> Exclude from Context</label>
                <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" class="repo-exclude-diffs" data-idx="${idx}" ${repo.exclude_from_diffs ? 'checked' : ''}> Exclude from Diffs</label>
                <label style="font-size: 0.85rem; color: var(--text); cursor: pointer;"><input type="checkbox" class="repo-exclude-tracker" data-idx="${idx}" ${repo.exclude_from_tracker ? 'checked' : ''}> Exclude from Tracker</label>
            </div>

            <div style="background: var(--input-bg); padding: 10px; border-radius: 4px; border: 1px solid var(--border); margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-size: 0.85rem; font-weight: bold; color: var(--intent-highlight);">Sub-Buckets</label>
                    <button class="btn-sm btn-add-bucket" data-idx="${idx}" style="background: var(--intent-highlight); margin: 0; padding: 2px 8px; font-size: 0.75rem;">➕ Add Bucket</button>
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

    document.querySelectorAll('.repo-archive-type').forEach(el => el.onchange = (e) => currentConfig.target_repos[e.target.dataset.idx].archive_type = e.target.value);
    document.querySelectorAll('.repo-physical-input').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.idx].physical_path = e.target.value);
    document.querySelectorAll('.repo-outfile-input').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.idx].out_file = e.target.value);

    document.querySelectorAll('.repo-exclude-ctx').forEach(el => el.onchange = (e) => currentConfig.target_repos[e.target.dataset.idx].exclude_from_context = e.target.checked);
    document.querySelectorAll('.repo-exclude-diffs').forEach(el => el.onchange = (e) => currentConfig.target_repos[e.target.dataset.idx].exclude_from_diffs = e.target.checked);
    document.querySelectorAll('.repo-exclude-tracker').forEach(el => el.onchange = (e) => currentConfig.target_repos[e.target.dataset.idx].exclude_from_tracker = e.target.checked);

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
    container.replaceChildren();
    const currentConfig = AppStore.getState().workspaceConfigForm || {};
    const repo = currentConfig.target_repos[repoIdx];
    const buckets = repo.sub_buckets || [];

    if (buckets.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No sub-buckets defined.</span>';
        return;
    }

    buckets.forEach((b, bIdx) => {
        const isImplicit = !!b.dynamic_split_prefix;

        const card = document.createElement('div');
        card.style.cssText = "background: var(--bg); border: 1px solid var(--border); padding: 10px; border-radius: 4px; display: flex; flex-direction: column; gap: 8px;";

        const html = (() => {
            const baseHtml = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <select class="bucket-type-select" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding: 4px; font-size: 0.8rem; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); width: 200px;">
                        <option value="explicit" ${!isImplicit ? 'selected' : ''}>Explicit (Match Prefixes)</option>
                        <option value="implicit" ${isImplicit ? 'selected' : ''}>Implicit (Dynamic Folders)</option>
                    </select>
                    <button class="btn-sm btn-del-bucket" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="background: transparent; border: 1px solid var(--intent-danger); color: var(--intent-danger); margin: 0; padding: 2px 8px; font-size: 0.75rem;">🗑️</button>
                </div>
            `;
            if (!isImplicit) {
                const joinedPrefixes = (b.match_prefixes || []).join(', ');
                return baseHtml + `
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">ID</label><input type="text" value="${b.id || ''}" placeholder="my_bucket" class="b-id" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                        <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Title</label><input type="text" value="${b.title || ''}" placeholder="Display Name" class="b-title" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                        <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Domain</label><input type="text" value="${b.domain || ''}" placeholder="Category" class="b-domain" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 2;"><label style="font-size: 0.75rem; color:var(--text-muted);">Description</label><input type="text" value="${b.description || ''}" placeholder="What goes here?" class="b-desc" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                        <div style="flex: 1;"><label style="font-size: 0.75rem; color:var(--text-muted);">Custom Out File</label><input type="text" value="${b.out_file || ''}" placeholder="out_context.txt" class="b-outfile" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color:var(--text-muted);">Match Prefixes (comma separated)</label>
                        <input type="text" value="${joinedPrefixes}" placeholder="path/to/folder, other/path" class="b-prefixes" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;">
                    </div>
                    <div style="margin-top: 5px;">
                        <label style="font-size: 0.8rem; color: var(--text); cursor: pointer;"><input type="checkbox" class="b-catchall" data-ridx="${repoIdx}" data-bidx="${bIdx}" ${b.is_catch_all ? 'checked' : ''}> Designate as Catch-All Bucket</label>
                    </div>
                `;
            } else {
                const mmap = b.meta_map || {};
                const metaHtml = Object.keys(mmap).map((dirKey) => {
                    const meta = mmap[dirKey];
                    return `
                        <div style="display: flex; gap: 5px; align-items: center; background: var(--input-bg); padding: 5px; border-radius: 4px; flex-wrap: wrap;">
                            <input type="text" value="${dirKey}" placeholder="Folder Name" class="m-dir" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-oldkey="${dirKey}" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;">
                            <input type="text" value="${meta.title || ''}" placeholder="Title" class="m-title" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-oldkey="${dirKey}" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;">
                            <input type="text" value="${meta.domain || ''}" placeholder="Domain" class="m-domain" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-oldkey="${dirKey}" style="flex: 1; padding:4px; font-size:0.8rem; min-width: 100px;">
                            <button class="btn-sm btn-del-meta" data-ridx="${repoIdx}" data-bidx="${bIdx}" data-key="${dirKey}" style="background: transparent; color: var(--intent-danger); border: none; font-size: 1rem; padding: 0 5px; cursor: pointer;">×</button>
                        </div>
                    `;
                }).join('');

                return baseHtml + `
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1;">
                            <label style="font-size: 0.75rem; color:var(--text-muted);">Dynamic Split Prefix</label>
                            <input type="text" value="${b.dynamic_split_prefix || ''}" placeholder="e.g. . or docs/" class="b-dyn" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 0.75rem; color:var(--text-muted);">Shared Base Domain</label>
                            <input type="text" value="${b.domain || ''}" placeholder="e.g. Dynamic Modules" class="b-domain" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="padding:4px; font-size:0.8rem; width:100%; box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <label style="font-size: 0.75rem; color:var(--text-muted);">Meta Map (Folder Overrides)</label>
                            <button class="btn-sm btn-add-meta" data-ridx="${repoIdx}" data-bidx="${bIdx}" style="background: var(--intent-primary); margin: 0; padding: 2px 6px; font-size: 0.7rem;">+ Folder Meta</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            ${metaHtml}
                        </div>
                    </div>
                `;
            }
        })();

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

    container.querySelectorAll('.b-domain').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].domain = e.target.value);
    container.querySelectorAll('.b-desc').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].description = e.target.value);
    container.querySelectorAll('.b-outfile').forEach(el => el.oninput = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].out_file = e.target.value);
    container.querySelectorAll('.b-catchall').forEach(el => el.onchange = (e) => currentConfig.target_repos[e.target.dataset.ridx].sub_buckets[e.target.dataset.bidx].is_catch_all = e.target.checked);
    container.querySelectorAll('.btn-add-meta').forEach(btn => btn.onclick = (e) => {
        const r = e.target.dataset.ridx;
        const b = e.target.dataset.bidx;
        const mmap = currentConfig.target_repos[r].sub_buckets[b].meta_map || {};
        currentConfig.target_repos[r].sub_buckets[b].meta_map = mmap;
        const getNextFolderName = () => {
            const nextIdx = Object.keys(mmap).filter(k => k.startsWith('new_folder_')).length + 1;
            return `new_folder_${nextIdx}`;
        };
        mmap[getNextFolderName()] = { title: '', domain: '' };

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
export async function openConfigEditor() {
    try {
        const res = await fetch('/api/system/config');
        if (res.ok) {
            AppStore.setState({ workspaceConfigForm: await res.json() });

            const bodyHtml = `
                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 20px;">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: var(--intent-highlight);">Active Extensions</label>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Enable or disable system extensions. The 'config' extension is locked to prevent losing access to this menu.</p>
                    <div id="config-editor-extensions" style="display: flex; gap: 10px; flex-wrap: wrap;"></div>
                </div>

                <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 20px;">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.95rem; color: var(--intent-primary);">Target Repositories</label>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 15px;">Repositories dynamically map contexts and define your active multi-tenant workspace environments.</p>
                    <div id="config-editor-repos" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;"></div>
                    <button id="config-editor-add-repo" class="btn-sm" style="background: var(--intent-primary); margin: 0;">➕ Add Repository</button>
                </div>
            `;

            window.inSetu.ui.Factory.createModal({
                id: 'config-editor-modal',
                title: 'Workspace Configuration',
                body: bodyHtml,
                maxWidth: '800px',
                actions: [
                    { label: '💾 Save & Reload', style: 'primary', id: 'config-editor-save', onClick: async () => {
                        document.getElementById('config-editor-save').click();
                        return true;
                    }}
                ]
            });
            renderExtensions();
            renderRepos();
            document.getElementById('config-editor-add-repo').onclick = () => {
                const currentConfig = AppStore.getState().workspaceConfigForm;
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
                if (container) container.parentElement.scrollTo(0, container.parentElement.scrollHeight);
            };
                        document.getElementById('config-editor-save').onclick = async () => {
                            const btn = document.getElementById('config-editor-save');
                            const origText = btn.innerText;
                            btn.innerText = "⏳ Saving...";
                            const currentConfig = AppStore.getState().workspaceConfigForm;
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

        } else {
            alert("Failed to fetch configuration.");
        }
    } catch (e) {
        alert("Network error fetching config.");
    }
}

// Bind explicitly to the Event Zone for the Settings Modal
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerSettingsAction) {
    window.inSetu.extensions.Registry.registerSettingsAction('config_editor', 'Configure Workspace', '🛠️', openConfigEditor);
}