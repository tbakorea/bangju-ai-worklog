# 운영 DB 원격 적용

직원 업무일지 대표 조회처럼 DB 변경이 필요한 작업은 GitHub Actions에서 원격으로 적용합니다.

## 최초 1회 설정

1. GitHub 저장소의 `Settings → Environments → production`을 엽니다.
2. `Environment secrets`에 `SUPABASE_DB_URL`을 등록합니다.
3. 값은 운영 프로젝트의 `Connect → Session pooler`에 표시되는 Postgres 연결 문자열을 사용합니다.
4. 연결 문자열의 비밀번호와 특수문자는 URL 인코딩된 값을 사용합니다.

연결 문자열과 비밀번호는 코드, 이슈, Actions 로그에 직접 적지 않습니다.

## 원격 적용

1. GitHub 저장소의 `Actions → Apply Supabase migrations`를 엽니다.
2. `Run workflow`에서 먼저 `dry-run`을 실행해 적용 대상을 확인합니다.
3. 같은 메뉴에서 `apply`를 실행합니다.
4. 성공 후 대표 계정에서 해당 날짜를 다시 열어 직원 업무일지를 확인합니다.

워크플로는 `supabase/migrations`의 미적용 SQL만 실행하며 기존 업무일지 데이터를 삭제하지 않습니다.
