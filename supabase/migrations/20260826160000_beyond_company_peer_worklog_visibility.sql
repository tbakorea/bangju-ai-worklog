begin;

-- 김성민 실장과 추소영 매니저는 같은 (주)비욘드컴퍼니 운영 단위에서
-- 서로의 업무일지를 열람합니다. 두 계정 모두 직원 권한을 유지하므로
-- 출결·업무 수정·보고서 확정 권한은 각자 본인 기록에만 적용됩니다.
update public.profiles
set org = '(주)비욘드컴퍼니',
    workplace = '공유사업부',
    role = '매니저',
    name = '추소영',
    primary_work = '공유오피스, 공유창고, 고객관리',
    secondary_work = '비욘드컴퍼니 동료 업무일지 열람',
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
      - 'fitnessStaffRead'
    ) || jsonb_build_object('worklogSite', true),
    access_preset = 'employee',
    updated_at = now()
where lower(coalesce(email, '')) = 'l9900820@naver.com'
   or (
     trim(coalesce(name, '')) = '추소영'
     and concat_ws(' ', org, workplace, role, primary_work) ~* '비욘드\s*컴퍼니|공유|워크베이스|워크박스|beyond'
   );

-- The security-definer RPC deliberately returns only the viewer's own site
-- group. Recreate it here so deployed databases use the normalized Beyond
-- Company peer scope after the profile repair above.
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
