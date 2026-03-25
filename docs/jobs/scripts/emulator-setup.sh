#!/usr/bin/env bash
#
# Create topics and push subscriptions on the local Pub/Sub emulator.
#
# Run this AFTER starting the emulator with:
#   gcloud beta emulators pubsub start --project=curvenote-dev-1
#
# And AFTER setting the env var:
#   export PUBSUB_EMULATOR_HOST=localhost:8085
#
# This script uses the REST API directly (the emulator doesn't support gcloud CLI).
# It creates all the topics and subscriptions that the SCMS app expects.
#
# Nothing here is "permanent" on disk: the emulator keeps all topics and
# subscriptions in memory. Stopping the emulator wipes them — re-run this script
# after a restart. Re-running while the emulator stays up is idempotent (HTTP
# 409 = already exists). To tear down and recreate without restarting the
# emulator, pass --reset first.
#
set -euo pipefail

EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT_ID="${PUBSUB_PROJECT_ID:-curvenote-dev-1}"
# Vite uses VITE_PORT from platform/scms/.env; Node dispatch code uses PORT. Match the
# port your dev server actually prints (defaults below assume 3031 from .env.sample).
SCMS_PORT="${PORT:-${VITE_PORT:-3031}}"
# Push URL host: Java client uses IPv4 to 127.0.0.1. Dev server must listen on all
# interfaces (platform/scms vite server.host) or push fails while curl to localhost works.
SCMS_PUSH_HOST="${SCMS_PUSH_HOST:-127.0.0.1}"
SCMS_ORIGIN="http://${SCMS_PUSH_HOST}:${SCMS_PORT}"

RESET=false
if [[ "${1:-}" == "--reset" ]]; then
  RESET=true
fi

# Delete subscriptions before topics (subscriptions reference topics).
delete_subscription() {
  local sub_name="$1"
  local url="http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/subscriptions/${sub_name}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${url}")
  if [[ "$status" == "200" || "$status" == "404" ]]; then
    echo "  (removed subscription: ${sub_name})"
  else
    echo "✗ Failed to delete subscription ${sub_name} (HTTP ${status})"
    return 1
  fi
}

delete_topic() {
  local topic_name="$1"
  local url="http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/topics/${topic_name}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${url}")
  if [[ "$status" == "200" || "$status" == "404" ]]; then
    echo "  (removed topic: ${topic_name})"
  else
    echo "✗ Failed to delete topic ${topic_name} (HTTP ${status})"
    return 1
  fi
}

if [[ "$RESET" == true ]]; then
  echo "=== Reset (delete existing resources) ==="
  delete_subscription "scmsJobDispatch-sub"
  delete_subscription "scmsJobDispatch-deadletter-sub"
  delete_subscription "scmsCheckTopic-sub"
  delete_subscription "scmsTaskConverterTopic-sub"
  delete_topic "scmsJobDispatch"
  delete_topic "scmsJobDispatch-deadletter"
  delete_topic "scmsCheckTopic"
  delete_topic "scmsTaskConverterTopic"
  echo ""
fi

echo "=== Pub/Sub Emulator Setup ==="
echo "Emulator:  ${EMULATOR_HOST}"
echo "Project:   ${PROJECT_ID}"
echo "SCMS:      ${SCMS_ORIGIN}"
echo ""

# Helper: create a topic via the emulator REST API
create_topic() {
  local topic_name="$1"
  local url="http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/topics/${topic_name}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${url}")
  if [[ "$status" == "200" || "$status" == "409" ]]; then
    echo "✓ Topic: ${topic_name}"
  else
    echo "✗ Failed to create topic ${topic_name} (HTTP ${status})"
    return 1
  fi
}

# Helper: create a push subscription via the emulator REST API
create_push_subscription() {
  local sub_name="$1"
  local topic_name="$2"
  local push_endpoint="$3"
  local url="http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/subscriptions/${sub_name}"
  local body
  body=$(cat <<EOF
{
  "topic": "projects/${PROJECT_ID}/topics/${topic_name}",
  "pushConfig": {
    "pushEndpoint": "${push_endpoint}"
  },
  "ackDeadlineSeconds": 60
}
EOF
  )
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${url}" \
    -H "Content-Type: application/json" \
    -d "${body}")
  if [[ "$status" == "200" || "$status" == "409" ]]; then
    echo "✓ Subscription: ${sub_name} → ${push_endpoint}"
  else
    echo "✗ Failed to create subscription ${sub_name} (HTTP ${status})"
    return 1
  fi
}

# Helper: create a pull subscription (for topics we just want to observe)
create_pull_subscription() {
  local sub_name="$1"
  local topic_name="$2"
  local url="http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/subscriptions/${sub_name}"
  local body
  body=$(cat <<EOF
{
  "topic": "projects/${PROJECT_ID}/topics/${topic_name}",
  "ackDeadlineSeconds": 60
}
EOF
  )
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${url}" \
    -H "Content-Type: application/json" \
    -d "${body}")
  if [[ "$status" == "200" || "$status" == "409" ]]; then
    echo "✓ Pull subscription: ${sub_name} (topic: ${topic_name})"
  else
    echo "✗ Failed to create pull subscription ${sub_name} (HTTP ${status})"
    return 1
  fi
}

echo "--- Topics ---"
create_topic "scmsJobDispatch"
create_topic "scmsJobDispatch-deadletter"
# Worker topics (for two-hop handlers)
create_topic "scmsCheckTopic"
create_topic "scmsTaskConverterTopic"

echo ""
echo "--- Subscriptions ---"

# Dispatch: push to SCMS app
create_push_subscription "scmsJobDispatch-sub" "scmsJobDispatch" \
  "${SCMS_ORIGIN}/v1/jobs/dispatch"

# Dead letter: push to SCMS app
create_push_subscription "scmsJobDispatch-deadletter-sub" "scmsJobDispatch-deadletter" \
  "${SCMS_ORIGIN}/v1/jobs/dispatch/dlq"

# Worker topics: pull subscriptions (workers pull from these, or you can use push to local workers)
create_pull_subscription "scmsCheckTopic-sub" "scmsCheckTopic"
create_pull_subscription "scmsTaskConverterTopic-sub" "scmsTaskConverterTopic"

echo ""
echo "=== Done ==="
echo ""
echo "Topics and subscriptions created in the running emulator (in-memory only)."
echo ""
echo "To publish a test dispatch message:"
# Static base64 of {"job_id":"test-123","job_type":"CHECK","payload":{}} — avoids brittle nested quoting.
echo "  curl -s -X POST http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/topics/scmsJobDispatch:publish \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"messages\":[{\"attributes\":{\"handshake\":\"test\",\"job_type\":\"CHECK\"},\"data\":\"eyJqb2JfaWQiOiJ0ZXN0LTEyMyIsImpvYl90eXBlIjoiQ0hFQ0siLCJwYXlsb2FkIjp7fX0=\"}]}'"
