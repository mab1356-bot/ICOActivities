<!-- نسخه مستندات: 4.3.7 -->
# مرجع توابع JavaScript — نسخه هدف 5.0.0

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


## گزارش‌گیری و خروجی‌ها (نسخه 4.3.7)
- `gatherReportData()` — گردآوری داده‌های گزارش مطابق فیلترهای جاری.
- `getReportSortedActivities(data)` — مرتب‌سازی سوابق بر اساس تاریخ و ساعت شروع.
- `getReportKeyActivities(data)` و `getReportKeyGroups(data)` — استخراج و گروه‌بندی اقدامات کلیدی.
- `buildWordReportHtml(data, withDetails)` و `exportWord()` — ساخت و دریافت گزارش Word با قالب مدیریتی.
- `exportPPTX()` — تولید ارائه PowerPoint با داشبورد، اقدامات کلیدی و جدول سوابق.
- `getReportKpis(data)` و `reportActivityDuration(activity)` — آماده‌سازی شاخص‌ها و مدت فعالیت.

## انتخاب‌گر ساعت (نسخه 4.3.7)
- `initTimePickers()` — حفظ انتخاب‌گر بومی در دستگاه‌های لمسی و فعال‌سازی Flatpickr 24 ساعته در دسکتاپ.
- `setTimePickerValue(id, value)` — تنظیم مقدار ساعت با قالب استاندارد `HH:mm` در ورودی بومی یا Flatpickr.
- `updateCalculatedHours()` — محاسبه مدت اقدام پس از تغییر ساعت شروع یا پایان.
- کتابخانه Flatpickr از CDN بارگیری می‌شود؛ در صورت در دسترس نبودن، ورودی بومی مرورگر fallback است.

## توابع افزوده نسخه 5.0.0

### درگاه و مدیریت ماژول‌ها
- `loadModuleCatalog()`: دریافت عنوان‌های نمایشی از `app_modules`.
- `loadModuleAccess()`: دریافت دسترسی ماژول‌های کاربر جاری از `person_module_access`.
- `savePersonModuleAccess(personId, moduleId, enabled)`: مدیریت دسترسی کارکنان به ماژول‌ها؛ فقط سوپر ادمین.
- `renderModuleHome()`: نمایش کارت‌ها، جستجو، ماژول‌های اخیر و علاقه‌مندی‌ها.
- `saveModuleTitle(id)`: ذخیره عنوان نمایشی؛ فقط سوپر ادمین.
- `showModuleHome()` و `openModule(id)`: جابه‌جایی بدون خروج از نشست.

### ثبت عدم حضور
- `loadAttendanceEvents()`: دریافت رویدادها طبق RLS.
- `saveAttendanceEvent()`: ثبت/ویرایش رویداد برای شخص جاری.
- `editAttendanceEvent(id)` و `deleteAttendanceEvent(id)`: مدیریت رویدادهای خود کاربر.
- `generateAttendanceReport()`: گزارش دوره‌ای برای نقش‌های مدیریتی.
- `exportAttendanceCsv()`: خروجی CSV سازگار با Excel، شامل خلاصه افراد و ریز رویدادها.
- `timeToMinutes()` و `normalizeTime()`: یکسان‌سازی ساعت‌های `HH:mm:ss` برگشتی از PostgreSQL و ورودی `HH:mm`.

اعتبارسنجی رابط کاربری جایگزین RLS نیست. اجرای مهاجرت SQL نسخه ۵ برای فعال شدن این قابلیت‌ها الزامی است.


## توابع داشبورد عدم حضور — نسخه 5.0.0
- `isAttendanceReportAdmin()`: فقط نقش‌های `admin` و `superadmin` را برای مشاهده گزارش سراسری مجاز می‌داند؛ از `isPriv()` عمومی ماژول فعالیت مستقل است.
- `generateAttendanceReport()`: داده‌ها را بر اساس بازه و فرد انتخابی محاسبه و داشبورد کلی، جدول افراد و جزئیات تاریخ‌دار هر فرد را تولید می‌کند.
- `exportAttendanceCsv()`: خلاصه افراد و ریز رویدادهای تاریخ‌دار را در CSV سازگار با Excel صادر می‌کند.
