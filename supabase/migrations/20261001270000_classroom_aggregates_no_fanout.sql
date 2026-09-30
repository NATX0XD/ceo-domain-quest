-- ============================================================================
-- รวมตัวเลขของห้องให้จบใน SQL คิวรีเดียว (T62)
--
-- อาการที่เจอจริง: ห้อง QUEST9 มี 277 คน แล้ว
--   GET /api/teacher/screen    -> 500  "classroomScreenStats(passed): "   (PostgREST ตอบ 414 ตัวเปล่า)
--   GET /api/teacher/showcase  -> 500  "[db] listClassroomFeedback ล้มเหลว: URI too long"
--
-- สาเหตุ: โค้ดดึง uuid ของนักเรียนทุกคนในห้องมาก่อน แล้วยัดกลับเข้า `.in('student_id', ids)`
--         supabase-js แปลงเป็น query string -> 277 x 37 ตัวอักษร ทะลุลิมิตความยาว URI ของ PostgREST
--         ห้องจริง 30-40 คนไม่เจอ แต่ห้องสาธิต/ห้องรวมเจอทุกครั้ง
--
-- ทางแก้ที่ถูก: ให้ SQL เป็นคน join เอง ฝั่งเว็บส่งไปแค่ classroom_id ตัวเดียว
--   **ไม่ใช้วิธีตัดจำนวนหรือแบ่งยิงหลายรอบ** เพราะสองวิธีนั้นทำให้ตัวเลขผิดโดยไม่มีสัญญาณเตือน
--
-- ทุกฟังก์ชันในไฟล์นี้ตรวจเจ้าของห้อง **ในคิวรีเดียวกับที่อ่านข้อมูล** ไม่ใช่คิวรีแยก
-- ครูคนอื่นขอห้องนี้ = คืน 0 แถว แล้ว route ตอบ 404
-- ============================================================================

/**
 * ตัวเลขรวมของจอหน้าห้อง (T-04) — แทน components/server/classroom-screen.ts ที่ยิง .in(ids)
 *
 * ⚠️ เป็น **ภาพรวมของห้องเท่านั้น** ไม่มีชื่อคนคู่กับดาว/คะแนน/สถานะรายคน (สเปก T-04 ห้ามมีกระดานจัดอันดับ)
 *   joined          = จำนวนคนที่เข้าห้องแล้ว
 *   missions_passed = จำนวน "ภารกิจที่ผ่าน" รวมทั้งห้อง (ไม่ใช่จำนวนคน จะได้ดูไม่ออกว่าใครยังไม่ขยับ)
 *   submitted       = จำนวนใบเสนอของภารกิจใหญ่ที่ส่งเข้ามาแล้ว
 */
create or replace function public.classroom_screen_stats(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (
  joined          integer,
  missions_passed integer,
  submitted       integer
)
language sql
stable
as $$
  select
    (select count(*) from public.students st where st.classroom_id = c.id)::integer,
    (select count(*)
       from public.mission_progress mp
       join public.students st on st.id = mp.student_id
      where st.classroom_id = c.id
        and mp.passed_at is not null)::integer,
    (select count(*)
       from public.submissions s
       join public.students st on st.id = s.student_id
      where st.classroom_id = c.id
        and s.emphasis_criterion is not null)::integer
  from public.classrooms c
  where c.id = p_classroom_id
    and c.teacher_id = p_teacher_id;
$$;

/**
 * ความเห็นจากเพื่อนทั้งห้องพร้อมสถานะซ่อน (T-09) — แทน `.in('to_student_id', ids)`
 *
 * ⚠️ คืนข้อความต้นฉบับครบ **ไม่ลบอะไรทิ้ง** ที่ซ่อนไว้ยังมี hidden_at ติดมาให้ครูเห็นว่าซ่อนแล้ว
 * ใช้ index peer_feedback_to_idx (to_student_id, created_at desc) ผ่านการ join กับ students
 */
create or replace function public.classroom_peer_feedback(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns setof public.peer_feedback
language sql
stable
as $$
  select f.*
  from public.peer_feedback f
  join public.students st on st.id = f.to_student_id
  join public.classrooms c on c.id = st.classroom_id
  where st.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
  order by f.created_at desc;
$$;

/**
 * ข้อมูลดิบสำหรับคิด E1/E2 ของทั้งห้องในคิวรีเดียว
 *
 * ของเดิม `app/api/teacher/efficiency` ยิง 3 คิวรีต่อนักเรียนหนึ่งคน (profile + mission_progress + submissions)
 * ห้อง 277 คน = 831 รอบไปกลับ วัดได้ **3,623 ms** ซึ่งเกินเกณฑ์สเปกข้อ 9.5 (แผงครูไม่เกิน 3 วินาที)
 *
 * ⚠️ **ไม่คิดสูตรที่นี่** คืนของดิบอย่างเดียว E1/E2 คิดที่ core/efficiency.ts ที่เดียวเหมือนเดิม
 * ⚠️ rubric_scores เลือกแบบเดียวกับโค้ดเดิมเป๊ะ: ใบที่มี emphasis_criterion ใบล่าสุดตาม created_at
 *    (ของเดิมคือ listSubmissions() เรียง created_at desc แล้ว .find(emphasis_criterion !== null))
 * ⚠️ missions ตัด 'boss' ออกแล้ว เพราะด่านบอสคิดจากรูบริก ไม่ใช่จากดาว กันนับซ้ำ
 */
create or replace function public.classroom_efficiency_raw(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (
  student_id      uuid,
  missions        jsonb,
  rubric_scores   jsonb,
  pre_test_score  integer,
  post_test_score integer
)
language sql
stable
as $$
  select
    st.id,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'missionId', mp.mission_id,
        'stars',     mp.stars
      ) order by mp.mission_id), '[]'::jsonb)
      from public.mission_progress mp
      where mp.student_id = st.id and mp.mission_id <> 'boss'),
    (select s.teacher_confirmed_scores
       from public.submissions s
      where s.student_id = st.id and s.emphasis_criterion is not null
      order by s.created_at desc
      limit 1),
    p.pre_test_score,
    p.post_test_score
  from public.students st
  join public.classrooms c on c.id = st.classroom_id
  left join public.profiles p on p.student_id = st.id
  where st.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id
  order by st.nickname;
$$;

-- ─────────────────────────────────────────────────────────── สิทธิ์

revoke execute on function public.classroom_screen_stats(uuid, uuid)     from anon, public;
revoke execute on function public.classroom_peer_feedback(uuid, uuid)    from anon, public;
revoke execute on function public.classroom_efficiency_raw(uuid, uuid)   from anon, public;

grant execute on function public.classroom_screen_stats(uuid, uuid)     to service_role;
grant execute on function public.classroom_peer_feedback(uuid, uuid)    to service_role;
grant execute on function public.classroom_efficiency_raw(uuid, uuid)   to service_role;
