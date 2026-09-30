-- รอบ 10 (T43): อุดรูฝั่งครู
--   T-06 ดูและปรับแผนรายคน — ครูแก้การตัดสินใจของระบบได้ และ **ทุกการแก้ถูกบันทึกเป็นหลักฐาน**
--   T-07 บันทึกการโค้ช (ปุ่มในหน้าเดียวกับ T-06)
--   T-09 ดูแลผนังผลงาน — ซ่อนความเห็น · ปักหมุดผลงาน · เปิด/ปิดผนัง
--   T-15 ส่งข้อความถึงทั้งห้อง
--
-- หลักการใช้ AI ข้อ 7 ของสเปก: "ครูแก้ได้" — ตารางกลาง teacher_overrides เก็บทั้งค่าเดิมและค่าใหม่
-- เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม (สเปก T-06: การแก้ของครูมีผลเหนือกฎ แต่ไม่ลบข้อมูลเดิม)

-- ─────────────────────────────────── คอลัมน์ที่การแก้ของครูต้องใช้

alter table public.mission_progress
  -- ครูปรับระดับความยากของภารกิจนี้ให้เป็นรายคน (null = ใช้ระดับที่ระบบคิดให้)
  add column if not exists level_override      smallint check (level_override between 1 and 3),
  -- ครูอนุญาต/ไม่อนุญาตให้ข้ามภารกิจนี้ (ตอบคำขอจาก S-08 หรือครูตั้งเอง)
  add column if not exists skip_allowed        boolean,
  -- ครูกด "ให้ผ่านข้อนี้" — ผ่านโดยได้ 1 ดาวเท่ากับการใช้ข้อสำรอง (สเปก T-06)
  add column if not exists forced_pass_by      uuid references public.teachers (id) on delete set null,
  add column if not exists forced_pass_at      timestamptz;

alter table public.profiles
  -- ครูปลดล็อกให้กลับไปแก้ข้อมูลธุรกิจได้อีกครั้ง
  add column if not exists business_edit_unlocked boolean not null default false,
  -- ครูเลือกแม่แบบด่านบอสให้ (null = ระบบสุ่ม/เลือกตามโปรไฟล์)
  add column if not exists boss_template_id       text;

alter table public.students
  -- ครูรีเซ็ตรหัส 4 หลักให้ — รหัสใหม่เป็นรหัสชั่วคราว นักเรียนต้องตั้งใหม่เมื่อเข้ามา
  add column if not exists pin_reset_at    timestamptz,
  add column if not exists pin_reset_by    uuid references public.teachers (id) on delete set null,
  add column if not exists must_change_pin boolean not null default false;

alter table public.peer_feedback
  -- T-09: ครูซ่อนความเห็นที่ไม่เหมาะสม (ซ่อน ไม่ลบ — ผู้เขียนได้รับแจ้งว่าถูกซ่อน)
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_by     uuid references public.teachers (id) on delete set null,
  add column if not exists hidden_reason text;

alter table public.submissions
  -- T-09: ปักหมุดผลงานขึ้นจอหน้าห้องตอนครูสรุป · เลือกซ่อนชื่อเจ้าของได้
  add column if not exists pinned_at      timestamptz,
  add column if not exists pinned_by      uuid references public.teachers (id) on delete set null,
  add column if not exists pin_hide_name  boolean not null default false;

alter table public.class_sessions
  -- T-09 ข้อ 1: เปิดหรือปิดผนังผลงานทั้งห้อง
  add column if not exists showcase_enabled boolean not null default true,
  /**
   * T-12 สวิตช์แบบทดสอบ 10 ข้อ — **แยกจาก phase โดยตั้งใจ**
   * ผูกประตู /pretest /posttest กับ phase ไม่ได้ เพราะกดเปิดแบบทดสอบแล้วทั้งห้องจะเด้งไปช่วงอื่น
   * และแบบทดสอบก่อนเรียนต้องเปิดได้ตั้งแต่ก่อนเริ่มคาบ (คาบยังอยู่ช่วง 'wait')
   *
   * ⚠️ อย่าสับสนกับ "เช็กความเข้าใจ 4 ข้อ" ในช่วงรู้จักตัวเอง — อันนั้นใช้เลือกระดับตัวช่วย
   *    ไม่ใช่ข้อสอบวิจัย และไม่มีสวิตช์
   */
  add column if not exists pretest_enabled   boolean not null default false,
  add column if not exists posttest_enabled  boolean not null default false,
  -- เปิดครั้งแรกเมื่อไร — ใช้ในรายงานว่าเก็บข้อมูลก่อน/หลังตอนไหน
  add column if not exists pretest_opened_at  timestamptz,
  add column if not exists posttest_opened_at timestamptz,
  add column if not exists pretest_closed_at  timestamptz,
  add column if not exists posttest_closed_at timestamptz;

