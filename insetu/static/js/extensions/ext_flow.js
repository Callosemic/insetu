import { executeWorkspaceMutation, compileContexts, fetchAndCopy, fetchAndDownloadState } from '../app.js';
import { AppStore } from '../store.js';

const flowScreen = window.inSetu.extensions.Registry?.registerSubTab('context', 'flow', 'Flow');
if (flowScreen) {
    flowScreen.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <h2 style="margin: 0;">Context Batches & Workflows</h2>
            <button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 4px 12px; font-size: 0.9rem;" onclick="openEditBatchModal()">+ New Batch</button>
        </div>
        <div id="flow-loading" class="spinner" style="display: none;">Loading batches...</div>
        <div id="flow-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
    `;
}

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    window.inSetu.extensions.Registry.registerUIHook('zone:subtab-changed', (data) => {
        if (data.parentId === 'context' && data.subId === 'flow') {
            loadFlowBatches();
        }
        return false;
    });
    window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
        if (tabId === 'context' && localStorage.getItem('insetu_subtab_context') === 'flow') {
            loadFlowBatches();
        }
        return false;
    });
}

export async function loadFlowBatches() {
    const container = document.getElementById('flow-list');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="display:block;">Loading batches...</div>';
    try {
        const { activeWorkspace } = AppStore.getState();
        const res = await fetch(`/api/${activeWorkspace}/flow/batches`);
        const data = await res.json();
        AppStore.setState({
            gatherOptions: {
                ...AppStore.getState().gatherOptions,
                contexts: data.available_contexts || [],
                diffs: data.available_diffs || [],
                prompts: data.available_prompts || [],

                artifactsDir: data.artifacts_dir || ".insetu/profiles/default/data",
                profileDir: data.profile_dir || ".insetu/profiles/default"
            }
        });
        container.replaceChildren();
        if (!data.batches || data.batches.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No workflow batches defined.</p>';
            return;
        }

        const categories = {};
        data.batches.forEach(b => {
            const domain = b.domain || 'Workflows';
            if (!categories[domain]) categories[domain] = [];
            categories[domain].push(b);
        });
        const { categoryOrder } = AppStore.getState();
        const sortedCats = Object.keys(categories).sort((a, b) => {
            const iA = categoryOrder.indexOf(a) === -1 ? 999 : categoryOrder.indexOf(a);
            const iB = categoryOrder.indexOf(b) === -1 ? 999 : categoryOrder.indexOf(b);
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });
        
        sortedCats.forEach(catName => {
            const heading = document.createElement('div');
            heading.className = 'category-heading';
            heading.innerText = catName;
            container.appendChild(heading);
            categories[catName].forEach(b => {
                const card = document.createElement('div');
                card.className = 'file-card';
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    <div class="file-card-header">
                        <span class="file-title">📦 ${b.title || b.id}</span>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button class="btn-sm edit-batch-btn" style="background: var(--intent-primary); margin: 0; padding: 6px 12px; font-size: 0.85rem; font-weight: bold;">✏️ Edit</button>
                        </div>
                    </div>
                    <div class="file-desc">${b.includes.length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}</div>
                `;
                card.onclick = () => window.openBatchModal(b);

                const editBtn = card.querySelector('.edit-batch-btn');
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.openEditBatchModal(b);
                };

                container.appendChild(card);
            });
        });
    } catch (e) {
        container.innerHTML = `<p style="color:red;">Error loading batches: ${e.message}</p>`;
    }
}
window.openEditBatchModal = function(batch = null) {
    AppStore.setState({ 
        flowFormIncludes: batch && batch.includes ? [...batch.includes] : [],
        flowFormPrompt: batch && batch.include_prompt ? batch.include_prompt : '',
        flowFormId: batch ? batch.id : '',
        flowFormTitle: batch ? batch.title : '',
        flowFormDomain: batch && batch.domain ? batch.domain : 'Workflows',
        flowFormHasPrompt: batch ? !!batch.include_prompt : false,
        flowFormHasResponse: batch ? !!batch.response_path : false,
        flowFormResponsePath: batch && batch.response_path ? batch.response_path : '',
        flowFormArchivePath: batch && batch.archive_path ? batch.archive_path : ''
    });
    const { gatherOptions } = AppStore.getState();
    const allFiles = [...gatherOptions.diffs, ...gatherOptions.contexts];

    const renderSelectedIncludes = () => {
        const listContainer = document.getElementById('eb-selected-includes-list');
        if (!listContainer) return;

        const currentIncludes = AppStore.getState().flowFormIncludes;
        if (currentIncludes.length === 0) {
            listContainer.replaceChildren();
            const emptyState = document.createElement('div');
            emptyState.style.cssText = 'color: var(--text-muted); font-style: italic; font-size: 0.85rem; padding: 4px 0;';
            emptyState.innerText = 'No contexts selected.';
            listContainer.appendChild(emptyState);
            return;
        }
        listContainer.innerHTML = currentIncludes.map(inc => `
            <div style="font-family: monospace; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px solid var(--border); color: var(--text);">
                ${inc}
            </div>
        `).join('');
    };
    window._tempOpenSelectPrompt = () => {
        const { gatherOptions } = AppStore.getState();
        import('../ui.js').then(module => {
            module.openSelectorModal('Select a Prompt', gatherOptions.prompts, (val) => {
                AppStore.setState({ flowFormPrompt: val });
                const el = document.getElementById('eb-prompt-select');
                if (el) el.value = val;
            });
        });
    };
    window._tempOpenSelectContexts = () => {
        AppStore.setState({ tempSelectContexts: [...(AppStore.getState().flowFormIncludes || [])] });
        const checkboxesHtml = allFiles.reduce((acc, file, index) => {
            const isChecked = (AppStore.getState().tempSelectContexts || []).includes(file) ? 'checked' : '';
            return acc + `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border);">
                    <input type="checkbox" id="sc-cb-${index}" class="sc-file-checkbox" style="cursor: pointer; transform: scale(1.2);" ${isChecked}
                    onchange="window.inSetu.stores.App.setState(s => { const set = new Set(s.tempSelectContexts || []); set.has('${file}') ? set.delete('${file}') : set.add('${file}'); return { tempSelectContexts: Array.from(set) }; })">
                    <label for="sc-cb-${index}" style="cursor: pointer; word-break: break-all; flex: 1; font-family: monospace; font-size: 0.9rem; color: var(--text);">${file}</label>
                </div>
            `;
        }, '');
        window.inSetu.ui.Factory.createModal({
            id: 'select-contexts-modal-' + Date.now(),
            title: 'Select Contexts',
            body: `<div style="display: flex; flex-direction: column; gap: 5px;">${checkboxesHtml}</div>`,
            actions: [
                {
                    label: '✅ Confirm Selection',
                    style: 'primary',
                    onClick: (e, modal) => {
                        const newIncludes = AppStore.getState().tempSelectContexts || [];
                        AppStore.setState({ flowFormIncludes: newIncludes });
                        renderSelectedIncludes();
                        return false; 
                    }
                }
            ]
        });
    };
    const bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 20px; flex: 1; overflow-y: auto; padding-right: 5px;">
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Batch Title</label>
                    <input type="text" id="eb-title" value="${batch ? batch.title : ''}" placeholder="e.g. API Wrap-Up" style="padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;"
                    oninput="window.inSetu.stores.App.setState({ flowFormTitle: event.target.value }); if(!${!!batch}) { const newId = event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'); window.inSetu.stores.App.setState({ flowFormId: newId }); const idEl = document.getElementById('eb-id'); if(idEl) idEl.value = newId; }">
                </div>
                <div style="flex: 1; min-width: 150px; display: none;">
                    <input type="text" id="eb-id" value="${batch ? batch.id : ''}" style="display: none;" ${batch ? 'readonly' : ''} oninput="window.inSetu.stores.App.setState({ flowFormId: event.target.value })">
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Domain</label>
                    <input type="text" id="eb-domain" value="${batch ? (batch.domain || 'Workflows') : 'Workflows'}" placeholder="e.g. Workflows" style="padding: 10px; width: 100%; box-sizing: border-box;"
                    oninput="window.inSetu.stores.App.setState({ flowFormDomain: event.target.value })">
                </div>
            </div>

            <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: var(--text); font-size: 1.05rem;">1. Includes (Contexts & Diffs)</h4>
                </div>
                <div id="eb-selected-includes-list" style="display: flex; flex-direction: column; gap: 0; margin-bottom: 10px; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                </div>
                <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 8px 14px;" onclick="window._tempOpenSelectContexts()">📁 Select Contexts</button>
            </div>
            <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <input type="checkbox" id="eb-has-prompt" style="transform: scale(1.3); cursor: pointer;"
${batch && batch.include_prompt ? 'checked' : ''} onchange="window.inSetu.stores.App.setState(s => ({ flowFormHasPrompt: !s.flowFormHasPrompt })); document.getElementById('eb-prompt-wrapper').style.display = window.inSetu.stores.App.getState().flowFormHasPrompt ? 'block' : 'none';">
                    <h4 style="margin: 0; color: var(--text); cursor: pointer; font-size: 1.05rem;"
onclick="document.getElementById('eb-has-prompt').click()">2. Instruction Prompt</h4>
                </div>
                <div id="eb-prompt-wrapper" style="display: ${batch && batch.include_prompt ? 'block' : 'none'}; width: 100%;">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="eb-prompt-select" value="${batch && batch.include_prompt ? batch.include_prompt : ''}" readonly placeholder="No prompt selected..." style="flex: 1; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); font-family: monospace; box-sizing: border-box; cursor: not-allowed; margin: 0;">
<button class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 10px 14px;"
type="button" onclick="window._tempOpenSelectPrompt()">📁 Select Prompt</button>
<button class="btn-sm" style="background: var(--intent-neutral); margin: 0; padding: 10px 14px;"
type="button" title="Clear Prompt" onclick="window.inSetu.stores.App.setState({ flowFormPrompt: '' }); const pel = document.getElementById('eb-prompt-select'); if(pel) pel.value = '';">❌</button>
</div>
                </div>
            </div>
            <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">

        <input type="checkbox" id="eb-has-response" style="transform: scale(1.3); cursor: pointer;"
${batch && batch.response_path ?
'checked' : ''} onchange="window.inSetu.stores.App.setState(s => ({ flowFormHasResponse: !s.flowFormHasResponse })); document.getElementById('eb-response-wrapper').style.display = window.inSetu.stores.App.getState().flowFormHasResponse ? 'block' : 'none';">
                    <h4 style="margin: 0; color: var(--text); cursor: pointer; font-size: 1.05rem;"
onclick="document.getElementById('eb-has-response').click()">3. Response Text Box</h4>
                </div>
                <div id="eb-response-wrapper" style="display: ${batch && batch.response_path ? 'block' : 'none'}; width: 100%;">
                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Response Path</label>
                    <input type="text" id="eb-response-path" value="${batch && batch.response_path ? batch.response_path : ''}" placeholder="e.g. sotu/sotu_{date}.current.md" style="padding: 10px; width: 100%; font-family: monospace; margin: 0; margin-bottom: 15px; box-sizing: border-box; background: var(--input-bg); border: 1px solid var(--border); color: var(--text);"
                    oninput="window.inSetu.stores.App.setState({ flowFormResponsePath: event.target.value })">

                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Archive Path (Optional)</label>
                    <input type="text" id="eb-archive-path" value="${batch && batch.archive_path ? batch.archive_path : ''}" placeholder="e.g. sotu/archive/" style="padding: 10px; width: 100%; font-family: monospace; margin: 0; box-sizing: border-box; background: var(--input-bg); border: 1px solid var(--border); color: var(--text);"
                    oninput="window.inSetu.stores.App.setState({ flowFormArchivePath: event.target.value })">
                </div>
            </div>
        </div>
    `;

    const actions = [];
    if (batch) {
        actions.push({
            label: '🗑️ Delete Batch',
            style: 'danger',
            id: 'eb-delete-btn',
            onClick: async (e, modal) => {
                if (!confirm("Delete this workflow batch?")) return true;
                await window.deleteEditBatch(batch.id, modal.id);
                return false;
            }
        });
    }
    actions.push({
        label: '💾 Save Batch Configuration',
        style: 'primary',
        id: 'eb-save-btn',
        onClick: async (e, modal) => {
            await window.saveEditBatch(modal.id, !!batch);
            return true;
        }
    });

    window.inSetu.ui.Factory.createModal({
        id: 'edit-batch-modal-' + Date.now(),
        title: batch ? `Edit Batch: ${batch.title || batch.id}` : 'Create New Batch',
        body: bodyHtml,
        actions: actions
    });

    renderSelectedIncludes();
};

window.deleteEditBatch = async function(batchId, modalId) {
    const btn = document.getElementById('eb-delete-btn');
    if (btn) btn.innerText = 'Deleting...';
    try {
        const { activeWorkspace } = AppStore.getState();
        const res = await fetch(`/api/${activeWorkspace}/flow/batches/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: batchId })
        });
        if (res.ok) {
            window.inSetu.ui.Factory.closeModal(modalId);
            loadFlowBatches();
        } else {
            alert("Failed to delete batch.");
        }
    } catch (e) {
        alert("Network error: " + e.message);
    }
};
window.saveEditBatch = async function(modalId, isEditing) {
    const state = AppStore.getState();
    const id = (state.flowFormId || '').trim();
    const title = (state.flowFormTitle || '').trim();
    const domain = (state.flowFormDomain || '').trim() || "Workflows";

    if (!id || !title) return alert("Batch ID and Title are required.");

    const includes = state.flowFormIncludes || [];
    const payload = { id, title, domain, includes };

    if (state.flowFormHasPrompt) {
        const promptVal = state.flowFormPrompt || '';
        if (promptVal) payload.include_prompt = promptVal;
    }

    if (state.flowFormHasResponse) {
        const resVal = (state.flowFormResponsePath || '').trim();
        if (resVal) payload.response_path = resVal;
        const archVal = (state.flowFormArchivePath || '').trim();
        if (archVal) payload.archive_path = archVal;
    }
    const btn = document.getElementById('eb-save-btn');
    const origText = btn ? btn.innerText : 'Save';
    if (btn) btn.innerText = 'Saving...';
    try {
        const { activeWorkspace } = AppStore.getState();
        const res = await fetch(`/api/${activeWorkspace}/flow/batches/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            window.inSetu.ui.Factory.closeModal(modalId);
            loadFlowBatches();
        } else {
            alert("Failed to save batch.");
        }
    } catch (e) {
        alert("Network error: " + e.message);
    } finally {
        if (document.getElementById('eb-save-btn')) document.getElementById('eb-save-btn').innerText = origText;
    }
};

window.openBatchModal = function(batch) {
    const { gatherOptions, activeWorkspace } = AppStore.getState();
    const artifactsDir = gatherOptions.artifactsDir || ".insetu/profiles/default/data";
    const profileDir = gatherOptions.profileDir || ".insetu/profiles/default";
    const contextFile = `${batch.id}_context.txt`;

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
    const dStr = localISOTime.replace(/-/g, '').replace(/:/g, '').replace('T', '_').split('.')[0];
    const finalPath = batch.response_path ? batch.response_path.replace('{date}', dStr) : '';

    const includesHtml = (batch.includes && batch.includes.length > 0) ?
        batch.includes.map(inc => `<li style="padding: 2px 0;">${inc}</li>`).join('') :
        '<li style="color: var(--intent-danger); list-style: none; margin-left: -20px;">No files mapped to this batch.</li>';

    const bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 20px; flex: 1; overflow-y: auto; padding-right: 5px;">
            <div id="batch-context-section">
                <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">1. Compiled Context Payload</h4>
                <div style="background: var(--input-bg); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--border); margin-bottom: 10px;">
                    <ul style="margin: 0; font-family: monospace; font-size: 0.85rem; color: var(--text); opacity: 0.8; padding-left: 20px;">${includesHtml}</ul>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="batch-copy-context-btn" class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 8px 14px;">📋 Copy Context</button>
                    <button id="batch-dl-context-btn" class="btn-sm" draggable="true" style="background: var(--intent-primary); margin: 0; padding: 8px 14px;">⬇️ Download .txt</button>
                </div>
            </div>

            ${batch.include_prompt ? `
            <div id="batch-prompt-section">
                <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.05rem;">2.
Instruction Prompt</h4>
                <textarea id="batch-prompt-text" style="height: 150px; margin-bottom: 10px; width: 100%; box-sizing: border-box; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); padding: 10px; border-radius: 4px;"
readonly>Loading prompt...</textarea>
                <button id="batch-copy-prompt-btn" class="btn-sm" style="background: var(--intent-highlight); margin: 0; padding: 8px 14px;"
onclick="navigator.clipboard.writeText(window.inSetu.stores.App.getState().batchPromptText || ''); this.innerText='✅ Copied!'; setTimeout(()=>this.innerText='📋 Copy Prompt', 2000);">📋 Copy Prompt</button>
            </div>` : ''}

            ${batch.response_path ? `
            <div id="batch-response-section">
                <h4 style="margin: 0 0 5px 0; color: var(--text); font-size: 1.05rem;">3. LLM Response Integration</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">Paste response to save to: <code style="word-break: break-all; color: var(--intent-success);">${finalPath}</code></p>
                <textarea id="batch-response-text" style="flex: 1; min-height: 250px; margin-bottom: 10px; margin-top: 0; width: 100%; box-sizing: border-box; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); padding: 10px; border-radius: 4px;" placeholder="Paste LLM response here..."></textarea>
                <button id="batch-save-response-btn" class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 15px; font-size: 1.1rem; font-weight: bold; width: 100%;">💾 Save Response</button>
            </div>` : ''}
        </div>
    `;

    const modalId = window.inSetu.ui.Factory.createModal({
        id: 'batch-modal-' + Date.now(),
        title: `Batch Workflow: ${batch.title || batch.id}`,
        body: bodyHtml
    });
    
    document.getElementById('batch-copy-context-btn').onclick = function() { window.fetchAndCopy(`${artifactsDir}/workflows/${contextFile}`, this); };

    const dlBtn = document.getElementById('batch-dl-context-btn');
    dlBtn.onclick = function() { window.fetchAndDownloadState(`${artifactsDir}/workflows/${contextFile}`, this); };
    dlBtn.classList.add('ui-draggable-export');
    dlBtn.dataset.filename = contextFile;
    dlBtn.dataset.fetchUrl = `/api/${activeWorkspace}/bridge/fetch?file=${encodeURIComponent(artifactsDir + '/workflows/' + contextFile)}`;
    if (batch.include_prompt) {
        const promptTextArea = document.getElementById('batch-prompt-text');
        const promptPath = profileDir + '/' + batch.include_prompt;
        fetch(`/api/${activeWorkspace}/prompts/resolve?file=${encodeURIComponent(promptPath)}`)
            .then(res => res.ok ? res.text() : Promise.reject(new Error("Prompt resolution failed or Prompts extension is inactive")))
            .then(text => {
                AppStore.setState({ batchPromptText: text });
                promptTextArea.value = text;
            })
            .catch(err => {
                const errorMsg = `[Error: ${err.message}]`;
                AppStore.setState({ batchPromptText: errorMsg });
                promptTextArea.value = errorMsg;
            });
    }
    if (batch.response_path) {
        document.getElementById('batch-save-response-btn').onclick = () => {
            const contentEl = document.getElementById('batch-response-text');
            const content = contentEl ? contentEl.value : '';
            if (!content.trim()) return alert('Please paste a response.');
            const payload = {
                filepath: `${artifactsDir}/${finalPath}`,
                content: content,
                original_response_path: batch.response_path
            };
            if (batch.archive_path) {
                payload.archive_path = `${artifactsDir}/${batch.archive_path}`;
            }
            window.executeWorkspaceMutation(`/api/${activeWorkspace}/fs/save`, payload, {
                btnId: 'batch-save-response-btn',
                loadingText: 'Saving...',
                onSuccess: () => {
                    window.inSetu.ui.Factory.closeModal(modalId);
                    if(window.compileContexts) window.compileContexts();
                }
            });
        };
    }
};