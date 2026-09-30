-- ============================================================================
-- คำตอบรายข้อของแบบทดสอบก่อน-หลังเรียน (T59)
--
-- ทำไมต้องมี: สเปกข้อ 9.4 บังคับ 6 สถิติ ตอนนี้ทำได้ 4
--   ค่าความยาก p และอำนาจจำแนก r คำนวณจาก "ใครตอบข้อไหนถูก" เท่านั้น
--   ฐานข้อมูลเดิมเก็บแค่คะแนนรวม (profiles.pre_test_score / post_test_score)
--   core/statistics.ts itemAnalysis() เขียนเสร็จตั้งแต่แรกแต่ไม่มีข้อมูลป้อน
--
-- กติกาที่ตารางนี้บังคับ:
--   1. **ถูก/ผิดตัดสินที่เซิร์ฟเวอร์เท่านั้น** — คอลัมน์ is_correct มาจาก core/quiz.gradeQuiz()
--      ซึ่งอ่าน content/quiz-answers.json ฝั่งเซิร์ฟเวอร์ ไม่มีทางที่เบราว์เซอร์ส่งค่านี้มาเอง
--      (ฟังก์ชันเขียนด้านล่างรับ is_correct จาก service_role เท่านั้น anon ถูกถอนสิทธิ์)
--   2. **เฉลยห้ามรั่วขึ้นแผงครู** — choice_index เก็บไว้ (ครูขอดูย้อนหลังได้ทาง SQL)
--      แต่ฟังก์ชันอ่านสำหรับแผงครู `classroom_quiz_item_sheets` **ไม่คืน choice_index**
--      เพราะ (item_id, choice_index, is_correct=true) แถวเดียวก็เปิดเฉลยข้อนั้นทันที
--   3. **ค่าความยากต้องคิดแยกชุด** — ชุด pre กับ post เป็นข้อสอบคู่ขนาน 2 ชุด (A/B)
--      รหัสข้อคนละชุดกัน (pre-1 / post-1) และ quiz_set ติดไปทุกแถว
--      ฟังก์ชันอ่านคืน quiz_set มาด้วย ฝั่ง endpoint จึงจัดกลุ่มก่อนเรียก itemAnalysis()
--   4. ทำแบบทดสอบได้ครั้งเดียว (กติกาเดิมของ /api/pretest /api/posttest)
--      unique (student_id, quiz_set, item_id) + on conflict do nothing
--      ทำให้ยิงซ้ำ/ยิงพร้อมกันไม่ทับคำตอบเดิม
-- ============================================================================

create table if not exists public.quiz_item_responses (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students (id) on delete cascade,
  /** ห้องของผู้ตอบ — เก็บซ้ำเพื่อให้รายงานรายห้องอ่านได้โดยไม่ต้อง join students */
  classroom_id uuid        not null references public.classrooms (id) on delete cascade,
  /** ชุดข้อสอบคู่ขนาน: pre = ชุด A ก่อนเรียน · post = ชุด B หลังเรียน */
  quiz_set     text        not null check (quiz_set in ('pre', 'post')),
  /** รหัสข้อตาม content/quiz.json เช่น pre-1 · post-7 */
  item_id      text        not null,
  /** ตัวเลือกที่กดจริง 0-3 · null = ไม่ได้ตอบ (นับเป็นผิดตาม core/quiz.gradeQuiz) */
  choice_index smallint    check (choice_index between 0 and 3),
  /** ผลตรวจจากเซิร์ฟเวอร์ ไม่ใช่ค่าที่เบราว์เซอร์ส่งมา */
  is_correct   boolean     not null,
  answered_at  timestamptz not null default now(),
  constraint quiz_item_responses_once unique (student_id, quiz_set, item_id)
);

-- คิวรีของรายงานรายห้องคือ "ทุกแถวของห้องนี้ แยกตามชุด" — index ตรงกับคิวรีนั้นพอดี
create index if not exists quiz_item_responses_class_idx
  on public.quiz_item_responses (classroom_id, quiz_set, item_id);

alter table public.quiz_item_responses enable row level security;

-- ครูเห็นเฉพาะห้องตัวเอง (service_role ข้าม RLS อยู่แล้ว สิทธิ์จริงบังคับในฟังก์ชันด้านล่าง)
drop policy if exists quiz_item_responses_owner on public.quiz_item_responses;
create policy quiz_item_responses_owner on public.quiz_item_responses
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

/**
 * บันทึกคำตอบทั้งชุดในครั้งเดียว
 *
 * p_items = [{"itemId":"pre-1","choiceIndex":2,"correct":true}, ...]
 *   correct มาจาก core/quiz.gradeQuiz().correctByItem ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * classroom_id เติมจากตาราง students ให้เอง — ผู้เรียกส่งมาไม่ได้ (ห้ามเชื่อ id จาก request body)
 * นักเรียนที่ไม่มีอยู่จริง = 0 แถว ไม่เกิดแถวลอย
 * ทำซ้ำ = on conflict do nothing คำตอบเดิมไม่ถูกทับ (แบบทดสอบทำได้ครั้งเดียว)
 */
create or replace function public.record_quiz_item_responses(
  p_student_id uuid,
  p_quiz_set   text,
  p_items      jsonb
)
returns integer
language sql
as $$
  with inserted as (
    insert into public.quiz_item_responses (
      student_id, classroom_id, quiz_set, item_id, choice_index, is_correct
    )
    select st.id,
           st.classroom_id,
           p_quiz_set,
           item ->> 'itemId',
           nullif(item ->> 'choiceIndex', '')::smallint,
           coalesce((item ->> 'correct')::boolean, false)
    from public.students st
    cross join lateral jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    where st.id = p_student_id
      and p_quiz_set in ('pre', 'post')
      and coalesce(item ->> 'itemId', '') <> ''
    on conflict on constraint quiz_item_responses_once do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

/**
 * แผ่นคำตอบของทั้งห้องสำหรับรายงานรายห้อง (T-11)
 *
 * **ไม่คืน choice_index** — ดูเหตุผลข้อ 2 หัวไฟล์ (กันเฉลยรั่วขึ้นแผงครู)
 * ครูคนอื่นขอห้องนี้ = เงื่อนไขเจ้าของในคิวรีเดียวกันตัดทิ้ง คืน 0 แถว แล้ว endpoint ตอบ 404
 * ไม่คืนชื่อเล่น เพราะค่าความยาก/อำนาจจำแนกเป็นสถิติรายข้อ ไม่ใช่รายคน
 */
create or replace function public.classroom_quiz_item_sheets(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (
  student_id uuid,
  quiz_set   text,
  item_id    text,
  is_correct boolean
)
language sql
stable
as $$
  select r.student_id, r.quiz_set, r.item_id, r.is_correct
  from public.quiz_item_responses r
  join public.classrooms c on c.id = r.classroom_id
  where r.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
  order by r.quiz_set, r.student_id, r.item_id;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke all on public.quiz_item_responses from anon;

revoke execute on function public.record_quiz_item_responses(uuid, text, jsonb) from anon, public;
revoke execute on function public.classroom_quiz_item_sheets(uuid, uuid)        from anon, public;

grant execute on function public.record_quiz_item_responses(uuid, text, jsonb) to service_role;
grant execute on function public.classroom_quiz_item_sheets(uuid, uuid)        to service_role;
