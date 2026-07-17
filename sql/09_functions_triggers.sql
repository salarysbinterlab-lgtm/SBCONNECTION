-- 09_functions_triggers.sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_app_users_updated_at on app_users;
create trigger trg_app_users_updated_at
before update on app_users
for each row execute function set_updated_at();

drop trigger if exists trg_missions_updated_at on missions;
create trigger trg_missions_updated_at
before update on missions
for each row execute function set_updated_at();

drop trigger if exists trg_news_posts_updated_at on news_posts;
create trigger trg_news_posts_updated_at
before update on news_posts
for each row execute function set_updated_at();

drop trigger if exists trg_rewards_updated_at on rewards;
create trigger trg_rewards_updated_at
before update on rewards
for each row execute function set_updated_at();

drop trigger if exists trg_it_requests_updated_at on it_requests;
create trigger trg_it_requests_updated_at
before update on it_requests
for each row execute function set_updated_at();

create or replace function current_emp_id()
returns text
language sql
stable
as $$
  select emp_id from app_users where auth_user_id = (select auth.uid()) limit 1
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users
    where auth_user_id = (select auth.uid())
      and role in ('admin','admin_it','dev')
      and status = 'active'
  )
$$;

create or replace function is_it_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from app_users
    where auth_user_id = (select auth.uid())
      and role in ('admin_it','dev')
      and status = 'active'
  )
$$;

create or replace function recalc_user_points(p_emp_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_points integer;
declare v_earned integer;
begin
  select greatest(coalesce(sum(amount),0),0),
         coalesce(sum(case when amount > 0 then amount else 0 end),0)
  into v_points, v_earned
  from point_transactions
  where emp_id = p_emp_id;

  update app_users
  set points = v_points,
      total_earned = v_earned
  where emp_id = p_emp_id;

  return v_points;
end $$;

create or replace function add_point_transaction(
  p_emp_id text,
  p_tx_type point_tx_type,
  p_amount integer,
  p_description text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(tx_id text, balance_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare v_tx_id text;
declare v_current_points integer;
declare v_balance integer;
begin
  if p_emp_id is null or not exists (select 1 from app_users where emp_id = p_emp_id) then
    raise exception 'invalid emp_id';
  end if;

  v_tx_id := 'TX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  select coalesce(points,0)
  into v_current_points
  from app_users
  where emp_id = p_emp_id
  for update;

  v_balance := v_current_points + p_amount;

  if v_balance < 0 then
    raise exception 'insufficient points';
  end if;

  insert into point_transactions(tx_id, emp_id, tx_type, amount, description, balance_after, source_type, source_id, metadata)
  values (v_tx_id, p_emp_id, p_tx_type, p_amount, p_description, v_balance, p_source_type, p_source_id, coalesce(p_metadata,'{}'::jsonb));

  update app_users
  set points = v_balance,
      total_earned = case when p_amount > 0 then total_earned + p_amount else total_earned end
  where emp_id = p_emp_id;

  return query select v_tx_id, v_balance;
end $$;

create or replace function process_checkin(p_emp_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_today date := current_date;
declare v_tx record;
declare v_log_id text;
begin
  if exists (select 1 from checkin_logs where emp_id = p_emp_id and checkin_date = v_today) then
    return jsonb_build_object('status','already_checked','message','เช็คอินวันนี้แล้ว');
  end if;

  v_log_id := 'CH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into checkin_logs(log_id, emp_id, checkin_date, checkin_time, points_earned, status)
  values (v_log_id, p_emp_id, v_today, localtime(0), 1, 'Success');

  select * into v_tx
  from add_point_transaction(p_emp_id, 'earn', 1, 'Daily Check-in', 'CHECKIN', v_log_id, jsonb_build_object('date', v_today));

  update app_users
  set last_check_in = v_today,
      check_in_count = check_in_count + 1
  where emp_id = p_emp_id;

  insert into notifications(notification_id, emp_id, title, message, type, metadata)
  values ('NOTI-' || floor(extract(epoch from clock_timestamp())*1000)::bigint || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),
          p_emp_id, 'เช็คอินสำเร็จ', 'คุณได้รับ 1 แต้มจากการเช็คอินวันนี้', 'checkin',
          jsonb_build_object('txId', v_tx.tx_id, 'points', 1, 'balance', v_tx.balance_after));

  return jsonb_build_object('status','success','logId',v_log_id,'txId',v_tx.tx_id,'newPoints',v_tx.balance_after);
end $$;

create or replace function redeem_reward(p_emp_id text, p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r rewards%rowtype;
declare v_points integer;
declare v_redemption_id text;
declare v_tx record;
begin
  select * into r from rewards where reward_id = p_reward_id and status = 'active' for update;
  if not found then raise exception 'reward not found'; end if;
  if r.stock <= 0 then raise exception 'out of stock'; end if;

  select points into v_points from app_users where emp_id = p_emp_id for update;
  if v_points < r.points_required then raise exception 'insufficient points'; end if;

  v_redemption_id := 'RDM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  update rewards set stock = stock - 1 where reward_id = p_reward_id;

  select * into v_tx from add_point_transaction(
    p_emp_id, 'spend', -r.points_required, 'Redeem: ' || r.name, 'REDEEM', v_redemption_id,
    jsonb_build_object('rewardId', p_reward_id, 'rewardName', r.name)
  );

  insert into reward_redemptions(redemption_id, emp_id, reward_id, reward_name, points_spent, status)
  values (v_redemption_id, p_emp_id, p_reward_id, r.name, r.points_required, 'Pending');

  insert into notifications(notification_id, emp_id, title, message, type, metadata)
  values ('NOTI-' || floor(extract(epoch from clock_timestamp())*1000)::bigint || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),
          p_emp_id, 'แลกรางวัลสำเร็จ', 'แลก ' || r.name || ' ใช้ ' || r.points_required || ' แต้ม', 'redeem',
          jsonb_build_object('redemptionId', v_redemption_id, 'rewardId', p_reward_id, 'balance', v_tx.balance_after));

  return jsonb_build_object('status','success','redemptionId',v_redemption_id,'newPoints',v_tx.balance_after,'stock',r.stock - 1);
end $$;
