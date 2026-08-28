-- 01_extensions.sql
-- Supabase/Postgres extensions + password helper wrappers
-- ใช้ wrapper เพื่อไม่ให้ติดปัญหา crypt()/gen_salt() อยู่คนละ schema

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Password policy (ต้องตรงกับ isPasswordValid() ใน src/App.tsx)
--   ยาว 8-72 ตัว (72 คือเพดานของ bcrypt), ต้องมีทั้งตัวอักษรและตัวเลข,
--   อนุญาตอักขระพิเศษ ASCII, ห้ามช่องว่าง, ห้ามอักษรไทย
-- เดิมบังคับ A-Za-z0-9 ยาว 8 ตัวพอดี ซึ่ง search space เล็กและห้ามอักขระพิเศษ
create or replace function public.sb_is_valid_password(p_password text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_password is not null
     and char_length(p_password) between 8 and 72
     and p_password = btrim(p_password)
     and p_password ~ '^[\x21-\x7E]+$'
     and p_password ~ '[A-Za-z]'
     and p_password ~ '[0-9]'
$$;

create or replace function public.sb_hash_password(p_password text)
returns text
language sql
set search_path = public, extensions
as $$
  select crypt(p_password, gen_salt('bf'))
$$;

create or replace function public.sb_verify_password(p_password text, p_hash text)
returns boolean
language sql
set search_path = public, extensions
as $$
  select coalesce(p_hash, '') <> '' and p_hash = crypt(p_password, p_hash)
$$;

-- ฟังก์ชันรหัสผ่านเป็นของภายในล้วน ให้เฉพาะ service_role
-- (เดิม grant ให้ anon ด้วย ซึ่งไม่มีเหตุผลให้เบราว์เซอร์เรียกเอง)
grant execute on function public.sb_is_valid_password(text) to service_role;
grant execute on function public.sb_hash_password(text) to service_role;
grant execute on function public.sb_verify_password(text,text) to service_role;
