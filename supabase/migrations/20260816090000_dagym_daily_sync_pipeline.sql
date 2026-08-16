begin;

create table if not exists public.dagym_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  center_key text not null default 'beyond-fitness',
  snapshot_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  domains jsonb not null default '{}'::jsonb,
  quality text not null default 'missing' check (quality in ('missing', 'partial', 'complete')),
  field_count integer not null default 0 check (field_count between 0 and 8),
  sync_id uuid not null,
  source text not null default 'dagym-browser-daily',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_key, snapshot_date)
);

create index if not exists dagym_daily_snapshots_date_idx
on public.dagym_daily_snapshots (snapshot_date desc, center_key);

alter table public.dagym_daily_snapshots enable row level security;

drop policy if exists "dagym_daily_snapshots_select_approver" on public.dagym_daily_snapshots;
create policy "dagym_daily_snapshots_select_approver"
on public.dagym_daily_snapshots for select
to authenticated
using (public.is_profile_approver());

revoke insert, update, delete on public.dagym_daily_snapshots from anon, authenticated;
grant select on public.dagym_daily_snapshots to authenticated;

create table if not exists public.dagym_sync_runs (
  id uuid primary key,
  center_key text not null default 'beyond-fitness',
  target_date date not null,
  source text not null default 'browser-daily',
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  quality text not null default 'missing' check (quality in ('missing', 'partial', 'complete')),
  metrics_count integer not null default 0 check (metrics_count between 0 and 8),
  domains jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dagym_sync_runs_recent_idx
on public.dagym_sync_runs (center_key, target_date desc, started_at desc);

alter table public.dagym_sync_runs enable row level security;

drop policy if exists "dagym_sync_runs_select_approver" on public.dagym_sync_runs;
create policy "dagym_sync_runs_select_approver"
on public.dagym_sync_runs for select
to authenticated
using (public.is_profile_approver());

revoke insert, update, delete on public.dagym_sync_runs from anon, authenticated;
grant select on public.dagym_sync_runs to authenticated;

create or replace function public.apply_dagym_daily_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  manager_id uuid;
  manager_org text;
  record_payload jsonb;
begin
  select p.id, coalesce(nullif(p.org, ''), '(주)방주 / 비욘드 피트니스 지사')
  into manager_id, manager_org
  from public.profiles p
  where coalesce(p.approval_status, 'approved') = 'approved'
    and concat_ws(' ', p.name, p.role, p.workplace, p.org) ~* '박주홍|센터장|운영총괄|피트니스.*manager'
  order by case when coalesce(p.name, '') = '박주홍' then 0 else 1 end, p.updated_at desc
  limit 1;
  if manager_id is null then
    perform public.run_dagym_nightly_analysis(new.snapshot_date + 1);
    return new;
  end if;

  record_payload := new.metrics || jsonb_build_object(
    'date', new.snapshot_date::text,
    'status', case when new.quality = 'complete' then 'closed' else 'draft' end,
    'syncMode', 'browser-daily',
    'source', new.source,
    'quality', new.quality,
    'fieldCount', new.field_count,
    'importText', case when new.field_count > 0 then '다짐 자동수집 지표 확인 완료' else '' end,
    'domains', new.domains,
    'importedAt', new.source_updated_at,
    'updatedAt', new.source_updated_at
  );

  insert into public.worklog_states (user_id, log_date, organization, state, updated_at)
  values (
    manager_id,
    new.snapshot_date,
    manager_org,
    jsonb_build_object('dagymDaily', jsonb_build_object(new.snapshot_date::text, record_payload)),
    coalesce(new.source_updated_at, now())
  )
  on conflict (user_id, organization, log_date) do update set
    state = jsonb_set(
      jsonb_set(
        coalesce(public.worklog_states.state, '{}'::jsonb),
        '{dagymDaily}',
        coalesce(public.worklog_states.state->'dagymDaily', '{}'::jsonb),
        true
      ),
      array['dagymDaily', new.snapshot_date::text],
      record_payload,
      true
    ),
    updated_at = greatest(public.worklog_states.updated_at, coalesce(new.source_updated_at, now()));

  perform public.run_dagym_nightly_analysis(new.snapshot_date + 1);
  return new;
end;
$$;

drop trigger if exists apply_dagym_daily_snapshot on public.dagym_daily_snapshots;
create trigger apply_dagym_daily_snapshot
after insert or update of metrics, domains, quality, field_count, source_updated_at
on public.dagym_daily_snapshots
for each row execute function public.apply_dagym_daily_snapshot();

revoke all on function public.apply_dagym_daily_snapshot() from public, anon, authenticated;

commit;
