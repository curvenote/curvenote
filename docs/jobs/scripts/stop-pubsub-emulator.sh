#!/usr/bin/env bash
#
# Stop the Pub/Sub emulator started by start-pubsub-emulator.sh (uses .pubsub-emulator.pid).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="${SCRIPT_DIR}/.pubsub-emulator.pid"

if [[ ! -f "${PIDFILE}" ]]; then
  echo "No ${PIDFILE} — nothing to stop (if the emulator is still running, you may have started it outside this script)." >&2
  exit 1
fi

PID="$(cat "${PIDFILE}")"

if ! kill -0 "${PID}" 2>/dev/null; then
  echo "Process ${PID} is not running; removing stale PID file."
  rm -f "${PIDFILE}"
  exit 0
fi

echo "Stopping Pub/Sub emulator (PID ${PID})..."
kill "${PID}" 2>/dev/null || true
for _ in {1..15}; do
  if ! kill -0 "${PID}" 2>/dev/null; then
    break
  fi
  sleep 1
done

if kill -0 "${PID}" 2>/dev/null; then
  echo "Sending SIGKILL to ${PID}..."
  kill -9 "${PID}" 2>/dev/null || true
fi

wait "${PID}" 2>/dev/null || true
rm -f "${PIDFILE}"
echo "Stopped."
