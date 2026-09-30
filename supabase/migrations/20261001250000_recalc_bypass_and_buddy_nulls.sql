-- T54 ต่อ — แก้ของที่การทดสอบจับได้
--
--   1) recalc_student_stars ยังโดนประตูวันหมดเขตกั้นอยู่ (แพตช์รอบก่อนใส่บรรทัดผิดที่)
--      ผลคือหลังหมดเขต ครูสั่ง "ให้ผ่าน" แล้วดาวรวมไม่ถูกคิดใหม่ — ต้องคิดได้ เพราะเป็นการรวมของเดิม
--      ไม่ใช่คำตอบใหม่ของนักเรียน
--   2) buddy_candidates_raw คืน null ใน likes_talking / accepting_requests เมื่อเพื่อนยังไม่มีแถว profiles
--      core/buddy.ts รับ boolean จึงต้อง coalesce ให้ที่ SQL

create or replace function public.recalc_student_stars(p_student_id uuid)
returns setof public.profiles
language sql
as $$
  -- รวมดาวใหม่จากของที่มีอยู่แล้ว ไม่ใช่คำตอบใหม่ จึงต้องทำได้แม้เลยวันหมดเขต
  select set_config('app.teacher_write', 'on', true);

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

comment on function public.recalc_student_stars(uuid) is
  'รวมดาวจาก mission_progress (m1-m4 + boss) ใหม่ทั้งหมดแล้วเขียนลง profiles.earned_stars · เพดาน 15 '
  '· ข้ามประตูวันหมดเขตได้เพราะเป็นการคิดใหม่จากของเดิม ไม่ใช่คำตอบใหม่';

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
         coalesce(cand.accepts_buddy_requests, true),
         (select count(*)::integer from public.buddy_requests br
           where br.helper_id = cand.id and br.status = 'accepted'),
         coalesce(cand.buddy_helped_count, 0),
         -- ยังไม่มีแถว profiles = ยังไม่ได้เลือกช่องทาง ถือว่าไม่ได้ชอบเรียนกับเพื่อนเป็นพิเศษ
         coalesce(pr.learning_route = 'buddy', false),
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

revoke execute on function public.recalc_student_stars(uuid)      from anon, public;
revoke execute on function public.buddy_candidates_raw(uuid, text) from anon, public;
grant  execute on function public.recalc_student_stars(uuid)       to service_role;
grant  execute on function public.buddy_candidates_raw(uuid, text) to service_role;
