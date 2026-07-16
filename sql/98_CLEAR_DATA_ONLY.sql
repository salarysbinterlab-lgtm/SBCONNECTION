-- =====================================================
-- DEV ONLY: CLEAR DATA ONLY
-- ล้างข้อมูลทุก table ใน public schema แต่ไม่ลบโครงสร้าง
-- ใช้เมื่อ schema ยังเหมือนเดิม แต่อยาก seed ข้อมูลใหม่
-- =====================================================

rollback;

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('spatial_ref_sys')
  loop
    execute format('truncate table public.%I restart identity cascade;', r.tablename);
  end loop;
end $$;
