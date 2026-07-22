-- GENERATED FILE: do not edit directly.
-- Run `npm run sql:bundle` after changing a migration.
-- Production-safe bundle for a blank database; destructive reset and DEV bootstrap are excluded.


-- =========================================================
-- 01_extensions.sql
-- =========================================================

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


-- =========================================================
-- 02_types.sql
-- =========================================================

-- 02_types.sql
do $$ begin
  create type app_role as enum ('user','manager','admin','admin_it','dev','exec');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('active','inactive','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type presence_status as enum ('online','offline','away');
exception when duplicate_object then null; end $$;

do $$ begin
  create type point_tx_type as enum ('earn','spend','adjust','refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('active','inactive','draft','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('system','point_earn','checkin','redeem','mission','news','chat','it_request','it_status','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending','approved','rejected','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_status as enum ('sent','read','unsent','deleted');
exception when duplicate_object then null; end $$;


-- =========================================================
-- 03_core_schema.sql
-- =========================================================

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


-- =========================================================
-- 04_content_schema.sql
-- =========================================================

-- 04_content_schema.sql
create table if not exists missions (
  mission_id text primary key,
  title text not null,
  description text,
  points integer not null default 0 check (points >= 0),
  image_url text,
  status content_status not null default 'active',
  tasks_json jsonb not null default '[]'::jsonb,
  limit_per_user integer,
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_missions (
  id bigserial primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  mission_id text not null references missions(mission_id) on delete cascade,
  completed_at timestamptz,
  status text not null default 'Completed',
  is_synced boolean not null default true,
  evidence_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(emp_id, mission_id)
);

create table if not exists news_posts (
  news_id text primary key,
  topic text not null,
  detail text,
  news_type text,
  publish_date date,
  pinned boolean not null default false,
  image_url text,
  points integer not null default 0 check (points >= 0),
  status content_status not null default 'active',
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_news_reads (
  id bigserial primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  news_id text references news_posts(news_id) on delete set null,
  topic text,
  read_at timestamptz not null default now(),
  points integer not null default 0,
  unique(emp_id, news_id)
);

create table if not exists referrals (
  id bigserial primary key,
  referrer_emp_id text references app_users(emp_id) on delete cascade,
  referee_emp_id text references app_users(emp_id) on delete cascade,
  referral_date timestamptz,
  status text,
  created_at timestamptz not null default now(),
  unique(referrer_emp_id, referee_emp_id)
);


-- =========================================================
-- 05_points_rewards_schema.sql
-- =========================================================

-- 05_points_rewards_schema.sql
create table if not exists point_transactions (
  tx_id text primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  tx_type point_tx_type not null,
  amount integer not null,
  description text,
  balance_after integer not null default 0,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rewards (
  reward_id text primary key,
  name text not null,
  points_required integer not null default 0 check (points_required >= 0),
  stock integer not null default 0 check (stock >= 0),
  detail text,
  image_url text,
  status content_status not null default 'active',
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_redemptions (
  redemption_id text primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  reward_id text references rewards(reward_id) on delete set null,
  reward_name text,
  points_spent integer not null default 0,
  status text not null default 'Pending',
  redeemed_at timestamptz not null default now(),
  approved_by_emp_id text references app_users(emp_id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists overall_logs (
  log_id text primary key,
  employee_id text references app_users(emp_id) on delete set null,
  source_type text,
  source_id text,
  point_before integer,
  points_change integer,
  point_after integer,
  activity_date date,
  activity_time time,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists checkin_logs (
  log_id text primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  checkin_date date not null,
  checkin_time time,
  points_earned integer not null default 1,
  status text not null default 'Success',
  created_at timestamptz not null default now(),
  unique(emp_id, checkin_date)
);


-- =========================================================
-- 06_chat_notifications_schema.sql
-- =========================================================

-- 06_chat_notifications_schema.sql
create table if not exists notifications (
  notification_id text primary key,
  emp_id text references app_users(emp_id) on delete cascade, -- null or ALL = broadcast via notification_targets
  title text not null,
  message text,
  type notification_type not null default 'system',
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists notification_targets (
  id bigserial primary key,
  notification_id text not null references notifications(notification_id) on delete cascade,
  emp_id text not null references app_users(emp_id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  unique(notification_id, emp_id)
);

create table if not exists chat_faq (
  keyword text primary key,
  response text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists direct_messages (
  msg_id text primary key,
  sender_emp_id text references app_users(emp_id) on delete set null,
  receiver_emp_id text references app_users(emp_id) on delete set null,
  content text,
  reply_to_id text references direct_messages(msg_id) on delete set null,
  sent_at timestamptz not null default now(),
  status message_status not null default 'sent',
  reply_to_content text,
  room_key text generated always as (
    case
      when sender_emp_id is null or receiver_emp_id is null then null
      when sender_emp_id < receiver_emp_id then sender_emp_id || '_' || receiver_emp_id
      else receiver_emp_id || '_' || sender_emp_id
    end
  ) stored,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists ai_chat_logs (
  id bigserial primary key,
  emp_id text references app_users(emp_id) on delete set null,
  question text,
  answer text,
  created_at timestamptz not null default now()
);


-- =========================================================
-- 07_it_requests_schema.sql
-- =========================================================

-- 07_it_requests_schema.sql
create table if not exists it_requests (
  request_no text primary key,
  requested_at timestamptz not null default now(),
  objectives text,
  request_details text,
  reason_of_necessity text,
  spec text,
  requester_emp_id text references app_users(emp_id) on delete set null,
  requester_name text,
  requester_position text,
  requester_department text,
  requested_date date,
  desired_date date,
  manager_status request_status not null default 'pending',
  manager_date timestamptz,
  manager_emp_id text references app_users(emp_id) on delete set null,
  it_status request_status not null default 'pending',
  it_date timestamptz,
  it_emp_id text references app_users(emp_id) on delete set null,
  input_check text,
  input_repair text,
  input_other text,
  attachment_url text,
  pdf_report_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- 08_views.sql
-- =========================================================

-- 08_views.sql
create or replace view v_ranking
with (security_invoker = true) as
select
  row_number() over (order by points desc, total_earned desc, emp_id asc) as rank_no,
  emp_id,
  coalesce(nullif(trim(name_th || ' ' || surname_th), ''), emp_id) as display_name,
  nickname_th,
  dept_th,
  pos_th,
  avatar_url,
  points,
  total_earned,
  check_in_count,
  last_check_in
from app_users
where status = 'active';

create or replace view v_user_dashboard
with (security_invoker = true) as
select
  u.emp_id,
  u.points,
  u.total_earned,
  u.check_in_count,
  u.last_check_in,
  (select count(*) from user_missions um where um.emp_id = u.emp_id) as completed_missions,
  (select count(*) from user_news_reads nr where nr.emp_id = u.emp_id) as read_news_count,
  (select count(*) from reward_redemptions rr where rr.emp_id = u.emp_id) as redemption_count,
  (select count(*) from notifications n where n.emp_id = u.emp_id and not n.is_read) as unread_notifications
from app_users u;

create or replace view v_admin_dashboard_kpis
with (security_invoker = true) as
select
  (select count(*) from app_users where status = 'active') as active_users,
  (select count(*) from app_users where role in ('admin','admin_it','dev')) as admin_users,
  (select count(*) from checkin_logs where checkin_date = current_date) as checkins_today,
  (select count(*) from reward_redemptions where redeemed_at::date = current_date) as redemptions_today,
  (select coalesce(sum(amount),0) from point_transactions where tx_type = 'earn') as total_points_earned,
  (select coalesce(sum(points_spent),0) from reward_redemptions) as total_points_spent;

create or replace view v_active_news
with (security_invoker = true) as
select * from news_posts
where status = 'active'
order by pinned desc, publish_date desc nulls last, created_at desc;

create or replace view v_active_missions
with (security_invoker = true) as
select * from missions
where status = 'active'
order by created_at desc;

create or replace view v_active_rewards
with (security_invoker = true) as
select * from rewards
where status = 'active'
order by stock desc, points_required asc;

create or replace view v_manager_departments
with (security_invoker = true) as
select
  mdp.manager_emp_id,
  coalesce(nullif(trim(u.name_th || ' ' || u.surname_th), ''), mdp.manager_emp_id) as manager_name,
  array_agg(mdp.dept_th order by mdp.dept_th) as departments,
  max(mdp.updated_at) as updated_at
from manager_department_permissions mdp
left join app_users u on u.emp_id = mdp.manager_emp_id
group by mdp.manager_emp_id, manager_name;


-- =========================================================
-- 09_functions_triggers.sql
-- =========================================================

-- 09_functions_triggers.sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_app_users_updated_at on app_users;
create trigger trg_app_users_updated_at
before update on app_users
for each row execute function set_updated_at();

drop trigger if exists trg_missions_updated_at on missions;
create trigger trg_missions_updated_at
before update on missions
for each row execute function set_updated_at();

drop trigger if exists trg_news_posts_updated_at on news_posts;
create trigger trg_news_posts_updated_at
before update on news_posts
for each row execute function set_updated_at();

drop trigger if exists trg_rewards_updated_at on rewards;
create trigger trg_rewards_updated_at
before update on rewards
for each row execute function set_updated_at();

drop trigger if exists trg_it_requests_updated_at on it_requests;
create trigger trg_it_requests_updated_at
before update on it_requests
for each row execute function set_updated_at();

create or replace function current_emp_id()
returns text
language sql
stable
as $$
  select emp_id from app_users where auth_user_id = (select auth.uid()) limit 1
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users
    where auth_user_id = (select auth.uid())
      and role in ('admin','admin_it','dev')
      and status = 'active'
  )
$$;

create or replace function is_it_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users
    where auth_user_id = (select auth.uid())
      and role in ('admin_it','dev')
      and status = 'active'
  )
$$;

create or replace function recalc_user_points(p_emp_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_points integer;
declare v_earned integer;
begin
  select greatest(coalesce(sum(amount),0),0),
         coalesce(sum(case when amount > 0 then amount else 0 end),0)
  into v_points, v_earned
  from point_transactions
  where emp_id = p_emp_id;

  update app_users
  set points = v_points,
      total_earned = v_earned
  where emp_id = p_emp_id;

  return v_points;
end $$;

create or replace function add_point_transaction(
  p_emp_id text,
  p_tx_type point_tx_type,
  p_amount integer,
  p_description text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(tx_id text, balance_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare v_tx_id text;
declare v_current_points integer;
declare v_balance integer;
begin
  if p_emp_id is null or not exists (select 1 from app_users where emp_id = p_emp_id) then
    raise exception 'invalid emp_id';
  end if;

  v_tx_id := 'TX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  select coalesce(points,0)
  into v_current_points
  from app_users
  where emp_id = p_emp_id
  for update;

  v_balance := v_current_points + p_amount;

  if v_balance < 0 then
    raise exception 'insufficient points';
  end if;

  insert into point_transactions(tx_id, emp_id, tx_type, amount, description, balance_after, source_type, source_id, metadata)
  values (v_tx_id, p_emp_id, p_tx_type, p_amount, p_description, v_balance, p_source_type, p_source_id, coalesce(p_metadata,'{}'::jsonb));

  update app_users
  set points = v_balance,
      total_earned = case when p_amount > 0 then total_earned + p_amount else total_earned end
  where emp_id = p_emp_id;

  return query select v_tx_id, v_balance;
end $$;

create or replace function process_checkin(p_emp_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_today date := current_date;
declare v_tx record;
declare v_log_id text;
begin
  if exists (select 1 from checkin_logs where emp_id = p_emp_id and checkin_date = v_today) then
    return jsonb_build_object('status','already_checked','message','เช็คอินวันนี้แล้ว');
  end if;

  v_log_id := 'CH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into checkin_logs(log_id, emp_id, checkin_date, checkin_time, points_earned, status)
  values (v_log_id, p_emp_id, v_today, localtime(0), 1, 'Success');

  select * into v_tx
  from add_point_transaction(p_emp_id, 'earn', 1, 'Daily Check-in', 'CHECKIN', v_log_id, jsonb_build_object('date', v_today));

  update app_users
  set last_check_in = v_today,
      check_in_count = check_in_count + 1
  where emp_id = p_emp_id;

  insert into notifications(notification_id, emp_id, title, message, type, metadata)
  values ('NOTI-' || floor(extract(epoch from clock_timestamp())*1000)::bigint || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),
          p_emp_id, 'เช็คอินสำเร็จ', 'คุณได้รับ 1 แต้มจากการเช็คอินวันนี้', 'checkin',
          jsonb_build_object('txId', v_tx.tx_id, 'points', 1, 'balance', v_tx.balance_after));

  return jsonb_build_object('status','success','logId',v_log_id,'txId',v_tx.tx_id,'newPoints',v_tx.balance_after);
end $$;

create or replace function redeem_reward(p_emp_id text, p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r rewards%rowtype;
declare v_points integer;
declare v_redemption_id text;
declare v_tx record;
begin
  select * into r from rewards where reward_id = p_reward_id and status = 'active' for update;
  if not found then raise exception 'reward not found'; end if;
  if r.stock <= 0 then raise exception 'out of stock'; end if;

  select points into v_points from app_users where emp_id = p_emp_id for update;
  if v_points < r.points_required then raise exception 'insufficient points'; end if;

  v_redemption_id := 'RDM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  update rewards set stock = stock - 1 where reward_id = p_reward_id;

  select * into v_tx from add_point_transaction(
    p_emp_id, 'spend', -r.points_required, 'Redeem: ' || r.name, 'REDEEM', v_redemption_id,
    jsonb_build_object('rewardId', p_reward_id, 'rewardName', r.name)
  );

  insert into reward_redemptions(redemption_id, emp_id, reward_id, reward_name, points_spent, status)
  values (v_redemption_id, p_emp_id, p_reward_id, r.name, r.points_required, 'Pending');

  insert into notifications(notification_id, emp_id, title, message, type, metadata)
  values ('NOTI-' || floor(extract(epoch from clock_timestamp())*1000)::bigint || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),
          p_emp_id, 'แลกรางวัลสำเร็จ', 'แลก ' || r.name || ' ใช้ ' || r.points_required || ' แต้ม', 'redeem',
          jsonb_build_object('redemptionId', v_redemption_id, 'rewardId', p_reward_id, 'balance', v_tx.balance_after));

  return jsonb_build_object('status','success','redemptionId',v_redemption_id,'newPoints',v_tx.balance_after,'stock',r.stock - 1);
end $$;


-- =========================================================
-- 10_rls_policies.sql
-- =========================================================

-- 10_rls_policies.sql
-- RLS is designed for Supabase Auth. For a pure static GitHub frontend, use supabase-js auth session.
-- user_credentials has no SELECT policy by design.

alter table app_settings enable row level security;
alter table departments enable row level security;
alter table positions enable row level security;
alter table app_users enable row level security;
alter table user_credentials enable row level security;
alter table manager_department_permissions enable row level security;
alter table holidays enable row level security;
alter table drive_assets enable row level security;
alter table admin_audit_logs enable row level security;
alter table missions enable row level security;
alter table user_missions enable row level security;
alter table news_posts enable row level security;
alter table user_news_reads enable row level security;
alter table referrals enable row level security;
alter table point_transactions enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;
alter table overall_logs enable row level security;
alter table checkin_logs enable row level security;
alter table notifications enable row level security;
alter table notification_targets enable row level security;
alter table chat_faq enable row level security;
alter table direct_messages enable row level security;
alter table ai_chat_logs enable row level security;
alter table it_requests enable row level security;

-- public-ish read data for logged-in users
drop policy if exists "authenticated can read public settings" on app_settings;
create policy "authenticated can read public settings" on app_settings
for select to authenticated using (is_public = true or is_admin());

drop policy if exists "authenticated can read departments" on departments;
create policy "authenticated can read departments" on departments
for select to authenticated using (true);

drop policy if exists "authenticated can read positions" on positions;
create policy "authenticated can read positions" on positions
for select to authenticated using (true);

drop policy if exists "authenticated can read active users" on app_users;
create policy "authenticated can read active users" on app_users
for select to authenticated using (status = 'active' or (select auth.uid()) = auth_user_id or is_admin());

drop policy if exists "users update own presence only" on app_users;
create policy "users update own presence only" on app_users
for update to authenticated
using ((select auth.uid()) = auth_user_id or is_admin())
with check ((select auth.uid()) = auth_user_id or is_admin());

-- admin writes
drop policy if exists "admin manage users" on app_users;
create policy "admin manage users" on app_users
for all to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage credentials" on user_credentials;
create policy "admin manage credentials" on user_credentials
for all to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists "read holidays" on holidays;
create policy "read holidays" on holidays
for select to authenticated using (true);

drop policy if exists "admin manage holidays" on holidays;
create policy "admin manage holidays" on holidays
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "read active missions" on missions;
create policy "read active missions" on missions
for select to authenticated using (status = 'active' or is_admin());

drop policy if exists "admin manage missions" on missions;
create policy "admin manage missions" on missions
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "users read own missions" on user_missions;
create policy "users read own missions" on user_missions
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users insert own missions" on user_missions;
create policy "users insert own missions" on user_missions
for insert to authenticated with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "read active news" on news_posts;
create policy "read active news" on news_posts
for select to authenticated using (status = 'active' or is_admin());

drop policy if exists "admin manage news" on news_posts;
create policy "admin manage news" on news_posts
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "users read own news logs" on user_news_reads;
create policy "users read own news logs" on user_news_reads
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users insert own news logs" on user_news_reads;
create policy "users insert own news logs" on user_news_reads
for insert to authenticated with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "read active rewards" on rewards;
create policy "read active rewards" on rewards
for select to authenticated using (status = 'active' or is_admin());

drop policy if exists "admin manage rewards" on rewards;
create policy "admin manage rewards" on rewards
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "users read own point tx" on point_transactions;
create policy "users read own point tx" on point_transactions
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own redemptions" on reward_redemptions;
create policy "users read own redemptions" on reward_redemptions
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own checkins" on checkin_logs;
create policy "users read own checkins" on checkin_logs
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications" on notifications
for select to authenticated using (emp_id = current_emp_id() or emp_id is null or is_admin());

drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications" on notifications
for update to authenticated using (emp_id = current_emp_id() or is_admin())
with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "read chat faq" on chat_faq;
create policy "read chat faq" on chat_faq
for select to authenticated using (is_active = true or is_admin());

drop policy if exists "users read own messages" on direct_messages;
create policy "users read own messages" on direct_messages
for select to authenticated using (sender_emp_id = current_emp_id() or receiver_emp_id = current_emp_id() or is_admin());

drop policy if exists "users send messages" on direct_messages;
create policy "users send messages" on direct_messages
for insert to authenticated with check (sender_emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own ai logs" on ai_chat_logs;
create policy "users read own ai logs" on ai_chat_logs
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users insert own ai logs" on ai_chat_logs;
create policy "users insert own ai logs" on ai_chat_logs
for insert to authenticated with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own or authorized it requests" on it_requests;
create policy "users read own or authorized it requests" on it_requests
for select to authenticated
using (
  requester_emp_id = current_emp_id()
  or is_it_admin()
  or exists (
    select 1 from manager_department_permissions mdp
    where mdp.manager_emp_id = current_emp_id()
      and lower(mdp.dept_th) = lower(it_requests.requester_department)
  )
  or is_admin()
);

drop policy if exists "users create own it requests" on it_requests;
create policy "users create own it requests" on it_requests
for insert to authenticated with check (requester_emp_id = current_emp_id() or is_admin());

drop policy if exists "manager it admin update requests" on it_requests;
create policy "manager it admin update requests" on it_requests
for update to authenticated
using (
  is_it_admin()
  or exists (
    select 1 from manager_department_permissions mdp
    where mdp.manager_emp_id = current_emp_id()
      and lower(mdp.dept_th) = lower(it_requests.requester_department)
  )
  or is_admin()
)
with check (true);


-- =========================================================
-- 11_public_session_rpc_FINAL.sql
-- =========================================================

-- 11_public_session_rpc_FINAL.sql
-- FINAL RPC layer for legacy HTML + Supabase.
-- ใช้ custom public session token สำหรับเว็บ static / internal test
-- รูปจริงอยู่ Google Drive; ใน Supabase เก็บ image_url/display_url/drive_assets

create table if not exists public_sessions (
  session_token uuid primary key default gen_random_uuid(),
  emp_id text not null references app_users(emp_id) on delete cascade,
  role app_role not null default 'user',
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  revoked_at timestamptz
);

alter table public_sessions enable row level security;

create or replace function public.public_session_emp_id(p_token uuid)
returns text language sql security definer set search_path = public stable as $$
  select emp_id from public_sessions
  where session_token = p_token and revoked_at is null and expires_at > now()
  limit 1
$$;

create or replace function public.public_session_role(p_token uuid)
returns app_role language sql security definer set search_path = public stable as $$
  select role from public_sessions
  where session_token = p_token and revoked_at is null and expires_at > now()
  limit 1
$$;

create or replace function public.public_session_is_admin(p_token uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(public_session_role(p_token) in ('admin','admin_it','dev'), false)
$$;

create or replace function public.prepare_first_login_credentials(p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_count int;
begin
  insert into user_credentials(emp_id, password_hash, must_change, reset_at)
  select u.emp_id, public.sb_hash_password(coalesce(nullif(trim(p_temp_password), ''), u.emp_id)), true, now()
  from app_users u
  left join user_credentials c on c.emp_id = u.emp_id
  where c.emp_id is null and u.status = 'active';

  get diagnostics v_count = row_count;

  update app_users
  set force_password_change = true,
      password_reset_at = coalesce(password_reset_at, now()),
      password_reset_by_emp_id = null,
      updated_at = now()
  where status = 'active'
    and emp_id in (select emp_id from user_credentials where must_change = true);

  return jsonb_build_object('status','success','created_credentials',v_count);
end $$;

create or replace function public.login_with_emp_password(
  p_emp_id text,
  p_password text,
  p_user_agent text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u app_users%rowtype; c user_credentials%rowtype; v_token uuid; v_must_change boolean;
begin
  select * into u from app_users
  where lower(emp_id) = lower(trim(p_emp_id)) and status = 'active'
  limit 1;

  if not found then
    return jsonb_build_object('status','error','message','ไม่พบรหัสพนักงานนี้ หรือผู้ใช้ถูกปิดใช้งาน');
  end if;

  select * into c from user_credentials where emp_id = u.emp_id;
  if not found then
    return jsonb_build_object('status','first_setup_required','message','บัญชียังไม่มีรหัสผ่าน ให้ตั้งรหัสผ่านครั้งแรก');
  end if;

  if not public.sb_verify_password(coalesce(p_password,''), c.password_hash) then
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  v_must_change := coalesce(c.must_change, false) or coalesce(u.force_password_change, false);

  insert into public_sessions(emp_id, role, user_agent)
  values (u.emp_id, u.role, p_user_agent)
  returning session_token into v_token;

  update app_users set presence = 'online', updated_at = now() where emp_id = u.emp_id;

  return jsonb_build_object(
    'status','success','token',v_token,'mustChangePassword',v_must_change,
    'redirectPage', case when u.role in ('admin','admin_it','dev') then 'admin' else 'home' end,
    'user', jsonb_build_object(
      'empId',u.emp_id,'role',u.role,'email',u.email,
      'name',trim(concat_ws(' ',u.name_th,u.surname_th)),'nickname',u.nickname_th,
      'dept',u.dept_th,'position',u.pos_th,'points',u.points,'avatar',u.avatar_url,
      'checkInCount',u.check_in_count,'lastCheckIn',u.last_check_in,'mustChangePassword',v_must_change
    )
  );
end $$;

create or replace function public.change_my_password(
  p_token uuid,
  p_current_password text,
  p_new_password text,
  p_confirm_password text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp_id text; c user_credentials%rowtype;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  if coalesce(p_new_password,'') <> coalesce(p_confirm_password,'') then return jsonb_build_object('status','error','message','รหัสผ่านใหม่ไม่ตรงกัน'); end if;
  if not public.sb_is_valid_password(p_new_password) then return jsonb_build_object('status','error','message','รหัสผ่านต้องเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี'); end if;

  select * into c from user_credentials where emp_id = v_emp_id;
  if not found then return jsonb_build_object('status','error','message','ไม่พบข้อมูลรหัสผ่านเดิม'); end if;
  if not public.sb_verify_password(coalesce(p_current_password,''), c.password_hash) then return jsonb_build_object('status','error','message','รหัสผ่านเดิมไม่ถูกต้อง'); end if;
  if public.sb_verify_password(p_new_password, c.password_hash) then return jsonb_build_object('status','error','message','รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม'); end if;

  update user_credentials set password_hash = public.sb_hash_password(p_new_password), must_change = false, changed_at = now() where emp_id = v_emp_id;
  update app_users set force_password_change = false, password_changed_at = now(), updated_at = now() where emp_id = v_emp_id;

  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values(v_emp_id, 'CHANGE_MY_PASSWORD', 'app_users', v_emp_id, jsonb_build_object('changed_at', now()));

  return jsonb_build_object('status','success','message','เปลี่ยนรหัสผ่านสำเร็จ');
end $$;

create or replace function public.setup_first_password_no_credential(
  p_emp_id text,
  p_new_password text,
  p_confirm_password text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u app_users%rowtype; v_exists boolean;
begin
  select * into u from app_users where lower(emp_id)=lower(trim(p_emp_id)) and status='active' limit 1;
  if not found then return jsonb_build_object('status','error','message','ไม่พบรหัสพนักงานนี้ หรือผู้ใช้ถูกปิดใช้งาน'); end if;
  select exists(select 1 from user_credentials where emp_id = u.emp_id) into v_exists;
  if v_exists then return jsonb_build_object('status','error','message','บัญชีนี้มีรหัสผ่านแล้ว ให้เข้าสู่ระบบหรือให้ Admin reset'); end if;
  if coalesce(p_new_password,'') <> coalesce(p_confirm_password,'') then return jsonb_build_object('status','error','message','รหัสผ่านใหม่ไม่ตรงกัน'); end if;
  if not public.sb_is_valid_password(p_new_password) then return jsonb_build_object('status','error','message','รหัสผ่านต้องเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี'); end if;

  insert into user_credentials(emp_id, password_hash, must_change, changed_at)
  values (u.emp_id, public.sb_hash_password(p_new_password), false, now());
  update app_users set force_password_change = false, password_changed_at = now(), updated_at = now() where emp_id = u.emp_id;
  return jsonb_build_object('status','success','message','ตั้งรหัสผ่านครั้งแรกสำเร็จ');
end $$;

create or replace function public.logout_public_session(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public_session_emp_id(p_token);
  update public_sessions set revoked_at = now() where session_token = p_token;
  if v_emp_id is not null then update app_users set presence = 'offline', updated_at = now() where emp_id = v_emp_id; end if;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.public_checkin(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  return process_checkin(v_emp_id);
end $$;

create or replace function public.public_redeem_reward(p_token uuid, p_reward_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  return redeem_reward(v_emp_id, p_reward_id);
end $$;

create or replace function public.public_read_news(p_token uuid, p_news_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text; n news_posts%rowtype; v_tx record; v_already boolean;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  select * into n from news_posts where news_id = p_news_id and status = 'active';
  if not found then return jsonb_build_object('status','error','message','ไม่พบข่าวนี้'); end if;
  select exists(select 1 from user_news_reads where emp_id=v_emp_id and news_id=p_news_id) into v_already;
  if v_already then return jsonb_build_object('status','success','message','อ่านข่าวนี้แล้ว','already',true); end if;
  insert into user_news_reads(emp_id, news_id, topic, points) values(v_emp_id, n.news_id, n.topic, n.points);
  if coalesce(n.points,0) > 0 then
    select * into v_tx from add_point_transaction(v_emp_id,'earn',n.points,'Read news: ' || n.topic,'NEWS',n.news_id,jsonb_build_object('newsId',n.news_id));
  end if;
  return jsonb_build_object('status','success','message','อ่านข่าวสำเร็จ','points',n.points,'newPoints',coalesce(v_tx.balance_after,(select points from app_users where emp_id=v_emp_id)));
end $$;

create or replace function public.public_complete_mission(p_token uuid, p_mission_id text, p_evidence_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text; m missions%rowtype; v_tx record; v_already boolean;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  select * into m from missions where mission_id = p_mission_id and status = 'active';
  if not found then return jsonb_build_object('status','error','message','ไม่พบภารกิจนี้'); end if;
  select exists(select 1 from user_missions where emp_id=v_emp_id and mission_id=p_mission_id) into v_already;
  if v_already then return jsonb_build_object('status','success','message','ทำภารกิจนี้แล้ว','already',true); end if;
  insert into user_missions(emp_id, mission_id, completed_at, status, evidence_url)
  values(v_emp_id, m.mission_id, now(), 'Completed', p_evidence_url);
  if coalesce(m.points,0) > 0 then
    select * into v_tx from add_point_transaction(v_emp_id,'earn',m.points,'Mission: ' || m.title,'MISSION',m.mission_id,jsonb_build_object('missionId',m.mission_id,'evidenceUrl',p_evidence_url));
  end if;
  return jsonb_build_object('status','success','message','บันทึกภารกิจสำเร็จ','points',m.points,'newPoints',coalesce(v_tx.balance_after,(select points from app_users where emp_id=v_emp_id)));
end $$;

create or replace function public.get_home_payload(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text; u app_users%rowtype; c user_credentials%rowtype; v_must_change boolean;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  select * into u from app_users where emp_id = v_emp_id;
  select * into c from user_credentials where emp_id = v_emp_id;
  v_must_change := coalesce(c.must_change, false) or coalesce(u.force_password_change, false);
  return jsonb_build_object(
    'status','success','mustChangePassword',v_must_change,
    'user', jsonb_build_object('empId',u.emp_id,'role',u.role,'email',u.email,'name',trim(concat_ws(' ',u.name_th,u.surname_th)),'nickname',u.nickname_th,'dept',u.dept_th,'position',u.pos_th,'points',u.points,'avatar',u.avatar_url,'checkInCount',u.check_in_count,'lastCheckIn',u.last_check_in,'mustChangePassword',v_must_change),
    'ranking', coalesce((select jsonb_agg(to_jsonb(x)) from (select emp_id, display_name, dept_th, points, total_earned, rank_no from v_ranking limit 10) x),'[]'::jsonb),
    'news', coalesce((select jsonb_agg(to_jsonb(x)) from (select news_id, topic, detail, image_url, points, publish_date, pinned from news_posts where status='active' order by pinned desc, publish_date desc nulls last, created_at desc limit 6) x),'[]'::jsonb),
    'missions', coalesce((select jsonb_agg(to_jsonb(x)) from (select mission_id, title, description, image_url, points, status from missions where status='active' order by created_at desc limit 6) x),'[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(to_jsonb(x)) from (select reward_id, name, detail, image_url, points_required, stock, status from rewards where status='active' order by points_required asc, created_at desc limit 6) x),'[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(x)) from (select notification_id, title, message, type, is_read, created_at from notifications where emp_id = v_emp_id or emp_id is null order by created_at desc limit 10) x),'[]'::jsonb)
  );
end $$;

create or replace function public.public_page_payload(p_token uuid, p_page text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;

  if p_page = 'news' then
    return jsonb_build_object('status','success','myPoints',(select points from app_users where emp_id=v_emp_id),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select n.news_id as id, n.topic as title, n.detail as description, n.image_url, n.points, n.status, n.publish_date, coalesce(r.id is not null,false) as done from news_posts n left join user_news_reads r on r.news_id=n.news_id and r.emp_id=v_emp_id where n.status='active' order by n.pinned desc, n.publish_date desc nulls last, n.created_at desc) x),'[]'::jsonb));
  elsif p_page = 'mission' then
    return jsonb_build_object('status','success','myPoints',(select points from app_users where emp_id=v_emp_id),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select m.mission_id as id, m.title, m.description, m.image_url, m.points, m.status, coalesce(um.id is not null,false) as done from missions m left join user_missions um on um.mission_id=m.mission_id and um.emp_id=v_emp_id where m.status='active' order by m.created_at desc) x),'[]'::jsonb));
  elsif p_page = 'rewards' then
    return jsonb_build_object('status','success','myPoints',(select points from app_users where emp_id=v_emp_id),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select reward_id as id, name as title, detail as description, image_url, points_required as points, stock, status, ((select points from app_users where emp_id=v_emp_id) >= points_required and stock > 0) as can_redeem from rewards where status='active' order by points_required asc, created_at desc) x),'[]'::jsonb));
  elsif p_page = 'ranking' then
    return jsonb_build_object('status','success','myPoints',(select points from app_users where emp_id=v_emp_id),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select rank_no as id, emp_id, display_name as title, dept_th as description, avatar_url as image_url, points, total_earned, check_in_count from v_ranking order by rank_no asc) x),'[]'::jsonb));
  elsif p_page = 'overall_log' then
    return jsonb_build_object('status','success','myPoints',(select points from app_users where emp_id=v_emp_id),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select tx_id as id, description as title, source_type as description, amount as points, balance_after, created_at from point_transactions where emp_id=v_emp_id order by created_at desc limit 100) x),'[]'::jsonb));
  end if;

  return jsonb_build_object('status','error','message','UNKNOWN_PAGE');
end $$;

create or replace function public.public_list_notifications(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  return jsonb_build_object('status','success','items',coalesce((select jsonb_agg(to_jsonb(x)) from (select notification_id, title, message, type, is_read, created_at from notifications where emp_id=v_emp_id or emp_id is null order by is_read asc, created_at desc limit 100) x),'[]'::jsonb));
end $$;

create or replace function public.public_mark_notification_read(p_token uuid, p_notification_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;
  update notifications set is_read=true, read_at=now() where notification_id=p_notification_id and (emp_id=v_emp_id or emp_id is null);
  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_dashboard_payload(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_emp_id := public_session_emp_id(p_token);
  return jsonb_build_object(
    'status','success','actorEmpId',v_emp_id,
    'kpi',jsonb_build_object('users',(select count(*) from app_users),'activeUsers',(select count(*) from app_users where status='active'),'points',(select coalesce(sum(points),0) from app_users),'pendingIT',(select count(*) from it_requests where manager_status='pending' or it_status='pending'),'rewards',(select count(*) from rewards),'todayCheckin',(select count(*) from checkin_logs where checkin_date=current_date)),
    'topUsers',coalesce((select jsonb_agg(to_jsonb(x)) from (select emp_id, display_name, dept_th, points, rank_no from v_ranking limit 10) x),'[]'::jsonb),
    'recentUsers',coalesce((select jsonb_agg(to_jsonb(x)) from (select emp_id, trim(concat_ws(' ',name_th,surname_th)) as display_name, role, dept_th, status, points, created_at from app_users order by created_at desc nulls last, emp_id asc limit 12) x),'[]'::jsonb),
    'recentLogs',coalesce((select jsonb_agg(to_jsonb(x)) from (select tx_id, emp_id, tx_type, amount, description, source_type, created_at from point_transactions order by created_at desc limit 12) x),'[]'::jsonb)
  );
end $$;

create or replace function public.admin_module_payload(p_token uuid, p_module text, p_search text default '', p_limit int default 100, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q text := lower(coalesce(p_search,''));
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;

  if p_module = 'users' then
    return jsonb_build_object('status','success','columns',jsonb_build_array('emp_id','name','role','dept','position','status','points'),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select emp_id, trim(concat_ws(' ',name_th,surname_th)) as name, role, dept_th as dept, pos_th as position, status, points from app_users where q='' or lower(emp_id||' '||coalesce(name_th,'')||' '||coalesce(surname_th,'')||' '||coalesce(dept_th,'')) like '%'||q||'%' order by emp_id limit p_limit offset p_offset) x),'[]'::jsonb));
  elsif p_module = 'news' then
    return jsonb_build_object('status','success','columns',jsonb_build_array('news_id','topic','points','status','publish_date','pinned'),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select news_id, topic, points, status, publish_date, pinned from news_posts where q='' or lower(news_id||' '||coalesce(topic,'')) like '%'||q||'%' order by created_at desc limit p_limit offset p_offset) x),'[]'::jsonb));
  elsif p_module = 'missions' then
    return jsonb_build_object('status','success','columns',jsonb_build_array('mission_id','title','points','status','created_at'),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select mission_id, title, points, status, created_at from missions where q='' or lower(mission_id||' '||coalesce(title,'')) like '%'||q||'%' order by created_at desc limit p_limit offset p_offset) x),'[]'::jsonb));
  elsif p_module = 'rewards' then
    return jsonb_build_object('status','success','columns',jsonb_build_array('reward_id','name','points_required','stock','status'),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select reward_id, name, points_required, stock, status from rewards where q='' or lower(reward_id||' '||coalesce(name,'')) like '%'||q||'%' order by created_at desc limit p_limit offset p_offset) x),'[]'::jsonb));
  elsif p_module = 'ledger' then
    return jsonb_build_object('status','success','columns',jsonb_build_array('tx_id','emp_id','tx_type','amount','balance_after','source_type','created_at'),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select tx_id, emp_id, tx_type, amount, balance_after, source_type, created_at from point_transactions where q='' or lower(tx_id||' '||emp_id||' '||coalesce(description,'')) like '%'||q||'%' order by created_at desc limit p_limit offset p_offset) x),'[]'::jsonb));
  elsif p_module = 'manager_depts' then
    return jsonb_build_object('status','success','columns',jsonb_build_array('id','manager_emp_id','dept_th','updated_at'),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select id, manager_emp_id, dept_th, updated_at from manager_department_permissions where q='' or lower(manager_emp_id||' '||dept_th) like '%'||q||'%' order by updated_at desc limit p_limit offset p_offset) x),'[]'::jsonb));
  end if;
  return jsonb_build_object('status','error','message','UNKNOWN_MODULE');