-- ────────────────────────────── T-06 ประวัติการแก้ของครู (หลักฐาน)
-- สเปกข้อ 2.6 ข้อ 7 + ตาราง OVERRIDE ในข้อ 10.2
-- before/after เก็บเป็น jsonb เพื่อให้รองรับการแก้ทุกชนิดด้วยตารางเดียว

create table public.teacher_overrides (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  teacher_id uuid        not null references public.teachers (id) on delete cascade,
  action     text        not null check (action in (
                 'mission-level',      -- เปลี่ยนระดับภารกิจ
                 'allow-skip',         -- อนุญาต/ไม่อนุญาตให้ข้าม
                 'force-pass',         -- ให้ผ่านข้อนี้
                 'boss-template',      -- เปลี่ยนแม่แบบบอส
                 'open-boss',          -- เปิดด่านบอสให้
                 'unlock-business',    -- ปลดล็อกข้อมูลธุรกิจ
                 'reset-pin',          -- รีเซ็ตรหัสลับ
                 'scaffold',           -- เปลี่ยนตัวช่วยที่แนะนำ
                 'confirm-score'       -- ยืนยัน/แก้คะแนนด่านบอส (บันทึกจากที่อื่นได้)
               )),
  target     text,        -- เช่น mission_id ของภารกิจที่แก้
  /** ค่าก่อนแก้และหลังแก้ — ใช้ตอบกรรมการว่าครูแก้อะไรจากที่ระบบเสนอ */
  before_value jsonb,
  after_value  jsonb,
  /** เหตุผลสั้นที่ครูเลือก (สเปกบังคับ): coached | device | level-fit | other */
  reason     text        not null check (reason in ('coached', 'device', 'level-fit', 'other')),
  note       text,
  created_at timestamptz not null default now()
);
create index teacher_overrides_student_idx on public.teacher_overrides (student_id, created_at desc);
create index teacher_overrides_teacher_idx on public.teacher_overrides (teacher_id, created_at desc);

/** T-07 บันทึกการโค้ช — เห็นเฉพาะครู และแสดงในรายงานรายคน */
create table public.teacher_notes (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  teacher_id uuid        not null references public.teachers (id) on delete cascade,
  chips      text[]      not null default '{}',
  text       text,
  created_at timestamptz not null default now()
);
create index teacher_notes_student_idx on public.teacher_notes (student_id, created_at desc);

-- ───────────────────────────── T-15 ข้อความถึงทั้งห้อง

create table public.broadcasts (
  id           uuid        primary key default gen_random_uuid(),
  classroom_id uuid        not null references public.classrooms (id) on delete cascade,
  session_id   uuid        references public.class_sessions (id) on delete set null,
  teacher_id   uuid        not null references public.teachers (id) on delete cascade,
  /** พิมพ์เองได้ไม่เกิน 80 ตัวอักษร (สเปก T-15) */
  text         text        not null check (char_length(text) between 1 and 80),
  /** ส่งทั้งห้อง หรือเฉพาะคนที่อยู่ภารกิจนั้น */
  target       text        not null default 'all' check (target in ('all', 'mission')),
  target_value text,
  sent_at      timestamptz not null default now()
);
create index broadcasts_classroom_idx on public.broadcasts (classroom_id, sent_at desc);

-- ─────────────────────────────────────────────────────────── RLS

alter table public.teacher_overrides enable row level security;
alter table public.teacher_notes     enable row level security;
alter table public.broadcasts        enable row level security;

create policy teacher_overrides_owner on public.teacher_overrides
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy teacher_notes_owner on public.teacher_notes
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy broadcasts_owner on public.broadcasts
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

