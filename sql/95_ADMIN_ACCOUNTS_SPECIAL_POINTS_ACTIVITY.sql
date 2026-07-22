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
