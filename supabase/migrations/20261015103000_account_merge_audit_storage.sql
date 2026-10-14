begin;

create table if not exists public.account_merge_audits (
  merge_key text primary key,
  source_user_id uuid not null,
  target_user_id uuid not null,
  source_profile jsonb not null,
  source_worklogs jsonb not null,
  merged_at timestamptz not null default now()
);
alter table public.account_merge_audits enable row level security;
drop policy if exists account_merge_audits_admin_read on public.account_merge_audits;
create policy account_merge_audits_admin_read on public.account_merge_audits for select to authenticated using (public.can_view_staff_archive());
revoke all on public.account_merge_audits from anon, authenticated;
grant select on public.account_merge_audits to authenticated;

commit;
