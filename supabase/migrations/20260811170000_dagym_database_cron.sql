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

