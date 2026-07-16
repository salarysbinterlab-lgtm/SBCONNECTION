# SQL DUPLICATE / DECISION ANALYSIS

## 11_ Login RPC
พบ `11_public_test_login_rpc.sql` และ `11_real_auth_first_login_rpc.sql` มีเนื้อหาเหมือนกัน และบาง query อ้าง column ที่ไม่มีใน schema ล่าสุด เช่น `news_posts.title`, `news_posts.subtitle`, `news_posts.points_reward`, `notifications.status`, `point_transactions.points/source/note`

ตัดสินใจ: ไม่ใช้ทั้งคู่โดยตรง และสร้าง `11_public_session_rpc_FINAL.sql` ใหม่ให้ตรงกับ schema ล่าสุด:
- `news_posts.topic/detail/points/publish_date`
- `missions.title/description/points`
- `rewards.name/detail/points_required/stock`
- `notifications.is_read`
- `point_transactions.amount/description/source_type`

## 91_ Seed
`91_seed_from_xlsx.sql` และ `91_seed_from_xlsx_FIXED_V3_empid_normalized.sql` ในชุดที่ส่งมา hash เหมือนกัน แต่เลือกใช้ `91_seed_from_xlsx_FIXED_V3_empid_normalized.sql` เป็นชื่อหลัก เพราะสื่อว่าผ่านการ normalize emp_id แล้ว

## 99_ Reset
- `00_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql` = ใช้ตอนเริ่มฐานใหม่แบบล้าง public schema ทั้งหมด
- `98_CLEAR_DATA_ONLY.sql` = ใช้ล้าง data อย่างเดียว schema ยังอยู่
- `99_drop_all_dev_only.sql` = เก็บเป็น fallback ไม่ใช่ run order หลัก

## Password / First Login
- `sb_is_valid_password()` ในชุด final ปรับเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี
- Temporary login `1234` ยังใช้ได้สำหรับ first-login เพราะเป็นรหัสชั่วคราวที่ hash ใน seed/credentials
- หลัง login ด้วย `1234` จะถูกบังคับเปลี่ยนเป็นรหัสใหม่ 8 ตัว

## Google Drive Link Mode
ใช้ table `drive_assets` เป็น master file metadata:
- `drive_file_id`
- `display_url` เช่น `https://lh3.googleusercontent.com/d/<fileId>`
- `original_url`
- `module`, `ref_table`, `ref_id`
