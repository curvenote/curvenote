#!/usr/bin/env bash
#
# Set up GCP Pub/Sub for the centralized SCMS Job Dispatch topic.
#
# Does not deploy your app. Creates topics and push subscriptions, and ensures a
# service account can publish to Pub/Sub and sign OIDC tokens for push delivery.
#
# This script:
#   1. Resolves a service account (existing by default, or creates one if asked)
#   2. Grants that account roles/pubsub.publisher on the project (idempotent)
#   3. Grants the Pub/Sub service agent roles/iam.serviceAccountTokenCreator on
#      that service account (required for --push-auth-service-account; idempotent)
#   4. Creates the main dispatch topic and dead letter topic (if missing)
#   5. Creates push subscriptions → PUSH_ORIGIN/v1/jobs/dispatch and .../dlq
#
# By default, prints a summary of planned changes and asks for confirmation before
# applying anything. Skip the prompt with: -y / --yes  or  PUBSUB_DISPATCH_YES=1
#
# Idempotent: safe to re-run; gcloud add-iam-policy-binding skips duplicates.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - SCMS deployed at PUSH_ORIGIN (HTTPS) so push endpoints exist
#   - Pub/Sub API enabled on the project
#
# Required environment variables (or .env in this directory):
#   PROJECT_ID       - GCP project ID
#   PROJECT_NUMBER   - gcloud projects describe $PROJECT_ID --format='value(projectNumber)'
#   PUSH_ORIGIN      - App origin (scheme + host, no path), e.g. https://scms.example.com
#
# Service account (one of):
#   SERVICE_ACCOUNT_EMAIL - Full email of an existing SA in this project (preferred)
#   SERVICE_ACCOUNT_NAME  - Short id only if email omitted (default: scms-dispatch-invoker)
#
# Optional:
#   CREATE_SERVICE_ACCOUNT - Set to 1 to create SERVICE_ACCOUNT_NAME if it does not exist
#   PUBSUB_DISPATCH_YES    - Set to 1 to apply without confirmation (same as -y)
#   TOPIC_NAME, DLQ_TOPIC_NAME, SUBSCRIPTION_NAME, DLQ_SUBSCRIPTION_NAME
#   ACK_DEADLINE, MAX_DELIVERY_ATTEMPTS
#
set -euo pipefail

SKIP_CONFIRM=0
for _arg in "$@"; do
  case "$_arg" in
    -y | --yes) SKIP_CONFIRM=1 ;;
    -h | --help)
      echo "Usage: $0 [-y|--yes] [-h|--help]"
      echo "  -y, --yes   Apply changes without prompting (non-interactive)."
      exit 0
      ;;
    *)
      echo "Unknown option: $_arg (use -h for help)" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env"
  set +a
fi

[[ "${PUBSUB_DISPATCH_YES:-}" == "1" ]] && SKIP_CONFIRM=1

PROJECT_ID="${PROJECT_ID:-}"
PROJECT_NUMBER="${PROJECT_NUMBER:-}"
PUSH_ORIGIN="${PUSH_ORIGIN:-}"
CREATE_SERVICE_ACCOUNT="${CREATE_SERVICE_ACCOUNT:-0}"

TOPIC_NAME="${TOPIC_NAME:-scmsJobDispatch}"
DLQ_TOPIC_NAME="${DLQ_TOPIC_NAME:-scmsJobDispatch-deadletter}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-scmsJobDispatch-sub}"
DLQ_SUBSCRIPTION_NAME="${DLQ_SUBSCRIPTION_NAME:-scmsJobDispatch-deadletter-sub}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-scms-dispatch-invoker}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-}"
ACK_DEADLINE="${ACK_DEADLINE:-600}"
MAX_DELIVERY_ATTEMPTS="${MAX_DELIVERY_ATTEMPTS:-5}"

