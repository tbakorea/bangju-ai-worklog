create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org text not null default '(주)방주',
  role text not null default '직원',
  name text not null default '내 프로필',
  phone text not null default '',
  email text not null default '',
  primary_work text not null default '',
  secondary_work text not null default '',
  workplace text not null default '',
  work_hours text not null default '12:00-19:00',
  extra text not null default '',
  strengths text not null default '',
  weaknesses text not null default '',
  development_goals text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.worklog_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  organization text not null default '(주)방주',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, organization, log_date)
);

alter table public.profiles enable row level security;
alter table public.worklog_states enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "worklog_select_own" on public.worklog_states;
create policy "worklog_select_own"
on public.worklog_states for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "worklog_insert_own" on public.worklog_states;
create policy "worklog_insert_own"
on public.worklog_states for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "worklog_update_own" on public.worklog_states;
create policy "worklog_update_own"
on public.worklog_states for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
