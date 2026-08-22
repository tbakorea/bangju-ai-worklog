begin;

-- 무료 서버 실행시간을 넘기지 않도록 수집 트랜잭션은 스냅샷 반영까지만 수행합니다.
-- 전날 분석과 코칭은 Vercel의 /api/dagym-nightly-analysis 예약 작업이 담당합니다.
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

  if manager_id is null then return new; end if;

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

  return new;
end;
$$;

revoke all on function public.apply_dagym_daily_snapshot() from public, anon, authenticated;

commit;
