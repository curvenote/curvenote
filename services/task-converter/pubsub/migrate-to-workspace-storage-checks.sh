#!/usr/bin/env bash
#
# One-time migration: move task-converter Pub/Sub permissions from a stray
# invoker SA (default: storage-pubsub) to the shared workspace SA
# workspace-storage-checks, then delete the stray account.
#
# Grants workspace-storage-checks:
#   - roles/pubsub.publisher (project) — SCMS publishes check + converter messages
#   - roles/run.invoker (task-converter Cloud Run) — Pub/Sub push OIDC auth
#
# Also repoints the push subscription to authenticate as workspace-storage-checks.
#
# Prerequisites: gcloud auth, same .env as pubsub.sh (PROJECT_ID, REGION, etc.)
#
# Usage:
#   cd services/task-converter/pubsub
#   cp .env.sample .env   # if needed; set PROJECT_ID, PUSH_ENDPOINT, etc.
#   ./migrate-to-workspace-storage-checks.sh              # dry-run (default)
#   CONFIRM=1 ./migrate-to-workspace-storage-checks.sh    # apply changes
#
# Optional overrides:
#   TARGET_SA_NAME=workspace-storage-checks
#   REMOVE_SA_NAME=storage-pubsub
#   SKIP_DELETE=1   — grant + repoint only; do not delete REMOVE_SA
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
SERVICE_NAME="${SERVICE_NAME:-task-converter}"
PUSH_ENDPOINT="${PUSH_ENDPOINT:-}"
TOPIC_NAME="${TOPIC_NAME:-scmsTaskConverterTopic}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-scmsTaskConverterSub}"
TARGET_SA_NAME="${TARGET_SA_NAME:-workspace-storage-checks}"
REMOVE_SA_NAME="${REMOVE_SA_NAME:-storage-pubsub}"
SKIP_DELETE="${SKIP_DELETE:-0}"
CONFIRM="${CONFIRM:-0}"

