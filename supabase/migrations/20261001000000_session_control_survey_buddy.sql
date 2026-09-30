-- รอบ 9 (T39): เตรียมฐานข้อมูลรับสเปกฉบับเต็ม
--   T-03  ครูควบคุมช่วงของคาบและเวลา (ช่วงตามสเปกข้อ 3.2)
--   S-40  แบบสอบถามความพึงพอใจ 10 ข้อ (ไม่ผูกกับชื่อผู้ตอบ)
--   E-04 / S-41  จับคู่คู่หูและคู่คิด พร้อมสถานะคำขอ
--   T-10 / T-11  รายงานรายคนและรายห้อง (ฟังก์ชันเดียวจบ ตรวจเจ้าของในคิวรีเดียวกัน)
--
-- เพิ่มอย่างเดียว ไม่แก้ของเดิมที่หน้าเว็บใช้อยู่ · ทุกตารางใหม่เปิด RLS และ revoke สิทธิ์ anon

-- ───────────────────────────────────────────── คอลัมน์เสริมของนักเรียน
-- ต้องมีเพื่อให้ E-04 คัดคู่หูได้: "ใช้งานอยู่ใน 60 วินาทีที่ผ่านมา" · "ไม่ได้อยู่ในด่านบอส"
-- · "เปิดรับคำขอคู่หูไว้" (ตั้งค่าใน S-39)

alter table public.students
  add column if not exists last_seen_at             timestamptz,
  add column if not exists current_screen           text,
  add column if not exists accepts_buddy_requests   boolean not null default true,
  add column if not exists buddy_helped_count       integer not null default 0
    check (buddy_helped_count >= 0);

comment on column public.students.current_screen is
  'หน้าจอล่าสุดที่นักเรียนอยู่ เช่น mission-m2 · boss · help-waiting — E-04 ใช้กันไม่ให้ส่งคำขอหาคนที่กำลังทำด่านบอสหรือรอครู';

-- เวลาเริ่มภารกิจ — รายงาน T-10 ต้องบอก "เวลาที่ใช้ต่อภารกิจ" ซึ่งเดิมคำนวณไม่ได้
-- เพราะมีแต่ passed_at ไม่มีจุดเริ่ม
alter table public.mission_progress
  add column if not exists started_at timestamptz;

update public.mission_progress
   set started_at = coalesce(started_at, passed_at, updated_at)
 where started_at is null;

-- ───────────────────────────────────────────────────── T-03 ช่วงของคาบ
-- ช่วงและลำดับตามสเปกข้อ 3.2 (stateDiagram): รอเริ่ม → รู้จักตัวเอง → ภารกิจย่อย → ด่านบอส
--                                            → ครูสรุป → สะท้อนคิด → จบคาบ → ทำต่อที่บ้าน
-- "ช่วงของห้อง" = เพดานสูงสุดที่ครูเปิดให้ทำ ส่วนตำแหน่งจริงของนักเรียนอยู่ที่ progress ของแต่ละคน

