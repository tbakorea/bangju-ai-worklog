import contextlib
import datetime
import importlib.util
import io
import json
from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('locked_qa', Path(__file__).with_name('dagym-locked-qa.py'))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

class FinishedCollector:
    returncode = 0
    def __init__(self, *args, **kwargs): pass
    def communicate(self, timeout=None): return b'', b''
    def poll(self): return 0

class LockProofTests(unittest.TestCase):
    def test_unknown_lock_state_never_becomes_success(self):
        class Result: stdout = plistlib.dumps({})
        with patch.object(qa.subprocess, 'run', return_value=Result()):
            with self.assertRaises(RuntimeError): qa.screen_locked()

    def test_os_lock_flag_is_used_without_ui(self):
        class Result: stdout = plistlib.dumps({'IOConsoleLocked': True})
        with patch.object(qa.subprocess, 'run', return_value=Result()):
            self.assertTrue(qa.screen_locked())

    def check_run(self, remained_locked, fresh, expected):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state = root / 'work/dagym-sync'
            state.mkdir(parents=True)
            daily = root / 'work/dagym-daily-sync'
            daily.mkdir()
            (state / 'health.json').write_text(json.dumps({'ok':True,'targetDate':'2026-10-31','dailySaved':True,'ptSaved':True}))
            timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=60 if fresh else -3600)
            (daily / '2026-10-31.json').write_text(json.dumps({'uploaded':{'syncedAt':timestamp.isoformat()}}))
            with patch.object(qa, 'RUNTIME', root), patch.object(qa, 'screen_locked', side_effect=[True, remained_locked]), patch.object(qa.subprocess, 'Popen', FinishedCollector), patch('sys.argv', ['locked-qa']), contextlib.redirect_stdout(io.StringIO()):
                if expected: qa.main()
                else:
                    with self.assertRaises(SystemExit): qa.main()
            result = json.loads((state / 'locked-verification.json').read_text())
            self.assertEqual(result['ok'], expected)

    def test_unlocking_during_capture_invalidates_proof(self): self.check_run(False, True, False)
    def test_old_success_receipt_is_not_a_new_locked_run(self): self.check_run(True, False, False)
    def test_locked_run_requires_fresh_server_save(self): self.check_run(True, True, True)

if __name__ == '__main__': unittest.main()
