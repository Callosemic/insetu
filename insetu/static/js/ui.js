import { normalizeAccentText } from './app.js';

let selectorModalInstance = null;

/**
 * Opens a generic, mobile-friendly fuzzy search modal over an array of items.
 * @param {string} title - The title of the modal
 * @param {Array<string>} optionsArray - List of strings to search against
 * @param {Function} onSelectCallback - Fires with the selected string when clicked
 */
export function openSelectorModal(title, optionsArray, onSelectCallback) {
    if (!selectorModalInstance) {
        const modal = document.createElement('div');
        modal.className = 'fullscreen-modal';
        modal.style.zIndex = '2000'; // Sit securely above existing modals
        modal.innerHTML = `
            <div class="modal-content" style="max-height: 80vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 id="selector-modal-title" style="margin:0; font-size: 1.1rem;"></h3>
                    <button id="selector-modal-close" class="btn-sm" style="background: #dc2626; margin: 0;">Close</button>
                </div>
                <input type="text" id="selector-modal-input" placeholder="Search..." style="padding: 10px; margin-bottom: 10px; width: 100%; box-sizing: border-box; font-size: 1rem;">
                <div id="selector-modal-results" style="display: flex; flex-direction: column; overflow-y: auto; flex: 1; gap: 5px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
        selectorModalInstance = modal;

        document.getElementById('selector-modal-close').onclick = () => {
            selectorModalInstance.style.display = 'none';
        };
    }

    document.getElementById('selector-modal-title').innerText = title;
    const input = document.getElementById('selector-modal-input');
    const resultsContainer = document.getElementById('selector-modal-results');
    
    input.value = '';
    selectorModalInstance.style.display = 'block';
    input.focus();

    const renderResults = (query) => {
        const q = (normalizeAccentText ? normalizeAccentText(query) : query.toLowerCase()).trim();
        const filtered = optionsArray.filter(opt => {
            const text = normalizeAccentText ? normalizeAccentText(opt) : opt.toLowerCase();
            return text.includes(q);
        }).slice(0, 50); // Hard limit for performance

        resultsContainer.innerHTML = '';
        if (filtered.length === 0) {
            resultsContainer.innerHTML = '<span style="color:#888; font-style:italic; padding: 10px;">No matches found.</span>';
            return;
        }

        filtered.forEach(opt => {
            const row = document.createElement('div');
            row.className = 'file-card';
            row.style.cursor = 'pointer';
            row.style.padding = '12px 15px';
            row.style.fontSize = '0.95rem';
            row.innerText = opt;
            row.onclick = () => {
                onSelectCallback(opt);
                selectorModalInstance.style.display = 'none';
            };
            resultsContainer.appendChild(row);
        });
    };

    input.oninput = (e) => renderResults(e.target.value);
    renderResults(''); // Initialize list
}