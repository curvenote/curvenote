#!/usr/bin/env bash
set -Eeuo pipefail

# Live cumulative monitor for localhost PostgreSQL TCP traffic (macOS).
# Run in a separate terminal while manually testing the app.
#
# Example:
#   ./scripts/monitor-pg-traffic.sh
#   PG_PORT=5432 INTERVAL=1 ./scripts/monitor-pg-traffic.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE="${SCRIPT_DIR}/.env"
# shellcheck source=lib/load-env.sh
source "${SCRIPT_DIR}/lib/load-env.sh"
load_env_file "${ENV_FILE}"

PG_PORT="${PG_PORT:-${ETL_PG_PORT:-5432}}"
INTERVAL="${INTERVAL:-1}"
REFRESH="${REFRESH:-line}" # line | screen

# shellcheck source=lib/monitor-pg-traffic.sh
source "${SCRIPT_DIR}/lib/monitor-pg-traffic.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Monitor cumulative TCP traffic on localhost PostgreSQL while you test manually.
Press Ctrl+C for a final summary.

Options:
  --setup-sudo       One-time macOS sudo setup (no password prompts later)
  --port <n>         Postgres TCP port (default: ${PG_PORT})
  --interval <sec>   Refresh interval in seconds (default: ${INTERVAL})
  --refresh line     Update a single status line (default)
  --refresh screen   Clear screen each refresh
  -h, --help         Show this help

Environment:
  PG_PORT / ETL_PG_PORT   Postgres port (default: 5432)
  INTERVAL                Refresh interval seconds (default: 1)

Requires tcpdump (Xcode CLT). Run once with --setup-sudo to avoid password prompts.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --setup-sudo)
      pg_traffic_setup_sudo
      exit $?
      ;;
    --port)
      PG_PORT="$2"
      shift 2
      ;;
    --interval)
      INTERVAL="$2"
      shift 2
      ;;
    --refresh)
      REFRESH="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! pg_traffic_sudo_configured; then
  pg_traffic_ensure_sudo || true
fi

exec python3 "${PG_TRAFFIC_MONITOR_PY}" live \
  --port "${PG_PORT}" \
  --interval "${INTERVAL}" \
  --refresh "${REFRESH}"
