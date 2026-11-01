#!/usr/bin/env python3
"""Verify the real collector under screen lock, without unlocking or touching UI."""
import argparse
import datetime
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import time

RUNTIME = Path.home() / 'Library/Application Support/BangjuWorklog/dagym-sync'

def screen_locked():
    result = subprocess.run(['/usr/sbin/ioreg', '-a', '-l', '-d', '1'], capture_output=True, timeout=5, check=True)
    state = plistlib.loads(result.stdout)
    if not isinstance(state, dict) or not isinstance(state.get('IOConsoleLocked'), bool):
        raise RuntimeError('screen-lock-state-unknown')
    return state['IOConsoleLocked']

def read_json(path):
    return json.loads(path.read_text())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wait-seconds', type=int, default=0)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    deadline = time.monotonic() + max(0, args.wait_seconds)
    while not screen_locked():
        if time.monotonic() >= deadline:
            raise RuntimeError('screen-is-not-locked')
        time.sleep(2)
    started = datetime.datetime.now(datetime.timezone.utc)
    env = {**os.environ, 'DAGYM_SYNC_FORCE': '1', 'DAGYM_SYNC_SKIP_JITTER': '1'}
    for key in ['DAGYM_DATE', 'DAGYM_MONTH', 'DAGYM_SYNC_MONTHLY_ONLY', 'DAGYM_SYNC_DAILY_ONLY', 'DAGYM_SYNC_DRY_RUN']:
        env.pop(key, None)
    if args.dry_run:
        env['DAGYM_SYNC_DRY_RUN'] = '1'
    # Output remains in memory; never echo member data, account details or auth errors.
    child = subprocess.Popen(['/bin/bash', str(RUNTIME / 'scripts/dagym-monthly-pt-sync.sh')], cwd=RUNTIME, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    remained_locked = True
    # communicate(timeout) drains pipes while polling so a verbose collector cannot deadlock.
    end = time.monotonic() + 1500
    try:
        while True:
            remained_locked = remained_locked and screen_locked()
            try:
                child.communicate(timeout=2)
                break
            except subprocess.TimeoutExpired:
                if time.monotonic() >= end:
                    raise RuntimeError('collection-deadline-exceeded')
    finally:
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
            try: child.communicate(timeout=5)
            except subprocess.TimeoutExpired: os.killpg(child.pid, signal.SIGKILL); child.communicate()
    result = {'ok': False, 'screenRemainedLocked': remained_locked, 'collectorExitCode': child.returncode, 'dryRun': args.dry_run, 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    if child.returncode == 0 and remained_locked:
        if args.dry_run:
            result['ok'] = True
        else:
            health = read_json(RUNTIME / 'work/dagym-sync/health.json')
            daily = read_json(RUNTIME / 'work/dagym-daily-sync' / f"{health['targetDate']}.json")
            saved = datetime.datetime.fromisoformat(daily['uploaded']['syncedAt'].replace('Z', '+00:00'))
            result.update(targetDate=health['targetDate'], dailySaved=health.get('dailySaved') is True, ptSaved=health.get('ptSaved') is True, freshDailyReceipt=saved >= started)
            result['ok'] = health.get('ok') is True and result['dailySaved'] and result['ptSaved'] and result['freshDailyReceipt']
    path = RUNTIME / 'work/dagym-sync/locked-verification.json'
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    os.chmod(temp, 0o600)
    temp.replace(path)
    print(json.dumps(result, ensure_ascii=False))
    if not result['ok']: raise SystemExit(1)

if __name__ == '__main__':
    try: main()
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        # Report a stable category, never a subprocess dump or credential contents.
        print(json.dumps({'ok':False,'status':str(error) if isinstance(error,RuntimeError) else 'lock-verification-failed'}))
        raise SystemExit(1)
