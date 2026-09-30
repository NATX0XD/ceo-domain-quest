-- T52 ต่อ — ให้ p_deadline มีค่าตั้งต้นเป็น null
--
-- PostgREST ส่งอาร์กิวเมนต์ที่ไม่มีค่าตั้งต้นเป็น "ต้องส่งเสมอ" และตัวสร้าง types จึงพิมพ์เป็น string
-- แต่การ "ล้างวันหมดเขต" คือการส่ง null พอดี · ใส่ default null แล้วฝั่ง TS ส่ง undefined เพื่อล้างได้ตรง ๆ
-- ชนิดอาร์กิวเมนต์เหมือนเดิมทุกตัว จึงเป็นการแทนที่ฟังก์ชันเดิม ไม่ได้สร้างตัวซ้อน

create or replace function public.set_home_deadline(
  p_teacher_id uuid,
  p_session_id uuid,
  p_deadline   timestamptz default null
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set home_deadline = p_deadline,
         updated_at    = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

revoke execute on function public.set_home_deadline(uuid, uuid, timestamptz) from anon, public;
grant  execute on function public.set_home_deadline(uuid, uuid, timestamptz) to service_role;
