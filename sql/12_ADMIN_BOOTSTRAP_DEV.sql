-- 12_ADMIN_BOOTSTRAP_DEV.sql
-- สร้าง admin ตายตัวสำหรับทดสอบระบบ Admin
-- เปลี่ยนรหัสผ่านในบรรทัด v_admin_password ก่อนเปิด public จริง

DO $$
DECLARE
  v_admin_emp_id text := 'ADMIN';
  v_admin_password text := 'Admin123'; -- 8 characters, no Thai
BEGIN
  IF NOT public.sb_is_valid_password(v_admin_password) THEN
    RAISE EXCEPTION 'Admin password must be exactly 8 characters and no Thai characters';
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
