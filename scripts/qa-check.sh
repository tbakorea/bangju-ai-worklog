#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-}"

if [[ -z "$NODE_BIN" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [[ -x "/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
    NODE_BIN="/Users/bangju/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  else
    echo "Node.js를 찾지 못했습니다. NODE_BIN=/path/to/node ./scripts/qa-check.sh 형태로 실행해주세요." >&2
    exit 1
  fi
fi

cd "$ROOT_DIR"
"$NODE_BIN" scripts/qa-check.mjs
