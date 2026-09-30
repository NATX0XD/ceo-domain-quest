-- T52 — เปิดทางฐานข้อมูลให้ 3 must-have
--
--   T-02 ครูตั้งค่าคาบที่เหลือ   เวลาแต่ละช่วง (ยืดหดได้) · อนุญาตข้ามภารกิจ · โหมดคาบสั้น
--   S-08 คำขอเปลี่ยนแผนจากนักเรียน  ขออะไร เหตุผลที่พิมพ์เอง ครูตอบว่าอะไร ได้จริงเท่าไหร่
--   S-37 หมดเขตทำต่อที่บ้าน       บังคับที่ฐานข้อมูล ไม่ใช่ที่หน้าเว็บ
--
-- ค่าตั้งต้นทุกตัวเท่ากับพฤติกรรมวันนี้ ห้องที่เปิดค้างอยู่จึงไม่เปลี่ยนพฤติกรรม

-- ═════════════════════════════════════ 1) T-02 ตั้งค่าคาบ

/**
 * เวลาแต่ละช่วงเป็นนาที — ค่าตั้งต้นคัดจากแผนการสอน 60 นาที (docs/lesson-plan.md ขั้นที่ 1-6)
 *   ฟังครู 15 · รู้จักตัวเอง 5 · ภารกิจย่อย 20 · ด่านบอส 10 · ครูสรุป 5 · สะท้อนคิด 5
 * 'end' กับ 'home' ไม่มีนาฬิกา (จบคาบแล้ว / ทำต่อที่บ้านใช้ home_deadline แทน)
 *
 * ⚠️ คอลัมน์นี้เป็น "แผน" เฉย ๆ ยังไม่มีใครอ่านไปตั้งนาฬิกาอัตโนมัติ
 *    `set_session_phase` ยังรับวินาทีจากผู้เรียกเหมือนเดิม ส่ง null = ไม่ตั้งนาฬิกา (พฤติกรรมเดิมทุกอย่าง)
 *    ฝั่งหน้าเว็บจะอ่านแผนนี้ไปเติมช่องเวลาให้ครูเมื่อพร้อม
 */
alter table public.class_sessions
  add column if not exists phase_minutes jsonb not null
    default '{"wait":15,"onboard":5,"mission":20,"boss":10,"summary":5,"reflect":5}'::jsonb;

alter table public.class_sessions
  drop constraint if exists class_sessions_phase_minutes_check;
alter table public.class_sessions
  add constraint class_sessions_phase_minutes_check
  check (jsonb_typeof(phase_minutes) = 'object');

/** ความยาวคาบรวม — 60 คือของวันนี้ · โหมดคาบสั้นคือตั้งเป็น 45 แล้วระบบย่อทุกช่วงให้ */
alter table public.class_sessions
  add column if not exists class_minutes integer not null default 60;

alter table public.class_sessions
  drop constraint if exists class_sessions_class_minutes_check;
alter table public.class_sessions
  add constraint class_sessions_class_minutes_check
  check (class_minutes between 20 and 180);

/** อนุญาตให้ข้ามภารกิจทั้งห้องไหม — วันนี้ข้ามได้ ค่าตั้งต้นจึงเป็น true */
alter table public.class_sessions
  add column if not exists allow_skip_missions boolean not null default true;

comment on column public.class_sessions.phase_minutes is
  'แผนเวลาแต่ละช่วงเป็นนาที ครูยืดหดได้ · ค่าตั้งต้น = แผนการสอน 60 นาที';
comment on column public.class_sessions.class_minutes is
  'ความยาวคาบรวม · ตั้งค่าใหม่ผ่าน set_class_plan แล้วระบบย่อ/ขยายทุกช่วงตามสัดส่วนแผน 60 นาที';
comment on column public.class_sessions.allow_skip_missions is
  'ครูอนุญาตให้ข้ามภารกิจทั้งห้องไหม · true = พฤติกรรมเดิม';