missing=()
[[ -z "$PROJECT_ID" ]]     && missing+=(PROJECT_ID)
[[ -z "$PROJECT_NUMBER" ]] && missing+=(PROJECT_NUMBER)
[[ -z "$PUSH_ORIGIN" ]]    && missing+=(PUSH_ORIGIN)

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables: ${missing[*]}"
  echo ""
  echo "Example (use an existing service account):"
  echo "  export PROJECT_ID=my-gcp-project"
  echo "  export PROJECT_NUMBER=\$(gcloud projects describe \$PROJECT_ID --format='value(projectNumber)')"
  echo "  export PUSH_ORIGIN=https://scms.example.com"
  echo "  export SERVICE_ACCOUNT_EMAIL=scms-dispatch@my-gcp-project.iam.gserviceaccount.com"
  echo "  ./pubsub-dispatch.sh"
  echo ""
  echo "Example (default SA name scms-dispatch-invoker, create if missing):"
  echo "  export CREATE_SERVICE_ACCOUNT=1"
  echo "  export PROJECT_ID=my-gcp-project"
  echo "  export PROJECT_NUMBER=\$(gcloud projects describe \$PROJECT_ID --format='value(projectNumber)')"
  echo "  export PUSH_ORIGIN=https://scms.example.com"
  echo "  ./pubsub-dispatch.sh"
  exit 1
fi

# Normalize: strip trailing slash from PUSH_ORIGIN
PUSH_ORIGIN="${PUSH_ORIGIN%/}"

if [[ -n "$SERVICE_ACCOUNT_EMAIL" ]]; then
  SA_EMAIL="$SERVICE_ACCOUNT_EMAIL"
else
  SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
fi

PUBSUB_SA_EMAIL="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

# --- Inspect current state (no changes yet) ---
SA_EXISTS=0
if gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
  SA_EXISTS=1
fi

WILL_CREATE_SA=0
if [[ "$SA_EXISTS" -eq 0 ]]; then
  if [[ "$CREATE_SERVICE_ACCOUNT" == "1" ]] && [[ -z "${SERVICE_ACCOUNT_EMAIL:-}" ]]; then
    WILL_CREATE_SA=1
  else
    echo "Service account not found: ${SA_EMAIL}"
    if [[ -n "${SERVICE_ACCOUNT_EMAIL:-}" ]]; then
      echo "Create it in IAM or fix SERVICE_ACCOUNT_EMAIL."
    else
      echo "Create it in IAM, set SERVICE_ACCOUNT_EMAIL to an existing SA, or set CREATE_SERVICE_ACCOUNT=1 to create ${SERVICE_ACCOUNT_NAME}."
    fi
    exit 1
  fi
fi

TOPIC_MAIN_EXISTS=0
gcloud pubsub topics describe "${TOPIC_NAME}" --project "${PROJECT_ID}" &>/dev/null && TOPIC_MAIN_EXISTS=1 || true

TOPIC_DLQ_EXISTS=0
gcloud pubsub topics describe "${DLQ_TOPIC_NAME}" --project "${PROJECT_ID}" &>/dev/null && TOPIC_DLQ_EXISTS=1 || true

SUB_MAIN_EXISTS=0
gcloud pubsub subscriptions describe "${SUBSCRIPTION_NAME}" --project "${PROJECT_ID}" &>/dev/null && SUB_MAIN_EXISTS=1 || true

SUB_DLQ_EXISTS=0
gcloud pubsub subscriptions describe "${DLQ_SUBSCRIPTION_NAME}" --project "${PROJECT_ID}" &>/dev/null && SUB_DLQ_EXISTS=1 || true

# --- Change summary ---
echo ""
echo "================================================================"
echo "  Planned changes (project: ${PROJECT_ID})"
echo "================================================================"
echo ""
echo "Push origin: ${PUSH_ORIGIN}"
echo "Pub/Sub service agent: ${PUBSUB_SA_EMAIL}"
echo ""
echo "Service account: ${SA_EMAIL}"
if [[ "$WILL_CREATE_SA" -eq 1 ]]; then
  echo "  Action: CREATE (CREATE_SERVICE_ACCOUNT=1)"
else
  echo "  Action: use existing"
