-- =============================================================================
-- 17_SECURITY_HARDENING_AND_FIXES.sql
-- SB Connect - security lockdown + logic fixes
-- รันไฟล์นี้เป็นไฟล์สุดท้ายเสมอ (หลัง 16_) ทั้งใน dev และ production
-- ไฟล์นี้ idempotent รันซ้ำได้
--
-- สรุปสิ่งที่ไฟล์นี้แก้
--   C1  ปิด execute ของทุกฟังก์ชันจาก anon แล้ว grant กลับเฉพาะ RPC ที่ frontend ใช้จริง
--   C1b ปิดการอ่าน/เขียนตารางตรงผ่าน PostgREST ทั้งหมด (แอปคุยผ่าน RPC เท่านั้น)
--   C2  role ของ session อ่านสดจาก app_users ไม่ใช่ค่าที่แช่ไว้ตอน login
--   C3  เปลี่ยนรหัสครั้งแรกไม่ต้องส่งรหัสเดิม -> frontend ไม่ต้องเก็บ plaintext อีก
--   M1  index บนเส้นทางร้อน
--   M2  ฟังก์ชันล้าง session/log เก่า
--   M3  total_earned นับเฉพาะ tx_type='earn' + backfill ให้ตรงกับ ledger
--   M8  นโยบายรหัสผ่านใหม่ + rate limit ต่อ IP
--   L2  ปิดบัญชี bootstrap ที่ยังใช้รหัสตัวอย่าง
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. ตารางเสริมที่ต้องมีก่อน
-- -----------------------------------------------------------------------------

alter table public.login_attempt_logs
  add column if not exists ip_address text;

alter table public.public_sessions
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.public_sessions
  add column if not exists ip_address text;

-- -----------------------------------------------------------------------------
-- 1. helper: ดึง client IP จาก header ที่ PostgREST ส่งมา
-- -----------------------------------------------------------------------------

create or replace function public.sb_client_ip()
returns text
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  if v_headers is null then return null; end if;

  v_ip := coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)
  );
  v_ip := nullif(btrim(coalesce(v_ip, '')), '');
  return left(v_ip, 64);
end $$;

-- -----------------------------------------------------------------------------
-- 2. M8 - นโยบายรหัสผ่าน
--    เดิม: A-Za-z0-9 ยาว 8 ตัวพอดี (search space เล็กและห้ามอักขระพิเศษ)
--    ใหม่: อย่างน้อย 8 ตัว ไม่เกิน 72 (ขีดจำกัด bcrypt) ต้องมีตัวอักษร+ตัวเลข
--          อนุญาตอักขระพิเศษ ASCII ห้ามช่องว่างหัวท้ายและห้ามอักษรไทย
-- -----------------------------------------------------------------------------

