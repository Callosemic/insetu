import { mdeInstance } from '../app.js';
import { currentModalIsFS } from '../fs.js';
import { openSelectorModal } from '../ui.js';
import { AppStore } from '../store.js';
import { getFlattenedBuckets } from '../app.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

const _getActiveWs = () => AppStore.getState().activeWorkspace || 'default';
const _safeParseSet = (key) => {
    try {
        const item = localStorage.getItem(key);
        return new Set(item ? JSON.parse(item) : ["ALL"]);
    } catch (e) {
        console.warn(`[Citations Storage Safeguard] Resetting corrupted key: ${key}`);
        localStorage.setItem(key, JSON.stringify(["ALL"]));
        return new Set(["ALL"]);
    }
};
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
export const CitationStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            localLibrary: [],
            pinnedRepos: _safeParseSet(`insetu_lib_pinned_repos_${_getActiveWs()}`),
            pinnedBuckets: _safeParseSet(`insetu_lib_pinned_buckets_${_getActiveWs()}`),
            reposExpanded: false,
            bucketsExpanded: {},
            cachedPublications: [],
            cachedAuthors: [],
            activeAttachCitation: null,
            activeEditCitation: null,
            currentEditAuthors: [],
            currentExplorePage: 1,
            citationLibraryCache: null,
            attachForm: { repo: '', bucket: 'None' },
            editForm: { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' },
            resetState: () => set({ localLibrary: [], cachedPublications: [], cachedAuthors: [], activeAttachCitation: null, activeEditCitation: null, currentEditAuthors: [], currentExplorePage: 1, citationLibraryCache: null, attachForm: { repo: '', bucket: 'None' }, editForm: { type: 'document', title: '', pubTitle: '', dateStr: '', jsonStr: '{}', authorInput: '' } })
        })),
        { name: 'CitationStore' }
    )
);