fi
echo ""
echo "IAM (gcloud add-iam-policy-binding; safe to re-run if already present)"
echo "  - Project ${PROJECT_ID}: ${SA_EMAIL} -> roles/pubsub.publisher"
echo "  - Service account ${SA_EMAIL}: ${PUBSUB_SA_EMAIL} -> roles/iam.serviceAccountTokenCreator"
echo ""
echo "Topics"
if [[ "$TOPIC_MAIN_EXISTS" -eq 1 ]]; then
  echo "  - ${TOPIC_NAME}: already exists (no-op)"
else
  echo "  - ${TOPIC_NAME}: CREATE"
fi
if [[ "$TOPIC_DLQ_EXISTS" -eq 1 ]]; then
  echo "  - ${DLQ_TOPIC_NAME}: already exists (no-op)"
else
  echo "  - ${DLQ_TOPIC_NAME}: CREATE"
fi
echo ""
echo "Topic IAM (DLQ topic -> Pub/Sub SA publisher; idempotent)"
echo "  - Topic ${DLQ_TOPIC_NAME}"
echo ""
echo "Subscriptions (push, OIDC via ${SA_EMAIL})"
if [[ "$SUB_MAIN_EXISTS" -eq 1 ]]; then
  echo "  - ${SUBSCRIPTION_NAME}: already exists (no-op)"
else
  echo "  - ${SUBSCRIPTION_NAME}: CREATE"
  echo "      topic: ${TOPIC_NAME}"
  echo "      endpoint: ${PUSH_ORIGIN}/v1/jobs/dispatch"
  echo "      ack deadline: ${ACK_DEADLINE}s, max delivery attempts: ${MAX_DELIVERY_ATTEMPTS}, DLQ: ${DLQ_TOPIC_NAME}"
fi
if [[ "$SUB_DLQ_EXISTS" -eq 1 ]]; then
  echo "  - ${DLQ_SUBSCRIPTION_NAME}: already exists (no-op)"
else
  echo "  - ${DLQ_SUBSCRIPTION_NAME}: CREATE"
  echo "      topic: ${DLQ_TOPIC_NAME}"
  echo "      endpoint: ${PUSH_ORIGIN}/v1/jobs/dispatch/dlq"
fi
echo ""
echo "Subscription IAM (main subscription -> Pub/Sub SA subscriber; idempotent)"
echo "  - Subscription ${SUBSCRIPTION_NAME}"
echo ""
echo "================================================================"

if [[ "$SKIP_CONFIRM" -eq 0 ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Apply these changes? [y/N] " reply
    case "${reply}" in
      [yY] | [yY][eE][sS]) ;;
      *)
        echo "Aborted."
        exit 1
        ;;
    esac
  else
    echo "Not a TTY and no -y/--yes: refusing to run non-interactively." >&2
    echo "Re-run with: $0 -y" >&2
    exit 1
  fi
else
  echo "Applying (--yes, skipping prompt)."
fi

echo ""

# --- Service account: create if planned ---
echo "=== Service Account ==="
if [[ "$WILL_CREATE_SA" -eq 1 ]]; then
  echo "Creating service account: ${SERVICE_ACCOUNT_NAME}"
  if ! gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name "SCMS job dispatch (Pub/Sub)" \
    --project "${PROJECT_ID}" 2>&1; then
    if gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
      echo "Service account already exists, continuing."
    else
      exit 1
    fi
  fi
else
  echo "Using existing service account: ${SA_EMAIL}"
fi

echo "Ensuring roles/pubsub.publisher on project for ${SA_EMAIL}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role=roles/pubsub.publisher

echo "Ensuring Pub/Sub service agent can sign OIDC tokens as ${SA_EMAIL} (push authentication)"
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/iam.serviceAccountTokenCreator \
  --project="${PROJECT_ID}"

# --- Topics ---
echo ""
echo "=== Topics ==="

if [[ "$TOPIC_MAIN_EXISTS" -eq 1 ]]; then
  echo "Using existing topic: ${TOPIC_NAME}"
