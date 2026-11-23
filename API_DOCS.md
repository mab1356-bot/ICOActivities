# مرجع توابع JavaScript

منطق اصلی در `assets/js/app.js` قرار دارد و داخل IIFE اجرا می‌شود. نام‌ها و قراردادهای داده‌ای نسخه پایه حفظ شده‌اند.

## هسته و اتصال
- `initDbClient()` — ساخت کلاینت Supabase.
- `loadAppVersion()` — خواندن نسخه برنامه از Service Worker.
- `checkDbConnection()` — بررسی اتصال پایگاه داده.
- `setData(key, data)` — درج و به‌روزرسانی تفکیک‌شده.
- `syncFromCloud(showMessage)` — دریافت داده‌ها از سرور.

## احراز هویت و کاربران
- `handleLogin()`، `handleSetup()` — ورود و راه‌اندازی اولیه.
- `showForcePasswordChange(userId)` — اجبار تغییر رمز.
- `forceLogout(msg)` — خروج امن.
- `savePerson()`، `callAccountFn(action, payload)` — مدیریت پرسنل.
- `changePersonPassword(id)`، `deletePerson(id)`، `repairLoginEmails()` — عملیات مدیریتی حساب.

## اقدامات و تقویم
- `saveActivity()` — ثبت یا ویرایش اقدام.
- `joinActivity(id)` — پیوستن به اقدام.
- `openDayActivitiesModal(dateStr)` — بازکردن پنجره اقدامات روز.
- `renderDayActivitiesModal()` — نمایش کارت‌های کامل اقدامات روز.
- `joinFromModal(id)` — پیوستن و تازه‌سازی پنجره.
- `showActivityDetails(id)` — نمایش جزئیات کامل اقدام.
- `renderCalendar()` — رندر تقویم ماهانه با ایندکس تاریخ‌محور.
- `renderWeekView()` — رندر نمای هفتگی.
- `calcDurationHours()` — محاسبه مدت اقدام.

## PWA
ثبت Service Worker در `assets/js/pwa.js` انجام می‌شود. فایل‌های جدید CSS و JavaScript نیز در فهرست precache در `sw.js` قرار گرفته‌اند.