/** ช่วงที่ตั้งเวลาได้ (ไม่รวม end/home) — ใช้ตรวจคีย์ที่ครูส่งมา */
create or replace function public.timed_phases()
returns text[]
language sql
immutable
as $$ select array['wait','onboard','mission','boss','summary','reflect']::text[] $$;

/** แผนตั้งต้น 60 นาที — ที่เดียวที่เก็บตัวเลขชุดนี้ ใช้ทั้งค่าตั้งต้นและการย่อคาบ */
create or replace function public.default_phase_minutes()
returns jsonb
language sql
immutable
as $$ select '{"wait":15,"onboard":5,"mission":20,"boss":10,"summary":5,"reflect":5}'::jsonb $$;

/**
 * ตั้งค่าคาบที่เหลือ (T-02) — ตรวจเจ้าของห้องในคิวรีเดียวกับที่เขียน
 *
 *   p_class_minutes       ตั้งความยาวคาบ · ถ้าไม่ได้ส่ง p_phase_minutes มาด้วย ระบบย่อทุกช่วง
 *                         **ตามสัดส่วนของแผน 60 นาที** แล้วโยนเศษที่ปัดทิ้งไปให้ช่วงภารกิจย่อย
 *                         (ย่อแบบกลไกล้วน ไม่ใช่แผนการสอนใหม่ — ครูปรับรายช่วงต่อได้ทันที)
 *   p_phase_minutes       ส่งเฉพาะช่วงที่อยากแก้ได้ เช่น '{"mission":25}' ระบบผสมทับของเดิม
 *   p_allow_skip_missions อนุญาตให้ข้ามภารกิจทั้งห้องไหม
 *
 * ไม่ใช่เจ้าของห้อง หรือคาบปิดแล้ว = คืน 0 แถว ไม่มีอะไรถูกแตะ
 */
create or replace function public.set_class_plan(
  p_teacher_id          uuid,
  p_session_id          uuid,
  p_class_minutes       integer default null,
  p_phase_minutes       jsonb   default null,
  p_allow_skip_missions boolean default null
)
returns setof public.class_sessions
language plpgsql
as $$
declare
  v_row     public.class_sessions;
  v_plan    jsonb;
  v_key     text;
  v_value   jsonb;
  v_total   integer;
  v_scaled  integer;
  v_sum     integer := 0;
begin
  select s.* into v_row
  from public.class_sessions s
  join public.classrooms c on c.id = s.classroom_id
  where s.id = p_session_id and s.ended_at is null and c.teacher_id = p_teacher_id;

  if not found then
    return;
  end if;

  v_plan  := v_row.phase_minutes;
  v_total := coalesce(p_class_minutes, v_row.class_minutes);

  -- ย่อ/ขยายตามสัดส่วนแผน 60 นาที เมื่อครูเปลี่ยนความยาวคาบโดยไม่ได้ระบุรายช่วง
  if p_class_minutes is not null and p_phase_minutes is null then
    v_plan := '{}'::jsonb;
    foreach v_key in array public.timed_phases() loop
      v_scaled := round(
        (public.default_phase_minutes() ->> v_key)::numeric * v_total / 60.0
      )::integer;
      v_plan := v_plan || jsonb_build_object(v_key, v_scaled);
      v_sum  := v_sum + v_scaled;
    end loop;
    -- เศษจากการปัดไปอยู่ที่ช่วงภารกิจย่อย (ช่วงที่ยาวที่สุด ยืดหดแล้วกระทบแผนน้อยที่สุด)
    v_plan := jsonb_set(v_plan, '{mission}',
      to_jsonb(greatest(0, (v_plan ->> 'mission')::integer + (v_total - v_sum))));
  end if;

  if p_phase_minutes is not null then
    if jsonb_typeof(p_phase_minutes) <> 'object' then
      raise exception 'phase_minutes ต้องเป็น object เช่น {"mission":25}';
    end if;
    for v_key, v_value in select * from jsonb_each(p_phase_minutes) loop
      if not (v_key = any (public.timed_phases())) then
        raise exception 'ช่วง % ตั้งเวลาไม่ได้ (ตั้งได้เฉพาะ %)', v_key, public.timed_phases();
      end if;
      if jsonb_typeof(v_value) <> 'number' or (v_value::text)::numeric < 0
         or (v_value::text)::numeric > 180 then
        raise exception 'เวลาของช่วง % ต้องเป็นจำนวนนาที 0-180', v_key;
      end if;
    end loop;
    v_plan := v_plan || p_phase_minutes;
  end if;

  update public.class_sessions s
     set phase_minutes       = v_plan,
         class_minutes       = v_total,
         allow_skip_missions = coalesce(p_allow_skip_missions, s.allow_skip_missions),
         updated_at          = now()
   where s.id = v_row.id
  returning * into v_row;

  return next v_row;
