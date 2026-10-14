-- 최종 삭제 전: 사용자에게 영구 삭제를 설명하고 실행 시점 승인을 받은 후 실행합니다.
-- 먼저 계정 통합 SQL 실행 및 원본 24건 보존/유지 계정 조회를 검증해야 합니다.
begin;
do $$
declare
  source_id uuid := '194655af-7ecf-4c1f-b730-1441001e1610';
  target_id uuid := 'b56c6837-01fd-41a1-8f1a-820be63c2308';
  n integer;
begin
  if not exists(select 1 from auth.users where id=target_id and email='onse2@naver.com') then
    raise exception 'Canonical account missing';
  end if;
  if not exists(select 1 from public.account_merge_audits where merge_key='kimkyunghee-20261015'
    and source_user_id=source_id and target_user_id=target_id and jsonb_array_length(source_worklogs)=24) then
    raise exception 'Expected 24-row original backup missing';
  end if;
  if exists(select 1 from public.worklog_states where user_id=source_id) then
    raise exception 'Source worklogs have not all been transferred';
  end if;
  if (select count(*) from public.worklog_states where user_id=target_id)<25 then
    raise exception 'Canonical worklogs not verified';
  end if;
  delete from auth.users where id=source_id and email='projch@naver.com';
  get diagnostics n=row_count;
  if n>1 then raise exception 'Unexpected deleted count'; end if;
end $$;
commit;
