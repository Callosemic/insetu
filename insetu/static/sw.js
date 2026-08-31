const CACHE_NAME = 'insetu-tooling-v2';
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
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname === '/submit' || url.pathname.startsWith('/download/')) {
        return; // Bypass the service worker completely for stateful multi-tenant data loops
    }
    // Stale-While-Revalidate Strategy
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const networkFetch = fetch(e.request).then((response) => {
                const resClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
                return response;
            }).catch(() => {
                // Network failed silently, handled by returning cachedResponse below
            });

            // Return cache instantly if available, otherwise wait for network
            return cachedResponse || networkFetch;
        })
    );
});
