begin;

-- Organization hierarchy: Beyond Fitness and the shared-business unit are
-- operated inside (주)비욘드컴퍼니. Keep the historical employee records, but
-- normalize their current organization label for the worklog directory.
update public.profiles
set org = '(주)비욘드컴퍼니 / 비욘드 피트니스',
    workplace = '비욘드 피트니스',
    updated_at = now()
where concat_ws(' ', org, workplace) ~* '피트니스|fitness'
  and (
    org is distinct from '(주)비욘드컴퍼니 / 비욘드 피트니스'
    or workplace is distinct from '비욘드 피트니스'
  );

-- Kim Sungmin manages the Beyond Company operation and needs read-only access
-- to its fitness-team worklogs. The granular permission can later be assigned
-- to another Beyond Company manager without granting global staff authority.
update public.profiles
set org = '(주)비욘드컴퍼니',
    workplace = 'TBA studio',
    role = '실장',
    primary_work = 'TBA studio 운영, 인월바스 시스템 시공, 인테리어 시행',
    secondary_work = '제품·시공·현장 운영 지원, 산하 센터 업무일지 열람',
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
    )
      || jsonb_build_object('worklogSite', true, 'fitnessStaffRead', true),
    access_preset = 'employee',
    updated_at = now()
where lower(coalesce(email, '')) = 'tbakorea@gmail.com';

-- is_profile_approver controls global staff/profile/labor administration.
-- Do not treat the Beyond Company manager as a global approver merely by
-- email or title; the scoped function below is used for fitness worklog views.
create or replace function public.is_profile_approver()
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
        lower(coalesce(p.email, '')) = 'j3010@ymail.com'
        or coalesce((p.permissions ->> 'staffApproval')::boolean, false)
        or coalesce((p.permissions ->> 'staffManage')::boolean, false)
        or (
          lower(coalesce(p.email, '')) <> 'tbakorea@gmail.com'
          and (
            coalesce(p.role, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
            or coalesce(p.primary_work, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
          )
        )
      )
  );
$$;

create or replace function public.can_view_beyond_company_fitness_worklogs()
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
      and coalesce(p.approval_status, 'pending') = 'approved'
      and coalesce((p.permissions ->> 'fitnessStaffRead')::boolean, false)
      and concat_ws(' ', p.org, p.workplace, p.primary_work, p.role) ~* '비욘드\s*컴퍼니|beyond\s*company'
      and concat_ws(' ', p.org, p.workplace) !~* '피트니스|fitness'
  );
$$;

revoke all on function public.can_view_beyond_company_fitness_worklogs() from public, anon;
grant execute on function public.can_view_beyond_company_fitness_worklogs() to authenticated;

-- Keep the existing leadership follow-up view for authorized leaders, but do
-- not let the new scoped fitness-worklog permission open every employee's
-- coaching history across the group.
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
        lower(coalesce(p.email, '')) = 'j3010@ymail.com'
        or coalesce((p.permissions ->> 'worklogAll')::boolean, false)
        or coalesce((p.permissions ->> 'controlTower')::boolean, false)
        or coalesce((p.permissions ->> 'staffManage')::boolean, false)
        or (
          lower(coalesce(p.email, '')) <> 'tbakorea@gmail.com'
          and (
            coalesce(p.role, '') ~* '대표|총괄|임원|admin|owner'
            or coalesce(p.primary_work, '') ~* '대표|총괄|임원|admin|owner'
          )
        )
      )
  );
$$;

revoke all on function public.can_view_worklog_coaching_followups() from public, anon;
grant execute on function public.can_view_worklog_coaching_followups() to authenticated;

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
