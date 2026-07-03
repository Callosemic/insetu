// --- DYNAMIC UI FACTORY ---
export const UIFactory = {
    createModal: function(config) {
        const backdrop = document.createElement('div');
        backdrop.className = 'fullscreen-modal dynamic-modal';
        backdrop.id = config.id || 'modal-' + Date.now();

        // Auto-stack over the highest currently visible modal
        let highestZ = 1000;
        document.querySelectorAll('.fullscreen-modal').forEach(m => {
            if (window.getComputedStyle(m).display !== 'none') {
                const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
                if (z > highestZ) highestZ = z;
            }
        });
        backdrop.style.zIndex = config.zIndex || (highestZ + 10);

        const panel = document.createElement('div');
        panel.className = 'modal-panel';
        if (config.maxWidth) panel.style.maxWidth = config.maxWidth;
        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const titleEl = document.createElement('h2');
        titleEl.style.margin = '0';
        titleEl.innerHTML = config.title;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-sm';
        closeBtn.style.background = '#64748b';
        closeBtn.style.margin = '0';
        closeBtn.style.flexShrink = '0';
        closeBtn.innerText = 'Back';
        closeBtn.onclick = () => this.closeModal(backdrop.id);

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

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
                btn.style.background = act.style === 'primary' ? 'var(--primary, #8b5cf6)' : 
                                        act.style === 'danger' ? '#ef4444' : 'var(--input-bg)';
                btn.style.color = (act.style === 'primary' || act.style === 'danger') ? '#fff' : 'var(--text)';
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
        <div style="flex-shrink: 0; margin-bottom: 10px;">
            <input type="text" id="selector-search" placeholder="Search..." style="width: 100%; padding: 10px; font-weight: bold; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;">
        </div>
        <div id="selector-list" style="display: flex; flex-direction: column; gap: 5px; flex: 1; overflow-y: auto; padding-bottom: 15px;">
        </div>
    `;
    const modalId = UIFactory.createModal({
        id: 'selector-modal-' + Date.now(),
        title: title,
        body: bodyHtml
    });

    // Lock the parent body from scrolling so the search box stays pinned
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        const bodyEl = modalEl.querySelector('.modal-body');
        if (bodyEl) {
            bodyEl.style.overflowY = 'hidden';
            bodyEl.style.paddingBottom = '0';
        }
    }

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
            btn.style.cssText = 'background: var(--bg); border: 1px solid var(--border); color: var(--text); text-align: left; padding: 12px 15px; font-size: 1.05rem; font-family: monospace; font-weight: bold; margin: 0; cursor: pointer; border-radius: 4px; transition: background 0.2s;';

            const displayText = item.startsWith('prompts/') ? item.substring(8) : item;
            btn.innerText = '📄 ' + displayText;

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