create table public.class_sessions (
  id                   uuid        primary key default gen_random_uuid(),
  classroom_id         uuid        not null references public.classrooms (id) on delete cascade,
  phase                text        not null default 'wait'
                         check (phase in ('wait','onboard','mission','boss','summary','reflect','end','home')),
  phase_started_at     timestamptz not null default now(),
  phase_changed_by     uuid        references public.teachers (id) on delete set null,
  /** ช่วงก่อนหน้า + เวลาที่ย้าย — ใช้ปุ่ม "ย้อนการย้ายช่วง" ภายใน 30 วินาที */
  previous_phase       text,
  previous_phase_at    timestamptz,
  /** นาฬิกาของช่วง: กำลังเดิน = timer_end_at มีค่า · หยุดอยู่ = timer_paused_seconds มีค่า */
  timer_end_at         timestamptz,
  timer_paused_seconds integer     check (timer_paused_seconds is null or timer_paused_seconds >= 0),
  timer_extended_seconds integer   not null default 0 check (timer_extended_seconds >= 0),
  /** ปุ่ม "ให้ทุกคนดูจอหน้าห้อง" — ทุกเครื่องขึ้นหน้าพักทันที (SC-23) */
  focus_screen         boolean     not null default false,
  focus_screen_at      timestamptz,
  /** ตั้งค่าคาบ (T-02) */
  allow_early_boss     boolean     not null default true,   -- เปิดบอสให้คนที่พร้อมก่อน
  ai_enabled           boolean     not null default true,
  survey_enabled       boolean     not null default false,  -- S-40 ค่าเริ่มต้นปิด
  home_deadline        timestamptz,                         -- ทำต่อที่บ้านได้ถึงเมื่อไร
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- หนึ่งห้องมีคาบที่ยังไม่จบได้ครั้งละ 1 คาบเท่านั้น
create unique index class_sessions_active_idx
  on public.class_sessions (classroom_id) where ended_at is null;
create index class_sessions_classroom_idx on public.class_sessions (classroom_id, created_at desc);

/** หลักฐานว่าครูเป็นคนกำหนดจังหวะห้อง + ใช้ย้อนการย้ายช่วง */
create table public.session_phase_changes (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.class_sessions (id) on delete cascade,
  from_phase  text,
  to_phase    text        not null,
  changed_by  uuid        references public.teachers (id) on delete set null,
  undone_at   timestamptz,
  changed_at  timestamptz not null default now()
);
create index session_phase_changes_session_idx
  on public.session_phase_changes (session_id, changed_at desc);

/**
 * ปลดล็อกช่วงให้ "เฉพาะบางคน" — สเปกข้อ 3.2 ให้คนที่พร้อมเข้าด่านบอสก่อนห้องได้
 * ต่างจาก allow_early_boss ตรงที่อันนี้ครูชี้เป็นรายคน
 */
create table public.student_phase_unlocks (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  phase      text        not null
               check (phase in ('onboard','mission','boss','summary','reflect','home')),
  granted_by uuid        references public.teachers (id) on delete set null,
  note       text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (student_id, phase)
);

-- ────────────────────────────────────────── S-40 แบบสอบถามความพึงพอใจ
-- ตั้งใจแยกคำตอบออกจากตัวนักเรียน: survey_responses ไม่มี student_id เลย
-- ระบบจำแค่ "ใครตอบแล้ว" ไว้ในอีกตารางหนึ่ง เพื่อให้ผู้เรียนกล้าตอบตามจริง

create table public.survey_responses (
  id           uuid        primary key default gen_random_uuid(),
  classroom_id uuid        not null references public.classrooms (id) on delete cascade,
  session_id   uuid        references public.class_sessions (id) on delete set null,
  -- ข้อ 1-8 มาตรประมาณค่า 5 ระดับ (5 มากที่สุด ถึง 1 น้อยที่สุด) ต้องตอบครบ
  q1 smallint not null check (q1 between 1 and 5),  -- สื่อนี้ใช้งานง่าย
  q2 smallint not null check (q2 between 1 and 5),  -- คำแนะนำการใช้งานชัดเจน
  q3 smallint not null check (q3 between 1 and 5),  -- ภารกิจเกี่ยวกับสิ่งที่ฉันสนใจ
  q4 smallint not null check (q4 between 1 and 5),  -- ความยากของภารกิจพอดีกับฉัน
  q5 smallint not null check (q5 between 1 and 5),  -- ตัวช่วยช่วยให้ฉันเข้าใจมากขึ้น
  q6 smallint not null check (q6 between 1 and 5),  -- ข้อมูลตอบกลับช่วยให้รู้ว่าต้องปรับอะไร
  q7 smallint not null check (q7 between 1 and 5),  -- อยากเรียนเรื่องอื่นด้วยสื่อแบบนี้
  q8 smallint not null check (q8 between 1 and 5),  -- โดยรวมพึงพอใจสื่อนี้
  -- ข้อ 9-10 ปลายเปิด ไม่บังคับ · เก็บต้นฉบับไว้ ส่วนที่ครูเห็นคือฉบับผ่านตัวกรองคำไม่เหมาะสม
  like_text         text,
  improve_text      text,
  like_text_safe    text,
  improve_text_safe text,
  created_at timestamptz not null default now()
);
create index survey_responses_classroom_idx on public.survey_responses (classroom_id);

/** ตอบได้ครั้งเดียวต่อนักเรียนต่อคาบ — เก็บแค่สถานะ ไม่มีคำตอบ */
create table public.survey_completions (
  student_id   uuid        not null references public.students (id) on delete cascade,
  session_id   uuid        references public.class_sessions (id) on delete set null,
  completed_at timestamptz not null default now(),
  primary key (student_id)
);

-- ──────────────────────────────────────── E-04 / S-41 คู่หูและคู่คิด
-- คำขอหนึ่งใบ = ผู้ขอหนึ่งคน · ส่งคำขอทีละคน ลองได้สูงสุด 3 คน (buddy_offers เก็บลำดับที่ถูกขอ)

create table public.buddy_requests (
  id            uuid        primary key default gen_random_uuid(),
  classroom_id  uuid        not null references public.classrooms (id) on delete cascade,
  requester_id  uuid        not null references public.students (id) on delete cascade,
  helper_id     uuid        references public.students (id) on delete set null,
  mission_id    text        not null check (mission_id in ('m1','m2','m3','m4','boss')),
  kind          text        not null default 'buddy' check (kind in ('buddy','thinking-partner')),
  status        text        not null default 'searching'
                  check (status in ('searching','pending','accepted','done','no-helper','cancelled')),
  attempts      smallint    not null default 0 check (attempts >= 0 and attempts <= 3),
  /** ผู้ขอให้ผลตอบรับหลังจบ: 👍 helpful หรือ 🙂 ok — ไม่มีผลต่อดาวของใคร */
  feedback      text        check (feedback in ('helpful','ok')),
  /** ผ่านภารกิจนั้นได้ไหมหลังเพื่อนช่วย — ครูใช้ดูว่าการจับคู่ได้ผลจริงไหม (T-05, T-10) */
  requester_passed_after boolean,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  done_at       timestamptz,
  resolved_at   timestamptz
);

-- ผู้ขอมีคำขอที่ยังไม่จบได้ครั้งละ 1 ใบ (กติกา E-04)
create unique index buddy_requests_one_open_idx on public.buddy_requests (requester_id)
  where status in ('searching','pending','accepted');
create index buddy_requests_classroom_idx on public.buddy_requests (classroom_id, created_at desc);
create index buddy_requests_helper_idx on public.buddy_requests (helper_id) where status = 'accepted';

create table public.buddy_offers (
  id          uuid        primary key default gen_random_uuid(),
  request_id  uuid        not null references public.buddy_requests (id) on delete cascade,
  helper_id   uuid        not null references public.students (id) on delete cascade,
  attempt_no  smallint    not null check (attempt_no between 1 and 3),
  match_score integer,
  status      text        not null default 'pending'
                check (status in ('pending','accepted','declined','expired')),
  sent_at     timestamptz not null default now(),
  expires_at  timestamptz not null,
  responded_at timestamptz,
  unique (request_id, helper_id)
);
create index buddy_offers_helper_idx on public.buddy_offers (helper_id, status);

-- ─────────────────────────────────────────────────────────────── RLS
-- ทุกตารางใหม่: เปิด RLS · policy ผูกกับครูเจ้าของห้องเท่านั้น · anon ไม่มีสิทธิ์ใด ๆ

alter table public.class_sessions         enable row level security;
alter table public.session_phase_changes  enable row level security;
alter table public.student_phase_unlocks  enable row level security;
alter table public.survey_responses       enable row level security;
alter table public.survey_completions     enable row level security;
alter table public.buddy_requests         enable row level security;
alter table public.buddy_offers           enable row level security;

create policy class_sessions_owner on public.class_sessions
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

create policy session_phase_changes_owner on public.session_phase_changes
  for all to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = session_phase_changes.session_id and public.is_classroom_owner(s.classroom_id)
  ))
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = session_phase_changes.session_id and public.is_classroom_owner(s.classroom_id)
  ));

create policy student_phase_unlocks_owner on public.student_phase_unlocks
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- ครูอ่านแบบสอบถามของห้องตัวเองได้ แต่ในตารางไม่มีชื่อผู้ตอบให้ดูอยู่แล้ว
create policy survey_responses_owner on public.survey_responses
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

