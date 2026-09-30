-- T54
--
--   1) set_session_phase หยิบเวลาจากแผน **เฉพาะห้องที่ครูตั้งค่าเอง** ห้องที่ยังเป็นค่าตั้งต้นพฤติกรรมเดิมเป๊ะ
--   2) ประตูวันหมดเขตกั้นเพิ่ม chat_messages · peer_feedback · profiles
--   3) E-04/S-41 คู่หู — ข้อมูลดิบให้ core/buddy.ts จัดอันดับเอง + ยกเลิกคำขอ + คำขอค้างในห้อง
--   4) T-01 ครูสมัครเอง + โทเคนรีเซ็ตรหัส (หมดอายุได้ ใช้ครั้งเดียว เก็บเฉพาะแฮช)

-- ═════════════════════════ 1) นาฬิกาจากแผนเวลา (เฉพาะห้องที่ครูตั้งเอง)

/**
 * ครูเคยตั้งค่าเวลาของคาบนี้เองหรือยัง
 *
 * ต้องมีธงนี้เพราะ "ค่าตั้งต้นของ phase_minutes" กับ "ครูตั้งค่าเป็นเลขเดียวกับค่าตั้งต้น"
 * หน้าตาเหมือนกันทุกประการ แต่ต้องได้พฤติกรรมคนละแบบ:
 *   ยังไม่เคยตั้ง = ส่ง p_timer_seconds มาเท่านั้นถึงจะมีนาฬิกา (พฤติกรรมเดิมทั้งหมด)
 *   ตั้งแล้ว      = ไม่ส่งวินาทีมา ระบบหยิบนาทีของช่วงนั้นจากแผนให้เอง
 */
alter table public.class_sessions
  add column if not exists phase_minutes_custom boolean not null default false;

comment on column public.class_sessions.phase_minutes_custom is
  'ครูตั้งเวลาของคาบนี้เองแล้วหรือยัง · false = ห้องเดิม set_session_phase ไม่ตั้งนาฬิกาให้เองเด็ดขาด';

-- ═════════════════════════ 2) ประตูวันหมดเขต — ตารางที่เหลือ

/**
 * peer_feedback ไม่มีคอลัมน์ student_id (ใช้ from_student_id / to_student_id)
 * จึงต้องมี trigger ของตัวเอง — กั้นที่ "คนเขียน" ไม่ใช่คนถูกเขียนถึง
 */
create or replace function public.enforce_home_deadline_peer_feedback()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.teacher_write', true), '') = 'on' then
    return new;
  end if;

  if public.home_write_blocked(new.from_student_id) then
    raise exception 'หมดเขตทำต่อที่บ้านแล้ว ส่งข้อความชมเพื่อนใหม่ไม่ได้ (ย้อนดูของเดิมได้)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger chat_messages_home_deadline
  before insert on public.chat_messages
  for each row execute function public.enforce_home_deadline();

create trigger peer_feedback_home_deadline
  before insert on public.peer_feedback
  for each row execute function public.enforce_home_deadline_peer_feedback();

create trigger profiles_home_deadline
  before insert or update on public.profiles
  for each row execute function public.enforce_home_deadline();

-- ═════════════════════════ 3) คู่หู (E-04 / S-41)

/**
 * ข้อมูลดิบของเพื่อนร่วมห้องให้ `core/buddy.ts` เอาไปคัดและให้คะแนนเอง
 *
 * **ไม่คิดคะแนนใน SQL** — `find_buddy_candidates` เดิมคิดคะแนนซ้ำกับ core (สองแหล่งความจริง)
 * ตัวนี้คืนข้อมูลดิบอย่างเดียว ตรงกับ interface `BuddyCandidate` ของ core
 * เพื่อนต้องอยู่ห้องเดียวกันเท่านั้น (join ที่ classroom_id ของผู้ขอ)
 */
