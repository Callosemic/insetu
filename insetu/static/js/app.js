import { executeBootSequence, bootServiceWorker } from '/static/extensions/system/system.js';
import '../vendor/sutram/js/app_shell.js';

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', executeBootSequence);
} else {
    executeBootSequence();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootServiceWorker();
} else {
    window.addEventListener('load', bootServiceWorker);
}