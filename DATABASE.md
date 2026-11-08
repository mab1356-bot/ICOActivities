# 🗄 معماری بانک اطلاعاتی (Database Architecture) — نسخه ۳ (Supabase Auth)

دیتابیس PostgreSQL در Supabase. برای ایجاد/به‌روزرسانی ساختار، فایل `migration_v3.0.0.sql` را اجرا کنید.

## جداول

### `persons` (پروفایل کاربران)
| ستون | نوع | توضیح |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه (ساخته‌شده در کلاینت، حفظ‌شده از نسخه‌های قبل) |
| `user_id` | UUID | کلید خارجی به `auth.users(id)` (اتصال به Supabase Auth) |
| `firstname`, `lastname` | TEXT | نام و نام خانوادگی |
| `personnelid` | TEXT | شماره پرسنلی (یکتا، حداکثر ۶ رقم) |
| `username` | TEXT | نام کاربری (یکتا، برای ورود استفاده می‌شود) |
| `must_change_password` | BOOLEAN | آیا کاربر باید در اولین ورود رمز خود را تغییر دهد؟ |
| `role` | TEXT | `superadmin` / `admin` / `manager` / `user` |

### سایر جداول داده‌ای
- `topics`، `importance_levels`، `holidays`، `activities`، `planning_topics`، `locations`: ساختار مشابه نسخه قبل است.
- ستون `activities.createdby` و `participants` همچنان با `id` (TEXT) جدول `persons` کار می‌کنند (نه با `user_id`).

## توابع RPC (برای دسترسی‌های امن)
- `check_has_users()`: بررسی وجود کاربر برای نمایش فرم راه‌اندازی اولیه.
- `app_mark_password_changed()`: ثبت تغییر موفقیت‌آمیز رمز عبور توسط کاربر.

## توابع Edge Function (برای مدیریت Auth)
- `setup-admin`: ایجاد اولین کاربر (سوپر ادمین) و اتصال آن به جدول `persons` (با استفاده از Service Role).
- `create-user`: ایجاد کاربران جدید توسط ادمین (رمز پیش‌فرض = نام کاربری) و اتصال به `persons` (با حفظ ID قبلی در صورت وجود).

## 🔒 امنیت (RLS - Row Level Security)
- **تزریق نقش**: یک هوک سفارشی (`custom_access_token_hook`) در Supabase Auth، نقش کاربر را به توکن JWT اضافه می‌کند.
- **جدول persons**: خواندن برای همه کاربران لاگین‌شده مجاز است. درج/ویرایش/حذف فقط برای ادمین و سوپر ادمین.
- **جدول activities**: خواندن برای همه، اما رکوردهای `onlyforme = true` فقط توسط خالق آن رکورد قابل خواندن است. ویرایش و حذف بر اساس مالکیت یا نقش مدیریتی کنترل می‌شود.
- **سایر جداول**: خواندن برای همه کاربران لاگین‌شده، تغییرات فقط برای ادمین‌ها.