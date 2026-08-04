begin;

insert into public.profiles (
  id, email, org, role, name, workplace, primary_work, secondary_work,
  employment_type, work_hours, approval_status, approval_note, approved_at, updated_at
)
select
  id, email, '(주)방주 / 비욘드 피트니스 지사', '트레이너', '홍현규', '비욘드 피트니스',
  'PT 수업', '회원관리, 센터 운영 지원', '프리랜서', '06:00-24:00', 'approved', '', now(), now()
from auth.users
where lower(coalesce(email, '')) = 'gusrd1005@gmail.com'
on conflict (id) do update set
  email = excluded.email,
  org = excluded.org,
  role = excluded.role,
  name = excluded.name,
  workplace = excluded.workplace,
  primary_work = excluded.primary_work,
  secondary_work = excluded.secondary_work,
  employment_type = excluded.employment_type,
  work_hours = excluded.work_hours,
  approval_status = 'approved',
  approval_note = '',
  approved_at = coalesce(public.profiles.approved_at, now()),
  updated_at = now();

update public.profiles
set org = '(주)방주 / 비욘드 피트니스 지사',
    role = '센터장',
    name = '박주홍',
    workplace = '비욘드 피트니스',
    primary_work = '비욘드 피트니스 운영총괄, PT 수업',
    secondary_work = '센터 운영관리',
    employment_type = '직원',
    work_hours = '06:00-24:00',
    approval_status = 'approved',
    approval_note = '',
    approved_at = coalesce(approved_at, now()),
    updated_at = now()
where lower(coalesce(email, '')) = 'pinong0@naver.com';

do $$
declare
  active_manager_id uuid;
begin
  select id into active_manager_id
  from auth.users
  where lower(coalesce(email, '')) = 'pinong0@naver.com'
  limit 1;

  if active_manager_id is not null then
    insert into public.worklog_states (user_id, log_date, organization, state, updated_at)
    select distinct on (source.log_date, source.organization)
      active_manager_id,
      source.log_date,
      source.organization,
      source.state,
      source.updated_at
    from public.worklog_states source
    join auth.users retired on retired.id = source.user_id
    where lower(coalesce(retired.email, '')) in ('pjhong0@naver.com', 'pjhong1@naver.com', 'pjhong9@naver.com')
    order by source.log_date, source.organization, source.updated_at desc
    on conflict (user_id, organization, log_date) do nothing;
    delete from auth.users
    where lower(coalesce(email, '')) in ('pjhong0@naver.com', 'pjhong1@naver.com', 'pjhong9@naver.com');
  end if;
end
$$;

commit;