window.inSetu.stores.Citations = CitationStore;
window.CitationStore = CitationStore; // Legacy alias
const libraryScreen = window.inSetu.extensions.Registry.registerTab('library', 'Library', 'citations');
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
                        <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Catalog Source</label>
                        <select id="lib-explore-source" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border); font-weight: bold;">
                            <option value="openalex">OpenAlex (Recommended)</option>
                            <option value="crossref">Crossref (DOIs & Exact Titles)</option>
                            <option value="semanticscholar">Semantic Scholar</option>
                        </select>
                    </div>

                    <div id="wrap-explore-query">
                        <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Search Query</label>
                        <input type="text" id="lib-explore-search" placeholder="Keywords, titles, or authors..." style="width: 100%; padding: 8px 10px; box-sizing: border-box; margin: 0;">
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div id="wrap-explore-field" style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Target Field</label>
                            <select id="lib-explore-field" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border);">
                                <option value="all">All Fields</option>
                                <option value="title">Title Only</option>
                            </select>
                        </div>

                        <div id="wrap-explore-category" style="flex: 1; min-width: 150px;">
                            <label style="font-weight:bold; font-size:0.85rem; color:var(--intent-highlight); display:block; margin-bottom:4px;">Topic Filter</label>
                            <input type="text" id="lib-explore-category" placeholder="e.g., Ethnomusicology..." style="width: 100%; padding: 8px 10px; box-sizing: border-box; margin: 0; border-color: var(--intent-highlight);">
                        </div>
                    </div>

                    <button id="btn-explore-search" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 10px; font-size: 1rem;">🔍 Search Catalog</button>
                </div>
                <div id="lib-explore-loading" class="spinner" style="display: none;">Querying global catalogs...</div>
                <div id="lib-explore-list" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1;">
                    <p style="color: var(--text-muted); font-style: italic;">Search the open science index to discover and import citations.</p>
                </div>
            </div>
        </div>

        <div id="sub-lib-import" class="sub-tab-content" style="height: 100%;">
            <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="background: var(--input-bg); padding: 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 15px;">
                <h3 style="margin-top: 0; color: var(--intent-primary);">Import CSL-JSON</h3>
                <p style="font-size: 0.9rem; color: var(--text-muted);">Select a JSON export from Zotero or Better BibTeX.</p>
                
                <div style="margin: 15px 0;">
                    <label style="font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 5px;">Conflict Strategy:</label>
                    <div style="display: flex; gap: 15px; font-size: 0.9rem;">
                        <label><input type="radio" name="lib-merge-strat" value="overwrite" checked> Overwrite Existing</label>
                        <label><input type="radio" name="lib-merge-strat" value="skip"> Skip Existing</label>
                        <label><input type="radio" name="lib-merge-strat" value="manual"> Manual Resolve</label>
                    </div>
                </div>
                
                <button id="btn-trigger-file" class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 8px 16px;">📁 Choose File</button>
                <input type="file" id="lib-file-picker" accept=".json,application/json" style="display: none;">
            </div>
                <div id="lib-import-log" style="font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; color: var(--text);"></div>
            </div>
        </div>
    `;
    // --- LOGIC & BINDINGS ---
    const renderLibPins = (state) => {
        const { allRepos: libRepos } = AppStore.getState();
        const container = document.getElementById('lib-repo-pins');
        if (!container) return;

        // Hide legacy bucket container if it exists
        const bContainer = document.getElementById('lib-bucket-pins');
        if (bContainer) bContainer.style.display = 'none';

        window.inSetu.ui.Factory.createNestedRepoFilters({
            container: container,
            repos: libRepos,
            activeRepos: state.pinnedRepos,
            reposExpanded: state.reposExpanded,
            onRepoChange: (newSet) => {
                const activeWs = AppStore.getState().activeWorkspace || 'default';
                localStorage.setItem(`insetu_lib_pinned_repos_${activeWs}`, JSON.stringify(Array.from(newSet)));
                CitationStore.setState({ pinnedRepos: newSet, reposExpanded: false });
                document.getElementById('lib-main-search').dispatchEvent(new Event('input'));
            },
            onRepoExpandToggle: () => CitationStore.setState({ reposExpanded: !state.reposExpanded }),
            extraRepos: [{id: "ORPHANS", label: "👻 Orphans"}],
            enableBuckets: true,
            activeBuckets: state.pinnedBuckets,
            bucketsExpandedMap: state.bucketsExpanded,
            getBucketsFn: getFlattenedBuckets,
            onBucketChange: (newSet, repo) => {
                const activeWs = AppStore.getState().activeWorkspace || 'default';
                localStorage.setItem(`insetu_lib_pinned_buckets_${activeWs}`, JSON.stringify(Array.from(newSet)));
                const newB = { ...state.bucketsExpanded };
                newB[repo] = false;
                CitationStore.setState({ pinnedBuckets: newSet, bucketsExpanded: newB });
                document.getElementById('lib-main-search').dispatchEvent(new Event('input'));
            },
            onBucketExpandToggle: (repo, newState) => {
                const newB = { ...state.bucketsExpanded };
                newB[repo] = newState;
                CitationStore.setState({ bucketsExpanded: newB });
            }
        });
    };
    const openCitationNotes = async (cslId) => {
        const btn = document.getElementById(`btn-notes-${cslId}`);
if (btn) btn.innerText = "⏳...";
        try {
            const activeWs = AppStore.getState().activeWorkspace || 'default';
            const res = await fetch(`/api/${activeWs}/fs/search?q=` + encodeURIComponent(cslId));
if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length === 1) {
                    if (window.viewSourceFile) window.viewSourceFile(data.results[0].path, true);
                } else if (data.results && data.results.length > 1) {
                    if (window.openLinkModal) {
                        window.openLinkModal();
                        const linkSearchInput = document.getElementById('link-search-input');
                        if (linkSearchInput) linkSearchInput.value = cslId;
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
    const openAttachModal = (citation) => {
        CitationStore.setState({ activeAttachCitation: citation });
const bodyHtml = `
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <select id="attach-repo-select" style="flex:1; padding:8px; border-radius:4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"></select>
                <select id="attach-bucket-select" style="flex:1; padding:8px; border-radius:4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"></select>
                <button id="btn-add-attachment" class="btn-sm" style="background:var(--intent-success); margin: 0;">📌 Pin</button>

            </div>
            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:5px;">Currently Pinned Repositories:</label>
            <div id="current-attachments-list" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; overflow-y: auto; flex: 1;"></div>
        `;
window.inSetu.ui.Factory.createModal({
            id: 'lib-attach-dynamic-modal',
            title: `Pin to Repo: <span style="color: var(--intent-highlight); font-family: monospace;">[@${citation.id}]</span>`,
            body: bodyHtml
        });
        const repoSelect = document.getElementById('attach-repo-select');
        const bucketSelect = document.getElementById('attach-bucket-select');

        repoSelect.replaceChildren();
        const { allRepos } = AppStore.getState();
        allRepos.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.innerText = r;
            repoSelect.appendChild(opt);
        });

        CitationStore.setState(state => ({ attachForm: { ...state.attachForm, repo: allRepos[0] || '', bucket: 'None' } }));

        const updateBuckets = (selectedRepo) => {
            bucketSelect.replaceChildren();
            const defOpt = document.createElement('option');
            defOpt.value = "None";
            defOpt.innerText = "No Bucket";
            bucketSelect.appendChild(defOpt);

            const buckets = getFlattenedBuckets(selectedRepo);
            buckets.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.innerText = b.title;
                bucketSelect.appendChild(opt);
            });
            CitationStore.setState(state => ({ attachForm: { ...state.attachForm, bucket: 'None' } }));
        };

        repoSelect.onchange = (e) => {
            CitationStore.setState(state => ({ attachForm: { ...state.attachForm, repo: e.target.value } }));
            updateBuckets(e.target.value);
        };
        bucketSelect.onchange = (e) => {
            CitationStore.setState(state => ({ attachForm: { ...state.attachForm, bucket: e.target.value } }));
        };
        updateBuckets(allRepos[0] || '');

        // Bind the Add button since we recreate it dynamically
        document.getElementById('btn-add-attachment').onclick = async () => {
            const { activeAttachCitation, attachForm } = CitationStore.getState();
            if (!activeAttachCitation) return;
            const repo = attachForm.repo;
            const bucket = attachForm.bucket;
            const atts = activeAttachCitation._attachments || [];
if (!atts.find(a => a.repo === repo && a.bucket === bucket)) {
                atts.push({ repo, bucket });
await saveAttachments(atts);
            }
        };

        renderAttachmentList();
    };
const renderAttachmentList = () => {
        const { activeAttachCitation } = CitationStore.getState();
        const list = document.getElementById('current-attachments-list');
        list.replaceChildren();
const atts = activeAttachCitation ? (activeAttachCitation._attachments || []) : [];
        if (atts.length === 0) {
                    list.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Not pinned to any repository.</span>';
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
        const { activeAttachCitation } = CitationStore.getState();
        if (!activeAttachCitation) return;
        const btn = document.getElementById('btn-add-attachment');
btn.innerText = '⏳';
        try {
            const res = await fetch(`/api/citations/${encodeURIComponent(activeAttachCitation.id)}/attach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attachments: newAtts })
            });
