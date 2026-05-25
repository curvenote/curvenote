#!/usr/bin/env bash

# Monitor localhost PostgreSQL TCP traffic during a benchmark run (macOS).
# Requires tcpdump (Xcode CLT) and passwordless sudo for best results.

PG_TRAFFIC_MODE=""
PG_TRAFFIC_PCAP=""
PG_TRAFFIC_LO0_BEFORE=""
PG_TRAFFIC_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_TRAFFIC_MONITOR_PY="${PG_TRAFFIC_LIB_DIR}/pg-traffic-monitor.py"

format_pg_traffic_bytes() {
  local bytes="$1"
  if (( bytes >= 1073741824 )); then
    printf '%.2f GB' "$(awk "BEGIN {print ${bytes}/1073741824}")"
  elif (( bytes >= 1048576 )); then
    printf '%.2f MB' "$(awk "BEGIN {print ${bytes}/1048576}")"
  elif (( bytes >= 1024 )); then
    printf '%.2f KB' "$(awk "BEGIN {print ${bytes}/1024}")"
  else
    printf '%s B' "${bytes}"
  fi
}

lo0_total_bytes() {
  netstat -ib -I lo0 2>/dev/null | awk 'NR>1 { sum += $7 + $10 } END { print sum + 0 }'
}

pg_traffic_tcpdump_path() {
  command -v tcpdump
}

pg_traffic_sudoers_file() {
  echo "/etc/sudoers.d/pg-traffic-tcpdump"
}

pg_traffic_sudo_configured() {
  local tcpdump_path
  tcpdump_path="$(pg_traffic_tcpdump_path)" || return 1
  sudo -n "${tcpdump_path}" --version >/dev/null 2>&1
}

pg_traffic_setup_sudo() {
  local tcpdump_path user rule file tmp
  tcpdump_path="$(pg_traffic_tcpdump_path)" || {
    echo "Postgres traffic monitor: tcpdump not found. Install Xcode Command Line Tools." >&2
    return 1
  }

  if pg_traffic_sudo_configured; then
    echo "Postgres traffic monitor: passwordless sudo for tcpdump is already configured."
    return 0
  fi

  user="$(whoami)"
  file="$(pg_traffic_sudoers_file)"
  rule="${user} ALL=(root) NOPASSWD: ${tcpdump_path}"
  kill_rule="${user} ALL=(root) NOPASSWD: /bin/kill"

  echo "One-time setup for postgres traffic monitoring"
  echo "This asks for your macOS password once, then future runs skip sudo prompts."
  echo "Installing sudo rules:"
  echo "  ${rule}"
  echo "  ${kill_rule}"

  tmp="$(mktemp "${TMPDIR:-/tmp}/pg-traffic-sudoers.XXXXXX")"
  printf '%s\n' "${rule}" "${kill_rule}" > "${tmp}"

  if ! sudo visudo -cf "${tmp}" >/dev/null 2>&1; then
    echo "Postgres traffic monitor: generated sudoers rule failed validation." >&2
    rm -f "${tmp}"
    return 1
  fi

  if ! sudo cp "${tmp}" "${file}"; then
    rm -f "${tmp}"
    return 1
  fi
  rm -f "${tmp}"
  sudo chmod 440 "${file}"

  if pg_traffic_sudo_configured; then
    echo "Postgres traffic monitor: setup complete."
    return 0
  fi

  echo "Postgres traffic monitor: setup wrote ${file} but verification failed." >&2
  return 1
}

pg_traffic_ensure_sudo() {
  if pg_traffic_sudo_configured; then
    return 0
  fi

  if [[ ! -t 0 ]]; then
    echo "Postgres traffic monitor: run './scripts/etl-register-works.sh --setup-sudo' once to avoid sudo prompts." >&2
    return 1
  fi

  read -r -p "Run one-time sudo setup for postgres traffic monitoring? [y/N] " reply
  if [[ ! "${reply}" =~ ^[Yy]$ ]]; then
    echo "Postgres traffic monitor: continuing without setup (sudo password may be required)." >&2
    return 1
  fi

  pg_traffic_setup_sudo
}

pg_traffic_sudo() {
  if pg_traffic_sudo_configured; then
    sudo -n "$@"
  else
    sudo "$@"
  fi
}

pg_traffic_tcpdump_pids_for_pcap() {
  local pcap="$1"
  ps ax -o pid= -o command= 2>/dev/null | awk -v pcap="${pcap}" '/tcpdump/ && index($0, pcap) { print $1 }'
}

pg_traffic_stop_tcpdump() {
  local pcap="$1"
  local pid attempt

  for pid in $(pg_traffic_tcpdump_pids_for_pcap "${pcap}"); do
    pg_traffic_sudo kill -INT "${pid}" 2>/dev/null || true
  done

  for attempt in $(seq 1 30); do
    [[ -z "$(pg_traffic_tcpdump_pids_for_pcap "${pcap}")" ]] && break
    sleep 0.1
  done

  for pid in $(pg_traffic_tcpdump_pids_for_pcap "${pcap}"); do
    pg_traffic_sudo kill -TERM "${pid}" 2>/dev/null || true
  done
  sleep 0.2

  for pid in $(pg_traffic_tcpdump_pids_for_pcap "${pcap}"); do
    pg_traffic_sudo kill -KILL "${pid}" 2>/dev/null || true
  done
}

