/**
 * SevenCloud / GaleriFotoQR Cloud Studio — Progressive Web App Service Worker
 *
 * Safe caching policy:
 * - NO caching of Firebase Auth, tokens, Firestore, or Google Drive APIs.
 * - Network-First for navigation (prevents stale app versions).
 * - Stale-While-Revalidate for static hashed assets.
 * - Auto-cleanup of old cache versions.
 */

const CACHE_NAME = 'sevencloud-static-v1.0.0';

// Core pre-cached shell assets
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

// Domains and endpoints strictly bypassed from caching
const BYPASS_URL_PATTERNS = [
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firestore.googleapis.com',
  'accounts.google.com',
  'apis.google.com',
  'googleapis.com/drive',
  'googleapis.com/upload',
  'drive.google.com',
  '/api/'
];

function shouldBypass(url) {
  const href = url.href.toLowerCase();
  for (const pattern of BYPASS_URL_PATTERNS) {
    if (href.includes(pattern)) {
      return true;
    }
  }
  return false;
}

// ----------------- INSTALL -----------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Non-fatal precache asset notice:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ----------------- ACTIVATE -----------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW] Deleting obsolete cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ----------------- MESSAGE (UPDATE SIGNAL) -----------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// ----------------- FETCH -----------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Never intercept non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Only handle HTTP/HTTPS (skip chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Strict bypass for Auth, Firestore, Drive, and API requests
  if (shouldBypass(url)) {
    return;
  }

  // 4. HTML Navigation (Page loads / URL route changes)
  // Strategy: Network-First with Cache fallback.
  // This guarantees the user ALWAYS gets the newest index.html and avoids stale cache lock-in.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/');
          });
        })
    );
    return;
  }

  // 5. Static Assets (Hashed JS, CSS, Google Fonts, and icons)
  // Strategy: Stale-While-Revalidate
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.svg') ||
     url.pathname.endsWith('.woff2'));

  const isGoogleFont =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset || isGoogleFont) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 6. Default Fallback: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});
