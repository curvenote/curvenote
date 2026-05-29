#!/usr/bin/env bash
set -Eeuo pipefail

# Pull works + related rows from staging Postgres into local DATABASE_URL.
# Configure scripts/.env from scripts/env.staging-pull.sample first.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${SCRIPT_DIR}/.env"
# shellcheck source=lib/load-env.sh
source "${SCRIPT_DIR}/lib/load-env.sh"
load_env_file "${ENV_FILE}"

cd "${REPO_ROOT}"

ARGS=()
if [[ -n "${PULL_SOURCE_SITE:-}" ]]; then
  ARGS+=(--source-site "${PULL_SOURCE_SITE}")
fi
if [[ -n "${PULL_TARGET_SITE:-}" ]]; then
  ARGS+=(--target-site "${PULL_TARGET_SITE}")
fi
if [[ -n "${PULL_LIMIT:-}" ]]; then
  ARGS+=(--limit "${PULL_LIMIT}")
fi
if [[ "${PULL_DRY_RUN:-}" == "1" ]]; then
  ARGS+=(--dry-run)
fi
if [[ "${PULL_REPLACE:-}" == "1" ]]; then
  ARGS+=(--replace)
fi
if [[ "${STAGING_DATABASE_SSL_INSECURE:-}" == "1" ]]; then
  ARGS+=(--staging-ssl-insecure)
fi
if [[ "${PULL_NO_ACTIVITY:-}" == "1" ]]; then
  ARGS+=(--no-activity)
fi
if [[ "${PULL_NO_JOBS:-}" == "1" ]]; then
  ARGS+=(--no-jobs)
fi
if [[ "${PULL_NO_CHECKS:-}" == "1" ]]; then
  ARGS+=(--no-checks)
fi

exec npx tsx "${SCRIPT_DIR}/pull-staging-site-data.ts" "${ARGS[@]}" "$@"
