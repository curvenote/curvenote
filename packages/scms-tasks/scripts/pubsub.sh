#!/usr/bin/env bash
#
# Set up GCP Pub/Sub for an SCMS Cloud Run service that uses @curvenote/scms-tasks.
#
# This script:
#   1. Creates a dedicated service account for invoking the Cloud Run service and publishing to Pub/Sub
#   2. Grants that account roles/run.invoker on the Cloud Run service
#   3. Grants that account roles/pubsub.publisher on the project
#   4. Grants the GCP Pub/Sub service agent roles/iam.serviceAccountTokenCreator (required for push + auth)
#   5. Creates a Pub/Sub topic and a push subscription that delivers to your Cloud Run URL
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Application default credentials or a service account with sufficient IAM (see below)
#   - The Cloud Run service must already be deployed (you need its URL for the push endpoint)
#   - Cloud Run and Pub/Sub APIs enabled on the project
#
# Required environment variables (or set in .env in this scripts/ dir and source before running):
#   PROJECT_ID       - GCP project ID (e.g. my-project)
#   PROJECT_NUMBER   - GCP project number (numeric; find in Console or: gcloud projects describe PROJECT_ID --format='value(projectNumber)')
#   REGION           - Cloud Run region (e.g. us-central1)
#   SERVICE_NAME     - Name of the Cloud Run service (e.g. scms-converter)
#   PUSH_ENDPOINT    - Full URL of the Cloud Run service (e.g. https://scms-converter-xxxxx-uc.a.run.app)
#
# Optional (defaults shown):
#   TOPIC_NAME             - Pub/Sub topic (default: scmsTasksTopic)
#   SUBSCRIPTION_NAME      - Push subscription (default: scmsTasksSub)
#   SERVICE_ACCOUNT_NAME   - Name for the invoker SA (default: scms-tasks-invoker)
#   ACK_DEADLINE          - Subscription ack deadline in seconds (default: 600)
#
# The script does NOT create the project or the Cloud Run service. It assumes they exist.
# Run from package root: ./scripts/pubsub.sh  (or from scripts/: ./pubsub.sh)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Load .env from scripts dir if present
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
TOPIC_NAME="${TOPIC_NAME:-scmsTasksTopic}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-scmsTasksSub}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-scms-tasks-invoker}"
ACK_DEADLINE="${ACK_DEADLINE:-600}"

missing=()
[[ -z "$PROJECT_ID" ]]     && missing+=(PROJECT_ID)
[[ -z "$PROJECT_NUMBER" ]] && missing+=(PROJECT_NUMBER)
[[ -z "$REGION" ]]         && missing+=(REGION)
[[ -z "$SERVICE_NAME" ]]   && missing+=(SERVICE_NAME)
[[ -z "$PUSH_ENDPOINT" ]]  && missing+=(PUSH_ENDPOINT)

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables: ${missing[*]}"
  echo ""
  echo "Example (after deploying your Cloud Run service):"
  echo "  export PROJECT_ID=my-gcp-project"
  echo "  export PROJECT_NUMBER=\$(gcloud projects describe \$PROJECT_ID --format='value(projectNumber)')"
  echo "  export REGION=us-central1"
  echo "  export SERVICE_NAME=scms-converter"
  echo "  export PUSH_ENDPOINT=https://scms-converter-xxxxx-uc.a.run.app"
  echo "  ./scripts/pubsub.sh"
  exit 1
fi

SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PUBSUB_SA_EMAIL="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

echo "Creating service account: ${SERVICE_ACCOUNT_NAME}"
gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
  --display-name "SCMS Tasks Pub/Sub Invoker" \
  --project "${PROJECT_ID}"

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

echo "Creating Pub/Sub topic: ${TOPIC_NAME}"
gcloud pubsub topics create "${TOPIC_NAME}" --project "${PROJECT_ID}"

echo "Creating push subscription: ${SUBSCRIPTION_NAME}"
gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}" \
  --topic "${TOPIC_NAME}" \
  --ack-deadline="${ACK_DEADLINE}" \
  --push-endpoint="${PUSH_ENDPOINT}" \
  --push-auth-service-account="${SA_EMAIL}" \
  --project "${PROJECT_ID}"

echo ""
echo "Done. Add to your app config:"
echo "  topic: ${TOPIC_NAME}"
echo "  projectId: ${PROJECT_ID}"
echo "  pushEndpoint: ${PUSH_ENDPOINT}"
echo "  secretKeyfile: (key for ${SA_EMAIL} if publishing from outside GCP)"
echo ""
echo "Test publish (optional):"
echo "  gcloud pubsub topics publish ${TOPIC_NAME} --project ${PROJECT_ID} --attribute 'jobUrl=...,statusUrl=...,handshake=...,successState=...,failureState=...,userId=...' --message '\$(echo '{\"taskId\":\"test\"}' | base64)'"