end;
$$;

-- ═════════════════════════════════════ 2) S-08 คำขอเปลี่ยนแผน

/**
 * "ระบบเสนอ ผู้เรียนเลือก" — ใบนี้คือหลักฐานว่าผู้เรียนเป็นเจ้าของการเรียนของตัวเอง
 * เก็บทั้ง **สิ่งที่ขอ** (requested_value) และ **สิ่งที่ได้จริง** (granted_value) ไว้คู่กัน
 * เหตุผลที่นักเรียนพิมพ์เป็นข้อความของเด็ก — **ห้ามลบทิ้ง** ครูตอบแล้วก็ยังอยู่
 */
create table public.plan_requests (
  id             uuid        primary key default gen_random_uuid(),
  student_id     uuid        not null references public.students (id) on delete cascade,
  /** ห้องของผู้ขอ — เก็บซ้ำไว้ให้แผงครูดึงได้โดยไม่ต้อง join students ทุกครั้ง */
  classroom_id   uuid        not null references public.classrooms (id) on delete cascade,
  kind           text        not null check (kind in ('level', 'channel', 'skip', 'time')),
  /** ภารกิจที่คำขอนี้พูดถึง (ถ้ามี) */
  mission_id     text        check (mission_id in ('m1', 'm2', 'm3', 'm4', 'boss')),
  /** สิ่งที่ขอ เช่น ระดับ 1 · ช่องทาง buddy · ขอเวลาเพิ่ม 5 นาที */
  requested_value text,
  /** เหตุผลที่นักเรียนพิมพ์เอง */
  reason         text        not null check (char_length(reason) between 1 and 500),
  status         text        not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected', 'changed')),
  /** สิ่งที่ครูให้จริง — ต่างจาก requested_value ได้ (status = changed) */
  granted_value  text,
  /** ข้อความที่ครูตอบกลับ */
  teacher_response text,
  responded_by   uuid        references public.teachers (id) on delete set null,
  responded_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- แผงครูดึง "คำขอที่ยังไม่ตอบของห้องนี้ เก่าสุดก่อน" — index ตรงกับคิวรีนั้นพอดี
create index plan_requests_pending_idx
  on public.plan_requests (classroom_id, created_at)
  where responded_at is null;
create index plan_requests_student_idx on public.plan_requests (student_id, created_at desc);

-- กันกดรัว: เรื่องเดียวกันของภารกิจเดียวกัน ค้างได้ใบเดียว
create unique index plan_requests_one_pending_idx
  on public.plan_requests (student_id, kind, coalesce(mission_id, ''))
  where status = 'pending';

alter table public.plan_requests enable row level security;

create policy plan_requests_owner on public.plan_requests
  for all to authenticated
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));

/** นักเรียนยื่นคำขอ — classroom_id เติมให้เอง · p_student_id ต้องมาจาก session cookie เท่านั้น */
create or replace function public.create_plan_request(
  p_student_id      uuid,
  p_kind            text,
  p_reason          text,
  p_requested_value text default null,
  p_mission_id      text default null
)
returns setof public.plan_requests
language sql
as $$
  insert into public.plan_requests (
    student_id, classroom_id, kind, mission_id, requested_value, reason
  )
  select st.id, st.classroom_id, p_kind, p_mission_id, p_requested_value, p_reason
  from public.students st
  where st.id = p_student_id
  returning *;
$$;

