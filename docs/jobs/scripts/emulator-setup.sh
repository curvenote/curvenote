#!/usr/bin/env bash
#
# Create topics and push subscriptions on the local Pub/Sub emulator.
#
# Run this AFTER starting the emulator with:
#   gcloud beta emulators pubsub start --project=local-dev
#
# And AFTER setting the env var:
#   export PUBSUB_EMULATOR_HOST=localhost:8085
#
# This script uses the REST API directly (the emulator doesn't support gcloud CLI).
# It creates all the topics and subscriptions that the SCMS app expects.
#
set -euo pipefail

EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT_ID="${PUBSUB_PROJECT_ID:-local-dev}"
SCMS_PORT="${PORT:-3031}"
SCMS_ORIGIN="http://localhost:${SCMS_PORT}"

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
echo "Topics and subscriptions created on the local emulator."
echo ""
echo "To publish a test dispatch message:"
# Static base64 of {"job_id":"test-123","job_type":"CHECK","payload":{}} — avoids brittle nested quoting.
echo "  curl -s -X POST http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/topics/scmsJobDispatch:publish \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"messages\":[{\"attributes\":{\"handshake\":\"test\",\"job_type\":\"CHECK\"},\"data\":\"eyJqb2JfaWQiOiJ0ZXN0LTEyMyIsImpvYl90eXBlIjoiQ0hFQ0siLCJwYXlsb2FkIjp7fX0=\"}]}'"
