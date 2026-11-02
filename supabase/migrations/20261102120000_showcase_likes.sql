-- Peer showcase gallery: one "heart" per viewer per friend's work, plus the
-- per-card counts (hearts + visible compliments) the gallery shows.
-- No ranking: the API keeps the nickname order from classroom_showcase.

create table if not exists public.showcase_likes (
  from_student_id uuid        not null references public.students (id) on delete cascade,
  to_student_id   uuid        not null references public.students (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (from_student_id, to_student_id),
  check (from_student_id <> to_student_id)
);

create index if not exists showcase_likes_to_idx on public.showcase_likes (to_student_id);

alter table public.showcase_likes enable row level security;

drop policy if exists showcase_likes_owner on public.showcase_likes;
create policy showcase_likes_owner on public.showcase_likes
  for all to authenticated
  using (public.owns_student(from_student_id) or public.owns_student(to_student_id))
  with check (public.owns_student(from_student_id) and public.owns_student(to_student_id));

-- Toggle a heart. Both students must share a classroom (checked in one statement).
-- Returns the friend's heart count after the change; empty set = not allowed.
create or replace function public.set_showcase_like(
  p_from_student_id uuid,
  p_to_student_id   uuid,
  p_liked           boolean
)
returns table (likes integer, liked boolean)
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.students a
    join public.students b on b.classroom_id = a.classroom_id
    where a.id = p_from_student_id
      and b.id = p_to_student_id
      and a.id <> b.id
  ) then
    return;
  end if;

  if p_liked then
    insert into public.showcase_likes (from_student_id, to_student_id)
    values (p_from_student_id, p_to_student_id)
    on conflict do nothing;
  else
    delete from public.showcase_likes
    where from_student_id = p_from_student_id
      and to_student_id = p_to_student_id;
  end if;

  return query
    select (select count(*)::integer from public.showcase_likes l where l.to_student_id = p_to_student_id),
           exists (
             select 1 from public.showcase_likes l
             where l.from_student_id = p_from_student_id and l.to_student_id = p_to_student_id
           );
end;
$$;

-- Per-student card extras for one classroom. p_student_id must be in the room
-- (outsiders get nothing); liked_by_me is relative to that student.
create or replace function public.classroom_showcase_extras(
  p_classroom_id uuid,
  p_student_id   uuid
)
returns table (
  nickname      text,
  business_name text,
  business_type text,
  likes         integer,
  liked_by_me   boolean,
  praises       integer
)
language sql
stable
as $$
  select st.nickname,
         pr.business_name,
         pr.business_type,
         (select count(*)::integer from public.showcase_likes l where l.to_student_id = st.id),
         exists (
           select 1 from public.showcase_likes l
           where l.to_student_id = st.id and l.from_student_id = p_student_id
         ),
         (select count(*)::integer from public.peer_feedback f
           where f.to_student_id = st.id and f.hidden_at is null)
  from public.students st
  left join public.profiles pr on pr.student_id = st.id
  where st.classroom_id = p_classroom_id
    and exists (
      select 1 from public.students me
      where me.id = p_student_id and me.classroom_id = p_classroom_id
    );
$$;

-- Teacher view: heart counts for a classroom the teacher owns.
create or replace function public.teacher_showcase_likes(
  p_teacher_id   uuid,
  p_classroom_id uuid
)
returns table (nickname text, likes integer)
language sql
stable
as $$
  select st.nickname,
         (select count(*)::integer from public.showcase_likes l where l.to_student_id = st.id)
  from public.students st
  join public.classrooms c on c.id = st.classroom_id
  where st.classroom_id = p_classroom_id
    and c.teacher_id = p_teacher_id;
$$;

revoke all on public.showcase_likes from anon;
revoke execute on function public.set_showcase_like(uuid, uuid, boolean)     from anon, public;
revoke execute on function public.classroom_showcase_extras(uuid, uuid)      from anon, public;
revoke execute on function public.teacher_showcase_likes(uuid, uuid)         from anon, public;

grant execute on function public.set_showcase_like(uuid, uuid, boolean)      to service_role;
grant execute on function public.classroom_showcase_extras(uuid, uuid)       to service_role;
grant execute on function public.teacher_showcase_likes(uuid, uuid)          to service_role;
