/* ================================================
   Service Worker — ثبت فعالیت ماهانه
   ================================================ */

const CACHE_VERSION = 'actbk-v1.1.6';
const CACHE_NAME = 'actbk-cache-' + CACHE_VERSION;
const OFFLINE_URL = './Activity.html';

// فایل‌های محلی که باید در اولین نصب کش شوند
const PRECACHE_URLS = [
  './Activity.html',
  './index.html',
  './manifest.json',
  './config.js'
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
        keys.filter(k => k !== CACHE_NAME).map(k => {
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

  if (req.url.includes('supabase.co') || req.url.includes('/rest/v1/')) return;

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
        .catch(() => {
          return caches.match(OFFLINE_URL)
            .then(c => c || caches.match('./index.html'))
            .then(c => c || new Response(
              '<!DOCTYPE html><html dir="rtl"><body style="font-family:Tahoma;padding:20px;text-align:center"><h2>اتصال برقرار نیست</h2><p>لطفاً اینترنت را بررسی و صفحه را دوباره باز کنید.</p></body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ));
        })
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
