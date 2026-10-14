-- 원계정과 전환 계정 모두 김경희의 직급을 차장으로 정정합니다.
-- 계정 통합·승인·삭제 및 로그인 정보는 이 마이그레이션에서 변경하지 않습니다.
begin;
update public.profiles
set role = '차장', updated_at = now()
where name = '김경희'
  and org = '(주)방주'
  and role is distinct from '차장';
commit;
