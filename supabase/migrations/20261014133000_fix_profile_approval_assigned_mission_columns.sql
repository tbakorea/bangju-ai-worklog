begin;

-- The approval guard below protects assignment fields. Older production
-- databases may have the guard function but not these columns, which causes
-- every profile update (including employee approval) to fail at runtime.
alter table public.profiles add column if not exists assigned_mission text not null default '';
alter table public.profiles add column if not exists assigned_mission_visible boolean not null default true;
alter table public.profiles add column if not exists assigned_mission_updated_by uuid references auth.users(id);
alter table public.profiles add column if not exists assigned_mission_updated_at timestamptz;

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

drop trigger if exists guard_profile_approval_fields_trigger on public.profiles;
create trigger guard_profile_approval_fields_trigger
before update on public.profiles
for each row
execute function public.guard_profile_approval_fields();

commit;
