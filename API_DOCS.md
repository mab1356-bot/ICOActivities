# 📚 مستندات توابع (JavaScript API Reference) — نسخه ۴.۲.۶

## هسته و اتصال
- `initDbClient()` — ساخت کلاینت Supabase.
- `loadAppVersion()` — خواندن مستقیم نسخه از `sw.js` در شبکه (با دور زدن کش) برای نمایش در هدر.
- `checkDbConnection()` — بررسی اتصال با فراخوانی تابع `check_has_users`.
- `setData(key,data)` — به جای `upsert`، رکوردهای جدید را با `insert` و رکوردهای تغییریافته را با `update` می‌فرستد.
- `syncFromCloud(showMessage)` — همگام‌سازی یک‌طرفه (Pull) تمام جداول از سرور.

## احراز هویت
- `handleLogin()` — ورود با `supabase.auth.signInWithPassword`.
- `handleSetup()` — ساخت اولین کاربر (سوپر ادمین) با فراخوانی Edge Function `setup-admin`.
- `showForcePasswordChange(userId)` — نمایش مودال تغییر رمز اجباری.
- `forceLogout(msg)` — خروج کاملاً امن از Supabase Auth، پاک‌سازی سشن و بازگشت به صفحه لاگین (با استفاده از `try...finally` برای جلوگیری از گیر کردن در موبایل).

## مدیریت پرسنل
- `savePerson()` — در حالت ایجاد، `create-user` را صدا می‌زند. در حالت ویرایش، اطلاعات را آپدیت می‌کند.
- `callAccountFn(action, payload)` — فراخوانی Edge Function `account-admin` برای عملیات‌های مدیریتی.
- `changePersonPassword(id)` — باز کردن پرامپت برای تعیین رمز جدید و ارسال آن به `account-admin`.
- `deletePerson(id)` — حذف کامل کاربر از `auth.users` و `persons` (با پاک‌سازی در اقدامات).
- `repairLoginEmails()` — اصلاح گروهی ایمیل‌های ورود (برای هماهنگ‌سازی با نام کاربری جدید).

## اقدامات (Activities)
- `saveActivity()` — ثبت/ویرایش اقدام با اعتبارسنجی‌های کامل و تشخیص شباهت (۴۰٪).
- `joinActivity(id)` — اضافه کردن کاربر جاری به لیست شرکت‌کنندگان.
- `renderCalendar()` — نمایش تقویم با رنگ‌بندی بر اساس وضعیت حضور و اقدامات «فقط برای من».
- `calcDurationHours()` — محاسبه ساعت (کسر روزهای تعطیل و پنجشنبه/جمعه در اقدامات چندروزه).