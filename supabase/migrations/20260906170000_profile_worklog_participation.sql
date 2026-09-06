begin;

alter table public.profiles add column if not exists worklog_status text not null default 'active';
alter table public.profiles add column if not exists worklog_status_reason text not null default '';
alter table public.profiles add column if not exists worklog_excluded_from date;
alter table public.profiles add column if not exists worklog_excluded_until date;
alter table public.profiles add column if not exists worklog_status_updated_by uuid references auth.users(id);
alter table public.profiles add column if not exists worklog_status_updated_at timestamptz;

update public.profiles
set worklog_status = 'active'
where worklog_status is null or worklog_status = '';

alter table public.profiles drop constraint if exists profiles_worklog_status_check;
alter table public.profiles add constraint profiles_worklog_status_check
check (worklog_status in ('active', 'resigned', 'leave_of_absence', 'sick_leave', 'other_excluded'));

alter table public.profiles drop constraint if exists profiles_worklog_exclusion_period_check;
alter table public.profiles add constraint profiles_worklog_exclusion_period_check
check (
  worklog_excluded_until is null
  or worklog_excluded_from is null
  or worklog_excluded_until >= worklog_excluded_from
);

create index if not exists profiles_worklog_participation_idx
on public.profiles (worklog_status, worklog_excluded_from);

-- 업무일지 대상 제외는 대표만 변경할 수 있습니다. 다른 권한자는 직원정보를
-- 관리하더라도 퇴사·휴직·병가 상태나 복귀일을 바꿀 수 없습니다.
create or replace function public.is_representative_profile()
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
        or coalesce(p.role, '') ~* '대표|owner'
        or coalesce(p.primary_work, '') ~* '대표|owner'
      )
  );
$$;

create or replace function public.guard_profile_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.worklog_status is distinct from old.worklog_status
    or new.worklog_status_reason is distinct from old.worklog_status_reason
    or new.worklog_excluded_from is distinct from old.worklog_excluded_from
    or new.worklog_excluded_until is distinct from old.worklog_excluded_until
    or new.worklog_status_updated_by is distinct from old.worklog_status_updated_by
    or new.worklog_status_updated_at is distinct from old.worklog_status_updated_at
  ) and not public.is_representative_profile() then
    raise exception 'worklog participation fields can only be changed by the representative';
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

commit;
