import {
    viewSourceFile,
    fetchAndCopy,
    fetchAndDownloadState
} from './app.js';
import { AppStore } from './store.js';
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';

// --- VFS BRIDGE STATE STORE (UDF LAYER) ---
export const BridgeStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            payloadText: '',
            detectedFiles: [],
            activeFiles: new Set(),

            setPayloadText: (text) => {
                const val = text.replace(/\u00A0/g, ' ');
                const regex = /^<<<<<<< FILE:\s*(.+)$/gm;
                let match;
                const files = new Set();
                while ((match = regex.exec(val)) !== null) {
                    files.add(match[1].trim());
                }
                const fileArray = Array.from(files);
                set({ 
                    payloadText: val, 
                    detectedFiles: fileArray,
                    activeFiles: new Set(fileArray) // Default all discovered targets to checked
                });
            },
            toggleFileSelection: (file) => set((state) => {
                const updated = new Set(state.activeFiles);
                if (updated.has(file)) updated.delete(file);
                else updated.add(file);
                return { activeFiles: updated };
            }),
            clearPayload: () => set({ payloadText: '', detectedFiles: [], activeFiles: new Set() })
        })),
        { name: 'BridgeStore' }
    )
);

export function resetStatus() {
    const sb = document.getElementById('status-box');
    if (sb) sb.innerHTML = "Ready...";
}

// Bind physical handlers contextually without reading direct text markers inside state logic
window.addEventListener('DOMContentLoaded', () => {
    const payloadTextarea = document.getElementById('payload');
    if (payloadTextarea) {
        payloadTextarea.addEventListener('paste', () => setTimeout(resetStatus, 50));
        payloadTextarea.addEventListener('input', (e) => {
            resetStatus();
            BridgeStore.getState().setPayloadText(e.target.value);
        });

        // Sync the textarea's value back if state changes downstream
        BridgeStore.subscribe((state) => state.payloadText, (text) => {
            if (payloadTextarea.value !== text) {
                payloadTextarea.value = text;
            }
        });
    }
});

function syncDOMToBridgeState(state) {
    const targetFilesDiv = document.getElementById('target-files');
    if (!targetFilesDiv) return;
    targetFilesDiv.innerHTML = '';

    state.detectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'checkbox-row';
        div.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 8px;';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'cb-' + index;
        cb.checked = state.activeFiles.has(file);
        cb.onclick = () => BridgeStore.getState().toggleFileSelection(file);

        const lbl = document.createElement('label');
        lbl.htmlFor = 'cb-' + index;
        lbl.className = 'file-label';
        lbl.innerText = file;
        lbl.style.cssText = 'flex: 1; word-break: break-all;';

        const actionContainer = document.createElement('div');

        div.appendChild(cb);
        div.appendChild(lbl);
        div.appendChild(actionContainer);
        targetFilesDiv.appendChild(div);
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        fetch(`/api/${activeWs}/fs/exists?file=` + encodeURIComponent(file))
            .then(res => res.json())
            .then(data => {
                if (data.exists) {
                    const viewBtn = document.createElement('button');
                    viewBtn.className = 'btn-sm';
                    viewBtn.style.cssText = 'margin: 0; padding: 4px 8px; font-size: 0.8rem; background: #0ea5e9;';
                    viewBtn.innerText = '📋 View';
                    viewBtn.onclick = (e) => {
                        e.preventDefault();
                        viewSourceFile(file, true);
                    };
                    actionContainer.appendChild(viewBtn);
                } else {
                    const badge = document.createElement('span');
                    badge.style.cssText = 'font-size: 0.75rem; color: #f59e0b; font-weight: bold; padding: 4px 8px;';
                    badge.innerText = '❓ Unknown';
                    actionContainer.appendChild(badge);
                }
            }).catch(e => console.error(e));
    });
}
let bridgeSyncTimeout = null;
BridgeStore.subscribe((state) => state.detectedFiles, () => {
    clearTimeout(bridgeSyncTimeout);
    bridgeSyncTimeout = setTimeout(() => {
        syncDOMToBridgeState(BridgeStore.getState());
    }, 300);
});

function isPatchSandwich(text) {
    const blocks = text.split('>>>>>>> REPLACE');
    for (let b of blocks) {
        if (!b.includes('<<<<<<< SEARCH') || !b.includes('=======')) continue;
        const searchPart = b.split('<<<<<<< SEARCH')[1].split('=======')[0];
        const replacePart = b.split('=======')[1];
        const sLines = searchPart.split('\n').map(l => l.trim()).filter(l => l && l !== '{{UNTIL}}');
        const rLines = replacePart.split('\n').map(l => l.trim()).filter(l => l && l !== '{{UNTIL}}');
        if (sLines.length === 0) continue;
        if (rLines.length === 0) return false;
        if (sLines[0] !== rLines[0] || sLines[sLines.length - 1] !== rLines[rLines.length - 1]) return false;
    }
    return true;
}
let globalBypassSandwich = false;

