begin;

create table if not exists public.dagym_pt_schedule_events (
  id uuid primary key default gen_random_uuid(),
  center_key text not null default 'beyond-fitness',
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  source_key text not null,
  trainer_name text not null default '',
  trainer_employee_id text not null default '',
  trainer_profile_id uuid references auth.users(id) on delete set null,
  member_name_ciphertext text not null default '',
  scheduled_at timestamptz not null,
  ended_at timestamptz,
  session_type text not null default 'paid' check (session_type in ('paid', 'free', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no-show', 'postponed')),
  status_source text not null default 'dagym' check (status_source in ('dagym', 'worklog')),
  postponed_to date,
  class_label text not null default 'PT 수업',
  sync_id uuid not null default gen_random_uuid(),
  active boolean not null default true,
  source text not null default 'dagym-browser-monthly',
  source_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_key, source_key)
);

create index if not exists dagym_pt_schedule_month_idx
on public.dagym_pt_schedule_events (center_key, month_key, scheduled_at)
where active;

create index if not exists dagym_pt_schedule_trainer_idx
on public.dagym_pt_schedule_events (trainer_profile_id, scheduled_at)
where active;

alter table public.dagym_pt_schedule_events enable row level security;

drop policy if exists "dagym_pt_schedule_select_visible" on public.dagym_pt_schedule_events;
create policy "dagym_pt_schedule_select_visible"
on public.dagym_pt_schedule_events for select
to authenticated
using (trainer_profile_id = auth.uid() or public.is_profile_approver());

revoke insert, update, delete on public.dagym_pt_schedule_events from anon, authenticated;
grant select on public.dagym_pt_schedule_events to authenticated;

alter table public.dagym_pt_schedule_events add column if not exists member_name_ciphertext text not null default '';
alter table public.dagym_pt_schedule_events add column if not exists postponed_to date;
alter table public.dagym_pt_schedule_events add column if not exists status_source text not null default 'dagym';

alter table public.dagym_pt_schedule_events drop constraint if exists dagym_pt_schedule_events_status_check;
alter table public.dagym_pt_schedule_events
  add constraint dagym_pt_schedule_events_status_check
  check (status in ('scheduled', 'completed', 'cancelled', 'no-show', 'postponed'));

alter table public.dagym_pt_schedule_events drop constraint if exists dagym_pt_schedule_events_status_source_check;
alter table public.dagym_pt_schedule_events
  add constraint dagym_pt_schedule_events_status_source_check
  check (status_source in ('dagym', 'worklog'));

commit;