else
  echo "Creating topic: ${TOPIC_NAME}"
  gcloud pubsub topics create "${TOPIC_NAME}" --project "${PROJECT_ID}"
fi

if [[ "$TOPIC_DLQ_EXISTS" -eq 1 ]]; then
  echo "Using existing dead letter topic: ${DLQ_TOPIC_NAME}"
else
  echo "Creating dead letter topic: ${DLQ_TOPIC_NAME}"
  gcloud pubsub topics create "${DLQ_TOPIC_NAME}" --project "${PROJECT_ID}"
fi

# --- Subscriptions ---
echo ""
echo "=== Subscriptions ==="

echo "Granting Pub/Sub SA publisher on dead letter topic (dead letter routing)"
gcloud pubsub topics add-iam-policy-binding "${DLQ_TOPIC_NAME}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/pubsub.publisher \
  --project "${PROJECT_ID}"

if [[ "$SUB_MAIN_EXISTS" -eq 1 ]]; then
  echo "Using existing subscription: ${SUBSCRIPTION_NAME}"
else
  echo "Creating push subscription: ${SUBSCRIPTION_NAME}"
  gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}" \
    --topic "${TOPIC_NAME}" \
    --ack-deadline="${ACK_DEADLINE}" \
    --push-endpoint="${PUSH_ORIGIN}/v1/jobs/dispatch" \
    --push-auth-service-account="${SA_EMAIL}" \
    --dead-letter-topic="${DLQ_TOPIC_NAME}" \
    --max-delivery-attempts="${MAX_DELIVERY_ATTEMPTS}" \
    --project "${PROJECT_ID}"
fi

if [[ "$SUB_DLQ_EXISTS" -eq 1 ]]; then
  echo "Using existing DLQ subscription: ${DLQ_SUBSCRIPTION_NAME}"
else
  echo "Creating DLQ push subscription: ${DLQ_SUBSCRIPTION_NAME}"
  gcloud pubsub subscriptions create "${DLQ_SUBSCRIPTION_NAME}" \
    --topic "${DLQ_TOPIC_NAME}" \
    --ack-deadline="60" \
    --push-endpoint="${PUSH_ORIGIN}/v1/jobs/dispatch/dlq" \
    --push-auth-service-account="${SA_EMAIL}" \
    --project "${PROJECT_ID}"
fi

echo ""
echo "Granting Pub/Sub SA subscriber on main subscription (DLQ forwarding)"
gcloud pubsub subscriptions add-iam-policy-binding "${SUBSCRIPTION_NAME}" \
  --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
  --role=roles/pubsub.subscriber \
  --project "${PROJECT_ID}"

echo ""
echo "=== Done ==="
echo ""
echo "Service account: ${SA_EMAIL}"
echo "Topics:"
echo "  Dispatch:     ${TOPIC_NAME}"
echo "  Dead Letter:  ${DLQ_TOPIC_NAME}"
echo ""
echo "Subscriptions:"
echo "  Dispatch:     ${SUBSCRIPTION_NAME} → ${PUSH_ORIGIN}/v1/jobs/dispatch"
echo "  Dead Letter:  ${DLQ_SUBSCRIPTION_NAME} → ${PUSH_ORIGIN}/v1/jobs/dispatch/dlq"
echo ""
echo "Max delivery attempts: ${MAX_DELIVERY_ATTEMPTS} (then → dead letter)"
echo "Ack deadline: ${ACK_DEADLINE}s"
echo ""
echo "Add to your app config:"
echo "  dispatchTopic: ${TOPIC_NAME}"
echo "  pubsubProjectId: ${PROJECT_ID}"
echo "  dispatchSASecretKeyfile: (JSON key for ${SA_EMAIL})"
echo ""
echo "Test publish:"
echo "  gcloud pubsub topics publish ${TOPIC_NAME} --project ${PROJECT_ID} \\"
echo "    --attribute 'handshake=test,job_type=CHECK' \\"
echo "    --message '{\"job_id\":\"test-123\",\"job_type\":\"CHECK\",\"payload\":{}}'"
