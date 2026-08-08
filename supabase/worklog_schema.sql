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
