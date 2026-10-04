import { executeBootSequence, bootServiceWorker } from '/static/extensions/system/system.js';
import '../vendor/sutram/js/app_shell.js';

const isPopout = new URLSearchParams(window.location.search).get('popout') === 'true';

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => executeBootSequence({ isPopout }));
} else {
    executeBootSequence({ isPopout });
}

// Bypasses Service Worker registration entirely for pop-outs to prevent IndexedDB contention
if (!isPopout) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        bootServiceWorker();
    } else {
        window.addEventListener('load', bootServiceWorker);
    }
}