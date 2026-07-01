import {
    viewSourceFile,
    fetchAndCopy,
    fetchAndDownloadState
} from './app.js';
import { AppStore } from './store.js';

export function resetStatus() {
    const sb = document.getElementById('status-box');
    if (sb) sb.innerHTML = "Ready...";
}
const payloadTextarea = document.getElementById('payload');
if (payloadTextarea) {
    payloadTextarea.addEventListener('paste', () => setTimeout(resetStatus, 50));
    payloadTextarea.addEventListener('input', () => {
        const val = payloadTextarea.value.replace(/\u00A0/g, ' ');
        const regex = /^<<<<<<< FILE:\s*(.+)$/gm;
        let match;
        const files = new Set();
        while ((match = regex.exec(val)) !== null) {
            files.add(match[1].trim());
        }
        renderCheckboxes(Array.from(files));
    });
}

function renderCheckboxes(files) {
    const targetFilesDiv = document.getElementById('target-files');
    if (!targetFilesDiv) return;
    targetFilesDiv.innerHTML = '';
    files.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'checkbox-row';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'cb-' + index;
        cb.checked = true;
        cb.dataset.file = file;

        const lbl = document.createElement('label');
        lbl.htmlFor = 'cb-' + index;
        lbl.className = 'file-label';
        lbl.innerText = file;
        lbl.style.flex = '1';
        lbl.style.wordBreak = 'break-all';

        const actionContainer = document.createElement('div');

        div.appendChild(cb);
        div.appendChild(lbl);
        div.appendChild(actionContainer);
        targetFilesDiv.appendChild(div);

        // Asynchronously verify file existence via lightweight headers
        fetch('/api/bridge/fetch?file=' + encodeURIComponent(file), {
                method: 'HEAD'
            })
            .then(res => {
                if (res.ok) {
                    const viewBtn = document.createElement('button');
                    viewBtn.className = 'btn-sm';
                    viewBtn.style.margin = '0';
                    viewBtn.style.padding = '4px 8px';
                    viewBtn.style.fontSize = '0.8rem';
                    viewBtn.style.background = '#0ea5e9';
                    viewBtn.innerText = '📋 View';
                    viewBtn.onclick = (e) => {
                        e.preventDefault();
                        viewSourceFile(file, true);
                    };
                    actionContainer.appendChild(viewBtn);
                } else {
                    const badge = document.createElement('span');
                    badge.style.fontSize = '0.75rem';
                    badge.style.color = '#f59e0b';
                    badge.style.fontWeight = 'bold';
                    badge.style.padding = '4px 8px';
                    badge.innerText = '❓ Unknown';
                    actionContainer.appendChild(badge);
                }
            }).catch(e => console.error(e));
    });
}

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
    const textVal = payloadTextarea.value.replace(/\u00A0/g, ' ');
    const statusBox = document.getElementById('status-box');

    showConsole();
    if (!globalBypassSandwich && !isPatchSandwich(textVal)) {
        statusBox.innerHTML = `<span style="color: #f59e0b; font-weight: bold;">[!] WARNING: Patch lacks leading/trailing context (Not a "Patch Sandwich").</span><br><br>Your SEARCH and REPLACE blocks do not share the exact same top and bottom context lines.<br><br><button type="button" onclick="sync(${dryRunActive}, true)" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px;">⚠️ Do it anyway</button>`;
        return;
    }

    const activeFiles = [];
    const checkboxes = document.getElementById('target-files').querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        if (cb.checked) activeFiles.push(cb.dataset.file);
    });

    statusBox.innerText = "Processing streaming matrices...";
    fetch('/api/bridge/sync', {
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
            safeData = safeData.replace(/\[ACTION_REQUIRED: UPDATE_PATH \| (.*?) \| (.*?) \]/g, (match, p1, p2) => {
                const safeP1 = p1.replace(/\\/g, '\\\\');
                const safeP2 = p2.replace(/\\/g, '\\\\');
                if (safeP1 === safeP2) return `<br><span style="color: #ef4444; font-weight: bold;">[!] Path collision detected. Please manually remove the folder prefix in your FILE target.</span>`;
                return `<br><button type="button" onclick="updateFilePath('${safeP1}', '${safeP2}')" style="background: #0284c7; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-size: 0.8rem; font-weight: bold;">[YES] Update Path & Retry</button>`;
            });
            safeData = safeData.replace(/\[ACTION_REQUIRED: COPY_ERROR \| (.*?) \]/g, (match, b64err) => {
                return `<br><button type="button" onclick="navigator.clipboard.writeText(atob('${b64err}')); this.innerText='✅ Error Copied!'; setTimeout(()=>this.innerText='📋 Copy Error', 2000)" class="btn-sm" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-size: 0.8rem; font-weight: bold;">📋 Copy Error</button>`;
            });
            safeData = safeData.replace(/\[ACTION_REQUIRED: COPY_STATE \| (.*?) \]/g, (match, p1) => {
                const safeP1 = p1.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `<br><div style="display: flex; gap: 10px; margin-top: 5px;">
                <button type="button" onclick="fetchAndCopy('${safeP1}', this)" class="btn-sm" style="background: #10b981; margin: 0;">📋 Copy State</button>

                <button type="button" onclick="fetchAndDownloadState('${safeP1}', this)" class="btn-sm" style="background: #0284c7;
margin: 0;">⬇️ Download State</button>
            </div>`;
            });

            statusBox.innerHTML = safeData;

            // Micro-Interaction: Auto-clear payload if no errors or action flags occurred
            if (!data.includes('[!]') && !data.includes('ACTION_REQUIRED') && !dryRunActive) {
                payloadTextarea.value = '';
                payloadTextarea.dispatchEvent(new Event('input')); // Reset target file checkboxes
            }
        }).catch(err => {
            statusBox.innerHTML = `<span style="color: red;">Error connecting to Bridge Backend: ${err.message}</span>`;
        });
}

export function updateFilePath(oldPath, newPath) {
    let currentVal = payloadTextarea.value;
    const searchTargetOne = "<<<<<<< FILE: " + oldPath;
    const searchTargetTwo = "<<<<<<< FILE: " + oldPath;
    const replaceTarget = "<<<<<<< FILE: " + newPath;

    currentVal = currentVal.split(searchTargetOne).join(replaceTarget);
    currentVal = currentVal.split(searchTargetTwo).join(replaceTarget);
    payloadTextarea.value = currentVal;

    payloadTextarea.dispatchEvent(new Event("input"));
    sync(false, globalBypassSandwich);
}

window.sync = sync;
window.showConsole = showConsole;
window.showInput = showInput;
window.updateFilePath = updateFilePath;
window.resetStatus = resetStatus;
window.fetchAndCopy = fetchAndCopy;
window.fetchAndDownloadState = fetchAndDownloadState;