pg_traffic_monitor_start() {
  local port="${1:-5432}"

  if ! pg_traffic_tcpdump_path >/dev/null 2>&1; then
    echo "Postgres traffic monitor: tcpdump not found; falling back to lo0 byte counter." >&2
    PG_TRAFFIC_MODE="lo0"
    PG_TRAFFIC_LO0_BEFORE="$(lo0_total_bytes)"
    return 0
  fi

  if ! pg_traffic_sudo_configured; then
    pg_traffic_ensure_sudo || true
  fi

  PG_TRAFFIC_PCAP="$(mktemp "${TMPDIR:-/tmp}/etl-pg-traffic.XXXXXX")"
  pg_traffic_sudo "$(pg_traffic_tcpdump_path)" -Z "$(whoami)" -i lo0 -n "port ${port}" -w "${PG_TRAFFIC_PCAP}" -U -q >/dev/null 2>&1 &
  sleep 0.3

  if [[ -n "$(pg_traffic_tcpdump_pids_for_pcap "${PG_TRAFFIC_PCAP}")" ]]; then
    PG_TRAFFIC_MODE="tcpdump"
    echo "Postgres traffic monitor: capturing TCP port ${port} on lo0 (stats print when the run finishes)."
    return 0
  fi

  echo "Postgres traffic monitor: tcpdump failed; using lo0 byte counter (includes all localhost traffic)." >&2
  PG_TRAFFIC_MODE="lo0"
  PG_TRAFFIC_LO0_BEFORE="$(lo0_total_bytes)"
  rm -f "${PG_TRAFFIC_PCAP}"
  PG_TRAFFIC_PCAP=""
}

pg_traffic_monitor_stop() {
  local port="${1:-5432}"

  case "${PG_TRAFFIC_MODE}" in
    tcpdump)
      if [[ -n "${PG_TRAFFIC_PCAP:-}" ]]; then
        pg_traffic_stop_tcpdump "${PG_TRAFFIC_PCAP}"
      fi
      sleep 0.2

      if [[ ! -f "${PG_TRAFFIC_PCAP}" ]] || [[ "$(wc -c < "${PG_TRAFFIC_PCAP}" | tr -d ' ')" -le 24 ]]; then
        echo "Postgres traffic monitor: no packets captured on port ${port}."
        echo "If SCMS uses a Unix socket instead of localhost:${port}, switch DATABASE_URL to TCP."
        rm -f "${PG_TRAFFIC_PCAP}"
        return 0
      fi

      local report packets bytes_in bytes_out bytes_total
      report="$(python3 "${PG_TRAFFIC_MONITOR_PY}" stats "${PG_TRAFFIC_PCAP}" "${port}" || true)"
      rm -f "${PG_TRAFFIC_PCAP}"
      PG_TRAFFIC_PCAP=""

      if [[ -z "${report}" ]]; then
        echo "Postgres traffic monitor: failed to parse capture file." >&2
        return 0
      fi

      packets="$(printf '%s\n' "${report}" | awk -F= '/^packets=/{print $2}')"
      bytes_in="$(printf '%s\n' "${report}" | awk -F= '/^bytes_in=/{print $2}')"
      bytes_out="$(printf '%s\n' "${report}" | awk -F= '/^bytes_out=/{print $2}')"
      bytes_total="$(printf '%s\n' "${report}" | awk -F= '/^bytes_total=/{print $2}')"

      echo
      echo "Postgres traffic (TCP localhost:${port})"
      if [[ "${bytes_total}" == "0" ]]; then
        echo "  no packets captured on port ${port}"
        echo "  if DATABASE_URL uses a Unix socket, switch to localhost:${port} for TCP capture"
      fi
      echo "  packets:      ${packets}"
      echo "  to postgres:  $(format_pg_traffic_bytes "${bytes_in}") (${bytes_in} bytes)"
      echo "  from postgres:$(format_pg_traffic_bytes "${bytes_out}") (${bytes_out} bytes)"
      echo "  total:        $(format_pg_traffic_bytes "${bytes_total}") (${bytes_total} bytes)"
      ;;
    lo0)
      local after delta
      after="$(lo0_total_bytes)"
      delta=$((after - PG_TRAFFIC_LO0_BEFORE))
      echo
      echo "Loopback traffic estimate (lo0, all localhost protocols)"
      echo "  before: ${PG_TRAFFIC_LO0_BEFORE} bytes"
      echo "  after:  ${after} bytes"
      echo "  delta:  $(format_pg_traffic_bytes "${delta}") (${delta} bytes)"
      echo "  note: includes HTTP/API traffic as well as postgres"
      ;;
    *)
      ;;
  esac
}
