-- 기존 홍길동 로그인 계정을 김경희 재무 직원 계정으로 전환합니다.
-- 로그인 이메일은 사용자가 추후 변경할 때까지 그대로 유지합니다.
begin;

-- 운영 DB의 기존 승인 보호 함수가 참조하는 누락 컬럼을 보완합니다.
alter table public.profiles add column if not exists assigned_mission text not null default '';
alter table public.profiles add column if not exists assigned_mission_visible boolean not null default true;
alter table public.profiles add column if not exists assigned_mission_updated_by uuid references auth.users(id);
alter table public.profiles add column if not exists assigned_mission_updated_at timestamptz;
alter table public.profiles add column if not exists pending_profile_changes jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists profile_change_requested_at timestamptz;

do $$
declare
  reassigned_count integer;
begin
  update public.profiles as profile
  set
    org = '(주)방주',
    workplace = '재무',
    role = '직원',
    name = '김경희',
    -- 로그인 이메일은 사용자가 추후 변경할 때까지 Auth 계정의 현재 이메일을 유지합니다.
    email = auth_user.email,
    primary_work = '재무',
    secondary_work = '자금·회계·지출 관리',
    employment_type = '직원',
    work_hours = '08:30-17:30',
    weekly_work_hours = jsonb_build_object(
      'mon', '08:30-17:30',
      'tue', '08:30-17:30',
      'wed', '08:30-17:30',
      'thu', '08:30-17:30',
      'fri', '08:30-17:30'
    ),
    approval_status = 'approved',
    approval_note = '',
    approved_at = coalesce(profile.approved_at, now()),
    pending_profile_changes = '{}'::jsonb,
    profile_change_requested_at = null,
    access_preset = 'employee',
    permissions = '{}'::jsonb,
    worklog_status = 'active',
    worklog_status_reason = '',
    worklog_excluded_from = null,
    worklog_excluded_until = null,
    updated_at = now()
  from auth.users as auth_user
  where profile.id = auth_user.id
    and lower(coalesce(auth_user.email, profile.email, '')) = 'projch@naver.com';

  get diagnostics reassigned_count = row_count;
  if reassigned_count <> 1 then
    raise exception 'Expected exactly one existing 홍길동 login profile (projch@naver.com), updated % rows', reassigned_count;
  end if;
end $$;

commit;
