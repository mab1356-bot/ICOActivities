/* ================================================
   Service Worker — ثبت فعالیت ماهانه
   نسخه: actbk-v5.0.3
   مدیریت نسخه و کش با پاک‌سازی امن کش‌های همین برنامه
   ================================================ */

const CACHE_VERSION = 'Ver-5.0.3';
const CACHE_NAME = 'actbk-cache-' + CACHE_VERSION;
const CACHE_PREFIX = 'actbk-cache-';
const PRECACHE_URLS = [
  './Activity.html',
  './index.html',
  './manifest.json',
  './config.js',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/pwa.js'
];

// هنگام نصب، فایل‌های نسخه جدید را با دور زدن HTTP cache دریافت می‌کنیم.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_URLS.map(async url => {
      try {
        const request = new Request(url, { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(url, response);
        else console.warn('[SW] Precache response not OK:', url, response.status);
      } catch (error) {
        console.warn('[SW] Precache failed:', url, error);
      }
    }));

    // مهاجرت یک‌باره از ۵.۰.۳: نسخه قبلی رابط تأیید به‌روزرسانی ندارد،
    // بنابراین برای جلوگیری از گیرکردن نسخه منتظر، فقط این ارتقا خودکار فعال می‌شود.
    const previousCaches = await caches.keys();
    if (previousCaches.includes('actbk-cache-Ver-4.3.7') || previousCaches.includes('actbk-cache-Ver-5.0.0')) {
      await self.skipWaiting();
    }
  })());
});

// فقط کش‌های متعلق به همین برنامه حذف می‌شوند؛ کش سایر برنامه‌ها باقی می‌ماند.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// درخواست شبکه با مهلت زمانی مشخص؛ صفحه برنامه در حالت آفلاین ارائه نمی‌شود.
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }).catch(error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;
  if (/\/(rest|auth|storage|functions)\/v\d+\//.test(request.url)) return;

  // برای مسیرهای صفحه، شبکه اولویت دارد و نسخه قدیمی هرگز جایگزین صفحه آنلاین نمی‌شود.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(new Request(request, { cache: 'no-store' }), 8000)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => new Response(
          '<!DOCTYPE html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عدم اتصال</title><body style="font-family:Tahoma,sans-serif;padding:24px;text-align:center"><h2>اتصال اینترنت برقرار نیست</h2><p>این برنامه فقط در حالت آنلاین قابل استفاده است.</p><p>پس از اتصال به اینترنت، صفحه را دوباره بارگذاری کنید.</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
        ))
    );
    return;
  }

  // فایل‌های ثابت از کش نسخه فعال خوانده می‌شوند؛ در نبود فایل، شبکه فراخوانی می‌شود.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      return new Response('', { status: 503 });
    }
  })());
});

// فعال‌سازی نسخه منتظر فقط پس از تأیید کاربر (به‌جز نصب اولیه).
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
