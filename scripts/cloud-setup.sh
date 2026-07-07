#!/usr/bin/env bash
# Cursor Cloud Agent bootstrap — idempotent install script.
# Configure environments in the Cursor dashboard (not in this public repo).
# Set CLOUD_ENV to match your gitignored scripts/extensions.manifest.json key.
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
export ROOT

CLOUD_ENV="${CLOUD_ENV:-${1:-default}}"
export CLOUD_ENV

echo "══════════════════════════════════════════════"
echo "  Curvenote cloud setup — ${CLOUD_ENV}"
echo "══════════════════════════════════════════════"

bash "${ROOT}/scripts/cloud/lib/materialize-secrets.sh"
bash "${ROOT}/scripts/cloud/lib/clone-extensions.sh"

echo "→ Initializing git submodules"
git submodule sync --recursive
git submodule update --init --recursive

echo "→ npm install"
npm install

# Postgres: docker-compose.yml builds/starts the local SCMS Postgres image (pgmq + pg_net + pg_cron).
echo "→ Starting Postgres (docker compose — see docker-compose.yml)"
npm run db:up

# Migrations + seed: npm run dev:db:reset (same as local first-time setup in platform/scms/README.md).
# Skip on later agent starts when the VM snapshot already has a seeded database volume.
if [[ "${CLOUD_DB_RESET:-}" == "true" ]] || [[ ! -f "${ROOT}/.cloud/db-seeded" ]]; then
  echo "→ npm run dev:db:reset (migrations + seed)"
  npm run dev:db:reset
  mkdir -p "${ROOT}/.cloud"
  touch "${ROOT}/.cloud/db-seeded"
else
  echo "→ Database already seeded (docker volume from snapshot); skipping dev:db:reset"
fi

echo "→ Generating extension loaders"
npm run generate:extensions
npm run generate:relay-plugins

echo "✅ Cloud setup complete for ${CLOUD_ENV}"
