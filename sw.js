/* ================================================
   Service Worker — ثبت فعالیت ماهانه
   نسخه: actbk-v4.3.4
   ================================================ */

const CACHE_VERSION = 'Ver-4.3.4';
const CACHE_NAME = 'actbk-cache-' + CACHE_VERSION;
const PRECACHE_URLS = [
  './Activity.html',
  './index.html',
  './manifest.json',
  './config.js',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Precache miss:', url, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('actbk-cache-') && k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request).then(res => {
      clearTimeout(timer);
      resolve(res);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (new URL(req.url).pathname.endsWith('/sw.js')) return;

  if (/\/(rest|auth|storage|functions)\/v\d+\//.test(req.url)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(req, 8000)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => new Response(
          '<!DOCTYPE html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عدم اتصال</title><body style="font-family:Tahoma,sans-serif;padding:24px;text-align:center"><h2>اتصال اینترنت برقرار نیست</h2><p>این برنامه فقط در حالت آنلاین قابل استفاده است.</p><p>پس از اتصال به اینترنت، صفحه را دوباره بارگذاری کنید.</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});