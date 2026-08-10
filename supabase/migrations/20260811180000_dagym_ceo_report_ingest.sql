create extension if not exists pgcrypto with schema extensions;

create table if not exists public.dagym_ceo_report_inbox (
  id uuid primary key default extensions.gen_random_uuid(),
  report_date date not null,
  received_at timestamptz not null default now(),
  source text not null default 'dagym-ceo-report',
  content_hash text not null unique,
  metrics jsonb not null default '{}'::jsonb,
  field_count integer not null default 0,
  quality text not null default 'missing',
  parser_version text not null default 'ceo-report-v1',
  message_length integer not null default 0,
  created_at timestamptz not null default now(),
  constraint dagym_ceo_report_quality_check check (quality in ('missing', 'partial', 'complete')),
  constraint dagym_ceo_report_field_count_check check (field_count between 0 and 8)
);

create index if not exists dagym_ceo_report_inbox_report_date_idx
on public.dagym_ceo_report_inbox (report_date desc, received_at desc);

alter table public.dagym_ceo_report_inbox enable row level security;

drop policy if exists "dagym_ceo_report_select_approver" on public.dagym_ceo_report_inbox;
create policy "dagym_ceo_report_select_approver"
on public.dagym_ceo_report_inbox for select
to authenticated
using (public.is_profile_approver());

revoke insert, update, delete on public.dagym_ceo_report_inbox from anon, authenticated;
grant select on public.dagym_ceo_report_inbox to authenticated;

create table if not exists public.dagym_ceo_ingest_credentials (
  id smallint primary key default 1,
  token_hash text not null,
  enabled boolean not null default true,
  rotated_at timestamptz not null default now(),
  constraint dagym_ceo_ingest_credentials_singleton check (id = 1)
);

alter table public.dagym_ceo_ingest_credentials enable row level security;
revoke all on public.dagym_ceo_ingest_credentials from public, anon, authenticated;

