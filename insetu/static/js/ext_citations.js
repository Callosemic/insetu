import { TARGET_CONFIGS, mdeInstance } from './app.js';
import { currentModalIsFS } from './fs.js';
import { openSelectorModal } from './ui.js';

const libraryScreen = window.ExtensionRegistry.registerTab('library', 'Library');
if (libraryScreen) {
    libraryScreen.innerHTML = `
        <style>
            .cit-card-wrapper {
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .cit-card-actions {
                order: 2;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border);
                display: flex;
                gap: 6px;
                justify-content: flex-end;
                flex-wrap: wrap;
            }
            @media (min-width: 768px) {
                .cit-card-actions {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    margin-top: 0;
                    padding-top: 0;
                    border-top: none;
                }
                .cit-title-push {
                    padding-right: 230px; /* Prevent title from sliding under buttons on desktop */
                }
            }
        </style>
        <div class="sub-tabs-bar">
            <div class="sub-tabs">
                <div class="sub-tab active" id="st-lib-main" onclick="switchSubTab('lib-main')">Main</div>
                <div class="sub-tab" id="st-lib-explore" onclick="switchSubTab('lib-explore')">Explore</div>
                <div class="sub-tab" id="st-lib-import" onclick="switchSubTab('lib-import')">Import</div>
            </div>
        </div>
        <div id="sub-lib-main" class="sub-tab-content active" style="height: 100%;">
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div id="lib-repo-pins" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;"></div>
                <div id="lib-bucket-pins" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 15px;"></div>
                <input type="text" id="lib-main-search" placeholder="Search personal library..." style="width: 100%; padding: 8px 10px; margin-bottom: 15px;">
                <div id="lib-main-loading" class="spinner" style="display: block;">Loading library...</div>
                <div id="lib-main-list" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1;"></div>
            </div>
        </div>
        <div id="sub-lib-explore" class="sub-tab-content" style="height: 100%;">
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 15px; background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border);">
                    <div>
                        <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Catalog Source</label>
                        <select id="lib-explore-source" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border); font-weight: bold;">
                            <option value="openalex">OpenAlex (Recommended)</option>
                            <option value="crossref">Crossref (DOIs & Exact Titles)</option>
                            <option value="semanticscholar">Semantic Scholar</option>
                        </select>
                    </div>

                    <div id="wrap-explore-query">
                        <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Search Query</label>
                        <input type="text" id="lib-explore-search" placeholder="Keywords, titles, or authors..." style="width: 100%; padding: 8px 10px; box-sizing: border-box; margin: 0;">
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div id="wrap-explore-field" style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Target Field</label>
                            <select id="lib-explore-field" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border);">
                                <option value="all">All Fields</option>
                                <option value="title">Title Only</option>
                            </select>
                        </div>

                        <div id="wrap-explore-category" style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:#a855f7; display:block; margin-bottom:4px;">Topic Filter</label>
                            <input type="text" id="lib-explore-category" placeholder="e.g., Ethnomusicology..." style="width: 100%; padding: 8px 10px; box-sizing: border-box; margin: 0; border-color: #a855f7;">
                        </div>
                    </div>

                    <button id="btn-explore-search" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 10px; font-size: 1rem;">🔍 Search Catalog</button>
                </div>
                <div id="lib-explore-loading" class="spinner" style="display: none;">Querying global catalogs...</div>
                <div id="lib-explore-list" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1;">
                    <p style="color: #888; font-style: italic;">Search the open science index to discover and import citations.</p>
                </div>
            </div>
        </div>

        <div id="sub-lib-import" class="sub-tab-content" style="height: 100%;">
            <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 15px;">
                <h3 style="margin-top: 0; color: #38bdf8;">Import CSL-JSON</h3>
                <p style="font-size: 0.9rem; color: #888;">Select a JSON export from Zotero or Better BibTeX.</p>
                
                <div style="margin: 15px 0;">
                    <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 5px;">Conflict Strategy:</label>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem;">
                        <label><input type="radio" name="lib-merge-strat" value="overwrite" checked> Overwrite Existing</label>
                        <label><input type="radio" name="lib-merge-strat" value="skip"> Skip Existing</label>
                        <label><input type="radio" name="lib-merge-strat" value="manual"> Manual Resolve</label>
                    </div>
                </div>
                
                <button id="btn-trigger-file" class="btn-sm" style="background: #10b981; margin: 0; padding: 8px 16px;">📁 Choose File</button>
                <input type="file" id="lib-file-picker" accept=".json,application/json" style="display: none;">
            </div>
                <div id="lib-import-log" style="font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; color: var(--text);"></div>
            </div>
        </div>

        <div id="lib-attach-modal" class="fullscreen-modal" style="z-index: 1090;">
            <div class="modal-content" style="max-height: 500px; height: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin:0; font-size: 1.1rem;">Attach: <span id="attach-ref-id" style="color: #8b5cf6; font-family: monospace;"></span></h3>
                    <button onclick="document.getElementById('lib-attach-modal').style.display='none'" class="btn-sm" style="background: #dc2626; margin: 0;">Close</button>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <select id="attach-repo-select" style="flex:1; padding:8px; border-radius:4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"></select>
                    <select id="attach-bucket-select" style="flex:1; padding:8px; border-radius:4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"></select>
                    <button id="btn-add-attachment" class="btn-sm" style="background:#10b981; margin: 0;">➕ Add</button>
                </div>
                <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:5px;">Current Attachments:</label>
                <div id="current-attachments-list" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; overflow-y: auto; flex: 1;"></div>
            </div>
        </div>
        <div id="edit-citation-modal" class="fullscreen-modal" style="z-index: 1090;">
            <div class="modal-content" style="max-height: 85vh; height: auto; display: flex; flex-direction: column; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin:0; font-size: 1.1rem;">Edit: <span id="edit-ref-id" style="color: #f59e0b; font-family: monospace;"></span></h3>
                    <button onclick="document.getElementById('edit-citation-modal').style.display='none'" class="btn-sm" style="background: #dc2626; margin: 0;">Cancel</button>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Type:</label>
                        <select id="edit-cit-type" style="width: 100%; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;">
                            <option value="article-journal">Journal Article</option>
                            <option value="book">Book</option>
                            <option value="chapter">Book Chapter</option>
                            <option value="paper-conference">Conference Paper</option>
                            <option value="article-magazine">Magazine Article</option>
                            <option value="article-newspaper">Newspaper Article</option>
                            <option value="webpage">Webpage</option>
                            <option value="thesis">Thesis</option>
                            <option value="report">Report</option>
                            <option value="document">Document (Generic)</option>
                        </select>
                    </div>
                </div>
                <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Item Title:</label>
                <input type="text" id="edit-cit-title" style="width: 100%; padding: 8px; margin-bottom: 12px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;">

                <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Publication Title <span style="font-weight:normal;">(e.g., Journal Name)</span>:</label>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <input type="text" id="edit-cit-pub-title" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;">
                    <button id="btn-pick-pub" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 8px 12px;" type="button">...</button>
                </div>

                <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Authors:</label>
                <div id="edit-cit-author-pills" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;"></div>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <input type="text" id="edit-cit-author-input" placeholder="Last, First" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;">
                    <button id="btn-pick-author" class="btn-sm" style="background: #8b5cf6; margin: 0; padding: 8px 12px;" type="button">...</button>
                    <button id="btn-add-cit-author" class="btn-sm" style="background: #3b82f6; margin: 0; padding: 8px 12px;" type="button">➕ Add</button>
                </div>

                <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:4px;">Date <span style="font-weight:normal;">(YYYY or YYYY-MM-DD)</span>:</label>
                <input type="text" id="edit-cit-date" style="width: 100%; padding: 8px; margin-bottom: 15px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;">

                <label style="font-weight:bold; font-size:0.85rem; color:#888; display:block; margin-bottom:5px;">Other Metadata (CSL-JSON):</label>
                <textarea id="edit-citation-json" style="flex: 1; min-height: 200px; margin-bottom: 15px; font-family: monospace; font-size: 13px; padding: 10px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; resize: vertical;"></textarea>

                <div style="display: flex; gap: 10px; margin-top: auto;">
                    <button id="btn-delete-citation" class="btn-sm" style="background:#ef4444; margin: 0; padding: 10px; font-size: 1rem; font-weight: bold;">🗑️ Delete</button>
                    <button id="btn-save-citation" class="btn-sm" style="background:#10b981; margin: 0; padding: 10px; font-size: 1rem; font-weight: bold; flex: 1;">💾 Save Changes</button>
                </div>
            </div>
        </div>
    `;
    // --- LOGIC & BINDINGS ---
    let localLibrary = [];
    let libRepos = [];
    let libConfigs = [];
    let libPinnedRepos = new Set(JSON.parse(localStorage.getItem('insetu_lib_pinned_repos')) || ["ALL"]);
    let libPinnedBuckets = new Set(JSON.parse(localStorage.getItem('insetu_lib_pinned_buckets')) || ["ALL"]);

    let cachedPublications = [];
    let cachedAuthors = [];

    // Fetch repository configs to populate UI
    fetch('/api/repos').then(r => r.json()).then(d => {
        libRepos = d.repos || [];
        libConfigs = d.targets || [];
        renderLibPins();
    });

    const renderLibPins = () => {
        const repoContainer = document.getElementById('lib-repo-pins');
        const bucketContainer = document.getElementById('lib-bucket-pins');
        if (!repoContainer || !bucketContainer) return;

        repoContainer.innerHTML = '<span style="font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px;">📌 Repos:</span>';

        const createPill = (id, label, isRepo) => {
            const btn = document.createElement('button');
            const isActive = isRepo ? libPinnedRepos.has(id) : libPinnedBuckets.has(id);
            btn.className = isActive ? 'repo-pill active' : 'repo-pill';
            btn.innerText = label;
            btn.style.cssText = `padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;
            btn.onclick = () => {
                const targetSet = isRepo ? libPinnedRepos : libPinnedBuckets;
                if (id === "ALL") {
                    targetSet.clear();
                    targetSet.add("ALL");
                } else {
                    targetSet.delete("ALL");
                    if (targetSet.has(id)) {
                        targetSet.delete(id);
                        if (targetSet.size === 0) targetSet.add("ALL");
                    } else {
                        targetSet.add(id);
                    }
                }
                localStorage.setItem(isRepo ? 'insetu_lib_pinned_repos' : 'insetu_lib_pinned_buckets', JSON.stringify(Array.from(targetSet)));
                renderLibPins();
                document.getElementById('lib-main-search').dispatchEvent(new Event('input')); // trigger filter
            };
            return btn;
        };
        repoContainer.appendChild(createPill("ALL", "All", true));
        repoContainer.appendChild(createPill("ORPHANS", "👻 Orphans", true));
        libRepos.forEach(repo => repoContainer.appendChild(createPill(repo, repo, true)));

        // Buckets
        bucketContainer.innerHTML = '<span style="font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px;">🗂️ Buckets:</span>';
        bucketContainer.appendChild(createPill("ALL", "All", false));

        let reposToShow = libPinnedRepos.has('ALL') ? libRepos : Array.from(libPinnedRepos);
        let hasBuckets = false;

        reposToShow.forEach(repoName => {
            const repoCfg = libConfigs.find(c => c.repo_dir === repoName);
            if (repoCfg && repoCfg.sub_buckets) {
                hasBuckets = true;
                const sep = document.createElement('span');
                sep.innerText = "|";
                sep.style.cssText = "font-size: 0.85rem; color: var(--text); opacity: 0.5; margin: 0 2px;";
                bucketContainer.appendChild(sep);
                repoCfg.sub_buckets.forEach(b => {
                    if (b.dynamic_split_prefix && b.meta_map) {
                        Object.keys(b.meta_map).forEach(module => {
                            bucketContainer.appendChild(createPill(module, b.meta_map[module].title || module, false));
                        });
                    } else if (!b.dynamic_split_prefix) {
                        bucketContainer.appendChild(createPill(b.id, b.id, false));
                    }
                });
            }
        });
        bucketContainer.style.display = hasBuckets ? 'flex' : 'none';
    };
    const openCitationNotes = async (cslId) => {
        const btn = document.getElementById(`btn-notes-${cslId}`);
        if (btn) btn.innerText = "⏳...";
        try {
            const res = await fetch('/api/fs/search?q=' + encodeURIComponent(cslId));
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length === 1) {
                    if (window.viewSourceFile) window.viewSourceFile(data.results[0].path, true);
                } else if (data.results && data.results.length > 1) {
                    if (window.openLinkModal) {
                        window.openLinkModal();
                        document.getElementById('link-search-input').value = cslId;
                        window.switchLinkTab('deep');
                        window.executeDeepLinkSearch();
                    }
                } else {
                    alert("No markdown files found referencing this citation ID.");
                }
            }
        } catch(e) {
            console.error(e);
            alert("Error searching for notes.");
        } finally {
            if (btn) btn.innerText = "📝 Notes";
        }
    };

    let activeAttachCitation = null;
    const openAttachModal = (citation) => {
        activeAttachCitation = citation;
        document.getElementById('attach-ref-id').innerText = `[@${citation.id}]`;

        const repoSelect = document.getElementById('attach-repo-select');
        const bucketSelect = document.getElementById('attach-bucket-select');

        repoSelect.innerHTML = '';
        libRepos.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.innerText = r;
            repoSelect.appendChild(opt);
        });

        const updateBuckets = () => {
            bucketSelect.innerHTML = '<option value="None">No Bucket</option>';
            const cfg = libConfigs.find(c => c.repo_dir === repoSelect.value);
            if (cfg && cfg.sub_buckets) {
                cfg.sub_buckets.forEach(b => {
                    if (b.dynamic_split_prefix && b.meta_map) {
                        Object.keys(b.meta_map).forEach(module => {
                            const opt = document.createElement('option');
                            opt.value = module;
                            opt.innerText = b.meta_map[module].title || module;
                            bucketSelect.appendChild(opt);
                        });
                    } else if (!b.dynamic_split_prefix) {
                        const opt = document.createElement('option');
                        opt.value = b.id;
                        opt.innerText = b.title || b.id;
                        bucketSelect.appendChild(opt);
                    }
                });
            }
        };

        repoSelect.onchange = updateBuckets;
        updateBuckets(); // init

        renderAttachmentList();
        document.getElementById('lib-attach-modal').style.display = 'block';
    };

    const renderAttachmentList = () => {
        const list = document.getElementById('current-attachments-list');
        list.innerHTML = '';
        const atts = activeAttachCitation._attachments || [];

        if (atts.length === 0) {
            list.innerHTML = '<span style="color: #888; font-style: italic;">No attachments.</span>';
            return;
        }

        atts.forEach((a, idx) => {
            const row = document.createElement('div');
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--pane-bg); border: 1px solid var(--border); padding: 6px 10px; border-radius: 4px;";
            row.innerHTML = `<span style="font-size: 0.85rem; font-family: monospace; color: var(--text);">${a.repo} ${a.bucket !== 'None' ? '🗂️ ' + a.bucket : ''}</span>`;

            const delBtn = document.createElement('button');
            delBtn.innerText = '❌';
            delBtn.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 0;";
            delBtn.onclick = async () => {
                atts.splice(idx, 1);
                await saveAttachments(atts);
            };
            row.appendChild(delBtn);
            list.appendChild(row);
        });
    };

    const saveAttachments = async (newAtts) => {
        const btn = document.getElementById('btn-add-attachment');
        btn.innerText = '⏳';
        try {
            const res = await fetch(`/api/citations/${encodeURIComponent(activeAttachCitation.id)}/attach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attachments: newAtts })
            });
            if (res.ok) {
                activeAttachCitation._attachments = newAtts;
                renderAttachmentList();
                document.getElementById('lib-main-search').dispatchEvent(new Event('input')); // Refresh main UI
            }
        } catch(e) {
            alert('Error saving attachment.');
        } finally {
            btn.innerText = '➕ Add';
        }
    };
    let currentEditAuthors = [];
    const renderAuthorPills = () => {
        const container = document.getElementById('edit-cit-author-pills');
        container.innerHTML = '';
        currentEditAuthors.forEach((a, idx) => {
            const pill = document.createElement('span');
            pill.className = 'task-tag';
            pill.style.cssText = 'background: #3b82f6; color: white; border: none; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 4px 8px; border-radius: 12px;';

            const name = a.given ? `${a.family}, ${a.given}` : a.family;
            const txt = document.createElement('span');
            txt.innerText = name || a.literal || 'Unknown';

            const closeBtn = document.createElement('span');
            closeBtn.innerText = '×';
            closeBtn.style.cssText = 'cursor: pointer; font-weight: bold; font-size: 1rem; line-height: 1; margin-left: 2px;';
            closeBtn.onclick = () => {
                currentEditAuthors.splice(idx, 1);
                renderAuthorPills();
            };

            pill.appendChild(txt);
            pill.appendChild(closeBtn);
            container.appendChild(pill);
        });
    };

    let activeEditCitation = null;
    const openEditModal = (citation) => {
        activeEditCitation = citation;
        document.getElementById('edit-ref-id').innerText = `[@${citation.id}]`;
        document.getElementById('edit-cit-type').value = citation.type || 'document';
        document.getElementById('edit-cit-title').value = citation.title || '';
        document.getElementById('edit-cit-pub-title').value = citation['container-title'] || '';

        currentEditAuthors = citation.author ? JSON.parse(JSON.stringify(citation.author)) : [];
        renderAuthorPills();
        document.getElementById('edit-cit-author-input').value = '';

        let dateStr = '';
        if (citation.issued && citation.issued['date-parts'] && citation.issued['date-parts'][0]) {
            dateStr = citation.issued['date-parts'][0].join('-');
        }
        document.getElementById('edit-cit-date').value = dateStr;
        // Clone and remove local attachments and explicit fields to keep the text box clean
        const cslData = { ...citation };
        delete cslData._attachments;
        delete cslData.type;
        delete cslData.title;
        delete cslData['container-title'];
        delete cslData.author;
        delete cslData.issued;

        document.getElementById('edit-citation-json').value = JSON.stringify(cslData, null, 4);
        document.getElementById('edit-citation-modal').style.display = 'block';
    };
    // Bind UI Generic Selectors
    document.getElementById('btn-pick-pub').onclick = () => {
        openSelectorModal('Select Publication', cachedPublications, (val) => {
            document.getElementById('edit-cit-pub-title').value = val;
        });
    };

    document.getElementById('btn-pick-author').onclick = () => {
        openSelectorModal('Select Author', cachedAuthors, (val) => {
            document.getElementById('edit-cit-author-input').value = val;
        });
    };

    document.getElementById('btn-add-cit-author').onclick = () => {
        const input = document.getElementById('edit-cit-author-input');
        const val = input.value.trim();
        if (!val) return;

        const parts = val.split(',').map(s => s.trim());
        if (parts.length > 1) {
            currentEditAuthors.push({ family: parts[0], given: parts.slice(1).join(', ') });
        } else {
            currentEditAuthors.push({ family: parts[0] });
        }

        input.value = '';
        renderAuthorPills();
        input.focus();
    };

    document.getElementById('btn-save-citation').onclick = async () => {
        if (!activeEditCitation) return;

        const btn = document.getElementById('btn-save-citation');
        const origText = btn.innerText;
        const jsonStr = document.getElementById('edit-citation-json').value;
        let payload;

        try {
            payload = JSON.parse(jsonStr);
        } catch (e) {
            alert("Invalid JSON format in the 'Other Metadata' box. Please check for syntax errors.");
            return;
        }
        // Re-inject explicitly edited fields
        payload.type = document.getElementById('edit-cit-type').value || 'document';
        payload.title = document.getElementById('edit-cit-title').value.trim();
        const pubTitle = document.getElementById('edit-cit-pub-title').value.trim();
        if (pubTitle) {
            payload['container-title'] = pubTitle;
        } else {
            delete payload['container-title'];
        }

        if (currentEditAuthors.length > 0) {
            payload.author = currentEditAuthors;
        } else {
            delete payload.author;
        }

        const dateStr = document.getElementById('edit-cit-date').value.trim();
        if (dateStr) {
            const parts = dateStr.split('-').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
            if (parts.length > 0) {
                payload.issued = { 'date-parts': [parts] };
            }
        } else {
            delete payload.issued;
        }

        // Ensure ID hasn't been maliciously or accidentally changed (which breaks file links)
        if (payload.id !== activeEditCitation.id) {
            alert("Warning: Changing the citation ID directly is not supported as it breaks existing links. Reverting ID.");
            payload.id = activeEditCitation.id;
        }

        btn.innerText = '⏳ Saving...';
        try {
            const res = await fetch('/api/citations/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ citations: [payload], strategy: 'overwrite' })
            });

            if (res.ok) {
                document.getElementById('edit-citation-modal').style.display = 'none';
                loadMainLibrary(); // Refreshes the list to show new data
            } else {
                const err = await res.json();
                alert("Failed to save: " + (err.error || "Unknown error"));
            }
        } catch(e) {
            alert('Network error saving citation.');
        } finally {
            btn.innerText = origText;
        }
    };

    document.getElementById('btn-delete-citation').onclick = async () => {
        if (!activeEditCitation) return;
        if (!confirm(`Are you sure you want to completely delete this citation ([@${activeEditCitation.id}]) from your library?`)) return;

        const btn = document.getElementById('btn-delete-citation');
        const origText = btn.innerText;
        btn.innerText = '⏳...';

        try {
            const res = await fetch('/api/citations/' + encodeURIComponent(activeEditCitation.id), {
                method: 'DELETE'
            });
            if (res.ok) {
                document.getElementById('edit-citation-modal').style.display = 'none';
                loadMainLibrary();
            } else {
                alert("Failed to delete citation. Please verify the API endpoint exists.");
            }
        } catch (e) {
            alert('Network error deleting citation.');
        } finally {
            btn.innerText = origText;
        }
    };

    const renderCards = (items, container, isExplore = false, append = false) => {
        if (!append) container.innerHTML = '';
        if (items.length === 0 && !append) {
            container.innerHTML = '<p style="color: #888; font-style: italic;">No results.</p>';
            return;
        }

        items.forEach(c => {
            const card = document.createElement('div');
            card.className = 'file-card cit-card-wrapper';

            const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
            const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';
            let actionHtml = '';
            if (isExplore) {
              // Check if the citation ID or URL already exists in the local library
              const alreadyExists = localLibrary.some(libItem => 
                libItem.id === c.id || 
                (libItem.URL && c.URL && libItem.URL.toLowerCase() === c.URL.toLowerCase())
              );

              if (alreadyExists) {
                actionHtml = `<div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.75rem; color: #f59e0b; font-weight: bold;">⚠️ In Library</span>
                        <button class="btn-sm btn-import-single" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' style="background: transparent; border: 1px solid #f59e0b; color: #f59e0b; padding: 2px 8px; margin: 0; font-size: 0.75rem;">Force Import</button>
                        </div>`;
              } else {
                actionHtml = `<button class="btn-sm btn-import-single" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' style="background: #10b981; margin: 0; padding: 2px 8px;">📥 Import</button>`;
              }
            } else {
              actionHtml = `<button id="btn-notes-${c.id}" class="btn-sm btn-notes-single" style="background: #8b5cf6; margin: 0; margin-right: 5px; padding: 2px 8px;">📝 Notes</button><button class="btn-sm btn-edit-single" style="background: #f59e0b; margin: 0; margin-right: 5px; padding: 2px 8px;">✏️ Edit</button><button class="btn-sm btn-attach-single" style="background: #3b82f6; margin: 0; padding: 2px 8px;">📎 Attach</button>`;
            }

            const attTags = !isExplore && c._attachments && c._attachments.length > 0
                ? c._attachments.map(a => `<span class="task-tag" style="background: var(--border);">${a.repo}${a.bucket !== 'None' ? ':'+a.bucket : ''}</span>`).join(' ')
                : '';

            card.innerHTML = `
                <div style="order: 1; display: flex; flex-direction: column;">
                    <div class="file-card-header">
                        <span class="file-title cit-title-push" style="color: #a855f7;">📄 ${c.title || 'Untitled'}</span>
                    </div>
                    <div class="file-desc" style="color: var(--text); font-weight: bold; margin-top: 5px;">${authors} (${year})</div>
                    <div class="file-desc" style="font-size: 0.8rem; margin-top: 8px;">ID: <span style="font-family: monospace; color: #38bdf8;">[@${c.id}]</span> ${c.open_access ? '🔓 OA' : ''}</div>
                    ${c.URL ? `<div class="file-desc" style="font-size: 0.8rem; margin-top: 4px;">🌐 <a href="${c.URL}" target="_blank" style="color: #10b981; text-decoration: underline; word-break: break-all;">${c.URL}</a></div>` : ''}
                    ${attTags ? `<div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">${attTags}</div>` : ''}
                </div>
                <div class="cit-card-actions">${actionHtml}</div>
            `;
            container.appendChild(card);
            if (!isExplore) {
                card.querySelector('.btn-notes-single').onclick = () => openCitationNotes(c.id);
                card.querySelector('.btn-edit-single').onclick = () => openEditModal(c);
                card.querySelector('.btn-attach-single').onclick = () => openAttachModal(c);
            }
        });

        // Bind Explore Import buttons
        if (isExplore) {
            container.querySelectorAll('.btn-import-single').forEach(btn => {
                btn.onclick = async (e) => {
                    const payload = JSON.parse(e.target.getAttribute('data-json'));
                    e.target.innerText = "⏳...";
                    try {
                        await fetch('/api/citations/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ citations: [payload], strategy: 'overwrite' })
                        });
                        e.target.innerText = "✅ Saved";
                        e.target.style.background = "#64748b";
                        e.target.disabled = true;
                        loadMainLibrary(); // refresh background cache
                    } catch (err) {
                        e.target.innerText = "❌ Error";
                    }
                };
            });
        }
    };

    // Attach listener for the Add button once
    document.getElementById('btn-add-attachment').onclick = async () => {
        if (!activeAttachCitation) return;
        const repo = document.getElementById('attach-repo-select').value;
        const bucket = document.getElementById('attach-bucket-select').value;
        const atts = activeAttachCitation._attachments || [];

        if (!atts.find(a => a.repo === repo && a.bucket === bucket)) {
            atts.push({ repo, bucket });
            await saveAttachments(atts);
        }
    };
    const loadMainLibrary = async () => {
        document.getElementById('lib-main-loading').style.display = 'block';
        // Fetch metadata index for the generic UI selector
        fetch('/api/citations/index').then(r => r.json()).then(d => {
            if(d.publications) cachedPublications = d.publications;
            if(d.authors) cachedAuthors = d.authors;
        }).catch(e=>{});
        try {
            const res = await fetch('/api/citations');
            if (res.ok) {
                const data = await res.json();
                localLibrary = data.citations || [];
                renderCards(localLibrary, document.getElementById('lib-main-list'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            document.getElementById('lib-main-loading').style.display = 'none';
        }
    };
    // Main Tab Search & Filter
    document.getElementById('lib-main-search').addEventListener('input', (e) => {
        const norm = window.normalizeAccentText || (str => str.toLowerCase());
        const q = norm(e.target.value);
        const filtered = localLibrary.filter(c => {
            const matchesSearch = norm(c.title || "").includes(q) || 
                                  norm(c.id || "").includes(q) || 
                                  norm(c.author ? c.author.map(a => a.family).join(" ") : "").includes(q);

            let matchesRepo = libPinnedRepos.has('ALL');
            let matchesBucket = libPinnedBuckets.has('ALL');
            const atts = c._attachments || [];

            if (!matchesRepo) {
                matchesRepo = (libPinnedRepos.has('ORPHANS') && atts.length === 0) || atts.some(a => libPinnedRepos.has(a.repo));
            }

            if (atts.length === 0 && libPinnedRepos.has('ORPHANS')) {
                matchesBucket = true; // Orphans inherently have no buckets to filter
            } else if (!matchesBucket && matchesRepo) {
                matchesBucket = atts.some(a => libPinnedBuckets.has(a.bucket) && (libPinnedRepos.has('ALL') || libPinnedRepos.has(a.repo)));
            }

            return matchesSearch && matchesRepo && matchesBucket;
        });
        renderCards(filtered, document.getElementById('lib-main-list'));
    });
    // Dynamic Form Toggles
    const exploreSource = document.getElementById('lib-explore-source');
    const wrapField = document.getElementById('wrap-explore-field');
    const wrapCat = document.getElementById('wrap-explore-category');
    const exploreSearch = document.getElementById('lib-explore-search');

    exploreSource.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'openalex') {
            wrapField.style.display = 'block';
            wrapCat.style.display = 'block';
            exploreSearch.placeholder = "Keywords, titles, or authors...";
        } else if (val === 'crossref') {
            wrapField.style.display = 'block';
            wrapCat.style.display = 'none';
            exploreSearch.placeholder = "DOIs, precise titles, or authors...";
            document.getElementById('lib-explore-category').value = ''; // clear on hide
        } else {
            wrapField.style.display = 'none';
            wrapCat.style.display = 'none';
            exploreSearch.placeholder = "Keywords or Paper IDs...";
            document.getElementById('lib-explore-category').value = '';
        }
    });
    let currentExplorePage = 1;

    const performExploreSearch = async (loadMore = false) => {
        const query = exploreSearch.value.trim();
        const source = exploreSource.value;
        const field = document.getElementById('lib-explore-field').value;
        const category = document.getElementById('lib-explore-category').value.trim();

        if (!query && !category) return;

        const list = document.getElementById('lib-explore-list');
        const spinner = document.getElementById('lib-explore-loading');

        if (!loadMore) {
            list.innerHTML = '';
            currentExplorePage = 1;
        } else {
            const btn = document.getElementById('btn-explore-load-more');
            if (btn) btn.remove();
        }

        spinner.style.display = 'block';

        try {
            const res = await fetch(`/api/citations/search?q=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}&field=${encodeURIComponent(field)}&category=${encodeURIComponent(category)}&page=${currentExplorePage}`);
            if (res.ok) {
                const data = await res.json();
                const citations = data.citations || [];
                renderCards(citations, list, true, loadMore);

                // If we got exactly 20 results, assume there's another page
                if (citations.length === 20) {
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.id = 'btn-explore-load-more';
                    loadMoreBtn.className = 'btn-sm';
                    loadMoreBtn.style.background = '#64748b';
                    loadMoreBtn.style.margin = '10px auto';
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.innerText = '⬇️ Load More';
                    loadMoreBtn.onclick = () => {
                        currentExplorePage++;
                        performExploreSearch(true);
                    };
                    list.appendChild(loadMoreBtn);
                }
            }
        } catch (e) {
            if (!loadMore) list.innerHTML = `<p style="color: red;">Search failed: ${e.message}</p>`;
        } finally {
            spinner.style.display = 'none';
        }
    };

    // Explore Tab Search
    document.getElementById('btn-explore-search').addEventListener('click', () => performExploreSearch(false));

    // Import Tab Logic
    const filePicker = document.getElementById('lib-file-picker');
    document.getElementById('btn-trigger-file').addEventListener('click', () => filePicker.click());
    
    filePicker.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const strat = document.querySelector('input[name="lib-merge-strat"]:checked').value;
        const log = document.getElementById('lib-import-log');
        log.innerText = "Parsing JSON...\n";

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const jsonPayload = JSON.parse(ev.target.result);
                const reqBody = { citations: jsonPayload.items || jsonPayload, strategy: strat };
                
                log.innerText += `Uploading ${reqBody.citations.length} records...\n`;
                const res = await fetch('/api/citations/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqBody)
                });
                
                const data = await res.json();
                if (res.ok) {
                    log.innerText += `✅ ${data.message}\n`;
                    if (data.conflicts && data.conflicts.length > 0) {
                        log.innerText += `⚠️ ${data.conflicts.length} conflicts flagged for manual resolution (Not yet implemented).\n`;
                    }
                    loadMainLibrary();
                } else {
                    log.innerText += `❌ Import failed: ${data.error}\n`;
                }
            } catch (err) {
                log.innerText += `❌ JSON Parse Error: ${err.message}\n`;
            }
        };
        reader.readAsText(file);
    });
    // Initial Load
    loadMainLibrary();
}
export async function addFileToLibrary(filename, content, filepath) {
    let title = filename.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let url = '';
    let dateStr = '';
    let cslId = 'ref-' + Date.now();

    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
        const lines = yamlMatch[1].split('\n');
        lines.forEach(l => {
            if (l.startsWith('title:')) title = l.replace('title:', '').replace(/['"]/g, '').trim();
            if (l.startsWith('source_url:')) url = l.replace('source_url:', '').replace(/['"]/g, '').trim();
            if (l.startsWith('published_at:')) dateStr = l.replace('published_at:', '').replace(/['"]/g, '').trim();
        });
    }

    // DO NO HARM BYPASS: Check if this URL already exists in the local library
    if (url && typeof citationLibraryCache !== 'undefined' && citationLibraryCache) {
        const existingRef = citationLibraryCache.find(c => c.URL && c.URL.toLowerCase() === url.toLowerCase());
        if (existingRef) {
            console.log("URL already exists in library. Bypassing metadata overwrite and tagging with existing ID:", existingRef.id);
            cslId = existingRef.id;

            // Extract existing year for the pretty tag
            let existingYear = new Date().getFullYear().toString();
            if (existingRef.issued && existingRef.issued['date-parts'] && existingRef.issued['date-parts'][0]) {
                existingYear = existingRef.issued['date-parts'][0][0].toString();
            }
            const existingAuthor = existingRef.author && existingRef.author[0] ? existingRef.author[0].family.toLowerCase().replace(/[^a-z0-9]/g, '') : 'insetu';
            const prettyId = `${existingAuthor}${existingYear}`;

            let newContent = content.trim();
            if (yamlMatch) {
                newContent = newContent.replace(yamlMatch[0], yamlMatch[0] + `\n\n**Source Reference:** [@${prettyId}]`);
            } else {
                newContent = `---\ntitle: "${title}"\n---\n\n**Source Reference:** [@${prettyId}]\n\n` + newContent;
            }
            newContent += `\n\n---\ncitations:\n  ${prettyId}: "${cslId}"\n---`;
            return newContent;
        }
    }

    let year = new Date().getFullYear().toString();
    if (dateStr && dateStr !== 'Unknown') {
        const match = dateStr.match(/^(\d{4})/);
        if (match) year = match[1];
    }
    const prettyId = `insetu${year}`;

    let newContent = content.trim();
    if (yamlMatch) {
        newContent = newContent.replace(yamlMatch[0], yamlMatch[0] + `\n\n**Source Reference:** [@${prettyId}]`);
    } else {
        newContent = `---\ntitle: "${title}"\n---\n\n**Source Reference:** [@${prettyId}]\n\n` + newContent;
    }

    newContent += `\n\n---\ncitations:\n  ${prettyId}: "${cslId}"\n---`;

    const parts = filepath.split('/');
    const repo = parts.length > 0 && parts[0] ? parts[0] : 'Workspace';
    const inferredBucket = parts.length > 1 && parts[1] ? parts[1] : 'None';

    let bucket = 'None';
    if (typeof TARGET_CONFIGS !== 'undefined') {
        const repoCfg = TARGET_CONFIGS.find(c => c.repo_dir === repo);
        if (repoCfg && repoCfg.sub_buckets) {
            for (const b of repoCfg.sub_buckets) {
                if (b.dynamic_split_prefix && b.meta_map && b.meta_map[inferredBucket]) {
                    bucket = inferredBucket;
                    break;
                } else if (!b.dynamic_split_prefix && b.id === inferredBucket) {
                    bucket = inferredBucket;
                    break;
                }
            }
        }
    }

    const cslItem = {
        id: cslId,
        type: url ? 'webpage' : 'document',
        title: title,
        URL: url,
        author: [{family: 'inSetu', given: 'Workspace'}],
        issued: { 'date-parts': [[parseInt(year)]] }
    };

    try {
        await fetch('/api/citations/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ citations: [cslItem], strategy: 'overwrite' })
        });
        await fetch(`/api/citations/${encodeURIComponent(cslId)}/attach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachments: [{ repo: repo, bucket: bucket }] })
        });
    } catch(e) {
        console.error("Failed to execute library injection.", e);
    }

    return newContent;
}

