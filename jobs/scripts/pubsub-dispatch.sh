#!/usr/bin/env bash
#
# Set up GCP Pub/Sub for the centralized SCMS Job Dispatch topic.
#
# This script creates:
#   1. A service account for invoking the SCMS app and publishing to Pub/Sub
#   2. The main dispatch topic (scmsJobDispatch)
#   3. A dead letter topic (scmsJobDispatch-deadletter)
#   4. A push subscription on the dispatch topic → /api/v1/jobs/dispatch
#      with dead letter routing (max 5 delivery attempts)
#   5. A push subscription on the dead letter topic → /api/v1/jobs/dispatch-dlq
#
# Idempotent: safe to re-run; uses existing resources if present.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - The SCMS app must already be deployed (you need its URL for the push endpoint)
#   - Cloud Run and Pub/Sub APIs enabled on the project
#
# Required environment variables (or set in .env in this scripts/ dir):
#   PROJECT_ID       - GCP project ID
#   PROJECT_NUMBER   - GCP project number (gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
#   REGION           - Cloud Run region (e.g. us-central1)
#   SERVICE_NAME     - Cloud Run service name (e.g. scms-app)
#   PUSH_ENDPOINT    - Base URL of the SCMS app (e.g. https://scms-app-xxxxx-uc.a.run.app)
#
# Optional (defaults shown):
#   TOPIC_NAME              - Dispatch topic (default: scmsJobDispatch)
#   DLQ_TOPIC_NAME          - Dead letter topic (default: scmsJobDispatch-deadletter)
#   SUBSCRIPTION_NAME       - Push subscription (default: scmsJobDispatch-sub)
#   DLQ_SUBSCRIPTION_NAME   - DLQ subscription (default: scmsJobDispatch-deadletter-sub)
#   SERVICE_ACCOUNT_NAME    - Invoker SA (default: scms-dispatch-invoker)
#   ACK_DEADLINE            - Ack deadline seconds (default: 600)
#   MAX_DELIVERY_ATTEMPTS   - Before sending to DLQ (default: 5)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env"
  set +a
fi

PROJECT_ID="${PROJECT_ID:-}"
PROJECT_NUMBER="${PROJECT_NUMBER:-}"
REGION="${REGION:-}"
SERVICE_NAME="${SERVICE_NAME:-}"
PUSH_ENDPOINT="${PUSH_ENDPOINT:-}"

TOPIC_NAME="${TOPIC_NAME:-scmsJobDispatch}"
DLQ_TOPIC_NAME="${DLQ_TOPIC_NAME:-scmsJobDispatch-deadletter}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-scmsJobDispatch-sub}"
DLQ_SUBSCRIPTION_NAME="${DLQ_SUBSCRIPTION_NAME:-scmsJobDispatch-deadletter-sub}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-scms-dispatch-invoker}"
ACK_DEADLINE="${ACK_DEADLINE:-600}"
MAX_DELIVERY_ATTEMPTS="${MAX_DELIVERY_ATTEMPTS:-5}"

missing=()
[[ -z "$PROJECT_ID" ]]     && missing+=(PROJECT_ID)
[[ -z "$PROJECT_NUMBER" ]] && missing+=(PROJECT_NUMBER)
[[ -z "$REGION" ]]         && missing+=(REGION)
[[ -z "$SERVICE_NAME" ]]   && missing+=(SERVICE_NAME)
[[ -z "$PUSH_ENDPOINT" ]]  && missing+=(PUSH_ENDPOINT)

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables: ${missing[*]}"
  echo ""
  echo "Example:"
  echo "  export PROJECT_ID=my-gcp-project"
  echo "  export PROJECT_NUMBER=\$(gcloud projects describe \$PROJECT_ID --format='value(projectNumber)')"
  echo "  export REGION=us-central1"
  echo "  export SERVICE_NAME=scms-app"
  echo "  export PUSH_ENDPOINT=https://scms-app-xxxxx-uc.a.run.app"
  echo "  ./pubsub-dispatch.sh"
  exit 1
fi

# Normalize: strip trailing slash from push endpoint
PUSH_ENDPOINT="${PUSH_ENDPOINT%/}"

SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PUBSUB_SA_EMAIL="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

# --- Service Account ---
echo "=== Service Account ==="
if gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Using existing service account: ${SERVICE_ACCOUNT_NAME}"
else
  echo "Creating service account: ${SERVICE_ACCOUNT_NAME}"
  if ! gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name "SCMS Job Dispatch Pub/Sub Invoker" \
    --project "${PROJECT_ID}" 2>&1; then
    if gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
      echo "Service account already exists (created elsewhere), continuing."
    else
      exit 1
    fi
  fi
fi

echo "Granting run.invoker on Cloud Run service: ${SERVICE_NAME}"
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role=roles/run.invoker \
  --region "${REGION}" \
  --project "${PROJECT_ID}"