create policy survey_completions_owner on public.survey_completions
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy buddy_requests_owner on public.buddy_requests
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

create policy buddy_offers_owner on public.buddy_offers
  for all to authenticated
  using (exists (
    select 1 from public.buddy_requests r
    where r.id = buddy_offers.request_id and public.is_classroom_owner(r.classroom_id)
  ))
  with check (exists (
    select 1 from public.buddy_requests r
    where r.id = buddy_offers.request_id and public.is_classroom_owner(r.classroom_id)
  ));

-- ───────────────────────────────────────── T-03 ฟังก์ชันควบคุมคาบ
-- ทุกฟังก์ชันรับ p_teacher_id ที่เซิร์ฟเวอร์ยืนยันแล้ว และตรวจความเป็นเจ้าของ
-- **ในคิวรีเดียวกับที่เขียน** (EXISTS ใน WHERE) ไม่ใช่ query แยกแล้วค่อยเทียบ
-- ไม่ใช่เจ้าของ = คืน 0 แถว ให้ API แปลงเป็น 404

/** เปิดคาบของห้อง (ถ้ายังไม่มีคาบที่ค้างอยู่) หรือคืนคาบที่กำลังเดินอยู่ */
create or replace function public.ensure_class_session(
  p_teacher_id  uuid,
  p_classroom_id uuid
)
returns setof public.class_sessions
language plpgsql
as $$
declare
  v_session public.class_sessions;
begin
  select s.* into v_session
  from public.class_sessions s
  join public.classrooms c on c.id = s.classroom_id
  where s.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and s.ended_at is null
  order by s.created_at desc
  limit 1;

  if found then
    return next v_session;
    return;
  end if;

  insert into public.class_sessions (classroom_id, phase_changed_by)
  select c.id, p_teacher_id
  from public.classrooms c
  where c.id = p_classroom_id and c.teacher_id = p_teacher_id
  returning * into v_session;

  if not found then
    return; -- ไม่ใช่ห้องของครูคนนี้
  end if;

  insert into public.session_phase_changes (session_id, from_phase, to_phase, changed_by)
  values (v_session.id, null, v_session.phase, p_teacher_id);

  return next v_session;
end;
$$;

/**
 * ย้ายช่วงของทั้งห้อง — ข้ามช่วงได้ (เช่น ภารกิจย่อย → ครูสรุป เมื่อเวลาไม่พอ)
 * p_timer_seconds ไม่ส่ง = ไม่ตั้งนาฬิกาให้ช่วงใหม่
 */
create or replace function public.set_session_phase(
  p_teacher_id     uuid,
  p_session_id     uuid,
  p_phase          text,
  p_timer_seconds  integer default null
)
returns setof public.class_sessions
language plpgsql
as $$
declare
  v_session public.class_sessions;
begin
  update public.class_sessions s
     set previous_phase       = s.phase,
         previous_phase_at    = now(),
         phase                = p_phase,
         phase_started_at     = now(),
         phase_changed_by     = p_teacher_id,
         timer_end_at         = case
                                  when p_timer_seconds is null then null
                                  else now() + make_interval(secs => p_timer_seconds)
                                end,
         timer_paused_seconds = null,
         timer_extended_seconds = 0,
         focus_screen         = false,   -- ย้ายช่วงใหม่ = ปลดหน้าพักให้อัตโนมัติ
         focus_screen_at      = null,
         updated_at           = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.* into v_session;

  if not found then
    return;
  end if;

  insert into public.session_phase_changes (session_id, from_phase, to_phase, changed_by)
  values (v_session.id, v_session.previous_phase, v_session.phase, p_teacher_id);

  return next v_session;
end;
$$;

/** ย้อนการย้ายช่วงล่าสุด เผื่อครูกดพลาด — ได้เฉพาะภายในเวลาที่กำหนด (สเปกให้ 30 วินาที) */
create or replace function public.revert_session_phase(
  p_teacher_id      uuid,
  p_session_id      uuid,
  p_within_seconds  integer default 30
)
returns setof public.class_sessions
language plpgsql
as $$
declare
  v_change  public.session_phase_changes;
  v_session public.class_sessions;
begin
  select ch.* into v_change
  from public.session_phase_changes ch
  join public.class_sessions s on s.id = ch.session_id
  join public.classrooms c on c.id = s.classroom_id
  where ch.session_id = p_session_id
    and c.teacher_id = p_teacher_id
    and ch.undone_at is null
    and ch.from_phase is not null
    and ch.changed_at > now() - make_interval(secs => p_within_seconds)
  order by ch.changed_at desc
  limit 1;

  if not found then
    return; -- เลยเวลาย้อน หรือไม่ใช่เจ้าของ
  end if;

  update public.session_phase_changes
     set undone_at = now()
   where id = v_change.id;

  update public.class_sessions s
     set phase             = v_change.from_phase,
         phase_started_at  = now(),
         previous_phase    = s.phase,
         previous_phase_at = now(),
         phase_changed_by  = p_teacher_id,
         focus_screen      = false,
         updated_at        = now()
   where s.id = p_session_id
  returning s.* into v_session;

  return next v_session;
end;
$$;

