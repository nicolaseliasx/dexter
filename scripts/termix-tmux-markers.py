#!/usr/bin/env python3
"""Keep Termix identities inside resurrect snapshots, never infer ownership by name."""
import json
from pathlib import Path
import re
import subprocess
import sys

KEYS = ('@termix_session_id', '@termix_created_at', '@termix_expiry_mode', '@termix_expiry_seconds')
PREFIX = 'termix-marker\t'


def valid(values):
    return (isinstance(values, list) and len(values) == 4
            and all(isinstance(value, str) for value in values)
            and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', values[0])
            and re.fullmatch(r'[0-9TZ:.+-]{1,40}', values[1])
            and values[2] in ('manual', 'idle')
            and re.fullmatch(r'[0-9]{0,10}', values[3]))


class Markers:
    def __init__(self, tmux=None):
        self.prefix = tmux or ['tmux']

    def run(self, *args):
        return subprocess.run(self.prefix + list(args), capture_output=True, text=True, timeout=10)

    def capture(self):
        fmt = '\t'.join(['#{session_id}', '#{session_name}', '#{session_created}'] + ['#{'+key+'}' for key in KEYS])
        result = self.run('list-sessions', '-F', fmt)
        if result.returncode: raise RuntimeError('cannot capture tmux identity')
        rows = {}
        for line in result.stdout.splitlines():
            target, name, created, *values = line.split('\t')
            if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', name) and valid(values):
                rows[name] = {'generation': [target, created], 'values': values}
        return rows

    def append(self, path, before):
        after = self.capture()
        # If a session was replaced while the layout was dumped, do not save
        # either identity. Embedding records also makes marker-only changes
        # significant to resurrect's files_differ comparison.
        with Path(path).open('a') as handle:
            for name, row in sorted(before.items()):
                if after.get(name) == row:
                    handle.write(PREFIX + json.dumps({'name': name, **row}, sort_keys=True) + '\n')

    def bind(self, target, created, values):
        if not re.fullmatch(r'\$[0-9]+', target) or not created.isdigit() or not valid(values):
            raise ValueError('invalid identity or target generation')
        empty = '#{&&:#{==:#{@termix_session_id},},#{&&:#{==:#{@termix_created_at},},#{&&:#{==:#{@termix_expiry_mode},},#{==:#{@termix_expiry_seconds},}}}}'
        condition = ('#{&&:#{==:#{session_id},'+target+'},#{&&:#{==:#{session_created},'+created+'},'+empty+'}}')
        commands = ' ; '.join(f"set-option -t '{target}' '{key}' '{value}'" for key, value in zip(KEYS, values))
        result = self.run('if-shell', '-F', '-t', target, condition, commands)
        if result.returncode: raise RuntimeError('marker restoration command failed')

    def restore_one(self, path, created_target, name):
        # created_target comes directly from successful new-session -P, not a
        # subsequent lookup by name. A failed creation must not call this.
        target, created = created_target.split()
        records = [json.loads(line[len(PREFIX):]) for line in Path(path).read_text().splitlines() if line.startswith(PREFIX)]
        matches = [row for row in records if row.get('name') == name]
        if len(matches) == 1:
            self.bind(target, created, matches[0]['values'])


if __name__ == '__main__':
    marker = Markers()
    action = sys.argv[1]
    if action == 'capture': print(json.dumps(marker.capture()))
    elif action == 'append': marker.append(sys.argv[2], json.loads(sys.argv[3]))
    elif action == 'restore-one': marker.restore_one(*sys.argv[2:])
    else: raise SystemExit('unknown marker operation')