let citationLibraryCache = null;
let citationSearchTimeout = null;

export async function openCitationModal() {
    document.getElementById('citation-insert-modal').style.display = 'block';
    document.getElementById('citation-search-input').value = '';
    document.getElementById('citation-results-list').innerHTML = '<span style="color:#888; font-style:italic;">Loading library...</span>';
    try {
        const res = await fetch('/api/citations');
        if (res.ok) {
            const data = await res.json();
            citationLibraryCache = data.citations || [];
            document.getElementById('citation-results-list').innerHTML = '<span style="color:#888; font-style:italic;">Library loaded. Type to search...</span>';
        }
    } catch(e) {
        document.getElementById('citation-results-list').innerHTML = '<span style="color:red;">Failed to load library.</span>';
    }
}

export function onCitationSearchInput(val) {
    clearTimeout(citationSearchTimeout);
    citationSearchTimeout = setTimeout(() => {
        const container = document.getElementById('citation-results-list');
        const norm = window.normalizeAccentText || (str => str.toLowerCase());
        const q = norm(val.trim());

        if (!q || !citationLibraryCache) {
            container.innerHTML = '<span style="color:#888; font-style:italic;">Type to search...</span>';
            return;
        }

        const results = citationLibraryCache.filter(c => {
            const title = norm(c.title || "");
            const authors = norm(c.author ? c.author.map(a => a.family).join(" ") : "");
            const id = norm(c.id || "");
            return title.includes(q) || authors.includes(q) || id.includes(q);
        }).slice(0, 30);

        container.innerHTML = '';
        if (results.length === 0) {
            container.innerHTML = '<span style="color:#888; font-style:italic;">No citations found.</span>';
            return;
        }

        results.forEach(c => {
            const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
            const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';

            const row = document.createElement('div');
            row.className = 'file-card';
            row.style.cursor = 'pointer';
            row.style.padding = '8px 12px';

            row.innerHTML = `
                <div style="font-weight: bold; color: var(--text); margin-bottom: 4px;">${c.title || 'Untitled'}</div>
                <div style="font-size: 0.75rem; color: #888;">${authors} (${year})</div>
            `;
            row.onclick = () => insertCitationToEditor(c);
            container.appendChild(row);
        });
    }, 300);
}

