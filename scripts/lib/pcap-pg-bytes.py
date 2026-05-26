#!/usr/bin/env python3
"""Backward-compatible wrapper around pg-traffic-monitor.py stats."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print('usage: pcap-pg-bytes.py <pcap-file> [port]', file=sys.stderr)
        return 2

    monitor = Path(__file__).with_name('pg-traffic-monitor.py')
    cmd = [sys.executable, str(monitor), 'stats', sys.argv[1]]
    if len(sys.argv) > 2:
        cmd.append(sys.argv[2])
    return subprocess.call(cmd)


if __name__ == '__main__':
    raise SystemExit(main())
