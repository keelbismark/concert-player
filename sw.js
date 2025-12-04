/**
 * Service Worker for Pro Concert Player
 * Enables offline functionality
 */

const CACHE_NAME = 'concert-player-v3.1';
const OFFLINE_URL = '/index.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/remote.html',
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
    '/js/RemoteServer.js',
    '/js/app.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
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
    console.log('[SW] Activating...');
    
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests
    if (url.origin !== location.origin) return;

    // Skip audio files (too large to cache)
    if (request.url.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }

                // Fetch from network
                return fetch(request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        // Clone response for caching
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Offline fallback for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                        return null;
                    });
            })
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Background sync for playlist backup
self.addEventListener('sync', (event) => {
    if (event.tag === 'backup-playlist') {
        event.waitUntil(backupPlaylist());
    }
});

async function backupPlaylist() {
    // Implementation for background sync
    console.log('[SW] Background sync: backup playlist');
}