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
  join_date date,
  pay_day text not null default '',
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
  pending_profile_changes jsonb not null default '{}'::jsonb,
  profile_change_requested_at timestamptz,
  assigned_mission text not null default '',
  assigned_mission_visible boolean not null default true,
  assigned_mission_updated_by uuid references auth.users(id),
  assigned_mission_updated_at timestamptz,
  access_preset text not null default 'employee',
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists employment_type text not null default '직원';
alter table public.profiles add column if not exists labor_id text not null default '';
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists daily_wage numeric;
alter table public.profiles add column if not exists hourly_wage numeric;
alter table public.profiles add column if not exists join_date date;
alter table public.profiles add column if not exists pay_day text not null default '';
alter table public.profiles add column if not exists weekly_work_hours jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists approval_status text not null default 'pending';
alter table public.profiles add column if not exists approval_note text not null default '';
alter table public.profiles add column if not exists approved_by uuid references auth.users(id);
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists pending_profile_changes jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists profile_change_requested_at timestamptz;
alter table public.profiles add column if not exists assigned_mission text not null default '';
alter table public.profiles add column if not exists assigned_mission_visible boolean not null default true;
alter table public.profiles add column if not exists assigned_mission_updated_by uuid references auth.users(id);
alter table public.profiles add column if not exists assigned_mission_updated_at timestamptz;
alter table public.profiles add column if not exists access_preset text not null default 'employee';
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;

create table if not exists public.labor_payroll_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id text not null,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  organization text not null default '(주)방주',
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, employee_id, month_key)
);

alter table public.labor_payroll_drafts enable row level security;

drop policy if exists "labor_payroll_drafts_select_own" on public.labor_payroll_drafts;
create policy "labor_payroll_drafts_select_own"
on public.labor_payroll_drafts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "labor_payroll_drafts_insert_own" on public.labor_payroll_drafts;
create policy "labor_payroll_drafts_insert_own"
on public.labor_payroll_drafts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "labor_payroll_drafts_update_own" on public.labor_payroll_drafts;
create policy "labor_payroll_drafts_update_own"
on public.labor_payroll_drafts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "labor_payroll_drafts_delete_own" on public.labor_payroll_drafts;
create policy "labor_payroll_drafts_delete_own"
on public.labor_payroll_drafts for delete
to authenticated
using (auth.uid() = user_id);

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
  is_approver boolean := user_email in ('j3010@ymail.com', 'tbakorea@gmail.com');
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
    weekly_work_hours,
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
    coalesce(meta->'weeklyWorkHours', '{}'::jsonb),
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
  weekly_work_hours,
  extra,
  strengths,
  weaknesses,
  development_goals,
  approval_status,
  approved_at,
  updated_at
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'org', ''), '(주)방주'),
  coalesce(nullif(u.raw_user_meta_data->>'role', ''), '직원'),
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), '내 프로필'),
  coalesce(u.raw_user_meta_data->>'phone', ''),
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'primaryWork', ''),
  coalesce(u.raw_user_meta_data->>'secondaryWork', ''),
  coalesce(u.raw_user_meta_data->>'workplace', ''),
  coalesce(nullif(u.raw_user_meta_data->>'employmentType', ''), '직원'),
  coalesce(u.raw_user_meta_data->>'laborId', ''),
  coalesce(u.raw_user_meta_data->>'address', ''),
  public.to_numeric_or_null(u.raw_user_meta_data->>'dailyWage'),
  public.to_numeric_or_null(u.raw_user_meta_data->>'hourlyWage'),
  coalesce(nullif(u.raw_user_meta_data->>'workHours', ''), '08:00-18:00'),
  coalesce(u.raw_user_meta_data->'weeklyWorkHours', '{}'::jsonb),
  coalesce(u.raw_user_meta_data->>'extra', ''),
  coalesce(u.raw_user_meta_data->>'strengths', ''),
  coalesce(u.raw_user_meta_data->>'weaknesses', ''),
  coalesce(u.raw_user_meta_data->>'developmentGoals', ''),
  case
    when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then 'approved'
    else 'pending'
  end,
  case
    when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then now()
    else null
  end,
  now()
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

