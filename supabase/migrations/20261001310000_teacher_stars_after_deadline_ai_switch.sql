-- T79 — ปิดรูที่ทำให้ "ประตูวันหมดเขต" กันของที่ไม่ควรกัน (REVIEW-8 H-1 · H-2) และเปิดทาง
-- ให้สวิตช์ปิด AI ของครูอ่านได้จริง (H-3)
--
-- เจตนาเดิมของ migration 20261001220000 เขียนไว้เองว่า "ครูยังทำงานต่อได้หลังหมดเขต
-- (ตรวจงาน ยืนยันคะแนน สั่งข้าม)" และข้อความในตัว trigger เขียนว่า "(ย้อนดูของเดิมได้)"
-- ทั้งสองอย่างไม่จริงตามโค้ดปัจจุบัน:
--
--   H-1 ครูกดยืนยันคะแนน → confirm_submission_scores ผ่าน แต่บรรทัดถัดมาเขียนดาวด่านบอสลง
--       mission_progress ตรง ๆ ผ่าน service client ซึ่งไม่มีธง app.teacher_write → trigger ตีกลับ
--       → ใบนั้นค้าง pending-teacher ตลอดไป
--   H-2 เด็กเปิด /home /result → เส้นทางอ่านแตะ mission_progress (สร้างแถวเปล่าของภารกิจที่เพิ่งเปิด
--       และซิงก์ดาว) → ตีกลับเหมือนกัน → Server Component โยน → หน้าพัง 500 ทุกครั้งที่เปิด
--
-- ทางแก้ที่นี่คือ **แยก "คำตอบใหม่ของนักเรียน" ออกจาก "การจัดบ้านของระบบ/ครู"** ให้ชัดที่ฐานข้อมูล
-- ไม่ใช่ปลดล็อกประตูทิ้ง: คำตอบใหม่ของนักเรียนยังเขียนไม่ได้เหมือนเดิมทุกทาง

-- ───────────────────────────────────────────── 1) ประตูหมดเขตของ mission_progress

/**
 * ประตูหมดเขตเฉพาะของ mission_progress
 *
 * เดิมใช้ `enforce_home_deadline()` ตัวรวมซึ่งตีกลับ **ทุกแถว ทุกคอลัมน์** รวมถึง
 *   - แถวเปล่าที่เกิดตอนเด็ก "เปิดดู" ภารกิจที่ไม่เคยเปิด (attempts/hints/stars = 0, ยังไม่ผ่าน)
 *   - การอัปเดตที่ไม่ได้แตะความคืบหน้าเลย (แตะแค่ updated_at)
 * ทั้งสองอย่างไม่ใช่ "บันทึกคำตอบใหม่" จึงต้องผ่านได้ ไม่งั้นคำว่า "ย้อนดูของเดิมได้" ไม่จริง
 *
 * ที่ยังกั้นเหมือนเดิม: attempts · hints_used · stars · passed_at · channel_used เปลี่ยนค่า
 * = เด็กตอบ/ขอคำใบ้/ผ่านด่านหลังหมดเขต → ตีกลับ (record_mission_attempt ก็ยังโดนกั้น)
 * ฝั่งครูข้ามได้ทางเดียวคือธง app.teacher_write ซึ่งตั้งได้เฉพาะในฟังก์ชันฝั่งครู
 */
create or replace function public.enforce_home_deadline_mission_progress()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.teacher_write', true), '') = 'on' then
    return new;
  end if;

  -- เปิดหน้าภารกิจเฉย ๆ ยังไม่ได้ตอบอะไร = ไม่ใช่คำตอบใหม่
  if tg_op = 'INSERT'
     and coalesce(new.attempts, 0)    = 0
     and coalesce(new.hints_used, 0)  = 0
     and coalesce(new.stars, 0)       = 0
     and new.passed_at is null then
    return new;
  end if;

  -- อัปเดตที่ไม่ได้แตะความคืบหน้าเลย (เช่นเขียนทับค่าเดิม) = ไม่ใช่คำตอบใหม่
  if tg_op = 'UPDATE'
     and new.attempts     is not distinct from old.attempts
     and new.hints_used   is not distinct from old.hints_used
     and new.stars        is not distinct from old.stars
     and new.passed_at    is not distinct from old.passed_at
     and new.channel_used is not distinct from old.channel_used then
    return new;
  end if;

  if public.home_write_blocked(new.student_id) then
    raise exception 'หมดเขตทำต่อที่บ้านแล้ว บันทึกคำตอบใหม่ไม่ได้ (ย้อนดูของเดิมได้)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists mission_progress_home_deadline on public.mission_progress;

create trigger mission_progress_home_deadline
  before insert or update on public.mission_progress
  for each row execute function public.enforce_home_deadline_mission_progress();

-- ───────────────────────────────────────────── 2) ครูเขียนดาวด่านบอสได้หลังหมดเขต