-- ──────────────────────── T-06 ฟังก์ชันการแก้ของครู
-- ทุกตัว: ตรวจเจ้าของห้องใน UPDATE เดียวกัน · เขียน teacher_overrides ในทรานแซกชันเดียวกัน
-- ไม่ใช่เจ้าของ = คืน 0 แถว และ **ไม่มีการเขียนประวัติ** (กันปลอมหลักฐาน)

/** helper: นักเรียนคนนี้อยู่ห้องของครูคนนี้ไหม (ใช้ใน WHERE ของคำสั่งเดียวกันเสมอ) */
create or replace function public.teacher_owns_student(p_teacher_id uuid, p_student_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.students st
    join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.teacher_id = p_teacher_id
  );
$$;

/** เปลี่ยนระดับภารกิจของนักเรียนคนเดียว */
create or replace function public.teacher_set_mission_level(
  p_teacher_id uuid,
  p_student_id uuid,
  p_mission_id text,
  p_level      smallint,
  p_reason     text default 'level-fit',
  p_note       text default null
)
returns setof public.mission_progress
language plpgsql
as $$
declare
  v_before smallint;
  v_row    public.mission_progress;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select mp.level_override into v_before
  from public.mission_progress mp
  where mp.student_id = p_student_id and mp.mission_id = p_mission_id;

  insert into public.mission_progress (student_id, mission_id, level_override, attempts, hints_used, updated_at)
  values (p_student_id, p_mission_id, p_level, 0, 0, now())
  on conflict (student_id, mission_id) do update
    set level_override = p_level,
        updated_at     = now()
  returning * into v_row;

  insert into public.teacher_overrides (student_id, teacher_id, action, target, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'mission-level', p_mission_id,
          to_jsonb(v_before), to_jsonb(p_level), p_reason, p_note);

  return next v_row;
end;
$$;

/** อนุญาตหรือไม่อนุญาตให้ข้ามภารกิจนี้ */
create or replace function public.teacher_allow_skip(
  p_teacher_id uuid,
  p_student_id uuid,
  p_mission_id text,
  p_allow      boolean,
  p_reason     text default 'coached',
  p_note       text default null
)
returns setof public.mission_progress
language plpgsql
as $$
declare
  v_before boolean;
  v_row    public.mission_progress;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select mp.skip_allowed into v_before
  from public.mission_progress mp
  where mp.student_id = p_student_id and mp.mission_id = p_mission_id;

  insert into public.mission_progress (student_id, mission_id, skip_allowed, attempts, hints_used, updated_at)
  values (p_student_id, p_mission_id, p_allow, 0, 0, now())
  on conflict (student_id, mission_id) do update
    set skip_allowed = p_allow,
        updated_at   = now()
  returning * into v_row;

  insert into public.teacher_overrides (student_id, teacher_id, action, target, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'allow-skip', p_mission_id,
          to_jsonb(v_before), to_jsonb(p_allow), p_reason, p_note);

  return next v_row;
end;
$$;

/**
 * "ให้ผ่านข้อนี้" — ผ่านทันที ได้ 1 ดาวเท่ากับการใช้ข้อสำรอง (สเปก T-06)
 * ไม่ทับดาวที่นักเรียนทำได้เองถ้าเคยได้มากกว่านั้น
 */
create or replace function public.teacher_force_pass(
  p_teacher_id uuid,
  p_student_id uuid,
  p_mission_id text,
  p_reason     text default 'coached',
  p_note       text default null
)
returns setof public.mission_progress
language plpgsql
as $$
declare
  v_before jsonb;
  v_row    public.mission_progress;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select jsonb_build_object('stars', mp.stars, 'passedAt', mp.passed_at) into v_before
  from public.mission_progress mp
  where mp.student_id = p_student_id and mp.mission_id = p_mission_id;

  insert into public.mission_progress (
    student_id, mission_id, stars, passed_at, attempts, hints_used, forced_pass_by, forced_pass_at, updated_at
  )
  values (p_student_id, p_mission_id, 1, now(), 0, 0, p_teacher_id, now(), now())
  on conflict (student_id, mission_id) do update
    set stars          = greatest(coalesce(mission_progress.stars, 0), 1),
        passed_at      = coalesce(mission_progress.passed_at, now()),
        forced_pass_by = p_teacher_id,
        forced_pass_at = now(),
        updated_at     = now()
  returning * into v_row;

  insert into public.teacher_overrides (student_id, teacher_id, action, target, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'force-pass', p_mission_id, v_before,
          jsonb_build_object('stars', v_row.stars, 'passedAt', v_row.passed_at), p_reason, p_note);

  perform public.recalc_student_stars(p_student_id);
  return next v_row;
