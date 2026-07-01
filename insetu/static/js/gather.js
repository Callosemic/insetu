import {
    executeWorkspaceMutation,
    compileContexts,
    fetchAndCopy,
    fetchAndDownloadState
} from './app.js';
import { AppStore } from './store.js';

export async function loadGatherBatches() {
    const container = document.getElementById('gather-list');
    container.innerHTML = '<div class="spinner" style="display:block;">Loading batches...</div>';
    try {
        const res = await fetch('/api/batches');
        const data = await res.json();
        AppStore.setState({
            gatherOptions: {
                contexts: data.available_contexts || [],
                diffs: data.available_diffs || [],
                prompts: data.available_prompts || [],
                artifactsDir: data.artifacts_dir || ".insetu/profiles/default/data",
                profileDir: data.profile_dir || ".insetu/profiles/default"
            }
        });
        container.innerHTML = '';
        if (!data.batches || data.batches.length === 0) {
            container.innerHTML = '<p style="color: #888;">No context batches defined in workflows.json.</p>';
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
            let iA = categoryOrder.indexOf(a);
            let iB = categoryOrder.indexOf(b);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
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
                            <button class="btn-sm edit-batch-btn" style="background: #0ea5e9; margin: 0; padding: 6px 12px; font-size: 0.85rem; font-weight: bold;">✏️ Edit</button>
                        </div>
                    </div>
                    <div class="file-desc">${b.includes.length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}</div>
                `;
                card.onclick = () => openBatchModal(b);

                const editBtn = card.querySelector('.edit-batch-btn');
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    openEditBatchModal(b);
                };

                container.appendChild(card);
            });
        });
    } catch (e) {
        container.innerHTML = `<p style="color:red;">Error loading batches: ${e.message}</p>`;
    }
}

export function openEditBatchModal(batch = null) {
    document.getElementById('edit-batch-title').innerText = batch ? `Edit Batch: ${batch.title || batch.id}` : 'Create New Batch';
    document.getElementById('eb-title').value = batch ? batch.title : '';
    document.getElementById('eb-id').value = batch ? batch.id : '';
    document.getElementById('eb-domain').value = batch ? (batch.domain || 'Workflows') : 'Workflows';
document.getElementById('eb-id').readOnly = !!batch;
// Prevent renaming IDs after creation to avoid orphans

const listDiv = document.getElementById('eb-includes-list');
listDiv.innerHTML = '';
const { gatherOptions } = AppStore.getState();
const allFiles = [...gatherOptions.diffs, ...gatherOptions.contexts];
const includesSet = new Set(batch ? batch.includes : []);
    allFiles.forEach((file, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '4px 0';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `eb-cb-${index}`;
        cb.value = file;
        cb.checked = includesSet.has(file);
        cb.className = 'eb-file-checkbox';
        cb.style.cursor = 'pointer';

        const lbl = document.createElement('label');
        lbl.htmlFor = `eb-cb-${index}`;
        lbl.innerText = file;
        lbl.style.cursor = 'pointer';
        lbl.style.wordBreak = 'break-all';

        row.appendChild(cb);
        row.appendChild(lbl);
        listDiv.appendChild(row);
    });
    const promptSelect = document.getElementById('eb-prompt-select');
    promptSelect.innerHTML = '<option value="">-- Select a prompt --</option>';
    gatherOptions.prompts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.innerText = p;
        promptSelect.appendChild(opt);
    });
    const hasPrompt = document.getElementById('eb-has-prompt');
    const promptWrapper = document.getElementById('eb-prompt-wrapper');
    if (batch && batch.include_prompt) {
        hasPrompt.checked = true;
        promptWrapper.style.display = 'block';
        promptSelect.value = batch.include_prompt;
    } else {
        hasPrompt.checked = false;
        promptWrapper.style.display = 'none';
        promptSelect.value = '';
    }
    const hasResponse = document.getElementById('eb-has-response');
    const responseWrapper = document.getElementById('eb-response-wrapper');
    const responseInput = document.getElementById('eb-response-path');
    const archiveInput = document.getElementById('eb-archive-path');
    if (batch && batch.response_path) {
        hasResponse.checked = true;
        responseWrapper.style.display = 'block';
        responseInput.value = batch.response_path;
        if (archiveInput) archiveInput.value = batch.archive_path || '';
    } else {
        hasResponse.checked = false;
        responseWrapper.style.display = 'none';
        responseInput.value = '';
        if (archiveInput) archiveInput.value = '';
    }

    document.getElementById('edit-batch-modal').style.display = 'block';
}

export async function saveEditBatch() {
    const id = document.getElementById('eb-id').value.trim();
    const title = document.getElementById('eb-title').value.trim();
    const domain = document.getElementById('eb-domain').value.trim() || "Workflows";

    if (!id || !title) return alert("Batch ID and Title are required.");

    const includes = [];
    document.querySelectorAll('.eb-file-checkbox:checked').forEach(cb => includes.push(cb.value));
    const payload = {
        id: id,
        title: title,
        domain: domain,
        includes: includes
    };
    if (document.getElementById('eb-has-prompt').checked) {
        const promptVal = document.getElementById('eb-prompt-select').value;
        if (promptVal) payload.include_prompt = promptVal;
    }
    if (document.getElementById('eb-has-response').checked) {
        const resVal = document.getElementById('eb-response-path').value.trim();
        if (resVal) payload.response_path = resVal;

        const archVal = document.getElementById('eb-archive-path').value.trim();
        if (archVal) payload.archive_path = archVal;
    }

    const btn = document.getElementById('eb-save-btn');
    const origText = btn.innerText;
    btn.innerText = 'Saving...';
    try {
        const res = await fetch('/api/batches/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            document.getElementById('edit-batch-modal').style.display = 'none';
            loadGatherBatches();
        } else {
            alert("Failed to save batch.");
        }
    } catch (e) {
        alert("Network error: " + e.message);
    } finally {
        btn.innerText = origText;
    }
}

export function openBatchModal(batch) {
    document.getElementById('batch-modal-title').innerText = batch.title || batch.id;

    const includesList = document.getElementById('batch-includes-list');
    includesList.innerHTML = '';
    if (batch.includes && batch.includes.length > 0) {
        batch.includes.forEach(inc => {
            const li = document.createElement('li');
            li.innerText = inc;
            includesList.appendChild(li);
        });
    } else {
        includesList.innerHTML = '<li style="color: #ef4444; list-style: none; margin-left: -20px;">No files mapped to this batch.</li>';
    }
    const contextFile = `${batch.id}_context.txt`;
    const copyCtxBtn = document.getElementById('batch-copy-context-btn');
    const dlCtxBtn = document.getElementById('batch-dl-context-btn');
    const { gatherOptions } = AppStore.getState();
    const artifactsDir = gatherOptions.artifactsDir || ".insetu/profiles/default/data";

    copyCtxBtn.onclick = () => fetchAndCopy(`${artifactsDir}/workflows/${contextFile}`, copyCtxBtn);
    dlCtxBtn.onclick = () => fetchAndDownloadState(`${artifactsDir}/workflows/${contextFile}`, dlCtxBtn);
    const promptSec = document.getElementById('batch-prompt-section');
    const profileDir = gatherOptions.profileDir || ".insetu/profiles/default";
    if (batch.include_prompt) {
        promptSec.style.display = 'block';
        const promptTextArea = document.getElementById('batch-prompt-text');
        promptTextArea.value = "Loading prompt...";

        // Dynamically fetch the prompt content JIT
        fetch(`/api/bridge/fetch?file=${encodeURIComponent(profileDir + '/' + batch.include_prompt)}`)
            .then(res => res.ok ? res.text() : Promise.reject(new Error("File not found")))
            .then(text => promptTextArea.value = text)
            .catch(err => promptTextArea.value = `[Error: ${err.message}]`);
    } else {
        promptSec.style.display = 'none';
    }

    const resSec = document.getElementById('batch-response-section');
    if (batch.response_path) {
        resSec.style.display = 'block';
        document.getElementById('batch-response-text').value = '';

        const now = new Date();
        // Format YYYYMMDD_HHMMSS deterministically based on local time
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
        const dStr = localISOTime.replace(/-/g, '').replace(/:/g, '').replace('T', '_').split('.')[0];

        const finalPath = batch.response_path.replace('{date}', dStr);
        document.getElementById('batch-response-path-display').innerText = finalPath;
        const saveBtn = document.getElementById('batch-save-response-btn');
        saveBtn.onclick = () => {
            const content = document.getElementById('batch-response-text').value;
            if (!content.trim()) return alert('Please paste a response.');
            const payload = {
                filepath: `${artifactsDir}/${finalPath}`,
                content: content,
                original_response_path: batch.response_path
            };
            if (batch.archive_path) {
                payload.archive_path = `${artifactsDir}/${batch.archive_path}`;
            }

            executeWorkspaceMutation('/api/fs/save', payload, {
                btnId: 'batch-save-response-btn',
                loadingText: 'Saving...',
                onSuccess: () => {
                    document.getElementById('batch-modal').style.display = 'none';
                    compileContexts();
                }
            });
        };
    } else {
        resSec.style.display = 'none';
    }
    document.getElementById('batch-modal').style.display = 'block';
}
export function openNewPromptModal() {
    const { gatherOptions } = AppStore.getState();
    const profileDir = gatherOptions.profileDir || ".insetu/profiles/default";
    if (window.openNewFileModal) {
        window.openNewFileModal(`${profileDir}/prompts/`);
    }
}

// Bind HTML click handlers to the global scope
window.openNewPromptModal = openNewPromptModal;
window.openEditBatchModal = openEditBatchModal;
window.saveEditBatch = saveEditBatch;
window.openBatchModal = openBatchModal;
