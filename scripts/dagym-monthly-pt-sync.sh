#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}"
# 포트 9222는 개발·개인 Chrome이 이미 사용할 수 있습니다. 다짐 수집기는
# 별도 포트와 별도 프로필만 사용해, 사용 중인 브라우저 탭에 붙지 않습니다.
DEBUG_PORT="${DAGYM_DEBUG_PORT:-9233}"
CDP_URL="${DAGYM_CDP_URL:-http://127.0.0.1:$DEBUG_PORT}"
CHROME_BIN="${DAGYM_BROWSER_EXECUTABLE:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
USER_DATA_DIR="${DAGYM_USER_DATA_DIR:-$ROOT_DIR/browser-profile}"
STARTED_BROWSER_PID=""
SYNC_STATE_DIR="$ROOT_DIR/work/dagym-sync"
SYNC_LOCK_DIR="$SYNC_STATE_DIR/run.lock"
LAST_SUCCESS_FILE="$SYNC_STATE_DIR/last-successful-target-date"
DAILY_AUDIT_FILE="$ROOT_DIR/work/dagym-daily-sync/latest.json"
BROWSER_PID_FILE="$SYNC_STATE_DIR/dagym-browser.pid"
SYNC_FORCE="${DAGYM_SYNC_FORCE:-0}"
SYNC_DRY_RUN="${DAGYM_SYNC_DRY_RUN:-0}"

# 자동 실행은 전날 마감자료만 다룹니다. 자정 직후의 당일 부분자료를
# 수집하지 않도록 01:05 이후에만 실행하며, 수동 긴급 실행은 FORCE로
# 이 제한을 넘을 수 있습니다.
KST_CLOCK="$(TZ=Asia/Seoul date +%H%M)"
TARGET_DATE="${DAGYM_DATE:-$(TZ=Asia/Seoul date -v-1d +%F)}"

cleanup() {
  if [ -n "$STARTED_BROWSER_PID" ] && kill -0 "$STARTED_BROWSER_PID" >/dev/null 2>&1; then
    kill "$STARTED_BROWSER_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$STARTED_BROWSER_PID" ] && [ -f "$BROWSER_PID_FILE" ] \
    && [ "$(tr -d '[:space:]' < "$BROWSER_PID_FILE")" = "$STARTED_BROWSER_PID" ]; then
    rm -f "$BROWSER_PID_FILE"
  fi
  rmdir "$SYNC_LOCK_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "$ROOT_DIR"
mkdir -p "$SYNC_STATE_DIR"
if ! mkdir "$SYNC_LOCK_DIR" 2>/dev/null; then
  echo "다짐 동기화가 이미 실행 중입니다. 이번 실행은 건너뜁니다."
  exit 0
fi

if [ "$SYNC_FORCE" != "1" ] && [ "$KST_CLOCK" -lt 0105 ]; then
  echo "다짐 자동수집 대기: 한국시간 01:05 이후에 전날 자료를 수집합니다."
  exit 0
fi

# launchd의 보완 실행·재로그인으로 같은 전날 자료를 반복해서 읽지
# 않습니다. 성공한 날짜만 기록하므로 실패한 날은 다음 실행에서 재시도됩니다.
if [ "$SYNC_FORCE" != "1" ] && [ "$SYNC_DRY_RUN" != "1" ] \
  && [ "${DAGYM_SYNC_MONTHLY_ONLY:-0}" != "1" ] && [ "${DAGYM_SYNC_DAILY_ONLY:-0}" != "1" ] \
  && [ -f "$LAST_SUCCESS_FILE" ] && [ "$(tr -d '[:space:]' < "$LAST_SUCCESS_FILE")" = "$TARGET_DATE" ]; then
  echo "다짐 자동수집 완료 확인: ${TARGET_DATE} 자료는 이미 반영되었습니다."
  exit 0
fi

export DAGYM_DATE="$TARGET_DATE"
if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env.local"
  set +a
fi

# 자동 실행용 비밀값은 평문 파일보다 macOS Keychain을 우선 사용한다.
if [ -z "${DAGYM_BROWSER_SYNC_SECRET:-}" ]; then
  DAGYM_BROWSER_SYNC_SECRET="$(security find-generic-password -a "$USER" -s "com.bangju.dagym-sync" -w 2>/dev/null || true)"
  export DAGYM_BROWSER_SYNC_SECRET
