-- 운영에서 대상·건수를 확인한 후 실행. Auth 계정 삭제는 별도 최종 확인 후 수행합니다.
begin;
do $$
declare
  source_id uuid := '194655af-7ecf-4c1f-b730-1441001e1610';
  target_id uuid := 'b56c6837-01fd-41a1-8f1a-820be63c2308';
  target_profile jsonb;
  expected bigint;
  moved bigint := 0;
  r record;
  own_log jsonb;
  next_state jsonb;
begin
  if not exists (select 1 from auth.users where id=source_id and email='projch@naver.com')
    or not exists (select 1 from auth.users where id=target_id and email='onse2@naver.com') then
    raise exception 'Expected account identities do not match';
  end if;
  if not exists (select 1 from public.profiles where id=target_id and name='김경희' and role='차장' and approval_status='approved') then
    raise exception 'Canonical Kim profile must be approved deputy general manager';
  end if;
  if exists (select 1 from public.worklog_states a join public.worklog_states b
    on a.organization=b.organization and a.log_date=b.log_date
    where a.user_id=source_id and b.user_id=target_id) then
    raise exception 'Worklog collision requires manual review';
  end if;
  insert into public.account_merge_audits(merge_key,source_user_id,target_user_id,source_profile,source_worklogs)
  select 'kimkyunghee-20261015',source_id,target_id,to_jsonb(p),
    coalesce((select jsonb_agg(to_jsonb(w)) from public.worklog_states w where w.user_id=source_id),'[]'::jsonb)
  from public.profiles p where p.id=source_id
  on conflict (merge_key) do nothing;
  if not exists (select 1 from public.account_merge_audits where merge_key='kimkyunghee-20261015' and source_user_id=source_id and target_user_id=target_id) then
    raise exception 'Missing merge audit';
  end if;
  select jsonb_build_object('email','onse2@naver.com','authUserId',target_id,'name','김경희','nickname','김경희','role','차장','org','(주)방주','workplace','재무','approvalStatus','approved') into target_profile;
  select count(*) into expected from public.worklog_states where user_id=source_id;
  for r in select * from public.worklog_states where user_id=source_id for update loop
    own_log := coalesce(nullif(r.state->'ownerWorklog','null'::jsonb),
      r.state->'employeeLogs'->r.log_date::text->(r.state->>'ownerEmployeeId'),
      r.state->'employeeLogs'->r.log_date::text->'profile-user');
    next_state := jsonb_set(r.state,'{profile}',coalesce(r.state->'profile','{}'::jsonb)||target_profile);
    if own_log is not null and own_log <> 'null'::jsonb then
      next_state := next_state || jsonb_build_object('ownerEmployeeId','bangju-finance-kimkyunghee',
        'selectedEmployeeId','bangju-finance-kimkyunghee','ownerWorklog',own_log,
        'employeeLogs',coalesce(r.state->'employeeLogs','{}'::jsonb)||jsonb_build_object(r.log_date::text,
          coalesce(r.state->'employeeLogs'->r.log_date::text,'{}'::jsonb)||jsonb_build_object('bangju-finance-kimkyunghee',own_log)));
    end if;
    update public.worklog_states set user_id=target_id,state=next_state where id=r.id;
    moved := moved+1;
  end loop;
  if moved <> expected then raise exception 'Unexpected transferred row count'; end if;
end $$;
commit;
