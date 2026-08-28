-- =============================================================================
-- 18_VERIFY_SECURITY.sql
-- รันหลัง 17_ เพื่อพิสูจน์ว่า lockdown ทำงานจริง
-- ทุก query ควรได้ผลตามที่คอมเมนต์กำกับไว้ ถ้าไม่ตรง = ยังไม่ปลอดภัย
-- ไฟล์นี้อ่านอย่างเดียว ไม่แก้ข้อมูล
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CHECK 1: ต้องได้ 0 แถว
-- ฟังก์ชันภายในที่ anon ต้องห้ามเรียกเด็ดขาด ถ้ามีแถวออกมา = ยังปั๊มแต้มได้
-- -----------------------------------------------------------------------------
select 'CHECK1_FAIL' as check, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'add_point_transaction','process_checkin','recalc_user_points',
    'sb_redeem_reward','sb_hash_password','sb_verify_password','sb_is_valid_password',
    'sb_generate_temp_password','sb_cleanup_expired','sb_client_ip',
    'public_session_emp_id','public_session_role','public_session_is_admin',
    'write_activity_log','bootstrap_admin_staff_accounts','admin_reset_user_password',
    'quotation_sync_from_drive_core','sync_quotation_from_drive','reconcile_quotation_from_drive',
    'validate_quotation_session_for_service',
    'sb_first_login_password','sb_first_login_window','sb_open_first_login','sb_open_first_login_for_all',
    'request_password_reset','mark_password_reset_notified','sb_generate_reset_code'
  )
  and (
    has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute')
  );

-- -----------------------------------------------------------------------------
-- CHECK 2: ต้องได้ 0 แถว
-- ฟังก์ชันเก่าที่ควรถูกลบไปแล้ว
-- -----------------------------------------------------------------------------
select 'CHECK2_FAIL' as check, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    (p.proname = 'setup_first_password_no_credential')
    or (p.proname = 'prepare_first_login_credentials')
    or (p.proname = 'redeem_reward' and pg_get_function_identity_arguments(p.oid) = 'p_emp_id text, p_reward_id text')
    or (p.proname = 'submit_mission' and pg_get_function_identity_arguments(p.oid) = 'p_token uuid, p_mission_id text')
  );

-- -----------------------------------------------------------------------------
-- CHECK 3: ต้องได้ 0 แถว
-- anon/authenticated ต้องไม่มีสิทธิ์อ่านเขียนตารางใด ๆ ตรง ๆ
-- -----------------------------------------------------------------------------
select 'CHECK3_FAIL' as check, c.relname, r.rolname, p.privilege
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'),('authenticated')) as r(rolname)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) as p(privilege)
where n.nspname = 'public'
  and c.relkind in ('r','v','m','p')
  and has_table_privilege(r.rolname, c.oid, p.privilege);

-- -----------------------------------------------------------------------------
-- CHECK 4: รายการฟังก์ชันที่ anon เรียกได้ทั้งหมด (ควรมี 52 รายการพอดี)
-- ทุกตัวต้องรับ p_token uuid ยกเว้น login_with_emp_password
-- ตรวจด้วยตาว่าไม่มีชื่อแปลกปลอมโผล่มา
-- -----------------------------------------------------------------------------
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')
order by p.proname;

select count(*) as anon_callable_functions_should_be_52
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute');

-- -----------------------------------------------------------------------------
-- CHECK 5: ต้องได้ 0 แถว
-- ฟังก์ชัน SECURITY DEFINER ทุกตัวต้องตั้ง search_path ไว้ (กัน search_path hijack)
-- -----------------------------------------------------------------------------
select 'CHECK5_FAIL' as check, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) cfg where cfg like 'search\_path=%'
      ));

-- -----------------------------------------------------------------------------
-- CHECK 6: ต้องได้ 0 แถว
-- ไม่มีบัญชีไหนที่รหัสผ่านเดาได้แบบไม่มีวันหมดอายุ
-- (รหัสพนักงานของตัวเอง / 1234 / Admin123 — พวกนี้ใช้ได้ตลอดไป จึงอันตราย)
-- ถ้ายังมีแถว ให้รัน sql/19_ แล้วสั่ง  select public.sb_open_first_login_for_all();
-- -----------------------------------------------------------------------------
select 'CHECK6_FAIL' as check, c.emp_id
from public.user_credentials c
where public.sb_verify_password('Admin123', c.password_hash)
   or public.sb_verify_password('1234', c.password_hash)
   or public.sb_verify_password(c.emp_id, c.password_hash);

