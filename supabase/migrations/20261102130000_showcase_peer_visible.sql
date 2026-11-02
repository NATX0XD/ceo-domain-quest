-- Teacher override for the peer showcase wall, per submission.
--   null  = automatic (content filter decides; flagged works stay hidden from peers)
--   true  = teacher approved: show to classmates even if flagged
--   false = teacher hid it from classmates
alter table public.submissions add column if not exists peer_visible boolean;

-- classroom_showcase now also returns the override so the API can enforce it.
-- Return type changes, so drop + recreate (same args, same grants).
drop function if exists public.classroom_showcase(uuid, uuid);
create function public.classroom_showcase(
  p_classroom_id uuid,
  p_student_id   uuid
)
returns table (
  nickname     text,
  domain_name  text,
  tld          text,
  reason_text  text,
  peer_visible boolean
)
language sql
stable
as $$
  select st.nickname, sub.domain_name, sub.tld, sub.reason_text, sub.peer_visible
  from public.students st
  join public.submissions sub on sub.student_id = st.id
  where st.classroom_id = p_classroom_id
    and exists (
      select 1 from public.students me
      where me.id = p_student_id
        and me.classroom_id = p_classroom_id
    )
  order by st.nickname, sub.created_at;
$$;

-- Teacher sets the override (null = back to automatic). Only for submissions in the teacher's rooms.
create or replace function public.teacher_set_peer_visible(
  p_teacher_id    uuid,
  p_submission_id uuid,
  p_visible       boolean
)
returns setof public.submissions
language sql
as $$
  update public.submissions s
     set peer_visible = p_visible,
         updated_at   = now()
   where s.id = p_submission_id
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = s.student_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

revoke execute on function public.classroom_showcase(uuid, uuid)                from anon, public;
revoke execute on function public.teacher_set_peer_visible(uuid, uuid, boolean) from anon, public;
grant execute on function public.classroom_showcase(uuid, uuid)                 to service_role;
grant execute on function public.teacher_set_peer_visible(uuid, uuid, boolean)  to service_role;
