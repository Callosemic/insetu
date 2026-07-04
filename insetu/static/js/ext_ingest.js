export function importFromUrl() {
    const bodyHtml = `
        <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Target URL:</label>
        <input type="text" id="import-url-input" placeholder="https://..." style="margin-bottom: 15px; padding: 10px; font-weight: bold; width: 100%; box-sizing: border-box;">

        <label style="font-size: 0.9rem; margin-bottom: 5px; display: block; color: var(--text);">Extraction Method:</label>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; font-size: 0.9rem; background: var(--input-bg); padding: 10px; border: 1px solid var(--border); border-radius: 4px;">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="import-method" value="jina" checked> 
                <b>Jina Reader API</b> <span style="color: #888; font-size: 0.8rem;">(Clean formatting, relies on remote server)</span>
            </label>
            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="import-method" value="bs4"> 
                <b>BeautifulSoup Local</b> <span style="color: #888; font-size: 0.8rem;">(Fallback, requires pip install bs4 markdownify)</span>
            </label>
        </div>
    `;
    window.UIFactory.createModal({
        id: 'import-url-modal',
        title: 'Import from URL',
        body: bodyHtml,
        actions: [
            { label: '📥 Fetch & Convert', style: 'primary', onClick: async (e, modal) => {
                await executeImportUrl(modal.id);
                return true;
            }}
        ]
    });
    setTimeout(() => {
        const input = document.getElementById('import-url-input');
        if (input) input.focus();
    }, 100);
}

export async function executeImportUrl(modalId = 'import-url-modal') {
    const url = document.getElementById('import-url-input').value.trim();
    if (!url) return alert("Please enter a valid URL.");
    const method = document.querySelector('input[name="import-method"]:checked').value;

    if (window.UIFactory) window.UIFactory.closeModal(modalId);
    else {
        const m = document.getElementById(modalId);
        if (m) m.style.display = 'none';
    }

    const statusEl = document.getElementById('import-url-status');
    const contentEl = document.getElementById('new-file-content');

    if(statusEl) {
        statusEl.style.display = 'inline-block';
        statusEl.innerText = "Fetching and converting...";
        statusEl.style.color = "#888";
    }

    try {
        const res = await fetch('/api/ingest/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, method })
        });
        const data = await res.json();

        if (res.ok) {
            // Append or overwrite content seamlessly
            if (contentEl.value.trim() !== '') {
                if (confirm("Overwrite existing content with imported markdown?")) {
                    contentEl.value = data.markdown;
                } else {
                    contentEl.value += '\n\n' + data.markdown;
                }
            } else {
                contentEl.value = data.markdown;
            }

            if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                window.ExtensionRegistry.executeUIHook('zone:post-import-url', data);
            }

            // Try to auto-guess a clean filename if the user hasn't typed one
            const nameEl = document.getElementById('new-file-name');
            if (nameEl.value.trim() === '') {
                let slug = '';
                if (data.title && data.title !== 'Imported Content') {
                    slug = data.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-');
                }
                if (!slug) {
                    try {
                        const urlObj = new URL(data.resolved_url || url);
                        slug = urlObj.pathname.split('/').pop() || urlObj.hostname;
                        slug = slug.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                    } catch(e) {}
                }
                if (!slug) slug = 'imported-article';
                slug = slug.replace(/^-+|-+$/g, '').substring(0, 60);
                nameEl.value = slug + '.md';
                if(typeof checkFileExtension === 'function') checkFileExtension(nameEl.value);
            }

            if(statusEl) {
                statusEl.innerText = "✅ Success";
                statusEl.style.color = "#10b981";
            }
        } else {
            if(statusEl) {
                statusEl.innerText = "❌ Error";
                statusEl.style.color = "#dc2626";
            }
            alert(data.error || "Failed to import URL.");
        }
    } catch (e) {
        if(statusEl) {
            statusEl.innerText = "❌ Error";
            statusEl.style.color = "#dc2626";
        }
        alert("Network error: " + e.message);
    }

    if(statusEl) {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Mount to window so the hardcoded UI elements in the New File Modal can trigger it natively
window.importFromUrl = importFromUrl;
window.executeImportUrl = executeImportUrl;

if (window.ExtensionRegistry && window.ExtensionRegistry.registerUIHook) {
    window.ExtensionRegistry.registerUIHook('zone:new-file-options', () => {
        const toolbar = document.getElementById('new-file-toolbar');
        if (toolbar) toolbar.style.display = 'flex';
        return false;
    });
}

if (window.ExtensionRegistry && window.ExtensionRegistry.registerUnloadHook) {
    window.ExtensionRegistry.registerUnloadHook('ingest', () => {
        const toolbar = document.getElementById('new-file-toolbar');
        if (toolbar) toolbar.style.display = 'none';
    });
}