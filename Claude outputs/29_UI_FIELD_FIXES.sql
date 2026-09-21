-- =============================================================================
-- 29_UI_FIELD_FIXES.sql
--
-- แก้บั๊กที่พบจากการยิงทดสอบ RPC ทุกตัวบน PostgreSQL 16 จริง (21 ก.ย. 2569)
-- ทั้งหมดเป็นเรื่อง "ฐานข้อมูลส่งชื่อฟิลด์มาคนละชื่อกับที่หน้าเว็บอ่าน"
-- และบั๊ก SQL หนึ่งจุดที่ทำให้หน้าแอดมินพังทั้งแท็บ
--
-- สรุปสิ่งที่แก้
--   1. admin_list_overall_activity  พังทั้งฟังก์ชัน (อ้างคอลัมน์ created_at ที่ไม่มีอยู่จริง)
--   2. list_ranking                 ชื่อพนักงาน/แผนก/รูป ไม่ขึ้นในหน้าอันดับฝั่งผู้ใช้
--   3. list_my_overall_logs         ไม่มี source_type ทำให้ปฏิทินไม่ขึ้นเครื่องหมายวันที่เช็คอิน
--   4. get_home_dashboard           ไม่มีตัวนับ 4 ตัว ทำให้ปุ่มเช็คอินและการ์ดสถิติหน้าแรกไม่ทำงาน
--   5. recalc_user_points           แต้มพิเศษจาก HR ไม่ถูกนับเข้า "แต้มสะสมทั้งหมด"
--
-- หลักการเดียวกับไฟล์ 22_ คือ "ส่งกลับทั้งสองชื่อ" เพื่อไม่ต้องแก้หน้าเว็บ
-- และของเดิมที่เคยอ่านได้อยู่แล้วก็ยังอ่านได้เหมือนเดิม
--
-- รันซ้ำได้ ไม่ลบข้อมูลใดๆ
-- ต้องรันหลัง 22_ และหลัง 17_ (เพราะมีการ grant กลับท้ายไฟล์)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. admin_list_overall_activity
--
--    อาการ: แท็บ "Overall Activity Log" ฝั่งแอดมินขึ้น "ระบบขัดข้องชั่วคราว" ตลอด
--    สาเหตุ: union สาขาของ reward_redemptions เขียน select created_at
--            แต่ตารางนั้นใช้ชื่อคอลัมน์ว่า redeemed_at จึง throw ทั้งฟังก์ชัน
--    แถมสาขา user_missions ใช้ completed_at ซึ่งเป็น null ตอนที่ยังรออนุมัติ
--    ทำให้แถวนั้นหายไปจากรายงาน จึง coalesce กับ created_at ให้ด้วย
-- -----------------------------------------------------------------------------

create or replace function public.admin_list_overall_activity(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.public_session_is_admin(p_token) then return jsonb_build_array(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select
      created_at, action_group, action, actor_emp_id, target_emp_id,
      target_table, target_id, description
    from (
      select created_at, action_group, action, actor_emp_id, target_emp_id,
             target_table, target_id, description
      from public.activity_logs
      union all
      select created_at, 'admin', action, actor_emp_id, null, target_table, target_id,
             coalesce(after_data::text, '')
      from public.admin_audit_logs
      union all
      select created_at, 'auth', 'LOGIN', emp_id, emp_id, 'public_sessions',
             session_token::text, 'User login session created'
      from public.public_sessions
      union all
      select created_at, 'points', coalesce(source_type, tx_type::text), null, emp_id,
             'point_transactions', tx_id, description
      from public.point_transactions
      union all
      select redeemed_at, 'rewards', 'REDEEM', null, emp_id,
             'reward_redemptions', redemption_id, reward_name
      from public.reward_redemptions
      union all
      select created_at, 'activity', 'CHECKIN', null, emp_id, 'checkin_logs', log_id, status
      from public.checkin_logs
      union all
      select read_at, 'news', 'READ_NEWS', null, emp_id, 'user_news_reads', news_id, topic
      from public.user_news_reads
      union all
      select coalesce(completed_at, created_at), 'missions', 'COMPLETE_MISSION', null, emp_id,
             'user_missions', mission_id, status
      from public.user_missions
    ) unioned
    where created_at is not null
    order by created_at desc
    limit 1000
  ) x),'[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 2 + 3. public_page_payload
--
--    สาขา ranking  เดิมส่ง display_name เป็น title และ dept_th เป็น description
--                  แต่หน้าเว็บอ่าน full_name / department / avatar_url
--                  ผลคือหน้าอันดับฝั่งผู้ใช้ขึ้นเป็นรหัสพนักงาน แผนกเป็น "-"
--                  และรูปโปรไฟล์ตกไปใช้รูปสุ่มเสมอ
--    สาขา overall_log เดิมส่ง source_type ไปเป็น description
--                  หน้าเว็บกรอง l.source_type === 'CHECKIN' เพื่อลงเครื่องหมาย
--                  ในปฏิทิน จึงได้ชุดว่างเปล่าทุกครั้ง ปฏิทินไม่เคยขึ้นวันเช็คอินเลย
--
--    ทางแก้: ส่งกลับทั้งสองชื่อ ของเดิมไม่หาย ของใหม่เพิ่มเข้ามา
-- -----------------------------------------------------------------------------

