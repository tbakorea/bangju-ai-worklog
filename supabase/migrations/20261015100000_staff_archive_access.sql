begin;

-- 퇴사자 기록은 대표 및 직원관리 권한을 가진 관리자만 조회합니다.
create or replace function public.can_view_staff_archive()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_representative_profile() or exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.approval_status = 'approved'
      and case when p.permissions ? 'staffManage' then p.permissions->>'staffManage' = 'true'
        else p.access_preset in ('executive_delegate', 'operations_admin') end
    )
  );
$$;

create or replace function public.can_read_staff_history(target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where p.id = target_user
    and p.worklog_status = 'resigned'
    and (p.worklog_excluded_from is null or p.worklog_excluded_from <= (now() at time zone 'Asia/Seoul')::date)
  ) or public.can_view_staff_archive();
$$;
revoke all on function public.can_view_staff_archive() from public, anon;
revoke all on function public.can_read_staff_history(uuid) from public, anon;
grant execute on function public.can_view_staff_archive() to authenticated;
grant execute on function public.can_read_staff_history(uuid) to authenticated;

drop policy if exists profiles_archive_read_guard on public.profiles;
create policy profiles_archive_read_guard on public.profiles as restrictive for select to authenticated
using (public.can_read_staff_history(id));
drop policy if exists worklogs_archive_read_guard on public.worklog_states;
create policy worklogs_archive_read_guard on public.worklog_states as restrictive for select to authenticated
using (public.can_read_staff_history(user_id));

create or replace function public.get_archived_staff_worklogs(target_user uuid)
returns table (log_date date, organization text, worklog jsonb)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_view_staff_archive() then
    raise exception 'staff archive requires staff management access';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user
    and p.worklog_status = 'resigned'
    and (p.worklog_excluded_from is null or p.worklog_excluded_from <= (now() at time zone 'Asia/Seoul')::date)) then
    raise exception 'target is not an archived employee';
  end if;
  return query select w.log_date, w.organization,
    coalesce(w.state->'ownerWorklog',
      w.state->'employeeLogs'->to_char(w.log_date, 'YYYY-MM-DD')->(w.state->>'ownerEmployeeId'),
      w.state->'employeeLogs'->to_char(w.log_date, 'YYYY-MM-DD')->'profile-user', '{}'::jsonb)
    from public.worklog_states w where w.user_id = target_user
    order by w.log_date desc;
end;
$$;
revoke all on function public.get_archived_staff_worklogs(uuid) from public, anon;
grant execute on function public.get_archived_staff_worklogs(uuid) to authenticated;

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
  select
    w.user_id,
    jsonb_build_object(
      'profile', w.state -> 'profile',
      'ownerEmployeeId', w.state -> 'ownerEmployeeId',
      'ownerWorklogVersion', w.state -> 'ownerWorklogVersion',
      'ownerWorklog', w.state -> 'ownerWorklog',
      'selectedEmployeeId', w.state -> 'selectedEmployeeId',
      'employeeLogs', jsonb_build_object(
        to_char(target_date, 'YYYY-MM-DD'),
        w.state -> 'employeeLogs' -> to_char(target_date, 'YYYY-MM-DD')
      ),
      'dagymDaily', w.state -> 'dagymDaily',
      'dagymDailyAnalyses', w.state -> 'dagymDailyAnalyses',
      'fitnessDailyGuidance', w.state -> 'fitnessDailyGuidance'
    ) as state,
    w.updated_at
  from public.worklog_states w
  where public.can_read_staff_history(w.user_id)
    and w.log_date = target_date
    and w.user_id <> auth.uid()
  order by w.updated_at desc
  limit 500;
end;
$$;

revoke all on function public.get_visible_worklog_states(date) from public;
grant execute on function public.get_visible_worklog_states(date) to authenticated;

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
  select
    w.user_id,
    jsonb_build_object(
      'profile', w.state -> 'profile',
      'ownerEmployeeId', w.state -> 'ownerEmployeeId',
      'ownerWorklogVersion', w.state -> 'ownerWorklogVersion',
      'ownerWorklog', w.state -> 'ownerWorklog',
      'selectedEmployeeId', w.state -> 'selectedEmployeeId',
      'employeeLogs', jsonb_build_object(
        to_char(target_date, 'YYYY-MM-DD'),
        w.state -> 'employeeLogs' -> to_char(target_date, 'YYYY-MM-DD')
      ),
      'dagymDaily', w.state -> 'dagymDaily',
      'dagymDailyAnalyses', w.state -> 'dagymDailyAnalyses',
      'fitnessDailyGuidance', w.state -> 'fitnessDailyGuidance'
    ) as state,
    w.updated_at
  from public.worklog_states w
  join public.profiles colleague on colleague.id = w.user_id
  where public.can_read_staff_history(w.user_id)
    and w.log_date = target_date
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
  order by w.updated_at desc
  limit 500;
end;
$$;

revoke all on function public.get_coworker_worklog_states(date) from public;
grant execute on function public.get_coworker_worklog_states(date) to authenticated;


commit;
