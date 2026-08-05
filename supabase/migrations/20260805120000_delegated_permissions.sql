begin;

alter table public.profiles
  add column if not exists access_preset text not null default 'employee';

alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb;

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
        lower(coalesce(p.email, '')) in ('j3010@ymail.com', 'tbakorea@gmail.com')
        or coalesce((p.permissions ->> 'staffApproval')::boolean, false)
        or coalesce((p.permissions ->> 'staffManage')::boolean, false)
        or coalesce(p.role, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
        or coalesce(p.primary_work, '') ~* '대표|관리자|센터장|총괄|임원|admin|owner|manager'
      )
  );
$$;

create or replace function public.protect_delegated_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    new.access_preset := old.access_preset;
    new.permissions := old.permissions;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_delegated_profile_permissions on public.profiles;
create trigger protect_delegated_profile_permissions
before update of access_preset, permissions on public.profiles
for each row execute function public.protect_delegated_profile_permissions();

commit;
