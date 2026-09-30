-- รอบ 11 (T45): คิวสร้างเรื่องราวเฉพาะคน + ธงคำไม่เหมาะสมถึงแผงครู
--
--   story_jobs    โครงเดียวกับ grade_jobs — AI เรียกครั้งเดียวได้ 10 เรื่องต่อนักเรียน 1 คน
--   content_flags ธงจาก core/content-filter.ts · **ห้ามลบข้อความของนักเรียน** เก็บต้นฉบับไว้ให้ครูตัดสิน
--                 ระดับ 3 ต้องถึงแผงครูภายใน 3 วินาที จึงต้อง index ที่ตอบคำถามนี้ได้ตรง ๆ

-- ────────────────────────────────────────────────────────── story_jobs
-- สถานะใช้คำเดียวกับ lib/ai/story-queue.ts (pending|running|done|failed) จะได้ไม่ต้องแม็ปชื่อ
-- ต่างจาก grade_jobs ที่ใช้ 'claimed' — ตรงนี้ตั้งใจให้ตรงกับชั้น lib เพื่อลดจุดพลาด

create table public.story_jobs (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  status     text        not null default 'pending'
               check (status in ('pending', 'running', 'done', 'failed')),
  attempts   integer     not null default 0 check (attempts >= 0),
  /** ข้อมูลตั้งต้นของเรื่องราว (ชื่อร้าน ประเภทธุรกิจ ความสนใจ ฯลฯ) */
  input      jsonb       not null default '{}'::jsonb,
  /** ชุดเรื่องราว 10 เรื่องที่สร้างเสร็จ มีค่าเมื่อ status = 'done' */
  result     jsonb,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index story_jobs_queue_idx   on public.story_jobs (status, created_at);
create index story_jobs_student_idx on public.story_jobs (student_id, created_at desc);

alter table public.story_jobs enable row level security;

create policy story_jobs_owner on public.story_jobs
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

/**
 * หยิบงานถัดไปแบบ atomic — worker หลายตัวเรียกพร้อมกันได้คนละงานเสมอ
 * `for update skip locked` = ข้ามแถวที่ worker อื่นล็อกอยู่ ไม่รอ ไม่ชนกัน
 * คืน 0 แถวเมื่อคิวว่าง **หรือ** ทุกแถวถูกล็อกอยู่ชั่วขณะ — ผู้เรียกต้อง retry ไม่ใช่สรุปว่าคิวหมด
 */
create or replace function public.claim_next_story_job(
  p_max_attempts integer default 3
)
returns setof public.story_jobs
language sql
as $$
  update public.story_jobs j
     set status     = 'running',
         attempts   = j.attempts + 1,
         updated_at = now()
   where j.id = (
     select c.id
     from public.story_jobs c
     where c.status = 'pending'
       and c.attempts < p_max_attempts
     order by c.created_at
     for update skip locked
     limit 1
   )
  returning j.*;
$$;

/** worker ตายกลางทาง — งานที่ค้างสถานะ running เกิน N นาที กลับเข้าคิว */
create or replace function public.reclaim_stale_story_jobs(
  p_older_than_minutes integer default 5
)
returns setof public.story_jobs
language sql
as $$
  update public.story_jobs j
     set status     = 'pending',
         updated_at = now()
   where j.status = 'running'
     and j.updated_at < now() - make_interval(mins => p_older_than_minutes)
  returning j.*;
$$;

create or replace function public.complete_story_job(
  p_job_id uuid,
  p_result jsonb
)
returns setof public.story_jobs
language sql
as $$
  update public.story_jobs j
     set status     = 'done',
         result     = p_result,
         error      = null,
         updated_at = now()
   where j.id = p_job_id
  returning j.*;
$$;

/**
 * งานพัง — `p_retry` มาจากชั้น lib (บางความผิดพลาดไม่ควรลองซ้ำ เช่นข้อมูลตั้งต้นไม่ครบ)
 * ยังไม่ครบโควตาและสั่งให้ลองซ้ำ = กลับเข้าคิว · นอกนั้นปักเป็น failed
 * เรื่องราวสำรองในโค้ดใช้แทนได้เสมอ นักเรียนจึงไม่เคยค้าง
 */
create or replace function public.fail_story_job(
  p_job_id       uuid,
  p_error        text,
  p_retry        boolean default true,
  p_max_attempts integer default 3
)
returns setof public.story_jobs
language sql
as $$
  update public.story_jobs j
     set status     = case
                        when p_retry and j.attempts < p_max_attempts then 'pending'
                        else 'failed'
                      end,
         error      = p_error,
         updated_at = now()
   where j.id = p_job_id
  returning j.*;
$$;

/** เรื่องราวล่าสุดของนักเรียนคนหนึ่ง — ใช้ตอนเปิดภารกิจ (StoryJobStore.findByStudent) */
create or replace function public.find_student_story_job(
  p_student_id uuid
)
returns setof public.story_jobs
language sql
stable
as $$
  select j.*
  from public.story_jobs j
  where j.student_id = p_student_id
  order by (j.status = 'done') desc, j.created_at desc
  limit 1;
$$;

-- ──────────────────────────────────────────────────────── content_flags
-- ระบบกรองคำอยู่ที่ core/content-filter.ts ตารางนี้เก็บ "ผลการกรอง" เพื่อให้ครูตัดสิน
--
-- กติกาที่ตารางนี้บังคับ:
--   1. **ห้ามลบข้อความของนักเรียน** — original_text เก็บต้นฉบับเสมอ ไม่ตัด ไม่แก้
--   2. ครูเห็นข้อความเต็ม **เฉพาะระดับ 3** · ระดับ 1-2 เห็นฉบับปิดบางส่วน (masked_text)
--      บังคับที่ฟังก์ชันอ่าน ไม่ใช่ฝากฝั่งหน้าเว็บเลือกเอง
--   3. ระดับ 3 ต้องขึ้นแผงครูภายใน 3 วินาที → index ตรงกับคิวรีของแผงครูพอดี

create table public.content_flags (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students (id) on delete cascade,
  /** ห้องของเจ้าของข้อความ — เก็บซ้ำไว้เพื่อให้แผงครูอ่านได้โดยไม่ต้อง join students ทุกครั้ง */
  classroom_id uuid        not null references public.classrooms (id) on delete cascade,
  /** ข้อความนี้มาจากไหน เช่น chat · reason · peer-feedback · reflection · domain-name */
  context      text        not null,
  level        smallint    not null check (level between 1 and 3),
  /** กลุ่มคำที่จับได้ (ชื่อกลุ่ม ไม่ใช่คำของนักเรียน) */
  categories   text[]      not null default '{}',
  /** ฉบับปิดบางส่วนที่ครูเห็นเมื่อระดับ 1-2 */
  masked_text  text,
  /** ต้นฉบับ — ครูเห็นเมื่อระดับ 3 เท่านั้น และไม่เคยถูกลบทิ้ง */
  original_text text       not null,
  /** ครูดูแล้ว/คุยแล้ว */
  resolved_at  timestamptz,
  resolved_by  uuid        references public.teachers (id) on delete set null,
  teacher_note text,
  created_at   timestamptz not null default now()
);

-- คิวรีของแผงครูคือ "ธงที่ยังไม่ปิดของห้องนี้ เรียงระดับสูงก่อน ใหม่สุดก่อน"
-- index นี้ตรงกับคิวรีนั้นพอดี จึงไม่ต้องสแกนตาราง (ดูผลวัดใน result-t45.md)
create index content_flags_board_idx
  on public.content_flags (classroom_id, level desc, created_at desc)
  where resolved_at is null;
create index content_flags_student_idx on public.content_flags (student_id, created_at desc);

alter table public.content_flags enable row level security;

create policy content_flags_owner on public.content_flags
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

/**
 * บันทึกธงหนึ่งใบ — classroom_id เติมจากตาราง students ให้เอง ผู้เรียกไม่ต้องส่งมา
 * ระดับ 0 (ผ่าน) ไม่ต้องเรียกฟังก์ชันนี้ ตารางจึงมีแต่ของที่ครูต้องรู้
 */
create or replace function public.record_content_flag(
  p_student_id    uuid,
  p_context       text,
  p_level         smallint,
  p_categories    text[] default '{}',
  p_masked_text   text default null,
  p_original_text text default ''
)
returns setof public.content_flags
language sql
as $$
  insert into public.content_flags (
    student_id, classroom_id, context, level, categories, masked_text, original_text
  )
  select st.id, st.classroom_id, p_context, p_level,
         coalesce(p_categories, '{}'), p_masked_text, coalesce(p_original_text, '')
  from public.students st
  where st.id = p_student_id
  returning *;
$$;

/**
 * ธงของห้องสำหรับแผงครู
 *
 * **ระดับ 3 คืนข้อความเต็ม · ระดับ 1-2 คืนฉบับปิดบางส่วนเท่านั้น** — ตัดสินใน SQL
 * ต้นฉบับของระดับ 1-2 ไม่เคยออกจากฐานข้อมูล แต่ก็ไม่ถูกลบ (ยังตรวจย้อนได้ถ้าจำเป็น)
 */
create or replace function public.classroom_content_flags(
  p_teacher_id   uuid,
  p_classroom_id uuid,
  p_min_level    smallint default 1,
  p_since        timestamptz default null,
  p_include_resolved boolean default false
)
returns table (
  id           uuid,
  student_id   uuid,
  nickname     text,
  context      text,
  level        smallint,
  categories   text[],
  /** ข้อความที่ครูเห็น — เต็มเมื่อระดับ 3 · ปิดบางส่วนเมื่อระดับ 1-2 */
  text_for_teacher text,
  /** บอกหน้าเว็บว่าข้อความที่ได้เป็นฉบับเต็มหรือปิดบางส่วน */
  is_full_text boolean,
  resolved_at  timestamptz,
  created_at   timestamptz
)
language sql
stable
as $$
  select f.id,
         f.student_id,
         st.nickname,
         f.context,
         f.level,
         f.categories,
         case when f.level >= 3 then f.original_text else f.masked_text end,
         f.level >= 3,
         f.resolved_at,
         f.created_at
  from public.content_flags f
  join public.students st on st.id = f.student_id
  join public.classrooms c on c.id = f.classroom_id
  where f.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and f.level >= p_min_level
    and (p_include_resolved or f.resolved_at is null)
    and (p_since is null or f.created_at > p_since)
  order by f.level desc, f.created_at desc
  limit 200;
$$;

/** ครูดูแลเรียบร้อยแล้ว — ปิดธง แต่ไม่ลบข้อความ */
create or replace function public.resolve_content_flag(
  p_teacher_id uuid,
  p_flag_id    uuid,
  p_note       text default null
)
returns setof public.content_flags
language sql
as $$
  update public.content_flags f
     set resolved_at  = now(),
         resolved_by  = p_teacher_id,
         teacher_note = coalesce(p_note, f.teacher_note)
   where f.id = p_flag_id
     and f.resolved_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = f.classroom_id and c.teacher_id = p_teacher_id
     )
  returning f.*;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.claim_next_story_job(integer)                              from anon, public;