/** คำขอของห้องสำหรับแผงครู — ตรวจเจ้าของห้องในคิวรีเดียวกับที่อ่าน */
create or replace function public.classroom_plan_requests(
  p_teacher_id       uuid,
  p_classroom_id     uuid,
  p_include_answered boolean default false
)
returns table (
  id               uuid,
  student_id       uuid,
  nickname         text,
  kind             text,
  mission_id       text,
  requested_value  text,
  reason           text,
  status           text,
  granted_value    text,
  teacher_response text,
  responded_at     timestamptz,
  created_at       timestamptz
)
language sql
stable
as $$
  select r.id, r.student_id, st.nickname, r.kind, r.mission_id, r.requested_value,
         r.reason, r.status, r.granted_value, r.teacher_response, r.responded_at, r.created_at
  from public.plan_requests r
  join public.students st on st.id = r.student_id
  join public.classrooms c on c.id = r.classroom_id
  where r.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and (p_include_answered or r.responded_at is null)
  order by (r.responded_at is null) desc, r.created_at
  limit 200;
$$;

/**
 * ครูตอบคำขอ — ตรวจเจ้าของห้องในคิวรีเดียวกับที่เขียน
 * status 'changed' = ให้ไม่ตรงกับที่ขอ (เช่น ขอข้าม แต่ให้ลดระดับแทน) เก็บทั้งสองค่าไว้เทียบได้
 * ตอบแล้วตอบซ้ำไม่ได้ (responded_at is null ในเงื่อนไข) กันครูสองคนกดพร้อมกัน
 */
create or replace function public.respond_plan_request(
  p_teacher_id    uuid,
  p_request_id    uuid,
  p_status        text,
  p_response      text default null,
  p_granted_value text default null
)
returns setof public.plan_requests
language sql
as $$
  update public.plan_requests r
     set status           = p_status,
         teacher_response = p_response,
         granted_value    = coalesce(p_granted_value, r.requested_value),
         responded_by     = p_teacher_id,
         responded_at     = now()
   where r.id = p_request_id
     and r.responded_at is null
     and p_status in ('approved', 'rejected', 'changed')
     and exists (
       select 1 from public.classrooms c
       where c.id = r.classroom_id and c.teacher_id = p_teacher_id
     )
  returning r.*;
$$;

-- ═════════════════════════════════════ 3) S-37 หมดเขตทำต่อที่บ้าน

/**
 * ตั้ง/ล้างวันหมดเขตทำต่อที่บ้าน — ส่ง null = ล้าง (เขียนได้เรื่อย ๆ เหมือนเดิม)
 *
 * แยกจาก `update_session_settings` เพราะตัวนั้นใช้ coalesce จึงล้างค่ากลับเป็น null ไม่ได้
 */