function insertCitationToEditor(citation) {
    const author = citation.author && citation.author[0] ? citation.author[0].family : 'unknown';
    const year = citation.issued && citation.issued['date-parts'] ? citation.issued['date-parts'][0][0] : 'nd';
    const norm = window.normalizeAccentText || (str => str.toLowerCase());
    const normalizedAuthor = norm(author).replace(/[^a-z0-9]/g, '');
    const baseId = `${normalizedAuthor}${year}`;
    let prettyId = baseId;

    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const isMDE = (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined');
    const textArea = document.getElementById('modal-text');

    let text = isMDE ? mdeInstance.codemirror.getValue() : textArea.value;
    const backmatterRegex = /\n+---\n+citations:\n([\s\S]*?)\n---$/;
    const match = text.match(backmatterRegex);

    let citationsMap = {};
    if (match) {
        const lines = match[1].split('\n');
        lines.forEach(l => {
            const parts = l.split(':');
            if (parts.length >= 2) {
                citationsMap[parts[0].trim()] = parts.slice(1).join(':').replace(/['"]/g, '').trim();
            }
        });
    }

    if (citationsMap[prettyId] && citationsMap[prettyId] !== citation.id) {
        let suffixCharCode = 97;
        while (citationsMap[baseId + String.fromCharCode(suffixCharCode)] && citationsMap[baseId + String.fromCharCode(suffixCharCode)] !== citation.id) {
            suffixCharCode++;
        }
        prettyId = baseId + String.fromCharCode(suffixCharCode);
    }

    citationsMap[prettyId] = citation.id;

    let newBackmatter = "\n\n---\ncitations:\n";
    Object.keys(citationsMap).forEach(k => {
        newBackmatter += `  ${k}: "${citationsMap[k]}"\n`;
    });
    newBackmatter += "---";

    if (match) {
        text = text.replace(match[0], newBackmatter);
    } else {
        text += newBackmatter;
    }

    const linkText = `[@${prettyId}]`;

    if (isMDE) {
        const cm = mdeInstance.codemirror;
        const cursor = cm.getCursor();
        cm.setValue(text);
        cm.setCursor(cursor);
        cm.replaceSelection(linkText);
        cm.focus();
    } else {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        textArea.value = text.substring(0, start) + linkText + text.substring(end);
        textArea.selectionStart = textArea.selectionEnd = start + linkText.length;
        textArea.focus();
        textArea.dispatchEvent(new Event('input'));
    }

    document.getElementById('citation-insert-modal').style.display = 'none';
    if (currentModalIsFS && window.saveModalFile) window.saveModalFile(true);
}

export async function syncDocumentCitations() {
    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const isMDE = (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined');
    const textArea = document.getElementById('modal-text');
    let text = isMDE ? mdeInstance.codemirror.getValue() : textArea.value;

    const backmatterRegex = /\n+---\n+citations:\n([\s\S]*?)\n---$/;
    const match = text.match(backmatterRegex);
    if (!match) {
        alert("No citation backmatter found in this document.");
        return;
    }

    const btn = document.getElementById('btn-sync-citations');
    const origText = btn.innerText;
    btn.innerText = "⏳...";
    try {
        const res = await fetch('/api/citations');
        if (!res.ok) throw new Error("Failed to fetch library.");
        const data = await res.json();
        const library = data.citations || [];
        let oldMap = {};
        const lines = match[1].split('\n');
        lines.forEach(l => {
            const parts = l.split(':');
            if (parts.length >= 2) {
                oldMap[parts[0].trim()] = parts.slice(1).join(':').replace(/['"]/g, '').trim();
            }
        });

        let newMap = {};
        let oldToNew = {};
        let changesMade = false;

        const norm = window.normalizeAccentText || (str => str.toLowerCase());

        for (const [oldPretty, trueId] of Object.entries(oldMap)) {
            const citation = library.find(c => c.id === trueId);
            if (!citation) {
                newMap[oldPretty] = trueId;
                oldToNew[oldPretty] = oldPretty;
                continue;
            }

            const author = citation.author && citation.author[0] ? citation.author[0].family : 'unknown';
            const year = citation.issued && citation.issued['date-parts'] ? citation.issued['date-parts'][0][0] : 'nd';
            const normalizedAuthor = norm(author).replace(/[^a-z0-9]/g, '');
            const baseId = `${normalizedAuthor}${year}`;
            let newPretty = baseId;

            if (newMap[newPretty] && newMap[newPretty] !== trueId) {
                let suffixCharCode = 97;
                while (newMap[baseId + String.fromCharCode(suffixCharCode)] && newMap[baseId + String.fromCharCode(suffixCharCode)] !== trueId) {
                    suffixCharCode++;
                }
                newPretty = baseId + String.fromCharCode(suffixCharCode);
            }

            newMap[newPretty] = trueId;
            oldToNew[oldPretty] = newPretty;
            if (oldPretty !== newPretty) changesMade = true;
        }

        if (!changesMade) {
            alert("All citations are already up to date!");
            btn.innerText = origText;
            return;
        }

        let bodyText = text.substring(0, match.index);
        for (const [oldPretty, newPretty] of Object.entries(oldToNew)) {
            if (oldPretty !== newPretty) {
                const regex = new RegExp('(@)' + oldPretty + '\\b', 'g');
                bodyText = bodyText.replace(regex, '$1' + newPretty);
            }
        }

        let newBackmatter = "\n\n---\ncitations:\n";
        Object.keys(newMap).forEach(k => {
            newBackmatter += `  ${k}: "${newMap[k]}"\n`;
        });
        newBackmatter += "---";

        const finalText = bodyText + newBackmatter;

        if (isMDE) {
            const cm = mdeInstance.codemirror;
            const cursor = cm.getCursor();
            cm.setValue(finalText);
            cm.setCursor(cursor);
        } else {
            const start = textArea.selectionStart;
            textArea.value = finalText;
            textArea.selectionStart = textArea.selectionEnd = start;
            textArea.dispatchEvent(new Event('input'));
        }

        if (currentModalIsFS && window.saveModalFile) window.saveModalFile(true);
    } catch(e) {
        alert("Error syncing citations: " + e.message);
    } finally {
        btn.innerText = origText;
        setTimeout(() => btn.innerText = origText, 2000);
    }
}

window.addFileToLibrary = addFileToLibrary;
window.syncDocumentCitations = syncDocumentCitations;
window.openCitationModal = openCitationModal;
window.onCitationSearchInput = onCitationSearchInput;