\echo '=== ฟังก์ชัน admin_system_reset มีในฐานข้อมูลหรือยัง (ต้องได้ 1 แถว) ==='
select p.proname as ชื่อฟังก์ชัน,
       pg_get_function_identity_arguments(p.oid) as พารามิเตอร์,
       has_function_privilege('anon', p.oid, 'execute') as anon_เรียกได้
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_system_reset';

\echo '=== รายชื่อบัญชีที่ล้างระบบได้ (ต้องมี admin1) ==='
select value from public.app_settings where key = 'system_reset_allowed_emp_ids';
