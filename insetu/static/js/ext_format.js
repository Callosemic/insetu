import { downloadFile } from './fs.js';
import { AppStore } from './store.js';

export function openPublishModal() {
    const bodyHtml = `
        <label style="font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9rem;">Target Format:</label>
        <select id="publish-format-select" style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); margin-bottom: 15px; font-weight: bold;">
            <option value="pdf">PDF (Requires LaTeX/pdflatex)</option>
            <option value="docx">Word Document (.docx)</option>
            <option value="html">HTML Webpage</option>
        </select>
    `;
    window.inSetu.ui.Factory.createModal({
        id: 'publish-modal',
        title: 'Publish Document',
        body: bodyHtml,
        actions: [
            { label: '🚀 Compile & Download', style: 'primary', id: 'execute-publish-btn', onClick: async (e, modal) => {
                await executePublish();
                return true;
            }}
        ]
    });
}
export async function executePublish() {
    const formatSelect = document.getElementById('publish-format-select');
    if (!formatSelect) return;
    const format = formatSelect.value;
    const btn = document.getElementById('execute-publish-btn');
    const origText = btn ? btn.innerText : 'Compile & Download';
    if (btn) btn.innerText = "⏳ Compiling...";
    try {
        const { activeWorkspace, currentFormatTarget } = AppStore.getState();
        const activeWs = activeWorkspace || 'default';
        const dlName = currentFormatTarget.split('/').pop().split('.')[0] + '.' + format;

        await downloadFile(`/api/${activeWs}/format/compile-document`, dlName, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: currentFormatTarget, format: format })
        });
        window.inSetu.ui.Factory.closeModal('publish-modal');
    } catch (e) {
        alert("Network error: " + e.message);
    } finally {
        if (btn) btn.innerText = origText;
    }
}
// Inject Toolbar Button Natively into File Zone
const tb = document.getElementById('file-zone-buttons');
if (tb && !document.getElementById('btn-publish-doc')) {
    const pubBtn = document.createElement('button');
    pubBtn.id = 'btn-publish-doc';
    pubBtn.className = 'btn-sm';
    pubBtn.style.cssText = 'background: #ea580c; margin: 0; display: none;';
    pubBtn.innerText = '📄 Publish';
    pubBtn.onclick = openPublishModal;
    tb.appendChild(pubBtn);
}
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    window.inSetu.extensions.Registry.registerUIHook('zone:modal-file-toolbar', (data) => {
        if (data.filepath) AppStore.setState({ currentFormatTarget: data.filepath });
        const pubBtn = document.getElementById('btn-publish-doc');
        if (pubBtn) pubBtn.style.display = data.isMarkdown ? 'block' : 'none';
        return false;
    });
}

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUnloadHook) {
    window.inSetu.extensions.Registry.registerUnloadHook('format', () => {
        const pubBtn = document.getElementById('btn-publish-doc');
        if (pubBtn) pubBtn.remove();
    });
}