end $$;

create or replace function public.admin_save_news(p_token uuid, p_news_id text, p_topic text, p_detail text default null, p_points int default 0, p_image_url text default null, p_status content_status default 'active')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor text; v_id text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  v_id := coalesce(nullif(trim(p_news_id),''),'NEWS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  insert into news_posts(news_id, topic, detail, points, image_url, status, publish_date, created_by_emp_id)
  values(v_id, p_topic, p_detail, greatest(coalesce(p_points,0),0), p_image_url, p_status, current_date, v_actor)
  on conflict(news_id) do update set topic=excluded.topic, detail=excluded.detail, points=excluded.points, image_url=coalesce(excluded.image_url,news_posts.image_url), status=excluded.status, updated_at=now();
  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data) values(v_actor,'SAVE_NEWS','news_posts',v_id,jsonb_build_object('topic',p_topic));
  return jsonb_build_object('status','success','id',v_id);
end $$;

create or replace function public.admin_save_mission(p_token uuid, p_mission_id text, p_title text, p_description text default null, p_points int default 0, p_image_url text default null, p_status content_status default 'active')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor text; v_id text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  v_id := coalesce(nullif(trim(p_mission_id),''),'MIS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  insert into missions(mission_id, title, description, points, image_url, status, created_by_emp_id)
  values(v_id, p_title, p_description, greatest(coalesce(p_points,0),0), p_image_url, p_status, v_actor)
  on conflict(mission_id) do update set title=excluded.title, description=excluded.description, points=excluded.points, image_url=coalesce(excluded.image_url,missions.image_url), status=excluded.status, updated_at=now();
  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data) values(v_actor,'SAVE_MISSION','missions',v_id,jsonb_build_object('title',p_title));
  return jsonb_build_object('status','success','id',v_id);
end $$;

create or replace function public.admin_save_reward(p_token uuid, p_reward_id text, p_name text, p_detail text default null, p_points_required int default 0, p_stock int default 0, p_image_url text default null, p_status content_status default 'active')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor text; v_id text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  v_id := coalesce(nullif(trim(p_reward_id),''),'RWD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  insert into rewards(reward_id, name, detail, points_required, stock, image_url, status, created_by_emp_id)
  values(v_id, p_name, p_detail, greatest(coalesce(p_points_required,0),0), greatest(coalesce(p_stock,0),0), p_image_url, p_status, v_actor)
  on conflict(reward_id) do update set name=excluded.name, detail=excluded.detail, points_required=excluded.points_required, stock=excluded.stock, image_url=coalesce(excluded.image_url,rewards.image_url), status=excluded.status, updated_at=now();
  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data) values(v_actor,'SAVE_REWARD','rewards',v_id,jsonb_build_object('name',p_name));
  return jsonb_build_object('status','success','id',v_id);
end $$;

create or replace function public.admin_save_user_simple(p_token uuid, p_emp_id text, p_name_th text, p_surname_th text default null, p_dept_th text default null, p_pos_th text default null, p_role app_role default 'user', p_status user_status default 'active')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  insert into app_users(emp_id, name_th, surname_th, dept_th, pos_th, role, status, force_password_change, password_policy)
  values(trim(p_emp_id), p_name_th, p_surname_th, p_dept_th, p_pos_th, p_role, p_status, true, '8-char-no-thai')
  on conflict(emp_id) do update set name_th=excluded.name_th, surname_th=excluded.surname_th, dept_th=excluded.dept_th, pos_th=excluded.pos_th, role=excluded.role, status=excluded.status, updated_at=now();
  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data) values(v_actor,'SAVE_USER','app_users',trim(p_emp_id),jsonb_build_object('role',p_role,'status',p_status));
  return jsonb_build_object('status','success','id',trim(p_emp_id));
end $$;

