create or replace function public.get_visible_worklog_states(target_date date)
returns table (
  user_id uuid,
  state jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_profile_approver() then
    raise exception 'visible worklogs require approver access';
  end if;

  return query
  select w.user_id, w.state, w.updated_at
  from public.worklog_states w
  where w.log_date = target_date
    and w.user_id <> auth.uid()
  order by w.updated_at desc;
end;
$$;

revoke all on function public.get_visible_worklog_states(date) from public;
grant execute on function public.get_visible_worklog_states(date) to authenticated;

drop policy if exists "worklog_select_own" on public.worklog_states;
drop policy if exists "worklog_select_visible" on public.worklog_states;
create policy "worklog_select_visible"
on public.worklog_states for select
to authenticated
using (auth.uid() = user_id or public.is_profile_approver());
