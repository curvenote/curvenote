#!/usr/bin/env python3
"""Postgres TCP traffic monitor for macOS localhost captures."""

from __future__ import annotations

import argparse
import os
import shutil
import signal
import struct
import subprocess
import sys
import time
from dataclasses import dataclass


@dataclass
class TrafficStats:
    packets: int = 0
    bytes_in: int = 0
    bytes_out: int = 0

    @property
    def bytes_total(self) -> int:
        return self.bytes_in + self.bytes_out


def format_bytes(num_bytes: int) -> str:
    if num_bytes >= 1_073_741_824:
        return f'{num_bytes / 1_073_741_824:.2f} GB'
    if num_bytes >= 1_048_576:
        return f'{num_bytes / 1_048_576:.2f} MB'
    if num_bytes >= 1024:
        return f'{num_bytes / 1024:.2f} KB'
    return f'{num_bytes} B'


def _match_tcp_ports(packet: bytes, incl_len: int, pg_port: int) -> tuple[bool, bool]:
    for offset in (0, 4):
        if len(packet) <= offset:
            continue
        version = packet[offset] >> 4
        if version == 4:
            if len(packet) < offset + 20:
                continue
            ihl = (packet[offset] & 0x0F) * 4
            if len(packet) < offset + ihl + 4:
                continue
            if packet[offset + 9] != 6:
                continue
            src_port, dst_port = struct.unpack(
                '!HH',
                packet[offset + ihl : offset + ihl + 4],
            )
        elif version == 6:
            if len(packet) < offset + 40 + 4:
                continue
            if packet[offset + 6] != 6:
                continue
            src_port, dst_port = struct.unpack(
                '!HH',
                packet[offset + 40 : offset + 44],
            )
        else:
            continue

        to_pg = dst_port == pg_port
        from_pg = src_port == pg_port
        if to_pg or from_pg:
            return to_pg, from_pg

    return False, False


def parse_pcap_increment(
    handle,
    pg_port: int,
    stats: TrafficStats,
    start_offset: int,
    endian: str,
) -> int:
    handle.seek(start_offset)
    offset = start_offset

    while True:
        packet_header = handle.read(16)
        if len(packet_header) < 16:
            break

        _ts_sec, _ts_usec, incl_len, _orig_len = struct.unpack(
            endian + 'IIII',
            packet_header,
        )
        packet = handle.read(incl_len)
        if len(packet) < incl_len:
            break

        to_pg, from_pg = _match_tcp_ports(packet, incl_len, pg_port)
        if to_pg or from_pg:
            stats.packets += 1
            if to_pg:
                stats.bytes_in += incl_len
            if from_pg:
                stats.bytes_out += incl_len

        offset = handle.tell()

    return offset


def read_pcap_endian(path: str) -> str | None:
    try:
        with open(path, 'rb') as handle:
            global_header = handle.read(24)
            if len(global_header) < 24:
                return None
            magic = struct.unpack('I', global_header[:4])[0]
            if magic == 0xA1B2C3D4:
                return '<'
            if magic == 0xD4C3B2A1:
                return '>'
    except OSError:
        return None
    print('Unsupported pcap format (pcapng not supported)', file=sys.stderr)
    return None


def read_pcap_stats(
    path: str,
    pg_port: int,
    start_offset: int = 24,
    stats: TrafficStats | None = None,
) -> tuple[TrafficStats, int]:
    if stats is None:
        stats = TrafficStats()

    endian = read_pcap_endian(path)
    if endian is None:
        return stats, start_offset

    try:
        with open(path, 'rb') as handle:
            end_offset = parse_pcap_increment(handle, pg_port, stats, start_offset, endian)
            return stats, end_offset
    except OSError:
        return stats, start_offset


def print_stats_kv(stats: TrafficStats, port: int) -> None:
    print(f'port={port}')
    print(f'packets={stats.packets}')
    print(f'bytes_in={stats.bytes_in}')
    print(f'bytes_out={stats.bytes_out}')
    print(f'bytes_total={stats.bytes_total}')
    print(f'human_in={format_bytes(stats.bytes_in)}')
    print(f'human_out={format_bytes(stats.bytes_out)}')
    print(f'human_total={format_bytes(stats.bytes_total)}')


def print_stats_human(stats: TrafficStats, port: int, label: str = '') -> None:
    prefix = f'{label} ' if label else ''
    print(
        f"{prefix}in: {format_bytes(stats.bytes_in):>8} ({stats.bytes_in} B)  "
        f"out: {format_bytes(stats.bytes_out):>8} ({stats.bytes_out} B)  "
        f"total: {format_bytes(stats.bytes_total):>8} ({stats.bytes_total} B)  "
        f"packets: {stats.packets}",
        flush=True,
    )