create or replace function public.admin_save_manager_dept(p_token uuid, p_manager_emp_id text, p_dept_th text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor text; v_id bigint;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  insert into manager_department_permissions(manager_emp_id, dept_th, updated_by_emp_id)
  values(trim(p_manager_emp_id), trim(p_dept_th), v_actor)
  on conflict(manager_emp_id, dept_th) do update set updated_by_emp_id=v_actor, updated_at=now()
  returning id into v_id;
  return jsonb_build_object('status','success','id',v_id);
end $$;

create or replace function public.admin_reset_user_password(p_token uuid, p_target_emp_id text, p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_actor text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  if coalesce(p_temp_password,'') <> '1234' and not public.sb_is_valid_password(p_temp_password) then
    return jsonb_build_object('status','error','message','รหัสชั่วคราวต้องเป็น 1234 หรือ A-Z/a-z/0-9 จำนวน 8 ตัว');
  end if;
  if not exists(select 1 from app_users where emp_id = p_target_emp_id) then return jsonb_build_object('status','error','message','ไม่พบรหัสพนักงานเป้าหมาย'); end if;
  insert into user_credentials(emp_id, password_hash, must_change, reset_at, reset_by_emp_id)
  values (p_target_emp_id, public.sb_hash_password(p_temp_password), true, now(), v_actor)
  on conflict (emp_id) do update set password_hash = excluded.password_hash, must_change = true, reset_at = now(), reset_by_emp_id = v_actor;
  update app_users set force_password_change = true, password_reset_at = now(), password_reset_by_emp_id = v_actor, updated_at = now() where emp_id = p_target_emp_id;
  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data) values(v_actor,'RESET_PASSWORD','app_users',p_target_emp_id,jsonb_build_object('must_change',true));
  return jsonb_build_object('status','success','message','Reset password สำเร็จ');
end $$;

create or replace function public.admin_reset_user_password(p_token uuid, p_target_emp_id text, p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_actor text; v_temp_password text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  if not exists(select 1 from app_users where emp_id = p_target_emp_id) then
    return jsonb_build_object('status','error','message','Target employee ID not found');
  end if;
  v_temp_password := coalesce(nullif(trim(p_temp_password), ''), p_target_emp_id);
  insert into user_credentials(emp_id, password_hash, must_change, reset_at, reset_by_emp_id)
  values (p_target_emp_id, public.sb_hash_password(v_temp_password), true, now(), v_actor)
  on conflict (emp_id) do update set password_hash = excluded.password_hash, must_change = true, reset_at = now(), reset_by_emp_id = v_actor;
  update app_users set force_password_change = true, password_reset_at = now(), password_reset_by_emp_id = v_actor, updated_at = now() where emp_id = p_target_emp_id;
  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values(v_actor,'RESET_PASSWORD','app_users',p_target_emp_id,jsonb_build_object('must_change',true,'initial_password','emp_id'));
  return jsonb_build_object('status','success','message','Reset password success: temporary password = employee ID');
end $$;

-- Grants
grant execute on function public.public_session_emp_id(uuid) to anon, authenticated;
grant execute on function public.public_session_role(uuid) to anon, authenticated;
grant execute on function public.public_session_is_admin(uuid) to anon, authenticated;
grant execute on function public.prepare_first_login_credentials(text) to anon, authenticated;
grant execute on function public.login_with_emp_password(text,text,text) to anon, authenticated;
grant execute on function public.change_my_password(uuid,text,text,text) to anon, authenticated;
grant execute on function public.setup_first_password_no_credential(text,text,text) to anon, authenticated;
grant execute on function public.logout_public_session(uuid) to anon, authenticated;
grant execute on function public.public_checkin(uuid) to anon, authenticated;
grant execute on function public.public_redeem_reward(uuid,text) to anon, authenticated;
grant execute on function public.public_read_news(uuid,text) to anon, authenticated;
grant execute on function public.public_complete_mission(uuid,text,text) to anon, authenticated;
grant execute on function public.get_home_payload(uuid) to anon, authenticated;
grant execute on function public.public_page_payload(uuid,text) to anon, authenticated;
grant execute on function public.public_list_notifications(uuid) to anon, authenticated;
grant execute on function public.public_mark_notification_read(uuid,text) to anon, authenticated;
grant execute on function public.admin_dashboard_payload(uuid) to anon, authenticated;
grant execute on function public.admin_module_payload(uuid,text,text,int,int) to anon, authenticated;
grant execute on function public.admin_save_news(uuid,text,text,text,int,text,content_status) to anon, authenticated;
grant execute on function public.admin_save_mission(uuid,text,text,text,int,text,content_status) to anon, authenticated;
grant execute on function public.admin_save_reward(uuid,text,text,text,int,int,text,content_status) to anon, authenticated;
grant execute on function public.admin_save_user_simple(uuid,text,text,text,text,text,app_role,user_status) to anon, authenticated;
grant execute on function public.admin_save_manager_dept(uuid,text,text) to anon, authenticated;
grant execute on function public.admin_reset_user_password(uuid,text,text) to anon, authenticated;


-- =========================================================
-- 90_seed_app_settings.sql
-- =========================================================

-- 90_seed_app_settings.sql
insert into app_settings(key, value, description, is_public) values
('UPLOAD_FOLDER_ID','1rYD6ys45AziVhhjZEczxejzW5i2YOljz','Google Drive folder: general uploads / news / mission / IT attachments', false),
('REWARD_FOLDER_ID','1lPC8VGyf6OQqomQgBRxHPJ8FgtcaVc5b','Google Drive folder: reward images', false),
('GOOGLE_DRIVE_FOLDER_ID','1wOfrms0w-_LRvc0eUbwzGayco3NFakdU','Google Drive folder: main docs/logo/reports', false),
('USER_AVATAR_FOLDER_ID','1rYD6ys45AziVhhjZEczxejzW5i2YOljz','Google Drive folder: user avatars, fallback to UPLOAD_FOLDER_ID', false),
('DEFAULT_AVATAR_URL','https://cdn-icons-png.flaticon.com/512/149/149071.png','Default avatar URL', true)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();


-- =========================================================
-- 91_seed_from_xlsx_FIXED_V3_empid_normalized.sql
-- =========================================================

-- 91_seed_from_xlsx.sql
-- Generated from CompanyApp_SBinterlab(3).xlsx
begin;

-- FIX V3: created_at NULL + password_reset_by_emp_id + normalize emp_id 2/56 ที่ไม่ใช่ emp_id เช่น SELF_FIRST_LOGIN แก้เป็น NULL ก่อน import
alter table app_users alter column created_at drop not null;

insert into departments(dept_th) values
('IT'),
('Logistic'),
('Logistics'),
('Safety'),
('การตลาด ออนไลน์'),
('การตลาดออนไลน์'),
('ขาย'),
('คลังบรรจุภัณฑ์'),
('คลังสินค้าสำเร็จรูป'),
('ควบคุมคุณภาพ'),
('จัดซื้อ'),
('ชั่งสาร/คลังวัตถุดิบ'),
('ซ่อมบำรุงรักษา'),
('บรรจุ-สายพาน'),
('บริหาร'),
('บัญชีการเงิน'),
('บัญชีลูกหนี้'),
('บุคคล'),
('ผสมเคมี'),
('ฝ่ายบุคคล'),
('ฝ่ายวิจัยและพัฒนา'),
('วิจัยและพัฒนา'),
('สำนักงาน'),
('ส่งออก'),
('ส่งเสริมการขาย'),
('เจ้าที่วางแผนผลิต'),
('เจ้าหน้าที่ประสานงาน'),
('เจ้าหน้าที่ประสานงานผลิต'),
('เจ้าหน้าที่วางแผนผลิต'),
('ไอที')
on conflict (dept_th) do nothing;

insert into positions(position_th) values
('QCR'),
('คนสวน'),
('จป.ปฏิบัติการ'),
('จัดส่งฝ่ายผลิต'),
('ช่างซ่อมบำรุง(ช่างกลโรงงาน)'),
('ช่างเทคนิคเครื่องเดินซองสระดำ'),
('ช่างเหล็ก/ช่างเชื่อม/ช่างประปา'),
('ช่างไฟฟ้าและอิเล็คทรอนิคส์'),
('บริหาร'),
('ปั่นใบเดี่ยว'),
('ผู้จัดการ การตลาดออนไลน์'),
('ผู้จัดการฝ่ายขายต่างประเทศ'),
('ผู้จัดการฝ่ายขายและการตลาด'),
('ผู้จัดการฝ่ายควบคุม/ประกันคุณภาพ'),
('ผู้จัดการฝ่ายจัดซื้อ'),
('ผู้จัดการฝ่ายทรัพยากรบุคคล'),
('ผู้จัดการฝ่ายบัญชีการเงิน'),
('ผู้จัดการฝ่ายบัญชีลูกหนี้'),
('ผู้จัดการฝ่ายผลิต'),
('ผู้จัดการแผนกวิศวกรรมและซ่อมบำรุง'),
('ผู้จัดการโรงงาน'),
('ผู้ช่วยตัวแทนฝ่ายบริหาร'),
('ผู้ช่วยผู้จัดการฝ่ายบัญชีลูกหนี้'),
('ผู้ช่วยผู้บริหาร'),
('ผู้ช่วยฝ่ายปฏิบัติการและบุคคล'),
('ผู้ช่วยหัวหน้าคลังวัตถุดิบ'),
('ผู้ช่วยหัวหน้าปั่นใบเดี่ยว'),
('ผู้ช่วยหัวหน้าผสมเคมี'),
('ผู้ช่วยหัวหน้าส่วนงานบริหารคลังสินค้าสำเร็จรูป'),
('ผู้ช่วยเจ้าหน้าที่ประสานงานลูกค้า OEM'),
('ผู้ช่วยเจ้าหน้าที่ฝ่ายวิจัยและพัฒนา'),
('ผู้บริหารหน่วยงานความปลอดภัย'),
('ผู้ปฏิบัติงานประจำระบบบำบัดน้ำเสีย'),
('พนักงาน QA'),
('พนักงาน QC Line'),
('พนักงาน QCB'),
('พนักงาน QCM'),
('พนักงาน QCP'),
('พนักงาน RDP'),
('พนักงานขับรถ'),
('พนักงานขาย'),
('พนักงานครีมย้อม'),
('พนักงานตรวจสอบความคงตัวของผลิตภัณฑ์'),
('พนักงานติดฉลากและบรรจุหีบห่อ 1'),
('พนักงานติดฉลากและบรรจุหีบห่อ 10'),
('พนักงานติดฉลากและบรรจุหีบห่อ 11'),
('พนักงานติดฉลากและบรรจุหีบห่อ 12'),
('พนักงานติดฉลากและบรรจุหีบห่อ 13'),
('พนักงานติดฉลากและบรรจุหีบห่อ 2'),
('พนักงานติดฉลากและบรรจุหีบห่อ 3'),
('พนักงานติดฉลากและบรรจุหีบห่อ 4'),
('พนักงานติดฉลากและบรรจุหีบห่อ 5'),
('พนักงานติดฉลากและบรรจุหีบห่อ 6'),
('พนักงานติดฉลากและบรรจุหีบห่อ 7'),
('พนักงานติดฉลากและบรรจุหีบห่อ 9'),
('พนักงานถอดถุง'),
('พนักงานทำกล่อง'),
('พนักงานบรรจุไฮโดรเจน( ห้อง8 )'),
('พนักงานผลิต สพ.13'),
('พนักงานพิมพ์และจัดเก็บเอกสาร'),
('พนักงานอวุโส QCB(Senior QCB)'),
('พนักงานอวุโส QCP'),
('พนักงานเข็นBULK'),
('พนักงานเข็นงาน'),
('พนักงานเสริฟบรรจุภัณฑ์'),
('ส่วนงานขับรถรับสินค้าเข้าคลังและจัดเก็บ'),
('ส่วนงานรับสินค้าและบริหารพื้นที่คลังสินค้า'),
('ส่วนงานห้องเคลียร์สินค้ารับคืนสินค้า'),
('หน่วยกิจกรรม'),
('หม้อผสมครีมย้อม'),
('หม้อผสมครีมย้อม(สบู่)'),
('หัวหน้าคลังบรรจุภัณฑ์'),
('หัวหน้าชั่งสารและคลังวัตถุดิบ'),
('หัวหน้าฝ่าย Logistic'),
('หัวหน้าฝ่ายคลังสินค้าสำเร็จรูป'),
('หัวหน้าฝ่ายจัดซื้อ'),
('หัวหน้าฝ่ายซ่อมบำรุง'),
('หัวหน้าฝ่ายวิจัยและพัฒนา'),
('หัวหน้าสายพาน'),
('หัวหน้าห้องซอง/สระดำ'),
('หัวหน้าห้องปฏิบัติการ'),
('หัวหน้าเจ้าหน้าที่ทำความสะอาด'),
('หัวหน้าแผนกบรรจุ'),
('หัวหน้าแผนกปั่นใบเดี่ยว'),
('ห้องบรรจุผง'),
('ห้องบรรจุสินค้า 1'),
('ห้องบรรจุสินค้า 10'),
('ห้องบรรจุสินค้า 11'),
('ห้องบรรจุสินค้า 12'),
('ห้องบรรจุสินค้า 2'),
('ห้องบรรจุสินค้า 3'),
('ห้องบรรจุสินค้า 4'),
('ห้องบรรจุสินค้า 5'),
('ห้องบรรจุสินค้า 6'),
('ห้องบรรจุสินค้า 7'),
('ห้องบรรจุสินค้า 9'),
('ห้องเทสเตอร์'),
('เครื่องเดินซองสระดำ'),
('เครื่องแปะสติกเกอร์'),
('เจ้าหน้าที่ Checker สินค้าสำเร็จรูป'),
('เจ้าหน้าที่ Marketplace'),
('เจ้าหน้าที่ Stability'),
('เจ้าหน้าที่การตลาด ออนไลน์'),
('เจ้าหน้าที่การตลาดเทรด(ดูแลกิจกรรม)'),
('เจ้าหน้าที่ควมคุมสิ่งแวดล้อม'),
('เจ้าหน้าที่คีย์ตัดสต็อก'),
('เจ้าหน้าที่จัดส่งสินค้าเขตกรุงเทพ'),
('เจ้าหน้าที่จัดเตรียมวัตถุดิบ'),
('เจ้าหน้าที่ชั่งเคมี'),
('เจ้าหน้าที่ดูแลหม้อผสม'),
('เจ้าหน้าที่ทำความสะอาด'),
('เจ้าหน้าที่บัญชี/การเงิน(เจ้าหนี้การค้า)'),
('เจ้าหน้าที่บัญชี/การเงิน(เจ้าหนี้เงินรางวัล)'),
('เจ้าหน้าที่บัญชีลูกหนี้ 1'),
('เจ้าหน้าที่บัญชีลูกหนี้ 3'),
('เจ้าหน้าที่บัญชีลูกหนี้ 4'),
('เจ้าหน้าที่บัญชีลูกหนี้ 5'),
('เจ้าหน้าที่บัญชีลูกหนี้ 6'),
('เจ้าหน้าที่บัญชีและการเงิน(ภาษี)'),
('เจ้าหน้าที่ประสานงานฝ่ายขายต่างประเทศ'),
('เจ้าหน้าที่ประสานงานลูกค้า (OEM)'),
('เจ้าหน้าที่ฝ่ายควบคุมเอกสาร'),
('เจ้าหน้าที่ฝ่ายจัดซื้อบรรจุภัณฑ์ ( คลัง 1 )'),
('เจ้าหน้าที่ฝ่ายจัดซื้อบรรจุภัณฑ์( คลัง 2 )'),
('เจ้าหน้าที่ฝ่ายจัดซื้อวัถุดิบ ( เคมีภัณฑ์ )'),
('เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล'),
('เจ้าหน้าที่ฝ่ายวิจัยและพัฒนา'),
('เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง'),
('เจ้าหน้าที่รักษาความปลอดภัย'),
('เจ้าหน้าที่รับ-เบิกจ่ายบรรจุภัณฑ์'),
('เจ้าหน้าที่รับบรรจุภัณฑ์'),
('เจ้าหน้าที่รับออร์เดอร์'),
('เจ้าหน้าที่ลูกค้าสัมพันธ์'),
('เจ้าหน้าที่ล้างถังเบาท์'),
('เจ้าหน้าที่วางแผนผลิต'),
('เจ้าหน้าที่สารสนเทศ'),
('เจ้าหน้าที่สารสนเทศและบันทึกข้อมูลหลัก'),
('เจ้าหน้าที่ออกแบบผลิตภัณฑ์'),
('เจ้าหน้าที่อาวุโสแผนกประสานงานลูกค้า OEM'),
('เจ้าหน้าที่เก็บข้อมูลการผลิต'),
('เจ้าหน้าที่เบิกจ่ายบรรจุภัณฑ์'),
('เจ้าหน้าที่เบิกจ่ายวัตถุดิบ'),
('เจ้าหน้าที่แผนกช่างไฟฟ้าและอิเล็คทรอนิคส์'),
('แอดมิน')
on conflict (position_th) do nothing;

insert into app_users(
emp_id, role, email, name_th, surname_th, nickname_th, dept_th, pos_th,
name_en, surname_en, nickname_en, dept_en, pos_en,
name_my, surname_my, nickname_my, dept_my, pos_my,
phone, points, total_earned, avatar_url, last_check_in, check_in_count,
presence, status, start_work_date, created_at, force_password_change,
password_changed_at, password_reset_at, password_reset_by_emp_id, password_policy
) values
('002','user'::app_role,'sinchai@gmail.com','สินชัย','ภู่เพชร','อิฐ','ไอที','บริหาร',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,'2026-05-29'::date,1,'online'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('056','user'::app_role,'dah.saowani@gmail.com','เสาวณีย์','แบรอมาน','นิดะห์','บรรจุ-สายพาน','หัวหน้าสายพาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('75','user'::app_role,'kammanidd@gmail.com','เขมนิจ','ตาปนานนท์','เหมียว','คลังสินค้าสำเร็จรูป','หัวหน้าฝ่ายคลังสินค้าสำเร็จรูป',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,'2026-05-29'::date,1,'online'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('94','user'::app_role,'punneeauemchalad@gmail.com','พรรณี','เอี่ยมฉลาด','บี','คลังสินค้าสำเร็จรูป','ผู้ช่วยหัวหน้าส่วนงานบริหารคลังสินค้าสำเร็จรูป',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1012','user'::app_role,'parichard.lt@gmail.com','ปาริชาติ','รักญาติ','ลิต้า','ควบคุมคุณภาพ','QCR',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,'2026-05-29'::date,1,'online'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1029','user'::app_role,'Fern76t@gmail.com','สายธาร','ดีไทย','นัจวา','คลังบรรจุภัณฑ์','เจ้าหน้าที่เบิกจ่ายบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1046','user'::app_role,'kitsanamatmali65@gmail.com','กฤษณะ','หมาดมาลี','กิ๊ฟลี','คลังสินค้าสำเร็จรูป','ส่วนงานขับรถรับสินค้าเข้าคลังและจัดเก็บ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1066','user'::app_role,'boonk0845587032@gmail.com','บุญเกิด','คำยางจ้อง','หมวย','Logistics','เจ้าหน้าที่รับออร์เดอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1215','user'::app_role,'walaa.sin9ha@gmail.com','กษมา','สิงห์งาม','กัส','บริหาร','ผู้ช่วยผู้บริหาร',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1219','user'::app_role,'malinee@carebeau-enjoy.com','มาลินี','ศุภกิจ','กุ้ง','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1220','user'::app_role,'kitiya.harit253051mam@gmail.com','กิติยา','หมวดหลำ','แหม่ม','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1277','user'::app_role,'boom0923834677@gmail.com','LATSAMY','SOUPHIMPHA','หมี(ลัดสะหมี)','ผสมเคมี','ผู้ช่วยหัวหน้าปั่นใบเดี่ยว',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1283','user'::app_role,'pavarisa.mee@gmail.com','ปวริศา','บุตรมี','แอมมี่','บรรจุ-สายพาน','หัวหน้าแผนกบรรจุ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1337','user'::app_role,'nirat.a1937@gmail.com','นิรัตน์','เอี่ยมวิจารณ์','เอ','เจ้าหน้าที่ประสานงาน','เจ้าหน้าที่อาวุโสแผนกประสานงานลูกค้า OEM',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1351','user'::app_role,'ratreemoontreepakdee@gmail.com','ราตรี','มูลตรีภักดี','แต้','ผสมเคมี','ปั่นใบเดี่ยว',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1368','user'::app_role,'nampchet.nr@gmail.com','น้ำเพชร','รักญาติ','นะห์','IT','เจ้าหน้าที่สารสนเทศและบันทึกข้อมูลหลัก',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1374','user'::app_role,'chulyaporn9@gmail.com','จุฬญาภรณ์','อยู่โคก','หน่อย','บริหาร','ผู้จัดการฝ่ายบัญชีการเงิน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1379','user'::app_role,'jinda9144@gmail.com','รินดา','นุชไสว','เล็ก','คลังบรรจุภัณฑ์','เจ้าหน้าที่รับ-เบิกจ่ายบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1380','user'::app_role,'sutthiporn0520@gmail.com','สุทธิพร','ไชยเดช','ยู','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1401','user'::app_role,'meawmabang@gmail.com','ชลธิชา','มาบัง','เหมียว','ส่งออก','เจ้าหน้าที่ประสานงานลูกค้า (OEM)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1404','user'::app_role,'akkradet334060@gmail.com','อัครเดช','เสนสาร','เอส','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1413','user'::app_role,'wanna81962@gmail.com','วรรณา','กลับสงเคราะห์','วรรณา','บรรจุ-สายพาน','เครื่องเดินซองสระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1421','user'::app_role,'thidarutpanlampong@gmail.com','ธิดารัตน์','ปั้นลำพอง','ปุ้ย','ควบคุมคุณภาพ','พนักงานตรวจสอบความคงตัวของผลิตภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1438','user'::app_role,'ynmesa17@gmail.com','เมทินี','กองเสล็ม','ก๊ะ','บรรจุ-สายพาน','หัวหน้าสายพาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1455','user'::app_role,'juntima290427@gmail.com','จันธิมา','แสงโพธิ์แก้ว','จิ๊บ','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1457','user'::app_role,'sarinjongkonngam@gmail.com','ฉลวย','จงกลงาม','อางค์','บรรจุ-สายพาน','พนักงานผลิต สพ.13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('148','user'::app_role,'jaruneebamrungislam@gmail.com','จารุณี','บำรุงอิสลาม','รุ','บริหาร','ผู้จัดการฝ่ายบัญชีลูกหนี้',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1508','user'::app_role,'amaramagpol@gmail.com','อมรา','มักผล','ฟะห์','บรรจุ-สายพาน','หัวหน้าสายพาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1519','user'::app_role,'vhfxjbvdbyfhgvx@gmail.com','SAW YAN NAUNG',NULL,'อรุณ','บรรจุ-สายพาน','เครื่องเดินซองสระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1522','user'::app_role,'sunthiwas@gmail.com','นันท์นภัส','สันธิวาส','ต่าย','บริหาร','ผู้จัดการฝ่ายควบคุม/ประกันคุณภาพ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1534','user'::app_role,'yuy.supakan@gmail.com','สุภกานต์','พรมชาติ','ยุ้ย','Safety','เจ้าหน้าที่รักษาความปลอดภัย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1556','user'::app_role,'tanakirm356@gmail.com','นพดารา','ซันซี','เด๊ะ','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1562','user'::app_role,'bpuckpoo@gmail.com','บุษกร','พักโพธิ์','หนู','บัญชีการเงิน','เจ้าหน้าที่บัญชี/การเงิน(เจ้าหนี้การค้า)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1567','user'::app_role,'stamp.w1995@gmail.com','พจนีย์','คำแก้ว','ก้อย','บรรจุ-สายพาน','ห้องบรรจุสินค้า 9',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1605','user'::app_role,'mng_pd@carebeau-enjoy.com','วัชรพงษ์','มาลาทิพย์','บอล','บริหาร','ผู้จัดการโรงงาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1658','user'::app_role,'phumaurainaret@gmail.com','นเรศ','พุ่มอุไร','เก่ง','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1669','user'::app_role,'wichian31946@gmail.com','วิเชียร','แสงแก้ว','เชียร','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1689','user'::app_role,'prasertnualchom19@gmail.com','ประเสริฐ','นวลโฉม','อี๊ด','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1740','user'::app_role,'chmphunuchshphl@gmail.com','ชมพูนุช','สหพล','นุช (เปลว)','บัญชีการเงิน','เจ้าหน้าที่บัญชี/การเงิน(เจ้าหนี้เงินรางวัล)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('179','user'::app_role,'daruneewangdee141125@gmail.com','ดารุณี','หวังดี','หนู','บัญชีลูกหนี้','ผู้ช่วยผู้จัดการฝ่ายบัญชีลูกหนี้',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1821','user'::app_role,'thanaphon30112511@gmail.com','ธนาพร','เดือนวรรณา','กานต์','ซ่อมบำรุงรักษา','เจ้าหน้าที่แผนกช่างไฟฟ้าและอิเล็คทรอนิคส์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1822','user'::app_role,'kalratnkardeiyw@gmail.com','มาลี','สกุณาลัย','โนรี','บรรจุ-สายพาน','พนักงานเสริฟบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1826','user'::app_role,NULL,'สายพิณ','เพ็ชร์อินทร์','จอย','บุคคล','เจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1835','user'::app_role,'Kanyanat1027@gmail.com','นิภาพร','ทนันชัย','น้ำ','คลังบรรจุภัณฑ์','เจ้าหน้าที่คีย์ตัดสต็อก',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1849','user'::app_role,'zaw953094@gmail.com','MAUNG THAUNG',NULL,'สอง','บรรจุ-สายพาน','เครื่องเดินซองสระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1853','user'::app_role,'malai1974@gmail.com','มาลัย','อับดุลเลาะ','ตุ๊ก','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1867','user'::app_role,'gambed04@gmail.com','ธเนศพล','นิลยนาค','เน','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1882','user'::app_role,'chaiychat.jam29@gmail.com','ชัยเชษฐ์','จำเรียน','รุ่ง','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1891','user'::app_role,'wanwisahabseaah@gmail.com','วันวิสา','ฮับเซาะห์','เป้','คลังสินค้าสำเร็จรูป','ส่วนงานห้องเคลียร์สินค้ารับคืนสินค้า',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1926','user'::app_role,'pencill304@gmail.com','กาญจนา','ราชภูมิ','นุ้ย','ควบคุมคุณภาพ','พนักงานอวุโส QCP',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1932','user'::app_role,'wannee11406@gmail.com','วรรณี','เปรมประสงค์','นี','บุคคล','หัวหน้าเจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1943','user'::app_role,NULL,'NAN THU ZAR MOE',NULL,'หนิง','บุคคล','เจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1947','user'::app_role,'nanmingalarsansan2@gmail.com','NAN MINGALAR SAN SAN',NULL,'ซอซอ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1985','user'::app_role,'mbay03064@gmail.com','ชุติมา','บุญร่วง','ปู','บรรจุ-สายพาน','หัวหน้าสายพาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1989','user'::app_role,'panupong_30@icloud.com','ภาณุพงศ์','จันทร์งาม','เจเจ','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('1991','user'::app_role,'mom252758@gmail.com','ธวัชชัย','เชิงน้ำ','มอม','ส่งเสริมการขาย','พนักงานขับรถ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2001','user'::app_role,'ellesin3@gmail.com','บังอร','นุ่มนวล','หลิน','วิจัยและพัฒนา','เจ้าหน้าที่ออกแบบผลิตภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2008','user'::app_role,'weaw0909958344@gmail.com','แวว','ชื่นอารมณ์','แวว','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('202','user'::app_role,'rapeepornka975@gmail.com','รพีพร','กาประทุม','นะฮ์','บริหาร','ผู้จัดการฝ่ายทรัพยากรบุคคล',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2048','user'::app_role,'pornpimon06822@gmail.com','พรพิมล','ชมมณฑา','ปุ๋ย','ฝ่ายวิจัยและพัฒนา','พนักงาน RDP',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2051','user'::app_role,'sathit.pengtam@gmail.com','สาธิต','เพ็งธรรม','โบ้','ควบคุมคุณภาพ','หัวหน้าห้องปฏิบัติการ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2081','user'::app_role,'abpreeya@gmail.com','อัจฉรียา','สันเต','เหมียว','ควบคุมคุณภาพ','พนักงาน QA',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2092','user'::app_role,'cuppylovelove@gmail.com','สุรินี','สนธิ','เมย์','ส่งเสริมการขาย','พนักงานขับรถ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2095','user'::app_role,'jang220963@gmail.com','ปรารถนา','โยธานันต์','จุ๊บแจง','ควบคุมคุณภาพ','พนักงานอวุโส QCB(Senior QCB)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2096','user'::app_role,'womaisaroh.k14@gmail.com','วรนุช','หรุ่มวิสัย','นุช','เจ้าหน้าที่ประสานงาน','เจ้าหน้าที่ประสานงานลูกค้า (OEM)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2103','user'::app_role,'saifon20092521@gmail.com','สายฝน','พักโพธิ์','ฝน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('212','user'::app_role,'junsudama@gmail.com','จันทร์สุดา','สิงห์งาม','มา','บรรจุ-สายพาน','จัดส่งฝ่ายผลิต',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2134','user'::app_role,'nalumonfah31@gmail.com','นฤมล','สุรพัฒ','ฟ้า','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2135','user'::app_role,'piyada.nabang@gmail.com','ปิยะดา','ณ บางช้าง','พลอย','Logistics','เจ้าหน้าที่รับออร์เดอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2140','user'::app_role,'beeing_jj@windowslive.com','รุ่งทิวา','ม่วงเปลี่ยน','บี','ควบคุมคุณภาพ','พนักงาน QA',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2229','user'::app_role,'yunge8604@gmail.com','YIN MYINT',NULL,'อิอิมิ๊','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2230','user'::app_role,'yunge8604@gmail.com','YU NGE',NULL,'ยุพ','บรรจุ-สายพาน','พนักงานทำกล่อง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2255','user'::app_role,'yunge8604@gmail.com','THAN WIN',NULL,'เวน -','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2267','user'::app_role,'m64789537@gmail.com','MYO WIN',NULL,'(เจ๊)มิววิน','บรรจุ-สายพาน','ห้องบรรจุสินค้า 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2272','user'::app_role,'chindar1977@gmail.com','จินดา','ชาวงษ์','ดา','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2275','user'::app_role,'ipvsry@gmail.com','สรญา','เลาะภูมี','ดา','ฝ่ายวิจัยและพัฒนา','เจ้าหน้าที่ฝ่ายวิจัยและพัฒนา',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2300','user'::app_role,'mychatza@gmail.com','พรรณทิภา','หุ่นสุวรรณ','ฉัตร','Logistics','เจ้าหน้าที่รับออร์เดอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2339','user'::app_role,'boy11boonsong@gmail.com','บุญส่ง','เอี่ยมสอ้าง','หนุ่ม','บรรจุ-สายพาน','ห้องบรรจุผง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2350','user'::app_role,'mom2518za@gmail.com','อำไพ','จุลเพชร','อึ่ง','บุคคล','เจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2374','user'::app_role,'sasiwimonyuy2731558@gmail.com','ศศิวิมล','สุยะนาง','ยุ้ย','Logistic','เจ้าหน้าที่ Checker สินค้าสำเร็จรูป',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2382','user'::app_role,'0861878644p@gmail.com','ไพวรรณ','ยอดจารย์','ไพ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2397','user'::app_role,'nah.wanwang@gmail.com','สุภาพร','วันหวัง','นะห์','จัดซื้อ','หัวหน้าฝ่ายจัดซื้อ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2410','user'::app_role,'poosanisa6942@gmail.com','ภูษนิศา','ภานุทัตต์ชนา','มะห์','ฝ่ายบุคคล','เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2428','user'::app_role,'kk2841285@gmail.com','ZAW WIN HTWE',NULL,'ซอ วิน ทุย -','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2445','user'::app_role,'hlasein4647@gmail.com','HLA SEIN',NULL,'หนึ่ง','บุคคล','คนสวน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2468','user'::app_role,'uszinzinzin@gmail.com','THAZIN HTWE',NULL,'ซิน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2472','user'::app_role,'daruneepunyashep126@gmail.com','ดรุณี','ปัญญาชีพ','ตี','บรรจุ-สายพาน','เครื่องเดินซองสระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2474','user'::app_role,'nongfia90@gmail.com','อาทิตยา','มานมาลิ','โซเฟีย','การตลาด ออนไลน์','เจ้าหน้าที่การตลาดเทรด(ดูแลกิจกรรม)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2487','user'::app_role,'nampumobile.gjre@gmail.com','AYE AYE MON',NULL,'มน','ผสมเคมี','เจ้าหน้าที่ล้างถังเบาท์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2519','user'::app_role,'piyanutt734@gmail.com','ปิยะนุช','ทัพชัย','ติ๊ก','สำนักงาน','เจ้าหน้าที่ฝ่ายควบคุมเอกสาร',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2566','user'::app_role,'0925627539nm@gmail.com','รังสิมา','แสนจำหน่าย','แอม','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('259','user'::app_role,'venuswangman@gmail.com','วีนัส','หวังมาน','นัท','จัดซื้อ','เจ้าหน้าที่ฝ่ายจัดซื้อบรรจุภัณฑ์ ( คลัง 1 )',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2590','user'::app_role,'chailtawongsa25@gmail.com','ชลิตา','วงศ์ษา','ฮอล์ล','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2591','user'::app_role,'piyadakhumail632@gmail.com','พิยดา','คุ้มฤทธิ์','พลอย','สำนักงาน','พนักงานพิมพ์และจัดเก็บเอกสาร',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2595','user'::app_role,'iphone56402@gmail.com','เอกมงคงชัย','เริ่มรู้','เอก','การตลาด ออนไลน์','เจ้าหน้าที่การตลาด ออนไลน์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2597','user'::app_role,'nusbaphaeceriy@gmail.com','นุสบา','แพรเจริญ','อัสมา','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2607','user'::app_role,'tt.tecno2021@gmail.com','คนึงนุช','คำสุข','นุช','ผสมเคมี','หม้อผสมครีมย้อม(สบู่)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2626','user'::app_role,'bassboza14@gmail.com','ชลนที','บัวลา','โบ','ซ่อมบำรุงรักษา','ช่างซ่อมบำรุง(ช่างกลโรงงาน)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2642','user'::app_role,'suparin.moma@gmail.com','ศุภารินทร์','โมมา','เฟิร์น','ควบคุมคุณภาพ','พนักงาน QCM',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2663','user'::app_role,'panpailin1999@gmail.com','ปานไพลิน','โซ๊ะมะ','เด๊าะ','บรรจุ-สายพาน','หัวหน้าห้องซอง/สระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2664','user'::app_role,NULL,'THEIN ZAW',NULL,'ซอ','Logistic','เจ้าหน้าที่จัดส่งสินค้าเขตกรุงเทพ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2665','user'::app_role,'heinmina870@gmail.com','HEIN MIN AUNG',NULL,'เอา','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2669','user'::app_role,'wngkhthiydirek@gmail.com','ดิเรก','วงค์ไทย','วิน','ซ่อมบำรุงรักษา','ผู้ปฏิบัติงานประจำระบบบำบัดน้ำเสีย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2706','user'::app_role,'ogogg536@gmail.com','THAN THAN OO',NULL,'ตัน ตัน อู','บรรจุ-สายพาน','ห้องบรรจุสินค้า 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2709','user'::app_role,'kt8601840@gmail.com','TUN TUN',NULL,'ทุน ทุน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2712','user'::app_role,'zin765329@gmail.com','THAN THAN WAI',NULL,'ตัน ตัน ไว','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2713','user'::app_role,'htayhtayhlaing854@gmail.com','HTAY HTAY HLAING',NULL,'เท เท หล่าย','บรรจุ-สายพาน','ห้องบรรจุสินค้า 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2715','user'::app_role,'khingthinnwe6@gmail.com','AUNG HTET WIN',NULL,'อ่อง เท็ค วิน','บรรจุ-สายพาน','พนักงานถอดถุง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2717','user'::app_role,'zmyo9260@gmail.com','MYO ZAW',NULL,'โม โซ','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2723','user'::app_role,'z78125476@gmail.com','ZAW KO OO',NULL,'ซอ โก อู','บรรจุ-สายพาน','เครื่องเดินซองสระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2726','user'::app_role,'htaya9930@gmail.com','HTAY AUNG',NULL,'เท อ่อง','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2730','user'::app_role,'winlatt1558@gmail.com','WIN LATT',NULL,'วิน เลท','บรรจุ-สายพาน','พนักงานเข็นBULK',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2731','user'::app_role,'kshwewar4@gmail.com','KHAING SHWE WAR',NULL,'ข่าย ซ่วย วา','บรรจุ-สายพาน','ห้องบรรจุสินค้า 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2736','user'::app_role,'khingthinnwe6@gmail.com','KHING THIN NWE',NULL,'ข่าย ทิน ซวย','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2738','user'::app_role,'zmyo9260@gmail.com','TINT TINT TUN',NULL,'ทิด ทิด ทุน (ใหญ่)','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่จัดเตรียมวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2739','user'::app_role,'oohh94106@gmail.com','TINT TINT TUN',NULL,'ทิด ทิด ทุน(เล็ก)','บรรจุ-สายพาน','ห้องบรรจุสินค้า 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2740','user'::app_role,'moesisi62@gmail.com','SI SI MOE',NULL,'ซิ ซิ โม','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2744','user'::app_role,'wwintatt@gmail.com','KHAING KHIN OO',NULL,'ข่าย คิน อู','บรรจุ-สายพาน','ห้องบรรจุสินค้า 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2749','user'::app_role,'wtoe3009@gmail.com','TOE WAI TUN',NULL,'โต ไว ทุน','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2753','user'::app_role,'dppuniwes@gmail.com','บุณฑริกา','อินทร์พาเพียร','ใบบัว','ฝ่ายวิจัยและพัฒนา','เจ้าหน้าที่ฝ่ายวิจัยและพัฒนา',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2769','user'::app_role,'samai.joijampa2524@gmail.com','สมัย','จ้อยจำปา','ตุ๊ก','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2824','user'::app_role,'cmee788@gmail.com','CHIT MEE',NULL,'ชิ มิ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2828','user'::app_role,'s39591996@gmail.com','สุวรรณา','ปานนัตถา','แก้ม','บรรจุ-สายพาน','ห้องบรรจุสินค้า 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2837','user'::app_role,'markjung1059@gmail.com','สุวิมล','กลิ่นคุ้ม','แตง','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่ชั่งเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2874','user'::app_role,'kweawnoiarisa@gmail.com','อริสา','เขียวน้อย','แนท','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2876','user'::app_role,'jasminyawangwanden@gmail.com','จิรัติกานต์','ย่าวังวันเด่น','จัสมิน','จัดซื้อ','เจ้าหน้าที่ฝ่ายจัดซื้อบรรจุภัณฑ์( คลัง 2 )',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2897','user'::app_role,'manop.040397@gmail.com','มานพ','สอนพลงาม','ลิฟ','ชั่งสาร/คลังวัตถุดิบ','หัวหน้าชั่งสารและคลังวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2917','user'::app_role,'supsttra38@gmail.com','สุพัตรา','ทองเขียว','เบียร์','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2936','user'::app_role,'jakkaphan.jindarug@gmail.com','จักรพันธ์','จินดารักษ์','บอย','ส่งออก','ผู้จัดการฝ่ายขายต่างประเทศ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2942','user'::app_role,'pisit.chi@northbkk.ac.th','พิสิทธิ์','เจียมสง่า','มอส','ซ่อมบำรุงรักษา','ช่างไฟฟ้าและอิเล็คทรอนิคส์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2961','user'::app_role,'beb203731@gmail.com','HNIN HNIN HLAING',NULL,'นิน นิน ลาย','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2969','user'::app_role,'aung.tuya089@gmail.com','AUNG THU YA',NULL,'อ่อง ตู ยา','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2970','user'::app_role,'ksoe22776@gmail.com','KYAW SOE WIN',NULL,'วิน','ผสมเคมี','เจ้าหน้าที่ล้างถังเบาท์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2975','user'::app_role,'saraneve.2605@gmail.com','สรัลพร','ประยูร','อีฟ','เจ้าหน้าที่ประสานงานผลิต','ผู้ช่วยเจ้าหน้าที่ประสานงานลูกค้า OEM',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2979','user'::app_role,'popza5555519@gmail.com','วันชนะ','ปิ่นมุข','ป๊อป','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2986','user'::app_role,'moet19026@gmail.com','MOE THU',NULL,'โม ตุ','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2991','user'::app_role,'songphon.bra@gmail.com','ทรงพล','จุลรัตน์','พล','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('2999','user'::app_role,'chaichanamongkhon@hotmail.com','ชัยชนะมงคล','วิเศษ','โจ้','ส่งเสริมการขาย','พนักงานขับรถ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3003','user'::app_role,'nittayamuna7284@gmail.com','นิตยา','บุญมาเลิศ','นา','Logistics','เจ้าหน้าที่รับออร์เดอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3018','user'::app_role,'tongza7823@gmail.com','บุณณดา','จำคำสอน','ดาว','Safety','เจ้าหน้าที่รักษาความปลอดภัย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3021','user'::app_role,'mindalicha2110@gmail.com','อลิชา','ศรีจันทร์','มาย','Logistics','เจ้าหน้าที่รับออร์เดอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3039','user'::app_role,'poowadon230563@gmail.com','ภูวดล','อิ่มเจริญ','เฮด','คลังสินค้าสำเร็จรูป','ส่วนงานขับรถรับสินค้าเข้าคลังและจัดเก็บ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3041','user'::app_role,'jitimon.g@gmail.com','จิติมนต์','กลับพงศ์','มน','บริหาร','ผู้ช่วยตัวแทนฝ่ายบริหาร',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3043','user'::app_role,'ttarn0000@gmail.com','ตรีภัทร','คำแก้ว','ลูกตาล','บรรจุ-สายพาน','ห้องเทสเตอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3044','user'::app_role,'kitinantohso@gmail.com','กิตินันท์','ลิเซ็น','เล็ม','บัญชีลูกหนี้','เจ้าหน้าที่บัญชีลูกหนี้ 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3067','user'::app_role,'wwsskr061257@gmail.com','วันวิสาข์','เอี่ยมอนงค์','ขวัญ','บัญชีลูกหนี้','เจ้าหน้าที่บัญชีลูกหนี้ 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3102','user'::app_role,'samakaeo2525@gmail.com','ขวัญชัย','สะมาแก้ว','กบ','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3111','user'::app_role,'tongchoo4964@gmail.com','ปรีชานนล์','ทองชู','เจ','บริหาร','ผู้บริหารหน่วยงานความปลอดภัย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3112','user'::app_role,'ratti1234567890@gmail.com','รัตติกาล','วงษ์ทองศรี','หญิง','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3113','user'::app_role,'bxylmtoa@gmail.com','ปัญญา','กลิ่นทอง','บอย','ส่งเสริมการขาย','พนักงานขับรถ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3114','user'::app_role,'bbum9936@gmail.com','ปิยะนุช','ชำนาญการ','บุ๋ม','บัญชีลูกหนี้','เจ้าหน้าที่บัญชีลูกหนี้ 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3119','user'::app_role,'bowwie2903@gmail.com','ณัฐธิดา','แจ้งแสงทอง','โบว์','Safety','จป.ปฏิบัติการ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3149','user'::app_role,'somlucksakunalai@gmail.com','สมลักษณ์','สกุณาลัย',NULL,'บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3179','user'::app_role,'nungningnubtang@gmail.com','พัชรีรัตน์','กันญณัฏฐ์','หนิง','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3181','user'::app_role,'puwadon8103@gmail.com','ภูวดล','เก่งเขตรวิทย์','ดล','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3191','user'::app_role,'wilaywrrnsayphothi5@gmail.com','วิลัยวรรณ์','สายโพธิ์','หนึ่ง','บุคคล','เจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3239','user'::app_role,'wanwisa.p1998@gmail.com','วรรวิษา','โสวะภาสน์','ฝ้าย','เจ้าหน้าที่ประสานงานผลิต','ผู้ช่วยเจ้าหน้าที่ประสานงานลูกค้า OEM',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3247','user'::app_role,'ipaster783@gmail.com','วาสนา','อินทวงศ์','เปิ้ล','บรรจุ-สายพาน','พนักงานครีมย้อม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3263','user'::app_role,'bangrom0550@gmail.com','จีรศักดิ์','ใต้หล้า','อักรอม','ซ่อมบำรุงรักษา','ช่างไฟฟ้าและอิเล็คทรอนิคส์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3265','user'::app_role,'dewfon6475@gmail.com','วนิดา','ออมสิน','แมว','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3302','user'::app_role,'praphas.976@gmail.com','ประภาส','อรหันต์','ต้น','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3309','user'::app_role,'suphanni16p@gmail.com','สุพรรณี','เพียศักดิ์','หนิง','ผสมเคมี','หม้อผสมครีมย้อม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3311','user'::app_role,'pyhop78@gmail.com','ประภาพร','สิงหราช','ปลา','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 9',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3324','user'::app_role,'c.chanika2546@gmail.com','ชนิกาณ์','ประดับญาติ','ยะห์','บรรจุ-สายพาน','ห้องบรรจุสินค้า 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3326','user'::app_role,'channarongkaewli@gmail.com','ชาญณรงค์','แก้วลาย','มี่','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3332','user'::app_role,'dfxc0549@gmail.com','สุณี','รอมาลี','ปุ๊','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3354','user'::app_role,'nawmipyu@gmail.com','NAW THAN THAN AYE',NULL,'นาว ตัน ตัน เอ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3367','user'::app_role,'pattamanonsee@gmail.com','ปัตธมา','นนทรี','ปัท','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3380','user'::app_role,'sreekoom1983@gmail.com','ประกอบ','สีกุม','กอบ','ซ่อมบำรุงรักษา','หัวหน้าฝ่ายซ่อมบำรุง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('339','user'::app_role,'aonphisoot@gmail.com','พิสุทธิ์','แสงหิรัญ','อ้น','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3403','user'::app_role,'patchareelisen@gmail.com','พัชรี','ลิเซ็น','วอ','บริหาร','ผู้จัดการฝ่ายจัดซื้อ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3405','user'::app_role,'mnothai.panlopong@gmail.com','มโนทัย','ปั้นลำพอง','บอย','ซ่อมบำรุงรักษา','ช่างเหล็ก/ช่างเชื่อม/ช่างประปา',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('342','user'::app_role,'phoeyinhtwe1978@gmail.com','PHOE YIN HTWE',NULL,'ดอน','ผสมเคมี','หม้อผสมครีมย้อม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3423','user'::app_role,'thanyaratka01@gmail.com','ธัญญารัตน์','หาญประเสริฐ','กา','ควบคุมคุณภาพ','พนักงาน QA',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3424','user'::app_role,'chonthicha25461124@gmail.com','ชลธิชา','มะหะหมัดยูซบ','โซเฟีย','ควบคุมคุณภาพ','พนักงาน QA',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3425','user'::app_role,'fareedafareeda2904@gmail.com','ภัชรี','มะหะหมัดยูซบ','ฟารีดา','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3427','user'::app_role,'sirisopaposiri328@gmail.com','ศิริโสภา','ปอศิริ','เปรี้ยว','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่จัดเตรียมวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3430','user'::app_role,'arm2527tawee@gmail.com','ทวี','ไชยมี','อาร์ม','ผสมเคมี','ผู้ช่วยหัวหน้าผสมเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3434','user'::app_role,'prajak.jankon@gmail.com','ประจักษ์','จันทร์ก้อน','จักร (ภาคเหนือ)','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3449','user'::app_role,'thorlortor.sbinterlab@gmail.com','ภาณุพงศ์','กุญชร','เต๋า','วิจัยและพัฒนา','เจ้าหน้าที่ Stability',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3452','user'::app_role,'bitun13@icloud.com','ปพิชญา','ปิกรอด','ตั๋น','บรรจุ-สายพาน','ห้องบรรจุสินค้า 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3465','user'::app_role,'boonsom2523ss@gmail.com','บุญสม','เจริญพร','สม','บริหาร','ผู้จัดการฝ่ายผลิต',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3477','user'::app_role,'phanumart.pr@gmail.com','ภาณุมาศ','พฤทธิพงศ์สิทธิ์','ยุ้ย','ส่งออก','เจ้าหน้าที่ประสานงานฝ่ายขายต่างประเทศ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3485','user'::app_role,'pimseevanglad@gmail.com','ธันยาภรณ์','สีวังลาศ','พิม','เจ้าหน้าที่วางแผนผลิต','เจ้าหน้าที่วางแผนผลิต',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3488','user'::app_role,'narumoltohpayang@gmail.com','นฤมล','โต๊ะปายัง','เรียม','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3490','user'::app_role,'phrphnasmcitt@gmail.com','พรพณา','สมจิตต์','ปุ้ย','บุคคล','เจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3494','user'::app_role,'tanaratninnuch@gmail.com','ธนรัตน์','นิลนุช','อ๊าท','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่เบิกจ่ายวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3524','user'::app_role,'chayakanun019@gmail.com','ชยาภรณ์','นนทะชาติ','ขนุน','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3531','user'::app_role,'ttin76650@gmail.com','TIN TUN',NULL,'ทิน ทุด','บรรจุ-สายพาน','ห้องบรรจุสินค้า 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3533','user'::app_role,'opposanok@gmail.com','THI DAR WIN',NULL,'ดา วิน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3534','user'::app_role,'kamyut302028@gmail.com','พรชนก','สุขรัตน์','แก้ม','เจ้าที่วางแผนผลิต','เจ้าหน้าที่เก็บข้อมูลการผลิต',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3540','user'::app_role,'wengtongudomrak11@gmail.com','เวียงทอง','อุดมรักษ์','เวียง','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3541','user'::app_role,'skulpatee@gmail.com','สราวุฒิ','กุลพาที','เอ','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3554','user'::app_role,'aummie56@gmail.com','อัมพร','ริดสันเทียะ','อุ๋ม','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3556','user'::app_role,'amphonnipa30012545@gmail.com','พรณิภา','แข็งแรง','แอ๋ม','คลังบรรจุภัณฑ์','เจ้าหน้าที่รับบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3565','user'::app_role,'tasanee251525@gmail.com','ทัศนีย์','วงศ์พุฒ','เขียว','บรรจุ-สายพาน','ห้องเทสเตอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3599','user'::app_role,'ar0925869601@gmail.com','ฐานทัพ','เจจือ','อาม้าน','บรรจุ-สายพาน','พนักงานเข็นงาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3604','user'::app_role,'pnitachlceriy@gmail.com','ปณิต้า','ชลเจริญ','บัสม่า','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3608','user'::app_role,'mattainlove@gmail.com','เมตตา','ศิริทอง','เมฆ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3617','user'::app_role,'laekhanawethailand43@gmail.com','วิภาวี','และคนาเว','ติ้ล','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3619','user'::app_role,'wanisaimjaroen@gmail.com','วนิษา','อิ่มเจริญ','ฟารีดา','บัญชีการเงิน','เจ้าหน้าที่บัญชีและการเงิน(ภาษี)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3620','user'::app_role,'sone43383@gmail.com','AW KI SONG',NULL,'อา กิ ซอง','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3621','user'::app_role,'pupuway32@gmail.com','PU PU WAY',NULL,'พุ พุ เว','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3622','user'::app_role,'ploy310000@gmail.com','สุณิษา','คงแตง','พลอย','ควบคุมคุณภาพ','พนักงาน QCB',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3624','user'::app_role,'zawoo4001@gmail.com','AUNG ZAW OO',NULL,'อ่อง ซอ โก','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3627','user'::app_role,'phetcharat.sir@gmail.com','เพชรรัตน์','ศิริโภชน์','จ๋า','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3630','user'::app_role,'chmsxingnrinthr@gmail.com','ชลดา','ฟันเดะ','นะห์','บรรจุ-สายพาน','ห้องบรรจุสินค้า 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3631','user'::app_role,'letzaw7584@gmail.com','NYEIN LET LET ZAW',NULL,'แง เละ เละ ซอ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3632','user'::app_role,'letzaw7584@gmail.com','PHYU PHYU WIN',NULL,'พิว พิว วิน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3633','user'::app_role,'ff1234ff567ff@gmail.com','EI EI MON',NULL,'อิ อิ มน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3634','user'::app_role,'waranya.tongsalee@gmail.com','วรัญญา','ตงสาลี','มารียา','บรรจุ-สายพาน','ห้องบรรจุสินค้า 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3636','user'::app_role,'arumata191@gmail.com','NAY THU YA OO',NULL,'เน ตุ ยา อู','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3641','user'::app_role,'winhtuy4@gmail.com','WIN HTUY AUNG',NULL,'วิน ทู อ่อง','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3642','user'::app_role,'sawthaw699@gmail.com','SAW THAW THAW PHOE',NULL,'ซอ ตอ ตอ โพ','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3643','user'::app_role,'a33872947@gmail.com','SAW EH PLAR SHEE',NULL,'ซอ เอ ปา ชี','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3645','user'::app_role,'shwey6491@gmail.com','YEE SHWE',NULL,'ยี ซวย','บรรจุ-สายพาน','ห้องบรรจุสินค้า 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3647','user'::app_role,'hlahlat96@gmail.com','PHA NYAR PHAW HE',NULL,'ฟา นี พิว ฮี','บรรจุ-สายพาน','เครื่องแปะสติกเกอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3648','user'::app_role,'alisasrichan060747@gmail.com','อลิสา','ศรีจันทร์','มิว','Logistic','เจ้าหน้าที่ลูกค้าสัมพันธ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3652','user'::app_role,'anatmina22@gmail.com','อาณัติ','มินา','อุสตาส','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3656','user'::app_role,'nareerat210943@gmail.com','นารีรัตน์','นาคบัว','บีม','จัดซื้อ','เจ้าหน้าที่ฝ่ายจัดซื้อวัถุดิบ ( เคมีภัณฑ์ )',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3658','user'::app_role,'aphinayaonngoen@gmail.com','อภิญญา','อ้นเงิน','เหน่ง','ผสมเคมี','ปั่นใบเดี่ยว',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3669','user'::app_role,'tayx.mystery@gmail.com','กฤตภาส','คล้ายคลึง','ทาย','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3672','user'::app_role,'obiwankennobi37@outlook.com','จิรวัฒน์','สมเด็จ','แบงค์','IT','เจ้าหน้าที่สารสนเทศ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,7,1,NULL,'2026-07-09'::date,7,'online'::presence_status,'active'::user_status,NULL,NULL,false,'2026-07-08 10:49:30'::timestamptz,NULL,NULL,'ALNUM_4_8_V1'),
('3685','user'::app_role,'aehpa4242@gmail.com','ภาวิณี','อินทร์ยงค์','เอ๋','ฝ่ายวิจัยและพัฒนา','หัวหน้าฝ่ายวิจัยและพัฒนา',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3696','user'::app_role,'maythumyint.pmn@gmail.com','MAY THU MYINT',NULL,'เม ทู เมี๊ยะ','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3697','user'::app_role,'thazinmoe1914@gmail.com','MAY THAZIN MOE',NULL,'เม ทาซิน โม','บรรจุ-สายพาน','ห้องบรรจุผง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3698','user'::app_role,'kyukyuw49@gmail.com','KYU KYU WIN',NULL,'คู คู วิน','บรรจุ-สายพาน','ห้องบรรจุสินค้า 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3700','user'::app_role,'mgmanaw123@gmail.com','NWAY MA',NULL,'นวย มา','บรรจุ-สายพาน','ห้องบรรจุสินค้า 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3701','user'::app_role,'khinlayseintal796@gmail.com','MI HTAY HTAY',NULL,'มิ เท เท','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3702','user'::app_role,'r55178195@gmail.com','AYE AYE MAW',NULL,'เอ เอ มิว','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3703','user'::app_role,'mok79168@gmail.com','YI YI AUNG',NULL,'ยิ ยิ อ่อง','บรรจุ-สายพาน','ห้องบรรจุสินค้า 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3704','user'::app_role,'mwinwin882@gmail.com','WIN WIN NYEIN',NULL,'วิน วิน เนี๊ยะ','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3705','user'::app_role,'hlamyatthu220889@gmail.com','HLA MYAT THU',NULL,'ลา เมี๊ยะ ทู','บรรจุ-สายพาน','เครื่องแปะสติกเกอร์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3706','user'::app_role,'pyae66568@gmail.com','PYAY PYAY AYE',NULL,'เพ เพ เอ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3707','user'::app_role,'kyaw688346@gmail.com','KYAW THI HA',NULL,'จอ ไท ฮา','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3709','user'::app_role,'myaw35622@gmail.com','AUNG THU TUN',NULL,'อ่อง ทู ทุน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3711','user'::app_role,'aungpaingkhant14@gmail.com','AUNG PYAE SONE',NULL,'อ่อง เพ โช','บรรจุ-สายพาน','พนักงานถอดถุง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3715','user'::app_role,'jantima.21012547@gmail.com','จันทิมา','น้อยสคราญ','อั้ม','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3718','user'::app_role,'gyik47874@gmail.com','EI EI HTWE',NULL,'อิ อิ ทุน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3719','user'::app_role,'gyik47874@gmail.com','KYAW WIN KLAING',NULL,'จอ วิน หลาย','บรรจุ-สายพาน','ห้องบรรจุสินค้า 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3720','user'::app_role,'htayhtayaung458@gmail.com','HTAY HTAY AUNG',NULL,'เท เท อ่อง','บรรจุ-สายพาน','ห้องบรรจุสินค้า 9',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3721','user'::app_role,'ayewaddy46892@gmail.com','MAR MAR YI',NULL,'มา มา ยิ','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 9',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3722','user'::app_role,'ayethandarsoe1210@gmail.com','AYE THANDAR SOE',NULL,'เอ ทาดา โช','บรรจุ-สายพาน','พนักงานทำกล่อง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3723','user'::app_role,'paingthuhtet.fb118@gmail.com','PAING THU HTET',NULL,'ไป ทุ เท็ด','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3725','user'::app_role,'phyuphyuhmwe0@gmail.com','PHYU PHYU HMWE',NULL,'พิว พิว มวย','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3726','user'::app_role,'aungkyawthu1466@gmail.com','AUNG KYAW THU',NULL,'อ่อง จอ ตู','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3727','user'::app_role,'pyark321@gmail.com','KYI PYAR',NULL,'กิ เพ','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3728','user'::app_role,'babylay88885@gmail.com','SOE MIN NAING',NULL,'โช วิน นาย','บรรจุ-สายพาน','ห้องบรรจุสินค้า 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3729','user'::app_role,'noppavan37@gmail.com','นพวรรณ','สอนสาย','ซี','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่ชั่งเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3732','user'::app_role,'julymoe07780778@gmail.com','SOE MIN AUNG',NULL,'ซอ มิน อ่อง','บรรจุ-สายพาน','ห้องบรรจุสินค้า 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3733','user'::app_role,'julymoe07780778@gmail.com','NANT SAN HTWE',NULL,'นัน ซัน ทุย','บรรจุ-สายพาน','ห้องบรรจุสินค้า 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3736','user'::app_role,'popoosang13092537@gmail.com','แสงจันทร์','สุภะดี','ปู','บรรจุ-สายพาน','ห้องบรรจุสินค้า 9',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3739','user'::app_role,'riw27082558@gmail.com','ขวัญฤทัย','อิ่มสำราญ','ขวัญ','ชั่งสาร/คลังวัตถุดิบ','ผู้ช่วยหัวหน้าคลังวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3741','user'::app_role,'tasteerawut211@gmail.com','ธีรวุฒิ','มานมาน','ต๊าส','บรรจุ-สายพาน','ช่างเทคนิคเครื่องเดินซองสระดำ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3743','user'::app_role,'siwanikhngthaen2@gmail.com','ศิวาณี','คงแท่น','บิ๋ม','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3746','user'::app_role,'j.pipithong@gmail.com','จือฮาน','พิพิตทอง','วีฮาน','ควบคุมคุณภาพ','พนักงาน QCP',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3751','user'::app_role,'wimonnatthutakit@gmail.com','วิมลนัด','ทุตะกิจ','แนน','บรรจุ-สายพาน','ห้องบรรจุสินค้า 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3753','user'::app_role,'pwinarisman@gmail.com','ปวีณา','ริสมัน','หมวย','คลังบรรจุภัณฑ์','เจ้าหน้าที่เบิกจ่ายบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3754','user'::app_role,'sirirta0808@gmail.com','สิรินทรา','ประดับบุตร','พลอย','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3755','user'::app_role,'vthai6082@gmail.com','SAW KA TO',NULL,'ซอ กะ โท','บรรจุ-สายพาน','ห้องบรรจุสินค้า 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3756','user'::app_role,'tisharadd@gmail.com','ธนกร','จงปิ่นรัตน์','บอม','คลังบรรจุภัณฑ์','หัวหน้าคลังบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3758','user'::app_role,'sawanya.choeikhan22@gmail.com','สวรรยา','เชยคาน','น้ำตาล','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3766','user'::app_role,'thu30914646@gmail.com','PYAE PHYO PAING',NULL,'เพ พิว พาย','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่ชั่งเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3768','user'::app_role,'thu30914646@gmail.com','THU ZAR',NULL,'ตู ซา','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่ชั่งเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3769','user'::app_role,'suthwe49@gmail.com','SU HLAING HNIN',NULL,'สุ หลาย นิน','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3772','user'::app_role,'titisorn231142@gmail.com','ธิติสรณ์','พูลสวัสดิ์','แสตมป์','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3775','user'::app_role,'rattikalpaipaen@gmail.com','รัติกาล','ไผ่แผน',NULL,'Logistic','เจ้าหน้าที่ Checker สินค้าสำเร็จรูป',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3776','user'::app_role,'pattarawadeesongdet@gmail.com','ภัทรวดี','ทรงเดช','พัช','Logistic','เจ้าหน้าที่ Checker สินค้าสำเร็จรูป',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3777','user'::app_role,'minttyza302@gmail.com','อมรรัตน์','เอี่ยมสำอางค์','มิ้นท์','ฝ่ายบุคคล','เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3783','user'::app_role,'natnajawa030166@gmail.com','วาริษา','ซากุล','นัจวา','เจ้าหน้าที่ประสานงานผลิต','ผู้ช่วยเจ้าหน้าที่ประสานงานลูกค้า OEM',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3784','user'::app_role,'wanwateemadrang@gmail.com','วรรณวธีร์','หมัดรัง','ฮุสนา','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3786','user'::app_role,'exgaywah.mm1998@gmail.com','SAW FXGAYWAH',NULL,'ซอ เอกาวา','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3788','user'::app_role,'saw031191@gmail.com','SAW FXGAYSOE',NULL,'ซอ เอกาโซ','ผสมเคมี','เจ้าหน้าที่ล้างถังเบาท์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3792','user'::app_role,'sarasineewaha@gmail.com','สราศิณี','วาฮา','ตัสนีม','ควบคุมคุณภาพ','พนักงาน QC Line',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3794','user'::app_role,'aungthanoo756@gmail.com','AUNG THAN OO',NULL,'อ่อง ตัน อู','ผสมเคมี','เจ้าหน้าที่ล้างถังเบาท์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3795','user'::app_role,'phoeyinhtwe1978@gmail.com','KHIN MYINT KYI',NULL,'คิน เมียะ จี','ผสมเคมี','เจ้าหน้าที่ล้างถังเบาท์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3796','user'::app_role,'hlahlat96@gmail.com','HLA HLA TIN',NULL,'ลา ลา ทิน','บรรจุ-สายพาน','ห้องบรรจุสินค้า 7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3800','user'::app_role,'ninayothasri28@gmail.com','ณินา','โยธาศรี','เดียร์','บรรจุ-สายพาน','ห้องบรรจุสินค้า 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3804','user'::app_role,'pimpa.401@icloud.com','พิมพา','เขตประทุม','พิมพ์','บรรจุ-สายพาน','ห้องบรรจุสินค้า 3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3806','user'::app_role,'zin765329@gmail.com','WIN WIN HTIKE',NULL,'วิน วิน ไค','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3809','user'::app_role,'kyawlintun90000@gmail.com','KYAW LIN TUN',NULL,'จอ ลิน ทุน','บรรจุ-สายพาน','พนักงานเข็นBULK',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3811','user'::app_role,'thanakonduangjit@gmail.com','ธนากร','ดวงจิตร','พีร์','สำนักงาน','เจ้าหน้าที่ควมคุมสิ่งแวดล้อม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3816','user'::app_role,'susuzaw282@gmail.com','SU SU ZAW',NULL,'สุ สุ ซอ','บรรจุ-สายพาน','ห้องบรรจุสินค้า 1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3821','user'::app_role,'mmew52697@gmail.com','กานดา','อิ่มหนำ','หมิว','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3822','user'::app_role,'misterlee258@gmail.com','อาลี','พิพิตทอง','ลี','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3823','user'::app_role,'Darunee3989@gmail.com','ดรุณี','รินรัตน์','รดา','ฝ่ายวิจัยและพัฒนา','เจ้าหน้าที่ฝ่ายวิจัยและพัฒนา',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3824','user'::app_role,'baitan11@hotmail.com','บุญฉลอง','คชภักดี','ตุ๊ก','บริหาร','ผู้จัดการแผนกวิศวกรรมและซ่อมบำรุง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3826','user'::app_role,'juthamatnoyhiran@gmail.com','จุฑามาศ','น้อยหิรัญ','เฟีย','ฝ่ายวิจัยและพัฒนา','ผู้ช่วยเจ้าหน้าที่ฝ่ายวิจัยและพัฒนา',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3827','user'::app_role,'nisachonnongpha234@gmail.com','นิศาชล','กาจสาลีการ','มอญ','ฝ่ายบุคคล','เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3828','user'::app_role,'kamolchanoktinn@gmail.com','กมลชนก','เจ๊ะหมัด','ฟาติน','การตลาดออนไลน์','เจ้าหน้าที่ Marketplace',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3829','user'::app_role,'saifon250812@gmail.com','สายฝน','สายสงวน','ฝน','ผสมเคมี','ผู้ช่วยหัวหน้าผสมเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3831','user'::app_role,'Prawannapinthong@gmail.com','ประวันนา','ปิ่นทอง','ลี','คลังบรรจุภัณฑ์','เจ้าหน้าที่รับบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3832','user'::app_role,'wannisa200214@gmail.com','วรรณิศา','ดาดื่น','ออย','ฝ่ายบุคคล','ผู้ช่วยฝ่ายปฏิบัติการและบุคคล',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3835','user'::app_role,'supansasangjantad@gmail.com','สุพรรษา','แสงจันทร์เทศ','แป๋ว
 แป
 แป๋ว','การตลาด ออนไลน์','เจ้าหน้าที่การตลาด ออนไลน์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3836','user'::app_role,'teerawut6168@gmail.com','ธีรวุฒิ','ม่วมกระโทก','แป๊ป','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3838','user'::app_role,'nusaranrat2002@gmail.com','สราญรัตน์','สุดศรี','นูรียะห์','บัญชีลูกหนี้','เจ้าหน้าที่บัญชีลูกหนี้ 5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3840','user'::app_role,'thanakonpaohom@gmail.com','ธนกร','เผ่าหอม','จ๊อบ','การตลาด ออนไลน์','ผู้จัดการ การตลาดออนไลน์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3841','user'::app_role,'aung219201@gmail.com','HTET HTET LWIN',NULL,'เท็ด เท็ด วิน','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่ชั่งเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3842','user'::app_role,'aung219201@gmail.com','PHYO WAI AUNG',NULL,'พิว ไว อ่อง','ผสมเคมี','เจ้าหน้าที่ดูแลหม้อผสม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3844','user'::app_role,'poosanisa521214@gmail.com','พลพล','เจ๊เลาะห์','ฮัยยูบ','Logistic','เจ้าหน้าที่ยกสินค้าสำเร็จรูปจัดส่ง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3845','user'::app_role,NULL,'SUJO',NULL,'สูโจ','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่จัดเตรียมวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3846','user'::app_role,NULL,'THAR NYI',NULL,'ทา นุ้ย','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่จัดเตรียมวัตถุดิบ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3847','user'::app_role,NULL,'ZIN KO KO',NULL,'ซิน โก โก','ชั่งสาร/คลังวัตถุดิบ','เจ้าหน้าที่ชั่งเคมี',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3848','user'::app_role,NULL,'สุรชาติ','ยาภา','อาร์ม','ส่งเสริมการขาย','หน่วยกิจกรรม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('3849','user'::app_role,NULL,'มงคล','สุพรรณสุด','หม่อน','Logistic','เจ้าหน้าที่จัดส่งสินค้าเขตกรุงเทพ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('485','user'::app_role,'wannapapupat@gmail.com','วรรณภา','ภู่เพ็ชร์','ลา','บรรจุ-สายพาน','ห้องบรรจุสินค้า 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('542','user'::app_role,'kk0832463837@gmail.com','วรรวิษา','ซันเล','ซีเราะห์','บรรจุ-สายพาน','ห้องบรรจุสินค้า 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('592','user'::app_role,'wannabag153@gmail.com','วรรณา','ซันเล','ซอบะห์','บรรจุ-สายพาน','ห้องบรรจุสินค้า 6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('622','user'::app_role,'mng_sa@carebeau-enjoy.com','สกล','ธนโชติวดี','เปี๊ยก','บริหาร','ผู้จัดการฝ่ายขายและการตลาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('634','user'::app_role,'ninu4552@gmail.com','อารีรัตน์','แชจอหอ','นินู','ผสมเคมี','หัวหน้าแผนกปั่นใบเดี่ยว',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('639','user'::app_role,'thanaporn.chuatong@gmail.com','ธนภร','เชื้อทอง','จิ๋ม','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('678','user'::app_role,'criratnkheiywchxum@gmail.com','จรีรัตน์','เขียวชอุ่ม','ตุ๊ก','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('692','user'::app_role,'aullsompong2555@gmail.com','สมพงษ์','สายหงษ์','อั๋น','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('698','user'::app_role,'luknammza@gmail.com','ลูกน้ำ','เอี่ยมประเสริฐ','น้ำ','คลังสินค้าสำเร็จรูป','ส่วนงานรับสินค้าและบริหารพื้นที่คลังสินค้า',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('699','user'::app_role,'chonticha.lg.26@gmail.com','ชลธิชา','เอี่ยมประเสริฐ','อัน','Logistic','หัวหน้าฝ่าย Logistic',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('719','user'::app_role,'bnfd7592@gmail.com','มาลินี','อีตำ','นา','บรรจุ-สายพาน','หัวหน้าสายพาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('726','user'::app_role,'skolpol243@gmail.com','พิศมัย','วงษ์ศรีแก้ว','เปิ้ล','คลังสินค้าสำเร็จรูป','ส่วนงานห้องเคลียร์สินค้ารับคืนสินค้า',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('742','user'::app_role,'napalaik4@gmail.com','นภาลัย','ภักดีวงค์','ใหม่','บรรจุ-สายพาน','พนักงานครีมย้อม',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('761','user'::app_role,'nawaratdee1994@gmail.com','นวรัตน์','ชมมณฑา','ปอย','บรรจุ-สายพาน','ห้องบรรจุผง',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('781','user'::app_role,'yy18062535@gmail.com','ศิริลักษณ์','เขียวชอุ่ม','หญิง','บัญชีลูกหนี้','เจ้าหน้าที่บัญชีลูกหนี้ 1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('793','user'::app_role,'sasiwimol0910@gmail.com','ศศิวิมล','จันทรังษี','นึง','บัญชีลูกหนี้','เจ้าหน้าที่บัญชีลูกหนี้ 4',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('804','user'::app_role,'faluffy2538@gmail.com','สมคิด','เซ็นโส','ฟา','ซ่อมบำรุงรักษา','ช่างซ่อมบำรุง(ช่างกลโรงงาน)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('805','user'::app_role,'sanechidtanong@gmail.com','วรเวช','กุลพาที','บี','ขาย','พนักงานขาย',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('835','user'::app_role,'varee.s121235@gmail.com','วารี','สงวนวงษ์','รี','คลังบรรจุภัณฑ์','เจ้าหน้าที่รับบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('840','user'::app_role,'malahongthxng@gmail.com','มาลา','โหงทอง','ดะห์','คลังสินค้าสำเร็จรูป','ส่วนงานห้องเคลียร์สินค้ารับคืนสินค้า',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('846','user'::app_role,'somchai.noy2532@gmail.com','สายรุ้ง','นิลนวลอุบล','รุ้ง','บรรจุ-สายพาน','พนักงานติดฉลากและบรรจุหีบห่อ 2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('859','user'::app_role,'nunn49527@gmail.com','พัชรินทร์','เพ็ชร์อินทร์','นุ่น','คลังบรรจุภัณฑ์','เจ้าหน้าที่เบิกจ่ายบรรจุภัณฑ์',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('880','user'::app_role,'vhfxjbvdbyfhgvx@gmail.com','NAN KYI KYI MAY',NULL,'ดามุก','บุคคล','เจ้าหน้าที่ทำความสะอาด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('881','user'::app_role,'vhfxjbvdbyfhgvx@gmail.com','SAW MIE PONE',NULL,'สมชาย','บุคคล','คนสวน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('893','user'::app_role,'sunmarue@gmail.com','อารี','สิงห์งาม','เด๊ะรี','บรรจุ-สายพาน','พนักงานบรรจุไฮโดรเจน( ห้อง8 )',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('940','user'::app_role,'manot0894860272@gmail.com','มาลัย','อ่านสนิท',NULL,'บรรจุ-สายพาน','พนักงานผลิต สพ.13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('985','user'::app_role,'s.siriporn2525@gmail.com','ศิริพร','กล่อมวงศ์','ดาว','บรรจุ-สายพาน','หัวหน้าสายพาน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('996','user'::app_role,'kanyakorn.nook99@gmail.com','กัลยกร','วงษ์อุคะ','นุ๊ก','บรรจุ-สายพาน','ห้องบรรจุสินค้า 10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai'),
('admin1','admin_it'::app_role,NULL,'ADMIN_IT',NULL,NULL,'IT','แอดมิน',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,0,'offline'::presence_status,'active'::user_status,NULL,NULL,true,NULL,NULL,NULL,'8-char-no-thai')
on conflict (emp_id) do update set
role = excluded.role,
email = excluded.email,
name_th = excluded.name_th,
surname_th = excluded.surname_th,
nickname_th = excluded.nickname_th,
dept_th = excluded.dept_th,
pos_th = excluded.pos_th,
phone = excluded.phone,
points = excluded.points,
total_earned = excluded.total_earned,
avatar_url = excluded.avatar_url,
last_check_in = excluded.last_check_in,
check_in_count = excluded.check_in_count,
presence = excluded.presence,
status = excluded.status,
start_work_date = excluded.start_work_date,
force_password_change = excluded.force_password_change,
password_policy = excluded.password_policy,
updated_at = now();

insert into user_credentials(emp_id, password_hash, must_change) values
('002', public.sb_hash_password('1234'), true),
('056', public.sb_hash_password('1234'), true),
('75', public.sb_hash_password('1234'), true),
('94', public.sb_hash_password('1234'), true),
('1012', public.sb_hash_password('1234'), true),
('1029', public.sb_hash_password('1234'), true),
('1046', public.sb_hash_password('1234'), true),
('1066', public.sb_hash_password('1234'), true),
('1215', public.sb_hash_password('1234'), true),
('1219', public.sb_hash_password('1234'), true),
('1220', public.sb_hash_password('1234'), true),
('1277', public.sb_hash_password('1234'), true),
('1283', public.sb_hash_password('1234'), true),
('1337', public.sb_hash_password('1234'), true),
('1351', public.sb_hash_password('1234'), true),
('1368', public.sb_hash_password('1234'), true),
('1374', public.sb_hash_password('1234'), true),
('1379', public.sb_hash_password('1234'), true),
('1380', public.sb_hash_password('1234'), true),
('1401', public.sb_hash_password('1234'), true),
('1404', public.sb_hash_password('1234'), true),
('1413', public.sb_hash_password('1234'), true),
('1421', public.sb_hash_password('1234'), true),
('1438', public.sb_hash_password('1234'), true),
('1455', public.sb_hash_password('1234'), true),
('1457', public.sb_hash_password('1234'), true),
('148', public.sb_hash_password('1234'), true),
('1508', public.sb_hash_password('1234'), true),
('1519', public.sb_hash_password('1234'), true),
('1522', public.sb_hash_password('1234'), true),
('1534', public.sb_hash_password('1234'), true),
('1556', public.sb_hash_password('1234'), true),
('1562', public.sb_hash_password('1234'), true),
('1567', public.sb_hash_password('1234'), true),
('1605', public.sb_hash_password('1234'), true),
('1658', public.sb_hash_password('1234'), true),
('1669', public.sb_hash_password('1234'), true),
('1689', public.sb_hash_password('1234'), true),
('1740', public.sb_hash_password('1234'), true),
('179', public.sb_hash_password('1234'), true),
('1821', public.sb_hash_password('1234'), true),
('1822', public.sb_hash_password('1234'), true),
('1826', public.sb_hash_password('1234'), true),
('1835', public.sb_hash_password('1234'), true),
('1849', public.sb_hash_password('1234'), true),
('1853', public.sb_hash_password('1234'), true),
('1867', public.sb_hash_password('1234'), true),
('1882', public.sb_hash_password('1234'), true),
('1891', public.sb_hash_password('1234'), true),
('1926', public.sb_hash_password('1234'), true),
('1932', public.sb_hash_password('1234'), true),
('1943', public.sb_hash_password('1234'), true),
('1947', public.sb_hash_password('1234'), true),
('1985', public.sb_hash_password('1234'), true),
('1989', public.sb_hash_password('1234'), true),
('1991', public.sb_hash_password('1234'), true),
('2001', public.sb_hash_password('1234'), true),
('2008', public.sb_hash_password('1234'), true),
('202', public.sb_hash_password('1234'), true),
('2048', public.sb_hash_password('1234'), true),
('2051', public.sb_hash_password('1234'), true),
('2081', public.sb_hash_password('1234'), true),
('2092', public.sb_hash_password('1234'), true),
('2095', public.sb_hash_password('1234'), true),
('2096', public.sb_hash_password('1234'), true),
('2103', public.sb_hash_password('1234'), true),
('212', public.sb_hash_password('1234'), true),
('2134', public.sb_hash_password('1234'), true),
('2135', public.sb_hash_password('1234'), true),
('2140', public.sb_hash_password('1234'), true),
('2229', public.sb_hash_password('1234'), true),
('2230', public.sb_hash_password('1234'), true),
('2255', public.sb_hash_password('1234'), true),
('2267', public.sb_hash_password('1234'), true),
('2272', public.sb_hash_password('1234'), true),
('2275', public.sb_hash_password('1234'), true),
('2300', public.sb_hash_password('1234'), true),
('2339', public.sb_hash_password('1234'), true),
('2350', public.sb_hash_password('1234'), true),
('2374', public.sb_hash_password('1234'), true),
('2382', public.sb_hash_password('1234'), true),
('2397', public.sb_hash_password('1234'), true),
('2410', public.sb_hash_password('1234'), true),
('2428', public.sb_hash_password('1234'), true),
('2445', public.sb_hash_password('1234'), true),
('2468', public.sb_hash_password('1234'), true),
('2472', public.sb_hash_password('1234'), true),
('2474', public.sb_hash_password('1234'), true),
('2487', public.sb_hash_password('1234'), true),
('2519', public.sb_hash_password('1234'), true),
('2566', public.sb_hash_password('1234'), true),
('259', public.sb_hash_password('1234'), true),
('2590', public.sb_hash_password('1234'), true),
('2591', public.sb_hash_password('1234'), true),
('2595', public.sb_hash_password('1234'), true),
('2597', public.sb_hash_password('1234'), true),
('2607', public.sb_hash_password('1234'), true),
('2626', public.sb_hash_password('1234'), true),
('2642', public.sb_hash_password('1234'), true),
('2663', public.sb_hash_password('1234'), true),
('2664', public.sb_hash_password('1234'), true),
('2665', public.sb_hash_password('1234'), true),
('2669', public.sb_hash_password('1234'), true),
('2706', public.sb_hash_password('1234'), true),
('2709', public.sb_hash_password('1234'), true),
('2712', public.sb_hash_password('1234'), true),
('2713', public.sb_hash_password('1234'), true),
('2715', public.sb_hash_password('1234'), true),
('2717', public.sb_hash_password('1234'), true),
('2723', public.sb_hash_password('1234'), true),
('2726', public.sb_hash_password('1234'), true),
('2730', public.sb_hash_password('1234'), true),
('2731', public.sb_hash_password('1234'), true),
('2736', public.sb_hash_password('1234'), true),
('2738', public.sb_hash_password('1234'), true),
('2739', public.sb_hash_password('1234'), true),
('2740', public.sb_hash_password('1234'), true),
('2744', public.sb_hash_password('1234'), true),
('2749', public.sb_hash_password('1234'), true),
('2753', public.sb_hash_password('1234'), true),
('2769', public.sb_hash_password('1234'), true),
('2824', public.sb_hash_password('1234'), true),
('2828', public.sb_hash_password('1234'), true),
('2837', public.sb_hash_password('1234'), true),
('2874', public.sb_hash_password('1234'), true),
('2876', public.sb_hash_password('1234'), true),
('2897', public.sb_hash_password('1234'), true),
('2917', public.sb_hash_password('1234'), true),
('2936', public.sb_hash_password('1234'), true),
('2942', public.sb_hash_password('1234'), true),
('2961', public.sb_hash_password('1234'), true),
('2969', public.sb_hash_password('1234'), true),
('2970', public.sb_hash_password('1234'), true),
('2975', public.sb_hash_password('1234'), true),
('2979', public.sb_hash_password('1234'), true),
('2986', public.sb_hash_password('1234'), true),
('2991', public.sb_hash_password('1234'), true),
('2999', public.sb_hash_password('1234'), true),
('3003', public.sb_hash_password('1234'), true),
('3018', public.sb_hash_password('1234'), true),
('3021', public.sb_hash_password('1234'), true),
('3039', public.sb_hash_password('1234'), true),
('3041', public.sb_hash_password('1234'), true),
('3043', public.sb_hash_password('1234'), true),
('3044', public.sb_hash_password('1234'), true),
('3067', public.sb_hash_password('1234'), true),
('3102', public.sb_hash_password('1234'), true),
('3111', public.sb_hash_password('1234'), true),
('3112', public.sb_hash_password('1234'), true),
('3113', public.sb_hash_password('1234'), true),
('3114', public.sb_hash_password('1234'), true),
('3119', public.sb_hash_password('1234'), true),
('3149', public.sb_hash_password('1234'), true),
('3179', public.sb_hash_password('1234'), true),
('3181', public.sb_hash_password('1234'), true),
('3191', public.sb_hash_password('1234'), true),
('3239', public.sb_hash_password('1234'), true),
('3247', public.sb_hash_password('1234'), true),
('3263', public.sb_hash_password('1234'), true),
('3265', public.sb_hash_password('1234'), true),
('3302', public.sb_hash_password('1234'), true),
('3309', public.sb_hash_password('1234'), true),
('3311', public.sb_hash_password('1234'), true),
('3324', public.sb_hash_password('1234'), true),
('3326', public.sb_hash_password('1234'), true),
('3332', public.sb_hash_password('1234'), true),
('3354', public.sb_hash_password('1234'), true),
('3367', public.sb_hash_password('1234'), true),
('3380', public.sb_hash_password('1234'), true),
('339', public.sb_hash_password('1234'), true),
('3403', public.sb_hash_password('1234'), true),
('3405', public.sb_hash_password('1234'), true),
('342', public.sb_hash_password('1234'), true),
('3423', public.sb_hash_password('1234'), true),
('3424', public.sb_hash_password('1234'), true),
('3425', public.sb_hash_password('1234'), true),
('3427', public.sb_hash_password('1234'), true),
('3430', public.sb_hash_password('1234'), true),
('3434', public.sb_hash_password('1234'), true),
('3449', public.sb_hash_password('1234'), true),
('3452', public.sb_hash_password('1234'), true),
('3465', public.sb_hash_password('1234'), true),
('3477', public.sb_hash_password('1234'), true),
('3485', crypt('5678', gen_salt('bf')), true),
('3488', public.sb_hash_password('1234'), true),
('3490', public.sb_hash_password('1234'), true),
('3494', public.sb_hash_password('1234'), true),
('3524', public.sb_hash_password('1234'), true),
('3531', public.sb_hash_password('1234'), true),
('3533', public.sb_hash_password('1234'), true),
('3534', public.sb_hash_password('1234'), true),
('3540', public.sb_hash_password('1234'), true),
('3541', public.sb_hash_password('1234'), true),
('3554', public.sb_hash_password('1234'), true),
('3556', public.sb_hash_password('1234'), true),
('3565', public.sb_hash_password('1234'), true),
('3599', public.sb_hash_password('1234'), true),
('3604', public.sb_hash_password('1234'), true),
('3608', public.sb_hash_password('1234'), true),
('3617', public.sb_hash_password('1234'), true),
('3619', public.sb_hash_password('1234'), true),
('3620', public.sb_hash_password('1234'), true),
('3621', public.sb_hash_password('1234'), true),
('3622', public.sb_hash_password('1234'), true),
('3624', public.sb_hash_password('1234'), true),
('3627', public.sb_hash_password('1234'), true),
('3630', public.sb_hash_password('1234'), true),
('3631', public.sb_hash_password('1234'), true),
('3632', public.sb_hash_password('1234'), true),
('3633', public.sb_hash_password('1234'), true),
('3634', public.sb_hash_password('1234'), true),
('3636', public.sb_hash_password('1234'), true),
('3641', public.sb_hash_password('1234'), true),
('3642', public.sb_hash_password('1234'), true),
('3643', public.sb_hash_password('1234'), true),
('3645', public.sb_hash_password('1234'), true),
('3647', public.sb_hash_password('1234'), true),
('3648', public.sb_hash_password('1234'), true),
('3652', public.sb_hash_password('1234'), true),
('3656', public.sb_hash_password('1234'), true),
('3658', public.sb_hash_password('1234'), true),
('3669', public.sb_hash_password('1234'), true),
('3672', crypt('9e1da9c48873311adcd58149a7d0b2ac3ef5a1fb7e0ab7bc1ede88c51dff5556', gen_salt('bf')), true),
('3685', public.sb_hash_password('1234'), true),
('3696', public.sb_hash_password('1234'), true),
('3697', public.sb_hash_password('1234'), true),
('3698', public.sb_hash_password('1234'), true),
('3700', public.sb_hash_password('1234'), true),
('3701', public.sb_hash_password('1234'), true),
('3702', public.sb_hash_password('1234'), true),
('3703', public.sb_hash_password('1234'), true),
('3704', public.sb_hash_password('1234'), true),
('3705', public.sb_hash_password('1234'), true),
('3706', public.sb_hash_password('1234'), true),
('3707', public.sb_hash_password('1234'), true),
('3709', public.sb_hash_password('1234'), true),
('3711', public.sb_hash_password('1234'), true),
('3715', public.sb_hash_password('1234'), true),
('3718', public.sb_hash_password('1234'), true),
('3719', public.sb_hash_password('1234'), true),
('3720', public.sb_hash_password('1234'), true),
('3721', public.sb_hash_password('1234'), true),
('3722', public.sb_hash_password('1234'), true),
('3723', public.sb_hash_password('1234'), true),
('3725', public.sb_hash_password('1234'), true),
('3726', public.sb_hash_password('1234'), true),
('3727', public.sb_hash_password('1234'), true),
('3728', public.sb_hash_password('1234'), true),
('3729', public.sb_hash_password('1234'), true),
('3732', public.sb_hash_password('1234'), true),
('3733', public.sb_hash_password('1234'), true),
('3736', public.sb_hash_password('1234'), true),
('3739', public.sb_hash_password('1234'), true),
('3741', public.sb_hash_password('1234'), true),
('3743', public.sb_hash_password('1234'), true),
('3746', public.sb_hash_password('1234'), true),
('3751', public.sb_hash_password('1234'), true),
('3753', public.sb_hash_password('1234'), true),
('3754', public.sb_hash_password('1234'), true),
('3755', public.sb_hash_password('1234'), true),
('3756', public.sb_hash_password('1234'), true),
('3758', public.sb_hash_password('1234'), true),
('3766', public.sb_hash_password('1234'), true),
('3768', public.sb_hash_password('1234'), true),
('3769', public.sb_hash_password('1234'), true),
('3772', public.sb_hash_password('1234'), true),
('3775', public.sb_hash_password('1234'), true),
('3776', public.sb_hash_password('1234'), true),
('3777', crypt('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', gen_salt('bf')), true),
('3783', public.sb_hash_password('1234'), true),
('3784', public.sb_hash_password('1234'), true),
('3786', public.sb_hash_password('1234'), true),
('3788', public.sb_hash_password('1234'), true),
('3792', public.sb_hash_password('1234'), true),
('3794', public.sb_hash_password('1234'), true),
('3795', public.sb_hash_password('1234'), true),
('3796', public.sb_hash_password('1234'), true),
('3800', public.sb_hash_password('1234'), true),
('3804', public.sb_hash_password('1234'), true),
('3806', public.sb_hash_password('1234'), true),
('3809', public.sb_hash_password('1234'), true),
('3811', public.sb_hash_password('1234'), true),
('3816', public.sb_hash_password('1234'), true),
('3821', public.sb_hash_password('1234'), true),
('3822', public.sb_hash_password('1234'), true),
('3823', public.sb_hash_password('1234'), true),
('3824', public.sb_hash_password('1234'), true),
('3826', public.sb_hash_password('1234'), true),
('3827', public.sb_hash_password('1234'), true),
('3828', public.sb_hash_password('1234'), true),
('3829', public.sb_hash_password('1234'), true),
('3831', public.sb_hash_password('1234'), true),
('3832', public.sb_hash_password('1234'), true),
('3835', public.sb_hash_password('1234'), true),
('3836', public.sb_hash_password('1234'), true),
('3838', public.sb_hash_password('1234'), true),
('3840', public.sb_hash_password('1234'), true),
('3841', public.sb_hash_password('1234'), true),
('3842', public.sb_hash_password('1234'), true),
('3844', public.sb_hash_password('1234'), true),
('3845', public.sb_hash_password('1234'), true),
('3846', public.sb_hash_password('1234'), true),
('3847', public.sb_hash_password('1234'), true),
('3848', public.sb_hash_password('1234'), true),
('3849', public.sb_hash_password('1234'), true),
('485', public.sb_hash_password('1234'), true),
('542', public.sb_hash_password('1234'), true),
('592', public.sb_hash_password('1234'), true),
('622', public.sb_hash_password('1234'), true),
('634', public.sb_hash_password('1234'), true),
('639', public.sb_hash_password('1234'), true),
('678', public.sb_hash_password('1234'), true),
('692', public.sb_hash_password('1234'), true),
('698', public.sb_hash_password('1234'), true),
('699', public.sb_hash_password('1234'), true),
('719', public.sb_hash_password('1234'), true),
('726', public.sb_hash_password('1234'), true),
('742', public.sb_hash_password('1234'), true),
('761', public.sb_hash_password('1234'), true),
('781', public.sb_hash_password('1234'), true),
('793', public.sb_hash_password('1234'), true),
('804', public.sb_hash_password('1234'), true),
('805', public.sb_hash_password('1234'), true),
('835', public.sb_hash_password('1234'), true),
('840', public.sb_hash_password('1234'), true),
('846', public.sb_hash_password('1234'), true),
('859', public.sb_hash_password('1234'), true),
('880', public.sb_hash_password('1234'), true),
('881', public.sb_hash_password('1234'), true),
('893', public.sb_hash_password('1234'), true),
('940', public.sb_hash_password('1234'), true),
('985', public.sb_hash_password('1234'), true),
('996', public.sb_hash_password('1234'), true),
('admin1', crypt('ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270', gen_salt('bf')), true)
on conflict (emp_id) do nothing;

insert into holidays(holiday_date, year, month, day, weekday, weekday_th, is_weekend, is_holiday, holiday_name, holiday_type, is_workday, note, created_at) values
('2026-01-01'::date,2026,1,1,4,'พฤหัสบดี',false,true,'วันขึ้นปีใหม่','Public Holiday',false,'ตรวจสอบวันหยุดชดเชยตามประกาศบริษัท','2026-05-27 17:59:58'::timestamptz),
('2026-01-02'::date,2026,1,2,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-03'::date,2026,1,3,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-04'::date,2026,1,4,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-05'::date,2026,1,5,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-06'::date,2026,1,6,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-07'::date,2026,1,7,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-08'::date,2026,1,8,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-09'::date,2026,1,9,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-10'::date,2026,1,10,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-11'::date,2026,1,11,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-12'::date,2026,1,12,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-13'::date,2026,1,13,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-14'::date,2026,1,14,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-15'::date,2026,1,15,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-16'::date,2026,1,16,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-17'::date,2026,1,17,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-18'::date,2026,1,18,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-19'::date,2026,1,19,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-20'::date,2026,1,20,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-21'::date,2026,1,21,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-22'::date,2026,1,22,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-23'::date,2026,1,23,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-24'::date,2026,1,24,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-25'::date,2026,1,25,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-26'::date,2026,1,26,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-27'::date,2026,1,27,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-28'::date,2026,1,28,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-29'::date,2026,1,29,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-30'::date,2026,1,30,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-01-31'::date,2026,1,31,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-01'::date,2026,2,1,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-02'::date,2026,2,2,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-03'::date,2026,2,3,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-04'::date,2026,2,4,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-05'::date,2026,2,5,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-06'::date,2026,2,6,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-07'::date,2026,2,7,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-08'::date,2026,2,8,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-09'::date,2026,2,9,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-10'::date,2026,2,10,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-11'::date,2026,2,11,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-12'::date,2026,2,12,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-13'::date,2026,2,13,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-14'::date,2026,2,14,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-15'::date,2026,2,15,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-16'::date,2026,2,16,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-17'::date,2026,2,17,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-18'::date,2026,2,18,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-19'::date,2026,2,19,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-20'::date,2026,2,20,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-21'::date,2026,2,21,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-22'::date,2026,2,22,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-23'::date,2026,2,23,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-24'::date,2026,2,24,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-25'::date,2026,2,25,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-26'::date,2026,2,26,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-27'::date,2026,2,27,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-02-28'::date,2026,2,28,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-01'::date,2026,3,1,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-02'::date,2026,3,2,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-03'::date,2026,3,3,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-04'::date,2026,3,4,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-05'::date,2026,3,5,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-06'::date,2026,3,6,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-07'::date,2026,3,7,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-08'::date,2026,3,8,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-09'::date,2026,3,9,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-10'::date,2026,3,10,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-11'::date,2026,3,11,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-12'::date,2026,3,12,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-13'::date,2026,3,13,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-14'::date,2026,3,14,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-15'::date,2026,3,15,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-16'::date,2026,3,16,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-17'::date,2026,3,17,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-18'::date,2026,3,18,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-19'::date,2026,3,19,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-20'::date,2026,3,20,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-21'::date,2026,3,21,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-22'::date,2026,3,22,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-23'::date,2026,3,23,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-24'::date,2026,3,24,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-25'::date,2026,3,25,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-26'::date,2026,3,26,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-27'::date,2026,3,27,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-28'::date,2026,3,28,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-29'::date,2026,3,29,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-30'::date,2026,3,30,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-03-31'::date,2026,3,31,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-01'::date,2026,4,1,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-02'::date,2026,4,2,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-03'::date,2026,4,3,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-04'::date,2026,4,4,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-05'::date,2026,4,5,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-06'::date,2026,4,6,1,'จันทร์',false,true,'วันจักรี','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-07'::date,2026,4,7,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-08'::date,2026,4,8,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-09'::date,2026,4,9,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-10'::date,2026,4,10,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-11'::date,2026,4,11,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-12'::date,2026,4,12,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-13'::date,2026,4,13,1,'จันทร์',false,true,'วันสงกรานต์','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-14'::date,2026,4,14,2,'อังคาร',false,true,'วันสงกรานต์','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-15'::date,2026,4,15,3,'พุธ',false,true,'วันสงกรานต์','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-16'::date,2026,4,16,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-17'::date,2026,4,17,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-18'::date,2026,4,18,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-19'::date,2026,4,19,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-20'::date,2026,4,20,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-21'::date,2026,4,21,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-22'::date,2026,4,22,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-23'::date,2026,4,23,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-24'::date,2026,4,24,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-25'::date,2026,4,25,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-26'::date,2026,4,26,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-27'::date,2026,4,27,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-28'::date,2026,4,28,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-29'::date,2026,4,29,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-04-30'::date,2026,4,30,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-01'::date,2026,5,1,5,'ศุกร์',false,true,'วันแรงงานแห่งชาติ','Company Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-02'::date,2026,5,2,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-03'::date,2026,5,3,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-04'::date,2026,5,4,1,'จันทร์',false,true,'วันฉัตรมงคล','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-05'::date,2026,5,5,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-06'::date,2026,5,6,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-07'::date,2026,5,7,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-08'::date,2026,5,8,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-09'::date,2026,5,9,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-10'::date,2026,5,10,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-11'::date,2026,5,11,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-12'::date,2026,5,12,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-13'::date,2026,5,13,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-14'::date,2026,5,14,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-15'::date,2026,5,15,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-16'::date,2026,5,16,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-17'::date,2026,5,17,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-18'::date,2026,5,18,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-19'::date,2026,5,19,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-20'::date,2026,5,20,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-21'::date,2026,5,21,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-22'::date,2026,5,22,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-23'::date,2026,5,23,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-24'::date,2026,5,24,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-25'::date,2026,5,25,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-26'::date,2026,5,26,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-27'::date,2026,5,27,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-28'::date,2026,5,28,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-29'::date,2026,5,29,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-30'::date,2026,5,30,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-05-31'::date,2026,5,31,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-01'::date,2026,6,1,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-02'::date,2026,6,2,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-03'::date,2026,6,3,3,'พุธ',false,true,'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-04'::date,2026,6,4,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-05'::date,2026,6,5,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-06'::date,2026,6,6,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-07'::date,2026,6,7,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-08'::date,2026,6,8,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-09'::date,2026,6,9,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-10'::date,2026,6,10,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-11'::date,2026,6,11,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-12'::date,2026,6,12,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-13'::date,2026,6,13,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-14'::date,2026,6,14,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-15'::date,2026,6,15,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-16'::date,2026,6,16,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-17'::date,2026,6,17,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-18'::date,2026,6,18,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-19'::date,2026,6,19,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-20'::date,2026,6,20,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-21'::date,2026,6,21,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-22'::date,2026,6,22,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-23'::date,2026,6,23,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-24'::date,2026,6,24,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-25'::date,2026,6,25,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-26'::date,2026,6,26,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-27'::date,2026,6,27,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-28'::date,2026,6,28,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-29'::date,2026,6,29,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-06-30'::date,2026,6,30,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-01'::date,2026,7,1,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-02'::date,2026,7,2,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-03'::date,2026,7,3,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-04'::date,2026,7,4,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-05'::date,2026,7,5,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-06'::date,2026,7,6,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-07'::date,2026,7,7,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-08'::date,2026,7,8,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-09'::date,2026,7,9,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-10'::date,2026,7,10,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-11'::date,2026,7,11,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-12'::date,2026,7,12,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-13'::date,2026,7,13,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-14'::date,2026,7,14,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-15'::date,2026,7,15,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-16'::date,2026,7,16,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-17'::date,2026,7,17,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-18'::date,2026,7,18,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-19'::date,2026,7,19,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-20'::date,2026,7,20,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-21'::date,2026,7,21,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-22'::date,2026,7,22,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-23'::date,2026,7,23,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-24'::date,2026,7,24,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-25'::date,2026,7,25,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-26'::date,2026,7,26,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-27'::date,2026,7,27,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-28'::date,2026,7,28,2,'อังคาร',false,true,'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-29'::date,2026,7,29,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-30'::date,2026,7,30,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-07-31'::date,2026,7,31,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-01'::date,2026,8,1,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-02'::date,2026,8,2,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-03'::date,2026,8,3,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-04'::date,2026,8,4,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-05'::date,2026,8,5,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-06'::date,2026,8,6,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-07'::date,2026,8,7,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-08'::date,2026,8,8,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-09'::date,2026,8,9,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-10'::date,2026,8,10,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-11'::date,2026,8,11,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-12'::date,2026,8,12,3,'พุธ',false,true,'วันแม่แห่งชาติ','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-13'::date,2026,8,13,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-14'::date,2026,8,14,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-15'::date,2026,8,15,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-16'::date,2026,8,16,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-17'::date,2026,8,17,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-18'::date,2026,8,18,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-19'::date,2026,8,19,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-20'::date,2026,8,20,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-21'::date,2026,8,21,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-22'::date,2026,8,22,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-23'::date,2026,8,23,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-24'::date,2026,8,24,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-25'::date,2026,8,25,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-26'::date,2026,8,26,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-27'::date,2026,8,27,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-28'::date,2026,8,28,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-29'::date,2026,8,29,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-30'::date,2026,8,30,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-08-31'::date,2026,8,31,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-01'::date,2026,9,1,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-02'::date,2026,9,2,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-03'::date,2026,9,3,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-04'::date,2026,9,4,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-05'::date,2026,9,5,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-06'::date,2026,9,6,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-07'::date,2026,9,7,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-08'::date,2026,9,8,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-09'::date,2026,9,9,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-10'::date,2026,9,10,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-11'::date,2026,9,11,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-12'::date,2026,9,12,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-13'::date,2026,9,13,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-14'::date,2026,9,14,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-15'::date,2026,9,15,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-16'::date,2026,9,16,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-17'::date,2026,9,17,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-18'::date,2026,9,18,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-19'::date,2026,9,19,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-20'::date,2026,9,20,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-21'::date,2026,9,21,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-22'::date,2026,9,22,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-23'::date,2026,9,23,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-24'::date,2026,9,24,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-25'::date,2026,9,25,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-26'::date,2026,9,26,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-27'::date,2026,9,27,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-28'::date,2026,9,28,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-29'::date,2026,9,29,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-09-30'::date,2026,9,30,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-01'::date,2026,10,1,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-02'::date,2026,10,2,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-03'::date,2026,10,3,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-04'::date,2026,10,4,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-05'::date,2026,10,5,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-06'::date,2026,10,6,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-07'::date,2026,10,7,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-08'::date,2026,10,8,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-09'::date,2026,10,9,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-10'::date,2026,10,10,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-11'::date,2026,10,11,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-12'::date,2026,10,12,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-13'::date,2026,10,13,2,'อังคาร',false,true,'วันนวมินทรมหาราช','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-14'::date,2026,10,14,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-15'::date,2026,10,15,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-16'::date,2026,10,16,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-17'::date,2026,10,17,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-18'::date,2026,10,18,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-19'::date,2026,10,19,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-20'::date,2026,10,20,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-21'::date,2026,10,21,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-22'::date,2026,10,22,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-23'::date,2026,10,23,5,'ศุกร์',false,true,'วันปิยมหาราช','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-24'::date,2026,10,24,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-25'::date,2026,10,25,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-26'::date,2026,10,26,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-27'::date,2026,10,27,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-28'::date,2026,10,28,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-29'::date,2026,10,29,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-30'::date,2026,10,30,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-10-31'::date,2026,10,31,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-01'::date,2026,11,1,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-02'::date,2026,11,2,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-03'::date,2026,11,3,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-04'::date,2026,11,4,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-05'::date,2026,11,5,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-06'::date,2026,11,6,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-07'::date,2026,11,7,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-08'::date,2026,11,8,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-09'::date,2026,11,9,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-10'::date,2026,11,10,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-11'::date,2026,11,11,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-12'::date,2026,11,12,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-13'::date,2026,11,13,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-14'::date,2026,11,14,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-15'::date,2026,11,15,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-16'::date,2026,11,16,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-17'::date,2026,11,17,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-18'::date,2026,11,18,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-19'::date,2026,11,19,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-20'::date,2026,11,20,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-21'::date,2026,11,21,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-22'::date,2026,11,22,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-23'::date,2026,11,23,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-24'::date,2026,11,24,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-25'::date,2026,11,25,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-26'::date,2026,11,26,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-27'::date,2026,11,27,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-28'::date,2026,11,28,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-29'::date,2026,11,29,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-11-30'::date,2026,11,30,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-01'::date,2026,12,1,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-02'::date,2026,12,2,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-03'::date,2026,12,3,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-04'::date,2026,12,4,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-05'::date,2026,12,5,6,'เสาร์',true,true,'วันพ่อแห่งชาติ','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-06'::date,2026,12,6,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-07'::date,2026,12,7,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-08'::date,2026,12,8,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-09'::date,2026,12,9,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-10'::date,2026,12,10,4,'พฤหัสบดี',false,true,'วันรัฐธรรมนูญ','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-11'::date,2026,12,11,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-12'::date,2026,12,12,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-13'::date,2026,12,13,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-14'::date,2026,12,14,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-15'::date,2026,12,15,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-16'::date,2026,12,16,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-17'::date,2026,12,17,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-18'::date,2026,12,18,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-19'::date,2026,12,19,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-20'::date,2026,12,20,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-21'::date,2026,12,21,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-22'::date,2026,12,22,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-23'::date,2026,12,23,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-24'::date,2026,12,24,4,'พฤหัสบดี',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-25'::date,2026,12,25,5,'ศุกร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-26'::date,2026,12,26,6,'เสาร์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-27'::date,2026,12,27,0,'อาทิตย์',true,false,NULL,NULL,false,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-28'::date,2026,12,28,1,'จันทร์',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-29'::date,2026,12,29,2,'อังคาร',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-30'::date,2026,12,30,3,'พุธ',false,false,NULL,NULL,true,NULL,'2026-05-27 17:59:58'::timestamptz),
('2026-12-31'::date,2026,12,31,4,'พฤหัสบดี',false,true,'วันสิ้นปี','Public Holiday',false,NULL,'2026-05-27 17:59:58'::timestamptz)
on conflict (holiday_date) do update set
year=excluded.year, month=excluded.month, day=excluded.day, weekday=excluded.weekday,
weekday_th=excluded.weekday_th, is_weekend=excluded.is_weekend, is_holiday=excluded.is_holiday,
holiday_name=excluded.holiday_name, holiday_type=excluded.holiday_type, is_workday=excluded.is_workday,
note=excluded.note;

insert into checkin_logs(log_id, emp_id, checkin_date, checkin_time, points_earned, status) values
('CH-3D98EE37','3672','2026-05-20'::date,'07:30:21'::time,1,'Success'),
('CH-34CFDC35','3672','2026-05-27'::date,'10:43:47'::time,1,'Success'),
('CH-F89D1CCF','3672','2026-05-29'::date,'08:54:03'::time,1,'Success'),
('CH-06BF15CA','002','2026-05-29'::date,'09:29:45'::time,1,'Success'),
('CH-D23FA59E','75','2026-05-29'::date,'11:21:49'::time,1,'Success'),
('CH-CD02AB04','1012','2026-05-29'::date,'13:48:17'::time,1,'Success'),
('CH-DFB1237F','3672','2026-06-29'::date,'12:00:15'::time,1,'Success'),
('CH-F90BF74D','3672','2026-07-08'::date,'08:55:48'::time,1,'Success'),
('CH-D99AFC28','3672','2026-07-09'::date,'08:26:22'::time,1,'Success')
on conflict (log_id) do nothing;

insert into point_transactions(tx_id, emp_id, tx_type, amount, description, balance_after, source_type, source_id, metadata, created_at) values
('TX-011D3839','3672','earn'::point_tx_type,1,'Daily Check-in',1,NULL,NULL,'{}'::jsonb,'2026-05-20 07:30:19'::timestamptz),
('TX-FF85B549','3672','earn'::point_tx_type,1,'Daily Check-in',3,NULL,NULL,'{}'::jsonb,'2026-05-27 10:43:45'::timestamptz),
('TX-43181430','3672','earn'::point_tx_type,1,'Daily Check-in',4,NULL,NULL,'{}'::jsonb,'2026-05-29 08:54:03'::timestamptz),
('TX-295A73D6','002','earn'::point_tx_type,1,'Daily Check-in',1,NULL,NULL,'{}'::jsonb,'2026-05-29 09:29:42'::timestamptz),
('TX-F57E222A','75','earn'::point_tx_type,1,'Daily Check-in',1,NULL,NULL,'{}'::jsonb,'2026-05-29 11:21:51'::timestamptz),
('TX-8CE1B071','1012','earn'::point_tx_type,1,'Daily Check-in',1,NULL,NULL,'{}'::jsonb,'2026-05-29 13:48:19'::timestamptz),
('TX-8A81CDFE','3672','earn'::point_tx_type,1,'Daily Check-in',5,NULL,NULL,'{}'::jsonb,'2026-06-29 12:00:42'::timestamptz),
('TX-C18D5FEF','3672','earn'::point_tx_type,1,'Daily Check-in',6,NULL,NULL,'{}'::jsonb,'2026-07-08 08:55:50'::timestamptz),
('TX-ECC227F3','3672','earn'::point_tx_type,1,'Daily Check-in',7,NULL,NULL,'{}'::jsonb,'2026-07-09 08:26:23'::timestamptz)
on conflict (tx_id) do nothing;

insert into overall_logs(log_id, employee_id, source_type, source_id, point_before, points_change, point_after, activity_date, activity_time, created_at, metadata) values
('LOG-6BC87913-4','3672','EARN','TX-011D3839',0,1,1,'2026-05-20'::date,'07:30:19'::time,'2026-05-20 07:30:19'::timestamptz,'{"desc":"Daily Check-in"}'::jsonb),
('LOG-ECE9AEFE-8','3672','EARN','TX-FF85B549',2,1,3,'2026-05-27'::date,'10:43:45'::time,'2026-05-27 10:43:45'::timestamptz,'{"desc":"Daily Check-in"}'::jsonb),
('LOG-5D0674B3-7','3672','EARN','TX-43181430',3,1,4,'2026-05-29'::date,'08:54:03'::time,'2026-05-29 08:54:03'::timestamptz,'{"desc":"Daily Check-in"}'::jsonb),
('LOG-A1F9F145-1','002','EARN','TX-295A73D6',0,1,1,'2026-05-29'::date,'09:29:42'::time,'2026-05-29 09:29:42'::timestamptz,'{"desc":"Daily Check-in"}'::jsonb),
('LOG-4CD9F533-0','75','EARN','TX-F57E222A',0,1,1,'2026-05-29'::date,'11:21:52'::time,'2026-05-29 11:21:52'::timestamptz,'{"desc":"Daily Check-in","originalType":"EARN"}'::jsonb),
('LOG-BBE026FB-B','1012','EARN','TX-8CE1B071',0,1,1,'2026-05-29'::date,'13:48:19'::time,'2026-05-29 13:48:19'::timestamptz,'{"desc":"Daily Check-in","originalType":"EARN"}'::jsonb),
('LOG-51CE844B-1','3672','EARN','TX-8A81CDFE',4,1,5,'2026-06-29'::date,'12:00:43'::time,'2026-06-29 12:00:43'::timestamptz,'{"desc":"Daily Check-in","originalType":"EARN"}'::jsonb),
('LOG-B37A3D54-1','3672','EARN','TX-C18D5FEF',5,1,6,'2026-07-08'::date,'08:55:50'::time,'2026-07-08 08:55:50'::timestamptz,'{"desc":"Daily Check-in","originalType":"EARN"}'::jsonb),
('LOG-5DA007D3-D','3672','EARN','TX-ECC227F3',6,1,7,'2026-07-09'::date,'08:26:23'::time,'2026-07-09 08:26:23'::timestamptz,'{"desc":"Daily Check-in","originalType":"EARN"}'::jsonb)
on conflict (log_id) do nothing;

insert into notifications(notification_id, emp_id, title, message, type, created_at, is_read, metadata) values
('NOTI-1779237019928','3672','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้','system'::notification_type,'2026-05-20 07:30:19'::timestamptz,false,'{}'::jsonb),
('NOTI-1779853425506','3672','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้','system'::notification_type,'2026-05-27 10:43:45'::timestamptz,false,'{}'::jsonb),
('NOTI-1780021783072-A6ADA','002','ได้รับแต้ม +1','จาก: Daily Check-in | แต้มรวม 1','point_earn'::notification_type,'2026-05-29 09:29:43'::timestamptz,false,'{"txId":"TX-295A73D6","points":1,"balance":1,"desc":"Daily Check-in"}'::jsonb),
('NOTI-1780021783835-BF07B','002','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้ | แต้มรวม 1','checkin'::notification_type,'2026-05-29 09:29:43'::timestamptz,false,'{"date":"2026-05-29","points":1,"balance":1}'::jsonb),
('NOTI-1780021827995-FC698','3672','ข้อความใหม่จาก สินชัย ภู่เพชร','สวัสดี','chat'::notification_type,'2026-05-29 09:30:27'::timestamptz,true,'{"senderId":"002","receiverId":"3672","room":"002_3672","msgId":"MSG-1780021825502-9A189"}'::jsonb),
('NOTI-1780021930133-F81F9','3672','ข้อความใหม่จาก สินชัย ภู่เพชร','ฟหก','chat'::notification_type,'2026-05-29 09:32:10'::timestamptz,true,'{"senderId":"002","receiverId":"3672","room":"002_3672","msgId":"MSG-1780021928102-19765"}'::jsonb),
('NOTI-1780026216869-878EE','056','ข้อความใหม่จาก สินชัย ภู่เพชร','test','chat'::notification_type,'2026-05-29 10:43:36'::timestamptz,false,'{"senderId":"002","receiverId":"056","room":"002_056","msgId":"MSG-1780026214273-40D22"}'::jsonb),
('NOTI-1780028277395-F6B00','056','ข้อความใหม่จาก 002','hi','chat'::notification_type,'2026-05-29 11:17:57'::timestamptz,false,'{"senderId":"002","receiverId":"056","room":"002_056","msgId":"MSG-1780028275659-ABC2F"}'::jsonb),
('NOTI-1780028301602-1CB13','056','ข้อความใหม่จาก 002','hi','chat'::notification_type,'2026-05-29 11:18:21'::timestamptz,false,'{"senderId":"002","receiverId":"056","room":"002_056","msgId":"MSG-1780028299956-F9C4E"}'::jsonb),
('NOTI-1780028512414-5EE58','75','ได้รับแต้ม +1','จาก: Daily Check-in | แต้มรวม 1','point_earn'::notification_type,'2026-05-29 11:21:52'::timestamptz,true,'{"txId":"TX-F57E222A","points":1,"balance":1,"desc":"Daily Check-in"}'::jsonb),
('NOTI-1780028513330-F4FCF','75','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้ | แต้มรวม 1','checkin'::notification_type,'2026-05-29 11:21:53'::timestamptz,true,'{"date":"2026-05-29","points":1,"balance":1,"stamp":"SUCCESS"}'::jsonb),
('NOTI-1780028560143-10147','3672','ข้อความใหม่จาก 75','hi','chat'::notification_type,'2026-05-29 11:22:40'::timestamptz,true,'{"senderId":"75","receiverId":"3672","room":"3672_75","msgId":"MSG-1780028558399-239CE"}'::jsonb),
('NOTI-1780037299918-03F8F','1012','ได้รับแต้ม +1','จาก: Daily Check-in | แต้มรวม 1','point_earn'::notification_type,'2026-05-29 13:48:19'::timestamptz,false,'{"txId":"TX-8CE1B071","points":1,"balance":1,"desc":"Daily Check-in"}'::jsonb),
('NOTI-1780037300829-20DF8','1012','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้ | แต้มรวม 1','checkin'::notification_type,'2026-05-29 13:48:20'::timestamptz,false,'{"date":"2026-05-29","points":1,"balance":1,"stamp":"SUCCESS"}'::jsonb),
('NOTI-1780038212641-587A2','75','ข้อความใหม่จาก 3672','hi','chat'::notification_type,'2026-05-29 14:03:32'::timestamptz,false,'{"senderId":"3672","receiverId":"75","msgId":"MSG-20260529-140332-D94021","source":"contactMessager_log"}'::jsonb),
('NOTI-1782709244212-340A5','3672','ได้รับแต้ม +1','จาก: Daily Check-in | แต้มรวม 5','point_earn'::notification_type,'2026-06-29 12:00:44'::timestamptz,false,'{"txId":"TX-8A81CDFE","points":1,"balance":5,"desc":"Daily Check-in"}'::jsonb),
('NOTI-1782709245445-4BA29','3672','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้ | แต้มรวม 5','checkin'::notification_type,'2026-06-29 12:00:45'::timestamptz,false,'{"date":"2026-06-29","points":1,"balance":5,"stamp":"SUCCESS"}'::jsonb),
('NOTI-1783475751565-17DC1','3672','ได้รับแต้ม +1','จาก: Daily Check-in | แต้มรวม 6','point_earn'::notification_type,'2026-07-08 08:55:51'::timestamptz,false,'{"txId":"TX-C18D5FEF","points":1,"balance":6,"desc":"Daily Check-in"}'::jsonb),
('NOTI-1783475751739-97C12','3672','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้ | แต้มรวม 6','checkin'::notification_type,'2026-07-08 08:55:51'::timestamptz,false,'{"date":"2026-07-08","points":1,"balance":6,"stamp":"SUCCESS"}'::jsonb),
('NOTI-1783560384974-A4951','3672','ได้รับแต้ม +1','จาก: Daily Check-in | แต้มรวม 7','point_earn'::notification_type,'2026-07-09 08:26:24'::timestamptz,false,'{"txId":"TX-ECC227F3","points":1,"balance":7,"desc":"Daily Check-in"}'::jsonb),
('NOTI-1783560385188-1F2D5','3672','เช็คอินสำเร็จ','คุณได้รับ 1 แต้มจากการเช็คอินวันนี้ | แต้มรวม 7','checkin'::notification_type,'2026-07-09 08:26:25'::timestamptz,true,'{"date":"2026-07-09","points":1,"balance":7,"stamp":"SUCCESS"}'::jsonb)
on conflict (notification_id) do nothing;

insert into direct_messages(msg_id, sender_emp_id, receiver_emp_id, content, reply_to_id, sent_at, status, reply_to_content) values
('MSG-1780021825502-9A189','002','3672','สวัสดี',NULL,'2026-05-29 09:30:25'::timestamptz,'sent'::message_status,NULL),
('MSG-1780021928102-19765','002','3672','ฟหก',NULL,'2026-05-29 09:32:08'::timestamptz,'sent'::message_status,NULL),
('MSG-1780026214273-40D22','002','056','test',NULL,'2026-05-29 10:43:34'::timestamptz,'sent'::message_status,NULL),
('MSG-1780028275659-ABC2F','002','056','hi',NULL,'2026-05-29 11:17:55'::timestamptz,'sent'::message_status,NULL),
('MSG-1780028299956-F9C4E','002','056','hi',NULL,'2026-05-29 11:18:19'::timestamptz,'sent'::message_status,NULL),
('MSG-1780028558399-239CE','75','3672','hi',NULL,'2026-05-29 11:22:38'::timestamptz,'read'::message_status,NULL),
('MSG-20260529-140332-D94021','3672','75','hi',NULL,'2026-05-29 14:03:32'::timestamptz,'sent'::message_status,NULL)
on conflict (msg_id) do nothing;

insert into chat_faq(keyword, response) values
('สวัสดี','สวัสดีครับ มีอะไรให้ช่วยไหมครับ?'),
('ติดต่อ','ติดต่อฝ่ายบุคคล โทร 02-xxx-xxxx'),
('ลาป่วย','แจ้งลาป่วยได้ที่เมนู "แจ้งลา" นะครับ'),
('ลงเวลา','ลงเวลาเข้างานกดที่ปุ่มสีเขียวได้เลย'),
('SB INTERLAB MAKE IT CLEAN BEAUTY','บริษัทเอสบี อินเตอร์แลบ จำกัด เป็นผู้ผลิตและจำหน่ายผลิตภัณฑ์ดูแลผิวและเส้นผม นอกจากนี้เรายังให้บริการการผลิตสำหรับลูกค้าที่สนใจในการสร้างแบรนด์ชั้นนำ (OEM) ความพิเศษของเรา ได้แก่ ผลิตภัณฑ์ดูแลเส้นผม ผลิตภัณฑ์ดูแลผิว ผลิตภัณฑ์ดูแลผิวหน้า และผลิตภัณฑ์ดูแลช่องปาก เราให้บริการลูกค้าในประเทศมากกว่า 5,000 รายและลูกค้าต่างประเทศมากกว่า 200 รายใน 40 ประเทศ ด้วยประสบการ์การดำเนินธุรกิจมากว่า 40 ปี

บริษัทยังคงทุ่มเทในการส่งเสริมการเติบโตอย่างยั่งยืนในขณะที่ยังคงรักษาแนวทางปฏิบัติทางธุรกิจที่มีจริยธรรมผู้บริหารและพนักงานทุกคนร่วมทุ่มเทความทุ่มเทนี้ในความรับผิดชอบต่อผู้มีส่วนได้ส่วนได้ส่วนเสียที่แตกต่างกัน ได้แก่ ลูกค้าของเรา พนักงานของเรา พันธมิตรของเรา คู่แข่งทางธุรกิจของเรา ความกังวลทางสังคมและสิ่งแวดล้อม การดำเนินธุรกิจอย่างซื่อสัตย์สูงสุด'),
('วิสัยทัศน์','เอสบีจะสร้างความงามที่มีคุณค่าให้กับผู้คนเพื่อคุณภาพชีวิตที่ดีขึ้น'),
('นโยบายคุณภาพ','เอสบี ผู้นำเครื่องสำอาง ด้านความงามสร้างสรรค์ การเรียนรู้ สู่มาตรฐานสินค้าให้เป็นหนึ่ง คนสิ่งแวดล้อมความปลอดภัยเราคำนึง เพื่อบริหารต้นทุนและบริการส่งมอบที่ลูกค้าเราพึงพอใจ'),
('พันธกิจ','1. เพิ่มประสิทธิภาพของการวิจัยและพัฒนาผลิตภัณฑ์
‍
2. ส่งมอบผลิตภัณฑ์และประสบการณ์ที่ดีเพื่อให้ได้ตามความต้องการของลูกค้า สร้างความพึงพอใจให้ลูกค้า
อย่างต่อเนื่อง‍

3. เพิ่มประสิทธิภาพของกระบวนการผลิต โดยใช้เทคโนโลยี และ ประยุกต์ใช้ความรู้ทางด้านบริหารจัดการ
เพื่อให้ได้สินค้าที่มีคุณภาพและสามารถแข่งขันได้

4. ดำเนินการให้เกิดความยั่งยืน ด้านความปลอดภัยอาชีวอนามัย สิ่งแวดล้อม และสังคม
‍
5. ดำเนินธุรกิจบนพื้นฐานคุณธรรม จริยธรรม มุ่งสู่การทำงานเพื่อสร้างการเติบโตแบบมั่นคง')
on conflict (keyword) do update set response=excluded.response, updated_at=now();


-- Recalculate point summary from imported point_transactions
select recalc_user_points(emp_id) from app_users;

-- FIX: เติม created_at ที่เป็น NULL กลับเป็นเวลาปัจจุบัน แล้วล็อก not null คืน
update app_users set created_at = now() where created_at is null;
alter table app_users alter column created_at set default now();
alter table app_users alter column created_at set not null;

commit;


-- =========================================================
-- 92_post_seed_fixes.sql
-- =========================================================

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

-- สร้าง/เติมรหัสเริ่มต้นเป็นรหัสพนักงาน เฉพาะคนที่ยังไม่มี credential
select public.prepare_first_login_credentials(null);

update user_credentials c
set password_hash = public.sb_hash_password(c.emp_id),
    reset_at = now()
from app_users u
where u.emp_id = c.emp_id
  and u.status = 'active'
  and (coalesce(c.must_change, false) = true or coalesce(u.force_password_change, false) = true);

-- Recalculate point summary from imported point_transactions
select public.recalc_user_points(emp_id) from app_users;


-- =========================================================
-- 94_EMP_ID_FIRST_LOGIN_PASSWORD.sql
-- =========================================================

-- 94_EMP_ID_FIRST_LOGIN_PASSWORD.sql
-- Production patch: first login password must match employee ID.
-- Run this after the base schema/seed on Supabase SQL Editor.

begin;

create or replace function public.prepare_first_login_credentials(p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_count int;
begin
  insert into user_credentials(emp_id, password_hash, must_change, reset_at)
  select u.emp_id, public.sb_hash_password(coalesce(nullif(trim(p_temp_password), ''), u.emp_id)), true, now()
  from app_users u
  left join user_credentials c on c.emp_id = u.emp_id
  where c.emp_id is null and u.status = 'active';

  get diagnostics v_count = row_count;

  update app_users
  set force_password_change = true,
      password_reset_at = coalesce(password_reset_at, now()),
      password_reset_by_emp_id = null,
      updated_at = now()
  where status = 'active'
    and emp_id in (select emp_id from user_credentials where must_change = true);

  return jsonb_build_object('status','success','created_credentials',v_count,'mode','emp_id_initial_password');
end $$;

create or replace function public.admin_reset_user_password(p_token uuid, p_target_emp_id text, p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_actor text; v_temp_password text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  if not exists(select 1 from app_users where emp_id = p_target_emp_id) then
    return jsonb_build_object('status','error','message','Target employee ID not found');
  end if;

  v_temp_password := coalesce(nullif(trim(p_temp_password), ''), p_target_emp_id);

  insert into user_credentials(emp_id, password_hash, must_change, reset_at, reset_by_emp_id)
  values (p_target_emp_id, public.sb_hash_password(v_temp_password), true, now(), v_actor)
  on conflict (emp_id) do update
    set password_hash = excluded.password_hash,
        must_change = true,
        reset_at = now(),
        reset_by_emp_id = v_actor;

  update app_users
  set force_password_change = true,
      password_reset_at = now(),
      password_reset_by_emp_id = v_actor,
      updated_at = now()
  where emp_id = p_target_emp_id;

  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values(v_actor,'RESET_PASSWORD','app_users',p_target_emp_id,jsonb_build_object('must_change',true,'initial_password','emp_id'));

  return jsonb_build_object('status','success','message','Reset password success: temporary password = employee ID');
end $$;

create or replace function public.admin_reset_password(p_token uuid, p_emp_id text, p_temp_password text default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.admin_reset_user_password(p_token, p_emp_id, p_temp_password)
$$;

-- Convert only accounts that are still in first-login/reset mode.
-- People who already changed their password (must_change=false) are left untouched.
update user_credentials c
set password_hash = public.sb_hash_password(c.emp_id),
    reset_at = now()
from app_users u
where u.emp_id = c.emp_id
  and u.status = 'active'
  and (coalesce(c.must_change, false) = true or coalesce(u.force_password_change, false) = true);

update app_users u
set force_password_change = true,
    password_reset_at = coalesce(password_reset_at, now()),
    updated_at = now()
where u.status = 'active'
  and exists (
    select 1
    from user_credentials c
    where c.emp_id = u.emp_id
      and coalesce(c.must_change, false) = true
  );

grant execute on function public.prepare_first_login_credentials(text) to anon, authenticated;
grant execute on function public.admin_reset_user_password(uuid,text,text) to anon, authenticated;
grant execute on function public.admin_reset_password(uuid,text,text) to anon, authenticated;

commit;


-- =========================================================
-- 95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY.sql
-- =========================================================

-- 95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY.sql
-- Production patch for admin/dev accounts, special point adjustment, and overall activity logs.
-- Run in Supabase SQL Editor after current schema patches.

begin;

create table if not exists activity_logs (
  log_id uuid primary key default gen_random_uuid(),
  action_group text not null,
  action text not null,
  actor_emp_id text references app_users(emp_id) on delete set null,
  target_emp_id text references app_users(emp_id) on delete set null,
  target_table text,
  target_id text,
  description text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_group_time on activity_logs(action_group, created_at desc);
create index if not exists idx_activity_logs_actor_time on activity_logs(actor_emp_id, created_at desc);
create index if not exists idx_activity_logs_target_time on activity_logs(target_emp_id, created_at desc);

alter table activity_logs enable row level security;

drop policy if exists "admin read activity logs" on activity_logs;
create policy "admin read activity logs" on activity_logs
for select to authenticated using (is_admin());

create or replace function public.write_activity_log(
  p_action_group text,
  p_action text,
  p_actor_emp_id text default null,
  p_target_emp_id text default null,
  p_target_table text default null,
  p_target_id text default null,
  p_description text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_log_id uuid;
begin
  insert into activity_logs(action_group, action, actor_emp_id, target_emp_id, target_table, target_id, description, before_data, after_data, metadata)
  values (
    coalesce(nullif(trim(p_action_group), ''), 'system'),
    coalesce(nullif(trim(p_action), ''), 'UNKNOWN'),
    nullif(trim(p_actor_emp_id), ''),
    nullif(trim(p_target_emp_id), ''),
    nullif(trim(p_target_table), ''),
    nullif(trim(p_target_id), ''),
    p_description,
    p_before_data,
    p_after_data,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning log_id into v_log_id;
  return v_log_id;
end $$;

create or replace function public.bootstrap_admin_staff_accounts()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare item record;
begin
  for item in
    select * from (values
      ('admin'::text,  'dev'::app_role,   'Developer Owner'),
      ('admin1'::text, 'admin'::app_role, 'HR Admin 1'),
      ('admin2'::text, 'admin'::app_role, 'HR Admin 2'),
      ('admin3'::text, 'admin'::app_role, 'HR Admin 3'),
      ('admin4'::text, 'admin'::app_role, 'HR Admin 4')
    ) as x(emp_id, role_name, display_name)
  loop
    insert into app_users(emp_id, role, name_th, surname_th, nickname_th, dept_th, pos_th, status, force_password_change, password_policy)
    values(item.emp_id, item.role_name, item.display_name, null, item.emp_id, 'Admin', 'Administrator', 'active', true, '8-char-no-thai')
    on conflict(emp_id) do update set
      role = excluded.role,
      name_th = excluded.name_th,
      nickname_th = excluded.nickname_th,
      dept_th = excluded.dept_th,
      pos_th = excluded.pos_th,
      status = 'active',
      force_password_change = true,
      updated_at = now();

    insert into user_credentials(emp_id, password_hash, must_change, reset_at)
    values(item.emp_id, public.sb_hash_password(item.emp_id), true, now())
    on conflict(emp_id) do update set
      password_hash = excluded.password_hash,
      must_change = true,
      reset_at = now(),
      reset_by_emp_id = null;
  end loop;

  update app_users
  set role = 'user', updated_at = now()
  where emp_id in ('ADMIN')
    and role in ('admin', 'admin_it', 'dev');

  perform public.write_activity_log(
    'admin',
    'BOOTSTRAP_ADMIN_STAFF',
    'admin',
    null,
    'app_users',
    'admin,admin1,admin2,admin3,admin4',
    'Bootstrap admin/dev staff accounts with password equal to emp_id and must-change enabled.',
    null,
    jsonb_build_object('admin','dev','admin1','admin','admin2','admin','admin3','admin','admin4','admin')
  );

  return jsonb_build_object('status','success','accounts',jsonb_build_array('admin','admin1','admin2','admin3','admin4'));
end $$;

-- Run `select public.bootstrap_admin_staff_accounts();` manually only when
-- the organization explicitly wants these predictable first-login accounts.

create or replace function public.admin_add_special_points(
  p_token uuid,
  p_confirm_admin_emp_id text,
  p_hr_emp_id text,
  p_target_emp_id text,
  p_points int,
  p_reason text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_points int := greatest(coalesce(p_points, 0), 0);
  v_tx record;
  v_before int;
  v_source_id text;
begin
  if not public_session_is_admin(p_token) then
    return jsonb_build_object('status','error','message','ADMIN_ONLY');
  end if;

  v_actor := public_session_emp_id(p_token);

  if lower(trim(coalesce(p_confirm_admin_emp_id, ''))) <> lower(trim(coalesce(v_actor, ''))) then
    return jsonb_build_object('status','error','message','ADMIN_ID_CONFIRM_MISMATCH');
  end if;

  if v_points <= 0 then
    return jsonb_build_object('status','error','message','POINTS_MUST_BE_POSITIVE');
  end if;

  if v_points > 100000 then
    return jsonb_build_object('status','error','message','POINTS_TOO_LARGE');
  end if;

  if not exists(select 1 from app_users where emp_id = p_hr_emp_id and status = 'active') then
    return jsonb_build_object('status','error','message','HR_EMP_ID_NOT_FOUND');
  end if;

  select points into v_before from app_users where emp_id = p_target_emp_id and status = 'active' for update;
  if not found then
    return jsonb_build_object('status','error','message','TARGET_EMP_ID_NOT_FOUND');
  end if;

  v_source_id := 'SP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  select * into v_tx
  from add_point_transaction(
    p_target_emp_id,
    'adjust',
    v_points,
    coalesce(nullif(trim(p_reason), ''), 'Special points by admin'),
    'SPECIAL_POINTS',
    v_source_id,
    jsonb_build_object(
      'admin_emp_id', v_actor,
      'confirm_admin_emp_id', p_confirm_admin_emp_id,
      'hr_emp_id', p_hr_emp_id,
      'target_emp_id', p_target_emp_id,
      'reason', p_reason
    )
  );

  insert into overall_logs(log_id, employee_id, source_type, source_id, point_before, points_change, point_after, activity_date, activity_time, metadata)
  values (
    v_source_id,
    p_target_emp_id,
    'SPECIAL_POINTS',
    v_tx.tx_id,
    v_before,
    v_points,
    v_tx.balance_after,
    current_date,
    localtime(0),
    jsonb_build_object('admin_emp_id', v_actor, 'hr_emp_id', p_hr_emp_id, 'reason', p_reason, 'tx_id', v_tx.tx_id)
  );

  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'ADD_SPECIAL_POINTS',
    'point_transactions',
    v_tx.tx_id,
    jsonb_build_object('hr_emp_id', p_hr_emp_id, 'target_emp_id', p_target_emp_id, 'points', v_points, 'reason', p_reason, 'balance_after', v_tx.balance_after)
  );

  perform public.write_activity_log(
    'points',
    'ADD_SPECIAL_POINTS',
    v_actor,
    p_target_emp_id,
    'point_transactions',
    v_tx.tx_id,
    coalesce(nullif(trim(p_reason), ''), 'Special points by admin'),
    jsonb_build_object('points', v_before),
    jsonb_build_object('points', v_tx.balance_after, 'change', v_points),
    jsonb_build_object('hr_emp_id', p_hr_emp_id, 'source_id', v_source_id)
  );

  return jsonb_build_object(
    'status','success',
    'tx_id',v_tx.tx_id,
    'source_id',v_source_id,
    'target_emp_id',p_target_emp_id,
    'points_added',v_points,
    'balance_after',v_tx.balance_after
  );
end $$;

create or replace function public.admin_list_special_point_logs(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select
      pt.tx_id as id,
      pt.created_at,
      pt.emp_id as target_emp_id,
      pt.amount as points,
      pt.balance_after,
      pt.description,
      pt.metadata->>'admin_emp_id' as admin_emp_id,
      pt.metadata->>'hr_emp_id' as hr_emp_id,
      pt.source_id
    from point_transactions pt
    where pt.source_type = 'SPECIAL_POINTS'
    order by pt.created_at desc
    limit 500
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_overall_activity(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select
      created_at,
      action_group,
      action,
      actor_emp_id,
      target_emp_id,
      target_table,
      target_id,
      description
    from (
      select created_at, action_group, action, actor_emp_id, target_emp_id, target_table, target_id, description
      from activity_logs
      union all
      select created_at, 'admin', action, actor_emp_id, null, target_table, target_id, coalesce(after_data::text, '')
      from admin_audit_logs
      union all
      select created_at, 'auth', 'LOGIN', emp_id, emp_id, 'public_sessions', session_token::text, 'User login session created'
      from public_sessions
      union all
      select created_at, 'points', coalesce(source_type, tx_type::text), null, emp_id, 'point_transactions', tx_id, description
      from point_transactions
      union all
      select created_at, 'rewards', 'REDEEM', null, emp_id, 'reward_redemptions', redemption_id, reward_name
      from reward_redemptions
      union all
      select created_at, 'activity', 'CHECKIN', null, emp_id, 'checkin_logs', log_id, status
      from checkin_logs
      union all
      select read_at as created_at, 'news', 'READ_NEWS', null, emp_id, 'user_news_reads', news_id, topic
      from user_news_reads
      union all
      select completed_at as created_at, 'missions', 'COMPLETE_MISSION', null, emp_id, 'user_missions', mission_id, status
      from user_missions
    ) unioned
    where created_at is not null
    order by created_at desc
    limit 1000
  ) x),'[]'::jsonb);
end $$;

revoke execute on function public.write_activity_log(text,text,text,text,text,text,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.bootstrap_admin_staff_accounts() from public, anon, authenticated;
grant execute on function public.admin_add_special_points(uuid,text,text,text,int,text) to anon, authenticated;
grant execute on function public.admin_list_special_point_logs(uuid) to anon, authenticated;
grant execute on function public.admin_list_overall_activity(uuid) to anon, authenticated;

commit;


-- =========================================================
-- 13_PRODUCTION_SECURITY_AND_ASSETS.sql
-- =========================================================

-- 13_PRODUCTION_SECURITY_AND_ASSETS.sql
-- Run after 12/90/91/92. Adds production session validation and Drive asset helpers.

create index if not exists idx_public_sessions_emp_active
  on public_sessions(emp_id, expires_at)
  where revoked_at is null;

create index if not exists idx_drive_assets_owner_module
  on drive_assets(owner_emp_id, module, created_at desc);

create index if not exists idx_admin_audit_logs_actor_time
  on admin_audit_logs(actor_emp_id, created_at desc);

create table if not exists login_attempt_logs (
  id bigserial primary key,
  emp_id text,
  success boolean not null default false,
  reason text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table login_attempt_logs enable row level security;

drop policy if exists "admin read login attempts" on login_attempt_logs;
create policy "admin read login attempts" on login_attempt_logs
for select to authenticated using (is_admin());

create or replace function public.validate_public_session(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public_sessions%rowtype;
  u app_users%rowtype;
  v_unread int;
begin
  select *
  into s
  from public_sessions
  where session_token = p_token
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;

  select *
  into u
  from app_users
  where emp_id = s.emp_id
    and status = 'active'
  limit 1;

  if not found then
    update public_sessions set revoked_at = now() where session_token = p_token;
    return jsonb_build_object('status','error','message','USER_DISABLED');
  end if;

  select count(*)
  into v_unread
  from notifications
  where (emp_id = u.emp_id or emp_id is null)
    and is_read = false;

  update app_users
  set presence = 'online',
      updated_at = now()
  where emp_id = u.emp_id;

  return jsonb_build_object(
    'status','success',
    'expiresAt',s.expires_at,
    'user',jsonb_build_object(
      'empId',u.emp_id,
      'emp_id',u.emp_id,
      'role',u.role,
      'email',u.email,
      'name',trim(concat_ws(' ',u.name_th,u.surname_th)),
      'full_name',trim(concat_ws(' ',u.name_th,u.surname_th)),
      'nickname',u.nickname_th,
      'dept',u.dept_th,
      'department',u.dept_th,
      'position',u.pos_th,
      'points',u.points,
      'avatar',u.avatar_url,
      'avatar_url',u.avatar_url,
      'checkInCount',u.check_in_count,
      'lastCheckIn',u.last_check_in,
      'unreadNotifications',coalesce(v_unread,0),
      'mustChangePassword',coalesce(u.force_password_change,false)
    )
  );
end $$;

create or replace function public.public_save_my_avatar(
  p_token uuid,
  p_display_url text,
  p_drive_file_id text default null,
  p_file_name text default null,
  p_mime_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id text;
  v_asset_id uuid;
begin
  v_emp_id := public_session_emp_id(p_token);
  if v_emp_id is null then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;

  if coalesce(trim(p_display_url),'') = '' then
    return jsonb_build_object('status','error','message','IMAGE_URL_REQUIRED');
  end if;

  update app_users
  set avatar_url = p_display_url,
      updated_at = now()
  where emp_id = v_emp_id;

  insert into drive_assets(owner_emp_id, module, ref_table, ref_id, drive_file_id, display_url, mime_type, file_name)
  values(v_emp_id, 'avatar', 'app_users', v_emp_id, p_drive_file_id, p_display_url, p_mime_type, p_file_name)
  returning asset_id into v_asset_id;

  return jsonb_build_object('status','success','assetId',v_asset_id,'avatarUrl',p_display_url);
end $$;

create or replace function public.admin_record_drive_asset(
  p_token uuid,
  p_module text,
  p_ref_table text,
  p_ref_id text,
  p_display_url text,
  p_drive_file_id text default null,
  p_drive_folder_id text default null,
  p_file_name text default null,
  p_mime_type text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
  v_asset_id uuid;
begin
  if not public_session_is_admin(p_token) then
    return jsonb_build_object('status','error','message','ADMIN_ONLY');
  end if;

  v_actor := public_session_emp_id(p_token);

  if coalesce(trim(p_display_url),'') = '' then
    return jsonb_build_object('status','error','message','IMAGE_URL_REQUIRED');
  end if;

  insert into drive_assets(
    owner_emp_id, module, ref_table, ref_id, drive_file_id, drive_folder_id,
    display_url, mime_type, file_name, metadata
  )
  values(
    v_actor, coalesce(nullif(trim(p_module),''),'general'), p_ref_table, p_ref_id,
    p_drive_file_id, p_drive_folder_id, p_display_url, p_mime_type, p_file_name,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning asset_id into v_asset_id;

  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values(v_actor, 'RECORD_DRIVE_ASSET', 'drive_assets', v_asset_id::text,
         jsonb_build_object('module',p_module,'refTable',p_ref_table,'refId',p_ref_id));

  return jsonb_build_object('status','success','assetId',v_asset_id,'displayUrl',p_display_url);
end $$;

grant execute on function public.validate_public_session(uuid) to anon, authenticated;
grant execute on function public.public_save_my_avatar(uuid,text,text,text,text) to anon, authenticated;
grant execute on function public.admin_record_drive_asset(uuid,text,text,text,text,text,text,text,text,jsonb) to anon, authenticated;


-- =========================================================
-- 14_LEGACY_RPC_ALIASES_FOR_REACT_APP.sql
-- =========================================================

-- 14_LEGACY_RPC_ALIASES_FOR_REACT_APP.sql
-- Compatibility RPCs for the React SPA. Run after 13.

create table if not exists calendar_events (
  id bigserial primary key,
  event_date date not null,
  type text not null default 'event',
  label text not null,
  color text not null default '#8b5cf6',
  is_active boolean not null default true,
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_date, type, label)
);

alter table calendar_events add column if not exists color text not null default '#8b5cf6';
alter table calendar_events enable row level security;

drop policy if exists "admin manage calendar events" on calendar_events;
create policy "admin manage calendar events" on calendar_events
for all to authenticated using (is_admin()) with check (is_admin());

create table if not exists rule_board_posts (
  id bigserial primary key,
  category text not null default 'policy',
  title text not null,
  body_html text not null default '',
  color text not null default '#8b5cf6',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table rule_board_posts enable row level security;

drop policy if exists "read active rule board posts" on rule_board_posts;
create policy "read active rule board posts" on rule_board_posts
for select to anon, authenticated using (is_active = true);

drop policy if exists "admin manage rule board posts" on rule_board_posts;
create policy "admin manage rule board posts" on rule_board_posts
for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.get_home_dashboard(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  v_user jsonb;
begin
  p := public.get_home_payload(p_token);
  if p->>'status' = 'error' then return p; end if;
  v_user := coalesce(p->'user','{}'::jsonb);

  return p || jsonb_build_object(
    'points',coalesce((v_user->>'points')::int,0),
    'checkin_count',coalesce((v_user->>'checkInCount')::int,0),
    'last_checkin',v_user->>'lastCheckIn',
    'latest_news',coalesce(p->'news','[]'::jsonb),
    'top_ranking',coalesce(p->'ranking','[]'::jsonb)
  );
end $$;

create or replace function public.get_my_profile(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.validate_public_session(p_token)->'user'
$$;

create or replace function public.daily_checkin(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.public_checkin(p_token)
$$;

create or replace function public.list_news(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((public.public_page_payload(p_token, 'news'))->'items','[]'::jsonb);
end $$;

create or replace function public.list_missions(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((public.public_page_payload(p_token, 'mission'))->'items','[]'::jsonb);
end $$;

create or replace function public.list_rewards(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((public.public_page_payload(p_token, 'rewards'))->'items','[]'::jsonb);
end $$;

create or replace function public.list_ranking(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((public.public_page_payload(p_token, 'ranking'))->'items','[]'::jsonb);
end $$;

create or replace function public.list_my_overall_logs(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((public.public_page_payload(p_token, 'overall_log'))->'items','[]'::jsonb);
end $$;

create or replace function public.read_news(p_token uuid, p_news_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.public_read_news(p_token, p_news_id)
$$;

create or replace function public.submit_mission(p_token uuid, p_mission_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.public_complete_mission(p_token, p_mission_id, null)
$$;

create or replace function public.redeem_reward(p_token uuid, p_reward_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.public_redeem_reward(p_token, p_reward_id)
$$;

create or replace function public.list_notifications(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', x.notification_id,
        'notification_id', x.notification_id,
        'title', x.title,
        'detail', x.message,
        'message', x.message,
        'type', x.type,
        'is_read', x.is_read,
        'created_at', x.created_at
      )
    )
    from jsonb_to_recordset(coalesce((public.public_list_notifications(p_token))->'items','[]'::jsonb))
      as x(notification_id text, title text, message text, type text, is_read boolean, created_at timestamptz)
  ), '[]'::jsonb);
end $$;

create or replace function public.mark_notification_read(p_token uuid, p_notification_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.public_mark_notification_read(p_token, p_notification_id)
$$;

create or replace function public.get_admin_dashboard(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  k jsonb;
begin
  p := public.admin_dashboard_payload(p_token);
  if p->>'status' = 'error' then return p; end if;
  k := coalesce(p->'kpi','{}'::jsonb);
  return p || jsonb_build_object(
    'total_users',coalesce((k->>'users')::int,0),
    'total_news',(select count(*) from news_posts),
    'total_missions',(select count(*) from missions),
    'total_rewards',(select count(*) from rewards),
    'users',coalesce(p->'recentUsers','[]'::jsonb),
    'logs',coalesce(p->'recentLogs','[]'::jsonb),
    'ranking',coalesce(p->'topUsers','[]'::jsonb)
  );
end $$;

create or replace function public.admin_list_users(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select emp_id,
           trim(concat_ws(' ',name_th,surname_th)) as full_name,
           dept_th as department,
           role,
           status,
           points
    from app_users
    order by emp_id
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_news(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select news_id as id, news_id, topic, detail, points, image_url,
           status = 'active' as is_active, publish_date, created_at
    from news_posts order by created_at desc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_missions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select mission_id as id, mission_id, title, description, points, image_url,
           status = 'active' as is_active, created_at
    from missions order by created_at desc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_rewards(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select reward_id as id, reward_id, name, detail, points_required, stock, image_url,
           status = 'active' as is_active, created_at
    from rewards order by created_at desc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_ledger(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select tx_id as id, tx_id, emp_id, amount, tx_type, source_type, description, balance_after, created_at
    from point_transactions order by created_at desc limit 500
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_manager_depts(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id, manager_emp_id, dept_th as department_id, dept_th as department_name, true as is_active, updated_at
    from manager_department_permissions order by updated_at desc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_upsert_user(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.admin_save_user_simple(
    p_token,
    p_payload->>'emp_id',
    p_payload->>'full_name',
    null,
    p_payload->>'department',
    null,
    coalesce(nullif(p_payload->>'role',''),'user')::app_role,
    case when upper(coalesce(p_payload->>'status','active')) = 'INACTIVE' then 'inactive'::user_status else 'active'::user_status end
  );
end $$;

create or replace function public.admin_upsert_news(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.admin_save_news(
    p_token,
    p_payload->>'id',
    coalesce(p_payload->>'topic', p_payload->>'title'),
    p_payload->>'detail',
    coalesce((p_payload->>'points')::int,0),
    nullif(p_payload->>'image_url',''),
    case when coalesce((p_payload->>'is_active')::boolean,true) then 'active'::content_status else 'inactive'::content_status end
  );
end $$;

create or replace function public.admin_upsert_mission(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.admin_save_mission(
    p_token,
    p_payload->>'id',
    coalesce(p_payload->>'title', p_payload->>'topic'),
    p_payload->>'description',
    coalesce((p_payload->>'points')::int,0),
    nullif(p_payload->>'image_url',''),
    case when coalesce((p_payload->>'is_active')::boolean,true) then 'active'::content_status else 'inactive'::content_status end
  );
end $$;

create or replace function public.admin_upsert_reward(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.admin_save_reward(
    p_token,
    p_payload->>'id',
    coalesce(p_payload->>'name', p_payload->>'title'),
    p_payload->>'detail',
    coalesce((p_payload->>'points_required')::int,0),
    coalesce((p_payload->>'stock')::int,0),
    nullif(p_payload->>'image_url',''),
    case when coalesce((p_payload->>'is_active')::boolean,true) then 'active'::content_status else 'inactive'::content_status end
  );
end $$;

create or replace function public.admin_upsert_manager_dept(p_token uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public as $$
  select public.admin_save_manager_dept(p_token, p_payload->>'manager_emp_id', coalesce(p_payload->>'department_name', p_payload->>'department_id'))
$$;

create or replace function public.admin_save_manager_depts_batch(p_token uuid, p_mappings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  item jsonb;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);

  delete from manager_department_permissions;
  for item in select * from jsonb_array_elements(coalesce(p_mappings,'[]'::jsonb)) loop
    if coalesce(item->>'manager_emp_id','') <> '' and coalesce(item->>'department_name', item->>'department_id','') <> '' then
      insert into manager_department_permissions(manager_emp_id, dept_th, updated_by_emp_id)
      values(item->>'manager_emp_id', coalesce(item->>'department_name', item->>'department_id'), v_actor)
      on conflict(manager_emp_id, dept_th) do update set updated_by_emp_id = excluded.updated_by_emp_id, updated_at = now();
    end if;
  end loop;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_delete_user(p_token uuid, p_emp_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  update app_users set status = 'inactive', updated_at = now() where emp_id = p_emp_id;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_delete_news(p_token uuid, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  update news_posts set status = 'archived', updated_at = now() where news_id = p_id;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_delete_mission(p_token uuid, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  update missions set status = 'archived', updated_at = now() where mission_id = p_id;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_delete_reward(p_token uuid, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  update rewards set status = 'archived', updated_at = now() where reward_id = p_id;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_reset_password(p_token uuid, p_emp_id text, p_temp_password text default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.admin_reset_user_password(p_token, p_emp_id, p_temp_password)
$$;

create or replace function public.list_calendar_events(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public_session_emp_id(p_token) is null then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id, event_date as date, type, label, color, is_active, created_by_emp_id as created_by
    from calendar_events
    where is_active = true
    order by event_date desc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_calendar_events(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id, event_date as date, type, label, color, is_active, created_by_emp_id as created_by
    from calendar_events
    order by event_date desc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_upsert_calendar_event(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_id bigint;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  v_id := nullif(p_payload->>'id','')::bigint;

  if v_id is null then
    insert into calendar_events(event_date, type, label, color, is_active, created_by_emp_id)
    values(
      (p_payload->>'date')::date,
      coalesce(p_payload->>'type','event'),
      coalesce(p_payload->>'label','Event'),
      coalesce(p_payload->>'color','#8b5cf6'),
      coalesce((p_payload->>'is_active')::boolean,true),
      v_actor
    );
  else
    update calendar_events
    set event_date = (p_payload->>'date')::date,
        type = coalesce(p_payload->>'type', type),
        label = coalesce(p_payload->>'label', label),
        color = coalesce(p_payload->>'color', color),
        is_active = coalesce((p_payload->>'is_active')::boolean, is_active),
        updated_at = now()
    where id = v_id;
  end if;

  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_delete_calendar_event(p_token uuid, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  delete from calendar_events where id = p_id;
  return jsonb_build_object('status','success');
end $$;

create or replace function public.list_rule_board(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public_session_emp_id(p_token) is null then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id, category, title, body_html, color, sort_order, is_active, updated_at
    from rule_board_posts
    where is_active = true
    order by sort_order asc, id asc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_list_rule_board(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id, category, title, body_html, color, sort_order, is_active, created_by_emp_id as created_by, created_at, updated_at
    from rule_board_posts
    order by sort_order asc, id asc
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_upsert_rule_board(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_id bigint;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  v_id := nullif(p_payload->>'id','')::bigint;

  if v_id is null then
    insert into rule_board_posts(category, title, body_html, color, sort_order, is_active, created_by_emp_id)
    values(
      coalesce(p_payload->>'category','policy'),
      coalesce(p_payload->>'title','Untitled'),
      coalesce(p_payload->>'body_html',''),
      coalesce(p_payload->>'color','#8b5cf6'),
      coalesce(nullif(p_payload->>'sort_order','')::int,0),
      coalesce((p_payload->>'is_active')::boolean,true),
      v_actor
    );
  else
    update rule_board_posts
    set category = coalesce(p_payload->>'category', category),
        title = coalesce(p_payload->>'title', title),
        body_html = coalesce(p_payload->>'body_html', body_html),
        color = coalesce(p_payload->>'color', color),
        sort_order = coalesce(nullif(p_payload->>'sort_order','')::int, sort_order),
        is_active = coalesce((p_payload->>'is_active')::boolean, is_active),
        updated_at = now()
    where id = v_id;
  end if;

  return jsonb_build_object('status','success');
end $$;

create or replace function public.admin_delete_rule_board(p_token uuid, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  delete from rule_board_posts where id = p_id;
  return jsonb_build_object('status','success');
end $$;

grant execute on function public.get_home_dashboard(uuid) to anon, authenticated;
grant execute on function public.get_my_profile(uuid) to anon, authenticated;
grant execute on function public.daily_checkin(uuid) to anon, authenticated;
grant execute on function public.list_news(uuid) to anon, authenticated;
grant execute on function public.list_missions(uuid) to anon, authenticated;
grant execute on function public.list_rewards(uuid) to anon, authenticated;
grant execute on function public.list_ranking(uuid) to anon, authenticated;
grant execute on function public.list_my_overall_logs(uuid) to anon, authenticated;
grant execute on function public.read_news(uuid,text) to anon, authenticated;
grant execute on function public.submit_mission(uuid,text) to anon, authenticated;
grant execute on function public.redeem_reward(uuid,text) to anon, authenticated;
grant execute on function public.list_notifications(uuid) to anon, authenticated;
grant execute on function public.mark_notification_read(uuid,text) to anon, authenticated;
grant execute on function public.get_admin_dashboard(uuid) to anon, authenticated;
grant execute on function public.admin_list_users(uuid) to anon, authenticated;
grant execute on function public.admin_list_news(uuid) to anon, authenticated;
grant execute on function public.admin_list_missions(uuid) to anon, authenticated;
grant execute on function public.admin_list_rewards(uuid) to anon, authenticated;
grant execute on function public.admin_list_ledger(uuid) to anon, authenticated;
grant execute on function public.admin_list_manager_depts(uuid) to anon, authenticated;
grant execute on function public.admin_upsert_user(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_upsert_news(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_upsert_mission(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_upsert_reward(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_upsert_manager_dept(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_save_manager_depts_batch(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_delete_user(uuid,text) to anon, authenticated;
grant execute on function public.admin_delete_news(uuid,text) to anon, authenticated;
grant execute on function public.admin_delete_mission(uuid,text) to anon, authenticated;
grant execute on function public.admin_delete_reward(uuid,text) to anon, authenticated;
grant execute on function public.admin_reset_password(uuid,text,text) to anon, authenticated;
grant execute on function public.list_calendar_events(uuid) to anon, authenticated;
grant execute on function public.admin_list_calendar_events(uuid) to anon, authenticated;
grant execute on function public.admin_upsert_calendar_event(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_delete_calendar_event(uuid,bigint) to anon, authenticated;
grant execute on function public.list_rule_board(uuid) to anon, authenticated;
grant execute on function public.admin_list_rule_board(uuid) to anon, authenticated;
grant execute on function public.admin_upsert_rule_board(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_delete_rule_board(uuid,bigint) to anon, authenticated;


-- =========================================================
-- 15_QUOTATION_SUPABASE_SCHEMA.sql
-- =========================================================

-- 15_QUOTATION_SUPABASE_SCHEMA.sql
-- Production quotation index/analysis schema.
--
-- Google Drive remains the binary-file source of truth.  This schema stores
-- searchable quotation data, calculations, Drive references, and a complete
-- normalized payload for reconciliation.  The browser must never write these
-- tables directly: Google Apps Script validates the public session and calls
-- the service-role-only sync RPC below.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.quotations (
  quotation_id text primary key,
  quotation_no text not null unique,
  client_request_id text,
  project_name text not null default '',
  revision bigint not null default 0,
  -- Kept as text for compatibility with the legacy Drive payload (max 100
  -- characters). New UI values remain ISO YYYY-MM-DD.
  quotation_date text not null default (current_date::text),
  status text not null default 'DRAFT',
  currency text not null default 'THB',

  -- Customer values are snapshots.  They intentionally do not reference a
  -- mutable customer master because a historical quotation must not change.
  customer_id text,
  customer_code text,
  customer_name text not null default '',
  customer_company text not null default '',
  customer_branch text not null default '',
  customer_address text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  customer_tax_id text not null default '',
  customer_contact_person text not null default '',
  customer_note text not null default '',

  quotation_note text not null default '',
  validity_days integer not null default 30,
  payment_terms text not null default '',
  delivery_terms text not null default '',

  vat_percent numeric(7,4) not null default 7,
  subtotal numeric(38,2) not null default 0,
  vat_amount numeric(38,2) not null default 0,
  grand_total numeric(38,2) not null default 0,
  total_proposed_cost numeric(38,2) not null default 0,
  total_item_cost numeric(38,2) not null default 0,
  total_cost numeric(38,2) not null default 0,
  cost_basis text not null default 'ITEM_UNIT_COST',
  gross_profit numeric(38,2) not null default 0,
  gp_percent numeric(38,4) not null default 0,

  report_version bigint not null default 1,
  drive_folder_id text,
  pdf_file_id text,
  pdf_url text,
  xlsx_file_id text,
  xlsx_url text,

  -- source_version is monotonic per quotation. source_hash is computed by the
  -- database from payload_json and detects same-version/different-data writes.
  source_version bigint not null default 1,
  source_hash text not null,
  payload_json jsonb not null default '{}'::jsonb,
  source_created_at timestamptz,
  source_updated_at timestamptz not null,
  last_synced_at timestamptz not null default now(),

  created_by_emp_id text not null references public.app_users(emp_id) on delete restrict,
  created_by_name text not null default '',
  updated_by_emp_id text references public.app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint quotations_id_not_blank check (length(btrim(quotation_id)) between 1 and 100),
  constraint quotations_no_not_blank check (length(btrim(quotation_no)) between 1 and 100),
  constraint quotations_revision_valid check (revision >= 0),
  constraint quotations_date_valid check (length(btrim(quotation_date)) between 1 and 100),
  constraint quotations_status_valid check (
    status in ('DRAFT','PENDING','SENT','APPROVED','REJECTED','CANCELLED','EXPIRED')
  ),
  constraint quotations_currency_valid check (currency ~ '^[A-Z]{3}$'),
  constraint quotations_validity_days_valid check (validity_days between 0 and 3650),
  constraint quotations_vat_valid check (vat_percent between 0 and 100),
  constraint quotations_amounts_nonnegative check (
    subtotal >= 0 and vat_amount >= 0 and grand_total >= 0
    and total_proposed_cost >= 0 and total_item_cost >= 0 and total_cost >= 0
  ),
  constraint quotations_cost_basis_valid check (cost_basis in ('ITEM_UNIT_COST','SB_COST_NOTES')),
  constraint quotations_report_version_valid check (report_version >= 1),
  constraint quotations_source_version_valid check (source_version >= 1),
  constraint quotations_source_hash_valid check (source_hash ~ '^[0-9a-f]{32}$'),
  constraint quotations_payload_object check (jsonb_typeof(payload_json) = 'object')
);

create table if not exists public.quotation_items (
  id bigint generated by default as identity primary key,
  quotation_id text not null references public.quotations(quotation_id) on delete cascade,
  source_item_id text,
  item_no integer not null,
  product_id text,
  product_ref text not null default '',
  product_name text not null default '',
  description text not null default '',
  unit text not null default '',
  quantity numeric(38,4) not null default 0,
  unit_price numeric(38,4) not null default 0,
  amount numeric(38,2) not null default 0,
  unit_cost numeric(38,4) not null default 0,
  cost_amount numeric(38,2) not null default 0,
  remark text not null default '',
  picture_file_id text,
  picture_url text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_items_line_unique unique (quotation_id, item_no),
  constraint quotation_items_number_valid check (item_no between 1 and 200),
  constraint quotation_items_amounts_valid check (
    quantity >= 0 and unit_price >= 0 and amount >= 0 and unit_cost >= 0 and cost_amount >= 0
  ),
  constraint quotation_items_payload_object check (jsonb_typeof(payload_json) = 'object')
);

create table if not exists public.quotation_cost_notes (
  id bigint generated by default as identity primary key,
  quotation_id text not null references public.quotations(quotation_id) on delete cascade,
  source_cost_note_id text,
  note_no integer not null,
  description text not null default '',
  proposed_cost numeric(38,2) not null default 0,
  sb_cost numeric(38,2) not null default 0,
  gp_percent numeric(38,4) not null default 0,
  note text not null default '',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_cost_notes_line_unique unique (quotation_id, note_no),
  constraint quotation_cost_notes_number_valid check (note_no between 1 and 100),
  constraint quotation_cost_notes_amounts_valid check (proposed_cost >= 0 and sb_cost >= 0),
  constraint quotation_cost_notes_payload_object check (jsonb_typeof(payload_json) = 'object')
);

create table if not exists public.quotation_files (
  id bigint generated by default as identity primary key,
  quotation_id text not null references public.quotations(quotation_id) on delete cascade,
  drive_file_id text not null,
  file_kind text not null,
  file_name text not null default '',
  mime_type text not null default '',
  bucket text not null default '',
  view_url text not null default '',
  direct_url text not null default '',
  registry_source text not null default '',
  report_version bigint,
  is_current boolean not null default true,
  uploaded_by_emp_id text references public.app_users(emp_id) on delete set null,
  source_created_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_files_source_unique unique (quotation_id, drive_file_id, file_kind),
  constraint quotation_files_id_not_blank check (length(btrim(drive_file_id)) between 1 and 300),
  constraint quotation_files_kind_not_blank check (length(btrim(file_kind)) between 1 and 100),
  constraint quotation_files_report_version_valid check (report_version is null or report_version >= 1),
  constraint quotation_files_payload_object check (jsonb_typeof(payload_json) = 'object')
);

-- Type normalization makes this migration safe to rerun over an earlier draft
-- of the quotation schema without dropping data.
alter table public.quotations alter column quotation_date drop default;
alter table public.quotations alter column quotation_date type text using quotation_date::text;
alter table public.quotations alter column quotation_date set default (current_date::text);
alter table public.quotations alter column revision type bigint using revision::bigint;
alter table public.quotations alter column report_version type bigint using report_version::bigint;
alter table public.quotations alter column subtotal type numeric(38,2) using subtotal::numeric(38,2);
alter table public.quotations alter column vat_amount type numeric(38,2) using vat_amount::numeric(38,2);
alter table public.quotations alter column grand_total type numeric(38,2) using grand_total::numeric(38,2);
alter table public.quotations alter column total_proposed_cost type numeric(38,2) using total_proposed_cost::numeric(38,2);
alter table public.quotations alter column total_item_cost type numeric(38,2) using total_item_cost::numeric(38,2);
alter table public.quotations alter column total_cost type numeric(38,2) using total_cost::numeric(38,2);
alter table public.quotations alter column gross_profit type numeric(38,2) using gross_profit::numeric(38,2);
alter table public.quotations alter column gp_percent type numeric(38,4) using gp_percent::numeric(38,4);
alter table public.quotation_items alter column quantity type numeric(38,4) using quantity::numeric(38,4);
alter table public.quotation_items alter column unit_price type numeric(38,4) using unit_price::numeric(38,4);
alter table public.quotation_items alter column amount type numeric(38,2) using amount::numeric(38,2);
alter table public.quotation_items alter column unit_cost type numeric(38,4) using unit_cost::numeric(38,4);
alter table public.quotation_items alter column cost_amount type numeric(38,2) using cost_amount::numeric(38,2);
alter table public.quotation_cost_notes alter column proposed_cost type numeric(38,2) using proposed_cost::numeric(38,2);
alter table public.quotation_cost_notes alter column sb_cost type numeric(38,2) using sb_cost::numeric(38,2);
alter table public.quotation_cost_notes alter column gp_percent type numeric(38,4) using gp_percent::numeric(38,4);
alter table public.quotation_files alter column report_version type bigint using report_version::bigint;

do $$ begin
  alter table public.quotations
    add constraint quotations_date_valid
    check (length(btrim(quotation_date)) between 1 and 100);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create unique index if not exists uq_quotations_owner_client_request
  on public.quotations(created_by_emp_id, client_request_id)
  where client_request_id is not null and btrim(client_request_id) <> '';

create index if not exists idx_quotations_owner_updated
  on public.quotations(created_by_emp_id, updated_at desc);
create index if not exists idx_quotations_status_date
  on public.quotations(status, quotation_date desc);
create index if not exists idx_quotations_customer_name
  on public.quotations(lower(customer_name));
create index if not exists idx_quotations_customer_company
  on public.quotations(lower(customer_company));
create index if not exists idx_quotations_source_sync
  on public.quotations(source_updated_at desc, last_synced_at desc);
create index if not exists idx_quotation_items_parent
  on public.quotation_items(quotation_id, item_no);
create index if not exists idx_quotation_cost_notes_parent
  on public.quotation_cost_notes(quotation_id, note_no);
create index if not exists idx_quotation_files_parent_kind
  on public.quotation_files(quotation_id, file_kind, is_current);
create index if not exists idx_quotation_files_drive_id
  on public.quotation_files(drive_file_id);

-- Reuse the project's canonical updated_at trigger function.
drop trigger if exists trg_quotations_updated_at on public.quotations;
create trigger trg_quotations_updated_at
before update on public.quotations
for each row execute function public.set_updated_at();

drop trigger if exists trg_quotation_items_updated_at on public.quotation_items;
create trigger trg_quotation_items_updated_at
before update on public.quotation_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_quotation_cost_notes_updated_at on public.quotation_cost_notes;
create trigger trg_quotation_cost_notes_updated_at
before update on public.quotation_cost_notes
for each row execute function public.set_updated_at();

drop trigger if exists trg_quotation_files_updated_at on public.quotation_files;
create trigger trg_quotation_files_updated_at
before update on public.quotation_files
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private parsing helpers used by the service-role sync RPC
-- ---------------------------------------------------------------------------

create or replace function public.quotation_safe_numeric(p_value text, p_default numeric default 0)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or btrim(p_value) = '' then return p_default; end if;
  return p_value::numeric;
exception when invalid_text_representation or numeric_value_out_of_range then
  return p_default;
end $$;

create or replace function public.quotation_safe_integer(p_value text, p_default integer default 0)
returns integer
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or btrim(p_value) = '' then return p_default; end if;
  return trunc(p_value::numeric)::integer;
exception when invalid_text_representation or numeric_value_out_of_range then
  return p_default;
end $$;

create or replace function public.quotation_safe_bigint(p_value text, p_default bigint default 0)
returns bigint
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or btrim(p_value) = '' then return p_default; end if;
  return trunc(p_value::numeric)::bigint;
exception when invalid_text_representation or numeric_value_out_of_range then
  return p_default;
end $$;

create or replace function public.quotation_safe_date(p_value text, p_default date default current_date)
returns date
language plpgsql
stable
set search_path = public
as $$
begin
  if p_value is null or btrim(p_value) = '' then return p_default; end if;
  return p_value::date;
exception when invalid_datetime_format or datetime_field_overflow then
  return p_default;
end $$;

create or replace function public.quotation_safe_timestamptz(p_value text, p_default timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
begin
  if p_value is null or btrim(p_value) = '' then return p_default; end if;
  return p_value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow then
  return p_default;
end $$;

-- ---------------------------------------------------------------------------
-- Service-role session validation
-- ---------------------------------------------------------------------------

create or replace function public.validate_quotation_session_for_service(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_emp_id text;
  v_role public.app_role;
  v_expires_at timestamptz;
begin
  select u.emp_id, u.role, s.expires_at
    into v_emp_id, v_role, v_expires_at
  from public.public_sessions s
  join public.app_users u on u.emp_id = s.emp_id
  where s.session_token = p_token
    and s.revoked_at is null
    and s.expires_at > now()
    and u.status = 'active'
  limit 1;

  if not found then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;

  return jsonb_build_object(
    'status','success',
    'emp_id',v_emp_id,
    'role',lower(v_role::text),
    'expires_at',v_expires_at
  );
end $$;

-- ---------------------------------------------------------------------------
-- Atomic Drive -> Supabase synchronization
-- ---------------------------------------------------------------------------

create or replace function public.quotation_sync_from_drive_core(
  p_token uuid,
  p_quotation jsonb,
  p_reconcile boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_record jsonb;
  v_payload jsonb;
  v_items jsonb;
  v_cost_notes jsonb;
  v_files jsonb;
  v_item jsonb;
  v_cost_note jsonb;
  v_file jsonb;
  v_ordinality bigint;
  v_emp_id text;
  v_owner_emp_id text;
  v_updated_by_emp_id text;
  v_role public.app_role;
  v_id text;
  v_no text;
  v_status text;
  v_source_version bigint;
  v_source_hash text;
  v_existing public.quotations%rowtype;
  v_now timestamptz := now();
  v_subtotal numeric(38,2);
  v_vat_percent numeric(7,4);
  v_vat_amount numeric(38,2);
  v_grand_total numeric(38,2);
  v_total_proposed_cost numeric(38,2);
  v_total_item_cost numeric(38,2);
  v_total_cost numeric(38,2);
  v_gross_profit numeric(38,2);
  v_gp_percent numeric(38,4);
  v_has_sb_cost boolean;
begin
  if p_quotation is null or jsonb_typeof(p_quotation) <> 'object' then
    return jsonb_build_object('status','error','message','INVALID_QUOTATION_ENVELOPE');
  end if;

  if p_reconcile and p_token is not null then
    return jsonb_build_object('status','error','message','RECONCILIATION_TOKEN_MUST_BE_NULL');
  end if;
  if not p_reconcile and p_token is null then
    return jsonb_build_object('status','error','message','SESSION_TOKEN_REQUIRED');
  end if;

  v_record := case
    when jsonb_typeof(p_quotation->'record') = 'object' then p_quotation->'record'
    else p_quotation
  end;
  v_payload := case
    when jsonb_typeof(p_quotation->'payload_json') = 'object' then p_quotation->'payload_json'
    when jsonb_typeof(v_record->'payload_json') = 'object' then v_record->'payload_json'
    else v_record
  end;
  v_items := case
    when jsonb_typeof(p_quotation->'items') = 'array' then p_quotation->'items'
    when jsonb_typeof(v_payload->'items') = 'array' then v_payload->'items'
    when jsonb_typeof(v_payload->'quotation_items') = 'array' then v_payload->'quotation_items'
    else '[]'::jsonb
  end;
  v_cost_notes := case
    when jsonb_typeof(p_quotation->'cost_notes') = 'array' then p_quotation->'cost_notes'
    when jsonb_typeof(v_payload->'costNotes') = 'array' then v_payload->'costNotes'
    when jsonb_typeof(v_payload->'cost_notes') = 'array' then v_payload->'cost_notes'
    else '[]'::jsonb
  end;
  v_files := case
    when jsonb_typeof(p_quotation->'files') = 'array' then p_quotation->'files'
    when jsonb_typeof(v_payload->'files') = 'array' then v_payload->'files'
    else '[]'::jsonb
  end;

  if jsonb_array_length(v_items) > 200 then
    return jsonb_build_object('status','error','message','TOO_MANY_QUOTATION_ITEMS');
  end if;
  if jsonb_array_length(v_cost_notes) > 100 then
    return jsonb_build_object('status','error','message','TOO_MANY_QUOTATION_COST_NOTES');
  end if;
  -- Apps Script can retain 250 trusted uploads plus generated PDF/XLSX refs.
  if jsonb_array_length(v_files) > 300 then
    return jsonb_build_object('status','error','message','TOO_MANY_QUOTATION_FILES');
  end if;

  v_id := btrim(coalesce(v_record->>'quotation_id', v_record->>'quotationId', v_record->>'id', ''));
  v_no := btrim(coalesce(v_record->>'quotation_no', v_record->>'quotationNo', ''));
  v_status := upper(btrim(coalesce(v_record->>'status', 'DRAFT')));
  v_source_version := public.quotation_safe_bigint(
    coalesce(v_record->>'source_version', v_record->>'sourceVersion',
             v_record->>'report_version', v_record->>'reportVersion'), 1
  );
  v_source_hash := md5(jsonb_build_object(
    'record', v_record - 'source_hash' - 'sourceHash',
    'payload_json', v_payload,
    'items', v_items,
    'cost_notes', v_cost_notes,
    'files', v_files
  )::text);

  -- Immediate writes carry the original public-session token. A NULL token is
  -- reserved for the service-role-only time-trigger reconciliation job; that
  -- path preserves the stored owner (or uses the authoritative Drive owner on
  -- first import). Browser roles cannot execute this function.
  if not p_reconcile then
    select u.emp_id, u.role
      into v_emp_id, v_role
    from public.public_sessions s
    join public.app_users u on u.emp_id = s.emp_id
    where s.session_token = p_token
      and s.revoked_at is null
      and s.expires_at > v_now
      and u.status = 'active'
    limit 1;

    if not found then
      return jsonb_build_object('status','error','message','SESSION_EXPIRED');
    end if;
  end if;

  if v_id = '' or length(v_id) > 100 then
    return jsonb_build_object('status','error','message','INVALID_QUOTATION_ID');
  end if;
  if v_no = '' or length(v_no) > 100 then
    return jsonb_build_object('status','error','message','INVALID_QUOTATION_NO');
  end if;
  if v_status not in ('DRAFT','PENDING','SENT','APPROVED','REJECTED','CANCELLED','EXPIRED') then
    return jsonb_build_object('status','error','message','INVALID_QUOTATION_STATUS');
  end if;
  if v_source_version < 1 then
    return jsonb_build_object('status','error','message','INVALID_SOURCE_VERSION');
  end if;

  -- Serialize concurrent retries for the same source identity and number.
  perform pg_advisory_xact_lock(hashtextextended('quotation-id:' || v_id, 0));
  perform pg_advisory_xact_lock(hashtextextended('quotation-no:' || v_no, 0));

  select * into v_existing
  from public.quotations
  where quotation_id = v_id
  for update;

  if found then
    if not p_reconcile
       and v_existing.created_by_emp_id <> v_emp_id
       and v_role not in ('manager','admin','admin_it','dev') then
      return jsonb_build_object('status','error','message','QUOTATION_ACCESS_DENIED');
    end if;

    if v_source_version < v_existing.source_version then
      return jsonb_build_object(
        'status','success','action','stale_noop','stale',true,
        'quotation_id',v_id,'quotation_no',v_existing.quotation_no,
        'source_version',v_existing.source_version,'source_hash',v_existing.source_hash,
        'synced_at',v_existing.last_synced_at
      );
    end if;

    if v_source_version = v_existing.source_version then
      if v_source_hash = v_existing.source_hash then
        return jsonb_build_object(
          'status','success','action','idempotent_noop','idempotent',true,
          'quotation_id',v_id,'quotation_no',v_existing.quotation_no,
          'source_version',v_existing.source_version,'source_hash',v_existing.source_hash,
          'synced_at',v_existing.last_synced_at
        );
      end if;
      return jsonb_build_object(
        'status','error','message','VERSION_COLLISION',
        'quotation_id',v_id,'stored_version',v_existing.source_version,
        'incoming_version',v_source_version
      );
    end if;
  else
    if exists(select 1 from public.quotations q where q.quotation_no = v_no) then
      return jsonb_build_object('status','error','message','QUOTATION_NO_CONFLICT');
    end if;
  end if;

  if not p_reconcile then
    -- User-initiated writes derive ownership and updater identity from the live
    -- database session. On the first SQL mirror of a legacy Drive row, a
    -- manager may preserve its canonical owner, but only if that employee
    -- exists; ordinary users can never assign ownership to somebody else.
    if v_existing.created_by_emp_id is not null then
      v_owner_emp_id := v_existing.created_by_emp_id;
    else
      v_owner_emp_id := nullif(btrim(coalesce(
        v_record->>'created_by_emp_id', v_record->>'createdByEmpId', ''
      )), '');
      if v_owner_emp_id is null then
        v_owner_emp_id := v_emp_id;
      elsif v_owner_emp_id <> v_emp_id then
        if v_role not in ('manager','admin','admin_it','dev')
           or not exists(select 1 from public.app_users u where u.emp_id = v_owner_emp_id) then
          return jsonb_build_object('status','error','message','QUOTATION_OWNER_MISMATCH');
        end if;
      end if;
    end if;
    v_updated_by_emp_id := v_emp_id;
  else
    -- Background reconciliation runs only through service_role. Existing
    -- ownership is immutable; a first import must name a real app_users row.
    v_owner_emp_id := coalesce(
      v_existing.created_by_emp_id,
      nullif(btrim(coalesce(v_record->>'created_by_emp_id', v_record->>'createdByEmpId', '')), '')
    );
    if v_owner_emp_id is null
       or not exists(select 1 from public.app_users u where u.emp_id = v_owner_emp_id) then
      return jsonb_build_object('status','error','message','INVALID_RECONCILIATION_OWNER');
    end if;
    v_updated_by_emp_id := nullif(btrim(coalesce(
      v_record->>'updated_by_emp_id', v_record->>'updatedByEmpId', ''
    )), '');
    if v_updated_by_emp_id is null
       or not exists(select 1 from public.app_users u where u.emp_id = v_updated_by_emp_id) then
      v_updated_by_emp_id := v_owner_emp_id;
    end if;
  end if;

  v_vat_percent := least(100, greatest(0, public.quotation_safe_numeric(
    coalesce(v_record->>'vat_percent', v_record->>'vatPercent', v_payload->>'vat_percent', v_payload->>'vatPercent'), 7
  )))::numeric(7,4);

  insert into public.quotations (
    quotation_id, quotation_no, client_request_id, project_name, revision,
    quotation_date, status, currency,
    customer_id, customer_code, customer_name, customer_company, customer_branch,
    customer_address, customer_phone, customer_email, customer_tax_id,
    customer_contact_person, customer_note,
    quotation_note, validity_days, payment_terms, delivery_terms, vat_percent,
    report_version, drive_folder_id, pdf_file_id, pdf_url, xlsx_file_id, xlsx_url,
    source_version, source_hash, payload_json, source_created_at, source_updated_at,
    last_synced_at, created_by_emp_id, created_by_name, updated_by_emp_id
  ) values (
    v_id, v_no,
    nullif(btrim(coalesce(v_record->>'client_request_id', v_record->>'clientRequestId', '')), ''),
    coalesce(v_record->>'project_name', v_record->>'projectName', ''),
    greatest(0, public.quotation_safe_bigint(v_record->>'revision', 0)),
    left(coalesce(nullif(btrim(coalesce(v_record->>'quotation_date', v_record->>'quotationDate')), ''), current_date::text), 100),
    v_status,
    case
      when upper(coalesce(nullif(btrim(v_record->>'currency'), ''), 'THB')) ~ '^[A-Z]{3}$'
        then upper(coalesce(nullif(btrim(v_record->>'currency'), ''), 'THB'))
      else 'THB'
    end,
    nullif(btrim(coalesce(v_record->>'customer_id', v_payload#>>'{customer,id}', '')), ''),
    nullif(btrim(coalesce(v_record->>'customer_code', v_payload#>>'{customer,code}', '')), ''),
    coalesce(v_record->>'customer_name', v_payload#>>'{customer,name}', ''),
    coalesce(v_record->>'customer_company', v_payload#>>'{customer,company}', ''),
    coalesce(v_record->>'customer_branch', v_payload#>>'{customer,branch}', ''),
    coalesce(v_record->>'customer_address', v_payload#>>'{customer,address}', ''),
    coalesce(v_record->>'customer_phone', v_payload#>>'{customer,phone}', ''),
    coalesce(v_record->>'customer_email', v_payload#>>'{customer,email}', ''),
    coalesce(v_record->>'customer_tax_id', v_payload#>>'{customer,taxId}', v_payload#>>'{customer,tax_id}', ''),
    coalesce(v_record->>'customer_contact_person', v_payload#>>'{customer,contactPerson}', v_payload#>>'{customer,contact_person}', ''),
    coalesce(v_record->>'customer_note', v_payload#>>'{customer,note}', ''),
    coalesce(v_record->>'quotation_note', v_payload->>'note', ''),
    least(3650, greatest(0, public.quotation_safe_integer(
      coalesce(v_record->>'validity_days', v_payload#>>'{terms,validityDays}', v_payload#>>'{terms,validity_days}'), 30
    ))),
    coalesce(v_record->>'payment_terms', v_payload#>>'{terms,paymentTerms}', v_payload#>>'{terms,payment_terms}', ''),
    coalesce(v_record->>'delivery_terms', v_payload#>>'{terms,deliveryTerms}', v_payload#>>'{terms,delivery_terms}', ''),
    v_vat_percent,
    greatest(1, public.quotation_safe_bigint(coalesce(v_record->>'report_version', v_record->>'reportVersion'), 1)),
    nullif(btrim(coalesce(v_record->>'drive_folder_id', '')), ''),
    nullif(btrim(coalesce(v_record->>'pdf_file_id', v_payload->>'pdfFileId', v_payload->>'pdf_file_id', '')), ''),
    nullif(btrim(coalesce(v_record->>'pdf_url', v_payload->>'pdfUrl', v_payload->>'pdf_url', '')), ''),
    nullif(btrim(coalesce(v_record->>'xlsx_file_id', v_payload->>'xlsxFileId', v_payload->>'xlsx_file_id', '')), ''),
    nullif(btrim(coalesce(v_record->>'xlsx_url', v_payload->>'xlsxUrl', v_payload->>'xlsx_url', '')), ''),
    v_source_version, v_source_hash, v_payload,
    public.quotation_safe_timestamptz(
      coalesce(v_record->>'source_created_at', v_record->>'created_at', v_record->>'createdAt'), v_now
    ),
    public.quotation_safe_timestamptz(
      coalesce(v_record->>'source_updated_at', v_record->>'updated_at', v_record->>'updatedAt'), v_now
    ),
    v_now,
    v_owner_emp_id,
    coalesce(nullif(v_existing.created_by_name, ''), v_record->>'created_by_name', v_record->>'createdByName', ''),
    v_updated_by_emp_id
  )
  on conflict (quotation_id) do update set
    quotation_no = excluded.quotation_no,
    client_request_id = excluded.client_request_id,
    project_name = excluded.project_name,
    revision = excluded.revision,
    quotation_date = excluded.quotation_date,
    status = excluded.status,
    currency = excluded.currency,
    customer_id = excluded.customer_id,
    customer_code = excluded.customer_code,
    customer_name = excluded.customer_name,
    customer_company = excluded.customer_company,
    customer_branch = excluded.customer_branch,
    customer_address = excluded.customer_address,
    customer_phone = excluded.customer_phone,
    customer_email = excluded.customer_email,
    customer_tax_id = excluded.customer_tax_id,
    customer_contact_person = excluded.customer_contact_person,
    customer_note = excluded.customer_note,
    quotation_note = excluded.quotation_note,
    validity_days = excluded.validity_days,
    payment_terms = excluded.payment_terms,
    delivery_terms = excluded.delivery_terms,
    vat_percent = excluded.vat_percent,
    report_version = excluded.report_version,
    drive_folder_id = excluded.drive_folder_id,
    pdf_file_id = excluded.pdf_file_id,
    pdf_url = excluded.pdf_url,
    xlsx_file_id = excluded.xlsx_file_id,
    xlsx_url = excluded.xlsx_url,
    source_version = excluded.source_version,
    source_hash = excluded.source_hash,
    payload_json = excluded.payload_json,
    source_updated_at = excluded.source_updated_at,
    last_synced_at = excluded.last_synced_at,
    updated_by_emp_id = excluded.updated_by_emp_id;

  delete from public.quotation_items where quotation_id = v_id;
  v_ordinality := 0;
  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_ordinality := v_ordinality + 1;
    insert into public.quotation_items (
      quotation_id, source_item_id, item_no, product_id, product_ref, product_name,
      description, unit, quantity, unit_price, amount, unit_cost, cost_amount,
      remark, picture_file_id, picture_url, payload_json
    ) values (
      v_id,
      nullif(btrim(coalesce(v_item->>'id', v_item->>'item_id', '')), ''),
      v_ordinality::integer,
      nullif(btrim(coalesce(v_item->>'product_id', v_item->>'productId', '')), ''),
      coalesce(v_item->>'product_ref', v_item->>'productRef', ''),
      coalesce(v_item->>'product_name', v_item->>'productName', ''),
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'unit', ''),
      greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'quantity', v_item->>'qty'), 0)),
      greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'unit_price', v_item->>'unitPrice'), 0)),
      round(
        greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'quantity', v_item->>'qty'), 0))
        * greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'unit_price', v_item->>'unitPrice'), 0)), 2
      ),
      greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'unit_cost', v_item->>'unitCost', v_item->>'cost'), 0)),
      round(
        greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'quantity', v_item->>'qty'), 0))
        * greatest(0, public.quotation_safe_numeric(coalesce(v_item->>'unit_cost', v_item->>'unitCost', v_item->>'cost'), 0)), 2
      ),
      coalesce(v_item->>'remark', v_item->>'note', ''),
      nullif(btrim(coalesce(v_item->>'picture_file_id', v_item->>'pictureFileId', v_item->>'image_file_id', v_item->>'imageFileId', '')), ''),
      nullif(btrim(coalesce(v_item->>'picture_url', v_item->>'pictureUrl', v_item->>'image_url', v_item->>'imageUrl', '')), ''),
      v_item
    );
  end loop;

  delete from public.quotation_cost_notes where quotation_id = v_id;
  v_ordinality := 0;
  for v_cost_note in select value from jsonb_array_elements(v_cost_notes)
  loop
    v_ordinality := v_ordinality + 1;
    insert into public.quotation_cost_notes (
      quotation_id, source_cost_note_id, note_no, description, proposed_cost,
      sb_cost, gp_percent, note, payload_json
    ) values (
      v_id,
      nullif(btrim(coalesce(v_cost_note->>'id', v_cost_note->>'cost_note_id', '')), ''),
      v_ordinality::integer,
      coalesce(v_cost_note->>'description', ''),
      greatest(0, round(public.quotation_safe_numeric(
        coalesce(v_cost_note->>'proposed_cost', v_cost_note->>'proposedCost', v_cost_note->>'pcost'), 0
      ), 2)),
      greatest(0, round(public.quotation_safe_numeric(
        coalesce(v_cost_note->>'sb_cost', v_cost_note->>'sbCost', v_cost_note->>'sbcost'), 0
      ), 2)),
      public.quotation_safe_numeric(coalesce(v_cost_note->>'gp_percent', v_cost_note->>'gpPercent'), 0),
      coalesce(v_cost_note->>'note', v_cost_note->>'remark', ''),
      v_cost_note
    );
  end loop;

  delete from public.quotation_files where quotation_id = v_id;
  for v_file in select value from jsonb_array_elements(v_files)
  loop
    if btrim(coalesce(v_file->>'drive_file_id', v_file->>'file_id', v_file->>'fileId', '')) <> '' then
      insert into public.quotation_files (
        quotation_id, drive_file_id, file_kind, file_name, mime_type, bucket,
        view_url, direct_url, registry_source, report_version, is_current,
        uploaded_by_emp_id, source_created_at, payload_json
      ) values (
        v_id,
        btrim(coalesce(v_file->>'drive_file_id', v_file->>'file_id', v_file->>'fileId')),
        coalesce(nullif(btrim(coalesce(v_file->>'file_kind', v_file->>'kind', '')), ''), 'quotation_attachments'),
        coalesce(v_file->>'file_name', v_file->>'fileName', v_file->>'name', ''),
        coalesce(v_file->>'mime_type', v_file->>'mimeType', ''),
        coalesce(v_file->>'bucket', ''),
        coalesce(v_file->>'view_url', v_file->>'viewUrl', v_file->>'url', ''),
        coalesce(v_file->>'direct_url', v_file->>'directUrl', v_file->>'download_url', ''),
        coalesce(v_file->>'registry_source', v_file->>'registrySource', v_file->>'source', ''),
        nullif(public.quotation_safe_bigint(
          coalesce(v_file->>'report_version', v_file->>'reportVersion'), 0
        ), 0),
        case lower(btrim(coalesce(v_file->>'is_current', v_file->>'isCurrent', 'true')))
          when 'false' then false when 'f' then false when '0' then false when 'no' then false
          else true
        end,
        v_updated_by_emp_id,
        public.quotation_safe_timestamptz(
          coalesce(v_file->>'source_created_at', v_file->>'created_at', v_file->>'createdAt'), v_now
        ),
        v_file
      )
      on conflict (quotation_id, drive_file_id, file_kind) do update set
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        bucket = excluded.bucket,
        view_url = excluded.view_url,
        direct_url = excluded.direct_url,
        registry_source = excluded.registry_source,
        report_version = excluded.report_version,
        is_current = excluded.is_current,
        payload_json = excluded.payload_json,
        updated_at = v_now;
    end if;
  end loop;

  select
    coalesce(round(sum(i.amount), 2), 0),
    coalesce(round(sum(i.cost_amount), 2), 0)
  into v_subtotal, v_total_item_cost
  from public.quotation_items i
  where i.quotation_id = v_id;

  select
    coalesce(round(sum(c.proposed_cost), 2), 0),
    coalesce(round(sum(c.sb_cost), 2), 0),
    coalesce(bool_or(c.sb_cost > 0), false)
  into v_total_proposed_cost, v_total_cost, v_has_sb_cost
  from public.quotation_cost_notes c
  where c.quotation_id = v_id;

  if not v_has_sb_cost then v_total_cost := v_total_item_cost; end if;
  v_vat_amount := round(v_subtotal * v_vat_percent / 100, 2);
  v_grand_total := round(v_subtotal + v_vat_amount, 2);
  v_gross_profit := round(v_subtotal - v_total_cost, 2);
  v_gp_percent := case when v_subtotal = 0 then 0 else round(v_gross_profit / v_subtotal * 100, 2) end;

  update public.quotations
  set subtotal = v_subtotal,
      vat_amount = v_vat_amount,
      grand_total = v_grand_total,
      total_proposed_cost = v_total_proposed_cost,
      total_item_cost = v_total_item_cost,
      total_cost = v_total_cost,
      cost_basis = case when v_has_sb_cost then 'SB_COST_NOTES' else 'ITEM_UNIT_COST' end,
      gross_profit = v_gross_profit,
      gp_percent = v_gp_percent,
      updated_at = v_now
  where quotation_id = v_id;

  return jsonb_build_object(
    'status','success','action',case when v_existing.quotation_id is null then 'inserted' else 'updated' end,
    'quotation_id',v_id,'quotation_no',v_no,
    'source_version',v_source_version,'source_hash',v_source_hash,
    'synced_at',v_now,
    'totals',jsonb_build_object(
      'subtotal',v_subtotal,'vat_percent',v_vat_percent,'vat_amount',v_vat_amount,
      'grand_total',v_grand_total,'total_proposed_cost',v_total_proposed_cost,
      'total_item_cost',v_total_item_cost,'total_cost',v_total_cost,
      'gross_profit',v_gross_profit,'gp_percent',v_gp_percent
    )
  );
end $$;

-- User-initiated synchronization. The token is mandatory and ownership comes
-- only from the current active app_users row behind that token.
create or replace function public.sync_quotation_from_drive(
  p_token uuid,
  p_quotation jsonb
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.quotation_sync_from_drive_core(p_token, p_quotation, false)
$$;

-- Time-trigger reconciliation. This separately named entry point has no user
-- token and is executable only by service_role. It preserves an existing SQL
-- owner; first import accepts only an owner that exists in app_users.
create or replace function public.reconcile_quotation_from_drive(p_quotation jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.quotation_sync_from_drive_core(null, p_quotation, true)
$$;

-- ---------------------------------------------------------------------------
-- RLS defense in depth. There are intentionally zero table policies: all
-- browser-facing roles use Apps Script, while service_role uses the RPCs.
-- ---------------------------------------------------------------------------

alter table public.quotations enable row level security;
alter table public.quotations force row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_items force row level security;
alter table public.quotation_cost_notes enable row level security;
alter table public.quotation_cost_notes force row level security;
alter table public.quotation_files enable row level security;
alter table public.quotation_files force row level security;

drop policy if exists "quotation owners or managers read" on public.quotations;
drop policy if exists "quotation owners or managers insert" on public.quotations;
drop policy if exists "quotation owners or managers update" on public.quotations;
drop policy if exists "quotation owners or managers delete" on public.quotations;
drop policy if exists "quotation item access follows parent" on public.quotation_items;
drop policy if exists "quotation cost access follows parent" on public.quotation_cost_notes;
drop policy if exists "quotation file access follows parent" on public.quotation_files;

-- Remove helper functions from an earlier draft after their policies are gone.
drop function if exists public.quotation_auth_can_access(text);
drop function if exists public.quotation_auth_can_manage_all();

-- No quotation table is callable/readable from the public browser roles.  The
-- Apps Script service role is the only writer, through sync_quotation_from_drive.
revoke all on table public.quotations from public, anon, authenticated;
revoke all on table public.quotation_items from public, anon, authenticated;
revoke all on table public.quotation_cost_notes from public, anon, authenticated;
revoke all on table public.quotation_files from public, anon, authenticated;
revoke all on sequence public.quotation_items_id_seq from public, anon, authenticated;
revoke all on sequence public.quotation_cost_notes_id_seq from public, anon, authenticated;
revoke all on sequence public.quotation_files_id_seq from public, anon, authenticated;

grant all on table public.quotations to service_role;
grant all on table public.quotation_items to service_role;
grant all on table public.quotation_cost_notes to service_role;
grant all on table public.quotation_files to service_role;
grant usage, select on sequence public.quotation_items_id_seq to service_role;
grant usage, select on sequence public.quotation_cost_notes_id_seq to service_role;
grant usage, select on sequence public.quotation_files_id_seq to service_role;

revoke all on function public.quotation_safe_numeric(text,numeric) from public, anon, authenticated;
revoke all on function public.quotation_safe_integer(text,integer) from public, anon, authenticated;
revoke all on function public.quotation_safe_bigint(text,bigint) from public, anon, authenticated;
revoke all on function public.quotation_safe_date(text,date) from public, anon, authenticated;
revoke all on function public.quotation_safe_timestamptz(text,timestamptz) from public, anon, authenticated;
revoke all on function public.validate_quotation_session_for_service(uuid) from public, anon, authenticated;
revoke all on function public.sync_quotation_from_drive(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.reconcile_quotation_from_drive(jsonb) from public, anon, authenticated;
revoke all on function public.quotation_sync_from_drive_core(uuid,jsonb,boolean) from public, anon, authenticated, service_role;

grant execute on function public.validate_quotation_session_for_service(uuid) to service_role;
grant execute on function public.sync_quotation_from_drive(uuid,jsonb) to service_role;
grant execute on function public.reconcile_quotation_from_drive(jsonb) to service_role;


-- =========================================================
-- 16_FRONTEND_RPC_COMPLETION_AND_AUTH_HARDENING.sql
-- =========================================================

-- Complete the RPC contract used by the React application and harden onboarding.
-- Run after 15_QUOTATION_SUPABASE_SCHEMA.sql.

begin;

alter table public.missions
  add column if not exists requires_evidence boolean not null default false,
  add column if not exists requires_approval boolean not null default false;

alter table public.user_missions
  add column if not exists reviewed_by_emp_id text references public.app_users(emp_id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

insert into public.app_settings(key, value, description, is_public) values
  ('WELCOME_TITLE', 'SB CONNECT', 'Welcome dialog title', true),
  ('WELCOME_MESSAGE', 'ยินดีต้อนรับสู่ SB Connect', 'Welcome dialog message', true),
  ('WELCOME_VIDEO_URL', '', 'Optional welcome video URL', true),
  ('WELCOME_ENABLED', 'true', 'Enable the welcome dialog', true)
on conflict (key) do nothing;

create or replace function public.login_with_emp_password(
  p_emp_id text,
  p_password text,
  p_user_agent text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  u app_users%rowtype;
  c user_credentials%rowtype;
  v_token uuid;
  v_must_change boolean;
  v_failed_attempts integer;
  v_emp_input text := lower(trim(coalesce(p_emp_id,'')));
begin
  select count(*) into v_failed_attempts
  from login_attempt_logs l
  where lower(coalesce(l.emp_id,'')) = v_emp_input
    and l.success = false
    and coalesce(l.reason,'') <> 'RATE_LIMITED'
    and l.created_at > greatest(
      now() - interval '15 minutes',
      coalesce((select max(s.created_at) from login_attempt_logs s
                where lower(coalesce(s.emp_id,''))=v_emp_input and s.success=true), '-infinity'::timestamptz)
    );

  if v_failed_attempts >= 5 then
    insert into login_attempt_logs(emp_id,success,reason,user_agent)
    values(trim(p_emp_id),false,'RATE_LIMITED',p_user_agent);
    return jsonb_build_object('status','error','message','เข้าสู่ระบบไม่สำเร็จ กรุณารอ 15 นาทีแล้วลองใหม่');
  end if;

  select * into u from app_users
  where lower(emp_id)=v_emp_input and status='active'
  limit 1;
  if not found then
    insert into login_attempt_logs(emp_id,success,reason,user_agent)
    values(trim(p_emp_id),false,'INVALID_CREDENTIALS',p_user_agent);
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  select * into c from user_credentials where emp_id=u.emp_id;
  if not found then
    insert into login_attempt_logs(emp_id,success,reason,user_agent)
    values(u.emp_id,false,'ACCOUNT_NOT_PROVISIONED',p_user_agent);
    return jsonb_build_object('status','error','message','บัญชียังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  end if;

  if not public.sb_verify_password(coalesce(p_password,''),c.password_hash) then
    insert into login_attempt_logs(emp_id,success,reason,user_agent)
    values(u.emp_id,false,'INVALID_CREDENTIALS',p_user_agent);
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  v_must_change := coalesce(c.must_change,false) or coalesce(u.force_password_change,false);
  insert into public_sessions(emp_id,role,user_agent)
  values(u.emp_id,u.role,p_user_agent)
  returning session_token into v_token;
  update app_users set presence='online',updated_at=now() where emp_id=u.emp_id;
  insert into login_attempt_logs(emp_id,success,reason,user_agent)
  values(u.emp_id,true,'SUCCESS',p_user_agent);

  return jsonb_build_object(
    'status','success','token',v_token,'mustChangePassword',v_must_change,
    'redirectPage',case when u.role in ('admin','admin_it','dev') then 'admin' else 'home' end,
    'user',jsonb_build_object(
      'emp_id',u.emp_id,'empId',u.emp_id,'role',u.role,'email',u.email,
      'full_name',trim(concat_ws(' ',u.name_th,u.surname_th)),
      'name',trim(concat_ws(' ',u.name_th,u.surname_th)),'nickname',u.nickname_th,
      'department',u.dept_th,'dept',u.dept_th,'position',u.pos_th,
      'points',u.points,'avatar_url',u.avatar_url,'avatar',u.avatar_url,
      'checkInCount',u.check_in_count,'lastCheckIn',u.last_check_in,
      'mustChangePassword',v_must_change
    )
  );
end $$;

create or replace function public.get_app_welcome(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.public_session_emp_id(p_token) is null then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;

  return jsonb_build_object(
    'status','success',
    'title',coalesce((select value from app_settings where key='WELCOME_TITLE'),'SB CONNECT'),
    'message',coalesce((select value from app_settings where key='WELCOME_MESSAGE'),'ยินดีต้อนรับสู่ SB Connect'),
    'video_url',coalesce((select value from app_settings where key='WELCOME_VIDEO_URL'),''),
    'is_active',lower(coalesce((select value from app_settings where key='WELCOME_ENABLED'),'true')) in ('true','1','yes','on')
  );
end $$;

create or replace function public.list_my_redemptions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_array(); end if;

  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select redemption_id as id, redemption_id, reward_id, reward_name,
           points_spent, status, redeemed_at, approved_at
    from reward_redemptions
    where emp_id = v_emp_id
    order by redeemed_at desc
    limit 100
  ) x),'[]'::jsonb);
end $$;

create or replace function public.list_missions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp_id text;
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_array(); end if;

  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select m.mission_id as id, m.mission_id, m.title, m.description,
           m.image_url, m.points, m.status, m.requires_evidence,
           m.requires_approval, um.status as submission_status,
           coalesce(um.status in ('Completed','Approved'),false) as done,
           coalesce(um.status = 'Pending',false) as pending,
           um.evidence_url, um.created_at as submitted_at
    from missions m
    left join user_missions um
      on um.mission_id = m.mission_id and um.emp_id = v_emp_id
    where m.status = 'active'
    order by m.created_at desc
  ) x),'[]'::jsonb);
end $$;

-- Replace the legacy two-argument RPC instead of leaving an overload that can
-- make PostgREST function resolution ambiguous when the optional argument is omitted.
drop function if exists public.submit_mission(uuid,text);

create or replace function public.submit_mission(
  p_token uuid,
  p_mission_id text,
  p_evidence_url text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp_id text;
  v_mission missions%rowtype;
  v_submission user_missions%rowtype;
  v_tx record;
  v_balance integer;
  v_pending boolean;
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then return jsonb_build_object('status','error','message','SESSION_EXPIRED'); end if;

  select * into v_mission from missions
  where mission_id = p_mission_id and status = 'active';
  if not found then return jsonb_build_object('status','error','message','ไม่พบภารกิจนี้'); end if;

  if v_mission.requires_evidence and coalesce(trim(p_evidence_url),'') = '' then
    return jsonb_build_object('status','error','message','กรุณาแนบหลักฐานก่อนส่งภารกิจ');
  end if;

  select * into v_submission from user_missions
  where emp_id = v_emp_id and mission_id = p_mission_id;
  if found and v_submission.status in ('Pending','Completed','Approved') then
    return jsonb_build_object('status','success','message','ส่งภารกิจนี้แล้ว','already',true,'submission_status',v_submission.status);
  end if;

  v_pending := v_mission.requires_approval;
  insert into user_missions(emp_id, mission_id, completed_at, status, evidence_url, reviewed_by_emp_id, reviewed_at, review_note)
  values(v_emp_id, v_mission.mission_id, case when v_pending then null else now() end,
         case when v_pending then 'Pending' else 'Completed' end, p_evidence_url, null, null, null)
  on conflict(emp_id, mission_id) do update set
    completed_at = excluded.completed_at,
    status = excluded.status,
    evidence_url = excluded.evidence_url,
    reviewed_by_emp_id = null,
    reviewed_at = null,
    review_note = null,
    created_at = now();

  if not v_pending and coalesce(v_mission.points,0) > 0
     and not exists(select 1 from point_transactions where emp_id=v_emp_id and source_type='MISSION' and source_id=v_mission.mission_id) then
    select * into v_tx from add_point_transaction(
      v_emp_id,'earn',v_mission.points,'Mission: ' || v_mission.title,
      'MISSION',v_mission.mission_id,jsonb_build_object('missionId',v_mission.mission_id,'evidenceUrl',p_evidence_url)
    );
    v_balance := v_tx.balance_after;
  end if;

  return jsonb_build_object(
    'status','success',
    'message',case when v_pending then 'ส่งภารกิจแล้ว กรุณารอผู้ดูแลอนุมัติ' else 'บันทึกภารกิจสำเร็จ' end,
    'submission_status',case when v_pending then 'Pending' else 'Completed' end,
    'points',case when v_pending then 0 else v_mission.points end,
    'newPoints',coalesce(v_balance,(select points from app_users where emp_id=v_emp_id))
  );
end $$;

create or replace function public.admin_list_mission_submissions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select um.id, um.created_at as submitted_at, um.emp_id,
           trim(concat_ws(' ',u.name_th,u.surname_th)) as employee_name,
           um.mission_id, m.title as mission_title, m.points,
           um.evidence_url, um.status, um.review_note, um.reviewed_at,
           um.reviewed_by_emp_id
    from user_missions um
    join missions m on m.mission_id = um.mission_id
    join app_users u on u.emp_id = um.emp_id
    order by case when um.status='Pending' then 0 else 1 end, um.created_at desc
    limit 500
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_review_mission_submission(
  p_token uuid,
  p_submission_id bigint,
  p_decision text,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_submission user_missions%rowtype;
  v_mission missions%rowtype;
  v_decision text;
  v_tx record;
  v_balance integer;
begin
  if not public.public_session_is_admin(p_token) then
    return jsonb_build_object('status','error','message','ADMIN_ONLY');
  end if;
  v_actor := public.public_session_emp_id(p_token);
  v_decision := initcap(lower(trim(coalesce(p_decision,''))));
  if v_decision not in ('Approved','Rejected') then
    return jsonb_build_object('status','error','message','INVALID_DECISION');
  end if;

  select * into v_submission from user_missions where id=p_submission_id for update;
  if not found then return jsonb_build_object('status','error','message','SUBMISSION_NOT_FOUND'); end if;
  select * into v_mission from missions where mission_id=v_submission.mission_id;

  if v_decision='Approved' and v_submission.status not in ('Approved','Completed')
     and coalesce(v_mission.points,0) > 0
     and not exists(select 1 from point_transactions where emp_id=v_submission.emp_id and source_type='MISSION' and source_id=v_submission.mission_id) then
    select * into v_tx from add_point_transaction(
      v_submission.emp_id,'earn',v_mission.points,'Mission approved: ' || v_mission.title,
      'MISSION',v_submission.mission_id,jsonb_build_object('submissionId',p_submission_id,'approvedBy',v_actor)
    );
    v_balance := v_tx.balance_after;
  end if;

  update user_missions set
    status = case when v_decision='Approved' then 'Completed' else 'Rejected' end,
    completed_at = case when v_decision='Approved' then coalesce(completed_at,now()) else completed_at end,
    reviewed_by_emp_id = v_actor,
    reviewed_at = now(),
    review_note = nullif(trim(p_note),'')
  where id=p_submission_id;

  insert into admin_audit_logs(actor_emp_id,action,target_table,target_id,after_data)
  values(v_actor,'REVIEW_MISSION_SUBMISSION','user_missions',p_submission_id::text,
         jsonb_build_object('decision',v_decision,'note',p_note,'employee',v_submission.emp_id));

  return jsonb_build_object('status','success','decision',v_decision,'balance_after',coalesce(v_balance,(select points from app_users where emp_id=v_submission.emp_id)));
end $$;

create or replace function public.admin_list_reward_redemptions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select rr.redemption_id as id, rr.redemption_id, rr.redeemed_at, rr.emp_id,
           trim(concat_ws(' ',u.name_th,u.surname_th)) as employee_name,
           rr.reward_id, rr.reward_name, rr.points_spent, rr.status,
           rr.approved_by_emp_id, rr.approved_at
    from reward_redemptions rr
    join app_users u on u.emp_id=rr.emp_id
    order by case when rr.status='Pending' then 0 else 1 end, rr.redeemed_at desc
    limit 500
  ) x),'[]'::jsonb);
end $$;

create or replace function public.admin_update_reward_redemption(
  p_token uuid,
  p_redemption_id text,
  p_status text,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor text; v_status text; v_redemption reward_redemptions%rowtype; v_tx record; v_balance integer;
begin
  if not public.public_session_is_admin(p_token) then
    return jsonb_build_object('status','error','message','ADMIN_ONLY');
  end if;
  v_actor := public.public_session_emp_id(p_token);
  v_status := initcap(lower(trim(coalesce(p_status,''))));
  if v_status not in ('Pending','Approved','Delivered','Cancelled') then
    return jsonb_build_object('status','error','message','INVALID_REDEMPTION_STATUS');
  end if;

  select * into v_redemption from reward_redemptions where redemption_id=p_redemption_id for update;
  if not found then return jsonb_build_object('status','error','message','REDEMPTION_NOT_FOUND'); end if;

  if v_status='Cancelled' and v_redemption.status <> 'Cancelled' and v_redemption.points_spent > 0
     and not exists(select 1 from point_transactions where emp_id=v_redemption.emp_id and source_type='REWARD_REFUND' and source_id=v_redemption.redemption_id) then
    select * into v_tx from add_point_transaction(
      v_redemption.emp_id,'refund',v_redemption.points_spent,
      'Reward redemption cancelled: ' || coalesce(v_redemption.reward_name,''),
      'REWARD_REFUND',v_redemption.redemption_id,jsonb_build_object('cancelledBy',v_actor,'note',p_note)
    );
    v_balance := v_tx.balance_after;
    if v_redemption.reward_id is not null then
      update rewards set stock=stock+1, updated_at=now() where reward_id=v_redemption.reward_id;
    end if;
  end if;

  update reward_redemptions set
    status=v_status,
    approved_by_emp_id=case when v_status in ('Approved','Delivered') then v_actor else approved_by_emp_id end,
    approved_at=case when v_status in ('Approved','Delivered') then coalesce(approved_at,now()) else approved_at end,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_note',coalesce(p_note,''),'updated_by',v_actor,'updated_at',now())
  where redemption_id=p_redemption_id;

  insert into admin_audit_logs(actor_emp_id,action,target_table,target_id,before_data,after_data)
  values(v_actor,'UPDATE_REDEMPTION_STATUS','reward_redemptions',p_redemption_id,
         jsonb_build_object('status',v_redemption.status),jsonb_build_object('status',v_status,'note',p_note));

  return jsonb_build_object('status','success','redemption_id',p_redemption_id,'new_status',v_status,'balance_after',coalesce(v_balance,(select points from app_users where emp_id=v_redemption.emp_id)));
end $$;

create or replace function public.admin_upsert_user(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_actor text; v_emp_id text; v_is_new boolean; v_temp_password text;
begin
  if not public.public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public.public_session_emp_id(p_token);
  v_emp_id := trim(coalesce(p_payload->>'emp_id',''));
  if v_emp_id='' then return jsonb_build_object('status','error','message','EMP_ID_REQUIRED'); end if;
  select not exists(select 1 from app_users where emp_id=v_emp_id) into v_is_new;

  insert into app_users(emp_id,name_th,dept_th,pos_th,role,status,force_password_change,password_policy)
  values(
    v_emp_id,p_payload->>'full_name',p_payload->>'department',p_payload->>'position',
    coalesce(nullif(p_payload->>'role',''),'user')::app_role,
    case when upper(coalesce(p_payload->>'status','ACTIVE'))='INACTIVE' then 'inactive'::user_status else 'active'::user_status end,
    true,'8-char-no-thai'
  )
  on conflict(emp_id) do update set
    name_th=excluded.name_th,dept_th=excluded.dept_th,pos_th=excluded.pos_th,
    role=excluded.role,status=excluded.status,updated_at=now();

  if v_is_new then
    v_temp_password := coalesce(nullif(trim(p_payload->>'temp_password'),''),v_emp_id);
    if not public.sb_is_valid_password(v_temp_password) then
      raise exception using message='Temporary password must contain exactly 8 English letters or numbers';
    end if;
    insert into user_credentials(emp_id,password_hash,must_change,reset_at,reset_by_emp_id)
    values(v_emp_id,public.sb_hash_password(v_temp_password),true,now(),v_actor)
    on conflict(emp_id) do update set password_hash=excluded.password_hash,must_change=true,reset_at=now(),reset_by_emp_id=v_actor;
  end if;

  insert into admin_audit_logs(actor_emp_id,action,target_table,target_id,after_data)
  values(v_actor,case when v_is_new then 'CREATE_USER' else 'UPDATE_USER' end,'app_users',v_emp_id,
         jsonb_build_object('role',p_payload->>'role','status',p_payload->>'status'));
  return jsonb_build_object('status','success','id',v_emp_id,'created',v_is_new);
end $$;

create or replace function public.admin_upsert_mission(p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_id text;
begin
  v_result := public.admin_save_mission(
    p_token,p_payload->>'id',coalesce(p_payload->>'title',p_payload->>'topic'),
    p_payload->>'description',coalesce((p_payload->>'points')::int,0),
    nullif(p_payload->>'image_url',''),
    case when coalesce((p_payload->>'is_active')::boolean,true) then 'active'::content_status else 'inactive'::content_status end
  );
  if v_result->>'status' <> 'success' then return v_result; end if;
  v_id := v_result->>'id';
  update missions set
    requires_evidence=coalesce((p_payload->>'requires_evidence')::boolean,false),
    requires_approval=coalesce((p_payload->>'requires_approval')::boolean,false),
    updated_at=now()
  where mission_id=v_id;
  return v_result;
end $$;

-- Public onboarding without a pre-provisioned credential is intentionally disabled.
revoke all on function public.setup_first_password_no_credential(text,text,text) from public, anon, authenticated;
revoke all on function public.prepare_first_login_credentials(text) from public, anon, authenticated;

grant execute on function public.login_with_emp_password(text,text,text) to anon, authenticated;
grant execute on function public.get_app_welcome(uuid) to anon, authenticated;
grant execute on function public.list_my_redemptions(uuid) to anon, authenticated;
grant execute on function public.list_missions(uuid) to anon, authenticated;
grant execute on function public.submit_mission(uuid,text,text) to anon, authenticated;
grant execute on function public.admin_list_mission_submissions(uuid) to anon, authenticated;
grant execute on function public.admin_review_mission_submission(uuid,bigint,text,text) to anon, authenticated;
grant execute on function public.admin_list_reward_redemptions(uuid) to anon, authenticated;
grant execute on function public.admin_update_reward_redemption(uuid,text,text,text) to anon, authenticated;
grant execute on function public.admin_upsert_user(uuid,jsonb) to anon, authenticated;
grant execute on function public.admin_upsert_mission(uuid,jsonb) to anon, authenticated;

commit;
