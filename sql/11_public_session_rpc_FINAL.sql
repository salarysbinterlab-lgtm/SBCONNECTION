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

create or replace function public.prepare_first_login_credentials(p_temp_password text default '1234')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_count int;
begin
  insert into user_credentials(emp_id, password_hash, must_change, reset_at)
  select u.emp_id, public.sb_hash_password(p_temp_password), true, now()
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

create or replace function public.admin_reset_user_password(p_token uuid, p_target_emp_id text, p_temp_password text default '1234')
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
