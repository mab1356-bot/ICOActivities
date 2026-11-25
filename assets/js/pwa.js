/* مدیریت ثبت و به‌روزرسانی Service Worker برنامه */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var registrationRef = null;
  var updateApproved = false;
  var bannerId = 'pwa-update-banner';

  // پیام به‌روزرسانی را فقط زمانی نمایش می‌دهد که نسخه فعلی تحت کنترل SW باشد.
  function showUpdateBanner() {
    if (document.getElementById(bannerId)) return;
    var banner = document.createElement('div');
    banner.id = bannerId;
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<div class="pwa-update-message"><strong>نسخه جدید برنامه آماده است.</strong>' +
      '<span>برای دریافت اصلاحات و امکانات جدید، برنامه را به‌روزرسانی کنید.</span></div>' +
      '<button type="button" class="pwa-update-button">به‌روزرسانی</button>';
    document.body.appendChild(banner);
    banner.querySelector('button').addEventListener('click', function () {
      var waiting = registrationRef && registrationRef.waiting;
      if (!waiting) {
        window.location.reload();
        return;
      }
      updateApproved = true;
      banner.querySelector('button').disabled = true;
      banner.querySelector('button').textContent = 'در حال به‌روزرسانی…';
      waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  // نصب اولیه بدون پیام انجام می‌شود؛ نسخه‌های بعدی با تأیید کاربر فعال می‌شوند.
  function handleWaitingWorker() {
    if (!registrationRef || !registrationRef.waiting) return;
    if (!navigator.serviceWorker.controller) {
      registrationRef.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      showUpdateBanner();
    }
  }

  // ثبت SW با غیرفعال کردن کش HTTP برای فایل sw.js و بررسی دوره‌ای نسخه جدید.
  function registerServiceWorker() {
    navigator.serviceWorker.register('./sw.js', {
      scope: './',
      updateViaCache: 'none'
    }).then(function (registration) {
      registrationRef = registration;
      handleWaitingWorker();

      registration.addEventListener('updatefound', function () {
        var installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
          if (installing.state === 'installed') handleWaitingWorker();
        });
      });

      // بررسی فوری و سپس هنگام بازگشت کاربر به برنامه.
      registration.update().catch(function () {});
      window.addEventListener('focus', function () {
        if (navigator.onLine) registration.update().catch(function () {});
      });
      window.addEventListener('online', function () {
        registration.update().catch(function () {});
      });
      window.setInterval(function () {
        if (navigator.onLine) registration.update().catch(function () {});
      }, 5 * 60 * 1000);
    }).catch(function (error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    });
  }

  // پس از تأیید کاربر و فعال شدن نسخه جدید، صفحه فقط یک بار بارگذاری مجدد می‌شود.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (updateApproved) window.location.reload();
  });

  window.addEventListener('load', registerServiceWorker);
})();