/**
 * ครูตั้งดาวของภารกิจหนึ่งแล้วคิดดาวรวมใหม่ให้ในธุรกรรมเดียว (H-1)
 *
 * มีไว้แทนการ upsert ตาราง mission_progress ตรง ๆ จากฝั่งเว็บ ซึ่ง
 *   1. ไม่มีธง app.teacher_write จึงพังทันทีหลังหมดเขต
 *   2. ไม่ได้ตรวจว่านักเรียนคนนี้อยู่ห้องของครูคนนี้จริง (service_role ข้าม RLS)
 * การตรวจเจ้าของอยู่ในฟังก์ชันเดียวกับการเขียน ไม่ใช่คิวรีแยก
 *
 * ครูไม่ใช่เจ้าของ → คืน 0 แถว (เว็บแปลงเป็น 404 ไม่บอกว่ามีนักเรียนคนนี้อยู่จริงไหม)
 */
create or replace function public.teacher_set_mission_stars(
  p_teacher_id uuid,
  p_student_id uuid,
  p_mission_id text,
  p_stars      smallint
)
returns setof public.profiles
language plpgsql
as $$
begin
  -- ครูทำงานต่อได้หลังหมดเขตทำต่อที่บ้าน (ธงหมดอายุเมื่อจบธุรกรรม)
  perform set_config('app.teacher_write', 'on', true);

  if p_stars is null or p_stars < 0 or p_stars > 15 then
    raise exception 'จำนวนดาวต้องอยู่ระหว่าง 0 ถึง 15 (ได้มา %)', p_stars
      using errcode = 'invalid_parameter_value';
  end if;

  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return;
  end if;

  insert into public.mission_progress (student_id, mission_id, stars, attempts, hints_used, updated_at)
  values (p_student_id, p_mission_id, p_stars, 0, 0, now())
  on conflict (student_id, mission_id) do update
    set stars      = p_stars,
        updated_at = now();

  -- ดาวรวมต้องคิดใหม่ในคำขอเดียวกัน ไม่งั้นแผงครูกับจอเด็กเห็นคนละเลข (QA-1 พัง-1)
  return query select * from public.recalc_student_stars(p_student_id);
end;
$$;

comment on function public.teacher_set_mission_stars(uuid, uuid, text, smallint) is
  'ครูตั้งดาวภารกิจ (ปกติคือแถว boss ตอนยืนยันคะแนน) แล้วคิด profiles.earned_stars ใหม่ '
  '· ตรวจเจ้าของห้องในฟังก์ชันเดียวกับที่เขียน · ทำได้แม้เลยวันหมดเขตทำต่อที่บ้าน';

-- ───────────────────────────────────────────── 3) สวิตช์ปิด AI ของครู (H-3)

/**
 * ห้องของนักเรียนคนนี้เปิดให้ใช้ AI อยู่ไหม
 *
 * `class_sessions.ai_enabled` เขียนได้มาตั้งแต่ migration 20261001000000 แต่ไม่เคยมีใครอ่าน
 * (REVIEW-8 H-3) ครูกดปิดแล้วระบบยังเรียกโมเดลต่อทั้งห้อง
 *
 * ค่าตั้งต้นคือ **เปิด**: ไม่มีคาบเดินอยู่ หรือไม่รู้จักนักเรียนคนนี้ = true
 * เพราะทางที่ปลอดภัยกว่าคือเดินเส้นทางปกติ แล้วตกไป fallback ตามเงื่อนไขเดิมของ lib/ai
 * ครูกดปิดเมื่อไรจึงจะ false และทุกจุดที่เรียก AI ต้องตกไปใช้กฎล้วนทันที
 */
create or replace function public.session_ai_enabled(p_student_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select s.ai_enabled
      from public.students st
      join public.class_sessions s
        on s.classroom_id = st.classroom_id and s.ended_at is null
      where st.id = p_student_id
      order by s.started_at desc
      limit 1
    ),
    true
  );
$$;

comment on function public.session_ai_enabled(uuid) is
  'ครูเปิด/ปิด AI ของคาบนี้ไว้ไหม · ไม่มีคาบเดินอยู่ = เปิด (ค่าตั้งต้น) '
  '· จุดที่เรียก AI ทุกจุดต้องถามตัวนี้ก่อน ปิดแล้วต้องตกไปใช้กฎล้วน';

-- ───────────────────────────────────────────── สิทธิ์

revoke execute on function public.enforce_home_deadline_mission_progress()                from anon, public;
revoke execute on function public.teacher_set_mission_stars(uuid, uuid, text, smallint)   from anon, authenticated, public;
revoke execute on function public.session_ai_enabled(uuid)                                from anon, public;

grant  execute on function public.teacher_set_mission_stars(uuid, uuid, text, smallint)   to service_role;
grant  execute on function public.session_ai_enabled(uuid)                                to service_role;