create or replace function public.sb_is_valid_password(p_password text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_password is not null
     and char_length(p_password) between 8 and 72
     and p_password = btrim(p_password)
     and p_password ~ '^[\x21-\x7E]+$'   -- ASCII ที่พิมพ์ได้ ไม่มีช่องว่าง ไม่มีอักษรไทย
     and p_password ~ '[A-Za-z]'
     and p_password ~ '[0-9]'
$$;

-- รหัสชั่วคราวที่สุ่มให้ตรงนโยบาย ใช้ตอน admin reset
create or replace function public.sb_generate_temp_password()
returns text
language plpgsql
volatile
set search_path = pg_catalog, public, extensions
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  v_out text := '';
  i int;
begin
  for i in 1..12 loop
    v_out := v_out || substr(v_alphabet, 1 + floor(random() * char_length(v_alphabet))::int, 1);
  end loop;
  -- การันตีว่ามีตัวอักษรและตัวเลขแน่นอน
  v_out := 'Sb' || v_out || '7';
  return v_out;
end $$;

-- -----------------------------------------------------------------------------
-- 3. C2 - session helper อ่าน role สดจาก app_users และเช็คสถานะผู้ใช้
--    ผลลัพธ์: ถอดสิทธิ์แอดมิน / ปิดบัญชี มีผลทันที ไม่ต้องรอ session หมดอายุ
-- -----------------------------------------------------------------------------

create or replace function public.public_session_emp_id(p_token uuid)
returns text
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select u.emp_id
  from public.public_sessions s
  join public.app_users u on u.emp_id = s.emp_id
  where s.session_token = p_token
    and s.revoked_at is null
    and s.expires_at > now()
    and u.status = 'active'
  limit 1
$$;

create or replace function public.public_session_role(p_token uuid)
returns public.app_role
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select u.role
  from public.public_sessions s
  join public.app_users u on u.emp_id = s.emp_id
  where s.session_token = p_token
    and s.revoked_at is null
    and s.expires_at > now()
    and u.status = 'active'
  limit 1
$$;

create or replace function public.public_session_is_admin(p_token uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select coalesce(public.public_session_role(p_token) in ('admin','admin_it','dev'), false)
$$;

-- -----------------------------------------------------------------------------
-- 4. M8 - login: rate limit ทั้งต่อ emp_id และต่อ IP + บันทึก IP
-- -----------------------------------------------------------------------------

create or replace function public.login_with_emp_password(
  p_emp_id text,
  p_password text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
  c public.user_credentials%rowtype;
  v_token uuid;
  v_must_change boolean;
  v_failed_by_user integer;
  v_failed_by_ip integer;
  v_emp_input text := lower(btrim(coalesce(p_emp_id,'')));
  v_ip text := public.sb_client_ip();
  v_ua text := left(coalesce(p_user_agent,''), 400);
begin
  if v_emp_input = '' or coalesce(p_password,'') = '' then
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  -- นับความล้มเหลวของ emp_id นี้ นับตั้งแต่ login สำเร็จครั้งล่าสุด แต่ไม่เกิน 15 นาที
  select count(*) into v_failed_by_user
  from public.login_attempt_logs l
  where lower(coalesce(l.emp_id,'')) = v_emp_input
    and l.success = false
    and coalesce(l.reason,'') <> 'RATE_LIMITED'
    and l.created_at > greatest(
      now() - interval '15 minutes',
      coalesce((select max(s.created_at) from public.login_attempt_logs s
                 where lower(coalesce(s.emp_id,'')) = v_emp_input and s.success = true),
               '-infinity'::timestamptz)
    );

  -- นับความล้มเหลวจาก IP เดียวกัน กัน password spraying ข้ามหลาย emp_id
  select count(*) into v_failed_by_ip
  from public.login_attempt_logs l
  where v_ip is not null
    and l.ip_address = v_ip
    and l.success = false
    and coalesce(l.reason,'') <> 'RATE_LIMITED'
    and l.created_at > now() - interval '15 minutes';

  if v_failed_by_user >= 5 or v_failed_by_ip >= 20 then
    insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
    values (btrim(p_emp_id), false, 'RATE_LIMITED', v_ua, v_ip);
    return jsonb_build_object('status','error','message','เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  end if;

  select * into u from public.app_users
  where lower(emp_id) = v_emp_input and status = 'active'
  limit 1;

  if not found then
    insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
    values (btrim(p_emp_id), false, 'INVALID_CREDENTIALS', v_ua, v_ip);
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  select * into c from public.user_credentials where emp_id = u.emp_id;
  if not found then
    insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
    values (u.emp_id, false, 'ACCOUNT_NOT_PROVISIONED', v_ua, v_ip);
    -- ข้อความเดียวกับกรณีรหัสผิด เพื่อไม่ให้เดาได้ว่าบัญชีไหนมีอยู่จริง
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  if not public.sb_verify_password(coalesce(p_password,''), c.password_hash) then
    insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
    values (u.emp_id, false, 'INVALID_CREDENTIALS', v_ua, v_ip);
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  v_must_change := coalesce(c.must_change, false) or coalesce(u.force_password_change, false);

  -- จำกัดจำนวน session ที่ยังมีชีวิตต่อคน เก็บล่าสุด 4 อัน
  update public.public_sessions
  set revoked_at = now()
  where emp_id = u.emp_id
    and revoked_at is null
    and expires_at > now()
    and session_token in (
      select session_token from public.public_sessions
      where emp_id = u.emp_id and revoked_at is null and expires_at > now()
      order by created_at desc
      offset 4
    );

  insert into public.public_sessions(emp_id, role, user_agent, ip_address)
  values (u.emp_id, u.role, v_ua, v_ip)
  returning session_token into v_token;

  update public.app_users set presence = 'online', updated_at = now() where emp_id = u.emp_id;

  insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
  values (u.emp_id, true, 'SUCCESS', v_ua, v_ip);

  return jsonb_build_object(
    'status','success',
    'token', v_token,
    'mustChangePassword', v_must_change,
    'redirectPage', case when u.role in ('admin','admin_it','dev') then 'admin' else 'home' end,
    'user', jsonb_build_object(
      'emp_id',u.emp_id,'empId',u.emp_id,'role',u.role,'email',u.email,
      'full_name',btrim(concat_ws(' ',u.name_th,u.surname_th)),
      'name',btrim(concat_ws(' ',u.name_th,u.surname_th)),'nickname',u.nickname_th,
      'department',u.dept_th,'dept',u.dept_th,'position',u.pos_th,
      'points',u.points,'avatar_url',u.avatar_url,'avatar',u.avatar_url,
      'checkInCount',u.check_in_count,'lastCheckIn',u.last_check_in,
      'mustChangePassword',v_must_change
    )
  );
end $$;

-- -----------------------------------------------------------------------------
-- 5. C3 - เปลี่ยนรหัสผ่าน
--    ถ้าบัญชีอยู่ในสถานะ must_change ไม่ต้องส่งรหัสเดิม (session token คือหลักฐานตัวตนแล้ว)
--    frontend จึงไม่ต้องเก็บ plaintext password ไว้ใน sessionStorage อีกต่อไป
--    เปลี่ยนรหัสสำเร็จ = เพิกถอน session อื่นทั้งหมดของคนนั้น
-- -----------------------------------------------------------------------------

create or replace function public.change_my_password(
  p_token uuid,
  p_current_password text,
  p_new_password text,
  p_confirm_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_emp_id text;
  c public.user_credentials%rowtype;
  v_must_change boolean;
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;

  if coalesce(p_new_password,'') <> coalesce(p_confirm_password,'') then
    return jsonb_build_object('status','error','message','รหัสผ่านใหม่ไม่ตรงกัน');
  end if;
  if not public.sb_is_valid_password(p_new_password) then
    return jsonb_build_object('status','error','message',
      'รหัสผ่านต้องยาว 8-72 ตัว มีทั้งตัวอักษรและตัวเลข ใช้อักขระพิเศษได้ ห้ามเว้นวรรคและห้ามภาษาไทย');
  end if;

  select * into c from public.user_credentials where emp_id = v_emp_id;
  if not found then
    return jsonb_build_object('status','error','message','ไม่พบข้อมูลรหัสผ่านเดิม');
  end if;

  select coalesce(c.must_change,false) or coalesce(u.force_password_change,false)
  into v_must_change
  from public.app_users u where u.emp_id = v_emp_id;

  -- บังคับตรวจรหัสเดิมเฉพาะกรณีที่ไม่ได้อยู่ในโหมดบังคับเปลี่ยน
  if not v_must_change then
    if not public.sb_verify_password(coalesce(p_current_password,''), c.password_hash) then
      return jsonb_build_object('status','error','message','รหัสผ่านเดิมไม่ถูกต้อง');
    end if;
  end if;

  if public.sb_verify_password(p_new_password, c.password_hash) then
    return jsonb_build_object('status','error','message','รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม');
  end if;

  update public.user_credentials
  set password_hash = public.sb_hash_password(p_new_password),
      must_change = false,
      changed_at = now()
  where emp_id = v_emp_id;

  update public.app_users
  set force_password_change = false, password_changed_at = now(), updated_at = now()
  where emp_id = v_emp_id;

  -- ตัด session อื่นทิ้งทั้งหมด เหลือเฉพาะเครื่องที่กำลังใช้อยู่
  update public.public_sessions
  set revoked_at = now()
  where emp_id = v_emp_id
    and session_token <> p_token
    and revoked_at is null;

  insert into public.admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values (v_emp_id, 'CHANGE_MY_PASSWORD', 'app_users', v_emp_id,
          jsonb_build_object('changed_at', now(), 'forced', v_must_change, 'ip', public.sb_client_ip()));

  return jsonb_build_object('status','success','message','เปลี่ยนรหัสผ่านสำเร็จ');
end $$;

-- -----------------------------------------------------------------------------
-- 6. admin reset password - บังคับใช้นโยบายใหม่ + สุ่มรหัสให้ถ้าไม่ได้ระบุ
--    (ไฟล์ 11_ นิยามฟังก์ชันนี้ซ้ำสองครั้ง ตัวนี้คือตัวจริงที่ใช้)
-- -----------------------------------------------------------------------------

create or replace function public.admin_reset_user_password(
  p_token uuid,
  p_target_emp_id text,
  p_temp_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor text;
  v_target public.app_users%rowtype;
  v_temp text;
begin
  if not public.public_session_is_admin(p_token) then
    return jsonb_build_object('status','error','message','ADMIN_ONLY');
  end if;
  v_actor := public.public_session_emp_id(p_token);

  select * into v_target from public.app_users
  where lower(emp_id) = lower(btrim(coalesce(p_target_emp_id,'')))
  limit 1;
  if not found then
    return jsonb_build_object('status','error','message','ไม่พบรหัสพนักงานนี้');
  end if;

  v_temp := nullif(btrim(coalesce(p_temp_password,'')), '');
  if v_temp is null then
    v_temp := public.sb_generate_temp_password();
  elsif not public.sb_is_valid_password(v_temp) then
    return jsonb_build_object('status','error','message',
      'รหัสชั่วคราวต้องยาว 8-72 ตัว มีทั้งตัวอักษรและตัวเลข ห้ามเว้นวรรคและห้ามภาษาไทย');
  end if;

  insert into public.user_credentials(emp_id, password_hash, must_change, reset_at, reset_by_emp_id)
  values (v_target.emp_id, public.sb_hash_password(v_temp), true, now(), v_actor)
  on conflict (emp_id) do update set
    password_hash = excluded.password_hash,
    must_change = true,
    reset_at = now(),
    reset_by_emp_id = v_actor;

  update public.app_users
  set force_password_change = true,
      password_reset_at = now(),
      password_reset_by_emp_id = v_actor,
      updated_at = now()
  where emp_id = v_target.emp_id;

  -- reset แล้วต้องเตะ session เดิมออกทั้งหมด
  update public.public_sessions
  set revoked_at = now()
  where emp_id = v_target.emp_id and revoked_at is null;

  insert into public.admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values (v_actor, 'ADMIN_RESET_PASSWORD', 'user_credentials', v_target.emp_id,
          jsonb_build_object('reset_at', now(), 'ip', public.sb_client_ip()));

  return jsonb_build_object(
    'status','success',
    'message','รีเซ็ตรหัสผ่านสำเร็จ ให้แจ้งรหัสชั่วคราวกับพนักงานโดยตรงและให้เปลี่ยนทันทีที่เข้าระบบ',
    'temp_password', v_temp,
    'emp_id', v_target.emp_id
  );
end $$;

create or replace function public.admin_reset_password(
  p_token uuid,
  p_emp_id text,
  p_temp_password text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.admin_reset_user_password(p_token, p_emp_id, p_temp_password)
$$;

-- -----------------------------------------------------------------------------
-- 7. M3 - total_earned ต้องนับเฉพาะการได้แต้มจริง ไม่นับ refund
--         และ recalc ต้องใช้สูตรเดียวกับ incremental
-- -----------------------------------------------------------------------------

create or replace function public.add_point_transaction(
  p_emp_id text,
  p_tx_type public.point_tx_type,
  p_amount integer,
  p_description text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(tx_id text, balance_after integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tx_id text;
  v_current_points integer;
  v_balance integer;
begin
  if p_emp_id is null or not exists (select 1 from public.app_users where emp_id = p_emp_id) then
    raise exception 'invalid emp_id';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'invalid amount';
  end if;

  v_tx_id := 'TX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  select coalesce(points,0) into v_current_points
  from public.app_users where emp_id = p_emp_id for update;

  v_balance := v_current_points + p_amount;
  if v_balance < 0 then
    raise exception 'insufficient points';
  end if;

  insert into public.point_transactions(
    tx_id, emp_id, tx_type, amount, description, balance_after, source_type, source_id, metadata)
  values (v_tx_id, p_emp_id, p_tx_type, p_amount, p_description, v_balance,
          p_source_type, p_source_id, coalesce(p_metadata,'{}'::jsonb));

  update public.app_users
  set points = v_balance,
      total_earned = case
        when p_tx_type = 'earn' and p_amount > 0 then total_earned + p_amount
        else total_earned
      end
  where emp_id = p_emp_id;

  return query select v_tx_id, v_balance;
end $$;

create or replace function public.recalc_user_points(p_emp_id text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_points integer;
  v_earned integer;
begin
  select coalesce(sum(amount), 0),
         coalesce(sum(case when tx_type = 'earn' and amount > 0 then amount else 0 end), 0)
  into v_points, v_earned
  from public.point_transactions
  where emp_id = p_emp_id;

  if v_points < 0 then
    raise exception 'ledger for % sums to negative balance (%), refusing to write', p_emp_id, v_points;
  end if;

  update public.app_users
  set points = v_points, total_earned = v_earned
  where emp_id = p_emp_id;

  return v_points;
end $$;

-- backfill ครั้งเดียว ให้ points/total_earned ตรงกับ ledger
-- (คนที่ไม่มี transaction เลย ปล่อยค่าปัจจุบันไว้ตามเดิม ไม่ล้างเป็น 0)
with agg as (
  select emp_id,
         coalesce(sum(amount),0) as points,
         coalesce(sum(case when tx_type = 'earn' and amount > 0 then amount else 0 end),0) as earned
  from public.point_transactions
  group by emp_id
)
update public.app_users u
set points = greatest(agg.points, 0),
    total_earned = agg.earned,
    updated_at = now()
from agg
where agg.emp_id = u.emp_id
  and (u.points <> greatest(agg.points, 0) or u.total_earned <> agg.earned);

-- -----------------------------------------------------------------------------
-- 8. M1 - index บนเส้นทางร้อน
-- -----------------------------------------------------------------------------

create index if not exists idx_login_attempts_emp_time
  on public.login_attempt_logs (lower(coalesce(emp_id,'')), created_at desc);
create index if not exists idx_login_attempts_ip_time
  on public.login_attempt_logs (ip_address, created_at desc)
  where ip_address is not null;
create index if not exists idx_point_tx_emp_time
  on public.point_transactions (emp_id, created_at desc);
create index if not exists idx_point_tx_source
  on public.point_transactions (source_type, source_id);
create index if not exists idx_notifications_unread
  on public.notifications (emp_id, is_read)
  where is_read = false;
create index if not exists idx_user_missions_emp
  on public.user_missions (emp_id, mission_id);
create index if not exists idx_user_news_reads_emp
  on public.user_news_reads (emp_id, news_id);
create index if not exists idx_checkin_logs_emp_date
  on public.checkin_logs (emp_id, checkin_date desc);
create index if not exists idx_reward_redemptions_emp_time
  on public.reward_redemptions (emp_id, redeemed_at desc);
create index if not exists idx_overall_logs_emp_time
  on public.overall_logs (employee_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 9. M2 - งานล้างข้อมูลชั่วคราว
--     เรียกด้วย pg_cron หรือกดเองใน SQL editor เดือนละครั้งก็พอ
-- -----------------------------------------------------------------------------

create or replace function public.sb_cleanup_expired()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sessions bigint;
  v_logins bigint;
begin
  delete from public.public_sessions
  where expires_at < now() - interval '7 days';
  get diagnostics v_sessions = row_count;

  delete from public.login_attempt_logs
  where created_at < now() - interval '90 days';
  get diagnostics v_logins = row_count;

  return jsonb_build_object('status','success','sessions_deleted',v_sessions,'login_logs_deleted',v_logins);
end $$;

-- ถ้าเปิด extension pg_cron ไว้ ให้ตั้งงานรายวันตอนตีสอง (ไม่บังคับ)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('sb_cleanup_expired')
    where exists (select 1 from cron.job where jobname = 'sb_cleanup_expired');
    perform cron.schedule('sb_cleanup_expired', '0 2 * * *', 'select public.sb_cleanup_expired();');
  end if;
exception when others then
  raise notice 'pg_cron not configured, skipping schedule';
end $$;

-- -----------------------------------------------------------------------------
-- 10. L2 - บัญชี bootstrap ที่ยังใช้รหัสตัวอย่างในเอกสาร ต้องถูกบังคับเปลี่ยน
-- -----------------------------------------------------------------------------

update public.user_credentials c
set must_change = true, reset_at = now()
from public.app_users u
where u.emp_id = c.emp_id
  and public.sb_verify_password('Admin123', c.password_hash);

update public.app_users u
set force_password_change = true, updated_at = now()
from public.user_credentials c
where c.emp_id = u.emp_id and c.must_change = true;

-- -----------------------------------------------------------------------------
-- 10b. C6 - รหัสผ่าน first-login ที่เดาได้
--      ไฟล์ 94_ ตั้งรหัสผ่านเริ่มต้นของทุกคนให้เท่ากับ "รหัสพนักงานของตัวเอง"
--      รหัสพนักงานเป็นข้อมูลที่คนในบริษัทรู้กันอยู่แล้ว และมีอยู่ในไฟล์ seed
--      => ใครก็ตามที่รู้รหัสพนักงานคนอื่น เข้าบัญชีนั้นได้ทันทีในครั้งแรก
--         แล้วตั้งรหัสใหม่ทับ = ยึดบัญชีไปเลย (rate limit ช่วยไม่ได้ เพราะทายถูกครั้งแรก)
--
--      ตรงนี้เตรียมเครื่องมือไว้ให้ แต่ "ไม่รันอัตโนมัติ" เพราะการหมุนรหัสทั้งบริษัท
--      แปลว่าทุกคนต้องได้รหัสใหม่จาก HR ก่อนถึงจะเข้าระบบได้ ต้องนัดวันกันก่อน
--      วิธีใช้: อ่าน NOTICE ท้ายไฟล์นี้ แล้วรันคำสั่งที่บอกไว้
-- -----------------------------------------------------------------------------

create table if not exists public.first_login_handout (
  emp_id text primary key references public.app_users(emp_id) on delete cascade,
  temp_password text not null,
  created_at timestamptz not null default now()
);
alter table public.first_login_handout enable row level security;

create or replace function public.sb_count_guessable_first_login()
returns bigint
language sql
security definer
set search_path = pg_catalog, public
as $$
  select count(*)
  from public.user_credentials c
  join public.app_users u on u.emp_id = c.emp_id
  where u.status = 'active'
    and coalesce(c.must_change, false) = true
    and (
      public.sb_verify_password(c.emp_id, c.password_hash)
      or public.sb_verify_password('1234', c.password_hash)
      or public.sb_verify_password('Admin123', c.password_hash)
    )
$$;

create or replace function public.sb_rotate_guessable_first_login()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_temp text;
  v_count int := 0;
begin
  delete from public.first_login_handout;

  for r in
    select c.emp_id
    from public.user_credentials c
    join public.app_users u on u.emp_id = c.emp_id
    where u.status = 'active'
      and coalesce(c.must_change, false) = true
      and (
        public.sb_verify_password(c.emp_id, c.password_hash)
        or public.sb_verify_password('1234', c.password_hash)
        or public.sb_verify_password('Admin123', c.password_hash)
      )
  loop
    v_temp := public.sb_generate_temp_password();

    update public.user_credentials
    set password_hash = public.sb_hash_password(v_temp),
        must_change = true,
        reset_at = now()
    where emp_id = r.emp_id;

    update public.app_users
    set force_password_change = true, password_reset_at = now(), updated_at = now()
    where emp_id = r.emp_id;

    update public.public_sessions
    set revoked_at = now()
    where emp_id = r.emp_id and revoked_at is null;

    insert into public.first_login_handout(emp_id, temp_password)
    values (r.emp_id, v_temp);

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'status','success',
    'rotated', v_count,
    'next_step','เปิดตาราง first_login_handout เพื่อ export รหัสชั่วคราวส่งให้พนักงาน แล้วสั่ง truncate public.first_login_handout ทิ้งทันทีที่แจกครบ'
  );
end $$;

do $$
declare v_n bigint;
begin
  select public.sb_count_guessable_first_login() into v_n;
  if v_n > 0 then
    raise notice '===============================================================';
    raise notice 'พบ % บัญชีที่รหัสผ่าน first-login ยังเดาได้ (เท่ากับรหัสพนักงาน / 1234 / Admin123)', v_n;
    raise notice 'ต้องหมุนรหัสก่อนเปิดใช้จริง สั่ง:  select public.sb_rotate_guessable_first_login();';
    raise notice 'จากนั้น export ตาราง public.first_login_handout แจกให้พนักงาน แล้ว truncate ทิ้ง';
    raise notice '===============================================================';
  end if;
end $$;

-- ฟังก์ชันสองตัวนี้เคยเปิดให้ anon เรียกได้ และสร้าง/ตั้งรหัสผ่านให้บัญชีคนอื่นได้
-- ไฟล์ 16_ revoke ไว้แล้ว ตรงนี้ลบทิ้งเลยเพื่อไม่ให้เหลือพื้นที่ผิดพลาด
drop function if exists public.setup_first_password_no_credential(text,text,text);
drop function if exists public.prepare_first_login_credentials(text);

-- overload เก่า redeem_reward(text,text) รับ emp_id ตรง ๆ ไม่มี token
-- ย้ายเนื้อในไปเป็น sb_redeem_reward() ที่เป็นฟังก์ชันภายในล้วน แล้วลบ overload เดิมทิ้ง
-- เพื่อไม่ให้ PostgREST เห็นชื่อ redeem_reward ที่รับ emp_id ได้อีก
create or replace function public.sb_redeem_reward(p_emp_id text, p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.rewards%rowtype;
  v_points integer;
  v_redemption_id text;
  v_tx record;
begin
  select * into r from public.rewards
  where reward_id = p_reward_id and status = 'active' for update;
  if not found then raise exception 'reward not found'; end if;
  if r.stock <= 0 then raise exception 'out of stock'; end if;

  select points into v_points from public.app_users where emp_id = p_emp_id for update;
  if v_points is null then raise exception 'invalid emp_id'; end if;
  if v_points < r.points_required then raise exception 'insufficient points'; end if;

  v_redemption_id := 'RDM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  update public.rewards set stock = stock - 1, updated_at = now() where reward_id = p_reward_id;

  select * into v_tx from public.add_point_transaction(
    p_emp_id, 'spend', -r.points_required, 'Redeem: ' || r.name, 'REDEEM', v_redemption_id,
    jsonb_build_object('rewardId', p_reward_id, 'rewardName', r.name)
  );

  insert into public.reward_redemptions(redemption_id, emp_id, reward_id, reward_name, points_spent, status)
  values (v_redemption_id, p_emp_id, p_reward_id, r.name, r.points_required, 'Pending');

  insert into public.notifications(notification_id, emp_id, title, message, type, metadata)
  values ('NOTI-' || floor(extract(epoch from clock_timestamp())*1000)::bigint || '-' ||
          upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),
          p_emp_id, 'แลกรางวัลสำเร็จ',
          'แลก ' || r.name || ' ใช้ ' || r.points_required || ' แต้ม', 'redeem',
          jsonb_build_object('redemptionId', v_redemption_id, 'rewardId', p_reward_id, 'balance', v_tx.balance_after));

  return jsonb_build_object('status','success','redemptionId',v_redemption_id,
                            'newPoints',v_tx.balance_after,'stock',r.stock - 1);
end $$;

-- แปลง exception ของ sb_redeem_reward เป็น {status:'error'} ภาษาไทย
-- เดิม RPC โยน exception ดิบออกไปเป็น HTTP 500 ทำให้ผู้ใช้เห็นข้อความอังกฤษดิบ ๆ
create or replace function public.public_redeem_reward(p_token uuid, p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_emp_id text;
  v_msg text;
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;

  begin
    return public.sb_redeem_reward(v_emp_id, p_reward_id);
  exception when others then
    v_msg := sqlerrm;
    return jsonb_build_object('status','error','message', case
      when v_msg like '%insufficient points%' then 'แต้มไม่พอสำหรับรางวัลนี้'
      when v_msg like '%out of stock%'        then 'ของรางวัลหมดแล้ว'
      when v_msg like '%reward not found%'    then 'ไม่พบของรางวัลนี้ หรือถูกปิดการแลกอยู่'
      else 'แลกของรางวัลไม่สำเร็จ กรุณาลองใหม่'
    end);
  end;
end $$;

-- เช็คอินก็เช่นกัน
create or replace function public.public_checkin(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_emp_id text;
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;
  begin
    return public.process_checkin(v_emp_id);
  exception when others then
    return jsonb_build_object('status','error','message','เช็คอินไม่สำเร็จ กรุณาลองใหม่');
  end;
end $$;

drop function if exists public.redeem_reward(text,text);

commit;

-- =============================================================================
-- 11. C1 - LOCKDOWN
--     ส่วนนี้อยู่นอก transaction เพื่อให้เห็นผลชัดเจนถ้ามีอะไรผิดพลาด
--     หลักการ: ปิดทุกอย่างก่อน แล้วเปิดกลับเฉพาะ RPC ที่ frontend เรียกจริง
-- =============================================================================

-- 11.1 ปิดการเข้าถึงตารางและ view ตรงผ่าน PostgREST
--      แอปคุยกับฐานผ่าน RPC เท่านั้น ไม่มีเหตุผลให้ anon select ตารางได้เลย
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 11.2 ปิด execute ของทุกฟังก์ชัน แล้วปิดสิทธิ์ default ของฟังก์ชันที่จะสร้างในอนาคต
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 11.3 เปิดกลับเฉพาะรายการที่ React app เรียกจริง (ตรวจสอบด้วย 18_VERIFY_SECURITY.sql)
--      ทุกตัวรับ p_token uuid ยกเว้น login ที่เป็นประตูทางเข้า

-- auth / session
grant execute on function public.login_with_emp_password(text,text,text)        to anon, authenticated;
grant execute on function public.validate_public_session(uuid)                  to anon, authenticated;
grant execute on function public.logout_public_session(uuid)                    to anon, authenticated;
grant execute on function public.change_my_password(uuid,text,text,text)        to anon, authenticated;

-- user pages
grant execute on function public.get_app_welcome(uuid)                          to anon, authenticated;
grant execute on function public.get_home_dashboard(uuid)                       to anon, authenticated;
grant execute on function public.get_my_profile(uuid)                           to anon, authenticated;
grant execute on function public.daily_checkin(uuid)                            to anon, authenticated;
grant execute on function public.list_news(uuid)                                to anon, authenticated;
grant execute on function public.read_news(uuid,text)                           to anon, authenticated;
grant execute on function public.list_missions(uuid)                            to anon, authenticated;
grant execute on function public.submit_mission(uuid,text,text)                 to anon, authenticated;
grant execute on function public.list_rewards(uuid)                             to anon, authenticated;
grant execute on function public.redeem_reward(uuid,text)                       to anon, authenticated;
grant execute on function public.list_my_redemptions(uuid)                      to anon, authenticated;
grant execute on function public.list_ranking(uuid)                             to anon, authenticated;
grant execute on function public.list_notifications(uuid)                       to anon, authenticated;
grant execute on function public.mark_notification_read(uuid,text)              to anon, authenticated;
grant execute on function public.list_my_overall_logs(uuid)                     to anon, authenticated;
grant execute on function public.list_calendar_events(uuid)                     to anon, authenticated;
grant execute on function public.list_rule_board(uuid)                          to anon, authenticated;
grant execute on function public.public_save_my_avatar(uuid,text,text,text,text) to anon, authenticated;

-- admin: read
grant execute on function public.get_admin_dashboard(uuid)                      to anon, authenticated;
grant execute on function public.admin_list_users(uuid)                         to anon, authenticated;
grant execute on function public.admin_list_news(uuid)                          to anon, authenticated;
grant execute on function public.admin_list_missions(uuid)                      to anon, authenticated;
grant execute on function public.admin_list_mission_submissions(uuid)           to anon, authenticated;
grant execute on function public.admin_list_rewards(uuid)                       to anon, authenticated;
grant execute on function public.admin_list_reward_redemptions(uuid)            to anon, authenticated;
grant execute on function public.admin_list_ledger(uuid)                        to anon, authenticated;
grant execute on function public.admin_list_manager_depts(uuid)                 to anon, authenticated;
grant execute on function public.admin_list_calendar_events(uuid)               to anon, authenticated;
grant execute on function public.admin_list_rule_board(uuid)                    to anon, authenticated;
grant execute on function public.admin_list_overall_activity(uuid)              to anon, authenticated;
grant execute on function public.admin_list_special_point_logs(uuid)            to anon, authenticated;

-- admin: write
grant execute on function public.admin_upsert_user(uuid,jsonb)                  to anon, authenticated;
grant execute on function public.admin_upsert_news(uuid,jsonb)                  to anon, authenticated;
grant execute on function public.admin_upsert_mission(uuid,jsonb)               to anon, authenticated;
grant execute on function public.admin_upsert_reward(uuid,jsonb)                to anon, authenticated;
grant execute on function public.admin_upsert_rule_board(uuid,jsonb)            to anon, authenticated;
grant execute on function public.admin_upsert_calendar_event(uuid,jsonb)        to anon, authenticated;
grant execute on function public.admin_delete_user(uuid,text)                   to anon, authenticated;
grant execute on function public.admin_delete_news(uuid,text)                   to anon, authenticated;
grant execute on function public.admin_delete_mission(uuid,text)                to anon, authenticated;
grant execute on function public.admin_delete_reward(uuid,text)                 to anon, authenticated;
grant execute on function public.admin_delete_rule_board(uuid,bigint)           to anon, authenticated;
grant execute on function public.admin_delete_calendar_event(uuid,bigint)       to anon, authenticated;
grant execute on function public.admin_save_manager_depts_batch(uuid,jsonb)     to anon, authenticated;
grant execute on function public.admin_review_mission_submission(uuid,bigint,text,text) to anon, authenticated;
grant execute on function public.admin_update_reward_redemption(uuid,text,text,text)    to anon, authenticated;
grant execute on function public.admin_add_special_points(uuid,text,text,text,int,text) to anon, authenticated;
grant execute on function public.admin_reset_password(uuid,text,text)           to anon, authenticated;

-- 11.3b ฟังก์ชันที่ RLS policy ในไฟล์ 10_ อ้างถึง
--       ตอนนี้ยังไม่มีผล เพราะ anon/authenticated ถูกตัดสิทธิ์ตารางไปแล้ว
--       แต่ต้องคง execute ไว้ ไม่งั้นวันที่ย้ายไป Supabase Auth แล้วเปิดสิทธิ์ตารางกลับ policy จะพัง
grant execute on function public.current_emp_id()                               to authenticated;
grant execute on function public.is_admin()                                     to authenticated;
grant execute on function public.is_it_admin()                                  to authenticated;

-- 11.4 Apps Script (Drive) ใช้ service_role เท่านั้น ไม่แตะ anon
grant execute on function public.validate_public_session(uuid)                  to service_role;
grant execute on function public.validate_quotation_session_for_service(uuid)   to service_role;
grant execute on function public.sync_quotation_from_drive(uuid,jsonb)          to service_role;
grant execute on function public.reconcile_quotation_from_drive(jsonb)          to service_role;

-- 11.5 ฟังก์ชันภายในที่ห้าม anon แตะเด็ดขาด (ระบุซ้ำเพื่อความชัดเจนและกันพลาด)
revoke all on function public.add_point_transaction(text,public.point_tx_type,integer,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.process_checkin(text)                  from public, anon, authenticated;
revoke all on function public.recalc_user_points(text)               from public, anon, authenticated;
revoke all on function public.sb_redeem_reward(text,text)            from public, anon, authenticated;
revoke all on function public.sb_count_guessable_first_login()       from public, anon, authenticated;
revoke all on function public.sb_rotate_guessable_first_login()      from public, anon, authenticated;
revoke all on table public.first_login_handout                       from public, anon, authenticated;
revoke all on function public.sb_hash_password(text)                 from public, anon, authenticated;
revoke all on function public.sb_verify_password(text,text)          from public, anon, authenticated;
revoke all on function public.sb_is_valid_password(text)             from public, anon, authenticated;
revoke all on function public.sb_generate_temp_password()            from public, anon, authenticated;
revoke all on function public.sb_cleanup_expired()                   from public, anon, authenticated;
revoke all on function public.sb_client_ip()                         from public, anon, authenticated;
revoke all on function public.public_session_emp_id(uuid)            from public, anon, authenticated;
revoke all on function public.public_session_role(uuid)              from public, anon, authenticated;
revoke all on function public.public_session_is_admin(uuid)          from public, anon, authenticated;
revoke all on function public.write_activity_log(text,text,text,text,text,text,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.admin_reset_user_password(uuid,text,text) from public, anon, authenticated;