if (res.ok) {
                const updatedCitation = { ...activeAttachCitation, _attachments: newAtts };
                CitationStore.setState({ activeAttachCitation: updatedCitation });
renderAttachmentList();

                // Surgical DOM Reconciliation
                const card = document.querySelector(`.cit-card-wrapper[data-cit-id="${updatedCitation.id}"]`);
                if (card) {
                    const tempFragment = document.createElement('div');
                    renderCards([activeAttachCitation], tempFragment, false, true);
                    if (tempFragment.firstElementChild) {
                        card.replaceWith(tempFragment.firstElementChild);
                    }
                }
            }
        } catch(e) {
            alert('Error saving attachment.');
} finally {
    btn.innerText = '📌 Pin';
}
};
    const renderAuthorPills = () => {
        const { currentEditAuthors } = CitationStore.getState();
        const container = document.getElementById('edit-cit-author-pills');
container.replaceChildren();
        currentEditAuthors.forEach((a, idx) => {
            const pill = document.createElement('span');
            pill.className = 'task-tag';
            pill.style.cssText = 'background: var(--intent-primary); color: white; border: none; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 4px 8px; border-radius: 12px;';

            const name = a.given ? `${a.family}, ${a.given}` : a.family;
            const txt = document.createElement('span');
            txt.innerText = name || a.literal || 'Unknown';
            const closeBtn = document.createElement('span');
            closeBtn.innerText = '×';
            closeBtn.style.cssText = 'cursor: pointer; font-weight: bold; font-size: 1rem; line-height: 1; margin-left: 2px;';
            closeBtn.onclick = () => {
                const updatedAuthors = [...CitationStore.getState().currentEditAuthors];
                updatedAuthors.splice(idx, 1);
                CitationStore.setState({ currentEditAuthors: updatedAuthors });
                renderAuthorPills();
            };

            pill.appendChild(txt);
            pill.appendChild(closeBtn);
            container.appendChild(pill);
        });
    };
const openEditModal = (citation) => {
        CitationStore.setState({ activeEditCitation: citation });
const bodyHtml = `
            <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Type:</label>
                            <select id="edit-cit-type" style="width: 100%; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" onchange="CitationStore.setState(s => ({ editForm: { ...s.editForm, type: event.target.value } }))">
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
            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Item Title:</label>
            <input type="text" id="edit-cit-title" style="width: 100%; padding: 8px; margin-bottom: 12px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" oninput="CitationStore.setState(s => ({ editForm: { ...s.editForm, title: event.target.value } }))">

            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Publication Title <span style="font-weight:normal;">(e.g., Journal Name)</span>:</label>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <input type="text" id="edit-cit-pub-title" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" oninput="CitationStore.setState(s => ({ editForm: { ...s.editForm, pubTitle: event.target.value } }))">
                <button id="btn-pick-pub" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 12px;" type="button">...</button>
            </div>

            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Authors:</label>
            <div id="edit-cit-author-pills" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;"></div>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <input type="text" id="edit-cit-author-input" placeholder="Last, First" style="flex: 1; padding: 8px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" oninput="CitationStore.setState(s => ({ editForm: { ...s.editForm, authorInput: event.target.value } }))">
                <button id="btn-pick-author" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 12px;" type="button">...</button>
                <button id="btn-add-cit-author" class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 12px;" type="button">➕ Add</button>
            </div>

            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Date <span style="font-weight:normal;">(YYYY or YYYY-MM-DD)</span>:</label>
            <input type="text" id="edit-cit-date" style="width: 100%; padding: 8px; margin-bottom: 15px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 0.9rem;" oninput="CitationStore.setState(s => ({ editForm: { ...s.editForm, dateStr: event.target.value } }))">

            <label style="font-weight:bold; font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:5px;">Other Metadata (CSL-JSON):</label>
            <textarea id="edit-citation-json" style="flex: 1; min-height: 200px; margin-bottom: 15px; font-family: monospace; font-size: 13px; padding: 10px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; resize: vertical;" oninput="CitationStore.setState(s => ({ editForm: { ...s.editForm, jsonStr: event.target.value } }))"></textarea>
        `;

        window.inSetu.ui.Factory.createModal({
            id: 'edit-citation-dynamic-modal',
            title: `Edit: <span style="color: var(--intent-warning); font-family: monospace;">[@${citation.id}]</span>`,
            body: bodyHtml,
            actions: [
                { label: '🗑️ Delete', style: 'danger', id: 'btn-delete-citation', onClick: async (e, modal) => {
                    await window._deleteDynamicCitation();
                    return true;
                }},
                { label: '💾 Save Changes', style: 'primary', id: 'btn-save-citation', onClick: async (e, modal) => {
                    await window._saveDynamicCitation();
                    return true;
                }}
            ]
        });
        const initialDateStr = (citation.issued && citation.issued['date-parts'] && citation.issued['date-parts'][0]) ? citation.issued['date-parts'][0].join('-') : '';

        const cslData = { ...citation };
        delete cslData._attachments;
        delete cslData.type;
        delete cslData.title;
        delete cslData['container-title'];
        delete cslData.author;
        delete cslData.issued;

        CitationStore.setState(s => ({
            currentEditAuthors: citation.author ? JSON.parse(JSON.stringify(citation.author)) : [],
            editForm: {
                ...s.editForm,
                type: citation.type || 'document',
                title: citation.title || '',
                pubTitle: citation['container-title'] || '',
                dateStr: initialDateStr,
                jsonStr: JSON.stringify(cslData, null, 4),
                authorInput: ''
            }
        }));

        setTimeout(() => {
            const state = CitationStore.getState().editForm;
            const ecType = document.getElementById('edit-cit-type');
            if (ecType) ecType.value = state.type;
            const ecTitle = document.getElementById('edit-cit-title');
            if (ecTitle) ecTitle.value = state.title;
            const ecPubTitle = document.getElementById('edit-cit-pub-title');
            if (ecPubTitle) ecPubTitle.value = state.pubTitle;
            const ecDate = document.getElementById('edit-cit-date');
            if (ecDate) ecDate.value = state.dateStr;
            const ecJson = document.getElementById('edit-citation-json');
            if (ecJson) ecJson.value = state.jsonStr;
        }, 50);

        renderAuthorPills();

        // Bind pickers dynamically since HTML was generated here
        document.getElementById('btn-pick-pub').onclick = () => {
            const { cachedPublications } = CitationStore.getState();
            openSelectorModal('Select Publication', cachedPublications, (val) => {
                CitationStore.setState(s => ({ editForm: { ...s.editForm, pubTitle: val } }));
                const el = document.getElementById('edit-cit-pub-title');
                if (el) el.value = val;
            });
        };

        document.getElementById('btn-pick-author').onclick = () => {
            const { cachedAuthors } = CitationStore.getState();
            openSelectorModal('Select Author', cachedAuthors, (val) => {
                CitationStore.setState(s => ({ editForm: { ...s.editForm, authorInput: val } }));
                const el = document.getElementById('edit-cit-author-input');
                if (el) el.value = val;
            });
        };
        document.getElementById('btn-add-cit-author').onclick = () => {
            const { editForm } = CitationStore.getState();
            const val = (editForm.authorInput || '').trim();
            if (!val) return;
            const parts = val.split(',').map(s => s.trim());
            const newAuthor = parts.length > 1 ? { family: parts[0], given: parts.slice(1).join(', ') } : { family: parts[0] };

            CitationStore.setState(s => ({ 
                currentEditAuthors: [...s.currentEditAuthors, newAuthor],
                editForm: { ...s.editForm, authorInput: '' }
            }));

            const input = document.getElementById('edit-cit-author-input');
            if (input) input.value = '';
            renderAuthorPills();
            if (input) input.focus();
        };
    };
