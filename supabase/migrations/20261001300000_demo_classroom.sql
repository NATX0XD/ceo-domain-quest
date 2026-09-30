-- E-16 โหมดสาธิต — ห้องหุ่นสำหรับขึ้นเวที กดล้างกลับค่าเริ่มต้นได้ในปุ่มเดียว
--
-- กติกาที่ต้องบังคับ **ในฐานข้อมูล** ไม่ใช่แค่ซ่อนปุ่มบนหน้าจอ:
--   1. ล้างได้เฉพาะห้องที่ติดป้าย is_demo = true เท่านั้น
--   2. ห้องเรียนจริงจะถูกเปลี่ยนมาติดป้ายห้องสาธิตทีหลังไม่ได้ (ไม่งั้นป้ายกลายเป็นทางลัดลบข้อมูลเด็ก)
--   3. ครูคนอื่นยิงเข้ามาต้องไม่ได้อะไรเลย แม้จะรู้ uuid ของห้อง
--
-- ตัวเลขรายงานแยกห้องอยู่แล้วโดยโครงสร้าง (ทุก RPC รับ p_classroom_id ตัวเดียว)
-- คอลัมน์นี้จึงมีไว้ให้จอครูกับรายงาน **ติดป้ายเตือน** ว่าเลขชุดนี้มาจากห้องหุ่น ห้ามเอาขึ้นสไลด์ผลทดลอง

alter table public.classrooms
  add column if not exists is_demo boolean not null default false;

comment on column public.classrooms.is_demo is
  'ห้องสาธิตสำหรับขึ้นเวที — ข้อมูลเป็นหุ่น ล้างกลับค่าเริ่มต้นได้ และต้องไม่ถูกนับเป็นผลการทดลอง';

create index if not exists classrooms_is_demo_idx on public.classrooms (is_demo) where is_demo;

/**
 * ด่านที่ 2: ติดป้ายห้องสาธิตให้ห้องที่มีนักเรียนอยู่แล้วไม่ได้
 *
 * ถ้าไม่มีด่านนี้ ใครก็ตามที่เขียนตาราง classrooms ได้จะ "เปลี่ยนห้องจริงให้เป็นห้องสาธิต"
 * แล้วกดปุ่มล้างทิ้งทั้งห้องได้ทันที — ป้ายจะกลายเป็นประตูหลังแทนที่จะเป็นรั้ว
 * ห้องสาธิตของจริงถูกสร้างพร้อมป้ายตั้งแต่แถวแรก (ยังไม่มีนักเรียน) จึงผ่านด่านนี้เสมอ
 */
create or replace function public.guard_classroom_demo_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_demo and not old.is_demo then
    if exists (select 1 from public.students where classroom_id = old.id) then
      raise exception 'ห้อง % มีนักเรียนอยู่แล้ว ติดป้ายห้องสาธิตย้อนหลังไม่ได้', old.room_code
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists classrooms_guard_demo_flag on public.classrooms;
create trigger classrooms_guard_demo_flag
  before update of is_demo on public.classrooms
  for each row
  execute function public.guard_classroom_demo_flag();

/**
 * ด่านที่ 1: ล้างห้องสาธิตกลับเป็นห้องว่าง
 *
 * คืนจำนวนแถวที่ลบไปให้ฝั่งเว็บรายงานได้ว่าล้างอะไรไปบ้าง
 * แถวลูกของนักเรียน (progress / submissions / events / ...) หายตาม FK cascade
 *
 * errcode ที่โยนออกไปมีความหมาย ฝั่งเว็บแปลเป็นสถานะ HTTP:
 *   P0002 = ไม่พบห้องนี้ในบัญชีของครูคนนี้   -> 404
 *   42501 = ห้องนี้ไม่ใช่ห้องสาธิต            -> 403
 */
create or replace function public.reset_demo_classroom(
  p_teacher_id uuid,
  p_classroom_id uuid
)
returns table (
  deleted_students integer,
  deleted_plan_requests integer,
  deleted_broadcasts integer,
  deleted_flags integer,
  deleted_quiz_items integer,
  deleted_surveys integer,
  deleted_sessions integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_demo boolean;
  v_room    text;
begin
  select is_demo, room_code into v_is_demo, v_room
  from public.classrooms
  where id = p_classroom_id and teacher_id = p_teacher_id;

  if v_is_demo is null then
    raise exception 'ไม่พบห้องนี้ในบัญชีของคุณ' using errcode = 'P0002';
  end if;
  if not v_is_demo then
    raise exception 'ห้อง % ไม่ใช่ห้องสาธิต ล้างข้อมูลไม่ได้', v_room using errcode = '42501';
  end if;

  with gone as (delete from public.plan_requests where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_plan_requests from gone;

  with gone as (delete from public.broadcasts where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_broadcasts from gone;

  with gone as (delete from public.content_flags where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_flags from gone;

  with gone as (delete from public.quiz_item_responses where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_quiz_items from gone;

  with gone as (delete from public.survey_responses where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_surveys from gone;

  with gone as (delete from public.class_sessions where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_sessions from gone;

  -- ลบนักเรียนท้ายสุด แถวลูกทุกตารางหายตาม cascade
  with gone as (delete from public.students where classroom_id = p_classroom_id returning 1)
  select count(*)::int into deleted_students from gone;

  return next;
end;
$$;

revoke all on function public.reset_demo_classroom(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reset_demo_classroom(uuid, uuid) to service_role;
revoke all on function public.guard_classroom_demo_flag() from public, anon, authenticated;
