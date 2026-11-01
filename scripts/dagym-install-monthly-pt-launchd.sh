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
SYNC_SCRIPTS=(
  dagym-monthly-pt-sync.sh
  dagym-session.mjs
  dagym-sync-health.mjs
  dagym-quality.cjs
  dagym-daily-sync.mjs
  dagym-monthly-pt-sync.mjs
  dagym-upload-pending.mjs
  dagym-supabase-login.mjs
)

ACTIVE_PID="$(cat "$RUNTIME_DIR/work/dagym-sync/run.lock/pid" 2>/dev/null || true)"
if [[ "$ACTIVE_PID" =~ ^[0-9]+$ ]] && kill -0 "$ACTIVE_PID" 2>/dev/null; then
  echo "현재 수집이 실행 중입니다. 완료 후 설치를 다시 실행해주세요." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$RUNTIME_SCRIPTS_DIR" "$RUNTIME_AUDIT_DIR"

# launchd는 macOS 개인정보 보호 정책상 Documents 폴더에 있는 실행 파일을
# 읽지 못할 수 있습니다. 실행용 복사본과 브라우저 세션을 Application Support에
# 두어, 로그인 후에도 같은 사용자 권한으로 안정적으로 자동 실행되게 합니다.
for script in "${SYNC_SCRIPTS[@]}"; do
  cp -p "$ROOT_DIR/scripts/$script" "$RUNTIME_SCRIPTS_DIR/$script"
done
chmod +x "$RUNTIME_SCRIPTS_DIR/dagym-monthly-pt-sync.sh"

# 이미 읽은 전일 요약본은 재수집하지 않고 서버 반영만 재시도합니다.
if [ -f "$SOURCE_AUDIT" ] && [ ! -f "$RUNTIME_AUDIT_DIR/latest.json" ]; then
  cp -p "$SOURCE_AUDIT" "$RUNTIME_AUDIT_DIR/latest.json"
fi

# Never copy browser credentials/sessions between profiles. Reuse the existing
# dedicated profile in place; a new installation needs its own normal sign-in.

cp "$SOURCE" "$TARGET"
# 구형 첫 10건 수집기가 새 월간 수집기와 중복 실행되지 않도록 로드만 해제한다.
# 기존 plist와 과거 로그는 복구·감사를 위해 삭제하지 않는다.
launchctl bootout "$DOMAIN/$LEGACY_LABEL" >/dev/null 2>&1 || true
launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
# Legacy jobs used an empty lock directory. Remove only that empty stale lock.
rmdir "$RUNTIME_DIR/work/dagym-sync/run.lock" >/dev/null 2>&1 || true
launchctl enable "$DOMAIN/$LABEL"
launchctl bootstrap "$DOMAIN" "$TARGET"
echo "설치 완료: 매일 01:05 수집·매시간 실패 보완, 완료 날짜 중복 방지·화면 없는 브라우저·로그인 상태 점검"