create or replace function public.buddy_candidates_raw(
  p_student_id uuid,
  p_mission_id text
)
returns table (
  student_id          uuid,
  nickname            text,
  standing            text,
  stars               smallint,
  idle_seconds        integer,
  in_big_mission      boolean,
  waiting_for_teacher boolean,
  accepting_requests  boolean,
  helping_now         integer,
  helped_count        integer,
  likes_talking       boolean,
  paired_with         uuid,
  declined_seconds_ago integer
)
language sql
stable
as $$
  with me as (
    select st.id, st.classroom_id from public.students st where st.id = p_student_id
  )
  select cand.id,
         cand.nickname,
         case
           when mp.passed_at is not null then 'passed'
           when sk.student_id is not null then 'skipped-confident'
           when mp.student_id is not null then 'in-progress'
           else 'not-started'
         end,
         mp.stars,
         case
           when cand.last_seen_at is null then 999999
           else greatest(0, extract(epoch from now() - cand.last_seen_at))::integer
         end,
         coalesce(cand.current_screen, '') = 'boss',
         coalesce(cand.current_screen, '') = 'help-waiting',
         cand.accepts_buddy_requests,
         (select count(*)::integer from public.buddy_requests br
           where br.helper_id = cand.id and br.status = 'accepted'),
         coalesce(cand.buddy_helped_count, 0),
         pr.learning_route = 'buddy',
         (select br2.requester_id from public.buddy_requests br2
           where br2.helper_id = cand.id and br2.status = 'accepted'
           order by br2.accepted_at desc limit 1),
         (select extract(epoch from now() - o.responded_at)::integer
            from public.buddy_offers o
            join public.buddy_requests r on r.id = o.request_id
           where o.helper_id = cand.id
             and r.requester_id = p_student_id
             and o.status = 'declined'
           order by o.responded_at desc limit 1)
  from public.students cand
  join me on me.classroom_id = cand.classroom_id and cand.id <> me.id
  left join public.mission_progress mp
    on mp.student_id = cand.id and mp.mission_id = p_mission_id
  left join public.mission_skips sk
    on sk.student_id = cand.id and sk.mission_id = p_mission_id
  left join public.profiles pr on pr.student_id = cand.id
  order by cand.nickname;
$$;

/** ผู้ขอยกเลิกคำขอของตัวเอง — ยกเลิกใบของคนอื่นไม่ได้ (requester_id อยู่ในเงื่อนไข UPDATE) */
create or replace function public.cancel_buddy_request(
  p_student_id uuid,
  p_request_id uuid
)
returns setof public.buddy_requests
language plpgsql
as $$
declare
  v_request public.buddy_requests;
begin
  update public.buddy_requests r
     set status      = 'cancelled',
         resolved_at = now()
   where r.id = p_request_id
     and r.requester_id = p_student_id
     and r.status in ('searching', 'pending', 'accepted')
  returning r.* into v_request;

  if not found then
    return;
  end if;

  -- ใบที่ยิงไปหาเพื่อนแล้วแต่ยังไม่ตอบ ต้องเก็บกวาดด้วย ไม่งั้นแผ่นคำขอค้างบนจอเพื่อน
  update public.buddy_offers o
     set status       = 'expired',
         responded_at = now()
   where o.request_id = v_request.id and o.status = 'pending';

  return next v_request;
end;
$$;

/** คำขอที่ยังหาเพื่อนไม่ได้ในห้องนี้ — ครูดูได้เฉพาะห้องตัวเอง (ตรวจในคิวรีเดียวกับที่อ่าน) */
create or replace function public.classroom_open_buddy_requests(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (
  id            uuid,
  requester_id  uuid,
  requester     text,
  helper_id     uuid,
  helper        text,
  mission_id    text,
  kind          text,
  status        text,
  attempts      smallint,
  waiting_seconds integer,
  created_at    timestamptz
)
language sql
stable
as $$
  select r.id, r.requester_id, req.nickname, r.helper_id, hlp.nickname,
         r.mission_id, r.kind, r.status, r.attempts,
         greatest(0, extract(epoch from now() - r.created_at))::integer,
         r.created_at
  from public.buddy_requests r
  join public.students req on req.id = r.requester_id
  left join public.students hlp on hlp.id = r.helper_id
  join public.classrooms c on c.id = r.classroom_id
  where r.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
    and r.status in ('searching', 'pending', 'accepted')
  order by r.created_at;
$$;

/** ใครช่วยเพื่อนไปกี่ครั้งในห้องนี้ — core ใช้กระจายภาระ ครูใช้ดูว่าใครแบกเยอะ */
create or replace function public.classroom_buddy_helped_counts(
  p_classroom_id uuid
)
returns table (student_id uuid, nickname text, helped_count integer, helping_now integer)
language sql
stable
as $$
  select st.id, st.nickname, coalesce(st.buddy_helped_count, 0),
         (select count(*)::integer from public.buddy_requests br
           where br.helper_id = st.id and br.status = 'accepted')
  from public.students st
  where st.classroom_id = p_classroom_id
  order by coalesce(st.buddy_helped_count, 0) desc, st.nickname;
$$;

-- ═════════════════════════ 4) T-01 ครูสมัครเอง + ลืมรหัส