revoke execute on function public.reclaim_stale_story_jobs(integer)                          from anon, public;
revoke execute on function public.complete_story_job(uuid, jsonb)                            from anon, public;
revoke execute on function public.fail_story_job(uuid, text, boolean, integer)               from anon, public;
revoke execute on function public.find_student_story_job(uuid)                               from anon, public;
revoke execute on function public.record_content_flag(uuid, text, smallint, text[], text, text) from anon, public;
revoke execute on function public.classroom_content_flags(uuid, uuid, smallint, timestamptz, boolean) from anon, public;
revoke execute on function public.resolve_content_flag(uuid, uuid, text)                     from anon, public;

grant execute on function public.claim_next_story_job(integer)                              to service_role;
grant execute on function public.reclaim_stale_story_jobs(integer)                          to service_role;
grant execute on function public.complete_story_job(uuid, jsonb)                            to service_role;
grant execute on function public.fail_story_job(uuid, text, boolean, integer)               to service_role;
grant execute on function public.find_student_story_job(uuid)                               to service_role;
grant execute on function public.record_content_flag(uuid, text, smallint, text[], text, text) to service_role;
grant execute on function public.classroom_content_flags(uuid, uuid, smallint, timestamptz, boolean) to service_role;
grant execute on function public.resolve_content_flag(uuid, uuid, text)                     to service_role;
