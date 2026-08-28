-- =============================================================================
-- 19_FIRST_LOGIN_SHARED_PASSWORD.sql
-- ระบบรหัสกลางสำหรับเข้าครั้งแรก + จำกัดเวลา
-- รันหลัง 17_ (และ 18_ ถ้าอยากตรวจก่อน) ไฟล์นี้ idempotent รันซ้ำได้
--
-- แนวคิด
--   พนักงานทุกคนเข้าครั้งแรกด้วย "รหัสกลาง" ตัวเดียวกัน แล้วระบบบังคับตั้งรหัสใหม่ทันที
--   HR ไม่ต้องแจกรหัสรายคน ไม่ต้องใช้อีเมล ไม่ต้องใช้ SMS OTP
--
-- ความเสี่ยงที่ต้องรู้ และวิธีที่ไฟล์นี้ใช้ปิด
--   ถ้ารหัสกลางใช้ได้ตลอดไป ใครที่รู้รหัสพนักงานของเพื่อนร่วมงานจะเข้าบัญชีนั้น
--   ก่อนเจ้าตัวได้ แล้วตั้งรหัสใหม่ทับ = ยึดบัญชีไปเลย
--   => ไฟล์นี้ให้รหัสกลางใช้ได้เฉพาะ "ในช่วงเวลาที่แอดมินเปิดให้" (ค่าเริ่มต้น 7 วัน)
--      พ้นกำหนดแล้วรหัสกลางใช้ไม่ได้ ต้องให้แอดมินกดเปิดใหม่
--      หน้าต่างความเสี่ยงจึงแคบลงจาก "ตลอดไป" เหลือ "เท่าที่แอดมินตั้งใจเปิด"
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. ค่าตั้งค่า - แก้ได้ภายหลังโดยไม่ต้องแตะโค้ด
-- -----------------------------------------------------------------------------

insert into public.app_settings(key, value, description, is_public)
values
  ('first_login_password', 'SBstart2026',
   'รหัสกลางสำหรับเข้าครั้งแรก ระบบจะบังคับตั้งรหัสใหม่ทันทีหลังเข้าสำเร็จ', false),
  ('first_login_window_days', '7',
   'จำนวนวันที่รหัสกลางใช้ได้ นับจากวันที่แอดมินเปิดให้ พ้นกำหนดต้องเปิดใหม่', false)
on conflict (key) do nothing;

-- วิธีเปลี่ยนค่าภายหลัง (รันใน SQL Editor)
--   update public.app_settings set value = 'รหัสใหม่ของคุณ' where key = 'first_login_password';
--   update public.app_settings set value = '14'            where key = 'first_login_window_days';

-- -----------------------------------------------------------------------------
-- 2. คอลัมน์เก็บกำหนดหมดอายุของหน้าต่างเข้าครั้งแรก
-- -----------------------------------------------------------------------------

alter table public.app_users
  add column if not exists first_login_expires_at timestamptz;

alter table public.app_users
  add column if not exists first_login_opened_by text;

comment on column public.app_users.first_login_expires_at is
  'รหัสกลางใช้ได้ถึงเมื่อไหร่ null = ยังไม่เปิดให้เข้าครั้งแรก';

create index if not exists idx_app_users_first_login_window
  on public.app_users (first_login_expires_at)
  where first_login_expires_at is not null;

-- -----------------------------------------------------------------------------
-- 3. helper อ่านค่าตั้งค่า
-- -----------------------------------------------------------------------------

create or replace function public.sb_first_login_password()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(nullif(btrim((select value from public.app_settings where key = 'first_login_password')), ''),
                  'SBstart2026')
$$;

create or replace function public.sb_first_login_window()
returns interval
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (greatest(1, least(90,
           coalesce(nullif(btrim((select value from public.app_settings where key = 'first_login_window_days')), '')::int, 7)
         )) || ' days')::interval
$$;

-- -----------------------------------------------------------------------------
-- 4. เปิดหน้าต่างเข้าครั้งแรกให้พนักงาน 1 คน (ฟังก์ชันภายใน)
--    ใช้ทั้งตอนสร้างผู้ใช้ใหม่ และตอนแอดมินกดรีเซ็ตรหัส
-- -----------------------------------------------------------------------------

