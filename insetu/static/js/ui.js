// --- DYNAMIC UI FACTORY ---
export const UIFactory = {
    createModal: function(config) {
        const backdrop = document.createElement('div');
        backdrop.className = 'fullscreen-modal dynamic-modal';
        backdrop.id = config.id || 'modal-' + Date.now();
        
        const panel = document.createElement('div');
        panel.className = 'modal-panel';
        if (config.maxWidth) panel.style.maxWidth = config.maxWidth;
        
        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h2>${config.title}</h2>`;
        
        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof config.body === 'string') {
            body.innerHTML = config.body;
        } else if (config.body instanceof HTMLElement) {
            body.appendChild(config.body);
        }
        
        // Footer (Actions)
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        if (config.actions) {
            config.actions.forEach(act => {
                const btn = document.createElement('button');
                btn.className = 'btn-sm';
                btn.style.background = act.style === 'primary' ? 'var(--primary, #8b5cf6)' : 
                                       act.style === 'danger' ? '#ef4444' : 'var(--input-bg)';
                btn.style.color = (act.style === 'primary' || act.style === 'danger') ? '#fff' : 'var(--text)';
                btn.style.margin = '0';
                if (act.id) btn.id = act.id;
                btn.innerText = act.label;
                btn.onclick = async (e) => {
                    if (act.onClick) {
                        const shouldKeepOpen = await act.onClick(e, backdrop);
                        if (!shouldKeepOpen && act.closeOnClick !== false) this.closeModal(backdrop.id);
                    } else if (act.closeOnClick !== false) {
                        this.closeModal(backdrop.id);
                    }
                };
                footer.appendChild(btn);
            });
        }

        panel.appendChild(header);
        panel.appendChild(body);
        if (config.actions && config.actions.length > 0) panel.appendChild(footer);
        backdrop.appendChild(panel);
        
        // Close on background click
        backdrop.addEventListener('mousedown', (e) => {
            if (e.target === backdrop) this.closeModal(backdrop.id);
        });

        document.body.appendChild(backdrop);
        
        // Small delay to allow CSS transitions to catch if added later
        setTimeout(() => backdrop.style.display = 'flex', 10);
        return backdrop.id;
    },
    
    closeModal: function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
};
// Bind to window for globally decoupled extensions
window.UIFactory = UIFactory;

export function openSelectorModal(title, items, onSelect) {
    const bodyHtml = `
        <input type="text" id="selector-search" placeholder="Search..." style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
        <div id="selector-list" style="display: flex; flex-direction: column; gap: 5px; max-height: 300px; overflow-y: auto;">
        </div>
    `;

    const modalId = UIFactory.createModal({
        id: 'selector-modal-' + Date.now(),
        title: title,
        body: bodyHtml,
        maxWidth: '500px',
        actions: [
            { label: 'Cancel', style: 'secondary' }
        ]
    });

    const listEl = document.getElementById('selector-list');
    const searchEl = document.getElementById('selector-search');

    const renderList = (filter = '') => {
        listEl.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        // Filter and limit to 50 items to prevent DOM lag on massive author/pub lists
        const filtered = items.filter(i => i.toLowerCase().includes(lowerFilter)).slice(0, 50);

        if (filtered.length === 0) {
            listEl.innerHTML = '<span style="color: #888; font-style: italic;">No matches found.</span>';
            return;
        }

        filtered.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'btn-sm';
            btn.style.cssText = 'background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 8px 12px; margin: 0; cursor: pointer; border-radius: 4px; transition: background 0.2s;';
            btn.innerText = item;

            btn.onmouseover = () => btn.style.background = 'var(--input-bg)';
            btn.onmouseout = () => btn.style.background = 'var(--bg)';

            btn.onclick = () => {
                onSelect(item);
                UIFactory.closeModal(modalId);
            };
            listEl.appendChild(btn);
        });
    };

    renderList();

    searchEl.addEventListener('input', (e) => renderList(e.target.value));

    // Auto-focus the search bar
    setTimeout(() => searchEl.focus(), 100);
}