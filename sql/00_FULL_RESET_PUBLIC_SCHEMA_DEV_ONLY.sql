-- =====================================================
-- DEV ONLY: FULL RESET PUBLIC SCHEMA
-- ลบ public schema ทั้งหมด แล้วสร้างกลับมาใหม่
-- ใช้เมื่อจะ RUN SQL ใหม่ตั้งแต่ 01_extensions.sql
-- ห้ามใช้กับ Production ที่มีข้อมูลจริง
-- =====================================================

rollback;

drop schema if exists public cascade;

create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
grant all on tables to postgres, service_role;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
grant all on functions to postgres, service_role;

alter default privileges in schema public
grant execute on functions to anon, authenticated;

alter default privileges in schema public
grant all on sequences to postgres, service_role;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;