create or replace function public.sb_open_first_login(
  p_emp_id text,
  p_actor_emp_id text default null,
  p_custom_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password text;
  v_expires timestamptz;
begin
  if not exists (select 1 from public.app_users where emp_id = p_emp_id) then
    raise exception 'invalid emp_id';
  end if;

  -- ปกติใช้รหัสกลาง แต่ถ้าแอดมินระบุรหัสเฉพาะรายมาก็ใช้ตามนั้น
  v_password := nullif(btrim(coalesce(p_custom_password, '')), '');
  if v_password is null then
    v_password := public.sb_first_login_password();
  end if;

  v_expires := now() + public.sb_first_login_window();

  insert into public.user_credentials(emp_id, password_hash, must_change, reset_at, reset_by_emp_id)
  values (p_emp_id, public.sb_hash_password(v_password), true, now(), p_actor_emp_id)
  on conflict (emp_id) do update set
    password_hash  = excluded.password_hash,
    must_change    = true,
    reset_at       = now(),
    reset_by_emp_id = p_actor_emp_id;

  update public.app_users
  set force_password_change  = true,
      password_reset_at      = now(),
      password_reset_by_emp_id = p_actor_emp_id,
      first_login_expires_at = v_expires,
      first_login_opened_by  = p_actor_emp_id,
      updated_at             = now()
  where emp_id = p_emp_id;

  -- ปิด session เดิมทั้งหมดของคนนี้ กันกรณีถูกยึดบัญชีไปก่อนหน้า
  update public.public_sessions
  set revoked_at = now()
  where emp_id = p_emp_id and revoked_at is null;

  return jsonb_build_object(
    'status','success',
    'emp_id', p_emp_id,
    'password', v_password,
    'expires_at', v_expires
  );
end $$;

-- -----------------------------------------------------------------------------
-- 5. login - บังคับหน้าต่างเวลาสำหรับบัญชีที่ยังไม่เคยตั้งรหัสเอง
--    ทุกอย่างอื่นเหมือน 17_ (rate limit ต่อ emp_id + ต่อ IP, ข้อความ error กลาง ๆ)
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

  if not public.sb_verify_password(coalesce(p_password,''), c.password_hash) then
    insert into public.login_attempt_logs(emp_id, success, reason, user_agent, ip_address)
    values (u.emp_id, false, 'INVALID_CREDENTIALS', v_ua, v_ip);
    return jsonb_build_object('status','error','message','รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  end if;

  -- ===========================================================================
  -- ด่านหน้าต่างเวลา: ใช้เฉพาะบัญชีที่ยังอยู่ในสถานะ "ต้องตั้งรหัสใหม่"
  -- บัญชีที่ตั้งรหัสเองแล้ว (must_change = false) ไม่โดนด่านนี้
  -- ===========================================================================
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
        'message','หมดเวลาตั้งรหัสผ่านครั้งแรกแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดให้ใหม่');
    end if;
  end if;

  v_must_change := coalesce(c.must_change, false) or coalesce(u.force_password_change, false);

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
-- 6. เปลี่ยนรหัสสำเร็จ = ปิดหน้าต่างเข้าครั้งแรกทิ้ง
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

  -- ห้ามตั้งรหัสใหม่เป็นรหัสกลาง ไม่งั้นบัญชีกลับไปอยู่ในสภาพที่ใครก็เดาได้
  if lower(btrim(p_new_password)) = lower(public.sb_first_login_password()) then
    return jsonb_build_object('status','error','message','ห้ามใช้รหัสกลางเป็นรหัสผ่านของตัวเอง');
  end if;

  -- ห้ามตั้งรหัสใหม่เป็นรหัสพนักงานของตัวเอง
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
      first_login_expires_at = null,   -- ปิดหน้าต่างทิ้ง ใช้รหัสกลางกับบัญชีนี้ไม่ได้อีก
      updated_at = now()
  where emp_id = v_emp_id;

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
-- 7. แอดมินกดรีเซ็ตรหัส = เปิดหน้าต่างเข้าครั้งแรกให้ใหม่ด้วยรหัสกลาง
--    ไม่ต้องแจกรหัสสุ่มรายคนอีกต่อไป
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
  v_custom text;
  v_result jsonb;
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

  -- ปล่อยว่างไว้ = ใช้รหัสกลาง (แนะนำ) ใส่มา = ตั้งรหัสเฉพาะรายให้คนนี้
  v_custom := nullif(btrim(coalesce(p_temp_password,'')), '');
  if v_custom is not null then
    if lower(v_custom) = lower(v_target.emp_id) then
      return jsonb_build_object('status','error','message','ห้ามใช้รหัสพนักงานเป็นรหัสชั่วคราว');
    end if;
    if char_length(v_custom) < 4 then
      return jsonb_build_object('status','error','message','รหัสชั่วคราวต้องยาวอย่างน้อย 4 ตัว');
    end if;
  end if;

  v_result := public.sb_open_first_login(v_target.emp_id, v_actor, v_custom);

  insert into public.admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values (v_actor, 'ADMIN_OPEN_FIRST_LOGIN', 'user_credentials', v_target.emp_id,
          jsonb_build_object('expires_at', v_result->>'expires_at',
                             'used_shared_password', (v_custom is null),
                             'ip', public.sb_client_ip()));

  return jsonb_build_object(
    'status','success',
    'emp_id', v_target.emp_id,
    'temp_password', v_result->>'password',
    'expires_at', v_result->>'expires_at',
    'message', 'เปิดให้ตั้งรหัสผ่านครั้งแรกแล้ว ใช้รหัส ' || (v_result->>'password') ||
               ' ภายในวันที่ ' || to_char((v_result->>'expires_at')::timestamptz, 'DD/MM/YYYY HH24:MI')
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
-- 8. สร้างผู้ใช้ใหม่จากหน้าแอดมิน = เปิดหน้าต่างเข้าครั้งแรกให้อัตโนมัติ
--    (เดิมตั้งรหัสเริ่มต้นเป็น "รหัสพนักงานของตัวเอง" ซึ่งเดาได้ทันที)
-- -----------------------------------------------------------------------------

create or replace function public.admin_upsert_user(p_token uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor text;
  v_emp_id text;
  v_is_new boolean;
  v_has_credential boolean;
  v_open jsonb := null;
  v_custom text;
begin
  if not public.public_session_is_admin(p_token) then
    return jsonb_build_object('status','error','message','ADMIN_ONLY');
  end if;
  v_actor := public.public_session_emp_id(p_token);
  v_emp_id := btrim(coalesce(p_payload->>'emp_id',''));
  if v_emp_id = '' then
    return jsonb_build_object('status','error','message','EMP_ID_REQUIRED');
  end if;

  select not exists(select 1 from public.app_users where emp_id = v_emp_id) into v_is_new;

  insert into public.app_users(emp_id, name_th, dept_th, pos_th, role, status, force_password_change, password_policy)
  values (
    v_emp_id, p_payload->>'full_name', p_payload->>'department', p_payload->>'position',
    coalesce(nullif(p_payload->>'role',''),'user')::public.app_role,
    case when upper(coalesce(p_payload->>'status','ACTIVE')) = 'INACTIVE'
         then 'inactive'::public.user_status else 'active'::public.user_status end,
    true, 'min8-letter-digit'
  )
  on conflict (emp_id) do update set
    name_th = excluded.name_th,
    dept_th = excluded.dept_th,
    pos_th  = excluded.pos_th,
    role    = excluded.role,
    status  = excluded.status,
    updated_at = now();

  select exists(select 1 from public.user_credentials where emp_id = v_emp_id) into v_has_credential;

  -- คนใหม่ หรือคนที่ยังไม่มีรหัสผ่านเลย -> เปิดหน้าต่างเข้าครั้งแรกให้
  if v_is_new or not v_has_credential then
    v_custom := nullif(btrim(coalesce(p_payload->>'temp_password','')), '');
    if v_custom is not null and lower(v_custom) = lower(v_emp_id) then
      return jsonb_build_object('status','error','message','ห้ามใช้รหัสพนักงานเป็นรหัสชั่วคราว');
    end if;
    v_open := public.sb_open_first_login(v_emp_id, v_actor, v_custom);
  end if;

  insert into public.admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values (v_actor, case when v_is_new then 'CREATE_USER' else 'UPDATE_USER' end, 'app_users', v_emp_id,
          jsonb_build_object('role', p_payload->>'role', 'status', p_payload->>'status',
                             'first_login_opened', (v_open is not null)));

  return jsonb_build_object(
    'status','success',
    'id', v_emp_id,
    'created', v_is_new,
    'temp_password', v_open->>'password',
    'expires_at', v_open->>'expires_at',
    'message', case
      when v_open is null then 'บันทึกข้อมูลพนักงานแล้ว'
      else 'เพิ่มพนักงานแล้ว ให้เข้าครั้งแรกด้วยรหัส ' || (v_open->>'password') ||
           ' ภายในวันที่ ' || to_char((v_open->>'expires_at')::timestamptz, 'DD/MM/YYYY HH24:MI')
    end
  );
end $$;

-- -----------------------------------------------------------------------------
-- 9. เปิดหน้าต่างให้ทั้งบริษัทพร้อมกัน (ใช้ตอนเปิดระบบครั้งแรก)
--    ฟังก์ชันนี้ anon เรียกไม่ได้ ต้องรันจาก SQL Editor เท่านั้น
-- -----------------------------------------------------------------------------

create or replace function public.sb_open_first_login_for_all(p_only_unset boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select u.emp_id
    from public.app_users u
    left join public.user_credentials c on c.emp_id = u.emp_id
    where u.status = 'active'
      and (
        c.emp_id is null                              -- ยังไม่มีรหัสผ่านเลย
        or coalesce(c.must_change, false) = true      -- ยังไม่เคยตั้งรหัสเอง
      )
      and (
        p_only_unset = false
        or u.first_login_expires_at is null           -- ยังไม่เคยเปิดหน้าต่างให้
        or now() > u.first_login_expires_at           -- หรือหน้าต่างหมดอายุไปแล้ว
      )
  loop
    perform public.sb_open_first_login(r.emp_id, null, null);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'status','success',
    'opened', v_count,
    'password', public.sb_first_login_password(),
    'valid_until', now() + public.sb_first_login_window(),
    'note','แจ้งพนักงานให้เข้าระบบตั้งรหัสใหม่ภายในกำหนด พ้นกำหนดต้องให้แอดมินกดรีเซ็ตรายคน'
  );
end $$;

-- -----------------------------------------------------------------------------
-- 10. รายงานสถานะ - ใครยังไม่ตั้งรหัส เหลือเวลาเท่าไหร่
-- -----------------------------------------------------------------------------

create or replace view public.v_first_login_status
with (security_invoker = true) as
select
  u.emp_id,
  btrim(concat_ws(' ', u.name_th, u.surname_th)) as full_name,
  u.dept_th,
  u.status,
  coalesce(c.must_change, true) as needs_first_login,
  u.first_login_expires_at,
  case
    when coalesce(c.must_change, true) = false                 then 'ตั้งรหัสเองแล้ว'
    when u.first_login_expires_at is null                      then 'ยังไม่เปิดให้เข้า'
    when now() > u.first_login_expires_at                      then 'หมดเวลา ต้องเปิดใหม่'
    else 'เปิดอยู่ เหลือ ' || extract(day from u.first_login_expires_at - now())::int || ' วัน'
  end as first_login_state
from public.app_users u
left join public.user_credentials c on c.emp_id = u.emp_id
where u.status = 'active';

commit;

-- =============================================================================
-- 11. สิทธิ์ - ฟังก์ชันใหม่ทั้งหมดเป็นของภายใน anon ห้ามเรียกเด็ดขาด
--     (default privileges ถูกปิดไว้แล้วใน 17_ ตรงนี้ระบุซ้ำเพื่อความชัดเจน)
-- =============================================================================

revoke all on function public.sb_first_login_password()                  from public, anon, authenticated;
revoke all on function public.sb_first_login_window()                    from public, anon, authenticated;
revoke all on function public.sb_open_first_login(text,text,text)        from public, anon, authenticated;
revoke all on function public.sb_open_first_login_for_all(boolean)       from public, anon, authenticated;
revoke all on function public.admin_reset_user_password(uuid,text,text)  from public, anon, authenticated;
revoke all on table public.v_first_login_status                          from public, anon, authenticated;

-- ฟังก์ชันที่ frontend เรียก ต้อง grant กลับ เพราะ create or replace ไม่ได้รักษาสิทธิ์เดิมไว้เสมอ
grant execute on function public.login_with_emp_password(text,text,text) to anon, authenticated;
grant execute on function public.change_my_password(uuid,text,text,text) to anon, authenticated;
grant execute on function public.admin_reset_password(uuid,text,text)    to anon, authenticated;
grant execute on function public.admin_upsert_user(uuid,jsonb)           to anon, authenticated;

-- =============================================================================
-- 12. แจ้งสถานะหลังรันเสร็จ
-- =============================================================================

do $$
declare
  v_pending bigint;
  v_pw text;
begin
  select count(*) into v_pending
  from public.app_users u
  left join public.user_credentials c on c.emp_id = u.emp_id
  where u.status = 'active'
    and (c.emp_id is null or coalesce(c.must_change,false) = true);

  select public.sb_first_login_password() into v_pw;

  raise notice '===============================================================';
  raise notice 'ติดตั้งระบบรหัสกลางเรียบร้อย';
  raise notice 'รหัสกลางปัจจุบัน: %', v_pw;
  raise notice 'อายุหน้าต่าง: % วัน (แก้ได้ที่ app_settings.first_login_window_days)', extract(day from public.sb_first_login_window())::int;
  raise notice '';
  raise notice 'ยังมี % บัญชีที่ยังไม่เคยตั้งรหัสด้วยตัวเอง', v_pending;
  raise notice 'ถ้าพร้อมเปิดให้ทุกคนเข้าตั้งรหัส สั่ง:';
  raise notice '    select public.sb_open_first_login_for_all();';
  raise notice 'ดูสถานะรายคนได้ที่:  select * from public.v_first_login_status;';
  raise notice '===============================================================';
end $$;
