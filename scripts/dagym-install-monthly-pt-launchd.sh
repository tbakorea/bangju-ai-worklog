#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.bangju.dagym-monthly-pt"
LEGACY_LABEL="com.bangju.dagym-daily"
SOURCE="$ROOT_DIR/launchd/$LABEL.plist"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"
RUNTIME_DIR="$HOME/Library/Application Support/BangjuWorklog/dagym-sync"
RUNTIME_SCRIPTS_DIR="$RUNTIME_DIR/scripts"
RUNTIME_AUDIT_DIR="$RUNTIME_DIR/work/dagym-daily-sync"
SOURCE_AUDIT="$ROOT_DIR/work/dagym-daily-sync/latest.json"
LEGACY_PROFILE="/Users/bangju/Documents/Codex/2026-07-06/bangju-ai-worklog/work/dagym-browser-profile"
RUNTIME_PROFILE="$RUNTIME_DIR/browser-profile"
SYNC_SCRIPTS=(
  dagym-monthly-pt-sync.sh
  dagym-daily-sync.mjs
  dagym-monthly-pt-sync.mjs
  dagym-upload-pending.mjs
  dagym-supabase-login.mjs
)

mkdir -p "$HOME/Library/LaunchAgents" "$RUNTIME_SCRIPTS_DIR" "$RUNTIME_AUDIT_DIR"

# launchd는 macOS 개인정보 보호 정책상 Documents 폴더에 있는 실행 파일을
# 읽지 못할 수 있습니다. 실행용 복사본과 브라우저 세션을 Application Support에
# 두어, 로그인 후에도 같은 사용자 권한으로 안정적으로 자동 실행되게 합니다.
for script in "${SYNC_SCRIPTS[@]}"; do
  cp -p "$ROOT_DIR/scripts/$script" "$RUNTIME_SCRIPTS_DIR/$script"
done
chmod +x "$RUNTIME_SCRIPTS_DIR/dagym-monthly-pt-sync.sh"

# 이미 읽은 전일 요약본은 재수집하지 않고 서버 반영만 재시도합니다.
if [ -f "$SOURCE_AUDIT" ]; then
  cp -p "$SOURCE_AUDIT" "$RUNTIME_AUDIT_DIR/latest.json"
fi

# 최초 한 번만 다짐 로그인 세션을 복사합니다. 캐시·잠금 파일은 제외해 용량과
# 프로필 충돌을 줄이고, 원본은 그대로 보존합니다.
if [ ! -f "$RUNTIME_PROFILE/Local State" ] && [ -d "$LEGACY_PROFILE" ]; then
  mkdir -p "$RUNTIME_PROFILE"
  rsync -a \
    --exclude='Singleton*' \
    --exclude='Cache' \
    --exclude='Code Cache' \
    --exclude='GPUCache' \
    --exclude='GrShaderCache' \
    --exclude='DawnGraphiteCache' \
    --exclude='DawnWebGPUCache' \
    --exclude='BrowserMetrics' \
    --exclude='Crashpad' \
    "$LEGACY_PROFILE/" "$RUNTIME_PROFILE/"
fi

cp "$SOURCE" "$TARGET"
# 구형 첫 10건 수집기가 새 월간 수집기와 중복 실행되지 않도록 로드만 해제한다.
# 기존 plist와 과거 로그는 복구·감사를 위해 삭제하지 않는다.
launchctl bootout "$DOMAIN/$LEGACY_LABEL" >/dev/null 2>&1 || true
launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$TARGET"
launchctl enable "$DOMAIN/$LABEL"
echo "설치 완료: 매일 01:05~03:35 다짐 일일자료와 월간 PT 일정 통합 동기화"
