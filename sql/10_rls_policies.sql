-- 10_rls_policies.sql
-- RLS is designed for Supabase Auth. For a pure static GitHub frontend, use supabase-js auth session.
-- user_credentials has no SELECT policy by design.

alter table app_settings enable row level security;
alter table departments enable row level security;
alter table positions enable row level security;
alter table app_users enable row level security;
alter table user_credentials enable row level security;
alter table manager_department_permissions enable row level security;
alter table holidays enable row level security;
alter table drive_assets enable row level security;
alter table admin_audit_logs enable row level security;
alter table missions enable row level security;
alter table user_missions enable row level security;
alter table news_posts enable row level security;
alter table user_news_reads enable row level security;
alter table referrals enable row level security;
alter table point_transactions enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;
alter table overall_logs enable row level security;
alter table checkin_logs enable row level security;
alter table notifications enable row level security;
alter table notification_targets enable row level security;
alter table chat_faq enable row level security;
alter table direct_messages enable row level security;
alter table ai_chat_logs enable row level security;
alter table it_requests enable row level security;

-- public-ish read data for logged-in users
drop policy if exists "authenticated can read public settings" on app_settings;
create policy "authenticated can read public settings" on app_settings
for select to authenticated using (is_public = true or is_admin());

drop policy if exists "authenticated can read departments" on departments;
create policy "authenticated can read departments" on departments
for select to authenticated using (true);

drop policy if exists "authenticated can read positions" on positions;
create policy "authenticated can read positions" on positions
for select to authenticated using (true);

drop policy if exists "authenticated can read active users" on app_users;
create policy "authenticated can read active users" on app_users
for select to authenticated using (status = 'active' or (select auth.uid()) = auth_user_id or is_admin());

drop policy if exists "users update own presence only" on app_users;
create policy "users update own presence only" on app_users
for update to authenticated
using ((select auth.uid()) = auth_user_id or is_admin())
with check ((select auth.uid()) = auth_user_id or is_admin());

-- admin writes
drop policy if exists "admin manage users" on app_users;
create policy "admin manage users" on app_users
for all to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage credentials" on user_credentials;
create policy "admin manage credentials" on user_credentials
for all to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists "read holidays" on holidays;
create policy "read holidays" on holidays
for select to authenticated using (true);

drop policy if exists "admin manage holidays" on holidays;
create policy "admin manage holidays" on holidays
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "read active missions" on missions;
create policy "read active missions" on missions
for select to authenticated using (status = 'active' or is_admin());

drop policy if exists "admin manage missions" on missions;
create policy "admin manage missions" on missions
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "users read own missions" on user_missions;
create policy "users read own missions" on user_missions
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users insert own missions" on user_missions;
create policy "users insert own missions" on user_missions
for insert to authenticated with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "read active news" on news_posts;
create policy "read active news" on news_posts
for select to authenticated using (status = 'active' or is_admin());

drop policy if exists "admin manage news" on news_posts;
create policy "admin manage news" on news_posts
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "users read own news logs" on user_news_reads;
create policy "users read own news logs" on user_news_reads
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users insert own news logs" on user_news_reads;
create policy "users insert own news logs" on user_news_reads
for insert to authenticated with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "read active rewards" on rewards;
create policy "read active rewards" on rewards
for select to authenticated using (status = 'active' or is_admin());

drop policy if exists "admin manage rewards" on rewards;
create policy "admin manage rewards" on rewards
for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "users read own point tx" on point_transactions;
create policy "users read own point tx" on point_transactions
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own redemptions" on reward_redemptions;
create policy "users read own redemptions" on reward_redemptions
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own checkins" on checkin_logs;
create policy "users read own checkins" on checkin_logs
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications" on notifications
for select to authenticated using (emp_id = current_emp_id() or emp_id is null or is_admin());

drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications" on notifications
for update to authenticated using (emp_id = current_emp_id() or is_admin())
with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "read chat faq" on chat_faq;
create policy "read chat faq" on chat_faq
for select to authenticated using (is_active = true or is_admin());

drop policy if exists "users read own messages" on direct_messages;
create policy "users read own messages" on direct_messages
for select to authenticated using (sender_emp_id = current_emp_id() or receiver_emp_id = current_emp_id() or is_admin());

drop policy if exists "users send messages" on direct_messages;
create policy "users send messages" on direct_messages
for insert to authenticated with check (sender_emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own ai logs" on ai_chat_logs;
create policy "users read own ai logs" on ai_chat_logs
for select to authenticated using (emp_id = current_emp_id() or is_admin());

drop policy if exists "users insert own ai logs" on ai_chat_logs;
create policy "users insert own ai logs" on ai_chat_logs
for insert to authenticated with check (emp_id = current_emp_id() or is_admin());

drop policy if exists "users read own or authorized it requests" on it_requests;
create policy "users read own or authorized it requests" on it_requests
for select to authenticated
using (
  requester_emp_id = current_emp_id()
  or is_it_admin()
  or exists (
    select 1 from manager_department_permissions mdp
    where mdp.manager_emp_id = current_emp_id()
      and lower(mdp.dept_th) = lower(it_requests.requester_department)
  )
  or is_admin()
);

drop policy if exists "users create own it requests" on it_requests;
create policy "users create own it requests" on it_requests
for insert to authenticated with check (requester_emp_id = current_emp_id() or is_admin());

drop policy if exists "manager it admin update requests" on it_requests;
create policy "manager it admin update requests" on it_requests
for update to authenticated
using (
  is_it_admin()
  or exists (
    select 1 from manager_department_permissions mdp
    where mdp.manager_emp_id = current_emp_id()
      and lower(mdp.dept_th) = lower(it_requests.requester_department)
  )
  or is_admin()
)
with check (true);
