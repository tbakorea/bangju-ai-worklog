# 김경희 유지 계정 및 퇴사자 보관

## 운영 조회 확인

- 유지 계정: onse2@naver.com / 김경희 / 차장 / approved / active. 업무일지 1행.
- 삭제 대상: projch@naver.com / 김경희 / 직원 / approved / active. 업무일지 24행.
- 두 계정의 업무일지 날짜 충돌: 0행.
- 삭제 대상 UUID를 참조하는 public 테이블의 실제 데이터: profiles 1행, worklog_states 24행. 다른 public 외래키 참조는 0행.
- 두 Auth ID는 별도 operations SQL의 검증 조건에 고정되어 있다. 비밀번호는 읽거나 변경하지 않는다.

## 구현

- 김경희의 기본 명부 및 배치 기준은 onse2@naver.com 한 계정으로 통일. projch@naver.com은 명부에서 제외한다. 이는 Auth 계정 영구 삭제와 별개다.
- 퇴사자는 현재 업무일지와 일반 직원명부에서 제외. 직원 메뉴의 퇴사자 보관 섹션은 대표 또는 staffManage 권한 관리자 전용이다.
- 퇴사자 기록은 별도 RPC로 본인의 업무일지만 읽기 전용 조회한다.
- profiles/worklog_states에는 제한형 SELECT 정책을 추가하고 두 SECURITY DEFINER 조회 함수에도 퇴사자 접근 검사를 추가한다.
- 퇴사는 복귀 예정일이 지나도 자동 복귀하지 않는다.

## 운영 적용 상태: 승인 대기 / 미적용

자동 승인 검토가 운영 DB 함수·RLS 정책 교체 및 감사 보관표 생성을 지속적 보안 변경으로 판단해 실행을 거절했다. 사용자에게 이 DB 적용과 백업·이전 후 영구 삭제의 최종 승인을 요청했다. 이번 작업에서는 계정 데이터 이전 또는 삭제를 실행하지 않았다.

적용 순서:

1. 20261015100000_staff_archive_access.sql
2. 20261015103000_account_merge_audit_storage.sql
3. operations/20261015_merge_kimkyunghee_accounts.sql: 관리자 전용 감사표에 프로필과 원본 24행을 보존하고, 유지 계정으로 업무일지 소유권을 이전한다. 날짜·조직키 충돌 시 중단한다. 기존 업무일지 내용은 보존하고 로그인 프로필의 이름·이메일·직급만 유지 계정으로 정규화한다.
4. 원본 보존 24행, 유지 계정 25행, 이전 계정 0행을 재조회한다.
5. 실행 시점의 영구 삭제 승인 후 operations/20261015_delete_merged_projch_account.sql 실행. 일반 로그인 복구는 불가능하며 원본 기록은 감사표에 유지된다.
6. Auth 조회에서 onse2@naver.com 존재 / projch@naver.com 부재를 확인한다.

## 검증

- qa-check.sh 및 100명×90일 시뮬레이션 통과.
- git diff --check 통과.
- 새 기능 전용 Playwright: phone 390×844 / iPad 820×1180 / desktop 1440×1000 통과. 김경희 1명, 유지 이메일, 현재 목록 제외, 보관 보존, 퇴사 자동복귀 방지, 대표·관리자 허용, 일반 직원 거부, 가로 넘침 없음 확인.
- 전체 mobile-browser-qa.sh는 기존 피트니스 개인 월 누계 검증에서 실패. 전체 통과로 보고하지 않는다.
- 운영 RLS/RPC는 승인 대기로 아직 적용 및 실제 DB 권한 검증을 수행하지 못했다.
