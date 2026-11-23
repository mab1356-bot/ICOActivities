# 🗄 معماری بانک اطلاعاتی (Database Architecture) — نسخه انتشار 4.4.3

دیتابیس PostgreSQL در Supabase. برای ایجاد/به‌روزرسانی ساختار، فایل `migration_v3.0.0.sql` را اجرا کنید.

## جداول

### `persons` (پروفایل کاربران)
| ستون | نوع | توضیح |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | شناسه (حفظ‌شده از نسخه‌های قبل) |
| `user_id` | UUID | کلید خارجی به `auth.users(id)` (اتصال به Supabase Auth) |
| `firstname`, `lastname` | TEXT | نام و نام خانوادگی |
| `personnelid` | TEXT | شماره پرسنلی (یکتا) |
| `username` | TEXT | نام کاربری (یکتا، حداقل ۵ کاراکتر) |
| `must_change_password` | BOOLEAN | آیا کاربر باید در اولین ورود رمز خود را تغییر دهد؟ |
| `role` | TEXT | `superadmin` / `admin` / `manager` / `user` |

### `activities` (اقدامات)
- ستون `participants` از نوع **`jsonb`** (آرایه‌ای از شناسه‌های کاربران) است.
- ستون `createdby` نشان‌دهنده ثبت‌کننده اقدام است.

## توابع SQL (Functions)
- `check_has_users()`: بررسی وجود کاربر برای نمایش فرم راه‌اندازی اولیه.
- `app_mark_password_changed()`: ثبت تغییر موفقیت‌آمیز رمز عبور.
- `custom_access_token_hook(event jsonb)`: هوک تزریق نقش به توکن JWT.
- `is_manager_or_admin()`: تابع کمکی برای تشخیص نقش‌های مدیریتی.
- `prevent_unauthorized_activity_edit()`: تریگر امنیتی برای جلوگیری از ویرایش غیرمجاز.
- `app_remove_person_refs(p_id text)`: هنگام حذف کاربر، شناسه او را از آرایه `participants` پاک می‌کند.

## 🔒 امنیت (RLS - Row Level Security)
- **جدول persons**: خواندن برای همه کاربران لاگین‌شده. درج/ویرایش/حذف فقط برای ادمین و سوپر ادمین.
- **جدول activities**:
  - `SELECT`: اقدامات عمومی + اقدامات «فقط برای من» (فقط خالق و مدیران).
  - `INSERT`: خالق، مدیران، یا شرکت‌کنندگان.
  - `UPDATE`: باز است (تا تریگر امنیتی تصمیم بگیرد).
  - `DELETE`: مدیران، یا خالق (اگر تنها شرکت‌کننده باشد).
- **سایر جداول**: خواندن برای همه، تغییرات فقط برای ادمین‌ها.