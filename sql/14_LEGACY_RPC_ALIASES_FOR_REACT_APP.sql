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
