# 📚 مستندات توابع (JavaScript API Reference) — نسخه ۲

همهٔ کدها داخل یک IIFE هستند. تمام توابع در خود کد توضیح فارسی دارند؛ اینجا توابع کلیدی آمده است.

## هسته و اتصال
- `initDbClient()` — ساخت کلاینت Supabase از `config.js` (بدون ذخیرهٔ نشست Supabase).
- `checkDbConnection()` — بررسی اتصال با `select id from persons limit 1` (درخواست‌های هم‌زمان ادغام می‌شوند).
- `connectionTick()` / `handleConnectionLost()` — پایش هر ۶۰ ثانیه؛ قطع اتصال ⇒ خروج کاربر عادی یا حالت پشتیبان‌گیری برای سوپر ادمین.
- `pullTable(key)` — خواندن یک جدول و جایگزینی کش؛ `getFresh(key)` پیش از ویرایش.
- `syncFromCloud(showMessage)` — **همگام‌سازی یک‌طرفه (فقط Pull)** موازی.
- `setData(key,data)` — Upsert فقط رکوردهای تغییرکرده؛ آفلاین ⇒ رد؛ کش محلی فقط پس از موفقیت.
- `deleteRemote(table,id)` — حذف سرور با تأیید.
- `callRpc(fn,args)` / `rpcOk(data,error)` — فراخوانی و بررسی توابع امن سرور.

## احراز هویت
- `handleLogin()`, `handleSetup()`, `finishLogin()`, `handleLogout()`, `forceLogout(msg)`, `validateSession(s)`.
- `hashPassword(password,username)` — SHA-256 (ارسالی به سرور). `deriveLocalVerifier()` — PBKDF2 برای تأیید آفلاین سوپر ادمین.
- `handleOfflineAdminLogin()`, `enterBackupOnlyMode()`, `storeOfflineAdmin()`.
- `submitChangePassword()` — RPC `app_change_password`.

## پرسنل
`savePerson()` (RPC `app_save_person`)، `deletePerson(id)` (RPC `app_delete_person`)، `renderPersons()`.

## اقدامات
- `saveActivity()` — اعتبارسنجی، دریافت تازهٔ سرور، تشخیص شباهت (`findSimilar`, آستانه ۴۰٪ Jaccard فقط روی اقدامات قابل‌مشاهده).
- `joinActivity(id)`, `editAct(id)`, `deleteAct(id)`, `renderDayActs()`, `renderRecords()`.
- `canSeeAct(a)` / `getVisibleActs()` — حریم خصوصی «فقط برای من».
- `calcDurationHours(...)` — تک‌روزه: اختلاف ساعت؛ چندروزه: ۸ ساعت برای هر روز کاری، با کسر پنجشنبه، جمعه و همهٔ ردیف‌های جدول `holidays` (`getHolidayMap`, `isOffDay`).

## محل‌های برگزاری
`getLocationNames()`, `fillLocationSelect()`, `setLocationFields(loc)`, `readLocation()`, `saveLocation()`, `moveLocation(id,dir)`, `deleteLocation(id)`, `renderLocations()` (فقط سوپر ادمین).

## برنامه‌ریزی
`savePlan()`, `advancePlanStatus(id,status)`, `convertPlanToActivity(id)`, `handlePendingPlanConversion(id)`.

## گزارش و خروجی
`gatherReportData()`, `generateReport()`, `exportWord()`, `exportPPTX()`, `exportJSON()`, `importJSON()` (فقط سوپر ادمین و آنلاین؛ کاربران و هش رمزها در پشتیبان/بازیابی نیستند).

## تاریخ و ابزارها
`jalaliToGregorian`, `gregorianToJalali`, `normJ`, `addDaysStr`, `normText`, `simScore`, `esc` (جلوگیری از XSS)، `genId` (شناسهٔ امن).