create or replace function public.set_home_deadline(
  p_teacher_id uuid,
  p_session_id uuid,
  p_deadline   timestamptz
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set home_deadline = p_deadline,
         updated_at    = now()
   where s.id = p_session_id
     and s.ended_at is null
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

/**
 * เลยวันหมดเขตของห้องนี้หรือยัง
 * ไม่มีคาบเดินอยู่ หรือไม่ได้ตั้งวันหมดเขต = ไม่บล็อก (ค่าตั้งต้นของระบบ)
 */
create or replace function public.home_write_blocked(p_student_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.students st
    join public.class_sessions s
      on s.classroom_id = st.classroom_id and s.ended_at is null
    where st.id = p_student_id
      and s.home_deadline is not null
      and now() > s.home_deadline
  );
$$;

/**
 * ประตูหมดเขต — **บังคับที่ฐานข้อมูล** หน้าเว็บจะลืมเช็กก็ยังเขียนไม่ได้
 *
 * ครูยังทำงานต่อได้หลังหมดเขต (ตรวจงาน ยืนยันคะแนน สั่งข้าม) เพราะฟังก์ชันฝั่งครู
 * ตั้งธง `app.teacher_write` ไว้ในธุรกรรมของตัวเอง — นักเรียนตั้งธงนี้เองไม่ได้
 * (เรียก RPC ผ่าน PostgREST ตั้ง GUC ข้ามคำขอไม่ได้ ธงหมดอายุเมื่อจบธุรกรรม)
 */
create or replace function public.enforce_home_deadline()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.teacher_write', true), '') = 'on' then
    return new;
  end if;

  if public.home_write_blocked(new.student_id) then
    raise exception 'หมดเขตทำต่อที่บ้านแล้ว บันทึกคำตอบใหม่ไม่ได้ (ย้อนดูของเดิมได้)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

/** เฉพาะการแก้ "คำตอบของนักเรียน" เท่านั้นที่ถูกกั้น — AI ตรวจงานและครูยืนยันคะแนนยังทำได้ */
create or replace function public.enforce_home_deadline_submission_update()
returns trigger
language plpgsql
as $$
begin
  if new.domain_name         is distinct from old.domain_name
  or new.tld                 is distinct from old.tld
  or new.reason_text         is distinct from old.reason_text
  or new.format              is distinct from old.format
  or new.self_scores         is distinct from old.self_scores
  or new.emphasis_criterion  is distinct from old.emphasis_criterion then
    if coalesce(current_setting('app.teacher_write', true), '') = 'on' then
      return new;
    end if;
    if public.home_write_blocked(new.student_id) then
      raise exception 'หมดเขตทำต่อที่บ้านแล้ว แก้คำตอบไม่ได้ (ย้อนดูของเดิมได้)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger submissions_home_deadline
  before insert on public.submissions
  for each row execute function public.enforce_home_deadline();

create trigger submissions_home_deadline_update
  before update on public.submissions
  for each row execute function public.enforce_home_deadline_submission_update();

create trigger mission_progress_home_deadline
  before insert or update on public.mission_progress
  for each row execute function public.enforce_home_deadline();

create trigger reflections_home_deadline
  before insert on public.reflections
  for each row execute function public.enforce_home_deadline();

create trigger mission_skips_home_deadline
  before insert on public.mission_skips
  for each row execute function public.enforce_home_deadline();

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.set_class_plan(uuid, uuid, integer, jsonb, boolean)   from anon, public;
revoke execute on function public.create_plan_request(uuid, text, text, text, text)     from anon, public;
revoke execute on function public.classroom_plan_requests(uuid, uuid, boolean)          from anon, public;
revoke execute on function public.respond_plan_request(uuid, uuid, text, text, text)    from anon, public;
revoke execute on function public.set_home_deadline(uuid, uuid, timestamptz)            from anon, public;
revoke execute on function public.home_write_blocked(uuid)                              from anon, public;
revoke execute on function public.timed_phases()                                        from anon, public;
revoke execute on function public.default_phase_minutes()                               from anon, public;

grant execute on function public.set_class_plan(uuid, uuid, integer, jsonb, boolean)    to service_role;
grant execute on function public.create_plan_request(uuid, text, text, text, text)      to service_role;
grant execute on function public.classroom_plan_requests(uuid, uuid, boolean)           to service_role;
grant execute on function public.respond_plan_request(uuid, uuid, text, text, text)     to service_role;
grant execute on function public.set_home_deadline(uuid, uuid, timestamptz)             to service_role;
grant execute on function public.home_write_blocked(uuid)                               to service_role;
grant execute on function public.timed_phases()                                         to service_role;
grant execute on function public.default_phase_minutes()                                to service_role;

-- ── ฟังก์ชันฝั่งครูที่เขียน mission_progress / mission_skips ── ตั้งธงข้ามประตูหมดเขต
-- (ตัวฟังก์ชันคัดมาจาก migration เดิมทั้งก้อน แก้เฉพาะบรรทัด set_config ที่เพิ่มเข้าไป)

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
  -- T52: ครูทำงานต่อได้หลังหมดเขตทำต่อที่บ้าน (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
  -- T52: ครูทำงานต่อได้หลังหมดเขตทำต่อที่บ้าน (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
  -- T52: ครูทำงานต่อได้หลังหมดเขตทำต่อที่บ้าน (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
  -- T52: ครูทำงานต่อได้หลังหมดเขตทำต่อที่บ้าน (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
