# RUN ORDER FINAL - SB Connect Supabase + Legacy UI

## ใช้ไฟล์ไหน / ไม่ใช้ไฟล์ไหน
- `11_public_test_login_rpc.sql` กับ `11_real_auth_first_login_rpc.sql` เนื้อหาเหมือนกัน และมีจุดอ้าง column เก่าผิดกับ schema ล่าสุด จึงไม่ใช้ทั้งคู่ในชุด final
- ใช้แทนด้วย `11_public_session_rpc_FINAL.sql`
- `91_seed_from_xlsx.sql` กับ `91_seed_from_xlsx_FIXED_V3_empid_normalized.sql` hash เหมือนกันในชุดที่ส่งมา แต่ใช้ชื่อ `FIXED_V3` เป็นตัวหลักเพื่อป้องกันสับสน
- `99_drop_all_dev_only.sql` และ `99_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql` เป็น DEV ONLY ห้ามรันใน production
- ระบบเลือก Google Drive Link Mode แล้ว ไม่ต้องสร้าง Supabase Storage bucket เป็นฐานหลัก

## เริ่มใหม่แบบ DEV
1. `00_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql`
2. `01_extensions.sql`
3. `02_types.sql`
4. `03_core_schema.sql`
5. `04_content_schema.sql`
6. `05_points_rewards_schema.sql`
7. `06_chat_notifications_schema.sql`
8. `07_it_requests_schema.sql`
9. `08_views.sql`
10. `09_functions_triggers.sql`
11. `10_rls_policies.sql`
12. `11_public_session_rpc_FINAL.sql`
13. `12_ADMIN_BOOTSTRAP_DEV.sql`
14. `90_seed_app_settings.sql`
15. `91_seed_from_xlsx_FIXED_V3_empid_normalized.sql`
16. `92_post_seed_fixes.sql`

## แบบไฟล์เดียว
ใช้ `sbconnect_FINAL_all_in_one.sql` หลัง reset หรือในฐานว่าง

## Optional
- `93_OPTIONAL_RESET_PASSWORD_FIRST_LOGIN_MODE.sql` ใช้เฉพาะต้องการล้าง credentials ทั้งหมดเพื่อให้ทุกคนตั้งรหัสครั้งแรกแบบไม่มีรหัสเดิม
- `98_CLEAR_DATA_ONLY.sql` ล้างข้อมูลแต่ไม่ลบ schema
- `99_drop_all_dev_only.sql` ลบเฉพาะ table/type ของ SB Connect แบบเก่า