/** ตั้งนาฬิกาใหม่ของช่วงปัจจุบัน (ปุ่ม "ตั้งใหม่") */
create or replace function public.set_session_timer(
  p_teacher_id uuid,
  p_session_id uuid,
  p_seconds    integer
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set timer_end_at         = case when p_seconds is null then null
                                     else now() + make_interval(secs => p_seconds) end,
         timer_paused_seconds = null,
         timer_extended_seconds = 0,
         updated_at           = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ปุ่ม +1 / +3 / +5 นาที — ขยายได้ทั้งตอนนาฬิกาเดินและตอนหยุดอยู่ */
create or replace function public.extend_session_timer(
  p_teacher_id  uuid,
  p_session_id  uuid,
  p_add_seconds integer
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set timer_end_at           = case
                                    when s.timer_paused_seconds is not null then s.timer_end_at
                                    else coalesce(s.timer_end_at, now()) + make_interval(secs => p_add_seconds)
                                  end,
         timer_paused_seconds   = case
                                    when s.timer_paused_seconds is not null
                                      then s.timer_paused_seconds + p_add_seconds
                                    else null
                                  end,
         timer_extended_seconds = s.timer_extended_seconds + greatest(p_add_seconds, 0),
         updated_at             = now()
   where s.id = p_session_id
     and s.ended_at is null
     and p_add_seconds > 0
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ปุ่ม ⏸ หยุด / เดินต่อ — หยุดแล้วเก็บเวลาที่เหลือไว้ เดินต่อคือนับจากเวลาที่เหลือนั้น */
create or replace function public.pause_session_timer(
  p_teacher_id uuid,
  p_session_id uuid,
  p_paused     boolean
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set timer_paused_seconds = case
           when p_paused then greatest(0, ceil(extract(epoch from coalesce(s.timer_end_at, now()) - now()))::integer)
           else null
         end,
         timer_end_at = case
           when p_paused then null
           else now() + make_interval(secs => coalesce(s.timer_paused_seconds, 0))
         end,
         updated_at = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ปุ่ม 📺 ให้ทุกคนดูจอหน้าห้อง — ขึ้นหน้าพักทุกเครื่องทันที ไม่เปลี่ยนช่วง */
create or replace function public.set_focus_screen(
  p_teacher_id uuid,
  p_session_id uuid,
  p_on         boolean
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set focus_screen    = p_on,
         focus_screen_at = case when p_on then now() else null end,
         updated_at      = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ตั้งค่าคาบ (T-02): เปิด/ปิด AI · เปิดบอสให้คนที่พร้อมก่อน · เปิดแบบสอบถาม · วันสุดท้ายของงานที่บ้าน
    ส่ง null = ไม่เปลี่ยนค่าเดิม */
create or replace function public.update_session_settings(
  p_teacher_id       uuid,
  p_session_id       uuid,
  p_ai_enabled       boolean     default null,
  p_allow_early_boss boolean     default null,
  p_survey_enabled   boolean     default null,
  p_home_deadline    timestamptz default null
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set ai_enabled       = coalesce(p_ai_enabled, s.ai_enabled),
         allow_early_boss = coalesce(p_allow_early_boss, s.allow_early_boss),
         survey_enabled   = coalesce(p_survey_enabled, s.survey_enabled),
         home_deadline    = coalesce(p_home_deadline, s.home_deadline),
         updated_at       = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ปิดคาบจริง (หลังหมดช่วงทำต่อที่บ้าน) — คาบที่ปิดแล้วเปิดห้องใหม่ได้ */
create or replace function public.close_class_session(
  p_teacher_id uuid,
  p_session_id uuid
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set ended_at   = now(),
         updated_at = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ปลดล็อกช่วงให้นักเรียนรายคน (เช่น เปิดด่านบอสให้คนที่พร้อมก่อนทั้งห้อง) */
create or replace function public.unlock_student_phase(
  p_teacher_id uuid,
  p_student_id uuid,
  p_phase      text,
  p_note       text default null
)
returns setof public.student_phase_unlocks
language sql
as $$
  insert into public.student_phase_unlocks (student_id, phase, granted_by, note)
  select st.id, p_phase, p_teacher_id, p_note
  from public.students st
  join public.classrooms c on c.id = st.classroom_id
  where st.id = p_student_id and c.teacher_id = p_teacher_id
  on conflict (student_id, phase) do update
    set granted_at = now(),
        granted_by = p_teacher_id,
        note       = coalesce(excluded.note, public.student_phase_unlocks.note),
        revoked_at = null
  returning *;
$$;

create or replace function public.revoke_student_phase_unlock(
  p_teacher_id uuid,
  p_student_id uuid,
  p_phase      text
)
returns setof public.student_phase_unlocks
language sql
as $$
  update public.student_phase_unlocks u
     set revoked_at = now()
   where u.student_id = p_student_id
     and u.phase = p_phase
     and u.revoked_at is null
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = u.student_id and c.teacher_id = p_teacher_id
     )
  returning u.*;
$$;

/** นักเรียนแตะหน้าจอ = ยังใช้งานอยู่ (E-04 ใช้เกณฑ์ 60 วินาที) */
create or replace function public.touch_student_presence(
  p_student_id uuid,
  p_screen     text default null
)
returns setof public.students
language sql
as $$
  update public.students s
     set last_seen_at   = now(),
         current_screen = coalesce(p_screen, s.current_screen)
   where s.id = p_student_id
  returning s.*;
$$;

-- ────────────────────────────────────── S-40 บันทึกและสรุปแบบสอบถาม

/**
 * ส่งแบบสอบถาม — เขียน 2 ตารางในทรานแซกชันเดียว
 * คำตอบลง survey_responses (ไม่มี student_id) · สถานะ "ตอบแล้ว" ลง survey_completions
 * คืน false เมื่อคนนี้ตอบไปแล้ว (ตอบซ้ำไม่ได้)
 */
create or replace function public.submit_survey_response(
  p_student_id        uuid,
  p_scores            jsonb,
  p_like_text         text default null,
  p_improve_text      text default null,
  p_like_text_safe    text default null,
  p_improve_text_safe text default null
)
returns boolean
language plpgsql
as $$
declare
  v_classroom uuid;
  v_session   uuid;
  v_key       text;
begin
  select st.classroom_id into v_classroom
  from public.students st
  where st.id = p_student_id;

  if not found then
    return false;
  end if;

  foreach v_key in array array['q1','q2','q3','q4','q5','q6','q7','q8'] loop
    if p_scores ->> v_key is null then
      raise exception 'ต้องตอบข้อ 1-8 ให้ครบ (ขาด %)', v_key using errcode = '22023';
    end if;
  end loop;

  select s.id into v_session
  from public.class_sessions s
  where s.classroom_id = v_classroom and s.ended_at is null
  order by s.created_at desc
  limit 1;

  insert into public.survey_completions (student_id, session_id)
  values (p_student_id, v_session)
  on conflict (student_id) do nothing;

  if not found then
    return false; -- ตอบไปแล้ว ไม่เขียนคำตอบซ้ำ
  end if;

  insert into public.survey_responses (
    classroom_id, session_id, q1, q2, q3, q4, q5, q6, q7, q8,
    like_text, improve_text, like_text_safe, improve_text_safe
  )
  values (
    v_classroom, v_session,
    (p_scores ->> 'q1')::smallint, (p_scores ->> 'q2')::smallint,
    (p_scores ->> 'q3')::smallint, (p_scores ->> 'q4')::smallint,
    (p_scores ->> 'q5')::smallint, (p_scores ->> 'q6')::smallint,
    (p_scores ->> 'q7')::smallint, (p_scores ->> 'q8')::smallint,
    p_like_text, p_improve_text, p_like_text_safe, p_improve_text_safe
  );

  return true;
end;
$$;

/**
 * สรุปแบบสอบถามให้ครู — ค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน การแจกแจงรายข้อ และข้อความปลายเปิด
 * **ไม่มีชื่อผู้ตอบ** เพราะตารางไม่ได้เก็บไว้ตั้งแต่แรก
 * ข้อความที่คืนเป็นฉบับที่ผ่านตัวกรองคำไม่เหมาะสมแล้วเท่านั้น
 */
create or replace function public.survey_summary(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns jsonb
language sql
stable
as $$
  with owned as (
    select c.id
    from public.classrooms c
    where c.id = p_classroom_id and c.teacher_id = p_teacher_id
  ),
  rows_all as (
    select r.* from public.survey_responses r join owned o on o.id = r.classroom_id
  ),
  unpivot as (
    select 'q1' as item, q1 as score from rows_all
    union all select 'q2', q2 from rows_all
    union all select 'q3', q3 from rows_all
    union all select 'q4', q4 from rows_all
    union all select 'q5', q5 from rows_all
    union all select 'q6', q6 from rows_all
    union all select 'q7', q7 from rows_all
    union all select 'q8', q8 from rows_all
  ),
  per_item as (
    select item,
           count(*)                        as n,
           round(avg(score)::numeric, 2)   as mean,
           round(coalesce(stddev_samp(score), 0)::numeric, 2) as sd,
           jsonb_build_object(
             '1', count(*) filter (where score = 1),
             '2', count(*) filter (where score = 2),
             '3', count(*) filter (where score = 3),
             '4', count(*) filter (where score = 4),
             '5', count(*) filter (where score = 5)
           ) as distribution
    from unpivot
    group by item
  )
  select case when not exists (select 1 from owned) then null else jsonb_build_object(
    'responses', (select count(*) from rows_all),
    'completed', (
      select count(*) from public.survey_completions sc
      join public.students st on st.id = sc.student_id
      where st.classroom_id = p_classroom_id
    ),
    'overallMean', (select round(avg(score)::numeric, 2) from unpivot),
    'items', (select coalesce(jsonb_object_agg(item, jsonb_build_object(
        'n', n, 'mean', mean, 'sd', sd, 'distribution', distribution
      )), '{}'::jsonb) from per_item),
    'openEnded', jsonb_build_object(
      'like',    (select coalesce(jsonb_agg(t.like_text_safe order by t.created_at), '[]'::jsonb)
                  from rows_all t where coalesce(t.like_text_safe, '') <> ''),
      'improve', (select coalesce(jsonb_agg(t.improve_text_safe order by t.created_at), '[]'::jsonb)
                  from rows_all t where coalesce(t.improve_text_safe, '') <> '')
    )
  ) end;
$$;

-- ───────────────────────────── E-04 / S-41 จับคู่และตอบรับคำขอ

/**
 * หาคนที่เป็นคู่หูได้ตามเกณฑ์ E-04 พร้อมคะแนนจัดอันดับ
 * เกณฑ์: อยู่ห้องเดียวกัน · ใช้งานใน 60 วินาทีที่ผ่านมา · ผ่านภารกิจนั้นแล้ว (เล่นผ่านหรือข้ามเพราะมั่นใจ)
 *        · ไม่ได้อยู่ด่านบอส/รอครู · เปิดรับคำขอ · กำลังช่วยอยู่ไม่ถึง 2 คน
 *        · ไม่ได้ปฏิเสธผู้ขอคนนี้ใน 5 นาทีที่ผ่านมา
 * คะแนน: 3 ดาว +3 · ข้ามเพราะมั่นใจ +2 · 2 ดาว +1 · ชอบเรียนกับเพื่อน +1 · ช่วยไปแล้วครั้งละ −1
 */
create or replace function public.find_buddy_candidates(
  p_student_id uuid,
  p_mission_id text,
  p_limit      integer default 3
)
returns table (student_id uuid, nickname text, score integer)
language sql
as $$
  with me as (
    select st.id, st.classroom_id from public.students st where st.id = p_student_id
  )
  select cand.id,
         cand.nickname,
         (
           coalesce(case when mp.passed_at is not null and mp.stars = 3 then 3
                         when mp.passed_at is not null and mp.stars = 2 then 1
                         when mp.passed_at is not null then 0 end, 0)
           + case when sk.student_id is not null and mp.passed_at is null then 2 else 0 end
           + case when pr.learning_route = 'buddy' then 1 else 0 end
           - coalesce(cand.buddy_helped_count, 0)
         )::integer as score
  from public.students cand
  join me on me.classroom_id = cand.classroom_id and cand.id <> me.id
  left join public.mission_progress mp
    on mp.student_id = cand.id and mp.mission_id = p_mission_id
  left join public.mission_skips sk
    on sk.student_id = cand.id and sk.mission_id = p_mission_id
  left join public.profiles pr on pr.student_id = cand.id
  where cand.accepts_buddy_requests
    and cand.last_seen_at is not null
    and cand.last_seen_at > now() - interval '60 seconds'
    and coalesce(cand.current_screen, '') not in ('boss', 'help-waiting')
    and (mp.passed_at is not null or sk.student_id is not null)
    and (
      select count(*) from public.buddy_requests br
      where br.helper_id = cand.id and br.status = 'accepted'
    ) < 2
    and not exists (
      select 1
      from public.buddy_offers o
      join public.buddy_requests r on r.id = o.request_id
      where o.helper_id = cand.id
        and r.requester_id = p_student_id
        and o.status = 'declined'
        and o.responded_at > now() - interval '5 minutes'
    )
  order by score desc, random()
  limit greatest(p_limit, 1);
$$;

/** เปิดคำขอใหม่ — ผู้ขอมีคำขอที่ยังไม่จบได้ครั้งละ 1 ใบ (คืน 0 แถวถ้ามีอยู่แล้ว) */
create or replace function public.create_buddy_request(
  p_student_id uuid,
  p_mission_id text,
  p_kind       text default 'buddy'
)
returns setof public.buddy_requests
language sql
as $$
  insert into public.buddy_requests (classroom_id, requester_id, mission_id, kind)
  select st.classroom_id, st.id, p_mission_id, p_kind
  from public.students st
  where st.id = p_student_id
  on conflict do nothing
  returning *;
$$;

/** ส่งคำขอไปที่ผู้ช่วยคนถัดไป — ลองได้สูงสุด 3 คน ตอบภายใน 60 วินาที */
create or replace function public.offer_buddy_request(
  p_request_id  uuid,
  p_helper_id   uuid,
  p_match_score integer default null,
  p_seconds     integer default 60
)
returns setof public.buddy_offers
language plpgsql
as $$
declare
  v_request public.buddy_requests;
  v_offer   public.buddy_offers;
begin
  update public.buddy_requests r
     set attempts = r.attempts + 1,
         status   = 'pending'
   where r.id = p_request_id
     and r.status in ('searching', 'pending')
     and r.attempts < 3
     -- ผู้ช่วยต้องอยู่ห้องเดียวกันเสมอ ไม่ว่าใครเป็นคนเรียกฟังก์ชันนี้
     and exists (
       select 1 from public.students st
       where st.id = p_helper_id and st.classroom_id = r.classroom_id
     )
  returning r.* into v_request;

  if not found then
    return;
  end if;

  insert into public.buddy_offers (request_id, helper_id, attempt_no, match_score, expires_at)
  values (p_request_id, p_helper_id, v_request.attempts, p_match_score,
          now() + make_interval(secs => p_seconds))
  on conflict (request_id, helper_id) do nothing
  returning * into v_offer;

  if not found then
    return; -- เคยส่งคำขอให้คนนี้ไปแล้วในใบเดียวกัน
  end if;

  return next v_offer;
end;
$$;

/** ผู้ช่วยกด "ช่วยได้" หรือ "ตอนนี้ไม่สะดวก" — ปฏิเสธแล้วคำขอกลับไปหาคนถัดไป */
create or replace function public.respond_buddy_offer(
  p_helper_id uuid,
  p_offer_id  uuid,
  p_accept    boolean
)
returns setof public.buddy_offers
language plpgsql
as $$
declare
  v_offer public.buddy_offers;
begin
  update public.buddy_offers o
     set status       = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where o.id = p_offer_id
     and o.helper_id = p_helper_id      -- ตอบแทนคนอื่นไม่ได้
     and o.status = 'pending'
     and o.expires_at > now()
  returning o.* into v_offer;

  if not found then
    return;
  end if;

  if p_accept then
    update public.buddy_requests r
       set status      = 'accepted',
           helper_id   = p_helper_id,
           accepted_at = now()
     where r.id = v_offer.request_id
       and r.status = 'pending';
  else
    update public.buddy_requests r
       set status = case when r.attempts >= 3 then 'no-helper' else 'searching' end,
           resolved_at = case when r.attempts >= 3 then now() else null end
     where r.id = v_offer.request_id
       and r.status = 'pending';
  end if;

  return next v_offer;
end;
$$;

/** ผู้ขอกด "ขอบคุณ" — ปิดคำขอ เก็บผลตอบรับและผลว่าผ่านภารกิจได้ไหมหลังเพื่อนช่วย */
create or replace function public.complete_buddy_request(
  p_student_id     uuid,
  p_request_id     uuid,
  p_feedback       text    default null,
  p_passed_after   boolean default null
)
returns setof public.buddy_requests
language plpgsql
as $$
declare
  v_request public.buddy_requests;
begin
  update public.buddy_requests r
     set status                 = 'done',
         feedback               = coalesce(p_feedback, r.feedback),
         requester_passed_after = coalesce(p_passed_after, r.requester_passed_after),
         done_at                = now(),
         resolved_at            = now()
   where r.id = p_request_id
     and r.requester_id = p_student_id   -- ปิดคำขอของคนอื่นไม่ได้
     and r.status = 'accepted'
  returning r.* into v_request;

  if not found then
    return;
  end if;

  -- ตราพี่เลี้ยง 🤝 นับจากจำนวนครั้งที่ช่วยจริง (ไม่ใช่ดาว ไม่เอาไปเทียบกับเพื่อน)
  update public.students
     set buddy_helped_count = buddy_helped_count + 1
   where id = v_request.helper_id;

  return next v_request;
end;
$$;

/** คำขอที่ไม่มีใครตอบใน 60 วินาที — ปล่อยให้หมดอายุแล้วไปหาคนถัดไป (เรียกจาก worker หรือหน้าครู) */
create or replace function public.expire_buddy_offers()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.buddy_offers o
       set status = 'expired', responded_at = now()
     where o.status = 'pending' and o.expires_at <= now()
    returning o.request_id
  )
  update public.buddy_requests r
     set status = case when r.attempts >= 3 then 'no-helper' else 'searching' end,
         resolved_at = case when r.attempts >= 3 then now() else null end
   where r.id in (select request_id from expired)
     and r.status = 'pending';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ────────────────────────────────── T-10 / T-11 ข้อมูลสำหรับรายงาน
-- ตรวจเจ้าของห้องใน CTE แรกเสมอ ไม่ใช่เจ้าของ = คืน null (ห้ามรั่วข้ามห้องเด็ดขาด)

/** รายงานรายคน (T-10) */
create or replace function public.student_report(
  p_teacher_id uuid,
  p_student_id uuid
)
returns jsonb
language sql
stable
as $$
  with owned as (
    select st.id, st.classroom_id, st.nickname, st.created_at
    from public.students st
    join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.teacher_id = p_teacher_id
  )
  select case when not exists (select 1 from owned) then null else jsonb_build_object(
    'student', (select jsonb_build_object(
        'id', o.id, 'nickname', o.nickname, 'classroomId', o.classroom_id, 'joinedAt', o.created_at
      ) from owned o),
    'profile', (select to_jsonb(p) - 'readiness' from public.profiles p join owned o on o.id = p.student_id),
    'tests', (select jsonb_build_object(
        'pre',  p.pre_test_score,
        'post', p.post_test_score,
        'gain', case when p.pre_test_score is not null and p.post_test_score is not null
                     then p.post_test_score - p.pre_test_score end
      ) from public.profiles p join owned o on o.id = p.student_id),
    'stars', (select jsonb_build_object(
        'earned', p.earned_stars, 'goalStars', p.goal_stars, 'goalLevel', p.self_goal_level
      ) from public.profiles p join owned o on o.id = p.student_id),
    'missions', (select coalesce(jsonb_agg(jsonb_build_object(
        'missionId',   mp.mission_id,
        'channelUsed', mp.channel_used,
        'attempts',    mp.attempts,
        'hintsUsed',   mp.hints_used,
        'stars',       mp.stars,
        'passedAt',    mp.passed_at,
        'startedAt',   mp.started_at,
        'secondsSpent', case when mp.started_at is not null
                             then greatest(0, extract(epoch from coalesce(mp.passed_at, mp.updated_at) - mp.started_at))::integer
                        end
      ) order by mp.mission_id), '[]'::jsonb)
      from public.mission_progress mp join owned o on o.id = mp.student_id),
    'skips', (select coalesce(jsonb_agg(jsonb_build_object(
        'missionId', sk.mission_id, 'reason', sk.reason, 'skippedAt', sk.skipped_at
      ) order by sk.skipped_at), '[]'::jsonb)
      from public.mission_skips sk join owned o on o.id = sk.student_id),
    'routeChanges', (select jsonb_build_object(
        'count', count(*),
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'missionId', rc.mission_id, 'from', rc.from_route, 'to', rc.to_route,
          'changedBy', rc.changed_by, 'changedAt', rc.changed_at
        ) order by rc.changed_at), '[]'::jsonb)
      ) from public.route_changes rc join owned o on o.id = rc.student_id),
    'boss', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'domainName', s.domain_name, 'tld', s.tld, 'format', s.format,
        'selfScores', s.self_scores, 'aiScores', s.ai_scores,
        'teacherScores', s.teacher_confirmed_scores, 'teacherChanged', s.teacher_changed,
        'needsReview', s.needs_review, 'confirmedAt', s.confirmed_at, 'createdAt', s.created_at
      ) order by s.created_at), '[]'::jsonb)
      from public.submissions s join owned o on o.id = s.student_id),
    'reflections', (select coalesce(jsonb_agg(jsonb_build_object(
        'questionId', rf.question_id, 'answer', rf.answer_text, 'createdAt', rf.created_at
      ) order by rf.created_at), '[]'::jsonb)
      from public.reflections rf join owned o on o.id = rf.student_id),
    'peerFeedback', (select jsonb_build_object(
        'given',    (select count(*) from public.peer_feedback pf join owned o on o.id = pf.from_student_id),
        'received', (select count(*) from public.peer_feedback pf join owned o on o.id = pf.to_student_id)
      )),
    'buddy', (select jsonb_build_object(
        'helpedOthers', (select count(*) from public.buddy_requests br join owned o on o.id = br.helper_id where br.status = 'done'),
        'askedForHelp', (select count(*) from public.buddy_requests br join owned o on o.id = br.requester_id),
        'passedAfterHelp', (select count(*) from public.buddy_requests br join owned o on o.id = br.requester_id
                            where br.requester_passed_after)
      )),
    'confidence', (select p.confidence from public.profiles p join owned o on o.id = p.student_id)
  ) end;
