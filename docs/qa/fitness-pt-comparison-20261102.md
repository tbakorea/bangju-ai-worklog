# 전날 PT 대조 QA · 2026-11-02

- 정적 QA·100명×90일 시뮬레이션 통과.
- `node --test scripts/fitness-pt-comparison.test.cjs`: 6건 통과. 수업 ID/시간/유무료, 대응 미확인, 수기 시간 다중집합, 중복 ID, 취소/노쇼/연기, 원본/일지 누락·오래된 수집·다른 날짜, KST 월말/자정, 인증/승인/직무/타인 ID 조작 검증.
- `node scripts/fitness-pt-comparison-browser-qa.cjs`: 390/820/1440에서 시작 시각과 유무료 차이, HTML 이스케이프, AI 입력 제외, 센터/타직원/다른 날짜/계정 전환 격리, 조회 실패/잘못된 근거일, 보고서 수평 배치와 20건 차이 출력 높이 검증 통과.
- 운영 읽기 검증: 승인된 PT 담당 계정 2개. 2026-11-01 연결된 시간표 행 없음 → 2개 계정 대조 보류. 실제 일치/불일치 사례는 모의자료로 검증했으며 운영 자료에 테스트 쓰기 없음.
- 전체 `./scripts/mobile-browser-qa.sh`는 기존 퇴사자 김영채 fixture 기대값(`representative fitness view should load Kim Young-chae's profile-user worklog`)에서 실패. 퇴사자 노출 동작 변경 없음.
