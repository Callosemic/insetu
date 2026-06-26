// ext_term.js - Terminal Extension
const termScreen = window.ExtensionRegistry.registerTab('term', 'Term');

if (termScreen) {
    // 1. Inject custom CSS rules for the terminal canvas
    termScreen.style.height = '100%';
    termScreen.style.padding = '15px';
    termScreen.style.boxSizing = 'border-box';
    termScreen.style.display = 'flex';
    termScreen.style.flexDirection = 'column';
    termScreen.style.overflow = 'hidden';
    termScreen.style.background = 'var(--console-bg)';

    // 2. Build the iframe target
    termScreen.innerHTML = `
        <iframe id="term-iframe" style="flex: 1; width: 100%; height: 100%; border: none; outline: none; background: var(--console-bg); border-radius: 4px;"></iframe>
    `;

    // 3. Fetch the port mapping from the backend and boot TTYD
    fetch('/api/repos').then(r => r.json()).then(d => {
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