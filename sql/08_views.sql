-- 08_views.sql
create or replace view v_ranking
with (security_invoker = true) as
select
  row_number() over (order by points desc, total_earned desc, emp_id asc) as rank_no,
  emp_id,
  coalesce(nullif(trim(name_th || ' ' || surname_th), ''), emp_id) as display_name,
  nickname_th,
  dept_th,
  pos_th,
  avatar_url,
  points,
  total_earned,
  check_in_count,
  last_check_in
from app_users
where status = 'active';

create or replace view v_user_dashboard
with (security_invoker = true) as
select
  u.emp_id,
  u.points,
  u.total_earned,
  u.check_in_count,
  u.last_check_in,
  (select count(*) from user_missions um where um.emp_id = u.emp_id) as completed_missions,
  (select count(*) from user_news_reads nr where nr.emp_id = u.emp_id) as read_news_count,
  (select count(*) from reward_redemptions rr where rr.emp_id = u.emp_id) as redemption_count,
  (select count(*) from notifications n where n.emp_id = u.emp_id and not n.is_read) as unread_notifications
from app_users u;

create or replace view v_admin_dashboard_kpis
with (security_invoker = true) as
select
  (select count(*) from app_users where status = 'active') as active_users,
  (select count(*) from app_users where role in ('admin','admin_it','dev')) as admin_users,
  (select count(*) from checkin_logs where checkin_date = current_date) as checkins_today,
  (select count(*) from reward_redemptions where redeemed_at::date = current_date) as redemptions_today,
  (select coalesce(sum(amount),0) from point_transactions where tx_type = 'earn') as total_points_earned,
  (select coalesce(sum(points_spent),0) from reward_redemptions) as total_points_spent;

create or replace view v_active_news
with (security_invoker = true) as
select * from news_posts
where status = 'active'
order by pinned desc, publish_date desc nulls last, created_at desc;

create or replace view v_active_missions
with (security_invoker = true) as
select * from missions
where status = 'active'
order by created_at desc;

create or replace view v_active_rewards
with (security_invoker = true) as
select * from rewards
where status = 'active'
order by stock desc, points_required asc;

create or replace view v_manager_departments
with (security_invoker = true) as
select
  mdp.manager_emp_id,
  coalesce(nullif(trim(u.name_th || ' ' || u.surname_th), ''), mdp.manager_emp_id) as manager_name,
  array_agg(mdp.dept_th order by mdp.dept_th) as departments,
  max(mdp.updated_at) as updated_at
from manager_department_permissions mdp
left join app_users u on u.emp_id = mdp.manager_emp_id
group by mdp.manager_emp_id, manager_name;
