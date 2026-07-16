-- RESET_PASSWORD_FIRST_LOGIN_MODE.sql
-- ใช้หลัง seed ผ่านแล้ว: ล้างรหัสผ่านทั้งหมดเพื่อบังคับให้ทุกคนไปขั้นตอนตั้งรหัสผ่านครั้งแรก
-- หมายเหตุ: ถ้าใช้หน้า index.html เวอร์ชันทดสอบเดิมที่ login ด้วย 1234 อย่าเพิ่ง run ไฟล์นี้ จนกว่าจะใส่ first-login page/RPC แล้ว
begin;

truncate table user_credentials;

update app_users
set force_password_change = true,
    password_changed_at = null,
    password_reset_at = null,
    password_reset_by_emp_id = null,
    password_policy = '8-char-no-thai',
    updated_at = now();

commit;
