const CACHE_NAME = 'insetu-tooling-v1';
const ASSETS = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
    return self.clients.claim();
});
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') {
        return; // Bypass the service worker completely for POST requests
    }

    e.respondWith(
        fetch(e.request)
        .then((response) => {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
            return response;
        })
        .catch(() => caches.match(e.request))
    );
});
