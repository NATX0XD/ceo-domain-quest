-- "+N นาที" after the timer already ran out used to add to the old end time,
-- so the clock stayed at 00:00. Extend from now when the end is in the past.
create or replace function public.extend_session_timer(
  p_teacher_id  uuid,
  p_session_id  uuid,
  p_add_seconds integer
)
returns setof public.class_sessions
language sql
as $$
  update public.class_sessions s
     set timer_end_at           = case
                                    when s.timer_paused_seconds is not null then s.timer_end_at
                                    else greatest(coalesce(s.timer_end_at, now()), now()) + make_interval(secs => p_add_seconds)
                                  end,
         timer_paused_seconds   = case
                                    when s.timer_paused_seconds is not null
                                      then s.timer_paused_seconds + p_add_seconds
                                    else null
                                  end,
         timer_extended_seconds = s.timer_extended_seconds + greatest(p_add_seconds, 0),
         updated_at             = now()
   where s.id = p_session_id
     and s.ended_at is null
     and p_add_seconds > 0
     and exists (
       select 1 from public.classrooms c
       where c.id = s.classroom_id and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;
