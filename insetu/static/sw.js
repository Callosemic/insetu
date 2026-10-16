self.HOST_ASSETS = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js',
    '/manifest.json',
    '/static/vendor/sutram/js/sutram-boot.js',
    '/static/vendor.json',
    '/static/icon-192.png',
    '/static/icon-512.png'
];
self.HOST_BYPASS_PATTERNS = [
    '/api/',
    '/submit',
    '/download/',
    '/recovery',
    '/api/system/panic'
];
// Force SW update cycle to purge stale HTTP cache state
self.OS_CACHE_VERSION = 'v5';

importScripts('/static/vendor/sutram/js/sw-core.js');
