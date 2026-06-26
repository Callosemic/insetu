const libraryScreen = window.ExtensionRegistry.registerTab('library', 'Library');

if (libraryScreen) {
    libraryScreen.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 15px;">
            <div class="sub-tabs" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
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
    `;
    // --- LOGIC & BINDINGS ---
    let localLibrary = [];
    let libRepos = [];
    let libConfigs = [];
    let libPinnedRepos = new Set(JSON.parse(localStorage.getItem('insetu_lib_pinned_repos')) || ["ALL"]);
    let libPinnedBuckets = new Set(JSON.parse(localStorage.getItem('insetu_lib_pinned_buckets')) || ["ALL"]);

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
                        Object.keys(b.meta_map).forEach(brand => {
                            bucketContainer.appendChild(createPill(brand, b.meta_map[brand].title || brand, false));
                        });
                    } else if (!b.dynamic_split_prefix) {
                        bucketContainer.appendChild(createPill(b.id, b.id, false));
                    }
                });
            }
        });
        bucketContainer.style.display = hasBuckets ? 'flex' : 'none';
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
                        Object.keys(b.meta_map).forEach(brand => {
                            const opt = document.createElement('option');
                            opt.value = brand;
                            opt.innerText = b.meta_map[brand].title || brand;
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

    const renderCards = (items, container, isExplore = false, append = false) => {
        if (!append) container.innerHTML = '';
        if (items.length === 0 && !append) {
            container.innerHTML = '<p style="color: #888; font-style: italic;">No results.</p>';
            return;
        }

        items.forEach(c => {
            const card = document.createElement('div');
            card.className = 'file-card';

            const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
            const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';

            let actionHtml = isExplore 
                ? `<button class="btn-sm btn-import-single" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' style="background: #10b981; margin: 0; padding: 2px 8px;">📥 Import</button>`
                : `<button class="btn-sm btn-attach-single" style="background: #3b82f6; margin: 0; padding: 2px 8px;">📎 Attach</button>`;

            const attTags = !isExplore && c._attachments && c._attachments.length > 0
                ? c._attachments.map(a => `<span class="task-tag" style="background: var(--border);">${a.repo}${a.bucket !== 'None' ? ':'+a.bucket : ''}</span>`).join(' ')
                : '';

            card.innerHTML = `
                <div class="file-card-header">
                    <span class="file-title" style="color: #a855f7;">📄 ${c.title || 'Untitled'}</span>
                    <div class="file-actions">${actionHtml}</div>
                </div>
                <div class="file-desc" style="color: var(--text); font-weight: bold; margin-top: 5px;">${authors} (${year})</div>
                <div class="file-desc" style="font-size: 0.8rem; margin-top: 8px;">ID: <span style="font-family: monospace; color: #38bdf8;">[@${c.id}]</span> ${c.open_access ? '🔓 OA' : ''}</div>
                ${attTags ? `<div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">${attTags}</div>` : ''}
            `;
            container.appendChild(card);

            if (!isExplore) {
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
        const q = e.target.value.toLowerCase();
        const filtered = localLibrary.filter(c => {
            const matchesSearch = (c.title || "").toLowerCase().includes(q) || 
                                  (c.id || "").toLowerCase().includes(q) || 
                                  (c.author ? c.author.map(a => a.family).join(" ").toLowerCase() : "").includes(q);

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