create or replace function public.public_page_payload(p_token uuid, p_page text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_emp_id text;
  v_points integer;
  v_today  date := ((now() at time zone 'Asia/Bangkok')::date);
begin
  v_emp_id := public.public_session_emp_id(p_token);
  if v_emp_id is null then
    return jsonb_build_object('status','error','message','SESSION_EXPIRED');
  end if;
  select points into v_points from public.app_users where emp_id = v_emp_id;

  if p_page = 'news' then
    return jsonb_build_object('status','success','myPoints',v_points,'items',
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select n.news_id as id, n.news_id,
               n.topic, n.topic as title,
               n.detail, n.detail as description,
               n.image_url, n.points, n.status, n.publish_date, n.created_at,
               coalesce(r.id is not null,false) as done,
               coalesce(r.id is not null,false) as is_read
        from public.news_posts n
        left join public.user_news_reads r
               on r.news_id = n.news_id and r.emp_id = v_emp_id and r.read_day = v_today
        where n.status = 'active'
        order by n.pinned desc, n.publish_date desc nulls last, n.created_at desc
      ) x),'[]'::jsonb));

  elsif p_page = 'mission' then
    return jsonb_build_object('status','success','myPoints',v_points,'items',
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select m.mission_id as id, m.mission_id,
               m.title, m.title as topic,
               m.description, m.description as detail,
               m.image_url, m.points, m.status, m.created_at,
               m.requires_evidence, m.requires_approval,
               coalesce(um.id is not null,false) as done,
               coalesce(um.id is not null,false) as is_done
        from public.missions m
        left join public.user_missions um
               on um.mission_id = m.mission_id and um.emp_id = v_emp_id
        where m.status = 'active'
        order by m.created_at desc
      ) x),'[]'::jsonb));

  elsif p_page = 'rewards' then
    return jsonb_build_object('status','success','myPoints',v_points,'items',
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select reward_id as id, reward_id,
               name, name as title,
               detail, detail as description,
               image_url,
               points_required, points_required as points,
               stock, status, created_at,
               (coalesce(v_points,0) >= points_required and stock > 0) as can_redeem
        from public.rewards
        where status = 'active'
        order by points_required asc, created_at desc
      ) x),'[]'::jsonb));

  elsif p_page = 'ranking' then
    -- ส่งชื่อ/แผนก/รูป ทั้งแบบเดิมและแบบที่หน้าเว็บอ่าน
    return jsonb_build_object('status','success','myPoints',v_points,'items',
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select rank_no as id, rank_no,
               emp_id,
               display_name as title,
               display_name,
               display_name as full_name,
               display_name as name,
               dept_th as description,
               dept_th,
               dept_th as department,
               nickname_th,
               pos_th,
               avatar_url as image_url,
               avatar_url,
               avatar_url as avatar,
               points, total_earned, check_in_count
        from public.v_ranking order by rank_no asc
      ) x),'[]'::jsonb));

  elsif p_page = 'overall_log' then
    -- คงชื่อเดิมไว้ครบ แล้วเพิ่ม source_type / amount / tx_type / checkin_date
    return jsonb_build_object('status','success','myPoints',v_points,'items',
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select tx_id as id, tx_id,
               description as title,
               source_type as description,
               source_type,
               tx_type,
               amount as points,
               amount,
               balance_after,
               created_at,
               ((created_at at time zone 'Asia/Bangkok')::date) as checkin_date
        from public.point_transactions
        where emp_id = v_emp_id order by created_at desc limit 100
      ) x),'[]'::jsonb));
  end if;

  return jsonb_build_object('status','error','message','UNKNOWN_PAGE');
end $$;

-- -----------------------------------------------------------------------------
-- 4. get_home_dashboard
--
--    หน้าแรกอ่าน 4 ค่านี้ แต่ฐานข้อมูลไม่เคยส่งมาเลย
--      checked_in_today   -> ปุ่มเช็คอินไม่เคยเปลี่ยนเป็น "เช็คอินแล้ว"
--                            ผู้ใช้กดซ้ำแล้วเจอข้อความว่าเช็คอินไปแล้ว แทนที่ปุ่มจะถูกปิด
--      news_read_count    -> การ์ด "อ่านข่าวแล้ว" ขึ้น 0 ตลอด
--      mission_done_count -> การ์ด "ภารกิจสำเร็จ" ขึ้น 0 ตลอด
--      reward_count       -> การ์ด "แลกของรางวัล" ขึ้น 0 ตลอด
--    เพิ่ม checkin_dates ให้ด้วย เผื่อหน้าเว็บอยากวาดปฏิทินจากชุดวันที่ตรงๆ
-- -----------------------------------------------------------------------------

