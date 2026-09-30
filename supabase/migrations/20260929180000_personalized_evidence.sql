-- รอบ 3: เก็บ "ระบบเสนออะไร vs นักเรียนเลือกอะไร" + ให้นักเรียนเลือกรูปแบบส่งงานเอง
--
-- คู่คอลัมน์ channel_suggested/learning_route และ level_suggested/scaffold_level คือหลักฐานชิ้นเดียว
-- ที่พิสูจน์ว่าเป็น personalized (นักเรียนมีสิทธิ์เลือก) ไม่ใช่ adaptive ล้วน (ระบบสั่งอย่างเดียว)
-- ห้ามลบคอลัมน์ฝั่ง suggested ทิ้งเด็ดขาด ไม่งั้นเทียบไม่ได้

-- ------------------------------------------------- 1) ล้างค่า minigame ให้เป็น game ก่อน
-- canonical คือ 'game' (content/missions.json ใช้ channels.game และหน้าเว็บสร้างตามนั้นแล้ว)

update public.profiles         set learning_route     = 'game' where learning_route = 'minigame';
update public.route_changes    set from_route         = 'game' where from_route = 'minigame';
update public.route_changes    set to_route           = 'game' where to_route = 'minigame';
update public.mission_progress set channel_used       = 'game' where channel_used = 'minigame';

-- ------------------------------------------------------- 2) profiles คอลัมน์หลักฐาน

alter table public.profiles
  add column channel_suggested            text,      -- ระบบแนะนำช่องทางไหน (ก่อนเด็กเลือก)
  add column level_suggested              smallint,  -- ระบบแนะนำระดับตัวช่วยเท่าไร
  add column level_overridden_by_student  jsonb not null default '[]'::jsonb,
                                                     -- [{"from":2,"to":3,"at":"...","missionId":"m2"}]
  add column own_goal_text                text;      -- เป้าหมายที่นักเรียนพิมพ์เอง

-- ---------------------------------------------- 3) บีบช่องทางให้เหลือ clip|card|game|buddy

alter table public.profiles         drop constraint if exists profiles_learning_route_check;
alter table public.route_changes    drop constraint if exists route_changes_from_route_check;
alter table public.route_changes    drop constraint if exists route_changes_to_route_check;
alter table public.mission_progress drop constraint if exists mission_progress_channel_used_check;

alter table public.profiles
  add constraint profiles_learning_route_check
    check (learning_route in ('clip', 'card', 'game', 'buddy')),
  add constraint profiles_channel_suggested_check
    check (channel_suggested in ('clip', 'card', 'game', 'buddy')),
  add constraint profiles_level_suggested_check
    check (level_suggested between 1 and 3);

alter table public.route_changes
  add constraint route_changes_from_route_check
    check (from_route in ('clip', 'card', 'game', 'buddy')),
  add constraint route_changes_to_route_check
    check (to_route in ('clip', 'card', 'game', 'buddy'));

alter table public.mission_progress
  add constraint mission_progress_channel_used_check
    check (channel_used in ('clip', 'card', 'game', 'buddy'));

-- --------------------------------------------------- 4) ดาว: เพดาน 15 และเกณฑ์เป้าหมาย
-- 15 = ภารกิจย่อย 4 ภารกิจ x 3 ดาว + ภารกิจใหญ่ 3 ดาว
-- เป้าหมายของนักเรียน: ระดับ 1 = 6 ดาว · ระดับ 2 = 10 ดาว · ระดับ 3 = 14 ดาว

alter table public.mission_progress drop constraint if exists mission_progress_stars_check;
alter table public.mission_progress
  add constraint mission_progress_stars_check check (stars between 0 and 3);

alter table public.profiles drop constraint if exists profiles_goal_stars_check;
alter table public.profiles drop constraint if exists profiles_earned_stars_check;
alter table public.profiles
  add constraint profiles_goal_stars_check check (goal_stars between 0 and 15),
  add constraint profiles_earned_stars_check check (earned_stars between 0 and 15),
  add constraint profiles_self_goal_threshold_check check (
    self_goal_level is null
    or goal_stars is null
    or (self_goal_level = 1 and goal_stars = 6)
    or (self_goal_level = 2 and goal_stars = 10)
    or (self_goal_level = 3 and goal_stars = 14)
  );

-- --------------------------------------- 5) submissions: นักเรียนเลือกรูปแบบส่งงาน/ถ่วงเกณฑ์