$$;

/** รายงานรายห้อง (T-11) — ตัวเลขรวมของห้อง ไม่มีใครถูกจัดอันดับ */
create or replace function public.classroom_report(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns jsonb
language sql
stable
as $$
  with owned as (
    select c.id from public.classrooms c
    where c.id = p_classroom_id and c.teacher_id = p_teacher_id
  ),
  roster as (
    select st.id from public.students st join owned o on o.id = st.classroom_id
  )
  select case when not exists (select 1 from owned) then null else jsonb_build_object(
    'classroomId', p_classroom_id,
    'students', (select count(*) from roster),
    'tests', (select jsonb_build_object(
        'preMean',  round(avg(p.pre_test_score)::numeric, 2),
        'preSd',    round(coalesce(stddev_samp(p.pre_test_score), 0)::numeric, 2),
        'postMean', round(avg(p.post_test_score)::numeric, 2),
        'postSd',   round(coalesce(stddev_samp(p.post_test_score), 0)::numeric, 2),
        'gainMean', round(avg(p.post_test_score - p.pre_test_score)::numeric, 2),
        'preCount',  count(p.pre_test_score),
        'postCount', count(p.post_test_score)
      ) from public.profiles p join roster r on r.id = p.student_id),
    'stars', (select jsonb_build_object(
        'mean', round(avg(p.earned_stars)::numeric, 2),
        'max',  max(p.earned_stars),
        'metGoal', count(*) filter (where p.goal_stars is not null and p.earned_stars >= p.goal_stars)
      ) from public.profiles p join roster r on r.id = p.student_id),
    'routes', (select coalesce(jsonb_object_agg(route, n), '{}'::jsonb) from (
        select coalesce(p.learning_route, 'ไม่ระบุ') as route, count(*) as n
        from public.profiles p join roster r on r.id = p.student_id
        group by 1
      ) t),
    'routeSuggestedVsChosen', (select jsonb_build_object(
        'followedSuggestion', count(*) filter (where p.channel_suggested = p.learning_route),
        'choseDifferent',     count(*) filter (where p.channel_suggested is not null
                                                 and p.learning_route is not null
                                                 and p.channel_suggested <> p.learning_route)
      ) from public.profiles p join roster r on r.id = p.student_id),
    'routeChanges', (select jsonb_build_object(
        'total',    count(*),
        'students', count(distinct rc.student_id)
      ) from public.route_changes rc join roster r on r.id = rc.student_id),
    'missions', (select coalesce(jsonb_object_agg(mission_id, stats), '{}'::jsonb) from (
        select mp.mission_id,
               jsonb_build_object(
                 'played',        count(*),
                 'passed',        count(*) filter (where mp.passed_at is not null),
                 'attemptsMean',  round(avg(mp.attempts)::numeric, 2),
                 'hintsMean',     round(avg(mp.hints_used)::numeric, 2),
                 'starsMean',     round(avg(mp.stars)::numeric, 2),
                 'secondsMean',   round(avg(case when mp.started_at is not null
                                                 then extract(epoch from coalesce(mp.passed_at, mp.updated_at) - mp.started_at)
                                            end)::numeric, 0)
               ) as stats
        from public.mission_progress mp join roster r on r.id = mp.student_id
        group by mp.mission_id
      ) t),
    'skips', (select coalesce(jsonb_object_agg(mission_id, n), '{}'::jsonb) from (
        select sk.mission_id, count(*) as n
        from public.mission_skips sk join roster r on r.id = sk.student_id
        group by sk.mission_id
      ) t),
    'boss', (select jsonb_build_object(
        'submitted',      count(*),
        'confirmed',      count(*) filter (where s.teacher_confirmed_scores is not null),
        'awaitingReview', count(*) filter (where s.needs_review),
        'teacherChanged', count(*) filter (where s.teacher_changed)
      ) from public.submissions s join roster r on r.id = s.student_id),
    'buddy', (select jsonb_build_object(
        'requests',  count(*),
        'helped',    count(*) filter (where br.status = 'done'),
        'noHelper',  count(*) filter (where br.status = 'no-helper'),
        'passedAfterHelp', count(*) filter (where br.requester_passed_after)
      ) from public.buddy_requests br where br.classroom_id = p_classroom_id),
    'reflections', (select count(distinct rf.student_id)
      from public.reflections rf join roster r on r.id = rf.student_id),
    'survey', public.survey_summary(p_teacher_id, p_classroom_id)
  ) end;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์
-- anon ต้องเข้าไม่ได้ทุกตารางและทุกฟังก์ชัน (นักเรียนเขียนผ่าน service_role ใน API route เท่านั้น)

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.ensure_class_session(uuid, uuid)                          from anon, public;
revoke execute on function public.set_session_phase(uuid, uuid, text, integer)              from anon, public;
revoke execute on function public.revert_session_phase(uuid, uuid, integer)                 from anon, public;
revoke execute on function public.set_session_timer(uuid, uuid, integer)                    from anon, public;
revoke execute on function public.extend_session_timer(uuid, uuid, integer)                 from anon, public;
revoke execute on function public.pause_session_timer(uuid, uuid, boolean)                  from anon, public;
revoke execute on function public.set_focus_screen(uuid, uuid, boolean)                     from anon, public;
revoke execute on function public.update_session_settings(uuid, uuid, boolean, boolean, boolean, timestamptz) from anon, public;
revoke execute on function public.close_class_session(uuid, uuid)                           from anon, public;
revoke execute on function public.unlock_student_phase(uuid, uuid, text, text)              from anon, public;
revoke execute on function public.revoke_student_phase_unlock(uuid, uuid, text)             from anon, public;
revoke execute on function public.touch_student_presence(uuid, text)                        from anon, public;
revoke execute on function public.submit_survey_response(uuid, jsonb, text, text, text, text) from anon, public;
revoke execute on function public.survey_summary(uuid, uuid)                                from anon, public;
revoke execute on function public.find_buddy_candidates(uuid, text, integer)                from anon, public;
revoke execute on function public.create_buddy_request(uuid, text, text)                    from anon, public;
revoke execute on function public.offer_buddy_request(uuid, uuid, integer, integer)         from anon, public;
revoke execute on function public.respond_buddy_offer(uuid, uuid, boolean)                  from anon, public;
revoke execute on function public.complete_buddy_request(uuid, uuid, text, boolean)         from anon, public;
revoke execute on function public.expire_buddy_offers()                                     from anon, public;
revoke execute on function public.student_report(uuid, uuid)                                from anon, public;
revoke execute on function public.classroom_report(uuid, uuid)                              from anon, public;

grant execute on function public.ensure_class_session(uuid, uuid)                          to service_role;
grant execute on function public.set_session_phase(uuid, uuid, text, integer)              to service_role;
grant execute on function public.revert_session_phase(uuid, uuid, integer)                 to service_role;
grant execute on function public.set_session_timer(uuid, uuid, integer)                    to service_role;
grant execute on function public.extend_session_timer(uuid, uuid, integer)                 to service_role;
grant execute on function public.pause_session_timer(uuid, uuid, boolean)                  to service_role;
grant execute on function public.set_focus_screen(uuid, uuid, boolean)                     to service_role;
grant execute on function public.update_session_settings(uuid, uuid, boolean, boolean, boolean, timestamptz) to service_role;
grant execute on function public.close_class_session(uuid, uuid)                           to service_role;
grant execute on function public.unlock_student_phase(uuid, uuid, text, text)              to service_role;
grant execute on function public.revoke_student_phase_unlock(uuid, uuid, text)             to service_role;
grant execute on function public.touch_student_presence(uuid, text)                        to service_role;
grant execute on function public.submit_survey_response(uuid, jsonb, text, text, text, text) to service_role;
grant execute on function public.survey_summary(uuid, uuid)                                to service_role;
grant execute on function public.find_buddy_candidates(uuid, text, integer)                to service_role;
grant execute on function public.create_buddy_request(uuid, text, text)                    to service_role;
grant execute on function public.offer_buddy_request(uuid, uuid, integer, integer)         to service_role;
grant execute on function public.respond_buddy_offer(uuid, uuid, boolean)                  to service_role;
grant execute on function public.complete_buddy_request(uuid, uuid, text, boolean)         to service_role;
grant execute on function public.expire_buddy_offers()                                     to service_role;
grant execute on function public.student_report(uuid, uuid)                                to service_role;
grant execute on function public.classroom_report(uuid, uuid)                              to service_role;
