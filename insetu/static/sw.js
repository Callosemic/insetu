self.HOST_ASSETS = [
    '/',
    '/manifest.json',
    '/static/vendor.json',
    '/static/css/style.css',
    '/static/vendor/yenvui/css/theme-tokens.css',
    '/static/vendor/yenvui/css/yenvui-primitives.css',
    '/static/vendor/lucide/icons.js',
    '/static/vendor/sutram/js/sutram-boot.js',
    '/static/vendor/sutram/js/index.js',
    '/static/vendor/yenvui/js/index.js',
    '/static/js/app.js',
    '/static/extensions/system/system.js',
    '/static/extensions/system/api.js',
    '/static/extensions/system/store.js',
    '/static/extensions/system/insetu_sdk.js',
    '/static/extensions/system/insetu_element.js',
    '/static/extensions/system/uri.js',
    '/static/extensions/system/manifest_sync.js',
    '/static/icon-192.png',
    '/static/icon-512.png'
];
self.HOST_BYPASS_PATTERNS = [
    '/api/',
    '/auth/',
    '/submit',
    '/recovery',
    '/api/system/panic',
    '/api/system/build_id'
];
// Force SW update cycle to activate versioned build cache-first vault
self.OS_CACHE_VERSION = 'v9';

importScripts('/static/vendor/sutram/js/sw-core.js');
