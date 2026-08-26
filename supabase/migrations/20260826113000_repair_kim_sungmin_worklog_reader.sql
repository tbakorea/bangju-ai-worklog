begin;

-- Re-assert the narrowly-scoped Beyond Company manager reader after older
-- profile imports. This does not grant staff, labor, attendance, or editing
-- authority; it only restores read-only access to the managed Fitness team.
update public.profiles
set org = '(주)비욘드컴퍼니',
    workplace = 'TBA studio',
    role = '실장',
    permissions = (
      coalesce(permissions, '{}'::jsonb)
      - 'executiveRoom'
      - 'controlTower'
      - 'siteControl'
      - 'worklogAll'
      - 'laborAll'
      - 'laborSite'
      - 'staffApproval'
      - 'staffManage'
    ) || jsonb_build_object('worklogSite', true, 'fitnessStaffRead', true),
    access_preset = 'employee',
    updated_at = now()
where lower(coalesce(email, '')) = 'tbakorea@gmail.com';

-- The RPC is security-definer because the underlying worklog policy stays
-- intentionally strict. Scope the exception to an approved Beyond Company
-- profile carrying fitnessStaffRead, and return no other business' records.
create or replace function public.get_coworker_worklog_states(target_date date)
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
declare
  viewer_site text;
  can_view_fitness boolean := false;
begin
  select
    case
      when concat_ws(' ', p.org, p.workplace) ~* '피트니스|fitness' then 'fitness'
      when concat_ws(' ', p.org, p.workplace, p.primary_work) ~* '비욘드\s*컴퍼니|공유|TBA|티비에이|워크베이스|워크박스|beyond' then 'beyond'
      else 'bangju'
    end,
    public.can_view_beyond_company_fitness_worklogs()
  into viewer_site, can_view_fitness
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.approval_status, 'pending') = 'approved';

  if auth.uid() is null or viewer_site is null then
    raise exception 'approved coworker worklogs require authentication';
  end if;

  return query
  select w.user_id, w.state, w.updated_at
  from public.worklog_states w
  join public.profiles colleague on colleague.id = w.user_id
  where w.log_date = target_date
    and w.user_id <> auth.uid()
    and coalesce(colleague.approval_status, 'pending') = 'approved'
    and (
      case
        when concat_ws(' ', colleague.org, colleague.workplace) ~* '피트니스|fitness' then 'fitness'
        when concat_ws(' ', colleague.org, colleague.workplace, colleague.primary_work) ~* '비욘드\s*컴퍼니|공유|TBA|티비에이|워크베이스|워크박스|beyond' then 'beyond'
        else 'bangju'
      end = viewer_site
      or (
        can_view_fitness
        and case
          when concat_ws(' ', colleague.org, colleague.workplace) ~* '피트니스|fitness' then 'fitness'
          when concat_ws(' ', colleague.org, colleague.workplace, colleague.primary_work) ~* '비욘드\s*컴퍼니|공유|TBA|티비에이|워크베이스|워크박스|beyond' then 'beyond'
          else 'bangju'
        end = 'fitness'
      )
    )
  order by w.updated_at desc;
end;
$$;

revoke all on function public.get_coworker_worklog_states(date) from public;
grant execute on function public.get_coworker_worklog_states(date) to authenticated;

commit;