def tcpdump_path() -> str:
    path = shutil.which('tcpdump')
    if not path:
        raise RuntimeError('tcpdump not found (install Xcode Command Line Tools)')
    return path


def start_tcpdump(port: int, pcap_path: str) -> subprocess.Popen[bytes]:
    cmd = [
        'sudo',
        '-n',
        tcpdump_path(),
        '-Z',
        os.environ.get('USER', 'root'),
        '-i',
        'lo0',
        '-n',
        f'port {port}',
        '-w',
        pcap_path,
        '-U',
        '-q',
    ]
    return subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def find_tcpdump_pids(pcap_path: str) -> list[int]:
    try:
        output = subprocess.check_output(['ps', 'ax', '-o', 'pid=', '-o', 'command='], text=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []

    pids: list[int] = []
    for line in output.splitlines():
        if 'tcpdump' not in line or pcap_path not in line:
            continue
        pid_text = line.strip().split(None, 1)[0]
        try:
            pids.append(int(pid_text))
        except ValueError:
            continue
    return pids


def sudo_kill(signal_name: str, pid: int) -> None:
    subprocess.run(
        ['sudo', '-n', 'kill', f'-{signal_name}', str(pid)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def stop_tcpdump(proc: subprocess.Popen[bytes] | None, pcap_path: str) -> None:
    for signal_name in ('INT', 'TERM', 'KILL'):
        for pid in find_tcpdump_pids(pcap_path):
            sudo_kill(signal_name, pid)
        if not find_tcpdump_pids(pcap_path):
            break
        time.sleep(0.1 if signal_name == 'INT' else 0.2)

    if proc and proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass


def cmd_stats(args: argparse.Namespace) -> int:
    stats, _ = read_pcap_stats(args.pcap, args.port)
    print_stats_kv(stats, args.port)
    return 0


def cmd_live(args: argparse.Namespace) -> int:
    pcap_path = args.pcap or os.path.join(
        os.environ.get('TMPDIR', '/tmp'),
        f'pg-traffic-live-{os.getpid()}.pcap',
    )
    stats = TrafficStats()
    offset = 24
    proc: subprocess.Popen[bytes] | None = None
    stop_requested = False

    def request_stop(_signum: int, _frame: object | None) -> None:
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    print(f'Monitoring postgres TCP traffic on localhost:{args.port}. Press Ctrl+C to stop.')
    print('in = client -> postgres, out = postgres -> client (egress from postgres)')
    print()

    try:
        proc = start_tcpdump(args.port, pcap_path)
        time.sleep(0.3)
        if proc.poll() is not None:
            print('Failed to start tcpdump. Run ./scripts/etl-register-works.sh --setup-sudo first.', file=sys.stderr)
            return 1

        while not stop_requested:
            stats, offset = read_pcap_stats(pcap_path, args.port, offset, stats)
            if args.refresh == 'screen':
                print('\033[2J\033[H', end='')
                print(f'Postgres traffic monitor (localhost:{args.port})')
            else:
                print('\033[2K\r', end='')
            print_stats_human(stats, args.port, '[live]')
            end = time.time() + args.interval
            while time.time() < end and not stop_requested:
                time.sleep(min(0.1, end - time.time()))
    finally:
        stop_tcpdump(proc, pcap_path)
        stats, _ = read_pcap_stats(pcap_path, args.port, 24, stats)
        print()
        print(f'Final postgres traffic (TCP localhost:{args.port})')
        print_stats_human(stats, args.port)
        if os.path.exists(pcap_path):
            os.remove(pcap_path)

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description='Monitor localhost postgres TCP traffic')
    sub = parser.add_subparsers(dest='command', required=True)

    stats_cmd = sub.add_parser('stats', help='Parse a pcap file once')
    stats_cmd.add_argument('pcap')
    stats_cmd.add_argument('port', type=int, nargs='?', default=5432)
    stats_cmd.set_defaults(func=cmd_stats)

    live_cmd = sub.add_parser('live', help='Live cumulative monitor')
    live_cmd.add_argument('--port', type=int, default=5432)
    live_cmd.add_argument('--interval', type=float, default=1.0)
    live_cmd.add_argument('--refresh', choices=('line', 'screen'), default='line')
    live_cmd.add_argument('--pcap')
    live_cmd.set_defaults(func=cmd_live)

    args = parser.parse_args()
    return args.func(args)


if __name__ == '__main__':
    raise SystemExit(main())
