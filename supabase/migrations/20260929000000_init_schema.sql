-- digital-biz-quest — โครงตารางตาม docs/auth-and-roles.md ข้อ 7
-- ครู = Supabase Auth (auth.users). นักเรียน = ไม่มีบัญชี Supabase
-- การเขียนของนักเรียนทำผ่าน service_role ใน API route ฝั่งเซิร์ฟเวอร์เท่านั้น

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.teachers (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text        not null unique,
  name       text,
  created_at timestamptz not null default now()
);

create table public.classrooms (
  id         uuid        primary key default gen_random_uuid(),
  teacher_id uuid        not null references public.teachers (id) on delete cascade,
  room_code  char(6)     not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  status     text        not null default 'open' check (status in ('open', 'locked', 'closed')),
  opens_at   timestamptz not null default now(),
  closes_at  timestamptz,
  created_at timestamptz not null default now()
);

create index classrooms_teacher_id_idx on public.classrooms (teacher_id);

create table public.students (
  id           uuid        primary key default gen_random_uuid(),
  classroom_id uuid        not null references public.classrooms (id) on delete cascade,
  nickname     text        not null check (length(btrim(nickname)) between 1 and 40),
  pin_hash     text        not null,            -- argon2 เท่านั้น ห้ามเก็บ PIN ดิบ
  device_token text,
  created_at   timestamptz not null default now(),
  unique (classroom_id, nickname)
);

create index students_classroom_id_idx on public.students (classroom_id);

create table public.profiles (
  student_id      uuid primary key references public.students (id) on delete cascade,
  business_name   text,
  business_type   text,
  confidence      smallint,                     -- Likert ความมั่นใจของนักเรียน
  pre_test_score  smallint,
  post_test_score smallint,
  scaffold_level  smallint    not null default 1 check (scaffold_level between 1 and 3),
  updated_at      timestamptz not null default now()
);

create table public.progress (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students (id) on delete cascade,
  station      text        not null check (station in ('A', 'B', 'C')),
  status       text        not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'needs_help', 'completed')),
  attempts     integer     not null default 0 check (attempts >= 0),
  hints_used   integer     not null default 0 check (hints_used >= 0),
  started_at   timestamptz,
  completed_at timestamptz,
  unique (student_id, station)
);

create index progress_student_id_idx on public.progress (student_id);

create table public.submissions (
  id                       uuid        primary key default gen_random_uuid(),
  student_id               uuid        not null references public.students (id) on delete cascade,
  domain_name              text        not null,
  tld                      text        not null,
  reason_text              text,
  ai_scores                jsonb,                  -- AI เสนอ
  teacher_confirmed_scores jsonb,                  -- ครูยืนยัน = ค่าจริงเสมอ
  needs_review             boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index submissions_student_id_idx on public.submissions (student_id);
create index submissions_needs_review_idx on public.submissions (needs_review) where needs_review;

create table public.events (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  type       text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_student_created_idx on public.events (student_id, created_at desc);

-- ------------------------------------------------------- ownership helpers
-- security definer: ให้ policy เช็กความเป็นเจ้าของได้โดยไม่ต้องวิ่งผ่าน RLS ซ้อนชั้น

create or replace function public.is_classroom_owner(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.classrooms c
    where c.id = p_classroom_id
      and c.teacher_id = (select auth.uid())
  );
$$;

create or replace function public.owns_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.students s
    join public.classrooms c on c.id = s.classroom_id
    where s.id = p_student_id
      and c.teacher_id = (select auth.uid())
  );
$$;

-- --------------------------------------------------------------------- RLS

alter table public.teachers    enable row level security;
alter table public.classrooms  enable row level security;
alter table public.students    enable row level security;
alter table public.profiles    enable row level security;
alter table public.progress    enable row level security;
alter table public.submissions enable row level security;
alter table public.events      enable row level security;

-- ครูเห็น/แก้ได้เฉพาะแถวของตัวเองและของห้องตัวเอง
-- ไม่มี policy ให้ anon เลย = anon เข้าไม่ได้ทุกตาราง (ตั้งใจ ไม่ใช่บั๊ก)

create policy teachers_self on public.teachers
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy classrooms_owner on public.classrooms
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

create policy students_owner on public.students
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

create policy profiles_owner on public.profiles
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy progress_owner on public.progress
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy submissions_owner on public.submissions
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy events_owner on public.events
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- ------------------------------------------------------------------ grants
-- anon ต้องแตะอะไรไม่ได้เลย: เพิกถอน grant ตรง ๆ อีกชั้นนอกเหนือจาก RLS

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on function public.is_classroom_owner(uuid) from anon, public;
revoke execute on function public.owns_student(uuid)       from anon, public;
grant  execute on function public.is_classroom_owner(uuid) to authenticated, service_role;
grant  execute on function public.owns_student(uuid)       to authenticated, service_role;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
