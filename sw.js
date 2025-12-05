/**
 * Service Worker for Pro Concert Player
 * Enables offline functionality
 * Version 3.2 - Fixed caching strategy
 */

const CACHE_VERSION = '3.2';
const CACHE_NAME = `concert-player-v${CACHE_VERSION}`;
const OFFLINE_URL = '/index.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/main.css',
    '/css/components.css',
    '/css/playlist.css',
    '/css/controls.css',
    '/css/modals.css',
    '/css/touch.css',
    '/css/remote.css',
    '/js/utils.js',
    '/js/Settings.js',
    '/js/AudioEngine.js',
    '/js/Playlist.js',
    '/js/Visualizer.js',
    '/js/UI.js',
    '/js/DragDrop.js',
    '/js/TouchMode.js',
    '/js/RemoteConnection.js',
    '/js/app.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// ⭐ Файлы которые ВСЕГДА загружаются с сервера (не кэшируются)
const NETWORK_ONLY = [
    '/remote.html',
    '/remote-test.html'
];

// ⭐ Файлы для которых используется Network First стратегия
const NETWORK_FIRST = [
    '/index.html',
    '/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing v' + CACHE_VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Кэшируем только статические ассеты (без remote.html)
                const assetsToCache = STATIC_ASSETS.filter(
                    url => !NETWORK_ONLY.includes(url)
                );
                return cache.addAll(assetsToCache);
            })
            .then(() => {
                console.log('[SW] Installation complete');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Installation failed:', err);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v' + CACHE_VERSION);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - different strategies for different files
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests
    if (url.origin !== location.origin) return;

    // Skip WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') return;

    // Skip audio files (too large to cache)
    if (request.url.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
        return;
    }

    // ⭐ NETWORK ONLY - всегда с сервера (remote.html)
    if (NETWORK_ONLY.some(path => url.pathname === path || url.pathname.endsWith(path))) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Офлайн — показываем заглушку
                    return new Response(
                        '<html><body><h1>Offline</h1><p>Remote control requires network connection</p></body></html>',
                        { headers: { 'Content-Type': 'text/html' } }
                    );
                })
        );
        return;
    }

    // ⭐ NETWORK FIRST - сначала сеть, потом кэш (index.html)
    if (NETWORK_FIRST.some(path => url.pathname === path)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // ⭐ CACHE FIRST - для остальных статических файлов (CSS, JS, images)
    event.respondWith(cacheFirst(request));
});

/**
 * Network First Strategy
 * Try network, fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Успешный ответ — кэшируем и возвращаем
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Сеть недоступна — берём из кэша
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Ничего нет — офлайн страница
        return caches.match(OFFLINE_URL);
    }
}

/**
 * Cache First Strategy
 * Try cache, fallback to network
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Есть в кэше — возвращаем
        // Но также обновляем кэш в фоне (stale-while-revalidate)
        fetchAndCache(request);
        return cachedResponse;
    }
    
    // Нет в кэше — загружаем с сети
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Офлайн и нет в кэше
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Fetch and update cache in background
 */
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response);
        }
    } catch (error) {
        // Ignore network errors during background update
    }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    // ⭐ Команда для принудительного обновления
    if (event.data === 'clearCache') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
        });
    }
});

// Background sync for playlist backup
self.addEventListener('sync', (event) => {
    if (event.tag === 'backup-playlist') {
        event.waitUntil(backupPlaylist());
    }
});

async function backupPlaylist() {
    console.log('[SW] Background sync: backup playlist');
}