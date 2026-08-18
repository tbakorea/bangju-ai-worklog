#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.bangju.dagym-monthly-pt"
LEGACY_LABEL="com.bangju.dagym-daily"
SOURCE="$ROOT_DIR/launchd/$LABEL.plist"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents"
cp "$SOURCE" "$TARGET"
# 구형 첫 10건 수집기가 새 월간 수집기와 중복 실행되지 않도록 로드만 해제한다.
# 기존 plist와 과거 로그는 복구·감사를 위해 삭제하지 않는다.
launchctl bootout "$DOMAIN/$LEGACY_LABEL" >/dev/null 2>&1 || true
launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$TARGET"
launchctl enable "$DOMAIN/$LABEL"
echo "설치 완료: 매일 01:05~03:35 다짐 일일자료와 월간 PT 일정 통합 동기화"