echo "Granting pubsub.publisher on project"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role=roles/pubsub.publisher

echo "Granting Pub/Sub service agent roles/iam.serviceAccountTokenCreator"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/iam.serviceAccountTokenCreator

# --- Topics ---
echo ""
echo "=== Topics ==="

# Main dispatch topic
if gcloud pubsub topics describe "${TOPIC_NAME}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Using existing topic: ${TOPIC_NAME}"
else
  echo "Creating topic: ${TOPIC_NAME}"
  gcloud pubsub topics create "${TOPIC_NAME}" --project "${PROJECT_ID}"
fi

# Dead letter topic
if gcloud pubsub topics describe "${DLQ_TOPIC_NAME}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Using existing dead letter topic: ${DLQ_TOPIC_NAME}"
else
  echo "Creating dead letter topic: ${DLQ_TOPIC_NAME}"
  gcloud pubsub topics create "${DLQ_TOPIC_NAME}" --project "${PROJECT_ID}"
fi

# --- Subscriptions ---
echo ""
echo "=== Subscriptions ==="

# Grant Pub/Sub SA permission to publish to the DLQ topic (required for dead letter routing)
echo "Granting Pub/Sub SA publisher on dead letter topic"
gcloud pubsub topics add-iam-policy-binding "${DLQ_TOPIC_NAME}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/pubsub.publisher \
  --project "${PROJECT_ID}"

# Main dispatch subscription → pushes to /api/v1/jobs/dispatch
if gcloud pubsub subscriptions describe "${SUBSCRIPTION_NAME}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Using existing subscription: ${SUBSCRIPTION_NAME}"
else
  echo "Creating push subscription: ${SUBSCRIPTION_NAME}"
  gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}" \
    --topic "${TOPIC_NAME}" \
    --ack-deadline="${ACK_DEADLINE}" \
    --push-endpoint="${PUSH_ENDPOINT}/api/v1/jobs/dispatch" \
    --push-auth-service-account="${SA_EMAIL}" \
    --dead-letter-topic="${DLQ_TOPIC_NAME}" \
    --max-delivery-attempts="${MAX_DELIVERY_ATTEMPTS}" \
    --project "${PROJECT_ID}"
fi

# Dead letter subscription → pushes to /api/v1/jobs/dispatch-dlq
if gcloud pubsub subscriptions describe "${DLQ_SUBSCRIPTION_NAME}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Using existing DLQ subscription: ${DLQ_SUBSCRIPTION_NAME}"
else
  echo "Creating DLQ push subscription: ${DLQ_SUBSCRIPTION_NAME}"
  gcloud pubsub subscriptions create "${DLQ_SUBSCRIPTION_NAME}" \
    --topic "${DLQ_TOPIC_NAME}" \
    --ack-deadline="60" \
    --push-endpoint="${PUSH_ENDPOINT}/api/v1/jobs/dispatch-dlq" \
    --push-auth-service-account="${SA_EMAIL}" \
    --project "${PROJECT_ID}"
fi

# Grant Pub/Sub SA permission to ack from the main subscription (required for dead letter routing)
echo ""
echo "Granting Pub/Sub SA subscriber on main subscription (for DLQ forwarding)"
gcloud pubsub subscriptions add-iam-policy-binding "${SUBSCRIPTION_NAME}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/pubsub.subscriber \
  --project "${PROJECT_ID}"

echo ""
echo "=== Done ==="
echo ""
echo "Topics:"
echo "  Dispatch:     ${TOPIC_NAME}"
echo "  Dead Letter:  ${DLQ_TOPIC_NAME}"
echo ""
echo "Subscriptions:"
echo "  Dispatch:     ${SUBSCRIPTION_NAME} → ${PUSH_ENDPOINT}/api/v1/jobs/dispatch"
echo "  Dead Letter:  ${DLQ_SUBSCRIPTION_NAME} → ${PUSH_ENDPOINT}/api/v1/jobs/dispatch-dlq"
echo ""
echo "Max delivery attempts: ${MAX_DELIVERY_ATTEMPTS} (then → dead letter)"
echo "Ack deadline: ${ACK_DEADLINE}s"
echo ""
echo "Add to your app config:"
echo "  dispatchTopic: ${TOPIC_NAME}"
echo "  dispatchProjectId: ${PROJECT_ID}"
echo "  dispatchSASecretKeyfile: (key for ${SA_EMAIL})"
echo ""
echo "Test publish:"
echo "  gcloud pubsub topics publish ${TOPIC_NAME} --project ${PROJECT_ID} \\"
echo "    --attribute 'handshake=test,job_type=CHECK' \\"
echo "    --message '{\"job_id\":\"test-123\",\"job_type\":\"CHECK\",\"payload\":{}}'"
