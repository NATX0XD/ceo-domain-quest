-- T49 — มติ master รอบ 30 ก.ย.
--
-- 1) content_flags.student_id ยอม null ได้
--    ธงใบแรกเกิดตอนเด็กพิมพ์ชื่อเล่นเข้าห้อง ซึ่งยัง "ไม่มีแถวนักเรียน" (app/api/join ตรวจแล้วปฏิเสธ
--    ก่อนสร้าง student) ผลคือธงใบนั้นบันทึกไม่ได้เลย ครูจึงไม่เคยเห็นว่ามีคนพยายามใช้ชื่อไม่เหมาะสม
--    classroom_id ยังบังคับมีเสมอ — ธงต้องรู้ว่าเป็นห้องไหน ไม่งั้นแผงครูอ่านไม่ได้
--
-- 2) mission_progress.skipped_by = student | teacher | null
--    รายงานต้องแยก "เด็กข้ามเองเพราะรู้แล้ว" ออกจาก "ครูสั่งข้าม" ไม่งั้น E1 สูงเกินจริง
--    เพราะการตัดสินใจของครูถูกนับเป็นผลการเรียนรู้ของเด็ก

-- ═══════════════════════════════════════════ 1) ธงก่อนเข้าห้อง

alter table public.content_flags
  alter column student_id drop not null;

/**
 * แถวที่ไม่มี student_id ต้องมาจากจังหวะพิมพ์ชื่อเล่นเข้าห้องเท่านั้น
 * กันไม่ให้ที่อื่นแอบบันทึกธงลอย ๆ ที่ไล่กลับไปหาเจ้าของไม่ได้
 */
alter table public.content_flags
  add constraint content_flags_pre_join_context_check
  check (student_id is not null or context = 'join-nickname');

comment on column public.content_flags.student_id is
  'null ได้เฉพาะธงตอนพิมพ์ชื่อเล่นเข้าห้อง (context = join-nickname) ซึ่งยังไม่มีแถวนักเรียน';

/**
 * บันทึกธงตอนพิมพ์ชื่อเล่น — ยังไม่มี studentId จึงรับ classroom_id ตรง ๆ
 *
 * แยกเป็นคนละฟังก์ชันกับ record_content_flag เพราะถ้าเติมพารามิเตอร์ที่ 7 เข้าไป
 * postgres จะได้ฟังก์ชันซ้อนสองตัวและการเรียกแบบ 6 อาร์กิวเมนต์จะกำกวมทันที
 *
 * context ถูกตรึงเป็น 'join-nickname' ในตัวฟังก์ชัน ผู้เรียกกำหนดเองไม่ได้
 * คืน 0 แถวถ้าส่ง classroom_id มั่ว — ไม่สร้างธงที่ไม่มีห้องรองรับ
 */
