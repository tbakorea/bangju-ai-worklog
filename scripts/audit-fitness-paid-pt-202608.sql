-- Beyond Fitness paid PT audit, 2026-08-01 onward.
-- Read-only. Run after the handwritten import and whenever the center monthly total looks wrong.
-- The first result is the canonical employee/day ledger; the second result is the scan baseline check.

with ranked as (
  select
    ws.id,
    ws.user_id,
    ws.log_date,
    lower(p.email) as email,
    p.name,
    ws.state->'ownerWorklog' as worklog,
    ws.updated_at,
    count(*) over (partition by ws.user_id, ws.log_date) as snapshot_count,
    row_number() over (
      partition by ws.user_id, ws.log_date
      order by ws.updated_at desc, ws.id desc
    ) as row_no
  from public.worklog_states ws
  join public.profiles p on p.id = ws.user_id
  where ws.log_date >= date '2026-08-01'
    and (
      lower(coalesce(p.workplace, '')) like '%피트니스%'
      or lower(coalesce(p.primary_work, '')) like '%피트니스%'
      or lower(coalesce(p.email, '')) in ('pjhong0@naver.com', 'gusrdo1005@gmail.com')
    )
), canonical as (
  select
    log_date,
    email,
    name,
    coalesce(nullif(worklog->'fitnessOps'->>'ptRegular', ''), '0')::integer as paid_pt,
    coalesce((worklog->'fitnessOpsManual'->>'ptRegular')::boolean, false) as paper_or_manual_confirmed,
    snapshot_count,
    worklog->'schedule' as schedule,
    updated_at
  from ranked
  where row_no = 1
)
select
  log_date,
  name,
  email,
  paid_pt,
  paper_or_manual_confirmed,
  snapshot_count,
  case when snapshot_count > 1 then '중복 스냅샷 있음 · 최신 1건만 사용' else '정상' end as snapshot_audit,
  updated_at
from canonical
order by log_date, name;

-- 15 supplied scans: 08.01-08.09 paid-PT baseline.
-- Park 27 + Hong 13 = center 40. The importer uses max(existing, scan), never addition.
with expected(email, employee_name, expected_paid) as (
  values
    ('pjhong0@naver.com', '박주홍', 27),
    ('gusrdo1005@gmail.com', '홍현규', 13)
), ranked as (
  select
    ws.user_id,
    ws.log_date,
    lower(p.email) as email,
    ws.state->'ownerWorklog' as worklog,
    row_number() over (
      partition by ws.user_id, ws.log_date
      order by ws.updated_at desc, ws.id desc
    ) as row_no
  from public.worklog_states ws
  join public.profiles p on p.id = ws.user_id
  where ws.log_date between date '2026-08-01' and date '2026-08-09'
), actual as (
  select
    email,
    sum(coalesce(nullif(worklog->'fitnessOps'->>'ptRegular', ''), '0')::integer)
      filter (where coalesce((worklog->'fitnessOpsManual'->>'ptRegular')::boolean, false)) as actual_paid
  from ranked
  where row_no = 1
  group by email
), employee_check as (
  select
    e.employee_name,
    e.email,
    e.expected_paid,
    coalesce(a.actual_paid, 0) as actual_paid,
    coalesce(a.actual_paid, 0) - e.expected_paid as difference
  from expected e
  left join actual a using (email)
)
select
  employee_name,
  email,
  expected_paid,
  actual_paid,
  difference,
  case when difference = 0 then 'PASS' else 'REVIEW' end as audit_status
from employee_check
union all
select
  '센터 합계',
  '-',
  sum(expected_paid),
  sum(actual_paid),
  sum(difference),
  case when sum(difference) = 0 then 'PASS' else 'REVIEW' end
from employee_check
order by employee_name;
