# 📚 مستندات توابع (JavaScript API Reference) — نسخه ۴.۳.۰

## هسته و اتصال
- `initDbClient()` — ساخت کلاینت Supabase.
- `loadAppVersion()` — خواندن مستقیم نسخه از `sw.js` در شبکه (با دور زدن کش و تایم‌اوت ۳ ثانیه‌ای).
- `checkDbConnection()` — بررسی اتصال با فراخوانی تابع `check_has_users`.
- `setData(key,data)` — رکوردهای جدید را با `insert` و رکوردهای تغییریافته را با `update` می‌فرستد.
- `syncFromCloud(showMessage)` — همگام‌سازی یک‌طرفه (Pull) تمام جداول از سرور.

## احراز هویت
- `handleLogin()` — ورود با `supabase.auth.signInWithPassword`.
- `handleSetup()` — ساخت اولین کاربر (سوپر ادمین) با فراخوانی Edge Function `setup-admin`.
- `showForcePasswordChange(userId)` — نمایش مودال تغییر رمز اجباری.
- `forceLogout(msg)` — خروج کاملاً امن (با استفاده از `Promise.race` برای جلوگیری از گیر کردن در موبایل).

## مدیریت پرسنل
- ## مدیریت پرسنل
- `savePerson()` — در حالت ایجاد، `create-user` را صدا می‌زند. در حالت ویرایش، از `account-admin` برای تغییر **تمام اطلاعات** (نام، نام خانوادگی، شماره پرسنلی، نقش، رمز و نام کاربری) استفاده می‌کند.
- `callAccountFn(action, payload)` — فراخوانی Edge Function `account-admin`.
- `callAccountFn(action, payload)` — فراخوانی Edge Function `account-admin`.
- `changePersonPassword(id)` — تعیین رمز جدید توسط ادمین.
- `deletePerson(id)` — حذف کامل کاربر از `auth.users` و `persons`.
- `repairLoginEmails()` — اصلاح گروهی ایمیل‌های ورود.

## اقدامات (Activities)
- `saveActivity()` — ثبت/ویرایش اقدام با اعتبارسنجی‌های کامل و تشخیص شباهت.
- `joinActivity(id)` — اضافه کردن کاربر به لیست شرکت‌کنندگان.
- `openDayActivitiesModal(dateStr)` — **جدید**: باز کردن پاپ‌آپ اقدامات یک روز خاص از تقویم.
- `renderDayActivitiesModal()` — **جدید**: رندر کردن لیست اقدامات داخل پاپ‌آپ.
- `joinFromModal(id)` — **جدید**: پیوستن به اقدام از داخل پاپ‌آپ و رفرش آن.
- `renderCalendar()` — نمایش تقویم با رنگ‌بندی بر اساس وضعیت.
- `calcDurationHours()` — محاسبه ساعت (کسر روزهای تعطیل).