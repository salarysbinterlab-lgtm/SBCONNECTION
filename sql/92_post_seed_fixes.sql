-- 92_post_seed_fixes.sql
-- Run after 91 seed.
-- รวม patch ปลอดภัยหลัง seed: created_at, password_reset_by_emp_id, first-login credentials

-- created_at safety
update app_users set created_at = now() where created_at is null;
alter table app_users alter column created_at set default now();
alter table app_users alter column created_at set not null;

-- FK safety: password_reset_by_emp_id ต้องเป็น emp_id ที่มีจริงเท่านั้น
update app_users
set password_reset_by_emp_id = null
where password_reset_by_emp_id is not null
  and not exists (select 1 from app_users u2 where u2.emp_id = app_users.password_reset_by_emp_id);

-- สร้าง/เติมรหัสเริ่มต้น 1234 เฉพาะคนที่ยังไม่มี credential
select public.prepare_first_login_credentials('1234');

-- Recalculate point summary from imported point_transactions
select public.recalc_user_points(emp_id) from app_users;
