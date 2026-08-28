-- =============================================================================
-- 20_PASSWORD_RESET_REQUEST.sql
-- ระบบ "ลืมรหัสผ่าน" แบบไม่ต้องใช้อีเมลของพนักงาน และไม่ต้องเสียเงินค่า SMS OTP
-- รันหลัง 19_ ไฟล์นี้ idempotent รันซ้ำได้
--
-- วิธีทำงาน
--   1. พนักงานกด "ลืมรหัสผ่าน" ที่หน้า login แล้วกรอกรหัสพนักงานของตัวเอง
--   2. ระบบสุ่มรหัส 6 หลัก (A-Z + 0-9) เก็บเป็น hash ไว้ในฐาน มีอายุ 24 ชั่วโมง
--   3. Google Apps Script ส่งอีเมลไปหา dev พร้อมข้อมูลพนักงาน + รหัส 6 หลัก
--   4. dev ติดต่อพนักงานแล้วบอกรหัส
--   5. พนักงานเอารหัส 6 หลักมา login แทนรหัสผ่าน แล้วระบบบังคับตั้งรหัสใหม่ทันที
--
-- จุดที่ออกแบบไว้กันปัญหา
--   - รหัสไม่เคยถูกส่งกลับไปที่เบราว์เซอร์ ผู้ขอจึงอ่านรหัสของคนอื่นไม่ได้
--   - "ไม่ทับรหัสเดิม" ของพนักงาน ถ้ามีคนแกล้งกดขอ เจ้าตัวยังใช้รหัสเดิมเข้าได้ตามปกติ
--   - จำกัดจำนวนคำขอ ทั้งรายคนและรวมทั้งระบบ กันคนสแปมกล่องจดหมายของ dev
--   - ตอบข้อความเดียวกันเสมอ ไม่ว่ารหัสพนักงานจะมีอยู่จริงหรือไม่ กันการไล่เดารหัสพนักงาน
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. ค่าตั้งค่า
-- -----------------------------------------------------------------------------

