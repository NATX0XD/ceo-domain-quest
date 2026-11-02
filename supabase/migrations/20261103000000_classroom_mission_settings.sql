create table public.classroom_mission_settings (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  mission_id text not null check (mission_id in ('m1', 'm2', 'm3', 'm4', 'ceo')),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.teachers (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (classroom_id, mission_id)
);

create index classroom_mission_settings_updated_at_idx
  on public.classroom_mission_settings (updated_at desc);

alter table public.classroom_mission_settings enable row level security;

create policy classroom_mission_settings_owner on public.classroom_mission_settings
  using (public.is_classroom_owner(classroom_id))
  with check (public.is_classroom_owner(classroom_id));