end;
$$;

/**
 * รีเซ็ตรหัส 4 หลัก — **รับ hash ที่คำนวณมาจากฝั่งแอปเท่านั้น**
 * ห้ามส่งรหัสดิบเข้ามาและ SQL ไม่เคยเห็นรหัสจริง (argon2 อยู่ใน lib/pin.ts)
 */
create or replace function public.teacher_reset_pin(
  p_teacher_id uuid,
  p_student_id uuid,
  p_pin_hash   text,
  p_reason     text default 'device',
  p_note       text default null
)
returns setof public.students
language plpgsql
as $$
declare
  v_row public.students;
begin
  update public.students st
     set pin_hash        = p_pin_hash,
         pin_reset_at    = now(),
         pin_reset_by    = p_teacher_id,
         must_change_pin = true,
         device_token    = null   -- เครื่องเดิมที่ยังค้าง session ต้องเข้าใหม่
   where st.id = p_student_id
     and exists (
       select 1 from public.classrooms c
       where c.id = st.classroom_id and c.teacher_id = p_teacher_id
     )
  returning st.* into v_row;

  if not found then
    return;
  end if;

  -- ไม่เก็บค่า hash ทั้งเก่าและใหม่ลงประวัติ เก็บแค่ว่าเกิดการรีเซ็ตเมื่อไร
  insert into public.teacher_overrides (student_id, teacher_id, action, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'reset-pin',
          jsonb_build_object('pinResetAt', null),
          jsonb_build_object('pinResetAt', v_row.pin_reset_at, 'mustChangePin', true), p_reason, p_note);

  return next v_row;
end;
$$;

/** เปลี่ยนตัวช่วยที่แนะนำ (ช่องทาง + ระดับตัวช่วย) */
create or replace function public.teacher_set_scaffold(
  p_teacher_id uuid,
  p_student_id uuid,
  p_channel    text default null,
  p_level      smallint default null,
  p_reason     text default 'level-fit',
  p_note       text default null
)
returns setof public.profiles
language plpgsql
as $$
declare
  v_before jsonb;
  v_row    public.profiles;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select jsonb_build_object(
           'channelSuggested', p.channel_suggested,
           'learningRoute', p.learning_route,
           'scaffoldLevel', p.scaffold_level
         ) into v_before
  from public.profiles p
  where p.student_id = p_student_id;

  insert into public.profiles (student_id, channel_suggested, learning_route, scaffold_level, hints_toggled_by, updated_at)
  values (p_student_id, p_channel, p_channel, p_level, 'teacher', now())
  on conflict (student_id) do update
    set channel_suggested = coalesce(p_channel, profiles.channel_suggested),
        learning_route    = coalesce(p_channel, profiles.learning_route),
        scaffold_level    = coalesce(p_level, profiles.scaffold_level),
        hints_toggled_by  = case when p_level is null then profiles.hints_toggled_by else 'teacher' end,
        updated_at        = now()
  returning * into v_row;

  insert into public.teacher_overrides (student_id, teacher_id, action, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'scaffold', v_before,
          jsonb_build_object(
            'channelSuggested', v_row.channel_suggested,
            'learningRoute', v_row.learning_route,
            'scaffoldLevel', v_row.scaffold_level
          ), p_reason, p_note);

  return next v_row;
end;
$$;

/** ปลดล็อกข้อมูลธุรกิจให้แก้ได้อีกครั้ง */
create or replace function public.teacher_unlock_business(
  p_teacher_id uuid,
  p_student_id uuid,
  p_unlocked   boolean default true,
  p_reason     text default 'coached',
  p_note       text default null
)
returns setof public.profiles
language plpgsql
as $$
declare
  v_before boolean;
  v_row    public.profiles;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select p.business_edit_unlocked into v_before
  from public.profiles p where p.student_id = p_student_id;

  insert into public.profiles (student_id, business_edit_unlocked, updated_at)
  values (p_student_id, p_unlocked, now())
  on conflict (student_id) do update
    set business_edit_unlocked = p_unlocked,
        updated_at             = now()
  returning * into v_row;

  insert into public.teacher_overrides (student_id, teacher_id, action, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'unlock-business',
          to_jsonb(v_before), to_jsonb(p_unlocked), p_reason, p_note);

  return next v_row;
