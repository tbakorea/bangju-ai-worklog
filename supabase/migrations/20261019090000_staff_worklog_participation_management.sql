begin;
alter table public.profiles add column if not exists worklog_participation_mode text not null default 'auto';
alter table public.profiles drop constraint if exists profiles_worklog_participation_mode_check;
alter table public.profiles add constraint profiles_worklog_participation_mode_check check (worklog_participation_mode in ('auto','included','excluded'));

create or replace function public.can_manage_staff_worklog_participation()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (public.is_representative_profile() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.approval_status = 'approved'
    and case when p.permissions ? 'staffManage' then p.permissions->>'staffManage' = 'true'
      else p.access_preset in ('executive_delegate', 'operations_admin') end
  ));
$$;
revoke all on function public.can_manage_staff_worklog_participation() from public, anon;
grant execute on function public.can_manage_staff_worklog_participation() to authenticated;

create or replace function public.guard_profile_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.worklog_participation_mode is distinct from old.worklog_participation_mode
    or new.worklog_status is distinct from old.worklog_status
    or new.worklog_status_reason is distinct from old.worklog_status_reason
    or new.worklog_excluded_from is distinct from old.worklog_excluded_from
    or new.worklog_excluded_until is distinct from old.worklog_excluded_until
    or new.worklog_status_updated_by is distinct from old.worklog_status_updated_by
    or new.worklog_status_updated_at is distinct from old.worklog_status_updated_at
  ) and not public.can_manage_staff_worklog_participation() then
    raise exception 'worklog participation fields require staff management access';
  end if;

  if auth.uid() = new.id
    and not public.is_profile_approver()
    and (
      new.approval_status is distinct from old.approval_status
      or new.approval_note is distinct from old.approval_note
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.assigned_mission is distinct from old.assigned_mission
      or new.assigned_mission_visible is distinct from old.assigned_mission_visible
      or new.assigned_mission_updated_by is distinct from old.assigned_mission_updated_by
      or new.assigned_mission_updated_at is distinct from old.assigned_mission_updated_at
    )
  then
    raise exception 'approval and assigned mission fields can only be changed by an approver';
  end if;
  return new;
end;
$$;


create or replace function public.set_staff_worklog_participation(
  target_profile_id uuid, target_status text, target_mode text,
  effective_from date default null, effective_until date default null, change_reason text default ''
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.can_manage_staff_worklog_participation() then
    raise exception 'staff management access required';
  end if;
  if target_status is null or target_status not in ('active','resigned','leave_of_absence','sick_leave','other_excluded')
    or target_mode is null or target_mode not in ('auto','included','excluded') then
    raise exception 'invalid status or participation mode';
  end if;
  if (target_status <> 'active' or target_mode = 'excluded')
    and (effective_from is null or nullif(trim(change_reason),'') is null) then
    raise exception 'effective date and reason required';
  end if;
  if effective_until is not null and (effective_from is null or effective_until < effective_from) then
    raise exception 'invalid return date';
  end if;
  update public.profiles p set
    worklog_status = target_status,
    worklog_participation_mode = case when target_status = 'resigned' then 'auto' else target_mode end,
    worklog_status_reason = case when target_status = 'active' and target_mode <> 'excluded' then '' else trim(change_reason) end,
    worklog_excluded_from = case when target_status = 'active' and target_mode <> 'excluded' then null else effective_from end,
    worklog_excluded_until = case when target_status = 'resigned' or (target_status = 'active' and target_mode <> 'excluded') then null else effective_until end,
    worklog_status_updated_by = auth.uid(), worklog_status_updated_at = now(), updated_at = now()
    where p.id = target_profile_id returning to_jsonb(p) into result;
  if result is null then raise exception 'employee profile not found'; end if;
  return result;
end;
$$;
revoke all on function public.set_staff_worklog_participation(uuid,text,text,date,date,text) from public, anon;
grant execute on function public.set_staff_worklog_participation(uuid,text,text,date,date,text) to authenticated;

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
      'profile', coalesce(w.state -> 'profile', '{}'::jsonb) || jsonb_build_object('worklogStatus', owner_profile.worklog_status, 'worklogParticipationMode', owner_profile.worklog_participation_mode, 'worklogStatusReason', owner_profile.worklog_status_reason, 'worklogExcludedFrom', owner_profile.worklog_excluded_from, 'worklogExcludedUntil', owner_profile.worklog_excluded_until),
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
  join public.profiles owner_profile on owner_profile.id = w.user_id
  where public.can_read_staff_history(w.user_id)
    and w.log_date = target_date
    and w.user_id <> auth.uid()
  order by w.updated_at desc
  limit 500;
end;
$$;

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
      'profile', coalesce(w.state -> 'profile', '{}'::jsonb) || jsonb_build_object('worklogStatus', colleague.worklog_status, 'worklogParticipationMode', colleague.worklog_participation_mode, 'worklogStatusReason', colleague.worklog_status_reason, 'worklogExcludedFrom', colleague.worklog_excluded_from, 'worklogExcludedUntil', colleague.worklog_excluded_until),
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

commit;