update public.profiles p
set org = coalesce(nullif(u.raw_user_meta_data->>'org', ''), nullif(p.org, ''), '(주)방주'),
    role = coalesce(nullif(u.raw_user_meta_data->>'role', ''), nullif(p.role, ''), '직원'),
    name = coalesce(nullif(u.raw_user_meta_data->>'name', ''), nullif(p.name, ''), split_part(coalesce(u.email, ''), '@', 1), '내 프로필'),
    phone = coalesce(nullif(u.raw_user_meta_data->>'phone', ''), p.phone, ''),
    email = coalesce(nullif(u.email, ''), nullif(p.email, ''), u.raw_user_meta_data->>'email', ''),
    primary_work = coalesce(nullif(u.raw_user_meta_data->>'primaryWork', ''), p.primary_work, ''),
    secondary_work = coalesce(nullif(u.raw_user_meta_data->>'secondaryWork', ''), p.secondary_work, ''),
    workplace = coalesce(nullif(u.raw_user_meta_data->>'workplace', ''), p.workplace, ''),
    employment_type = coalesce(nullif(u.raw_user_meta_data->>'employmentType', ''), p.employment_type, '직원'),
    labor_id = coalesce(nullif(u.raw_user_meta_data->>'laborId', ''), p.labor_id, ''),
    address = coalesce(nullif(u.raw_user_meta_data->>'address', ''), p.address, ''),
    daily_wage = coalesce(public.to_numeric_or_null(u.raw_user_meta_data->>'dailyWage'), p.daily_wage),
    hourly_wage = coalesce(public.to_numeric_or_null(u.raw_user_meta_data->>'hourlyWage'), p.hourly_wage),
    work_hours = coalesce(nullif(u.raw_user_meta_data->>'workHours', ''), nullif(p.work_hours, ''), '08:00-18:00'),
    weekly_work_hours = coalesce(u.raw_user_meta_data->'weeklyWorkHours', p.weekly_work_hours, '{}'::jsonb),
    extra = coalesce(nullif(u.raw_user_meta_data->>'extra', ''), p.extra, ''),
    strengths = coalesce(nullif(u.raw_user_meta_data->>'strengths', ''), p.strengths, ''),
    weaknesses = coalesce(nullif(u.raw_user_meta_data->>'weaknesses', ''), p.weaknesses, ''),
    development_goals = coalesce(nullif(u.raw_user_meta_data->>'developmentGoals', ''), p.development_goals, ''),
    approval_status = case
      when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then 'approved'
      else coalesce(nullif(p.approval_status, ''), 'pending')
    end,
    approved_at = case
      when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then coalesce(p.approved_at, now())
      else p.approved_at
    end,
    updated_at = now()
from auth.users u
where p.id = u.id
  and (
    coalesce(p.approval_status, 'pending') <> 'approved'
    or lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
  );

update public.profiles
set approval_status = 'approved',
    approved_at = coalesce(approved_at, now())