fi
if [ "$SYNC_DRY_RUN" != "1" ] && [ -z "${DAGYM_SYNC_ACCESS_TOKEN:-}" ]; then
  DAGYM_SYNC_EMAIL="${DAGYM_SYNC_EMAIL:-j3010@ymail.com}"
  DAGYM_SYNC_PASSWORD="${DAGYM_SYNC_PASSWORD:-$(security find-generic-password -a "$DAGYM_SYNC_EMAIL" -s "com.bangju.worklog-sync" -w 2>/dev/null || true)}"
  export DAGYM_SYNC_EMAIL DAGYM_SYNC_PASSWORD
  if [ -n "$DAGYM_SYNC_PASSWORD" ]; then
    DAGYM_SYNC_ACCESS_TOKEN="$("$NODE_BIN" "$ROOT_DIR/scripts/dagym-supabase-login.mjs")"
    export DAGYM_SYNC_ACCESS_TOKEN
    unset DAGYM_SYNC_PASSWORD
  fi
fi
if [ "$SYNC_DRY_RUN" != "1" ] && [ -z "${DAGYM_BROWSER_SYNC_SECRET:-}" ] && [ -z "${DAGYM_SYNC_ACCESS_TOKEN:-}" ]; then
  echo "다짐 동기화 인증정보가 없습니다. Keychain 서비스 com.bangju.dagym-sync 또는 com.bangju.worklog-sync를 설정해주세요." >&2
  exit 1
fi

JITTER_APPLIED=0
apply_browser_jitter() {
  if [ "$JITTER_APPLIED" -eq 1 ] || [ "${DAGYM_SYNC_SKIP_JITTER:-0}" = "1" ]; then
    return
  fi
  # 포털 수집 시점만 01:05~03:35 사이로 분산합니다. 저장 재시도에는
  # 대기하지 않아, 이미 읽은 자료를 빠르게 반영할 수 있습니다.
  JITTER_SECONDS=$((RANDOM % 9001))
  sleep "$JITTER_SECONDS"
  JITTER_APPLIED=1
}

ensure_dagym_browser() {
  apply_browser_jitter
  if curl --connect-timeout 3 --max-time 5 -fsS "$CDP_URL/json/version" >/dev/null 2>&1; then
    # 이 포트는 다짐 수집기만 쓰도록 예약했습니다. PID 파일이 없는 프로세스는
    # 다른 도구일 수 있으므로 종료하거나 제어하지 않고 안전하게 실패 처리합니다.
    if [ -f "$BROWSER_PID_FILE" ]; then
      OWNED_PID="$(tr -d '[:space:]' < "$BROWSER_PID_FILE")"
      OWNED_COMMAND="$(ps -p "$OWNED_PID" -o command= 2>/dev/null || true)"
      if [ -n "$OWNED_COMMAND" ] \
        && [[ "$OWNED_COMMAND" == *"--remote-debugging-port=$DEBUG_PORT"* ]] \
        && [[ "$OWNED_COMMAND" == *"--user-data-dir=$USER_DATA_DIR"* ]]; then
        return 0
      fi
    fi
    echo "다짐 전용 포트($DEBUG_PORT)가 예상하지 않은 Chrome에 사용 중입니다. 다른 브라우저는 건드리지 않고 이번 수집을 중단합니다." >&2
    return 1
  fi

  # 남은 PID 파일은 이번 실행에서 만든 전용 Chrome일 때만 정리합니다.
  if [ -f "$BROWSER_PID_FILE" ]; then
    STALE_PID="$(tr -d '[:space:]' < "$BROWSER_PID_FILE")"
    STALE_COMMAND="$(ps -p "$STALE_PID" -o command= 2>/dev/null || true)"
    if [ -n "$STALE_COMMAND" ] \
      && [[ "$STALE_COMMAND" == *"--remote-debugging-port=$DEBUG_PORT"* ]] \
      && [[ "$STALE_COMMAND" == *"--user-data-dir=$USER_DATA_DIR"* ]]; then
      kill "$STALE_PID" >/dev/null 2>&1 || true
      sleep 1
    fi
    rm -f "$BROWSER_PID_FILE"
  fi

  if [ ! -x "$CHROME_BIN" ]; then
    echo "다짐 전용 Chrome을 찾지 못했습니다: $CHROME_BIN" >&2
    return 1
  fi
  mkdir -p "$USER_DATA_DIR"
  "$CHROME_BIN" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="$DEBUG_PORT" \
    --no-first-run \
    --no-default-browser-check \
    --user-data-dir="$USER_DATA_DIR" \
    "https://www.dagym-manager.com/dashboard/attendance?gymId=${DAGYM_GYM_ID:-2387f907-0810-49b9-9db2-7ceb7861e076}" \
    >/tmp/bangju-dagym-monthly-browser.log 2>&1 &
  STARTED_BROWSER_PID="$!"
  printf '%s\n' "$STARTED_BROWSER_PID" > "$BROWSER_PID_FILE"
  for _ in {1..30}; do
    curl --connect-timeout 3 --max-time 5 -fsS "$CDP_URL/json/version" >/dev/null 2>&1 && break
    sleep 2
  done
  if ! curl --connect-timeout 3 --max-time 5 -fsS "$CDP_URL/json/version" >/dev/null 2>&1; then
    echo "다짐 전용 브라우저에 연결할 수 없습니다: $CDP_URL" >&2
    return 1
  fi
}