window._saveDynamicCitation = async () => {
        const { activeEditCitation, currentEditAuthors, editForm } = CitationStore.getState();
        if (!activeEditCitation) return;
        const btn = document.getElementById('btn-save-citation');
        const origText = btn.innerText;

        const payload = (() => {
            try {
                return JSON.parse(editForm.jsonStr || '{}');
            } catch (e) {
                return null;
            }
        })();

        if (!payload) {
            alert("Invalid JSON format in the 'Other Metadata' box. Please check for syntax errors.");
            return;
        }

        // Re-inject explicitly edited fields
        payload.type = editForm.type || 'document';
        payload.title = (editForm.title || '').trim();
        const pubTitle = (editForm.pubTitle || '').trim();

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

        const dateStr = (editForm.dateStr || '').trim();
if (dateStr) {
            const parts = dateStr.split('-').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
            if (parts.length > 0) {
                payload.issued = { 'date-parts': [parts] };
            }
        } else {
            delete payload.issued;
        }

        // Ensure ID hasn't been maliciously or accidentally changed
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
                window.inSetu.ui.Factory.closeModal('edit-citation-dynamic-modal');
                // Surgical DOM Reconciliation
                const stateLib = CitationStore.getState().localLibrary;
                const idx = stateLib.findIndex(c => c.id === payload.id);
                if (idx !== -1) {
                    payload._attachments = stateLib[idx]._attachments;
                    stateLib[idx] = payload;
                    const card = document.querySelector(`.cit-card-wrapper[data-cit-id="${payload.id}"]`);
                    if (card) {
                        const tempFragment = document.createElement('div');
                        renderCards([payload], tempFragment, false, true);
                        if (tempFragment.firstElementChild) {
                            card.replaceWith(tempFragment.firstElementChild);
                        }
                    }
                } else {
                    loadMainLibrary();
                }
            } else {
                const err = await res.json();
                alert("Failed to save: " + (err.error || "Unknown error"));
            }
        } catch(e) {
            alert('Network error saving citation.');
        } finally {
            if (btn) btn.innerText = origText;
        }
    };
    window._deleteDynamicCitation = async () => {
        const { activeEditCitation } = CitationStore.getState();
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
                window.inSetu.ui.Factory.closeModal('edit-citation-dynamic-modal');
                // Surgical DOM Reconciliation
                const stateLib = CitationStore.getState().localLibrary;
                const idx = stateLib.findIndex(c => c.id === activeEditCitation.id);
                if (idx !== -1) stateLib.splice(idx, 1);

                const card = document.querySelector(`.cit-card-wrapper[data-cit-id="${activeEditCitation.id}"]`);
                if (card) card.remove();
            } else {
                alert("Failed to delete citation. Please verify the API endpoint exists.");
            }
        } catch (e) {
            alert('Network error deleting citation.');
        } finally {
            if (btn) btn.innerText = origText;
        }
    };
    const renderCards = (items, container, isExplore = false, append = false) => {
        if (!append) container.replaceChildren();
        if (items.length === 0 && !append) {
            container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No results.</p>';
            return;
        }
        items.forEach(c => {
            const card = document.createElement('div');
            card.className = 'file-card cit-card-wrapper';
            card.dataset.citId = c.id;
            const authors = c.author ? c.author.map(a => a.family).join(', ') : 'Unknown';
            const year = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] ? c.issued['date-parts'][0][0] : 'n.d.';

            const actionHtml = (() => {
                if (isExplore) {
                    const libState = CitationStore.getState().localLibrary;
                    const alreadyExists = libState.some(libItem => 
                        libItem.id === c.id || 
                        (libItem.URL && c.URL && libItem.URL.toLowerCase() === c.URL.toLowerCase())
                    );
                    if (alreadyExists) {
                        return `<div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.75rem; color: var(--intent-warning); font-weight: bold;">⚠️ In Library</span>
                            <button class="btn-sm btn-import-single" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' style="background: transparent; border: 1px solid var(--intent-warning); color: var(--intent-warning); padding: 2px 8px; margin: 0; font-size: 0.75rem;">Force Import</button>
                        </div>`;
                    }
                    return `<button class="btn-sm btn-import-single" data-json='${JSON.stringify(c).replace(/'/g, "&#39;")}' style="background: var(--intent-success); margin: 0; padding: 2px 8px;">📥 Import</button>`;
                }
                return `<button id="btn-notes-${c.id}" class="btn-sm btn-notes-single" style="background: var(--intent-highlight); margin: 0; margin-right: 5px; padding: 2px 8px;">📝 Notes</button><button class="btn-sm btn-edit-single" style="background: var(--intent-warning); margin: 0; margin-right: 5px; padding: 2px 8px;">✏️ Edit</button><button class="btn-sm btn-attach-single" style="background: var(--intent-primary); margin: 0; padding: 2px 8px;">📌 Pin to Repo</button>`;
            })();

            const attTags = !isExplore && c._attachments && c._attachments.length > 0
                ? c._attachments.map(a => `<span class="task-tag" style="background: var(--border);">${a.repo}${a.bucket !== 'None' ? ':'+a.bucket : ''}</span>`).join(' ')
                : '';

            card.innerHTML = `
                <div style="order: 1; display: flex; flex-direction: column;">
                    <div class="file-card-header">
                        <span class="file-title cit-title-push" style="color: var(--intent-highlight);">📄 ${c.title || 'Untitled'}</span>
                    </div>
                    <div class="file-desc" style="color: var(--text); font-weight: bold; margin-top: 5px;">${authors} (${year})</div>
                    <div class="file-desc" style="font-size: 0.8rem; margin-top: 8px;">ID: <span style="font-family: monospace; color: var(--intent-primary);">[@${c.id}]</span> ${c.open_access ? '🔓 OA' : ''}</div>
                    ${c.URL ? `<div class="file-desc" style="font-size: 0.8rem; margin-top: 4px;">🌐 <a href="${c.URL}" target="_blank" style="color: var(--intent-success); text-decoration: underline; word-break: break-all;">${c.URL}</a></div>` : ''}
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
                        e.target.style.background = "var(--intent-neutral)";
                        e.target.disabled = true;

                        // Surgically inject into local library state
                        const currentLib = CitationStore.getState().localLibrary;
                        if (!currentLib.some(c => c.id === payload.id)) {
                            currentLib.unshift(payload);

                            // Surgically prepend to DOM if the main library is visible
                            const mainList = document.getElementById('lib-main-list');
                            if (mainList) {
                                const tempFragment = document.createElement('div');
                                renderCards([payload], tempFragment, false, true);
                                if (tempFragment.firstElementChild) {
                                    mainList.prepend(tempFragment.firstElementChild);
                                }
                            }
                        }
                    } catch (err) {
                        e.target.innerText = "❌ Error";
                    }
                };
            });
        }
    };

    const loadMainLibrary = async () => {
        document.getElementById('lib-main-loading').style.display = 'block';
// Fetch metadata index for the generic UI selector
        fetch('/api/citations/index').then(r => r.json()).then(d => {
            if(d.publications) CitationStore.setState({ cachedPublications: d.publications });
            if(d.authors) CitationStore.setState({ cachedAuthors: d.authors });
        }).catch(e=>{});
try {
            const res = await fetch('/api/citations');
if (res.ok) {
                const data = await res.json();
                CitationStore.setState({ localLibrary: data.citations || [] });
                renderCards(CitationStore.getState().localLibrary, document.getElementById('lib-main-list'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            document.getElementById('lib-main-loading').style.display = 'none';
        }
    };
    // Main Tab Search & Filter
    document.getElementById('lib-main-search').addEventListener('input', (e) => {
        const state = CitationStore.getState();
        const norm = window.normalizeAccentText || (str => str.toLowerCase());
        const q = norm(e.target.value);
        const filtered = state.localLibrary.filter(c => {
            const matchesSearch = norm(c.title || "").includes(q) ||  
                                      norm(c.id || "").includes(q) || 
                                      norm(c.author ? c.author.map(a => a.family).join(" ") : "").includes(q);

            const atts = c._attachments || [];

            const matchesRepo = (() => {
                if (libPinnedRepos.has('ALL')) return true;
                return (libPinnedRepos.has('ORPHANS') && atts.length === 0) || atts.some(a => libPinnedRepos.has(a.repo));
            })();

            const matchesBucket = (() => {
                if (atts.length === 0 && libPinnedRepos.has('ORPHANS')) return true;
                if (libPinnedBuckets.has('ALL')) return true;
                return matchesRepo && atts.some(a => libPinnedBuckets.has(a.bucket) && (libPinnedRepos.has('ALL') || libPinnedRepos.has(a.repo)));
            })();

            return matchesSearch && matchesRepo && matchesBucket;
        });
        renderCards(filtered, document.getElementById('lib-main-list'));
    });
    // Dynamic Form Toggles
    const exploreSource = document.getElementById('lib-explore-source');
    const wrapField = document.getElementById('wrap-explore-field');
const wrapCat = document.getElementById('wrap-explore-category');
    const exploreSearch = document.getElementById('lib-explore-search');
    CitationStore.setState({ exploreSearchQuery: '', exploreSource: 'openalex', exploreField: 'all', exploreCategory: '' });
    exploreSearch.oninput = (e) => CitationStore.setState({ exploreSearchQuery: e.target.value });
    document.getElementById('lib-explore-field').onchange = (e) => CitationStore.setState({ exploreField: e.target.value });
    document.getElementById('lib-explore-category').oninput = (e) => CitationStore.setState({ exploreCategory: e.target.value });

    exploreSource.addEventListener('change', (e) => {
      const val = e.target.value;
      CitationStore.setState({ exploreSource: val });
      if (val === 'openalex') {
        wrapField.style.display = 'block';
        wrapCat.style.display = 'block';
        exploreSearch.placeholder = "Keywords, titles, or authors...";
      } else if (val === 'crossref') {

        wrapField.style.display = 'block';
        wrapCat.style.display = 'none';
        exploreSearch.placeholder = "DOIs, precise titles, or authors...";
        CitationStore.setState({ exploreCategory: '' });
        const crCatInput = document.getElementById('lib-explore-category');
        if (crCatInput) crCatInput.value = ''; // clear on hide
      } else {
        wrapField.style.display = 'none';
        wrapCat.style.display = 'none';

        exploreSearch.placeholder = "Keywords or Paper IDs...";
        CitationStore.setState({ exploreCategory: '' });

        const otherCatInput = document.getElementById('lib-explore-category');
        if (otherCatInput) otherCatInput.value = '';
      }
    });

    const performExploreSearch = async (loadMore = false) => {
      const state = CitationStore.getState();
      const query = state.exploreSearchQuery ? state.exploreSearchQuery.trim() : '';
      const source = state.exploreSource || 'openalex';
      const field = state.exploreField || 'all';
      const category = state.exploreCategory ? state.exploreCategory.trim() : '';

      if (!query && !category) return;

        const list = document.getElementById('lib-explore-list');
        const spinner = document.getElementById('lib-explore-loading');
        if (!loadMore) {
            list.replaceChildren();
            CitationStore.setState({ currentExplorePage: 1 });
        } else {
            const btn = document.getElementById('btn-explore-load-more');
            if (btn) btn.remove();
        }

        spinner.style.display = 'block';
        try {
            const pageToFetch = loadMore ? CitationStore.getState().currentExplorePage : 1;
            const res = await fetch(`/api/citations/search?q=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}&field=${encodeURIComponent(field)}&category=${encodeURIComponent(category)}&page=${pageToFetch}`);
if (res.ok) {
                const data = await res.json();
const citations = data.citations || [];
                renderCards(citations, list, true, loadMore);
// If we got exactly 20 results, assume there's another page
                if (citations.length === 20) {
                    const loadMoreBtn = document.createElement('button');
loadMoreBtn.id = 'btn-explore-load-more';
                    loadMoreBtn.className = 'btn-sm';
                    loadMoreBtn.style.background = 'var(--intent-neutral)';
                    loadMoreBtn.style.margin = '10px auto';
                    loadMoreBtn.style.display = 'block';
loadMoreBtn.innerText = '⬇️ Load More';
                    loadMoreBtn.onclick = () => {
                        CitationStore.setState({ currentExplorePage: pageToFetch + 1 });
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

        const stratNode = document.querySelector('input[name="lib-merge-strat"]:checked');
        const strat = stratNode ? stratNode.getAttribute('value') : 'overwrite';
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
    // Bind UI strictly to state updates via Selectors
    const updatePins = () => renderLibPins(CitationStore.getState());
    AppStore.subscribe((state) => state.allRepos, updatePins);
    AppStore.subscribe((state) => state.targetConfigs, updatePins);
    CitationStore.subscribe((state) => state.pinnedRepos, updatePins);
    CitationStore.subscribe((state) => state.pinnedBuckets, updatePins);

    if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
        window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
            if (tabId === 'library') {
                const ws = AppStore.getState().activeWorkspace || 'default';
                CitationStore.setState({
                    pinnedRepos: _safeParseSet(`insetu_lib_pinned_repos_${ws}`),
                    pinnedBuckets: _safeParseSet(`insetu_lib_pinned_buckets_${ws}`),
                    reposExpanded: false,
                    bucketsExpanded: {}
                });
                loadMainLibrary();
            }
        });
    }

    // Initial render
    setTimeout(updatePins, 100);
}
export async function addFileToLibrary(filename, content, filepath) {
  const defaultTitle = filename.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);

  const metadata = yamlMatch ? yamlMatch[1].split('\n').reduce((acc, l) => {
    if (l.startsWith('title:')) acc.title = l.replace('title:', '').replace(/['"]/g, '').trim();
    if (l.startsWith('source_url:')) acc.url = l.replace('source_url:', '').replace(/['"]/g, '').trim();
    if (l.startsWith('published_at:')) acc.dateStr = l.replace('published_at:', '').replace(/['"]/g, '').trim();
    return acc;
  }, { title: defaultTitle, url: '', dateStr: '' }) : { title: defaultTitle, url: '', dateStr: '' };

  const { title, url, dateStr } = metadata;
  const cslId = 'ref-' + Date.now();

  // DO NO HARM BYPASS: Check if this URL already exists in the local library
  const { citationLibraryCache } = CitationStore.getState();
  if (url && citationLibraryCache) {
    const existingRef = citationLibraryCache.find(c => c.URL && c.URL.toLowerCase() === url.toLowerCase());
    if (existingRef) {
      console.log("URL already exists in library. Bypassing metadata overwrite and tagging with existing ID:", existingRef.id);
      const eCslId = existingRef.id;

      // Extract existing year for the pretty tag
      const existingYear = (existingRef.issued && existingRef.issued['date-parts'] && existingRef.issued['date-parts'][0]) 
        ? existingRef.issued['date-parts'][0][0].toString() 
        : new Date().getFullYear().toString();

      const existingAuthor = existingRef.author && existingRef.author[0] ?
        existingRef.author[0].family.toLowerCase().replace(/[^a-z0-9]/g, '') : 'insetu';
      const prettyId = `${existingAuthor}${existingYear}`;

      const baseContent = yamlMatch 
        ? content.trim().replace(yamlMatch[0], yamlMatch[0] + `\n\n**Source Reference:** [@${prettyId}]`) 
        : `---\ntitle: "${title}"\n---\n\n**Source Reference:** [@${prettyId}]\n\n` + content.trim();

      return baseContent + `\n\n---\ncitations:\n  ${prettyId}: "${eCslId}"\n---`;
    }
  }

  const year = (dateStr && dateStr !== 'Unknown' && dateStr.match(/^(\d{4})/)) ? dateStr.match(/^(\d{4})/)[1] : new Date().getFullYear().toString();
  const prettyId = `insetu${year}`;

  const baseContent = yamlMatch 
    ? content.trim().replace(yamlMatch[0], yamlMatch[0] + `\n\n**Source Reference:** [@${prettyId}]`) 
    : `---\ntitle: "${title}"\n---\n\n**Source Reference:** [@${prettyId}]\n\n` + content.trim();

  const newContent = baseContent + `\n\n---\ncitations:\n  ${prettyId}: "${cslId}"\n---`;

  const parts = filepath.split('/');
  const repo = parts.length > 0 && parts[0] ? parts[0] : 'Workspace';
  const inferredBucket = parts.length > 1 && parts[1] ? parts[1] : 'None';
  const { targetConfigs } = AppStore.getState();

  const bucket = (() => {
    if (targetConfigs) {
      const repoCfg = targetConfigs.find(c => c.repo_dir === repo);
      if (repoCfg && repoCfg.sub_buckets) {
        const found = repoCfg.sub_buckets.find(b => 
          (b.dynamic_split_prefix && b.meta_map && b.meta_map[inferredBucket]) || 
          (!b.dynamic_split_prefix && b.id === inferredBucket)
        );
        if (found) return inferredBucket;
      }
    }
    return 'None';
  })();

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
export async function openCitationModal() {
    const bodyHtml = `
        <input type="text" id="citation-search-input" placeholder="Search library by author, title, or ID..." style="padding: 8px; margin-bottom: 10px;"
oninput="if(typeof onCitationSearchInput === 'function') onCitationSearchInput(this.value)">
        <div id="citation-results-list" style="display: flex; flex-direction: column; overflow-y: auto; flex: 1; gap: 5px; min-height: 200px;">
            <span style="color:var(--text-muted); font-style:italic;">Loading library...</span>
        </div>
    `;
    window.inSetu.ui.Factory.createModal({
        id: 'citation-insert-modal',
        title: 'Insert Citation',
        body: bodyHtml
    });
    try {
        const res = await fetch('/api/citations');
        if (res.ok) {
            const data = await res.json();
            CitationStore.setState({ citationLibraryCache: data.citations || [] });
            document.getElementById('citation-results-list').innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Library loaded. Type to search...</span>';
        }
    } catch(e) {
        document.getElementById('citation-results-list').innerHTML = '<span style="color:red;">Failed to load library.</span>';
    }
}
export function onCitationSearchInput(val) {
  window.ExtensionRegistry.utils.debounce('citationSearch', () => {
    const container = document.getElementById('citation-results-list');
    const norm = window.normalizeAccentText || (str => str.toLowerCase());
    const q = norm(val.trim());
    const { citationLibraryCache } = CitationStore.getState();

    if (!q || !citationLibraryCache) {
      container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Type to search...</span>';
      return;
    }

    const results = citationLibraryCache.filter(c => {
      const title = norm(c.title || "");
      const authors = norm(c.author ? c.author.map(a => a.family).join(" ") : "");
      const id = norm(c.id || "");
      return title.includes(q) || authors.includes(q) || id.includes(q);
    }).slice(0, 30);

    container.replaceChildren();
    if (results.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No citations found.</span>';
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
                <div style="font-size: 0.75rem; color: var(--text-muted);">${authors} (${year})</div>
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
    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const isMDE = (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined');
    const textArea = document.getElementById('modal-text');
    const text = isMDE ? mdeInstance.codemirror.getValue() : (textArea ? textArea.value : '');
    const backmatterRegex = /\n+---\n+citations:\n([\s\S]*?)\n---$/;
    const match = text.match(backmatterRegex);

    const citationsMap = {};
if (match) {
        const lines = match[1].split('\n');
        lines.forEach(l => {
            const parts = l.split(':');
            if (parts.length >= 2) {
                citationsMap[parts[0].trim()] = parts.slice(1).join(':').replace(/['"]/g, '').trim();
            }
        });
    }
    const finalPrettyId = (() => {
        if (!citationsMap[baseId] || citationsMap[baseId] === citation.id) return baseId;
        const findAvailable = (code) => {
            if (!citationsMap[baseId + String.fromCharCode(code)] || citationsMap[baseId + String.fromCharCode(code)] === citation.id) return code;
            return findAvailable(code + 1);
        };
        return baseId + String.fromCharCode(findAvailable(97));
    })();

    citationsMap[finalPrettyId] = citation.id;

    const newBackmatter = "\n\n---\ncitations:\n" + Object.keys(citationsMap).map(k => `  ${k}: "${citationsMap[k]}"\n`).join('') + "---";
    const updatedText = match ? text.replace(match[0], newBackmatter) : text + newBackmatter;
    const linkText = `[@${finalPrettyId}]`;
    if (isMDE) {
        const cm = mdeInstance.codemirror;
        const cursor = cm.getCursor();
        cm.setValue(updatedText);
        cm.setCursor(cursor);
        cm.replaceSelection(linkText);
        cm.focus();
    } else if (textArea) {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        textArea.value = updatedText.substring(0, start) + linkText + updatedText.substring(end);
        textArea.selectionStart = textArea.selectionEnd = start + linkText.length;
        textArea.focus();
        textArea.dispatchEvent(new Event('input'));
    }

        window.inSetu.ui.Factory.closeModal('citation-insert-modal');
        if (currentModalIsFS && window.saveModalFile) window.saveModalFile(true);
}
export async function syncDocumentCitations() {
    const mdeWrap = document.querySelector('.EasyMDEContainer');
    const isMDE = (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined');
    const textArea = document.getElementById('modal-text');
    const text = isMDE ? mdeInstance.codemirror.getValue() : (textArea ? textArea.value : '');

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
        const lines = match[1].split('\n');

        const oldMap = lines.reduce((acc, l) => {
            const parts = l.split(':');
            if (parts.length >= 2) {
                acc[parts[0].trim()] = parts.slice(1).join(':').replace(/['"]/g, '').trim();
            }
            return acc;
        }, {});

        const norm = window.normalizeAccentText || (str => str.toLowerCase());

        const syncResult = Object.entries(oldMap).reduce((acc, [oldPretty, trueId]) => {
            const citation = library.find(c => c.id === trueId);
            if (!citation) {
                acc.newMap[oldPretty] = trueId;
                acc.oldToNew[oldPretty] = oldPretty;
                return acc;
            }

            const author = citation.author && citation.author[0] ? citation.author[0].family : 'unknown';
            const year = citation.issued && citation.issued['date-parts'] ? citation.issued['date-parts'][0][0] : 'nd';
            const normalizedAuthor = norm(author).replace(/[^a-z0-9]/g, '');
            const baseId = `${normalizedAuthor}${year}`;
            const newPretty = (() => {
                if (!acc.newMap[baseId] || acc.newMap[baseId] === trueId) return baseId;
                const findAvailable = (code) => {
                    const candidate = baseId + String.fromCharCode(code);
                    if (!acc.newMap[candidate] || acc.newMap[candidate] === trueId) return candidate;
                    return findAvailable(code + 1);
                };
                return baseId + String.fromCharCode(findAvailable(97));
            })();

            acc.newMap[newPretty] = trueId;
            acc.oldToNew[oldPretty] = newPretty;
            if (oldPretty !== newPretty) acc.changesMade = true;
            return acc;
        }, { newMap: {}, oldToNew: {}, changesMade: false });

        if (!syncResult.changesMade) {
            alert("All citations are already up to date!");
            btn.innerText = origText;
            return;
        }

        const bodyText = Object.entries(syncResult.oldToNew).reduce((textAcc, [oldPretty, newPretty]) => {
            if (oldPretty !== newPretty) {
                const regex = new RegExp('(@)' + oldPretty + '\\b', 'g');
                return textAcc.replace(regex, '$1' + newPretty);
            }
            return textAcc;
        }, text.substring(0, match.index));

        const newBackmatter = "\n\n---\ncitations:\n" + Object.keys(syncResult.newMap).map(k => `  ${k}: "${syncResult.newMap[k]}"\n`).join('') + "---";
        const finalText = bodyText + newBackmatter;
        if (isMDE) {
            const cm = mdeInstance.codemirror;
            const cursor = cm.getCursor();
            cm.setValue(finalText);
            cm.setCursor(cursor);
        } else if (textArea) {
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
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    window.inSetu.extensions.Registry.registerUIHook('zone:modal-ext-menu', (data) => {
        if (data.isMarkdown) {
            data.menuItems.push({ label: 'Cite', icon: '📚', onClick: window.openCitationModal });
            data.menuItems.push({ label: 'Sync Refs', icon: '🔄', onClick: window.syncDocumentCitations });
        }
        return false;
    });
}

// --- REGISTER LIFECYCLE UNLOAD HOOK ---
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUnloadHook) {
    window.inSetu.extensions.Registry.registerUnloadHook('citations', () => {
        console.log("🧹 Evicting Citations Extension UI Canvas...");
        // Clear out personal library listings to prevent cross-tenant view bleeding
        const mainList = document.getElementById('lib-main-list');
        if (mainList) mainList.replaceChildren();

        // Reset explore panel back to its default pristine state
        const exploreList = document.getElementById('lib-explore-list');
        if (exploreList) {
            exploreList.replaceChildren();
            const placeholder = document.createElement('p');
            placeholder.style.cssText = 'color: var(--text-muted); font-style: italic;';
            placeholder.innerText = 'Search the open science index to discover and import citations.';
            exploreList.appendChild(placeholder);
        }
        
        // Clean out raw text import console log traces
        const importLog = document.getElementById('lib-import-log');
        if (importLog) importLog.innerText = '';
        // Dismiss standalone active citation modal frames if currently left open
        if (document.getElementById('lib-attach-dynamic-modal')) {
            window.inSetu.ui.Factory.closeModal('lib-attach-dynamic-modal');
        }
        if (document.getElementById('edit-citation-dynamic-modal')) {
            window.inSetu.ui.Factory.closeModal('edit-citation-dynamic-modal');
        }
    });
}
