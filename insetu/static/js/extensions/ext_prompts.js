// ext_prompts.js - Prompt Library Extension
import { createFileCard, buildFileTree, mdeInstance } from '../app.js';
import { AppStore } from '../store.js';

const promptsScreen = window.inSetu.extensions.Registry?.registerSubTab('context', 'prompts', 'Prompts');
if (promptsScreen) {
    promptsScreen.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <h2 style="margin: 0;">Prompt Library</h2>
            <div style="display: flex; gap: 10px;">
                <button class="btn-sm" style="background: var(--intent-primary); margin: 0; padding: 4px 12px; font-size: 0.9rem;" onclick="openNewPromptFolderModal()">+ Folder</button>
                <button class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 4px 12px; font-size: 0.9rem;" onclick="openNewPromptModal()">+ Prompt</button>
            </div>
        </div>
        <div id="prompts-list" style="display: flex; flex-direction: column;">
            <p style="color: var(--text-muted); font-style: italic;">Compile contexts to view available prompts.</p>
        </div>
    `;
}

export async function renderPromptsTab() {
    const container = document.getElementById('prompts-list');
    if (!container) return;
    container.replaceChildren();
    const loadEl = document.createElement('div');
    loadEl.className = 'spinner';
    loadEl.style.display = 'block';
    loadEl.innerText = 'Loading prompts...';
    container.appendChild(loadEl);
    try {
        const activeWs = AppStore.getState().activeWorkspace ||
'default';
        const res = await fetch(`/api/${activeWs}/prompts/list`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        AppStore.setState({
            gatherOptions: {
                ...AppStore.getState().gatherOptions,
                prompts: data.prompts || [],
                profileDir: data.profile_dir || ".insetu/profiles/default"
            }
        });
} catch (e) {
        console.error("Failed to fetch prompts:", e);
}

    container.replaceChildren();
    const { gatherOptions } = AppStore.getState();
    const rawPrompts = gatherOptions.prompts || [];
    
    if (rawPrompts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No prompts found in workspace.</p>';
        return;
    }
    const treePaths = rawPrompts.map(p => p.replace(/^prompts\//, ''));
    const tree = buildFileTree(treePaths);
    const initialCpPath = AppStore.getState().currentPromptsPath || [];

    const { current, resetPath } = initialCpPath.reduce((acc, p) => {
        if (acc.resetPath) return acc;
        if (acc.current[p] && !acc.current[p]._isFile) {
            return { current: acc.current[p], resetPath: false };
        }
        return { current: tree, resetPath: true };
    }, { current: tree, resetPath: false });

    const cpPath = resetPath ? [] : initialCpPath;
    if (resetPath) AppStore.setState({ currentPromptsPath: cpPath });

    if (cpPath.length > 0) {
        const headerDiv = document.createElement('div');
        headerDiv.style.display = 'flex';
        headerDiv.style.gap = '10px';
        headerDiv.style.marginBottom = '15px';
        headerDiv.style.alignItems = 'center';
        const upBtn = document.createElement('button');
        upBtn.className = 'btn-sm';
        upBtn.innerText = '⬆️ Up';
        upBtn.style.background = 'var(--intent-neutral)';
        upBtn.onclick = () => {
            const p = [...(AppStore.getState().currentPromptsPath || [])];
            p.pop();
            AppStore.setState({ currentPromptsPath: p });
            renderPromptsTab();
        };

        const pathText = document.createElement('span');
        pathText.style.fontFamily = 'monospace';
        pathText.style.color = 'var(--text)';
        pathText.style.opacity = '0.7';
        pathText.innerText = '/' + cpPath.join('/');
        headerDiv.appendChild(upBtn);
        headerDiv.appendChild(pathText);
        container.appendChild(headerDiv);
    }

    const keys = Object.keys(current).filter(k => k !== '_isFile').sort((a, b) => {
        const aIsDir = !current[a]._isFile;
        const bIsDir = !current[b]._isFile;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });
    
    keys.forEach(key => {
        const item = current[key];
        const isDir = !item._isFile;

        if (!isDir && (key === '.gitkeep' || key === '.keep')) return; 
        if (isDir) {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.cursor = 'pointer';
            card.innerHTML = `<span class="folder-label">📁 ${key}</span>`;
            card.onclick = () => {
                const p = [...(AppStore.getState().currentPromptsPath || [])];
                p.push(key);
                AppStore.setState({ currentPromptsPath: p });
                renderPromptsTab();
            };
            container.appendChild(card);
            return;
        }
        const pathPrefix = cpPath.length > 0 ? cpPath.join('/') + '/' : '';
        const filepath = `.insetu/prompts/${pathPrefix}${key}`;

        createFileCard({
            filename: filepath,
            displayName: key,
            description: '',
            isFS: true,
            isSource: true
        }, container);
    });
}
window.renderPromptsTab = renderPromptsTab;

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    // 1. Claim the Prompts Context payload metadata
    window.inSetu.extensions.Registry.registerUIHook('zone:context-metadata', (fileName) => {
        if (fileName === 'prompts_context.txt') return {
            cat: "Prompts & State",
            desc: "The Master Ingestion Prompt and CLI templates.",
            displayName: 'prompts_context.txt'
        };
        return null;
    });

    // 2. React to Tab Routing
    window.inSetu.extensions.Registry.registerUIHook('zone:subtab-changed', (data) => {
        if (data.parentId === 'context' && data.subId === 'prompts') {
            renderPromptsTab();
        }
        return false;
    });
    window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
        if (tabId === 'context' && localStorage.getItem('insetu_subtab_context') === 'prompts') {
            renderPromptsTab();
        }
        return false;
    });
    // 3. Native Toolbar Button for Prompt Embedding
    const tb = document.getElementById('edit-zone-buttons');
    if (tb && !document.getElementById('btn-embed-prompt')) {
        const embedBtn = document.createElement('button');
        embedBtn.id = 'btn-embed-prompt';
        embedBtn.className = 'btn-sm';
        embedBtn.style.cssText = 'background: var(--intent-primary); margin: 0; display: none;';
        embedBtn.innerText = '🧩 Embed';
        embedBtn.onclick = openPromptEmbedModal;
        tb.appendChild(embedBtn);
    }

    window.inSetu.extensions.Registry.registerUIHook('zone:modal-edit-toolbar', (data) => {
        const embedBtn = document.getElementById('btn-embed-prompt');
        if (embedBtn) embedBtn.style.display = (data.isMarkdown && data.filepath && data.filepath.includes('/prompts/')) ? 'block' : 'none';
        return false;
    });

    window.inSetu.extensions.Registry.registerUnloadHook('prompts', () => {
        const embedBtn = document.getElementById('btn-embed-prompt');
        if (embedBtn) embedBtn.remove();
    });

    // 4. Inject the copy button onto prompt file cards
    window.inSetu.extensions.Registry.registerUIHook('zone:file-card-actions', (data) => {
        if (data.filepath && data.filepath.includes('/prompts/')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn-sm';
            copyBtn.style.background = 'var(--intent-success)';
            copyBtn.style.margin = '0';
            copyBtn.innerText = '📋 Copy';
            copyBtn.onclick = async (e) => {
                e.stopPropagation();
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "Fetching...";
                try {
                    const activeWs = window.inSetu.stores.App.getState().activeWorkspace || 'default';
                    const res = await fetch(`/api/${activeWs}/prompts/resolve?file=` + encodeURIComponent(data.filepath));
                    if (!res.ok) throw new Error("Resolution failed.");
                    const text = await res.text();
                    await navigator.clipboard.writeText(text);
                    copyBtn.innerText = "✅ Copied!";
                } catch (err) {
                    copyBtn.innerText = "❌ Error";
                }
                setTimeout(() => { copyBtn.innerText = originalText; }, 3000);
            };
            data.actionsContainer.insertBefore(copyBtn, data.actionsContainer.firstChild);
        }
        return false;
    });
}
export function openNewPromptFolderModal() {
    if (window.openNewFolderModal) {
        const cpPath = AppStore.getState().currentPromptsPath || [];
        const prefix = cpPath.length > 0 ? `.insetu/prompts/${cpPath.join('/')}/` : ".insetu/prompts/";
        window.openNewFolderModal(prefix);
    }
}

export function openNewPromptModal() {
    if (window.openNewFileModal) {
        const cpPath = AppStore.getState().currentPromptsPath || [];
        const prefix = cpPath.length > 0 ? `.insetu/prompts/${cpPath.join('/')}/` : ".insetu/prompts/";
        window.openNewFileModal(prefix);
    }
}
export function openPromptEmbedModal() {
    if (window.openWorkspaceBrowser) {
        const { gatherOptions } = AppStore.getState();
        const prompts = gatherOptions.prompts || [];
        if (prompts.length === 0) {
            alert("No prompts available to embed. Compile contexts first.");
            return;
        }
        window.openWorkspaceBrowser({
            mode: 'file',
            title: 'Select Prompt to Embed',
            files: prompts,
            autoDrilldown: true,
            callback: (val) => {
                const embedString = `{{include_prompt: ${val}}}`;

                const textArea = document.getElementById('modal-text');
                const mdeWrap = document.querySelector('.EasyMDEContainer');
                const isMDE = (mdeWrap && mdeWrap.style.display !== 'none' && typeof mdeInstance !== 'undefined' && mdeInstance);

                if (isMDE) {
                    const cm = mdeInstance.codemirror;
                    cm.replaceSelection(embedString);
                    cm.focus();
                } else if (textArea) {
                    const start = textArea.selectionStart;
                    const end = textArea.selectionEnd;
                    textArea.value = textArea.value.substring(0, start) + embedString + textArea.value.substring(end);
                    textArea.selectionStart = textArea.selectionEnd = start + embedString.length;
                    textArea.focus();
                    textArea.dispatchEvent(new Event('input'));
                }
            }
        });
    } else {
        alert("File browser not available.");
    }
}

// Bind HTML click handlers to the global scope
window.openPromptEmbedModal = openPromptEmbedModal;
window.openNewPromptFolderModal = openNewPromptFolderModal;
window.openNewPromptModal = openNewPromptModal;