TARGET_EMAIL="${TARGET_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REMOVE_EMAIL="${REMOVE_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PUBSUB_SA_EMAIL="${PROJECT_NUMBER:+service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com}"

missing=()
[[ -z "$PROJECT_ID" ]] && missing+=(PROJECT_ID)
[[ -z "$PROJECT_NUMBER" ]] && missing+=(PROJECT_NUMBER)
[[ -z "$REGION" ]] && missing+=(REGION)
[[ -z "$PUSH_ENDPOINT" ]] && missing+=(PUSH_ENDPOINT)

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables: ${missing[*]}"
  exit 1
fi

run() {
  if [[ "$CONFIRM" == "1" ]]; then
    echo "+ $*"
    "$@"
  else
    echo "[dry-run] $*"
  fi
}

has_project_binding() {
  local member=$1 role=$2
  gcloud projects get-iam-policy "${PROJECT_ID}" \
    --flatten="bindings[].members" \
    --filter="bindings.role=${role} AND bindings.members:serviceAccount:${member}" \
    --format="value(bindings.role)" 2>/dev/null | grep -q .
}

has_run_invoker() {
  local member=$1
  gcloud run services get-iam-policy "${SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --flatten="bindings[].members" \
    --filter="bindings.role=roles/run.invoker AND bindings.members:serviceAccount:${member}" \
    --format="value(bindings.role)" 2>/dev/null | grep -q .
}

echo "=== Migrate Pub/Sub + Cloud Run invoker to ${TARGET_EMAIL} ==="
echo "Project:      ${PROJECT_ID}"
echo "Remove SA:    ${REMOVE_EMAIL} (SKIP_DELETE=${SKIP_DELETE})"
echo "Subscription: ${SUBSCRIPTION_NAME} → ${PUSH_ENDPOINT}"
echo "Mode:         $([[ "$CONFIRM" == "1" ]] && echo APPLY || echo DRY-RUN — set CONFIRM=1 to apply)"
echo ""

if ! gcloud iam service-accounts describe "${TARGET_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "Error: target service account not found: ${TARGET_EMAIL}"
  exit 1
fi

echo "--- 1. Grant roles to ${TARGET_SA_NAME} ---"

if has_project_binding "${TARGET_EMAIL}" "roles/pubsub.publisher"; then
  echo "Already has roles/pubsub.publisher"
else
  run gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${TARGET_EMAIL}" \
    --role=roles/pubsub.publisher
fi

if has_run_invoker "${TARGET_EMAIL}"; then
  echo "Already has roles/run.invoker on ${SERVICE_NAME}"
else
  run gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --member="serviceAccount:${TARGET_EMAIL}" \
    --role=roles/run.invoker \
    --region "${REGION}" \
    --project "${PROJECT_ID}"
fi

echo "Ensuring Pub/Sub service agent can mint OIDC tokens (project binding)"
if has_project_binding "${PUBSUB_SA_EMAIL}" "roles/iam.serviceAccountTokenCreator"; then
  echo "Pub/Sub agent already has roles/iam.serviceAccountTokenCreator"
else
  run gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${PUBSUB_SA_EMAIL}" \
    --role=roles/iam.serviceAccountTokenCreator
fi

echo ""
echo "--- 2. Repoint push subscription ${SUBSCRIPTION_NAME} ---"
run gcloud pubsub subscriptions update "${SUBSCRIPTION_NAME}" \
  --project "${PROJECT_ID}" \
  --push-endpoint="${PUSH_ENDPOINT}" \
  --push-auth-service-account="${TARGET_EMAIL}" \
  --expiration-period=never

echo ""
echo "--- 3. Remove permissions from ${REMOVE_SA_NAME} (if present) ---"

if gcloud iam service-accounts describe "${REMOVE_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
  if has_run_invoker "${REMOVE_EMAIL}"; then
    run gcloud run services remove-iam-policy-binding "${SERVICE_NAME}" \
      --member="serviceAccount:${REMOVE_EMAIL}" \
      --role=roles/run.invoker \
      --region "${REGION}" \
      --project "${PROJECT_ID}"
  else
    echo "No run.invoker binding for ${REMOVE_EMAIL}"
  fi

  if has_project_binding "${REMOVE_EMAIL}" "roles/pubsub.publisher"; then
    run gcloud projects remove-iam-policy-binding "${PROJECT_ID}" \
      --member="serviceAccount:${REMOVE_EMAIL}" \
      --role=roles/pubsub.publisher
  else
    echo "No pubsub.publisher binding for ${REMOVE_EMAIL}"
  fi

  if [[ "$SKIP_DELETE" != "1" ]]; then
    echo ""
    echo "--- 4. Delete user-managed keys and service account ${REMOVE_EMAIL} ---"
    if [[ "$CONFIRM" == "1" ]]; then
      while IFS= read -r key_id; do
        [[ -z "$key_id" ]] && continue
        echo "+ gcloud iam service-accounts keys delete ${key_id} ..."
        gcloud iam service-accounts keys delete "${key_id}" \
          --iam-account="${REMOVE_EMAIL}" \
          --project "${PROJECT_ID}" \
          --quiet
      done < <(
        gcloud iam service-accounts keys list \
          --iam-account="${REMOVE_EMAIL}" \
          --project "${PROJECT_ID}" \
          --filter="keyType=USER_MANAGED" \
          --format="value(name)"
      )
      run gcloud iam service-accounts delete "${REMOVE_EMAIL}" \
        --project "${PROJECT_ID}" \
        --quiet
    else
      echo "[dry-run] delete USER_MANAGED keys on ${REMOVE_EMAIL}"
      gcloud iam service-accounts keys list \
        --iam-account="${REMOVE_EMAIL}" \
        --project "${PROJECT_ID}" \
        --filter="keyType=USER_MANAGED" \
        --format="table(name,validAfterTime)" || true
      echo "[dry-run] gcloud iam service-accounts delete ${REMOVE_EMAIL}"
    fi
  else
    echo "SKIP_DELETE=1 — leaving ${REMOVE_EMAIL} in place (bindings removed only)"
  fi
else
  echo "Remove target ${REMOVE_EMAIL} does not exist; skipping cleanup"
fi

echo ""
echo "=== Done ==="
echo ""
echo "Update production app secrets so all of these use a key for ${TARGET_EMAIL}:"
echo "  api.checkSASecretKeyfile"
echo "  api.converterSASecretKeyfile"
echo "  api.storageSASecretKeyfile"
echo ""
echo "Create a key if needed:"
echo "  gcloud iam service-accounts keys create workspace-storage-checks-key.json \\"
echo "    --iam-account=${TARGET_EMAIL} \\"
echo "    --project=${PROJECT_ID}"
echo ""
echo "App config should include:"
echo "  pubsubProjectId: ${PROJECT_ID}"
echo "  converterTopic: projects/${PROJECT_ID}/topics/${TOPIC_NAME}"
echo "  checkTopic: (your checks topic when configured)"
echo ""
if [[ "$CONFIRM" != "1" ]]; then
  echo "Re-run with CONFIRM=1 to apply."
fi
