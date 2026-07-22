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
  employment_type text not null default '직원',
  labor_id text not null default '',
  address text not null default '',
  daily_wage numeric,
  hourly_wage numeric,
  work_hours text not null default '12:00-19:00',
  weekly_work_hours jsonb not null default '{}'::jsonb,
  extra text not null default '',
  strengths text not null default '',
  weaknesses text not null default '',
  development_goals text not null default '',
  approval_status text not null default 'pending',
  approval_note text not null default '',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists employment_type text not null default '직원';
alter table public.profiles add column if not exists labor_id text not null default '';
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists daily_wage numeric;
alter table public.profiles add column if not exists hourly_wage numeric;
alter table public.profiles add column if not exists weekly_work_hours jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists approval_status text not null default 'pending';
alter table public.profiles add column if not exists approval_note text not null default '';
alter table public.profiles add column if not exists approved_by uuid references auth.users(id);
alter table public.profiles add column if not exists approved_at timestamptz;

create or replace function public.to_numeric_or_null(value text)
returns numeric
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(value, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' then nullif(trim(value), '')::numeric
    else null
  end;
$$;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_email text := lower(coalesce(new.email, meta->>'email', ''));
  role_text text := coalesce(meta->>'role', '직원');
  primary_text text := coalesce(meta->>'primaryWork', '');
  is_approver boolean := user_email in ('j3010@ymail.com', 'tbakorea@gmail.com')
    or role_text ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
    or primary_text ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager';
begin
  insert into public.profiles (
    id,
    org,
    role,
    name,
    phone,
    email,
    primary_work,
    secondary_work,
    workplace,
    employment_type,
    labor_id,
    address,
    daily_wage,
    hourly_wage,
    work_hours,
    extra,
    strengths,
    weaknesses,
    development_goals,
    approval_status,
    approved_at,
    updated_at
  )
  values (
    new.id,
    coalesce(nullif(meta->>'org', ''), '(주)방주'),
    coalesce(nullif(role_text, ''), '직원'),
    coalesce(nullif(meta->>'name', ''), split_part(coalesce(new.email, ''), '@', 1), '내 프로필'),
    coalesce(meta->>'phone', ''),
    coalesce(new.email, meta->>'email', ''),
    coalesce(primary_text, ''),
    coalesce(meta->>'secondaryWork', ''),
    coalesce(meta->>'workplace', ''),
    coalesce(nullif(meta->>'employmentType', ''), '직원'),
    coalesce(meta->>'laborId', ''),
    coalesce(meta->>'address', ''),
    public.to_numeric_or_null(meta->>'dailyWage'),
    public.to_numeric_or_null(meta->>'hourlyWage'),
    coalesce(nullif(meta->>'workHours', ''), '08:00-18:00'),
    coalesce(meta->>'extra', ''),
    coalesce(meta->>'strengths', ''),
    coalesce(meta->>'weaknesses', ''),
    coalesce(meta->>'developmentGoals', ''),
    case when is_approver then 'approved' else 'pending' end,
    case when is_approver then now() else null end,
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

insert into public.profiles (
  id,
  org,
  role,
  name,
  email,
  approval_status,
  approved_at,
  updated_at
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'org', ''), '(주)방주'),
  coalesce(nullif(u.raw_user_meta_data->>'role', ''), '직원'),
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), '내 프로필'),
  coalesce(u.email, ''),
  case
    when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
      or coalesce(u.raw_user_meta_data->>'role', '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
    then 'approved'
    else 'pending'
  end,
  case
    when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
      or coalesce(u.raw_user_meta_data->>'role', '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
    then now()
    else null
  end,
  now()
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

update public.profiles
set approval_status = 'approved',
    approved_at = coalesce(approved_at, now())
where lower(coalesce(email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
   or coalesce(role, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager';

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

create or replace function public.is_profile_approver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.approval_status, 'approved') = 'approved'
      and (
        lower(coalesce(p.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
        or coalesce(p.role, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
        or coalesce(p.primary_work, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
      )
  );
$$;

create or replace function public.guard_profile_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id
    and not public.is_profile_approver()
    and (
      new.approval_status is distinct from old.approval_status
      or new.approval_note is distinct from old.approval_note
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
    )
  then
    raise exception 'approval fields can only be changed by an approver';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_approval_fields_trigger on public.profiles;
create trigger guard_profile_approval_fields_trigger
before update on public.profiles
for each row
execute function public.guard_profile_approval_fields();

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
on public.profiles for select
to authenticated
using (auth.uid() = id or public.is_profile_approver());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_manageable" on public.profiles;
create policy "profiles_update_manageable"
on public.profiles for update
to authenticated
using (auth.uid() = id or public.is_profile_approver())
with check (auth.uid() = id or public.is_profile_approver());

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
