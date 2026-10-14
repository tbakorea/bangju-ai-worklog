# 김경희 차장 직급 변경

- 소스: 직급 선택에 차장 추가, 방주 기본 명부를 강정훈 상무이사·김경희 차장·이소미 대리로 정정.
- 기존 projch@naver.com 고정 연결 제거. 김경희는 방주 소속과 이름으로 기존 업무일지 슬롯을 유지.
- 운영 직급 정정: `supabase/migrations/20261015090000_kimkyunghee_deputy_general_manager.sql` 준비. 운영 SQL Editor 입력·조회가 멈춰 있어 미적용.
- 원계정 통합, 승인, projch@naver.com 삭제는 미실행. 가입 당시 비밀번호를 보존하려면 김경희 원계정을 유지해야 함.
- 정적 QA·100명×90일 시뮬레이션·git diff --check 통과. 이번 브라우저 QA는 localhost 페이지 이동 30초 시간 초과로 미통과.

## 후속 완료

2026-10-15 최종 승인 후 원계정 onse2@naver.com의 차장·승인 완료·활성 상태를 운영 DB에서 확인했고, 24건 원본 보존·이전 및 projch@naver.com 삭제를 완료했다. 자세한 결과는 20261015-kimkyunghee-merge-and-staff-archive.md를 참조한다.
