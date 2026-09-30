-- รอบ 2: โครงรองรับ Personalized Learning (docs/personalized-learning-design.md ข้อ 4)
-- ไม่แก้ migration รอบแรก — เพิ่มอย่างเดียว
--
-- ชื่อช่องทาง: content/self-profile.json ใช้ 'minigame' แต่สเปกงานเขียน 'game'
-- CHECK จึงรับทั้งคู่ไว้ก่อน (canonical ที่แนะนำคือ 'minigame' ตามไฟล์เนื้อหาจริง)

-- --------------------------------------------------------- profiles เพิ่มคอลัมน์

alter table public.profiles
  add column learning_route     text,      -- ช่องทางที่ "ใช้อยู่ล่าสุด" (= channel ในเอกสาร ข้อ 4)
  add column channel_chosen_by  text,      -- system = ระบบแนะนำ, student = เด็กเลือกเอง
  add column channel_switches   integer     not null default 0,
  add column talent_id          text,
  add column goal_id            text,
  add column goal_stars         smallint,
  add column goal_raised_count  integer     not null default 0,
  add column goal_raised_at     timestamptz,             -- หลักฐานตอนนำเสนอว่าเด็กยกเป้าเอง
  add column self_goal_level    smallint,                -- เป้าที่นักเรียนตั้งเอง 1-3
  add column readiness          jsonb       not null default '{}'::jsonb,
  add column level_by_objective jsonb       not null default '{}'::jsonb,
  add column earned_stars       smallint    not null default 0;

alter table public.profiles
  add constraint profiles_learning_route_check
    check (learning_route in ('clip', 'card', 'minigame', 'game', 'buddy')),
  add constraint profiles_channel_chosen_by_check
    check (channel_chosen_by in ('system', 'student')),
  add constraint profiles_channel_switches_check check (channel_switches >= 0),
  add constraint profiles_goal_stars_check check (goal_stars >= 0),
  add constraint profiles_goal_raised_count_check check (goal_raised_count >= 0),
  add constraint profiles_self_goal_level_check check (self_goal_level between 1 and 3),
  add constraint profiles_earned_stars_check check (earned_stars >= 0);

-- ------------------------------------------------------------------ route_changes
-- หลักฐานชิ้นสำคัญที่สุดว่าเป็น personalized learning จริง:
-- บันทึกทุกครั้งที่ช่องทางการเรียนรู้เปลี่ยน รวมครั้งแรกที่ระบบแนะนำ (from_route = null)

create table public.route_changes (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  mission_id text,                                   -- ภารกิจที่กำลังทำตอนสลับ (null = นอกภารกิจ)
  from_route text        check (from_route in ('clip', 'card', 'minigame', 'game', 'buddy')),
  to_route   text        not null check (to_route in ('clip', 'card', 'minigame', 'game', 'buddy')),
  changed_by text        not null default 'student' check (changed_by in ('system', 'student')),
  changed_at timestamptz not null default now()
);

create index route_changes_student_idx on public.route_changes (student_id, changed_at desc);

-- -------------------------------------------------------------------- reflections

create table public.reflections (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references public.students (id) on delete cascade,
  question_id text        not null,
  answer_text text        not null default '',
  created_at  timestamptz not null default now(),
  unique (student_id, question_id)                   -- ตอบใหม่ = ทับคำตอบเดิม
);

create index reflections_student_idx on public.reflections (student_id);

-- --------------------------------------------------------------- mission_progress
-- ภารกิจย่อย 4 ภารกิจของเส้นทางใหม่ (ceo.jpg) — ตาราง progress เดิม (station A/B/C) ยังใช้ต่อ

create table public.mission_progress (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students (id) on delete cascade,
  mission_id   text        not null check (mission_id in ('m1', 'm2', 'm3', 'm4')),
  channel_used text        check (channel_used in ('clip', 'card', 'minigame', 'game', 'buddy')),
  attempts     integer     not null default 0 check (attempts >= 0),
  hints_used   integer     not null default 0 check (hints_used >= 0),
  stars        smallint    not null default 0 check (stars >= 0),
  passed_at    timestamptz,
  updated_at   timestamptz not null default now(),
  unique (student_id, mission_id)
);

create index mission_progress_student_idx on public.mission_progress (student_id);

-- ------------------------------------------------------------------ peer_feedback

create table public.peer_feedback (
  id              uuid        primary key default gen_random_uuid(),
  from_student_id uuid        not null references public.students (id) on delete cascade,
  to_student_id   uuid        not null references public.students (id) on delete cascade,
  praise_text     text        not null default '',
  suggest_text    text        not null default '',
  created_at      timestamptz not null default now(),
  check (from_student_id <> to_student_id)
);

create index peer_feedback_to_idx   on public.peer_feedback (to_student_id, created_at desc);
create index peer_feedback_from_idx on public.peer_feedback (from_student_id);

-- --------------------------------------------------------------------------- RLS

alter table public.route_changes    enable row level security;
alter table public.reflections      enable row level security;
alter table public.mission_progress enable row level security;
alter table public.peer_feedback    enable row level security;

create policy route_changes_owner on public.route_changes
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy reflections_owner on public.reflections
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy mission_progress_owner on public.mission_progress
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- ครูเห็นได้ถ้าเป็นเจ้าของห้องของฝั่งใดฝั่งหนึ่ง แต่เขียนได้ต่อเมื่อเป็นเจ้าของทั้งสองฝั่ง
create policy peer_feedback_owner on public.peer_feedback
  for all to authenticated
  using (public.owns_student(from_student_id) or public.owns_student(to_student_id))
  with check (public.owns_student(from_student_id) and public.owns_student(to_student_id));