create or replace function public.dagym_ceo_report_metric(
  report_text text,
  label_pattern text,
  is_money boolean default false
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
declare
  matched text[];
  amount numeric;
  unit_label text;
begin
  matched := regexp_match(
    coalesce(report_text, ''),
    '(?:' || label_pattern || ')[^0-9]{0,20}([0-9][0-9,]*(?:\.[0-9]+)?)\s*(억원|천만원|백만원|만원|원)?',
    'i'
  );
  if matched is null then
    return null;
  end if;

  amount := replace(matched[1], ',', '')::numeric;
  unit_label := coalesce(matched[2], '');
  if is_money then
    amount := amount * case unit_label
      when '억원' then 100000000
      when '천만원' then 10000000
      when '백만원' then 1000000
      when '만원' then 10000
      else 1
    end;
  end if;
  return greatest(amount, 0);
exception when others then
  return null;
end;
$$;

create or replace function public.rotate_dagym_ceo_ingest_token()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  new_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.dagym_ceo_ingest_credentials (id, token_hash, enabled, rotated_at)
  values (1, encode(extensions.digest(new_token, 'sha256'), 'hex'), true, now())
  on conflict (id) do update set
    token_hash = excluded.token_hash,
    enabled = true,
    rotated_at = excluded.rotated_at;
  return new_token;
end;
$$;

create or replace function public.ingest_dagym_ceo_report(
  p_token text,
  p_text text,
  p_report_date date default null,
  p_received_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  credential public.dagym_ceo_ingest_credentials%rowtype;
  local_received timestamp := timezone('Asia/Seoul', p_received_at);
  resolved_date date;
  normalized_text text;
  fingerprint text;
  metrics jsonb;
  fields integer;
  quality_value text;
  record_payload jsonb;
  manager_id uuid;
  manager_org text;
  inserted_id uuid;
begin
  if length(coalesce(p_token, '')) < 32 then
    raise exception 'invalid ingest token';
  end if;
  select * into credential
  from public.dagym_ceo_ingest_credentials
  where id = 1 and enabled = true;
  if credential.id is null
    or credential.token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex') then
    raise exception 'invalid ingest token';
  end if;

  if nullif(btrim(coalesce(p_text, '')), '') is null or length(p_text) > 20000 then
    raise exception 'invalid report text';
  end if;

  resolved_date := coalesce(
    p_report_date,
    local_received::date - case when local_received::time < time '04:00' then 1 else 0 end
  );
  if resolved_date > (timezone('Asia/Seoul', now()))::date
    or resolved_date < (timezone('Asia/Seoul', now()))::date - 31 then
    raise exception 'report date is outside the allowed range';
  end if;

  normalized_text := regexp_replace(btrim(p_text), '\s+', ' ', 'g');
  metrics := jsonb_strip_nulls(jsonb_build_object(
    'visits', public.dagym_ceo_report_metric(normalized_text, '출석|방문', false),
    'newMembers', public.dagym_ceo_report_metric(normalized_text, '신규(?:등록|회원)?', false),
    'renewals', public.dagym_ceo_report_metric(normalized_text, '재등록|갱신', false),
    'expiring', public.dagym_ceo_report_metric(normalized_text, '만료(?:예정)?', false),
    'ptBookings', public.dagym_ceo_report_metric(normalized_text, 'P\.?T\.?\s*(?:예약|수업)', false),
    'noShows', public.dagym_ceo_report_metric(normalized_text, '노쇼|취소', false),
    'lockerExpiring', public.dagym_ceo_report_metric(normalized_text, '락커\s*만료|사물함\s*만료', false),
    'sales', public.dagym_ceo_report_metric(normalized_text, '매출|결제(?:금액)?', true)
  ));
  fields := (select count(*) from jsonb_object_keys(metrics));
  quality_value := case when fields >= 6 then 'complete' when fields > 0 then 'partial' else 'missing' end;
  fingerprint := encode(extensions.digest(resolved_date::text || ':' || lower(normalized_text), 'sha256'), 'hex');

  insert into public.dagym_ceo_report_inbox (
    report_date, received_at, content_hash, metrics, field_count, quality, message_length
  ) values (
    resolved_date, p_received_at, fingerprint, metrics, fields, quality_value, length(p_text)
  )
  on conflict (content_hash) do update set
    received_at = greatest(public.dagym_ceo_report_inbox.received_at, excluded.received_at),
    metrics = excluded.metrics,
    field_count = excluded.field_count,
    quality = excluded.quality,
    message_length = excluded.message_length
  returning id into inserted_id;

  select p.id, coalesce(nullif(p.org, ''), '(주)방주 / 비욘드 피트니스 지사')
  into manager_id, manager_org
  from public.profiles p
  where lower(coalesce(p.email, '')) = 'pjhong0@naver.com'
  limit 1;
  if manager_id is null then
    raise exception 'active fitness manager profile not found';
  end if;

  record_payload := metrics || jsonb_build_object(
    'date', resolved_date::text,
    'syncMode', 'ceo-report',
    'source', 'dagym-ceo-report',
    'quality', quality_value,
    'fieldCount', fields,
    'importedAt', p_received_at,
    'updatedAt', p_received_at
  );

  insert into public.worklog_states (user_id, log_date, organization, state, updated_at)
  values (
    manager_id,
    resolved_date,
    manager_org,
    jsonb_build_object('dagymDaily', jsonb_build_object(resolved_date::text, record_payload)),
    p_received_at
  )
  on conflict (user_id, organization, log_date) do update set
    state = jsonb_set(
      jsonb_set(
        coalesce(public.worklog_states.state, '{}'::jsonb),
        '{dagymDaily}',
        coalesce(public.worklog_states.state->'dagymDaily', '{}'::jsonb),
        true
      ),
      array['dagymDaily', resolved_date::text],
      record_payload,
      true
    ),
    updated_at = greatest(public.worklog_states.updated_at, excluded.updated_at);

  perform public.run_dagym_nightly_analysis(resolved_date + 1);

  return jsonb_build_object(
    'ok', true,
    'id', inserted_id,
    'reportDate', resolved_date,
    'quality', quality_value,
    'fieldCount', fields,
    'duplicateSafe', true
  );
end;
$$;

revoke all on function public.dagym_ceo_report_metric(text, text, boolean) from public, anon, authenticated;
revoke all on function public.rotate_dagym_ceo_ingest_token() from public, anon, authenticated;
revoke all on function public.ingest_dagym_ceo_report(text, text, date, timestamptz) from public;
grant execute on function public.ingest_dagym_ceo_report(text, text, date, timestamptz) to anon, authenticated;
