-- 03_core_schema.sql
create table if not exists app_settings (
  key text primary key,
  value text,
  description text,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists departments (
  dept_id bigserial primary key,
  dept_th text not null unique,
  dept_en text,
  dept_my text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists positions (
  position_id bigserial primary key,
  position_th text not null unique,
  position_en text,
  position_my text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  emp_id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role app_role not null default 'user',
  email citext,
  name_th text,
  surname_th text,
  nickname_th text,
  dept_th text,
  pos_th text,
  name_en text,
  surname_en text,
  nickname_en text,
  dept_en text,
  pos_en text,
  name_my text,
  surname_my text,
  nickname_my text,
  dept_my text,
  pos_my text,
  phone text,
  points integer not null default 0 check (points >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  avatar_url text,
  last_check_in date,
  check_in_count integer not null default 0 check (check_in_count >= 0),
  presence presence_status not null default 'offline',
  status user_status not null default 'active',
  start_work_date date,
  force_password_change boolean not null default true,
  password_changed_at timestamptz,
  password_reset_at timestamptz,
  password_reset_by_emp_id text references app_users(emp_id) on delete set null,
  password_policy text not null default '8-char-no-thai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_credentials (
  emp_id text primary key references app_users(emp_id) on delete cascade,
  password_hash text not null,
  password_algo text not null default 'pgcrypto_bf',
  must_change boolean not null default true,
  changed_at timestamptz,
  reset_at timestamptz,
  reset_by_emp_id text references app_users(emp_id) on delete set null
);

create table if not exists manager_department_permissions (
  id bigserial primary key,
  manager_emp_id text not null references app_users(emp_id) on delete cascade,
  dept_th text not null,
  updated_by_emp_id text references app_users(emp_id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(manager_emp_id, dept_th)
);

create table if not exists holidays (
  holiday_date date primary key,
  year int,
  month int,
  day int,
  weekday int,
  weekday_th text,
  is_weekend boolean not null default false,
  is_holiday boolean not null default false,
  holiday_name text,
  holiday_type text,
  is_workday boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists drive_assets (
  asset_id uuid primary key default gen_random_uuid(),
  owner_emp_id text references app_users(emp_id) on delete set null,
  module text not null, -- avatar/news/mission/reward/it_attachment/etc.
  ref_table text,
  ref_id text,
  drive_file_id text,
  drive_folder_id text,
  display_url text not null,
  original_url text,
  mime_type text,
  file_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  actor_emp_id text references app_users(emp_id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
