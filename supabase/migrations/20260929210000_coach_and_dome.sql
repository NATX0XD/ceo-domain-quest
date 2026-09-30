-- รอบ 4: ความมั่นใจรายวัตถุประสงค์ · ข้ามภารกิจได้แต่ต้องมีร่องรอย · แชทกับโดม · อัดเสียงด่านบอส
--
-- เกณฑ์ธงครู (60/90/150 วินาที) อยู่ที่ content/coach-thresholds.json เท่านั้น
-- ห้ามฝังตัวเลขเหล่านั้นใน SQL ที่นี่ ชั้น DB มีหน้าที่ส่งข้อมูลดิบให้ core/personalize.ts ตัดสิน

-- ---------------------------------------- 1) confidence: smallint -> jsonb รายวัตถุประสงค์

-- ของเดิมเป็นเลขรวมก้อนเดียว ย้ายไปไว้ใต้คีย์ "overall" ไม่ทิ้งข้อมูลที่เก็บมาแล้ว
alter table public.profiles
  alter column confidence type jsonb
  using (
    case
      when confidence is null then '{}'::jsonb
      else jsonb_build_object('overall', confidence)
    end
  );

alter table public.profiles
  alter column confidence set default '{}'::jsonb;

update public.profiles set confidence = '{}'::jsonb where confidence is null;

alter table public.profiles
  alter column confidence set not null,
  add column hints_toggled_by text;          -- student = เด็กปิด/เปิดเอง · system = ระบบปรับให้

alter table public.profiles
  add constraint profiles_hints_toggled_by_check
    check (hints_toggled_by in ('student', 'system'));

comment on column public.profiles.confidence is
  'ความมั่นใจรายวัตถุประสงค์ {"obj-1":3,...} · ค่าเดิมก่อนรอบ 4 อยู่ใต้คีย์ overall';

-- ------------------------------------------------------------------ 2) mission_skips
-- mockup มีปุ่ม "ข้ามภารกิจนี้" และตัดสินใจแล้วว่าให้ข้ามได้จริง (ผู้เรียนเป็นเจ้าของการเรียนรู้)
-- แต่ต้องบันทึกไว้ทุกครั้งว่าใครข้ามอะไรตอนไหน ครูจะได้ตามได้ ไม่ใช่ข้ามแล้วหายไปเฉย ๆ

create table public.mission_skips (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  mission_id text        not null check (mission_id in ('m1', 'm2', 'm3', 'm4', 'boss')),
  reason     text,                              -- เหตุผลที่เด็กเลือก/พิมพ์เอง (ว่างได้)
  skipped_at timestamptz not null default now()
);

create index mission_skips_student_idx on public.mission_skips (student_id, skipped_at desc);

-- ------------------------------------------------------------------ 3) chat_messages
-- ตัวละคร "โดม" คุยกับนักเรียนเป็นหน้าแรก เก็บบทสนทนาไว้เป็นหลักฐานการเรียนรู้
-- source บอกว่าข้อความมาจาก AI จริง จากกฎสำรอง หรือเป็นบทที่เขียนไว้ล่วงหน้า

create table public.chat_messages (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  role       text        not null check (role in ('dome', 'student')),
  text       text        not null,
  source     text        not null default 'scripted' check (source in ('ai', 'fallback', 'scripted')),
  created_at timestamptz not null default now()
);

create index chat_messages_student_idx on public.chat_messages (student_id, created_at);

-- -------------------------------------------------------------- 4) voice_submissions
-- ด่านบอส = อัดเสียงนำเสนอ 2 นาที เก็บ path ของไฟล์ ไม่เก็บตัวไฟล์ลงตาราง

create table public.voice_submissions (
  id              uuid        primary key default gen_random_uuid(),
  student_id      uuid        not null references public.students (id) on delete cascade,
  duration_sec    integer     not null default 0 check (duration_sec >= 0 and duration_sec <= 600),
  transcript_text text,
  storage_path    text,
  created_at      timestamptz not null default now()
);

create index voice_submissions_student_idx on public.voice_submissions (student_id, created_at desc);

-- --------------------------------------------------------------------------- RLS

alter table public.mission_skips      enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.voice_submissions  enable row level security;

create policy mission_skips_owner on public.mission_skips
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy chat_messages_owner on public.chat_messages
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy voice_submissions_owner on public.voice_submissions
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- ------------------------------------------------------------------------ grants

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
