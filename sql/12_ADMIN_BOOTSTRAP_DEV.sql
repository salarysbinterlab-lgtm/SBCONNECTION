-- 12_ADMIN_BOOTSTRAP_DEV.sql
-- สร้าง admin ตายตัวสำหรับทดสอบระบบ Admin
-- เปลี่ยนรหัสผ่านในบรรทัด v_admin_password ก่อนเปิด public จริง

DO $$
DECLARE
  v_admin_emp_id text := 'ADMIN';
  -- ต้องเปลี่ยนบรรทัดนี้ก่อนรันทุกครั้ง สคริปต์จะไม่ยอมรันถ้ายังเป็นค่าตัวอย่าง
  v_admin_password text := 'CHANGE_ME_BEFORE_RUN';
BEGIN
  IF v_admin_password IN ('CHANGE_ME_BEFORE_RUN', 'Admin123', '1234', v_admin_emp_id) THEN
    RAISE EXCEPTION 'ตั้งค่า v_admin_password เป็นรหัสของคุณเองก่อนรันไฟล์นี้ (ห้ามใช้ค่าตัวอย่าง)';
  END IF;

  IF NOT public.sb_is_valid_password(v_admin_password) THEN
    RAISE EXCEPTION 'รหัสผ่านต้องยาว 8-72 ตัว มีทั้งตัวอักษรและตัวเลข ห้ามเว้นวรรคและห้ามภาษาไทย';
  END IF;

  INSERT INTO public.app_users(
    emp_id, role, email, name_th, surname_th, nickname_th, dept_th, pos_th,
    points, total_earned, presence, status, force_password_change, password_policy, created_at, updated_at
  ) VALUES (
    v_admin_emp_id, 'admin', 'admin@sbinterlab.local', 'System', 'Admin', 'Admin', 'IT', 'Administrator',
    0, 0, 'offline', 'active', false, '8-char-no-thai', now(), now()
  )
  ON CONFLICT (emp_id) DO UPDATE SET
    role = 'admin',
    email = excluded.email,
    name_th = excluded.name_th,
    surname_th = excluded.surname_th,
    nickname_th = excluded.nickname_th,
    dept_th = excluded.dept_th,
    pos_th = excluded.pos_th,
    status = 'active',
    force_password_change = false,
    updated_at = now();

  INSERT INTO public.user_credentials(emp_id, password_hash, must_change, changed_at)
  VALUES (v_admin_emp_id, public.sb_hash_password(v_admin_password), false, now())
  ON CONFLICT (emp_id) DO UPDATE SET
    password_hash = excluded.password_hash,
    must_change = false,
    changed_at = now(),
    reset_at = null,
    reset_by_emp_id = null;
END $$;
