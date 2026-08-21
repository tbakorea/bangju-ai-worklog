begin;

create or replace function public.can_view_worklog_coaching_followups()
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
        or coalesce((p.permissions ->> 'worklogAll')::boolean, false)
        or coalesce((p.permissions ->> 'controlTower')::boolean, false)
        or coalesce((p.permissions ->> 'staffManage')::boolean, false)
        or coalesce(p.role, '') ~* '대표|총괄|임원|admin|owner'
        or coalesce(p.primary_work, '') ~* '대표|총괄|임원|admin|owner'
      )
  );
$$;

revoke all on function public.can_view_worklog_coaching_followups() from public, anon;
grant execute on function public.can_view_worklog_coaching_followups() to authenticated;

create table if not exists public.worklog_coaching_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id text not null default '',
  employee_name text not null default '',
  organization text not null default '',
  log_date date not null,
  report_scope text not null default 'worklog'
    check (report_scope in ('worklog', 'fitness')),
  coaching_key text not null default '',
  coaching_snapshot jsonb not null default '{}'::jsonb,
  response_code text not null default 'pending'
    check (response_code in ('pending', 'execute', 'already', 'support', 'explain', 'defer')),
  response_note text not null default '',
  action_text text not null default '',
  due_date date,
  status text not null default 'acknowledged'
    check (status in ('acknowledged', 'in_progress', 'completed', 'support_needed', 'deferred')),
  result_note text not null default '',
  followup_result text not null default 'unchecked'
    check (followup_result in ('unchecked', 'improved', 'recurring', 'blocked')),
  review_note text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_by_name text not null default '',
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date, report_scope)
);

alter table public.worklog_coaching_followups
  add column if not exists review_note text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by_name text not null default '';

create or replace function public.protect_worklog_coaching_review_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.user_id then
    new.followup_result := old.followup_result;
    new.review_note := old.review_note;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_by_name := old.reviewed_by_name;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_worklog_coaching_review_fields_trigger on public.worklog_coaching_followups;
create trigger protect_worklog_coaching_review_fields_trigger
before update on public.worklog_coaching_followups
for each row execute function public.protect_worklog_coaching_review_fields();

create or replace function public.review_worklog_coaching_followup(
  p_followup_id uuid,
  p_followup_result text,
  p_review_note text default '',
  p_reviewer_name text default ''
)
returns setof public.worklog_coaching_followups
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_view_worklog_coaching_followups() then
    raise exception 'coaching followup review requires delegated access';
  end if;
  if p_followup_result not in ('unchecked', 'improved', 'recurring', 'blocked') then
    raise exception 'invalid coaching followup result';
  end if;
  return query
  update public.worklog_coaching_followups w
  set followup_result = p_followup_result,
      review_note = left(coalesce(p_review_note, ''), 1600),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      reviewed_by_name = left(coalesce(p_reviewer_name, ''), 160),
      updated_at = now()
  where w.id = p_followup_id
    and w.user_id <> auth.uid()
  returning w.*;
end;
$$;

revoke all on function public.review_worklog_coaching_followup(uuid, text, text, text) from public, anon;
grant execute on function public.review_worklog_coaching_followup(uuid, text, text, text) to authenticated;

create index if not exists worklog_coaching_followups_due_idx
on public.worklog_coaching_followups (due_date, status, log_date desc);

create index if not exists worklog_coaching_followups_employee_idx
on public.worklog_coaching_followups (employee_id, log_date desc);

alter table public.worklog_coaching_followups enable row level security;

drop policy if exists "worklog_coaching_followups_select_visible" on public.worklog_coaching_followups;
create policy "worklog_coaching_followups_select_visible"
on public.worklog_coaching_followups for select
to authenticated
using (user_id = auth.uid() or public.can_view_worklog_coaching_followups());

drop policy if exists "worklog_coaching_followups_insert_own" on public.worklog_coaching_followups;
create policy "worklog_coaching_followups_insert_own"
on public.worklog_coaching_followups for insert
to authenticated
with check (
  user_id = auth.uid()
  and followup_result = 'unchecked'
  and review_note = ''
  and reviewed_at is null
  and reviewed_by is null
  and reviewed_by_name = ''
);

drop policy if exists "worklog_coaching_followups_update_own" on public.worklog_coaching_followups;
create policy "worklog_coaching_followups_update_own"
on public.worklog_coaching_followups for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "worklog_coaching_followups_update_reviewer" on public.worklog_coaching_followups;

revoke insert, update, delete on public.worklog_coaching_followups from anon;
grant select, insert, update on public.worklog_coaching_followups to authenticated;

commit;