where lower(coalesce(email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
;

update public.profiles
set org = '(주)방주 / 비욘드 피트니스 지사',
    role = '센터장',
    name = '박주홍',
    workplace = '비욘드 피트니스',
    primary_work = '비욘드 피트니스 운영총괄, PT 수업',
    secondary_work = '센터 운영관리',
    employment_type = '직원',
    work_hours = '06:00-24:00',
    weekly_work_hours = jsonb_build_object(
      'sun', '06:00-24:00',
      'mon', '06:00-24:00',
      'tue', '06:00-24:00',
      'wed', '06:00-24:00',
      'thu', '06:00-24:00',
      'fri', '06:00-24:00',
      'sat', '06:00-24:00'
    ),
    approval_status = 'approved',
    approval_note = '',
    approved_at = coalesce(approved_at, now()),
    updated_at = now()
where lower(coalesce(email, '')) = 'pjhong0@naver.com'
;

insert into public.profiles (
  id, email, org, role, name, workplace, primary_work, secondary_work,
  employment_type, work_hours, approval_status, approval_note, approved_at, updated_at
)
select
  id, email, '(주)방주 / 비욘드 피트니스 지사', '트레이너', '홍현규', '비욘드 피트니스',
  'PT 수업', '회원관리, 센터 운영 지원', '프리랜서', '06:00-24:00', 'approved', '', now(), now()
from auth.users
where lower(coalesce(email, '')) = 'gusrd1005@gmail.com'
on conflict (id) do update set
  email = excluded.email,
  org = excluded.org,
  role = excluded.role,
  name = excluded.name,
  workplace = excluded.workplace,
  primary_work = excluded.primary_work,
  secondary_work = excluded.secondary_work,
  employment_type = excluded.employment_type,
  work_hours = excluded.work_hours,
  approval_status = 'approved',
  approval_note = '',
  approved_at = coalesce(public.profiles.approved_at, now()),
  updated_at = now();

update public.profiles
set approval_status = 'rejected',
    approval_note = '박주홍 센터장 계정은 pjhong0@naver.com만 사용합니다. 이 계정은 비활성 처리되었습니다.',
    updated_at = now()
where lower(coalesce(email, '')) in ('pjhong1@naver.com', 'pjhong9@naver.com')
;

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

create table if not exists public.dagym_daily_analyses (
  analysis_date date primary key,
  source_date date not null,
  source text not null default 'nightly-cron',
  quality text not null default 'missing',
  metrics jsonb not null default '{}'::jsonb,
  ratios jsonb not null default '{}'::jsonb,
  signals jsonb not null default '[]'::jsonb,
  coaching jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dagym_daily_analyses_quality_check check (quality in ('missing', 'partial', 'complete'))
);

alter table public.dagym_daily_analyses enable row level security;

drop policy if exists "dagym_daily_analyses_select_authenticated" on public.dagym_daily_analyses;
create policy "dagym_daily_analyses_select_authenticated"
on public.dagym_daily_analyses for select
to authenticated
using (true);

revoke insert, update, delete on public.dagym_daily_analyses from anon, authenticated;
grant select on public.dagym_daily_analyses to authenticated;

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  requester_name text not null default '',
  status text not null default 'pending',
  note text not null default '',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.password_reset_requests add column if not exists requester_name text not null default '';
alter table public.password_reset_requests add column if not exists status text not null default 'pending';
alter table public.password_reset_requests add column if not exists note text not null default '';
alter table public.password_reset_requests add column if not exists approved_by uuid references auth.users(id);
alter table public.password_reset_requests add column if not exists approved_at timestamptz;
alter table public.password_reset_requests add column if not exists processed_at timestamptz;
alter table public.password_reset_requests enable row level security;

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
        or coalesce((p.permissions ->> 'staffApproval')::boolean, false)
        or coalesce((p.permissions ->> 'staffManage')::boolean, false)
        or coalesce(p.role, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
        or coalesce(p.primary_work, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
      )
  );
$$;

create table if not exists public.labor_leave_requests (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id text not null,
  employee_name text not null default '',
  leave_type text not null default 'annual',
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  reason text not null default '',
  handover_to text not null default '',
  handover_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.labor_leave_requests enable row level security;

drop policy if exists "labor_leave_requests_select_visible" on public.labor_leave_requests;
create policy "labor_leave_requests_select_visible"
on public.labor_leave_requests for select
to authenticated
using (auth.uid() = user_id or public.is_profile_approver());

drop policy if exists "labor_leave_requests_insert_own_or_approver" on public.labor_leave_requests;
create policy "labor_leave_requests_insert_own_or_approver"
on public.labor_leave_requests for insert
to authenticated
with check (auth.uid() = user_id or public.is_profile_approver());

drop policy if exists "labor_leave_requests_update_pending_own" on public.labor_leave_requests;
create policy "labor_leave_requests_update_pending_own"
on public.labor_leave_requests for update
to authenticated
using (auth.uid() = user_id and status = 'pending')
with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "labor_leave_requests_update_approver" on public.labor_leave_requests;
create policy "labor_leave_requests_update_approver"
on public.labor_leave_requests for update
to authenticated
using (public.is_profile_approver())
with check (public.is_profile_approver());

drop policy if exists "labor_leave_requests_delete_pending_own_or_approver" on public.labor_leave_requests;
create policy "labor_leave_requests_delete_pending_own_or_approver"
on public.labor_leave_requests for delete
to authenticated
using ((auth.uid() = user_id and status = 'pending') or public.is_profile_approver());

create table if not exists public.site_weather_settings (
  site_key text primary key,
  address text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_weather_settings enable row level security;

drop policy if exists "site_weather_settings_select_authenticated" on public.site_weather_settings;
create policy "site_weather_settings_select_authenticated"
on public.site_weather_settings for select
to authenticated
using (true);

drop policy if exists "site_weather_settings_insert_approver" on public.site_weather_settings;
create policy "site_weather_settings_insert_approver"
on public.site_weather_settings for insert
to authenticated
with check (public.is_profile_approver());

drop policy if exists "site_weather_settings_update_approver" on public.site_weather_settings;
create policy "site_weather_settings_update_approver"
on public.site_weather_settings for update
to authenticated
using (public.is_profile_approver())
with check (public.is_profile_approver());

drop policy if exists "site_weather_settings_delete_approver" on public.site_weather_settings;
create policy "site_weather_settings_delete_approver"
on public.site_weather_settings for delete
to authenticated
using (public.is_profile_approver());

create or replace function public.get_visible_worklog_states(target_date date)
returns table (
  user_id uuid,
  state jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_profile_approver() then
    raise exception 'visible worklogs require approver access';
  end if;

  return query
  select w.user_id, w.state, w.updated_at
  from public.worklog_states w
  where w.log_date = target_date
    and w.user_id <> auth.uid()
  order by w.updated_at desc;
end;
$$;

revoke all on function public.get_visible_worklog_states(date) from public;
grant execute on function public.get_visible_worklog_states(date) to authenticated;

create or replace function public.get_coworker_worklog_states(target_date date)
returns table (
  user_id uuid,
  state jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_site text;
begin
  select case
    when concat_ws(' ', p.org, p.workplace) ~* '피트니스|fitness' then 'fitness'
    when nullif(trim(p.workplace), '') is not null then lower(trim(p.workplace))
    else lower(trim(p.org))
  end
  into viewer_site
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.approval_status, 'pending') = 'approved';

  if auth.uid() is null or viewer_site is null then
    raise exception 'approved coworker worklogs require authentication';
  end if;

  return query
  select w.user_id, w.state, w.updated_at
  from public.worklog_states w
  join public.profiles colleague on colleague.id = w.user_id
  where w.log_date = target_date
    and w.user_id <> auth.uid()
    and coalesce(colleague.approval_status, 'pending') = 'approved'
    and case
      when concat_ws(' ', colleague.org, colleague.workplace) ~* '피트니스|fitness' then 'fitness'
      when nullif(trim(colleague.workplace), '') is not null then lower(trim(colleague.workplace))
      else lower(trim(colleague.org))
    end = viewer_site
  order by w.updated_at desc;
end;
$$;

revoke all on function public.get_coworker_worklog_states(date) from public;
grant execute on function public.get_coworker_worklog_states(date) to authenticated;

create or replace function public.repair_profile_approval_queue()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  repaired_count integer := 0;
  inserted_count integer := 0;
  filled_count integer := 0;
begin
  if not public.is_profile_approver() then
    raise exception 'approval queue repair requires approver';
  end if;

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
    weekly_work_hours,
    extra,
    strengths,
    weaknesses,
    development_goals,
    approval_status,
    approved_at,
    updated_at
  )
  select
    u.id,
    coalesce(nullif(u.raw_user_meta_data->>'org', ''), '(주)방주'),
    coalesce(nullif(u.raw_user_meta_data->>'role', ''), '직원'),
    coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), '내 프로필'),
    coalesce(u.raw_user_meta_data->>'phone', ''),
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data->>'primaryWork', ''),
    coalesce(u.raw_user_meta_data->>'secondaryWork', ''),
    coalesce(u.raw_user_meta_data->>'workplace', ''),
    coalesce(nullif(u.raw_user_meta_data->>'employmentType', ''), '직원'),
    coalesce(u.raw_user_meta_data->>'laborId', ''),
    coalesce(u.raw_user_meta_data->>'address', ''),
    public.to_numeric_or_null(u.raw_user_meta_data->>'dailyWage'),
    public.to_numeric_or_null(u.raw_user_meta_data->>'hourlyWage'),
    coalesce(nullif(u.raw_user_meta_data->>'workHours', ''), '08:00-18:00'),
    coalesce(u.raw_user_meta_data->'weeklyWorkHours', '{}'::jsonb),
    coalesce(u.raw_user_meta_data->>'extra', ''),
    coalesce(u.raw_user_meta_data->>'strengths', ''),
    coalesce(u.raw_user_meta_data->>'weaknesses', ''),
    coalesce(u.raw_user_meta_data->>'developmentGoals', ''),
    case when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then 'approved' else 'pending' end,
    case when lower(coalesce(u.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then now() else null end,
    now()
  from auth.users u
  where not exists (
    select 1 from public.profiles p where p.id = u.id
  );
  get diagnostics inserted_count = row_count;

  update public.profiles p
  set email = coalesce(nullif(p.email, ''), nullif(u.email, ''), u.raw_user_meta_data->>'email', ''),
      name = coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), '내 프로필'),
      org = coalesce(nullif(p.org, ''), nullif(u.raw_user_meta_data->>'org', ''), '(주)방주'),
      workplace = coalesce(nullif(p.workplace, ''), nullif(u.raw_user_meta_data->>'workplace', ''), ''),
      work_hours = coalesce(nullif(p.work_hours, ''), nullif(u.raw_user_meta_data->>'workHours', ''), '08:00-18:00'),
      approval_status = case
        when lower(coalesce(u.email, p.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then 'approved'
        else coalesce(nullif(p.approval_status, ''), 'pending')
      end,
      approved_at = case
        when lower(coalesce(u.email, p.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com') then coalesce(p.approved_at, now())
        else p.approved_at
      end,
      updated_at = now()
  from auth.users u
  where p.id = u.id
    and (
      nullif(p.email, '') is null
      or nullif(p.name, '') is null
      or nullif(p.org, '') is null
      or nullif(p.work_hours, '') is null
      or lower(coalesce(u.email, p.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
      or coalesce(p.approval_status, '') = ''
    );
  get diagnostics filled_count = row_count;

  repaired_count := inserted_count + filled_count;
  return repaired_count;
end;
$$;

grant execute on function public.repair_profile_approval_queue() to authenticated;

create or replace function public.check_registration_email(email_to_check text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(email_to_check, '')));
  profile_exists boolean := false;
  auth_exists boolean := false;
begin
  if normalized_email = '' then
    return jsonb_build_object('exists', false, 'profileExists', false, 'authExists', false);
  end if;

  select exists (
    select 1 from public.profiles p
    where lower(coalesce(p.email, '')) = normalized_email
  ) into profile_exists;

  select exists (
    select 1 from auth.users u
    where lower(coalesce(u.email, '')) = normalized_email
  ) into auth_exists;

  return jsonb_build_object(
    'exists', profile_exists or auth_exists,
    'profileExists', profile_exists,
    'authExists', auth_exists
  );
end;
$$;

grant execute on function public.check_registration_email(text) to anon, authenticated;

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
      or new.assigned_mission is distinct from old.assigned_mission
      or new.assigned_mission_visible is distinct from old.assigned_mission_visible
      or new.assigned_mission_updated_by is distinct from old.assigned_mission_updated_by
      or new.assigned_mission_updated_at is distinct from old.assigned_mission_updated_at
    )
  then
    raise exception 'approval and assigned mission fields can only be changed by an approver';
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

create or replace function public.protect_delegated_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    new.access_preset := old.access_preset;
    new.permissions := old.permissions;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_delegated_profile_permissions on public.profiles;
create trigger protect_delegated_profile_permissions
before update of access_preset, permissions on public.profiles
for each row execute function public.protect_delegated_profile_permissions();

drop policy if exists "password_reset_insert_request" on public.password_reset_requests;
create policy "password_reset_insert_request"
on public.password_reset_requests for insert
to anon, authenticated
with check (
  status = 'pending'
  and nullif(trim(email), '') is not null
);

drop policy if exists "password_reset_select_approver" on public.password_reset_requests;
create policy "password_reset_select_approver"
on public.password_reset_requests for select
to authenticated
using (public.is_profile_approver());

drop policy if exists "password_reset_update_approver" on public.password_reset_requests;
create policy "password_reset_update_approver"
on public.password_reset_requests for update
to authenticated
using (public.is_profile_approver())
with check (public.is_profile_approver());

drop policy if exists "worklog_select_own" on public.worklog_states;
drop policy if exists "worklog_select_visible" on public.worklog_states;
create policy "worklog_select_visible"
on public.worklog_states for select
to authenticated
using (auth.uid() = user_id or public.is_profile_approver());

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

do $$
declare
  active_manager_id uuid;
begin
  select id into active_manager_id
  from auth.users
  where lower(coalesce(email, '')) = 'pjhong0@naver.com'
  limit 1;

  if active_manager_id is not null then
    insert into public.worklog_states (user_id, log_date, organization, state, updated_at)
    select distinct on (source.log_date, source.organization)
      active_manager_id,
      source.log_date,
      source.organization,
      source.state,
      source.updated_at
    from public.worklog_states source
    join auth.users retired on retired.id = source.user_id
    where lower(coalesce(retired.email, '')) in ('pjhong1@naver.com', 'pjhong9@naver.com')
    order by source.log_date, source.organization, source.updated_at desc
    on conflict (user_id, organization, log_date) do nothing;
    delete from auth.users
    where lower(coalesce(email, '')) in ('pjhong1@naver.com', 'pjhong9@naver.com');
  end if;
end
$$;

-- Daily DaGym analysis: 16:00 UTC equals 01:00 Asia/Seoul.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.dagym_metric_number(value text)
returns numeric
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(value, ''), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then greatest(regexp_replace(value, '[^0-9.-]', '', 'g')::numeric, 0)
    else 0
  end;
$$;

create or replace function public.run_dagym_nightly_analysis(
  target_date date default (timezone('Asia/Seoul', now()))::date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  source_date date := target_date - 1;
  source_key text := to_char(source_date, 'YYYY-MM-DD');
  dagym jsonb;
  source_updated_at timestamptz;
  populated integer := 0;
  visits numeric := 0;
  new_members numeric := 0;
  renewals numeric := 0;
  expiring numeric := 0;
  pt_bookings numeric := 0;
  no_shows numeric := 0;
  locker_expiring numeric := 0;
  sales numeric := 0;
  recorded_pt numeric := 0;
  recorded_consultation numeric := 0;
  recorded_renewal numeric := 0;
  recorded_outbound numeric := 0;
  recorded_sales_actions numeric := 0;
  expected_sales_actions numeric := 0;
  renewal_gap numeric := 0;
  pt_gap numeric := 0;
  sales_action_gap numeric := 0;
  renewal_coverage numeric := 0;
  no_show_rate numeric := 0;
  sales_per_visit numeric := 0;
  quality_value text := 'missing';
  signals jsonb := '[]'::jsonb;
  coaching jsonb;
  metrics jsonb;
  ratios jsonb;
  top_title text;
  top_action text;
  management_direction text;
  generated_at timestamptz := now();
begin
  select
    ws.state->'dagymDaily'->source_key,
    coalesce(
      nullif(ws.state->'dagymDaily'->source_key->>'updatedAt', '')::timestamptz,
      nullif(ws.state->'dagymDaily'->source_key->>'importedAt', '')::timestamptz,
      ws.updated_at
    )
  into dagym, source_updated_at
  from public.worklog_states ws
  where ws.log_date = source_date
    and jsonb_typeof(ws.state->'dagymDaily'->source_key) = 'object'
  order by
    (
      select count(*)
      from jsonb_each_text(ws.state->'dagymDaily'->source_key) item
      where item.key in ('visits', 'newMembers', 'renewals', 'expiring', 'ptBookings', 'noShows', 'lockerExpiring', 'sales')
        and nullif(btrim(item.value), '') is not null
    ) desc,
    ws.updated_at desc
  limit 1;

  if dagym is not null then
    select count(*)
    into populated
    from jsonb_each_text(dagym) item
    where item.key in ('visits', 'newMembers', 'renewals', 'expiring', 'ptBookings', 'noShows', 'lockerExpiring', 'sales')
      and nullif(btrim(item.value), '') is not null;
  end if;

  visits := public.dagym_metric_number(dagym->>'visits');
  new_members := public.dagym_metric_number(dagym->>'newMembers');
  renewals := public.dagym_metric_number(dagym->>'renewals');
  expiring := public.dagym_metric_number(dagym->>'expiring');
  pt_bookings := public.dagym_metric_number(dagym->>'ptBookings');
  no_shows := public.dagym_metric_number(dagym->>'noShows');
  locker_expiring := public.dagym_metric_number(dagym->>'lockerExpiring');
  sales := public.dagym_metric_number(dagym->>'sales');

  select
    coalesce(sum(
      public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,ptRegular}')
      + public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,ptFree}')
      + public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,ptOther}')
    ), 0),
    coalesce(sum(public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,consultation}')), 0),
    coalesce(sum(public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,customerRenewal}')), 0),
    coalesce(sum(
      public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,outbound}')
      + public.dagym_metric_number(ws.state#>>'{ownerWorklog,fitnessOps,outsideSales}')
    ), 0)
  into recorded_pt, recorded_consultation, recorded_renewal, recorded_outbound
  from public.worklog_states ws
  where ws.log_date = source_date
    and concat_ws(
      ' ',
      ws.organization,
      ws.state#>>'{profile,organization}',
      ws.state#>>'{profile,org}',
      ws.state#>>'{profile,workplace}'
    ) ilike '%피트니스%';

  metrics := jsonb_build_object(
    'visits', visits,
    'newMembers', new_members,
    'renewals', renewals,
    'expiring', expiring,
    'ptBookings', pt_bookings,
    'noShows', no_shows,
    'lockerExpiring', locker_expiring,
    'sales', sales
  );

  if dagym is null or (
    visits + new_members + renewals + expiring + pt_bookings + no_shows + locker_expiring + sales = 0
    and nullif(btrim(coalesce(dagym->>'importText', '')), '') is null
  ) then
    signals := jsonb_build_array(jsonb_build_object(
      'type', 'data-gap',
      'severity', 'warning',
      'title', '전날 다짐자료 미확인',
      'detail', source_key || ' 센터 운영자료가 없습니다.',
      'action', '센터 마감자료를 확인하고 다짐 자료를 동기화하세요.',
      'targetRole', '센터장',
      'dueTime', '09:30'
    ));
    coaching := jsonb_build_object(
      'headline', '전날 다짐자료 미확인',
      'todayAction', '출석·예약·매출자료를 먼저 확인하세요.',
      'managementDirection', '데이터 입력률을 안정화한 뒤 운영 판단을 확정합니다.'
    );
    ratios := '{}'::jsonb;
  else
    quality_value := case when populated >= 6 then 'complete' else 'partial' end;
    renewal_gap := greatest(expiring - renewals, 0);
    pt_gap := greatest(pt_bookings - recorded_pt, 0);
    recorded_sales_actions := recorded_consultation + recorded_renewal + recorded_outbound;
    expected_sales_actions := case when visits > 0 then greatest(2, round(visits * 0.03)) else 0 end;
    sales_action_gap := greatest(expected_sales_actions - recorded_sales_actions, 0);
    renewal_coverage := case when expiring > 0 then round((renewals / expiring) * 100, 1) else 0 end;
    no_show_rate := case when pt_bookings > 0 then round((no_shows / pt_bookings) * 100, 1) else 0 end;
    sales_per_visit := case when visits > 0 then round(sales / visits) else 0 end;

    if renewal_gap > 0 then
      signals := signals || jsonb_build_array(jsonb_build_object(
        'type', 'renewal-gap',
        'severity', case when renewal_coverage < 50 then 'critical' else 'warning' end,
        'title', '만료대응 ' || renewal_gap::text || '건 부족',
        'detail', '만료예정 ' || expiring::text || '건 중 재등록 ' || renewals::text || '건, 대응률 ' || renewal_coverage::text || '%입니다.',
        'action', '미처리 회원을 결과별로 분류하고 담당자를 배정하세요.',
        'targetRole', '인포',
        'dueTime', '11:00',
        'value', renewal_gap
      ));
    end if;
    if no_shows > 0 then
      signals := signals || jsonb_build_array(jsonb_build_object(
        'type', 'no-show',
        'severity', case when no_show_rate >= 10 then 'critical' else 'warning' end,
        'title', '노쇼·취소 ' || no_shows::text || '건',
        'detail', 'PT 예약 대비 노쇼·취소율 ' || no_show_rate::text || '%입니다.',
        'action', '재예약 안내와 사유 기록을 완료하세요.',
        'targetRole', '인포',
        'dueTime', '10:30',
        'value', no_shows
      ));
    end if;
    if pt_gap > 0 then
      signals := signals || jsonb_build_array(jsonb_build_object(
        'type', 'pt-gap',
        'severity', 'warning',
        'title', 'PT 기록 차이 ' || pt_gap::text || '건',
        'detail', '다짐 예약 ' || pt_bookings::text || '건과 직원 수업기록 ' || recorded_pt::text || '건이 다릅니다.',
        'action', '완료·노쇼·일정변경 중 하나로 결과를 확정하세요.',
        'targetRole', '트레이너',
        'dueTime', '12:00',
        'value', pt_gap
      ));
    end if;
    if sales_action_gap > 0 then
      signals := signals || jsonb_build_array(jsonb_build_object(
        'type', 'sales-action',
        'severity', 'warning',
        'title', '상담행동 ' || sales_action_gap::text || '건 보강',
        'detail', '출석 ' || visits::text || '명 대비 상담·재등록·아웃바운드 ' || recorded_sales_actions::text || '건입니다.',
        'action', '재등록 후보와 체험회원 후속조치를 오늘 일정에 배정하세요.',
        'targetRole', '센터장',
        'dueTime', '14:00',
        'value', sales_action_gap
      ));
    end if;
    if locker_expiring > 0 then
      signals := signals || jsonb_build_array(jsonb_build_object(
        'type', 'locker',
        'severity', 'observe',
        'title', '락커 만료 ' || locker_expiring::text || '건',
        'detail', '연장·정리 여부를 확인해야 합니다.',
        'action', '안내 결과를 기록하세요.',
        'targetRole', '인포',
        'dueTime', '15:00',
        'value', locker_expiring
      ));
    end if;
    if jsonb_array_length(signals) = 0 then
      signals := jsonb_build_array(jsonb_build_object(
        'type', 'stable',
        'severity', 'normal',
        'title', '전날 운영흐름 안정',
        'detail', '즉시 보완할 큰 지표 차이가 확인되지 않았습니다.',
        'action', '수업·상담 결과 기록 기준을 유지하세요.',
        'targetRole', '센터장',
        'dueTime', '오늘',
        'value', 0
      ));
    end if;

    top_title := signals->0->>'title';
    top_action := signals->0->>'action';
    management_direction := case
      when renewal_gap > 0 then '재등록 대응률과 결과기록을 우선 개선합니다.'
      when sales_action_gap > 0 then '출석을 상담·재등록으로 전환하는 운영 루프를 강화합니다.'
      else '수업·상담·매출의 연결 기록을 유지합니다.'
    end;
    coaching := jsonb_build_object(
      'headline', top_title,
      'todayAction', top_action,
      'managementDirection', management_direction
    );
    ratios := jsonb_build_object(
      'noShowRate', no_show_rate,
      'renewalCoverage', renewal_coverage,
      'salesPerVisit', sales_per_visit,
      'recordedPt', recorded_pt,
      'recordedSalesActions', recorded_sales_actions
    );
  end if;

  insert into public.dagym_daily_analyses (
    analysis_date,
    source_date,
    source,
    quality,
    metrics,
    ratios,
    signals,
    coaching,
    source_updated_at,
    generated_at,
    updated_at
  ) values (
    target_date,
    source_date,
    'database-cron',
    quality_value,
    metrics,
    ratios,
    signals,
    coaching,
    source_updated_at,
    generated_at,
    generated_at
  )
  on conflict (analysis_date) do update set
    source_date = excluded.source_date,
    source = excluded.source,
    quality = excluded.quality,
    metrics = excluded.metrics,
    ratios = excluded.ratios,
    signals = excluded.signals,
    coaching = excluded.coaching,
    source_updated_at = excluded.source_updated_at,
    generated_at = excluded.generated_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'analysisDate', target_date,
    'sourceDate', source_date,
    'quality', quality_value,
    'signalCount', jsonb_array_length(signals),
    'generatedAt', generated_at
  );
end;
$$;

revoke all on function public.dagym_metric_number(text) from public, anon, authenticated;
revoke all on function public.run_dagym_nightly_analysis(date) from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'dagym-nightly-analysis'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'dagym-nightly-analysis',
  '0 16 * * *',
  'select public.run_dagym_nightly_analysis();'
);