-- CHECK 6b: ต้องได้ 0 แถว
-- ตารางแจกรหัสชั่วคราวของ 17_ ต้องว่างเสมอ (มี plaintext อยู่ข้างใน)
-- ถ้าใช้ระบบรหัสกลางของ 19_ ตารางนี้จะไม่ถูกใช้เลย
-- -----------------------------------------------------------------------------
select 'CHECK6B_FAIL' as check, count(*) as rows_left
from public.first_login_handout
having count(*) > 0;

-- CHECK 6c: ต้องได้ 0 แถว
-- บัญชีที่ยังต้องตั้งรหัสครั้งแรก แต่ไม่มีกำหนดหมดอายุ
-- = รหัสกลางใช้กับบัญชีนี้ได้ตลอดไป ซึ่งคือสิ่งที่ระบบหน้าต่างเวลาตั้งใจป้องกัน
-- -----------------------------------------------------------------------------
select 'CHECK6C_FAIL' as check, u.emp_id, u.dept_th
from public.app_users u
join public.user_credentials c on c.emp_id = u.emp_id
where u.status = 'active'
  and coalesce(c.must_change, false) = true
  and u.first_login_expires_at is null;

-- CHECK 6d: รายงาน ไม่ใช่ข้อผิดพลาด
-- ช่วงเปิดให้พนักงานตั้งรหัสครั้งแรก จะมีแถวตรงนี้เป็นเรื่องปกติ
-- ตัวเลขควรลดลงเรื่อย ๆ จนเป็น 0 เมื่อทุกคนตั้งรหัสเองครบ
-- -----------------------------------------------------------------------------
select 'CHECK6D_INFO' as check,
       count(*) filter (where now() <= u.first_login_expires_at) as window_open,
       count(*) filter (where now() >  u.first_login_expires_at) as window_expired
from public.app_users u
join public.user_credentials c on c.emp_id = u.emp_id
where u.status = 'active'
  and coalesce(c.must_change, false) = true
  and u.first_login_expires_at is not null;

-- -----------------------------------------------------------------------------
-- CHECK 7: ต้องได้ 0 แถว
-- points / total_earned ต้องตรงกับ ledger
-- -----------------------------------------------------------------------------
select 'CHECK7_FAIL' as check, u.emp_id, u.points, agg.points as ledger_points,
       u.total_earned, agg.earned as ledger_earned
from public.app_users u
join (
  select emp_id,
         coalesce(sum(amount),0) as points,
         coalesce(sum(case when tx_type = 'earn' and amount > 0 then amount else 0 end),0) as earned
  from public.point_transactions
  group by emp_id
) agg on agg.emp_id = u.emp_id
where u.points <> greatest(agg.points,0) or u.total_earned <> agg.earned;

-- -----------------------------------------------------------------------------
-- CHECK 8: ต้องได้ 0 แถว
-- ทุก transaction ประเภท earn ต้องมีต้นทางที่ระบุได้ (กันแต้มที่ถูกยัดเข้ามาลอย ๆ)
-- ถ้าเจอแถว = เคยถูกใช้ช่องโหว่ C1 มาก่อน ให้ตรวจ metadata และลบทิ้ง
-- -----------------------------------------------------------------------------
select 'CHECK8_REVIEW' as check, tx_id, emp_id, amount, description, source_type, source_id, created_at
from public.point_transactions
where tx_type = 'earn'
  and coalesce(source_type,'') not in ('CHECKIN','MISSION','NEWS','ADMIN_SPECIAL','REFERRAL','REWARD_REFUND')
order by created_at desc
limit 200;

-- -----------------------------------------------------------------------------
-- CHECK 9: ต้องได้ 0 แถว
-- รหัสชั่วคราวที่ยังไม่ถูกใช้และยังไม่หมดอายุ ต้องมีไม่เกิน 1 ใบต่อคน
-- (ขอใบใหม่ = ใบเก่าถูกยกเลิกอัตโนมัติ)
-- -----------------------------------------------------------------------------
select 'CHECK9_FAIL' as check, emp_id, count(*) as active_codes
from public.password_reset_requests
where used_at is null and expires_at > now()
group by emp_id
having count(*) > 1;

-- -----------------------------------------------------------------------------
-- CHECK 10: รายงาน คำขอลืมรหัสผ่านที่ยังรออยู่
-- ถ้ามีแถวที่ state = 'ยังส่งเมลไม่สำเร็จ' แปลว่า Apps Script ส่งอีเมลไม่ออก
-- ให้ไปตรวจ Script Properties และสิทธิ์ MailApp
-- -----------------------------------------------------------------------------
select * from public.v_password_reset_pending limit 20;
