# 🗄 معماری بانک اطلاعاتی (Database Architecture) — نسخه ۲

دیتابیس PostgreSQL در Supabase. ارتباط جداول منطقی است (با IDها). برای ایجاد/به‌روزرسانی ساختار، فایل `migration_v2.0.0.sql` را اجرا کنید.

## جداول

### `persons`
| ستون | نوع | توضیح |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه (ساخته‌شده در کلاینت) |
| `firstname`, `lastname` | TEXT | نام و نام خانوادگی |
| `personnelid` | TEXT | شماره پرسنلی (یکتا، حداکثر ۶ رقم) |
| `username` | TEXT | نام کاربری (یکتا) |
| `passwordhash` | TEXT | **bcrypt** از هش SHA-256 کلاینت (هش‌های قدیمی هنگام اولین ورود خودکار ارتقا می‌یابند). برای `anon` **قابل‌خواندن نیست**. |
| `role` | TEXT | `superadmin` / `admin` / `manager` / `user` |

### `topics`: `id`، `name` (و در صورت وجود در دیتابیس شما ستون `Sorting` که برنامه هنگام افزودن موضوع مقدار ۹۹ می‌فرستد).
### `importance_levels`: `id`، `name`، `color`، `is_key`.
### `activities`
`id`، `date`، `enddate`، `starttime`، `endtime`، `topicid`، `importance`، `description`، `privatedescription`، `location` (متن محل)، `hours`، `participants` (TEXT[])، **`onlyforme`** (BOOLEAN؛ فقط برای ثبت‌کننده نمایش داده می‌شود)، `createdby`، `createdat`.
### `holidays`: `id`، `date`، `title` — همهٔ ردیف‌ها در محاسبهٔ ساعت اقدامات چندروزه کسر می‌شوند.
### `planning_topics`
`id`، `title`، `requester`، `assignee`، `proposeddate`، `importanceid`، `description`، `status` (`draft|coordinating|ready|converted|cancelled`)، `locationhint`، `notes`، `createdby`، `createdat`، `convertedactivityid`، `convertedat`، `cancelreason`، `updatedat`.
### `locations` (جدید)
| ستون | نوع | توضیح |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه |
| `name` | TEXT (یکتا) | نام محل |
| `sort_order` | INTEGER | ترتیب نمایش (کوچک‌تر = بالاتر) |
فقط سوپر ادمین از رابط برنامه آن را ویرایش می‌کند. گزینهٔ «سایر» ثابت است و در جدول نیست.
### جدول‌های داخلی احراز هویت (برای `anon` کاملاً بسته)
- `app_sessions`: `token` (uuid)، `person_id`، `created_at`، `expires_at` (۱۲ ساعت).
- `app_login_attempts`: `username`، `fails`، `last_fail`، `locked_until` (۵ تلاش ناموفق = ۱۰ دقیقه قفل).

## توابع RPC (SECURITY DEFINER)
`app_login`، `app_logout`، `app_check_session`، `app_needs_setup`، `app_setup_first_admin`، `app_change_password`، `app_save_person`، `app_delete_person` (و تابع داخلی `app_caller` که از بیرون قابل‌فراخوانی نیست).

## ارتباطات منطقی
- `activities.topicid → topics.id`، `activities.importance → importance_levels.id`
- `activities.createdby → persons.id`، `activities.participants ⊂ persons.id`
- `planning_topics.convertedactivityid → activities.id`
- `activities.location` متنِ نام محل است (رابطهٔ کلید خارجی با `locations` ندارد؛ با حذف/تغییر نام محل، اقدامات قدیمی متن خود را حفظ می‌کنند).

## 🔒 امنیت (RLS)
- `persons`: فقط `SELECT` روی ستون‌های `id, firstname, lastname, personnelid, username, role`؛ نوشتن/حذف فقط از طریق RPC با نشست معتبر.
- سایر جداول (`topics`, `importance_levels`, `holidays`, `activities`, `planning_topics`, `locations`): `SELECT/INSERT/UPDATE/DELETE` برای `anon` با شرط `true` (چون برنامه با کلید anon کار می‌کند).
- محدودیت شناخته‌شده: چون کلید anon عمومی است، حفاظت واقعی ردیفی (مثل «فقط برای من» در سطح سرور) در این جداول ممکن نیست؛ راه‌حل نهایی مهاجرت به Supabase Auth است.
