# DATABASE INVENTORY FINAL

## Core / Master
1. `app_settings` - ค่าตั้งค่าระบบ เช่น Drive folder, default avatar
2. `departments` - master แผนก
3. `positions` - master ตำแหน่ง
4. `app_users` - master employee profile / ฐานหลักของ user
5. `user_credentials` - hash password สำหรับ public session login / first login
6. `manager_department_permissions` - manager/exec ดูแลแผนกใดได้บ้าง
7. `holidays` - วันหยุดบริษัท
8. `drive_assets` - เก็บ Google Drive file_id / display_url / metadata
9. `admin_audit_logs` - log การแก้ไข admin

## Content / Activity
10. `missions`
11. `user_missions`
12. `news_posts`
13. `user_news_reads`
14. `referrals`

## Points / Rewards / Check-in
15. `point_transactions`
16. `rewards`
17. `reward_redemptions`
18. `overall_logs`
19. `checkin_logs`

## Chat / Notifications
20. `notifications`
21. `notification_targets`
22. `chat_faq`
23. `direct_messages`
24. `ai_chat_logs`

## IT Request
25. `it_requests`

## Runtime Session
26. `public_sessions`

## Quotation / Drive Report Mirror
27. `quotations` - quotation header, customer snapshot, calculated totals, Drive report links, sync version/hash
28. `quotation_items` - normalized product/service lines
29. `quotation_cost_notes` - Proposed Cost / SB Cost analysis lines
30. `quotation_files` - Google Drive PDF, XLSX, image, and attachment references

## Views
- `v_ranking`
- `v_user_dashboard`
- `v_admin_dashboard_kpis`
- `v_active_news`
- `v_active_missions`
- `v_active_rewards`
- `v_manager_departments`

## Functions สำคัญ
- Login: `login_with_emp_password`, `logout_public_session`, `change_my_password`, `setup_first_password_no_credential`
- Home/User: `get_home_payload`, `public_page_payload`, `public_checkin`, `public_read_news`, `public_complete_mission`, `public_redeem_reward`
- Notification: `public_list_notifications`, `public_mark_notification_read`
- Admin: `admin_dashboard_payload`, `admin_module_payload`, `admin_save_news`, `admin_save_mission`, `admin_save_reward`, `admin_save_user_simple`, `admin_save_manager_dept`, `admin_reset_user_password`