end;
$$;

/** เปลี่ยนแม่แบบด่านบอสให้นักเรียนคนนี้ */
create or replace function public.teacher_set_boss_template(
  p_teacher_id  uuid,
  p_student_id  uuid,
  p_template_id text,
  p_reason      text default 'level-fit',
  p_note        text default null
)
returns setof public.profiles
language plpgsql
as $$
declare
  v_before text;
  v_row    public.profiles;
begin
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  select p.boss_template_id into v_before
  from public.profiles p where p.student_id = p_student_id;

  insert into public.profiles (student_id, boss_template_id, updated_at)
  values (p_student_id, p_template_id, now())
  on conflict (student_id) do update
    set boss_template_id = p_template_id,
        updated_at       = now()
  returning * into v_row;

  insert into public.teacher_overrides (student_id, teacher_id, action, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'boss-template',
          to_jsonb(v_before), to_jsonb(p_template_id), p_reason, p_note);

  return next v_row;
end;
$$;

/** เปิดด่านบอสให้คนนี้ก่อนทั้งห้อง — ต่อกับ student_phase_unlocks ของ T-03 แล้วลงประวัติด้วย */
create or replace function public.teacher_open_boss(
  p_teacher_id uuid,
  p_student_id uuid,
  p_reason     text default 'coached',
  p_note       text default null
)
returns setof public.student_phase_unlocks
language plpgsql
as $$
declare
  v_row public.student_phase_unlocks;
begin
  select * into v_row from public.unlock_student_phase(p_teacher_id, p_student_id, 'boss', p_note);
  if not found then
    return;
  end if;

  insert into public.teacher_overrides (student_id, teacher_id, action, target, before_value, after_value, reason, note)
  values (p_student_id, p_teacher_id, 'open-boss', 'boss',
          to_jsonb(false), to_jsonb(true), p_reason, p_note);

  return next v_row;
end;
$$;

/** T-07 บันทึกการโค้ช */
create or replace function public.teacher_add_note(
  p_teacher_id uuid,
  p_student_id uuid,
  p_chips      text[] default '{}',
  p_text       text default null
)
returns setof public.teacher_notes
language sql
as $$
  insert into public.teacher_notes (student_id, teacher_id, chips, text)
  select p_student_id, p_teacher_id, coalesce(p_chips, '{}'), p_text
  where public.teacher_owns_student(p_teacher_id, p_student_id)
  returning *;
$$;

-- ─────────────────────────── T-09 ดูแลผนังผลงาน

/** ซ่อน/เลิกซ่อนความเห็นของเพื่อน — ซ่อนเท่านั้น ไม่ลบ ผู้เขียนได้รับแจ้ง */
create or replace function public.teacher_hide_feedback(
  p_teacher_id  uuid,
  p_feedback_id uuid,
  p_hidden      boolean,
  p_reason      text default null
)
returns setof public.peer_feedback
language sql
as $$
  update public.peer_feedback pf
     set hidden_at     = case when p_hidden then now() else null end,
         hidden_by     = case when p_hidden then p_teacher_id else null end,
         hidden_reason = case when p_hidden then p_reason else null end
   where pf.id = p_feedback_id
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = pf.to_student_id and c.teacher_id = p_teacher_id
     )
  returning pf.*;
$$;

