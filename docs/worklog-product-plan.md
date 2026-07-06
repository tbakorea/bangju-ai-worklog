# Bangju AI Worklog Product Plan

## Why Separate It

Beyond Work should remain a CEO-level planning system.
Bangju AI Worklog should become a daily work journal, attendance, and management agent for the Bangju group.

Separating them prevents feature overload and keeps each product clear:

- Beyond Work: plan, prioritize, coach, decide
- Bangju AI Worklog: record, summarize, report, manage attendance, detect risks

## Suggested Product Name

Primary: **Bangju AI Worklog**

Alternatives:

- Beyond Report
- Beyond Log
- Workbase Log

Bangju AI Worklog is the clearest because the main company is Bangju and the product can grow into a group-level management agent.

## Bangju Group Scope

### (주)방주

Real-estate development and execution corporation. Finance staff: 2.

- 비욘드 피트니스 지사: fitness center. Center manager 1, trainer 1, info desk 3.
- 워크베이스: shared office. Manager 1.
- 워크박스: shared storage. Managed together with Workbase.
- 홍보관: sales and leasing. Staff 2.

### (주)비제이종합건설

Head-office management: 1.

- 동천체육관현장: site manager 1, construction manager 1, construction affairs director 1, safety manager 1, foreman 1.
- 옥동 헤이븐빌 현장: site manager 1.

### (주)더헤이븐빌

옥동 헤이븐빌 execution corporation. Managed by Bangju.

### (주)비욘드컴퍼니

General management director: 1.

- tba studio showroom operation: built-in bathroom system showroom and interior estimates.
- Inwol System bathroom development and construction.
- In-house interior construction.
- Inwol System bathroom construction orders and execution.
- Inwol System unit import and design.

## Core Workflow

1. Open the app.
2. Select employee, company, branch, site, or department.
3. Adjust the employee's Today section from the Beyond Work pattern.
4. Add A/B/C priority work, time-based work flow, and daily record.
5. Check attendance and exceptions.
6. Mark status: planned, in progress, completed, held, delegated, postponed, needs support.
7. AI summarizes the day into employee and management reports.
8. Weekly report is generated from daily logs and attendance.

## First MVP Build Order

1. Local worklog page under `/worklog/`
2. Employee-level Today section adapted from Beyond Work's Today screen
3. Auth reuse from current app
4. Organization and employee master data
5. Attendance log
6. Supabase table split from planner state
7. Daily report generator
8. Weekly report generator
9. AI polishing, risk detection, and next-action coaching
10. Company/site-specific report templates

## Data Model Draft

```sql
create table worklog_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  log_date date not null,
  organization text not null default 'bangju',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, organization, log_date)
);
```

Suggested future tables:

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references organizations(id),
  name text not null,
  category text,
  staff_count integer default 0,
  active boolean not null default true
);

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid references organizations(id),
  work_date date not null,
  person_name text,
  role text,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
```

## Design Direction

Use the Beyond Work tone, but reduce complexity:

- Larger text
- Fewer sections
- Report-first layout
- Mobile-first interaction
- One daily flow, not a full planner
