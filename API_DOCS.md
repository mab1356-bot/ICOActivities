# 📚 مستندات توابع (JavaScript API Reference) — نسخه ۳

## هسته و اتصال
- `initDbClient()` — ساخت کلاینت Supabase با تنظیمات Auth پایدار (`persistSession: true`).
- `checkDbConnection()` — بررسی اتصال با فراخوانی تابع `check_has_users` (دور زدن محدودیت RLS در صفحه لاگین).
- `syncFromCloud(showMessage)` — همگام‌سازی یک‌طرفه (Pull) تمام جداول از سرور به LocalStorage.
- `setData(key,data)` — Upsert رکوردهای تغییرکرده در سرور (تحت کنترل RLS).

## احراز هویت
- `handleLogin()` — ورود با نام کاربری و رمز از طریق `supabase.auth.signInWithPassword`. در صورت نیاز، `showForcePasswordChange` را صدا می‌زند.
- `handleSetup()` — ساخت اولین کاربر (سوپر ادمین) با فراخوانی Edge Function به نام `setup-admin`.
- `showForcePasswordChange(userId)` — نمایش مودال تغییر رمز اجباری. پس از موفقیت، صفحه را رفرش می‌کند (`location.reload()`) تا وضعیت جدید اعمال شود. دکمه خروج از حساب نیز در این مودال تعبیه شده است.
- `forceLogout(msg)` — خروج کامل از Supabase Auth، پاک‌سازی داده‌ها و بازگشت به صفحه لاگین.
- `submitChangePassword()` — تغییر رمز عادی از داخل برنامه.

## مدیریت پرسنل
- `savePerson()` — در حالت ایجاد، Edge Function `create-user` را صدا می‌زند. در حالت ویرایش، اطلاعات را در جدول `persons` آپدیت می‌کند.
- `deletePerson(id)` — حذف رکورد از جدول `persons` (کاربر Auth همچنان باقی می‌ماند اما دسترسی‌اش قطع می‌شود).
- `renderPersons()` — نمایش جدول کاربران با نقش‌های مربوطه.

## اقدامات (Activities)
- `saveActivity()` — ثبت/ویرایش اقدام با اعتبارسنجی‌های کامل و تشخیص شباهت (۴۰٪).
- `joinActivity(id)` — اضافه کردن کاربر جاری به لیست شرکت‌کنندگان اقدام.
- `renderCalendar()` — نمایش تقویم با رنگ‌بندی بر اساس وضعیت حضور و اقدامات «فقط برای من».
- `calcDurationHours()` — محاسبه ساعت (کسر روزهای تعطیل و پنجشنبه/جمعه در اقدامات چندروزه).

## ابزارهای کمکی
- `esc(s)` — جلوگیری از حملات XSS در رندر HTML.
- `jalaliToGregorian()` و `gregorianToJalali()` — تبدیل تاریخ بدون نیاز به کتابخانه خارجی.