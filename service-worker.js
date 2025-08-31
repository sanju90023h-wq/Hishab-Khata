// service-worker.js

const CACHE_NAME = 'my-business-app-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/firebase-config.js',
  '/manifest.json',
  // Firebase SDKs - These are usually fetched from CDN and might not need explicit caching
  // 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
  // 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
  // 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js',
  // If you created icons, list them here:
  // '/icons/icon-72x72.png',
  // '/icons/icon-96x96.png',
  // '/icons/icon-128x128.png',
  // '/icons/icon-144x144.png',
  // '/icons/icon-152x152.png',
  // '/icons/icon-192x192.png',
  // '/icons/icon-384x384.png',
  // '/icons/icon-512x512.png'
];

// Install event: cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Cache addAll failed:', err))
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serve cached content or fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // No cache hit - fetch from network
        return fetch(event.request).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and can only be consumed once. We consume it once to cache it
            // and once the browser consumes it.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});
