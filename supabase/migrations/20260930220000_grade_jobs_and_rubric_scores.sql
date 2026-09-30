-- รอบ 8: คิวตรวจงานด้วย AI ที่อยู่รอดแม้เซิร์ฟเวอร์ดับ + ครูให้คะแนนรายด้านได้จริง

-- ------------------------------------------------------------------- grade_jobs
-- เดิมสถานะคิวอยู่ในหน่วยความจำของ process เซิร์ฟเวอร์ดับแล้วงานหายทั้งคิว
-- ย้ายมาอยู่ในตาราง แล้วให้ worker แย่งงานกันด้วย FOR UPDATE SKIP LOCKED

create table public.grade_jobs (
  id            uuid        primary key default gen_random_uuid(),
  student_id    uuid        not null references public.students (id) on delete cascade,
  submission_id uuid        references public.submissions (id) on delete cascade,
  status        text        not null default 'pending'
                  check (status in ('pending', 'claimed', 'done', 'failed')),
  attempts      integer     not null default 0 check (attempts >= 0),
  input         jsonb       not null default '{}'::jsonb,
  ai_result     jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- คิวอ่านด้วย (status, created_at) เสมอ: หยิบ pending ที่เก่าสุดก่อน
create index grade_jobs_queue_idx on public.grade_jobs (status, created_at);
create index grade_jobs_student_idx on public.grade_jobs (student_id);

alter table public.grade_jobs enable row level security;

create policy grade_jobs_owner on public.grade_jobs
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

/**
 * หยิบงานถัดไปแบบ atomic — หลาย worker เรียกพร้อมกันจะได้คนละงานเสมอ
 *
 * `for update skip locked` = แถวที่ worker อื่นกำลังล็อกอยู่จะถูกข้าม ไม่ต้องรอ ไม่ชนกัน
 * คืน 0 แถวเมื่อคิวว่าง · attempts บวกทุกครั้งที่หยิบ กันงานที่พังซ้ำ ๆ วนไม่จบ
 */
create or replace function public.claim_next_grade_job(
  p_max_attempts integer default 3
)
returns setof public.grade_jobs
language sql
as $$
  update public.grade_jobs j
     set status     = 'claimed',
         attempts   = j.attempts + 1,
         updated_at = now()
   where j.id = (
     select c.id
     from public.grade_jobs c
     where c.status = 'pending'
       and c.attempts < p_max_attempts
     order by c.created_at
     for update skip locked
     limit 1
   )
  returning j.*;
$$;

/**
 * กู้งานที่ worker ตายกลางทาง — claimed ค้างเกิน N นาทีให้กลับเป็น pending
 * เรียกจาก cron หรือจาก worker ตอนเริ่มรอบใหม่ก็ได้
 */
create or replace function public.reclaim_stale_grade_jobs(
  p_older_than_minutes integer default 5
)
returns setof public.grade_jobs
language sql
as $$
  update public.grade_jobs j
     set status     = 'pending',
         updated_at = now()
   where j.status = 'claimed'
     and j.updated_at < now() - make_interval(mins => p_older_than_minutes)
  returning j.*;
$$;

/** worker ตรวจเสร็จ — เก็บผลของ AI ไว้ในงาน (ตัวคะแนนจริงไปอยู่ที่ submissions.ai_scores) */
create or replace function public.complete_grade_job(
  p_job_id    uuid,
  p_ai_result jsonb
)
returns setof public.grade_jobs
language sql
as $$
  update public.grade_jobs j
     set status     = 'done',
         ai_result  = p_ai_result,
         error      = null,
         updated_at = now()
   where j.id = p_job_id
  returning j.*;
$$;

/**
 * worker พัง — เก็บสาเหตุไว้ ถ้ายังไม่ครบโควตาให้กลับไปเข้าคิวใหม่
 * ครบโควตาแล้วปักเป็น failed เพื่อไม่ให้วนไม่จบ (ครูยังให้คะแนนเองได้เสมอ)
 */
create or replace function public.fail_grade_job(
  p_job_id       uuid,
  p_error        text,
  p_max_attempts integer default 3
)
returns setof public.grade_jobs
language sql
as $$
  update public.grade_jobs j
     set status     = case when j.attempts >= p_max_attempts then 'failed' else 'pending' end,
         error      = p_error,
         updated_at = now()
   where j.id = p_job_id
  returning j.*;
$$;

-- --------------------------------------------- ครูให้คะแนนรายด้าน (teacher_changed)
-- teacher_confirmed_scores เก็บรูปแบบใหม่: คะแนน 4 ด้าน + ด้านที่ถ่วง 2 เท่า + คะแนนรวมถ่วงน้ำหนัก
-- ของเดิมที่เก็บ score ก้อนเดียวยังอ่านได้ จึงเทียบทั้งสองคีย์
create or replace function public.confirm_submission_scores(
  p_teacher_id    uuid,
  p_submission_id uuid,
  p_scores        jsonb
)
returns setof public.submissions
language sql
as $$
  update public.submissions s
     set teacher_confirmed_scores = p_scores,
         needs_review             = false,
         confirmed_by             = p_teacher_id,
         confirmed_at             = now(),
         ai_scores_snapshot       = s.ai_scores,
         teacher_changed          = case
                                      when p_scores ? 'weightedTotal' and s.ai_scores ? 'weightedTotal'
                                        then (p_scores ->> 'weightedTotal') is distinct from (s.ai_scores ->> 'weightedTotal')
                                      when p_scores ? 'dimensions' and s.ai_scores ? 'dimensions'
                                        then (p_scores -> 'dimensions') is distinct from (s.ai_scores -> 'dimensions')
                                      when p_scores ? 'score' and s.ai_scores ? 'score'
                                        then (p_scores ->> 'score') is distinct from (s.ai_scores ->> 'score')
                                      else null
                                    end,
         updated_at               = now()
   where s.id = p_submission_id
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = s.student_id
         and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

-- ------------------------------------------------------------------------ grants

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.claim_next_grade_job(integer)          from anon, public;
revoke execute on function public.reclaim_stale_grade_jobs(integer)      from anon, public;
revoke execute on function public.complete_grade_job(uuid, jsonb)        from anon, public;
revoke execute on function public.fail_grade_job(uuid, text, integer)    from anon, public;

grant execute on function public.claim_next_grade_job(integer)        to service_role;
grant execute on function public.reclaim_stale_grade_jobs(integer)    to service_role;
grant execute on function public.complete_grade_job(uuid, jsonb)      to service_role;
grant execute on function public.fail_grade_job(uuid, text, integer)  to service_role;
