#!/usr/bin/env python3
"""Health, disk and memory checks for cron/systemd; nonzero status triggers alerting."""

import argparse
import json
import shutil
import sys
from urllib.request import Request, urlopen


def check(args):
    alerts = []
    try:
        request = Request(args.health_url, headers={'Accept': 'application/json'})
        with urlopen(request, timeout=5) as response:
            if response.status != 200 or json.load(response).get('ok') is not True:
                alerts.append('healthcheck істемейді')
    except Exception as error:
        alerts.append(f'healthcheck қатесі: {error}')

    disk = shutil.disk_usage(args.disk_path)
    disk_percent = disk.used * 100 // disk.total
    if disk_percent >= args.disk_percent:
        alerts.append(f'диск толуы {disk_percent}% (шек {args.disk_percent}%)')

    with open('/proc/meminfo', encoding='ascii') as source:
        memory = {parts[0].rstrip(':'): int(parts[1]) for line in source if (parts := line.split())}
    memory_percent = (memory['MemTotal'] - memory['MemAvailable']) * 100 // memory['MemTotal']
    if memory_percent >= args.memory_percent:
        alerts.append(f'жад қолдануы {memory_percent}% (шек {args.memory_percent}%)')

    if alerts:
        for alert in alerts:
            print(f'AisMebel ЕСКЕРТУ: {alert}', file=sys.stderr)
        return 1
    print(f'AisMebel OK: disk={disk_percent}%, memory={memory_percent}%')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--health-url', default='http://127.0.0.1:8096/api/health')
    parser.add_argument('--disk-path', default='/var/lib/docker')
    parser.add_argument('--disk-percent', type=int, default=85)
    parser.add_argument('--memory-percent', type=int, default=90)
    args = parser.parse_args()
    if not (1 <= args.disk_percent <= 100 and 1 <= args.memory_percent <= 100):
        parser.error('Шектер 1–100 аралығында болуы керек')
    try:
        return check(args)
    except (OSError, ValueError, KeyError) as error:
        print(f'AisMebel ЕСКЕРТУ: монитор қатесі: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