create or replace function public.record_pre_join_content_flag(
  p_classroom_id  uuid,
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
  select null, c.id, 'join-nickname', p_level,
         coalesce(p_categories, '{}'), p_masked_text, coalesce(p_original_text, '')
  from public.classrooms c
  where c.id = p_classroom_id
  returning *;
$$;

/**
 * เหมือนเดิมทุกอย่าง ยกเว้น join students เป็น left join
 * (inner join เดิมจะทำให้ธงก่อนเข้าห้องหายไปจากแผงครูทั้งที่บันทึกสำเร็จ)
 *
 * nickname ของธงก่อนเข้าห้องคืนเป็นป้ายคงที่ ไม่ใช่ชื่อที่เด็กพิมพ์ —
 * ชื่อที่พิมพ์คือ "ข้อความที่ถูกจับ" อยู่แล้ว อยู่ในกติกาเดิม: เต็มเฉพาะระดับ 3
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
  text_for_teacher text,
  is_full_text boolean,
  resolved_at  timestamptz,
  created_at   timestamptz
)
language sql
stable
as $$
  select f.id,
         f.student_id,
         coalesce(st.nickname, '(ยังไม่ได้เข้าห้อง)'),
         f.context,
         f.level,
         f.categories,
         case when f.level >= 3 then f.original_text else f.masked_text end,
         f.level >= 3,
         f.resolved_at,
         f.created_at
  from public.content_flags f
  left join public.students st on st.id = f.student_id
  join public.classrooms c on c.id = f.classroom_id
  where f.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and f.level >= p_min_level
    and (p_include_resolved or f.resolved_at is null)
    and (p_since is null or f.created_at > p_since)
  order by f.level desc, f.created_at desc
  limit 200;
$$;

-- ═══════════════════════════════════════════ 2) ใครเป็นคนสั่งข้าม

alter table public.mission_progress
  add column if not exists skipped_by text;

alter table public.mission_progress
  drop constraint if exists mission_progress_skipped_by_check;
alter table public.mission_progress
  add constraint mission_progress_skipped_by_check
  check (skipped_by is null or skipped_by in ('student', 'teacher'));

comment on column public.mission_progress.skipped_by is
  'ใครเป็นคนตัดสินใจข้ามภารกิจนี้ · student = เด็กกดข้ามเอง · teacher = ครูสั่งข้าม · null = ไม่ได้ข้าม '
  '· รายงานต้องแยกสองอย่างนี้ ไม่งั้น E1 จะนับการตัดสินใจของครูเป็นผลการเรียนรู้ของเด็ก';

/**
 * backfill: เติมเฉพาะแถวที่ "ถูกข้ามจริง" (มีแถวใน mission_skips) เป็น student
 *
 * master สั่งว่าแถวเก่าทั้งหมดเป็นข้อมูลทดสอบให้ backfill เป็น student — ตีความตามเหตุผลที่ให้มา
 * คือเติมให้แถวที่ข้าม ไม่ใช่ทุกแถวในตาราง เพราะถ้าเติมทุกแถว ภารกิจที่เด็กทำเองจนผ่าน
 * จะถูกอ่านว่า "ข้าม" และ E1 จะเพี้ยนในทางตรงข้ามกับที่ตั้งใจจะแก้
 */
update public.mission_progress mp
   set skipped_by = 'student'
 where mp.skipped_by is null
   and exists (
     select 1 from public.mission_skips sk
     where sk.student_id = mp.student_id and sk.mission_id = mp.mission_id
   );

-- หลักฐานว่าครูเป็นคนสั่ง — ใช้ช่องเดิมของ T-06 (teacher_overrides)
alter table public.teacher_overrides
  drop constraint if exists teacher_overrides_action_check;
alter table public.teacher_overrides
  add constraint teacher_overrides_action_check
  check (action in (
    'mission-level', 'allow-skip', 'force-pass', 'boss-template', 'open-boss',
    'unlock-business', 'reset-pin', 'scaffold', 'confirm-score',
    'skip-mission'   -- ครูสั่งข้ามแทนนักเรียน (ใหม่ T49)
  ));

/**
 * นักเรียนกดข้ามเอง — บันทึกร่องรอยใน mission_skips และจดว่าใครสั่งลง mission_progress ครั้งเดียว
 * p_student_id ต้องมาจาก session cookie เท่านั้น (ฟังก์ชันนี้ไม่ตรวจสิทธิ์ให้)
 *
 * boss ไม่มีแถวใน mission_progress ตาม check ของตาราง (m1-m4 เท่านั้น) จึงข้ามการ upsert
 */
create or replace function public.record_mission_skip(
  p_student_id uuid,
  p_mission_id text,
  p_reason     text default null,
  p_by         text default 'student'
)
returns setof public.mission_skips
language plpgsql
as $$
declare
  v_row public.mission_skips;
begin
  if p_by not in ('student', 'teacher') then
    raise exception 'skipped_by ต้องเป็น student หรือ teacher เท่านั้น ได้รับ %', p_by;
  end if;

  insert into public.mission_skips (student_id, mission_id, reason)
  values (p_student_id, p_mission_id, p_reason)
  returning * into v_row;

  if p_mission_id <> 'boss' then
    insert into public.mission_progress (student_id, mission_id, skipped_by, attempts, hints_used, updated_at)
    values (p_student_id, p_mission_id, p_by, 0, 0, now())
    on conflict (student_id, mission_id) do update
      set skipped_by = p_by,
          updated_at = now();
  end if;

  return next v_row;
end;
$$;

/**
 * ครูสั่งข้ามแทนนักเรียน — ตรวจเจ้าของห้องก่อนเสมอ (ไม่ใช่เจ้าของ = คืน 0 แถว)
 * บันทึก teacher_overrides ด้วย จะได้ตอบกรรมการได้ว่าใครสั่ง ตอนไหน ค่าเดิมคืออะไร
 */
create or replace function public.teacher_skip_mission(
  p_teacher_id uuid,
  p_student_id uuid,
  p_mission_id text,
  p_reason     text default 'coached',
  p_note       text default null
)
returns setof public.mission_skips
language plpgsql
as $$
declare
  v_before jsonb;
  v_row    public.mission_skips;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select jsonb_build_object('skippedBy', mp.skipped_by, 'stars', mp.stars) into v_before
  from public.mission_progress mp
  where mp.student_id = p_student_id and mp.mission_id = p_mission_id;

  select * into v_row
  from public.record_mission_skip(p_student_id, p_mission_id, p_note, 'teacher');

  insert into public.teacher_overrides (student_id, teacher_id, action, target, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'skip-mission', p_mission_id,
          v_before, jsonb_build_object('skippedBy', 'teacher'), p_reason, p_note);

  return next v_row;
end;
$$;

/** รายงานดิบต้องบอกด้วยว่าภารกิจที่ข้ามนั้นใครสั่ง — core/ เป็นคนคิดเลขต่อเอง */
create or replace function public.classroom_report_raw(
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
    select st.* from public.students st join owned o on o.id = st.classroom_id
  )
  select case when not exists (select 1 from owned) then null else jsonb_build_object(
    'classroomId', p_classroom_id,
    'students', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'studentId', r.id,
        'nickname',  r.nickname,
        'joinedAt',  r.created_at,
        'profile', (select jsonb_build_object(
            'businessName',     p.business_name,
            'domainName',       p.domain_name,
            'preTestScore',     p.pre_test_score,
            'postTestScore',    p.post_test_score,
            'earnedStars',      p.earned_stars,
            'goalStars',        p.goal_stars,
            'selfGoalLevel',    p.self_goal_level,
            'goalRaisedCount',  p.goal_raised_count,
            'learningRoute',    p.learning_route,
            'channelSuggested', p.channel_suggested,
            'channelChosenBy',  p.channel_chosen_by,
            'channelSwitches',  p.channel_switches,
            'scaffoldLevel',    p.scaffold_level,
            'hintsToggledBy',   p.hints_toggled_by,
            'confidence',       p.confidence
          ) from public.profiles p where p.student_id = r.id),
        'missions', (select coalesce(jsonb_agg(jsonb_build_object(
            'missionId',     mp.mission_id,
            'channelUsed',   mp.channel_used,
            'attempts',      mp.attempts,
            'hintsUsed',     mp.hints_used,
            'stars',         mp.stars,
            'passed',        mp.passed_at is not null,
            'levelOverride', mp.level_override,
            'forcedPass',    mp.forced_pass_at is not null,
            'skippedBy',     mp.skipped_by,
            'startedAt',     mp.started_at,
            'passedAt',      mp.passed_at,
            'secondsSpent',  case when mp.started_at is not null
                                  then greatest(0, extract(epoch from coalesce(mp.passed_at, mp.updated_at) - mp.started_at))::integer
                             end
          ) order by mp.mission_id), '[]'::jsonb)
          from public.mission_progress mp where mp.student_id = r.id),
        'skips', (select coalesce(jsonb_agg(jsonb_build_object(
            'missionId', sk.mission_id, 'reason', sk.reason
          )), '[]'::jsonb) from public.mission_skips sk where sk.student_id = r.id),
        'routeChanges', (select count(*) from public.route_changes rc where rc.student_id = r.id),
        'reflectionCount', (select count(*) from public.reflections rf where rf.student_id = r.id),
        'submission', (select jsonb_build_object(
            'id',             s.id,
            'domainName',     s.domain_name,
            'tld',            s.tld,
            'format',         s.format,
            'selfScores',     s.self_scores,
            'teacherScores',  s.teacher_confirmed_scores,
            'aiScores',       s.ai_scores,
            'teacherChanged', s.teacher_changed,
            'confirmedAt',    s.confirmed_at
          ) from public.submissions s where s.student_id = r.id
          order by s.created_at desc limit 1),
        'overrides', (select count(*) from public.teacher_overrides ov where ov.student_id = r.id)
      ) order by r.nickname), '[]'::jsonb) from roster r
    ),
    'survey', public.survey_summary(p_teacher_id, p_classroom_id),
    'buddy', (select jsonb_build_object(
        'requests', count(*),
        'helped',   count(*) filter (where br.status = 'done'),
        'passedAfterHelp', count(*) filter (where br.requester_passed_after)
      ) from public.buddy_requests br where br.classroom_id = p_classroom_id),
    'overrides', (select coalesce(jsonb_agg(jsonb_build_object(
        'action', ov.action, 'target', ov.target, 'reason', ov.reason, 'createdAt', ov.created_at
      ) order by ov.created_at desc), '[]'::jsonb)
      from public.teacher_overrides ov
      join roster r on r.id = ov.student_id)
  ) end;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.record_pre_join_content_flag(uuid, smallint, text[], text, text) from anon, public;
revoke execute on function public.classroom_content_flags(uuid, uuid, smallint, timestamptz, boolean) from anon, public;
revoke execute on function public.record_mission_skip(uuid, text, text, text)                    from anon, public;
revoke execute on function public.teacher_skip_mission(uuid, uuid, text, text, text)             from anon, public;
revoke execute on function public.classroom_report_raw(uuid, uuid)                               from anon, public;

grant execute on function public.record_pre_join_content_flag(uuid, smallint, text[], text, text) to service_role;
grant execute on function public.classroom_content_flags(uuid, uuid, smallint, timestamptz, boolean) to service_role;
grant execute on function public.record_mission_skip(uuid, text, text, text)                     to service_role;
grant execute on function public.teacher_skip_mission(uuid, uuid, text, text, text)              to service_role;
grant execute on function public.classroom_report_raw(uuid, uuid)                                to service_role;
