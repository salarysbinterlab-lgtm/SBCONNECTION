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
