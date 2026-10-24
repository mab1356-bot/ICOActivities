/* ================================================
   Service Worker — ثبت فعالیت ماهانه
   نسخه: 1.0.0
   ================================================ */

const CACHE_VERSION = 'actbk-v1.0.0';
const CACHE_NAME = 'actbk-cache-' + CACHE_VERSION;

// فایل‌هایی که باید در اولین نصب کش شوند
const PRECACHE_URLS = [
  './Activity.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
];

/* ---- Install ---- */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
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

/* ---- Activate: پاک‌سازی کش‌های قدیمی ---- */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
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

/* ---- Fetch ---- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Supabase: هرگز کش نکن (همیشه شبکه)
  if (req.url.includes('supabase.co') || req.url.includes('/rest/v1/')) {
    return;
  }

  // استراتژی: Cache First با fallback به شبکه
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(res => {
        // فقط پاسخ‌های موفق را کش کن
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // آفلاین:
        if (req.mode === 'navigate') {
          return caches.match('./Activity.html');
        }
        return new Response('آفلاین - فایل در دسترس نیست', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});

/* ---- پیام‌ها از صفحه ---- */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});