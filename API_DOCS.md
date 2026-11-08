# 📚 مستندات توابع (JavaScript API Reference) — نسخه ۴.۲.۲

## هسته و اتصال
- `initDbClient()` — ساخت کلاینت Supabase.
- `checkDbConnection()` — بررسی اتصال با فراخوانی تابع `check_has_users`.
- `setData(key,data)` — **به‌روزرسانی مهم**: به جای `upsert`، رکوردهای جدید را با `insert` و رکوردهای تغییریافته را با `update` به سرور می‌فرستد تا از خطای RLS جلوگیری شود.
- `syncFromCloud(showMessage)` — همگام‌سازی یک‌طرفه (Pull) تمام جداول از سرور به LocalStorage.

## احراز هویت
- `handleLogin()` — ورود با `supabase.auth.signInWithPassword`. در صورت نیاز، `showForcePasswordChange` را صدا می‌زند.
- `handleSetup()` — ساخت اولین کاربر (سوپر ادمین) با فراخوانی Edge Function به نام `setup-admin`.
- `showForcePasswordChange(userId)` — نمایش مودال تغییر رمز اجباری (شامل دکمه خروج). پس از موفقیت، صفحه را رفرش می‌کند.
- `forceLogout(msg)` — خروج کامل از Supabase Auth و بازگشت به صفحه لاگین.

## مدیریت پرسنل
- `savePerson()` — در حالت ایجاد، Edge Function `create-user` را صدا می‌زند. در حالت ویرایش، اطلاعات را آپدیت می‌کند.
- `renderPersons()` — نمایش جدول کاربران با نقش‌های مربوطه.

## اقدامات (Activities)
- `saveActivity()` — ثبت/ویرایش اقدام با اعتبارسنجی‌های کامل و تشخیص شباهت (۴۰٪).
- `joinActivity(id)` — اضافه کردن کاربر جاری به لیست شرکت‌کنندگان (با بررسی صحت از سمت دیتابیس).
- `renderCalendar()` — نمایش تقویم با رنگ‌بندی بر اساس وضعیت حضور و اقدامات «فقط برای من».
- `calcDurationHours()` — محاسبه ساعت (کسر روزهای تعطیل و پنجشنبه/جمعه در اقدامات چندروزه).