#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-}"
PYTHON_BIN="${PYTHON_BIN:-}"
PORT="${WORKLOG_QA_PORT:-8782}"
URL="${WORKLOG_URL:-http://127.0.0.1:${PORT}/index.html}"
SERVER_PID=""

if [[ -z "$NODE_BIN" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [[ -x "/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
    NODE_BIN="/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  else
    echo "Node.js를 찾지 못했습니다. NODE_BIN=/path/to/node ./scripts/mobile-browser-qa.sh 형태로 실행해주세요." >&2
    exit 1
  fi
fi

if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif [[ -x "/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" ]]; then
    PYTHON_BIN="/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
  else
    echo "Python을 찾지 못했습니다. PYTHON_BIN=/path/to/python3 ./scripts/mobile-browser-qa.sh 형태로 실행해주세요." >&2
    exit 1
  fi
fi

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  "$PYTHON_BIN" -m http.server "$PORT" >/tmp/bangju-worklog-qa-server.log 2>&1 &
  SERVER_PID="$!"
  sleep 1
fi

NODE_MODULE_DIR="/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
export NODE_PATH="${NODE_PATH:-$NODE_MODULE_DIR}"
export WORKLOG_URL="$URL"

"$NODE_BIN" scripts/visual-smoke.cjs
