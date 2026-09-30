-- ฟังก์ชันตรวจความพร้อมก่อน deploy — ให้ scripts/check-deploy.ts เรียกผ่าน PostgREST
-- ใช้ได้ทั้ง local และคลาวด์ โดยไม่ต้องต่อ psql ตรง (บนคลาวด์มักไม่เปิดพอร์ต 5432 ให้เครื่องเรา)
--
-- security definer + grant เฉพาะ service_role เท่านั้น — anon และ authenticated เรียกไม่ได้

create or replace function public.rls_status()
returns table (table_name text, rls_enabled boolean)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select c.relname::text, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by c.relname;
$$;

revoke execute on function public.rls_status() from anon, authenticated, public;
grant  execute on function public.rls_status() to service_role;
