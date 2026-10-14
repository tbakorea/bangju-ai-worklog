# 김경희 계정 전환 적용 기록

- 적용일: 2026-10-15 (한국 시간)
- 운영 프로젝트: bangju-ai-worklog (`zllpfaijahyfppivkxzu`)
- 적용 방식: 로그인된 운영 SQL Editor에서 트랜잭션 실행 후 별도 SELECT 재조회
- 계정: 기존 `projch@naver.com` Auth 계정 유지
- 결과: 김경희 / (주)방주 / 재무 / 직원, 월~금 08:30-17:30, approved / active, employee / {}
- 운영 DB에 `supabase_migrations.schema_migrations` 테이블이 없어 CLI 적용 이력은 없음. 이 계정 전환을 다시 실행할 필요 없음.
- 처음 두 시도는 누락 컬럼 오류로 실패했고 변경되지 않음. 누락된 assigned_mission 관련 4개 컬럼과 pending_profile_changes, profile_change_requested_at을 저장소 스키마와 동일하게 추가한 트랜잭션이 성공함.
- 적용 SQL은 `supabase/migrations/20261014160000_reassign_honggildong_to_kimkyunghee.sql`에 반영. 기존 활성 상태의 변경자·변경시각은 보존함.
- 정적 QA, 100명×90일 시뮬레이션, git diff --check 통과.
- 승인 큐 mock, 본인 업무일지 진입 기대값, 입력 지연 저장 대기를 보완함. 다짐 동일 업무일지 ID 중복 매칭도 수정함.
- 모바일 QA 전체 실행은 미통과. 후반 단독 실행에서 피트니스 개인 월 누계 테스트가 실패함(현재 화면의 personalMonthHidden=true, compactTotals=0/0). 계정 전환·본인 입력 저장 검증은 통과했지만 전체 QA 통과로 취급하지 않음.
- 운영 계정 전환 이후 사용자의 커밋·푸시 요청에 따라 소스와 이 기록을 커밋 대상에 포함함. 운영 DB 전환 SQL은 재실행하지 않음.
