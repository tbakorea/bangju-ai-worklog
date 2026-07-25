#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

./scripts/qa-check.sh
./scripts/mobile-browser-qa.sh
git diff --check

echo "Bangju Worklog full QA passed"
