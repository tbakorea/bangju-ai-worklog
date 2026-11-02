# 피트니스 보고서 이슈 QA · 2026-11-02

- `./scripts/qa-check.sh`: 통과, 100명×90일 시뮬레이션 포함.
- `node --test scripts/fitness-report-issues.test.cjs`: 개인정보 제외·중복 분류·자료 날짜 검증·인증·수신자 제한·승인상태·잘못된 날짜 검증 통과.
- `node scripts/fitness-report-issues-browser-qa.cjs`: 390/820/1440에서 보고서·텍스트 출력 반영, 출력 영역 내부 배치, HTML 이스케이프, AI 입력 제외, 날짜/계정/다른 직원 격리, 조회 실패 표시 통과.
- `./scripts/mobile-browser-qa.sh`: 기존 퇴사자 김영채 fixture 기대값에서 실패 (`representative fitness view should load Kim Young-chae's profile-user worklog`). 본 기능 변경 전부터 기록된 실패이며 이번 작업에서 퇴사자 노출 동작은 변경하지 않음.
- 운영 DB 읽기 검증: 수신자 3명의 기존 이메일·이름·승인 완료 상태 일치 확인. 각 수신자 계정으로 로그인한 보고서의 실자료 대조는 별도 검증 대상. 승인·프로필·업무일지에 테스트 쓰기는 수행하지 않음.
