#!/usr/bin/env bash
# Cursor Cloud Agent bootstrap — idempotent install script.
# Configure environments via `.cursor/environment.json` / dashboard.
# Set CLOUD_ENV to match scripts/extensions.manifest.json / secrets.manifest.json keys.
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
export ROOT

CLOUD_ENV="${CLOUD_ENV:-${1:-default}}"
export CLOUD_ENV

BUN_VERSION="${BUN_VERSION:-1.3.10}"

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi

  echo "→ bun not found on PATH; installing bun-v${BUN_VERSION}"
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="${BUN_INSTALL}/bin:${PATH}"

  if ! command -v bun >/dev/null 2>&1; then
    echo "❌ bun install failed; ensure the Cursor Cloud image includes Bun (see .cursor/Dockerfile)." >&2
    exit 1
  fi
}

echo "══════════════════════════════════════════════"
echo "  Curvenote cloud setup — ${CLOUD_ENV}"
echo "══════════════════════════════════════════════"

ensure_bun

bash "${ROOT}/scripts/cloud/lib/materialize-secrets.sh"
bash "${ROOT}/scripts/cloud/lib/clone-extensions.sh"

echo "→ Initializing git submodules"
git submodule sync --recursive
git submodule update --init --recursive

echo "→ bun run install:workspace"
bun run install:workspace

# Postgres: docker-compose.yml builds/starts the local SCMS Postgres image (pgmq + pg_net + pg_cron).
echo "→ Starting Postgres (docker compose — see docker-compose.yml)"
bun run db:up

# Migrations + seed: bun run dev:db:reset (same as local first-time setup in platform/scms/README.md).
# Skip on later agent starts when the VM snapshot already has a seeded database volume.
if [[ "${CLOUD_DB_RESET:-}" == "true" ]] || [[ ! -f "${ROOT}/.cloud/db-seeded" ]]; then
  echo "→ bun run dev:db:reset (migrations + seed)"
  bun run dev:db:reset
  mkdir -p "${ROOT}/.cloud"
  touch "${ROOT}/.cloud/db-seeded"
else
  echo "→ Database already seeded (docker volume from snapshot); skipping dev:db:reset"
fi

echo "→ Generating extension loaders"
bun run generate:extensions
bun run generate:relay-plugins

echo "✅ Cloud setup complete for ${CLOUD_ENV}"