alter table public.submissions
  add column format                 text     not null default 'write',
  add column emphasis_criterion     text,               -- ด้านที่ขอให้ถ่วงน้ำหนัก 2 เท่า
  add column emphasis_changed_count integer  not null default 0,
  add column self_scores            jsonb;              -- คะแนนที่นักเรียนให้ตัวเอง

alter table public.submissions
  add constraint submissions_format_check check (format in ('write', 'voice', 'design')),
  add constraint submissions_emphasis_changed_count_check check (emphasis_changed_count >= 0);

-- ------------------------------------------------------------------- 6) ฟังก์ชันใหม่
-- service_role ข้าม RLS ชั้นตรวจสิทธิ์อยู่ที่ lib/db/repo.ts เสมอ

-- บันทึกการเปลี่ยนช่องทางแบบระบุ from เองได้ (null = ใช้ค่าที่อยู่ใน profiles ตอนนั้น)
create or replace function public.record_route_change(
  p_student_id uuid,
  p_to_route   text,
  p_from_route text default null,
  p_mission_id text default null,
  p_changed_by text default 'student'
)
returns setof public.route_changes
language plpgsql
as $$
declare
  v_current text;
  v_from    text;
begin
  select p.learning_route into v_current
    from public.profiles p
   where p.student_id = p_student_id
     for update;

  v_from := coalesce(p_from_route, v_current);

  insert into public.profiles (student_id, learning_route, channel_chosen_by, updated_at)
  values (p_student_id, p_to_route, p_changed_by, now())
  on conflict (student_id) do update
    set learning_route    = excluded.learning_route,
        channel_chosen_by = excluded.channel_chosen_by,
        channel_switches  = profiles.channel_switches
                            + case
                                when p_changed_by = 'student'
                                 and profiles.learning_route is not null
                                 and profiles.learning_route <> excluded.learning_route
                                then 1 else 0
                              end,
        updated_at        = now();

  return query
    insert into public.route_changes (student_id, mission_id, from_route, to_route, changed_by)
    values (p_student_id, p_mission_id, v_from, p_to_route, p_changed_by)
    returning *;
end;
$$;

-- นับความพยายามของภารกิจย่อยแบบ atomic (กันสองแท็บกดพร้อมกันแล้วนับหาย)
create or replace function public.record_mission_attempt(
  p_student_id uuid,
  p_mission_id text,
  p_correct    boolean,
  p_hint_level smallint default 0,
  p_channel    text default null
)
returns setof public.mission_progress
language sql
as $$
  insert into public.mission_progress (
    student_id, mission_id, channel_used, attempts, hints_used, passed_at, updated_at
  )
  values (
    p_student_id,
    p_mission_id,
    p_channel,
    1,
    case when p_hint_level > 0 then 1 else 0 end,
    case when p_correct then now() else null end,
    now()
  )
  on conflict (student_id, mission_id) do update
    set attempts     = mission_progress.attempts + 1,
        hints_used   = mission_progress.hints_used + case when p_hint_level > 0 then 1 else 0 end,
        channel_used = coalesce(p_channel, mission_progress.channel_used),
        passed_at    = case
                         when p_correct then coalesce(mission_progress.passed_at, now())
                         else mission_progress.passed_at
                       end,
        updated_at   = now()
  returning *;
$$;

-- บันทึกว่านักเรียนเปลี่ยนระดับตัวช่วยเองจากอะไรเป็นอะไร (ต่อท้าย array ไม่ทับของเดิม)
create or replace function public.record_level_override(
  p_student_id uuid,
  p_to_level   smallint,
  p_mission_id text default null
)
returns setof public.profiles
language sql
as $$
  update public.profiles
     set level_overridden_by_student = level_overridden_by_student || jsonb_build_object(
           'from', scaffold_level,
           'to', p_to_level,
           'missionId', p_mission_id,
           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
         ),
         scaffold_level = p_to_level,
         updated_at = now()
   where student_id = p_student_id
  returning *;
$$;

-- ------------------------------------------------------------------------ grants

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.record_route_change(uuid, text, text, text, text)        from anon, public;
revoke execute on function public.record_mission_attempt(uuid, text, boolean, smallint, text) from anon, public;
revoke execute on function public.record_level_override(uuid, smallint, text)              from anon, public;

grant execute on function public.record_route_change(uuid, text, text, text, text)         to service_role;
grant execute on function public.record_mission_attempt(uuid, text, boolean, smallint, text) to service_role;
grant execute on function public.record_level_override(uuid, smallint, text)               to service_role;
