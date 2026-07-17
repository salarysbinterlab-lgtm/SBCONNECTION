-- 94_EMP_ID_FIRST_LOGIN_PASSWORD.sql
-- Production patch: first login password must match employee ID.
-- Run this after the base schema/seed on Supabase SQL Editor.

begin;

create or replace function public.prepare_first_login_credentials(p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_count int;
begin
  insert into user_credentials(emp_id, password_hash, must_change, reset_at)
  select u.emp_id, public.sb_hash_password(coalesce(nullif(trim(p_temp_password), ''), u.emp_id)), true, now()
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

  return jsonb_build_object('status','success','created_credentials',v_count,'mode','emp_id_initial_password');
end $$;

create or replace function public.admin_reset_user_password(p_token uuid, p_target_emp_id text, p_temp_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_actor text; v_temp_password text;
begin
  if not public_session_is_admin(p_token) then return jsonb_build_object('status','error','message','ADMIN_ONLY'); end if;
  v_actor := public_session_emp_id(p_token);
  if not exists(select 1 from app_users where emp_id = p_target_emp_id) then
    return jsonb_build_object('status','error','message','Target employee ID not found');
  end if;

  v_temp_password := coalesce(nullif(trim(p_temp_password), ''), p_target_emp_id);

  insert into user_credentials(emp_id, password_hash, must_change, reset_at, reset_by_emp_id)
  values (p_target_emp_id, public.sb_hash_password(v_temp_password), true, now(), v_actor)
  on conflict (emp_id) do update
    set password_hash = excluded.password_hash,
        must_change = true,
        reset_at = now(),
        reset_by_emp_id = v_actor;

  update app_users
  set force_password_change = true,
      password_reset_at = now(),
      password_reset_by_emp_id = v_actor,
      updated_at = now()
  where emp_id = p_target_emp_id;

  insert into admin_audit_logs(actor_emp_id, action, target_table, target_id, after_data)
  values(v_actor,'RESET_PASSWORD','app_users',p_target_emp_id,jsonb_build_object('must_change',true,'initial_password','emp_id'));

  return jsonb_build_object('status','success','message','Reset password success: temporary password = employee ID');
end $$;

create or replace function public.admin_reset_password(p_token uuid, p_emp_id text, p_temp_password text default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.admin_reset_user_password(p_token, p_emp_id, p_temp_password)
$$;

-- Convert only accounts that are still in first-login/reset mode.
-- People who already changed their password (must_change=false) are left untouched.
update user_credentials c
set password_hash = public.sb_hash_password(c.emp_id),
    reset_at = now()
from app_users u
where u.emp_id = c.emp_id
  and u.status = 'active'
  and (coalesce(c.must_change, false) = true or coalesce(u.force_password_change, false) = true);

update app_users u
set force_password_change = true,
    password_reset_at = coalesce(password_reset_at, now()),
    updated_at = now()
where u.status = 'active'
  and exists (
    select 1
    from user_credentials c
    where c.emp_id = u.emp_id
      and coalesce(c.must_change, false) = true
  );

grant execute on function public.prepare_first_login_credentials(text) to anon, authenticated;
grant execute on function public.admin_reset_user_password(uuid,text,text) to anon, authenticated;
grant execute on function public.admin_reset_password(uuid,text,text) to anon, authenticated;

commit;