/**
 * โทเคนรีเซ็ตรหัสผ่านของครู
 *
 * ⚠️ **เก็บเฉพาะแฮชของโทเคน** ตัวโทเคนจริงคืนให้ผู้เรียกครั้งเดียวตอนออก แล้วไม่มีที่ไหนเก็บอีก
 *    ฐานข้อมูลรั่ว = เอาโทเคนไปใช้ไม่ได้ (เหมือนกับที่รหัสผ่านอยู่ใน auth ของ Supabase ไม่ใช่ที่เรา)
 * ⚠️ รหัสผ่านดิบไม่เคยผ่านตารางนี้ และไม่มีคอลัมน์ไหนในฐานข้อมูลนี้เก็บรหัสผ่านเลย
 */
create table public.teacher_password_resets (
  id         uuid        primary key default gen_random_uuid(),
  teacher_id uuid        not null references public.teachers (id) on delete cascade,
  /** sha256 ของโทเคน (hex) — ไม่ใช่ตัวโทเคน */
  token_hash text        not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index teacher_password_resets_teacher_idx
  on public.teacher_password_resets (teacher_id, created_at desc);

alter table public.teacher_password_resets enable row level security;
-- ไม่มี policy ให้ใครเลย — แตะได้เฉพาะ service_role ที่ข้าม RLS (ตั้งใจ)

/**
 * ออกโทเคนรีเซ็ตให้อีเมลนี้ · คืน 0 แถวถ้าไม่มีครูคนนี้
 *   ผู้เรียกต้องตอบผู้ใช้ด้วยข้อความเดียวกันทั้งสองกรณี ห้ามบอกว่าอีเมลมีอยู่จริงไหม
 * ใบเก่าที่ยังไม่ถูกใช้ถูกปิดทิ้งก่อน — ขอใหม่แล้วใบเก่าต้องใช้ไม่ได้
 */
create or replace function public.issue_teacher_password_reset(
  p_email       text,
  p_ttl_minutes integer default 30
)
returns table (token text, expires_at timestamptz, teacher_id uuid)
language plpgsql
as $$
declare
  v_teacher uuid;
  v_token   text;
  v_expires timestamptz;
begin
  select t.id into v_teacher from public.teachers t
   where lower(t.email) = lower(trim(p_email));

  if v_teacher is null then
    return;
  end if;

  update public.teacher_password_resets r
     set used_at = now()
   where r.teacher_id = v_teacher and r.used_at is null;

  v_token   := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(mins => greatest(1, p_ttl_minutes));

  insert into public.teacher_password_resets (teacher_id, token_hash, expires_at)
  values (v_teacher, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires);

  return query select v_token, v_expires, v_teacher;
end;
$$;

/** ตรวจว่าโทเคนยังใช้ได้ไหม (ไม่กินโทเคน) — ใช้ตอนเปิดหน้าตั้งรหัสใหม่ */
create or replace function public.verify_teacher_password_reset(p_token text)
returns table (teacher_id uuid, email text, expires_at timestamptz)
language sql
stable
as $$
  select r.teacher_id, t.email, r.expires_at
  from public.teacher_password_resets r
  join public.teachers t on t.id = r.teacher_id
  where r.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and r.used_at is null
    and r.expires_at > now();
$$;

/**
 * กินโทเคน — คืนครูเจ้าของแล้วปิดใบทันทีในคำสั่งเดียว
 * **ใช้ได้ครั้งเดียวจริง** เพราะ `used_at is null` อยู่ในเงื่อนไขของ UPDATE เอง
 * สองคำขอยิงพร้อมกันจะมีแค่ใบเดียวที่ได้แถวกลับไป
 */
create or replace function public.consume_teacher_password_reset(p_token text)
returns table (teacher_id uuid, email text)
language sql
as $$
  with used as (
    update public.teacher_password_resets r
       set used_at = now()
     where r.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and r.used_at is null
       and r.expires_at > now()
    returning r.teacher_id
  )
  select u.teacher_id, t.email
  from used u join public.teachers t on t.id = u.teacher_id;
$$;

/** ลบใบที่หมดอายุหรือถูกใช้ไปแล้วเกินกำหนด — เรียกรวมกับงานเก็บกวาดอื่น */
create or replace function public.purge_teacher_password_resets(p_older_than_hours integer default 24)
returns integer
language sql
as $$
  with gone as (
    delete from public.teacher_password_resets r
     where r.created_at < now() - make_interval(hours => p_older_than_hours)
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.buddy_candidates_raw(uuid, text)                  from anon, public;
revoke execute on function public.cancel_buddy_request(uuid, uuid)                  from anon, public;
revoke execute on function public.classroom_open_buddy_requests(uuid, uuid)         from anon, public;
revoke execute on function public.classroom_buddy_helped_counts(uuid)               from anon, public;
revoke execute on function public.issue_teacher_password_reset(text, integer)       from anon, public;
revoke execute on function public.verify_teacher_password_reset(text)               from anon, public;
revoke execute on function public.consume_teacher_password_reset(text)              from anon, public;
revoke execute on function public.purge_teacher_password_resets(integer)            from anon, public;
revoke execute on function public.enforce_home_deadline_peer_feedback()             from anon, public;

grant execute on function public.buddy_candidates_raw(uuid, text)                   to service_role;
grant execute on function public.cancel_buddy_request(uuid, uuid)                   to service_role;
grant execute on function public.classroom_open_buddy_requests(uuid, uuid)          to service_role;
grant execute on function public.classroom_buddy_helped_counts(uuid)                to service_role;
grant execute on function public.issue_teacher_password_reset(text, integer)        to service_role;
grant execute on function public.verify_teacher_password_reset(text)                to service_role;
grant execute on function public.consume_teacher_password_reset(text)               to service_role;
grant execute on function public.purge_teacher_password_resets(integer)             to service_role;

-- ── ฟังก์ชันเดิมที่ต้องเขียนทับ (คัดตัวเดิมมาทั้งก้อน แก้เฉพาะบรรทัดที่หมายเหตุ T54 ไว้) ──

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
                                  when p_timer_seconds is not null
                                    then now() + make_interval(secs => p_timer_seconds)
                                  -- T54: ไม่ส่งวินาทีมา + ครูตั้งแผนเวลาเองแล้ว = หยิบนาทีของช่วงนั้นจากแผน
                                  -- ห้องที่ยังไม่เคยตั้ง (phase_minutes_custom = false) ตกไป else null เหมือนเดิมเป๊ะ
                                  when s.phase_minutes_custom
                                       and (s.phase_minutes ? p_phase)
                                       and coalesce((s.phase_minutes ->> p_phase)::numeric, 0) > 0
                                    then now() + make_interval(
                                           mins => (s.phase_minutes ->> p_phase)::numeric::integer)
                                  else null
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
         -- T54: ครูแตะเวลาเมื่อไหร่ ห้องนี้เลิกเป็นห้องค่าตั้งต้นทันที
         phase_minutes_custom = s.phase_minutes_custom
                                or p_class_minutes is not null or p_phase_minutes is not null,
         updated_at          = now()
   where s.id = v_row.id
  returning * into v_row;

  return next v_row;
end;
$$;

  -- T54: รวมดาวใหม่จากของที่มีอยู่แล้ว ไม่ใช่คำตอบใหม่ จึงต้องทำได้แม้เลยวันหมดเขต
  select set_config('app.teacher_write', 'on', true);
create or replace function public.recalc_student_stars(p_student_id uuid)
returns setof public.profiles
language sql
as $$
  insert into public.profiles (student_id, earned_stars, updated_at)
  select
    p_student_id,
    least(
      coalesce((select sum(mp.stars) from public.mission_progress mp where mp.student_id = p_student_id), 0),
      15
    ),
    now()
  on conflict (student_id) do update
    set earned_stars = excluded.earned_stars,
        updated_at   = now()
  returning *;
$$;

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
  -- T54: ครูแก้แผนรายคนได้แม้เลยวันหมดเขต (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
  -- T54: ครูแก้แผนรายคนได้แม้เลยวันหมดเขต (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
  -- T54: ครูแก้แผนรายคนได้แม้เลยวันหมดเขต (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);
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
