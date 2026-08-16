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
DAGYM_CDP_URL="$CDP_URL" "$NODE_BIN" "$ROOT_DIR/scripts/dagym-daily-sync.mjs" "$@" || STATUS=1
DAGYM_CDP_URL="$CDP_URL" "$NODE_BIN" "$ROOT_DIR/scripts/dagym-monthly-pt-sync.mjs" "$@" || STATUS=1
exit "$STATUS"
