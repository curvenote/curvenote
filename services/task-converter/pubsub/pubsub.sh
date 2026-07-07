#!/usr/bin/env bash
#
# Set up GCP Pub/Sub for the task-converter Cloud Run service.
#
# This script:
#   1. Uses the shared workspace SA (default: workspace-storage-checks) — must already exist
#   2. Grants that account roles/run.invoker on the Cloud Run service
#   3. Grants that account roles/pubsub.publisher on the project
#   4. Grants the GCP Pub/Sub service agent roles/iam.serviceAccountTokenCreator (required for push + auth)
#   5. Creates a Pub/Sub topic and a push subscription that delivers to your Cloud Run URL (or uses existing)
#   6. Updates push endpoint + push auth on existing subscriptions (idempotent re-run after redeploy)
#   7. Sets the subscription expiration policy to 'never' so it does not auto-delete
#      after 31 days of inactivity (GCP Pub/Sub default).
#
# Idempotent: safe to re-run; uses existing topic and subscription if present.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Application default credentials or a service account with sufficient IAM (see below)
#   - workspace-storage-checks (or SERVICE_ACCOUNT_NAME) must already exist in the project
#   - The Cloud Run service must already be deployed (you need its URL for the push endpoint)
#   - Cloud Run and Pub/Sub APIs enabled on the project
#
# Required environment variables (or set in .env in this pubsub/ dir):
#   PROJECT_ID       - GCP project ID (e.g. my-project)
#   PROJECT_NUMBER   - GCP project number (numeric; find in Console or: gcloud projects describe PROJECT_ID --format='value(projectNumber)')
#   REGION           - Cloud Run region (e.g. us-central1)
#   SERVICE_NAME     - Name of the Cloud Run service (e.g. task-converter)
#   PUSH_ENDPOINT    - Full URL of the Cloud Run service (e.g. https://task-converter-xxxxx-uc.a.run.app)
#   TOPIC_NAME       - Pub/Sub topic (e.g. scmsTaskConverterTopic)
#   SUBSCRIPTION_NAME - Push subscription (e.g. scmsTaskConverterSub)
#
# Optional (defaults shown):
#   SERVICE_ACCOUNT_NAME   - Shared workspace SA (default: workspace-storage-checks)
#   ACK_DEADLINE          - Subscription ack deadline in seconds (default: 600)
#
# The script does NOT create the project, the Cloud Run service, or the service account.
# Run from services/task-converter/pubsub/: ./pubsub.sh
#
# To fix a mistaken storage-pubsub setup, run ./migrate-to-workspace-storage-checks.sh first.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Load .env from pubsub dir if present
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
TOPIC_NAME="${TOPIC_NAME:-}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-workspace-storage-checks}"
ACK_DEADLINE="${ACK_DEADLINE:-600}"

missing=()
[[ -z "$PROJECT_ID" ]]     && missing+=(PROJECT_ID)
[[ -z "$PROJECT_NUMBER" ]] && missing+=(PROJECT_NUMBER)
[[ -z "$REGION" ]]         && missing+=(REGION)
[[ -z "$SERVICE_NAME" ]]   && missing+=(SERVICE_NAME)
[[ -z "$PUSH_ENDPOINT" ]]  && missing+=(PUSH_ENDPOINT)
[[ -z "$TOPIC_NAME" ]]     && missing+=(TOPIC_NAME)
[[ -z "$SUBSCRIPTION_NAME" ]] && missing+=(SUBSCRIPTION_NAME)

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables: ${missing[*]}"
  echo ""
  echo "Example (after deploying your Cloud Run service):"
  echo "  export PROJECT_ID=my-gcp-project"
  echo "  export PROJECT_NUMBER=\$(gcloud projects describe \$PROJECT_ID --format='value(projectNumber)')"
  echo "  export REGION=us-central1"
  echo "  export SERVICE_NAME=task-converter"
  echo "  export PUSH_ENDPOINT=https://task-converter-xxxxx-uc.a.run.app"
  echo "  export TOPIC_NAME=scmsTaskConverterTopic"
  echo "  export SUBSCRIPTION_NAME=scmsTaskConverterSub"
  echo "  ./pubsub.sh"
  exit 1
fi

SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PUBSUB_SA_EMAIL="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Error: service account ${SA_EMAIL} not found."
  echo "Create it in GCP or set SERVICE_ACCOUNT_NAME to an existing shared workspace SA."
  echo "This script does not create service accounts (use migrate-to-workspace-storage-checks.sh to fix a bad setup)."
  exit 1
fi
echo "Using service account: ${SERVICE_ACCOUNT_NAME}"

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

echo "Granting Pub/Sub service agent roles/iam.serviceAccountTokenCreator (required for push auth)"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/iam.serviceAccountTokenCreator

if gcloud pubsub topics describe "${TOPIC_NAME}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Using existing Pub/Sub topic: ${TOPIC_NAME}"
else
  echo "Creating Pub/Sub topic: ${TOPIC_NAME}"
  gcloud pubsub topics create "${TOPIC_NAME}" --project "${PROJECT_ID}"
fi

if gcloud pubsub subscriptions describe "${SUBSCRIPTION_NAME}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Updating existing push subscription: ${SUBSCRIPTION_NAME}"
  gcloud pubsub subscriptions update "${SUBSCRIPTION_NAME}" \
    --topic "${TOPIC_NAME}" \
    --ack-deadline="${ACK_DEADLINE}" \
    --expiration-period=never \
    --push-endpoint="${PUSH_ENDPOINT}" \
    --push-auth-service-account="${SA_EMAIL}" \
    --project "${PROJECT_ID}"
else
  echo "Creating push subscription: ${SUBSCRIPTION_NAME}"
  gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}" \
    --topic "${TOPIC_NAME}" \
    --ack-deadline="${ACK_DEADLINE}" \
    --expiration-period=never \
    --push-endpoint="${PUSH_ENDPOINT}" \
    --push-auth-service-account="${SA_EMAIL}" \
    --project "${PROJECT_ID}"
fi

echo ""
echo "Done. Add to your app config (same SA key for check, converter, and storage):"
echo "  pubsubProjectId: ${PROJECT_ID}"
echo "  converterTopic: projects/${PROJECT_ID}/topics/${TOPIC_NAME}"
echo "  checkSASecretKeyfile / converterSASecretKeyfile / storageSASecretKeyfile: key for ${SA_EMAIL}"
echo ""
echo "Test publish (optional):"
echo "  gcloud pubsub topics publish ${TOPIC_NAME} --project ${PROJECT_ID} --attribute 'jobUrl=...,statusUrl=...,handshake=...,successState=...,failureState=...,userId=...' --message '\$(echo '{\"taskId\":\"test\"}' | base64)'"
