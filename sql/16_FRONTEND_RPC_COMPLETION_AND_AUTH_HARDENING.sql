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
