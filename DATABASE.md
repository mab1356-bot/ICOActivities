# 🗄 معماری بانک اطلاعاتی (Database Architecture)

این برنامه از دیتابیس PostgreSQL (میزبانی شده در Supabase) استفاده می‌کند. جداول به صورت منطقی به هم متصل هستند (ارتباط با استفاده از IDها برقرار می‌شود).

## ساختار جداول (Tables Schema)

### ۱. جدول `persons` (کاربران و پرسنل)
| نام ستون | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه یکتا (تولید شده در سمت کلاینت) |
| `firstname` | TEXT | نام |
| `lastname` | TEXT | نام خانوادگی |
| `personnelid` | TEXT | شماره پرسنلی (یکتا) |
| `username` | TEXT | نام کاربری (یکتا) |
| `passwordhash` | TEXT | هش SHA-256 رمز عبور |
| `role` | TEXT | نقش کاربر (`admin`, `manager`, `user`) |

### ۲. جدول `topics` (موضوعات اقدام)
| نام ستون | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه یکتا |
| `name` | TEXT | نام موضوع (مثلاً: جلسات) |

### ۳. جدول `importance_levels` (درجات اهمیت)
| نام ستون | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه یکتا |
| `name` | TEXT | نام درجه (مثلاً: خیلی مهم) |
| `color` | TEXT | کد رنگ HEX |
| `is_key` | BOOLEAN | آیا این اقدام کلیدی است؟ (برای داشبورد) |

### ۴. جدول `activities` (اقدامات ثبت‌شده)
| نام ستون | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه یکتا |
| `date` | TEXT | تاریخ شروع (فرمت: `1405/01/01`) |
| `enddate` | TEXT | تاریخ پایان (در صورت چندروزه بودن) |
| `starttime` | TEXT | ساعت شروع (`08:30`) |
| `endtime` | TEXT | ساعت پایان (`16:00`) |
| `topicid` | TEXT (FK) | ارجاع به جدول `topics.id` |
| `importance` | TEXT (FK) | ارجاع به جدول `importance_levels.id` |
| `description` | TEXT | شرح اقدام |
| `privatedescription` | TEXT | توضیحات تکمیلی (برای همه قابل مشاهده) |
| `location` | TEXT | محل برگزاری |
| `hours` | NUMERIC | مدت زمان محاسبه‌شده (ساعت) |
| `participants` | TEXT[] | آرایه‌ای از IDهای پرسنل (`persons.id`) |
| `onlyforme` | BOOLEAN | آیا فقط برای کاربر ثبت‌کننده نمایش داده شود؟ |
| `createdby` | TEXT (FK) | ارجاع به `persons.id` (ثبت‌کننده) |
| `createdat` | BIGINT | تایم‌استمپ ثبت (برای مرتب‌سازی) |

### ۵. جدول `holidays` (تعطیلات رسمی)
| نام ستون | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه یکتا |
| `date` | TEXT | تاریخ شمسی تعطیلی |
| `title` | TEXT | عنوان تعطیلی |

### ۶. جدول `planning_topics` (موضوعات در انتظار برنامه‌ریزی)
| نام ستون | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه یکتا |
| `title` | TEXT | عنوان موضوع |
| `requester` | TEXT | درخواست‌کننده |
| `assignee` | TEXT (FK) | ارجاع به `persons.id` (مسئول پیگیری) |
| `proposeddate` | TEXT | تاریخ پیشنهادی |
| `importanceid` | TEXT (FK) | ارجاع به `importance_levels.id` |
| `description` | TEXT | شرح نیاز |
| `status` | TEXT | وضعیت (`draft`, `coordinating`, `ready`, `converted`, `cancelled`) |
| `convertedactivityid` | TEXT (FK) | ارجاع به `activities.id` (در صورت تبدیل شدن) |

---

## 🔗 ارتباطات منطقی (Logical Relationships)

- **اقدامات و موضوعات**: `activities.topicid` → `topics.id` (هر اقدام یک موضوع دارد).
- **اقدامات و اهمیت**: `activities.importance` → `importance_levels.id` (هر اقدام یک درجه اهمیت دارد).
- **اقدامات و پرسنل**: `activities.createdby` → `persons.id` (ثبت‌کننده) و `activities.participants` (آرایه‌ای از IDها).
- **برنامه‌ریزی و اقدامات**: `planning_topics.convertedactivityid` → `activities.id` (ارتباط یک‌به‌یک پس از تبدیل).

## 🔒 سیاست‌های امنیتی (RLS in Supabase)
برای کارکرد صحیح برنامه (چون از کلید `anon` استفاده می‌شود)، باید در بخش **Authentication > Policies** در Supabase، برای تمامی ۶ جدول، دسترسی‌های `SELECT`, `INSERT`, `UPDATE` و `DELETE` را برای نقش `anon` فعال کنید (با شرط `true`).