/** ปักหมุดผลงานขึ้นจอหน้าห้อง (2-3 ชิ้น) · เลือกซ่อนชื่อเจ้าของได้ */
create or replace function public.teacher_pin_submission(
  p_teacher_id    uuid,
  p_submission_id uuid,
  p_pinned        boolean,
  p_hide_name     boolean default false
)
returns setof public.submissions
language sql
as $$
  update public.submissions s
     set pinned_at     = case when p_pinned then now() else null end,
         pinned_by     = case when p_pinned then p_teacher_id else null end,
         pin_hide_name = case when p_pinned then p_hide_name else false end,
         updated_at    = now()
   where s.id = p_submission_id
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = s.student_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/** ผลงานที่ปักหมุดของห้อง — ซ่อนชื่อตามที่ครูเลือก (ไม่มีดาว ไม่มีคะแนน ไม่เปรียบเทียบใคร) */
create or replace function public.pinned_showcase(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (
  submission_id uuid,
  nickname      text,
  domain_name   text,
  tld           text,
  reason_text   text,
  pinned_at     timestamptz
)
language sql
stable
as $$
  select s.id,
         case when s.pin_hide_name then null else st.nickname end,
         s.domain_name,
         s.tld,
         s.reason_text,
         s.pinned_at
  from public.submissions s
  join public.students st on st.id = s.student_id
  join public.classrooms c on c.id = st.classroom_id
  where c.id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and s.pinned_at is not null
  order by s.pinned_at;
$$;

/** ใครยังไม่ได้รับความเห็นจากเพื่อนเลย (T-09 ข้อ 4) */
create or replace function public.students_without_feedback(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (student_id uuid, nickname text)
language sql
stable
as $$
  select st.id, st.nickname
  from public.students st
  join public.classrooms c on c.id = st.classroom_id
  where c.id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and not exists (
      select 1 from public.peer_feedback pf
      where pf.to_student_id = st.id and pf.hidden_at is null
    )
  order by st.nickname;
$$;

-- ─────────────────────────── T-15 ส่งข้อความถึงทั้งห้อง

/**
 * ส่งข้อความ — จำกัด 1 ข้อความทุก 30 วินาทีต่อห้อง (สเปก T-15)
 * ส่งถี่เกินไปคืน 0 แถว ให้ API ตอบ 429
 */
create or replace function public.send_broadcast(
  p_teacher_id   uuid,
  p_classroom_id uuid,
  p_text         text,
  p_target       text default 'all',
  p_target_value text default null,
  p_min_seconds  integer default 30
)
returns setof public.broadcasts
language sql
as $$
  insert into public.broadcasts (classroom_id, session_id, teacher_id, text, target, target_value)
  select c.id,
         (select s.id from public.class_sessions s
           where s.classroom_id = c.id and s.ended_at is null
           order by s.created_at desc limit 1),
         p_teacher_id, p_text, p_target, p_target_value
  from public.classrooms c
  where c.id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and not exists (
      select 1 from public.broadcasts b
      where b.classroom_id = c.id
        and b.sent_at > now() - make_interval(secs => p_min_seconds)
    )
  returning *;
$$;

-- ─────────────────── T-12 สวิตช์แบบทดสอบก่อน/หลังเรียน (แยกจาก phase)

/**
 * ครูเปิด/ปิดแบบทดสอบ 10 ข้อ โดยไม่ยุ่งกับช่วงของคาบ
 * p_which: 'pre' = แบบทดสอบก่อนเรียน (เปิดได้ตั้งแต่ก่อนคาบ) · 'post' = หลังเรียน
 * บันทึกเวลาเปิดครั้งแรกและเวลาปิดล่าสุดไว้ใช้ในรายงาน
 */
create or replace function public.set_test_window(
  p_teacher_id uuid,
  p_session_id uuid,
  p_which      text,
  p_enabled    boolean
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set pretest_enabled = case when p_which = 'pre' then p_enabled else s.pretest_enabled end,
         pretest_opened_at = case
             when p_which = 'pre' and p_enabled then coalesce(s.pretest_opened_at, now())
             else s.pretest_opened_at end,
         pretest_closed_at = case
             when p_which = 'pre' and not p_enabled and s.pretest_enabled then now()
             else s.pretest_closed_at end,
         posttest_enabled = case when p_which = 'post' then p_enabled else s.posttest_enabled end,
         posttest_opened_at = case
             when p_which = 'post' and p_enabled then coalesce(s.posttest_opened_at, now())
             else s.posttest_opened_at end,
         posttest_closed_at = case
             when p_which = 'post' and not p_enabled and s.posttest_enabled then now()
             else s.posttest_closed_at end,
         updated_at = now()
   where s.id = p_session_id
     and s.ended_at is null
     and p_which in ('pre', 'post')
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

-- ──────────────────── T-11 ข้อมูลดิบสำหรับรายงานรายห้อง
-- **ไม่คำนวณสถิติใน SQL** — ดึงข้อมูลดิบรายคนออกไปให้ core/ คำนวณที่เดียว
-- (core/efficiency.ts คิด E1/E2 · core/statistics.ts คิด t-test/effect size · core/report.ts คิดจุดประสงค์)

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

/** ประวัติการแก้ของครูสำหรับนักเรียนคนหนึ่ง — ใช้ในรายงานรายคน (T-06 เกณฑ์ตรวจรับข้อ 2) */
create or replace function public.student_override_history(
  p_teacher_id uuid,
  p_student_id uuid
)
returns setof public.teacher_overrides
language sql
stable
as $$
  select ov.*
  from public.teacher_overrides ov
  where ov.student_id = p_student_id
    and public.teacher_owns_student(p_teacher_id, p_student_id)
  order by ov.created_at desc;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.teacher_owns_student(uuid, uuid)                               from anon, public;
revoke execute on function public.teacher_set_mission_level(uuid, uuid, text, smallint, text, text) from anon, public;
revoke execute on function public.teacher_allow_skip(uuid, uuid, text, boolean, text, text)      from anon, public;
revoke execute on function public.teacher_force_pass(uuid, uuid, text, text, text)               from anon, public;
revoke execute on function public.teacher_reset_pin(uuid, uuid, text, text, text)                from anon, public;
revoke execute on function public.teacher_set_scaffold(uuid, uuid, text, smallint, text, text)   from anon, public;
revoke execute on function public.teacher_unlock_business(uuid, uuid, boolean, text, text)       from anon, public;
revoke execute on function public.teacher_set_boss_template(uuid, uuid, text, text, text)        from anon, public;
revoke execute on function public.teacher_open_boss(uuid, uuid, text, text)                      from anon, public;
revoke execute on function public.teacher_add_note(uuid, uuid, text[], text)                     from anon, public;
revoke execute on function public.teacher_hide_feedback(uuid, uuid, boolean, text)               from anon, public;
revoke execute on function public.teacher_pin_submission(uuid, uuid, boolean, boolean)           from anon, public;
revoke execute on function public.pinned_showcase(uuid, uuid)                                    from anon, public;
revoke execute on function public.students_without_feedback(uuid, uuid)                          from anon, public;
revoke execute on function public.send_broadcast(uuid, uuid, text, text, text, integer)          from anon, public;
revoke execute on function public.set_test_window(uuid, uuid, text, boolean)                     from anon, public;
revoke execute on function public.classroom_report_raw(uuid, uuid)                               from anon, public;
revoke execute on function public.student_override_history(uuid, uuid)                           from anon, public;

grant execute on function public.teacher_owns_student(uuid, uuid)                               to service_role;
grant execute on function public.teacher_set_mission_level(uuid, uuid, text, smallint, text, text) to service_role;
grant execute on function public.teacher_allow_skip(uuid, uuid, text, boolean, text, text)      to service_role;
grant execute on function public.teacher_force_pass(uuid, uuid, text, text, text)               to service_role;
grant execute on function public.teacher_reset_pin(uuid, uuid, text, text, text)                to service_role;
grant execute on function public.teacher_set_scaffold(uuid, uuid, text, smallint, text, text)   to service_role;
grant execute on function public.teacher_unlock_business(uuid, uuid, boolean, text, text)       to service_role;
grant execute on function public.teacher_set_boss_template(uuid, uuid, text, text, text)        to service_role;
grant execute on function public.teacher_open_boss(uuid, uuid, text, text)                      to service_role;
grant execute on function public.teacher_add_note(uuid, uuid, text[], text)                     to service_role;
grant execute on function public.teacher_hide_feedback(uuid, uuid, boolean, text)               to service_role;
grant execute on function public.teacher_pin_submission(uuid, uuid, boolean, boolean)           to service_role;
grant execute on function public.pinned_showcase(uuid, uuid)                                    to service_role;
grant execute on function public.students_without_feedback(uuid, uuid)                          to service_role;
grant execute on function public.send_broadcast(uuid, uuid, text, text, text, integer)          to service_role;
grant execute on function public.set_test_window(uuid, uuid, text, boolean)                     to service_role;
grant execute on function public.classroom_report_raw(uuid, uuid)                               to service_role;
grant execute on function public.student_override_history(uuid, uuid)                           to service_role;
