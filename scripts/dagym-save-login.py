#!/usr/bin/env python3
"""One-time, local, interactive setup. Never put a password in arguments or a file."""
import getpass
import subprocess
import sys

SERVICE = 'com.bangju.dagym-manager'

def quoted(value):
    if any(char in value for char in '\r\n\x00'):
        raise ValueError('줄바꿈이 포함된 값은 지원하지 않습니다.')
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'

def main():
    if sys.platform != 'darwin' or not sys.stdin.isatty():
        raise SystemExit('Mac 터미널에서 직접 실행해주세요. 비밀번호를 인자로 전달하지 마세요.')
    identifier = input('다짐 로그인 아이디: ').strip()
    password = getpass.getpass('저장된 다짐 비밀번호(화면에 표시되지 않음): ')
    if not identifier or not password:
        raise SystemExit('입력이 없어 저장하지 않았습니다.')
    # Pass the secret via a pipe, never via ps-visible command arguments.
    command = f'add-generic-password -U -s {quoted(SERVICE)} -a {quoted(identifier)} -w {quoted(password)} -T /usr/bin/security\n'
    password = None
    result = subprocess.run(['/usr/bin/security', '-i'], input=command, text=True, capture_output=True, timeout=30)
    command = None
    if result.returncode:
        raise SystemExit('키체인 저장이 확인되지 않았습니다. Mac의 키체인 승인 상태를 확인해주세요.')
    # Check the entry without printing credentials or the security tool output.
    check = subprocess.run(['/usr/bin/security', 'find-generic-password', '-s', SERVICE, '-a', identifier], capture_output=True, timeout=5)
    if check.returncode:
        raise SystemExit('저장 항목을 확인하지 못했습니다.')
    print('다짐 자동수집용 로컬 키체인 저장 완료. 비밀번호는 출력·파일 저장하지 않았습니다.')

if __name__ == '__main__':
    try:
        main()
    except (subprocess.TimeoutExpired, ValueError):
        raise SystemExit('키체인 입력 처리에 실패했습니다. 비밀번호는 출력하지 않습니다.')