STATUS=0
DAILY_COMPLETE=0
if [ "${DAGYM_SYNC_MONTHLY_ONLY:-0}" != "1" ]; then
  # 전날 화면을 이미 읽었는데 서버 저장만 실패한 경우에는 다짐에 다시
  # 접속하지 않습니다. 개인정보가 없는 감사 요약본만 재전송합니다.
  if [ -f "$DAILY_AUDIT_FILE" ]; then
    if "$NODE_BIN" "$ROOT_DIR/scripts/dagym-upload-pending.mjs" "$TARGET_DATE"; then
      DAILY_COMPLETE=1
    else
      PENDING_STATUS=$?
      if [ "$PENDING_STATUS" -ne 2 ]; then
        STATUS=1
      fi
    fi
  fi
  if [ "$DAILY_COMPLETE" -eq 0 ] && [ "$STATUS" -eq 0 ]; then
    ensure_dagym_browser \
      && DAGYM_CDP_URL="$CDP_URL" "$NODE_BIN" "$ROOT_DIR/scripts/dagym-daily-sync.mjs" "$@" \
      && DAILY_COMPLETE=1 \
      || STATUS=1
  fi
fi

# 일일 요약 저장이 끝난 뒤에만 월간 시간표를 읽습니다. 저장 장애가 난 날은
# 다음 보완 실행에서 기존 요약본만 먼저 재전송해 포털 접속을 하루 한 번으로 제한합니다.
if [ "$STATUS" -eq 0 ] && [ "${DAGYM_SYNC_DAILY_ONLY:-0}" != "1" ]; then
  ensure_dagym_browser \
    && DAGYM_CDP_URL="$CDP_URL" "$NODE_BIN" "$ROOT_DIR/scripts/dagym-monthly-pt-sync.mjs" "$@" \
    || STATUS=1
fi

if [ "$STATUS" -eq 0 ] && [ "$SYNC_DRY_RUN" != "1" ] \
  && [ "${DAGYM_SYNC_MONTHLY_ONLY:-0}" != "1" ] && [ "${DAGYM_SYNC_DAILY_ONLY:-0}" != "1" ]; then
  printf '%s\n' "$TARGET_DATE" > "$LAST_SUCCESS_FILE.tmp"
  mv "$LAST_SUCCESS_FILE.tmp" "$LAST_SUCCESS_FILE"
  echo "다짐 자동수집 완료: ${TARGET_DATE} 일일 운영자료와 ${TARGET_DATE:0:7} PT 일정을 반영했습니다."
else
  echo "다짐 자동수집 미완료: ${TARGET_DATE} 자료는 다음 실행에서 다시 시도합니다." >&2
fi
exit "$STATUS"
