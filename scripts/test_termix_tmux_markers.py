import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

HELPER = Path(__file__).with_name('termix-tmux-markers.py')
spec = importlib.util.spec_from_file_location('markers', HELPER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MarkerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.socket = self.root/'socket'
        self.prefix = ['tmux', '-f', '/dev/null', '-S', str(self.socket)]
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(lambda: subprocess.run(self.prefix+['kill-server'], capture_output=True))
        self.tmux('new-session', '-d', '-s', 'original', 'sleep 300')
        self.marker = module.Markers(self.prefix)
        self.values = ['test-session-id', '2026-11-04T16:12:43.912Z', 'manual', '']
        for key, value in zip(module.KEYS, self.values):
            self.tmux('set-option', '-t', 'original', key, value)
        self.layout = self.root/'layout'
        self.layout.write_text('pane\toriginal\n')

    def tmux(self, *args):
        return subprocess.check_output(self.prefix+list(args), text=True, stderr=subprocess.PIPE).strip()

    def test_replaced_during_save_does_not_receive_saved_identity(self):
        before = self.marker.capture()
        self.tmux('new-session', '-d', '-s', 'keep', 'sleep 300')
        self.tmux('kill-session', '-t', 'original')
        self.tmux('new-session', '-d', '-s', 'original', 'sleep 300')
        self.marker.append(self.layout, before)
        self.assertNotIn(module.PREFIX, self.layout.read_text())

    def test_wrong_generation_and_existing_marker_are_preserved(self):
        target, created = self.tmux('display-message', '-p', '-t', 'original', '#{session_id} #{session_created}').split()
        for key in module.KEYS: self.tmux('set-option', '-u', '-t', target, key)
        self.marker.bind(target, str(int(created)+1), self.values)
        self.assertEqual(self.tmux('show-option', '-t', target, '-qv', module.KEYS[0]), '')
        self.tmux('set-option', '-t', target, module.KEYS[0], 'another-owner')
        self.marker.bind(target, created, self.values)
        self.assertEqual(self.tmux('show-option', '-t', target, '-qv', module.KEYS[0]), 'another-owner')

    def prepare_resurrect(self):
        scripts = self.root/'scripts'
        source = Path(os.environ.get('RESURRECT_SCRIPTS', str(Path.home()/'.tmux/plugins/tmux-resurrect/scripts')))
        shutil.copytree(source, scripts)
        self.tmux('set-option', '-g', '@resurrect-dir', str(self.root/'saved'))
        self.tmux('set-option', '-g', '@termix-marker-helper', str(HELPER))
        self.tmux('set-option', '-g', '@resurrect-capture-pane-contents', 'off')
        env = {**os.environ, 'TMUX': str(self.socket)+',0,0'}
        return scripts, env

    def test_real_save_restore_keeps_identity(self):
        scripts, env = self.prepare_resurrect()
        subprocess.run(['bash', str(scripts/'save.sh'), 'quiet'], env=env, check=True, timeout=30, capture_output=True)
        self.tmux('kill-server')
        self.tmux('new-session', '-d', '-s', '0', 'sleep 300')
        self.tmux('set-option', '-g', '@resurrect-dir', str(self.root/'saved'))
        self.tmux('set-option', '-g', '@termix-marker-helper', str(HELPER))
        subprocess.run(['bash', str(scripts/'restore.sh')], env=env, check=True, timeout=40, capture_output=True)
        self.assertEqual(self.tmux('show-option', '-t', 'original', '-qv', module.KEYS[0]), self.values[0])

    def test_marker_only_change_is_retained_and_existing_session_is_not_claimed(self):
        scripts, env = self.prepare_resurrect()
        for key in module.KEYS: self.tmux('set-option', '-u', '-t', 'original', key)
        save = ['bash', str(scripts/'save.sh'), 'quiet']
        subprocess.run(save, env=env, check=True, timeout=30, capture_output=True)
        import time
        time.sleep(1.1)  # resurrect names snapshots with second precision
        for key, value in zip(module.KEYS, self.values): self.tmux('set-option', '-t', 'original', key, value)
        subprocess.run(save, env=env, check=True, timeout=30, capture_output=True)
        snapshot = (self.root/'saved/last').read_text()
        self.assertIn(self.values[0], snapshot)
        # A homonymous session already present at restore must never receive identity.
        for key in module.KEYS: self.tmux('set-option', '-u', '-t', 'original', key)
        subprocess.run(['bash', str(scripts/'restore.sh')], env=env, check=True, timeout=40, capture_output=True)
        self.assertEqual(self.tmux('show-option', '-t', 'original', '-qv', module.KEYS[0]), '')

    def test_failed_creation_never_marks_the_homonymous_winner(self):
        scripts, env = self.prepare_resurrect()
        self.marker.append(self.layout, self.marker.capture())
        for key in module.KEYS: self.tmux('set-option', '-u', '-t', 'original', key)
        # Source the actual functions, then simulate a client winning the name
        # between resurrect's existence check and new-session.
        restore = scripts/'restore.sh'
        source = restore.read_text()
        assert source.endswith('main\n')
        restore.write_text(source[:-5] + '\nTERMIX_RESTORE_FILE="$1"\nnew_session original 0 "$HOME" 0\n')
        result = subprocess.run(['bash', str(restore), str(self.layout)], env=env, timeout=20, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.tmux('show-option', '-t', 'original', '-qv', module.KEYS[0]), '')


if __name__ == '__main__': unittest.main()
