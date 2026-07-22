create table if not exists public.os_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  business_area text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.os_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default '',
  operator_company_id uuid references public.os_companies(id),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.os_buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null default '',
  address text not null default '',
  owner_company_id uuid references public.os_companies(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (name, district)
);

create table if not exists public.os_floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.os_buildings(id) on delete cascade,
  floor_label text not null,
  sort_order int not null default 0,
  unique (building_id, floor_label)
);

create table if not exists public.os_rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.os_buildings(id) on delete cascade,
  floor_id uuid references public.os_floors(id) on delete set null,
  room_label text not null,
  area_m2 numeric,
  status text not null default 'active',
  unique (building_id, room_label)
);

create table if not exists public.os_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_id uuid references public.os_brands(id),
  operator_company_id uuid references public.os_companies(id),
  site_type text not null default '',
  status text not null default 'operating',
  operating_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.os_site_rooms (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.os_sites(id) on delete cascade,
  room_id uuid not null references public.os_rooms(id) on delete cascade,
  valid_from date not null default current_date,
  valid_to date,
  usage_status text not null default 'direct',
  unique (site_id, room_id, valid_from)
);

create table if not exists public.os_employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.os_companies(id),
  site_id uuid references public.os_sites(id),
  name text not null,
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  primary_work text not null default '',
  secondary_work text not null default '',
  employee_code text not null default '',
  nickname text not null default '',
  employment_type text not null default '직원',
  contract_type text not null default '',
  hire_date date,
  leave_date date,
  work_hours text not null default '',
  weekly_work_hours jsonb not null default '{}'::jsonb,
  wage_type text not null default '',
  hourly_wage numeric,
  daily_wage numeric,
  allowance_policy jsonb not null default '{}'::jsonb,
  labor_id text not null default '',
  address text not null default '',
  permission_scope text not null default 'self',
  permission_role text not null default 'staff',
  permission_matrix jsonb not null default '{}'::jsonb,
  onboarding_status jsonb not null default '{}'::jsonb,
  growth_profile jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.os_employees add column if not exists employee_code text not null default '';
alter table public.os_employees add column if not exists nickname text not null default '';
alter table public.os_employees add column if not exists employment_type text not null default '직원';
alter table public.os_employees add column if not exists contract_type text not null default '';
alter table public.os_employees add column if not exists hire_date date;
alter table public.os_employees add column if not exists leave_date date;
alter table public.os_employees add column if not exists work_hours text not null default '';
alter table public.os_employees add column if not exists weekly_work_hours jsonb not null default '{}'::jsonb;
alter table public.os_employees add column if not exists wage_type text not null default '';
alter table public.os_employees add column if not exists hourly_wage numeric;
alter table public.os_employees add column if not exists daily_wage numeric;
alter table public.os_employees add column if not exists allowance_policy jsonb not null default '{}'::jsonb;
alter table public.os_employees add column if not exists labor_id text not null default '';
alter table public.os_employees add column if not exists address text not null default '';
alter table public.os_employees add column if not exists permission_role text not null default 'staff';
alter table public.os_employees add column if not exists permission_matrix jsonb not null default '{}'::jsonb;
alter table public.os_employees add column if not exists onboarding_status jsonb not null default '{}'::jsonb;
alter table public.os_employees add column if not exists growth_profile jsonb not null default '{}'::jsonb;

create table if not exists public.os_operating_metrics (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.os_sites(id) on delete cascade,
  metric_date date not null,
  metric_type text not null,
  metric_value numeric not null default 0,
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (site_id, metric_date, metric_type)
);

create table if not exists public.os_documents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.os_sites(id) on delete set null,
  room_id uuid references public.os_rooms(id) on delete set null,
  title text not null,
  document_type text not null default '',
  storage_path text not null default '',
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.os_companies enable row level security;
alter table public.os_brands enable row level security;
alter table public.os_buildings enable row level security;
alter table public.os_floors enable row level security;
alter table public.os_rooms enable row level security;
alter table public.os_sites enable row level security;
alter table public.os_site_rooms enable row level security;
alter table public.os_employees enable row level security;
alter table public.os_operating_metrics enable row level security;
alter table public.os_documents enable row level security;

drop policy if exists "authenticated_read_os_companies" on public.os_companies;
create policy "authenticated_read_os_companies" on public.os_companies for select to authenticated using (true);
drop policy if exists "authenticated_read_os_brands" on public.os_brands;
create policy "authenticated_read_os_brands" on public.os_brands for select to authenticated using (true);
drop policy if exists "authenticated_read_os_buildings" on public.os_buildings;
create policy "authenticated_read_os_buildings" on public.os_buildings for select to authenticated using (true);
drop policy if exists "authenticated_read_os_floors" on public.os_floors;
create policy "authenticated_read_os_floors" on public.os_floors for select to authenticated using (true);
drop policy if exists "authenticated_read_os_rooms" on public.os_rooms;
create policy "authenticated_read_os_rooms" on public.os_rooms for select to authenticated using (true);
drop policy if exists "authenticated_read_os_sites" on public.os_sites;
create policy "authenticated_read_os_sites" on public.os_sites for select to authenticated using (true);
drop policy if exists "authenticated_read_os_site_rooms" on public.os_site_rooms;
create policy "authenticated_read_os_site_rooms" on public.os_site_rooms for select to authenticated using (true);
drop policy if exists "authenticated_read_os_employees" on public.os_employees;
create policy "authenticated_read_os_employees" on public.os_employees for select to authenticated using (true);

drop policy if exists "authenticated_write_os_metrics" on public.os_operating_metrics;
create policy "authenticated_write_os_metrics" on public.os_operating_metrics for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_write_os_documents" on public.os_documents;
create policy "authenticated_write_os_documents" on public.os_documents for all to authenticated using (true) with check (true);
