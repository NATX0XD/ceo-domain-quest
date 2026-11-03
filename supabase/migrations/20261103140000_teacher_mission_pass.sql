-- Teacher presentation skips are additive, reversible state overlays.
-- They deliberately reuse mission_progress.passed_at so every existing unlock
-- and progress reader sees the same result as a real pass.

create table public.mission_pass_overrides (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  teacher_id    uuid not null references public.teachers (id) on delete cascade,
  mission_id    text not null check (mission_id in ('m1', 'm2', 'm3', 'm4', 'boss')),
  source        text not null default 'teacher-skip' check (source = 'teacher-skip'),
  before_value  jsonb,
  after_value   jsonb not null,
  created_at    timestamptz not null default now(),
  undone_at     timestamptz
);

create unique index mission_pass_overrides_active_idx
  on public.mission_pass_overrides (student_id, mission_id)
  where undone_at is null;
create index mission_pass_overrides_student_idx
  on public.mission_pass_overrides (student_id, created_at desc);

alter table public.mission_pass_overrides enable row level security;

create policy mission_pass_overrides_owner on public.mission_pass_overrides
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

comment on table public.mission_pass_overrides is
  'Reversible teacher-skip pass overlays. A live row means the student is passed for presentation only.';
comment on column public.mission_pass_overrides.source is
  'Audit source; teacher-skip is intentionally distinct from a real student pass.';

create or replace function public.teacher_set_mission_pass(
  p_teacher_id uuid,
  p_student_id uuid,
  p_mission_id text,
  p_action text
)
returns jsonb
language plpgsql
as $$
declare
  v_override public.mission_pass_overrides;
  v_progress public.mission_progress;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := now();
  v_status text;
begin
  if p_mission_id not in ('m1', 'm2', 'm3', 'm4', 'boss') then
    raise exception 'mission_id ไม่ถูกต้อง';
  end if;
  if p_action not in ('pass', 'undo') then
    raise exception 'action ไม่ถูกต้อง';
  end if;
  if not public.teacher_owns_student(p_teacher_id, p_student_id) then
    return null;
  end if;

  select * into v_override
  from public.mission_pass_overrides
  where student_id = p_student_id
    and mission_id = p_mission_id
    and undone_at is null
  for update;

  select * into v_progress
  from public.mission_progress
  where student_id = p_student_id and mission_id = p_mission_id
  for update;

  if p_action = 'undo' then
    if v_override.id is null then
      return jsonb_build_object(
        'status', 'no-active-override',
        'changed', false,
        'source', 'teacher-skip',
        'progress', case when v_progress.id is null then null else to_jsonb(v_progress) end
      );
    end if;

    v_after := v_override.after_value;
    -- Restore only when no later write changed the pass overlay. A real pass
    -- made after the skip changes this snapshot and is therefore preserved.
    if v_progress.id is not null and to_jsonb(jsonb_build_object(
      'attempts', v_progress.attempts,
      'hints_used', v_progress.hints_used,
      'stars', v_progress.stars,
      'passed_at', v_progress.passed_at,
      'channel_used', v_progress.channel_used,
      'started_at', v_progress.started_at,
      'skipped_by', v_progress.skipped_by
    )) = v_after then
      if v_override.before_value is null then
        delete from public.mission_progress where id = v_progress.id;
        v_progress := null;
      else
        update public.mission_progress
           set attempts = coalesce((v_override.before_value->>'attempts')::integer, 0),
               hints_used = coalesce((v_override.before_value->>'hints_used')::integer, 0),
               stars = coalesce((v_override.before_value->>'stars')::smallint, 0),
               passed_at = (v_override.before_value->>'passed_at')::timestamptz,
               channel_used = v_override.before_value->>'channel_used',
               started_at = (v_override.before_value->>'started_at')::timestamptz,
               skipped_by = v_override.before_value->>'skipped_by',
               updated_at = v_now
         where id = v_progress.id
         returning * into v_progress;
      end if;
      v_status := 'undone';
    else
      v_status := 'real-pass-preserved';
    end if;

    update public.mission_pass_overrides
       set undone_at = v_now
     where id = v_override.id;
    perform public.recalc_student_stars(p_student_id);
    return jsonb_build_object(
      'status', v_status,
      'changed', true,
      'source', 'teacher-skip',
      'overrideId', v_override.id,
      'progress', case when v_progress.id is null then null else to_jsonb(v_progress) end
    );
  end if;

  -- A real pass is authoritative. Do not create an overlay or lower its stars.
  if v_override.id is null and v_progress.passed_at is not null then
    return jsonb_build_object(
      'status', 'real-pass-preserved',
      'changed', false,
      'source', 'teacher-skip',
      'progress', to_jsonb(v_progress)
    );
  end if;

  if v_override.id is not null then
    return jsonb_build_object(
      'status', 'already-passed-by-teacher',
      'changed', false,
      'source', 'teacher-skip',
      'overrideId', v_override.id,
      'progress', case when v_progress.id is null then null else to_jsonb(v_progress) end
    );
  end if;

  if v_progress.id is null then
    -- Minimum pass stars for a skipped mission are 1 by design.
    insert into public.mission_progress (
      student_id, mission_id, stars, passed_at, attempts, hints_used, updated_at
    ) values (
      p_student_id, p_mission_id, 1, v_now, 0, 0, v_now
    ) returning * into v_progress;
    v_before := null;
  else
    v_before := jsonb_build_object(
      'attempts', v_progress.attempts,
      'hints_used', v_progress.hints_used,
      'stars', v_progress.stars,
      'passed_at', v_progress.passed_at,
      'channel_used', v_progress.channel_used,
      'started_at', v_progress.started_at,
      'skipped_by', v_progress.skipped_by
    );
    update public.mission_progress
       set stars = greatest(stars, 1),
           passed_at = coalesce(passed_at, v_now),
           skipped_by = null,
           updated_at = v_now
     where id = v_progress.id
     returning * into v_progress;
  end if;

  v_after := jsonb_build_object(
    'attempts', v_progress.attempts,
    'hints_used', v_progress.hints_used,
    'stars', v_progress.stars,
    'passed_at', v_progress.passed_at,
    'channel_used', v_progress.channel_used,
    'started_at', v_progress.started_at,
    'skipped_by', v_progress.skipped_by
  );
  insert into public.mission_pass_overrides (
    student_id, teacher_id, mission_id, source, before_value, after_value, created_at
  ) values (
    p_student_id, p_teacher_id, p_mission_id, 'teacher-skip', v_before, v_after, v_now
  ) returning * into v_override;

  perform public.recalc_student_stars(p_student_id);
  return jsonb_build_object(
    'status', 'passed-by-teacher',
    'changed', true,
    'source', 'teacher-skip',
    'overrideId', v_override.id,
    'progress', to_jsonb(v_progress)
  );
end;
$$;

revoke execute on function public.teacher_set_mission_pass(uuid, uuid, text, text) from anon, public;
grant execute on function public.teacher_set_mission_pass(uuid, uuid, text, text) to service_role;
