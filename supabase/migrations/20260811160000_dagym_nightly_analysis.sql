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

