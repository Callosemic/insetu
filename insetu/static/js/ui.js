window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

// --- DYNAMIC UI FACTORY ---
document.addEventListener('dragstart', (e) => {
    const dragEl = e.target.closest('.ui-draggable-export');
    if (dragEl) {
        const filename = dragEl.dataset.filename;
        const fetchUrl = dragEl.dataset.fetchUrl;
        if (filename && fetchUrl && window.inSetu.ui.Factory.bindDownloadDrag) {
            window.inSetu.ui.Factory.bindDownloadDrag(e, filename, fetchUrl);
        }
    }
});

export const UIFactory = {
    bindDownloadDrag: function(e, filename, fetchUrl) {
        const absoluteUrl = window.location.origin + fetchUrl;
        const safeName = filename.split('/').pop();
        const ext = safeName.split('.').pop().toLowerCase();

        let mime = 'application/octet-stream';
        if (ext === 'md') mime = 'text/markdown';
        else if (ext === 'txt') mime = 'text/plain';
        else if (ext === 'json') mime = 'application/json';
        else if (ext === 'py') mime = 'text/x-python';
        else if (ext === 'js') mime = 'text/javascript';

        const ghost = document.createElement('div');
        ghost.style.cssText = 'position: absolute; top: -1000px; left: -1000px; background: var(--pane-bg); color: var(--text); border: 1px solid var(--btn); padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; z-index: -1; box-shadow: 0 4px 10px rgba(0,0,0,0.3);';
        ghost.innerText = `📄 ${safeName}`;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 15, 15);

        setTimeout(() => ghost.remove(), 50);

        e.dataTransfer.setData('DownloadURL', `${mime}:${safeName}:${absoluteUrl}`);
        e.dataTransfer.setData('text/uri-list', absoluteUrl);
        e.dataTransfer.setData('text/plain', absoluteUrl);

        e.dataTransfer.effectAllowed = 'copy';
    },

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
        closeBtn.style.background = 'var(--intent-neutral)';
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
                btn.style.background = act.style === 'primary' ? 'var(--primary, var(--intent-highlight))' : 
                                        act.style === 'danger' ? 'var(--intent-danger)' : 'var(--input-bg)';
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
    },
    createNestedRepoFilters: function(config) {
        const {
            container,
            label = "📌 Repos:",
            repos,
            activeRepos,
            reposExpanded,
            onRepoChange,
            onRepoExpandToggle,
            extraRepos = [],
            enableBuckets = false,
            activeBuckets = new Set(),
            bucketsExpandedMap = {},
            onBucketChange,
            onBucketExpandToggle,
            getBucketsFn
        } = config;

    container.replaceChildren();
    const wrap = document.createElement('div');
        wrap.style.cssText = "display: flex; align-items: center; flex-wrap: wrap; gap: 6px;";

        const lbl = document.createElement('span');
        lbl.innerText = label;
        lbl.style.cssText = "font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap; cursor: pointer;";
        if (onRepoExpandToggle) lbl.onclick = onRepoExpandToggle;
        wrap.appendChild(lbl);
        const createRPill = (id, text, forceVisible = false) => {
            const isVisible = forceVisible || activeRepos.has(id) || reposExpanded;
            return this.createFilterPill({
                id: id, label: text, activeSet: activeRepos, isVisible,
                onChange: (newSet, changedId, wasActive) => {
                    if (wasActive && changedId === "ALL") {
                        if (onRepoExpandToggle) onRepoExpandToggle();
                    } else if (wasActive && !reposExpanded) {
                        if (onRepoExpandToggle) onRepoExpandToggle();
                    } else {
                        if (onRepoChange) onRepoChange(newSet);
                    }
                }
            });
        };

        const allPill = createRPill("ALL", "All", true);
        if (allPill) wrap.appendChild(allPill);

        extraRepos.forEach(ex => {
            const p = createRPill(ex.id, ex.label);
            if (p) wrap.appendChild(p);
        });

        repos.forEach(repo => {
            const p = createRPill(repo, repo);
            if (p) wrap.appendChild(p);

            if (enableBuckets && activeRepos.has(repo) && repo !== "ALL") {
                const buckets = getBucketsFn ? getBucketsFn(repo) : [];
                if (buckets.length > 0) {
                    const bWrap = document.createElement('span');
                    bWrap.style.cssText = "display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; background: var(--input-bg); padding: 4px; border-radius: 6px; border: 1px solid var(--border); margin-left: 2px;";

                    const bLbl = document.createElement('span');
                    bLbl.innerText = "🗂️";
                    bLbl.style.cssText = "font-size: 0.75rem; margin-right: 2px; cursor: pointer;";
                    const isBExpanded = bucketsExpandedMap[repo] || false;

                    if (onBucketExpandToggle) bLbl.onclick = () => onBucketExpandToggle(repo, !isBExpanded);
                    bWrap.appendChild(bLbl);
                    const createBPill = (bId, bLabel, forceVisible = false) => {
                        const isVisible = forceVisible ||
                            activeBuckets.has(bId) || isBExpanded;
                        return this.createFilterPill({
                            id: bId, label: bLabel, activeSet: activeBuckets, isVisible,
                            styleOverride: { padding: '2px 6px', fontSize: '0.7rem' },
                            onChange: (newSet, changedId, wasActive) => {
                                if (changedId === "ALL" && wasActive) {
                                    if (onBucketExpandToggle) onBucketExpandToggle(repo, !isBExpanded);
                                } else {
                                    if (onBucketChange) onBucketChange(newSet, repo);
                                }
                            }
                        });
                    };

                    const bAll = createBPill("ALL", "All", true);
                    if (bAll) bWrap.appendChild(bAll);
                    buckets.forEach(b => {
                        const bp = createBPill(b.id, b.title);
                        if (bp) bWrap.appendChild(bp);
                    });
                    wrap.appendChild(bWrap);
                }
            }
        });
        container.appendChild(wrap);
    },

    createFilterPill: function(config) {
        if (config.isVisible === false) return null;
        const isActive = config.activeSet.has(config.id);
        const btn = document.createElement('button');
        btn.className = isActive ? 'repo-pill active' : 'repo-pill';
        btn.innerText = config.label;
        btn.style.cssText = `padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer; background: ${isActive ? 'var(--btn)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text)'}; font-weight: bold; margin: 0;`;

        if (config.styleOverride) {
            for (let prop in config.styleOverride) {
                btn.style[prop] = config.styleOverride[prop];
            }
        }

        btn.onclick = () => {
            const newSet = new Set(config.activeSet);
            if (config.id === "ALL") {
                newSet.clear();
                newSet.add("ALL");
            } else {
                newSet.delete("ALL");
                if (newSet.has(config.id)) {
                    newSet.delete(config.id);
                    if (newSet.size === 0) newSet.add("ALL");
                } else {
                    newSet.add(config.id);
                }
            }
            if (config.onChange) config.onChange(newSet, config.id, isActive);
        };
        return btn;
    },
    createDropdown: function(config) {
        const existing = document.querySelector('.dynamic-dropdown');
        if (existing && existing._anchor === config.anchor) {
            existing.remove();
            return null;
        }
        // Destroy existing generic dropdowns to ensure a singleton instance
        document.querySelectorAll('.dynamic-dropdown').forEach(el => el.remove());

        const menu = document.createElement('div');
        menu._anchor = config.anchor;
        menu.className = 'dynamic-dropdown';
        menu.style.cssText = `
            position: absolute;
            background: var(--pane-bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;

        // Calculate positioning relative to the triggering anchor
        const rect = config.anchor.getBoundingClientRect();
        menu.style.top = (rect.bottom + window.scrollY + 5) + 'px';

        // Prevent horizontal overflow off the right edge of the viewport
        if (rect.right > window.innerWidth - 250) {
            menu.style.right = (window.innerWidth - rect.right) + 'px';
        } else {
            menu.style.left = rect.left + 'px';
        }

        config.items.forEach(item => {
            if (item.divider) {
                const div = document.createElement('div');
                div.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
                menu.appendChild(div);
                return;
            }
            const btn = document.createElement('button');
            btn.style.cssText = 'background: transparent; color: var(--text); text-align: left; padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; align-items: center; gap: 8px;';
            btn.innerHTML = (item.icon ? `<span style="font-size: 1.1rem; line-height: 1;">${item.icon}</span> ` : '') + `<span>${item.label}</span>`;

            btn.onmouseover = () => btn.style.background = 'var(--input-bg)';
            btn.onmouseout = () => btn.style.background = 'transparent';

            btn.onclick = (e) => {
                menu.remove();
                if (item.onClick) item.onClick(e);
            };
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        // Bind outside click listener to auto-dismiss, with a tiny delay to avoid immediately firing on the triggering click
        setTimeout(() => {
            const closer = (e) => {
                // If clicking the anchor, the main factory invocation catches the toggle state.
                if (e.target === config.anchor || config.anchor.contains(e.target)) return;

                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closer);
                }
            };
            document.addEventListener('click', closer);
        }, 10);

        return menu;
    }
};
// Bind to window for globally decoupled extensions
window.inSetu.ui.Factory = UIFactory;
window.UIFactory = UIFactory; // Legacy alias

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
        if (listEl) listEl.replaceChildren();
        const lowerFilter = filter.toLowerCase();

        // Filter and limit to 50 items to prevent DOM lag on massive author/pub lists
        const filtered = items.filter(i => i.toLowerCase().includes(lowerFilter)).slice(0, 50);

        if (filtered.length === 0) {
            listEl.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No matches found.</span>';
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