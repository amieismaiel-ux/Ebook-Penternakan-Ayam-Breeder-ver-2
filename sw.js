/* Service Worker - Ebook Penternakan Ayam Baka
   Menyimpan fail aplikasi + aset CDN (Tailwind, Font Awesome, Google Fonts)
   supaya ebook boleh dibuka tanpa internet selepas lawatan pertama.
   Tukar nombor CACHE_VERSION setiap kali anda mengemas kini fail ebook. */

const CACHE_VERSION = 'v4';
const CACHE_NAME = 'ebook-ayam-' + CACHE_VERSION;

// Fail dalam laman sendiri
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192-1.png',
  './icon-512-2.png',
  './chick-logo.png'
];

// Aset luar (CDN) yang diperlukan ebook untuk dipaparkan dengan betul
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Hos CDN yang dibenarkan untuk disimpan semasa runtime (termasuk fail font)
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Satu fail gagal tidak patut menggagalkan keseluruhan pemasangan
    await Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})));

    await Promise.all(CDN_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { mode: 'no-cors' }));
        await cache.put(url, response);
      } catch (err) {
        // Akan disimpan semasa runtime apabila dimuatkan oleh halaman
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('ebook-ayam-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Halaman utama: cuba rangkaian dahulu (dapat versi terkini), jika luar talian guna cache
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      } catch (err) {
        return (
          (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match('./index.html')) ||
          (await caches.match('./')) ||
          Response.error()
        );
      }
    })());
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  // Aset lain: guna cache dahulu, kemas kini di latar belakang
  event.respondWith((async () => {
    const cached = await caches.match(request);

    const network = fetch(request)
      .then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => cached || Response.error());

    return cached || network;
  })());
});