create or replace function public.get_home_dashboard(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  p jsonb;
  v_user jsonb;
  v_emp_id text;
  v_today date := ((now() at time zone 'Asia/Bangkok')::date);
  v_checked boolean := false;
  v_news int := 0;
  v_mission int := 0;
  v_reward int := 0;
  v_dates jsonb := '[]'::jsonb;
begin
  p := public.get_home_payload(p_token);
  if p->>'status' = 'error' then return p; end if;
  v_user := coalesce(p->'user','{}'::jsonb);
  v_emp_id := v_user->>'empId';

  -- แทนที่ news ด้วยชุดที่มี id และธงอ่านแล้วของวันนี้
  p := p || jsonb_build_object('news', public.sb_home_news(v_emp_id));

  select exists (select 1 from public.checkin_logs
                  where emp_id = v_emp_id and checkin_date = v_today)
    into v_checked;

  select count(*) into v_news
    from public.user_news_reads where emp_id = v_emp_id;

  select count(*) into v_mission
    from public.user_missions
   where emp_id = v_emp_id and lower(coalesce(status,'')) in ('completed','approved');

  select count(*) into v_reward
    from public.reward_redemptions
   where emp_id = v_emp_id and coalesce(status,'') <> 'Cancelled';

  select coalesce(jsonb_agg(d order by d desc), '[]'::jsonb) into v_dates
    from (select checkin_date as d from public.checkin_logs
           where emp_id = v_emp_id order by checkin_date desc limit 400) t;

  return p || jsonb_build_object(
    'points',            coalesce((v_user->>'points')::int,0),
    'checkin_count',     coalesce((v_user->>'checkInCount')::int,0),
    'last_checkin',      v_user->>'lastCheckIn',
    'latest_news',       coalesce(p->'news','[]'::jsonb),
    'top_ranking',       coalesce(p->'ranking','[]'::jsonb),
    'checked_in_today',  v_checked,
    'news_read_count',   v_news,
    'mission_done_count',v_mission,
    'reward_count',      v_reward,
    'checkin_dates',     v_dates
  );
end $$;

-- -----------------------------------------------------------------------------
-- 5. recalc_user_points
--
--    เดิมนับเฉพาะ tx_type = 'earn' เข้า total_earned เพื่อไม่ให้ refund โป่ง
--    แต่แต้มพิเศษที่ HR แจกถูกบันทึกเป็น tx_type = 'adjust'
--    ผลคือแต้มคงเหลือขึ้นถูก แต่ "แต้มสะสมทั้งหมด" ไม่ขยับ
--    (ทดสอบจริง: แจก 25 แต้ม -> points 36 แต่ total_earned ค้างที่ 16)
--
--    แก้เป็นนับทุกรายการที่ได้แต้มจริง คือ earn และ adjust ที่เป็นบวก
--    ส่วน refund ยังไม่นับเหมือนเดิม เพราะเป็นการคืนแต้มที่เคยใช้ไป
-- -----------------------------------------------------------------------------

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
         coalesce(sum(case when tx_type in ('earn','adjust') and amount > 0
                           then amount else 0 end), 0)
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

-- กติกาเดียวกันต้องอยู่ใน add_point_transaction ด้วย
-- ไม่งั้นทุกครั้งที่ HR แจกแต้มพิเศษใหม่ ตัวเลขจะเพี้ยนกลับไปเหมือนเดิม
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
        -- earn = ได้แต้มจากกิจกรรม, adjust ที่เป็นบวก = แต้มพิเศษที่ HR แจก
        -- refund ไม่นับ เพราะเป็นการคืนแต้มที่เคยใช้ไป ไม่ใช่การได้เพิ่ม
        when p_tx_type in ('earn','adjust') and p_amount > 0 then total_earned + p_amount
        else total_earned
      end
  where emp_id = p_emp_id;

  return query select v_tx_id, v_balance;
end $$;

-- คำนวณย้อนหลังให้ทุกคน เพื่อให้ total_earned ตรงกับกติกาใหม่ทันที
select public.recalc_user_points(emp_id) from public.app_users;

commit;

-- =============================================================================
-- เปิดสิทธิ์กลับ (ฟังก์ชันที่ create or replace จะรักษาสิทธิ์เดิมไว้อยู่แล้ว
-- แต่ระบุซ้ำเพื่อความชัดเจนและกันพลาดถ้ามีการรันเรียงไฟล์ใหม่)
-- =============================================================================

grant execute on function public.admin_list_overall_activity(uuid)  to anon, authenticated;
grant execute on function public.get_home_dashboard(uuid)           to anon, authenticated;

-- ฟังก์ชันภายใน ห้าม anon แตะ
revoke all on function public.public_page_payload(uuid,text) from public, anon, authenticated;
revoke all on function public.recalc_user_points(text)       from public, anon, authenticated;
revoke all on function public.add_point_transaction(text,public.point_tx_type,integer,text,text,text,jsonb) from public, anon, authenticated;
