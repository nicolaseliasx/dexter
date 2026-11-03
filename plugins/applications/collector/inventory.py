"""Read-only inventory. Process output is treated as untrusted input."""
import re
import subprocess


def parse_ingress(output):
    result = []
    in_ingress = False
    for line in output.splitlines():
        if line.startswith('== Ingress '):
            in_ingress = True
            continue
        if not in_ingress:
            continue
        match = re.match(r'^\s*\d+\.\s+([a-zA-Z0-9.-]+)\s+→\s+https?://', line)
        if match and '.' in match.group(1):
            host = match.group(1).lower()
            result.append({'name': host, 'url': f'https://{host}/', 'source': 'cloudflare'})
    return result


def parse_services(output):
    result = []
    for line in output.splitlines():
        fields = line.split()
        if len(fields) >= 4 and re.fullmatch(r'[A-Za-z0-9_.@:-]+\.service', fields[0]) and fields[2:4] == ['active', 'running']:
            result.append({'name': fields[0], 'source': 'systemd', 'url': None})
    return result


def parse_containers(output):
    return [{'name': name, 'source': 'docker', 'url': None} for name in output.splitlines() if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', name)]


def collect(cf_tunnel):
    commands = [
        ('cloudflare', [cf_tunnel, 'list'], parse_ingress),
        ('systemd', ['systemctl', 'list-units', '--type=service', '--state=running', '--no-legend', '--no-pager'], parse_services),
        ('systemd_user', ['systemctl', '--user', 'list-units', '--type=service', '--state=running', '--no-legend', '--no-pager'], parse_services),
        ('docker', ['docker', 'ps', '--format', '{{.Names}}'], parse_containers),
    ]
    items, failed = [], []
    for name, command, parser in commands:
        try:
            result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=15)
            items.extend(parser(result.stdout))
        except (OSError, subprocess.SubprocessError):
            failed.append(name)
    return {'items': items, 'unavailable': failed}