insert into public.app_settings(key, value, description, is_public)
values
  ('password_reset_notify_email', 'sbinterlab.carbeau@gmail.com',
   'อีเมลของผู้ดูแลระบบที่จะได้รับคำขอลืมรหัสผ่าน', false),
  ('password_reset_code_hours', '24',
   'อายุของรหัสชั่วคราว 6 หลัก หน่วยเป็นชั่วโมง', false),
  ('password_reset_max_per_user_day', '3',
   'จำนวนครั้งสูงสุดที่พนักงานหนึ่งคนขอรหัสใหม่ได้ต่อวัน', false),
  ('password_reset_max_per_hour', '30',
   'จำนวนคำขอรวมทั้งระบบต่อชั่วโมง กันสแปมกล่องจดหมายผู้ดูแล', false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. ตารางคำขอ - เก็บ hash ของรหัส ไม่เก็บตัวรหัสจริง
-- -----------------------------------------------------------------------------

create table if not exists public.password_reset_requests (
  request_id  bigserial primary key,
  emp_id      text not null references public.app_users(emp_id) on delete cascade,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  notified_at timestamptz,
  source_ip   text,
  user_agent  text
);

alter table public.password_reset_requests enable row level security;

create index if not exists idx_password_reset_emp_time
  on public.password_reset_requests (emp_id, created_at desc);
create index if not exists idx_password_reset_active
  on public.password_reset_requests (emp_id, expires_at desc)
  where used_at is null;

-- -----------------------------------------------------------------------------
-- 3. สุ่มรหัส 6 หลัก ตัดตัวอักษรที่อ่านสับสนออก (0 O 1 I L)
--    เหลือ 31 ตัวอักษร -> 31^6 ≈ 887 ล้านความเป็นไปได้ คู่กับ rate limit 5 ครั้ง/15 นาที
-- -----------------------------------------------------------------------------

create or replace function public.sb_generate_reset_code()
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_out text := '';
  i int;
begin
  for i in 1..6 loop
    v_out := v_out || substr(v_alphabet, 1 + floor(random() * char_length(v_alphabet))::int, 1);
  end loop;
  return v_out;
end $$;

-- -----------------------------------------------------------------------------
-- 4. RPC หลัก - เรียกได้เฉพาะ service_role (คือ Apps Script) เท่านั้น
--    เบราว์เซอร์เรียกตรงไม่ได้ จึงไม่มีทางอ่านรหัสของคนอื่น
-- -----------------------------------------------------------------------------

create or replace function public.request_password_reset(
  p_emp_id text,
  p_user_agent text default null,
  p_source_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
  v_code text;
  v_hours int;
  v_max_user int;
  v_max_hour int;
  v_count_user int;
  v_count_hour int;
  v_expires timestamptz;
  v_request_id bigint;
begin
  v_hours    := greatest(1, least(168, coalesce(nullif(btrim((select value from public.app_settings where key='password_reset_code_hours')),'')::int, 24)));
  v_max_user := greatest(1, coalesce(nullif(btrim((select value from public.app_settings where key='password_reset_max_per_user_day')),'')::int, 3));
  v_max_hour := greatest(1, coalesce(nullif(btrim((select value from public.app_settings where key='password_reset_max_per_hour')),'')::int, 30));

  -- เพดานรวมทั้งระบบ กันคนยิงถล่มกล่องจดหมายของผู้ดูแล
  select count(*) into v_count_hour
  from public.password_reset_requests
  where created_at > now() - interval '1 hour';
  if v_count_hour >= v_max_hour then
    return jsonb_build_object('status','throttled','send_email',false,
                             'reason','SYSTEM_RATE_LIMIT');
  end if;

  select * into u from public.app_users
  where lower(emp_id) = lower(btrim(coalesce(p_emp_id,'')))
    and status = 'active'
  limit 1;

  -- ไม่พบรหัสพนักงาน: ไม่ส่งเมล แต่ตอบเหมือนสำเร็จ ผู้เรียกจะแยกไม่ออก
  if not found then
    return jsonb_build_object('status','success','send_email',false,
                             'reason','UNKNOWN_EMP_ID');
  end if;

  select count(*) into v_count_user
  from public.password_reset_requests
  where emp_id = u.emp_id
    and created_at > now() - interval '24 hours';
  if v_count_user >= v_max_user then
    return jsonb_build_object('status','throttled','send_email',false,
                             'reason','USER_RATE_LIMIT');
  end if;

  v_code := public.sb_generate_reset_code();
  v_expires := now() + (v_hours || ' hours')::interval;

  -- ยกเลิกรหัสเก่าที่ยังไม่ถูกใช้ ให้เหลือใบเดียวที่ใช้ได้เสมอ
  update public.password_reset_requests
  set used_at = now()
  where emp_id = u.emp_id and used_at is null;

  insert into public.password_reset_requests(emp_id, code_hash, expires_at, source_ip, user_agent)
  values (u.emp_id, public.sb_hash_password(v_code), v_expires,
          left(coalesce(p_source_ip,''), 64), left(coalesce(p_user_agent,''), 400))
  returning request_id into v_request_id;

  insert into public.admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values (u.emp_id, 'REQUEST_PASSWORD_RESET', 'password_reset_requests', v_request_id::text,
          jsonb_build_object('expires_at', v_expires, 'ip', p_source_ip));

  return jsonb_build_object(
    'status','success',
    'send_email', true,
    'request_id', v_request_id,
    'notify_email', coalesce(nullif(btrim((select value from public.app_settings where key='password_reset_notify_email')),''),
                             'sbinterlab.carbeau@gmail.com'),
    'code', v_code,
    'expires_at', v_expires,
    'employee', jsonb_build_object(
      'emp_id', u.emp_id,
      'full_name', btrim(concat_ws(' ', u.name_th, u.surname_th)),
      'nickname', u.nickname_th,
      'department', u.dept_th,
      'position', u.pos_th,
      'phone', u.phone,
      'email', u.email
    )
  );
end $$;

-- บันทึกว่าอีเมลส่งออกไปแล้ว (Apps Script เรียกหลังส่งสำเร็จ)
create or replace function public.mark_password_reset_notified(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.password_reset_requests
  set notified_at = now()
  where request_id = p_request_id;
  return jsonb_build_object('status','success');
end $$;

-- -----------------------------------------------------------------------------
-- 5. login - ยอมรับรหัส 6 หลักเป็นทางเข้าสำรอง
--    สำคัญ: ไม่ทับรหัสเดิมของพนักงาน ถ้ามีคนแกล้งกดขอ เจ้าตัวยังใช้รหัสเดิมได้ปกติ
--    รหัส 6 หลักใช้ได้ครั้งเดียว ใช้แล้วระบบบังคับตั้งรหัสใหม่ทันที
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
  r public.password_reset_requests%rowtype;
  v_token uuid;
  v_must_change boolean;
  v_password_ok boolean := false;
  v_via_reset boolean := false;
  v_failed_by_user integer;
  v_failed_by_ip integer;
  v_window_expires timestamptz;
  v_emp_input text := lower(btrim(coalesce(p_emp_id,'')));
  v_ip text := public.sb_client_ip();
  v_ua text := left(coalesce(p_user_agent,''), 400);
begin
  if v_emp_input = '' or coalesce(p_password,'') = '' then
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  -- ---- rate limit ต่อ emp_id ----
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

  -- ---- rate limit ต่อ IP กัน password spraying ข้ามหลายบัญชี ----
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
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  -- ---- ทางเข้าที่ 1: รหัสผ่านปกติ ----
  v_password_ok := public.sb_verify_password(coalesce(p_password,''), c.password_hash);

  -- ---- ทางเข้าที่ 2: รหัส 6 หลักจากการขอลืมรหัสผ่าน ----
  if not v_password_ok then
    select * into r
    from public.password_reset_requests
    where emp_id = u.emp_id
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;

    if found and public.sb_verify_password(coalesce(p_password,''), r.code_hash) then
      v_password_ok := true;
      v_via_reset := true;
    end if;
  end if;

  if not v_password_ok then
    insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
    values (u.emp_id, false, 'INVALID_CREDENTIALS', v_ua, v_ip);
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  -- ---- เข้าด้วยรหัส 6 หลัก: เผารหัสทิ้ง แล้วบังคับตั้งรหัสใหม่ ----
  if v_via_reset then
    v_window_expires := now() + interval '2 hours';

    update public.password_reset_requests
    set used_at = now()
    where emp_id = u.emp_id and used_at is null;

    update public.user_credentials
    set must_change = true, reset_at = now()
    where emp_id = u.emp_id;

    update public.app_users
    set force_password_change = true,
        first_login_expires_at = v_window_expires,
        password_reset_at = now(),
        updated_at = now()
    where emp_id = u.emp_id;

    -- ตัด session เดิมทั้งหมด กันกรณีบัญชีถูกยึดไปก่อนหน้า
    update public.public_sessions
    set revoked_at = now()
    where emp_id = u.emp_id and revoked_at is null;

    c.must_change := true;
    u.force_password_change := true;
    u.first_login_expires_at := v_window_expires;

    insert into public.admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
    values (u.emp_id, 'LOGIN_WITH_RESET_CODE', 'password_reset_requests', r.request_id::text,
            jsonb_build_object('ip', v_ip));
  end if;

  -- ---- ด่านหน้าต่างเวลาสำหรับบัญชีที่ยังไม่เคยตั้งรหัสเอง ----
  if coalesce(c.must_change, false) then
    if u.first_login_expires_at is null then
      insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
      values (u.emp_id, false, 'FIRST_LOGIN_NOT_OPENED', v_ua, v_ip);
      return jsonb_build_object('status','error',
        'message','บัญชีนี้ยังไม่ได้เปิดให้ตั้งรหัสผ่านครั้งแรก กรุณาติดต่อผู้ดูแลระบบ');
    end if;

    if now() > u.first_login_expires_at then
      insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
      values (u.emp_id, false, 'FIRST_LOGIN_EXPIRED', v_ua, v_ip);
      return jsonb_build_object('status','error',
        'message','หมดเวลาตั้งรหัสผ่านครั้งแรกแล้ว กรุณากดลืมรหัสผ่านเพื่อขอรหัสใหม่');
    end if;
  end if;

  v_must_change := coalesce(c.must_change, false) or coalesce(u.force_password_change, false);

  -- เก็บ session ที่ยังมีชีวิตไว้ไม่เกิน 4 เครื่องต่อคน
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
  values (u.emp_id, true, case when v_via_reset then 'SUCCESS_RESET_CODE' else 'SUCCESS' end, v_ua, v_ip);

  return jsonb_build_object(
    'status','success',
    'token', v_token,
    'mustChangePassword', v_must_change,
    'viaResetCode', v_via_reset,
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
-- 6. เปลี่ยนรหัสสำเร็จ = เผารหัสลืมรหัสผ่านที่ค้างอยู่ทิ้งด้วย
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
  if lower(btrim(p_new_password)) = lower(public.sb_first_login_password()) then
    return jsonb_build_object('status','error','message','ห้ามใช้รหัสกลางเป็นรหัสผ่านของตัวเอง');
  end if;
  if lower(btrim(p_new_password)) = lower(v_emp_id) then
    return jsonb_build_object('status','error','message','ห้ามใช้รหัสพนักงานของตัวเองเป็นรหัสผ่าน');
  end if;

  select * into c from public.user_credentials where emp_id = v_emp_id;
  if not found then
    return jsonb_build_object('status','error','message','ไม่พบข้อมูลรหัสผ่านเดิม');
  end if;

  select coalesce(c.must_change,false) or coalesce(u.force_password_change,false)
  into v_must_change
  from public.app_users u where u.emp_id = v_emp_id;

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
  set force_password_change = false,
      password_changed_at = now(),
      first_login_expires_at = null,
      updated_at = now()
  where emp_id = v_emp_id;

  -- รหัสลืมรหัสผ่านที่ยังค้างอยู่ ใช้ไม่ได้อีกต่อไป
  update public.password_reset_requests
  set used_at = now()
  where emp_id = v_emp_id and used_at is null;

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
-- 7. รายงานคำขอที่ยังไม่ถูกใช้ ให้ dev ดูย้อนหลังได้
-- -----------------------------------------------------------------------------

create or replace view public.v_password_reset_pending
with (security_invoker = true) as
select
  q.request_id,
  q.emp_id,
  btrim(concat_ws(' ', u.name_th, u.surname_th)) as full_name,
  u.dept_th,
  u.pos_th,
  q.created_at,
  q.expires_at,
  q.notified_at,
  case
    when q.used_at is not null    then 'ใช้แล้ว'
    when now() > q.expires_at     then 'หมดอายุ'
    when q.notified_at is null    then 'ยังส่งเมลไม่สำเร็จ'
    else 'รอพนักงานใช้'
  end as state
from public.password_reset_requests q
join public.app_users u on u.emp_id = q.emp_id
order by q.created_at desc;

-- ล้างคำขอเก่าไปพร้อมกับงานล้างอื่น ๆ
create or replace function public.sb_cleanup_expired()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sessions bigint;
  v_logins bigint;
  v_resets bigint;
begin
  delete from public.public_sessions where expires_at < now() - interval '7 days';
  get diagnostics v_sessions = row_count;

  delete from public.login_attempt_logs where created_at < now() - interval '90 days';
  get diagnostics v_logins = row_count;

  delete from public.password_reset_requests where created_at < now() - interval '90 days';
  get diagnostics v_resets = row_count;

  return jsonb_build_object('status','success','sessions_deleted',v_sessions,
                            'login_logs_deleted',v_logins,'reset_requests_deleted',v_resets);
end $$;

commit;

-- =============================================================================
-- 8. สิทธิ์
--    request_password_reset ให้เฉพาะ service_role (Apps Script) ห้าม anon เด็ดขาด
--    ถ้าเปิดให้ anon = ใครก็ขอรหัสของคนอื่นแล้วอ่านรหัสจาก Network tab ได้ทันที
-- =============================================================================

revoke all on function public.request_password_reset(text,text,text)   from public, anon, authenticated;
revoke all on function public.mark_password_reset_notified(bigint)     from public, anon, authenticated;
revoke all on function public.sb_generate_reset_code()                 from public, anon, authenticated;
revoke all on function public.sb_cleanup_expired()                     from public, anon, authenticated;
revoke all on table    public.password_reset_requests                  from public, anon, authenticated;
revoke all on table    public.v_password_reset_pending                 from public, anon, authenticated;

grant execute on function public.request_password_reset(text,text,text) to service_role;
grant execute on function public.mark_password_reset_notified(bigint)   to service_role;

-- ฟังก์ชันที่ frontend เรียก ต้อง grant กลับหลัง create or replace
grant execute on function public.login_with_emp_password(text,text,text) to anon, authenticated;
grant execute on function public.change_my_password(uuid,text,text,text) to anon, authenticated;

-- =============================================================================
-- 9. แจ้งสถานะ
-- =============================================================================

do $$
declare v_email text; v_hours int;
begin
  select value into v_email from public.app_settings where key = 'password_reset_notify_email';
  select value::int into v_hours from public.app_settings where key = 'password_reset_code_hours';
  raise notice '===============================================================';
  raise notice 'ติดตั้งระบบลืมรหัสผ่านเรียบร้อย';
  raise notice 'อีเมลผู้ดูแลที่จะได้รับคำขอ: %', v_email;
  raise notice 'อายุรหัส 6 หลัก: % ชั่วโมง', v_hours;
  raise notice '';
  raise notice 'อย่าลืม redeploy Google Apps Script ไม่งั้นปุ่มลืมรหัสผ่านจะไม่ส่งเมล';
  raise notice 'ดูคำขอย้อนหลัง:  select * from public.v_password_reset_pending;';
  raise notice '===============================================================';
end $$;