export function showConsole() {
    document.getElementById('bridge-input-area').style.display = 'none';
    document.getElementById('bridge-console-area').style.display = 'flex';
    document.getElementById('btn-paste').style.display = 'none';
    document.getElementById('btn-back').style.display = 'block';
}

export function showInput() {
    document.getElementById('bridge-input-area').style.display = 'flex';
    document.getElementById('bridge-console-area').style.display = 'none';
    document.getElementById('btn-paste').style.display = 'block';
    document.getElementById('btn-back').style.display = 'none';
}
export function sync(dryRunActive, bypassSandwich = false) {
    if (bypassSandwich) globalBypassSandwich = true;
    const bridgeState = BridgeStore.getState();
    const textVal = bridgeState.payloadText;
    const statusBox = document.getElementById('status-box');

    showConsole();
    if (!globalBypassSandwich && !isPatchSandwich(textVal)) {
        statusBox.innerHTML = `<span style="color: #f59e0b; font-weight: bold;">[!] WARNING: Patch lacks leading/trailing context (Not a "Patch Sandwich").</span><br><br>Your SEARCH and REPLACE blocks do not share the exact same top and bottom context lines.<br><br><button type="button" onclick="sync(${dryRunActive}, true)" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px;">⚠️ Do it anyway</button>`;
        return;
    }

    const activeFiles = Array.from(bridgeState.activeFiles);

    statusBox.innerText = "Processing streaming matrices...";
    const activeWs = AppStore.getState().activeWorkspace || 'default';
    fetch(`/api/${activeWs}/bridge/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: textVal,
                active_files: activeFiles,
                dry_run: dryRunActive,
                pinned_repos: Array.from(AppStore.getState().pinnedRepos)
            })
        })
        .then(res => res.text())
        .then(data => {
            let safeData = data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            safeData = safeData.replace(/\[ACTION_REQUIRED: UPDATE_PATH \|\s*([\s\S]*?)\s*\|\s*([\s\S]*?)\s*\]/g, (match, p1, p2) => {
                const safeP1 = p1.trim().replace(/\\/g, '\\\\');
                const safeP2 = p2.trim().replace(/\\/g, '\\\\');
                if (safeP1 === safeP2) return `<br><span style="color: #ef4444; font-weight: bold;">[!] Path collision detected. Please manually remove the folder prefix in your FILE target.</span>`;
                return `<br><button type="button" onclick="updateFilePath('${safeP1}', '${safeP2}')" style="background: #0284c7; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-size: 0.8rem; font-weight: bold;">[YES] Update Path & Retry</button>`;
            });
            safeData = safeData.replace(/\[ACTION_REQUIRED: COPY_ERROR \|\s*([\s\S]*?)\s*\]/g, (match, b64err) => {
                return `<br><button type="button" onclick="navigator.clipboard.writeText(atob('${b64err.trim()}')); this.innerText='✅ Error Copied!'; setTimeout(()=>this.innerText='📋 Copy Error', 2000)" class="btn-sm" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-size: 0.8rem; font-weight: bold;">📋 Copy Error</button>`;
            });
            safeData = safeData.replace(/\[ACTION_REQUIRED: COPY_STATE \|\s*([\s\S]*?)\s*\]/g, (match, p1) => {
                const safeP1 = p1.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `<br><div style="display: flex; gap: 10px; margin-top: 5px;">
                <button type="button" onclick="fetchAndCopy('${safeP1}', this)" class="btn-sm" style="background: #10b981; margin: 0;">📋 Copy State</button>
                <button type="button" onclick="fetchAndDownloadState('${safeP1}', this)" class="btn-sm" style="background: #0284c7; margin: 0;">⬇️ Download State</button>
            </div>`;
            });

            statusBox.innerHTML = safeData;

            if (!data.includes('[!]') && !data.includes('ACTION_REQUIRED') && !dryRunActive) {
                BridgeStore.getState().clearPayload();
            }
        }).catch(err => {
            statusBox.innerHTML = `<span style="color: red;">Error connecting to Bridge Backend: ${err.message}</span>`;
        });
}

export function updateFilePath(oldPath, newPath) {
    const currentVal = BridgeStore.getState().payloadText;
    const searchTargetOne = "<<<<<<< FILE: " + oldPath;
    const replaceTarget = "<<<<<<< FILE: " + newPath;

    const updatedVal = currentVal.split(searchTargetOne).join(replaceTarget);
    BridgeStore.getState().setPayloadText(updatedVal);
    sync(false, globalBypassSandwich);
}

window.sync = sync;
window.showConsole = showConsole;
window.showInput = showInput;
window.updateFilePath = updateFilePath;
window.resetStatus = resetStatus;
window.fetchAndCopy = fetchAndCopy;
window.fetchAndDownloadState = fetchAndDownloadState;
