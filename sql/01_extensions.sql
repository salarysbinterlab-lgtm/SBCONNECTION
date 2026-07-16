-- 01_extensions.sql
-- Supabase/Postgres extensions + password helper wrappers
-- ใช้ wrapper เพื่อไม่ให้ติดปัญหา crypt()/gen_salt() อยู่คนละ schema

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Password policy: exactly 8 chars and no Thai characters.
create or replace function public.sb_is_valid_password(p_password text)
returns boolean
language sql
immutable
as $$
  select p_password is not null
     and char_length(p_password) = 8
     and p_password ~ '^[A-Za-z0-9]{8}$'
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

grant execute on function public.sb_is_valid_password(text) to anon, authenticated, service_role;
grant execute on function public.sb_hash_password(text) to anon, authenticated, service_role;
grant execute on function public.sb_verify_password(text,text) to anon, authenticated, service_role;
