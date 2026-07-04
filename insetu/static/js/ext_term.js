// ext_term.js - Terminal Extension
import { AppStore } from './store.js';
const termScreen = window.ExtensionRegistry.registerTab('term', 'Term', 'term');

if (termScreen) {
    // 1. Inject custom CSS rules for the terminal canvas
    termScreen.style.height = '100%';
    termScreen.style.padding = '15px';
    termScreen.style.boxSizing = 'border-box';
    termScreen.style.display = 'flex';
    termScreen.style.flexDirection = 'column';
    termScreen.style.overflow = 'hidden';
    termScreen.style.background = 'var(--console-bg)';
    // 2. Inject the sub-tabs-bar to match the global layout
    const subTabBar = document.createElement('div');
    subTabBar.className = 'sub-tabs-bar';
    subTabBar.innerHTML = `
        <div class="sub-tabs">
            <div class="sub-tab active">Console</div>
        </div>
        <button class="btn-sm" style="background: transparent; border: 1px solid var(--border); color: var(--text); padding: 4px 12px; margin: 0; font-size: 0.85rem;" onclick="document.getElementById('term-iframe').src += ''">🔄 Restart</button>
    `;
    termScreen.parentElement.insertBefore(subTabBar, termScreen);

    // 3. Build the iframe target
    termScreen.innerHTML = `
        <iframe id="term-iframe" style="flex: 1; width: 100%; height: 100%; border: none; outline: none; background: var(--console-bg); border-radius: 4px;"></iframe>
    `;
    // 3. Fetch the port mapping from the backend and boot TTYD
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        fetch(`/api/${activeWs}/repos`).then(r => r.json()).then(d => {
            const termIframe = document.getElementById('term-iframe');
        if (termIframe && d.term_port) {
            termIframe.src = window.location.protocol + '//' + window.location.hostname + ':' + d.term_port;
        }
    }).catch(e => console.error("Failed to fetch term port:", e));

    // 4. Force focus into the iframe when the tab is clicked to prevent ghost typing
    const termTabBtn = document.querySelector('.tab[onclick*="term"]');
    if (termTabBtn) {
        termTabBtn.addEventListener('click', () => {
            const iframe = document.getElementById('term-iframe');
            if (iframe) iframe.focus();
        });
    }
}