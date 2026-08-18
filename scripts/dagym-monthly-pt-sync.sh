#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}"
DEBUG_PORT="${DAGYM_DEBUG_PORT:-9222}"
CDP_URL="${DAGYM_CDP_URL:-http://127.0.0.1:$DEBUG_PORT}"
CHROME_BIN="${DAGYM_BROWSER_EXECUTABLE:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
LEGACY_PROFILE="/Users/bangju/Documents/Codex/2026-07-06/bangju-ai-worklog/work/dagym-browser-profile"
USER_DATA_DIR="${DAGYM_USER_DATA_DIR:-$LEGACY_PROFILE}"
STARTED_BROWSER_PID=""

cleanup() {
  if [ -n "$STARTED_BROWSER_PID" ] && kill -0 "$STARTED_BROWSER_PID" >/dev/null 2>&1; then
    kill "$STARTED_BROWSER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"
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
if [ "${DAGYM_SYNC_DRY_RUN:-0}" != "1" ] && [ -z "${DAGYM_SYNC_ACCESS_TOKEN:-}" ]; then
  DAGYM_SYNC_EMAIL="${DAGYM_SYNC_EMAIL:-j3010@ymail.com}"
  DAGYM_SYNC_PASSWORD="${DAGYM_SYNC_PASSWORD:-$(security find-generic-password -a "$DAGYM_SYNC_EMAIL" -s "com.bangju.worklog-sync" -w 2>/dev/null || true)}"
  export DAGYM_SYNC_EMAIL DAGYM_SYNC_PASSWORD
  if [ -n "$DAGYM_SYNC_PASSWORD" ]; then
    DAGYM_SYNC_ACCESS_TOKEN="$("$NODE_BIN" "$ROOT_DIR/scripts/dagym-supabase-login.mjs")"
    export DAGYM_SYNC_ACCESS_TOKEN
    unset DAGYM_SYNC_PASSWORD
  fi
fi
if [ "${DAGYM_SYNC_DRY_RUN:-0}" != "1" ] && [ -z "${DAGYM_BROWSER_SYNC_SECRET:-}" ] && [ -z "${DAGYM_SYNC_ACCESS_TOKEN:-}" ]; then
  echo "다짐 동기화 인증정보가 없습니다. Keychain 서비스 com.bangju.dagym-sync 또는 com.bangju.worklog-sync를 설정해주세요." >&2
  exit 1
fi

if [ "${DAGYM_SYNC_SKIP_JITTER:-0}" != "1" ]; then
  # 매일 동일한 초에 접근하지 않도록 01:05~03:35 사이에서 분산합니다.
  JITTER_SECONDS=$((RANDOM % 9001))
  sleep "$JITTER_SECONDS"
fi

if ! curl -fsS "$CDP_URL/json/version" >/dev/null 2>&1; then
  if [ ! -x "$CHROME_BIN" ]; then
    echo "다짐 전용 Chrome을 찾지 못했습니다: $CHROME_BIN" >&2
    exit 1
  fi
  "$CHROME_BIN" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="$DEBUG_PORT" \
    --user-data-dir="$USER_DATA_DIR" \
    "https://www.dagym-manager.com/dashboard/attendance?gymId=${DAGYM_GYM_ID:-2387f907-0810-49b9-9db2-7ceb7861e076}" \
    >/tmp/bangju-dagym-monthly-browser.log 2>&1 &
  STARTED_BROWSER_PID="$!"
  for _ in {1..30}; do
    curl -fsS "$CDP_URL/json/version" >/dev/null 2>&1 && break
    sleep 2
  done
fi

if ! curl -fsS "$CDP_URL/json/version" >/dev/null 2>&1; then
  echo "다짐 전용 브라우저에 연결할 수 없습니다: $CDP_URL" >&2
  exit 1
fi

STATUS=0
if [ "${DAGYM_SYNC_MONTHLY_ONLY:-0}" != "1" ]; then
  DAGYM_CDP_URL="$CDP_URL" "$NODE_BIN" "$ROOT_DIR/scripts/dagym-daily-sync.mjs" "$@" || STATUS=1
fi
if [ "${DAGYM_SYNC_DAILY_ONLY:-0}" != "1" ]; then
  DAGYM_CDP_URL="$CDP_URL" "$NODE_BIN" "$ROOT_DIR/scripts/dagym-monthly-pt-sync.mjs" "$@" || STATUS=1
fi
exit "$STATUS"
