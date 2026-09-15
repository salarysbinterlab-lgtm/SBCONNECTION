\echo '=== 1) คำขอทั้งหมดใน 24 ชม. ที่ผ่านมา ==='
select request_id, emp_id,
       to_char(created_at at time zone 'Asia/Bangkok','DD/MM HH24:MI') as ขอเมื่อ,
       case when notified_at is null then 'ยังไม่ได้ส่งเมล' else 'ส่งเมลแล้ว' end as สถานะเมล,
       case when used_at is not null then 'ใช้แล้ว'
            when now() > expires_at then 'หมดอายุ'
            else 'ยังใช้ได้' end as สถานะรหัส
from public.password_reset_requests
where created_at > now() - interval '24 hours'
order by created_at desc;

\echo '=== 2) ชนลิมิตหรือยัง (ต่อคน 3 ครั้ง/วัน, รวม 30 ครั้ง/ชม.) ==='
select emp_id, count(*) as ขอไปแล้ววันนี้,
       case when count(*) >= 3 then 'ชนลิมิตแล้ว ขอเพิ่มไม่ได้' else 'ยังขอได้' end as ผล
from public.password_reset_requests
where created_at > now() - interval '24 hours'
group by emp_id order by count(*) desc;

select count(*) as ขอรวมใน1ชม, case when count(*) >= 30 then 'ชนลิมิตรวม' else 'ปกติ' end as ผล
from public.password_reset_requests where created_at > now() - interval '1 hour';

\echo '=== 3) ค่าตั้งค่าที่ระบบใช้อยู่ ==='
select key, value from public.app_settings
where key like 'password_reset%' order by key;
