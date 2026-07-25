/**
 * service-worker.js
 * Meng-cache "app shell" (HTML/CSS/JS/asset statis) supaya web app:
 *  - bisa di-install seperti aplikasi native (syarat PWA)
 *  - tetap bisa dibuka (shell-nya) walau koneksi internet putus sesaat
 *
 * TIDAK menyimpan cache untuk request ke Apps Script (Google Sheets sebagai database
 * harus selalu diakses langsung/fresh, tidak boleh basi/offline).
 */

const CACHE_NAME = 'pos-warung-shell-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './api.js',
  './app.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan pernah cache/intercept request ke Google Apps Script (Registry maupun API warung).
  // Data POS harus selalu fresh dari Google Sheets, tidak boleh disajikan dari cache offline.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return; // biarkan browser menangani seperti biasa (langsung ke network)
  }

  // Hanya proses request GET untuk asset milik app shell sendiri (same-origin).
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached); // offline -> fallback ke cache

      // Cache-first untuk shell supaya buka app langsung cepat, tapi tetap update cache di background.
      return cached || networkFetch;
    })
  );
});