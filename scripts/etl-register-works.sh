#!/usr/bin/env bash
set -Eeuo pipefail

# Bulk-register works via scripts/etl-register-works.ts
# Edit the placeholders below, or override any value with environment variables.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${SCRIPT_DIR}/.env"
# shellcheck source=lib/load-env.sh
source "${SCRIPT_DIR}/lib/load-env.sh"
load_env_file "${ENV_FILE}"

# Required
SCMS_BASE_URL="${SCMS_BASE_URL:-http://localhost:3031}"
SCMS_TOKEN="${SCMS_TOKEN:-YOUR_BEARER_TOKEN_HERE}"
SCMS_SITE="${SCMS_SITE:-etl-benchmark}"

# Volume
ETL_REGISTRATIONS="${ETL_REGISTRATIONS:-1000}"
ETL_ROOTS="${ETL_ROOTS:-400}"

# Behaviour
ETL_REUSE_RATE="${ETL_REUSE_RATE:-0.6}"
ETL_CONCURRENCY="${ETL_CONCURRENCY:-20}"
ETL_PREFIX="${ETL_PREFIX:-10.5072/etl-bench}"
ETL_RUN_ID="${ETL_RUN_ID:-}"
ETL_RANDOMIZE_PREFIX="${ETL_RANDOMIZE_PREFIX:-1}"
ETL_PROGRESS_EVERY="${ETL_PROGRESS_EVERY:-}"
ETL_PROGRESS_INTERVAL="${ETL_PROGRESS_INTERVAL:-15}"

# Payload
ETL_CDN="${ETL_CDN:-https://not-real.curvenote.dev/}"
ETL_COLLECTION="${ETL_COLLECTION:-articles}"
ETL_KIND="${ETL_KIND:-article}"
ETL_METADATA="${ETL_METADATA:-${SCRIPT_DIR}/fixtures/workversion.json}"
ETL_SUBMISSION_METADATA="${ETL_SUBMISSION_METADATA:-${SCRIPT_DIR}/fixtures/submissionversion.json}"

# Other (set to 1 for a dry run)
ETL_DRY_RUN="${ETL_DRY_RUN:-0}"

# Postgres traffic monitor (macOS localhost TCP capture on lo0)
ETL_MONITOR_PG_TRAFFIC="${ETL_MONITOR_PG_TRAFFIC:-1}"
ETL_PG_PORT="${ETL_PG_PORT:-5432}"

# shellcheck source=lib/monitor-pg-traffic.sh
source "${SCRIPT_DIR}/lib/monitor-pg-traffic.sh"

EXTRA_ARGS=()
for arg in "$@"; do
  case "${arg}" in
    --setup-sudo)
      pg_traffic_setup_sudo
      exit $?
      ;;
    *)
      EXTRA_ARGS+=("${arg}")
      ;;
  esac
done

ARGS=(
  --base-url "${SCMS_BASE_URL}"
  --token "${SCMS_TOKEN}"
  --site "${SCMS_SITE}"
  --registrations "${ETL_REGISTRATIONS}"
  --roots "${ETL_ROOTS}"
  --reuse-rate "${ETL_REUSE_RATE}"
  --concurrency "${ETL_CONCURRENCY}"
  --prefix "${ETL_PREFIX}"
  --cdn "${ETL_CDN}"
  --collection "${ETL_COLLECTION}"
  --kind "${ETL_KIND}"
  --metadata "${ETL_METADATA}"
  --submission-metadata "${ETL_SUBMISSION_METADATA}"
)

if [[ -n "${ETL_RUN_ID}" ]]; then
  ARGS+=(--run-id "${ETL_RUN_ID}")
fi

if [[ -n "${ETL_PROGRESS_EVERY}" ]]; then
  ARGS+=(--progress-every "${ETL_PROGRESS_EVERY}")
fi

if [[ -n "${ETL_PROGRESS_INTERVAL}" ]]; then
  ARGS+=(--progress-interval "${ETL_PROGRESS_INTERVAL}")
fi

if [[ "${ETL_RANDOMIZE_PREFIX}" == "0" ]]; then
  ARGS+=(--no-randomize-prefix)
fi

if [[ "${ETL_DRY_RUN}" == "1" ]]; then
  ARGS+=(--dry-run)
fi

if [[ "${ETL_MONITOR_PG_TRAFFIC}" == "1" && "${ETL_DRY_RUN}" != "1" ]]; then
  pg_traffic_monitor_start "${ETL_PG_PORT}"
  cleanup_pg_traffic_monitor() {
    pg_traffic_monitor_stop "${ETL_PG_PORT}"
  }
  trap cleanup_pg_traffic_monitor EXIT INT TERM
elif [[ "${ETL_DRY_RUN}" == "1" ]]; then
  echo "Postgres traffic monitor: skipped (dry run)."
elif [[ "${ETL_MONITOR_PG_TRAFFIC}" != "1" ]]; then
  echo "Postgres traffic monitor: disabled (ETL_MONITOR_PG_TRAFFIC=${ETL_MONITOR_PG_TRAFFIC})."
fi

cd "${REPO_ROOT}"
set +e
if ((${#EXTRA_ARGS[@]} > 0)); then
  npx tsx scripts/etl-register-works.ts "${ARGS[@]}" "${EXTRA_ARGS[@]}"
else
  npx tsx scripts/etl-register-works.ts "${ARGS[@]}"
fi
exit_code=$?
set -e

exit "${exit_code}"
