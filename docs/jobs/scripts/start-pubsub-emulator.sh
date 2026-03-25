#!/usr/bin/env bash
#
# Start the GCP Pub/Sub emulator in the background, wait until the REST API
# responds, then run emulator-setup.sh. Exits when ready so you can use the same
# terminal for `npm run dev`. Stop with stop-pubsub-emulator.sh or
# npm run dev:pubsub:emulator:stop.
#
# The emulator keeps state only in memory — each restart clears topics; this
# script runs setup after each fresh start.
#
set -euo pipefail

EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT_ID="${PUBSUB_PROJECT_ID:-curvenote-dev-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="${SCRIPT_DIR}/.pubsub-emulator.pid"
LOGFILE="${SCRIPT_DIR}/.pubsub-emulator.log"

export PUBSUB_EMULATOR_HOST="${EMULATOR_HOST}"

topics_url="http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/topics"

# Port segment of PUBSUB_EMULATOR_HOST (e.g. 8085 from localhost:8085)
emulator_listen_port() {
  echo "${EMULATOR_HOST##*:}"
}

# Write the PID of whatever is listening on the emulator port so stop-pubsub-emulator.sh
# can kill it. Needed when: (1) this script's "already up" branch runs (no nohup PID),
# (2) PID file was deleted while the emulator kept running, (3) gcloud's PID is a wrapper
# and the JVM owns the port.
refresh_emulator_pidfile() {
  local port
  port="$(emulator_listen_port)"
  local detected=""
  if command -v lsof >/dev/null 2>&1; then
    detected=$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n1)
  fi
  if [[ -n "${detected}" ]]; then
    echo "${detected}" >"${PIDFILE}"
    echo "Recorded emulator listener PID ${detected} in ${PIDFILE} (port ${port})."
    return 0
  fi
  return 1
}

wait_for_api() {
  local max_attempts="${1:-60}"
  local attempt
  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if curl -sf "${topics_url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

run_setup() {
  echo "Running topic/subscription setup..."
  "${SCRIPT_DIR}/emulator-setup.sh"
}

# Emulator already up (this script or manual gcloud)
if curl -sf "${topics_url}" >/dev/null 2>&1; then
  echo "Pub/Sub emulator already responding at ${EMULATOR_HOST}."
  if ! refresh_emulator_pidfile; then
    echo "Warning: could not detect listener PID on port $(emulator_listen_port); npm run dev:pubsub:emulator:stop may not find the process." >&2
  fi
  run_setup
  echo ""
  echo "Done. Stop the emulator with:"
  echo "  npm run dev:pubsub:emulator:stop"
  exit 0
fi

# Another start may still be booting: same PID file + live process
if [[ -f "${PIDFILE}" ]]; then
  old_pid="$(cat "${PIDFILE}")"
  if kill -0 "${old_pid}" 2>/dev/null; then
    echo "Waiting for emulator (PID ${old_pid}) to accept connections..."
    if wait_for_api 60; then
      refresh_emulator_pidfile || true
      run_setup
      echo ""
      echo "Done. Stop with: npm run dev:pubsub:emulator:stop"
      exit 0
    fi
    echo "Emulator process ${old_pid} did not become ready; remove ${PIDFILE} or run stop script." >&2
    exit 1
  fi
  rm -f "${PIDFILE}"
fi

echo "=== Starting Pub/Sub emulator in background (${EMULATOR_HOST}, project ${PROJECT_ID}) ==="
echo "Logs: ${LOGFILE}"

nohup gcloud beta emulators pubsub start --project="${PROJECT_ID}" --host-port="${EMULATOR_HOST}" \
  >>"${LOGFILE}" 2>&1 &
EMULATOR_PID=$!

echo "Waiting for emulator HTTP API..."
if ! wait_for_api 60; then
  echo "Emulator did not become ready in time. See ${LOGFILE}" >&2
  kill "${EMULATOR_PID}" 2>/dev/null || true
  rm -f "${PIDFILE}"
  exit 1
fi

if ! refresh_emulator_pidfile; then
  echo "${EMULATOR_PID}" >"${PIDFILE}"
  echo "Warning: could not detect listener PID; using gcloud parent PID ${EMULATOR_PID} in ${PIDFILE}." >&2
fi

if ! run_setup; then
  echo "Setup failed; stopping emulator." >&2
  kill "$(cat "${PIDFILE}")" 2>/dev/null || kill "${EMULATOR_PID}" 2>/dev/null || true
  wait "${EMULATOR_PID}" 2>/dev/null || true
  rm -f "${PIDFILE}"
  exit 1
fi

echo ""
echo "Emulator is running in the background (PID $(cat "${PIDFILE}"))."
echo "Stop with: npm run dev:pubsub:emulator:stop"
echo "Logs: ${LOGFILE}"
