-- รอบ 7: ดาวรวมมีค่าเดียวที่ทุกจออ่าน · กระดานโชว์ผลงานเพื่อนแบบไม่เปรียบเทียบ · อายุไฟล์เสียง 90 วัน

-- ------------------------------------------- 1) ภารกิจใหญ่เก็บดาวในตารางเดียวกัน
-- เดิม mission_progress รับแค่ m1-m4 ทำให้ดาวของภารกิจใหญ่ไม่มีที่อยู่
-- เพดานยังเท่าเดิม: 5 แถว (m1-m4 + boss) x 3 ดาว = 15

alter table public.mission_progress drop constraint if exists mission_progress_mission_id_check;
alter table public.mission_progress
  add constraint mission_progress_mission_id_check
    check (mission_id in ('m1', 'm2', 'm3', 'm4', 'boss'));

-- --------------------------------------------------------- 2) ดาวรวมของนักเรียน
-- **คำนวณใหม่จากแหล่งจริงทุกครั้ง ไม่ใช่บวกสะสม** — ครูแก้คะแนนแล้วเรียกซ้ำได้ ค่าไม่เพี้ยน
-- profiles.earned_stars คือค่าเดียวที่ทุกหน้าจอ (จอเด็ก + แผงครู + ใบประกาศ) ต้องอ่าน

create or replace function public.recalc_student_stars(p_student_id uuid)
returns setof public.profiles
language sql
as $$
  insert into public.profiles (student_id, earned_stars, updated_at)
  select
    p_student_id,
    least(
      coalesce((select sum(mp.stars) from public.mission_progress mp where mp.student_id = p_student_id), 0),
      15
    ),
    now()
  on conflict (student_id) do update
    set earned_stars = excluded.earned_stars,
        updated_at   = now()
  returning *;
$$;

comment on function public.recalc_student_stars(uuid) is
  'รวมดาวจาก mission_progress (m1-m4 + boss) ใหม่ทั้งหมดแล้วเขียนลง profiles.earned_stars · เพดาน 15';

-- ------------------------------------- 3) กระดานโชว์ผลงานเพื่อน (ห้ามเปรียบเทียบ)
-- คืนเฉพาะ ชื่อเล่น · ชื่อโดเมน · นามสกุล · เหตุผล
-- **ไม่มีคอลัมน์ดาว คะแนน หรือสถานะผ่าน/ไม่ผ่านในผลลัพธ์เลย** ตำราห้ามเปรียบเทียบผู้เรียนกันเอง
-- ผู้ขอต้องอยู่ห้องเดียวกันจริง (EXISTS ใน query เดียวกัน) ไม่ใช่ใครก็ดูได้

create or replace function public.classroom_showcase(
  p_classroom_id uuid,
  p_student_id   uuid
)
returns table (
  nickname    text,
  domain_name text,
  tld         text,
  reason_text text
)
language sql
stable
as $$
  select st.nickname, sub.domain_name, sub.tld, sub.reason_text
  from public.students st
  join public.submissions sub on sub.student_id = st.id
  where st.classroom_id = p_classroom_id
    and exists (
      select 1 from public.students me
      where me.id = p_student_id
        and me.classroom_id = p_classroom_id
    )
  order by st.nickname, sub.created_at;
$$;

-- ------------------------------------------------- 4) อายุไฟล์เสียง 90 วัน (PDPA)
-- เสียงเด็กเป็นข้อมูลส่วนบุคคล เก็บเท่าที่จำเป็นต่อการให้คะแนนและทบทวน
-- นโยบาย: เก็บไม่เกิน 90 วันหลังอัด · ครูสั่งลบก่อนได้ · ลบห้องเรียน = ลบไฟล์เสียงของห้องนั้นด้วย

alter table public.voice_submissions
  add column expires_at timestamptz not null default (now() + interval '90 days');

create index voice_submissions_expires_idx on public.voice_submissions (expires_at);

comment on column public.voice_submissions.expires_at is
  'ครบกำหนดลบตามนโยบาย 90 วัน — scripts/purge-expired-voice.ts ลบทั้งแถวและไฟล์ใน storage';

/**
 * ลบแถวที่หมดอายุแล้ว คืน storage_path กลับไปให้ผู้เรียกลบไฟล์จริงใน bucket ต่อ
 * ลบแถวอย่างเดียวไม่พอ ไฟล์เสียงจะค้างใน storage
 */
create or replace function public.expire_voice_submissions()
returns table (id uuid, storage_path text)
language sql
as $$
  delete from public.voice_submissions v
   where v.expires_at <= now()
  returning v.id, v.storage_path;
$$;

/** path ของไฟล์เสียงทั้งห้อง — ใช้ลบไฟล์ก่อนลบห้องเรียน (แถวหายเองด้วย cascade) */
create or replace function public.classroom_voice_paths(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (id uuid, storage_path text)
language sql
stable
as $$
  select v.id, v.storage_path
  from public.voice_submissions v
  join public.students st on st.id = v.student_id
  join public.classrooms c on c.id = st.classroom_id
  where c.id = p_classroom_id
    and c.teacher_id = p_teacher_id;
$$;

/** ครูสั่งลบไฟล์เสียงก่อนครบกำหนด — ตรวจเจ้าของห้องใน DELETE เดียวกัน */
create or replace function public.delete_voice_submission(
  p_teacher_id uuid,
  p_voice_id   uuid
)
returns table (id uuid, storage_path text)
language sql
as $$
  delete from public.voice_submissions v
   where v.id = p_voice_id
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = v.student_id
         and c.teacher_id = p_teacher_id
     )
  returning v.id, v.storage_path;
$$;

-- ------------------------------------------------------------------------ grants

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.recalc_student_stars(uuid)              from anon, public;
revoke execute on function public.classroom_showcase(uuid, uuid)          from anon, public;
revoke execute on function public.expire_voice_submissions()              from anon, public;
revoke execute on function public.classroom_voice_paths(uuid, uuid)       from anon, public;
revoke execute on function public.delete_voice_submission(uuid, uuid)     from anon, public;

grant execute on function public.recalc_student_stars(uuid)          to service_role;
grant execute on function public.classroom_showcase(uuid, uuid)      to service_role;
grant execute on function public.expire_voice_submissions()          to service_role;
grant execute on function public.classroom_voice_paths(uuid, uuid)   to service_role;
grant execute on function public.delete_voice_submission(uuid, uuid) to service_role;