-- ------------------------------------------------- ฟังก์ชันที่ตรวจเจ้าของใน query เดียว
-- service_role ข้าม RLS ทั้งหมด ฟังก์ชันเหล่านี้จึงเป็นด่านตรวจสิทธิ์ของชั้นเซิร์ฟเวอร์
-- คืน 0 แถว = ไม่ใช่เจ้าของ หรือไม่มีแถวนั้น

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
         needs_review = false,
         updated_at = now()
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

-- สลับช่องทาง: อัปเดต profiles + เขียน route_changes ในทรานแซกชันเดียว
create or replace function public.switch_learning_route(
  p_student_id uuid,
  p_to_route   text,
  p_mission_id text default null,
  p_chosen_by  text default 'student'
)
returns setof public.route_changes
language plpgsql
as $$
declare
  v_from text;
  v_has_profile boolean;
begin
  select p.learning_route, true
    into v_from, v_has_profile
    from public.profiles p
   where p.student_id = p_student_id
     for update;

  insert into public.profiles (student_id, learning_route, channel_chosen_by, updated_at)
  values (p_student_id, p_to_route, p_chosen_by, now())
  on conflict (student_id) do update
    set learning_route     = excluded.learning_route,
        channel_chosen_by  = excluded.channel_chosen_by,
        channel_switches   = profiles.channel_switches
                             + case
                                 when p_chosen_by = 'student'
                                  and profiles.learning_route is not null
                                  and profiles.learning_route <> excluded.learning_route
                                 then 1 else 0
                               end,
        updated_at         = now();

  return query
    insert into public.route_changes (student_id, mission_id, from_route, to_route, changed_by)
    values (p_student_id, p_mission_id, case when v_has_profile then v_from else null end, p_to_route, p_chosen_by)
    returning *;
end;
$$;

-- ตั้งเป้าหมายเอง: ยกขึ้นได้อย่างเดียวระหว่างคาบ (content/self-profile.json goalPolicy)
create or replace function public.set_self_goal(
  p_student_id      uuid,
  p_goal_id         text,
  p_goal_stars      smallint,
  p_self_goal_level smallint
)
returns setof public.profiles
language plpgsql
as $$
declare
  v_old_stars smallint;
begin
  select p.goal_stars into v_old_stars
    from public.profiles p
   where p.student_id = p_student_id
     for update;

  if v_old_stars is not null and p_goal_stars < v_old_stars then
    raise exception 'ห้ามลดเป้าหมายระหว่างคาบ (เดิม % ดาว ขอใหม่ % ดาว)', v_old_stars, p_goal_stars
      using errcode = 'check_violation';
  end if;

  return query
    insert into public.profiles (student_id, goal_id, goal_stars, self_goal_level, updated_at)
    values (p_student_id, p_goal_id, p_goal_stars, p_self_goal_level, now())
    on conflict (student_id) do update
      set goal_id           = excluded.goal_id,
          goal_stars        = excluded.goal_stars,
          self_goal_level   = excluded.self_goal_level,
          goal_raised_count = profiles.goal_raised_count
                              + case when profiles.goal_stars is not null
                                      and excluded.goal_stars > profiles.goal_stars
                                     then 1 else 0 end,
          goal_raised_at    = case when profiles.goal_stars is not null
                                    and excluded.goal_stars > profiles.goal_stars
                                   then now() else profiles.goal_raised_at end,
          updated_at        = now()
    returning *;
end;
$$;

-- เพื่อนชมเพื่อน: เขียนได้เฉพาะเมื่อทั้งสองคนอยู่ห้องเดียวกัน (ตรวจใน statement เดียว)
create or replace function public.add_peer_feedback(
  p_from_student_id uuid,
  p_to_student_id   uuid,
  p_praise_text     text,
  p_suggest_text    text
)
returns setof public.peer_feedback
language sql
as $$
  insert into public.peer_feedback (from_student_id, to_student_id, praise_text, suggest_text)
  select p_from_student_id, p_to_student_id, coalesce(p_praise_text, ''), coalesce(p_suggest_text, '')
  where exists (
    select 1
    from public.students a
    join public.students b on b.classroom_id = a.classroom_id
    where a.id = p_from_student_id
      and b.id = p_to_student_id
      and a.id <> b.id
  )
  returning *;
$$;

-- ------------------------------------------------------------------------ grants
-- ตารางและฟังก์ชันชุดนี้เพิ่งสร้าง จึงต้องเพิกถอน anon ซ้ำอีกรอบ

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.confirm_submission_scores(uuid, uuid, jsonb) from anon, public;
revoke execute on function public.switch_learning_route(uuid, text, text, text) from anon, public;
revoke execute on function public.set_self_goal(uuid, text, smallint, smallint) from anon, public;
revoke execute on function public.add_peer_feedback(uuid, uuid, text, text)     from anon, public;

grant execute on function public.confirm_submission_scores(uuid, uuid, jsonb) to service_role;
grant execute on function public.switch_learning_route(uuid, text, text, text) to service_role;
grant execute on function public.set_self_goal(uuid, text, smallint, smallint) to service_role;
grant execute on function public.add_peer_feedback(uuid, uuid, text, text)     to service_role;
